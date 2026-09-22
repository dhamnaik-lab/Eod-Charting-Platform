use chrono::{NaiveDate, Utc};
use csv::WriterBuilder;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter};

use super::connection_registry::load_database_file_info;
use super::eod_data::{
    apply_corporate_adjustments, load_unified_price_rows, resolve_instrument_context,
};
use super::{
    get_price_storage_mode, load_db_stats, normalize_exchange, normalize_optional_trade_date,
    open_read_only_connection_for_folder, resolve_active_database_folder, AppResult,
    ResolvedInstrumentContext,
};

const DATASET_SCHEMA_VERSION: &str = "dnn-research-dataset-v1";
const PROGRESS_EMIT_INTERVAL: usize = 25;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnnResearchDatasetExportInput {
    pub output_parent_directory: String,
    pub exchange: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub adjusted: Option<bool>,
    pub include_dividend_adjustments: Option<bool>,
    pub include_rights_adjustments: Option<bool>,
    pub include_inactive: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnnResearchDatasetExportProgressEvent {
    pub processed_instrument_count: usize,
    pub target_instrument_count: usize,
    pub exported_instrument_count: usize,
    pub exported_bar_count: u64,
    pub failure_count: usize,
    pub current_symbol: Option<String>,
    pub current_exchange: Option<String>,
    pub percent: u8,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnnResearchDatasetExportResult {
    pub status: String,
    pub dataset_directory: String,
    pub manifest_path: String,
    pub database_revision: String,
    pub from_date: String,
    pub to_date: String,
    pub target_instrument_count: usize,
    pub exported_instrument_count: usize,
    pub exported_bar_count: u64,
    pub exported_corporate_action_count: u64,
    pub failure_count: usize,
}

#[derive(Clone, Debug)]
struct ExportOptions {
    exchange: Option<String>,
    from_date: String,
    to_date: String,
    adjusted: bool,
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
    include_inactive: bool,
}

#[derive(Clone, Debug)]
struct ExportCandidate {
    symbol: String,
    exchange: String,
}

#[derive(Clone, Debug)]
struct ExportInstrumentMetadata {
    symbol: String,
    exchange: String,
    bse_security_code: Option<String>,
    isin: Option<String>,
    name: Option<String>,
    series: Option<String>,
    series_as_of_date: Option<String>,
    sector: Option<String>,
    industry: Option<String>,
    is_active: bool,
    lifecycle_status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetManifest {
    schema_version: String,
    dataset_id: String,
    generated_at: String,
    status: String,
    database: DatasetDatabaseManifest,
    filters: DatasetFilterManifest,
    semantics: DatasetSemanticsManifest,
    files: DatasetFilesManifest,
    counts: DatasetCountsManifest,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetDatabaseManifest {
    identity: String,
    revision: String,
    name: String,
    storage_mode: String,
    latest_date: Option<String>,
    source_symbol_count: i64,
    source_bar_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetFilterManifest {
    exchange: String,
    from_date: String,
    to_date: String,
    adjusted: bool,
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
    include_inactive: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetSemanticsManifest {
    timeframe: String,
    canonical_symbol_policy: String,
    source_symbol_column: String,
    identity_history_resolution: bool,
    corporate_action_policy: String,
    missing_instruments_policy: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetFilesManifest {
    instruments: DatasetFileManifest,
    daily_bars: DatasetFileManifest,
    corporate_actions: DatasetFileManifest,
    failures: DatasetFileManifest,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetFileManifest {
    path: String,
    format: String,
    row_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatasetCountsManifest {
    target_instruments: usize,
    exported_instruments: usize,
    daily_bars: u64,
    corporate_actions: u64,
    failures: usize,
}

#[derive(Serialize)]
struct InstrumentCsvRow {
    #[serde(rename = "canonicalSymbol")]
    canonical_symbol: String,
    exchange: String,
    #[serde(rename = "identitySymbols")]
    identity_symbols: String,
    #[serde(rename = "bseSecurityCode")]
    bse_security_code: Option<String>,
    isin: Option<String>,
    name: Option<String>,
    series: Option<String>,
    #[serde(rename = "seriesAsOfDate")]
    series_as_of_date: Option<String>,
    sector: Option<String>,
    industry: Option<String>,
    #[serde(rename = "isActive")]
    is_active: bool,
    #[serde(rename = "lifecycleStatus")]
    lifecycle_status: String,
    #[serde(rename = "firstPriceDate")]
    first_price_date: String,
    #[serde(rename = "lastPriceDate")]
    last_price_date: String,
    #[serde(rename = "barCount")]
    bar_count: usize,
}

#[derive(Serialize)]
struct DailyBarCsvRow {
    #[serde(rename = "canonicalSymbol")]
    canonical_symbol: String,
    exchange: String,
    #[serde(rename = "sourceSymbol")]
    source_symbol: String,
    date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    #[serde(rename = "prevClose")]
    prev_close: Option<f64>,
    volume: i64,
    #[serde(rename = "openInterest")]
    open_interest: i64,
}

#[derive(Serialize)]
struct CorporateActionCsvRow {
    #[serde(rename = "canonicalSymbol")]
    canonical_symbol: String,
    exchange: String,
    #[serde(rename = "effectiveDate")]
    effective_date: String,
    #[serde(rename = "actionType")]
    action_type: String,
    factor: f64,
    #[serde(rename = "adjustVolume")]
    adjust_volume: bool,
    #[serde(rename = "ratioNum")]
    ratio_num: Option<f64>,
    #[serde(rename = "ratioDen")]
    ratio_den: Option<f64>,
    #[serde(rename = "oldFaceValue")]
    old_face_value: Option<f64>,
    #[serde(rename = "newFaceValue")]
    new_face_value: Option<f64>,
    #[serde(rename = "cashAmount")]
    cash_amount: Option<f64>,
    source: Option<String>,
}

#[derive(Serialize)]
struct FailureCsvRow {
    symbol: String,
    exchange: String,
    stage: String,
    message: String,
}

struct PreparedInstrumentExport {
    instrument: InstrumentCsvRow,
    bars: Vec<DailyBarCsvRow>,
    corporate_actions: Vec<CorporateActionCsvRow>,
}

#[tauri::command]
pub async fn export_dnn_research_dataset(
    app: AppHandle,
    input: DnnResearchDatasetExportInput,
) -> AppResult<DnnResearchDatasetExportResult> {
    let folder_path = resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before exporting a DNN research dataset.".to_string())?;
    let task_app = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        export_dnn_research_dataset_from_folder(&folder_path, input, |progress| {
            let _ = task_app.emit("dnn-research-export:progress", progress);
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

fn export_dnn_research_dataset_from_folder<F>(
    folder_path: &Path,
    input: DnnResearchDatasetExportInput,
    mut emit_progress: F,
) -> AppResult<DnnResearchDatasetExportResult>
where
    F: FnMut(DnnResearchDatasetExportProgressEvent),
{
    let output_parent = canonical_output_parent(&input.output_parent_directory)?;
    let connection = open_read_only_connection_for_folder(folder_path)?;
    let db_stats = load_db_stats(folder_path, &connection)?;
    let options = normalize_export_options(&input, &db_stats.date_from, &db_stats.date_to)?;
    let (_, database_file_path) = load_database_file_info(folder_path)?;
    let database_identity = database_file_path.to_string_lossy().to_string();
    let database_revision = build_database_revision(&database_file_path, &db_stats);
    let generated_at = Utc::now().to_rfc3339();
    let dataset_id = format!(
        "eod-dnn-research-{}",
        Utc::now().format("%Y%m%dT%H%M%S%3fZ")
    );
    let final_directory = unique_final_directory(&output_parent, &dataset_id);
    let staging_directory = output_parent.join(format!(".{dataset_id}.tmp"));

    if staging_directory.exists() {
        fs::remove_dir_all(&staging_directory).map_err(|error| {
            format!(
                "Unable to clear the previous dataset staging directory {}: {error}",
                staging_directory.display()
            )
        })?;
    }
    fs::create_dir(&staging_directory).map_err(|error| {
        format!(
            "Unable to create dataset staging directory {}: {error}",
            staging_directory.display()
        )
    })?;

    let export_result = export_dataset_contents(
        folder_path,
        &connection,
        &staging_directory,
        &dataset_id,
        &generated_at,
        &database_identity,
        &database_revision,
        &db_stats,
        &options,
        &mut emit_progress,
    );

    let counts = match export_result {
        Ok(value) => value,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging_directory);
            return Err(error);
        }
    };

    fs::rename(&staging_directory, &final_directory).map_err(|error| {
        let _ = fs::remove_dir_all(&staging_directory);
        format!(
            "Unable to finalize DNN research dataset at {}: {error}",
            final_directory.display()
        )
    })?;

    let status = if counts.failure_count == 0 {
        "complete"
    } else {
        "completeWithFailures"
    };
    let manifest_path = final_directory.join("dataset-manifest.json");

    Ok(DnnResearchDatasetExportResult {
        status: status.to_string(),
        dataset_directory: final_directory.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        database_revision,
        from_date: options.from_date,
        to_date: options.to_date,
        target_instrument_count: counts.target_instrument_count,
        exported_instrument_count: counts.exported_instrument_count,
        exported_bar_count: counts.exported_bar_count,
        exported_corporate_action_count: counts.exported_corporate_action_count,
        failure_count: counts.failure_count,
    })
}

struct ExportCounts {
    target_instrument_count: usize,
    exported_instrument_count: usize,
    exported_bar_count: u64,
    exported_corporate_action_count: u64,
    failure_count: usize,
}

#[allow(clippy::too_many_arguments)]
fn export_dataset_contents<F>(
    folder_path: &Path,
    connection: &Connection,
    staging_directory: &Path,
    dataset_id: &str,
    generated_at: &str,
    database_identity: &str,
    database_revision: &str,
    db_stats: &super::DbStats,
    options: &ExportOptions,
    emit_progress: &mut F,
) -> AppResult<ExportCounts>
where
    F: FnMut(DnnResearchDatasetExportProgressEvent),
{
    let instruments_path = staging_directory.join("instruments.csv");
    let bars_path = staging_directory.join("daily-bars.csv");
    let actions_path = staging_directory.join("corporate-actions.csv");
    let failures_path = staging_directory.join("failures.csv");

    let mut instruments_writer = csv_writer(&instruments_path)?;
    let mut bars_writer = csv_writer(&bars_path)?;
    let mut actions_writer = csv_writer(&actions_path)?;
    let mut failures_writer = csv_writer(&failures_path)?;

    write_instrument_headers(&mut instruments_writer)?;
    write_daily_bar_headers(&mut bars_writer)?;
    write_corporate_action_headers(&mut actions_writer)?;
    write_failure_headers(&mut failures_writer)?;

    let candidates = load_export_candidates(connection, options)?;
    if candidates.is_empty() {
        return Err("No NSE/BSE instruments match the DNN research export filters.".to_string());
    }
    let (contexts, resolution_failures) = resolve_unique_contexts(connection, candidates);
    let resolution_failure_count = resolution_failures.len();
    let target_instrument_count = contexts.len() + resolution_failure_count;
    let mut failure_count = 0usize;

    for failure in resolution_failures {
        failures_writer
            .serialize(failure)
            .map_err(|error| error.to_string())?;
        failure_count += 1;
    }

    let mut exported_instrument_count = 0usize;
    let mut exported_bar_count = 0u64;
    let mut exported_corporate_action_count = 0u64;

    emit_progress(progress_event(
        resolution_failure_count,
        target_instrument_count,
        0,
        0,
        failure_count,
        None,
        None,
    ));

    for (index, context) in contexts.into_iter().enumerate() {
        let processed_instrument_count = resolution_failure_count + index + 1;
        let canonical_symbol = context.current_symbol.clone();
        let exchange = context.exchange.clone();

        let result = prepare_instrument_export(folder_path, connection, &context, options);

        match result {
            Ok(prepared) => {
                let bar_count = prepared.bars.len();
                let action_count = prepared.corporate_actions.len();
                instruments_writer
                    .serialize(prepared.instrument)
                    .map_err(|error| error.to_string())?;
                for row in prepared.bars {
                    bars_writer
                        .serialize(row)
                        .map_err(|error| error.to_string())?;
                }
                for row in prepared.corporate_actions {
                    actions_writer
                        .serialize(row)
                        .map_err(|error| error.to_string())?;
                }
                exported_instrument_count += 1;
                exported_bar_count += bar_count as u64;
                exported_corporate_action_count += action_count as u64;
            }
            Err(error) => {
                failures_writer
                    .serialize(FailureCsvRow {
                        symbol: canonical_symbol.clone(),
                        exchange: exchange.clone(),
                        stage: "export".to_string(),
                        message: error,
                    })
                    .map_err(|csv_error| csv_error.to_string())?;
                failure_count += 1;
            }
        }

        if processed_instrument_count % PROGRESS_EMIT_INTERVAL == 0
            || processed_instrument_count == target_instrument_count
        {
            emit_progress(progress_event(
                processed_instrument_count,
                target_instrument_count,
                exported_instrument_count,
                exported_bar_count,
                failure_count,
                Some(canonical_symbol),
                Some(exchange),
            ));
        }
    }

    instruments_writer
        .flush()
        .map_err(|error| error.to_string())?;
    bars_writer.flush().map_err(|error| error.to_string())?;
    actions_writer.flush().map_err(|error| error.to_string())?;
    failures_writer.flush().map_err(|error| error.to_string())?;

    let status = if failure_count == 0 {
        "complete"
    } else {
        "completeWithFailures"
    };
    let manifest = DatasetManifest {
        schema_version: DATASET_SCHEMA_VERSION.to_string(),
        dataset_id: dataset_id.to_string(),
        generated_at: generated_at.to_string(),
        status: status.to_string(),
        database: DatasetDatabaseManifest {
            identity: database_identity.to_string(),
            revision: database_revision.to_string(),
            name: db_stats.db_name.clone(),
            storage_mode: get_price_storage_mode(connection).as_str().to_string(),
            latest_date: db_stats.date_to.clone(),
            source_symbol_count: db_stats.symbol_count,
            source_bar_count: db_stats.bar_count,
        },
        filters: DatasetFilterManifest {
            exchange: options.exchange.clone().unwrap_or_else(|| "all".to_string()),
            from_date: options.from_date.clone(),
            to_date: options.to_date.clone(),
            adjusted: options.adjusted,
            include_dividend_adjustments: options.include_dividend_adjustments,
            include_rights_adjustments: options.include_rights_adjustments,
            include_inactive: options.include_inactive,
        },
        semantics: DatasetSemanticsManifest {
            timeframe: "1D".to_string(),
            canonical_symbol_policy: "Current canonical symbol after identity-history resolution"
                .to_string(),
            source_symbol_column: "Original symbol selected for each historical bar".to_string(),
            identity_history_resolution: true,
            corporate_action_policy: if options.adjusted {
                "Bars adjusted through the platform corporate-action engine; exact options are recorded in filters"
                    .to_string()
            } else {
                "Raw stored bars; corporate actions exported separately".to_string()
            },
            missing_instruments_policy:
                "Failures are never silently dropped; every failed canonical instrument is recorded in failures.csv"
                    .to_string(),
        },
        files: DatasetFilesManifest {
            instruments: DatasetFileManifest {
                path: "instruments.csv".to_string(),
                format: "csv-utf8-rfc4180".to_string(),
                row_count: exported_instrument_count as u64,
            },
            daily_bars: DatasetFileManifest {
                path: "daily-bars.csv".to_string(),
                format: "csv-utf8-rfc4180".to_string(),
                row_count: exported_bar_count,
            },
            corporate_actions: DatasetFileManifest {
                path: "corporate-actions.csv".to_string(),
                format: "csv-utf8-rfc4180".to_string(),
                row_count: exported_corporate_action_count,
            },
            failures: DatasetFileManifest {
                path: "failures.csv".to_string(),
                format: "csv-utf8-rfc4180".to_string(),
                row_count: failure_count as u64,
            },
        },
        counts: DatasetCountsManifest {
            target_instruments: target_instrument_count,
            exported_instruments: exported_instrument_count,
            daily_bars: exported_bar_count,
            corporate_actions: exported_corporate_action_count,
            failures: failure_count,
        },
    };
    let manifest_text =
        serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(
        staging_directory.join("dataset-manifest.json"),
        manifest_text,
    )
    .map_err(|error| error.to_string())?;

    Ok(ExportCounts {
        target_instrument_count,
        exported_instrument_count,
        exported_bar_count,
        exported_corporate_action_count,
        failure_count,
    })
}

fn prepare_instrument_export(
    folder_path: &Path,
    connection: &Connection,
    context: &ResolvedInstrumentContext,
    options: &ExportOptions,
) -> AppResult<PreparedInstrumentExport> {
    let mut rows = load_unified_price_rows(
        folder_path,
        connection,
        context,
        &options.from_date,
        &options.to_date,
    )?;
    if options.adjusted {
        rows = apply_corporate_adjustments(
            rows,
            &context.corporate_actions,
            options.include_dividend_adjustments,
            options.include_rights_adjustments,
        )?;
    }
    if rows.is_empty() {
        return Err(format!(
            "No daily bars exist between {} and {}.",
            options.from_date, options.to_date
        ));
    }

    let metadata = load_export_instrument_metadata(connection, context)?;
    let mut identity_symbols = context.related_symbols.clone();
    identity_symbols.sort();
    identity_symbols.dedup();
    let first_price_date = rows.first().map(|row| row.date.clone()).unwrap_or_default();
    let last_price_date = rows.last().map(|row| row.date.clone()).unwrap_or_default();
    let bar_count = rows.len();

    let instrument = InstrumentCsvRow {
        canonical_symbol: metadata.symbol,
        exchange: metadata.exchange,
        identity_symbols: identity_symbols.join("|"),
        bse_security_code: metadata.bse_security_code,
        isin: metadata.isin,
        name: metadata.name,
        series: metadata.series,
        series_as_of_date: metadata.series_as_of_date,
        sector: metadata.sector,
        industry: metadata.industry,
        is_active: metadata.is_active,
        lifecycle_status: metadata.lifecycle_status,
        first_price_date,
        last_price_date,
        bar_count,
    };

    let bars = rows
        .into_iter()
        .map(|row| DailyBarCsvRow {
            canonical_symbol: context.current_symbol.clone(),
            exchange: context.exchange.clone(),
            source_symbol: row.symbol,
            date: row.date,
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            prev_close: row.prev_close,
            volume: row.volume,
            open_interest: row.open_interest,
        })
        .collect::<Vec<_>>();

    let mut seen_action_ids = HashSet::new();
    let corporate_actions = context
        .corporate_actions
        .iter()
        .filter(|action| {
            action.effective_date.as_str() >= options.from_date.as_str()
                && action.effective_date.as_str() <= options.to_date.as_str()
                && seen_action_ids.insert(action.id)
        })
        .map(|action| CorporateActionCsvRow {
            canonical_symbol: context.current_symbol.clone(),
            exchange: context.exchange.clone(),
            effective_date: action.effective_date.clone(),
            action_type: action.action_type.clone(),
            factor: action.factor,
            adjust_volume: action.adjust_volume != 0,
            ratio_num: action.ratio_num,
            ratio_den: action.ratio_den,
            old_face_value: action.old_face_value,
            new_face_value: action.new_face_value,
            cash_amount: action.cash_amount,
            source: action.source.clone(),
        })
        .collect::<Vec<_>>();

    Ok(PreparedInstrumentExport {
        instrument,
        bars,
        corporate_actions,
    })
}

fn load_export_candidates(
    connection: &Connection,
    options: &ExportOptions,
) -> AppResult<Vec<ExportCandidate>> {
    let mut statement = connection
        .prepare(
            "
              SELECT symbol, exchange
              FROM instruments
              WHERE exchange IN ('NSE', 'BSE')
                AND (?1 IS NULL OR exchange = ?1)
                AND (?2 = 1 OR COALESCE(is_active, 1) = 1)
              ORDER BY exchange ASC, symbol ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let mapped_rows = statement
        .query_map(
            params![options.exchange.as_deref(), options.include_inactive as i64],
            |row| {
                Ok(ExportCandidate {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                })
            },
        )
        .map_err(|error| error.to_string())?;

    let candidates = mapped_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(candidates)
}

fn resolve_unique_contexts(
    connection: &Connection,
    candidates: Vec<ExportCandidate>,
) -> (Vec<ResolvedInstrumentContext>, Vec<FailureCsvRow>) {
    let mut contexts = Vec::new();
    let mut failures = Vec::new();
    let mut seen = HashSet::new();

    for candidate in candidates {
        match resolve_instrument_context(connection, &candidate.symbol, &candidate.exchange) {
            Ok(Some(context)) => {
                let key = format!("{}:{}", context.exchange, context.current_symbol);
                if seen.insert(key) {
                    contexts.push(context);
                }
            }
            Ok(None) => failures.push(FailureCsvRow {
                symbol: candidate.symbol,
                exchange: candidate.exchange,
                stage: "identityResolution".to_string(),
                message: "Instrument identity could not be resolved.".to_string(),
            }),
            Err(error) => failures.push(FailureCsvRow {
                symbol: candidate.symbol,
                exchange: candidate.exchange,
                stage: "identityResolution".to_string(),
                message: error,
            }),
        }
    }

    contexts.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.current_symbol.cmp(&right.current_symbol))
    });
    (contexts, failures)
}

fn load_export_instrument_metadata(
    connection: &Connection,
    context: &ResolvedInstrumentContext,
) -> AppResult<ExportInstrumentMetadata> {
    let mut candidate_symbols = vec![context.current_symbol.clone()];
    candidate_symbols.extend(context.related_symbols.iter().cloned());
    candidate_symbols.sort();
    candidate_symbols.dedup();
    candidate_symbols.sort_by_key(|symbol| symbol != &context.current_symbol);

    for candidate_symbol in candidate_symbols {
        let metadata = connection
            .query_row(
                "
                  SELECT
                    symbol,
                    exchange,
                    bse_security_code,
                    isin,
                    name,
                    series,
                    series_as_of_date,
                    sector,
                    industry,
                    COALESCE(is_active, 1),
                    COALESCE(
                      lifecycle_status,
                      CASE WHEN COALESCE(is_active, 1) = 1 THEN 'CURRENT' ELSE 'UNKNOWN_INACTIVE' END
                    )
                  FROM instruments
                  WHERE symbol = ?1 AND exchange = ?2
                ",
                params![candidate_symbol, context.exchange],
                |row| {
                    Ok(ExportInstrumentMetadata {
                        symbol: context.current_symbol.clone(),
                        exchange: context.exchange.clone(),
                        bse_security_code: row.get(2)?,
                        isin: row.get(3)?,
                        name: row.get(4)?,
                        series: row.get(5)?,
                        series_as_of_date: row.get(6)?,
                        sector: row.get(7)?,
                        industry: row.get(8)?,
                        is_active: row.get::<_, i64>(9)? != 0,
                        lifecycle_status: row.get(10)?,
                    })
                },
            )
            .optional()
            .map_err(|error| error.to_string())?;
        if let Some(metadata) = metadata {
            return Ok(metadata);
        }
    }

    Err(format!(
        "Unable to load instrument metadata for canonical identity {}:{}.",
        context.exchange, context.current_symbol
    ))
}

fn normalize_export_options(
    input: &DnnResearchDatasetExportInput,
    database_from: &Option<String>,
    database_to: &Option<String>,
) -> AppResult<ExportOptions> {
    let exchange = match input.exchange.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(value) if value.eq_ignore_ascii_case("all") => None,
        Some(value) => Some(normalize_exchange(value)?),
    };
    let from_date = normalize_optional_trade_date(input.from_date.as_deref())?
        .or_else(|| database_from.clone())
        .ok_or_else(|| "The active database does not contain a first trade date.".to_string())?;
    let to_date = normalize_optional_trade_date(input.to_date.as_deref())?
        .or_else(|| database_to.clone())
        .ok_or_else(|| "The active database does not contain a latest trade date.".to_string())?;
    validate_iso_trade_date(&from_date)?;
    validate_iso_trade_date(&to_date)?;
    if from_date > to_date {
        return Err(format!(
            "DNN research export start date {from_date} is after end date {to_date}."
        ));
    }

    let adjusted = input.adjusted.unwrap_or(true);
    Ok(ExportOptions {
        exchange,
        from_date,
        to_date,
        adjusted,
        include_dividend_adjustments: adjusted
            && input.include_dividend_adjustments.unwrap_or(false),
        include_rights_adjustments: adjusted && input.include_rights_adjustments.unwrap_or(false),
        include_inactive: input.include_inactive.unwrap_or(true),
    })
}

fn validate_iso_trade_date(value: &str) -> AppResult<()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!("Invalid DNN research export trade date: {value}"))
}

fn canonical_output_parent(value: &str) -> AppResult<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Choose an output parent directory for the DNN research dataset.".to_string());
    }
    let path = fs::canonicalize(PathBuf::from(trimmed))
        .map_err(|error| format!("Unable to resolve output directory {trimmed}: {error}"))?;
    if !path.is_dir() {
        return Err(format!(
            "Output path is not a directory: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn unique_final_directory(parent: &Path, dataset_id: &str) -> PathBuf {
    let base = parent.join(dataset_id);
    if !base.exists() {
        return base;
    }
    for index in 2..=10_000 {
        let candidate = parent.join(format!("{dataset_id}-{index}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{dataset_id}-{}", std::process::id()))
}

fn build_database_revision(database_file_path: &Path, db_stats: &super::DbStats) -> String {
    let modified_millis = fs::metadata(database_file_path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!(
        "{}:{}:{}:{}:{}",
        database_file_path.to_string_lossy(),
        db_stats.date_to.clone().unwrap_or_default(),
        db_stats.symbol_count,
        db_stats.bar_count,
        modified_millis
    )
}

fn csv_writer(path: &Path) -> AppResult<csv::Writer<fs::File>> {
    WriterBuilder::new()
        .has_headers(false)
        .from_path(path)
        .map_err(|error| format!("Unable to create {}: {error}", path.display()))
}

fn write_instrument_headers(writer: &mut csv::Writer<fs::File>) -> AppResult<()> {
    writer
        .write_record([
            "canonicalSymbol",
            "exchange",
            "identitySymbols",
            "bseSecurityCode",
            "isin",
            "name",
            "series",
            "seriesAsOfDate",
            "sector",
            "industry",
            "isActive",
            "lifecycleStatus",
            "firstPriceDate",
            "lastPriceDate",
            "barCount",
        ])
        .map_err(|error| error.to_string())
}

fn write_daily_bar_headers(writer: &mut csv::Writer<fs::File>) -> AppResult<()> {
    writer
        .write_record([
            "canonicalSymbol",
            "exchange",
            "sourceSymbol",
            "date",
            "open",
            "high",
            "low",
            "close",
            "prevClose",
            "volume",
            "openInterest",
        ])
        .map_err(|error| error.to_string())
}

fn write_corporate_action_headers(writer: &mut csv::Writer<fs::File>) -> AppResult<()> {
    writer
        .write_record([
            "canonicalSymbol",
            "exchange",
            "effectiveDate",
            "actionType",
            "factor",
            "adjustVolume",
            "ratioNum",
            "ratioDen",
            "oldFaceValue",
            "newFaceValue",
            "cashAmount",
            "source",
        ])
        .map_err(|error| error.to_string())
}

fn write_failure_headers(writer: &mut csv::Writer<fs::File>) -> AppResult<()> {
    writer
        .write_record(["symbol", "exchange", "stage", "message"])
        .map_err(|error| error.to_string())
}

fn progress_event(
    processed_instrument_count: usize,
    target_instrument_count: usize,
    exported_instrument_count: usize,
    exported_bar_count: u64,
    failure_count: usize,
    current_symbol: Option<String>,
    current_exchange: Option<String>,
) -> DnnResearchDatasetExportProgressEvent {
    let percent = if target_instrument_count == 0 {
        100
    } else {
        (((processed_instrument_count as f64 / target_instrument_count as f64) * 100.0).round()
            as u8)
            .min(100)
    };
    DnnResearchDatasetExportProgressEvent {
        processed_instrument_count,
        target_instrument_count,
        exported_instrument_count,
        exported_bar_count,
        failure_count,
        current_symbol: current_symbol.clone(),
        current_exchange: current_exchange.clone(),
        percent,
        message: match (current_exchange, current_symbol) {
            (Some(exchange), Some(symbol)) => format!(
                "Exporting DNN research dataset: {processed_instrument_count}/{target_instrument_count} ({percent}%) - {exchange}:{symbol}"
            ),
            _ => format!(
                "Preparing DNN research dataset export ({processed_instrument_count}/{target_instrument_count})."
            ),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::open_connection_for_folder;
    use serde_json::Value;
    use tempfile::tempdir;

    #[test]
    fn exports_manifest_instruments_bars_and_actions_from_read_only_database() {
        let database_root = tempdir().unwrap();
        let output_root = tempdir().unwrap();
        let connection = open_connection_for_folder(database_root.path(), true).unwrap();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, sector, industry, is_active) VALUES ('TCS', 'NSE', 'INE467B01029', 'Tata Consultancy Services', 'EQ', 'Information Technology', 'IT Services', 1)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest) VALUES ('TCS', 'NSE', '2026-08-03', 3000, 3050, 2990, 3040, 2995, 1000000, 0)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_actions (symbol, exchange, effective_date, action_type, factor, adjust_volume, note) VALUES ('TCS', 'NSE', '2026-08-03', 'SPLIT', 1.0, 1, 'test')",
                [],
            )
            .unwrap();
        drop(connection);

        let result = export_dnn_research_dataset_from_folder(
            database_root.path(),
            DnnResearchDatasetExportInput {
                output_parent_directory: output_root.path().to_string_lossy().to_string(),
                exchange: Some("NSE".to_string()),
                from_date: Some("2026-08-03".to_string()),
                to_date: Some("2026-08-03".to_string()),
                adjusted: Some(false),
                include_dividend_adjustments: Some(false),
                include_rights_adjustments: Some(false),
                include_inactive: Some(true),
            },
            |_| {},
        )
        .unwrap();

        assert_eq!(result.status, "complete");
        assert_eq!(result.exported_instrument_count, 1);
        assert_eq!(result.exported_bar_count, 1);
        assert_eq!(result.exported_corporate_action_count, 1);
        assert_eq!(result.failure_count, 0);

        let dataset_directory = PathBuf::from(result.dataset_directory);
        let manifest: Value = serde_json::from_str(
            &fs::read_to_string(dataset_directory.join("dataset-manifest.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(manifest["schemaVersion"], DATASET_SCHEMA_VERSION);
        assert_eq!(manifest["counts"]["dailyBars"], 1);
        assert!(
            fs::read_to_string(dataset_directory.join("instruments.csv"))
                .unwrap()
                .contains("TCS,NSE,TCS")
        );
        assert!(fs::read_to_string(dataset_directory.join("daily-bars.csv"))
            .unwrap()
            .contains("TCS,NSE,TCS,2026-08-03"));
    }

    #[test]
    fn rejects_an_invalid_calendar_date() {
        let error = normalize_export_options(
            &DnnResearchDatasetExportInput {
                output_parent_directory: "unused".to_string(),
                exchange: Some("all".to_string()),
                from_date: Some("2026-02-30".to_string()),
                to_date: Some("2026-03-01".to_string()),
                adjusted: None,
                include_dividend_adjustments: None,
                include_rights_adjustments: None,
                include_inactive: None,
            },
            &Some("2020-01-01".to_string()),
            &Some("2026-08-05".to_string()),
        )
        .unwrap_err();

        assert!(error.contains("Invalid DNN research export trade date"));
    }

    #[test]
    fn rejects_an_empty_database_without_publishing_a_dataset() {
        let database_root = tempdir().unwrap();
        let output_root = tempdir().unwrap();
        let connection = open_connection_for_folder(database_root.path(), true).unwrap();
        drop(connection);

        let error = export_dnn_research_dataset_from_folder(
            database_root.path(),
            DnnResearchDatasetExportInput {
                output_parent_directory: output_root.path().to_string_lossy().to_string(),
                exchange: Some("all".to_string()),
                from_date: Some("2026-08-03".to_string()),
                to_date: Some("2026-08-03".to_string()),
                adjusted: Some(true),
                include_dividend_adjustments: Some(false),
                include_rights_adjustments: Some(false),
                include_inactive: Some(true),
            },
            |_| {},
        )
        .unwrap_err();

        assert!(error.contains("No NSE/BSE instruments"));
        assert_eq!(fs::read_dir(output_root.path()).unwrap().count(), 0);
    }

    #[test]
    fn rejects_an_inverted_export_date_range() {
        let error = normalize_export_options(
            &DnnResearchDatasetExportInput {
                output_parent_directory: "unused".to_string(),
                exchange: Some("all".to_string()),
                from_date: Some("2026-08-05".to_string()),
                to_date: Some("2026-08-03".to_string()),
                adjusted: None,
                include_dividend_adjustments: None,
                include_rights_adjustments: None,
                include_inactive: None,
            },
            &Some("2020-01-01".to_string()),
            &Some("2026-08-05".to_string()),
        )
        .unwrap_err();

        assert!(error.contains("after end date"));
    }
}

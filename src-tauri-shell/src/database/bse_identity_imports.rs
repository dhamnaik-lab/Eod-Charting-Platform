use csv::StringRecord;
use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

mod apply_reporting;
mod master_transport;
mod name_history;
pub use apply_reporting::list_bse_identity_apply_history;
pub use name_history::{refresh_bse_name_history, preview_bse_name_history, apply_bse_name_history,
    list_bse_name_history_runs, get_bse_name_history_report};

use super::official_source_urls::{load_official_source_urls, OfficialSourceUrls};
use super::{
    emit_database_changed, get_app_snapshot_internal, invalidate_cached_db_stats,
    normalize_optional_text, normalize_symbol, open_connection_for_folder,
    resolve_active_database_folder, AppResult, BseCurrentUniverseApplyInput,
    BseCurrentUniverseMasterDownloadResult, BseCurrentUniverseSyncInput,
    BseCurrentUniverseSyncPreviewRow, BseCurrentUniverseSyncResult, SnapshotOptions,
};

const BSE_EXCHANGE: &str = "BSE";
pub(super) const BSE_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const BSE_CURRENT_POPULATION_SANITY_MINIMUM: usize = 1000;
const SOURCE_POPULATION_SANITY_REJECTED: &str = "SOURCE_POPULATION_SANITY_REJECTED";
const BSE_SOURCE_CONTRACT_REJECTED: &str = "BSE_SOURCE_CONTRACT_REJECTED";
const BSE_LIFECYCLE_STATUSES: &[(&str, &str)] = &[
    ("Active", "CURRENT"),
    ("Delisted", "DELISTED"),
    ("Suspended", "SUSPENDED"),
];

#[derive(Clone, Debug, Serialize)]
struct BseMasterRow {
    symbol: String,
    security_code: Option<String>,
    name: Option<String>,
    series: Option<String>,
    isin: Option<String>,
    lifecycle_status: String,
}

#[derive(Clone, Debug, Serialize)]
struct ExistingBseInstrumentRow {
    symbol: String,
    security_code: Option<String>,
    name: Option<String>,
    series: Option<String>,
    isin: Option<String>,
    is_active: bool,
    lifecycle_status: String,
}

#[derive(Clone, Debug, Serialize)]
struct BseCurrentUniverseSyncPlan {
    master_file_path: String,
    master_sha256: String,
    existing_rows: Vec<ExistingBseInstrumentRow>,
    master_rows_read: u32,
    current_universe_symbols: u32,
    activate_count: u32,
    update_count: u32,
    deactivate_count: u32,
    unchanged_active: u32,
    preview_rows: Vec<BseCurrentUniverseSyncPreviewRow>,
    current_rows: Vec<BseMasterRow>,
    inactive_rows: Vec<BseMasterRow>,
    deactivate_symbols: Vec<String>,
}

#[tauri::command]
pub async fn download_bse_current_universe_master(
    app: AppHandle,
) -> AppResult<BseCurrentUniverseMasterDownloadResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before downloading the BSE current master.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let urls = load_official_source_urls(Some(&connection))?;
        master_transport::download(&app_handle, &folder_path, &urls)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn preview_bse_current_universe_sync(
    app: AppHandle,
    input: BseCurrentUniverseSyncInput,
) -> AppResult<BseCurrentUniverseSyncResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before previewing the BSE current-symbol sync.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        preview_bse_current_universe_sync_internal(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn apply_bse_current_universe_sync(
    app: AppHandle,
    input: BseCurrentUniverseApplyInput,
    operation_id: Option<String>,
) -> AppResult<BseCurrentUniverseSyncResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = resolve_active_database_folder(&app)?
            .ok_or("Open a database before applying BSE changes.")?;
        apply_reporting::check_database_path(&folder, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder, false)?;
        let report = |progress: super::IdentityApplyProgress| {
            if let Some(id) = &operation_id {
                let _ = app.emit(
                    "identity:apply-progress",
                    serde_json::json!({
                        "operationId": id, "databasePath": folder, "progress": progress
                    }),
                );
            }
        };
        let mut result = apply_reporting::apply_reviewed(&connection, &input, &report)?;
        report(apply_reporting::progress("refreshing", 0, 0));
        let refresh = (|| -> AppResult<()> {
            invalidate_cached_db_stats(&app, &folder)?;
            let snapshot = get_app_snapshot_internal(
                &app,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app, &snapshot)
        })();
        if let Err(error) = refresh {
            result.refresh_warning = Some(error);
        }
        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn validate_bse_current_population_sanity(
    active_symbols: usize,
    delisted_symbols: usize,
    suspended_symbols: usize,
) -> AppResult<()> {
    if active_symbols < BSE_CURRENT_POPULATION_SANITY_MINIMUM {
        return Err(format!(
            "{SOURCE_POPULATION_SANITY_REJECTED}: BSE current universe has {active_symbols} active symbols; minimum accepted population is {BSE_CURRENT_POPULATION_SANITY_MINIMUM}. Delisted={delisted_symbols}, suspended={suspended_symbols} do not satisfy the active-source minimum."
        ));
    }
    Ok(())
}

pub(super) fn validate_bse_master_bytes_for_health(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<usize> {
    load_bse_master_rows_from_bytes(bytes, source_label).map(|rows| rows.len())
}

pub(super) fn validate_bse_active_population_for_health(active_symbols: usize) -> AppResult<()> {
    validate_bse_current_population_sanity(active_symbols, 0, 0)
}

fn preview_bse_current_universe_sync_internal(
    connection: &Connection,
    input: &BseCurrentUniverseSyncInput,
) -> AppResult<BseCurrentUniverseSyncResult> {
    let plan = build_bse_current_universe_sync_plan(connection, input)?;
    Ok(plan_into_result(plan, false))
}

#[cfg(test)]
fn apply_bse_current_universe_sync_internal(
    connection: &Connection,
    input: &BseCurrentUniverseSyncInput,
) -> AppResult<BseCurrentUniverseSyncResult> {
    let plan = build_bse_current_universe_sync_plan(connection, input)?;
    apply_bse_current_universe_sync_plan(connection, &plan)?;
    Ok(plan_into_result(plan, true))
}

fn build_bse_current_universe_sync_plan(
    connection: &Connection,
    input: &BseCurrentUniverseSyncInput,
) -> AppResult<BseCurrentUniverseSyncPlan> {
    let master_path = normalize_master_file_path(&input.master_file_path)?;
    let bytes = fs::read(&master_path).map_err(|error| error.to_string())?;
    let current_rows = load_bse_master_rows_from_bytes(&bytes, &master_path.display().to_string())?;
    let active_rows = current_rows
        .iter()
        .filter(|row| row.lifecycle_status == "CURRENT")
        .count();
    let delisted_rows = current_rows
        .iter()
        .filter(|row| row.lifecycle_status == "DELISTED")
        .count();
    let suspended_rows = current_rows
        .iter()
        .filter(|row| row.lifecycle_status == "SUSPENDED")
        .count();
    validate_bse_current_population_sanity(active_rows, delisted_rows, suspended_rows)?;
    let existing_rows = load_existing_bse_instrument_rows(connection)?;
    let mut plan = plan_bse_current_universe_sync_from_rows(
        master_path.display().to_string(),
        current_rows.len() as u32,
        current_rows,
        existing_rows,
    );
    plan.master_sha256 = format!("{:x}", Sha256::digest(&bytes));
    Ok(plan)
}

#[cfg(test)]
fn apply_bse_current_universe_sync_plan(
    connection: &Connection,
    plan: &BseCurrentUniverseSyncPlan,
) -> AppResult<()> {
    super::run_connection_transaction(connection, |connection| {
        write_bse_plan(connection, plan, &|_| {})
    })
}

fn write_bse_plan(
    connection: &Connection,
    plan: &BseCurrentUniverseSyncPlan,
    report: &dyn Fn(usize),
) -> AppResult<()> {
    let changed: HashSet<&str> = plan
        .preview_rows
        .iter()
        .map(|row| row.symbol.as_str())
        .collect();
    let mut processed = 0;
    let mut advance = || {
        processed += 1;
        report(processed);
    };
    for row in plan
        .current_rows
        .iter()
        .filter(|row| changed.contains(row.symbol.as_str()))
    {
        connection
                .execute(
                    "
                      INSERT INTO instruments (
                        symbol,
                        exchange,
                        bse_security_code,
                        isin,
                        name,
                        series,
                        is_active,
                        lifecycle_status,
                        updated_at
                      )
                      VALUES (?, ?, ?, ?, ?, ?, 1, 'CURRENT', datetime('now'))
                      ON CONFLICT(symbol, exchange) DO UPDATE SET
                        bse_security_code = COALESCE(excluded.bse_security_code, instruments.bse_security_code),
                        isin = COALESCE(excluded.isin, instruments.isin),
                        name = COALESCE(excluded.name, instruments.name),
                        series = COALESCE(excluded.series, instruments.series),
                        is_active = 1,
                        lifecycle_status = 'CURRENT',
                        updated_at = excluded.updated_at
                    ",
                    params![
                        row.symbol,
                        BSE_EXCHANGE,
                        row.security_code,
                        row.isin,
                        row.name,
                        row.series
                    ],
                )
                .map_err(|error| error.to_string())?;
        advance();
    }

    for row in plan
        .inactive_rows
        .iter()
        .filter(|row| changed.contains(row.symbol.as_str()))
    {
        connection
            .execute(
                "
                      UPDATE instruments
                      SET bse_security_code = COALESCE(?, bse_security_code),
                          isin = COALESCE(?, isin),
                          name = COALESCE(?, name),
                          series = COALESCE(?, series),
                          is_active = 0,
                          lifecycle_status = ?,
                          updated_at = datetime('now')
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                params![
                    row.security_code,
                    row.isin,
                    row.name,
                    row.series,
                    row.lifecycle_status,
                    row.symbol,
                    BSE_EXCHANGE
                ],
            )
            .map_err(|error| error.to_string())?;
        advance();
    }

    for symbol in &plan.deactivate_symbols {
        connection
            .execute(
                "
                      UPDATE instruments
                      SET is_active = 0,
                          lifecycle_status = 'UNKNOWN_INACTIVE',
                          updated_at = datetime('now')
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                params![symbol, BSE_EXCHANGE],
            )
            .map_err(|error| error.to_string())?;
        advance();
    }

    Ok(())
}

fn bse_metadata_changed(existing: &ExistingBseInstrumentRow, row: &BseMasterRow) -> bool {
    // COALESCE preserves absent source values; do not invent repeat updates for them.
    [
        (&row.security_code, &existing.security_code),
        (&row.name, &existing.name),
        (&row.series, &existing.series),
        (&row.isin, &existing.isin),
    ]
    .iter()
    .any(|(proposed, current)| proposed.is_some() && proposed != current)
}

fn plan_bse_current_universe_sync_from_rows(
    master_file_path: String,
    master_rows_read: u32,
    master_rows: Vec<BseMasterRow>,
    existing_rows: Vec<ExistingBseInstrumentRow>,
) -> BseCurrentUniverseSyncPlan {
    let current_rows = master_rows
        .iter()
        .filter(|row| row.lifecycle_status == "CURRENT")
        .cloned()
        .collect::<Vec<_>>();
    let inactive_rows = master_rows
        .iter()
        .filter(|row| row.lifecycle_status == "DELISTED" || row.lifecycle_status == "SUSPENDED")
        .cloned()
        .collect::<Vec<_>>();
    let existing_by_symbol = existing_rows
        .iter()
        .map(|row| (row.symbol.clone(), row.clone()))
        .collect::<HashMap<_, _>>();
    let current_symbols = current_rows
        .iter()
        .map(|row| row.symbol.clone())
        .collect::<HashSet<_>>();
    let official_inactive_by_symbol = inactive_rows
        .iter()
        .map(|row| (row.symbol.clone(), row.clone()))
        .collect::<HashMap<_, _>>();
    let official_inactive_symbols = official_inactive_by_symbol
        .keys()
        .cloned()
        .collect::<HashSet<_>>();

    let existing_snapshot = existing_rows.clone();
    let mut activate_count = 0_u32;
    let mut update_count = 0_u32;
    let mut official_inactive_count = 0_u32;
    let mut unchanged_active = 0_u32;
    let mut preview_rows = Vec::new();

    for row in &current_rows {
        if let Some(existing) = existing_by_symbol.get(&row.symbol) {
            let metadata_changed =
                bse_metadata_changed(existing, row) || existing.lifecycle_status != "CURRENT";
            if existing.is_active {
                if metadata_changed {
                    update_count += 1;
                    preview_rows.push(BseCurrentUniverseSyncPreviewRow {
                        action: "UPDATE".to_string(),
                        symbol: row.symbol.clone(),
                        security_code: row.security_code.clone(),
                        company_name: row.name.clone(),
                        series: row.series.clone(),
                        isin: row.isin.clone(),
                        current_status: "ACTIVE".to_string(),
                        proposed_status: "ACTIVE".to_string(),
                        reason: "Exact BSE symbol matched in instruments; metadata will be refreshed from the current BSE master.".to_string(),
                    });
                } else {
                    unchanged_active += 1;
                }
            } else {
                activate_count += 1;
                preview_rows.push(BseCurrentUniverseSyncPreviewRow {
                    action: "REACTIVATE".to_string(),
                    symbol: row.symbol.clone(),
                    security_code: row.security_code.clone(),
                    company_name: row.name.clone(),
                    series: row.series.clone(),
                    isin: row.isin.clone(),
                    current_status: "INACTIVE".to_string(),
                    proposed_status: "ACTIVE".to_string(),
                    reason: "Exact BSE symbol matched an inactive row; it will be reactivated from the current BSE master.".to_string(),
                });
            }
            continue;
        }

        activate_count += 1;
        preview_rows.push(BseCurrentUniverseSyncPreviewRow {
            action: "INSERT".to_string(),
            symbol: row.symbol.clone(),
            security_code: row.security_code.clone(),
            company_name: row.name.clone(),
            series: row.series.clone(),
            isin: row.isin.clone(),
            current_status: "MISSING".to_string(),
            proposed_status: "ACTIVE".to_string(),
            reason: "Current BSE master symbol is not present in the database and will be inserted as active.".to_string(),
        });
    }

    for row in &inactive_rows {
        if let Some(existing) = existing_by_symbol.get(&row.symbol) {
            if !existing.is_active
                && existing.lifecycle_status == row.lifecycle_status
                && !bse_metadata_changed(existing, row)
            {
                continue;
            }
            official_inactive_count += 1;
            preview_rows.push(BseCurrentUniverseSyncPreviewRow {
                action: row.lifecycle_status.clone(),
                symbol: row.symbol.clone(),
                security_code: row.security_code.clone(),
                company_name: row.name.clone().or_else(|| existing.name.clone()),
                series: row.series.clone().or_else(|| existing.series.clone()),
                isin: row.isin.clone().or_else(|| existing.isin.clone()),
                current_status: if existing.is_active {
                    "ACTIVE".to_string()
                } else {
                    "INACTIVE".to_string()
                },
                proposed_status: row.lifecycle_status.clone(),
                reason: format!(
                    "BSE official List of Scrips marks this symbol as {}.",
                    row.lifecycle_status
                ),
            });
        }
    }

    let mut deactivate_symbols = Vec::new();
    for row in &existing_rows {
        if row.is_active
            && !current_symbols.contains(&row.symbol)
            && !official_inactive_symbols.contains(&row.symbol)
        {
            deactivate_symbols.push(row.symbol.clone());
            preview_rows.push(BseCurrentUniverseSyncPreviewRow {
                action: "DEACTIVATE".to_string(),
                symbol: row.symbol.clone(),
                security_code: None,
                company_name: row.name.clone(),
                series: row.series.clone(),
                isin: row.isin.clone(),
                current_status: "ACTIVE".to_string(),
                proposed_status: "UNKNOWN_INACTIVE".to_string(),
                reason: "Symbol is not present in BSE active, delisted, or suspended masters and will be hidden pending review.".to_string(),
            });
        }
    }

    preview_rows.sort_by(|left, right| {
        sync_action_rank(&left.action)
            .cmp(&sync_action_rank(&right.action))
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    deactivate_symbols.sort();

    BseCurrentUniverseSyncPlan {
        master_file_path,
        master_sha256: String::new(),
        existing_rows: existing_snapshot,
        master_rows_read,
        current_universe_symbols: current_rows.len() as u32,
        activate_count,
        update_count,
        deactivate_count: deactivate_symbols.len() as u32 + official_inactive_count,
        unchanged_active,
        preview_rows,
        current_rows,
        inactive_rows,
        deactivate_symbols,
    }
}

fn plan_into_result(
    plan: BseCurrentUniverseSyncPlan,
    applied: bool,
) -> BseCurrentUniverseSyncResult {
    let message = if applied {
        format!(
            "Applied BSE current-universe sync. Current {} symbols. Activate {}, update {}, deactivate {}, unchanged {}.",
            plan.current_universe_symbols,
            plan.activate_count,
            plan.update_count,
            plan.deactivate_count,
            plan.unchanged_active
        )
    } else {
        format!(
            "Previewed BSE current-universe sync. Current {} symbols. Activate {}, update {}, deactivate {}, unchanged {}.",
            plan.current_universe_symbols,
            plan.activate_count,
            plan.update_count,
            plan.deactivate_count,
            plan.unchanged_active
        )
    };

    let plan_sha256 = apply_reporting::plan_sha256(&plan);
    let new_symbols = plan
        .preview_rows
        .iter()
        .filter(|row| row.action == "INSERT")
        .count() as u32;
    BseCurrentUniverseSyncResult {
        run_id: None,
        completed_at: None,
        refresh_warning: None,
        plan_sha256,
        master_sha256: plan.master_sha256,
        new_symbols,
        master_file_path: plan.master_file_path,
        applied,
        master_rows_read: plan.master_rows_read,
        current_universe_symbols: plan.current_universe_symbols,
        activate_count: plan.activate_count,
        update_count: plan.update_count,
        deactivate_count: plan.deactivate_count,
        unchanged_active: plan.unchanged_active,
        preview_rows: plan.preview_rows,
        message,
    }
}

fn normalize_master_file_path(value: &str) -> AppResult<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Enter the BSE current master CSV path first.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err(format!(
            "BSE current master CSV was not found: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn append_bse_lifecycle_csv(
    combined_csv: &mut String,
    csv_text: &str,
    lifecycle_status: &str,
) -> AppResult<()> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(csv_text.as_bytes());
    let headers = reader.headers().map_err(|error| error.to_string())?.clone();
    if combined_csv.is_empty() {
        combined_csv.push_str(&headers.iter().collect::<Vec<_>>().join(","));
        combined_csv.push_str(",Lifecycle Status\n");
    }
    for record in reader.records() {
        let record = record.map_err(|error| error.to_string())?;
        // BSE may append unnamed empty fields. Keep the lifecycle value aligned
        // with its declared header; never silently discard non-empty overflow.
        if record.len() < headers.len()
            || record
                .iter()
                .skip(headers.len())
                .any(|value| !value.trim().is_empty())
        {
            return Err("BSE lifecycle CSV has missing fields or non-empty unnamed fields.".into());
        }
        let mut values = record
            .iter()
            .take(headers.len())
            .map(|value| csv_escape(value))
            .collect::<Vec<_>>();
        values.push(lifecycle_status.to_string());
        combined_csv.push_str(&values.join(","));
        combined_csv.push('\n');
    }
    Ok(())
}

#[cfg(test)]
fn load_bse_master_rows(path: &Path) -> AppResult<Vec<BseMasterRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_path(path)
        .map_err(|error| error.to_string())?;
    load_bse_master_rows_from_reader(&mut reader, &path.display().to_string())
}

fn load_bse_master_rows_from_bytes(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<Vec<BseMasterRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(bytes);
    load_bse_master_rows_from_reader(&mut reader, source_label)
}

fn load_bse_master_rows_from_reader<R: Read>(
    reader: &mut csv::Reader<R>,
    source_label: &str,
) -> AppResult<Vec<BseMasterRow>> {
    let headers = reader.headers().map_err(|error| error.to_string())?.clone();
    let header_map = build_header_map(&headers);
    validate_bse_source_contract_headers(&header_map, source_label)?;
    let mut rows_by_symbol = HashMap::<String, BseMasterRow>::new();

    for record in reader.records() {
        let record = record.map_err(|error| error.to_string())?;
        let status = pick_field(
            &header_map,
            &record,
            &["lifecyclestatus", "status", "listingstatus", "scripstatus"],
        );
        let lifecycle_status = classify_bse_lifecycle_status(status.as_deref());
        let symbol = normalize_symbol(
            &pick_field(
                &header_map,
                &record,
                &[
                    "securityid",
                    "scripid",
                    "securitysymbol",
                    "symbol",
                    "scripname",
                ],
            )
            .ok_or_else(|| format!("Missing BSE Security Id/Scrip Id in {source_label}"))?,
        )?;
        let row = BseMasterRow {
            symbol: symbol.clone(),
            security_code: pick_field(&header_map, &record, &["securitycode", "scripcode", "code"]),
            name: pick_field(
                &header_map,
                &record,
                &[
                    "securityname",
                    "issuername",
                    "nameofcompany",
                    "companyname",
                    "name",
                ],
            ),
            series: pick_field(
                &header_map,
                &record,
                &["group", "groupname", "groupcode", "series"],
            )
            .map(|value| value.to_ascii_uppercase()),
            isin: pick_field(&header_map, &record, &["isin", "isinno", "isinnumber"]),
            lifecycle_status,
        };
        let should_replace = rows_by_symbol
            .get(&symbol)
            .map(|existing| {
                lifecycle_rank(&row.lifecycle_status) < lifecycle_rank(&existing.lifecycle_status)
            })
            .unwrap_or(true);
        if should_replace {
            rows_by_symbol.insert(symbol, row);
        }
    }

    let mut rows = rows_by_symbol.into_values().collect::<Vec<_>>();
    rows.sort_by(|left, right| left.symbol.cmp(&right.symbol));
    Ok(rows)
}

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn load_existing_bse_instrument_rows(
    connection: &Connection,
) -> AppResult<Vec<ExistingBseInstrumentRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT
                symbol,
                bse_security_code,
                name,
                series,
                isin,
                COALESCE(is_active, 1),
                COALESCE(lifecycle_status, 'CURRENT')
              FROM instruments
              WHERE exchange = ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![BSE_EXCHANGE], |row| {
            Ok(ExistingBseInstrumentRow {
                symbol: row.get(0)?,
                security_code: row.get(1)?,
                name: row.get(2)?,
                series: row.get(3)?,
                isin: row.get(4)?,
                is_active: row.get::<_, i64>(5)? != 0,
                lifecycle_status: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn validate_bse_source_contract_headers(
    header_map: &HashMap<String, usize>,
    source_label: &str,
) -> AppResult<()> {
    let required_groups: [(&str, &[&str]); 5] = [
        (
            "Security Id/Scrip Id",
            &[
                "securityid",
                "scripid",
                "securitysymbol",
                "symbol",
                "scripname",
            ],
        ),
        ("Security Code", &["securitycode", "scripcode", "code"]),
        (
            "Security Name",
            &[
                "securityname",
                "issuername",
                "nameofcompany",
                "companyname",
                "name",
            ],
        ),
        ("Group", &["group", "groupname", "groupcode", "series"]),
        ("ISIN", &["isin", "isinno", "isinnumber"]),
    ];

    for (semantic_field, aliases) in required_groups {
        let present = aliases
            .iter()
            .any(|alias| header_map.contains_key(&normalize_header(alias)));

        if !present {
            return Err(format!(
                "{BSE_SOURCE_CONTRACT_REJECTED}: BSE source '{source_label}' is missing required {semantic_field} header."
            ));
        }
    }

    Ok(())
}

fn build_header_map(headers: &StringRecord) -> HashMap<String, usize> {
    headers
        .iter()
        .enumerate()
        .map(|(index, value)| (normalize_header(value), index))
        .collect()
}

fn pick_field(
    header_map: &HashMap<String, usize>,
    record: &StringRecord,
    aliases: &[&str],
) -> Option<String> {
    aliases.iter().find_map(|alias| {
        let index = header_map.get(&normalize_header(alias))?;
        normalize_optional_text(record.get(*index))
    })
}

fn normalize_header(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

fn classify_bse_lifecycle_status(value: Option<&str>) -> String {
    let Some(value) = value else {
        return "CURRENT".to_string();
    };
    let normalized = value.trim().to_ascii_uppercase();
    if normalized == "DELISTED" || normalized == "DE-LISTED" {
        return "DELISTED".to_string();
    }
    if normalized == "SUSPENDED" {
        return "SUSPENDED".to_string();
    }
    if normalized.is_empty()
        || normalized == "A"
        || normalized == "ACTIVE"
        || normalized == "CURRENT"
        || normalized == "LISTED"
        || normalized == "EQUITY"
    {
        return "CURRENT".to_string();
    }
    "UNKNOWN_INACTIVE".to_string()
}

#[cfg(test)]
fn is_active_status(value: Option<&str>) -> bool {
    classify_bse_lifecycle_status(value) == "CURRENT"
}

fn lifecycle_rank(status: &str) -> u8 {
    match status {
        "CURRENT" => 0,
        "DELISTED" => 1,
        "SUSPENDED" => 2,
        _ => 3,
    }
}

fn sync_action_rank(action: &str) -> u8 {
    match action {
        "INSERT" => 0,
        "REACTIVATE" => 1,
        "UPDATE" => 2,
        "DELISTED" => 3,
        "SUSPENDED" => 4,
        "DEACTIVATE" => 5,
        _ => 4,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn loads_bse_master_rows_from_common_headers() {
        let path = temp_csv_path("bse-master-common");
        fs::write(
            &path,
            "Security Code,Security Id,Security Name,Group,ISIN No,Status\n500325,RELIANCE,Reliance Industries Ltd,A,INE002A01018,Active\n500180,HDFCBANK,HDFC Bank Ltd,A,INE040A01034,Suspended\n",
        )
        .unwrap();

        let rows = load_bse_master_rows(&path).unwrap();

        assert_eq!(rows.len(), 2);
        let reliance = rows
            .iter()
            .find(|row| row.symbol == "RELIANCE")
            .expect("active BSE row should be retained");
        assert_eq!(reliance.security_code.as_deref(), Some("500325"));
        assert_eq!(reliance.series.as_deref(), Some("A"));
        assert_eq!(reliance.isin.as_deref(), Some("INE002A01018"));
        assert_eq!(reliance.lifecycle_status, "CURRENT");
        let suspended = rows
            .iter()
            .find(|row| row.symbol == "HDFCBANK")
            .expect("suspended BSE row should be retained");
        assert_eq!(suspended.lifecycle_status, "SUSPENDED");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn inactive_bse_status_values_are_not_treated_as_active() {
        assert!(is_active_status(None));
        assert!(is_active_status(Some("Active")));
        assert!(is_active_status(Some("CURRENT")));
        assert!(is_active_status(Some("Listed")));
        assert!(!is_active_status(Some("Inactive")));
        assert!(!is_active_status(Some("Suspended")));
        assert!(!is_active_status(Some("Delisted")));
    }

    #[test]
    fn plans_bse_sync_with_insert_reactivate_update_and_deactivate() {
        let current_rows = vec![
            BseMasterRow {
                symbol: "CURR".to_string(),
                security_code: Some("500001".to_string()),
                name: Some("Current Ltd".to_string()),
                series: Some("A".to_string()),
                isin: Some("INECURR1".to_string()),
                lifecycle_status: "CURRENT".to_string(),
            },
            BseMasterRow {
                symbol: "INACT".to_string(),
                security_code: Some("500002".to_string()),
                name: Some("Inactive Ltd".to_string()),
                series: Some("B".to_string()),
                isin: Some("INEINACT1".to_string()),
                lifecycle_status: "CURRENT".to_string(),
            },
            BseMasterRow {
                symbol: "NEWCO".to_string(),
                security_code: Some("500003".to_string()),
                name: Some("Newco Ltd".to_string()),
                series: Some("A".to_string()),
                isin: Some("INENEW1".to_string()),
                lifecycle_status: "CURRENT".to_string(),
            },
        ];
        let existing_rows = vec![
            ExistingBseInstrumentRow {
                symbol: "CURR".to_string(),
                security_code: Some("500001".to_string()),
                name: Some("Old Current Ltd".to_string()),
                series: Some("A".to_string()),
                isin: Some("INECURR1".to_string()),
                is_active: true,
                lifecycle_status: "CURRENT".into(),
            },
            ExistingBseInstrumentRow {
                symbol: "INACT".to_string(),
                security_code: Some("500002".to_string()),
                name: Some("Inactive Ltd".to_string()),
                series: Some("B".to_string()),
                isin: Some("INEINACT1".to_string()),
                is_active: false,
                lifecycle_status: "UNKNOWN_INACTIVE".into(),
            },
            ExistingBseInstrumentRow {
                symbol: "OLDCO".to_string(),
                security_code: Some("500099".to_string()),
                name: Some("Oldco Ltd".to_string()),
                series: Some("X".to_string()),
                isin: Some("INEOLD1".to_string()),
                is_active: true,
                lifecycle_status: "CURRENT".into(),
            },
        ];

        let plan = plan_bse_current_universe_sync_from_rows(
            "bse.csv".to_string(),
            3,
            current_rows,
            existing_rows,
        );

        assert_eq!(plan.activate_count, 2);
        assert_eq!(plan.update_count, 1);
        assert_eq!(plan.deactivate_count, 1);
        assert_eq!(plan.deactivate_symbols, vec!["OLDCO".to_string()]);
    }

    #[test]
    fn plans_bse_lifecycle_sync_with_official_delisted_and_suspended() {
        let master_rows = vec![
            BseMasterRow {
                symbol: "CURR".to_string(),
                security_code: Some("500001".to_string()),
                name: Some("Current Ltd".to_string()),
                series: Some("A".to_string()),
                isin: Some("INECURR1".to_string()),
                lifecycle_status: "CURRENT".to_string(),
            },
            BseMasterRow {
                symbol: "OLDCO".to_string(),
                security_code: Some("500002".to_string()),
                name: Some("Oldco Ltd".to_string()),
                series: Some("B".to_string()),
                isin: Some("INEOLD1".to_string()),
                lifecycle_status: "DELISTED".to_string(),
            },
            BseMasterRow {
                symbol: "HALT".to_string(),
                security_code: Some("500003".to_string()),
                name: Some("Halted Ltd".to_string()),
                series: Some("Z".to_string()),
                isin: Some("INEHALT1".to_string()),
                lifecycle_status: "SUSPENDED".to_string(),
            },
        ];
        let existing_rows = vec![
            ExistingBseInstrumentRow {
                symbol: "CURR".to_string(),
                security_code: Some("500001".to_string()),
                name: Some("Current Ltd".to_string()),
                series: Some("A".to_string()),
                isin: Some("INECURR1".to_string()),
                is_active: true,
                lifecycle_status: "CURRENT".into(),
            },
            ExistingBseInstrumentRow {
                symbol: "OLDCO".to_string(),
                security_code: Some("500002".to_string()),
                name: Some("Oldco Ltd".to_string()),
                series: Some("B".to_string()),
                isin: Some("INEOLD1".to_string()),
                is_active: true,
                lifecycle_status: "CURRENT".into(),
            },
            ExistingBseInstrumentRow {
                symbol: "HALT".to_string(),
                security_code: Some("500003".to_string()),
                name: Some("Halted Ltd".to_string()),
                series: Some("Z".to_string()),
                isin: Some("INEHALT1".to_string()),
                is_active: true,
                lifecycle_status: "CURRENT".into(),
            },
        ];

        let plan = plan_bse_current_universe_sync_from_rows(
            "bse.csv".to_string(),
            3,
            master_rows,
            existing_rows,
        );

        assert_eq!(plan.current_universe_symbols, 1);
        assert_eq!(plan.deactivate_count, 2);
        assert!(plan.preview_rows.iter().any(|row| row.action == "DELISTED"));
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "SUSPENDED"));
        assert!(plan.deactivate_symbols.is_empty());
    }

    #[test]
    fn phase4_bse_identity_sync_persists_security_code_and_active_flags() {
        let path = temp_csv_path("bse-master-apply");
        let mut master = String::from(
            "Scrip Code,Scrip Id,Security Name,Group,ISIN,Status\n500001,CURR,Current Ltd,A,INECURR1,Active\n",
        );
        for index in 1..BSE_CURRENT_POPULATION_SANITY_MINIMUM {
            master.push_str(&format!(
                "{:06},F4PAD{index:04},F4 Population Pad {index:04},A,INEF4PAD{index:04},Active\n",
                600000 + index
            ));
        }
        fs::write(&path, master).unwrap();
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE instruments (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  bse_security_code TEXT,
                  isin TEXT,
                  name TEXT,
                  series TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                  updated_at TEXT,
                  PRIMARY KEY(symbol, exchange)
                );
                INSERT INTO instruments (symbol, exchange, isin, name, series, is_active)
                VALUES ('OLDCO', 'BSE', 'INEOLD1', 'Old Company', 'X', 1);
                ",
            )
            .unwrap();

        let result = apply_bse_current_universe_sync_internal(
            &connection,
            &BseCurrentUniverseSyncInput {
                master_file_path: path.display().to_string(),
            },
        )
        .unwrap();
        let old_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'OLDCO' AND exchange = 'BSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let curr_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'CURR' AND exchange = 'BSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let curr_security_code: Option<String> = connection
            .query_row(
                "SELECT bse_security_code FROM instruments WHERE symbol = 'CURR' AND exchange = 'BSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(result.applied);
        assert_eq!(result.deactivate_count, 1);
        assert_eq!(old_is_active, 0);
        assert_eq!(curr_is_active, 1);
        assert_eq!(curr_security_code.as_deref(), Some("500001"));

        let _ = fs::remove_file(path);
    }

    fn temp_csv_path(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{prefix}-{unique}.csv"))
    }
}
#[cfg(test)]
mod f4_population_sanity_tests {
    use super::*;

    #[test]
    fn f4_population_sanity_bse_rejects_999_active_symbols() {
        let error = validate_bse_current_population_sanity(999, 0, 0)
            .expect_err("BSE active population below 1000 must fail closed");
        assert!(
            error.contains("SOURCE_POPULATION_SANITY_REJECTED"),
            "BSE rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f4_population_sanity_bse_accepts_1000_active_symbols() {
        assert!(
            validate_bse_current_population_sanity(1000, 0, 0).is_ok(),
            "BSE active population of 1000 must satisfy the F4-R1 floor"
        );
    }

    #[test]
    fn f4_population_sanity_bse_inactive_rows_do_not_compensate_for_999_active() {
        let error = validate_bse_current_population_sanity(999, 5000, 5000)
            .expect_err("large delisted/suspended populations must not satisfy the active floor");
        assert!(
            error.contains("SOURCE_POPULATION_SANITY_REJECTED"),
            "BSE rejection must remain population-specific: {error}"
        );
    }
}

#[cfg(test)]
mod f3_bse_source_contract_tests {
    use super::*;

    fn parse(source: &str) -> AppResult<Vec<BseMasterRow>> {
        load_bse_master_rows_from_bytes(source.as_bytes(), "F3 BSE source-contract test")
    }

    #[test]
    fn f3_bse_source_contract_rejects_missing_symbol_header() {
        let error =
            parse("Security Code,Security Name,Group,ISIN No\n500001,Example Ltd,A,INE000000001\n")
                .expect_err("BSE source missing Security Id/Scrip Id must fail closed");

        assert!(
            error.contains("BSE_SOURCE_CONTRACT_REJECTED"),
            "BSE source-contract rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f3_bse_source_contract_rejects_missing_security_code_header() {
        let error =
            parse("Security Id,Security Name,Group,ISIN No\nEXAMPLE,Example Ltd,A,INE000000001\n")
                .expect_err("BSE source missing Security Code must fail closed");

        assert!(
            error.contains("BSE_SOURCE_CONTRACT_REJECTED"),
            "BSE source-contract rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f3_bse_source_contract_rejects_missing_security_name_header() {
        let error =
            parse("Security Code,Security Id,Group,ISIN No\n500001,EXAMPLE,A,INE000000001\n")
                .expect_err("BSE source missing Security Name must fail closed");

        assert!(
            error.contains("BSE_SOURCE_CONTRACT_REJECTED"),
            "BSE source-contract rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f3_bse_source_contract_rejects_missing_group_header() {
        let error = parse(
            "Security Code,Security Id,Security Name,ISIN No\n500001,EXAMPLE,Example Ltd,INE000000001\n",
        )
        .expect_err("BSE source missing Group must fail closed");

        assert!(
            error.contains("BSE_SOURCE_CONTRACT_REJECTED"),
            "BSE source-contract rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f3_bse_source_contract_rejects_missing_isin_header() {
        let error =
            parse("Security Code,Security Id,Security Name,Group\n500001,EXAMPLE,Example Ltd,A\n")
                .expect_err("BSE source missing ISIN must fail closed");

        assert!(
            error.contains("BSE_SOURCE_CONTRACT_REJECTED"),
            "BSE source-contract rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f3_bse_source_contract_accepts_native_required_headers_without_status() {
        let rows = parse(
            "Security Code,Security Id,Security Name,Group,ISIN No\n500001,EXAMPLE,Example Ltd,A,INE000000001\n",
        )
        .expect("Status remains optional in the intended BSE contract");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].symbol, "EXAMPLE");
        assert_eq!(rows[0].lifecycle_status, "CURRENT");
    }

    #[test]
    fn f3_bse_source_contract_accepts_frozen_aliases_and_extra_columns() {
        let rows = parse(
            "Scrip Code,Scrip Id,Issuer Name,Group Code,ISIN Number,Extra Presentation\n500001,EXAMPLE,Example Ltd,A,INE000000001,ignored\n",
        )
        .expect("frozen BSE header aliases and extra columns must remain compatible");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].symbol, "EXAMPLE");
        assert_eq!(rows[0].security_code.as_deref(), Some("500001"));
        assert_eq!(rows[0].name.as_deref(), Some("Example Ltd"));
        assert_eq!(rows[0].series.as_deref(), Some("A"));
        assert_eq!(rows[0].isin.as_deref(), Some("INE000000001"));
    }
}

use crate::database::binary_eod::{
    date_to_u32, u32_to_date, BinaryAppendMergeStats, BinaryEodFile, BinaryWriteDiagnostics,
    BinaryWritePath, EodRecord, DEFAULT_SCALE,
};
use crate::database::{
    emit_database_changed, get_active_database_file_path, get_app_snapshot_internal,
    get_price_storage_mode, invalidate_cached_db_stats, prepare_database_connection,
    PriceStorageMode, SnapshotOptions,
};
use crate::manual_import_recovery::{
    latest_session_summary, list_session_summaries, prepare_binary_import_session,
    summary_from_handle, undo_session, update_session_state, ManualImportRecoveryState,
    ManualImportRecoverySummary, ManualImportUndoInput, ManualImportUndoResult,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

type AppResult<T> = Result<T, String>;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub detected_delimiter: String,
    pub total_estimated_rows: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSampleSymbol {
    pub symbol: String,
    pub exchange: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDateRange {
    pub from: String,
    pub to: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub rows_read: usize,
    pub rows_inserted: usize,
    pub rows_skipped: usize,
    pub rows_error: usize,
    pub symbol_count: usize,
    pub date_range: Option<ImportDateRange>,
    pub sample_symbols: Vec<ImportSampleSymbol>,
    pub errors: Vec<String>,
    pub duration_ms: u128,
    pub binary_diagnostics: Option<ImportBinaryDiagnostics>,
    pub recovery_session: Option<ManualImportRecoverySummary>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBinaryDiagnostics {
    pub workers: usize,
    pub parse_prepare_ms: u128,
    pub binary_filter_ms: u128,
    pub binary_write_ms: u128,
    pub inserted_dates: usize,
    pub changed_dates: usize,
    pub unchanged_dates: usize,
    pub binary_errors: usize,
    pub new_files: usize,
    pub append_newest: usize,
    pub rewrite_tail: usize,
    pub update_existing: usize,
    pub insert_historical: usize,
    pub no_op: usize,
    pub exists_us: u128,
    pub open_us: u128,
    pub header_read_us: u128,
    pub last_date_read_us: u128,
    pub sort_us: u128,
    pub lookup_us: u128,
    pub tail_read_us: u128,
    pub new_file_write_us: u128,
    pub seek_us: u128,
    pub data_write_us: u128,
    pub byte_shift_us: u128,
    pub set_len_us: u128,
    pub header_write_us: u128,
    pub flush_us: u128,
    pub flush_calls: usize,
    pub sync_data_us: u128,
    pub sync_data_calls: usize,
    pub parallel_summed_symbol_us: u128,
    pub p50_symbol_us: u128,
    pub p95_symbol_us: u128,
    pub max_symbol_us: u128,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    progress: u32,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManualImportUndoProgressPayload {
    progress: u32,
    message: String,
}

const PARSE_PROGRESS_MAX: u32 = 70;
const BINARY_FILTER_PROGRESS_MAX: u32 = 84;
const BINARY_PROGRESS_MAX: u32 = 99;
const ROW_PROGRESS_INTERVAL: usize = 500;
const MAX_BINARY_IMPORT_WORKERS: usize = 4;
static MANUAL_IMPORT_MUTATION_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptionsInput {
    pub file_paths: Vec<String>,
    pub exchange: Option<String>,
    pub has_header: Option<bool>,
    pub date_format: Option<String>,
    pub delimiter: Option<String>,
    pub on_duplicate: Option<String>,
    pub trim_whitespace: Option<bool>,
    pub allow_exchange_mismatch: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextExportInput {
    pub title: Option<String>,
    pub suggested_file_name: String,
    pub content: String,
    pub default_extension: Option<String>,
    pub filter_name: Option<String>,
    pub filter_extensions: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextExportResult {
    pub success: bool,
    pub file_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartImageInput {
    pub title: Option<String>,
    pub suggested_file_name: String,
    pub png_base64: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartImageResult {
    pub success: bool,
    pub file_path: Option<String>,
}

#[derive(Clone, Debug)]
struct ParsedRow {
    symbol: String,
    exchange: String,
    date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: i64,
    open_interest: i64,
}

#[derive(Clone, Copy, Debug)]
struct HeaderMap {
    symbol: usize,
    date: usize,
    open: usize,
    high: usize,
    low: usize,
    close: usize,
    volume: usize,
    open_interest: Option<usize>,
}

#[derive(Clone, Debug)]
struct SingleFileResult {
    rows_read: usize,
    rows_inserted: usize,
    rows_skipped: usize,
    rows_error: usize,
    symbols: HashSet<String>,
    min_date: Option<String>,
    max_date: Option<String>,
    errors: Vec<String>,
    binary_records: HashMap<String, Vec<EodRecord>>,
}

struct BinaryFilterResult {
    symbol: String,
    records: Vec<EodRecord>,
    skipped_rows: usize,
    error: Option<String>,
}

struct BinaryWriteResult {
    symbol: String,
    error: Option<String>,
    stats: BinaryAppendMergeStats,
    diagnostics: BinaryWriteDiagnostics,
}

#[derive(Default)]
struct ImportBinaryWriteStats {
    inserted_dates: usize,
    changed_dates: usize,
    unchanged_dates: usize,
    errors: usize,
    new_files: usize,
    append_newest: usize,
    rewrite_tail: usize,
    update_existing: usize,
    insert_historical: usize,
    no_op: usize,
    exists_us: u128,
    open_us: u128,
    header_read_us: u128,
    last_date_read_us: u128,
    sort_us: u128,
    lookup_us: u128,
    tail_read_us: u128,
    new_file_write_us: u128,
    seek_us: u128,
    data_write_us: u128,
    byte_shift_us: u128,
    set_len_us: u128,
    header_write_us: u128,
    flush_us: u128,
    flush_calls: usize,
    sync_data_us: u128,
    sync_data_calls: usize,
    measured_total_us: u128,
    symbol_total_us: Vec<u128>,
}

impl ImportBinaryWriteStats {
    fn record(&mut self, result: &BinaryWriteResult) {
        let diagnostics = &result.diagnostics;
        self.measured_total_us += diagnostics.total_us;
        self.symbol_total_us.push(diagnostics.total_us);
        self.exists_us += diagnostics.exists_us;
        self.open_us += diagnostics.open_us;
        self.header_read_us += diagnostics.header_read_us;
        self.last_date_read_us += diagnostics.last_date_read_us;
        self.sort_us += diagnostics.sort_us;
        self.lookup_us += diagnostics.lookup_us;
        self.tail_read_us += diagnostics.tail_read_us;
        self.new_file_write_us += diagnostics.new_file_write_us;
        self.seek_us += diagnostics.seek_us;
        self.data_write_us += diagnostics.data_write_us;
        self.byte_shift_us += diagnostics.byte_shift_us;
        self.set_len_us += diagnostics.set_len_us;
        self.header_write_us += diagnostics.header_write_us;
        self.flush_us += diagnostics.flush_us;
        self.flush_calls += diagnostics.flush_calls;
        self.sync_data_us += diagnostics.sync_data_us;
        self.sync_data_calls += diagnostics.sync_data_calls;

        if result.error.is_some() {
            self.errors += 1;
            return;
        }

        match diagnostics.path {
            BinaryWritePath::NoOp => self.no_op += 1,
            BinaryWritePath::NewFile => self.new_files += 1,
            BinaryWritePath::AppendNewest => self.append_newest += 1,
            BinaryWritePath::RewriteTail => self.rewrite_tail += 1,
            BinaryWritePath::UpdateExisting => self.update_existing += 1,
            BinaryWritePath::InsertHistorical => self.insert_historical += 1,
        }

        self.inserted_dates += result.stats.inserted_dates.len();
        self.changed_dates += result.stats.changed_existing_dates.len();
        self.unchanged_dates += result.stats.unchanged_existing_dates.len();
    }

    fn finish(
        &self,
        workers: usize,
        parse_prepare_ms: u128,
        binary_filter_ms: u128,
        binary_write_ms: u128,
    ) -> ImportBinaryDiagnostics {
        let mut totals = self.symbol_total_us.clone();
        totals.sort_unstable();
        ImportBinaryDiagnostics {
            workers,
            parse_prepare_ms,
            binary_filter_ms,
            binary_write_ms,
            inserted_dates: self.inserted_dates,
            changed_dates: self.changed_dates,
            unchanged_dates: self.unchanged_dates,
            binary_errors: self.errors,
            new_files: self.new_files,
            append_newest: self.append_newest,
            rewrite_tail: self.rewrite_tail,
            update_existing: self.update_existing,
            insert_historical: self.insert_historical,
            no_op: self.no_op,
            exists_us: self.exists_us,
            open_us: self.open_us,
            header_read_us: self.header_read_us,
            last_date_read_us: self.last_date_read_us,
            sort_us: self.sort_us,
            lookup_us: self.lookup_us,
            tail_read_us: self.tail_read_us,
            new_file_write_us: self.new_file_write_us,
            seek_us: self.seek_us,
            data_write_us: self.data_write_us,
            byte_shift_us: self.byte_shift_us,
            set_len_us: self.set_len_us,
            header_write_us: self.header_write_us,
            flush_us: self.flush_us,
            flush_calls: self.flush_calls,
            sync_data_us: self.sync_data_us,
            sync_data_calls: self.sync_data_calls,
            parallel_summed_symbol_us: self.measured_total_us,
            p50_symbol_us: import_percentile_us(&totals, 50),
            p95_symbol_us: import_percentile_us(&totals, 95),
            max_symbol_us: totals.last().copied().unwrap_or(0),
        }
    }
}

fn import_percentile_us(sorted_values: &[u128], percentile: usize) -> u128 {
    if sorted_values.is_empty() {
        return 0;
    }
    let index = ((sorted_values.len() - 1) * percentile) / 100;
    sorted_values[index]
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DuplicateMode {
    Skip,
    Overwrite,
    Error,
}

impl DuplicateMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Skip => "skip",
            Self::Overwrite => "overwrite",
            Self::Error => "error",
        }
    }
}

#[derive(Clone, Copy, Debug)]
enum DateFormat {
    Auto,
    YyyyMmDdCompact,
    YyyyDashMmDashDd,
    YyyySlashMmSlashDd,
    DdDashMmDashYyyy,
    DdSlashMmSlashYyyy,
    DdMmmYyyy,
}

#[tauri::command]
pub fn pick_csv_files() -> Vec<String> {
    rfd::FileDialog::new()
        .set_title("Select CSV / TXT Files")
        .add_filter("Data Files", &["csv", "txt", "tsv"])
        .pick_files()
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
pub fn save_text_export(input: SaveTextExportInput) -> AppResult<SaveTextExportResult> {
    let default_extension = input
        .default_extension
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("tsv")
        .to_ascii_lowercase();
    let filter_name = input
        .filter_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Text Export");
    let filter_extensions = input
        .filter_extensions
        .clone()
        .unwrap_or_else(|| vec![default_extension.clone()])
        .into_iter()
        .map(|value| value.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let filter_extension_refs = filter_extensions
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>();

    let mut dialog = rfd::FileDialog::new().set_file_name(&input.suggested_file_name);
    if let Some(title) = input.title.as_deref() {
        let trimmed = title.trim();
        if !trimmed.is_empty() {
            dialog = dialog.set_title(trimmed);
        }
    }
    dialog = dialog.add_filter(filter_name, &filter_extension_refs);

    let Some(mut file_path) = dialog.save_file() else {
        return Ok(SaveTextExportResult {
            success: false,
            file_path: None,
        });
    };

    if file_path.extension().is_none() {
        file_path.set_extension(&default_extension);
    }

    fs::write(&file_path, input.content.as_bytes()).map_err(|error| error.to_string())?;

    Ok(SaveTextExportResult {
        success: true,
        file_path: Some(file_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn save_chart_image(input: SaveChartImageInput) -> AppResult<SaveChartImageResult> {
    let image_bytes = BASE64
        .decode(input.png_base64.trim())
        .map_err(|error| format!("Could not decode the chart screenshot: {error}"))?;
    if image_bytes.is_empty() {
        return Err("The chart screenshot is empty.".to_string());
    }

    let mut dialog = rfd::FileDialog::new()
        .set_file_name(&input.suggested_file_name)
        .add_filter("PNG Image", &["png"]);
    if let Some(title) = input.title.as_deref() {
        let trimmed = title.trim();
        if !trimmed.is_empty() {
            dialog = dialog.set_title(trimmed);
        }
    }

    let Some(mut file_path) = dialog.save_file() else {
        return Ok(SaveChartImageResult {
            success: false,
            file_path: None,
        });
    };
    if file_path.extension().is_none() {
        file_path.set_extension("png");
    }

    fs::write(&file_path, image_bytes).map_err(|error| error.to_string())?;
    Ok(SaveChartImageResult {
        success: true,
        file_path: Some(file_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn preview_csv(file_path: String) -> AppResult<CsvPreview> {
    let normalized_path = PathBuf::from(file_path);
    let first_lines = read_first_non_empty_lines(&normalized_path, 100)?;
    let first_line = first_lines.first().cloned().unwrap_or_default();
    let delimiter = detect_delimiter(&first_line);
    let split_rows = first_lines
        .iter()
        .map(|line| split_delimited_line(line, delimiter))
        .collect::<Vec<_>>();
    let has_header = split_rows
        .first()
        .map(|row| detect_header(row))
        .unwrap_or(false);
    let headers = if has_header {
        split_rows.first().cloned().unwrap_or_default()
    } else {
        split_rows
            .first()
            .map(|row| {
                row.iter()
                    .enumerate()
                    .map(|(index, _)| format!("Column {}", index + 1))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    };
    let rows = if has_header {
        split_rows.into_iter().skip(1).take(5).collect::<Vec<_>>()
    } else {
        split_rows.into_iter().take(5).collect::<Vec<_>>()
    };

    let average_line_length = if first_lines.is_empty() {
        1_f64
    } else {
        first_lines
            .iter()
            .map(|line| (line.as_bytes().len() + 1) as f64)
            .sum::<f64>()
            / first_lines.len() as f64
    };
    let file_size = fs::metadata(&normalized_path)
        .map_err(|error| error.to_string())?
        .len() as f64;

    Ok(CsvPreview {
        headers,
        rows,
        detected_delimiter: delimiter.to_string(),
        total_estimated_rows: (file_size / average_line_length).round().max(0.0) as usize,
    })
}

#[tauri::command]
pub async fn import_csv(app: AppHandle, input: ImportOptionsInput) -> AppResult<ImportResult> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before importing CSV data.".to_string())?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _manual_import_guard = MANUAL_IMPORT_MUTATION_LOCK
            .lock()
            .map_err(|_| "Manual Import mutation lock was poisoned.".to_string())?;
        let result = import_csv_internal(&database_file_path, &input, |progress, message| {
            let _ = app_handle.emit("import:progress", ProgressPayload { progress, message });
        })?;

        let changed_state = result.rows_inserted > 0
            || result
                .recovery_session
                .as_ref()
                .map(|session| session.created_instruments > 0)
                .unwrap_or(false);
        if changed_state {
            if let Some(folder_path) = database_file_path.parent() {
                invalidate_cached_db_stats(&app_handle, folder_path)?;
            }
            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;
        }

        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn list_manual_import_recovery_history(
    app: AppHandle,
) -> AppResult<Vec<ManualImportRecoverySummary>> {
    let database_file_path = get_active_database_file_path(&app)?.ok_or_else(|| {
        "Open a database before reviewing Manual Import recovery history.".to_string()
    })?;
    let folder_path = database_file_path
        .parent()
        .ok_or_else(|| "Database folder is unavailable for Manual Import recovery.".to_string())?;
    list_session_summaries(folder_path)
}

#[tauri::command]
pub fn get_latest_manual_import_recovery(
    app: AppHandle,
) -> AppResult<Option<ManualImportRecoverySummary>> {
    let database_file_path = get_active_database_file_path(&app)?.ok_or_else(|| {
        "Open a database before reviewing Manual Import recovery history.".to_string()
    })?;
    let folder_path = database_file_path
        .parent()
        .ok_or_else(|| "Database folder is unavailable for Manual Import recovery.".to_string())?;
    latest_session_summary(folder_path)
}

#[tauri::command]
pub async fn undo_manual_import_recovery(
    app: AppHandle,
    input: ManualImportUndoInput,
) -> AppResult<ManualImportUndoResult> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before undoing a Manual Import.".to_string())?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _manual_import_guard = MANUAL_IMPORT_MUTATION_LOCK
            .lock()
            .map_err(|_| "Manual Import mutation lock was poisoned.".to_string())?;
        let connection = Connection::open(&database_file_path).map_err(|error| error.to_string())?;
        prepare_database_connection(&connection)?;
        let result = undo_session(
            &database_file_path,
            &connection,
            &input.session_id,
            |completed, total, symbol| {
                let progress = if total == 0 {
                    100
                } else {
                    ((completed as f64 / total as f64) * 100.0).round().clamp(0.0, 100.0) as u32
                };
                let _ = app_handle.emit(
                    "manual-import-undo:progress",
                    ManualImportUndoProgressPayload {
                        progress,
                        message: if total == 0 {
                            "Undoing Manual Import".to_string()
                        } else {
                            format!("Undoing Manual Import {}/{} symbols ({})", completed, total, symbol)
                        },
                    },
                );
            },
        )?;

        if let Some(folder_path) = database_file_path.parent() {
            invalidate_cached_db_stats(&app_handle, folder_path)?;
        }
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn import_csv_internal<F>(
    database_file_path: &Path,
    options: &ImportOptionsInput,
    on_progress: F,
) -> AppResult<ImportResult>
where
    F: Fn(u32, String),
{
    let started_at = std::time::Instant::now();
    let normalized_file_paths = options
        .file_paths
        .iter()
        .map(PathBuf::from)
        .collect::<Vec<_>>();
    let mut normalized_file_paths = normalized_file_paths;
    normalized_file_paths.sort();
    if normalized_file_paths.is_empty() {
        return Err("Select one or more CSV / TXT files to import.".to_string());
    }
    if !database_file_path.exists() {
        return Err(format!(
            "Database file does not exist: {}",
            database_file_path.to_string_lossy()
        ));
    }
    let import_exchange = options
        .exchange
        .as_deref()
        .map(|value| value.trim().to_uppercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "NSE".to_string());
    if let Some(source_exchange) = detect_source_exchange_hint(&normalized_file_paths) {
        if import_exchange != "OTHER"
            && source_exchange != import_exchange
            && !options.allow_exchange_mismatch.unwrap_or(false)
        {
            return Err(format!(
                "Manual Import exchange mismatch: selected files appear to come from {}, but target Exchange is {}. Confirm the mismatch in the import dialog before continuing.",
                source_exchange, import_exchange
            ));
        }
    }

    let total_bytes = normalized_file_paths
        .iter()
        .filter_map(|path| fs::metadata(path).ok().map(|meta| meta.len()))
        .sum::<u64>()
        .max(1);
    let mut completed_bytes = 0_u64;

    let mut connection = Connection::open(database_file_path).map_err(|error| error.to_string())?;
    prepare_database_connection(&connection)?;
    let storage_mode = get_price_storage_mode(&connection);
    let binary_only = storage_mode == PriceStorageMode::Binary;
    let duplicate_mode = parse_duplicate_mode(options.on_duplicate.as_deref());

    let mut aggregate_rows_read = 0_usize;
    let mut aggregate_rows_inserted = 0_usize;
    let mut aggregate_rows_skipped = 0_usize;
    let mut aggregate_rows_error = 0_usize;
    let mut aggregate_symbols = HashSet::<String>::new();
    let mut sample_symbols = Vec::<ImportSampleSymbol>::new();
    let mut aggregate_errors = Vec::<String>::new();
    let mut min_date: Option<String> = None;
    let mut max_date: Option<String> = None;
    let mut aggregate_binary_records = HashMap::<String, Vec<EodRecord>>::new();
    let parse_prepare_started = std::time::Instant::now();

    for (index, file_path) in normalized_file_paths.iter().enumerate() {
        let file_size = fs::metadata(file_path)
            .map_err(|error| error.to_string())?
            .len()
            .max(1);
        let file_name = file_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("file")
            .to_string();
        let result = import_single_file(
            &mut connection,
            options,
            file_path,
            |bytes_read, message| {
                let progress =
                    map_parse_progress(completed_bytes + bytes_read.min(file_size), total_bytes);
                let progress_message = if normalized_file_paths.len() > 1 {
                    format!(
                        "File {} of {} ({file_name}): {message}",
                        index + 1,
                        normalized_file_paths.len()
                    )
                } else {
                    message
                };
                on_progress(progress, progress_message);
            },
        )?;

        completed_bytes += file_size;
        aggregate_rows_read += result.rows_read;
        aggregate_rows_inserted += result.rows_inserted;
        aggregate_rows_skipped += result.rows_skipped;
        aggregate_rows_error += result.rows_error;
        for (symbol, mut records) in result.binary_records {
            aggregate_binary_records
                .entry(symbol)
                .or_default()
                .append(&mut records);
        }
        for symbol_key in result.symbols {
            let was_known = aggregate_symbols.contains(&symbol_key);
            aggregate_symbols.insert(symbol_key.clone());
            if !was_known && sample_symbols.len() < 8 {
                if let Some((exchange, symbol)) = symbol_key.split_once(':') {
                    sample_symbols.push(ImportSampleSymbol {
                        symbol: symbol.to_string(),
                        exchange: exchange.to_string(),
                    });
                }
            }
        }
        for error in result.errors {
            if aggregate_errors.len() < 20 {
                aggregate_errors.push(error);
            }
        }
        if let Some(file_min_date) = result.min_date {
            if min_date
                .as_ref()
                .map(|value| file_min_date < *value)
                .unwrap_or(true)
            {
                min_date = Some(file_min_date);
            }
        }
        if let Some(file_max_date) = result.max_date {
            if max_date
                .as_ref()
                .map(|value| file_max_date > *value)
                .unwrap_or(true)
            {
                max_date = Some(file_max_date);
            }
        }

        on_progress(
            map_parse_progress(completed_bytes, total_bytes),
            if normalized_file_paths.len() > 1 {
                format!(
                    "Prepared {} of {} files",
                    index + 1,
                    normalized_file_paths.len()
                )
            } else {
                "Preparing binary write".to_string()
            },
        );
    }

    let parse_prepare_ms = parse_prepare_started.elapsed().as_millis();
    let mut binary_filter_ms = 0_u128;

    if binary_only {
        let folder_path = database_file_path
            .parent()
            .ok_or_else(|| "Database folder is unavailable for binary import.".to_string())?;
        let binary_filter_started = std::time::Instant::now();
        let (prepared_records, skipped_rows) = filter_binary_records_for_mode(
            folder_path,
            &import_exchange,
            duplicate_mode,
            aggregate_binary_records,
            |completed, total, symbol| {
                on_progress(
                    map_stage_progress(
                        completed,
                        total,
                        PARSE_PROGRESS_MAX,
                        BINARY_FILTER_PROGRESS_MAX,
                    ),
                    format!(
                        "Checking existing binary EOD {}/{} symbols ({})",
                        completed, total, symbol
                    ),
                );
            },
        )?;
        binary_filter_ms = binary_filter_started.elapsed().as_millis();
        aggregate_binary_records = prepared_records;
        aggregate_rows_skipped += skipped_rows;

        let (rows_inserted, _, _, filtered_min_date, filtered_max_date) =
            summarize_binary_records(&import_exchange, &aggregate_binary_records);
        aggregate_rows_inserted = rows_inserted;
        if rows_inserted > 0 {
            min_date = filtered_min_date;
            max_date = filtered_max_date;
        }
    }

    let binary_instrument_symbols = if binary_only {
        aggregate_symbols
            .iter()
            .filter_map(|key| {
                key.split_once(':').and_then(|(exchange, symbol)| {
                    if exchange.eq_ignore_ascii_case(&import_exchange) {
                        Some(symbol.to_string())
                    } else {
                        None
                    }
                })
            })
            .collect::<HashSet<_>>()
    } else {
        HashSet::new()
    };

    let mut recovery_handle = if binary_only {
        prepare_binary_import_session(
            database_file_path,
            &connection,
            &import_exchange,
            duplicate_mode.as_str(),
            &normalized_file_paths,
            aggregate_rows_read,
            aggregate_rows_skipped,
            &binary_instrument_symbols,
            &aggregate_binary_records,
        )?
    } else {
        None
    };

    if binary_only && !binary_instrument_symbols.is_empty() {
        if let Some(handle) = recovery_handle.as_mut() {
            update_session_state(
                handle,
                ManualImportRecoveryState::Applying,
                None,
                None,
                None,
            )?;
        }
        if let Err(error) = insert_binary_import_instruments(
            &mut connection,
            &import_exchange,
            binary_instrument_symbols.iter(),
        ) {
            if let Some(handle) = recovery_handle.as_mut() {
                let _ = update_session_state(
                    handle,
                    ManualImportRecoveryState::Failed,
                    Some(0),
                    Some(1),
                    Some(error.clone()),
                );
            }
            return Err(error);
        }
    }

    let mut binary_diagnostics = None;
    if let Some(folder_path) = database_file_path.parent() {
        let binary_total = aggregate_binary_records.len();
        if binary_total > 0 {
            let binary_workers = binary_worker_count(binary_total);
            let binary_write_started = std::time::Instant::now();
            let mut binary_stats = ImportBinaryWriteStats::default();
            on_progress(
                if duplicate_mode == DuplicateMode::Overwrite {
                    PARSE_PROGRESS_MAX
                } else {
                    BINARY_FILTER_PROGRESS_MAX
                },
                format!("Writing binary EOD 0/{} symbols", binary_total),
            );

            let write_results = match write_binary_records_parallel(
                folder_path,
                &import_exchange,
                aggregate_binary_records,
                |completed, total, symbol| {
                    on_progress(
                        map_stage_progress(
                            completed,
                            total,
                            if duplicate_mode == DuplicateMode::Overwrite {
                                PARSE_PROGRESS_MAX
                            } else {
                                BINARY_FILTER_PROGRESS_MAX
                            },
                            BINARY_PROGRESS_MAX,
                        ),
                        format!(
                            "Writing binary EOD {}/{} symbols ({})",
                            completed, total, symbol
                        ),
                    );
                },
            ) {
                Ok(results) => results,
                Err(error) => {
                    if let Some(handle) = recovery_handle.as_mut() {
                        let _ = update_session_state(
                            handle,
                            ManualImportRecoveryState::Failed,
                            Some(0),
                            Some(1),
                            Some(error.clone()),
                        );
                    }
                    return Err(error);
                }
            };

            for result in write_results {
                binary_stats.record(&result);
                if let Some(err_msg) = result.error {
                    aggregate_rows_error += 1;
                    eprintln!("{}", err_msg);
                    if aggregate_errors.len() < 50 {
                        aggregate_errors.push(err_msg);
                    }
                }
            }
            let binary_write_ms = binary_write_started.elapsed().as_millis();
            binary_diagnostics = Some(binary_stats.finish(
                binary_workers,
                parse_prepare_ms,
                binary_filter_ms,
                binary_write_ms,
            ));
        }
    }

    if let Some(handle) = recovery_handle.as_mut() {
        let final_state = if aggregate_rows_error == 0 {
            ManualImportRecoveryState::Applied
        } else {
            ManualImportRecoveryState::Failed
        };
        update_session_state(
            handle,
            final_state,
            Some(aggregate_rows_inserted),
            Some(aggregate_rows_error),
            if aggregate_rows_error == 0 {
                None
            } else {
                Some(format!("Manual Import completed with {} binary error(s).", aggregate_rows_error))
            },
        )?;
    }
    let recovery_session = recovery_handle.as_ref().map(summary_from_handle);

    on_progress(100, "Import complete".to_string());

    Ok(ImportResult {
        success: aggregate_rows_error == 0,
        rows_read: aggregate_rows_read,
        rows_inserted: aggregate_rows_inserted,
        rows_skipped: aggregate_rows_skipped,
        rows_error: aggregate_rows_error,
        symbol_count: aggregate_symbols.len(),
        date_range: match (min_date, max_date) {
            (Some(from), Some(to)) => Some(ImportDateRange { from, to }),
            _ => None,
        },
        sample_symbols,
        errors: aggregate_errors,
        duration_ms: started_at.elapsed().as_millis(),
        binary_diagnostics,
        recovery_session,
    })
}

fn import_single_file<F>(
    connection: &mut Connection,
    options: &ImportOptionsInput,
    file_path: &Path,
    on_progress: F,
) -> AppResult<SingleFileResult>
where
    F: Fn(u64, String),
{
    let first_line = read_first_non_empty_lines(file_path, 1)?
        .first()
        .cloned()
        .unwrap_or_default();
    let delimiter = options
        .delimiter
        .as_deref()
        .and_then(|value| value.chars().next())
        .filter(|value| [',', '\t', ';'].contains(value))
        .unwrap_or_else(|| detect_delimiter(&first_line));
    let exchange = options
        .exchange
        .as_deref()
        .map(|value| value.trim().to_uppercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "NSE".to_string());
    let duplicate_mode = parse_duplicate_mode(options.on_duplicate.as_deref());
    let trim_whitespace = options.trim_whitespace.unwrap_or(true);
    let file_handle = File::open(file_path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file_handle);
    let total_bytes = fs::metadata(file_path)
        .map_err(|error| error.to_string())?
        .len()
        .max(1);

    let storage_mode = get_price_storage_mode(&connection);
    let binary_only = storage_mode == PriceStorageMode::Binary;

    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let mut insert_instrument = transaction
        .prepare(
            "
              INSERT OR IGNORE INTO instruments (symbol, exchange, name, series)
              VALUES (?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut insert_ignore = transaction
        .prepare(
            "
              INSERT OR IGNORE INTO eod_prices (symbol, exchange, date, open, high, low, close, volume, open_interest)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut insert_replace = transaction
        .prepare(
            "
              INSERT OR REPLACE INTO eod_prices (symbol, exchange, date, open, high, low, close, volume, open_interest)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut insert_strict = transaction
        .prepare(
            "
              INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume, open_interest)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;

    let mut field_map = default_header_map();
    let mut header_handled = false;
    let mut rows_read = 0_usize;
    let mut rows_inserted = 0_usize;
    let mut rows_skipped = 0_usize;
    let mut rows_error = 0_usize;
    let mut min_date = None;
    let mut max_date = None;
    let mut symbols = HashSet::<String>::new();
    let mut errors = Vec::<String>::new();
    let mut bytes_read = 0_u64;

    let mut binary_records = HashMap::<String, Vec<EodRecord>>::new();

    for line_result in reader.lines() {
        let raw_line = line_result.map_err(|error| error.to_string())?;
        bytes_read += raw_line.as_bytes().len() as u64 + 1;
        if raw_line.trim().is_empty() {
            continue;
        }

        let mut fields = split_delimited_line(&raw_line, delimiter);
        if trim_whitespace {
            fields = fields
                .into_iter()
                .map(|value| value.trim().to_string())
                .collect();
        }

        if !header_handled {
            header_handled = true;
            let has_header = options.has_header.unwrap_or_else(|| detect_header(&fields));
            if has_header {
                field_map = build_header_map(&fields);
                continue;
            }
        }

        rows_read += 1;
        match parse_row(
            &fields,
            field_map,
            &exchange,
            parse_date_format(options.date_format.as_deref()),
        ) {
            Ok(parsed) => {
                let symbol_key = format!("{}:{}", parsed.exchange, parsed.symbol);
                symbols.insert(symbol_key);
                if min_date
                    .as_ref()
                    .map(|value| parsed.date < *value)
                    .unwrap_or(true)
                {
                    min_date = Some(parsed.date.clone());
                }
                if max_date
                    .as_ref()
                    .map(|value| parsed.date > *value)
                    .unwrap_or(true)
                {
                    max_date = Some(parsed.date.clone());
                }

                if !binary_only {
                    insert_instrument
                        .execute(params![
                            &parsed.symbol,
                            &parsed.exchange,
                            &parsed.symbol,
                            "EQ"
                        ])
                        .map_err(|error| error.to_string())?;
                }

                let execute_result = if binary_only {
                    Ok(1)
                } else {
                    match duplicate_mode {
                        DuplicateMode::Skip => insert_ignore.execute(params![
                            &parsed.symbol,
                            &parsed.exchange,
                            &parsed.date,
                            parsed.open,
                            parsed.high,
                            parsed.low,
                            parsed.close,
                            parsed.volume,
                            parsed.open_interest,
                        ]),
                        DuplicateMode::Overwrite => insert_replace.execute(params![
                            &parsed.symbol,
                            &parsed.exchange,
                            &parsed.date,
                            parsed.open,
                            parsed.high,
                            parsed.low,
                            parsed.close,
                            parsed.volume,
                            parsed.open_interest,
                        ]),
                        DuplicateMode::Error => insert_strict.execute(params![
                            &parsed.symbol,
                            &parsed.exchange,
                            &parsed.date,
                            parsed.open,
                            parsed.high,
                            parsed.low,
                            parsed.close,
                            parsed.volume,
                            parsed.open_interest,
                        ]),
                    }
                };

                match execute_result {
                    Ok(changes) => {
                        if !binary_only && duplicate_mode == DuplicateMode::Skip && changes == 0 {
                            rows_skipped += 1;
                        } else {
                            rows_inserted += 1;

                            // Collect for binary dual-write
                            binary_records
                                .entry(parsed.symbol.clone())
                                .or_default()
                                .push(EodRecord {
                                    date: date_to_u32(&parsed.date),
                                    flags: 0,
                                    open: (parsed.open * DEFAULT_SCALE as f64).round() as i64,
                                    high: (parsed.high * DEFAULT_SCALE as f64).round() as i64,
                                    low: (parsed.low * DEFAULT_SCALE as f64).round() as i64,
                                    close: (parsed.close * DEFAULT_SCALE as f64).round() as i64,
                                    prev_close: 0,
                                    volume: parsed.volume as u64,
                                    oi: parsed.open_interest as u64,
                                });
                        }
                    }
                    Err(error) => {
                        rows_error += 1;
                        if errors.len() < 20 {
                            errors.push(error.to_string());
                        }
                        if duplicate_mode == DuplicateMode::Error {
                            return Err(error.to_string());
                        }
                    }
                }
            }
            Err(error) => {
                rows_error += 1;
                if errors.len() < 20 {
                    errors.push(error);
                }
                if duplicate_mode == DuplicateMode::Error {
                    return Err(errors
                        .last()
                        .cloned()
                        .unwrap_or_else(|| "Import failed.".to_string()));
                }
            }
        }

        if rows_read % ROW_PROGRESS_INTERVAL == 0 {
            on_progress(
                bytes_read,
                format!(
                    "Parsed {} rows, queued {} symbols",
                    rows_read,
                    binary_records.len()
                ),
            );
        }
    }

    drop(insert_instrument);
    drop(insert_ignore);
    drop(insert_replace);
    drop(insert_strict);
    transaction.commit().map_err(|error| error.to_string())?;
    on_progress(
        total_bytes,
        format!(
            "Committed {} rows, queued {} symbols",
            rows_inserted,
            binary_records.len()
        ),
    );

    Ok(SingleFileResult {
        rows_read,
        rows_inserted,
        rows_skipped,
        rows_error,
        symbols,
        min_date,
        max_date,
        errors,
        binary_records,
    })
}

fn insert_binary_import_instruments<'a, I>(
    connection: &mut Connection,
    exchange: &str,
    symbols: I,
) -> AppResult<()>
where
    I: IntoIterator<Item = &'a String>,
{
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    {
        let mut statement = transaction
            .prepare(
                "
                INSERT OR IGNORE INTO instruments (symbol, exchange, name, series)
                VALUES (?, ?, ?, 'EQ')
                ",
            )
            .map_err(|error| error.to_string())?;
        let mut ordered = symbols.into_iter().cloned().collect::<Vec<_>>();
        ordered.sort();
        ordered.dedup();
        for symbol in ordered {
            statement
                .execute(params![symbol, exchange, symbol])
                .map_err(|error| error.to_string())?;
        }
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn detect_source_exchange_hint(file_paths: &[PathBuf]) -> Option<String> {
    let mut hints = HashSet::<String>::new();
    for file_path in file_paths {
        let normalized = file_path.to_string_lossy().replace('\\', "/").to_uppercase();
        if normalized.contains("/BSE/") {
            hints.insert("BSE".to_string());
        }
        if normalized.contains("/NSE/") {
            hints.insert("NSE".to_string());
        }
    }
    if hints.len() == 1 {
        hints.into_iter().next()
    } else if hints.len() > 1 {
        Some("MIXED".to_string())
    } else {
        None
    }
}

fn map_parse_progress(completed_bytes: u64, total_bytes: u64) -> u32 {
    (((completed_bytes as f64 / total_bytes.max(1) as f64) * PARSE_PROGRESS_MAX as f64)
        .round()
        .clamp(0.0, PARSE_PROGRESS_MAX as f64)) as u32
}

fn map_stage_progress(
    completed_items: usize,
    total_items: usize,
    start_progress: u32,
    end_progress: u32,
) -> u32 {
    if total_items == 0 {
        return start_progress;
    }

    let progress_span = end_progress.saturating_sub(start_progress);
    let progress = start_progress as f64
        + ((completed_items as f64 / total_items as f64) * progress_span as f64);
    progress
        .round()
        .clamp(start_progress as f64, end_progress as f64) as u32
}

fn binary_worker_count(total_symbols: usize) -> usize {
    let available = thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1);
    total_symbols
        .min(available.min(MAX_BINARY_IMPORT_WORKERS))
        .max(1)
}

fn filter_binary_records_for_mode<F>(
    folder_path: &Path,
    exchange: &str,
    duplicate_mode: DuplicateMode,
    binary_records: HashMap<String, Vec<EodRecord>>,
    on_progress: F,
) -> AppResult<(HashMap<String, Vec<EodRecord>>, usize)>
where
    F: Fn(usize, usize, &str),
{
    let mut filtered_records = HashMap::<String, Vec<EodRecord>>::new();
    let mut skipped_rows = 0_usize;
    let mut ordered_records = binary_records.into_iter().collect::<Vec<_>>();
    ordered_records.sort_by(|left, right| left.0.cmp(&right.0));
    let total_symbols = ordered_records.len();

    if total_symbols == 0 {
        return Ok((filtered_records, skipped_rows));
    }

    if duplicate_mode == DuplicateMode::Overwrite {
        for (index, (symbol, mut records)) in ordered_records.into_iter().enumerate() {
            records.sort_by_key(|record| record.date);
            if !records.is_empty() {
                filtered_records.insert(symbol.clone(), records);
            }
            on_progress(index + 1, total_symbols, &symbol);
        }
        return Ok((filtered_records, skipped_rows));
    }

    let worker_count = binary_worker_count(total_symbols);
    let queue = Arc::new(Mutex::new(VecDeque::from(ordered_records)));
    let folder_path = folder_path.to_path_buf();
    let exchange = exchange.to_string();
    let (result_tx, result_rx) = mpsc::channel::<BinaryFilterResult>();
    let mut handles = Vec::with_capacity(worker_count);

    for _ in 0..worker_count {
        let queue = Arc::clone(&queue);
        let result_tx = result_tx.clone();
        let folder_path = folder_path.clone();
        let exchange = exchange.clone();
        handles.push(thread::spawn(move || loop {
            let next_item = {
                let mut queue = queue.lock().expect("binary filter queue poisoned");
                queue.pop_front()
            };

            let Some((symbol, mut records)) = next_item else {
                break;
            };

            records.sort_by_key(|record| record.date);
            let result = filter_binary_records_for_symbol(
                &folder_path,
                &exchange,
                duplicate_mode,
                symbol,
                records,
            );
            if result_tx.send(result).is_err() {
                break;
            }
        }));
    }
    drop(result_tx);

    let mut completed_symbols = 0_usize;
    let mut first_error: Option<String> = None;
    for _ in 0..total_symbols {
        let result = result_rx
            .recv()
            .map_err(|error| format!("Binary filter worker failure: {}", error))?;
        completed_symbols += 1;
        on_progress(completed_symbols, total_symbols, &result.symbol);

        if let Some(error) = result.error {
            if first_error.is_none() {
                first_error = Some(error);
            }
            continue;
        }

        skipped_rows += result.skipped_rows;
        if !result.records.is_empty() {
            filtered_records.insert(result.symbol, result.records);
        }
    }

    for handle in handles {
        handle
            .join()
            .map_err(|_| "Binary filter worker panicked".to_string())?;
    }

    if let Some(error) = first_error {
        return Err(error);
    }

    Ok((filtered_records, skipped_rows))
}

fn filter_binary_records_for_symbol(
    folder_path: &Path,
    exchange: &str,
    duplicate_mode: DuplicateMode,
    symbol: String,
    records: Vec<EodRecord>,
) -> BinaryFilterResult {
    let bin_path = folder_path
        .join("eod_data")
        .join(exchange)
        .join(format!("{}.eod", symbol));

    if !bin_path.exists() {
        return BinaryFilterResult {
            symbol,
            records,
            skipped_rows: 0,
            error: None,
        };
    }

    let existing = match BinaryEodFile::open(&bin_path) {
        Ok(existing) => existing,
        Err(error) => {
            return BinaryFilterResult {
                symbol: symbol.clone(),
                records: Vec::new(),
                skipped_rows: 0,
                error: Some(format!(
                    "Failed to inspect binary EOD for {}:{}: {}: {}",
                    exchange,
                    symbol,
                    bin_path.display(),
                    error
                )),
            }
        }
    };

    match duplicate_mode {
        DuplicateMode::Error => match existing.filter_records_against_existing(records.clone()) {
            Ok((_, skipped_count)) if skipped_count > 0 => BinaryFilterResult {
                symbol: symbol.clone(),
                records: Vec::new(),
                skipped_rows: 0,
                error: Some(format!(
                    "Duplicate row exists in binary EOD for {}:{}",
                    exchange, symbol
                )),
            },
            Ok(_) => BinaryFilterResult {
                symbol,
                records,
                skipped_rows: 0,
                error: None,
            },
            Err(error) => BinaryFilterResult {
                symbol: symbol.clone(),
                records: Vec::new(),
                skipped_rows: 0,
                error: Some(format!(
                    "Failed to inspect binary EOD for {}:{}: {}: {}",
                    exchange,
                    symbol,
                    bin_path.display(),
                    error
                )),
            },
        },
        DuplicateMode::Skip => match existing.filter_records_against_existing(records) {
            Ok((filtered, skipped_count)) => BinaryFilterResult {
                symbol,
                records: filtered,
                skipped_rows: skipped_count,
                error: None,
            },
            Err(error) => BinaryFilterResult {
                symbol: symbol.clone(),
                records: Vec::new(),
                skipped_rows: 0,
                error: Some(format!(
                    "Failed to inspect binary EOD for {}:{}: {}: {}",
                    exchange,
                    symbol,
                    bin_path.display(),
                    error
                )),
            },
        },
        DuplicateMode::Overwrite => BinaryFilterResult {
            symbol,
            records,
            skipped_rows: 0,
            error: None,
        },
    }
}

fn write_binary_records_parallel<F>(
    folder_path: &Path,
    exchange: &str,
    binary_records: HashMap<String, Vec<EodRecord>>,
    on_progress: F,
) -> AppResult<Vec<BinaryWriteResult>>
where
    F: Fn(usize, usize, &str),
{
    let mut ordered_records = binary_records.into_iter().collect::<Vec<_>>();
    ordered_records.sort_by(|left, right| left.0.cmp(&right.0));
    let total_symbols = ordered_records.len();
    if total_symbols == 0 {
        return Ok(Vec::new());
    }

    if total_symbols == 1 {
        let (symbol, records) = ordered_records.pop().unwrap();
        let result =
            write_binary_records_for_symbol(folder_path, exchange, symbol.clone(), records);
        on_progress(1, 1, &symbol);
        return Ok(vec![result]);
    }

    let worker_count = binary_worker_count(total_symbols);
    let queue = Arc::new(Mutex::new(VecDeque::from(ordered_records)));
    let folder_path = folder_path.to_path_buf();
    let exchange = exchange.to_string();
    let (result_tx, result_rx) = mpsc::channel::<BinaryWriteResult>();
    let mut handles = Vec::with_capacity(worker_count);

    for _ in 0..worker_count {
        let queue = Arc::clone(&queue);
        let result_tx = result_tx.clone();
        let folder_path = folder_path.clone();
        let exchange = exchange.clone();
        handles.push(thread::spawn(move || loop {
            let next_item = {
                let mut queue = queue.lock().expect("binary write queue poisoned");
                queue.pop_front()
            };

            let Some((symbol, records)) = next_item else {
                break;
            };

            let result = write_binary_records_for_symbol(&folder_path, &exchange, symbol, records);
            if result_tx.send(result).is_err() {
                break;
            }
        }));
    }
    drop(result_tx);

    let mut results = Vec::with_capacity(total_symbols);
    for completed in 1..=total_symbols {
        let result = result_rx
            .recv()
            .map_err(|error| format!("Binary write worker failure: {}", error))?;
        on_progress(completed, total_symbols, &result.symbol);
        results.push(result);
    }

    for handle in handles {
        handle
            .join()
            .map_err(|_| "Binary write worker panicked".to_string())?;
    }

    Ok(results)
}

fn write_binary_records_for_symbol(
    folder_path: &Path,
    exchange: &str,
    symbol: String,
    records: Vec<EodRecord>,
) -> BinaryWriteResult {
    let bin_path = folder_path
        .join("eod_data")
        .join(exchange)
        .join(format!("{}.eod", symbol));
    let write_started = std::time::Instant::now();

    match BinaryEodFile::append_or_merge_records_with_stats(
        &bin_path,
        &symbol,
        exchange,
        DEFAULT_SCALE,
        records,
    ) {
        Ok(result) => BinaryWriteResult {
            symbol,
            error: None,
            stats: result.stats,
            diagnostics: result.diagnostics,
        },
        Err(error) => {
            let mut diagnostics = BinaryWriteDiagnostics::default();
            diagnostics.total_us = write_started.elapsed().as_micros();
            BinaryWriteResult {
                symbol: symbol.clone(),
                error: Some(format!(
                    "Binary write failure for {}:{}: {}: {}",
                    exchange,
                    symbol,
                    bin_path.display(),
                    error
                )),
                stats: BinaryAppendMergeStats::default(),
                diagnostics,
            }
        }
    }
}

fn summarize_binary_records(
    exchange: &str,
    binary_records: &HashMap<String, Vec<EodRecord>>,
) -> (
    usize,
    HashSet<String>,
    Vec<ImportSampleSymbol>,
    Option<String>,
    Option<String>,
) {
    let mut rows_inserted = 0_usize;
    let mut symbols = HashSet::<String>::new();
    let mut sample_symbols = Vec::<ImportSampleSymbol>::new();
    let mut min_date: Option<String> = None;
    let mut max_date: Option<String> = None;

    let mut ordered_symbols = binary_records.keys().cloned().collect::<Vec<_>>();
    ordered_symbols.sort();

    for symbol in ordered_symbols {
        let Some(records) = binary_records.get(&symbol) else {
            continue;
        };
        if records.is_empty() {
            continue;
        }

        rows_inserted += records.len();
        symbols.insert(format!("{}:{}", exchange, symbol));
        if sample_symbols.len() < 8 {
            sample_symbols.push(ImportSampleSymbol {
                symbol: symbol.clone(),
                exchange: exchange.to_string(),
            });
        }

        if let Some(first) = records.first() {
            let date = u32_to_date(first.date);
            if min_date.as_ref().map(|value| date < *value).unwrap_or(true) {
                min_date = Some(date);
            }
        }

        if let Some(last) = records.last() {
            let date = u32_to_date(last.date);
            if max_date.as_ref().map(|value| date > *value).unwrap_or(true) {
                max_date = Some(date);
            }
        }
    }

    (rows_inserted, symbols, sample_symbols, min_date, max_date)
}

fn parse_duplicate_mode(value: Option<&str>) -> DuplicateMode {
    match value.unwrap_or("skip").trim().to_lowercase().as_str() {
        "overwrite" => DuplicateMode::Overwrite,
        "error" => DuplicateMode::Error,
        _ => DuplicateMode::Skip,
    }
}

fn parse_date_format(value: Option<&str>) -> DateFormat {
    match value.unwrap_or("auto").trim() {
        "YYYYMMDD" => DateFormat::YyyyMmDdCompact,
        "YYYY-MM-DD" => DateFormat::YyyyDashMmDashDd,
        "YYYY/MM/DD" => DateFormat::YyyySlashMmSlashDd,
        "DD-MM-YYYY" => DateFormat::DdDashMmDashYyyy,
        "DD/MM/YYYY" => DateFormat::DdSlashMmSlashYyyy,
        "DD-MMM-YYYY" => DateFormat::DdMmmYyyy,
        _ => DateFormat::Auto,
    }
}

fn default_header_map() -> HeaderMap {
    HeaderMap {
        symbol: 0,
        date: 1,
        open: 2,
        high: 3,
        low: 4,
        close: 5,
        volume: 6,
        open_interest: None,
    }
}

fn build_header_map(headers: &[String]) -> HeaderMap {
    let mut map = default_header_map();
    for (index, header) in headers.iter().enumerate() {
        let normalized = normalize_header(header);
        if matches!(
            normalized.as_str(),
            "symbol" | "sym" | "ticker" | "scrip" | "script"
        ) {
            map.symbol = index;
        }
        if matches!(
            normalized.as_str(),
            "date" | "dt" | "time" | "timestamp" | "traddt" | "traddate"
        ) {
            map.date = index;
        }
        if matches!(normalized.as_str(), "open" | "o" | "openprice") {
            map.open = index;
        }
        if matches!(normalized.as_str(), "high" | "h" | "highprice") {
            map.high = index;
        }
        if matches!(normalized.as_str(), "low" | "l" | "lowprice") {
            map.low = index;
        }
        if matches!(
            normalized.as_str(),
            "close" | "c" | "closeprice" | "ltp" | "last"
        ) {
            map.close = index;
        }
        if matches!(
            normalized.as_str(),
            "volume" | "vol" | "v" | "qty" | "tottrdqty" | "quantity"
        ) {
            map.volume = index;
        }
        if matches!(
            normalized.as_str(),
            "oi" | "openint" | "openinterest" | "openinterestval"
        ) {
            map.open_interest = Some(index);
        }
    }
    map
}

fn parse_row(
    fields: &[String],
    map: HeaderMap,
    exchange: &str,
    explicit_format: DateFormat,
) -> AppResult<ParsedRow> {
    let symbol = required(fields.get(map.symbol), "symbol")?.to_uppercase();
    let date = normalize_date(required(fields.get(map.date), "date")?, explicit_format)?;
    let open_interest = if let Some(idx) = map.open_interest {
        parse_number(fields.get(idx), "open_interest")
            .unwrap_or(0.0)
            .round() as i64
    } else {
        0
    };

    Ok(ParsedRow {
        symbol,
        exchange: exchange.to_string(),
        date,
        open: parse_number(fields.get(map.open), "open")?,
        high: parse_number(fields.get(map.high), "high")?,
        low: parse_number(fields.get(map.low), "low")?,
        close: parse_number(fields.get(map.close), "close")?,
        volume: parse_number(fields.get(map.volume), "volume")?.round() as i64,
        open_interest,
    })
}

fn parse_number(value: Option<&String>, label: &str) -> AppResult<f64> {
    let normalized = required(value, label)?.replace(',', "");
    normalized
        .parse::<f64>()
        .map_err(|_| format!("Invalid {label} value: {normalized}"))
}

fn required(value: Option<&String>, label: &str) -> AppResult<String> {
    let normalized = value.map(|value| value.trim()).unwrap_or("");
    if normalized.is_empty() {
        return Err(format!("Missing {label} value"));
    }
    Ok(normalized.to_string())
}

fn normalize_date(value: String, explicit_format: DateFormat) -> AppResult<String> {
    let format = match explicit_format {
        DateFormat::Auto => infer_date_format(&value),
        other => other,
    };
    match format {
        DateFormat::YyyyMmDdCompact
            if value.len() == 8 && value.chars().all(|ch| ch.is_ascii_digit()) =>
        {
            Ok(format!(
                "{}-{}-{}",
                &value[0..4],
                &value[4..6],
                &value[6..8]
            ))
        }
        DateFormat::YyyyDashMmDashDd if is_iso_date(&value) => Ok(value),
        DateFormat::YyyySlashMmSlashDd if is_slash_iso_date(&value) => Ok(value.replace('/', "-")),
        DateFormat::DdDashMmDashYyyy if matches_day_first_date(&value, '-') => {
            let parts = value.split('-').collect::<Vec<_>>();
            Ok(format!("{}-{}-{}", parts[2], parts[1], parts[0]))
        }
        DateFormat::DdSlashMmSlashYyyy if matches_day_first_date(&value, '/') => {
            let parts = value.split('/').collect::<Vec<_>>();
            Ok(format!("{}-{}-{}", parts[2], parts[1], parts[0]))
        }
        DateFormat::DdMmmYyyy => {
            let parts = value.split('-').collect::<Vec<_>>();
            if parts.len() != 3 {
                return Err(format!("Unsupported date format: {value}"));
            }
            Ok(format!(
                "{}-{}-{}",
                parts[2],
                month_name_to_number(parts[1])?,
                parts[0]
            ))
        }
        _ => Err(format!("Unsupported date format: {value}")),
    }
}

fn infer_date_format(value: &str) -> DateFormat {
    if value.len() == 8 && value.chars().all(|ch| ch.is_ascii_digit()) {
        return DateFormat::YyyyMmDdCompact;
    }
    if is_iso_date(value) {
        return DateFormat::YyyyDashMmDashDd;
    }
    if is_slash_iso_date(value) {
        return DateFormat::YyyySlashMmSlashDd;
    }
    if matches_day_first_date(value, '-') {
        return DateFormat::DdDashMmDashYyyy;
    }
    if matches_day_first_date(value, '/') {
        return DateFormat::DdSlashMmSlashYyyy;
    }
    if value.len() == 11 && value.matches('-').count() == 2 {
        return DateFormat::DdMmmYyyy;
    }
    DateFormat::YyyyDashMmDashDd
}

fn month_name_to_number(value: &str) -> AppResult<&'static str> {
    match value.trim().to_uppercase().as_str() {
        "JAN" => Ok("01"),
        "FEB" => Ok("02"),
        "MAR" => Ok("03"),
        "APR" => Ok("04"),
        "MAY" => Ok("05"),
        "JUN" => Ok("06"),
        "JUL" => Ok("07"),
        "AUG" => Ok("08"),
        "SEP" => Ok("09"),
        "OCT" => Ok("10"),
        "NOV" => Ok("11"),
        "DEC" => Ok("12"),
        other => Err(format!("Unsupported month token: {other}")),
    }
}

fn is_iso_date(value: &str) -> bool {
    value.len() == 10
        && value.chars().enumerate().all(|(index, ch)| match index {
            4 | 7 => ch == '-',
            _ => ch.is_ascii_digit(),
        })
}

fn is_slash_iso_date(value: &str) -> bool {
    value.len() == 10
        && value.chars().enumerate().all(|(index, ch)| match index {
            4 | 7 => ch == '/',
            _ => ch.is_ascii_digit(),
        })
}

fn matches_day_first_date(value: &str, separator: char) -> bool {
    value.len() == 10
        && value.chars().enumerate().all(|(index, ch)| match index {
            2 | 5 => ch == separator,
            _ => ch.is_ascii_digit(),
        })
}

fn detect_header(fields: &[String]) -> bool {
    fields.iter().any(|field| {
        matches!(
            normalize_header(field).as_str(),
            "symbol"
                | "sym"
                | "ticker"
                | "scrip"
                | "script"
                | "date"
                | "dt"
                | "time"
                | "timestamp"
                | "traddt"
                | "traddate"
                | "open"
                | "o"
                | "openprice"
                | "high"
                | "h"
                | "highprice"
                | "low"
                | "l"
                | "lowprice"
                | "close"
                | "c"
                | "closeprice"
                | "ltp"
                | "last"
                | "volume"
                | "vol"
                | "v"
                | "qty"
                | "tottrdqty"
                | "quantity"
        )
    })
}

fn normalize_header(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .collect()
}

fn detect_delimiter(line: &str) -> char {
    [',', '\t', ';']
        .into_iter()
        .max_by_key(|candidate| count_delimiter_occurrences(line, *candidate))
        .unwrap_or(',')
}

fn count_delimiter_occurrences(line: &str, delimiter: char) -> usize {
    let mut count = 0;
    let mut in_quotes = false;
    let chars = line.chars().collect::<Vec<_>>();
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        if ch == '"' {
            if in_quotes && chars.get(index + 1) == Some(&'"') {
                index += 2;
                continue;
            }
            in_quotes = !in_quotes;
            index += 1;
            continue;
        }
        if !in_quotes && ch == delimiter {
            count += 1;
        }
        index += 1;
    }
    count
}

fn split_delimited_line(line: &str, delimiter: char) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let chars = line.chars().collect::<Vec<_>>();
    let mut in_quotes = false;
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if ch == '"' {
            if in_quotes && chars.get(index + 1) == Some(&'"') {
                current.push('"');
                index += 2;
                continue;
            }
            in_quotes = !in_quotes;
            index += 1;
            continue;
        }

        if !in_quotes && ch == delimiter {
            values.push(current);
            current = String::new();
            index += 1;
            continue;
        }

        current.push(ch);
        index += 1;
    }

    values.push(current);
    values
}

fn read_first_non_empty_lines(file_path: &Path, max_lines: usize) -> AppResult<Vec<String>> {
    let file = File::open(file_path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut lines = Vec::new();

    for line_result in reader.lines() {
        let line = line_result.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        lines.push(line);
        if lines.len() >= max_lines {
            break;
        }
    }

    Ok(lines)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::set_price_storage_mode;
    use std::io::Write;
    use tempfile::tempdir;

    fn setup_test_db(db_path: &Path) -> Connection {
        let conn = Connection::open(db_path).unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE instruments (
                symbol TEXT,
                exchange TEXT,
                name TEXT,
                series TEXT,
                isin TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                updated_at TEXT,
                UNIQUE(symbol, exchange)
            )",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (
                symbol TEXT, exchange TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, volume INTEGER, open_interest INTEGER
            )",
            [],
        ).unwrap();
        prepare_database_connection(&conn).unwrap();
        conn
    }

    #[test]
    fn test_import_single_file_binary_queues_records_and_skips_sqlite() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let mut conn = setup_test_db(&db_path);

        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let csv_path = temp_dir.path().join("test.csv");
        let mut csv_file = File::create(&csv_path).unwrap();
        writeln!(csv_file, "Symbol,Date,Open,High,Low,Close,Volume").unwrap();
        writeln!(csv_file, "RELIANCE,2024-05-15,2500,2550,2490,2520,100000").unwrap();
        drop(csv_file);

        let options = ImportOptionsInput {
            file_paths: vec![csv_path.to_string_lossy().to_string()],
            exchange: Some("NSE".to_string()),
            has_header: Some(true),
            date_format: Some("YYYY-MM-DD".to_string()),
            delimiter: Some(",".to_string()),
            on_duplicate: Some("skip".to_string()),
            trim_whitespace: Some(true),
            allow_exchange_mismatch: Some(false),
        };

        let result = import_single_file(&mut conn, &options, &csv_path, |_, _| {}).unwrap();

        assert_eq!(result.rows_inserted, 1);

        let eod_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM eod_prices", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            eod_count, 0,
            "SQLite eod_prices should be empty in Binary mode"
        );

        let inst_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM instruments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            inst_count, 0,
            "Binary-mode parsing must not create instrument metadata before the durable recovery journal is prepared"
        );

        let queued = result.binary_records.get("RELIANCE").unwrap();
        assert_eq!(queued.len(), 1, "Binary mode should queue one record");
    }

    #[test]
    fn test_import_csv_internal_binary_skip_skips_existing_dates() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = setup_test_db(&db_path);
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("RELIANCE.eod");
        let mut existing = vec![EodRecord {
            date: 20240515,
            flags: 0,
            open: 2500 * DEFAULT_SCALE as i64,
            high: 2550 * DEFAULT_SCALE as i64,
            low: 2490 * DEFAULT_SCALE as i64,
            close: 2520 * DEFAULT_SCALE as i64,
            prev_close: 0,
            volume: 100000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "RELIANCE", "NSE", DEFAULT_SCALE, &mut existing)
            .unwrap();

        let csv_path = temp_dir.path().join("test.csv");
        let mut csv_file = File::create(&csv_path).unwrap();
        writeln!(csv_file, "Symbol,Date,Open,High,Low,Close,Volume").unwrap();
        writeln!(csv_file, "RELIANCE,2024-05-15,2500,2550,2490,2520,100000").unwrap();
        writeln!(csv_file, "RELIANCE,2024-05-16,2510,2560,2500,2530,120000").unwrap();
        drop(csv_file);

        let options = ImportOptionsInput {
            file_paths: vec![csv_path.to_string_lossy().to_string()],
            exchange: Some("NSE".to_string()),
            has_header: Some(true),
            date_format: Some("YYYY-MM-DD".to_string()),
            delimiter: Some(",".to_string()),
            on_duplicate: Some("skip".to_string()),
            trim_whitespace: Some(true),
            allow_exchange_mismatch: Some(false),
        };

        let result = import_csv_internal(&db_path, &options, |_, _| {}).unwrap();

        assert_eq!(result.rows_read, 2);
        assert_eq!(result.rows_inserted, 1);
        assert_eq!(result.rows_skipped, 1);
        assert_eq!(result.rows_error, 0);
        let diagnostics = result
            .binary_diagnostics
            .as_ref()
            .expect("manual import should expose binary diagnostics");
        assert_eq!(diagnostics.workers, 1);
        assert_eq!(diagnostics.append_newest, 1);
        assert_eq!(diagnostics.sync_data_calls, 1);
        assert_eq!(diagnostics.inserted_dates, 1);
        let recovery = result
            .recovery_session
            .as_ref()
            .expect("binary manual import should create an undoable recovery session");
        assert!(recovery.undoable);
        assert_eq!(recovery.exchange, "NSE");
        assert_eq!(recovery.planned_changes, 1);
        assert_eq!(recovery.created_instruments, 1);
        assert_eq!(
            result
                .date_range
                .as_ref()
                .map(|range| (range.from.clone(), range.to.clone())),
            Some(("2024-05-16".to_string(), "2024-05-16".to_string()))
        );

        let all = BinaryEodFile::open(&bin_path).unwrap().read_all().unwrap();
        assert_eq!(all.len(), 2, "Only the new binary row should be added");
        assert_eq!(all[0].date, 20240515);
        assert_eq!(all[1].date, 20240516);
    }

    #[test]
    fn test_import_csv_internal_binary_skip_full_overlap_keeps_source_summary() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = setup_test_db(&db_path);
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        conn.execute(
            "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('RELIANCE','NSE','RELIANCE','EQ')",
            [],
        )
        .unwrap();
        drop(conn);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("RELIANCE.eod");
        let mut existing = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 2500 * DEFAULT_SCALE as i64,
                high: 2550 * DEFAULT_SCALE as i64,
                low: 2490 * DEFAULT_SCALE as i64,
                close: 2520 * DEFAULT_SCALE as i64,
                prev_close: 0,
                volume: 100000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 2510 * DEFAULT_SCALE as i64,
                high: 2560 * DEFAULT_SCALE as i64,
                low: 2500 * DEFAULT_SCALE as i64,
                close: 2530 * DEFAULT_SCALE as i64,
                prev_close: 0,
                volume: 120000,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(&bin_path, "RELIANCE", "NSE", DEFAULT_SCALE, &mut existing)
            .unwrap();

        let csv_path = temp_dir.path().join("test.csv");
        let mut csv_file = File::create(&csv_path).unwrap();
        writeln!(csv_file, "Symbol,Date,Open,High,Low,Close,Volume").unwrap();
        writeln!(csv_file, "RELIANCE,2024-05-15,2500,2550,2490,2520,100000").unwrap();
        writeln!(csv_file, "RELIANCE,2024-05-16,2510,2560,2500,2530,120000").unwrap();
        drop(csv_file);

        let options = ImportOptionsInput {
            file_paths: vec![csv_path.to_string_lossy().to_string()],
            exchange: Some("NSE".to_string()),
            has_header: Some(true),
            date_format: Some("YYYY-MM-DD".to_string()),
            delimiter: Some(",".to_string()),
            on_duplicate: Some("skip".to_string()),
            trim_whitespace: Some(true),
            allow_exchange_mismatch: Some(false),
        };

        let result = import_csv_internal(&db_path, &options, |_, _| {}).unwrap();

        assert_eq!(result.rows_read, 2);
        assert_eq!(result.rows_inserted, 0);
        assert_eq!(result.rows_skipped, 2);
        assert_eq!(result.rows_error, 0);
        assert_eq!(result.symbol_count, 1);
        assert_eq!(
            result
                .date_range
                .as_ref()
                .map(|range| (range.from.clone(), range.to.clone())),
            Some(("2024-05-15".to_string(), "2024-05-16".to_string()))
        );
        assert_eq!(result.sample_symbols.len(), 1);
        assert_eq!(result.sample_symbols[0].symbol, "RELIANCE");
        assert_eq!(result.sample_symbols[0].exchange, "NSE");
        assert!(
            result.recovery_session.is_none(),
            "A full-overlap Skip import must not create an undo session because it changed no quote or instrument state"
        );
    }
    #[test]
    fn test_detect_source_exchange_hint_flags_bse_folder_for_nse_target_guard() {
        let files = vec![
            PathBuf::from(r"E:\TA Projects\EOD Downloader\output\BSE\EQ\20231115.csv"),
            PathBuf::from(r"E:\TA Projects\EOD Downloader\output\BSE\EQ\20231116.csv"),
        ];
        assert_eq!(detect_source_exchange_hint(&files).as_deref(), Some("BSE"));
    }

    #[test]
    fn test_detect_source_exchange_hint_reports_mixed_sources() {
        let files = vec![
            PathBuf::from(r"E:\data\BSE\EQ\one.csv"),
            PathBuf::from(r"E:\data\NSE\EQ\two.csv"),
        ];
        assert_eq!(detect_source_exchange_hint(&files).as_deref(), Some("MIXED"));
    }

}

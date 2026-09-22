use crate::database::binary_eod::{BinaryEodFile, EodRecord, DEFAULT_SCALE};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process;
use std::sync::atomic::{AtomicU64, Ordering};

pub type AppResult<T> = Result<T, String>;

pub const MANUAL_IMPORT_RECOVERY_SCHEMA_VERSION: &str = "eod-manual-import-recovery-v1";
const RECOVERY_ROOT: &str = "manual_import_recovery";
const RECOVERY_SESSIONS: &str = "sessions";
const MANIFEST_FILE: &str = "manifest.json";
const MANIFEST_BACKUP_FILE: &str = "manifest.json.bak";
const MANIFEST_TEMP_FILE: &str = "manifest.json.tmp";
const JOURNAL_FILE: &str = "changes.ndjson";
const JOURNAL_TEMP_FILE: &str = "changes.ndjson.tmp";
static SESSION_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ManualImportRecoveryState {
    Prepared,
    Applying,
    Applied,
    Failed,
    Undoing,
    Undone,
    PartialConflict,
    RecoveryError,
}

impl ManualImportRecoveryState {
    pub fn is_undoable(&self) -> bool {
        matches!(
            self,
            Self::Prepared
                | Self::Applying
                | Self::Applied
                | Self::Failed
                | Self::Undoing
                | Self::PartialConflict
                | Self::RecoveryError
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ManualImportChangeAction {
    Insert,
    Overwrite,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportRecoveryRecord {
    pub date: u32,
    pub flags: u32,
    pub open: i64,
    pub high: i64,
    pub low: i64,
    pub close: i64,
    pub prev_close: i64,
    pub volume: u64,
    pub oi: u64,
}

impl From<EodRecord> for ManualImportRecoveryRecord {
    fn from(value: EodRecord) -> Self {
        Self {
            date: value.date,
            flags: value.flags,
            open: value.open,
            high: value.high,
            low: value.low,
            close: value.close,
            prev_close: value.prev_close,
            volume: value.volume,
            oi: value.oi,
        }
    }
}

impl From<ManualImportRecoveryRecord> for EodRecord {
    fn from(value: ManualImportRecoveryRecord) -> Self {
        Self {
            date: value.date,
            flags: value.flags,
            open: value.open,
            high: value.high,
            low: value.low,
            close: value.close,
            prev_close: value.prev_close,
            volume: value.volume,
            oi: value.oi,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportRecoveryChange {
    pub symbol: String,
    pub exchange: String,
    pub action: ManualImportChangeAction,
    pub before: Option<ManualImportRecoveryRecord>,
    pub after: ManualImportRecoveryRecord,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportSourceEvidence {
    pub path: String,
    pub file_name: String,
    pub byte_length: u64,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportRecoveryManifest {
    pub schema_version: String,
    pub session_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub state: ManualImportRecoveryState,
    pub database_folder: String,
    pub exchange: String,
    pub duplicate_mode: String,
    pub storage_mode: String,
    pub source_files: Vec<ManualImportSourceEvidence>,
    pub journal_file: String,
    pub journal_row_count: usize,
    pub journal_byte_length: u64,
    pub journal_sha256: String,
    pub planned_record_count: usize,
    pub created_instruments: Vec<String>,
    pub rows_read: usize,
    pub rows_skipped: usize,
    pub rows_inserted: usize,
    pub rows_error: usize,
    pub symbol_count: usize,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub completed_at: Option<String>,
    pub undone_at: Option<String>,
    pub error_summary: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ManualImportRecoveryHandle {
    pub directory: PathBuf,
    pub manifest: ManualImportRecoveryManifest,
}

#[derive(Clone, Debug)]
pub struct LoadedManualImportRecoverySession {
    pub directory: PathBuf,
    pub manifest: ManualImportRecoveryManifest,
    pub changes: Vec<ManualImportRecoveryChange>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportRecoverySummary {
    pub session_id: String,
    pub status: String,
    pub exchange: String,
    pub duplicate_mode: String,
    pub storage_mode: String,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub undone_at: Option<String>,
    pub file_count: usize,
    pub source_files: Vec<String>,
    pub rows_read: usize,
    pub rows_inserted: usize,
    pub rows_skipped: usize,
    pub rows_error: usize,
    pub symbol_count: usize,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub planned_changes: usize,
    pub created_instruments: usize,
    pub undoable: bool,
    pub error_summary: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportUndoInput {
    pub session_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualImportUndoResult {
    pub success: bool,
    pub session_id: String,
    pub reverted_inserted_rows: usize,
    pub restored_overwritten_rows: usize,
    pub already_reverted_rows: usize,
    pub conflicts: usize,
    pub removed_instruments: usize,
    pub preserved_instruments: usize,
    pub message: String,
}

pub fn prepare_binary_import_session(
    database_file_path: &Path,
    connection: &Connection,
    exchange: &str,
    duplicate_mode: &str,
    source_paths: &[PathBuf],
    rows_read: usize,
    rows_skipped: usize,
    instrument_symbols: &HashSet<String>,
    records: &HashMap<String, Vec<EodRecord>>,
) -> AppResult<Option<ManualImportRecoveryHandle>> {
    let database_folder = database_file_path
        .parent()
        .ok_or_else(|| "Database folder is unavailable for manual import recovery.".to_string())?;
    let canonical_database = canonical_database_folder(database_folder)?;

    let mut source_files = Vec::with_capacity(source_paths.len());
    for path in source_paths {
        source_files.push(hash_source_file(path)?);
    }

    let mut created_instruments = Vec::<String>::new();
    let mut changes = Vec::<ManualImportRecoveryChange>::new();
    let mut planned_record_count = 0_usize;
    let mut min_date: Option<u32> = None;
    let mut max_date: Option<u32> = None;
    let mut instrument_symbols_sorted = instrument_symbols.iter().cloned().collect::<Vec<_>>();
    instrument_symbols_sorted.sort();
    for symbol in &instrument_symbols_sorted {
        let exists: bool = connection
            .query_row(
                "SELECT 1 FROM instruments WHERE symbol = ? AND exchange = ? LIMIT 1",
                params![symbol, exchange],
                |_| Ok(true),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .unwrap_or(false);
        if !exists {
            created_instruments.push(symbol.clone());
        }
    }

    let mut symbols = records.keys().cloned().collect::<Vec<_>>();
    symbols.sort();
    for symbol in &symbols {
        let bin_path = database_folder
            .join("eod_data")
            .join(exchange)
            .join(format!("{}.eod", symbol));
        let existing = load_normalized_records_by_date(&bin_path)?;
        let mut seen_dates = BTreeSet::<u32>::new();
        let incoming = records
            .get(symbol)
            .ok_or_else(|| format!("Missing manual import records for {}:{}.", exchange, symbol))?;

        for record in incoming {
            if !seen_dates.insert(record.date) {
                return Err(format!(
                    "Manual Import recovery requires unique SYMBOL+DATE keys. Duplicate key found for {}:{} on {}.",
                    exchange, symbol, record.date
                ));
            }
            planned_record_count += 1;
            min_date = Some(min_date.map(|value| value.min(record.date)).unwrap_or(record.date));
            max_date = Some(max_date.map(|value| value.max(record.date)).unwrap_or(record.date));
            let after = ManualImportRecoveryRecord::from(*record);
            match existing.get(&record.date) {
                None => changes.push(ManualImportRecoveryChange {
                    symbol: symbol.clone(),
                    exchange: exchange.to_string(),
                    action: ManualImportChangeAction::Insert,
                    before: None,
                    after,
                }),
                Some(before) if *before != after => changes.push(ManualImportRecoveryChange {
                    symbol: symbol.clone(),
                    exchange: exchange.to_string(),
                    action: ManualImportChangeAction::Overwrite,
                    before: Some(before.clone()),
                    after,
                }),
                Some(_) => {}
            }
        }
    }

    if changes.is_empty() && created_instruments.is_empty() {
        return Ok(None);
    }

    let session_id = next_session_id();
    let directory = recovery_sessions_root(database_folder).join(&session_id);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let journal_temp_path = directory.join(JOURNAL_TEMP_FILE);
    let journal_path = directory.join(JOURNAL_FILE);
    let (journal_byte_length, journal_sha256) = write_journal_file(&journal_temp_path, &changes)?;
    fs::rename(&journal_temp_path, &journal_path).map_err(|error| error.to_string())?;

    let now = now_iso();
    let manifest = ManualImportRecoveryManifest {
        schema_version: MANUAL_IMPORT_RECOVERY_SCHEMA_VERSION.to_string(),
        session_id,
        created_at: now.clone(),
        updated_at: now,
        state: ManualImportRecoveryState::Prepared,
        database_folder: canonical_database,
        exchange: exchange.to_string(),
        duplicate_mode: duplicate_mode.to_string(),
        storage_mode: "binary".to_string(),
        source_files,
        journal_file: JOURNAL_FILE.to_string(),
        journal_row_count: changes.len(),
        journal_byte_length,
        journal_sha256,
        planned_record_count,
        created_instruments,
        rows_read,
        rows_skipped,
        rows_inserted: 0,
        rows_error: 0,
        symbol_count: instrument_symbols.len(),
        date_from: min_date.map(binary_date_to_display),
        date_to: max_date.map(binary_date_to_display),
        completed_at: None,
        undone_at: None,
        error_summary: None,
    };
    write_manifest_atomic(&directory, &manifest)?;

    Ok(Some(ManualImportRecoveryHandle { directory, manifest }))
}

pub fn update_session_state(
    handle: &mut ManualImportRecoveryHandle,
    state: ManualImportRecoveryState,
    rows_inserted: Option<usize>,
    rows_error: Option<usize>,
    error_summary: Option<String>,
) -> AppResult<()> {
    let now = now_iso();
    handle.manifest.state = state.clone();
    handle.manifest.updated_at = now.clone();
    if let Some(value) = rows_inserted {
        handle.manifest.rows_inserted = value;
    }
    if let Some(value) = rows_error {
        handle.manifest.rows_error = value;
    }
    handle.manifest.error_summary = error_summary;
    if state == ManualImportRecoveryState::Applied || state == ManualImportRecoveryState::Failed {
        handle.manifest.completed_at = Some(now);
    }
    write_manifest_atomic(&handle.directory, &handle.manifest)
}

pub fn summary_from_handle(handle: &ManualImportRecoveryHandle) -> ManualImportRecoverySummary {
    summary_from_manifest(&handle.manifest)
}

pub fn list_session_summaries(
    database_folder: &Path,
) -> AppResult<Vec<ManualImportRecoverySummary>> {
    let root = recovery_sessions_root(database_folder);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let canonical_database = canonical_database_folder(database_folder)?;
    let mut manifests = Vec::<ManualImportRecoveryManifest>::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let directory = entry.path();
        if !directory.is_dir() {
            continue;
        }
        if let Ok(manifest) = read_manifest_with_backup(&directory) {
            if manifest.schema_version == MANUAL_IMPORT_RECOVERY_SCHEMA_VERSION
                && manifest.database_folder == canonical_database
            {
                manifests.push(manifest);
            }
        }
    }
    manifests.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(manifests.iter().map(summary_from_manifest).collect())
}

pub fn latest_session_summary(
    database_folder: &Path,
) -> AppResult<Option<ManualImportRecoverySummary>> {
    let summaries = list_session_summaries(database_folder)?;
    if let Some(summary) = summaries.iter().find(|summary| summary.undoable) {
        return Ok(Some(summary.clone()));
    }
    Ok(summaries.first().cloned())
}

pub fn undo_session<F>(
    database_file_path: &Path,
    connection: &Connection,
    session_id: &str,
    on_progress: F,
) -> AppResult<ManualImportUndoResult>
where
    F: Fn(usize, usize, &str),
{
    let database_folder = database_file_path
        .parent()
        .ok_or_else(|| "Database folder is unavailable for manual import recovery.".to_string())?;
    let mut session = load_session(database_folder, session_id)?;
    if !session.manifest.state.is_undoable() {
        return Err(format!(
            "Manual Import session {} is not undoable in state {:?}.",
            session_id, session.manifest.state
        ));
    }

    session.manifest.state = ManualImportRecoveryState::Undoing;
    session.manifest.updated_at = now_iso();
    write_manifest_atomic(&session.directory, &session.manifest)?;

    let mut grouped = BTreeMap::<String, Vec<ManualImportRecoveryChange>>::new();
    for change in &session.changes {
        grouped
            .entry(change.symbol.clone())
            .or_default()
            .push(change.clone());
    }

    let total_symbols = grouped.len();
    let mut reverted_inserted_rows = 0_usize;
    let mut restored_overwritten_rows = 0_usize;
    let mut already_reverted_rows = 0_usize;
    let mut conflicts = 0_usize;

    for (index, (symbol, changes)) in grouped.into_iter().enumerate() {
        on_progress(index, total_symbols, &symbol);
        let bin_path = database_folder
            .join("eod_data")
            .join(&session.manifest.exchange)
            .join(format!("{}.eod", symbol));
        repair_interrupted_replace(&bin_path, session_id)?;
        let mut current = load_normalized_records_by_date(&bin_path)?;
        let mut modified = false;

        for change in changes {
            match change.action {
                ManualImportChangeAction::Insert => match current.get(&change.after.date) {
                    Some(value) if *value == change.after => {
                        current.remove(&change.after.date);
                        reverted_inserted_rows += 1;
                        modified = true;
                    }
                    None => already_reverted_rows += 1,
                    Some(_) => conflicts += 1,
                },
                ManualImportChangeAction::Overwrite => {
                    let before = change.before.as_ref().ok_or_else(|| {
                        format!(
                            "Manual Import recovery session {} has an overwrite row without a before-image.",
                            session_id
                        )
                    })?;
                    match current.get(&change.after.date) {
                        Some(value) if *value == change.after => {
                            current.insert(change.after.date, before.clone());
                            restored_overwritten_rows += 1;
                            modified = true;
                        }
                        Some(value) if *value == *before => already_reverted_rows += 1,
                        _ => conflicts += 1,
                    }
                }
            }
        }

        if modified {
            write_normalized_records_recoverably(
                &bin_path,
                &symbol,
                &session.manifest.exchange,
                current,
                session_id,
            )?;
        }
        on_progress(index + 1, total_symbols, &symbol);
    }

    let (removed_instruments, preserved_instruments) = rollback_created_instruments(
        connection,
        database_folder,
        &session.manifest.exchange,
        &session.manifest.created_instruments,
    )?;

    let now = now_iso();
    if conflicts == 0 {
        session.manifest.state = ManualImportRecoveryState::Undone;
        session.manifest.undone_at = Some(now.clone());
        session.manifest.error_summary = None;
    } else {
        session.manifest.state = ManualImportRecoveryState::PartialConflict;
        session.manifest.error_summary = Some(format!(
            "Undo preserved {} record(s) because their current values no longer match the imported after-image.",
            conflicts
        ));
    }
    session.manifest.updated_at = now;
    write_manifest_atomic(&session.directory, &session.manifest)?;

    Ok(ManualImportUndoResult {
        success: conflicts == 0,
        session_id: session_id.to_string(),
        reverted_inserted_rows,
        restored_overwritten_rows,
        already_reverted_rows,
        conflicts,
        removed_instruments,
        preserved_instruments,
        message: if conflicts == 0 {
            format!(
                "Manual Import {} was undone. Removed {} inserted row(s), restored {} overwritten row(s), removed {} session-created symbol(s).",
                session_id, reverted_inserted_rows, restored_overwritten_rows, removed_instruments
            )
        } else {
            format!(
                "Manual Import {} was partially undone with {} conflict(s). Conflicting rows were preserved for review.",
                session_id, conflicts
            )
        },
    })
}

fn recovery_state_label(state: &ManualImportRecoveryState) -> &'static str {
    match state {
        ManualImportRecoveryState::Prepared => "PREPARED",
        ManualImportRecoveryState::Applying => "APPLYING",
        ManualImportRecoveryState::Applied => "APPLIED",
        ManualImportRecoveryState::Failed => "FAILED",
        ManualImportRecoveryState::Undoing => "UNDOING",
        ManualImportRecoveryState::Undone => "UNDONE",
        ManualImportRecoveryState::PartialConflict => "PARTIAL_CONFLICT",
        ManualImportRecoveryState::RecoveryError => "RECOVERY_ERROR",
    }
}

fn summary_from_manifest(manifest: &ManualImportRecoveryManifest) -> ManualImportRecoverySummary {
    ManualImportRecoverySummary {
        session_id: manifest.session_id.clone(),
        status: recovery_state_label(&manifest.state).to_string(),
        exchange: manifest.exchange.clone(),
        duplicate_mode: manifest.duplicate_mode.clone(),
        storage_mode: manifest.storage_mode.clone(),
        created_at: manifest.created_at.clone(),
        completed_at: manifest.completed_at.clone(),
        undone_at: manifest.undone_at.clone(),
        file_count: manifest.source_files.len(),
        source_files: manifest
            .source_files
            .iter()
            .map(|value| value.path.clone())
            .collect(),
        rows_read: manifest.rows_read,
        rows_inserted: manifest.rows_inserted,
        rows_skipped: manifest.rows_skipped,
        rows_error: manifest.rows_error,
        symbol_count: manifest.symbol_count,
        date_from: manifest.date_from.clone(),
        date_to: manifest.date_to.clone(),
        planned_changes: manifest.journal_row_count,
        created_instruments: manifest.created_instruments.len(),
        undoable: manifest.state.is_undoable(),
        error_summary: manifest.error_summary.clone(),
    }
}

fn rollback_created_instruments(
    connection: &Connection,
    database_folder: &Path,
    exchange: &str,
    symbols: &[String],
) -> AppResult<(usize, usize)> {
    let mut removed = 0_usize;
    let mut preserved = 0_usize;
    let referenced_symbols = load_symbol_reference_set(connection, exchange)?;
    for symbol in symbols {
        let bin_path = database_folder
            .join("eod_data")
            .join(exchange)
            .join(format!("{}.eod", symbol));
        let has_binary_quotes = if bin_path.exists() {
            BinaryEodFile::open(&bin_path)
                .map(|file| file.header.record_count > 0)
                .unwrap_or(true)
        } else {
            false
        };
        if has_binary_quotes || has_sqlite_prices(connection, symbol, exchange)? {
            preserved += 1;
            continue;
        }
        let instrument_exists = connection
            .query_row(
                "SELECT 1 FROM instruments WHERE symbol = ? AND exchange = ? LIMIT 1",
                params![symbol, exchange],
                |_| Ok(true),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .unwrap_or(false);
        if !instrument_exists {
            continue;
        }
        if referenced_symbols.contains(&symbol.trim().to_uppercase()) {
            preserved += 1;
            continue;
        }

        let deleted = connection
            .execute(
                "
                DELETE FROM instruments
                WHERE symbol = ?
                  AND exchange = ?
                  AND UPPER(TRIM(COALESCE(name, ''))) = UPPER(TRIM(symbol))
                  AND UPPER(COALESCE(series, '')) = 'EQ'
                  AND NULLIF(TRIM(COALESCE(series_as_of_date, '')), '') IS NULL
                  AND NULLIF(TRIM(COALESCE(isin, '')), '') IS NULL
                  AND NULLIF(TRIM(COALESCE(bse_security_code, '')), '') IS NULL
                  AND NULLIF(TRIM(COALESCE(sector, '')), '') IS NULL
                  AND NULLIF(TRIM(COALESCE(industry, '')), '') IS NULL
                  AND COALESCE(is_active, 1) = 1
                  AND UPPER(TRIM(COALESCE(lifecycle_status, 'CURRENT'))) = 'CURRENT'
                ",
                params![symbol, exchange],
            )
            .map_err(|error| error.to_string())?;
        if deleted > 0 {
            removed += 1;
        } else {
            preserved += 1;
        }
    }
    Ok((removed, preserved))
}

fn has_sqlite_prices(connection: &Connection, symbol: &str, exchange: &str) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT 1 FROM eod_prices WHERE symbol = ? AND exchange = ? LIMIT 1",
            params![symbol, exchange],
            |_| Ok(true),
        )
        .optional()
        .map(|value| value.unwrap_or(false))
        .map_err(|error| error.to_string())
}

fn load_symbol_reference_set(connection: &Connection, exchange: &str) -> AppResult<HashSet<String>> {
    let mut table_statement = connection
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .map_err(|error| error.to_string())?;
    let tables = table_statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let mut references = HashSet::<String>::new();

    for table in tables {
        if matches!(table.as_str(), "instruments" | "eod_prices") {
            continue;
        }
        let table_identifier = quote_identifier(&table);
        let mut column_statement = connection
            .prepare(&format!("PRAGMA table_info({})", table_identifier))
            .map_err(|error| error.to_string())?;
        let columns = column_statement
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let exchange_column = columns
            .iter()
            .find(|column| column.eq_ignore_ascii_case("exchange"))
            .cloned();
        let symbol_columns = columns
            .iter()
            .filter(|column| is_symbol_reference_column(column))
            .cloned()
            .collect::<Vec<_>>();

        for symbol_column in symbol_columns {
            let sql = if let Some(exchange_column) = exchange_column.as_ref() {
                format!(
                    "SELECT DISTINCT {} FROM {} WHERE NULLIF(TRIM(COALESCE({}, '')), '') IS NOT NULL AND UPPER(TRIM(COALESCE({}, ''))) = UPPER(TRIM(?))",
                    quote_identifier(&symbol_column),
                    table_identifier,
                    quote_identifier(&symbol_column),
                    quote_identifier(exchange_column)
                )
            } else {
                format!(
                    "SELECT DISTINCT {} FROM {} WHERE NULLIF(TRIM(COALESCE({}, '')), '') IS NOT NULL",
                    quote_identifier(&symbol_column),
                    table_identifier,
                    quote_identifier(&symbol_column)
                )
            };
            let mut statement = connection
                .prepare(&sql)
                .map_err(|error| error.to_string())?;
            if exchange_column.is_some() {
                let values = statement
                    .query_map(params![exchange], |row| row.get::<_, String>(0))
                    .map_err(|error| error.to_string())?;
                for value in values {
                    references.insert(value.map_err(|error| error.to_string())?.trim().to_uppercase());
                }
            } else {
                let values = statement
                    .query_map([], |row| row.get::<_, String>(0))
                    .map_err(|error| error.to_string())?;
                for value in values {
                    references.insert(value.map_err(|error| error.to_string())?.trim().to_uppercase());
                }
            }
        }
    }
    Ok(references)
}

fn is_symbol_reference_column(column: &str) -> bool {
    let normalized = column.to_ascii_lowercase();
    normalized == "symbol" || normalized.ends_with("_symbol")
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn load_session(database_folder: &Path, session_id: &str) -> AppResult<LoadedManualImportRecoverySession> {
    let directory = recovery_sessions_root(database_folder).join(session_id);
    if !directory.exists() {
        return Err(format!("Manual Import recovery session {} was not found.", session_id));
    }
    let manifest = read_manifest_with_backup(&directory)?;
    if manifest.schema_version != MANUAL_IMPORT_RECOVERY_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported Manual Import recovery schema '{}' in session {}.",
            manifest.schema_version, session_id
        ));
    }
    let canonical_database = canonical_database_folder(database_folder)?;
    if manifest.database_folder != canonical_database {
        return Err(format!(
            "Manual Import recovery session {} is bound to a different database folder.",
            session_id
        ));
    }
    let journal_path = directory.join(&manifest.journal_file);
    let metadata = fs::metadata(&journal_path).map_err(|error| error.to_string())?;
    if metadata.len() != manifest.journal_byte_length {
        return Err(format!(
            "Manual Import recovery session {} journal length mismatch.",
            session_id
        ));
    }
    let sha256 = sha256_file(&journal_path)?;
    if sha256 != manifest.journal_sha256 {
        return Err(format!(
            "Manual Import recovery session {} journal SHA-256 mismatch.",
            session_id
        ));
    }
    let changes = read_journal_file(&journal_path)?;
    if changes.len() != manifest.journal_row_count {
        return Err(format!(
            "Manual Import recovery session {} journal row-count mismatch.",
            session_id
        ));
    }
    Ok(LoadedManualImportRecoverySession {
        directory,
        manifest,
        changes,
    })
}

fn load_normalized_records_by_date(path: &Path) -> AppResult<BTreeMap<u32, ManualImportRecoveryRecord>> {
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let file = BinaryEodFile::open(path)?;
    let scale = file.header.price_scale.max(1);
    let mut result = BTreeMap::new();
    for record in file.read_all()? {
        if result.contains_key(&record.date) {
            return Err(format!(
                "Binary EOD file {} contains duplicate date {} and cannot be safely journaled for Manual Import recovery.",
                path.display(), record.date
            ));
        }
        result.insert(record.date, normalize_record(record, scale));
    }
    Ok(result)
}

fn normalize_record(record: EodRecord, source_scale: u32) -> ManualImportRecoveryRecord {
    let source = source_scale.max(1) as i128;
    let target = DEFAULT_SCALE as i128;
    let scale_value = |value: i64| -> i64 {
        ((value as i128 * target) / source)
            .clamp(i64::MIN as i128, i64::MAX as i128) as i64
    };
    ManualImportRecoveryRecord {
        date: record.date,
        flags: record.flags,
        open: scale_value(record.open),
        high: scale_value(record.high),
        low: scale_value(record.low),
        close: scale_value(record.close),
        prev_close: scale_value(record.prev_close),
        volume: record.volume,
        oi: record.oi,
    }
}

fn write_normalized_records_recoverably(
    path: &Path,
    symbol: &str,
    exchange: &str,
    records: BTreeMap<u32, ManualImportRecoveryRecord>,
    session_id: &str,
) -> AppResult<()> {
    let backup = backup_path(path, session_id);
    let staged = staged_path(path, session_id);
    repair_interrupted_replace(path, session_id)?;

    if records.is_empty() {
        if staged.exists() {
            fs::remove_file(&staged).map_err(|error| error.to_string())?;
        }
        if path.exists() {
            if backup.exists() {
                fs::remove_file(&backup).map_err(|error| error.to_string())?;
            }
            fs::rename(path, &backup).map_err(|error| error.to_string())?;
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        } else if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let mut values = records
        .into_values()
        .map(EodRecord::from)
        .collect::<Vec<_>>();
    if staged.exists() {
        fs::remove_file(&staged).map_err(|error| error.to_string())?;
    }
    BinaryEodFile::write_all(&staged, symbol, exchange, DEFAULT_SCALE, &mut values)?;

    if path.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        fs::rename(path, &backup).map_err(|error| error.to_string())?;
        if let Err(error) = fs::rename(&staged, path) {
            let _ = fs::rename(&backup, path);
            return Err(format!(
                "Failed to commit Manual Import undo for {}:{}: {}",
                exchange, symbol, error
            ));
        }
        fs::remove_file(&backup).map_err(|error| error.to_string())?;
    } else {
        fs::rename(&staged, path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn repair_interrupted_replace(path: &Path, session_id: &str) -> AppResult<()> {
    let backup = backup_path(path, session_id);
    let staged = staged_path(path, session_id);
    if backup.exists() && !path.exists() {
        fs::rename(&backup, path).map_err(|error| error.to_string())?;
    } else if backup.exists() && path.exists() {
        fs::remove_file(&backup).map_err(|error| error.to_string())?;
    }
    if staged.exists() {
        fs::remove_file(&staged).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn backup_path(path: &Path, session_id: &str) -> PathBuf {
    path.with_file_name(format!(
        "{}.{}.manual-import-undo.bak",
        path.file_name().and_then(|value| value.to_str()).unwrap_or("quotes.eod"),
        sanitize_session_id(session_id)
    ))
}

fn staged_path(path: &Path, session_id: &str) -> PathBuf {
    path.with_file_name(format!(
        "{}.{}.manual-import-undo.new",
        path.file_name().and_then(|value| value.to_str()).unwrap_or("quotes.eod"),
        sanitize_session_id(session_id)
    ))
}

fn sanitize_session_id(session_id: &str) -> String {
    session_id
        .chars()
        .map(|value| if value.is_ascii_alphanumeric() { value } else { '_' })
        .collect()
}

fn write_journal_file(path: &Path, rows: &[ManualImportRecoveryChange]) -> AppResult<(u64, String)> {
    let file = File::create(path).map_err(|error| error.to_string())?;
    let mut writer = BufWriter::new(file);
    let mut hasher = Sha256::new();
    let mut length = 0_u64;
    for row in rows {
        let mut line = serde_json::to_vec(row).map_err(|error| error.to_string())?;
        line.push(b'\n');
        writer.write_all(&line).map_err(|error| error.to_string())?;
        hasher.update(&line);
        length += line.len() as u64;
    }
    writer.flush().map_err(|error| error.to_string())?;
    writer.get_ref().sync_all().map_err(|error| error.to_string())?;
    Ok((length, format!("{:x}", hasher.finalize())))
}

fn read_journal_file(path: &Path) -> AppResult<Vec<ManualImportRecoveryChange>> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut rows = Vec::new();
    for line in reader.lines() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        rows.push(serde_json::from_str(&line).map_err(|error| error.to_string())?);
    }
    Ok(rows)
}

fn write_manifest_atomic(directory: &Path, manifest: &ManualImportRecoveryManifest) -> AppResult<()> {
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let manifest_path = directory.join(MANIFEST_FILE);
    let backup_path = directory.join(MANIFEST_BACKUP_FILE);
    let temp_path = directory.join(MANIFEST_TEMP_FILE);
    let bytes = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    {
        let mut file = File::create(&temp_path).map_err(|error| error.to_string())?;
        file.write_all(&bytes).map_err(|error| error.to_string())?;
        file.flush().map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    if manifest_path.exists() {
        fs::copy(&manifest_path, &backup_path).map_err(|error| error.to_string())?;
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(&backup_path)
            .and_then(|file| file.sync_all())
            .map_err(|error| format!(
                "Unable to durably flush Manual Import recovery manifest backup {}: {}",
                backup_path.display(),
                error
            ))?;
        fs::remove_file(&manifest_path).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp_path, &manifest_path).map_err(|error| error.to_string())?;
    Ok(())
}

fn read_manifest_with_backup(directory: &Path) -> AppResult<ManualImportRecoveryManifest> {
    let primary = directory.join(MANIFEST_FILE);
    let backup = directory.join(MANIFEST_BACKUP_FILE);
    match read_manifest(&primary) {
        Ok(value) => Ok(value),
        Err(primary_error) => read_manifest(&backup).map_err(|backup_error| {
            format!(
                "Unable to read Manual Import recovery manifest: primary {}, backup {}",
                primary_error, backup_error
            )
        }),
    }
}

fn read_manifest(path: &Path) -> AppResult<ManualImportRecoveryManifest> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    serde_json::from_slice(&bytes).map_err(|error| error.to_string())
}

fn hash_source_file(path: &Path) -> AppResult<ManualImportSourceEvidence> {
    let canonical = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let metadata = fs::metadata(&canonical).map_err(|error| error.to_string())?;
    Ok(ManualImportSourceEvidence {
        path: canonical.to_string_lossy().to_string(),
        file_name: canonical
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("file")
            .to_string(),
        byte_length: metadata.len(),
        sha256: sha256_file(&canonical)?,
    })
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn recovery_sessions_root(database_folder: &Path) -> PathBuf {
    database_folder.join(RECOVERY_ROOT).join(RECOVERY_SESSIONS)
}

fn canonical_database_folder(path: &Path) -> AppResult<String> {
    fs::canonicalize(path)
        .map(|value| value.to_string_lossy().to_string())
        .map_err(|error| error.to_string())
}

fn next_session_id() -> String {
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!(
        "manual-import-{}-{}-{}",
        Utc::now().format("%Y%m%dT%H%M%S%.6fZ"),
        process::id(),
        counter
    )
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn binary_date_to_display(date: u32) -> String {
    let value = format!("{:08}", date);
    if value.len() == 8 {
        format!("{}-{}-{}", &value[0..4], &value[4..6], &value[6..8])
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn setup_connection(path: &Path) -> Connection {
        let connection = Connection::open(path).unwrap();
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
                  series_as_of_date TEXT,
                  sector TEXT,
                  industry TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                  updated_at TEXT DEFAULT (datetime('now')),
                  PRIMARY KEY(symbol, exchange)
                );
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  high REAL NOT NULL,
                  low REAL NOT NULL,
                  close REAL NOT NULL,
                  volume INTEGER NOT NULL DEFAULT 0,
                  open_interest INTEGER NOT NULL DEFAULT 0,
                  PRIMARY KEY(symbol, exchange, date)
                );
                CREATE TABLE watchlist_items (watchlist_id INTEGER, symbol TEXT, exchange TEXT);
                CREATE TABLE corporate_actions (id INTEGER, symbol TEXT, exchange TEXT);
                CREATE TABLE instrument_identity_history (
                  id INTEGER,
                  exchange TEXT,
                  current_symbol TEXT,
                  old_symbol TEXT,
                  new_symbol TEXT
                );
                ",
            )
            .unwrap();
        connection
    }

    fn record(date: u32, close: i64) -> EodRecord {
        EodRecord {
            date,
            flags: 0,
            open: close - 10,
            high: close + 20,
            low: close - 30,
            close,
            prev_close: close - 5,
            volume: 100,
            oi: 0,
        }
    }

    #[test]
    fn prepare_and_undo_inserted_binary_rows_and_created_symbol() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        let source = dir.path().join("source.csv");
        fs::write(&source, "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nNEW,20240102,1,1,1,1,1\n").unwrap();
        let mut records = HashMap::new();
        records.insert("NEW".to_string(), vec![record(20240102, 1000)]);

        let mut handle = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source],
            1,
            0,
            &HashSet::from(["NEW".to_string()]),
            &records,
        )
        .unwrap()
        .unwrap();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('NEW','NSE','NEW','EQ')",
                [],
            )
            .unwrap();
        let bin_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&bin_dir).unwrap();
        let mut values = vec![record(20240102, 1000)];
        BinaryEodFile::write_all(bin_dir.join("NEW.eod"), "NEW", "NSE", DEFAULT_SCALE, &mut values).unwrap();
        update_session_state(&mut handle, ManualImportRecoveryState::Applied, Some(1), Some(0), None).unwrap();

        let result = undo_session(&db_path, &connection, &handle.manifest.session_id, |_, _, _| {}).unwrap();
        assert!(result.success);
        assert_eq!(result.reverted_inserted_rows, 1);
        assert_eq!(result.removed_instruments, 1);
        assert!(!bin_dir.join("NEW.eod").exists());
    }

    #[test]
    fn undo_preserves_conflicting_current_row() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        connection.execute("INSERT INTO instruments (symbol, exchange, name, series) VALUES ('KEEP','NSE','KEEP','EQ')", []).unwrap();
        let source = dir.path().join("source.csv");
        fs::write(&source, "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nKEEP,20240102,1,1,1,1,1\n").unwrap();
        let mut records = HashMap::new();
        records.insert("KEEP".to_string(), vec![record(20240102, 1000)]);
        let mut handle = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source],
            1,
            0,
            &HashSet::from(["KEEP".to_string()]),
            &records,
        )
        .unwrap()
        .unwrap();
        let bin_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&bin_dir).unwrap();
        let mut changed = vec![record(20240102, 2000)];
        BinaryEodFile::write_all(bin_dir.join("KEEP.eod"), "KEEP", "NSE", DEFAULT_SCALE, &mut changed).unwrap();
        update_session_state(&mut handle, ManualImportRecoveryState::Applied, Some(1), Some(0), None).unwrap();

        let result = undo_session(&db_path, &connection, &handle.manifest.session_id, |_, _, _| {}).unwrap();
        assert!(!result.success);
        assert_eq!(result.conflicts, 1);
        let current = BinaryEodFile::open(bin_dir.join("KEEP.eod")).unwrap().read_all().unwrap();
        assert_eq!(current[0].close, 2000);
    }
    #[test]
    fn undo_restores_overwritten_before_image() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('KEEP','NSE','KEEP','EQ')",
                [],
            )
            .unwrap();
        let bin_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&bin_dir).unwrap();
        let before_record = record(20240102, 900);
        let mut before_values = vec![before_record];
        BinaryEodFile::write_all(
            bin_dir.join("KEEP.eod"),
            "KEEP",
            "NSE",
            DEFAULT_SCALE,
            &mut before_values,
        )
        .unwrap();

        let source = dir.path().join("source.csv");
        fs::write(
            &source,
            "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nKEEP,20240102,1,1,1,1,1\n",
        )
        .unwrap();
        let after_record = record(20240102, 1000);
        let mut records = HashMap::new();
        records.insert("KEEP".to_string(), vec![after_record]);
        let mut handle = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "overwrite",
            &[source],
            1,
            0,
            &HashSet::from(["KEEP".to_string()]),
            &records,
        )
        .unwrap()
        .unwrap();
        let mut after_values = vec![after_record];
        BinaryEodFile::write_all(
            bin_dir.join("KEEP.eod"),
            "KEEP",
            "NSE",
            DEFAULT_SCALE,
            &mut after_values,
        )
        .unwrap();
        update_session_state(
            &mut handle,
            ManualImportRecoveryState::Applied,
            Some(1),
            Some(0),
            None,
        )
        .unwrap();

        let result = undo_session(
            &db_path,
            &connection,
            &handle.manifest.session_id,
            |_, _, _| {},
        )
        .unwrap();
        assert!(result.success);
        assert_eq!(result.restored_overwritten_rows, 1);
        let restored = BinaryEodFile::open(bin_dir.join("KEEP.eod"))
            .unwrap()
            .read_all()
            .unwrap();
        assert_eq!(restored, vec![before_record]);
    }

    #[test]
    fn undo_preserves_session_created_symbol_when_identity_history_references_it() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        let source = dir.path().join("source.csv");
        fs::write(
            &source,
            "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nNEW,20240102,1,1,1,1,1\n",
        )
        .unwrap();
        let mut records = HashMap::new();
        records.insert("NEW".to_string(), vec![record(20240102, 1000)]);
        let mut handle = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source],
            1,
            0,
            &HashSet::from(["NEW".to_string()]),
            &records,
        )
        .unwrap()
        .unwrap();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('NEW','NSE','NEW','EQ')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO instrument_identity_history (id, exchange, old_symbol) VALUES (1, 'NSE', 'NEW')",
                [],
            )
            .unwrap();
        let bin_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&bin_dir).unwrap();
        let mut values = vec![record(20240102, 1000)];
        BinaryEodFile::write_all(
            bin_dir.join("NEW.eod"),
            "NEW",
            "NSE",
            DEFAULT_SCALE,
            &mut values,
        )
        .unwrap();
        update_session_state(
            &mut handle,
            ManualImportRecoveryState::Applied,
            Some(1),
            Some(0),
            None,
        )
        .unwrap();

        let result = undo_session(
            &db_path,
            &connection,
            &handle.manifest.session_id,
            |_, _, _| {},
        )
        .unwrap();
        assert!(result.success);
        assert_eq!(result.removed_instruments, 0);
        assert_eq!(result.preserved_instruments, 1);
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM instruments WHERE symbol='NEW' AND exchange='NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn interrupted_undo_state_remains_retryable() {
        assert!(ManualImportRecoveryState::Undoing.is_undoable());
        assert!(ManualImportRecoveryState::RecoveryError.is_undoable());
    }

    #[test]
    fn list_session_summaries_returns_all_sessions_newest_first() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('KEEP','NSE','KEEP','EQ')",
                [],
            )
            .unwrap();

        let source_one = dir.path().join("source-one.csv");
        let source_two = dir.path().join("source-two.csv");
        fs::write(
            &source_one,
            "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nKEEP,20240102,1,1,1,1,1\n",
        )
        .unwrap();
        fs::write(
            &source_two,
            "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nKEEP,20240103,1,1,1,1,1\n",
        )
        .unwrap();

        let mut first_records = HashMap::new();
        first_records.insert("KEEP".to_string(), vec![record(20240102, 1000)]);
        let mut first = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source_one],
            1,
            0,
            &HashSet::from(["KEEP".to_string()]),
            &first_records,
        )
        .unwrap()
        .unwrap();
        update_session_state(
            &mut first,
            ManualImportRecoveryState::Undone,
            Some(1),
            Some(0),
            None,
        )
        .unwrap();

        let mut second_records = HashMap::new();
        second_records.insert("KEEP".to_string(), vec![record(20240103, 1100)]);
        let mut second = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source_two],
            1,
            0,
            &HashSet::from(["KEEP".to_string()]),
            &second_records,
        )
        .unwrap()
        .unwrap();
        update_session_state(
            &mut second,
            ManualImportRecoveryState::Applied,
            Some(1),
            Some(0),
            None,
        )
        .unwrap();

        let history = list_session_summaries(dir.path()).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].session_id, second.manifest.session_id);
        assert_eq!(history[0].status, "APPLIED");
        assert_eq!(history[1].session_id, first.manifest.session_id);
        assert_eq!(history[1].status, "UNDONE");
    }

    #[test]
    fn metadata_only_session_can_undo_session_created_placeholder() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("data.db");
        let connection = setup_connection(&db_path);
        let source = dir.path().join("source.csv");
        fs::write(
            &source,
            "SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\nNEW,20240102,1,1,1,1,1\n",
        )
        .unwrap();
        let records = HashMap::<String, Vec<EodRecord>>::new();
        let mut handle = prepare_binary_import_session(
            &db_path,
            &connection,
            "NSE",
            "skip",
            &[source],
            1,
            1,
            &HashSet::from(["NEW".to_string()]),
            &records,
        )
        .unwrap()
        .unwrap();
        assert_eq!(handle.manifest.journal_row_count, 0);
        assert_eq!(handle.manifest.created_instruments, vec!["NEW".to_string()]);
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, name, series) VALUES ('NEW','NSE','NEW','EQ')",
                [],
            )
            .unwrap();
        update_session_state(
            &mut handle,
            ManualImportRecoveryState::Applied,
            Some(0),
            Some(0),
            None,
        )
        .unwrap();

        let result = undo_session(
            &db_path,
            &connection,
            &handle.manifest.session_id,
            |_, _, _| {},
        )
        .unwrap();
        assert!(result.success);
        assert_eq!(result.removed_instruments, 1);
    }

}

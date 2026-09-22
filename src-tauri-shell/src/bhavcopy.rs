use crate::bhavcopy_recovery::{
    checkpoint_buffered_append_newest_files, create_prepared_session, handle_from_loaded,
    load_pending_sessions, publish_recovery_binary_state, remove_checkpointed_session,
    restore_buffered_binary_baselines,
    update_session_state, LoadedRecoverySession, RecoveryBinaryBaseline,
    RecoveryBinaryBaselineKind, RecoveryJobSummary, RecoveryJournalRow, RecoverySessionHandle,
    RecoverySessionSpec, RecoverySessionState, MAX_BUFFERED_CHECKPOINT_WORKERS,
};
use crate::database::binary_eod::{
    date_to_u32, BinaryAppendMergeStats, BinaryAppendNewestHint, BinaryEodFile,
    BinaryWriteDiagnostics, BinaryWriteDurability, BinaryWritePath, EodRecord, DEFAULT_SCALE,
    HEADER_SIZE, RECORD_SIZE,
};
use crate::database::eod_binary_state::{
    modified_time_ns as eod_binary_state_modified_time_ns, BinaryStateIndex, BinaryStateKey,
    VerifiedBinaryState,
};
use crate::database::{
    emit_database_changed, get_active_database_file_path, get_app_snapshot_internal,
    get_price_storage_mode, invalidate_cached_db_stats, prepare_database_connection,
    PriceStorageMode, SnapshotOptions,
};
use crate::runtime::log_runtime_event;
use chrono::{Datelike, Duration, Local, NaiveDate, Timelike, Weekday};
use csv::{ReaderBuilder, WriterBuilder};
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, REFERER, USER_AGENT};
use reqwest::Url;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex, MutexGuard, OnceLock};
use std::thread;
use std::time::{Duration as StdDuration, Instant};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

type AppResult<T> = Result<T, String>;

const SETTINGS_KEY: &str = "bhavcopy_settings";
const NSE_BASE_URL: &str = "https://www.nseindia.com";
const NSE_INDEX_HISTORY_PAGE_URL: &str =
    "https://www.nseindia.com/reports-indices-historical-index-data";
const NSE_INDEX_HISTORY_API_URL: &str = "https://www.nseindia.com/api/historicalOR/indicesHistory";
const BSE_BASE_URL: &str = "https://www.bseindia.com";
const BSE_INDEX_ARCHIVE_API_URL: &str =
    "https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAllPar/w";
const BSE_INDEX_ARCHIVE_PAGE_URL: &str = "https://www.bseindia.com/indices/IndexArchiveData.html";
const EXCHANGE_UDIFF_START: &str = "2024-07-08";
const BSE_INDEX_VOLUME_CRORE_UNITS: f64 = 10_000_000.0;
const DEFAULT_SINGLE_EXCLUDED_SERIES: [&str; 2] = ["GS", "GB"];
const DEFAULT_EXCLUDED_SERIES: [&str; 8] = ["GS", "GB", "GF", "GT", "GBD", "GBI", "GSD", "GSI"];
const NSE_FULL_HISTORY_START: &str = "1994-11-03";
const NSE_INDEX_FULL_HISTORY_START: &str = "1990-07-03";
const BSE_FULL_HISTORY_START: &str = "1990-01-01";
const BSE_INDEX_FULL_HISTORY_START: &str = "1990-01-01";
const NSE_SPECIAL_TRADING_DAYS: &[(&str, &str)] = &[
    ("2023-11-12", "Muhurat Trading"),
    ("2024-01-20", "Special live trading session"),
    (
        "2024-03-02",
        "Disaster-recovery special live trading session",
    ),
    (
        "2024-05-18",
        "Disaster-recovery special live trading session",
    ),
    ("2024-11-01", "Muhurat Trading"),
    ("2025-02-01", "Union Budget live trading session"),
    ("2025-10-21", "Muhurat Trading"),
    ("2026-02-01", "Union Budget live trading session"),
    ("2026-11-08", "Muhurat Trading"),
];
const BSE_SPECIAL_TRADING_DAYS: &[(&str, &str)] = &[
    ("2023-11-12", "Muhurat Trading"),
    ("2024-01-20", "Special live trading session"),
    (
        "2024-03-02",
        "Disaster-recovery special live trading session",
    ),
    (
        "2024-05-18",
        "Disaster-recovery special live trading session",
    ),
    ("2024-11-01", "Muhurat Trading"),
    ("2025-02-01", "Union Budget live trading session"),
    ("2025-10-21", "Muhurat Trading"),
    ("2026-02-01", "Union Budget live trading session"),
    ("2026-11-08", "Muhurat Trading"),
];
const BINARY_PREFILTER_RECONCILE_MAX_DATES: usize = 31;
const MAX_BHAVCOPY_BINARY_WORKERS: usize = 2;
const MAX_BHAVCOPY_PREFILTER_WORKERS: usize = 4;
const UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR: u32 = 18;
static BHAVCOPY_CHECKPOINT_LIFECYCLE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

const BHAVCOPY_STATE_SHADOW_SAMPLE_LIMIT: usize = 8;
const BHAVCOPY_BASELINE_FAST_PATH_SAMPLE_LIMIT: usize = 8;

#[derive(Clone, Debug, PartialEq, Eq)]
struct PhysicalRecoveryPreState {
    existed_before: bool,
    record_count: u32,
    price_scale: u32,
    file_length: u64,
    last_date: Option<u32>,
    file_mtime_ns: Option<i64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum BhavcopyStateShadowComparison {
    Matched,
    Mismatched(String),
    Unavailable,
}

#[derive(Clone, Debug, Default)]
struct BhavcopyStateShadowStats {
    index_available: bool,
    bootstrap_complete: bool,
    index_healthy: bool,
    indexed_rows: usize,
    compared: usize,
    matched: usize,
    mismatched: usize,
    unavailable: usize,
    mismatch_samples: Vec<String>,
    index_error: Option<String>,
}

impl BhavcopyStateShadowStats {
    fn record(&mut self, exchange: &str, symbol: &str, comparison: BhavcopyStateShadowComparison) {
        match comparison {
            BhavcopyStateShadowComparison::Matched => {
                self.compared += 1;
                self.matched += 1;
            }
            BhavcopyStateShadowComparison::Mismatched(reason) => {
                self.compared += 1;
                self.mismatched += 1;
                if self.mismatch_samples.len() < BHAVCOPY_STATE_SHADOW_SAMPLE_LIMIT {
                    self.mismatch_samples
                        .push(format!("{exchange}:{symbol} {reason}"));
                }
            }
            BhavcopyStateShadowComparison::Unavailable => {
                self.unavailable += 1;
            }
        }
    }

    fn summary(&self) -> String {
        format!(
            "index available={}; bootstrap complete={}; healthy={}; indexed rows={}; compared={}; matched={}; mismatched={}; unavailable={}",
            self.index_available,
            self.bootstrap_complete,
            self.index_healthy,
            self.indexed_rows,
            self.compared,
            self.matched,
            self.mismatched,
            self.unavailable
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct BhavcopyBaselineFileIdentity {
    relative_path: String,
    file_length: u64,
    file_mtime_ns: Option<i64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum BhavcopyBaselineFastPathFallback {
    IndexUnavailable,
    IndexUnhealthy,
    MissingVerifiedRow,
    StateGenerationMismatch,
    RelativePathMismatch,
    StateShapeMismatch,
    FileLengthMismatch,
    ModifiedTimeUnavailable,
    ModifiedTimeMismatch,
}

impl BhavcopyBaselineFastPathFallback {
    fn label(&self) -> &'static str {
        match self {
            Self::IndexUnavailable => "index unavailable",
            Self::IndexUnhealthy => "index unhealthy",
            Self::MissingVerifiedRow => "missing VERIFIED row",
            Self::StateGenerationMismatch => "state generation mismatch",
            Self::RelativePathMismatch => "relative path mismatch",
            Self::StateShapeMismatch => "state shape mismatch",
            Self::FileLengthMismatch => "file length mismatch",
            Self::ModifiedTimeUnavailable => "modified time unavailable",
            Self::ModifiedTimeMismatch => "modified time mismatch",
        }
    }

    fn is_metadata_mismatch(&self) -> bool {
        matches!(
            self,
            Self::FileLengthMismatch | Self::ModifiedTimeUnavailable | Self::ModifiedTimeMismatch
        )
    }

    fn is_state_mismatch(&self) -> bool {
        matches!(
            self,
            Self::StateGenerationMismatch | Self::RelativePathMismatch | Self::StateShapeMismatch
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum BhavcopyBaselineFastPathDecision {
    Trusted,
    Fallback(BhavcopyBaselineFastPathFallback),
}

#[derive(Clone, Debug, Default)]
struct BhavcopyBaselineFastPathStats {
    index_available: bool,
    bootstrap_complete: bool,
    index_healthy: bool,
    indexed_rows: usize,
    index_generation: i64,
    candidates: usize,
    eligible: usize,
    fast: usize,
    fallback: usize,
    missing_physical: usize,
    missing_rows: usize,
    metadata_mismatch: usize,
    state_mismatch: usize,
    index_untrusted: usize,
    physical_opens: usize,
    fallback_samples: Vec<String>,
    index_error: Option<String>,
}

impl BhavcopyBaselineFastPathStats {
    fn record_fallback(
        &mut self,
        exchange: &str,
        symbol: &str,
        reason: BhavcopyBaselineFastPathFallback,
    ) {
        self.fallback += 1;
        match reason {
            BhavcopyBaselineFastPathFallback::MissingVerifiedRow => self.missing_rows += 1,
            BhavcopyBaselineFastPathFallback::IndexUnavailable
            | BhavcopyBaselineFastPathFallback::IndexUnhealthy => self.index_untrusted += 1,
            _ if reason.is_metadata_mismatch() => self.metadata_mismatch += 1,
            _ if reason.is_state_mismatch() => self.state_mismatch += 1,
            _ => {}
        }

        if self.fallback_samples.len() < BHAVCOPY_BASELINE_FAST_PATH_SAMPLE_LIMIT {
            self.fallback_samples
                .push(format!("{exchange}:{symbol} {}", reason.label()));
        }
    }

    fn summary(&self) -> String {
        format!(
            "index available={}; bootstrap complete={}; healthy={}; generation={}; indexed rows={}; candidates={}; eligible={}; fast={}; fallback={}; missing physical={}; missing rows={}; metadata mismatch={}; state mismatch={}; index untrusted={}; physical opens={}",
            self.index_available,
            self.bootstrap_complete,
            self.index_healthy,
            self.index_generation,
            self.indexed_rows,
            self.candidates,
            self.eligible,
            self.fast,
            self.fallback,
            self.missing_physical,
            self.missing_rows,
            self.metadata_mismatch,
            self.state_mismatch,
            self.index_untrusted,
            self.physical_opens
        )
    }
}

#[derive(Clone, Debug, Default)]
struct BhavcopyAppendNewestFastHintStats {
    index_available: bool,
    bootstrap_complete: bool,
    index_healthy: bool,
    index_generation: i64,
    indexed_rows: usize,
    candidates: usize,
    hinted: usize,
    fallback: usize,
    missing_rows: usize,
    state_mismatch: usize,
    index_untrusted: usize,
    fallback_samples: Vec<String>,
    index_error: Option<String>,
}

impl BhavcopyAppendNewestFastHintStats {
    fn record_fallback(&mut self, exchange: &str, symbol: &str, reason: &str) {
        self.fallback += 1;
        if self.fallback_samples.len() < BHAVCOPY_BASELINE_FAST_PATH_SAMPLE_LIMIT {
            self.fallback_samples
                .push(format!("{exchange}:{symbol} {reason}"));
        }
    }
}

fn expected_eod_relative_path(exchange: &str, symbol: &str) -> String {
    format!("eod_data/{exchange}/{symbol}.eod")
}

fn classify_recovery_baseline_fast_path(
    index_available: bool,
    index_healthy: bool,
    index_generation: i64,
    physical: &BhavcopyBaselineFileIdentity,
    indexed: Option<&VerifiedBinaryState>,
) -> BhavcopyBaselineFastPathDecision {
    if !index_available {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::IndexUnavailable,
        );
    }
    if !index_healthy {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::IndexUnhealthy,
        );
    }

    let Some(indexed) = indexed else {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::MissingVerifiedRow,
        );
    };

    if indexed.state_generation != index_generation {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::StateGenerationMismatch,
        );
    }
    if indexed.relative_path != physical.relative_path {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::RelativePathMismatch,
        );
    }

    let expected_payload = (indexed.record_count as u64).checked_mul(RECORD_SIZE as u64);
    let expected_length =
        expected_payload.and_then(|payload| (HEADER_SIZE as u64).checked_add(payload));
    let valid_date_shape = if indexed.record_count == 0 {
        indexed.first_date.is_none() && indexed.last_date.is_none()
    } else {
        indexed.first_date.is_some() && indexed.last_date.is_some()
    };
    if expected_length != Some(indexed.file_length) || !valid_date_shape {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::StateShapeMismatch,
        );
    }

    if physical.file_length != indexed.file_length {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::FileLengthMismatch,
        );
    }

    let Some(file_mtime_ns) = physical.file_mtime_ns else {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::ModifiedTimeUnavailable,
        );
    };
    if file_mtime_ns != indexed.file_mtime_ns {
        return BhavcopyBaselineFastPathDecision::Fallback(
            BhavcopyBaselineFastPathFallback::ModifiedTimeMismatch,
        );
    }

    BhavcopyBaselineFastPathDecision::Trusted
}

fn recovery_baseline_from_verified_state(
    exchange: String,
    symbol: String,
    target_dates: Vec<u32>,
    first_incoming_date: u32,
    indexed: &VerifiedBinaryState,
) -> RecoveryBinaryBaseline {
    let kind = if indexed
        .last_date
        .map(|date| first_incoming_date > date)
        .unwrap_or(true)
    {
        RecoveryBinaryBaselineKind::AppendNewest
    } else {
        RecoveryBinaryBaselineKind::Conservative
    };

    RecoveryBinaryBaseline {
        exchange,
        symbol,
        kind,
        existed_before: true,
        record_count: indexed.record_count,
        price_scale: indexed.price_scale,
        file_length: indexed.file_length,
        target_dates,
    }
}

fn classify_recovery_state_shadow(
    physical: &PhysicalRecoveryPreState,
    indexed: Option<&VerifiedBinaryState>,
) -> BhavcopyStateShadowComparison {
    let Some(indexed) = indexed else {
        return BhavcopyStateShadowComparison::Unavailable;
    };

    if !physical.existed_before {
        return BhavcopyStateShadowComparison::Mismatched(
            "physical file absent but VERIFIED state row exists".to_string(),
        );
    }

    let mut differences = Vec::new();
    if physical.record_count != indexed.record_count {
        differences.push(format!(
            "record_count physical={} indexed={}",
            physical.record_count, indexed.record_count
        ));
    }
    if physical.price_scale != indexed.price_scale {
        differences.push(format!(
            "price_scale physical={} indexed={}",
            physical.price_scale, indexed.price_scale
        ));
    }
    if physical.file_length != indexed.file_length {
        differences.push(format!(
            "file_length physical={} indexed={}",
            physical.file_length, indexed.file_length
        ));
    }
    if physical.last_date != indexed.last_date {
        differences.push(format!(
            "last_date physical={:?} indexed={:?}",
            physical.last_date, indexed.last_date
        ));
    }

    match physical.file_mtime_ns {
        Some(file_mtime_ns) if file_mtime_ns != indexed.file_mtime_ns => {
            differences.push(format!(
                "file_mtime_ns physical={} indexed={}",
                file_mtime_ns, indexed.file_mtime_ns
            ));
        }
        None if differences.is_empty() => {
            return BhavcopyStateShadowComparison::Unavailable;
        }
        _ => {}
    }

    if differences.is_empty() {
        BhavcopyStateShadowComparison::Matched
    } else {
        BhavcopyStateShadowComparison::Mismatched(differences.join(", "))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub success: bool,
    pub trade_date: String,
    pub exchange: String,
    pub rows_inserted: usize,
    pub max_volume: u64,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeSelection {
    pub nse: bool,
    pub bse: bool,
    pub nse_index: bool,
    pub bse_index: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DownloadMode {
    Range,
    Update,
    FullHistory,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BhavcopySettings {
    pub exchanges: ExchangeSelection,
    pub workers: u32,
    pub excluded_series: Vec<String>,
    pub nse_equity_url_override: Option<String>,
    pub nse_index_url_override: Option<String>,
    pub bse_equity_url_override: Option<String>,
    pub bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredBhavcopySettings {
    exchanges: Option<ExchangeSelection>,
    workers: Option<u32>,
    excluded_series: Option<Vec<String>>,
    nse_equity_url_override: Option<String>,
    nse_index_url_override: Option<String>,
    bse_equity_url_override: Option<String>,
    bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDownloadConfig {
    pub mode: DownloadMode,
    pub exchanges: ExchangeSelection,
    pub start_date: String,
    pub end_date: String,
    pub workers: u32,
    pub excluded_series: Vec<String>,
    pub nse_equity_url_override: Option<String>,
    pub nse_index_url_override: Option<String>,
    pub bse_equity_url_override: Option<String>,
    pub bse_index_url_override: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OperationResult {
    success: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    progress: u32,
    message: String,
}

#[derive(Clone, Debug)]
struct Candidate {
    url: String,
    zipped: bool,
    bse_download_base: Option<&'static str>,
    bse_response_key: Option<&'static str>,
    bse_index_archive_json: bool,
}

impl Candidate {
    fn direct(url: String, zipped: bool) -> Self {
        Self {
            url,
            zipped,
            bse_download_base: None,
            bse_response_key: None,
            bse_index_archive_json: false,
        }
    }

    fn bse_api(url: String, download_base: &'static str, response_key: &'static str) -> Self {
        Self {
            url,
            zipped: false,
            bse_download_base: Some(download_base),
            bse_response_key: Some(response_key),
            bse_index_archive_json: false,
        }
    }

    fn bse_index_archive(url: String) -> Self {
        Self {
            url,
            zipped: false,
            bse_download_base: None,
            bse_response_key: None,
            bse_index_archive_json: true,
        }
    }
}

#[derive(Clone, Debug)]
struct NseIndexHistoryTask {
    index_type: String,
    symbol: String,
    from_date: String,
    to_date: String,
}

#[derive(Clone, Debug)]
struct DownloadTask {
    exchange: String,
    trade_date: String,
    mode: DownloadMode,
    candidates: Vec<Candidate>,
    nse_index_history: Option<NseIndexHistoryTask>,
}

struct StagedDownload {
    task: DownloadTask,
    content: StagedDownloadContent,
}

enum StagedDownloadContent {
    Csv(String),
    NseIndexHistory(NseIndexHistoryNormalizeResult),
}

enum StagedDownloadOutcome {
    Ready(StagedDownload),
    Result(DownloadResult),
}

struct BatchPlan {
    info_messages: Vec<String>,
    calendar_skip_results: Vec<DownloadResult>,
    tasks: Vec<DownloadTask>,
}

#[derive(Default)]
struct ImportedTradeDates {
    dates: HashSet<String>,
    stale_zero_volume_dates: usize,
    metadata_only_dates: usize,
    metadata_lookup_ms: u128,
    binary_reconcile_ms: u128,
    binary_reconcile_files_scanned: usize,
    binary_reconcile_target_dates: usize,
}

struct ParseInsertResult {
    rows_inserted: usize,
    max_volume: u64,
    debug: Option<String>,
}

struct BhavcopyInsertTiming {
    parsed_jobs: usize,
    parsed_rows: usize,
    duplicate_symbol_date_rows: usize,
    duplicate_symbol_date_samples: Vec<String>,
    binary_symbols: usize,
    binary_workers: usize,
    binary_inserted_dates: usize,
    binary_changed_dates: usize,
    binary_unchanged_dates: usize,
    binary_inserted_symbols: usize,
    binary_changed_symbols: usize,
    binary_unchanged_symbols: usize,
    binary_errors: usize,
    binary_diagnostics: BhavcopyBinaryDiagnosticsSummary,
    append_newest_fast_hint_stats: BhavcopyAppendNewestFastHintStats,
    metadata_upsert_ms: u128,
    transaction_commit_ms: u128,
    binary_filter_ms: u128,
    binary_write_ms: u128,
}

#[derive(Clone)]
struct BhavcopyBinaryRecord {
    file_index: usize,
    record: EodRecord,
}

struct BhavcopyBinaryWriteResult {
    error: Option<String>,
    inserted_rows_by_file: Vec<(usize, usize)>,
    stats: BinaryAppendMergeStats,
    diagnostics: BinaryWriteDiagnostics,
}

#[derive(Default)]
struct BhavcopyBinaryWriteStats {
    inserted_dates: usize,
    changed_dates: usize,
    unchanged_dates: usize,
    inserted_symbols: usize,
    changed_symbols: usize,
    unchanged_symbols: usize,
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
    deferred_sync_calls: usize,
    append_newest_fast_trusted: usize,
    append_newest_fast_fast: usize,
    append_newest_fast_fallback: usize,
    append_newest_fast_metadata_changed: usize,
    append_newest_fast_not_newest: usize,
    append_newest_fast_state_mismatch: usize,
    header_classification_reads: usize,
    last_date_classification_reads: usize,
    measured_total_us: u128,
    symbol_total_us: Vec<u128>,
}

#[derive(Default)]
struct BhavcopyBinaryDiagnosticsSummary {
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
    deferred_sync_calls: usize,
    append_newest_fast_trusted: usize,
    append_newest_fast_fast: usize,
    append_newest_fast_fallback: usize,
    append_newest_fast_metadata_changed: usize,
    append_newest_fast_not_newest: usize,
    append_newest_fast_state_mismatch: usize,
    header_classification_reads: usize,
    last_date_classification_reads: usize,
    measured_total_us: u128,
    p50_symbol_us: u128,
    p95_symbol_us: u128,
    max_symbol_us: u128,
}

impl BhavcopyBinaryWriteStats {
    fn record(&mut self, result: &BhavcopyBinaryWriteResult) {
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
        self.deferred_sync_calls += diagnostics.deferred_sync_calls;
        self.append_newest_fast_trusted += diagnostics.append_newest_fast_trusted;
        self.append_newest_fast_fast += diagnostics.append_newest_fast_fast;
        self.append_newest_fast_fallback += diagnostics.append_newest_fast_fallback;
        self.append_newest_fast_metadata_changed += diagnostics.append_newest_fast_metadata_changed;
        self.append_newest_fast_not_newest += diagnostics.append_newest_fast_not_newest;
        self.append_newest_fast_state_mismatch += diagnostics.append_newest_fast_state_mismatch;
        self.header_classification_reads += diagnostics.header_classification_reads;
        self.last_date_classification_reads += diagnostics.last_date_classification_reads;

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

        let inserted_dates = result.stats.inserted_dates.len();
        let changed_dates = result.stats.changed_existing_dates.len();
        let unchanged_dates = result.stats.unchanged_existing_dates.len();

        self.inserted_dates += inserted_dates;
        self.changed_dates += changed_dates;
        self.unchanged_dates += unchanged_dates;

        if inserted_dates > 0 {
            self.inserted_symbols += 1;
        }
        if changed_dates > 0 {
            self.changed_symbols += 1;
        }
        if inserted_dates == 0 && changed_dates == 0 && unchanged_dates > 0 {
            self.unchanged_symbols += 1;
        }
    }

    fn diagnostics_summary(&self) -> BhavcopyBinaryDiagnosticsSummary {
        let mut totals = self.symbol_total_us.clone();
        totals.sort_unstable();
        BhavcopyBinaryDiagnosticsSummary {
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
            deferred_sync_calls: self.deferred_sync_calls,
            append_newest_fast_trusted: self.append_newest_fast_trusted,
            append_newest_fast_fast: self.append_newest_fast_fast,
            append_newest_fast_fallback: self.append_newest_fast_fallback,
            append_newest_fast_metadata_changed: self.append_newest_fast_metadata_changed,
            append_newest_fast_not_newest: self.append_newest_fast_not_newest,
            append_newest_fast_state_mismatch: self.append_newest_fast_state_mismatch,
            header_classification_reads: self.header_classification_reads,
            last_date_classification_reads: self.last_date_classification_reads,
            measured_total_us: self.measured_total_us,
            p50_symbol_us: percentile_us(&totals, 50),
            p95_symbol_us: percentile_us(&totals, 95),
            max_symbol_us: totals.last().copied().unwrap_or(0),
        }
    }
}

fn percentile_us(sorted_values: &[u128], percentile: usize) -> u128 {
    if sorted_values.is_empty() {
        return 0;
    }
    let index = ((sorted_values.len() - 1) * percentile) / 100;
    sorted_values[index]
}

fn format_us_as_ms(value_us: u128) -> String {
    format!("{}.{:03}", value_us / 1_000, value_us % 1_000)
}

#[derive(Clone)]
struct ParsedBhavcopyRow {
    symbol: String,
    instrument_name: String,
    series: String,
    isin: String,
    trade_date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    prev_close: Option<f64>,
    volume: i64,
    oi: i64,
    trades: Option<i64>,
    binary_record: EodRecord,
}

struct ParsedBhavcopyFile {
    exchange: String,
    trade_date: String,
    rows: Vec<ParsedBhavcopyRow>,
    max_volume: u64,
    debug: Option<String>,
}

struct NseIndexHistoryInsertRow {
    symbol: String,
    instrument_name: String,
    trade_date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: u64,
}

struct NseIndexHistoryNormalizeResult {
    rows: Vec<NseIndexHistoryInsertRow>,
    close_only_skipped: usize,
}

struct NseIndexHistoryInsertResult {
    rows_inserted: usize,
    max_volume: u64,
    close_only_skipped: usize,
}

#[derive(Debug, Deserialize)]
struct NseIndexHistoryResponse {
    data: Option<Vec<NseIndexHistoryRow>>,
    error: Option<bool>,
    #[serde(rename = "showMessage")]
    show_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NseIndexHistoryRow {
    #[serde(rename = "EOD_INDEX_NAME")]
    index_name: Option<String>,
    #[serde(rename = "EOD_OPEN_INDEX_VAL")]
    open: Option<f64>,
    #[serde(rename = "EOD_HIGH_INDEX_VAL")]
    high: Option<f64>,
    #[serde(rename = "EOD_LOW_INDEX_VAL")]
    low: Option<f64>,
    #[serde(rename = "EOD_CLOSE_INDEX_VAL")]
    close: Option<f64>,
    #[serde(rename = "HIT_TRADED_QTY")]
    traded_qty: Option<f64>,
    #[serde(rename = "EOD_TIMESTAMP")]
    timestamp: Option<String>,
}

fn skipped_download_result(
    exchange: &str,
    trade_date: &str,
    message: impl Into<String>,
) -> DownloadResult {
    DownloadResult {
        success: true,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: message.into(),
    }
}

fn failed_download_result(
    exchange: &str,
    trade_date: &str,
    message: impl Into<String>,
) -> DownloadResult {
    DownloadResult {
        success: false,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: message.into(),
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BhavcopyDefaultTemplates {
    pub nse_equity: Vec<String>,
    pub nse_index: Vec<String>,
    pub bse_equity: Vec<String>,
    pub bse_index: Vec<String>,
}

#[tauri::command]
pub fn get_bhavcopy_default_templates() -> BhavcopyDefaultTemplates {
    BhavcopyDefaultTemplates {
        nse_equity: vec![
            "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv".to_string(),
            "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{date_key}_F_0000.csv.zip".to_string(),
            "https://archives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip".to_string(),
            "https://nsearchives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip".to_string(),
        ],
        nse_index: vec![
            "https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv".to_string(),
            "https://www.nseindia.com/archives/nseidx/bhav.csv".to_string(),
        ],
        bse_equity: vec![
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=equity&date={date_key}".to_string(),
            "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{date_key}_F_0000.CSV".to_string(),
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP".to_string(),
        ],
        bse_index: vec![
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=IndexSum&date={date_key}".to_string(),
            "https://www.bseindia.com/bsedata/Index_Bhavcopy/INDEXSummary_{ddmmyyyy}.csv".to_string(),
        ],
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketHoliday {
    pub id: i64,
    pub date: String,
    pub name: String,
    pub source: String,
}

#[tauri::command]
pub fn list_market_holidays(app: AppHandle) -> AppResult<Vec<MarketHoliday>> {
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    let mut stmt = connection
        .prepare("SELECT id, date, name, source FROM market_holidays ORDER BY date ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MarketHoliday {
                id: row.get(0)?,
                date: row.get(1)?,
                name: row.get(2)?,
                source: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn add_market_holiday(app: AppHandle, date: String, name: String) -> AppResult<MarketHoliday> {
    if date.len() != 10 || date.as_bytes()[4] != b'-' || date.as_bytes()[7] != b'-' {
        return Err("Holiday date must be in YYYY-MM-DD format.".to_string());
    }
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Holiday name must not be empty.".to_string());
    }
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    connection
        .execute(
            "INSERT INTO market_holidays (date, name, source) VALUES (?, ?, 'USER')",
            params![date, name],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                format!("A holiday already exists for {date}.")
            } else {
                e.to_string()
            }
        })?;
    let id = connection.last_insert_rowid();
    Ok(MarketHoliday {
        id,
        date,
        name,
        source: "USER".to_string(),
    })
}

#[tauri::command]
pub fn delete_market_holiday(app: AppHandle, id: i64) -> AppResult<()> {
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    let deleted = connection
        .execute("DELETE FROM market_holidays WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err(format!("Holiday #{id} not found."));
    }
    Ok(())
}

#[tauri::command]
pub fn get_bhavcopy_settings(app: AppHandle) -> AppResult<BhavcopySettings> {
    let Some(database_file_path) = get_active_database_file_path(&app)? else {
        return Ok(default_settings());
    };
    let connection = open_database_connection(&database_file_path)?;
    let stored = connection
        .query_row(
            "
              SELECT value
              FROM settings
              WHERE key = ?
            ",
            params![SETTINGS_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(stored
        .as_deref()
        .and_then(|raw| serde_json::from_str::<StoredBhavcopySettings>(raw).ok())
        .map(merge_settings_with_defaults)
        .unwrap_or_else(default_settings))
}

#[tauri::command]
pub fn save_bhavcopy_settings(
    app: AppHandle,
    settings: BhavcopySettings,
) -> AppResult<OperationResult> {
    let Some(database_file_path) = get_active_database_file_path(&app)? else {
        return Ok(OperationResult { success: true });
    };
    let connection = open_database_connection(&database_file_path)?;
    let normalized = normalize_settings(settings);
    let raw = serde_json::to_string(&normalized).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
              INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            ",
            params![SETTINGS_KEY, raw],
        )
        .map_err(|error| error.to_string())?;

    Ok(OperationResult { success: true })
}

#[tauri::command]
pub async fn download_bhavcopy(app: AppHandle, date: Option<String>) -> AppResult<DownloadResult> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before downloading bhavcopy data.".to_string())?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        recover_pending_bhavcopy_sessions(&app_handle, &database_file_path)?;
        let trade_date =
            date.unwrap_or_else(|| Local::now().date_naive().format("%Y-%m-%d").to_string());
        let parsed_date = parse_trade_date(&trade_date)?;
        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-start",
            Some(&format!(
                "kind=single exchange=NSE date={trade_date}"
            )),
        );
        let holiday_connection = Connection::open(&database_file_path).map_err(|e| e.to_string())?;
        prepare_database_connection(&holiday_connection)?;
        if let Some(result) = create_calendar_skip_result(&holiday_connection, "NSE", &trade_date, parsed_date.weekday())
        {
            log_runtime_event(
                &app_handle,
                "INFO",
                "bhavcopy-write-complete",
                Some(&format!(
                    "kind=single exchange=NSE date={} rowsInserted={} status=calendar-skip elapsedMs={}",
                    result.trade_date,
                    result.rows_inserted,
                    started_at.elapsed().as_millis()
                )),
            );
            emit_download_result(&app_handle, &result);
            return Ok(result);
        }

        let client = create_http_client()?;
        warm_session(&client, NSE_BASE_URL);

        let settings =
            get_bhavcopy_settings(app_handle.clone()).unwrap_or_else(|_| default_settings());

        let task = DownloadTask {
            exchange: "NSE".to_string(),
            trade_date: trade_date.clone(),
            mode: DownloadMode::Update,
            candidates: generate_nse_candidates(
                parsed_date,
                settings.nse_equity_url_override.as_ref(),
            ),
            nse_index_history: None,
        };
        let write_lock = Mutex::new(());
        let result = process_download_task(
            &client,
            &database_file_path,
            &task,
            &normalize_excluded_series(
                DEFAULT_SINGLE_EXCLUDED_SERIES
                    .iter()
                    .map(|value| (*value).to_string())
                    .collect(),
            ),
            &write_lock,
        )?;

        if result.rows_inserted > 0 {
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

        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-complete",
            Some(&format!(
                "kind=single exchange={} date={} rowsInserted={} success={} elapsedMs={}",
                result.exchange,
                result.trade_date,
                result.rows_inserted,
                result.success,
                started_at.elapsed().as_millis()
            )),
        );
        emit_download_result(&app_handle, &result);
        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn download_bhavcopy_batch(
    app: AppHandle,
    config: BatchDownloadConfig,
) -> AppResult<Vec<DownloadResult>> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before downloading bhavcopy data.".to_string())?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let normalized_config = normalize_batch_config(config)?;
        recover_pending_bhavcopy_sessions(&app_handle, &database_file_path)?;
        let connection = open_database_connection(&database_file_path)?;
        let BatchPlan {
            info_messages,
            calendar_skip_results,
            tasks,
        } = build_batch_plan(&connection, &normalized_config)?;
        drop(connection);
        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-start",
            Some(&format!(
                "kind=batch mode={:?} fromDate={} toDate={} jobs={} calendarSkips={} workers={}",
                normalized_config.mode,
                normalized_config.start_date,
                normalized_config.end_date,
                tasks.len(),
                calendar_skip_results.len(),
                normalized_config.workers
            )),
        );

        let active_trading_days = tasks
            .iter()
            .map(|task| task.trade_date.as_str())
            .collect::<HashSet<_>>()
            .len();
        let source_categories = summarize_source_categories(&tasks);
        for message in info_messages {
            emit_progress(&app_handle, 0, message);
        }
        emit_progress(
            &app_handle,
            0,
            if calendar_skip_results.is_empty() {
                format!("Found {active_trading_days} trading days")
            } else {
                format!(
                    "Found {active_trading_days} active trading days ({} non-trading calendar days logged)",
                    calendar_skip_results.len()
                )
            },
        );
        if !source_categories.is_empty() {
            emit_progress(
                &app_handle,
                0,
                format!("Source categories: {source_categories}"),
            );
        }
        emit_progress(
            &app_handle,
            0,
            format!("Download jobs: {}", tasks.len()),
        );
        for result in &calendar_skip_results {
            emit_download_result(&app_handle, result);
        }

        if tasks.is_empty() {
            let imported_rows = calendar_skip_results
                .iter()
                .map(|result| result.rows_inserted)
                .sum::<usize>();
            log_runtime_event(
                &app_handle,
                "INFO",
                "bhavcopy-write-complete",
                Some(&format!(
                    "kind=batch mode={:?} fromDate={} toDate={} jobs=0 calendarSkips={} rowsInserted={} elapsedMs={}",
                    normalized_config.mode,
                    normalized_config.start_date,
                    normalized_config.end_date,
                    calendar_skip_results.len(),
                    imported_rows,
                    started_at.elapsed().as_millis()
                )),
            );
            return Ok(calendar_skip_results);
        }

        let client = create_http_client()?;
        warm_session(&client, NSE_BASE_URL);
        if tasks.iter().any(|task| task.nse_index_history.is_some()) {
            warm_session(&client, NSE_INDEX_HISTORY_PAGE_URL);
        }
        warm_session(&client, BSE_BASE_URL);
        emit_progress(
            &app_handle,
            0,
            if calendar_skip_results.is_empty() {
                format!("Starting {} download jobs...", tasks.len())
            } else {
                format!(
                    "Starting {} download jobs after logging {} non-trading calendar days...",
                    tasks.len(),
                    calendar_skip_results.len()
                )
            },
        );

        let workers = normalized_config.workers.clamp(1, 10) as usize;
        let mut results = Vec::<DownloadResult>::new();
        let mut staged_downloads = Vec::<StagedDownload>::new();
        let mut completed = 0_usize;
        let total_tasks = tasks.len();
        let task_queue = Arc::new(Mutex::new(VecDeque::from(tasks)));
        let write_lock = Arc::new(Mutex::new(()));
        let (result_tx, result_rx) = mpsc::channel::<StagedDownloadOutcome>();
        let mut worker_handles = Vec::with_capacity(workers);

        for _ in 0..workers {
            let client = client.clone();
            let database_file_path = database_file_path.clone();
            let task_queue = Arc::clone(&task_queue);
            let write_lock = Arc::clone(&write_lock);
            let result_tx = result_tx.clone();
            worker_handles.push(thread::spawn(move || loop {
                let task = {
                    let mut queue = match task_queue.lock() {
                        Ok(queue) => queue,
                        Err(_) => return,
                    };
                    queue.pop_front()
                };
                let Some(task) = task else {
                    return;
                };
                let result = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    stage_download_task(&client, &database_file_path, &task, &write_lock)
                })) {
                    Ok(Ok(result)) => result,
                    Ok(Err(error)) => StagedDownloadOutcome::Result(failed_download_result(
                        &task.exchange,
                        &task.trade_date,
                        error,
                    )),
                    Err(_) => StagedDownloadOutcome::Result(failed_download_result(
                        &task.exchange,
                        &task.trade_date,
                        "Bhavcopy download worker thread panicked.",
                    )),
                };
                if result_tx.send(result).is_err() {
                    return;
                }
            }));
        }
        drop(result_tx);

        for outcome in result_rx {
            completed += 1;
            let progress = ((completed as f64 / total_tasks as f64) * 60.0)
                .round()
                .clamp(0.0, 60.0) as u32;
            match outcome {
                StagedDownloadOutcome::Ready(staged) => {
                    emit_progress(
                        &app_handle,
                        progress,
                        format!(
                            "Staged {completed}/{total_tasks}: [{}] {}",
                            staged.task.exchange, staged.task.trade_date
                        ),
                    );
                    staged_downloads.push(staged);
                }
                StagedDownloadOutcome::Result(result) => {
                    if should_write_download_log(&result) {
                        let connection = open_database_connection(&database_file_path)?;
                        let _write_guard = lock_bhavcopy_write(&write_lock)?;
                        upsert_download_log_entry(&connection, &result)?;
                    }
                    emit_progress(
                        &app_handle,
                        progress,
                        format!(
                            "{completed}/{total_tasks}: [{}] {}",
                            result.exchange, result.trade_date
                        ),
                    );
                    emit_download_result(&app_handle, &result);
                    results.push(result);
                }
            }
        }
        for handle in worker_handles {
            let _ = handle.join();
        }

        staged_downloads.sort_by(|left, right| compare_download_task(&left.task, &right.task));
        let staged_total = staged_downloads.len();
        if staged_total > 0 {
            emit_progress(
                &app_handle,
                60,
                format!("Importing staged download jobs: {staged_total}"),
            );
        }

        let mut staged_csv_downloads = Vec::new();
        let mut staged_other_downloads = Vec::new();
        for staged in staged_downloads {
            if matches!(&staged.content, StagedDownloadContent::Csv(_)) {
                staged_csv_downloads.push(staged);
            } else {
                staged_other_downloads.push(staged);
            }
        }

        if !staged_csv_downloads.is_empty() {
            emit_progress(
                &app_handle,
                70,
                format!(
                    "Importing staged CSV jobs by symbol: {}",
                    staged_csv_downloads.len()
                ),
            );
            let csv_results = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                import_staged_csv_downloads(
                    &app_handle,
                    &database_file_path,
                    staged_csv_downloads,
                    &normalized_config,
                    &write_lock,
                )
            })) {
                Ok(Ok(results)) => results,
                Ok(Err(error)) => vec![failed_download_result("BHAVCOPY", "staged-csv", error)],
                Err(_) => vec![failed_download_result(
                    "BHAVCOPY",
                    "staged-csv",
                    "Bhavcopy staged CSV import worker thread panicked.",
                )],
            };
            for result in csv_results {
                emit_download_result(&app_handle, &result);
                results.push(result);
            }
        }

        let other_total = staged_other_downloads.len();
        for (index, staged) in staged_other_downloads.into_iter().enumerate() {
            let import_number = index + 1;
            let progress = 80
                + ((import_number as f64 / other_total.max(1) as f64) * 19.0)
                    .round()
                    .clamp(0.0, 19.0) as u32;
            emit_progress(
                &app_handle,
                progress.min(99),
                format!(
                    "Importing staged fallback job {import_number}/{other_total}: [{}] {}",
                    staged.task.exchange, staged.task.trade_date
                ),
            );
            let exchange = staged.task.exchange.clone();
            let trade_date = staged.task.trade_date.clone();
            let result = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                import_staged_download(
                    &database_file_path,
                    staged,
                    &normalized_config.excluded_series,
                    &write_lock,
                )
            })) {
                Ok(Ok(result)) => result,
                Ok(Err(error)) => failed_download_result(&exchange, &trade_date, error),
                Err(_) => failed_download_result(
                    &exchange,
                    &trade_date,
                    "Bhavcopy import worker thread panicked.",
                ),
            };
            if !result.success && should_write_download_log(&result) {
                let connection = open_database_connection(&database_file_path)?;
                let _write_guard = lock_bhavcopy_write(&write_lock)?;
                upsert_download_log_entry(&connection, &result)?;
            }
            emit_download_result(&app_handle, &result);
            results.push(result);
        }

        let mut combined_results = calendar_skip_results;
        combined_results.extend(results);
        combined_results.sort_by(compare_download_results);
        let completed_download_jobs = combined_results
            .iter()
            .filter(|result| !is_calendar_skip_result(result))
            .count();
        let non_trading_calendar_days = combined_results
            .iter()
            .filter(|result| is_calendar_skip_result(result))
            .count();
        let imported_rows: usize = combined_results
            .iter()
            .map(|result| result.rows_inserted)
            .sum();
        emit_progress(
            &app_handle,
            100,
            format!(
                "Completed download jobs: {completed_download_jobs}; non-trading calendar days: {non_trading_calendar_days}; imported rows: {imported_rows}"
            ),
        );

        if combined_results.iter().any(|r| r.rows_inserted > 0) {
            let invalidate_stats_started = Instant::now();
            if let Some(folder_path) = database_file_path.parent() {
                invalidate_cached_db_stats(&app_handle, folder_path)?;
            }
            let invalidate_stats_ms = invalidate_stats_started.elapsed().as_millis();

            let snapshot_started = Instant::now();
            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            let snapshot_ms = snapshot_started.elapsed().as_millis();

            let emit_database_changed_started = Instant::now();
            emit_database_changed(&app_handle, &snapshot)?;
            let emit_database_changed_ms = emit_database_changed_started.elapsed().as_millis();

            emit_progress(
                &app_handle,
                100,
                format!(
                    "Bhavcopy refresh timings: invalidate stats {} ms; snapshot {} ms; emit change {} ms",
                    invalidate_stats_ms,
                    snapshot_ms,
                    emit_database_changed_ms
                ),
            );
        }

        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-complete",
            Some(&format!(
                "kind=batch mode={:?} fromDate={} toDate={} jobs={} calendarSkips={} rowsInserted={} elapsedMs={}",
                normalized_config.mode,
                normalized_config.start_date,
                normalized_config.end_date,
                completed_download_jobs,
                non_trading_calendar_days,
                imported_rows,
                started_at.elapsed().as_millis()
            )),
        );
        if imported_rows > 0 {
            spawn_background_bhavcopy_checkpoint(app_handle.clone(), database_file_path.clone());
        }
        Ok(combined_results)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn default_settings() -> BhavcopySettings {
    BhavcopySettings {
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        workers: 2,
        excluded_series: DEFAULT_EXCLUDED_SERIES
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
    }
}

fn merge_settings_with_defaults(stored: StoredBhavcopySettings) -> BhavcopySettings {
    let defaults = default_settings();
    BhavcopySettings {
        exchanges: stored.exchanges.unwrap_or(defaults.exchanges),
        workers: stored.workers.unwrap_or(defaults.workers),
        excluded_series: normalize_excluded_series(
            stored.excluded_series.unwrap_or(defaults.excluded_series),
        ),
        nse_equity_url_override: stored.nse_equity_url_override,
        nse_index_url_override: stored.nse_index_url_override,
        bse_equity_url_override: stored.bse_equity_url_override,
        bse_index_url_override: stored.bse_index_url_override,
    }
}

fn normalize_settings(settings: BhavcopySettings) -> BhavcopySettings {
    BhavcopySettings {
        exchanges: settings.exchanges,
        workers: settings.workers.clamp(1, 10),
        excluded_series: normalize_excluded_series(settings.excluded_series),
        nse_equity_url_override: settings
            .nse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        nse_index_url_override: settings
            .nse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_equity_url_override: settings
            .bse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_index_url_override: settings
            .bse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    }
}

fn normalize_batch_config(config: BatchDownloadConfig) -> AppResult<BatchDownloadConfig> {
    if matches!(config.mode, DownloadMode::Range) {
        parse_trade_date(&config.start_date)?;
        parse_trade_date(&config.end_date)?;
        if config.start_date > config.end_date {
            return Err("Start date must be on or before end date.".to_string());
        }
    }
    Ok(BatchDownloadConfig {
        mode: config.mode,
        exchanges: config.exchanges,
        start_date: config.start_date,
        end_date: config.end_date,
        workers: config.workers.clamp(1, 10),
        excluded_series: normalize_excluded_series(config.excluded_series),
        nse_equity_url_override: config
            .nse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        nse_index_url_override: config
            .nse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_equity_url_override: config
            .bse_equity_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        bse_index_url_override: config
            .bse_index_url_override
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    })
}

fn normalize_excluded_series(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::<String>::new();
    values
        .into_iter()
        .map(|value| value.trim().to_uppercase())
        .filter(|value| !value.is_empty())
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn parse_trade_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| format!("Invalid trade date: {value}"))
}

fn build_batch_plan(connection: &Connection, config: &BatchDownloadConfig) -> AppResult<BatchPlan> {
    let mut info_messages = Vec::<String>::new();
    let mut calendar_skip_results = Vec::<DownloadResult>::new();
    let mut tasks = Vec::<DownloadTask>::new();

    for exchange in selected_exchanges(&config.exchanges) {
        let Some((start_date, end_date)) = resolve_exchange_date_window(
            connection,
            &config.mode,
            &exchange,
            &config.start_date,
            &config.end_date,
            &mut info_messages,
        )?
        else {
            continue;
        };

        let imported_dates =
            storage_mode_load_imported_trade_dates(connection, &exchange, &start_date, &end_date)?;
        if imported_dates.metadata_lookup_ms > 0
            || imported_dates.binary_reconcile_ms > 0
            || imported_dates.binary_reconcile_files_scanned > 0
        {
            info_messages.push(format!(
                "[{}] Prefilter timings: metadata {} ms; binary reconcile {} ms; binary files scanned {}; target dates {}",
                format_exchange_log_label(&exchange),
                imported_dates.metadata_lookup_ms,
                imported_dates.binary_reconcile_ms,
                imported_dates.binary_reconcile_files_scanned,
                imported_dates.binary_reconcile_target_dates
            ));
        }

        let calendar_days = generate_calendar_days(&start_date, &end_date)?;
        let mut skipped_existing_days = 0_usize;

        for trade_date in calendar_days {
            let parsed_date = parse_trade_date(&trade_date)?;
            if let Some(special_name) = special_trading_day_name(&exchange, &trade_date) {
                info_messages.push(format!(
                    "[{}] {}: Special trading day override ({special_name}); treated as trading day",
                    format_exchange_log_label(&exchange),
                    trade_date
                ));
            }
            if let Some(skip_result) = create_calendar_skip_result(
                connection,
                &exchange,
                &trade_date,
                parsed_date.weekday(),
            ) {
                calendar_skip_results.push(skip_result);
                continue;
            }

            if imported_dates.dates.contains(&trade_date) {
                skipped_existing_days += 1;
                continue;
            }

            if exchange == "NSE" {
                tasks.push(DownloadTask {
                    exchange: "NSE".to_string(),
                    trade_date: trade_date.clone(),
                    mode: config.mode.clone(),
                    candidates: generate_nse_candidates(
                        parsed_date,
                        config.nse_equity_url_override.as_ref(),
                    ),
                    nse_index_history: None,
                });
                continue;
            }

            if exchange == "NSE_INDEX" {
                tasks.push(DownloadTask {
                    exchange: "NSE_INDEX".to_string(),
                    trade_date: trade_date.clone(),
                    mode: config.mode.clone(),
                    candidates: generate_nse_index_candidates(
                        parsed_date,
                        config.nse_index_url_override.as_ref(),
                    ),
                    nse_index_history: None,
                });
                continue;
            }

            let candidates = if exchange == "BSE" {
                generate_bse_candidates(parsed_date, config.bse_equity_url_override.as_ref())
            } else {
                generate_bse_index_candidates(parsed_date, config.bse_index_url_override.as_ref())
            };
            tasks.push(DownloadTask {
                exchange: exchange.clone(),
                trade_date,
                mode: config.mode.clone(),
                candidates,
                nse_index_history: None,
            });
        }

        if skipped_existing_days > 0 {
            info_messages.push(format!(
                "[{}] Prefiltered {skipped_existing_days} already imported trading days",
                format_exchange_log_label(&exchange)
            ));
        }
        if imported_dates.stale_zero_volume_dates > 0 {
            info_messages.push(format!(
                "[{}] Scheduled {} previously imported zero-volume trading days for refresh",
                format_exchange_log_label(&exchange),
                imported_dates.stale_zero_volume_dates
            ));
        }
        if imported_dates.metadata_only_dates > 0 {
            info_messages.push(format!(
                "[{}] Scheduled {} metadata-only trading days for refresh because binary files are missing or incomplete",
                format_exchange_log_label(&exchange),
                imported_dates.metadata_only_dates
            ));
        }
    }

    Ok(BatchPlan {
        info_messages,
        calendar_skip_results,
        tasks,
    })
}

fn selected_exchanges(exchanges: &ExchangeSelection) -> Vec<String> {
    let mut selected = Vec::<String>::new();
    if exchanges.nse {
        selected.push("NSE".to_string());
    }
    if exchanges.bse {
        selected.push("BSE".to_string());
    }
    if exchanges.nse_index {
        selected.push("NSE_INDEX".to_string());
    }
    if exchanges.bse_index {
        selected.push("BSE_INDEX".to_string());
    }
    selected
}

fn resolve_exchange_date_window(
    connection: &Connection,
    mode: &DownloadMode,
    exchange: &str,
    requested_start_date: &str,
    requested_end_date: &str,
    info_messages: &mut Vec<String>,
) -> AppResult<Option<(String, String)>> {
    let exchange_label = format_exchange_log_label(exchange);
    match mode {
        DownloadMode::Range => Ok(Some((
            requested_start_date.to_string(),
            requested_end_date.to_string(),
        ))),
        DownloadMode::FullHistory => {
            let start_date = full_history_start_for_exchange(exchange).to_string();
            let end_date = today_trade_date();
            info_messages.push(format!(
                "[{exchange_label}] Full history range: {start_date} to {end_date}"
            ));
            if exchange == "BSE_INDEX" {
                info_messages.push(
                    "[BSE Index] Older index coverage varies by archive availability; missing dates will be skipped."
                        .to_string(),
                );
            }
            Ok(Some((start_date, end_date)))
        }
        DownloadMode::Update => {
            let end_date = update_end_trade_date();
            match storage_mode_get_latest_imported_trade_date(connection, exchange)? {
                Some(latest_imported_date) => {
                    let next_date = parse_trade_date(&latest_imported_date)? + Duration::days(1);
                    if next_date.format("%Y-%m-%d").to_string() > end_date {
                        info_messages.push(format!(
                            "[{exchange_label}] Already up to date through {latest_imported_date}"
                        ));
                        return Ok(None);
                    }
                    let start_date = next_date.format("%Y-%m-%d").to_string();
                    info_messages.push(format!(
                        "[{exchange_label}] Latest imported date: {latest_imported_date}"
                    ));
                    info_messages.push(format!(
                        "[{exchange_label}] Update range: {start_date} to {end_date}"
                    ));
                    Ok(Some((start_date, end_date)))
                }
                None => {
                    let start_date = full_history_start_for_exchange(exchange).to_string();
                    info_messages.push(format!(
                        "[{exchange_label}] No imported history found. Using full history start: {start_date}"
                    ));
                    info_messages.push(format!(
                        "[{exchange_label}] Update range: {start_date} to {end_date}"
                    ));
                    if exchange == "BSE_INDEX" {
                        info_messages.push(
                            "[BSE Index] Older index coverage varies by archive availability; missing dates will be skipped."
                                .to_string(),
                        );
                    }
                    Ok(Some((start_date, end_date)))
                }
            }
        }
    }
}

fn today_trade_date() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

fn update_end_trade_date() -> String {
    let now = Local::now();
    update_end_trade_date_for(now.date_naive(), now.hour())
}

fn update_end_trade_date_for(local_date: NaiveDate, local_hour: u32) -> String {
    let end_date = if local_hour >= UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR {
        local_date
    } else {
        local_date - Duration::days(1)
    };
    end_date.format("%Y-%m-%d").to_string()
}

fn full_history_start_for_exchange(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => NSE_FULL_HISTORY_START,
        "NSEINDEX" => NSE_INDEX_FULL_HISTORY_START,
        "BSE" => BSE_FULL_HISTORY_START,
        "BSEINDEX" => BSE_INDEX_FULL_HISTORY_START,
        _ => BSE_FULL_HISTORY_START,
    }
}

fn format_exchange_log_label(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => "NSE",
        "BSE" => "BSE",
        "NSEINDEX" => "NSE Index",
        "BSEINDEX" => "BSE Index",
        _ => "Unknown",
    }
}

fn format_source_category_label(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => "NSE Equity",
        "BSE" => "BSE Equity",
        "NSEINDEX" => "NSE Index Symbols / Full Index List",
        "BSEINDEX" => "BSE Index",
        _ => "Unknown",
    }
}

fn summarize_source_categories(tasks: &[DownloadTask]) -> String {
    let mut seen = HashSet::<&'static str>::new();
    let mut categories = Vec::<&'static str>::new();
    for task in tasks {
        let label = if task.nse_index_history.is_some() {
            "Full NSE index list unavailable; using limited historical index fallback: NIFTY 50, NIFTY BANK."
        } else {
            format_source_category_label(&task.exchange)
        };
        if seen.insert(label) {
            categories.push(label);
        }
    }
    categories.join(", ")
}

fn generate_calendar_days(start_date: &str, end_date: &str) -> AppResult<Vec<String>> {
    let start = parse_trade_date(start_date)?;
    let end = parse_trade_date(end_date)?;
    let mut current = start;
    let mut days = Vec::new();

    while current <= end {
        days.push(current.format("%Y-%m-%d").to_string());
        current += Duration::days(1);
    }

    Ok(days)
}

#[allow(dead_code)]
fn generate_nse_index_history_tasks(
    start_date: &str,
    end_date: &str,
    mode: &DownloadMode,
) -> AppResult<Vec<DownloadTask>> {
    let start = parse_trade_date(start_date)?;
    let end = parse_trade_date(end_date)?;
    let index_types = [("NIFTY 50", "NIFTY"), ("NIFTY BANK", "BANKNIFTY")];
    let mut tasks = Vec::new();
    let mut chunk_start = start;

    while chunk_start <= end {
        let chunk_end = std::cmp::min(chunk_start + Duration::days(364), end);
        let from_date = chunk_start.format("%Y-%m-%d").to_string();
        let to_date = chunk_end.format("%Y-%m-%d").to_string();

        for (index_type, symbol) in index_types {
            tasks.push(DownloadTask {
                exchange: "NSE_INDEX".to_string(),
                trade_date: format!("{from_date}..{to_date} {symbol}"),
                mode: mode.clone(),
                candidates: Vec::new(),
                nse_index_history: Some(NseIndexHistoryTask {
                    index_type: index_type.to_string(),
                    symbol: symbol.to_string(),
                    from_date: from_date.clone(),
                    to_date: to_date.clone(),
                }),
            });
        }

        chunk_start = chunk_end + Duration::days(1);
    }

    Ok(tasks)
}

fn create_http_client() -> AppResult<Client> {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static(
            "application/json,text/csv,application/zip,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ),
    );
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));
    Client::builder()
        .default_headers(headers)
        .cookie_store(true)
        .timeout(StdDuration::from_secs(30))
        .pool_max_idle_per_host(16)
        .build()
        .map_err(|error| error.to_string())
}

fn warm_session(client: &Client, base_url: &str) {
    if client.get(base_url).send().is_err() {
        thread::sleep(StdDuration::from_millis(150));
    }
}

fn emit_progress(app: &AppHandle, progress: u32, message: String) {
    let _ = app.emit("bhavcopy:progress", ProgressPayload { progress, message });
}

fn emit_download_result(app: &AppHandle, result: &DownloadResult) {
    let _ = app.emit("bhavcopy:result", result.clone());
}

fn stage_download_task(
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    write_lock: &Mutex<()>,
) -> AppResult<StagedDownloadOutcome> {
    let connection = open_database_connection(database_file_path)?;
    let existing_log_id = connection
        .query_row(
            "
              SELECT id
              FROM download_log
              WHERE trade_date = ? AND exchange = ? AND status = 'ok'
              LIMIT 1
            ",
            params![&task.trade_date, &task.exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(log_id) = existing_log_id {
        let has_imported_rows =
            storage_mode_has_imported_rows_for_date(&connection, &task.trade_date, &task.exchange)?;
        let has_stale_zero_volume_rows = storage_mode_has_stale_zero_volume_rows_for_date(
            &connection,
            &task.trade_date,
            &task.exchange,
        )?;

        if has_imported_rows && !has_stale_zero_volume_rows && task.mode != DownloadMode::Range {
            return Ok(StagedDownloadOutcome::Result(DownloadResult {
                success: true,
                trade_date: task.trade_date.clone(),
                exchange: task.exchange.clone(),
                rows_inserted: 0,
                max_volume: 0,
                message: "Already downloaded".to_string(),
            }));
        }
        {
            let _write_guard = lock_bhavcopy_write(write_lock)?;
            let _ = clear_download_log_entry(&connection, log_id);
        }
    }
    drop(connection);

    if let Some(history_task) = &task.nse_index_history {
        return stage_nse_index_history_task(client, task, history_task);
    }

    stage_single_download(client, task)
}

fn stage_nse_index_history_task(
    client: &Client,
    task: &DownloadTask,
    history_task: &NseIndexHistoryTask,
) -> AppResult<StagedDownloadOutcome> {
    let url = build_nse_index_history_url(history_task)?;
    let bytes = fetch_candidate_bytes(client, &url, NSE_INDEX_HISTORY_PAGE_URL, 3)?
        .ok_or_else(|| "No data returned by NSE historical index API".to_string())?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let parsed = serde_json::from_str::<NseIndexHistoryResponse>(&content)
        .map_err(|error| format!("NSE historical index API JSON parse failed: {error}"))?;

    if parsed.error.unwrap_or(false) {
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            parsed
                .show_message
                .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
        )));
    }

    let rows = parsed.data.unwrap_or_default();
    if rows.is_empty() {
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            format!(
                "No NSE historical index API rows for {} {} to {}",
                history_task.index_type, history_task.from_date, history_task.to_date
            ),
        )));
    }

    let normalized =
        normalize_nse_index_history_rows(&rows, &history_task.symbol, &history_task.index_type);
    Ok(StagedDownloadOutcome::Ready(StagedDownload {
        task: task.clone(),
        content: StagedDownloadContent::NseIndexHistory(normalized),
    }))
}

fn candidate_scan_should_skip(
    exchange: &str,
    candidate_count: usize,
    soft_mismatch_count: usize,
    bse_api_reported_no_file: bool,
    has_hard_error: bool,
) -> bool {
    !has_hard_error
        && (soft_mismatch_count == candidate_count
            || (is_bse_exchange(exchange) && bse_api_reported_no_file))
}
fn stage_single_download(client: &Client, task: &DownloadTask) -> AppResult<StagedDownloadOutcome> {
    let mut last_hard_error: Option<String> = None;
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(&task.exchange);
    let mut bse_api_reported_no_file = false;

    for candidate in &task.candidates {
        match fetch_candidate_content_bytes(client, candidate, referer, 3) {
            Ok(Some(bytes)) => {
                let csv_content = if candidate.bse_index_archive_json {
                    match normalize_bse_index_archive_json(&bytes, &task.trade_date)? {
                        Some(content) => content,
                        None => {
                            not_found_count += 1;
                            continue;
                        }
                    }
                } else {
                    let csv_bytes = if candidate.zipped {
                        match extract_first_csv_from_zip(&bytes)? {
                            Some(extracted) => extracted,
                            None => {
                                not_found_count += 1;
                                continue;
                            }
                        }
                    } else {
                        bytes
                    };
                    String::from_utf8_lossy(&csv_bytes).into_owned()
                };
                if is_bse_exchange(&task.exchange) && is_html_response(&csv_content) {
                    not_found_count += 1;
                    continue;
                }
                return Ok(StagedDownloadOutcome::Ready(StagedDownload {
                    task: task.clone(),
                    content: StagedDownloadContent::Csv(csv_content),
                }));
            }
            Ok(None) => {
                if is_bse_exchange(&task.exchange) && candidate.bse_response_key.is_some() {
                    bse_api_reported_no_file = true;
                }
                not_found_count += 1;
            }
            Err(error) => {
                last_hard_error = Some(error);
            }
        }
    }

    if candidate_scan_should_skip(
        &task.exchange,
        task.candidates.len(),
        not_found_count,
        bse_api_reported_no_file,
        last_hard_error.is_some(),
    ) {
        let message = if is_bse_exchange(&task.exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (unavailable archive or source mismatch)",
                task.candidates.len()
            )
        } else {
            "No data available for this date (source unavailable or missing)".to_string()
        };
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            message,
        )));
    }

    Ok(StagedDownloadOutcome::Result(DownloadResult {
        success: false,
        trade_date: task.trade_date.clone(),
        exchange: task.exchange.clone(),
        rows_inserted: 0,
        max_volume: 0,
        message: last_hard_error.unwrap_or_else(|| "Download failed".to_string()),
    }))
}

fn import_staged_download(
    database_file_path: &Path,
    staged: StagedDownload,
    excluded_series: &[String],
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    match staged.content {
        StagedDownloadContent::Csv(csv_content) => {
            let parsed = {
                let _write_guard = lock_bhavcopy_write(write_lock)?;
                parse_and_insert(
                    database_file_path,
                    &csv_content,
                    &staged.task.exchange,
                    &staged.task.trade_date,
                    excluded_series,
                )?
            };
            if parsed.rows_inserted == 0 {
                if let Some(debug) = parsed.debug {
                    return Ok(DownloadResult {
                        success: false,
                        trade_date: staged.task.trade_date,
                        exchange: staged.task.exchange,
                        rows_inserted: 0,
                        max_volume: 0,
                        message: debug,
                    });
                }
            }
            let result = DownloadResult {
                success: true,
                trade_date: staged.task.trade_date,
                exchange: staged.task.exchange,
                rows_inserted: parsed.rows_inserted,
                max_volume: parsed.max_volume,
                message: format!("Imported staged {} records", parsed.rows_inserted),
            };
            if should_write_download_log(&result) {
                let connection = open_database_connection(database_file_path)?;
                let _write_guard = lock_bhavcopy_write(write_lock)?;
                upsert_download_log_entry(&connection, &result)?;
            }
            Ok(result)
        }
        StagedDownloadContent::NseIndexHistory(normalized) => {
            let result = {
                let _write_guard = lock_bhavcopy_write(write_lock)?;
                insert_nse_index_history_rows(
                    database_file_path,
                    &staged.task.exchange,
                    &normalized,
                )?
            };
            let message = if let Some(history_task) = &staged.task.nse_index_history {
                format!(
                    "NSE index API {} {} to {}: {} imported, {} close-only skipped",
                    history_task.symbol,
                    history_task.from_date,
                    history_task.to_date,
                    result.rows_inserted,
                    result.close_only_skipped
                )
            } else {
                format!(
                    "NSE index API staged import: {} imported, {} close-only skipped",
                    result.rows_inserted, result.close_only_skipped
                )
            };

            Ok(DownloadResult {
                success: true,
                trade_date: staged.task.trade_date,
                exchange: staged.task.exchange,
                rows_inserted: result.rows_inserted,
                max_volume: result.max_volume,
                message,
            })
        }
    }
}

fn prepare_bhavcopy_recovery_session(
    database_file_path: &Path,
    config: &BatchDownloadConfig,
    parsed_files: &[ParsedBhavcopyFile],
) -> AppResult<(
    RecoverySessionHandle,
    BhavcopyStateShadowStats,
    BhavcopyBaselineFastPathStats,
)> {
    let database_folder = database_file_path
        .parent()
        .ok_or_else(|| "Active database file has no parent folder.".to_string())?;
    let connection = open_database_connection(database_file_path)?;
    let storage_mode = get_price_storage_mode(&connection);
    drop(connection);

    let mut symbols = HashSet::<(String, String)>::new();
    let mut rows = Vec::<RecoveryJournalRow>::new();
    let mut jobs = Vec::<RecoveryJobSummary>::new();
    for parsed in parsed_files {
        jobs.push(RecoveryJobSummary {
            exchange: parsed.exchange.clone(),
            trade_date: parsed.trade_date.clone(),
            row_count: parsed.rows.len(),
            max_volume: parsed.max_volume,
        });
        for row in &parsed.rows {
            symbols.insert((parsed.exchange.clone(), row.symbol.clone()));
            rows.push(recovery_row_from_parsed(&parsed.exchange, row));
        }
    }

    let binary_workers = if symbols.is_empty() {
        0
    } else {
        bhavcopy_binary_worker_count(symbols.len())
    };
    let (binary_baselines, state_shadow_stats, baseline_fast_path_stats) =
        capture_recovery_binary_baselines(database_folder, parsed_files)?;
    let mut selected_exchanges = Vec::<String>::new();
    if config.exchanges.nse {
        selected_exchanges.push("NSE".to_string());
    }
    if config.exchanges.bse {
        selected_exchanges.push("BSE".to_string());
    }
    if config.exchanges.nse_index {
        selected_exchanges.push("NSE_INDEX".to_string());
    }
    if config.exchanges.bse_index {
        selected_exchanges.push("BSE_INDEX".to_string());
    }

    let session = create_prepared_session(
        database_folder,
        RecoverySessionSpec {
            mode: format!("{:?}", config.mode),
            requested_start_date: config.start_date.clone(),
            requested_end_date: config.end_date.clone(),
            selected_exchanges,
            excluded_series: config.excluded_series.clone(),
            download_workers: config.workers,
            binary_workers,
            price_storage_mode: storage_mode.as_str().to_string(),
            jobs,
            binary_baselines,
            rows,
        },
    )?;

    Ok((session, state_shadow_stats, baseline_fast_path_stats))
}

fn capture_recovery_binary_baselines(
    database_folder: &Path,
    parsed_files: &[ParsedBhavcopyFile],
) -> AppResult<(
    Vec<RecoveryBinaryBaseline>,
    BhavcopyStateShadowStats,
    BhavcopyBaselineFastPathStats,
)> {
    let mut target_dates = HashMap::<(String, String), Vec<u32>>::new();
    for parsed in parsed_files {
        for row in &parsed.rows {
            target_dates
                .entry((parsed.exchange.clone(), row.symbol.clone()))
                .or_default()
                .push(row.binary_record.date);
        }
    }

    let mut shadow_stats = BhavcopyStateShadowStats::default();
    let mut fast_stats = BhavcopyBaselineFastPathStats::default();
    let shadow_rows = match BinaryStateIndex::open_existing_read_only(database_folder) {
        Ok(index) => {
            let status_result = index.status();
            let rows_result = index.load_verified();

            if let Ok(status) = &status_result {
                shadow_stats.index_available = true;
                shadow_stats.bootstrap_complete = status.bootstrap_complete;
                shadow_stats.index_healthy = status.healthy;
                shadow_stats.indexed_rows = status.indexed;

                fast_stats.index_available = true;
                fast_stats.bootstrap_complete = status.bootstrap_complete;
                fast_stats.index_healthy = status.healthy;
                fast_stats.indexed_rows = status.indexed;
                fast_stats.index_generation = status.generation;
            }

            match (status_result, rows_result) {
                (Ok(_status), Ok(rows)) => Some(rows),
                (status, rows) => {
                    let status_error = status.err();
                    let rows_error = rows.err();
                    let error = format!(
                        "read-only state index unavailable: status={}; rows={}",
                        status_error.as_deref().unwrap_or("ok"),
                        rows_error.as_deref().unwrap_or("ok")
                    );
                    shadow_stats.index_error = Some(error.clone());
                    fast_stats.index_error = Some(error);
                    None
                }
            }
        }
        Err(error) => {
            shadow_stats.index_error = Some(error.clone());
            fast_stats.index_error = Some(error);
            None
        }
    };

    let mut entries = target_dates.into_iter().collect::<Vec<_>>();
    entries.sort_by(|left, right| left.0.cmp(&right.0));
    let mut baselines = Vec::with_capacity(entries.len());

    for ((exchange, symbol), mut dates) in entries {
        fast_stats.candidates += 1;
        dates.sort_unstable();
        dates.dedup();
        let first_incoming_date = *dates
            .first()
            .ok_or_else(|| format!("Missing recovery target date for {}:{}.", exchange, symbol))?;
        let key = BinaryStateKey::new(exchange.clone(), symbol.clone());
        let indexed = shadow_rows.as_ref().and_then(|rows| rows.get(&key));
        let path = database_folder
            .join("eod_data")
            .join(&exchange)
            .join(format!("{}.eod", symbol));

        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fast_stats.missing_physical += 1;
                if fast_stats.index_healthy && indexed.is_some() {
                    fast_stats.state_mismatch += 1;
                    if fast_stats.fallback_samples.len() < BHAVCOPY_BASELINE_FAST_PATH_SAMPLE_LIMIT
                    {
                        fast_stats.fallback_samples.push(format!(
                            "{}:{} physical file absent but VERIFIED state row exists",
                            exchange, symbol
                        ));
                    }
                }

                let physical = PhysicalRecoveryPreState {
                    existed_before: false,
                    record_count: 0,
                    price_scale: DEFAULT_SCALE,
                    file_length: 0,
                    last_date: None,
                    file_mtime_ns: None,
                };
                shadow_stats.record(
                    &exchange,
                    &symbol,
                    classify_recovery_state_shadow(&physical, indexed),
                );
                baselines.push(RecoveryBinaryBaseline {
                    exchange,
                    symbol,
                    kind: RecoveryBinaryBaselineKind::Conservative,
                    existed_before: false,
                    record_count: 0,
                    price_scale: DEFAULT_SCALE,
                    file_length: 0,
                    target_dates: dates,
                });
                continue;
            }
            Err(error) => {
                return Err(format!(
                    "Cannot inspect Bhavcopy recovery baseline file {}:{}: {}",
                    exchange, symbol, error
                ));
            }
        };

        let physical_identity = BhavcopyBaselineFileIdentity {
            relative_path: expected_eod_relative_path(&exchange, &symbol),
            file_length: metadata.len(),
            file_mtime_ns: eod_binary_state_modified_time_ns(&metadata).ok(),
        };

        if fast_stats.index_healthy && indexed.is_some() {
            fast_stats.eligible += 1;
        }

        match classify_recovery_baseline_fast_path(
            fast_stats.index_available,
            fast_stats.index_healthy,
            fast_stats.index_generation,
            &physical_identity,
            indexed,
        ) {
            BhavcopyBaselineFastPathDecision::Trusted => {
                let indexed = indexed.expect("trusted fast path requires VERIFIED state row");
                fast_stats.fast += 1;
                baselines.push(recovery_baseline_from_verified_state(
                    exchange,
                    symbol,
                    dates,
                    first_incoming_date,
                    indexed,
                ));
                continue;
            }
            BhavcopyBaselineFastPathDecision::Fallback(reason) => {
                fast_stats.record_fallback(&exchange, &symbol, reason);
            }
        }

        fast_stats.physical_opens += 1;
        let binary = BinaryEodFile::open(&path).map_err(|error| {
            format!(
                "Cannot prepare Bhavcopy recovery baseline for {}:{}: {}",
                exchange, symbol, error
            )
        })?;
        let expected_length =
            (HEADER_SIZE + binary.header.record_count as usize * RECORD_SIZE) as u64;
        if metadata.len() != expected_length {
            return Err(format!(
                "Refusing protected Bhavcopy import because {}:{} is structurally inconsistent before mutation: header count {} expects {} bytes, found {} bytes.",
                exchange,
                symbol,
                binary.header.record_count,
                expected_length,
                metadata.len()
            ));
        }
        let last_date = if binary.header.record_count == 0 {
            None
        } else {
            binary.read_latest(1)?.first().map(|record| record.date)
        };
        let kind = if last_date
            .map(|date| first_incoming_date > date)
            .unwrap_or(true)
        {
            RecoveryBinaryBaselineKind::AppendNewest
        } else {
            RecoveryBinaryBaselineKind::Conservative
        };

        let physical = PhysicalRecoveryPreState {
            existed_before: true,
            record_count: binary.header.record_count,
            price_scale: binary.header.price_scale,
            file_length: metadata.len(),
            last_date,
            file_mtime_ns: physical_identity.file_mtime_ns,
        };
        shadow_stats.record(
            &exchange,
            &symbol,
            classify_recovery_state_shadow(&physical, indexed),
        );

        baselines.push(RecoveryBinaryBaseline {
            exchange,
            symbol,
            kind,
            existed_before: true,
            record_count: binary.header.record_count,
            price_scale: binary.header.price_scale,
            file_length: metadata.len(),
            target_dates: dates,
        });
    }

    Ok((baselines, shadow_stats, fast_stats))
}

fn build_bhavcopy_append_newest_fast_hints(
    database_folder: &Path,
    baselines: &[RecoveryBinaryBaseline],
) -> (
    HashMap<(String, String), BinaryAppendNewestHint>,
    BhavcopyAppendNewestFastHintStats,
) {
    let append_baselines = baselines
        .iter()
        .filter(|baseline| {
            baseline.existed_before
                && matches!(&baseline.kind, RecoveryBinaryBaselineKind::AppendNewest)
        })
        .collect::<Vec<_>>();

    let mut stats = BhavcopyAppendNewestFastHintStats {
        candidates: append_baselines.len(),
        ..BhavcopyAppendNewestFastHintStats::default()
    };
    let mut hints = HashMap::<(String, String), BinaryAppendNewestHint>::new();

    if append_baselines.is_empty() {
        return (hints, stats);
    }

    let index = match BinaryStateIndex::open_existing_read_only(database_folder) {
        Ok(index) => index,
        Err(error) => {
            stats.index_error = Some(error);
            stats.index_untrusted = stats.candidates;
            stats.fallback = stats.candidates;
            return (hints, stats);
        }
    };

    let status = match index.status() {
        Ok(status) => status,
        Err(error) => {
            stats.index_available = true;
            stats.index_error = Some(error);
            stats.index_untrusted = stats.candidates;
            stats.fallback = stats.candidates;
            return (hints, stats);
        }
    };

    stats.index_available = true;
    stats.bootstrap_complete = status.bootstrap_complete;
    stats.index_healthy = status.healthy;
    stats.index_generation = status.generation;
    stats.indexed_rows = status.indexed;

    if !status.healthy {
        stats.index_untrusted = stats.candidates;
        stats.fallback = stats.candidates;
        return (hints, stats);
    }

    let rows = match index.load_verified() {
        Ok(rows) => rows,
        Err(error) => {
            stats.index_error = Some(error);
            stats.index_untrusted = stats.candidates;
            stats.fallback = stats.candidates;
            return (hints, stats);
        }
    };

    for baseline in append_baselines {
        let key = BinaryStateKey::new(baseline.exchange.clone(), baseline.symbol.clone());
        let Some(indexed) = rows.get(&key) else {
            stats.missing_rows += 1;
            stats.record_fallback(&baseline.exchange, &baseline.symbol, "missing VERIFIED row");
            continue;
        };

        let expected_payload = (indexed.record_count as u64).checked_mul(RECORD_SIZE as u64);
        let expected_length =
            expected_payload.and_then(|payload| (HEADER_SIZE as u64).checked_add(payload));
        let expected_relative_path =
            expected_eod_relative_path(&baseline.exchange, &baseline.symbol);
        let first_target_date = baseline.target_dates.iter().copied().min();
        let state_matches = indexed.state_generation == status.generation
            && indexed.relative_path == expected_relative_path
            && indexed.record_count == baseline.record_count
            && indexed.price_scale == baseline.price_scale
            && indexed.file_length == baseline.file_length
            && expected_length == Some(indexed.file_length)
            && indexed.record_count > 0
            && indexed.first_date.is_some()
            && indexed.last_date.is_some()
            && matches!(
                (first_target_date, indexed.last_date),
                (Some(first), Some(last)) if first > last
            );

        if !state_matches {
            stats.state_mismatch += 1;
            stats.record_fallback(
                &baseline.exchange,
                &baseline.symbol,
                "state/baseline mismatch",
            );
            continue;
        }

        hints.insert(
            (baseline.exchange.clone(), baseline.symbol.clone()),
            BinaryAppendNewestHint {
                record_count: indexed.record_count,
                price_scale: indexed.price_scale,
                file_length: indexed.file_length,
                file_mtime_ns: indexed.file_mtime_ns,
                last_date: indexed
                    .last_date
                    .expect("V1.4 state match requires an indexed last date"),
            },
        );
        stats.hinted += 1;
    }

    (hints, stats)
}

fn recovery_row_from_parsed(exchange: &str, row: &ParsedBhavcopyRow) -> RecoveryJournalRow {
    RecoveryJournalRow {
        exchange: exchange.to_string(),
        trade_date: row.trade_date.clone(),
        symbol: row.symbol.clone(),
        instrument_name: row.instrument_name.clone(),
        series: row.series.clone(),
        isin: row.isin.clone(),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        prev_close: row.prev_close,
        volume: row.volume,
        oi: row.oi,
        trades: row.trades,
        binary_date: row.binary_record.date,
        binary_flags: row.binary_record.flags,
        binary_open: row.binary_record.open,
        binary_high: row.binary_record.high,
        binary_low: row.binary_record.low,
        binary_close: row.binary_record.close,
        binary_prev_close: row.binary_record.prev_close,
        binary_volume: row.binary_record.volume,
        binary_oi: row.binary_record.oi,
    }
}

fn parsed_files_from_recovery_session(
    session: &LoadedRecoverySession,
) -> AppResult<Vec<ParsedBhavcopyFile>> {
    let mut parsed_files = Vec::<ParsedBhavcopyFile>::new();
    for job in &session.manifest.jobs {
        let rows = session
            .rows
            .iter()
            .filter(|row| row.exchange == job.exchange && row.trade_date == job.trade_date)
            .map(|row| ParsedBhavcopyRow {
                symbol: row.symbol.clone(),
                instrument_name: row.instrument_name.clone(),
                series: row.series.clone(),
                isin: row.isin.clone(),
                trade_date: row.trade_date.clone(),
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                prev_close: row.prev_close,
                volume: row.volume,
                oi: row.oi,
                trades: row.trades,
                binary_record: EodRecord {
                    date: row.binary_date,
                    flags: row.binary_flags,
                    open: row.binary_open,
                    high: row.binary_high,
                    low: row.binary_low,
                    close: row.binary_close,
                    prev_close: row.binary_prev_close,
                    volume: row.binary_volume,
                    oi: row.binary_oi,
                },
            })
            .collect::<Vec<_>>();
        if rows.len() != job.row_count {
            return Err(format!(
                "Bhavcopy recovery session {} job {} {} expected {} rows but journal contains {}.",
                session.manifest.session_id,
                job.exchange,
                job.trade_date,
                job.row_count,
                rows.len()
            ));
        }
        parsed_files.push(ParsedBhavcopyFile {
            exchange: job.exchange.clone(),
            trade_date: job.trade_date.clone(),
            rows,
            max_volume: job.max_volume,
            debug: None,
        });
    }
    Ok(parsed_files)
}

fn lock_bhavcopy_checkpoint_lifecycle() -> AppResult<MutexGuard<'static, ()>> {
    BHAVCOPY_CHECKPOINT_LIFECYCLE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Bhavcopy checkpoint lifecycle lock was poisoned.".to_string())
}

fn can_resume_buffered_checkpoint(state: &RecoverySessionState) -> bool {
    matches!(
        state,
        RecoverySessionState::Applied | RecoverySessionState::Checkpointing
    )
}

fn spawn_background_bhavcopy_checkpoint(app_handle: AppHandle, database_file_path: PathBuf) {
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(error) =
            checkpoint_pending_buffered_sessions_background(&app_handle, &database_file_path)
        {
            log_runtime_event(
                &app_handle,
                "WARN",
                "bhavcopy-background-checkpoint-error",
                Some(&error),
            );
        }
    });
}

fn checkpoint_pending_buffered_sessions_background(
    app_handle: &AppHandle,
    database_file_path: &Path,
) -> AppResult<usize> {
    let _checkpoint_lifecycle_guard = lock_bhavcopy_checkpoint_lifecycle()?;
    let database_folder = database_file_path
        .parent()
        .ok_or_else(|| "Active database file has no parent folder.".to_string())?;
    let sessions = load_pending_sessions(database_folder)?;
    let mut completed_sessions = 0_usize;

    for session in sessions {
        let has_buffered_append_baselines = session
            .manifest
            .binary_baselines
            .iter()
            .any(|baseline| baseline.kind == RecoveryBinaryBaselineKind::AppendNewest);
        if !can_resume_buffered_checkpoint(&session.manifest.state)
            || !has_buffered_append_baselines
        {
            continue;
        }

        let mut handle = handle_from_loaded(&session);
        let resumed_from_state = format!("{:?}", session.manifest.state);
        let buffered_append_files = session
            .manifest
            .binary_baselines
            .iter()
            .filter(|baseline| baseline.kind == RecoveryBinaryBaselineKind::AppendNewest)
            .count();
        update_session_state(&mut handle, RecoverySessionState::Checkpointing, None)?;
        let checkpoint_started = Instant::now();
        log_runtime_event(
            app_handle,
            "INFO",
            "bhavcopy-background-checkpoint-start",
            Some(&format!(
                "sessionId={} resumeState={} files={} rows={} workers={}",
                handle.manifest.session_id,
                resumed_from_state,
                buffered_append_files,
                handle.manifest.journal_row_count,
                MAX_BUFFERED_CHECKPOINT_WORKERS
            )),
        );
        emit_progress(
            app_handle,
            100,
            format!(
                "Background checkpoint started for Bhavcopy session {} ({} APPEND_NEWEST files; up to {} workers)",
                handle.manifest.session_id,
                buffered_append_files,
                MAX_BUFFERED_CHECKPOINT_WORKERS
            ),
        );

        match checkpoint_buffered_append_newest_files(
            database_folder,
            &session.manifest.binary_baselines,
            &session.rows,
        ) {
            Ok(checkpoint) => {
                update_session_state(&mut handle, RecoverySessionState::Checkpointed, None)?;
                let elapsed_ms = checkpoint_started.elapsed().as_millis();
                log_runtime_event(
                    app_handle,
                    "INFO",
                    "bhavcopy-background-checkpoint-complete",
                    Some(&format!(
                        "sessionId={} files={} rows={} workers={} elapsedMs={} verificationUs={} syncUs={} publicationUs={} syncP50Us={} syncP95Us={} syncMaxUs={}",
                        handle.manifest.session_id,
                        checkpoint.files,
                        handle.manifest.journal_row_count,
                        checkpoint.workers,
                        elapsed_ms,
                        checkpoint.verification_us,
                        checkpoint.sync_us,
                        checkpoint.publication_us,
                        checkpoint.sync_p50_us,
                        checkpoint.sync_p95_us,
                        checkpoint.sync_max_us
                    )),
                );
                emit_progress(
                    app_handle,
                    100,
                    format!(
                        "Background checkpoint complete for Bhavcopy session {} ({} APPEND_NEWEST files; {} ms; verify/sync/publish {} / {} / {} us; sync p50/p95/max {} / {} / {} us; workers {})",
                        handle.manifest.session_id,
                        checkpoint.files,
                        elapsed_ms,
                        checkpoint.verification_us,
                        checkpoint.sync_us,
                        checkpoint.publication_us,
                        checkpoint.sync_p50_us,
                        checkpoint.sync_p95_us,
                        checkpoint.sync_max_us,
                        checkpoint.workers
                    ),
                );
                remove_checkpointed_session(&handle)?;
                completed_sessions += 1;
            }
            Err(error) => {
                log_runtime_event(
                    app_handle,
                    "WARN",
                    "bhavcopy-background-checkpoint-deferred",
                    Some(&format!(
                        "sessionId={} reason={}",
                        handle.manifest.session_id, error
                    )),
                );
                emit_progress(
                    app_handle,
                    100,
                    format!(
                        "Background checkpoint deferred for Bhavcopy session {}; the durable journal remains available for foreground recovery",
                        handle.manifest.session_id
                    ),
                );
                // Keep CHECKPOINTING persisted. The next foreground operation can
                // safely resume verification, or fall back to full journal replay.
            }
        }
    }

    Ok(completed_sessions)
}

fn recover_pending_bhavcopy_sessions(
    app_handle: &AppHandle,
    database_file_path: &Path,
) -> AppResult<()> {
    let _checkpoint_lifecycle_guard = lock_bhavcopy_checkpoint_lifecycle()?;
    let database_folder = database_file_path
        .parent()
        .ok_or_else(|| "Active database file has no parent folder.".to_string())?;
    let sessions = load_pending_sessions(database_folder)?;
    if sessions.is_empty() {
        return Ok(());
    }

    emit_progress(
        app_handle,
        0,
        format!(
            "Recovering {} pending Bhavcopy import session(s) before download...",
            sessions.len()
        ),
    );

    for session in sessions {
        if session.manifest.state == RecoverySessionState::RecoveryError {
            return Err(format!(
                "Bhavcopy recovery session {} requires operator review.",
                session.manifest.session_id
            ));
        }

        let mut handle = handle_from_loaded(&session);
        let has_buffered_append_baselines = session
            .manifest
            .binary_baselines
            .iter()
            .any(|baseline| baseline.kind == RecoveryBinaryBaselineKind::AppendNewest);

        if can_resume_buffered_checkpoint(&session.manifest.state) && has_buffered_append_baselines
        {
            let resumed_from_state = format!("{:?}", session.manifest.state);
            let buffered_append_files = session
                .manifest
                .binary_baselines
                .iter()
                .filter(|baseline| baseline.kind == RecoveryBinaryBaselineKind::AppendNewest)
                .count();
            update_session_state(&mut handle, RecoverySessionState::Checkpointing, None)?;
            log_runtime_event(
                app_handle,
                "INFO",
                "bhavcopy-deferred-checkpoint-start",
                Some(&format!(
                    "sessionId={} resumeState={} files={} rows={} workers={}",
                    handle.manifest.session_id,
                    resumed_from_state,
                    buffered_append_files,
                    handle.manifest.journal_row_count,
                    MAX_BUFFERED_CHECKPOINT_WORKERS
                )),
            );
            emit_progress(
                app_handle,
                0,
                format!(
                    "Checkpointing prior buffered Bhavcopy session {} ({} APPEND_NEWEST files; resume state {})",
                    handle.manifest.session_id, buffered_append_files, resumed_from_state
                ),
            );
            let checkpoint_started = Instant::now();
            match checkpoint_buffered_append_newest_files(
                database_folder,
                &session.manifest.binary_baselines,
                &session.rows,
            ) {
                Ok(checkpoint) => {
                    update_session_state(&mut handle, RecoverySessionState::Checkpointed, None)?;
                    let elapsed_ms = checkpoint_started.elapsed().as_millis();
                    log_runtime_event(
                        app_handle,
                        "INFO",
                        "bhavcopy-deferred-checkpoint-complete",
                        Some(&format!(
                            "sessionId={} files={} rows={} workers={} elapsedMs={} verificationUs={} syncUs={} publicationUs={} syncP50Us={} syncP95Us={} syncMaxUs={}",
                            handle.manifest.session_id,
                            checkpoint.files,
                            handle.manifest.journal_row_count,
                            checkpoint.workers,
                            elapsed_ms,
                            checkpoint.verification_us,
                            checkpoint.sync_us,
                            checkpoint.publication_us,
                            checkpoint.sync_p50_us,
                            checkpoint.sync_p95_us,
                            checkpoint.sync_max_us
                        )),
                    );
                    emit_progress(
                        app_handle,
                        0,
                        format!(
                            "Checkpointed prior buffered Bhavcopy session {} ({} APPEND_NEWEST files; {} ms; verify/sync/publish {} / {} / {} us; sync p50/p95/max {} / {} / {} us; workers {})",
                            handle.manifest.session_id,
                            checkpoint.files,
                            elapsed_ms,
                            checkpoint.verification_us,
                            checkpoint.sync_us,
                            checkpoint.publication_us,
                            checkpoint.sync_p50_us,
                            checkpoint.sync_p95_us,
                            checkpoint.sync_max_us,
                            checkpoint.workers
                        ),
                    );
                    remove_checkpointed_session(&handle)?;
                    continue;
                }
                Err(checkpoint_error) => {
                    log_runtime_event(
                        app_handle,
                        "WARN",
                        "bhavcopy-deferred-checkpoint-replay",
                        Some(&format!(
                            "sessionId={} reason={}",
                            handle.manifest.session_id, checkpoint_error
                        )),
                    );
                    emit_progress(
                        app_handle,
                        0,
                        format!(
                            "Buffered Bhavcopy checkpoint verification failed for {}; replaying durable recovery journal",
                            handle.manifest.session_id
                        ),
                    );
                }
            }
        }

        if can_resume_buffered_checkpoint(&session.manifest.state)
            && !has_buffered_append_baselines
        {
            update_session_state(&mut handle, RecoverySessionState::Checkpointing, None)?;
            match publish_recovery_binary_state(
                database_folder,
                &session.manifest.binary_baselines,
            ) {
                Ok(published_rows) => {
                    update_session_state(&mut handle, RecoverySessionState::Checkpointed, None)?;
                    log_runtime_event(
                        app_handle,
                        "INFO",
                        "bhavcopy-state-publication-resume-complete",
                        Some(&format!(
                            "sessionId={} publishedRows={}",
                            handle.manifest.session_id, published_rows
                        )),
                    );
                    remove_checkpointed_session(&handle)?;
                    continue;
                }
                Err(error) => {
                    log_runtime_event(
                        app_handle,
                        "WARN",
                        "bhavcopy-state-publication-resume-deferred",
                        Some(&format!(
                            "sessionId={} reason={}",
                            handle.manifest.session_id, error
                        )),
                    );
                    // Keep CHECKPOINTING persisted. The canonical writes were
                    // already durable; the next foreground operation can retry
                    // only the derived state publication without replaying data.
                    return Err(error);
                }
            }
        }

        update_session_state(&mut handle, RecoverySessionState::Applying, None)?;
        let parsed_files = parsed_files_from_recovery_session(&session)?;
        let recovery_result = (|| -> AppResult<()> {
            restore_buffered_binary_baselines(
                database_folder,
                &session.manifest.binary_baselines,
                &session.rows,
            )?;
            let (parsed_results, timing) = insert_parsed_bhavcopy_files_with_durability(
                database_file_path,
                &parsed_files,
                BinaryWriteDurability::Immediate,
            )?;
            if timing.binary_errors > 0 {
                return Err(format!(
                    "Recovery session {} reported {} binary symbol errors.",
                    handle.manifest.session_id, timing.binary_errors
                ));
            }

            let connection = open_database_connection(database_file_path)?;
            for (parsed, parsed_result) in parsed_files.iter().zip(parsed_results) {
                let log_result = DownloadResult {
                    success: true,
                    trade_date: parsed.trade_date.clone(),
                    exchange: parsed.exchange.clone(),
                    rows_inserted: parsed.rows.len(),
                    max_volume: parsed_result.max_volume,
                    message: format!(
                        "Recovered Bhavcopy session {}; canonical rows {}",
                        handle.manifest.session_id,
                        parsed.rows.len()
                    ),
                };
                upsert_download_log_entry(&connection, &log_result)?;
            }

            // Immediate recovery writes are already durable. Publish their exact
            // canonical state before the recovery session can become CHECKPOINTED.
            publish_recovery_binary_state(
                database_folder,
                &session.manifest.binary_baselines,
            )?;
            Ok(())
        })();

        match recovery_result {
            Ok(()) => {
                update_session_state(&mut handle, RecoverySessionState::Applied, None)?;
                update_session_state(&mut handle, RecoverySessionState::Checkpointing, None)?;
                update_session_state(&mut handle, RecoverySessionState::Checkpointed, None)?;
                log_runtime_event(
                    app_handle,
                    "INFO",
                    "bhavcopy-recovery-complete",
                    Some(&format!(
                        "sessionId={} rows={}",
                        handle.manifest.session_id, handle.manifest.journal_row_count
                    )),
                );
                emit_progress(
                    app_handle,
                    0,
                    format!(
                        "Recovered Bhavcopy session {} ({} rows)",
                        handle.manifest.session_id, handle.manifest.journal_row_count
                    ),
                );
                remove_checkpointed_session(&handle)?;
            }
            Err(error) => {
                let _ = update_session_state(
                    &mut handle,
                    RecoverySessionState::RecoveryError,
                    Some(error.clone()),
                );
                return Err(error);
            }
        }
    }

    Ok(())
}

fn import_staged_csv_downloads(
    app_handle: &AppHandle,
    database_file_path: &Path,
    staged_downloads: Vec<StagedDownload>,
    config: &BatchDownloadConfig,
    write_lock: &Mutex<()>,
) -> AppResult<Vec<DownloadResult>> {
    let parse_started = Instant::now();
    let mut parsed_files = Vec::<ParsedBhavcopyFile>::new();
    let mut results = Vec::<DownloadResult>::new();
    let mut parsed_rows = 0_usize;

    for staged in staged_downloads {
        let StagedDownloadContent::Csv(csv_content) = staged.content else {
            continue;
        };
        match parse_bhavcopy_csv(
            &csv_content,
            &staged.task.exchange,
            &staged.task.trade_date,
            &config.excluded_series,
        ) {
            Ok(parsed) => {
                if let Some(debug) = parsed.debug.as_ref() {
                    results.push(DownloadResult {
                        success: false,
                        trade_date: staged.task.trade_date,
                        exchange: staged.task.exchange,
                        rows_inserted: 0,
                        max_volume: 0,
                        message: debug.clone(),
                    });
                } else {
                    parsed_rows += parsed.rows.len();
                    parsed_files.push(parsed);
                }
            }
            Err(error) => {
                results.push(failed_download_result(
                    &staged.task.exchange,
                    &staged.task.trade_date,
                    error,
                ));
            }
        }
    }

    let parse_ms = parse_started.elapsed().as_millis();

    if !parsed_files.is_empty() {
        let (mut recovery_session, state_shadow_stats, baseline_fast_path_stats) =
            prepare_bhavcopy_recovery_session(database_file_path, config, &parsed_files)?;
        emit_progress(
            app_handle,
            71,
            format!(
                "Bhavcopy recovery journal prepared: session {} / {} rows",
                recovery_session.manifest.session_id, recovery_session.manifest.journal_row_count
            ),
        );
        log_runtime_event(
            app_handle,
            "INFO",
            "bhavcopy-recovery-prepared",
            Some(&format!(
                "sessionId={} rows={} sha256={}",
                recovery_session.manifest.session_id,
                recovery_session.manifest.journal_row_count,
                recovery_session.manifest.journal_sha256
            )),
        );
        let fast_path_summary = baseline_fast_path_stats.summary();
        emit_progress(
            app_handle,
            71,
            format!("Bhavcopy EOD baseline fast path: {fast_path_summary}"),
        );
        log_runtime_event(
            app_handle,
            if baseline_fast_path_stats.state_mismatch > 0
                || baseline_fast_path_stats.metadata_mismatch > 0
            {
                "WARN"
            } else {
                "INFO"
            },
            "bhavcopy-eod-baseline-fast-path",
            Some(&format!(
                "{}; fallbackSamples=[{}]; indexError={}",
                fast_path_summary,
                baseline_fast_path_stats.fallback_samples.join(" | "),
                baseline_fast_path_stats
                    .index_error
                    .as_deref()
                    .unwrap_or("none")
            )),
        );

        if baseline_fast_path_stats.fallback > 0 || state_shadow_stats.mismatched > 0 {
            let shadow_summary = state_shadow_stats.summary();
            log_runtime_event(
                app_handle,
                if state_shadow_stats.mismatched > 0 {
                    "WARN"
                } else {
                    "INFO"
                },
                "bhavcopy-eod-state-shadow-fallback",
                Some(&format!(
                    "{}; mismatchSamples=[{}]; indexError={}",
                    shadow_summary,
                    state_shadow_stats.mismatch_samples.join(" | "),
                    state_shadow_stats.index_error.as_deref().unwrap_or("none")
                )),
            );
        }
        update_session_state(&mut recovery_session, RecoverySessionState::Applying, None)?;

        let mut deferred_append_syncs = 0_usize;
        let protected_import = (|| -> AppResult<()> {
            let _write_guard = lock_bhavcopy_write(write_lock)?;
            let (parsed_results, insert_timing) =
                insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
                    database_file_path,
                    &parsed_files,
                    BinaryWriteDurability::RecoveryJournalBuffered,
                    Some(&recovery_session.manifest.binary_baselines),
                )?;
            deferred_append_syncs = insert_timing.binary_diagnostics.deferred_sync_calls;
            if insert_timing.binary_errors > 0 {
                return Err(format!(
                    "Bhavcopy binary import reported {} symbol write errors; recovery journal retained.",
                    insert_timing.binary_errors
                ));
            }
            let staged_timing_message = format!(
            "parse {} jobs / {} rows in {} ms; metadata upsert {} ms; commit {} ms; binary filter {} ms; binary write {} ms; symbols {}",
            insert_timing.parsed_jobs,
            insert_timing.parsed_rows,
            parse_ms,
            insert_timing.metadata_upsert_ms,
            insert_timing.transaction_commit_ms,
            insert_timing.binary_filter_ms,
            insert_timing.binary_write_ms,
            insert_timing.binary_symbols
        );
            emit_progress(
                app_handle,
                75,
                format!("Bhavcopy staged CSV timings: {staged_timing_message}"),
            );
            if insert_timing.duplicate_symbol_date_rows > 0 {
                let duplicate_message = format!(
                    "duplicate symbol/date rows {}; samples [{}]",
                    insert_timing.duplicate_symbol_date_rows,
                    insert_timing.duplicate_symbol_date_samples.join(", ")
                );
                emit_progress(
                    app_handle,
                    75,
                    format!("Bhavcopy row parity audit: {duplicate_message}"),
                );
                log_runtime_event(
                    app_handle,
                    "INFO",
                    "bhavcopy-row-parity-audit",
                    Some(&duplicate_message),
                );
            }
            log_runtime_event(
                app_handle,
                "INFO",
                "bhavcopy-stage-timing",
                Some(&staged_timing_message),
            );

            let binary_stats_message = format!(
            "workers {}; inserted dates {}; changed dates {}; unchanged dates {}; inserted symbols {}; changed symbols {}; unchanged symbols {}; errors {}",
            insert_timing.binary_workers,
            insert_timing.binary_inserted_dates,
            insert_timing.binary_changed_dates,
            insert_timing.binary_unchanged_dates,
            insert_timing.binary_inserted_symbols,
            insert_timing.binary_changed_symbols,
            insert_timing.binary_unchanged_symbols,
            insert_timing.binary_errors
        );
            emit_progress(
                app_handle,
                76,
                format!("Bhavcopy binary write stats: {binary_stats_message}"),
            );
            log_runtime_event(
                app_handle,
                "INFO",
                "bhavcopy-binary-write-stats",
                Some(&binary_stats_message),
            );

            let diagnostics = &insert_timing.binary_diagnostics;
            let binary_paths_message = format!(
            "new file {}; append newest {}; rewrite tail {}; update existing {}; insert historical {}; no-op {}",
            diagnostics.new_files,
            diagnostics.append_newest,
            diagnostics.rewrite_tail,
            diagnostics.update_existing,
            diagnostics.insert_historical,
            diagnostics.no_op
        );
            emit_progress(
                app_handle,
                77,
                format!("Bhavcopy binary write paths: {binary_paths_message}"),
            );
            log_runtime_event(
                app_handle,
                "INFO",
                "bhavcopy-binary-write-paths",
                Some(&binary_paths_message),
            );

            let append_hint_stats = &insert_timing.append_newest_fast_hint_stats;
            let append_fast_fallback =
                append_hint_stats.fallback + diagnostics.append_newest_fast_fallback;
            let append_fast_message = format!(
                "index available={}; bootstrap complete={}; healthy={}; generation={}; indexed rows={}; candidates={}; hinted={}; trusted={}; fast={}; fallback={}; missing rows={}; state mismatch={}; index untrusted={}; metadata changed={}; not newest={}; header classification reads={}; last-date classification reads={}",
                append_hint_stats.index_available,
                append_hint_stats.bootstrap_complete,
                append_hint_stats.index_healthy,
                append_hint_stats.index_generation,
                append_hint_stats.indexed_rows,
                append_hint_stats.candidates,
                append_hint_stats.hinted,
                diagnostics.append_newest_fast_trusted,
                diagnostics.append_newest_fast_fast,
                append_fast_fallback,
                append_hint_stats.missing_rows,
                append_hint_stats.state_mismatch + diagnostics.append_newest_fast_state_mismatch,
                append_hint_stats.index_untrusted,
                diagnostics.append_newest_fast_metadata_changed,
                diagnostics.append_newest_fast_not_newest,
                diagnostics.header_classification_reads,
                diagnostics.last_date_classification_reads
            );
            emit_progress(
                app_handle,
                77,
                format!("Bhavcopy APPEND_NEWEST fast classification: {append_fast_message}"),
            );
            log_runtime_event(
                app_handle,
                if append_fast_fallback > 0 {
                    "WARN"
                } else {
                    "INFO"
                },
                "bhavcopy-append-newest-fast-classification",
                Some(&format!(
                    "{}; fallbackSamples=[{}]; indexError={}",
                    append_fast_message,
                    append_hint_stats.fallback_samples.join(" | "),
                    append_hint_stats.index_error.as_deref().unwrap_or("none")
                )),
            );

            let binary_detail_message = format!(
            "exists {} ms; open {} ms; header read {} ms; last-date read {} ms; sort {} ms; lookup {} ms; tail read {} ms; new-file write {} ms; seek {} ms; data write {} ms; byte shift {} ms; set-len {} ms; header write {} ms; flush {} ms / {} calls; sync_data {} ms / {} calls; deferred APPEND_NEWEST sync {} calls; parallel-summed symbol elapsed {} ms; p50 symbol {} ms; p95 symbol {} ms; max symbol {} ms",
            format_us_as_ms(diagnostics.exists_us),
            format_us_as_ms(diagnostics.open_us),
            format_us_as_ms(diagnostics.header_read_us),
            format_us_as_ms(diagnostics.last_date_read_us),
            format_us_as_ms(diagnostics.sort_us),
            format_us_as_ms(diagnostics.lookup_us),
            format_us_as_ms(diagnostics.tail_read_us),
            format_us_as_ms(diagnostics.new_file_write_us),
            format_us_as_ms(diagnostics.seek_us),
            format_us_as_ms(diagnostics.data_write_us),
            format_us_as_ms(diagnostics.byte_shift_us),
            format_us_as_ms(diagnostics.set_len_us),
            format_us_as_ms(diagnostics.header_write_us),
            format_us_as_ms(diagnostics.flush_us),
            diagnostics.flush_calls,
            format_us_as_ms(diagnostics.sync_data_us),
            diagnostics.sync_data_calls,
            diagnostics.deferred_sync_calls,
            format_us_as_ms(diagnostics.measured_total_us),
            format_us_as_ms(diagnostics.p50_symbol_us),
            format_us_as_ms(diagnostics.p95_symbol_us),
            format_us_as_ms(diagnostics.max_symbol_us)
        );
            emit_progress(
                app_handle,
                78,
                format!("Bhavcopy binary write detail: {binary_detail_message}"),
            );
            log_runtime_event(
                app_handle,
                "INFO",
                "bhavcopy-binary-write-detail",
                Some(&binary_detail_message),
            );

            let connection = open_database_connection(database_file_path)?;
            let log_write_started = Instant::now();
            let mut log_entries_written = 0_usize;
            for (parsed, parsed_result) in parsed_files.iter().zip(parsed_results) {
                let message = if parsed_result.rows_inserted == 0 && !parsed.rows.is_empty() {
                    format!(
                        "Already present; 0 new rows ({} parsed rows)",
                        parsed.rows.len()
                    )
                } else {
                    format!(
                        "Imported symbol-batched staged {} records",
                        parsed_result.rows_inserted
                    )
                };
                let result = DownloadResult {
                    success: true,
                    trade_date: parsed.trade_date.clone(),
                    exchange: parsed.exchange.clone(),
                    rows_inserted: parsed_result.rows_inserted,
                    max_volume: parsed_result.max_volume,
                    message,
                };
                let log_result = DownloadResult {
                    rows_inserted: parsed.rows.len(),
                    message: format!(
                        "Imported symbol-batched staged {} records; parsed {} rows",
                        parsed_result.rows_inserted,
                        parsed.rows.len()
                    ),
                    ..result.clone()
                };
                if should_write_download_log(&log_result) {
                    upsert_download_log_entry(&connection, &log_result)?;
                    log_entries_written += 1;
                }
                results.push(result);
            }
            for result in results.iter().filter(|result| !result.success) {
                if should_write_download_log(result) {
                    upsert_download_log_entry(&connection, result)?;
                    log_entries_written += 1;
                }
            }
            let download_log_write_ms = log_write_started.elapsed().as_millis();
            emit_progress(
                app_handle,
                79,
                format!(
                    "Bhavcopy staged CSV log writes: {} entries in {} ms",
                    log_entries_written, download_log_write_ms
                ),
            );
            Ok(())
        })();

        match protected_import {
            Ok(()) => {
                update_session_state(&mut recovery_session, RecoverySessionState::Applied, None)?;
                if deferred_append_syncs > 0 {
                    log_runtime_event(
                        app_handle,
                        "INFO",
                        "bhavcopy-deferred-checkpoint-retained",
                        Some(&format!(
                            "sessionId={} rows={} deferredAppendSyncs={}",
                            recovery_session.manifest.session_id,
                            recovery_session.manifest.journal_row_count,
                            deferred_append_syncs
                        )),
                    );
                    emit_progress(
                        app_handle,
                        80,
                        format!(
                            "Bhavcopy import applied; durable recovery journal retained for {} deferred APPEND_NEWEST file checkpoint(s)",
                            deferred_append_syncs
                        ),
                    );
                } else {
                    update_session_state(
                        &mut recovery_session,
                        RecoverySessionState::Checkpointing,
                        None,
                    )?;
                    let database_folder = database_file_path
                        .parent()
                        .ok_or_else(|| "Active database file has no parent folder.".to_string())?;
                    // All writes in a no-deferred session crossed their immediate
                    // durability barrier during apply. Publish the affected state
                    // before CHECKPOINTED so a publication failure retains the
                    // durable recovery journal for a safe retry.
                    publish_recovery_binary_state(
                        database_folder,
                        &recovery_session.manifest.binary_baselines,
                    )?;
                    update_session_state(
                        &mut recovery_session,
                        RecoverySessionState::Checkpointed,
                        None,
                    )?;
                    log_runtime_event(
                        app_handle,
                        "INFO",
                        "bhavcopy-recovery-checkpointed",
                        Some(&format!(
                            "sessionId={} rows={}",
                            recovery_session.manifest.session_id,
                            recovery_session.manifest.journal_row_count
                        )),
                    );
                    remove_checkpointed_session(&recovery_session)?;
                }
            }
            Err(error) => {
                let _ = update_session_state(
                    &mut recovery_session,
                    RecoverySessionState::Failed,
                    Some(error.clone()),
                );
                return Err(error);
            }
        }
    } else if !results.is_empty() {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        let connection = open_database_connection(database_file_path)?;
        let log_write_started = Instant::now();
        let mut log_entries_written = 0_usize;
        for result in &results {
            if should_write_download_log(result) {
                upsert_download_log_entry(&connection, result)?;
                log_entries_written += 1;
            }
        }
        let download_log_write_ms = log_write_started.elapsed().as_millis();
        emit_progress(
            app_handle,
            79,
            format!(
                "Bhavcopy staged CSV parse: 0 imported jobs, {} parsed rows in {} ms; log writes {} entries in {} ms",
                parsed_rows,
                parse_ms,
                log_entries_written,
                download_log_write_ms
            ),
        );
    }

    Ok(results)
}

fn process_download_task(
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    excluded_series: &[String],
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    if let Some(history_task) = &task.nse_index_history {
        return process_nse_index_history_task(
            client,
            database_file_path,
            task,
            history_task,
            write_lock,
        );
    }

    let connection = open_database_connection(database_file_path)?;
    let existing_log_id = connection
        .query_row(
            "
              SELECT id
              FROM download_log
              WHERE trade_date = ? AND exchange = ? AND status = 'ok'
              LIMIT 1
            ",
            params![&task.trade_date, &task.exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(log_id) = existing_log_id {
        let has_imported_rows =
            storage_mode_has_imported_rows_for_date(&connection, &task.trade_date, &task.exchange)?;
        let has_stale_zero_volume_rows = storage_mode_has_stale_zero_volume_rows_for_date(
            &connection,
            &task.trade_date,
            &task.exchange,
        )?;

        if has_imported_rows && !has_stale_zero_volume_rows && task.mode != DownloadMode::Range {
            return Ok(DownloadResult {
                success: true,
                trade_date: task.trade_date.clone(),
                exchange: task.exchange.clone(),
                rows_inserted: 0,
                max_volume: 0,
                message: "Already downloaded".to_string(),
            });
        }
        {
            let _write_guard = lock_bhavcopy_write(write_lock)?;
            let _ = clear_download_log_entry(&connection, log_id);
        }
    }

    let result = download_single(
        client,
        database_file_path,
        &task.exchange,
        &task.trade_date,
        &task.candidates,
        excluded_series,
        write_lock,
    )?;

    if should_write_download_log(&result) {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        upsert_download_log_entry(&connection, &result)?;
    }

    Ok(result)
}

fn process_nse_index_history_task(
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    history_task: &NseIndexHistoryTask,
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    let url = build_nse_index_history_url(history_task)?;
    let bytes = fetch_candidate_bytes(client, &url, NSE_INDEX_HISTORY_PAGE_URL, 3)?
        .ok_or_else(|| "No data returned by NSE historical index API".to_string())?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let parsed = serde_json::from_str::<NseIndexHistoryResponse>(&content)
        .map_err(|error| format!("NSE historical index API JSON parse failed: {error}"))?;

    if parsed.error.unwrap_or(false) {
        return Ok(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            parsed
                .show_message
                .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
        ));
    }

    let rows = parsed.data.unwrap_or_default();
    if rows.is_empty() {
        return Ok(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            format!(
                "No NSE historical index API rows for {} {} to {}",
                history_task.index_type, history_task.from_date, history_task.to_date
            ),
        ));
    }

    let parsed_rows =
        normalize_nse_index_history_rows(&rows, &history_task.symbol, &history_task.index_type);
    let result = {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        insert_nse_index_history_rows(database_file_path, &task.exchange, &parsed_rows)?
    };
    let message = format!(
        "NSE index API {} {} to {}: {} imported, {} close-only skipped",
        history_task.symbol,
        history_task.from_date,
        history_task.to_date,
        result.rows_inserted,
        result.close_only_skipped
    );

    Ok(DownloadResult {
        success: true,
        trade_date: task.trade_date.clone(),
        exchange: task.exchange.clone(),
        rows_inserted: result.rows_inserted,
        max_volume: result.max_volume,
        message,
    })
}

fn build_nse_index_history_url(history_task: &NseIndexHistoryTask) -> AppResult<String> {
    let from_date = parse_trade_date(&history_task.from_date)?
        .format("%d-%m-%Y")
        .to_string();
    let to_date = parse_trade_date(&history_task.to_date)?
        .format("%d-%m-%Y")
        .to_string();
    let mut url = Url::parse(NSE_INDEX_HISTORY_API_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("indexType", &history_task.index_type)
        .append_pair("from", &from_date)
        .append_pair("to", &to_date)
        .append_pair("csv", "true");
    Ok(url.to_string())
}

fn lock_bhavcopy_write(write_lock: &Mutex<()>) -> AppResult<MutexGuard<'_, ()>> {
    write_lock
        .lock()
        .map_err(|_| "Bhavcopy import writer lock was poisoned.".to_string())
}

fn download_single(
    client: &Client,
    database_file_path: &Path,
    exchange: &str,
    trade_date: &str,
    candidates: &[Candidate],
    excluded_series: &[String],
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    let mut last_hard_error: Option<String> = None;
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(exchange);
    let mut bse_api_reported_no_file = false;

    for candidate in candidates {
        match fetch_candidate_content_bytes(client, candidate, referer, 3) {
            Ok(Some(bytes)) => {
                let csv_content = if candidate.bse_index_archive_json {
                    match normalize_bse_index_archive_json(&bytes, trade_date)? {
                        Some(content) => content,
                        None => {
                            not_found_count += 1;
                            continue;
                        }
                    }
                } else {
                    let csv_bytes = if candidate.zipped {
                        match extract_first_csv_from_zip(&bytes)? {
                            Some(extracted) => extracted,
                            None => {
                                not_found_count += 1;
                                continue;
                            }
                        }
                    } else {
                        bytes
                    };
                    String::from_utf8_lossy(&csv_bytes).into_owned()
                };
                if is_bse_exchange(exchange) && is_html_response(&csv_content) {
                    not_found_count += 1;
                    continue;
                }
                let parsed = {
                    let _write_guard = lock_bhavcopy_write(write_lock)?;
                    parse_and_insert(
                        database_file_path,
                        &csv_content,
                        exchange,
                        trade_date,
                        excluded_series,
                    )?
                };
                if parsed.rows_inserted == 0 {
                    if let Some(debug) = parsed.debug {
                        last_hard_error = Some(debug);
                        continue;
                    }
                }
                return Ok(DownloadResult {
                    success: true,
                    trade_date: trade_date.to_string(),
                    exchange: exchange.to_string(),
                    rows_inserted: parsed.rows_inserted,
                    max_volume: parsed.max_volume,
                    message: format!("Downloaded {} records", parsed.rows_inserted),
                });
            }
            Ok(None) => {
                if is_bse_exchange(exchange) && candidate.bse_response_key.is_some() {
                    bse_api_reported_no_file = true;
                }
                not_found_count += 1;
            }
            Err(error) => {
                last_hard_error = Some(error);
            }
        }
    }

    if candidate_scan_should_skip(
        exchange,
        candidates.len(),
        not_found_count,
        bse_api_reported_no_file,
        last_hard_error.is_some(),
    ) {
        let message = if is_bse_exchange(exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (unavailable archive or source mismatch)",
                candidates.len()
            )
        } else {
            "No data available for this date (source unavailable or missing)".to_string()
        };
        return Ok(skipped_download_result(exchange, trade_date, message));
    }

    Ok(DownloadResult {
        success: false,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: last_hard_error.unwrap_or_else(|| "Download failed".to_string()),
    })
}

fn bhavcopy_referer_for_exchange(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "BSEINDEX" => BSE_INDEX_ARCHIVE_PAGE_URL,
        "BSE" => "https://www.bseindia.com/markets/MarketInfo/BhavCopy",
        _ => "https://www.nseindia.com/",
    }
}

fn is_bse_exchange(exchange: &str) -> bool {
    normalize_exchange_key(exchange).starts_with("BSE")
}

fn fetch_candidate_content_bytes(
    client: &Client,
    candidate: &Candidate,
    referer: &str,
    retries: usize,
) -> AppResult<Option<Vec<u8>>> {
    let Some(download_base) = candidate.bse_download_base else {
        return fetch_candidate_bytes(client, &candidate.url, referer, retries);
    };
    let response_key = candidate
        .bse_response_key
        .ok_or_else(|| "BSE candidate missing response key".to_string())?;
    let Some(api_bytes) = fetch_candidate_bytes(client, &candidate.url, referer, retries)? else {
        return Ok(None);
    };
    let content = String::from_utf8_lossy(&api_bytes);
    let value = serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|error| format!("BSE bhavcopy API JSON parse failed: {error}"))?;
    let Some(filename) = value
        .get(response_key)
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("filename"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
    else {
        return Ok(None);
    };
    let filename = normalize_bse_api_filename(response_key, filename.trim());
    let download_url = format!("{}{}", download_base, filename);
    fetch_candidate_bytes(client, &download_url, referer, retries)
}

fn normalize_bse_api_filename(response_key: &str, filename: &str) -> String {
    if response_key == "dsIndexSum" {
        if let Some((_, suffix)) = filename.split_once('_') {
            return format!("IndexSummary_{suffix}");
        }
    }

    filename.to_string()
}

fn normalize_bse_index_archive_json(buffer: &[u8], trade_date: &str) -> AppResult<Option<String>> {
    let value = serde_json::from_slice::<serde_json::Value>(buffer)
        .map_err(|error| format!("BSE Index archive API JSON parse failed: {error}"))?;
    let Some(rows) = value.get("Table").and_then(|value| value.as_array()) else {
        return Ok(None);
    };
    if rows.is_empty() {
        return Ok(None);
    }

    let mut writer = WriterBuilder::new()
        .has_headers(false)
        .from_writer(Vec::<u8>::new());
    writer
        .write_record([
            "INDEX_NAME",
            "INDEX_DATE",
            "OPEN_INDEX_VALUE",
            "HIGH_INDEX_VALUE",
            "LOW_INDEX_VALUE",
            "CLOSING_INDEX_VALUE",
            "PREV_CLOSE",
            "VOLUME",
        ])
        .map_err(|error| error.to_string())?;

    let mut usable_rows = 0_usize;
    for row in rows {
        let name = json_scalar_to_string(row.get("I_name"));
        if name.is_empty() {
            continue;
        }

        let raw_date = json_scalar_to_string(row.get("date"));
        let Some(normalized_date) = normalize_trade_date_value(&raw_date) else {
            return Err(format!(
                "BSE Index archive returned unrecognized date: {raw_date}"
            ));
        };
        if normalized_date != trade_date {
            return Err(format!(
                "BSE Index archive date mismatch: requested {trade_date}, response contains {normalized_date}"
            ));
        }

        let open = json_scalar_to_string(row.get("I_open"));
        let high = json_scalar_to_string(row.get("I_high"));
        let low = json_scalar_to_string(row.get("I_low"));
        let close = json_scalar_to_string(row.get("I_close"));
        if [open.as_str(), high.as_str(), low.as_str(), close.as_str()]
            .iter()
            .any(|value| is_missing_index_value(value))
        {
            continue;
        }

        let prev_close = json_scalar_to_string(row.get("Prev_Close"));
        let raw_volume = json_scalar_to_string(row.get("Volume"));
        let volume = if raw_volume.is_empty() {
            0_i64
        } else {
            (parse_decimal(&raw_volume) * BSE_INDEX_VOLUME_CRORE_UNITS)
                .round()
                .max(0.0) as i64
        };

        writer
            .write_record([
                name,
                normalized_date,
                open,
                high,
                low,
                close,
                prev_close,
                volume.to_string(),
            ])
            .map_err(|error| error.to_string())?;
        usable_rows += 1;
    }

    if usable_rows == 0 {
        return Ok(None);
    }

    let bytes = writer.into_inner().map_err(|error| error.to_string())?;
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|error| format!("BSE Index normalized CSV was not UTF-8: {error}"))
}

fn json_scalar_to_string(value: Option<&serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(value)) => value.trim().to_string(),
        Some(serde_json::Value::Number(value)) => value.to_string(),
        Some(serde_json::Value::Bool(value)) => value.to_string(),
        _ => String::new(),
    }
}

fn fetch_candidate_bytes(
    client: &Client,
    url: &str,
    referer: &str,
    retries: usize,
) -> AppResult<Option<Vec<u8>>> {
    let mut backoff_ms = 1_000_u64;
    let mut last_error: Option<String> = None;

    for attempt in 1..=retries {
        let mut request = client.get(url).header(REFERER, referer);
        if url.starts_with(BSE_INDEX_ARCHIVE_API_URL) {
            request = request
                .header(ACCEPT, "application/json, text/plain, */*")
                .header("Origin", BSE_BASE_URL);
        }
        match request.send() {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    let bytes = response.bytes().map_err(|error| error.to_string())?;
                    return Ok(Some(bytes.to_vec()));
                }
                if status.as_u16() == 404 {
                    return Ok(None);
                }
                if status.as_u16() == 403 {
                    if attempt == retries {
                        return Ok(None);
                    }
                    thread::sleep(StdDuration::from_millis(backoff_ms));
                    backoff_ms *= 2;
                    continue;
                }
                if status.as_u16() == 429 || status.as_u16() >= 500 {
                    last_error = Some(format!("HTTP {}: {}", status.as_u16(), status));
                    if attempt < retries {
                        thread::sleep(StdDuration::from_millis(backoff_ms));
                        backoff_ms *= 2;
                        continue;
                    }
                } else {
                    return Err(format!("HTTP {}: {}", status.as_u16(), status));
                }
            }
            Err(error) => {
                last_error = Some(error.to_string());
                if attempt < retries {
                    thread::sleep(StdDuration::from_millis(backoff_ms));
                    backoff_ms *= 2;
                    continue;
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| format!("Request failed for {url}")))
}

fn extract_first_csv_from_zip(buffer: &[u8]) -> AppResult<Option<Vec<u8>>> {
    let mut archive = match ZipArchive::new(Cursor::new(buffer)) {
        Ok(archive) => archive,
        Err(_) => return Ok(None),
    };

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = file.name().to_ascii_lowercase();
        if !(name.ends_with(".csv") || name.ends_with(".txt")) {
            continue;
        }
        let mut extracted = Vec::new();
        file.read_to_end(&mut extracted)
            .map_err(|error| error.to_string())?;
        return Ok(Some(extracted));
    }

    Ok(None)
}

fn normalize_nse_index_history_rows(
    rows: &[NseIndexHistoryRow],
    canonical_symbol: &str,
    requested_index_type: &str,
) -> NseIndexHistoryNormalizeResult {
    let mut normalized_rows = Vec::new();
    let mut close_only_skipped = 0_usize;

    for row in rows {
        let Some(timestamp) = row.timestamp.as_deref() else {
            continue;
        };
        let Ok(parsed_date) = NaiveDate::parse_from_str(timestamp, "%d-%b-%Y") else {
            continue;
        };

        let open = row.open.unwrap_or(0.0);
        let high = row.high.unwrap_or(0.0);
        let low = row.low.unwrap_or(0.0);
        let close = row.close.unwrap_or(0.0);
        if close <= 0.0 {
            continue;
        }
        if open <= 0.0 || high <= 0.0 || low <= 0.0 {
            close_only_skipped += 1;
            continue;
        }

        let instrument_name = row
            .index_name
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(requested_index_type)
            .to_string();
        let symbol = map_index_symbol(&instrument_name);
        normalized_rows.push(NseIndexHistoryInsertRow {
            symbol: if symbol == normalize_index_key(&instrument_name) {
                canonical_symbol.to_string()
            } else {
                symbol
            },
            instrument_name,
            trade_date: parsed_date.format("%Y-%m-%d").to_string(),
            open,
            high,
            low,
            close,
            volume: row.traded_qty.unwrap_or(0.0).max(0.0).round() as u64,
        });
    }

    NseIndexHistoryNormalizeResult {
        rows: normalized_rows,
        close_only_skipped,
    }
}

fn insert_nse_index_history_rows(
    database_file_path: &Path,
    exchange: &str,
    normalized: &NseIndexHistoryNormalizeResult,
) -> AppResult<NseIndexHistoryInsertResult> {
    if normalized.rows.is_empty() {
        return Ok(NseIndexHistoryInsertResult {
            rows_inserted: 0,
            max_volume: 0,
            close_only_skipped: normalized.close_only_skipped,
        });
    }

    let normalized_exchange = exchange.to_uppercase();
    let mut connection = open_database_connection(database_file_path)?;
    let storage_mode = get_price_storage_mode(&connection);
    let binary_only = storage_mode == PriceStorageMode::Binary;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let mut insert_instrument = transaction
        .prepare(
            "
              INSERT OR IGNORE INTO instruments (symbol, exchange, name, updated_at)
              VALUES (?, ?, ?, datetime('now'))
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut insert_eod = transaction
        .prepare(
            "
              INSERT OR REPLACE INTO eod_prices
              (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest, trades)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;

    let mut rows_inserted = 0_usize;
    let mut max_volume = 0_u64;
    let mut binary_records = HashMap::<String, Vec<EodRecord>>::new();
    let mut date_counts = HashMap::<String, (usize, u64)>::new();

    for row in &normalized.rows {
        insert_instrument
            .execute(params![
                &row.symbol,
                &normalized_exchange,
                &row.instrument_name
            ])
            .map_err(|error| error.to_string())?;

        if !binary_only {
            insert_eod
                .execute(params![
                    &row.symbol,
                    &normalized_exchange,
                    &row.trade_date,
                    row.open,
                    row.high,
                    row.low,
                    row.close,
                    Option::<f64>::None,
                    row.volume as i64,
                    0_i64,
                    Option::<i64>::None,
                ])
                .map_err(|error| error.to_string())?;
        }

        max_volume = max_volume.max(row.volume);
        let date_entry = date_counts.entry(row.trade_date.clone()).or_insert((0, 0));
        date_entry.0 += 1;
        date_entry.1 = date_entry.1.max(row.volume);
        binary_records
            .entry(row.symbol.clone())
            .or_default()
            .push(EodRecord {
                date: date_to_u32(&row.trade_date),
                flags: 0,
                open: (row.open * DEFAULT_SCALE as f64).round() as i64,
                high: (row.high * DEFAULT_SCALE as f64).round() as i64,
                low: (row.low * DEFAULT_SCALE as f64).round() as i64,
                close: (row.close * DEFAULT_SCALE as f64).round() as i64,
                prev_close: 0,
                volume: row.volume,
                oi: 0,
            });
        rows_inserted += 1;
    }

    drop(insert_instrument);
    drop(insert_eod);
    transaction.commit().map_err(|error| error.to_string())?;

    if let Some(folder_path) = database_file_path.parent() {
        for (symbol, records) in binary_records {
            let bin_path = folder_path
                .join("eod_data")
                .join(&normalized_exchange)
                .join(format!("{}.eod", symbol));

            if let Err(error) = BinaryEodFile::append_or_merge_records(
                &bin_path,
                &symbol,
                &normalized_exchange,
                DEFAULT_SCALE,
                records,
            ) {
                eprintln!(
                    "Binary write failure for {}:{}: {}: {}",
                    normalized_exchange,
                    symbol,
                    bin_path.display(),
                    error
                );
            }
        }
    }

    for (trade_date, (rows_for_date, max_volume_for_date)) in date_counts {
        upsert_download_log_entry(
            &connection,
            &DownloadResult {
                success: true,
                trade_date,
                exchange: normalized_exchange.clone(),
                rows_inserted: rows_for_date,
                max_volume: max_volume_for_date,
                message: "Downloaded from NSE historical index API".to_string(),
            },
        )?;
    }

    Ok(NseIndexHistoryInsertResult {
        rows_inserted,
        max_volume,
        close_only_skipped: normalized.close_only_skipped,
    })
}

fn parse_and_insert(
    database_file_path: &Path,
    csv_content: &str,
    exchange: &str,
    trade_date: &str,
    excluded_series: &[String],
) -> AppResult<ParseInsertResult> {
    let parsed = parse_bhavcopy_csv(csv_content, exchange, trade_date, excluded_series)?;
    if let Some(debug) = parsed.debug.clone() {
        return Ok(ParseInsertResult {
            rows_inserted: 0,
            max_volume: 0,
            debug: Some(debug),
        });
    }

    let parsed_files = vec![parsed];
    let (mut results, _) = insert_parsed_bhavcopy_files(database_file_path, &parsed_files)?;
    Ok(results.remove(0))
}

fn parse_bhavcopy_csv(
    csv_content: &str,
    exchange: &str,
    trade_date: &str,
    excluded_series: &[String],
) -> AppResult<ParsedBhavcopyFile> {
    let trimmed = csv_content.trim();
    if trimmed.is_empty() {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some("Empty response received".to_string()),
        });
    }
    if is_html_response(trimmed) {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some("HTML response instead of CSV".to_string()),
        });
    }

    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(trimmed.as_bytes());
    let rows = reader
        .records()
        .filter_map(|result| match result {
            Ok(record) => {
                let row = record
                    .iter()
                    .map(|value| value.trim().to_string())
                    .collect::<Vec<_>>();
                if row.iter().all(|value| value.is_empty()) {
                    None
                } else {
                    Some(Ok(row))
                }
            }
            Err(error) => Some(Err(error.to_string())),
        })
        .collect::<Result<Vec<_>, _>>()?;

    if rows.len() < 2 {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!("Only {} lines in response", rows.len())),
        });
    }

    let headers = rows[0].clone();
    let normalized_headers = build_csv_header_index(&headers);
    let get_column_index = |names: &[&str]| -> Option<usize> {
        names
            .iter()
            .find_map(|name| normalized_headers.iter().position(|header| header == name))
    };

    let symbol_idx = get_column_index(&[
        "SYMBOL",
        "TCKRSYMB",
        "SC_CODE",
        "SC_NAME",
        "SCGROUP",
        "CODE",
        "INDEX_NAME",
        "INDEXNAME",
    ]);
    let series_idx = get_column_index(&[
        "SERIES",
        "SCTY_SRS",
        "SCTYSRS",
        "SECURITY_SERIES",
        "GROUP",
        "SC_GROUP",
    ]);
    let isin_idx = get_column_index(&["ISIN", "ISIN_CODE", "ISIN_NO", "ISIN_NUMBER"]);
    let open_idx = get_column_index(&[
        "OPEN",
        "OPEN_PRICE",
        "OPENPRICE",
        "OPEN_INDEX_VALUE",
        "OPNPRIC",
    ]);
    let high_idx = get_column_index(&[
        "HIGH",
        "HIGH_PRICE",
        "HIGHPRICE",
        "HIGH_INDEX_VALUE",
        "HGHPRIC",
    ]);
    let low_idx = get_column_index(&["LOW", "LOW_PRICE", "LOWPRICE", "LOW_INDEX_VALUE", "LWPRIC"]);
    let close_idx = get_column_index(&[
        "CLOSE",
        "CLOSE_PRICE",
        "CLOSEPRICE",
        "LTP",
        "CLOSING_INDEX_VALUE",
        "CLSPRIC",
    ]);
    let prev_close_idx =
        get_column_index(&["PREVCLOSE", "PREV_CLOSE", "PREVIOUSCLOSE", "PRVSCLSGPRIC"]);
    let volume_idx = get_column_index(&[
        "TOTTRDQTY",
        "TTL_TRD_QNTY",
        "VOLUME",
        "NOOFSHARES",
        "NO_OF_SHRS",
        "TTLTRADGVOL",
    ]);
    let trades_idx = get_column_index(&[
        "TOTALTRADES",
        "TRADES",
        "NOOFTRADES",
        "NO_OF_TRADES",
        "NO_TRADES",
        "TTLNBOFTXSEXCTD",
        "TTLNOOFTXSEXCTD",
    ]);
    let oi_idx = get_column_index(&[
        "OI",
        "OPEN_INT",
        "OPEN_INTEREST",
        "OPEN INTEREST",
        "OPEN_INT_VAL",
    ]);
    let date_idx = get_column_index(&[
        "TIMESTAMP",
        "DATE",
        "DATE1",
        "TRADE_DATE",
        "TRADE_DT",
        "TRADING_DATE",
        "INDEX_DATE",
        "TRADDT",
    ]);
    let is_index_data = get_column_index(&["INDEX_NAME", "INDEXNAME"]).is_some();

    let Some(symbol_idx) = symbol_idx else {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!(
                "Columns not found. Headers: [{}]",
                headers
                    .iter()
                    .take(8)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
        });
    };
    let Some(close_idx) = close_idx else {
        return Ok(ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: trade_date.to_string(),
            rows: Vec::new(),
            max_volume: 0,
            debug: Some(format!(
                "Columns not found. Headers: [{}]",
                headers
                    .iter()
                    .take(8)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
        });
    };

    let mut resolved_trade_date = trade_date.to_string();
    if let Some(date_idx) = date_idx {
        for row in rows.iter().skip(1) {
            let raw_date = get_csv_value(row, date_idx).trim().to_string();
            if raw_date.is_empty() {
                continue;
            }
            let Some(normalized_date) = normalize_trade_date_value(&raw_date) else {
                return Ok(ParsedBhavcopyFile {
                    exchange: exchange.to_string(),
                    trade_date: trade_date.to_string(),
                    rows: Vec::new(),
                    max_volume: 0,
                    debug: Some(format!("Unrecognized trade date format: {raw_date}")),
                });
            };
            if normalized_date != trade_date {
                return Ok(ParsedBhavcopyFile {
                    exchange: exchange.to_string(),
                    trade_date: trade_date.to_string(),
                    rows: Vec::new(),
                    max_volume: 0,
                    debug: Some(format!(
                        "Archive date mismatch: requested {trade_date}, file contains {normalized_date}"
                    )),
                });
            }
            resolved_trade_date = normalized_date;
            break;
        }
    }

    let excluded = excluded_series
        .iter()
        .map(|value| value.trim().to_uppercase())
        .collect::<HashSet<_>>();
    let normalized_exchange = exchange.to_uppercase();
    let mut max_volume = 0_u64;
    let mut parsed_rows = Vec::<ParsedBhavcopyRow>::new();

    for row in rows.iter().skip(1) {
        let series = series_idx
            .map(|idx| get_csv_value(row, idx).trim().to_uppercase())
            .unwrap_or_default();
        if !series.is_empty() && excluded.contains(&series) {
            continue;
        }
        let isin = isin_idx
            .map(|idx| get_csv_value(row, idx).trim().to_uppercase())
            .unwrap_or_default();

        let raw_symbol = get_csv_value(row, symbol_idx).trim().to_string();
        if raw_symbol.is_empty() {
            continue;
        }

        let symbol = if is_index_data {
            let mapped = map_index_symbol(&raw_symbol);
            if mapped.is_empty() {
                continue;
            }
            mapped
        } else {
            raw_symbol.clone()
        };

        let open_raw = open_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let high_raw = high_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let low_raw = low_idx
            .map(|idx| get_csv_value(row, idx))
            .unwrap_or_default();
        let close_raw = get_csv_value(row, close_idx);

        if is_index_data
            && [
                open_raw.as_str(),
                high_raw.as_str(),
                low_raw.as_str(),
                close_raw.as_str(),
            ]
            .iter()
            .any(|value| is_missing_index_value(value))
        {
            continue;
        }

        let open_value = parse_decimal(&open_raw);
        let high_value = parse_decimal(&high_raw);
        let low_value = parse_decimal(&low_raw);
        let close_value = parse_decimal(&close_raw);
        if close_value == 0.0 && !is_index_data {
            continue;
        }

        let instrument_name = if is_index_data {
            raw_symbol.clone()
        } else {
            symbol.clone()
        };
        let prev_close_value = prev_close_idx.map(|idx| parse_decimal(&get_csv_value(row, idx)));
        let volume_value = volume_idx
            .map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64)
            .unwrap_or(0_i64);
        let oi_value = oi_idx
            .map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64)
            .unwrap_or(0_i64);
        let trades_value =
            trades_idx.map(|idx| parse_decimal(&get_csv_value(row, idx)).round() as i64);

        let volume_u64 = volume_value.max(0) as u64;
        if volume_u64 > max_volume {
            max_volume = volume_u64;
        }

        parsed_rows.push(ParsedBhavcopyRow {
            symbol,
            instrument_name,
            series,
            isin,
            trade_date: resolved_trade_date.clone(),
            open: open_value,
            high: high_value,
            low: low_value,
            close: close_value,
            prev_close: prev_close_value,
            volume: volume_value,
            oi: oi_value,
            trades: trades_value,
            binary_record: EodRecord {
                date: date_to_u32(&resolved_trade_date),
                flags: 0,
                open: (open_value * DEFAULT_SCALE as f64).round() as i64,
                high: (high_value * DEFAULT_SCALE as f64).round() as i64,
                low: (low_value * DEFAULT_SCALE as f64).round() as i64,
                close: (close_value * DEFAULT_SCALE as f64).round() as i64,
                prev_close: (prev_close_value.unwrap_or(0.0) * DEFAULT_SCALE as f64).round() as i64,
                volume: volume_u64,
                oi: oi_value as u64,
            },
        });
    }

    Ok(ParsedBhavcopyFile {
        exchange: normalized_exchange,
        trade_date: resolved_trade_date,
        rows: parsed_rows,
        max_volume,
        debug: None,
    })
}

fn is_html_response(value: &str) -> bool {
    let lowercase = value.trim_start().to_ascii_lowercase();
    lowercase.starts_with("<!doctype") || lowercase.starts_with("<html")
}

fn find_duplicate_symbol_date_rows(parsed_files: &[ParsedBhavcopyFile]) -> (usize, Vec<String>) {
    let mut seen = HashSet::<(String, String, String)>::new();
    let mut duplicate_rows = 0_usize;
    let mut samples = Vec::<String>::new();

    for parsed in parsed_files {
        for row in &parsed.rows {
            let key = (
                parsed.exchange.clone(),
                row.symbol.clone(),
                row.trade_date.clone(),
            );
            if !seen.insert(key) {
                duplicate_rows += 1;
                if samples.len() < 8 {
                    samples.push(format!(
                        "{}:{}@{}",
                        parsed.exchange, row.symbol, row.trade_date
                    ));
                }
            }
        }
    }

    (duplicate_rows, samples)
}

fn insert_parsed_bhavcopy_files(
    database_file_path: &Path,
    parsed_files: &[ParsedBhavcopyFile],
) -> AppResult<(Vec<ParseInsertResult>, BhavcopyInsertTiming)> {
    insert_parsed_bhavcopy_files_with_durability(
        database_file_path,
        parsed_files,
        BinaryWriteDurability::Immediate,
    )
}

fn insert_parsed_bhavcopy_files_with_durability(
    database_file_path: &Path,
    parsed_files: &[ParsedBhavcopyFile],
    append_durability: BinaryWriteDurability,
) -> AppResult<(Vec<ParseInsertResult>, BhavcopyInsertTiming)> {
    insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
        database_file_path,
        parsed_files,
        append_durability,
        None,
    )
}

fn insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
    database_file_path: &Path,
    parsed_files: &[ParsedBhavcopyFile],
    append_durability: BinaryWriteDurability,
    recovery_baselines: Option<&[RecoveryBinaryBaseline]>,
) -> AppResult<(Vec<ParseInsertResult>, BhavcopyInsertTiming)> {
    let mut connection = open_database_connection(database_file_path)?;
    let storage_mode = get_price_storage_mode(&connection);
    let binary_only = storage_mode == PriceStorageMode::Binary;
    let parsed_jobs = parsed_files.len();
    let parsed_rows = parsed_files
        .iter()
        .map(|parsed| parsed.rows.len())
        .sum::<usize>();
    let (duplicate_symbol_date_rows, duplicate_symbol_date_samples) =
        find_duplicate_symbol_date_rows(parsed_files);
    let mut results = parsed_files
        .iter()
        .map(|parsed| ParseInsertResult {
            rows_inserted: 0,
            max_volume: parsed.max_volume,
            debug: None,
        })
        .collect::<Vec<_>>();
    let mut binary_records = HashMap::<String, HashMap<String, Vec<BhavcopyBinaryRecord>>>::new();
    let metadata_upsert_started = Instant::now();

    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let mut insert_instrument = transaction
        .prepare(
            "
              INSERT INTO instruments (symbol, exchange, name, series, isin, series_as_of_date, updated_at)
              VALUES (?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), datetime('now'))
              ON CONFLICT(symbol, exchange) DO UPDATE SET
                name = CASE
                  WHEN (instruments.name IS NULL OR instruments.name = '')
                    AND excluded.name IS NOT NULL
                    AND excluded.name <> ''
                    THEN excluded.name
                  ELSE instruments.name
                END,
                series = CASE
                  WHEN excluded.series IS NOT NULL
                    AND (
                      instruments.series_as_of_date IS NULL
                      OR excluded.series_as_of_date >= instruments.series_as_of_date
                    )
                    THEN excluded.series
                  ELSE instruments.series
                END,
                isin = CASE
                  WHEN excluded.isin IS NOT NULL AND excluded.isin <> ''
                    THEN excluded.isin
                  ELSE instruments.isin
                END,
                series_as_of_date = CASE
                  WHEN excluded.series IS NOT NULL
                    AND (
                      instruments.series_as_of_date IS NULL
                      OR excluded.series_as_of_date >= instruments.series_as_of_date
                    )
                    THEN excluded.series_as_of_date
                  ELSE instruments.series_as_of_date
                END,
                updated_at = excluded.updated_at
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut insert_eod = transaction
        .prepare(
            "
              INSERT OR REPLACE INTO eod_prices
              (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest, trades)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
        )
        .map_err(|error| error.to_string())?;

    for (file_index, parsed) in parsed_files.iter().enumerate() {
        for row in &parsed.rows {
            insert_instrument
                .execute(params![
                    &row.symbol,
                    &parsed.exchange,
                    &row.instrument_name,
                    &row.series,
                    &row.isin,
                    &row.trade_date,
                ])
                .map_err(|error| error.to_string())?;

            if !binary_only {
                insert_eod
                    .execute(params![
                        &row.symbol,
                        &parsed.exchange,
                        &row.trade_date,
                        row.open,
                        row.high,
                        row.low,
                        row.close,
                        row.prev_close,
                        row.volume,
                        row.oi,
                        row.trades,
                    ])
                    .map_err(|error| error.to_string())?;
            }

            binary_records
                .entry(parsed.exchange.clone())
                .or_default()
                .entry(row.symbol.clone())
                .or_default()
                .push(BhavcopyBinaryRecord {
                    file_index,
                    record: row.binary_record,
                });
            if !binary_only {
                results[file_index].rows_inserted += 1;
            }
        }
    }

    let metadata_upsert_ms = metadata_upsert_started.elapsed().as_millis();
    let binary_symbols = binary_records
        .values()
        .map(|symbol_records| symbol_records.len())
        .sum::<usize>();

    drop(insert_instrument);
    drop(insert_eod);
    let transaction_commit_started = Instant::now();
    transaction.commit().map_err(|error| error.to_string())?;
    let transaction_commit_ms = transaction_commit_started.elapsed().as_millis();

    let binary_filter_ms = 0_u128;
    let mut binary_write_ms = 0_u128;
    let binary_workers = if binary_symbols == 0 {
        0
    } else {
        bhavcopy_binary_worker_count(binary_symbols)
    };
    let mut binary_write_stats = BhavcopyBinaryWriteStats::default();
    let mut append_newest_fast_hint_stats = BhavcopyAppendNewestFastHintStats::default();
    if let Some(folder_path) = database_file_path.parent() {
        let binary_records = sort_bhavcopy_binary_records(binary_records);
        let append_newest_hints = if let Some(baselines) = recovery_baselines {
            let (hints, stats) = build_bhavcopy_append_newest_fast_hints(folder_path, baselines);
            append_newest_fast_hint_stats = stats;
            hints
        } else {
            HashMap::new()
        };

        let binary_write_started = Instant::now();
        for result in write_bhavcopy_binary_records_parallel(
            folder_path,
            binary_records,
            append_durability,
            &append_newest_hints,
        )? {
            binary_write_stats.record(&result);
            if let Some(error) = result.error.as_ref() {
                eprintln!("{}", error);
            }
            if binary_only {
                for (file_index, rows_inserted) in result.inserted_rows_by_file {
                    results[file_index].rows_inserted += rows_inserted;
                }
            }
        }
        binary_write_ms = binary_write_started.elapsed().as_millis();
    }
    let binary_diagnostics = binary_write_stats.diagnostics_summary();

    Ok((
        results,
        BhavcopyInsertTiming {
            parsed_jobs,
            parsed_rows,
            duplicate_symbol_date_rows,
            duplicate_symbol_date_samples,
            binary_symbols,
            binary_workers,
            binary_inserted_dates: binary_write_stats.inserted_dates,
            binary_changed_dates: binary_write_stats.changed_dates,
            binary_unchanged_dates: binary_write_stats.unchanged_dates,
            binary_inserted_symbols: binary_write_stats.inserted_symbols,
            binary_changed_symbols: binary_write_stats.changed_symbols,
            binary_unchanged_symbols: binary_write_stats.unchanged_symbols,
            binary_errors: binary_write_stats.errors,
            binary_diagnostics,
            append_newest_fast_hint_stats,
            metadata_upsert_ms,
            transaction_commit_ms,
            binary_filter_ms,
            binary_write_ms,
        },
    ))
}

fn sort_bhavcopy_binary_records(
    mut binary_records: HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>>,
) -> HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>> {
    for symbol_records in binary_records.values_mut() {
        for records in symbol_records.values_mut() {
            records.sort_by_key(|record| record.record.date);
        }
    }
    binary_records
}

fn bhavcopy_binary_worker_count(total_symbols: usize) -> usize {
    let available = thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1);
    total_symbols
        .min(available.min(MAX_BHAVCOPY_BINARY_WORKERS))
        .max(1)
}

fn flatten_bhavcopy_binary_records(
    binary_records: HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>>,
) -> Vec<(String, String, Vec<BhavcopyBinaryRecord>)> {
    let mut ordered_records = Vec::<(String, String, Vec<BhavcopyBinaryRecord>)>::new();
    for (exchange, symbol_records) in binary_records {
        for (symbol, records) in symbol_records {
            ordered_records.push((exchange.clone(), symbol, records));
        }
    }
    ordered_records.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    ordered_records
}

fn write_bhavcopy_binary_records_parallel(
    folder_path: &Path,
    binary_records: HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>>,
    append_durability: BinaryWriteDurability,
    append_newest_hints: &HashMap<(String, String), BinaryAppendNewestHint>,
) -> AppResult<Vec<BhavcopyBinaryWriteResult>> {
    let mut ordered_records =
        flatten_bhavcopy_binary_records(sort_bhavcopy_binary_records(binary_records));
    let total_symbols = ordered_records.len();
    if total_symbols == 0 {
        return Ok(Vec::new());
    }

    if total_symbols == 1 {
        let (exchange, symbol, records) = ordered_records.pop().unwrap();
        let append_newest_hint = append_newest_hints
            .get(&(exchange.clone(), symbol.clone()))
            .copied();
        return Ok(vec![write_bhavcopy_binary_records_for_symbol(
            folder_path,
            exchange,
            symbol,
            records,
            append_durability,
            append_newest_hint,
        )]);
    }

    let worker_count = bhavcopy_binary_worker_count(total_symbols);
    let queue = Arc::new(Mutex::new(VecDeque::from(ordered_records)));
    let append_newest_hints = Arc::new(append_newest_hints.clone());
    let folder_path = folder_path.to_path_buf();
    let (result_tx, result_rx) = mpsc::channel::<BhavcopyBinaryWriteResult>();
    let mut handles = Vec::with_capacity(worker_count);

    for _ in 0..worker_count {
        let queue = Arc::clone(&queue);
        let result_tx = result_tx.clone();
        let folder_path = folder_path.clone();
        let append_newest_hints = Arc::clone(&append_newest_hints);
        let append_durability = append_durability;
        handles.push(thread::spawn(move || loop {
            let next_item = {
                let mut queue = queue.lock().expect("bhavcopy binary write queue poisoned");
                queue.pop_front()
            };

            let Some((exchange, symbol, records)) = next_item else {
                break;
            };

            let append_newest_hint = append_newest_hints
                .get(&(exchange.clone(), symbol.clone()))
                .copied();
            let result = write_bhavcopy_binary_records_for_symbol(
                &folder_path,
                exchange,
                symbol,
                records,
                append_durability,
                append_newest_hint,
            );
            if result_tx.send(result).is_err() {
                break;
            }
        }));
    }
    drop(result_tx);

    let mut results = Vec::with_capacity(total_symbols);
    for _ in 0..total_symbols {
        let result = result_rx
            .recv()
            .map_err(|error| format!("Bhavcopy binary write worker failure: {}", error))?;
        results.push(result);
    }

    for handle in handles {
        handle
            .join()
            .map_err(|_| "Bhavcopy binary write worker panicked".to_string())?;
    }

    Ok(results)
}

fn write_bhavcopy_binary_records_for_symbol(
    folder_path: &Path,
    exchange: String,
    symbol: String,
    records: Vec<BhavcopyBinaryRecord>,
    append_durability: BinaryWriteDurability,
    append_newest_hint: Option<BinaryAppendNewestHint>,
) -> BhavcopyBinaryWriteResult {
    let eod_records = records
        .iter()
        .map(|record| record.record)
        .collect::<Vec<_>>();
    let bin_path = folder_path
        .join("eod_data")
        .join(&exchange)
        .join(format!("{}.eod", symbol));

    let write_started = Instant::now();
    let write_result = BinaryEodFile::append_or_merge_records_with_stats_durability_hint(
        &bin_path,
        &symbol,
        &exchange,
        DEFAULT_SCALE,
        eod_records,
        append_durability,
        append_newest_hint,
    );

    match write_result {
        Ok(result) => BhavcopyBinaryWriteResult {
            error: None,
            inserted_rows_by_file: count_inserted_rows_by_file(&records, &result.stats),
            stats: result.stats,
            diagnostics: result.diagnostics,
        },
        Err(error) => {
            let mut diagnostics = BinaryWriteDiagnostics::default();
            diagnostics.total_us = write_started.elapsed().as_micros();
            BhavcopyBinaryWriteResult {
                error: Some(format!(
                    "Binary write failure for {}:{}: {}: {}",
                    exchange,
                    symbol,
                    bin_path.display(),
                    error
                )),
                inserted_rows_by_file: Vec::new(),
                stats: BinaryAppendMergeStats::default(),
                diagnostics,
            }
        }
    }
}

fn count_inserted_rows_by_file(
    records: &[BhavcopyBinaryRecord],
    stats: &BinaryAppendMergeStats,
) -> Vec<(usize, usize)> {
    if stats.inserted_dates.is_empty() {
        return Vec::new();
    }

    let inserted_dates = stats.inserted_dates.iter().copied().collect::<HashSet<_>>();
    let mut inserted_rows_by_file = HashMap::<usize, usize>::new();
    for record in records {
        if inserted_dates.contains(&record.record.date) {
            *inserted_rows_by_file.entry(record.file_index).or_insert(0) += 1;
        }
    }

    let mut ordered = inserted_rows_by_file.into_iter().collect::<Vec<_>>();
    ordered.sort_by_key(|(file_index, _)| *file_index);
    ordered
}

fn open_database_connection(database_file_path: &Path) -> AppResult<Connection> {
    let connection = Connection::open(database_file_path).map_err(|error| error.to_string())?;
    prepare_database_connection(&connection)?;
    Ok(connection)
}

fn storage_mode_has_imported_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => {
            metadata_has_imported_rows_for_date(connection, trade_date, exchange)
        }
        PriceStorageMode::Hybrid => has_imported_rows_for_date(connection, trade_date, exchange),
    }
}

fn storage_mode_get_latest_imported_trade_date(
    connection: &Connection,
    exchange: &str,
) -> AppResult<Option<String>> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => metadata_get_latest_imported_trade_date(connection, exchange),
        PriceStorageMode::Hybrid => get_latest_imported_trade_date(connection, exchange),
    }
}

fn storage_mode_load_imported_trade_dates(
    connection: &Connection,
    exchange: &str,
    start_date: &str,
    end_date: &str,
) -> AppResult<ImportedTradeDates> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => {
            let metadata_started = Instant::now();
            let mut imported_dates =
                metadata_load_imported_trade_dates(connection, exchange, start_date, end_date)?;
            imported_dates.metadata_lookup_ms = metadata_started.elapsed().as_millis();

            let reconcile_started = Instant::now();
            reconcile_binary_imported_trade_dates(connection, exchange, &mut imported_dates)?;
            imported_dates.binary_reconcile_ms = reconcile_started.elapsed().as_millis();
            Ok(imported_dates)
        }
        PriceStorageMode::Hybrid => {
            let metadata_started = Instant::now();
            let mut imported_dates =
                load_imported_trade_dates(connection, exchange, start_date, end_date)?;
            imported_dates.metadata_lookup_ms = metadata_started.elapsed().as_millis();
            Ok(imported_dates)
        }
    }
}

fn reconcile_binary_imported_trade_dates(
    connection: &Connection,
    exchange: &str,
    imported_dates: &mut ImportedTradeDates,
) -> AppResult<()> {
    if imported_dates.dates.is_empty()
        || imported_dates.dates.len() > BINARY_PREFILTER_RECONCILE_MAX_DATES
    {
        return Ok(());
    }

    let Some(database_folder) = connection_database_folder(connection)? else {
        return Ok(());
    };
    let binary_folder = database_folder.join("eod_data").join(exchange);
    if !binary_folder.is_dir() {
        return Ok(());
    }

    let expected_rows =
        metadata_load_imported_row_counts(connection, exchange, &imported_dates.dates)?;
    let date_keys = imported_dates
        .dates
        .iter()
        .map(|trade_date| (trade_date.clone(), date_to_u32(trade_date)))
        .collect::<HashMap<_, _>>();
    imported_dates.binary_reconcile_target_dates = date_keys.len();
    let (binary_counts, binary_files_scanned) = count_binary_files_containing_dates(
        &binary_folder,
        date_keys.values().copied().collect::<Vec<_>>(),
    )?;
    imported_dates.binary_reconcile_files_scanned = binary_files_scanned;
    let mut metadata_only_dates = Vec::<String>::new();
    for trade_date in &imported_dates.dates {
        let expected = expected_rows.get(trade_date).copied().unwrap_or(1);
        let actual = date_keys
            .get(trade_date)
            .and_then(|date| binary_counts.get(date))
            .copied()
            .unwrap_or(0);
        let has_usable_binary_coverage = actual > 0
            && (expected < 100 || actual.saturating_mul(10) >= expected.saturating_mul(8));
        if !has_usable_binary_coverage {
            metadata_only_dates.push(trade_date.clone());
        }
    }

    for trade_date in metadata_only_dates {
        if imported_dates.dates.remove(&trade_date) {
            imported_dates.metadata_only_dates += 1;
        }
    }

    Ok(())
}

fn storage_mode_has_stale_zero_volume_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => {
            metadata_has_stale_zero_volume_rows_for_date(connection, trade_date, exchange)
        }
        PriceStorageMode::Hybrid => {
            has_stale_zero_volume_rows_for_date(connection, trade_date, exchange)
        }
    }
}

fn connection_database_folder(connection: &Connection) -> AppResult<Option<PathBuf>> {
    let database_path = connection
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name = 'main'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(database_path.and_then(|path| {
        if path.is_empty() {
            None
        } else {
            PathBuf::from(path)
                .parent()
                .map(|parent| parent.to_path_buf())
        }
    }))
}

fn metadata_load_imported_row_counts(
    connection: &Connection,
    exchange: &str,
    dates: &HashSet<String>,
) -> AppResult<HashMap<String, usize>> {
    if dates.is_empty() {
        return Ok(HashMap::new());
    }

    let start_date = dates.iter().min().cloned().unwrap_or_default();
    let end_date = dates.iter().max().cloned().unwrap_or_default();
    let mut statement = connection
        .prepare(
            "
              SELECT trade_date, rows_inserted
              FROM download_log
              WHERE exchange = ?
                AND trade_date >= ?
                AND trade_date <= ?
                AND status = 'ok'
                AND rows_inserted > 0
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange, start_date, end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|error| error.to_string())?;

    let mut counts = HashMap::<String, usize>::new();
    for row in rows {
        let (trade_date, rows_inserted) = row.map_err(|error| error.to_string())?;
        if dates.contains(&trade_date) {
            counts.insert(trade_date, rows_inserted.max(0) as usize);
        }
    }
    Ok(counts)
}

fn count_binary_files_containing_dates(
    binary_folder: &Path,
    mut target_dates: Vec<u32>,
) -> AppResult<(HashMap<u32, usize>, usize)> {
    target_dates.sort_unstable();
    target_dates.dedup();
    let mut counts = target_dates
        .iter()
        .copied()
        .map(|date| (date, 0_usize))
        .collect::<HashMap<_, _>>();
    if target_dates.is_empty() {
        return Ok((counts, 0));
    }

    let binary_paths = fs::read_dir(binary_folder)
        .map_err(|error| error.to_string())?
        .map(|entry| entry.map_err(|error| error.to_string()))
        .collect::<AppResult<Vec<_>>>()?
        .into_iter()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("eod"))
        })
        .collect::<Vec<_>>();

    let binary_files_scanned = binary_paths.len();
    if binary_paths.is_empty() {
        return Ok((counts, 0));
    }

    let worker_count = bhavcopy_prefilter_worker_count(binary_paths.len());
    let chunk_size = (binary_paths.len() + worker_count - 1) / worker_count;
    let target_dates = Arc::new(target_dates);
    let mut worker_handles = Vec::with_capacity(worker_count);

    for chunk in binary_paths.chunks(chunk_size) {
        let worker_paths = chunk.to_vec();
        let worker_target_dates = Arc::clone(&target_dates);
        worker_handles.push(thread::spawn(move || -> AppResult<HashMap<u32, usize>> {
            let mut worker_counts = worker_target_dates
                .iter()
                .copied()
                .map(|date| (date, 0_usize))
                .collect::<HashMap<_, _>>();

            for path in worker_paths {
                for date in binary_file_contained_dates(&path, worker_target_dates.as_slice())? {
                    if let Some(count) = worker_counts.get_mut(&date) {
                        *count += 1;
                    }
                }
            }

            Ok(worker_counts)
        }));
    }

    let mut first_error = None::<String>;
    for handle in worker_handles {
        match handle.join() {
            Ok(Ok(worker_counts)) => {
                for (date, worker_count) in worker_counts {
                    if let Some(count) = counts.get_mut(&date) {
                        *count += worker_count;
                    }
                }
            }
            Ok(Err(error)) => {
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
            Err(_) => {
                if first_error.is_none() {
                    first_error =
                        Some("Bhavcopy binary prefilter worker thread panicked.".to_string());
                }
            }
        }
    }

    if let Some(error) = first_error {
        return Err(error);
    }

    Ok((counts, binary_files_scanned))
}

fn bhavcopy_prefilter_worker_count(file_count: usize) -> usize {
    if file_count == 0 {
        0
    } else {
        file_count.min(MAX_BHAVCOPY_PREFILTER_WORKERS)
    }
}

fn binary_file_contained_dates(path: &Path, target_dates: &[u32]) -> AppResult<Vec<u32>> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut header = [0_u8; HEADER_SIZE];
    file.read_exact(&mut header)
        .map_err(|error| error.to_string())?;
    let record_count = u32::from_le_bytes(header[8..12].try_into().unwrap()) as usize;
    if record_count == 0 {
        return Ok(Vec::new());
    }

    let first_date = read_binary_date_at(&mut file, 0)?;
    let last_date = read_binary_date_at(&mut file, record_count - 1)?;
    let target_first = target_dates[0];
    let target_last = target_dates[target_dates.len() - 1];
    if target_last < first_date || target_first > last_date {
        return Ok(Vec::new());
    }

    let overlap_first = target_first.max(first_date);
    let overlap_last = target_last.min(last_date);
    let start_index =
        binary_file_lower_bound_date_with_open_file(&mut file, record_count, overlap_first)?;
    let end_index =
        binary_file_upper_bound_date_with_open_file(&mut file, record_count, overlap_last)?;
    if start_index >= end_index {
        return Ok(Vec::new());
    }

    let record_window = end_index - start_index;
    let byte_count = record_window
        .checked_mul(RECORD_SIZE)
        .ok_or_else(|| "Bhavcopy binary prefilter byte-window overflow.".to_string())?;
    file.seek(SeekFrom::Start(
        (HEADER_SIZE + start_index * RECORD_SIZE) as u64,
    ))
    .map_err(|error| error.to_string())?;
    let mut buffer = vec![0_u8; byte_count];
    file.read_exact(&mut buffer)
        .map_err(|error| error.to_string())?;

    let mut found = Vec::<u32>::new();
    for record in buffer.chunks_exact(RECORD_SIZE) {
        let date = u32::from_le_bytes(record[0..4].try_into().unwrap());
        if target_dates.binary_search(&date).is_ok() && found.last().copied() != Some(date) {
            found.push(date);
        }
    }

    Ok(found)
}

fn binary_file_lower_bound_date_with_open_file(
    file: &mut fs::File,
    record_count: usize,
    target_date: u32,
) -> AppResult<usize> {
    let mut low = 0_usize;
    let mut high = record_count;
    while low < high {
        let mid = low + (high - low) / 2;
        let date = read_binary_date_at(file, mid)?;
        if date < target_date {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    Ok(low)
}

fn binary_file_upper_bound_date_with_open_file(
    file: &mut fs::File,
    record_count: usize,
    target_date: u32,
) -> AppResult<usize> {
    let mut low = 0_usize;
    let mut high = record_count;
    while low < high {
        let mid = low + (high - low) / 2;
        let date = read_binary_date_at(file, mid)?;
        if date <= target_date {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    Ok(low)
}

fn read_binary_date_at(file: &mut fs::File, index: usize) -> AppResult<u32> {
    file.seek(SeekFrom::Start((HEADER_SIZE + index * RECORD_SIZE) as u64))
        .map_err(|error| error.to_string())?;
    let mut buffer = [0_u8; 4];
    file.read_exact(&mut buffer)
        .map_err(|error| error.to_string())?;
    Ok(u32::from_le_bytes(buffer))
}
fn has_imported_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    Ok(connection
        .query_row(
            "
              SELECT 1
              FROM eod_prices
              WHERE date = ?
                AND exchange = ?
              LIMIT 1
            ",
            params![trade_date, exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .is_some())
}

fn get_latest_imported_trade_date(
    connection: &Connection,
    exchange: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "
              SELECT MAX(date)
              FROM eod_prices
              WHERE exchange = ?
            ",
            params![exchange],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|error| error.to_string())
}

fn load_imported_trade_dates(
    connection: &Connection,
    exchange: &str,
    start_date: &str,
    end_date: &str,
) -> AppResult<ImportedTradeDates> {
    let normalized_exchange = normalize_exchange_key(exchange);
    if normalized_exchange == "NSE" || normalized_exchange == "NSEINDEX" {
        let mut statement = connection
            .prepare(
                "
                  SELECT date, COALESCE(MAX(volume), 0) AS max_volume
                  FROM eod_prices
                  WHERE exchange = ?
                    AND date >= ?
                    AND date <= ?
                  GROUP BY date
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![exchange, start_date, end_date], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|error| error.to_string())?;

        let mut imported_dates = ImportedTradeDates::default();
        for row in rows {
            let (trade_date, max_volume) = row.map_err(|error| error.to_string())?;
            if max_volume > 0 {
                imported_dates.dates.insert(trade_date);
            } else {
                imported_dates.stale_zero_volume_dates += 1;
            }
        }

        return Ok(imported_dates);
    }

    let mut statement = connection
        .prepare(
            "
              SELECT DISTINCT date
              FROM eod_prices
              WHERE exchange = ?
                AND date >= ?
                AND date <= ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange, start_date, end_date], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|error| error.to_string())?;

    let mut imported_dates = ImportedTradeDates::default();
    for row in rows {
        imported_dates
            .dates
            .insert(row.map_err(|error| error.to_string())?);
    }

    Ok(imported_dates)
}

fn has_stale_zero_volume_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    let normalized_exchange = normalize_exchange_key(exchange);
    if normalized_exchange != "NSE" && normalized_exchange != "NSEINDEX" {
        return Ok(false);
    }

    let (row_count, max_volume) = connection
        .query_row(
            "
              SELECT COUNT(*), COALESCE(MAX(volume), 0)
              FROM eod_prices
              WHERE date = ?
                AND exchange = ?
            ",
            params![trade_date, exchange],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(|error| error.to_string())?;

    Ok(row_count > 0 && max_volume == 0)
}

fn clear_download_log_entry(connection: &Connection, id: i64) -> AppResult<()> {
    connection
        .execute("DELETE FROM download_log WHERE id = ?", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn should_write_download_log(result: &DownloadResult) -> bool {
    !(result.success && result.rows_inserted == 0)
}

fn upsert_download_log_entry(connection: &Connection, result: &DownloadResult) -> AppResult<()> {
    if result.success {
        connection
            .execute(
                "
                  INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status, note)
                  VALUES (?, ?, ?, ?, 'ok', NULL)
                  ON CONFLICT(trade_date, exchange) DO UPDATE SET
                    rows_inserted = excluded.rows_inserted,
                    max_volume = excluded.max_volume,
                    downloaded_at = datetime('now'),
                    status = excluded.status,
                    note = NULL
                ",
                params![
                    &result.trade_date,
                    &result.exchange,
                    result.rows_inserted as i64,
                    result.max_volume as i64,
                ],
            )
            .map_err(|error| error.to_string())?;
    } else {
        connection
            .execute(
                "
                  INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status, note)
                  VALUES (?, ?, 0, 0, 'error', ?)
                  ON CONFLICT(trade_date, exchange) DO UPDATE SET
                    rows_inserted = excluded.rows_inserted,
                    max_volume = excluded.max_volume,
                    downloaded_at = datetime('now'),
                    status = excluded.status,
                    note = excluded.note
                ",
                params![&result.trade_date, &result.exchange, &result.message],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn metadata_has_imported_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    Ok(connection
        .query_row(
            "
              SELECT 1
              FROM download_log
              WHERE trade_date = ?
                AND exchange = ?
                AND status = 'ok'
                AND rows_inserted > 0
              LIMIT 1
            ",
            params![trade_date, exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .is_some())
}

fn metadata_get_latest_imported_trade_date(
    connection: &Connection,
    exchange: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "
              SELECT MAX(trade_date)
              FROM download_log
              WHERE exchange = ?
                AND status = 'ok'
                AND rows_inserted > 0
            ",
            params![exchange],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|error| error.to_string())
}

fn metadata_load_imported_trade_dates(
    connection: &Connection,
    exchange: &str,
    start_date: &str,
    end_date: &str,
) -> AppResult<ImportedTradeDates> {
    let mut statement = connection
        .prepare(
            "
              SELECT trade_date, max_volume
              FROM download_log
              WHERE exchange = ?
                AND trade_date >= ?
                AND trade_date <= ?
                AND status = 'ok'
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange, start_date, end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|error| error.to_string())?;

    let mut imported_dates = ImportedTradeDates::default();
    let normalized_exchange = normalize_exchange_key(exchange);
    let is_stale_aware = normalized_exchange == "NSE" || normalized_exchange == "NSEINDEX";

    for row in rows {
        let (trade_date, max_vol) = row.map_err(|error| error.to_string())?;
        if is_stale_aware && max_vol == 0 {
            imported_dates.stale_zero_volume_dates += 1;
        } else {
            imported_dates.dates.insert(trade_date);
        }
    }

    Ok(imported_dates)
}

fn metadata_has_stale_zero_volume_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    let normalized_exchange = normalize_exchange_key(exchange);
    if normalized_exchange != "NSE" && normalized_exchange != "NSEINDEX" {
        return Ok(false);
    }

    Ok(connection
        .query_row(
            "
              SELECT 1
              FROM download_log
              WHERE trade_date = ?
                AND exchange = ?
                AND status = 'ok'
                AND rows_inserted > 0
                AND max_volume = 0
              LIMIT 1
            ",
            params![trade_date, exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .is_some())
}

fn create_holiday_skip_result(
    exchange: &str,
    trade_date: &str,
    holiday_name: &str,
) -> DownloadResult {
    skipped_download_result(
        exchange,
        trade_date,
        format!("Exchange holiday ({holiday_name})"),
    )
}

fn create_weekend_skip_result(
    exchange: &str,
    trade_date: &str,
    weekday: Weekday,
) -> DownloadResult {
    skipped_download_result(
        exchange,
        trade_date,
        format!("Weekend ({})", weekday_name(weekday)),
    )
}

fn create_calendar_skip_result(
    connection: &Connection,
    exchange: &str,
    trade_date: &str,
    weekday: Weekday,
) -> Option<DownloadResult> {
    if is_special_trading_day(exchange, trade_date) {
        return None;
    }

    let holiday_name = get_exchange_holiday_name(connection, exchange, trade_date).unwrap_or(None);
    if matches!(weekday, Weekday::Sat | Weekday::Sun) {
        return Some(match holiday_name {
            Some(holiday_name) => skipped_download_result(
                exchange,
                trade_date,
                format!(
                    "Weekend ({}); Exchange holiday ({holiday_name})",
                    weekday_name(weekday)
                ),
            ),
            None => create_weekend_skip_result(exchange, trade_date, weekday),
        });
    }

    holiday_name.map(|holiday_name| create_holiday_skip_result(exchange, trade_date, &holiday_name))
}

fn is_calendar_skip_result(result: &DownloadResult) -> bool {
    result.success
        && result.rows_inserted == 0
        && (result.message.starts_with("Exchange holiday")
            || result.message.starts_with("Weekend ("))
}

fn get_exchange_holiday_name(
    connection: &Connection,
    exchange: &str,
    trade_date: &str,
) -> AppResult<Option<String>> {
    let normalized_exchange = normalize_exchange_key(exchange);
    if is_shared_cash_market_holiday_exchange(&normalized_exchange)
        && !is_special_trading_day_for_normalized_exchange(&normalized_exchange, trade_date)
    {
        return load_holiday_name_for_date(connection, trade_date);
    }
    Ok(None)
}

fn special_trading_day_name(exchange: &str, trade_date: &str) -> Option<&'static str> {
    let normalized_exchange = normalize_exchange_key(exchange);
    special_trading_day_name_for_normalized_exchange(&normalized_exchange, trade_date)
}

fn special_trading_day_name_for_normalized_exchange(
    normalized_exchange: &str,
    trade_date: &str,
) -> Option<&'static str> {
    let calendar = match normalized_exchange {
        "NSE" | "NSEINDEX" => NSE_SPECIAL_TRADING_DAYS,
        "BSE" | "BSEINDEX" => BSE_SPECIAL_TRADING_DAYS,
        _ => return None,
    };

    calendar
        .iter()
        .find_map(|(date, name)| (*date == trade_date).then_some(*name))
}

fn is_special_trading_day(exchange: &str, trade_date: &str) -> bool {
    special_trading_day_name(exchange, trade_date).is_some()
}

fn is_special_trading_day_for_normalized_exchange(
    normalized_exchange: &str,
    trade_date: &str,
) -> bool {
    special_trading_day_name_for_normalized_exchange(normalized_exchange, trade_date).is_some()
}

fn is_shared_cash_market_holiday_exchange(normalized_exchange: &str) -> bool {
    matches!(normalized_exchange, "NSE" | "NSEINDEX" | "BSE" | "BSEINDEX")
}

/// Query the market_holidays table for a specific date.
/// Returns the holiday name if a matching row exists, or None if it is a normal trading day.
pub(crate) fn load_holiday_name_for_date(
    connection: &Connection,
    trade_date: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "SELECT name FROM market_holidays WHERE date = ? LIMIT 1",
            params![trade_date],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
}

fn weekday_name(weekday: Weekday) -> &'static str {
    match weekday {
        Weekday::Mon => "Monday",
        Weekday::Tue => "Tuesday",
        Weekday::Wed => "Wednesday",
        Weekday::Thu => "Thursday",
        Weekday::Fri => "Friday",
        Weekday::Sat => "Saturday",
        Weekday::Sun => "Sunday",
    }
}

fn normalize_exchange_key(exchange: &str) -> String {
    exchange
        .to_uppercase()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .collect()
}

fn compare_download_results(left: &DownloadResult, right: &DownloadResult) -> std::cmp::Ordering {
    left.trade_date.cmp(&right.trade_date).then_with(|| {
        normalize_exchange_key(&left.exchange).cmp(&normalize_exchange_key(&right.exchange))
    })
}

fn compare_download_task(left: &DownloadTask, right: &DownloadTask) -> std::cmp::Ordering {
    left.trade_date.cmp(&right.trade_date).then_with(|| {
        normalize_exchange_key(&left.exchange).cmp(&normalize_exchange_key(&right.exchange))
    })
}

fn apply_template(template: &str, date: NaiveDate) -> String {
    let short_month = short_month_name(date.month());
    let date_key = date.format("%Y%m%d").to_string();
    let ddmmyyyy = date.format("%d%m%Y").to_string();
    let ddmmyy = date.format("%d%m%y").to_string();
    let yyyymmdd = date.format("%Y-%m-%d").to_string();
    let year = date.year().to_string();
    let month = format!("{:02}", date.month());
    let day = format!("{:02}", date.day());

    template
        .replace("{ddmmyyyy}", &ddmmyyyy)
        .replace("{ddmmyy}", &ddmmyy)
        .replace("{date_key}", &date_key)
        .replace("{yyyymmdd}", &yyyymmdd)
        .replace("{year}", &year)
        .replace("{month}", &month)
        .replace("{day}", &day)
        .replace("{MMM}", short_month)
}

fn generate_nse_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    let udiff_start = NaiveDate::parse_from_str(EXCHANGE_UDIFF_START, "%Y-%m-%d")
        .expect("valid exchange UDiFF start date");
    let new_path = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{date_key}_F_0000.csv.zip",
            date,
        ),
        true,
    );
    let sec_full_path = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv",
            date,
        ),
        false,
    );
    let legacy_primary = Candidate::direct(
        apply_template(
            "https://archives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip",
            date,
        ),
        true,
    );
    let legacy_secondary = Candidate::direct(
        apply_template(
            "https://nsearchives.nseindia.com/content/historical/EQUITIES/{year}/{MMM}/cm{day}{MMM}{year}bhav.csv.zip",
            date,
        ),
        true,
    );

    if date >= udiff_start {
        candidates.extend([new_path, sec_full_path, legacy_primary, legacy_secondary]);
    } else {
        candidates.extend([legacy_primary, legacy_secondary, new_path, sec_full_path]);
    }

    candidates
}

fn generate_bse_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    let udiff_start = NaiveDate::parse_from_str(EXCHANGE_UDIFF_START, "%Y-%m-%d")
        .expect("valid exchange UDiFF start date");
    let modern_direct = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{date_key}_F_0000.CSV",
            date,
        ),
        false,
    );
    let legacy_archive = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP",
            date,
        ),
        true,
    );
    let live_api = Candidate::bse_api(
        apply_template(
            "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=equity&date={date_key}",
            date,
        ),
        "https://www.bseindia.com/download/BhavCopy/Equity/",
        "dsedcudiff",
    );
    let legacy_api = Candidate::direct(
        apply_template(
            "https://api.bseindia.com/BseIndiaAPI/api/EquityBhavcopy/ws/getEquityBhavcopy?date={ddmmyyyy}",
            date,
        ),
        false,
    );
    let legacy_direct = Candidate::direct(
        apply_template(
            "https://www.bseindia.com/download/BhavCopy/Equity_Bhavcopy_{ddmmyyyy}.csv",
            date,
        ),
        false,
    );

    if date >= udiff_start {
        candidates.extend([
            modern_direct,
            legacy_archive,
            live_api,
            legacy_api,
            legacy_direct,
        ]);
    } else {
        candidates.extend([
            legacy_archive,
            modern_direct,
            live_api,
            legacy_api,
            legacy_direct,
        ]);
    }

    candidates
}

fn generate_nse_index_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    candidates.extend(vec![
        Candidate::direct(
            apply_template(
                "https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
        Candidate::direct(
            "https://www.nseindia.com/archives/nseidx/bhav.csv".to_string(),
            false,
        ),
    ]);

    candidates
}

fn generate_bse_index_candidates(date: NaiveDate, url_override: Option<&String>) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    if let Some(template) = url_override {
        let url = apply_template(template, date);
        let zipped = url.to_lowercase().ends_with(".zip");
        candidates.push(Candidate::direct(url, zipped));
    }

    candidates.extend(vec![
        Candidate::bse_index_archive(build_bse_index_archive_url(date)),
        Candidate::bse_api(
            apply_template(
                "https://api.bseindia.com/BseIndiaAPI/api/GetBhavcopydata/w?flag=1&segment=IndexSum&date={date_key}",
                date,
            ),
            "https://www.bseindia.com/bsedata/Index_Bhavcopy/",
            "dsIndexSum",
        ),
        Candidate::direct(
            apply_template(
                "https://www.bseindia.com/bsedata/Index_Bhavcopy/IndexSummary_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
        Candidate::direct(
            apply_template(
                "https://www.bseindia.com/download/BhavCopy/Index_Bhavcopy_{ddmmyyyy}.csv",
                date,
            ),
            false,
        ),
    ]);

    candidates
}

fn build_bse_index_archive_url(date: NaiveDate) -> String {
    // BSE's historical IndexArchDailyAllPar endpoint is sensitive to the
    // literal DD/MM/YYYY query representation. URL-encoding the slashes as
    // %2F can return HTTP 200 with an empty Table for valid trading dates.
    let api_date = date.format("%d/%m/%Y");
    format!("{BSE_INDEX_ARCHIVE_API_URL}?fmdt={api_date}&index=All&period=D&todt={api_date}")
}

fn short_month_name(month: u32) -> &'static str {
    match month {
        1 => "JAN",
        2 => "FEB",
        3 => "MAR",
        4 => "APR",
        5 => "MAY",
        6 => "JUN",
        7 => "JUL",
        8 => "AUG",
        9 => "SEP",
        10 => "OCT",
        11 => "NOV",
        _ => "DEC",
    }
}

fn build_csv_header_index(headers: &[String]) -> Vec<String> {
    headers
        .iter()
        .map(|header| normalize_csv_header(header))
        .collect()
}

fn normalize_csv_header(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\u{FEFF}')
        .to_uppercase()
        .chars()
        .map(|value| {
            if value.is_ascii_alphanumeric() {
                value
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

fn get_csv_value(row: &[String], index: usize) -> String {
    row.get(index).cloned().unwrap_or_default()
}

fn parse_decimal(value: &str) -> f64 {
    value.replace(',', "").parse::<f64>().unwrap_or(0.0)
}

fn normalize_trade_date_value(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if parse_trade_date(trimmed).is_ok() {
        return Some(trimmed.to_string());
    }
    if let Some((date_part, _)) = trimmed.split_once('T') {
        if parse_trade_date(date_part).is_ok() {
            return Some(date_part.to_string());
        }
    }

    for format in [
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%-d/%-m/%Y",
        "%d.%m.%Y",
    ] {
        if let Ok(parsed) = NaiveDate::parse_from_str(trimmed, format) {
            return Some(parsed.format("%Y-%m-%d").to_string());
        }
    }

    None
}

fn normalize_index_key(name: &str) -> String {
    name.trim()
        .to_uppercase()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .collect()
}

fn map_index_symbol(name: &str) -> String {
    match normalize_index_key(name).as_str() {
        "NIFTY50" | "SPCNXNIFTY" | "CNXNIFTY" => "NIFTY".to_string(),
        "NIFTYBANK" | "BANKNIFTY" | "CNXBANK" => "BANKNIFTY".to_string(),
        "NIFTYFINSERVICE" | "NIFTYFINANCIALSERVICE" | "NIFTYFINANCIALSERVICES" => {
            "FINNIFTY".to_string()
        }
        "NIFTYNEXT50" => "NIFTYNEXT50".to_string(),
        "NIFTYMIDCAPSELECT" => "MIDCPNIFTY".to_string(),
        "NIFTYMIDCAP50" => "MIDCAP50".to_string(),
        "NIFTYSMALLCAP100" => "SMALLCAP100".to_string(),
        "NIFTY100" => "NIFTY100".to_string(),
        "NIFTY200" => "NIFTY200".to_string(),
        "NIFTY500" => "NIFTY500".to_string(),
        "BSESENSEX" | "SENSEX" => "SENSEX".to_string(),
        "BSEBANKEX" | "BANKEX" => "BANKEX".to_string(),
        "BSESENSEX50" | "SENSEX50" => "SENSEX50".to_string(),
        "BSESENSEXNEXT50" | "SENSEXNEXT50" => "SENSEXNEXT50".to_string(),
        other => other.to_string(),
    }
}

fn is_missing_index_value(value: &str) -> bool {
    matches!(
        value.trim().to_uppercase().as_str(),
        "" | "-" | "NA" | "N/A" | "NULL"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::set_price_storage_mode;
    use rusqlite::Connection;

    fn create_temp_bhavcopy_db() -> (tempfile::TempDir, std::path::PathBuf) {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = open_database_connection(&db_path).unwrap();
        drop(conn);
        (temp_dir, db_path)
    }

    fn default_excluded_series_vec() -> Vec<String> {
        DEFAULT_EXCLUDED_SERIES
            .iter()
            .map(|value| (*value).to_string())
            .collect()
    }

    #[test]
    fn v17d_production_bhavcopy_binary_worker_count_is_bounded_to_two() {
        assert_eq!(bhavcopy_binary_worker_count(1), 1);
        assert!(bhavcopy_binary_worker_count(2) <= 2);
        assert!(bhavcopy_binary_worker_count(3) <= 2);
        assert!(bhavcopy_binary_worker_count(usize::MAX) <= 2);
        assert_eq!(MAX_BHAVCOPY_BINARY_WORKERS, 2);
    }

    #[test]
    fn test_background_checkpoint_uses_v17c_two_worker_storage_cap() {
        assert_eq!(MAX_BUFFERED_CHECKPOINT_WORKERS, 2);
        assert_eq!(MAX_BHAVCOPY_BINARY_WORKERS, 2);
    }

    #[test]
    fn test_buffered_checkpoint_resume_states_include_interrupted_checkpointing() {
        assert!(can_resume_buffered_checkpoint(
            &RecoverySessionState::Applied
        ));
        assert!(can_resume_buffered_checkpoint(
            &RecoverySessionState::Checkpointing
        ));
        assert!(!can_resume_buffered_checkpoint(
            &RecoverySessionState::Prepared
        ));
        assert!(!can_resume_buffered_checkpoint(
            &RecoverySessionState::Applying
        ));
        assert!(!can_resume_buffered_checkpoint(
            &RecoverySessionState::Failed
        ));
        assert!(!can_resume_buffered_checkpoint(
            &RecoverySessionState::RecoveryError
        ));
        assert!(!can_resume_buffered_checkpoint(
            &RecoverySessionState::Checkpointed
        ));
    }

    #[test]
    fn test_update_end_date_defers_current_day_until_evening_cutoff() {
        let date = NaiveDate::from_ymd_opt(2026, 8, 13).unwrap();
        assert_eq!(update_end_trade_date_for(date, 0), "2026-08-12");
        assert_eq!(update_end_trade_date_for(date, 17), "2026-08-12");
        assert_eq!(update_end_trade_date_for(date, 18), "2026-08-13");
        assert_eq!(update_end_trade_date_for(date, 23), "2026-08-13");
    }

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (
                id INTEGER PRIMARY KEY,
                date TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                oi INTEGER
            )",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE download_log (
                id INTEGER PRIMARY KEY,
                trade_date TEXT NOT NULL,
                exchange TEXT NOT NULL,
                rows_inserted INTEGER,
                max_volume INTEGER,
                status TEXT,
                note TEXT,
                downloaded_at TEXT DEFAULT (datetime('now')),
                UNIQUE(trade_date, exchange)
            )",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE market_holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'BUILTIN',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO market_holidays (date, name, source) VALUES (?, ?, 'BUILTIN')",
            params!["2026-06-26", "Muharram"],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_storage_mode_selection_hybrid_default() {
        let conn = setup_test_db();
        // Insert into eod_prices
        conn.execute(
            "INSERT INTO eod_prices (date, symbol, exchange, close, volume) VALUES (?, ?, ?, ?, ?)",
            params!["2024-05-15", "TEST", "NSE", 100.0, 1000],
        )
        .unwrap();

        // Default mode is Hybrid
        assert!(storage_mode_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
        // Metadata table is empty, so if it were binary it would return false
        assert!(!metadata_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
    }

    #[test]
    fn test_storage_mode_selection_binary() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        // Insert into download_log only
        conn.execute(
            "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
            params!["2024-05-15", "NSE", 100, 5000, "ok"],
        ).unwrap();

        assert!(storage_mode_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
        // eod_prices is empty, so if it were hybrid it would return false
        assert!(!has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
    }

    #[test]
    fn test_binary_mode_stale_nse() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        // Insert stale row (max_volume = 0) into download_log
        conn.execute(
            "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
            params!["2024-05-15", "NSE", 100, 0, "ok"],
        ).unwrap();

        assert!(
            storage_mode_has_stale_zero_volume_rows_for_date(&conn, "2024-05-15", "NSE").unwrap()
        );
    }

    #[test]
    fn test_parse_and_insert_binary_skips_sqlite() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let conn = open_database_connection(&db_path).unwrap();

        // Set Binary mode
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\n\
                   RELIANCE,EQ,2500,2550,2490,2520,2520,2480,100000,252000000,15-MAY-2024,5000,INE002A01018";

        let result = parse_and_insert(&db_path, csv, "NSE", "2024-05-15", &[]).unwrap();

        assert_eq!(result.rows_inserted, 1);

        let conn = Connection::open(&db_path).unwrap();
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
            inst_count, 1,
            "Instruments should still be updated in Binary mode"
        );

        // Verify binary file exists
        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("RELIANCE.eod");
        assert!(bin_path.exists(), "Binary .eod file should be created");
    }

    #[test]
    fn test_parse_and_insert_stores_nse_series_and_isin_metadata() {
        let (_temp_dir, db_path) = create_temp_bhavcopy_db();
        let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP,ISIN\n\
                   RELIANCE,EQ,2500,2550,2490,2520,100000,15-MAY-2024,INE002A01018";

        let result = parse_and_insert(&db_path, csv, "NSE", "2024-05-15", &[]).unwrap();
        assert_eq!(result.rows_inserted, 1);

        let conn = open_database_connection(&db_path).unwrap();
        let metadata = conn
            .query_row(
                "SELECT series, isin, series_as_of_date FROM instruments WHERE symbol = ? AND exchange = ?",
                params!["RELIANCE", "NSE"],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(metadata.0.as_deref(), Some("EQ"));
        assert_eq!(metadata.1.as_deref(), Some("INE002A01018"));
        assert_eq!(metadata.2.as_deref(), Some("2024-05-15"));
    }

    #[test]
    fn test_default_series_filter_keeps_equity_trade_for_trade_and_skips_gsec() {
        let (_temp_dir, db_path) = create_temp_bhavcopy_db();
        let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                   MAINCO,EQ,100,110,95,105,1000,15-MAY-2024\n\
                   WATCHCO,BE,20,22,19,21,500,15-MAY-2024\n\
                   1018GS2026,GS,112,112,110,110,101,15-MAY-2024";

        let result = parse_and_insert(
            &db_path,
            csv,
            "NSE",
            "2024-05-15",
            &default_excluded_series_vec(),
        )
        .unwrap();
        assert_eq!(result.rows_inserted, 2);

        let conn = open_database_connection(&db_path).unwrap();
        let be_series: Option<String> = conn
            .query_row(
                "SELECT series FROM instruments WHERE symbol = ? AND exchange = ?",
                params!["WATCHCO", "NSE"],
                |row| row.get(0),
            )
            .unwrap();
        let skipped_gsec_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM instruments WHERE symbol = ? AND exchange = ?",
                params!["1018GS2026", "NSE"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(be_series.as_deref(), Some("BE"));
        assert_eq!(skipped_gsec_count, 0);
    }

    #[test]
    fn test_series_metadata_keeps_latest_trade_date_when_backfilling() {
        let (_temp_dir, db_path) = create_temp_bhavcopy_db();
        let newer_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         MOVECO,EQ,100,110,95,105,1000,16-MAY-2024";
        let older_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         MOVECO,BE,90,95,85,92,700,15-MAY-2024";

        parse_and_insert(&db_path, newer_csv, "NSE", "2024-05-16", &[]).unwrap();
        parse_and_insert(&db_path, older_csv, "NSE", "2024-05-15", &[]).unwrap();

        let conn = open_database_connection(&db_path).unwrap();
        let metadata = conn
            .query_row(
                "SELECT series, series_as_of_date FROM instruments WHERE symbol = ? AND exchange = ?",
                params!["MOVECO", "NSE"],
                |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .unwrap();

        assert_eq!(metadata.0.as_deref(), Some("EQ"));
        assert_eq!(metadata.1.as_deref(), Some("2024-05-16"));
    }

    #[test]
    fn test_parse_and_insert_stores_bse_group_as_series_metadata() {
        let (_temp_dir, db_path) = create_temp_bhavcopy_db();
        let csv = "SC_CODE,SC_NAME,GROUP,OPEN,HIGH,LOW,CLOSE,NOOFSHARES,DATE\n\
                   500325,RELIANCE INDUSTRIES LTD,A,2500,2550,2490,2520,100000,15/05/2024";

        let result = parse_and_insert(&db_path, csv, "BSE", "2024-05-15", &[]).unwrap();
        assert_eq!(result.rows_inserted, 1);

        let conn = open_database_connection(&db_path).unwrap();
        let group_value: Option<String> = conn
            .query_row(
                "SELECT series FROM instruments WHERE symbol = ? AND exchange = ?",
                params!["500325", "BSE"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(group_value.as_deref(), Some("A"));
    }

    #[test]
    fn test_row_parity_audit_detects_duplicate_symbol_date_rows() {
        let csv = "SC_CODE,SC_NAME,SC_GROUP,OPEN,HIGH,LOW,CLOSE,NO_OF_SHRS\n\
500325,RELIANCE,A,100,110,90,105,1000\n\
500325,RELIANCE,A,101,111,91,106,2000";
        let parsed = parse_bhavcopy_csv(csv, "BSE", "2023-12-05", &[]).unwrap();
        let (duplicate_rows, samples) = find_duplicate_symbol_date_rows(&[parsed]);

        assert_eq!(duplicate_rows, 1);
        assert_eq!(samples, vec!["BSE:500325@2023-12-05".to_string()]);
    }

    #[test]
    fn test_parse_bse_legacy_equity_bhavcopy_headers() {
        let csv = "SC_CODE,SC_NAME,SC_GROUP,SC_TYPE,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,NO_TRADES,NO_OF_SHRS,NET_TURNOV,TDCLOINDI\n\
                   500325,RELIANCE INDUSTRIES LTD,A,Q,2500,2550,2490,2520,2518,2495,1234,567890,1432100000,-";

        let parsed = parse_bhavcopy_csv(csv, "BSE", "2023-12-05", &[]).unwrap();

        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].symbol, "500325");
        assert_eq!(parsed.rows[0].series, "A");
        assert_eq!(parsed.rows[0].volume, 567890);
        assert_eq!(parsed.rows[0].trades, Some(1234));
        assert_eq!(parsed.rows[0].trade_date, "2023-12-05");
    }

    #[test]
    fn test_bse_legacy_equity_candidate_uses_ddmmyy_zip_pattern_first_before_udiff_cutover() {
        let date = NaiveDate::from_ymd_opt(2023, 12, 5).unwrap();
        let candidates = generate_bse_candidates(date, None);

        assert_eq!(
            candidates[0].url,
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ051223_CSV.ZIP"
        );
        assert!(candidates[0].zipped);
        assert!(candidates[1]
            .url
            .contains("BhavCopy_BSE_CM_0_0_0_20231205_F_0000.CSV"));
        assert_eq!(candidates[2].bse_response_key, Some("dsedcudiff"));
    }

    #[test]
    fn test_parse_bse_udiff_equity_bhavcopy() {
        let csv = "TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd1,Rsvd2,Rsvd3,Rsvd4\n\
                   2026-06-01,2026-06-01,CM,BSE,STK,500002,INE117A01022,ABB,A,,,,,ABB INDIA LIMITED,7289.55,7289.55,7006.65,7030.10,7020.00,7229.60,,7027.50,,,20069,142855154.00,3466,F1,1,,,,,";

        let parsed = parse_bhavcopy_csv(csv, "BSE", "2026-06-01", &[]).unwrap();

        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].symbol, "ABB");
        assert_eq!(parsed.rows[0].series, "A");
        assert_eq!(parsed.rows[0].isin, "INE117A01022");
        assert_eq!(parsed.rows[0].volume, 20069);
        assert_eq!(parsed.rows[0].trades, Some(3466));
        assert_eq!(parsed.max_volume, 20069);
    }

    #[test]
    fn test_parse_bse_index_summary_bhavcopy() {
        let csv = "IndexCode,IndexID,IndexName,PreviousClose,OpenPrice,HighPrice,LowPrice,ClosePrice,52weeksHigh,52weeksLow,Filler1,Filler2,Filler3,Filler4\n\
                   1,SENSEX,BSE SENSEX,74775.74,75203.02,75367.93,74203.68,74267.34,86159.02,71545.81,,,,";

        let parsed = parse_bhavcopy_csv(csv, "BSE_INDEX", "2026-06-01", &[]).unwrap();

        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].symbol, "SENSEX");
        assert_eq!(parsed.rows[0].instrument_name, "BSE SENSEX");
        assert_eq!(parsed.rows[0].trade_date, "2026-06-01");
        assert_eq!(parsed.rows[0].volume, 0);
    }

    #[test]
    fn test_bse_index_archive_json_normalizes_to_existing_csv_import_contract() {
        let payload = r#"{"Table":[
            {"I_name":"BSE SENSEX","date":"2023-12-05T00:00:00","I_open":"69000.00","I_high":"69500.00","I_low":"68800.00","I_close":"69296.14","Prev_Close":"68865.12","Volume":"1.93","Flag":1},
            {"I_name":"BSE BANKEX","date":"2023-12-05T00:00:00","I_open":"52000.00","I_high":"52500.00","I_low":"51800.00","I_close":"52300.00","Prev_Close":"51900.00","Volume":"0.75","Flag":1},
            {"I_name":"BSE ARBITRAGE RATE INDEX","date":"2023-12-05T00:00:00","I_open":null,"I_high":null,"I_low":null,"I_close":"2488.20","Volume":null,"Flag":2}
        ]}"#;

        let normalized = normalize_bse_index_archive_json(payload.as_bytes(), "2023-12-05")
            .unwrap()
            .unwrap();
        let parsed = parse_bhavcopy_csv(&normalized, "BSE_INDEX", "2023-12-05", &[]).unwrap();

        assert_eq!(parsed.rows.len(), 2);
        assert_eq!(parsed.rows[0].symbol, "SENSEX");
        assert_eq!(parsed.rows[0].trade_date, "2023-12-05");
        assert_eq!(parsed.rows[0].volume, 19_300_000);
        assert_eq!(parsed.rows[1].symbol, "BANKEX");
        assert_eq!(parsed.rows[1].volume, 7_500_000);
    }

    #[test]
    fn test_nse_candidates_follow_udiff_cutover_and_keep_legacy_history() {
        let historical =
            generate_nse_candidates(NaiveDate::from_ymd_opt(2010, 1, 4).unwrap(), None);
        assert!(historical[0].url.contains(
            "archives.nseindia.com/content/historical/EQUITIES/2010/JAN/cm04JAN2010bhav.csv.zip"
        ));
        assert!(historical[1].url.contains(
            "nsearchives.nseindia.com/content/historical/EQUITIES/2010/JAN/cm04JAN2010bhav.csv.zip"
        ));

        let recent = generate_nse_candidates(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(), None);
        assert!(recent[0]
            .url
            .contains("BhavCopy_NSE_CM_0_0_0_20260601_F_0000.csv.zip"));
        assert!(recent[1].url.contains("sec_bhavdata_full_01062026.csv"));
    }

    #[test]
    fn test_bse_index_archive_url_preserves_literal_slash_date_contract() {
        let date = NaiveDate::from_ymd_opt(2023, 9, 8).unwrap();
        let url = build_bse_index_archive_url(date);

        assert_eq!(
            url,
            "https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAllPar/w?fmdt=08/09/2023&index=All&period=D&todt=08/09/2023"
        );
        assert!(!url.contains("%2F"));
    }
    #[test]
    fn test_bse_candidates_follow_working_cutover_and_index_archive_sources() {
        let date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let equity_candidates = generate_bse_candidates(date, None);
        let index_candidates = generate_bse_index_candidates(date, None);

        assert!(equity_candidates[0]
            .url
            .contains("BhavCopy_BSE_CM_0_0_0_20260601_F_0000.CSV"));
        assert_eq!(
            equity_candidates[1].url,
            "https://www.bseindia.com/download/BhavCopy/Equity/EQ010626_CSV.ZIP"
        );
        assert_eq!(equity_candidates[2].bse_response_key, Some("dsedcudiff"));

        assert!(index_candidates[0].bse_index_archive_json);
        assert!(index_candidates[0].url.contains("IndexArchDailyAllPar"));
        assert!(index_candidates[0].url.contains("index=All"));
        assert_eq!(index_candidates[1].bse_response_key, Some("dsIndexSum"));
        assert!(index_candidates[2]
            .url
            .contains("IndexSummary_01062026.csv"));
    }

    #[test]
    fn test_bse_index_api_filename_uses_downloadable_case() {
        assert_eq!(
            normalize_bse_api_filename("dsIndexSum", "INDEXSummary_28042026.csv"),
            "IndexSummary_28042026.csv"
        );
        assert_eq!(
            normalize_bse_api_filename("dsedcudiff", "BhavCopy_BSE_CM_0_0_0_20260428_F_0000.CSV"),
            "BhavCopy_BSE_CM_0_0_0_20260428_F_0000.CSV"
        );
    }

    #[test]
    fn test_insert_parsed_bhavcopy_files_batches_binary_records_by_symbol() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
        let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                          BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

        let parsed_files = vec![
            parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
            parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
        ];
        let (results, timing) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rows_inserted, 1);
        assert_eq!(results[1].rows_inserted, 1);
        assert_eq!(timing.parsed_jobs, 2);
        assert_eq!(timing.parsed_rows, 2);
        assert_eq!(timing.binary_symbols, 1);
        assert_eq!(timing.binary_inserted_dates, 2);
        assert_eq!(timing.binary_changed_dates, 0);
        assert_eq!(timing.binary_unchanged_dates, 0);
        assert_eq!(timing.binary_inserted_symbols, 1);
        assert_eq!(timing.binary_changed_symbols, 0);
        assert_eq!(timing.binary_unchanged_symbols, 0);
        assert_eq!(timing.binary_errors, 0);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("BATCHCO.eod");
        let binary = BinaryEodFile::open(&bin_path).unwrap();
        let records = binary.read_all().unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].date, 20260616);
        assert_eq!(records[1].date, 20260617);
    }

    #[test]
    fn test_insert_parsed_bhavcopy_files_skips_existing_binary_records() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
        let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                          BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

        let parsed_files = vec![
            parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
            parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
        ];

        let (first_results, _) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();
        assert_eq!(first_results[0].rows_inserted, 1);
        assert_eq!(first_results[1].rows_inserted, 1);

        let (second_results, _) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();
        assert_eq!(second_results[0].rows_inserted, 0);
        assert_eq!(second_results[1].rows_inserted, 0);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("BATCHCO.eod");
        let binary = BinaryEodFile::open(&bin_path).unwrap();
        let records = binary.read_all().unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].date, 20260616);
        assert_eq!(records[1].date, 20260617);
    }

    #[test]
    fn test_bhavcopy_buffered_durability_defers_only_append_newest_sync() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
        let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                          BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

        let first_batch = vec![parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap()];
        insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

        let second_batch = vec![parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap()];
        let (results, timing) = insert_parsed_bhavcopy_files_with_durability(
            &db_path,
            &second_batch,
            BinaryWriteDurability::RecoveryJournalBuffered,
        )
        .unwrap();

        assert_eq!(results[0].rows_inserted, 1);
        assert_eq!(timing.binary_diagnostics.append_newest, 1);
        assert_eq!(timing.binary_diagnostics.sync_data_calls, 0);
        assert_eq!(timing.binary_diagnostics.deferred_sync_calls, 1);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("BATCHCO.eod");
        let binary = BinaryEodFile::open(&bin_path).unwrap();
        assert_eq!(
            binary
                .read_all()
                .unwrap()
                .iter()
                .map(|record| record.date)
                .collect::<Vec<_>>(),
            vec![20260616, 20260617]
        );
    }

    #[test]
    fn test_insert_parsed_bhavcopy_files_counts_only_new_binary_rows_for_mixed_batch() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        drop(conn);

        let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
        let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                          BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";
        let third_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         BATCHCO,EQ,112,118,110,117,1300,18-JUN-2026";

        let first_batch = vec![
            parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
            parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
        ];
        insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

        let mixed_batch = vec![
            parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
            parse_bhavcopy_csv(third_csv, "NSE", "2026-06-18", &[]).unwrap(),
        ];
        let (results, _) = insert_parsed_bhavcopy_files(&db_path, &mixed_batch).unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rows_inserted, 0);
        assert_eq!(results[1].rows_inserted, 1);

        let bin_path = temp_dir
            .path()
            .join("eod_data")
            .join("NSE")
            .join("BATCHCO.eod");
        let binary = BinaryEodFile::open(&bin_path).unwrap();
        let records = binary.read_all().unwrap();
        assert_eq!(records.len(), 3);
        assert_eq!(
            records.iter().map(|record| record.date).collect::<Vec<_>>(),
            vec![20260616, 20260617, 20260618]
        );
    }

    #[test]
    fn test_default_nse_index_plan_uses_daily_full_index_list_candidates() {
        let conn = setup_test_db();
        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: false,
                bse: false,
                nse_index: true,
                bse_index: false,
            },
            start_date: "2026-06-25".to_string(),
            end_date: "2026-06-25".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert!(plan.calendar_skip_results.is_empty());
        assert_eq!(plan.tasks.len(), 1);
        let task = &plan.tasks[0];
        assert_eq!(task.exchange, "NSE_INDEX");
        assert_eq!(task.trade_date, "2026-06-25");
        assert!(task.nse_index_history.is_none());
        assert!(task
            .candidates
            .iter()
            .any(|candidate| candidate.url.contains("ind_close_all_25062026.csv")));
        assert!(task
            .candidates
            .iter()
            .any(|candidate| candidate.url.ends_with("/archives/nseidx/bhav.csv")));
        assert!(!plan
            .info_messages
            .iter()
            .any(|message| message.contains("NIFTY and BANKNIFTY")));
    }

    #[test]
    fn test_special_trading_calendar_covers_recent_live_cash_sessions() {
        let expected = [
            ("2023-11-12", "Muhurat Trading"),
            ("2024-01-20", "Special live trading session"),
            (
                "2024-03-02",
                "Disaster-recovery special live trading session",
            ),
            (
                "2024-05-18",
                "Disaster-recovery special live trading session",
            ),
            ("2024-11-01", "Muhurat Trading"),
            ("2025-02-01", "Union Budget live trading session"),
            ("2025-10-21", "Muhurat Trading"),
            ("2026-02-01", "Union Budget live trading session"),
            ("2026-11-08", "Muhurat Trading"),
        ];

        for exchange in ["NSE", "NSE_INDEX", "BSE", "BSE_INDEX"] {
            for (date, name) in expected {
                assert_eq!(special_trading_day_name(exchange, date), Some(name));
            }
        }
        assert_eq!(special_trading_day_name("MCX", "2026-02-01"), None);
    }

    #[test]
    fn test_special_trading_day_bypasses_weekend_for_all_cash_sources() {
        let conn = setup_test_db();
        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: true,
                bse: true,
                nse_index: true,
                bse_index: true,
            },
            start_date: "2026-02-01".to_string(),
            end_date: "2026-02-01".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert!(plan.calendar_skip_results.is_empty());
        assert_eq!(plan.tasks.len(), 4);
        for exchange in ["NSE", "BSE", "NSE_INDEX", "BSE_INDEX"] {
            assert!(plan
                .tasks
                .iter()
                .any(|task| { task.exchange == exchange && task.trade_date == "2026-02-01" }));
        }
        for label in ["NSE", "BSE", "NSE Index", "BSE Index"] {
            assert!(plan.info_messages.iter().any(|message| {
                message == &format!(
                    "[{label}] 2026-02-01: Special trading day override (Union Budget live trading session); treated as trading day"
                )
            }));
        }
    }

    #[test]
    fn test_holiday_calendar_remains_date_by_date_for_all_cash_sources() {
        let conn = setup_test_db();
        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: true,
                bse: true,
                nse_index: true,
                bse_index: true,
            },
            start_date: "2026-06-26".to_string(),
            end_date: "2026-06-26".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert!(plan.tasks.is_empty());
        assert_eq!(plan.calendar_skip_results.len(), 4);
        for exchange in ["NSE", "BSE", "NSE_INDEX", "BSE_INDEX"] {
            assert!(plan.calendar_skip_results.iter().any(|result| {
                result.exchange == exchange
                    && result.trade_date == "2026-06-26"
                    && result.message == "Exchange holiday (Muharram)"
            }));
        }
    }

    #[test]
    fn test_bse_uses_shared_cash_market_holiday_calendar() {
        let conn = setup_test_db();
        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: false,
                bse: true,
                nse_index: false,
                bse_index: true,
            },
            start_date: "2026-06-26".to_string(),
            end_date: "2026-06-26".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert!(plan.tasks.is_empty());
        assert_eq!(plan.calendar_skip_results.len(), 2);
        assert!(plan.calendar_skip_results.iter().any(|result| {
            result.exchange == "BSE"
                && result.trade_date == "2026-06-26"
                && result.message == "Exchange holiday (Muharram)"
        }));
        assert!(plan.calendar_skip_results.iter().any(|result| {
            result.exchange == "BSE_INDEX"
                && result.trade_date == "2026-06-26"
                && result.message == "Exchange holiday (Muharram)"
        }));
    }

    #[test]
    fn test_candidate_scan_soft_mismatch_does_not_mask_hard_error() {
        assert!(candidate_scan_should_skip("BSE_INDEX", 4, 4, false, false));
        assert!(candidate_scan_should_skip("BSE_INDEX", 4, 3, true, false));
        assert!(!candidate_scan_should_skip("BSE_INDEX", 4, 3, false, true));
        assert!(!candidate_scan_should_skip("BSE_INDEX", 4, 3, true, true));
        assert!(candidate_scan_should_skip("NSE", 2, 2, false, false));
    }
    #[test]
    fn test_binary_prefilter_range_scan_counts_target_dates_across_files() {
        fn record(date: u32) -> EodRecord {
            EodRecord {
                date,
                flags: 0,
                open: 10000,
                high: 10100,
                low: 9900,
                close: 10050,
                prev_close: 9950,
                volume: 1000,
                oi: 0,
            }
        }

        let (temp_dir, _db_path) = create_temp_bhavcopy_db();
        let binary_folder = temp_dir.path().join("eod_data").join("NSE");
        std::fs::create_dir_all(&binary_folder).unwrap();

        let mut first = [
            20260803, 20260804, 20260805, 20260806, 20260807, 20260810, 20260811, 20260812,
        ]
        .into_iter()
        .map(record)
        .collect::<Vec<_>>();
        let mut second = [20260803, 20260804, 20260806, 20260807, 20260810, 20260812]
            .into_iter()
            .map(record)
            .collect::<Vec<_>>();
        let mut outside = [20260730, 20260731]
            .into_iter()
            .map(record)
            .collect::<Vec<_>>();

        BinaryEodFile::write_all(
            binary_folder.join("FIRST.eod"),
            "FIRST",
            "NSE",
            DEFAULT_SCALE,
            &mut first,
        )
        .unwrap();
        BinaryEodFile::write_all(
            binary_folder.join("SECOND.eod"),
            "SECOND",
            "NSE",
            DEFAULT_SCALE,
            &mut second,
        )
        .unwrap();
        BinaryEodFile::write_all(
            binary_folder.join("OUTSIDE.eod"),
            "OUTSIDE",
            "NSE",
            DEFAULT_SCALE,
            &mut outside,
        )
        .unwrap();

        let (counts, files_scanned) =
            count_binary_files_containing_dates(&binary_folder, vec![20260805, 20260811, 20260813])
                .unwrap();

        assert_eq!(files_scanned, 3);
        assert_eq!(counts.get(&20260805).copied(), Some(1));
        assert_eq!(counts.get(&20260811).copied(), Some(1));
        assert_eq!(counts.get(&20260813).copied(), Some(0));
    }

    #[test]
    fn test_binary_prefilter_worker_count_is_bounded_to_four() {
        assert_eq!(MAX_BHAVCOPY_PREFILTER_WORKERS, 4);
        assert_eq!(bhavcopy_prefilter_worker_count(0), 0);
        assert_eq!(bhavcopy_prefilter_worker_count(1), 1);
        assert_eq!(bhavcopy_prefilter_worker_count(4), 4);
        assert_eq!(bhavcopy_prefilter_worker_count(5), 4);
        assert_eq!(bhavcopy_prefilter_worker_count(20_000), 4);
    }
    #[test]
    fn test_range_mode_prefilters_already_imported_trading_days() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        conn.execute(
            "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
            params!["2026-06-23", "NSE", 3200, 1000, "ok"],
        )
        .unwrap();

        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: true,
                bse: false,
                nse_index: false,
                bse_index: false,
            },
            start_date: "2026-06-22".to_string(),
            end_date: "2026-06-24".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert_eq!(plan.tasks.len(), 2);
        assert_eq!(plan.tasks[0].trade_date, "2026-06-22");
        assert_eq!(plan.tasks[1].trade_date, "2026-06-24");
        assert!(plan
            .info_messages
            .iter()
            .any(|message| message.contains("[NSE] Prefiltered 1 already imported trading days")));
    }

    #[test]
    fn test_range_mode_refreshes_metadata_only_binary_dates() {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        conn.execute(
            "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
            params!["2026-06-23", "NSE", 3200, 1000, "ok"],
        )
        .unwrap();

        let config = BatchDownloadConfig {
            mode: DownloadMode::Range,
            exchanges: ExchangeSelection {
                nse: true,
                bse: false,
                nse_index: false,
                bse_index: false,
            },
            start_date: "2026-06-22".to_string(),
            end_date: "2026-06-24".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
        };

        let plan = build_batch_plan(&conn, &config).unwrap();

        assert_eq!(plan.tasks.len(), 3);
        assert_eq!(plan.tasks[0].trade_date, "2026-06-22");
        assert_eq!(plan.tasks[1].trade_date, "2026-06-23");
        assert_eq!(plan.tasks[2].trade_date, "2026-06-24");
        assert!(plan
            .info_messages
            .iter()
            .any(|message| message
                .contains("[NSE] Scheduled 1 metadata-only trading days for refresh")));
    }

    #[test]
    fn test_nse_index_history_chunks_split_selected_range() {
        let tasks =
            generate_nse_index_history_tasks("1993-01-01", "1994-01-15", &DownloadMode::Range)
                .unwrap();

        assert_eq!(tasks.len(), 4);
        assert_eq!(tasks[0].trade_date, "1993-01-01..1993-12-31 NIFTY");
        assert_eq!(tasks[1].trade_date, "1993-01-01..1993-12-31 BANKNIFTY");
        assert_eq!(tasks[2].trade_date, "1994-01-01..1994-01-15 NIFTY");
        assert_eq!(tasks[3].trade_date, "1994-01-01..1994-01-15 BANKNIFTY");
    }

    #[test]
    fn test_nse_index_history_normalizes_old_nifty_and_skips_close_only_rows() {
        let rows = vec![
            NseIndexHistoryRow {
                index_name: Some("S&P CNX NIFTY".to_string()),
                open: Some(0.0),
                high: Some(0.0),
                low: Some(0.0),
                close: Some(744.92),
                traded_qty: None,
                timestamp: Some("04-JAN-1993".to_string()),
            },
            NseIndexHistoryRow {
                index_name: Some("S&P CNX NIFTY".to_string()),
                open: Some(1000.0),
                high: Some(1010.0),
                low: Some(990.0),
                close: Some(1005.0),
                traded_qty: Some(12345.0),
                timestamp: Some("03-NOV-1995".to_string()),
            },
        ];

        let normalized = normalize_nse_index_history_rows(&rows, "NIFTY", "NIFTY 50");

        assert_eq!(normalized.close_only_skipped, 1);
        assert_eq!(normalized.rows.len(), 1);
        assert_eq!(normalized.rows[0].symbol, "NIFTY");
        assert_eq!(normalized.rows[0].trade_date, "1995-11-03");
        assert_eq!(normalized.rows[0].volume, 12345);
    }

    #[test]
    fn test_state_shadow_matches_equivalent_physical_baseline() {
        let physical = PhysicalRecoveryPreState {
            existed_before: true,
            record_count: 10,
            price_scale: 100,
            file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
            last_date: Some(20260818),
            file_mtime_ns: Some(123456),
        };
        let indexed = VerifiedBinaryState {
            key: BinaryStateKey::new("NSE", "AAA"),
            relative_path: "eod_data/NSE/AAA.eod".to_string(),
            record_count: 10,
            price_scale: 100,
            file_length: physical.file_length,
            first_date: Some(20260801),
            last_date: Some(20260818),
            file_mtime_ns: 123456,
            state_generation: 1,
        };

        assert_eq!(
            classify_recovery_state_shadow(&physical, Some(&indexed)),
            BhavcopyStateShadowComparison::Matched
        );
    }

    #[test]
    fn test_state_shadow_reports_each_core_mismatch() {
        let physical = PhysicalRecoveryPreState {
            existed_before: true,
            record_count: 10,
            price_scale: 100,
            file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
            last_date: Some(20260818),
            file_mtime_ns: Some(123456),
        };
        let base = VerifiedBinaryState {
            key: BinaryStateKey::new("NSE", "AAA"),
            relative_path: "eod_data/NSE/AAA.eod".to_string(),
            record_count: 10,
            price_scale: 100,
            file_length: physical.file_length,
            first_date: Some(20260801),
            last_date: Some(20260818),
            file_mtime_ns: 123456,
            state_generation: 1,
        };

        let mut record_count = base.clone();
        record_count.record_count = 11;
        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&record_count)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));

        let mut price_scale = base.clone();
        price_scale.price_scale = 10_000;
        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&price_scale)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));

        let mut file_length = base.clone();
        file_length.file_length += RECORD_SIZE as u64;
        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&file_length)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));

        let mut last_date = base.clone();
        last_date.last_date = Some(20260817);
        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&last_date)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));

        let mut mtime = base;
        mtime.file_mtime_ns += 1;
        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&mtime)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));
    }

    #[test]
    fn test_state_shadow_is_unavailable_when_index_row_is_missing() {
        let physical = PhysicalRecoveryPreState {
            existed_before: true,
            record_count: 10,
            price_scale: 100,
            file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
            last_date: Some(20260818),
            file_mtime_ns: Some(123456),
        };

        assert_eq!(
            classify_recovery_state_shadow(&physical, None),
            BhavcopyStateShadowComparison::Unavailable
        );
    }

    #[test]
    fn test_state_shadow_flags_indexed_file_when_physical_file_is_absent() {
        let physical = PhysicalRecoveryPreState {
            existed_before: false,
            record_count: 0,
            price_scale: DEFAULT_SCALE,
            file_length: 0,
            last_date: None,
            file_mtime_ns: None,
        };
        let indexed = VerifiedBinaryState {
            key: BinaryStateKey::new("NSE", "AAA"),
            relative_path: "eod_data/NSE/AAA.eod".to_string(),
            record_count: 10,
            price_scale: 100,
            file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
            first_date: Some(20260801),
            last_date: Some(20260818),
            file_mtime_ns: 123456,
            state_generation: 1,
        };

        assert!(matches!(
            classify_recovery_state_shadow(&physical, Some(&indexed)),
            BhavcopyStateShadowComparison::Mismatched(_)
        ));
    }

    fn baseline_fast_path_test_record(date: u32, close: i64) -> EodRecord {
        EodRecord {
            date,
            flags: 0,
            open: close,
            high: close,
            low: close,
            close,
            prev_close: close,
            volume: 1,
            oi: 0,
        }
    }

    fn baseline_fast_path_test_file(exchange: &str, symbol: &str, date: u32) -> ParsedBhavcopyFile {
        ParsedBhavcopyFile {
            exchange: exchange.to_string(),
            trade_date: format!(
                "{}-{:02}-{:02}",
                date / 10000,
                (date / 100) % 100,
                date % 100
            ),
            rows: vec![ParsedBhavcopyRow {
                symbol: symbol.to_string(),
                instrument_name: symbol.to_string(),
                series: "EQ".to_string(),
                isin: String::new(),
                trade_date: format!(
                    "{}-{:02}-{:02}",
                    date / 10000,
                    (date / 100) % 100,
                    date % 100
                ),
                open: 10.0,
                high: 10.0,
                low: 10.0,
                close: 10.0,
                prev_close: Some(10.0),
                volume: 1,
                oi: 0,
                trades: None,
                binary_record: baseline_fast_path_test_record(date, 1000),
            }],
            max_volume: 1,
            debug: None,
        }
    }

    #[test]
    fn test_baseline_fast_path_uses_verified_state_without_physical_open() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut existing = vec![baseline_fast_path_test_record(20260819, 900)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        let status = index.rebuild().unwrap();
        assert!(status.healthy);
        drop(index);

        let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
        let (baselines, shadow, fast) =
            capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

        assert_eq!(baselines.len(), 1);
        assert!(matches!(
            baselines[0].kind,
            RecoveryBinaryBaselineKind::AppendNewest
        ));
        assert_eq!(baselines[0].record_count, 1);
        assert_eq!(fast.fast, 1);
        assert_eq!(fast.fallback, 0);
        assert_eq!(fast.physical_opens, 0);
        assert_eq!(fast.metadata_mismatch, 0);
        assert_eq!(shadow.compared, 0);
    }

    #[test]
    fn test_baseline_fast_path_falls_back_when_file_identity_changes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut existing = vec![baseline_fast_path_test_record(20260818, 800)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        index.rebuild().unwrap();
        drop(index);

        BinaryEodFile::append_or_merge_records(
            &path,
            "AAA",
            "NSE",
            100,
            vec![baseline_fast_path_test_record(20260819, 900)],
        )
        .unwrap();

        let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
        let (baselines, shadow, fast) =
            capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

        assert_eq!(baselines.len(), 1);
        assert_eq!(baselines[0].record_count, 2);
        assert_eq!(fast.fast, 0);
        assert_eq!(fast.fallback, 1);
        assert_eq!(fast.physical_opens, 1);
        assert_eq!(fast.metadata_mismatch, 1);
        assert_eq!(shadow.mismatched, 1);
    }

    #[test]
    fn test_baseline_fast_path_falls_back_when_index_is_unavailable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut aaa = vec![baseline_fast_path_test_record(20260819, 900)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut aaa).unwrap();

        let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
        let (baselines, _shadow, fast) =
            capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

        assert_eq!(baselines[0].record_count, 1);
        assert!(!fast.index_available);
        assert_eq!(fast.fast, 0);
        assert_eq!(fast.fallback, 1);
        assert_eq!(fast.index_untrusted, 1);
        assert_eq!(fast.physical_opens, 1);
    }

    #[test]
    fn test_baseline_fast_path_falls_back_when_verified_row_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut aaa = vec![baseline_fast_path_test_record(20260819, 900)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut aaa).unwrap();

        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        index.rebuild().unwrap();
        drop(index);

        let bbb_path = dir.path().join("eod_data").join("NSE").join("BBB.eod");
        let mut bbb = vec![baseline_fast_path_test_record(20260819, 1000)];
        BinaryEodFile::write_all(&bbb_path, "BBB", "NSE", 100, &mut bbb).unwrap();

        let incoming = vec![baseline_fast_path_test_file("NSE", "BBB", 20260820)];
        let (baselines, _shadow, fast) =
            capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

        assert_eq!(baselines[0].record_count, 1);
        assert_eq!(fast.fast, 0);
        assert_eq!(fast.fallback, 1);
        assert_eq!(fast.missing_rows, 1);
        assert_eq!(fast.physical_opens, 1);
    }

    #[test]
    fn test_v14_append_newest_fast_classification_builds_hint_from_verified_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut existing = vec![baseline_fast_path_test_record(20260820, 100)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        let status = index.rebuild().unwrap();
        let rows = index.load_verified().unwrap();
        let key = BinaryStateKey::new("NSE", "AAA");
        let indexed = rows.get(&key).unwrap().clone();
        drop(index);

        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "AAA".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: indexed.record_count,
            price_scale: indexed.price_scale,
            file_length: indexed.file_length,
            target_dates: vec![20260821],
        };

        let (hints, hint_stats) = build_bhavcopy_append_newest_fast_hints(dir.path(), &[baseline]);

        assert!(status.healthy);
        assert_eq!(hint_stats.candidates, 1);
        assert_eq!(hint_stats.hinted, 1);
        assert_eq!(hint_stats.fallback, 0);
        assert_eq!(hint_stats.state_mismatch, 0);
        assert_eq!(hint_stats.index_untrusted, 0);

        let hint = hints.get(&("NSE".to_string(), "AAA".to_string())).unwrap();
        assert_eq!(hint.record_count, indexed.record_count);
        assert_eq!(hint.price_scale, indexed.price_scale);
        assert_eq!(hint.file_length, indexed.file_length);
        assert_eq!(hint.file_mtime_ns, indexed.file_mtime_ns);
        assert_eq!(hint.last_date, 20260820);
    }

    #[test]
    fn test_v14_append_newest_fast_classification_rejects_baseline_state_mismatch() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
        let mut existing = vec![baseline_fast_path_test_record(20260820, 100)];
        BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

        let mut index = BinaryStateIndex::open(dir.path()).unwrap();
        index.rebuild().unwrap();
        let rows = index.load_verified().unwrap();
        let key = BinaryStateKey::new("NSE", "AAA");
        let indexed = rows.get(&key).unwrap().clone();
        drop(index);

        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "AAA".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: indexed.record_count,
            price_scale: indexed.price_scale,
            file_length: indexed.file_length + 1,
            target_dates: vec![20260821],
        };

        let (hints, hint_stats) = build_bhavcopy_append_newest_fast_hints(dir.path(), &[baseline]);

        assert!(hints.is_empty());
        assert_eq!(hint_stats.candidates, 1);
        assert_eq!(hint_stats.hinted, 0);
        assert_eq!(hint_stats.fallback, 1);
        assert_eq!(hint_stats.state_mismatch, 1);
    }

    #[test]
    fn test_v14_append_newest_fast_classification_bhavcopy_integration_uses_zero_classification_reads(
    ) {
        let (temp_dir, db_path) = create_temp_bhavcopy_db();
        let connection = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
        drop(connection);

        let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                         FASTCO,EQ,100,110,95,105,1000,20-AUG-2026";
        let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                          FASTCO,EQ,106,112,104,111,1200,21-AUG-2026";

        let first_batch = vec![parse_bhavcopy_csv(first_csv, "NSE", "2026-08-20", &[]).unwrap()];
        insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

        let mut index = BinaryStateIndex::open(temp_dir.path()).unwrap();
        let status = index.rebuild().unwrap();
        assert!(status.healthy);
        drop(index);

        let second_batch = vec![parse_bhavcopy_csv(second_csv, "NSE", "2026-08-21", &[]).unwrap()];
        let (baselines, _shadow, baseline_fast) =
            capture_recovery_binary_baselines(temp_dir.path(), &second_batch).unwrap();
        assert_eq!(baseline_fast.fast, 1);
        assert_eq!(baseline_fast.physical_opens, 0);

        let (results, timing) =
            insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
                &db_path,
                &second_batch,
                BinaryWriteDurability::RecoveryJournalBuffered,
                Some(&baselines),
            )
            .unwrap();

        assert_eq!(results[0].rows_inserted, 1);
        assert_eq!(timing.append_newest_fast_hint_stats.candidates, 1);
        assert_eq!(timing.append_newest_fast_hint_stats.hinted, 1);
        assert_eq!(timing.append_newest_fast_hint_stats.fallback, 0);
        assert_eq!(timing.binary_diagnostics.append_newest_fast_trusted, 1);
        assert_eq!(timing.binary_diagnostics.append_newest_fast_fast, 1);
        assert_eq!(timing.binary_diagnostics.append_newest_fast_fallback, 0);
        assert_eq!(timing.binary_diagnostics.header_classification_reads, 0);
        assert_eq!(timing.binary_diagnostics.last_date_classification_reads, 0);
        assert_eq!(timing.binary_diagnostics.append_newest, 1);
        assert_eq!(timing.binary_diagnostics.deferred_sync_calls, 1);
    }
}

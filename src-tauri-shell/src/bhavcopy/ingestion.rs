use crate::bhavcopy_recovery::{
    checkpoint_buffered_append_newest_files, create_prepared_session, handle_from_loaded,
    load_pending_sessions, publish_recovery_binary_state, remove_checkpointed_session,
    restore_buffered_binary_baselines, update_session_state, LoadedRecoverySession,
    RecoveryBinaryBaseline, RecoveryBinaryBaselineKind, RecoveryJobSummary, RecoveryJournalRow,
    RecoverySessionHandle, RecoverySessionSpec, RecoverySessionState,
    MAX_BUFFERED_CHECKPOINT_WORKERS,
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
    get_price_storage_mode, prepare_database_connection, PriceStorageMode,
};
use crate::runtime::log_runtime_event;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex, MutexGuard, OnceLock};
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use crate::bhavcopy::calendar::failed_download_result;
use crate::bhavcopy::parsers::{
    find_duplicate_symbol_date_rows, parse_bhavcopy_csv, ParsedBhavcopyFile, ParsedBhavcopyRow,
};
use crate::bhavcopy::transport::normalize_exchange_key;
use crate::bhavcopy::types::*;

pub fn emit_progress(app: &AppHandle, progress: u32, message: String) {
    let _ = app.emit("bhavcopy:progress", ProgressPayload { progress, message });
}

pub fn emit_download_result(app: &AppHandle, result: &DownloadResult) {
    let _ = app.emit("bhavcopy:result", result.clone());
}

pub(crate) const BINARY_PREFILTER_RECONCILE_MAX_DATES: usize = 31;
pub(crate) const MAX_BHAVCOPY_BINARY_WORKERS: usize = 2;
pub(crate) const MAX_BHAVCOPY_PREFILTER_WORKERS: usize = 4;
pub(crate) static BHAVCOPY_CHECKPOINT_LIFECYCLE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(crate) const BHAVCOPY_STATE_SHADOW_SAMPLE_LIMIT: usize = 8;
pub(crate) const BHAVCOPY_BASELINE_FAST_PATH_SAMPLE_LIMIT: usize = 8;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PhysicalRecoveryPreState {
    pub(crate) existed_before: bool,
    pub(crate) record_count: u32,
    pub(crate) price_scale: u32,
    pub(crate) file_length: u64,
    pub(crate) last_date: Option<u32>,
    pub(crate) file_mtime_ns: Option<i64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum BhavcopyStateShadowComparison {
    Matched,
    Mismatched(String),
    Unavailable,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct BhavcopyStateShadowStats {
    pub(crate) index_available: bool,
    pub(crate) bootstrap_complete: bool,
    pub(crate) index_healthy: bool,
    pub(crate) indexed_rows: usize,
    pub(crate) compared: usize,
    pub(crate) matched: usize,
    pub(crate) mismatched: usize,
    pub(crate) unavailable: usize,
    pub(crate) mismatch_samples: Vec<String>,
    pub(crate) index_error: Option<String>,
}

impl BhavcopyStateShadowStats {
    pub(crate) fn record(&mut self, exchange: &str, symbol: &str, comparison: BhavcopyStateShadowComparison) {
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

    pub(crate) fn summary(&self) -> String {
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
pub(crate) struct BhavcopyBaselineFileIdentity {
    pub(crate) relative_path: String,
    pub(crate) file_length: u64,
    pub(crate) file_mtime_ns: Option<i64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum BhavcopyBaselineFastPathFallback {
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
    pub(crate) fn label(&self) -> &'static str {
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

    pub(crate) fn is_metadata_mismatch(&self) -> bool {
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
pub(crate) enum BhavcopyBaselineFastPathDecision {
    Trusted,
    Fallback(BhavcopyBaselineFastPathFallback),
}

#[derive(Clone, Debug, Default)]
pub(crate) struct BhavcopyBaselineFastPathStats {
    pub(crate) index_available: bool,
    pub(crate) bootstrap_complete: bool,
    pub(crate) index_healthy: bool,
    pub(crate) indexed_rows: usize,
    pub(crate) index_generation: i64,
    pub(crate) candidates: usize,
    pub(crate) eligible: usize,
    pub(crate) fast: usize,
    pub(crate) fallback: usize,
    pub(crate) missing_physical: usize,
    pub(crate) missing_rows: usize,
    pub(crate) metadata_mismatch: usize,
    pub(crate) state_mismatch: usize,
    pub(crate) index_untrusted: usize,
    pub(crate) physical_opens: usize,
    pub(crate) fallback_samples: Vec<String>,
    pub(crate) index_error: Option<String>,
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
pub(crate) struct BhavcopyAppendNewestFastHintStats {
    pub(crate) index_available: bool,
    pub(crate) bootstrap_complete: bool,
    pub(crate) index_healthy: bool,
    pub(crate) index_generation: i64,
    pub(crate) indexed_rows: usize,
    pub(crate) candidates: usize,
    pub(crate) hinted: usize,
    pub(crate) fallback: usize,
    pub(crate) missing_rows: usize,
    pub(crate) state_mismatch: usize,
    pub(crate) index_untrusted: usize,
    pub(crate) fallback_samples: Vec<String>,
    pub(crate) index_error: Option<String>,
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

pub(crate) fn expected_eod_relative_path(exchange: &str, symbol: &str) -> String {
    format!("eod_data/{exchange}/{symbol}.eod")
}

pub(crate) fn classify_recovery_baseline_fast_path(
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

pub(crate) fn recovery_baseline_from_verified_state(
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

pub(crate) fn classify_recovery_state_shadow(
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


pub(crate) struct BhavcopyInsertTiming {
    pub(crate) parsed_jobs: usize,
    pub(crate) parsed_rows: usize,
    pub(crate) duplicate_symbol_date_rows: usize,
    pub(crate) duplicate_symbol_date_samples: Vec<String>,
    pub(crate) binary_symbols: usize,
    pub(crate) binary_workers: usize,
    pub(crate) binary_inserted_dates: usize,
    pub(crate) binary_changed_dates: usize,
    pub(crate) binary_unchanged_dates: usize,
    pub(crate) binary_inserted_symbols: usize,
    pub(crate) binary_changed_symbols: usize,
    pub(crate) binary_unchanged_symbols: usize,
    pub(crate) binary_errors: usize,
    pub(crate) binary_diagnostics: BhavcopyBinaryDiagnosticsSummary,
    pub(crate) append_newest_fast_hint_stats: BhavcopyAppendNewestFastHintStats,
    pub(crate) metadata_upsert_ms: u128,
    pub(crate) transaction_commit_ms: u128,
    pub(crate) binary_filter_ms: u128,
    pub(crate) binary_write_ms: u128,
}

#[derive(Clone)]
pub(crate) struct BhavcopyBinaryRecord {
    pub(crate) file_index: usize,
    pub(crate) record: EodRecord,
}

pub(crate) struct BhavcopyBinaryWriteResult {
    pub(crate) error: Option<String>,
    pub(crate) inserted_rows_by_file: Vec<(usize, usize)>,
    /// Rows written over an already-present date, per parsed file index.
    pub(crate) replaced_rows_by_file: Vec<(usize, usize)>,
    pub(crate) stats: BinaryAppendMergeStats,
    pub(crate) diagnostics: BinaryWriteDiagnostics,
}

#[derive(Default)]
pub(crate) struct BhavcopyBinaryWriteStats {
    pub(crate) inserted_dates: usize,
    pub(crate) changed_dates: usize,
    pub(crate) unchanged_dates: usize,
    pub(crate) inserted_symbols: usize,
    pub(crate) changed_symbols: usize,
    pub(crate) unchanged_symbols: usize,
    pub(crate) errors: usize,
    pub(crate) new_files: usize,
    pub(crate) append_newest: usize,
    pub(crate) rewrite_tail: usize,
    pub(crate) update_existing: usize,
    pub(crate) insert_historical: usize,
    pub(crate) no_op: usize,
    pub(crate) exists_us: u128,
    pub(crate) open_us: u128,
    pub(crate) header_read_us: u128,
    pub(crate) last_date_read_us: u128,
    pub(crate) sort_us: u128,
    pub(crate) lookup_us: u128,
    pub(crate) tail_read_us: u128,
    pub(crate) new_file_write_us: u128,
    pub(crate) seek_us: u128,
    pub(crate) data_write_us: u128,
    pub(crate) byte_shift_us: u128,
    pub(crate) set_len_us: u128,
    pub(crate) header_write_us: u128,
    pub(crate) flush_us: u128,
    pub(crate) flush_calls: usize,
    pub(crate) sync_data_us: u128,
    pub(crate) sync_data_calls: usize,
    pub(crate) deferred_sync_calls: usize,
    pub(crate) append_newest_fast_trusted: usize,
    pub(crate) append_newest_fast_fast: usize,
    pub(crate) append_newest_fast_fallback: usize,
    pub(crate) append_newest_fast_metadata_changed: usize,
    pub(crate) append_newest_fast_not_newest: usize,
    pub(crate) append_newest_fast_state_mismatch: usize,
    pub(crate) header_classification_reads: usize,
    pub(crate) last_date_classification_reads: usize,
    pub(crate) measured_total_us: u128,
    pub(crate) symbol_total_us: Vec<u128>,
}

#[derive(Default)]
pub(crate) struct BhavcopyBinaryDiagnosticsSummary {
    pub(crate) new_files: usize,
    pub(crate) append_newest: usize,
    pub(crate) rewrite_tail: usize,
    pub(crate) update_existing: usize,
    pub(crate) insert_historical: usize,
    pub(crate) no_op: usize,
    pub(crate) exists_us: u128,
    pub(crate) open_us: u128,
    pub(crate) header_read_us: u128,
    pub(crate) last_date_read_us: u128,
    pub(crate) sort_us: u128,
    pub(crate) lookup_us: u128,
    pub(crate) tail_read_us: u128,
    pub(crate) new_file_write_us: u128,
    pub(crate) seek_us: u128,
    pub(crate) data_write_us: u128,
    pub(crate) byte_shift_us: u128,
    pub(crate) set_len_us: u128,
    pub(crate) header_write_us: u128,
    pub(crate) flush_us: u128,
    pub(crate) flush_calls: usize,
    pub(crate) sync_data_us: u128,
    pub(crate) sync_data_calls: usize,
    pub(crate) deferred_sync_calls: usize,
    pub(crate) append_newest_fast_trusted: usize,
    pub(crate) append_newest_fast_fast: usize,
    pub(crate) append_newest_fast_fallback: usize,
    pub(crate) append_newest_fast_metadata_changed: usize,
    pub(crate) append_newest_fast_not_newest: usize,
    pub(crate) append_newest_fast_state_mismatch: usize,
    pub(crate) header_classification_reads: usize,
    pub(crate) last_date_classification_reads: usize,
    pub(crate) measured_total_us: u128,
    pub(crate) p50_symbol_us: u128,
    pub(crate) p95_symbol_us: u128,
    pub(crate) max_symbol_us: u128,
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

pub(crate) fn percentile_us(sorted_values: &[u128], percentile: usize) -> u128 {
    if sorted_values.is_empty() {
        return 0;
    }
    let index = ((sorted_values.len() - 1) * percentile) / 100;
    sorted_values[index]
}

pub(crate) fn format_us_as_ms(value_us: u128) -> String {
    format!("{}.{:03}", value_us / 1_000, value_us % 1_000)
}

pub(crate) fn import_staged_download(
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
            // Repair re-imports replace existing rows instead of inserting new
            // ones: report that work truthfully instead of "Imported 0 records".
            let written = parsed.rows_inserted + parsed.rows_replaced;
            let summary = if written == 0 {
                format!("Imported staged 0 records ({} parsed rows)", parsed.rows_inserted)
            } else if parsed.rows_inserted == 0 {
                format!("Replaced {} existing records (repair re-import)", parsed.rows_replaced)
            } else if parsed.rows_replaced == 0 {
                format!("Imported staged {} records", parsed.rows_inserted)
            } else {
                format!(
                    "Imported {} new / {} replaced records",
                    parsed.rows_inserted, parsed.rows_replaced
                )
            };
            let result = DownloadResult {
                success: parsed.admission.conflicted == 0,
                trade_date: staged.task.trade_date,
                exchange: staged.task.exchange,
                rows_inserted: written,
                max_volume: parsed.max_volume,
                message: parsed.admission.describe_result(summary),
            };
            if should_write_download_log(&result) {
                let _write_guard = lock_bhavcopy_write(write_lock)?;
                let connection = super::batch_runtime::open_staging_connection(database_file_path)?;
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

pub(crate) fn prepare_bhavcopy_recovery_session(
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

pub(crate) fn capture_recovery_binary_baselines(
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

pub(crate) fn build_bhavcopy_append_newest_fast_hints(
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

pub(crate) fn recovery_row_from_parsed(exchange: &str, row: &ParsedBhavcopyRow) -> RecoveryJournalRow {
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

pub(crate) fn parsed_files_from_recovery_session(
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

pub(crate) fn lock_bhavcopy_checkpoint_lifecycle() -> AppResult<MutexGuard<'static, ()>> {
    BHAVCOPY_CHECKPOINT_LIFECYCLE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Bhavcopy checkpoint lifecycle lock was poisoned.".to_string())
}

pub(crate) fn can_resume_buffered_checkpoint(state: &RecoverySessionState) -> bool {
    matches!(
        state,
        RecoverySessionState::Applied | RecoverySessionState::Checkpointing
    )
}

pub(crate) fn spawn_background_bhavcopy_checkpoint(app_handle: AppHandle, database_file_path: PathBuf) {
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

pub(crate) fn checkpoint_pending_buffered_sessions_background(
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

        super::security_admission::require_replay_safe(database_file_path, &parsed_files_from_recovery_session(&session)?)?;
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

pub(crate) fn recover_pending_bhavcopy_sessions(
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

        super::security_admission::require_replay_safe(database_file_path, &parsed_files_from_recovery_session(&session)?)?;
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
        let mut parsed_files = parsed_files_from_recovery_session(&session)?;
        let recovery_result = (|| -> AppResult<()> {
            super::security_admission::require_replay_safe(database_file_path, &parsed_files)?;
            restore_buffered_binary_baselines(
                database_folder,
                &session.manifest.binary_baselines,
                &session.rows,
            )?;
            let outcomes = super::index_fallback::guard_additive(database_file_path, &mut parsed_files)?;
            if outcomes.values().any(|o| o.conflicts > 0 || o.invalid > 0) {
                return Err("NSE index recovery conflict: existing quotations preserved; operator review required.".into());
            }
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
                let journal_row_count = session.manifest.jobs.iter()
                    .find(|job| job.exchange == parsed.exchange && job.trade_date == parsed.trade_date)
                    .map(|job| job.row_count).unwrap_or(parsed.rows.len());
                let log_result = DownloadResult {
                    success: true,
                    trade_date: parsed.trade_date.clone(),
                    exchange: parsed.exchange.clone(),
                    rows_inserted: journal_row_count,
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

pub(super) fn import_staged_csv_downloads(
    app_handle: &AppHandle,
    database_file_path: &Path,
    staged_downloads: Vec<StagedDownload>,
    config: &BatchDownloadConfig,
    write_lock: &Mutex<()>,
    stop: &super::BatchStop,
) -> AppResult<Vec<DownloadResult>> {
    let parse_started = Instant::now();
    let mut parsed_files = Vec::<ParsedBhavcopyFile>::new();
    let mut results = Vec::<DownloadResult>::new();
    let mut parsed_rows = 0_usize;

    for staged in staged_downloads {
        if stop.is_requested() {
            break;
        }
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

    let security_admission = super::security_admission::admit(database_file_path, &parsed_files)?;
    let mut security_reports = HashMap::<_, super::security_admission::AdmissionReport>::new();
    for (file, report) in parsed_files.iter().zip(&security_admission.reports) {
        let combined = security_reports.entry((file.exchange.clone(), file.trade_date.clone())).or_default();
        combined.separated += report.separated;
        combined.market_rows += report.market_rows;
        combined.conflicted += report.conflicted;
        combined.duplicates += report.duplicates;
        if report.evidence.is_some() { combined.evidence = report.evidence.clone(); }
    }
    parsed_files = super::security_admission::filter_files(&parsed_files, &security_admission);
    parsed_files.retain(|file| {
        if !file.rows.is_empty() || file.exchange != "NSE" { return true; }
        let report = &security_reports[&(file.exchange.clone(), file.trade_date.clone())];
        results.push(DownloadResult { success:report.conflicted == 0, exchange:file.exchange.clone(),trade_date:file.trade_date.clone(),rows_inserted:0,max_volume:0,
            message:report.describe_result("No admitted daily security rows".into()) });
        false
    });
    let index_outcomes = super::index_fallback::guard_additive(database_file_path, &mut parsed_files)?;
    if !index_outcomes.is_empty() {
        let evidence = serde_json::to_vec_pretty(&serde_json::json!({
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "status": "PRE_WRITE_ADDITIVE_CHECK", "outcomes": index_outcomes,
        })).map_err(|e| e.to_string())?;
        super::index_fallback::save_evidence(database_file_path, "additive-check", &evidence)?;
        // Consolidate archive and fallback rows for the same date into one job.
        let mut combined = Vec::<ParsedBhavcopyFile>::new();
        for parsed in parsed_files {
            if parsed.exchange == "NSE_INDEX" {
                if let Some(existing) = combined.iter_mut().find(|f| f.exchange == parsed.exchange && f.trade_date == parsed.trade_date) {
                    existing.max_volume = existing.max_volume.max(parsed.max_volume);
                    existing.rows.extend(parsed.rows);
                    continue;
                }
            }
            combined.push(parsed);
        }
        parsed_files = combined;
        parsed_files.retain(|file| {
            if file.exchange != "NSE_INDEX" || !file.rows.is_empty() { return true; }
            let outcome = &index_outcomes[&file.trade_date];
            results.push(DownloadResult {
                success: outcome.conflicts == 0 && outcome.invalid == 0,
                exchange: file.exchange.clone(), trade_date: file.trade_date.clone(),
                rows_inserted: 0, max_volume: 0,
                message: format!("NSE index subset: inserted 0, identical existing {}, conflicting existing {}, invalid {}; existing prices preserved. {}", outcome.identical, outcome.conflicts, outcome.invalid, outcome.details.join("; ")),
            });
            false
        });
    }

    // After journal preparation begins, finish the entire symbol-batched
    // import and its recovery transitions before observing another stop.
    if !parsed_files.is_empty() && !stop.is_requested() {
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
                let records_written = parsed_result.rows_inserted + parsed_result.rows_replaced;
                let mut message = if records_written == 0 && !parsed.rows.is_empty() {
                    format!(
                        "Already present; 0 new rows ({} parsed rows)",
                        parsed.rows.len()
                    )
                } else if parsed_result.rows_inserted == 0 {
                    format!(
                        "Replaced {} existing records (repair re-import)",
                        parsed_result.rows_replaced
                    )
                } else if parsed_result.rows_replaced == 0 {
                    format!(
                        "Imported symbol-batched staged {} records",
                        parsed_result.rows_inserted
                    )
                } else {
                    format!(
                        "Imported {} new / {} replaced records",
                        parsed_result.rows_inserted, parsed_result.rows_replaced
                    )
                };
                let security_report = security_reports.get(&(parsed.exchange.clone(), parsed.trade_date.clone()));
                let mut success = security_report.map_or(true, |report| report.conflicted == 0);
                if let Some(report) = security_report {
                    message = report.describe_result(message);
                }
                if let Some(outcome) = index_outcomes.get(&parsed.trade_date).filter(|_| parsed.exchange == "NSE_INDEX") {
                    success = outcome.conflicts == 0 && outcome.invalid == 0;
                    message = format!("NSE index subset: inserted {}, identical existing {}, conflicting existing {}, invalid {}; other indices/dates may remain unresolved. {}",
                        parsed_result.rows_inserted, outcome.identical, outcome.conflicts, outcome.invalid, outcome.details.join("; "));
                }
                let result = DownloadResult {
                    success,
                    trade_date: parsed.trade_date.clone(),
                    exchange: parsed.exchange.clone(),
                    rows_inserted: records_written,
                    max_volume: parsed_result.max_volume,
                    message,
                };
                let log_result = DownloadResult {
                    rows_inserted: parsed.rows.len(),
                    message: result.message.clone(),
                    ..result.clone()
                };
                if should_write_download_log(&log_result) {
                    upsert_batch_download_log_entry(&connection, &log_result)?;
                    log_entries_written += 1;
                }
                results.push(result);
            }
            for result in results.iter().filter(|result| !result.success) {
                if should_write_download_log(result) {
                    upsert_batch_download_log_entry(&connection, result)?;
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
                upsert_batch_download_log_entry(&connection, result)?;
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
    if !index_outcomes.is_empty() {
        let evidence = serde_json::to_vec_pretty(&serde_json::json!({
            "createdAt": chrono::Utc::now().to_rfc3339(), "status": "IMPORT_COMPLETED",
            "results": results.iter().filter(|r| r.exchange == "NSE_INDEX").collect::<Vec<_>>(),
        })).map_err(|e| e.to_string())?;
        super::index_fallback::save_evidence(database_file_path, "import-result", &evidence)?;
    }

    Ok(results)
}

pub(crate) fn lock_bhavcopy_write(write_lock: &Mutex<()>) -> AppResult<MutexGuard<'_, ()>> {
    write_lock
        .lock()
        .map_err(|_| "Bhavcopy import writer lock was poisoned.".to_string())
}

pub(crate) fn insert_nse_index_history_rows(
    _database_file_path: &Path,
    _exchange: &str,
    _normalized: &NseIndexHistoryNormalizeResult,
) -> AppResult<NseIndexHistoryInsertResult> {
    // This legacy path committed metadata before binary writes and swallowed
    // storage failures. Historical observations now require a reviewed preview
    // and the durable Manual Import journal; never activate this as a fallback.
    Err("Historical index auto-import is disabled. Use NIFTY Historical Review to verify and approve a recovery-backed import.".to_string())
}

pub(crate) fn parse_and_insert(
    database_file_path: &Path,
    csv_content: &str,
    exchange: &str,
    trade_date: &str,
    excluded_series: &[String],
) -> AppResult<ParseInsertResult> {
    let parsed = parse_bhavcopy_csv(csv_content, exchange, trade_date, excluded_series)?;
    if let Some(debug) = parsed.debug.clone() {
        return Ok(ParseInsertResult {
            admission: Default::default(),
            rows_inserted: 0,
            binary_errors: 0,
            rows_replaced: 0,
            max_volume: 0,
            debug: Some(debug),
        });
    }

    let parsed_files = vec![parsed];
    let (mut results, timing) = insert_parsed_bhavcopy_files(database_file_path, &parsed_files)?;
    let mut result = results.remove(0);
    result.binary_errors = timing.binary_errors;
    if timing.binary_errors > 0 {
        // The metadata/price rows may be partially committed; never report this
        // as a success. Recovery evidence stays in the journal and the log.
        return Err(format!(
            "Binary store write failed for {} symbol file(s); the import is incomplete and must be retried after checking the binary journal",
            timing.binary_errors
        ));
    }
    Ok(result)
}

pub(crate) fn insert_parsed_bhavcopy_files(
    database_file_path: &Path,
    parsed_files: &[ParsedBhavcopyFile],
) -> AppResult<(Vec<ParseInsertResult>, BhavcopyInsertTiming)> {
    insert_parsed_bhavcopy_files_with_durability(
        database_file_path,
        parsed_files,
        BinaryWriteDurability::Immediate,
    )
}

pub(crate) fn insert_parsed_bhavcopy_files_with_durability(
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

pub(crate) fn insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
    database_file_path: &Path,
    parsed_files: &[ParsedBhavcopyFile],
    append_durability: BinaryWriteDurability,
    recovery_baselines: Option<&[RecoveryBinaryBaseline]>,
) -> AppResult<(Vec<ParseInsertResult>, BhavcopyInsertTiming)> {
    let mut connection = open_database_connection(database_file_path)?;
    let storage_mode = get_price_storage_mode(&connection);
    let binary_only = storage_mode == PriceStorageMode::Binary;
    let parsed_jobs = parsed_files.len();
    let admission = super::security_admission::admit(database_file_path, parsed_files)?;
    let parsed_rows = parsed_files
        .iter()
        .map(|parsed| parsed.rows.len())
        .sum::<usize>();
    let (duplicate_symbol_date_rows, duplicate_symbol_date_samples) =
        find_duplicate_symbol_date_rows(parsed_files);
    let mut results = parsed_files
        .iter()
        .enumerate()
        .map(|(i, parsed)| ParseInsertResult {
            admission: admission.reports[i].clone(),
            rows_inserted: 0,
            binary_errors: 0,
            rows_replaced: 0,
            max_volume: parsed.rows.iter().zip(&admission.masks[i]).filter(|(_,keep)| **keep).map(|(row,_)| row.volume.max(0) as u64).max().unwrap_or(0),
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
                    AND (
                      instruments.exchange NOT IN ('BSE', 'NSE')
                      OR instruments.series_as_of_date IS NULL
                      OR excluded.series_as_of_date >= instruments.series_as_of_date
                    )
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
        for (row_index, row) in parsed.rows.iter().enumerate() {
            if !admission.masks[file_index][row_index] { continue; }
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
                for (file_index, rows_replaced) in result.replaced_rows_by_file {
                    results[file_index].rows_replaced += rows_replaced;
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

pub(crate) fn sort_bhavcopy_binary_records(
    mut binary_records: HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>>,
) -> HashMap<String, HashMap<String, Vec<BhavcopyBinaryRecord>>> {
    for symbol_records in binary_records.values_mut() {
        for records in symbol_records.values_mut() {
            records.sort_by_key(|record| record.record.date);
            fill_missing_prev_close(records);
        }
    }
    binary_records
}

/// Debt, sovereign-gold-bond and fund series omit `PREV_CLOSE` in the source, so
/// their stored bars carried `prev_close = 0` and any previous-close read was
/// wrong (56,250 bars across 175 symbols in 2018-2024). Where a symbol has
/// consecutive records inside this batch, fill the gap from the preceding
/// record's close. Values the source did supply are never overwritten, and the
/// first record of a series keeps 0 because nothing precedes it.
///
/// Limitation: this only sees the current batch, so a single-date import of a
/// source that omits `PREV_CLOSE` still writes 0 for that date.
pub(crate) fn fill_missing_prev_close(records: &mut [BhavcopyBinaryRecord]) -> usize {
    let mut filled = 0;
    for index in 1..records.len() {
        if records[index].record.prev_close == 0 {
            let previous_close = records[index - 1].record.close;
            if previous_close != 0 {
                records[index].record.prev_close = previous_close;
                filled += 1;
            }
        }
    }
    filled
}

pub(crate) fn bhavcopy_binary_worker_count(total_symbols: usize) -> usize {
    let available = thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1);
    total_symbols
        .min(available.min(MAX_BHAVCOPY_BINARY_WORKERS))
        .max(1)
}

pub(crate) fn flatten_bhavcopy_binary_records(
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

pub(crate) fn write_bhavcopy_binary_records_parallel(
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

pub(crate) fn write_bhavcopy_binary_records_for_symbol(
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
            replaced_rows_by_file: count_changed_rows_by_file(&records, &result.stats),
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
                replaced_rows_by_file: Vec::new(),
                stats: BinaryAppendMergeStats::default(),
                diagnostics,
            }
        }
    }
}

pub(crate) fn count_inserted_rows_by_file(
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

pub(crate) fn count_changed_rows_by_file(
    records: &[BhavcopyBinaryRecord],
    stats: &BinaryAppendMergeStats,
) -> Vec<(usize, usize)> {
    if stats.changed_existing_dates.is_empty() {
        return Vec::new();
    }

    let changed_dates = stats.changed_existing_dates.iter().copied().collect::<HashSet<_>>();
    let mut changed_rows_by_file = HashMap::<usize, usize>::new();
    for record in records {
        if changed_dates.contains(&record.record.date) {
            *changed_rows_by_file.entry(record.file_index).or_insert(0) += 1;
        }
    }

    let mut ordered = changed_rows_by_file.into_iter().collect::<Vec<_>>();
    ordered.sort_by_key(|(file_index, _)| *file_index);
    ordered
}

pub(crate) fn open_database_connection(database_file_path: &Path) -> AppResult<Connection> {
    let connection = Connection::open(database_file_path).map_err(|error| error.to_string())?;
    prepare_database_connection(&connection)?;
    Ok(connection)
}

pub(crate) fn storage_mode_has_imported_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => {
            binary_store_has_imported_rows_for_date(connection, trade_date, exchange)
        }
        PriceStorageMode::Hybrid => has_imported_rows_for_date(connection, trade_date, exchange),
    }
}

/// Binary-mode coverage question: does the binary store itself hold rows for
/// this exchange/date? Answered from the `eod_binary_state` sidecar index
/// (first/last bounds select candidates; actual records prove membership),
/// never from `download_log`, whose 2018-2024 gap must not
/// gate coverage. `download_log` stays authoritative only for notes/status.
/// When the sidecar index is unavailable (legacy database), the download_log
/// contract is the conservative fallback.
pub(crate) fn binary_store_has_imported_rows_for_date(
    connection: &Connection,
    trade_date: &str,
    exchange: &str,
) -> AppResult<bool> {
    let Some(database_folder) = connection_database_folder(connection)? else {
        return metadata_has_imported_rows_for_date(connection, trade_date, exchange);
    };
    match binary_index_covers_date(&database_folder, exchange, trade_date) {
        Ok(covered) => Ok(covered),
        Err(_) => metadata_has_imported_rows_for_date(connection, trade_date, exchange),
    }
}

fn binary_index_covers_date(
    database_folder: &Path,
    exchange: &str,
    trade_date: &str,
) -> AppResult<bool> {
    let sidecar_path = database_folder.join("eod_binary_state.sqlite");
    if !sidecar_path.is_file() {
        return Err(format!(
            "EOD binary state sidecar not found: {}",
            sidecar_path.display()
        ));
    }
    let index = Connection::open_with_flags(&sidecar_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| error.to_string())?;
    let date = date_to_u32(trade_date);
    let mut statement = index
        .prepare(
            "
              SELECT symbol
              FROM eod_binary_state
              WHERE exchange = ?
                AND record_count > 0
                AND first_date IS NOT NULL
                AND last_date IS NOT NULL
                AND first_date <= ?
                AND last_date >= ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let symbols = statement
        .query_map(params![exchange, date, date], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    for symbol in symbols {
        let symbol = symbol.map_err(|error| error.to_string())?;
        if symbol.contains(['/', '\\']) || symbol == "." || symbol == ".." {
            return Ok(false);
        }
        let path = database_folder
            .join("eod_data")
            .join(exchange)
            .join(format!("{symbol}.eod"));
        // A stale index or a missing/corrupt file cannot justify skipping a download.
        let Ok(binary) = BinaryEodFile::open(&path) else {
            return Ok(false);
        };
        if binary.header.symbol != symbol || binary.header.exchange != exchange {
            return Ok(false);
        }
        match binary_file_contained_dates(&path, &[date]) {
            Ok(dates) if dates.contains(&date) => return Ok(true),
            Ok(_) => {}
            Err(_) => return Ok(false),
        }
    }
    Ok(false)
}

pub(crate) fn storage_mode_get_latest_imported_trade_date(
    connection: &Connection,
    exchange: &str,
) -> AppResult<Option<String>> {
    match get_price_storage_mode(connection) {
        PriceStorageMode::Binary => metadata_get_latest_imported_trade_date(connection, exchange),
        PriceStorageMode::Hybrid => get_latest_imported_trade_date(connection, exchange),
    }
}

pub(crate) fn storage_mode_load_imported_trade_dates(
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

pub(crate) fn reconcile_binary_imported_trade_dates(
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

pub(crate) fn storage_mode_has_stale_zero_volume_rows_for_date(
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

pub(crate) fn connection_database_folder(connection: &Connection) -> AppResult<Option<PathBuf>> {
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

pub(crate) fn metadata_load_imported_row_counts(
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

pub(crate) fn count_binary_files_containing_dates(
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

pub(crate) fn bhavcopy_prefilter_worker_count(file_count: usize) -> usize {
    if file_count == 0 {
        0
    } else {
        file_count.min(MAX_BHAVCOPY_PREFILTER_WORKERS)
    }
}

pub(crate) fn binary_file_contained_dates(path: &Path, target_dates: &[u32]) -> AppResult<Vec<u32>> {
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

pub(crate) fn binary_file_lower_bound_date_with_open_file(
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

pub(crate) fn binary_file_upper_bound_date_with_open_file(
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

pub(crate) fn read_binary_date_at(file: &mut fs::File, index: usize) -> AppResult<u32> {
    file.seek(SeekFrom::Start((HEADER_SIZE + index * RECORD_SIZE) as u64))
        .map_err(|error| error.to_string())?;
    let mut buffer = [0_u8; 4];
    file.read_exact(&mut buffer)
        .map_err(|error| error.to_string())?;
    Ok(u32::from_le_bytes(buffer))
}
pub(crate) fn has_imported_rows_for_date(
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

pub(crate) fn get_latest_imported_trade_date(
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

pub(crate) fn load_imported_trade_dates(
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

pub(crate) fn has_stale_zero_volume_rows_for_date(
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

pub(crate) fn clear_download_log_entry(connection: &Connection, id: i64) -> AppResult<()> {
    connection
        .execute("DELETE FROM download_log WHERE id = ?", params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn should_write_download_log(result: &DownloadResult) -> bool {
    !(result.success && result.rows_inserted == 0)
}

pub(crate) fn upsert_download_log_entry(connection: &Connection, result: &DownloadResult) -> AppResult<()> {
    super::batch_runtime::retry_busy(|| upsert_download_log_entry_once(connection, result, false))
}

pub(super) fn upsert_batch_download_log_entry(
    connection: &Connection,
    result: &DownloadResult,
) -> AppResult<()> {
    super::batch_runtime::retry_busy(|| upsert_download_log_entry_once(connection, result, true))
}

fn upsert_download_log_entry_once(
    connection: &Connection,
    result: &DownloadResult,
    preserve_success: bool,
) -> rusqlite::Result<()> {
    if result.success || (result.exchange == "NSE_INDEX" && result.rows_inserted > 0) {
        connection
            .execute(
                "
                  INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status, note)
                  VALUES (?, ?, ?, ?, CASE WHEN ? = 'NSE_INDEX' THEN 'partial' ELSE 'ok' END, ?)
                  ON CONFLICT(trade_date, exchange) DO UPDATE SET
                    rows_inserted = excluded.rows_inserted,
                    max_volume = excluded.max_volume,
                    downloaded_at = datetime('now'),
                    status = excluded.status,
                    note = excluded.note
                  WHERE NOT ? OR excluded.status = 'ok' OR download_log.status <> 'ok'
                ",
                params![
                    &result.trade_date,
                    &result.exchange,
                    result.rows_inserted as i64,
                    result.max_volume as i64,
                    &result.exchange,
                    if result.exchange == "NSE_INDEX" { Some(result.message.as_str()) } else { None },
                    preserve_success,
                ],
            )?;
    } else {
        // Download-log contract: a date that imported rows must never be
        // persisted as rows_inserted=0 / max_volume=0 / status='error'.
        // 'partial' marks "imported with a held-back subset" (real counts kept,
        // e.g. admission conflicts blocked only part of the file); 'error' with
        // zero counts is reserved for genuine row loss where nothing imported.
        let subset_held_back = result.rows_inserted > 0;
        connection
            .execute(
                "
                  INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status, note)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(trade_date, exchange) DO UPDATE SET
                    rows_inserted = CASE WHEN download_log.exchange = 'NSE_INDEX' AND download_log.rows_inserted > 0
                      AND download_log.status IN ('ok', 'partial') THEN download_log.rows_inserted ELSE excluded.rows_inserted END,
                    max_volume = CASE WHEN download_log.exchange = 'NSE_INDEX' AND download_log.rows_inserted > 0
                      AND download_log.status IN ('ok', 'partial') THEN download_log.max_volume ELSE excluded.max_volume END,
                    downloaded_at = datetime('now'),
                    status = CASE WHEN download_log.exchange = 'NSE_INDEX' AND download_log.rows_inserted > 0
                      AND download_log.status IN ('ok', 'partial') THEN 'partial' ELSE excluded.status END,
                    note = excluded.note
                  WHERE NOT ? OR download_log.status <> 'ok'
                ",
                params![
                    &result.trade_date,
                    &result.exchange,
                    result.rows_inserted as i64,
                    result.max_volume as i64,
                    if subset_held_back { "partial" } else { "error" },
                    &result.message,
                    preserve_success,
                ],
            )?;
    }

    Ok(())
}

pub(crate) fn metadata_has_imported_rows_for_date(
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

pub(crate) fn metadata_get_latest_imported_trade_date(
    connection: &Connection,
    exchange: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "
              SELECT MAX(trade_date)
              FROM download_log
              WHERE exchange = ?
                AND (status = 'ok' OR (exchange = 'NSE_INDEX' AND status = 'partial'))
                AND rows_inserted > 0
            ",
            params![exchange],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|error| error.to_string())
}

pub(crate) fn metadata_load_imported_trade_dates(
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

pub(crate) fn metadata_has_stale_zero_volume_rows_for_date(
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

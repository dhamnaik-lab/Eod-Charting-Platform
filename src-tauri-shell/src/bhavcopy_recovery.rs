use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::database::binary_eod::{BinaryEodFile, DEFAULT_SCALE, HEADER_SIZE, RECORD_SIZE};
use crate::database::eod_binary_state::{BinaryStateIndex, BinaryStateKey};
use std::collections::{HashMap, VecDeque};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

pub type AppResult<T> = Result<T, String>;

pub const RECOVERY_SCHEMA_VERSION: &str = "eod-bhavcopy-recovery-v1";
const RECOVERY_ROOT: &str = "bhavcopy_recovery";
const RECOVERY_SESSIONS: &str = "sessions";
const MANIFEST_FILE: &str = "manifest.json";
const MANIFEST_BACKUP_FILE: &str = "manifest.json.bak";
const MANIFEST_TEMP_FILE: &str = "manifest.json.tmp";
const JOURNAL_FILE: &str = "records.ndjson";
const JOURNAL_TEMP_FILE: &str = "records.ndjson.tmp";
static SESSION_COUNTER: AtomicU64 = AtomicU64::new(0);
pub const MAX_BUFFERED_CHECKPOINT_WORKERS: usize = 2;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct BufferedCheckpointTelemetry {
    pub files: usize,
    pub workers: usize,
    pub verification_us: u128,
    pub sync_us: u128,
    pub publication_us: u128,
    pub sync_p50_us: u128,
    pub sync_p95_us: u128,
    pub sync_max_us: u128,
}

#[derive(Debug, Default)]
struct CheckpointSyncResult {
    files: usize,
    workers: usize,
    samples_us: Vec<u128>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecoverySessionState {
    Prepared,
    Applying,
    Applied,
    Checkpointing,
    Checkpointed,
    Failed,
    RecoveryError,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryJournalRow {
    pub exchange: String,
    pub trade_date: String,
    pub symbol: String,
    pub instrument_name: String,
    pub series: String,
    pub isin: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: i64,
    pub oi: i64,
    pub trades: Option<i64>,
    pub binary_date: u32,
    pub binary_flags: u32,
    pub binary_open: i64,
    pub binary_high: i64,
    pub binary_low: i64,
    pub binary_close: i64,
    pub binary_prev_close: i64,
    pub binary_volume: u64,
    pub binary_oi: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryJobSummary {
    pub exchange: String,
    pub trade_date: String,
    pub row_count: usize,
    pub max_volume: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecoveryBinaryBaselineKind {
    AppendNewest,
    Conservative,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryBinaryBaseline {
    pub exchange: String,
    pub symbol: String,
    pub kind: RecoveryBinaryBaselineKind,
    pub existed_before: bool,
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub target_dates: Vec<u32>,
}

#[derive(Clone, Debug)]
pub struct RecoverySessionSpec {
    pub mode: String,
    pub requested_start_date: String,
    pub requested_end_date: String,
    pub selected_exchanges: Vec<String>,
    pub excluded_series: Vec<String>,
    pub download_workers: u32,
    pub binary_workers: usize,
    pub price_storage_mode: String,
    pub jobs: Vec<RecoveryJobSummary>,
    pub binary_baselines: Vec<RecoveryBinaryBaseline>,
    pub rows: Vec<RecoveryJournalRow>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySessionManifest {
    pub schema_version: String,
    pub session_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub state: RecoverySessionState,
    pub database_folder: String,
    pub mode: String,
    pub requested_start_date: String,
    pub requested_end_date: String,
    pub selected_exchanges: Vec<String>,
    pub excluded_series: Vec<String>,
    pub download_workers: u32,
    pub binary_workers: usize,
    pub price_storage_mode: String,
    pub journal_file: String,
    pub journal_row_count: usize,
    pub journal_byte_length: u64,
    pub journal_sha256: String,
    pub jobs: Vec<RecoveryJobSummary>,
    #[serde(default)]
    pub binary_baselines: Vec<RecoveryBinaryBaseline>,
    #[serde(default)]
    pub binary_baselines_sha256: String,
    pub error_summary: Option<String>,
}

#[derive(Clone, Debug)]
pub struct RecoverySessionHandle {
    pub directory: PathBuf,
    pub manifest: RecoverySessionManifest,
}

#[derive(Clone, Debug)]
pub struct LoadedRecoverySession {
    pub directory: PathBuf,
    pub manifest: RecoverySessionManifest,
    pub rows: Vec<RecoveryJournalRow>,
}

pub fn create_prepared_session(
    database_folder: &Path,
    spec: RecoverySessionSpec,
) -> AppResult<RecoverySessionHandle> {
    if spec.rows.is_empty() {
        return Err("Cannot prepare an empty Bhavcopy recovery journal.".to_string());
    }

    let canonical_database = canonical_database_folder(database_folder)?;
    let session_id = next_session_id();
    let directory = recovery_sessions_root(database_folder).join(&session_id);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let journal_temp_path = directory.join(JOURNAL_TEMP_FILE);
    let journal_path = directory.join(JOURNAL_FILE);
    let (journal_byte_length, journal_sha256) =
        write_journal_file(&journal_temp_path, &spec.rows)?;
    fs::rename(&journal_temp_path, &journal_path).map_err(|error| error.to_string())?;

    let binary_baselines_sha256 = sha256_json(&spec.binary_baselines)?;
    let now = now_iso();
    let manifest = RecoverySessionManifest {
        schema_version: RECOVERY_SCHEMA_VERSION.to_string(),
        session_id,
        created_at: now.clone(),
        updated_at: now,
        state: RecoverySessionState::Prepared,
        database_folder: canonical_database,
        mode: spec.mode,
        requested_start_date: spec.requested_start_date,
        requested_end_date: spec.requested_end_date,
        selected_exchanges: spec.selected_exchanges,
        excluded_series: spec.excluded_series,
        download_workers: spec.download_workers,
        binary_workers: spec.binary_workers,
        price_storage_mode: spec.price_storage_mode,
        journal_file: JOURNAL_FILE.to_string(),
        journal_row_count: spec.rows.len(),
        journal_byte_length,
        journal_sha256,
        jobs: spec.jobs,
        binary_baselines: spec.binary_baselines,
        binary_baselines_sha256,
        error_summary: None,
    };
    write_manifest_atomic(&directory, &manifest)?;

    Ok(RecoverySessionHandle {
        directory,
        manifest,
    })
}

pub fn update_session_state(
    handle: &mut RecoverySessionHandle,
    state: RecoverySessionState,
    error_summary: Option<String>,
) -> AppResult<()> {
    handle.manifest.state = state;
    handle.manifest.error_summary = error_summary;
    handle.manifest.updated_at = now_iso();
    write_manifest_atomic(&handle.directory, &handle.manifest)
}

pub fn remove_checkpointed_session(handle: &RecoverySessionHandle) -> AppResult<()> {
    if handle.manifest.state != RecoverySessionState::Checkpointed {
        return Err(format!(
            "Refusing to remove non-checkpointed Bhavcopy recovery session {}.",
            handle.manifest.session_id
        ));
    }
    if handle.directory.exists() {
        fs::remove_dir_all(&handle.directory).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn load_pending_sessions(database_folder: &Path) -> AppResult<Vec<LoadedRecoverySession>> {
    let root = recovery_sessions_root(database_folder);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let canonical_database = canonical_database_folder(database_folder)?;
    let mut sessions = Vec::new();

    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let directory = entry.path();
        if !directory.is_dir() {
            continue;
        }

        let manifest = match read_manifest_with_backup(&directory) {
            Ok(manifest) => manifest,
            Err(error) => {
                if directory.join(MANIFEST_FILE).exists()
                    || directory.join(MANIFEST_BACKUP_FILE).exists()
                {
                    return Err(format!(
                        "Bhavcopy recovery session at {} has an unreadable manifest: {}",
                        directory.display(),
                        error
                    ));
                }
                continue;
            }
        };
        if manifest.schema_version != RECOVERY_SCHEMA_VERSION {
            return Err(format!(
                "Unsupported Bhavcopy recovery schema '{}' in session {}.",
                manifest.schema_version, manifest.session_id
            ));
        }
        if manifest.database_folder != canonical_database {
            return Err(format!(
                "Bhavcopy recovery session {} is bound to a different database folder.",
                manifest.session_id
            ));
        }
        if !manifest.binary_baselines.is_empty() {
            if manifest.binary_baselines_sha256.is_empty() {
                return Err(format!(
                    "Bhavcopy recovery session {} is missing its binary-baseline integrity digest.",
                    manifest.session_id
                ));
            }
            let baseline_digest = sha256_json(&manifest.binary_baselines)?;
            if baseline_digest != manifest.binary_baselines_sha256 {
                return Err(format!(
                    "Bhavcopy recovery session {} binary-baseline SHA-256 mismatch.",
                    manifest.session_id
                ));
            }
        }
        if manifest.state == RecoverySessionState::Checkpointed {
            let handle = RecoverySessionHandle {
                directory: directory.clone(),
                manifest,
            };
            let _ = remove_checkpointed_session(&handle);
            continue;
        }

        let journal_path = directory.join(&manifest.journal_file);
        let metadata = fs::metadata(&journal_path).map_err(|error| {
            format!(
                "Bhavcopy recovery session {} journal is missing: {}",
                manifest.session_id, error
            )
        })?;
        if metadata.len() != manifest.journal_byte_length {
            return Err(format!(
                "Bhavcopy recovery session {} journal length mismatch: expected {}, found {}.",
                manifest.session_id,
                manifest.journal_byte_length,
                metadata.len()
            ));
        }
        let digest = sha256_file(&journal_path)?;
        if digest != manifest.journal_sha256 {
            return Err(format!(
                "Bhavcopy recovery session {} journal SHA-256 mismatch.",
                manifest.session_id
            ));
        }
        let rows = read_journal_rows(&journal_path)?;
        if rows.len() != manifest.journal_row_count {
            return Err(format!(
                "Bhavcopy recovery session {} row-count mismatch: expected {}, found {}.",
                manifest.session_id,
                manifest.journal_row_count,
                rows.len()
            ));
        }
        sessions.push(LoadedRecoverySession {
            directory,
            manifest,
            rows,
        });
    }

    sessions.sort_by(|left, right| left.manifest.created_at.cmp(&right.manifest.created_at));
    Ok(sessions)
}

pub fn handle_from_loaded(session: &LoadedRecoverySession) -> RecoverySessionHandle {
    RecoverySessionHandle {
        directory: session.directory.clone(),
        manifest: session.manifest.clone(),
    }
}

pub fn restore_buffered_binary_baselines(
    database_folder: &Path,
    baselines: &[RecoveryBinaryBaseline],
    rows: &[RecoveryJournalRow],
) -> AppResult<()> {
    let journal_targets = journal_rows_by_symbol(rows);

    for baseline in baselines {
        match baseline.kind {
            RecoveryBinaryBaselineKind::Conservative => continue,
            RecoveryBinaryBaselineKind::AppendNewest => {
                restore_append_newest_baseline(database_folder, baseline, &journal_targets)?;
            }
        }
    }
    Ok(())
}

pub fn checkpoint_buffered_append_newest_files(
    database_folder: &Path,
    baselines: &[RecoveryBinaryBaseline],
    rows: &[RecoveryJournalRow],
) -> AppResult<BufferedCheckpointTelemetry> {
    let verification_started = Instant::now();
    let journal_targets = journal_rows_by_symbol(rows);
    let mut verified_paths = Vec::<PathBuf>::new();

    // Phase 1: verify every deferred APPEND_NEWEST tail before starting any
    // physical checkpoint. If any file fails verification, the caller can
    // conservatively fall back to full journal replay without a partially
    // verified batch being mistaken for complete.
    for baseline in baselines {
        if baseline.kind != RecoveryBinaryBaselineKind::AppendNewest {
            continue;
        }

        let key = (baseline.exchange.clone(), baseline.symbol.clone());
        let expected_rows = journal_targets.get(&key).ok_or_else(|| {
            format!(
                "Cannot checkpoint buffered APPEND_NEWEST file {}:{} because its recovery rows are missing.",
                baseline.exchange, baseline.symbol
            )
        })?;
        let path = binary_path_for_baseline(database_folder, baseline);
        let expected_record_count = baseline.record_count as usize + expected_rows.len();
        let expected_length =
            HEADER_SIZE as u64 + expected_record_count as u64 * RECORD_SIZE as u64;
        let metadata = fs::metadata(&path).map_err(|error| {
            format!(
                "Cannot checkpoint buffered APPEND_NEWEST file {}:{}: {}",
                baseline.exchange, baseline.symbol, error
            )
        })?;
        if metadata.len() != expected_length {
            return Err(format!(
                "Buffered APPEND_NEWEST verification failed for {}:{}: expected {} bytes after apply, found {}.",
                baseline.exchange,
                baseline.symbol,
                expected_length,
                metadata.len()
            ));
        }

        let binary = BinaryEodFile::open(&path).map_err(|error| {
            format!(
                "Buffered APPEND_NEWEST verification failed for {}:{}: {}",
                baseline.exchange, baseline.symbol, error
            )
        })?;
        if binary.header.record_count as usize != expected_record_count {
            return Err(format!(
                "Buffered APPEND_NEWEST verification failed for {}:{}: expected header count {}, found {}.",
                baseline.exchange,
                baseline.symbol,
                expected_record_count,
                binary.header.record_count
            ));
        }
        if binary.header.price_scale != DEFAULT_SCALE {
            return Err(format!(
                "Buffered APPEND_NEWEST verification failed for {}:{}: expected price scale {}, found {}.",
                baseline.exchange, baseline.symbol, DEFAULT_SCALE, binary.header.price_scale
            ));
        }

        let mut file = File::open(&path).map_err(|error| error.to_string())?;
        file.seek(SeekFrom::Start(baseline.file_length))
            .map_err(|error| error.to_string())?;
        for row in expected_rows {
            let mut record_bytes = [0_u8; RECORD_SIZE];
            file.read_exact(&mut record_bytes)
                .map_err(|error| error.to_string())?;
            if !record_bytes_match_journal_row(&record_bytes, row) {
                return Err(format!(
                    "Buffered APPEND_NEWEST verification failed for {}:{}@{} because the current tail record does not match the recovery journal.",
                    baseline.exchange, baseline.symbol, row.binary_date
                ));
            }
        }
        verified_paths.push(path);
    }
    let verification_us = nonzero_phase_us(verification_started, !verified_paths.is_empty());

    // Phase 2: the expensive durability barrier is independent per symbol file.
    // V1.7C: use the two-worker checkpoint cap selected by the V1.7B same-drive HDD
    // benchmark. This changes concurrency only; every deferred file still crosses the
    // same sync_data durability barrier before publication. Re-syncing a file after
    // an interrupted worker is safe and idempotent.
    let sync_started = Instant::now();
    let sync_result = sync_verified_checkpoint_paths(verified_paths)?;
    let sync_us = nonzero_phase_us(sync_started, sync_result.files > 0);
    let (sync_p50_us, sync_p95_us, sync_max_us) = sync_latency_summary(&sync_result.samples_us);

    // V1.6/V1.7A: publish only after every deferred APPEND_NEWEST file has crossed
    // its durability barrier. New/full-file writes now sync before return, so all
    // conservative/new-file baselines are also durable before publication. The
    // caller marks the recovery session CHECKPOINTED only after this function
    // returns, so publication failure keeps the durable recovery journal available
    // for a safe retry.
    let publication_started = Instant::now();
    publish_recovery_binary_state(database_folder, baselines)?;
    let publication_us = nonzero_phase_us(publication_started, !baselines.is_empty());

    Ok(BufferedCheckpointTelemetry {
        files: sync_result.files,
        workers: sync_result.workers,
        verification_us,
        sync_us,
        publication_us,
        sync_p50_us,
        sync_p95_us,
        sync_max_us,
    })
}

pub fn publish_recovery_binary_state(
    database_folder: &Path,
    baselines: &[RecoveryBinaryBaseline],
) -> AppResult<usize> {
    if baselines.is_empty() {
        return Ok(0);
    }

    let sidecar_path = BinaryStateIndex::sidecar_path_for(database_folder);
    if !sidecar_path.is_file() {
        // The state index is derived acceleration metadata. Databases created
        // before bootstrap, or deliberately operating without the sidecar, must
        // retain the legacy durability semantics rather than being blocked.
        return Ok(0);
    }

    let mut keys = baselines
        .iter()
        .map(|baseline| {
            BinaryStateKey::new(baseline.exchange.clone(), baseline.symbol.clone())
        })
        .collect::<Vec<_>>();
    keys.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    keys.dedup_by(|left, right| left.exchange == right.exchange && left.symbol == right.symbol);

    let mut index = BinaryStateIndex::open_existing_read_write(database_folder)?;
    let result = index.publish_verified_keys(&keys)?;
    Ok(result.published)
}

fn buffered_checkpoint_worker_count(file_count: usize) -> usize {
    file_count.min(MAX_BUFFERED_CHECKPOINT_WORKERS)
}

fn sync_verified_checkpoint_paths(paths: Vec<PathBuf>) -> AppResult<CheckpointSyncResult> {
    let file_count = paths.len();
    let worker_count = buffered_checkpoint_worker_count(file_count);
    if worker_count == 0 {
        return Ok(CheckpointSyncResult::default());
    }

    let queue = Arc::new(Mutex::new(VecDeque::from(paths)));
    let first_error = Arc::new(Mutex::new(None::<String>));
    let sync_samples_us = Arc::new(Mutex::new(Vec::<u128>::with_capacity(file_count)));
    let mut workers = Vec::with_capacity(worker_count);

    for _ in 0..worker_count {
        let queue = Arc::clone(&queue);
        let first_error = Arc::clone(&first_error);
        let sync_samples_us = Arc::clone(&sync_samples_us);
        workers.push(thread::spawn(move || loop {
            if first_error
                .lock()
                .map(|slot| slot.is_some())
                .unwrap_or(true)
            {
                return;
            }
            let path = match queue.lock() {
                Ok(mut queue) => queue.pop_front(),
                Err(_) => {
                    if let Ok(mut slot) = first_error.lock() {
                        *slot = Some(
                            "Bhavcopy buffered checkpoint queue lock was poisoned.".to_string(),
                        );
                    }
                    return;
                }
            };
            let Some(path) = path else {
                return;
            };

            let file = match OpenOptions::new().read(true).write(true).open(&path) {
                Ok(file) => file,
                Err(error) => {
                    if let Ok(mut slot) = first_error.lock() {
                        if slot.is_none() {
                            *slot = Some(format!(
                                "Buffered APPEND_NEWEST checkpoint open failed for {}: {}",
                                path.display(),
                                error
                            ));
                        }
                    }
                    return;
                }
            };

            let sync_started = Instant::now();
            if let Err(error) = file.sync_data() {
                if let Ok(mut slot) = first_error.lock() {
                    if slot.is_none() {
                        *slot = Some(format!(
                            "Buffered APPEND_NEWEST checkpoint sync failed for {}: {}",
                            path.display(),
                            error
                        ));
                    }
                }
                return;
            }
            let sample_us = sync_started.elapsed().as_micros().max(1);
            if let Ok(mut samples) = sync_samples_us.lock() {
                samples.push(sample_us);
            } else if let Ok(mut slot) = first_error.lock() {
                if slot.is_none() {
                    *slot = Some(
                        "Bhavcopy buffered checkpoint telemetry lock was poisoned.".to_string(),
                    );
                }
                return;
            }
        }));
    }

    for worker in workers {
        if worker.join().is_err() {
            if let Ok(mut slot) = first_error.lock() {
                if slot.is_none() {
                    *slot = Some(
                        "Bhavcopy buffered checkpoint worker thread panicked.".to_string(),
                    );
                }
            }
        }
    }

    let error = first_error
        .lock()
        .map_err(|_| "Bhavcopy buffered checkpoint error lock was poisoned.".to_string())?
        .clone();
    if let Some(error) = error {
        return Err(error);
    }

    let samples_us = sync_samples_us
        .lock()
        .map_err(|_| "Bhavcopy buffered checkpoint telemetry lock was poisoned.".to_string())?
        .clone();
    if samples_us.len() != file_count {
        return Err(format!(
            "Bhavcopy buffered checkpoint telemetry mismatch: expected {} successful sync samples, found {}.",
            file_count,
            samples_us.len()
        ));
    }

    Ok(CheckpointSyncResult {
        files: file_count,
        workers: worker_count,
        samples_us,
    })
}

fn nonzero_phase_us(started: Instant, had_work: bool) -> u128 {
    if had_work {
        started.elapsed().as_micros().max(1)
    } else {
        0
    }
}

fn sync_latency_summary(samples_us: &[u128]) -> (u128, u128, u128) {
    if samples_us.is_empty() {
        return (0, 0, 0);
    }
    let mut sorted = samples_us.to_vec();
    sorted.sort_unstable();
    let p50 = nearest_rank_percentile(&sorted, 50);
    let p95 = nearest_rank_percentile(&sorted, 95);
    let max = *sorted.last().unwrap_or(&0);
    (p50, p95, max)
}

fn nearest_rank_percentile(sorted_samples: &[u128], percentile: usize) -> u128 {
    if sorted_samples.is_empty() {
        return 0;
    }
    let rank = ((percentile * sorted_samples.len()) + 99) / 100;
    sorted_samples[rank.saturating_sub(1).min(sorted_samples.len() - 1)]
}

fn journal_rows_by_symbol<'a>(
    rows: &'a [RecoveryJournalRow],
) -> HashMap<(String, String), Vec<&'a RecoveryJournalRow>> {
    let mut grouped = HashMap::<(String, String), Vec<&RecoveryJournalRow>>::new();
    for row in rows {
        grouped
            .entry((row.exchange.clone(), row.symbol.clone()))
            .or_default()
            .push(row);
    }
    for symbol_rows in grouped.values_mut() {
        symbol_rows.sort_by_key(|row| row.binary_date);
    }
    grouped
}

fn binary_path_for_baseline(database_folder: &Path, baseline: &RecoveryBinaryBaseline) -> PathBuf {
    database_folder
        .join("eod_data")
        .join(&baseline.exchange)
        .join(format!("{}.eod", baseline.symbol))
}

fn restore_append_newest_baseline(
    database_folder: &Path,
    baseline: &RecoveryBinaryBaseline,
    journal_targets: &HashMap<(String, String), Vec<&RecoveryJournalRow>>,
) -> AppResult<()> {
    let path = binary_path_for_baseline(database_folder, baseline);
    if !path.exists() {
        return Err(format!(
            "Cannot restore APPEND_NEWEST recovery baseline because the pre-existing file is missing: {}",
            path.display()
        ));
    }

    let expected_length = HEADER_SIZE as u64 + baseline.record_count as u64 * RECORD_SIZE as u64;
    if baseline.file_length != expected_length {
        return Err(format!(
            "Recovery baseline length mismatch for {}:{}: expected {}, manifest recorded {}.",
            baseline.exchange, baseline.symbol, expected_length, baseline.file_length
        ));
    }

    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() < baseline.file_length {
        return Err(format!(
            "Cannot restore APPEND_NEWEST recovery baseline for {}:{} because the file is shorter than its pre-import length ({} < {}).",
            baseline.exchange,
            baseline.symbol,
            metadata.len(),
            baseline.file_length
        ));
    }

    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(&path)
        .map_err(|error| error.to_string())?;

    let mut prefix = [0_u8; 8];
    file.read_exact(&mut prefix).map_err(|error| error.to_string())?;
    if &prefix[0..4] != b"EOD1" {
        return Err(format!(
            "Cannot restore APPEND_NEWEST recovery baseline for {}:{} because the binary magic is invalid.",
            baseline.exchange, baseline.symbol
        ));
    }

    let key = (baseline.exchange.clone(), baseline.symbol.clone());
    let expected_rows = journal_targets.get(&key).ok_or_else(|| {
        format!(
            "Cannot restore APPEND_NEWEST recovery baseline for {}:{} because its recovery rows are missing.",
            baseline.exchange, baseline.symbol
        )
    })?;

    let complete_records = metadata
        .len()
        .saturating_sub(HEADER_SIZE as u64)
        / RECORD_SIZE as u64;
    if complete_records > baseline.record_count as u64 {
        let tail_count = (complete_records - baseline.record_count as u64) as usize;
        if tail_count > expected_rows.len() {
            return Err(format!(
                "Refusing APPEND_NEWEST recovery rollback for {}:{} because the current tail contains {} complete records but the recovery journal contains only {} expected appended records.",
                baseline.exchange,
                baseline.symbol,
                tail_count,
                expected_rows.len()
            ));
        }
        file.seek(SeekFrom::Start(baseline.file_length))
            .map_err(|error| error.to_string())?;
        for journal_row in expected_rows.iter().take(tail_count) {
            let mut record_bytes = [0_u8; RECORD_SIZE];
            file.read_exact(&mut record_bytes)
                .map_err(|error| error.to_string())?;
            let date = u32::from_le_bytes(record_bytes[0..4].try_into().unwrap());
            if !record_bytes_match_journal_row(&record_bytes, journal_row) {
                return Err(format!(
                    "Refusing APPEND_NEWEST recovery rollback for {}:{}@{} because the current tail record no longer matches the recovery journal.",
                    baseline.exchange, baseline.symbol, date
                ));
            }
        }
    }

    file.set_len(baseline.file_length)
        .map_err(|error| error.to_string())?;
    file.seek(SeekFrom::Start(8))
        .map_err(|error| error.to_string())?;
    file.write_all(&baseline.record_count.to_le_bytes())
        .map_err(|error| error.to_string())?;
    file.seek(SeekFrom::Start(12))
        .map_err(|error| error.to_string())?;
    file.write_all(&baseline.price_scale.to_le_bytes())
        .map_err(|error| error.to_string())?;
    file.flush().map_err(|error| error.to_string())?;
    file.sync_data().map_err(|error| error.to_string())?;
    Ok(())
}

fn record_bytes_match_journal_row(
    bytes: &[u8; RECORD_SIZE],
    row: &RecoveryJournalRow,
) -> bool {
    u32::from_le_bytes(bytes[0..4].try_into().unwrap()) == row.binary_date
        && u32::from_le_bytes(bytes[4..8].try_into().unwrap()) == row.binary_flags
        && i64::from_le_bytes(bytes[8..16].try_into().unwrap()) == row.binary_open
        && i64::from_le_bytes(bytes[16..24].try_into().unwrap()) == row.binary_high
        && i64::from_le_bytes(bytes[24..32].try_into().unwrap()) == row.binary_low
        && i64::from_le_bytes(bytes[32..40].try_into().unwrap()) == row.binary_close
        && i64::from_le_bytes(bytes[40..48].try_into().unwrap()) == row.binary_prev_close
        && u64::from_le_bytes(bytes[48..56].try_into().unwrap()) == row.binary_volume
        && u64::from_le_bytes(bytes[56..64].try_into().unwrap()) == row.binary_oi
}

fn recovery_sessions_root(database_folder: &Path) -> PathBuf {
    database_folder.join(RECOVERY_ROOT).join(RECOVERY_SESSIONS)
}

fn canonical_database_folder(path: &Path) -> AppResult<String> {
    let canonical = fs::canonicalize(path).map_err(|error| error.to_string())?;
    Ok(canonical.to_string_lossy().to_string())
}

fn next_session_id() -> String {
    let sequence = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!(
        "{}-p{}-{}",
        Utc::now().format("%Y%m%dT%H%M%S%.6fZ"),
        process::id(),
        sequence
    )
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn write_journal_file(path: &Path, rows: &[RecoveryJournalRow]) -> AppResult<(u64, String)> {
    let file = File::create(path).map_err(|error| error.to_string())?;
    let mut writer = BufWriter::new(file);
    let mut hasher = Sha256::new();
    let mut byte_length = 0_u64;

    for row in rows {
        let mut serialized = serde_json::to_vec(row).map_err(|error| error.to_string())?;
        serialized.push(b'\n');
        writer
            .write_all(&serialized)
            .map_err(|error| error.to_string())?;
        hasher.update(&serialized);
        byte_length += serialized.len() as u64;
    }
    writer.flush().map_err(|error| error.to_string())?;
    let file = writer.into_inner().map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;

    Ok((byte_length, hex_digest(hasher.finalize())))
}

fn read_journal_rows(path: &Path) -> AppResult<Vec<RecoveryJournalRow>> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut rows = Vec::new();
    for (index, line) in reader.lines().enumerate() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let row = serde_json::from_str::<RecoveryJournalRow>(&line).map_err(|error| {
            format!(
                "Invalid Bhavcopy recovery journal row {}: {}",
                index + 1,
                error
            )
        })?;
        rows.push(row);
    }
    Ok(rows)
}

fn sha256_json<T: Serialize>(value: &T) -> AppResult<String> {
    let serialized = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&serialized);
    Ok(hex_digest(hasher.finalize()))
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut reader = BufReader::new(File::open(path).map_err(|error| error.to_string())?);
    let mut hasher = Sha256::new();
    std::io::copy(&mut reader, &mut HashWriter(&mut hasher)).map_err(|error| error.to_string())?;
    Ok(hex_digest(hasher.finalize()))
}

struct HashWriter<'a>(&'a mut Sha256);

impl Write for HashWriter<'_> {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        self.0.update(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn hex_digest(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>()
}

fn write_manifest_atomic(directory: &Path, manifest: &RecoverySessionManifest) -> AppResult<()> {
    let temp_path = directory.join(MANIFEST_TEMP_FILE);
    let manifest_path = directory.join(MANIFEST_FILE);
    let backup_path = directory.join(MANIFEST_BACKUP_FILE);
    let serialized = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;

    {
        let mut file = File::create(&temp_path).map_err(|error| error.to_string())?;
        file.write_all(&serialized).map_err(|error| error.to_string())?;
        file.flush().map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }

    if backup_path.exists() {
        fs::remove_file(&backup_path).map_err(|error| error.to_string())?;
    }
    if manifest_path.exists() {
        fs::rename(&manifest_path, &backup_path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temp_path, &manifest_path) {
        if backup_path.exists() && !manifest_path.exists() {
            let _ = fs::rename(&backup_path, &manifest_path);
        }
        return Err(error.to_string());
    }
    if backup_path.exists() {
        fs::remove_file(&backup_path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_manifest_with_backup(directory: &Path) -> AppResult<RecoverySessionManifest> {
    let manifest_path = directory.join(MANIFEST_FILE);
    match read_manifest(&manifest_path) {
        Ok(manifest) => Ok(manifest),
        Err(primary_error) => {
            let backup_path = directory.join(MANIFEST_BACKUP_FILE);
            read_manifest(&backup_path).map_err(|backup_error| {
                format!(
                    "Bhavcopy recovery manifest is unreadable (primary: {}; backup: {}).",
                    primary_error, backup_error
                )
            })
        }
    }
}

fn read_manifest(path: &Path) -> AppResult<RecoverySessionManifest> {
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<RecoverySessionManifest>(&raw).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_row(date: u32) -> RecoveryJournalRow {
        RecoveryJournalRow {
            exchange: "NSE".to_string(),
            trade_date: "2026-08-07".to_string(),
            symbol: "TEST".to_string(),
            instrument_name: "Test Instrument".to_string(),
            series: "EQ".to_string(),
            isin: "INE000TEST00".to_string(),
            open: 100.0,
            high: 105.0,
            low: 99.0,
            close: 103.0,
            prev_close: Some(101.0),
            volume: 10_000,
            oi: 0,
            trades: Some(500),
            binary_date: date,
            binary_flags: 0,
            binary_open: 10_000,
            binary_high: 10_500,
            binary_low: 9_900,
            binary_close: 10_300,
            binary_prev_close: 10_100,
            binary_volume: 10_000,
            binary_oi: 0,
        }
    }

    fn sample_spec(rows: Vec<RecoveryJournalRow>) -> RecoverySessionSpec {
        RecoverySessionSpec {
            mode: "Range".to_string(),
            requested_start_date: "2026-08-07".to_string(),
            requested_end_date: "2026-08-07".to_string(),
            selected_exchanges: vec!["NSE".to_string()],
            excluded_series: Vec::new(),
            download_workers: 2,
            binary_workers: 4,
            price_storage_mode: "Binary".to_string(),
            jobs: vec![RecoveryJobSummary {
                exchange: "NSE".to_string(),
                trade_date: "2026-08-07".to_string(),
                row_count: rows.len(),
                max_volume: 10_000,
            }],
            binary_baselines: Vec::new(),
            rows,
        }
    }

    #[test]
    fn prepared_session_round_trips_and_validates_sha256() {
        let dir = tempdir().unwrap();
        let handle = create_prepared_session(dir.path(), sample_spec(vec![sample_row(20260807)]))
            .unwrap();
        assert_eq!(handle.manifest.state, RecoverySessionState::Prepared);
        let loaded = load_pending_sessions(dir.path()).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].rows.len(), 1);
        assert_eq!(loaded[0].rows[0].symbol, "TEST");
    }

    #[test]
    fn state_updates_are_persisted_and_checkpointed_sessions_are_cleaned() {
        let dir = tempdir().unwrap();
        let mut handle =
            create_prepared_session(dir.path(), sample_spec(vec![sample_row(20260807)])).unwrap();
        update_session_state(&mut handle, RecoverySessionState::Applying, None).unwrap();
        let loaded = load_pending_sessions(dir.path()).unwrap();
        assert_eq!(loaded[0].manifest.state, RecoverySessionState::Applying);

        update_session_state(&mut handle, RecoverySessionState::Checkpointed, None).unwrap();
        let loaded = load_pending_sessions(dir.path()).unwrap();
        assert!(loaded.is_empty());
        assert!(!handle.directory.exists());
    }

    #[test]
    fn corrupted_journal_is_rejected() {
        let dir = tempdir().unwrap();
        let handle = create_prepared_session(dir.path(), sample_spec(vec![sample_row(20260807)]))
            .unwrap();
        fs::write(handle.directory.join(JOURNAL_FILE), b"corrupt\n").unwrap();
        let error = load_pending_sessions(dir.path()).unwrap_err();
        assert!(error.contains("length mismatch") || error.contains("SHA-256 mismatch"));
    }

    #[test]
    fn session_bound_to_other_database_is_rejected() {
        let first = tempdir().unwrap();
        let second = tempdir().unwrap();
        let handle = create_prepared_session(
            first.path(),
            sample_spec(vec![sample_row(20260807)]),
        )
        .unwrap();
        let destination = recovery_sessions_root(second.path()).join(&handle.manifest.session_id);
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::rename(&handle.directory, &destination).unwrap();
        let error = load_pending_sessions(second.path()).unwrap_err();
        assert!(error.contains("different database folder"));
    }

    #[test]
    fn binary_baseline_manifest_integrity_is_validated() {
        let dir = tempdir().unwrap();
        let mut spec = sample_spec(vec![sample_row(20260807)]);
        spec.binary_baselines.push(RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: 1,
            price_scale: 100,
            file_length: (HEADER_SIZE + RECORD_SIZE) as u64,
            target_dates: vec![20260807],
        });
        let handle = create_prepared_session(dir.path(), spec).unwrap();
        let manifest_path = handle.directory.join(MANIFEST_FILE);
        let mut manifest = read_manifest(&manifest_path).unwrap();
        manifest.binary_baselines[0].record_count = 2;
        fs::write(&manifest_path, serde_json::to_vec_pretty(&manifest).unwrap()).unwrap();
        let error = load_pending_sessions(dir.path()).unwrap_err();
        assert!(error.contains("binary-baseline SHA-256 mismatch"));
    }

    #[test]
    fn append_newest_baseline_restores_pre_import_tail_and_header() {
        use crate::database::binary_eod::{EodRecord, DEFAULT_SCALE};
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };
        BinaryEodFile::append_or_merge_records_with_stats(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![EodRecord {
                date: 20260807,
                flags: 0,
                open: 10_000,
                high: 10_500,
                low: 9_900,
                close: 10_300,
                prev_close: 10_100,
                volume: 10_000,
                oi: 0,
            }],
        )
        .unwrap();

        restore_buffered_binary_baselines(dir.path(), &[baseline], &[sample_row(20260807)]).unwrap();
        let restored = BinaryEodFile::open(&path).unwrap();
        assert_eq!(restored.header.record_count, 1);
        assert_eq!(restored.read_all().unwrap(), original);
        assert_eq!(fs::metadata(&path).unwrap().len(), (HEADER_SIZE + RECORD_SIZE) as u64);
    }

    #[test]
    fn append_newest_baseline_refuses_unknown_post_baseline_date() {
        use crate::database::binary_eod::{EodRecord, DEFAULT_SCALE};
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };
        BinaryEodFile::append_or_merge_records_with_stats(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![EodRecord {
                date: 20260808,
                flags: 0,
                open: 106,
                high: 112,
                low: 101,
                close: 109,
                prev_close: 105,
                volume: 2_000,
                oi: 0,
            }],
        )
        .unwrap();

        let error = restore_buffered_binary_baselines(dir.path(), &[baseline], &[sample_row(20260807)]).unwrap_err();
        assert!(error.contains("no longer matches the recovery journal"));
    }



    #[test]
    fn append_newest_baseline_refuses_changed_journal_tail_record() {
        use crate::database::binary_eod::{EodRecord, DEFAULT_SCALE};
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };
        BinaryEodFile::append_or_merge_records_with_stats(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![EodRecord {
                date: 20260807,
                flags: 0,
                open: 10_000,
                high: 10_500,
                low: 9_900,
                close: 99_999,
                prev_close: 10_100,
                volume: 10_000,
                oi: 0,
            }],
        )
        .unwrap();

        let error = restore_buffered_binary_baselines(
            dir.path(),
            &[baseline],
            &[sample_row(20260807)],
        )
        .unwrap_err();
        assert!(error.contains("no longer matches the recovery journal"));
    }

    #[test]
    fn v17c_production_checkpoint_worker_count_is_bounded_to_two() {
        assert_eq!(buffered_checkpoint_worker_count(0), 0);
        assert_eq!(buffered_checkpoint_worker_count(1), 1);
        assert_eq!(buffered_checkpoint_worker_count(2), 2);
        assert_eq!(buffered_checkpoint_worker_count(3), 2);
        assert_eq!(buffered_checkpoint_worker_count(4), 2);
        assert_eq!(buffered_checkpoint_worker_count(8_570), 2);
    }

    #[test]
    fn buffered_append_newest_checkpoint_verifies_and_syncs_complete_tail() {
        use crate::database::binary_eod::{BinaryWriteDurability, EodRecord};
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };

        let result = BinaryEodFile::append_or_merge_records_with_stats_durability(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![EodRecord {
                date: 20260807,
                flags: 0,
                open: 10_000,
                high: 10_500,
                low: 9_900,
                close: 10_300,
                prev_close: 10_100,
                volume: 10_000,
                oi: 0,
            }],
            BinaryWriteDurability::RecoveryJournalBuffered,
        )
        .unwrap();
        assert_eq!(result.diagnostics.sync_data_calls, 0);
        assert_eq!(result.diagnostics.deferred_sync_calls, 1);

        let checkpointed = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline.clone()],
            &[sample_row(20260807)],
        )
        .unwrap();
        assert_eq!(checkpointed.files, 1);

        // A process can stop after the session is durably marked CHECKPOINTING.
        // Re-running the checkpoint against an already-complete/synced tail must
        // remain safe and idempotent so the next Bhavcopy operation can resume.
        let checkpointed_again = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[sample_row(20260807)],
        )
        .unwrap();
        assert_eq!(checkpointed_again.files, 1);
    }

    #[test]
    fn buffered_append_newest_checkpoint_rejects_missing_tail_before_cleanup() {
        use crate::database::binary_eod::EodRecord;
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };

        let error = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[sample_row(20260807)],
        )
        .unwrap_err();
        assert!(error.contains("expected") && error.contains("bytes after apply"));
    }

    #[test]
    fn append_newest_recovery_preserves_duplicate_date_row_order() {
        use crate::database::binary_eod::EodRecord;
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");
        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();
        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };
        let first = sample_row(20260807);
        let mut second = sample_row(20260807);
        second.binary_close = 10_301;

        BinaryEodFile::append_or_merge_records_with_stats(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![
                EodRecord {
                    date: first.binary_date,
                    flags: first.binary_flags,
                    open: first.binary_open,
                    high: first.binary_high,
                    low: first.binary_low,
                    close: first.binary_close,
                    prev_close: first.binary_prev_close,
                    volume: first.binary_volume,
                    oi: first.binary_oi,
                },
                EodRecord {
                    date: second.binary_date,
                    flags: second.binary_flags,
                    open: second.binary_open,
                    high: second.binary_high,
                    low: second.binary_low,
                    close: second.binary_close,
                    prev_close: second.binary_prev_close,
                    volume: second.binary_volume,
                    oi: second.binary_oi,
                },
            ],
        )
        .unwrap();

        restore_buffered_binary_baselines(dir.path(), &[baseline], &[first, second]).unwrap();
        let restored = BinaryEodFile::open(&path).unwrap();
        assert_eq!(restored.header.record_count, 1);
        assert_eq!(restored.read_all().unwrap(), original);
    }

}

#[cfg(test)]
mod v16_state_publication_tests {
    use super::*;
    use crate::database::binary_eod::{BinaryWriteDurability, EodRecord};
    use crate::database::eod_binary_state::{BinaryStateIndex, BinaryStateKey};
    use std::fs;
    use tempfile::tempdir;

    fn v16_row(date: u32) -> RecoveryJournalRow {
        RecoveryJournalRow {
            exchange: "NSE".to_string(),
            trade_date: "2026-08-07".to_string(),
            symbol: "TEST".to_string(),
            instrument_name: "Test Instrument".to_string(),
            series: "EQ".to_string(),
            isin: "INE000TEST00".to_string(),
            open: 100.0,
            high: 105.0,
            low: 99.0,
            close: 103.0,
            prev_close: Some(101.0),
            volume: 10_000,
            oi: 0,
            trades: Some(500),
            binary_date: date,
            binary_flags: 0,
            binary_open: 10_000,
            binary_high: 10_500,
            binary_low: 9_900,
            binary_close: 10_300,
            binary_prev_close: 10_100,
            binary_volume: 10_000,
            binary_oi: 0,
        }
    }

    fn setup_indexed_append_newest_fixture() -> (
        tempfile::TempDir,
        RecoveryBinaryBaseline,
        RecoveryJournalRow,
    ) {
        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join("TEST.eod");

        let mut original = vec![EodRecord {
            date: 20260806,
            flags: 0,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            prev_close: 99,
            volume: 1_000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE, &mut original).unwrap();

        let mut state_index = BinaryStateIndex::open(dir.path()).unwrap();
        let rebuilt = state_index.rebuild().unwrap();
        assert_eq!(rebuilt.generation, 1);
        assert_eq!(rebuilt.indexed, 1);
        drop(state_index);

        let before = BinaryEodFile::open(&path).unwrap();
        let baseline = RecoveryBinaryBaseline {
            exchange: "NSE".to_string(),
            symbol: "TEST".to_string(),
            kind: RecoveryBinaryBaselineKind::AppendNewest,
            existed_before: true,
            record_count: before.header.record_count,
            price_scale: before.header.price_scale,
            file_length: fs::metadata(&path).unwrap().len(),
            target_dates: vec![20260807],
        };

        let row = v16_row(20260807);
        BinaryEodFile::append_or_merge_records_with_stats_durability(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![EodRecord {
                date: row.binary_date,
                flags: row.binary_flags,
                open: row.binary_open,
                high: row.binary_high,
                low: row.binary_low,
                close: row.binary_close,
                prev_close: row.binary_prev_close,
                volume: row.binary_volume,
                oi: row.binary_oi,
            }],
            BinaryWriteDurability::RecoveryJournalBuffered,
        )
        .unwrap();

        (dir, baseline, row)
    }

    #[test]
    fn v16_checkpoint_publishes_fresh_verified_state_without_generation_bump() {
        let (dir, baseline, row) = setup_indexed_append_newest_fixture();

        let checkpointed = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[row],
        )
        .unwrap();
        assert_eq!(checkpointed.files, 1);

        let index = BinaryStateIndex::open_existing_read_only(dir.path()).unwrap();
        let metadata = index.read_metadata().unwrap();
        assert_eq!(metadata.index_generation, 1);

        let verified = index.load_verified().unwrap();
        let state = verified.get(&BinaryStateKey::new("NSE", "TEST")).unwrap();
        assert_eq!(state.record_count, 2);
        assert_eq!(state.last_date, Some(20260807));
        assert_eq!(state.state_generation, 1);
    }

    #[test]
    fn v16_checkpoint_reports_state_publication_failure_before_caller_cleanup() {
        let (dir, baseline, row) = setup_indexed_append_newest_fixture();
        let sidecar = BinaryStateIndex::sidecar_path_for(dir.path());
        fs::write(&sidecar, b"not-a-sqlite-database").unwrap();

        let error = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[row],
        )
        .unwrap_err();
        assert!(
            error.contains("EOD binary state")
                || error.contains("database")
                || error.contains("SQLite"),
            "unexpected publication error: {error}"
        );
    }

    #[test]
    fn v16_checkpoint_and_state_publication_are_idempotent() {
        let (dir, baseline, row) = setup_indexed_append_newest_fixture();

        let first = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline.clone()],
            &[row.clone()],
        )
        .unwrap();
        let second = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[row],
        )
        .unwrap();

        assert_eq!(first.files, 1);
        assert_eq!(second.files, 1);
        let index = BinaryStateIndex::open_existing_read_only(dir.path()).unwrap();
        assert_eq!(index.read_metadata().unwrap().index_generation, 1);
        assert_eq!(
            index
                .load_verified()
                .unwrap()
                .get(&BinaryStateKey::new("NSE", "TEST"))
                .unwrap()
                .record_count,
            2
        );
    }
    #[test]
    fn v17a_checkpoint_phase_telemetry_reports_durability_costs() {
        let (dir, baseline, row) = setup_indexed_append_newest_fixture();

        let telemetry = checkpoint_buffered_append_newest_files(
            dir.path(),
            &[baseline],
            &[row],
        )
        .unwrap();

        assert_eq!(telemetry.files, 1);
        assert_eq!(telemetry.workers, 1);
        assert!(telemetry.verification_us > 0);
        assert!(telemetry.sync_us > 0);
        assert!(telemetry.publication_us > 0);
        assert!(telemetry.sync_p50_us > 0);
        assert!(telemetry.sync_p95_us > 0);
        assert!(telemetry.sync_max_us > 0);
        assert!(telemetry.sync_p50_us <= telemetry.sync_p95_us);
        assert!(telemetry.sync_p95_us <= telemetry.sync_max_us);
    }

}

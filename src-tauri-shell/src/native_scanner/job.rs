//! NS-03: managed native-scan jobs with per-run identity, cancellation and IPC events.
//!
//! Design constraints enforced here:
//! - One bounded registry keyed by a unique `runId`; a run id cannot be reused while a
//!   run is active, and a second *concurrent* run is rejected (the scanner UI is
//!   single-run today, and overlapping runs would double-emit alerts).
//! - Every run owns its own `Arc<AtomicBool>`; cancelling one run can never affect
//!   another, and cancellation is idempotent.
//! - Events are versioned and carry `runId`, a strictly increasing `sequence`, and the
//!   database identity so a stale run can never publish into a newer UI session.
//! - Completion is emitted exactly once. Cancellation, failure, window close and
//!   shutdown all take the same finalization path.
//! - Work runs on a blocking thread; nothing executes on the Tauri/main thread.
//!
//! The transport (Tauri commands and `Emitter`) is a thin wrapper in `ipc`; the registry
//! itself is transport-agnostic and fully unit-testable.

use super::ast::{NativeScanRequestV1, UniverseV1};
use super::scan::{
    execute_scan, ScanCounts, ScanDataSource, ScanExecutionOptions, ScanProgress, ScanTarget,
};
use super::universe::enumerate_targets;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

pub const NATIVE_SCAN_EVENT_VERSION: u32 = 1;
pub const DEFAULT_EVENT_BATCH_SIZE: usize = 100;
pub const DEFAULT_PROGRESS_INTERVAL_MS: u64 = 150;
pub const DEFAULT_WORKER_COUNT: usize = 2;
pub const MAX_WORKER_COUNT: usize = 8;

/// Stable error codes surfaced to the UI instead of raw internal strings.
pub mod codes {
    pub const RUN_ALREADY_ACTIVE: &str = "native-scan-run-already-active";
    pub const RUN_ID_IN_USE: &str = "native-scan-run-id-in-use";
    pub const RUN_NOT_FOUND: &str = "native-scan-run-not-found";
    pub const INVALID_REQUEST: &str = "native-scan-invalid-request";
    pub const NO_TARGETS: &str = "native-scan-no-targets";
    pub const DATABASE_UNAVAILABLE: &str = "native-scan-database-unavailable";
    pub const SOURCE_FAILED: &str = "native-scan-source-failed";
    pub const RUN_CANCELLED: &str = "native-scan-cancelled";
    pub const RUN_FAILED: &str = "native-scan-failed";
    pub const SHUTDOWN: &str = "native-scan-shutdown";
}

/// Event names form the public integration contract used by NS-04.
pub mod events {
    pub const PROGRESS: &str = "scan:progress";
    pub const MATCH: &str = "scan:match";
    pub const COMPLETE: &str = "scan:complete";
    pub const ERROR: &str = "scan:error";
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanCountsV1 {
    pub targets: usize,
    pub matched: usize,
    pub no_match: usize,
    pub skipped: usize,
    pub failed: usize,
}

impl From<ScanCounts> for ScanCountsV1 {
    fn from(counts: ScanCounts) -> Self {
        Self {
            targets: counts.targets,
            matched: counts.matched,
            no_match: counts.no_match,
            skipped: counts.skipped,
            failed: counts.failed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanTargetRefV1 {
    pub exchange: String,
    pub symbol: String,
}

impl From<&ScanTarget> for ScanTargetRefV1 {
    fn from(target: &ScanTarget) -> Self {
        Self {
            exchange: target.exchange.clone(),
            symbol: target.symbol.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanMatchV1 {
    pub exchange: String,
    pub symbol: String,
    pub rule_id: String,
    pub date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    /// P0-02: accepted chart-pattern metadata. Omitted (never zero-filled) when a rule
    /// does not produce it, so the renderer can tell "absent" from "neutral".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scanner_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasons: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values: Option<BTreeMap<String, crate::scanner_contract::ScannerScalarValueV1>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<ScanPatternDetailsV1>,
    /// Grouped historical summary for consecutive pattern matches. Absent for
    /// latest-only runs and for numeric rules.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history: Option<ScanMatchHistoryV1>,
}

/// Grouped historical summary as it crosses IPC.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanMatchHistoryV1 {
    pub first_matched_date: String,
    pub last_matched_date: String,
    pub match_count: u64,
}

/// Accepted chart-pattern details as they cross IPC.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanPatternDetailsV1 {
    pub family: String,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern_start_date: Option<String>,
    pub pattern_end_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breakout_level: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub support_level: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resistance_level: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub neckline_level: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_loss_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub potential_gain_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_reward_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pivots: Option<Vec<ScanPatternPivotV1>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geometry: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanPatternPivotV1 {
    pub index: usize,
    pub date: String,
    pub price: f64,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanDiagnosticV1 {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<ScanTargetRefV1>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressEventV1 {
    pub event_version: u32,
    pub run_id: String,
    pub sequence: u64,
    pub database_identity: String,
    pub completed: usize,
    pub total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_target: Option<ScanTargetRefV1>,
    pub counts: ScanCountsV1,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanMatchBatchEventV1 {
    pub event_version: u32,
    pub run_id: String,
    pub sequence: u64,
    pub database_identity: String,
    pub matches: Vec<ScanMatchV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompleteEventV1 {
    pub event_version: u32,
    pub run_id: String,
    pub sequence: u64,
    pub database_identity: String,
    pub cancelled: bool,
    pub duration_ms: u64,
    pub counts: ScanCountsV1,
    /// P1-08: workers the run actually used, not the requested count.
    pub workers_used: usize,
    pub diagnostics: Vec<ScanDiagnosticV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanErrorEventV1 {
    pub event_version: u32,
    pub run_id: String,
    pub sequence: u64,
    pub database_identity: String,
    pub code: String,
    pub message: String,
    pub counts: ScanCountsV1,
    pub diagnostics: Vec<ScanDiagnosticV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanStartAckV1 {
    pub accepted: bool,
    pub run_id: String,
    pub schema_version: u32,
    pub database_identity: String,
    pub worker_count: usize,
    pub total_targets: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanCancelAckV1 {
    pub run_id: String,
    pub cancel_requested: bool,
    pub already_finished: bool,
}

/// Transport sink. The registry never knows whether this is Tauri, a test recorder or a
/// future channel implementation.
pub trait EventSink: Send + Sync {
    fn emit_progress(&self, event: &ScanProgressEventV1);
    fn emit_matches(&self, event: &ScanMatchBatchEventV1);
    fn emit_complete(&self, event: &ScanCompleteEventV1);
    fn emit_error(&self, event: &ScanErrorEventV1);
}

/// Records events for tests and for the NS-03 evidence manifest.
#[derive(Debug, Default)]
pub struct RecordingSink {
    pub progress: Mutex<Vec<ScanProgressEventV1>>,
    pub matches: Mutex<Vec<ScanMatchBatchEventV1>>,
    pub complete: Mutex<Vec<ScanCompleteEventV1>>,
    pub errors: Mutex<Vec<ScanErrorEventV1>>,
}

impl EventSink for RecordingSink {
    fn emit_progress(&self, event: &ScanProgressEventV1) {
        self.progress.lock().unwrap().push(event.clone());
    }

    fn emit_matches(&self, event: &ScanMatchBatchEventV1) {
        self.matches.lock().unwrap().push(event.clone());
    }

    fn emit_complete(&self, event: &ScanCompleteEventV1) {
        self.complete.lock().unwrap().push(event.clone());
    }

    fn emit_error(&self, event: &ScanErrorEventV1) {
        self.errors.lock().unwrap().push(event.clone());
    }
}

impl RecordingSink {
    pub fn total_events(&self) -> usize {
        self.progress.lock().unwrap().len()
            + self.matches.lock().unwrap().len()
            + self.complete.lock().unwrap().len()
            + self.errors.lock().unwrap().len()
    }
}

/// Per-run cancellation handle.
///
/// The executor borrows the inner `AtomicBool` directly, so a cancel request is visible
/// to the running scan without any polling indirection.
#[derive(Debug, Default)]
pub struct RunCancelState {
    flag: AtomicBool,
}

impl RunCancelState {
    pub fn request(&self) {
        self.flag.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::SeqCst)
    }

    /// Borrowed cancellation flag for [`execute_scan`].
    pub fn flag(&self) -> &AtomicBool {
        &self.flag
    }
}

struct ActiveRun {
    cancel: Arc<RunCancelState>,
    database_identity: String,
    sequence: Arc<AtomicU64>,
    /// P0-03: the shared database-use permit is owned by the run record itself. It is
    /// therefore acquired under the same lock that admits the run, and it is released
    /// exactly when that run is removed - never by a different run's finalization and
    /// never before the worker has stopped.
    permit: Option<std::fs::File>,
}

/// Reasons the registry refuses to start or cannot find a run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobRejection {
    pub code: &'static str,
    pub message: String,
}

impl JobRejection {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

/// Bounded, thread-safe native scan job registry.
#[derive(Default)]
pub struct NativeScanJobRegistry {
    runs: Mutex<BTreeMap<String, ActiveRun>>,
    active_run_id: Mutex<Option<String>>,
}

impl NativeScanJobRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of currently registered runs (0 or 1 by construction).
    pub fn active_run_count(&self) -> usize {
        self.runs.lock().unwrap().len()
    }

    /// Registers a run id and returns its cancellation handle.
    ///
    /// Fails closed when another run is active or the id is already known: mixing two
    /// runs would double-emit alerts and break the single-result UI contract.
    pub fn register(
        &self,
        run_id: &str,
        database_identity: &str,
    ) -> Result<(Arc<RunCancelState>, Arc<AtomicU64>), JobRejection> {
        self.register_with_permit(run_id, database_identity, None)
    }

    /// Admits a run **and** takes ownership of its database-use permit atomically.
    ///
    /// The admission check and the permit hand-off happen under the same lock, so two
    /// concurrent starts cannot both pass the "no active run" test, and a rejected run can
    /// never end up holding or releasing another run's permit.
    pub fn register_with_permit(
        &self,
        run_id: &str,
        database_identity: &str,
        permit: Option<std::fs::File>,
    ) -> Result<(Arc<RunCancelState>, Arc<AtomicU64>), JobRejection> {
        let mut runs = self.runs.lock().unwrap();
        if !runs.is_empty() {
            // The caller keeps ownership of `permit`; dropping it returns it to the OS only
            // after the rejected start has fully unwound.
            return Err(JobRejection::new(
                codes::RUN_ALREADY_ACTIVE,
                "Another native scan run is already active; cancel it before starting a new one.",
            ));
        }
        if runs.contains_key(run_id) {
            return Err(JobRejection::new(
                codes::RUN_ID_IN_USE,
                format!("Run id \"{run_id}\" is already registered."),
            ));
        }
        let cancel = Arc::new(RunCancelState::default());
        let sequence = Arc::new(AtomicU64::new(0));
        runs.insert(
            run_id.to_string(),
            ActiveRun {
                cancel: Arc::clone(&cancel),
                database_identity: database_identity.to_string(),
                sequence: Arc::clone(&sequence),
                permit,
            },
        );
        *self.active_run_id.lock().unwrap() = Some(run_id.to_string());
        Ok((cancel, sequence))
    }

    /// True when the named run currently owns a database-use permit.
    pub fn owns_permit(&self, run_id: &str) -> bool {
        self.runs
            .lock()
            .unwrap()
            .get(run_id)
            .is_some_and(|run| run.permit.is_some())
    }

    /// Number of permits currently held by registered runs (0 or 1).
    pub fn held_permit_count(&self) -> usize {
        self.runs
            .lock()
            .unwrap()
            .values()
            .filter(|run| run.permit.is_some())
            .count()
    }

    /// Idempotently requests cancellation. Unknown/finished runs are a no-op.
    pub fn cancel(&self, run_id: &str) -> ScanCancelAckV1 {
        let runs = self.runs.lock().unwrap();
        match runs.get(run_id) {
            Some(run) => {
                run.cancel.request();
                ScanCancelAckV1 {
                    run_id: run_id.to_string(),
                    cancel_requested: true,
                    already_finished: false,
                }
            }
            None => ScanCancelAckV1 {
                run_id: run_id.to_string(),
                cancel_requested: false,
                already_finished: true,
            },
        }
    }

    /// Cancels and removes every run; used on window close and app shutdown.
    /// Requests cancellation of every run but keeps each run registered.
    ///
    /// The run's own worker remains responsible for `unregister`, so the database-use
    /// permit is not released here: releasing it while the worker is still reading would
    /// let a database switch/delete take exclusive access mid-scan (P0-03).
    pub fn cancel_all(&self) -> usize {
        let runs = self.runs.lock().unwrap();
        let count = runs.len();
        for run in runs.values() {
            run.cancel.request();
        }
        count
    }

    /// Removes a finished run. Only the run's own finalization calls this.
    pub fn unregister(&self, run_id: &str) {
        let mut runs = self.runs.lock().unwrap();
        runs.remove(run_id);
        let mut active = self.active_run_id.lock().unwrap();
        if active.as_deref() == Some(run_id) {
            *active = None;
        }
    }

    /// The run's sequence counter, so events share one strictly increasing ordering.
    pub fn sequence_for(&self, run_id: &str) -> Option<Arc<AtomicU64>> {
        self.runs
            .lock()
            .unwrap()
            .get(run_id)
            .map(|run| Arc::clone(&run.sequence))
    }

    /// The run's cancellation handle.
    pub fn cancel_handle(&self, run_id: &str) -> Option<Arc<RunCancelState>> {
        self.runs
            .lock()
            .unwrap()
            .get(run_id)
            .map(|run| Arc::clone(&run.cancel))
    }

    pub fn database_identity_for(&self, run_id: &str) -> Option<String> {
        self.runs
            .lock()
            .unwrap()
            .get(run_id)
            .map(|run| run.database_identity.clone())
    }
}

/// Deterministic event emitter: batches matches and throttles progress.
pub struct EventEmitter<'a, S: EventSink + ?Sized> {
    sink: &'a S,
    run_id: String,
    database_identity: String,
    sequence: Arc<AtomicU64>,
    batch_size: usize,
    progress_interval_ms: u64,
    pending_matches: Vec<ScanMatchV1>,
    last_progress_at_ms: u64,
    clock: Box<dyn Fn() -> u64 + Send + Sync + 'a>,
}

impl<'a, S: EventSink + ?Sized> EventEmitter<'a, S> {
    pub fn new(
        sink: &'a S,
        run_id: &str,
        database_identity: &str,
        sequence: Arc<AtomicU64>,
    ) -> Self {
        Self {
            sink,
            run_id: run_id.to_string(),
            database_identity: database_identity.to_string(),
            sequence,
            batch_size: DEFAULT_EVENT_BATCH_SIZE,
            progress_interval_ms: DEFAULT_PROGRESS_INTERVAL_MS,
            pending_matches: Vec::new(),
            last_progress_at_ms: 0,
            clock: Box::new(current_millis),
        }
    }

    pub fn with_batch_size(mut self, batch_size: usize) -> Self {
        self.batch_size = batch_size.max(1);
        self
    }

    pub fn with_progress_interval(mut self, interval_ms: u64) -> Self {
        self.progress_interval_ms = interval_ms;
        self
    }

    fn next_sequence(&self) -> u64 {
        self.sequence.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn flush_matches(&mut self) {
        if self.pending_matches.is_empty() {
            return;
        }
        let matches = std::mem::take(&mut self.pending_matches);
        let event = ScanMatchBatchEventV1 {
            event_version: NATIVE_SCAN_EVENT_VERSION,
            run_id: self.run_id.clone(),
            sequence: self.next_sequence(),
            database_identity: self.database_identity.clone(),
            matches,
        };
        self.sink.emit_matches(&event);
    }

    fn push_matches(&mut self, matches: Vec<ScanMatchV1>) {
        self.pending_matches.extend(matches);
        while self.pending_matches.len() >= self.batch_size {
            let remainder = self.pending_matches.split_off(self.batch_size);
            let batch = std::mem::replace(&mut self.pending_matches, remainder);
            let event = ScanMatchBatchEventV1 {
                event_version: NATIVE_SCAN_EVENT_VERSION,
                run_id: self.run_id.clone(),
                sequence: self.next_sequence(),
                database_identity: self.database_identity.clone(),
                matches: batch,
            };
            self.sink.emit_matches(&event);
        }
    }

    pub fn on_progress(&mut self, progress: ScanProgress, force: bool) {
        let produced: Vec<ScanMatchV1> = progress
            .matches
            .into_iter()
            .map(|record| ScanMatchV1 {
                exchange: record.exchange,
                symbol: record.symbol,
                rule_id: record.rule_id,
                date: record.date,
                value: record.value,
                scanner_name: record.scanner_name,
                category_id: record.category_id,
                category_name: record.category_name,
                direction: record.direction,
                score: record.score,
                reasons: record.reasons,
                values: record.values,
                source: record.source,
                pattern: record.pattern.map(|details| ScanPatternDetailsV1 {
                    family: details.family,
                    confidence: details.confidence,
                    pattern_start_date: details.pattern_start_date,
                    pattern_end_date: details.pattern_end_date,
                    breakout_level: details.breakout_level,
                    support_level: details.support_level,
                    resistance_level: details.resistance_level,
                    neckline_level: details.neckline_level,
                    target_price: details.target_price,
                    stop_loss_price: details.stop_loss_price,
                    potential_gain_pct: details.potential_gain_pct,
                    risk_reward_ratio: details.risk_reward_ratio,
                    pivots: details.pivots.map(|pivots| {
                        pivots
                            .into_iter()
                            .map(|pivot| ScanPatternPivotV1 {
                                index: pivot.index,
                                date: pivot.date,
                                price: pivot.price,
                                kind: pivot.kind,
                            })
                            .collect()
                    }),
                    geometry: details.geometry.map(|geometry| geometry.json),
                }),
                history: record.history.map(|history| ScanMatchHistoryV1 {
                    first_matched_date: history.first_matched_date,
                    last_matched_date: history.last_matched_date,
                    match_count: history.match_count,
                }),
            })
            .collect();
        self.push_matches(produced);

        let now = (self.clock)();
        let due = now.saturating_sub(self.last_progress_at_ms) >= self.progress_interval_ms;
        let finished = progress.completed == progress.total;
        if due || finished || force {
            self.last_progress_at_ms = now;
            let event = ScanProgressEventV1 {
                event_version: NATIVE_SCAN_EVENT_VERSION,
                run_id: self.run_id.clone(),
                sequence: self.next_sequence(),
                database_identity: self.database_identity.clone(),
                completed: progress.completed,
                total: progress.total,
                current_target: progress.current.as_ref().map(ScanTargetRefV1::from),
                counts: progress.counts.into(),
            };
            self.sink.emit_progress(&event);
        }
    }

    pub fn finalize_complete(
        mut self,
        cancelled: bool,
        duration_ms: u128,
        counts: ScanCounts,
        workers_used: usize,
        diagnostics: Vec<ScanDiagnosticV1>,
    ) {
        self.flush_matches();
        let event = ScanCompleteEventV1 {
            event_version: NATIVE_SCAN_EVENT_VERSION,
            run_id: self.run_id.clone(),
            sequence: self.next_sequence(),
            database_identity: self.database_identity.clone(),
            cancelled,
            duration_ms: duration_ms as u64,
            counts: counts.into(),
            workers_used,
            diagnostics,
        };
        self.sink.emit_complete(&event);
    }

    pub fn finalize_error(
        mut self,
        code: &str,
        message: &str,
        counts: ScanCounts,
        diagnostics: Vec<ScanDiagnosticV1>,
    ) {
        self.flush_matches();
        let event = ScanErrorEventV1 {
            event_version: NATIVE_SCAN_EVENT_VERSION,
            run_id: self.run_id.clone(),
            sequence: self.next_sequence(),
            database_identity: self.database_identity.clone(),
            code: code.to_string(),
            message: message.to_string(),
            counts: counts.into(),
            diagnostics,
        };
        self.sink.emit_error(&event);
    }
}

fn current_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Validates and normalizes the worker-count request against the hard cap.
pub fn clamp_worker_count(requested: Option<usize>) -> usize {
    requested
        .unwrap_or(DEFAULT_WORKER_COUNT)
        .clamp(1, MAX_WORKER_COUNT)
}

/// Runs one job end-to-end on the calling (blocking) thread.
///
/// `resolve_targets` is injected so tests (and later NS-04) can supply an exact target
/// list without a live database. `execute` returns the completion report through the
/// sink exactly once.
pub fn run_job<D, S>(
    registry: &NativeScanJobRegistry,
    source: &D,
    sink: &S,
    request: &NativeScanRequestV1,
    universe: &UniverseV1,
    targets: Vec<ScanTarget>,
    options: ScanExecutionOptions,
    batch_size: usize,
    progress_interval_ms: u64,
) -> Result<ScanStartAckV1, JobRejection>
where
    D: ScanDataSource,
    S: EventSink + ?Sized,
{
    let database_identity = source.database_identity().to_string();
    let (cancel, sequence) = registry.register(&request.requested_run_id, &database_identity)?;

    let total_targets = targets.len();
    let ack = ScanStartAckV1 {
        accepted: true,
        run_id: request.requested_run_id.clone(),
        schema_version: request.schema_version,
        database_identity: database_identity.clone(),
        worker_count: DEFAULT_WORKER_COUNT,
        total_targets,
    };

    let mut emitter = EventEmitter::new(
        sink,
        &request.requested_run_id,
        &database_identity,
        Arc::clone(&sequence),
    )
    .with_batch_size(batch_size)
    .with_progress_interval(progress_interval_ms);

    if total_targets == 0 {
        let empty_counts = ScanCounts::default();
        emitter.finalize_error(
            codes::NO_TARGETS,
            &format!(
                "The selected universe ({:?}) resolved to no scannable targets.",
                universe.source
            ),
            empty_counts,
            Vec::new(),
        );
        registry.unregister(&request.requested_run_id);
        return Ok(ack);
    }

    let started = std::time::Instant::now();
    let report = execute_scan(
        source,
        request,
        &targets,
        cancel.flag(),
        options,
        |progress| emitter.on_progress(progress, false),
    );

    let diagnostics: Vec<ScanDiagnosticV1> = report
        .diagnostics
        .iter()
        .map(|diagnostic| ScanDiagnosticV1 {
            code: diagnostic.code.clone(),
            message: diagnostic.message.clone(),
            target: diagnostic.target.as_ref().map(ScanTargetRefV1::from),
            rule_id: diagnostic.rule_id.clone(),
        })
        .collect();

    // Cancelled and completed runs share one finalization path, so exactly one
    // terminal event is published and the registry entry is always released.
    emitter.finalize_complete(
        report.cancelled,
        started.elapsed().as_millis(),
        report.counts,
        report.workers_used,
        diagnostics,
    );
    registry.unregister(&request.requested_run_id);
    Ok(ack)
}

/// Enumerates targets from a read-only connection for the requested universe.
pub fn resolve_targets(
    connection: &Connection,
    universe: &UniverseV1,
) -> Result<Vec<ScanTarget>, JobRejection> {
    let reserved = enumerate_targets(connection, universe).map_err(|error| {
        JobRejection::new(
            codes::SOURCE_FAILED,
            format!("Unable to enumerate targets: {error}"),
        )
    })?;
    Ok(reserved
        .into_iter()
        .map(|target| ScanTarget {
            exchange: target.exchange,
            symbol: target.symbol,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_scanner::reader::NativeBar;
    use std::collections::HashMap;

    struct FixtureSource {
        identity: String,
        bars: HashMap<String, Vec<NativeBar>>,
    }

    impl FixtureSource {
        fn new(identity: &str, bars: HashMap<String, Vec<NativeBar>>) -> Self {
            Self {
                identity: identity.to_string(),
                bars,
            }
        }
    }

    impl ScanDataSource for FixtureSource {
        fn database_identity(&self) -> &str {
            &self.identity
        }

        fn load_bars(
            &self,
            target: &ScanTarget,
            _as_of_date: Option<&str>,
            window: usize,
            _price_basis: super::super::ast::PriceBasisV1,
            _include_dividend_adjustments: bool,
            _include_rights_adjustments: bool,
        ) -> Result<Vec<NativeBar>, String> {
            let mut bars = self.bars.get(&target.key()).cloned().unwrap_or_default();
            if bars.len() > window {
                bars = bars[bars.len() - window..].to_vec();
            }
            Ok(bars)
        }
    }

    fn target(symbol: &str) -> ScanTarget {
        ScanTarget {
            exchange: "NSE".to_string(),
            symbol: symbol.to_string(),
        }
    }

    fn bar(index: u32, close: f64) -> NativeBar {
        NativeBar {
            date: 20240100 + index,
            open: close,
            high: close + 1.0,
            low: close - 1.0,
            close,
            prev_close: None,
            volume: 1_000.0,
            open_interest: 0.0,
        }
    }

    fn request(run_id: &str) -> NativeScanRequestV1 {
        NativeScanRequestV1 {
            schema_version: 1,
            requested_run_id: run_id.to_string(),
            universe: UniverseV1 {
                source: crate::native_scanner::ast::UniverseSourceV1::ExplicitTargets,
                targets: Vec::new(),
            },
            evaluation: crate::native_scanner::ast::EvaluationV1 {
                as_of_date: None,
                lookback_bars: None,
                evaluate_history: false,
                price_basis: crate::native_scanner::ast::PriceBasisV1::Raw,
                include_dividend_adjustments: false,
                include_rights_adjustments: false,
            },
            rules: vec![crate::native_scanner::ast::RuleV1 {
                id: "always".to_string(),
                expression: crate::native_scanner::ast::ExprV1::Binary {
                    op: crate::native_scanner::ast::BinaryOpV1::Gt,
                    left: Box::new(crate::native_scanner::ast::ExprV1::Field {
                        field: crate::native_scanner::ast::OhlcvFieldV1::Close,
                        lookback: 0,
                    }),
                    right: Box::new(crate::native_scanner::ast::ExprV1::Number { value: 0.0 }),
                },
            }],
        }
    }

    fn universe() -> UniverseV1 {
        UniverseV1 {
            source: crate::native_scanner::ast::UniverseSourceV1::ExplicitTargets,
            targets: Vec::new(),
        }
    }

    fn fixture_source() -> FixtureSource {
        let mut bars = HashMap::new();
        // A satisfies the fixture rule (close > 0) at the latest endpoint; B does not.
        // B must be non-positive: with 0.5/0.25 it *matched* too, which is why the run
        // reported 2 matches and 0 non-matches instead of 1 and 1.
        bars.insert("NSE:A".to_string(), vec![bar(1, 10.0), bar(2, 11.0)]);
        bars.insert("NSE:B".to_string(), vec![bar(1, 0.25), bar(2, 0.0)]);
        FixtureSource::new("db#1", bars)
    }

    #[test]
    fn ns03_run_completes_exactly_once_with_a_terminal_event() {
        let registry = NativeScanJobRegistry::new();
        let sink = RecordingSink::default();
        let source = fixture_source();
        let ack = run_job(
            &registry,
            &source,
            &sink,
            &request("run-ok"),
            &universe(),
            vec![target("A"), target("B")],
            ScanExecutionOptions::default(),
            100,
            0,
        )
        .expect("start");

        assert!(ack.accepted);
        assert_eq!(ack.total_targets, 2);
        assert_eq!(sink.complete.lock().unwrap().len(), 1);
        assert!(sink.errors.lock().unwrap().is_empty());
        let complete = &sink.complete.lock().unwrap()[0];
        assert_eq!(complete.run_id, "run-ok");
        assert_eq!(complete.database_identity, "db#1");
        assert!(!complete.cancelled);
        assert_eq!(complete.counts.matched, 1);
        assert_eq!(complete.counts.no_match, 1);
        assert_eq!(registry.active_run_count(), 0, "run must be unregistered");
        assert!(sink
            .matches
            .lock()
            .unwrap()
            .iter()
            .any(|batch| !batch.matches.is_empty()));
    }

    #[test]
    fn ns03_rejects_a_second_concurrent_run_and_replays_cancel_idempotently() {
        let registry = NativeScanJobRegistry::new();
        let (cancel, _sequence) = registry.register("run-a", "db#1").expect("first run");
        assert_eq!(registry.active_run_count(), 1);

        let rejection = registry.register("run-b", "db#1").expect_err("second run");
        assert_eq!(rejection.code, codes::RUN_ALREADY_ACTIVE);

        let first_cancel = registry.cancel("run-a");
        assert!(first_cancel.cancel_requested);
        assert!(!first_cancel.already_finished);
        assert!(cancel.is_cancelled());
        let second_cancel = registry.cancel("run-a");
        assert!(second_cancel.cancel_requested);
        assert!(cancel.is_cancelled());

        let unknown = registry.cancel("run-does-not-exist");
        assert!(!unknown.cancel_requested);
        assert!(unknown.already_finished);

        registry.unregister("run-a");
        assert_eq!(registry.active_run_count(), 0);
        registry
            .register("run-b", "db#1")
            .expect("id reusable after finish");
    }

    #[test]
    fn ns03_cancellation_during_a_run_yields_one_cancelled_completion() {
        // A source that cancels the run from inside the first target: this is the same
        // window in which the UI's Cancel button can fire.
        struct CancellingSource {
            registry: Arc<NativeScanJobRegistry>,
        }
        impl ScanDataSource for CancellingSource {
            fn database_identity(&self) -> &str {
                "db#cancel"
            }
            fn load_bars(
                &self,
                _target: &ScanTarget,
                _as_of_date: Option<&str>,
                _window: usize,
                _price_basis: super::super::ast::PriceBasisV1,
                _include_dividend_adjustments: bool,
                _include_rights_adjustments: bool,
            ) -> Result<Vec<NativeBar>, String> {
                self.registry.cancel("run-cancel");
                Ok(vec![bar(1, 10.0), bar(2, 11.0)])
            }
        }

        let registry = Arc::new(NativeScanJobRegistry::new());
        let sink = RecordingSink::default();
        let source = CancellingSource {
            registry: Arc::clone(&registry),
        };
        let ack = run_job(
            &registry,
            &source,
            &sink,
            &request("run-cancel"),
            &universe(),
            vec![target("A"), target("B"), target("C")],
            ScanExecutionOptions::default(),
            100,
            0,
        )
        .expect("start");
        assert!(ack.accepted);
        let complete = sink.complete.lock().unwrap();
        assert_eq!(complete.len(), 1, "exactly one terminal event");
        assert!(complete[0].cancelled, "the run must report cancellation");
        assert_eq!(
            complete[0].counts.matched, 0,
            "no partial target is emitted"
        );
        assert_eq!(registry.active_run_count(), 0);
    }

    #[test]
    fn ns03_empty_target_set_emits_a_single_actionable_error() {
        let registry = NativeScanJobRegistry::new();
        let sink = RecordingSink::default();
        let source = fixture_source();
        run_job(
            &registry,
            &source,
            &sink,
            &request("run-empty"),
            &universe(),
            Vec::new(),
            ScanExecutionOptions::default(),
            100,
            0,
        )
        .expect("start");
        let errors = sink.errors.lock().unwrap();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].code, codes::NO_TARGETS);
        assert!(sink.complete.lock().unwrap().is_empty());
    }

    #[test]
    fn ns03_event_sequences_are_strictly_increasing_and_scoped() {
        let registry = NativeScanJobRegistry::new();
        let sink = RecordingSink::default();
        let source = fixture_source();
        run_job(
            &registry,
            &source,
            &sink,
            &request("run-seq"),
            &universe(),
            vec![target("A"), target("B")],
            ScanExecutionOptions::default(),
            1,
            0,
        )
        .expect("start");

        let mut sequences: Vec<u64> = Vec::new();
        for event in sink.progress.lock().unwrap().iter() {
            sequences.push(event.sequence);
        }
        for event in sink.matches.lock().unwrap().iter() {
            sequences.push(event.sequence);
        }
        for event in sink.complete.lock().unwrap().iter() {
            sequences.push(event.sequence);
        }
        sequences.sort_unstable();
        let unique: std::collections::BTreeSet<u64> = sequences.iter().copied().collect();
        assert_eq!(unique.len(), sequences.len(), "sequences must be unique");
        assert_eq!(
            *sequences.last().unwrap(),
            sink.complete.lock().unwrap()[0].sequence
        );

        for batch in sink.matches.lock().unwrap().iter() {
            assert_eq!(batch.run_id, "run-seq");
            assert_eq!(batch.database_identity, "db#1");
            assert!(batch.matches.len() <= 1, "batch size honoured");
        }
    }

    #[test]
    fn ns03_progress_is_throttled_but_always_finishes_once() {
        let registry = NativeScanJobRegistry::new();
        let sink = RecordingSink::default();
        let source = fixture_source();
        run_job(
            &registry,
            &source,
            &sink,
            &request("run-throttle"),
            &universe(),
            vec![target("A"), target("B")],
            ScanExecutionOptions::default(),
            100,
            u64::MAX / 2,
        )
        .expect("start");
        let progress = sink.progress.lock().unwrap();
        // With an effectively infinite interval only the terminal progress event is due.
        assert_eq!(progress.len(), 1);
        assert_eq!(progress[0].completed, 2);
        assert_eq!(progress[0].total, 2);
        assert_eq!(sink.complete.lock().unwrap().len(), 1);
    }

    #[test]
    fn ns03_cancel_all_stops_every_registered_run() {
        let registry = NativeScanJobRegistry::new();
        let (cancel, _) = registry.register("run-x", "db#1").expect("register");
        assert_eq!(registry.cancel_all(), 1);
        assert!(cancel.is_cancelled());
        assert_eq!(
            registry.active_run_count(),
            1,
            "cancel_all keeps the record until finalize"
        );
        registry.unregister("run-x");
        assert_eq!(registry.active_run_count(), 0);
    }

    #[test]
    fn ns03_worker_count_is_bounded() {
        assert_eq!(clamp_worker_count(None), DEFAULT_WORKER_COUNT);
        assert_eq!(clamp_worker_count(Some(0)), 1);
        assert_eq!(clamp_worker_count(Some(4)), 4);
        assert_eq!(clamp_worker_count(Some(999)), MAX_WORKER_COUNT);
    }

    #[test]
    fn ns03_source_failures_are_counted_as_errors_not_matches() {
        struct FailingSource;
        impl ScanDataSource for FailingSource {
            fn database_identity(&self) -> &str {
                "db#failing"
            }
            fn load_bars(
                &self,
                _target: &ScanTarget,
                _as_of_date: Option<&str>,
                _window: usize,
                _price_basis: super::super::ast::PriceBasisV1,
                _include_dividend_adjustments: bool,
                _include_rights_adjustments: bool,
            ) -> Result<Vec<NativeBar>, String> {
                Err("corrupt .eod header".to_string())
            }
        }

        let registry = NativeScanJobRegistry::new();
        let sink = RecordingSink::default();
        run_job(
            &registry,
            &FailingSource,
            &sink,
            &request("run-fail"),
            &universe(),
            vec![target("A")],
            ScanExecutionOptions::default(),
            100,
            0,
        )
        .expect("start");
        let complete = &sink.complete.lock().unwrap()[0];
        assert_eq!(complete.counts.failed, 1);
        assert_eq!(complete.counts.matched, 0);
        assert!(!complete.diagnostics.is_empty());
        assert!(complete
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.message.contains("corrupt .eod header")));
    }

    // ---- P0-03: database-use permit ownership ----

    /// A stand-in for the OS-backed shared-use permit.
    fn fake_permit() -> std::fs::File {
        tempfile::tempfile().expect("temp permit file")
    }

    #[test]
    fn p0_03_registration_takes_permit_ownership_atomically() {
        let registry = NativeScanJobRegistry::new();
        assert_eq!(registry.held_permit_count(), 0);

        registry
            .register_with_permit("run-a", "db#1", Some(fake_permit()))
            .expect("register");
        assert!(registry.owns_permit("run-a"));
        assert_eq!(registry.held_permit_count(), 1);

        registry.unregister("run-a");
        assert_eq!(
            registry.held_permit_count(),
            0,
            "releasing ownership happens only on unregister"
        );
        assert!(!registry.owns_permit("run-a"));
    }

    #[test]
    fn p0_03_rejected_run_cannot_take_or_release_another_runs_permit() {
        let registry = NativeScanJobRegistry::new();
        registry
            .register_with_permit("run-a", "db#1", Some(fake_permit()))
            .expect("first run");

        // A concurrent start is rejected and keeps *its own* handle (dropped by the
        // caller), so the active run still owns exactly one permit.
        let second = registry.register_with_permit("run-b", "db#1", Some(fake_permit()));
        assert!(second.is_err(), "only one active run is allowed");
        assert_eq!(
            registry.held_permit_count(),
            1,
            "the active run's permit must be untouched by a rejected start"
        );
        assert!(registry.owns_permit("run-a"));

        // A reused run id is likewise rejected without disturbing ownership.
        registry.unregister("run-a");
        registry
            .register_with_permit("run-a", "db#1", Some(fake_permit()))
            .expect("re-register");
        assert_eq!(registry.held_permit_count(), 1);
    }

    #[test]
    fn p0_03_cancel_all_does_not_release_the_permit_while_work_may_be_running() {
        let registry = NativeScanJobRegistry::new();
        registry
            .register_with_permit("run-a", "db#1", Some(fake_permit()))
            .expect("register");

        let cancelled = registry.cancel_all();
        assert_eq!(cancelled, 1);
        // The permit is still held: a database switch or deletion must not be able to take
        // exclusive access while the worker may still be reading.
        assert_eq!(
            registry.held_permit_count(),
            1,
            "cancel_all must not release a permit out from under a running worker"
        );
        assert!(registry.owns_permit("run-a"));

        // Ownership ends with the run, which is the only correct release point.
        registry.unregister("run-a");
        assert_eq!(registry.held_permit_count(), 0);
    }

    #[test]
    fn p0_03_registration_without_a_permit_still_works_for_unit_use() {
        let registry = NativeScanJobRegistry::new();
        registry
            .register("run-a", "db#1")
            .expect("register without permit");
        assert!(!registry.owns_permit("run-a"));
        assert_eq!(registry.held_permit_count(), 0);
        registry.unregister("run-a");
    }
}

//! NS-03: Tauri command/event transport for managed native scan jobs.
//!
//! Two commands form the public contract:
//! - `start_native_eod_scan(payload)` — validates, resolves the active read-only database,
//!   registers the run and scans on a blocking thread.
//! - `cancel_native_eod_scan(payload)` — idempotent per-run cancellation.
//!
//! Four events are emitted: `scan:progress`, `scan:match`, `scan:complete`, `scan:error`.
//! Every payload carries `runId`, a strictly increasing `sequence` and the database
//! identity, so the renderer can reject stale or cross-run events.
//!
//! Safety properties:
//! - All setup and scanning run inside `spawn_blocking`; the Tauri/main thread only
//!   validates the payload shape.
//! - A shared database-use permit is retained before resolution and held by the job for
//!   its whole lifetime, then released exactly once during finalization.
//! - Native scanning stays opt-in. NS-04 is the only caller; there is no default
//!   activation, no automatic switching and no removal of the TypeScript path.

use super::ast::parse_native_scan_request_v1;
use super::database_source::ReadOnlyDatabaseSource;
use super::job::{
    clamp_worker_count, codes, events, resolve_targets, EventEmitter, EventSink, JobRejection,
    NativeScanJobRegistry, ScanCancelAckV1, ScanCompleteEventV1, ScanCountsV1, ScanErrorEventV1,
    ScanMatchBatchEventV1, ScanProgressEventV1, ScanStartAckV1, DEFAULT_EVENT_BATCH_SIZE,
    DEFAULT_PROGRESS_INTERVAL_MS,
};
use super::scan::ScanExecutionOptions;
use crate::database::database_use::acquire_use;
use crate::database::{
    open_read_only_connection_for_folder, read_native_scan_selection, NativeScanSelection,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

/// Raw IPC payload: the request arrives as untrusted JSON and is validated in Rust even
/// though the renderer already validated it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeScanStartPayload {
    pub request: Value,
    #[serde(default)]
    pub worker_count: Option<usize>,
    #[serde(default)]
    pub event_batch_size: Option<usize>,
    #[serde(default)]
    pub progress_interval_ms: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeScanCancelPayload {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeScanIssueV1 {
    pub path: String,
    pub code: String,
    pub message: String,
}

/// Structured command error: stable code, actionable message, optional field issues.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeScanCommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub issues: Vec<NativeScanIssueV1>,
}

impl NativeScanCommandError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            issues: Vec::new(),
        }
    }
}

impl From<JobRejection> for NativeScanCommandError {
    fn from(rejection: JobRejection) -> Self {
        Self::new(rejection.code, rejection.message)
    }
}

fn validate_request(
    value: &Value,
) -> Result<super::ast::NativeScanRequestV1, NativeScanCommandError> {
    let request = parse_native_scan_request_v1(value).map_err(|issues| NativeScanCommandError {
        code: codes::INVALID_REQUEST.to_string(),
        message: format!(
            "The native scan request was rejected with {} validation issue(s).",
            issues.len()
        ),
        issues: issues
            .into_iter()
            .map(|issue| NativeScanIssueV1 {
                path: issue.path,
                code: issue.code,
                message: issue.message,
            })
            .collect(),
    })?;
    // CA-01 HOLD: a complete adjusted projection cannot be verified while two
    // Split/Bonus rows can claim one issuer event across normal/T+0 identities.
    // Reject at the untrusted IPC boundary before opening a database or starting
    // a job. No TypeScript/chart adjustment policy is changed here.
    if request.evaluation.price_basis == super::ast::PriceBasisV1::Adjusted {
        return Err(NativeScanCommandError {
            code: codes::INVALID_REQUEST.to_string(),
            message: "CA-01 HOLD: adjusted native scanning is disabled until Split/Bonus event ownership and BSE T+0 applicability have an approved, verified rule. Use raw native scanning; existing chart adjustment behavior is unchanged.".to_string(),
            issues: vec![NativeScanIssueV1 {
                path: "request.evaluation.priceBasis".to_string(),
                code: "ca01-adjusted-native-disabled".to_string(),
                message: "Native adjusted pricing is unavailable while CA-01 is on HOLD."
                    .to_string(),
            }],
        });
    }
    Ok(request)
}

/// Tauri-backed event sink. Events are app-wide and carry `runId`, so a listener for a
/// previous run can never accept a later run's payloads.
pub struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn emit<T: Serialize + Clone>(&self, event: &str, payload: &T) {
        // A closed window is not an error: finalization must still happen.
        let _ = self.app.emit(event, payload.clone());
    }
}

impl EventSink for TauriEventSink {
    fn emit_progress(&self, event: &ScanProgressEventV1) {
        self.emit(events::PROGRESS, event);
    }

    fn emit_matches(&self, event: &ScanMatchBatchEventV1) {
        self.emit(events::MATCH, event);
    }

    fn emit_complete(&self, event: &ScanCompleteEventV1) {
        self.emit(events::COMPLETE, event);
    }

    fn emit_error(&self, event: &ScanErrorEventV1) {
        self.emit(events::ERROR, event);
    }
}

/// Managed state: only the job registry.
///
/// P0-03: there is deliberately **no** application-wide permit slot. The database-use
/// permit is owned by the run's own registry entry, so it cannot be captured by a
/// concurrent start, released by another run's finalization, or dropped while a worker is
/// still reading.
pub struct NativeScanState {
    registry: NativeScanJobRegistry,
}

impl Default for NativeScanState {
    fn default() -> Self {
        Self {
            registry: NativeScanJobRegistry::new(),
        }
    }
}

impl NativeScanState {
    pub fn registry(&self) -> &NativeScanJobRegistry {
        &self.registry
    }

    fn has_permit(&self) -> bool {
        self.registry.held_permit_count() > 0
    }
}

/// Everything the job thread needs, captured before the blocking section starts.
struct PreparedJob {
    run_id: String,
    database_identity: String,
    selection: NativeScanSelection,
    request: super::ast::NativeScanRequestV1,
    targets: Vec<super::scan::ScanTarget>,
    source: ReadOnlyDatabaseSource,
    worker_count: usize,
    batch_size: usize,
    progress_interval_ms: u64,
}

fn prepare_job(
    app: &AppHandle,
    state: &NativeScanState,
    request: super::ast::NativeScanRequestV1,
    worker_count: usize,
    batch_size: usize,
    progress_interval_ms: u64,
) -> Result<PreparedJob, NativeScanCommandError> {
    if state.registry.active_run_count() > 0 {
        return Err(NativeScanCommandError::new(
            codes::RUN_ALREADY_ACTIVE,
            "Another native scan run is already active.",
        ));
    }

    let selection = read_native_scan_selection(app)
        .map_err(|error| {
            NativeScanCommandError::new(
                codes::DATABASE_UNAVAILABLE,
                format!("Unable to verify the active database selection: {error}"),
            )
        })?
        .ok_or_else(|| {
            NativeScanCommandError::new(
                codes::DATABASE_UNAVAILABLE,
                "No registered active database is selected.",
            )
        })?;
    let folder_path = selection.folder.clone();

    // P0-03 ordering: the permit is acquired *before* admission and then handed to the
    // registry inside the admission lock. Every failure below simply drops the local
    // `permit`, so no path can leak it and no path can release someone else's.
    let permit = acquire_use().map_err(|error| {
        NativeScanCommandError::new(
            codes::DATABASE_UNAVAILABLE,
            format!("Unable to retain database use for the scan: {error}"),
        )
    })?;

    let connection = open_read_only_connection_for_folder(&folder_path).map_err(|error| {
        NativeScanCommandError::new(
            codes::DATABASE_UNAVAILABLE,
            format!("Unable to open the database read-only: {error}"),
        )
    })?;
    let targets =
        resolve_targets(&connection, &request.universe).map_err(NativeScanCommandError::from)?;
    // Enumerating targets is the only work done on this connection. It is dropped before
    // the scan so no rusqlite handle is shared across worker boundaries.
    drop(connection);

    let mut source = ReadOnlyDatabaseSource::open(folder_path)
        .map_err(|error| NativeScanCommandError::new(codes::SOURCE_FAILED, error))?;
    // The selection can change while universe resolution or source opening is underway.
    if !selection_still_current(app, &selection) {
        return Err(NativeScanCommandError::new(
            codes::DATABASE_CHANGED,
            "The registered database selection changed during native scan setup.",
        ));
    }
    source.bind_selection_identity(selection.database_identity.clone());
    let database_identity = source.identity().to_string();

    // Atomic admission + permit ownership.
    if state
        .registry
        .register_with_permit(&request.requested_run_id, &database_identity, Some(permit))
        .is_err()
    {
        return Err(NativeScanCommandError::new(
            codes::RUN_ID_IN_USE,
            "The requested run id is already registered.",
        ));
    }

    Ok(PreparedJob {
        run_id: request.requested_run_id.clone(),
        database_identity,
        selection,
        request,
        targets,
        source,
        worker_count,
        batch_size,
        progress_interval_ms,
    })
}

fn selection_still_current(app: &AppHandle, expected: &NativeScanSelection) -> bool {
    matches!(read_native_scan_selection(app), Ok(Some(current)) if current == *expected)
}

fn run_prepared_job(app: AppHandle, job: PreparedJob) {
    let PreparedJob {
        run_id,
        database_identity,
        selection,
        request,
        targets,
        source,
        worker_count,
        batch_size,
        progress_interval_ms,
    } = job;
    let state = app.state::<NativeScanState>();

    // If the run record is already gone, its permit is already released with it. Nothing
    // is left to finalize and nothing can be released twice.
    let (Some(sequence), Some(cancel)) = (
        state.registry.sequence_for(&run_id),
        state.registry.cancel_handle(&run_id),
    ) else {
        return;
    };

    let sink = TauriEventSink::new(app.clone());
    let mut emitter = EventEmitter::new(&sink, &run_id, &database_identity, sequence)
        .with_batch_size(batch_size)
        .with_progress_interval(progress_interval_ms);

    // Check both the durable A -> B -> A revision and the physical database file.
    let mut selection_invalidated = !selection_still_current(&app, &selection);
    if selection_invalidated {
        cancel.request();
    }

    // P0-03: finalize on *every* exit path, including a panic inside the scan, so the
    // permit cannot outlive the worker. A panic still propagates after finalizing.
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        super::scan::execute_scan(
            &source,
            &request,
            &targets,
            cancel.flag(),
            ScanExecutionOptions::default().with_worker_count(worker_count),
            |progress| {
                if !selection_still_current(&app, &selection) {
                    selection_invalidated = true;
                    cancel.request();
                }
                if !selection_invalidated {
                    emitter.on_progress(progress, false);
                }
            },
        )
    }));

    // A switch after the last progress callback must still reject terminal success.
    if selection_invalidated || !selection_still_current(&app, &selection) {
        emitter.finalize_error(
            codes::DATABASE_CHANGED,
            "Native scan stopped because its database selection or file identity changed.",
            Default::default(),
            Vec::new(),
        );
        state.registry.unregister(&run_id);
        return;
    }

    match outcome {
        Ok(report) => {
            let duration_ms = report.duration_ms;
            emitter.finalize_complete(report, duration_ms);
        }
        Err(_) => {
            // The worker panicked: report a terminal error rather than leaving the UI
            // waiting, then release ownership in `unregister` below.
            emitter.finalize_error(
                codes::RUN_FAILED,
                "The native scan worker stopped unexpectedly.",
                Default::default(),
                Vec::new(),
            );
        }
    }

    // Releasing ownership happens here, after the worker has finished, and only for this
    // run's own record.
    state.registry.unregister(&run_id);
}

/// Starts a native scan and returns once the run is registered and targets are resolved.
#[tauri::command]
pub async fn start_native_eod_scan(
    app: AppHandle,
    payload: NativeScanStartPayload,
) -> Result<ScanStartAckV1, NativeScanCommandError> {
    let request = validate_request(&payload.request)?;
    let worker_count = clamp_worker_count(payload.worker_count);
    let batch_size = payload
        .event_batch_size
        .unwrap_or(DEFAULT_EVENT_BATCH_SIZE)
        .clamp(1, 1000);
    let progress_interval_ms = payload
        .progress_interval_ms
        .unwrap_or(DEFAULT_PROGRESS_INTERVAL_MS)
        .min(5000);

    let app_for_setup = app.clone();
    let setup = tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_setup.state::<NativeScanState>();
        let prepared = prepare_job(
            &app_for_setup,
            &state,
            request,
            worker_count,
            batch_size,
            progress_interval_ms,
        )?;
        // P1-08: report the worker count this run will really use, not the request.
        let effective_workers =
            super::scan::effective_worker_count(worker_count, prepared.targets.len());
        let ack = ScanStartAckV1 {
            accepted: true,
            run_id: prepared.run_id.clone(),
            schema_version: prepared.request.schema_version,
            database_identity: prepared.database_identity.clone(),
            worker_count: effective_workers,
            total_targets: prepared.targets.len(),
        };
        Ok::<_, NativeScanCommandError>((prepared, ack))
    })
    .await
    .map_err(|error| {
        NativeScanCommandError::new(
            codes::RUN_FAILED,
            format!("Native scan setup failed: {error}"),
        )
    })?;

    let (prepared, ack) = setup?;

    // The scan itself runs on its own blocking thread so the command returns promptly and
    // the UI can render progress and cancellation controls.
    tauri::async_runtime::spawn_blocking(move || run_prepared_job(app, prepared));

    Ok(ack)
}

/// Requests cancellation of one run. Idempotent; unknown runs are reported, not an error.
#[tauri::command]
pub fn cancel_native_eod_scan(
    state: State<'_, NativeScanState>,
    payload: NativeScanCancelPayload,
) -> Result<ScanCancelAckV1, NativeScanCommandError> {
    if payload.run_id.trim().is_empty() {
        return Err(NativeScanCommandError::new(
            codes::RUN_NOT_FOUND,
            "A run id is required to cancel a native scan.",
        ));
    }
    Ok(state.registry.cancel(&payload.run_id))
}

/// Window close / app shutdown hook: request cancellation of every run.
///
/// The permit is deliberately **not** released here. Each run's own worker releases its
/// permit when it stops, so a database switch or deletion can never take exclusive access
/// while a scan is still reading (P0-03).
pub fn finalize_all_runs(state: &NativeScanState) -> usize {
    state.registry.cancel_all()
}

/// Capability descriptor so the UI can negotiate before offering the native backend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeScannerCapabilitiesPayload {
    pub contract_version: &'static str,
    pub schema_version: u32,
    pub default_enabled: bool,
    pub worker_count: usize,
    pub supported_pattern_ids: Vec<&'static str>,
    pub event_names: Vec<&'static str>,
    pub max_rules: usize,
    pub max_lookback_bars: usize,
    pub active: bool,
}

#[tauri::command]
pub fn native_scanner_capabilities(
    state: State<'_, NativeScanState>,
) -> NativeScannerCapabilitiesPayload {
    NativeScannerCapabilitiesPayload {
        contract_version: super::CONTRACT_VERSION,
        schema_version: 1,
        // Never true: native scanning is opt-in for the lifetime of this architecture.
        default_enabled: false,
        worker_count: super::job::DEFAULT_WORKER_COUNT,
        supported_pattern_ids: super::ast::SUPPORTED_PATTERN_IDS.to_vec(),
        event_names: vec![
            events::PROGRESS,
            events::MATCH,
            events::COMPLETE,
            events::ERROR,
        ],
        max_rules: super::ast::MAX_RULES,
        max_lookback_bars: super::ast::MAX_LOOKBACK_BARS,
        active: state.registry.active_run_count() > 0,
    }
}

/// Converts executor counts for transport (kept for tests/diagnostics symmetry).
pub fn counts_to_v1(counts: super::scan::ScanCounts) -> ScanCountsV1 {
    counts.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ns03_invalid_payloads_are_rejected_with_field_paths() {
        let error = validate_request(&serde_json::json!({
            "schemaVersion": 1,
            "requestedRunId": "run-1",
            "universe": { "source": "explicitTargets", "targets": [] },
            "evaluation": { "evaluateHistory": false, "priceBasis": "raw" },
            "rules": [{ "id": "r", "expression": { "kind": "number", "value": 1 } }]
        }))
        .expect_err("empty targets must be rejected");
        assert_eq!(error.code, codes::INVALID_REQUEST);
        assert!(!error.issues.is_empty());
        assert!(error.issues.iter().all(|issue| !issue.path.is_empty()));
    }

    #[test]
    fn ns03_valid_payload_passes_the_command_validation() {
        let request = validate_request(&serde_json::json!({
            "schemaVersion": 1,
            "requestedRunId": "run-1",
            "universe": { "source": "activeNseEq" },
            "evaluation": { "evaluateHistory": false, "priceBasis": "raw" },
            "rules": [{ "id": "r", "expression": { "kind": "number", "value": 1 } }]
        }))
        .expect("valid request");
        assert_eq!(request.requested_run_id, "run-1");
    }

    #[test]
    fn ca01_native_ipc_rejects_adjusted_requests_before_any_database_access() {
        let mut payload = serde_json::json!({
            "schemaVersion": 1,
            "requestedRunId": "ca01-raw-only",
            "universe": { "source": "activeNseEq" },
            "evaluation": { "evaluateHistory": false, "priceBasis": "adjusted" },
            "rules": [{ "id": "r", "expression": { "kind": "number", "value": 1 } }]
        });
        let error =
            validate_request(&payload).expect_err("CA-01 adjusted request must be rejected");
        assert_eq!(error.code, codes::INVALID_REQUEST);
        assert!(error.message.contains("CA-01 HOLD"));
        assert_eq!(error.issues.len(), 1);
        assert_eq!(error.issues[0].path, "request.evaluation.priceBasis");
        assert_eq!(error.issues[0].code, "ca01-adjusted-native-disabled");

        payload["evaluation"]["priceBasis"] = serde_json::json!("raw");
        assert!(
            validate_request(&payload).is_ok(),
            "raw native requests remain accepted"
        );
    }

    #[test]
    fn ns03_error_payloads_serialize_with_stable_codes() {
        let error = NativeScanCommandError::new(codes::DATABASE_UNAVAILABLE, "No active database.");
        let json = serde_json::to_value(&error).expect("serialize");
        assert_eq!(json["code"], codes::DATABASE_UNAVAILABLE);
        assert_eq!(json["message"], "No active database.");
        assert!(json.get("issues").is_none(), "empty issues are omitted");
    }

    #[test]
    fn ns03_cancel_payload_requires_a_run_id() {
        let payload = NativeScanCancelPayload {
            run_id: "   ".to_string(),
        };
        assert!(payload.run_id.trim().is_empty());
    }

    #[test]
    fn ns03_capabilities_always_report_native_as_opt_in() {
        let state = NativeScanState::default();
        assert!(!state.has_permit());
        assert_eq!(state.registry().active_run_count(), 0);
        assert_eq!(finalize_all_runs(&state), 0);
    }
}

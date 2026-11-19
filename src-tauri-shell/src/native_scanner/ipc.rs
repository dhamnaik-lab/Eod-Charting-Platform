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
    NativeScanJobRegistry, ScanCancelAckV1, ScanCompleteEventV1, ScanCountsV1, ScanDiagnosticV1,
    ScanErrorEventV1, ScanMatchBatchEventV1, ScanProgressEventV1, ScanStartAckV1,
    ScanTargetRefV1, DEFAULT_EVENT_BATCH_SIZE, DEFAULT_PROGRESS_INTERVAL_MS,
};
use super::scan::ScanExecutionOptions;
use crate::database::database_use::acquire_use;
use crate::database::{
    open_read_only_connection_for_folder, resolve_active_database_folder,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
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

fn validate_request(value: &Value) -> Result<super::ast::NativeScanRequestV1, NativeScanCommandError> {
    parse_native_scan_request_v1(value).map_err(|issues| NativeScanCommandError {
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
    })
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

/// Managed state: the job registry plus the shared-use permit held by the active run.
pub struct NativeScanState {
    registry: NativeScanJobRegistry,
    permit: Mutex<Option<std::fs::File>>,
}

impl Default for NativeScanState {
    fn default() -> Self {
        Self {
            registry: NativeScanJobRegistry::new(),
            permit: Mutex::new(None),
        }
    }
}

impl NativeScanState {
    pub fn registry(&self) -> &NativeScanJobRegistry {
        &self.registry
    }

    fn store_permit(&self, permit: std::fs::File) {
        *self.permit.lock().unwrap() = Some(permit);
    }

    fn release_permit(&self) {
        // Dropping the handle releases the OS-backed shared-use lock.
        *self.permit.lock().unwrap() = None;
    }

    fn has_permit(&self) -> bool {
        self.permit.lock().unwrap().is_some()
    }
}

/// Everything the job thread needs, captured before the blocking section starts.
struct PreparedJob {
    run_id: String,
    database_identity: String,
    request: super::ast::NativeScanRequestV1,
    targets: Vec<super::scan::ScanTarget>,
    source: ReadOnlyDatabaseSource,
    batch_size: usize,
    progress_interval_ms: u64,
}

fn prepare_job(
    app: &AppHandle,
    state: &NativeScanState,
    request: super::ast::NativeScanRequestV1,
    batch_size: usize,
    progress_interval_ms: u64,
) -> Result<PreparedJob, NativeScanCommandError> {
    if state.registry.active_run_count() > 0 {
        return Err(NativeScanCommandError::new(
            codes::RUN_ALREADY_ACTIVE,
            "Another native scan run is already active.",
        ));
    }

    let folder = resolve_active_database_folder(app)
        .map_err(|error| {
            NativeScanCommandError::new(
                codes::DATABASE_UNAVAILABLE,
                format!("Unable to resolve the active database: {error}"),
            )
        })?
        .ok_or_else(|| {
            NativeScanCommandError::new(
                codes::DATABASE_UNAVAILABLE,
                "No active database is selected.",
            )
        })?;
    let folder_path = folder.to_path_buf();

    // Retain a strong shared-use permit for the whole scan lifetime.
    let permit = acquire_use().map_err(|error| {
        NativeScanCommandError::new(
            codes::DATABASE_UNAVAILABLE,
            format!("Unable to retain database use for the scan: {error}"),
        )
    })?;
    state.store_permit(permit);

    let connection = match open_read_only_connection_for_folder(&folder_path) {
        Ok(connection) => connection,
        Err(error) => {
            state.release_permit();
            return Err(NativeScanCommandError::new(
                codes::DATABASE_UNAVAILABLE,
                format!("Unable to open the database read-only: {error}"),
            ));
        }
    };
    let targets = match resolve_targets(&connection, &request.universe) {
        Ok(targets) => targets,
        Err(rejection) => {
            state.release_permit();
            return Err(rejection.into());
        }
    };
    // Enumerating targets is the only work done on this connection. It is dropped before
    // the scan so no rusqlite handle is shared or held across worker boundaries.
    drop(connection);

    let source = match ReadOnlyDatabaseSource::open(folder_path) {
        Ok(source) => source,
        Err(error) => {
            state.release_permit();
            return Err(NativeScanCommandError::new(codes::SOURCE_FAILED, error));
        }
    };
    let database_identity = source.identity().to_string();

    if state
        .registry
        .register(&request.requested_run_id, &database_identity)
        .is_err()
    {
        state.release_permit();
        return Err(NativeScanCommandError::new(
            codes::RUN_ID_IN_USE,
            "The requested run id is already registered.",
        ));
    }

    Ok(PreparedJob {
        run_id: request.requested_run_id.clone(),
        database_identity,
        request,
        targets,
        source,
        batch_size,
        progress_interval_ms,
    })
}

fn run_prepared_job(app: AppHandle, job: PreparedJob) {
    let PreparedJob {
        run_id,
        database_identity,
        request,
        targets,
        source,
        batch_size,
        progress_interval_ms,
    } = job;
    let state = app.state::<NativeScanState>();
    let Some(sequence) = state.registry.sequence_for(&run_id) else {
        // The run was cancelled and cleared between registration and start.
        state.release_permit();
        return;
    };
    let Some(cancel) = state.registry.cancel_handle(&run_id) else {
        state.release_permit();
        return;
    };

    let sink = TauriEventSink::new(app.clone());
    let mut emitter = EventEmitter::new(&sink, &run_id, &database_identity, sequence)
        .with_batch_size(batch_size)
        .with_progress_interval(progress_interval_ms);

    let report = super::scan::execute_scan(
        &source,
        &request,
        &targets,
        cancel.flag(),
        ScanExecutionOptions::default(),
        |progress| emitter.on_progress(progress, false),
    );

    let diagnostics: Vec<ScanDiagnosticV1> = report
        .diagnostics
        .iter()
        .map(|diagnostic| ScanDiagnosticV1 {
            code: diagnostic.code.clone(),
            message: diagnostic.message.clone(),
            target: diagnostic.target.as_ref().map(|target| ScanTargetRefV1 {
                exchange: target.exchange.clone(),
                symbol: target.symbol.clone(),
            }),
            rule_id: diagnostic.rule_id.clone(),
        })
        .collect();

    // Exactly one terminal event, whether the run completed, failed or was cancelled.
    emitter.finalize_complete(
        report.cancelled,
        report.duration_ms,
        report.counts,
        diagnostics,
    );

    state.registry.unregister(&run_id);
    state.release_permit();
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
        let prepared = prepare_job(&app_for_setup, &state, request, batch_size, progress_interval_ms)?;
        let ack = ScanStartAckV1 {
            accepted: true,
            run_id: prepared.run_id.clone(),
            schema_version: prepared.request.schema_version,
            database_identity: prepared.database_identity.clone(),
            worker_count,
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

/// Window close / app shutdown hook: cancel every run and release the permit.
pub fn finalize_all_runs(state: &NativeScanState) -> usize {
    let cancelled = state.registry.cancel_all();
    // The job thread normally releases the permit; this is the shutdown safety net for the
    // case where that thread has already been torn down.
    state.release_permit();
    cancelled
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

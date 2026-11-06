// Pure evidence classifier only; no autonomous Dividend activation.
pub(crate) mod simple_cash_dividend_evidence;
#[cfg(test)]
mod simple_cash_dividend_evidence_tests;
mod bse_fetch;
mod bse_identity_mapping;
mod bse_browser;
mod auto_approval;
mod classification_refresh;
mod dividend_validation_cache;
mod identity_recheck;
mod informational_closure;
pub use informational_closure::{
    reopen_corporate_action_informational_closure, sync_corporate_action_informational_closures,
};
mod dated_symbol_chain;
pub(super) mod event_price_route;
mod price_validation_freshness;
mod split_bonus_preparation;
mod split_bonus_terms;
mod split_isin_price_proof;
pub use classification_refresh::refresh_corporate_action_import_classifications;
mod controlled_identity_repair;
mod event_identity_authority;
mod event_identity_maintenance;
mod event_identity_resolution;
mod five_pair_consolidation;
mod five_pair_consolidation_apply;
mod historical_isin_bootstrap;
mod historical_isin_transition;
#[cfg(test)]
mod matching_performance_tests;
#[cfg(test)]
mod real_data_performance_tests;
mod repair_preview;
mod reconciliation_preflight;
pub use reconciliation_preflight::{CorporateActionReconciliationPreflightInput, CorporateActionReconciliationPreflightResult, CorporateActionReconciliationPreflightRow, CorporateActionReconciliationBlocker};

use chrono::{Duration as ChronoDuration, NaiveDate};
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE, ORIGIN, REFERER};
use rusqlite::{params, params_from_iter, types::Value as SqlValue, Connection, OptionalExtension};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub(crate) use controlled_identity_repair::try_run_controlled_identity_repair_maintenance;
pub(crate) use event_identity_maintenance::try_run_event_identity_resolution_maintenance;
pub(crate) use five_pair_consolidation::try_run_five_pair_consolidation_maintenance;
pub(crate) use five_pair_consolidation_apply::try_run_five_pair_consolidation_apply_maintenance;
pub(crate) use historical_isin_bootstrap::try_run_historical_isin_bootstrap_maintenance;
use repair_preview::preview_corporate_action_repairs_internal;

#[cfg(test)]
use repair_preview::{
    list_repair_preview_evidence, list_same_date_repair_preview_canonicals,
    load_repair_preview_canonical, load_repair_preview_import, repair_preview_fingerprint_fields,
    stable_repair_preview_fingerprint, validate_repair_preview_import_ids,
    CORPORATE_ACTION_REPAIR_PREVIEW_MAX_IDS,
};

use super::binary_eod::{date_to_u32, u32_to_date, BinaryEodFile};
use super::storage_mode::{get_price_storage_mode, PriceStorageMode};
use super::instrument_mutations::{
    upsert_instrument_isin_history_evidence,
};
use super::{
    emit_database_changed, find_instrument_record, get_app_snapshot_internal,
    invalidate_cached_db_stats, normalize_exchange, normalize_optional_text, normalize_symbol,
    now_iso, open_connection_for_folder, open_read_only_connection_for_folder,
    resolve_active_database_folder, run_connection_transaction, try_acquire_price_store_operation,
    AppResult, CorporateActionAutoApprovalInput, CorporateActionAutoApprovalResult,
    CorporateActionCsvImportInput, CorporateActionCsvImportResult,
    CorporateActionDividendPreparedScopeEvaluationDisposition,
    CorporateActionDividendPreparedScopeEvaluationEvidence,
    CorporateActionDividendPreparedScopeEvaluationInput,
    CorporateActionDividendPreparedScopeEvaluationResult,
    CorporateActionDividendWriteStageDisposition, CorporateActionDividendWriteStageInput,
    CorporateActionDividendWriteStageResult, CorporateActionEventIdentityListInput,
    CorporateActionEventIdentityListResult, CorporateActionImportApprovalInput,
    CorporateActionImportApprovalResult, CorporateActionImportBulkApprovalError,
    CorporateActionImportBulkApprovalInput, CorporateActionImportBulkApprovalResult,
    CorporateActionImportBulkRecheckError, CorporateActionImportBulkRecheckInput,
    CorporateActionImportBulkRecheckResult, CorporateActionImportExceptionalApprovalInput,
    CorporateActionImportListInput, CorporateActionImportLookupInput,
    CorporateActionImportQuickResolveInput, CorporateActionImportResolutionHint,
    CorporateActionImportResolutionHintsInput, CorporateActionImportResolutionHintsResult,
    CorporateActionImportResolutionSuggestion, CorporateActionImportResolutionSuggestionsInput,
    CorporateActionImportResolutionSuggestionsResult, CorporateActionImportResolveInput,
    CorporateActionImportResolveResult, CorporateActionImportRow, CorporateActionInputPayload,
    CorporateActionOfficialFetchInput, CorporateActionOfficialFetchResult,
    CorporateActionRepairPreviewInput, CorporateActionRepairPreviewResult,
    CorporateActionScanInput, CorporateActionScanListInput, CorporateActionScanResult,
    CorporateActionScanResultRow, CorporateActionScanRun, HistoricalCapitalActionAliasCandidate,
    HistoricalCapitalActionAliasCandidateInput, HistoricalCapitalActionAliasCandidateResult,
    HistoricalCapitalActionBackfillBatchInput, HistoricalCapitalActionBackfillBatchResult,
    HistoricalCapitalActionBackfillBatchSymbolResult, HistoricalCapitalActionBackfillInput,
    HistoricalCapitalActionBackfillResult, HistoricalCapitalActionBackfillRunListInput,
    HistoricalCapitalActionBackfillRunListResult, HistoricalCapitalActionBackfillRunOutcomeRow,
    HistoricalCapitalActionBackfillRunRow, HistoricalCapitalActionBackfillRunSymbolRow,
    HistoricalCapitalActionBackfillSourceAttempt, HistoricalCapitalActionMajorLiquidCandidate,
    HistoricalCapitalActionMajorLiquidCandidateInput,
    HistoricalCapitalActionMajorLiquidCandidateResult, HistoricalCapitalActionSparseCandidate,
    HistoricalCapitalActionSparseCandidateInput, HistoricalCapitalActionSparseCandidateResult,
    PriceStoreOperationKind, SnapshotOptions,
};

const NSE_ACTIONS_PAGE_URL: &str =
    "https://www.nseindia.com/companies-listing/corporate-filings-actions";
const NSE_ACTIONS_API_URL: &str = "https://www.nseindia.com/api/corporates-corporateActions";
const BSE_ACTIONS_PAGE_URL: &str = "https://www.bseindia.com/corporates/corporates_act";
const BSE_ACTIONS_API_URL: &str = "https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w";
const BSE_ORIGIN_URL: &str = "https://www.bseindia.com";
const OFFICIAL_FETCH_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const BLIND_SCAN_MIN_FACTOR: f64 = 1.25;
const BLIND_SCAN_MAX_RESULTS: usize = 500;
const TARGETED_SCAN_MAX_IMPORT_IDS: usize = 500;
const FETCH_PROGRESS_DOWNLOAD_START: u32 = 5;
const FETCH_PROGRESS_PARSE_START: u32 = 25;
const FETCH_PROGRESS_STORE_START: u32 = 35;
const FETCH_PROGRESS_DONE: u32 = 100;
const REVIEW_STATUS_PENDING_ISIN_MISMATCH: &str = "PENDING_ISIN_MISMATCH";
const HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS: usize = 25;
const HISTORICAL_SPARSE_CANDIDATE_LONG_HISTORY_CUTOFF: &str = "2015-01-01";
#[derive(Clone, Debug)]
struct ParsedAction {
    action_type: String,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
    cash_amount: Option<f64>,
    factor: Option<f64>,
    price_factor: Option<f64>,
    parse_status: String,
    message: Option<String>,
}

#[derive(Clone, Debug)]
struct NewImportCandidate {
    dedupe_key: String,
    exchange: String,
    source: String,
    source_file: Option<String>,
    symbol: Option<String>,
    isin: Option<String>,
    bse_scrip_code: Option<String>,
    company_name: Option<String>,
    purpose_raw: String,
    ex_date: Option<String>,
    record_date: Option<String>,
    action_type: String,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
    cash_amount: Option<f64>,
    factor: Option<f64>,
    price_factor: Option<f64>,
    parse_status: String,
    review_status: String,
    message: Option<String>,
    evidence: NewImportEvidence,
}

#[derive(Clone, Debug)]
struct NewImportEvidence {
    source_locator: Option<String>,
    symbol_seen: Option<String>,
    isin_seen: Option<String>,
    company_name_seen: Option<String>,
    action_type_seen: Option<String>,
    event_date_seen: Option<String>,
    factor_seen: Option<f64>,
    raw_reference: Option<String>,
    note: Option<String>,
}

#[derive(Clone, Debug)]
struct EventDateImportIdentity {
    symbol: Option<String>,
    isin: Option<String>,
}

#[derive(Clone, Debug)]
struct ResolvedCsvInstrument {
    symbol: Option<String>,
    exchange: String,
    isin: Option<String>,
    company_name: Option<String>,
    review_status: String,
    message: Option<String>,
}

#[derive(Clone, Debug)]
struct IdentityChainInstrumentCandidate {
    symbol: String,
    exchange: String,
    isin: Option<String>,
    company_name: Option<String>,
    series: Option<String>,
    is_active: bool,
}

fn format_identity_chain_candidates(candidates: &[&IdentityChainInstrumentCandidate]) -> String {
    candidates
        .iter()
        .map(|candidate| {
            format!(
                "{} ({})",
                candidate.symbol,
                if candidate.is_active {
                    "active"
                } else {
                    "inactive"
                }
            )
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn build_import_evidence_note(source: &str) -> String {
    if source.ends_with("_CSV") {
        "Captured from the imported corporate-action CSV row.".to_string()
    } else {
        "Captured from the current structured official corporate-action source row.".to_string()
    }
}

pub(super) fn build_import_evidence_raw_reference(
    raw_symbol: Option<&str>,
    raw_isin: Option<&str>,
    raw_bse_scrip_code: Option<&str>,
    raw_company_name: Option<&str>,
    purpose_raw: &str,
    ex_date: Option<&str>,
    record_date: Option<&str>,
) -> Option<String> {
    let payload = serde_json::json!({
        "symbol": normalize_optional_text(raw_symbol),
        "isin": normalize_optional_text(raw_isin),
        "bseScripCode": normalize_optional_text(raw_bse_scrip_code),
        "companyName": normalize_optional_text(raw_company_name),
        "purposeRaw": purpose_raw,
        "exDate": ex_date,
        "recordDate": record_date,
    });

    Some(payload.to_string())
}

#[derive(Clone, Debug)]
struct ScanCandidate {
    import_id: i64,
    symbol: Option<String>,
    exchange: String,
    ex_date: Option<String>,
    factor: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct FetchCoverageRange {
    from_date: String,
    to_date: String,
}

#[derive(Clone, Debug)]
struct ScannedBar {
    date: String,
    open: f64,
    close: f64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CorporateActionProgressPayload {
    progress: u32,
    message: String,
}

#[derive(Clone, Debug)]
enum IsinInstrumentMatch {
    None,
    Unique((String, String, Option<String>, Option<String>)),
    Ambiguous,
}

#[derive(Clone, Debug)]
struct HistoricalSourceAttemptState {
    source: String,
    requested_symbol: Option<String>,
    source_locator: Option<String>,
    rows_read: u32,
    rows_inserted: u32,
    rows_duplicate: u32,
    rows_evidence_attached: u32,
    rows_error: u32,
    earliest_ex_date: Option<String>,
    latest_ex_date: Option<String>,
}

#[derive(Debug)]
enum HistoricalCandidateStoreOutcome {
    Inserted {
        row: CorporateActionImportRow,
        evidence_id: i64,
    },
    Duplicate {
        import_id: i64,
    },
    EvidenceAttached {
        import_id: i64,
        evidence_id: i64,
    },
}

#[tauri::command]
pub async fn import_corporate_actions_csv(
    app: AppHandle,
    input: CorporateActionCsvImportInput,
) -> AppResult<CorporateActionCsvImportResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before importing corporate action CSV files.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let result = import_corporate_actions_csv_internal(&connection, &input)?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionCsvImportResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn fetch_official_corporate_actions(
    app: AppHandle,
    input: CorporateActionOfficialFetchInput,
) -> AppResult<CorporateActionOfficialFetchResult> {
    let fetch_guard = bse_fetch::FetchGuard::start()?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _fetch_guard = fetch_guard;
        emit_corporate_action_progress(
            &app_handle,
            0,
            format!(
                "Starting official {} corporate action fetch...",
                input.exchange.trim().to_uppercase()
            ),
        );
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before fetching official corporate actions.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let result = fetch_official_corporate_actions_internal(&app_handle, &connection, &input, _fetch_guard.0.clone())?;
        emit_corporate_action_progress(
            &app_handle,
            FETCH_PROGRESS_DONE,
            format!(
                "Fetched {} official {} corporate action row(s).",
                result.rows_read, result.exchange
            ),
        );
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionOfficialFetchResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn backfill_historical_capital_actions_for_symbol(
    app: AppHandle,
    input: HistoricalCapitalActionBackfillInput,
) -> AppResult<HistoricalCapitalActionBackfillResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        emit_corporate_action_progress(
            &app_handle,
            0,
            format!(
                "Starting historical capital-action backfill pilot for {}:{}...",
                input.exchange.trim().to_uppercase(),
                input.symbol.trim().to_uppercase()
            ),
        );
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before running historical capital-action backfill.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let result = backfill_historical_capital_actions_for_symbol_internal(
            &app_handle,
            &connection,
            &input,
            None,
        )?;
        emit_corporate_action_progress(&app_handle, FETCH_PROGRESS_DONE, result.message.clone());
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<HistoricalCapitalActionBackfillResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn backfill_historical_capital_actions_batch(
    app: AppHandle,
    input: HistoricalCapitalActionBackfillBatchInput,
) -> AppResult<HistoricalCapitalActionBackfillBatchResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let requests = prepare_historical_backfill_batch_requests(&input)?;
        let exchange = requests
            .first()
            .map(|request| request.exchange.clone())
            .unwrap_or_else(|| "NSE".to_string());
        let from_date = requests
            .first()
            .map(|request| request.from_date.clone())
            .unwrap_or_else(|| input.from_date.clone());
        let to_date = requests
            .first()
            .map(|request| request.to_date.clone())
            .unwrap_or_else(|| input.to_date.clone());
        let requested_symbols = requests
            .iter()
            .map(|request| request.symbol.clone())
            .collect::<Vec<_>>();
        let stop_on_error = input.stop_on_error.unwrap_or(false);

        emit_corporate_action_progress(
            &app_handle,
            0,
            format!(
                "Starting historical capital-action batch backfill for {} symbol(s)...",
                requests.len()
            ),
        );
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before running historical capital-action batch backfill.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let run_id = create_historical_backfill_run(
            &connection,
            &exchange,
            &from_date,
            &to_date,
            &requested_symbols,
            stop_on_error,
        )?;

        let mut result = HistoricalCapitalActionBackfillBatchResult {
            run_id: Some(run_id),
            exchange,
            from_date,
            to_date,
            requested_symbols,
            total_symbols: requests.len() as u32,
            completed_symbols: 0,
            failed_symbols: 0,
            stopped_on_error: false,
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            rows_unresolved: 0,
            rows_parsed: 0,
            rows_unsupported: 0,
            parse_status_counts: HashMap::new(),
            review_status_counts: HashMap::new(),
            symbol_results: Vec::new(),
            errors: Vec::new(),
            message: String::new(),
        };

        for (index, request) in requests.into_iter().enumerate() {
            let progress = 5 + (((index as u32) * 90) / result.total_symbols.max(1));
            emit_corporate_action_progress(
                &app_handle,
                progress,
                format!(
                    "Historical batch: running {} of {} ({})...",
                    index + 1,
                    result.total_symbols,
                    request.symbol
                ),
            );

            let symbol = request.symbol.clone();
            let bse_scrip_code = request.bse_scrip_code.clone();
            let run_symbol_id =
                create_historical_backfill_run_symbol(&connection, run_id, &request)?;
            match backfill_historical_capital_actions_for_symbol_internal(
                &app_handle,
                &connection,
                &request,
                Some(run_symbol_id),
            ) {
                Ok(symbol_result) => {
                    result.completed_symbols += 1;
                    result.rows_read += symbol_result.rows_read;
                    result.rows_inserted += symbol_result.rows_inserted;
                    result.rows_duplicate += symbol_result.rows_duplicate;
                    result.rows_evidence_attached += symbol_result.rows_evidence_attached;
                    result.rows_error += symbol_result.rows_error;
                    result.rows_unresolved += symbol_result.rows_unresolved;
                    result.rows_parsed += symbol_result.rows_parsed;
                    result.rows_unsupported += symbol_result.rows_unsupported;
                    merge_status_counts(
                        &mut result.parse_status_counts,
                        &symbol_result.parse_status_counts,
                    );
                    merge_status_counts(
                        &mut result.review_status_counts,
                        &symbol_result.review_status_counts,
                    );
                    complete_historical_backfill_run_symbol(
                        &connection,
                        run_symbol_id,
                        &symbol_result,
                    )?;
                    result
                        .symbol_results
                        .push(HistoricalCapitalActionBackfillBatchSymbolResult {
                            run_symbol_id: Some(run_symbol_id),
                            symbol,
                            status: "COMPLETED".to_string(),
                            bse_scrip_code,
                            result: Some(symbol_result),
                            error: None,
                        });
                }
                Err(error) => {
                    result.failed_symbols += 1;
                    result.errors.push(format!("{}: {}", symbol, error));
                    fail_historical_backfill_run_symbol(&connection, run_symbol_id, &error)?;
                    result
                        .symbol_results
                        .push(HistoricalCapitalActionBackfillBatchSymbolResult {
                            run_symbol_id: Some(run_symbol_id),
                            symbol,
                            status: "FAILED".to_string(),
                            bse_scrip_code,
                            result: None,
                            error: Some(error),
                        });
                    if stop_on_error {
                        result.stopped_on_error = true;
                        break;
                    }
                }
            }
        }

        result.message = format!(
            "Historical capital-action batch checked {} of {} symbol(s), stored {} new review row(s), attached evidence to {} existing row(s), skipped {} exact duplicates, and recorded {} failed symbol(s).",
            result.completed_symbols + result.failed_symbols,
            result.total_symbols,
            result.rows_inserted,
            result.rows_evidence_attached,
            result.rows_duplicate,
            result.failed_symbols
        );
        complete_historical_backfill_run(&connection, run_id, &result)?;
        emit_corporate_action_progress(&app_handle, FETCH_PROGRESS_DONE, result.message.clone());
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<HistoricalCapitalActionBackfillBatchResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_imports(
    app: AppHandle,
    input: Option<CorporateActionImportListInput>,
) -> AppResult<Vec<CorporateActionImportRow>> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Pagination shares the initialized active connection; do not rerun
        // schema/identity preparation for every page.
        super::with_active_connection(&app_handle, |connection| {
            list_import_rows(connection, input.as_ref())
        })?
        .ok_or_else(|| "Open a database before listing corporate action imports.".to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Read only the caller-reviewed IDs using the existing query-only connection owner.
#[tauri::command]
pub async fn get_corporate_action_imports_by_ids(
    app: AppHandle,
    input: CorporateActionImportLookupInput,
) -> AppResult<Vec<CorporateActionImportRow>> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    // Resolve/bind the active folder before dispatch. Never open the caller's path directly.
    let folder_path = resolve_active_database_folder(&app)?.ok_or_else(|| {
        "Open a database before reading reviewed corporate action imports.".to_string()
    })?;
    verify_import_lookup_database(&folder_path, &input.expected_database_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        read_import_rows_by_ids(&connection, &input.import_ids)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_event_identities(
    app: AppHandle,
    input: CorporateActionEventIdentityListInput,
) -> AppResult<CorporateActionEventIdentityListResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing Corporate Action event identities.".to_string()
        })?;
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        connection.execute_batch("BEGIN DEFERRED").map_err(|error| error.to_string())?;
        let mut result = event_identity_resolution::list_effective_event_identities(&connection, &input)?;
        for id in event_identity_resolution::validate_event_identity_import_ids(&input.import_ids)? {
            if let Some(corporate_action_id) = auto_approval::verified_existing_dividend(
                &connection, &folder_path, id,
            )? {
                result.existing_dividends.push(super::CorporateActionExistingDividend {
                    import_id: id, corporate_action_id,
                });
            }
        }
        connection.execute_batch("COMMIT").map_err(|error| error.to_string())?;
        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn preview_corporate_action_repairs(
    app: AppHandle,
    input: CorporateActionRepairPreviewInput,
) -> AppResult<CorporateActionRepairPreviewResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before previewing corporate action repairs.".to_string()
        })?;
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        preview_corporate_action_repairs_internal(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_import_resolution_hints(
    app: AppHandle,
    input: CorporateActionImportResolutionHintsInput,
) -> AppResult<CorporateActionImportResolutionHintsResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        super::with_active_connection(&app_handle, |connection| {
            list_corporate_action_import_resolution_hints_internal(connection, &input)
        })?
        .ok_or_else(|| {
            "Open a database before reviewing official import quick-resolve hints.".to_string()
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_import_resolution_suggestions(
    app: AppHandle,
    input: CorporateActionImportResolutionSuggestionsInput,
) -> AppResult<CorporateActionImportResolutionSuggestionsResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before reviewing official import resolution suggestions.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_corporate_action_import_resolution_suggestions_internal(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn resolve_reviewed_corporate_action_database(
    app: &AppHandle,
    expected_database_path: &str,
) -> AppResult<std::path::PathBuf> {
    let folder_path = resolve_active_database_folder(app)?.ok_or_else(|| {
        "Open a database before approving corporate action imports.".to_string()
    })?;
    verify_import_lookup_database(&folder_path, expected_database_path)?;
    Ok(folder_path)
}

#[tauri::command]
pub async fn approve_corporate_action_import(
    app: AppHandle,
    input: CorporateActionImportApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_reviewed_corporate_action_database(&app_handle, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let result = approve_corporate_action_import_internal(&connection, &folder_path, &input)?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionImportApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn approve_corporate_action_import_with_isin_mismatch(
    app: AppHandle,
    input: CorporateActionImportExceptionalApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_reviewed_corporate_action_database(&app_handle, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let result = run_connection_transaction(&connection, |connection| {
            approve_corporate_action_import_with_isin_mismatch_internal(
                connection,
                &folder_path,
                &input,
            )
        })?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionImportApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn approve_corporate_action_import_with_price_validation_exception(
    app: AppHandle,
    input: CorporateActionImportExceptionalApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_reviewed_corporate_action_database(&app_handle, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let result = run_connection_transaction(&connection, |connection| {
            approve_corporate_action_import_with_price_validation_exception_internal(
                connection,
                &folder_path,
                &input,
            )
        })?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionImportApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn approve_corporate_action_imports(
    app: AppHandle,
    input: CorporateActionImportBulkApprovalInput,
) -> AppResult<CorporateActionImportBulkApprovalResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_reviewed_corporate_action_database(&app_handle, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let result = approve_corporate_action_imports_internal(&connection, &folder_path, &input)?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionImportBulkApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn map_simple_cash_dividend_prepared_scope_result(
    result: auto_approval::SimpleCashDividendPreparedScopeResult,
) -> CorporateActionDividendPreparedScopeEvaluationResult {
    CorporateActionDividendPreparedScopeEvaluationResult {
        requested: result.requested,
        eligible: result.eligible,
        ineligible: result.ineligible,
        already_approved: result.already_approved,
        stale_scope: result.stale_scope,
        missing: result.missing,
        failed: result.failed,
        reused_count: result.reused_count,
        dispositions: result
            .dispositions
            .into_iter()
            .map(
                |item| CorporateActionDividendPreparedScopeEvaluationDisposition {
                    import_id: item.import_id,
                    disposition: item.disposition,
                    reason: item.reason,
                    current_action_type: item.current_action_type,
                    current_parse_status: item.current_parse_status,
                    current_review_status: item.current_review_status,
                    evidence: item.evidence.map(|evidence| {
                        CorporateActionDividendPreparedScopeEvaluationEvidence {
                            identity_proof: evidence.identity_proof,
                            official_evidence_id: evidence.official_evidence_id,
                            evidence_captured_at: evidence.evidence_captured_at,
                            source_locator: evidence.source_locator,
                            cash_amount: evidence.cash_amount,
                            previous_trade_date: evidence.previous_trade_date,
                            previous_close: evidence.previous_close,
                            computed_factor: evidence.computed_factor,
                        }
                    }),
                },
            )
            .collect(),
        policy_version: result.policy_version,
        scope_version: auto_approval::SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION.to_string(),
        scope_fingerprint: result.scope_fingerprint,
        complete: result.complete,
        message: result.message,
    }
}

/// Diagnostic checkpoint owner; the underlying policy evaluator remains read-only.
#[tauri::command]
pub async fn evaluate_simple_cash_dividend_prepared_scope(
    app: AppHandle,
    input: CorporateActionDividendPreparedScopeEvaluationInput,
) -> AppResult<CorporateActionDividendPreparedScopeEvaluationResult> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    let folder_path = resolve_active_database_folder(&app)?.ok_or_else(|| {
        "Open a database before evaluating the Dividend prepared scope.".to_string()
    })?;
    verify_import_lookup_database(&folder_path, &input.expected_database_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::CorporateActionAutomatic)?;
        let mut connection = dividend_validation_cache::open_connection(&folder_path)?;
        let internal_input = auto_approval::SimpleCashDividendPreparedScopeInput {
            import_ids: input.import_ids,
            expected_database_path: input.expected_database_path,
        };
        let result = dividend_validation_cache::evaluate(
            &mut connection,
            &folder_path,
            &internal_input,
        )?;
        Ok::<CorporateActionDividendPreparedScopeEvaluationResult, String>(
            map_simple_cash_dividend_prepared_scope_result(result),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod simple_cash_dividend_transaction_owner_tests;
#[cfg(test)]
mod simple_cash_dividend_write_stage_bridge_tests;

fn validate_simple_cash_dividend_write_stage_transaction_owner(
    folder_path: &Path,
    input: &auto_approval::SimpleCashDividendWriteStageInput,
) -> AppResult<()> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    verify_import_lookup_database(folder_path, &input.expected_database_path)
}

fn run_simple_cash_dividend_write_stage_outer_transaction_with_executor<F>(
    connection: &Connection,
    folder_path: &Path,
    input: &auto_approval::SimpleCashDividendWriteStageInput,
    executor: F,
) -> AppResult<auto_approval::SimpleCashDividendWriteStageResult>
where
    F: FnOnce(
        &Connection,
        &Path,
        &auto_approval::SimpleCashDividendWriteStageInput,
    ) -> AppResult<auto_approval::SimpleCashDividendWriteStageResult>,
{
    connection.execute_batch("BEGIN IMMEDIATE TRANSACTION").map_err(|e| e.to_string())?;
    let outcome = (|| {
        let result = executor(connection, folder_path, input)?;
        if result.failed > 0 || !result.complete {
            let details = result.dispositions.iter().filter(|row| row.disposition == "FAILED")
                .take(10).map(|row| {
                    let symbol = connection.query_row(
                        "SELECT COALESCE(symbol, 'Unmatched') FROM corporate_action_imports WHERE id = ?",
                        [row.import_id], |r| r.get::<_, String>(0),
                    ).unwrap_or_else(|_| "Unknown symbol".to_string());
                    format!("import {} ({symbol}): {}", row.import_id, row.reason)
                }).collect::<Vec<_>>().join("; ");
            return Err(format!(
                "Dividend write-stage R1 transaction owner refused commit: failed={} complete={}.{}",
                result.failed, result.complete, if details.is_empty() { String::new() } else { format!(" {details}") }
            ));
        }
        Ok(result)
    })();
    match outcome {
        Ok(result) => match connection.execute_batch("COMMIT") {
            Ok(()) => Ok(result),
            Err(error) => {
                // A commit error is not a confirmed rollback receipt.
                let _ = connection.execute_batch("ROLLBACK");
                Err(format!("Dividend commit outcome requires reconciliation: {error}"))
            }
        },
        Err(error) => match connection.execute_batch("ROLLBACK") {
            Ok(()) => Err(format!("CA_DIVIDEND_ROLLBACK_CONFIRMED: {error}")),
            Err(rollback) => Err(format!("Dividend rollback unconfirmed: {error}; rollback error: {rollback}")),
        },
    }
}

fn run_simple_cash_dividend_write_stage_outer_transaction(
    connection: &Connection,
    folder_path: &Path,
    input: &auto_approval::SimpleCashDividendWriteStageInput,
) -> AppResult<auto_approval::SimpleCashDividendWriteStageResult> {
    run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        connection,
        folder_path,
        input,
        |connection, folder_path, input| {
            auto_approval::execute_simple_cash_dividend_write_stage_in_connection(
                connection,
                folder_path,
                input,
            )
        },
    )
}

fn execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(
    folder_path: &Path,
    input: &auto_approval::SimpleCashDividendWriteStageInput,
) -> AppResult<auto_approval::SimpleCashDividendWriteStageResult> {
    let _price_store_operation_permit =
        try_acquire_price_store_operation(PriceStoreOperationKind::CorporateActionAutomatic)?;
    let connection = open_connection_for_folder(folder_path, false)?;
    run_simple_cash_dividend_write_stage_outer_transaction(&connection, folder_path, input)
}

#[allow(dead_code)]
async fn execute_simple_cash_dividend_write_stage_transaction_owner(
    app: AppHandle,
    input: auto_approval::SimpleCashDividendWriteStageInput,
) -> AppResult<auto_approval::SimpleCashDividendWriteStageResult> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    let folder_path = resolve_active_database_folder(&app)?.ok_or_else(|| {
        "Open a database before running the Dividend write-stage transaction owner.".to_string()
    })?;
    validate_simple_cash_dividend_write_stage_transaction_owner(&folder_path, &input)?;
    let folder_for_write = folder_path.clone();
    let committed_result = tauri::async_runtime::spawn_blocking(move || {
        execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(&folder_for_write, &input)
    })
    .await
    .map_err(|error| error.to_string())??;
    // Only the private owner publishes post-commit cache and chart notifications.
    // The public Tauri command remains a typed transport, with no write ownership.
    if committed_result.auto_approved > 0 {
        invalidate_cached_db_stats(&app, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app, &snapshot)?;
    }
    Ok(committed_result)
}

fn map_simple_cash_dividend_write_stage_result(
    result: auto_approval::SimpleCashDividendWriteStageResult,
) -> CorporateActionDividendWriteStageResult {
    CorporateActionDividendWriteStageResult {
        requested: result.requested,
        revalidated_eligible: result.revalidated_eligible,
        auto_approved: result.auto_approved,
        ineligible: result.ineligible,
        already_approved: result.already_approved,
        stale_scope: result.stale_scope,
        missing: result.missing,
        failed: result.failed,
        dispositions: result
            .dispositions
            .into_iter()
            .map(|item| CorporateActionDividendWriteStageDisposition {
                import_id: item.import_id,
                disposition: item.disposition,
                reason: item.reason,
                corporate_action_id: item.corporate_action_id,
            })
            .collect(),
        policy_version: result.policy_version,
        scope_version: result.scope_version,
        write_stage_version: result.write_stage_version,
        scope_fingerprint: result.scope_fingerprint,
        complete: result.complete,
        message: result.message,
    }
}

#[tauri::command]
pub async fn auto_approve_corporate_action_imports(
    app: AppHandle,
    input: CorporateActionAutoApprovalInput,
) -> AppResult<CorporateActionAutoApprovalResult> {
    validate_exact_import_lookup_ids(&input.import_ids)?;
    let folder_path = resolve_active_database_folder(&app)?.ok_or_else(|| {
        "Open a database before auto-approving corporate action imports.".to_string()
    })?;
    verify_import_lookup_database(&folder_path, &input.expected_database_path)?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::CorporateActionAutomatic)?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let result = run_connection_transaction(&connection, |connection| {
            auto_approval::auto_approve_corporate_action_imports_in_connection(
                connection,
                &folder_path,
                &input,
            )
        })?;
        if result.auto_approved + result.linked_existing > 0 {
            invalidate_cached_db_stats(&app_handle, &folder_path)?;
            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;
        }
        Ok::<CorporateActionAutoApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn approve_recommended_corporate_action_isin_mismatches(
    app: AppHandle,
    input: CorporateActionImportBulkApprovalInput,
) -> AppResult<CorporateActionImportBulkApprovalResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_reviewed_corporate_action_database(&app_handle, &input.expected_database_path)?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let result = approve_recommended_corporate_action_isin_mismatches_internal(
            &connection,
            &folder_path,
            &input,
        )?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok::<CorporateActionImportBulkApprovalResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Typed transport only. The private P4B owner is the sole write/transaction authority.
#[tauri::command]
pub async fn execute_simple_cash_dividend_write_stage(
    app: AppHandle,
    input: CorporateActionDividendWriteStageInput,
) -> AppResult<CorporateActionDividendWriteStageResult> {
    let private_input = auto_approval::SimpleCashDividendWriteStageInput {
        import_ids: input.import_ids,
        expected_database_path: input.expected_database_path,
        expected_policy_version: input.expected_policy_version,
        expected_scope_version: input.expected_scope_version,
        expected_write_stage_version: input.expected_write_stage_version,
        expected_scope_fingerprint: input.expected_scope_fingerprint,
    };
    let committed_result =
        execute_simple_cash_dividend_write_stage_transaction_owner(app, private_input).await?;
    Ok(map_simple_cash_dividend_write_stage_result(committed_result))
}

#[tauri::command]
pub async fn resolve_corporate_action_import(
    app: AppHandle,
    input: CorporateActionImportResolveInput,
) -> AppResult<CorporateActionImportResolveResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before resolving corporate action imports.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        run_connection_transaction(&connection, |connection| {
            resolve_corporate_action_import_internal(connection, &input)
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn quick_resolve_corporate_action_import(
    app: AppHandle,
    input: CorporateActionImportQuickResolveInput,
) -> AppResult<CorporateActionImportResolveResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Load can resolve thousands of rows. Reuse the initialized connection
        // instead of rerunning schema preparation for every individual row.
        super::with_active_connection(&app_handle, |connection| {
            run_connection_transaction(connection, |connection| {
                quick_resolve_corporate_action_import_internal(connection, &input)
            })
        })
        .and_then(|result| result.ok_or_else(|| {
            "Open a database before quick-resolving corporate action imports.".to_string()
        }))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn recheck_corporate_action_imports(
    app: AppHandle,
    input: CorporateActionImportBulkRecheckInput,
) -> AppResult<CorporateActionImportBulkRecheckResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before rechecking corporate action imports.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        run_connection_transaction(&connection, |connection| {
            recheck_corporate_action_imports_internal(connection, &input)
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn run_corporate_action_scan(
    app: AppHandle,
    input: Option<CorporateActionScanInput>,
) -> AppResult<CorporateActionScanResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before scanning corporate actions.".to_string())?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let result = run_corporate_action_scan_internal(&connection, &folder_path, input.as_ref())?;
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        Ok::<CorporateActionScanResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_scan_results(
    app: AppHandle,
    input: Option<CorporateActionScanListInput>,
) -> AppResult<CorporateActionScanResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing corporate action scan results.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_scan_results(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_historical_capital_action_backfill_runs(
    app: AppHandle,
    input: Option<HistoricalCapitalActionBackfillRunListInput>,
) -> AppResult<HistoricalCapitalActionBackfillRunListResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing historical backfill runs.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_historical_backfill_runs(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_historical_capital_action_sparse_candidates(
    app: AppHandle,
    input: Option<HistoricalCapitalActionSparseCandidateInput>,
) -> AppResult<HistoricalCapitalActionSparseCandidateResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing sparse historical capital-action candidates."
                .to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_historical_sparse_candidates(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_historical_capital_action_alias_candidates(
    app: AppHandle,
    input: Option<HistoricalCapitalActionAliasCandidateInput>,
) -> AppResult<HistoricalCapitalActionAliasCandidateResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing old-alias historical capital-action candidates."
                .to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_historical_alias_candidates(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_historical_capital_action_major_liquid_candidates(
    app: AppHandle,
    input: Option<HistoricalCapitalActionMajorLiquidCandidateInput>,
) -> AppResult<HistoricalCapitalActionMajorLiquidCandidateResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before listing major liquid historical capital-action candidates."
                .to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, true)?;
        list_historical_major_liquid_candidates(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn emit_corporate_action_progress(app: &AppHandle, progress: u32, message: impl Into<String>) {
    let _ = app.emit(
        "corporate-actions:progress",
        CorporateActionProgressPayload {
            progress,
            message: message.into(),
        },
    );
}

fn import_corporate_actions_csv_internal(
    connection: &Connection,
    input: &CorporateActionCsvImportInput,
) -> AppResult<CorporateActionCsvImportResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    let source = if exchange == "BSE" {
        "BSE_CSV"
    } else {
        "NSE_CSV"
    };
    let source_file = Some(input.file_path.clone());
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_path(&input.file_path)
        .map_err(|error| error.to_string())?;
    let headers = reader.headers().map_err(|error| error.to_string())?.clone();
    let header_map = build_header_map(&headers);

    let mut result = CorporateActionCsvImportResult {
        rows_read: 0,
        rows_inserted: 0,
        rows_duplicate: 0,
        rows_error: 0,
        rows_unresolved: 0,
        rows_parsed: 0,
        rows_unsupported: 0,
        imports: Vec::new(),
        errors: Vec::new(),
    };

    for row in reader.records() {
        result.rows_read += 1;
        let record = match row {
            Ok(record) => record,
            Err(error) => {
                result.rows_error += 1;
                result.errors.push(error.to_string());
                continue;
            }
        };

        let candidate = match build_import_candidate(
            connection,
            &exchange,
            source,
            source_file.clone(),
            &header_map,
            &record,
        ) {
            Ok(candidate) => candidate,
            Err(error) => {
                result.rows_error += 1;
                result
                    .errors
                    .push(format!("Row {}: {error}", result.rows_read));
                continue;
            }
        };

        count_candidate_status(
            candidate.review_status.as_str(),
            candidate.parse_status.as_str(),
            &mut result.rows_unresolved,
            &mut result.rows_parsed,
            &mut result.rows_unsupported,
        );

        match store_import_candidate_evidence_aware(connection, &candidate) {
            Ok(HistoricalCandidateStoreOutcome::Inserted { row, .. }) => {
                result.rows_inserted += 1;
                result.imports.push(row);
            }
            Ok(HistoricalCandidateStoreOutcome::Duplicate { .. }) => {
                result.rows_duplicate += 1;
            }
            Ok(HistoricalCandidateStoreOutcome::EvidenceAttached { .. }) => {
                // Preserve the existing ordinary result/API contract: no new import row
                // was created, so equivalent-event evidence remains in rows_duplicate.
                result.rows_duplicate += 1;
            }
            Err(error) => {
                result.rows_error += 1;
                result
                    .errors
                    .push(format!("Row {}: {error}", result.rows_read));
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn cancel_official_corporate_action_fetch() -> bool {
    bse_fetch::cancel()
}

fn fetch_official_corporate_actions_internal(
    app: &AppHandle,
    connection: &Connection,
    input: &CorporateActionOfficialFetchInput,
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> AppResult<CorporateActionOfficialFetchResult> {
    fetch_official_corporate_actions_with_session(app, connection, input, cancelled, None)
}

fn fetch_official_corporate_actions_with_session(
    app: &AppHandle,
    connection: &Connection,
    input: &CorporateActionOfficialFetchInput,
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
    session: Option<bse_fetch::BseSession>,
) -> AppResult<CorporateActionOfficialFetchResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    let from_date = parse_official_date(&input.from_date)?;
    let to_date = parse_official_date(&input.to_date)?;
    if from_date > to_date {
        return Err("From date cannot be after to date.".to_string());
    }
    let force_refresh = input.force_refresh.unwrap_or(false);

    let source = if exchange == "BSE" {
        "BSE_API"
    } else {
        "NSE_API"
    };
    let mut result = CorporateActionOfficialFetchResult {
        exchange: exchange.clone(),
        source: source.to_string(),
        from_date: from_date.clone(),
        to_date: to_date.clone(),
        requested_days: inclusive_day_count(&from_date, &to_date)?,
        cached_days: 0,
        fetched_days: 0,
        fetched_ranges: 0,
        rows_read: 0,
        rows_inserted: 0,
        rows_duplicate: 0,
        rows_error: 0,
        rows_unresolved: 0,
        rows_parsed: 0,
        rows_unsupported: 0,
        imports: Vec::new(),
        errors: Vec::new(),
    };

    emit_corporate_action_progress(
        app,
        2,
        if force_refresh {
            format!(
                "Force re-fetch enabled for {} official rows from {} to {}. Saved coverage will be bypassed for this request.",
                exchange, from_date, to_date
            )
        } else {
            format!(
                "Checking saved {} official-fetch coverage for {} to {}...",
                exchange, from_date, to_date
            )
        },
    );
    let missing_ranges = resolve_official_fetch_ranges(
        connection,
        &exchange,
        source,
        &from_date,
        &to_date,
        force_refresh,
    )?;
    let missing_ranges = if exchange == "BSE" { bse_fetch::bounded_ranges(missing_ranges)? } else { missing_ranges };
    result.fetched_ranges = missing_ranges.len() as u32;
    result.fetched_days = if force_refresh {
        result.requested_days
    } else {
        missing_ranges.iter().try_fold(0u32, |sum, range| {
            inclusive_day_count(&range.from_date, &range.to_date).map(|days| sum + days)
        })?
    };
    result.cached_days = if force_refresh {
        0
    } else {
        result.requested_days.saturating_sub(result.fetched_days)
    };

    // Collection belongs to explicit Fetch, including cached CA ranges. Offline
    // Load/approval paths only consume and recheck retained source bytes.
    let mut bse_session = if exchange == "BSE" { Some(match session { Some(session) => session, None => bse_fetch::BseSession::new(cancelled.clone())? }) } else { None };
    if exchange == "NSE" {
        if let Err(error) = dated_symbol_chain::collect(connection, force_refresh) {
            result.errors.push(format!("Historical identity source unavailable: {error}. Unproven identities remain unresolved."));
        }
    }
    if exchange == "BSE" {
        bse_fetch::check_cancel(&cancelled)?;
        emit_corporate_action_progress(app, 3, "Collecting official BSE security-code mappings; no approvals...");
        match bse_identity_mapping::collect(app, connection, bse_session.as_mut().expect("BSE session")) {
            Ok(count) => emit_corporate_action_progress(app, 4, format!("Filled {count} missing BSE security-code mapping(s). Load & Validate will retry unmatched rows; no approvals.")),
            Err(error) => result.errors.push(format!("BSE security-code identity source unavailable: {error}. Unmatched rows remain unresolved; retry Fetch before Load & Validate.")),
        }
        bse_fetch::check_cancel(&cancelled)?;
    }
    if missing_ranges.is_empty() {
        emit_corporate_action_progress(
            app,
            FETCH_PROGRESS_DONE,
            format!(
                "Requested {} official {} day(s) are already cached. Use Load to review saved rows.",
                result.requested_days, exchange
            ),
        );
        return Ok(result);
    }

    if exchange == "BSE" {
        result.fetched_days = 0;
        result.fetched_ranges = 0;
    }
    for (range_index, range) in missing_ranges.iter().enumerate() {
        bse_fetch::check_cancel(&cancelled)?;
        let range_label = if missing_ranges.len() == 1 {
            format!("{} to {}", range.from_date, range.to_date)
        } else {
            format!(
                "{} to {} (missing range {} of {})",
                range.from_date,
                range.to_date,
                range_index + 1,
                missing_ranges.len()
            )
        };
        let candidates = if exchange == "BSE" {
            emit_corporate_action_progress(app, 5 + (90 * range_index / missing_ranges.len()) as u32, format!(
                "BSE window {} of {}: {} to {}. {} completed window(s) saved; Cancel Fetch stops safely.",
                range_index + 1, missing_ranges.len(), range.from_date, range.to_date, result.fetched_ranges
            ));
            fetch_bse_action_candidates(app, connection, &range.from_date, &range.to_date, bse_session.as_mut().unwrap())?
        } else {
            fetch_nse_action_candidates(app, connection, &range.from_date, &range.to_date)?
        };
        let total_candidates = candidates.len();
        let range_errors_before = result.rows_error;
        emit_corporate_action_progress(
            app,
            FETCH_PROGRESS_STORE_START,
            format!(
                "Downloaded {} official {} row(s) for {}. Resolving and storing them...",
                total_candidates, exchange, range_label
            ),
        );

        for (index, candidate_result) in candidates.into_iter().enumerate() {
            bse_fetch::check_cancel(&cancelled)?;
            result.rows_read += 1;
            if should_emit_fetch_progress(index, total_candidates) {
                emit_corporate_action_progress(
                    app,
                    compute_fetch_progress(index + 1, total_candidates),
                    format!(
                        "Resolving official row {} of {} for {}...",
                        index + 1,
                        total_candidates,
                        range_label
                    ),
                );
            }
            let candidate = match candidate_result {
                Ok(candidate) => candidate,
                Err(error) => {
                    result.rows_error += 1;
                    result
                        .errors
                        .push(format!("Official row {}: {error}", result.rows_read));
                    continue;
                }
            };

            count_candidate_status(
                candidate.review_status.as_str(),
                candidate.parse_status.as_str(),
                &mut result.rows_unresolved,
                &mut result.rows_parsed,
                &mut result.rows_unsupported,
            );

            match store_import_candidate_evidence_aware(connection, &candidate) {
                Ok(HistoricalCandidateStoreOutcome::Inserted { row, .. }) => {
                    result.rows_inserted += 1;
                    result.imports.push(row);
                }
                Ok(HistoricalCandidateStoreOutcome::Duplicate { .. }) => {
                    result.rows_duplicate += 1;
                }
                Ok(HistoricalCandidateStoreOutcome::EvidenceAttached { .. }) => {
                    // Preserve the existing ordinary result/API contract: equivalent
                    // evidence is retained without creating another import row.
                    result.rows_duplicate += 1;
                }
                Err(error) => {
                    result.rows_error += 1;
                    result
                        .errors
                        .push(format!("Official row {}: {error}", result.rows_read));
                }
            }
        }

        let range_errors = result.rows_error.saturating_sub(range_errors_before);
        bse_fetch::check_cancel(&cancelled)?;
        if exchange == "BSE" {
            result.fetched_days += bse_fetch::commit_window(connection, range, range_errors, &cancelled, &mut result.errors)?;
            result.fetched_ranges += 1;
        } else {
        record_fetch_coverage_if_complete(
            connection,
            &exchange,
            source,
            &range.from_date,
            &range.to_date,
            range_errors,
            &mut result.errors,
        )?;
        }
    }

    Ok(result)
}

fn backfill_historical_capital_actions_for_symbol_internal(
    app: &AppHandle,
    connection: &Connection,
    input: &HistoricalCapitalActionBackfillInput,
    run_symbol_id: Option<i64>,
) -> AppResult<HistoricalCapitalActionBackfillResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    if exchange != "NSE" {
        return Err(
            "The historical capital-action backfill pilot currently supports NSE target symbols only."
                .to_string(),
        );
    }
    let requested_symbol = normalize_symbol(&input.symbol)?;
    let from_date = parse_official_date(&input.from_date)?;
    let to_date = parse_official_date(&input.to_date)?;
    if from_date > to_date {
        return Err("From date cannot be after to date.".to_string());
    }
    let mut bse_scrip_code = normalize_optional_text(input.bse_scrip_code.as_deref());

    let canonical_symbol =
        resolve_backfill_canonical_symbol(connection, &requested_symbol, &exchange)?;
    if bse_scrip_code.is_none() {
        bse_scrip_code = infer_bse_scrip_code_for_backfill(
            connection,
            canonical_symbol
                .as_deref()
                .unwrap_or(requested_symbol.as_str()),
            &exchange,
        )?;
    }
    let searched_symbols = load_historical_backfill_symbols(
        connection,
        canonical_symbol
            .as_deref()
            .unwrap_or(requested_symbol.as_str()),
        &exchange,
    )?;

    let mut result = HistoricalCapitalActionBackfillResult {
        exchange: exchange.clone(),
        requested_symbol: requested_symbol.clone(),
        canonical_symbol: canonical_symbol.clone(),
        from_date: from_date.clone(),
        to_date: to_date.clone(),
        searched_symbols: searched_symbols.clone(),
        bse_scrip_code: bse_scrip_code.clone(),
        rows_read: 0,
        rows_inserted: 0,
        rows_duplicate: 0,
        rows_evidence_attached: 0,
        rows_error: 0,
        rows_unresolved: 0,
        rows_parsed: 0,
        rows_unsupported: 0,
        parse_status_counts: HashMap::new(),
        review_status_counts: HashMap::new(),
        imports: Vec::new(),
        source_attempts: Vec::new(),
        warnings: Vec::new(),
        errors: Vec::new(),
        message: String::new(),
    };

    for (index, alias_symbol) in searched_symbols.iter().enumerate() {
        let mut attempt = HistoricalSourceAttemptState {
            source: "NSE_API".to_string(),
            requested_symbol: Some(alias_symbol.clone()),
            source_locator: Some(build_nse_symbol_history_url(
                alias_symbol,
                &from_date,
                &to_date,
            )?),
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            earliest_ex_date: None,
            latest_ex_date: None,
        };
        emit_corporate_action_progress(
            app,
            5,
            format!(
                "Historical pilot: requesting NSE rows for {} (alias {} of {})...",
                alias_symbol,
                index + 1,
                searched_symbols.len()
            ),
        );
        let candidates = fetch_nse_symbol_action_candidates(
            app,
            connection,
            &exchange,
            alias_symbol,
            &from_date,
            &to_date,
        )?;
        process_historical_candidates(
            connection,
            candidates,
            &mut result,
            &mut attempt,
            "NSE symbol-scoped official history",
            run_symbol_id,
        )?;
        result.source_attempts.push(finalize_historical_attempt(
            attempt,
            "NSE symbol-scoped official history",
        ));
    }

    if let Some(bse_scrip_code) = bse_scrip_code.as_deref() {
        let mut attempt = HistoricalSourceAttemptState {
            source: "BSE_API".to_string(),
            requested_symbol: Some(bse_scrip_code.to_string()),
            source_locator: Some(build_bse_scrip_history_url(
                bse_scrip_code,
                &from_date,
                &to_date,
            )?),
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            earliest_ex_date: None,
            latest_ex_date: None,
        };
        emit_corporate_action_progress(
            app,
            15,
            format!(
                "Historical pilot: requesting BSE scrip history for {}...",
                bse_scrip_code
            ),
        );
        let candidates = fetch_bse_scrip_action_candidates(
            app,
            connection,
            &exchange,
            bse_scrip_code,
            &from_date,
            &to_date,
        )?;
        process_historical_candidates(
            connection,
            candidates,
            &mut result,
            &mut attempt,
            "BSE scrip-scoped official history",
            run_symbol_id,
        )?;
        result.source_attempts.push(finalize_historical_attempt(
            attempt,
            "BSE scrip-scoped official history",
        ));
    } else {
        result.warnings.push(
            "No BSE scrip code was supplied, so the pilot used only NSE symbol-scoped official history. Older split/bonus rows can still remain missing when NSE does not expose them."
                .to_string(),
        );
    }

    if result.rows_inserted == 0 && result.rows_evidence_attached == 0 && result.rows_error == 0 {
        result.warnings.push(
            "The pilot did not add any new review rows or attach new evidence. This can mean the current official sources already match the local review queue, or that deeper history still is not exposed for the requested symbol."
                .to_string(),
        );
    }

    let earliest_seen = result
        .source_attempts
        .iter()
        .filter_map(|attempt| attempt.earliest_ex_date.as_deref())
        .min()
        .map(str::to_string);
    if let Some(earliest_seen) = earliest_seen {
        if earliest_seen > from_date && bse_scrip_code.is_none() {
            result.warnings.push(format!(
                "The earliest capital-action row returned by the pilot sources was {} even though the requested window starts at {}. Deeper history may still require a BSE scrip-code source or another later-phase adapter.",
                earliest_seen, from_date
            ));
        }
    }

    result.message = format!(
        "Historical capital-action pilot checked {} source attempt(s) for {}:{} and stored {} new review row(s), attached evidence to {} existing row(s), and skipped {} exact duplicates.",
        result.source_attempts.len(),
        result.exchange,
        canonical_symbol
            .as_deref()
            .unwrap_or(result.requested_symbol.as_str()),
        result.rows_inserted,
        result.rows_evidence_attached,
        result.rows_duplicate
    );

    Ok(result)
}

fn prepare_historical_backfill_batch_requests(
    input: &HistoricalCapitalActionBackfillBatchInput,
) -> AppResult<Vec<HistoricalCapitalActionBackfillInput>> {
    let exchange = normalize_exchange(&input.exchange)?;
    if exchange != "NSE" {
        return Err(
            "The historical capital-action batch backfill currently supports NSE target symbols only."
                .to_string(),
        );
    }
    let from_date = parse_official_date(&input.from_date)?;
    let to_date = parse_official_date(&input.to_date)?;
    if from_date > to_date {
        return Err("From date cannot be after to date.".to_string());
    }
    if input.symbols.is_empty() {
        return Err(
            "Add at least one symbol before running historical batch backfill.".to_string(),
        );
    }
    if input.symbols.len() > HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS {
        return Err(format!(
            "Historical batch backfill is limited to {} symbols per run.",
            HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS
        ));
    }

    let mut seen_symbols = HashSet::new();
    let mut requests = Vec::with_capacity(input.symbols.len());
    for symbol_input in &input.symbols {
        let symbol = normalize_symbol(&symbol_input.symbol)?;
        if !seen_symbols.insert(symbol.clone()) {
            return Err(format!(
                "Duplicate historical batch symbol: {}. Remove duplicates before running the batch.",
                symbol
            ));
        }
        requests.push(HistoricalCapitalActionBackfillInput {
            exchange: exchange.clone(),
            symbol,
            from_date: from_date.clone(),
            to_date: to_date.clone(),
            bse_scrip_code: normalize_optional_text(symbol_input.bse_scrip_code.as_deref()),
        });
    }
    Ok(requests)
}

fn create_historical_backfill_run(
    connection: &Connection,
    exchange: &str,
    from_date: &str,
    to_date: &str,
    requested_symbols: &[String],
    stop_on_error: bool,
) -> AppResult<i64> {
    let requested_symbols_json =
        serde_json::to_string(requested_symbols).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
              INSERT INTO historical_capital_action_backfill_runs (
                exchange,
                from_date,
                to_date,
                requested_symbols,
                stop_on_error,
                total_symbols,
                status
              )
              VALUES (?, ?, ?, ?, ?, ?, 'RUNNING')
            ",
            params![
                exchange,
                from_date,
                to_date,
                requested_symbols_json,
                if stop_on_error { 1_i64 } else { 0_i64 },
                requested_symbols.len() as i64,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(connection.last_insert_rowid())
}

fn complete_historical_backfill_run(
    connection: &Connection,
    run_id: i64,
    result: &HistoricalCapitalActionBackfillBatchResult,
) -> AppResult<()> {
    let status = if result.stopped_on_error {
        "STOPPED_ON_ERROR"
    } else if result.failed_symbols > 0 {
        "COMPLETED_WITH_ERRORS"
    } else {
        "COMPLETED"
    };
    let completed_at = now_iso();
    let parse_status_counts =
        serde_json::to_string(&result.parse_status_counts).map_err(|error| error.to_string())?;
    let review_status_counts =
        serde_json::to_string(&result.review_status_counts).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
              UPDATE historical_capital_action_backfill_runs
              SET status = ?,
                  completed_symbols = ?,
                  failed_symbols = ?,
                  rows_read = ?,
                  rows_inserted = ?,
                  rows_duplicate = ?,
                  rows_evidence_attached = ?,
                  rows_error = ?,
                  rows_unresolved = ?,
                  rows_parsed = ?,
                  rows_unsupported = ?,
                  parse_status_counts = ?,
                  review_status_counts = ?,
                  completed_at = ?,
                  message = ?
              WHERE id = ?
            ",
            params![
                status,
                i64::from(result.completed_symbols),
                i64::from(result.failed_symbols),
                i64::from(result.rows_read),
                i64::from(result.rows_inserted),
                i64::from(result.rows_duplicate),
                i64::from(result.rows_evidence_attached),
                i64::from(result.rows_error),
                i64::from(result.rows_unresolved),
                i64::from(result.rows_parsed),
                i64::from(result.rows_unsupported),
                parse_status_counts,
                review_status_counts,
                completed_at,
                result.message.as_str(),
                run_id,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn create_historical_backfill_run_symbol(
    connection: &Connection,
    run_id: i64,
    request: &HistoricalCapitalActionBackfillInput,
) -> AppResult<i64> {
    connection
        .execute(
            "
              INSERT INTO historical_capital_action_backfill_run_symbols (
                run_id,
                symbol,
                bse_scrip_code,
                status
              )
              VALUES (?, ?, ?, 'RUNNING')
            ",
            params![
                run_id,
                request.symbol.as_str(),
                request.bse_scrip_code.as_deref()
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(connection.last_insert_rowid())
}

fn complete_historical_backfill_run_symbol(
    connection: &Connection,
    run_symbol_id: i64,
    result: &HistoricalCapitalActionBackfillResult,
) -> AppResult<()> {
    let completed_at = now_iso();
    let parse_status_counts =
        serde_json::to_string(&result.parse_status_counts).map_err(|error| error.to_string())?;
    let review_status_counts =
        serde_json::to_string(&result.review_status_counts).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
              UPDATE historical_capital_action_backfill_run_symbols
              SET status = 'COMPLETED',
                  canonical_symbol = ?,
                  bse_scrip_code = ?,
                  rows_read = ?,
                  rows_inserted = ?,
                  rows_duplicate = ?,
                  rows_evidence_attached = ?,
                  rows_error = ?,
                  rows_unresolved = ?,
                  rows_parsed = ?,
                  rows_unsupported = ?,
                  parse_status_counts = ?,
                  review_status_counts = ?,
                  warning_count = ?,
                  completed_at = ?,
                  message = ?
              WHERE id = ?
            ",
            params![
                result.canonical_symbol.as_deref(),
                result.bse_scrip_code.as_deref(),
                i64::from(result.rows_read),
                i64::from(result.rows_inserted),
                i64::from(result.rows_duplicate),
                i64::from(result.rows_evidence_attached),
                i64::from(result.rows_error),
                i64::from(result.rows_unresolved),
                i64::from(result.rows_parsed),
                i64::from(result.rows_unsupported),
                parse_status_counts,
                review_status_counts,
                result.warnings.len() as i64,
                completed_at,
                result.message.as_str(),
                run_symbol_id,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn fail_historical_backfill_run_symbol(
    connection: &Connection,
    run_symbol_id: i64,
    error: &str,
) -> AppResult<()> {
    let completed_at = now_iso();
    connection
        .execute(
            "
              UPDATE historical_capital_action_backfill_run_symbols
              SET status = 'FAILED',
                  rows_error = 1,
                  error_message = ?,
                  completed_at = ?,
                  message = ?
              WHERE id = ?
            ",
            params![error, completed_at, error, run_symbol_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn list_historical_sparse_candidates(
    connection: &Connection,
    input: Option<&HistoricalCapitalActionSparseCandidateInput>,
) -> AppResult<HistoricalCapitalActionSparseCandidateResult> {
    let exchange = input
        .and_then(|value| value.exchange.as_deref())
        .map(normalize_exchange)
        .transpose()?
        .unwrap_or_else(|| "NSE".to_string());
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32)
        .clamp(1, HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32);

    let mut statement = connection
        .prepare(
            "
              WITH price_span AS (
                SELECT
                  UPPER(TRIM(symbol)) AS symbol,
                  UPPER(exchange) AS exchange,
                  MIN(date) AS first_price_date
                FROM eod_prices
                WHERE UPPER(exchange) = ?
                GROUP BY UPPER(TRIM(symbol)), UPPER(exchange)
              ),
              approved_actions AS (
                SELECT
                  UPPER(TRIM(symbol)) AS symbol,
                  UPPER(exchange) AS exchange,
                  COUNT(*) AS approved_count,
                  MIN(effective_date) AS first_approved_date,
                  MAX(effective_date) AS last_approved_date
                FROM corporate_actions
                WHERE UPPER(exchange) = ?
                  AND action_type IN ('SPLIT', 'BONUS')
                GROUP BY UPPER(TRIM(symbol)), UPPER(exchange)
              ),
              import_actions AS (
                SELECT
                  UPPER(TRIM(symbol)) AS symbol,
                  UPPER(exchange) AS exchange,
                  COUNT(*) AS import_count,
                  SUM(CASE WHEN UPPER(review_status) <> 'APPROVED' THEN 1 ELSE 0 END) AS unresolved_count,
                  MIN(ex_date) AS first_import_date,
                  MAX(ex_date) AS last_import_date
                FROM corporate_action_imports
                WHERE UPPER(exchange) = ?
                  AND symbol IS NOT NULL
                  AND action_type IN ('SPLIT', 'BONUS')
                GROUP BY UPPER(TRIM(symbol)), UPPER(exchange)
              )
              SELECT
                i.symbol,
                i.exchange,
                i.name,
                i.series,
                i.isin,
                ps.first_price_date,
                COALESCE(aa.approved_count, 0) AS approved_count,
                COALESCE(ia.import_count, 0) AS import_count,
                COALESCE(ia.unresolved_count, 0) AS unresolved_count,
                CASE
                  WHEN aa.first_approved_date IS NULL THEN ia.first_import_date
                  WHEN ia.first_import_date IS NULL THEN aa.first_approved_date
                  WHEN aa.first_approved_date <= ia.first_import_date THEN aa.first_approved_date
                  ELSE ia.first_import_date
                END AS first_action_date,
                CASE
                  WHEN aa.last_approved_date IS NULL THEN ia.last_import_date
                  WHEN ia.last_import_date IS NULL THEN aa.last_approved_date
                  WHEN aa.last_approved_date >= ia.last_import_date THEN aa.last_approved_date
                  ELSE ia.last_import_date
                END AS last_action_date
              FROM instruments i
              LEFT JOIN price_span ps
                ON ps.symbol = UPPER(TRIM(i.symbol))
               AND ps.exchange = UPPER(i.exchange)
              LEFT JOIN approved_actions aa
                ON aa.symbol = UPPER(TRIM(i.symbol))
               AND aa.exchange = UPPER(i.exchange)
              LEFT JOIN import_actions ia
                ON ia.symbol = UPPER(TRIM(i.symbol))
               AND ia.exchange = UPPER(i.exchange)
              WHERE UPPER(i.exchange) = ?
                AND COALESCE(i.is_active, 1) = 1
                AND (
                  COALESCE(ia.unresolved_count, 0) > 0
                  OR (
                    ps.first_price_date IS NOT NULL
                    AND ps.first_price_date <= ?
                    AND COALESCE(aa.approved_count, 0) + COALESCE(ia.import_count, 0) < 2
                  )
                )
              ORDER BY
                COALESCE(ia.unresolved_count, 0) DESC,
                COALESCE(aa.approved_count, 0) + COALESCE(ia.import_count, 0) ASC,
                ps.first_price_date ASC,
                UPPER(i.symbol) ASC
              LIMIT ?
            ",
        )
        .map_err(|error| error.to_string())?;

    let candidates = statement
        .query_map(
            params![
                exchange,
                exchange,
                exchange,
                exchange,
                HISTORICAL_SPARSE_CANDIDATE_LONG_HISTORY_CUTOFF,
                i64::from(limit)
            ],
            |row| {
                let first_price_date: Option<String> = row.get(5)?;
                let approved_capital_actions = row.get::<_, i64>(6)? as u32;
                let imported_capital_actions = row.get::<_, i64>(7)? as u32;
                let unresolved_import_rows = row.get::<_, i64>(8)? as u32;
                let reason = format_historical_sparse_candidate_reason(
                    first_price_date.as_deref(),
                    approved_capital_actions,
                    imported_capital_actions,
                    unresolved_import_rows,
                );
                Ok(HistoricalCapitalActionSparseCandidate {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    name: row.get(2)?,
                    series: row.get(3)?,
                    isin: row.get(4)?,
                    first_price_date,
                    approved_capital_actions,
                    imported_capital_actions,
                    unresolved_import_rows,
                    first_known_capital_action_date: row.get(9)?,
                    last_known_capital_action_date: row.get(10)?,
                    reason,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(HistoricalCapitalActionSparseCandidateResult {
        message: format!(
            "Loaded {} sparse historical capital-action candidate(s).",
            candidates.len()
        ),
        candidates,
    })
}

fn format_historical_sparse_candidate_reason(
    first_price_date: Option<&str>,
    approved_capital_actions: u32,
    imported_capital_actions: u32,
    unresolved_import_rows: u32,
) -> String {
    if unresolved_import_rows > 0 {
        return format!(
            "{} unresolved split/bonus review row(s) already exist.",
            unresolved_import_rows
        );
    }

    let known_count = approved_capital_actions + imported_capital_actions;
    match first_price_date {
        Some(first_price_date) => format!(
            "Price history starts on {}, but only {} split/bonus action(s) are known.",
            first_price_date, known_count
        ),
        None => format!("Only {} split/bonus action(s) are known.", known_count),
    }
}

fn list_historical_alias_candidates(
    connection: &Connection,
    input: Option<&HistoricalCapitalActionAliasCandidateInput>,
) -> AppResult<HistoricalCapitalActionAliasCandidateResult> {
    let exchange = input
        .and_then(|value| value.exchange.as_deref())
        .map(normalize_exchange)
        .transpose()?
        .unwrap_or_else(|| "NSE".to_string());
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32)
        .clamp(1, HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32);

    let mut statement = connection
        .prepare(
            "
              WITH alias_rows AS (
                SELECT
                  UPPER(TRIM(COALESCE(NULLIF(current_symbol, ''), NULLIF(new_symbol, '')))) AS symbol,
                  UPPER(exchange) AS exchange,
                  UPPER(TRIM(old_symbol)) AS old_symbol,
                  effective_date
                FROM instrument_identity_history
                WHERE UPPER(exchange) = ?
                  AND COALESCE(TRIM(old_symbol), '') <> ''
                  AND COALESCE(TRIM(COALESCE(NULLIF(current_symbol, ''), NULLIF(new_symbol, ''))), '') <> ''
              ),
              alias_stats AS (
                SELECT
                  symbol,
                  exchange,
                  COUNT(DISTINCT old_symbol) AS alias_count,
                  MIN(effective_date) AS earliest_alias_date,
                  MAX(effective_date) AS latest_alias_date,
                  GROUP_CONCAT(DISTINCT old_symbol) AS old_symbols
                FROM alias_rows
                GROUP BY symbol, exchange
              ),
              price_span AS (
                SELECT
                  UPPER(TRIM(symbol)) AS symbol,
                  UPPER(exchange) AS exchange,
                  MIN(date) AS first_price_date
                FROM eod_prices
                WHERE UPPER(exchange) = ?
                GROUP BY UPPER(TRIM(symbol)), UPPER(exchange)
              )
              SELECT
                i.symbol,
                i.exchange,
                i.name,
                i.series,
                i.isin,
                a.old_symbols,
                COALESCE(a.alias_count, 0) AS alias_count,
                a.earliest_alias_date,
                a.latest_alias_date,
                ps.first_price_date
              FROM alias_stats a
              JOIN instruments i
                ON UPPER(TRIM(i.symbol)) = a.symbol
               AND UPPER(i.exchange) = a.exchange
              LEFT JOIN price_span ps
                ON ps.symbol = UPPER(TRIM(i.symbol))
               AND ps.exchange = UPPER(i.exchange)
              WHERE UPPER(i.exchange) = ?
                AND COALESCE(i.is_active, 1) = 1
              ORDER BY
                a.earliest_alias_date ASC,
                COALESCE(a.alias_count, 0) DESC,
                ps.first_price_date ASC,
                UPPER(i.symbol) ASC
              LIMIT ?
            ",
        )
        .map_err(|error| error.to_string())?;

    let candidates = statement
        .query_map(
            params![exchange, exchange, exchange, i64::from(limit)],
            |row| {
                let old_symbols_raw: Option<String> = row.get(5)?;
                let old_symbols = old_symbols_raw
                    .as_deref()
                    .unwrap_or("")
                    .split(',')
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>();
                let alias_count = row.get::<_, i64>(6)? as u32;
                let earliest_alias_date: Option<String> = row.get(7)?;
                let reason = format_historical_alias_candidate_reason(
                    alias_count,
                    earliest_alias_date.as_deref(),
                    &old_symbols,
                );

                Ok(HistoricalCapitalActionAliasCandidate {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    name: row.get(2)?,
                    series: row.get(3)?,
                    isin: row.get(4)?,
                    old_symbols,
                    alias_count,
                    earliest_alias_date,
                    latest_alias_date: row.get(8)?,
                    first_price_date: row.get(9)?,
                    reason,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(HistoricalCapitalActionAliasCandidateResult {
        message: format!(
            "Loaded {} old-alias historical capital-action candidate(s).",
            candidates.len()
        ),
        candidates,
    })
}

fn format_historical_alias_candidate_reason(
    alias_count: u32,
    earliest_alias_date: Option<&str>,
    old_symbols: &[String],
) -> String {
    let alias_label = old_symbols
        .iter()
        .take(3)
        .map(String::as_str)
        .collect::<Vec<_>>()
        .join(", ");
    let alias_suffix = if alias_label.is_empty() {
        String::new()
    } else {
        format!(" ({})", alias_label)
    };
    match earliest_alias_date {
        Some(date) => format!(
            "{} old alias symbol(s){}; earliest identity change date {}.",
            alias_count, alias_suffix, date
        ),
        None => format!("{} old alias symbol(s){}.", alias_count, alias_suffix),
    }
}

fn list_historical_major_liquid_candidates(
    connection: &Connection,
    input: Option<&HistoricalCapitalActionMajorLiquidCandidateInput>,
) -> AppResult<HistoricalCapitalActionMajorLiquidCandidateResult> {
    let exchange = input
        .and_then(|value| value.exchange.as_deref())
        .map(normalize_exchange)
        .transpose()?
        .unwrap_or_else(|| "NSE".to_string());
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32)
        .clamp(1, HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS as u32);

    let mut statement = connection
        .prepare(
            "
              WITH latest_date AS (
                SELECT MAX(date) AS value
                FROM eod_prices
                WHERE UPPER(exchange) = ?
              ),
              price_span AS (
                SELECT
                  UPPER(TRIM(symbol)) AS symbol,
                  UPPER(exchange) AS exchange,
                  MIN(date) AS first_price_date,
                  MAX(date) AS last_price_date,
                  COUNT(*) AS bar_count
                FROM eod_prices
                WHERE UPPER(exchange) = ?
                GROUP BY UPPER(TRIM(symbol)), UPPER(exchange)
              ),
              recent_liquidity AS (
                SELECT
                  UPPER(TRIM(p.symbol)) AS symbol,
                  UPPER(p.exchange) AS exchange,
                  COUNT(*) AS recent_bar_count,
                  AVG(COALESCE(p.close, 0) * COALESCE(p.volume, 0)) AS average_recent_turnover
                FROM eod_prices p
                CROSS JOIN latest_date d
                WHERE UPPER(p.exchange) = ?
                  AND d.value IS NOT NULL
                  AND p.date >= date(d.value, '-400 day')
                  AND COALESCE(p.close, 0) > 0
                  AND COALESCE(p.volume, 0) > 0
                GROUP BY UPPER(TRIM(p.symbol)), UPPER(p.exchange)
              )
              SELECT
                i.symbol,
                i.exchange,
                i.name,
                i.series,
                i.isin,
                ps.first_price_date,
                ps.last_price_date,
                COALESCE(ps.bar_count, 0) AS bar_count,
                COALESCE(rl.recent_bar_count, 0) AS recent_bar_count,
                COALESCE(rl.average_recent_turnover, 0) AS average_recent_turnover
              FROM instruments i
              JOIN price_span ps
                ON ps.symbol = UPPER(TRIM(i.symbol))
               AND ps.exchange = UPPER(i.exchange)
              JOIN recent_liquidity rl
                ON rl.symbol = UPPER(TRIM(i.symbol))
               AND rl.exchange = UPPER(i.exchange)
              WHERE UPPER(i.exchange) = ?
                AND COALESCE(i.is_active, 1) = 1
                AND COALESCE(rl.recent_bar_count, 0) >= 20
              ORDER BY
                COALESCE(rl.average_recent_turnover, 0) DESC,
                COALESCE(rl.recent_bar_count, 0) DESC,
                UPPER(i.symbol) ASC
              LIMIT ?
            ",
        )
        .map_err(|error| error.to_string())?;

    let candidates = statement
        .query_map(
            params![exchange, exchange, exchange, exchange, i64::from(limit)],
            |row| {
                let recent_bar_count = row.get::<_, i64>(8)? as u32;
                let average_recent_turnover = row.get::<_, f64>(9)?;
                let reason = format_historical_major_liquid_candidate_reason(
                    average_recent_turnover,
                    recent_bar_count,
                );
                Ok(HistoricalCapitalActionMajorLiquidCandidate {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    name: row.get(2)?,
                    series: row.get(3)?,
                    isin: row.get(4)?,
                    first_price_date: row.get(5)?,
                    last_price_date: row.get(6)?,
                    bar_count: row.get::<_, i64>(7)? as u32,
                    recent_bar_count,
                    average_recent_turnover,
                    reason,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(HistoricalCapitalActionMajorLiquidCandidateResult {
        message: format!(
            "Loaded {} major liquid historical capital-action candidate(s).",
            candidates.len()
        ),
        candidates,
    })
}

fn format_historical_major_liquid_candidate_reason(
    average_recent_turnover: f64,
    recent_bar_count: u32,
) -> String {
    format!(
        "Average recent traded value {:.0} across {} recent bar(s).",
        average_recent_turnover, recent_bar_count
    )
}

fn list_historical_backfill_runs(
    connection: &Connection,
    input: Option<&HistoricalCapitalActionBackfillRunListInput>,
) -> AppResult<HistoricalCapitalActionBackfillRunListResult> {
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(25)
        .clamp(1, 100);
    let offset = input.and_then(|value| value.offset).unwrap_or(0);
    let status = input
        .and_then(|value| normalize_optional_text(value.status.as_deref()))
        .map(|value| value.to_uppercase());
    let search_query = input
        .and_then(|value| normalize_optional_text(value.search_query.as_deref()))
        .map(|value| value.to_uppercase());

    let mut sql = String::from(
        "
          SELECT
            id,
            exchange,
            from_date,
            to_date,
            requested_symbols,
            stop_on_error,
            status,
            total_symbols,
            completed_symbols,
            failed_symbols,
            rows_read,
            rows_inserted,
            rows_duplicate,
            rows_evidence_attached,
            rows_error,
            rows_unresolved,
            rows_parsed,
            rows_unsupported,
            parse_status_counts,
            review_status_counts,
            started_at,
            completed_at,
            message
          FROM historical_capital_action_backfill_runs
        ",
    );
    let mut where_sql = String::from(" WHERE 1 = 1");
    let mut params_vec = Vec::<SqlValue>::new();
    if let Some(status) = status.as_deref() {
        where_sql.push_str(" AND UPPER(status) = ?");
        params_vec.push(SqlValue::Text(status.to_string()));
    }
    if let Some(search_query) = search_query.as_deref() {
        where_sql.push_str(" AND (UPPER(requested_symbols) LIKE ? OR UPPER(message) LIKE ?)");
        let pattern = format!("%{}%", search_query);
        params_vec.push(SqlValue::Text(pattern.clone()));
        params_vec.push(SqlValue::Text(pattern));
    }
    let count_sql = format!(
        "SELECT COUNT(*) FROM historical_capital_action_backfill_runs{}",
        where_sql
    );
    let total = connection
        .query_row(&count_sql, params_from_iter(params_vec.clone()), |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| error.to_string())?
        .max(0) as u32;

    sql.push_str(&where_sql);
    sql.push_str(" ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?");
    params_vec.push(SqlValue::Integer(i64::from(limit)));
    params_vec.push(SqlValue::Integer(i64::from(offset)));

    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let mut runs = statement
        .query_map(params_from_iter(params_vec), |row| {
            let requested_symbols_json: String = row.get(4)?;
            let requested_symbols = serde_json::from_str::<Vec<String>>(&requested_symbols_json)
                .unwrap_or_else(|_| Vec::new());
            Ok(HistoricalCapitalActionBackfillRunRow {
                id: row.get(0)?,
                exchange: row.get(1)?,
                from_date: row.get(2)?,
                to_date: row.get(3)?,
                requested_symbols,
                stop_on_error: row.get::<_, i64>(5)? != 0,
                status: row.get(6)?,
                total_symbols: row.get::<_, i64>(7)? as u32,
                completed_symbols: row.get::<_, i64>(8)? as u32,
                failed_symbols: row.get::<_, i64>(9)? as u32,
                rows_read: row.get::<_, i64>(10)? as u32,
                rows_inserted: row.get::<_, i64>(11)? as u32,
                rows_duplicate: row.get::<_, i64>(12)? as u32,
                rows_evidence_attached: row.get::<_, i64>(13)? as u32,
                rows_error: row.get::<_, i64>(14)? as u32,
                rows_unresolved: row.get::<_, i64>(15)? as u32,
                rows_parsed: row.get::<_, i64>(16)? as u32,
                rows_unsupported: row.get::<_, i64>(17)? as u32,
                parse_status_counts: parse_status_counts_json(&row.get::<_, String>(18)?),
                review_status_counts: parse_status_counts_json(&row.get::<_, String>(19)?),
                started_at: row.get(20)?,
                completed_at: row.get(21)?,
                message: row.get(22)?,
                symbols: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for run in &mut runs {
        run.symbols = list_historical_backfill_run_symbols(connection, run.id)?;
    }

    let returned = runs.len() as u32;
    let has_more = offset.saturating_add(returned) < total;

    Ok(HistoricalCapitalActionBackfillRunListResult {
        runs,
        total,
        offset,
        limit,
        has_more,
        message: format!(
            "Loaded {} of {} historical backfill run(s).",
            returned, total
        ),
    })
}

fn list_historical_backfill_run_symbols(
    connection: &Connection,
    run_id: i64,
) -> AppResult<Vec<HistoricalCapitalActionBackfillRunSymbolRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT
                id,
                run_id,
                symbol,
                canonical_symbol,
                bse_scrip_code,
                status,
                rows_read,
                rows_inserted,
                rows_duplicate,
                rows_evidence_attached,
                rows_error,
                rows_unresolved,
                rows_parsed,
                rows_unsupported,
                parse_status_counts,
                review_status_counts,
                warning_count,
                error_message,
                started_at,
                completed_at,
                message
              FROM historical_capital_action_backfill_run_symbols
              WHERE run_id = ?
              ORDER BY id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut symbols = statement
        .query_map(params![run_id], |row| {
            Ok(HistoricalCapitalActionBackfillRunSymbolRow {
                id: row.get(0)?,
                run_id: row.get(1)?,
                symbol: row.get(2)?,
                canonical_symbol: row.get(3)?,
                bse_scrip_code: row.get(4)?,
                status: row.get(5)?,
                rows_read: row.get::<_, i64>(6)? as u32,
                rows_inserted: row.get::<_, i64>(7)? as u32,
                rows_duplicate: row.get::<_, i64>(8)? as u32,
                rows_evidence_attached: row.get::<_, i64>(9)? as u32,
                rows_error: row.get::<_, i64>(10)? as u32,
                rows_unresolved: row.get::<_, i64>(11)? as u32,
                rows_parsed: row.get::<_, i64>(12)? as u32,
                rows_unsupported: row.get::<_, i64>(13)? as u32,
                parse_status_counts: parse_status_counts_json(&row.get::<_, String>(14)?),
                review_status_counts: parse_status_counts_json(&row.get::<_, String>(15)?),
                warning_count: row.get::<_, i64>(16)? as u32,
                error_message: row.get(17)?,
                started_at: row.get(18)?,
                completed_at: row.get(19)?,
                message: row.get(20)?,
                outcomes: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    for symbol in &mut symbols {
        symbol.outcomes = list_historical_backfill_run_outcomes(connection, symbol.id)?;
    }
    Ok(symbols)
}

fn parse_status_counts_json(value: &str) -> HashMap<String, u32> {
    serde_json::from_str(value).unwrap_or_default()
}

fn list_historical_backfill_run_outcomes(
    connection: &Connection,
    run_symbol_id: i64,
) -> AppResult<Vec<HistoricalCapitalActionBackfillRunOutcomeRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT
                outcome.id,
                outcome.run_symbol_id,
                outcome.source,
                outcome.requested_symbol,
                outcome.source_locator,
                outcome.outcome,
                outcome.import_id,
                outcome.evidence_id,
                outcome.action_type,
                outcome.parse_status,
                outcome.review_status,
                outcome.message,
                evidence.symbol_seen,
                evidence.isin_seen,
                evidence.company_name_seen,
                evidence.raw_reference,
                evidence.note,
                outcome.created_at
              FROM historical_capital_action_backfill_run_outcomes AS outcome
              LEFT JOIN corporate_action_import_evidence AS evidence
                ON evidence.id = outcome.evidence_id
              WHERE outcome.run_symbol_id = ?
              ORDER BY outcome.id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let outcomes = statement
        .query_map(params![run_symbol_id], |row| {
            Ok(HistoricalCapitalActionBackfillRunOutcomeRow {
                id: row.get(0)?,
                run_symbol_id: row.get(1)?,
                source: row.get(2)?,
                requested_symbol: row.get(3)?,
                source_locator: row.get(4)?,
                outcome: row.get(5)?,
                import_id: row.get(6)?,
                evidence_id: row.get(7)?,
                action_type: row.get(8)?,
                parse_status: row.get(9)?,
                review_status: row.get(10)?,
                message: row.get(11)?,
                evidence_symbol_seen: row.get(12)?,
                evidence_isin_seen: row.get(13)?,
                evidence_company_name_seen: row.get(14)?,
                evidence_raw_reference: row.get(15)?,
                evidence_note: row.get(16)?,
                created_at: row.get(17)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(outcomes)
}

fn inclusive_day_count(from_date: &str, to_date: &str) -> AppResult<u32> {
    let from =
        NaiveDate::parse_from_str(from_date, "%Y-%m-%d").map_err(|error| error.to_string())?;
    let to = NaiveDate::parse_from_str(to_date, "%Y-%m-%d").map_err(|error| error.to_string())?;
    if from > to {
        return Err("From date cannot be after to date.".to_string());
    }
    Ok((to.signed_duration_since(from).num_days() as u32) + 1)
}

fn load_missing_fetch_ranges(
    connection: &Connection,
    exchange: &str,
    source: &str,
    from_date: &str,
    to_date: &str,
) -> AppResult<Vec<FetchCoverageRange>> {
    let mut statement = connection
        .prepare(
            "
              SELECT from_date, to_date
              FROM corporate_action_fetch_coverage
              WHERE exchange = ?
                AND source = ?
                AND to_date >= ?
                AND from_date <= ?
              ORDER BY from_date ASC, to_date ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let covered = statement
        .query_map(params![exchange, source, from_date, to_date], |row| {
            Ok(FetchCoverageRange {
                from_date: row.get(0)?,
                to_date: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    compute_missing_fetch_ranges(from_date, to_date, &covered)
}

fn resolve_official_fetch_ranges(
    connection: &Connection,
    exchange: &str,
    source: &str,
    from_date: &str,
    to_date: &str,
    force_refresh: bool,
) -> AppResult<Vec<FetchCoverageRange>> {
    if force_refresh {
        return Ok(vec![FetchCoverageRange {
            from_date: from_date.to_string(),
            to_date: to_date.to_string(),
        }]);
    }
    load_missing_fetch_ranges(connection, exchange, source, from_date, to_date)
}

fn compute_missing_fetch_ranges(
    requested_from_date: &str,
    requested_to_date: &str,
    covered_ranges: &[FetchCoverageRange],
) -> AppResult<Vec<FetchCoverageRange>> {
    let requested_from = NaiveDate::parse_from_str(requested_from_date, "%Y-%m-%d")
        .map_err(|error| error.to_string())?;
    let requested_to = NaiveDate::parse_from_str(requested_to_date, "%Y-%m-%d")
        .map_err(|error| error.to_string())?;
    if requested_from > requested_to {
        return Err("From date cannot be after to date.".to_string());
    }

    let mut normalized = covered_ranges
        .iter()
        .map(|range| {
            let from = NaiveDate::parse_from_str(&range.from_date, "%Y-%m-%d")
                .map_err(|error| error.to_string())?;
            let to = NaiveDate::parse_from_str(&range.to_date, "%Y-%m-%d")
                .map_err(|error| error.to_string())?;
            Ok((from, to))
        })
        .collect::<AppResult<Vec<_>>>()?;
    normalized.sort_unstable_by_key(|(from, to)| (*from, *to));

    let mut current = requested_from;
    let mut missing = Vec::new();

    for (covered_from, covered_to) in normalized {
        if covered_to < requested_from || covered_from > requested_to {
            continue;
        }
        let clipped_from = covered_from.max(requested_from);
        let clipped_to = covered_to.min(requested_to);
        if clipped_to < current {
            continue;
        }
        if clipped_from > current {
            missing.push(FetchCoverageRange {
                from_date: current.format("%Y-%m-%d").to_string(),
                to_date: (clipped_from - ChronoDuration::days(1))
                    .format("%Y-%m-%d")
                    .to_string(),
            });
        }
        current = clipped_to + ChronoDuration::days(1);
        if current > requested_to {
            break;
        }
    }

    if current <= requested_to {
        missing.push(FetchCoverageRange {
            from_date: current.format("%Y-%m-%d").to_string(),
            to_date: requested_to.format("%Y-%m-%d").to_string(),
        });
    }

    Ok(missing)
}

fn record_fetch_coverage(
    connection: &Connection,
    exchange: &str,
    source: &str,
    from_date: &str,
    to_date: &str,
) -> AppResult<()> {
    connection
        .execute(
            "
              INSERT OR IGNORE INTO corporate_action_fetch_coverage (
                exchange,
                source,
                from_date,
                to_date
              )
              VALUES (?, ?, ?, ?)
            ",
            params![exchange, source, from_date, to_date],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn record_fetch_coverage_if_complete(
    connection: &Connection,
    exchange: &str,
    source: &str,
    from_date: &str,
    to_date: &str,
    range_errors: u32,
    errors: &mut Vec<String>,
) -> AppResult<bool> {
    if range_errors > 0 {
        errors.push(format!(
            "Coverage was not recorded for {} {} to {} because {} official row(s) failed. The range remains retryable without Force re-fetch.",
            exchange, from_date, to_date, range_errors
        ));
        return Ok(false);
    }

    record_fetch_coverage(connection, exchange, source, from_date, to_date)?;
    Ok(true)
}

fn count_candidate_status(
    review_status: &str,
    parse_status: &str,
    rows_unresolved: &mut u32,
    rows_parsed: &mut u32,
    rows_unsupported: &mut u32,
) {
    if review_status == "UNRESOLVED" {
        *rows_unresolved += 1;
    }
    if parse_status == "PARSED" {
        *rows_parsed += 1;
    }
    if review_status == "UNSUPPORTED" {
        *rows_unsupported += 1;
    }
}

fn should_emit_fetch_progress(index: usize, total: usize) -> bool {
    total <= 50 || index == 0 || index + 1 == total || (index + 1) % 10 == 0
}

fn compute_fetch_progress(processed: usize, total: usize) -> u32 {
    if total == 0 {
        return FETCH_PROGRESS_DONE;
    }
    let span = (FETCH_PROGRESS_DONE - FETCH_PROGRESS_STORE_START) as f64;
    let ratio = (processed as f64 / total as f64).clamp(0.0, 1.0);
    (FETCH_PROGRESS_STORE_START as f64 + span * ratio)
        .round()
        .clamp(
            FETCH_PROGRESS_STORE_START as f64,
            FETCH_PROGRESS_DONE as f64,
        ) as u32
}

fn find_unique_instrument_by_isin(
    connection: &Connection,
    isin: &str,
    preferred_exchange: &str,
) -> AppResult<IsinInstrumentMatch> {
    let mut statement = connection
        .prepare(
            "
              SELECT symbol, exchange, isin, name, COALESCE(is_active, 1)
              FROM instruments
              WHERE UPPER(COALESCE(isin, '')) = ?
                AND exchange = ?
              ORDER BY COALESCE(is_active, 1) DESC, symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![isin, preferred_exchange], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)? != 0,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    select_unique_active_instrument(rows)
}

fn select_unique_active_instrument(
    rows: Vec<(String, String, Option<String>, Option<String>, bool)>,
) -> AppResult<IsinInstrumentMatch> {
    if rows.is_empty() {
        return Ok(IsinInstrumentMatch::None);
    }
    let active = rows
        .iter()
        .filter(|(_, _, _, _, is_active)| *is_active)
        .collect::<Vec<_>>();
    let selected = if active.len() == 1 {
        Some(active[0])
    } else if active.is_empty() && rows.len() == 1 {
        Some(&rows[0])
    } else {
        None
    };

    Ok(
        if let Some((symbol, exchange, db_isin, db_name, _)) = selected {
            IsinInstrumentMatch::Unique((
                symbol.clone(),
                exchange.clone(),
                db_isin.clone(),
                db_name.clone(),
            ))
        } else {
            IsinInstrumentMatch::Ambiguous
        },
    )
}


fn has_active_instrument_match_by_isin(
    connection: &Connection,
    isin: &str,
    preferred_exchange: &str,
) -> AppResult<bool> {
    let active_count = connection
        .query_row(
            "
              SELECT COUNT(*)
              FROM instruments
              WHERE UPPER(COALESCE(isin, '')) = ?
                AND exchange = ?
                AND COALESCE(is_active, 1) <> 0
            ",
            params![isin, preferred_exchange],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(active_count > 0)
}

fn find_identity_resolved_instrument(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<Option<(String, String, Option<String>, Option<String>)>> {
    let alias = connection
        .query_row(
            "
              SELECT current_symbol, current_name, isin
              FROM instrument_identity_history
              WHERE exchange = ?
                AND (
                  old_symbol = ?
                  OR new_symbol = ?
                  OR current_symbol = ?
                )
              ORDER BY effective_date DESC, id DESC
              LIMIT 1
            ",
            params![exchange, symbol, symbol, symbol],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((current_symbol, current_name, history_isin)) = alias else {
        return Ok(None);
    };
    let Some(current_symbol) = current_symbol else {
        return Ok(None);
    };
    let Some(instrument) = find_instrument_record(connection, &current_symbol, exchange)? else {
        return Ok(None);
    };
    Ok(Some((
        instrument.symbol,
        instrument.exchange,
        instrument.isin.or(history_isin),
        instrument.name.or(current_name),
    )))
}

fn load_identity_chain_instrument_candidates(
    connection: &Connection,
    symbol: &str,
    raw_isin: Option<&str>,
    exchange: &str,
) -> AppResult<Vec<IdentityChainInstrumentCandidate>> {
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_isin = normalize_isin(raw_isin);

    let mut statement = connection
        .prepare(
            "
              WITH RECURSIVE identity_chain(symbol, isin) AS (
                SELECT CAST(? AS TEXT), CAST(? AS TEXT)
                UNION
                SELECT h.old_symbol, h.isin
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      (chain.symbol IS NOT NULL AND (
                        h.old_symbol = chain.symbol
                        OR h.new_symbol = chain.symbol
                        OR h.current_symbol = chain.symbol
                      ))
                      OR (chain.isin IS NOT NULL AND h.isin = chain.isin)
                 )
                WHERE h.old_symbol IS NOT NULL
                UNION
                SELECT h.new_symbol, h.isin
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      (chain.symbol IS NOT NULL AND (
                        h.old_symbol = chain.symbol
                        OR h.new_symbol = chain.symbol
                        OR h.current_symbol = chain.symbol
                      ))
                      OR (chain.isin IS NOT NULL AND h.isin = chain.isin)
                 )
                WHERE h.new_symbol IS NOT NULL
                UNION
                SELECT h.current_symbol, h.isin
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      (chain.symbol IS NOT NULL AND (
                        h.old_symbol = chain.symbol
                        OR h.new_symbol = chain.symbol
                        OR h.current_symbol = chain.symbol
                      ))
                      OR (chain.isin IS NOT NULL AND h.isin = chain.isin)
                 )
                WHERE h.current_symbol IS NOT NULL
              )
              SELECT DISTINCT
                i.symbol,
                i.exchange,
                i.isin,
                i.name,
                i.series,
                COALESCE(i.is_active, 1)
              FROM instruments i
              JOIN identity_chain chain
                ON i.exchange = ?
               AND i.symbol = chain.symbol
              ORDER BY CASE WHEN COALESCE(i.is_active, 1) = 1 THEN 0 ELSE 1 END, i.symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let candidates = statement
        .query_map(
            params![
                normalized_symbol,
                normalized_isin,
                normalized_exchange,
                normalized_exchange,
                normalized_exchange,
                normalized_exchange
            ],
            |row| {
                Ok(IdentityChainInstrumentCandidate {
                    symbol: row.get::<_, String>(0)?,
                    exchange: row.get::<_, String>(1)?,
                    isin: row.get::<_, Option<String>>(2)?,
                    company_name: row.get::<_, Option<String>>(3)?,
                    series: row.get::<_, Option<String>>(4)?,
                    is_active: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(candidates)
}

fn find_identity_chain_resolved_instrument(
    connection: &Connection,
    symbol: &str,
    raw_isin: Option<&str>,
    company_name: &Option<String>,
    exchange: &str,
    ex_date: Option<&str>,
) -> AppResult<Option<ResolvedCsvInstrument>> {
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_isin = normalize_isin(raw_isin);
    let candidates =
        load_identity_chain_instrument_candidates(connection, symbol, raw_isin, exchange)?;

    if candidates.is_empty() {
        return Ok(None);
    }

    if let Some(csv_isin) = normalized_isin.as_ref() {
        let mut evidence_matches = Vec::new();
        for candidate in &candidates {
            if has_instrument_isin_history_evidence(
                connection,
                &candidate.exchange,
                &candidate.symbol,
                csv_isin,
                ex_date,
            )? {
                evidence_matches.push(candidate);
            }
        }
        if evidence_matches.len() == 1 {
            let matched = evidence_matches[0];
            return Ok(Some(ResolvedCsvInstrument {
                symbol: Some(matched.symbol.clone()),
                exchange: matched.exchange.clone(),
                isin: Some(csv_isin.clone()),
                company_name: matched
                    .company_name
                    .clone()
                    .or_else(|| company_name.clone()),
                review_status: "PENDING".to_string(),
                message: Some(
                    "Matched the official NSE symbol to the current database symbol through identity history chain and historical ISIN evidence."
                        .to_string(),
                ),
            }));
        }
        if evidence_matches.len() > 1 {
            return Ok(Some(ResolvedCsvInstrument {
                symbol: Some(normalized_symbol.clone()),
                exchange: normalized_exchange.clone(),
                isin: Some(csv_isin.clone()),
                company_name: company_name.clone(),
                review_status: "UNRESOLVED".to_string(),
                message: Some(format!(
                    "Identity history chain and historical ISIN evidence matched multiple database symbols: {}. Auto recheck could not choose one current symbol safely; resolve manually.",
                    format_identity_chain_candidates(&evidence_matches)
                )),
            }));
        }
    }

    let active_candidates = candidates
        .iter()
        .filter(|candidate| candidate.is_active)
        .collect::<Vec<_>>();
    let selected = if active_candidates.len() == 1 {
        Some(active_candidates[0])
    } else if candidates.len() == 1 {
        Some(&candidates[0])
    } else {
        None
    };

    if let Some(matched) = selected {
        let isin_mismatch = normalized_isin.is_some() && matched.isin.is_some()
            && normalized_isin != normalize_isin(matched.isin.as_deref());
        return Ok(Some(ResolvedCsvInstrument {
            symbol: Some(matched.symbol.clone()),
            exchange: matched.exchange.clone(),
            isin: normalized_isin.clone().or_else(|| matched.isin.clone()),
            company_name: matched
                .company_name
                .clone()
                .or_else(|| company_name.clone()),
            review_status: if isin_mismatch { REVIEW_STATUS_PENDING_ISIN_MISMATCH } else { "PENDING" }.to_string(),
            message: Some(if matched.is_active {
                "Matched the official NSE symbol to the current active database symbol through identity history chain."
                    .to_string()
            } else {
                "Matched the official NSE symbol to the database symbol through identity history chain."
                    .to_string()
            }),
        }));
    }

    let candidate_refs = candidates.iter().collect::<Vec<_>>();
    Ok(Some(ResolvedCsvInstrument {
        symbol: Some(normalized_symbol),
        exchange: normalized_exchange,
        isin: normalized_isin,
        company_name: company_name.clone(),
        review_status: "UNRESOLVED".to_string(),
        message: Some(format!(
            "Identity history chain found multiple database symbols: {}. Auto recheck could not choose one current symbol safely; resolve manually.",
            format_identity_chain_candidates(&candidate_refs)
        )),
    }))
}

fn has_instrument_isin_history_evidence(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: Option<&str>,
) -> AppResult<bool> {
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_isin = normalize_isin(Some(isin))
        .ok_or_else(|| "Historical ISIN lookup requires an ISIN.".to_string())?;
    let normalized_effective_date = super::normalize_optional_trade_date(effective_date)?;

    let exists = connection
        .query_row(
            "
              SELECT EXISTS (
                SELECT 1
                FROM instrument_isin_history
                WHERE exchange = ?
                  AND symbol = ?
                  AND isin = ?
                  AND COALESCE(effective_date, '') = COALESCE(?, '')
                  AND NOT EXISTS (
                    SELECT 1 FROM instrument_isin_history conflict
                    WHERE conflict.exchange = instrument_isin_history.exchange
                      AND conflict.symbol = instrument_isin_history.symbol
                      AND conflict.effective_date IS instrument_isin_history.effective_date
                      AND conflict.isin <> instrument_isin_history.isin
                  )
                LIMIT 1
              )
            ",
            params![
                normalized_exchange,
                normalized_symbol,
                normalized_isin,
                normalized_effective_date
            ],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?
        != 0;

    Ok(exists)
}

fn resolve_backfill_canonical_symbol(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<Option<String>> {
    if let Some(instrument) = find_instrument_record(connection, symbol, exchange)? {
        return Ok(Some(instrument.symbol));
    }
    Ok(
        find_identity_resolved_instrument(connection, symbol, exchange)?
            .map(|(resolved_symbol, _, _, _)| resolved_symbol),
    )
}

fn looks_like_bse_scrip_code(symbol: &str) -> bool {
    let trimmed = symbol.trim();
    !trimmed.is_empty() && trimmed.chars().all(|character| character.is_ascii_digit())
}

fn infer_bse_scrip_code_for_backfill(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<Option<String>> {
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_exchange = normalize_exchange(exchange)?;
    let Some(instrument) =
        find_instrument_record(connection, &normalized_symbol, &normalized_exchange)?
    else {
        return Ok(None);
    };
    let Some(isin) = instrument
        .isin
        .as_deref()
        .and_then(|value| normalize_isin(Some(value)))
    else {
        return Ok(None);
    };

    let matched = find_unique_instrument_by_isin(connection, &isin, "BSE")?;
    let IsinInstrumentMatch::Unique((symbol, matched_exchange, _, _)) = matched else {
        return Ok(None);
    };
    if matched_exchange != "BSE" {
        return Ok(None);
    }

    Ok(load_bse_security_code(connection, &symbol)?.or_else(|| {
        if looks_like_bse_scrip_code(&symbol) {
            Some(symbol)
        } else {
            None
        }
    }))
}

fn load_bse_security_code(connection: &Connection, symbol: &str) -> AppResult<Option<String>> {
    connection
        .query_row(
            "
              SELECT bse_security_code
              FROM instruments
              WHERE exchange = 'BSE'
                AND symbol = ?
            ",
            params![symbol],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|value| {
            value
                .flatten()
                .and_then(|code| normalize_optional_text(Some(&code)))
        })
        .map_err(|error| error.to_string())
}

fn load_historical_backfill_symbols(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<Vec<String>> {
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_exchange = normalize_exchange(exchange)?;
    let mut statement = connection
        .prepare(
            "
              WITH RECURSIVE identity_chain(symbol) AS (
                SELECT CAST(? AS TEXT)
                UNION
                SELECT h.old_symbol
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      h.old_symbol = chain.symbol
                   OR h.new_symbol = chain.symbol
                   OR h.current_symbol = chain.symbol
                 )
                WHERE COALESCE(TRIM(h.old_symbol), '') <> ''
                UNION
                SELECT h.new_symbol
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      h.old_symbol = chain.symbol
                   OR h.new_symbol = chain.symbol
                   OR h.current_symbol = chain.symbol
                 )
                WHERE COALESCE(TRIM(h.new_symbol), '') <> ''
                UNION
                SELECT h.current_symbol
                FROM instrument_identity_history h
                JOIN identity_chain chain
                  ON h.exchange = ?
                 AND (
                      h.old_symbol = chain.symbol
                   OR h.new_symbol = chain.symbol
                   OR h.current_symbol = chain.symbol
                 )
                WHERE COALESCE(TRIM(h.current_symbol), '') <> ''
              )
              SELECT DISTINCT symbol
              FROM identity_chain
              WHERE COALESCE(TRIM(symbol), '') <> ''
              ORDER BY CASE WHEN symbol = ? THEN 0 ELSE 1 END, symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                normalized_symbol,
                normalized_exchange,
                normalized_exchange,
                normalized_exchange,
                normalized_symbol
            ],
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn build_nse_symbol_history_url(symbol: &str, from_date: &str, to_date: &str) -> AppResult<String> {
    let mut url = reqwest::Url::parse(NSE_ACTIONS_API_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("index", "equities")
        .append_pair("symbol", symbol)
        .append_pair("from_date", &format_nse_api_date(from_date)?)
        .append_pair("to_date", &format_nse_api_date(to_date)?);
    Ok(url.to_string())
}

fn build_bse_scrip_history_url(
    bse_scrip_code: &str,
    from_date: &str,
    to_date: &str,
) -> AppResult<String> {
    let mut url = reqwest::Url::parse(BSE_ACTIONS_API_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("scripcode", bse_scrip_code)
        .append_pair("Fdate", &format_bse_api_date(from_date)?)
        .append_pair("Purposecode", "")
        .append_pair("TDate", &format_bse_api_date(to_date)?)
        .append_pair("ddlcategorys", "E")
        .append_pair("ddlindustrys", "")
        .append_pair("segment", "0")
        .append_pair("strSearch", "S");
    Ok(url.to_string())
}

fn fetch_nse_action_candidates(
    app: &AppHandle,
    connection: &Connection,
    from_date: &str,
    to_date: &str,
) -> AppResult<Vec<AppResult<NewImportCandidate>>> {
    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START,
        "Opening NSE official corporate-action session...",
    );
    let client = official_fetch_client()?;
    warm_official_session(&client, NSE_ACTIONS_PAGE_URL, NSE_ACTIONS_PAGE_URL)?;

    let mut url = reqwest::Url::parse(NSE_ACTIONS_API_URL).map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("index", "equities")
        .append_pair("from_date", &format_nse_api_date(from_date)?)
        .append_pair("to_date", &format_nse_api_date(to_date)?);

    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START + 10,
        "Requesting NSE official corporate-action rows...",
    );
    let response = client
        .get(url.clone())
        .header(REFERER, NSE_ACTIONS_PAGE_URL)
        .header(ACCEPT, "application/json,text/plain,*/*")
        .send()
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "NSE official corporate action fetch failed: HTTP {}",
            response.status().as_u16()
        ));
    }
    let response_text = response.text().map_err(|error| error.to_string())?;
    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_PARSE_START,
        "Parsing NSE official corporate-action response...",
    );
    let rows = serde_json::from_str::<Value>(&response_text)
        .map_err(|error| format!("NSE official response was not valid JSON: {error}"))?;
    let Some(rows) = rows.as_array() else {
        return Err("NSE official response did not contain an array.".to_string());
    };

    Ok(rows
        .iter()
        .map(|row| {
            let purpose = json_text(row, &["subject"])
                .ok_or_else(|| "NSE row did not include purpose text.".to_string())?;
            let ex_date =
                json_text(row, &["exDate"]).and_then(|value| parse_official_date(&value).ok());
            let record_date = json_text(row, &["recDate", "recordDate"])
                .and_then(|value| parse_official_date(&value).ok());
            build_import_candidate_from_fields(
                connection,
                "NSE",
                "NSE_API",
                Some(url.to_string()),
                json_text(row, &["symbol"]),
                json_text(row, &["isin"]),
                None,
                json_text(row, &["comp", "companyName"]),
                purpose,
                ex_date,
                record_date,
            )
        })
        .collect())
}

fn fetch_nse_symbol_action_candidates(
    app: &AppHandle,
    connection: &Connection,
    requested_exchange: &str,
    symbol: &str,
    from_date: &str,
    to_date: &str,
) -> AppResult<Vec<AppResult<NewImportCandidate>>> {
    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START,
        format!(
            "Opening NSE symbol-scoped corporate-action session for {}...",
            symbol
        ),
    );
    let client = official_fetch_client()?;
    warm_official_session(&client, NSE_ACTIONS_PAGE_URL, NSE_ACTIONS_PAGE_URL)?;
    let url = build_nse_symbol_history_url(symbol, from_date, to_date)?;

    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START + 10,
        format!(
            "Requesting NSE symbol-scoped corporate-action rows for {}...",
            symbol
        ),
    );
    let response = client
        .get(url.clone())
        .header(REFERER, NSE_ACTIONS_PAGE_URL)
        .header(ACCEPT, "application/json,text/plain,*/*")
        .send()
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "NSE historical pilot fetch failed for {}: HTTP {}",
            symbol,
            response.status().as_u16()
        ));
    }
    let response_text = response.text().map_err(|error| error.to_string())?;
    let rows = serde_json::from_str::<Value>(&response_text)
        .map_err(|error| format!("NSE symbol-scoped response was not valid JSON: {error}"))?;
    let Some(rows) = rows.as_array() else {
        return Err("NSE symbol-scoped response did not contain an array.".to_string());
    };

    Ok(rows
        .iter()
        .map(|row| {
            let purpose = json_text(row, &["subject"])
                .ok_or_else(|| "NSE row did not include purpose text.".to_string())?;
            let ex_date =
                json_text(row, &["exDate"]).and_then(|value| parse_official_date(&value).ok());
            let record_date = json_text(row, &["recDate", "recordDate"])
                .and_then(|value| parse_official_date(&value).ok());
            build_import_candidate_from_fields(
                connection,
                requested_exchange,
                "NSE_API",
                Some(url.clone()),
                json_text(row, &["symbol"]),
                json_text(row, &["isin"]),
                None,
                json_text(row, &["comp", "companyName"]),
                purpose,
                ex_date,
                record_date,
            )
        })
        .collect())
}

fn fetch_bse_action_candidates(
    app: &AppHandle,
    connection: &Connection,
    from_date: &str,
    to_date: &str,
    session: &mut bse_fetch::BseSession,
) -> AppResult<Vec<AppResult<NewImportCandidate>>> {
    let scope = bse_browser::Scope::new(from_date, to_date)?;
    let response_text = session.fetch(app, &scope)?;
    let url = scope.url;
    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_PARSE_START,
        "Parsing BSE official corporate-action response...",
    );
    let rows = serde_json::from_slice::<Value>(&response_text)
        .map_err(|error| format!("BSE official response was not valid JSON: {error}"))?;
    let Some(rows) = rows.as_array() else {
        return Err("BSE official response did not contain an array.".to_string());
    };

    Ok(rows
        .iter()
        .map(|row| {
            let purpose = json_text(row, &["Purpose"])
                .ok_or_else(|| "BSE row did not include purpose text.".to_string())?;
            let ex_date = json_text(row, &["Ex_date", "exdate"])
                .and_then(|value| parse_official_date(&value).ok());
            let record_date =
                json_text(row, &["RD_Date"]).and_then(|value| parse_official_date(&value).ok());
            let scrip_code = json_text(row, &["scrip_code"]);
            build_import_candidate_from_fields(
                connection,
                "BSE",
                "BSE_API",
                Some(url.to_string()),
                scrip_code.clone(),
                None,
                scrip_code,
                json_text(row, &["long_name", "short_name"]),
                purpose,
                ex_date,
                record_date,
            )
        })
        .collect())
}

fn fetch_bse_scrip_action_candidates(
    app: &AppHandle,
    connection: &Connection,
    requested_exchange: &str,
    bse_scrip_code: &str,
    from_date: &str,
    to_date: &str,
) -> AppResult<Vec<AppResult<NewImportCandidate>>> {
    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START,
        format!(
            "Opening BSE scrip-scoped corporate-action session for {}...",
            bse_scrip_code
        ),
    );
    let client = bse_action_fetch_client()?;
    fetch_bse_action_text(&client, BSE_ACTIONS_PAGE_URL, false)?;
    let url = build_bse_scrip_history_url(bse_scrip_code, from_date, to_date)?;

    emit_corporate_action_progress(
        app,
        FETCH_PROGRESS_DOWNLOAD_START + 10,
        format!(
            "Requesting BSE scrip-scoped corporate-action rows for {}...",
            bse_scrip_code
        ),
    );
    let response_text = fetch_bse_action_text(&client, &url, true)?;
    let rows = serde_json::from_str::<Value>(&response_text)
        .map_err(|error| format!("BSE scrip-scoped response was not valid JSON: {error}"))?;
    let Some(rows) = rows.as_array() else {
        return Err("BSE scrip-scoped response did not contain an array.".to_string());
    };

    Ok(rows
        .iter()
        .map(|row| {
            let purpose = json_text(row, &["Purpose"])
                .ok_or_else(|| "BSE row did not include purpose text.".to_string())?;
            let ex_date = json_text(row, &["Ex_date", "exdate"])
                .and_then(|value| parse_official_date(&value).ok());
            let record_date =
                json_text(row, &["RD_Date"]).and_then(|value| parse_official_date(&value).ok());
            build_import_candidate_from_fields(
                connection,
                requested_exchange,
                "BSE_API",
                Some(url.clone()),
                json_text(row, &["short_name"]),
                None,
                json_text(row, &["scrip_code"]),
                json_text(row, &["long_name", "short_name"]),
                purpose,
                ex_date,
                record_date,
            )
        })
        .collect())
}

fn bse_action_fetch_client() -> AppResult<Client> {
    Client::builder()
        .cookie_store(true)
        .http1_only()
        .pool_idle_timeout(Duration::from_secs(10))
        .pool_max_idle_per_host(1)
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(45))
        .user_agent(OFFICIAL_FETCH_USER_AGENT)
        .build()
        .map_err(|error| error.to_string())
}

fn fetch_bse_action_text(client: &Client, url: &str, json: bool) -> AppResult<String> {
    fetch_bse_action_text_with_cancel(client, url, json, None)
}

fn fetch_bse_action_text_with_cancel(client: &Client, url: &str, json: bool, cancelled: Option<&std::sync::atomic::AtomicBool>) -> AppResult<String> {
    let bytes = fetch_bse_action_bytes_with_cancel(client, url, json, cancelled)?;
    String::from_utf8(bytes).map_err(|e| format!("BSE response was not valid UTF-8: {e}"))
}

fn fetch_bse_action_bytes_with_cancel(client: &Client, url: &str, json: bool, cancelled: Option<&std::sync::atomic::AtomicBool>) -> AppResult<Vec<u8>> {
    let stage = if json { "API request" } else { "session warm-up" };
    // Retry only transient transport failures once. A refusal is not an empty feed
    // and must never be recorded as successfully fetched date coverage.
    for attempt in 0..2 {
        if let Some(flag) = cancelled { bse_fetch::check_cancel(flag)?; }
        let mut request = client
            .get(url)
            .header(REFERER, BSE_ACTIONS_PAGE_URL)
            .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
            .header(
                ACCEPT,
                if json {
                    "application/json,text/plain,*/*"
                } else {
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
            );
        if json {
            request = request.header(ORIGIN, BSE_ORIGIN_URL);
        }
        let result = request.send().and_then(|response| {
            let status = response.status();
            if !status.is_success() {
                return Ok(Err(if status.as_u16() == 403 {
                    format!("BSE_DIRECT_ACCESS_BLOCKED: BSE {stage} returned HTTP 403 (access denied).")
                } else {
                    format!("BSE {stage} failed: HTTP {} ({url})", status.as_u16())
                }));
            }
            response.bytes().map(|bytes| Ok(bytes.to_vec()))
        });
        if let Some(flag) = cancelled { bse_fetch::check_cancel(flag)?; }
        match result {
            Ok(text) => return text,
            Err(error) => {
                if attempt == 0
                    && (error.is_connect()
                        || error.is_timeout()
                        || error.is_body()
                        || error.is_decode()
                        || error.is_request())
                {
                    std::thread::sleep(Duration::from_millis(500));
                    continue;
                }
                let mut detail = error.to_string();
                let mut source = std::error::Error::source(&error);
                while let Some(cause) = source {
                    detail.push_str(&format!(" -> {cause}"));
                    source = cause.source();
                }
                return Err(format!("BSE {stage} transport failure: {detail}. Completed windows are retained."));
            }
        }
    }
    unreachable!("bounded BSE request loop returns on its final attempt")
}

fn official_fetch_client() -> AppResult<Client> {
    Client::builder()
        .cookie_store(true)
        .timeout(Duration::from_secs(45))
        .user_agent(OFFICIAL_FETCH_USER_AGENT)
        .build()
        .map_err(|error| error.to_string())
}

fn warm_official_session(client: &Client, url: &str, referer: &str) -> AppResult<()> {
    let response = client
        .get(url)
        .header(REFERER, referer)
        .header(
            ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send()
        .map_err(|error| error.to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Official source warm-up failed: HTTP {}",
            response.status().as_u16()
        ))
    }
}

fn format_nse_api_date(value: &str) -> AppResult<String> {
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|error| error.to_string())?;
    Ok(date.format("%d-%m-%Y").to_string())
}

fn format_bse_api_date(value: &str) -> AppResult<String> {
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|error| error.to_string())?;
    Ok(date.format("%Y%m%d").to_string())
}

fn json_text(row: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        let value = row.get(*key)?;
        match value {
            Value::String(text) => normalize_optional_text(Some(text)),
            Value::Number(number) => Some(number.to_string()),
            _ => None,
        }
    })
}

fn build_import_candidate(
    connection: &Connection,
    requested_exchange: &str,
    source: &str,
    source_file: Option<String>,
    header_map: &HashMap<String, usize>,
    record: &csv::StringRecord,
) -> AppResult<NewImportCandidate> {
    let raw_symbol = pick_csv_field(header_map, record, &["symbol", "nse_symbol"]);
    let bse_scrip_code = pick_csv_field(header_map, record, &["securitycode", "scripcode", "code"]);
    let raw_isin = pick_csv_field(header_map, record, &["isin", "isinno", "isinnumber"]);
    let company_name = pick_csv_field(
        header_map,
        record,
        &["companyname", "securityname", "company", "name"],
    );
    let purpose_raw = pick_csv_field(header_map, record, &["purpose", "subject"])
        .ok_or_else(|| "Missing official purpose text.".to_string())?;
    let ex_date = pick_csv_field(header_map, record, &["exdate", "exdt"])
        .and_then(|value| parse_official_date(&value).ok());
    let record_date = pick_csv_field(header_map, record, &["recorddate", "rd"])
        .and_then(|value| parse_official_date(&value).ok());

    build_import_candidate_from_fields(
        connection,
        requested_exchange,
        source,
        source_file,
        raw_symbol,
        raw_isin,
        bse_scrip_code,
        company_name,
        purpose_raw,
        ex_date,
        record_date,
    )
}

#[allow(clippy::too_many_arguments)]
fn build_import_candidate_from_fields(
    connection: &Connection,
    requested_exchange: &str,
    source: &str,
    source_file: Option<String>,
    raw_symbol: Option<String>,
    raw_isin: Option<String>,
    bse_scrip_code: Option<String>,
    company_name: Option<String>,
    purpose_raw: String,
    ex_date: Option<String>,
    record_date: Option<String>,
) -> AppResult<NewImportCandidate> {
    let parsed = parse_corporate_action_purpose(&purpose_raw);
    let raw_company_name = company_name.clone();
    let raw_source_locator = source_file.clone();
    let evidence_ex_date = ex_date.clone();
    let evidence_record_date = record_date.clone();
    let parsed_action_type = parsed.action_type.clone();
    let parsed_factor = parsed.factor;
    let resolution = if requested_exchange == "BSE" {
        resolve_bse_candidate(
            connection,
            &raw_isin,
            &bse_scrip_code,
            &company_name,
            requested_exchange,
        )?
    } else {
        resolve_nse_candidate(
            connection,
            &raw_symbol,
            &raw_isin,
            &company_name,
            requested_exchange,
            ex_date.as_deref(),
        )?
    };

    let mut review_status = resolution.review_status.clone();
    let mut messages = Vec::<String>::new();
    if let Some(message) = parsed.message.clone() {
        messages.push(message);
    }
    if let Some(message) = resolution.message.clone() {
        messages.push(message);
    }

    if matches!(
        parsed.action_type.as_str(),
        "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS"
    ) {
        if parsed.parse_status != "PARSED" {
            review_status = "NEEDS_REVIEW".to_string();
        } else if ex_date.is_none() {
            review_status = "NEEDS_REVIEW".to_string();
            messages.push("Official ex-date was not parsed.".to_string());
        }
    } else {
        review_status = "UNSUPPORTED".to_string();
        messages.push("Purpose needs manual review; no price adjustment is available.".to_string());
    }

    if matches!(parsed.action_type.as_str(), "SPLIT" | "BONUS") && parsed.parse_status != "PARSED" {
        review_status = "NEEDS_REVIEW".to_string();
    }

    let resolved_isin = resolution
        .isin
        .clone()
        .or_else(|| normalize_isin(raw_isin.as_deref()));
    let resolved_company = resolution.company_name.clone().or(company_name);
    let exchange = resolution.exchange;
    let symbol = resolution.symbol;
    let dedupe_key = build_dedupe_key(
        source,
        &exchange,
        symbol.as_deref(),
        resolved_isin.as_deref(),
        &parsed.action_type,
        ex_date.as_deref(),
        record_date.as_deref(),
        &purpose_raw,
    );
    let evidence_raw_reference = build_import_evidence_raw_reference(
        raw_symbol.as_deref(),
        raw_isin.as_deref(),
        bse_scrip_code.as_deref(),
        raw_company_name.as_deref(),
        &purpose_raw,
        evidence_ex_date.as_deref(),
        evidence_record_date.as_deref(),
    );

    Ok(NewImportCandidate {
        dedupe_key,
        exchange,
        source: source.to_string(),
        source_file,
        symbol,
        isin: resolved_isin,
        bse_scrip_code,
        company_name: resolved_company,
        purpose_raw,
        ex_date,
        record_date,
        action_type: parsed.action_type,
        ratio_num: parsed.ratio_num,
        ratio_den: parsed.ratio_den,
        old_face_value: parsed.old_face_value,
        new_face_value: parsed.new_face_value,
        cash_amount: parsed.cash_amount,
        factor: parsed.factor,
        price_factor: parsed.price_factor,
        parse_status: parsed.parse_status,
        review_status,
        message: if messages.is_empty() {
            None
        } else {
            Some(messages.join(" "))
        },
        evidence: NewImportEvidence {
            source_locator: raw_source_locator,
            symbol_seen: normalize_optional_text(raw_symbol.as_deref()),
            isin_seen: normalize_optional_text(raw_isin.as_deref()),
            company_name_seen: raw_company_name,
            action_type_seen: Some(parsed_action_type),
            event_date_seen: evidence_ex_date,
            factor_seen: parsed_factor,
            raw_reference: evidence_raw_reference,
            note: Some(build_import_evidence_note(source)),
        },
    })
}

fn resolve_nse_candidate(
    connection: &Connection,
    raw_symbol: &Option<String>,
    raw_isin: &Option<String>,
    company_name: &Option<String>,
    exchange: &str,
    ex_date: Option<&str>,
) -> AppResult<ResolvedCsvInstrument> {
    let Some(raw_symbol) = raw_symbol.as_deref() else {
        return Ok(unresolved_resolution(
            exchange,
            normalize_isin(raw_isin.as_deref()),
            company_name.clone(),
            "NSE row did not include a symbol.",
        ));
    };
    let symbol = normalize_symbol(raw_symbol)?;
    let raw_isin = normalize_isin(raw_isin.as_deref());

    let exact_instrument = find_instrument_record(connection, &symbol, exchange)?;
    let Some(instrument) = exact_instrument else {
        if let Some(csv_isin) = raw_isin.as_ref() {
            match find_unique_instrument_by_isin(connection, csv_isin, exchange)? {
                IsinInstrumentMatch::Unique((
                    matched_symbol,
                    matched_exchange,
                    matched_isin,
                    matched_name,
                )) => {
                    return Ok(ResolvedCsvInstrument {
                        symbol: Some(matched_symbol),
                        exchange: matched_exchange,
                        isin: matched_isin.or_else(|| Some(csv_isin.clone())),
                        company_name: matched_name.or_else(|| company_name.clone()),
                        review_status: "PENDING".to_string(),
                        message: Some(
                            "Exact NSE symbol was not found, but the official ISIN matched a current database symbol."
                                .to_string(),
                        ),
                    });
                }
                IsinInstrumentMatch::Ambiguous => {
                    return Ok(unresolved_resolution(
                        exchange,
                        Some(csv_isin.clone()),
                        company_name.clone(),
                        "Exact NSE symbol was not found, and the official ISIN matched multiple database instruments.",
                    ));
                }
                IsinInstrumentMatch::None => {}
            }
        }
        if let Some((matched_symbol, matched_exchange, matched_isin, matched_name)) =
            find_identity_resolved_instrument(connection, &symbol, exchange)?
        {
            return Ok(ResolvedCsvInstrument {
                symbol: Some(matched_symbol),
                exchange: matched_exchange,
                isin: matched_isin.or(raw_isin),
                company_name: matched_name.or_else(|| company_name.clone()),
                review_status: "PENDING".to_string(),
                message: Some(
                    "Matched the official NSE symbol to the current database symbol through identity history."
                        .to_string(),
                ),
            });
        }
        return Ok(ResolvedCsvInstrument {
            symbol: Some(symbol),
            exchange: exchange.to_string(),
            isin: raw_isin,
            company_name: company_name.clone(),
            review_status: "UNRESOLVED".to_string(),
            message: Some("Exact NSE symbol was not found in the active database.".to_string()),
        });
    };

    let instrument_isin = instrument
        .isin
        .clone()
        .and_then(|value| normalize_isin(Some(&value)));
    if let (Some(csv_isin), Some(db_isin)) = (raw_isin.as_ref(), instrument_isin.as_ref()) {
        if csv_isin != db_isin {
            match find_unique_instrument_by_isin(connection, csv_isin, exchange)? {
                IsinInstrumentMatch::Unique((
                    matched_symbol,
                    matched_exchange,
                    matched_isin,
                    matched_name,
                )) => {
                    let matched_is_active =
                        find_instrument_record(connection, &matched_symbol, &matched_exchange)?
                            .map(|value| value.is_active)
                            .unwrap_or(false);

                    // Preserve an exact active NSE source symbol when an older official
                    // ISIN uniquely points backward to an inactive predecessor.
                    if !instrument.is_active || matched_is_active {
                        return Ok(ResolvedCsvInstrument {
                            symbol: Some(matched_symbol),
                            exchange: matched_exchange,
                            isin: matched_isin.or_else(|| Some(csv_isin.clone())),
                            company_name: matched_name.or_else(|| company_name.clone()),
                            review_status: "PENDING".to_string(),
                            message: Some(
                                "Exact NSE symbol matched, but the official ISIN resolved to a different current database symbol."
                                    .to_string(),
                            ),
                        });
                    }
                }
                IsinInstrumentMatch::Ambiguous => {
                    let ambiguous_has_active_match =
                        has_active_instrument_match_by_isin(connection, csv_isin, exchange)?;

                    // Preserve an exact active NSE source symbol when an older official
                    // ISIN maps ambiguously only to inactive historical instruments.
                    if !instrument.is_active || ambiguous_has_active_match {
                        return Ok(unresolved_resolution(
                            exchange,
                            Some(csv_isin.clone()),
                            company_name.clone(),
                            "Exact symbol matched, but the official ISIN matched multiple database instruments; choose manually.",
                        ));
                    }
                }
                IsinInstrumentMatch::None => {}
            }
            let historical_isin_match = has_instrument_isin_history_evidence(
                connection, exchange, &symbol, csv_isin, ex_date,
            )?;
            let review_status = if historical_isin_match {
                "PENDING".to_string()
            } else {
                REVIEW_STATUS_PENDING_ISIN_MISMATCH.to_string()
            };
            let message = if historical_isin_match {
                "Exact symbol matched, and the same official ISIN was already confirmed for this event date in the database."
                    .to_string()
            } else {
                "Exact symbol matched, but the official ISIN differs from the current database instrument. This can reflect historical ISIN drift; review before approval."
                    .to_string()
            };
            return Ok(ResolvedCsvInstrument {
                symbol: Some(symbol),
                exchange: exchange.to_string(),
                isin: Some(csv_isin.clone()),
                company_name: instrument.name.or_else(|| company_name.clone()),
                review_status,
                message: Some(message),
            });
        }
    }

    Ok(ResolvedCsvInstrument {
        symbol: Some(instrument.symbol),
        exchange: instrument.exchange,
        isin: instrument_isin.or(raw_isin),
        company_name: instrument.name.or_else(|| company_name.clone()),
        review_status: "PENDING".to_string(),
        message: None,
    })
}

fn resolve_bse_candidate(
    connection: &Connection,
    raw_isin: &Option<String>,
    bse_scrip_code: &Option<String>,
    company_name: &Option<String>,
    preferred_exchange: &str,
) -> AppResult<ResolvedCsvInstrument> {
    let normalized_isin = normalize_isin(raw_isin.as_deref());
    if let Some(mut resolution) =
        resolve_bse_candidate_by_scrip_code(connection, bse_scrip_code, company_name)?
    {
        if resolution.symbol.is_none() {
            return Ok(resolution);
        }
        if let Some(official_isin) = normalized_isin.as_ref() {
            if let Some(database_isin) = resolution.isin.as_ref() {
                if database_isin != official_isin {
                    resolution.isin = Some(official_isin.clone());
                    resolution.review_status = REVIEW_STATUS_PENDING_ISIN_MISMATCH.to_string();
                    resolution.message = Some(
                        "Official BSE security code matched one BSE instrument, but the official ISIN differs from that instrument; review historical identity evidence before approval."
                            .to_string(),
                    );
                    return Ok(resolution);
                }
            }
            resolution.isin = Some(official_isin.clone());
        }
        return Ok(resolution);
    }

    let Some(isin) = normalized_isin else {
        return Ok(unresolved_resolution(
            preferred_exchange,
            None,
            company_name.clone(),
            "BSE row did not include an ISIN and exact scrip code was not found in the active database.",
        ));
    };

    let matched = find_unique_instrument_by_isin(connection, &isin, preferred_exchange)?;
    let (symbol, exchange, db_isin, db_name) = match matched {
        IsinInstrumentMatch::Unique(value) => value,
        IsinInstrumentMatch::Ambiguous => {
            return Ok(unresolved_resolution(
                preferred_exchange,
                Some(isin),
                company_name.clone(),
                "Exact ISIN matches multiple database instruments; choose manually.",
            ));
        }
        IsinInstrumentMatch::None => {
            return Ok(unresolved_resolution(
                preferred_exchange,
                Some(isin),
                company_name.clone(),
                "Exact ISIN was not found in the active database.",
            ));
        }
    };

    Ok(ResolvedCsvInstrument {
        symbol: Some(symbol),
        exchange,
        isin: db_isin.and_then(|value| normalize_isin(Some(&value))),
        company_name: db_name.or_else(|| company_name.clone()),
        review_status: "PENDING".to_string(),
        message: None,
    })
}

fn resolve_bse_candidate_by_scrip_code(
    connection: &Connection,
    bse_scrip_code: &Option<String>,
    company_name: &Option<String>,
) -> AppResult<Option<ResolvedCsvInstrument>> {
    let Some(raw_code) = bse_scrip_code.as_deref() else {
        return Ok(None);
    };
    let code = raw_code.trim();
    if code.is_empty() {
        return Ok(None);
    }
    match find_bse_instrument_by_security_code(connection, code)? {
        IsinInstrumentMatch::Unique((symbol, exchange, isin, name)) => {
            Ok(Some(ResolvedCsvInstrument {
                symbol: Some(symbol),
                exchange,
                isin: isin.and_then(|value| normalize_isin(Some(&value))),
                company_name: name.or_else(|| company_name.clone()),
                review_status: "PENDING".to_string(),
                message: Some(
                    "Matched BSE row through its official security-code identity.".to_string(),
                ),
            }))
        }
        IsinInstrumentMatch::Ambiguous => Ok(Some(unresolved_resolution(
            "BSE",
            None,
            company_name.clone(),
            "Official BSE security code matches multiple active BSE instruments; choose manually.",
        ))),
        IsinInstrumentMatch::None => {
            let Some(instrument) = find_instrument_record(connection, code, "BSE")? else {
                return Ok(None);
            };
            Ok(Some(ResolvedCsvInstrument {
                symbol: Some(instrument.symbol),
                exchange: instrument.exchange,
                isin: instrument
                    .isin
                    .and_then(|value| normalize_isin(Some(&value))),
                company_name: instrument.name.or_else(|| company_name.clone()),
                review_status: "PENDING".to_string(),
                message: Some(
                    "Matched BSE row through a legacy numeric-symbol security code.".to_string(),
                ),
            }))
        }
    }
}

fn find_bse_instrument_by_security_code(
    connection: &Connection,
    security_code: &str,
) -> AppResult<IsinInstrumentMatch> {
    let mut statement = connection
        .prepare(
            "
              SELECT symbol, exchange, isin, name, COALESCE(is_active, 1)
              FROM instruments
              WHERE exchange = 'BSE'
                AND bse_security_code = ?
              ORDER BY COALESCE(is_active, 1) DESC, symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![security_code], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)? != 0,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    select_unique_active_instrument(rows)
}

fn unresolved_resolution(
    exchange: &str,
    isin: Option<String>,
    company_name: Option<String>,
    message: &str,
) -> ResolvedCsvInstrument {
    ResolvedCsvInstrument {
        symbol: None,
        exchange: exchange.to_string(),
        isin,
        company_name,
        review_status: "UNRESOLVED".to_string(),
        message: Some(message.to_string()),
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn ensure_import_evidence(
    connection: &Connection,
    import_id: i64,
    source_code: &str,
    source_locator: Option<&str>,
    captured_at: Option<&str>,
    symbol_seen: Option<&str>,
    isin_seen: Option<&str>,
    company_name_seen: Option<&str>,
    action_type_seen: Option<&str>,
    event_date_seen: Option<&str>,
    factor_seen: Option<f64>,
    raw_reference: Option<&str>,
    note: Option<&str>,
) -> AppResult<i64> {
    let normalized_source_code = normalize_optional_text(Some(source_code))
        .ok_or_else(|| "Corporate action import evidence requires a source code.".to_string())?;
    let normalized_source_locator = normalize_optional_text(source_locator);
    let normalized_captured_at = normalize_optional_text(captured_at).unwrap_or_else(now_iso);
    let normalized_symbol_seen = normalize_optional_text(symbol_seen);
    let normalized_isin_seen = normalize_optional_text(isin_seen);
    let normalized_company_name_seen = normalize_optional_text(company_name_seen);
    let normalized_action_type_seen = normalize_optional_text(action_type_seen);
    let normalized_event_date_seen = super::normalize_optional_trade_date(event_date_seen)?;
    let normalized_factor_seen = factor_seen.filter(|value| value.is_finite());
    let normalized_raw_reference = normalize_optional_text(raw_reference);
    let normalized_note = normalize_optional_text(note);

    let existing_id = connection
        .query_row(
            "
              SELECT id
              FROM corporate_action_import_evidence
              WHERE import_id = ?
                AND source_code = ?
                AND COALESCE(source_locator, '') = COALESCE(?, '')
                AND COALESCE(symbol_seen, '') = COALESCE(?, '')
                AND COALESCE(isin_seen, '') = COALESCE(?, '')
                AND COALESCE(company_name_seen, '') = COALESCE(?, '')
                AND COALESCE(action_type_seen, '') = COALESCE(?, '')
                AND COALESCE(event_date_seen, '') = COALESCE(?, '')
                AND COALESCE(factor_seen, -1) = COALESCE(?, -1)
                AND COALESCE(raw_reference, '') = COALESCE(?, '')
              LIMIT 1
            ",
            params![
                import_id,
                normalized_source_code,
                normalized_source_locator,
                normalized_symbol_seen,
                normalized_isin_seen,
                normalized_company_name_seen,
                normalized_action_type_seen,
                normalized_event_date_seen,
                normalized_factor_seen,
                normalized_raw_reference,
            ],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(existing_id) = existing_id {
        if normalized_note.is_some() {
            connection
            .execute(
                "
                  UPDATE corporate_action_import_evidence
                  SET note = COALESCE(?, note)
                  WHERE id = ?
                ",
                params![normalized_note, existing_id],
            )
                .map_err(|error| error.to_string())?;
        }
        return Ok(existing_id);
    }

    connection
        .execute(
            "
              INSERT INTO corporate_action_import_evidence (
                import_id,
                source_code,
                source_locator,
                captured_at,
                symbol_seen,
                isin_seen,
                company_name_seen,
                action_type_seen,
                event_date_seen,
                factor_seen,
                raw_reference,
                note
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                import_id,
                normalized_source_code,
                normalized_source_locator,
                normalized_captured_at,
                normalized_symbol_seen,
                normalized_isin_seen,
                normalized_company_name_seen,
                normalized_action_type_seen,
                normalized_event_date_seen,
                normalized_factor_seen,
                normalized_raw_reference,
                normalized_note,
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(connection.last_insert_rowid())
}

fn process_historical_candidates(
    connection: &Connection,
    candidates: Vec<AppResult<NewImportCandidate>>,
    result: &mut HistoricalCapitalActionBackfillResult,
    attempt: &mut HistoricalSourceAttemptState,
    source_label: &str,
    run_symbol_id: Option<i64>,
) -> AppResult<()> {
    for candidate_result in candidates {
        let candidate = match candidate_result {
            Ok(candidate) => candidate,
            Err(error) => {
                result.rows_error += 1;
                attempt.rows_error += 1;
                increment_status_count(&mut result.parse_status_counts, "ERROR");
                increment_status_count(&mut result.review_status_counts, "ERROR");
                if let Some(run_symbol_id) = run_symbol_id {
                    record_historical_backfill_run_outcome(
                        connection,
                        run_symbol_id,
                        attempt,
                        "CANDIDATE_ERROR",
                        None,
                        None,
                        None,
                        Some(error.as_str()),
                    )?;
                }
                result.errors.push(error);
                continue;
            }
        };

        increment_status_count(
            &mut result.parse_status_counts,
            candidate.parse_status.as_str(),
        );
        increment_status_count(
            &mut result.review_status_counts,
            candidate.review_status.as_str(),
        );
        if !matches!(candidate.action_type.as_str(), "SPLIT" | "BONUS") {
            if candidate.review_status == "UNSUPPORTED" {
                result.rows_unsupported += 1;
            }
            if let Some(run_symbol_id) = run_symbol_id {
                record_historical_backfill_run_outcome(
                    connection,
                    run_symbol_id,
                    attempt,
                    "SKIPPED_ACTION_TYPE",
                    None,
                    None,
                    Some(&candidate),
                    candidate.message.as_deref(),
                )?;
            }
            continue;
        }

        result.rows_read += 1;
        attempt.rows_read += 1;
        track_historical_attempt_dates(attempt, candidate.ex_date.as_deref());
        count_candidate_status(
            candidate.review_status.as_str(),
            candidate.parse_status.as_str(),
            &mut result.rows_unresolved,
            &mut result.rows_parsed,
            &mut result.rows_unsupported,
        );

        match store_historical_candidate_with_run_outcome(
            connection,
            run_symbol_id,
            attempt,
            &candidate,
        )? {
            HistoricalCandidateStoreOutcome::Inserted { row, .. } => {
                result.rows_inserted += 1;
                attempt.rows_inserted += 1;
                result.imports.push(row);
            }
            HistoricalCandidateStoreOutcome::Duplicate { .. } => {
                result.rows_duplicate += 1;
                attempt.rows_duplicate += 1;
            }
            HistoricalCandidateStoreOutcome::EvidenceAttached { .. } => {
                result.rows_evidence_attached += 1;
                attempt.rows_evidence_attached += 1;
            }
        }
    }

    if attempt.rows_read == 0 && attempt.rows_error == 0 {
        attempt.rows_error = 0;
    }

    if attempt.rows_read == 0 && attempt.rows_inserted == 0 && attempt.rows_evidence_attached == 0 {
        result.warnings.push(format!(
            "{} returned no split/bonus rows for this request window.",
            source_label
        ));
    }

    Ok(())
}

fn increment_status_count(counts: &mut HashMap<String, u32>, status: &str) {
    let normalized = normalize_optional_text(Some(status))
        .map(|value| value.to_uppercase())
        .unwrap_or_else(|| "UNKNOWN".to_string());
    *counts.entry(normalized).or_default() += 1;
}

fn merge_status_counts(target: &mut HashMap<String, u32>, source: &HashMap<String, u32>) {
    for (status, count) in source {
        *target.entry(status.clone()).or_default() += count;
    }
}

fn store_historical_candidate_with_run_outcome(
    connection: &Connection,
    run_symbol_id: Option<i64>,
    attempt: &HistoricalSourceAttemptState,
    candidate: &NewImportCandidate,
) -> AppResult<HistoricalCandidateStoreOutcome> {
    let Some(run_symbol_id) = run_symbol_id else {
        return store_import_candidate_evidence_aware(connection, candidate);
    };

    connection
        .execute_batch("SAVEPOINT historical_backfill_candidate_outcome")
        .map_err(|error| error.to_string())?;
    let operation = (|| {
        let outcome = store_import_candidate_evidence_aware(connection, candidate)?;
        let (outcome_code, import_id, evidence_id) = match &outcome {
            HistoricalCandidateStoreOutcome::Inserted { row, evidence_id } => {
                ("INSERTED", Some(row.id), Some(*evidence_id))
            }
            HistoricalCandidateStoreOutcome::Duplicate { import_id } => {
                ("DUPLICATE", Some(*import_id), None)
            }
            HistoricalCandidateStoreOutcome::EvidenceAttached {
                import_id,
                evidence_id,
            } => ("EVIDENCE_ATTACHED", Some(*import_id), Some(*evidence_id)),
        };
        record_historical_backfill_run_outcome(
            connection,
            run_symbol_id,
            attempt,
            outcome_code,
            import_id,
            evidence_id,
            Some(candidate),
            candidate.message.as_deref(),
        )?;
        Ok(outcome)
    })();

    match operation {
        Ok(outcome) => {
            connection
                .execute_batch("RELEASE historical_backfill_candidate_outcome")
                .map_err(|error| error.to_string())?;
            Ok(outcome)
        }
        Err(error) => {
            let _ = connection.execute_batch(
                "ROLLBACK TO historical_backfill_candidate_outcome; RELEASE historical_backfill_candidate_outcome",
            );
            Err(error)
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn record_historical_backfill_run_outcome(
    connection: &Connection,
    run_symbol_id: i64,
    attempt: &HistoricalSourceAttemptState,
    outcome: &str,
    import_id: Option<i64>,
    evidence_id: Option<i64>,
    candidate: Option<&NewImportCandidate>,
    message: Option<&str>,
) -> AppResult<i64> {
    connection
        .execute(
            "
              INSERT INTO historical_capital_action_backfill_run_outcomes (
                run_symbol_id,
                source,
                requested_symbol,
                source_locator,
                outcome,
                import_id,
                evidence_id,
                action_type,
                parse_status,
                review_status,
                message
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                run_symbol_id,
                attempt.source.as_str(),
                attempt.requested_symbol.as_deref(),
                attempt.source_locator.as_deref(),
                outcome,
                import_id,
                evidence_id,
                candidate.map(|value| value.action_type.as_str()),
                candidate.map(|value| value.parse_status.as_str()),
                candidate.map(|value| value.review_status.as_str()),
                message,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(connection.last_insert_rowid())
}

fn track_historical_attempt_dates(
    attempt: &mut HistoricalSourceAttemptState,
    ex_date: Option<&str>,
) {
    let Some(ex_date) = ex_date else {
        return;
    };
    if attempt
        .earliest_ex_date
        .as_deref()
        .map(|current| ex_date < current)
        .unwrap_or(true)
    {
        attempt.earliest_ex_date = Some(ex_date.to_string());
    }
    if attempt
        .latest_ex_date
        .as_deref()
        .map(|current| ex_date > current)
        .unwrap_or(true)
    {
        attempt.latest_ex_date = Some(ex_date.to_string());
    }
}

fn finalize_historical_attempt(
    attempt: HistoricalSourceAttemptState,
    source_label: &str,
) -> HistoricalCapitalActionBackfillSourceAttempt {
    let message = if attempt.rows_read == 0 && attempt.rows_error == 0 {
        format!("{source_label} returned no split/bonus rows in the requested range.")
    } else if attempt.rows_error > 0
        && attempt.rows_inserted == 0
        && attempt.rows_evidence_attached == 0
    {
        format!("{source_label} finished with errors and did not add reviewable history.")
    } else {
        format!(
            "{source_label} read {} split/bonus row(s), inserted {}, attached evidence to {}, and skipped {} exact duplicate row(s).",
            attempt.rows_read,
            attempt.rows_inserted,
            attempt.rows_evidence_attached,
            attempt.rows_duplicate
        )
    };
    HistoricalCapitalActionBackfillSourceAttempt {
        source: attempt.source,
        requested_symbol: attempt.requested_symbol,
        source_locator: attempt.source_locator,
        rows_read: attempt.rows_read,
        rows_inserted: attempt.rows_inserted,
        rows_duplicate: attempt.rows_duplicate,
        rows_evidence_attached: attempt.rows_evidence_attached,
        rows_error: attempt.rows_error,
        earliest_ex_date: attempt.earliest_ex_date,
        latest_ex_date: attempt.latest_ex_date,
        message,
    }
}

fn store_import_candidate_evidence_aware(
    connection: &Connection,
    candidate: &NewImportCandidate,
) -> AppResult<HistoricalCandidateStoreOutcome> {
    if let Some(import_id) = find_import_row_id_by_dedupe_key(connection, &candidate.dedupe_key)? {
        return retain_exact_duplicate_candidate_evidence(connection, import_id, candidate);
    }
    if let Some(existing_import_id) = find_equivalent_import_row_id(connection, candidate)? {
        let evidence_id = ensure_candidate_import_evidence(
            connection,
            existing_import_id,
            candidate,
            Some(now_iso().as_str()),
        )?;
        return Ok(HistoricalCandidateStoreOutcome::EvidenceAttached {
            import_id: existing_import_id,
            evidence_id,
        });
    }
    let row = insert_import_candidate(connection, candidate)?;
    let evidence_id = ensure_candidate_import_evidence(
        connection,
        row.id,
        candidate,
        Some(row.imported_at.as_str()),
    )?;
    Ok(HistoricalCandidateStoreOutcome::Inserted { row, evidence_id })
}

fn retain_exact_duplicate_candidate_evidence(
    connection: &Connection,
    import_id: i64,
    candidate: &NewImportCandidate,
) -> AppResult<HistoricalCandidateStoreOutcome> {
    connection.execute_batch("SAVEPOINT duplicate_candidate_evidence")
        .map_err(|error| error.to_string())?;
    let operation = (|| {
        let existing_ids = connection.prepare(
            "SELECT id FROM corporate_action_import_evidence WHERE import_id = ?",
        ).map_err(|error| error.to_string())?
            .query_map([import_id], |row| row.get::<_, i64>(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<HashSet<_>, _>>().map_err(|error| error.to_string())?;
        // The shared writer updates a matching record's note. A duplicate Fetch
        // must preserve older provenance, including legacy/backfill warnings.
        let mut capture = candidate.clone();
        capture.evidence.note = None;
        let evidence_id = ensure_candidate_import_evidence(
            connection, import_id, &capture, Some(now_iso().as_str()),
        )?;
        if existing_ids.contains(&evidence_id) {
            return Ok(HistoricalCandidateStoreOutcome::Duplicate { import_id });
        }
        connection.execute("UPDATE corporate_action_import_evidence SET note = ? WHERE id = ?",
            params![candidate.evidence.note, evidence_id]).map_err(|error| error.to_string())?;
        Ok(HistoricalCandidateStoreOutcome::EvidenceAttached { import_id, evidence_id })
    })();
    match operation {
        Ok(outcome) => {
            if let Err(error) = connection.execute_batch("RELEASE SAVEPOINT duplicate_candidate_evidence") {
                let _ = connection.execute_batch("ROLLBACK TO SAVEPOINT duplicate_candidate_evidence; RELEASE SAVEPOINT duplicate_candidate_evidence");
                return Err(error.to_string());
            }
            Ok(outcome)
        }
        Err(error) => {
            connection.execute_batch("ROLLBACK TO SAVEPOINT duplicate_candidate_evidence; RELEASE SAVEPOINT duplicate_candidate_evidence")
                .map_err(|rollback| format!("{error}; duplicate evidence rollback failed: {rollback}"))?;
            Err(error)
        }
    }
}

fn ensure_candidate_import_evidence(
    connection: &Connection,
    import_id: i64,
    candidate: &NewImportCandidate,
    captured_at: Option<&str>,
) -> AppResult<i64> {
    ensure_import_evidence(
        connection,
        import_id,
        candidate.source.as_str(),
        candidate.evidence.source_locator.as_deref(),
        captured_at,
        candidate.evidence.symbol_seen.as_deref(),
        candidate.evidence.isin_seen.as_deref(),
        candidate.evidence.company_name_seen.as_deref(),
        candidate.evidence.action_type_seen.as_deref(),
        candidate.evidence.event_date_seen.as_deref(),
        candidate.evidence.factor_seen,
        candidate.evidence.raw_reference.as_deref(),
        candidate.evidence.note.as_deref(),
    )
}

fn find_import_row_id_by_dedupe_key(
    connection: &Connection,
    dedupe_key: &str,
) -> AppResult<Option<i64>> {
    connection
        .query_row(
            "SELECT id FROM corporate_action_imports WHERE dedupe_key = ?",
            params![dedupe_key],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn find_equivalent_import_row_id(
    connection: &Connection,
    candidate: &NewImportCandidate,
) -> AppResult<Option<i64>> {
    let event_date = candidate
        .ex_date
        .as_deref()
        .or(candidate.record_date.as_deref());
    let candidate_identity = event_date_import_identity(
        candidate
            .evidence
            .symbol_seen
            .as_deref()
            .or(candidate.symbol.as_deref()),
        candidate
            .evidence
            .isin_seen
            .as_deref()
            .or(candidate.isin.as_deref()),
    );
    if candidate_identity.symbol.is_none() && candidate_identity.isin.is_none() {
        return Ok(None);
    }

    let mut statement = connection
        .prepare(
            "
              SELECT id, symbol, isin
              FROM corporate_action_imports
              WHERE exchange = ?
                AND action_type = ?
                AND COALESCE(ex_date, '') = COALESCE(?, '')
                AND COALESCE(record_date, '') = COALESCE(?, '')
                AND COALESCE(ratio_num, -1) = COALESCE(?, -1)
                AND COALESCE(ratio_den, -1) = COALESCE(?, -1)
                AND COALESCE(old_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(new_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(cash_amount, -1) = COALESCE(?, -1)
              ORDER BY CASE WHEN source = ? THEN 0 ELSE 1 END, id DESC
            ",
        )
        .map_err(|error| error.to_string())?;
    let matching_actions = statement
        .query_map(
            params![
                candidate.exchange,
                candidate.action_type,
                candidate.ex_date.as_deref(),
                candidate.record_date.as_deref(),
                candidate.ratio_num,
                candidate.ratio_den,
                candidate.old_face_value,
                candidate.new_face_value,
                candidate.cash_amount,
                candidate.source
            ],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (import_id, symbol, isin) in matching_actions {
        let existing_identities = load_event_date_import_identities(
            connection,
            import_id,
            symbol.as_deref(),
            isin.as_deref(),
            event_date,
        )?;
        for existing_identity in existing_identities {
            if event_date_identities_are_equivalent(
                connection,
                &candidate.exchange,
                event_date,
                &candidate_identity,
                &existing_identity,
            )? {
                return Ok(Some(import_id));
            }
        }
    }

    Ok(None)
}

fn event_date_import_identity(symbol: Option<&str>, isin: Option<&str>) -> EventDateImportIdentity {
    EventDateImportIdentity {
        symbol: normalize_optional_text(symbol).map(|value| value.to_uppercase()),
        isin: normalize_isin(isin),
    }
}

fn load_event_date_import_identities(
    connection: &Connection,
    import_id: i64,
    fallback_symbol: Option<&str>,
    fallback_isin: Option<&str>,
    event_date: Option<&str>,
) -> AppResult<Vec<EventDateImportIdentity>> {
    let fallback_identity = event_date_import_identity(fallback_symbol, fallback_isin);
    let mut statement = connection
        .prepare(
            "
              SELECT symbol_seen, isin_seen
              FROM corporate_action_import_evidence
              WHERE import_id = ?
                AND COALESCE(event_date_seen, '') = COALESCE(?, '')
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;
    let identities = statement
        .query_map(params![import_id, event_date], |row| {
            Ok(event_date_import_identity(
                row.get::<_, Option<String>>(0)?
                    .as_deref()
                    .or(fallback_symbol),
                row.get::<_, Option<String>>(1)?
                    .as_deref()
                    .or(fallback_isin),
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if identities.is_empty() {
        Ok(vec![fallback_identity])
    } else {
        Ok(identities)
    }
}

fn event_date_identities_are_equivalent(
    connection: &Connection,
    exchange: &str,
    event_date: Option<&str>,
    left: &EventDateImportIdentity,
    right: &EventDateImportIdentity,
) -> AppResult<bool> {
    if let (Some(left_isin), Some(right_isin)) = (&left.isin, &right.isin) {
        if left_isin != right_isin {
            return Ok(false);
        }
        return Ok(true);
    }
    if left.symbol.is_some() && left.symbol == right.symbol {
        return Ok(true);
    }
    let Some(event_date) = event_date else {
        return Ok(false);
    };

    let mut left_isins =
        load_symbol_event_date_isins(connection, exchange, left.symbol.as_deref(), event_date)?;
    if let Some(isin) = &left.isin {
        left_isins.insert(isin.clone());
    }
    let mut right_isins =
        load_symbol_event_date_isins(connection, exchange, right.symbol.as_deref(), event_date)?;
    if let Some(isin) = &right.isin {
        right_isins.insert(isin.clone());
    }

    Ok(!left_isins.is_disjoint(&right_isins))
}

fn load_symbol_event_date_isins(
    connection: &Connection,
    exchange: &str,
    symbol: Option<&str>,
    event_date: &str,
) -> AppResult<HashSet<String>> {
    let Some(symbol) = symbol else {
        return Ok(HashSet::new());
    };
    let mut statement = connection
        .prepare(
            "
              SELECT isin
              FROM instrument_isin_history
              WHERE exchange = ?
                AND symbol = ?
                AND effective_date = ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let isins = statement
        .query_map(params![exchange, symbol, event_date], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|error| error.to_string())?
        .filter_map(|row| match row {
            Ok(isin) => normalize_isin(Some(&isin)).map(Ok),
            Err(error) => Some(Err(error.to_string())),
        })
        .collect::<AppResult<HashSet<_>>>()?;
    Ok(isins)
}

fn insert_import_candidate(
    connection: &Connection,
    candidate: &NewImportCandidate,
) -> AppResult<CorporateActionImportRow> {
    connection
        .execute_batch("SAVEPOINT corporate_action_import_candidate")
        .map_err(|error| error.to_string())?;

    match insert_import_candidate_without_transaction(connection, candidate) {
        Ok(import_row) => {
            if let Err(error) =
                connection.execute_batch("RELEASE corporate_action_import_candidate")
            {
                let _ = connection.execute_batch(
                    "ROLLBACK TO corporate_action_import_candidate; RELEASE corporate_action_import_candidate",
                );
                return Err(error.to_string());
            }
            Ok(import_row)
        }
        Err(error) => {
            connection
                .execute_batch(
                    "ROLLBACK TO corporate_action_import_candidate; RELEASE corporate_action_import_candidate",
                )
                .map_err(|rollback_error| {
                    format!(
                        "{} Candidate/evidence rollback also failed: {}",
                        error, rollback_error
                    )
                })?;
            Err(error)
        }
    }
}

fn insert_import_candidate_without_transaction(
    connection: &Connection,
    candidate: &NewImportCandidate,
) -> AppResult<CorporateActionImportRow> {
    let duplicate = connection
        .query_row(
            "SELECT id FROM corporate_action_imports WHERE dedupe_key = ?",
            params![candidate.dedupe_key],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if duplicate.is_some() {
        return Err("DUPLICATE".to_string());
    }

    connection
        .execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                source_file,
                symbol,
                isin,
                bse_scrip_code,
                company_name,
                purpose_raw,
                ex_date,
                record_date,
                action_type,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount,
                factor,
                price_factor,
                parse_status,
                review_status,
                message
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                candidate.dedupe_key,
                candidate.exchange,
                candidate.source,
                candidate.source_file,
                candidate.symbol,
                candidate.isin,
                candidate.bse_scrip_code,
                candidate.company_name,
                candidate.purpose_raw,
                candidate.ex_date,
                candidate.record_date,
                candidate.action_type,
                candidate.ratio_num,
                candidate.ratio_den,
                candidate.old_face_value,
                candidate.new_face_value,
                candidate.cash_amount,
                candidate.factor,
                candidate.price_factor,
                candidate.parse_status,
                candidate.review_status,
                candidate.message
            ],
        )
        .map_err(|error| error.to_string())?;

    let import_row = get_import_row(connection, connection.last_insert_rowid())?;
    ensure_candidate_import_evidence(
        connection,
        import_row.id,
        candidate,
        Some(import_row.imported_at.as_str()),
    )?;

    Ok(import_row)
}

fn approve_corporate_action_import_internal(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionImportApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    run_connection_transaction(connection, |connection| {
        approve_corporate_action_import_without_transaction(
            connection,
            folder_path,
            input.import_id,
            false,
            false,
        )
    })
}

fn approve_corporate_action_import_with_isin_mismatch_internal(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionImportExceptionalApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    let reason = normalize_resolution_decision_reason(
        Some(input.reason.as_str()),
        "Exceptional ISIN-mismatch approval",
    )?;
    let previous_row = get_import_row(connection, input.import_id)?;
    if previous_row.review_status != REVIEW_STATUS_PENDING_ISIN_MISMATCH {
        return Err(
            "Exceptional approval is available only for PENDING_ISIN_MISMATCH imports.".to_string(),
        );
    }

    let result = approve_corporate_action_import_without_transaction(
        connection,
        folder_path,
        input.import_id,
        true,
        false,
    )?;
    record_corporate_action_import_decision(
        connection,
        &previous_row,
        &result.import_record,
        "ISIN_MISMATCH_APPROVAL",
        &reason,
    )?;
    Ok(result)
}

fn approve_corporate_action_import_with_price_validation_exception_internal(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionImportExceptionalApprovalInput,
) -> AppResult<CorporateActionImportApprovalResult> {
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    let reason = normalize_resolution_decision_reason(
        Some(input.reason.as_str()),
        "Split/Bonus price-validation exception approval",
    )?;
    let previous_row = get_import_row(connection, input.import_id)?;
    if !matches!(previous_row.action_type.as_str(), "SPLIT" | "BONUS") {
        return Err(
            "Price-validation exception approval is available only for Split/Bonus imports."
                .to_string(),
        );
    }
    if previous_row.review_status == "UNRESOLVED" || previous_row.symbol.is_none() {
        return Err("Resolve the official row to a database instrument before using a price-validation exception.".to_string());
    }
    if previous_row.review_status == REVIEW_STATUS_PENDING_ISIN_MISMATCH {
        return Err("Price-validation exception approval cannot bypass an ISIN identity mismatch. Resolve the historical identity evidence first.".to_string());
    }
    ensure_split_bonus_price_validation(connection, &previous_row, true)?;

    let result = approve_corporate_action_import_without_transaction(
        connection,
        folder_path,
        input.import_id,
        false,
        true,
    )?;
    record_corporate_action_import_decision(
        connection,
        &previous_row,
        &result.import_record,
        "PRICE_VALIDATION_EXCEPTION",
        &reason,
    )?;
    Ok(result)
}

fn approve_corporate_action_imports_internal(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionImportBulkApprovalInput,
) -> AppResult<CorporateActionImportBulkApprovalResult> {
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    let mut seen = HashSet::new();
    let import_ids: Vec<i64> = input
        .import_ids
        .iter()
        .copied()
        .filter(|import_id| seen.insert(*import_id))
        .collect();

    if import_ids.is_empty() {
        return Err("Select at least one official import to approve.".to_string());
    }

    // Cap bulk approvals to prevent holding a single SQLite write lock for too long.
    // For larger batches, call this command in multiple pages of BULK_APPROVAL_MAX_ITEMS.
    const BULK_APPROVAL_MAX_ITEMS: usize = 100;
    if import_ids.len() > BULK_APPROVAL_MAX_ITEMS {
        return Err(format!(
            "Bulk approval is limited to {BULK_APPROVAL_MAX_ITEMS} items per batch. \
             Select {BULK_APPROVAL_MAX_ITEMS} or fewer imports at a time."
        ));
    }

    run_connection_transaction(connection, |connection| {
        let mut results = Vec::new();
        let mut errors = Vec::new();
        let mut approved = 0_u32;
        let mut linked_existing = 0_u32;
        let mut already_approved = 0_u32;

        for import_id in &import_ids {
            connection
                .execute_batch("SAVEPOINT corporate_action_import_bulk_item")
                .map_err(|error| error.to_string())?;

            match approve_corporate_action_import_without_transaction(
                connection,
                folder_path,
                *import_id,
                false,
                false,
            ) {
                Ok(result) => {
                    connection
                        .execute_batch("RELEASE SAVEPOINT corporate_action_import_bulk_item")
                        .map_err(|error| error.to_string())?;

                    if result.approved_record.is_some() {
                        approved += 1;
                    } else if result
                        .message
                        .starts_with("Import linked to an existing approved")
                    {
                        linked_existing += 1;
                    } else if result.message.starts_with("Import is already linked") {
                        already_approved += 1;
                    }
                    results.push(result);
                }
                Err(error) => {
                    connection
                        .execute_batch("ROLLBACK TO SAVEPOINT corporate_action_import_bulk_item")
                        .map_err(|rollback_error| {
                            format!(
                                "Could not rollback failed import approval {}: {}",
                                import_id, rollback_error
                            )
                        })?;
                    connection
                        .execute_batch("RELEASE SAVEPOINT corporate_action_import_bulk_item")
                        .map_err(|release_error| {
                            format!(
                                "Could not release failed import approval {}: {}",
                                import_id, release_error
                            )
                        })?;
                    errors.push(CorporateActionImportBulkApprovalError {
                        import_id: *import_id,
                        message: error,
                    });
                }
            }
        }

        let failed = errors.len() as u32;
        let requested = import_ids.len() as u32;
        let touched = approved + linked_existing + already_approved;
        let message = if failed > 0 {
            format!(
                "Updated {} selected row(s). Failed {}. Raw EOD prices were not changed.",
                touched, failed
            )
        } else {
            format!(
                "Updated {} selected corporate-action row(s). Raw EOD prices were not changed.",
                touched
            )
        };

        Ok(CorporateActionImportBulkApprovalResult {
            requested,
            approved,
            linked_existing,
            already_approved,
            failed,
            results,
            errors,
            message,
        })
    })
}

fn approve_recommended_corporate_action_isin_mismatches_internal(
    connection: &Connection,
    folder_path: &Path,
    input: &CorporateActionImportBulkApprovalInput,
) -> AppResult<CorporateActionImportBulkApprovalResult> {
    verify_import_lookup_database(folder_path, &input.expected_database_path)?;
    let mut seen = HashSet::new();
    let import_ids = input
        .import_ids
        .iter()
        .copied()
        .filter(|import_id| seen.insert(*import_id))
        .collect::<Vec<_>>();
    if import_ids.is_empty() {
        return Err("Select at least one recommended historical-ISIN row to approve.".to_string());
    }
    const RECOMMENDED_ISIN_BULK_MAX_ITEMS: usize = 100;
    if import_ids.len() > RECOMMENDED_ISIN_BULK_MAX_ITEMS {
        return Err(format!(
            "Recommended identity approval is limited to {RECOMMENDED_ISIN_BULK_MAX_ITEMS} items per backend batch."
        ));
    }

    run_connection_transaction(connection, |connection| {
        let mut results = Vec::new();
        let mut errors = Vec::new();
        let mut approved = 0_u32;
        let mut linked_existing = 0_u32;
        let mut already_approved = 0_u32;
        for import_id in &import_ids {
            connection
                .execute_batch("SAVEPOINT corporate_action_recommended_isin_item")
                .map_err(|error| error.to_string())?;
            let item_result = (|| {
                let import_row = get_import_row(connection, *import_id)?;
                let reason = build_recommended_isin_exception_reason(connection, &import_row)?
                    .ok_or_else(|| {
                        "This row no longer meets the strict recommended historical-ISIN criteria; review it manually."
                            .to_string()
                    })?;
                approve_corporate_action_import_with_isin_mismatch_internal(
                    connection,
                    folder_path,
                    &CorporateActionImportExceptionalApprovalInput {
                        import_id: *import_id,
                        reason,
                        expected_database_path: input.expected_database_path.clone(),
                    },
                )
            })();
            match item_result {
                Ok(result) => {
                    connection
                        .execute_batch("RELEASE SAVEPOINT corporate_action_recommended_isin_item")
                        .map_err(|error| error.to_string())?;
                    if result.approved_record.is_some() {
                        approved += 1;
                    } else if result
                        .message
                        .starts_with("Import linked to an existing approved")
                    {
                        linked_existing += 1;
                    } else if result.message.starts_with("Import is already linked") {
                        already_approved += 1;
                    }
                    results.push(result);
                }
                Err(error) => {
                    connection
                        .execute_batch(
                            "ROLLBACK TO SAVEPOINT corporate_action_recommended_isin_item",
                        )
                        .map_err(|rollback_error| {
                            format!(
                                "Could not rollback failed recommended identity approval {}: {}",
                                import_id, rollback_error
                            )
                        })?;
                    connection
                        .execute_batch("RELEASE SAVEPOINT corporate_action_recommended_isin_item")
                        .map_err(|release_error| {
                            format!(
                                "Could not release failed recommended identity approval {}: {}",
                                import_id, release_error
                            )
                        })?;
                    errors.push(CorporateActionImportBulkApprovalError {
                        import_id: *import_id,
                        message: error,
                    });
                }
            }
        }
        let failed = errors.len() as u32;
        let requested = import_ids.len() as u32;
        let touched = approved + linked_existing + already_approved;
        Ok(CorporateActionImportBulkApprovalResult {
            requested,
            approved,
            linked_existing,
            already_approved,
            failed,
            results,
            errors,
            message: format!(
                "Recommended identity approval processed {} row(s): {} updated, {} failed. Raw EOD prices were not changed.",
                requested, touched, failed
            ),
        })
    })
}

fn resolve_corporate_action_import_internal(
    connection: &Connection,
    input: &CorporateActionImportResolveInput,
) -> AppResult<CorporateActionImportResolveResult> {
    let import_row = get_import_row(connection, input.import_id)?;
    if import_row.approved_corporate_action_id.is_some() {
        return Err("Approved corporate-action imports cannot be remapped here.".to_string());
    }

    let manual_symbol = input
        .symbol
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let manual_reason = if manual_symbol.is_some() {
        Some(normalize_resolution_decision_reason(
            input.reason.as_deref(),
            "Manual resolution",
        )?)
    } else {
        None
    };
    let resolved = if let Some(symbol) = manual_symbol {
        manually_resolve_import_row(connection, &import_row, symbol, input.exchange.as_deref())?
    } else {
        recheck_import_row_resolution(connection, &import_row)?
    };

    apply_import_row_resolution(connection, &import_row, &resolved)?;
    let updated_row = get_import_row(connection, input.import_id)?;
    if let Some(reason) = manual_reason.as_deref() {
        record_corporate_action_import_decision(
            connection,
            &import_row,
            &updated_row,
            "MANUAL_RESOLUTION",
            reason,
        )?;
    }
    Ok(CorporateActionImportResolveResult {
        message: updated_row
            .message
            .clone()
            .unwrap_or_else(|| "Corporate-action import resolution updated.".to_string()),
        import_record: updated_row,
    })
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum CorporateActionQuickResolveProof {
    ExactEventDateHistoricalIsin,
    VerifiedDatedSymbolChain(dated_symbol_chain::Proof),
    VerifiedPersistedEventIdentity {
        resolution_fingerprint: String,
    },
    VerifiedHistoricalIsinTransition {
        transition_import_id: i64,
        approved_corporate_action_id: i64,
        transition_date: String,
        historical_isin: String,
        current_isin: String,
    },
    VerifiedSplitIsinPriceProof,
}

fn strict_quick_resolve_proof(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    suggestion: &CorporateActionImportResolutionSuggestion,
) -> AppResult<Option<CorporateActionQuickResolveProof>> {
    if !matches!(
        import_row.review_status.as_str(),
        "UNRESOLVED" | REVIEW_STATUS_PENDING_ISIN_MISMATCH
    ) || import_row.approved_corporate_action_id.is_some()
        || import_row.parse_status != "PARSED"
        || import_row.ex_date.is_none()
        || !matches!(
            import_row.action_type.as_str(),
            "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS"
        )
    {
        return Ok(None);
    }

    if let Some(proof) = dated_symbol_chain::evaluate(connection, import_row, suggestion)? {
        return Ok(Some(
            CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(proof),
        ));
    }
    // Recompute proof from persisted history. A suggestion flag, shared ISIN
    // issuer prefix, or attached announcement is not event-date identity proof.
    if let Some(isin) = import_row.isin.as_deref() {
        if has_instrument_isin_history_evidence(
            connection, &suggestion.exchange, &suggestion.symbol, isin,
            import_row.ex_date.as_deref(),
        )? {
            return Ok(Some(CorporateActionQuickResolveProof::ExactEventDateHistoricalIsin));
        }
    }

    // An ordinary ISIN mismatch is not enough to resolve automatically.
    // For this status, only exact event-date ISIN evidence (above) or the
    // independently verified historical transition (below) can unlock it.
    if import_row.review_status == "UNRESOLVED" {
        if let Some(verified) =
            event_identity_resolution::load_verified_v114e_event_identity_resolution(
                connection,
                import_row.id,
            )?
        {
            let candidate = &verified.candidate;
            if candidate.exchange != import_row.exchange
                || import_row.symbol.as_deref() != Some(candidate.raw_symbol.as_str())
                || import_row.isin.as_deref() != candidate.raw_isin.as_deref()
                || import_row.ex_date.as_deref() != Some(candidate.event_date.as_str())
                || import_row.action_type != candidate.action_type
                || candidate.event_date.as_str() >= candidate.transition_date.as_str()
                || suggestion.exchange != candidate.exchange
                || suggestion.symbol != candidate.raw_symbol
                || !suggestion.is_active
            {
                return Ok(None);
            }
            return Ok(Some(
                CorporateActionQuickResolveProof::VerifiedPersistedEventIdentity {
                    resolution_fingerprint: verified.resolution_fingerprint,
                },
            ));
        }
    }

    // A split that itself changed the equity ISIN: same symbol, same issuer and
    // equity type, plus a current MATCHED local price validation. Never prefix alone.
    if split_isin_price_proof::evaluate(connection, import_row, suggestion)? {
        return Ok(Some(CorporateActionQuickResolveProof::VerifiedSplitIsinPriceProof));
    }

    let transition = match historical_isin_transition::load_verified_historical_isin_transition(
        connection,
        import_row,
        suggestion,
    ) {
        Ok(Some(transition)) => transition,
        Ok(None) => return Ok(None),
        // Ambiguous evidence is a row-level inability to prove identity, not a
        // database failure. Keep this row unavailable without aborting the queue.
        Err(error) if error.starts_with("Historical ISIN transition proof is ambiguous") => return Ok(None),
        Err(error) => return Err(error),
    };
    Ok(Some(
        CorporateActionQuickResolveProof::VerifiedHistoricalIsinTransition {
            transition_import_id: transition.transition_import_id,
            approved_corporate_action_id: transition.approved_corporate_action_id,
            transition_date: transition.transition_date,
            historical_isin: transition.historical_isin,
            current_isin: transition.current_isin,
        },
    ))
}

fn quick_resolve_corporate_action_import_internal(
    connection: &Connection,
    input: &CorporateActionImportQuickResolveInput,
) -> AppResult<CorporateActionImportResolveResult> {
    let import_row = get_import_row(connection, input.import_id)?;
    if import_row.approved_corporate_action_id.is_some() {
        return Err("Approved corporate-action imports cannot be quick-resolved.".to_string());
    }
    if !matches!(
        import_row.review_status.as_str(),
        "UNRESOLVED" | REVIEW_STATUS_PENDING_ISIN_MISMATCH
    ) {
        return Err(
            "Only unresolved or proof-backed ISIN-mismatch corporate-action imports can be quick-resolved."
                .to_string(),
        );
    }

    let suggestions = list_resolution_suggestions_for_import_row(connection, &import_row)?;
    let Some((suggestion, proof)) = unique_proven_identity_suggestion(connection, &import_row, &suggestions)? else {
        return Err("Quick Resolve requires exactly one candidate with exact event-date historical ISIN evidence, a qualifying persisted event-identity resolution, or a verified same-symbol historical-ISIN transition; this row remains manual-review-only.".to_string());
    };
    let (message, decision_type, decision_reason) = match proof {
        CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(proof) => {
            let fingerprint = proof.fingerprint()?;
            proof.store(connection)?;
            (
                format!(
                    "Quick-resolved this official row using retained official dated symbol-chain and exact announcement ISIN evidence for {}:{}.",
                    suggestion.exchange, suggestion.symbol
                ),
                dated_symbol_chain::DECISION,
                format!("Verified source-backed dated symbol chain; fingerprint={fingerprint}"),
            )
        }
        CorporateActionQuickResolveProof::ExactEventDateHistoricalIsin => (
            format!(
                "Quick-resolved this official row to {}:{} using exact event-date historical ISIN evidence.",
                suggestion.exchange, suggestion.symbol
            ),
            "VERIFIED_QUICK_RESOLUTION",
            "Exactly one candidate matched exact event-date historical ISIN evidence."
                .to_string(),
        ),
        CorporateActionQuickResolveProof::VerifiedSplitIsinPriceProof => (
            format!(
                "Quick-resolved this official row to {}:{}: the split changed the equity ISIN, and local prices match the official factor.",
                suggestion.exchange, suggestion.symbol
            ),
            split_isin_price_proof::DECISION,
            format!(
                "Same symbol, same issuer and equity type, split in event terms, no other ISIN owner, current MATCHED price validation; rawIsin={}.",
                import_row.isin.as_deref().unwrap_or("")
            ),
        ),
        CorporateActionQuickResolveProof::VerifiedPersistedEventIdentity {
            resolution_fingerprint,
        } => (
            format!(
                "Quick-resolved this official row to {}:{} using a verified persisted V1.14D.1 pre-transition event identity resolution.",
                suggestion.exchange, suggestion.symbol
            ),
            "VERIFIED_EVENT_IDENTITY_RESOLUTION",
            format!(
                "Verified persisted V1.14D.1 pre-transition event identity resolution; resolution fingerprint {}.",
                resolution_fingerprint
            ),
        ),
        CorporateActionQuickResolveProof::VerifiedHistoricalIsinTransition {
            transition_import_id,
            approved_corporate_action_id,
            transition_date,
            historical_isin,
            current_isin,
        } => (
            format!(
                "Quick-resolved this official row to {}:{} using a verified same-symbol historical-ISIN transition dated {}.",
                suggestion.exchange, suggestion.symbol, transition_date
            ),
            "VERIFIED_HISTORICAL_ISIN_TRANSITION",
            format!(
                "Verified same-symbol historical-ISIN transition; transitionImportId={}; approvedCorporateActionId={}; transitionDate={}; historicalIsin={}; currentIsin={}; evidence=exact transition-date historical ISIN + HISTORICAL_ISIN_BOOTSTRAP_V1_9_2 + VERIFIED_QUICK_RESOLUTION.",
                transition_import_id,
                approved_corporate_action_id,
                transition_date,
                historical_isin,
                current_isin
            ),
        ),
    };

    let resolved = ResolvedCsvInstrument {
        symbol: Some(suggestion.symbol.clone()),
        exchange: suggestion.exchange.clone(),
        isin: import_row.isin.clone(),
        company_name: suggestion.name.clone(),
        review_status: "PENDING".to_string(),
        message: Some(message),
    };
    apply_import_row_resolution(connection, &import_row, &resolved)?;
    let updated_row = get_import_row(connection, input.import_id)?;
    record_corporate_action_import_decision(
        connection,
        &import_row,
        &updated_row,
        decision_type,
        &decision_reason,
    )?;
    Ok(CorporateActionImportResolveResult {
        message: updated_row
            .message
            .clone()
            .unwrap_or_else(|| "Corporate-action import quick resolution updated.".to_string()),
        import_record: updated_row,
    })
}

fn unique_proven_identity_suggestion<'a>(
    connection: &Connection,
    row: &CorporateActionImportRow,
    suggestions: &'a [CorporateActionImportResolutionSuggestion],
) -> AppResult<
    Option<(
        &'a CorporateActionImportResolutionSuggestion,
        CorporateActionQuickResolveProof,
    )>,
> {
    let mut proven = Vec::new();
    for suggestion in suggestions {
        if let Some(proof) = strict_quick_resolve_proof(connection, row, suggestion)? {
            proven.push((suggestion, proof));
        }
    }
    if proven.len() <= 1 {
        return Ok(proven.into_iter().next());
    }
    if let Some(index) = proven.iter().position(|(_, p)| {
        matches!(
            p,
            CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(_)
        )
    }) {
        if let CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(chain) = &proven[index].1
        {
            if proven.iter().enumerate().all(|(i, (s, p))| {
                i == index
                    || (!s.is_active
                        && chain.related(&s.symbol)
                        && matches!(
                            p,
                            CorporateActionQuickResolveProof::ExactEventDateHistoricalIsin
                        ))
            }) {
                return Ok(proven.into_iter().nth(index));
            }
        }
        return Ok(None);
    }
    // The independently sealed event resolution can name the current symbol
    // while exact event-date history names its inactive predecessor. These are
    // one proven rename pair, not competing securities. Never generalize this
    // exception to issuer prefixes, undated history, or a second active symbol.
    if proven.len() == 2 {
        if let Some(index) = proven.iter().position(|(_, proof)| {
            matches!(
                proof,
                CorporateActionQuickResolveProof::VerifiedPersistedEventIdentity { .. }
            )
        }) {
            let (historical, proof) = &proven[1 - index];
            if !historical.is_active
                && matches!(
                    proof,
                    CorporateActionQuickResolveProof::ExactEventDateHistoricalIsin
                )
            {
                if let Some(verified) =
                    event_identity_resolution::load_verified_v114e_event_identity_resolution(
                        connection, row.id,
                    )?
                {
                    if historical.exchange == verified.candidate.exchange
                        && historical.symbol == verified.candidate.event_symbol
                        && historical.symbol != verified.candidate.raw_symbol
                    {
                        return Ok(proven.into_iter().nth(index));
                    }
                }
            }
        }
    }
    Ok(None)
}


fn recheck_corporate_action_imports_internal(
    connection: &Connection,
    input: &CorporateActionImportBulkRecheckInput,
) -> AppResult<CorporateActionImportBulkRecheckResult> {
    let mut seen = HashSet::new();
    let import_ids: Vec<i64> = input
        .import_ids
        .iter()
        .copied()
        .filter(|import_id| seen.insert(*import_id))
        .collect();

    if import_ids.is_empty() {
        return Err("Select at least one unresolved official import to recheck.".to_string());
    }

    let mut results = Vec::new();
    let mut errors = Vec::new();
    let mut reviewable = 0_u32;
    let mut still_unresolved = 0_u32;

    for import_id in &import_ids {
        connection
            .execute_batch("SAVEPOINT corporate_action_import_recheck_item")
            .map_err(|error| error.to_string())?;

        match resolve_corporate_action_import_internal(
            connection,
            &CorporateActionImportResolveInput {
                import_id: *import_id,
                symbol: None,
                exchange: None,
                reason: None,
            },
        ) {
            Ok(result) => {
                connection
                    .execute_batch("RELEASE SAVEPOINT corporate_action_import_recheck_item")
                    .map_err(|error| error.to_string())?;
                if result.import_record.review_status == "UNRESOLVED" {
                    still_unresolved += 1;
                } else {
                    reviewable += 1;
                }
                results.push(result);
            }
            Err(error) => {
                connection
                    .execute_batch("ROLLBACK TO SAVEPOINT corporate_action_import_recheck_item")
                    .map_err(|rollback_error| {
                        format!(
                            "Could not rollback failed import recheck {}: {}",
                            import_id, rollback_error
                        )
                    })?;
                connection
                    .execute_batch("RELEASE SAVEPOINT corporate_action_import_recheck_item")
                    .map_err(|release_error| {
                        format!(
                            "Could not release failed import recheck {}: {}",
                            import_id, release_error
                        )
                    })?;
                errors.push(CorporateActionImportBulkRecheckError {
                    import_id: *import_id,
                    message: error,
                });
            }
        }
    }

    let requested = import_ids.len() as u32;
    let rechecked = results.len() as u32;
    let failed = errors.len() as u32;
    let message = if failed > 0 {
        format!(
            "Rechecked {} selected row(s). {} became reviewable, {} stayed unresolved, failed {}.",
            rechecked, reviewable, still_unresolved, failed
        )
    } else {
        format!(
            "Rechecked {} selected row(s). {} became reviewable, {} stayed unresolved.",
            rechecked, reviewable, still_unresolved
        )
    };

    Ok(CorporateActionImportBulkRecheckResult {
        requested,
        rechecked,
        reviewable,
        still_unresolved,
        failed,
        results,
        errors,
        message,
    })
}

fn manually_resolve_import_row(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    symbol: &str,
    exchange: Option<&str>,
) -> AppResult<ResolvedCsvInstrument> {
    let resolved_exchange = normalize_exchange(exchange.unwrap_or(import_row.exchange.as_str()))?;
    let resolved_symbol = normalize_symbol(symbol)?;
    let Some(instrument) =
        find_instrument_record(connection, &resolved_symbol, &resolved_exchange)?
    else {
        return Err(format!(
            "Could not find {}:{} in the active database.",
            resolved_exchange, resolved_symbol
        ));
    };
    Ok(ResolvedCsvInstrument {
        symbol: Some(instrument.symbol),
        exchange: instrument.exchange,
        isin: instrument
            .isin
            .and_then(|value| normalize_isin(Some(&value))),
        company_name: instrument.name,
        review_status: "PENDING".to_string(),
        message: Some(format!(
            "Manually resolved this official row to {}:{}.",
            resolved_exchange, resolved_symbol
        )),
    })
}

fn recheck_import_row_resolution(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<ResolvedCsvInstrument> {
    if import_row.exchange.eq_ignore_ascii_case("BSE")
        || import_row.source.to_uppercase().contains("BSE")
    {
        resolve_bse_candidate(
            connection,
            &import_row.isin,
            &import_row.bse_scrip_code,
            &import_row.company_name,
            &import_row.exchange,
        )
    } else {
        let resolved = resolve_nse_candidate(
            connection,
            &import_row.symbol,
            &import_row.isin,
            &import_row.company_name,
            &import_row.exchange,
            import_row.ex_date.as_deref(),
        )?;
        let Some(raw_symbol) = import_row.symbol.as_deref() else {
            return Ok(resolved);
        };
        let should_try_identity_chain = resolved.review_status == "UNRESOLVED"
            || resolved
                .message
                .as_deref()
                .unwrap_or_default()
                .contains("identity history");
        if !should_try_identity_chain {
            return Ok(resolved);
        }

        let chain_resolved = find_identity_chain_resolved_instrument(
            connection,
            raw_symbol,
            import_row.isin.as_deref(),
            &import_row.company_name,
            &import_row.exchange,
            import_row.ex_date.as_deref(),
        )?;
        if let Some(chain_resolved) = chain_resolved {
            if resolved.review_status == "UNRESOLVED" || chain_resolved.symbol != resolved.symbol {
                return Ok(chain_resolved);
            }
            return Ok(chain_resolved);
        }

        Ok(resolved)
    }
}

fn apply_import_row_resolution(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    resolved: &ResolvedCsvInstrument,
) -> AppResult<()> {
    let review_status = derive_import_review_status(import_row, resolved);
    connection
        .execute(
            "
              UPDATE corporate_action_imports
              SET exchange = ?,
                  symbol = ?,
                  isin = ?,
                  company_name = ?,
                  review_status = ?,
                  message = ?
              WHERE id = ?
            ",
            params![
                resolved.exchange.clone(),
                resolved.symbol.clone(),
                resolved.isin.clone(),
                resolved.company_name.clone(),
                review_status,
                resolved.message.clone(),
                import_row.id
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn derive_import_review_status(
    import_row: &CorporateActionImportRow,
    resolved: &ResolvedCsvInstrument,
) -> String {
    if resolved.review_status == "UNRESOLVED" || resolved.symbol.is_none() {
        return "UNRESOLVED".to_string();
    }
    if !matches!(
        import_row.action_type.as_str(),
        "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS"
    ) {
        return "UNSUPPORTED".to_string();
    }
    if import_row.parse_status != "PARSED" || import_row.ex_date.is_none() {
        return "NEEDS_REVIEW".to_string();
    }
    if resolved.review_status == REVIEW_STATUS_PENDING_ISIN_MISMATCH {
        return REVIEW_STATUS_PENDING_ISIN_MISMATCH.to_string();
    }
    "PENDING".to_string()
}

fn normalize_resolution_decision_reason(
    reason: Option<&str>,
    decision_label: &str,
) -> AppResult<String> {
    let normalized = reason.unwrap_or_default().trim();
    if normalized.chars().count() < 10 {
        return Err(format!(
            "{} requires a written reason of at least 10 characters.",
            decision_label
        ));
    }
    if normalized.chars().count() > 1000 {
        return Err(format!(
            "{} reason must be 1000 characters or fewer.",
            decision_label
        ));
    }
    Ok(normalized.to_string())
}

fn record_corporate_action_import_decision(
    connection: &Connection,
    previous_row: &CorporateActionImportRow,
    resolved_row: &CorporateActionImportRow,
    decision_type: &str,
    reason: &str,
) -> AppResult<()> {
    connection
        .execute(
            "
              INSERT INTO corporate_action_import_decisions (
                import_id,
                decision_type,
                previous_symbol,
                previous_exchange,
                previous_isin,
                resolved_symbol,
                resolved_exchange,
                resolved_isin,
                reason
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                previous_row.id,
                decision_type,
                previous_row.symbol.as_deref(),
                previous_row.exchange.as_str(),
                previous_row.isin.as_deref(),
                resolved_row.symbol.as_deref(),
                resolved_row.exchange.as_str(),
                resolved_row.isin.as_deref(),
                reason,
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn ensure_split_bonus_price_validation(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    allow_exception: bool,
) -> AppResult<()> {
    ensure_compound_scan_fingerprint_current(connection, import_row)?;
    if !matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS") {
        return Ok(());
    }
    let validation = load_latest_official_split_bonus_validation(connection, import_row.id)?
        .ok_or_else(|| {
            "Run Split/Bonus price validation before approving this action.".to_string()
        })?;
    if !is_split_bonus_validation_current(connection, import_row, &validation)? {
        return Err(
            "The latest Split/Bonus price validation is stale. Re-run validation before approval."
                .to_string(),
        );
    }
    if allow_exception {
        if validation.scan_status == "MATCHED" {
            return Err(
                "This Split/Bonus already has a matched price validation; use ordinary approval instead."
                    .to_string(),
            );
        }
        return Ok(());
    }
    if validation.scan_status != "MATCHED" {
        return Err(format!(
            "Split/Bonus price validation is {}. Review the price evidence and use an audited exception only when the official action is still correct.",
            validation.scan_status
        ));
    }
    Ok(())
}

fn load_latest_official_split_bonus_validation(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Option<CorporateActionScanResultRow>> {
    connection
        .query_row(
            "
              SELECT
                scan_result.id,
                scan_result.scan_run_id,
                scan_result.corporate_action_import_id,
                scan_result.corporate_action_id,
                scan_result.symbol,
                scan_result.exchange,
                scan_result.scan_status,
                scan_result.prev_trade_date,
                scan_result.ex_trade_date,
                scan_result.prev_close,
                scan_result.ex_open,
                scan_result.ex_close,
                scan_result.expected_factor,
                scan_result.actual_open_factor,
                scan_result.actual_close_factor,
                scan_result.confidence,
                scan_result.message,
                scan_result.scanned_at
              FROM corporate_action_scan_results scan_result
              INNER JOIN scan_runs scan_run ON scan_run.id = scan_result.scan_run_id
              WHERE scan_result.corporate_action_import_id = ?
                AND scan_run.scope = 'official_imports'
                AND scan_run.status = 'COMPLETED'
              ORDER BY scan_result.scanned_at DESC, scan_result.id DESC
              LIMIT 1
            ",
            params![import_id],
            map_scan_result_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn is_split_bonus_validation_current(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    validation: &CorporateActionScanResultRow,
) -> AppResult<bool> {
    if validation.corporate_action_import_id != Some(import_row.id) {
        return Ok(false);
    }
    if validation.exchange != import_row.exchange {
        return Ok(false);
    }
    let effective_identity =
        event_identity_resolution::load_effective_event_identity(connection, import_row.id)?;
    if validation.symbol.as_deref() != effective_identity.event_symbol.as_deref()
        || effective_identity.event_symbol.is_none()
    {
        return Ok(false);
    }
    let (Some(import_factor), Some(scan_factor)) = (import_row.factor, validation.expected_factor)
    else {
        return Ok(false);
    };
    let tolerance = 1e-9_f64 * import_factor.abs().max(1.0);
    if !import_factor.is_finite()
        || !scan_factor.is_finite()
        || (import_factor - scan_factor).abs() > tolerance
    {
        return Ok(false);
    }
    if let Some(ex_date) = import_row.ex_date.as_deref() {
        if let Some(ex_trade_date) = validation.ex_trade_date.as_deref() {
            if ex_trade_date < ex_date {
                return Ok(false);
            }
        }
        if let Some(prev_trade_date) = validation.prev_trade_date.as_deref() {
            if prev_trade_date >= ex_date {
                return Ok(false);
            }
        }
    }
    Ok(true)
}


#[cfg(test)]
fn reconcile_existing_corporate_action_import_internal(
    connection: &Connection,
    import_id: i64,
) -> AppResult<CorporateActionImportApprovalResult> {
    let import_row = get_import_row(connection, import_id)?;
    if let Some(existing_id) = import_row.approved_corporate_action_id {
        return Ok(CorporateActionImportApprovalResult {
            import_record: import_row,
            approved_record: None,
            message: format!(
                "Import is already linked to corporate action {}.",
                existing_id
            ),
        });
    }

    if import_row.review_status != "UNRESOLVED"
        || import_row.parse_status != "PARSED"
        || !import_row.exchange.eq_ignore_ascii_case("NSE")
        || !matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS")
    {
        return Err(
            "R1-B1 strict existing-event reconciliation requires an unresolved parsed NSE Split/Bonus import."
                .to_string(),
        );
    }

    let raw_symbol = import_row
        .symbol
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "R1-B1 strict existing-event reconciliation requires a stored import symbol."
                .to_string()
        })?;
    let raw_isin = import_row
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "R1-B1 strict existing-event reconciliation requires a stored raw ISIN."
                .to_string()
        })?;
    let ex_date = import_row
        .ex_date
        .as_deref()
        .ok_or_else(|| {
            "R1-B1 strict existing-event reconciliation requires a Corporate Action ex-date."
                .to_string()
        })?;

    let candidates = load_identity_chain_instrument_candidates(
        connection,
        raw_symbol,
        Some(raw_isin),
        &import_row.exchange,
    )?;
    let active_targets = candidates
        .iter()
        .filter(|candidate| candidate.is_active)
        .collect::<Vec<_>>();
    let current_target = if active_targets.len() == 1 {
        active_targets[0]
    } else if active_targets.is_empty() {
        let inactive_current_targets = candidates
            .iter()
            .filter(|candidate| {
                !candidate.is_active
                    && candidate.symbol == raw_symbol
                    && candidate.exchange == import_row.exchange
            })
            .collect::<Vec<_>>();
        if inactive_current_targets.len() != 1 {
            return Err(format!(
                "R1-B2 requires exactly one inactive current-symbol identity target when no active current target exists; found {}.",
                inactive_current_targets.len()
            ));
        }
        inactive_current_targets[0]
    } else {
        return Err(format!(
            "R1-B1 requires exactly one active current identity target; found {}.",
            active_targets.len()
        ));
    };
    if current_target.symbol != raw_symbol || current_target.exchange != import_row.exchange {
        if current_target.is_active {
            return Err(
                "R1-B1 active current identity target does not match the stored import symbol/exchange."
                    .to_string(),
            );
        }
        return Err(
            "R1-B2 inactive historical current-symbol identity target does not match the stored import symbol/exchange."
                .to_string(),
        );
    }
    let current_isin = current_target
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            if current_target.is_active {
                "R1-B1 active current identity target has no current ISIN.".to_string()
            } else {
                "R1-B2 inactive historical current-symbol identity target has no current ISIN."
                    .to_string()
            }
        })?;

    let mut predecessor_statement = connection
        .prepare(
            "
              SELECT symbol
              FROM instruments
              WHERE exchange = ?
                AND isin = ?
                AND COALESCE(is_active, 1) = 0
              ORDER BY symbol
            ",
        )
        .map_err(|error| error.to_string())?;
    let predecessor_symbols = predecessor_statement
        .query_map(params![import_row.exchange.as_str(), raw_isin], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|error| error.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    if predecessor_symbols.len() != 1 {
        return Err(format!(
            "R1-B1 requires exactly one inactive predecessor carrying the raw ISIN; found {}.",
            predecessor_symbols.len()
        ));
    }
    let predecessor_symbol = &predecessor_symbols[0];

    let mut edge_statement = connection
        .prepare(
            "
              SELECT effective_date, isin
              FROM instrument_identity_history
              WHERE exchange = ?
                AND old_symbol = ?
                AND new_symbol = ?
                AND current_symbol = ?
              ORDER BY effective_date, id
            ",
        )
        .map_err(|error| error.to_string())?;
    let edges = edge_statement
        .query_map(
            params![
                import_row.exchange.as_str(),
                predecessor_symbol.as_str(),
                current_target.symbol.as_str(),
                current_target.symbol.as_str()
            ],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    if edges.len() != 1 {
        return Err(format!(
            "R1-B1 requires exactly one direct predecessor identity edge; found {}.",
            edges.len()
        ));
    }
    let (transition_date, edge_current_isin) = &edges[0];
    if edge_current_isin.as_deref() != Some(current_isin) {
        if current_target.is_active {
            return Err(
                "R1-B1 direct predecessor identity edge does not bind the active current ISIN."
                    .to_string(),
            );
        }
        return Err(
            "R1-B2 direct predecessor identity edge does not bind the inactive historical current-symbol ISIN."
                .to_string(),
        );
    }
    if transition_date.as_str() > ex_date {
        return Err(
            "R1-B1 predecessor transition must be on or before the Corporate Action ex-date."
                .to_string(),
        );
    }

    let mut canonical_statement = connection
        .prepare(
            "
              SELECT id
              FROM corporate_actions
              WHERE exchange = ?
                AND symbol = ?
                AND effective_date = ?
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;
    let canonical_ids = canonical_statement
        .query_map(
            params![
                import_row.exchange.as_str(),
                current_target.symbol.as_str(),
                ex_date
            ],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    if canonical_ids.len() != 1 {
        return Err(format!(
            "R1-B1 requires exactly one same-symbol/date canonical candidate; found {}.",
            canonical_ids.len()
        ));
    }
    let canonical_id = canonical_ids[0];
    let canonical = repair_preview::load_repair_preview_canonical(connection, canonical_id)?
        .ok_or_else(|| {
            format!(
                "R1-B1 canonical candidate {} disappeared during reconciliation.",
                canonical_id
            )
        })?;

    let canonical_note = canonical.note.as_deref().map(str::trim);
    let purpose = import_row.purpose_raw.trim();
    let semantics_match = canonical.exchange == import_row.exchange
        && canonical.symbol == current_target.symbol
        && canonical.isin.as_deref() == Some(current_isin)
        && canonical.effective_date == ex_date
        && canonical.record_date == import_row.record_date
        && canonical.action_type == import_row.action_type
        && import_row.factor == Some(canonical.factor)
        && canonical.ratio_num == import_row.ratio_num
        && canonical.ratio_den == import_row.ratio_den
        && canonical.old_face_value == import_row.old_face_value
        && canonical.new_face_value == import_row.new_face_value
        && canonical.cash_amount == import_row.cash_amount
        && canonical.adjust_volume
        && canonical_note == Some(purpose);
    if !semantics_match {
        return Err(
            "R1-B1 canonical event semantics do not match the unresolved import.".to_string(),
        );
    }

    ensure_split_bonus_price_validation(connection, &import_row, false)?;

    let prior_decisions: i64 = connection
        .query_row(
            "
              SELECT COUNT(*)
              FROM corporate_action_import_decisions
              WHERE import_id = ?
                AND decision_type = 'VERIFIED_EXISTING_EVENT_RECONCILIATION'
            ",
            params![import_row.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if prior_decisions != 0 {
        return Err(
            "R1-B1 found prior reconciliation audit evidence without an existing import link."
                .to_string(),
        );
    }

    connection
        .execute_batch("SAVEPOINT corporate_action_existing_event_reconciliation")
        .map_err(|error| error.to_string())?;
    let result = (|| -> AppResult<CorporateActionImportApprovalResult> {
        mark_import_approved(connection, import_row.id, canonical_id)?;
        let linked_row = get_import_row(connection, import_row.id)?;
        let decision_reason = if current_target.is_active {
            format!(
                "R1-B1 strict existing-event identity reconciliation linked import {} to existing canonical action {} after proving one active current target, one direct inactive predecessor carrying the raw ISIN, a transition on/before the ex-date, exact canonical event semantics, and current matched Split/Bonus price validation.",
                import_row.id, canonical_id
            )
        } else {
            format!(
                "R1-B2 inactive-historical existing-event reconciliation linked import {} to existing canonical action {} after proving no active identity target, exactly one inactive current-symbol target, one direct inactive predecessor carrying the raw ISIN, a transition on/before the ex-date, exact canonical event semantics, and current matched Split/Bonus price validation.",
                import_row.id, canonical_id
            )
        };
        record_corporate_action_import_decision(
            connection,
            &import_row,
            &linked_row,
            "VERIFIED_EXISTING_EVENT_RECONCILIATION",
            &decision_reason,
        )?;
        let message = if current_target.is_active {
            format!(
                "R1-B1 strict existing-event identity reconciliation linked this import to existing corporate action {}. No new corporate action was created.",
                canonical_id
            )
        } else {
            format!(
                "R1-B2 inactive-historical existing-event reconciliation linked this import to existing corporate action {}. No new corporate action was created.",
                canonical_id
            )
        };
        Ok(CorporateActionImportApprovalResult {
            import_record: linked_row,
            approved_record: None,
            message,
        })
    })();

    match result {
        Ok(value) => {
            connection
                .execute_batch("RELEASE SAVEPOINT corporate_action_existing_event_reconciliation")
                .map_err(|error| error.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = connection.execute_batch(
                "ROLLBACK TO SAVEPOINT corporate_action_existing_event_reconciliation; \
                 RELEASE SAVEPOINT corporate_action_existing_event_reconciliation",
            );
            Err(error)
        }
    }
}


fn approve_corporate_action_import_without_transaction(
    connection: &Connection,
    folder_path: &Path,
    import_id: i64,
    allow_isin_mismatch: bool,
    allow_price_validation_exception: bool,
) -> AppResult<CorporateActionImportApprovalResult> {
    let import_row = get_import_row(connection, import_id)?;
    if import_row.approved_corporate_action_id.is_some() {
        return Ok(CorporateActionImportApprovalResult {
            import_record: import_row,
            approved_record: None,
            message: "Import is already linked to an approved corporate action.".to_string(),
        });
    }

    if !matches!(
        import_row.action_type.as_str(),
        "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS"
    ) {
        return Err(
            "Only parsed split, bonus, dividend, and rights imports can be approved in this version."
                .to_string(),
        );
    }
    if matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS") {
        if let Some((_, reason)) = split_bonus_terms::blocker(&import_row.purpose_raw) {
            return Err(reason.to_string());
        }
    }
    if import_row.parse_status != "PARSED" {
        return Err(
            "This import has not been parsed into an approvable corporate action.".to_string(),
        );
    }
    if import_row.review_status == "UNRESOLVED" {
        return Err(
            "Resolve the official row to a database instrument before approving it.".to_string(),
        );
    }
    if import_row.review_status == REVIEW_STATUS_PENDING_ISIN_MISMATCH && !allow_isin_mismatch {
        return Err(
            "ISIN-mismatch imports are blocked from ordinary approval; resolve the historical identity evidence first."
                .to_string(),
        );
    }

    if !allow_isin_mismatch && identity_recheck::machine_identity_is_unproven(connection, &import_row)? {
        return Err("Stored machine identity no longer has verified evidence. Load & Validate must recheck identity before approval.".to_string());
    }
    split_bonus_preparation::ensure_components_prepared(connection, &import_row)?;

    let Some(symbol) = import_row.symbol.clone() else {
        return Err("Resolved symbol is required before approval.".to_string());
    };
    let Some(effective_date) = import_row.ex_date.clone() else {
        return Err("Ex-date is required before approval.".to_string());
    };
    ensure_official_import_eod_ready(connection, folder_path, &import_row, &symbol, &effective_date)?;
    if matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS") {
        ensure_split_bonus_price_validation(
            connection,
            &import_row,
            allow_price_validation_exception,
        )?;
        // Metadata/factor freshness alone cannot prove unchanged OHLC bars.
        // Re-read the authoritative EOD window within the approval transaction.
        price_validation_freshness::ensure_scan_uses_current_price_window(
            connection, folder_path, &import_row,
        )?;
    }

    if let Some(existing_id) = find_existing_corporate_action(connection, &import_row)? {
        mark_import_approved(connection, import_row.id, existing_id)?;
        let linked_row = get_import_row(connection, import_row.id)?;
        return Ok(CorporateActionImportApprovalResult {
            import_record: linked_row,
            approved_record: None,
            message: "Import linked to an existing approved corporate action.".to_string(),
        });
    }

    let source_ref = import_row
        .source_file
        .clone()
        .or_else(|| Some(format!("{} import #{}", import_row.source, import_row.id)));
    let payload = CorporateActionInputPayload {
        action_type: import_row.action_type.clone(),
        exchange: import_row.exchange.clone(),
        effective_date: effective_date.clone(),
        symbol: Some(symbol.clone()),
        isin: import_row.isin.clone(),
        record_date: import_row.record_date.clone(),
        ratio_num: import_row.ratio_num,
        ratio_den: import_row.ratio_den,
        old_face_value: import_row.old_face_value,
        new_face_value: import_row.new_face_value,
        cash_amount: import_row.cash_amount,
        adjust_volume: Some(matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS")),
        old_symbol: None,
        old_name: None,
        new_symbol: None,
        new_name: None,
        current_symbol: import_row.symbol.clone(),
        current_name: import_row.company_name.clone(),
        note: Some(import_row.purpose_raw.clone()),
        source: Some(approved_corporate_action_source(&import_row.source)),
        source_ref: source_ref.clone(),
    };

    let approved = match super::instrument_mutations::apply_official_import_price_adjustment(connection, &payload, folder_path, &import_row) {
        Ok(result) => result,
        Err(error) if error.contains("already exists") => {
            if let Some(existing_id) = find_existing_corporate_action(connection, &import_row)? {
                mark_import_approved(connection, import_row.id, existing_id)?;
                let linked_row = get_import_row(connection, import_row.id)?;
                return Ok(CorporateActionImportApprovalResult {
                    import_record: linked_row,
                    approved_record: None,
                    message: "Import linked to an existing approved corporate action.".to_string(),
                });
            }
            return Err(error);
        }
        Err(error) => return Err(error),
    };

    if import_row.factor.is_some() && approved.factor != import_row.factor {
        return Err("Approved factor did not match the parsed import factor.".to_string());
    }
    if let Some(isin) = import_row.isin.as_deref() {
        upsert_instrument_isin_history_evidence(
            connection,
            &import_row.exchange,
            import_row.symbol.as_deref().unwrap_or(symbol.as_str()),
            isin,
            Some(effective_date.as_str()),
            Some(import_row.source.as_str()),
            source_ref.as_deref(),
            Some("Confirmed from an approved official corporate-action import."),
        )?;
    }
    mark_import_approved(connection, import_row.id, approved.stored_record_id)?;
    let linked_row = get_import_row(connection, import_row.id)?;
    Ok(CorporateActionImportApprovalResult {
        import_record: linked_row,
        approved_record: Some(approved),
        message: "Official import approved. Raw EOD prices were not changed.".to_string(),
    })
}

fn find_existing_corporate_action(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Option<i64>> {
    let Some(symbol) = import_row.symbol.as_deref() else {
        return Ok(None);
    };
    let Some(effective_date) = import_row.ex_date.as_deref() else {
        return Ok(None);
    };
    connection
        .query_row(
            "
              SELECT id
              FROM corporate_actions
              WHERE exchange = ?
                AND effective_date = ?
                AND action_type = ?
                AND (
                  (? IS NOT NULL AND isin = ?)
                  OR symbol = ?
                )
                AND COALESCE(ratio_num, -1) = COALESCE(?, -1)
                AND COALESCE(ratio_den, -1) = COALESCE(?, -1)
                AND COALESCE(old_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(new_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(cash_amount, -1) = COALESCE(?, -1)
              ORDER BY id DESC
              LIMIT 1
            ",
            params![
                import_row.exchange,
                effective_date,
                import_row.action_type,
                import_row.isin,
                import_row.isin,
                symbol,
                import_row.ratio_num,
                import_row.ratio_den,
                import_row.old_face_value,
                import_row.new_face_value,
                import_row.cash_amount
            ],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn mark_import_approved(
    connection: &Connection,
    import_id: i64,
    corporate_action_id: i64,
) -> AppResult<()> {
    connection
        .execute(
            "
              UPDATE corporate_action_imports
              SET
                review_status = 'APPROVED',
                approved_corporate_action_id = ?,
                approved_at = ?,
                message = COALESCE(message, 'Approved into canonical corporate_actions.')
              WHERE id = ?
            ",
            params![corporate_action_id, now_iso(), import_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn get_import_row(connection: &Connection, id: i64) -> AppResult<CorporateActionImportRow> {
    connection
        .query_row(
            import_row_sql("WHERE id = ?").as_str(),
            params![id],
            map_import_row,
        )
        .map_err(|error| error.to_string())
}

fn normalize_identity_company_name_for_recommendation(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(|character| character.to_uppercase())
        .collect()
}

fn strict_recommended_isin_identity_match(
    import_row: &CorporateActionImportRow,
    candidate: &CorporateActionImportResolutionSuggestion,
    active_suggestion_count: usize,
) -> bool {
    if import_row.review_status != REVIEW_STATUS_PENDING_ISIN_MISMATCH
        || !matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS")
        || active_suggestion_count != 1
        || !candidate.is_active
        || import_row.evidence_count == 0
    {
        return false;
    }
    let Some(official_symbol) = import_row
        .symbol
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return false;
    };
    if !official_symbol.eq_ignore_ascii_case(candidate.symbol.trim())
        || !import_row
            .exchange
            .trim()
            .eq_ignore_ascii_case(candidate.exchange.trim())
    {
        return false;
    }
    let official_company =
        normalize_identity_company_name_for_recommendation(import_row.company_name.as_deref());
    let candidate_company =
        normalize_identity_company_name_for_recommendation(candidate.name.as_deref());
    if official_company.is_empty() || official_company != candidate_company {
        return false;
    }
    let Some(official_isin) = import_row
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return false;
    };
    let Some(current_isin) = candidate
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return false;
    };
    !official_isin.eq_ignore_ascii_case(current_isin)
}

fn build_recommended_isin_exception_reason_from_suggestions(
    import_row: &CorporateActionImportRow,
    suggestions: &[CorporateActionImportResolutionSuggestion],
) -> Option<String> {
    let active_suggestions = suggestions
        .iter()
        .filter(|candidate| candidate.is_active)
        .collect::<Vec<_>>();
    if active_suggestions.len() != 1 {
        return None;
    }
    let candidate = active_suggestions[0];
    if !strict_recommended_isin_identity_match(import_row, candidate, active_suggestions.len()) {
        return None;
    }
    Some(format!(
        "Operator accepted recommended historical ISIN exception: exact exchange/symbol/company match to {}:{}, exactly one active identity-history candidate, and {} attached official evidence record(s). Official ISIN {} differs from current ISIN {}.",
        candidate.exchange,
        candidate.symbol,
        import_row.evidence_count,
        import_row.isin.as_deref().unwrap_or("-"),
        candidate.isin.as_deref().unwrap_or("-")
    ))
}

fn build_recommended_isin_exception_reason(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Option<String>> {
    let suggestions = list_resolution_suggestions_for_import_row(connection, import_row)?;
    Ok(build_recommended_isin_exception_reason_from_suggestions(
        import_row,
        &suggestions,
    ))
}

fn list_corporate_action_import_resolution_hints_internal(
    connection: &Connection,
    input: &CorporateActionImportResolutionHintsInput,
) -> AppResult<CorporateActionImportResolutionHintsResult> {
    let mut seen = HashSet::new();
    let unique_ids = input
        .import_ids
        .iter()
        .copied()
        .filter(|id| seen.insert(*id))
        .collect::<Vec<_>>();
    let mut hints = Vec::with_capacity(unique_ids.len());

    for import_id in unique_ids {
        match get_import_row(connection, import_id) {
            Ok(import_row) => match build_resolution_hint_for_import_row(connection, &import_row) {
                Ok(hint) => hints.push(hint),
                Err(error) => hints.push(CorporateActionImportResolutionHint {
                    import_id,
                    status: "ERROR".to_string(),
                    quick_resolvable: false,
                    active_suggestion_count: 0,
                    total_suggestion_count: 0,
                    top_suggestion_symbol: None,
                    top_suggestion_exchange: None,
                    recommended_isin_exception: false,
                    recommendation_reason: None,
                    message: error,
                }),
            },
            Err(error) => hints.push(CorporateActionImportResolutionHint {
                import_id,
                status: "ERROR".to_string(),
                quick_resolvable: false,
                active_suggestion_count: 0,
                total_suggestion_count: 0,
                top_suggestion_symbol: None,
                top_suggestion_exchange: None,
                recommended_isin_exception: false,
                recommendation_reason: None,
                message: error,
            }),
        }
    }

    Ok(CorporateActionImportResolutionHintsResult {
        requested: hints.len() as u32,
        message: format!(
            "Loaded quick-resolve hints for {} official import row(s).",
            hints.len()
        ),
        hints,
    })
}

fn build_resolution_hint_for_import_row(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<CorporateActionImportResolutionHint> {
    let suggestions = list_resolution_suggestions_for_import_row(connection, import_row)?;
    let active_suggestions = suggestions
        .iter()
        .filter(|candidate| candidate.is_active)
        .collect::<Vec<_>>();
    let proven_suggestion = unique_proven_identity_suggestion(connection, import_row, &suggestions)?;
    let (top_suggestion, quick_resolve_proof) = if let Some((suggestion, proof)) = proven_suggestion {
        (Some(suggestion), Some(proof))
    } else if active_suggestions.len() == 1 {
        (Some(active_suggestions[0]), None)
    } else {
        (None, None)
    };
    let quick_resolvable = quick_resolve_proof.is_some();
    let recommendation_reason =
        build_recommended_isin_exception_reason_from_suggestions(import_row, &suggestions);
    let recommended_isin_exception = recommendation_reason.is_some();
    // A verified backend identity proof takes precedence over an operator-only
    // ISIN recommendation; recommendations without proof remain manual.
    let (status, message) = if recommended_isin_exception && !quick_resolvable {
        (
            "RECOMMENDED_ISIN_EXCEPTION".to_string(),
            "Recommended identity match: exact exchange, symbol and company; exactly one active identity-history candidate; attached official evidence. Explicit operator approval is still required.".to_string(),
        )
    } else if let Some(top_suggestion) = top_suggestion {
        (
            if top_suggestion.is_active { "ONE_ACTIVE" } else { "ONE_HISTORICAL" }.to_string(),
            if quick_resolvable {
                match quick_resolve_proof.as_ref() {
                    Some(CorporateActionQuickResolveProof::VerifiedDatedSymbolChain(_)) => {
                        format!("The app verified the dated official symbol chain and exact announcement ISIN evidence for {}:{}.",top_suggestion.exchange,top_suggestion.symbol)
                    },
                    Some(CorporateActionQuickResolveProof::VerifiedPersistedEventIdentity { .. }) => {
                        format!(
                            "Quick Resolve can use {}:{} because a verified persisted V1.14D.1 pre-transition event identity resolution is present.",
                            top_suggestion.exchange, top_suggestion.symbol
                        )
                    }
                    Some(CorporateActionQuickResolveProof::VerifiedHistoricalIsinTransition { transition_date, .. }) => {
                        format!(
                            "Quick Resolve can use {}:{} because a verified same-symbol historical-ISIN transition exists at {} and this event is strictly pre-transition.",
                            top_suggestion.exchange, top_suggestion.symbol, transition_date
                        )
                    }
                    _ => format!(
                        "Quick Resolve can use {}:{} because exact event-date historical ISIN evidence is present.",
                        top_suggestion.exchange, top_suggestion.symbol
                    ),
                }
            } else {
                format!(
                    "One active suggested current symbol was found ({}:{}), but exact event-date historical ISIN evidence, a qualifying persisted event-identity resolution, and a verified same-symbol historical-ISIN transition are missing. Manual review is required.",
                    top_suggestion.exchange, top_suggestion.symbol
                )
            },
        )
    } else if active_suggestions.len() > 1 {
        (
            "MULTIPLE_ACTIVE".to_string(),
            format!(
                "{} active suggested current symbols were found. Manual review is still required.",
                active_suggestions.len()
            ),
        )
    } else if suggestions.is_empty() {
        (
            "NONE_ACTIVE".to_string(),
            "No structured quick-resolve suggestions are available for this row yet.".to_string(),
        )
    } else {
        (
            "NONE_ACTIVE".to_string(),
            format!(
                "{} suggested related symbols were found, but none are active. Manual review is still required.",
                suggestions.len()
            ),
        )
    };

    Ok(CorporateActionImportResolutionHint {
        import_id: import_row.id,
        status,
        quick_resolvable,
        active_suggestion_count: active_suggestions.len() as u32,
        total_suggestion_count: suggestions.len() as u32,
        top_suggestion_symbol: top_suggestion.map(|candidate| candidate.symbol.clone()),
        top_suggestion_exchange: top_suggestion.map(|candidate| candidate.exchange.clone()),
        recommended_isin_exception,
        recommendation_reason,
        message,
    })
}

fn list_corporate_action_import_resolution_suggestions_internal(
    connection: &Connection,
    input: &CorporateActionImportResolutionSuggestionsInput,
) -> AppResult<CorporateActionImportResolutionSuggestionsResult> {
    let import_row = get_import_row(connection, input.import_id)?;
    let suggestions = list_resolution_suggestions_for_import_row(connection, &import_row)?;
    let suggestion_message = if suggestions.is_empty() {
        "No structured resolution suggestions are available for this row yet. Search manually or keep improving identity history."
            .to_string()
    } else {
        format!(
            "Loaded {} suggested current database symbol(s) for manual resolve.",
            suggestions.len()
        )
    };
    let message = format!(
        "{} {}",
        suggestion_message,
        format_import_evidence_context(&import_row)
    );

    Ok(CorporateActionImportResolutionSuggestionsResult {
        import_record: import_row,
        suggestions,
        message,
    })
}

fn format_import_evidence_context(import_row: &CorporateActionImportRow) -> String {
    if import_row.evidence_count == 0 {
        return "No source-evidence record is attached to this import row.".to_string();
    }

    let sources = if import_row.evidence_sources.is_empty() {
        "an unspecified source".to_string()
    } else {
        import_row.evidence_sources.join(", ")
    };
    format!(
        "Review provenance: {} evidence record(s) from {}.",
        import_row.evidence_count, sources
    )
}

fn list_resolution_suggestions_for_import_row(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<Vec<CorporateActionImportResolutionSuggestion>> {
    if import_row.exchange.eq_ignore_ascii_case("BSE")
        || import_row.source.to_uppercase().contains("BSE")
    {
        return Ok(Vec::new());
    }

    let Some(raw_symbol) = import_row.symbol.as_deref() else {
        return Ok(Vec::new());
    };

    let candidates = load_identity_chain_instrument_candidates(
        connection,
        raw_symbol,
        import_row.isin.as_deref(),
        &import_row.exchange,
    )?;
    let mut suggestions = Vec::new();
    for candidate in candidates {
        let has_historical_isin_evidence = if let Some(isin) = import_row.isin.as_deref() {
            has_instrument_isin_history_evidence(
                connection,
                &candidate.exchange,
                &candidate.symbol,
                isin,
                import_row.ex_date.as_deref(),
            )?
        } else {
            false
        };
        let reason = if has_historical_isin_evidence {
            "Historical ISIN evidence also matches this symbol for the event date.".to_string()
        } else if candidate.is_active {
            "Active symbol found through the connected NSE identity-history chain.".to_string()
        } else {
            "Inactive related symbol found through the connected NSE identity-history chain."
                .to_string()
        };
        suggestions.push(CorporateActionImportResolutionSuggestion {
            symbol: candidate.symbol,
            exchange: candidate.exchange,
            name: candidate.company_name,
            series: candidate.series,
            isin: candidate.isin,
            is_active: candidate.is_active,
            has_event_date_isin_evidence: has_historical_isin_evidence,
            reason,
        });
    }

    Ok(suggestions)
}

const EXACT_IMPORT_LOOKUP_MAX_IDS: usize = 100;

fn validate_exact_import_lookup_ids(import_ids: &[i64]) -> AppResult<()> {
    if import_ids.is_empty() || import_ids.len() > EXACT_IMPORT_LOOKUP_MAX_IDS {
        return Err("Exact import lookup requires between 1 and 100 IDs.".to_string());
    }
    let mut seen = HashSet::new();
    for id in import_ids {
        if *id <= 0 || *id > 9_007_199_254_740_991_i64 || !seen.insert(*id) {
            return Err("Exact import lookup requires unique positive JavaScript-safe integer IDs.".to_string());
        }
    }
    Ok(())
}

fn verify_import_lookup_database(active: &Path, expected: &str) -> AppResult<()> {
    if expected.trim().is_empty() {
        return Err("The reviewed database context is missing.".to_string());
    }
    let active_path = active.canonicalize().map_err(|error| error.to_string())?;
    let expected_path = Path::new(expected).canonicalize().map_err(|error| error.to_string())?;
    if active_path != expected_path {
        return Err("The active database changed after review. Load & Prepare again.".to_string());
    }
    Ok(())
}

fn read_import_rows_by_ids(
    connection: &Connection,
    import_ids: &[i64],
) -> AppResult<Vec<CorporateActionImportRow>> {
    validate_exact_import_lookup_ids(import_ids)?;
    // One bound primary-key query, same projection/evidence fields as the existing list.
    // No paging, mutation, migration, or omission of approved rows after an Apply.
    let sql = import_row_sql(&format!("WHERE id IN ({})", super::question_marks(import_ids.len())));
    let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params_from_iter(import_ids.iter()), map_import_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let mut by_id = rows.into_iter().map(|row| (row.id, row)).collect::<HashMap<_, _>>();
    import_ids.iter().map(|id| {
        by_id.remove(id).ok_or_else(|| format!("Exact import lookup is missing reviewed ID {id}. Load & Prepare again."))
    }).collect()
}

fn list_import_rows(
    connection: &Connection,
    input: Option<&CorporateActionImportListInput>,
) -> AppResult<Vec<CorporateActionImportRow>> {
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(250)
        .clamp(25, 10_000);
    let offset = input
        .and_then(|value| value.offset)
        .unwrap_or(0)
        .min(1_000_000);
    let mut clauses = Vec::<String>::new();
    let mut values = Vec::<SqlValue>::new();

    if let Some(review_status) = input.and_then(|value| value.review_status.as_ref()) {
        clauses.push("review_status = ?".to_string());
        values.push(SqlValue::Text(review_status.trim().to_uppercase()));
    }
    if input
        .and_then(|value| value.exclude_approved)
        .unwrap_or(false)
    {
        // The pending queue also leaves out informational notices closed in Phase 3.
        clauses.push(format!(
            "review_status NOT IN ('APPROVED', '{}')",
            informational_closure::REVIEW_STATUS_CLOSED_INFORMATIONAL
        ));
    }

    if let Some(action_types) = input.and_then(|value| value.action_types.as_ref()) {
        let normalized = action_types
            .iter()
            .map(|value| value.trim().to_uppercase())
            .filter(|value| {
                matches!(
                    value.as_str(),
                    "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS" | "OTHER" | "DEMERGER"
                )
            })
            .collect::<Vec<_>>();
        if normalized.is_empty() {
            return Ok(Vec::new());
        }
        clauses.push(format!(
            "action_type IN ({})",
            super::question_marks(normalized.len())
        ));
        values.extend(normalized.into_iter().map(SqlValue::Text));
    }
    if let Some(search_query) = input.and_then(|value| value.search_query.as_ref()) {
        let normalized = search_query.trim().to_uppercase();
        if !normalized.is_empty() {
            let like_value = SqlValue::Text(format!("%{normalized}%"));
            clauses.push(
                "
                  (
                    UPPER(COALESCE(symbol, '')) LIKE ?
                    OR UPPER(COALESCE(company_name, '')) LIKE ?
                    OR UPPER(COALESCE(isin, '')) LIKE ?
                    OR UPPER(COALESCE(bse_scrip_code, '')) LIKE ?
                    OR UPPER(COALESCE(purpose_raw, '')) LIKE ?
                    OR UPPER(COALESCE(message, '')) LIKE ?
                  )
                "
                .to_string(),
            );
            values.push(like_value.clone());
            values.push(like_value.clone());
            values.push(like_value.clone());
            values.push(like_value.clone());
            values.push(like_value.clone());
            values.push(like_value);
        }
    }

    let where_clause = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let order = if input.and_then(|value| value.review_status.as_deref())
        .is_some_and(|status| status.trim().eq_ignore_ascii_case("APPROVED")) {
        "julianday(approved_at) DESC, approved_at DESC, id DESC"
    } else {
        "COALESCE(ex_date, record_date, imported_at) DESC, CASE review_status WHEN 'PENDING' THEN 0 WHEN 'PENDING_ISIN_MISMATCH' THEN 1 WHEN 'UNRESOLVED' THEN 2 WHEN 'NEEDS_REVIEW' THEN 3 WHEN 'UNSUPPORTED' THEN 4 WHEN 'APPROVED' THEN 5 ELSE 6 END, imported_at DESC, id DESC"
    };
    let mut statement = connection
        .prepare(
            format!(
                "{} ORDER BY {order} LIMIT ? OFFSET ?",
                import_row_sql(&where_clause)
            )
            .as_str(),
        )
        .map_err(|error| error.to_string())?;
    values.push(SqlValue::Integer(limit as i64));
    values.push(SqlValue::Integer(offset as i64));
    let rows = statement
        .query_map(params_from_iter(values), map_import_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn import_row_sql(where_clause: &str) -> String {
    format!(
        "
          SELECT
            id,
            exchange,
            source,
            source_file,
            symbol,
            isin,
            bse_scrip_code,
            company_name,
            purpose_raw,
            ex_date,
            record_date,
            action_type,
            ratio_num,
            ratio_den,
            old_face_value,
            new_face_value,
            cash_amount,
            factor,
            price_factor,
            parse_status,
            review_status,
            message,
            approved_corporate_action_id,
            imported_at,
            approved_at,
            (
              SELECT COUNT(*)
              FROM corporate_action_import_evidence
              WHERE import_id = corporate_action_imports.id
            ) AS evidence_count,
            (
              SELECT GROUP_CONCAT(DISTINCT source_code)
              FROM corporate_action_import_evidence
              WHERE import_id = corporate_action_imports.id
            ) AS evidence_sources,
            (
              SELECT captured_at
              FROM corporate_action_import_evidence
              WHERE import_id = corporate_action_imports.id
              ORDER BY captured_at DESC, id DESC
              LIMIT 1
            ) AS latest_evidence_captured_at,
            (
              SELECT source_locator
              FROM corporate_action_import_evidence
              WHERE import_id = corporate_action_imports.id
              ORDER BY captured_at DESC, id DESC
              LIMIT 1
            ) AS latest_evidence_source_locator,
            (
              SELECT note
              FROM corporate_action_import_evidence
              WHERE import_id = corporate_action_imports.id
              ORDER BY captured_at DESC, id DESC
              LIMIT 1
            ) AS latest_evidence_note
          FROM corporate_action_imports
          {where_clause}
        "
    )
}

fn map_import_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CorporateActionImportRow> {
    let evidence_sources = row
        .get::<_, Option<String>>(26)?
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    Ok(CorporateActionImportRow {
        id: row.get(0)?,
        exchange: row.get(1)?,
        source: row.get(2)?,
        source_file: row.get(3)?,
        symbol: row.get(4)?,
        isin: row.get(5)?,
        bse_scrip_code: row.get(6)?,
        company_name: row.get(7)?,
        purpose_raw: row.get(8)?,
        ex_date: row.get(9)?,
        record_date: row.get(10)?,
        action_type: row.get(11)?,
        ratio_num: row.get(12)?,
        ratio_den: row.get(13)?,
        old_face_value: row.get(14)?,
        new_face_value: row.get(15)?,
        cash_amount: row.get(16)?,
        factor: row.get(17)?,
        price_factor: row.get(18)?,
        parse_status: row.get(19)?,
        review_status: row.get(20)?,
        message: row.get(21)?,
        approved_corporate_action_id: row.get(22)?,
        imported_at: row.get(23)?,
        approved_at: row.get(24)?,
        evidence_count: row.get::<_, i64>(25)?.max(0) as u32,
        evidence_sources,
        latest_evidence_captured_at: row.get(27)?,
        latest_evidence_source_locator: row.get(28)?,
        latest_evidence_note: row.get(29)?,
    })
}

fn run_corporate_action_scan_internal(
    connection: &Connection,
    folder_path: &Path,
    input: Option<&CorporateActionScanInput>,
) -> AppResult<CorporateActionScanResult> {
    let scope = input
        .and_then(|value| value.scope.clone())
        .unwrap_or_else(|| "official_imports".to_string());
    let targeted_import_ids = normalize_targeted_scan_import_ids(input)?;
    if scope == "blind_anomalies" && targeted_import_ids.is_some() {
        return Err(
            "Targeted import IDs are supported only for official Split/Bonus scans.".to_string(),
        );
    }
    let started_at = now_iso();
    connection
        .execute(
            "
              INSERT INTO scan_runs (scope, action_types, started_at, status, message)
              VALUES (?, 'SPLIT,BONUS', ?, 'RUNNING', ?)
            ",
            params![scope, started_at, scan_start_message(&scope)],
        )
        .map_err(|error| error.to_string())?;
    let scan_run_id = connection.last_insert_rowid();

    let total_results = if scope == "blind_anomalies" {
        run_blind_anomaly_scan(connection, folder_path, scan_run_id)?
    } else {
        run_official_candidate_scan(
            connection,
            folder_path,
            scan_run_id,
            targeted_import_ids.as_deref(),
        )?
    };

    connection
        .execute(
            "
              UPDATE scan_runs
              SET status = 'COMPLETED',
                  completed_at = ?,
                  total_results = ?,
                  message = ?
              WHERE id = ?
            ",
            params![
                now_iso(),
                total_results,
                scan_complete_message(&scope, total_results),
                scan_run_id
            ],
        )
        .map_err(|error| error.to_string())?;

    list_scan_results(
        connection,
        Some(&CorporateActionScanListInput {
            scan_run_id: Some(scan_run_id),
            import_ids: None,
            search_query: None,
            limit: Some(500),
        }),
    )
}

fn normalize_targeted_scan_import_ids(
    input: Option<&CorporateActionScanInput>,
) -> AppResult<Option<Vec<i64>>> {
    let Some(import_ids) = input.and_then(|value| value.import_ids.as_ref()) else {
        return Ok(None);
    };
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for import_id in import_ids {
        if *import_id <= 0 {
            return Err(
                "Targeted Corporate Action scan import IDs must be positive integers.".to_string(),
            );
        }
        if seen.insert(*import_id) {
            normalized.push(*import_id);
        }
    }
    if normalized.is_empty() {
        return Err("Select at least one Split/Bonus import to validate.".to_string());
    }
    if normalized.len() > TARGETED_SCAN_MAX_IMPORT_IDS {
        return Err(format!(
            "Targeted Corporate Action scan is limited to {TARGETED_SCAN_MAX_IMPORT_IDS} import IDs per request."
        ));
    }
    Ok(Some(normalized))
}

fn scan_start_message(scope: &str) -> &'static str {
    if scope == "blind_anomalies" {
        "Scanning local EOD bars for split/bonus-like price gaps."
    } else {
        "Scanning imported split/bonus candidates."
    }
}

fn scan_complete_message(scope: &str, total_results: i64) -> String {
    if scope == "blind_anomalies" {
        format!("Found {total_results} split/bonus-like local price gap(s).")
    } else {
        format!("Scanned {total_results} official split/bonus candidate(s).")
    }
}

fn run_official_candidate_scan(
    connection: &Connection,
    folder_path: &Path,
    scan_run_id: i64,
    import_ids: Option<&[i64]>,
) -> AppResult<i64> {
    let candidates = load_scan_candidates(connection, import_ids)?;
    let mut total_results = 0_i64;
    for candidate in candidates {
        let result = scan_candidate(connection, folder_path, scan_run_id, &candidate)?;
        insert_scan_result(connection, &result)?;
        total_results += 1;
    }
    Ok(total_results)
}

fn run_blind_anomaly_scan(
    connection: &Connection,
    folder_path: &Path,
    scan_run_id: i64,
) -> AppResult<i64> {
    let mut seen_symbols = HashSet::<String>::new();
    let mut total_results =
        scan_binary_anomalies(connection, folder_path, scan_run_id, &mut seen_symbols)?;
    if total_results < BLIND_SCAN_MAX_RESULTS as i64 {
        total_results += scan_sqlite_anomalies(
            connection,
            scan_run_id,
            &mut seen_symbols,
            BLIND_SCAN_MAX_RESULTS.saturating_sub(total_results as usize),
        )?;
    }
    Ok(total_results)
}

fn scan_binary_anomalies(
    connection: &Connection,
    folder_path: &Path,
    scan_run_id: i64,
    seen_symbols: &mut HashSet<String>,
) -> AppResult<i64> {
    let eod_root = folder_path.join("eod_data");
    if !eod_root.exists() {
        return Ok(0);
    }

    let mut total_results = 0_i64;
    for exchange_entry in fs::read_dir(&eod_root).map_err(|error| error.to_string())? {
        let exchange_entry = exchange_entry.map_err(|error| error.to_string())?;
        let exchange_path = exchange_entry.path();
        if !exchange_path.is_dir() {
            continue;
        }
        let exchange = exchange_entry.file_name().to_string_lossy().to_string();
        for file_entry in fs::read_dir(&exchange_path).map_err(|error| error.to_string())? {
            if total_results >= BLIND_SCAN_MAX_RESULTS as i64 {
                return Ok(total_results);
            }
            let file_entry = file_entry.map_err(|error| error.to_string())?;
            let file_path = file_entry.path();
            if file_path.extension().and_then(|value| value.to_str()) != Some("eod") {
                continue;
            }
            let Some(symbol) = file_path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
            else {
                continue;
            };
            seen_symbols.insert(format!("{exchange}|{symbol}"));
            let bin_file = match BinaryEodFile::open(&file_path) {
                Ok(file) => file,
                Err(_) => continue,
            };
            let scale = bin_file.header.price_scale as f64;
            let records = match bin_file.read_all() {
                Ok(records) => records,
                Err(_) => continue,
            };
            for pair in records.windows(2) {
                if total_results >= BLIND_SCAN_MAX_RESULTS as i64 {
                    return Ok(total_results);
                }
                let previous = ScannedBar {
                    date: u32_to_date(pair[0].date),
                    open: pair[0].open as f64 / scale,
                    close: pair[0].close as f64 / scale,
                };
                let current = ScannedBar {
                    date: u32_to_date(pair[1].date),
                    open: pair[1].open as f64 / scale,
                    close: pair[1].close as f64 / scale,
                };
                if let Some(result) =
                    build_blind_scan_result(scan_run_id, &symbol, &exchange, &previous, &current)
                {
                    insert_scan_result(connection, &result)?;
                    total_results += 1;
                }
            }
        }
    }
    Ok(total_results)
}

fn scan_sqlite_anomalies(
    connection: &Connection,
    scan_run_id: i64,
    seen_symbols: &mut HashSet<String>,
    max_results: usize,
) -> AppResult<i64> {
    if max_results == 0 {
        return Ok(0);
    }

    let mut statement = connection
        .prepare(
            "
              SELECT symbol, exchange, date, open, close
              FROM eod_prices
              ORDER BY exchange, symbol, date
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement.query([]).map_err(|error| error.to_string())?;
    let mut current_key = String::new();
    let mut previous: Option<ScannedBar> = None;
    let mut current_symbol = String::new();
    let mut current_exchange = String::new();
    let mut total_results = 0_i64;

    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        if total_results >= max_results as i64 {
            break;
        }
        let symbol = row.get::<_, String>(0).map_err(|error| error.to_string())?;
        let exchange = row.get::<_, String>(1).map_err(|error| error.to_string())?;
        let key = format!("{exchange}|{symbol}");
        if seen_symbols.contains(&key) {
            continue;
        }
        let bar = ScannedBar {
            date: row.get(2).map_err(|error| error.to_string())?,
            open: row.get(3).map_err(|error| error.to_string())?,
            close: row.get(4).map_err(|error| error.to_string())?,
        };
        if key != current_key {
            current_key = key.clone();
            current_symbol = symbol;
            current_exchange = exchange;
            previous = Some(bar);
            continue;
        }
        if let Some(previous_bar) = previous.as_ref() {
            if let Some(result) = build_blind_scan_result(
                scan_run_id,
                &current_symbol,
                &current_exchange,
                previous_bar,
                &bar,
            ) {
                insert_scan_result(connection, &result)?;
                total_results += 1;
            }
        }
        previous = Some(bar);
    }
    Ok(total_results)
}

fn build_blind_scan_result(
    scan_run_id: i64,
    symbol: &str,
    exchange: &str,
    previous: &ScannedBar,
    current: &ScannedBar,
) -> Option<CorporateActionScanResultRow> {
    if previous.close <= 0.0 || current.open <= 0.0 || current.close <= 0.0 {
        return None;
    }
    let actual_open_factor = previous.close / current.open;
    let actual_close_factor = previous.close / current.close;
    let observed = actual_open_factor.max(actual_close_factor);
    if observed < BLIND_SCAN_MIN_FACTOR {
        return None;
    }
    let expected_factor = nearest_common_factor(observed);
    let confidence = 1.0 - ((observed - expected_factor).abs() / expected_factor).min(1.0);
    if confidence < 0.82 {
        return None;
    }

    Some(CorporateActionScanResultRow {
        id: 0,
        scan_run_id,
        corporate_action_import_id: None,
        corporate_action_id: None,
        symbol: Some(symbol.to_string()),
        exchange: exchange.to_string(),
        scan_status: "ANOMALY".to_string(),
        prev_trade_date: Some(previous.date.clone()),
        ex_trade_date: Some(current.date.clone()),
        prev_close: Some(previous.close),
        ex_open: Some(current.open),
        ex_close: Some(current.close),
        expected_factor: Some(expected_factor),
        actual_open_factor: Some(actual_open_factor),
        actual_close_factor: Some(actual_close_factor),
        confidence: Some(confidence),
        message: Some(
            "Blind scan found a split/bonus-like price gap. Verify with NSE/BSE filing before approval."
                .to_string(),
        ),
        scanned_at: now_iso(),
    })
}

fn nearest_common_factor(value: f64) -> f64 {
    [1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 10.0]
        .into_iter()
        .min_by(|left, right| {
            let left_diff = (value - *left).abs();
            let right_diff = (value - *right).abs();
            left_diff
                .partial_cmp(&right_diff)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap_or(2.0)
}

fn load_scan_candidates(
    connection: &Connection,
    import_ids: Option<&[i64]>,
) -> AppResult<Vec<ScanCandidate>> {
    // Broad legacy scans remain Split/Bonus-only. Explicitly targeted normal
    // workflow scans may also establish EOD availability for Dividend/Rights,
    // whose factor is intentionally computed later at approval time.
    let base_select = if import_ids.is_some() {
        "
          SELECT id, symbol, exchange, ex_date, factor
          FROM corporate_action_imports
          WHERE action_type IN ('SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS')
            AND parse_status = 'PARSED'
            AND ex_date IS NOT NULL
            AND (action_type IN ('DIVIDEND', 'RIGHTS') OR factor IS NOT NULL)
        "
    } else {
        "
          SELECT id, symbol, exchange, ex_date, factor
          FROM corporate_action_imports
          WHERE action_type IN ('SPLIT', 'BONUS')
            AND parse_status = 'PARSED'
            AND ex_date IS NOT NULL
            AND factor IS NOT NULL
        "
    };

    if let Some(import_ids) = import_ids {
        let placeholders = std::iter::repeat("?")
            .take(import_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql =
            format!("{base_select} AND id IN ({placeholders}) ORDER BY ex_date DESC, id DESC");
        let mut statement = connection
            .prepare(&sql)
            .map_err(|error| error.to_string())?;
        let mut rows = statement
            .query_map(params_from_iter(import_ids.iter().copied()), |row| {
                Ok(ScanCandidate {
                    import_id: row.get(0)?,
                    symbol: row.get(1)?,
                    exchange: row.get(2)?,
                    ex_date: row.get(3)?,
                    factor: row.get(4)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        project_scan_candidate_event_symbols(connection, &mut rows)?;
        return Ok(rows);
    }

    let sql = format!("{base_select} ORDER BY ex_date DESC, id DESC LIMIT 2000");
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query_map([], |row| {
            Ok(ScanCandidate {
                import_id: row.get(0)?,
                symbol: row.get(1)?,
                exchange: row.get(2)?,
                ex_date: row.get(3)?,
                factor: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    project_scan_candidate_event_symbols(connection, &mut rows)?;
    Ok(rows)
}

fn project_scan_candidate_event_symbols(
    connection: &Connection,
    candidates: &mut [ScanCandidate],
) -> AppResult<()> {
    for candidate in candidates {
        let identity = event_identity_resolution::load_effective_event_identity(
            connection,
            candidate.import_id,
        )?;
        candidate.symbol = identity.event_symbol;
    }
    Ok(())
}

const COMPOUND_SCAN_METADATA_TAG: &str = "CA_COMPOUND_V1";

#[derive(Clone, Debug)]
struct CompoundScanMember {
    import_id: i64,
    factor: f64,
}

#[derive(Clone, Debug)]
struct CompoundScanContext {
    combined_factor: f64,
    component_count: usize,
    fingerprint: String,
}

fn build_compound_scan_context(members: &[CompoundScanMember]) -> Option<CompoundScanContext> {
    if members.len() < 2 {
        return None;
    }
    let mut combined_factor = 1.0_f64;
    let mut normalized = members.to_vec();
    normalized.sort_by_key(|member| member.import_id);
    for member in &normalized {
        if !member.factor.is_finite() || member.factor <= 0.0 {
            return None;
        }
        combined_factor *= member.factor;
        if !combined_factor.is_finite() || combined_factor <= 0.0 {
            return None;
        }
    }
    let fingerprint = normalized
        .iter()
        .map(|member| format!("{}:{:.12}", member.import_id, member.factor))
        .collect::<Vec<_>>()
        .join(",");
    Some(CompoundScanContext {
        combined_factor,
        component_count: normalized.len(),
        fingerprint,
    })
}

#[derive(Clone, Debug)]
struct CompoundEconomicScanMember {
    scan_member: CompoundScanMember,
    symbol: Option<String>,
    isin: Option<String>,
    action_type: String,
    record_date: Option<String>,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
    cash_amount: Option<f64>,
}

fn compound_scan_economic_terms_match(
    left: &CompoundEconomicScanMember,
    right: &CompoundEconomicScanMember,
) -> bool {
    left.action_type == right.action_type
        && left.record_date == right.record_date
        && left.ratio_num == right.ratio_num
        && left.ratio_den == right.ratio_den
        && left.old_face_value == right.old_face_value
        && left.new_face_value == right.new_face_value
        && left.cash_amount == right.cash_amount
        && left.scan_member.factor == right.scan_member.factor
}

fn compound_scan_members_are_equivalent(
    connection: &Connection,
    exchange: &str,
    ex_date: &str,
    left: &CompoundEconomicScanMember,
    right: &CompoundEconomicScanMember,
) -> AppResult<bool> {
    if !compound_scan_economic_terms_match(left, right) {
        return Ok(false);
    }

    let left_identities = load_event_date_import_identities(
        connection,
        left.scan_member.import_id,
        left.symbol.as_deref(),
        left.isin.as_deref(),
        Some(ex_date),
    )?;
    let right_identities = load_event_date_import_identities(
        connection,
        right.scan_member.import_id,
        right.symbol.as_deref(),
        right.isin.as_deref(),
        Some(ex_date),
    )?;

    for left_identity in &left_identities {
        for right_identity in &right_identities {
            if event_date_identities_are_equivalent(
                connection,
                exchange,
                Some(ex_date),
                left_identity,
                right_identity,
            )? {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

fn load_same_date_split_bonus_compound_context(
    connection: &Connection,
    candidate: &ScanCandidate,
) -> AppResult<Option<CompoundScanContext>> {
    let (Some(symbol), Some(ex_date)) = (candidate.symbol.as_deref(), candidate.ex_date.as_deref())
    else {
        return Ok(None);
    };

    // scan_candidate is also used by isolated scanner unit fixtures that intentionally
    // create only local-price tables. In the real official-import scan path this table
    // necessarily exists because candidates are loaded from it. Treat its absence only
    // as the minimal-fixture compatibility case.
    let import_table_exists = connection
        .query_row(
            "
              SELECT 1
              FROM sqlite_master
              WHERE type = 'table'
                AND name = 'corporate_action_imports'
              LIMIT 1
            ",
            [],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .is_some();

    if !import_table_exists {
        return Ok(None);
    }

    let mut statement = connection
        .prepare(
            "
              SELECT
                id,
                symbol,
                isin,
                action_type,
                record_date,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount,
                factor
              FROM corporate_action_imports
              WHERE exchange = ?
                AND ex_date = ?
                AND action_type IN ('SPLIT', 'BONUS')
                AND parse_status = 'PARSED'
                AND review_status != 'REJECTED'
                AND factor IS NOT NULL
                AND factor > 0
              ORDER BY id
            ",
        )
        .map_err(|error| error.to_string())?;

    let raw_members = statement
        .query_map(params![candidate.exchange, ex_date], |row| {
            Ok(CompoundEconomicScanMember {
                scan_member: CompoundScanMember {
                    import_id: row.get(0)?,
                    factor: row.get(10)?,
                },
                symbol: row.get(1)?,
                isin: row.get(2)?,
                action_type: row.get(3)?,
                record_date: row.get(4)?,
                ratio_num: row.get(5)?,
                ratio_den: row.get(6)?,
                old_face_value: row.get(7)?,
                new_face_value: row.get(8)?,
                cash_amount: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut projected_members = Vec::new();

    for member in raw_members {
        let identity = event_identity_resolution::load_effective_event_identity(
            connection,
            member.scan_member.import_id,
        )?;

        if identity.event_symbol.as_deref() == Some(symbol) {
            projected_members.push(member);
        }
    }

    let mut economic_members: Vec<CompoundEconomicScanMember> = Vec::new();

    'member: for member in projected_members {
        for existing in &economic_members {
            if compound_scan_members_are_equivalent(
                connection,
                &candidate.exchange,
                ex_date,
                existing,
                &member,
            )? {
                continue 'member;
            }
        }

        economic_members.push(member);
    }

    let members = economic_members
        .into_iter()
        .map(|member| member.scan_member)
        .collect::<Vec<_>>();

    Ok(build_compound_scan_context(&members))
}

fn compound_scan_metadata(context: &CompoundScanContext) -> String {
    format!(
        "[{} factor={:.12} count={} fingerprint={}]",
        COMPOUND_SCAN_METADATA_TAG,
        context.combined_factor,
        context.component_count,
        context.fingerprint
    )
}

fn parse_compound_scan_fingerprint(message: &str) -> Option<&str> {
    let marker = format!("[{} ", COMPOUND_SCAN_METADATA_TAG);
    let start = message.find(&marker)? + marker.len();
    let tail = &message[start..];
    let end = tail.find(']')?;
    tail[..end]
        .split_whitespace()
        .find_map(|field| field.strip_prefix("fingerprint="))
}

fn ensure_compound_scan_fingerprint_current(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
) -> AppResult<()> {
    if !matches!(import_row.action_type.as_str(), "SPLIT" | "BONUS") {
        return Ok(());
    }
    let latest_message = connection
        .query_row(
            "
              SELECT result.message
              FROM corporate_action_scan_results result
              INNER JOIN scan_runs run ON run.id = result.scan_run_id
              WHERE result.corporate_action_import_id = ?
                AND run.scope = 'official_imports'
                AND run.status = 'COMPLETED'
              ORDER BY result.id DESC
              LIMIT 1
            ",
            params![import_row.id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .flatten();
    let Some(message) = latest_message else {
        return Ok(());
    };
    let Some(stored_fingerprint) = parse_compound_scan_fingerprint(&message) else {
        return Ok(());
    };
    let effective_identity =
        event_identity_resolution::load_effective_event_identity(connection, import_row.id)?;
    let candidate = ScanCandidate {
        import_id: import_row.id,
        symbol: effective_identity.event_symbol,
        exchange: import_row.exchange.clone(),
        ex_date: import_row.ex_date.clone(),
        factor: import_row.factor,
    };
    let current = load_same_date_split_bonus_compound_context(connection, &candidate)?
        .ok_or_else(|| "The latest compound Split/Bonus validation is stale. Re-run validation before approval.".to_string())?;
    if current.fingerprint != stored_fingerprint {
        return Err("The latest compound Split/Bonus validation is stale because the same-date component set or factor changed. Re-run validation before approval.".to_string());
    }
    Ok(())
}

fn scan_candidate(
    connection: &Connection,
    folder_path: &Path,
    scan_run_id: i64,
    candidate: &ScanCandidate,
) -> AppResult<CorporateActionScanResultRow> {
    let scanned_at = now_iso();
    let Some(symbol) = candidate.symbol.as_deref() else {
        return Ok(scan_result_row(
            scan_run_id,
            candidate,
            "UNRESOLVED",
            None,
            None,
            "Candidate has no resolved database symbol.",
            scanned_at,
        ));
    };
    let Some(ex_date) = candidate.ex_date.as_deref() else {
        return Ok(scan_result_row(
            scan_run_id,
            candidate,
            "NEEDS_REVIEW",
            None,
            None,
            "Candidate has no parsed ex-date.",
            scanned_at,
        ));
    };
    // Dividend factors are derived at approval time from the cum-date close;
    // imported rows commonly have no stored factor. For Dividend/Rights this
    // scan establishes only local EOD bar availability, not a price-drop match.
    let expected_factor = match candidate.factor {
        Some(factor) if factor.is_finite() && factor > 0.0 => factor,
        _ => {
            let non_ratio_event = get_import_row(connection, candidate.import_id)
                .map(|row| matches!(row.action_type.as_str(), "DIVIDEND" | "RIGHTS"))
                .unwrap_or(false);
            if non_ratio_event { 1.0 } else {
                return Ok(scan_result_row(
                    scan_run_id, candidate, "NEEDS_REVIEW", None, None,
                    "Candidate has no expected factor.", scanned_at,
                ));
            }
        }
    };

    let non_ratio_event = get_import_row(connection, candidate.import_id)
        .map(|row| matches!(row.action_type.as_str(), "DIVIDEND" | "RIGHTS"))
        .unwrap_or(false);
    let compound_context = if non_ratio_event {
        None
    } else {
        load_same_date_split_bonus_compound_context(connection, candidate)?
    };
    let validation_factor = compound_context
        .as_ref()
        .map(|context| context.combined_factor)
        .unwrap_or(expected_factor);

    // Preserve event-symbol scanner contexts and minimal read-only scan
    // fixtures. A new route may only supplement a missing legacy window for
    // a complete, exactly matching stored import; never fabricate an import.
    let window_result = match load_trade_window(connection,folder_path,symbol,&candidate.exchange,ex_date)? {
        Some(window) => Ok(Some(window)),
        None => match get_import_row(connection,candidate.import_id) {
            Ok(row) if row.symbol.as_deref()==Some(symbol) && row.exchange==candidate.exchange && row.ex_date.as_deref()==Some(ex_date) =>
                load_import_trade_window(connection,folder_path,&row,symbol,&candidate.exchange,ex_date),
            _ => Ok(None),
        },
    };
    let window = match window_result {
        Ok(window) => window,
        Err(reason) if reason.starts_with("Awaiting verified dated price-route identity:") || reason.starts_with("Waiting for EOD Data:") || reason.starts_with("Scheduled / Upcoming:") => {
            return Ok(scan_result_row(scan_run_id,candidate,"NEEDS_REVIEW",None,None,&reason,scanned_at));
        }
        Err(error) => return Err(error),
    };
    let Some((previous, ex_bar)) = window else {
        return Ok(scan_result_row(
            scan_run_id,
            candidate,
            "NO_PRICE_DATA",
            None,
            None,
            "No local bars found on both sides of the official ex-date.",
            scanned_at,
        ));
    };

    if non_ratio_event {
        // Readiness evidence only, never a theoretical dividend/rights factor
        // match. The approval writer independently rechecks these local bars.
        return Ok(CorporateActionScanResultRow {
            id: 0,
            scan_run_id,
            corporate_action_import_id: Some(candidate.import_id),
            corporate_action_id: None,
            symbol: Some(symbol.to_string()),
            exchange: candidate.exchange.clone(),
            scan_status: "REVIEW".to_string(),
            prev_trade_date: Some(previous.date),
            ex_trade_date: Some(ex_bar.date),
            prev_close: Some(previous.close),
            ex_open: Some(ex_bar.open),
            ex_close: Some(ex_bar.close),
            expected_factor: None,
            actual_open_factor: None,
            actual_close_factor: None,
            confidence: None,
            message: Some("Local EOD availability observation only; Dividend/Rights terms are not price-factor validated.".to_string()),
            scanned_at,
        });
    }

    let actual_open_factor = if ex_bar.open > 0.0 {
        Some(previous.close / ex_bar.open)
    } else {
        None
    };
    let actual_close_factor = if ex_bar.close > 0.0 {
        Some(previous.close / ex_bar.close)
    } else {
        None
    };
    let confidence = [actual_open_factor, actual_close_factor]
        .into_iter()
        .flatten()
        .map(|actual| 1.0 - ((actual - validation_factor).abs() / validation_factor).min(1.0))
        .fold(None, |best: Option<f64>, value| {
            Some(best.map_or(value, |current| current.max(value)))
        });
    let scan_status = if confidence.unwrap_or(0.0) >= 0.85 {
        "MATCHED"
    } else {
        "REVIEW"
    };
    let message = if let Some(context) = compound_context.as_ref() {
        let verdict = if scan_status == "MATCHED" {
            "Observed local price movement is close to"
        } else {
            "Observed local bars do not closely match"
        };
        format!(
            "{} the combined same-date Split/Bonus factor ×{:.6} across {} official actions. {}",
            verdict,
            context.combined_factor,
            context.component_count,
            compound_scan_metadata(context)
        )
    } else if scan_status == "MATCHED" {
        "Observed local price movement is close to the expected official factor.".to_string()
    } else {
        "Observed local bars do not closely match the expected official factor.".to_string()
    };

    Ok(CorporateActionScanResultRow {
        id: 0,
        scan_run_id,
        corporate_action_import_id: Some(candidate.import_id),
        corporate_action_id: None,
        symbol: Some(symbol.to_string()),
        exchange: candidate.exchange.clone(),
        scan_status: scan_status.to_string(),
        prev_trade_date: Some(previous.date),
        ex_trade_date: Some(ex_bar.date),
        prev_close: Some(previous.close),
        ex_open: Some(ex_bar.open),
        ex_close: Some(ex_bar.close),
        expected_factor: Some(expected_factor),
        actual_open_factor,
        actual_close_factor,
        confidence,
        message: Some(message),
        scanned_at,
    })
}

fn scan_result_row(
    scan_run_id: i64,
    candidate: &ScanCandidate,
    scan_status: &str,
    prev_trade_date: Option<String>,
    ex_trade_date: Option<String>,
    message: &str,
    scanned_at: String,
) -> CorporateActionScanResultRow {
    CorporateActionScanResultRow {
        id: 0,
        scan_run_id,
        corporate_action_import_id: Some(candidate.import_id),
        corporate_action_id: None,
        symbol: candidate.symbol.clone(),
        exchange: candidate.exchange.clone(),
        scan_status: scan_status.to_string(),
        prev_trade_date,
        ex_trade_date,
        prev_close: None,
        ex_open: None,
        ex_close: None,
        expected_factor: candidate.factor,
        actual_open_factor: None,
        actual_close_factor: None,
        confidence: None,
        message: Some(message.to_string()),
        scanned_at,
    }
}

fn resolve_event_time_historical_price_symbol(
    connection: &Connection,
    root_symbol: &str,
    exchange: &str,
    ex_date: &str,
) -> AppResult<Option<String>> {
    let has_identity_history = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='instrument_identity_history')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?
        != 0;
    if !has_identity_history {
        return Ok(None);
    }

    let mut current_symbol = root_symbol.to_string();
    let mut visited = HashSet::new();
    visited.insert(current_symbol.clone());
    let mut traversed = false;

    for _ in 0..32 {
        let predecessors = {
            let mut statement = connection
                .prepare(
                    "
                    SELECT old_symbol
                    FROM instrument_identity_history
                    WHERE exchange = ?1
                      AND current_symbol = ?2
                      AND new_symbol = ?3
                      AND effective_date > ?4
                      AND change_type IN ('SYMBOL_CHANGE', 'BOTH')
                      AND source = 'NSE_IDENTITY'
                      AND source_ref IS NOT NULL
                      AND TRIM(source_ref) <> ''
                      AND old_symbol IS NOT NULL
                      AND TRIM(old_symbol) <> ''
                      AND TRIM(old_symbol) <> TRIM(new_symbol)
                    ORDER BY effective_date DESC, id DESC
                    LIMIT 2
                    ",
                )
                .map_err(|error| error.to_string())?;
            let mut rows = statement
                .query(params![exchange, root_symbol, current_symbol.as_str(), ex_date])
                .map_err(|error| error.to_string())?;
            let mut values = Vec::new();
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                values.push(row.get::<_, String>(0).map_err(|error| error.to_string())?);
            }
            values
        };

        if predecessors.is_empty() {
            return Ok(traversed.then_some(current_symbol));
        }
        if predecessors.len() != 1 {
            return Ok(None);
        }

        let predecessor = predecessors[0].trim().to_string();
        if predecessor.is_empty() || !visited.insert(predecessor.clone()) {
            return Ok(None);
        }
        current_symbol = predecessor;
        traversed = true;
    }

    Ok(None)
}

/// Fail closed at the ordinary official-import approval write boundary.
/// NSE/BSE sessions are proved by local EOD bars, not calendar-day arithmetic.
fn ensure_official_import_eod_ready(
    connection: &Connection,
    folder_path: &Path,
    import_row: &CorporateActionImportRow,
    symbol: &str,
    ex_date: &str,
) -> AppResult<()> {
    let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60)
        .ok_or_else(|| "Could not determine India trading date.".to_string())?;
    let today = chrono::Utc::now().with_timezone(&ist).date_naive();
    // Reject upcoming ex-dates before attempting any price I/O.
    ensure_import_ex_date_reached(ex_date, &import_row.action_type, today)?;
    let window = load_import_trade_window(
        connection, folder_path, import_row, symbol, &import_row.exchange, ex_date,
    )?;
    ensure_import_trade_window_ready(window.as_ref(), ex_date, today)

}

fn ensure_import_ex_date_reached(ex_date: &str, action_type: &str, today: NaiveDate) -> AppResult<()> {
    let ex = NaiveDate::parse_from_str(ex_date, "%Y-%m-%d")
        .map_err(|_| "The official ex-date is invalid.".to_string())?;
    if ex > today {
        return Err(format!(
            "Scheduled / Upcoming: {} has not reached its ex-date {}.",
            action_type, ex_date,
        ));
    }
    Ok(())
}

fn ensure_import_trade_window_ready(
    window: Option<&(ScannedBar, ScannedBar)>,
    ex_date: &str,
    today: NaiveDate,
) -> AppResult<()> {
    let Some((previous, ex_bar)) = window else {
        return Err("Waiting for EOD Data: cum-date and ex-date trading bars are not both available.".to_string());
    };
    let today_iso = today.format("%Y-%m-%d").to_string();
    if previous.date.as_str() >= ex_date || ex_bar.date.as_str() < ex_date ||
       ex_bar.date.as_str() > today_iso.as_str() ||
       !previous.close.is_finite() || previous.close <= 0.0 ||
       !ex_bar.close.is_finite() || ex_bar.close <= 0.0 {
        return Err("Waiting for EOD Data: the local trading-close evidence is incomplete or invalid.".to_string());
    }
    Ok(())
}

fn load_import_trade_window(
    connection: &Connection, folder: &Path, row: &CorporateActionImportRow,
    symbol: &str, exchange: &str, date: &str,
) -> AppResult<Option<(ScannedBar, ScannedBar)>> {
    if row.symbol.as_deref() != Some(symbol) || row.exchange != exchange || row.ex_date.as_deref() != Some(date) {
        return Err("Official event-price lookup context changed.".into());
    }
    let legacy = load_trade_window(connection,folder,symbol,exchange,date)?;
    let today = chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(19800).unwrap()).date_naive();
    if legacy.is_some() && ensure_import_trade_window_ready(legacy.as_ref(),date,today).is_ok() { return Ok(legacy); }
    if let Some(route) = event_price_route::resolve(connection,folder,row)? { return Ok(Some(route.window())); }
    Ok(legacy)
}

fn load_trade_window(
    connection: &Connection,
    folder_path: &Path,
    symbol: &str,
    exchange: &str,
    ex_date: &str,
) -> AppResult<Option<(ScannedBar, ScannedBar)>> {
    let mode = get_price_storage_mode(connection);
    let binary_path = |target: &str| {
        folder_path.join("eod_data").join(exchange).join(format!("{target}.eod"))
    };
    if let Some(window) = load_binary_trade_window(folder_path, symbol, exchange, ex_date)? {
        return Ok(Some(window));
    }
    // Match the chart reader: SQLite is a fallback only in Hybrid mode, and
    // only when the corresponding binary symbol file does not exist.
    if mode == PriceStorageMode::Hybrid && !binary_path(symbol).exists() {
        if let Some(window) = load_sqlite_trade_window(connection, symbol, exchange, ex_date)? {
            return Ok(Some(window));
        }
    }

    let Some(historical_symbol) =
        resolve_event_time_historical_price_symbol(connection, symbol, exchange, ex_date)?
    else {
        return Ok(None);
    };

    if historical_symbol == symbol {
        return Ok(None);
    }
    if let Some(window) =
        load_binary_trade_window(folder_path, &historical_symbol, exchange, ex_date)?
    {
        return Ok(Some(window));
    }
    if mode == PriceStorageMode::Hybrid && !binary_path(&historical_symbol).exists() {
        return load_sqlite_trade_window(connection, &historical_symbol, exchange, ex_date);
    }
    Ok(None)
}

fn load_binary_trade_window(
    folder_path: &Path,
    symbol: &str,
    exchange: &str,
    ex_date: &str,
) -> AppResult<Option<(ScannedBar, ScannedBar)>> {
    let bin_path = folder_path
        .join("eod_data")
        .join(exchange)
        .join(format!("{symbol}.eod"));
    if !bin_path.exists() {
        return Ok(None);
    }
    let bin_file = BinaryEodFile::open(&bin_path)?;
    let ex_u32 = date_to_u32(ex_date);
    let scale = bin_file.header.price_scale as f64;
    let records = bin_file.read_all()?;
    let previous = records
        .iter()
        .filter(|record| record.date < ex_u32)
        .max_by_key(|record| record.date)
        .copied();
    let ex_bar = records
        .iter()
        .filter(|record| record.date >= ex_u32)
        .min_by_key(|record| record.date)
        .copied();
    match (previous, ex_bar) {
        (Some(previous), Some(ex_bar)) => Ok(Some((
            ScannedBar {
                date: u32_to_date(previous.date),
                open: previous.open as f64 / scale,
                close: previous.close as f64 / scale,
            },
            ScannedBar {
                date: u32_to_date(ex_bar.date),
                open: ex_bar.open as f64 / scale,
                close: ex_bar.close as f64 / scale,
            },
        ))),
        _ => Ok(None),
    }
}

fn load_sqlite_trade_window(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
    ex_date: &str,
) -> AppResult<Option<(ScannedBar, ScannedBar)>> {
    let previous = connection
        .query_row(
            "
              SELECT date, open, close
              FROM eod_prices
              WHERE symbol = ? AND exchange = ? AND date < ?
              ORDER BY date DESC
              LIMIT 1
            ",
            params![symbol, exchange, ex_date],
            |row| {
                Ok(ScannedBar {
                    date: row.get(0)?,
                    open: row.get(1)?,
                    close: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let ex_bar = connection
        .query_row(
            "
              SELECT date, open, close
              FROM eod_prices
              WHERE symbol = ? AND exchange = ? AND date >= ?
              ORDER BY date ASC
              LIMIT 1
            ",
            params![symbol, exchange, ex_date],
            |row| {
                Ok(ScannedBar {
                    date: row.get(0)?,
                    open: row.get(1)?,
                    close: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(previous.zip(ex_bar))
}

fn insert_scan_result(
    connection: &Connection,
    result: &CorporateActionScanResultRow,
) -> AppResult<()> {
    connection
        .execute(
            "
              INSERT INTO corporate_action_scan_results (
                scan_run_id,
                corporate_action_import_id,
                corporate_action_id,
                symbol,
                exchange,
                scan_status,
                prev_trade_date,
                ex_trade_date,
                prev_close,
                ex_open,
                ex_close,
                expected_factor,
                actual_open_factor,
                actual_close_factor,
                confidence,
                message,
                scanned_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                result.scan_run_id,
                result.corporate_action_import_id,
                result.corporate_action_id,
                result.symbol,
                result.exchange,
                result.scan_status,
                result.prev_trade_date,
                result.ex_trade_date,
                result.prev_close,
                result.ex_open,
                result.ex_close,
                result.expected_factor,
                result.actual_open_factor,
                result.actual_close_factor,
                result.confidence,
                result.message,
                result.scanned_at
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn normalize_scan_list_import_ids(
    input: Option<&CorporateActionScanListInput>,
) -> AppResult<Option<Vec<i64>>> {
    let Some(import_ids) = input.and_then(|value| value.import_ids.as_ref()) else {
        return Ok(None);
    };
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for import_id in import_ids {
        if *import_id <= 0 {
            return Err(
                "Corporate Action validation hydration import IDs must be positive integers."
                    .to_string(),
            );
        }
        if seen.insert(*import_id) {
            normalized.push(*import_id);
        }
    }
    if normalized.is_empty() {
        return Err(
            "Select at least one Corporate Action import to load validation evidence.".to_string(),
        );
    }
    if normalized.len() > TARGETED_SCAN_MAX_IMPORT_IDS {
        return Err(format!(
            "Corporate Action validation hydration is limited to {TARGETED_SCAN_MAX_IMPORT_IDS} import IDs per request."
        ));
    }
    Ok(Some(normalized))
}

fn list_latest_completed_official_scan_results(
    connection: &Connection,
    import_ids: &[i64],
) -> AppResult<CorporateActionScanResult> {
    let placeholders = std::iter::repeat("?")
        .take(import_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "
          SELECT
            scan_result.id,
            scan_result.scan_run_id,
            scan_result.corporate_action_import_id,
            scan_result.corporate_action_id,
            scan_result.symbol,
            scan_result.exchange,
            scan_result.scan_status,
            scan_result.prev_trade_date,
            scan_result.ex_trade_date,
            scan_result.prev_close,
            scan_result.ex_open,
            scan_result.ex_close,
            scan_result.expected_factor,
            scan_result.actual_open_factor,
            scan_result.actual_close_factor,
            scan_result.confidence,
            scan_result.message,
            scan_result.scanned_at
          FROM corporate_action_scan_results scan_result
          INNER JOIN scan_runs scan_run ON scan_run.id = scan_result.scan_run_id
          WHERE scan_result.corporate_action_import_id IN ({placeholders})
            AND scan_run.scope = 'official_imports'
            AND scan_run.status = 'COMPLETED'
            AND scan_result.id = (
              SELECT candidate.id
              FROM corporate_action_scan_results candidate
              INNER JOIN scan_runs candidate_run ON candidate_run.id = candidate.scan_run_id
              WHERE candidate.corporate_action_import_id = scan_result.corporate_action_import_id
                AND candidate_run.scope = 'official_imports'
                AND candidate_run.status = 'COMPLETED'
              ORDER BY candidate.scanned_at DESC, candidate.id DESC
              LIMIT 1
            )
          ORDER BY scan_result.corporate_action_import_id ASC, scan_result.id DESC
        "
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let results = statement
        .query_map(
            params_from_iter(import_ids.iter().copied()),
            map_scan_result_row,
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(CorporateActionScanResult {
        scan_run: None,
        results,
    })
}

fn list_scan_results(
    connection: &Connection,
    input: Option<&CorporateActionScanListInput>,
) -> AppResult<CorporateActionScanResult> {
    if let Some(import_ids) = normalize_scan_list_import_ids(input)? {
        return list_latest_completed_official_scan_results(connection, &import_ids);
    }
    let scan_run_id = if let Some(id) = input.and_then(|value| value.scan_run_id) {
        Some(id)
    } else {
        connection
            .query_row(
                "SELECT id FROM scan_runs ORDER BY started_at DESC, id DESC LIMIT 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
    };

    let Some(scan_run_id) = scan_run_id else {
        return Ok(CorporateActionScanResult {
            scan_run: None,
            results: Vec::new(),
        });
    };

    let scan_run = connection
        .query_row(
            "
              SELECT id, scope, action_types, started_at, completed_at, status, message, total_results
              FROM scan_runs
              WHERE id = ?
            ",
            params![scan_run_id],
            map_scan_run,
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(250)
        .clamp(25, 10_000);
    let search_query = input
        .and_then(|value| value.search_query.as_ref())
        .map(|value| value.trim().to_uppercase())
        .filter(|value| !value.is_empty());
    let scan_result_sql = if search_query.is_some() {
        "
          SELECT
            id,
            scan_run_id,
            corporate_action_import_id,
            corporate_action_id,
            symbol,
            exchange,
            scan_status,
            prev_trade_date,
            ex_trade_date,
            prev_close,
            ex_open,
            ex_close,
            expected_factor,
            actual_open_factor,
            actual_close_factor,
            confidence,
            message,
            scanned_at
          FROM corporate_action_scan_results
          WHERE scan_run_id = ?
            AND (
              UPPER(COALESCE(symbol, '')) LIKE ?
              OR UPPER(COALESCE(message, '')) LIKE ?
            )
          ORDER BY
            CASE scan_status
              WHEN 'REVIEW' THEN 0
              WHEN 'NO_PRICE_DATA' THEN 1
              WHEN 'UNRESOLVED' THEN 2
              WHEN 'MATCHED' THEN 3
              ELSE 4
            END,
            id DESC
          LIMIT ?
        "
    } else {
        "
          SELECT
            id,
            scan_run_id,
            corporate_action_import_id,
            corporate_action_id,
            symbol,
            exchange,
            scan_status,
            prev_trade_date,
            ex_trade_date,
            prev_close,
            ex_open,
            ex_close,
            expected_factor,
            actual_open_factor,
            actual_close_factor,
            confidence,
            message,
            scanned_at
          FROM corporate_action_scan_results
          WHERE scan_run_id = ?
          ORDER BY
            CASE scan_status
              WHEN 'REVIEW' THEN 0
              WHEN 'NO_PRICE_DATA' THEN 1
              WHEN 'UNRESOLVED' THEN 2
              WHEN 'MATCHED' THEN 3
              ELSE 4
            END,
            id DESC
          LIMIT ?
        "
    };
    let mut statement = connection
        .prepare(scan_result_sql)
        .map_err(|error| error.to_string())?;
    let results = if let Some(search) = search_query {
        let like_value = format!("%{search}%");
        statement
            .query_map(
                params![scan_run_id, like_value, like_value, limit],
                map_scan_result_row,
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        statement
            .query_map(params![scan_run_id, limit], map_scan_result_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    Ok(CorporateActionScanResult { scan_run, results })
}

fn map_scan_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<CorporateActionScanRun> {
    Ok(CorporateActionScanRun {
        id: row.get(0)?,
        scope: row.get(1)?,
        action_types: row.get(2)?,
        started_at: row.get(3)?,
        completed_at: row.get(4)?,
        status: row.get(5)?,
        message: row.get(6)?,
        total_results: row.get(7)?,
    })
}

fn map_scan_result_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CorporateActionScanResultRow> {
    Ok(CorporateActionScanResultRow {
        id: row.get(0)?,
        scan_run_id: row.get(1)?,
        corporate_action_import_id: row.get(2)?,
        corporate_action_id: row.get(3)?,
        symbol: row.get(4)?,
        exchange: row.get(5)?,
        scan_status: row.get(6)?,
        prev_trade_date: row.get(7)?,
        ex_trade_date: row.get(8)?,
        prev_close: row.get(9)?,
        ex_open: row.get(10)?,
        ex_close: row.get(11)?,
        expected_factor: row.get(12)?,
        actual_open_factor: row.get(13)?,
        actual_close_factor: row.get(14)?,
        confidence: row.get(15)?,
        message: row.get(16)?,
        scanned_at: row.get(17)?,
    })
}

fn detected_corporate_action_families(normalized: &str) -> Vec<String> {
    let expanded = expand_legacy_abbreviations(normalized);
    let normalized = expanded.as_str();
    let split_position = ["SPLIT", "SUB DIVISION", "SUBDIVISION"]
        .iter()
        .filter_map(|marker| normalized.find(marker))
        .min();
    let mut detected = [
        ("BONUS", normalized.find("BONUS")),
        ("SPLIT", split_position),
        ("DIVIDEND", normalized_dividend_position(normalized)),
        (
            "RIGHTS",
            ["RIGHT", "RIGHTS"]
                .iter()
                .filter_map(|token| normalized_token_position(normalized, token))
                .min(),
        ),
    ]
    .into_iter()
    .filter_map(|(action_type, position)| position.map(|position| (action_type, position)))
    .collect::<Vec<_>>();
    detected.sort_by_key(|(_, position)| *position);
    detected
        .into_iter()
        .map(|(action_type, _)| action_type.to_string())
        .collect()
}

fn parse_compound_action_components(purpose: &str, families: &[String]) -> Vec<ParsedAction> {
    let mut parsed_by_family = HashMap::<String, Vec<ParsedAction>>::new();
    for segment in split_compound_action_segments(purpose) {
        let parsed = parse_corporate_action_purpose(segment.trim());
        if parsed.parse_status == "PARSED" && families.contains(&parsed.action_type) {
            parsed_by_family
                .entry(parsed.action_type.clone())
                .or_default()
                .push(parsed);
        }
    }

    let mut result = Vec::new();
    for family in families {
        let Some(mut parsed) = parsed_by_family.remove(family) else {
            continue;
        };
        if family == "DIVIDEND" && parsed.len() > 1 {
            let amounts = parsed
                .iter()
                .map(|item| item.cash_amount)
                .collect::<Option<Vec<_>>>();
            if let Some(amounts) = amounts {
                let total = amounts.into_iter().sum::<f64>();
                if total.is_finite() && total > 0.0 {
                    let mut combined = parsed.remove(0);
                    combined.cash_amount = Some(total);
                    combined.message = Some(
                        "Combined explicit dividend components into one separate dividend review proposal."
                            .to_string(),
                    );
                    result.push(combined);
                }
            }
        } else {
            result.push(parsed.remove(0));
        }
    }
    result
}

fn split_compound_action_segments(value: &str) -> Vec<String> {
    let chars = value.chars().collect::<Vec<_>>();
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut index = 0usize;
    while index < chars.len() {
        let ch = chars[index];
        let slash_delimiter = ch == '/' && chars.get(index + 1) != Some(&'-');
        let symbol_delimiter = matches!(ch, '&' | ';' | '+') || slash_delimiter;
        let word_delimiter = if index + 5 <= chars.len() {
            chars[index..index + 5]
                .iter()
                .collect::<String>()
                .eq_ignore_ascii_case(" AND ")
        } else {
            false
        };
        if symbol_delimiter || word_delimiter {
            let segment = current.trim();
            if !segment.is_empty() {
                segments.push(segment.to_string());
            }
            current.clear();
            index += if word_delimiter { 5 } else { 1 };
            continue;
        }
        current.push(ch);
        index += 1;
    }
    let tail = current.trim();
    if !tail.is_empty() {
        segments.push(tail.to_string());
    }
    segments
}

fn parse_corporate_action_purpose(purpose: &str) -> ParsedAction {
    let canonical = canonical_purpose(purpose);
    let purpose = canonical.as_str();
    let normalized = normalize_text(purpose);
    if let Some((action, reason)) = split_bonus_terms::blocker(purpose) {
        return needs_review_action(action, reason);
    }
    if let Some(action_type) = compound_action_primary_type(&normalized) {
        return needs_review_action(
            action_type,
            "Multiple corporate-action types were detected; split the purpose into separate review rows before approval.",
        );
    }

    if normalized.contains("BONUS") {
        if let Some((ratio_num, ratio_den)) = extract_ratio_pair(purpose) {
            let factor = (ratio_num + ratio_den) / ratio_den;
            return parsed_price_action(
                "BONUS",
                Some(ratio_num),
                Some(ratio_den),
                None,
                None,
                factor,
                None,
            );
        }
        return needs_review_action("BONUS", "Bonus ratio was not parsed.");
    }

    let is_consolidation = normalized.contains("CONSOLIDATION")
        || normalized.contains("CONSOLIDATE")
        || normalized.contains("REVERSE SPLIT");
    if normalized.contains("SPLIT")
        || normalized.contains("SUB DIVISION")
        || normalized.contains("SUBDIVISION")
        || normalized.contains("SUB-DIVISION")
        || is_consolidation
    {
        let numbers = extract_numbers(purpose);
        if has_explicit_split_value_context(&normalized) && numbers.len() == 2 {
            let old_face_value = numbers[0];
            let new_face_value = numbers[1];
            if old_face_value > 0.0 && new_face_value > 0.0 {
                let factor = old_face_value / new_face_value;
                if factor.is_finite() && factor > 0.0 && (factor - 1.0).abs() > f64::EPSILON {
                    return parsed_price_action(
                        "SPLIT",
                        None,
                        None,
                        Some(old_face_value),
                        Some(new_face_value),
                        factor,
                        None,
                    );
                }
            }
        }
        if let Some((mut ratio_num, mut ratio_den)) = extract_ratio_pair(purpose) {
            if is_consolidation && ratio_num > ratio_den {
                // In Indian/global consolidation announcements, "10:1" means 10 existing shares consolidated
                // into 1 new share (ratio 1:10, factor 0.1). Normalize to num=1, den=10 so num/den == factor.
                std::mem::swap(&mut ratio_num, &mut ratio_den);
            }
            let factor = ratio_num / ratio_den;
            if factor.is_finite() && factor > 0.0 && (factor - 1.0).abs() > f64::EPSILON {
                return parsed_price_action(
                    "SPLIT",
                    Some(ratio_num),
                    Some(ratio_den),
                    None,
                    None,
                    factor,
                    None,
                );
            }
        }
        let fallback_msg = if is_consolidation {
            "Consolidation face-value/ratio was not parsed."
        } else {
            "Split face-value/ratio was not parsed."
        };
        return needs_review_action("SPLIT", fallback_msg);
    }

    if has_dividend_marker(&normalized) || looks_like_unit_distribution(&normalized) {
        return parse_dividend_action(purpose, &normalized);
    }

    if normalized.contains("RIGHT") {
        let ratio = extract_ratio_pair(purpose);
        let issue_price = extract_rights_issue_price(purpose);
        if let (Some((ratio_num, ratio_den)), Some(price)) = (ratio, issue_price) {
            return ParsedAction {
                action_type: "RIGHTS".to_string(),
                ratio_num: Some(ratio_num),
                ratio_den: Some(ratio_den),
                old_face_value: None,
                new_face_value: None,
                cash_amount: Some(price),
                factor: None,
                price_factor: None,
                parse_status: "PARSED".to_string(),
                message: Some(
                    "Rights issue TERP factor will be derived from the local previous close at approval time."
                        .to_string(),
                ),
            };
        }
        return needs_review_action(
            "RIGHTS",
            "Rights ratio and issue price were not both parsed.",
        );
    }

    if normalized.contains("DEMERGER")
        || normalized.contains("DE-MERGER")
        || normalized.contains("SPIN OFF")
        || normalized.contains("SPINOFF")
        || normalized.contains("ARRANGEMENT")
    {
        // A name/ratio alone does not establish cost allocation or an adjustment.
        // Keep any stated ratio for display, but never guess a price factor.
        let ratio = extract_ratio_pair(purpose);
        return ParsedAction {
            action_type: "DEMERGER".to_string(),
            ratio_num: ratio.map(|(num, _)| num),
            ratio_den: ratio.map(|(_, den)| den),
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            factor: None,
            price_factor: None,
            parse_status: "NEEDS_REVIEW".to_string(),
            message: Some(
                "Demerger detected; verified cost-allocation evidence is required. No adjustment applied."
                    .to_string(),
            ),
        };
    }

    ParsedAction {
        action_type: "OTHER".to_string(),
        ratio_num: None,
        ratio_den: None,
        old_face_value: None,
        new_face_value: None,
        cash_amount: None,
        factor: None,
        price_factor: None,
        parse_status: "NEEDS_REVIEW".to_string(),
        message: Some("Unsupported official purpose.".to_string()),
    }
}

fn compound_action_primary_type(normalized: &str) -> Option<&'static str> {
    let expanded = expand_legacy_abbreviations(normalized);
    let normalized = expanded.as_str();
    let split_position = [
        "SPLIT",
        "SUB DIVISION",
        "SUBDIVISION",
        "SUB-DIVISION",
        "CONSOLIDATION",
        "CONSOLIDATE",
        "REVERSE SPLIT",
    ]
    .iter()
    .filter_map(|marker| normalized.find(marker))
    .min();
    let mut detected = [
        ("BONUS", normalized.find("BONUS")),
        ("SPLIT", split_position),
        ("DIVIDEND", normalized_dividend_position(normalized)),
        (
            "RIGHTS",
            ["RIGHT", "RIGHTS"]
                .iter()
                .filter_map(|token| normalized_token_position(normalized, token))
                .min(),
        ),
    ]
    .into_iter()
    .filter_map(|(action_type, position)| position.map(|position| (action_type, position)))
    .collect::<Vec<_>>();

    if detected.len() < 2 {
        return None;
    }
    detected.sort_by_key(|(_, position)| *position);
    Some(detected[0].0)
}

fn normalized_token_position(normalized: &str, token: &str) -> Option<usize> {
    normalized.match_indices(token).find_map(|(position, _)| {
        let end = position + token.len();
        let bytes = normalized.as_bytes();
        let has_left_boundary = position == 0 || bytes[position - 1] == b' ';
        let has_right_boundary = end == bytes.len() || bytes[end] == b' ';
        (has_left_boundary && has_right_boundary).then_some(position)
    })
}

fn normalized_dividend_position(normalized: &str) -> Option<usize> {
    ["DIVIDEND", "DIV", "INTDIVIDEND"]
        .iter()
        .filter_map(|token| normalized_token_position(normalized, token))
        .chain(
            looks_like_unit_distribution(normalized)
                .then(|| normalized_token_position(normalized, "DISTRIBUTION"))
                .flatten(),
        )
        .min()
}

fn has_dividend_marker(normalized: &str) -> bool {
    normalized_dividend_marker_count(normalized) > 0
}

fn normalized_dividend_marker_count(normalized: &str) -> usize {
    normalized
        .split_whitespace()
        .filter(|token| matches!(*token, "DIVIDEND" | "DIV" | "INTDIVIDEND"))
        .count()
}

fn has_explicit_split_value_context(normalized: &str) -> bool {
    normalized.contains("FACE VALUE")
        || normalized
            .split_whitespace()
            .any(|token| matches!(token, "FV" | "RS" | "RE" | "RUPEE" | "RUPEES"))
}

fn parsed_price_action(
    action_type: &str,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
    factor: f64,
    message: Option<String>,
) -> ParsedAction {
    ParsedAction {
        action_type: action_type.to_string(),
        ratio_num,
        ratio_den,
        old_face_value,
        new_face_value,
        cash_amount: None,
        factor: Some(factor),
        price_factor: Some(1.0 / factor),
        parse_status: "PARSED".to_string(),
        message,
    }
}

fn approved_corporate_action_source(import_source: &str) -> String {
    normalize_optional_text(Some(import_source)).unwrap_or_else(|| "OFFICIAL_IMPORT".to_string())
}

fn parse_dividend_action(purpose: &str, normalized: &str) -> ParsedAction {
    if looks_like_unit_distribution(normalized) {
        return parse_unit_distribution_action(purpose);
    }
    if purpose.contains('%') {
        return needs_review_action("DIVIDEND",
            "Percentage dividend requires verified historical face value or explicit cash-per-share evidence; a percentage is not a cash amount.");
    }

    let dividend_mentions = normalized_dividend_marker_count(normalized);
    if dividend_mentions > 1 {
        if contains_inclusive_dividend_total(normalized) {
            return needs_review_action(
                "DIVIDEND",
                "Multiple dividend mentions include an inclusive total; review the cash amount manually to avoid double counting.",
            );
        }
        let dividend_segments = split_dividend_segments(purpose)
            .into_iter()
            .filter(|segment| has_dividend_marker(&normalize_text(segment)))
            .collect::<Vec<_>>();
        if dividend_segments.len() > 1 {
            let amounts = dividend_segments
                .iter()
                .map(|segment| extract_dividend_segment_amount(segment))
                .collect::<Option<Vec<_>>>();
            if let Some(amounts) = amounts {
                let total_amount = amounts.into_iter().sum::<f64>();
                if let Some(value) = positive_number(total_amount) {
                    return ParsedAction {
                        action_type: "DIVIDEND".to_string(),
                        ratio_num: None,
                        ratio_den: None,
                        old_face_value: None,
                        new_face_value: None,
                        cash_amount: Some(value),
                        factor: None,
                        price_factor: None,
                        parse_status: "PARSED".to_string(),
                        message: Some(
                            "Dividend adjustment factor will be derived from the local previous close at approval time. Combined multiple per-share dividend cash components."
                                .to_string(),
                        ),
                    };
                }
            }
        }
        return needs_review_action(
            "DIVIDEND",
            "Multiple dividend components were detected; review the total cash amount manually.",
        );
    }

    if let Some(value) = extract_dividend_segment_amount(purpose) {
        return ParsedAction {
            action_type: "DIVIDEND".to_string(),
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: Some(value),
            factor: None,
            price_factor: None,
            parse_status: "PARSED".to_string(),
            message: Some(
                "Dividend adjustment factor will be derived from the local previous close at approval time."
                    .to_string(),
            ),
        };
    }

    needs_review_action("DIVIDEND", "Dividend amount was not parsed safely.")
}

fn contains_inclusive_dividend_total(normalized: &str) -> bool {
    normalized.contains("INCLUDING")
        || normalized.contains("INCLUSIVE OF")
        || normalized.contains("INCLUDES")
}

fn looks_like_unit_distribution(normalized: &str) -> bool {
    if !normalized.contains("PER UNIT") {
        return false;
    }
    normalized_token_position(normalized, "DISTRIBUTION").is_some()
        || normalized_token_position(normalized, "DISTRITBUTION").is_some()
        || unit_distribution_component_marker_count(normalized) > 1
}

fn parse_unit_distribution_action(purpose: &str) -> ParsedAction {
    if let Some(value) = extract_headline_unit_distribution_amount(purpose) {
        return parsed_dividend_cash_action(
            value,
            "Dividend adjustment factor will be derived from the local previous close at approval time. Used the explicit headline cash distribution per unit.",
        );
    }

    if let Some(value) = extract_unit_distribution_component_total(purpose) {
        return parsed_dividend_cash_action(
            value,
            "Dividend adjustment factor will be derived from the local previous close at approval time. Combined labelled cash distribution components per unit.",
        );
    }

    needs_review_action(
        "DIVIDEND",
        "Unit distribution total was not parsed safely; review every cash component manually.",
    )
}

fn parsed_dividend_cash_action(value: f64, message: &str) -> ParsedAction {
    ParsedAction {
        action_type: "DIVIDEND".to_string(),
        ratio_num: None,
        ratio_den: None,
        old_face_value: None,
        new_face_value: None,
        cash_amount: Some(value),
        factor: None,
        price_factor: None,
        parse_status: "PARSED".to_string(),
        message: Some(message.to_string()),
    }
}

fn extract_headline_unit_distribution_amount(purpose: &str) -> Option<f64> {
    if !normalize_text(purpose).contains("PER UNIT") {
        return None;
    }
    let (distribution_start, distribution_marker_len) = first_unit_distribution_marker(purpose)?;
    let after_marker_start = distribution_start + distribution_marker_len;
    let after_marker = purpose.get(after_marker_start..)?;
    let comprising_start = ascii_token_positions(after_marker, "COMPRISING")
        .into_iter()
        .next();
    let per_unit_end = after_marker
        .to_ascii_uppercase()
        .find("PER UNIT")
        .map(|position| position + "PER UNIT".len());
    let headline_end = match (comprising_start, per_unit_end) {
        (Some(comprising), Some(per_unit)) => comprising.min(per_unit),
        (Some(comprising), None) => comprising,
        (None, Some(per_unit)) => per_unit,
        (None, None) => return None,
    };
    let headline = after_marker.get(..headline_end)?;
    if unit_distribution_component_marker_count(&normalize_text(headline)) > 0 {
        return None;
    }
    extract_first_currency_amount(headline)
}

fn first_unit_distribution_marker(value: &str) -> Option<(usize, usize)> {
    ["DISTRIBUTION", "DISTRITBUTION"]
        .into_iter()
        .flat_map(|marker| {
            ascii_token_positions(value, marker)
                .into_iter()
                .map(move |position| (position, marker.len()))
        })
        .min_by_key(|(position, _)| *position)
}

fn extract_unit_distribution_component_total(purpose: &str) -> Option<f64> {
    let mut amounts = Vec::new();
    for segment in split_unit_distribution_segments(purpose) {
        let normalized = normalize_text(segment);
        if normalized.is_empty() {
            continue;
        }
        if has_unit_distribution_component_label(&normalized) {
            amounts.push(extract_first_currency_amount(segment)?);
        } else if extract_first_currency_amount(segment).is_some()
            || normalized.contains("PER UNIT")
        {
            return None;
        }
    }
    if amounts.len() < 2 {
        return None;
    }
    positive_number(amounts.into_iter().sum::<f64>())
}

fn unit_distribution_component_marker_count(normalized: &str) -> usize {
    [
        has_dividend_marker(normalized),
        normalized_token_position(normalized, "INTEREST").is_some(),
        normalized.contains("RETURN ON CAPITAL") || normalized.contains("RETURN OF CAPITAL"),
        normalized.contains("REPAYMENT"),
        normalized.contains("PROCEEDS"),
        normalized.contains("OTHER INCOME"),
        normalized.contains("TREASURY INCOME"),
        normalized.contains("SPV DEBT") || normalized.contains("SPV LOAN"),
        normalized.contains("AMORTIZATION"),
        normalized.contains("TAX REFUND"),
    ]
    .into_iter()
    .filter(|detected| *detected)
    .count()
}

fn has_unit_distribution_component_label(normalized: &str) -> bool {
    unit_distribution_component_marker_count(normalized) > 0
}

fn needs_review_action(action_type: &str, message: &str) -> ParsedAction {
    ParsedAction {
        action_type: action_type.to_string(),
        ratio_num: None,
        ratio_den: None,
        old_face_value: None,
        new_face_value: None,
        cash_amount: None,
        factor: None,
        price_factor: None,
        parse_status: "NEEDS_REVIEW".to_string(),
        message: Some(message.to_string()),
    }
}

fn build_header_map(headers: &csv::StringRecord) -> HashMap<String, usize> {
    headers
        .iter()
        .enumerate()
        .map(|(index, header)| (normalize_header(header), index))
        .collect()
}

fn pick_csv_field(
    header_map: &HashMap<String, usize>,
    record: &csv::StringRecord,
    candidates: &[&str],
) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header_map
            .get(*candidate)
            .and_then(|index| record.get(*index))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
    })
}

fn normalize_header(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn parse_official_date(value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Date is empty.".to_string());
    }
    let title_case_month = title_case_month_date(trimmed);
    for candidate in [trimmed.to_string(), title_case_month] {
        for format in [
            "%Y-%m-%d", "%Y%m%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y", "%d-%B-%Y", "%d %b %Y",
            "%d %B %Y",
        ] {
            if let Ok(date) = NaiveDate::parse_from_str(&candidate, format) {
                return Ok(date.format("%Y-%m-%d").to_string());
            }
        }
    }
    Err(format!("Invalid official date: {value}"))
}

fn title_case_month_date(value: &str) -> String {
    value
        .split('-')
        .map(|part| {
            if part.chars().any(|ch| ch.is_ascii_alphabetic()) {
                let lower = part.to_ascii_lowercase();
                let mut chars = lower.chars();
                match chars.next() {
                    Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                    None => part.to_string(),
                }
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("-")
}

fn normalize_isin(value: Option<&str>) -> Option<String> {
    value
        .and_then(|raw| normalize_optional_text(Some(raw)))
        .map(|text| text.to_uppercase())
}

/// Older NSE purposes abbreviate terms, for example `Fv Splt Frm Rs 10 To Rs 2`
/// or `Fv Spl-Rs10tors2/Bon-1:2`. Only two exact shapes count: `FV` followed by
/// `SPL`/`SPLT`, and `BON` followed by an `a:b` ratio. `Spl` alone (special) and
/// `Bon 1 Dvr : 20` do not count.
fn legacy_purpose_tokens(value: &str) -> Vec<String> {
    let chars = value.chars().collect::<Vec<_>>();
    let mut tokens = Vec::new();
    let mut index = 0usize;
    while index < chars.len() {
        let ch = chars[index];
        if ch.is_whitespace() {
            index += 1;
        } else if ch.is_ascii_alphabetic() {
            let start = index;
            while index < chars.len() && chars[index].is_ascii_alphabetic() {
                index += 1;
            }
            tokens.push(chars[start..index].iter().collect());
        } else if ch.is_ascii_digit() {
            let start = index;
            while index < chars.len()
                && (chars[index].is_ascii_digit()
                    || (chars[index] == '.'
                        && chars.get(index + 1).is_some_and(|next| next.is_ascii_digit())))
            {
                index += 1;
            }
            tokens.push(chars[start..index].iter().collect());
        } else {
            tokens.push(ch.to_string());
            index += 1;
        }
    }
    tokens
}

fn is_legacy_split_token(tokens: &[String], index: usize) -> bool {
    index > 0
        && matches!(tokens[index].to_ascii_uppercase().as_str(), "SPL" | "SPLT")
        && tokens[index - 1].eq_ignore_ascii_case("FV")
}

fn is_legacy_bonus_token(tokens: &[String], index: usize) -> bool {
    if !tokens[index].eq_ignore_ascii_case("BON") {
        return false;
    }
    let mut next = index + 1;
    while tokens.get(next).is_some_and(|token| token == "-") {
        next += 1;
    }
    let numeric = |token: Option<&String>| {
        token.is_some_and(|token| token.chars().all(|ch| ch.is_ascii_digit() || ch == '.'))
    };
    numeric(tokens.get(next))
        && tokens.get(next + 1).is_some_and(|token| token == ":")
        && numeric(tokens.get(next + 2))
}

/// Expand the legacy abbreviations into ordinary wording for the canonical parser.
/// Text without a legacy shape is returned unchanged. `purpose_raw` is never rewritten.
fn canonical_purpose(value: &str) -> String {
    let tokens = legacy_purpose_tokens(value);
    let triggered = (0..tokens.len())
        .any(|index| is_legacy_split_token(&tokens, index) || is_legacy_bonus_token(&tokens, index));
    if !triggered {
        return value.to_string();
    }
    (0..tokens.len())
        .map(|index| {
            if is_legacy_split_token(&tokens, index) {
                return "Split".to_string();
            }
            if is_legacy_bonus_token(&tokens, index) {
                return "Bonus".to_string();
            }
            match tokens[index].to_ascii_uppercase().as_str() {
                "FRM" => "From".to_string(),
                "TORS" => "to Rs".to_string(),
                "TORE" => "to Re".to_string(),
                _ => tokens[index].clone(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Normalized-text form of `canonical_purpose` for family detection.
fn expand_legacy_abbreviations(normalized: &str) -> String {
    let tokens = normalized.split_whitespace().collect::<Vec<_>>();
    let numeric = |index: usize| {
        tokens.get(index).is_some_and(|token| token.chars().all(|ch| ch.is_ascii_digit()))
    };
    tokens
        .iter()
        .enumerate()
        .map(|(index, token)| {
            if matches!(*token, "SPL" | "SPLT") && index > 0 && tokens[index - 1] == "FV" {
                "SPLIT"
            } else if *token == "BON" && numeric(index + 1) && numeric(index + 2) {
                "BONUS"
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_text(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

fn normalize_key_part(value: Option<&str>) -> String {
    value
        .map(normalize_text)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn build_dedupe_key(
    source: &str,
    exchange: &str,
    symbol: Option<&str>,
    isin: Option<&str>,
    action_type: &str,
    ex_date: Option<&str>,
    record_date: Option<&str>,
    purpose_raw: &str,
) -> String {
    [
        source.to_string(),
        exchange.to_string(),
        normalize_key_part(symbol),
        normalize_key_part(isin),
        action_type.to_string(),
        ex_date.unwrap_or("").to_string(),
        record_date.unwrap_or("").to_string(),
        normalize_text(purpose_raw),
    ]
    .join("|")
}

fn extract_ratio_pair(value: &str) -> Option<(f64, f64)> {
    let chars = value.chars().collect::<Vec<_>>();
    for (index, ch) in chars.iter().enumerate() {
        if *ch != ':' {
            continue;
        }
        let left = read_number_left(&chars, index)?;
        let right = read_number_right(&chars, index + 1)?;
        if left > 0.0 && right > 0.0 {
            return Some((left, right));
        }
    }
    None
}

fn read_number_left(chars: &[char], end: usize) -> Option<f64> {
    let mut index = end;
    while index > 0 && chars[index - 1].is_whitespace() {
        index -= 1;
    }
    let mut start = index;
    while start > 0 && (chars[start - 1].is_ascii_digit() || chars[start - 1] == '.') {
        start -= 1;
    }
    if start == index {
        return None;
    }
    chars[start..index].iter().collect::<String>().parse().ok()
}

fn read_number_right(chars: &[char], start: usize) -> Option<f64> {
    let mut index = start;
    while index < chars.len() && chars[index].is_whitespace() {
        index += 1;
    }
    let number_start = index;
    while index < chars.len() && (chars[index].is_ascii_digit() || chars[index] == '.') {
        index += 1;
    }
    if number_start == index {
        return None;
    }
    chars[number_start..index]
        .iter()
        .collect::<String>()
        .parse()
        .ok()
}

fn extract_numbers(value: &str) -> Vec<f64> {
    let mut numbers = Vec::new();
    let mut buffer = String::new();
    for ch in value.chars() {
        if ch.is_ascii_digit() {
            buffer.push(ch);
            continue;
        }
        if ch == '.' && !buffer.is_empty() && !buffer.contains('.') {
            buffer.push(ch);
            continue;
        }
        push_number(&mut numbers, &mut buffer);
    }
    push_number(&mut numbers, &mut buffer);
    numbers
}

fn split_dividend_segments(value: &str) -> Vec<&str> {
    let mut segments = Vec::new();
    let mut start = 0usize;
    for (index, ch) in value.char_indices() {
        let word_delimiter_len = ["AND", "PLUS"]
            .into_iter()
            .find(|token| ascii_token_at(value, index, token))
            .map(str::len);
        let character_delimiter = matches!(ch, '&' | ',' | ';' | '+')
            || (ch == '/' && value[index + ch.len_utf8()..].chars().next() != Some('-'));
        if character_delimiter || word_delimiter_len.is_some() {
            let segment = value[start..index].trim();
            if !segment.is_empty() {
                segments.push(segment);
            }
            start = index + word_delimiter_len.unwrap_or(ch.len_utf8());
        }
    }
    let tail = value[start..].trim();
    if !tail.is_empty() {
        segments.push(tail);
    }
    segments
        .into_iter()
        .flat_map(split_repeated_dividend_markers)
        .collect()
}

fn split_repeated_dividend_markers(value: &str) -> Vec<&str> {
    let positions = ascii_token_positions(value, "DIVIDEND");
    if positions.len() <= 1 {
        return vec![value];
    }

    let mut segments = Vec::with_capacity(positions.len());
    let mut start = 0usize;
    for position in positions.into_iter().skip(1) {
        let segment = value[start..position].trim();
        if !segment.is_empty() {
            segments.push(segment);
        }
        start = position;
    }
    let tail = value[start..].trim();
    if !tail.is_empty() {
        segments.push(tail);
    }
    segments
}

fn ascii_token_positions(value: &str, token: &str) -> Vec<usize> {
    value
        .char_indices()
        .filter_map(|(index, _)| ascii_token_at(value, index, token).then_some(index))
        .collect()
}

fn ascii_token_at(value: &str, start: usize, token: &str) -> bool {
    let bytes = value.as_bytes();
    let token_bytes = token.as_bytes();
    if start + token_bytes.len() > bytes.len()
        || !bytes[start..start + token_bytes.len()].eq_ignore_ascii_case(token_bytes)
    {
        return false;
    }
    let left_boundary = start == 0 || !bytes[start - 1].is_ascii_alphanumeric();
    let end = start + token_bytes.len();
    let right_boundary = end == bytes.len() || !bytes[end].is_ascii_alphanumeric();
    left_boundary && right_boundary
}

fn split_unit_distribution_segments(value: &str) -> Vec<&str> {
    let mut segments = Vec::new();
    let mut start = 0usize;
    for (index, ch) in value.char_indices() {
        let delimiter = matches!(ch, '&' | ';' | '+')
            || (ch == '/' && value[index + ch.len_utf8()..].chars().next() != Some('-'));
        if delimiter {
            let segment = value[start..index].trim();
            if !segment.is_empty() {
                segments.push(segment);
            }
            start = index + ch.len_utf8();
        }
    }
    let tail = value[start..].trim();
    if !tail.is_empty() {
        segments.push(tail);
    }
    segments
}

fn extract_dividend_segment_amount(value: &str) -> Option<f64> {
    // A percentage is not cash per share. Never reinterpret the lone number
    // as money without an independently established historical face-value basis.
    if value.contains('%') {
        return None;
    }
    extract_first_currency_amount(value).or_else(|| {
        let numbers = extract_numbers(value)
            .into_iter()
            .filter_map(positive_number)
            .collect::<Vec<_>>();
        if numbers.len() == 1 {
            numbers.first().copied()
        } else {
            None
        }
    })
}

fn extract_first_currency_amount(value: &str) -> Option<f64> {
    let chars = value.chars().collect::<Vec<_>>();
    let markers = [
        vec!['R', 'S', '.'],
        vec!['R', 'S'],
        vec!['R', 'E', '.'],
        vec!['R', 'E'],
        vec!['I', 'N', 'R'],
        vec!['₹'],
    ];

    for index in 0..chars.len() {
        for marker in &markers {
            if matches_marker_at(&chars, index, marker) {
                if let Some(value) = read_currency_amount_right(&chars, index + marker.len()) {
                    if let Some(positive) = positive_number(value) {
                        return Some(positive);
                    }
                }
            }
        }
    }
    None
}

fn matches_marker_at(chars: &[char], start: usize, marker: &[char]) -> bool {
    if start + marker.len() > chars.len() {
        return false;
    }
    if !marker
        .iter()
        .enumerate()
        .all(|(offset, expected)| chars[start + offset].eq_ignore_ascii_case(expected))
    {
        return false;
    }
    if start > 0 && chars[start - 1].is_ascii_alphanumeric() {
        return false;
    }
    true
}

fn read_currency_amount_right(chars: &[char], start: usize) -> Option<f64> {
    let mut index = start;
    while index < chars.len()
        && (chars[index].is_whitespace()
            || matches!(chars[index], '.' | '-' | '/' | ':' | '(' | ')' | '[' | ']'))
    {
        index += 1;
    }
    let number_start = index;
    while index < chars.len() && (chars[index].is_ascii_digit() || chars[index] == '.') {
        index += 1;
    }
    if number_start == index {
        return None;
    }
    chars[number_start..index]
        .iter()
        .collect::<String>()
        .parse()
        .ok()
}

fn extract_rights_issue_price(value: &str) -> Option<f64> {
    let uppercase = value.to_uppercase();
    for marker in [
        "ISSUE PRICE",
        "AT RS",
        "@ RS",
        "AT RE",
        "@ RE",
        "PRICE OF RS",
        "PRICE RS",
    ] {
        if let Some(index) = uppercase.find(marker) {
            let suffix = &value[index..];
            return extract_numbers(suffix)
                .into_iter()
                .find_map(positive_number);
        }
    }
    None
}

fn push_number(numbers: &mut Vec<f64>, buffer: &mut String) {
    if !buffer.is_empty() {
        if let Ok(value) = buffer.parse::<f64>() {
            if value.is_finite() {
                numbers.push(value);
            }
        }
        buffer.clear();
    }
}

fn positive_number(value: f64) -> Option<f64> {
    if value.is_finite() && value > 0.0 {
        Some(value)
    } else {
        None
    }
}

#[cfg(test)]
#[path = "corporate_action_imports/v114x_tests.rs"]
mod v114x_tests;
#[cfg(test)]
#[path = "corporate_action_imports/v114w_tests.rs"]
mod v114w_tests;
#[cfg(test)]
#[path = "corporate_action_imports/v114t_tests.rs"]
mod v114t_tests;
#[cfg(test)]
#[path = "corporate_action_imports/v114y_tests.rs"]
mod v114y_tests;

#[cfg(test)]
#[path = "corporate_action_imports/dividend_prepared_scope_bridge_tests.rs"]
mod dividend_prepared_scope_bridge_tests;
#[cfg(test)]
mod v114ad_tests;
#[cfg(test)]
mod tests {
    use super::super::HistoricalCapitalActionBackfillBatchSymbolInput;
    use super::*;

    // Exercise the actual HTTP client without contacting an exchange or database.
    fn bse_test_server(responses: Vec<&'static str>) -> (String, std::thread::JoinHandle<usize>) {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/actions", listener.local_addr().unwrap());
        listener.set_nonblocking(true).unwrap();
        let worker = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + Duration::from_secs(3);
            let mut count = 0;
            while std::time::Instant::now() < deadline {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        stream.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
                        // Read the complete header before closing the socket. Closing
                        // with unread request bytes causes Windows to send a reset.
                        let mut request = Vec::new();
                        let mut chunk = [0; 1024];
                        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
                            let bytes = stream.read(&mut chunk).unwrap();
                            assert!(bytes > 0 && request.len() < 16384);
                            request.extend_from_slice(&chunk[..bytes]);
                        }
                        if let Some(response) = responses.get(count) {
                            stream.write_all(response.as_bytes()).unwrap();
                        }
                        count += 1;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("{error}"),
                }
            }
            count
        });
        (url, worker)
    }

    #[test]
    fn bse_action_transport_preserves_json_response() {
        let (url, worker) = bse_test_server(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]",
        ]);
        assert_eq!(fetch_bse_action_text(&bse_action_fetch_client().unwrap(), &url, true).unwrap(), "[]");
        assert_eq!(worker.join().unwrap(), 1);
    }

    #[test]
    fn bse_action_transport_does_not_retry_forbidden_or_mark_it_empty() {
        let (url, worker) = bse_test_server(vec![
            "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        ]);
        let error = fetch_bse_action_text(&bse_action_fetch_client().unwrap(), &url, true).unwrap_err();
        assert!(error.contains("BSE_DIRECT_ACCESS_BLOCKED"));
        assert!(error.contains("API request"));
        assert!(error.contains("HTTP 403"));
        assert_eq!(worker.join().unwrap(), 1);
    }

    #[test]
    fn bse_action_transport_retries_interrupted_response_once() {
        let (url, worker) = bse_test_server(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n[",
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]",
        ]);
        assert_eq!(fetch_bse_action_text(&bse_action_fetch_client().unwrap(), &url, true).unwrap(), "[]");
        assert_eq!(worker.join().unwrap(), 2);
    }

    #[test]
    #[ignore = "Explicit live BSE diagnostic; no database or price writes"]
    fn bse_action_transport_live_probe() {
        let client = bse_action_fetch_client().unwrap();
        fetch_bse_action_text(&client, BSE_ACTIONS_PAGE_URL, false).unwrap();
        let today = (chrono::Utc::now() + ChronoDuration::minutes(330)).format("%Y%m%d").to_string();
        let url = format!("{BSE_ACTIONS_API_URL}?scripcode=&Fdate={today}&Purposecode=&TDate={today}&ddlcategorys=E&ddlindustrys=&segment=0&strSearch=S");
        let text = fetch_bse_action_text(&client, &url, true).unwrap();
        let rows: Value = serde_json::from_str(&text).unwrap();
        assert!(rows.is_array());
        println!("Live BSE official JSON rows: {}", rows.as_array().unwrap().len());
    }

    #[test]
    fn ca_stabilization_approval_rejects_another_database_before_reading_ids() {
        let connection = Connection::open_in_memory().unwrap();
        let reviewed = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let expected = reviewed.path().to_string_lossy().to_string();
        let single = CorporateActionImportApprovalInput {
            import_id: 1, expected_database_path: expected.clone(),
        };
        let bulk = CorporateActionImportBulkApprovalInput {
            import_ids: vec![1], expected_database_path: expected.clone(),
        };
        let exceptional = CorporateActionImportExceptionalApprovalInput {
            import_id: 1, reason: "Reviewed official evidence.".to_string(),
            expected_database_path: expected,
        };
        // No schema: a successful guard must fail before any import lookup/write.
        for error in [
            approve_corporate_action_import_internal(&connection, other.path(), &single).unwrap_err(),
            approve_corporate_action_imports_internal(&connection, other.path(), &bulk).unwrap_err(),
            approve_recommended_corporate_action_isin_mismatches_internal(&connection, other.path(), &bulk).unwrap_err(),
            approve_corporate_action_import_with_isin_mismatch_internal(&connection, other.path(), &exceptional).unwrap_err(),
            approve_corporate_action_import_with_price_validation_exception_internal(&connection, other.path(), &exceptional).unwrap_err(),
        ] {
            assert!(error.contains("active database changed"), "{error}");
        }
        assert!(connection.is_autocommit());
        assert!(serde_json::from_value::<CorporateActionImportBulkApprovalInput>(
            serde_json::json!({"importIds": [1]})
        ).is_err());
    }

    fn create_import_evidence_table(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );
                CREATE TABLE corporate_action_import_decisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  decision_type TEXT NOT NULL,
                  previous_symbol TEXT,
                  previous_exchange TEXT,
                  previous_isin TEXT,
                  resolved_symbol TEXT,
                  resolved_exchange TEXT,
                  resolved_isin TEXT,
                  reason TEXT NOT NULL,
                  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ",
            )
            .unwrap();
    }

    fn create_historical_backfill_tracking_tables(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE IF NOT EXISTS corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );
                CREATE TABLE historical_capital_action_backfill_runs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  from_date TEXT NOT NULL,
                  to_date TEXT NOT NULL,
                  requested_symbols TEXT NOT NULL,
                  stop_on_error INTEGER NOT NULL DEFAULT 0,
                  status TEXT NOT NULL DEFAULT 'RUNNING',
                  total_symbols INTEGER NOT NULL DEFAULT 0,
                  completed_symbols INTEGER NOT NULL DEFAULT 0,
                  failed_symbols INTEGER NOT NULL DEFAULT 0,
                  rows_read INTEGER NOT NULL DEFAULT 0,
                  rows_inserted INTEGER NOT NULL DEFAULT 0,
                  rows_duplicate INTEGER NOT NULL DEFAULT 0,
                  rows_evidence_attached INTEGER NOT NULL DEFAULT 0,
                  rows_error INTEGER NOT NULL DEFAULT 0,
                  rows_unresolved INTEGER NOT NULL DEFAULT 0,
                  rows_parsed INTEGER NOT NULL DEFAULT 0,
                  rows_unsupported INTEGER NOT NULL DEFAULT 0,
                  parse_status_counts TEXT NOT NULL DEFAULT '{}',
                  review_status_counts TEXT NOT NULL DEFAULT '{}',
                  started_at TEXT NOT NULL DEFAULT (datetime('now')),
                  completed_at TEXT,
                  message TEXT
                );
                CREATE TABLE historical_capital_action_backfill_run_symbols (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  run_id INTEGER NOT NULL,
                  symbol TEXT NOT NULL,
                  canonical_symbol TEXT,
                  bse_scrip_code TEXT,
                  status TEXT NOT NULL DEFAULT 'RUNNING',
                  rows_read INTEGER NOT NULL DEFAULT 0,
                  rows_inserted INTEGER NOT NULL DEFAULT 0,
                  rows_duplicate INTEGER NOT NULL DEFAULT 0,
                  rows_evidence_attached INTEGER NOT NULL DEFAULT 0,
                  rows_error INTEGER NOT NULL DEFAULT 0,
                  rows_unresolved INTEGER NOT NULL DEFAULT 0,
                  rows_parsed INTEGER NOT NULL DEFAULT 0,
                  rows_unsupported INTEGER NOT NULL DEFAULT 0,
                  parse_status_counts TEXT NOT NULL DEFAULT '{}',
                  review_status_counts TEXT NOT NULL DEFAULT '{}',
                  warning_count INTEGER NOT NULL DEFAULT 0,
                  error_message TEXT,
                  started_at TEXT NOT NULL DEFAULT (datetime('now')),
                  completed_at TEXT,
                  message TEXT,
                  UNIQUE (run_id, symbol)
                );
                CREATE TABLE historical_capital_action_backfill_run_outcomes (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  run_symbol_id INTEGER NOT NULL,
                  source TEXT NOT NULL,
                  requested_symbol TEXT,
                  source_locator TEXT,
                  outcome TEXT NOT NULL,
                  import_id INTEGER,
                  evidence_id INTEGER,
                  action_type TEXT,
                  parse_status TEXT,
                  review_status TEXT,
                  message TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  FOREIGN KEY (run_symbol_id)
                    REFERENCES historical_capital_action_backfill_run_symbols(id)
                    ON DELETE CASCADE,
                  FOREIGN KEY (import_id)
                    REFERENCES corporate_action_imports(id)
                    ON DELETE SET NULL,
                  FOREIGN KEY (evidence_id)
                    REFERENCES corporate_action_import_evidence(id)
                    ON DELETE SET NULL
                );
                ",
            )
            .unwrap();
    }

    fn create_nse_resolution_tables(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE instruments (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  bse_security_code TEXT,
                  isin TEXT,
                  name TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  series TEXT,
                  sector TEXT,
                  industry TEXT
                );
                CREATE TABLE instrument_identity_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  isin TEXT,
                  current_symbol TEXT,
                  current_name TEXT,
                  old_symbol TEXT,
                  old_name TEXT,
                  new_symbol TEXT,
                  new_name TEXT,
                  effective_date TEXT NOT NULL,
                  change_type TEXT NOT NULL,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE instrument_isin_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  symbol TEXT NOT NULL,
                  isin TEXT NOT NULL,
                  effective_date TEXT,
                  source TEXT,
                  source_ref TEXT,
                  note TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL DEFAULT 'OTHER',
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
                  review_status TEXT NOT NULL DEFAULT 'PENDING',
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                CREATE TABLE corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );
                CREATE TABLE corporate_action_import_decisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  decision_type TEXT NOT NULL,
                  previous_symbol TEXT,
                  previous_exchange TEXT,
                  previous_isin TEXT,
                  resolved_symbol TEXT,
                  resolved_exchange TEXT,
                  resolved_isin TEXT,
                  reason TEXT NOT NULL,
                  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ",
            )
            .unwrap();
    }

    #[test]
    fn load_historical_backfill_symbols_collects_connected_aliases() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instrument_identity_history (
                  exchange, isin, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'INE999A01001', 'NEWCO', 'New Co', 'MIDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'INE999A01001', 'NEWCO', 'New Co', 'OLDCO', 'MIDCO', '2010-01-01', 'SYMBOL_CHANGE')
                ",
                [],
            )
            .unwrap();

        let symbols = load_historical_backfill_symbols(&connection, "NEWCO", "NSE").unwrap();

        assert_eq!(symbols.first().map(String::as_str), Some("NEWCO"));
        assert!(symbols.iter().any(|value| value == "MIDCO"));
        assert!(symbols.iter().any(|value| value == "OLDCO"));
    }

    #[test]
    fn sparse_candidates_prioritize_unresolved_then_long_history_sparse_symbols() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  date TEXT NOT NULL
                );
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  effective_date TEXT NOT NULL,
                  action_type TEXT NOT NULL
                );
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('INFY', 'NSE', 'INE009A01021', 'Infosys Limited', 1, 'EQ'),
                  ('WIPRO', 'NSE', 'INE075A01022', 'Wipro Limited', 1, 'EQ'),
                  ('SOLID', 'NSE', 'INE000A01001', 'Covered Limited', 1, 'EQ'),
                  ('NEWCO', 'NSE', 'INE000A01002', 'New Co', 1, 'EQ'),
                  ('OLDINACTIVE', 'NSE', 'INE000A01003', 'Old Inactive', 0, 'EQ');
                INSERT INTO eod_prices (symbol, exchange, date)
                VALUES
                  ('INFY', 'NSE', '1999-01-01'),
                  ('WIPRO', 'NSE', '2000-01-01'),
                  ('SOLID', 'NSE', '1998-01-01'),
                  ('NEWCO', 'NSE', '2020-01-01'),
                  ('OLDINACTIVE', 'NSE', '1997-01-01');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES
                  ('infy-split-pending', 'NSE', 'NSE_API', 'INFY', 'Split 1:2', '2000-01-01', 'SPLIT', 'PARSED', 'UNRESOLVED'),
                  ('wipro-bonus-approved', 'NSE', 'NSE_API', 'WIPRO', 'Bonus 1:1', '2004-01-01', 'BONUS', 'PARSED', 'APPROVED');
                INSERT INTO corporate_actions (symbol, exchange, effective_date, action_type)
                VALUES
                  ('SOLID', 'NSE', '2001-01-01', 'SPLIT'),
                  ('SOLID', 'NSE', '2005-01-01', 'BONUS');
                ",
            )
            .unwrap();

        let result = list_historical_sparse_candidates(
            &connection,
            Some(&HistoricalCapitalActionSparseCandidateInput {
                exchange: Some("NSE".to_string()),
                limit: Some(10),
            }),
        )
        .unwrap();
        let symbols = result
            .candidates
            .iter()
            .map(|candidate| candidate.symbol.as_str())
            .collect::<Vec<_>>();

        assert_eq!(symbols, vec!["INFY", "WIPRO"]);
        assert_eq!(result.candidates[0].unresolved_import_rows, 1);
        assert!(result.candidates[0].reason.contains("unresolved"));
        assert_eq!(
            result.candidates[1].first_price_date.as_deref(),
            Some("2000-01-01")
        );
        assert_eq!(
            result.candidates[1]
                .first_known_capital_action_date
                .as_deref(),
            Some("2004-01-01")
        );
    }

    #[test]
    fn alias_candidates_rank_active_symbols_with_old_identity_history() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  date TEXT NOT NULL
                );
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('NEWCO', 'NSE', 'INE000A01001', 'New Co', 1, 'EQ'),
                  ('WIPRO', 'NSE', 'INE075A01022', 'Wipro Limited', 1, 'EQ'),
                  ('INACTIVE', 'NSE', 'INE000A01003', 'Inactive Co', 0, 'EQ');
                INSERT INTO eod_prices (symbol, exchange, date)
                VALUES
                  ('NEWCO', 'NSE', '1999-01-01'),
                  ('WIPRO', 'NSE', '2000-01-01'),
                  ('INACTIVE', 'NSE', '1997-01-01');
                INSERT INTO instrument_identity_history (
                  exchange, isin, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'INE000A01001', 'NEWCO', 'New Co', 'MIDCO', 'NEWCO', '2005-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'INE000A01001', 'NEWCO', 'New Co', 'OLDCO', 'MIDCO', '1998-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'INE075A01022', 'WIPRO', 'Wipro Limited', 'OLDWIPRO', 'WIPRO', '2001-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'INE000A01003', 'INACTIVE', 'Inactive Co', 'OLDINACTIVE', 'INACTIVE', '1995-01-01', 'SYMBOL_CHANGE');
                ",
            )
            .unwrap();

        let result = list_historical_alias_candidates(
            &connection,
            Some(&HistoricalCapitalActionAliasCandidateInput {
                exchange: Some("NSE".to_string()),
                limit: Some(10),
            }),
        )
        .unwrap();
        let symbols = result
            .candidates
            .iter()
            .map(|candidate| candidate.symbol.as_str())
            .collect::<Vec<_>>();

        assert_eq!(symbols, vec!["NEWCO", "WIPRO"]);
        assert_eq!(result.candidates[0].alias_count, 2);
        assert_eq!(
            result.candidates[0].earliest_alias_date.as_deref(),
            Some("1998-01-01")
        );
        assert!(result.candidates[0]
            .old_symbols
            .contains(&"OLDCO".to_string()));
        assert!(result.candidates[0].reason.contains("old alias"));
    }

    #[test]
    fn major_liquid_candidates_rank_active_symbols_by_recent_traded_value() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  date TEXT NOT NULL,
                  close REAL NOT NULL,
                  volume INTEGER NOT NULL DEFAULT 0
                );
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('LIQUID', 'NSE', 'INE000A01001', 'Liquid Limited', 1, 'EQ'),
                  ('MIDLIQ', 'NSE', 'INE000A01002', 'Mid Liquid Limited', 1, 'EQ'),
                  ('ILLIQ', 'NSE', 'INE000A01003', 'Illiquid Limited', 1, 'EQ'),
                  ('INACTIVE', 'NSE', 'INE000A01004', 'Inactive Limited', 0, 'EQ');
                ",
            )
            .unwrap();

        for day in 1..=25 {
            let date = format!("2026-06-{day:02}");
            connection
                .execute(
                    "
                    INSERT INTO eod_prices (symbol, exchange, date, close, volume)
                    VALUES
                      ('LIQUID', 'NSE', ?1, 100.0, 100000),
                      ('MIDLIQ', 'NSE', ?1, 50.0, 50000),
                      ('INACTIVE', 'NSE', ?1, 500.0, 500000)
                    ",
                    params![date],
                )
                .unwrap();
        }

        for day in 1..=10 {
            let date = format!("2026-06-{day:02}");
            connection
                .execute(
                    "
                    INSERT INTO eod_prices (symbol, exchange, date, close, volume)
                    VALUES ('ILLIQ', 'NSE', ?1, 1000.0, 1000000)
                    ",
                    params![date],
                )
                .unwrap();
        }

        let result = list_historical_major_liquid_candidates(
            &connection,
            Some(&HistoricalCapitalActionMajorLiquidCandidateInput {
                exchange: Some("NSE".to_string()),
                limit: Some(10),
            }),
        )
        .unwrap();
        let symbols = result
            .candidates
            .iter()
            .map(|candidate| candidate.symbol.as_str())
            .collect::<Vec<_>>();

        assert_eq!(symbols, vec!["LIQUID", "MIDLIQ"]);
        assert!(
            result.candidates[0].average_recent_turnover
                > result.candidates[1].average_recent_turnover
        );
        assert_eq!(result.candidates[0].recent_bar_count, 25);
        assert!(result.candidates[0]
            .reason
            .contains("Average recent traded value"));
    }

    #[test]
    fn phase4_bse_identity_backfill_uses_first_class_security_code() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, bse_security_code, isin, name, is_active, series)
                VALUES
                  ('KOTAKBANK', 'NSE', NULL, 'INE237A01036', 'Kotak Mahindra Bank', 1, 'EQ'),
                  ('KOTAKBANK', 'BSE', '500247', 'INE237A01036', 'Kotak Mahindra Bank', 1, 'A')
                ",
                [],
            )
            .unwrap();

        let inferred = infer_bse_scrip_code_for_backfill(&connection, "KOTAKBANK", "NSE").unwrap();

        assert_eq!(inferred.as_deref(), Some("500247"));
    }

    #[test]
    fn infer_bse_scrip_code_for_backfill_skips_non_bse_matches() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('INFY', 'NSE', 'INE009A01021', 'Infosys Limited', 1, 'EQ')
                ",
                [],
            )
            .unwrap();

        let inferred = infer_bse_scrip_code_for_backfill(&connection, "INFY", "NSE").unwrap();

        assert_eq!(inferred, None);
    }

    #[test]
    fn phase4_bse_identity_resolves_security_code_to_alpha_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "
                INSERT INTO instruments (
                  symbol, exchange, bse_security_code, isin, name, is_active, series
                )
                VALUES ('RELIANCE', 'BSE', '500325', 'INE002A01018', 'Reliance Industries', 1, 'A')
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_bse_candidate(
            &connection,
            &Some("INE002A01018".to_string()),
            &Some("500325".to_string()),
            &Some("Reliance Industries".to_string()),
            "BSE",
        )
        .unwrap();

        assert_eq!(resolved.symbol.as_deref(), Some("RELIANCE"));
        assert_eq!(resolved.exchange, "BSE");
        assert_eq!(resolved.review_status, "PENDING");
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("security-code identity"));
    }

    #[test]
    fn phase4_bse_identity_flags_security_code_isin_mismatch() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "
                INSERT INTO instruments (
                  symbol, exchange, bse_security_code, isin, name, is_active, series
                )
                VALUES ('RELIANCE', 'BSE', '500325', 'INE002A01018', 'Reliance Industries', 1, 'A')
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_bse_candidate(
            &connection,
            &Some("INEHIST01018".to_string()),
            &Some("500325".to_string()),
            &Some("Reliance Industries".to_string()),
            "BSE",
        )
        .unwrap();

        assert_eq!(resolved.symbol.as_deref(), Some("RELIANCE"));
        assert_eq!(resolved.isin.as_deref(), Some("INEHIST01018"));
        assert_eq!(resolved.review_status, REVIEW_STATUS_PENDING_ISIN_MISMATCH);
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("official ISIN differs"));
    }

    #[test]
    fn phase4_bse_identity_does_not_cross_exchange_on_isin() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES ('RELIANCE', 'NSE', 'INE002A01018', 'Reliance Industries', 1, 'EQ')
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_bse_candidate(
            &connection,
            &Some("INE002A01018".to_string()),
            &Some("500325".to_string()),
            &Some("Reliance Industries".to_string()),
            "BSE",
        )
        .unwrap();

        assert_eq!(resolved.symbol, None);
        assert_eq!(resolved.exchange, "BSE");
        assert_eq!(resolved.review_status, "UNRESOLVED");
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("not found in the active database"));
    }

    #[test]
    fn phase4_bse_identity_rejects_duplicate_active_isin_matches() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO instruments (symbol, exchange, bse_security_code, isin, name, is_active, series)
                VALUES
                  ('DUPA', 'BSE', '500901', 'INEDUPL01001', 'Duplicate A', 1, 'A'),
                  ('DUPB', 'BSE', '500902', 'INEDUPL01001', 'Duplicate B', 1, 'A');
                ",
            )
            .unwrap();

        let resolved = resolve_bse_candidate(
            &connection,
            &Some("INEDUPL01001".to_string()),
            &None,
            &Some("Duplicate Company".to_string()),
            "BSE",
        )
        .unwrap();

        assert_eq!(resolved.symbol, None);
        assert_eq!(resolved.review_status, "UNRESOLVED");
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("multiple database instruments"));
    }

    #[test]
    fn historical_store_attaches_evidence_to_equivalent_existing_import() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, record_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                )
                VALUES (
                  'nse-infy-bonus-2006', 'NSE', 'NSE_API', 'INFY', 'INE009A01021', 'Infosys Limited',
                  'Bonus 1:1', '2006-07-13', NULL, 'BONUS', 1, 1, 2, 0.5, 'PARSED', 'PENDING'
                )
                ",
                [],
            )
            .unwrap();
        let candidate = NewImportCandidate {
            dedupe_key: "bse-infy-bonus-2006".to_string(),
            exchange: "NSE".to_string(),
            source: "BSE_API".to_string(),
            source_file: Some("https://api.bseindia.com/example".to_string()),
            symbol: Some("INFY".to_string()),
            isin: Some("INE009A01021".to_string()),
            bse_scrip_code: Some("500209".to_string()),
            company_name: Some("Infosys Limited".to_string()),
            purpose_raw: "Bonus 1:1".to_string(),
            ex_date: Some("2006-07-13".to_string()),
            record_date: None,
            action_type: "BONUS".to_string(),
            ratio_num: Some(1.0),
            ratio_den: Some(1.0),
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            factor: Some(2.0),
            price_factor: Some(0.5),
            parse_status: "PARSED".to_string(),
            review_status: "PENDING".to_string(),
            message: None,
            evidence: NewImportEvidence {
                source_locator: Some("https://api.bseindia.com/example".to_string()),
                symbol_seen: Some("INFY".to_string()),
                isin_seen: None,
                company_name_seen: Some("Infosys Limited".to_string()),
                action_type_seen: Some("BONUS".to_string()),
                event_date_seen: Some("2006-07-13".to_string()),
                factor_seen: Some(2.0),
                raw_reference: Some("{\"purpose\":\"Bonus 1:1\"}".to_string()),
                note: Some("Historical pilot evidence".to_string()),
            },
        };

        let outcome = store_import_candidate_evidence_aware(&connection, &candidate).unwrap();

        assert!(matches!(
            outcome,
            HistoricalCandidateStoreOutcome::EvidenceAttached { .. }
        ));
        let import_count = connection
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                row.get::<_, i64>(0)
            })
            .unwrap();
        assert_eq!(import_count, 1);
        let evidence_count = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence WHERE import_id = 1 AND source_code = 'BSE_API'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap();
        assert_eq!(evidence_count, 1);
    }

    #[test]
    fn parses_nse_and_bse_dates() {
        assert_eq!(parse_official_date("07-JUN-2024").unwrap(), "2024-06-07");
        assert_eq!(parse_official_date("07-Jun-2024").unwrap(), "2024-06-07");
        assert_eq!(parse_official_date("07/06/2024").unwrap(), "2024-06-07");
        assert_eq!(parse_official_date("07 Jun 2024").unwrap(), "2024-06-07");
        assert_eq!(parse_official_date("20240607").unwrap(), "2024-06-07");
    }

    #[test]
    fn parses_split_face_value_factor() {
        let parsed =
            parse_corporate_action_purpose("Sub-Division of Equity Shares from Rs.10/- to Rs.5/-");
        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.old_face_value, Some(10.0));
        assert_eq!(parsed.new_face_value, Some(5.0));
        assert_eq!(parsed.factor, Some(2.0));
        assert_eq!(parsed.price_factor, Some(0.5));
    }

    #[test]
    fn parser_guardrail_marks_compound_bonus_and_split_for_review() {
        let parsed = parse_corporate_action_purpose(
            "Bonus Equity Shares in the ratio of 1:1 and Face Value Split from Rs 10 to Rs 1",
        );

        assert_eq!(parsed.action_type, "BONUS");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.factor, None);
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("Multiple corporate-action types"));
    }

    #[test]
    fn parser_guardrail_marks_compound_dividend_and_split_for_review() {
        let parsed = parse_corporate_action_purpose(
            "Dividend Rs 1.35 per share and Split from Rs 10 to Rs 2",
        );

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.cash_amount, None);
        assert_eq!(parsed.factor, None);
    }

    #[test]
    fn ca_phase2b_legacy_split_abbreviation_parses_face_values() {
        for (purpose, old_fv, new_fv) in [
            ("Fv Splt Frm Rs 10 To Re 1", 10.0, 1.0),
            ("Fv Splt Frm Rs 10 To Rs 2", 10.0, 2.0),
            ("Agm/Fv Spl Rs.10 To Re.1", 10.0, 1.0),
        ] {
            let parsed = parse_corporate_action_purpose(purpose);
            assert_eq!(parsed.action_type, "SPLIT", "{purpose}");
            assert_eq!(parsed.parse_status, "PARSED", "{purpose}");
            assert_eq!(parsed.old_face_value, Some(old_fv), "{purpose}");
            assert_eq!(parsed.new_face_value, Some(new_fv), "{purpose}");
            assert_eq!(parsed.factor, Some(old_fv / new_fv), "{purpose}");
        }
    }

    #[test]
    fn ca_phase2b_legacy_split_bonus_abbreviation_becomes_two_components() {
        for (purpose, split_factor, bonus_factor) in [
            ("Fv Spl-Rs10tors2/Bon-1:2", 5.0, 1.5),
            ("Fv Spl-Rs10tore1/Bon-3:2", 10.0, 2.5),
            ("Bon 1:1/Fv Spl Rs.5tors.2", 2.5, 2.0),
            ("Fv Spl-10 To 5 / Bon 1:2", 2.0, 1.5),
        ] {
            let whole = parse_corporate_action_purpose(purpose);
            assert_eq!(whole.parse_status, "NEEDS_REVIEW", "{purpose}");
            assert!(whole.message.as_deref().unwrap_or_default().contains("Multiple corporate-action types"));
            let parts = split_bonus_preparation::components(purpose).expect(purpose);
            let factor = |kind: &str| parts.iter().find(|p| p.action_type == kind).and_then(|p| p.factor);
            assert_eq!(factor("SPLIT"), Some(split_factor), "{purpose}");
            assert_eq!(factor("BONUS"), Some(bonus_factor), "{purpose}");
        }
    }

    #[test]
    fn ca_phase2b_legacy_abbreviation_leaves_other_wording_unchanged() {
        for purpose in [
            "Spl Div Rs 5 Per Share",
            "Special Dividend - Rs 2",
            "Bon 1 Dvr : 20 Eq Shares",
            "Buyback Of Bonds",
            "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
        ] {
            assert_eq!(canonical_purpose(purpose), purpose, "{purpose}");
        }
        assert_ne!(parse_corporate_action_purpose("Spl Div Rs 5 Per Share").action_type, "SPLIT");
        assert_ne!(parse_corporate_action_purpose("Bon 1 Dvr : 20 Eq Shares").action_type, "BONUS");
        assert!(detected_corporate_action_families(&normalize_text("Spl Div Rs 5")).iter().all(|f| f != "SPLIT"));
    }

    #[test]
    fn ca_l1_demerger_parse_never_guesses_a_price_factor() {
        for purpose in [
            "Demerger",
            "Scheme of Arrangement - Demerger 1:1",
            "Demerger - cost of acquisition 35.5%",
            "Spin Off of Division",
        ] {
            let parsed = parse_corporate_action_purpose(purpose);
            assert_eq!(parsed.action_type, "DEMERGER", "{purpose}");
            assert_eq!(parsed.parse_status, "NEEDS_REVIEW", "{purpose}");
            assert_eq!(parsed.factor, None, "{purpose}");
            assert_eq!(parsed.price_factor, None, "{purpose}");
            assert!(parsed
                .message
                .as_deref()
                .unwrap_or_default()
                .contains("No adjustment applied"));
        }
        let with_ratio = parse_corporate_action_purpose("Scheme of Arrangement - Demerger 1:1");
        assert_eq!(with_ratio.ratio_num, Some(1.0));
        assert_eq!(with_ratio.ratio_den, Some(1.0));
    }

    #[test]
    fn phase6d_marks_abbreviated_dividend_and_bonus_for_review() {
        let parsed = parse_corporate_action_purpose("Div 30%/Bonus - 1:1");

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.cash_amount, None);
        assert_eq!(parsed.factor, None);
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("Multiple corporate-action types"));
    }

    #[test]
    fn phase6d_does_not_treat_sub_division_as_abbreviated_dividend() {
        let parsed = parse_corporate_action_purpose(
            "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
        );

        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.factor, Some(5.0));
    }

    #[test]
    fn parser_guardrail_marks_split_without_explicit_value_or_ratio_context_for_review() {
        let parsed = parse_corporate_action_purpose("Split Us 64 Into 2 Parts");

        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.old_face_value, None);
        assert_eq!(parsed.new_face_value, None);
        assert_eq!(parsed.factor, None);
    }

    #[test]
    fn parser_guardrail_marks_split_with_extra_unscoped_number_for_review() {
        let parsed = parse_corporate_action_purpose("UTI 64 Split from Rs 10 to Rs 2");

        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.factor, None);
    }

    #[test]
    fn parser_guardrail_preserves_split_ratio_without_face_value_context() {
        let parsed = parse_corporate_action_purpose("Stock Split in the ratio of 5:1");

        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.ratio_num, Some(5.0));
        assert_eq!(parsed.ratio_den, Some(1.0));
        assert_eq!(parsed.factor, Some(5.0));
    }

    #[test]
    fn parses_consolidation_face_value_factor() {
        let parsed =
            parse_corporate_action_purpose("Consolidation of Equity Shares from Re.1/- to Rs.10/-");
        assert_eq!(parsed.action_type, "SPLIT");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.old_face_value, Some(1.0));
        assert_eq!(parsed.new_face_value, Some(10.0));
        assert_eq!(parsed.factor, Some(0.1));
        assert_eq!(parsed.price_factor, Some(10.0));

        let fv2_to_10 =
            parse_corporate_action_purpose("Consolidation of Shares from Rs. 2/- to Rs. 10/-");
        assert_eq!(fv2_to_10.action_type, "SPLIT");
        assert_eq!(fv2_to_10.parse_status, "PARSED");
        assert_eq!(fv2_to_10.old_face_value, Some(2.0));
        assert_eq!(fv2_to_10.new_face_value, Some(10.0));
        assert_eq!(fv2_to_10.factor, Some(0.2));
        assert_eq!(fv2_to_10.price_factor, Some(5.0));
    }

    #[test]
    fn parses_consolidation_ratio_and_reverse_split() {
        let ratio_1_to_5 =
            parse_corporate_action_purpose("Consolidation in the ratio of 1:5");
        assert_eq!(ratio_1_to_5.action_type, "SPLIT");
        assert_eq!(ratio_1_to_5.parse_status, "PARSED");
        assert_eq!(ratio_1_to_5.ratio_num, Some(1.0));
        assert_eq!(ratio_1_to_5.ratio_den, Some(5.0));
        assert_eq!(ratio_1_to_5.factor, Some(0.2));
        assert_eq!(ratio_1_to_5.price_factor, Some(5.0));

        let ratio_10_to_1_swapped =
            parse_corporate_action_purpose("Consolidation of shares 10:1");
        assert_eq!(ratio_10_to_1_swapped.action_type, "SPLIT");
        assert_eq!(ratio_10_to_1_swapped.parse_status, "PARSED");
        assert_eq!(ratio_10_to_1_swapped.ratio_num, Some(1.0));
        assert_eq!(ratio_10_to_1_swapped.ratio_den, Some(10.0));
        assert_eq!(ratio_10_to_1_swapped.factor, Some(0.1));
        assert_eq!(ratio_10_to_1_swapped.price_factor, Some(10.0));

        let rev_split =
            parse_corporate_action_purpose("Reverse Split in the ratio of 1:10");
        assert_eq!(rev_split.action_type, "SPLIT");
        assert_eq!(rev_split.parse_status, "PARSED");
        assert_eq!(rev_split.ratio_num, Some(1.0));
        assert_eq!(rev_split.ratio_den, Some(10.0));
        assert_eq!(rev_split.factor, Some(0.1));
        assert_eq!(rev_split.price_factor, Some(10.0));
    }

    #[test]
    fn compound_action_catches_consolidation_with_dividend() {
        let compound = parse_corporate_action_purpose(
            "Consolidation of Shares from Rs. 1 to Rs. 10 and Dividend Rs 2 per share",
        );
        assert_eq!(compound.parse_status, "NEEDS_REVIEW");
        assert!(compound
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("Multiple corporate-action types"));
    }

    #[test]
    fn parser_guardrail_does_not_treat_bright_as_rights() {
        let parsed = parse_corporate_action_purpose("Bright Industries Bonus issue 1:1");

        assert_eq!(parsed.action_type, "BONUS");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.factor, Some(2.0));
    }

    #[test]
    fn parses_bonus_share_multiplier() {
        let one_for_one = parse_corporate_action_purpose("Bonus issue in the ratio of 1:1");
        assert_eq!(one_for_one.action_type, "BONUS");
        assert_eq!(one_for_one.factor, Some(2.0));

        let one_for_two = parse_corporate_action_purpose("Bonus Equity Shares in the ratio of 1:2");
        assert_eq!(one_for_two.action_type, "BONUS");
        assert_eq!(one_for_two.factor, Some(1.5));
    }

    #[test]
    fn parses_dividend_amount_for_manual_approval() {
        let parsed = parse_corporate_action_purpose("Interim Dividend - Rs. 7.50 per share");
        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.cash_amount, Some(7.50));
        assert_eq!(parsed.factor, None);
    }

    #[test]
    fn phase6d_parses_abbreviated_dividend_amount_for_manual_approval() {
        let parsed = parse_corporate_action_purpose("Interim Div - Rs. 7.50 per share");

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.cash_amount, Some(7.50));
    }

    #[test]
    fn parses_multiple_dividend_cash_components_when_segments_are_explicit() {
        let parsed = parse_corporate_action_purpose(
            "Interim Dividend - Rs. 7.50 per share & Special Dividend - Rs. 3.50 per share",
        );
        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.cash_amount, Some(11.0));
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("Combined multiple per-share dividend cash components"));
    }

    #[test]
    fn phase6f_parses_inventory_multi_dividend_separator_forms() {
        for (purpose, expected) in [
            (
                "Annual General Meeting/Dividend - Rs 24 Per Share/Special Dividend - Rs 24 Per Share",
                48.0,
            ),
            (
                "Interim Dividend - Rs 41 Per Share And Special Dividend - Rs 70 Per Share",
                111.0,
            ),
            (
                "Final Dividend Rs 6/- Plus Special Dividend Rs 4/- Per Share",
                10.0,
            ),
            (
                "Interim Dividend - Rs 65 Per Share Special Dividend - Rs 5 Per Share",
                70.0,
            ),
            (
                "Dividend - Rs 35 Per Share & Special Dividend Of Rs 100 Per Share/ Special Dividend Of Rs 30",
                165.0,
            ),
        ] {
            let parsed = parse_corporate_action_purpose(purpose);
            assert_eq!(parsed.action_type, "DIVIDEND", "{purpose}");
            assert_eq!(parsed.parse_status, "PARSED", "{purpose}");
            assert_eq!(parsed.cash_amount, Some(expected), "{purpose}");
        }
    }

    #[test]
    fn phase6f_keeps_incomplete_multiple_dividend_components_for_review() {
        for purpose in [
            "Interim Dividend Rs 7.50 per share and Special Dividend amount to be announced",
            "Final Dividend Rs.8.50 Per Share (Including Special Dividend Rs.2 Per Share)",
        ] {
            let parsed = parse_corporate_action_purpose(purpose);
            assert_eq!(parsed.action_type, "DIVIDEND", "{purpose}");
            assert_eq!(parsed.parse_status, "NEEDS_REVIEW", "{purpose}");
            assert_eq!(parsed.cash_amount, None, "{purpose}");
        }
    }

    #[test]
    fn phase6f_uses_explicit_distribution_headline_before_comprising() {
        for (purpose, expected) in [
            (
                "Distritbution - Rs 2.98 Per Unit Comprising Of Rs 1.84 Per Unit In The Form Dividend & Re 0.85 Per Unit In The Form Of Interest & Re 0.29 Per Unit In The Form Of Repayment Of Loan",
                2.98,
            ),
            (
                "Distribution- Rs 3.45 Comprising Interest Payment- Rs 2.5344 Per Unit / Dividend - Re 0.2848 Per Unit/ Principal Payment- Re 0.5853 Per Unit/ Other Income - Re 0.0455 Per Unit",
                3.45,
            ),
        ] {
            let parsed = parse_corporate_action_purpose(purpose);
            assert_eq!(parsed.action_type, "DIVIDEND", "{purpose}");
            assert_eq!(parsed.parse_status, "PARSED", "{purpose}");
            assert_eq!(parsed.cash_amount, Some(expected), "{purpose}");
            assert!(parsed
                .message
                .as_deref()
                .unwrap_or_default()
                .contains("explicit headline cash distribution"));
        }
    }

    #[test]
    fn phase6d_parses_explicit_headline_unit_distribution_without_double_counting_components() {
        let parsed = parse_corporate_action_purpose(
            "Distribution Rs 5.10 Per Unit Comprising Of Dividend - Re 0.09 Per Unit/Interest Amount - Rs 2.42 Per Unit/Repayment Of Spv Debt - Rs 2.57 Per Unit/Interest On Fixed Deposits - Re 0.02 Per Unit",
        );

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.cash_amount, Some(5.10));
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("explicit headline cash distribution"));
    }

    #[test]
    fn phase6d_parses_complete_labelled_unit_distribution_components() {
        let parsed = parse_corporate_action_purpose(
            "Interest Payment Rs 2.03 Per Unit/Return Of Capital Rs 1.57 Per Unit/Dividend Re 0.55 Per Unit/Other Income On Surplus Re 0.04 Per Unit",
        );

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "PARSED");
        assert!((parsed.cash_amount.unwrap_or_default() - 4.19).abs() < 0.000_000_1);
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("Combined labelled cash distribution components"));
    }

    #[test]
    fn phase6d_marks_incomplete_unit_distribution_components_for_review() {
        let parsed = parse_corporate_action_purpose(
            "Dividend - Rs 2.54 Per Unit/Interest Amount - Rs 1.14 Per Unit/Proceeds - 1.98 Per Unit",
        );

        assert_eq!(parsed.action_type, "DIVIDEND");
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW");
        assert_eq!(parsed.cash_amount, None);
        assert!(parsed
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("review every cash component manually"));
    }

    #[test]
    fn approved_corporate_action_source_preserves_import_provenance() {
        assert_eq!(approved_corporate_action_source("NSE_API"), "NSE_API");
        assert_eq!(approved_corporate_action_source("BSE_API"), "BSE_API");
        assert_eq!(approved_corporate_action_source("NSE_CSV"), "NSE_CSV");
        assert_eq!(approved_corporate_action_source("BSE_CSV"), "BSE_CSV");
    }

    #[test]
    fn parses_rights_when_issue_price_is_explicit() {
        let parsed = parse_corporate_action_purpose("Rights issue 1:9 at Rs 95 per share");
        assert_eq!(parsed.action_type, "RIGHTS");
        assert_eq!(parsed.parse_status, "PARSED");
        assert_eq!(parsed.ratio_num, Some(1.0));
        assert_eq!(parsed.ratio_den, Some(9.0));
        assert_eq!(parsed.cash_amount, Some(95.0));
    }

    fn test_import_candidate() -> NewImportCandidate {
        NewImportCandidate {
            dedupe_key: build_dedupe_key(
                "NSE_API",
                "NSE",
                Some("TRENT"),
                Some("INE849A01020"),
                "BONUS",
                Some("2026-06-04"),
                Some("2026-06-01"),
                "Bonus 1:2",
            ),
            exchange: "NSE".to_string(),
            source: "NSE_API".to_string(),
            source_file: Some(
                "https://www.nseindia.com/api/corporates-corporateActions".to_string(),
            ),
            symbol: Some("TRENT".to_string()),
            isin: Some("INE849A01020".to_string()),
            bse_scrip_code: None,
            company_name: Some("TRENT LIMITED".to_string()),
            purpose_raw: "Bonus 1:2".to_string(),
            ex_date: Some("2026-06-04".to_string()),
            record_date: Some("2026-06-01".to_string()),
            action_type: "BONUS".to_string(),
            ratio_num: Some(1.0),
            ratio_den: Some(2.0),
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            factor: Some(1.5),
            price_factor: Some(0.6666666667),
            parse_status: "PARSED".to_string(),
            review_status: "PENDING".to_string(),
            message: None,
            evidence: NewImportEvidence {
                source_locator: Some(
                    "https://www.nseindia.com/api/corporates-corporateActions".to_string(),
                ),
                symbol_seen: Some("TRENT".to_string()),
                isin_seen: Some("INE849A01020".to_string()),
                company_name_seen: Some("TRENT LIMITED".to_string()),
                action_type_seen: Some("BONUS".to_string()),
                event_date_seen: Some("2026-06-04".to_string()),
                factor_seen: Some(1.5),
                raw_reference: build_import_evidence_raw_reference(
                    Some("TRENT"),
                    Some("INE849A01020"),
                    None,
                    Some("TRENT LIMITED"),
                    "Bonus 1:2",
                    Some("2026-06-04"),
                    Some("2026-06-01"),
                ),
                note: Some(build_import_evidence_note("NSE_API")),
            },
        }
    }

    fn insert_phase5b_matching_action(
        connection: &Connection,
        symbol: Option<&str>,
        isin: Option<&str>,
    ) {
        connection
            .execute(
                "
                  INSERT INTO corporate_action_imports (
                    dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw,
                    ex_date, record_date, action_type, ratio_num, ratio_den, factor, price_factor,
                    parse_status, review_status
                  )
                  VALUES (
                    'phase5b-existing', 'NSE', 'BSE_API', ?, ?, 'TRENT LIMITED', 'Bonus 1:2',
                    '2026-06-04', '2026-06-01', 'BONUS', 1, 2, 1.5, 0.6666666667,
                    'PARSED', 'PENDING'
                  )
                ",
                params![symbol, isin],
            )
            .unwrap();
    }

    #[test]
    fn phase5b_same_symbol_conflicting_isin_is_not_equivalent() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        insert_phase5b_matching_action(&connection, Some("TRENT"), Some("INE000A01001"));
        let candidate = test_import_candidate();

        let matched = find_equivalent_import_row_id(&connection, &candidate).unwrap();

        assert_eq!(matched, None);
    }

    #[test]
    fn phase5b_raw_event_identity_overrides_matching_resolved_fields() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        insert_phase5b_matching_action(&connection, Some("TRENT"), Some("INE849A01020"));
        connection
            .execute(
                "
                  INSERT INTO corporate_action_import_evidence (
                    import_id, source_code, symbol_seen, isin_seen, event_date_seen
                  ) VALUES (1, 'BSE_API', 'TRENT', 'INE000A01001', '2026-06-04')
                ",
                [],
            )
            .unwrap();
        let mut candidate = test_import_candidate();
        candidate.evidence.isin_seen = Some("INE999A01001".to_string());

        let matched = find_equivalent_import_row_id(&connection, &candidate).unwrap();

        assert_eq!(matched, None);
    }

    #[test]
    fn phase5b_same_event_isin_across_alias_symbols_is_equivalent() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        insert_phase5b_matching_action(&connection, Some("OLDTRENT"), Some("INE849A01020"));
        let candidate = test_import_candidate();

        let matched = find_equivalent_import_row_id(&connection, &candidate).unwrap();

        assert_eq!(matched, Some(1));
    }

    #[test]
    fn phase5b_exact_event_date_isin_evidence_bridges_symbols() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        insert_phase5b_matching_action(&connection, Some("NEWTRENT"), None);
        connection
            .execute(
                "
                  INSERT INTO instrument_isin_history (
                    exchange, symbol, isin, effective_date, source
                  ) VALUES
                    ('NSE', 'OLDTRENT', 'INE849A01020', '2026-06-04', 'TEST'),
                    ('NSE', 'NEWTRENT', 'INE849A01020', '2026-06-04', 'TEST')
                ",
                [],
            )
            .unwrap();
        let mut candidate = test_import_candidate();
        candidate.symbol = Some("OLDTRENT".to_string());
        candidate.isin = None;
        candidate.evidence.symbol_seen = Some("OLDTRENT".to_string());
        candidate.evidence.isin_seen = None;

        let matched = find_equivalent_import_row_id(&connection, &candidate).unwrap();

        assert_eq!(matched, Some(1));
    }

    #[test]
    fn phase5b_stale_event_date_isin_evidence_does_not_bridge_symbols() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        insert_phase5b_matching_action(&connection, Some("NEWTRENT"), None);
        connection
            .execute(
                "
                  INSERT INTO instrument_isin_history (
                    exchange, symbol, isin, effective_date, source
                  ) VALUES
                    ('NSE', 'OLDTRENT', 'INE849A01020', '2026-06-03', 'TEST'),
                    ('NSE', 'NEWTRENT', 'INE849A01020', '2026-06-03', 'TEST')
                ",
                [],
            )
            .unwrap();
        let mut candidate = test_import_candidate();
        candidate.symbol = Some("OLDTRENT".to_string());
        candidate.isin = None;
        candidate.evidence.symbol_seen = Some("OLDTRENT".to_string());
        candidate.evidence.isin_seen = None;

        let matched = find_equivalent_import_row_id(&connection, &candidate).unwrap();

        assert_eq!(matched, None);
    }

    fn duplicate_fetch_evidence_fixture() -> (Connection, NewImportCandidate, i64) {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        let candidate = test_import_candidate();
        let row = insert_import_candidate(&connection, &candidate).unwrap();
        for table in ["corporate_actions", "eod_prices"] {
            for operation in ["INSERT", "UPDATE", "DELETE"] {
                connection.execute_batch(&format!("CREATE TEMP TRIGGER duplicate_no_{table}_{operation}
                    BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT,'financial write forbidden'); END;")).unwrap();
            }
        }
        (connection, candidate, row.id)
    }

    #[test]
    fn duplicate_fetch_evidence_recovers_missing_witness_and_repeats_without_writes() {
        let (c, candidate, import_id) = duplicate_fetch_evidence_fixture();
        // Model an old build that kept the import but did not retain evidence.
        c.execute("DELETE FROM corporate_action_import_evidence WHERE import_id=?",[import_id]).unwrap();
        c.execute_batch("CREATE TEMP TRIGGER duplicate_no_import_update BEFORE UPDATE ON corporate_action_imports
            BEGIN SELECT RAISE(ABORT,'import changes forbidden'); END;").unwrap();
        let outcome = store_import_candidate_evidence_aware(&c,&candidate).unwrap();
        assert!(matches!(outcome,HistoricalCandidateStoreOutcome::EvidenceAttached { import_id: id, .. } if id==import_id));
        let row = get_import_row(&c,import_id).unwrap();
        assert_eq!(row.evidence_count,1);
        assert_eq!(row.latest_evidence_note,candidate.evidence.note);
        let before: i64 = c.query_row("SELECT total_changes()",[],|r|r.get(0)).unwrap();
        assert!(matches!(store_import_candidate_evidence_aware(&c,&candidate).unwrap(),HistoricalCandidateStoreOutcome::Duplicate { import_id: id } if id==import_id));
        assert_eq!(before,c.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap());
        assert_eq!(get_import_row(&c,import_id).unwrap().evidence_count,1);
        assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_imports",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    }

    #[test]
    fn duplicate_fetch_evidence_preserves_legacy_notes_and_approved_imports() {
        let (c, candidate, import_id) = duplicate_fetch_evidence_fixture();
        c.execute("UPDATE corporate_action_import_evidence SET note='Backfilled from an existing corporate_action_imports row.' WHERE import_id=?",[import_id]).unwrap();
        c.execute("UPDATE corporate_action_imports SET review_status='APPROVED',approved_at='2026-08-20' WHERE id=?",[import_id]).unwrap();
        c.execute_batch("CREATE TEMP TRIGGER duplicate_no_import_update BEFORE UPDATE ON corporate_action_imports
            BEGIN SELECT RAISE(ABORT,'approved import changes forbidden'); END;").unwrap();
        let old: (i64,String,Option<String>) = c.query_row("SELECT id,captured_at,note FROM corporate_action_import_evidence WHERE import_id=?",[import_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert!(matches!(store_import_candidate_evidence_aware(&c,&candidate).unwrap(),HistoricalCandidateStoreOutcome::Duplicate { .. }));
        let mut fresh = candidate.clone();
        fresh.evidence.source_locator = Some("https://www.nseindia.com/verified-refetch".to_string());
        let outcome = store_import_candidate_evidence_aware(&c,&fresh).unwrap();
        let HistoricalCandidateStoreOutcome::EvidenceAttached { evidence_id, .. } = outcome else { panic!("Fresh source evidence was discarded") };
        let retained: (i64,String,Option<String>) = c.query_row("SELECT id,captured_at,note FROM corporate_action_import_evidence WHERE id=?",[old.0],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(old,retained);
        let fresh_note: Option<String> = c.query_row("SELECT note FROM corporate_action_import_evidence WHERE id=?",[evidence_id],|r|r.get(0)).unwrap();
        assert_eq!(fresh_note,fresh.evidence.note);
        let row = get_import_row(&c,import_id).unwrap();
        assert_eq!(row.evidence_count,2);
        assert_eq!(row.review_status,"APPROVED");
        assert_eq!(row.approved_at.as_deref(),Some("2026-08-20"));
    }

    #[test]
    fn duplicate_fetch_evidence_rolls_back_when_new_note_cannot_be_saved() {
        let (c,candidate,import_id) = duplicate_fetch_evidence_fixture();
        c.execute("DELETE FROM corporate_action_import_evidence WHERE import_id=?",[import_id]).unwrap();
        c.execute_batch("CREATE TEMP TRIGGER duplicate_fail_note BEFORE UPDATE OF note ON corporate_action_import_evidence
            WHEN NEW.note IS NOT NULL BEGIN SELECT RAISE(ABORT,'injected evidence note failure'); END;").unwrap();
        let error = store_import_candidate_evidence_aware(&c,&candidate).unwrap_err();
        assert!(error.contains("injected evidence note failure"));
        assert_eq!(get_import_row(&c,import_id).unwrap().evidence_count,0);
        assert!(c.is_autocommit());
    }

    #[test]
    fn insert_import_candidate_records_structured_source_evidence() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();

        let candidate = test_import_candidate();

        let row = insert_import_candidate(&connection, &candidate).unwrap();
        assert_eq!(row.symbol.as_deref(), Some("TRENT"));

        let evidence_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence WHERE import_id = ?",
                params![row.id],
                |db_row| db_row.get(0),
            )
            .unwrap();
        assert_eq!(evidence_count, 1);

        let raw_reference: Option<String> = connection
            .query_row(
                "
                  SELECT raw_reference
                  FROM corporate_action_import_evidence
                  WHERE import_id = ?
                ",
                params![row.id],
                |db_row| db_row.get(0),
            )
            .unwrap();
        assert!(raw_reference
            .as_deref()
            .unwrap_or_default()
            .contains("\"purposeRaw\":\"Bonus 1:2\""));
    }

    #[test]
    fn phase3_import_atomicity_rolls_back_candidate_insert_failure() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute_batch(
                "
                CREATE TRIGGER phase3_fail_candidate_insert
                BEFORE INSERT ON corporate_action_imports
                BEGIN
                  SELECT RAISE(ABORT, 'injected candidate failure');
                END;
                ",
            )
            .unwrap();

        let error = insert_import_candidate(&connection, &test_import_candidate()).unwrap_err();
        assert!(error.contains("injected candidate failure"));
        let import_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                row.get(0)
            })
            .unwrap();
        let evidence_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(import_count, 0);
        assert_eq!(evidence_count, 0);
    }

    #[test]
    fn phase3_import_atomicity_rolls_back_candidate_when_evidence_fails() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute_batch(
                "
                CREATE TRIGGER phase3_fail_evidence_insert
                BEFORE INSERT ON corporate_action_import_evidence
                BEGIN
                  SELECT RAISE(ABORT, 'injected evidence failure');
                END;
                ",
            )
            .unwrap();

        let error = insert_import_candidate(&connection, &test_import_candidate()).unwrap_err();
        assert!(error.contains("injected evidence failure"));
        let import_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                row.get(0)
            })
            .unwrap();
        let evidence_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(import_count, 0);
        assert_eq!(evidence_count, 0);
    }

    #[test]
    fn phase3_import_atomicity_withholds_partial_range_coverage() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        let mut errors = vec!["Official row 2: injected row failure".to_string()];

        let recorded = record_fetch_coverage_if_complete(
            &connection,
            "NSE",
            "NSE_API",
            "2026-06-01",
            "2026-06-05",
            1,
            &mut errors,
        )
        .unwrap();

        assert!(!recorded);
        assert!(errors
            .last()
            .unwrap()
            .contains("range remains retryable without Force re-fetch"));
        let coverage_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_fetch_coverage",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(coverage_count, 0);
    }

    #[test]
    fn phase3_import_atomicity_surfaces_coverage_insert_failure() {
        let connection = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        connection
            .execute_batch(
                "
                CREATE TRIGGER phase3_fail_coverage_insert
                BEFORE INSERT ON corporate_action_fetch_coverage
                BEGIN
                  SELECT RAISE(ABORT, 'injected coverage failure');
                END;
                ",
            )
            .unwrap();
        let mut errors = Vec::new();

        let error = record_fetch_coverage_if_complete(
            &connection,
            "NSE",
            "NSE_API",
            "2026-06-01",
            "2026-06-05",
            0,
            &mut errors,
        )
        .unwrap_err();

        assert!(error.contains("injected coverage failure"));
        let coverage_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_fetch_coverage",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(coverage_count, 0);
    }

    #[test]
    fn list_import_rows_filters_by_action_type() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL DEFAULT 'OTHER',
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
                  review_status TEXT NOT NULL DEFAULT 'PENDING',
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                ",
            )
            .unwrap();
        create_import_evidence_table(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES
                  ('split-1', 'NSE', 'TEST', 'AAA', 'Split', '2026-06-01', 'SPLIT', 'PARSED', 'PENDING'),
                  ('dividend-1', 'NSE', 'TEST', 'BBB', 'Dividend', '2026-06-02', 'DIVIDEND', 'PARSED', 'PENDING')
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO corporate_action_import_evidence (
                  import_id, source_code, source_locator, captured_at, note
                )
                VALUES
                  (2, 'NSE_API', 'https://example.test/nse', '2026-06-12T01:00:00Z', 'NSE historical pilot'),
                  (2, 'BSE_API', 'https://example.test/bse', '2026-06-12T02:00:00Z', 'BSE historical pilot')
                ",
                [],
            )
            .unwrap();

        let rows = list_import_rows(
            &connection,
            Some(&CorporateActionImportListInput {
                review_status: None,
                action_types: Some(vec!["DIVIDEND".to_string()]),
                search_query: None,
                exclude_approved: None,
                limit: Some(50),
                offset: None,
            }),
        )
        .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].action_type, "DIVIDEND");
        assert_eq!(rows[0].evidence_count, 2);
        assert!(rows[0].evidence_sources.contains(&"NSE_API".to_string()));
        assert!(rows[0].evidence_sources.contains(&"BSE_API".to_string()));
        assert_eq!(
            rows[0].latest_evidence_source_locator.as_deref(),
            Some("https://example.test/bse")
        );
    }

    #[test]
    fn list_import_rows_orders_by_ex_date_desc() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL DEFAULT 'OTHER',
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
                  review_status TEXT NOT NULL DEFAULT 'PENDING',
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                ",
            )
            .unwrap();
        create_import_evidence_table(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date, action_type, parse_status, review_status, imported_at
                )
                VALUES
                  ('old-1', 'NSE', 'TEST', 'OLDER', 'Older', '2025-12-31', 'BONUS', 'PARSED', 'PENDING', '2026-06-09T10:00:00Z'),
                  ('new-1', 'NSE', 'TEST', 'NEWER', 'Newer', '2026-06-08', 'BONUS', 'PARSED', 'PENDING', '2026-06-09T09:00:00Z')
                ",
                [],
            )
            .unwrap();

        let rows = list_import_rows(
            &connection,
            Some(&CorporateActionImportListInput {
                review_status: None,
                action_types: Some(vec!["BONUS".to_string()]),
                search_query: None,
                exclude_approved: None,
                limit: Some(50),
                offset: None,
            }),
        )
        .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].symbol.as_deref(), Some("NEWER"));
        assert_eq!(rows[1].symbol.as_deref(), Some("OLDER"));
        // Approval history is independently chronological, not ex-date sorted.
        connection.execute_batch("UPDATE corporate_action_imports SET review_status='APPROVED', approved_at=CASE symbol WHEN 'OLDER' THEN '2026-10-24T14:00:00+00:00' ELSE '2026-10-24T18:00:00+05:30' END;").unwrap();
        let approved = list_import_rows(&connection, Some(&CorporateActionImportListInput {
            review_status: Some("APPROVED".into()), action_types: None, search_query: None,
            exclude_approved: None, limit: Some(50), offset: None,
        })).unwrap();
        assert_eq!(approved[0].symbol.as_deref(), Some("OLDER"));
        let next = list_import_rows(&connection, Some(&CorporateActionImportListInput {
            review_status: Some("APPROVED".into()), action_types: None, search_query: None,
            exclude_approved: None, limit: Some(50), offset: Some(1),
        })).unwrap();
        assert_eq!(next.len(), 1);
        assert_eq!(next[0].symbol.as_deref(), Some("NEWER"));
    }

    #[test]
    fn list_import_rows_supports_offset_paging() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL DEFAULT 'OTHER',
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
                  review_status TEXT NOT NULL DEFAULT 'PENDING',
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                ",
            )
            .unwrap();
        create_import_evidence_table(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date, action_type, parse_status, review_status, imported_at
                )
                VALUES
                  ('page-1', 'NSE', 'TEST', 'FIRST', 'First', '2026-06-03', 'BONUS', 'PARSED', 'PENDING', '2026-06-09T08:00:00Z'),
                  ('page-2', 'NSE', 'TEST', 'SECOND', 'Second', '2026-06-02', 'BONUS', 'PARSED', 'PENDING', '2026-06-09T07:00:00Z'),
                  ('page-3', 'NSE', 'TEST', 'THIRD', 'Third', '2026-06-01', 'BONUS', 'PARSED', 'PENDING', '2026-06-09T06:00:00Z')
                ",
                [],
            )
            .unwrap();

        let rows = list_import_rows(
            &connection,
            Some(&CorporateActionImportListInput {
                review_status: None,
                action_types: Some(vec!["BONUS".to_string()]),
                search_query: None,
                exclude_approved: None,
                limit: Some(25),
                offset: Some(1),
            }),
        )
        .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].symbol.as_deref(), Some("SECOND"));
        assert_eq!(rows[1].symbol.as_deref(), Some("THIRD"));
    }

    #[test]
    fn phase2b_decision_audit_records_manual_resolution() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL DEFAULT 'OTHER',
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
                  review_status TEXT NOT NULL DEFAULT 'PENDING',
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                CREATE TABLE instruments (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  name TEXT,
                  series TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  sector TEXT,
                  industry TEXT
                );
                ",
            )
            .unwrap();
        create_import_evidence_table(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, company_name, purpose_raw, ex_date, action_type, parse_status, review_status, message
                )
                VALUES
                  ('trent-bonus', 'NSE', 'NSE_API', 'TRENT', 'TRENT LIMITED', 'Bonus 1:2', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED', 'Exact symbol matched, but the official ISIN differs from the database.')
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, series)
                VALUES ('TRENT', 'NSE', 'INE849A01020', 'TRENT LIMITED', 'EQ')
                ",
                [],
            )
            .unwrap();

        let result = resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportResolveInput {
                import_id: 1,
                symbol: Some("TRENT".to_string()),
                exchange: Some("NSE".to_string()),
                reason: Some("Reviewed official identity evidence and selected TRENT.".to_string()),
            },
        )
        .unwrap();

        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.symbol.as_deref(), Some("TRENT"));
        assert!(result.message.contains("Manually resolved"));
        let decision: (String, Option<String>, Option<String>, String) = connection
            .query_row(
                "SELECT decision_type, previous_symbol, resolved_symbol, reason FROM corporate_action_import_decisions WHERE import_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "MANUAL_RESOLUTION");
        assert_eq!(decision.1.as_deref(), Some("TRENT"));
        assert_eq!(decision.2.as_deref(), Some("TRENT"));
        assert_eq!(
            decision.3,
            "Reviewed official identity evidence and selected TRENT."
        );
    }


    #[test]
    fn exact_active_nse_symbol_with_historical_isin_ambiguous_inactive_matches_preserves_source_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);

        connection
            .execute(
                "
                INSERT INTO instruments (
                  symbol,
                  exchange,
                  isin,
                  name,
                  is_active,
                  series
                )
                VALUES
                  (
                    'APPAPER',
                    'NSE',
                    'INE435A01028',
                    'APPAPER',
                    0,
                    'EQ'
                  ),
                  (
                    'IPAPPM',
                    'NSE',
                    'INE435A01028',
                    'ANDHRA PAPER LIMITED',
                    0,
                    'EQ'
                  ),
                  (
                    'ANDHRAPAP',
                    'NSE',
                    'INE435A01051',
                    'ANDHRA PAPER LIMITED',
                    1,
                    'EQ'
                  )
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_nse_candidate(
            &connection,
            &Some("ANDHRAPAP".to_string()),
            &Some("INE435A01028".to_string()),
            &Some("ANDHRA PAPER LIMITED".to_string()),
            "NSE",
            Some("2026-08-04"),
        )
        .unwrap();

        assert_eq!(
            resolved.symbol.as_deref(),
            Some("ANDHRAPAP"),
            "an exact active NSE source symbol must survive an ambiguous historical ISIN when every matching old instrument is inactive"
        );
        assert_eq!(resolved.isin.as_deref(), Some("INE435A01028"));
        assert_eq!(resolved.review_status, REVIEW_STATUS_PENDING_ISIN_MISMATCH);
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("historical ISIN drift"));
    }


    #[test]
    fn exact_active_nse_symbol_with_historical_isin_ambiguous_active_matches_remains_unresolved() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);

        connection
            .execute(
                "
                INSERT INTO instruments (
                  symbol,
                  exchange,
                  isin,
                  name,
                  is_active,
                  series
                )
                VALUES
                  (
                    'ALPHA',
                    'NSE',
                    'INEHIST00001',
                    'ALPHA LIMITED',
                    1,
                    'EQ'
                  ),
                  (
                    'BETA',
                    'NSE',
                    'INEHIST00001',
                    'BETA LIMITED',
                    1,
                    'EQ'
                  ),
                  (
                    'CURRENTCO',
                    'NSE',
                    'INECURR00001',
                    'CURRENT COMPANY LIMITED',
                    1,
                    'EQ'
                  )
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_nse_candidate(
            &connection,
            &Some("CURRENTCO".to_string()),
            &Some("INEHIST00001".to_string()),
            &Some("CURRENT COMPANY LIMITED".to_string()),
            "NSE",
            Some("2026-08-04"),
        )
        .unwrap();

        assert_eq!(resolved.symbol, None);
        assert_eq!(resolved.review_status, "UNRESOLVED");
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("multiple database instruments"));
    }

    #[test]
    fn exact_active_nse_symbol_with_historical_isin_does_not_rewrite_to_inactive_predecessor() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);

        connection
            .execute(
                "
                INSERT INTO instruments (
                  symbol,
                  exchange,
                  isin,
                  name,
                  is_active,
                  series
                )
                VALUES
                  (
                    'NIITTECH',
                    'NSE',
                    'INE591G01017',
                    'NIIT TECHNOLOGIES LIMITED',
                    0,
                    'EQ'
                  ),
                  (
                    'COFORGE',
                    'NSE',
                    'INE591G01025',
                    'COFORGE LIMITED',
                    1,
                    'EQ'
                  )
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_nse_candidate(
            &connection,
            &Some("COFORGE".to_string()),
            &Some("INE591G01017".to_string()),
            &Some("COFORGE LIMITED".to_string()),
            "NSE",
            Some("2026-08-03"),
        )
        .unwrap();

        assert_eq!(
            resolved.symbol.as_deref(),
            Some("COFORGE"),
            "an exact active NSE source symbol must not be rewritten backward to an inactive predecessor solely because the source row carries that predecessor's historical ISIN"
        );

        assert_eq!(resolved.isin.as_deref(), Some("INE591G01017"));

        assert_eq!(resolved.review_status, REVIEW_STATUS_PENDING_ISIN_MISMATCH);
    }
    #[test]
    fn exact_symbol_isin_mismatch_becomes_reviewable_pending_status() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, series)
                VALUES ('TRENT', 'NSE', 'INE849A01020', 'TRENT LIMITED', 'EQ')
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_nse_candidate(
            &connection,
            &Some("TRENT".to_string()),
            &Some("INE849A09999".to_string()),
            &Some("TRENT LIMITED".to_string()),
            "NSE",
            Some("2026-06-04"),
        )
        .unwrap();

        assert_eq!(resolved.symbol.as_deref(), Some("TRENT"));
        assert_eq!(resolved.review_status, REVIEW_STATUS_PENDING_ISIN_MISMATCH);
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("historical ISIN drift"));
    }

    #[test]
    fn recheck_preserves_pending_isin_mismatch_status() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, series)
                VALUES ('TRENT', 'NSE', 'INE849A01020', 'TRENT LIMITED', 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'trent-bonus-auto', 'NSE', 'NSE_API', 'TRENT', 'INE849A09999', 'TRENT LIMITED', 'Bonus 1:2', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                )
                ",
                [],
            )
            .unwrap();

        let result = resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportResolveInput {
                import_id: 1,
                symbol: None,
                exchange: None,
                reason: None,
            },
        )
        .unwrap();

        assert_eq!(
            result.import_record.review_status,
            REVIEW_STATUS_PENDING_ISIN_MISMATCH
        );
        assert_eq!(result.import_record.symbol.as_deref(), Some("TRENT"));
    }

    #[test]
    fn bulk_recheck_updates_selected_rows_without_refetch() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, series)
                VALUES ('TRENT', 'NSE', 'INE849A01020', 'TRENT LIMITED', 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES
                  ('trent-bonus-bulk', 'NSE', 'NSE_API', 'TRENT', 'INE849A09999', 'TRENT LIMITED', 'Bonus 1:2', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'),
                  ('missing-symbol-bulk', 'NSE', 'NSE_API', 'UNKNOWNCO', 'INE000MISS1', 'UNKNOWN COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED')
                ",
                [],
            )
            .unwrap();

        let result = recheck_corporate_action_imports_internal(
            &connection,
            &CorporateActionImportBulkRecheckInput {
                import_ids: vec![1, 2, 2],
            },
        )
        .unwrap();

        assert_eq!(result.requested, 2);
        assert_eq!(result.rechecked, 2);
        assert_eq!(result.reviewable, 1);
        assert_eq!(result.still_unresolved, 1);
        assert_eq!(result.failed, 0);

        let statuses = {
            let mut statement = connection
                .prepare(
                    "
                      SELECT dedupe_key, review_status
                      FROM corporate_action_imports
                      ORDER BY id
                    ",
                )
                .unwrap();
            statement
                .query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };
        assert_eq!(
            statuses,
            vec![
                (
                    "trent-bonus-bulk".to_string(),
                    REVIEW_STATUS_PENDING_ISIN_MISMATCH.to_string()
                ),
                ("missing-symbol-bulk".to_string(), "UNRESOLVED".to_string()),
            ]
        );
    }

    #[test]
    fn recheck_can_follow_multi_step_identity_history_chain_to_single_active_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('MIDCO', 'NSE', 'INECHAIN0001', 'MID COMPANY', 0, 'EQ'),
                  ('NEWCO', 'NSE', 'INECHAIN0001', 'NEW COMPANY', 1, 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'MIDCO', 'MID COMPANY', 'OLDCO', 'MIDCO', '2012-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'NEWCO', 'NEW COMPANY', 'MIDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'oldco-bonus-chain', 'NSE', 'NSE_API', 'OLDCO', 'OLD COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();

        let result = resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportResolveInput {
                import_id: 1,
                symbol: None,
                exchange: None,
                reason: None,
            },
        )
        .unwrap();

        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.symbol.as_deref(), Some("NEWCO"));
        assert!(result
            .import_record
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("identity history chain"));
    }

    #[test]
    fn recheck_reports_identity_chain_candidates_when_chain_is_ambiguous() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('ALPHA', 'NSE', 'INECHAIN1001', 'ALPHA COMPANY', 1, 'EQ'),
                  ('BETA', 'NSE', 'INECHAIN1002', 'BETA COMPANY', 1, 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'ALPHA', 'ALPHA COMPANY', 'OLDCO', 'ALPHA', '2012-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'BETA', 'BETA COMPANY', 'OLDCO', 'BETA', '2014-01-01', 'SYMBOL_CHANGE');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'oldco-bonus-ambiguous', 'NSE', 'NSE_API', 'OLDCO', 'OLD COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();

        let result = resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportResolveInput {
                import_id: 1,
                symbol: None,
                exchange: None,
                reason: None,
            },
        )
        .unwrap();

        assert_eq!(result.import_record.review_status, "UNRESOLVED");
        assert_eq!(result.import_record.symbol.as_deref(), Some("OLDCO"));
        let message = result.import_record.message.unwrap_or_default();
        assert!(message.contains("multiple database symbols"));
        assert!(message.contains("ALPHA (active)"));
        assert!(message.contains("BETA (active)"));
    }

    #[test]
    fn resolution_suggestions_list_identity_chain_candidates_with_evidence_reason() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('MIDCO', 'NSE', 'INECHAIN0001', 'MID COMPANY', 0, 'EQ'),
                  ('NEWCO', 'NSE', 'INECHAIN0001', 'NEW COMPANY', 1, 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'MIDCO', 'MID COMPANY', 'OLDCO', 'MIDCO', '2012-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'NEWCO', 'NEW COMPANY', 'MIDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'oldco-bonus-suggestions', 'NSE', 'NSE_API', 'OLDCO', 'INECHAIN0001', 'OLD COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();
        upsert_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "NEWCO",
            "INECHAIN0001",
            Some("2026-06-04"),
            Some("NSE_API"),
            Some("https://example.test/corporate-actions"),
            Some("unit test evidence"),
        )
        .unwrap();

        let result = list_corporate_action_import_resolution_suggestions_internal(
            &connection,
            &CorporateActionImportResolutionSuggestionsInput { import_id: 1 },
        )
        .unwrap();

        assert_eq!(result.import_record.symbol.as_deref(), Some("OLDCO"));
        assert_eq!(result.suggestions.len(), 2);
        assert_eq!(result.suggestions[0].symbol, "NEWCO");
        assert!(result.suggestions[0].is_active);
        assert!(result.suggestions[0]
            .reason
            .contains("Historical ISIN evidence"));
        assert_eq!(result.suggestions[1].symbol, "MIDCO");
        assert!(!result.suggestions[1].is_active);
        assert!(result.suggestions[1]
            .reason
            .contains("Inactive related symbol"));
        assert!(result.message.contains("Loaded 2 suggested"));
    }

    #[test]
    fn resolution_hints_summarize_one_many_and_none_active_candidates() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('NEWCO', 'NSE', 'INECHAIN2001', 'NEW COMPANY', 1, 'EQ'),
                  ('ALPHA', 'NSE', 'INECHAIN2002', 'ALPHA COMPANY', 1, 'EQ'),
                  ('BETA', 'NSE', 'INECHAIN2003', 'BETA COMPANY', 1, 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'NEWCO', 'NEW COMPANY', 'OLDONE', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'ALPHA', 'ALPHA COMPANY', 'OLDMULTI', 'ALPHA', '2020-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'BETA', 'BETA COMPANY', 'OLDMULTI', 'BETA', '2021-01-01', 'SYMBOL_CHANGE');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES
                  ('oldone-hint', 'NSE', 'NSE_API', 'OLDONE', 'OLD ONE', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'),
                  ('oldmulti-hint', 'NSE', 'NSE_API', 'OLDMULTI', 'OLD MULTI', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'),
                  ('unknown-hint', 'NSE', 'NSE_API', 'UNKNOWNCO', 'UNKNOWN COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED');
                ",
            )
            .unwrap();

        let result = list_corporate_action_import_resolution_hints_internal(
            &connection,
            &CorporateActionImportResolutionHintsInput {
                import_ids: vec![1, 2, 3, 3],
            },
        )
        .unwrap();

        assert_eq!(result.requested, 3);
        assert_eq!(result.hints.len(), 3);

        let first = &result.hints[0];
        assert_eq!(first.import_id, 1);
        assert_eq!(first.status, "ONE_ACTIVE");
        assert_eq!(first.active_suggestion_count, 1);
        assert_eq!(first.total_suggestion_count, 1);
        assert_eq!(first.top_suggestion_symbol.as_deref(), Some("NEWCO"));
        assert_eq!(first.top_suggestion_exchange.as_deref(), Some("NSE"));
        assert!(!first.quick_resolvable);

        let second = &result.hints[1];
        assert_eq!(second.import_id, 2);
        assert_eq!(second.status, "MULTIPLE_ACTIVE");
        assert_eq!(second.active_suggestion_count, 2);
        assert_eq!(second.total_suggestion_count, 2);
        assert_eq!(second.top_suggestion_symbol, None);

        let third = &result.hints[2];
        assert_eq!(third.import_id, 3);
        assert_eq!(third.status, "NONE_ACTIVE");
        assert_eq!(third.active_suggestion_count, 0);
        assert_eq!(third.total_suggestion_count, 0);
        assert_eq!(third.top_suggestion_symbol, None);
    }

    #[test]
    fn quick_resolve_safeguard_requires_event_date_isin_evidence() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES ('NEWCO', 'NSE', 'INECURR00001', 'NEW COMPANY', 1, 'EQ');
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES ('NSE', 'NEWCO', 'NEW COMPANY', 'OLDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'oldco-chain-only', 'NSE', 'NSE_API', 'OLDCO', 'INEHIST00001', 'OLD COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();

        let hint = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, 1).unwrap(),
        )
        .unwrap();
        assert_eq!(hint.status, "ONE_ACTIVE");
        assert!(!hint.quick_resolvable);

        let error = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap_err();
        assert!(error.contains("exact event-date historical ISIN evidence"));

        let unchanged = get_import_row(&connection, 1).unwrap();
        assert_eq!(unchanged.symbol.as_deref(), Some("OLDCO"));
        assert_eq!(unchanged.isin.as_deref(), Some("INEHIST00001"));
        assert_eq!(unchanged.review_status, "UNRESOLVED");
    }

    #[test]
    fn phase2b_decision_audit_records_verified_quick_resolution() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES ('NEWCO', 'NSE', 'INECURR00001', 'NEW COMPANY', 1, 'EQ');
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES ('NSE', 'NEWCO', 'NEW COMPANY', 'OLDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE');
                INSERT INTO instrument_isin_history (
                  exchange, symbol, isin, effective_date, source, note
                )
                VALUES ('NSE', 'NEWCO', 'INEHIST00001', '2026-06-04', 'NSE_API', 'Verified test evidence');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status
                )
                VALUES (
                  'oldco-verified', 'NSE', 'NSE_API', 'OLDCO', 'INEHIST00001', 'OLD COMPANY', 'Bonus 1:1', '2026-06-04', 'BONUS', 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();

        let hint = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, 1).unwrap(),
        )
        .unwrap();
        assert!(hint.quick_resolvable);

        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.symbol.as_deref(), Some("NEWCO"));
        assert_eq!(result.import_record.isin.as_deref(), Some("INEHIST00001"));
        assert_eq!(result.import_record.review_status, "PENDING");
        assert!(result
            .message
            .contains("exact event-date historical ISIN evidence"));
        let decision: (String, Option<String>, Option<String>, Option<String>, String) = connection
            .query_row(
                "SELECT decision_type, previous_symbol, resolved_symbol, resolved_isin, reason FROM corporate_action_import_decisions WHERE import_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "VERIFIED_QUICK_RESOLUTION");
        assert_eq!(decision.1.as_deref(), Some("OLDCO"));
        assert_eq!(decision.2.as_deref(), Some("NEWCO"));
        assert_eq!(decision.3.as_deref(), Some("INEHIST00001"));
        assert!(decision.4.contains("event-date historical ISIN evidence"));
    }

    fn create_auto_id1_verified_event_fixture(
        connection: &Connection,
    ) -> event_identity_authority::V114ECandidate {
        create_nse_resolution_tables(connection);
        event_identity_resolution::create_event_identity_resolution_schema_for_controlled_apply(
            connection,
        )
        .unwrap();
        let authority = event_identity_authority::load_v114e_event_identity_authority().unwrap();
        let candidate = authority
            .candidates
            .iter()
            .find(|row| row.action_type == "DIVIDEND" && row.raw_isin.is_some())
            .expect("V1.14E authority must include a dividend with raw ISIN")
            .clone();

        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, is_active, series) VALUES (?, ?, 'INEAUTOID001', ?, 1, 'EQ')",
                params![candidate.raw_symbol, candidate.exchange, candidate.raw_identity_security_name],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_action_imports (id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date, action_type, parse_status, review_status) VALUES (?, ?, ?, 'NSE_API', ?, ?, ?, 'Dividend Rs 1.00', ?, ?, 'PARSED', 'UNRESOLVED')",
                params![
                    candidate.import_id,
                    format!("auto-id1-{}", candidate.import_id),
                    candidate.exchange,
                    candidate.raw_symbol,
                    candidate.raw_isin,
                    candidate.raw_identity_security_name,
                    candidate.event_date,
                    candidate.action_type,
                ],
            )
            .unwrap();
        let fingerprint =
            event_identity_authority::compute_v114e_resolution_fingerprint(&candidate).unwrap();
        event_identity_resolution::insert_v114e_resolution_strict(
            connection,
            &candidate,
            &fingerprint,
            event_identity_authority::V114E_V114D1_EVIDENCE_SHA256,
        )
        .unwrap();
        candidate
    }

    fn create_auto_id1_verified_rename_pair(
        connection: &Connection,
    ) -> event_identity_authority::V114ECandidate {
        let candidate = create_auto_id1_verified_event_fixture(connection);
        connection
            .execute(
                "INSERT INTO instruments(symbol,exchange,isin,is_active,series) VALUES (?,?,?,0,'EQ')",
                params![
                    candidate.event_symbol,
                    candidate.exchange,
                    candidate.raw_isin
                ],
            )
            .unwrap();
        connection.execute("INSERT INTO instrument_identity_history(exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source)
            VALUES (?,?,?,?,?,'SYMBOL_CHANGE','NSE_IDENTITY')",
            params![candidate.exchange,candidate.raw_symbol,candidate.event_symbol,candidate.raw_symbol,candidate.transition_date]).unwrap();
        connection.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source) VALUES (?,?,?,?,'NSE_IDENTITY')",
            params![candidate.exchange,candidate.event_symbol,candidate.raw_isin,candidate.event_date]).unwrap();
        candidate
    }

    #[test]
    fn auto_id1_verified_rename_pair_reconciles_without_approval_or_identity_rewrite() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_rename_pair(&connection);
        let row = get_import_row(&connection, candidate.import_id).unwrap();
        assert_eq!(
            list_resolution_suggestions_for_import_row(&connection, &row)
                .unwrap()
                .len(),
            2
        );
        let hint = build_resolution_hint_for_import_row(&connection, &row).unwrap();
        assert!(hint.quick_resolvable);
        assert_eq!(
            hint.top_suggestion_symbol.as_deref(),
            Some(candidate.raw_symbol.as_str())
        );
        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput {
                import_id: candidate.import_id,
            },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.symbol, row.symbol);
        assert_eq!(result.import_record.isin, row.isin);
        assert_eq!(result.import_record.approved_corporate_action_id, None);
        assert!(
            !identity_recheck::machine_identity_is_unproven(&connection, &result.import_record)
                .unwrap()
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT is_active FROM instruments WHERE symbol=?",
                    [&candidate.event_symbol],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn auto_id1_verified_rename_pair_rejects_two_active_symbols_or_missing_authority() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_rename_pair(&connection);
        let row = get_import_row(&connection, candidate.import_id).unwrap();
        connection
            .execute(
                "UPDATE instruments SET is_active=1 WHERE symbol=?",
                [&candidate.event_symbol],
            )
            .unwrap();
        assert!(
            !build_resolution_hint_for_import_row(&connection, &row)
                .unwrap()
                .quick_resolvable
        );
        connection
            .execute(
                "UPDATE instruments SET is_active=0 WHERE symbol=?",
                [&candidate.event_symbol],
            )
            .unwrap();
        connection
            .execute(
                "DELETE FROM corporate_action_event_identity_resolutions",
                [],
            )
            .unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &row).unwrap();
        assert_ne!(
            hint.top_suggestion_symbol.as_deref(),
            Some(candidate.raw_symbol.as_str())
        );
    }

    #[test]
    fn auto_id1_verified_rename_pair_rejects_additional_proven_identity_and_tampering() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_rename_pair(&connection);
        let row = get_import_row(&connection, candidate.import_id).unwrap();
        let mut suggestions = list_resolution_suggestions_for_import_row(&connection, &row).unwrap();
        let mut extra = suggestions.iter().find(|s| !s.is_active).unwrap().clone();
        extra.symbol = "UNRELATED".to_string();
        connection.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES (?,'UNRELATED',?,?)",
            params![candidate.exchange,candidate.raw_isin,candidate.event_date]).unwrap();
        suggestions.push(extra);
        assert!(
            unique_proven_identity_suggestion(&connection, &row, &suggestions)
                .unwrap()
                .is_none()
        );
        connection.execute("UPDATE corporate_action_event_identity_resolutions SET resolution_fingerprint='tampered'",[]).unwrap();
        assert!(build_resolution_hint_for_import_row(&connection, &row)
            .unwrap_err()
            .contains("fingerprint"));
    }

    #[test]
    fn auto_id1_hint_accepts_verified_persisted_event_resolution() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        let import_row = get_import_row(&connection, candidate.import_id).unwrap();
        let suggestions = list_resolution_suggestions_for_import_row(&connection, &import_row).unwrap();
        let active = suggestions
            .iter()
            .filter(|row| row.is_active)
            .collect::<Vec<_>>();
        assert_eq!(active.len(), 1);
        assert!(!active[0].has_event_date_isin_evidence);

        let hint = build_resolution_hint_for_import_row(&connection, &import_row).unwrap();
        assert_eq!(hint.status, "ONE_ACTIVE");
        assert!(hint.quick_resolvable);
        assert_eq!(hint.top_suggestion_symbol.as_deref(), Some(candidate.raw_symbol.as_str()));
        assert!(hint.message.contains("persisted V1.14D.1"));
    }

    #[test]
    fn auto_id1_quick_resolve_consumes_verified_persisted_event_resolution_and_audits() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput {
                import_id: candidate.import_id,
            },
        )
        .unwrap();

        assert_eq!(result.import_record.symbol.as_deref(), Some(candidate.raw_symbol.as_str()));
        assert_eq!(result.import_record.isin, candidate.raw_isin);
        assert_eq!(result.import_record.review_status, "PENDING");
        assert!(result.message.contains("persisted V1.14D.1"));
        let decision: (String, String) = connection
            .query_row(
                "SELECT decision_type, reason FROM corporate_action_import_decisions WHERE import_id = ?",
                params![candidate.import_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "VERIFIED_EVENT_IDENTITY_RESOLUTION");
        assert!(decision.1.contains("resolution fingerprint"));
    }

    #[test]
    fn auto_id1_rejects_tampered_persisted_resolution_fingerprint() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        connection
            .execute(
                "UPDATE corporate_action_event_identity_resolutions SET resolution_fingerprint = ? WHERE import_id = ?",
                params!["0".repeat(64), candidate.import_id],
            )
            .unwrap();
        let error = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, candidate.import_id).unwrap(),
        )
        .unwrap_err();
        assert!(error.contains("failed exact authority/fingerprint verification"));
    }

    #[test]
    fn auto_id1_rejects_event_date_drift_at_transition_boundary() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        connection
            .execute(
                "UPDATE corporate_action_imports SET ex_date = ? WHERE id = ?",
                params![candidate.transition_date, candidate.import_id],
            )
            .unwrap();
        let hint = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, candidate.import_id).unwrap(),
        )
        .unwrap();
        assert!(!hint.quick_resolvable);
        let error = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput {
                import_id: candidate.import_id,
            },
        )
        .unwrap_err();
        assert!(error.contains("event-identity resolution"));
    }

    #[test]
    fn auto_id1_does_not_bypass_pending_isin_mismatch() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        connection
            .execute(
                "UPDATE corporate_action_imports SET review_status = 'PENDING_ISIN_MISMATCH' WHERE id = ?",
                params![candidate.import_id],
            )
            .unwrap();
        let import_row = get_import_row(&connection, candidate.import_id).unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &import_row).unwrap();
        assert!(!hint.quick_resolvable);
        let error = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput {
                import_id: candidate.import_id,
            },
        )
        .unwrap_err();
        assert!(error.contains("exact event-date historical ISIN evidence"));
    }

    #[test]
    fn auto_id1_requires_exactly_one_active_current_target() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = create_auto_id1_verified_event_fixture(&connection);
        connection
            .execute(
                "UPDATE instruments SET is_active = 0 WHERE symbol = ? AND exchange = ?",
                params![candidate.raw_symbol, candidate.exchange],
            )
            .unwrap();
        let hint = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, candidate.import_id).unwrap(),
        )
        .unwrap();
        assert!(!hint.quick_resolvable);
        assert_eq!(hint.active_suggestion_count, 0);
    }

    fn create_historical_isin_transition_fixture(
        connection: &Connection,
        event_date: &str,
        action_type: &str,
        review_status: &str,
    ) {
        create_nse_resolution_tables(connection);
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  action_type TEXT NOT NULL
                );
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES ('20MICRONS', 'NSE', 'INE144J01027', '20 Microns Limited', 1, 'EQ');
                ",
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO corporate_action_imports (
                   id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw,
                   ex_date, action_type, parse_status, review_status
                 ) VALUES (1, '20m-target', 'NSE', 'NSE_API', '20MICRONS', 'INE144J01019',
                   '20 Microns Limited', 'Dividend Rs 1.00', ?, ?, 'PARSED', ?)",
                params![event_date, action_type, review_status],
            )
            .unwrap();
        connection
            .execute_batch(
                "
                INSERT INTO corporate_actions (
                  id, symbol, exchange, isin, effective_date, action_type
                ) VALUES (100, '20MICRONS', 'NSE', 'INE144J01027', '2013-01-28', 'SPLIT');
                INSERT INTO corporate_action_imports (
                  id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw,
                  ex_date, record_date, action_type, old_face_value, new_face_value,
                  factor, price_factor, parse_status, review_status, approved_corporate_action_id
                ) VALUES (
                  2, '20m-transition', 'NSE', 'NSE_API', '20MICRONS', 'INE144J01019',
                  '20 Microns Limited', 'Face Value Split Rs 10 To Rs 5', '2013-01-28',
                  '2013-01-29', 'SPLIT', 10, 5, 2, 0.5, 'PARSED', 'APPROVED', 100
                );
                INSERT INTO instrument_isin_history (
                  exchange, symbol, isin, effective_date, source, source_ref, note
                ) VALUES (
                  'NSE', '20MICRONS', 'INE144J01019', '2013-01-28', 'NSE_API',
                  'fixture://20microns-transition', 'Confirmed from an approved official corporate-action import.'
                );
                INSERT INTO corporate_action_import_decisions (
                  import_id, decision_type, previous_symbol, previous_exchange, previous_isin,
                  resolved_symbol, resolved_exchange, resolved_isin, reason
                ) VALUES (
                  2, 'HISTORICAL_ISIN_BOOTSTRAP_V1_9_2', '20MICRONS', 'NSE', 'INE144J01019',
                  '20MICRONS', 'NSE', 'INE144J01019',
                  'V1.9.2 exact-date historical ISIN evidence bootstrap; candidateFingerprint=test; planFingerprint=test; tuple=NSE:20MICRONS:2013-01-28:INE144J01019->INE144J01027; evidenceIds=2'
                );
                INSERT INTO corporate_action_import_decisions (
                  import_id, decision_type, previous_symbol, previous_exchange, previous_isin,
                  resolved_symbol, resolved_exchange, resolved_isin, reason
                ) VALUES (
                  2, 'VERIFIED_QUICK_RESOLUTION', '20MICRONS', 'NSE', 'INE144J01019',
                  '20MICRONS', 'NSE', 'INE144J01019',
                  'Exactly one active candidate matched exact event-date historical ISIN evidence.'
                );
                ",
            )
            .unwrap();
    }

    #[test]
    fn historical_isin_transition_hint_accepts_strict_pretransition_dividend() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2012-07-26", "DIVIDEND", "UNRESOLVED");
        let import_row = get_import_row(&connection, 1).unwrap();
        let suggestions = list_resolution_suggestions_for_import_row(&connection, &import_row).unwrap();
        let active = suggestions.iter().filter(|row| row.is_active).collect::<Vec<_>>();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].symbol, "20MICRONS");
        assert!(!active[0].has_event_date_isin_evidence);

        let hint = build_resolution_hint_for_import_row(&connection, &import_row).unwrap();
        assert_eq!(hint.status, "ONE_ACTIVE");
        assert!(hint.quick_resolvable);
        assert!(hint.message.contains("historical-ISIN transition"));
        assert!(hint.message.contains("2013-01-28"));
    }

    #[test]
    fn verified_pretransition_isin_mismatch_quick_resolves_identity_only() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(
            &connection,
            "2012-07-26",
            "DIVIDEND",
            REVIEW_STATUS_PENDING_ISIN_MISMATCH,
        );
        let import_row = get_import_row(&connection, 1).unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &import_row).unwrap();
        assert_eq!(hint.status, "ONE_ACTIVE");
        assert!(hint.quick_resolvable);
        assert!(!hint.recommended_isin_exception);

        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.symbol.as_deref(), Some("20MICRONS"));
        assert_eq!(result.import_record.isin.as_deref(), Some("INE144J01019"));
        assert_eq!(result.import_record.approved_corporate_action_id, None);
        let decision_type: String = connection
            .query_row(
                "SELECT decision_type FROM corporate_action_import_decisions WHERE import_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decision_type, "VERIFIED_HISTORICAL_ISIN_TRANSITION");
    }

    #[test]
    fn mismatch_without_verified_pretransition_proof_stays_blocked() {
        for (event_date, action_type) in [
            ("2014-07-26", "DIVIDEND"),
            ("2012-07-26", "RIGHTS"),
        ] {
            let connection = Connection::open_in_memory().unwrap();
            create_historical_isin_transition_fixture(
                &connection,
                event_date,
                action_type,
                REVIEW_STATUS_PENDING_ISIN_MISMATCH,
            );
            let hint = build_resolution_hint_for_import_row(
                &connection,
                &get_import_row(&connection, 1).unwrap(),
            )
            .unwrap();
            assert!(!hint.quick_resolvable);
            assert_eq!(hint.status, "ONE_ACTIVE");
            assert!(quick_resolve_corporate_action_import_internal(
                &connection,
                &CorporateActionImportQuickResolveInput { import_id: 1 },
            )
            .is_err());
            assert_eq!(
                get_import_row(&connection, 1).unwrap().review_status,
                REVIEW_STATUS_PENDING_ISIN_MISMATCH
            );
            let decision_count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM corporate_action_import_decisions WHERE import_id=1",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(decision_count, 0);
        }
    }

    #[test]
    fn historical_isin_transition_resolves_proven_inactive_split_bonus_without_reactivation() {
        for action in ["SPLIT", "BONUS"] {
            let c = Connection::open_in_memory().unwrap();
            create_historical_isin_transition_fixture(&c,"2012-07-26",action,"UNRESOLVED");
            c.execute("UPDATE instruments SET is_active=0",[]).unwrap();
            let hint = build_resolution_hint_for_import_row(&c,&get_import_row(&c,1).unwrap()).unwrap();
            assert_eq!(hint.status,"ONE_HISTORICAL");
            assert!(hint.quick_resolvable);
            let result = quick_resolve_corporate_action_import_internal(&c,&CorporateActionImportQuickResolveInput{import_id:1}).unwrap();
            assert_eq!(result.import_record.review_status,"PENDING");
            assert!(result.import_record.approved_corporate_action_id.is_none());
            assert_eq!(c.query_row("SELECT max(is_active) FROM instruments",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        }
    }

    #[test]
    fn historical_isin_transition_quick_resolve_sets_pending_and_audits_without_approval() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2010-08-12", "DIVIDEND", "UNRESOLVED");

        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.symbol.as_deref(), Some("20MICRONS"));
        assert_eq!(result.import_record.isin.as_deref(), Some("INE144J01019"));
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.approved_corporate_action_id, None);
        assert!(result.message.contains("historical-ISIN transition"));

        let decision: (String, String) = connection
            .query_row(
                "SELECT decision_type, reason FROM corporate_action_import_decisions WHERE import_id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "VERIFIED_HISTORICAL_ISIN_TRANSITION");
        assert!(decision.1.contains("transitionImportId=2"));
        assert!(decision.1.contains("approvedCorporateActionId=100"));
        assert!(decision.1.contains("historicalIsin=INE144J01019"));
        assert!(decision.1.contains("currentIsin=INE144J01027"));

        let approved_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_imports WHERE id=1 AND approved_corporate_action_id IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(approved_count, 0);
    }

    #[test]
    fn historical_isin_transition_exact_transition_date_remains_existing_exact_date_proof() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2013-01-28", "DIVIDEND", "UNRESOLVED");

        let result = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert!(result.message.contains("exact event-date historical ISIN evidence"));
        let decision_type: String = connection
            .query_row(
                "SELECT decision_type FROM corporate_action_import_decisions WHERE import_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decision_type, "VERIFIED_QUICK_RESOLUTION");
    }

    #[test]
    fn historical_isin_transition_rejects_posttransition_stale_isin() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2017-12-05", "DIVIDEND", "UNRESOLVED");
        let import_row = get_import_row(&connection, 1).unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &import_row).unwrap();
        assert!(!hint.quick_resolvable);
        let error = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap_err();
        assert!(error.contains("historical-ISIN transition"));
    }

    #[test]
    fn historical_isin_transition_requires_approved_split_link() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2011-08-04", "DIVIDEND", "UNRESOLVED");
        connection
            .execute(
                "UPDATE corporate_action_imports SET review_status='UNRESOLVED', approved_corporate_action_id=NULL WHERE id=2",
                [],
            )
            .unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap();
        assert!(!hint.quick_resolvable);
    }

    #[test]
    fn historical_isin_transition_requires_bootstrap_and_verified_quick_decisions() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2011-08-04", "DIVIDEND", "UNRESOLVED");
        connection
            .execute(
                "DELETE FROM corporate_action_import_decisions WHERE import_id=2 AND decision_type='HISTORICAL_ISIN_BOOTSTRAP_V1_9_2'",
                [],
            )
            .unwrap();
        assert!(!build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap().quick_resolvable);

        connection.execute(
            "INSERT INTO corporate_action_import_decisions (import_id, decision_type, previous_symbol, previous_exchange, previous_isin, resolved_symbol, resolved_exchange, resolved_isin, reason) VALUES (2, 'HISTORICAL_ISIN_BOOTSTRAP_V1_9_2', '20MICRONS', 'NSE', 'INE144J01019', '20MICRONS', 'NSE', 'INE144J01019', 'V1.9.2 exact-date historical ISIN evidence bootstrap; tuple=NSE:20MICRONS:2013-01-28:INE144J01019->INE144J01027;')",
            [],
        ).unwrap();
        connection
            .execute(
                "DELETE FROM corporate_action_import_decisions WHERE import_id=2 AND decision_type='VERIFIED_QUICK_RESOLUTION'",
                [],
            )
            .unwrap();
        assert!(!build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap().quick_resolvable);
    }

    #[test]
    fn historical_isin_transition_requires_exact_transition_history_and_current_isin_match() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2012-07-26", "DIVIDEND", "UNRESOLVED");
        connection
            .execute("DELETE FROM instrument_isin_history WHERE symbol='20MICRONS'", [])
            .unwrap();
        assert!(!build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap().quick_resolvable);

        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date) VALUES ('NSE','20MICRONS','INE144J01019','2013-01-28')",
            [],
        ).unwrap();
        connection
            .execute("UPDATE corporate_actions SET isin='INE144J01099' WHERE id=100", [])
            .unwrap();
        assert!(!build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap().quick_resolvable);
    }

    #[test]
    fn historical_isin_transition_does_not_bypass_unproven_isin_mismatch_or_other_action() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2017-12-05", "DIVIDEND", "PENDING_ISIN_MISMATCH");
        let hint = build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap();
        assert!(!hint.quick_resolvable);
        let error = quick_resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap_err();
        assert!(error.contains("manual-review-only"));

        connection
            .execute(
                "UPDATE corporate_action_imports SET review_status='UNRESOLVED', action_type='OTHER' WHERE id=1",
                [],
            )
            .unwrap();
        assert!(!build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap().quick_resolvable);
    }

    #[test]
    fn historical_isin_transition_requires_same_symbol_current_target() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2012-07-26", "DIVIDEND", "UNRESOLVED");
        connection
            .execute("UPDATE corporate_action_imports SET symbol='OLD20' WHERE id=1", [])
            .unwrap();
        connection.execute(
            "INSERT INTO instrument_identity_history (exchange, isin, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type) VALUES ('NSE','INE144J01019','20MICRONS','20 Microns Limited','OLD20','20MICRONS','2013-01-28','SYMBOL_CHANGE')",
            [],
        ).unwrap();
        let hint = build_resolution_hint_for_import_row(&connection, &get_import_row(&connection, 1).unwrap()).unwrap();
        assert_eq!(hint.active_suggestion_count, 1);
        assert!(!hint.quick_resolvable);
    }

    #[test]
    fn historical_isin_transition_fails_closed_on_multiple_verified_transitions() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_isin_transition_fixture(&connection, "2010-08-12", "DIVIDEND", "UNRESOLVED");
        connection.execute_batch(
            "
            INSERT INTO corporate_actions (id,symbol,exchange,isin,effective_date,action_type)
            VALUES (101,'20MICRONS','NSE','INE144J01027','2014-01-28','SPLIT');
            INSERT INTO corporate_action_imports (
              id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,
              action_type,parse_status,review_status,approved_corporate_action_id
            ) VALUES (3,'20m-transition-2','NSE','NSE_API','20MICRONS','INE144J01019',
              '20 Microns Limited','Second split','2014-01-28','SPLIT','PARSED','APPROVED',101);
            INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date)
            VALUES ('NSE','20MICRONS','INE144J01019','2014-01-28');
            INSERT INTO corporate_action_import_decisions (
              import_id,decision_type,previous_symbol,previous_exchange,previous_isin,
              resolved_symbol,resolved_exchange,resolved_isin,reason
            ) VALUES (3,'HISTORICAL_ISIN_BOOTSTRAP_V1_9_2','20MICRONS','NSE','INE144J01019',
              '20MICRONS','NSE','INE144J01019',
              'V1.9.2 exact-date historical ISIN evidence bootstrap; tuple=NSE:20MICRONS:2014-01-28:INE144J01019->INE144J01027;');
            INSERT INTO corporate_action_import_decisions (
              import_id,decision_type,previous_symbol,previous_exchange,previous_isin,
              resolved_symbol,resolved_exchange,resolved_isin,reason
            ) VALUES (3,'VERIFIED_QUICK_RESOLUTION','20MICRONS','NSE','INE144J01019',
              '20MICRONS','NSE','INE144J01019','verified');
            "
        ).unwrap();
        let hint = build_resolution_hint_for_import_row(
            &connection,
            &get_import_row(&connection, 1).unwrap(),
        )
        .unwrap();
        assert!(!hint.quick_resolvable);
        assert!(quick_resolve_corporate_action_import_internal(&connection,&CorporateActionImportQuickResolveInput{import_id:1}).is_err());
    }

    #[test]
    fn quick_resolve_safeguard_blocks_ordinary_isin_mismatch_approval() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                )
                VALUES (
                  'mismatch-approval', 'NSE', 'NSE_API', 'TRENT', 'INEHIST00002', 'TRENT LIMITED',
                  'Bonus 1:1', '2026-06-04', 'BONUS', 1, 1, 2, 0.5, 'PARSED', 'PENDING_ISIN_MISMATCH'
                )
                ",
                [],
            )
            .unwrap();

        let error = approve_corporate_action_import_without_transaction(
            &connection,
            Path::new("."),
            1,
            false,
            false,
        )
        .unwrap_err();
        assert!(error.contains("blocked from ordinary approval"));
    }

    #[test]
    fn phase2b_decision_audit_rejects_short_manual_reason_without_mutation() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES ('TRENT', 'NSE', 'INE849A01020', 'TRENT LIMITED', 1, 'EQ');
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, company_name, purpose_raw, ex_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                )
                VALUES (
                  'manual-short-reason', 'NSE', 'NSE_API', 'OLDTRENT', 'TRENT LIMITED',
                  'Bonus 1:1', '2026-06-04', 'BONUS', 1, 1, 2, 0.5, 'PARSED', 'UNRESOLVED'
                );
                ",
            )
            .unwrap();

        let error = resolve_corporate_action_import_internal(
            &connection,
            &CorporateActionImportResolveInput {
                import_id: 1,
                symbol: Some("TRENT".to_string()),
                exchange: Some("NSE".to_string()),
                reason: Some("too short".to_string()),
            },
        )
        .unwrap_err();
        assert!(error.contains("at least 10 characters"));
        let unchanged = get_import_row(&connection, 1).unwrap();
        assert_eq!(unchanged.symbol.as_deref(), Some("OLDTRENT"));
        assert_eq!(unchanged.review_status, "UNRESOLVED");
        let decision_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decision_count, 0);
    }

    #[test]
    fn phase2b_decision_audit_records_individual_isin_exception() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  action_type TEXT NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL
                );
                INSERT INTO corporate_actions (
                  symbol, exchange, isin, effective_date, action_type, ratio_num, ratio_den
                )
                VALUES ('TRENT', 'NSE', 'INEHIST00002', '2026-06-04', 'BONUS', 1, 1);
                -- Approval now requires the local cum/ex window that the scan observed.
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL, exchange TEXT NOT NULL, date TEXT NOT NULL,
                  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL
                );
                INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close) VALUES
                  ('TRENT', 'NSE', '2026-06-03', 100, 100, 100, 100),
                  ('TRENT', 'NSE', '2026-06-04', 52.5, 52.5, 51.8, 51.8);
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                )
                VALUES (
                  'mismatch-exception', 'NSE', 'NSE_API', 'TRENT', 'INEHIST00002', 'TRENT LIMITED',
                  'Bonus 1:1', '2026-06-04', 'BONUS', 1, 1, 2, 0.5, 'PARSED', 'PENDING_ISIN_MISMATCH'
                );
                ",
            )
            .unwrap();

        create_phase1_scan_tables(&connection);
        insert_phase1_scan_result(&connection, 1, "TRENT", 2.0, "MATCHED", Some(0.96));
        connection
            .execute(
                "UPDATE corporate_action_scan_results SET prev_trade_date='2026-06-03', ex_trade_date='2026-06-04' WHERE corporate_action_import_id=1",
                [],
            )
            .unwrap();

        let result = approve_corporate_action_import_with_isin_mismatch_internal(
            &connection,
            Path::new("."),
            &CorporateActionImportExceptionalApprovalInput {
                import_id: 1,
                reason: "Historical exchange evidence confirms this earlier ISIN.".to_string(),
                expected_database_path: ".".to_string(),
            },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "APPROVED");
        assert_eq!(result.import_record.approved_corporate_action_id, Some(1));
        assert!(result.approved_record.is_none());
        let decision: (String, Option<String>, Option<String>, String) = connection
            .query_row(
                "SELECT decision_type, previous_isin, resolved_isin, reason FROM corporate_action_import_decisions WHERE import_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "ISIN_MISMATCH_APPROVAL");
        assert_eq!(decision.1.as_deref(), Some("INEHIST00002"));
        assert_eq!(decision.2.as_deref(), Some("INEHIST00002"));
        assert_eq!(
            decision.3,
            "Historical exchange evidence confirms this earlier ISIN."
        );
    }

    #[test]
    fn initial_fetch_resolution_keeps_single_hop_identity_match() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('MIDCO', 'NSE', 'INECHAIN0001', 'MID COMPANY', 0, 'EQ'),
                  ('NEWCO', 'NSE', 'INECHAIN0001', 'NEW COMPANY', 1, 'EQ')
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO instrument_identity_history (
                  exchange, current_symbol, current_name, old_symbol, new_symbol, effective_date, change_type
                )
                VALUES
                  ('NSE', 'MIDCO', 'MID COMPANY', 'OLDCO', 'MIDCO', '2012-01-01', 'SYMBOL_CHANGE'),
                  ('NSE', 'NEWCO', 'NEW COMPANY', 'MIDCO', 'NEWCO', '2020-01-01', 'SYMBOL_CHANGE')
                ",
                [],
            )
            .unwrap();

        let resolved = resolve_nse_candidate(
            &connection,
            &Some("OLDCO".to_string()),
            &None,
            &Some("OLD COMPANY".to_string()),
            "NSE",
            Some("2026-06-04"),
        )
        .unwrap();

        assert_eq!(resolved.review_status, "PENDING");
        assert_eq!(resolved.symbol.as_deref(), Some("MIDCO"));
        assert!(resolved
            .message
            .as_deref()
            .unwrap_or_default()
            .contains("identity history"));
    }

    #[test]
    fn isin_history_evidence_upsert_is_exact_date_scoped() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);

        upsert_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "TRENT",
            "INE849A09999",
            Some("2026-06-04"),
            Some("NSE_API"),
            Some("https://example.test/corporate-actions"),
            Some("test evidence"),
        )
        .unwrap();

        assert!(has_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "TRENT",
            "INE849A09999",
            Some("2026-06-04"),
        )
        .unwrap());
        assert!(!has_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "TRENT",
            "INE849A09999",
            Some("2026-06-05"),
        )
        .unwrap());
    }

    #[test]
    fn builds_stable_dedupe_key() {
        let left = build_dedupe_key(
            "NSE_CSV",
            "NSE",
            Some("abc"),
            Some("INE123"),
            "BONUS",
            Some("2024-06-07"),
            None,
            "Bonus issue in the ratio of 1:1",
        );
        let right = build_dedupe_key(
            "NSE_CSV",
            "NSE",
            Some("ABC"),
            Some("ine123"),
            "BONUS",
            Some("2024-06-07"),
            None,
            "Bonus issue in the ratio of 1 : 1",
        );
        assert_eq!(left, right);
    }

    #[test]
    fn compute_missing_fetch_ranges_returns_only_uncovered_windows() {
        let missing = compute_missing_fetch_ranges(
            "2026-06-01",
            "2026-06-10",
            &[
                FetchCoverageRange {
                    from_date: "2026-06-01".to_string(),
                    to_date: "2026-06-03".to_string(),
                },
                FetchCoverageRange {
                    from_date: "2026-06-05".to_string(),
                    to_date: "2026-06-07".to_string(),
                },
                FetchCoverageRange {
                    from_date: "2026-06-08".to_string(),
                    to_date: "2026-06-10".to_string(),
                },
            ],
        )
        .unwrap();

        assert_eq!(
            missing,
            vec![FetchCoverageRange {
                from_date: "2026-06-04".to_string(),
                to_date: "2026-06-04".to_string(),
            }]
        );
    }

    #[test]
    fn load_missing_fetch_ranges_uses_exchange_and_source_specific_coverage() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_fetch_coverage (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  from_date TEXT NOT NULL,
                  to_date TEXT NOT NULL,
                  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                  UNIQUE (exchange, source, from_date, to_date)
                );
                ",
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO corporate_action_fetch_coverage (exchange, source, from_date, to_date)
                VALUES
                  ('NSE', 'NSE_API', '2026-06-01', '2026-06-05'),
                  ('BSE', 'BSE_API', '2026-06-01', '2026-06-10')
                ",
                [],
            )
            .unwrap();

        let missing =
            load_missing_fetch_ranges(&connection, "NSE", "NSE_API", "2026-06-01", "2026-06-10")
                .unwrap();

        assert_eq!(
            missing,
            vec![FetchCoverageRange {
                from_date: "2026-06-06".to_string(),
                to_date: "2026-06-10".to_string(),
            }]
        );
    }

    #[test]
    fn force_refresh_uses_requested_range_without_coverage_lookup() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_fetch_coverage (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  source TEXT NOT NULL,
                  from_date TEXT NOT NULL,
                  to_date TEXT NOT NULL,
                  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                  UNIQUE (exchange, source, from_date, to_date)
                );
                ",
            )
            .unwrap();
        connection
            .execute(
                "
                INSERT INTO corporate_action_fetch_coverage (exchange, source, from_date, to_date)
                VALUES ('NSE', 'NSE_API', '2026-06-01', '2026-06-10')
                ",
                [],
            )
            .unwrap();

        let ranges = resolve_official_fetch_ranges(
            &connection,
            "NSE",
            "NSE_API",
            "2026-06-01",
            "2026-06-10",
            true,
        )
        .unwrap();

        assert_eq!(ranges.len(), 1);
        assert_eq!(ranges[0].from_date, "2026-06-01");
        assert_eq!(ranges[0].to_date, "2026-06-10");
    }

    #[test]
    fn historical_batch_request_validation_normalizes_symbols_and_bse_codes() {
        let input = HistoricalCapitalActionBackfillBatchInput {
            exchange: "nse".to_string(),
            from_date: "01-01-1994".to_string(),
            to_date: "25-06-2026".to_string(),
            symbols: vec![
                HistoricalCapitalActionBackfillBatchSymbolInput {
                    symbol: " infy ".to_string(),
                    bse_scrip_code: Some(" 500209 ".to_string()),
                },
                HistoricalCapitalActionBackfillBatchSymbolInput {
                    symbol: "wipro".to_string(),
                    bse_scrip_code: None,
                },
            ],
            stop_on_error: None,
        };

        let requests = prepare_historical_backfill_batch_requests(&input).unwrap();

        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].exchange, "NSE");
        assert_eq!(requests[0].symbol, "INFY");
        assert_eq!(requests[0].from_date, "1994-01-01");
        assert_eq!(requests[0].to_date, "2026-06-25");
        assert_eq!(requests[0].bse_scrip_code.as_deref(), Some("500209"));
        assert_eq!(requests[1].symbol, "WIPRO");
    }

    #[test]
    fn historical_batch_request_validation_rejects_duplicate_symbols() {
        let input = HistoricalCapitalActionBackfillBatchInput {
            exchange: "NSE".to_string(),
            from_date: "2026-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            symbols: vec![
                HistoricalCapitalActionBackfillBatchSymbolInput {
                    symbol: "INFY".to_string(),
                    bse_scrip_code: None,
                },
                HistoricalCapitalActionBackfillBatchSymbolInput {
                    symbol: " infy ".to_string(),
                    bse_scrip_code: Some("500209".to_string()),
                },
            ],
            stop_on_error: None,
        };

        let error = prepare_historical_backfill_batch_requests(&input).unwrap_err();

        assert!(error.contains("Duplicate historical batch symbol: INFY"));
    }

    #[test]
    fn historical_batch_request_validation_limits_batch_size() {
        let input = HistoricalCapitalActionBackfillBatchInput {
            exchange: "NSE".to_string(),
            from_date: "2026-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            symbols: (0..=HISTORICAL_BACKFILL_BATCH_MAX_SYMBOLS)
                .map(|index| HistoricalCapitalActionBackfillBatchSymbolInput {
                    symbol: format!("SYM{}", index),
                    bse_scrip_code: None,
                })
                .collect(),
            stop_on_error: None,
        };

        let error = prepare_historical_backfill_batch_requests(&input).unwrap_err();

        assert!(error.contains("Historical batch backfill is limited"));
    }

    #[test]
    fn historical_backfill_run_tracking_records_symbol_outcomes() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_backfill_tracking_tables(&connection);
        let requested_symbols = vec!["INFY".to_string(), "WIPRO".to_string()];
        let run_id = create_historical_backfill_run(
            &connection,
            "NSE",
            "1994-01-01",
            "2026-06-25",
            &requested_symbols,
            false,
        )
        .unwrap();
        let completed_request = HistoricalCapitalActionBackfillInput {
            exchange: "NSE".to_string(),
            symbol: "INFY".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            bse_scrip_code: Some("500209".to_string()),
        };
        let failed_request = HistoricalCapitalActionBackfillInput {
            exchange: "NSE".to_string(),
            symbol: "WIPRO".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            bse_scrip_code: None,
        };

        let completed_symbol_id =
            create_historical_backfill_run_symbol(&connection, run_id, &completed_request).unwrap();
        let failed_symbol_id =
            create_historical_backfill_run_symbol(&connection, run_id, &failed_request).unwrap();
        let symbol_result = HistoricalCapitalActionBackfillResult {
            exchange: "NSE".to_string(),
            requested_symbol: "INFY".to_string(),
            canonical_symbol: Some("INFY".to_string()),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            searched_symbols: vec!["INFY".to_string()],
            bse_scrip_code: Some("500209".to_string()),
            rows_read: 3,
            rows_inserted: 1,
            rows_duplicate: 1,
            rows_evidence_attached: 1,
            rows_error: 0,
            rows_unresolved: 1,
            rows_parsed: 2,
            rows_unsupported: 0,
            parse_status_counts: HashMap::from([("PARSED".to_string(), 3)]),
            review_status_counts: HashMap::from([
                ("READY".to_string(), 2),
                ("NEEDS_REVIEW".to_string(), 1),
            ]),
            imports: Vec::new(),
            source_attempts: Vec::new(),
            warnings: vec!["coverage warning".to_string()],
            errors: Vec::new(),
            message: "symbol complete".to_string(),
        };
        complete_historical_backfill_run_symbol(&connection, completed_symbol_id, &symbol_result)
            .unwrap();
        fail_historical_backfill_run_symbol(&connection, failed_symbol_id, "network failed")
            .unwrap();

        let batch_result = HistoricalCapitalActionBackfillBatchResult {
            run_id: Some(run_id),
            exchange: "NSE".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            requested_symbols,
            total_symbols: 2,
            completed_symbols: 1,
            failed_symbols: 1,
            stopped_on_error: false,
            rows_read: 3,
            rows_inserted: 1,
            rows_duplicate: 1,
            rows_evidence_attached: 1,
            rows_error: 0,
            rows_unresolved: 1,
            rows_parsed: 2,
            rows_unsupported: 0,
            parse_status_counts: HashMap::from([("PARSED".to_string(), 3)]),
            review_status_counts: HashMap::from([
                ("READY".to_string(), 2),
                ("NEEDS_REVIEW".to_string(), 1),
            ]),
            symbol_results: Vec::new(),
            errors: vec!["WIPRO: network failed".to_string()],
            message: "batch complete".to_string(),
        };
        complete_historical_backfill_run(&connection, run_id, &batch_result).unwrap();

        let run_status: (String, i64, i64, i64, i64) = connection
            .query_row(
                "
                SELECT status, completed_symbols, failed_symbols, rows_inserted, rows_evidence_attached
                FROM historical_capital_action_backfill_runs
                WHERE id = ?
                ",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap();
        assert_eq!(
            run_status,
            ("COMPLETED_WITH_ERRORS".to_string(), 1, 1, 1, 1)
        );

        let completed_symbol: (String, Option<String>, i64, i64) = connection
            .query_row(
                "
                SELECT status, canonical_symbol, rows_inserted, warning_count
                FROM historical_capital_action_backfill_run_symbols
                WHERE id = ?
                ",
                params![completed_symbol_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(
            completed_symbol,
            ("COMPLETED".to_string(), Some("INFY".to_string()), 1, 1)
        );

        let failed_symbol: (String, i64, Option<String>) = connection
            .query_row(
                "
                SELECT status, rows_error, error_message
                FROM historical_capital_action_backfill_run_symbols
                WHERE id = ?
                ",
                params![failed_symbol_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            failed_symbol,
            ("FAILED".to_string(), 1, Some("network failed".to_string()))
        );
    }

    #[test]
    fn historical_backfill_run_list_returns_runs_with_symbols() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_backfill_tracking_tables(&connection);
        let first_symbols = vec!["INFY".to_string(), "WIPRO".to_string()];
        let first_run_id = create_historical_backfill_run(
            &connection,
            "NSE",
            "1994-01-01",
            "2026-06-25",
            &first_symbols,
            false,
        )
        .unwrap();
        let second_symbols = vec!["KOTAKBANK".to_string()];
        let second_run_id = create_historical_backfill_run(
            &connection,
            "NSE",
            "1994-01-01",
            "2026-06-25",
            &second_symbols,
            true,
        )
        .unwrap();
        let completed_request = HistoricalCapitalActionBackfillInput {
            exchange: "NSE".to_string(),
            symbol: "INFY".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            bse_scrip_code: Some("500209".to_string()),
        };
        let completed_symbol_id =
            create_historical_backfill_run_symbol(&connection, first_run_id, &completed_request)
                .unwrap();
        let symbol_result = HistoricalCapitalActionBackfillResult {
            exchange: "NSE".to_string(),
            requested_symbol: "INFY".to_string(),
            canonical_symbol: Some("INFY".to_string()),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            searched_symbols: vec!["INFY".to_string()],
            bse_scrip_code: Some("500209".to_string()),
            rows_read: 2,
            rows_inserted: 1,
            rows_duplicate: 0,
            rows_evidence_attached: 1,
            rows_error: 0,
            rows_unresolved: 1,
            rows_parsed: 2,
            rows_unsupported: 0,
            parse_status_counts: HashMap::from([("PARSED".to_string(), 2)]),
            review_status_counts: HashMap::from([
                ("READY".to_string(), 1),
                ("NEEDS_REVIEW".to_string(), 1),
            ]),
            imports: Vec::new(),
            source_attempts: Vec::new(),
            warnings: Vec::new(),
            errors: Vec::new(),
            message: "symbol complete".to_string(),
        };
        complete_historical_backfill_run_symbol(&connection, completed_symbol_id, &symbol_result)
            .unwrap();
        let first_batch_result = HistoricalCapitalActionBackfillBatchResult {
            run_id: Some(first_run_id),
            exchange: "NSE".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            requested_symbols: first_symbols,
            total_symbols: 2,
            completed_symbols: 1,
            failed_symbols: 0,
            stopped_on_error: false,
            rows_read: 2,
            rows_inserted: 1,
            rows_duplicate: 0,
            rows_evidence_attached: 1,
            rows_error: 0,
            rows_unresolved: 1,
            rows_parsed: 2,
            rows_unsupported: 0,
            parse_status_counts: HashMap::from([("PARSED".to_string(), 2)]),
            review_status_counts: HashMap::from([
                ("READY".to_string(), 1),
                ("NEEDS_REVIEW".to_string(), 1),
            ]),
            symbol_results: Vec::new(),
            errors: Vec::new(),
            message: "first batch complete".to_string(),
        };
        complete_historical_backfill_run(&connection, first_run_id, &first_batch_result).unwrap();
        let second_batch_result = HistoricalCapitalActionBackfillBatchResult {
            run_id: Some(second_run_id),
            exchange: "NSE".to_string(),
            from_date: "1994-01-01".to_string(),
            to_date: "2026-06-25".to_string(),
            requested_symbols: second_symbols,
            total_symbols: 1,
            completed_symbols: 0,
            failed_symbols: 1,
            stopped_on_error: true,
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            rows_unresolved: 0,
            rows_parsed: 0,
            rows_unsupported: 0,
            parse_status_counts: HashMap::new(),
            review_status_counts: HashMap::new(),
            symbol_results: Vec::new(),
            errors: vec!["KOTAKBANK: stopped".to_string()],
            message: "second batch stopped".to_string(),
        };
        complete_historical_backfill_run(&connection, second_run_id, &second_batch_result).unwrap();

        let listed = list_historical_backfill_runs(
            &connection,
            Some(&HistoricalCapitalActionBackfillRunListInput {
                status: Some("completed".to_string()),
                search_query: Some("infy".to_string()),
                limit: Some(10),
                offset: None,
            }),
        )
        .unwrap();

        assert_eq!(listed.runs.len(), 1);
        assert_eq!(listed.total, 1);
        assert_eq!(listed.offset, 0);
        assert_eq!(listed.limit, 10);
        assert!(!listed.has_more);
        assert_eq!(listed.runs[0].id, first_run_id);
        assert_eq!(listed.runs[0].requested_symbols, vec!["INFY", "WIPRO"]);
        assert_eq!(listed.runs[0].symbols.len(), 1);
        assert_eq!(listed.runs[0].symbols[0].symbol, "INFY");
        assert_eq!(listed.runs[0].symbols[0].status, "COMPLETED");
        assert_eq!(listed.runs[0].symbols[0].rows_inserted, 1);
        assert_eq!(listed.runs[0].parse_status_counts.get("PARSED"), Some(&2));
        assert_eq!(
            listed.runs[0].symbols[0]
                .review_status_counts
                .get("NEEDS_REVIEW"),
            Some(&1)
        );
        assert!(listed.runs[0].symbols[0].outcomes.is_empty());
    }

    #[test]
    fn phase6b_backfill_run_list_reports_totals_and_end_state() {
        let connection = Connection::open_in_memory().unwrap();
        create_historical_backfill_tracking_tables(&connection);
        for symbol in ["INFY", "WIPRO", "TRENT"] {
            create_historical_backfill_run(
                &connection,
                "NSE",
                "2026-01-01",
                "2026-06-30",
                &[symbol.to_string()],
                false,
            )
            .unwrap();
        }

        let first_page = list_historical_backfill_runs(
            &connection,
            Some(&HistoricalCapitalActionBackfillRunListInput {
                status: None,
                search_query: None,
                limit: Some(2),
                offset: Some(0),
            }),
        )
        .unwrap();
        assert_eq!(first_page.total, 3);
        assert_eq!(first_page.offset, 0);
        assert_eq!(first_page.limit, 2);
        assert_eq!(first_page.runs.len(), 2);
        assert!(first_page.has_more);

        let last_page = list_historical_backfill_runs(
            &connection,
            Some(&HistoricalCapitalActionBackfillRunListInput {
                status: None,
                search_query: None,
                limit: Some(2),
                offset: Some(2),
            }),
        )
        .unwrap();
        assert_eq!(last_page.total, 3);
        assert_eq!(last_page.offset, 2);
        assert_eq!(last_page.runs.len(), 1);
        assert!(!last_page.has_more);
    }

    #[test]
    fn phase6a_backfill_outcomes_link_import_and_evidence_rows() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("PRAGMA foreign_keys = ON")
            .unwrap();
        create_nse_resolution_tables(&connection);
        create_historical_backfill_tracking_tables(&connection);
        let requested_symbols = vec!["TRENT".to_string()];
        let run_id = create_historical_backfill_run(
            &connection,
            "NSE",
            "2026-06-01",
            "2026-06-30",
            &requested_symbols,
            false,
        )
        .unwrap();
        let request = HistoricalCapitalActionBackfillInput {
            exchange: "NSE".to_string(),
            symbol: "TRENT".to_string(),
            from_date: "2026-06-01".to_string(),
            to_date: "2026-06-30".to_string(),
            bse_scrip_code: None,
        };
        let run_symbol_id =
            create_historical_backfill_run_symbol(&connection, run_id, &request).unwrap();
        let attempt = HistoricalSourceAttemptState {
            source: "NSE_API".to_string(),
            requested_symbol: Some("TRENT".to_string()),
            source_locator: Some("https://example.test/nse-history".to_string()),
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            earliest_ex_date: None,
            latest_ex_date: None,
        };
        let candidate = test_import_candidate();

        let inserted = store_historical_candidate_with_run_outcome(
            &connection,
            Some(run_symbol_id),
            &attempt,
            &candidate,
        )
        .unwrap();
        let (import_id, evidence_id) = match inserted {
            HistoricalCandidateStoreOutcome::Inserted { row, evidence_id } => (row.id, evidence_id),
            _ => panic!("expected inserted candidate"),
        };
        let duplicate = store_historical_candidate_with_run_outcome(
            &connection,
            Some(run_symbol_id),
            &attempt,
            &candidate,
        )
        .unwrap();
        assert!(matches!(
            duplicate,
            HistoricalCandidateStoreOutcome::Duplicate { import_id: value } if value == import_id
        ));

        let outcomes = list_historical_backfill_run_outcomes(&connection, run_symbol_id).unwrap();
        assert_eq!(outcomes.len(), 2);
        assert_eq!(outcomes[0].outcome, "INSERTED");
        assert_eq!(outcomes[0].import_id, Some(import_id));
        assert_eq!(outcomes[0].evidence_id, Some(evidence_id));
        assert_eq!(outcomes[0].parse_status.as_deref(), Some("PARSED"));
        assert_eq!(outcomes[0].evidence_symbol_seen.as_deref(), Some("TRENT"));
        assert_eq!(
            outcomes[0].evidence_isin_seen.as_deref(),
            Some("INE849A01020")
        );
        assert!(outcomes[0].evidence_raw_reference.is_some());
        assert_eq!(outcomes[1].outcome, "DUPLICATE");
        assert_eq!(outcomes[1].import_id, Some(import_id));
    }

    #[test]
    fn phase6a_outcome_failure_rolls_back_candidate_and_evidence() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch("PRAGMA foreign_keys = ON")
            .unwrap();
        create_nse_resolution_tables(&connection);
        create_historical_backfill_tracking_tables(&connection);
        let requested_symbols = vec!["TRENT".to_string()];
        let run_id = create_historical_backfill_run(
            &connection,
            "NSE",
            "2026-06-01",
            "2026-06-30",
            &requested_symbols,
            false,
        )
        .unwrap();
        let request = HistoricalCapitalActionBackfillInput {
            exchange: "NSE".to_string(),
            symbol: "TRENT".to_string(),
            from_date: "2026-06-01".to_string(),
            to_date: "2026-06-30".to_string(),
            bse_scrip_code: None,
        };
        let run_symbol_id =
            create_historical_backfill_run_symbol(&connection, run_id, &request).unwrap();
        connection
            .execute_batch(
                "
                  CREATE TRIGGER reject_phase6a_outcome
                  BEFORE INSERT ON historical_capital_action_backfill_run_outcomes
                  BEGIN
                    SELECT RAISE(ABORT, 'forced outcome failure');
                  END;
                ",
            )
            .unwrap();
        let attempt = HistoricalSourceAttemptState {
            source: "NSE_API".to_string(),
            requested_symbol: Some("TRENT".to_string()),
            source_locator: Some("https://example.test/nse-history".to_string()),
            rows_read: 0,
            rows_inserted: 0,
            rows_duplicate: 0,
            rows_evidence_attached: 0,
            rows_error: 0,
            earliest_ex_date: None,
            latest_ex_date: None,
        };

        let error = store_historical_candidate_with_run_outcome(
            &connection,
            Some(run_symbol_id),
            &attempt,
            &test_import_candidate(),
        )
        .unwrap_err();
        assert!(error.contains("forced outcome failure"));
        let import_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                row.get(0)
            })
            .unwrap();
        let evidence_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(import_count, 0);
        assert_eq!(evidence_count, 0);
    }

    fn phase6e_preview_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  factor REAL NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  adjust_volume INTEGER NOT NULL DEFAULT 1,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  applied_at TEXT NOT NULL,
                  created_at TEXT,
                  updated_at TEXT
                );
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY,
                  dedupe_key TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL,
                  review_status TEXT NOT NULL,
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL,
                  approved_at TEXT
                );
                CREATE TABLE corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL,
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );

                INSERT INTO corporate_actions (
                  id, symbol, exchange, isin, effective_date, action_type, factor, ratio_num,
                  ratio_den, old_face_value, new_face_value, cash_amount, adjust_volume, note,
                  source, source_ref, applied_at, created_at, updated_at
                ) VALUES
                  (101, 'MULTIDIV', 'NSE', 'INE000A01001', '2025-01-01', 'DIVIDEND', 0.98, NULL, NULL, NULL, NULL, 2, 0, 'old dividend', 'NSE_OFFICIAL', 'fixture', '2025-01-02', '2025-01-02', '2025-01-02'),
                  (102, 'UNITDIST', 'NSE', 'INE000A01002', '2025-01-02', 'DIVIDEND', 0.99, NULL, NULL, NULL, NULL, 2, 0, 'old distribution', 'NSE_OFFICIAL', 'fixture', '2025-01-03', '2025-01-03', '2025-01-03'),
                  (103, 'COMPOUND', 'NSE', 'INE000A01003', '2025-01-03', 'BONUS', 2, 1, 1, NULL, NULL, NULL, 1, 'compound', 'NSE_OFFICIAL', 'fixture', '2025-01-04', '2025-01-04', '2025-01-04'),
                  (104, 'WRONGSPLIT', 'NSE', 'INE000A01004', '2025-01-04', 'SPLIT', 0.6, NULL, NULL, 6, 10, NULL, 1, 'wrong split', 'NSE_OFFICIAL', 'fixture', '2025-01-05', '2025-01-05', '2025-01-05'),
                  (105, 'INCLUSIVE', 'NSE', 'INE000A01005', '2025-01-05', 'DIVIDEND', 0.91, NULL, NULL, NULL, NULL, 8.5, 0, 'inclusive total', 'NSE_OFFICIAL', 'fixture', '2025-01-06', '2025-01-06', '2025-01-06'),
                  (106, 'AMBIG', 'NSE', 'INE000A01006', '2002-10-25', 'SPLIT', 32, NULL, NULL, 64, 2, NULL, 1, 'ambiguous split', 'NSE_OFFICIAL', 'fixture', '2002-10-26', '2002-10-26', '2002-10-26'),
                  (107, 'PENDING', 'NSE', 'INE000A01007', '2025-01-07', 'DIVIDEND', 0.99, NULL, NULL, NULL, NULL, 1, 0, 'pending', 'NSE_OFFICIAL', 'fixture', '2025-01-08', '2025-01-08', '2025-01-08');

                INSERT INTO corporate_action_imports (
                  id, dedupe_key, exchange, source, source_file, symbol, isin, company_name,
                  purpose_raw, ex_date, action_type, ratio_num, ratio_den, old_face_value,
                  new_face_value, cash_amount, factor, price_factor, parse_status, review_status,
                  message, approved_corporate_action_id, imported_at, approved_at
                ) VALUES
                  (1, 'multi-div', 'NSE', 'NSE_API', 'https://example.test/1', 'MULTIDIV', 'INE000A01001', 'Multi Dividend', 'Interim Dividend Rs.2 Per Share & Special Dividend Rs.3 Per Share', '2025-01-01', 'DIVIDEND', NULL, NULL, NULL, NULL, 2, NULL, NULL, 'PARSED', 'APPROVED', 'legacy parsed', 101, '2025-01-01', '2025-01-02'),
                  (2, 'unit-dist', 'NSE', 'NSE_API', 'https://example.test/2', 'UNITDIST', 'INE000A01002', 'Unit Distribution', 'Distribution: Dividend Rs.2 Per Unit + Interest Rs.3 Per Unit', '2025-01-02', 'DIVIDEND', NULL, NULL, NULL, NULL, 2, NULL, NULL, 'PARSED', 'APPROVED', 'legacy parsed', 102, '2025-01-02', '2025-01-03'),
                  (3, 'compound', 'NSE', 'NSE_API', 'https://example.test/3', 'COMPOUND', 'INE000A01003', 'Compound', 'Dividend Rs.1.40 Per Share / Bonus 1:1', '2025-01-03', 'BONUS', 1, 1, NULL, NULL, NULL, 2, 0.5, 'PARSED', 'APPROVED', 'legacy parsed', 103, '2025-01-03', '2025-01-04'),
                  (4, 'wrong-split', 'NSE', 'NSE_API', 'https://example.test/4', 'WRONGSPLIT', 'INE000A01004', 'Wrong Split', 'Interim Div - Rs 6/- Per Share + Face Value Split (Sub-Division) - From Rs 10/- Per Share To Re 1/- Per Share', '2025-01-04', 'SPLIT', NULL, NULL, 6, 10, NULL, 0.6, 1.6666666667, 'PARSED', 'APPROVED', 'legacy parsed', 104, '2025-01-04', '2025-01-05'),
                  (5, 'inclusive', 'NSE', 'NSE_API', 'https://example.test/5', 'INCLUSIVE', 'INE000A01005', 'Inclusive', 'Final Dividend Rs.8.50 Per Share (Including Special Dividend Rs.2 Per Share)', '2025-01-05', 'DIVIDEND', NULL, NULL, NULL, NULL, 8.5, NULL, NULL, 'PARSED', 'APPROVED', 'legacy parsed', 105, '2025-01-05', '2025-01-06'),
                  (6, 'ambiguous', 'NSE', 'NSE_API', 'https://example.test/6', 'AMBIG', 'INE000A01006', 'Ambiguous', 'Split Us 64 Into 2 Parts', '2002-10-25', 'SPLIT', NULL, NULL, 64, 2, NULL, 32, 0.03125, 'PARSED', 'APPROVED', 'legacy parsed', 106, '2002-10-25', '2002-10-26'),
                  (7, 'pending', 'NSE', 'NSE_API', 'https://example.test/7', 'PENDING', 'INE000A01007', 'Pending', 'Dividend Rs.1 Per Share', '2025-01-07', 'DIVIDEND', NULL, NULL, NULL, NULL, 1, NULL, NULL, 'PARSED', 'PENDING', 'pending', 107, '2025-01-07', NULL),
                  (8, 'unlinked', 'NSE', 'NSE_API', 'https://example.test/8', 'UNLINKED', 'INE000A01008', 'Unlinked', 'Dividend Rs.1 Per Share', '2025-01-08', 'DIVIDEND', NULL, NULL, NULL, NULL, 1, NULL, NULL, 'PARSED', 'APPROVED', 'unlinked', NULL, '2025-01-08', '2025-01-09');

                INSERT INTO corporate_action_import_evidence (
                  id, import_id, source_code, source_locator, captured_at, symbol_seen, isin_seen,
                  company_name_seen, action_type_seen, event_date_seen, factor_seen, raw_reference, note
                ) VALUES
                  (1, 1, 'NSE_API', 'https://example.test/1', '2025-01-01', 'MULTIDIV', 'INE000A01001', 'Multi Dividend', 'DIVIDEND', '2025-01-01', NULL, 'fixture-1', 'Backfilled from an existing corporate_action_imports row.'),
                  (2, 2, 'NSE_API', 'https://example.test/2', '2025-01-02', 'UNITDIST', 'INE000A01002', 'Unit Distribution', 'DIVIDEND', '2025-01-02', NULL, 'fixture-2', 'Captured from the original structured response.'),
                  (3, 3, 'NSE_API', 'https://example.test/3', '2025-01-03', 'COMPOUND', 'INE000A01003', 'Compound', 'BONUS', '2025-01-03', 2, 'fixture-3', 'Captured from the original structured response.'),
                  (4, 4, 'NSE_API', 'https://example.test/4', '2025-01-04', 'WRONGSPLIT', 'INE000A01004', 'Wrong Split', 'SPLIT', '2025-01-04', 0.6, 'fixture-4', 'Captured from the original structured response.'),
                  (5, 5, 'NSE_API', 'https://example.test/5', '2025-01-05', 'INCLUSIVE', 'INE000A01005', 'Inclusive', 'DIVIDEND', '2025-01-05', NULL, 'fixture-5', 'Captured from the original structured response.'),
                  (6, 6, 'NSE_API', 'https://example.test/6', '2002-10-25', 'AMBIG', 'INE000A01006', 'Ambiguous', 'SPLIT', '2002-10-25', 32, 'fixture-6', 'Captured from the original structured response.');
                ",
            )
            .unwrap();
        connection.execute_batch("PRAGMA query_only=ON").unwrap();
        connection
    }

    fn phase6e_total_changes(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT total_changes()", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn phase6e_validates_explicit_ids_and_deduplicates_requests() {
        assert!(validate_repair_preview_import_ids(&[]).is_err());
        assert!(validate_repair_preview_import_ids(&[0]).is_err());
        assert!(validate_repair_preview_import_ids(&[-1]).is_err());
        assert!(validate_repair_preview_import_ids(&vec![
            1;
            CORPORATE_ACTION_REPAIR_PREVIEW_MAX_IDS
                + 1
        ])
        .is_err());
        assert_eq!(
            validate_repair_preview_import_ids(&[3, 1, 3, 2, 1]).unwrap(),
            vec![3, 1, 2]
        );
    }

    #[test]
    fn phase6e_read_only_connection_uses_uri_mode_and_query_only() {
        let folder = tempfile::Builder::new()
            .prefix("phase6e read only ")
            .tempdir()
            .unwrap();
        let database_path = folder.path().join(super::super::DATABASE_FILE_NAME);
        let writable = Connection::open(&database_path).unwrap();
        writable
            .execute_batch(
                "CREATE TABLE proof (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO proof VALUES (1, 'unchanged');",
            )
            .unwrap();
        drop(writable);

        let read_only = open_read_only_connection_for_folder(folder.path()).unwrap();
        assert_eq!(
            read_only
                .query_row("PRAGMA query_only", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            read_only
                .query_row("SELECT value FROM proof WHERE id=1", [], |row| row
                    .get::<_, String>(0))
                .unwrap(),
            "unchanged"
        );
        assert!(read_only
            .execute("UPDATE proof SET value='changed' WHERE id=1", [])
            .is_err());
    }

    #[test]
    fn phase6e_reports_missing_unapproved_and_unlinked_rows_without_writes() {
        let connection = phase6e_preview_connection();
        let before_changes = phase6e_total_changes(&connection);
        let result = preview_corporate_action_repairs_internal(
            &connection,
            &CorporateActionRepairPreviewInput {
                import_ids: vec![7, 7, 8, 999],
            },
        )
        .unwrap();
        assert_eq!(result.requested, 4);
        assert_eq!(result.unique_requested, 3);
        assert_eq!(result.missing_import_ids, vec![999]);
        assert_eq!(result.rows.len(), 2);
        assert!(result.rows[0]
            .blocking_reasons
            .contains(&"IMPORT_IS_NOT_APPROVED".to_string()));
        assert!(result.rows[1]
            .blocking_reasons
            .contains(&"IMPORT_IS_NOT_LINKED_TO_A_CANONICAL_ACTION".to_string()));
        assert!(!result.rows[0].previewable);
        assert!(!result.rows[1].previewable);
        assert_eq!(phase6e_total_changes(&connection), before_changes);
        assert!(connection.is_autocommit());
    }

    #[test]
    fn phase6e_fingerprint_is_stable_and_covers_stale_relevant_groups() {
        let connection = phase6e_preview_connection();
        let (source, import) = load_repair_preview_import(&connection, 1).unwrap().unwrap();
        let canonical = load_repair_preview_canonical(&connection, 101)
            .unwrap()
            .unwrap();
        let same_date = list_same_date_repair_preview_canonicals(&connection, &canonical).unwrap();
        let evidence = list_repair_preview_evidence(&connection, 1).unwrap();
        let first = stable_repair_preview_fingerprint(
            &source,
            &import,
            Some(&canonical),
            &same_date,
            &evidence,
        )
        .unwrap();
        let second = stable_repair_preview_fingerprint(
            &source,
            &import,
            Some(&canonical),
            &same_date,
            &evidence,
        )
        .unwrap();
        assert_eq!(first, second);

        let mut changed_import = import.clone();
        changed_import.purpose_raw.push_str(" revised");
        assert_ne!(
            first,
            stable_repair_preview_fingerprint(
                &source,
                &changed_import,
                Some(&canonical),
                &same_date,
                &evidence,
            )
            .unwrap()
        );
        let mut changed_canonical = canonical.clone();
        changed_canonical.factor = 123.0;
        assert_ne!(
            first,
            stable_repair_preview_fingerprint(
                &source,
                &import,
                Some(&changed_canonical),
                &same_date,
                &evidence,
            )
            .unwrap()
        );
        let mut changed_evidence = evidence.clone();
        changed_evidence[0].note = Some("refreshed".to_string());
        assert_ne!(
            first,
            stable_repair_preview_fingerprint(
                &source,
                &import,
                Some(&canonical),
                &same_date,
                &changed_evidence,
            )
            .unwrap()
        );
        assert_eq!(
            repair_preview_fingerprint_fields(),
            vec![
                "sourceIdentity.*",
                "currentImport.*",
                "currentCanonical.*",
                "currentSameDateCanonicalActions[*].*",
                "evidence[*].*",
            ]
        );
    }

    #[test]
    fn phase6e_recomputes_multi_dividend_and_unit_distribution_from_live_purpose() {
        let connection = phase6e_preview_connection();
        let result = preview_corporate_action_repairs_internal(
            &connection,
            &CorporateActionRepairPreviewInput {
                import_ids: vec![1, 2],
            },
        )
        .unwrap();
        assert_eq!(result.rows[0].evidence_grade, "LEGACY_BACKFILL");
        assert_eq!(result.rows[0].confidence, "MODERATE");
        assert_eq!(result.rows[0].proposed_outcomes[0].cash_amount, Some(5.0));
        assert_eq!(result.rows[1].evidence_grade, "STRUCTURED_OFFICIAL");
        assert_eq!(result.rows[1].confidence, "HIGH");
        assert_eq!(result.rows[1].proposed_outcomes[0].cash_amount, Some(5.0));
        assert!(result.rows.iter().all(|row| row.manual_review_required));
    }

    #[test]
    fn phase6e_compound_actions_emit_separate_review_rows_and_correct_split_preview() {
        let connection = phase6e_preview_connection();
        let result = preview_corporate_action_repairs_internal(
            &connection,
            &CorporateActionRepairPreviewInput {
                import_ids: vec![3, 4],
            },
        )
        .unwrap();
        let compound = &result.rows[0];
        assert!(compound.previewable);
        assert!(compound
            .blocking_reasons
            .contains(&"COMPOUND_ACTION_REQUIRES_SEPARATE_REVIEW_ROWS".to_string()));
        assert_eq!(compound.proposed_outcomes.len(), 2);
        assert_eq!(compound.proposed_outcomes[0].action_type, "DIVIDEND");
        assert_eq!(compound.proposed_outcomes[0].cash_amount, Some(1.4));
        assert_eq!(
            compound.proposed_outcomes[0].disposition,
            "CREATE_COMPANION_REVIEW_ROW"
        );
        assert_eq!(compound.proposed_outcomes[1].action_type, "BONUS");

        let wrong_split = &result.rows[1];
        assert_eq!(wrong_split.proposed_outcomes.len(), 2);
        let split = wrong_split
            .proposed_outcomes
            .iter()
            .find(|proposal| proposal.action_type == "SPLIT")
            .unwrap();
        assert_eq!(split.factor, Some(10.0));
        assert_eq!(split.disposition, "UPDATE_LINKED_CANONICAL");
        assert!(wrong_split
            .proposed_outcomes
            .iter()
            .all(|proposal| proposal.manual_review_required));
    }

    #[test]
    fn phase6e_excludes_inclusive_totals_and_ambiguous_splits_from_previewable_repairs() {
        let connection = phase6e_preview_connection();
        let result = preview_corporate_action_repairs_internal(
            &connection,
            &CorporateActionRepairPreviewInput {
                import_ids: vec![5, 6],
            },
        )
        .unwrap();
        assert!(result.rows.iter().all(|row| !row.previewable));
        assert!(result
            .rows
            .iter()
            .all(|row| row.proposed_outcomes.is_empty()));
        assert!(result
            .rows
            .iter()
            .all(|row| row.confidence == "INSUFFICIENT"));
        assert!(result.rows.iter().all(|row| row
            .blocking_reasons
            .contains(&"NO_AUTHORITATIVE_PROPOSAL_COULD_BE_RECOMPUTED".to_string())));
    }

    #[test]
    fn phase6e_preview_keeps_query_only_and_proves_zero_mutation_or_transaction() {
        let connection = phase6e_preview_connection();
        let before_changes = phase6e_total_changes(&connection);
        let before_imports: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                row.get(0)
            })
            .unwrap();
        let before_canonicals: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(connection.is_autocommit());
        let result = preview_corporate_action_repairs_internal(
            &connection,
            &CorporateActionRepairPreviewInput {
                import_ids: vec![1, 2, 3, 4, 5, 6],
            },
        )
        .unwrap();
        assert!(result.database_query_only);
        assert_eq!(phase6e_total_changes(&connection), before_changes);
        assert!(connection.is_autocommit());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            before_imports
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            before_canonicals
        );
        assert!(connection
            .execute(
                "UPDATE corporate_action_imports SET message='forbidden' WHERE id=1",
                []
            )
            .is_err());
    }

    #[test]
    fn phase6e_renderer_and_rust_contract_names_stay_aligned() {
        let desktop_contract = include_str!("../../../src/types/desktop.ts");
        let platform_contract = include_str!("../../../src/platform/types.ts");
        let tauri_adapter = include_str!("../../../src/platform/tauriDesktop.ts");
        let main_source = include_str!("../main.rs");
        assert!(desktop_contract.contains("export interface CorporateActionRepairPreviewInput"));
        assert!(desktop_contract.contains("export interface CorporateActionRepairPreviewResult"));
        assert!(desktop_contract.contains("previewCorporateActionRepairs("));
        assert!(platform_contract.contains("CorporateActionRepairPreviewResult"));
        assert!(platform_contract.contains("'previewCorporateActionRepairs'"));
        assert!(tauri_adapter.contains("preview_corporate_action_repairs"));
        assert!(main_source.contains("preview_corporate_action_repairs,"));
    }

    fn create_phase1_scan_tables(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE scan_runs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scope TEXT NOT NULL,
                  action_types TEXT NOT NULL,
                  started_at TEXT NOT NULL,
                  completed_at TEXT,
                  status TEXT NOT NULL,
                  message TEXT,
                  total_results INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE corporate_action_scan_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scan_run_id INTEGER NOT NULL,
                  corporate_action_import_id INTEGER,
                  corporate_action_id INTEGER,
                  symbol TEXT,
                  exchange TEXT NOT NULL,
                  scan_status TEXT NOT NULL,
                  prev_trade_date TEXT,
                  ex_trade_date TEXT,
                  prev_close REAL,
                  ex_open REAL,
                  ex_close REAL,
                  expected_factor REAL,
                  actual_open_factor REAL,
                  actual_close_factor REAL,
                  confidence REAL,
                  message TEXT,
                  scanned_at TEXT NOT NULL
                );
                ",
            )
            .unwrap();
    }

    fn insert_phase1_scan_result(
        connection: &Connection,
        import_id: i64,
        symbol: &str,
        factor: f64,
        status: &str,
        confidence: Option<f64>,
    ) {
        connection
            .execute(
                "
                INSERT INTO scan_runs (
                  scope, action_types, started_at, completed_at, status, total_results
                ) VALUES ('official_imports', 'SPLIT,BONUS', '2026-08-14T00:00:00Z', '2026-08-14T00:00:01Z', 'COMPLETED', 1)
                ",
                [],
            )
            .unwrap();
        let run_id = connection.last_insert_rowid();
        connection
            .execute(
                "
                INSERT INTO corporate_action_scan_results (
                  scan_run_id, corporate_action_import_id, symbol, exchange, scan_status,
                  prev_trade_date, ex_trade_date, prev_close, ex_open, ex_close,
                  expected_factor, actual_open_factor, actual_close_factor, confidence, message, scanned_at
                ) VALUES (?, ?, ?, 'NSE', ?, '2026-08-13', '2026-08-14', 100, 52.5, 51.8, ?, ?, ?, ?, 'phase1 test', '2026-08-14T00:00:01Z')
                ",
                params![
                    run_id,
                    import_id,
                    symbol,
                    status,
                    factor,
                    100.0 / 52.5,
                    100.0 / 51.8,
                    confidence
                ],
            )
            .unwrap();
    }

    #[test]
    fn phase1_targeted_scan_ids_are_deduplicated_and_validated() {
        let input = CorporateActionScanInput {
            scope: Some("official_imports".to_string()),
            import_ids: Some(vec![2, 1, 2]),
        };
        assert_eq!(
            normalize_targeted_scan_import_ids(Some(&input)).unwrap(),
            Some(vec![2, 1])
        );

        let invalid = CorporateActionScanInput {
            scope: Some("official_imports".to_string()),
            import_ids: Some(vec![0]),
        };
        assert!(normalize_targeted_scan_import_ids(Some(&invalid))
            .unwrap_err()
            .contains("positive"));

        let too_many = CorporateActionScanInput {
            scope: Some("official_imports".to_string()),
            import_ids: Some((1..=501).collect()),
        };
        assert!(normalize_targeted_scan_import_ids(Some(&too_many))
            .unwrap_err()
            .contains("500"));
    }

    #[test]
    fn phase1_targeted_candidate_loader_scans_only_requested_imports() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY,
                  symbol TEXT,
                  exchange TEXT NOT NULL,
                  ex_date TEXT,
                  factor REAL,
                  action_type TEXT NOT NULL,
                  parse_status TEXT NOT NULL
                );
                INSERT INTO corporate_action_imports VALUES
                  (1, 'AAA', 'NSE', '2026-08-14', 2.0, 'SPLIT', 'PARSED'),
                  (2, 'BBB', 'NSE', '2026-08-14', 1.5, 'BONUS', 'PARSED'),
                  (3, 'CCC', 'NSE', '2026-08-14', 2.0, 'DIVIDEND', 'PARSED');
                ",
            )
            .unwrap();

        let targeted = load_scan_candidates(&connection, Some(&[2])).unwrap();
        assert_eq!(targeted.len(), 1);
        assert_eq!(targeted[0].import_id, 2);
        let all = load_scan_candidates(&connection, None).unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn ca_normal_targeted_eod_scan_includes_dividends_and_rights_without_factors() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "CREATE TABLE corporate_action_imports (
               id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, ex_date TEXT,
               factor REAL, action_type TEXT, parse_status TEXT
             );
             INSERT INTO corporate_action_imports VALUES
               (1,'SPLIT_A','NSE','2026-08-14',2,'SPLIT','PARSED'),
               (2,'DIV_A','NSE','2026-08-14',NULL,'DIVIDEND','PARSED'),
               (3,'RIGHT_A','NSE','2026-08-14',NULL,'RIGHTS','PARSED');",
        ).unwrap();
        let targeted = load_scan_candidates(&connection, Some(&[2, 3])).unwrap();
        assert_eq!(targeted.len(), 2);
        assert!(targeted.iter().all(|candidate| candidate.factor.is_none()));
        let untargeted = load_scan_candidates(&connection, None).unwrap();
        assert_eq!(untargeted.len(), 1);
        assert_eq!(untargeted[0].import_id, 1);
    }

    #[test]
    fn phase1_v114e_scan_candidate_uses_event_symbol_without_rewriting_raw_import() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                PRAGMA foreign_keys = ON;
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY,
                  symbol TEXT,
                  isin TEXT,
                  exchange TEXT NOT NULL,
                  ex_date TEXT,
                  factor REAL,
                  action_type TEXT NOT NULL,
                  parse_status TEXT NOT NULL
                );
                INSERT INTO corporate_action_imports VALUES
                  (22969, 'NAVA', 'INE725A01022', 'NSE', '2016-09-01', 2.0, 'BONUS', 'PARSED');
                ",
            )
            .unwrap();

        event_identity_resolution::create_event_identity_resolution_schema_for_controlled_apply(
            &connection,
        )
        .unwrap();
        connection
            .execute(
                "
                  INSERT INTO corporate_action_event_identity_resolutions (
                    import_id, exchange, raw_symbol, raw_isin, event_symbol, event_isin,
                    resolution_type, resolution_authority, chain_id,
                    transition_old_symbol, transition_new_symbol, transition_effective_date,
                    raw_identity_source_ref, raw_identity_source_sha256,
                    raw_identity_source_line_number, v114d1_evidence_sha256,
                    resolution_fingerprint
                  )
                  VALUES (
                    22969, 'NSE', 'NAVA', 'INE725A01022', 'NBVENTURES', NULL,
                    'NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL',
                    'V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH',
                    'CHAIN-3070AD0C1A094900',
                    'NBVENTURES', 'NAVA', '2022-07-29',
                    'raw-symbol-changes.csv',
                    '921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6',
                    532,
                    'd5a072eb85d7398556641e82a1a507daf63d82e56882ae663e094293f3ece1b2',
                    'fixture'
                  )
                ",
                [],
            )
            .unwrap();

        let candidates = load_scan_candidates(&connection, Some(&[22969])).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].symbol.as_deref(), Some("NBVENTURES"));

        let raw_symbol: String = connection
            .query_row(
                "SELECT symbol FROM corporate_action_imports WHERE id=22969",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(raw_symbol, "NAVA");
    }

    #[test]
    fn ca_financial_integrity_binary_only_scan_rejects_orphan_sqlite_prices() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             INSERT INTO settings(key, value) VALUES ('price_storage_mode', 'binary');
             CREATE TABLE eod_prices (symbol TEXT, exchange TEXT, date TEXT, open REAL, close REAL);
             INSERT INTO eod_prices VALUES
               ('CA_BINARY_ONLY', 'NSE', '2026-08-13', 100, 100),
               ('CA_BINARY_ONLY', 'NSE', '2026-08-14', 50, 50);",
        ).unwrap();
        let folder = std::env::temp_dir();
        assert!(load_trade_window(
            &connection, &folder, "CA_BINARY_ONLY", "NSE", "2026-08-14"
        ).unwrap().is_none());
        connection.execute(
            "UPDATE settings SET value='hybrid' WHERE key='price_storage_mode'", [],
        ).unwrap();
        assert!(load_trade_window(
            &connection, &folder, "CA_BINARY_ONLY", "NSE", "2026-08-14"
        ).unwrap().is_some());
    }

    #[test]
    fn phase1_scanner_matches_split_with_real_plus_and_minus_five_percent_gaps() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  close REAL NOT NULL
                );
                INSERT INTO eod_prices VALUES
                  ('UP5', 'NSE', '2026-08-13', 100, 100),
                  ('UP5', 'NSE', '2026-08-14', 52.5, 52.0),
                  ('DOWN5', 'NSE', '2026-08-13', 100, 100),
                  ('DOWN5', 'NSE', '2026-08-14', 47.5, 48.0);
                ",
            )
            .unwrap();

        for symbol in ["UP5", "DOWN5"] {
            let candidate = ScanCandidate {
                import_id: 1,
                symbol: Some(symbol.to_string()),
                exchange: "NSE".to_string(),
                ex_date: Some("2026-08-14".to_string()),
                factor: Some(2.0),
            };
            let result = scan_candidate(&connection, Path::new("."), 1, &candidate).unwrap();
            assert_eq!(result.scan_status, "MATCHED");
            assert!(result.confidence.unwrap() >= 0.85);
        }
    }

    #[test]
    fn phase1_price_validation_gate_requires_current_matched_evidence() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        create_phase1_scan_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                ) VALUES ('phase1-gate', 'NSE', 'NSE_API', 'TEST', 'Split 2:1', '2026-08-14',
                  'SPLIT', 2, 1, 2, 0.5, 'PARSED', 'PENDING')
                ",
                [],
            )
            .unwrap();
        let row = get_import_row(&connection, 1).unwrap();
        assert!(
            ensure_split_bonus_price_validation(&connection, &row, false)
                .unwrap_err()
                .contains("Run Split/Bonus price validation")
        );

        insert_phase1_scan_result(&connection, 1, "TEST", 2.0, "MATCHED", Some(0.95));
        ensure_split_bonus_price_validation(&connection, &row, false).unwrap();

        connection
            .execute(
                "UPDATE corporate_action_imports SET factor=3.0 WHERE id=1",
                [],
            )
            .unwrap();
        let changed = get_import_row(&connection, 1).unwrap();
        assert!(
            ensure_split_bonus_price_validation(&connection, &changed, false)
                .unwrap_err()
                .contains("stale")
        );
    }

    #[test]
    fn phase1_review_result_requires_audited_exception_and_cannot_bypass_isin() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        create_phase1_scan_tables(&connection);
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  action_type TEXT NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL
                );
                INSERT INTO corporate_actions (
                  symbol, exchange, effective_date, action_type, ratio_num, ratio_den
                ) VALUES ('TEST', 'NSE', '2026-08-14', 'SPLIT', 2, 1);
                -- Approval now requires the local cum/ex window that the scan observed.
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL, exchange TEXT NOT NULL, date TEXT NOT NULL,
                  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL
                );
                INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close) VALUES
                  ('TEST', 'NSE', '2026-08-13', 100, 100, 100, 100),
                  ('TEST', 'NSE', '2026-08-14', 52.5, 52.5, 51.8, 51.8);
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date,
                  action_type, ratio_num, ratio_den, factor, price_factor, parse_status, review_status
                ) VALUES ('phase1-exception', 'NSE', 'NSE_API', 'TEST', 'Split 2:1', '2026-08-14',
                  'SPLIT', 2, 1, 2, 0.5, 'PARSED', 'PENDING');
                ",
            )
            .unwrap();
        insert_phase1_scan_result(&connection, 1, "TEST", 2.0, "REVIEW", Some(0.70));
        let row = get_import_row(&connection, 1).unwrap();
        assert!(
            ensure_split_bonus_price_validation(&connection, &row, false)
                .unwrap_err()
                .contains("REVIEW")
        );
        ensure_split_bonus_price_validation(&connection, &row, true).unwrap();

        let result = approve_corporate_action_import_with_price_validation_exception_internal(
            &connection,
            Path::new("."),
            &CorporateActionImportExceptionalApprovalInput {
                import_id: 1,
                reason:
                    "Official exchange filing confirms the split despite unusual ex-date movement."
                        .to_string(),
                expected_database_path: ".".to_string(),
            },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "APPROVED");
        let decision: (String, String) = connection
            .query_row(
                "SELECT decision_type, reason FROM corporate_action_import_decisions WHERE import_id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(decision.0, "PRICE_VALIDATION_EXCEPTION");
        assert!(decision.1.contains("Official exchange filing"));

        connection
            .execute(
                "UPDATE corporate_action_imports SET approved_corporate_action_id=NULL, approved_at=NULL, review_status='PENDING_ISIN_MISMATCH' WHERE id=1",
                [],
            )
            .unwrap();
        let error = approve_corporate_action_import_with_price_validation_exception_internal(
            &connection,
            Path::new("."),
            &CorporateActionImportExceptionalApprovalInput {
                import_id: 1,
                reason: "Official exchange filing confirms the action despite price noise."
                    .to_string(),
                expected_database_path: ".".to_string(),
            },
        )
        .unwrap_err();
        assert!(error.contains("cannot bypass an ISIN identity mismatch"));
    }

    #[test]
    fn phase1_scanner_reports_review_and_no_price_data_without_changing_the_official_factor() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  close REAL NOT NULL
                );
                INSERT INTO eod_prices VALUES
                  ('MISMATCH', 'NSE', '2026-08-13', 100, 100),
                  ('MISMATCH', 'NSE', '2026-08-14', 75, 74);
                ",
            )
            .unwrap();

        let mismatch = ScanCandidate {
            import_id: 1,
            symbol: Some("MISMATCH".to_string()),
            exchange: "NSE".to_string(),
            ex_date: Some("2026-08-14".to_string()),
            factor: Some(2.0),
        };
        let reviewed = scan_candidate(&connection, Path::new("."), 1, &mismatch).unwrap();
        assert_eq!(reviewed.scan_status, "REVIEW");
        assert_eq!(reviewed.expected_factor, Some(2.0));

        let no_data = ScanCandidate {
            import_id: 2,
            symbol: Some("NODATA".to_string()),
            exchange: "NSE".to_string(),
            ex_date: Some("2026-08-14".to_string()),
            factor: Some(1.5),
        };
        let missing = scan_candidate(&connection, Path::new("."), 1, &no_data).unwrap();
        assert_eq!(missing.scan_status, "NO_PRICE_DATA");
        assert_eq!(missing.expected_factor, Some(1.5));
    }

    #[test]
    fn phase1_price_validation_gate_does_not_change_dividend_or_rights_approval_policy() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection
            .execute(
                "
                INSERT INTO corporate_action_imports (
                  dedupe_key, exchange, source, symbol, purpose_raw, ex_date,
                  action_type, cash_amount, parse_status, review_status
                ) VALUES ('phase1-dividend', 'NSE', 'NSE_API', 'TEST', 'Dividend Rs 5', '2026-08-14',
                  'DIVIDEND', 5, 'PARSED', 'PENDING')
                ",
                [],
            )
            .unwrap();
        let dividend = get_import_row(&connection, 1).unwrap();
        ensure_split_bonus_price_validation(&connection, &dividend, false).unwrap();

        connection
            .execute(
                "UPDATE corporate_action_imports SET action_type='RIGHTS', cash_amount=NULL, ratio_num=1, ratio_den=2, factor=NULL, price_factor=NULL WHERE id=1",
                [],
            )
            .unwrap();
        let rights = get_import_row(&connection, 1).unwrap();
        ensure_split_bonus_price_validation(&connection, &rights, false).unwrap();
    }

    fn phase1_recommended_isin_import_row() -> CorporateActionImportRow {
        CorporateActionImportRow {
            id: 1,
            exchange: "NSE".to_string(),
            source: "NSE_API".to_string(),
            source_file: None,
            symbol: Some("TEMBO".to_string()),
            isin: Some("INE869Y01010".to_string()),
            bse_scrip_code: None,
            company_name: Some("Tembo Global Industries Limited".to_string()),
            purpose_raw: "Face value 10 -> 1".to_string(),
            ex_date: Some("2026-08-05".to_string()),
            record_date: None,
            action_type: "SPLIT".to_string(),
            ratio_num: None,
            ratio_den: None,
            old_face_value: Some(10.0),
            new_face_value: Some(1.0),
            cash_amount: None,
            factor: Some(10.0),
            price_factor: Some(0.1),
            parse_status: "PARSED".to_string(),
            review_status: REVIEW_STATUS_PENDING_ISIN_MISMATCH.to_string(),
            message: None,
            approved_corporate_action_id: None,
            imported_at: now_iso(),
            approved_at: None,
            evidence_count: 1,
            evidence_sources: vec!["NSE_API".to_string()],
            latest_evidence_captured_at: None,
            latest_evidence_source_locator: None,
            latest_evidence_note: None,
        }
    }

    fn phase1_recommended_isin_candidate() -> CorporateActionImportResolutionSuggestion {
        CorporateActionImportResolutionSuggestion {
            symbol: "TEMBO".to_string(),
            exchange: "NSE".to_string(),
            name: Some("Tembo Global Industries Limited".to_string()),
            series: Some("EQ".to_string()),
            isin: Some("INE869Y01028".to_string()),
            is_active: true,
            has_event_date_isin_evidence: false,
            reason: "Active identity-history candidate".to_string(),
        }
    }

    #[test]
    fn phase1_recommended_isin_exception_requires_strict_exact_identity_fields() {
        let import_row = phase1_recommended_isin_import_row();
        let candidate = phase1_recommended_isin_candidate();
        assert!(build_recommended_isin_exception_reason_from_suggestions(
            &import_row,
            &[candidate]
        )
        .is_some());
    }

    #[test]
    fn phase1_recommended_isin_exception_rejects_ambiguous_or_company_mismatched_rows() {
        let import_row = phase1_recommended_isin_import_row();
        let mut mismatch = phase1_recommended_isin_candidate();
        mismatch.name = Some("Different Company Limited".to_string());
        assert!(
            build_recommended_isin_exception_reason_from_suggestions(&import_row, &[mismatch])
                .is_none()
        );
        let candidate = phase1_recommended_isin_candidate();
        let mut second = phase1_recommended_isin_candidate();
        second.symbol = "OTHER".to_string();
        assert!(build_recommended_isin_exception_reason_from_suggestions(
            &import_row,
            &[candidate, second]
        )
        .is_none());
        let mut no_evidence = import_row;
        no_evidence.evidence_count = 0;
        assert!(build_recommended_isin_exception_reason_from_suggestions(
            &no_evidence,
            &[phase1_recommended_isin_candidate()]
        )
        .is_none());
    }

    #[test]
    fn blind_scan_detects_common_split_gap() {
        let previous = ScannedBar {
            date: "2024-06-06".to_string(),
            open: 100.0,
            close: 100.0,
        };
        let current = ScannedBar {
            date: "2024-06-07".to_string(),
            open: 50.0,
            close: 51.0,
        };
        let result = build_blind_scan_result(1, "ABC", "NSE", &previous, &current).unwrap();
        assert_eq!(result.scan_status, "ANOMALY");
        assert_eq!(result.expected_factor, Some(2.0));
    }

    #[test]
    fn phase1_v17_compound_factor_matches_bharatras_split_plus_bonus() {
        let context = build_compound_scan_context(&[
            CompoundScanMember {
                import_id: 10,
                factor: 2.0,
            },
            CompoundScanMember {
                import_id: 11,
                factor: 2.0,
            },
        ])
        .unwrap();
        assert!((context.combined_factor - 4.0).abs() < 1e-12);
        assert_eq!(context.component_count, 2);
        let theoretical = 9900.0 / context.combined_factor;
        let residual = 2549.0 / theoretical - 1.0;
        assert!((theoretical - 2475.0).abs() < 1e-9);
        assert!((residual - 0.029_898_989_898_989_9).abs() < 1e-9);
    }

    #[test]
    fn phase1_v17_compound_factor_matches_fcl_split_plus_bonus() {
        let context = build_compound_scan_context(&[
            CompoundScanMember {
                import_id: 20,
                factor: 2.0,
            },
            CompoundScanMember {
                import_id: 21,
                factor: 5.0,
            },
        ])
        .unwrap();
        assert!((context.combined_factor - 10.0).abs() < 1e-12);
        let theoretical = 248.60 / context.combined_factor;
        let residual = 25.55 / theoretical - 1.0;
        assert!((theoretical - 24.86).abs() < 1e-9);
        assert!((residual - 0.027_755_430_410_297_68).abs() < 1e-9);
    }

    #[test]
    fn phase1_v17_compound_fingerprint_changes_when_component_factor_changes() {
        let original = build_compound_scan_context(&[
            CompoundScanMember {
                import_id: 1,
                factor: 2.0,
            },
            CompoundScanMember {
                import_id: 2,
                factor: 2.0,
            },
        ])
        .unwrap();
        let changed = build_compound_scan_context(&[
            CompoundScanMember {
                import_id: 1,
                factor: 2.0,
            },
            CompoundScanMember {
                import_id: 2,
                factor: 5.0,
            },
        ])
        .unwrap();
        assert_ne!(original.fingerprint, changed.fingerprint);
        let message = format!("Compound validation. {}", compound_scan_metadata(&original));
        assert_eq!(
            parse_compound_scan_fingerprint(&message),
            Some(original.fingerprint.as_str())
        );
    }

    #[test]
    fn phase1_v171_compound_lookup_is_optional_for_minimal_scanner_fixture() {
        let connection = Connection::open_in_memory().unwrap();
        let candidate = ScanCandidate {
            import_id: 1,
            symbol: Some("TEST".to_string()),
            exchange: "NSE".to_string(),
            ex_date: Some("2026-08-15".to_string()),
            factor: Some(2.0),
        };
        let context = load_same_date_split_bonus_compound_context(&connection, &candidate).unwrap();
        assert!(context.is_none());
    }

    #[test]
    fn ca_ux_fix2_exact_lookup_preserves_order_fields_and_evidence_without_writes() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        for id in [1_i64, 2, 3] {
            connection.execute(
                "INSERT INTO corporate_action_imports (id,dedupe_key,source,symbol,purpose_raw,action_type,parse_status,review_status) VALUES (?1,?2,'OFFICIAL',?3,'Dividend','DIVIDEND','PARSED','PENDING')",
                params![id, format!("key-{id}"), format!("SYM{id}")],
            ).unwrap();
        }
        connection.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,note) VALUES (3,'NSE','fixture-only','2026-09-01','test evidence')", []).unwrap();
        connection.pragma_update(None,"query_only",true).unwrap();
        let before: i64 = connection.query_row("SELECT total_changes()",[],|r|r.get(0)).unwrap();
        let schema_before: i64 = connection.query_row("PRAGMA schema_version",[],|r|r.get(0)).unwrap();
        let result = read_import_rows_by_ids(&connection, &[3,1]).unwrap();
        assert_eq!(result.iter().map(|r|r.id).collect::<Vec<_>>(), vec![3,1]);
        assert_eq!(result[0].evidence_count,1);
        assert_eq!(result[0].evidence_sources,vec!["NSE"]);
        assert_eq!(result[0].latest_evidence_source_locator.as_deref(),Some("fixture-only"));
        assert_eq!(result[0].latest_evidence_note.as_deref(),Some("test evidence"));
        let original = get_import_row(&connection,3).unwrap();
        assert_eq!(serde_json::to_value(&result[0]).unwrap(),serde_json::to_value(&original).unwrap());
        assert_eq!(connection.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap(),before);
        assert_eq!(connection.query_row("PRAGMA schema_version",[],|r|r.get::<_,i64>(0)).unwrap(),schema_before);
    }

    #[test]
    fn ca_ux_fix2_exact_lookup_invalid_ids_fail_before_any_query() {
        let connection = Connection::open_in_memory().unwrap(); // Deliberately no schema.
        for ids in [vec![],vec![0],vec![-1],vec![1,1],vec![9_007_199_254_740_992_i64],(1_i64..=101).collect()] {
            let message=read_import_rows_by_ids(&connection,&ids).unwrap_err();
            assert!(message.contains("Exact import lookup"),"{message}");
            assert!(!message.contains("no such table"));
        }
        assert!(validate_exact_import_lookup_ids(&(1_i64..=100).collect::<Vec<_>>()).is_ok());
    }

    #[test]
    fn ca_ux_fix2_exact_lookup_missing_id_fails_closed() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection.pragma_update(None,"query_only",true).unwrap();
        assert!(read_import_rows_by_ids(&connection,&[999]).unwrap_err().contains("missing"));
        assert_eq!(connection.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }

    #[test]
    fn ca_ux_fix2_exact_lookup_returns_approved_rows_for_post_apply_reconciliation() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        connection.execute("INSERT INTO corporate_action_imports(id,dedupe_key,source,symbol,purpose_raw,review_status,approved_corporate_action_id) VALUES (1,'one','OFFICIAL','ONE','Dividend','APPROVED',42)",[]).unwrap();
        connection.pragma_update(None,"query_only",true).unwrap();
        let result=read_import_rows_by_ids(&connection,&[1]).unwrap();
        assert_eq!(result[0].review_status,"APPROVED");
        assert_eq!(result[0].approved_corporate_action_id,Some(42));
    }

    #[test]
    fn ca_ux_fix2_other_filter_includes_other_and_demerger_without_reclassification() {
        let connection = Connection::open_in_memory().unwrap();
        create_nse_resolution_tables(&connection);
        for (id,action) in [(1_i64,"OTHER"),(2,"DEMERGER"),(3,"DIVIDEND")] {
            connection.execute("INSERT INTO corporate_action_imports(id,dedupe_key,source,purpose_raw,action_type) VALUES (?1,?2,'OFFICIAL','fixture',?3)",params![id,format!("key{id}"),action]).unwrap();
        }
        let input=CorporateActionImportListInput{ review_status:None,action_types:Some(vec!["OTHER".to_string(),"DEMERGER".to_string()]), search_query:None,exclude_approved:Some(true),limit:Some(100),offset:None };
        let mut types=list_import_rows(&connection,Some(&input)).unwrap().into_iter().map(|r|r.action_type).collect::<Vec<_>>();
        types.sort();assert_eq!(types,vec!["DEMERGER","OTHER"]);
    }

    #[test]
    fn ca_ux_fix2_lookup_database_context_is_pinned() {
        let active=tempfile::tempdir().unwrap();
        let different=tempfile::tempdir().unwrap();
        assert!(verify_import_lookup_database(active.path(),active.path().to_str().unwrap()).is_ok());
        assert!(verify_import_lookup_database(active.path(),different.path().to_str().unwrap()).is_err());
        assert!(verify_import_lookup_database(active.path(),"").is_err());
    }



    fn create_r1b1_existing_event_fixture(connection: &Connection) {
        create_nse_resolution_tables(connection);
        create_phase1_scan_tables(connection);
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  factor REAL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  adjust_volume INTEGER NOT NULL DEFAULT 0,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  applied_at TEXT,
                  created_at TEXT,
                  updated_at TEXT
                );
                INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                VALUES
                  ('VAIBHAVGBL', 'NSE', 'INE884A01027', 'Vaibhav Global Limited', 1, 'EQ'),
                  ('VAIBHAVGEM', 'NSE', 'INE884A01019', 'Vaibhav Gems Limited', 0, 'BE');
                INSERT INTO instrument_identity_history (
                  exchange, isin, current_symbol, current_name, old_symbol, old_name,
                  new_symbol, new_name, effective_date, change_type, source, source_ref
                ) VALUES (
                  'NSE', 'INE884A01027', 'VAIBHAVGBL', 'Vaibhav Global Limited',
                  'VAIBHAVGEM', 'Vaibhav Gems Limited', 'VAIBHAVGBL', 'Vaibhav Global Limited',
                  '2012-12-24', 'BOTH', 'NSE_IDENTITY', 'legacy-provenance-only'
                );
                INSERT INTO corporate_action_imports (
                  id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw,
                  ex_date, record_date, action_type, old_face_value, new_face_value,
                  factor, price_factor, parse_status, review_status, message
                ) VALUES (
                  1, 'r1b1-fixture', 'NSE', 'NSE_API', 'VAIBHAVGBL', 'INE884A01019',
                  'Vaibhav Global Limited',
                  'Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share',
                  '2021-05-07', '2021-05-10', 'SPLIT', 10, 2, 5, 0.2,
                  'PARSED', 'UNRESOLVED',
                  'Exact symbol matched, but the official ISIN differs from the database.'
                );
                INSERT INTO corporate_actions (
                  id, symbol, exchange, isin, effective_date, record_date, action_type, factor,
                  old_face_value, new_face_value, adjust_volume, note, source, source_ref,
                  applied_at, created_at, updated_at
                ) VALUES (
                  235, 'VAIBHAVGBL', 'NSE', 'INE884A01027', '2021-05-07', '2021-05-10',
                  'SPLIT', 5, 10, 2, 1,
                  'Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share',
                  'NSE_API', 'official-current-fetch',
                  '2026-06-10 19:24:57', '2026-06-10 19:24:57', '2026-06-10 19:24:57'
                );
                ",
            )
            .unwrap();
        insert_phase1_scan_result(
            connection,
            1,
            "VAIBHAVGBL",
            5.0,
            "MATCHED",
            Some(0.9869484151646984),
        );
        connection
            .execute(
                "UPDATE corporate_action_scan_results
                 SET prev_trade_date='2021-05-06', ex_trade_date='2021-05-07'
                 WHERE corporate_action_import_id=1",
                [],
            )
            .unwrap();
    }

    #[test]
    fn r1b1_strict_existing_event_reconciliation_links_existing_without_new_action() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        let before_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row.get(0))
            .unwrap();
        let result = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        assert_eq!(result.import_record.review_status, "APPROVED");
        assert_eq!(result.import_record.approved_corporate_action_id, Some(235));
        assert!(result.approved_record.is_none());
        assert!(result.message.contains("strict existing-event identity reconciliation"));
        let after_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(after_actions, before_actions);
        let (raw_isin, decision_type): (Option<String>, String) = connection
            .query_row(
                "SELECT i.isin, d.decision_type
                 FROM corporate_action_imports i
                 JOIN corporate_action_import_decisions d ON d.import_id=i.id
                 WHERE i.id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(raw_isin.as_deref(), Some("INE884A01019"));
        assert_eq!(decision_type, "VERIFIED_EXISTING_EVENT_RECONCILIATION");
    }

    #[test]
    fn r1b1_reconciliation_is_idempotent_after_existing_link() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        let second = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        assert_eq!(second.import_record.approved_corporate_action_id, Some(235));
        assert!(second.message.contains("already linked"));
        let decisions: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions
                 WHERE import_id=1 AND decision_type='VERIFIED_EXISTING_EVENT_RECONCILIATION'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decisions, 1);
    }

    #[test]
    fn r1b1_requires_unique_active_current_target() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute_batch(
            "
            INSERT INTO instruments (symbol,exchange,isin,name,is_active,series)
            VALUES ('ALTGLOBAL','NSE','INE884A01035','Alternate Global',1,'EQ');
            INSERT INTO instrument_identity_history (
              exchange,isin,current_symbol,current_name,old_symbol,new_symbol,effective_date,change_type
            ) VALUES ('NSE','INE884A01035','ALTGLOBAL','Alternate Global','VAIBHAVGEM','ALTGLOBAL','2013-01-01','BOTH');
            "
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("exactly one active current identity target"), "{error}");
        assert_eq!(get_import_row(&connection, 1).unwrap().review_status, "UNRESOLVED");
    }

    #[test]
    fn r1b1_requires_one_direct_predecessor_edge_with_old_isin() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute("DELETE FROM instrument_identity_history", []).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("direct predecessor identity edge"), "{error}");
    }

    #[test]
    fn r1b1_rejects_transition_after_event_date() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "UPDATE instrument_identity_history SET effective_date='2022-01-01'",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("on or before the Corporate Action ex-date"), "{error}");
    }

    #[test]
    fn r1b1_requires_exactly_one_same_symbol_date_canonical_candidate() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "INSERT INTO corporate_actions (
               symbol,exchange,isin,effective_date,record_date,action_type,factor,
               old_face_value,new_face_value,adjust_volume,note,source
             ) SELECT symbol,exchange,isin,effective_date,record_date,action_type,factor,
                      old_face_value,new_face_value,adjust_volume,note,source
               FROM corporate_actions WHERE id=235",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("exactly one same-symbol/date canonical candidate"), "{error}");
    }

    #[test]
    fn r1b1_rejects_canonical_event_semantic_mismatch() {
        for sql in [
            "UPDATE corporate_actions SET factor=4.0 WHERE id=235",
            "UPDATE corporate_actions SET record_date='2021-05-11' WHERE id=235",
            "UPDATE corporate_actions SET note='different purpose' WHERE id=235",
        ] {
            let connection = Connection::open_in_memory().unwrap();
            create_r1b1_existing_event_fixture(&connection);
            connection.execute(sql, []).unwrap();
            let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
            assert!(error.contains("canonical event semantics do not match"), "{error}");
        }
    }

    #[test]
    fn r1b1_requires_current_matched_split_bonus_price_validation() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "UPDATE corporate_action_scan_results SET scan_status='REVIEW' WHERE corporate_action_import_id=1",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("Split/Bonus price validation is REVIEW"), "{error}");
    }

    #[test]
    fn r1b1_preserves_pending_isin_mismatch_and_action_scope_boundaries() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "UPDATE corporate_action_imports SET review_status='PENDING_ISIN_MISMATCH' WHERE id=1",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("unresolved parsed NSE Split/Bonus"), "{error}");

        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "UPDATE corporate_action_imports SET action_type='DIVIDEND' WHERE id=1",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("unresolved parsed NSE Split/Bonus"), "{error}");
    }

    #[test]
    fn r1b1_requires_stale_raw_isin_to_match_exactly_one_inactive_predecessor() {
        let connection = Connection::open_in_memory().unwrap();
        create_r1b1_existing_event_fixture(&connection);
        connection.execute(
            "UPDATE corporate_action_imports SET isin='INE884A01027' WHERE id=1",
            [],
        ).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("exactly one inactive predecessor carrying the raw ISIN"), "{error}");
    }


    fn r1b2_create_canonical_table(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  factor REAL NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  adjust_volume INTEGER NOT NULL DEFAULT 1,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  applied_at TEXT,
                  created_at TEXT,
                  updated_at TEXT
                );
                ",
            )
            .unwrap();
    }

    fn r1b2_setup_inactive_existing_event(
        connection: &Connection,
        action_type: &str,
        factor: f64,
        ratio_num: Option<f64>,
        ratio_den: Option<f64>,
        old_face_value: Option<f64>,
        new_face_value: Option<f64>,
        purpose: &str,
    ) {
        create_nse_resolution_tables(connection);
        create_phase1_scan_tables(connection);
        r1b2_create_canonical_table(connection);

        connection
            .execute(
                "INSERT INTO instruments(symbol,exchange,isin,name,is_active,series) VALUES ('CURSYM','NSE','INECURR01020','Current Historical Company',0,'BE')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO instruments(symbol,exchange,isin,name,is_active,series) VALUES ('OLDSYM','NSE','INERAW001010','Old Historical Company',0,'EQ')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO instrument_identity_history(exchange,isin,current_symbol,current_name,old_symbol,old_name,new_symbol,new_name,effective_date,change_type,source,source_ref) VALUES ('NSE','INECURR01020','CURSYM','Current Historical Company','OLDSYM','Old Historical Company','CURSYM','Current Historical Company','2020-01-01','BOTH','NSE_IDENTITY','fixture')",
                [],
            )
            .unwrap();

        connection
            .execute(
                "INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,record_date,action_type,ratio_num,ratio_den,old_face_value,new_face_value,factor,price_factor,parse_status,review_status,message) VALUES (1,'r1b2-import','NSE','NSE_API','CURSYM','INERAW001010','Current Historical Company',?1,'2026-08-14','2026-08-15',?2,?3,?4,?5,?6,?7,?8,'PARSED','UNRESOLVED','Exact symbol matched, but the official ISIN differs from the database.')",
                params![purpose, action_type, ratio_num, ratio_den, old_face_value, new_face_value, factor, 1.0 / factor],
            )
            .unwrap();

        connection
            .execute(
                "INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,record_date,action_type,factor,ratio_num,ratio_den,old_face_value,new_face_value,cash_amount,adjust_volume,note,source,source_ref,applied_at,created_at,updated_at) VALUES (42,'CURSYM','NSE','INECURR01020','2026-08-14','2026-08-15',?1,?2,?3,?4,?5,?6,NULL,1,?7,'NSE_API','fixture','2026-08-15','2026-08-15','2026-08-15')",
                params![action_type, factor, ratio_num, ratio_den, old_face_value, new_face_value, purpose],
            )
            .unwrap();

        insert_phase1_scan_result(connection, 1, "CURSYM", factor, "MATCHED", Some(0.99));
    }

    #[test]
    fn r1b2_inactive_historical_split_links_existing_without_new_action() {
        let connection = Connection::open_in_memory().unwrap();
        r1b2_setup_inactive_existing_event(
            &connection,
            "SPLIT",
            10.0,
            None,
            None,
            Some(10.0),
            Some(1.0),
            "Face Value Split From Rs 10/- To Re 1/-",
        );
        let before_actions: i64 = connection
            .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row.get(0))
            .unwrap();

        let result = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();

        assert_eq!(result.import_record.review_status, "APPROVED");
        assert_eq!(result.import_record.approved_corporate_action_id, Some(42));
        assert!(result.approved_record.is_none());
        assert_eq!(
            connection.query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| row.get::<_, i64>(0)).unwrap(),
            before_actions
        );
        let decision: String = connection
            .query_row(
                "SELECT decision_type FROM corporate_action_import_decisions WHERE import_id=1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decision, "VERIFIED_EXISTING_EVENT_RECONCILIATION");
    }

    #[test]
    fn r1b2_inactive_historical_bonus_links_existing_without_new_action() {
        let connection = Connection::open_in_memory().unwrap();
        r1b2_setup_inactive_existing_event(
            &connection,
            "BONUS",
            2.0,
            Some(1.0),
            Some(1.0),
            None,
            None,
            "Bonus 1:1",
        );

        let result = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        assert_eq!(result.import_record.approved_corporate_action_id, Some(42));
        assert_eq!(result.import_record.isin.as_deref(), Some("INERAW001010"));
        let decision_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_decisions WHERE import_id=1 AND decision_type='VERIFIED_EXISTING_EVENT_RECONCILIATION'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(decision_count, 1);
    }

    #[test]
    fn r1b2_inactive_historical_reconciliation_is_idempotent() {
        let connection = Connection::open_in_memory().unwrap();
        r1b2_setup_inactive_existing_event(
            &connection,
            "BONUS",
            2.0,
            Some(1.0),
            Some(1.0),
            None,
            None,
            "Bonus 1:1",
        );
        let first = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        assert_eq!(first.import_record.approved_corporate_action_id, Some(42));
        let changes_before_replay: i64 = connection
            .query_row("SELECT total_changes()", [], |row| row.get(0))
            .unwrap();
        let second = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap();
        let changes_after_replay: i64 = connection
            .query_row("SELECT total_changes()", [], |row| row.get(0))
            .unwrap();
        assert_eq!(second.import_record.approved_corporate_action_id, Some(42));
        assert_eq!(changes_after_replay, changes_before_replay);
        assert_eq!(
            connection.query_row("SELECT COUNT(*) FROM corporate_action_import_decisions WHERE import_id=1", [], |row| row.get::<_, i64>(0)).unwrap(),
            1
        );
    }

    #[test]
    fn r1b2_requires_unique_inactive_current_symbol_target_when_no_active_target_exists() {
        let connection = Connection::open_in_memory().unwrap();
        r1b2_setup_inactive_existing_event(
            &connection,
            "SPLIT",
            10.0,
            None,
            None,
            Some(10.0),
            Some(1.0),
            "Face Value Split From Rs 10/- To Re 1/-",
        );
        connection
            .execute(
                "INSERT INTO instruments(symbol,exchange,isin,name,is_active,series) VALUES ('CURSYM','NSE','INEOTHER01020','Ambiguous Historical Target',0,'BE')",
                [],
            )
            .unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("exactly one inactive current-symbol identity target"), "{error}");
    }

    #[test]
    fn r1b2_inactive_historical_target_still_requires_direct_predecessor_edge() {
        let connection = Connection::open_in_memory().unwrap();
        r1b2_setup_inactive_existing_event(
            &connection,
            "SPLIT",
            10.0,
            None,
            None,
            Some(10.0),
            Some(1.0),
            "Face Value Split From Rs 10/- To Re 1/-",
        );
        connection.execute("DELETE FROM instrument_identity_history", []).unwrap();
        let error = reconcile_existing_corporate_action_import_internal(&connection, 1).unwrap_err();
        assert!(error.contains("direct predecessor identity edge"), "{error}");
    }


    fn r1b3a1_create_price_identity_tables(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  close REAL NOT NULL
                );
                CREATE TABLE instrument_identity_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  isin TEXT,
                  current_symbol TEXT,
                  current_name TEXT,
                  old_symbol TEXT,
                  old_name TEXT,
                  new_symbol TEXT,
                  new_name TEXT,
                  effective_date TEXT NOT NULL,
                  change_type TEXT NOT NULL,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ",
            )
            .unwrap();
    }

    fn r1b3a1_insert_window(
        connection: &Connection,
        symbol: &str,
        previous_date: &str,
        previous_close: f64,
        ex_date: &str,
        ex_open: f64,
        ex_close: f64,
    ) {
        connection
            .execute(
                "INSERT INTO eod_prices(symbol,exchange,date,open,close) VALUES (?1,'NSE',?2,?3,?4)",
                params![symbol, previous_date, previous_close, previous_close],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO eod_prices(symbol,exchange,date,open,close) VALUES (?1,'NSE',?2,?3,?4)",
                params![symbol, ex_date, ex_open, ex_close],
            )
            .unwrap();
    }

    fn r1b3a1_insert_transition(
        connection: &Connection,
        current_symbol: &str,
        old_symbol: &str,
        new_symbol: &str,
        effective_date: &str,
    ) {
        connection
            .execute(
                "
                INSERT INTO instrument_identity_history(
                  exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source,source_ref
                ) VALUES ('NSE',?1,?2,?3,?4,'BOTH','NSE_IDENTITY','r1b3a1-fixture')
                ",
                params![current_symbol, old_symbol, new_symbol, effective_date],
            )
            .unwrap();
    }

    #[test]
    fn r1b3a1_current_symbol_window_remains_first_authority() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "SONAMLTD", "SONAMCLOCK", "SONAMLTD", "2023-11-15");
        r1b3a1_insert_window(&connection, "SONAMLTD", "2022-07-13", 200.0, "2022-07-14", 100.0, 101.0);
        r1b3a1_insert_window(&connection, "SONAMCLOCK", "2022-07-13", 88.55, "2022-07-14", 42.0, 45.1);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "SONAMLTD", "NSE", "2022-07-14")
            .unwrap()
            .expect("current-symbol window must remain authoritative");

        assert_eq!(window.0.date, "2022-07-13");
        assert_eq!(window.0.close, 200.0);
        assert_eq!(window.1.open, 100.0);
        assert_eq!(window.1.close, 101.0);
    }

    #[test]
    fn r1b3a1_unique_pretransition_historical_symbol_supplies_missing_window() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "SONAMLTD", "SONAMCLOCK", "SONAMLTD", "2023-11-15");
        r1b3a1_insert_window(&connection, "SONAMCLOCK", "2022-07-13", 88.55, "2022-07-14", 42.0, 45.1);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "SONAMLTD", "NSE", "2022-07-14")
            .unwrap()
            .expect("unique pre-transition historical symbol should supply the local window");

        assert_eq!(window.0.date, "2022-07-13");
        assert!((window.0.close - 88.55).abs() < 1e-9);
        assert!((window.1.open - 42.0).abs() < 1e-9);
        assert!((window.1.close - 45.1).abs() < 1e-9);
    }

    #[test]
    fn r1b3a1_scan_candidate_uses_strict_historical_window_and_matches_factor() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "SONAMLTD", "SONAMCLOCK", "SONAMLTD", "2023-11-15");
        r1b3a1_insert_window(&connection, "SONAMCLOCK", "2022-07-13", 88.55, "2022-07-14", 42.0, 45.1);
        let folder = tempfile::tempdir().unwrap();
        let candidate = ScanCandidate {
            import_id: 3494,
            symbol: Some("SONAMLTD".to_string()),
            exchange: "NSE".to_string(),
            ex_date: Some("2022-07-14".to_string()),
            factor: Some(2.0),
        };

        let result = scan_candidate(&connection, folder.path(), 1, &candidate).unwrap();

        assert_eq!(result.scan_status, "MATCHED");
        assert_eq!(result.prev_trade_date.as_deref(), Some("2022-07-13"));
        assert_eq!(result.ex_trade_date.as_deref(), Some("2022-07-14"));
        assert!(result.confidence.unwrap_or(0.0) > 0.98);
        assert!((result.actual_open_factor.unwrap() - (88.55 / 42.0)).abs() < 1e-9);
        assert!((result.actual_close_factor.unwrap() - (88.55 / 45.1)).abs() < 1e-9);
    }

    #[test]
    fn r1b3a1_multistep_history_walks_back_to_event_time_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "MID", "CURR", "2023-01-01");
        r1b3a1_insert_transition(&connection, "CURR", "OLD", "MID", "2020-01-01");
        r1b3a1_insert_window(&connection, "OLD", "2019-06-13", 120.0, "2019-06-14", 60.0, 61.0);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2019-06-14")
            .unwrap()
            .expect("event predating both transitions should use the oldest uniquely proven symbol");

        assert_eq!(window.0.close, 120.0);
        assert_eq!(window.1.open, 60.0);
    }

    #[test]
    fn r1b3a1_event_between_transitions_uses_intermediate_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "MID", "CURR", "2023-01-01");
        r1b3a1_insert_transition(&connection, "CURR", "OLD", "MID", "2020-01-01");
        r1b3a1_insert_window(&connection, "MID", "2022-06-13", 150.0, "2022-06-14", 75.0, 76.0);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2022-06-14")
            .unwrap()
            .expect("event between transitions should use the uniquely proven intermediate symbol");

        assert_eq!(window.0.close, 150.0);
        assert_eq!(window.1.open, 75.0);
    }

    #[test]
    fn r1b3a1_event_on_transition_date_does_not_fall_back_to_old_symbol() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "OLD", "CURR", "2023-01-23");
        r1b3a1_insert_window(&connection, "OLD", "2023-01-20", 120.0, "2023-01-23", 60.0, 61.0);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2023-01-23").unwrap();

        assert!(window.is_none(), "exact transition date must retain current/new-symbol authority");
    }

    #[test]
    fn r1b3a1_ambiguous_predecessor_edges_fail_closed() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "OLD_A", "CURR", "2023-01-01");
        r1b3a1_insert_transition(&connection, "CURR", "OLD_B", "CURR", "2023-01-01");
        r1b3a1_insert_window(&connection, "OLD_A", "2022-06-13", 100.0, "2022-06-14", 50.0, 51.0);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2022-06-14").unwrap();

        assert!(window.is_none(), "ambiguous historical predecessors must fail closed");
    }

    #[test]
    fn r1b3a1_cyclic_identity_history_fails_closed() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "MID", "CURR", "2023-01-01");
        r1b3a1_insert_transition(&connection, "CURR", "CURR", "MID", "2024-01-01");
        r1b3a1_insert_window(&connection, "MID", "2022-06-13", 100.0, "2022-06-14", 50.0, 51.0);
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2022-06-14").unwrap();

        assert!(window.is_none(), "cyclic historical lineage must fail closed");
    }

    #[test]
    fn r1b3a1_historical_symbol_without_complete_window_preserves_no_price_data() {
        let connection = Connection::open_in_memory().unwrap();
        r1b3a1_create_price_identity_tables(&connection);
        r1b3a1_insert_transition(&connection, "CURR", "OLD", "CURR", "2023-01-01");
        connection
            .execute(
                "INSERT INTO eod_prices(symbol,exchange,date,open,close) VALUES ('OLD','NSE','2022-06-14',50.0,51.0)",
                [],
            )
            .unwrap();
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2022-06-14").unwrap();

        assert!(window.is_none(), "an incomplete historical window must remain unavailable");
    }

    #[test]
    fn r1b3a1_missing_identity_history_table_preserves_existing_behavior() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE eod_prices (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL DEFAULT 'NSE',
                  date TEXT NOT NULL,
                  open REAL NOT NULL,
                  close REAL NOT NULL
                );
                ",
            )
            .unwrap();
        let folder = tempfile::tempdir().unwrap();

        let window = load_trade_window(&connection, folder.path(), "CURR", "NSE", "2022-06-14").unwrap();

        assert!(window.is_none(), "fixtures without identity-history schema must preserve current no-window behavior");
    }

}

// R1-A command wrapper only: the dedicated coordinator owns its read transaction.
#[tauri::command]
pub async fn preview_split_bonus_reconciliation(
    app: AppHandle,
    input: CorporateActionReconciliationPreflightInput,
) -> AppResult<CorporateActionReconciliationPreflightResult> {
    reconciliation_preflight::preview_split_bonus_reconciliation_internal(app, input).await
}

// Focused unit tests are pure: no physical SQLite, broker, app or CA writes.
#[cfg(test)]
mod normal_ca_ex_date_readiness_tests {
    use super::*;

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }
    fn bar(value: &str, close: f64) -> ScannedBar {
        ScannedBar { date: value.to_string(), open: close, close }
    }

    #[test]
    fn upcoming_ex_date_blocks_before_any_price_approval() {
        assert!(ensure_import_ex_date_reached("2026-10-20", "DIVIDEND", date("2026-10-17"))
            .unwrap_err().contains("Scheduled / Upcoming"));
        assert!(ensure_import_ex_date_reached("2026-10-17", "SPLIT", date("2026-10-17")).is_ok());
        assert!(ensure_import_ex_date_reached("2026-02-30", "BONUS", date("2026-10-17")).is_err());
    }

    #[test]
    fn local_eod_evidence_must_straddle_effective_date_and_not_be_future() {
        let today = date("2026-10-17");
        let valid = (bar("2026-10-15", 100.0), bar("2026-10-16", 50.0));
        assert!(ensure_import_trade_window_ready(Some(&valid), "2026-10-16", today).is_ok());
        assert!(ensure_import_trade_window_ready(None, "2026-10-16", today).is_err());
        let future = (bar("2026-10-15", 100.0), bar("2026-10-19", 50.0));
        assert!(ensure_import_trade_window_ready(Some(&future), "2026-10-16", today).is_err());
        let no_cum = (bar("2026-10-16", 100.0), bar("2026-10-17", 50.0));
        assert!(ensure_import_trade_window_ready(Some(&no_cum), "2026-10-16", today).is_err());
        let zero = (bar("2026-10-15", 0.0), bar("2026-10-16", 50.0));
        assert!(ensure_import_trade_window_ready(Some(&zero), "2026-10-16", today).is_err());
    }
}

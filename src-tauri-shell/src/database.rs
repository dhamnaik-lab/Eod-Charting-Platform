#[allow(unused_imports)]
pub use self::corporate_action_imports::{preview_split_bonus_reconciliation, CorporateActionReconciliationPreflightInput, CorporateActionReconciliationPreflightResult, CorporateActionReconciliationPreflightRow, CorporateActionReconciliationBlocker};
pub(crate) use self::connection_registry::peek_active_database_folder_read_only;
pub mod binary_eod;
pub(crate) mod storage_paths;
mod bootstrap;
#[cfg(test)]
mod bse_history_repair_acceptance;
mod bse_identity_imports;
mod connection_registry;
mod database_deletion;
pub(crate) use self::database_deletion::require_unblocked as require_database_not_marked;
pub(crate) mod database_use;
mod corporate_action_history;
mod corporate_action_imports;
mod daily_market_snapshot;
mod dnn_research_export;
pub mod eod_binary_state;
mod eod_data;
pub(crate) mod index_aliases;
mod instrument_mutations;
pub(crate) mod identity_evidence_resolver;
mod nse_identity_imports;
mod official_source_candidate_review;
mod official_source_candidate_validation;
mod official_source_discovery;
mod official_source_health;
mod official_source_urls;
mod official_source_version_history;
mod price_store_operation_lock;
mod quotes;
mod settings;
mod storage_mode;
mod symbol_search;
mod watchlists;

use crate::runtime::log_runtime_event;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[allow(unused_imports)]
pub use self::binary_eod::{get_binary_eod_status, migrate_to_binary_eod, validate_binary_parity};
pub(crate) use self::bootstrap::{load_db_stats, prepare_database_connection};
pub use self::bse_identity_imports::{
    apply_bse_current_universe_sync, download_bse_current_universe_master,
    preview_bse_current_universe_sync, list_bse_identity_apply_history,
    refresh_bse_name_history, preview_bse_name_history, apply_bse_name_history,
    list_bse_name_history_runs, get_bse_name_history_report,
};
pub use self::connection_registry::{
    activate_database_path, close_database, create_database_interactive, delete_database,
    get_app_snapshot, get_db_stats, open_database_interactive, remove_recent_database,
    ActiveDatabaseConnectionState,
};
pub use self::corporate_action_history::{
    list_corporate_action_activity_runs, list_corporate_action_validation_report_items,
    save_corporate_action_validation_report,
};
pub(crate) use self::connection_registry::{
    ensure_registry_initialized, get_active_database_file_path, get_app_snapshot_internal,
    invalidate_cached_db_stats, open_connection_for_folder, open_read_only_connection_for_folder,
    resolve_active_database_folder, with_active_connection,
};
pub use self::corporate_action_imports::{
    approve_corporate_action_import, approve_corporate_action_import_with_isin_mismatch,
    approve_corporate_action_import_with_price_validation_exception,
    approve_corporate_action_imports, approve_recommended_corporate_action_isin_mismatches,
    auto_approve_corporate_action_imports, backfill_historical_capital_actions_batch,
    backfill_historical_capital_actions_for_symbol, evaluate_simple_cash_dividend_prepared_scope,
    execute_simple_cash_dividend_write_stage, fetch_official_corporate_actions,
    cancel_official_corporate_action_fetch,
    get_corporate_action_imports_by_ids, refresh_corporate_action_import_classifications, import_corporate_actions_csv,
    list_corporate_action_event_identities, list_corporate_action_import_resolution_hints,
    list_corporate_action_import_resolution_suggestions, list_corporate_action_imports,
    list_corporate_action_scan_results, list_historical_capital_action_alias_candidates,
    list_historical_capital_action_backfill_runs,
    list_historical_capital_action_major_liquid_candidates,
    list_historical_capital_action_sparse_candidates, preview_corporate_action_repairs,
    quick_resolve_corporate_action_import, recheck_corporate_action_imports,
    reopen_corporate_action_informational_closure, resolve_corporate_action_import,
    run_corporate_action_scan, sync_corporate_action_informational_closures,
};
pub(crate) use self::corporate_action_imports::{
    try_run_controlled_identity_repair_maintenance, try_run_event_identity_resolution_maintenance,
    try_run_five_pair_consolidation_apply_maintenance, try_run_five_pair_consolidation_maintenance,
    try_run_historical_isin_bootstrap_maintenance,
};
pub use self::daily_market_snapshot::{cancel_daily_market_snapshot, get_daily_market_snapshot};
pub use self::dnn_research_export::export_dnn_research_dataset;
pub use self::eod_data::{get_eod_data, get_eod_data_binary};
pub use self::eod_data::{read_scan_bars_for_folder, ScanPriceBar};
use self::eod_data::{find_instrument_record, resolve_instrument_context};
pub use self::instrument_mutations::{apply_corporate_action, merge_symbols};
pub use self::nse_identity_imports::{
    apply_nse_current_universe_sync, apply_nse_historical_identity_archive, list_nse_identity_apply_history, list_nse_historical_identity_apply_history, get_nse_historical_identity_apply_report,
    download_nse_current_universe_master, download_nse_delisted_workbook,
    preview_nse_current_universe_sync, preview_nse_historical_identity_archive,
};
#[allow(unused_imports)]
pub use self::official_source_candidate_review::{
    apply_official_source_rollback_reviewed, create_official_source_rollback_review,
    find_official_source_replacement_candidates, list_official_source_history,
    promote_official_source_candidate_reviewed, record_official_source_candidate_decision,
    retry_official_source_post_health, ApplyOfficialSourceRollbackReviewedInput,
    CreateOfficialSourceRollbackReviewInput, FindOfficialSourceReplacementCandidatesInput,
    ListOfficialSourceHistoryInput, OfficialSourceCandidateDecision,
    OfficialSourceCandidateDecisionResult, OfficialSourceCandidateReviewPlan,
    OfficialSourcePostHealthResult, OfficialSourcePromotionResult,
    OfficialSourceReplacementCandidatesResult, OfficialSourceRollbackResult,
    OfficialSourceRollbackReview, PromoteOfficialSourceCandidateReviewedInput,
    RecordOfficialSourceCandidateDecisionInput, RetryOfficialSourcePostHealthInput,
};
#[allow(unused_imports)]
pub use self::official_source_health::{
    assess_identity_official_source_health, OfficialSourceHealthReport,
    OfficialSourceHealthResult,
};
#[allow(unused_imports)]
pub use self::official_source_version_history::{
    get_official_source_configuration_authority, save_official_source_urls_reviewed,
    ExpectedOfficialSourceRevision, OfficialSourceAuthorityEntry,
    OfficialSourceConfigurationAuthority, OfficialSourceHistoryEntry,
    SaveOfficialSourceUrlsReviewedInput, SaveOfficialSourceUrlsReviewedResult,
};
pub(crate) use self::price_store_operation_lock::{
    try_acquire_price_store_operation, PriceStoreOperationKind,
};
use self::quotes::{
    delete_quote_date_scope_internal, delete_quote_internal, delete_quote_range_internal,
    list_quotes_by_date_scope_internal, list_quotes_internal, recompute_prev_close_for_symbol,
    upsert_quote_internal, QuoteDeleteProgress,
};
pub use self::settings::{
    delete_layout, get_saved_layouts, get_setting, load_layout, save_layout, set_setting,
};
pub use self::storage_mode::{get_price_storage_mode, set_price_storage_mode, PriceStorageMode};
pub use self::symbol_search::{list_symbols, search_symbols};
pub use self::watchlists::{
    add_to_watchlist, apply_official_watchlist_update, create_watchlist, delete_watchlist,
    get_watchlists, remove_from_watchlist, rename_watchlist, replace_source_linked_watchlist,
};

const DATABASE_FILE_NAME: &str = "market-data.sqlite3";
const DATABASE_MANIFEST_FILE: &str = "database.json";
pub(crate) const DATABASE_REGISTRY_FILE: &str = "database-registry.json";
const LAYOUTS_SETTING_KEY: &str = "chart_layouts";
const LEGACY_DATA_MIGRATIONS_SETTING_KEY: &str = "migration.legacy_data_v1";
pub(crate) const INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY: &str =
    "migration.instrument_isin_history_backfill_v1";
pub(crate) const PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY: &str =
    "migration.pending_isin_mismatch_recheck_v1";
pub(crate) const CORPORATE_ACTION_IMPORT_EVIDENCE_BACKFILL_SETTING_KEY: &str =
    "migration.corporate_action_import_evidence_backfill_v1";

type AppResult<T> = Result<T, String>;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuoteDeleteProgressEvent {
    processed_files: usize,
    total_files: usize,
    current_symbol: Option<String>,
    percent: u8,
    message: String,
}

fn format_quote_delete_details(
    kind: &str,
    symbol: Option<&str>,
    exchange: &str,
    from_date: &str,
    to_date: Option<&str>,
    deleted: Option<i64>,
    elapsed_ms: Option<u128>,
) -> String {
    let mut details = format!("kind={kind} exchange={exchange}");
    if let Some(symbol) = symbol.filter(|value| !value.trim().is_empty()) {
        details.push_str(&format!(" symbol={symbol}"));
    }
    details.push_str(&format!(" fromDate={from_date}"));
    if let Some(to_date) = to_date.filter(|value| !value.trim().is_empty()) {
        details.push_str(&format!(" toDate={to_date}"));
    }
    if let Some(deleted) = deleted {
        details.push_str(&format!(" deleted={deleted}"));
    }
    if let Some(elapsed_ms) = elapsed_ms {
        details.push_str(&format!(" elapsedMs={elapsed_ms}"));
    }
    details
}

fn format_quote_load_details(
    kind: &str,
    symbol: Option<&str>,
    exchange: &str,
    date: Option<&str>,
    rows: Option<usize>,
    elapsed_ms: Option<u128>,
) -> String {
    let mut details = format!("kind={kind} exchange={exchange}");
    if let Some(symbol) = symbol.filter(|value| !value.trim().is_empty()) {
        details.push_str(&format!(" symbol={symbol}"));
    }
    if let Some(date) = date.filter(|value| !value.trim().is_empty()) {
        details.push_str(&format!(" date={date}"));
    }
    if let Some(rows) = rows {
        details.push_str(&format!(" rows={rows}"));
    }
    if let Some(elapsed_ms) = elapsed_ms {
        details.push_str(&format!(" elapsedMs={elapsed_ms}"));
    }
    details
}

fn format_quote_exchange_delete_counts(exchange_deleted: &[(String, i64)]) -> String {
    exchange_deleted
        .iter()
        .map(|(exchange, deleted)| format!("{exchange}:{deleted}"))
        .collect::<Vec<_>>()
        .join(",")
}

#[cfg(test)]
mod quote_editor_audit_tests {
    use super::{format_quote_exchange_delete_counts, format_quote_load_details};

    #[test]
    fn quote_editor_audit_load_details_include_scope_rows_and_elapsed_time() {
        let details = format_quote_load_details(
            "all-symbols-date",
            None,
            "ALL",
            Some("2026-08-20"),
            Some(8_803),
            Some(125),
        );
        assert_eq!(
            details,
            "kind=all-symbols-date exchange=ALL date=2026-08-20 rows=8803 elapsedMs=125"
        );
    }

    #[test]
    fn quote_editor_audit_delete_counts_preserve_bounded_exchange_order() {
        let details = format_quote_exchange_delete_counts(&[
            ("NSE".to_string(), 3),
            ("NSE_INDEX".to_string(), 1),
            ("BSE".to_string(), 2),
            ("BSE_INDEX".to_string(), 0),
            ("MCX".to_string(), 0),
        ]);
        assert_eq!(details, "NSE:3,NSE_INDEX:1,BSE:2,BSE_INDEX:0,MCX:0");
    }
}

fn format_quote_write_details(
    kind: &str,
    symbol: &str,
    exchange: &str,
    date: &str,
    elapsed_ms: Option<u128>,
) -> String {
    let mut details = format!("kind={kind} exchange={exchange} symbol={symbol} date={date}");
    if let Some(elapsed_ms) = elapsed_ms {
        details.push_str(&format!(" elapsedMs={elapsed_ms}"));
    }
    details
}

fn emit_quote_delete_progress(app: &AppHandle, progress: QuoteDeleteProgress) {
    let percent = if progress.total_files == 0 {
        100
    } else {
        (((progress.processed_files as f64 / progress.total_files as f64) * 100.0).round() as u8)
            .min(100)
    };
    let message = if let Some(symbol) = progress
        .current_symbol
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        format!(
            "Deleting quote files {}/{} ({percent}%) - {}",
            progress.processed_files, progress.total_files, symbol
        )
    } else {
        format!(
            "Deleting quote files {}/{} ({percent}%)",
            progress.processed_files, progress.total_files
        )
    };
    let _ = app.emit(
        "quote-delete:progress",
        QuoteDeleteProgressEvent {
            processed_files: progress.processed_files,
            total_files: progress.total_files,
            current_symbol: progress.current_symbol,
            percent,
            message,
        },
    );
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownDatabase {
    pub path: String,
    pub label: String,
    pub last_opened_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStats {
    pub db_name: String,
    pub db_size_mb: f64,
    pub symbol_count: i64,
    pub bar_count: i64,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistItem {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistSourceMeta {
    pub source_type: String,
    pub source_exchange: String,
    pub source_group_type: String,
    pub source_key: String,
    pub source_display_name: String,
    pub last_synced_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Watchlist {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_meta: Option<WatchlistSourceMeta>,
    pub items: Vec<WatchlistItem>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub active_database_path: Option<String>,
    pub known_databases: Vec<KnownDatabase>,
    pub db_stats: Option<DbStats>,
    pub watchlists: Vec<Watchlist>,
    pub theme: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotOptions {
    pub include_stats: Option<bool>,
    pub include_watchlists: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentSummary {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub is_active: bool,
    pub lifecycle_status: Option<String>,
    pub last_price_date: Option<String>,
    pub exchange_latest_price_date: Option<String>,
    pub resolved_from_alias: Option<bool>,
    pub matched_symbol: Option<String>,
    pub matched_name: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EodRow {
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: i64,
    pub open_interest: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartEventRecord {
    pub id: String,
    pub effective_date: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub label: String,
    pub description: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EodDataResult {
    pub requested_symbol: String,
    pub requested_exchange: String,
    pub adjusted: bool,
    pub include_dividend_adjustments: bool,
    pub include_rights_adjustments: bool,
    pub instrument: Option<InstrumentSummary>,
    pub bars: Vec<EodRow>,
    pub events: Vec<ChartEventRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteRow {
    pub symbol: String,
    pub exchange: String,
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: i64,
    pub open_interest: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct OperationResult {
    pub success: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuoteResult {
    pub success: bool,
    pub deleted: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeSymbolsResult {
    pub merged_rows: i64,
    pub merged_watchlist_items: i64,
    pub target_symbol: String,
    pub target_exchange: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionResult {
    pub stored_record_id: i64,
    pub action_type: String,
    pub exchange: String,
    pub effective_date: String,
    pub current_symbol: String,
    pub current_name: Option<String>,
    pub factor: Option<f64>,
    pub affected_rows: i64,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionCsvImportInput {
    pub file_path: String,
    pub exchange: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionOfficialFetchInput {
    pub exchange: String,
    pub from_date: String,
    pub to_date: String,
    pub force_refresh: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillInput {
    pub exchange: String,
    pub symbol: String,
    pub from_date: String,
    pub to_date: String,
    pub bse_scrip_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillBatchSymbolInput {
    pub symbol: String,
    pub bse_scrip_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillBatchInput {
    pub exchange: String,
    pub from_date: String,
    pub to_date: String,
    pub symbols: Vec<HistoricalCapitalActionBackfillBatchSymbolInput>,
    pub stop_on_error: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionSparseCandidateInput {
    pub exchange: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionAliasCandidateInput {
    pub exchange: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionMajorLiquidCandidateInput {
    pub exchange: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportListInput {
    pub review_status: Option<String>,
    pub action_types: Option<Vec<String>>,
    pub search_query: Option<String>,
    pub exclude_approved: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportLookupInput {
    pub import_ids: Vec<i64>,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportApprovalInput {
    pub import_id: i64,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkApprovalInput {
    pub import_ids: Vec<i64>,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionAutoApprovalInput {
    pub import_ids: Vec<i64>,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendPreparedScopeEvaluationInput {
    pub import_ids: Vec<i64>,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendWriteStageInput {
    pub import_ids: Vec<i64>,
    pub expected_database_path: String,
    pub expected_policy_version: String,
    pub expected_scope_version: String,
    pub expected_write_stage_version: String,
    pub expected_scope_fingerprint: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkRecheckInput {
    pub import_ids: Vec<i64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionHintsInput {
    pub import_ids: Vec<i64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionSuggestionsInput {
    pub import_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolveInput {
    pub import_id: i64,
    pub symbol: Option<String>,
    pub exchange: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportExceptionalApprovalInput {
    pub import_id: i64,
    pub reason: String,
    pub expected_database_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportQuickResolveInput {
    pub import_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentityListInput {
    pub import_ids: Vec<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentity {
    pub import_id: i64,
    pub exchange: String,
    pub raw_symbol: Option<String>,
    pub raw_isin: Option<String>,
    pub event_symbol: Option<String>,
    pub event_isin: Option<String>,
    pub resolved: bool,
    pub resolution_type: Option<String>,
    pub resolution_authority: Option<String>,
    pub chain_id: Option<String>,
    pub transition_old_symbol: Option<String>,
    pub transition_new_symbol: Option<String>,
    pub transition_effective_date: Option<String>,
    pub raw_identity_source_ref: Option<String>,
    pub raw_identity_source_sha256: Option<String>,
    pub raw_identity_source_line_number: Option<i64>,
    pub resolution_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionEventIdentityListResult {
    pub requested: u32,
    pub identities: Vec<CorporateActionEventIdentity>,
    pub existing_dividends: Vec<CorporateActionExistingDividend>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionExistingDividend {
    pub import_id: i64,
    pub corporate_action_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairPreviewInput {
    pub import_ids: Vec<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairSourceIdentity {
    pub exchange: String,
    pub source: String,
    pub source_file: Option<String>,
    pub symbol: Option<String>,
    pub isin: Option<String>,
    pub bse_scrip_code: Option<String>,
    pub company_name: Option<String>,
    pub ex_date: Option<String>,
    pub record_date: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairImportValues {
    pub import_id: i64,
    pub dedupe_key: String,
    pub purpose_raw: String,
    pub action_type: String,
    pub ratio_num: Option<f64>,
    pub ratio_den: Option<f64>,
    pub old_face_value: Option<f64>,
    pub new_face_value: Option<f64>,
    pub cash_amount: Option<f64>,
    pub factor: Option<f64>,
    pub price_factor: Option<f64>,
    pub parse_status: String,
    pub review_status: String,
    pub message: Option<String>,
    pub approved_corporate_action_id: Option<i64>,
    pub imported_at: String,
    pub approved_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairCanonicalValues {
    pub id: i64,
    pub symbol: String,
    pub exchange: String,
    pub isin: Option<String>,
    pub effective_date: String,
    pub record_date: Option<String>,
    pub action_type: String,
    pub factor: f64,
    pub ratio_num: Option<f64>,
    pub ratio_den: Option<f64>,
    pub old_face_value: Option<f64>,
    pub new_face_value: Option<f64>,
    pub cash_amount: Option<f64>,
    pub adjust_volume: bool,
    pub note: Option<String>,
    pub source: Option<String>,
    pub source_ref: Option<String>,
    pub applied_at: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairEvidenceRecord {
    pub id: i64,
    pub source_code: String,
    pub source_locator: Option<String>,
    pub captured_at: String,
    pub symbol_seen: Option<String>,
    pub isin_seen: Option<String>,
    pub company_name_seen: Option<String>,
    pub action_type_seen: Option<String>,
    pub event_date_seen: Option<String>,
    pub factor_seen: Option<f64>,
    pub raw_reference: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairProposalRow {
    pub action_type: String,
    pub disposition: String,
    pub current_canonical_id: Option<i64>,
    pub factor: Option<f64>,
    pub factor_derivation: Option<String>,
    pub ratio_num: Option<f64>,
    pub ratio_den: Option<f64>,
    pub old_face_value: Option<f64>,
    pub new_face_value: Option<f64>,
    pub cash_amount: Option<f64>,
    pub confidence: String,
    pub manual_review_required: bool,
    pub blocking_reasons: Vec<String>,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairPreviewRow {
    pub import_id: i64,
    pub row_fingerprint: String,
    pub evidence_grade: String,
    pub source_identity: CorporateActionRepairSourceIdentity,
    pub current_import: CorporateActionRepairImportValues,
    pub current_canonical: Option<CorporateActionRepairCanonicalValues>,
    pub current_same_date_canonical_actions: Vec<CorporateActionRepairCanonicalValues>,
    pub evidence: Vec<CorporateActionRepairEvidenceRecord>,
    pub proposed_outcomes: Vec<CorporateActionRepairProposalRow>,
    pub confidence: String,
    pub manual_review_required: bool,
    pub repair_blocked: bool,
    pub blocking_reasons: Vec<String>,
    pub previewable: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionRepairPreviewResult {
    pub requested: u32,
    pub unique_requested: u32,
    pub missing_import_ids: Vec<i64>,
    pub previewable: u32,
    pub blocked: u32,
    pub database_query_only: bool,
    pub fingerprint_version: String,
    pub fingerprint_fields: Vec<String>,
    pub rows: Vec<CorporateActionRepairPreviewRow>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionHint {
    pub import_id: i64,
    pub status: String,
    pub quick_resolvable: bool,
    pub active_suggestion_count: u32,
    pub total_suggestion_count: u32,
    pub top_suggestion_symbol: Option<String>,
    pub top_suggestion_exchange: Option<String>,
    pub recommended_isin_exception: bool,
    pub recommendation_reason: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionHintsResult {
    pub requested: u32,
    pub hints: Vec<CorporateActionImportResolutionHint>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionSuggestion {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub is_active: bool,
    pub has_event_date_isin_evidence: bool,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolutionSuggestionsResult {
    pub import_record: CorporateActionImportRow,
    pub suggestions: Vec<CorporateActionImportResolutionSuggestion>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportResolveResult {
    pub import_record: CorporateActionImportRow,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkRecheckError {
    pub import_id: i64,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkRecheckResult {
    pub requested: u32,
    pub rechecked: u32,
    pub reviewable: u32,
    pub still_unresolved: u32,
    pub failed: u32,
    pub results: Vec<CorporateActionImportResolveResult>,
    pub errors: Vec<CorporateActionImportBulkRecheckError>,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityPreviewInput {
    pub archive_root_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityApplyInput {
    pub archive_root_path: Option<String>,
    pub expected_plan_sha256: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityPreviewRow {
    pub disposition: String,
    pub change_type: String,
    pub effective_date: Option<String>,
    pub old_symbol: Option<String>,
    pub new_symbol: Option<String>,
    pub current_symbol: Option<String>,
    pub old_name: Option<String>,
    pub new_name: Option<String>,
    pub source_file: String,
    pub detail: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseSyncInput {
    pub archive_root_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseApplyInput {
    pub archive_root_path: Option<String>,
    pub expected_plan_sha256: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseDelistedWorkbookDownloadResult {
    pub file_path: String,
    pub source_url: String,
    pub symbols_read: u32,
    pub bytes_written: u64,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseMasterDownloadResult {
    pub equity_file_path: String,
    pub sme_file_path: String,
    pub symbol_change_file_path: String,
    pub company_name_change_file_path: String,
    pub equity_rows_read: u32,
    pub sme_rows_read: u32,
    pub symbol_change_rows_read: u32,
    pub company_name_change_rows_read: u32,
    pub bytes_written: u64,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BseCurrentUniverseSyncInput {
    pub master_file_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BseCurrentUniverseApplyInput {
    pub master_file_path: String,
    pub expected_plan_sha256: String,
    pub expected_database_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityApplyProgress {
    pub stage: &'static str,
    pub processed: usize,
    pub total: usize,
    pub percent: Option<u32>,
}

fn check_identity_reviewed_database_path(folder: &Path, expected: &str) -> AppResult<()> {
    let expected = std::fs::canonicalize(expected)
        .map_err(|_| "IDENTITY_REVIEWED_DATABASE_STALE: Preview the active database again.".to_string())?;
    let actual = std::fs::canonicalize(folder).map_err(|error| error.to_string())?;
    if actual != expected {
        return Err("IDENTITY_REVIEWED_DATABASE_STALE: Active database changed; preview again.".into());
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseHistoricalIdentityResult {
    pub run_id: Option<String>,
    pub completed_at: Option<String>,
    pub refresh_warning: Option<String>,
    pub category_evidence: Option<std::collections::BTreeMap<String, nse_identity_imports::historical_categories::CategoryEvidence>>,
    pub archive_root_path: String,
    pub applied: bool,
    pub can_apply: bool,
    pub plan_sha256: String,
    pub securities_available_sha256: String,
    pub symbol_changes_sha256: String,
    pub company_name_changes_sha256: String,
    pub master_rows_read: u32,
    pub master_rows_planned: u32,
    pub current_equity_symbols: u32,
    pub symbol_change_rows_read: u32,
    pub name_change_rows_read: u32,
    pub new_symbol_changes: u32,
    pub new_name_changes: u32,
    pub new_combined_changes: u32,
    pub duplicate_rows: u32,
    pub skipped_rows: u32,
    pub error_rows: u32,
    pub current_universe_plan_sha256: Option<String>,
    pub active_sync_activate_count: u32,
    pub active_sync_update_count: u32,
    pub active_sync_deactivate_count: u32,
    pub active_sync_unchanged_count: u32,
    pub history_rows: Vec<NseHistoricalIdentityPreviewRow>,
    pub current_universe_preview_rows: Vec<NseCurrentUniverseSyncPreviewRow>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseSyncPreviewRow {
    pub action: String,
    pub symbol: String,
    pub company_name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub current_status: String,
    pub proposed_status: String,
    pub matched_symbol: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NseCurrentUniverseSyncResult {
    pub run_id: Option<String>,
    pub completed_at: Option<String>,
    pub refresh_warning: Option<String>,
    pub archive_root_path: String,
    pub applied: bool,
    pub master_rows_read: u32,
    pub current_universe_symbols: u32,
    pub matched_by_symbol: u32,
    pub matched_by_isin: u32,
    pub matched_by_identity: u32,
    pub new_symbols: u32,
    pub activate_count: u32,
    pub update_count: u32,
    pub deactivate_count: u32,
    pub unchanged_active: u32,
    pub identity_history_rows: u32,
    pub official_delisted_symbols: u32,
    pub preview_rows: Vec<NseCurrentUniverseSyncPreviewRow>,
    pub plan_sha256: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BseCurrentUniverseSyncPreviewRow {
    pub action: String,
    pub symbol: String,
    pub security_code: Option<String>,
    pub company_name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub current_status: String,
    pub proposed_status: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BseCurrentUniverseSyncResult {
    pub run_id: Option<String>,
    pub completed_at: Option<String>,
    pub refresh_warning: Option<String>,
    pub plan_sha256: String,
    pub master_sha256: String,
    pub new_symbols: u32,
    pub master_file_path: String,
    pub applied: bool,
    pub master_rows_read: u32,
    pub current_universe_symbols: u32,
    pub activate_count: u32,
    pub update_count: u32,
    pub deactivate_count: u32,
    pub unchanged_active: u32,
    pub preview_rows: Vec<BseCurrentUniverseSyncPreviewRow>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BseCurrentUniverseMasterDownloadResult {
    pub file_path: String,
    pub source_url: String,
    pub rows_read: u32,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionScanInput {
    pub scope: Option<String>,
    pub import_ids: Option<Vec<i64>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionScanListInput {
    pub scan_run_id: Option<i64>,
    pub import_ids: Option<Vec<i64>>,
    pub search_query: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportRow {
    /// Fresh verified target only; raw identity and its activity remain unchanged.
    pub verified_adjustment_target: Option<String>,
    /// Presentation metadata only; no financial authority or persisted status.
    pub instrument_is_active: Option<bool>,
    pub id: i64,
    pub exchange: String,
    pub source: String,
    pub source_file: Option<String>,
    pub symbol: Option<String>,
    pub isin: Option<String>,
    pub bse_scrip_code: Option<String>,
    pub company_name: Option<String>,
    pub purpose_raw: String,
    pub ex_date: Option<String>,
    pub record_date: Option<String>,
    pub action_type: String,
    pub ratio_num: Option<f64>,
    pub ratio_den: Option<f64>,
    pub old_face_value: Option<f64>,
    pub new_face_value: Option<f64>,
    pub cash_amount: Option<f64>,
    pub factor: Option<f64>,
    pub price_factor: Option<f64>,
    pub parse_status: String,
    pub review_status: String,
    pub message: Option<String>,
    pub approved_corporate_action_id: Option<i64>,
    pub imported_at: String,
    pub approved_at: Option<String>,
    pub evidence_count: u32,
    pub evidence_sources: Vec<String>,
    pub latest_evidence_captured_at: Option<String>,
    pub latest_evidence_source_locator: Option<String>,
    pub latest_evidence_note: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionCsvImportResult {
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub imports: Vec<CorporateActionImportRow>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionOfficialFetchResult {
    pub exchange: String,
    pub source: String,
    pub from_date: String,
    pub to_date: String,
    pub requested_days: u32,
    pub cached_days: u32,
    pub fetched_days: u32,
    pub fetched_ranges: u32,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub imports: Vec<CorporateActionImportRow>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillSourceAttempt {
    pub source: String,
    pub requested_symbol: Option<String>,
    pub source_locator: Option<String>,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_evidence_attached: u32,
    pub rows_error: u32,
    pub earliest_ex_date: Option<String>,
    pub latest_ex_date: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillResult {
    pub exchange: String,
    pub requested_symbol: String,
    pub canonical_symbol: Option<String>,
    pub from_date: String,
    pub to_date: String,
    pub searched_symbols: Vec<String>,
    pub bse_scrip_code: Option<String>,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_evidence_attached: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub parse_status_counts: HashMap<String, u32>,
    pub review_status_counts: HashMap<String, u32>,
    pub imports: Vec<CorporateActionImportRow>,
    pub source_attempts: Vec<HistoricalCapitalActionBackfillSourceAttempt>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillBatchSymbolResult {
    pub run_symbol_id: Option<i64>,
    pub symbol: String,
    pub status: String,
    pub bse_scrip_code: Option<String>,
    pub result: Option<HistoricalCapitalActionBackfillResult>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillBatchResult {
    pub run_id: Option<i64>,
    pub exchange: String,
    pub from_date: String,
    pub to_date: String,
    pub requested_symbols: Vec<String>,
    pub total_symbols: u32,
    pub completed_symbols: u32,
    pub failed_symbols: u32,
    pub stopped_on_error: bool,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_evidence_attached: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub parse_status_counts: HashMap<String, u32>,
    pub review_status_counts: HashMap<String, u32>,
    pub symbol_results: Vec<HistoricalCapitalActionBackfillBatchSymbolResult>,
    pub errors: Vec<String>,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillRunListInput {
    pub status: Option<String>,
    pub search_query: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillRunSymbolRow {
    pub id: i64,
    pub run_id: i64,
    pub symbol: String,
    pub canonical_symbol: Option<String>,
    pub bse_scrip_code: Option<String>,
    pub status: String,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_evidence_attached: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub parse_status_counts: HashMap<String, u32>,
    pub review_status_counts: HashMap<String, u32>,
    pub warning_count: u32,
    pub error_message: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub message: Option<String>,
    pub outcomes: Vec<HistoricalCapitalActionBackfillRunOutcomeRow>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillRunOutcomeRow {
    pub id: i64,
    pub run_symbol_id: i64,
    pub source: String,
    pub requested_symbol: Option<String>,
    pub source_locator: Option<String>,
    pub outcome: String,
    pub import_id: Option<i64>,
    pub evidence_id: Option<i64>,
    pub action_type: Option<String>,
    pub parse_status: Option<String>,
    pub review_status: Option<String>,
    pub message: Option<String>,
    pub evidence_symbol_seen: Option<String>,
    pub evidence_isin_seen: Option<String>,
    pub evidence_company_name_seen: Option<String>,
    pub evidence_raw_reference: Option<String>,
    pub evidence_note: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillRunRow {
    pub id: i64,
    pub exchange: String,
    pub from_date: String,
    pub to_date: String,
    pub requested_symbols: Vec<String>,
    pub stop_on_error: bool,
    pub status: String,
    pub total_symbols: u32,
    pub completed_symbols: u32,
    pub failed_symbols: u32,
    pub rows_read: u32,
    pub rows_inserted: u32,
    pub rows_duplicate: u32,
    pub rows_evidence_attached: u32,
    pub rows_error: u32,
    pub rows_unresolved: u32,
    pub rows_parsed: u32,
    pub rows_unsupported: u32,
    pub parse_status_counts: HashMap<String, u32>,
    pub review_status_counts: HashMap<String, u32>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub message: Option<String>,
    pub symbols: Vec<HistoricalCapitalActionBackfillRunSymbolRow>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionBackfillRunListResult {
    pub runs: Vec<HistoricalCapitalActionBackfillRunRow>,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
    pub has_more: bool,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionSparseCandidate {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub first_price_date: Option<String>,
    pub approved_capital_actions: u32,
    pub imported_capital_actions: u32,
    pub unresolved_import_rows: u32,
    pub first_known_capital_action_date: Option<String>,
    pub last_known_capital_action_date: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionSparseCandidateResult {
    pub candidates: Vec<HistoricalCapitalActionSparseCandidate>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionAliasCandidate {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub old_symbols: Vec<String>,
    pub alias_count: u32,
    pub earliest_alias_date: Option<String>,
    pub latest_alias_date: Option<String>,
    pub first_price_date: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionAliasCandidateResult {
    pub candidates: Vec<HistoricalCapitalActionAliasCandidate>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionMajorLiquidCandidate {
    pub symbol: String,
    pub exchange: String,
    pub name: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub first_price_date: Option<String>,
    pub last_price_date: Option<String>,
    pub bar_count: u32,
    pub recent_bar_count: u32,
    pub average_recent_turnover: f64,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalCapitalActionMajorLiquidCandidateResult {
    pub candidates: Vec<HistoricalCapitalActionMajorLiquidCandidate>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportApprovalResult {
    pub import_record: CorporateActionImportRow,
    pub approved_record: Option<CorporateActionResult>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkApprovalError {
    pub import_id: i64,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionImportBulkApprovalResult {
    pub requested: u32,
    pub approved: u32,
    pub linked_existing: u32,
    pub already_approved: u32,
    pub failed: u32,
    pub results: Vec<CorporateActionImportApprovalResult>,
    pub errors: Vec<CorporateActionImportBulkApprovalError>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionAutoApprovalDisposition {
    pub import_id: i64,
    pub disposition: String,
    pub reason: String,
    pub import_record: Option<CorporateActionImportRow>,
    pub approved_record: Option<CorporateActionResult>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionAutoApprovalResult {
    pub requested: u32,
    pub eligible: u32,
    pub auto_approved: u32,
    pub linked_existing: u32,
    pub already_approved: u32,
    pub skipped: u32,
    pub failed: u32,
    pub dispositions: Vec<CorporateActionAutoApprovalDisposition>,
    pub policy_version: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendPreparedScopeEvaluationEvidence {
    pub identity_proof: String,
    pub official_evidence_id: i64,
    pub evidence_captured_at: String,
    pub source_locator: Option<String>,
    pub cash_amount: f64,
    pub previous_trade_date: String,
    pub previous_close: f64,
    pub computed_factor: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendPreparedScopeEvaluationDisposition {
    pub import_id: i64,
    pub disposition: String,
    pub reason: String,
    pub current_action_type: Option<String>,
    pub current_parse_status: Option<String>,
    pub current_review_status: Option<String>,
    pub evidence: Option<CorporateActionDividendPreparedScopeEvaluationEvidence>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendPreparedScopeEvaluationResult {
    pub requested: u32,
    pub reused_count: u32,
    pub eligible: u32,
    pub ineligible: u32,
    pub already_approved: u32,
    pub stale_scope: u32,
    pub missing: u32,
    pub failed: u32,
    pub dispositions: Vec<CorporateActionDividendPreparedScopeEvaluationDisposition>,
    pub policy_version: String,
    pub scope_version: String,
    pub scope_fingerprint: String,
    pub complete: bool,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendWriteStageDisposition {
    pub import_id: i64,
    pub disposition: String,
    pub reason: String,
    pub corporate_action_id: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionDividendWriteStageResult {
    pub requested: u32,
    pub revalidated_eligible: u32,
    pub auto_approved: u32,
    pub ineligible: u32,
    pub already_approved: u32,
    pub stale_scope: u32,
    pub missing: u32,
    pub failed: u32,
    pub dispositions: Vec<CorporateActionDividendWriteStageDisposition>,
    pub policy_version: String,
    pub scope_version: String,
    pub write_stage_version: String,
    pub scope_fingerprint: String,
    pub complete: bool,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionScanRun {
    pub id: i64,
    pub scope: String,
    pub action_types: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub status: String,
    pub message: Option<String>,
    pub total_results: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionScanResultRow {
    pub id: i64,
    pub scan_run_id: i64,
    pub corporate_action_import_id: Option<i64>,
    pub corporate_action_id: Option<i64>,
    pub symbol: Option<String>,
    pub exchange: String,
    pub scan_status: String,
    pub prev_trade_date: Option<String>,
    pub ex_trade_date: Option<String>,
    pub prev_close: Option<f64>,
    pub ex_open: Option<f64>,
    pub ex_close: Option<f64>,
    pub expected_factor: Option<f64>,
    pub actual_open_factor: Option<f64>,
    pub actual_close_factor: Option<f64>,
    pub confidence: Option<f64>,
    pub message: Option<String>,
    pub scanned_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionScanResult {
    pub scan_run: Option<CorporateActionScanRun>,
    pub results: Vec<CorporateActionScanResultRow>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLayoutSummary {
    pub name: String,
    pub timestamp: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedLayoutRecord {
    name: String,
    timestamp: String,
    data: String,
}

#[derive(Clone, Debug)]
struct InstrumentRecord {
    symbol: String,
    exchange: String,
    isin: Option<String>,
    name: Option<String>,
    series: Option<String>,
    is_active: bool,
    lifecycle_status: Option<String>,
    last_price_date: Option<String>,
    exchange_latest_price_date: Option<String>,
    sector: Option<String>,
    industry: Option<String>,
}

#[derive(Clone, Debug)]
struct IdentityHistoryRow {
    id: i64,
    exchange: String,
    isin: Option<String>,
    current_symbol: Option<String>,
    current_name: Option<String>,
    old_symbol: Option<String>,
    old_name: Option<String>,
    new_symbol: Option<String>,
    new_name: Option<String>,
    effective_date: String,
    change_type: String,
}

#[derive(Clone, Debug)]
struct CorporateActionRow {
    id: i64,
    effective_date: String,
    action_type: String,
    factor: f64,
    adjust_volume: i64,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    old_face_value: Option<f64>,
    new_face_value: Option<f64>,
    cash_amount: Option<f64>,
    source: Option<String>,
}

#[derive(Clone, Debug)]
struct SymbolTransition {
    effective_date: String,
    old_symbol: Option<String>,
    new_symbol: Option<String>,
}

#[derive(Clone, Debug)]
struct ResolvedInstrumentContext {
    requested_symbol: String,
    exchange: String,
    current_symbol: String,
    current_name: Option<String>,
    isin: Option<String>,
    current_instrument: Option<InstrumentRecord>,
    related_symbols: Vec<String>,
    identity_history: Vec<IdentityHistoryRow>,
    symbol_transitions: Vec<SymbolTransition>,
    corporate_actions: Vec<CorporateActionRow>,
    resolved_from_alias: bool,
}

#[derive(Clone, Debug)]
struct PriceRow {
    symbol: String,
    date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    prev_close: Option<f64>,
    volume: i64,
    open_interest: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathInput {
    pub file_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SymbolSeriesFilter {
    All,
    NseEquity,
    NseEq,
    NseEqTradeForTrade,
    NseSme,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSymbolsInput {
    pub query: String,
    pub exchange: Option<String>,
    pub limit: Option<u32>,
    pub series_filter: Option<SymbolSeriesFilter>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSymbolsInput {
    pub query: Option<String>,
    pub exchange: Option<String>,
    pub limit: Option<u32>,
    pub series_filter: Option<SymbolSeriesFilter>,
    pub include_inactive: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EodDataInputPayload {
    pub symbol: String,
    pub exchange: String,
    pub from: Option<String>,
    pub to: Option<String>,
    pub adjusted: Option<bool>,
    pub include_dividend_adjustments: Option<bool>,
    pub include_rights_adjustments: Option<bool>,
    pub resolve_identity: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteListInput {
    pub symbol: String,
    pub exchange: String,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteDateListInput {
    pub exchange: String,
    pub date: String,
    pub limit: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteInputPayload {
    pub symbol: String,
    pub exchange: String,
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub open_interest: Option<f64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuoteInput {
    pub symbol: String,
    pub exchange: String,
    pub date: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuoteRangeInput {
    pub symbol: String,
    pub exchange: String,
    pub from_date: String,
    pub to_date: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuoteDateInput {
    pub exchange: String,
    pub date: String,
    pub to_date: Option<String>,
    pub symbols: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeSymbolsInput {
    pub source_symbol: String,
    pub source_exchange: String,
    pub target_symbol: String,
    pub target_exchange: String,
    pub target_name: Option<String>,
    pub overwrite_duplicates: Option<bool>,
    pub delete_source_after_merge: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionInputPayload {
    pub action_type: String,
    pub exchange: String,
    pub effective_date: String,
    pub symbol: Option<String>,
    pub isin: Option<String>,
    pub record_date: Option<String>,
    pub ratio_num: Option<f64>,
    pub ratio_den: Option<f64>,
    pub old_face_value: Option<f64>,
    pub new_face_value: Option<f64>,
    pub cash_amount: Option<f64>,
    pub adjust_volume: Option<bool>,
    pub old_symbol: Option<String>,
    pub old_name: Option<String>,
    pub new_symbol: Option<String>,
    pub new_name: Option<String>,
    pub current_symbol: Option<String>,
    pub current_name: Option<String>,
    pub note: Option<String>,
    pub source: Option<String>,
    pub source_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistCreateInput {
    pub name: String,
    pub source_meta: Option<WatchlistSourceMeta>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistRenameInput {
    pub watchlist_id: i64,
    pub name: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistDeleteInput {
    pub watchlist_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistSymbolInput {
    pub watchlist_id: i64,
    pub symbol: String,
    pub exchange: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentKeyInput {
    pub symbol: String,
    pub exchange: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialWatchlistUpdateInput {
    pub watchlist_id: i64,
    pub symbols_to_add: Vec<InstrumentKeyInput>,
    pub symbols_to_remove: Vec<InstrumentKeyInput>,
    pub last_synced_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceSourceLinkedWatchlistInput {
    pub watchlist_id: i64,
    pub members: Vec<InstrumentKeyInput>,
    pub source_meta: WatchlistSourceMeta,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingKeyInput {
    pub key: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingValueInput {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLayoutInput {
    pub name: String,
    pub layout_data: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutNameInput {
    pub name: String,
}

#[tauri::command]
pub fn list_quotes(app: AppHandle, input: QuoteListInput) -> AppResult<Vec<QuoteRow>> {
    let started_at = Instant::now();
    let log_details = format_quote_load_details(
        "single-symbol-history",
        Some(&input.symbol),
        &input.exchange,
        None,
        None,
        None,
    );
    log_runtime_event(&app, "INFO", "quote-load-start", Some(&log_details));

    let operation = (|| -> AppResult<Vec<QuoteRow>> {
        let folder_path = resolve_active_database_folder(&app)?;
        with_active_connection(&app, |connection| {
            list_quotes_internal(connection, &input, folder_path.as_deref())
        })
        .map(|value| value.unwrap_or_default())
    })();

    let elapsed_ms = started_at.elapsed().as_millis();
    match &operation {
        Ok(rows) => {
            let details = format_quote_load_details(
                "single-symbol-history",
                Some(&input.symbol),
                &input.exchange,
                None,
                Some(rows.len()),
                Some(elapsed_ms),
            );
            log_runtime_event(&app, "INFO", "quote-load-complete", Some(&details));
        }
        Err(error) => {
            let details = format!(
                "{} error={}",
                format_quote_load_details(
                    "single-symbol-history",
                    Some(&input.symbol),
                    &input.exchange,
                    None,
                    None,
                    Some(elapsed_ms),
                ),
                error
            );
            log_runtime_event(&app, "ERROR", "quote-load-failed", Some(&details));
        }
    }

    operation
}

#[tauri::command]
pub async fn list_quotes_by_date(
    app: AppHandle,
    input: QuoteDateListInput,
) -> AppResult<Vec<QuoteRow>> {
    let app_handle = app.clone();
    let log_details = format_quote_load_details(
        "all-symbols-date",
        None,
        &input.exchange,
        Some(&input.date),
        None,
        None,
    );
    log_runtime_event(&app_handle, "INFO", "quote-load-start", Some(&log_details));

    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let operation = (|| -> AppResult<Vec<QuoteRow>> {
            let folder_path = resolve_active_database_folder(&app_handle)?
                .ok_or_else(|| "Open a database before loading quotes.".to_string())?;

            let connection = open_connection_for_folder(&folder_path, false)?;
            list_quotes_by_date_scope_internal(&connection, &input, Some(&folder_path))
        })();

        let elapsed_ms = started_at.elapsed().as_millis();
        match &operation {
            Ok(rows) => {
                let details = format_quote_load_details(
                    "all-symbols-date",
                    None,
                    &input.exchange,
                    Some(&input.date),
                    Some(rows.len()),
                    Some(elapsed_ms),
                );
                log_runtime_event(&app_handle, "INFO", "quote-load-complete", Some(&details));
            }
            Err(error) => {
                let details = format!(
                    "{} error={}",
                    format_quote_load_details(
                        "all-symbols-date",
                        None,
                        &input.exchange,
                        Some(&input.date),
                        None,
                        Some(elapsed_ms),
                    ),
                    error
                );
                log_runtime_event(&app_handle, "ERROR", "quote-load-failed", Some(&details));
            }
        }

        operation
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn upsert_quote(app: AppHandle, input: QuoteInputPayload) -> AppResult<QuoteRow> {
    let app_handle = app.clone();
    let log_details = format_quote_write_details(
        "single-quote-upsert",
        &input.symbol,
        &input.exchange,
        &input.date,
        None,
    );
    log_runtime_event(&app_handle, "INFO", "quote-save-start", Some(&log_details));
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before editing quotes.".to_string())?;

        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::QuoteMutation)?;

        let operation = (|| -> AppResult<QuoteRow> {
            // 1. Open a temporary connection after acquiring the shared price-store operation permit.
            let connection = open_connection_for_folder(&folder_path, false)?;

            // 2. Perform the heavy work (SQLite + Binary EOD)
            let result = upsert_quote_internal(&connection, &input, Some(&folder_path))?;

            // 3. Invalidate the stats cache since we just modified data
            invalidate_cached_db_stats(&app_handle, &folder_path)?;

            // 4. Generate snapshot and emit
            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;

            Ok(result)
        })();

        let elapsed_ms = started_at.elapsed().as_millis();
        match &operation {
            Ok(result) => {
                let details = format_quote_write_details(
                    "single-quote-upsert",
                    &result.symbol,
                    &result.exchange,
                    &result.date,
                    Some(elapsed_ms),
                );
                log_runtime_event(&app_handle, "INFO", "quote-save-complete", Some(&details));
            }
            Err(error) => {
                let details = format!(
                    "{} error={}",
                    format_quote_write_details(
                        "single-quote-upsert",
                        &input.symbol,
                        &input.exchange,
                        &input.date,
                        Some(elapsed_ms),
                    ),
                    error
                );
                log_runtime_event(&app_handle, "ERROR", "quote-save-failed", Some(&details));
            }
        }

        operation
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn delete_quote(app: AppHandle, input: DeleteQuoteInput) -> AppResult<DeleteQuoteResult> {
    let app_handle = app.clone();
    let log_details = format_quote_delete_details(
        "single-symbol-single-date",
        Some(&input.symbol),
        &input.exchange,
        &input.date,
        None,
        None,
        None,
    );
    log_runtime_event(
        &app_handle,
        "INFO",
        "quote-delete-start",
        Some(&log_details),
    );
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before deleting quotes.".to_string())?;

        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::QuoteMutation)?;

        let operation = (|| -> AppResult<DeleteQuoteResult> {
            let connection = open_connection_for_folder(&folder_path, false)?;
            let result = delete_quote_internal(&connection, &input, Some(&folder_path))?;

            invalidate_cached_db_stats(&app_handle, &folder_path)?;

            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;

            Ok(result)
        })();

        let elapsed_ms = started_at.elapsed().as_millis();
        match &operation {
            Ok(result) => {
                let details = format_quote_delete_details(
                    "single-symbol-single-date",
                    Some(&input.symbol),
                    &input.exchange,
                    &input.date,
                    None,
                    Some(result.deleted),
                    Some(elapsed_ms),
                );
                log_runtime_event(&app_handle, "INFO", "quote-delete-complete", Some(&details));
            }
            Err(error) => {
                let details = format!(
                    "{} error={}",
                    format_quote_delete_details(
                        "single-symbol-single-date",
                        Some(&input.symbol),
                        &input.exchange,
                        &input.date,
                        None,
                        None,
                        Some(elapsed_ms),
                    ),
                    error
                );
                log_runtime_event(&app_handle, "ERROR", "quote-delete-failed", Some(&details));
            }
        }

        operation
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn delete_quote_range(
    app: AppHandle,
    input: DeleteQuoteRangeInput,
) -> AppResult<DeleteQuoteResult> {
    let app_handle = app.clone();
    let log_details = format_quote_delete_details(
        "single-symbol-date-range",
        Some(&input.symbol),
        &input.exchange,
        &input.from_date,
        Some(&input.to_date),
        None,
        None,
    );
    log_runtime_event(
        &app_handle,
        "INFO",
        "quote-delete-start",
        Some(&log_details),
    );
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before deleting quotes.".to_string())?;

        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::QuoteMutation)?;

        let operation = (|| -> AppResult<DeleteQuoteResult> {
            let connection = open_connection_for_folder(&folder_path, false)?;
            let result = delete_quote_range_internal(&connection, &input, Some(&folder_path))?;

            invalidate_cached_db_stats(&app_handle, &folder_path)?;

            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;

            Ok(result)
        })();

        let elapsed_ms = started_at.elapsed().as_millis();
        match &operation {
            Ok(result) => {
                let details = format_quote_delete_details(
                    "single-symbol-date-range",
                    Some(&input.symbol),
                    &input.exchange,
                    &input.from_date,
                    Some(&input.to_date),
                    Some(result.deleted),
                    Some(elapsed_ms),
                );
                log_runtime_event(&app_handle, "INFO", "quote-delete-complete", Some(&details));
            }
            Err(error) => {
                let details = format!(
                    "{} error={}",
                    format_quote_delete_details(
                        "single-symbol-date-range",
                        Some(&input.symbol),
                        &input.exchange,
                        &input.from_date,
                        Some(&input.to_date),
                        None,
                        Some(elapsed_ms),
                    ),
                    error
                );
                log_runtime_event(&app_handle, "ERROR", "quote-delete-failed", Some(&details));
            }
        }

        operation
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn delete_quote_date(
    app: AppHandle,
    input: DeleteQuoteDateInput,
) -> AppResult<DeleteQuoteResult> {
    let app_handle = app.clone();
    let log_kind = if input.to_date.is_some() {
        "all-symbols-date-range"
    } else if input
        .symbols
        .as_ref()
        .is_some_and(|symbols| !symbols.is_empty())
    {
        "all-symbols-loaded-session-date"
    } else {
        "all-symbols-single-date"
    };
    let log_details = format_quote_delete_details(
        log_kind,
        None,
        &input.exchange,
        &input.date,
        input.to_date.as_deref(),
        None,
        None,
    );
    log_runtime_event(
        &app_handle,
        "INFO",
        "quote-delete-start",
        Some(&log_details),
    );
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before deleting quotes.".to_string())?;

        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::QuoteMutation)?;

        let operation = (|| {
            let connection = open_connection_for_folder(&folder_path, false)?;
            let scope_result = delete_quote_date_scope_internal(
                &connection,
                &input,
                Some(&folder_path),
                Some(&|progress| emit_quote_delete_progress(&app_handle, progress)),
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

            Ok::<_, String>(scope_result)
        })();

        let elapsed_ms = started_at.elapsed().as_millis();
        match &operation {
            Ok(scope_result) => {
                let mut details = format_quote_delete_details(
                    log_kind,
                    None,
                    &input.exchange,
                    &input.date,
                    input.to_date.as_deref(),
                    Some(scope_result.result.deleted),
                    Some(elapsed_ms),
                );
                if input.exchange.trim().eq_ignore_ascii_case("ALL") {
                    details.push_str(&format!(
                        " exchangeDeleted={}",
                        format_quote_exchange_delete_counts(&scope_result.exchange_deleted)
                    ));
                }
                log_runtime_event(&app_handle, "INFO", "quote-delete-complete", Some(&details));
            }
            Err(error) => {
                let details = format!(
                    "{} error={}",
                    format_quote_delete_details(
                        log_kind,
                        None,
                        &input.exchange,
                        &input.date,
                        input.to_date.as_deref(),
                        None,
                        Some(elapsed_ms),
                    ),
                    error
                );
                log_runtime_event(&app_handle, "ERROR", "quote-delete-failed", Some(&details));
            }
        }

        operation.map(|scope_result| scope_result.result)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn emit_database_changed(app: &AppHandle, snapshot: &AppSnapshot) -> AppResult<()> {
    app.emit("db:changed", snapshot.clone())
        .map_err(|error| error.to_string())
}

fn run_connection_transaction<T, F>(connection: &Connection, callback: F) -> AppResult<T>
where
    F: FnOnce(&Connection) -> AppResult<T>,
{
    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    match callback(connection) {
        Ok(value) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| error.to_string())?;
            Ok(value)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn map_identity_history_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<IdentityHistoryRow> {
    Ok(IdentityHistoryRow {
        id: row.get(0)?,
        exchange: row.get(1)?,
        isin: row.get(2)?,
        current_symbol: row.get(3)?,
        current_name: row.get(4)?,
        old_symbol: row.get(5)?,
        old_name: row.get(6)?,
        new_symbol: row.get(7)?,
        new_name: row.get(8)?,
        effective_date: row.get(9)?,
        change_type: row.get(10)?,
    })
}

fn question_marks(count: usize) -> String {
    std::iter::repeat("?")
        .take(count.max(1))
        .collect::<Vec<_>>()
        .join(", ")
}

pub(crate) fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

pub(crate) fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn round_price(value: f64) -> f64 {
    (value * 10000.0).round() / 10000.0
}

fn trim_numeric_string(value: f64) -> String {
    let mut text = format!("{value:.6}");
    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

fn normalize_symbol(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_uppercase();
    if normalized.is_empty() {
        return Err("Symbol is required.".to_string());
    }
    Ok(normalized)
}

fn normalize_exchange(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_uppercase();
    if normalized.is_empty() {
        return Err("Exchange is required.".to_string());
    }
    Ok(normalized)
}

fn normalize_trade_date(value: &str) -> AppResult<String> {
    let normalized = value.trim();
    if normalized.len() != 10 {
        return Err(format!("Invalid trade date: {value}"));
    }
    Ok(normalized.to_string())
}

fn normalize_optional_trade_date(value: Option<&str>) -> AppResult<Option<String>> {
    match value {
        Some(raw) if !raw.trim().is_empty() => Ok(Some(normalize_trade_date(raw)?)),
        _ => Ok(None),
    }
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|raw| !raw.is_empty())
        .map(|raw| raw.to_string())
}

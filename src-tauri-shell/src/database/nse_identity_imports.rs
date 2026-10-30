mod historical_reporting;
pub(crate) mod historical_categories;
pub use historical_reporting::{list_nse_historical_identity_apply_history, get_nse_historical_identity_apply_report};
mod historical_reconciliation;
#[cfg(test)]
mod historical_repair_tests;
mod apply_reporting;
pub use apply_reporting::list_nse_identity_apply_history;
use tauri::Emitter;
use chrono::NaiveDate;
use csv::StringRecord;
#[cfg(not(test))]
use reqwest::blocking::Client;
#[cfg(not(test))]
use reqwest::header::{ACCEPT, REFERER, USER_AGENT};
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::AppHandle;
use zip::ZipArchive;

use super::identity_evidence_resolver::{
    resolve_identity, IdentityResolverAuthorityClass,
    IdentityResolverEvaluationError, IdentityResolverEvidence, IdentityResolverEvidenceKind,
    IdentityResolverInput, IdentityResolverLocalIdentity, IdentityResolverOfficialIdentity,
    IdentityResolverResult, IdentityResolverRuleId, IdentityResolverSourceAvailability,
    IdentityResolverStatus,
};
use super::instrument_mutations::apply_corporate_action_internal;
use super::official_source_urls::{load_official_source_urls, OfficialSourceUrls};
#[cfg(not(test))]
use super::official_source_urls::{
    nse_official_redirect_policy, validate_nse_official_source_url,
};
use super::{
    emit_database_changed, get_app_snapshot_internal, invalidate_cached_db_stats,
    normalize_optional_text, normalize_symbol, open_connection_for_folder,
    resolve_active_database_folder, AppResult, CorporateActionInputPayload,
    NseCurrentUniverseApplyInput, NseCurrentUniverseMasterDownloadResult,
    NseCurrentUniverseSyncInput, NseCurrentUniverseSyncPreviewRow, NseCurrentUniverseSyncResult,
    NseDelistedWorkbookDownloadResult, NseHistoricalIdentityApplyInput,
    NseHistoricalIdentityPreviewInput, NseHistoricalIdentityPreviewRow,
    NseHistoricalIdentityResult, SnapshotOptions,
};

const NSE_IDENTITY_SOURCE: &str = "NSE_IDENTITY";
const ER2C1_NSE_EQUITY_MASTER: &str = "NSE_EQUITY_MASTER";
const ER2C1_NSE_SME_MASTER: &str = "NSE_SME_MASTER";
const ER2C1_NSE_SYMBOL_CHANGE: &str = "NSE_SYMBOL_CHANGE";
const ER2C1_NSE_COMPANY_NAME_CHANGE: &str = "NSE_COMPANY_NAME_CHANGE";
const ER2C1_NSE_EQUITY_MASTER_REFERENCE: &str =
    "NSE/Identity/SecuritiesAvailable/nse_identity_securities_available_equity.csv";
const ER2C1_NSE_SME_MASTER_REFERENCE: &str =
    "NSE/Identity/SecuritiesAvailable/nse_identity_securities_available_sme.csv";
const ER2C1_NSE_SYMBOL_CHANGE_REFERENCE: &str =
    "NSE/Identity/SymbolChanges/nse_identity_symbol_changes.csv";
const ER2C1_NSE_COMPANY_NAME_CHANGE_REFERENCE: &str =
    "NSE/Identity/CompanyNameChanges/nse_identity_company_name_changes.csv";
const NSE_EXCHANGE: &str = "NSE";
const CURRENT_UNIVERSE_SUPPORTED_SERIES: &[&str] = &["EQ", "BE", "BZ", "SM", "ST", "SZ"];
const CURRENT_UNIVERSE_MAX_FILE_AGE_DAYS: u64 = 14;
const NSE_CURRENT_POPULATION_SANITY_MINIMUM: usize = 1000;
const SOURCE_POPULATION_SANITY_REJECTED: &str = "SOURCE_POPULATION_SANITY_REJECTED";
const NSE_CURRENT_UNIVERSE_SYNC_PLAN_HASH_VERSION: &str =
    "NSE_CURRENT_UNIVERSE_SYNC_PLAN_V2_COVERAGE";
const NSE_REVIEWED_PLAN_STALE_ERROR: &str =
    "NSE reviewed preview is stale because the source or database state changed. Preview again before applying.";
const NSE_HISTORICAL_IDENTITY_PLAN_HASH_VERSION: &str =
    "NSE_HISTORICAL_IDENTITY_PLAN_V3_REVIEWED_CURRENT_EFFECTS";
const NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR: &str =
    "NSE historical identity preview is stale because the source or database state changed. Preview Historical Identity again before applying.";
const NSE_HISTORICAL_PREVIEW_ERRORS: &str =
    "NSE historical identity preview contains error rows. Resolve the source/database errors and Preview Historical Identity again before applying.";
pub(super) const NSE_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

#[derive(Clone, Debug)]
struct NseIdentityArchiveFiles {
    securities_available_path: PathBuf,
    symbol_changes_path: PathBuf,
    company_name_changes_path: PathBuf,
}

#[derive(Clone, Debug)]
struct NseHistoricalIdentitySourceSnapshot {
    archive_root_path: String,
    symbol_changes_path: String,
    company_name_changes_path: String,
    securities_available_sha256: String,
    symbol_changes_sha256: String,
    company_name_changes_sha256: String,
    master_rows: Vec<NseSecurityMasterRow>,
    current_universe_master_rows_read: u32,
    current_universe_rows: Vec<NseSecurityMasterRow>,
    symbol_change_rows: Vec<NseSymbolChangeRow>,
    name_change_rows: Vec<NseNameChangeRow>,
}

#[derive(Clone, Debug)]
enum HistoricalIdentityPayloadOutcome {
    New,
    Duplicate,
    Skipped(String),
    Error(String),
}

#[derive(Clone, Debug)]
struct NseSecurityMasterRow {
    symbol: String,
    company_name: Option<String>,
    isin: Option<String>,
    series: Option<String>,
}

#[derive(Clone, Debug)]
struct NseSymbolChangeRow {
    company_name: Option<String>,
    old_symbol: String,
    new_symbol: String,
    effective_date: String,
}

#[derive(Clone, Debug)]
struct NseNameChangeRow {
    symbol: String,
    old_name: String,
    new_name: String,
    effective_date: String,
}

#[derive(Clone, Debug)]
struct ExistingNseInstrumentRow {
    symbol: String,
    isin: Option<String>,
    name: Option<String>,
    series: Option<String>,
    is_active: bool,
}

#[derive(Clone, Debug, Default)]
struct NseIdentityHistoryHints {
    symbol_to_current: HashMap<String, String>,
    isin_to_current: HashMap<String, String>,
    row_count: u32,
    transition_edges: HashMap<String, HashSet<(String, String)>>,
}

#[derive(Clone, Debug)]
struct NseCurrentUniverseSyncPlan {
    archive_root_path: String,
    master_rows_read: u32,
    current_universe_symbols: u32,
    matched_by_symbol: u32,
    matched_by_isin: u32,
    matched_by_identity: u32,
    new_symbols: u32,
    activate_count: u32,
    update_count: u32,
    deactivate_count: u32,
    unchanged_active: u32,
    identity_history_rows: u32,
    official_delisted_symbols: u32,
    preview_rows: Vec<NseCurrentUniverseSyncPreviewRow>,
    current_rows: Vec<NseSecurityMasterRow>,
    deactivate_symbols: Vec<String>,
    deactivate_lifecycle_by_symbol: HashMap<String, String>,
}

#[tauri::command]
pub async fn preview_nse_historical_identity_archive(
    app: AppHandle,
    input: NseHistoricalIdentityPreviewInput,
) -> AppResult<NseHistoricalIdentityResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before previewing NSE historical identity.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        let archive_root =
            resolve_nse_historical_identity_archive_root(&input, Some(&managed_root))?;
        let resolved_input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(archive_root.display().to_string()),
        };
        preview_nse_historical_identity_archive_internal(&connection, &resolved_input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn apply_nse_historical_identity_archive(
    app: AppHandle,
    input: NseHistoricalIdentityApplyInput,
    operation_id: Option<String>,
) -> AppResult<NseHistoricalIdentityResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before applying NSE historical identity.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        let archive_root = resolve_nse_historical_identity_archive_root(
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: input.archive_root_path.clone(),
            },
            Some(&managed_root),
        )?;
        let resolved_input = NseHistoricalIdentityApplyInput {
            archive_root_path: Some(archive_root.display().to_string()),
            expected_plan_sha256: input.expected_plan_sha256.clone(),
        };
        let report = |progress: apply_reporting::IdentityApplyProgress| {
            if let Some(id) = &operation_id { let _ = app_handle.emit("identity:historical-progress", serde_json::json!({"operationId":id,"databasePath":folder_path,"progress":progress})); }
        };
        let mut result = apply_nse_historical_identity_archive_with_progress(&connection, &resolved_input, &report)?;
        report(historical_reporting::progress("refreshing",0,0));
        let refresh = (|| -> AppResult<()> {
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok(())
        })();
        if let Err(error) = refresh { result.refresh_warning = Some(error); }
        Ok::<NseHistoricalIdentityResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn preview_nse_current_universe_sync(
    app: AppHandle,
    input: NseCurrentUniverseSyncInput,
) -> AppResult<NseCurrentUniverseSyncResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before previewing the NSE current-symbol sync.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        preview_nse_current_universe_sync_internal(&connection, &input, Some(&managed_root))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn apply_nse_current_universe_sync(
    app: AppHandle,
    input: NseCurrentUniverseApplyInput,
    operation_id: Option<String>,
    expected_database_path: Option<String>,
) -> AppResult<NseCurrentUniverseSyncResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before applying the NSE current-symbol sync.".to_string()
        })?;
        super::check_identity_reviewed_database_path(&folder_path, expected_database_path.as_deref().unwrap_or(""))?;
        let connection = open_connection_for_folder(&folder_path, false)?;

        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        let report = |progress: apply_reporting::IdentityApplyProgress| {
            if let Some(id) = &operation_id {
                let _ = app_handle.emit("identity:apply-progress", serde_json::json!({
                    "operationId": id, "databasePath": folder_path, "progress": progress
                }));
            }
        };
        let mut result = apply_reporting::apply_reviewed(&connection, &input, Some(&managed_root), &report)?;
        report(apply_reporting::IdentityApplyProgress { stage: "refreshing", processed: 0, total: 0, percent: Some(100) });
        // A refresh error after commit must not be reported as a failed apply.
        let refresh = (|| -> AppResult<()> {
        invalidate_cached_db_stats(&app_handle, &folder_path)?;
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;
        Ok(())
        })();
        if let Err(error) = refresh { result.refresh_warning = Some(error); }
        Ok::<NseCurrentUniverseSyncResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn download_nse_delisted_workbook(
    app: AppHandle,
) -> AppResult<NseDelistedWorkbookDownloadResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before downloading the NSE delisted workbook.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let urls = load_official_source_urls(Some(&connection))?;
        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        download_nse_delisted_workbook_internal(&managed_root, &urls)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn download_nse_current_universe_master(
    app: AppHandle,
) -> AppResult<NseCurrentUniverseMasterDownloadResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before downloading the NSE current master.".to_string()
        })?;
        let connection = open_connection_for_folder(&folder_path, false)?;
        let urls = load_official_source_urls(Some(&connection))?;
        let managed_root = resolve_managed_nse_identity_root(&folder_path);
        download_nse_current_universe_master_internal(&managed_root, &urls)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn sha256_hex_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn load_nse_historical_identity_source_snapshot(
    input: &NseHistoricalIdentityPreviewInput,
) -> AppResult<NseHistoricalIdentitySourceSnapshot> {
    let archive_root = resolve_nse_historical_identity_archive_root(input, None)?;
    let files = resolve_archive_files(&archive_root)?;

    let (_, sme_path) = resolve_current_universe_master_paths(&archive_root)?;
    ensure_current_universe_master_file_is_fresh(&files.securities_available_path)?;
    if let Some(path) = sme_path.as_ref() {
        ensure_current_universe_master_file_is_fresh(path)?;
    }

    let securities_available_bytes = std::fs::read(&files.securities_available_path)
        .map_err(|error| error.to_string())?;
    let symbol_changes_bytes =
        std::fs::read(&files.symbol_changes_path).map_err(|error| error.to_string())?;
    let company_name_changes_bytes = std::fs::read(&files.company_name_changes_path)
        .map_err(|error| error.to_string())?;

    let historical_allowed = HashSet::from(["EQ".to_string()]);
    let master_rows = load_security_master_rows_from_bytes(
        &securities_available_bytes,
        &files.securities_available_path.display().to_string(),
        Some(&historical_allowed),
    )?;

    let current_allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();
    let current_equity_rows = load_security_master_rows_from_bytes(
        &securities_available_bytes,
        &files.securities_available_path.display().to_string(),
        Some(&current_allowed),
    )?;
    let mut current_universe_master_rows_read = current_equity_rows.len() as u32;
    let mut current_universe_by_symbol = current_equity_rows
        .into_iter()
        .map(|row| (row.symbol.clone(), row))
        .collect::<HashMap<_, _>>();
    if let Some(path) = sme_path.as_ref() {
        let sme_bytes = std::fs::read(path).map_err(|error| error.to_string())?;
        let sme_rows = load_security_master_rows_from_bytes(
            &sme_bytes,
            &path.display().to_string(),
            Some(&current_allowed),
        )?;
        current_universe_master_rows_read += sme_rows.len() as u32;
        for row in sme_rows {
            current_universe_by_symbol
                .entry(row.symbol.clone())
                .or_insert(row);
        }
    }
    let mut current_universe_rows = current_universe_by_symbol.into_values().collect::<Vec<_>>();
    current_universe_rows.sort_by(|left, right| left.symbol.cmp(&right.symbol));

    let symbol_change_rows = load_symbol_change_rows_from_bytes(
        &symbol_changes_bytes,
        &files.symbol_changes_path.display().to_string(),
    )?;
    let name_change_rows = load_name_change_rows_from_bytes(
        &company_name_changes_bytes,
        &files.company_name_changes_path.display().to_string(),
    )?;

    Ok(NseHistoricalIdentitySourceSnapshot {
        archive_root_path: archive_root.display().to_string(),
        symbol_changes_path: files.symbol_changes_path.display().to_string(),
        company_name_changes_path: files.company_name_changes_path.display().to_string(),
        securities_available_sha256: sha256_hex_bytes(&securities_available_bytes),
        symbol_changes_sha256: sha256_hex_bytes(&symbol_changes_bytes),
        company_name_changes_sha256: sha256_hex_bytes(&company_name_changes_bytes),
        master_rows,
        current_universe_master_rows_read,
        current_universe_rows,
        symbol_change_rows,
        name_change_rows,
    })
}

fn historical_preview_row_from_payload(
    payload: &CorporateActionInputPayload,
    disposition: &str,
    source_file: String,
    detail: String,
) -> NseHistoricalIdentityPreviewRow {
    NseHistoricalIdentityPreviewRow {
        disposition: disposition.to_string(),
        change_type: payload.action_type.clone(),
        effective_date: Some(payload.effective_date.clone()),
        old_symbol: payload.old_symbol.clone(),
        new_symbol: payload.new_symbol.clone(),
        current_symbol: payload.current_symbol.clone(),
        old_name: payload.old_name.clone(),
        new_name: payload.new_name.clone(),
        source_file,
        detail,
    }
}

fn record_historical_identity_payload(
    connection: &Connection,
    payload: &mut CorporateActionInputPayload,
) -> HistoricalIdentityPayloadOutcome {
    match historical_reconciliation::reconcile(connection, payload) {
        Ok(Some(outcome)) => return outcome,
        Ok(None) => {},
        Err(error) => return HistoricalIdentityPayloadOutcome::Error(error),
    }
    // A historical event proves metadata at its date, not a current listing.
    // Preserve activity (new targets default inactive); the master phase below
    // remains authoritative for activating currently listed symbols.
    let target_symbol = payload.new_symbol.clone().or_else(|| payload.current_symbol.clone()).or_else(|| payload.symbol.clone());
    let target_was_active = match connection.query_row(
        "SELECT COALESCE((SELECT is_active FROM instruments WHERE exchange='NSE' AND symbol=?),0)",
        params![target_symbol], |row| row.get::<_, bool>(0),
    ) {
        Ok(active) => active,
        Err(error) => return HistoricalIdentityPayloadOutcome::Error(error.to_string()),
    };
    if let Err(error) = connection.execute_batch("SAVEPOINT i4_historical_identity_row") {
        return HistoricalIdentityPayloadOutcome::Error(error.to_string());
    }

    let outcome = match apply_corporate_action_internal(connection, payload, None) {
        Ok(_) => {
            // The accepted historical rename already deactivates its old row.
            // Keep its lifecycle label consistent inside this row's savepoint;
            // the current-master sync can still reactivate a listed/reused symbol.
            let lifecycle = (|| -> AppResult<()> {
                if !target_was_active {
                    connection.execute("UPDATE instruments SET is_active=0 WHERE exchange='NSE' AND symbol=?", params![target_symbol])
                        .map_err(|error| error.to_string())?;
                }
                if matches!(payload.action_type.as_str(), "SYMBOL_CHANGE" | "BOTH") {
                    connection.execute(
                    "UPDATE instruments SET lifecycle_status='OLD_SYMBOL' WHERE exchange='NSE' AND symbol=? AND is_active=0",
                    params![payload.old_symbol],
                    ).map_err(|error| error.to_string())?;
                }
                Ok(())
            })();
            match lifecycle {
                Ok(()) => HistoricalIdentityPayloadOutcome::New,
                Err(error) => HistoricalIdentityPayloadOutcome::Error(error),
            }
        },
        Err(error) if error.contains("already exists") => HistoricalIdentityPayloadOutcome::Duplicate,
        Err(error) => HistoricalIdentityPayloadOutcome::Error(error),
    };

    match &outcome {
        HistoricalIdentityPayloadOutcome::New | HistoricalIdentityPayloadOutcome::Duplicate => {
            if let Err(error) = connection.execute_batch("RELEASE SAVEPOINT i4_historical_identity_row") {
                let _ = connection.execute_batch(
                    "ROLLBACK TO SAVEPOINT i4_historical_identity_row; RELEASE SAVEPOINT i4_historical_identity_row",
                );
                return HistoricalIdentityPayloadOutcome::Error(error.to_string());
            }
        }
        HistoricalIdentityPayloadOutcome::Error(_) | HistoricalIdentityPayloadOutcome::Skipped(_) => {
            let _ = connection.execute_batch(
                "ROLLBACK TO SAVEPOINT i4_historical_identity_row; RELEASE SAVEPOINT i4_historical_identity_row",
            );
        }
    }

    outcome
}

fn apply_historical_identity_outcome(
    result: &mut NseHistoricalIdentityResult,
    payload: &CorporateActionInputPayload,
    source_file: String,
    outcome: HistoricalIdentityPayloadOutcome,
) {
    match outcome {
        HistoricalIdentityPayloadOutcome::New => {
            match payload.action_type.as_str() {
                "SYMBOL_CHANGE" => result.new_symbol_changes += 1,
                "NAME_CHANGE" => result.new_name_changes += 1,
                "BOTH" => result.new_combined_changes += 1,
                _ => {}
            }
            result.history_rows.push(historical_preview_row_from_payload(
                payload,
                "NEW",
                source_file,
                "Will insert this NSE historical identity change.".to_string(),
            ));
        }
        HistoricalIdentityPayloadOutcome::Duplicate => {
            result.duplicate_rows += 1;
            result.history_rows.push(historical_preview_row_from_payload(
                payload,
                "DUPLICATE",
                source_file,
                "This identity change already exists; no new historical row is required."
                    .to_string(),
            ));
        }
        HistoricalIdentityPayloadOutcome::Skipped(detail) => {
            result.skipped_rows += 1;
            result.history_rows.push(historical_preview_row_from_payload(payload, "SKIPPED", source_file, detail));
        }
        HistoricalIdentityPayloadOutcome::Error(error) => {
            result.error_rows += 1;
            let label = payload
                .current_symbol
                .clone()
                .or_else(|| payload.new_symbol.clone())
                .or_else(|| payload.old_symbol.clone())
                .unwrap_or_else(|| "-".to_string());
            result
                .errors
                .push(format!("{} {}: {}", payload.action_type, label, error));
            result.history_rows.push(historical_preview_row_from_payload(
                payload,
                "ERROR",
                source_file,
                error,
            ));
        }
    }
}

fn skipped_symbol_change_preview_row(
    row: &NseSymbolChangeRow,
    source_file: &str,
) -> NseHistoricalIdentityPreviewRow {
    NseHistoricalIdentityPreviewRow {
        disposition: "SKIPPED".to_string(),
        change_type: "SYMBOL_CHANGE".to_string(),
        effective_date: Some(row.effective_date.clone()),
        old_symbol: Some(row.old_symbol.clone()),
        new_symbol: Some(row.new_symbol.clone()),
        current_symbol: Some(row.new_symbol.clone()),
        old_name: None,
        new_name: row.company_name.clone(),
        source_file: source_file.to_string(),
        detail: "Outside the included NSE identity symbol chain for the current database/source set."
            .to_string(),
    }
}

fn skipped_name_change_preview_row(
    row: &NseNameChangeRow,
    source_file: &str,
) -> NseHistoricalIdentityPreviewRow {
    NseHistoricalIdentityPreviewRow {
        disposition: "SKIPPED".to_string(),
        change_type: "NAME_CHANGE".to_string(),
        effective_date: Some(row.effective_date.clone()),
        old_symbol: Some(row.symbol.clone()),
        new_symbol: Some(row.symbol.clone()),
        current_symbol: Some(row.symbol.clone()),
        old_name: Some(row.old_name.clone()),
        new_name: Some(row.new_name.clone()),
        source_file: source_file.to_string(),
        detail: "Outside the included NSE identity symbol chain for the current database/source set."
            .to_string(),
    }
}

fn execute_nse_historical_identity_plan(
    connection: &Connection,
    snapshot: &NseHistoricalIdentitySourceSnapshot,
) -> AppResult<NseHistoricalIdentityResult> {
    execute_nse_historical_identity_plan_with_progress(connection, snapshot, &|_, _| {})
}

fn execute_nse_historical_identity_plan_with_progress(
    connection: &Connection, snapshot: &NseHistoricalIdentitySourceSnapshot, report: &dyn Fn(usize,usize),
) -> AppResult<NseHistoricalIdentityResult> {
    let mut processed = 0usize;
    let total = snapshot.symbol_change_rows.len() + snapshot.name_change_rows.len();
    let mut advance = |count: usize| { processed += count; if processed % 25 == 0 || processed >= total { report(processed, total); } };
    let mut result = NseHistoricalIdentityResult {
        run_id: None, completed_at: None, refresh_warning: None, category_evidence: None,
        archive_root_path: snapshot.archive_root_path.clone(),
        applied: false,
        can_apply: false,
        plan_sha256: String::new(),
        securities_available_sha256: snapshot.securities_available_sha256.clone(),
        symbol_changes_sha256: snapshot.symbol_changes_sha256.clone(),
        company_name_changes_sha256: snapshot.company_name_changes_sha256.clone(),
        master_rows_read: snapshot.master_rows.len() as u32,
        master_rows_planned: snapshot.master_rows.len() as u32,
        current_equity_symbols: 0,
        symbol_change_rows_read: snapshot.symbol_change_rows.len() as u32,
        name_change_rows_read: snapshot.name_change_rows.len() as u32,
        new_symbol_changes: 0,
        new_name_changes: 0,
        new_combined_changes: 0,
        duplicate_rows: 0,
        skipped_rows: 0,
        error_rows: 0,
        current_universe_plan_sha256: None,
        active_sync_activate_count: 0,
        active_sync_update_count: 0,
        active_sync_deactivate_count: 0,
        active_sync_unchanged_count: 0,
        history_rows: Vec::new(),
        current_universe_preview_rows: Vec::new(),
        errors: Vec::new(),
    };

    let current_equity_symbols = snapshot
        .master_rows
        .iter()
        .map(|row| row.symbol.clone())
        .collect::<HashSet<_>>();
    let existing_nse_symbols = load_existing_exchange_symbols(connection, NSE_EXCHANGE)?;
    let included_symbols = build_included_identity_symbols(
        &current_equity_symbols,
        &existing_nse_symbols,
        &snapshot.symbol_change_rows,
    );
    result.current_equity_symbols = current_equity_symbols.len() as u32;

    let mut name_rows_by_key = HashMap::new();
    let mut included_name_rows = snapshot.name_change_rows.clone();
    included_name_rows.sort_by(|left, right| {
        left.effective_date
            .cmp(&right.effective_date)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    for row in included_name_rows {
        if should_include_name_change(&included_symbols, &row) {
            if name_rows_by_key.insert(name_change_key(&row.symbol, &row.effective_date), row).is_some() { advance(1); }
        } else {
            advance(1);
            result.skipped_rows += 1;
            result.history_rows.push(skipped_name_change_preview_row(
                &row,
                &snapshot.company_name_changes_path,
            ));
        }
    }

    let mut included_symbol_rows = snapshot.symbol_change_rows.clone();
    included_symbol_rows.sort_by(|left, right| {
        left.effective_date
            .cmp(&right.effective_date)
            .then_with(|| left.new_symbol.cmp(&right.new_symbol))
            .then_with(|| left.old_symbol.cmp(&right.old_symbol))
    });

    for row in included_symbol_rows {
        if !should_include_symbol_change(&included_symbols, &row) {
            advance(1);
            result.skipped_rows += 1;
            result.history_rows.push(skipped_symbol_change_preview_row(
                &row,
                &snapshot.symbol_changes_path,
            ));
            continue;
        }

        let key = name_change_key(&row.new_symbol, &row.effective_date);
        if let Some(name_row) = name_rows_by_key.remove(&key) {
            advance(2);
            let mut payload = CorporateActionInputPayload {
                action_type: "BOTH".to_string(),
                symbol: Some(row.new_symbol.clone()),
                exchange: NSE_EXCHANGE.to_string(),
                effective_date: row.effective_date.clone(),
                isin: None,
                record_date: None,
                ratio_num: None,
                ratio_den: None,
                old_face_value: None,
                new_face_value: None,
                cash_amount: None,
                adjust_volume: None,
                old_symbol: Some(row.old_symbol.clone()),
                old_name: Some(name_row.old_name),
                new_symbol: Some(row.new_symbol.clone()),
                new_name: Some(name_row.new_name.clone()),
                current_symbol: Some(row.new_symbol.clone()),
                current_name: Some(name_row.new_name).or(row.company_name.clone()),
                note: Some("Imported from NSE identity archive.".to_string()),
                source: Some(NSE_IDENTITY_SOURCE.to_string()),
                source_ref: Some(snapshot.symbol_changes_path.clone()),
            };
            let outcome = record_historical_identity_payload(connection, &mut payload);
            apply_historical_identity_outcome(
                &mut result,
                &payload,
                format!(
                    "{} + {}",
                    snapshot.symbol_changes_path, snapshot.company_name_changes_path
                ),
                outcome,
            );
            continue;
        }

        advance(1);
        let mut payload = CorporateActionInputPayload {
            action_type: "SYMBOL_CHANGE".to_string(),
            symbol: Some(row.new_symbol.clone()),
            exchange: NSE_EXCHANGE.to_string(),
            effective_date: row.effective_date.clone(),
            isin: None,
            record_date: None,
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            adjust_volume: None,
            old_symbol: Some(row.old_symbol.clone()),
            old_name: None,
            new_symbol: Some(row.new_symbol.clone()),
            new_name: None,
            current_symbol: Some(row.new_symbol.clone()),
            current_name: row.company_name.clone(),
            note: Some("Imported from NSE identity archive.".to_string()),
            source: Some(NSE_IDENTITY_SOURCE.to_string()),
            source_ref: Some(snapshot.symbol_changes_path.clone()),
        };
        let outcome = record_historical_identity_payload(connection, &mut payload);
        apply_historical_identity_outcome(
            &mut result,
            &payload,
            snapshot.symbol_changes_path.clone(),
            outcome,
        );
    }

    let mut remaining_name_rows = name_rows_by_key.into_values().collect::<Vec<_>>();
    remaining_name_rows.sort_by(|left, right| {
        left.effective_date
            .cmp(&right.effective_date)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    for row in remaining_name_rows {
        advance(1);
        let mut payload = CorporateActionInputPayload {
            action_type: "NAME_CHANGE".to_string(),
            symbol: Some(row.symbol.clone()),
            exchange: NSE_EXCHANGE.to_string(),
            effective_date: row.effective_date.clone(),
            isin: None,
            record_date: None,
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            adjust_volume: None,
            old_symbol: None,
            old_name: Some(row.old_name),
            new_symbol: None,
            new_name: Some(row.new_name.clone()),
            current_symbol: Some(row.symbol.clone()),
            current_name: Some(row.new_name),
            note: Some("Imported from NSE identity archive.".to_string()),
            source: Some(NSE_IDENTITY_SOURCE.to_string()),
            source_ref: Some(snapshot.company_name_changes_path.clone()),
        };
        let outcome = record_historical_identity_payload(connection, &mut payload);
        apply_historical_identity_outcome(
            &mut result,
            &payload,
            snapshot.company_name_changes_path.clone(),
            outcome,
        );
    }

    if result.error_rows > 0 {
        result.can_apply = false;
        result.plan_sha256 = nse_historical_identity_plan_sha256(&result);
        return Ok(result);
    }

    // Build current effects before writing the master. The reviewed sync below
    // already writes the complete supported master atomically.
    let current_plan = build_nse_current_universe_sync_plan_from_master_rows(
        connection,
        Path::new(&snapshot.archive_root_path),
        snapshot.current_universe_master_rows_read,
        snapshot.current_universe_rows.clone(),
    )?;
    let current_plan_sha256 = nse_current_universe_plan_sha256(&current_plan);
    result.active_sync_activate_count = current_plan.activate_count;
    result.active_sync_update_count = current_plan.update_count;
    result.active_sync_deactivate_count = current_plan.deactivate_count;
    result.active_sync_unchanged_count = current_plan.unchanged_active;
    result.current_universe_preview_rows = current_plan.preview_rows.clone();
    result.current_universe_plan_sha256 = Some(current_plan_sha256);
    apply_nse_current_universe_sync_plan(connection, &current_plan)?;

    result.category_evidence = Some(historical_categories::build(snapshot, &result.history_rows));
    result.can_apply = true;
    result.plan_sha256 = nse_historical_identity_plan_sha256(&result);
    Ok(result)
}

fn rollback_nse_historical_identity_transaction(connection: &Connection) {
    let _ = connection.execute_batch("ROLLBACK");
}



// ER2-C2: private NSE I4 historical post-rollback shadow evidence adapter.
// These values are deliberately in-memory only; they are not serialized,
// persisted, logged, exposed through Tauri, or used by Apply.
#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowResolverError {
    InvalidInput(String),
    AmbiguousDeterministicCandidates {
        rule_ids: Vec<IdentityResolverRuleId>,
    },
    InvalidConstructedResult(String),
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowState {
    Evaluated(IdentityResolverResult),
    NoMaterialResolverMismatch,
    ResolverError(NseI4Er2ShadowResolverError),
    NotEvaluated(NseI4Er2ShadowReason),
    AdapterError(String),
}

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowReason {
    I4RowSkipped,
    I4RowError,
    NoLocalIdentity,
    NoOfficialCurrentIdentity,
    UnsupportedHistoricalChangeType,
}

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowRelationship {
    IdentityContinuitySupported,
    ResolverConflict,
    ResolverNeedsMoreEvidence,
    NoMaterialResolverMismatch,
    SourceUnavailable,
    ResolverError,
    NotEvaluated,
    AdapterError,
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
struct NseI4Er2ShadowEvaluation {
    i4_disposition: String,
    change_type: String,
    effective_date: Option<String>,
    local_symbol: Option<String>,
    official_symbol: Option<String>,
    state: NseI4Er2ShadowState,
    relationship: NseI4Er2ShadowRelationship,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct NseI4Er2ShadowSummary {
    history_rows: usize,
    new_rows: usize,
    duplicate_rows: usize,
    skipped_rows: usize,
    error_rows: usize,
    eligible_rows: usize,
    evaluated_rows: usize,
    not_evaluated_rows: usize,
    adapter_error_rows: usize,
    continuity_supported: usize,
    resolver_conflicts: usize,
    needs_more_evidence: usize,
    no_material_mismatch: usize,
    source_unavailable: usize,
    resolver_errors: usize,
}

type NseI4Er2SymbolChangeKey = (String, String, String);
type NseI4Er2NameChangeKey = (String, String, String, String);

#[derive(Clone, Debug, Default)]
struct NseI4Er2HistoricalEvidenceMatch {
    symbol_change: Option<NseSymbolChangeRow>,
    name_change: Option<NseNameChangeRow>,
}

#[derive(Clone, Debug)]
struct NseI4Er2ShadowIndexes {
    observed_at_ist: String,
    existing_by_symbol: HashMap<String, ExistingNseInstrumentRow>,
    current_master_by_symbol: HashMap<String, Vec<NseSecurityMasterRow>>,
    current_master_by_isin: HashMap<String, Vec<NseSecurityMasterRow>>,
    symbol_changes_by_exact_key: HashMap<NseI4Er2SymbolChangeKey, Vec<NseSymbolChangeRow>>,
    name_changes_by_exact_key: HashMap<NseI4Er2NameChangeKey, Vec<NseNameChangeRow>>,
    securities_available_sha256: String,
    symbol_changes_sha256: String,
    company_name_changes_sha256: String,
}

#[cfg(test)]
std::thread_local! {
    static ER2C2_SHADOW_EVALUATION_CALLS: std::cell::Cell<u64> = std::cell::Cell::new(0);
    static ER2C2_SHADOW_ENTRY_AUTOCOMMIT: std::cell::Cell<bool> = std::cell::Cell::new(false);
    static ER2C2_SHADOW_HISTORY_ROWS_AT_ENTRY: std::cell::Cell<i64> = std::cell::Cell::new(-1);
}

#[cfg(test)]
fn er2c2_shadow_test_reset() {
    ER2C2_SHADOW_EVALUATION_CALLS.with(|value| value.set(0));
    ER2C2_SHADOW_ENTRY_AUTOCOMMIT.with(|value| value.set(false));
    ER2C2_SHADOW_HISTORY_ROWS_AT_ENTRY.with(|value| value.set(-1));
}

#[cfg(test)]
fn er2c2_shadow_test_call_count() -> u64 {
    ER2C2_SHADOW_EVALUATION_CALLS.with(|value| value.get())
}

#[cfg(test)]
fn er2c2_shadow_test_entry_autocommit() -> bool {
    ER2C2_SHADOW_ENTRY_AUTOCOMMIT.with(|value| value.get())
}

#[cfg(test)]
fn er2c2_shadow_test_history_rows_at_entry() -> i64 {
    ER2C2_SHADOW_HISTORY_ROWS_AT_ENTRY.with(|value| value.get())
}

fn er2c2_normalize_code(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn er2c2_normalize_company_name(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn er2c2_observed_at_ist() -> Result<String, String> {
    let offset = chrono::FixedOffset::east_opt(19_800)
        .ok_or_else(|| "ER2C2_IST_OFFSET_UNAVAILABLE".to_string())?;
    Ok(chrono::Utc::now().with_timezone(&offset).to_rfc3339())
}

fn er2c2_evidence_id(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    format!("ER2C2-{:x}", hasher.finalize())
}

fn er2c2_symbol_change_key(
    old_symbol: &str,
    new_symbol: &str,
    effective_date: &str,
) -> NseI4Er2SymbolChangeKey {
    (
        er2c2_normalize_code(old_symbol),
        er2c2_normalize_code(new_symbol),
        effective_date.trim().to_string(),
    )
}

fn er2c2_name_change_key(
    symbol: &str,
    old_name: &str,
    new_name: &str,
    effective_date: &str,
) -> NseI4Er2NameChangeKey {
    (
        er2c2_normalize_code(symbol),
        er2c2_normalize_company_name(old_name),
        er2c2_normalize_company_name(new_name),
        effective_date.trim().to_string(),
    )
}

fn build_nse_i4_er2_shadow_indexes_from_rows(
    existing_rows: Vec<ExistingNseInstrumentRow>,
    snapshot: &NseHistoricalIdentitySourceSnapshot,
    observed_at_ist: String,
) -> NseI4Er2ShadowIndexes {
    let existing_by_symbol = existing_rows
        .into_iter()
        .map(|row| (er2c2_normalize_code(&row.symbol), row))
        .collect::<HashMap<_, _>>();

    let mut current_master_by_symbol = HashMap::<String, Vec<NseSecurityMasterRow>>::new();
    let mut current_master_by_isin = HashMap::<String, Vec<NseSecurityMasterRow>>::new();
    for row in &snapshot.master_rows {
        current_master_by_symbol
            .entry(er2c2_normalize_code(&row.symbol))
            .or_default()
            .push(row.clone());
        if let Some(isin) = row
            .isin
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            current_master_by_isin
                .entry(er2c2_normalize_code(isin))
                .or_default()
                .push(row.clone());
        }
    }
    for rows in current_master_by_symbol.values_mut() {
        rows.sort_by(|left, right| {
            left.symbol
                .cmp(&right.symbol)
                .then_with(|| left.series.cmp(&right.series))
                .then_with(|| left.isin.cmp(&right.isin))
                .then_with(|| left.company_name.cmp(&right.company_name))
        });
    }
    for rows in current_master_by_isin.values_mut() {
        rows.sort_by(|left, right| {
            left.symbol
                .cmp(&right.symbol)
                .then_with(|| left.series.cmp(&right.series))
                .then_with(|| left.company_name.cmp(&right.company_name))
        });
    }

    let mut symbol_changes_by_exact_key =
        HashMap::<NseI4Er2SymbolChangeKey, Vec<NseSymbolChangeRow>>::new();
    for row in &snapshot.symbol_change_rows {
        symbol_changes_by_exact_key
            .entry(er2c2_symbol_change_key(
                &row.old_symbol,
                &row.new_symbol,
                &row.effective_date,
            ))
            .or_default()
            .push(row.clone());
    }
    for rows in symbol_changes_by_exact_key.values_mut() {
        rows.sort_by(|left, right| {
            left.company_name
                .cmp(&right.company_name)
                .then_with(|| left.old_symbol.cmp(&right.old_symbol))
                .then_with(|| left.new_symbol.cmp(&right.new_symbol))
                .then_with(|| left.effective_date.cmp(&right.effective_date))
        });
    }

    let mut name_changes_by_exact_key =
        HashMap::<NseI4Er2NameChangeKey, Vec<NseNameChangeRow>>::new();
    for row in &snapshot.name_change_rows {
        name_changes_by_exact_key
            .entry(er2c2_name_change_key(
                &row.symbol,
                &row.old_name,
                &row.new_name,
                &row.effective_date,
            ))
            .or_default()
            .push(row.clone());
    }
    for rows in name_changes_by_exact_key.values_mut() {
        rows.sort_by(|left, right| {
            left.symbol
                .cmp(&right.symbol)
                .then_with(|| left.old_name.cmp(&right.old_name))
                .then_with(|| left.new_name.cmp(&right.new_name))
                .then_with(|| left.effective_date.cmp(&right.effective_date))
        });
    }

    NseI4Er2ShadowIndexes {
        observed_at_ist,
        existing_by_symbol,
        current_master_by_symbol,
        current_master_by_isin,
        symbol_changes_by_exact_key,
        name_changes_by_exact_key,
        securities_available_sha256: snapshot.securities_available_sha256.clone(),
        symbol_changes_sha256: snapshot.symbol_changes_sha256.clone(),
        company_name_changes_sha256: snapshot.company_name_changes_sha256.clone(),
    }
}

fn build_nse_i4_er2_shadow_indexes(
    connection: &Connection,
    snapshot: &NseHistoricalIdentitySourceSnapshot,
) -> Result<NseI4Er2ShadowIndexes, String> {
    let observed_at_ist = er2c2_observed_at_ist()?;
    let existing_rows = load_existing_nse_instrument_rows(connection)?;
    Ok(build_nse_i4_er2_shadow_indexes_from_rows(
        existing_rows,
        snapshot,
        observed_at_ist,
    ))
}

fn er2c2_adapter_error(code: &str) -> NseI4Er2ShadowState {
    NseI4Er2ShadowState::AdapterError(code.to_string())
}

fn er2c2_required_preview_text(
    value: Option<&str>,
    code: &str,
) -> Result<String, NseI4Er2ShadowState> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => Ok(value.to_string()),
        None => Err(er2c2_adapter_error(code)),
    }
}

fn reconstruct_nse_i4_er2_historical_evidence(
    preview: &NseHistoricalIdentityPreviewRow,
    indexes: &NseI4Er2ShadowIndexes,
) -> Result<NseI4Er2HistoricalEvidenceMatch, NseI4Er2ShadowState> {
    let effective_date = er2c2_required_preview_text(
        preview.effective_date.as_deref(),
        "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:EFFECTIVE_DATE",
    )?;

    match preview.change_type.as_str() {
        "SYMBOL_CHANGE" => {
            let old_symbol = er2c2_required_preview_text(
                preview.old_symbol.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OLD_SYMBOL",
            )?;
            let new_symbol = er2c2_required_preview_text(
                preview.new_symbol.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:NEW_SYMBOL",
            )?;
            let key = er2c2_symbol_change_key(&old_symbol, &new_symbol, &effective_date);
            let rows = indexes.symbol_changes_by_exact_key.get(&key);
            let count = rows.map(Vec::len).unwrap_or(0);
            if count == 0 {
                return Err(er2c2_adapter_error(
                    "ER2C2_SOURCE_EVIDENCE_NOT_FOUND:SYMBOL_CHANGE",
                ));
            }
            if count != 1 {
                return Err(er2c2_adapter_error(
                    "ER2C2_AMBIGUOUS_SOURCE_EVIDENCE:SYMBOL_CHANGE",
                ));
            }
            Ok(NseI4Er2HistoricalEvidenceMatch {
                symbol_change: rows.and_then(|values| values.first()).cloned(),
                name_change: None,
            })
        }
        "NAME_CHANGE" => {
            let symbol = er2c2_required_preview_text(
                preview
                    .current_symbol
                    .as_deref()
                    .or(preview.new_symbol.as_deref())
                    .or(preview.old_symbol.as_deref()),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:NAME_SYMBOL",
            )?;
            let old_name = er2c2_required_preview_text(
                preview.old_name.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OLD_NAME",
            )?;
            let new_name = er2c2_required_preview_text(
                preview.new_name.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:NEW_NAME",
            )?;
            let key = er2c2_name_change_key(&symbol, &old_name, &new_name, &effective_date);
            let rows = indexes.name_changes_by_exact_key.get(&key);
            let count = rows.map(Vec::len).unwrap_or(0);
            if count == 0 {
                return Err(er2c2_adapter_error(
                    "ER2C2_SOURCE_EVIDENCE_NOT_FOUND:NAME_CHANGE",
                ));
            }
            if count != 1 {
                return Err(er2c2_adapter_error(
                    "ER2C2_AMBIGUOUS_SOURCE_EVIDENCE:NAME_CHANGE",
                ));
            }
            Ok(NseI4Er2HistoricalEvidenceMatch {
                symbol_change: None,
                name_change: rows.and_then(|values| values.first()).cloned(),
            })
        }
        "BOTH" => {
            let old_symbol = er2c2_required_preview_text(
                preview.old_symbol.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OLD_SYMBOL",
            )?;
            let new_symbol = er2c2_required_preview_text(
                preview.new_symbol.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:NEW_SYMBOL",
            )?;
            let old_name = er2c2_required_preview_text(
                preview.old_name.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OLD_NAME",
            )?;
            let new_name = er2c2_required_preview_text(
                preview.new_name.as_deref(),
                "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:NEW_NAME",
            )?;
            let symbol_key = er2c2_symbol_change_key(&old_symbol, &new_symbol, &effective_date);
            let name_key = er2c2_name_change_key(&new_symbol, &old_name, &new_name, &effective_date);
            let symbol_rows = indexes.symbol_changes_by_exact_key.get(&symbol_key);
            let name_rows = indexes.name_changes_by_exact_key.get(&name_key);
            let symbol_count = symbol_rows.map(Vec::len).unwrap_or(0);
            let name_count = name_rows.map(Vec::len).unwrap_or(0);
            if symbol_count == 0 || name_count == 0 {
                return Err(er2c2_adapter_error(
                    "ER2C2_SOURCE_EVIDENCE_NOT_FOUND:BOTH",
                ));
            }
            if symbol_count != 1 || name_count != 1 {
                return Err(er2c2_adapter_error(
                    "ER2C2_AMBIGUOUS_SOURCE_EVIDENCE:BOTH",
                ));
            }
            Ok(NseI4Er2HistoricalEvidenceMatch {
                symbol_change: symbol_rows.and_then(|values| values.first()).cloned(),
                name_change: name_rows.and_then(|values| values.first()).cloned(),
            })
        }
        _ => Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::UnsupportedHistoricalChangeType,
        )),
    }
}

fn build_nse_i4_er2_local_identity(
    row: &ExistingNseInstrumentRow,
) -> IdentityResolverLocalIdentity {
    IdentityResolverLocalIdentity {
        exchange: NSE_EXCHANGE.to_string(),
        symbol: row.symbol.clone(),
        series: row.series.clone(),
        isin: row.isin.clone(),
        company_name: row.name.clone(),
        lifecycle_state: Some(if row.is_active { "ACTIVE" } else { "INACTIVE" }.to_string()),
        effective_from: None,
        effective_to: None,
    }
}

fn er2c2_current_master_reference(row: &NseSecurityMasterRow) -> String {
    format!(
        "{ER2C1_NSE_EQUITY_MASTER_REFERENCE}#symbol={};series={};isin={}",
        row.symbol,
        row.series.as_deref().unwrap_or_default(),
        row.isin.as_deref().unwrap_or_default(),
    )
}

fn build_nse_i4_er2_current_master_evidence(
    row: &NseSecurityMasterRow,
    content_sha256: &str,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let evidence_id = er2c2_evidence_id(&[
        ER2C1_NSE_EQUITY_MASTER,
        "CURRENT_MASTER",
        content_sha256,
        row.symbol.as_str(),
        row.series.as_deref().unwrap_or_default(),
        row.isin.as_deref().unwrap_or_default(),
        row.company_name.as_deref().unwrap_or_default(),
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: ER2C1_NSE_EQUITY_MASTER.to_string(),
        source_reference: er2c2_current_master_reference(row),
        content_sha256: content_sha256.to_string(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: None,
        symbol: Some(row.symbol.clone()),
        old_symbol: None,
        new_symbol: None,
        series: row.series.clone(),
        isin: row.isin.clone(),
        company_name: row.company_name.clone(),
        evidence_kind: IdentityResolverEvidenceKind::CurrentMaster,
    }
}

fn build_nse_i4_er2_symbol_change_evidence(
    row: &NseSymbolChangeRow,
    content_sha256: &str,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let company_name = row.company_name.as_deref().unwrap_or_default();
    let source_reference = format!(
        "{ER2C1_NSE_SYMBOL_CHANGE_REFERENCE}#old={};new={};date={}",
        row.old_symbol, row.new_symbol, row.effective_date,
    );
    let evidence_id = er2c2_evidence_id(&[
        ER2C1_NSE_SYMBOL_CHANGE,
        "SYMBOL_CHANGE",
        content_sha256,
        row.old_symbol.as_str(),
        row.new_symbol.as_str(),
        row.effective_date.as_str(),
        company_name,
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: ER2C1_NSE_SYMBOL_CHANGE.to_string(),
        source_reference,
        content_sha256: content_sha256.to_string(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: Some(row.effective_date.clone()),
        symbol: None,
        old_symbol: Some(row.old_symbol.clone()),
        new_symbol: Some(row.new_symbol.clone()),
        series: None,
        isin: None,
        company_name: row.company_name.clone(),
        evidence_kind: IdentityResolverEvidenceKind::SymbolChange,
    }
}

fn build_nse_i4_er2_name_change_evidence(
    row: &NseNameChangeRow,
    content_sha256: &str,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let source_reference = format!(
        "{ER2C1_NSE_COMPANY_NAME_CHANGE_REFERENCE}#symbol={};old={};new={};date={}",
        row.symbol, row.old_name, row.new_name, row.effective_date,
    );
    let evidence_id = er2c2_evidence_id(&[
        ER2C1_NSE_COMPANY_NAME_CHANGE,
        "NAME_CHANGE",
        content_sha256,
        row.symbol.as_str(),
        row.old_name.as_str(),
        row.new_name.as_str(),
        row.effective_date.as_str(),
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: ER2C1_NSE_COMPANY_NAME_CHANGE.to_string(),
        source_reference,
        content_sha256: content_sha256.to_string(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: Some(row.effective_date.clone()),
        symbol: Some(row.symbol.clone()),
        old_symbol: None,
        new_symbol: None,
        series: None,
        isin: None,
        company_name: Some(row.new_name.clone()),
        evidence_kind: IdentityResolverEvidenceKind::NameChange,
    }
}

fn build_nse_i4_er2_official_identity(
    row: &NseSecurityMasterRow,
    evidence_id: &str,
) -> IdentityResolverOfficialIdentity {
    IdentityResolverOfficialIdentity {
        exchange: NSE_EXCHANGE.to_string(),
        symbol: row.symbol.clone(),
        series: row.series.clone(),
        isin: row.isin.clone(),
        company_name: row.company_name.clone(),
        lifecycle_state: Some("ACTIVE".to_string()),
        effective_date: None,
        source_id: ER2C1_NSE_EQUITY_MASTER.to_string(),
        evidence_id: evidence_id.to_string(),
    }
}

fn er2c2_insert_evidence(
    evidence_by_id: &mut HashMap<String, IdentityResolverEvidence>,
    evidence: IdentityResolverEvidence,
) {
    evidence_by_id
        .entry(evidence.evidence_id.clone())
        .or_insert(evidence);
}

fn er2c2_local_symbol_for_preview(
    preview: &NseHistoricalIdentityPreviewRow,
) -> Result<String, NseI4Er2ShadowState> {
    match preview.change_type.as_str() {
        "SYMBOL_CHANGE" | "BOTH" => er2c2_required_preview_text(
            preview.old_symbol.as_deref(),
            "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:LOCAL_SYMBOL",
        ),
        "NAME_CHANGE" => er2c2_required_preview_text(
            preview
                .current_symbol
                .as_deref()
                .or(preview.old_symbol.as_deref())
                .or(preview.new_symbol.as_deref()),
            "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:LOCAL_SYMBOL",
        ),
        _ => Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::UnsupportedHistoricalChangeType,
        )),
    }
}

fn er2c2_official_symbol_for_preview(
    preview: &NseHistoricalIdentityPreviewRow,
) -> Result<String, NseI4Er2ShadowState> {
    match preview.change_type.as_str() {
        "SYMBOL_CHANGE" | "BOTH" => er2c2_required_preview_text(
            preview.new_symbol.as_deref(),
            "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OFFICIAL_SYMBOL",
        ),
        "NAME_CHANGE" => er2c2_required_preview_text(
            preview
                .current_symbol
                .as_deref()
                .or(preview.new_symbol.as_deref())
                .or(preview.old_symbol.as_deref()),
            "ER2C2_INVALID_I4_PREVIEW_ROW_SHAPE:OFFICIAL_SYMBOL",
        ),
        _ => Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::UnsupportedHistoricalChangeType,
        )),
    }
}

fn build_nse_i4_er2_input(
    preview: &NseHistoricalIdentityPreviewRow,
    indexes: &NseI4Er2ShadowIndexes,
) -> Result<IdentityResolverInput, NseI4Er2ShadowState> {
    let historical = reconstruct_nse_i4_er2_historical_evidence(preview, indexes)?;
    let local_symbol = er2c2_local_symbol_for_preview(preview)?;
    let official_symbol = er2c2_official_symbol_for_preview(preview)?;

    let Some(local) = indexes
        .existing_by_symbol
        .get(&er2c2_normalize_code(&local_symbol))
    else {
        return Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::NoLocalIdentity,
        ));
    };

    let official_key = er2c2_normalize_code(&official_symbol);
    let Some(official_rows) = indexes.current_master_by_symbol.get(&official_key) else {
        return Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::NoOfficialCurrentIdentity,
        ));
    };
    if official_rows.len() != 1 {
        return Err(er2c2_adapter_error(
            "ER2C2_AMBIGUOUS_OFFICIAL_CURRENT_IDENTITY",
        ));
    }
    let Some(official_row) = official_rows.first() else {
        return Err(NseI4Er2ShadowState::NotEvaluated(
            NseI4Er2ShadowReason::NoOfficialCurrentIdentity,
        ));
    };

    let current_evidence = build_nse_i4_er2_current_master_evidence(
        official_row,
        &indexes.securities_available_sha256,
        &indexes.observed_at_ist,
    );
    let current_evidence_id = current_evidence.evidence_id.clone();
    let mut evidence_by_id = HashMap::<String, IdentityResolverEvidence>::new();
    er2c2_insert_evidence(&mut evidence_by_id, current_evidence);

    if let Some(isin) = official_row
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(peers) = indexes.current_master_by_isin.get(&er2c2_normalize_code(isin)) {
            for peer in peers {
                er2c2_insert_evidence(
                    &mut evidence_by_id,
                    build_nse_i4_er2_current_master_evidence(
                        peer,
                        &indexes.securities_available_sha256,
                        &indexes.observed_at_ist,
                    ),
                );
            }
        }
    }

    if let Some(row) = historical.symbol_change.as_ref() {
        er2c2_insert_evidence(
            &mut evidence_by_id,
            build_nse_i4_er2_symbol_change_evidence(
                row,
                &indexes.symbol_changes_sha256,
                &indexes.observed_at_ist,
            ),
        );
    }
    if let Some(row) = historical.name_change.as_ref() {
        er2c2_insert_evidence(
            &mut evidence_by_id,
            build_nse_i4_er2_name_change_evidence(
                row,
                &indexes.company_name_changes_sha256,
                &indexes.observed_at_ist,
            ),
        );
    }

    let mut evidence = evidence_by_id.into_values().collect::<Vec<_>>();
    evidence.sort_by(|left, right| left.evidence_id.cmp(&right.evidence_id));

    Ok(IdentityResolverInput {
        local_identity: build_nse_i4_er2_local_identity(local),
        official_identity: Some(build_nse_i4_er2_official_identity(
            official_row,
            &current_evidence_id,
        )),
        evidence,
        required_source_health: IdentityResolverSourceAvailability::Available,
    })
}

fn classify_nse_i4_er2_resolver_outcome(
    outcome: Result<IdentityResolverResult, IdentityResolverEvaluationError>,
) -> NseI4Er2ShadowState {
    match outcome {
        Ok(result) => NseI4Er2ShadowState::Evaluated(result),
        Err(IdentityResolverEvaluationError::NoMismatchToResolve) => {
            NseI4Er2ShadowState::NoMaterialResolverMismatch
        }
        Err(IdentityResolverEvaluationError::InvalidInput(message)) => {
            NseI4Er2ShadowState::ResolverError(NseI4Er2ShadowResolverError::InvalidInput(message))
        }
        Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates { rule_ids }) => {
            NseI4Er2ShadowState::ResolverError(
                NseI4Er2ShadowResolverError::AmbiguousDeterministicCandidates { rule_ids },
            )
        }
        Err(IdentityResolverEvaluationError::InvalidConstructedResult(message)) => {
            NseI4Er2ShadowState::ResolverError(
                NseI4Er2ShadowResolverError::InvalidConstructedResult(message),
            )
        }
    }
}

fn nse_i4_er2_shadow_relationship(
    state: &NseI4Er2ShadowState,
) -> NseI4Er2ShadowRelationship {
    match state {
        NseI4Er2ShadowState::Evaluated(result) => match result.status {
            IdentityResolverStatus::Confirmed => {
                NseI4Er2ShadowRelationship::IdentityContinuitySupported
            }
            IdentityResolverStatus::Conflict => NseI4Er2ShadowRelationship::ResolverConflict,
            IdentityResolverStatus::InsufficientEvidence
            | IdentityResolverStatus::ProbableReview => {
                NseI4Er2ShadowRelationship::ResolverNeedsMoreEvidence
            }
            IdentityResolverStatus::SourceUnavailable => {
                NseI4Er2ShadowRelationship::SourceUnavailable
            }
        },
        NseI4Er2ShadowState::NoMaterialResolverMismatch => {
            NseI4Er2ShadowRelationship::NoMaterialResolverMismatch
        }
        NseI4Er2ShadowState::ResolverError(_) => NseI4Er2ShadowRelationship::ResolverError,
        NseI4Er2ShadowState::NotEvaluated(_) => NseI4Er2ShadowRelationship::NotEvaluated,
        NseI4Er2ShadowState::AdapterError(_) => NseI4Er2ShadowRelationship::AdapterError,
    }
}

fn nse_i4_er2_shadow_evaluation_from_state(
    preview: &NseHistoricalIdentityPreviewRow,
    local_symbol: Option<String>,
    official_symbol: Option<String>,
    state: NseI4Er2ShadowState,
) -> NseI4Er2ShadowEvaluation {
    let relationship = nse_i4_er2_shadow_relationship(&state);
    NseI4Er2ShadowEvaluation {
        i4_disposition: preview.disposition.clone(),
        change_type: preview.change_type.clone(),
        effective_date: preview.effective_date.clone(),
        local_symbol,
        official_symbol,
        state,
        relationship,
    }
}

fn evaluate_nse_i4_er2_shadow_row(
    preview: &NseHistoricalIdentityPreviewRow,
    indexes: &NseI4Er2ShadowIndexes,
) -> NseI4Er2ShadowEvaluation {
    if preview.disposition == "SKIPPED" {
        return nse_i4_er2_shadow_evaluation_from_state(
            preview,
            None,
            None,
            NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowSkipped),
        );
    }
    if preview.disposition == "ERROR" {
        return nse_i4_er2_shadow_evaluation_from_state(
            preview,
            None,
            None,
            NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowError),
        );
    }
    if preview.disposition != "NEW" && preview.disposition != "DUPLICATE" {
        return nse_i4_er2_shadow_evaluation_from_state(
            preview,
            None,
            None,
            er2c2_adapter_error("ER2C2_INVALID_I4_DISPOSITION"),
        );
    }

    let resolver_input = match build_nse_i4_er2_input(preview, indexes) {
        Ok(input) => input,
        Err(state) => {
            return nse_i4_er2_shadow_evaluation_from_state(preview, None, None, state);
        }
    };
    let local_symbol = Some(resolver_input.local_identity.symbol.clone());
    let official_symbol = resolver_input
        .official_identity
        .as_ref()
        .map(|identity| identity.symbol.clone());
    let state = classify_nse_i4_er2_resolver_outcome(resolve_identity(&resolver_input));
    nse_i4_er2_shadow_evaluation_from_state(
        preview,
        local_symbol,
        official_symbol,
        state,
    )
}

fn nse_i4_er2_uniform_shadow_evaluations(
    result: &NseHistoricalIdentityResult,
    state: NseI4Er2ShadowState,
) -> Vec<NseI4Er2ShadowEvaluation> {
    result
        .history_rows
        .iter()
        .map(|preview| {
            nse_i4_er2_shadow_evaluation_from_state(
                preview,
                None,
                None,
                state.clone(),
            )
        })
        .collect()
}

fn summarize_nse_i4_er2_shadow(
    evaluations: &[NseI4Er2ShadowEvaluation],
) -> NseI4Er2ShadowSummary {
    let mut summary = NseI4Er2ShadowSummary {
        history_rows: evaluations.len(),
        ..NseI4Er2ShadowSummary::default()
    };

    for evaluation in evaluations {
        match evaluation.i4_disposition.as_str() {
            "NEW" => summary.new_rows += 1,
            "DUPLICATE" => summary.duplicate_rows += 1,
            "SKIPPED" => summary.skipped_rows += 1,
            "ERROR" => summary.error_rows += 1,
            _ => {}
        }
        match evaluation.relationship {
            NseI4Er2ShadowRelationship::IdentityContinuitySupported => {
                summary.continuity_supported += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::ResolverConflict => {
                summary.resolver_conflicts += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::ResolverNeedsMoreEvidence => {
                summary.needs_more_evidence += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::NoMaterialResolverMismatch => {
                summary.no_material_mismatch += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::SourceUnavailable => {
                summary.source_unavailable += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::ResolverError => {
                summary.resolver_errors += 1;
                summary.evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::NotEvaluated => {
                summary.not_evaluated_rows += 1;
            }
            NseI4Er2ShadowRelationship::AdapterError => {
                summary.adapter_error_rows += 1;
            }
        }
    }
    summary.eligible_rows = summary.evaluated_rows + summary.adapter_error_rows;
    summary
}

fn evaluate_nse_i4_er2_shadow(
    connection: &Connection,
    snapshot: &NseHistoricalIdentitySourceSnapshot,
    result: &NseHistoricalIdentityResult,
) -> Vec<NseI4Er2ShadowEvaluation> {
    #[cfg(test)]
    {
        ER2C2_SHADOW_EVALUATION_CALLS.with(|value| value.set(value.get().saturating_add(1)));
        ER2C2_SHADOW_ENTRY_AUTOCOMMIT.with(|value| value.set(connection.is_autocommit()));
        let history_rows = connection
            .query_row(
                "SELECT COUNT(*) FROM instrument_identity_history",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(-1);
        ER2C2_SHADOW_HISTORY_ROWS_AT_ENTRY.with(|value| value.set(history_rows));
    }

    let indexes = match build_nse_i4_er2_shadow_indexes(connection, snapshot) {
        Ok(indexes) => indexes,
        Err(error) => {
            return nse_i4_er2_uniform_shadow_evaluations(
                result,
                NseI4Er2ShadowState::AdapterError(error),
            );
        }
    };

    result
        .history_rows
        .iter()
        .map(|preview| evaluate_nse_i4_er2_shadow_row(preview, &indexes))
        .collect()
}

fn preview_nse_historical_identity_archive_internal(
    connection: &Connection,
    input: &NseHistoricalIdentityPreviewInput,
) -> AppResult<NseHistoricalIdentityResult> {
    let snapshot = load_nse_historical_identity_source_snapshot(input)?;
    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let execution = execute_nse_historical_identity_plan(connection, &snapshot);
    match execution {
        Ok(mut result) => {
            connection
                .execute_batch("ROLLBACK")
                .map_err(|error| error.to_string())?;
            result.applied = false;
            let er2c2_shadow = evaluate_nse_i4_er2_shadow(connection, &snapshot, &result);
            let _er2c2_shadow_summary = summarize_nse_i4_er2_shadow(&er2c2_shadow);
            Ok(result)
        }
        Err(error) => {
            rollback_nse_historical_identity_transaction(connection);
            Err(error)
        }
    }
}

fn normalize_expected_nse_historical_plan_sha256(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.len() != 64 || !normalized.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR.to_string());
    }
    Ok(normalized)
}

#[cfg(test)]
fn apply_nse_historical_identity_archive_internal(
    connection: &Connection,
    input: &NseHistoricalIdentityApplyInput,
) -> AppResult<NseHistoricalIdentityResult> {
    apply_nse_historical_identity_archive_with_progress(connection, input, &|_| {})
}

fn apply_nse_historical_identity_archive_with_progress(
    connection: &Connection, input: &NseHistoricalIdentityApplyInput, report: &dyn Fn(apply_reporting::IdentityApplyProgress),
) -> AppResult<NseHistoricalIdentityResult> {
    report(historical_reporting::progress("checking",0,0));
    let snapshot = load_nse_historical_identity_source_snapshot(&NseHistoricalIdentityPreviewInput {
        archive_root_path: input.archive_root_path.clone(),
    })?;
    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;

    let prior_id: i64 = match connection.query_row("SELECT COALESCE(MAX(id),0) FROM instrument_identity_history", [], |r| r.get(0)) { Ok(id) => id, Err(e) => { rollback_nse_historical_identity_transaction(connection); return Err(e.to_string()); } };
    let total = snapshot.symbol_change_rows.len() + snapshot.name_change_rows.len();
    report(historical_reporting::progress("applying",0,total));
    let execution = execute_nse_historical_identity_plan_with_progress(connection, &snapshot, &|done,total| report(historical_reporting::progress("applying",done,total)));
    let mut result = match execution {
        Ok(result) => result,
        Err(error) => {
            rollback_nse_historical_identity_transaction(connection);
            return Err(error);
        }
    };

    if !result.can_apply {
        rollback_nse_historical_identity_transaction(connection);
        return Err(NSE_HISTORICAL_PREVIEW_ERRORS.to_string());
    }

    let expected = match normalize_expected_nse_historical_plan_sha256(&input.expected_plan_sha256)
    {
        Ok(value) => value,
        Err(error) => {
            rollback_nse_historical_identity_transaction(connection);
            return Err(error);
        }
    };
    if expected != result.plan_sha256 {
        rollback_nse_historical_identity_transaction(connection);
        return Err(NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR.to_string());
    }

    if !historical_reporting::actionable(&result) {
        rollback_nse_historical_identity_transaction(connection);
        return Err("No historical identity changes to apply. Create a new preview.".into());
    }
    result.category_evidence = Some(historical_categories::build(&snapshot, &result.history_rows));
    if let Err(error) = historical_reporting::save_receipt(connection, &mut result, prior_id) {
        rollback_nse_historical_identity_transaction(connection); return Err(error);
    }
    report(historical_reporting::progress("committing",total,total));
    if let Err(error) = connection.execute_batch("COMMIT") {
        rollback_nse_historical_identity_transaction(connection);
        return Err(error.to_string());
    }
    report(historical_reporting::progress("committed",total,total));
    Ok(result)
}

fn build_nse_current_universe_sync_plan_from_master_rows(
    connection: &Connection,
    archive_root: &Path,
    master_rows_read: u32,
    current_rows: Vec<NseSecurityMasterRow>,
) -> AppResult<NseCurrentUniverseSyncPlan> {
    let existing_rows = load_existing_nse_instrument_rows(connection)?;
    let history_hints = load_identity_history_hints(connection, NSE_EXCHANGE)?;
    let urls = load_official_source_urls(Some(connection))?;
    let official_delisted_symbols =
        load_nse_official_delisted_symbols(archive_root, &urls).unwrap_or_else(|_| HashSet::new());

    Ok(plan_nse_current_universe_sync_from_rows(
        archive_root.display().to_string(),
        master_rows_read,
        current_rows,
        existing_rows,
        history_hints,
        official_delisted_symbols,
    ))
}

fn validate_nse_current_population_sanity(current_symbols: usize) -> AppResult<()> {
    if current_symbols < NSE_CURRENT_POPULATION_SANITY_MINIMUM {
        return Err(format!(
            "{SOURCE_POPULATION_SANITY_REJECTED}: NSE current universe has {current_symbols} supported symbols; minimum accepted population is {NSE_CURRENT_POPULATION_SANITY_MINIMUM}."
        ));
    }
    Ok(())
}

pub(super) fn validate_nse_equity_master_bytes_for_health(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<usize> {
    let allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();
    load_security_master_rows_from_bytes(bytes, source_label, Some(&allowed))
        .map(|rows| rows.len())
}

pub(super) fn validate_nse_sme_master_bytes_for_health(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<usize> {
    let allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();
    load_security_master_rows_from_bytes(bytes, source_label, Some(&allowed))
        .map(|rows| rows.len())
}

pub(super) fn validate_nse_symbol_change_bytes_for_health(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<usize> {
    load_symbol_change_rows_from_bytes(bytes, source_label).map(|rows| rows.len())
}

pub(super) fn validate_nse_company_name_change_bytes_for_health(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<usize> {
    validate_nse_company_name_change_download(bytes, source_label).map(|rows| rows as usize)
}

pub(super) fn validate_nse_current_population_for_health(current_symbols: usize) -> AppResult<()> {
    validate_nse_current_population_sanity(current_symbols)
}

pub(super) fn validate_nse_delisted_workbook_bytes_for_health(bytes: &[u8]) -> AppResult<usize> {
    parse_nse_delisted_workbook(bytes).map(|symbols| symbols.len())
}

fn build_nse_current_universe_sync_plan(
    connection: &Connection,
    input: &NseCurrentUniverseSyncInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncPlan> {
    let archive_root = resolve_nse_current_universe_archive_root(input, default_archive_root)?;
    let (equity_path, sme_path) = resolve_current_universe_master_paths(&archive_root)?;
    ensure_current_universe_master_file_is_fresh(&equity_path)?;
    if let Some(path) = sme_path.as_ref() {
        ensure_current_universe_master_file_is_fresh(path)?;
    }
    let (master_rows_read, current_rows) =
        load_current_universe_master_rows(&equity_path, sme_path.as_deref())?;
    validate_nse_current_population_sanity(current_rows.len())?;
    build_nse_current_universe_sync_plan_from_master_rows(
        connection,
        &archive_root,
        master_rows_read,
        current_rows,
    )
}

fn apply_nse_current_universe_sync_plan_in_open_transaction(
    connection: &Connection,
    plan: &NseCurrentUniverseSyncPlan,
) -> AppResult<()> {
    apply_nse_current_universe_sync_plan_with_progress(connection, plan, &|_| {})
}

fn apply_nse_current_universe_sync_plan_with_progress(
    connection: &Connection, plan: &NseCurrentUniverseSyncPlan, report: &dyn Fn(usize),
) -> AppResult<()> {
    let mut processed = 0;
    if plan.deactivate_symbols.iter().any(|symbol| !matches!(
        plan.deactivate_lifecycle_by_symbol.get(symbol).map(String::as_str), Some("OLD_SYMBOL" | "DELISTED")
    )) {
        return Err("NSE deactivation plan lacks explicit lifecycle evidence. Preview again.".to_string());
    }

    for row in &plan.current_rows {
        connection
            .execute(
                "
                  INSERT INTO instruments (
                    symbol,
                    exchange,
                    isin,
                    name,
                    series,
                    is_active,
                    lifecycle_status,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, 1, 'CURRENT', datetime('now'))
                  ON CONFLICT(symbol, exchange) DO UPDATE SET
                    isin = COALESCE(excluded.isin, instruments.isin),
                    name = COALESCE(excluded.name, instruments.name),
                    series = COALESCE(excluded.series, instruments.series),
                    is_active = 1,
                    lifecycle_status = 'CURRENT',
                    updated_at = excluded.updated_at
                ",
                params![
                    row.symbol,
                    NSE_EXCHANGE,
                    row.isin,
                    row.company_name,
                    row.series
                ],
            )
            .map_err(|error| error.to_string())?;
        processed += 1;
        report(processed);
    }

    for symbol in &plan.deactivate_symbols {
        let lifecycle_status = plan
            .deactivate_lifecycle_by_symbol
            .get(symbol)
            .cloned()
            .ok_or_else(|| "NSE deactivation plan lacks lifecycle evidence.".to_string())?;
        connection
            .execute(
                "
                  UPDATE instruments
                  SET is_active = 0,
                      lifecycle_status = ?,
                      updated_at = datetime('now')
                  WHERE symbol = ?
                    AND exchange = ?
                ",
                params![lifecycle_status, symbol, NSE_EXCHANGE],
            )
            .map_err(|error| error.to_string())?;
        processed += 1;
        report(processed);
    }

    Ok(())
}

fn apply_nse_current_universe_sync_plan(
    connection: &Connection,
    plan: &NseCurrentUniverseSyncPlan,
) -> AppResult<()> {
    if connection.is_autocommit() {
        return super::run_connection_transaction(connection, |connection| {
            apply_nse_current_universe_sync_plan_in_open_transaction(connection, plan)
        });
    }

    apply_nse_current_universe_sync_plan_in_open_transaction(connection, plan)
}

fn hash_plan_bytes(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

fn hash_plan_string(hasher: &mut Sha256, value: &str) {
    hash_plan_bytes(hasher, value.as_bytes());
}

fn hash_plan_optional_string(hasher: &mut Sha256, value: Option<&str>) {
    match value {
        Some(value) => {
            hasher.update([1_u8]);
            hash_plan_string(hasher, value);
        }
        None => {
            hasher.update([0_u8]);
        }
    }
}

fn hash_plan_u32(hasher: &mut Sha256, value: u32) {
    hasher.update(value.to_le_bytes());
}

fn nse_current_universe_plan_sha256(plan: &NseCurrentUniverseSyncPlan) -> String {
    let mut hasher = Sha256::new();
    hash_plan_string(&mut hasher, NSE_CURRENT_UNIVERSE_SYNC_PLAN_HASH_VERSION);
    hash_plan_string(&mut hasher, &plan.archive_root_path);
    hash_plan_u32(&mut hasher, plan.master_rows_read);
    hash_plan_u32(&mut hasher, plan.current_universe_symbols);
    hash_plan_u32(&mut hasher, plan.matched_by_symbol);
    hash_plan_u32(&mut hasher, plan.matched_by_isin);
    hash_plan_u32(&mut hasher, plan.matched_by_identity);
    hash_plan_u32(&mut hasher, plan.new_symbols);
    hash_plan_u32(&mut hasher, plan.activate_count);
    hash_plan_u32(&mut hasher, plan.update_count);
    hash_plan_u32(&mut hasher, plan.deactivate_count);
    hash_plan_u32(&mut hasher, plan.unchanged_active);
    hash_plan_u32(&mut hasher, plan.identity_history_rows);
    hash_plan_u32(&mut hasher, plan.official_delisted_symbols);

    let mut current_rows = plan.current_rows.clone();
    current_rows.sort_by(|left, right| {
        (
            left.symbol.as_str(),
            left.company_name.as_deref(),
            left.isin.as_deref(),
            left.series.as_deref(),
        )
            .cmp(&(
                right.symbol.as_str(),
                right.company_name.as_deref(),
                right.isin.as_deref(),
                right.series.as_deref(),
            ))
    });
    hash_plan_u32(&mut hasher, current_rows.len() as u32);
    for row in &current_rows {
        hash_plan_string(&mut hasher, &row.symbol);
        hash_plan_optional_string(&mut hasher, row.company_name.as_deref());
        hash_plan_optional_string(&mut hasher, row.isin.as_deref());
        hash_plan_optional_string(&mut hasher, row.series.as_deref());
    }

    let mut deactivate_symbols = plan.deactivate_symbols.clone();
    deactivate_symbols.sort();
    hash_plan_u32(&mut hasher, deactivate_symbols.len() as u32);
    for symbol in &deactivate_symbols {
        hash_plan_string(&mut hasher, symbol);
    }

    let mut lifecycle_rows = plan
        .deactivate_lifecycle_by_symbol
        .iter()
        .map(|(symbol, lifecycle)| (symbol.as_str(), lifecycle.as_str()))
        .collect::<Vec<_>>();
    lifecycle_rows.sort();
    hash_plan_u32(&mut hasher, lifecycle_rows.len() as u32);
    for (symbol, lifecycle) in lifecycle_rows {
        hash_plan_string(&mut hasher, symbol);
        hash_plan_string(&mut hasher, lifecycle);
    }

    let mut preview_rows = plan.preview_rows.clone();
    preview_rows.sort_by(|left, right| {
        (
            left.action.as_str(),
            left.symbol.as_str(),
            left.company_name.as_deref(),
            left.series.as_deref(),
            left.isin.as_deref(),
            left.current_status.as_str(),
            left.proposed_status.as_str(),
            left.matched_symbol.as_deref(),
            left.reason.as_str(),
        )
            .cmp(&(
                right.action.as_str(),
                right.symbol.as_str(),
                right.company_name.as_deref(),
                right.series.as_deref(),
                right.isin.as_deref(),
                right.current_status.as_str(),
                right.proposed_status.as_str(),
                right.matched_symbol.as_deref(),
                right.reason.as_str(),
            ))
    });
    hash_plan_u32(&mut hasher, preview_rows.len() as u32);
    for row in &preview_rows {
        hash_plan_string(&mut hasher, &row.action);
        hash_plan_string(&mut hasher, &row.symbol);
        hash_plan_optional_string(&mut hasher, row.company_name.as_deref());
        hash_plan_optional_string(&mut hasher, row.series.as_deref());
        hash_plan_optional_string(&mut hasher, row.isin.as_deref());
        hash_plan_string(&mut hasher, &row.current_status);
        hash_plan_string(&mut hasher, &row.proposed_status);
        hash_plan_optional_string(&mut hasher, row.matched_symbol.as_deref());
        hash_plan_string(&mut hasher, &row.reason);
    }

    format!("{:x}", hasher.finalize())
}

fn nse_historical_identity_plan_sha256(result: &NseHistoricalIdentityResult) -> String {
    let mut hasher = Sha256::new();
    hash_plan_string(
        &mut hasher,
        NSE_HISTORICAL_IDENTITY_PLAN_HASH_VERSION,
    );
    hash_plan_string(&mut hasher, &result.archive_root_path);
    hash_plan_string(&mut hasher, &result.securities_available_sha256);
    hash_plan_string(&mut hasher, &result.symbol_changes_sha256);
    hash_plan_string(&mut hasher, &result.company_name_changes_sha256);
    hasher.update([if result.can_apply { 1_u8 } else { 0_u8 }]);
    hash_plan_u32(&mut hasher, result.master_rows_read);
    hash_plan_u32(&mut hasher, result.master_rows_planned);
    hash_plan_u32(&mut hasher, result.current_equity_symbols);
    hash_plan_u32(&mut hasher, result.symbol_change_rows_read);
    hash_plan_u32(&mut hasher, result.name_change_rows_read);
    hash_plan_u32(&mut hasher, result.new_symbol_changes);
    hash_plan_u32(&mut hasher, result.new_name_changes);
    hash_plan_u32(&mut hasher, result.new_combined_changes);
    hash_plan_u32(&mut hasher, result.duplicate_rows);
    hash_plan_u32(&mut hasher, result.skipped_rows);
    hash_plan_u32(&mut hasher, result.error_rows);
    hash_plan_optional_string(
        &mut hasher,
        result.current_universe_plan_sha256.as_deref(),
    );
    hash_plan_u32(&mut hasher, result.active_sync_activate_count);
    hash_plan_u32(&mut hasher, result.active_sync_update_count);
    hash_plan_u32(&mut hasher, result.active_sync_deactivate_count);
    hash_plan_u32(&mut hasher, result.active_sync_unchanged_count);

    let mut history_rows = result.history_rows.clone();
    history_rows.sort_by(|left, right| {
        (
            left.disposition.as_str(),
            left.change_type.as_str(),
            left.effective_date.as_deref(),
            left.old_symbol.as_deref(),
            left.new_symbol.as_deref(),
            left.current_symbol.as_deref(),
            left.old_name.as_deref(),
            left.new_name.as_deref(),
            left.source_file.as_str(),
            left.detail.as_str(),
        )
            .cmp(&(
                right.disposition.as_str(),
                right.change_type.as_str(),
                right.effective_date.as_deref(),
                right.old_symbol.as_deref(),
                right.new_symbol.as_deref(),
                right.current_symbol.as_deref(),
                right.old_name.as_deref(),
                right.new_name.as_deref(),
                right.source_file.as_str(),
                right.detail.as_str(),
            ))
    });
    hash_plan_u32(&mut hasher, history_rows.len() as u32);
    for row in &history_rows {
        hash_plan_string(&mut hasher, &row.disposition);
        hash_plan_string(&mut hasher, &row.change_type);
        hash_plan_optional_string(&mut hasher, row.effective_date.as_deref());
        hash_plan_optional_string(&mut hasher, row.old_symbol.as_deref());
        hash_plan_optional_string(&mut hasher, row.new_symbol.as_deref());
        hash_plan_optional_string(&mut hasher, row.current_symbol.as_deref());
        hash_plan_optional_string(&mut hasher, row.old_name.as_deref());
        hash_plan_optional_string(&mut hasher, row.new_name.as_deref());
        hash_plan_string(&mut hasher, &row.source_file);
        hash_plan_string(&mut hasher, &row.detail);
    }

    let mut errors = result.errors.clone();
    errors.sort();
    hash_plan_u32(&mut hasher, errors.len() as u32);
    for error in &errors {
        hash_plan_string(&mut hasher, error);
    }

    format!("{:x}", hasher.finalize())
}

fn normalize_expected_nse_plan_sha256(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.len() != 64 || !normalized.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(NSE_REVIEWED_PLAN_STALE_ERROR.to_string());
    }
    Ok(normalized)
}

fn plan_into_result(
    plan: NseCurrentUniverseSyncPlan,
    applied: bool,
    plan_sha256: String,
) -> NseCurrentUniverseSyncResult {
    let held_active = plan.preview_rows.iter().filter(|row| matches!(row.action.as_str(), "REVIEW_REQUIRED" | "OUTSIDE_COVERAGE")).count();
    let message = if applied {
        format!(
            "Applied NSE current-universe sync. Active {}/{} current official symbols. Activated {}, updated {}, deactivated {}, unchanged {}, official delisted {}. Held active for coverage/evidence review {}.",
            plan.current_universe_symbols.saturating_sub(plan.new_symbols),
            plan.current_universe_symbols,
            plan.activate_count,
            plan.update_count,
            plan.deactivate_count,
            plan.unchanged_active,
            plan.official_delisted_symbols,
            held_active
        )
    } else {
        format!(
            "Previewed NSE current-universe sync. {} current official symbols. Activate {}, update {}, deactivate {}, unchanged {}, official delisted {}. Held active for coverage/evidence review {}.",
            plan.current_universe_symbols,
            plan.activate_count,
            plan.update_count,
            plan.deactivate_count,
            plan.unchanged_active,
            plan.official_delisted_symbols,
            held_active
        )
    };

    NseCurrentUniverseSyncResult {
        archive_root_path: plan.archive_root_path,
        applied,
        run_id: None,
        completed_at: None,
        refresh_warning: None,
        master_rows_read: plan.master_rows_read,
        current_universe_symbols: plan.current_universe_symbols,
        matched_by_symbol: plan.matched_by_symbol,
        matched_by_isin: plan.matched_by_isin,
        matched_by_identity: plan.matched_by_identity,
        new_symbols: plan.new_symbols,
        activate_count: plan.activate_count,
        update_count: plan.update_count,
        deactivate_count: plan.deactivate_count,
        unchanged_active: plan.unchanged_active,
        identity_history_rows: plan.identity_history_rows,
        official_delisted_symbols: plan.official_delisted_symbols,
        preview_rows: plan.preview_rows,
        plan_sha256,
        message,
    }
}

fn plan_nse_current_universe_sync_from_rows(
    archive_root_path: String,
    master_rows_read: u32,
    current_rows: Vec<NseSecurityMasterRow>,
    existing_rows: Vec<ExistingNseInstrumentRow>,
    history_hints: NseIdentityHistoryHints,
    official_delisted_symbols: HashSet<String>,
) -> NseCurrentUniverseSyncPlan {
    let existing_by_symbol = existing_rows
        .iter()
        .map(|row| (row.symbol.clone(), row.clone()))
        .collect::<HashMap<_, _>>();
    let existing_by_isin = build_unique_existing_isin_map(&existing_rows);
    let current_symbols = current_rows
        .iter()
        .map(|row| row.symbol.clone())
        .collect::<HashSet<_>>();

    let mut matched_by_symbol = 0_u32;
    let mut matched_by_isin = 0_u32;
    let mut matched_by_identity = 0_u32;
    let mut new_symbols = 0_u32;
    let mut activate_count = 0_u32;
    let mut update_count = 0_u32;
    let mut unchanged_active = 0_u32;
    let mut preview_rows = Vec::new();
    let mut deactivate_lifecycle_by_symbol = HashMap::new();

    for row in &current_rows {
        if let Some(existing) = existing_by_symbol.get(&row.symbol) {
            matched_by_symbol += 1;
            let metadata_changed = security_master_metadata_changed(existing, row);
            if existing.is_active {
                if metadata_changed {
                    update_count += 1;
                    preview_rows.push(NseCurrentUniverseSyncPreviewRow {
                        action: "UPDATE".to_string(),
                        symbol: row.symbol.clone(),
                        company_name: row.company_name.clone(),
                        series: row.series.clone(),
                        isin: row.isin.clone(),
                        current_status: "ACTIVE".to_string(),
                        proposed_status: "ACTIVE".to_string(),
                        matched_symbol: Some(existing.symbol.clone()),
                        reason: "Exact symbol matched in instruments; metadata will be refreshed from the current NSE master.".to_string(),
                    });
                } else {
                    unchanged_active += 1;
                }
            } else {
                activate_count += 1;
                preview_rows.push(NseCurrentUniverseSyncPreviewRow {
                    action: "REACTIVATE".to_string(),
                    symbol: row.symbol.clone(),
                    company_name: row.company_name.clone(),
                    series: row.series.clone(),
                    isin: row.isin.clone(),
                    current_status: "INACTIVE".to_string(),
                    proposed_status: "ACTIVE".to_string(),
                    matched_symbol: Some(existing.symbol.clone()),
                    reason: "Exact symbol matched an inactive row; it will be reactivated from the current NSE master.".to_string(),
                });
            }
            continue;
        }

        let (matched_symbol, reason, matched_by_isin_hit, matched_by_identity_hit) =
            resolve_current_universe_insert_match(row, &existing_by_isin, &history_hints);
        if matched_by_isin_hit {
            matched_by_isin += 1;
        } else if matched_by_identity_hit {
            matched_by_identity += 1;
        }

        new_symbols += 1;
        activate_count += 1;
        preview_rows.push(NseCurrentUniverseSyncPreviewRow {
            action: "INSERT".to_string(),
            symbol: row.symbol.clone(),
            company_name: row.company_name.clone(),
            series: row.series.clone(),
            isin: row.isin.clone(),
            current_status: "MISSING".to_string(),
            proposed_status: "ACTIVE".to_string(),
            matched_symbol,
            reason,
        });
    }

    let mut deactivate_symbols = Vec::new();
    for row in &existing_rows {
        if row.is_active && !current_symbols.contains(&row.symbol) {
            let lifecycle_status = classify_nse_inactive_lifecycle(
                row, &history_hints, &official_delisted_symbols, &current_symbols,
            );
            let can_deactivate = matches!(lifecycle_status.as_str(), "OLD_SYMBOL" | "DELISTED");
            if can_deactivate {
                deactivate_symbols.push(row.symbol.clone());
                deactivate_lifecycle_by_symbol.insert(row.symbol.clone(), lifecycle_status.clone());
            }
            preview_rows.push(NseCurrentUniverseSyncPreviewRow {
                action: lifecycle_status.clone(),
                symbol: row.symbol.clone(),
                company_name: row.name.clone(),
                series: row.series.clone(),
                isin: row.isin.clone(),
                current_status: "ACTIVE".to_string(),
                proposed_status: if can_deactivate { lifecycle_status.clone() } else { "ACTIVE".to_string() },
                matched_symbol: None,
                reason: nse_inactive_lifecycle_reason(&lifecycle_status),
            });
        }
    }

    preview_rows.sort_by(|left, right| {
        current_sync_action_rank(&left.action)
            .cmp(&current_sync_action_rank(&right.action))
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    deactivate_symbols.sort();

    NseCurrentUniverseSyncPlan {
        archive_root_path,
        master_rows_read,
        current_universe_symbols: current_rows.len() as u32,
        matched_by_symbol,
        matched_by_isin,
        matched_by_identity,
        new_symbols,
        activate_count,
        update_count,
        deactivate_count: deactivate_symbols.len() as u32,
        unchanged_active,
        identity_history_rows: history_hints.row_count,
        official_delisted_symbols: official_delisted_symbols.len() as u32,
        preview_rows,
        current_rows,
        deactivate_symbols,
        deactivate_lifecycle_by_symbol,
    }
}



// ER2-C1: private NSE I3 shadow evidence adapter. These values are deliberately
// in-memory only; they are not serialized, persisted, logged, or used by Apply.
#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI3Er2ShadowResolverError {
    InvalidInput(String),
    AmbiguousDeterministicCandidates {
        rule_ids: Vec<IdentityResolverRuleId>,
    },
    InvalidConstructedResult(String),
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI3Er2ShadowState {
    Evaluated(IdentityResolverResult),
    NoMaterialResolverMismatch,
    ResolverError(NseI3Er2ShadowResolverError),
    NotEvaluated(NseI3Er2ShadowReason),
    AdapterError(String),
}

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI3Er2ShadowReason {
    NoLocalIdentity,
    NoOfficialCurrentIdentity,
    NonManagedSourceProvenance,
    AdapterProvenanceUnavailable,
    SourceChangedDuringShadowSnapshot,
    LegacyPreviewRowNotSupported,
}

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI3Er2ShadowRelationship {
    IdentityContinuitySupported,
    ResolverConflict,
    ResolverNeedsMoreEvidence,
    NoMaterialResolverMismatch,
    SourceUnavailable,
    ResolverError,
    NotEvaluated,
    AdapterError,
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
struct NseI3Er2ShadowEvaluation {
    legacy_action: String,
    official_symbol: String,
    matched_local_symbol: Option<String>,
    state: NseI3Er2ShadowState,
    relationship: NseI3Er2ShadowRelationship,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct NseI3Er2ShadowSummary {
    legacy_preview_rows: usize,
    eligible_rows: usize,
    evaluated_rows: usize,
    not_evaluated_rows: usize,
    continuity_supported: usize,
    resolver_conflicts: usize,
    needs_more_evidence: usize,
    no_material_mismatch: usize,
    source_unavailable: usize,
    resolver_errors: usize,
    adapter_errors: usize,
}

#[derive(Clone, Debug)]
struct NseI3Er2CurrentMasterRow {
    row: NseSecurityMasterRow,
    source_id: &'static str,
    source_reference: String,
    content_sha256: String,
}

#[derive(Clone, Debug)]
struct NseI3Er2ShadowSourceSnapshot {
    observed_at_ist: String,
    current_rows: Vec<NseI3Er2CurrentMasterRow>,
    symbol_change_rows: Vec<NseSymbolChangeRow>,
    symbol_changes_sha256: Option<String>,
    name_change_rows: Vec<NseNameChangeRow>,
    name_changes_sha256: Option<String>,
}

#[derive(Clone, Debug)]
struct NseI3Er2ShadowIndexes {
    observed_at_ist: String,
    existing_by_symbol: HashMap<String, ExistingNseInstrumentRow>,
    current_by_symbol: HashMap<String, NseI3Er2CurrentMasterRow>,
    current_by_isin: HashMap<String, Vec<NseI3Er2CurrentMasterRow>>,
    symbol_changes_by_pair: HashMap<(String, String), Vec<NseSymbolChangeRow>>,
    symbol_changes_sha256: Option<String>,
    name_changes_by_symbol: HashMap<String, Vec<NseNameChangeRow>>,
    name_changes_sha256: Option<String>,
}

#[cfg(test)]
std::thread_local! {
    static ER2C1_SHADOW_EVALUATION_CALLS: std::cell::Cell<u64> = std::cell::Cell::new(0);
}

#[cfg(test)]
fn er2c1_shadow_test_reset_call_count() {
    ER2C1_SHADOW_EVALUATION_CALLS.with(|value| value.set(0));
}

#[cfg(test)]
fn er2c1_shadow_test_call_count() -> u64 {
    ER2C1_SHADOW_EVALUATION_CALLS.with(|value| value.get())
}

fn er2c1_normalize_code(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn er2c1_normalize_company_name(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn er2c1_has_manual_archive_override(input: &NseCurrentUniverseSyncInput) -> bool {
    input
        .archive_root_path
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
}

fn er2c1_observed_at_ist() -> Result<String, String> {
    let offset = chrono::FixedOffset::east_opt(19_800)
        .ok_or_else(|| "ER2C1_IST_OFFSET_UNAVAILABLE".to_string())?;
    Ok(chrono::Utc::now().with_timezone(&offset).to_rfc3339())
}

fn er2c1_evidence_id(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    format!("ER2C1-{:x}", hasher.finalize())
}

fn er2c1_current_master_reference(
    source_reference_base: &str,
    row: &NseSecurityMasterRow,
) -> String {
    format!(
        "{source_reference_base}#symbol={};series={};isin={}",
        row.symbol,
        row.series.as_deref().unwrap_or_default(),
        row.isin.as_deref().unwrap_or_default(),
    )
}

fn er2c1_annotate_current_rows(
    rows: Vec<NseSecurityMasterRow>,
    source_id: &'static str,
    source_reference_base: &str,
    content_sha256: &str,
) -> Vec<NseI3Er2CurrentMasterRow> {
    rows.into_iter()
        .map(|row| NseI3Er2CurrentMasterRow {
            source_reference: er2c1_current_master_reference(source_reference_base, &row),
            row,
            source_id,
            content_sha256: content_sha256.to_string(),
        })
        .collect()
}

fn capture_nse_i3_er2_shadow_source_snapshot(
    archive_root: &Path,
) -> Result<NseI3Er2ShadowSourceSnapshot, String> {
    let (equity_path, sme_path) = resolve_current_universe_master_paths(archive_root)?;
    let allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();

    let equity_bytes = std::fs::read(&equity_path).map_err(|error| error.to_string())?;
    let equity_sha256 = sha256_hex_bytes(&equity_bytes);
    let equity_rows = load_security_master_rows_from_bytes(
        &equity_bytes,
        &equity_path.display().to_string(),
        Some(&allowed),
    )?;

    let mut current_by_symbol = HashMap::<String, NseI3Er2CurrentMasterRow>::new();
    for annotated in er2c1_annotate_current_rows(
        equity_rows,
        ER2C1_NSE_EQUITY_MASTER,
        ER2C1_NSE_EQUITY_MASTER_REFERENCE,
        &equity_sha256,
    ) {
        current_by_symbol
            .entry(annotated.row.symbol.clone())
            .or_insert(annotated);
    }

    if let Some(path) = sme_path.as_ref() {
        let sme_bytes = std::fs::read(path).map_err(|error| error.to_string())?;
        let sme_sha256 = sha256_hex_bytes(&sme_bytes);
        let sme_rows = load_security_master_rows_from_bytes(
            &sme_bytes,
            &path.display().to_string(),
            Some(&allowed),
        )?;
        for annotated in er2c1_annotate_current_rows(
            sme_rows,
            ER2C1_NSE_SME_MASTER,
            ER2C1_NSE_SME_MASTER_REFERENCE,
            &sme_sha256,
        ) {
            current_by_symbol
                .entry(annotated.row.symbol.clone())
                .or_insert(annotated);
        }
    }

    let symbol_changes_path = archive_root
        .join("NSE")
        .join("Identity")
        .join("SymbolChanges")
        .join("nse_identity_symbol_changes.csv");
    let (symbol_change_rows, symbol_changes_sha256) = if symbol_changes_path.exists() {
        let bytes = std::fs::read(&symbol_changes_path).map_err(|error| error.to_string())?;
        let sha256 = sha256_hex_bytes(&bytes);
        let rows = if bytes.iter().all(|byte| byte.is_ascii_whitespace()) {
            Vec::new()
        } else {
            load_symbol_change_rows_from_bytes(
                &bytes,
                &symbol_changes_path.display().to_string(),
            )?
        };
        (rows, Some(sha256))
    } else {
        (Vec::new(), None)
    };

    let name_changes_path = archive_root
        .join("NSE")
        .join("Identity")
        .join("CompanyNameChanges")
        .join("nse_identity_company_name_changes.csv");
    let (name_change_rows, name_changes_sha256) = if name_changes_path.exists() {
        let bytes = std::fs::read(&name_changes_path).map_err(|error| error.to_string())?;
        let sha256 = sha256_hex_bytes(&bytes);
        let rows = if bytes.iter().all(|byte| byte.is_ascii_whitespace()) {
            Vec::new()
        } else {
            load_name_change_rows_from_bytes(
                &bytes,
                &name_changes_path.display().to_string(),
            )?
        };
        (rows, Some(sha256))
    } else {
        (Vec::new(), None)
    };

    let mut current_rows = current_by_symbol.into_values().collect::<Vec<_>>();
    current_rows.sort_by(|left, right| left.row.symbol.cmp(&right.row.symbol));

    Ok(NseI3Er2ShadowSourceSnapshot {
        observed_at_ist: er2c1_observed_at_ist()?,
        current_rows,
        symbol_change_rows,
        symbol_changes_sha256,
        name_change_rows,
        name_changes_sha256,
    })
}

fn er2c1_security_master_row_matches(
    left: &NseSecurityMasterRow,
    right: &NseSecurityMasterRow,
) -> bool {
    left.symbol == right.symbol
        && left.company_name == right.company_name
        && left.isin == right.isin
        && left.series == right.series
}

fn er2c1_shadow_snapshot_matches_plan(
    snapshot: &NseI3Er2ShadowSourceSnapshot,
    plan: &NseCurrentUniverseSyncPlan,
) -> bool {
    snapshot.current_rows.len() == plan.current_rows.len()
        && snapshot
            .current_rows
            .iter()
            .zip(plan.current_rows.iter())
            .all(|(snapshot_row, plan_row)| {
                er2c1_security_master_row_matches(&snapshot_row.row, plan_row)
            })
}

fn build_nse_i3_er2_shadow_indexes_from_rows(
    existing_rows: Vec<ExistingNseInstrumentRow>,
    snapshot: &NseI3Er2ShadowSourceSnapshot,
) -> NseI3Er2ShadowIndexes {
    let existing_by_symbol = existing_rows
        .into_iter()
        .map(|row| (er2c1_normalize_code(&row.symbol), row))
        .collect::<HashMap<_, _>>();

    let mut current_by_symbol = HashMap::new();
    let mut current_by_isin = HashMap::<String, Vec<NseI3Er2CurrentMasterRow>>::new();
    for current in &snapshot.current_rows {
        current_by_symbol.insert(er2c1_normalize_code(&current.row.symbol), current.clone());
        if let Some(isin) = current
            .row
            .isin
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            current_by_isin
                .entry(er2c1_normalize_code(isin))
                .or_default()
                .push(current.clone());
        }
    }
    for rows in current_by_isin.values_mut() {
        rows.sort_by(|left, right| {
            left.row
                .symbol
                .cmp(&right.row.symbol)
                .then_with(|| left.source_id.cmp(&right.source_id))
        });
    }

    let mut symbol_changes_by_pair =
        HashMap::<(String, String), Vec<NseSymbolChangeRow>>::new();
    for row in &snapshot.symbol_change_rows {
        symbol_changes_by_pair
            .entry((
                er2c1_normalize_code(&row.old_symbol),
                er2c1_normalize_code(&row.new_symbol),
            ))
            .or_default()
            .push(row.clone());
    }
    for rows in symbol_changes_by_pair.values_mut() {
        rows.sort_by(|left, right| {
            left.effective_date
                .cmp(&right.effective_date)
                .then_with(|| left.old_symbol.cmp(&right.old_symbol))
                .then_with(|| left.new_symbol.cmp(&right.new_symbol))
        });
    }

    let mut name_changes_by_symbol = HashMap::<String, Vec<NseNameChangeRow>>::new();
    for row in &snapshot.name_change_rows {
        name_changes_by_symbol
            .entry(er2c1_normalize_code(&row.symbol))
            .or_default()
            .push(row.clone());
    }
    for rows in name_changes_by_symbol.values_mut() {
        rows.sort_by(|left, right| {
            left.effective_date
                .cmp(&right.effective_date)
                .then_with(|| left.new_name.cmp(&right.new_name))
        });
    }

    NseI3Er2ShadowIndexes {
        observed_at_ist: snapshot.observed_at_ist.clone(),
        existing_by_symbol,
        current_by_symbol,
        current_by_isin,
        symbol_changes_by_pair,
        symbol_changes_sha256: snapshot.symbol_changes_sha256.clone(),
        name_changes_by_symbol,
        name_changes_sha256: snapshot.name_changes_sha256.clone(),
    }
}

fn build_nse_i3_er2_shadow_indexes(
    connection: &Connection,
    snapshot: &NseI3Er2ShadowSourceSnapshot,
) -> Result<NseI3Er2ShadowIndexes, String> {
    let existing_rows = load_existing_nse_instrument_rows(connection)?;
    Ok(build_nse_i3_er2_shadow_indexes_from_rows(
        existing_rows,
        snapshot,
    ))
}

fn build_nse_i3_er2_local_identity(
    row: &ExistingNseInstrumentRow,
) -> IdentityResolverLocalIdentity {
    IdentityResolverLocalIdentity {
        exchange: NSE_EXCHANGE.to_string(),
        symbol: row.symbol.clone(),
        series: row.series.clone(),
        isin: row.isin.clone(),
        company_name: row.name.clone(),
        lifecycle_state: Some(if row.is_active { "ACTIVE" } else { "INACTIVE" }.to_string()),
        effective_from: None,
        effective_to: None,
    }
}

fn build_nse_i3_er2_current_master_evidence(
    current: &NseI3Er2CurrentMasterRow,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let row = &current.row;
    let evidence_id = er2c1_evidence_id(&[
        current.source_id,
        "CURRENT_MASTER",
        current.content_sha256.as_str(),
        row.symbol.as_str(),
        row.series.as_deref().unwrap_or_default(),
        row.isin.as_deref().unwrap_or_default(),
        row.company_name.as_deref().unwrap_or_default(),
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: current.source_id.to_string(),
        source_reference: current.source_reference.clone(),
        content_sha256: current.content_sha256.clone(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: None,
        symbol: Some(row.symbol.clone()),
        old_symbol: None,
        new_symbol: None,
        series: row.series.clone(),
        isin: row.isin.clone(),
        company_name: row.company_name.clone(),
        evidence_kind: IdentityResolverEvidenceKind::CurrentMaster,
    }
}

fn build_nse_i3_er2_symbol_change_evidence(
    row: &NseSymbolChangeRow,
    content_sha256: &str,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let company_name = row.company_name.as_deref().unwrap_or_default();
    let source_reference = format!(
        "{ER2C1_NSE_SYMBOL_CHANGE_REFERENCE}#old={};new={};date={}",
        row.old_symbol, row.new_symbol, row.effective_date,
    );
    let evidence_id = er2c1_evidence_id(&[
        ER2C1_NSE_SYMBOL_CHANGE,
        "SYMBOL_CHANGE",
        content_sha256,
        row.old_symbol.as_str(),
        row.new_symbol.as_str(),
        row.effective_date.as_str(),
        company_name,
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: ER2C1_NSE_SYMBOL_CHANGE.to_string(),
        source_reference,
        content_sha256: content_sha256.to_string(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: Some(row.effective_date.clone()),
        symbol: None,
        old_symbol: Some(row.old_symbol.clone()),
        new_symbol: Some(row.new_symbol.clone()),
        series: None,
        isin: None,
        company_name: row.company_name.clone(),
        evidence_kind: IdentityResolverEvidenceKind::SymbolChange,
    }
}

fn build_nse_i3_er2_name_change_evidence(
    row: &NseNameChangeRow,
    content_sha256: &str,
    observed_at_ist: &str,
) -> IdentityResolverEvidence {
    let source_reference = format!(
        "{ER2C1_NSE_COMPANY_NAME_CHANGE_REFERENCE}#symbol={};date={}",
        row.symbol, row.effective_date,
    );
    let evidence_id = er2c1_evidence_id(&[
        ER2C1_NSE_COMPANY_NAME_CHANGE,
        "NAME_CHANGE",
        content_sha256,
        row.symbol.as_str(),
        row.effective_date.as_str(),
        row.old_name.as_str(),
        row.new_name.as_str(),
    ]);
    IdentityResolverEvidence {
        evidence_id,
        exchange: NSE_EXCHANGE.to_string(),
        authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
        source_id: ER2C1_NSE_COMPANY_NAME_CHANGE.to_string(),
        source_reference,
        content_sha256: content_sha256.to_string(),
        retrieved_at_ist: observed_at_ist.to_string(),
        effective_date: Some(row.effective_date.clone()),
        symbol: Some(row.symbol.clone()),
        old_symbol: None,
        new_symbol: None,
        series: None,
        isin: None,
        company_name: Some(row.new_name.clone()),
        evidence_kind: IdentityResolverEvidenceKind::NameChange,
    }
}

fn build_nse_i3_er2_official_identity(
    current: &NseI3Er2CurrentMasterRow,
    evidence_id: &str,
) -> IdentityResolverOfficialIdentity {
    IdentityResolverOfficialIdentity {
        exchange: NSE_EXCHANGE.to_string(),
        symbol: current.row.symbol.clone(),
        series: current.row.series.clone(),
        isin: current.row.isin.clone(),
        company_name: current.row.company_name.clone(),
        lifecycle_state: Some("ACTIVE".to_string()),
        effective_date: None,
        source_id: current.source_id.to_string(),
        evidence_id: evidence_id.to_string(),
    }
}

fn er2c1_insert_evidence(
    evidence_by_id: &mut HashMap<String, IdentityResolverEvidence>,
    evidence: IdentityResolverEvidence,
) {
    evidence_by_id
        .entry(evidence.evidence_id.clone())
        .or_insert(evidence);
}

fn build_nse_i3_er2_input(
    preview: &NseCurrentUniverseSyncPreviewRow,
    indexes: &NseI3Er2ShadowIndexes,
) -> Result<IdentityResolverInput, NseI3Er2ShadowState> {
    if matches!(
        preview.action.as_str(),
        "OLD_SYMBOL" | "DELISTED" | "UNKNOWN_INACTIVE"
    ) {
        return Err(NseI3Er2ShadowState::NotEvaluated(
            NseI3Er2ShadowReason::NoOfficialCurrentIdentity,
        ));
    }
    if !matches!(preview.action.as_str(), "UPDATE" | "REACTIVATE" | "INSERT") {
        return Err(NseI3Er2ShadowState::NotEvaluated(
            NseI3Er2ShadowReason::LegacyPreviewRowNotSupported,
        ));
    }

    let official_key = er2c1_normalize_code(&preview.symbol);
    let Some(current) = indexes.current_by_symbol.get(&official_key) else {
        return Err(NseI3Er2ShadowState::NotEvaluated(
            NseI3Er2ShadowReason::NoOfficialCurrentIdentity,
        ));
    };
    if current.source_id.trim().is_empty()
        || current.source_reference.trim().is_empty()
        || current.content_sha256.trim().is_empty()
    {
        return Err(NseI3Er2ShadowState::NotEvaluated(
            NseI3Er2ShadowReason::AdapterProvenanceUnavailable,
        ));
    }

    let local_symbol = if preview.action == "INSERT" {
        let Some(matched) = preview.matched_symbol.as_deref() else {
            return Err(NseI3Er2ShadowState::NotEvaluated(
                NseI3Er2ShadowReason::NoLocalIdentity,
            ));
        };
        matched
    } else {
        preview
            .matched_symbol
            .as_deref()
            .unwrap_or(preview.symbol.as_str())
    };
    let Some(local) = indexes
        .existing_by_symbol
        .get(&er2c1_normalize_code(local_symbol))
    else {
        return Err(NseI3Er2ShadowState::NotEvaluated(
            NseI3Er2ShadowReason::NoLocalIdentity,
        ));
    };

    let current_evidence = build_nse_i3_er2_current_master_evidence(
        current,
        &indexes.observed_at_ist,
    );
    let current_evidence_id = current_evidence.evidence_id.clone();
    let mut evidence_by_id = HashMap::<String, IdentityResolverEvidence>::new();
    er2c1_insert_evidence(&mut evidence_by_id, current_evidence);

    if let Some(isin) = current
        .row
        .isin
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(peers) = indexes.current_by_isin.get(&er2c1_normalize_code(isin)) {
            for peer in peers {
                er2c1_insert_evidence(
                    &mut evidence_by_id,
                    build_nse_i3_er2_current_master_evidence(peer, &indexes.observed_at_ist),
                );
            }
        }
    }

    if let Some(content_sha256) = indexes.symbol_changes_sha256.as_deref() {
        let key = (
            er2c1_normalize_code(&local.symbol),
            er2c1_normalize_code(&current.row.symbol),
        );
        if let Some(rows) = indexes.symbol_changes_by_pair.get(&key) {
            for row in rows {
                er2c1_insert_evidence(
                    &mut evidence_by_id,
                    build_nse_i3_er2_symbol_change_evidence(
                        row,
                        content_sha256,
                        &indexes.observed_at_ist,
                    ),
                );
            }
        }
    }

    if let Some(content_sha256) = indexes.name_changes_sha256.as_deref() {
        let official_company = current
            .row
            .company_name
            .as_deref()
            .map(er2c1_normalize_company_name);
        if let Some(rows) = indexes
            .name_changes_by_symbol
            .get(&er2c1_normalize_code(&current.row.symbol))
        {
            for row in rows {
                let new_name_matches = official_company
                    .as_ref()
                    .is_some_and(|name| er2c1_normalize_company_name(&row.new_name) == *name);
                if new_name_matches {
                    er2c1_insert_evidence(
                        &mut evidence_by_id,
                        build_nse_i3_er2_name_change_evidence(
                            row,
                            content_sha256,
                            &indexes.observed_at_ist,
                        ),
                    );
                }
            }
        }
    }

    let mut evidence = evidence_by_id.into_values().collect::<Vec<_>>();
    evidence.sort_by(|left, right| left.evidence_id.cmp(&right.evidence_id));

    Ok(IdentityResolverInput {
        local_identity: build_nse_i3_er2_local_identity(local),
        official_identity: Some(build_nse_i3_er2_official_identity(
            current,
            &current_evidence_id,
        )),
        evidence,
        required_source_health: IdentityResolverSourceAvailability::Available,
    })
}

fn classify_nse_i3_er2_resolver_outcome(
    outcome: Result<IdentityResolverResult, IdentityResolverEvaluationError>,
) -> NseI3Er2ShadowState {
    match outcome {
        Ok(result) => NseI3Er2ShadowState::Evaluated(result),
        Err(IdentityResolverEvaluationError::NoMismatchToResolve) => {
            NseI3Er2ShadowState::NoMaterialResolverMismatch
        }
        Err(IdentityResolverEvaluationError::InvalidInput(message)) => {
            NseI3Er2ShadowState::ResolverError(NseI3Er2ShadowResolverError::InvalidInput(message))
        }
        Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates { rule_ids }) => {
            NseI3Er2ShadowState::ResolverError(
                NseI3Er2ShadowResolverError::AmbiguousDeterministicCandidates { rule_ids },
            )
        }
        Err(IdentityResolverEvaluationError::InvalidConstructedResult(message)) => {
            NseI3Er2ShadowState::ResolverError(
                NseI3Er2ShadowResolverError::InvalidConstructedResult(message),
            )
        }
    }
}

fn nse_i3_er2_shadow_relationship(
    state: &NseI3Er2ShadowState,
) -> NseI3Er2ShadowRelationship {
    match state {
        NseI3Er2ShadowState::Evaluated(result) => match result.status {
            IdentityResolverStatus::Confirmed => {
                NseI3Er2ShadowRelationship::IdentityContinuitySupported
            }
            IdentityResolverStatus::Conflict => NseI3Er2ShadowRelationship::ResolverConflict,
            IdentityResolverStatus::InsufficientEvidence
            | IdentityResolverStatus::ProbableReview => {
                NseI3Er2ShadowRelationship::ResolverNeedsMoreEvidence
            }
            IdentityResolverStatus::SourceUnavailable => {
                NseI3Er2ShadowRelationship::SourceUnavailable
            }
        },
        NseI3Er2ShadowState::NoMaterialResolverMismatch => {
            NseI3Er2ShadowRelationship::NoMaterialResolverMismatch
        }
        NseI3Er2ShadowState::ResolverError(_) => NseI3Er2ShadowRelationship::ResolverError,
        NseI3Er2ShadowState::NotEvaluated(_) => NseI3Er2ShadowRelationship::NotEvaluated,
        NseI3Er2ShadowState::AdapterError(_) => NseI3Er2ShadowRelationship::AdapterError,
    }
}

fn nse_i3_er2_shadow_evaluation_from_state(
    preview: &NseCurrentUniverseSyncPreviewRow,
    state: NseI3Er2ShadowState,
) -> NseI3Er2ShadowEvaluation {
    let relationship = nse_i3_er2_shadow_relationship(&state);
    NseI3Er2ShadowEvaluation {
        legacy_action: preview.action.clone(),
        official_symbol: preview.symbol.clone(),
        matched_local_symbol: preview.matched_symbol.clone(),
        state,
        relationship,
    }
}

fn nse_i3_er2_uniform_shadow_evaluations(
    plan: &NseCurrentUniverseSyncPlan,
    state: NseI3Er2ShadowState,
) -> Vec<NseI3Er2ShadowEvaluation> {
    plan.preview_rows
        .iter()
        .map(|preview| nse_i3_er2_shadow_evaluation_from_state(preview, state.clone()))
        .collect()
}

fn summarize_nse_i3_er2_shadow(
    evaluations: &[NseI3Er2ShadowEvaluation],
) -> NseI3Er2ShadowSummary {
    let mut summary = NseI3Er2ShadowSummary {
        legacy_preview_rows: evaluations.len(),
        ..NseI3Er2ShadowSummary::default()
    };
    for evaluation in evaluations {
        match evaluation.relationship {
            NseI3Er2ShadowRelationship::IdentityContinuitySupported => {
                summary.continuity_supported += 1;
            }
            NseI3Er2ShadowRelationship::ResolverConflict => summary.resolver_conflicts += 1,
            NseI3Er2ShadowRelationship::ResolverNeedsMoreEvidence => {
                summary.needs_more_evidence += 1;
            }
            NseI3Er2ShadowRelationship::NoMaterialResolverMismatch => {
                summary.no_material_mismatch += 1;
            }
            NseI3Er2ShadowRelationship::SourceUnavailable => summary.source_unavailable += 1,
            NseI3Er2ShadowRelationship::ResolverError => summary.resolver_errors += 1,
            NseI3Er2ShadowRelationship::NotEvaluated => summary.not_evaluated_rows += 1,
            NseI3Er2ShadowRelationship::AdapterError => summary.adapter_errors += 1,
        }
    }
    summary.eligible_rows = summary
        .legacy_preview_rows
        .saturating_sub(summary.not_evaluated_rows);
    summary.evaluated_rows = summary
        .eligible_rows
        .saturating_sub(summary.adapter_errors);
    summary
}

fn evaluate_nse_i3_er2_shadow(
    connection: &Connection,
    input: &NseCurrentUniverseSyncInput,
    plan: &NseCurrentUniverseSyncPlan,
) -> Vec<NseI3Er2ShadowEvaluation> {
    #[cfg(test)]
    ER2C1_SHADOW_EVALUATION_CALLS.with(|value| value.set(value.get().saturating_add(1)));

    if er2c1_has_manual_archive_override(input) {
        return nse_i3_er2_uniform_shadow_evaluations(
            plan,
            NseI3Er2ShadowState::NotEvaluated(
                NseI3Er2ShadowReason::NonManagedSourceProvenance,
            ),
        );
    }

    let archive_root = Path::new(&plan.archive_root_path);
    let snapshot = match capture_nse_i3_er2_shadow_source_snapshot(archive_root) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            return nse_i3_er2_uniform_shadow_evaluations(
                plan,
                NseI3Er2ShadowState::AdapterError(error),
            );
        }
    };
    if !er2c1_shadow_snapshot_matches_plan(&snapshot, plan) {
        return nse_i3_er2_uniform_shadow_evaluations(
            plan,
            NseI3Er2ShadowState::NotEvaluated(
                NseI3Er2ShadowReason::SourceChangedDuringShadowSnapshot,
            ),
        );
    }

    let indexes = match build_nse_i3_er2_shadow_indexes(connection, &snapshot) {
        Ok(indexes) => indexes,
        Err(error) => {
            return nse_i3_er2_uniform_shadow_evaluations(
                plan,
                NseI3Er2ShadowState::AdapterError(error),
            );
        }
    };

    plan.preview_rows
        .iter()
        .map(|preview| {
            let state = match build_nse_i3_er2_input(preview, &indexes) {
                Ok(resolver_input) => {
                    classify_nse_i3_er2_resolver_outcome(resolve_identity(&resolver_input))
                }
                Err(state) => state,
            };
            nse_i3_er2_shadow_evaluation_from_state(preview, state)
        })
        .collect()
}

fn preview_nse_current_universe_sync_internal(
    connection: &Connection,
    input: &NseCurrentUniverseSyncInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncResult> {
    let plan = build_nse_current_universe_sync_plan(connection, input, default_archive_root)?;
    let plan_sha256 = nse_current_universe_plan_sha256(&plan);
    let er2c1_shadow = evaluate_nse_i3_er2_shadow(connection, input, &plan);
    let _er2c1_shadow_summary = summarize_nse_i3_er2_shadow(&er2c1_shadow);
    Ok(plan_into_result(plan, false, plan_sha256))
}

#[allow(dead_code)]
fn apply_nse_current_universe_sync_internal(
    connection: &Connection,
    input: &NseCurrentUniverseSyncInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncResult> {
    let plan = build_nse_current_universe_sync_plan(connection, input, default_archive_root)?;
    let plan_sha256 = nse_current_universe_plan_sha256(&plan);
    apply_nse_current_universe_sync_plan(connection, &plan)?;
    Ok(plan_into_result(plan, true, plan_sha256))
}

#[cfg(test)]
fn apply_nse_current_universe_sync_reviewed_internal(
    connection: &Connection,
    input: &NseCurrentUniverseApplyInput,
    default_archive_root: Option<&Path>,
) -> AppResult<NseCurrentUniverseSyncResult> {
    apply_reporting::apply_reviewed(connection, input, default_archive_root, &|_| {})
}

fn normalize_archive_root(value: &str) -> AppResult<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Enter the NSE raw archive root path first.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn resolve_managed_nse_identity_root(database_folder_path: &Path) -> PathBuf {
    database_folder_path.join("reference-data")
}

fn resolve_nse_historical_identity_archive_root(
    input: &NseHistoricalIdentityPreviewInput,
    default_archive_root: Option<&Path>,
) -> AppResult<PathBuf> {
    if let Some(value) = input.archive_root_path.as_deref() {
        if !value.trim().is_empty() {
            return normalize_archive_root(value);
        }
    }

    default_archive_root
        .map(Path::to_path_buf)
        .ok_or_else(|| "Enter the NSE raw archive root path first.".to_string())
}

fn resolve_nse_current_universe_archive_root(
    input: &NseCurrentUniverseSyncInput,
    default_archive_root: Option<&Path>,
) -> AppResult<PathBuf> {
    if let Some(value) = input.archive_root_path.as_deref() {
        if !value.trim().is_empty() {
            return normalize_archive_root(value);
        }
    }

    default_archive_root
        .map(Path::to_path_buf)
        .ok_or_else(|| "Enter the NSE raw archive root path first.".to_string())
}

fn resolve_current_universe_master_paths(root: &Path) -> AppResult<(PathBuf, Option<PathBuf>)> {
    if !root.exists() {
        return Err(format!("Archive root was not found: {}", root.display()));
    }

    let equity_path = root
        .join("NSE")
        .join("Identity")
        .join("SecuritiesAvailable")
        .join("nse_identity_securities_available_equity.csv");
    if !equity_path.exists() {
        return Err(format!(
            "Required NSE current-universe file was not found: {}",
            equity_path.display()
        ));
    }

    let sme_path = root
        .join("NSE")
        .join("Identity")
        .join("SecuritiesAvailable")
        .join("nse_identity_securities_available_sme.csv");
    let optional_sme_path = if sme_path.exists() {
        Some(sme_path)
    } else {
        None
    };

    Ok((equity_path, optional_sme_path))
}

fn ensure_current_universe_master_file_is_fresh(path: &Path) -> AppResult<()> {
    let modified_at = std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| {
            format!(
                "Could not inspect NSE current master file timestamp for {}: {error}",
                path.display()
            )
        })?;
    let age = SystemTime::now()
        .duration_since(modified_at)
        .unwrap_or_else(|_| Duration::from_secs(0));
    let max_age = Duration::from_secs(CURRENT_UNIVERSE_MAX_FILE_AGE_DAYS * 24 * 60 * 60);
    if age > max_age {
        return Err(format!(
            "NSE current master file looks stale: {} was last modified more than {} day(s) ago. Click Download NSE Master before Preview/Apply so current symbols and series are not updated from an old archive.",
            path.display(),
            CURRENT_UNIVERSE_MAX_FILE_AGE_DAYS
        ));
    }
    Ok(())
}

fn resolve_archive_files(root: &Path) -> AppResult<NseIdentityArchiveFiles> {
    let (securities_available_path, _) = resolve_current_universe_master_paths(root)?;
    let symbol_changes_path = root
        .join("NSE")
        .join("Identity")
        .join("SymbolChanges")
        .join("nse_identity_symbol_changes.csv");
    let company_name_changes_path = root
        .join("NSE")
        .join("Identity")
        .join("CompanyNameChanges")
        .join("nse_identity_company_name_changes.csv");

    for path in [
        &securities_available_path,
        &symbol_changes_path,
        &company_name_changes_path,
    ] {
        if !path.exists() {
            return Err(format!(
                "Required NSE identity file was not found: {}",
                path.display()
            ));
        }
    }

    Ok(NseIdentityArchiveFiles {
        securities_available_path,
        symbol_changes_path,
        company_name_changes_path,
    })
}


fn load_existing_exchange_symbols(
    connection: &Connection,
    exchange: &str,
) -> AppResult<HashSet<String>> {
    let mut statement = connection
        .prepare(
            "
              SELECT symbol
              FROM instruments
              WHERE exchange = ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let mut symbols = HashSet::new();
    for row in rows {
        symbols.insert(row.map_err(|error| error.to_string())?);
    }
    Ok(symbols)
}

fn build_included_identity_symbols(
    current_equity_symbols: &HashSet<String>,
    existing_nse_symbols: &HashSet<String>,
    symbol_change_rows: &[NseSymbolChangeRow],
) -> HashSet<String> {
    let mut included = current_equity_symbols.clone();
    included.extend(existing_nse_symbols.iter().cloned());

    loop {
        let mut changed = false;
        for row in symbol_change_rows {
            if included.contains(&row.new_symbol) || included.contains(&row.old_symbol) {
                changed |= included.insert(row.new_symbol.clone());
                changed |= included.insert(row.old_symbol.clone());
            }
        }
        if !changed {
            break;
        }
    }
    included
}

fn should_include_name_change(included_symbols: &HashSet<String>, row: &NseNameChangeRow) -> bool {
    included_symbols.contains(&row.symbol)
}

fn should_include_symbol_change(
    included_symbols: &HashSet<String>,
    row: &NseSymbolChangeRow,
) -> bool {
    included_symbols.contains(&row.new_symbol) || included_symbols.contains(&row.old_symbol)
}

fn load_current_universe_master_rows(
    equity_path: &Path,
    sme_path: Option<&Path>,
) -> AppResult<(u32, Vec<NseSecurityMasterRow>)> {
    let allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();
    let mut raw_rows_read = 0_u32;
    let mut combined = HashMap::<String, NseSecurityMasterRow>::new();

    for row in load_security_master_rows_with_filter(equity_path, Some(&allowed))? {
        raw_rows_read += 1;
        combined.entry(row.symbol.clone()).or_insert(row);
    }
    if let Some(path) = sme_path {
        for row in load_security_master_rows_with_filter(path, Some(&allowed))? {
            raw_rows_read += 1;
            combined.entry(row.symbol.clone()).or_insert(row);
        }
    }

    let mut rows = combined.into_values().collect::<Vec<_>>();
    rows.sort_by(|left, right| left.symbol.cmp(&right.symbol));
    Ok((raw_rows_read, rows))
}

fn load_security_master_rows_with_filter(
    path: &Path,
    allowed_series: Option<&HashSet<String>>,
) -> AppResult<Vec<NseSecurityMasterRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_path(path)
        .map_err(|error| error.to_string())?;
    load_security_master_rows_from_reader(&mut reader, &path.display().to_string(), allowed_series)
}

fn load_security_master_rows_from_bytes(
    bytes: &[u8],
    source_label: &str,
    allowed_series: Option<&HashSet<String>>,
) -> AppResult<Vec<NseSecurityMasterRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(bytes));
    load_security_master_rows_from_reader(&mut reader, source_label, allowed_series)
}

fn load_security_master_rows_from_reader<R: Read>(
    reader: &mut csv::Reader<R>,
    source_label: &str,
    allowed_series: Option<&HashSet<String>>,
) -> AppResult<Vec<NseSecurityMasterRow>> {
    let headers = reader.headers().map_err(|error| error.to_string())?.clone();
    let header_map = build_header_map(&headers);
    let mut rows = Vec::new();

    for record in reader.records() {
        let record = record.map_err(|error| error.to_string())?;
        let raw_symbol = pick_field(&header_map, &record, &["symbol"])
            .ok_or_else(|| format!("Missing security master symbol in {}", source_label))?;
        let symbol = normalize_symbol(&raw_symbol)?;
        let series =
            pick_field(&header_map, &record, &["series"]).map(|value| value.to_ascii_uppercase());
        if let Some(allowed) = allowed_series {
            let Some(series_value) = series.as_ref() else {
                continue;
            };
            if !allowed.contains(series_value) {
                continue;
            }
        }
        rows.push(NseSecurityMasterRow {
            symbol,
            company_name: pick_field(&header_map, &record, &["nameofcompany"]),
            isin: pick_field(&header_map, &record, &["isinnumber"]),
            series,
        });
    }

    Ok(rows)
}

fn load_symbol_change_rows(path: &Path) -> AppResult<Vec<NseSymbolChangeRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .has_headers(false)
        .from_path(path)
        .map_err(|error| error.to_string())?;
    let mut rows = Vec::new();
    let mut records = reader.records();
    let first_record = match records.next() {
        Some(record) => record.map_err(|error| error.to_string())?,
        None => return Ok(rows),
    };

    if looks_like_symbol_change_header(&first_record) {
        let header_map = symbol_change_header_map(&first_record)?;
        for record in records {
            let record = record.map_err(|error| error.to_string())?;
            rows.push(parse_symbol_change_header_record(
                &header_map,
                &record,
                path,
            )?);
        }
        return Ok(rows);
    }

    rows.push(parse_symbol_change_positional_record(&first_record, path)?);

    for record in records {
        let record = record.map_err(|error| error.to_string())?;
        rows.push(parse_symbol_change_positional_record(&record, path)?);
    }

    Ok(rows)
}

fn load_symbol_change_rows_from_bytes(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<Vec<NseSymbolChangeRow>> {
    let unique = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let path = std::env::temp_dir().join(format!(
        "eod-chart-nse-symbolchange-{unique}-{}.csv",
        std::process::id()
    ));
    std::fs::write(&path, bytes)
        .map_err(|error| format!("Could not stage {source_label} for validation: {error}"))?;
    let result = load_symbol_change_rows(&path);
    let _ = std::fs::remove_file(&path);
    result
}

// Retain source bytes separately from identity application. CA Fetch must not
// mutate instruments or assume that a current master proves historical ISINs.
pub(super) fn download_ca_symbol_change_source(
    connection: &Connection,
) -> AppResult<(String, Vec<u8>)> {
    let urls = load_official_source_urls(Some(connection))?;
    let bytes = fetch_nse_security_master_csv(
        &urls.nse_symbol_change_url,
        &urls.nse_securities_available_page_url,
    )?;
    parse_ca_symbol_change_source(&bytes)?;
    Ok((urls.nse_symbol_change_url, bytes))
}

pub(super) fn parse_ca_symbol_change_source(
    bytes: &[u8],
) -> AppResult<Vec<(String, String, String, u64)>> {
    let path = Path::new("retained NSE symbol-change CSV");
    let mut reader = csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .from_reader(bytes);
    let headers = reader.headers().map_err(|e| e.to_string())?.clone();
    let header_map = symbol_change_header_map(&headers)?;
    if !["old", "new", "date"]
        .iter()
        .all(|key| header_map.contains_key(*key))
    {
        return Err("NSE symbol-change source has no recognized header.".to_string());
    }
    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        let line = record.position().map(|p| p.line()).unwrap_or(0);
        let row = parse_symbol_change_header_record(&header_map, &record, path)?;
        rows.push((row.old_symbol, row.new_symbol, row.effective_date, line));
    }
    if rows.is_empty() {
        return Err("NSE symbol-change source is empty.".to_string());
    }
    Ok(rows)
}

fn parse_symbol_change_header_record(
    header_map: &HashMap<String, usize>,
    record: &StringRecord,
    path: &Path,
) -> AppResult<NseSymbolChangeRow> {
    let old_symbol = normalize_symbol(
        &pick_field(header_map, record, &["old"])
            .ok_or_else(|| format!("Missing old symbol in {}", path.display()))?,
    )?;
    let new_symbol = normalize_symbol(
        &pick_field(header_map, record, &["new"])
            .ok_or_else(|| format!("Missing new symbol in {}", path.display()))?,
    )?;
    let effective_date = parse_identity_date(
        &pick_field(header_map, record, &["date"])
            .ok_or_else(|| format!("Missing symbol change date in {}", path.display()))?,
    )?;
    Ok(NseSymbolChangeRow {
        company_name: pick_field(header_map, record, &["company"]),
        old_symbol,
        new_symbol,
        effective_date,
    })
}

fn parse_symbol_change_positional_record(
    record: &StringRecord,
    path: &Path,
) -> AppResult<NseSymbolChangeRow> {
    let company_name = normalize_optional_text(record.get(0));
    let old_symbol = normalize_symbol(
        record
            .get(1)
            .ok_or_else(|| format!("Missing old symbol in {}", path.display()))?,
    )?;
    let new_symbol = normalize_symbol(
        record
            .get(2)
            .ok_or_else(|| format!("Missing new symbol in {}", path.display()))?,
    )?;
    let effective_date = parse_identity_date(
        record
            .get(3)
            .ok_or_else(|| format!("Missing symbol change date in {}", path.display()))?,
    )?;
    Ok(NseSymbolChangeRow {
        company_name,
        old_symbol,
        new_symbol,
        effective_date,
    })
}

fn load_name_change_rows_from_bytes(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<Vec<NseNameChangeRow>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(bytes));
    let headers = reader.headers().map_err(|error| error.to_string())?.clone();
    let header_map = identity_change_header_map(
        &headers,
        &[
            ("symbol", &["nchsymbol", "symbol"]),
            ("oldname", &["nchprevname", "oldname", "previousname", "oldcompanyname", "previouscompanyname", "oldnameofthecompany"]),
            ("newname", &["nchnewname", "newname", "newcompanyname", "newnameofthecompany"]),
            ("date", &["nchdt", "date", "effectivedate"]),
        ],
        "company-name-change",
    )?;
    for (key, label) in [
        ("symbol", "name change symbol"),
        ("oldname", "old company name"),
        ("newname", "new company name"),
        ("date", "name change date"),
    ] {
        if !header_map.contains_key(key) {
            return Err(format!("Missing {label} column in {source_label}; CSV headers: {headers:?}"));
        }
    }
    let mut rows = Vec::new();

    for record in reader.records() {
        let record = record.map_err(|error| error.to_string())?;
        let parsed = (|| -> AppResult<NseNameChangeRow> {
            let symbol = normalize_symbol(
                &pick_field(&header_map, &record, &["symbol"])
                    .ok_or_else(|| format!("Missing name change symbol in {source_label}"))?,
            )?;
            let old_name = pick_field(&header_map, &record, &["oldname"])
                .ok_or_else(|| format!("Missing old company name in {source_label}"))?;
            let new_name = pick_field(&header_map, &record, &["newname"])
                .ok_or_else(|| format!("Missing new company name in {source_label}"))?;
            let effective_date = parse_identity_date(
                &pick_field(&header_map, &record, &["date"])
                    .ok_or_else(|| format!("Missing name change date in {source_label}"))?,
            )?;
            Ok(NseNameChangeRow {
                symbol,
                old_name,
                new_name,
                effective_date,
            })
        })();
        rows.push(parsed.map_err(|error| format!(
            "{error}; CSV headers: {headers:?}; record position: {:?}; values: {record:?}",
            record.position()
        ))?);
    }

    Ok(rows)
}

fn validate_nse_company_name_change_download(
    bytes: &[u8],
    source_label: &str,
) -> AppResult<u32> {
    let rows = load_name_change_rows_from_bytes(bytes, source_label)?;
    Ok(rows.len() as u32)
}

fn load_existing_nse_instrument_rows(
    connection: &Connection,
) -> AppResult<Vec<ExistingNseInstrumentRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT
                symbol,
                isin,
                name,
                series,
                COALESCE(is_active, 1)
              FROM instruments
              WHERE exchange = ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![NSE_EXCHANGE], |row| {
            Ok(ExistingNseInstrumentRow {
                symbol: row.get(0)?,
                isin: row.get(1)?,
                name: row.get(2)?,
                series: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn load_identity_history_hints(
    connection: &Connection,
    exchange: &str,
) -> AppResult<NseIdentityHistoryHints> {
    let mut statement = connection
        .prepare(
            "
              SELECT
                current_symbol,
                old_symbol,
                new_symbol,
                isin,
                effective_date,
                change_type
              FROM instrument_identity_history
              WHERE exchange = ?
            ",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![exchange], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut symbol_to_current = HashMap::new();
    let mut symbol_conflicts = HashSet::new();
    let mut isin_to_current = HashMap::new();
    let mut isin_conflicts = HashSet::new();

    let mut transition_edges: HashMap<String, HashSet<(String, String)>> = HashMap::new();
    for (current_symbol, old_symbol, new_symbol, isin, effective_date, change_type) in &rows {
        if matches!(change_type.as_str(), "SYMBOL_CHANGE" | "BOTH") {
            if let (Some(old), Some(new)) = (old_symbol, new_symbol) {
                transition_edges.entry(old.clone()).or_default().insert((new.clone(), effective_date.clone()));
            }
        }
        let canonical_symbol = current_symbol.clone().or_else(|| new_symbol.clone());
        merge_unique_mapping(
            &mut symbol_to_current,
            &mut symbol_conflicts,
            current_symbol.clone(),
            canonical_symbol.clone(),
        );
        merge_unique_mapping(
            &mut symbol_to_current,
            &mut symbol_conflicts,
            old_symbol.clone(),
            canonical_symbol.clone(),
        );
        merge_unique_mapping(
            &mut symbol_to_current,
            &mut symbol_conflicts,
            new_symbol.clone(),
            canonical_symbol.clone(),
        );
        merge_unique_mapping(
            &mut isin_to_current,
            &mut isin_conflicts,
            isin.clone(),
            canonical_symbol,
        );
    }

    Ok(NseIdentityHistoryHints {
        symbol_to_current,
        isin_to_current,
        row_count: rows.len() as u32,
        transition_edges,
    })
}

fn build_unique_existing_isin_map(rows: &[ExistingNseInstrumentRow]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut conflicts = HashSet::new();
    for row in rows {
        merge_unique_mapping(
            &mut map,
            &mut conflicts,
            row.isin.clone(),
            Some(row.symbol.clone()),
        );
    }
    map
}

fn merge_unique_mapping(
    map: &mut HashMap<String, String>,
    conflicts: &mut HashSet<String>,
    key: Option<String>,
    value: Option<String>,
) {
    let (Some(key), Some(value)) = (key, value) else {
        return;
    };
    if key.trim().is_empty() || value.trim().is_empty() || conflicts.contains(&key) {
        return;
    }
    match map.get(&key) {
        None => {
            map.insert(key, value);
        }
        Some(existing) if existing == &value => {}
        Some(_) => {
            map.remove(&key);
            conflicts.insert(key);
        }
    }
}

fn resolve_current_universe_insert_match(
    row: &NseSecurityMasterRow,
    existing_by_isin: &HashMap<String, String>,
    history_hints: &NseIdentityHistoryHints,
) -> (Option<String>, String, bool, bool) {
    if let Some(isin) = row.isin.as_ref() {
        if let Some(symbol) = existing_by_isin.get(isin) {
            return (
                Some(symbol.clone()),
                format!(
                    "Current symbol is missing, but ISIN matches existing NSE symbol {symbol}."
                ),
                true,
                false,
            );
        }
        if let Some(symbol) = history_hints.isin_to_current.get(isin) {
            return (
                Some(symbol.clone()),
                format!(
                    "Current symbol is missing, but ISIN matches NSE identity history -> {symbol}."
                ),
                false,
                true,
            );
        }
    }

    if let Some(symbol) = history_hints.symbol_to_current.get(&row.symbol) {
        if symbol == &row.symbol {
            return (
                Some(symbol.clone()),
                "Current symbol is referenced by NSE identity history, but no live instrument row exists yet.".to_string(),
                false,
                true,
            );
        }
        return (
            Some(symbol.clone()),
            format!(
                "Current symbol is missing, but NSE identity history links the chain to {symbol}."
            ),
            false,
            true,
        );
    }

    (
        None,
        "Current symbol is not present in the database and will be inserted as active from the official NSE master.".to_string(),
        false,
        false,
    )
}

fn security_master_metadata_changed(
    existing: &ExistingNseInstrumentRow,
    row: &NseSecurityMasterRow,
) -> bool {
    optional_field_would_change(&row.company_name, &existing.name)
        || optional_field_would_change(&row.isin, &existing.isin)
        || optional_field_would_change(&row.series, &existing.series)
}

fn optional_field_would_change(next: &Option<String>, current: &Option<String>) -> bool {
    match next {
        Some(value) => current.as_deref() != Some(value.as_str()),
        None => false,
    }
}

fn validated_current_successor(
    symbol: &str,
    history_hints: &NseIdentityHistoryHints,
    current_symbols: &HashSet<String>,
) -> Option<String> {
    let mut at = symbol.to_string();
    let mut seen = HashSet::from([at.clone()]);
    let mut previous_date = None;
    let today = chrono::Local::now().date_naive();
    for _ in 0..32 {
        let edges = history_hints.transition_edges.get(&at)?;
        if edges.len() != 1 { return None; }
        let (successor, effective_date) = edges.iter().next()?;
        let date = NaiveDate::parse_from_str(effective_date, "%Y-%m-%d").ok()?;
        if date > today || previous_date.is_some_and(|previous| date <= previous) || !seen.insert(successor.clone()) {
            return None;
        }
        if current_symbols.contains(successor) { return Some(successor.clone()); }
        at = successor.clone();
        previous_date = Some(date);
    }
    None
}

fn classify_nse_inactive_lifecycle(
    row: &ExistingNseInstrumentRow,
    history_hints: &NseIdentityHistoryHints,
    official_delisted_symbols: &HashSet<String>,
    current_symbols: &HashSet<String>,
) -> String {
    if !row.series.as_deref().is_some_and(|series| CURRENT_UNIVERSE_SUPPORTED_SERIES.contains(&series)) {
        return "OUTSIDE_COVERAGE".to_string();
    }
    if validated_current_successor(&row.symbol, history_hints, current_symbols).is_some() {
        return "OLD_SYMBOL".to_string();
    }
    if official_delisted_symbols.contains(&row.symbol) {
        return "DELISTED".to_string();
    }
    "REVIEW_REQUIRED".to_string()
}

fn nse_inactive_lifecycle_reason(lifecycle_status: &str) -> String {
    match lifecycle_status {
        "OLD_SYMBOL" => "A unique dated symbol-change path reaches a different symbol in the current NSE master; the old symbol will be hidden from normal browsing.".to_string(),
        "DELISTED" => "The covered symbol is present in NSE's official delisted companies list and will be hidden from normal browsing.".to_string(),
        "OUTSIDE_COVERAGE" => "This instrument's series is outside the equity/SME source coverage. Absence is not inactivity evidence; it will remain active.".to_string(),
        _ => "The symbol is absent from this current master, but no applicable delisting or validated successor is established. It will remain active pending review.".to_string(),
    }
}

fn load_nse_official_delisted_symbols(
    root: &Path,
    urls: &OfficialSourceUrls,
) -> AppResult<HashSet<String>> {
    if let Some(path) = find_local_nse_delisted_workbook(root) {
        let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
        return parse_nse_delisted_workbook(&bytes);
    }

    #[cfg(test)]
    {
        // Production uses this configuration for the network fetch; tests stay network-free.
        let _ = urls;
        Ok(HashSet::new())
    }

    #[cfg(not(test))]
    {
        fetch_nse_delisted_workbook(urls)
            .and_then(|(bytes, _source_url)| parse_nse_delisted_workbook(&bytes))
    }
}

fn download_nse_current_universe_master_internal(
    archive_root: &Path,
    urls: &OfficialSourceUrls,
) -> AppResult<NseCurrentUniverseMasterDownloadResult> {
    let securities_target_dir = archive_root
        .join("NSE")
        .join("Identity")
        .join("SecuritiesAvailable");
    let symbol_changes_target_dir = archive_root
        .join("NSE")
        .join("Identity")
        .join("SymbolChanges");
    let company_name_changes_target_dir = archive_root
        .join("NSE")
        .join("Identity")
        .join("CompanyNameChanges");
    std::fs::create_dir_all(&securities_target_dir).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&symbol_changes_target_dir).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&company_name_changes_target_dir)
        .map_err(|error| error.to_string())?;

    let equity_bytes = fetch_nse_security_master_csv(
        &urls.nse_equity_master_url,
        &urls.nse_securities_available_page_url,
    )?;
    let sme_bytes = fetch_nse_security_master_csv(
        &urls.nse_sme_master_url,
        &urls.nse_securities_available_page_url,
    )?;
    let symbol_change_bytes = fetch_nse_security_master_csv(
        &urls.nse_symbol_change_url,
        &urls.nse_securities_available_page_url,
    )?;
    let (company_name_change_bytes, company_final_url, company_http_status) = fetch_nse_security_master_response(
        &urls.nse_company_name_change_url,
        &urls.nse_securities_available_page_url,
    )?;
    let company_name_change_rows_read = validate_company_name_response(
        &company_name_change_bytes, &urls.nse_company_name_change_url, company_http_status,
    ).map_err(|error| company_name_failure_diagnostic(
        Some(archive_root), &company_name_change_bytes,
        &urls.nse_company_name_change_url, Some(&company_final_url),
        Some(company_http_status), &error,
    ))?;
    let allowed = CURRENT_UNIVERSE_SUPPORTED_SERIES
        .iter()
        .map(|value| (*value).to_string())
        .collect::<HashSet<_>>();
    let equity_rows = load_security_master_rows_from_bytes(
        &equity_bytes,
        &urls.nse_equity_master_url,
        Some(&allowed),
    )?;
    let sme_rows =
        load_security_master_rows_from_bytes(&sme_bytes, &urls.nse_sme_master_url, Some(&allowed))?;
    let symbol_change_rows =
        load_symbol_change_rows_from_bytes(&symbol_change_bytes, &urls.nse_symbol_change_url)?;
    validate_nse_current_population_sanity(equity_rows.len())?;

    let equity_file_path =
        securities_target_dir.join("nse_identity_securities_available_equity.csv");
    let sme_file_path = securities_target_dir.join("nse_identity_securities_available_sme.csv");
    let symbol_change_file_path = symbol_changes_target_dir.join("nse_identity_symbol_changes.csv");
    let company_name_change_file_path =
        company_name_changes_target_dir.join("nse_identity_company_name_changes.csv");
    write_validated_download(&equity_file_path, &equity_bytes)?;
    write_validated_download(&sme_file_path, &sme_bytes)?;
    write_validated_download(&symbol_change_file_path, &symbol_change_bytes)?;
    write_validated_download(&company_name_change_file_path, &company_name_change_bytes)?;

    Ok(NseCurrentUniverseMasterDownloadResult {
        equity_file_path: equity_file_path.display().to_string(),
        sme_file_path: sme_file_path.display().to_string(),
        symbol_change_file_path: symbol_change_file_path.display().to_string(),
        company_name_change_file_path: company_name_change_file_path.display().to_string(),
        equity_rows_read: equity_rows.len() as u32,
        sme_rows_read: sme_rows.len() as u32,
        symbol_change_rows_read: symbol_change_rows.len() as u32,
        company_name_change_rows_read,
        bytes_written: (equity_bytes.len()
            + sme_bytes.len()
            + symbol_change_bytes.len()
            + company_name_change_bytes.len()) as u64,
        message: format!(
            "Downloaded NSE current master with {} equity row(s), {} SME row(s), {} symbol-change row(s), and {} company-name-change row(s).",
            equity_rows.len(),
            sme_rows.len(),
            symbol_change_rows.len(),
            company_name_change_rows_read
        ),
    })
}

#[cfg(test)]
mod company_name_diagnostic_tests {
    use super::*;

    #[test]
    fn missing_column_and_blank_record_have_distinct_context() {
        let missing = load_name_change_rows_from_bytes(b"SYMBOL,NEW NAME,DATE\n", "fixture").unwrap_err();
        assert!(missing.contains("Missing old company name column"));
        assert!(missing.contains("CSV headers:"));
        let blank = load_name_change_rows_from_bytes(
            b"SYMBOL,OLD NAME,NEW NAME,DATE\nABC,,New Limited,01-Jan-2026\n", "fixture",
        ).unwrap_err();
        assert!(blank.contains("Missing old company name in"));
        assert!(blank.contains("record position:"));
        assert!(blank.contains("ABC"));
        assert!(blank.contains("line: 2"));
    }

    #[test]
    fn captures_exact_bytes_without_replacing_saved_source() {
        let root = tempfile::tempdir().unwrap();
        let saved = root.path().join("NSE/Identity/CompanyNameChanges/nse_identity_company_name_changes.csv");
        std::fs::create_dir_all(saved.parent().unwrap()).unwrap();
        std::fs::write(&saved, b"last valid source").unwrap();
        let bytes = b"SYMBOL,NEW NAME,DATE\r\nABC,New,01-Jan-2026\r\n";
        let mut paths = Vec::new();
        for _ in 0..2 {
            let result = company_name_failure_diagnostic(Some(root.path()), bytes,
                "https://nsearchives.nseindia.com/namechange.csv", Some("https://nsearchives.nseindia.com/namechange.csv"),
                Some(200), "missing old-name column");
            let receipt: serde_json::Value = serde_json::from_str(&result).unwrap();
            let path = PathBuf::from(receipt["retainedDiagnosticPath"].as_str().unwrap());
            let disk: serde_json::Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            assert_eq!(disk["contentSha256"], sha256_hex_bytes(bytes));
            assert_eq!(disk["httpStatus"], 200);
            assert_eq!(disk["csvHeaders"][0], "SYMBOL");
            assert_eq!(std::fs::read(path.parent().unwrap().join("response.bin")).unwrap(), bytes);
            paths.push(path);
        }
        assert_ne!(paths[0], paths[1]);
        assert_eq!(std::fs::read(saved).unwrap(), b"last valid source");
    }

    #[test]
    fn retention_failure_is_explicit_and_keeps_original_error() {
        let root = tempfile::tempdir().unwrap();
        let blocked = root.path().join("file");
        std::fs::write(&blocked, b"unchanged").unwrap();
        let result = company_name_failure_diagnostic(Some(&blocked), b"bad", "fixture", None, None, "parser failed");
        let receipt: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(receipt["reason"], "parser failed");
        assert!(receipt["retentionError"].is_string());
        assert!(receipt["retainedDiagnosticPath"].is_null());
        assert_eq!(std::fs::read(blocked).unwrap(), b"unchanged");
    }

    #[test]
    fn non_success_response_never_passes_csv_validation() {
        assert!(validate_company_name_response(b"SYMBOL,OLD NAME,NEW NAME,DATE\n", "fixture", 403)
            .unwrap_err().contains("HTTP 403"));
    }
}

fn validate_company_name_response(bytes: &[u8], url: &str, status: u16) -> AppResult<u32> {
    if !(200..300).contains(&status) {
        return Err(format!("NSE company-name download failed: HTTP {status}"));
    }
    validate_nse_company_name_change_download(bytes, url)
}

/// Diagnostic captures are never input archives or authority to apply identity changes.
pub(crate) fn company_name_failure_diagnostic(
    archive_root: Option<&Path>,
    bytes: &[u8],
    request_url: &str,
    final_url: Option<&str>,
    http_status: Option<u16>,
    reason: &str,
) -> String {
    let headers = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(Cursor::new(bytes))
        .headers()
        .map(|headers| headers.iter().map(str::to_owned).collect::<Vec<_>>())
        .map_err(|error| error.to_string());
    let mut diagnostic = serde_json::json!({
        "capturedAtUtc": chrono::Utc::now().to_rfc3339(),
        "sourceId": "NSE_COMPANY_NAME_CHANGE",
        "requestUrl": request_url,
        "finalUrl": final_url,
        "httpStatus": http_status,
        "contentBytes": bytes.len(),
        "contentSha256": sha256_hex_bytes(bytes),
        "csvHeaders": headers.ok(),
        "reason": reason,
        "savedSources": "Unchanged by diagnostic capture; failed response is not an import source."
    });
    if let Some(root) = archive_root {
        let retained = (|| -> AppResult<PathBuf> {
            if bytes.len() > 8 * 1024 * 1024 {
                return Err("Response exceeds the 8 MiB diagnostic retention limit.".to_string());
            }
            let parent = root.join("NSE").join("Identity").join("Diagnostics");
            std::fs::create_dir_all(&parent).map_err(|error| error.to_string())?;
            let nonce = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)
                .map_err(|error| error.to_string())?.as_nanos();
            let directory = parent.join(format!("company-name-{nonce}-{}", std::process::id()));
            // A collision fails rather than overwriting an earlier capture.
            std::fs::create_dir(&directory).map_err(|error| error.to_string())?;
            std::fs::write(directory.join("response.bin"), bytes).map_err(|error| error.to_string())?;
            let receipt_path = directory.join("diagnostic.json");
            std::fs::write(&receipt_path, serde_json::to_vec_pretty(&diagnostic)
                .map_err(|error| error.to_string())?).map_err(|error| error.to_string())?;
            Ok(receipt_path)
        })();
        match retained {
            Ok(path) => diagnostic["retainedDiagnosticPath"] = path.display().to_string().into(),
            Err(error) => diagnostic["retentionError"] = error.into(),
        }
    }
    serde_json::to_string_pretty(&diagnostic).unwrap_or_else(|_| reason.to_string())
}

fn write_validated_download(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let temp_path = path.with_extension("download.tmp");
    std::fs::write(&temp_path, bytes).map_err(|error| error.to_string())?;
    let copy_result = std::fs::copy(&temp_path, path).map_err(|error| error.to_string());
    let _ = std::fs::remove_file(&temp_path);
    copy_result.map(|_| ())
}

#[cfg(not(test))]
fn fetch_nse_security_master_csv(url: &str, referer_url: &str) -> AppResult<Vec<u8>> {
    let (bytes, _, status) = fetch_nse_security_master_response(url, referer_url)?;
    if !(200..300).contains(&status) {
        return Err(format!("NSE current master CSV download failed: HTTP {status}"));
    }
    if String::from_utf8_lossy(&bytes).trim_start().starts_with('<') {
        return Err("NSE current master download returned HTML instead of CSV.".to_string());
    }
    Ok(bytes)
}

#[cfg(not(test))]
fn fetch_nse_security_master_response(url: &str, referer_url: &str) -> AppResult<(Vec<u8>, String, u16)> {
    validate_nse_official_source_url(url)?;
    validate_nse_official_source_url(referer_url)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(45))
        .cookie_store(true)
        .redirect(nse_official_redirect_policy())
        .build()
        .map_err(|error| error.to_string())?;

    match client
        .get(referer_url)
        .header(ACCEPT, "text/html,*/*")
        .header(USER_AGENT, NSE_USER_AGENT)
        .send()
    {
        Ok(response) => {
            validate_nse_official_source_url(response.url().as_str())?;
        }
        Err(error) => {
            if error
                .to_string()
                .contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED")
            {
                return Err(format!(
                    "Could not access NSE official-source landing page: {error}"
                ));
            }
        }
    }

    let response = client
        .get(url)
        .header(ACCEPT, "text/csv,application/csv,*/*")
        .header(REFERER, referer_url)
        .header(USER_AGENT, NSE_USER_AGENT)
        .send()
        .map_err(|error| format!("Could not download NSE current master CSV: {error}"))?;

    validate_nse_official_source_url(response.url().as_str())?;

    let final_url = response.url().to_string();
    let http_status = response.status().as_u16();
    let bytes = response.bytes().map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Could not read NSE current master CSV: {error}"))?;
    Ok((bytes, final_url, http_status))
}

#[cfg(test)]
fn fetch_nse_security_master_response(_url: &str, _referer_url: &str) -> AppResult<(Vec<u8>, String, u16)> {
    Err("NSE current master CSV download is not available in tests.".to_string())
}

#[cfg(test)]
fn fetch_nse_security_master_csv(_url: &str, _referer_url: &str) -> AppResult<Vec<u8>> {
    Err("NSE current master CSV download is not available in tests.".to_string())
}

fn download_nse_delisted_workbook_internal(
    archive_root: &Path,
    urls: &OfficialSourceUrls,
) -> AppResult<NseDelistedWorkbookDownloadResult> {
    let (bytes, source_url) = fetch_nse_delisted_workbook(urls)?;
    let symbols = parse_nse_delisted_workbook(&bytes)?;
    let target_dir = archive_root.join("NSE").join("Identity").join("Delisted");
    std::fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let file_path = target_dir.join("nse_identity_delisted_companies.xlsx");
    std::fs::write(&file_path, &bytes).map_err(|error| error.to_string())?;

    Ok(NseDelistedWorkbookDownloadResult {
        file_path: file_path.display().to_string(),
        source_url,
        symbols_read: symbols.len() as u32,
        bytes_written: bytes.len() as u64,
        message: format!(
            "Downloaded NSE delisted workbook with {} symbol(s).",
            symbols.len()
        ),
    })
}

fn find_local_nse_delisted_workbook(root: &Path) -> Option<PathBuf> {
    let candidates = [
        root.join("NSE")
            .join("Identity")
            .join("Delisted")
            .join("nse_identity_delisted_companies.xlsx"),
        root.join("NSE")
            .join("Identity")
            .join("Delisted")
            .join("List of delisted Companies.xlsx"),
        root.join("NSE")
            .join("Identity")
            .join("Delisted")
            .join("List of Delisted Companies.xlsx"),
    ];
    candidates.into_iter().find(|path| path.exists())
}

#[cfg(not(test))]
fn fetch_nse_delisted_workbook(urls: &OfficialSourceUrls) -> AppResult<(Vec<u8>, String)> {
    validate_nse_official_source_url(&urls.nse_delisted_page_url)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(45))
        .cookie_store(true)
        .redirect(nse_official_redirect_policy())
        .build()
        .map_err(|error| error.to_string())?;

    let page_html = match client
        .get(&urls.nse_delisted_page_url)
        .header(ACCEPT, "text/html,*/*")
        .header(USER_AGENT, NSE_USER_AGENT)
        .send()
    {
        Ok(response) => {
            validate_nse_official_source_url(response.url().as_str())?;
            response.text().unwrap_or_default()
        }
        Err(error) => {
            if error
                .to_string()
                .contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED")
            {
                return Err(format!(
                    "Could not access NSE delisted official-source page: {error}"
                ));
            }
            String::new()
        }
    };

    let workbook_url =
        discover_nse_delisted_workbook_url(&page_html, &urls.nse_delisted_workbook_url);
    validate_nse_official_source_url(&workbook_url)?;

    let response = client
        .get(&workbook_url)
        .header(
            ACCEPT,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        )
        .header(REFERER, &urls.nse_delisted_page_url)
        .header(USER_AGENT, NSE_USER_AGENT)
        .send()
        .map_err(|error| format!("Could not download NSE delisted companies workbook: {error}"))?
        .error_for_status()
        .map_err(|error| format!("NSE delisted companies workbook download failed: {error}"))?;

    validate_nse_official_source_url(response.url().as_str())?;

    let bytes = response
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Could not read NSE delisted companies workbook: {error}"))?;
    Ok((bytes, workbook_url))
}

#[cfg(test)]
fn fetch_nse_delisted_workbook(_urls: &OfficialSourceUrls) -> AppResult<(Vec<u8>, String)> {
    Err("NSE delisted workbook download is not available in tests.".to_string())
}

pub(super) fn discover_nse_actual_delisted_workbook_url_for_health(
    page_html: &str,
) -> Option<String> {
    let decoded = percent_decode(page_html);
    find_actual_nse_delisted_xlsx_url(&decoded)
        .or_else(|| find_actual_nse_delisted_xlsx_url(page_html))
}

fn discover_nse_delisted_workbook_url(page_html: &str, fallback_url: &str) -> String {
    discover_nse_actual_delisted_workbook_url_for_health(page_html)
        .unwrap_or_else(|| fallback_url.to_string())
}

fn find_actual_nse_delisted_xlsx_url(value: &str) -> Option<String> {
    let lower = value.to_ascii_lowercase();
    let mut search_start = 0;

    while let Some(relative_end) = lower[search_start..].find(".xlsx") {
        let end = search_start + relative_end + ".xlsx".len();

        let start = match value[..end].rfind("https://") {
            Some(start) => start,
            None => {
                search_start = end;
                continue;
            }
        };

        let candidate = value[start..end].replace("//web", "/web");
        let context = nse_delisted_xlsx_context(value, &lower, start, end);

        if is_actual_nse_delisted_workbook_semantics(&candidate, context) {
            return Some(candidate);
        }

        search_start = end;
    }

    None
}

fn nse_delisted_xlsx_context<'a>(
    value: &'a str,
    lower: &str,
    url_start: usize,
    url_end: usize,
) -> &'a str {
    let anchor_start = lower[..url_start].rfind("<a");
    let anchor_close_before = lower[..url_start].rfind("</a>");

    let anchor_start = match anchor_start {
        Some(anchor_start) => anchor_start,
        None => return &value[url_start..url_end],
    };

    if let Some(anchor_close_before) = anchor_close_before {
        if anchor_close_before > anchor_start {
            return &value[url_start..url_end];
        }
    }

    let relative_anchor_end = match lower[url_end..].find("</a>") {
        Some(relative_anchor_end) => relative_anchor_end,
        None => return &value[url_start..url_end],
    };

    let anchor_end = url_end + relative_anchor_end + "</a>".len();
    &value[anchor_start..anchor_end]
}

fn is_actual_nse_delisted_workbook_semantics(candidate: &str, context: &str) -> bool {
    let semantic_text = format!("{candidate} {context}")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                ' '
            }
        })
        .collect::<String>();

    let terms = semantic_text.split_whitespace().collect::<Vec<_>>();
    let has_delisted = terms.iter().any(|term| *term == "delisted");
    let has_company = terms
        .iter()
        .any(|term| *term == "company" || *term == "companies");
    let has_proposed = terms.iter().any(|term| *term == "proposed");

    has_delisted && has_company && !has_proposed
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[index + 1..index + 3]) {
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    decoded.push(byte);
                    index += 3;
                    continue;
                }
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

fn parse_nse_delisted_workbook(bytes: &[u8]) -> AppResult<HashSet<String>> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|error| error.to_string())?;
    let shared_strings = read_xlsx_shared_strings(&mut archive)?;
    let mut sheet_xml = String::new();
    archive
        .by_name("xl/worksheets/sheet1.xml")
        .map_err(|error| error.to_string())?
        .read_to_string(&mut sheet_xml)
        .map_err(|error| error.to_string())?;
    let rows = read_xlsx_sheet_rows(&sheet_xml, &shared_strings);
    let Some(symbol_index) = find_nse_delisted_symbol_column(&rows) else {
        return Err("NSE delisted workbook did not contain a Symbol column.".to_string());
    };

    let mut symbols = HashSet::new();
    for row in rows {
        if let Some(value) = row.get(symbol_index) {
            if looks_like_nse_delisted_header(value) {
                continue;
            }
            if let Ok(symbol) = normalize_symbol(value) {
                if !symbol.is_empty() && symbol.chars().any(|ch| ch.is_ascii_alphabetic()) {
                    symbols.insert(symbol);
                }
            }
        }
    }
    if symbols.is_empty() {
        return Err("NSE delisted workbook did not contain any symbols.".to_string());
    }
    Ok(symbols)
}

fn read_xlsx_shared_strings<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> AppResult<Vec<String>> {
    let mut xml = String::new();
    match archive.by_name("xl/sharedStrings.xml") {
        Ok(mut file) => {
            file.read_to_string(&mut xml)
                .map_err(|error| error.to_string())?;
        }
        Err(_) => return Ok(Vec::new()),
    }
    Ok(extract_xml_blocks(&xml, "si")
        .into_iter()
        .map(|block| {
            extract_xml_blocks(&block, "t")
                .into_iter()
                .map(|value| xml_unescape(&strip_xml_tags(&value)))
                .collect::<Vec<_>>()
                .join("")
        })
        .collect())
}

fn read_xlsx_sheet_rows(sheet_xml: &str, shared_strings: &[String]) -> Vec<Vec<String>> {
    extract_xml_blocks(sheet_xml, "row")
        .into_iter()
        .map(|row_xml| {
            let mut cells = HashMap::<usize, String>::new();
            for cell_xml in extract_xml_elements(&row_xml, "c") {
                let Some(column_index) = xlsx_cell_column_index(&cell_xml) else {
                    continue;
                };
                let value = xlsx_cell_value(&cell_xml, shared_strings);
                cells.insert(column_index, value);
            }
            let width = cells.keys().max().map(|index| index + 1).unwrap_or(0);
            (0..width)
                .map(|index| cells.remove(&index).unwrap_or_default())
                .collect::<Vec<_>>()
        })
        .collect()
}

fn find_nse_delisted_symbol_column(rows: &[Vec<String>]) -> Option<usize> {
    rows.iter().take(20).find_map(|row| {
        row.iter()
            .position(|value| looks_like_nse_delisted_header(value))
    })
}

fn looks_like_nse_delisted_header(value: &str) -> bool {
    let normalized = normalize_header(value);
    normalized == "symbol" || normalized == "securitysymbol" || normalized == "symbolofcompany"
}

fn xlsx_cell_column_index(cell_xml: &str) -> Option<usize> {
    let marker = " r=\"";
    let start = cell_xml.find(marker)? + marker.len();
    let end = cell_xml[start..].find('"')? + start;
    let letters = cell_xml[start..end]
        .chars()
        .take_while(|ch| ch.is_ascii_alphabetic())
        .collect::<String>();
    if letters.is_empty() {
        return None;
    }
    let mut value = 0_usize;
    for ch in letters.chars() {
        value = value * 26 + (ch.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    Some(value.saturating_sub(1))
}

fn xlsx_cell_value(cell_xml: &str, shared_strings: &[String]) -> String {
    let raw_value = extract_xml_blocks(cell_xml, "v")
        .into_iter()
        .next()
        .or_else(|| extract_xml_blocks(cell_xml, "t").into_iter().next())
        .unwrap_or_default();
    let value = xml_unescape(&strip_xml_tags(&raw_value));
    if cell_xml.contains(" t=\"s\"") {
        return value
            .parse::<usize>()
            .ok()
            .and_then(|index| shared_strings.get(index).cloned())
            .unwrap_or_default();
    }
    value
}

fn extract_xml_blocks(xml: &str, tag: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut search_from = 0_usize;
    let open_prefix = format!("<{tag}");
    let close_tag = format!("</{tag}>");
    while let Some(open_rel) = xml[search_from..].find(&open_prefix) {
        let open = search_from + open_rel;
        let Some(open_end_rel) = xml[open..].find('>') else {
            break;
        };
        let content_start = open + open_end_rel + 1;
        let Some(close_rel) = xml[content_start..].find(&close_tag) else {
            break;
        };
        let close = content_start + close_rel;
        blocks.push(xml[content_start..close].to_string());
        search_from = close + close_tag.len();
    }
    blocks
}

fn extract_xml_elements(xml: &str, tag: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut search_from = 0_usize;
    let open_prefix = format!("<{tag}");
    let close_tag = format!("</{tag}>");
    while let Some(open_rel) = xml[search_from..].find(&open_prefix) {
        let open = search_from + open_rel;
        let Some(close_rel) = xml[open..].find(&close_tag) else {
            break;
        };
        let close_end = open + close_rel + close_tag.len();
        blocks.push(xml[open..close_end].to_string());
        search_from = close_end;
    }
    blocks
}

fn strip_xml_tags(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output
}

fn xml_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .trim()
        .to_string()
}

#[cfg(test)]
mod lifecycle_coverage_tests {
    use super::*;

    fn existing(symbol: &str, series: Option<&str>) -> ExistingNseInstrumentRow {
        ExistingNseInstrumentRow { symbol: symbol.into(), isin: Some("SAMEISIN".into()), name: Some(symbol.into()),
            series: series.map(str::to_string), is_active: true }
    }
    fn current() -> Vec<NseSecurityMasterRow> {
        vec![NseSecurityMasterRow { symbol: "CURR".into(), company_name: Some("CURR".into()),
            isin: Some("SAMEISIN".into()), series: Some("EQ".into()) }]
    }
    fn hints(edges: &[(&str, &str, &str)]) -> NseIdentityHistoryHints {
        let mut result = NseIdentityHistoryHints::default();
        for (old, new, date) in edges {
            result.transition_edges.entry((*old).into()).or_default().insert(((*new).into(), (*date).into()));
        }
        result
    }
    fn plan(rows: Vec<ExistingNseInstrumentRow>, hints: NseIdentityHistoryHints, delisted: HashSet<String>) -> NseCurrentUniverseSyncPlan {
        plan_nse_current_universe_sync_from_rows("fixture".into(), 1, current(), rows, hints, delisted)
    }

    #[test]
    fn absent_uncovered_series_remain_active_even_with_delisting_or_rename_hints() {
        for series in [Some("SG"), Some("TB"), Some("N1"), Some("SF"), None] {
            let p = plan(vec![existing("ABSENT", series)], hints(&[("ABSENT", "CURR", "2020-01-01")]), HashSet::from(["ABSENT".into()]));
            assert!(p.deactivate_symbols.is_empty());
            let row = p.preview_rows.iter().find(|r| r.symbol == "ABSENT").unwrap();
            assert_eq!(row.action, "OUTSIDE_COVERAGE");
            assert_eq!(row.proposed_status, "ACTIVE");
        }
    }

    #[test]
    fn supported_unknown_absence_and_self_mapping_do_not_authorize_deactivation() {
        for series in CURRENT_UNIVERSE_SUPPORTED_SERIES {
            let mut h = hints(&[("ABSENT", "ABSENT", "2020-01-01")]);
            h.symbol_to_current.insert("ABSENT".into(), "ABSENT".into());
            let p = plan(vec![existing("ABSENT", Some(series))], h, HashSet::new());
            assert!(p.deactivate_symbols.is_empty());
            let row = p.preview_rows.iter().find(|r| r.symbol == "ABSENT").unwrap();
            assert_eq!(row.action, "REVIEW_REQUIRED");
            assert_eq!(row.proposed_status, "ACTIVE");
        }
    }

    #[test]
    fn dated_path_requires_unique_increasing_past_edges_and_a_live_successor() {
        let live = HashSet::from(["CURR".into()]);
        assert_eq!(validated_current_successor("OLD", &hints(&[("OLD", "MID", "2019-01-01"), ("MID", "CURR", "2020-01-01")]), &live), Some("CURR".into()));
        for edges in [
            vec![("OLD", "CURR", "2999-01-01")],
            vec![("OLD", "CURR", "invalid")],
            vec![("OLD", "MISSING", "2020-01-01")],
            vec![("OLD", "CURR", "2020-01-01"), ("OLD", "OTHER", "2021-01-01")],
            vec![("OLD", "MID", "2020-01-01"), ("MID", "CURR", "2020-01-01")],
            vec![("OLD", "MID", "2021-01-01"), ("MID", "OLD", "2022-01-01")],
        ] { assert_eq!(validated_current_successor("OLD", &hints(&edges), &live), None); }
    }

    #[test]
    fn name_only_and_isin_hints_cannot_be_used_as_rename_proof() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instrument_identity_history(current_symbol TEXT,old_symbol TEXT,new_symbol TEXT,isin TEXT,effective_date TEXT,change_type TEXT,exchange TEXT);
            INSERT INTO instrument_identity_history VALUES('CURR','ABSENT','CURR','SAMEISIN','2020-01-01','NAME_CHANGE','NSE');").unwrap();
        let h = load_identity_history_hints(&c, "NSE").unwrap();
        assert_eq!(h.symbol_to_current.get("ABSENT").map(String::as_str), Some("CURR"));
        assert!(h.transition_edges.is_empty());
        let p = plan(vec![existing("ABSENT", Some("EQ"))], h, HashSet::new());
        assert!(p.deactivate_symbols.is_empty());
    }

    #[test]
    fn apply_preserves_held_flags_and_hides_only_explicitly_evidenced_rows() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE instruments(symbol TEXT,exchange TEXT,isin TEXT,name TEXT,series TEXT,is_active INTEGER,lifecycle_status TEXT,updated_at TEXT,PRIMARY KEY(symbol,exchange));
            INSERT INTO instruments VALUES('HELD','NSE','SAMEISIN','HELD','EQ',1,'CURRENT','original');
            INSERT INTO instruments VALUES('DEBT','NSE','SAMEISIN','DEBT','N1',1,'CURRENT','original');
            INSERT INTO instruments VALUES('OLD','NSE','SAMEISIN','OLD','EQ',1,'CURRENT','original');
            INSERT INTO instruments VALUES('DELIST','NSE','SAMEISIN','DELIST','BE',1,'CURRENT','original');").unwrap();
        let p = plan(vec![existing("HELD", Some("EQ")), existing("DEBT", Some("N1")), existing("OLD", Some("EQ")), existing("DELIST", Some("BE"))],
            hints(&[("OLD", "CURR", "2020-01-01")]), HashSet::from(["DELIST".into()]));
        assert_eq!(p.deactivate_count, 2);
        apply_nse_current_universe_sync_plan(&c, &p).unwrap();
        for symbol in ["HELD", "DEBT"] {
            let state: (i64, String, String) = c.query_row("SELECT is_active,lifecycle_status,updated_at FROM instruments WHERE symbol=?", [symbol], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
            assert_eq!(state, (1, "CURRENT".into(), "original".into()));
        }
        for (symbol, status) in [("OLD", "OLD_SYMBOL"), ("DELIST", "DELISTED")] {
            assert_eq!(c.query_row("SELECT lifecycle_status FROM instruments WHERE symbol=? AND is_active=0", [symbol], |r| r.get::<_, String>(0)).unwrap(), status);
        }
    }

    #[test]
    fn incomplete_write_plan_is_rejected_before_any_changes() {
        let c = Connection::open_in_memory().unwrap();
        let mut p = plan(Vec::new(), NseIdentityHistoryHints::default(), HashSet::new());
        p.deactivate_symbols.push("HELD".into());
        assert!(apply_nse_current_universe_sync_plan_in_open_transaction(&c, &p).unwrap_err().contains("explicit lifecycle evidence"));
        assert_eq!(c.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
    }

    #[test]
    #[ignore = "Requires the pinned read-only audit copy; no live database access"]
    fn guarded_copy_current_plan_holds_the_1052_audited_absences() {
        let folder = Path::new("E:/TA Projects/EOD Charting Platform/tmp/ca-nse-lifecycle-coverage-20261029");
        assert_eq!(std::fs::read_to_string(folder.join("READ_ONLY_PLAN_ONLY.txt")).unwrap().trim(), "READ_ONLY_PLAN_ONLY");
        let c = Connection::open_with_flags(folder.join("proof.sqlite3"), rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        c.execute_batch("PRAGMA query_only=ON; BEGIN").unwrap();
        let root = Path::new("E:/TA Projects/EOD Charting Platform/EOD DATABASE/reference-data");
        let p = build_nse_current_universe_sync_plan(&c, &NseCurrentUniverseSyncInput { archive_root_path: None }, Some(root)).unwrap();
        assert_eq!(p.current_universe_symbols, 3200);
        assert_eq!(p.activate_count, 29);
        assert_eq!(p.update_count, 259);
        assert_eq!(p.deactivate_count, 0);
        assert_eq!(p.preview_rows.iter().filter(|r| r.action == "OUTSIDE_COVERAGE").count(), 990);
        assert_eq!(p.preview_rows.iter().filter(|r| r.action == "REVIEW_REQUIRED").count(), 62);
        assert!(p.preview_rows.iter().filter(|r| matches!(r.action.as_str(), "OUTSIDE_COVERAGE" | "REVIEW_REQUIRED")).all(|r| r.proposed_status == "ACTIVE"));
        assert_eq!(c.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
        c.execute_batch("ROLLBACK").unwrap();
    }
}

fn current_sync_action_rank(action: &str) -> u8 {
    match action {
        "REACTIVATE" => 0,
        "INSERT" => 1,
        "UPDATE" => 2,
        "OLD_SYMBOL" => 3,
        "DELISTED" => 4,
        "UNKNOWN_INACTIVE" => 5,
        "DEACTIVATE" => 6,
        "REVIEW_REQUIRED" => 7,
        "OUTSIDE_COVERAGE" => 8,
        _ => 9,
    }
}

fn build_header_map(headers: &StringRecord) -> HashMap<String, usize> {
    headers
        .iter()
        .enumerate()
        .map(|(index, header)| (normalize_header(header), index))
        .collect()
}

fn pick_field(
    header_map: &HashMap<String, usize>,
    record: &StringRecord,
    candidates: &[&str],
) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header_map
            .get(*candidate)
            .and_then(|index| record.get(*index))
            .and_then(|value| normalize_optional_text(Some(value)))
    })
}

fn normalize_header(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn looks_like_symbol_change_header(record: &StringRecord) -> bool {
    let normalized = record.iter().map(normalize_header).collect::<Vec<_>>();
    normalized.iter().any(|value| matches!(value.as_str(), "old" | "oldsymbol"))
        && normalized.iter().any(|value| matches!(value.as_str(), "new" | "newsymbol"))
        && normalized.iter().any(|value| matches!(value.as_str(), "date" | "effectivedate"))
}

// Health, saved-source preview and CA evidence must agree on header semantics.
// Reject competing columns rather than picking one value by alias priority.
fn identity_change_header_map(
    headers: &StringRecord,
    aliases: &[(&str, &[&str])],
    source_kind: &str,
) -> AppResult<HashMap<String, usize>> {
    let normalized = headers.iter().map(normalize_header).collect::<Vec<_>>();
    let mut map = build_header_map(headers);
    for (key, names) in aliases {
        let mut matches = normalized.iter().enumerate()
            .filter(|(_, name)| names.contains(&name.as_str()));
        if let Some((index, _)) = matches.next() {
            if matches.next().is_some() {
                return Err(format!("Ambiguous {source_kind} CSV columns for {key}."));
            }
            map.insert((*key).to_string(), index);
        }
    }
    Ok(map)
}

fn symbol_change_header_map(headers: &StringRecord) -> AppResult<HashMap<String, usize>> {
    identity_change_header_map(
        headers,
        &[
            ("old", &["old", "oldsymbol"]),
            ("new", &["new", "newsymbol"]),
            ("date", &["date", "effectivedate"]),
            ("company", &["company", "nameofthecompany", "nameofcompany"]),
        ],
        "symbol-change",
    )
}

#[cfg(test)]
mod identity_change_csv_compatibility_tests {
    use super::*;

    #[test]
    fn captured_official_company_name_response_parses_all_2332_rows() {
        let bytes = include_bytes!("fixtures/nse_namechange_20261028.csv");
        assert_eq!(sha256_hex_bytes(bytes), "ca456bf37b8d8e715708f1df04089fe09f7418275764d105351c5d9742cfac9f");
        let rows = load_name_change_rows_from_bytes(bytes, "retained official response").unwrap();
        assert_eq!(rows.len(), 2332);
        assert_eq!(rows[0].symbol, "1IADD");
        assert_eq!(rows[0].effective_date, "2016-03-08");
    }

    #[test]
    fn official_company_name_aliases_still_reject_ambiguity_and_bad_values() {
        let duplicate = b"SYMBOL,OLD NAME OF THE COMPANY,OLD NAME,NEW NAME OF THE COMPANY,EFFECTIVE DATE\nABC,Old,Other,New,01-Jan-2026\n";
        assert!(load_name_change_rows_from_bytes(duplicate, "fixture").unwrap_err().contains("Ambiguous"));
        let blank = b"SYMBOL,OLD NAME OF THE COMPANY,NEW NAME OF THE COMPANY,EFFECTIVE DATE\nABC,,New,01-Jan-2026\n";
        assert!(load_name_change_rows_from_bytes(blank, "fixture").unwrap_err().contains("Missing old company name"));
        let bad_date = b"SYMBOL,OLD NAME OF THE COMPANY,NEW NAME OF THE COMPANY,EFFECTIVE DATE\nABC,Old,New,invalid\n";
        assert!(load_name_change_rows_from_bytes(bad_date, "fixture").is_err());
    }


    #[test]
    fn official_symbol_headers_agree_across_identity_health_and_ca() {
        let bytes = b"NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nExample Limited,OLD,NEW,01-Jan-2026\n";
        let identity = load_symbol_change_rows_from_bytes(bytes, "fixture").unwrap();
        let ca = parse_ca_symbol_change_source(bytes).unwrap();
        assert_eq!(identity.len(), 1);
        assert_eq!(identity[0].company_name.as_deref(), Some("Example Limited"));
        assert_eq!(identity[0].old_symbol, ca[0].0);
        assert_eq!(identity[0].new_symbol, ca[0].1);
        assert_eq!(identity[0].effective_date, "2026-01-01");
        assert_eq!(identity[0].effective_date, ca[0].2);
        assert_eq!(ca[0].3, 2);
        assert_eq!(validate_nse_symbol_change_bytes_for_health(bytes, "fixture").unwrap(), 1);
    }

    #[test]
    fn legacy_and_reordered_symbol_headers_keep_field_meaning() {
        for bytes in [
            b"COMPANY,OLD,NEW,DATE\nExample Limited,OLD,NEW,01-Jan-2026\n".as_slice(),
            b"EFFECTIVE DATE,NEW SYMBOL,NAME OF THE COMPANY,OLD SYMBOL\n01-Jan-2026,NEW,Example Limited,OLD\n".as_slice(),
        ] {
            let identity = load_symbol_change_rows_from_bytes(bytes, "fixture").unwrap();
            let ca = parse_ca_symbol_change_source(bytes).unwrap();
            assert_eq!(identity[0].old_symbol, "OLD");
            assert_eq!(identity[0].new_symbol, "NEW");
            assert_eq!(ca[0].0, "OLD");
            assert_eq!(ca[0].1, "NEW");
        }
        let headerless = b"Example Limited,OLD,NEW,01-Jan-2026\n";
        assert_eq!(load_symbol_change_rows_from_bytes(headerless, "fixture").unwrap().len(), 1);
        assert!(parse_ca_symbol_change_source(headerless).is_err());
    }

    #[test]
    fn competing_or_duplicate_symbol_columns_fail_closed() {
        for bytes in [
            b"OLD,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nOLD,OTHER,NEW,01-Jan-2026\n".as_slice(),
            b"OLD SYMBOL,old_symbol,NEW SYMBOL,EFFECTIVE DATE\nOLD,OTHER,NEW,01-Jan-2026\n".as_slice(),
        ] {
            assert!(load_symbol_change_rows_from_bytes(bytes, "fixture").unwrap_err().contains("Ambiguous"));
            assert!(parse_ca_symbol_change_source(bytes).unwrap_err().contains("Ambiguous"));
        }
    }

    #[test]
    fn explicit_name_change_headers_and_legacy_columns_agree() {
        for bytes in [
            b"SYMBOL,OLD NAME,NEW NAME,EFFECTIVE DATE\nEXAMPLE,Previous Limited,Current Limited,01-Jan-2026\n".as_slice(),
            b"NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\nEXAMPLE,Previous Limited,Current Limited,01-Jan-2026\n".as_slice(),
            b"Effective Date,New Company Name,Symbol,Previous Company Name\n01-Jan-2026,Current Limited,EXAMPLE,Previous Limited\n".as_slice(),
        ] {
            let rows = load_name_change_rows_from_bytes(bytes, "fixture").unwrap();
            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].symbol, "EXAMPLE");
            assert_eq!(rows[0].old_name, "Previous Limited");
            assert_eq!(rows[0].new_name, "Current Limited");
            assert_eq!(rows[0].effective_date, "2026-01-01");
            assert_eq!(validate_nse_company_name_change_bytes_for_health(bytes, "fixture").unwrap(), 1);
        }
    }

    #[test]
    fn name_change_rejects_competing_aliases_and_missing_columns_even_when_empty() {
        let duplicate = b"SYMBOL,NCH_SYMBOL,OLD NAME,NEW NAME,EFFECTIVE DATE\nEXAMPLE,OTHER,Previous Limited,Current Limited,01-Jan-2026\n";
        assert!(load_name_change_rows_from_bytes(duplicate, "fixture").unwrap_err().contains("Ambiguous"));
        let missing = b"SYMBOL,OLD NAME,EFFECTIVE DATE\n";
        assert!(load_name_change_rows_from_bytes(missing, "fixture").unwrap_err().contains("Missing new company name"));
        let master = b"SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nEXAMPLE,Current Limited,EQ,INE000000001\n";
        assert!(load_name_change_rows_from_bytes(master, "fixture").unwrap_err().contains("Missing old company name"));
    }

    #[test]
    fn malformed_dates_and_missing_name_values_remain_errors() {
        let symbol = b"OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nOLD,NEW,31-Feb-2026\n";
        assert!(load_symbol_change_rows_from_bytes(symbol, "fixture").unwrap_err().contains("Invalid NSE identity date"));
        assert!(parse_ca_symbol_change_source(symbol).is_err());
        let name = b"SYMBOL,OLD NAME,NEW NAME,EFFECTIVE DATE\nEXAMPLE,,Current Limited,01-Jan-2026\n";
        assert!(load_name_change_rows_from_bytes(name, "fixture").unwrap_err().contains("Missing old company name"));
    }
}

fn parse_identity_date(value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Identity date is empty.".to_string());
    }
    let title_case = title_case_month_date(trimmed);
    for candidate in [trimmed.to_string(), title_case] {
        for format in ["%Y-%m-%d", "%d-%b-%Y", "%d-%B-%Y", "%d/%m/%Y"] {
            if let Ok(date) = NaiveDate::parse_from_str(&candidate, format) {
                return Ok(date.format("%Y-%m-%d").to_string());
            }
        }
    }
    Err(format!("Invalid NSE identity date: {value}"))
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

fn name_change_key(symbol: &str, effective_date: &str) -> String {
    format!("{symbol}|{effective_date}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn resolves_standard_archive_paths() {
        let root = create_temp_archive_root();
        let files = resolve_archive_files(&root).unwrap();
        assert!(files.securities_available_path.ends_with(
            "NSE\\Identity\\SecuritiesAvailable\\nse_identity_securities_available_equity.csv"
        ));
        assert!(files
            .symbol_changes_path
            .ends_with("NSE\\Identity\\SymbolChanges\\nse_identity_symbol_changes.csv"));
        assert!(files
            .company_name_changes_path
            .ends_with("NSE\\Identity\\CompanyNameChanges\\nse_identity_company_name_changes.csv"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_default_nse_current_universe_root_for_official_sync() {
        let default_root = PathBuf::from("E:\\ActiveDb\\reference-data");
        let input = NseCurrentUniverseSyncInput {
            archive_root_path: None,
        };

        let resolved = resolve_nse_current_universe_archive_root(&input, Some(&default_root))
            .expect("official sync should use the managed root");

        assert_eq!(resolved, default_root);
    }

    #[test]
    fn manual_nse_current_universe_root_overrides_default() {
        let default_root = PathBuf::from("E:\\ActiveDb\\reference-data");
        let manual_root = PathBuf::from("E:\\TA Projects\\Corporate");
        let input = NseCurrentUniverseSyncInput {
            archive_root_path: Some(manual_root.display().to_string()),
        };

        let resolved = resolve_nse_current_universe_archive_root(&input, Some(&default_root))
            .expect("manual archive root should be accepted");

        assert_eq!(resolved, manual_root);
    }

    #[test]
    fn discovers_percent_encoded_nse_delisted_workbook_url() {
        let page_html = r#"<a href="https%3A%2F%2Farchives.nseindia.com%2Fcontent%2Fequities%2FList%20of%20delisted%20Companies.xlsx">Download</a>"#;
        let fallback = "https://archives.nseindia.com/content/equities/fallback.xlsx";

        let discovered = discover_nse_delisted_workbook_url(page_html, fallback);

        assert_eq!(
            discovered,
            "https://archives.nseindia.com/content/equities/List of delisted Companies.xlsx"
        );
    }

    #[test]
    fn nse_delisted_workbook_url_prefers_actual_delisted_over_proposed() {
        let page_html = r#"
            <a href="https://nsearchives.nseindia.com/proposed/List%20of%20Companies%20Proposed%20to%20be%20Delisted.xlsx">
                List of Companies Proposed to be Delisted
            </a>
            <a href="https://nsearchives.nseindia.com/delisted/List%20of%20Companies%20Delisted%20from%20NSE.xlsx">
                List of Companies Delisted from NSE
            </a>
        "#;
        let fallback = "https://nsearchives.nseindia.com/fallback/List%20of%20delisted%20Companies.xlsx";

        let discovered = discover_nse_delisted_workbook_url(page_html, fallback);

        assert_eq!(
            discovered,
            "https://nsearchives.nseindia.com/delisted/List of Companies Delisted from NSE.xlsx",
            "actual-delisted workbook must outrank proposed-delisting workbook"
        );
    }

    #[test]
    fn nse_delisted_workbook_url_falls_back_when_only_proposed_exists() {
        let page_html = r#"
            <a href="https://nsearchives.nseindia.com/proposed/List%20of%20Companies%20Proposed%20to%20be%20Delisted.xlsx">
                List of Companies Proposed to be Delisted
            </a>
        "#;
        let fallback = "https://nsearchives.nseindia.com/fallback/List%20of%20delisted%20Companies.xlsx";

        let discovered = discover_nse_delisted_workbook_url(page_html, fallback);

        assert_eq!(
            discovered,
            fallback,
            "proposed-delisting workbook must never be promoted as actual-delisted authority"
        );
    }

    #[test]
    fn nse_delisted_workbook_url_uses_anchor_text_for_opaque_actual_link() {
        let page_html = r#"
            <a href="https://nsearchives.nseindia.com/proposed/proposed.xlsx">
                List of Companies Proposed to be Delisted
            </a>
            <a href="https://nsearchives.nseindia.com/web/mediaattachment/987654.xlsx">
                List of Companies Delisted from NSE
            </a>
        "#;
        let fallback = "https://nsearchives.nseindia.com/fallback/List%20of%20delisted%20Companies.xlsx";

        let discovered = discover_nse_delisted_workbook_url(page_html, fallback);

        assert_eq!(
            discovered,
            "https://nsearchives.nseindia.com/web/mediaattachment/987654.xlsx",
            "actual-delisted anchor semantics must authorize an opaque official workbook URL"
        );
    }

    #[test]
    fn nse_delisted_workbook_url_skips_processing_status_before_actual_delisted() {
        let page_html = r#"
            <a href="https://nsearchives.nseindia.com/status/delisting-processing-status.xlsx">
                Processing Status of Delisting Applications
            </a>
            <a href="https://nsearchives.nseindia.com/delisted/List%20of%20delisted%20Companies.xlsx">
                List of Companies Delisted from NSE
            </a>
        "#;
        let fallback = "https://nsearchives.nseindia.com/fallback/List%20of%20delisted%20Companies.xlsx";

        let discovered = discover_nse_delisted_workbook_url(page_html, fallback);

        assert_eq!(
            discovered,
            "https://nsearchives.nseindia.com/delisted/List of delisted Companies.xlsx",
            "processing-status workbook must not outrank actual-delisted authority"
        );
    }

    #[test]
    fn falls_back_when_nse_delisted_page_has_no_xlsx_url() {
        let fallback = "https://archives.nseindia.com/content/equities/fallback.xlsx";

        let discovered =
            discover_nse_delisted_workbook_url("<html>No workbook link</html>", fallback);

        assert_eq!(discovered, fallback);
    }

    #[test]
    fn reads_nse_delisted_workbook_symbol_column_from_shared_strings() {
        let shared_strings = vec![
            "Sr.no".to_string(),
            "Symbol".to_string(),
            "Name of Company".to_string(),
            "Name of the Promoter".to_string(),
            "ARCOTECH".to_string(),
            "Arcotech Limited".to_string(),
            "ATNINTER".to_string(),
            "ATN International Limited".to_string(),
        ];
        let sheet_xml = r#"
            <worksheet>
              <sheetData>
                <row r="1"><c r="A1"><v>1</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
                <row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row>
                <row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>6</v></c><c r="C3" t="s"><v>7</v></c></row>
              </sheetData>
            </worksheet>
        "#;

        let rows = read_xlsx_sheet_rows(sheet_xml, &shared_strings);
        let symbol_index = find_nse_delisted_symbol_column(&rows).unwrap();
        let symbols = rows
            .iter()
            .skip(1)
            .filter_map(|row| row.get(symbol_index))
            .cloned()
            .collect::<Vec<_>>();

        assert_eq!(symbol_index, 1);
        assert_eq!(symbols, vec!["ARCOTECH", "ATNINTER"]);
    }

    #[test]
    fn parses_nse_identity_dates() {
        assert_eq!(parse_identity_date("23-JAN-2023").unwrap(), "2023-01-23");
        assert_eq!(parse_identity_date("15-JUN-2004").unwrap(), "2004-06-15");
        assert_eq!(parse_identity_date("16/02/2007").unwrap(), "2007-02-16");
    }

    #[test]
    fn loads_headerless_symbol_change_rows() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("nse-symbolchange-{unique}.csv"));
        fs::write(
            &path,
            "360 ONE WAM LIMITED,IIFLWAM,360ONE,23-JAN-2023\nALIVUS LIFE SCIENCES LIMITED,GLS,ALIVUS,20-JAN-2025\n",
        )
        .unwrap();

        let rows = load_symbol_change_rows(&path).unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].old_symbol, "IIFLWAM");
        assert_eq!(rows[0].new_symbol, "360ONE");
        assert_eq!(rows[0].effective_date, "2023-01-23");
        assert_eq!(rows[1].old_symbol, "GLS");
        assert_eq!(rows[1].new_symbol, "ALIVUS");
        assert_eq!(rows[1].effective_date, "2025-01-20");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn expands_symbol_change_chains_from_current_symbols() {
        let current_equity_symbols = HashSet::from(["CURR".to_string()]);
        let existing_nse_symbols = HashSet::new();
        let symbol_change_rows = vec![
            NseSymbolChangeRow {
                company_name: None,
                old_symbol: "OLD2".to_string(),
                new_symbol: "CURR".to_string(),
                effective_date: "2024-01-01".to_string(),
            },
            NseSymbolChangeRow {
                company_name: None,
                old_symbol: "OLD1".to_string(),
                new_symbol: "OLD2".to_string(),
                effective_date: "2020-01-01".to_string(),
            },
        ];

        let included = build_included_identity_symbols(
            &current_equity_symbols,
            &existing_nse_symbols,
            &symbol_change_rows,
        );

        assert!(included.contains("CURR"));
        assert!(included.contains("OLD2"));
        assert!(included.contains("OLD1"));
    }

    #[test]
    fn loads_current_universe_rows_from_equity_and_sme_files() {
        let root = create_temp_archive_root();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nEQROW,Eq Row,EQ,INEEQ0000001\nBEROW,Be Row,BE,INEBE0000001\n",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_sme.csv"),
            "SYMBOL,NAME_OF_COMPANY,SERIES,ISIN_NUMBER\nSMEROW,Sme Row,SM,INESM0000001\nSTROW,St Row,ST,INEST0000001\n",
        )
        .unwrap();

        let (equity_path, sme_path) = resolve_current_universe_master_paths(&root).unwrap();
        let (master_rows_read, rows) =
            load_current_universe_master_rows(&equity_path, sme_path.as_deref()).unwrap();

        assert_eq!(master_rows_read, 4);
        assert_eq!(rows.len(), 4);
        assert!(rows
            .iter()
            .any(|row| row.symbol == "EQROW" && row.series.as_deref() == Some("EQ")));
        assert!(rows
            .iter()
            .any(|row| row.symbol == "BEROW" && row.series.as_deref() == Some("BE")));
        assert!(rows
            .iter()
            .any(|row| row.symbol == "SMEROW" && row.series.as_deref() == Some("SM")));
        assert!(rows
            .iter()
            .any(|row| row.symbol == "STROW" && row.series.as_deref() == Some("ST")));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn plans_current_universe_sync_with_insert_reactivate_update_and_deactivate() {
        let current_rows = vec![
            NseSecurityMasterRow {
                symbol: "CURR".to_string(),
                company_name: Some("Current Limited".to_string()),
                isin: Some("INECURR1".to_string()),
                series: Some("EQ".to_string()),
            },
            NseSecurityMasterRow {
                symbol: "NEWCO".to_string(),
                company_name: Some("Newco Limited".to_string()),
                isin: Some("INENEW1".to_string()),
                series: Some("EQ".to_string()),
            },
            NseSecurityMasterRow {
                symbol: "INACT".to_string(),
                company_name: Some("Inactive Limited".to_string()),
                isin: Some("INEINACT1".to_string()),
                series: Some("BE".to_string()),
            },
        ];
        let existing_rows = vec![
            ExistingNseInstrumentRow {
                symbol: "CURR".to_string(),
                isin: Some("INECURR1".to_string()),
                name: Some("Old Current Limited".to_string()),
                series: Some("EQ".to_string()),
                is_active: true,
            },
            ExistingNseInstrumentRow {
                symbol: "OLDCO".to_string(),
                isin: Some("INENEW1".to_string()),
                name: Some("Oldco Limited".to_string()),
                series: Some("EQ".to_string()),
                is_active: true,
            },
            ExistingNseInstrumentRow {
                symbol: "INACT".to_string(),
                isin: Some("INEINACT1".to_string()),
                name: Some("Inactive Limited".to_string()),
                series: Some("EQ".to_string()),
                is_active: false,
            },
            ExistingNseInstrumentRow {
                symbol: "DELIST".to_string(),
                isin: Some("INEDEL1".to_string()),
                name: Some("Delisted Limited".to_string()),
                series: Some("EQ".to_string()),
                is_active: true,
            },
        ];
        let history_hints = NseIdentityHistoryHints {
            symbol_to_current: HashMap::from([("OLDCO".to_string(), "NEWCO".to_string())]),
            transition_edges: HashMap::from([("OLDCO".to_string(), HashSet::from([("NEWCO".to_string(), "2020-01-01".to_string())]))]),
            isin_to_current: HashMap::new(),
            row_count: 1,
        };

        let plan = plan_nse_current_universe_sync_from_rows(
            "E:\\temp".to_string(),
            3,
            current_rows,
            existing_rows,
            history_hints,
            HashSet::from(["DELIST".to_string()]),
        );

        assert_eq!(plan.current_universe_symbols, 3);
        assert_eq!(plan.matched_by_symbol, 2);
        assert_eq!(plan.matched_by_isin, 1);
        assert_eq!(plan.activate_count, 2);
        assert_eq!(plan.update_count, 1);
        assert_eq!(plan.deactivate_count, 2);
        assert_eq!(plan.unchanged_active, 0);
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "UPDATE" && row.symbol == "CURR"));
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "INSERT" && row.symbol == "NEWCO"));
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "REACTIVATE" && row.symbol == "INACT"));
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "OLD_SYMBOL" && row.symbol == "OLDCO"));
        assert!(plan
            .preview_rows
            .iter()
            .any(|row| row.action == "DELISTED" && row.symbol == "DELIST"));
        assert!(plan.deactivate_symbols.contains(&"DELIST".to_string()));
    }

    #[test]
    fn i3_reviewed_plan_fingerprint_is_deterministic_and_content_sensitive() {
        let row_a = NseSecurityMasterRow {
            symbol: "ALPHA".to_string(),
            company_name: Some("Alpha Limited".to_string()),
            isin: Some("INEALPHA1".to_string()),
            series: Some("EQ".to_string()),
        };
        let row_b = NseSecurityMasterRow {
            symbol: "BETA".to_string(),
            company_name: Some("Beta Limited".to_string()),
            isin: Some("INEBETA01".to_string()),
            series: Some("BE".to_string()),
        };

        let plan_a = plan_nse_current_universe_sync_from_rows(
            "E:\\reviewed".to_string(),
            2,
            vec![row_a.clone(), row_b.clone()],
            Vec::new(),
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );
        let mut plan_b = plan_nse_current_universe_sync_from_rows(
            "E:\\reviewed".to_string(),
            2,
            vec![row_b, row_a],
            Vec::new(),
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );

        assert_eq!(
            nse_current_universe_plan_sha256(&plan_a),
            nse_current_universe_plan_sha256(&plan_b),
        );

        plan_b.current_rows[0].company_name = Some("Changed Company".to_string());
        assert_ne!(
            nse_current_universe_plan_sha256(&plan_a),
            nse_current_universe_plan_sha256(&plan_b),
        );
    }

    #[test]
    fn i3_reviewed_matching_fingerprint_applies_plan() {
        let root = create_temp_archive_root();
        write_i3_current_master(&root, "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n");
        let connection = create_phase5c_identity_import_connection();
        let sync_input = NseCurrentUniverseSyncInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let preview = preview_nse_current_universe_sync_internal(&connection, &sync_input, None)
            .expect("preview should succeed");

        let result = apply_nse_current_universe_sync_reviewed_internal(
            &connection,
            &NseCurrentUniverseApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256.clone(),
            },
            None,
        )
        .expect("matching reviewed fingerprint should apply");

        let old_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'OLDCO' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let current_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'CURR' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(result.applied);
        assert_eq!(result.plan_sha256, preview.plan_sha256);
        assert_eq!(old_is_active, 1);
        assert_eq!(result.deactivate_count, 0);
        assert!(result.preview_rows.iter().any(|row| row.symbol == "OLDCO" && row.action == "REVIEW_REQUIRED"));
        assert_eq!(current_is_active, 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i3_reviewed_source_change_rejects_before_any_write() {
        let root = create_temp_archive_root();
        write_i3_current_master(&root, "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n");
        let connection = create_phase5c_identity_import_connection();
        let sync_input = NseCurrentUniverseSyncInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let preview = preview_nse_current_universe_sync_internal(&connection, &sync_input, None)
            .expect("preview should succeed");

        write_i3_current_master(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\nNEWCO,New Company,EQ,INENEWCO1\n",
        );
        let before = read_i3_instrument_state(&connection);
        let error = apply_nse_current_universe_sync_reviewed_internal(
            &connection,
            &NseCurrentUniverseApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
            None,
        )
        .expect_err("changed source plan must reject");
        let after = read_i3_instrument_state(&connection);

        assert_eq!(error, NSE_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i3_reviewed_database_change_rejects_before_any_write() {
        let root = create_temp_archive_root();
        write_i3_current_master(&root, "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n");
        let connection = create_phase5c_identity_import_connection();
        let sync_input = NseCurrentUniverseSyncInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let preview = preview_nse_current_universe_sync_internal(&connection, &sync_input, None)
            .expect("preview should succeed");

        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, is_active, lifecycle_status) VALUES ('CURR', 'NSE', 'INECURR1', 'Current Limited', 'EQ', 1, 'CURRENT')",
                [],
            )
            .unwrap();
        let before = read_i3_instrument_state(&connection);
        let error = apply_nse_current_universe_sync_reviewed_internal(
            &connection,
            &NseCurrentUniverseApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
            None,
        )
        .expect_err("changed database-driven plan must reject");
        let after = read_i3_instrument_state(&connection);

        assert_eq!(error, NSE_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i3_reviewed_malformed_fingerprint_rejects_before_any_write() {
        let root = create_temp_archive_root();
        write_i3_current_master(&root, "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n");
        let connection = create_phase5c_identity_import_connection();
        let before = read_i3_instrument_state(&connection);

        let error = apply_nse_current_universe_sync_reviewed_internal(
            &connection,
            &NseCurrentUniverseApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: "not-a-sha".to_string(),
            },
            None,
        )
        .expect_err("malformed reviewed fingerprint must reject");
        let after = read_i3_instrument_state(&connection);

        assert_eq!(error, NSE_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_preview_rolls_back_and_is_deterministic() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let before = read_i4_database_state(&connection);
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };

        let first = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        let after_first = read_i4_database_state(&connection);
        let second = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        let after_second = read_i4_database_state(&connection);

        assert_eq!(before, after_first);
        assert_eq!(before, after_second);
        assert_eq!(first.plan_sha256, second.plan_sha256);
        assert!(first.can_apply);
        assert!(!first.applied);
        assert_eq!(first.new_symbol_changes, 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_source_snapshot_hashes_exact_bytes_and_plan_is_content_sensitive() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let snapshot = load_nse_historical_identity_source_snapshot(&input).unwrap();
        let master_path = root
            .join("NSE")
            .join("Identity")
            .join("SecuritiesAvailable")
            .join("nse_identity_securities_available_equity.csv");
        let symbol_path = root
            .join("NSE")
            .join("Identity")
            .join("SymbolChanges")
            .join("nse_identity_symbol_changes.csv");
        let name_path = root
            .join("NSE")
            .join("Identity")
            .join("CompanyNameChanges")
            .join("nse_identity_company_name_changes.csv");

        assert_eq!(
            snapshot.securities_available_sha256,
            sha256_hex_bytes(&fs::read(&master_path).unwrap())
        );
        assert_eq!(
            snapshot.symbol_changes_sha256,
            sha256_hex_bytes(&fs::read(&symbol_path).unwrap())
        );
        assert_eq!(
            snapshot.company_name_changes_sha256,
            sha256_hex_bytes(&fs::read(&name_path).unwrap())
        );
        assert_eq!(snapshot.current_universe_rows.len(), 1);

        let before = read_i4_database_state(&connection);
        let first = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        fs::write(
            &master_path,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited Revised,EQ,INECURR1\n",
        )
        .unwrap();
        let second = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        let after = read_i4_database_state(&connection);

        assert_ne!(first.plan_sha256, second.plan_sha256);
        assert_eq!(before, after);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_matching_reviewed_sha_commits_history_master_and_current_universe() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        let result = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256.clone(),
            },
        )
        .unwrap();

        let history_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_identity_history", [], |row| row.get(0))
            .unwrap();
        let current_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'CURR' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(result.applied);
        assert_eq!(result.plan_sha256, preview.plan_sha256);
        assert_eq!(history_count, 1);
        assert_eq!(current_is_active, 1);
        assert_eq!(connection.query_row("SELECT lifecycle_status FROM instruments WHERE symbol='OLDCO' AND exchange='NSE'", [], |row| row.get::<_, String>(0)).unwrap(), "OLD_SYMBOL");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_reporting_receipt_and_progress_share_commit_boundary() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n");
        let connection = create_phase5c_identity_import_connection();
        let archive = Some(root.display().to_string());
        let preview = preview_nse_historical_identity_archive_internal(&connection, &NseHistoricalIdentityPreviewInput { archive_root_path: archive.clone() }).unwrap();
        assert!(preview.can_apply);
        assert!(!connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='historical_identity_apply_runs')",[],|r|r.get::<_,bool>(0)).unwrap());
        let events = std::cell::RefCell::new(Vec::new());
        let result = apply_nse_historical_identity_archive_with_progress(&connection,
            &NseHistoricalIdentityApplyInput { archive_root_path: archive, expected_plan_sha256: preview.plan_sha256 }, &|event| events.borrow_mut().push(event)).unwrap();
        assert!(result.applied); assert!(result.run_id.is_some()); assert!(result.completed_at.is_some());
        let history = historical_reporting::read_history(&connection).unwrap();
        assert_eq!(history["runs"].as_array().unwrap().len(),1);
        assert!(history["runs"][0].get("historyRows").is_none());
        let before_read:i64=connection.query_row("SELECT total_changes()",[],|r|r.get(0)).unwrap();
        let saved=historical_reporting::read_report(&connection,result.run_id.as_deref().unwrap()).unwrap();
        assert_eq!(saved["applied"],true); assert!(!saved["historyRows"].as_array().unwrap().is_empty());
        assert!(historical_reporting::read_report(&connection,"' OR 1=1 --").is_err());
        assert_eq!(before_read,connection.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap());
        assert!(history["legacyRows"].as_array().unwrap().is_empty());
        let events=events.borrow(); assert_eq!(events.last().unwrap().stage,"committed");
        assert_eq!(events.last().unwrap().percent,Some(100));
        assert!(events[..events.len()-1].iter().all(|e|e.percent.is_none_or(|p|p<100)));
        assert!(connection.is_autocommit());
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_reporting_receipt_failure_rolls_back_every_identity_change() {
        let root=create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n");
        let connection=create_phase5c_identity_import_connection();
        connection.execute_batch("CREATE TABLE historical_identity_apply_runs(run_id TEXT PRIMARY KEY,completed_at TEXT,result_json TEXT);
            CREATE TRIGGER fail_historical_receipt BEFORE INSERT ON historical_identity_apply_runs BEGIN SELECT RAISE(FAIL,'injected receipt failure'); END;").unwrap();
        let archive=Some(root.display().to_string());
        let preview=preview_nse_historical_identity_archive_internal(&connection,&NseHistoricalIdentityPreviewInput{archive_root_path:archive.clone()}).unwrap();
        let before=read_i4_database_state(&connection);
        let events=std::cell::RefCell::new(Vec::new());
        let error=apply_nse_historical_identity_archive_with_progress(&connection,&NseHistoricalIdentityApplyInput{archive_root_path:archive,expected_plan_sha256:preview.plan_sha256},&|e|events.borrow_mut().push(e)).unwrap_err();
        assert!(error.contains("injected receipt failure")); assert_eq!(before,read_i4_database_state(&connection));
        assert!(events.borrow().iter().all(|e|e.stage!="committed")); assert!(connection.is_autocommit());
        assert_eq!(connection.query_row("SELECT COUNT(*) FROM historical_identity_apply_runs",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_reporting_legacy_read_is_not_a_synthetic_run() {
        let connection=create_phase5c_identity_import_connection();
        connection.execute("INSERT INTO instrument_identity_history(exchange,old_symbol,new_symbol,effective_date,change_type,source,created_at) VALUES ('NSE','OLD','NEW','2026-01-01','SYMBOL_CHANGE','NSE_IDENTITY','2026-10-29 15:57:57')",[]).unwrap();
        let before:i64=connection.query_row("SELECT total_changes()",[],|r|r.get(0)).unwrap();
        let history=historical_reporting::read_history(&connection).unwrap();
        assert!(history["runs"].as_array().unwrap().is_empty()); assert_eq!(history["legacyRows"].as_array().unwrap().len(),1);
        assert_eq!(before,connection.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap());
        assert!(!connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='historical_identity_apply_runs')",[],|r|r.get::<_,bool>(0)).unwrap());
    }

    #[test]
    fn i4_historical_reporting_zero_change_apply_rejects_without_receipt() {
        let root=create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nOLDCO,Old Company,EQ,INEOLD1\n",
            "old,new,date,company\n", "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n");
        let connection=create_phase5c_identity_import_connection(); let archive=Some(root.display().to_string());
        let preview=preview_nse_historical_identity_archive_internal(&connection,&NseHistoricalIdentityPreviewInput{archive_root_path:archive.clone()}).unwrap();
        assert!(preview.can_apply); assert!(!historical_reporting::actionable(&preview));
        let before=read_i4_database_state(&connection);
        let error=apply_nse_historical_identity_archive_internal(&connection,&NseHistoricalIdentityApplyInput{archive_root_path:archive,expected_plan_sha256:preview.plan_sha256}).unwrap_err();
        assert!(error.contains("No historical identity changes")); assert_eq!(before,read_i4_database_state(&connection));
        assert!(!connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='historical_identity_apply_runs')",[],|r|r.get::<_,bool>(0)).unwrap());
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_reporting_commit_failure_never_emits_completed() {
        let root=create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n");
        let connection=create_phase5c_identity_import_connection();
        connection.execute_batch("PRAGMA foreign_keys=ON;
            CREATE TABLE receipt_parent(id INTEGER PRIMARY KEY);
            CREATE TABLE receipt_child(id INTEGER REFERENCES receipt_parent(id) DEFERRABLE INITIALLY DEFERRED);
            CREATE TABLE historical_identity_apply_runs(run_id TEXT PRIMARY KEY,completed_at TEXT,result_json TEXT);
            CREATE TRIGGER fail_historical_commit AFTER INSERT ON historical_identity_apply_runs BEGIN INSERT INTO receipt_child VALUES(999); END;").unwrap();
        let archive=Some(root.display().to_string());
        let preview=preview_nse_historical_identity_archive_internal(&connection,&NseHistoricalIdentityPreviewInput{archive_root_path:archive.clone()}).unwrap();
        let before=read_i4_database_state(&connection); let events=std::cell::RefCell::new(Vec::new());
        let error=apply_nse_historical_identity_archive_with_progress(&connection,&NseHistoricalIdentityApplyInput{archive_root_path:archive,expected_plan_sha256:preview.plan_sha256},&|e|events.borrow_mut().push(e)).unwrap_err();
        assert!(error.contains("FOREIGN KEY")); assert_eq!(before,read_i4_database_state(&connection));
        assert!(events.borrow().iter().all(|e|e.percent.is_none_or(|p|p<100)));
        assert!(connection.is_autocommit());
        assert_eq!(connection.query_row("SELECT COUNT(*) FROM historical_identity_apply_runs",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_name_update_preserves_inactive_absent_symbol() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\nOLDCO,Old Company,Old Company Revised,2020-01-01\n");
        let connection = create_phase5c_identity_import_connection();
        connection.execute("UPDATE instruments SET is_active=0 WHERE symbol='OLDCO' AND exchange='NSE'", []).unwrap();
        connection.execute_batch("CREATE TABLE corporate_actions (
            id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, isin TEXT,
            effective_date TEXT, action_type TEXT, factor REAL, adjust_volume INTEGER,
            ratio_num REAL, ratio_den REAL, old_face_value REAL, new_face_value REAL,
            cash_amount REAL, source TEXT);").unwrap();
        let archive = Some(root.display().to_string());
        let before = read_i4_database_state(&connection);
        let preview = preview_nse_historical_identity_archive_internal(&connection,
            &NseHistoricalIdentityPreviewInput { archive_root_path: archive.clone() }).unwrap();
        assert!(preview.can_apply, "{:?}", preview.errors); assert_eq!(preview.new_name_changes, 1);
        assert_eq!(before, read_i4_database_state(&connection));
        let result = apply_nse_historical_identity_archive_internal(&connection,
            &NseHistoricalIdentityApplyInput { archive_root_path: archive, expected_plan_sha256: preview.plan_sha256 }).unwrap();
        assert!(result.applied);
        let old: (i64, String) = connection.query_row("SELECT is_active,name FROM instruments WHERE symbol='OLDCO' AND exchange='NSE'", [], |r| Ok((r.get(0)?,r.get(1)?))).unwrap();
        assert_eq!(old, (0, "Old Company Revised".to_string()));
        assert_eq!(connection.query_row("SELECT is_active FROM instruments WHERE symbol='CURR' AND exchange='NSE'", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_lifecycle_failure_rolls_back_the_accepted_identity_row() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(&root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n");
        let connection = create_phase5c_identity_import_connection();
        let archive = Some(root.display().to_string());
        let preview = preview_nse_historical_identity_archive_internal(&connection,
            &NseHistoricalIdentityPreviewInput { archive_root_path: archive.clone() }).unwrap();
        assert!(preview.can_apply);
        connection.execute_batch("CREATE TRIGGER fail_identity_lifecycle BEFORE UPDATE OF lifecycle_status ON instruments
            WHEN NEW.symbol='OLDCO' AND NEW.lifecycle_status='OLD_SYMBOL'
            BEGIN SELECT RAISE(FAIL,'injected identity lifecycle failure'); END;").unwrap();
        let before = read_i4_database_state(&connection);
        let error = apply_nse_historical_identity_archive_internal(&connection,
            &NseHistoricalIdentityApplyInput { archive_root_path: archive, expected_plan_sha256: preview.plan_sha256 }).unwrap_err();
        assert_eq!(error, NSE_HISTORICAL_PREVIEW_ERRORS);
        assert_eq!(before, read_i4_database_state(&connection));
        assert_eq!(connection.query_row("SELECT lifecycle_status FROM instruments WHERE symbol='OLDCO' AND exchange='NSE'", [], |r| r.get::<_, String>(0)).unwrap(), "CURRENT");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_later_identity_failure_rolls_back_earlier_tentative_rows() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,MIDCO,2025-01-01,Mid Company\nMIDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();
        assert!(preview.can_apply);

        connection
            .execute_batch(
                "
                  CREATE TRIGGER i4_fail_later_identity
                  BEFORE INSERT ON instrument_identity_history
                  WHEN NEW.new_symbol = 'CURR'
                  BEGIN
                    SELECT RAISE(FAIL, 'i4 injected later identity failure');
                  END;
                ",
            )
            .unwrap();
        let before = read_i4_database_state(&connection);
        let error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
        )
        .expect_err("later historical failure must reject the whole apply");
        let after = read_i4_database_state(&connection);

        assert_eq!(error, NSE_HISTORICAL_PREVIEW_ERRORS);
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_master_failure_rolls_back_history() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        connection
            .execute_batch(
                "
                  CREATE TRIGGER i4_fail_master_update
                  BEFORE UPDATE OF series ON instruments
                  WHEN NEW.symbol = 'CURR' AND NEW.exchange = 'NSE'
                  BEGIN
                    SELECT RAISE(FAIL, 'i4 injected master failure');
                  END;
                ",
            )
            .unwrap();
        let before = read_i4_database_state(&connection);
        let error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
        )
        .expect_err("master failure must roll back history");
        let after = read_i4_database_state(&connection);

        assert!(error.contains("i4 injected master failure"));
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_current_universe_failure_rolls_back_history_and_master() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        // The failure must target a supported, explicitly evidenced deactivation.
        // An unexplained absence is now held active and must not reach the trigger.
        {
            use std::io::Write;
            let mut workbook = zip::ZipWriter::new(Cursor::new(Vec::new()));
            workbook.start_file("xl/sharedStrings.xml", zip::write::FileOptions::default()).unwrap();
            workbook.write_all(b"<sst><si><t>Symbol</t></si><si><t>EXTRA</t></si></sst>").unwrap();
            workbook.start_file("xl/worksheets/sheet1.xml", zip::write::FileOptions::default()).unwrap();
            workbook.write_all(b"<worksheet><sheetData><row><c r=\"A1\" t=\"s\"><v>0</v></c></row><row><c r=\"A2\" t=\"s\"><v>1</v></c></row></sheetData></worksheet>").unwrap();
            let bytes = workbook.finish().unwrap().into_inner();
            let folder = root.join("NSE/Identity/Delisted");
            fs::create_dir_all(&folder).unwrap();
            fs::write(folder.join("nse_identity_delisted_companies.xlsx"), bytes).unwrap();
        }
        let connection = create_phase5c_identity_import_connection();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, is_active, lifecycle_status) VALUES ('EXTRA', 'NSE', 'INEEXTRA1', 'Extra Limited', 'EQ', 1, 'CURRENT')",
                [],
            )
            .unwrap();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        connection
            .execute_batch(
                "
                  CREATE TRIGGER i4_fail_current_sync
                  BEFORE UPDATE OF lifecycle_status ON instruments
                  WHEN OLD.symbol = 'EXTRA' AND OLD.exchange = 'NSE'
                  BEGIN
                    SELECT RAISE(FAIL, 'i4 injected current sync failure');
                  END;
                ",
            )
            .unwrap();
        let before = read_i4_database_state(&connection);
        let error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
        )
        .expect_err("current-universe failure must roll back all prior I4 work");
        let after = read_i4_database_state(&connection);

        assert!(error.contains("i4 injected current sync failure"));
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_source_or_database_staleness_rejects_without_persistent_apply_changes() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\nZZOLD,ZZNEW,2020-01-01,Zed Limited\n",
        )
        .unwrap();
        let before_source = read_i4_database_state(&connection);
        let source_error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256.clone(),
            },
        )
        .expect_err("changed source must reject old reviewed authority");
        let after_source = read_i4_database_state(&connection);
        assert_eq!(source_error, NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after_source, before_source);

        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
        )
        .unwrap();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, is_active, lifecycle_status) VALUES ('EXTRA', 'NSE', 'INEEXTRA1', 'Extra Limited', 'EQ', 1, 'CURRENT')",
                [],
            )
            .unwrap();
        let before_db = read_i4_database_state(&connection);
        let db_error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
        )
        .expect_err("changed database must reject old reviewed authority");
        let after_db = read_i4_database_state(&connection);
        assert_eq!(db_error, NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after_db, before_db);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_duplicate_and_skipped_rows_are_reviewable_and_do_not_block_apply() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\nZZOLD,ZZNEW,2020-01-01,Zed Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        connection
            .execute_batch(
                "
                  CREATE TABLE corporate_actions (
                    id INTEGER PRIMARY KEY,
                    symbol TEXT,
                    exchange TEXT,
                    isin TEXT,
                    effective_date TEXT,
                    action_type TEXT,
                    factor REAL,
                    adjust_volume INTEGER,
                    ratio_num REAL,
                    ratio_den REAL,
                    old_face_value REAL,
                    new_face_value REAL,
                    cash_amount REAL,
                    source TEXT
                  );
                  INSERT INTO instrument_identity_history (
                    exchange,
                    current_symbol,
                    current_name,
                    old_symbol,
                    old_name,
                    new_symbol,
                    new_name,
                    effective_date,
                    change_type,
                    source,
                    source_ref
                  )
                  VALUES (
                    'NSE',
                    'CURR',
                    'Current Limited',
                    'OLDCO',
                    'Old Company',
                    'CURR',
                    'Current Limited',
                    '2026-01-01',
                    'SYMBOL_CHANGE',
                    'NSE_IDENTITY',
                    'fixture'
                  );
                ",
            )
            .unwrap();

        let result = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        assert_eq!(result.error_rows, 0, "errors: {:?}", result.errors);
        assert!(result.can_apply);
        assert_eq!(result.duplicate_rows, 1);
        assert_eq!(result.skipped_rows, 1);
        assert!(result
            .history_rows
            .iter()
            .any(|row| row.disposition == "DUPLICATE"));
        assert!(result
            .history_rows
            .iter()
            .any(|row| row.disposition == "SKIPPED"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn i4_historical_malformed_sha_rejects_and_rolls_back_tentative_changes() {
        let root = create_temp_archive_root();
        write_i4_historical_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = create_phase5c_identity_import_connection();
        let before = read_i4_database_state(&connection);
        let error = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: "not-a-sha".to_string(),
            },
        )
        .expect_err("malformed historical SHA must reject");
        let after = read_i4_database_state(&connection);

        assert_eq!(error, NSE_HISTORICAL_REVIEWED_PLAN_STALE_ERROR);
        assert_eq!(after, before);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn identity_import_applies_current_universe_sync() {
        let root = create_temp_archive_root();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
        )
        .unwrap();

        let connection = create_phase5c_identity_import_connection();
        let preview = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();
        let result = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256,
            },
        )
        .unwrap();

        let old_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'OLDCO' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let current_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'CURR' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(result.applied);
        assert_eq!(result.active_sync_deactivate_count, 0);
        assert_eq!(old_is_active, 1);
        assert!(result.current_universe_preview_rows.iter().any(|row| row.symbol == "OLDCO" && row.action == "REVIEW_REQUIRED" && row.proposed_status == "ACTIVE"));
        assert_eq!(current_is_active, 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn phase5c_identity_error_suppresses_current_universe_sync() {
        let root = create_temp_archive_root();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INECURR1\n",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            "old,new,date,company\nOLDCO,NEWCO,2026-01-01,New Company\n",
        )
        .unwrap();

        let connection = create_phase5c_identity_import_connection();
        connection
            .execute_batch(
                "
                  CREATE TRIGGER phase5c_fail_identity_insert
                  BEFORE INSERT ON instrument_identity_history
                  BEGIN
                    SELECT RAISE(FAIL, 'phase5c injected identity failure');
                  END;
                ",
            )
            .unwrap();

        let result = preview_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityPreviewInput {
                archive_root_path: Some(root.display().to_string()),
            },
        )
        .unwrap();

        let old_is_active = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'OLDCO' AND exchange = 'NSE'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap();
        let current_master_rows = connection
            .query_row(
                "SELECT COUNT(*) FROM instruments WHERE symbol = 'CURR' AND exchange = 'NSE'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap();
        let history_rows = connection
            .query_row(
                "SELECT COUNT(*) FROM instrument_identity_history",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap();

        assert_eq!(result.error_rows, 1);
        assert!(!result.can_apply);
        assert_eq!(result.active_sync_deactivate_count, 0);
        assert_eq!(old_is_active, 1);
        assert_eq!(current_master_rows, 0);
        assert_eq!(history_rows, 0);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("phase5c injected identity failure")),
            "errors: {:?}",
            result.errors
        );

        let _ = fs::remove_dir_all(root);
    }

    fn write_i4_historical_sources(
        root: &Path,
        master: &str,
        symbol_changes: &str,
        name_changes: &str,
    ) {
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            master,
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            symbol_changes,
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges")
                .join("nse_identity_company_name_changes.csv"),
            name_changes,
        )
        .unwrap();
    }

    fn read_i4_history_state(
        connection: &Connection,
    ) -> Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
        String,
    )> {
        let mut statement = connection
            .prepare(
                "SELECT exchange, current_symbol, current_name, old_symbol, old_name, new_symbol, new_name, effective_date, change_type FROM instrument_identity_history ORDER BY id",
            )
            .unwrap();
        statement
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                ))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    fn read_i4_database_state(
        connection: &Connection,
    ) -> (
        Vec<(
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            i64,
            String,
            Option<String>,
        )>,
        Vec<(
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
            String,
        )>,
    ) {
        (
            read_i3_instrument_state(connection),
            read_i4_history_state(connection),
        )
    }

    fn write_i3_current_master(root: &Path, contents: &str) {
        let mut padded = contents.to_string();
        let current_rows = contents
            .lines()
            .skip(1)
            .filter(|line| !line.trim().is_empty())
            .count();

        for index in current_rows..NSE_CURRENT_POPULATION_SANITY_MINIMUM {
            padded.push_str(&format!(
                "F4PAD{index:04},F4 Population Pad {index:04},EQ,INEF4PAD{index:04}\n"
            ));
        }

        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            padded,
        )
        .unwrap();
    }

    fn read_i3_instrument_state(
        connection: &Connection,
    ) -> Vec<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        i64,
        String,
        Option<String>,
    )> {
        let mut statement = connection
            .prepare(
                "SELECT symbol, exchange, isin, name, series, is_active, lifecycle_status, updated_at FROM instruments ORDER BY exchange, symbol",
            )
            .unwrap();
        statement
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                ))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    fn create_phase5c_identity_import_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                  CREATE TABLE instruments (
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    isin TEXT,
                    name TEXT,
                    series TEXT,
                    sector TEXT,
                    industry TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                    updated_at TEXT,
                    PRIMARY KEY(symbol, exchange)
                  );
                  CREATE TABLE instrument_identity_history (
                    id INTEGER PRIMARY KEY,
                    exchange TEXT NOT NULL DEFAULT 'NSE',
                    isin TEXT,
                    current_symbol TEXT,
                    current_name TEXT,
                    old_symbol TEXT,
                    old_name TEXT,
                    new_symbol TEXT,
                    new_name TEXT,
                    effective_date TEXT,
                    change_type TEXT,
                    source TEXT,
                    source_ref TEXT,
                    created_at TEXT,
                    updated_at TEXT
                  );
                  INSERT INTO instruments (symbol, exchange, isin, name, series, is_active)
                  VALUES ('OLDCO', 'NSE', 'INEOLD1', 'Old Company', 'EQ', 1);
                ",
            )
            .unwrap();
        connection
    }

    static TEMP_ARCHIVE_ROOT_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn next_temp_archive_root_path() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = TEMP_ARCHIVE_ROOT_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "nse-identity-archive-{}-{timestamp}-{sequence}",
            std::process::id()
        ))
    }

    #[test]
    fn temp_archive_root_paths_are_unique_under_concurrent_creation() {
        use std::collections::HashSet;
        use std::sync::{Arc, Barrier};
        use std::thread;

        const THREADS: usize = 128;
        let barrier = Arc::new(Barrier::new(THREADS));
        let mut handles = Vec::with_capacity(THREADS);

        for _ in 0..THREADS {
            let barrier = Arc::clone(&barrier);
            handles.push(thread::spawn(move || {
                barrier.wait();
                next_temp_archive_root_path()
            }));
        }

        let roots = handles
            .into_iter()
            .map(|handle| handle.join().expect("temp-root worker must not panic"))
            .collect::<Vec<_>>();
        let unique = roots.iter().cloned().collect::<HashSet<_>>();

        assert_eq!(
            unique.len(),
            roots.len(),
            "NSE temp archive-root paths must remain unique under concurrent tests"
        );
    }

    fn create_temp_archive_root() -> PathBuf {
        let root = next_temp_archive_root_path();
        fs::create_dir_all(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable"),
        )
        .unwrap();
        fs::create_dir_all(root.join("NSE").join("Identity").join("SymbolChanges")).unwrap();
        fs::create_dir_all(root.join("NSE").join("Identity").join("CompanyNameChanges")).unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            "",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges")
                .join("nse_identity_company_name_changes.csv"),
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        )
        .unwrap();
        root
    }
}
#[cfg(test)]
mod f2_r2_official_historical_consumption_tests {
    use super::*;

    #[test]
    fn f2_r2_official_historical_uses_managed_root_when_archive_path_is_absent() {
        let managed_root = PathBuf::from("E:\\ActiveDb\\reference-data");
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: None,
        };

        let resolved =
            resolve_nse_historical_identity_archive_root(&input, Some(&managed_root))
                .expect("official historical preview/apply should use the managed root");

        assert_eq!(resolved, managed_root);
    }

    #[test]
    fn f2_r2_manual_historical_archive_root_overrides_managed_root() {
        let managed_root = PathBuf::from("E:\\ActiveDb\\reference-data");
        let manual_root = PathBuf::from("manual-nse-identity-archive");
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(manual_root.display().to_string()),
        };

        let resolved =
            resolve_nse_historical_identity_archive_root(&input, Some(&managed_root))
                .expect("manual historical archive root should remain authoritative");

        assert_eq!(resolved, manual_root);
    }
}

#[cfg(test)]
mod f4_population_sanity_tests {
    use super::*;

    #[test]
    fn f4_population_sanity_nse_rejects_999_current_symbols() {
        let error = validate_nse_current_population_sanity(999)
            .expect_err("NSE current population below 1000 must fail closed");
        assert!(
            error.contains("SOURCE_POPULATION_SANITY_REJECTED"),
            "NSE rejection must be explicit: {error}"
        );
    }

    #[test]
    fn f4_population_sanity_nse_accepts_1000_current_symbols() {
        assert!(
            validate_nse_current_population_sanity(1000).is_ok(),
            "NSE current population of 1000 must satisfy the F4-R1 floor"
        );
    }
}

#[cfg(test)]
mod f2_official_namechange_acquisition_tests {
    use super::*;

    #[test]
    fn f2_official_namechange_download_validation_accepts_provider_native_csv() {
        let bytes = b"NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n\
EXAMPLE,Example Industries Limited,Example Limited,01-Jan-2026\n";

        let rows_read = validate_nse_company_name_change_download(
            bytes,
            "https://nsearchives.nseindia.com/content/equities/namechange.csv",
        )
        .expect("provider-native NSE namechange.csv must validate");

        assert_eq!(rows_read, 1);
    }

    #[test]
    fn f2_official_namechange_download_validation_rejects_malformed_csv() {
        let bytes = b"NCH_SYMBOL,NCH_PREV_NAME,NCH_DT\n\
EXAMPLE,Example Industries Limited,01-Jan-2026\n";

        let error = validate_nse_company_name_change_download(
            bytes,
            "https://nsearchives.nseindia.com/content/equities/namechange.csv",
        )
        .expect_err("missing NCH_NEW_NAME must fail before source write");

        assert!(
            error.contains("Missing new company name"),
            "validation must reuse existing I4 name-change parser semantics: {error}"
        );
    }

    #[test]
    fn f2_download_result_exposes_company_name_change_accounting() {
        fn fields(
            result: &NseCurrentUniverseMasterDownloadResult,
        ) -> (&str, u32) {
            (
                result.company_name_change_file_path.as_str(),
                result.company_name_change_rows_read,
            )
        }

        let _ = fields;
    }
}


#[cfg(test)]
mod er2c1_shadow_tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static ER2C1_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn er2c1_test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                  CREATE TABLE instruments (
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    isin TEXT,
                    name TEXT,
                    series TEXT,
                    sector TEXT,
                    industry TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                    updated_at TEXT,
                    PRIMARY KEY(symbol, exchange)
                  );
                  CREATE TABLE instrument_identity_history (
                    id INTEGER PRIMARY KEY,
                    exchange TEXT NOT NULL DEFAULT 'NSE',
                    isin TEXT,
                    current_symbol TEXT,
                    current_name TEXT,
                    old_symbol TEXT,
                    old_name TEXT,
                    new_symbol TEXT,
                    new_name TEXT,
                    effective_date TEXT,
                    change_type TEXT,
                    source TEXT,
                    source_ref TEXT,
                    created_at TEXT,
                    updated_at TEXT
                  );
                ",
            )
            .unwrap();
        connection
    }

    fn er2c1_temp_archive_root() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = ER2C1_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "nse-er2c1-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable"),
        )
        .unwrap();
        fs::create_dir_all(root.join("NSE").join("Identity").join("SymbolChanges"))
            .unwrap();
        fs::create_dir_all(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges"),
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            "",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges")
                .join("nse_identity_company_name_changes.csv"),
            "",
        )
        .unwrap();
        root
    }

    fn er2c1_write_current_master(root: &Path, contents: &str) {
        let mut padded = contents.to_string();
        let current_rows = contents
            .lines()
            .skip(1)
            .filter(|line| !line.trim().is_empty())
            .count();
        for index in current_rows..NSE_CURRENT_POPULATION_SANITY_MINIMUM {
            padded.push_str(&format!(
                "F4PAD{index:04},F4 Population Pad {index:04},EQ,INEF4PAD{index:04}\n"
            ));
        }
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            padded,
        )
        .unwrap();
    }

    fn er2c1_test_current(
        symbol: &str,
        company_name: &str,
        series: &str,
        isin: &str,
    ) -> NseI3Er2CurrentMasterRow {
        let row = NseSecurityMasterRow {
            symbol: symbol.to_string(),
            company_name: Some(company_name.to_string()),
            isin: Some(isin.to_string()),
            series: Some(series.to_string()),
        };
        NseI3Er2CurrentMasterRow {
            source_reference: er2c1_current_master_reference(
                ER2C1_NSE_EQUITY_MASTER_REFERENCE,
                &row,
            ),
            row,
            source_id: ER2C1_NSE_EQUITY_MASTER,
            content_sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                .to_string(),
        }
    }

    fn er2c1_test_existing(
        symbol: &str,
        company_name: &str,
        series: &str,
        isin: &str,
        is_active: bool,
    ) -> ExistingNseInstrumentRow {
        ExistingNseInstrumentRow {
            symbol: symbol.to_string(),
            isin: Some(isin.to_string()),
            name: Some(company_name.to_string()),
            series: Some(series.to_string()),
            is_active,
        }
    }

    fn er2c1_test_preview(
        action: &str,
        symbol: &str,
        matched_symbol: Option<&str>,
    ) -> NseCurrentUniverseSyncPreviewRow {
        NseCurrentUniverseSyncPreviewRow {
            action: action.to_string(),
            symbol: symbol.to_string(),
            company_name: None,
            series: None,
            isin: None,
            current_status: "TEST".to_string(),
            proposed_status: "TEST".to_string(),
            matched_symbol: matched_symbol.map(str::to_string),
            reason: "ER2-C1 fixture".to_string(),
        }
    }

    fn er2c1_test_snapshot(
        observed_at_ist: &str,
        current_rows: Vec<NseI3Er2CurrentMasterRow>,
    ) -> NseI3Er2ShadowSourceSnapshot {
        NseI3Er2ShadowSourceSnapshot {
            observed_at_ist: observed_at_ist.to_string(),
            current_rows,
            symbol_change_rows: Vec::new(),
            symbol_changes_sha256: None,
            name_change_rows: Vec::new(),
            name_changes_sha256: None,
        }
    }

    fn er2c1_test_input(
        local: ExistingNseInstrumentRow,
        current_rows: Vec<NseI3Er2CurrentMasterRow>,
        action: &str,
        matched_symbol: Option<&str>,
        symbol_changes: Vec<NseSymbolChangeRow>,
        name_changes: Vec<NseNameChangeRow>,
    ) -> IdentityResolverInput {
        let symbol = current_rows[0].row.symbol.clone();
        let mut snapshot = er2c1_test_snapshot(
            "2026-09-12T18:30:00+05:30",
            current_rows,
        );
        if !symbol_changes.is_empty() {
            snapshot.symbol_change_rows = symbol_changes;
            snapshot.symbol_changes_sha256 = Some(
                "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
                    .to_string(),
            );
        }
        if !name_changes.is_empty() {
            snapshot.name_change_rows = name_changes;
            snapshot.name_changes_sha256 = Some(
                "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
                    .to_string(),
            );
        }
        let indexes = build_nse_i3_er2_shadow_indexes_from_rows(vec![local], &snapshot);
        build_nse_i3_er2_input(
            &er2c1_test_preview(action, &symbol, matched_symbol),
            &indexes,
        )
        .expect("fixture must build a resolver input")
    }

    #[test]
    fn er2c1_t0_no_mismatch_is_not_classified_as_resolver_error() {
        let state = classify_nse_i3_er2_resolver_outcome(Err(
            IdentityResolverEvaluationError::NoMismatchToResolve,
        ));
        assert_eq!(state, NseI3Er2ShadowState::NoMaterialResolverMismatch);
        assert_eq!(
            nse_i3_er2_shadow_relationship(&state),
            NseI3Er2ShadowRelationship::NoMaterialResolverMismatch
        );
    }

    #[test]
    fn er2c1_t0_relationship_taxonomy_reconciles_summary_counts() {
        let current = er2c1_test_current("ABC", "ABC Limited", "EQ", "INE000A01001");
        let current_evidence = build_nse_i3_er2_current_master_evidence(
            &current,
            "2026-09-12T18:30:00+05:30",
        );
        let input = IdentityResolverInput {
            local_identity: IdentityResolverLocalIdentity {
                exchange: "NSE".to_string(),
                symbol: "ABC".to_string(),
                series: Some("EQ".to_string()),
                isin: Some("INEOLD01001".to_string()),
                company_name: Some("ABC Limited".to_string()),
                lifecycle_state: Some("ACTIVE".to_string()),
                effective_from: None,
                effective_to: None,
            },
            official_identity: Some(build_nse_i3_er2_official_identity(
                &current,
                &current_evidence.evidence_id,
            )),
            evidence: vec![current_evidence],
            required_source_health: IdentityResolverSourceAvailability::Available,
        };
        let conflict = classify_nse_i3_er2_resolver_outcome(resolve_identity(&input));
        let rows = vec![
            nse_i3_er2_shadow_evaluation_from_state(
                &er2c1_test_preview("UPDATE", "ABC", Some("ABC")),
                conflict,
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &er2c1_test_preview("INSERT", "NEW", None),
                NseI3Er2ShadowState::NotEvaluated(NseI3Er2ShadowReason::NoLocalIdentity),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &er2c1_test_preview("UPDATE", "SAME", Some("SAME")),
                NseI3Er2ShadowState::NoMaterialResolverMismatch,
            ),
        ];
        let summary = summarize_nse_i3_er2_shadow(&rows);
        assert_eq!(summary.legacy_preview_rows, 3);
        assert_eq!(summary.eligible_rows + summary.not_evaluated_rows, 3);
        assert_eq!(summary.resolver_conflicts, 1);
        assert_eq!(summary.not_evaluated_rows, 1);
        assert_eq!(summary.no_material_mismatch, 1);
    }

    #[test]
    fn er2c1_t1_manual_archive_override_is_shadow_not_evaluated() {
        let plan = plan_nse_current_universe_sync_from_rows(
            r"E:\manual".to_string(),
            1,
            vec![NseSecurityMasterRow {
                symbol: "ABC".to_string(),
                company_name: Some("ABC Limited".to_string()),
                isin: Some("INE000A01001".to_string()),
                series: Some("EQ".to_string()),
            }],
            vec![er2c1_test_existing(
                "ABC",
                "Old ABC Limited",
                "EQ",
                "INE000A01001",
                true,
            )],
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );
        let connection = er2c1_test_connection();
        let input = NseCurrentUniverseSyncInput {
            archive_root_path: Some(r"E:\manual".to_string()),
        };
        let evaluations = evaluate_nse_i3_er2_shadow(&connection, &input, &plan);
        assert!(!evaluations.is_empty());
        assert!(evaluations.iter().all(|evaluation| {
            evaluation.state
                == NseI3Er2ShadowState::NotEvaluated(
                    NseI3Er2ShadowReason::NonManagedSourceProvenance,
                )
        }));
    }

    #[test]
    fn er2c1_t1_snapshot_preserves_equity_precedence_and_provenance() {
        let root = er2c1_temp_archive_root();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nDUP,Equity Owner,EQ,INE000A01001\n",
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_sme.csv"),
            "SYMBOL,NAME_OF_COMPANY,SERIES,ISIN_NUMBER\nDUP,SME Shadow,SM,INE000A01002\nSMEONLY,SME Only,SM,INE000A01003\n",
        )
        .unwrap();
        let snapshot = capture_nse_i3_er2_shadow_source_snapshot(&root).unwrap();
        let dup = snapshot
            .current_rows
            .iter()
            .find(|row| row.row.symbol == "DUP")
            .unwrap();
        assert_eq!(dup.source_id, ER2C1_NSE_EQUITY_MASTER);
        assert_eq!(dup.row.company_name.as_deref(), Some("Equity Owner"));
        let sme = snapshot
            .current_rows
            .iter()
            .find(|row| row.row.symbol == "SMEONLY")
            .unwrap();
        assert_eq!(sme.source_id, ER2C1_NSE_SME_MASTER);
        assert!(!dup.content_sha256.is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn er2c1_t3_local_mapping_preserves_fields_without_invented_dates() {
        let local = er2c1_test_existing(
            "ABC",
            "ABC Limited",
            "BE",
            "INE000A01001",
            false,
        );
        let mapped = build_nse_i3_er2_local_identity(&local);
        assert_eq!(mapped.exchange, "NSE");
        assert_eq!(mapped.symbol, "ABC");
        assert_eq!(mapped.series.as_deref(), Some("BE"));
        assert_eq!(mapped.isin.as_deref(), Some("INE000A01001"));
        assert_eq!(mapped.company_name.as_deref(), Some("ABC Limited"));
        assert_eq!(mapped.lifecycle_state.as_deref(), Some("INACTIVE"));
        assert_eq!(mapped.effective_from, None);
        assert_eq!(mapped.effective_to, None);
    }

    #[test]
    fn er2c1_t3_current_evidence_id_ignores_observation_time() {
        let current = er2c1_test_current("ABC", "ABC Limited", "EQ", "INE000A01001");
        let a = build_nse_i3_er2_current_master_evidence(
            &current,
            "2026-09-12T18:30:00+05:30",
        );
        let b = build_nse_i3_er2_current_master_evidence(
            &current,
            "2026-09-12T19:30:00+05:30",
        );
        assert_eq!(a.evidence_id, b.evidence_id);
        assert_ne!(a.retrieved_at_ist, b.retrieved_at_ist);
        assert_eq!(a.source_id, ER2C1_NSE_EQUITY_MASTER);
        assert_eq!(a.evidence_kind, IdentityResolverEvidenceKind::CurrentMaster);
    }

    #[test]
    fn er2c1_t3_eligibility_matrix_is_closed() {
        let current = er2c1_test_current("ABC", "ABC Limited", "EQ", "INE000A01001");
        let snapshot = er2c1_test_snapshot(
            "2026-09-12T18:30:00+05:30",
            vec![current],
        );
        let indexes = build_nse_i3_er2_shadow_indexes_from_rows(
            vec![er2c1_test_existing(
                "ABC",
                "Old ABC Limited",
                "EQ",
                "INE000A01001",
                true,
            )],
            &snapshot,
        );
        assert!(build_nse_i3_er2_input(
            &er2c1_test_preview("UPDATE", "ABC", Some("ABC")),
            &indexes,
        )
        .is_ok());
        assert!(build_nse_i3_er2_input(
            &er2c1_test_preview("REACTIVATE", "ABC", Some("ABC")),
            &indexes,
        )
        .is_ok());
        assert!(build_nse_i3_er2_input(
            &er2c1_test_preview("INSERT", "ABC", Some("ABC")),
            &indexes,
        )
        .is_ok());
        assert_eq!(
            build_nse_i3_er2_input(
                &er2c1_test_preview("INSERT", "ABC", None),
                &indexes,
            )
            .unwrap_err(),
            NseI3Er2ShadowState::NotEvaluated(NseI3Er2ShadowReason::NoLocalIdentity),
        );
        for action in ["OLD_SYMBOL", "DELISTED", "UNKNOWN_INACTIVE"] {
            assert_eq!(
                build_nse_i3_er2_input(
                    &er2c1_test_preview(action, "ABC", None),
                    &indexes,
                )
                .unwrap_err(),
                NseI3Er2ShadowState::NotEvaluated(
                    NseI3Er2ShadowReason::NoOfficialCurrentIdentity,
                ),
            );
        }
    }

    #[test]
    fn er2c1_t4_symbol_change_does_not_borrow_current_master_isin() {
        let evidence = build_nse_i3_er2_symbol_change_evidence(
            &NseSymbolChangeRow {
                company_name: Some("ABC Limited".to_string()),
                old_symbol: "OLDABC".to_string(),
                new_symbol: "NEWABC".to_string(),
                effective_date: "2026-01-15".to_string(),
            },
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            "2026-09-12T18:30:00+05:30",
        );
        assert_eq!(evidence.evidence_kind, IdentityResolverEvidenceKind::SymbolChange);
        assert_eq!(evidence.isin, None);
        assert_eq!(evidence.series, None);

        let input = er2c1_test_input(
            er2c1_test_existing(
                "OLDABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
                true,
            ),
            vec![er2c1_test_current(
                "NEWABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
            )],
            "INSERT",
            Some("OLDABC"),
            vec![NseSymbolChangeRow {
                company_name: Some("ABC Limited".to_string()),
                old_symbol: "OLDABC".to_string(),
                new_symbol: "NEWABC".to_string(),
                effective_date: "2026-01-15".to_string(),
            }],
            Vec::new(),
        );
        let result = resolve_identity(&input).expect("missing ISIN history should return Rule I");
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
    }

    #[test]
    fn er2c1_t5_name_change_does_not_borrow_current_master_isin() {
        let evidence = build_nse_i3_er2_name_change_evidence(
            &NseNameChangeRow {
                symbol: "ABC".to_string(),
                old_name: "Old ABC Limited".to_string(),
                new_name: "ABC Limited".to_string(),
                effective_date: "2026-01-15".to_string(),
            },
            "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
            "2026-09-12T18:30:00+05:30",
        );
        assert_eq!(evidence.evidence_kind, IdentityResolverEvidenceKind::NameChange);
        assert_eq!(evidence.isin, None);
        assert_eq!(evidence.series, None);

        let input = er2c1_test_input(
            er2c1_test_existing(
                "ABC",
                "Old ABC Limited",
                "EQ",
                "INE000A01001",
                true,
            ),
            vec![er2c1_test_current(
                "ABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
            )],
            "UPDATE",
            Some("ABC"),
            Vec::new(),
            vec![NseNameChangeRow {
                symbol: "ABC".to_string(),
                old_name: "Old ABC Limited".to_string(),
                new_name: "ABC Limited".to_string(),
                effective_date: "2026-01-15".to_string(),
            }],
        );
        let result = resolve_identity(&input).expect("missing ISIN history should return Rule I");
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
        assert!(input.evidence.iter().all(|item| matches!(
            item.evidence_kind,
            IdentityResolverEvidenceKind::CurrentMaster
                | IdentityResolverEvidenceKind::SymbolChange
                | IdentityResolverEvidenceKind::NameChange
        )));
    }

    #[test]
    fn er2c1_t6_same_isin_current_peers_enable_rule_e_conflict() {
        let local = er2c1_test_existing(
            "ABC",
            "ABC Limited",
            "EQ",
            "INE000A01001",
            true,
        );
        let rows = vec![
            er2c1_test_current("ABC", "ABC Updated Limited", "EQ", "INE000A01001"),
            er2c1_test_current("XYZ", "XYZ Limited", "EQ", "INE000A01001"),
        ];
        let input = er2c1_test_input(local, rows, "UPDATE", Some("ABC"), Vec::new(), Vec::new());
        let result = resolve_identity(&input).expect("duplicate ISIN should return conflict");
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
        );
    }

    #[test]
    fn er2c1_t7_rule_d_conflict_is_characterized_without_changing_legacy_action() {
        let input = er2c1_test_input(
            er2c1_test_existing(
                "ABC",
                "ABC Limited",
                "EQ",
                "INEOLD01001",
                true,
            ),
            vec![er2c1_test_current(
                "ABC",
                "ABC Limited",
                "EQ",
                "INENEW01001",
            )],
            "UPDATE",
            Some("ABC"),
            Vec::new(),
            Vec::new(),
        );
        let state = classify_nse_i3_er2_resolver_outcome(resolve_identity(&input));
        let NseI3Er2ShadowState::Evaluated(result) = &state else {
            panic!("fixture must produce evaluated conflict: {state:?}");
        };
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        );
        assert_eq!(
            nse_i3_er2_shadow_relationship(&state),
            NseI3Er2ShadowRelationship::ResolverConflict,
        );
    }

    #[test]
    fn er2c1_t8_rule_h_without_series_evidence_remains_rule_i() {
        let input = er2c1_test_input(
            er2c1_test_existing(
                "ABC",
                "ABC Limited",
                "BE",
                "INE000A01001",
                true,
            ),
            vec![er2c1_test_current(
                "ABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
            )],
            "UPDATE",
            Some("ABC"),
            Vec::new(),
            Vec::new(),
        );
        let result = resolve_identity(&input).expect("missing series evidence should return Rule I");
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
        assert_ne!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
        );
    }

    #[test]
    fn er2c1_t8_reactivation_gap_remains_rule_i() {
        let input = er2c1_test_input(
            er2c1_test_existing(
                "ABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
                false,
            ),
            vec![er2c1_test_current(
                "ABC",
                "ABC Limited",
                "EQ",
                "INE000A01001",
            )],
            "REACTIVATE",
            Some("ABC"),
            Vec::new(),
            Vec::new(),
        );
        let result = resolve_identity(&input).expect("reactivation gap should return Rule I");
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
    }

    #[test]
    fn er2c1_t8_normalization_only_difference_is_no_material_mismatch() {
        let input = er2c1_test_input(
            er2c1_test_existing(
                "ABC",
                "ABC    Limited",
                "EQ",
                "INE000A01001",
                true,
            ),
            vec![er2c1_test_current(
                "ABC",
                " abc limited ",
                "EQ",
                "INE000A01001",
            )],
            "UPDATE",
            Some("ABC"),
            Vec::new(),
            Vec::new(),
        );
        let state = classify_nse_i3_er2_resolver_outcome(resolve_identity(&input));
        assert_eq!(state, NseI3Er2ShadowState::NoMaterialResolverMismatch);
        assert_eq!(
            nse_i3_er2_shadow_relationship(&state),
            NseI3Er2ShadowRelationship::NoMaterialResolverMismatch,
        );
    }

    #[test]
    fn er2c1_t9_source_race_is_detected_before_resolver_evaluation() {
        let root = er2c1_temp_archive_root();
        er2c1_write_current_master(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nABC,ABC Limited,EQ,INE000A01001\n",
        );
        let (equity_path, sme_path) = resolve_current_universe_master_paths(&root).unwrap();
        let (master_rows_read, rows_a) =
            load_current_universe_master_rows(&equity_path, sme_path.as_deref()).unwrap();
        let plan = plan_nse_current_universe_sync_from_rows(
            root.display().to_string(),
            master_rows_read,
            rows_a,
            Vec::new(),
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );
        er2c1_write_current_master(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nABC,ABC Changed Limited,EQ,INE000A01001\n",
        );
        let snapshot = capture_nse_i3_er2_shadow_source_snapshot(&root).unwrap();
        assert!(!er2c1_shadow_snapshot_matches_plan(&snapshot, &plan));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn er2c1_t9_evidence_order_and_observation_time_do_not_change_resolver_semantics() {
        let local = er2c1_test_existing(
            "ABC",
            "ABC Limited",
            "EQ",
            "INEOLD01001",
            true,
        );
        let current_a = er2c1_test_current("ABC", "ABC Limited", "EQ", "INENEW01001");
        let peer_a = er2c1_test_current("XYZ", "XYZ Limited", "EQ", "INENEW01001");
        let mut snapshot_a = er2c1_test_snapshot(
            "2026-09-12T18:30:00+05:30",
            vec![current_a.clone(), peer_a.clone()],
        );
        let mut snapshot_b = er2c1_test_snapshot(
            "2026-09-12T20:30:00+05:30",
            vec![peer_a, current_a],
        );
        snapshot_a.current_rows.sort_by(|left, right| left.row.symbol.cmp(&right.row.symbol));
        snapshot_b.current_rows.sort_by(|left, right| left.row.symbol.cmp(&right.row.symbol));
        let indexes_a = build_nse_i3_er2_shadow_indexes_from_rows(vec![local.clone()], &snapshot_a);
        let indexes_b = build_nse_i3_er2_shadow_indexes_from_rows(vec![local], &snapshot_b);
        let preview = er2c1_test_preview("UPDATE", "ABC", Some("ABC"));
        let input_a = build_nse_i3_er2_input(&preview, &indexes_a).unwrap();
        let input_b = build_nse_i3_er2_input(&preview, &indexes_b).unwrap();
        let result_a = resolve_identity(&input_a).unwrap();
        let result_b = resolve_identity(&input_b).unwrap();
        assert_eq!(result_a.status, result_b.status);
        assert_eq!(result_a.conclusion, result_b.conclusion);
        assert_eq!(result_a.rule_id, result_b.rule_id);
        assert_eq!(result_a.evidence_ids, result_b.evidence_ids);
    }

    #[test]
    fn er2c1_t10_preview_executes_shadow_once_and_keeps_public_result_identical() {
        let root = er2c1_temp_archive_root();
        er2c1_write_current_master(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nABC,ABC Limited,EQ,INENEW01001\n",
        );
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges")
                .join("nse_identity_company_name_changes.csv"),
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        )
        .unwrap();
        let connection = er2c1_test_connection();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, is_active, lifecycle_status) VALUES ('ABC', 'NSE', 'INEOLD01001', 'ABC Limited', 'EQ', 1, 'CURRENT')",
                [],
            )
            .unwrap();
        let input = NseCurrentUniverseSyncInput {
            archive_root_path: None,
        };
        let legacy_plan = build_nse_current_universe_sync_plan(
            &connection,
            &input,
            Some(&root),
        )
        .unwrap();
        let legacy_sha = nse_current_universe_plan_sha256(&legacy_plan);
        let expected = plan_into_result(legacy_plan, false, legacy_sha);

        er2c1_shadow_test_reset_call_count();
        let actual = preview_nse_current_universe_sync_internal(
            &connection,
            &input,
            Some(&root),
        )
        .unwrap();
        assert_eq!(er2c1_shadow_test_call_count(), 1);
        assert_eq!(
            serde_json::to_value(actual).unwrap(),
            serde_json::to_value(expected).unwrap(),
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn er2c1_t11_shadow_adapter_error_is_private_and_non_throwing() {
        let plan = plan_nse_current_universe_sync_from_rows(
            r"E:\definitely-missing-er2c1-root".to_string(),
            1,
            vec![NseSecurityMasterRow {
                symbol: "ABC".to_string(),
                company_name: Some("ABC Limited".to_string()),
                isin: Some("INE000A01001".to_string()),
                series: Some("EQ".to_string()),
            }],
            vec![er2c1_test_existing(
                "ABC",
                "Old ABC Limited",
                "EQ",
                "INE000A01001",
                true,
            )],
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );
        let connection = er2c1_test_connection();
        let input = NseCurrentUniverseSyncInput {
            archive_root_path: None,
        };
        let evaluations = evaluate_nse_i3_er2_shadow(&connection, &input, &plan);
        assert!(!evaluations.is_empty());
        assert!(evaluations.iter().all(|evaluation| {
            evaluation.relationship == NseI3Er2ShadowRelationship::AdapterError
        }));
    }

    #[test]
    fn er2c1_t11_fixture_characterization_summary_is_aggregate_only() {
        let preview = er2c1_test_preview("UPDATE", "FIXTURE", Some("FIXTURE"));
        let current = er2c1_test_current("FIXTURE", "Fixture Limited", "EQ", "INE000A01001");
        let current_evidence = build_nse_i3_er2_current_master_evidence(
            &current,
            "2026-09-12T18:30:00+05:30",
        );
        let conflict_result = IdentityResolverResult {
            status: IdentityResolverStatus::Conflict,
            conclusion: super::super::identity_evidence_resolver::IdentityResolverConclusion::ConflictingIdentity,
            rule_id: IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            confidence_class: super::super::identity_evidence_resolver::IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: vec![current_evidence.evidence_id],
            explanation: "Fixture conflict".to_string(),
        };
        let needs_result = IdentityResolverResult {
            status: IdentityResolverStatus::InsufficientEvidence,
            conclusion: super::super::identity_evidence_resolver::IdentityResolverConclusion::NoConclusion,
            rule_id: IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
            confidence_class: super::super::identity_evidence_resolver::IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: Vec::new(),
            explanation: "Fixture evidence gap".to_string(),
        };
        let evaluations = vec![
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::Evaluated(conflict_result.clone()),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::Evaluated(conflict_result),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::Evaluated(needs_result.clone()),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::Evaluated(needs_result),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::NoMaterialResolverMismatch,
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::NotEvaluated(NseI3Er2ShadowReason::NoLocalIdentity),
            ),
            nse_i3_er2_shadow_evaluation_from_state(
                &preview,
                NseI3Er2ShadowState::AdapterError("fixture-only".to_string()),
            ),
        ];
        let summary = summarize_nse_i3_er2_shadow(&evaluations);
        assert_eq!(summary.legacy_preview_rows, 7);
        assert_eq!(summary.resolver_conflicts, 2);
        assert_eq!(summary.needs_more_evidence, 2);
        assert_eq!(summary.no_material_mismatch, 1);
        assert_eq!(summary.not_evaluated_rows, 1);
        assert_eq!(summary.adapter_errors, 1);
        println!(
            "ER2C1_SHADOW_CHARACTERIZATION_JSON={}",
            serde_json::json!({
                "fixtureOnly": true,
                "legacyPreviewRows": summary.legacy_preview_rows,
                "eligibleRows": summary.eligible_rows,
                "evaluatedRows": summary.evaluated_rows,
                "notEvaluatedRows": summary.not_evaluated_rows,
                "continuitySupported": summary.continuity_supported,
                "resolverConflicts": summary.resolver_conflicts,
                "needsMoreEvidence": summary.needs_more_evidence,
                "noMaterialMismatch": summary.no_material_mismatch,
                "sourceUnavailable": summary.source_unavailable,
                "resolverErrors": summary.resolver_errors,
                "adapterErrors": summary.adapter_errors
            })
        );
    }
}

#[cfg(test)]
mod er2c2_shadow_tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static ER2C2_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn er2c2_temp_root() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = ER2C2_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "er2c2-nse-i4-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable"),
        )
        .unwrap();
        fs::create_dir_all(root.join("NSE").join("Identity").join("SymbolChanges")).unwrap();
        fs::create_dir_all(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges"),
        )
        .unwrap();
        root
    }

    fn er2c2_write_sources(root: &Path, master: &str, symbol_changes: &str, name_changes: &str) {
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SecuritiesAvailable")
                .join("nse_identity_securities_available_equity.csv"),
            master,
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("SymbolChanges")
                .join("nse_identity_symbol_changes.csv"),
            symbol_changes,
        )
        .unwrap();
        fs::write(
            root.join("NSE")
                .join("Identity")
                .join("CompanyNameChanges")
                .join("nse_identity_company_name_changes.csv"),
            name_changes,
        )
        .unwrap();
    }

    fn er2c2_test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                  CREATE TABLE instruments (
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    isin TEXT,
                    name TEXT,
                    series TEXT,
                    sector TEXT,
                    industry TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
                    updated_at TEXT,
                    PRIMARY KEY(symbol, exchange)
                  );
                  CREATE TABLE instrument_identity_history (
                    id INTEGER PRIMARY KEY,
                    exchange TEXT NOT NULL DEFAULT 'NSE',
                    isin TEXT,
                    current_symbol TEXT,
                    current_name TEXT,
                    old_symbol TEXT,
                    old_name TEXT,
                    new_symbol TEXT,
                    new_name TEXT,
                    effective_date TEXT,
                    change_type TEXT,
                    source TEXT,
                    source_ref TEXT,
                    created_at TEXT,
                    updated_at TEXT
                  );
                ",
            )
            .unwrap();
        connection
    }

    fn er2c2_insert_local(
        connection: &Connection,
        symbol: &str,
        name: &str,
        series: &str,
        isin: &str,
        active: bool,
    ) {
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, series, is_active, lifecycle_status) VALUES (?, 'NSE', ?, ?, ?, ?, ?)",
                params![
                    symbol,
                    isin,
                    name,
                    series,
                    if active { 1_i64 } else { 0_i64 },
                    if active { "CURRENT" } else { "INACTIVE" },
                ],
            )
            .unwrap();
    }

    fn er2c2_existing(
        symbol: &str,
        name: &str,
        series: &str,
        isin: &str,
        active: bool,
    ) -> ExistingNseInstrumentRow {
        ExistingNseInstrumentRow {
            symbol: symbol.to_string(),
            isin: Some(isin.to_string()),
            name: Some(name.to_string()),
            series: Some(series.to_string()),
            is_active: active,
        }
    }

    fn er2c2_master(symbol: &str, name: &str, series: &str, isin: &str) -> NseSecurityMasterRow {
        NseSecurityMasterRow {
            symbol: symbol.to_string(),
            company_name: Some(name.to_string()),
            isin: Some(isin.to_string()),
            series: Some(series.to_string()),
        }
    }

    fn er2c2_symbol_change(old_symbol: &str, new_symbol: &str, date: &str) -> NseSymbolChangeRow {
        NseSymbolChangeRow {
            company_name: Some("New Limited".to_string()),
            old_symbol: old_symbol.to_string(),
            new_symbol: new_symbol.to_string(),
            effective_date: date.to_string(),
        }
    }

    fn er2c2_name_change(symbol: &str, old_name: &str, new_name: &str, date: &str) -> NseNameChangeRow {
        NseNameChangeRow {
            symbol: symbol.to_string(),
            old_name: old_name.to_string(),
            new_name: new_name.to_string(),
            effective_date: date.to_string(),
        }
    }

    fn er2c2_snapshot(
        archive_root: &str,
        master_rows: Vec<NseSecurityMasterRow>,
        current_universe_rows: Vec<NseSecurityMasterRow>,
        symbol_change_rows: Vec<NseSymbolChangeRow>,
        name_change_rows: Vec<NseNameChangeRow>,
    ) -> NseHistoricalIdentitySourceSnapshot {
        NseHistoricalIdentitySourceSnapshot {
            archive_root_path: archive_root.to_string(),
            symbol_changes_path: format!("{archive_root}/symbol.csv"),
            company_name_changes_path: format!("{archive_root}/name.csv"),
            securities_available_sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
            symbol_changes_sha256: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB".to_string(),
            company_name_changes_sha256: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC".to_string(),
            current_universe_master_rows_read: current_universe_rows.len() as u32,
            master_rows,
            current_universe_rows,
            symbol_change_rows,
            name_change_rows,
        }
    }

    fn er2c2_history_row(
        disposition: &str,
        change_type: &str,
        old_symbol: Option<&str>,
        new_symbol: Option<&str>,
        current_symbol: Option<&str>,
        old_name: Option<&str>,
        new_name: Option<&str>,
        date: &str,
    ) -> NseHistoricalIdentityPreviewRow {
        NseHistoricalIdentityPreviewRow {
            disposition: disposition.to_string(),
            change_type: change_type.to_string(),
            effective_date: Some(date.to_string()),
            old_symbol: old_symbol.map(str::to_string),
            new_symbol: new_symbol.map(str::to_string),
            current_symbol: current_symbol.map(str::to_string),
            old_name: old_name.map(str::to_string),
            new_name: new_name.map(str::to_string),
            source_file: "fixture".to_string(),
            detail: "ER2-C2 fixture".to_string(),
        }
    }

    fn er2c2_indexes(
        existing: Vec<ExistingNseInstrumentRow>,
        snapshot: &NseHistoricalIdentitySourceSnapshot,
        observed_at_ist: &str,
    ) -> NseI4Er2ShadowIndexes {
        build_nse_i4_er2_shadow_indexes_from_rows(
            existing,
            snapshot,
            observed_at_ist.to_string(),
        )
    }

    fn er2c2_legacy_preview_without_shadow(
        connection: &Connection,
        input: &NseHistoricalIdentityPreviewInput,
    ) -> AppResult<NseHistoricalIdentityResult> {
        let snapshot = load_nse_historical_identity_source_snapshot(input)?;
        connection
            .execute_batch("BEGIN IMMEDIATE TRANSACTION")
            .map_err(|error| error.to_string())?;
        let execution = execute_nse_historical_identity_plan(connection, &snapshot);
        match execution {
            Ok(mut result) => {
                connection
                    .execute_batch("ROLLBACK")
                    .map_err(|error| error.to_string())?;
                result.applied = false;
                Ok(result)
            }
            Err(error) => {
                rollback_nse_historical_identity_transaction(connection);
                Err(error)
            }
        }
    }

    #[test]
    fn er2c2_t0_no_mismatch_and_relationship_taxonomy_are_private_and_deterministic() {
        let local = er2c2_existing("ABC", "ABC Limited", "EQ", "INE000A01001", true);
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("ABC", "ABC Limited", "EQ", "INE000A01001")],
            Vec::new(),
            Vec::new(),
            vec![er2c2_name_change("ABC", "ABC Limited", "ABC Limited", "2026-01-01")],
        );
        let indexes = er2c2_indexes(vec![local], &snapshot, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "DUPLICATE",
            "NAME_CHANGE",
            None,
            None,
            Some("ABC"),
            Some("ABC Limited"),
            Some("ABC Limited"),
            "2026-01-01",
        );
        let input = build_nse_i4_er2_input(&preview, &indexes).unwrap();
        let state = classify_nse_i4_er2_resolver_outcome(resolve_identity(&input));
        assert_eq!(state, NseI4Er2ShadowState::NoMaterialResolverMismatch);
        assert_eq!(
            nse_i4_er2_shadow_relationship(&state),
            NseI4Er2ShadowRelationship::NoMaterialResolverMismatch,
        );
    }

    #[test]
    fn er2c2_t0_resolver_error_mapping_preserves_invalid_input_class() {
        let state = classify_nse_i4_er2_resolver_outcome(Err(
            IdentityResolverEvaluationError::InvalidInput("fixture".to_string()),
        ));
        assert_eq!(
            state,
            NseI4Er2ShadowState::ResolverError(NseI4Er2ShadowResolverError::InvalidInput(
                "fixture".to_string(),
            )),
        );
        assert_eq!(
            nse_i4_er2_shadow_relationship(&state),
            NseI4Er2ShadowRelationship::ResolverError,
        );
    }

    #[test]
    fn er2c2_t1_exact_symbol_change_match_is_cardinality_checked() {
        let row = er2c2_symbol_change("OLD", "NEW", "2026-01-01");
        let snapshot = er2c2_snapshot("A", Vec::new(), Vec::new(), vec![row.clone()], Vec::new());
        let indexes = er2c2_indexes(Vec::new(), &snapshot, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let matched = reconstruct_nse_i4_er2_historical_evidence(&preview, &indexes).unwrap();
        assert_eq!(matched.symbol_change.unwrap().old_symbol, "OLD");

        let empty_snapshot = er2c2_snapshot("B", Vec::new(), Vec::new(), Vec::new(), Vec::new());
        let empty_indexes = er2c2_indexes(Vec::new(), &empty_snapshot, "2026-09-13T01:00:00+05:30");
        let missing = reconstruct_nse_i4_er2_historical_evidence(&preview, &empty_indexes).unwrap_err();
        assert_eq!(
            missing,
            NseI4Er2ShadowState::AdapterError(
                "ER2C2_SOURCE_EVIDENCE_NOT_FOUND:SYMBOL_CHANGE".to_string(),
            ),
        );

        let duplicate_snapshot = er2c2_snapshot(
            "C",
            Vec::new(),
            Vec::new(),
            vec![row.clone(), row],
            Vec::new(),
        );
        let duplicate_indexes = er2c2_indexes(Vec::new(), &duplicate_snapshot, "2026-09-13T01:00:00+05:30");
        let ambiguous = reconstruct_nse_i4_er2_historical_evidence(&preview, &duplicate_indexes).unwrap_err();
        assert_eq!(
            ambiguous,
            NseI4Er2ShadowState::AdapterError(
                "ER2C2_AMBIGUOUS_SOURCE_EVIDENCE:SYMBOL_CHANGE".to_string(),
            ),
        );
    }

    #[test]
    fn er2c2_t1_exact_name_change_match_is_cardinality_checked() {
        let row = er2c2_name_change("ABC", "Old Limited", "New Limited", "2026-01-01");
        let snapshot = er2c2_snapshot("A", Vec::new(), Vec::new(), Vec::new(), vec![row.clone()]);
        let indexes = er2c2_indexes(Vec::new(), &snapshot, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "NAME_CHANGE",
            None,
            None,
            Some("ABC"),
            Some("Old Limited"),
            Some("New Limited"),
            "2026-01-01",
        );
        let matched = reconstruct_nse_i4_er2_historical_evidence(&preview, &indexes).unwrap();
        assert_eq!(matched.name_change.unwrap().symbol, "ABC");

        let duplicate_snapshot = er2c2_snapshot(
            "B",
            Vec::new(),
            Vec::new(),
            Vec::new(),
            vec![row.clone(), row],
        );
        let duplicate_indexes = er2c2_indexes(Vec::new(), &duplicate_snapshot, "2026-09-13T01:00:00+05:30");
        let ambiguous = reconstruct_nse_i4_er2_historical_evidence(&preview, &duplicate_indexes).unwrap_err();
        assert_eq!(
            ambiguous,
            NseI4Er2ShadowState::AdapterError(
                "ER2C2_AMBIGUOUS_SOURCE_EVIDENCE:NAME_CHANGE".to_string(),
            ),
        );
    }

    #[test]
    fn er2c2_t1_both_requires_one_exact_symbol_and_name_source_row() {
        let snapshot = er2c2_snapshot(
            "A",
            Vec::new(),
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            vec![er2c2_name_change("NEW", "Old Limited", "New Limited", "2026-01-01")],
        );
        let indexes = er2c2_indexes(Vec::new(), &snapshot, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "BOTH",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            Some("Old Limited"),
            Some("New Limited"),
            "2026-01-01",
        );
        let matched = reconstruct_nse_i4_er2_historical_evidence(&preview, &indexes).unwrap();
        assert!(matched.symbol_change.is_some());
        assert!(matched.name_change.is_some());
    }

    #[test]
    fn er2c2_t2_local_identity_is_genuine_local_old_symbol_and_preserves_lifecycle() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", false)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let input = build_nse_i4_er2_input(&preview, &indexes).unwrap();
        assert_eq!(input.local_identity.symbol, "OLD");
        assert_eq!(input.local_identity.lifecycle_state.as_deref(), Some("INACTIVE"));
        assert_eq!(input.local_identity.effective_from, None);
        assert_eq!(input.local_identity.effective_to, None);
    }

    #[test]
    fn er2c2_t2_missing_local_identity_is_not_synthesized() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(Vec::new(), &snapshot, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        assert_eq!(
            build_nse_i4_er2_input(&preview, &indexes).unwrap_err(),
            NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::NoLocalIdentity),
        );
    }

    #[test]
    fn er2c2_t3_official_identity_uses_eq_master_not_wider_current_universe() {
        let current_only = er2c2_master("SMEONLY", "SME Only", "SM", "INESME000001");
        let snapshot = er2c2_snapshot(
            "A",
            Vec::new(),
            vec![current_only],
            vec![er2c2_symbol_change("OLD", "SMEONLY", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "SME Only", "SM", "INESME000001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("SMEONLY"),
            Some("SMEONLY"),
            None,
            None,
            "2026-01-01",
        );
        assert_eq!(
            build_nse_i4_er2_input(&preview, &indexes).unwrap_err(),
            NseI4Er2ShadowState::NotEvaluated(
                NseI4Er2ShadowReason::NoOfficialCurrentIdentity,
            ),
        );
    }

    #[test]
    fn er2c2_t4_symbol_change_evidence_never_borrows_isin_or_series() {
        let row = er2c2_symbol_change("OLD", "NEW", "2026-01-01");
        let evidence = build_nse_i4_er2_symbol_change_evidence(
            &row,
            "BBBB",
            "2026-09-13T01:00:00+05:30",
        );
        assert_eq!(evidence.isin, None);
        assert_eq!(evidence.series, None);
        assert_eq!(evidence.evidence_kind, IdentityResolverEvidenceKind::SymbolChange);
    }

    #[test]
    fn er2c2_t5_name_change_evidence_never_borrows_isin_or_series() {
        let row = er2c2_name_change("ABC", "Old Limited", "New Limited", "2026-01-01");
        let evidence = build_nse_i4_er2_name_change_evidence(
            &row,
            "CCCC",
            "2026-09-13T01:00:00+05:30",
        );
        assert_eq!(evidence.isin, None);
        assert_eq!(evidence.series, None);
        assert_eq!(evidence.evidence_kind, IdentityResolverEvidenceKind::NameChange);
    }

    #[test]
    fn er2c2_t6_both_emits_only_current_symbol_and_name_evidence_and_ids_ignore_time() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            vec![er2c2_name_change("NEW", "Old Limited", "New Limited", "2026-01-01")],
        );
        let preview = er2c2_history_row(
            "NEW",
            "BOTH",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            Some("Old Limited"),
            Some("New Limited"),
            "2026-01-01",
        );
        let indexes_a = er2c2_indexes(
            vec![er2c2_existing("OLD", "Old Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let indexes_b = er2c2_indexes(
            vec![er2c2_existing("OLD", "Old Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T02:00:00+05:30",
        );
        let input_a = build_nse_i4_er2_input(&preview, &indexes_a).unwrap();
        let input_b = build_nse_i4_er2_input(&preview, &indexes_b).unwrap();
        let kinds = input_a
            .evidence
            .iter()
            .map(|evidence| evidence.evidence_kind)
            .collect::<Vec<_>>();
        assert_eq!(kinds.len(), 3);
        assert!(kinds.contains(&IdentityResolverEvidenceKind::CurrentMaster));
        assert!(kinds.contains(&IdentityResolverEvidenceKind::SymbolChange));
        assert!(kinds.contains(&IdentityResolverEvidenceKind::NameChange));
        assert_eq!(
            input_a
                .evidence
                .iter()
                .map(|evidence| evidence.evidence_id.clone())
                .collect::<Vec<_>>(),
            input_b
                .evidence
                .iter()
                .map(|evidence| evidence.evidence_id.clone())
                .collect::<Vec<_>>(),
        );
    }

    #[test]
    fn er2c2_t7_same_isin_current_peers_surface_rule_e_conflict() {
        let current = er2c2_master("NEW", "New Limited", "EQ", "INE000A01001");
        let peer = er2c2_master("PEER", "Peer Limited", "EQ", "INE000A01001");
        let snapshot = er2c2_snapshot(
            "A",
            vec![current, peer],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let input = build_nse_i4_er2_input(&preview, &indexes).unwrap();
        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
        );
    }

    #[test]
    fn er2c2_t8_missing_historical_isin_bridge_surfaces_rule_i() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let state = classify_nse_i4_er2_resolver_outcome(resolve_identity(
            &build_nse_i4_er2_input(&preview, &indexes).unwrap(),
        ));
        let NseI4Er2ShadowState::Evaluated(result) = state else {
            panic!("expected Rule I result");
        };
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
        assert_eq!(
            nse_i4_er2_shadow_relationship(&NseI4Er2ShadowState::Evaluated(result)),
            NseI4Er2ShadowRelationship::ResolverNeedsMoreEvidence,
        );
    }

    #[test]
    fn er2c2_t8_isin_change_without_bridge_surfaces_rule_d_conflict() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INENEW01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "New Limited", "EQ", "INEOLD01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let result = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes).unwrap()).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        );
    }

    #[test]
    fn er2c2_t8_name_change_without_source_isin_requires_more_evidence() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("ABC", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            Vec::new(),
            vec![er2c2_name_change("ABC", "Old Limited", "New Limited", "2026-01-01")],
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("ABC", "Old Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let preview = er2c2_history_row(
            "NEW",
            "NAME_CHANGE",
            None,
            None,
            Some("ABC"),
            Some("Old Limited"),
            Some("New Limited"),
            "2026-01-01",
        );
        let result = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes).unwrap()).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        );
    }

    #[test]
    fn er2c2_t9_i4_dispositions_remain_distinct_from_resolver_semantics() {
        let snapshot = er2c2_snapshot(
            "A",
            vec![er2c2_master("NEW", "New Limited", "EQ", "INE000A01001")],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let indexes = er2c2_indexes(
            vec![er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", true)],
            &snapshot,
            "2026-09-13T01:00:00+05:30",
        );
        let new_row = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let duplicate_row = er2c2_history_row(
            "DUPLICATE",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let skipped_row = er2c2_history_row(
            "SKIPPED",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let error_row = er2c2_history_row(
            "ERROR",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let new_eval = evaluate_nse_i4_er2_shadow_row(&new_row, &indexes);
        let duplicate_eval = evaluate_nse_i4_er2_shadow_row(&duplicate_row, &indexes);
        let skipped_eval = evaluate_nse_i4_er2_shadow_row(&skipped_row, &indexes);
        let error_eval = evaluate_nse_i4_er2_shadow_row(&error_row, &indexes);
        assert_eq!(new_eval.relationship, NseI4Er2ShadowRelationship::ResolverNeedsMoreEvidence);
        assert_eq!(duplicate_eval.relationship, NseI4Er2ShadowRelationship::ResolverNeedsMoreEvidence);
        assert_eq!(
            skipped_eval.state,
            NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowSkipped),
        );
        assert_eq!(
            error_eval.state,
            NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowError),
        );
        let summary = summarize_nse_i4_er2_shadow(&[new_eval, duplicate_eval, skipped_eval, error_eval]);
        assert_eq!(summary.history_rows, 4);
        assert_eq!(summary.evaluated_rows, 2);
        assert_eq!(summary.not_evaluated_rows, 2);
        assert_eq!(summary.adapter_error_rows, 0);
        assert_eq!(
            summary.history_rows,
            summary.evaluated_rows + summary.not_evaluated_rows + summary.adapter_error_rows,
        );
    }

    #[test]
    fn er2c2_t10_manual_archive_path_does_not_change_semantic_output() {
        let root_a = er2c2_temp_root();
        let root_b = er2c2_temp_root();
        let master = "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nNEW,New Limited,EQ,INE000A01001\n";
        let symbols = "old,new,date,company\nOLD,NEW,2026-01-01,New Limited\n";
        let names = "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n";
        er2c2_write_sources(&root_a, master, symbols, names);
        er2c2_write_sources(&root_b, master, symbols, names);
        let input_a = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root_a.display().to_string()),
        };
        let input_b = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root_b.display().to_string()),
        };
        let snapshot_a = load_nse_historical_identity_source_snapshot(&input_a).unwrap();
        let snapshot_b = load_nse_historical_identity_source_snapshot(&input_b).unwrap();
        let existing = er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", true);
        let indexes_a = er2c2_indexes(vec![existing.clone()], &snapshot_a, "2026-09-13T01:00:00+05:30");
        let indexes_b = er2c2_indexes(vec![existing], &snapshot_b, "2026-09-13T01:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let result_a = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes_a).unwrap()).unwrap();
        let result_b = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes_b).unwrap()).unwrap();
        assert_eq!(result_a.status, result_b.status);
        assert_eq!(result_a.conclusion, result_b.conclusion);
        assert_eq!(result_a.rule_id, result_b.rule_id);
        assert_eq!(result_a.evidence_ids, result_b.evidence_ids);
        fs::remove_dir_all(root_a).unwrap();
        fs::remove_dir_all(root_b).unwrap();
    }

    #[test]
    fn er2c2_t11_observation_time_and_master_order_do_not_change_semantics() {
        let current = er2c2_master("NEW", "New Limited", "EQ", "INE000A01001");
        let peer = er2c2_master("PEER", "Peer Limited", "EQ", "INE000A01001");
        let snapshot_a = er2c2_snapshot(
            "A",
            vec![current.clone(), peer.clone()],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let snapshot_b = er2c2_snapshot(
            "B",
            vec![peer, current],
            Vec::new(),
            vec![er2c2_symbol_change("OLD", "NEW", "2026-01-01")],
            Vec::new(),
        );
        let existing = er2c2_existing("OLD", "New Limited", "EQ", "INE000A01001", true);
        let indexes_a = er2c2_indexes(vec![existing.clone()], &snapshot_a, "2026-09-13T01:00:00+05:30");
        let indexes_b = er2c2_indexes(vec![existing], &snapshot_b, "2026-09-13T02:00:00+05:30");
        let preview = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let result_a = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes_a).unwrap()).unwrap();
        let result_b = resolve_identity(&build_nse_i4_er2_input(&preview, &indexes_b).unwrap()).unwrap();
        assert_eq!(result_a.status, result_b.status);
        assert_eq!(result_a.conclusion, result_b.conclusion);
        assert_eq!(result_a.rule_id, result_b.rule_id);
        assert_eq!(result_a.evidence_ids, result_b.evidence_ids);
    }

    #[test]
    fn er2c2_t12_preview_invokes_shadow_once_only_after_rollback() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INEOLD1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        er2c2_insert_local(&connection, "OLDCO", "Current Limited", "EQ", "INEOLD1", true);
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        er2c2_shadow_test_reset();
        let result = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        assert!(result.can_apply);
        assert_eq!(er2c2_shadow_test_call_count(), 1);
        assert!(er2c2_shadow_test_entry_autocommit());
        assert_eq!(er2c2_shadow_test_history_rows_at_entry(), 0);
        let persisted_history = connection
            .query_row("SELECT COUNT(*) FROM instrument_identity_history", [], |row| row.get::<_, i64>(0))
            .unwrap();
        assert_eq!(persisted_history, 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t12_existing_i4_execution_error_path_does_not_invoke_shadow() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INEOLD1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        connection.execute_batch("DROP TABLE instruments;").unwrap();
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        er2c2_shadow_test_reset();
        let error = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap_err();
        assert!(error.to_ascii_lowercase().contains("no such table"));
        assert!(error.to_ascii_lowercase().contains("instruments"));
        assert_eq!(er2c2_shadow_test_call_count(), 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t13_public_preview_is_identical_even_when_private_shadow_conflicts() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INENEW1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        er2c2_insert_local(&connection, "OLDCO", "Current Limited", "EQ", "INEOLD1", true);
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let expected = er2c2_legacy_preview_without_shadow(&connection, &input).unwrap();
        let actual = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        assert_eq!(
            serde_json::to_value(actual).unwrap(),
            serde_json::to_value(&expected).unwrap(),
        );
        let snapshot = load_nse_historical_identity_source_snapshot(&input).unwrap();
        let shadow = evaluate_nse_i4_er2_shadow(&connection, &snapshot, &expected);
        assert!(shadow.iter().any(|row| row.relationship == NseI4Er2ShadowRelationship::ResolverConflict), "preview errors: {:?}; shadow: {:?}", expected.errors, shadow);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t13_adapter_error_is_private_and_public_i4_remains_identical() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INEOLD1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        er2c2_insert_local(&connection, "OLDCO", "Current Limited", "EQ", "INEOLD1", true);
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let expected = er2c2_legacy_preview_without_shadow(&connection, &input).unwrap();
        let actual = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        assert_eq!(
            serde_json::to_value(actual).unwrap(),
            serde_json::to_value(&expected).unwrap(),
        );
        let snapshot = load_nse_historical_identity_source_snapshot(&input).unwrap();
        let shadow = evaluate_nse_i4_er2_shadow(&connection, &snapshot, &expected);
        assert!(shadow.iter().any(|row| row.relationship == NseI4Er2ShadowRelationship::AdapterError));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t13_can_apply_false_is_unchanged_and_error_rows_are_not_evaluated() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INEOLD1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        er2c2_insert_local(&connection, "OLDCO", "Current Limited", "EQ", "INEOLD1", true);
        connection
            .execute_batch(
                "CREATE TRIGGER er2c2_fail_identity_two BEFORE INSERT ON instrument_identity_history BEGIN SELECT RAISE(FAIL, 'er2c2 injected failure two'); END;",
            )
            .unwrap();
        let input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let expected = er2c2_legacy_preview_without_shadow(&connection, &input).unwrap();
        er2c2_shadow_test_reset();
        let actual = preview_nse_historical_identity_archive_internal(&connection, &input).unwrap();
        assert!(!actual.can_apply);
        assert_eq!(actual.error_rows, expected.error_rows);
        assert_eq!(actual.plan_sha256, expected.plan_sha256);
        assert_eq!(
            serde_json::to_value(&actual).unwrap(),
            serde_json::to_value(&expected).unwrap(),
        );
        assert_eq!(er2c2_shadow_test_call_count(), 1);
        let snapshot = load_nse_historical_identity_source_snapshot(&input).unwrap();
        let shadow = evaluate_nse_i4_er2_shadow(&connection, &snapshot, &actual);
        assert!(shadow.iter().any(|row| row.state == NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowError)));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t14_apply_never_invokes_shadow_and_reviewed_sha_still_commits() {
        let root = er2c2_temp_root();
        er2c2_write_sources(
            &root,
            "SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nCURR,Current Limited,EQ,INEOLD1\n",
            "old,new,date,company\nOLDCO,CURR,2026-01-01,Current Limited\n",
            "NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\n",
        );
        let connection = er2c2_test_connection();
        er2c2_insert_local(&connection, "OLDCO", "Current Limited", "EQ", "INEOLD1", true);
        let preview_input = NseHistoricalIdentityPreviewInput {
            archive_root_path: Some(root.display().to_string()),
        };
        let preview = preview_nse_historical_identity_archive_internal(&connection, &preview_input).unwrap();
        er2c2_shadow_test_reset();
        let applied = apply_nse_historical_identity_archive_internal(
            &connection,
            &NseHistoricalIdentityApplyInput {
                archive_root_path: Some(root.display().to_string()),
                expected_plan_sha256: preview.plan_sha256.clone(),
            },
        )
        .unwrap();
        assert!(applied.applied);
        assert_eq!(er2c2_shadow_test_call_count(), 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn er2c2_t15_fixture_characterization_summary_is_aggregate_only() {
        let preview_new = er2c2_history_row(
            "NEW",
            "SYMBOL_CHANGE",
            Some("OLD"),
            Some("NEW"),
            Some("NEW"),
            None,
            None,
            "2026-01-01",
        );
        let preview_skipped = er2c2_history_row(
            "SKIPPED",
            "NAME_CHANGE",
            None,
            None,
            Some("ABC"),
            Some("Old"),
            Some("New"),
            "2026-01-02",
        );
        let evaluations = vec![
            nse_i4_er2_shadow_evaluation_from_state(
                &preview_new,
                Some("OLD".to_string()),
                Some("NEW".to_string()),
                NseI4Er2ShadowState::AdapterError("fixture-only".to_string()),
            ),
            nse_i4_er2_shadow_evaluation_from_state(
                &preview_skipped,
                None,
                None,
                NseI4Er2ShadowState::NotEvaluated(NseI4Er2ShadowReason::I4RowSkipped),
            ),
        ];
        let summary = summarize_nse_i4_er2_shadow(&evaluations);
        assert_eq!(summary.history_rows, 2);
        assert_eq!(summary.adapter_error_rows, 1);
        assert_eq!(summary.not_evaluated_rows, 1);
        assert_eq!(summary.evaluated_rows, 0);
        assert_eq!(
            summary.history_rows,
            summary.evaluated_rows + summary.not_evaluated_rows + summary.adapter_error_rows,
        );
        println!(
            "ER2C2_SHADOW_CHARACTERIZATION_JSON={}",
            serde_json::json!({
                "fixtureOnly": true,
                "historyRows": summary.history_rows,
                "newRows": summary.new_rows,
                "duplicateRows": summary.duplicate_rows,
                "skippedRows": summary.skipped_rows,
                "errorRows": summary.error_rows,
                "eligibleRows": summary.eligible_rows,
                "evaluatedRows": summary.evaluated_rows,
                "notEvaluatedRows": summary.not_evaluated_rows,
                "adapterErrorRows": summary.adapter_error_rows,
                "continuitySupported": summary.continuity_supported,
                "resolverConflicts": summary.resolver_conflicts,
                "needsMoreEvidence": summary.needs_more_evidence,
                "noMaterialMismatch": summary.no_material_mismatch,
                "sourceUnavailable": summary.source_unavailable,
                "resolverErrors": summary.resolver_errors,
            })
        );
    }
}


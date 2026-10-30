use chrono::DateTime;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tauri::AppHandle;

use super::{
    open_connection_for_folder, open_read_only_connection_for_folder,
    resolve_active_database_folder, AppResult,
};

const DIVIDEND_VALIDATION_OPERATION: &str = "DIVIDEND_VALIDATION";
const MAX_REPORT_ITEMS: usize = 50_000;
const MAX_SCOPE_JSON_BYTES: usize = 1_000_000;
const MAX_ITEM_JSON_BYTES: usize = 64_000;
const MAX_TEXT_BYTES: usize = 64_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportItemInput {
    pub import_id: i64,
    pub result_code: String,
    pub reason_snapshot: String,
    pub current_action_type: Option<String>,
    pub current_parse_status: Option<String>,
    pub current_review_status: Option<String>,
    pub stored_approval_state: Option<String>,
    pub evidence: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportSaveInput {
    pub expected_database_path: String,
    pub operation_kind: String,
    pub requested_scope: Value,
    pub started_at_utc: String,
    pub completed_at_utc: Option<String>,
    pub outcome: String,
    pub requested_count: u32,
    pub checked_count: u32,
    pub eligible_count: u32,
    pub ineligible_count: u32,
    pub already_approved_count: u32,
    pub stale_count: u32,
    pub missing_count: u32,
    pub failed_count: u32,
    pub reused_count: u32,
    pub error_message: Option<String>,
    pub policy_version: String,
    pub scope_version: String,
    pub scope_fingerprint: String,
    pub items: Vec<CorporateActionValidationReportItemInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionActivityRunListInput {
    pub operation_kind: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportItemListInput {
    pub run_id: i64,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionActivityRun {
    pub id: i64,
    pub database_instance_id: String,
    pub operation_kind: String,
    pub requested_scope: Value,
    pub started_at_utc: String,
    pub completed_at_utc: Option<String>,
    pub outcome: String,
    pub requested_count: u32,
    pub checked_count: u32,
    pub eligible_count: u32,
    pub ineligible_count: u32,
    pub already_approved_count: u32,
    pub stale_count: u32,
    pub missing_count: u32,
    pub failed_count: u32,
    pub reused_count: u32,
    pub error_message: Option<String>,
    pub app_version: String,
    pub policy_version: Option<String>,
    pub scope_version: Option<String>,
    pub scope_fingerprint: Option<String>,
    pub created_at_utc: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportItem {
    pub id: i64,
    pub run_id: i64,
    pub import_id: i64,
    pub result_code: String,
    pub reason_snapshot: String,
    pub current_action_type: Option<String>,
    pub current_parse_status: Option<String>,
    pub current_review_status: Option<String>,
    pub stored_approval_state: Option<String>,
    pub evidence: Option<Value>,
    pub checked_at_utc: String,
    pub policy_version: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionActivityRunListResult {
    pub runs: Vec<CorporateActionActivityRun>,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportItemListResult {
    pub run_id: i64,
    pub items: Vec<CorporateActionValidationReportItem>,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionValidationReportSaveResult {
    pub run: CorporateActionActivityRun,
    pub saved_item_count: u32,
}

fn verify_database_path(active: &Path, expected: &str) -> AppResult<()> {
    if expected.trim().is_empty() {
        return Err("The reviewed database context is missing.".to_string());
    }
    let active = active.canonicalize().map_err(|error| error.to_string())?;
    let expected = Path::new(expected)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if active != expected {
        return Err(
            "The active database changed after validation. The historical report was not saved."
                .to_string(),
        );
    }
    Ok(())
}

fn parse_utc_instant(label: &str, value: &str) -> AppResult<DateTime<chrono::FixedOffset>> {
    let parsed = DateTime::parse_from_rfc3339(value)
        .map_err(|_| format!("{label} must be an RFC3339 UTC instant."))?;
    if parsed.offset().local_minus_utc() != 0 {
        return Err(format!("{label} must use UTC, not a local offset."));
    }
    Ok(parsed)
}

fn validate_short_text(label: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() || value.len() > 512 {
        return Err(format!("{label} must contain between 1 and 512 bytes."));
    }
    Ok(())
}

fn validate_report_input(input: &CorporateActionValidationReportSaveInput) -> AppResult<String> {
    if input.operation_kind != DIVIDEND_VALIDATION_OPERATION {
        return Err("This persistence slice accepts Dividend validation reports only.".to_string());
    }
    if !matches!(
        input.outcome.as_str(),
        "COMPLETED" | "INCOMPLETE" | "FAILED" | "CANCELLED"
    ) {
        return Err("Unknown Corporate Actions activity outcome.".to_string());
    }
    validate_short_text("Policy version", &input.policy_version)?;
    validate_short_text("Scope version", &input.scope_version)?;
    validate_short_text("Scope fingerprint", &input.scope_fingerprint)?;
    let started = parse_utc_instant("startedAtUtc", &input.started_at_utc)?;
    if let Some(completed_at) = input.completed_at_utc.as_deref() {
        let completed = parse_utc_instant("completedAtUtc", completed_at)?;
        if completed < started {
            return Err("completedAtUtc cannot precede startedAtUtc.".to_string());
        }
    } else if input.outcome == "COMPLETED" {
        return Err("A completed report requires completedAtUtc.".to_string());
    }
    if input.items.len() > MAX_REPORT_ITEMS {
        return Err(format!(
            "A report may contain at most {MAX_REPORT_ITEMS} items."
        ));
    }
    if input.checked_count as usize != input.items.len() {
        return Err("checkedCount must equal the number of saved report items.".to_string());
    }
    if input.checked_count > input.requested_count {
        return Err("checkedCount cannot exceed requestedCount.".to_string());
    }
    if input.reused_count > input.checked_count {
        return Err("reusedCount cannot exceed compatibility-checked results.".to_string());
    }
    let disposition_total = input.eligible_count
        + input.ineligible_count
        + input.already_approved_count
        + input.stale_count
        + input.missing_count
        + input.failed_count;
    if disposition_total != input.checked_count {
        return Err("Disposition counts must reconcile exactly to checkedCount.".to_string());
    }
    if input.outcome == "COMPLETED"
        && (input.checked_count != input.requested_count || input.failed_count != 0)
    {
        return Err(
            "A completed report must check every requested item without failures.".to_string(),
        );
    }
    if input
        .error_message
        .as_ref()
        .is_some_and(|value| value.len() > MAX_TEXT_BYTES)
    {
        return Err("The report error message is too large.".to_string());
    }
    let scope_json =
        serde_json::to_string(&input.requested_scope).map_err(|error| error.to_string())?;
    if scope_json.len() > MAX_SCOPE_JSON_BYTES {
        return Err("The requested scope snapshot is too large.".to_string());
    }

    let scope = input
        .requested_scope
        .as_object()
        .ok_or_else(|| "The requested scope snapshot must be a JSON object.".to_string())?;
    if scope.get("actionType").and_then(Value::as_str) != Some("DIVIDEND") {
        return Err("The requested scope must identify the Dividend policy.".to_string());
    }
    let requested_import_ids = scope
        .get("importIds")
        .and_then(Value::as_array)
        .ok_or_else(|| "The requested scope must include importIds.".to_string())?;
    if requested_import_ids.len() != input.requested_count as usize {
        return Err("The requested scope importIds must reconcile to requestedCount.".to_string());
    }
    let mut requested_ids = HashSet::with_capacity(requested_import_ids.len());
    for value in requested_import_ids {
        let id = value
            .as_i64()
            .ok_or_else(|| "Requested scope importIds must be integer values.".to_string())?;
        if id <= 0 || id > 9_007_199_254_740_991_i64 || !requested_ids.insert(id) {
            return Err(
                "Requested scope importIds must be unique positive JavaScript-safe integers."
                    .to_string(),
            );
        }
    }

    let mut seen = HashSet::with_capacity(input.items.len());
    let mut counts: HashMap<&str, u32> = HashMap::new();
    for item in &input.items {
        if item.import_id <= 0
            || item.import_id > 9_007_199_254_740_991_i64
            || !seen.insert(item.import_id)
        {
            return Err(
                "Report item IDs must be unique positive JavaScript-safe integers.".to_string(),
            );
        }
        if !requested_ids.contains(&item.import_id) {
            return Err(format!(
                "Report item {} is outside the requested scope.",
                item.import_id
            ));
        }
        if !matches!(
            item.result_code.as_str(),
            "ELIGIBLE" | "INELIGIBLE" | "ALREADY_APPROVED" | "STALE_SCOPE" | "MISSING" | "FAILED"
        ) {
            return Err(format!(
                "Unknown report disposition for import {}.",
                item.import_id
            ));
        }
        if item.reason_snapshot.trim().is_empty() || item.reason_snapshot.len() > MAX_TEXT_BYTES {
            return Err(format!(
                "Report reason for import {} is empty or too large.",
                item.import_id
            ));
        }
        if let Some(evidence) = &item.evidence {
            let serialized = serde_json::to_string(evidence).map_err(|error| error.to_string())?;
            if serialized.len() > MAX_ITEM_JSON_BYTES {
                return Err(format!(
                    "Report evidence for import {} is too large.",
                    item.import_id
                ));
            }
        }
        *counts.entry(item.result_code.as_str()).or_default() += 1;
    }
    for (code, expected) in [
        ("ELIGIBLE", input.eligible_count),
        ("INELIGIBLE", input.ineligible_count),
        ("ALREADY_APPROVED", input.already_approved_count),
        ("STALE_SCOPE", input.stale_count),
        ("MISSING", input.missing_count),
        ("FAILED", input.failed_count),
    ] {
        if counts.get(code).copied().unwrap_or(0) != expected {
            return Err(format!(
                "{code} item count does not match its aggregate count."
            ));
        }
    }
    Ok(scope_json)
}

fn database_instance_id(connection: &Connection) -> AppResult<String> {
    connection
        .query_row(
            "SELECT database_instance_id FROM corporate_action_history_metadata WHERE singleton_id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn persist_validation_report_in_connection(
    connection: &Connection,
    input: &CorporateActionValidationReportSaveInput,
) -> AppResult<CorporateActionValidationReportSaveResult> {
    let requested_scope_json = validate_report_input(input)?;
    let database_instance_id = database_instance_id(connection)?;
    connection
        .execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|error| error.to_string())?;
    let operation = (|| -> AppResult<i64> {
        connection
            .execute(
                "
                  INSERT INTO corporate_action_activity_runs (
                    database_instance_id, operation_kind, requested_scope_json,
                    started_at_utc, completed_at_utc, outcome, requested_count,
                    checked_count, eligible_count, ineligible_count,
                    already_approved_count, stale_count, missing_count, failed_count,
                    reused_count, error_message, app_version, policy_version,
                    scope_version, scope_fingerprint
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    database_instance_id,
                    input.operation_kind,
                    requested_scope_json,
                    input.started_at_utc,
                    input.completed_at_utc,
                    input.outcome,
                    input.requested_count,
                    input.checked_count,
                    input.eligible_count,
                    input.ineligible_count,
                    input.already_approved_count,
                    input.stale_count,
                    input.missing_count,
                    input.failed_count,
                    input.reused_count,
                    input.error_message,
                    env!("CARGO_PKG_VERSION"),
                    input.policy_version,
                    input.scope_version,
                    input.scope_fingerprint,
                ],
            )
            .map_err(|error| error.to_string())?;
        let run_id = connection.last_insert_rowid();
        let mut statement = connection
            .prepare(
                "
                  INSERT INTO corporate_action_validation_report_items (
                    run_id, import_id, result_code, reason_snapshot,
                    current_action_type, current_parse_status, current_review_status,
                    stored_approval_state, evidence_json, dependency_json,
                    checked_at_utc, policy_version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
                ",
            )
            .map_err(|error| error.to_string())?;
        let checked_at = input
            .completed_at_utc
            .as_deref()
            .unwrap_or(input.started_at_utc.as_str());
        for item in &input.items {
            let evidence_json = item
                .evidence
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|error| error.to_string())?;
            statement
                .execute(params![
                    run_id,
                    item.import_id,
                    item.result_code,
                    item.reason_snapshot,
                    item.current_action_type,
                    item.current_parse_status,
                    item.current_review_status,
                    item.stored_approval_state,
                    evidence_json,
                    checked_at,
                    input.policy_version,
                ])
                .map_err(|error| error.to_string())?;
        }
        Ok(run_id)
    })();
    let run_id = match operation {
        Ok(run_id) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| error.to_string())?;
            run_id
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            return Err(error);
        }
    };
    let run = read_activity_run(connection, run_id)?.ok_or_else(|| {
        "Saved Corporate Actions activity run could not be read back.".to_string()
    })?;
    Ok(CorporateActionValidationReportSaveResult {
        run,
        saved_item_count: input.items.len() as u32,
    })
}

fn parse_json_value(raw: String) -> rusqlite::Result<Value> {
    serde_json::from_str(&raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            raw.len(),
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })
}

fn map_activity_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<CorporateActionActivityRun> {
    Ok(CorporateActionActivityRun {
        id: row.get(0)?,
        database_instance_id: row.get(1)?,
        operation_kind: row.get(2)?,
        requested_scope: parse_json_value(row.get(3)?)?,
        started_at_utc: row.get(4)?,
        completed_at_utc: row.get(5)?,
        outcome: row.get(6)?,
        requested_count: row.get(7)?,
        checked_count: row.get(8)?,
        eligible_count: row.get(9)?,
        ineligible_count: row.get(10)?,
        already_approved_count: row.get(11)?,
        stale_count: row.get(12)?,
        missing_count: row.get(13)?,
        failed_count: row.get(14)?,
        reused_count: row.get(15)?,
        error_message: row.get(16)?,
        app_version: row.get(17)?,
        policy_version: row.get(18)?,
        scope_version: row.get(19)?,
        scope_fingerprint: row.get(20)?,
        created_at_utc: row.get(21)?,
    })
}

const ACTIVITY_RUN_SELECT: &str = "
  SELECT id, database_instance_id, operation_kind, requested_scope_json,
         started_at_utc, completed_at_utc, outcome, requested_count,
         checked_count, eligible_count, ineligible_count, already_approved_count,
         stale_count, missing_count, failed_count, reused_count, error_message,
         app_version, policy_version, scope_version, scope_fingerprint, created_at_utc
  FROM corporate_action_activity_runs
";

fn read_activity_run(
    connection: &Connection,
    run_id: i64,
) -> AppResult<Option<CorporateActionActivityRun>> {
    connection
        .query_row(
            &format!("{ACTIVITY_RUN_SELECT} WHERE id = ?"),
            params![run_id],
            map_activity_run,
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn list_activity_runs_in_connection(
    connection: &Connection,
    input: Option<&CorporateActionActivityRunListInput>,
) -> AppResult<CorporateActionActivityRunListResult> {
    let operation_kind = input
        .and_then(|value| value.operation_kind.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if operation_kind.is_some_and(|value| value != DIVIDEND_VALIDATION_OPERATION) {
        return Err("Unknown Corporate Actions activity kind.".to_string());
    }
    let limit = input
        .and_then(|value| value.limit)
        .unwrap_or(25)
        .clamp(1, 200);
    let offset = input.and_then(|value| value.offset).unwrap_or(0);
    let total: u32 = if let Some(kind) = operation_kind {
        connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_activity_runs WHERE operation_kind = ?",
                params![kind],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?
    } else {
        connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_activity_runs",
                [],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?
    };
    let (sql, parameters): (String, Vec<rusqlite::types::Value>) = if let Some(kind) =
        operation_kind
    {
        (
            format!("{ACTIVITY_RUN_SELECT} WHERE operation_kind = ? ORDER BY started_at_utc DESC, id DESC LIMIT ? OFFSET ?"),
            vec![kind.to_string().into(), limit.into(), offset.into()],
        )
    } else {
        (
            format!("{ACTIVITY_RUN_SELECT} ORDER BY started_at_utc DESC, id DESC LIMIT ? OFFSET ?"),
            vec![limit.into(), offset.into()],
        )
    };
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let runs = statement
        .query_map(rusqlite::params_from_iter(parameters), map_activity_run)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(CorporateActionActivityRunListResult {
        runs,
        total,
        offset,
        limit,
        has_more: offset.saturating_add(limit) < total,
    })
}

fn map_report_item(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CorporateActionValidationReportItem> {
    let evidence_json: Option<String> = row.get(9)?;
    let evidence = evidence_json.map(parse_json_value).transpose()?;
    Ok(CorporateActionValidationReportItem {
        id: row.get(0)?,
        run_id: row.get(1)?,
        import_id: row.get(2)?,
        result_code: row.get(3)?,
        reason_snapshot: row.get(4)?,
        current_action_type: row.get(5)?,
        current_parse_status: row.get(6)?,
        current_review_status: row.get(7)?,
        stored_approval_state: row.get(8)?,
        evidence,
        checked_at_utc: row.get(10)?,
        policy_version: row.get(11)?,
    })
}

fn list_report_items_in_connection(
    connection: &Connection,
    input: &CorporateActionValidationReportItemListInput,
) -> AppResult<CorporateActionValidationReportItemListResult> {
    if input.run_id <= 0 {
        return Err("A positive activity run ID is required.".to_string());
    }
    if read_activity_run(connection, input.run_id)?.is_none() {
        return Err("The requested Corporate Actions activity run does not exist.".to_string());
    }
    let limit = input.limit.unwrap_or(200).clamp(1, 500);
    let offset = input.offset.unwrap_or(0);
    let total: u32 = connection
        .query_row(
            "SELECT COUNT(*) FROM corporate_action_validation_report_items WHERE run_id = ?",
            params![input.run_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "
              SELECT id, run_id, import_id, result_code, reason_snapshot,
                     current_action_type, current_parse_status, current_review_status,
                     stored_approval_state, evidence_json, checked_at_utc, policy_version
              FROM corporate_action_validation_report_items
              WHERE run_id = ?
              ORDER BY id ASC
              LIMIT ? OFFSET ?
            ",
        )
        .map_err(|error| error.to_string())?;
    let items = statement
        .query_map(params![input.run_id, limit, offset], map_report_item)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(CorporateActionValidationReportItemListResult {
        run_id: input.run_id,
        items,
        total,
        offset,
        limit,
        has_more: offset.saturating_add(limit) < total,
    })
}

#[tauri::command]
pub async fn save_corporate_action_validation_report(
    app: AppHandle,
    input: CorporateActionValidationReportSaveInput,
) -> AppResult<CorporateActionValidationReportSaveResult> {
    let folder_path = resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before saving Corporate Actions history.".to_string())?;
    verify_database_path(&folder_path, &input.expected_database_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_connection_for_folder(&folder_path, false)?;
        persist_validation_report_in_connection(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_activity_runs(
    app: AppHandle,
    input: Option<CorporateActionActivityRunListInput>,
) -> AppResult<CorporateActionActivityRunListResult> {
    let folder_path = resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before reading Corporate Actions history.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        list_activity_runs_in_connection(&connection, input.as_ref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_corporate_action_validation_report_items(
    app: AppHandle,
    input: CorporateActionValidationReportItemListInput,
) -> AppResult<CorporateActionValidationReportItemListResult> {
    let folder_path = resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before reading Corporate Actions history.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        list_report_items_in_connection(&connection, &input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;

    fn sample_input() -> CorporateActionValidationReportSaveInput {
        CorporateActionValidationReportSaveInput {
            expected_database_path: "unused-in-connection-test".to_string(),
            operation_kind: DIVIDEND_VALIDATION_OPERATION.to_string(),
            requested_scope: serde_json::json!({"actionType":"DIVIDEND","importIds":[11,12]}),
            started_at_utc: "2026-10-25T18:00:00.000Z".to_string(),
            completed_at_utc: Some("2026-10-25T18:00:02.000Z".to_string()),
            outcome: "COMPLETED".to_string(),
            requested_count: 2,
            checked_count: 2,
            eligible_count: 1,
            ineligible_count: 1,
            already_approved_count: 0,
            stale_count: 0,
            missing_count: 0,
            failed_count: 0,
            reused_count: 0,
            error_message: None,
            policy_version: "AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1".to_string(),
            scope_version: "DIVIDEND_PREPARED_SCOPE_R1".to_string(),
            scope_fingerprint: "abc123".to_string(),
            items: vec![
                CorporateActionValidationReportItemInput {
                    import_id: 11,
                    result_code: "ELIGIBLE".to_string(),
                    reason_snapshot: "Eligible read-only evidence.".to_string(),
                    current_action_type: Some("DIVIDEND".to_string()),
                    current_parse_status: Some("PARSED".to_string()),
                    current_review_status: Some("PENDING".to_string()),
                    stored_approval_state: Some("PENDING".to_string()),
                    evidence: Some(serde_json::json!({"previousTradeDate":"2026-10-22"})),
                },
                CorporateActionValidationReportItemInput {
                    import_id: 12,
                    result_code: "INELIGIBLE".to_string(),
                    reason_snapshot: "Missing date-valid price evidence.".to_string(),
                    current_action_type: Some("DIVIDEND".to_string()),
                    current_parse_status: Some("PARSED".to_string()),
                    current_review_status: Some("PENDING".to_string()),
                    stored_approval_state: Some("PENDING".to_string()),
                    evidence: None,
                },
            ],
        }
    }

    #[test]
    fn additive_schema_is_idempotent_and_preserves_existing_rows() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO settings (key, value) VALUES ('sentinel', 'kept')",
                [],
            )
            .unwrap();
        let first_id = database_instance_id(&connection).unwrap();

        prepare_database_connection(&connection).unwrap();

        assert_eq!(database_instance_id(&connection).unwrap(), first_id);
        assert_eq!(
            connection
                .query_row(
                    "SELECT value FROM settings WHERE key='sentinel'",
                    [],
                    |row| row.get::<_, String>(0)
                )
                .unwrap(),
            "kept"
        );
    }

    #[test]
    fn report_header_and_items_commit_atomically_and_page_without_scanning() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        let saved = persist_validation_report_in_connection(&connection, &sample_input()).unwrap();

        assert_eq!(saved.saved_item_count, 2);
        assert_eq!(saved.run.outcome, "COMPLETED");
        let runs = list_activity_runs_in_connection(
            &connection,
            Some(&CorporateActionActivityRunListInput {
                operation_kind: Some(DIVIDEND_VALIDATION_OPERATION.to_string()),
                limit: Some(1),
                offset: Some(0),
            }),
        )
        .unwrap();
        assert_eq!(runs.total, 1);
        let items = list_report_items_in_connection(
            &connection,
            &CorporateActionValidationReportItemListInput {
                run_id: saved.run.id,
                limit: Some(1),
                offset: Some(0),
            },
        )
        .unwrap();
        assert_eq!(items.total, 2);
        assert_eq!(items.items.len(), 1);
        assert!(items.has_more);
    }

    #[test]
    fn invalid_duplicate_item_report_leaves_no_partial_run() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        let mut input = sample_input();
        input.items[1].import_id = input.items[0].import_id;

        assert!(persist_validation_report_in_connection(&connection, &input).is_err());
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM corporate_action_activity_runs",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn local_offset_is_rejected_instead_of_reinterpreted_as_utc() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        let mut input = sample_input();
        input.started_at_utc = "2026-10-25T23:30:00+05:30".to_string();

        assert!(persist_validation_report_in_connection(&connection, &input)
            .unwrap_err()
            .contains("must use UTC"));
    }
}

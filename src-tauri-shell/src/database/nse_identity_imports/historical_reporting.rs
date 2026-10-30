use super::apply_reporting::IdentityApplyProgress;
use super::*;

pub(super) fn progress(
    stage: &'static str,
    processed: usize,
    total: usize,
) -> IdentityApplyProgress {
    IdentityApplyProgress {
        stage,
        processed,
        total,
        percent: match stage {
            "checking" => None,
            "committed" | "refreshing" => Some(100),
            "committing" => Some(99),
            _ => Some(if total == 0 {
                0
            } else {
                (processed * 95 / total).min(95) as u32
            }),
        },
    }
}

pub(super) fn actionable(result: &NseHistoricalIdentityResult) -> bool {
    result.new_symbol_changes
        + result.new_name_changes
        + result.new_combined_changes
        + result.active_sync_activate_count
        + result.active_sync_update_count
        + result.active_sync_deactivate_count
        > 0
}

pub(super) fn save_receipt(
    connection: &Connection,
    result: &mut NseHistoricalIdentityResult,
    prior_id: i64,
) -> AppResult<()> {
    if connection.is_autocommit() {
        return Err("Historical receipt requires the Apply transaction.".into());
    }
    result.run_id = Some(format!(
        "historical-{}-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
        &result.plan_sha256[..12]
    ));
    result.completed_at = Some(chrono::Utc::now().to_rfc3339());
    result.applied = true;
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS historical_identity_apply_runs (
        run_id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, result_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS historical_identity_apply_run_rows (
        history_id INTEGER PRIMARY KEY, run_id TEXT NOT NULL);",
        )
        .map_err(|e| e.to_string())?;
    connection
        .execute(
            "INSERT INTO historical_identity_apply_runs VALUES (?,?,?)",
            params![
                result.run_id,
                result.completed_at,
                serde_json::to_string(result).map_err(|e| e.to_string())?
            ],
        )
        .map_err(|e| e.to_string())?;
    connection
        .execute(
            "INSERT INTO historical_identity_apply_run_rows(history_id,run_id)
        SELECT id,? FROM instrument_identity_history WHERE id>? AND exchange='NSE' AND source=?",
            params![result.run_id, prior_id, NSE_IDENTITY_SOURCE],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn table_exists(connection: &Connection, table: &str) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
            params![table],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
}

pub(super) fn read_history(connection: &Connection) -> AppResult<serde_json::Value> {
    let mut runs = Vec::<serde_json::Value>::new();
    if table_exists(connection, "historical_identity_apply_runs")? {
        let mut stmt = connection.prepare("SELECT result_json FROM historical_identity_apply_runs ORDER BY completed_at DESC,run_id DESC LIMIT 50").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let value: serde_json::Value = serde_json::from_str(&row.map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            if value["applied"] != true || value["runId"].as_str().is_none() {
                return Err("Invalid historical run receipt.".into());
            }
            runs.push(serde_json::json!({"runId":value["runId"],"completedAt":value["completedAt"],
                "newSymbolChanges":value["newSymbolChanges"],"newNameChanges":value["newNameChanges"],"newCombinedChanges":value["newCombinedChanges"]}));
        }
    }
    let exclude = if table_exists(connection, "historical_identity_apply_run_rows")? {
        "AND id NOT IN (SELECT history_id FROM historical_identity_apply_run_rows)"
    } else {
        ""
    };
    let mut legacy = Vec::new();
    let mut stmt = connection.prepare(&format!("SELECT id,created_at,change_type,effective_date,old_symbol,new_symbol,old_name,new_name,source_ref
        FROM instrument_identity_history WHERE exchange='NSE' AND source=? {exclude} ORDER BY id DESC LIMIT 250")).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![NSE_IDENTITY_SOURCE], |r| Ok(serde_json::json!({
        "id": r.get::<_, i64>(0)?, "createdAt": r.get::<_, Option<String>>(1)?, "changeType": r.get::<_, Option<String>>(2)?,
        "effectiveDate": r.get::<_, Option<String>>(3)?, "oldSymbol": r.get::<_, Option<String>>(4)?, "newSymbol": r.get::<_, Option<String>>(5)?,
        "oldName": r.get::<_, Option<String>>(6)?, "newName": r.get::<_, Option<String>>(7)?, "sourceFile": r.get::<_, Option<String>>(8)?
    }))).map_err(|e| e.to_string())?;
    for row in rows {
        legacy.push(row.map_err(|e| e.to_string())?);
    }
    Ok(serde_json::json!({"runs":runs,"legacyRows":legacy}))
}

#[tauri::command]
pub async fn list_nse_historical_identity_apply_history(
    app: AppHandle,
) -> AppResult<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder =
            super::super::connection_registry::peek_active_database_folder_read_only(&app)?
                .ok_or("Open a database to read historical apply history.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        read_history(&connection)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(super) fn read_report(connection: &Connection, run_id: &str) -> AppResult<serde_json::Value> {
    if run_id.is_empty()
        || run_id.len() > 200
        || !table_exists(connection, "historical_identity_apply_runs")?
    {
        return Err("No saved historical Apply receipt for this selection.".into());
    }
    let json: String = connection
        .query_row(
            "SELECT result_json FROM historical_identity_apply_runs WHERE run_id=?",
            params![run_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if value["applied"] != true || value["runId"].as_str() != Some(run_id) {
        return Err("Invalid historical Apply receipt.".into());
    }
    Ok(value)
}

#[tauri::command]
pub async fn get_nse_historical_identity_apply_report(
    app: AppHandle,
    run_id: String,
) -> AppResult<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder =
            super::super::connection_registry::peek_active_database_folder_read_only(&app)?
                .ok_or("Open a database to read the saved report.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        read_report(&connection, &run_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

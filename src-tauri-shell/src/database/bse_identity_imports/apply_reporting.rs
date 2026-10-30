use super::super::IdentityApplyProgress;
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

pub(super) fn check_database_path(folder: &Path, expected: &str) -> AppResult<()> {
    super::super::check_identity_reviewed_database_path(folder, expected)
}

pub(super) fn plan_sha256(plan: &BseCurrentUniverseSyncPlan) -> String {
    let mut canonical = plan.clone();
    canonical
        .existing_rows
        .sort_by(|a, b| a.symbol.cmp(&b.symbol));
    let mut hash = Sha256::new();
    hash.update(b"BSE_CURRENT_UNIVERSE_REVIEWED_V1\0");
    // Parsed rows, exact source-byte hash, destination snapshot and planned effects.
    hash.update(
        serde_json::to_vec(&canonical).expect("BSE plan contains only serializable values"),
    );
    format!("{:x}", hash.finalize())
}

pub(super) fn apply_reviewed(
    connection: &Connection,
    input: &BseCurrentUniverseApplyInput,
    report: &dyn Fn(IdentityApplyProgress),
) -> AppResult<BseCurrentUniverseSyncResult> {
    report(progress("checking", 0, 0));
    if input.expected_plan_sha256.len() != 64
        || !input
            .expected_plan_sha256
            .bytes()
            .all(|b| b.is_ascii_hexdigit())
    {
        return Err("BSE_REVIEWED_PLAN_REQUIRED: Preview and confirm the BSE plan first.".into());
    }
    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| error.to_string())?;
    let attempt = (|| -> AppResult<BseCurrentUniverseSyncResult> {
        let plan = build_bse_current_universe_sync_plan(
            connection,
            &BseCurrentUniverseSyncInput {
                master_file_path: input.master_file_path.clone(),
            },
        )?;
        if plan_sha256(&plan) != input.expected_plan_sha256.to_ascii_lowercase() {
            return Err(
                "BSE_REVIEWED_PLAN_STALE: Source or database changed; preview again.".into(),
            );
        }
        if plan.activate_count + plan.update_count + plan.deactivate_count == 0 {
            return Err("BSE_NO_ACTIONABLE_CHANGES: Up to date; nothing to apply.".into());
        }
        let total = plan.preview_rows.len();
        report(progress("applying", 0, total));
        write_bse_plan(connection, &plan, &|processed| {
            if processed % 25 == 0 || processed == total {
                report(progress("applying", processed, total));
            }
        })?;
        let mut result = plan_into_result(plan, true);
        result.completed_at = Some(chrono::Utc::now().to_rfc3339());
        result.run_id = Some(format!(
            "bse-{}-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
            &result.plan_sha256[..12]
        ));
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS bse_identity_apply_runs (
            run_id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, result_json TEXT NOT NULL)",
            )
            .map_err(|error| error.to_string())?;
        connection
            .execute(
                "INSERT INTO bse_identity_apply_runs VALUES (?, ?, ?)",
                params![
                    result.run_id,
                    result.completed_at,
                    serde_json::to_string(&result).map_err(|error| error.to_string())?
                ],
            )
            .map_err(|error| error.to_string())?;
        report(progress("committing", total, total));
        connection
            .execute_batch("COMMIT")
            .map_err(|error| error.to_string())?;
        report(progress("committed", total, total));
        Ok(result)
    })();
    if attempt.is_err() && !connection.is_autocommit() {
        let _ = connection.execute_batch("ROLLBACK");
    }
    attempt
}

fn read_history(connection: &Connection) -> AppResult<Vec<serde_json::Value>> {
    let exists: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='bse_identity_apply_runs')", [], |row| row.get(0)).map_err(|error| error.to_string())?;
    if !exists {
        return Ok(Vec::new());
    }
    let mut stmt = connection.prepare("SELECT result_json FROM bse_identity_apply_runs ORDER BY completed_at DESC, run_id DESC LIMIT 50").map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())
    })
    .collect()
}

#[tauri::command]
pub async fn list_bse_identity_apply_history(app: AppHandle) -> AppResult<Vec<serde_json::Value>> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = super::super::peek_active_database_folder_read_only(&app)?
            .ok_or("Open a database to read BSE apply history.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        read_history(&connection)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests;

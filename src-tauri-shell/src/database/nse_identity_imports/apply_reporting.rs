pub use super::super::IdentityApplyProgress;
use super::*;

fn progress(stage: &'static str, processed: usize, total: usize) -> IdentityApplyProgress {
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
                ((processed * 100 / total) as u32).min(99)
            }),
        },
    }
}

pub(super) fn apply_reviewed(
    connection: &Connection,
    input: &NseCurrentUniverseApplyInput,
    root: Option<&Path>,
    report: &dyn Fn(IdentityApplyProgress),
) -> AppResult<NseCurrentUniverseSyncResult> {
    report(progress("checking", 0, 0));
    let plan = build_nse_current_universe_sync_plan(
        connection,
        &NseCurrentUniverseSyncInput {
            archive_root_path: input.archive_root_path.clone(),
        },
        root,
    )?;
    let sha = nse_current_universe_plan_sha256(&plan);
    if normalize_expected_nse_plan_sha256(&input.expected_plan_sha256)? != sha {
        return Err(NSE_REVIEWED_PLAN_STALE_ERROR.to_string());
    }
    apply_plan_checked(connection, plan, sha.clone(), report, &|connection| {
        let current = build_nse_current_universe_sync_plan(
            connection,
            &NseCurrentUniverseSyncInput {
                archive_root_path: input.archive_root_path.clone(),
            },
            root,
        )?;
        if nse_current_universe_plan_sha256(&current) != sha {
            return Err(NSE_REVIEWED_PLAN_STALE_ERROR.to_string());
        }
        Ok(())
    })
}

#[cfg(test)]
fn apply_plan(
    connection: &Connection,
    plan: NseCurrentUniverseSyncPlan,
    sha: String,
    report: &dyn Fn(IdentityApplyProgress),
) -> AppResult<NseCurrentUniverseSyncResult> {
    apply_plan_checked(connection, plan, sha, report, &|_| Ok(()))
}

fn apply_plan_checked(
    connection: &Connection,
    plan: NseCurrentUniverseSyncPlan,
    sha: String,
    report: &dyn Fn(IdentityApplyProgress),
    recheck: &dyn Fn(&Connection) -> AppResult<()>,
) -> AppResult<NseCurrentUniverseSyncResult> {
    let total = plan.current_rows.len() + plan.deactivate_symbols.len();
    let mut result = plan_into_result(plan.clone(), true, sha);
    result.run_id = Some(format!(
        "{}-{}",
        chrono::Utc::now().to_rfc3339(),
        &result.plan_sha256[..12]
    ));
    // The receipt and instrument mutations share the same commit/rollback boundary.
    super::super::run_connection_transaction(connection, |connection| {
        recheck(connection)?;
        if plan.activate_count + plan.update_count + plan.deactivate_count == 0 {
            return Err("NSE_NO_ACTIONABLE_CHANGES: Up to date; nothing to apply.".to_string());
        }
        report(progress("applying", 0, total));
        apply_nse_current_universe_sync_plan_with_progress(connection, &plan, &|processed| {
            if processed % 25 == 0 || processed == total {
                report(progress("applying", processed, total));
            }
        })?;
        result.completed_at = Some(chrono::Utc::now().to_rfc3339());
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS identity_apply_runs (
            run_id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, result_json TEXT NOT NULL
        )",
            )
            .map_err(|e| e.to_string())?;
        connection
            .execute(
                "INSERT INTO identity_apply_runs VALUES (?, ?, ?)",
                params![
                    result.run_id,
                    result.completed_at,
                    serde_json::to_string(&result).map_err(|e| e.to_string())?
                ],
            )
            .map_err(|e| e.to_string())?;
        report(progress("committing", total, total));
        Ok(())
    })
    .map_err(|error| {
        // COMMIT can fail (for example, deferred constraints). Leave no open
        // transaction or apparent receipt for callers that retain the connection.
        if !connection.is_autocommit() {
            let _ = connection.execute_batch("ROLLBACK");
        }
        error
    })?;
    report(progress("committed", total, total));
    Ok(result)
}

pub(super) fn read_history(connection: &Connection) -> AppResult<Vec<serde_json::Value>> {
    let exists: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='identity_apply_runs')", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    if !exists {
        return Ok(Vec::new());
    }
    let mut statement = connection.prepare("SELECT result_json FROM identity_apply_runs ORDER BY completed_at DESC, run_id DESC LIMIT 50").map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    })
    .collect()
}

#[tauri::command]
pub async fn list_nse_identity_apply_history(app: AppHandle) -> AppResult<Vec<serde_json::Value>> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder =
            super::super::connection_registry::peek_active_database_folder_read_only(&app)?
                .ok_or("Open a database to read identity apply history.")?;
        let connection = super::super::open_read_only_connection_for_folder(&folder)?;
        read_history(&connection)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn fixture() -> (Connection, NseCurrentUniverseSyncPlan) {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE instruments (
          symbol TEXT, exchange TEXT, isin TEXT, name TEXT, series TEXT,
          is_active INTEGER, lifecycle_status TEXT, updated_at TEXT, UNIQUE(symbol, exchange)
        ); INSERT INTO instruments VALUES ('HELD','NSE',NULL,'Held','EQ',1,'CURRENT','original');",
            )
            .unwrap();
        let rows = (0..51)
            .map(|i| NseSecurityMasterRow {
                symbol: format!("NEW{i}"),
                company_name: Some(format!("New {i}")),
                isin: None,
                series: Some("EQ".into()),
            })
            .collect();
        let existing = vec![ExistingNseInstrumentRow {
            symbol: "HELD".into(),
            name: Some("Held".into()),
            isin: None,
            series: Some("EQ".into()),
            is_active: true,
        }];
        let plan = plan_nse_current_universe_sync_from_rows(
            "fixture".into(),
            51,
            rows,
            existing,
            NseIdentityHistoryHints::default(),
            HashSet::new(),
        );
        (connection, plan)
    }

    #[test]
    fn receipt_and_progress_follow_successful_commit_and_preserve_held_rows() {
        let (connection, plan) = fixture();
        let events = RefCell::new(Vec::new());
        let result = apply_plan(&connection, plan, "a".repeat(64), &|p| {
            events.borrow_mut().push(p)
        })
        .unwrap();
        assert!(result.applied && result.completed_at.is_some());
        let history = read_history(&connection).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0]["runId"], result.run_id.unwrap());
        assert_eq!(history[0]["previewRows"].as_array().unwrap().len(), 52);
        assert_eq!(
            connection
                .query_row(
                    "SELECT updated_at FROM instruments WHERE symbol='HELD'",
                    [],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            "original"
        );
        let events = events.borrow();
        assert_eq!(events.last().unwrap().stage, "committed");
        assert_eq!(events.last().unwrap().percent, Some(100));
        assert!(events
            .iter()
            .filter(|p| p.stage != "committed")
            .all(|p| p.percent.unwrap_or(0) < 100));
        assert_eq!(
            events
                .iter()
                .find(|p| p.stage == "applying" && p.processed == 50)
                .unwrap()
                .total,
            51
        );
    }

    #[test]
    fn receipt_failure_rolls_back_instruments_and_never_reports_completed() {
        let (connection, plan) = fixture();
        connection.execute_batch("CREATE TABLE identity_apply_runs (run_id TEXT PRIMARY KEY, completed_at TEXT, result_json TEXT);
          CREATE TRIGGER reject_receipt BEFORE INSERT ON identity_apply_runs BEGIN SELECT RAISE(ABORT, 'receipt failed'); END;").unwrap();
        let events = RefCell::new(Vec::new());
        assert!(apply_plan(&connection, plan, "b".repeat(64), &|p| events
            .borrow_mut()
            .push(p))
        .is_err());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM instruments", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert!(read_history(&connection).unwrap().is_empty());
        assert!(events.borrow().iter().all(|p| p.percent != Some(100)));
    }

    #[test]
    fn loading_legacy_database_history_does_not_create_tables() {
        let (connection, _) = fixture();
        connection.execute_batch("PRAGMA query_only=ON").unwrap();
        assert!(read_history(&connection).unwrap().is_empty());
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE name='identity_apply_runs'",
                    [],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn commit_failure_rolls_back_and_never_reports_one_hundred_percent() {
        let (connection, plan) = fixture();
        connection.execute_batch("PRAGMA foreign_keys=ON;
          CREATE TABLE receipt_parent (id INTEGER PRIMARY KEY);
          CREATE TABLE receipt_child (id INTEGER REFERENCES receipt_parent(id) DEFERRABLE INITIALLY DEFERRED);
          CREATE TRIGGER fail_at_commit AFTER INSERT ON instruments BEGIN INSERT INTO receipt_child VALUES (999); END;").unwrap();
        let events = RefCell::new(Vec::new());
        assert!(apply_plan(&connection, plan, "c".repeat(64), &|p| events
            .borrow_mut()
            .push(p))
        .is_err());
        assert!(connection.is_autocommit());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM instruments", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert!(read_history(&connection).unwrap().is_empty());
        assert!(events.borrow().iter().any(|p| p.stage == "committing"));
        assert!(events.borrow().iter().all(|p| p.percent != Some(100)));
    }

    #[test]
    fn zero_changes_and_locked_recheck_failure_do_not_write_or_create_receipts() {
        let (connection, mut plan) = fixture();
        let error = apply_plan_checked(&connection, plan.clone(), "d".repeat(64), &|_| {}, &|db| {
            assert!(!db.is_autocommit());
            Err("Reviewed database snapshot changed".into())
        })
        .unwrap_err();
        assert!(error.contains("snapshot changed"));
        plan.activate_count = 0;
        plan.update_count = 0;
        plan.deactivate_count = 0;
        assert!(apply_plan(&connection, plan, "d".repeat(64), &|_| {})
            .unwrap_err()
            .contains("NO_ACTIONABLE"));
        assert!(connection.is_autocommit());
        assert!(read_history(&connection).unwrap().is_empty());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM instruments", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}

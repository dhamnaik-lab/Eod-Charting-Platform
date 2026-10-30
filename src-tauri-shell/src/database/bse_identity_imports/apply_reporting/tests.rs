use super::*;
use std::cell::RefCell;

fn fixture() -> (Connection, BseCurrentUniverseApplyInput) {
    let folder = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tmp")
        .join(format!(
            "bse-reviewed-proof-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
    fs::create_dir_all(&folder).unwrap();
    let path = folder.join("master.csv");
    let mut csv = String::from("Security Code,Security Id,Security Name,Group,ISIN No,Status\n");
    for i in 0..1000 {
        csv.push_str(&format!("{},BSE{i},Company {i},A,,Active\n", 500000 + i));
    }
    csv.push_str("599999,OLDDEL,Old delisted,A,,Delisted\n");
    fs::write(&path, csv).unwrap();
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch("CREATE TABLE instruments (symbol TEXT, exchange TEXT, bse_security_code TEXT,
      isin TEXT, name TEXT, series TEXT, is_active INTEGER, lifecycle_status TEXT, updated_at TEXT,
      PRIMARY KEY(symbol,exchange));
      INSERT INTO instruments VALUES('BSE0','NSE','unrelated','NSE-ISIN','NSE name','EQ',1,'CURRENT','original');
      INSERT INTO instruments VALUES('OLDDEL','BSE','599999',NULL,'Old delisted','A',1,'CURRENT','original');
      CREATE TABLE corporate_actions (evidence TEXT); INSERT INTO corporate_actions VALUES ('untouched');").unwrap();
    let preview = preview_bse_current_universe_sync_internal(
        &db,
        &BseCurrentUniverseSyncInput {
            master_file_path: path.display().to_string(),
        },
    )
    .unwrap();
    (
        db,
        BseCurrentUniverseApplyInput {
            master_file_path: path.display().to_string(),
            expected_plan_sha256: preview.plan_sha256,
            expected_database_path: folder.display().to_string(),
        },
    )
}

#[test]
fn reviewed_bse_commit_receipt_progress_and_unchanged_repeat() {
    let (db, input) = fixture();
    let events = RefCell::new(Vec::new());
    let result = apply_reviewed(&db, &input, &|p| events.borrow_mut().push(p)).unwrap();
    assert!(result.applied);
    assert!(result.completed_at.is_some());
    assert_eq!((result.activate_count, result.deactivate_count), (1000, 1));
    let receipts = read_history(&db).unwrap();
    assert_eq!(receipts.len(), 1);
    assert_eq!(receipts[0]["runId"], result.run_id.unwrap());
    assert_eq!(receipts[0]["masterSha256"], result.master_sha256);
    let e = events.borrow();
    assert_eq!(e.last().unwrap().stage, "committed");
    assert!(e
        .iter()
        .filter(|p| p.stage != "committed")
        .all(|p| p.percent.unwrap_or(0) < 100));
    assert_eq!(
        e.iter().find(|p| p.stage == "committing").unwrap().percent,
        Some(99)
    );
    assert_eq!(
        db.query_row(
            "SELECT name FROM instruments WHERE exchange='NSE'",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "NSE name"
    );
    assert_eq!(
        db.query_row("SELECT evidence FROM corporate_actions", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "untouched"
    );
    // An absent optional source value preserves an existing value via COALESCE.
    db.execute(
        "UPDATE instruments SET isin='retained' WHERE symbol='BSE0' AND exchange='BSE'",
        [],
    )
    .unwrap();
    let preview = preview_bse_current_universe_sync_internal(
        &db,
        &BseCurrentUniverseSyncInput {
            master_file_path: input.master_file_path.clone(),
        },
    )
    .unwrap();
    assert_eq!(
        preview.activate_count + preview.update_count + preview.deactivate_count,
        0
    );
    let retry = BseCurrentUniverseApplyInput {
        expected_plan_sha256: preview.plan_sha256,
        ..input
    };
    let before = db
        .query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
        .unwrap();
    assert!(apply_reviewed(&db, &retry, &|_| {})
        .unwrap_err()
        .contains("NO_ACTIONABLE"));
    assert_eq!(
        db.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        before
    );
    assert_eq!(read_history(&db).unwrap().len(), 1);
}

#[test]
fn source_bytes_or_database_drift_reject_without_writes() {
    for source_change in [true, false] {
        let (db, input) = fixture();
        if source_change {
            let mut bytes = fs::read(&input.master_file_path).unwrap();
            bytes.push(b'\n');
            fs::write(&input.master_file_path, bytes).unwrap();
        } else {
            db.execute(
                "UPDATE instruments SET name='Changed' WHERE exchange='BSE'",
                [],
            )
            .unwrap();
        }
        let before = db
            .query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
            .unwrap();
        assert!(apply_reviewed(&db, &input, &|_| {})
            .unwrap_err()
            .contains("PLAN_STALE"));
        assert_eq!(
            db.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            before
        );
        assert!(db.is_autocommit());
        assert!(read_history(&db).unwrap().is_empty());
    }
}

#[test]
fn receipt_or_commit_failure_rolls_back_and_never_reports_complete() {
    for commit_failure in [false, true] {
        let (db, input) = fixture();
        db.execute_batch("CREATE TABLE bse_identity_apply_runs(run_id TEXT PRIMARY KEY,completed_at TEXT,result_json TEXT);").unwrap();
        if commit_failure {
            db.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE parents(id INTEGER PRIMARY KEY);
                CREATE TABLE deferred_child(parent INTEGER REFERENCES parents(id) DEFERRABLE INITIALLY DEFERRED);
                CREATE TRIGGER reject_commit AFTER INSERT ON bse_identity_apply_runs BEGIN INSERT INTO deferred_child VALUES(42); END;").unwrap();
        } else {
            db.execute_batch("CREATE TRIGGER reject_receipt BEFORE INSERT ON bse_identity_apply_runs BEGIN SELECT RAISE(ABORT,'receipt failed'); END;").unwrap();
        }
        let events = RefCell::new(Vec::new());
        assert!(apply_reviewed(&db, &input, &|p| events.borrow_mut().push(p)).is_err());
        assert!(db.is_autocommit());
        assert!(read_history(&db).unwrap().is_empty());
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM instruments", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            2
        );
        assert!(events.borrow().iter().all(|p| p.percent != Some(100)));
    }
}

#[test]
fn history_read_and_missing_authority_do_not_create_receipts() {
    let (db, mut input) = fixture();
    input.expected_plan_sha256.clear();
    assert!(apply_reviewed(&db, &input, &|_| {})
        .unwrap_err()
        .contains("PLAN_REQUIRED"));
    db.execute_batch("PRAGMA query_only=ON; BEGIN").unwrap();
    let before = db
        .query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
        .unwrap();
    assert!(read_history(&db).unwrap().is_empty());
    assert_eq!(
        db.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        before
    );
    db.execute_batch("ROLLBACK").unwrap();
    assert!(check_database_path(
        Path::new(&input.expected_database_path),
        &input.expected_database_path
    )
    .is_ok());
    assert!(check_database_path(
        Path::new(&input.expected_database_path),
        env!("CARGO_MANIFEST_DIR")
    )
    .is_err());
}

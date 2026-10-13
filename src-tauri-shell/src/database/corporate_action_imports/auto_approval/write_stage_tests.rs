use super::*;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

static FOLDER_COUNTER: AtomicUsize = AtomicUsize::new(0);

fn fixture() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    connection
        .execute_batch(
            "
            CREATE TABLE instruments (
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL,
              isin TEXT,
              name TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              series TEXT,
              sector TEXT,
              industry TEXT
            );
            CREATE TABLE instrument_identity_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange TEXT NOT NULL,
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
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE instrument_isin_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange TEXT NOT NULL,
              symbol TEXT NOT NULL,
              isin TEXT NOT NULL,
              effective_date TEXT,
              source TEXT,
              source_ref TEXT,
              note TEXT,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE corporate_action_imports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              dedupe_key TEXT NOT NULL UNIQUE,
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
            CREATE TABLE corporate_actions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL,
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
              adjust_volume INTEGER,
              note TEXT,
              source TEXT,
              source_ref TEXT,
              created_at TEXT,
              updated_at TEXT,
              applied_at TEXT
            );
            CREATE TABLE eod_prices (
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL,
              date TEXT NOT NULL,
              open REAL NOT NULL,
              high REAL NOT NULL,
              low REAL NOT NULL,
              close REAL NOT NULL,
              prev_close REAL,
              volume INTEGER NOT NULL DEFAULT 0,
              open_interest INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO instruments(symbol, exchange, isin, name, is_active, series)
            VALUES ('TEST', 'NSE', 'INEAUTO01001', 'Test Limited', 1, 'EQ');
            ",
        )
        .unwrap();
    connection
}

fn folder() -> PathBuf {
    let id = FOLDER_COUNTER.fetch_add(1, Ordering::Relaxed);
    let folder = std::env::temp_dir().join(format!(
        "eod-dividend-write-stage-r1-{}-{id}",
        std::process::id()
    ));
    std::fs::create_dir_all(&folder).unwrap();
    folder.canonicalize().unwrap()
}

fn insert_dividend_import(
    connection: &Connection,
    id: i64,
    ex_date: &str,
    purpose: &str,
    cash_amount: f64,
) {
    connection
        .execute(
            "INSERT INTO corporate_action_imports (
               id, dedupe_key, exchange, source, symbol, isin, company_name, purpose_raw, ex_date,
               action_type, cash_amount, parse_status, review_status
             ) VALUES (?, ?, 'NSE', 'NSE_API', 'TEST', 'INEAUTO01001', 'Test Limited', ?, ?,
               'DIVIDEND', ?, 'PARSED', 'PENDING')",
            params![
                id,
                format!("dividend-write-row-{id}"),
                purpose,
                ex_date,
                cash_amount
            ],
        )
        .unwrap();
}

fn insert_exact_official_evidence(
    connection: &Connection,
    import_id: i64,
    purpose: &str,
    ex_date: &str,
) {
    let raw_reference = super::super::build_import_evidence_raw_reference(
        Some("TEST"),
        Some("INEAUTO01001"),
        None,
        Some("Test Limited"),
        purpose,
        Some(ex_date),
        None,
    )
    .unwrap();
    connection
        .execute(
            "INSERT INTO corporate_action_import_evidence(
               import_id, source_code, source_locator, captured_at, symbol_seen, isin_seen,
               company_name_seen, action_type_seen, event_date_seen, factor_seen, raw_reference, note
             ) VALUES (?, 'NSE_API', 'fixture://nse-api', '2026-08-10T10:00:00Z', 'TEST',
               'INEAUTO01001', 'Test Limited', 'DIVIDEND', ?, NULL, ?, 'fixture')",
            params![import_id, ex_date, raw_reference],
        )
        .unwrap();
}

fn insert_previous_close(connection: &Connection, date: &str, close: f64) {
    connection
        .execute(
            "INSERT INTO eod_prices(
               symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest
             ) VALUES ('TEST','NSE',?, ?, ?, ?, ?, NULL, 1000, 0)",
            params![date, close, close, close, close],
        )
        .unwrap();
}

fn insert_eligible(
    connection: &Connection,
    id: i64,
    ex_date: &str,
    previous_date: &str,
    cash_amount: f64,
) {
    let purpose = format!("Interim Dividend - Rs. {cash_amount} per share");
    insert_dividend_import(connection, id, ex_date, &purpose, cash_amount);
    insert_exact_official_evidence(connection, id, &purpose, ex_date);
    insert_previous_close(connection, previous_date, 100.0);
}

fn input(folder: &std::path::Path, import_ids: Vec<i64>) -> SimpleCashDividendWriteStageInput {
    let path = folder.to_string_lossy().to_string();
    let fingerprint = simple_cash_dividend_prepared_scope_fingerprint(&path, &import_ids);
    SimpleCashDividendWriteStageInput {
        import_ids,
        expected_database_path: path,
        expected_policy_version: SIMPLE_CASH_DIVIDEND_POLICY_VERSION.to_string(),
        expected_scope_version: SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION.to_string(),
        expected_write_stage_version: SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION.to_string(),
        expected_scope_fingerprint: fingerprint,
    }
}

fn execute(
    connection: &Connection,
    folder: &std::path::Path,
    import_ids: Vec<i64>,
) -> SimpleCashDividendWriteStageResult {
    execute_simple_cash_dividend_write_stage_in_connection(
        connection,
        folder,
        &input(folder, import_ids),
    )
    .unwrap()
}

fn count(connection: &Connection, table: &str) -> i64 {
    connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .unwrap()
}

fn decision_count(connection: &Connection, import_id: i64) -> i64 {
    connection
        .query_row(
            "SELECT COUNT(*) FROM corporate_action_import_decisions WHERE import_id=? AND decision_type=?",
            params![import_id, SIMPLE_CASH_DIVIDEND_DECISION_TYPE],
            |row| row.get(0),
        )
        .unwrap()
}

fn real_writer(
    connection: &Connection,
    folder: &std::path::Path,
    import_id: i64,
) -> AppResult<CorporateActionImportApprovalResult> {
    approve_corporate_action_import_without_transaction(connection, folder, import_id, false, false)
}

fn real_audit(
    connection: &Connection,
    previous: &CorporateActionImportRow,
    resolved: &CorporateActionImportRow,
    reason: &str,
) -> AppResult<()> {
    record_corporate_action_import_decision(
        connection,
        previous,
        resolved,
        SIMPLE_CASH_DIVIDEND_DECISION_TYPE,
        reason,
    )
}

fn success_fixture() -> (Connection, PathBuf) {
    let connection = fixture();
    insert_eligible(&connection, 1, "2026-08-14", "2026-08-13", 5.0);
    (connection, folder())
}

#[test]
fn p4a_01_exact_current_simple_cash_dividend_auto_approves_once() {
    let (connection, folder) = success_fixture();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.requested, 1);
    assert_eq!(result.revalidated_eligible, 1);
    assert_eq!(result.auto_approved, 1);
    assert_eq!(result.failed, 0);
    assert_eq!(result.dispositions[0].disposition, "AUTO_APPROVED");
}

#[test]
fn p4a_02_success_creates_exactly_one_canonical_action() {
    let (connection, folder) = success_fixture();
    execute(&connection, &folder, vec![1]);
    assert_eq!(count(&connection, "corporate_actions"), 1);
}

#[test]
fn p4a_03_success_links_import_to_exact_canonical_id() {
    let (connection, folder) = success_fixture();
    let result = execute(&connection, &folder, vec![1]);
    let canonical_id = result.dispositions[0].corporate_action_id.unwrap();
    let row = get_import_row(&connection, 1).unwrap();
    assert_eq!(row.review_status, "APPROVED");
    assert_eq!(row.approved_corporate_action_id, Some(canonical_id));
}

#[test]
fn p4a_04_success_writes_exactly_one_autonomous_decision() {
    let (connection, folder) = success_fixture();
    execute(&connection, &folder, vec![1]);
    assert_eq!(decision_count(&connection, 1), 1);
}

#[test]
fn p4a_05_audit_reason_binds_all_required_frozen_evidence_fields() {
    let (connection, folder) = success_fixture();
    let result = execute(&connection, &folder, vec![1]);
    let reason: String = connection
        .query_row(
            "SELECT reason FROM corporate_action_import_decisions WHERE import_id=1 AND decision_type=?",
            params![SIMPLE_CASH_DIVIDEND_DECISION_TYPE],
            |row| row.get(0),
        )
        .unwrap();
    for token in [
        "policy=AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1",
        "writeStageVersion=CA_DIVIDEND_WRITE_STAGE_R1",
        "preparedScopeVersion=CA_DIVIDEND_PREPARED_SCOPE_R1",
        "scopeFingerprint=",
        "importId=1",
        "databaseContext=",
        "exchange=NSE",
        "symbol=TEST",
        "isin=INEAUTO01001",
        "actionType=DIVIDEND",
        "exDate=2026-08-14",
        "cashAmount=5.000000000000",
        "identityProof=EXACT_ACTIVE_CURRENT_IDENTITY",
        "officialEvidenceId=1",
        "evidenceCapturedAt=2026-08-10T10:00:00Z",
        "sourceLocator=fixture://nse-api",
        "previousTradeDate=2026-08-13",
        "previousClose=100.000000000000",
        "computedFactor=1.052631578947",
        "canonicalCorporateActionId=",
    ] {
        assert!(reason.contains(token), "{token}");
    }
    assert_eq!(result.dispositions[0].reason, reason);
}

#[test]
fn p4a_06_success_does_not_rewrite_raw_eod_prices() {
    let (connection, folder) = success_fixture();
    let before: (i64, f64, f64, f64, f64) = connection
        .query_row(
            "SELECT COUNT(*), MIN(open), MIN(high), MIN(low), MIN(close) FROM eod_prices",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .unwrap();
    execute(&connection, &folder, vec![1]);
    let after: (i64, f64, f64, f64, f64) = connection
        .query_row(
            "SELECT COUNT(*), MIN(open), MIN(high), MIN(low), MIN(close) FROM eod_prices",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(before, after);
}

#[test]
fn p4a_07_executor_reuses_existing_ordinary_writer_and_never_inserts_canonical_directly() {
    let source = include_str!("../auto_approval.rs");
    let start = source
        .find("pub(super) fn execute_simple_cash_dividend_write_stage_in_connection")
        .unwrap();
    let end = source[start..]
        .find("const AUTO_APPROVAL_NEAR_UNITY_MARGIN")
        .map(|offset| start + offset)
        .unwrap();
    let body = &source[start..end];
    assert!(body.contains("approve_corporate_action_import_without_transaction"));
    assert!(!body.contains("INSERT INTO corporate_actions"));
    assert!(!body.contains("apply_corporate_action_internal"));
}

#[test]
fn p4a_08_repeated_success_is_already_approved_without_second_action_or_audit() {
    let (connection, folder) = success_fixture();
    let first = execute(&connection, &folder, vec![1]);
    assert_eq!(first.auto_approved, 1);
    let second = execute(&connection, &folder, vec![1]);
    assert_eq!(second.already_approved, 1);
    assert_eq!(second.dispositions[0].disposition, "ALREADY_APPROVED");
    assert_eq!(count(&connection, "corporate_actions"), 1);
    assert_eq!(decision_count(&connection, 1), 1);
}

#[test]
fn p4a_09_bse_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET exchange='BSE' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.dispositions[0].disposition, "INELIGIBLE");
}

#[test]
fn p4a_10_non_nse_api_source_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0].reason.contains("NSE_API"));
}

#[test]
fn p4a_11_non_dividend_is_stale_scope() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET action_type='RIGHTS' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.stale_scope, 1);
    assert_eq!(result.dispositions[0].disposition, "STALE_SCOPE");
}

#[test]
fn p4a_12_non_parsed_is_stale_scope() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET parse_status='NEEDS_REVIEW' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.stale_scope, 1);
}

#[test]
fn p4a_13_non_pending_is_stale_scope() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET review_status='UNRESOLVED' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.stale_scope, 1);
}

#[test]
fn p4a_14_deleted_row_is_missing() {
    let (connection, folder) = success_fixture();
    connection
        .execute("DELETE FROM corporate_action_imports WHERE id=1", [])
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.missing, 1);
    assert_eq!(result.dispositions[0].disposition, "MISSING");
}

#[test]
fn p4a_15_classifier_mismatch_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection.execute("UPDATE corporate_action_imports SET purpose_raw='Special Dividend Rs 5 per share' WHERE id=1", []).unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0].reason.contains("classifier"));
}

#[test]
fn p4a_16_missing_or_duplicate_official_witness_is_ineligible() {
    for duplicate in [false, true] {
        let (connection, folder) = success_fixture();
        if duplicate {
            let raw: String = connection
                .query_row(
                    "SELECT raw_reference FROM corporate_action_import_evidence WHERE import_id=1",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            connection.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,factor_seen,raw_reference,note) VALUES(1,'NSE_API','fixture://duplicate','2026-08-10T11:00:00Z','TEST','INEAUTO01001','Test Limited','DIVIDEND','2026-08-14',NULL,?,'duplicate')",params![raw]).unwrap();
        } else {
            connection
                .execute(
                    "DELETE FROM corporate_action_import_evidence WHERE import_id=1",
                    [],
                )
                .unwrap();
        }
        let result = execute(&connection, &folder, vec![1]);
        assert_eq!(result.ineligible, 1);
        assert!(result.dispositions[0]
            .reason
            .contains("exactly one exact persisted NSE_API"));
    }
}

#[test]
fn p4a_17_forbidden_manual_or_exception_provenance_is_ineligible() {
    for decision_type in FORBIDDEN_DECISION_TYPES {
        let (connection, folder) = success_fixture();
        connection.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES(1,?,'fixture')",params![decision_type]).unwrap();
        let result = execute(&connection, &folder, vec![1]);
        assert_eq!(result.ineligible, 1);
    }
}

#[test]
fn p4a_18_stale_machine_identity_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET isin='INEHIST01001' WHERE id=1",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0]
        .reason
        .contains("machine-proven identity"));
}

#[test]
fn p4a_19_same_date_automatic_peer_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection.execute("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,ratio_num,ratio_den,factor,price_factor,parse_status,review_status) VALUES(2,'peer','NSE','NSE_API','TEST','INEAUTO01001','Test Limited','Split fixture','2026-08-14','SPLIT',2,1,2,0.5,'PARSED','PENDING')",[]).unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0].reason.contains("Same-date"));
}

#[test]
fn p4a_20_matching_canonical_action_is_ineligible_never_linked_existing() {
    let (connection, folder) = success_fixture();
    connection.execute("INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,cash_amount,adjust_volume) VALUES('TEST','NSE','INEAUTO01001','2026-08-14','DIVIDEND',1.0526315789473684,5,0)",[]).unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.auto_approved, 0);
    assert!(result
        .dispositions
        .iter()
        .all(|item| item.disposition != "LINKED_EXISTING"));
}

#[test]
fn p4a_21_missing_previous_close_basis_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection.execute("DELETE FROM eod_prices", []).unwrap();
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0]
        .reason
        .contains("previous-close basis"));
}

#[test]
fn p4a_22_previous_trade_date_over_seven_days_is_ineligible() {
    let (connection, folder) = success_fixture();
    connection.execute("DELETE FROM eod_prices", []).unwrap();
    insert_previous_close(&connection, "2026-08-06", 100.0);
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0].reason.contains("7 calendar days"));
}

#[test]
fn p4a_23_cash_not_smaller_than_previous_close_is_ineligible() {
    let connection = fixture();
    let folder = folder();
    insert_eligible(&connection, 1, "2026-08-14", "2026-08-13", 100.0);
    let result = execute(&connection, &folder, vec![1]);
    assert_eq!(result.ineligible, 1);
    assert!(result.dispositions[0]
        .reason
        .contains("previous-close basis"));
}

#[test]
fn p4a_24_policy_version_mismatch_is_command_error_before_write() {
    let (connection, folder) = success_fixture();
    let mut request = input(&folder, vec![1]);
    request.expected_policy_version = "WRONG".to_string();
    assert!(
        execute_simple_cash_dividend_write_stage_in_connection(&connection, &folder, &request)
            .is_err()
    );
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_25_scope_version_mismatch_is_command_error_before_write() {
    let (connection, folder) = success_fixture();
    let mut request = input(&folder, vec![1]);
    request.expected_scope_version = "WRONG".to_string();
    assert!(
        execute_simple_cash_dividend_write_stage_in_connection(&connection, &folder, &request)
            .is_err()
    );
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_26_write_stage_version_mismatch_is_command_error_before_write() {
    let (connection, folder) = success_fixture();
    let mut request = input(&folder, vec![1]);
    request.expected_write_stage_version = "WRONG".to_string();
    assert!(
        execute_simple_cash_dividend_write_stage_in_connection(&connection, &folder, &request)
            .is_err()
    );
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_27_scope_fingerprint_mismatch_is_command_error_before_write() {
    let (connection, folder) = success_fixture();
    let mut request = input(&folder, vec![1]);
    request.expected_scope_fingerprint = "WRONG".to_string();
    assert!(
        execute_simple_cash_dividend_write_stage_in_connection(&connection, &folder, &request)
            .is_err()
    );
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_28_database_path_mismatch_is_command_error_before_write() {
    let (connection, current_folder) = success_fixture();
    let other = folder();
    let mut request = input(&current_folder, vec![1]);
    request.expected_database_path = other.to_string_lossy().to_string();
    assert!(execute_simple_cash_dividend_write_stage_in_connection(
        &connection,
        &current_folder,
        &request,
    )
    .is_err());
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_29_invalid_duplicate_or_unsafe_ids_are_command_errors_before_write() {
    let (connection, folder) = success_fixture();
    for ids in [
        vec![],
        vec![1, 1],
        vec![0],
        vec![-1],
        vec![9_007_199_254_740_992_i64],
    ] {
        let mut request = input(&folder, vec![1]);
        request.import_ids = ids;
        assert!(execute_simple_cash_dividend_write_stage_in_connection(
            &connection,
            &folder,
            &request
        )
        .is_err());
    }
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_30_more_than_100_ids_is_command_error_before_write() {
    let (connection, folder) = success_fixture();
    let ids = (1_i64..=101_i64).collect::<Vec<_>>();
    let mut request = input(&folder, vec![1]);
    request.import_ids = ids;
    assert!(
        execute_simple_cash_dividend_write_stage_in_connection(&connection, &folder, &request)
            .is_err()
    );
    assert_eq!(count(&connection, "corporate_actions"), 0);
}

#[test]
fn p4a_31_unexpected_linked_existing_writer_result_rolls_back_and_fails() {
    let (connection, folder) = success_fixture();
    let request = input(&folder, vec![1]);
    let result = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        |connection, folder, id| {
            let mut result = real_writer(connection, folder, id)?;
            result.approved_record = None;
            result.message = "Import linked to an existing approved corporate action.".to_string();
            Ok(result)
        },
        real_audit,
    )
    .unwrap();
    assert_eq!(result.failed, 1);
    assert_eq!(count(&connection, "corporate_actions"), 0);
    assert_eq!(
        get_import_row(&connection, 1).unwrap().review_status,
        "PENDING"
    );
    assert_eq!(decision_count(&connection, 1), 0);
}

#[test]
fn p4a_32_writer_factor_mismatch_rolls_back_and_fails() {
    let (connection, folder) = success_fixture();
    let request = input(&folder, vec![1]);
    let result = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        |connection, folder, id| {
            let mut result = real_writer(connection, folder, id)?;
            if let Some(approved) = result.approved_record.as_mut() {
                approved.factor = approved.factor.map(|value| value + 0.01);
            }
            Ok(result)
        },
        real_audit,
    )
    .unwrap();
    assert_eq!(result.failed, 1);
    assert!(result.dispositions[0].reason.contains("writer factor"));
    assert_eq!(count(&connection, "corporate_actions"), 0);
    assert_eq!(decision_count(&connection, 1), 0);
}

#[test]
fn p4a_33_audit_failure_rolls_back_canonical_and_import_item() {
    let (connection, folder) = success_fixture();
    let request = input(&folder, vec![1]);
    let result = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        real_writer,
        |_connection, _previous, _resolved, _reason| Err("fixture audit failure".to_string()),
    )
    .unwrap();
    assert_eq!(result.failed, 1);
    assert_eq!(count(&connection, "corporate_actions"), 0);
    let row = get_import_row(&connection, 1).unwrap();
    assert_eq!(row.review_status, "PENDING");
    assert_eq!(row.approved_corporate_action_id, None);
    assert_eq!(decision_count(&connection, 1), 0);
}

#[test]
fn p4a_34_one_item_failure_does_not_corrupt_another_successful_item() {
    let connection = fixture();
    let folder = folder();
    insert_eligible(&connection, 1, "2026-08-14", "2026-08-13", 5.0);
    insert_eligible(&connection, 2, "2026-08-16", "2026-08-15", 4.0);
    let request = input(&folder, vec![2, 1]);
    let result = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        |connection, folder, id| {
            let mut result = real_writer(connection, folder, id)?;
            if id == 1 {
                if let Some(approved) = result.approved_record.as_mut() {
                    approved.factor = approved.factor.map(|value| value + 0.01);
                }
            }
            Ok(result)
        },
        real_audit,
    )
    .unwrap();
    assert_eq!(result.failed, 1);
    assert_eq!(result.auto_approved, 1);
    assert_eq!(count(&connection, "corporate_actions"), 1);
    assert_eq!(
        get_import_row(&connection, 1).unwrap().review_status,
        "PENDING"
    );
    assert_eq!(
        get_import_row(&connection, 2).unwrap().review_status,
        "APPROVED"
    );
    assert_eq!(decision_count(&connection, 1), 0);
    assert_eq!(decision_count(&connection, 2), 1);
}

#[test]
fn p4a_35_nonwritten_and_failed_rows_create_no_autonomous_decision_audit() {
    let connection = fixture();
    let folder = folder();
    insert_eligible(&connection, 1, "2026-08-14", "2026-08-13", 5.0);
    connection
        .execute(
            "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
            [],
        )
        .unwrap();
    insert_eligible(&connection, 2, "2026-08-16", "2026-08-15", 4.0);
    connection.execute("UPDATE corporate_action_imports SET review_status='APPROVED', approved_corporate_action_id=77 WHERE id=2", []).unwrap();
    insert_eligible(&connection, 4, "2026-08-18", "2026-08-17", 3.0);
    let request = input(&folder, vec![1, 2, 3, 4]);
    let result = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        real_writer,
        |_connection, previous, _resolved, _reason| {
            if previous.id == 4 {
                Err("fixture audit failure".to_string())
            } else {
                Ok(())
            }
        },
    )
    .unwrap();
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.already_approved, 1);
    assert_eq!(result.missing, 1);
    assert_eq!(result.failed, 1);
    for id in [1_i64, 2, 3, 4] {
        assert_eq!(decision_count(&connection, id), 0, "{id}");
    }
}

#[test]
fn p4a_36_counts_dispositions_and_ids_are_deterministic_and_exact() {
    let connection = fixture();
    let folder = folder();
    insert_eligible(&connection, 1, "2026-08-14", "2026-08-13", 5.0);
    connection
        .execute(
            "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
            [],
        )
        .unwrap();
    insert_eligible(&connection, 2, "2026-08-16", "2026-08-15", 4.0);
    connection.execute("UPDATE corporate_action_imports SET review_status='APPROVED', approved_corporate_action_id=77 WHERE id=2", []).unwrap();
    insert_eligible(&connection, 4, "2026-08-18", "2026-08-17", 3.0);
    connection
        .execute(
            "UPDATE corporate_action_imports SET parse_status='NEEDS_REVIEW' WHERE id=4",
            [],
        )
        .unwrap();
    let result = execute(&connection, &folder, vec![4, 99, 2, 1]);
    assert_eq!(result.requested, 4);
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.already_approved, 1);
    assert_eq!(result.stale_scope, 1);
    assert_eq!(result.missing, 1);
    assert_eq!(result.failed, 0);
    assert!(result.complete);
    assert_eq!(
        result
            .dispositions
            .iter()
            .map(|item| item.import_id)
            .collect::<Vec<_>>(),
        vec![1, 2, 4, 99]
    );
    assert_eq!(
        result
            .dispositions
            .iter()
            .map(|item| item.disposition.as_str())
            .collect::<Vec<_>>(),
        vec!["INELIGIBLE", "ALREADY_APPROVED", "STALE_SCOPE", "MISSING"]
    );
}

#[test]
fn p4a_37_complete_is_false_only_when_operational_item_failure_count_is_nonzero() {
    let (connection, folder) = success_fixture();
    connection
        .execute(
            "UPDATE corporate_action_imports SET source='NSE_CSV' WHERE id=1",
            [],
        )
        .unwrap();
    let complete = execute(&connection, &folder, vec![1]);
    assert_eq!(complete.failed, 0);
    assert!(complete.complete);

    let (connection, folder) = success_fixture();
    let request = input(&folder, vec![1]);
    let failed = execute_simple_cash_dividend_write_stage_with_ops(
        &connection,
        &folder,
        &request,
        real_writer,
        |_connection, _previous, _resolved, _reason| Err("fixture audit failure".to_string()),
    )
    .unwrap();
    assert_eq!(failed.failed, 1);
    assert!(!failed.complete);
}

#[test]
fn p4a_38_private_write_input_accepts_scope_protocol_only_not_frontend_p3c_evidence() {
    let source = include_str!("../auto_approval.rs");
    let start = source
        .find("pub(super) struct SimpleCashDividendWriteStageInput")
        .unwrap();
    let end = source[start..].find("}\n\n#[derive").unwrap() + start;
    let input_source = &source[start..=end];
    for required in [
        "import_ids",
        "expected_database_path",
        "expected_policy_version",
        "expected_scope_version",
        "expected_write_stage_version",
        "expected_scope_fingerprint",
    ] {
        assert!(input_source.contains(required), "{required}");
    }
    for forbidden in [
        "eligibility",
        "previous_close",
        "computed_factor",
        "identity_proof",
        "official_evidence_id",
        "source_locator",
        "p3c",
    ] {
        assert!(!input_source.contains(forbidden), "{forbidden}");
    }
}

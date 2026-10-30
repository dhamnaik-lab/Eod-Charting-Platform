use super::*;
use rusqlite::Connection;
use std::cell::Cell;
use std::path::Path;

fn p4b_input(database_path: &str) -> auto_approval::SimpleCashDividendWriteStageInput {
    auto_approval::SimpleCashDividendWriteStageInput {
        import_ids: vec![1],
        expected_database_path: database_path.to_string(),
        expected_policy_version: "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1".to_string(),
        expected_scope_version: "CA_DIVIDEND_PREPARED_SCOPE_R1".to_string(),
        expected_write_stage_version: auto_approval::SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION
            .to_string(),
        expected_scope_fingerprint: "p4b-synthetic-scope".to_string(),
    }
}

fn p4b_result(
    auto_approved: u32,
    ineligible: u32,
    already_approved: u32,
    stale_scope: u32,
    missing: u32,
    failed: u32,
    complete: bool,
) -> auto_approval::SimpleCashDividendWriteStageResult {
    auto_approval::SimpleCashDividendWriteStageResult {
        requested: auto_approved + ineligible + already_approved + stale_scope + missing + failed,
        revalidated_eligible: auto_approved + failed,
        auto_approved,
        ineligible,
        already_approved,
        stale_scope,
        missing,
        failed,
        dispositions: Vec::new(),
        policy_version: "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1".to_string(),
        scope_version: "CA_DIVIDEND_PREPARED_SCOPE_R1".to_string(),
        write_stage_version: auto_approval::SIMPLE_CASH_DIVIDEND_WRITE_STAGE_VERSION.to_string(),
        scope_fingerprint: "p4b-synthetic-scope".to_string(),
        complete,
        message: "synthetic P4B result".to_string(),
    }
}

fn p4b_connection() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    connection
        .execute_batch("CREATE TABLE p4b_probe (id INTEGER PRIMARY KEY);")
        .unwrap();
    connection
}

fn p4b_probe_count(connection: &Connection) -> i64 {
    connection
        .query_row("SELECT COUNT(*) FROM p4b_probe", [], |row| row.get(0))
        .unwrap()
}

fn p4b_source_between<'a>(source: &'a str, start: &str, end: &str) -> &'a str {
    let start_index = source
        .find(start)
        .unwrap_or_else(|| panic!("missing start marker: {start}"));
    let tail = &source[start_index..];
    let end_offset = tail
        .find(end)
        .unwrap_or_else(|| panic!("missing end marker: {end}"));
    &tail[..end_offset]
}

fn p4b_owner_source() -> &'static str {
    include_str!("../corporate_action_imports.rs")
}

#[test]
fn p4b_01_success_commits_and_returns_exact_result() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let expected = p4b_result(1, 0, 0, 0, 0, 0, true);
    let actual = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            Ok(expected.clone())
        },
    )
    .unwrap();
    assert_eq!(actual, expected);
    assert_eq!(p4b_probe_count(&connection), 1);
}

#[test]
fn p4b_02_executor_runs_inside_exact_outer_transaction() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    assert!(connection.is_autocommit());
    let actual = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            assert!(!connection.is_autocommit());
            Ok(p4b_result(0, 1, 0, 0, 0, 0, true))
        },
    )
    .unwrap();
    assert_eq!(actual.ineligible, 1);
    assert!(connection.is_autocommit());
}

#[test]
fn p4b_03_executor_is_invoked_exactly_once() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let calls = Cell::new(0_u32);
    run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |_, _, _| {
            calls.set(calls.get() + 1);
            Ok(p4b_result(0, 1, 0, 0, 0, 0, true))
        },
    )
    .unwrap();
    assert_eq!(calls.get(), 1);
}

#[test]
fn p4b_04_direct_executor_error_rolls_back_whole_transaction() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            Err("P4B synthetic executor failure".to_string())
        },
    )
    .unwrap_err();
    assert!(error.contains("P4B synthetic executor failure"));
    assert_eq!(p4b_probe_count(&connection), 0);
    assert!(connection.is_autocommit());
}

#[test]
fn p4b_05_failed_item_rolls_back_earlier_success() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            connection.execute_batch("CREATE TABLE corporate_action_imports (id INTEGER, symbol TEXT); INSERT INTO corporate_action_imports VALUES(44,'HEGAM');").unwrap();
            let mut result = p4b_result(1, 0, 0, 0, 0, 1, false);
            result.dispositions.push(auto_approval::SimpleCashDividendWriteStageDisposition {
                import_id: 44, disposition: "FAILED".into(), reason: "Missing dated EOD window".into(), corporate_action_id: None,
            });
            Ok(result)
        },
    )
    .unwrap_err();
    assert!(error.contains("refused commit"));
    assert!(error.contains("failed=1"));
    assert!(error.starts_with("CA_DIVIDEND_ROLLBACK_CONFIRMED: "));
    assert!(error.contains("import 44 (HEGAM): Missing dated EOD window"));
    assert_eq!(p4b_probe_count(&connection), 0);
}

#[test]
fn p4b_06_incomplete_without_failed_count_fails_closed_and_rolls_back() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            Ok(p4b_result(1, 0, 0, 0, 0, 0, false))
        },
    )
    .unwrap_err();
    assert!(error.contains("complete=false"));
    assert_eq!(p4b_probe_count(&connection), 0);
}

#[test]
fn p4b_07_complete_true_with_failed_count_fails_closed_and_rolls_back() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            Ok(p4b_result(1, 0, 0, 0, 0, 1, true))
        },
    )
    .unwrap_err();
    assert!(error.contains("failed=1"));
    assert_eq!(p4b_probe_count(&connection), 0);
}

#[test]
fn p4b_08_zero_write_ineligible_batch_commits_cleanly() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let result = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |_, _, _| Ok(p4b_result(0, 1, 0, 0, 0, 0, true)),
    )
    .unwrap();
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.failed, 0);
    assert!(result.complete);
    assert_eq!(p4b_probe_count(&connection), 0);
}

#[test]
fn p4b_09_mixed_nonfailed_dispositions_allow_successful_write_commit() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let result = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |connection, _, _| {
            connection
                .execute("INSERT INTO p4b_probe(id) VALUES (1)", [])
                .unwrap();
            Ok(p4b_result(1, 1, 1, 1, 1, 0, true))
        },
    )
    .unwrap();
    assert_eq!(result.auto_approved, 1);
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.already_approved, 1);
    assert_eq!(result.stale_scope, 1);
    assert_eq!(result.missing, 1);
    assert_eq!(p4b_probe_count(&connection), 1);
}

#[test]
fn p4b_10_lock_contention_fails_before_writable_open() {
    let _permit =
        try_acquire_price_store_operation(PriceStoreOperationKind::CorporateActionAutomatic)
            .unwrap();
    let input = p4b_input("Z:\\p4b-must-not-open");
    let error = execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(
        Path::new("Z:\\p4b-must-not-open"),
        &input,
    )
    .unwrap_err();
    assert!(error.contains("PRICE_STORE_OPERATION_BUSY"));
}

#[test]
fn p4b_11_source_writable_open_precedes_outer_transaction_dispatch() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(",
        "async fn execute_simple_cash_dividend_write_stage_transaction_owner(",
    );
    let open = body
        .find("open_connection_for_folder(folder_path, false)")
        .unwrap();
    let transaction = body
        .find("run_simple_cash_dividend_write_stage_outer_transaction(&connection")
        .unwrap();
    assert!(open < transaction);
}

#[test]
fn p4b_12_owner_input_rejects_database_path_mismatch_before_spawn() {
    let input = p4b_input("E:\\expected-db");
    let expected_error =
        verify_import_lookup_database(Path::new("E:\\current-db"), &input.expected_database_path)
            .unwrap_err();
    let error = validate_simple_cash_dividend_write_stage_transaction_owner(
        Path::new("E:\\current-db"),
        &input,
    )
    .unwrap_err();
    assert_eq!(error, expected_error);
}

#[test]
fn p4b_13_owner_input_rejects_empty_id_scope() {
    let mut input = p4b_input("E:\\p4b");
    input.import_ids.clear();
    let error =
        validate_simple_cash_dividend_write_stage_transaction_owner(Path::new("E:\\p4b"), &input)
            .unwrap_err();
    assert!(!error.trim().is_empty());
}

#[test]
fn p4b_14_source_acquires_automatic_lock_exactly_once_before_writable_open() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(",
        "async fn execute_simple_cash_dividend_write_stage_transaction_owner(",
    );
    assert_eq!(
        body.matches("try_acquire_price_store_operation(").count(),
        1
    );
    assert_eq!(
        body.matches("PriceStoreOperationKind::CorporateActionAutomatic")
            .count(),
        1
    );
    assert_eq!(
        body.matches("open_connection_for_folder(folder_path, false)")
            .count(),
        1
    );
    assert!(
        body.find("try_acquire_price_store_operation").unwrap()
            < body.find("open_connection_for_folder").unwrap()
    );
}

#[test]
fn p4b_15_source_outer_transaction_occurs_exactly_once() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn run_simple_cash_dividend_write_stage_outer_transaction_with_executor",
        "fn run_simple_cash_dividend_write_stage_outer_transaction(",
    );
    assert_eq!(body.matches("BEGIN IMMEDIATE TRANSACTION").count(), 1);
    assert_eq!(body.matches("execute_batch(\"COMMIT\")").count(), 1);
}

#[test]
fn dividend_owner_never_confirms_a_failed_rollback() {
    let connection = p4b_connection();
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection, Path::new("E:\\p4b"), &p4b_input("E:\\p4b"),
        |connection, _, _| {
            connection.execute_batch("ROLLBACK").unwrap();
            Err("synthetic transaction ended unexpectedly".into())
        },
    ).unwrap_err();
    assert!(error.starts_with("Dividend rollback unconfirmed:"));
    assert!(!error.contains("CA_DIVIDEND_ROLLBACK_CONFIRMED"));
}

#[test]
fn dividend_owner_never_labels_commit_error_as_confirmed_rollback() {
    let connection = p4b_connection();
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection, Path::new("E:\\p4b"), &p4b_input("E:\\p4b"),
        |connection, _, _| {
            connection.execute_batch("ROLLBACK").unwrap();
            Ok(p4b_result(1, 0, 0, 0, 0, 0, true))
        },
    ).unwrap_err();
    assert!(error.contains("commit outcome requires reconciliation"));
    assert!(!error.contains("CA_DIVIDEND_ROLLBACK_CONFIRMED"));
}

#[test]
fn p4b_16_source_production_wrapper_invokes_p4a_exactly_once() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn run_simple_cash_dividend_write_stage_outer_transaction(",
        "fn execute_simple_cash_dividend_write_stage_transaction_owner_for_folder(",
    );
    assert_eq!(
        body.matches("auto_approval::execute_simple_cash_dividend_write_stage_in_connection(")
            .count(),
        1
    );
}

#[test]
fn p4b_17_source_owner_validates_path_before_blocking_write_dispatch() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "async fn execute_simple_cash_dividend_write_stage_transaction_owner(",
        "#[tauri::command]\npub async fn auto_approve_corporate_action_imports(",
    );
    assert!(
        body.find("resolve_active_database_folder").unwrap()
            < body
                .find("validate_simple_cash_dividend_write_stage_transaction_owner")
                .unwrap()
    );
    assert!(
        body.find("validate_simple_cash_dividend_write_stage_transaction_owner")
            .unwrap()
            < body.find("spawn_blocking").unwrap()
    );
}

#[test]
fn p4b_18_source_p4b_has_no_direct_canonical_writer_or_sql() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn validate_simple_cash_dividend_write_stage_transaction_owner(",
        "#[tauri::command]\npub async fn auto_approve_corporate_action_imports(",
    );
    for forbidden in [
        "INSERT INTO corporate_actions",
        "UPDATE corporate_actions",
        "INSERT INTO corporate_action_imports",
        "UPDATE corporate_action_imports",
        "apply_corporate_action_internal",
        "record_corporate_action_import_decision",
    ] {
        assert!(
            !body.contains(forbidden),
            "forbidden P4B mutation token: {forbidden}"
        );
    }
}

#[test]
fn p4b_19_source_p4a_inner_executor_does_not_reacquire_global_lock() {
    let source = include_str!("auto_approval.rs");
    assert!(source.contains("execute_simple_cash_dividend_write_stage_in_connection"));
    assert!(!source.contains("try_acquire_price_store_operation"));
}

#[test]
fn p4b_20_private_owner_is_not_a_tauri_command() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "async fn execute_simple_cash_dividend_write_stage_transaction_owner(",
        "#[tauri::command]\npub async fn auto_approve_corporate_action_imports(",
    );
    assert!(!body.contains("#[tauri::command]"));
}

#[test]
fn p4b_21_private_owner_is_not_registered_in_main() {
    let main = include_str!("../../main.rs");
    assert!(!main.contains("execute_simple_cash_dividend_write_stage_transaction_owner"));
}

#[test]
fn p4b_22_existing_safe_v2_command_owner_remains_on_existing_path() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "pub async fn auto_approve_corporate_action_imports(",
        "#[tauri::command]\npub async fn approve_recommended_corporate_action_isin_mismatches(",
    );
    assert!(body.contains("PriceStoreOperationKind::CorporateActionAutomatic"));
    assert!(body.contains("auto_approval::auto_approve_corporate_action_imports_in_connection("));
    assert!(!body.contains("execute_simple_cash_dividend_write_stage_transaction_owner"));
}

#[test]
fn p4b_23_existing_manual_apply_command_does_not_gain_automatic_lock() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "pub async fn approve_corporate_action_import(\n",
        "#[tauri::command]\npub async fn approve_corporate_action_import_with_isin_mismatch(",
    );
    assert!(!body.contains("try_acquire_price_store_operation"));
    assert!(!body.contains("PriceStoreOperationKind::CorporateActionAutomatic"));
}

#[test]
fn p4b_24_source_owner_preserves_lock_connection_and_executor_seams() {
    let source = p4b_owner_source();
    let body = p4b_source_between(
        source,
        "fn validate_simple_cash_dividend_write_stage_transaction_owner(",
        "#[tauri::command]\npub async fn auto_approve_corporate_action_imports(",
    );
    for required in [
        "try_acquire_price_store_operation",
        "PriceStoreOperationKind::CorporateActionAutomatic",
        "open_connection_for_folder",
        "BEGIN IMMEDIATE TRANSACTION",
        "execute_batch(\"ROLLBACK\")",
        "execute_simple_cash_dividend_write_stage_in_connection",
    ] {
        assert!(
            body.contains(required),
            "missing P4B orchestration seam: {required}"
        );
    }
}

#[test]
fn p4b_25_transaction_failure_error_contract_is_deterministic() {
    let connection = p4b_connection();
    let input = p4b_input("E:\\p4b");
    let error = run_simple_cash_dividend_write_stage_outer_transaction_with_executor(
        &connection,
        Path::new("E:\\p4b"),
        &input,
        |_, _, _| Ok(p4b_result(0, 0, 0, 0, 0, 1, false)),
    )
    .unwrap_err();
    assert_eq!(
        error,
        "CA_DIVIDEND_ROLLBACK_CONFIRMED: Dividend write-stage R1 transaction owner refused commit: failed=1 complete=false."
    );
}

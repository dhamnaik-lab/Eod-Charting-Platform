use super::*;

fn bridge_source_between<'a>(source: &'a str, start: &str, end: &str) -> &'a str {
    let start_index = source
        .find(start)
        .unwrap_or_else(|| panic!("missing start marker: {start}"));
    let tail = &source[start_index..];
    let end_offset = tail
        .find(end)
        .unwrap_or_else(|| panic!("missing end marker: {end}"));
    &tail[..end_offset]
}

fn bridge_source() -> &'static str {
    // Markers use `\n`; a Windows checkout may store the source with CRLF.
    static SOURCE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    SOURCE.get_or_init(|| include_str!("../corporate_action_imports.rs").replace("\r\n", "\n"))
}

#[test]
fn write_stage_bridge_01_input_deserializes_six_fields() {
    let input: CorporateActionDividendWriteStageInput = serde_json::from_value(serde_json::json!({
        "importIds": [7, 9],
        "expectedDatabasePath": "E:/CA/probe",
        "expectedPolicyVersion": "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1",
        "expectedScopeVersion": "CA_DIVIDEND_PREPARED_SCOPE_R1",
        "expectedWriteStageVersion": "CA_DIVIDEND_WRITE_STAGE_R1",
        "expectedScopeFingerprint": "P4B-SYNTHETIC"
    }))
    .unwrap();
    assert_eq!(input.import_ids, vec![7, 9]);
    assert_eq!(input.expected_database_path, "E:/CA/probe");
    assert_eq!(
        input.expected_policy_version,
        "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1"
    );
    assert_eq!(
        input.expected_scope_version,
        "CA_DIVIDEND_PREPARED_SCOPE_R1"
    );
    assert_eq!(
        input.expected_write_stage_version,
        "CA_DIVIDEND_WRITE_STAGE_R1"
    );
    assert_eq!(input.expected_scope_fingerprint, "P4B-SYNTHETIC");
}

#[test]
fn write_stage_bridge_02_maps_result_without_semantic_changes() {
    let internal = auto_approval::SimpleCashDividendWriteStageResult {
        requested: 6,
        revalidated_eligible: 2,
        auto_approved: 1,
        ineligible: 1,
        already_approved: 1,
        stale_scope: 1,
        missing: 1,
        failed: 1,
        dispositions: vec![auto_approval::SimpleCashDividendWriteStageDisposition {
            import_id: 17,
            disposition: "AUTO_APPROVED".to_string(),
            reason: "fixture".to_string(),
            corporate_action_id: Some(91),
        }],
        policy_version: "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1".to_string(),
        scope_version: "CA_DIVIDEND_PREPARED_SCOPE_R1".to_string(),
        write_stage_version: "CA_DIVIDEND_WRITE_STAGE_R1".to_string(),
        scope_fingerprint: "P4B-SYNTHETIC".to_string(),
        complete: false,
        message: "synthetic".to_string(),
    };
    let result = map_simple_cash_dividend_write_stage_result(internal);
    assert_eq!(result.requested, 6);
    assert_eq!(result.revalidated_eligible, 2);
    assert_eq!(result.auto_approved, 1);
    assert_eq!(result.ineligible, 1);
    assert_eq!(result.already_approved, 1);
    assert_eq!(result.stale_scope, 1);
    assert_eq!(result.missing, 1);
    assert_eq!(result.failed, 1);
    assert_eq!(result.policy_version, "CA_DIVIDEND_SIMPLE_CASH_POLICY_R1");
    assert_eq!(result.scope_version, "CA_DIVIDEND_PREPARED_SCOPE_R1");
    assert_eq!(result.write_stage_version, "CA_DIVIDEND_WRITE_STAGE_R1");
    assert_eq!(result.scope_fingerprint, "P4B-SYNTHETIC");
    assert!(!result.complete);
    assert_eq!(result.message, "synthetic");
    assert_eq!(result.dispositions.len(), 1);
    assert_eq!(result.dispositions[0].import_id, 17);
    assert_eq!(result.dispositions[0].disposition, "AUTO_APPROVED");
    assert_eq!(result.dispositions[0].reason, "fixture");
    assert_eq!(result.dispositions[0].corporate_action_id, Some(91));
    let serialized = serde_json::to_value(&result).unwrap();
    assert_eq!(serialized["revalidatedEligible"], 2);
    assert_eq!(serialized["autoApproved"], 1);
    assert_eq!(
        serialized["writeStageVersion"],
        "CA_DIVIDEND_WRITE_STAGE_R1"
    );
    assert_eq!(serialized["dispositions"][0]["corporateActionId"], 91);
    assert!(serialized.get("revalidated_eligible").is_none());
}

#[test]
fn write_stage_bridge_03_transport_delegates_once_and_passes_six_fields() {
    let body = bridge_source_between(
        bridge_source(),
        "pub async fn execute_simple_cash_dividend_write_stage(",
        "#[tauri::command]\npub async fn resolve_corporate_action_import(",
    );
    for field in [
        "import_ids: input.import_ids",
        "expected_database_path: input.expected_database_path",
        "expected_policy_version: input.expected_policy_version",
        "expected_scope_version: input.expected_scope_version",
        "expected_write_stage_version: input.expected_write_stage_version",
        "expected_scope_fingerprint: input.expected_scope_fingerprint",
    ] {
        assert!(
            body.contains(field),
            "missing exact bridge field map: {field}"
        );
    }
    assert_eq!(
        body.matches("execute_simple_cash_dividend_write_stage_transaction_owner(")
            .count(),
        1
    );
    assert!(body.contains(".await?"));
    let mapper_argument = body
        .split_once("map_simple_cash_dividend_write_stage_result(")
        .expect("missing public result mapper")
        .1
        .split_once(')')
        .expect("missing public result mapper closing parenthesis")
        .0
        .trim()
        .trim_end_matches(',')
        .trim();
    assert_eq!(mapper_argument, "committed_result");
}

#[test]
fn write_stage_bridge_04_public_bridge_has_no_duplicate_write_owner() {
    let body = bridge_source_between(
        bridge_source(),
        "pub async fn execute_simple_cash_dividend_write_stage(",
        "#[tauri::command]\npub async fn resolve_corporate_action_import(",
    );
    for forbidden in [
        "try_acquire_price_store_operation",
        "PriceStoreOperationKind::CorporateActionAutomatic",
        "open_connection_for_folder",
        "open_read_only_connection_for_folder",
        "run_connection_transaction",
        "execute_simple_cash_dividend_write_stage_in_connection",
        "approve_corporate_action_import_without_transaction",
        "record_corporate_action_import_decision",
        "invalidate_cached_db_stats",
        "emit_database_changed",
        "INSERT INTO corporate_actions",
        "UPDATE corporate_action_imports",
    ] {
        assert!(
            !body.contains(forbidden),
            "illegal transport owner: {forbidden}"
        );
    }
}

#[test]
fn write_stage_bridge_05_owner_remains_private_non_command() {
    let body = bridge_source_between(
        bridge_source(),
        "async fn execute_simple_cash_dividend_write_stage_transaction_owner(",
        "fn map_simple_cash_dividend_write_stage_result(",
    );
    assert!(!body.contains("#[tauri::command]"));
}

#[test]
fn write_stage_bridge_06_main_registers_public_command_once() {
    let main = include_str!("../../main.rs");
    assert_eq!(
        main.matches("execute_simple_cash_dividend_write_stage,")
            .count(),
        1
    );
    assert!(!main.contains("execute_simple_cash_dividend_write_stage_transaction_owner"));
}

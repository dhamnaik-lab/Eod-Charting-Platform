use super::*;

#[test]
fn dividend_prepared_scope_tauri_bridge_input_deserializes_camel_case() {
    let input: CorporateActionDividendPreparedScopeEvaluationInput =
        serde_json::from_value(serde_json::json!({
            "importIds": [7, 9],
            "expectedDatabasePath": "E:/TA Projects/EOD Charting Platform/EOD DATABASE/Nse"
        }))
        .unwrap();
    assert_eq!(input.import_ids, vec![7, 9]);
    assert_eq!(
        input.expected_database_path,
        "E:/TA Projects/EOD Charting Platform/EOD DATABASE/Nse"
    );
}

#[test]
fn dividend_prepared_scope_tauri_bridge_maps_all_fields_and_versions() {
    let internal = auto_approval::SimpleCashDividendPreparedScopeResult {
        requested: 1,
        reused_count: 0,
        eligible: 1,
        ineligible: 0,
        already_approved: 0,
        stale_scope: 0,
        missing: 0,
        failed: 0,
        dispositions: vec![auto_approval::SimpleCashDividendPreparedScopeDisposition {
            import_id: 17,
            disposition: "ELIGIBLE".to_string(),
            reason: "read-only fixture".to_string(),
            current_action_type: Some("DIVIDEND".to_string()),
            current_parse_status: Some("PARSED".to_string()),
            current_review_status: Some("PENDING".to_string()),
            evidence: Some(auto_approval::SimpleCashDividendPolicyEvidence {
                identity_proof: "EXACT_ACTIVE_CURRENT_IDENTITY".to_string(),
                official_evidence_id: 91,
                evidence_captured_at: "2026-10-06T00:00:00Z".to_string(),
                source_locator: Some("fixture".to_string()),
                cash_amount: 5.0,
                previous_trade_date: "2026-10-05".to_string(),
                previous_close: 100.0,
                computed_factor: 100.0 / 95.0,
            }),
        }],
        policy_version: auto_approval::SIMPLE_CASH_DIVIDEND_POLICY_VERSION.to_string(),
        scope_fingerprint: "ABC123".to_string(),
        complete: true,
        message: "fixture".to_string(),
    };
    let mapped = map_simple_cash_dividend_prepared_scope_result(internal);
    assert_eq!(mapped.requested, 1);
    assert_eq!(mapped.eligible, 1);
    assert_eq!(
        mapped.scope_version,
        auto_approval::SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION
    );
    assert_eq!(
        mapped.policy_version,
        auto_approval::SIMPLE_CASH_DIVIDEND_POLICY_VERSION
    );
    assert_eq!(mapped.scope_fingerprint, "ABC123");
    assert!(mapped.complete);
    assert_eq!(mapped.dispositions[0].import_id, 17);
    assert_eq!(mapped.dispositions[0].disposition, "ELIGIBLE");
    let evidence = mapped.dispositions[0].evidence.as_ref().unwrap();
    assert_eq!(evidence.official_evidence_id, 91);
    assert_eq!(evidence.cash_amount, 5.0);
    assert_eq!(evidence.previous_close, 100.0);

    let json = serde_json::to_value(&mapped).unwrap();
    assert_eq!(json["scopeVersion"], "CA_DIVIDEND_PREPARED_SCOPE_R1");
    assert_eq!(
        json["policyVersion"],
        "AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1"
    );
    assert_eq!(json["dispositions"][0]["currentActionType"], "DIVIDEND");
    assert_eq!(
        json["dispositions"][0]["evidence"]["identityProof"],
        "EXACT_ACTIVE_CURRENT_IDENTITY"
    );
    assert!(json.get("scope_version").is_none());
}

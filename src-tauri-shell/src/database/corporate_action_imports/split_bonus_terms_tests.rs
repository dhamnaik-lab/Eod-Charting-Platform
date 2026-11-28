use super::*;

fn fixture() -> Connection {
    let c = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&c).unwrap();
    c.execute("INSERT INTO instruments(symbol,exchange,isin,name) VALUES ('TEST','NSE','INE000A01001','Test')", []).unwrap();
    for table in ["corporate_actions", "eod_prices", "instruments"] {
        for operation in ["INSERT", "UPDATE", "DELETE"] {
            c.execute_batch(&format!("CREATE TEMP TRIGGER no_{table}_{operation} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT,'financial/identity write forbidden'); END;")).unwrap();
        }
    }
    c
}

fn insert(c: &Connection, id: i64, action: &str, status: &str, purpose: &str) {
    c.execute("INSERT INTO corporate_action_imports (id,dedupe_key,exchange,source,source_file,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status,factor,price_factor,ratio_num,ratio_den)
        VALUES (?,?,'NSE','NSE_API','retained-source','TEST','INE000A01001','Test',?,'2026-08-20',?,'PARSED',?,5,0.2,4,1)",
        params![id,format!("stage2a-{id}"),purpose,action,status]).unwrap();
    ensure_import_evidence(
        c,
        id,
        "NSE_API",
        Some("official URL"),
        Some("2026-01-01"),
        Some("TEST"),
        Some("INE000A01001"),
        Some("Test"),
        Some(action),
        Some("2026-08-20"),
        Some(5.0),
        Some("original JSON"),
        None,
    )
    .unwrap();
}

#[test]
fn ca_nse_remaining_deb_abbreviations_reject_non_equity_without_word_prefix_matches() {
    for purpose in [
        "Sch Of Agmt- Bonus Deb1:1",
        "Bonus Debs1:1",
        "Bonus Deb 1:1",
        "Bonus Debs 1:1",
        "Split Deb1:2",
        "Bonus debs1:2",
    ] {
        let parsed = parse_corporate_action_purpose(purpose);
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW", "{purpose}");
        assert_eq!(parsed.factor, None, "{purpose}");
        assert_eq!(parsed.price_factor, None, "{purpose}");
        assert!(
            parsed
                .message
                .unwrap()
                .starts_with("UNSUPPORTED_SECURITY_TYPE: Debenture"),
            "{purpose}"
        );
    }
    for word in ["Debt", "Debit", "Debut", "Debtors", "Indebted", "Deb1Dvr"] {
        let purpose = format!("Bonus {word} 1:1");
        assert!(split_bonus_terms::blocker(&purpose).is_none(), "{purpose}");
        assert_eq!(
            parse_corporate_action_purpose(&purpose).factor,
            Some(2.0),
            "{purpose}"
        );
    }
}

#[test]
fn stage2a_nonordinary_securities_never_parse_as_equity_adjustments() {
    for (purpose, reason) in [
        (
            "Scheme Of Arrangement - Bonus Ncrps 4:1",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        (
            "Bonus non-cumulative redeemable preference shares 4:1",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        ("Bonus CCPS 1:1", "UNSUPPORTED_SECURITY_TYPE"),
        (
            "Bonus - 1 Debenture For 1 Equity Share Held",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        (
            "Scheme Of Arrangement - Issue Of Bonus Debentures 1:1",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        ("Bonus 1 Dvr : 10 Eq Share", "UNSUPPORTED_SECURITY_TYPE"),
        (
            "Bonus shares with differential voting rights 1:10",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        (
            "Split of preference shares from Rs 10 to Rs 2",
            "UNSUPPORTED_SECURITY_TYPE",
        ),
        (
            "Capital Reduction Rs 10 To Rs 3.30 / Consolidation Rs 3.30 To Rs.10",
            "UNSUPPORTED_RESTRUCTURING",
        ),
        (
            "Reduction of share capital and Bonus 1:1",
            "UNSUPPORTED_RESTRUCTURING",
        ),
    ] {
        let parsed = parse_corporate_action_purpose(purpose);
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW", "{purpose}");
        assert_eq!(parsed.factor, None, "{purpose}");
        assert_eq!(parsed.price_factor, None, "{purpose}");
        assert!(parsed.message.unwrap().contains(reason), "{purpose}");
    }
}

#[test]
fn stage2a_preserves_ordinary_bonus_split_consolidation_and_agm() {
    for (purpose, factor) in [
        ("Bonus 1:1", 2.0),
        ("Annual General Meeting/Bonus 1:2", 1.5),
        ("Scheme Of Arrangement - Bonus Equity Shares 4:1", 5.0),
        ("Bonus equity shares 1:1 of face value Rs 10", 2.0),
        ("Face Value Split From Rs.10/- To Rs.2/-", 5.0),
        ("Stock Split in the ratio of 5:1", 5.0),
        ("Face Value Split From Rs 10 To Rs 2 in the ratio 5:1", 5.0),
        ("Consolidation from Rs 1 to Rs 10 in the ratio 10:1", 0.1),
        ("Consolidation of Equity Shares from Re.1/- to Rs.10/-", 0.1),
        ("Consolidation of shares 10:1", 0.1),
        ("Reverse Split in the ratio of 1:10", 0.1),
    ] {
        let parsed = parse_corporate_action_purpose(purpose);
        assert_eq!(parsed.parse_status, "PARSED", "{purpose}");
        assert_eq!(parsed.factor, Some(factor), "{purpose}");
    }
    assert!(split_bonus_terms::blocker("Dividend on preference shares Rs 2").is_none());
    assert!(split_bonus_terms::blocker("Rights issue 1:2 at Rs 10").is_none());
}

#[test]
fn stage2a_rejects_conflicting_invalid_and_missing_terms() {
    for purpose in [
        "Bonus 4:1 revised to 3:1",
        "Split 5:1 or 2:1",
        "Consolidation 10:1 or 5:1",
        "Bonus 0:1",
        "Bonus 1:0",
        "Split 1:1",
        "Face Value Split From Rs 10 To Rs 2 in the ratio 2:1",
        "Consolidation from Rs 1 to Rs 10 in the ratio 5:1",
        "Bonus shares",
        "Consolidation of Shares",
    ] {
        let parsed = parse_corporate_action_purpose(purpose);
        assert_eq!(parsed.parse_status, "NEEDS_REVIEW", "{purpose}");
        assert_eq!(parsed.factor, None, "{purpose}");
    }
    let overflow = format!("Bonus {}:1", "9".repeat(400));
    assert_eq!(
        parse_corporate_action_purpose(&overflow).parse_status,
        "NEEDS_REVIEW"
    );
}

#[test]
fn stage2a_compound_preparation_checks_whole_announcement_and_components() {
    let ordinary = "Bonus 1:1/Face Value Split From Rs 10 To Rs 2";
    let parts = split_bonus_preparation::components(ordinary).unwrap();
    assert_eq!(parts.len(), 2);
    assert_eq!(
        parts.iter().map(|p| p.factor.unwrap()).product::<f64>(),
        10.0
    );
    for purpose in [
        "Bonus NCRPS 4:1/Face Value Split From Rs 10 To Rs 2",
        "Bonus 1:1/Face Value Split From Rs 10 To Rs 2/Capital Reduction",
        "Bonus 1:1 or 2:1/Face Value Split From Rs 10 To Rs 2",
    ] {
        assert!(
            split_bonus_preparation::components(purpose).is_none(),
            "{purpose}"
        );
    }
}

#[test]
fn stage2a_refresh_revokes_legacy_eligibility_preserving_identity_source_and_manual_history() {
    let c = fixture();
    for (id, status) in [
        (1, "PENDING"),
        (2, "PENDING"),
        (3, "UNRESOLVED"),
        (4, "PENDING_ISIN_MISMATCH"),
        (5, "APPROVED"),
    ] {
        insert(
            &c,
            id,
            "BONUS",
            status,
            "Scheme Of Arrangement - Bonus Ncrps 4:1",
        );
    }
    c.execute("UPDATE corporate_action_imports SET message='Manually resolved this official row to NSE:TEST.' WHERE id=1", []).unwrap();
    c.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES (2,'MANUAL_RESOLUTION','preserve decision')", []).unwrap();
    let approved = serde_json::to_value(get_import_row(&c, 5).unwrap()).unwrap();
    let before = read_import_rows_by_ids(&c, &[1, 2, 3, 4]).unwrap();
    let after =
        run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2, 3, 4, 5])).unwrap();
    for (old, row) in before.iter().zip(&after) {
        assert_eq!(row.parse_status, "NEEDS_REVIEW");
        assert_eq!(row.factor, None);
        assert_eq!(row.price_factor, None);
        assert!(row
            .message
            .as_deref()
            .unwrap()
            .contains("UNSUPPORTED_SECURITY_TYPE"));
        assert_eq!(
            (
                &row.symbol,
                &row.isin,
                &row.exchange,
                &row.purpose_raw,
                &row.source_file
            ),
            (
                &old.symbol,
                &old.isin,
                &old.exchange,
                &old.purpose_raw,
                &old.source_file
            )
        );
        assert_eq!(
            (row.ratio_num, row.ratio_den, row.evidence_count),
            (old.ratio_num, old.ratio_den, old.evidence_count)
        );
        assert!(row.approved_corporate_action_id.is_none());
    }
    assert!(get_import_row(&c, 1)
        .unwrap()
        .message
        .unwrap()
        .starts_with("Manually resolved"));
    assert_eq!(get_import_row(&c, 3).unwrap().review_status, "UNRESOLVED");
    assert_eq!(
        get_import_row(&c, 4).unwrap().review_status,
        "PENDING_ISIN_MISMATCH"
    );
    assert_eq!(
        serde_json::to_value(get_import_row(&c, 5).unwrap()).unwrap(),
        approved
    );
    assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_import_evidence WHERE raw_reference='original JSON' AND captured_at='2026-01-01'",[],|r|r.get::<_,i64>(0)).unwrap(),5);
    assert_eq!(c.query_row("SELECT reason FROM corporate_action_import_decisions WHERE decision_type='MANUAL_RESOLUTION'",[],|r|r.get::<_,String>(0)).unwrap(),"preserve decision");
    let decisions = c
        .query_row(
            "SELECT count(*) FROM corporate_action_import_decisions",
            [],
            |r| r.get::<_, i64>(0),
        )
        .unwrap();
    let repeat =
        run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2, 3, 4, 5])).unwrap();
    assert_eq!(
        serde_json::to_value(after).unwrap(),
        serde_json::to_value(repeat).unwrap()
    );
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_import_decisions",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        decisions
    );
}

#[test]
fn stage2a_refresh_never_expands_unsupported_compounds() {
    let c = fixture();
    insert(
        &c,
        1,
        "BONUS",
        "PENDING",
        "Bonus NCRPS 4:1/Face Value Split From Rs 10 To Rs 2",
    );
    let row = run_connection_transaction(&c, |c| refresh_classifications(c, &[1]))
        .unwrap()
        .remove(0);
    assert_eq!(row.parse_status, "NEEDS_REVIEW");
    assert_eq!(
        c.query_row("SELECT count(*) FROM corporate_action_imports", [], |r| r
            .get::<_, i64>(
            0
        ))
        .unwrap(),
        1
    );
    assert_eq!(
        c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn stage2a_stale_parsed_rows_cannot_bypass_writer_even_with_exception_flags() {
    let c = fixture();
    let folder = tempfile::tempdir().unwrap();
    let raw = folder.path().join("untouched.eod");
    fs::write(&raw, b"unchanged raw-price sentinel").unwrap();
    for (id, action, purpose) in [
        (1, "BONUS", "Bonus NCRPS 4:1"),
        (2, "BONUS", "Bonus 1:1 revised to 2:1"),
        (3, "SPLIT", "Capital Reduction and Consolidation 10:1"),
    ] {
        insert(&c, id, action, "PENDING", purpose);
        for exceptional in [false, true] {
            let error = approve_corporate_action_import_without_transaction(
                &c,
                folder.path(),
                id,
                exceptional,
                exceptional,
            )
            .unwrap_err();
            assert!(
                error.contains("UNSUPPORTED_") || error.contains("AMBIGUOUS_OFFICIAL_TERMS"),
                "{error}"
            );
        }
        assert_eq!(get_import_row(&c, id).unwrap().parse_status, "PARSED");
        assert!(get_import_row(&c, id)
            .unwrap()
            .approved_corporate_action_id
            .is_none());
    }
    assert_eq!(fs::read(raw).unwrap(), b"unchanged raw-price sentinel");
    assert_eq!(
        c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn stage2a_failed_preparation_rolls_back_all_pending_changes() {
    let c = fixture();
    insert(&c, 1, "BONUS", "PENDING", "Bonus NCRPS 4:1");
    insert(&c, 2, "BONUS", "PENDING", "Bonus Debentures 1:1");
    let before = serde_json::to_value(read_import_rows_by_ids(&c, &[1, 2]).unwrap()).unwrap();
    c.execute_batch("CREATE TEMP TRIGGER fail_second_decision BEFORE INSERT ON corporate_action_import_decisions WHEN NEW.import_id=2 BEGIN SELECT RAISE(ABORT,'injected audit failure'); END;").unwrap();
    assert!(run_connection_transaction(&c, |c| refresh_classifications(c, &[1, 2])).is_err());
    assert_eq!(
        serde_json::to_value(read_import_rows_by_ids(&c, &[1, 2]).unwrap()).unwrap(),
        before
    );
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_import_decisions",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
}

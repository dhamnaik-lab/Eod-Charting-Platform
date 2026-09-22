use super::*;
use rusqlite::Connection;

fn function_section<'a>(source: &'a str, start: &str, end: &str) -> &'a str {
    let start_index = source
        .find(start)
        .unwrap_or_else(|| panic!("missing start marker: {start}"));
    let tail = &source[start_index..];
    let end_index = tail
        .find(end)
        .unwrap_or_else(|| panic!("missing end marker: {end}"));
    &tail[..end_index]
}

#[test]
fn v114t_ordinary_ingestion_routes_through_evidence_aware_store() {
    let source = include_str!("../corporate_action_imports.rs");

    let csv_path = function_section(
        source,
        "fn import_corporate_actions_csv_internal(",
        "fn fetch_official_corporate_actions_internal(",
    );

    let official_fetch_path = function_section(
        source,
        "fn fetch_official_corporate_actions_internal(",
        "fn backfill_historical_capital_actions_for_symbol_internal(",
    );

    for (name, section) in [("CSV", csv_path), ("OFFICIAL_FETCH", official_fetch_path)] {
        assert!(
            section.contains(
                "store_import_candidate_evidence_aware(connection, &candidate)"
            ),
            "{name} ordinary ingestion still bypasses the shared evidence-aware store"
        );
        assert!(
            !section.contains("match insert_import_candidate(connection, &candidate)"),
            "{name} ordinary ingestion still calls insert_import_candidate directly"
        );
    }
}

fn v114t_dividend_candidate() -> NewImportCandidate {
    NewImportCandidate {
        dedupe_key: build_dedupe_key(
            "NSE_API",
            "NSE",
            None,
            Some("INE435A01028"),
            "DIVIDEND",
            Some("2021-07-29"),
            Some("2021-07-30"),
            "Annual General Meeting/Dividend - Rs 5 Per Sh",
        ),
        exchange: "NSE".to_string(),
        source: "NSE_API".to_string(),
        source_file: Some("historical-source".to_string()),
        symbol: None,
        isin: Some("INE435A01028".to_string()),
        bse_scrip_code: None,
        company_name: Some("ANDHRA PAPER LIMITED".to_string()),
        purpose_raw: "Annual General Meeting/Dividend - Rs 5 Per Sh".to_string(),
        ex_date: Some("2021-07-29".to_string()),
        record_date: Some("2021-07-30".to_string()),
        action_type: "DIVIDEND".to_string(),
        ratio_num: None,
        ratio_den: None,
        old_face_value: None,
        new_face_value: None,
        cash_amount: Some(5.0),
        factor: None,
        price_factor: None,
        parse_status: "PARSED".to_string(),
        review_status: "UNRESOLVED".to_string(),
        message: Some("V1.14T raw-null-symbol dividend fixture".to_string()),
        evidence: NewImportEvidence {
            source_locator: Some("historical-source".to_string()),
            symbol_seen: None,
            isin_seen: Some("INE435A01028".to_string()),
            company_name_seen: Some("ANDHRA PAPER LIMITED".to_string()),
            action_type_seen: Some("DIVIDEND".to_string()),
            event_date_seen: Some("2021-07-29".to_string()),
            factor_seen: None,
            raw_reference: build_import_evidence_raw_reference(
                None,
                Some("INE435A01028"),
                None,
                Some("ANDHRA PAPER LIMITED"),
                "Annual General Meeting/Dividend - Rs 5 Per Sh",
                Some("2021-07-29"),
                Some("2021-07-30"),
            ),
            note: Some("V1.14T target evidence".to_string()),
        },
    }
}

#[test]
fn v114t_core_reuses_unapproved_andhrapap_dividend_owner_and_attaches_raw_null_symbol_evidence() {
    let connection = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&connection).unwrap();

    connection
        .execute(
            "INSERT INTO corporate_action_imports (id,dedupe_key,exchange,source,source_file,symbol,isin,company_name,purpose_raw,ex_date,record_date,action_type,cash_amount,parse_status,review_status) VALUES (1232,'v114t-owner-1232','NSE','NSE_API','owner-source','ANDHRAPAP','INE435A01028','ANDHRA PAPER LIMITED','Annual General Meeting/Dividend - Rs 5 Per Sh','2021-07-29','2021-07-30','DIVIDEND',5.0,'PARSED','UNRESOLVED')",
            [],
        )
        .unwrap();

    ensure_import_evidence(
        &connection,
        1232,
        "NSE_API",
        Some("owner-source"),
        Some("2026-06-09 14:05:48"),
        Some("ANDHRAPAP"),
        Some("INE435A01028"),
        Some("ANDHRA PAPER LIMITED"),
        Some("DIVIDEND"),
        Some("2021-07-29"),
        None,
        build_import_evidence_raw_reference(
            Some("ANDHRAPAP"),
            Some("INE435A01028"),
            None,
            Some("ANDHRA PAPER LIMITED"),
            "Annual General Meeting/Dividend - Rs 5 Per Sh",
            Some("2021-07-29"),
            Some("2021-07-30"),
        )
        .as_deref(),
        Some("V1.14T owner evidence"),
    )
    .unwrap();

    let outcome = store_import_candidate_evidence_aware(
        &connection,
        &v114t_dividend_candidate(),
    )
    .unwrap();

    assert!(matches!(
        outcome,
        HistoricalCandidateStoreOutcome::EvidenceAttached { import_id: 1232, .. }
    ));

    let import_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| row.get(0))
        .unwrap();
    assert_eq!(import_count, 1);

    let evidence_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM corporate_action_import_evidence WHERE import_id=1232",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(evidence_count, 2);
}

fn v114t_split_candidate() -> NewImportCandidate {
    NewImportCandidate {
        dedupe_key: build_dedupe_key(
            "NSE_API",
            "NSE",
            None,
            Some("INE435A01028"),
            "SPLIT",
            Some("2024-09-11"),
            Some("2024-09-11"),
            "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
        ),
        exchange: "NSE".to_string(),
        source: "NSE_API".to_string(),
        source_file: Some("historical-source".to_string()),
        symbol: None,
        isin: Some("INE435A01028".to_string()),
        bse_scrip_code: None,
        company_name: Some("ANDHRA PAPER LIMITED".to_string()),
        purpose_raw: "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share".to_string(),
        ex_date: Some("2024-09-11".to_string()),
        record_date: Some("2024-09-11".to_string()),
        action_type: "SPLIT".to_string(),
        ratio_num: None,
        ratio_den: None,
        old_face_value: Some(10.0),
        new_face_value: Some(2.0),
        cash_amount: None,
        factor: Some(5.0),
        price_factor: Some(0.2),
        parse_status: "PARSED".to_string(),
        review_status: "UNRESOLVED".to_string(),
        message: Some("V1.14T raw historical split fixture".to_string()),
        evidence: NewImportEvidence {
            source_locator: Some("historical-source".to_string()),
            symbol_seen: None,
            isin_seen: Some("INE435A01028".to_string()),
            company_name_seen: Some("ANDHRA PAPER LIMITED".to_string()),
            action_type_seen: Some("SPLIT".to_string()),
            event_date_seen: Some("2024-09-11".to_string()),
            factor_seen: Some(5.0),
            raw_reference: build_import_evidence_raw_reference(
                None,
                Some("INE435A01028"),
                None,
                Some("ANDHRA PAPER LIMITED"),
                "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
                Some("2024-09-11"),
                Some("2024-09-11"),
            ),
            note: Some("V1.14T target split evidence".to_string()),
        },
    }
}

#[test]
fn v114t_core_reuses_approved_andhrapap_split_owner_through_raw_event_isin_evidence() {
    let connection = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&connection).unwrap();

    connection
        .execute(
            "INSERT INTO corporate_actions (id,symbol,exchange,effective_date,action_type,factor,adjust_volume,isin,record_date,old_face_value,new_face_value,source,source_ref) VALUES (10947,'ANDHRAPAP','NSE','2024-09-11','SPLIT',5.0,1,'INE435A01051','2024-09-11',10.0,2.0,'NSE_API','owner-source')",
            [],
        )
        .unwrap();

    connection
        .execute(
            "INSERT INTO corporate_action_imports (id,dedupe_key,exchange,source,source_file,symbol,isin,company_name,purpose_raw,ex_date,record_date,action_type,old_face_value,new_face_value,factor,price_factor,parse_status,review_status,approved_corporate_action_id,approved_at) VALUES (9582,'v114t-owner-9582','NSE','NSE_API','owner-source','ANDHRAPAP','INE435A01051','ANDHRA PAPER LIMITED','Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share','2024-09-11','2024-09-11','SPLIT',10.0,2.0,5.0,0.2,'PARSED','APPROVED',10947,'2026-08-14T11:06:47Z')",
            [],
        )
        .unwrap();

    ensure_import_evidence(
        &connection,
        9582,
        "NSE_API",
        Some("owner-source"),
        Some("2026-06-09 14:08:56"),
        Some("ANDHRAPAP"),
        Some("INE435A01028"),
        Some("ANDHRA PAPER LIMITED"),
        Some("SPLIT"),
        Some("2024-09-11"),
        Some(5.0),
        build_import_evidence_raw_reference(
            Some("ANDHRAPAP"),
            Some("INE435A01028"),
            None,
            Some("ANDHRA PAPER LIMITED"),
            "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
            Some("2024-09-11"),
            Some("2024-09-11"),
        )
        .as_deref(),
        Some("V1.14T approved-owner raw evidence"),
    )
    .unwrap();

    let outcome = store_import_candidate_evidence_aware(
        &connection,
        &v114t_split_candidate(),
    )
    .unwrap();

    assert!(matches!(
        outcome,
        HistoricalCandidateStoreOutcome::EvidenceAttached { import_id: 9582, .. }
    ));

    let import_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM corporate_action_imports", [], |row| row.get(0))
        .unwrap();
    assert_eq!(import_count, 1);

    let evidence_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM corporate_action_import_evidence WHERE import_id=9582",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(evidence_count, 2);
}

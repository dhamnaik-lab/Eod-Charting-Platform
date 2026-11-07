use super::*;
use crate::database::binary_eod::{BinaryEodFile, EodRecord};
use std::path::PathBuf;

const URL: &str = "https://nsearchives.nseindia.com/content/equities/symbolchange.csv";
const CSV:&str="NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nGUJARAT ENERGY LIMITED,GUJGASLTD,GUJENERGY,01-JUL-2026\n";

fn fixture() -> (Connection, PathBuf) {
    let folder = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend manifest must live below the project root")
        .join("tmp/fixtures/ca-a1-tests")
        .join(format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
    std::fs::create_dir_all(folder.join("eod_data/NSE")).unwrap();
    let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
    crate::database::prepare_database_connection(&c).unwrap();
    c.execute_batch("INSERT INTO instruments(symbol,exchange,isin,name,series,is_active) VALUES
        ('GUJGASLTD','NSE','INE844O01030','Gujarat Gas','EQ',0),
        ('GUJENERGY','NSE','INE844O01030','Gujarat Energy','EQ',1);
        INSERT INTO instrument_identity_history(exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source)
        VALUES('NSE','GUJENERGY','GUJGASLTD','GUJENERGY','2026-07-01','SYMBOL_CHANGE','NSE_IDENTITY');
        INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
        VALUES('NSE','GUJGASLTD','INE844O01022','2019-01-15','NSE_API');
        INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,
            action_type,old_face_value,new_face_value,factor,price_factor,parse_status,review_status)
        VALUES(1,'a1-guj','NSE','NSE_API','GUJGASLTD','INE844O01022',
            'Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share','2019-01-15',
            'SPLIT',10,2,5,0.2,'PARSED','UNRESOLVED');").unwrap();
    dated_symbol_chain::retain_source(&c, URL, CSV.as_bytes()).unwrap();
    let row = get_import_row(&c, 1).unwrap();
    let raw = build_import_evidence_raw_reference(
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        None,
        &row.purpose_raw,
        row.ex_date.as_deref(),
        None,
    )
    .unwrap();
    ensure_import_evidence(
        &c,
        1,
        "NSE_API",
        Some("https://www.nseindia.com/api/corporates-corporateActions?index=equities"),
        None,
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        Some("SPLIT"),
        row.ex_date.as_deref(),
        None,
        Some(&raw),
        Some("Fresh official fetch"),
    )
    .unwrap();
    write_prices(&folder, "GUJGASLTD", 1000, 200);
    // Wrong-alias history must neither establish the scan nor duplicate bars.
    write_prices(&folder, "GUJENERGY", 2000, 400);
    (c, folder)
}

fn write_prices(folder: &Path, symbol: &str, previous: i64, ex: i64) {
    let mut records = [(20190114, previous), (20190115, ex)].map(|(date, price)| EodRecord {
        date,
        flags: 0,
        open: price * 10000,
        high: price * 10000,
        low: price * 10000,
        close: price * 10000,
        prev_close: 0,
        volume: 1000,
        oi: 0,
    });
    BinaryEodFile::write_all(
        folder.join("eod_data/NSE").join(format!("{symbol}.eod")),
        symbol,
        "NSE",
        10000,
        &mut records,
    )
    .unwrap();
}

fn scan(c: &Connection, folder: &Path) {
    run_corporate_action_scan_internal(
        c,
        folder,
        Some(&CorporateActionScanInput {
            scope: Some("official_imports".into()),
            import_ids: Some(vec![1]),
        }),
    )
    .unwrap();
}

fn approve(c: &Connection, folder: &Path) -> AppResult<CorporateActionImportApprovalResult> {
    approve_corporate_action_import_internal(
        c,
        folder,
        &CorporateActionImportApprovalInput {
            import_id: 1,
            expected_database_path: folder.to_string_lossy().into_owned(),
        },
    )
}

fn count(c: &Connection, table: &str) -> i64 {
    c.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
        .unwrap()
}

fn replace_official_witness(c: &Connection, id: i64) {
    c.execute(
        "DELETE FROM corporate_action_import_evidence WHERE import_id=?",
        [id],
    )
    .unwrap();
    let row = get_import_row(c, id).unwrap();
    let raw = build_import_evidence_raw_reference(
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        None,
        &row.purpose_raw,
        row.ex_date.as_deref(),
        row.record_date.as_deref(),
    )
    .unwrap();
    ensure_import_evidence(
        c,
        id,
        "NSE_API",
        Some("https://www.nseindia.com/api/corporates-corporateActions?index=equities"),
        None,
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        Some(&row.action_type),
        row.ex_date.as_deref(),
        None,
        Some(&raw),
        Some("Fresh official fetch"),
    )
    .unwrap();
}

fn bonus_fixture() -> (Connection, PathBuf) {
    let (c, folder) = fixture();
    c.execute_batch("UPDATE corporate_action_imports SET isin='INE844O01030',action_type='BONUS',
        purpose_raw='Bonus 1:1',ratio_num=1,ratio_den=1,old_face_value=NULL,new_face_value=NULL,factor=2,price_factor=0.5 WHERE id=1;").unwrap();
    replace_official_witness(&c, 1);
    write_prices(&folder, "GUJGASLTD", 1000, 500);
    (c, folder)
}

#[test]
fn ca_a1_bonus_route_preserves_exact_isin_and_still_requires_current_rename_proof() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for tamper in [false, true] {
        let (c, folder) = bonus_fixture();
        scan(&c, &folder);
        assert_eq!(
            get_import_row(&c, 1)
                .unwrap()
                .verified_adjustment_target
                .as_deref(),
            Some("GUJENERGY")
        );
        if tamper {
            c.execute(
                "UPDATE corporate_action_symbol_chain_sources SET source_hash='changed'",
                [],
            )
            .unwrap();
            assert!(identity_recheck::machine_identity_is_unproven(
                &c,
                &get_import_row(&c, 1).unwrap()
            )
            .unwrap());
            assert!(approve(&c, &folder).is_err());
            assert_eq!(count(&c, "corporate_actions"), 0);
        } else {
            assert_eq!(
                approve(&c, &folder)
                    .unwrap()
                    .approved_record
                    .unwrap()
                    .factor,
                Some(2.0)
            );
            assert_eq!(
                get_import_row(&c, 1).unwrap().isin.as_deref(),
                Some("INE844O01030")
            );
        }
    }
}

#[test]
fn ca_a1_compound_route_uses_original_capture_and_prepared_components_without_double_adjustment() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    let purpose =
        "Bonus 1:1 / Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share";
    let parts = split_bonus_preparation::components(purpose).unwrap();
    let split = parts.iter().find(|p| p.action_type == "SPLIT").unwrap();
    c.execute("UPDATE corporate_action_imports SET purpose_raw=?,ratio_num=?,ratio_den=?,old_face_value=?,new_face_value=?,factor=?,price_factor=? WHERE id=1",
        params![purpose,split.ratio_num,split.ratio_den,split.old_face_value,split.new_face_value,split.factor,split.price_factor]).unwrap();
    replace_official_witness(&c, 1);
    let before = get_import_row(&c, 1).unwrap();
    assert!(split_bonus_preparation::ensure_components_prepared(&c, &before).is_err());
    split_bonus_preparation::prepare_companion(&c, &before, &parts).unwrap();
    write_prices(&folder, "GUJGASLTD", 1000, 100);
    run_corporate_action_scan_internal(
        &c,
        &folder,
        Some(&CorporateActionScanInput {
            scope: Some("official_imports".into()),
            import_ids: Some(vec![1, 2]),
        }),
    )
    .unwrap();
    for id in [1, 2] {
        let row = get_import_row(&c, id).unwrap();
        assert_eq!(row.review_status, "PENDING");
        assert_eq!(row.verified_adjustment_target.as_deref(), Some("GUJENERGY"));
    }
    assert_eq!(count(&c, "corporate_actions"), 0);
    approve_corporate_action_imports_internal(
        &c,
        &folder,
        &CorporateActionImportBulkApprovalInput {
            import_ids: vec![1, 2],
            expected_database_path: folder.to_string_lossy().into_owned(),
        },
    )
    .unwrap();
    assert_eq!(count(&c, "corporate_actions"), 2);
    let context = super::super::super::eod_data::resolve_instrument_context(&c, "GUJENERGY", "NSE")
        .unwrap()
        .unwrap();
    let raw = super::super::super::eod_data::load_unified_price_rows(
        &folder,
        &c,
        &context,
        "2019-01-01",
        "2019-01-31",
    )
    .unwrap();
    let adjusted = super::super::super::eod_data::apply_corporate_adjustments(
        raw,
        &context.corporate_actions,
        false,
        false,
    )
    .unwrap();
    assert_eq!(adjusted[0].close, 100.0);
    assert_eq!(adjusted[0].volume, 10000);
    assert_eq!(get_import_row(&c, 2).unwrap().purpose_raw, purpose);
    let captured_action: String = c
        .query_row(
            "SELECT action_type_seen FROM corporate_action_import_evidence WHERE import_id=2",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(captured_action, "SPLIT");
}

#[test]
fn ca_a1_route_full_bar_changes_and_proof_copy_to_another_database_are_rejected() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    scan(&c, &folder);
    let path = folder.join("eod_data/NSE/GUJGASLTD.eod");
    let mut records = BinaryEodFile::open(&path).unwrap().read_all().unwrap();
    records[0].volume += 1;
    BinaryEodFile::write_all(&path, "GUJGASLTD", "NSE", 10000, &mut records).unwrap();
    assert!(get_import_row(&c, 1)
        .unwrap()
        .verified_adjustment_target
        .is_none());
    assert!(approve(&c, &folder).is_err());
    let (other, other_folder) = fixture();
    scan(&other, &other_folder);
    let proof:(String,String)=other.query_row("SELECT proof_json,fingerprint FROM corporate_action_split_bonus_chain_proofs WHERE import_id=1",[],|r|Ok((r.get(0)?,r.get(1)?))).unwrap();
    c.execute("UPDATE corporate_action_split_bonus_chain_proofs SET proof_json=?,fingerprint=? WHERE import_id=1",params![proof.0,proof.1]).unwrap();
    assert!(verified(&c, &folder, &get_import_row(&c, 1).unwrap())
        .unwrap()
        .is_none());
}

#[test]
fn ca_a1_preparation_audit_failure_rolls_back_proof_and_status() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    c.execute_batch("CREATE TRIGGER fail_a1_prepare BEFORE INSERT ON corporate_action_import_decisions
        WHEN NEW.decision_type='VERIFIED_SPLIT_BONUS_SYMBOL_CHAIN_R1' BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END;").unwrap();
    assert!(run_corporate_action_scan_internal(
        &c,
        &folder,
        Some(&CorporateActionScanInput {
            scope: Some("official_imports".into()),
            import_ids: Some(vec![1])
        })
    )
    .is_err());
    assert_eq!(count(&c, "corporate_action_split_bonus_chain_proofs"), 0);
    assert_eq!(get_import_row(&c, 1).unwrap().review_status, "UNRESOLVED");
    assert_eq!(count(&c, "corporate_actions"), 0);
}

#[test]
fn ca_a1_route_permit_is_conditional_nonblocking_and_rechecked_inside_transaction() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    assert!(approval_permit(&c, &[1]).unwrap().is_none());
    ensure_permit(&c, &[1], false).unwrap();
    // Simulate preparation winning the race between the preliminary read and
    // BEGIN IMMEDIATE. Approval without the permit must now stop.
    scan(&c, &folder);
    assert!(ensure_permit(&c, &[1], false).is_err());
    let permit = approval_permit(&c, &[1]).unwrap().unwrap();
    assert!(approval_permit(&c, &[1]).is_err());
    ensure_permit(&c, &[1], true).unwrap();
    assert_eq!(count(&c, "corporate_actions"), 0);
    drop(permit);
    assert!(approve(&c, &folder).is_ok());
}

#[test]
fn ca_a1_route_rechecks_preserve_explicit_closed_and_rejected_dispositions() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for status in ["CLOSED_INFORMATIONAL", "REJECTED"] {
        let (c, folder) = fixture();
        scan(&c, &folder);
        c.execute(
            "UPDATE corporate_action_imports SET review_status=? WHERE id=1",
            [status],
        )
        .unwrap();
        let row = get_import_row(&c, 1).unwrap();
        identity_recheck::recheck_pending_machine_identity(&c, &row).unwrap();
        scan(&c, &folder);
        let after = get_import_row(&c, 1).unwrap();
        assert_eq!(after.review_status, status);
        assert!(after.verified_adjustment_target.is_none());
        assert!(approve(&c, &folder).is_err());
        assert_eq!(count(&c, "corporate_actions"), 0);
    }
}

#[test]
fn ca_a1_split_route_scan_prepares_without_approval_and_explicit_approve_adjusts_one_chart() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    let before = get_import_row(&c, 1).unwrap();
    let hashes: Vec<_> = ["GUJGASLTD", "GUJENERGY"]
        .iter()
        .map(|s| {
            digest(&std::fs::read(folder.join("eod_data/NSE").join(format!("{s}.eod"))).unwrap())
        })
        .collect();
    assert!(approve(&c, &folder).is_err());
    scan(&c, &folder);
    let ready = get_import_row(&c, 1).unwrap();
    assert_eq!(ready.review_status, "PENDING");
    assert_eq!(ready.instrument_is_active, Some(false));
    assert_eq!(
        ready.verified_adjustment_target.as_deref(),
        Some("GUJENERGY")
    );
    assert_eq!(count(&c, "corporate_actions"), 0);
    assert!(matches!(
        auto_approval::evaluate_auto_approval_r1(&c, 1).unwrap(),
        auto_approval::AutoApprovalEligibility::Ineligible(_)
    ));
    scan(&c, &folder);
    assert_eq!(count(&c, "corporate_actions"), 0);
    let result = approve(&c, &folder).unwrap();
    assert_eq!(result.approved_record.unwrap().current_symbol, "GUJENERGY");
    assert_eq!(result.import_record.symbol, before.symbol);
    assert_eq!(result.import_record.isin, before.isin);
    assert_eq!(result.import_record.purpose_raw, before.purpose_raw);
    assert_eq!(count(&c, "corporate_actions"), 1);
    assert!(approve(&c, &folder).unwrap().approved_record.is_none());
    assert_eq!(count(&c, "corporate_actions"), 1);
    for symbol in ["GUJGASLTD", "GUJENERGY"] {
        let context = super::super::super::eod_data::resolve_instrument_context(&c, symbol, "NSE")
            .unwrap()
            .unwrap();
        assert_eq!(context.current_symbol, "GUJENERGY");
        assert_eq!(context.corporate_actions.len(), 1);
        let raw = super::super::super::eod_data::load_unified_price_rows(
            &folder,
            &c,
            &context,
            "2019-01-01",
            "2019-01-31",
        )
        .unwrap();
        assert_eq!(raw.len(), 2);
        assert_eq!(raw[0].close, 1000.0);
        let adjusted = super::super::super::eod_data::apply_corporate_adjustments(
            raw,
            &context.corporate_actions,
            false,
            false,
        )
        .unwrap();
        assert_eq!(adjusted[0].close, 200.0);
        assert_eq!(adjusted[1].close, 200.0);
        assert_eq!(adjusted[0].volume, 5000);
        assert_eq!(adjusted[1].volume, 1000);
    }
    for (index, symbol) in ["GUJGASLTD", "GUJENERGY"].iter().enumerate() {
        assert_eq!(
            hashes[index],
            digest(
                &std::fs::read(folder.join("eod_data/NSE").join(format!("{symbol}.eod"))).unwrap()
            )
        );
    }
}

#[test]
fn ca_a1_split_route_source_history_witness_activity_and_owners_fail_closed() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for mutation in [
        "UPDATE corporate_action_symbol_chain_sources SET source_hash='forged'",
        "UPDATE corporate_action_symbol_chain_sources SET captured_at=datetime('now','-2 days')",
        "UPDATE corporate_action_symbol_chain_sources SET source_url='https://example.com/content/equities/symbolchange.csv'",
        "DELETE FROM corporate_action_import_evidence",
        "UPDATE corporate_action_import_evidence SET raw_reference='{}'",
        "UPDATE corporate_action_import_evidence SET note='legacy backfill'",
        "INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,raw_reference,note,symbol_seen,isin_seen,event_date_seen,action_type_seen) SELECT import_id,source_code,source_locator,captured_at,raw_reference,note,symbol_seen,isin_seen,event_date_seen,action_type_seen FROM corporate_action_import_evidence",
        "UPDATE instrument_identity_history SET effective_date='2018-01-01'",
        "UPDATE instrument_identity_history SET source='UNVERIFIED'",
        "UPDATE instrument_identity_history SET isin='INE000A01011'",
        "UPDATE instrument_identity_history SET source_ref='changed-after-preparation'",
        "INSERT INTO instrument_identity_history(exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source) SELECT exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source FROM instrument_identity_history",
        "UPDATE instruments SET is_active=1 WHERE symbol='GUJGASLTD'",
        "UPDATE instruments SET is_active=0 WHERE symbol='GUJENERGY'",
        "UPDATE instruments SET isin='INE000A01011' WHERE symbol='GUJENERGY'",
        "INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES('OTHER','NSE','INE844O01030','Other',1)",
        "INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES('OTHER','NSE','ine844o01022','Other',0)",
        "INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source) VALUES('OTHEREX','OTHER','INE844O01022','2019-01-15','fixture')",
    ] {
        let (c,folder)=fixture();scan(&c,&folder);
        c.execute_batch(mutation).unwrap();
        let row=get_import_row(&c,1).unwrap();
        assert!(row.verified_adjustment_target.is_none(),"{mutation}");
        assert!(verified(&c,&folder,&row).unwrap().is_none(),"{mutation}");
        assert!(approve(&c,&folder).is_err(),"{mutation}");
        assert_eq!(count(&c,"corporate_actions"),0);
        identity_recheck::recheck_pending_machine_identity(&c,&row).unwrap();
        assert_eq!(get_import_row(&c,1).unwrap().review_status,"UNRESOLVED");
    }
}

#[test]
fn ca_a1_split_route_rejects_duplicate_edges_and_multi_edge_or_reused_symbols() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for tail in [
        "GUJARAT ENERGY LIMITED,GUJGASLTD,GUJENERGY,01-JUL-2026\n",
        "Other,GUJGASLTD,OTHER,01-AUG-2026\n",
        "Other,OLDER,GUJGASLTD,01-JAN-2015\n",
        "Other,GUJENERGY,OTHER,01-AUG-2026\n",
    ] {
        let (c, folder) = fixture();
        dated_symbol_chain::retain_source(&c, URL, format!("{CSV}{tail}").as_bytes()).unwrap();
        scan(&c, &folder);
        assert_eq!(get_import_row(&c, 1).unwrap().review_status, "UNRESOLVED");
        assert!(approve(&c, &folder).is_err());
    }
}

#[test]
fn ca_a1_split_route_rejects_changed_deleted_or_wrong_alias_prices_and_changed_terms() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for mutation in 0..6 {
        let (c, folder) = fixture();
        scan(&c, &folder);
        match mutation {
            0 => write_prices(&folder, "GUJGASLTD", 900, 200),
            1 => {
                std::fs::rename(
                    folder.join("eod_data/NSE/GUJGASLTD.eod"),
                    folder.join("old-price.evidence"),
                )
                .unwrap();
            }
            2 => {
                c.execute(
                    "UPDATE corporate_action_imports SET factor=4,price_factor=0.25 WHERE id=1",
                    [],
                )
                .unwrap();
            }
            3 => {
                c.execute(
                    "UPDATE corporate_action_scan_results SET scan_status='NEEDS_REVIEW'",
                    [],
                )
                .unwrap();
            }
            4 => {
                c.execute(
                    "UPDATE corporate_action_imports SET purpose_raw='Bonus 1:1 and Split 10 to 2'",
                    [],
                )
                .unwrap();
            }
            _ => {
                let path = folder.join("eod_data/NSE/GUJGASLTD.eod");
                let mut records = BinaryEodFile::open(&path).unwrap().read_all().unwrap();
                BinaryEodFile::write_all(path, "WRONG", "NSE", 10000, &mut records).unwrap();
            }
        }
        if mutation == 1 || mutation == 5 {
            scan(&c, &folder);
            assert_eq!(
                load_latest_official_split_bonus_validation(&c, 1)
                    .unwrap()
                    .unwrap()
                    .scan_status,
                "NO_PRICE_DATA"
            );
        }
        assert!(get_import_row(&c, 1)
            .unwrap()
            .verified_adjustment_target
            .is_none());
        assert!(approve(&c, &folder).is_err());
        assert_eq!(count(&c, "corporate_actions"), 0);
    }
}

#[test]
fn ca_a1_split_route_refuses_rename_day_and_later_old_symbol_events() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for date in ["2026-07-01", "2026-07-02"] {
        let (c, folder) = fixture();
        c.execute(
            "UPDATE corporate_action_imports SET ex_date=? WHERE id=1",
            [date],
        )
        .unwrap();
        assert!(identity(&c, &get_import_row(&c, 1).unwrap())
            .unwrap()
            .is_none());
        assert!(approve(&c, &folder).is_err());
    }
}

#[test]
fn ca_a1_split_route_transaction_failure_rolls_back_financial_records_and_link() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    let (c, folder) = fixture();
    scan(&c, &folder);
    c.execute_batch("CREATE TRIGGER fail_a1_link BEFORE UPDATE OF approved_corporate_action_id ON corporate_action_imports
        WHEN NEW.approved_corporate_action_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'fixture approval failure'); END;").unwrap();
    assert!(approve(&c, &folder).is_err());
    assert_eq!(count(&c, "corporate_actions"), 0);
    let row = get_import_row(&c, 1).unwrap();
    assert_eq!(row.review_status, "PENDING");
    assert_eq!(row.approved_corporate_action_id, None);
    assert_eq!(row.symbol.as_deref(), Some("GUJGASLTD"));
}

#[test]
fn ca_a1_split_route_duplicates_require_one_exact_action_and_never_borrow_unrelated_isin() {
    let _test_scope = crate::database::price_store_operation_lock::test_price_store_scope();
    for (symbol, old_face, expected) in [
        ("GUJENERGY", 10, 1),
        ("GUJGASLTD", 10, 1),
        ("GUJENERGY", 20, 0),
        ("OTHER", 10, 0),
    ] {
        let (c, folder) = fixture();
        scan(&c, &folder);
        c.execute("INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,old_face_value,new_face_value)
            VALUES(?,'NSE','INE844O01022','2019-01-15','SPLIT',5,?,2)",params![symbol,old_face]).unwrap();
        let row = get_import_row(&c, 1).unwrap();
        let proof = verified(&c, &folder, &row).unwrap().unwrap();
        let found = existing(&c, &row, &proof);
        if expected == 1 {
            assert!(found.unwrap().is_some());
        } else if symbol == "OTHER" {
            assert_eq!(found.unwrap(), None);
        } else {
            assert!(found.is_err());
        }
    }
}

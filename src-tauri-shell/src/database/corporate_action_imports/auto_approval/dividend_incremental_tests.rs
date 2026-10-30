// Included inside auto_approval::tests to exercise the actual policy fixtures.
#[test]
#[ignore = "explicit disposable scale benchmark; no live database"]
fn dividend_incremental_scale_benchmark() {
    let (folder, mut c) = incremental_fixture();
    c.execute_batch("BEGIN;
        WITH RECURSIVE n(x) AS (VALUES(2) UNION ALL SELECT x+1 FROM n WHERE x<33971)
        INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,cash_amount,parse_status,review_status)
        SELECT x,'scale-'||x,'NSE','NSE_API',CASE WHEN x<=100 THEN 'TEST' ELSE 'UNRELATED'||x END,
            CASE WHEN x<=100 THEN 'INEAUTO01001' ELSE 'UNRELATED'||x END,
            'Dividend Rs 5 per share',date('2000-01-01','+'||x||' days'),'DIVIDEND',5,'PARSED','PENDING' FROM n;
        INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference,note)
        SELECT id,'NSE_API','{}',printf('%0500d',id) FROM corporate_action_imports WHERE id>1;
        INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,cash_amount)
        SELECT symbol,'NSE',isin,ex_date,'DIVIDEND',1.05,5 FROM corporate_action_imports WHERE id>100;
        CREATE INDEX scale_evidence_import ON corporate_action_import_evidence(import_id);
        CREATE INDEX scale_decisions_import ON corporate_action_import_decisions(import_id);
        COMMIT;").unwrap();
    let csv =
        b"NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nExample,OLD,TEST,20-MAR-2020\n";
    super::super::dated_symbol_chain::retain_source(
        &c,
        "https://nsearchives.nseindia.com/content/equities/symbolchange.csv",
        csv,
    )
    .unwrap();
    let ids: Vec<i64> = (1..=100).collect();
    let start = std::time::Instant::now();
    let cold = incremental_run(&mut c, folder.path(), ids.clone());
    let cold_ms = start.elapsed().as_millis();
    drop(c);
    let mut c = Connection::open(folder.path().join("incremental.sqlite")).unwrap();
    let start = std::time::Instant::now();
    let warm = incremental_run(&mut c, folder.path(), ids);
    println!("DIVIDEND_SCALE imports=33971 canonical=33871 batch=100 cold_ms={cold_ms} warm_ms={} reused={} policy_evaluated={}",start.elapsed().as_millis(),warm.reused_count,100-warm.reused_count);
    assert_eq!(cold.reused_count, 0);
    assert_eq!(warm.reused_count, 100);
    assert_eq!(cold.dispositions, warm.dispositions);
}

#[test]
#[ignore = "explicit disposable overlapping-group benchmark; no live database"]
fn dividend_incremental_overlapping_groups_benchmark() {
    let (folder, mut c) = incremental_fixture();
    c.execute_batch("BEGIN;
        WITH RECURSIVE n(x) AS (VALUES(2) UNION ALL SELECT x+1 FROM n WHERE x<33971)
        INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,cash_amount,parse_status,review_status)
        SELECT x,'overlap-'||x,'NSE','NSE_API',
          CASE WHEN x<=100 THEN 'SYM'||x WHEN x<=2100 THEN CASE WHEN (x-101)%100=0 THEN 'TEST' ELSE 'SYM'||((x-101)%100+1) END ELSE 'UNRELATED'||x END,
          CASE WHEN x<=100 THEN printf('INE%09d',x) ELSE 'HISTORICAL'||x END,
          'Interim Dividend - Rs. 5 per share',CASE WHEN x<=100 THEN '2026-08-14' ELSE date('1900-01-01','+'||x||' days') END,
          'DIVIDEND',5,'PARSED','PENDING' FROM n;
        INSERT INTO instruments(symbol,exchange,isin,name,is_active)
        SELECT symbol,exchange,isin,'Test Limited',1 FROM corporate_action_imports WHERE id BETWEEN 2 AND 100;
        INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,prev_close,volume,open_interest)
        SELECT i.symbol,'NSE',p.date,p.open,p.high,p.low,p.close,p.prev_close,p.volume,p.open_interest
          FROM corporate_action_imports i CROSS JOIN eod_prices p WHERE i.id BETWEEN 2 AND 100 AND p.symbol='TEST';
        INSERT INTO corporate_action_import_evidence(import_id,source_code,raw_reference,note)
        SELECT id,'NSE_API','{}',printf('%0500d',id) FROM corporate_action_imports WHERE id>100;
        INSERT INTO corporate_actions(symbol,exchange,isin,effective_date,action_type,factor,cash_amount)
        SELECT symbol,'NSE',isin,ex_date,'DIVIDEND',1.05,5 FROM corporate_action_imports WHERE id>100;
        CREATE INDEX overlap_evidence_import ON corporate_action_import_evidence(import_id);
        CREATE INDEX overlap_decisions_import ON corporate_action_import_decisions(import_id);
        COMMIT;").unwrap();
    for id in 2..=100 {
        let symbol = format!("SYM{id}");
        let isin = format!("INE{id:09}");
        let raw = super::super::build_import_evidence_raw_reference(Some(&symbol),Some(&isin),None,
            Some("Test Limited"),"Interim Dividend - Rs. 5 per share",Some("2026-08-14"),None).unwrap();
        c.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,raw_reference,note)
          VALUES (?,'NSE_API','fixture://nse-api','2026-08-10T10:00:00Z',?,?,'Test Limited','DIVIDEND','2026-08-14',?,'fixture')",
          params![id,symbol,isin,raw]).unwrap();
    }
    let ids: Vec<i64> = (1..=100).collect();
    let start = std::time::Instant::now();
    let cold = incremental_run(&mut c,folder.path(),ids.clone());
    let cold_ms = start.elapsed().as_millis();
    drop(c);
    let mut c = Connection::open(folder.path().join("incremental.sqlite")).unwrap();
    let start = std::time::Instant::now();
    let warm = incremental_run(&mut c,folder.path(),ids);
    println!("DIVIDEND_OVERLAP imports=33971 canonical=33871 symbols=100 cold_ms={cold_ms} warm_ms={} eligible={} reused={} policy_evaluated={}",start.elapsed().as_millis(),cold.eligible,warm.reused_count,100-warm.reused_count);
    assert_eq!(cold.eligible,100);
    assert_eq!(warm.reused_count,100);
    assert_eq!(cold.dispositions,warm.dispositions);
}

fn incremental_fixture() -> (tempfile::TempDir, Connection) {
    let folder = tempfile::tempdir().unwrap();
    let source = eligible_dividend_fixture();
    let db = folder.path().join("incremental.sqlite");
    source
        .execute("VACUUM INTO ?", [db.to_string_lossy().as_ref()])
        .unwrap();
    let c = Connection::open(db).unwrap();
    c.execute_batch("CREATE TABLE corporate_action_history_metadata(singleton_id INTEGER PRIMARY KEY,database_instance_id TEXT,schema_version INTEGER);
        INSERT INTO corporate_action_history_metadata VALUES(1,'disposable-lineage',1);
        CREATE TABLE corporate_action_symbol_chain_proofs(import_id INTEGER PRIMARY KEY,proof_json TEXT NOT NULL,fingerprint TEXT NOT NULL);").unwrap();
    let schema = include_str!("../../bootstrap.rs");
    let schema = schema
        .split("CREATE TABLE IF NOT EXISTS corporate_action_dividend_validation_checkpoints")
        .nth(1)
        .unwrap()
        .split("CREATE TABLE IF NOT EXISTS corporate_action_activity_runs")
        .next()
        .unwrap();
    c.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS corporate_action_dividend_validation_checkpoints{schema}"
    ))
    .unwrap();
    (folder, c)
}

#[test]
fn dividend_incremental_peer_cache_matches_fresh_checks_and_never_includes_self() {
    let c = eligible_dividend_fixture();
    insert_simple_cash_dividend_import(&c,2,"NSE_API","PENDING","Dividend Rs 1 per share","2026-08-14",1.0);
    let mut cache = super::DividendPeerCache::default();
    for id in [1,2,1,2] {
        let row = get_import_row(&c,id).unwrap();
        let fresh = super::same_date_automatic_exclusion_peer(&c,&row).unwrap();
        let cached = super::same_date_automatic_exclusion_peer_with_cache(&c,&row,Some(&mut cache)).unwrap();
        assert_eq!(cached,fresh);
        assert_eq!(cached,Some("DIVIDEND".to_string()));
    }
    assert_eq!(cache.identities.len(),2);
    assert_eq!(cache.peers.len(),1);
    c.execute("UPDATE corporate_action_imports SET review_status='REJECTED' WHERE id=2",[]).unwrap();
    let mut fresh_batch = super::DividendPeerCache::default();
    let row = get_import_row(&c,1).unwrap();
    assert_eq!(super::same_date_automatic_exclusion_peer_with_cache(&c,&row,Some(&mut fresh_batch)).unwrap(),None);
}

fn incremental_run(
    c: &mut Connection,
    folder: &Path,
    ids: Vec<i64>,
) -> SimpleCashDividendPreparedScopeResult {
    super::super::dividend_validation_cache::evaluate(c, folder, &prepared_scope_input(folder, ids))
        .unwrap()
}

#[test]
fn dividend_incremental_restart_reuses_eligible_and_unchanged_blocker_without_policy_batches() {
    let (folder, mut c) = incremental_fixture();
    insert_simple_cash_dividend_import(
        &c,
        2,
        "NSE_API",
        "PENDING",
        "Dividend Rs 5 per share",
        "2026-08-15",
        5.0,
    );
    let first = incremental_run(&mut c, folder.path(), vec![1, 2]);
    assert_eq!(
        (first.reused_count, first.eligible, first.ineligible),
        (0, 1, 1)
    );
    let first_items = first.dispositions;
    drop(c);
    let mut c = Connection::open(folder.path().join("incremental.sqlite")).unwrap();
    let next = incremental_run(&mut c, folder.path(), vec![2, 1]);
    assert_eq!(next.reused_count, 2);
    assert!(next.message.contains("0 policy evaluation(s)"));
    assert_eq!(next.dispositions, first_items);
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_dividend_validation_checkpoints",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        2
    );
    assert_eq!(
        c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
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

#[test]
fn dividend_incremental_changed_and_new_events_only_check_dependency_group() {
    let (folder, mut c) = incremental_fixture();
    insert_simple_cash_dividend_import(
        &c,
        2,
        "NSE_API",
        "PENDING",
        "Dividend Rs 3 per share",
        "2026-08-20",
        3.0,
    );
    c.execute(
        "UPDATE corporate_action_imports SET symbol='OTHER',isin='INEOTHER0001' WHERE id=2",
        [],
    )
    .unwrap();
    incremental_run(&mut c, folder.path(), vec![1, 2]);
    c.execute("UPDATE corporate_action_imports SET purpose_raw='Dividend Rs 9 per share',cash_amount=9 WHERE id=2",[]).unwrap();
    let next = incremental_run(&mut c, folder.path(), vec![1, 2]);
    assert_eq!(next.reused_count, 1);
    c.execute(
        "INSERT INTO corporate_action_symbol_chain_proofs VALUES(2,'{}','new-proof')",
        [],
    )
    .unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1, 2]).reused_count,
        1
    );
    insert_simple_cash_dividend_import(
        &c,
        3,
        "NSE_API",
        "PENDING",
        "Dividend Rs 1 per share",
        "2026-08-20",
        1.0,
    );
    c.execute(
        "UPDATE corporate_action_imports SET symbol='OTHER',isin='INEOTHER0001' WHERE id=3",
        [],
    )
    .unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1, 2, 3]).reused_count,
        1
    );
}

#[test]
fn dividend_incremental_old_blocker_wakes_for_witness_and_missing_price_arrival() {
    let (folder, mut c) = incremental_fixture();
    c.execute("DELETE FROM corporate_action_import_evidence", [])
        .unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).ineligible,
        1
    );
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        1
    );
    insert_exact_dividend_official_evidence(
        &c,
        1,
        "Interim Dividend - Rs. 5 per share",
        "2026-08-14",
    );
    c.execute("DELETE FROM eod_prices WHERE date='2026-08-14'", [])
        .unwrap();
    let witness = incremental_run(&mut c, folder.path(), vec![1]);
    assert_eq!((witness.reused_count, witness.ineligible), (0, 1));
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        1
    );
    insert_dividend_previous_close(&c, "2026-08-14", 95.0);
    let price = incremental_run(&mut c, folder.path(), vec![1]);
    assert_eq!((price.reused_count, price.eligible), (0, 1));
}

#[test]
fn dividend_incremental_identity_manual_canonical_policy_lineage_and_payload_changes_invalidate() {
    let (folder, mut c) = incremental_fixture();
    incremental_run(&mut c, folder.path(), vec![1]);
    for sql in [
        "UPDATE instruments SET isin='CHANGED' WHERE symbol='TEST'",
        "UPDATE instruments SET isin='INEAUTO01001' WHERE symbol='TEST'",
        "UPDATE corporate_action_history_metadata SET database_instance_id='restored-lineage'",
        "UPDATE corporate_action_dividend_validation_checkpoints SET result_json='{}'",
        "UPDATE corporate_action_dividend_validation_checkpoints SET dependency_hash='old-policy'",
        "INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES(1,'MANUAL_RESOLUTION','manual provenance')",
        "INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,action_type,factor,cash_amount) VALUES(77,'TEST','NSE','INEAUTO01001','2026-08-14','DIVIDEND',1.05,5)",
    ] {
        c.execute_batch(sql).unwrap();
        assert_eq!(incremental_run(&mut c,folder.path(),vec![1]).reused_count,0,"{sql}");
        assert_eq!(incremental_run(&mut c,folder.path(),vec![1]).reused_count,1);
    }
}

#[test]
fn dividend_incremental_failed_and_missing_results_never_checkpoint() {
    let (folder, mut c) = incremental_fixture();
    c.execute("DELETE FROM eod_prices", []).unwrap();
    let missing = incremental_run(&mut c, folder.path(), vec![99]);
    assert_eq!((missing.missing, missing.reused_count), (1, 0));
    c.execute_batch("DROP TABLE corporate_action_import_evidence")
        .unwrap();
    // Uncertain manifest plus a broken policy input fails closed rather than
    // treating a previous disposition as current authority.
    let result = super::super::dividend_validation_cache::evaluate(
        &mut c,
        folder.path(),
        &prepared_scope_input(folder.path(), vec![1]),
    );
    assert!(result.is_err());
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_dividend_validation_current",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
}

#[test]
fn dividend_incremental_failed_policy_outcomes_are_retried_without_checkpointing() {
    let (folder, mut c) = incremental_fixture();
    c.execute_batch("DROP TABLE eod_prices").unwrap();
    for _ in 0..2 {
        let result = incremental_run(&mut c, folder.path(), vec![1]);
        assert_eq!(
            (result.reused_count, result.failed, result.complete),
            (0, 1, false)
        );
    }
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_dividend_validation_current",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
}

#[test]
fn dividend_incremental_checkpoint_failure_rolls_back_entire_batch_and_retry_is_safe() {
    let (folder, mut c) = incremental_fixture();
    insert_simple_cash_dividend_import(
        &c,
        2,
        "NSE_API",
        "PENDING",
        "Dividend Rs 1 per share",
        "2026-08-15",
        1.0,
    );
    c.execute_batch("CREATE TRIGGER checkpoint_failure BEFORE INSERT ON corporate_action_dividend_validation_checkpoints WHEN NEW.import_id=2 BEGIN SELECT RAISE(ABORT,'disposable failure'); END;").unwrap();
    assert!(super::super::dividend_validation_cache::evaluate(
        &mut c,
        folder.path(),
        &prepared_scope_input(folder.path(), vec![1, 2])
    )
    .is_err());
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_dividend_validation_checkpoints",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    assert_eq!(
        c.query_row(
            "SELECT count(*) FROM corporate_action_dividend_validation_current",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
    c.execute_batch("DROP TRIGGER checkpoint_failure").unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1, 2]).reused_count,
        0
    );
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1, 2]).reused_count,
        2
    );
}

#[test]
fn dividend_incremental_production_schema_is_additive_and_idempotent() {
    let c = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&c).unwrap();
    crate::database::prepare_database_connection(&c).unwrap();
    let count: i64 = c.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('corporate_action_dividend_validation_checkpoints','corporate_action_dividend_validation_current')",[],|r|r.get(0)).unwrap();
    assert_eq!(count, 2);
}

#[test]
fn dividend_incremental_retained_source_and_proof_content_changes_invalidate() {
    let (folder, mut c) = incremental_fixture();
    incremental_run(&mut c, folder.path(), vec![1]);
    let csv =
        b"NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nExample,OLD,NEW,20-MAR-2020\n";
    super::super::dated_symbol_chain::retain_source(
        &c,
        "https://nsearchives.nseindia.com/content/equities/symbolchange.csv",
        csv,
    )
    .unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        0
    );
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        1
    );
    c.execute("INSERT INTO corporate_action_symbol_chain_proofs(import_id,proof_json,fingerprint) VALUES(1,'{}','changed')",[]).unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        0
    );
    // Invalid source parsing is uncertain proof: evaluate normally, never reuse.
    c.execute(
        "UPDATE corporate_action_symbol_chain_sources SET raw_csv=x'00'",
        [],
    )
    .unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        0
    );
}

#[test]
fn dividend_incremental_binary_content_edit_and_missing_file_arrival_invalidate() {
    use crate::database::binary_eod::{BinaryEodFile, EodRecord};
    let (folder, mut c) = incremental_fixture();
    incremental_run(&mut c, folder.path(), vec![1]);
    let path = folder.path().join("eod_data/NSE/TEST.eod");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let record = |date, close| EodRecord {
        date,
        flags: 0,
        open: close,
        high: close,
        low: close,
        close,
        prev_close: close,
        volume: 100,
        oi: 0,
    };
    let mut records = vec![record(20260813, 1000000), record(20260814, 950000)];
    BinaryEodFile::write_all(&path, "TEST", "NSE", 10000, &mut records).unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        0
    );
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        1
    );
    records[0].close = 1100000;
    BinaryEodFile::write_all(&path, "TEST", "NSE", 10000, &mut records).unwrap();
    assert_eq!(
        incremental_run(&mut c, folder.path(), vec![1]).reused_count,
        0
    );
    let mut bytes = std::fs::read(&path).unwrap();
    bytes[128..132].copy_from_slice(&20260815_u32.to_le_bytes());
    std::fs::write(&path, bytes).unwrap();
    for _ in 0..2 {
        assert_eq!(
            incremental_run(&mut c, folder.path(), vec![1]).reused_count,
            0
        );
    }
}

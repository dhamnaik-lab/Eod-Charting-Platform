use super::*;
use crate::bhavcopy::{
    ingestion::{
        open_prepared_fixture_connection, parse_and_insert, parse_and_insert_normal_download,
    },
    parsers::{parse_bhavcopy_csv, parse_download_csv},
    Candidate,
};
use crate::database::set_price_storage_mode;

const DATE: &str = "2026-11-02";
const CSV_HEADER: &str = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,PREVCLOSE,TOTTRDQTY,TIMESTAMP\n";
fn fixture(mode: PriceStorageMode) -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("fixture.db");
    let db = open_prepared_fixture_connection(&path).unwrap();
    set_price_storage_mode(&db, mode).unwrap();
    drop(db);
    (dir, path)
}
fn equity(symbol: &str, date: &str, close: i64) -> String {
    format!("{CSV_HEADER}{symbol},EQ,{close},{close},{close},{close},{close},100,{date}\n")
}
fn store_path(db: &Path, symbol: &str) -> PathBuf {
    db.parent()
        .unwrap()
        .join("eod_data/NSE")
        .join(format!("{symbol}.eod"))
}
fn parsed(symbol: &str, date: &str, close: i64) -> ParsedBhavcopyFile {
    parse_bhavcopy_csv(&equity(symbol, date, close), "NSE", date, &[]).unwrap()
}
fn source(csv: &str) -> SourceEvidence {
    let mut e = SourceEvidence::default();
    e.note(csv, true, &[]);
    e
}

#[test]
fn bhav03bcd_checkpointed_exact_identity_receipts_across_40_dates() {
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let db = open_prepared_fixture_connection(&path).unwrap();
    let days = generate_calendar_days("2026-09-01", "2026-10-10").unwrap();
    assert_eq!(days.len(), 40);
    let mut files = vec![];
    let mut sources = BTreeMap::new();
    let mut records = vec![];
    for date in &days {
        let csv = equity("AAA", date, 100);
        let file = parsed("AAA", date, 100);
        records.push(file.rows[0].binary_record);
        files.push(file);
        sources.insert(("NSE".into(), date.clone()), source(&csv));
    }
    let binary = store_path(&path, "AAA");
    fs::create_dir_all(binary.parent().unwrap()).unwrap();
    BinaryEodFile::write_all(&binary, "AAA", "NSE", DEFAULT_SCALE, &mut records).unwrap();
    let mut receipts = prepare_receipts(&path, &files, &sources).unwrap();
    check_receipts(&db, path.parent().unwrap(), &mut receipts);
    assert!(receipts.values().all(Receipt::complete_scope));
    save_receipts(&db, &receipts, Some("fixture-pending-session")).unwrap();
    let verify = || verified_dates(&db, "NSE", "2026-09-01", "2026-10-10").unwrap();
    assert!(verify().dates.is_empty());
    checkpoint_receipts(&path, "wrong-session").unwrap();
    assert!(verify().dates.is_empty());
    checkpoint_receipts(&path, "fixture-pending-session").unwrap();
    let result = verify();
    assert_eq!(result.dates.len(), 40);
    assert_eq!(result.binary_reconcile_target_dates, 40);
    assert!(result.binary_reconcile_files_scanned <= 2);
    // Equal counts and dates under a different symbol are not membership proof.
    let wrong = store_path(&path, "BBB");
    BinaryEodFile::write_all(&wrong, "BBB", "NSE", DEFAULT_SCALE, &mut records).unwrap();
    fs::remove_file(&binary).unwrap();
    assert!(verify().dates.is_empty());
    BinaryEodFile::write_all(&binary, "AAA", "NSE", DEFAULT_SCALE, &mut records).unwrap();
    assert_eq!(verify().dates.len(), 40);
    db.execute(
        "UPDATE bhavcopy_coverage_v1 SET receipt_sha256='invalid' WHERE trade_date='2026-09-01'",
        [],
    )
    .unwrap();
    assert_eq!(verify().dates.len(), 39);
    // Corrupt duplicate date outside the queried final window must not be hidden by binary search.
    let mut bytes = fs::read(&binary).unwrap();
    let first_date = bytes[HEADER_SIZE..HEADER_SIZE + 4].to_vec();
    bytes[HEADER_SIZE + RECORD_SIZE..HEADER_SIZE + RECORD_SIZE + 4].copy_from_slice(&first_date);
    fs::write(&binary, bytes).unwrap();
    assert!(verified_dates(&db, "NSE", "2026-10-01", "2026-10-10")
        .unwrap()
        .dates
        .is_empty());
}

#[test]
fn bhav03bcd_missing_only_single_download_binary_and_hybrid() {
    for mode in [PriceStorageMode::Binary, PriceStorageMode::Hybrid] {
        let (_dir, path) = fixture(mode.clone());
        let first=format!("{CSV_HEADER}AAA,EQ,100,100,100,100,100,100,{DATE}\nBBB,EQ,200,200,200,200,200,100,{DATE}\n");
        parse_and_insert(&path, &first, "NSE", DATE, &[]).unwrap();
        let a = fs::read(store_path(&path, "AAA")).unwrap();
        let b = fs::read(store_path(&path, "BBB")).unwrap();
        let retry=format!("{CSV_HEADER}AAA,EQ,100,100,100,100,100,100,{DATE}\nBBB,EQ,201,201,201,201,201,100,{DATE}\nCCC,EQ,300,300,300,300,300,100,{DATE}\n");
        let (result, _, complete) =
            parse_and_insert_normal_download(&path, &retry, "NSE", DATE, &[]).unwrap();
        assert_eq!(result.rows_inserted, 1);
        assert_eq!(result.rows_replaced, 0);
        assert!(!complete);
        assert_eq!(fs::read(store_path(&path, "AAA")).unwrap(), a);
        assert_eq!(fs::read(store_path(&path, "BBB")).unwrap(), b);
        assert!(store_path(&path, "CCC").is_file());
        let db = open_prepared_fixture_connection(&path).unwrap();
        assert!(verified_dates(&db, "NSE", DATE, DATE)
            .unwrap()
            .dates
            .is_empty());
        if mode == PriceStorageMode::Hybrid {
            let close:f64=db.query_row("SELECT close FROM eod_prices WHERE exchange='NSE' AND symbol='BBB' AND date=?1",[DATE],|r|r.get(0)).unwrap();
            assert_eq!(close, 200.0);
        }
        let (again, _, complete) =
            parse_and_insert_normal_download(&path, &retry, "NSE", DATE, &[]).unwrap();
        assert_eq!(again.rows_inserted, 0);
        assert_eq!(again.rows_replaced, 0);
        assert!(!complete);
    }
}

#[test]
fn bhav03bcd_exact_rerun_reconciles_legacy_error_without_price_write() {
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let csv = equity("AAA", DATE, 100);
    parse_and_insert(&path, &csv, "NSE", DATE, &[]).unwrap();
    let bytes = fs::read(store_path(&path, "AAA")).unwrap();
    let db = open_prepared_fixture_connection(&path).unwrap();
    db.execute("INSERT INTO download_log(trade_date,exchange,rows_inserted,max_volume,status) VALUES(?1,'NSE',0,0,'error') ON CONFLICT(trade_date,exchange) DO UPDATE SET rows_inserted=0,max_volume=0,status='error'",[DATE]).unwrap();
    assert!(verified_dates(&db, "NSE", DATE, DATE)
        .unwrap()
        .dates
        .is_empty());
    let (result, _, complete) =
        parse_and_insert_normal_download(&path, &csv, "NSE", DATE, &[]).unwrap();
    assert!(complete);
    assert_eq!(result.rows_inserted, 0);
    assert_eq!(result.rows_replaced, 0);
    assert_eq!(fs::read(store_path(&path, "AAA")).unwrap(), bytes);
    let status: (String, i64) = db
        .query_row(
            "SELECT status,rows_inserted FROM download_log WHERE exchange='NSE' AND trade_date=?1",
            [DATE],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, ("ok".into(), 1));
    assert!(verified_dates(&db, "NSE", DATE, DATE)
        .unwrap()
        .dates
        .contains(DATE));
}

#[test]
fn bhav03bcd_hybrid_one_sided_price_is_held() {
    let (_dir, path) = fixture(PriceStorageMode::Hybrid);
    let db = open_prepared_fixture_connection(&path).unwrap();
    let mut files = vec![parsed("AAA", DATE, 100)];
    let mut records = vec![files[0].rows[0].binary_record];
    let binary = store_path(&path, "AAA");
    fs::create_dir_all(binary.parent().unwrap()).unwrap();
    BinaryEodFile::write_all(&binary, "AAA", "NSE", DEFAULT_SCALE, &mut records).unwrap();
    let original = fs::read(&binary).unwrap();
    let outcome = guard_missing_only(&path, &mut files).unwrap();
    assert!(files[0].rows.is_empty());
    assert_eq!(outcome[&("NSE".into(), DATE.into())].held, 1);
    assert_eq!(fs::read(&binary).unwrap(), original);
    let n: i64 = db
        .query_row("SELECT count(*) FROM eod_prices", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 0);
}

#[test]
fn bhav03bcd_prior_close_inference_preserved_after_filtering() {
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let first="SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\nAAA,EQ,100,100,100,100,100,2026-11-02\n";
    let second = first.replace(
        "100,100,100,100,100,2026-11-02",
        "101,101,101,101,100,2026-11-03",
    );
    parse_and_insert(&path, first, "NSE", "2026-11-02", &[]).unwrap();
    let mut files = vec![
        parse_bhavcopy_csv(first, "NSE", "2026-11-02", &[]).unwrap(),
        parse_bhavcopy_csv(&second, "NSE", "2026-11-03", &[]).unwrap(),
    ];
    guard_missing_only(&path, &mut files).unwrap();
    assert!(files[0].rows.is_empty());
    assert_eq!(
        files[1].rows[0].binary_record.prev_close,
        100 * DEFAULT_SCALE as i64
    );
}

#[test]
fn bhav03bcd_update_missed_date_cooldown_and_fair_cap() {
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let db = open_prepared_fixture_connection(&path).unwrap();
    for (date, status, count) in [
        ("2026-08-01", "error", 0),
        ("2026-11-02", "error", 0),
        ("2026-11-03", "ok", 100),
        ("2026-11-20", "ok", 100),
    ] {
        db.execute("INSERT INTO download_log(trade_date,exchange,status,rows_inserted,max_volume,downloaded_at) VALUES(?1,'NSE',?2,?3,100,'2026-08-01 00:00:00')",params![date,status,count]).unwrap();
    }
    db.execute("INSERT INTO bhavcopy_download_attempts(trade_date,exchange,outcome,rows_written,message,attempted_at) VALUES('2026-11-04','NSE','sourceError',0,'recent','2026-11-24 23:30:00')",[]).unwrap();
    let now = chrono::DateTime::parse_from_rfc3339("2026-11-25T00:00:00Z")
        .unwrap()
        .timestamp();
    // Mark all other candidate dates verified to isolate the Monday failure.
    let verified = generate_calendar_days("2026-08-28", "2026-11-25")
        .unwrap()
        .into_iter()
        .filter(|d| d != "2026-11-02" && d != "2026-11-04")
        .collect();
    let plan = update_retries(&db, "NSE", "2026-11-25", now, &verified).unwrap();
    assert_eq!(plan.dates, BTreeSet::from(["2026-11-02".to_string()]));
    assert_eq!(plan.deferred, 1);
    assert_eq!(plan.outside_window, 1);
    let later = update_retries(
        &db,
        "NSE",
        "2026-11-25",
        now + RETRY_COOLDOWN_SECS,
        &verified,
    )
    .unwrap();
    assert!(later.dates.contains("2026-11-04"));
    let many = update_retries(&db, "NSE", "2026-11-25", now, &HashSet::new()).unwrap();
    assert_eq!(many.dates.len(), RETRY_CAP);
    assert!(many.deferred > 0);
    assert!(many
        .dates
        .iter()
        .all(|d| d.as_str() >= "2026-08-28" && d.as_str() <= "2026-11-20"));
}

#[test]
fn bhav03bcd_index_quarantine_valid_subset_and_wrong_date_rejection() {
    let header="Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Volume\n";
    let csv=format!("{header}Nifty 50,{DATE},100,110,90,105,10\nNifty50 USD,{DATE},100,99,90,105,10\nNifty Bank,{DATE},100,110,90,105,bad\nNifty 1D Rate Index,{DATE},-,-,-,105,-\n");
    assert!(parse_bhavcopy_csv(&csv, "NSE_INDEX", DATE, &[]).is_err());
    let (file, rejected) = parse_download_csv(&csv, "NSE_INDEX", DATE).unwrap();
    assert_eq!(file.rows.len(), 1);
    assert_eq!(file.rows[0].symbol, "NIFTY");
    assert_eq!(rejected.len(), 3);
    assert_eq!(rejected.iter().filter(|r| r.close_only).count(), 1);
    assert!(parse_download_csv(
        &csv.replace(&format!("Nifty50 USD,{DATE}"), "Nifty50 USD,2026-11-03"),
        "NSE_INDEX",
        DATE
    )
    .is_err());
    assert!(parse_download_csv(
        &csv.replace("Index Date,", "Missing Date,"),
        "NSE_INDEX",
        DATE
    )
    .is_err());
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let candidate = Candidate::direct("https://example.invalid/index.csv".into(), false);
    let all_invalid = format!("{header}Nifty50 USD,{DATE},100,99,90,105,10\n");
    assert!(super::super::decode_candidate_csv_with_evidence(
        &candidate,
        all_invalid.into_bytes(),
        "NSE_INDEX",
        DATE,
        Some(&path)
    )
    .is_err());
    let evidence = fs::read_dir(path.parent().unwrap().join("bhavcopy_index_evidence"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let json: serde_json::Value = serde_json::from_slice(&fs::read(evidence).unwrap()).unwrap();
    assert_eq!(json["date"], DATE);
    assert_eq!(json["rows"][0]["symbol"], "Nifty50 USD");
}

#[test]
fn bhav03bcd_historical_fallback_receipt_never_certifies_whole_archive() {
    let (_dir, path) = fixture(PriceStorageMode::Binary);
    let db = open_prepared_fixture_connection(&path).unwrap();
    let csv=format!("Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Volume\nNifty 50,{DATE},100,110,90,105,0\n");
    let file = parse_download_csv(&csv, "NSE_INDEX", DATE).unwrap().0;
    let mut source = SourceEvidence::default();
    source.note(&csv, false, &[]);
    let key = ("NSE_INDEX".to_string(), DATE.to_string());
    let mut receipts =
        prepare_receipts(&path, &[file], &BTreeMap::from([(key.clone(), source)])).unwrap();
    check_receipts(&db, path.parent().unwrap(), &mut receipts);
    save_receipts(&db, &receipts, None).unwrap();
    assert!(!receipts[&key].complete_scope());
    assert!(verified_dates(&db, "NSE_INDEX", DATE, DATE)
        .unwrap()
        .dates
        .is_empty());
}

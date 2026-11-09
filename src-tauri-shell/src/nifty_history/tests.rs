use super::*;
use crate::database::{prepare_database_connection, set_price_storage_mode};
use crate::manual_import_recovery::{list_session_summaries, undo_session};
use tempfile::tempdir;

pub(crate) fn setup_db(path: &Path) -> Connection {
    let c = Connection::open(path).unwrap();
    c.execute_batch("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
        CREATE TABLE instruments (symbol TEXT, exchange TEXT, name TEXT, series TEXT, isin TEXT, sector TEXT, industry TEXT, is_active INTEGER DEFAULT 1, lifecycle_status TEXT DEFAULT 'CURRENT', updated_at TEXT, PRIMARY KEY(symbol,exchange));
        CREATE TABLE eod_prices (symbol TEXT, exchange TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, prev_close REAL, volume INTEGER, open_interest INTEGER, PRIMARY KEY(symbol,exchange,date));").unwrap();
    prepare_database_connection(&c).unwrap();
    set_price_storage_mode(&c, PriceStorageMode::Binary).unwrap();
    c
}

fn official(date: &str, name: &str, close: f64) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({"data":[{"EOD_INDEX_NAME":name,
        "EOD_TIMESTAMP":date,"EOD_OPEN_INDEX_VAL":100.0,"EOD_HIGH_INDEX_VAL":110.0,
        "EOD_LOW_INDEX_VAL":90.0,"EOD_CLOSE_INDEX_VAL":close,"HIT_TRADED_QTY":1000}]}))
    .unwrap()
}

fn input(file: Option<&Path>) -> NiftyHistoryInput {
    NiftyHistoryInput {
        file_path: file.map(|p| p.to_string_lossy().into()),
        from_date: "2024-01-01".into(),
        to_date: "2024-12-31".into(),
        verify_official: true,
    }
}

fn review(db: &Path, file: Option<&Path>) -> Review {
    preview_internal(
        db,
        &input(file),
        Some((
            "https://www.nseindia.com/api/historicalOR/indicesHistory?test-fixture".into(),
            official("02-JAN-2024", "CNX Nifty", 105.0),
        )),
        "2026-11-02",
    )
    .unwrap()
}

#[test]
fn historical_dates_reject_impossible_and_parse_supported_formats() {
    for value in [
        "1990-07-03",
        "03 Jul 1990",
        "03-JUL-1990",
        "03-07-1990",
        "19900703",
    ] {
        assert_eq!(historical_date(value).unwrap(), "1990-07-03");
    }
    assert!(historical_date("31-02-2024").is_err());
    assert!(historical_date("07/03/90").is_err());
}

#[test]
fn official_partial_ohlc_after_launch_retains_observations_without_a_candle() {
    let bytes = br#"{"data":[{"EOD_INDEX_NAME":"S&P CNX NIFTY","EOD_TIMESTAMP":"30-OCT-1996","EOD_OPEN_INDEX_VAL":0,"EOD_HIGH_INDEX_VAL":929.03,"EOD_LOW_INDEX_VAL":929.03,"EOD_CLOSE_INDEX_VAL":929.03}]}"#;
    let mut rows = parse_official(bytes, "1996-10-30", "1996-10-30", "2026-11-02").unwrap();
    assert_eq!(rows[0].open, None);
    assert_eq!(rows[0].high, Some(929.03));
    assert!(rows[0].record().is_err());
    let reference = rows.clone();
    assert!(verify_rows(&mut rows, &reference).is_empty());
    assert_eq!(rows[0].status, "HOLD");
}

#[test]
fn local_close_only_and_aliases_never_manufacture_candles() {
    let rows = parse_local(b"Index Name,Date,Open,High,Low,Close\nS&P CNX Nifty,03 Jul 1990,-,-,-,279.02\nCNX Nifty,02 Jan 2024,100,110,90,105\n", "2026-11-02").unwrap();
    assert!(rows[0].record().is_err());
    assert_eq!(rows[0].close, Some(279.02));
    assert_eq!(map_index_symbol(&rows[1].original_name), "NIFTY");
    assert_eq!(rows[1].volume, None);
}

#[test]
fn invalid_ohlc_duplicates_unrelated_names_and_future_are_rejected() {
    let csv = b"Index Name,Date,Open,High,Low,Close\nNIFTY 50,2024-01-02,100,99,90,105\nNIFTY 50,2024-01-03,NaN,110,90,105\nNIFTY BANK,2024-01-04,100,110,90,105\nNIFTY 50,2024-01-05,100,110,90,105\nNIFTY 50,2024-01-05,101,110,90,105\nNIFTY 50,2099-01-01,100,110,90,105\n";
    let rows = parse_local(csv, "2026-11-02").unwrap();
    assert_eq!(rows.iter().filter(|r| r.status == "REJECTED").count(), 6);
    assert!(validate_ohlc([100., f64::INFINITY, 90., 100.]).is_err());
}

#[test]
fn official_identity_range_schema_and_duplicates_fail_closed() {
    for bytes in [
        official("02-JAN-2024", "NIFTY BANK", 105.),
        official("02-JAN-2025", "NIFTY 50", 105.),
        official("02-JAN-2024", "NIFTY 50", 111.),
        b"<html>Denied</html>".to_vec(),
    ] {
        assert!(parse_official(&bytes, "2024-01-01", "2024-12-31", "2026-11-02").is_err());
    }
    let mut j: serde_json::Value =
        serde_json::from_slice(&official("02-JAN-2024", "NIFTY 50", 105.)).unwrap();
    let row = j["data"][0].clone();
    j["data"].as_array_mut().unwrap().push(row);
    assert!(parse_official(
        &serde_json::to_vec(&j).unwrap(),
        "2024-01-01",
        "2024-12-31",
        "2026-11-02"
    )
    .unwrap_err()
    .contains("duplicate"));
}

#[test]
fn local_source_disagreement_and_absent_official_dates_are_held() {
    let mut rows=parse_local(b"Index Name,Date,Open,High,Low,Close\nNIFTY 50,2024-01-02,100,110,90,104\nNIFTY 50,2024-01-03,100,110,90,105\n","2026-11-02").unwrap();
    let reference = parse_official(
        &official("02-JAN-2024", "NIFTY 50", 105.),
        "2024-01-01",
        "2024-12-31",
        "2026-11-02",
    )
    .unwrap();
    assert!(verify_rows(&mut rows, &reference).is_empty());
    assert_eq!(rows[0].status, "CONFLICT");
    assert_eq!(rows[1].status, "HOLD");
}

#[test]
fn prelaunch_prices_and_close_only_conflicts_remain_outside_analytics() {
    let mut rows=parse_local(b"Index Name,Date,Open,High,Low,Close\nCNX Nifty,01 Nov 1995,-,-,-,1004.50\nCNX Nifty,10 Nov 1995,100,110,90,105\n","2026-11-02").unwrap();
    let mut reference = rows.clone();
    reference[0].close = Some(1004.59);
    assert!(verify_rows(&mut rows, &reference).is_empty());
    assert_eq!(rows[0].status, "CONFLICT");
    assert_eq!(rows[1].status, "HOLD");
}

#[test]
fn bounded_official_range_is_explicit_and_future_is_rejected() {
    let mut request = input(None);
    assert!(validate_window(&request, "2026-11-02").is_ok());
    request.from_date = "1990-07-03".into();
    assert!(validate_window(&request, "2026-11-02").is_err());
    request.verify_official = false;
    request.file_path = Some("local.csv".into());
    assert!(validate_window(&request, "2026-11-02").is_ok());
    request.to_date = "2099-01-01".into();
    assert!(validate_window(&request, "2026-11-02").is_err());
}

#[test]
fn unverified_local_file_cannot_apply_and_evidence_is_preserved() {
    let dir = tempdir().unwrap();
    let db = dir.path().join("test.db");
    let _c = setup_db(&db);
    let csv = dir.path().join("local.csv");
    let bytes = b"Index Name,Date,Open,High,Low,Close\nNIFTY 50,2024-01-02,100,110,90,105\n";
    fs::write(&csv, bytes).unwrap();
    let mut request = input(Some(&csv));
    request.verify_official = false;
    let review = preview_internal(&db, &request, None, "2026-11-02").unwrap();
    assert_eq!(review.preview.ready, 0);
    assert_eq!(review.preview.held, 1);
    assert!(apply_internal(&review).is_err());
    assert_eq!(
        fs::read(Path::new(&review.preview.evidence_path).join("original.csv")).unwrap(),
        bytes
    );
    assert!(!dir.path().join("eod_data/NSE_INDEX/NIFTY.eod").exists());
}

#[test]
fn alias_existing_bars_skip_and_conflicts_preserve_original_bytes() {
    let dir = tempdir().unwrap();
    let db = dir.path().join("test.db");
    let _c = setup_db(&db);
    let prepared = review(&db, None);
    let path = dir.path().join("eod_data/NSE_INDEX/SPCNXNIFTY.eod");
    let mut records = vec![prepared.verified[0].record().unwrap()];
    BinaryEodFile::write_all(
        &path,
        "SPCNXNIFTY",
        "NSE_INDEX",
        DEFAULT_SCALE,
        &mut records,
    )
    .unwrap();
    let equal = review(&db, None);
    assert_eq!(equal.preview.existing, 1);
    assert_eq!(equal.preview.ready, 0);
    records[0].close += 1;
    BinaryEodFile::write_all(
        &path,
        "SPCNXNIFTY",
        "NSE_INDEX",
        DEFAULT_SCALE,
        &mut records,
    )
    .unwrap();
    let before = fs::read(&path).unwrap();
    let conflict = review(&db, None);
    assert_eq!(conflict.preview.conflicts, 1);
    assert!(apply_internal(&conflict).is_err());
    assert!(apply_internal(&prepared).is_err()); // Apply-time recheck catches the intervening write.
    assert_eq!(fs::read(&path).unwrap(), before);
}

#[test]
fn verified_backfill_reads_binary_retries_idempotently_and_undoes() {
    let dir = tempdir().unwrap();
    let db = dir.path().join("test.db");
    let _c = setup_db(&db);
    let reviewed = review(&db, None);
    assert_eq!(reviewed.preview.ready, 1);
    let result = apply_internal(&reviewed).unwrap();
    assert!(result.success);
    assert_eq!(result.rows_inserted, 1);
    let path = dir.path().join("eod_data/NSE_INDEX/NIFTY.eod");
    let bytes = fs::read(&path).unwrap();
    let file = BinaryEodFile::open(&path).unwrap();
    assert_eq!(file.read_all().unwrap()[0].close, 1_050_000);
    let repeat = apply_internal(&reviewed).unwrap();
    assert_eq!(repeat.rows_inserted, 0);
    assert_eq!(repeat.rows_skipped, 1);
    assert_eq!(fs::read(&path).unwrap(), bytes);
    let sessions = list_session_summaries(dir.path()).unwrap();
    assert_eq!(sessions.len(), 1);
    let mut connection = Connection::open(&db).unwrap();
    let undo = undo_session(&db, &mut connection, &sessions[0].session_id, |_, _, _| {}).unwrap();
    assert!(undo.success);
    assert!(
        !path.exists()
            || BinaryEodFile::open(&path)
                .unwrap()
                .read_all()
                .unwrap()
                .is_empty()
    );
}

#[test]
fn interrupted_import_journal_restores_only_its_inserted_bar() {
    use crate::manual_import_recovery::{
        prepare_binary_import_session, update_session_state, ManualImportRecoveryState,
    };
    let dir = tempdir().unwrap();
    let db = dir.path().join("test.db");
    let mut c = setup_db(&db);
    let prepared = review(&db, None);
    let record = prepared.verified[0].record().unwrap();
    let records = HashMap::from([("NIFTY".into(), vec![record])]);
    let source = Path::new(&prepared.preview.evidence_path).join("original.json");
    let mut handle = prepare_binary_import_session(
        &db,
        &c,
        "NSE_INDEX",
        "skip",
        &[source],
        1,
        0,
        &std::collections::HashSet::from(["NIFTY".into()]),
        &records,
    )
    .unwrap()
    .unwrap();
    update_session_state(
        &mut handle,
        ManualImportRecoveryState::Applying,
        None,
        None,
        None,
    )
    .unwrap();
    c.execute(
        "INSERT INTO instruments(symbol,exchange,name) VALUES('NIFTY','NSE_INDEX','NIFTY')",
        [],
    )
    .unwrap();
    let path = dir.path().join("eod_data/NSE_INDEX/NIFTY.eod");
    BinaryEodFile::write_all(
        &path,
        "NIFTY",
        "NSE_INDEX",
        DEFAULT_SCALE,
        &mut vec![record],
    )
    .unwrap();
    // Simulate process death after binary write, before APPLIED; reopen retained journal.
    let session = list_session_summaries(dir.path()).unwrap().remove(0);
    assert!(session.undoable);
    assert!(
        undo_session(&db, &mut c, &session.session_id, |_, _, _| {})
            .unwrap()
            .success
    );
    assert!(
        !path.exists()
            || BinaryEodFile::open(path)
                .unwrap()
                .read_all()
                .unwrap()
                .is_empty()
    );
}

#[test]
fn source_tampering_and_nonbinary_storage_block_apply() {
    let dir = tempdir().unwrap();
    let db = dir.path().join("test.db");
    let c = setup_db(&db);
    let prepared = review(&db, None);
    fs::write(
        Path::new(&prepared.preview.evidence_path).join("official.json"),
        b"changed",
    )
    .unwrap();
    assert!(apply_internal(&prepared)
        .unwrap_err()
        .contains("evidence changed"));
    set_price_storage_mode(&c, PriceStorageMode::Hybrid).unwrap();
    assert!(preview_internal(
        &db,
        &input(None),
        Some(("fixture".into(), official("02-JAN-2024", "NIFTY", 105.))),
        "2026-11-02"
    )
    .is_err());
}

// Used by the chart-query integration test in the owning database module.
pub(crate) fn import_synthetic_verified_fixture(db: &Path) {
    setup_db(db);
    assert!(apply_internal(&review(db, None)).unwrap().success);
}

pub(crate) fn import_captured_verified_fixture() -> (PathBuf, usize) {
    let root = PathBuf::from(
        std::env::var("EOD_NIFTY_CERT_FIXTURE_ROOT").expect("Explicit new fixture root required"),
    );
    assert!(
        !root.exists(),
        "Never reuse or overwrite an existing database/evidence folder"
    );
    let source = PathBuf::from(std::env::var("EOD_NIFTY_CERT_SOURCE").unwrap());
    let official_path = PathBuf::from(std::env::var("EOD_NIFTY_CERT_OFFICIAL").unwrap());
    fs::create_dir(&root).unwrap();
    let db = root.join("test.sqlite3");
    setup_db(&db);
    let request = input(Some(&source));
    let reviewed = preview_internal(&db, &request, Some((
        "https://www.nseindia.com/api/historicalOR/indicesHistory?indexType=NIFTY%2050&from=01-01-2024&to=31-12-2024&csv=true".into(),
        bounded_read(&official_path).unwrap(),
    )), "2026-11-02").unwrap();
    assert!(reviewed.preview.held > 0);
    let expected = reviewed.verified.len();
    assert!(expected > 200);
    let result = apply_internal(&reviewed).unwrap();
    assert!(result.success);
    assert_eq!(result.rows_inserted, expected);
    let bin = root.join("eod_data/NSE_INDEX/NIFTY.eod");
    let before = fs::read(&bin).unwrap();
    let records = BinaryEodFile::open(&bin).unwrap().read_all().unwrap();
    assert_eq!(records.len(), expected);
    for row in &reviewed.verified {
        assert_eq!(
            records.iter().find(|r| r.date == date_to_u32(&row.date)),
            Some(&row.record().unwrap())
        );
    }
    assert_eq!(apply_internal(&reviewed).unwrap().rows_inserted, 0);
    assert_eq!(fs::read(&bin).unwrap(), before);
    fs::write(root.join("integration-result.json"), serde_json::to_vec_pretty(&serde_json::json!({
        "status":"PASS", "sourceRows":reviewed.preview.source_rows,
        "verifiedImportedRows":expected, "held":reviewed.preview.held,
        "sourceSha256":reviewed.preview.source_sha256, "officialSha256":reviewed.preview.official_sha256,
        "binarySha256":hash(&before), "allImportedBarsReadbackEqual":true,
        "repeatInserted":0, "activeDatabaseAccessed":false, "recoverySession":result.recovery_session
    })).unwrap()).unwrap();
    (db, expected)
}

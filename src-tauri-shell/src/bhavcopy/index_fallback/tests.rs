use super::*;
use crate::database::set_price_storage_mode;

fn request(symbol: &str, dates: &[&str]) -> Request {
    requests(symbol, &dates.iter().map(|s| s.to_string()).collect())
        .unwrap()
        .remove(0)
}
fn json_row(name: &str, date: &str, close: f64) -> serde_json::Value {
    serde_json::json!({"EOD_INDEX_NAME": name, "EOD_TIMESTAMP": date,
        "EOD_OPEN_INDEX_VAL": 100.0, "EOD_HIGH_INDEX_VAL": 110.0,
        "EOD_LOW_INDEX_VAL": 90.0, "EOD_CLOSE_INDEX_VAL": close, "HIT_TRADED_QTY": null})
}
fn payload(rows: Vec<serde_json::Value>) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({"data": rows})).unwrap()
}
fn config() -> BatchDownloadConfig {
    BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: false,
            bse: false,
            nse_index: true,
            bse_index: false,
        },
        start_date: "2011-01-03".into(),
        end_date: "2011-01-07".into(),
        workers: 2,
        excluded_series: vec![],
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    }
}
fn parsed(name: &str, date: &str, close: f64) -> ParsedBhavcopyFile {
    parse_bhavcopy_csv(&format!("INDEX_NAME,INDEX_DATE,OPEN_INDEX_VALUE,HIGH_INDEX_VALUE,LOW_INDEX_VALUE,CLOSING_INDEX_VALUE,VOLUME\n{name},{date},100,110,90,{close},0\n"), "NSE_INDEX", date, &[]).unwrap()
}

#[test]
fn multi_year_leap_chunks_have_no_overlap_and_no_2012_cutoff() {
    let dates: BTreeSet<_> = generate_calendar_days("2010-01-01", "2013-01-04")
        .unwrap()
        .into_iter()
        .collect();
    let chunks = requests("NIFTY", &dates).unwrap();
    let mut visited = BTreeSet::new();
    for chunk in chunks {
        assert!(
            (parse_trade_date(&chunk.task.to_date).unwrap()
                - parse_trade_date(&chunk.task.from_date).unwrap())
            .num_days()
                <= 365
        );
        for date in chunk.dates {
            assert!(visited.insert(date));
        }
    }
    assert_eq!(visited, dates);
    assert_eq!(
        request("NIFTY", &["2026-11-02"]).task.from_date,
        "2026-11-02"
    );
}

#[test]
fn observed_six_aliases_are_explicit_and_unknown_volume_is_preserved() {
    for (index, name) in SUPPORTED.iter().zip([
        "S&P CNX NIFTY",
        "CNX BANK",
        "CNX NIFTY JUNIOR",
        "CNX 100",
        "CNX 500",
        "CNX IT",
    ]) {
        let parsed = normalize(
            &payload(vec![json_row(name, "03-Jan-2011", 105.0)]),
            &request(index.symbol, &["2011-01-03"]),
            "2026-11-03",
        )
        .unwrap();
        assert_eq!(parsed.rows.len(), 1, "{name}");
        assert_eq!(parsed.rows[0].volume, None);
    }
}

#[test]
fn nifty_it_and_nifty_500_admit_2010_with_legacy_names() {
    let dates = ["2009-12-31", "2010-01-04"];
    for (symbol, name) in [("NIFTYIT", "CNX IT"), ("NIFTY500", "S&P CNX 500")] {
        let bytes = payload(vec![
            json_row(name, "31-Dec-2009", 104.0),
            json_row(name, "04-Jan-2010", 105.0),
        ]);
        let out = normalize(&bytes, &request(symbol, &dates), "2026-11-04").unwrap();
        assert!(out.held.contains_key(dates[0]));
        assert_eq!(out.rows.len(), 1);
        assert_eq!(out.rows[0].date, dates[1]);
    }
}

#[test]
fn wrong_identity_out_of_bounds_and_refusal_are_errors_not_empty_coverage() {
    let r = request("NIFTY", &["2011-01-03"]);
    for row in [
        json_row("NIFTY BANK", "03-Jan-2011", 105.0),
        json_row("Unknown NIFTY", "03-Jan-2011", 105.0),
        json_row("NIFTY 50", "04-Jan-2011", 105.0),
    ] {
        assert!(normalize(&payload(vec![row]), &r, "2026-11-03").is_err());
    }
    assert!(normalize(
        br#"{"error":true,"showMessage":"Denied"}"#,
        &r,
        "2026-11-03"
    )
    .is_err());
    assert!(normalize(br#"{}"#, &r, "2026-11-03").is_err());
    assert!(normalize(br#"{"data":[]}"#, &r, "2026-11-03")
        .unwrap()
        .rows
        .is_empty());
}

#[test]
fn captured_nifty500_legacy_name_accepts_five_rows_and_preserves_identity_guards() {
    let bytes = include_bytes!("fixtures/nifty500-20110103-20110107.json");
    let bytes = bytes.strip_suffix(b"\n").unwrap_or(bytes);
    assert_eq!(
        format!("{:x}", Sha256::digest(bytes)),
        "dda1e684315179ac55b4d447ce09fe73cc3f10c22712317dff431947a02d9d5e"
    );
    let dates = [
        "2011-01-03",
        "2011-01-04",
        "2011-01-05",
        "2011-01-06",
        "2011-01-07",
    ];
    let out = normalize(bytes, &request("NIFTY500", &dates), "2026-11-04").unwrap();
    assert_eq!(out.rows.len(), 5);
    assert!(out.held.is_empty());
    assert_eq!(
        out.rows.iter().map(|r| r.date.as_str()).collect::<Vec<_>>(),
        dates
    );
    assert!(out.rows.iter().all(|r| r.name == "S&P CNX 500"));
    assert_eq!(out.rows[0].prices, [4964.5, 4980.45, 4959.9, 4967.3]);
    assert_eq!(out.rows[0].volume, Some(419130570));
    assert_eq!(
        nse_index_alias_family("SPCNX500").unwrap().canonical,
        "NIFTY500"
    );
    assert!(nse_index_alias_family("SPCNX500SHARIAH").is_none());
    assert!(normalize(bytes, &request("NIFTY100", &dates), "2026-11-04")
        .err()
        .unwrap()
        .contains("Wrong response identity"));
    let bad = payload(vec![json_row("S&P CNX 500 UNKNOWN", "03-Jan-2011", 105.0)]);
    assert!(
        normalize(&bad, &request("NIFTY500", &["2011-01-03"]), "2026-11-04")
            .err()
            .unwrap()
            .contains("Unknown index alias: S&P CNX 500 UNKNOWN")
    );
}

#[test]
fn resolved_intervening_dates_are_filtered_and_duplicates_are_held() {
    let r = request("NIFTY", &["2011-01-03", "2011-01-05"]);
    let a = json_row("NIFTY 50", "03-Jan-2011", 105.0);
    let out = normalize(
        &payload(vec![
            a.clone(),
            a,
            json_row("NIFTY 50", "04-Jan-2011", 105.0),
            json_row("NIFTY 50", "05-Jan-2011", 105.0),
            json_row("NIFTY 50", "05-Jan-2011", 106.0),
        ]),
        &r,
        "2026-11-03",
    )
    .unwrap();
    assert_eq!(out.rows.len(), 1);
    assert_eq!(out.identical_duplicates, 1);
    assert_eq!(out.outside_unresolved_set, 1);
    assert_eq!(out.held.len(), 1);
}

#[test]
fn partial_ohlc_bad_volume_and_prelaunch_never_become_candles() {
    for field in [
        "EOD_OPEN_INDEX_VAL",
        "EOD_HIGH_INDEX_VAL",
        "EOD_LOW_INDEX_VAL",
    ] {
        let mut row = json_row("NIFTY 50", "03-Jan-2011", 105.0);
        row[field] = serde_json::Value::Null;
        let out = normalize(
            &payload(vec![row]),
            &request("NIFTY", &["2011-01-03"]),
            "2026-11-03",
        )
        .unwrap();
        assert!(out.rows.is_empty());
        assert_eq!(out.held.len(), 1);
    }
    let mut row = json_row("NIFTY 50", "03-Jan-2011", 105.0);
    row["HIT_TRADED_QTY"] = serde_json::json!(-1);
    assert!(normalize(
        &payload(vec![row]),
        &request("NIFTY", &["2011-01-03"]),
        "2026-11-03"
    )
    .unwrap()
    .rows
    .is_empty());
    let out = normalize(
        &payload(vec![json_row("NIFTY 50", "03-Jan-1995", 105.0)]),
        &request("NIFTY", &["1995-01-03"]),
        "2026-11-03",
    )
    .unwrap();
    assert!(out.rows.is_empty());
    assert_eq!(out.held.len(), 1);
}

#[test]
fn additive_binary_alias_conflict_and_rerun_preserve_existing_bytes() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);
    let alias = parsed("NIFTY 50", "2011-01-03", 105.0).rows[0].binary_record;
    let path = temp.path().join("eod_data/NSE_INDEX/CNXNIFTY.eod");
    BinaryEodFile::write_all(&path, "CNXNIFTY", "NSE_INDEX", DEFAULT_SCALE, &mut [alias]).unwrap();
    let before = fs::read(&path).unwrap();
    let mut files = vec![
        parsed("NIFTY 50", "2011-01-03", 106.0),
        parsed("NIFTY 50", "2011-01-04", 105.0),
    ];
    let outcomes = guard_additive(&db, &mut files).unwrap();
    assert_eq!(outcomes["2011-01-03"].conflicts, 1);
    assert!(files[0].rows.is_empty());
    let (_, timing) = insert_parsed_bhavcopy_files(&db, &files).unwrap();
    assert_eq!(timing.binary_errors, 0);
    assert_eq!(fs::read(&path).unwrap(), before);
    let canonical = temp.path().join("eod_data/NSE_INDEX/NIFTY.eod");
    let inserted = fs::read(&canonical).unwrap();
    let mut rerun = vec![
        parsed("NIFTY 50", "2011-01-03", 105.0),
        parsed("NIFTY 50", "2011-01-04", 105.0),
    ];
    let outcomes = guard_additive(&db, &mut rerun).unwrap();
    assert_eq!(outcomes.values().map(|o| o.identical).sum::<usize>(), 2);
    assert!(rerun.iter().all(|f| f.rows.is_empty()));
    assert_eq!(fs::read(&canonical).unwrap(), inserted);
}

#[test]
fn additive_long_headers_keep_full_filename_ownership_and_prefixes_separate() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    let names = [
        "NIFTY500LARGEMIDSMALLEQUALCAPWEIGHTED",
        "NIFTY500LARGEMIDSMALLEQUALCAPWEIGHTEDOTHER",
    ];
    assert_eq!(&names[0][..32], &names[1][..32]);
    for (name, close) in names.iter().zip([105.0, 106.0]) {
        conn.execute(
            "INSERT INTO instruments(symbol,exchange) VALUES (?1,'NSE_INDEX')",
            [name],
        )
        .unwrap();
        let record = parsed(name, "2026-10-26", close).rows[0].binary_record;
        BinaryEodFile::write_all(
            temp.path().join(format!("eod_data/NSE_INDEX/{name}.eod")),
            name,
            "NSE_INDEX",
            DEFAULT_SCALE,
            &mut [record],
        )
        .unwrap();
    }
    let symbols = names.iter().map(|s| s.to_string()).collect();
    let existing = existing_rows(&db, &symbols, "2026-10-26", "2026-10-26").unwrap();
    assert_ne!(
        existing[&(names[0].into(), "2026-10-26".into())],
        existing[&(names[1].into(), "2026-10-26".into())]
    );
    let path = temp
        .path()
        .join(format!("eod_data/NSE_INDEX/{}.eod", names[0]));
    let before = fs::read(&path).unwrap();
    let mut files = vec![
        parsed(names[0], "2026-10-26", 105.0),
        parsed(names[1], "2026-10-26", 105.0),
        parsed(names[0], "2026-10-27", 105.0),
    ];
    let out = guard_additive(&db, &mut files).unwrap();
    assert_eq!(out["2026-10-26"].identical, 1);
    assert_eq!(out["2026-10-26"].conflicts, 1);
    assert_eq!(out["2026-10-27"].inserted_candidates, 1);
    assert_eq!(fs::read(&path).unwrap(), before);
    conn.execute("DELETE FROM instruments WHERE symbol=?1", [names[0]])
        .unwrap();
    assert!(existing_rows(&db, &symbols, "2026-10-26", "2026-10-26")
        .unwrap_err()
        .contains("identity/scale mismatch"));
    conn.execute(
        "INSERT INTO instruments(symbol,exchange) VALUES (?1,'NSE')",
        [names[0]],
    )
    .unwrap();
    assert!(existing_rows(&db, &symbols, "2026-10-26", "2026-10-26").is_err());
}

#[test]
fn additive_headers_reject_real_symbol_exchange_and_zero_scale_mismatches() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    let long = "NIFTY500LARGEMIDSMALLEQUALCAPWEIGHTED";
    conn.execute(
        "INSERT INTO instruments(symbol,exchange) VALUES (?1,'NSE_INDEX')",
        [long],
    )
    .unwrap();
    for name in ["NIFTY", long] {
        let path = temp.path().join(format!("eod_data/NSE_INDEX/{name}.eod"));
        let symbols = BTreeSet::from([name.to_string()]);
        for (header, exchange, scale) in [
            ("WRONG", "NSE_INDEX", DEFAULT_SCALE),
            (name, "NSE", DEFAULT_SCALE),
            (name, "NSE_INDEX", 0),
        ] {
            let record = parsed(name, "2026-10-26", 105.0).rows[0].binary_record;
            BinaryEodFile::write_all(&path, header, exchange, scale, &mut [record]).unwrap();
            assert!(existing_rows(&db, &symbols, "2026-10-26", "2026-10-26").is_err());
        }
    }
    assert!(existing_rows(
        &db,
        &BTreeSet::from(["../NIFTY".into()]),
        "2026-10-26",
        "2026-10-26"
    )
    .is_err());
}

#[test]
fn captured_daily_archive_long_names_reach_guard_and_additive_writer() {
    let csv = include_str!("fixtures/nse-indices-20261103.csv");
    assert_eq!(
        format!("{:x}", Sha256::digest(csv.as_bytes())),
        "510b52ed9562b6d1d071ae81719c0af07d8a698ea8bd4bd61254ed0ec688425c"
    );
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    let report = parse_bhavcopy_csv(csv, "NSE_INDEX", "2026-11-03", &[]).unwrap();
    // 167 archive rows; 29 lack complete OHLC and remain excluded.
    assert_eq!(csv.lines().count() - 1, 167);
    assert_eq!(report.rows.len(), 138);
    let long: Vec<_> = report.rows.iter().filter(|r| r.symbol.len() > 32).collect();
    assert_eq!(long.len(), 11);
    for row in long {
        conn.execute(
            "INSERT INTO instruments(symbol,exchange) VALUES (?1,'NSE_INDEX')",
            [&row.symbol],
        )
        .unwrap();
        let mut old = row.binary_record;
        old.date = 20261102;
        BinaryEodFile::write_all(
            temp.path()
                .join(format!("eod_data/NSE_INDEX/{}.eod", row.symbol)),
            &row.symbol,
            "NSE_INDEX",
            DEFAULT_SCALE,
            &mut [old],
        )
        .unwrap();
    }
    let mut files = vec![report];
    assert_eq!(
        guard_additive(&db, &mut files).unwrap()["2026-11-03"].inserted_candidates,
        138
    );
    let (result, timing) = insert_parsed_bhavcopy_files(&db, &files).unwrap();
    assert_eq!(result[0].rows_inserted, 138);
    assert_eq!(timing.binary_changed_dates, 0);
    assert_eq!(timing.binary_errors, 0);
    let mut rerun = vec![parse_bhavcopy_csv(csv, "NSE_INDEX", "2026-11-03", &[]).unwrap()];
    assert_eq!(
        guard_additive(&db, &mut rerun).unwrap()["2026-11-03"].identical,
        138
    );
    assert!(rerun[0].rows.is_empty());
}

// Explicit opt-in: this retained fixture is created once by the pinned snapshot
// script. No original database path or active-profile lookup is used here.
#[test]
#[ignore = "writes only the pinned retained production copy; run explicitly once"]
fn isolated_production_daily_archive_additive_proof() {
    let evidence =
        Path::new(r"E:\TA Projects\EOD Charting Platform\tmp\fixtures\2026-11-04-nse-index-daily");
    let root = evidence.join("production-copy");
    let db = root.join("market-data.sqlite3");
    assert!(db.is_file());
    assert!(
        !evidence.join("ingestion-result.json").exists(),
        "Proof already completed; preserve evidence"
    );
    let csv = fs::read(evidence.join("daily-response.csv")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(&csv)),
        "510b52ed9562b6d1d071ae81719c0af07d8a698ea8bd4bd61254ed0ec688425c"
    );
    let parsed = parse_bhavcopy_csv(
        std::str::from_utf8(&csv).unwrap(),
        "NSE_INDEX",
        "2026-11-03",
        &[],
    )
    .unwrap();
    assert!(parsed.debug.is_none());
    assert_eq!(parsed.rows.len(), 138);
    let long_names: Vec<_> = parsed
        .rows
        .iter()
        .filter(|r| r.symbol.len() > 32)
        .map(|r| r.symbol.clone())
        .collect();
    assert!(long_names.contains(&"NIFTY500LARGEMIDSMALLEQUALCAPWEIGHTED".to_string()));
    let mut baseline = BTreeMap::new();
    for entry in fs::read_dir(root.join("eod_data/NSE_INDEX")).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_some_and(|e| e == "eod") {
            let bytes = fs::read(&path).unwrap();
            baseline.insert(path, bytes);
        }
    }
    let mut files = vec![parsed];
    let outcomes = guard_additive(&db, &mut files).unwrap();
    assert_eq!(outcomes["2026-11-03"].conflicts, 0);
    assert_eq!(outcomes["2026-11-03"].invalid, 0);
    assert_eq!(outcomes["2026-11-03"].inserted_candidates, 138);
    let (results, timing) = insert_parsed_bhavcopy_files(&db, &files).unwrap();
    assert_eq!(results.iter().map(|r| r.rows_inserted).sum::<usize>(), 138);
    assert_eq!(timing.binary_errors, 0);
    assert_eq!(timing.binary_changed_dates, 0);
    // Every original record byte, including aliases not in this report, survives.
    let mut after = BTreeMap::new();
    for (path, bytes) in &baseline {
        let current = fs::read(path).unwrap();
        assert_eq!(
            &current[128..bytes.len()],
            &bytes[128..],
            "{}",
            path.display()
        );
        after.insert(path.clone(), current);
    }
    let rerun = parse_bhavcopy_csv(
        std::str::from_utf8(&csv).unwrap(),
        "NSE_INDEX",
        "2026-11-03",
        &[],
    )
    .unwrap();
    let mut conflict = parse_bhavcopy_csv(
        std::str::from_utf8(&csv).unwrap(),
        "NSE_INDEX",
        "2026-11-03",
        &[],
    )
    .unwrap();
    let target = conflict
        .rows
        .iter_mut()
        .find(|r| r.symbol == "NIFTY500LARGEMIDSMALLEQUALCAPWEIGHTED")
        .unwrap();
    target.close -= 1.0;
    let conflict_out = guard_additive(&db, &mut [conflict]).unwrap();
    assert_eq!(conflict_out["2026-11-03"].conflicts, 1);
    let mut rerun = vec![rerun];
    let rerun_out = guard_additive(&db, &mut rerun).unwrap();
    assert_eq!(rerun_out["2026-11-03"].identical, 138);
    assert!(rerun[0].rows.is_empty());
    for (path, bytes) in after {
        assert_eq!(fs::read(path).unwrap(), bytes);
    }
    let receipt = serde_json::json!({"scope": "real CSV parser -> additive guard -> immediate binary writer; desktop command/events/profile/recovery orchestration not invoked", "database": db, "archive_rows": 167, "incomplete_ohlc_excluded": 29, "parsed_rows": 138, "long_names": long_names, "outcomes": outcomes, "inserted": 138, "binary_changed_dates": timing.binary_changed_dates, "binary_errors": timing.binary_errors, "original_files_preserved": baseline.len(), "rerun": rerun_out, "conflict_probe": conflict_out});
    fs::write(
        evidence.join("ingestion-result.json"),
        serde_json::to_vec_pretty(&receipt).unwrap(),
    )
    .unwrap();
    println!("{}", receipt);
}

#[test]
fn journal_replay_rechecks_changed_alias_before_insertion() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);
    let mut files = vec![parsed("NIFTY 50", "2011-01-03", 105.0)];
    guard_additive(&db, &mut files).unwrap();
    let (session, _, _) = prepare_bhavcopy_recovery_session(&db, &config(), &files).unwrap();
    let pending = crate::bhavcopy_recovery::load_pending_sessions(temp.path()).unwrap();
    assert_eq!(pending.len(), 1);
    let mut replay = parsed_files_from_recovery_session(&pending[0]).unwrap();
    assert_eq!(
        replay[0].rows[0].binary_record,
        files[0].rows[0].binary_record
    );
    let conflict = parsed("NIFTY 50", "2011-01-03", 106.0).rows[0].binary_record;
    let path = temp.path().join("eod_data/NSE_INDEX/CNXNIFTY.eod");
    BinaryEodFile::write_all(
        &path,
        "CNXNIFTY",
        "NSE_INDEX",
        DEFAULT_SCALE,
        &mut [conflict],
    )
    .unwrap();
    assert_eq!(
        guard_additive(&db, &mut replay).unwrap()["2011-01-03"].conflicts,
        1
    );
    assert!(!session.manifest.session_id.is_empty());
}

#[test]
fn partial_log_does_not_certify_day_but_preserves_forward_update_window() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    upsert_download_log_entry(
        &conn,
        &DownloadResult {
            success: true,
            trade_date: "2011-01-03".into(),
            exchange: "NSE_INDEX".into(),
            rows_inserted: 1,
            max_volume: 0,
            message: "subset only".into(),
        },
    )
    .unwrap();
    let status: String = conn
        .query_row("SELECT status FROM download_log", [], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "partial");
    assert!(
        metadata_load_imported_trade_dates(&conn, "NSE_INDEX", "2011-01-03", "2011-01-07")
            .unwrap()
            .dates
            .is_empty()
    );
    assert_eq!(
        metadata_get_latest_imported_trade_date(&conn, "NSE_INDEX")
            .unwrap()
            .as_deref(),
        Some("2011-01-03")
    );
    let plan = build_batch_plan(&conn, &config()).unwrap();
    assert!(plan.tasks.iter().any(|t| t.trade_date == "2011-01-03"));
}

#[test]
fn cancelled_fetch_makes_no_request() {
    let client = create_http_client().unwrap();
    assert!(fetch(&client, "http://127.0.0.1:1", &AtomicBool::new(true))
        .unwrap_err()
        .contains("cancelled"));
}

#[test]
fn hybrid_checks_binary_only_alias_history_and_preserves_progress_after_conflicts() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();
    let mut old = [parsed("NIFTY 50", "2011-01-03", 105.0).rows[0].binary_record];
    let path = temp.path().join("eod_data/NSE_INDEX/CNXNIFTY.eod");
    BinaryEodFile::write_all(&path, "CNXNIFTY", "NSE_INDEX", DEFAULT_SCALE, &mut old).unwrap();
    let before = fs::read(&path).unwrap();
    let mut candidate = vec![parsed("NIFTY 50", "2011-01-03", 106.0)];
    assert_eq!(
        guard_additive(&db, &mut candidate).unwrap()["2011-01-03"].conflicts,
        1
    );
    assert!(candidate[0].rows.is_empty());
    assert_eq!(fs::read(&path).unwrap(), before);
    let result = DownloadResult {
        success: true,
        trade_date: "2011-01-03".into(),
        exchange: "NSE_INDEX".into(),
        rows_inserted: 1,
        max_volume: 0,
        message: "subset".into(),
    };
    upsert_download_log_entry(&conn, &result).unwrap();
    upsert_download_log_entry(
        &conn,
        &DownloadResult {
            success: false,
            rows_inserted: 0,
            message: "conflict held".into(),
            ..result
        },
    )
    .unwrap();
    assert_eq!(
        metadata_get_latest_imported_trade_date(&conn, "NSE_INDEX")
            .unwrap()
            .as_deref(),
        Some("2011-01-03")
    );
    let status: String = conn
        .query_row("SELECT status FROM download_log", [], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "partial");
}

#[test]
fn evidence_is_content_addressed_and_durable() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let a = save_evidence(&db, "request", b"{}").unwrap();
    let b = save_evidence(&db, "request", b"{}").unwrap();
    assert_eq!(a, b);
    assert_eq!(fs::read(a).unwrap(), b"{}");
}

#[test]
fn retained_midcap_and_smallcap_responses_match_their_exact_storage_identities() {
    let dates = [
        "2016-07-08",
        "2016-07-11",
        "2016-07-12",
        "2016-07-13",
        "2016-07-14",
        "2016-07-15",
    ];
    let midcap = include_bytes!("fixtures/midcap100-20160708-20160715.json");
    let smallcap = include_bytes!("fixtures/smallcap100-20160708-20160715.json");
    for (symbol, request_name, response_name, bytes, hash) in [
        (
            "NIFTYMIDCAP100",
            "NIFTY MIDCAP 100",
            "NIFTY MIDCAP 100",
            midcap.as_slice(),
            "adfa74d2b5f841dfe638cc97847186af9381e3afbf5f83e45817c998f5d6b242",
        ),
        (
            "SMALLCAP100",
            "NIFTY SMALLCAP 100",
            "NIFTY SMLCAP 100",
            smallcap.as_slice(),
            "634cd1a2ebb94d432227823d0f4e538e0d0ab0dbacf62a346105c3dbd39f3be8",
        ),
    ] {
        assert_eq!(format!("{:x}", Sha256::digest(bytes)), hash);
        let task = request(symbol, &dates);
        assert_eq!(task.task.index_type, request_name);
        let result = normalize(bytes, &task, "2026-11-05").unwrap();
        assert!(result.held.is_empty());
        assert_eq!(
            result
                .rows
                .iter()
                .map(|r| r.date.as_str())
                .collect::<Vec<_>>(),
            dates
        );
        assert!(result.rows.iter().all(|r| r.name == response_name));
    }
    assert!(
        normalize(smallcap, &request("NIFTYMIDCAP100", &dates), "2026-11-05")
            .err()
            .unwrap()
            .contains("Wrong response identity")
    );
}

#[test]
fn retained_responses_for_four_more_indices_keep_identity_and_missing_dates() {
    let dates = [
        "2026-05-25",
        "2026-05-26",
        "2026-05-27",
        "2026-05-28",
        "2026-05-29",
    ];
    let cases: [(&str, &str, &str, &[u8], &str); 4] = [
        (
            "FINNIFTY",
            "NIFTY FINANCIAL SERVICES",
            "NIFTY FIN SERVICE",
            include_bytes!("fixtures/finnifty-20260525-20260529.json"),
            "76a01d54ee6f1f332fd8d1fbfc23c50bf0bc7a789ba35bbb30fd60b5756a4e54",
        ),
        (
            "MIDCPNIFTY",
            "NIFTY MIDCAP SELECT",
            "NIFTY MID SELECT",
            include_bytes!("fixtures/midcap-select-20260525-20260529.json"),
            "6f5bd4fedbad418601756769ebd4369219144cb9c8eb4915fddf93b78af00d29",
        ),
        (
            "NIFTYMIDCAP150",
            "NIFTY MIDCAP 150",
            "NIFTY MIDCAP 150",
            include_bytes!("fixtures/midcap150-20260525-20260529.json"),
            "a3d192f4407c69cee9d39126ade61b3fabd6b1b8adb7a62d11747f3be2bdfdfa",
        ),
        (
            "NIFTYSMALLCAP250",
            "NIFTY SMALLCAP 250",
            "NIFTY SMLCAP 250",
            include_bytes!("fixtures/smallcap250-20260525-20260529.json"),
            "ea1b55e6d83576e7e1ea222ffa139f4c5848357606384114d83e27260e6f676b",
        ),
    ];
    for (symbol, query_name, source_name, bytes, hash) in cases {
        assert_eq!(format!("{:x}", Sha256::digest(bytes)), hash);
        let task = request(symbol, &dates);
        assert_eq!(task.task.index_type, query_name);
        assert_eq!(crate::bhavcopy::map_index_symbol(source_name), symbol);
        let result = normalize(bytes, &task, "2026-11-05").unwrap();
        assert!(result.held.is_empty());
        assert!(result.rows.iter().all(|row| row.name == source_name));
        assert_eq!(
            result
                .rows
                .iter()
                .map(|row| row.date.as_str())
                .collect::<Vec<_>>(),
            [dates[0], dates[1], dates[2], dates[4]]
        );
        assert!(normalize(bytes, &request("NIFTY", &dates), "2026-11-05")
            .err()
            .unwrap()
            .contains("Wrong response identity"));
    }
}

#[test]
fn invalid_stored_smallcap_alias_holds_only_its_quotation() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);
    let path = temp.path().join("eod_data/NSE_INDEX/CNXSMALLCAP.eod");
    let mut row = parsed("NIFTY SMALLCAP 100", "2015-08-20", 105.0).rows[0].binary_record;
    row.close = row.low - 1;
    BinaryEodFile::write_all(&path, "CNXSMALLCAP", "NSE_INDEX", DEFAULT_SCALE, &mut [row]).unwrap();
    let before = fs::read(&path).unwrap();
    let mut incoming = [
        parsed("NIFTY SMALLCAP 100", "2015-08-20", 105.0),
        parsed("NIFTY SMALLCAP 100", "2015-08-21", 105.0),
    ];
    let outcomes = guard_additive(&db, &mut incoming).unwrap();
    assert_eq!(outcomes["2015-08-20"].conflicts, 1);
    assert!(outcomes["2015-08-20"].details[0].contains("invalid existing quotation preserved"));
    assert!(incoming[0].rows.is_empty());
    assert_eq!(incoming[1].rows.len(), 1);
    assert_eq!(fs::read(&path).unwrap(), before);
}

#[test]
fn archive_success_avoids_fallback_and_partial_or_missing_archives_plan_only_gaps() {
    let date = "2011-01-03";
    let dates = BTreeSet::from([date.to_string()]);
    let csv = format!("INDEX_NAME,INDEX_DATE,OPEN_INDEX_VALUE,HIGH_INDEX_VALUE,LOW_INDEX_VALUE,CLOSING_INDEX_VALUE,VOLUME\n{}",
        SUPPORTED.iter().map(|i| format!("{},{date},100,110,90,105,0\n", i.name)).collect::<String>());
    let mut staged = vec![StagedDownload {
        task: DownloadTask {
            exchange: "NSE_INDEX".into(),
            trade_date: date.into(),
            mode: DownloadMode::Range,
            candidates: vec![],
            nse_index_history: None,
        },
        content: StagedDownloadContent::Csv(csv.clone()),
    }];
    assert!(unresolved_requests(&dates, &staged, &Existing::new())
        .unwrap()
        .is_empty());
    staged[0].content =
        StagedDownloadContent::Csv(csv.lines().take(2).collect::<Vec<_>>().join("\n"));
    assert_eq!(
        unresolved_requests(&dates, &staged, &Existing::new())
            .unwrap()
            .len(),
        SUPPORTED.len() - 1
    );
    assert_eq!(
        unresolved_requests(&dates, &[], &Existing::new())
            .unwrap()
            .len(),
        SUPPORTED.len()
    );
    let existing = HashMap::from([(
        ("NIFTY".into(), date.into()),
        vec![Some((scaled([100.0, 110.0, 90.0, 105.0]), 0))],
    )]);
    assert_eq!(
        unresolved_requests(&dates, &[], &existing).unwrap().len(),
        SUPPORTED.len() - 1
    );
}

#[test]
fn transport_refusal_empty_oversize_and_timeout_remain_distinct() {
    use std::net::TcpListener;
    use std::thread;
    use std::time::Duration;
    for (status, length, body, expected) in [
        ("403 Forbidden", 0, "", "403"),
        ("200 OK", 9_000_000, "", "8 MiB"),
        ("200 OK", 11, "{\"data\":[]}", "empty"),
    ] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0; 4096];
            let _ = stream.read(&mut buf);
            let _ = write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Length: {length}\r\nConnection: close\r\n\r\n{body}"
            );
        });
        let result = fetch(
            &create_http_client().unwrap(),
            &url,
            &AtomicBool::new(false),
        );
        server.join().unwrap();
        if expected == "empty" {
            assert!(normalize(
                &result.unwrap(),
                &request("NIFTY", &["2011-01-03"]),
                "2026-11-03"
            )
            .unwrap()
            .rows
            .is_empty());
        } else {
            assert!(result.unwrap_err().contains(expected));
        }
    }
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let server = thread::spawn(move || {
        let (_stream, _) = listener.accept().unwrap();
        thread::sleep(Duration::from_millis(100));
    });
    let client = Client::builder()
        .timeout(Duration::from_millis(30))
        .build()
        .unwrap();
    assert!(fetch(&client, &url, &AtomicBool::new(false))
        .unwrap_err()
        .contains("source failure"));
    server.join().unwrap();
}

#[test]
fn bse_2011_evidenced_holiday_is_excluded_without_changing_other_exchange_dates() {
    let temp = tempfile::tempdir().unwrap();
    let db = temp.path().join("fixture.db");
    let conn = open_database_connection(&db).unwrap();
    for exchange in ["BSE", "BSE_INDEX"] {
        let holiday =
            create_calendar_skip_result(&conn, exchange, "2011-01-26", chrono::Weekday::Wed)
                .unwrap();
        assert!(holiday.message.contains("20101122-22"));
        assert!(
            create_calendar_skip_result(&conn, exchange, "2011-01-25", chrono::Weekday::Tue)
                .is_none()
        );
        assert!(
            create_calendar_skip_result(&conn, exchange, "2024-03-02", chrono::Weekday::Sat)
                .is_none()
        );
    }
    assert_eq!(
        update_end_trade_date_for(parse_trade_date("2026-11-03").unwrap(), 17),
        "2026-11-02"
    );
    assert_eq!(
        update_end_trade_date_for(parse_trade_date("2026-11-03").unwrap(), 18),
        "2026-11-03"
    );
}

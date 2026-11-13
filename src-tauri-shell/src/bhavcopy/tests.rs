use super::*;
use crate::database::set_price_storage_mode;
use rusqlite::Connection;

fn create_temp_bhavcopy_db() -> (tempfile::TempDir, std::path::PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let conn = open_database_connection(&db_path).unwrap();
    drop(conn);
    (temp_dir, db_path)
}

fn legacy_excluded_series_vec() -> Vec<String> {
    ["GS", "GB", "GF", "GT", "GBD", "GBI", "GSD", "GSI"]
        .iter()
        .map(|value| (*value).to_string())
        .collect()
}

#[test]
fn v17d_production_bhavcopy_binary_worker_count_is_bounded_to_two() {
    assert_eq!(bhavcopy_binary_worker_count(1), 1);
    assert!(bhavcopy_binary_worker_count(2) <= 2);
    assert!(bhavcopy_binary_worker_count(3) <= 2);
    assert!(bhavcopy_binary_worker_count(usize::MAX) <= 2);
    assert_eq!(MAX_BHAVCOPY_BINARY_WORKERS, 2);
}

#[test]
fn test_background_checkpoint_uses_v17c_two_worker_storage_cap() {
    assert_eq!(MAX_BUFFERED_CHECKPOINT_WORKERS, 2);
    assert_eq!(MAX_BHAVCOPY_BINARY_WORKERS, 2);
}

#[test]
fn test_buffered_checkpoint_resume_states_include_interrupted_checkpointing() {
    assert!(can_resume_buffered_checkpoint(
        &RecoverySessionState::Applied
    ));
    assert!(can_resume_buffered_checkpoint(
        &RecoverySessionState::Checkpointing
    ));
    assert!(!can_resume_buffered_checkpoint(
        &RecoverySessionState::Prepared
    ));
    assert!(!can_resume_buffered_checkpoint(
        &RecoverySessionState::Applying
    ));
    assert!(!can_resume_buffered_checkpoint(
        &RecoverySessionState::Failed
    ));
    assert!(!can_resume_buffered_checkpoint(
        &RecoverySessionState::RecoveryError
    ));
    assert!(!can_resume_buffered_checkpoint(
        &RecoverySessionState::Checkpointed
    ));
}

#[test]
fn test_update_end_date_defers_current_day_until_evening_cutoff() {
    let date = NaiveDate::from_ymd_opt(2026, 8, 13).unwrap();
    assert_eq!(update_end_trade_date_for(date, 0), "2026-08-12");
    assert_eq!(update_end_trade_date_for(date, 17), "2026-08-12");
    assert_eq!(update_end_trade_date_for(date, 18), "2026-08-13");
    assert_eq!(update_end_trade_date_for(date, 23), "2026-08-13");
}

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
        [],
    ).unwrap();
    conn.execute(
        "CREATE TABLE eod_prices (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            symbol TEXT NOT NULL,
            exchange TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            oi INTEGER
        )",
        [],
    )
    .unwrap();
    conn.execute(
        "CREATE TABLE download_log (
            id INTEGER PRIMARY KEY,
            trade_date TEXT NOT NULL,
            exchange TEXT NOT NULL,
            rows_inserted INTEGER,
            max_volume INTEGER,
            status TEXT,
            note TEXT,
            downloaded_at TEXT DEFAULT (datetime('now')),
            UNIQUE(trade_date, exchange)
        )",
        [],
    )
    .unwrap();
    conn.execute(
        "CREATE TABLE market_holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'BUILTIN',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO market_holidays (date, name, source) VALUES (?, ?, 'BUILTIN')",
        params!["2026-06-26", "Muharram"],
    )
    .unwrap();
    conn
}

#[test]
fn test_storage_mode_selection_hybrid_default() {
    let conn = setup_test_db();
    // Insert into eod_prices
    conn.execute(
        "INSERT INTO eod_prices (date, symbol, exchange, close, volume) VALUES (?, ?, ?, ?, ?)",
        params!["2024-05-15", "TEST", "NSE", 100.0, 1000],
    )
    .unwrap();

    // Default mode is Hybrid
    assert!(storage_mode_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
    // Metadata table is empty, so if it were binary it would return false
    assert!(!metadata_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
}

#[test]
fn test_storage_mode_selection_binary() {
    let conn = setup_test_db();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

    // Insert into download_log only
    conn.execute(
        "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
        params!["2024-05-15", "NSE", 100, 5000, "ok"],
    ).unwrap();

    assert!(storage_mode_has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
    // eod_prices is empty, so if it were hybrid it would return false
    assert!(!has_imported_rows_for_date(&conn, "2024-05-15", "NSE").unwrap());
}

#[test]
fn test_binary_mode_stale_nse() {
    let conn = setup_test_db();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

    // Insert stale row (max_volume = 0) into download_log
    conn.execute(
        "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
        params!["2024-05-15", "NSE", 100, 0, "ok"],
    ).unwrap();

    assert!(
        storage_mode_has_stale_zero_volume_rows_for_date(&conn, "2024-05-15", "NSE").unwrap()
    );
}

#[test]
fn test_parse_and_insert_binary_skips_sqlite() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();

    // Set Binary mode
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\n\
               RELIANCE,EQ,2500,2550,2490,2520,2520,2480,100000,252000000,15-MAY-2024,5000,INE002A01018";

    let result = parse_and_insert(&db_path, csv, "NSE", "2024-05-15", &[]).unwrap();

    assert_eq!(result.rows_inserted, 1);

    let conn = Connection::open(&db_path).unwrap();
    let eod_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM eod_prices", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        eod_count, 0,
        "SQLite eod_prices should be empty in Binary mode"
    );

    let inst_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM instruments", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        inst_count, 1,
        "Instruments should still be updated in Binary mode"
    );

    // Verify binary file exists
    let bin_path = temp_dir
        .path()
        .join("eod_data")
        .join("NSE")
        .join("RELIANCE.eod");
    assert!(bin_path.exists(), "Binary .eod file should be created");
}

#[test]
fn test_parse_and_insert_stores_nse_series_and_isin_metadata() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP,ISIN\n\
               RELIANCE,EQ,2500,2550,2490,2520,100000,15-MAY-2024,INE002A01018";

    let result = parse_and_insert(&db_path, csv, "NSE", "2024-05-15", &[]).unwrap();
    assert_eq!(result.rows_inserted, 1);

    let conn = open_database_connection(&db_path).unwrap();
    let metadata = conn
        .query_row(
            "SELECT series, isin, series_as_of_date FROM instruments WHERE symbol = ? AND exchange = ?",
            params!["RELIANCE", "NSE"],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(metadata.0.as_deref(), Some("EQ"));
    assert_eq!(metadata.1.as_deref(), Some("INE002A01018"));
    assert_eq!(metadata.2.as_deref(), Some("2024-05-15"));
}

#[test]
fn test_bhav02_legacy_exclusions_do_not_discard_supported_nse_series() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
               MAINCO,EQ,100,110,95,105,1000,15-MAY-2024\n\
               WATCHCO,BE,20,22,19,21,500,15-MAY-2024\n\
               1018GS2026,GS,112,112,110,110,101,15-MAY-2024";

    let result = parse_and_insert(
        &db_path,
        csv,
        "NSE",
        "2024-05-15",
        &legacy_excluded_series_vec(),
    )
    .unwrap();
    assert_eq!(result.rows_inserted, 3);

    let conn = open_database_connection(&db_path).unwrap();
    let be_series: Option<String> = conn
        .query_row(
            "SELECT series FROM instruments WHERE symbol = ? AND exchange = ?",
            params!["WATCHCO", "NSE"],
            |row| row.get(0),
        )
        .unwrap();
    let stored_gsec_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM instruments WHERE symbol = ? AND exchange = ?",
            params!["1018GS2026", "NSE"],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(be_series.as_deref(), Some("BE"));
    assert_eq!(stored_gsec_count, 1);
}

#[test]
fn test_bhav02_legacy_exclusion_config_does_not_filter_nse() {
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
               MAINCO,EQ,100,110,95,105,1000,15-MAY-2024\n\
               GOVGS,GS,100,110,95,105,2000,15-MAY-2024\n\
               GOVGB,GB,100,110,95,105,3000,15-MAY-2024\n\
               WATCHCO,BE,100,110,95,105,1500,15-MAY-2024";
    let excluded = vec![" gs ".to_string(), "gB".to_string()];
    let parsed = parse_bhavcopy_csv(csv, "nSe", "2024-05-15", &excluded).unwrap();

    assert_eq!(parsed.exchange, "NSE");
    assert_eq!(parsed.rows.len(), 4);
    assert_eq!(parsed.rows[0].symbol, "MAINCO");
    assert_eq!(parsed.rows[1].symbol, "GOVGS");
    assert_eq!(parsed.rows[1].series, "GS");
    assert_eq!(parsed.rows[2].symbol, "GOVGB");
    assert_eq!(parsed.rows[2].series, "GB");
    assert_eq!(parsed.rows[3].symbol, "WATCHCO");
    assert_eq!(parsed.rows[3].series, "BE");
    assert_eq!(parsed.max_volume, 3000);
}

#[test]
fn test_bhav02_eight_legacy_exclusions_all_import_with_series_metadata() {
    let mut csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n".to_string();
    for (index, series) in ["GS", "GB", "GF", "GT", "GBD", "GBI", "GSD", "GSI"].iter().enumerate() {
        csv.push_str(&format!(
            "SYMBOL{index},{series},100,110,90,105,1000,15-MAY-2024\n"
        ));
    }
    let excluded = legacy_excluded_series_vec();
    let parsed = parse_bhavcopy_csv(&csv, "NSE", "2024-05-15", &excluded).unwrap();
    assert_eq!(parsed.rows.len(), 8);
    assert_eq!(
        parsed.rows.iter().map(|row| row.series.as_str()).collect::<Vec<_>>(),
        vec!["GS", "GB", "GF", "GT", "GBD", "GBI", "GSD", "GSI"]
    );
    assert_eq!(parsed.max_volume, 1000);
}

#[test]
fn test_bhav02_default_settings_exclusions_empty_but_legacy_values_preserved() {
    assert!(default_settings().excluded_series.is_empty());
    let legacy = legacy_excluded_series_vec();
    let mut settings = default_settings();
    settings.excluded_series = legacy.clone();
    let normalized = normalize_settings(settings);
    assert_eq!(normalized.excluded_series, legacy);
    let parsed = parse_bhavcopy_csv(
        "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\nGOVGS,GS,100,110,90,105,1000,15-MAY-2024",
        "NSE",
        "2024-05-15",
        &normalized.excluded_series,
    )
    .unwrap();
    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].series, "GS");
}

#[test]
fn test_bhav01_bse_legacy_groups_ignore_nse_exclusions() {
    let csv = "SC_CODE,SC_NAME,SC_GROUP,OPEN,HIGH,LOW,CLOSE,NO_OF_SHRS\n\
               500001,COMPANY ONE,A,100,110,90,105,1000\n\
               500002,COMPANY TWO,B,100,110,90,105,2000\n\
               500003,COMPANY THREE,T,100,110,90,105,3000\n\
               500004,COMPANY FOUR,Z,100,110,90,105,4000\n\
               500005,COMPANY FIVE,GS,100,110,90,105,5000";
    let excluded = vec!["A", " b ", "T", "z", "GS"]
        .into_iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let parsed = parse_bhavcopy_csv(csv, "BSE", "2024-05-15", &excluded).unwrap();

    assert_eq!(parsed.rows.len(), 5);
    assert_eq!(parsed.rows.iter().map(|row| row.series.as_str()).collect::<Vec<_>>(),
               vec!["A", "B", "T", "Z", "GS"]);
    assert_eq!(parsed.rows[0].symbol, "500001");
    assert_eq!(parsed.max_volume, 5000);
}

#[test]
fn test_bhav01_bse_udiff_group_ignores_nse_exclusions() {
    let csv = "TradDt,TckrSymb,SctySrs,OpnPric,HghPric,LwPric,ClsPric,TtlTradgVol\n\
               2026-06-01,ABB,A,100,110,90,105,1234";
    let parsed = parse_bhavcopy_csv(csv, "BSE", "2026-06-01", &["A".to_string()]).unwrap();

    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].symbol, "ABB");
    assert_eq!(parsed.rows[0].series, "A");
    assert_eq!(parsed.max_volume, 1234);
}

#[test]
fn test_bhav01_index_streams_ignore_equity_exclusions() {
    let csv = "INDEX_NAME,SERIES,OPEN,HIGH,LOW,CLOSE\n\
               NIFTY 50,GS,24000,24100,23900,24050";
    let excluded = vec!["GS".to_string()];
    let parsed = parse_bhavcopy_csv(csv, "NSE_INDEX", "2026-06-01", &excluded).unwrap();
    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].symbol, "NIFTY");

    let csv_bse = "INDEX_NAME,SERIES,OPEN,HIGH,LOW,CLOSE\n\
                   BSE SENSEX,GS,80000,81000,79000,80500";
    let parsed_bse = parse_bhavcopy_csv(csv_bse, "BSE_INDEX", "2026-06-01", &excluded).unwrap();
    assert_eq!(parsed_bse.rows.len(), 1);
    assert_eq!(parsed_bse.rows[0].symbol, "SENSEX");
}

#[test]
fn test_series_metadata_keeps_latest_trade_date_when_backfilling() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let newer_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     MOVECO,EQ,100,110,95,105,1000,16-MAY-2024";
    let older_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     MOVECO,BE,90,95,85,92,700,15-MAY-2024";

    parse_and_insert(&db_path, newer_csv, "NSE", "2024-05-16", &[]).unwrap();
    parse_and_insert(&db_path, older_csv, "NSE", "2024-05-15", &[]).unwrap();

    let conn = open_database_connection(&db_path).unwrap();
    let metadata = conn
        .query_row(
            "SELECT series, series_as_of_date FROM instruments WHERE symbol = ? AND exchange = ?",
            params!["MOVECO", "NSE"],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .unwrap();

    assert_eq!(metadata.0.as_deref(), Some("EQ"));
    assert_eq!(metadata.1.as_deref(), Some("2024-05-16"));
}

#[test]
fn test_parse_and_insert_stores_bse_group_as_series_metadata() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let csv = "SC_CODE,SC_NAME,GROUP,OPEN,HIGH,LOW,CLOSE,NOOFSHARES,DATE\n\
               500325,RELIANCE INDUSTRIES LTD,A,2500,2550,2490,2520,100000,15/05/2024";

    let result = parse_and_insert(&db_path, csv, "BSE", "2024-05-15", &[]).unwrap();
    assert_eq!(result.rows_inserted, 1);

    let conn = open_database_connection(&db_path).unwrap();
    let group_value: Option<String> = conn
        .query_row(
            "SELECT series FROM instruments WHERE symbol = ? AND exchange = ?",
            params!["500325", "BSE"],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(group_value.as_deref(), Some("A"));
}

#[test]
fn bse_backfill_preserves_newer_isin_and_still_imports_historical_prices() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let newer = "SYMBOL,SERIES,ISIN,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                 EXAMPLE,A,NEWISIN,100,110,95,105,1000,23-OCT-2026";
    let older = "SYMBOL,SERIES,ISIN,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                 EXAMPLE,B,OLDISIN,90,95,85,92,700,22-OCT-2026";
    let next = "SYMBOL,SERIES,ISIN,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                EXAMPLE,A,NEXTISIN,101,111,96,106,1100,26-OCT-2026";
    parse_and_insert(&db_path, newer, "BSE", "2026-10-23", &[]).unwrap();
    parse_and_insert(&db_path, older, "BSE", "2026-10-22", &[]).unwrap();
    let connection = open_database_connection(&db_path).unwrap();
    let metadata: (String, String, String) = connection.query_row(
        "SELECT isin,series,series_as_of_date FROM instruments WHERE symbol='EXAMPLE' AND exchange='BSE'",
        [], |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?)),
    ).unwrap();
    assert_eq!(metadata, ("NEWISIN".into(), "A".into(), "2026-10-23".into()));
    assert_eq!(connection.query_row(
        "SELECT COUNT(*) FROM eod_prices WHERE symbol='EXAMPLE' AND exchange='BSE'", [],
        |row| row.get::<_, i64>(0),
    ).unwrap(), 2);
    drop(connection);
    parse_and_insert(&db_path, next, "BSE", "2026-10-26", &[]).unwrap();
    let connection = open_database_connection(&db_path).unwrap();
    assert_eq!(connection.query_row(
        "SELECT isin FROM instruments WHERE symbol='EXAMPLE' AND exchange='BSE'", [],
        |row| row.get::<_, String>(0),
    ).unwrap(), "NEXTISIN");
}

#[cfg(windows)]
#[test]
#[ignore = "Explicit backed-up BSE import maintenance; requires EOD_BSE_BUILD_JOB"]
fn bse_maintenance_import_through_normal_batch_engine() {
    use tauri::Listener;
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Job {
        expected_database_folder: std::path::PathBuf,
        report_file: std::path::PathBuf,
        config: BatchDownloadConfig,
        #[serde(default)]
        staged_manifest: Option<std::path::PathBuf>,
    }
    let job_path = std::env::var_os("EOD_BSE_BUILD_JOB")
        .expect("Set EOD_BSE_BUILD_JOB to an explicit approved job JSON path");
    let job: Job = serde_json::from_slice(&fs::read(job_path).unwrap()).unwrap();
    assert!(!job.config.exchanges.nse && !job.config.exchanges.nse_index,
        "BSE maintenance must not write NSE data");
    assert!(job.config.exchanges.bse || job.config.exchanges.bse_index);
    assert!(!job.report_file.exists(), "Do not overwrite an existing receipt");
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    let app = tauri::Builder::default().any_thread()
        .manage(crate::database::ActiveDatabaseConnectionState::new())
        .build(context).expect("Build headless desktop runtime");
    let handle = app.handle().clone();
    let database_file = crate::database::get_active_database_file_path(&handle)
        .unwrap().expect("Open the intended database in EOD first");
    assert_eq!(database_file.parent().unwrap().canonicalize().unwrap(),
        job.expected_database_folder.canonicalize().unwrap(), "Active database differs from approved job");
    handle.listen("bhavcopy:progress", |event| println!("{}", event.payload()));
    handle.listen("bhavcopy:result", |event| println!("RESULT {}", event.payload()));
    let result = if let Some(manifest_path) = job.staged_manifest {
        use sha2::{Digest, Sha256};
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct AdditionalSource {
            path: std::path::PathBuf,
            sha256: String,
        }
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Source {
            exchange: String,
            trade_date: String,
            csv_path: std::path::PathBuf,
            sha256: String,
            official_url: String,
            official_path: std::path::PathBuf,
            official_sha256: String,
            #[serde(default)]
            additional_official_files: Vec<AdditionalSource>,
        }
        let permit = crate::database::try_acquire_price_store_operation(
            crate::database::PriceStoreOperationKind::BhavcopyWrite,
        ).unwrap();
        recover_pending_bhavcopy_sessions(&handle, &database_file).unwrap();
        let scope = manifest_path.parent().unwrap().canonicalize().unwrap();
        let sources: Vec<Source> = serde_json::from_slice(&fs::read(&manifest_path).unwrap()).unwrap();
        let mut staged = Vec::new();
        let mut verified_sources = std::collections::HashMap::new();
        for source in sources {
            assert!(source.official_url.starts_with("https://www.bseindia.com/")
                || source.official_url.starts_with("https://api.bseindia.com/"));
            assert!((source.exchange == "BSE" && job.config.exchanges.bse)
                || (source.exchange == "BSE_INDEX" && job.config.exchanges.bse_index));
            assert!(source.csv_path.canonicalize().unwrap().starts_with(&scope));
            let mut originals = source.additional_official_files;
            originals.push(AdditionalSource { path: source.official_path, sha256: source.official_sha256 });
            for original in originals {
                let path = original.path.canonicalize().unwrap();
                assert!(path.starts_with(&scope));
                let metadata = fs::metadata(&path).unwrap();
                let stamp = (metadata.len(), metadata.modified().unwrap());
                let (verified_stamp, hash) = verified_sources.entry(path.clone()).or_insert_with(|| {
                    let hash = format!("{:x}", Sha256::digest(fs::read(&path).unwrap()));
                    let after = fs::metadata(&path).unwrap();
                    assert_eq!(stamp, (after.len(), after.modified().unwrap()));
                    (stamp, hash)
                });
                assert_eq!(*verified_stamp, stamp, "Source changed during import");
                assert_eq!(*hash, original.sha256);
            }
            let bytes = fs::read(&source.csv_path).unwrap();
            assert_eq!(format!("{:x}", Sha256::digest(&bytes)), source.sha256);
            staged.push(StagedDownload {
                task: DownloadTask {
                    exchange: source.exchange, trade_date: source.trade_date,
                    mode: DownloadMode::Range, candidates: Vec::new(), nse_index_history: None,
                },
                content: StagedDownloadContent::Csv(String::from_utf8(bytes).unwrap()),
            });
        }
        let imported = import_staged_csv_downloads(
            &handle, &database_file, staged, &job.config, &Mutex::new(()), &BatchStop::default(),
        );
        drop(permit);
        imported
    } else {
        tauri::async_runtime::block_on(download_bhavcopy_batch(handle.clone(), job.config))
    };
    let recovery = recover_pending_bhavcopy_sessions(&handle, &database_file);
    fs::write(&job.report_file, serde_json::to_vec_pretty(&serde_json::json!({
        "result": result, "recovery": recovery,
    })).unwrap()).unwrap();
    let receipt: serde_json::Value = serde_json::from_slice(&fs::read(&job.report_file).unwrap()).unwrap();
    assert!(receipt["result"].get("Ok").is_some(), "Batch engine failed; inspect receipt");
    assert!(receipt["recovery"].get("Ok").is_some(), "Recovery incomplete; inspect receipt");
}

#[test]
fn batch_stop_lets_a_started_http_attempt_finish_without_trying_the_next_url() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
        time::Duration,
    };

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let controller = BatchCancellation::default();
    let run = controller.start("http-staging".into()).unwrap();
    let client = Client::builder().no_proxy().timeout(Duration::from_secs(3)).build().unwrap();
    let task = DownloadTask {
        exchange: "NSE".into(),
        trade_date: "2026-01-02".into(),
        mode: DownloadMode::Range,
        candidates: ["first", "second"].into_iter()
            .map(|route| Candidate::direct(format!("http://{address}/{route}"), false))
            .collect(),
        nse_index_history: None,
    };

    thread::scope(|scope| {
        let server = scope.spawn(|| {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut request = [0; 1024];
            let read = stream.read(&mut request).unwrap();
            assert!(String::from_utf8_lossy(&request[..read]).starts_with("GET /first "));
            assert_eq!(controller.request("http-staging"), BatchStopReply::Accepted);
            stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        });

        assert!(matches!(
            stage_single_download(&client, &task, &run.stop).unwrap(),
            StagedDownloadOutcome::Cancelled
        ));
        server.join().unwrap();
    });
    listener.set_nonblocking(true).unwrap();
    assert_eq!(listener.accept().unwrap_err().kind(), std::io::ErrorKind::WouldBlock);
    assert!(run.finish());
}

#[test]
fn batch_download_log_keeps_historical_success_until_a_successful_replacement() {
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch("
        CREATE TABLE download_log (
            trade_date TEXT, exchange TEXT, rows_inserted INTEGER, max_volume INTEGER,
            status TEXT, note TEXT, downloaded_at TEXT, UNIQUE(trade_date, exchange)
        );
        INSERT INTO download_log VALUES ('2026-01-02', 'NSE', 10, 20, 'ok', NULL, 'original');
    ").unwrap();
    let failed = failed_download_result("NSE", "2026-01-02", "source failed");
    upsert_batch_download_log_entry(&db, &failed).unwrap();
    let read_log = || {
        db.query_row(
            "SELECT status, rows_inserted, max_volume, downloaded_at FROM download_log",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?, row.get::<_, String>(3)?)),
        ).unwrap()
    };
    assert_eq!(read_log(), ("ok".into(), 10, 20, "original".into()));

    let replacement = DownloadResult { success: true, rows_inserted: 12, max_volume: 30, ..failed };
    upsert_batch_download_log_entry(&db, &replacement).unwrap();
    let (status, rows, max_volume, timestamp) = read_log();
    assert_eq!((status.as_str(), rows, max_volume), ("ok", 12, 30));
    assert_ne!(timestamp, "original");

    let failed_new_date = failed_download_result("NSE", "2026-01-05", "new job failed");
    upsert_batch_download_log_entry(&db, &failed_new_date).unwrap();
    assert_eq!(
        db.query_row("SELECT note FROM download_log WHERE status = 'error'", [], |r| r.get::<_, String>(0)).unwrap(),
        "new job failed"
    );
}

#[test]
fn download_log_distinguishes_held_back_subset_from_total_row_loss() {
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch("
        CREATE TABLE download_log (
            trade_date TEXT, exchange TEXT, rows_inserted INTEGER, max_volume INTEGER,
            status TEXT, note TEXT, downloaded_at TEXT, UNIQUE(trade_date, exchange)
        );
    ").unwrap();
    // A conflict blocked a subset of the file, but other symbols imported rows:
    // the log must keep the real counts and must not say status='error'.
    let subset = DownloadResult {
        success: false,
        trade_date: "2014-11-20".into(),
        exchange: "NSE".into(),
        rows_inserted: 12,
        max_volume: 340,
        message: "Security subset: Imported staged 12 records; blocked 2 rows".into(),
    };
    upsert_download_log_entry(&db, &subset).unwrap();
    let (status, rows, max_volume): (String, i64, i64) = db
        .query_row(
            "SELECT status, rows_inserted, max_volume FROM download_log WHERE trade_date = '2014-11-20'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!((status.as_str(), rows, max_volume), ("partial", 12, 340));

    // A date where nothing imported is genuine row loss: error with zero counts.
    let none = DownloadResult {
        rows_inserted: 0,
        max_volume: 0,
        trade_date: "2014-11-21".into(),
        ..subset.clone()
    };
    upsert_download_log_entry(&db, &none).unwrap();
    let (status, rows, max_volume): (String, i64, i64) = db
        .query_row(
            "SELECT status, rows_inserted, max_volume FROM download_log WHERE trade_date = '2014-11-21'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!((status.as_str(), rows, max_volume), ("error", 0, 0));

    // The batch variant keeps a historical success untouched: a later
    // held-back-subset failure on the same date must not downgrade it.
    let replacement = DownloadResult { success: true, rows_inserted: 40, max_volume: 900, ..subset.clone() };
    upsert_batch_download_log_entry(&db, &replacement).unwrap();
    upsert_batch_download_log_entry(&db, &subset).unwrap();
    let (status, rows, max_volume): (String, i64, i64) = db
        .query_row(
            "SELECT status, rows_inserted, max_volume FROM download_log WHERE trade_date = '2014-11-20'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!((status.as_str(), rows, max_volume), ("ok", 40, 900));
}

#[test]
fn test_row_parity_audit_detects_duplicate_symbol_date_rows() {
    let csv = "SC_CODE,SC_NAME,SC_GROUP,OPEN,HIGH,LOW,CLOSE,NO_OF_SHRS\n\
500325,RELIANCE,A,100,110,90,105,1000\n\
500325,RELIANCE,A,101,111,91,106,2000";
    let parsed = parse_bhavcopy_csv(csv, "BSE", "2023-12-05", &[]).unwrap();
    let (duplicate_rows, samples) = find_duplicate_symbol_date_rows(&[parsed]);

    assert_eq!(duplicate_rows, 1);
    assert_eq!(samples, vec!["BSE:500325@2023-12-05".to_string()]);
}

#[test]
fn test_parse_bse_legacy_equity_bhavcopy_headers() {
    let csv = "SC_CODE,SC_NAME,SC_GROUP,SC_TYPE,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,NO_TRADES,NO_OF_SHRS,NET_TURNOV,TDCLOINDI\n\
               500325,RELIANCE INDUSTRIES LTD,A,Q,2500,2550,2490,2520,2518,2495,1234,567890,1432100000,-";

    let parsed = parse_bhavcopy_csv(csv, "BSE", "2023-12-05", &[]).unwrap();

    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].symbol, "500325");
    assert_eq!(parsed.rows[0].series, "A");
    assert_eq!(parsed.rows[0].volume, 567890);
    assert_eq!(parsed.rows[0].trades, Some(1234));
    assert_eq!(parsed.rows[0].trade_date, "2023-12-05");
}

#[test]
fn test_bse_legacy_equity_candidate_uses_ddmmyy_zip_pattern_first_before_udiff_cutover() {
    let date = NaiveDate::from_ymd_opt(2023, 12, 5).unwrap();
    let candidates = generate_bse_candidates(date, None);

    assert_eq!(
        candidates[0].url,
        "https://www.bseindia.com/download/BhavCopy/Equity/EQ051223_CSV.ZIP"
    );
    assert!(candidates[0].zipped);
    assert!(candidates[1]
        .url
        .contains("BhavCopy_BSE_CM_0_0_0_20231205_F_0000.CSV"));
    assert_eq!(candidates[2].bse_response_key, Some("dsedcudiff"));
}

#[test]
fn test_parse_bse_udiff_equity_bhavcopy() {
    let csv = "TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd1,Rsvd2,Rsvd3,Rsvd4\n\
               2026-06-01,2026-06-01,CM,BSE,STK,500002,INE117A01022,ABB,A,,,,,ABB INDIA LIMITED,7289.55,7289.55,7006.65,7030.10,7020.00,7229.60,,7027.50,,,20069,142855154.00,3466,F1,1,,,,,";

    let parsed = parse_bhavcopy_csv(csv, "BSE", "2026-06-01", &[]).unwrap();

    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].symbol, "ABB");
    assert_eq!(parsed.rows[0].series, "A");
    assert_eq!(parsed.rows[0].isin, "INE117A01022");
    assert_eq!(parsed.rows[0].volume, 20069);
    assert_eq!(parsed.rows[0].trades, Some(3466));
    assert_eq!(parsed.max_volume, 20069);
}

#[test]
fn test_parse_bse_index_summary_bhavcopy() {
    let csv = "IndexCode,IndexID,IndexName,PreviousClose,OpenPrice,HighPrice,LowPrice,ClosePrice,52weeksHigh,52weeksLow,Filler1,Filler2,Filler3,Filler4\n\
               1,SENSEX,BSE SENSEX,74775.74,75203.02,75367.93,74203.68,74267.34,86159.02,71545.81,,,,";

    let parsed = parse_bhavcopy_csv(csv, "BSE_INDEX", "2026-06-01", &[]).unwrap();

    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].symbol, "SENSEX");
    assert_eq!(parsed.rows[0].instrument_name, "BSE SENSEX");
    assert_eq!(parsed.rows[0].trade_date, "2026-06-01");
    assert_eq!(parsed.rows[0].volume, 0);
}

#[test]
fn test_bse_index_archive_json_normalizes_to_existing_csv_import_contract() {
    let payload = r#"{"Table":[
        {"I_name":"BSE SENSEX","date":"2023-12-05T00:00:00","I_open":"69000.00","I_high":"69500.00","I_low":"68800.00","I_close":"69296.14","Prev_Close":"68865.12","Volume":"1.93","Flag":1},
        {"I_name":"BSE BANKEX","date":"2023-12-05T00:00:00","I_open":"52000.00","I_high":"52500.00","I_low":"51800.00","I_close":"52300.00","Prev_Close":"51900.00","Volume":"0.75","Flag":1},
        {"I_name":"BSE ARBITRAGE RATE INDEX","date":"2023-12-05T00:00:00","I_open":null,"I_high":null,"I_low":null,"I_close":"2488.20","Volume":null,"Flag":2}
    ]}"#;

    let normalized = normalize_bse_index_archive_json(payload.as_bytes(), "2023-12-05")
        .unwrap()
        .unwrap();
    let parsed = parse_bhavcopy_csv(&normalized, "BSE_INDEX", "2023-12-05", &[]).unwrap();

    assert_eq!(parsed.rows.len(), 2);
    assert_eq!(parsed.rows[0].symbol, "SENSEX");
    assert_eq!(parsed.rows[0].trade_date, "2023-12-05");
    assert_eq!(parsed.rows[0].volume, 19_300_000);
    assert_eq!(parsed.rows[1].symbol, "BANKEX");
    assert_eq!(parsed.rows[1].volume, 7_500_000);
}

#[test]
fn test_nse_candidates_follow_udiff_cutover_and_keep_legacy_history() {
    let historical =
        generate_nse_candidates(NaiveDate::from_ymd_opt(2010, 1, 4).unwrap(), None);
    assert!(historical[0].url.contains(
        "archives.nseindia.com/content/historical/EQUITIES/2010/JAN/cm04JAN2010bhav.csv.zip"
    ));
    assert!(historical[1].url.contains(
        "nsearchives.nseindia.com/content/historical/EQUITIES/2010/JAN/cm04JAN2010bhav.csv.zip"
    ));

    let recent = generate_nse_candidates(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(), None);
    assert!(recent[0]
        .url
        .contains("BhavCopy_NSE_CM_0_0_0_20260601_F_0000.csv.zip"));
    assert!(recent[1].url.contains("sec_bhavdata_full_01062026.csv"));
}

#[test]
fn test_bse_index_archive_url_preserves_literal_slash_date_contract() {
    let date = NaiveDate::from_ymd_opt(2023, 9, 8).unwrap();
    let url = build_bse_index_archive_url(date);

    assert_eq!(
        url,
        "https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAllPar/w?fmdt=08/09/2023&index=All&period=D&todt=08/09/2023"
    );
    assert!(!url.contains("%2F"));
}
#[test]
fn test_bse_candidates_follow_working_cutover_and_index_archive_sources() {
    let date = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let equity_candidates = generate_bse_candidates(date, None);
    let index_candidates = generate_bse_index_candidates(date, None);

    assert!(equity_candidates[0]
        .url
        .contains("BhavCopy_BSE_CM_0_0_0_20260601_F_0000.CSV"));
    assert_eq!(
        equity_candidates[1].url,
        "https://www.bseindia.com/download/BhavCopy/Equity/EQ010626_CSV.ZIP"
    );
    assert_eq!(equity_candidates[2].bse_response_key, Some("dsedcudiff"));

    assert!(index_candidates[0]
        .url
        .contains("IndexSummary_01062026.csv"));
    assert!(index_candidates[1].bse_index_archive_json);
    assert!(index_candidates[1].url.contains("IndexArchDailyAllPar"));
    assert!(index_candidates[1].url.contains("index=All"));
    assert_eq!(index_candidates[2].bse_response_key, Some("dsIndexSum"));
}

#[test]
fn test_bhavcopy_referer_for_exchange_bse_endpoints() {
    assert_eq!(
        bhavcopy_referer_for_exchange("BSE"),
        "https://www.bseindia.com/download/BhavCopy/Equity/"
    );
    assert_eq!(
        bhavcopy_referer_for_exchange("BSEINDEX"),
        "https://www.bseindia.com/bsedata/Index_Bhavcopy/"
    );
    assert_eq!(
        bhavcopy_referer_for_exchange("NSE"),
        "https://www.nseindia.com/"
    );
}

#[test]
fn test_bse_index_api_filename_uses_downloadable_case() {
    assert_eq!(
        normalize_bse_api_filename("dsIndexSum", "INDEXSummary_28042026.csv"),
        "IndexSummary_28042026.csv"
    );
    assert_eq!(
        normalize_bse_api_filename("dsedcudiff", "BhavCopy_BSE_CM_0_0_0_20260428_F_0000.CSV"),
        "BhavCopy_BSE_CM_0_0_0_20260428_F_0000.CSV"
    );
}

#[test]
fn db_safe_03_bhavcopy_reimport_preserves_delivery_including_nulls() {
    let (_temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();
    let date = "2026-06-16";
    let original = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                    DELIVCO,EQ,100,110,95,105,1000,16-JUN-2026\n\
                    NULLCO,EQ,100,110,95,105,1000,16-JUN-2026";
    let corrected = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,PREVCLOSE,TOTALTRADES,TIMESTAMP\n\
                     DELIVCO,EQ,102,112,99,109,1200,101,60,16-JUN-2026\n\
                     NULLCO,EQ,102,112,99,109,1200,101,60,16-JUN-2026";
    let original = parse_bhavcopy_csv(original, "NSE", date, &[]).unwrap();
    insert_parsed_bhavcopy_files(&db_path, &[original]).unwrap();
    conn.execute(
        "UPDATE eod_prices SET delivery_qty = 500, delivery_pct = 50
         WHERE symbol = 'DELIVCO'",
        [],
    )
    .unwrap();

    let corrected = parse_bhavcopy_csv(corrected, "NSE", date, &[]).unwrap();
    let (results, timing) = insert_parsed_bhavcopy_files(&db_path, &[corrected]).unwrap();
    assert_eq!(results[0].rows_inserted, 2);
    assert_eq!(results[0].max_volume, 1200);
    assert_eq!(timing.binary_changed_dates, 2);
    assert_eq!(timing.binary_errors, 0);
    for (symbol, delivery) in [
        ("DELIVCO", (Some(500_i64), Some(50.0_f64))),
        ("NULLCO", (None, None)),
    ] {
        let fields = conn
            .query_row(
                "SELECT open, high, low, close, volume, prev_close, trades, delivery_qty, delivery_pct
                 FROM eod_prices WHERE symbol = ? AND exchange = 'NSE' AND date = ?",
                params![symbol, date],
                |row| {
                    Ok((
                        [row.get::<_, f64>(0)?, row.get(1)?, row.get(2)?, row.get(3)?],
                        row.get::<_, i64>(4)?,
                        row.get::<_, Option<f64>>(5)?,
                        row.get::<_, Option<i64>>(6)?,
                        (row.get::<_, Option<i64>>(7)?, row.get::<_, Option<f64>>(8)?),
                    ))
                },
            )
            .unwrap();
        assert_eq!(fields, ([102.0, 112.0, 99.0, 109.0], 1200, Some(101.0), Some(60), delivery));
    }
}

#[test]
fn db_safe_03_bhavcopy_journal_replay_write_preserves_delivery() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();
    let date = "2026-06-16";
    conn.execute(
        "INSERT INTO eod_prices
         (symbol, exchange, date, open, high, low, close, delivery_qty, delivery_pct)
         VALUES ('DELIVCO', 'NSE', ?, 100, 110, 95, 105, 500, 50)",
        [date],
    )
    .unwrap();
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
               DELIVCO,EQ,102,112,99,109,1200,16-JUN-2026";
    let parsed = parse_bhavcopy_csv(csv, "NSE", date, &[]).unwrap();
    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        start_date: date.into(),
        end_date: date.into(),
        workers: 1,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: true,
    };
    prepare_bhavcopy_recovery_session(&db_path, &config, &[parsed]).unwrap();
    let sessions = crate::bhavcopy_recovery::load_pending_sessions(temp_dir.path()).unwrap();
    assert_eq!(sessions.len(), 1);
    let replay = parsed_files_from_recovery_session(&sessions[0]).unwrap();
    let (_, timing) = insert_parsed_bhavcopy_files_with_durability(
        &db_path,
        &replay,
        BinaryWriteDurability::Immediate,
    )
    .unwrap();
    assert_eq!(timing.binary_errors, 0);
    let fields = conn
        .query_row(
            "SELECT close, volume, delivery_qty, delivery_pct FROM eod_prices
             WHERE symbol = 'DELIVCO' AND exchange = 'NSE' AND date = ?",
            [date],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(fields, (109.0_f64, 1200_i64, Some(500_i64), Some(50.0_f64)));
}

#[test]
fn test_insert_parsed_bhavcopy_files_batches_binary_records_by_symbol() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
    let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                      BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

    let parsed_files = vec![
        parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
        parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
    ];
    let (results, timing) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();

    assert_eq!(results.len(), 2);
    assert_eq!(results[0].rows_inserted, 1);
    assert_eq!(results[1].rows_inserted, 1);
    assert_eq!(timing.parsed_jobs, 2);
    assert_eq!(timing.parsed_rows, 2);
    assert_eq!(timing.binary_symbols, 1);
    assert_eq!(timing.binary_inserted_dates, 2);
    assert_eq!(timing.binary_changed_dates, 0);
    assert_eq!(timing.binary_unchanged_dates, 0);
    assert_eq!(timing.binary_inserted_symbols, 1);
    assert_eq!(timing.binary_changed_symbols, 0);
    assert_eq!(timing.binary_unchanged_symbols, 0);
    assert_eq!(timing.binary_errors, 0);

    let bin_path = temp_dir
        .path()
        .join("eod_data")
        .join("NSE")
        .join("BATCHCO.eod");
    let binary = BinaryEodFile::open(&bin_path).unwrap();
    let records = binary.read_all().unwrap();
    assert_eq!(records.len(), 2);
    assert_eq!(records[0].date, 20260616);
    assert_eq!(records[1].date, 20260617);
}

#[test]
fn test_insert_parsed_bhavcopy_files_skips_existing_binary_records() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
    let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                      BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

    let parsed_files = vec![
        parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
        parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
    ];

    let (first_results, _) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();
    assert_eq!(first_results[0].rows_inserted, 1);
    assert_eq!(first_results[1].rows_inserted, 1);

    let (second_results, _) = insert_parsed_bhavcopy_files(&db_path, &parsed_files).unwrap();
    assert_eq!(second_results[0].rows_inserted, 0);
    assert_eq!(second_results[1].rows_inserted, 0);

    let bin_path = temp_dir
        .path()
        .join("eod_data")
        .join("NSE")
        .join("BATCHCO.eod");
    let binary = BinaryEodFile::open(&bin_path).unwrap();
    let records = binary.read_all().unwrap();
    assert_eq!(records.len(), 2);
    assert_eq!(records[0].date, 20260616);
    assert_eq!(records[1].date, 20260617);
}

#[test]
fn test_bhavcopy_buffered_durability_defers_only_append_newest_sync() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
    let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                      BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";

    let first_batch = vec![parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap()];
    insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

    let second_batch = vec![parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap()];
    let (results, timing) = insert_parsed_bhavcopy_files_with_durability(
        &db_path,
        &second_batch,
        BinaryWriteDurability::RecoveryJournalBuffered,
    )
    .unwrap();

    assert_eq!(results[0].rows_inserted, 1);
    assert_eq!(timing.binary_diagnostics.append_newest, 1);
    assert_eq!(timing.binary_diagnostics.sync_data_calls, 0);
    assert_eq!(timing.binary_diagnostics.deferred_sync_calls, 1);

    let bin_path = temp_dir
        .path()
        .join("eod_data")
        .join("NSE")
        .join("BATCHCO.eod");
    let binary = BinaryEodFile::open(&bin_path).unwrap();
    assert_eq!(
        binary
            .read_all()
            .unwrap()
            .iter()
            .map(|record| record.date)
            .collect::<Vec<_>>(),
        vec![20260616, 20260617]
    );
}

#[test]
fn test_insert_parsed_bhavcopy_files_counts_only_new_binary_rows_for_mixed_batch() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     BATCHCO,EQ,100,110,95,105,1000,16-JUN-2026";
    let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                      BATCHCO,EQ,106,112,104,111,1200,17-JUN-2026";
    let third_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     BATCHCO,EQ,112,118,110,117,1300,18-JUN-2026";

    let first_batch = vec![
        parse_bhavcopy_csv(first_csv, "NSE", "2026-06-16", &[]).unwrap(),
        parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
    ];
    insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

    let mixed_batch = vec![
        parse_bhavcopy_csv(second_csv, "NSE", "2026-06-17", &[]).unwrap(),
        parse_bhavcopy_csv(third_csv, "NSE", "2026-06-18", &[]).unwrap(),
    ];
    let (results, _) = insert_parsed_bhavcopy_files(&db_path, &mixed_batch).unwrap();

    assert_eq!(results.len(), 2);
    assert_eq!(results[0].rows_inserted, 0);
    assert_eq!(results[1].rows_inserted, 1);

    let bin_path = temp_dir
        .path()
        .join("eod_data")
        .join("NSE")
        .join("BATCHCO.eod");
    let binary = BinaryEodFile::open(&bin_path).unwrap();
    let records = binary.read_all().unwrap();
    assert_eq!(records.len(), 3);
    assert_eq!(
        records.iter().map(|record| record.date).collect::<Vec<_>>(),
        vec![20260616, 20260617, 20260618]
    );
}

#[test]
fn test_default_nse_index_plan_uses_daily_full_index_list_candidates() {
    let conn = setup_test_db();
    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: false,
            bse: false,
            nse_index: true,
            bse_index: false,
        },
        start_date: "2026-06-25".to_string(),
        end_date: "2026-06-25".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    assert!(plan.calendar_skip_results.is_empty());
    assert_eq!(plan.tasks.len(), 1);
    let task = &plan.tasks[0];
    assert_eq!(task.exchange, "NSE_INDEX");
    assert_eq!(task.trade_date, "2026-06-25");
    assert!(task.nse_index_history.is_none());
    assert!(task
        .candidates
        .iter()
        .any(|candidate| candidate.url.contains("ind_close_all_25062026.csv")));
    assert!(task
        .candidates
        .iter()
        .any(|candidate| candidate.url.ends_with("/archives/nseidx/bhav.csv")));
    assert!(!plan
        .info_messages
        .iter()
        .any(|message| message.contains("NIFTY and BANKNIFTY")));
}

#[test]
fn index_alias_import_mapping_uses_official_names_without_prefix_inference() {
    for (source_name, canonical) in [
        ("S&P CNX Nifty", "NIFTY"), ("CNX Nifty", "NIFTY"), ("Nifty 50", "NIFTY"),
        ("CNX Bank", "BANKNIFTY"), ("Nifty Bank", "BANKNIFTY"),
        ("CNX Nifty Junior", "NIFTYNEXT50"), ("CNX IT", "NIFTYIT"),
        ("CNX Smallcap", "SMALLCAP100"), ("CNX Finance", "FINNIFTY"),
        ("CNX Nifty Shariah", "NIFTY50SHARIAH"),
        ("CNX UNKNOWN", "CNXUNKNOWN"), ("Nifty 50 TR", "NIFTY50TR"),
        ("BSE SENSEX", "SENSEX"),
    ] {
        assert_eq!(map_index_symbol(source_name), canonical);
    }
}

#[test]
fn index_alias_prefilter_reports_exchange_completion_and_unverified_large_ranges() {
    let connection = setup_test_db();
    set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
    let start = NaiveDate::from_ymd_opt(2015, 1, 1).unwrap();
    for day in 0..40 {
        let date = (start + chrono::Duration::days(day)).format("%Y-%m-%d").to_string();
        connection.execute(
            "INSERT INTO download_log(trade_date,exchange,rows_inserted,max_volume,status)
             VALUES (?,'NSE_INDEX',34,100,'ok')", params![date],
        ).unwrap();
    }
    let plan = build_batch_plan(&connection, &BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection { nse: false, bse: false, nse_index: true, bse_index: false },
        start_date: "2015-01-01".to_string(), end_date: "2015-02-09".to_string(),
        workers: 2, excluded_series: Vec::new(), nse_equity_url_override: None,
        nse_index_url_override: None, bse_equity_url_override: None, bse_index_url_override: None,
        force_redownload: false,
    }).unwrap();
    // All 40 exchange-day markers are present and exceed the binary scan
    // limit. They do not establish which individual indices were imported.
    let metadata = storage_mode_load_imported_trade_dates(
        &connection, "NSE_INDEX", "2015-01-01", "2015-02-09",
    ).unwrap();
    assert_eq!(metadata.dates.len(), 40);
    assert!(metadata.dates.len() > BINARY_PREFILTER_RECONCILE_MAX_DATES);
    assert_eq!(metadata.binary_reconcile_target_dates, 0);
    assert_eq!(metadata.binary_reconcile_files_scanned, 0);

    let expected_dates: Vec<_> = (0..40)
        .map(|offset| start + chrono::Duration::days(offset))
        .filter(|date| date.weekday().number_from_monday() <= 5)
        .map(|date| date.format("%Y-%m-%d").to_string())
        .collect();
    assert_eq!(
        plan.tasks.iter().map(|task| &task.trade_date).collect::<Vec<_>>(),
        expected_dates.iter().collect::<Vec<_>>(),
    );
    assert_eq!(plan.calendar_skip_results.len(), 12);
    assert!(plan.tasks.iter().all(|task| {
        task.exchange == "NSE_INDEX" && task.nse_index_history.is_none() && !task.candidates.is_empty()
    }));
    assert!(plan.info_messages.iter().any(|message| {
        message.contains("Daily archives first")
            && message.contains("chunks up to 366 days")
            && message.contains("no full-history certification")
    }));
    assert!(!plan.info_messages.iter().any(|message| {
        message.contains("already imported trading days") || message.contains("31-date scan limit")
    }));
}

#[test]
fn test_special_trading_calendar_covers_recent_live_cash_sessions() {
    let expected = [
        ("2019-10-27", "Muhurat Trading"),
        ("2020-02-01", "Union Budget live trading session"),
        ("2020-11-14", "Muhurat Trading"),
        ("2023-11-12", "Muhurat Trading"),
        ("2024-01-20", "Special live trading session"),
        (
            "2024-03-02",
            "Disaster-recovery special live trading session",
        ),
        (
            "2024-05-18",
            "Disaster-recovery special live trading session",
        ),
        ("2024-11-01", "Muhurat Trading"),
        ("2025-02-01", "Union Budget live trading session"),
        ("2025-10-21", "Muhurat Trading"),
        ("2026-02-01", "Union Budget live trading session"),
        ("2026-11-08", "Muhurat Trading"),
    ];

    for exchange in ["NSE", "NSE_INDEX", "BSE", "BSE_INDEX"] {
        for (date, name) in expected {
            assert_eq!(special_trading_day_name(exchange, date), Some(name));
        }
    }
    assert_eq!(special_trading_day_name("MCX", "2026-02-01"), None);
}

#[test]
fn test_special_trading_day_bypasses_weekend_for_all_cash_sources() {
    let conn = setup_test_db();
    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: true,
            nse_index: true,
            bse_index: true,
        },
        start_date: "2026-02-01".to_string(),
        end_date: "2026-02-01".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    assert!(plan.calendar_skip_results.is_empty());
    assert_eq!(plan.tasks.len(), 4);
    for exchange in ["NSE", "BSE", "NSE_INDEX", "BSE_INDEX"] {
        assert!(plan
            .tasks
            .iter()
            .any(|task| { task.exchange == exchange && task.trade_date == "2026-02-01" }));
    }
    for label in ["NSE", "BSE", "NSE Index", "BSE Index"] {
        assert!(plan.info_messages.iter().any(|message| {
            message == &format!(
                "[{label}] 2026-02-01: Special trading day override (Union Budget live trading session); treated as trading day"
            )
        }));
    }
}

#[test]
fn test_holiday_calendar_remains_date_by_date_for_all_cash_sources() {
    let conn = setup_test_db();
    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: true,
            nse_index: true,
            bse_index: true,
        },
        start_date: "2026-06-26".to_string(),
        end_date: "2026-06-26".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    // A holiday row no longer suppresses the download. The date is planned for
    // every cash source and the calendar only explains the outcome afterwards.
    assert!(plan.calendar_skip_results.is_empty());
    assert_eq!(plan.tasks.len(), 4);
    for exchange in ["NSE", "BSE", "NSE_INDEX", "BSE_INDEX"] {
        assert!(
            plan.tasks
                .iter()
                .any(|task| task.exchange == exchange && task.trade_date == "2026-06-26"),
            "{exchange} 2026-06-26 should be attempted despite being a calendar holiday"
        );
    }
}

#[test]
fn test_bse_uses_shared_cash_market_holiday_calendar() {
    let conn = setup_test_db();
    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: false,
            bse: true,
            nse_index: false,
            bse_index: true,
        },
        start_date: "2026-06-26".to_string(),
        end_date: "2026-06-26".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    // BSE shares the cash-market calendar, but a holiday is still not a reason to
    // refuse the download - both BSE streams get planned.
    assert!(plan.calendar_skip_results.is_empty());
    assert_eq!(plan.tasks.len(), 2);
    for exchange in ["BSE", "BSE_INDEX"] {
        assert!(
            plan.tasks
                .iter()
                .any(|task| task.exchange == exchange && task.trade_date == "2026-06-26"),
            "{exchange} should be attempted"
        );
    }
}

#[test]
fn test_candidate_scan_soft_mismatch_does_not_mask_hard_error() {
    assert!(candidate_scan_should_skip("BSE_INDEX", 4, 4, false, false));
    assert!(candidate_scan_should_skip("BSE_INDEX", 4, 3, true, false));
    assert!(!candidate_scan_should_skip("BSE_INDEX", 4, 3, false, true));
    assert!(!candidate_scan_should_skip("BSE_INDEX", 4, 3, true, true));
    assert!(candidate_scan_should_skip("NSE", 2, 2, false, false));
}
#[test]
fn test_binary_prefilter_range_scan_counts_target_dates_across_files() {
    fn record(date: u32) -> EodRecord {
        EodRecord {
            date,
            flags: 0,
            open: 10000,
            high: 10100,
            low: 9900,
            close: 10050,
            prev_close: 9950,
            volume: 1000,
            oi: 0,
        }
    }

    let (temp_dir, _db_path) = create_temp_bhavcopy_db();
    let binary_folder = temp_dir.path().join("eod_data").join("NSE");
    std::fs::create_dir_all(&binary_folder).unwrap();

    let mut first = [
        20260803, 20260804, 20260805, 20260806, 20260807, 20260810, 20260811, 20260812,
    ]
    .into_iter()
    .map(record)
    .collect::<Vec<_>>();
    let mut second = [20260803, 20260804, 20260806, 20260807, 20260810, 20260812]
        .into_iter()
        .map(record)
        .collect::<Vec<_>>();
    let mut outside = [20260730, 20260731]
        .into_iter()
        .map(record)
        .collect::<Vec<_>>();

    BinaryEodFile::write_all(
        binary_folder.join("FIRST.eod"),
        "FIRST",
        "NSE",
        DEFAULT_SCALE,
        &mut first,
    )
    .unwrap();
    BinaryEodFile::write_all(
        binary_folder.join("SECOND.eod"),
        "SECOND",
        "NSE",
        DEFAULT_SCALE,
        &mut second,
    )
    .unwrap();
    BinaryEodFile::write_all(
        binary_folder.join("OUTSIDE.eod"),
        "OUTSIDE",
        "NSE",
        DEFAULT_SCALE,
        &mut outside,
    )
    .unwrap();

    let (counts, files_scanned) =
        count_binary_files_containing_dates(&binary_folder, vec![20260805, 20260811, 20260813])
            .unwrap();

    assert_eq!(files_scanned, 3);
    assert_eq!(counts.get(&20260805).copied(), Some(1));
    assert_eq!(counts.get(&20260811).copied(), Some(1));
    assert_eq!(counts.get(&20260813).copied(), Some(0));
}

#[test]
fn test_binary_prefilter_worker_count_is_bounded_to_four() {
    assert_eq!(MAX_BHAVCOPY_PREFILTER_WORKERS, 4);
    assert_eq!(bhavcopy_prefilter_worker_count(0), 0);
    assert_eq!(bhavcopy_prefilter_worker_count(1), 1);
    assert_eq!(bhavcopy_prefilter_worker_count(4), 4);
    assert_eq!(bhavcopy_prefilter_worker_count(5), 4);
    assert_eq!(bhavcopy_prefilter_worker_count(20_000), 4);
}
#[test]
fn test_range_mode_prefilters_already_imported_trading_days() {
    let conn = setup_test_db();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    conn.execute(
        "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
        params!["2026-06-23", "NSE", 3200, 1000, "ok"],
    )
    .unwrap();

    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        start_date: "2026-06-22".to_string(),
        end_date: "2026-06-24".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    assert_eq!(plan.tasks.len(), 2);
    assert_eq!(plan.tasks[0].trade_date, "2026-06-22");
    assert_eq!(plan.tasks[1].trade_date, "2026-06-24");
    assert!(plan
        .info_messages
        .iter()
        .any(|message| message.contains("[NSE] Prefiltered 1 already imported trading days")));
}

#[test]
fn test_range_mode_force_redownload_plans_existing_dates_for_repair() {
    let conn = setup_test_db();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    conn.execute(
        "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
        params!["2026-06-23", "NSE", 3200, 1000, "ok"],
    )
    .unwrap();

    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        start_date: "2026-06-22".to_string(),
        end_date: "2026-06-24".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: true,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    // The already-imported day is planned again: a repair must be able to replace it.
    assert_eq!(plan.tasks.len(), 3);
    assert_eq!(plan.tasks[0].trade_date, "2026-06-22");
    assert_eq!(plan.tasks[1].trade_date, "2026-06-23");
    assert_eq!(plan.tasks[2].trade_date, "2026-06-24");
    assert!(!plan
        .info_messages
        .iter()
        .any(|message| message.contains("Prefiltered")));
    assert!(plan
        .info_messages
        .iter()
        .any(|message| message.contains("[NSE] Repair re-download: existing coverage ignored")));
}

#[test]
fn test_force_redownload_is_rejected_outside_range_mode() {
    use crate::bhavcopy::settings::normalize_batch_config;
    for mode in [DownloadMode::Update, DownloadMode::FullHistory] {
        let config = BatchDownloadConfig {
            mode,
            exchanges: ExchangeSelection { nse: true, bse: false, nse_index: false, bse_index: false },
            start_date: "2026-06-22".to_string(),
            end_date: "2026-06-24".to_string(),
            workers: 2,
            excluded_series: Vec::new(),
            nse_equity_url_override: None,
            nse_index_url_override: None,
            bse_equity_url_override: None,
            bse_index_url_override: None,
            force_redownload: true,
        };
        let error = normalize_batch_config(config).unwrap_err();
        assert!(error.contains("only available in Date Range mode"), "{error}");
    }

    let range = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection { nse: true, bse: false, nse_index: false, bse_index: false },
        start_date: "2026-06-22".to_string(),
        end_date: "2026-06-24".to_string(),
        workers: 12,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: true,
    };
    let normalized = normalize_batch_config(range).unwrap();
    assert!(normalized.force_redownload);
    assert_eq!(normalized.workers, 10);
}

#[test]
fn test_nse_equity_mixed_date_archive_is_rejected_before_writes() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
    let header = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP,ISIN
";
    let mixed = format!(
        "{header}AAA,EQ,10,11,9,10.5,100,20-NOV-2014,INE000A01001
BBB,EQ,20,21,19,20.5,200,21-NOV-2014,INE000A01002
"
    );
    let error = parse_and_insert(&db_path, &mixed, "NSE", "2014-11-20", &[])
        .err()
        .expect("mixed-date archive must be rejected");
    assert!(error.contains("Mixed-date NSE archive"), "{error}");
    assert!(error.contains("BBB"), "{error}");

    // Blank per-row dates stay tolerated (historical shapes exist).
    let blank = format!(
        "{header}AAA,EQ,10,11,9,10.5,100,20-NOV-2014,INE000A01001
BBB,EQ,20,21,19,20.5,200,,INE000A01002
"
    );
    let parsed = parse_and_insert(&db_path, &blank, "NSE", "2014-11-20", &[]).unwrap();
    assert_eq!(parsed.rows_inserted, 2);

    // BSE parsing keeps its previous semantics.
    let bse = format!("{header}AAA,EQ,10,11,9,10.5,100,21-NOV-2014,INE000A01001
");
    assert!(parse_and_insert(&db_path, &bse, "BSE", "2014-11-20", &[]).is_ok());
}

#[test]
fn test_normalize_trade_date_value_resolves_two_digit_years() {
    assert_eq!(
        normalize_trade_date_value("13-Jul-20").as_deref(),
        Some("2020-07-13")
    );
    assert_eq!(
        normalize_trade_date_value("13-Jul-2020").as_deref(),
        Some("2020-07-13")
    );
    assert_eq!(
        normalize_trade_date_value("27-OCT-2019").as_deref(),
        Some("2019-10-27")
    );
    assert_eq!(
        normalize_trade_date_value("2020-07-13").as_deref(),
        Some("2020-07-13")
    );
    assert_eq!(normalize_trade_date_value("not-a-date"), None);
}

#[test]
fn test_nse_equity_two_digit_year_archive_date_is_accepted() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
    // NSE's legacy 2020-07-13 archive carries `13-Jul-20` in every TIMESTAMP
    // cell; the two-digit year must resolve to 2020, not year 20 AD.
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,PREVCLOSE,TOTTRDQTY,TIMESTAMP,ISIN
AAA,EQ,10,11,9,10.5,9.9,100,13-Jul-20,INE000A01001";
    let parsed = parse_and_insert(&db_path, csv, "NSE", "2020-07-13", &[])
        .expect("two-digit year archive must be accepted");
    assert_eq!(parsed.rows_inserted, 1);

    // A file whose resolved date is another session is still refused.
    let stale = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,PREVCLOSE,TOTTRDQTY,TIMESTAMP,ISIN
AAA,EQ,10,11,9,10.5,9.9,100,01-Oct-2019,INE000A01001";
    let parsed = parse_and_insert(&db_path, stale, "NSE", "2019-10-02", &[]).unwrap();
    assert_eq!(parsed.rows_inserted, 0);
    assert!(parsed
        .debug
        .as_deref()
        .unwrap_or_default()
        .contains("Archive date mismatch"));
}

#[test]
fn test_binary_write_failure_is_never_reported_as_success() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let nse_dir = temp_dir.path().join("eod_data").join("NSE");
    fs::create_dir_all(&nse_dir).unwrap();
    // Deterministic fault injection: the writer cannot open a directory as the
    // symbol's binary file, so the binary stage reports an error.
    fs::create_dir_all(nse_dir.join("AAA.eod")).unwrap();
    let csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP,ISIN
               AAA,EQ,10,11,9,10.5,100,20-NOV-2014,INE000A01001";
    let error = parse_and_insert(&db_path, csv, "NSE", "2014-11-20", &[])
        .err()
        .expect("binary failure must be surfaced");
    assert!(error.contains("Binary store write failed"), "{error}");
}

#[test]
fn test_staged_replacement_only_import_is_truthful_and_idempotent() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
    {
        let conn = open_database_connection(&db_path).unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    }
    let lock = Mutex::new(());
    let csv = |close: &str| {
        format!(
            "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP,ISIN
AAA,EQ,10,11,9,{close},100,20-NOV-2014,INE000A01001"
        )
    };
    let staged = |body: String| StagedDownload {
        task: DownloadTask {
            exchange: "NSE".to_string(),
            trade_date: "2014-11-20".to_string(),
            mode: DownloadMode::Range,
            candidates: Vec::new(),
            nse_index_history: None,
        },
        content: StagedDownloadContent::Csv(body),
    };

    // First import: a plain insert.
    let first = import_staged_download(&db_path, staged(csv("10.5")), &[], &lock).unwrap();
    assert!(first.success);
    assert_eq!(first.rows_inserted, 1);

    // Repair re-import of the same date: replacement, still reported as work.
    let repaired = import_staged_download(&db_path, staged(csv("11.25")), &[], &lock).unwrap();
    assert!(repaired.success, "{}", repaired.message);
    assert_eq!(repaired.rows_inserted, 1);
    assert!(repaired.message.contains("Replaced 1 existing records"), "{}", repaired.message);

    // Re-importing the identical row is an explicit no-op, not fake work.
    let noop = import_staged_download(&db_path, staged(csv("11.25")), &[], &lock).unwrap();
    assert_eq!(noop.rows_inserted, 0);

    let file = BinaryEodFile::open(temp_dir.path().join("eod_data").join("NSE").join("AAA.eod")).unwrap();
    let rows = file.read_all().unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].close, 112_500);
}

#[test]
fn test_binary_reimport_reports_replaced_rows_as_work() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    drop(conn);

    let first = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\nSBIN,EQ,294.75,298.75,291.25,297.1,297.1,2910.5,18099509,5369829564,20-NOV-2014,39614,INE062A01012";
    let repair = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\nSBIN,EQ,295.5,299.25,292.0,297.85,297.85,2910.5,18099509,5369829564,20-NOV-2014,39614,INE062A01012";
    let inserted = parse_and_insert(&db_path, first, "NSE", "2014-11-20", &[]).unwrap();
    assert_eq!(inserted.rows_inserted, 1);
    assert_eq!(inserted.rows_replaced, 0);

    // A repair re-imports an existing date: the row is replaced, not inserted,
    // and the work must still be reported (download_log contract).
    let replaced = parse_and_insert(&db_path, repair, "NSE", "2014-11-20", &[]).unwrap();
    assert_eq!(replaced.rows_inserted, 0);
    assert_eq!(replaced.rows_replaced, 1);

    let stored = BinaryEodFile::open(temp_dir.path().join("eod_data").join("NSE").join("SBIN.eod"))
        .unwrap()
        .read_all()
        .unwrap();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].close, 2_978_500);
}

#[test]
fn test_range_mode_refreshes_metadata_only_binary_dates() {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    fs::create_dir_all(temp_dir.path().join("eod_data").join("NSE")).unwrap();
    let conn = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
    conn.execute(
        "INSERT INTO download_log (trade_date, exchange, rows_inserted, max_volume, status) VALUES (?, ?, ?, ?, ?)",
        params!["2026-06-23", "NSE", 3200, 1000, "ok"],
    )
    .unwrap();

    let config = BatchDownloadConfig {
        mode: DownloadMode::Range,
        exchanges: ExchangeSelection {
            nse: true,
            bse: false,
            nse_index: false,
            bse_index: false,
        },
        start_date: "2026-06-22".to_string(),
        end_date: "2026-06-24".to_string(),
        workers: 2,
        excluded_series: Vec::new(),
        nse_equity_url_override: None,
        nse_index_url_override: None,
        bse_equity_url_override: None,
        bse_index_url_override: None,
        force_redownload: false,
    };

    let plan = build_batch_plan(&conn, &config).unwrap();

    assert_eq!(plan.tasks.len(), 3);
    assert_eq!(plan.tasks[0].trade_date, "2026-06-22");
    assert_eq!(plan.tasks[1].trade_date, "2026-06-23");
    assert_eq!(plan.tasks[2].trade_date, "2026-06-24");
    assert!(plan
        .info_messages
        .iter()
        .any(|message| message
            .contains("[NSE] Scheduled 1 metadata-only trading days for refresh")));
}

#[test]
fn test_nse_index_history_chunks_split_selected_range() {
    let tasks =
        generate_nse_index_history_tasks("1993-01-01", "1994-01-15", &DownloadMode::Range)
            .unwrap();

    assert_eq!(tasks.len(), 4);
    assert_eq!(tasks[0].trade_date, "1993-01-01..1993-12-31 NIFTY");
    assert_eq!(tasks[1].trade_date, "1993-01-01..1993-12-31 BANKNIFTY");
    assert_eq!(tasks[2].trade_date, "1994-01-01..1994-01-15 NIFTY");
    assert_eq!(tasks[3].trade_date, "1994-01-01..1994-01-15 BANKNIFTY");
}

#[test]
fn nifty_daily_index_rejects_mixed_dates_and_invalid_ohlc() {
    let mixed = "Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value\nNIFTY 50,02-01-2024,100,110,90,105\nNIFTY BANK,03-01-2024,100,110,90,105\n";
    assert!(parse_bhavcopy_csv(mixed,"NSE_INDEX","2024-01-02",&[]).is_err());
    let invalid = mixed.replace("03-01-2024","02-01-2024").replace("100,110,90,105","100,99,90,105");
    assert!(parse_bhavcopy_csv(&invalid,"NSE_INDEX","2024-01-02",&[]).is_err());
}

#[test]
fn nifty_legacy_history_writer_is_blocked_before_any_database_write() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("must-not-exist.sqlite3");
    let result = insert_nse_index_history_rows(&path,"NSE_INDEX",&NseIndexHistoryNormalizeResult { rows: vec![], close_only_skipped: 0 });
    assert!(result.err().unwrap().contains("Historical Review"));
    assert!(!path.exists());
}

#[test]
fn nifty_range_update_full_history_keep_daily_planning_semantics() {
    let conn = setup_test_db();
    let mut messages = Vec::new();
    let range = resolve_exchange_date_window(&conn,&DownloadMode::Range,"NSE_INDEX","2024-01-20","2024-01-20",&mut messages).unwrap().unwrap();
    assert_eq!(range,("2024-01-20".into(),"2024-01-20".into()));
    for (exchange, baseline) in [("NSE","1994-11-03"),("NSE_INDEX","1990-07-03"),("BSE","1990-01-01"),("BSE_INDEX","1990-01-01")] {
        let window = resolve_exchange_date_window(&conn,&DownloadMode::FullHistory,exchange,"2000-01-01","2000-01-02",&mut messages).unwrap().unwrap();
        assert_eq!(window.0,baseline);assert_eq!(window.1,today_trade_date());
    }
    conn.execute("INSERT INTO eod_prices(date,symbol,exchange,close,volume) VALUES('2024-01-02','BANKNIFTY','NSE_INDEX',100,1)",[]).unwrap();
    let update = resolve_exchange_date_window(&conn,&DownloadMode::Update,"NSE_INDEX","1990-07-03","2024-01-02",&mut messages).unwrap().unwrap();
    assert_eq!(update.0,"2024-01-03");
    // Exchange-level Update is intentionally NOT proof of NIFTY coverage.
    assert_eq!(update.1,update_end_trade_date());
}

#[test]
fn test_nse_index_history_normalizes_old_nifty_and_skips_close_only_rows() {
    let rows = vec![
        NseIndexHistoryRow {
            index_name: Some("S&P CNX NIFTY".to_string()),
            open: Some(0.0),
            high: Some(0.0),
            low: Some(0.0),
            close: Some(744.92),
            traded_qty: None,
            timestamp: Some("04-JAN-1993".to_string()),
        },
        NseIndexHistoryRow {
            index_name: Some("S&P CNX NIFTY".to_string()),
            open: Some(1000.0),
            high: Some(1010.0),
            low: Some(990.0),
            close: Some(1005.0),
            traded_qty: Some(12345.0),
            timestamp: Some("03-NOV-1995".to_string()),
        },
    ];

    let normalized = normalize_nse_index_history_rows(&rows, "NIFTY", "NIFTY 50");

    assert_eq!(normalized.close_only_skipped, 1);
    assert_eq!(normalized.rows.len(), 1);
    assert_eq!(normalized.rows[0].symbol, "NIFTY");
    assert_eq!(normalized.rows[0].trade_date, "1995-11-03");
    assert_eq!(normalized.rows[0].volume, 12345);
}

#[test]
fn test_state_shadow_matches_equivalent_physical_baseline() {
    let physical = PhysicalRecoveryPreState {
        existed_before: true,
        record_count: 10,
        price_scale: 100,
        file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
        last_date: Some(20260818),
        file_mtime_ns: Some(123456),
    };
    let indexed = VerifiedBinaryState {
        key: BinaryStateKey::new("NSE", "AAA"),
        relative_path: "eod_data/NSE/AAA.eod".to_string(),
        record_count: 10,
        price_scale: 100,
        file_length: physical.file_length,
        first_date: Some(20260801),
        last_date: Some(20260818),
        file_mtime_ns: 123456,
        state_generation: 1,
    };

    assert_eq!(
        classify_recovery_state_shadow(&physical, Some(&indexed)),
        BhavcopyStateShadowComparison::Matched
    );
}

#[test]
fn test_state_shadow_reports_each_core_mismatch() {
    let physical = PhysicalRecoveryPreState {
        existed_before: true,
        record_count: 10,
        price_scale: 100,
        file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
        last_date: Some(20260818),
        file_mtime_ns: Some(123456),
    };
    let base = VerifiedBinaryState {
        key: BinaryStateKey::new("NSE", "AAA"),
        relative_path: "eod_data/NSE/AAA.eod".to_string(),
        record_count: 10,
        price_scale: 100,
        file_length: physical.file_length,
        first_date: Some(20260801),
        last_date: Some(20260818),
        file_mtime_ns: 123456,
        state_generation: 1,
    };

    let mut record_count = base.clone();
    record_count.record_count = 11;
    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&record_count)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));

    let mut price_scale = base.clone();
    price_scale.price_scale = 10_000;
    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&price_scale)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));

    let mut file_length = base.clone();
    file_length.file_length += RECORD_SIZE as u64;
    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&file_length)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));

    let mut last_date = base.clone();
    last_date.last_date = Some(20260817);
    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&last_date)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));

    let mut mtime = base;
    mtime.file_mtime_ns += 1;
    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&mtime)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));
}

#[test]
fn test_state_shadow_is_unavailable_when_index_row_is_missing() {
    let physical = PhysicalRecoveryPreState {
        existed_before: true,
        record_count: 10,
        price_scale: 100,
        file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
        last_date: Some(20260818),
        file_mtime_ns: Some(123456),
    };

    assert_eq!(
        classify_recovery_state_shadow(&physical, None),
        BhavcopyStateShadowComparison::Unavailable
    );
}

#[test]
fn test_state_shadow_flags_indexed_file_when_physical_file_is_absent() {
    let physical = PhysicalRecoveryPreState {
        existed_before: false,
        record_count: 0,
        price_scale: DEFAULT_SCALE,
        file_length: 0,
        last_date: None,
        file_mtime_ns: None,
    };
    let indexed = VerifiedBinaryState {
        key: BinaryStateKey::new("NSE", "AAA"),
        relative_path: "eod_data/NSE/AAA.eod".to_string(),
        record_count: 10,
        price_scale: 100,
        file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
        first_date: Some(20260801),
        last_date: Some(20260818),
        file_mtime_ns: 123456,
        state_generation: 1,
    };

    assert!(matches!(
        classify_recovery_state_shadow(&physical, Some(&indexed)),
        BhavcopyStateShadowComparison::Mismatched(_)
    ));
}

#[test]
fn binary_coverage_requires_exact_record_not_only_index_bounds() {
    let fixture = tempfile::tempdir().unwrap();
    let connection = Connection::open(fixture.path().join("fixture.db")).unwrap();
    let index = Connection::open(fixture.path().join("eod_binary_state.sqlite")).unwrap();
    index
        .execute_batch(
            "CREATE TABLE eod_binary_state (
        exchange TEXT, symbol TEXT, record_count INTEGER, first_date INTEGER, last_date INTEGER);
        INSERT INTO eod_binary_state VALUES ('NSE','GAPPED',2,20260805,20260807);",
        )
        .unwrap();
    let folder = fixture.path().join("eod_data/NSE");
    std::fs::create_dir_all(&folder).unwrap();
    let mut records = vec![
        baseline_fast_path_test_record(20260805, 100),
        baseline_fast_path_test_record(20260807, 101),
    ];
    BinaryEodFile::write_all(
        folder.join("GAPPED.eod"),
        "GAPPED",
        "NSE",
        DEFAULT_SCALE,
        &mut records,
    )
    .unwrap();
    for (date, expected) in [
        ("2026-08-05", true),
        ("2026-08-06", false),
        ("2026-08-07", true),
        ("2026-08-04", false),
    ] {
        assert_eq!(
            super::ingestion::binary_store_has_imported_rows_for_date(&connection, date, "NSE")
                .unwrap(),
            expected,
            "{date}"
        );
    }
    index
        .execute("UPDATE eod_binary_state SET symbol='MISSING'", [])
        .unwrap();
    assert!(!super::ingestion::binary_store_has_imported_rows_for_date(
        &connection,
        "2026-08-05",
        "NSE"
    )
    .unwrap());
}

fn baseline_fast_path_test_record(date: u32, close: i64) -> EodRecord {
    EodRecord {
        date,
        flags: 0,
        open: close,
        high: close,
        low: close,
        close,
        prev_close: close,
        volume: 1,
        oi: 0,
    }
}

fn baseline_fast_path_test_file(exchange: &str, symbol: &str, date: u32) -> ParsedBhavcopyFile {
    ParsedBhavcopyFile {
        exchange: exchange.to_string(),
        trade_date: format!(
            "{}-{:02}-{:02}",
            date / 10000,
            (date / 100) % 100,
            date % 100
        ),
        rows: vec![ParsedBhavcopyRow {
            symbol: symbol.to_string(),
            instrument_name: symbol.to_string(),
            series: "EQ".to_string(),
            isin: String::new(),
            trade_date: format!(
                "{}-{:02}-{:02}",
                date / 10000,
                (date / 100) % 100,
                date % 100
            ),
            open: 10.0,
            high: 10.0,
            low: 10.0,
            close: 10.0,
            prev_close: Some(10.0),
            volume: 1,
            oi: 0,
            trades: None,
            binary_record: baseline_fast_path_test_record(date, 1000),
        }],
        max_volume: 1,
        debug: None,
    }
}

#[test]
fn test_baseline_fast_path_uses_verified_state_without_physical_open() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut existing = vec![baseline_fast_path_test_record(20260819, 900)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    let status = index.rebuild().unwrap();
    assert!(status.healthy);
    drop(index);

    let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
    let (baselines, shadow, fast) =
        capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

    assert_eq!(baselines.len(), 1);
    assert!(matches!(
        baselines[0].kind,
        RecoveryBinaryBaselineKind::AppendNewest
    ));
    assert_eq!(baselines[0].record_count, 1);
    assert_eq!(fast.fast, 1);
    assert_eq!(fast.fallback, 0);
    assert_eq!(fast.physical_opens, 0);
    assert_eq!(fast.metadata_mismatch, 0);
    assert_eq!(shadow.compared, 0);
}

#[test]
fn test_baseline_fast_path_falls_back_when_file_identity_changes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut existing = vec![baseline_fast_path_test_record(20260818, 800)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();
    drop(index);

    BinaryEodFile::append_or_merge_records(
        &path,
        "AAA",
        "NSE",
        100,
        vec![baseline_fast_path_test_record(20260819, 900)],
    )
    .unwrap();

    let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
    let (baselines, shadow, fast) =
        capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

    assert_eq!(baselines.len(), 1);
    assert_eq!(baselines[0].record_count, 2);
    assert_eq!(fast.fast, 0);
    assert_eq!(fast.fallback, 1);
    assert_eq!(fast.physical_opens, 1);
    assert_eq!(fast.metadata_mismatch, 1);
    assert_eq!(shadow.mismatched, 1);
}

#[test]
fn test_baseline_fast_path_falls_back_when_index_is_unavailable() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut aaa = vec![baseline_fast_path_test_record(20260819, 900)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut aaa).unwrap();

    let incoming = vec![baseline_fast_path_test_file("NSE", "AAA", 20260820)];
    let (baselines, _shadow, fast) =
        capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

    assert_eq!(baselines[0].record_count, 1);
    assert!(!fast.index_available);
    assert_eq!(fast.fast, 0);
    assert_eq!(fast.fallback, 1);
    assert_eq!(fast.index_untrusted, 1);
    assert_eq!(fast.physical_opens, 1);
}

#[test]
fn test_baseline_fast_path_falls_back_when_verified_row_is_missing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut aaa = vec![baseline_fast_path_test_record(20260819, 900)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut aaa).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();
    drop(index);

    let bbb_path = dir.path().join("eod_data").join("NSE").join("BBB.eod");
    let mut bbb = vec![baseline_fast_path_test_record(20260819, 1000)];
    BinaryEodFile::write_all(&bbb_path, "BBB", "NSE", 100, &mut bbb).unwrap();

    let incoming = vec![baseline_fast_path_test_file("NSE", "BBB", 20260820)];
    let (baselines, _shadow, fast) =
        capture_recovery_binary_baselines(dir.path(), &incoming).unwrap();

    assert_eq!(baselines[0].record_count, 1);
    assert_eq!(fast.fast, 0);
    assert_eq!(fast.fallback, 1);
    assert_eq!(fast.missing_rows, 1);
    assert_eq!(fast.physical_opens, 1);
}

#[test]
fn test_v14_append_newest_fast_classification_builds_hint_from_verified_baseline() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut existing = vec![baseline_fast_path_test_record(20260820, 100)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    let status = index.rebuild().unwrap();
    let rows = index.load_verified().unwrap();
    let key = BinaryStateKey::new("NSE", "AAA");
    let indexed = rows.get(&key).unwrap().clone();
    drop(index);

    let baseline = RecoveryBinaryBaseline {
        exchange: "NSE".to_string(),
        symbol: "AAA".to_string(),
        kind: RecoveryBinaryBaselineKind::AppendNewest,
        existed_before: true,
        record_count: indexed.record_count,
        price_scale: indexed.price_scale,
        file_length: indexed.file_length,
        target_dates: vec![20260821],
    };

    let (hints, hint_stats) = build_bhavcopy_append_newest_fast_hints(dir.path(), &[baseline]);

    assert!(status.healthy);
    assert_eq!(hint_stats.candidates, 1);
    assert_eq!(hint_stats.hinted, 1);
    assert_eq!(hint_stats.fallback, 0);
    assert_eq!(hint_stats.state_mismatch, 0);
    assert_eq!(hint_stats.index_untrusted, 0);

    let hint = hints.get(&("NSE".to_string(), "AAA".to_string())).unwrap();
    assert_eq!(hint.record_count, indexed.record_count);
    assert_eq!(hint.price_scale, indexed.price_scale);
    assert_eq!(hint.file_length, indexed.file_length);
    assert_eq!(hint.file_mtime_ns, indexed.file_mtime_ns);
    assert_eq!(hint.last_date, 20260820);
}

#[test]
fn test_v14_append_newest_fast_classification_rejects_baseline_state_mismatch() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("eod_data").join("NSE").join("AAA.eod");
    let mut existing = vec![baseline_fast_path_test_record(20260820, 100)];
    BinaryEodFile::write_all(&path, "AAA", "NSE", 100, &mut existing).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    index.rebuild().unwrap();
    let rows = index.load_verified().unwrap();
    let key = BinaryStateKey::new("NSE", "AAA");
    let indexed = rows.get(&key).unwrap().clone();
    drop(index);

    let baseline = RecoveryBinaryBaseline {
        exchange: "NSE".to_string(),
        symbol: "AAA".to_string(),
        kind: RecoveryBinaryBaselineKind::AppendNewest,
        existed_before: true,
        record_count: indexed.record_count,
        price_scale: indexed.price_scale,
        file_length: indexed.file_length + 1,
        target_dates: vec![20260821],
    };

    let (hints, hint_stats) = build_bhavcopy_append_newest_fast_hints(dir.path(), &[baseline]);

    assert!(hints.is_empty());
    assert_eq!(hint_stats.candidates, 1);
    assert_eq!(hint_stats.hinted, 0);
    assert_eq!(hint_stats.fallback, 1);
    assert_eq!(hint_stats.state_mismatch, 1);
}

#[test]
fn test_v14_append_newest_fast_classification_bhavcopy_integration_uses_zero_classification_reads(
) {
    let (temp_dir, db_path) = create_temp_bhavcopy_db();
    let connection = open_database_connection(&db_path).unwrap();
    set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
    drop(connection);

    let first_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                     FASTCO,EQ,100,110,95,105,1000,20-AUG-2026";
    let second_csv = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP\n\
                      FASTCO,EQ,106,112,104,111,1200,21-AUG-2026";

    let first_batch = vec![parse_bhavcopy_csv(first_csv, "NSE", "2026-08-20", &[]).unwrap()];
    insert_parsed_bhavcopy_files(&db_path, &first_batch).unwrap();

    let mut index = BinaryStateIndex::open(temp_dir.path()).unwrap();
    let status = index.rebuild().unwrap();
    assert!(status.healthy);
    drop(index);

    let second_batch = vec![parse_bhavcopy_csv(second_csv, "NSE", "2026-08-21", &[]).unwrap()];
    let (baselines, _shadow, baseline_fast) =
        capture_recovery_binary_baselines(temp_dir.path(), &second_batch).unwrap();
    assert_eq!(baseline_fast.fast, 1);
    assert_eq!(baseline_fast.physical_opens, 0);

    let (results, timing) =
        insert_parsed_bhavcopy_files_with_durability_and_recovery_baselines(
            &db_path,
            &second_batch,
            BinaryWriteDurability::RecoveryJournalBuffered,
            Some(&baselines),
        )
        .unwrap();

    assert_eq!(results[0].rows_inserted, 1);
    assert_eq!(timing.append_newest_fast_hint_stats.candidates, 1);
    assert_eq!(timing.append_newest_fast_hint_stats.hinted, 1);
    assert_eq!(timing.append_newest_fast_hint_stats.fallback, 0);
    assert_eq!(timing.binary_diagnostics.append_newest_fast_trusted, 1);
    assert_eq!(timing.binary_diagnostics.append_newest_fast_fast, 1);
    assert_eq!(timing.binary_diagnostics.append_newest_fast_fallback, 0);
    assert_eq!(timing.binary_diagnostics.header_classification_reads, 0);
    assert_eq!(timing.binary_diagnostics.last_date_classification_reads, 0);
    assert_eq!(timing.binary_diagnostics.append_newest, 1);
    assert_eq!(timing.binary_diagnostics.deferred_sync_calls, 1);
}

#[test]
fn fill_missing_prev_close_uses_the_previous_batch_close() {
    fn rec(date: u32, close: i64, prev_close: i64) -> BhavcopyBinaryRecord {
        BhavcopyBinaryRecord {
            file_index: 0,
            record: EodRecord {
                date,
                flags: 0,
                open: close,
                high: close,
                low: close,
                close,
                prev_close,
                volume: 1,
                oi: 0,
            },
        }
    }
    // Sorted ascending; source supplied PREV_CLOSE only on the middle record.
    let mut records = vec![
        rec(20240101, 100, 0),
        rec(20240102, 110, 105),
        rec(20240103, 120, 0),
    ];
    let filled = super::ingestion::fill_missing_prev_close(&mut records);
    assert_eq!(filled, 1, "only the trailing record had a gap");
    assert_eq!(records[0].record.prev_close, 0, "first record keeps 0");
    assert_eq!(records[1].record.prev_close, 105, "source value preserved");
    assert_eq!(records[2].record.prev_close, 110, "filled from previous close");

    // A single record cannot be filled, and a zero previous close chains.
    let mut single = vec![rec(20240101, 100, 0)];
    assert_eq!(super::ingestion::fill_missing_prev_close(&mut single), 0);
    let mut chain = vec![rec(20240101, 100, 0), rec(20240102, 0, 0), rec(20240103, 120, 0)];
    super::ingestion::fill_missing_prev_close(&mut chain);
    assert_eq!(chain[1].record.prev_close, 100, "filled from the first close");
    assert_eq!(chain[2].record.prev_close, 0, "a zero predecessor close cannot fill");
}

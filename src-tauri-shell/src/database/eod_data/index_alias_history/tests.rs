use super::*;
use std::fs;
use tempfile::tempdir;

#[test]
fn nifty_historical_review_to_chart_query_and_binary_transport() {
    let dir = tempdir().unwrap();
    let db = dir.path().join("review-fixture.sqlite3");
    crate::nifty_history::tests::import_synthetic_verified_fixture(&db);
    let connection = Connection::open(&db).unwrap();
    let rows = load(dir.path(), &connection, "NIFTY", PriceStorageMode::Binary).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].date, "2024-01-02");
    assert_eq!(rows[0].close, 105.0);
    let bars = rows.into_iter().map(|r| EodRow { date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,prev_close:r.prev_close,volume:r.volume,open_interest:r.open_interest }).collect::<Vec<_>>();
    assert_eq!(encode_eod_rows_binary_b64(&bars).len(), 88);
}

#[test]
#[ignore = "Explicit captured-source acceptance; requires new isolated fixture root and retained source paths"]
fn nifty_captured_source_acceptance_to_chart_query() {
    let (db, count) = crate::nifty_history::tests::import_captured_verified_fixture();
    let connection = Connection::open(&db).unwrap();
    let root = db.parent().unwrap();
    let rows = load(root, &connection, "NIFTY", PriceStorageMode::Binary).unwrap();
    assert_eq!(rows.len(), count);
    let binary = BinaryEodFile::open(root.join("eod_data/NSE_INDEX/NIFTY.eod")).unwrap();
    let records = binary.read_all().unwrap();
    for (row, record) in rows.iter().zip(&records) {
        assert_eq!(date_to_u32(&row.date),record.date);
        assert_eq!([row.open,row.high,row.low,row.close],
            [record.open,record.high,record.low,record.close].map(|p|p as f64 / binary.header.price_scale as f64));
    }
    let bars = rows.into_iter().map(|r| EodRow { date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,prev_close:r.prev_close,volume:r.volume,open_interest:r.open_interest }).collect::<Vec<_>>();
    let response = encode_eod_rows_binary_b64(&bars);
    fs::write(root.join("chart-readback-result.json"),serde_json::to_vec_pretty(&serde_json::json!({
        "status":"PASS","barCount":count,"binaryTransportBase64Length":response.len(),"allChartOHLCMatchBinary":true,
        "scope":"Backend chart query and binary IPC serialization; native desktop rendering not exercised"
    })).unwrap()).unwrap();
}

#[test]
#[ignore = "Explicit read-only comparison of the selected database; requires evidence output path"]
fn readonly_nifty_transport_parity_acceptance() {
    let database = std::path::PathBuf::from(std::env::var("EOD_CHART_PARITY_DATABASE").unwrap());
    let evidence = std::path::PathBuf::from(std::env::var("EOD_CHART_PARITY_EVIDENCE").unwrap());
    assert!(!evidence.exists(), "Never overwrite prior audit evidence");
    let connection = Connection::open_with_flags(
        database.join("market-data.sqlite3"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .unwrap();
    connection
        .execute_batch("PRAGMA query_only=ON; BEGIN;")
        .unwrap();
    let context = resolve_instrument_context(&connection, "NIFTY", "NSE_INDEX")
        .unwrap()
        .unwrap();
    let rows =
        load_unified_price_rows(&database, &connection, &context, "1900-01-01", "2100-12-31")
            .unwrap();
    let mut captures = Vec::new();
    for adjusted in [false, true] {
        let selected = if adjusted {
            apply_corporate_adjustments(rows.clone(), &context.corporate_actions, false, false)
                .unwrap()
        } else {
            rows.clone()
        };
        let bars = guard_index_previous_close(selected)
            .into_iter()
            .map(|row| EodRow {
                date: row.date,
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                prev_close: row.prev_close,
                volume: row.volume,
                open_interest: row.open_interest,
            })
            .collect::<Vec<_>>();
        assert!(!bars.is_empty());
        captures.push(serde_json::json!({
            "adjusted": adjusted, "barCount": bars.len(),
            "barsB64": encode_eod_rows_binary_b64(&bars), "directBars": bars,
        }));
    }
    connection.execute_batch("ROLLBACK;").unwrap();
    std::fs::write(
        &evidence,
        serde_json::to_vec(&serde_json::json!({
            "database": database, "symbol": "NIFTY", "exchange": "NSE_INDEX", "captures": captures,
        }))
        .unwrap(),
    )
    .unwrap();
    println!(
        "READONLY_CHART_PARITY_CAPTURE_PASS records={} evidence={}",
        rows.len(),
        evidence.display()
    );
}

fn index_db() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    connection
        .execute_batch(
            "CREATE TABLE instruments (
            symbol TEXT, exchange TEXT, isin TEXT, name TEXT, series TEXT,
            is_active INTEGER DEFAULT 1, sector TEXT, industry TEXT,
            PRIMARY KEY(symbol, exchange));
         CREATE TABLE instrument_identity_history (
            id INTEGER PRIMARY KEY, exchange TEXT, isin TEXT, current_symbol TEXT,
            current_name TEXT, old_symbol TEXT, old_name TEXT, new_symbol TEXT,
            new_name TEXT, effective_date TEXT, change_type TEXT);
         CREATE TABLE corporate_actions (
            id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, isin TEXT,
            effective_date TEXT, action_type TEXT, factor REAL, adjust_volume INTEGER,
            ratio_num REAL, ratio_den REAL, old_face_value REAL, new_face_value REAL,
            cash_amount REAL, source TEXT);
         CREATE TABLE eod_prices (
            symbol TEXT, exchange TEXT, date TEXT, open REAL, high REAL, low REAL,
            close REAL, prev_close REAL, volume INTEGER, open_interest INTEGER,
            PRIMARY KEY(symbol,exchange,date));
         INSERT INTO instruments(symbol,exchange,name) VALUES
            ('NIFTY','NSE_INDEX','Nifty 50'), ('CNXNIFTY','NSE_INDEX','CNX Nifty'),
            ('SPCNXNIFTY','NSE_INDEX','S&P CNX Nifty'),
            ('BANKNIFTY','NSE_INDEX','Nifty Bank'), ('CNXBANK','NSE_INDEX','CNX Bank'),
            ('CNXNIFTY','NSE','Unrelated equity'), ('NIFTY','BSE_INDEX','Unrelated index');",
        )
        .unwrap();
    connection
}

fn record(date: u32, close: f64) -> EodRecord {
    let price = (close * 10000.0).round() as i64;
    EodRecord {
        date,
        flags: 0,
        open: price,
        high: price,
        low: price,
        close: price,
        prev_close: 0,
        volume: 100,
        oi: 0,
    }
}

fn write_bars(root: &Path, symbol: &str, rows: &[(u32, f64)]) {
    let folder = root.join("eod_data/NSE_INDEX");
    fs::create_dir_all(&folder).unwrap();
    let mut records = rows
        .iter()
        .map(|&(date, close)| record(date, close))
        .collect::<Vec<_>>();
    BinaryEodFile::write_all(
        folder.join(format!("{symbol}.eod")),
        symbol,
        "NSE_INDEX",
        10000,
        &mut records,
    )
    .unwrap();
}

fn load(
    root: &Path,
    connection: &Connection,
    symbol: &str,
    mode: PriceStorageMode,
) -> AppResult<Vec<PriceRow>> {
    let context = resolve_instrument_context(connection, symbol, "NSE_INDEX")?.unwrap();
    load_unified_price_rows_with_mode(root, connection, &context, "1900-01-01", "2100-01-01", mode)
}

#[test]
fn index_alias_history_joins_binary_names_both_directions_without_writes() {
    let connection = index_db();
    let dir = tempdir().unwrap();
    write_bars(dir.path(), "SPCNXNIFTY", &[(20130207, 5900.0)]);
    write_bars(
        dir.path(),
        "CNXNIFTY",
        &[(20130208, 5903.5), (20151106, 7954.3)],
    );
    write_bars(
        dir.path(),
        "NIFTY",
        &[(20050131, 2057.6), (20151109, 7915.2)],
    );
    let paths = ["SPCNXNIFTY", "CNXNIFTY", "NIFTY"]
        .map(|symbol| dir.path().join(format!("eod_data/NSE_INDEX/{symbol}.eod")));
    let before = paths
        .iter()
        .map(|path| fs::read(path).unwrap())
        .collect::<Vec<_>>();
    for mode in [PriceStorageMode::Binary, PriceStorageMode::Hybrid] {
        for symbol in ["NIFTY", "CNXNIFTY", "SPCNXNIFTY"] {
            let rows = load(dir.path(), &connection, symbol, mode).unwrap();
            assert_eq!(
                rows.iter().map(|row| row.date.as_str()).collect::<Vec<_>>(),
                [
                    "2005-01-31",
                    "2013-02-07",
                    "2013-02-08",
                    "2015-11-06",
                    "2015-11-09"
                ]
            );
            assert_eq!(rows[4].prev_close, Some(7954.3));
            assert!((rows[4].close - rows[4].prev_close.unwrap() + 39.1).abs() < 0.0001);
            assert_eq!(rows[1].prev_close, None);
        }
    }
    assert_eq!(
        before,
        paths
            .iter()
            .map(|path| fs::read(path).unwrap())
            .collect::<Vec<_>>()
    );
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM instrument_identity_history",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}

#[test]
fn index_alias_history_resolves_bank_and_preserves_exact_opt_out() {
    let connection = index_db();
    let dir = tempdir().unwrap();
    write_bars(dir.path(), "CNXBANK", &[(20151106, 17086.5)]);
    write_bars(dir.path(), "BANKNIFTY", &[(20151109, 17003.0)]);
    assert_eq!(
        load(
            dir.path(),
            &connection,
            "BANKNIFTY",
            PriceStorageMode::Binary
        )
        .unwrap()
        .len(),
        2
    );
    let context = resolve_exact_instrument_context(&connection, "BANKNIFTY", "NSE_INDEX")
        .unwrap()
        .unwrap();
    let rows = load_unified_price_rows_with_mode(
        dir.path(),
        &connection,
        &context,
        "1900-01-01",
        "2100-01-01",
        PriceStorageMode::Binary,
    )
    .unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].date, "2015-11-09");
}

#[test]
fn index_alias_history_joins_hybrid_sqlite_fallback() {
    let connection = index_db();
    connection.execute_batch(
        "INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume,open_interest) VALUES
           ('CNXNIFTY','NSE_INDEX','2015-11-06',7954.3,7954.3,7954.3,7954.3,100,0),
           ('NIFTY','NSE_INDEX','2015-11-09',7915.2,7915.2,7915.2,7915.2,100,0);"
    ).unwrap();
    let dir = tempdir().unwrap();
    let rows = load(dir.path(), &connection, "NIFTY", PriceStorageMode::Hybrid).unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[1].prev_close, Some(7954.3));
    assert!(
        load(dir.path(), &connection, "NIFTY", PriceStorageMode::Binary)
            .unwrap()
            .is_empty()
    );
}

#[test]
fn index_alias_history_deduplicates_equal_bars_and_blocks_conflicts() {
    let connection = index_db();
    let dir = tempdir().unwrap();
    write_bars(dir.path(), "CNXNIFTY", &[(20151106, 7954.3)]);
    write_bars(dir.path(), "NIFTY", &[(20151106, 7954.3)]);
    assert_eq!(
        load(dir.path(), &connection, "NIFTY", PriceStorageMode::Binary)
            .unwrap()
            .len(),
        1
    );
    write_bars(dir.path(), "NIFTY", &[(20151106, 9999.0)]);
    let error = load(dir.path(), &connection, "NIFTY", PriceStorageMode::Binary).unwrap_err();
    assert!(error.contains("Conflicting NSE index alias bars for NIFTY on 2015-11-06"));
    assert!(error.contains("CNXNIFTY, NIFTY"));
}

#[test]
fn index_alias_history_does_not_cross_exchange_or_infer_prefixes() {
    let connection = index_db();
    for (symbol, exchange) in [("CNXNIFTY", "NSE"), ("NIFTY", "BSE_INDEX")] {
        let context = resolve_instrument_context(&connection, symbol, exchange)
            .unwrap()
            .unwrap();
        assert_eq!(context.current_symbol, symbol);
        assert_eq!(context.related_symbols, vec![symbol]);
    }
    assert!(
        resolve_instrument_context(&connection, "NIFTY50TR", "NSE_INDEX")
            .unwrap()
            .is_none()
    );
}

#[test]
fn index_alias_history_resolves_when_only_legacy_metadata_exists() {
    let connection = index_db();
    connection
        .execute(
            "DELETE FROM instruments WHERE exchange='NSE_INDEX' AND symbol='NIFTY'",
            [],
        )
        .unwrap();
    let context = resolve_instrument_context(&connection, "NIFTY", "NSE_INDEX")
        .unwrap()
        .unwrap();
    assert_eq!(context.current_symbol, "NIFTY");
    assert!(context
        .related_symbols
        .iter()
        .any(|symbol| symbol == "CNXNIFTY"));
}

#[test]
fn index_alias_history_preserves_persisted_identity_events() {
    let connection = index_db();
    connection.execute_batch(
        "INSERT INTO instrument_identity_history(id,exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type)
         VALUES (1,'NSE_INDEX','NIFTY','CNXNIFTY','NIFTY','2015-11-09','SYMBOL_CHANGE');"
    ).unwrap();
    let context = resolve_instrument_context(&connection, "CNXNIFTY", "NSE_INDEX")
        .unwrap()
        .unwrap();
    assert_eq!(context.identity_history.len(), 1);
    assert_eq!(context.symbol_transitions.len(), 1);
    assert!(context.resolved_from_alias);
    assert!(context
        .related_symbols
        .iter()
        .any(|symbol| symbol == "SPCNXNIFTY"));
}

#[test]
fn index_alias_history_gap_guard_survives_adjusted_recomputation() {
    let mut rows = [(20050131, 2057.6), (20151106, 7954.3), (20151109, 7915.2)]
        .iter()
        .map(|&(date, close)| eod_record_to_price_row(&record(date, close), "NIFTY", 10000))
        .collect::<Vec<_>>();
    rows = guard_index_previous_close(recompute_prev_close(rows));
    assert_eq!(rows[1].prev_close, None);
    let rows =
        guard_index_previous_close(apply_corporate_adjustments(rows, &[], false, false).unwrap());
    assert_eq!(rows[1].prev_close, None);
    assert_eq!(rows[2].prev_close, Some(7954.3));
}

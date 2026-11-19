//! Cross-module NS-01/NS-02 tests: reader + executor + read-only database gateway.
//!
//! These tests only ever touch synthetic, disposable databases and `.eod` files created
//! by the test itself under the OS temp directory. No production database is opened and
//! no source `.eod` file is mutated.

use super::ast::{BinaryOpV1, EvaluationV1, ExprV1, OhlcvFieldV1, PriceBasisV1, RuleV1, UniverseSourceV1, UniverseV1};
use super::reader::NativeBar;
use super::scan::{
    execute_scan, ScanCounts, ScanDataSource, ScanExecutionOptions, ScanTarget,
};
use crate::database::binary_eod::{BinaryEodFile, EodRecord};
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "native_scan_ns01_{}_{}",
            tag,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).expect("create temp dir");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

fn record(date: u32, close: i64) -> EodRecord {
    EodRecord {
        date,
        flags: 1,
        open: close - 10,
        high: close + 20,
        low: close - 20,
        close,
        prev_close: close - 5,
        volume: 5_000,
        oi: 0,
    }
}

/// Creates the minimal accepted database schema plus a `Full` storage-mode setting.
fn seed_database(folder: &Path, storage_mode: &str) -> Connection {
    let connection = Connection::open(folder.join("market-data.sqlite3")).expect("open database");
    connection
        .execute_batch(
            "CREATE TABLE instruments (
               symbol TEXT NOT NULL,
               exchange TEXT NOT NULL DEFAULT 'NSE',
               bse_security_code TEXT,
               isin TEXT,
               name TEXT,
               series TEXT,
               is_active INTEGER NOT NULL DEFAULT 1,
               lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
               PRIMARY KEY (symbol, exchange)
             );
             CREATE TABLE eod_prices (
               symbol TEXT NOT NULL,
               exchange TEXT NOT NULL DEFAULT 'NSE',
               date TEXT NOT NULL,
               open REAL NOT NULL,
               high REAL NOT NULL,
               low REAL NOT NULL,
               close REAL NOT NULL,
               prev_close REAL,
               volume INTEGER NOT NULL DEFAULT 0,
               open_interest INTEGER NOT NULL DEFAULT 0,
               PRIMARY KEY (symbol, exchange, date)
             );
             CREATE TABLE settings (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL,
               updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE TABLE corporate_actions (
               id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, isin TEXT,
               effective_date TEXT, action_type TEXT, factor REAL DEFAULT 1,
               adjust_volume INTEGER DEFAULT 0, ratio_num REAL, ratio_den REAL,
               old_face_value REAL, new_face_value REAL, cash_amount REAL, source TEXT
             );
             CREATE TABLE instrument_identity_history (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               exchange TEXT NOT NULL DEFAULT 'NSE',
               isin TEXT,
               current_symbol TEXT,
               current_name TEXT,
               old_symbol TEXT,
               old_name TEXT,
               new_symbol TEXT,
               new_name TEXT,
               effective_date TEXT NOT NULL,
               change_type TEXT NOT NULL,
               source TEXT,
               source_ref TEXT,
               created_at TEXT NOT NULL DEFAULT (datetime('now')),
               updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
",
        )
        .expect("schema");
    connection
        .execute(
            "INSERT INTO settings (key, value) VALUES ('price_storage_mode', ?1)",
            [storage_mode],
        )
        .expect("storage mode");
    connection
}

fn universe() -> UniverseV1 {
    UniverseV1 {
        source: UniverseSourceV1::ExplicitTargets,
        targets: vec![("NSE".to_string(), "INFY".to_string())],
    }
}

fn request(basis: PriceBasisV1) -> super::ast::NativeScanRequestV1 {
    super::ast::NativeScanRequestV1 {
        schema_version: 1,
        requested_run_id: "ns01-integration".to_string(),
        universe: universe(),
        evaluation: EvaluationV1 {
            as_of_date: None,
            lookback_bars: None,
            evaluate_history: false,
            price_basis: basis,
            include_dividend_adjustments: false,
            include_rights_adjustments: false,
        },
        rules: vec![RuleV1 {
            id: "close_positive".to_string(),
            expression: ExprV1::Binary {
                op: BinaryOpV1::Gt,
                left: Box::new(ExprV1::Field {
                    field: OhlcvFieldV1::Close,
                    lookback: 0,
                }),
                right: Box::new(ExprV1::Number { value: 0.0 }),
            },
        }],
    }
}

struct StaticSource {
    bars: Vec<NativeBar>,
    identity: String,
}

impl ScanDataSource for StaticSource {
    fn database_identity(&self) -> &str {
        &self.identity
    }

    fn load_bars(
        &self,
        _target: &ScanTarget,
        _as_of_date: Option<&str>,
        window: usize,
        _price_basis: PriceBasisV1,
        _include_dividend_adjustments: bool,
        _include_rights_adjustments: bool,
    ) -> Result<Vec<NativeBar>, String> {
        let start = self.bars.len().saturating_sub(window);
        Ok(self.bars[start..].to_vec())
    }
}

#[test]
fn ns01_database_gateway_reads_binary_rows_with_accepted_semantics() {
    let temp = TempDir::new("gateway_raw");
    let connection = seed_database(temp.path(), "binary");
    connection
        .execute(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('INFY', 'NSE', 'EQ')",
            [],
        )
        .expect("instrument");

    // Raw `.eod` file is the canonical binary store; no SQLite price rows exist.
    let mut records: Vec<EodRecord> = (1..=5)
        .map(|day| record(20240100 + day, 1_500_000 + day as i64 * 10_000))
        .collect();
    BinaryEodFile::write_all(
        temp.path().join("NSE").join("INFY.eod"),
        "INFY",
        "NSE",
        10000,
        &mut records,
    )
    .expect("write fixture .eod");

    let bars = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "INFY",
        "NSE",
        None,
        3,
        false,
        false,
        false,
    )
    .expect("read scan bars");

    assert_eq!(bars.len(), 3);
    assert_eq!(bars[0].date, 20240103);
    assert_eq!(bars[2].date, 20240105);
    assert!((bars[2].close - 1_550_000.0 / 10000.0).abs() < 1e-9);
    assert!(bars[2].close > bars[0].close);
}

#[test]
fn ns01_database_gateway_honours_as_of_date_and_hybrid_sqlite_fallback() {
    let temp = TempDir::new("gateway_hybrid");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('HYBRID', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('HYBRID','NSE','2024-01-01', 100, 105, 99, 101, 100, 1000),
               ('HYBRID','NSE','2024-01-02', 101, 106, 100, 102, 101, 1100),
               ('HYBRID','NSE','2024-01-03', 102, 107, 101, 103, 102, 1200);",
        )
        .expect("hybrid rows");

    let bars = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "HYBRID",
        "NSE",
        Some("2024-01-02"),
        10,
        false,
        false,
        false,
    )
    .expect("hybrid read");

    assert_eq!(bars.len(), 2, "as-of must cut the window inclusively");
    assert_eq!(bars[1].date, 20240102);
    assert!((bars[1].close - 102.0).abs() < 1e-9);
}

#[test]
fn ns01_database_gateway_reports_unresolvable_identity_instead_of_an_empty_series() {
    let temp = TempDir::new("gateway_missing");
    let connection = seed_database(temp.path(), "binary");
    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "MISSING",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect_err("missing identity must be an explicit error");
    assert!(error.contains("no resolvable instrument identity"), "unexpected: {error}");
}

#[test]
fn ns01_database_gateway_adjusted_mode_reuses_the_approved_projection() {
    let temp = TempDir::new("gateway_adjusted");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('SPLIT', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('SPLIT','NSE','2024-01-01', 1000, 1000, 1000, 1000, 1000, 100),
               ('SPLIT','NSE','2024-01-02', 1000, 1000, 1000, 1000, 1000, 100),
               ('SPLIT','NSE','2024-01-03', 500, 500, 500, 500, 1000, 100);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'SPLIT', 'NSE', '2024-01-03', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("split fixture");

    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "SPLIT",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect("raw read");
    let adjusted = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "SPLIT",
        "NSE",
        None,
        10,
        true,
        false,
        false,
    )
    .expect("adjusted read");

    assert!((raw[0].close - 1000.0).abs() < 1e-9, "raw mode must stay raw");
    assert!((adjusted[0].close - 500.0).abs() < 1e-9, "pre-ex-date rows are divided by the factor");
    assert!((adjusted[2].close - 500.0).abs() < 1e-9);
    // Volume is multiplied when the approved action says so.
    assert!((adjusted[0].volume - 200.0).abs() < 1e-9);
    // Previous close is recomputed rather than left on the pre-adjustment basis.
    assert!((adjusted[1].prev_close.unwrap() - 500.0).abs() < 1e-9);
}

#[test]
fn ns01_executor_and_reader_agree_on_window_and_counts() {
    let temp = TempDir::new("executor_reader");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('AGREE', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('AGREE','NSE','2024-01-01', 10, 11, 9, 10, 10, 10),
               ('AGREE','NSE','2024-01-02', 11, 12, 10, 11, 10, 10),
               ('AGREE','NSE','2024-01-03', 12, 13, 11, 12, 11, 10);",
        )
        .expect("bars");

    let bars: Vec<NativeBar> = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "AGREE",
        "NSE",
        None,
        100,
        false,
        false,
        false,
    )
    .expect("read")
    .into_iter()
    .map(|bar| NativeBar {
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        prev_close: bar.prev_close,
        volume: bar.volume,
        open_interest: bar.open_interest,
    })
    .collect();

    let source = StaticSource {
        bars,
        identity: "synthetic-ns01".to_string(),
    };
    let report = execute_scan(
        &source,
        &request(PriceBasisV1::Raw),
        &[ScanTarget {
            exchange: "NSE".to_string(),
            symbol: "AGREE".to_string(),
        }],
        &AtomicBool::new(false),
        ScanExecutionOptions::default(),
        |_| {},
    );

    assert_eq!(
        report.counts,
        ScanCounts {
            targets: 1,
            matched: 1,
            no_match: 0,
            skipped: 0,
            failed: 0,
        }
    );
    assert_eq!(report.matches[0].date, "2024-01-03");
    assert_eq!(report.matches[0].rule_id, "close_positive");
    assert_eq!(report.outcomes[0].bars, 3);
    assert!(report.diagnostics.is_empty());
}

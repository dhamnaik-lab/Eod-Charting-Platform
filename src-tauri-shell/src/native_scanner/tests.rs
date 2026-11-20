//! Cross-module NS-01/NS-02 tests: reader + executor + read-only database gateway.
//!
//! These tests only ever touch synthetic, disposable databases and `.eod` files created
//! by the test itself under the OS temp directory. No production database is opened and
//! no source `.eod` file is mutated.

use super::ast::{
    BinaryOpV1, EvaluationV1, ExprV1, OhlcvFieldV1, PriceBasisV1, RuleV1, UniverseSourceV1,
    UniverseV1,
};
use super::reader::NativeBar;
use super::scan::{execute_scan, ScanCounts, ScanDataSource, ScanExecutionOptions, ScanTarget};
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
               sector TEXT,
               industry TEXT,
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
    // The canonical storage layout is `<root>/eod_data/<exchange>/<symbol>.eod`
    // (storage_paths::eod_path), not `<root>/<exchange>/...`. The old fixture wrote to the
    // latter, so the gateway never found the file and the test could only ever fail -- it
    // was previously masked by the missing `sector` column error.
    BinaryEodFile::write_all(
        temp.path().join("eod_data").join("NSE").join("INFY.eod"),
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
    assert!(
        error.contains("no resolvable instrument identity"),
        "unexpected: {error}"
    );
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

    assert!(
        (raw[0].close - 1000.0).abs() < 1e-9,
        "raw mode must stay raw"
    );
    assert!(
        (adjusted[0].close - 500.0).abs() < 1e-9,
        "pre-ex-date rows are divided by the factor"
    );
    assert!((adjusted[2].close - 500.0).abs() < 1e-9);
    // Volume is multiplied when the approved action says so.
    assert!((adjusted[0].volume - 200.0).abs() < 1e-9);
    // Previous close is recomputed rather than left on the pre-adjustment basis.
    assert!((adjusted[1].prev_close.unwrap() - 500.0).abs() < 1e-9);
}

/// CA-01 HOLD, fail-closed: the native gateway must surface the accepted projection's
/// ambiguity as an explicit error for that target, never an adjusted parity claim and
/// never a silently unadjusted series.
#[test]
fn ca01_adjusted_gateway_fails_closed_on_ambiguous_corporate_actions() {
    let temp = TempDir::new("gateway_ca01_ambiguous");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('AMBIG', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('AMBIG','NSE','2024-01-01', 1000, 1000, 1000, 1000, 1000, 100),
               ('AMBIG','NSE','2024-01-02', 1000, 1000, 1000, 1000, 1000, 100);
             -- An approved dividend with no cash amount per share cannot be projected.
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'AMBIG', 'NSE', '2024-01-03', 'DIVIDEND', 1.0, 0, 'TEST');",
        )
        .expect("ambiguous fixture");

    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "AMBIG",
        "NSE",
        None,
        10,
        true,
        true,
        false,
    )
    .expect_err("an unprojectable dividend must fail closed");
    assert!(
        error.contains("cash amount"),
        "the error must name the ambiguity: {error}"
    );

    // Raw reads stay available and untouched: HOLD only blocks the adjusted claim.
    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "AMBIG",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect("raw read must still work");
    assert_eq!(raw.len(), 2);
    assert!((raw[0].close - 1000.0).abs() < 1e-9);
}

/// CA-01 HOLD: a LEGACY_MUTATED action is never applied, so a database holding one cannot
/// silently produce a different adjusted series than an approved database.
#[test]
fn ca01_legacy_mutated_actions_are_never_applied() {
    let temp = TempDir::new("gateway_ca01_legacy");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('LEGACY', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('LEGACY','NSE','2024-01-01', 1000, 1000, 1000, 1000, 1000, 100),
               ('LEGACY','NSE','2024-01-02', 500, 500, 500, 500, 1000, 100);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'LEGACY', 'NSE', '2024-01-02', 'SPLIT', 2.0, 1, 'LEGACY_MUTATED');",
        )
        .expect("legacy fixture");

    let adjusted = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LEGACY",
        "NSE",
        None,
        10,
        true,
        false,
        false,
    )
    .expect("legacy read");
    assert!(
        (adjusted[0].close - 1000.0).abs() < 1e-9,
        "LEGACY_MUTATED rows must never be applied"
    );
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

// ---------------------------------------------------------------------------
// Item 2 — connection ownership: workers must read in parallel
// ---------------------------------------------------------------------------

use super::database_source::ReadOnlyDatabaseSource;
use std::sync::{Arc, Barrier};
use std::time::{Duration, Instant};

/// A worker must be able to read while another worker is inside its read.
///
/// This is the regression for `with_connection()` holding the registry Mutex for the
/// whole database read, which serialized every worker no matter how many were
/// configured. The probe counts concurrent read sections; the previous implementation
/// could never report more than 1 because the registry guard spanned the read.
#[test]
fn p1_08_workers_read_concurrently_without_a_global_connection_lock() {
    let temp = TempDir::new("gateway_concurrency");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('PARA', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES ('PARA','NSE','2024-01-01', 100, 105, 99, 101, 100, 1000);",
        )
        .expect("concurrency fixture");
    drop(connection);

    // 40ms per read section: overlaps are then observed deterministically instead of
    // depending on how fast a one-row fixture happens to be.
    super::database_source::test_probe::reset(40);
    let source =
        Arc::new(ReadOnlyDatabaseSource::open(temp.path().to_path_buf()).expect("open source"));
    let barrier = Arc::new(Barrier::new(4));

    let mut handles = Vec::new();
    for _ in 0..4 {
        let source = Arc::clone(&source);
        let barrier = Arc::clone(&barrier);
        handles.push(std::thread::spawn(move || {
            // All four connections exist before any read begins, so the reads are
            // genuinely simultaneous rather than incidentally staggered.
            barrier.wait();
            let target = ScanTarget {
                exchange: "NSE".to_string(),
                symbol: "PARA".to_string(),
            };
            source
                .load_bars(&target, None, 5, PriceBasisV1::Raw, false, false)
                .expect("concurrent read")
        }));
    }
    for handle in handles {
        let bars = handle.join().expect("worker thread");
        assert_eq!(bars.len(), 1);
        assert!((bars[0].close - 101.0).abs() < 1e-9);
    }

    let peak = super::database_source::test_probe::peak();
    super::database_source::test_probe::reset(0);
    assert!(
        peak > 1,
        "workers were serialized behind the connection registry; peak concurrent reads = {peak}"
    );
}

/// Each thread must get its own connection handle, never a shared one.
#[test]
fn p1_08_each_worker_owns_a_distinct_connection() {
    let temp = TempDir::new("gateway_distinct");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('OWN', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES ('OWN','NSE','2024-01-01', 10, 11, 9, 10, 10, 100);",
        )
        .expect("fixture");
    drop(connection);

    let source = Arc::new(ReadOnlyDatabaseSource::open(temp.path().to_path_buf()).expect("open"));
    let mut handles = Vec::new();
    for _ in 0..3 {
        let source = Arc::clone(&source);
        handles.push(std::thread::spawn(move || {
            source
                .connection_for_current_thread()
                .expect("thread connection")
        }));
    }
    let handles: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().expect("worker"))
        .collect();
    for left in 0..handles.len() {
        for right in (left + 1)..handles.len() {
            assert!(
                !Arc::ptr_eq(&handles[left], &handles[right]),
                "two workers shared one connection handle"
            );
        }
    }
}

/// The same thread must reuse one handle rather than opening a connection per target.
#[test]
fn p1_08_a_worker_reuses_its_connection_across_targets() {
    let temp = TempDir::new("gateway_reuse");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('REUSE', 'NSE', 'EQ');",
        )
        .expect("fixture");
    drop(connection);

    let source = ReadOnlyDatabaseSource::open(temp.path().to_path_buf()).expect("open");
    let first = source.connection_for_current_thread().expect("first");
    let second = source.connection_for_current_thread().expect("second");
    assert!(
        Arc::ptr_eq(&first, &second),
        "the worker reopened its connection instead of reusing it"
    );
}

// ---------------------------------------------------------------------------
// Item 3 — bounded reads must equal the full-history read
// ---------------------------------------------------------------------------

/// Builds a long daily history plus one mid-history split, so the adjusted path has to
/// look at rows far older than the requested window.
fn seed_long_history(temp: &Path, connection: &Connection, days: usize) {
    let mut batch = String::from(
        "INSERT INTO instruments (symbol, exchange, series) VALUES ('LONG', 'NSE', 'EQ');",
    );
    // 28-day months keep the walk valid and strictly ascending for any `days` up to 336
    // (12 months). Tests here ask for at most 280.
    assert!(days <= 336, "the 28-day-month walk only covers 12 months");
    for index in 0..days {
        let day = index + 1;
        let month = ((day - 1) / 28) + 1;
        let date_of_month = ((day - 1) % 28) + 1;
        batch.push_str(&format!(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES ('LONG','NSE','2023-{month:02}-{date_of_month:02}', 100, 105, 95, {close}, 100, 1000);",
            close = 100 + (index % 7)
        ));
    }
    connection.execute_batch(&batch).expect("long history");
}

#[test]
fn p3_bounded_read_matches_the_full_history_read_for_a_raw_window() {
    let temp = TempDir::new("gateway_bounded_raw");
    let connection = seed_database(temp.path(), "hybrid");
    seed_long_history(temp.path(), &connection, 280);

    // A large window forces the bounded path, and the result must equal a read whose
    // window covers everything.
    let bounded = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        60,
        false,
        false,
        false,
    )
    .expect("bounded read");
    let full = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        280,
        false,
        false,
        false,
    )
    .expect("full read");

    assert_eq!(bounded.len(), 60);
    assert_eq!(full.len(), 280);
    // The bounded tail must be exactly the tail of the full read.
    let expected = &full[full.len() - bounded.len()..];
    for (left, right) in bounded.iter().zip(expected.iter()) {
        assert_eq!(
            left.date, right.date,
            "bounded read changed the window dates"
        );
        assert!((left.close - right.close).abs() < 1e-9);
        assert_eq!(left.prev_close.is_some(), right.prev_close.is_some());
        if let (Some(a), Some(b)) = (left.prev_close, right.prev_close) {
            assert!((a - b).abs() < 1e-9, "prev_close drifted for {}", left.date);
        }
    }
}

#[test]
fn p3_bounded_read_preserves_adjusted_semantics() {
    let temp = TempDir::new("gateway_bounded_adjusted");
    let connection = seed_database(temp.path(), "hybrid");
    seed_long_history(temp.path(), &connection, 280);
    connection
        .execute_batch(
            "INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'LONG', 'NSE', '2023-10-01', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("split action");

    // The split is after every row, so the adjusted series is genuinely rescaled by 2.0.
    // This is what makes the comparison meaningful: a bounded read that lost the
    // adjustment dependency would return the unscaled prices and fail here.
    let bounded = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        40,
        true,
        false,
        false,
    )
    .expect("bounded adjusted read");
    let full = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        280,
        true,
        false,
        false,
    )
    .expect("full adjusted read");

    assert_eq!(bounded.len(), 40);
    let expected = &full[full.len() - 40..];
    for (left, right) in bounded.iter().zip(expected.iter()) {
        assert_eq!(left.date, right.date);
        assert!(
            (left.close - right.close).abs() < 1e-9,
            "adjustment drifted at {}: {} vs {}",
            left.date,
            left.close,
            right.close
        );
    }

    // Guard against a vacuous comparison: the rescale must actually be observable.
    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        40,
        false,
        false,
        false,
    )
    .expect("raw read");
    assert!(
        bounded
            .iter()
            .zip(raw.iter())
            .all(|(adjusted_bar, raw_bar)| (adjusted_bar.close - raw_bar.close / 2.0).abs() < 1e-9),
        "the fixture did not exercise a real adjustment"
    );
}

/// A split effective *after* every window row must rescale that window, even when the
/// split is far outside the bounded slice.
///
/// `apply_corporate_adjustments` divides rows whose date precedes the effective date by
/// the action's recorded factor. The factor comes from the corporate-action row, not from
/// the price slice, so bounding must not lose it.
#[test]
fn p3_bounded_read_applies_a_split_newer_than_the_window() {
    let temp = TempDir::new("gateway_bounded_future_split");
    let connection = seed_database(temp.path(), "hybrid");
    seed_long_history(temp.path(), &connection, 120);
    // The generated history ends at 2023-05-08, so this split is after every row and all
    // of them must be divided by 2.0.
    connection
        .execute_batch(
            "INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'LONG', 'NSE', '2023-10-01', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("split action");

    let adjusted = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        10,
        true,
        false,
        false,
    )
    .expect("adjusted read");
    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect("raw read");

    assert_eq!(adjusted.len(), 10);
    for (adjusted_bar, raw_bar) in adjusted.iter().zip(raw.iter()) {
        assert_eq!(adjusted_bar.date, raw_bar.date);
        assert!(
            (adjusted_bar.close - raw_bar.close / 2.0).abs() < 1e-9,
            "split newer than the window was not applied at {}: adjusted={} raw={}",
            adjusted_bar.date,
            adjusted_bar.close,
            raw_bar.close
        );
    }
}

/// A split effective *before* every window row must leave those rows untouched: their
/// traded prices are already post-split. Bounding must not invent a rescale.
#[test]
fn p3_bounded_read_ignores_a_split_older_than_the_window() {
    let temp = TempDir::new("gateway_bounded_past_split");
    let connection = seed_database(temp.path(), "hybrid");
    seed_long_history(temp.path(), &connection, 120);
    // 2023-01-15 (index 14); every in-window row is later than this.
    connection
        .execute_batch(
            "INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'LONG', 'NSE', '2023-01-15', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("split action");

    let adjusted = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        10,
        true,
        false,
        false,
    )
    .expect("adjusted read");
    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "LONG",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect("raw read");

    for (adjusted_bar, raw_bar) in adjusted.iter().zip(raw.iter()) {
        assert_eq!(adjusted_bar.date, raw_bar.date);
        assert!(
            (adjusted_bar.close - raw_bar.close).abs() < 1e-9,
            "a split older than every window row must not rescale them at {}",
            adjusted_bar.date
        );
    }
}

/// The binary `.eod` path must be bounded by `read_range_bounded` and still agree with a
/// full read of the same file.
#[test]
fn p3_bounded_binary_read_matches_a_full_read() {
    let temp = TempDir::new("gateway_bounded_binary");
    let connection = seed_database(temp.path(), "binary");
    connection
        .execute(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('BOUND', 'NSE', 'EQ')",
            [],
        )
        .expect("instrument");

    let mut records: Vec<EodRecord> = (1..=240)
        .map(|day| record(20240100 + day, 1_500_000 + day as i64 * 1_000))
        .collect();
    BinaryEodFile::write_all(
        temp.path().join("eod_data").join("NSE").join("BOUND.eod"),
        "BOUND",
        "NSE",
        10000,
        &mut records,
    )
    .expect("write fixture");

    let bounded = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "BOUND",
        "NSE",
        None,
        30,
        false,
        false,
        false,
    )
    .expect("bounded read");
    let full = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "BOUND",
        "NSE",
        None,
        240,
        false,
        false,
        false,
    )
    .expect("full read");

    assert_eq!(bounded.len(), 30);
    assert_eq!(full.len(), 240);
    let expected = &full[full.len() - 30..];
    for (left, right) in bounded.iter().zip(expected.iter()) {
        assert_eq!(left.date, right.date, "bounded binary window differs");
        assert!((left.close - right.close).abs() < 1e-9);
        if let (Some(a), Some(b)) = (left.prev_close, right.prev_close) {
            assert!((a - b).abs() < 1e-9, "prev_close drifted at {}", left.date);
        }
    }
}

/// `read_range_bounded` must never return more than `limit` records and must return the
/// newest ones, for every limit including larger-than-the-file.
#[test]
fn p3_read_range_bounded_returns_the_newest_n_records() {
    let temp = TempDir::new("binary_bounded_primitive");
    let mut records: Vec<EodRecord> = (1..=50)
        .map(|day| record(20240100 + day, 1_000_000 + day as i64))
        .collect();
    let path = temp.path().join("BOUNDED.eod");
    BinaryEodFile::write_all(&path, "BOUNDED", "NSE", 100, &mut records).expect("write");
    let file = BinaryEodFile::open(&path).expect("open");

    for limit in [1usize, 5, 49, 50, 51, 10_000] {
        let bounded = file
            .read_range_bounded(0, 99_999_999, limit)
            .expect("bounded");
        assert!(
            bounded.len() <= limit.min(50),
            "limit {limit} returned {} records",
            bounded.len()
        );
        // Always a strict suffix of the file.
        let expected_start = 50 - bounded.len();
        for (offset, bar) in bounded.iter().enumerate() {
            assert_eq!(
                bar.date,
                20240101 + (expected_start + offset) as u32,
                "limit {limit} did not return a suffix"
            );
        }
    }

    // A date range still filters.
    let ranged = file
        .read_range_bounded(20240110, 20240120, 100)
        .expect("ranged");
    assert_eq!(ranged.first().map(|r| r.date), Some(20240110));
    assert_eq!(ranged.last().map(|r| r.date), Some(20240120));
}

/// An empty/absent history must stay a bounded, non-panicking read.
#[test]
fn p3_bounded_read_handles_an_empty_history() {
    let temp = TempDir::new("gateway_bounded_empty");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('EMPTY', 'NSE', 'EQ');",
        )
        .expect("fixture");
    let bars = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "EMPTY",
        "NSE",
        None,
        25,
        true,
        true,
        true,
    )
    .expect("empty history must not error");
    assert!(bars.is_empty());
}

// ---------------------------------------------------------------------------
// Item 4 — canonical identity / revision safeguards fail closed
// ---------------------------------------------------------------------------

/// An unresolvable identity must fail closed even when corporate actions exist for the
/// requested symbol: no adjustments may resurrect an unidentifiable target.
#[test]
fn p4_adjusted_read_fails_closed_without_a_resolvable_identity() {
    let temp = TempDir::new("gateway_ca_identity");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'GHOST', 'NSE', '2024-01-02', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("fixture");
    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "GHOST",
        "NSE",
        None,
        10,
        true,
        false,
        false,
    )
    .expect_err("adjusted read without identity must fail closed");
    assert!(
        error.contains("no resolvable instrument identity"),
        "unexpected: {error}"
    );
}

/// A dividend whose recorded factor is not a valid recorded value must fail closed
/// rather than being silently skipped.
#[test]
fn p4_adjusted_read_fails_closed_on_invalid_dividend_factor() {
    let temp = TempDir::new("gateway_ca_factor");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('BADF', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('BADF','NSE','2024-01-01', 100, 101, 99, 100, 100, 10),
               ('BADF','NSE','2024-01-02', 100, 101, 99, 100, 100, 10);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, cash_amount, source)
             VALUES (1, 'BADF', 'NSE', '2024-01-03', 'DIVIDEND', 1.0, 0, 5.0, 'TEST');",
        )
        .expect("fixture");
    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "BADF",
        "NSE",
        None,
        10,
        true,
        true,
        false,
    )
    .expect_err("an invalid dividend factor must fail closed");
    assert!(
        error.contains("factor"),
        "the error must name the invalid factor: {error}"
    );
}

/// Liveness guard: the concurrency test must not be timing out on a healthy build.
#[test]
fn p1_08_a_single_read_completes_promptly() {
    let temp = TempDir::new("gateway_prompt");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('FAST', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES ('FAST','NSE','2024-01-01', 10, 11, 9, 10, 10, 100);",
        )
        .expect("fixture");
    drop(connection);
    let source = ReadOnlyDatabaseSource::open(temp.path().to_path_buf()).expect("open");
    let target = ScanTarget {
        exchange: "NSE".to_string(),
        symbol: "FAST".to_string(),
    };
    let started = Instant::now();
    let bars = source
        .load_bars(&target, None, 5, PriceBasisV1::Raw, false, false)
        .expect("read");
    assert_eq!(bars.len(), 1);
    assert!(
        started.elapsed() < Duration::from_secs(30),
        "a single-row read took {:?}",
        started.elapsed()
    );
}
// ---------------------------------------------------------------------------
// Item 4 — canonical identity / revision safeguards fail closed
// ---------------------------------------------------------------------------

/// An unresolvable identity must fail closed even when corporate actions exist for the
/// requested symbol: no rule, and no adjustment, may resurrect an unidentifiable target.
#[test]
fn p4_adjusted_read_fails_closed_without_a_resolvable_identity() {
    let temp = TempDir::new("gateway_ca_identity");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'GHOST', 'NSE', '2024-01-02', 'SPLIT', 2.0, 1, 'TEST');",
        )
        .expect("fixture");
    for adjusted in [true, false] {
        let error = crate::database::read_scan_bars_for_folder(
            temp.path(),
            &connection,
            "GHOST",
            "NSE",
            None,
            10,
            adjusted,
            false,
            false,
        )
        .expect_err("an unresolvable identity must fail closed in every mode");
        assert!(
            error.contains("no resolvable instrument identity"),
            "adjusted={adjusted} unexpected error: {error}"
        );
    }
}

/// A dividend whose recorded factor cannot support a projection must fail closed rather
/// than being silently skipped or applied with a guessed factor.
#[test]
fn p4_adjusted_read_fails_closed_on_invalid_dividend_factor() {
    let temp = TempDir::new("gateway_ca_factor");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('BADF', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('BADF','NSE','2024-01-01', 100, 101, 99, 100, 100, 10),
               ('BADF','NSE','2024-01-02', 100, 101, 99, 100, 100, 10);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, cash_amount, source)
             VALUES (1, 'BADF', 'NSE', '2024-01-03', 'DIVIDEND', 1.0, 0, 5.0, 'TEST');",
        )
        .expect("fixture");
    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "BADF",
        "NSE",
        None,
        10,
        true,
        true,
        false,
    )
    .expect_err("an invalid dividend factor must fail closed");
    assert!(
        error.contains("factor"),
        "the error must name the invalid factor: {error}"
    );
}

/// A dividend with no cash amount must fail closed rather than dropping the action.
#[test]
fn p4_adjusted_read_fails_closed_on_a_dividend_without_cash() {
    let temp = TempDir::new("gateway_ca_cash");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('NOCASH', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('NOCASH','NSE','2024-01-01', 100, 101, 99, 100, 100, 10),
               ('NOCASH','NSE','2024-01-02', 100, 101, 99, 100, 100, 10);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'NOCASH', 'NSE', '2024-01-03', 'DIVIDEND', 1.05, 0, 'TEST');",
        )
        .expect("fixture");
    let error = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "NOCASH",
        "NSE",
        None,
        10,
        true,
        true,
        false,
    )
    .expect_err("a dividend without a cash amount must fail closed");
    assert!(
        error.contains("cash amount"),
        "the error must name the missing cash amount: {error}"
    );
}

/// The same ambiguity must not be reachable as a *bounded* read either: item 3 must not
/// have introduced a path that skips the fail-closed check.
#[test]
fn p4_bounded_adjusted_read_still_fails_closed_on_ambiguity() {
    let temp = TempDir::new("gateway_ca_bounded");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('AMBB', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('AMBB','NSE','2024-01-01', 100, 101, 99, 100, 100, 10),
               ('AMBB','NSE','2024-01-02', 100, 101, 99, 100, 100, 10);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'AMBB', 'NSE', '2024-01-03', 'DIVIDEND', 1.0, 0, 'TEST');",
        )
        .expect("fixture");
    for window in [1usize, 2, 10, 500] {
        let error = crate::database::read_scan_bars_for_folder(
            temp.path(),
            &connection,
            "AMBB",
            "NSE",
            None,
            window,
            true,
            true,
            false,
        )
        .expect_err("bounded adjusted reads must fail closed too");
        assert!(
            error.contains("cash amount"),
            "window={window} lost the fail-closed channel: {error}"
        );
    }
}

/// Raw reads must stay available when the adjusted claim is blocked (CA-01 HOLD only
/// blocks the adjusted projection).
#[test]
fn p4_raw_read_stays_available_when_adjusted_is_blocked() {
    let temp = TempDir::new("gateway_ca_hold_raw");
    let connection = seed_database(temp.path(), "hybrid");
    connection
        .execute_batch(
            "INSERT INTO instruments (symbol, exchange, series) VALUES ('HOLD', 'NSE', 'EQ');
             INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume)
             VALUES
               ('HOLD','NSE','2024-01-01', 100, 101, 99, 100, 100, 10),
               ('HOLD','NSE','2024-01-02', 100, 101, 99, 100, 100, 10);
             INSERT INTO corporate_actions
               (id, symbol, exchange, effective_date, action_type, factor, adjust_volume, source)
             VALUES (1, 'HOLD', 'NSE', '2024-01-03', 'DIVIDEND', 1.0, 0, 'TEST');",
        )
        .expect("fixture");
    let raw = crate::database::read_scan_bars_for_folder(
        temp.path(),
        &connection,
        "HOLD",
        "NSE",
        None,
        10,
        false,
        false,
        false,
    )
    .expect("raw read must survive a blocked adjusted claim");
    assert_eq!(raw.len(), 2);
}

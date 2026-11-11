use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Duration;

use super::binary_eod::{get_all_binary_stats, u32_to_date};
use super::connection_registry::load_database_file_info;
use super::corporate_action_imports::{
    build_import_evidence_raw_reference, ensure_import_evidence,
};
use super::instrument_mutations::upsert_instrument_isin_history_evidence;
use super::official_source_version_history::ensure_official_source_version_bootstrap;
use super::settings::{read_setting_value, write_setting_value};
use super::{
    now_iso, AppResult, DbStats, CORPORATE_ACTION_IMPORT_EVIDENCE_BACKFILL_SETTING_KEY,
    INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY, LEGACY_DATA_MIGRATIONS_SETTING_KEY,
    PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY,
};

pub(crate) fn prepare_database_connection(connection: &Connection) -> AppResult<()> {
    apply_pragmas(connection)?;
    run_migrations(connection)?;
    ensure_official_source_version_bootstrap(connection)?;
    seed_defaults(connection)?;
    Ok(())
}

fn apply_pragmas(connection: &Connection) -> AppResult<()> {
    connection
        .busy_timeout(Duration::from_secs(15))
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "cache_size", -64_000)
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "temp_store", "MEMORY")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "mmap_size", 268_435_456_i64)
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn run_migrations(connection: &Connection) -> AppResult<()> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS instruments (
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              bse_security_code TEXT,
              isin TEXT,
              name TEXT,
              series TEXT,
              series_as_of_date TEXT,
              sector TEXT,
              industry TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (symbol, exchange)
            );

            CREATE TABLE IF NOT EXISTS eod_prices (
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
              trades INTEGER,
              delivery_qty INTEGER,
              delivery_pct REAL,
              PRIMARY KEY (symbol, exchange, date)
            );

            CREATE TABLE IF NOT EXISTS download_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              trade_date TEXT NOT NULL,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              rows_inserted INTEGER NOT NULL DEFAULT 0,
              downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
              status TEXT NOT NULL DEFAULT 'ok',
              UNIQUE (trade_date, exchange)
            );

            CREATE TABLE IF NOT EXISTS watchlists (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS watchlist_items (
              watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              added_at TEXT NOT NULL DEFAULT (datetime('now')),
              sort_order INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (watchlist_id, symbol, exchange)
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS corporate_actions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              effective_date TEXT NOT NULL,
              action_type TEXT NOT NULL,
              factor REAL NOT NULL,
              adjust_volume INTEGER NOT NULL DEFAULT 1,
              note TEXT,
              applied_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE (symbol, exchange, effective_date, action_type, factor)
            );

            CREATE TABLE IF NOT EXISTS corporate_action_imports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              dedupe_key TEXT NOT NULL UNIQUE,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              source TEXT NOT NULL,
              source_file TEXT,
              symbol TEXT,
              isin TEXT,
              bse_scrip_code TEXT,
              company_name TEXT,
              purpose_raw TEXT NOT NULL,
              ex_date TEXT,
              record_date TEXT,
              action_type TEXT NOT NULL DEFAULT 'OTHER',
              ratio_num REAL,
              ratio_den REAL,
              old_face_value REAL,
              new_face_value REAL,
              cash_amount REAL,
              factor REAL,
              price_factor REAL,
              parse_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
              review_status TEXT NOT NULL DEFAULT 'PENDING',
              message TEXT,
              approved_corporate_action_id INTEGER REFERENCES corporate_actions(id),
              imported_at TEXT NOT NULL DEFAULT (datetime('now')),
              approved_at TEXT
            );

            CREATE TABLE IF NOT EXISTS corporate_action_import_evidence (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              import_id INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
              source_code TEXT NOT NULL,
              source_locator TEXT,
              captured_at TEXT NOT NULL DEFAULT (datetime('now')),
              symbol_seen TEXT,
              isin_seen TEXT,
              company_name_seen TEXT,
              action_type_seen TEXT,
              event_date_seen TEXT,
              factor_seen REAL,
              raw_reference TEXT,
              note TEXT
            );

            CREATE TABLE IF NOT EXISTS corporate_action_split_bonus_chain_proofs (
              import_id INTEGER PRIMARY KEY REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
              proof_json TEXT NOT NULL,
              fingerprint TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS corporate_action_import_decisions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              import_id INTEGER NOT NULL REFERENCES corporate_action_imports(id) ON DELETE CASCADE,
              decision_type TEXT NOT NULL,
              previous_symbol TEXT,
              previous_exchange TEXT,
              previous_isin TEXT,
              resolved_symbol TEXT,
              resolved_exchange TEXT,
              resolved_isin TEXT,
              reason TEXT NOT NULL,
              decided_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS corporate_action_fetch_coverage (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              source TEXT NOT NULL,
              from_date TEXT NOT NULL,
              to_date TEXT NOT NULL,
              fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE (exchange, source, from_date, to_date)
            );

            CREATE TABLE IF NOT EXISTS historical_capital_action_backfill_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              from_date TEXT NOT NULL,
              to_date TEXT NOT NULL,
              requested_symbols TEXT NOT NULL,
              stop_on_error INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'RUNNING',
              total_symbols INTEGER NOT NULL DEFAULT 0,
              completed_symbols INTEGER NOT NULL DEFAULT 0,
              failed_symbols INTEGER NOT NULL DEFAULT 0,
              rows_read INTEGER NOT NULL DEFAULT 0,
              rows_inserted INTEGER NOT NULL DEFAULT 0,
              rows_duplicate INTEGER NOT NULL DEFAULT 0,
              rows_evidence_attached INTEGER NOT NULL DEFAULT 0,
              rows_error INTEGER NOT NULL DEFAULT 0,
              rows_unresolved INTEGER NOT NULL DEFAULT 0,
              rows_parsed INTEGER NOT NULL DEFAULT 0,
              rows_unsupported INTEGER NOT NULL DEFAULT 0,
              parse_status_counts TEXT NOT NULL DEFAULT '{}',
              review_status_counts TEXT NOT NULL DEFAULT '{}',
              started_at TEXT NOT NULL DEFAULT (datetime('now')),
              completed_at TEXT,
              message TEXT
            );

            CREATE TABLE IF NOT EXISTS historical_capital_action_backfill_run_symbols (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              run_id INTEGER NOT NULL REFERENCES historical_capital_action_backfill_runs(id) ON DELETE CASCADE,
              symbol TEXT NOT NULL,
              canonical_symbol TEXT,
              bse_scrip_code TEXT,
              status TEXT NOT NULL DEFAULT 'RUNNING',
              rows_read INTEGER NOT NULL DEFAULT 0,
              rows_inserted INTEGER NOT NULL DEFAULT 0,
              rows_duplicate INTEGER NOT NULL DEFAULT 0,
              rows_evidence_attached INTEGER NOT NULL DEFAULT 0,
              rows_error INTEGER NOT NULL DEFAULT 0,
              rows_unresolved INTEGER NOT NULL DEFAULT 0,
              rows_parsed INTEGER NOT NULL DEFAULT 0,
              rows_unsupported INTEGER NOT NULL DEFAULT 0,
              parse_status_counts TEXT NOT NULL DEFAULT '{}',
              review_status_counts TEXT NOT NULL DEFAULT '{}',
              warning_count INTEGER NOT NULL DEFAULT 0,
              error_message TEXT,
              started_at TEXT NOT NULL DEFAULT (datetime('now')),
              completed_at TEXT,
              message TEXT,
              UNIQUE (run_id, symbol)
            );

            CREATE TABLE IF NOT EXISTS historical_capital_action_backfill_run_outcomes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              run_symbol_id INTEGER NOT NULL REFERENCES historical_capital_action_backfill_run_symbols(id) ON DELETE CASCADE,
              source TEXT NOT NULL,
              requested_symbol TEXT,
              source_locator TEXT,
              outcome TEXT NOT NULL,
              import_id INTEGER REFERENCES corporate_action_imports(id) ON DELETE SET NULL,
              evidence_id INTEGER REFERENCES corporate_action_import_evidence(id) ON DELETE SET NULL,
              action_type TEXT,
              parse_status TEXT,
              review_status TEXT,
              message TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scan_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              scope TEXT NOT NULL,
              action_types TEXT NOT NULL,
              started_at TEXT NOT NULL DEFAULT (datetime('now')),
              completed_at TEXT,
              status TEXT NOT NULL DEFAULT 'RUNNING',
              message TEXT,
              total_results INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS corporate_action_scan_results (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              scan_run_id INTEGER NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              corporate_action_import_id INTEGER REFERENCES corporate_action_imports(id),
              corporate_action_id INTEGER REFERENCES corporate_actions(id),
              symbol TEXT,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              scan_status TEXT NOT NULL,
              prev_trade_date TEXT,
              ex_trade_date TEXT,
              prev_close REAL,
              ex_open REAL,
              ex_close REAL,
              expected_factor REAL,
              actual_open_factor REAL,
              actual_close_factor REAL,
              confidence REAL,
              message TEXT,
              scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS corporate_action_history_metadata (
              singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
              database_instance_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
              schema_version INTEGER NOT NULL DEFAULT 1,
              created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            INSERT OR IGNORE INTO corporate_action_history_metadata (singleton_id)
            VALUES (1);

            CREATE TABLE IF NOT EXISTS corporate_action_dividend_validation_checkpoints (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              import_id INTEGER NOT NULL,
              dependency_hash TEXT NOT NULL,
              result_json TEXT NOT NULL,
              result_hash TEXT NOT NULL,
              checked_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS corporate_action_dividend_validation_current (
              import_id INTEGER PRIMARY KEY,
              checkpoint_id INTEGER NOT NULL REFERENCES corporate_action_dividend_validation_checkpoints(id)
            );

            CREATE TABLE IF NOT EXISTS corporate_action_activity_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              database_instance_id TEXT NOT NULL,
              operation_kind TEXT NOT NULL,
              requested_scope_json TEXT NOT NULL DEFAULT '{}',
              started_at_utc TEXT NOT NULL,
              completed_at_utc TEXT,
              outcome TEXT NOT NULL,
              requested_count INTEGER NOT NULL DEFAULT 0,
              checked_count INTEGER NOT NULL DEFAULT 0,
              eligible_count INTEGER NOT NULL DEFAULT 0,
              ineligible_count INTEGER NOT NULL DEFAULT 0,
              already_approved_count INTEGER NOT NULL DEFAULT 0,
              stale_count INTEGER NOT NULL DEFAULT 0,
              missing_count INTEGER NOT NULL DEFAULT 0,
              failed_count INTEGER NOT NULL DEFAULT 0,
              reused_count INTEGER NOT NULL DEFAULT 0,
              error_message TEXT,
              app_version TEXT NOT NULL,
              policy_version TEXT,
              scope_version TEXT,
              scope_fingerprint TEXT,
              created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS corporate_action_validation_report_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              run_id INTEGER NOT NULL REFERENCES corporate_action_activity_runs(id) ON DELETE CASCADE,
              import_id INTEGER NOT NULL,
              result_code TEXT NOT NULL,
              reason_snapshot TEXT NOT NULL,
              current_action_type TEXT,
              current_parse_status TEXT,
              current_review_status TEXT,
              stored_approval_state TEXT,
              evidence_json TEXT,
              dependency_json TEXT,
              checked_at_utc TEXT NOT NULL,
              policy_version TEXT NOT NULL,
              UNIQUE (run_id, import_id)
            );

            CREATE TABLE IF NOT EXISTS instrument_identity_history (
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

            CREATE TABLE IF NOT EXISTS instrument_isin_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              symbol TEXT NOT NULL,
              isin TEXT NOT NULL,
              effective_date TEXT,
              source TEXT,
              source_ref TEXT,
              note TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_eod_symbol_exchange_date
              ON eod_prices(symbol, exchange, date DESC);

            CREATE INDEX IF NOT EXISTS idx_instruments_name
              ON instruments(name);

            CREATE INDEX IF NOT EXISTS idx_instruments_isin
              ON instruments(isin);

            CREATE INDEX IF NOT EXISTS idx_instruments_exchange_isin
              ON instruments(exchange, isin);

            CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist
              ON watchlist_items(watchlist_id, sort_order, symbol);

            CREATE TABLE IF NOT EXISTS market_holidays (
              id         INTEGER PRIMARY KEY AUTOINCREMENT,
              date       TEXT NOT NULL UNIQUE,
              name       TEXT NOT NULL,
              source     TEXT NOT NULL DEFAULT 'BUILTIN',
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_market_holidays_date
              ON market_holidays(date);

            -- HOL03 official calendars are additive; legacy/user rows stay intact.
            CREATE TABLE IF NOT EXISTS official_exchange_holiday_snapshots (
              exchange TEXT NOT NULL CHECK(exchange IN ('NSE','BSE')),
              year INTEGER NOT NULL CHECK(year BETWEEN 1990 AND 2100),
              source_urls TEXT NOT NULL,
              source_sha256 TEXT NOT NULL,
              accepted_at TEXT NOT NULL,
              record_count INTEGER NOT NULL,
              PRIMARY KEY (exchange, year)
            );
            CREATE TABLE IF NOT EXISTS official_exchange_holidays (
              exchange TEXT NOT NULL CHECK(exchange IN ('NSE','BSE')),
              year INTEGER NOT NULL,
              date TEXT NOT NULL,
              name TEXT NOT NULL,
              PRIMARY KEY (exchange, year, date),
              FOREIGN KEY(exchange,year)
                REFERENCES official_exchange_holiday_snapshots(exchange,year)
            );
            CREATE INDEX IF NOT EXISTS idx_official_exchange_holiday_date
              ON official_exchange_holidays(exchange,date);

            -- HOL-06 source registry: the per-exchange/per-year official holiday
            -- source. Editable from the UI so a changed exchange URL needs no code
            -- change; `required_fragments` keeps BSE parsing fail-closed by
            -- pinning the notice identity that must appear in the response.
            CREATE TABLE IF NOT EXISTS holiday_source_registry (
              exchange TEXT NOT NULL CHECK(exchange IN ('NSE','BSE')),
              year INTEGER NOT NULL CHECK(year BETWEEN 1990 AND 2100),
              document_index INTEGER NOT NULL DEFAULT 0 CHECK(document_index BETWEEN 0 AND 9),
              url TEXT NOT NULL,
              parser TEXT NOT NULL CHECK(parser IN ('NSE_JSON','BSE_NOTICE_HTML','BSE_AMENDMENT_2026')),
              required_fragments TEXT NOT NULL DEFAULT '[]',
              expected_rows INTEGER,
              operator_note TEXT,
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (exchange, year, document_index)
            );
            INSERT OR IGNORE INTO holiday_source_registry
              (exchange,year,document_index,url,parser,required_fragments,expected_rows,operator_note)
            VALUES
              ('NSE',2026,0,'https://www.nseindia.com/api/holiday-master?type=trading','NSE_JSON','[]',20,
               'NSE holiday-master; always returns the current year, so this row can be copied to a new year once NSE publishes it.'),
              ('BSE',2026,0,'https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20251212-8','BSE_NOTICE_HTML',
               '[\"Notice No. 20251212-8\",\"Trading Holidays for the Calendar Year 2026\",\"Equity and Equity Derivatives Segments\",\"Following Holidays are Falling on Saturday / Sunday\",\"Muhurat Trading\"]',19,
               'BSE annual trading-holiday notice for the equity and equity derivatives segments.'),
              ('BSE',2026,1,'https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20260112-8','BSE_AMENDMENT_2026',
               '[\"Notice No. 20260112-8\",\"Trading Holiday on account of Municipal Corporation Elections in Maharashtra 2026\",\"January 15, 2026\",\"Equity Segment\"]',1,
               'BSE amendment adding the 15 January 2026 Municipal Corporation election holiday.');

            ",
        )
        .map_err(|error| error.to_string())?;

    ensure_column(connection, "corporate_actions", "isin", "TEXT")?;
    ensure_column(connection, "corporate_actions", "record_date", "TEXT")?;
    ensure_column(connection, "corporate_actions", "ratio_num", "REAL")?;
    ensure_column(connection, "corporate_actions", "ratio_den", "REAL")?;
    ensure_column(connection, "corporate_actions", "old_face_value", "REAL")?;
    ensure_column(connection, "corporate_actions", "new_face_value", "REAL")?;
    ensure_column(connection, "corporate_actions", "cash_amount", "REAL")?;
    ensure_column(
        connection,
        "corporate_actions",
        "cost_allocation_pct",
        "REAL",
    )?;
    ensure_column(connection, "corporate_actions", "spunoff_symbol", "TEXT")?;
    ensure_column(
        connection,
        "corporate_action_imports",
        "cost_allocation_pct",
        "REAL",
    )?;
    ensure_column(
        connection,
        "corporate_action_imports",
        "spunoff_symbol",
        "TEXT",
    )?;
    ensure_column(connection, "corporate_actions", "source", "TEXT")?;
    ensure_column(connection, "corporate_actions", "source_ref", "TEXT")?;
    ensure_column(
        connection,
        "corporate_actions",
        "created_at",
        "TEXT DEFAULT (datetime('now'))",
    )?;
    ensure_column(
        connection,
        "corporate_actions",
        "updated_at",
        "TEXT DEFAULT (datetime('now'))",
    )?;
    ensure_column(connection, "download_log", "note", "TEXT")?;
    ensure_column(connection, "instruments", "isin", "TEXT")?;
    ensure_column(connection, "instruments", "series", "TEXT")?;
    ensure_column(connection, "instruments", "series_as_of_date", "TEXT")?;
    ensure_column(connection, "instruments", "bse_security_code", "TEXT")?;
    ensure_column(
        connection,
        "instruments",
        "lifecycle_status",
        "TEXT NOT NULL DEFAULT 'CURRENT'",
    )?;
    normalize_instrument_lifecycle_status(connection)?;
    ensure_column(
        connection,
        "download_log",
        "max_volume",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        connection,
        "eod_prices",
        "open_interest",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(connection, "watchlists", "source_type", "TEXT")?;
    ensure_column(connection, "watchlists", "source_exchange", "TEXT")?;
    ensure_column(connection, "watchlists", "source_group_type", "TEXT")?;
    ensure_column(connection, "watchlists", "source_key", "TEXT")?;
    ensure_column(connection, "watchlists", "source_display_name", "TEXT")?;
    ensure_column(connection, "watchlists", "last_synced_at", "TEXT")?;
    ensure_column(
        connection,
        "historical_capital_action_backfill_runs",
        "parse_status_counts",
        "TEXT NOT NULL DEFAULT '{}'",
    )?;
    ensure_column(
        connection,
        "historical_capital_action_backfill_runs",
        "review_status_counts",
        "TEXT NOT NULL DEFAULT '{}'",
    )?;
    ensure_column(
        connection,
        "historical_capital_action_backfill_run_symbols",
        "parse_status_counts",
        "TEXT NOT NULL DEFAULT '{}'",
    )?;
    ensure_column(
        connection,
        "historical_capital_action_backfill_run_symbols",
        "review_status_counts",
        "TEXT NOT NULL DEFAULT '{}'",
    )?;

    connection
        .execute_batch(
            "
            CREATE INDEX IF NOT EXISTS idx_watchlists_source
              ON watchlists(source_type, source_exchange, source_group_type, source_key);

            CREATE INDEX IF NOT EXISTS idx_corporate_actions_symbol
              ON corporate_actions(exchange, symbol, effective_date);

            CREATE UNIQUE INDEX IF NOT EXISTS idx_instruments_bse_security_code
              ON instruments(bse_security_code)
              WHERE exchange = 'BSE'
                AND bse_security_code IS NOT NULL
                AND TRIM(bse_security_code) <> '';

            CREATE INDEX IF NOT EXISTS idx_corporate_actions_isin
              ON corporate_actions(isin, effective_date);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_imports_status
              ON corporate_action_imports(review_status, parse_status, action_type, ex_date);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_imports_symbol
              ON corporate_action_imports(exchange, symbol, ex_date);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_imports_isin
              ON corporate_action_imports(isin, ex_date);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_import_evidence_import
              ON corporate_action_import_evidence(import_id, captured_at DESC);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_import_decisions_import
              ON corporate_action_import_decisions(import_id, decided_at DESC, id DESC);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_import_evidence_source
              ON corporate_action_import_evidence(source_code, event_date_seen);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_fetch_coverage_range
              ON corporate_action_fetch_coverage(exchange, source, from_date, to_date);

            CREATE INDEX IF NOT EXISTS idx_historical_backfill_runs_started_at
              ON historical_capital_action_backfill_runs(started_at DESC);

            CREATE INDEX IF NOT EXISTS idx_historical_backfill_run_symbols_run
              ON historical_capital_action_backfill_run_symbols(run_id, status);

            CREATE INDEX IF NOT EXISTS idx_historical_backfill_run_symbols_symbol
              ON historical_capital_action_backfill_run_symbols(symbol, status);

            CREATE INDEX IF NOT EXISTS idx_historical_backfill_run_outcomes_symbol
              ON historical_capital_action_backfill_run_outcomes(run_symbol_id, outcome, id);

            CREATE INDEX IF NOT EXISTS idx_historical_backfill_run_outcomes_import
              ON historical_capital_action_backfill_run_outcomes(import_id, evidence_id);

            CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at
              ON scan_runs(started_at DESC);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_scan_results_run
              ON corporate_action_scan_results(scan_run_id, scan_status);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_activity_runs_started
              ON corporate_action_activity_runs(started_at_utc DESC, id DESC);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_validation_items_run
              ON corporate_action_validation_report_items(run_id, id);

            CREATE INDEX IF NOT EXISTS idx_corporate_action_validation_items_import
              ON corporate_action_validation_report_items(import_id, run_id DESC);

            CREATE INDEX IF NOT EXISTS idx_identity_history_old_symbol
              ON instrument_identity_history(exchange, old_symbol);

            CREATE INDEX IF NOT EXISTS idx_identity_history_new_symbol
              ON instrument_identity_history(exchange, new_symbol);

            CREATE INDEX IF NOT EXISTS idx_identity_history_isin
              ON instrument_identity_history(isin);

            CREATE INDEX IF NOT EXISTS idx_identity_history_effective_date
              ON instrument_identity_history(effective_date);

            CREATE INDEX IF NOT EXISTS idx_instrument_isin_history_symbol
              ON instrument_isin_history(exchange, symbol, effective_date);

            CREATE INDEX IF NOT EXISTS idx_instrument_isin_history_isin
              ON instrument_isin_history(isin);
            ",
        )
        .map_err(|error| error.to_string())?;

    run_legacy_data_migrations_once(connection)?;
    run_corporate_action_import_evidence_backfill_once(connection)?;
    run_instrument_isin_history_backfill_once(connection)?;
    run_pending_isin_mismatch_recheck_once(connection)?;

    Ok(())
}

fn run_legacy_data_migrations_once(connection: &Connection) -> AppResult<()> {
    if read_setting_value(connection, LEGACY_DATA_MIGRATIONS_SETTING_KEY)?.is_some() {
        return Ok(());
    }

    connection
        .execute_batch(
            "
            UPDATE corporate_actions
            SET
              action_type = UPPER(action_type),
              created_at = COALESCE(created_at, applied_at, datetime('now')),
              updated_at = COALESCE(updated_at, applied_at, datetime('now')),
              source = CASE
                WHEN source IS NULL OR TRIM(source) = '' THEN 'LEGACY_MUTATED'
                ELSE source
              END
            WHERE
              action_type != UPPER(action_type)
              OR created_at IS NULL
              OR updated_at IS NULL
              OR source IS NULL
              OR TRIM(source) = '';

            UPDATE instrument_identity_history
            SET
              change_type = UPPER(change_type),
              created_at = COALESCE(created_at, datetime('now')),
              updated_at = COALESCE(updated_at, created_at, datetime('now'))
            WHERE
              change_type != UPPER(change_type)
              OR created_at IS NULL
              OR updated_at IS NULL;
            ",
        )
        .map_err(|error| error.to_string())?;

    let missing_instruments_exist = connection
        .query_row(
            "
              SELECT EXISTS (
                SELECT 1
                FROM eod_prices ep
                LEFT JOIN instruments i
                  ON i.symbol = ep.symbol
                 AND i.exchange = ep.exchange
                WHERE i.symbol IS NULL
                LIMIT 1
              )
            ",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?
        != 0;

    if missing_instruments_exist {
        connection
            .execute_batch(
                "
                INSERT OR IGNORE INTO instruments (symbol, exchange, name, updated_at)
                SELECT
                  symbol,
                  exchange,
                  symbol,
                  datetime('now')
                FROM eod_prices
                GROUP BY symbol, exchange;
                ",
            )
            .map_err(|error| error.to_string())?;
    }

    write_setting_value(connection, LEGACY_DATA_MIGRATIONS_SETTING_KEY, &now_iso())?;
    Ok(())
}

fn run_corporate_action_import_evidence_backfill_once(connection: &Connection) -> AppResult<()> {
    if read_setting_value(
        connection,
        CORPORATE_ACTION_IMPORT_EVIDENCE_BACKFILL_SETTING_KEY,
    )?
    .is_some()
    {
        return Ok(());
    }

    let import_rows = {
        let mut statement = connection
            .prepare(
                "
                  SELECT
                    id,
                    source,
                    source_file,
                    symbol,
                    isin,
                    bse_scrip_code,
                    company_name,
                    purpose_raw,
                    ex_date,
                    record_date,
                    action_type,
                    factor,
                    imported_at
                  FROM corporate_action_imports
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, Option<f64>>(11)?,
                    row.get::<_, String>(12)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for (
        import_id,
        source,
        source_file,
        symbol,
        isin,
        bse_scrip_code,
        company_name,
        purpose_raw,
        ex_date,
        record_date,
        action_type,
        factor,
        imported_at,
    ) in import_rows
    {
        let raw_reference = build_import_evidence_raw_reference(
            symbol.as_deref(),
            isin.as_deref(),
            bse_scrip_code.as_deref(),
            company_name.as_deref(),
            purpose_raw.as_str(),
            ex_date.as_deref(),
            record_date.as_deref(),
        );
        ensure_import_evidence(
            connection,
            import_id,
            source.as_str(),
            source_file.as_deref(),
            Some(imported_at.as_str()),
            symbol.as_deref(),
            isin.as_deref(),
            company_name.as_deref(),
            Some(action_type.as_str()),
            ex_date.as_deref(),
            factor,
            raw_reference.as_deref(),
            Some(
                "Backfilled from an existing corporate_action_imports row. Older builds did not retain full raw source payloads separately.",
            ),
        )?;
    }

    write_setting_value(
        connection,
        CORPORATE_ACTION_IMPORT_EVIDENCE_BACKFILL_SETTING_KEY,
        &now_iso(),
    )?;
    Ok(())
}

fn run_instrument_isin_history_backfill_once(connection: &Connection) -> AppResult<()> {
    if read_setting_value(connection, INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY)?.is_some() {
        return Ok(());
    }

    let approved_import_rows = {
        let mut statement = connection
            .prepare(
                "
                  SELECT exchange, symbol, isin, ex_date, source, source_file
                  FROM corporate_action_imports
                  WHERE review_status = 'APPROVED'
                    AND symbol IS NOT NULL
                    AND TRIM(symbol) != ''
                    AND isin IS NOT NULL
                    AND TRIM(isin) != ''
                    AND ex_date IS NOT NULL
                    AND TRIM(ex_date) != ''
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for (exchange, symbol, isin, effective_date, source, source_ref) in approved_import_rows {
        upsert_instrument_isin_history_evidence(
            connection,
            &exchange,
            &symbol,
            &isin,
            Some(effective_date.as_str()),
            source.as_deref(),
            source_ref.as_deref(),
            Some("Backfilled from existing approved official import evidence."),
        )?;
    }

    let approved_action_rows = {
        let mut statement = connection
            .prepare(
                "
                  SELECT exchange, symbol, isin, effective_date, source, source_ref
                  FROM corporate_actions
                  WHERE symbol IS NOT NULL
                    AND TRIM(symbol) != ''
                    AND isin IS NOT NULL
                    AND TRIM(isin) != ''
                    AND effective_date IS NOT NULL
                    AND TRIM(effective_date) != ''
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for (exchange, symbol, isin, effective_date, source, source_ref) in approved_action_rows {
        upsert_instrument_isin_history_evidence(
            connection,
            &exchange,
            &symbol,
            &isin,
            Some(effective_date.as_str()),
            source.as_deref(),
            source_ref.as_deref(),
            Some("Backfilled from existing approved canonical corporate action."),
        )?;
    }

    write_setting_value(
        connection,
        INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY,
        &now_iso(),
    )?;
    Ok(())
}

fn run_pending_isin_mismatch_recheck_once(connection: &Connection) -> AppResult<()> {
    if read_setting_value(connection, PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY)?.is_some() {
        return Ok(());
    }

    connection
        .execute(
            "
              UPDATE corporate_action_imports
              SET review_status = 'PENDING',
                  message = 'Exact symbol matched, and the same official ISIN was already confirmed for this event date in the database.'
              WHERE review_status = 'PENDING_ISIN_MISMATCH'
                AND symbol IS NOT NULL
                AND TRIM(symbol) != ''
                AND isin IS NOT NULL
                AND TRIM(isin) != ''
                AND ex_date IS NOT NULL
                AND TRIM(ex_date) != ''
                AND EXISTS (
                  SELECT 1
                  FROM instrument_isin_history history
                  WHERE history.exchange = corporate_action_imports.exchange
                    AND history.symbol = corporate_action_imports.symbol
                    AND history.isin = corporate_action_imports.isin
                    AND COALESCE(history.effective_date, '') = COALESCE(corporate_action_imports.ex_date, '')
                )
            ",
            [],
        )
        .map_err(|error| error.to_string())?;

    write_setting_value(
        connection,
        PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY,
        &now_iso(),
    )?;
    Ok(())
}

fn normalize_instrument_lifecycle_status(connection: &Connection) -> AppResult<()> {
    connection
        .execute(
            "
              UPDATE instruments
              SET lifecycle_status = 'CURRENT'
              WHERE COALESCE(is_active, 1) = 1
                AND COALESCE(lifecycle_status, '') <> 'CURRENT'
            ",
            [],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "
              UPDATE instruments
              SET lifecycle_status = 'OLD_SYMBOL'
              WHERE COALESCE(is_active, 1) = 0
                AND COALESCE(lifecycle_status, 'CURRENT') IN ('', 'CURRENT', 'UNKNOWN_INACTIVE')
                AND EXISTS (
                  SELECT 1
                  FROM instrument_identity_history history
                  WHERE history.exchange = instruments.exchange
                    AND UPPER(COALESCE(history.old_symbol, '')) = UPPER(instruments.symbol)
                    AND UPPER(COALESCE(history.old_symbol, '')) <> UPPER(COALESCE(history.new_symbol, history.current_symbol, ''))
                )
            ",
            [],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "
              UPDATE instruments
              SET lifecycle_status = 'UNKNOWN_INACTIVE'
              WHERE COALESCE(is_active, 1) = 0
                AND COALESCE(lifecycle_status, 'CURRENT') IN ('', 'CURRENT')
            ",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn ensure_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    definition: &str,
) -> AppResult<()> {
    let pragma_sql = format!("PRAGMA table_info({table_name})");
    let mut statement = connection
        .prepare(&pragma_sql)
        .map_err(|error| error.to_string())?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<HashSet<_>, _>>()
        .map_err(|error| error.to_string())?;

    if columns.contains(column_name) {
        return Ok(());
    }

    connection
        .execute(
            &format!("ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"),
            [],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn seed_defaults(connection: &Connection) -> AppResult<()> {
    let watchlist_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM watchlists", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if watchlist_count == 0 {
        connection
            .execute(
                "INSERT INTO watchlists (name) VALUES (?)",
                params!["My Watchlist"],
            )
            .map_err(|error| error.to_string())?;
    }

    let defaults = [
        ("theme", "dark"),
        ("default_exchange", "NSE"),
        ("candle_up_color", "#26a69a"),
        ("candle_down_color", "#ef5350"),
        ("grid_color", "#1e2a3a"),
        ("crosshair_color", "#5588aa"),
        ("default_price_mode", "adjusted"),
        ("price_storage_mode", "hybrid"),
    ];

    let mut statement = connection
        .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .map_err(|error| error.to_string())?;
    for (key, value) in defaults {
        statement
            .execute(params![key, value])
            .map_err(|error| error.to_string())?;
    }


    // HOL-04: No yearly BUILTIN holiday seeding. Existing database rows stay intact.
    Ok(())
}

pub(crate) fn load_db_stats(folder_path: &Path, connection: &Connection) -> AppResult<DbStats> {
    // 1. Get per-symbol stats from SQLite
    // Using GROUP BY is efficient because of idx_eod_symbol_exchange_date
    let mut sqlite_symbol_stats = HashMap::<(String, String), (i64, String, String)>::new();
    let mut stmt = connection
        .prepare(
            "
              SELECT symbol, exchange, COUNT(*), MIN(date), MAX(date)
              FROM eod_prices
              GROUP BY symbol, exchange
            ",
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    for row_result in rows {
        let (symbol, exchange, count, date_from, date_to) =
            row_result.map_err(|error| error.to_string())?;
        sqlite_symbol_stats.insert((symbol, exchange), (count, date_from, date_to));
    }

    // 2. Get binary stats
    let binary_symbol_stats = get_all_binary_stats(folder_path);

    // 3. Aggregate
    let mut total_bars: i64 = 0;
    let mut min_date_str: Option<String> = None;
    let mut max_date_str: Option<String> = None;
    let mut total_binary_size: u64 = 0;
    let mut binary_processed = HashSet::new();

    let update_min_max = |current_min: &mut Option<String>,
                          current_max: &mut Option<String>,
                          new_min: String,
                          new_max: String| {
        if current_min.as_ref().map_or(true, |v| &new_min < v) {
            *current_min = Some(new_min);
        }
        if current_max.as_ref().map_or(true, |v| &new_max > v) {
            *current_max = Some(new_max);
        }
    };

    for bin in binary_symbol_stats {
        total_bars += bin.count as i64;
        total_binary_size += bin.file_size;

        if bin.count > 0 {
            update_min_max(
                &mut min_date_str,
                &mut max_date_str,
                u32_to_date(bin.first_date),
                u32_to_date(bin.last_date),
            );
        }

        binary_processed.insert((bin.symbol, bin.exchange));
    }

    // Add remaining SQLite stats for symbols NOT in binary
    for ((symbol, exchange), (count, date_from, date_to)) in sqlite_symbol_stats {
        if !binary_processed.contains(&(symbol, exchange)) {
            total_bars += count;
            update_min_max(&mut min_date_str, &mut max_date_str, date_from, date_to);
        }
    }

    // Symbol count still comes from instruments table (active symbols)
    let symbol_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM instruments WHERE COALESCE(is_active, 1) = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let (database_name, database_file_path) = load_database_file_info(folder_path)?;
    let sqlite_file_size = fs::metadata(&database_file_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let total_file_size = sqlite_file_size + total_binary_size;

    Ok(DbStats {
        db_name: database_name.unwrap_or_else(|| {
            folder_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Database")
                .to_string()
        }),
        db_size_mb: ((total_file_size as f64) / (1024_f64 * 1024_f64) * 100.0).round() / 100.0,
        symbol_count,
        bar_count: total_bars,
        date_from: min_date_str,
        date_to: max_date_str,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::storage_mode::get_price_storage_mode;
    use crate::database::PriceStorageMode;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        // Minimal schema needed for seed_defaults
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE watchlists (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
            [],
        )
        .unwrap();
        conn.execute(
            "
              CREATE TABLE market_holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'BUILTIN',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            ",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn hol04_new_database_has_no_hardcoded_holiday_rows() {
        let conn = setup_test_db();
        seed_defaults(&conn).unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM market_holidays", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 0);
        // Re-running defaults must not turn a calendar-less database into a
        // pre-filled calendar, even after explicit removal of all holidays.
        seed_defaults(&conn).unwrap();
        let again: i64 = conn.query_row(
            "SELECT COUNT(*) FROM market_holidays", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(again, 0);
    }

    #[test]
    fn hol04_existing_builtin_and_user_holidays_are_preserved() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO market_holidays (date, name, source) VALUES ('2026-03-03', 'Historical built-in fixture', 'BUILTIN')", []
        ).unwrap();
        conn.execute(
            "INSERT INTO market_holidays (date, name, source) VALUES ('2026-05-02', 'Manual fixture', 'USER')", []
        ).unwrap();
        seed_defaults(&conn).unwrap();
        seed_defaults(&conn).unwrap();
        let rows: Vec<(String,String,String)> = conn.prepare(
            "SELECT date, name, source FROM market_holidays ORDER BY date"
        ).unwrap().query_map([], |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?)))
         .unwrap().map(|row| row.unwrap()).collect();
        assert_eq!(rows, vec![
            ("2026-03-03".into(), "Historical built-in fixture".into(), "BUILTIN".into()),
            ("2026-05-02".into(), "Manual fixture".into(), "USER".into()),
        ]);
    }

    #[test]
    fn test_seed_defaults_sets_hybrid_if_missing() {
        let conn = setup_test_db();

        seed_defaults(&conn).unwrap();

        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Hybrid);
    }

    #[test]
    fn test_seed_defaults_does_not_overwrite_existing() {
        let conn = setup_test_db();

        // Manually set to binary first
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('price_storage_mode', 'binary')",
            [],
        )
        .unwrap();

        seed_defaults(&conn).unwrap();

        // Should still be binary
        assert_eq!(get_price_storage_mode(&conn), PriceStorageMode::Binary);
    }

    #[test]
    fn phase6a_bootstrap_creates_backfill_provenance_schema() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        for table in [
            "historical_capital_action_backfill_runs",
            "historical_capital_action_backfill_run_symbols",
        ] {
            let mut statement = conn
                .prepare(&format!("PRAGMA table_info({table})"))
                .unwrap();
            let columns = statement
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            assert!(columns.contains(&"parse_status_counts".to_string()));
            assert!(columns.contains(&"review_status_counts".to_string()));
        }

        let outcome_table_exists: i64 = conn
            .query_row(
                "
                  SELECT COUNT(*)
                  FROM sqlite_master
                  WHERE type = 'table'
                    AND name = 'historical_capital_action_backfill_run_outcomes'
                ",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(outcome_table_exists, 1);
    }

    #[test]
    fn corporate_action_import_evidence_backfill_seeds_existing_import_rows() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                source_file,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                record_date,
                action_type,
                factor,
                parse_status,
                review_status,
                imported_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "trent-evidence-backfill",
                "NSE",
                "NSE_API",
                "https://www.nseindia.com/api/corporates-corporateActions",
                "TRENT",
                "INE849A01020",
                "TRENT LIMITED",
                "Bonus 1:2",
                "2026-06-04",
                "2026-06-01",
                "BONUS",
                1.5_f64,
                "PARSED",
                "PENDING",
                "2026-06-12 01:00:00"
            ],
        )
        .unwrap();

        conn.execute("DELETE FROM corporate_action_import_evidence", [])
            .unwrap();
        conn.execute(
            "DELETE FROM settings WHERE key = ?",
            params![CORPORATE_ACTION_IMPORT_EVIDENCE_BACKFILL_SETTING_KEY],
        )
        .unwrap();

        run_corporate_action_import_evidence_backfill_once(&conn).unwrap();

        let evidence_row = conn
            .query_row(
                "
                  SELECT source_code, source_locator, symbol_seen, isin_seen, action_type_seen, event_date_seen, factor_seen, note
                  FROM corporate_action_import_evidence
                  WHERE import_id = 1
                ",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<String>>(5)?,
                        row.get::<_, Option<f64>>(6)?,
                        row.get::<_, Option<String>>(7)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(evidence_row.0, "NSE_API");
        assert_eq!(
            evidence_row.1.as_deref(),
            Some("https://www.nseindia.com/api/corporates-corporateActions")
        );
        assert_eq!(evidence_row.2.as_deref(), Some("TRENT"));
        assert_eq!(evidence_row.3.as_deref(), Some("INE849A01020"));
        assert_eq!(evidence_row.4.as_deref(), Some("BONUS"));
        assert_eq!(evidence_row.5.as_deref(), Some("2026-06-04"));
        assert_eq!(evidence_row.6, Some(1.5_f64));
        assert!(evidence_row
            .7
            .as_deref()
            .unwrap_or_default()
            .contains("Backfilled from an existing corporate_action_imports row"));

        run_corporate_action_import_evidence_backfill_once(&conn).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_import_evidence",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn instrument_isin_history_backfill_seeds_approved_import_and_canonical_action_evidence() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        conn.execute(
            "
              INSERT INTO corporate_actions (
                symbol, exchange, isin, effective_date, action_type, factor, source, source_ref
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "TRENT",
                "NSE",
                "INE849A01020",
                "2026-06-04",
                "BONUS",
                1.5_f64,
                "NSE_API",
                "canonical-row"
            ],
        )
        .unwrap();
        let approved_action_id = conn.last_insert_rowid();

        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                source_file,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                action_type,
                parse_status,
                review_status,
                approved_corporate_action_id,
                approved_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ",
            params![
                "trent-approved-import",
                "NSE",
                "NSE_API",
                "https://example.test/nse-import",
                "TRENT",
                "INE849A09999",
                "TRENT LIMITED",
                "Bonus 1:2",
                "2026-06-04",
                "BONUS",
                "PARSED",
                "APPROVED",
                approved_action_id
            ],
        )
        .unwrap();

        conn.execute("DELETE FROM instrument_isin_history", [])
            .unwrap();
        conn.execute(
            "DELETE FROM settings WHERE key = ?",
            params![INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY],
        )
        .unwrap();

        run_instrument_isin_history_backfill_once(&conn).unwrap();

        let isins = {
            let mut statement = conn
                .prepare(
                    "
                      SELECT isin
                      FROM instrument_isin_history
                      WHERE exchange = 'NSE'
                        AND symbol = 'TRENT'
                        AND effective_date = '2026-06-04'
                      ORDER BY isin
                    ",
                )
                .unwrap();
            statement
                .query_map([], |row| row.get::<_, String>(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };
        assert_eq!(
            isins,
            vec!["INE849A01020".to_string(), "INE849A09999".to_string()]
        );

        let marker = read_setting_value(&conn, INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY)
            .unwrap()
            .unwrap();
        assert!(!marker.trim().is_empty());

        run_instrument_isin_history_backfill_once(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM instrument_isin_history", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn instrument_isin_history_backfill_skips_unapproved_or_isinless_rows() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                action_type,
                parse_status,
                review_status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "pending-no-backfill",
                "NSE",
                "NSE_API",
                "TEST1",
                "INE000TEST1",
                "TEST ONE",
                "Bonus 1:1",
                "2026-06-05",
                "BONUS",
                "PARSED",
                "PENDING"
            ],
        )
        .unwrap();
        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                symbol,
                company_name,
                purpose_raw,
                ex_date,
                action_type,
                parse_status,
                review_status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "approved-no-isin",
                "NSE",
                "NSE_API",
                "TEST2",
                "TEST TWO",
                "Split Rs 10/- To Rs 5/-",
                "2026-06-06",
                "SPLIT",
                "PARSED",
                "APPROVED"
            ],
        )
        .unwrap();
        conn.execute(
            "
              INSERT INTO corporate_actions (
                symbol, exchange, effective_date, action_type, factor, source
              )
              VALUES (?, ?, ?, ?, ?, ?)
            ",
            params!["TEST3", "NSE", "2026-06-07", "BONUS", 2.0_f64, "MANUAL"],
        )
        .unwrap();

        conn.execute("DELETE FROM instrument_isin_history", [])
            .unwrap();
        conn.execute(
            "DELETE FROM settings WHERE key = ?",
            params![INSTRUMENT_ISIN_HISTORY_BACKFILL_SETTING_KEY],
        )
        .unwrap();

        run_instrument_isin_history_backfill_once(&conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM instrument_isin_history", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn pending_isin_mismatch_recheck_promotes_rows_with_matching_evidence() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        conn.execute(
            "
              INSERT INTO instrument_isin_history (
                exchange, symbol, isin, effective_date, source, note
              )
              VALUES (?, ?, ?, ?, ?, ?)
            ",
            params![
                "NSE",
                "TRENT",
                "INE849A09999",
                "2026-06-04",
                "NSE_API",
                "seed evidence"
            ],
        )
        .unwrap();
        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                action_type,
                parse_status,
                review_status,
                message
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "trent-pending-mismatch",
                "NSE",
                "NSE_API",
                "TRENT",
                "INE849A09999",
                "TRENT LIMITED",
                "Bonus 1:2",
                "2026-06-04",
                "BONUS",
                "PARSED",
                "PENDING_ISIN_MISMATCH",
                "old mismatch message"
            ],
        )
        .unwrap();

        conn.execute(
            "DELETE FROM settings WHERE key = ?",
            params![PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY],
        )
        .unwrap();

        run_pending_isin_mismatch_recheck_once(&conn).unwrap();

        let (review_status, message): (String, Option<String>) = conn
            .query_row(
                "
                  SELECT review_status, message
                  FROM corporate_action_imports
                  WHERE dedupe_key = 'trent-pending-mismatch'
                ",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(review_status, "PENDING");
        assert_eq!(
            message.as_deref(),
            Some(
                "Exact symbol matched, and the same official ISIN was already confirmed for this event date in the database."
            )
        );

        let marker = read_setting_value(&conn, PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY)
            .unwrap()
            .unwrap();
        assert!(!marker.trim().is_empty());
    }

    #[test]
    fn pending_isin_mismatch_recheck_skips_rows_without_matching_evidence() {
        let conn = Connection::open_in_memory().unwrap();
        prepare_database_connection(&conn).unwrap();

        conn.execute(
            "
              INSERT INTO corporate_action_imports (
                dedupe_key,
                exchange,
                source,
                symbol,
                isin,
                company_name,
                purpose_raw,
                ex_date,
                action_type,
                parse_status,
                review_status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ",
            params![
                "trent-still-mismatch",
                "NSE",
                "NSE_API",
                "TRENT",
                "INE849A09999",
                "TRENT LIMITED",
                "Bonus 1:2",
                "2026-06-04",
                "BONUS",
                "PARSED",
                "PENDING_ISIN_MISMATCH"
            ],
        )
        .unwrap();

        conn.execute(
            "DELETE FROM settings WHERE key = ?",
            params![PENDING_ISIN_MISMATCH_RECHECK_SETTING_KEY],
        )
        .unwrap();

        run_pending_isin_mismatch_recheck_once(&conn).unwrap();

        let review_status: String = conn
            .query_row(
                "
                  SELECT review_status
                  FROM corporate_action_imports
                  WHERE dedupe_key = 'trent-still-mismatch'
                ",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(review_status, "PENDING_ISIN_MISMATCH");
    }
}

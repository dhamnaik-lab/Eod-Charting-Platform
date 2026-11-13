use std::collections::HashSet;

use chrono::{Duration, Local, NaiveDate, Timelike, Weekday};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::AppHandle;

use super::storage_mode_get_latest_imported_trade_date;
use crate::bhavcopy::transport::normalize_exchange_key;
use crate::bhavcopy::types::{
    AppResult, DownloadMode, DownloadResult, DownloadTask, ExchangeSelection, MarketHoliday,
};

pub const NSE_FULL_HISTORY_START: &str = "1994-11-03";
pub const NSE_INDEX_FULL_HISTORY_START: &str = "1990-07-03";
pub const BSE_FULL_HISTORY_START: &str = "1990-01-01";
pub const BSE_INDEX_FULL_HISTORY_START: &str = "1990-01-01";

pub const NSE_SPECIAL_TRADING_DAYS: &[(&str, &str)] = &[
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

pub const BSE_SPECIAL_TRADING_DAYS: &[(&str, &str)] = &[
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

pub const UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR: u32 = 18;

#[tauri::command]
pub fn list_market_holidays(app: AppHandle) -> AppResult<Vec<MarketHoliday>> {
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    let mut stmt = connection
        .prepare("SELECT id, date, name, source FROM market_holidays ORDER BY date ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MarketHoliday {
                id: row.get(0)?,
                date: row.get(1)?,
                name: row.get(2)?,
                source: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn add_market_holiday(app: AppHandle, date: String, name: String) -> AppResult<MarketHoliday> {
    if date.len() != 10 || date.as_bytes()[4] != b'-' || date.as_bytes()[7] != b'-' {
        return Err("Holiday date must be in YYYY-MM-DD format.".to_string());
    }
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Holiday name must not be empty.".to_string());
    }
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    connection
        .execute(
            "INSERT INTO market_holidays (date, name, source) VALUES (?, ?, 'USER')",
            params![date, name],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                format!("A holiday already exists for {date}.")
            } else {
                e.to_string()
            }
        })?;
    let id = connection.last_insert_rowid();
    Ok(MarketHoliday {
        id,
        date,
        name,
        source: "USER".to_string(),
    })
}

#[tauri::command]
pub fn delete_market_holiday(app: AppHandle, id: i64) -> AppResult<()> {
    let folder_path = crate::database::resolve_active_database_folder(&app)?
        .ok_or_else(|| "Open a database before managing market holidays.".to_string())?;
    let connection = crate::database::open_connection_for_folder(&folder_path, false)?;
    let deleted = connection
        .execute("DELETE FROM market_holidays WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err(format!("Holiday #{id} not found."));
    }
    Ok(())
}

pub fn skipped_download_result(
    exchange: &str,
    trade_date: &str,
    message: impl Into<String>,
) -> DownloadResult {
    DownloadResult {
        success: true,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: message.into(),
    }
}

pub fn failed_download_result(
    exchange: &str,
    trade_date: &str,
    message: impl Into<String>,
) -> DownloadResult {
    DownloadResult {
        success: false,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: message.into(),
    }
}

pub fn create_holiday_skip_result(
    exchange: &str,
    trade_date: &str,
    holiday_name: &str,
) -> DownloadResult {
    skipped_download_result(
        exchange,
        trade_date,
        format!("Exchange holiday ({holiday_name})"),
    )
}

pub fn create_weekend_skip_result(
    exchange: &str,
    trade_date: &str,
    weekday: Weekday,
) -> DownloadResult {
    skipped_download_result(
        exchange,
        trade_date,
        format!("Weekend ({})", weekday_name(weekday)),
    )
}

/// A failed download that lands on a calendar holiday is not a failure: the
/// exchange published no file because it was closed. The download is still
/// attempted (the calendar never blocks), but the outcome is reclassified as an
/// expected skip so a holiday is never reported as an error.
/// Index results carry a decorated date (`2026-01-15 archive`), so the calendar
/// lookup must use the bare date or every index holiday looks like a gap.
pub fn calendar_date_key(trade_date: &str) -> &str {
    trade_date.split_whitespace().next().unwrap_or(trade_date)
}

pub fn reconcile_holiday_failure(
    connection: &Connection,
    result: DownloadResult,
) -> DownloadResult {
    if result.success {
        return result;
    }
    match get_exchange_holiday_name(connection, &result.exchange, calendar_date_key(&result.trade_date)) {
        Ok(Some(holiday_name)) => skipped_download_result(
            &result.exchange,
            &result.trade_date,
            format!("Exchange holiday ({holiday_name}); no source file published"),
        ),
        _ => result,
    }
}

pub fn create_calendar_skip_result(
    connection: &Connection,
    exchange: &str,
    trade_date: &str,
    weekday: Weekday,
) -> Option<DownloadResult> {
    // A special session wins over everything: the exchange really traded, even on
    // a weekend or a date the calendar calls a holiday.
    if is_special_trading_day(exchange, trade_date) {
        return None;
    }

    // Weekends are structural non-sessions and stay skipped. The calendar name is
    // still attached when the exchange calls that weekend date a holiday.
    if matches!(weekday, Weekday::Sat | Weekday::Sun) {
        let holiday_name =
            get_exchange_holiday_name(connection, exchange, trade_date).unwrap_or(None);
        return Some(match holiday_name {
            Some(holiday_name) => skipped_download_result(
                exchange,
                trade_date,
                format!(
                    "Weekend ({}); Exchange holiday ({holiday_name})",
                    weekday_name(weekday)
                ),
            ),
            None => create_weekend_skip_result(exchange, trade_date, weekday),
        });
    }

    // Deliberately no holiday skip on a weekday. The calendar must never decide
    // that data does not exist: a wrong or stale row would silently suppress a
    // real session. The download is attempted and the calendar is used to explain
    // the outcome instead (see the no-data annotation in the batch summary).
    None
}

pub fn is_calendar_skip_result(result: &DownloadResult) -> bool {
    result.success
        && result.rows_inserted == 0
        && (result.message.starts_with("Exchange holiday")
            || result.message.starts_with("Weekend ("))
}

/// PHASE-1 guard: stored evidence outranks the calendar. A date about to be
/// skipped as a holiday or weekend must not already hold bars, because a
/// calendar row can be wrong (the `2023-09-28` Id-E-Milad row suppressed a real
/// NSE and BSE session) while stored bars are observed market data.
pub fn is_calendar_skip_contradicted(
    skip_result: &DownloadResult,
    has_stored_bars: bool,
) -> bool {
    has_stored_bars && is_calendar_skip_result(skip_result)
}

pub fn get_exchange_holiday_name(
    connection: &Connection,
    exchange: &str,
    trade_date: &str,
) -> AppResult<Option<String>> {
    let normalized_exchange = normalize_exchange_key(exchange);
    if is_shared_cash_market_holiday_exchange(&normalized_exchange)
        && !is_special_trading_day_for_normalized_exchange(&normalized_exchange, trade_date)
    {
        // BSE notice 20101122-22 (22 Nov 2010), Trading Holidays for 2011.
        // An evidenced calendar omission, independent of download/HTML failures.
        if matches!(normalized_exchange.as_str(), "BSE" | "BSEINDEX") && trade_date == "2011-01-26" {
            return Ok(Some("Republic Day (BSE notice 20101122-22)".into()));
        }
        let official_exchange = if normalized_exchange.starts_with("NSE") { "NSE" } else { "BSE" };
        // Legacy in-memory fixtures may not have run the new additive schema.
        // Keep the pre-HOL03 lookup in that case; production databases use
        // bootstrap migrations before any Bhavcopy calendar lookup.
        let has_official_schema: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='official_exchange_holiday_snapshots')",
            [], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        if !has_official_schema { return load_holiday_name_for_date(connection, trade_date); }
        let year = trade_date.get(..4).and_then(|v| v.parse::<i32>().ok());
        if let Some(year) = year {
            let has_accepted: bool = connection.query_row(
                "SELECT EXISTS(SELECT 1 FROM official_exchange_holiday_snapshots WHERE exchange=?1 AND year=?2)",
                params![official_exchange, year], |row| row.get(0)
            ).map_err(|e| e.to_string())?;
            // HOL-04: Only when BSE has no accepted exchange/year snapshot may
            // its shared cash-market dates be read from accepted NSE data.
            // Never label this as independently verified BSE provenance.
            let mut calendar_exchange = official_exchange;
            let mut has_calendar = has_accepted;
            if official_exchange == "BSE" && !has_accepted {
                has_calendar = connection.query_row(
                    "SELECT EXISTS(SELECT 1 FROM official_exchange_holiday_snapshots WHERE exchange='NSE' AND year=?1)",
                    params![year], |row| row.get(0)
                ).map_err(|e| e.to_string())?;
                if has_calendar { calendar_exchange = "NSE"; }
            }
            if has_calendar {
                let official: Option<String> = connection.query_row(
                    "SELECT name FROM official_exchange_holidays WHERE exchange=?1 AND year=?2 AND date=?3",
                    params![calendar_exchange,year,trade_date], |row| row.get(0)
                ).optional().map_err(|e| e.to_string())?;
                if official.is_some() { return Ok(official); }
                // Preserve every user-created global holiday, but suppress
                // unverified BUILTIN dates for an accepted exchange/year.
                return connection.query_row(
                    "SELECT name FROM market_holidays WHERE date=?1 AND source='USER' LIMIT 1",
                    params![trade_date], |row| row.get(0)
                ).optional().map_err(|e| e.to_string());
            }
        }
        // PHASE-1 (11 November 2026): a year without an accepted official
        // snapshot has no calendar authority. The unverified `BUILTIN` seed is
        // no longer consulted: it is a frozen 2026-08-09 import with no
        // provenance, and it carried a false Id-E-Milad row on 2023-09-28.
        // Manual `USER` rows still apply - they are attributable and reviewable.
        return load_manual_holiday_name_for_date(connection, trade_date);
    }
    Ok(None)
}

pub fn special_trading_day_name(exchange: &str, trade_date: &str) -> Option<&'static str> {
    let normalized_exchange = normalize_exchange_key(exchange);
    special_trading_day_name_for_normalized_exchange(&normalized_exchange, trade_date)
}

pub fn special_trading_day_name_for_normalized_exchange(
    normalized_exchange: &str,
    trade_date: &str,
) -> Option<&'static str> {
    let calendar = match normalized_exchange {
        "NSE" | "NSEINDEX" => NSE_SPECIAL_TRADING_DAYS,
        "BSE" | "BSEINDEX" => BSE_SPECIAL_TRADING_DAYS,
        _ => return None,
    };

    calendar
        .iter()
        .find_map(|(date, name)| (*date == trade_date).then_some(*name))
}

pub fn is_special_trading_day(exchange: &str, trade_date: &str) -> bool {
    special_trading_day_name(exchange, trade_date).is_some()
}

pub fn is_special_trading_day_for_normalized_exchange(
    normalized_exchange: &str,
    trade_date: &str,
) -> bool {
    special_trading_day_name_for_normalized_exchange(normalized_exchange, trade_date).is_some()
}

pub fn is_shared_cash_market_holiday_exchange(normalized_exchange: &str) -> bool {
    matches!(normalized_exchange, "NSE" | "NSEINDEX" | "BSE" | "BSEINDEX")
}

pub fn load_holiday_name_for_date(
    connection: &Connection,
    trade_date: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "SELECT name FROM market_holidays WHERE date = ? LIMIT 1",
            params![trade_date],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
}

/// Manual (`source='USER'`) holidays only - the PHASE-1 lookup for any year
/// without an accepted official snapshot.
pub fn load_manual_holiday_name_for_date(
    connection: &Connection,
    trade_date: &str,
) -> AppResult<Option<String>> {
    connection
        .query_row(
            "SELECT name FROM market_holidays WHERE date = ?1 AND source = 'USER' LIMIT 1",
            params![trade_date],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
}

/// True when the exchange has an accepted official holiday snapshot for `year`.
/// BSE may be covered by an accepted NSE snapshot for its shared cash-market
/// dates, mirroring `get_exchange_holiday_name`; callers must not present that
/// as independent BSE provenance.
pub fn has_official_holiday_snapshot(
    connection: &Connection,
    exchange: &str,
    year: i32,
) -> AppResult<bool> {
    let normalized_exchange = normalize_exchange_key(exchange);
    let official_exchange = if normalized_exchange.starts_with("NSE") { "NSE" } else { "BSE" };
    let has_schema: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='official_exchange_holiday_snapshots')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !has_schema {
        return Ok(false);
    }
    let own: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM official_exchange_holiday_snapshots WHERE exchange=?1 AND year=?2)",
            params![official_exchange, year],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if own || official_exchange != "BSE" {
        return Ok(own);
    }
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM official_exchange_holiday_snapshots WHERE exchange='NSE' AND year=?1)",
            params![year],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
}

pub fn weekday_name(weekday: Weekday) -> &'static str {
    match weekday {
        Weekday::Mon => "Monday",
        Weekday::Tue => "Tuesday",
        Weekday::Wed => "Wednesday",
        Weekday::Thu => "Thursday",
        Weekday::Fri => "Friday",
        Weekday::Sat => "Saturday",
        Weekday::Sun => "Sunday",
    }
}

pub fn parse_trade_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| format!("Invalid trade date: {value}"))
}

pub fn generate_calendar_days(start_date: &str, end_date: &str) -> AppResult<Vec<String>> {
    let start = parse_trade_date(start_date)?;
    let end = parse_trade_date(end_date)?;
    let mut current = start;
    let mut days = Vec::new();

    while current <= end {
        days.push(current.format("%Y-%m-%d").to_string());
        current += Duration::days(1);
    }

    Ok(days)
}

pub fn today_trade_date() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

pub fn update_end_trade_date() -> String {
    let now = Local::now();
    update_end_trade_date_for(now.date_naive(), now.hour())
}

pub fn update_end_trade_date_for(local_date: NaiveDate, local_hour: u32) -> String {
    let end_date = if local_hour >= UPDATE_SAME_DAY_PROBE_AFTER_LOCAL_HOUR {
        local_date
    } else {
        local_date - Duration::days(1)
    };
    end_date.format("%Y-%m-%d").to_string()
}

pub fn full_history_start_for_exchange(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => NSE_FULL_HISTORY_START,
        "NSEINDEX" => NSE_INDEX_FULL_HISTORY_START,
        "BSE" => BSE_FULL_HISTORY_START,
        "BSEINDEX" => BSE_INDEX_FULL_HISTORY_START,
        _ => BSE_FULL_HISTORY_START,
    }
}

pub fn format_exchange_log_label(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => "NSE",
        "BSE" => "BSE",
        "NSEINDEX" => "NSE Index",
        "BSEINDEX" => "BSE Index",
        _ => "Unknown",
    }
}

pub fn format_source_category_label(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "NSE" => "NSE Equity",
        "BSE" => "BSE Equity",
        "NSEINDEX" => "NSE Indices",
        "BSEINDEX" => "BSE Index",
        _ => "Unknown",
    }
}

pub fn summarize_source_categories(tasks: &[DownloadTask]) -> String {
    let mut seen = HashSet::<&'static str>::new();
    let mut categories = Vec::<&'static str>::new();
    for task in tasks {
        let label = if task.nse_index_history.is_some() {
            "Full NSE index list unavailable; using limited historical index fallback: NIFTY 50, NIFTY BANK."
        } else {
            format_source_category_label(&task.exchange)
        };
        if seen.insert(label) {
            categories.push(label);
        }
    }
    categories.join(", ")
}

pub fn selected_exchanges(exchanges: &ExchangeSelection) -> Vec<String> {
    let mut selected = Vec::<String>::new();
    if exchanges.nse {
        selected.push("NSE".to_string());
    }
    if exchanges.bse {
        selected.push("BSE".to_string());
    }
    if exchanges.nse_index {
        selected.push("NSE_INDEX".to_string());
    }
    if exchanges.bse_index {
        selected.push("BSE_INDEX".to_string());
    }
    selected
}

pub fn resolve_exchange_date_window(
    connection: &Connection,
    mode: &DownloadMode,
    exchange: &str,
    requested_start_date: &str,
    requested_end_date: &str,
    info_messages: &mut Vec<String>,
) -> AppResult<Option<(String, String)>> {
    let exchange_label = format_exchange_log_label(exchange);
    match mode {
        DownloadMode::Range => Ok(Some((
            requested_start_date.to_string(),
            requested_end_date.to_string(),
        ))),
        DownloadMode::FullHistory => {
            let start_date = full_history_start_for_exchange(exchange).to_string();
            let end_date = today_trade_date();
            info_messages.push(format!(
                "[{exchange_label}] Full history range: {start_date} to {end_date}"
            ));
            if exchange == "BSE_INDEX" {
                info_messages.push(
                    "[BSE Index] Older index coverage varies by archive availability; missing dates will be skipped."
                        .to_string(),
                );
            }
            Ok(Some((start_date, end_date)))
        }
        DownloadMode::Update => {
            let end_date = update_end_trade_date();
            match storage_mode_get_latest_imported_trade_date(connection, exchange)? {
                Some(latest_imported_date) => {
                    let next_date = parse_trade_date(&latest_imported_date)? + Duration::days(1);
                    if next_date.format("%Y-%m-%d").to_string() > end_date {
                        info_messages.push(format!(
                            "[{exchange_label}] Already up to date through {latest_imported_date}"
                        ));
                        return Ok(None);
                    }
                    let start_date = next_date.format("%Y-%m-%d").to_string();
                    info_messages.push(format!(
                        "[{exchange_label}] Latest imported date: {latest_imported_date}"
                    ));
                    info_messages.push(format!(
                        "[{exchange_label}] Update range: {start_date} to {end_date}"
                    ));
                    Ok(Some((start_date, end_date)))
                }
                None => {
                    let start_date = full_history_start_for_exchange(exchange).to_string();
                    info_messages.push(format!(
                        "[{exchange_label}] No imported history found. Using full history start: {start_date}"
                    ));
                    info_messages.push(format!(
                        "[{exchange_label}] Update range: {start_date} to {end_date}"
                    ));
                    if exchange == "BSE_INDEX" {
                        info_messages.push(
                            "[BSE Index] Older index coverage varies by archive availability; missing dates will be skipped."
                                .to_string(),
                        );
                    }
                    Ok(Some((start_date, end_date)))
                }
            }
        }
    }
}

// HOL-04 acceptance checks use disposable in-memory SQLite only.
#[cfg(test)]
mod hol04_tests {
    use super::*;

    fn test_calendar() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("
            CREATE TABLE market_holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL, source TEXT NOT NULL
            );
            CREATE TABLE official_exchange_holiday_snapshots (
                exchange TEXT NOT NULL, year INTEGER NOT NULL, source_urls TEXT NOT NULL,
                source_sha256 TEXT NOT NULL, accepted_at TEXT NOT NULL,
                record_count INTEGER NOT NULL, PRIMARY KEY(exchange,year)
            );
            CREATE TABLE official_exchange_holidays (
                exchange TEXT NOT NULL, year INTEGER NOT NULL, date TEXT NOT NULL,
                name TEXT NOT NULL, PRIMARY KEY(exchange,year,date),
                FOREIGN KEY(exchange,year) REFERENCES official_exchange_holiday_snapshots(exchange,year)
            );
        ").unwrap();
        db
    }

    fn accept(db: &Connection, exchange: &str, date: &str, name: &str) {
        db.execute(
            "INSERT OR IGNORE INTO official_exchange_holiday_snapshots (exchange,year,source_urls,source_sha256,accepted_at,record_count) VALUES (?1,2026,'[]','test-hash','fixture',1)",
            params![exchange],
        ).unwrap();
        db.execute(
            "INSERT INTO official_exchange_holidays (exchange,year,date,name) VALUES (?1,2026,?2,?3)",
            params![exchange,date,name],
        ).unwrap();
    }

    #[test]
    fn hol04_nse_accepted_calendar_covers_bse_cash_and_both_index_streams() {
        let db = test_calendar();
        accept(&db, "NSE", "2026-10-02", "Verified NSE holiday");
        for exchange in ["NSE", "NSE_INDEX", "BSE", "BSE_INDEX"] {
            assert_eq!(get_exchange_holiday_name(&db, exchange, "2026-10-02").unwrap().as_deref(),
                Some("Verified NSE holiday"), "exchange {exchange}");
        }
    }

    #[test]
    fn hol04_bse_specific_snapshot_takes_precedence_over_nse() {
        let db = test_calendar();
        accept(&db, "NSE", "2026-10-02", "NSE holiday");
        accept(&db, "BSE", "2026-10-05", "BSE-specific holiday");
        assert_eq!(get_exchange_holiday_name(&db, "BSE", "2026-10-02").unwrap(), None);
        assert_eq!(get_exchange_holiday_name(&db, "BSE_INDEX", "2026-10-05").unwrap().as_deref(), Some("BSE-specific holiday"));
        assert_eq!(get_exchange_holiday_name(&db, "NSE", "2026-10-02").unwrap().as_deref(), Some("NSE holiday"));
    }

    #[test]
    fn hol04_accepted_nse_preserves_user_holidays_not_builtin_for_bse() {
        let db = test_calendar();
        accept(&db, "NSE", "2026-10-02", "NSE holiday");
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-03-03','Unverified old data','BUILTIN')", []).unwrap();
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-05-02','Manual exception','USER')", []).unwrap();
        assert_eq!(get_exchange_holiday_name(&db, "BSE", "2026-03-03").unwrap(), None);
        assert_eq!(get_exchange_holiday_name(&db, "BSE", "2026-05-02").unwrap().as_deref(), Some("Manual exception"));
    }

    #[test]
    fn phase1_no_official_calendar_ignores_builtin_and_keeps_user() {
        let db = test_calendar();
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-10-02','Historical preserved','BUILTIN')", []).unwrap();
        // PHASE-1: a year without an accepted official snapshot has no calendar
        // authority, so an unverified built-in row no longer suppresses a session.
        assert_eq!(get_exchange_holiday_name(&db, "BSE", "2026-10-02").unwrap(), None);
        assert_eq!(get_exchange_holiday_name(&db, "NSE", "2026-10-02").unwrap(), None);
        // Manual holidays stay authoritative and attributable.
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-10-05','Manual closure','USER')", []).unwrap();
        assert_eq!(get_exchange_holiday_name(&db, "NSE", "2026-10-05").unwrap().as_deref(), Some("Manual closure"));
        assert_eq!(get_exchange_holiday_name(&db, "BSE_INDEX", "2026-10-05").unwrap().as_deref(), Some("Manual closure"));
    }

    #[test]
    fn decorated_index_dates_still_resolve_to_the_calendar() {
        let db = test_calendar();
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-01-15','Election','USER')", []).unwrap();
        // Index results carry "<date> archive"; the lookup must use the bare date.
        assert_eq!(calendar_date_key("2026-01-15 archive"), "2026-01-15");
        let failed = failed_download_result("NSE_INDEX", "2026-01-15 archive", "no data available");
        let reconciled = reconcile_holiday_failure(&db, failed);
        assert!(reconciled.success, "an index holiday must not count as a failure");
        assert!(reconciled.message.starts_with("Exchange holiday (Election)"));
    }

    #[test]
    fn holiday_failure_is_reclassified_as_an_expected_skip() {
        let db = test_calendar();
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2026-06-26','Muharram','USER')", []).unwrap();
        let failed = failed_download_result("NSE", "2026-06-26", "no data available for this date");
        let reconciled = reconcile_holiday_failure(&db, failed);
        assert!(reconciled.success, "a closed day must not count as a failure");
        assert_eq!(reconciled.rows_inserted, 0);
        assert!(reconciled.message.starts_with("Exchange holiday (Muharram)"));
        assert!(is_calendar_skip_result(&reconciled));
        // A failure on a normal trading day stays a failure.
        let genuine = failed_download_result("NSE", "2026-06-25", "no data available for this date");
        let kept = reconcile_holiday_failure(&db, genuine);
        assert!(!kept.success);
        assert!(kept.message.starts_with("no data available"));
    }

    #[test]
    fn weekday_holiday_never_blocks_a_download() {
        let db = test_calendar();
        db.execute("INSERT INTO market_holidays (date,name,source) VALUES ('2023-09-28','Id-E-Milad','USER')", []).unwrap();
        // The calendar row exists, yet a weekday is still planned: a wrong or stale
        // row must never decide that data does not exist.
        assert!(create_calendar_skip_result(&db, "NSE", "2023-09-28", Weekday::Thu).is_none());
        // The row is still readable, so a no-data result can be explained.
        assert_eq!(
            get_exchange_holiday_name(&db, "NSE", "2023-09-28").unwrap().as_deref(),
            Some("Id-E-Milad")
        );
        // Weekends keep skipping (structural), with the holiday name attached.
        let weekend_skip = create_calendar_skip_result(&db, "NSE", "2023-09-30", Weekday::Sat).unwrap();
        assert!(weekend_skip.message.starts_with("Weekend ("));
        assert!(is_calendar_skip_contradicted(&weekend_skip, true));
        assert!(!is_calendar_skip_contradicted(&weekend_skip, false));
        // A special session overrides even a weekend.
        assert!(create_calendar_skip_result(&db, "NSE", "2023-11-12", Weekday::Sun).is_none());
    }

    #[test]
    fn phase1_official_snapshot_presence_is_exchange_and_year_scoped() {
        let db = test_calendar();
        assert!(!has_official_holiday_snapshot(&db, "NSE", 2026).unwrap());
        accept(&db, "NSE", "2026-10-02", "Verified NSE holiday");
        assert!(has_official_holiday_snapshot(&db, "NSE", 2026).unwrap());
        assert!(has_official_holiday_snapshot(&db, "NSE_INDEX", 2026).unwrap());
        // BSE is covered through the shared cash market, not its own snapshot.
        assert!(has_official_holiday_snapshot(&db, "BSE", 2026).unwrap());
        assert!(!has_official_holiday_snapshot(&db, "NSE", 2023).unwrap());
        assert!(!has_official_holiday_snapshot(&db, "BSE", 2023).unwrap());
    }

    #[test]
    fn hol04_special_trading_day_overrides_both_nse_and_bse_snapshots() {
        let db = test_calendar();
        accept(&db, "NSE", "2026-11-08", "Official Muhurat entry");
        assert_eq!(get_exchange_holiday_name(&db, "BSE", "2026-11-08").unwrap(), None);
        assert!(create_calendar_skip_result(&db, "BSE", "2026-11-08", Weekday::Sun).is_none());
        assert!(create_calendar_skip_result(&db, "NSE", "2026-11-08", Weekday::Sun).is_none());
    }
}

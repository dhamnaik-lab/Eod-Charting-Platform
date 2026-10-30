use chrono::{Duration, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter};

use super::eod_data::{
    apply_corporate_adjustments, build_chart_events, load_unified_price_rows_with_mode,
    resolve_instrument_context,
};
use super::symbol_search::list_instrument_summaries_internal;
use super::{
    get_active_database_file_path, get_price_storage_mode, load_db_stats,
    open_read_only_connection_for_folder, resolve_active_database_folder, AppResult,
    ChartEventRecord, EodRow, InstrumentSummary, SymbolSeriesFilter,
};

const DEFAULT_HISTORY_SESSIONS: usize = 30;
const MIN_HISTORY_SESSIONS: usize = 21;
const MAX_HISTORY_SESSIONS: usize = 120;
const DEFAULT_CALENDAR_LOOKBACK_DAYS: i64 = 180;
const MAX_FAILURE_DETAILS: usize = 100;
const MAX_UNIVERSE_SIZE: u32 = 50_000;
const PROGRESS_EMIT_INTERVAL: usize = 25;

static NEXT_FALLBACK_REQUEST_ID: AtomicU64 = AtomicU64::new(1);
static ACTIVE_SCAN_CANCELLATIONS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    OnceLock::new();

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMarketSnapshotInput {
    pub request_id: Option<String>,
    pub exchange: Option<String>,
    pub history_sessions: Option<u32>,
    pub adjusted: Option<bool>,
    pub include_dividend_adjustments: Option<bool>,
    pub include_rights_adjustments: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelDailyMarketSnapshotInput {
    pub request_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelDailyMarketSnapshotResult {
    pub cancelled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMarketSnapshotProgressEvent {
    pub request_id: String,
    pub processed_symbol_count: usize,
    pub target_symbol_count: usize,
    pub fetched_symbol_count: usize,
    pub failed_symbol_count: usize,
    pub current_symbol: Option<String>,
    pub current_exchange: Option<String>,
    pub cancelled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMarketSnapshotSymbol {
    pub instrument: InstrumentSummary,
    pub bars: Vec<EodRow>,
    pub adjusted: bool,
    pub include_dividend_adjustments: bool,
    pub include_rights_adjustments: bool,
    pub events: Vec<ChartEventRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMarketSnapshotFailure {
    pub symbol: String,
    pub exchange: String,
    pub error: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMarketSnapshotResult {
    pub request_id: String,
    pub database_identity: String,
    pub database_revision: String,
    pub latest_database_date: Option<String>,
    pub target_symbol_count: usize,
    pub fetched_symbol_count: usize,
    pub failed_symbol_count: usize,
    pub symbols: Vec<DailyMarketSnapshotSymbol>,
    pub failures: Vec<DailyMarketSnapshotFailure>,
}

#[tauri::command]
pub async fn get_daily_market_snapshot(
    app: AppHandle,
    input: DailyMarketSnapshotInput,
) -> AppResult<DailyMarketSnapshotResult> {
    let request_id = normalize_request_id(input.request_id.as_deref());
    let cancellation = register_scan(&request_id)?;
    let task_request_id = request_id.clone();
    let task_cancellation = Arc::clone(&cancellation);
    let task_app = app.clone();

    let task_result = tauri::async_runtime::spawn_blocking(move || {
        build_daily_market_snapshot(
            &task_app,
            input,
            &task_request_id,
            task_cancellation.as_ref(),
        )
    })
    .await;

    unregister_scan(&request_id, &cancellation)?;
    task_result.map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn cancel_daily_market_snapshot(
    input: CancelDailyMarketSnapshotInput,
) -> AppResult<CancelDailyMarketSnapshotResult> {
    let request_id = input.request_id.trim();
    if request_id.is_empty() {
        return Err("Market snapshot requestId is required.".to_string());
    }

    let registry = scan_registry();
    let guard = registry
        .lock()
        .map_err(|_| "Market snapshot cancellation registry is unavailable.".to_string())?;
    let cancelled = guard
        .get(request_id)
        .map(|flag| {
            flag.store(true, Ordering::Release);
            true
        })
        .unwrap_or(false);

    Ok(CancelDailyMarketSnapshotResult { cancelled })
}

fn build_daily_market_snapshot(
    app: &AppHandle,
    input: DailyMarketSnapshotInput,
    request_id: &str,
    cancellation: &AtomicBool,
) -> AppResult<DailyMarketSnapshotResult> {
    let folder_path =
        resolve_active_database_folder(app)?.ok_or_else(|| "No active database".to_string())?;
    let database_file_path =
        get_active_database_file_path(app)?.ok_or_else(|| "No active database file".to_string())?;

    let exchange = normalize_market_exchange(input.exchange.as_deref())?;
    let history_sessions = input
        .history_sessions
        .unwrap_or(DEFAULT_HISTORY_SESSIONS as u32)
        .clamp(MIN_HISTORY_SESSIONS as u32, MAX_HISTORY_SESSIONS as u32)
        as usize;
    let adjusted = input.adjusted.unwrap_or(true);
    let include_dividend_adjustments = input.include_dividend_adjustments.unwrap_or(false);
    let include_rights_adjustments = input.include_rights_adjustments.unwrap_or(false);

    // Market scans use their own read-only SQLite connection. This avoids holding the
    // shared chart/database connection mutex for the duration of a full-universe scan.
    let connection = open_read_only_connection_for_folder(&folder_path)?;
    let storage_mode = get_price_storage_mode(&connection);
    let db_stats = load_db_stats(&folder_path, &connection)?;
    let mut instruments = Vec::new();
    match exchange.as_str() {
        "NSE" => {
            instruments.extend(list_instrument_summaries_internal(
                &connection,
                None,
                Some("NSE"),
                Some(MAX_UNIVERSE_SIZE),
                Some(&SymbolSeriesFilter::NseEquity),
                false,
            )?);
        }
        "BSE" => {
            instruments.extend(list_instrument_summaries_internal(
                &connection,
                None,
                Some("BSE"),
                Some(MAX_UNIVERSE_SIZE),
                Some(&SymbolSeriesFilter::All),
                false,
            )?);
        }
        "ALL" => {
            instruments.extend(list_instrument_summaries_internal(
                &connection,
                None,
                Some("NSE"),
                Some(MAX_UNIVERSE_SIZE),
                Some(&SymbolSeriesFilter::NseEquity),
                false,
            )?);
            instruments.extend(list_instrument_summaries_internal(
                &connection,
                None,
                Some("BSE"),
                Some(MAX_UNIVERSE_SIZE),
                Some(&SymbolSeriesFilter::All),
                false,
            )?);
        }
        _ => unreachable!(),
    }

    instruments.retain(|instrument| {
        matches!(instrument.exchange.as_str(), "NSE" | "BSE") && instrument.is_active
    });
    instruments.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    instruments
        .dedup_by(|left, right| left.exchange == right.exchange && left.symbol == right.symbol);

    let latest_database_date = instruments
        .iter()
        .filter_map(|instrument| instrument.last_price_date.clone())
        .max()
        .or_else(|| db_stats.date_to.clone());
    let to = latest_database_date
        .clone()
        .unwrap_or_else(|| "2100-12-31".to_string());
    let from = bounded_from_date(&to, DEFAULT_CALENDAR_LOOKBACK_DAYS);

    let target_symbol_count = instruments.len();
    let mut symbols = Vec::with_capacity(target_symbol_count);
    let mut failures = Vec::new();
    let mut failed_symbol_count = 0usize;
    let mut processed_symbol_count = 0usize;

    emit_progress(
        app,
        request_id,
        processed_symbol_count,
        target_symbol_count,
        symbols.len(),
        failed_symbol_count,
        None,
        None,
        false,
    );

    for instrument in instruments {
        if cancellation.load(Ordering::Acquire) {
            emit_progress(
                app,
                request_id,
                processed_symbol_count,
                target_symbol_count,
                symbols.len(),
                failed_symbol_count,
                None,
                None,
                true,
            );
            return Err("Daily market snapshot scan cancelled.".to_string());
        }

        let failure_symbol = instrument.symbol.clone();
        let failure_exchange = instrument.exchange.clone();
        let load_result = (|| -> AppResult<DailyMarketSnapshotSymbol> {
            let context =
                resolve_instrument_context(&connection, &instrument.symbol, &instrument.exchange)?
                    .ok_or_else(|| "Instrument context could not be resolved".to_string())?;

            let price_rows = load_unified_price_rows_with_mode(
                &folder_path,
                &connection,
                &context,
                &from,
                &to,
                storage_mode,
            )?;
            let price_rows = if adjusted {
                apply_corporate_adjustments(
                    price_rows,
                    &context.corporate_actions,
                    include_dividend_adjustments,
                    include_rights_adjustments,
                )?
            } else {
                price_rows
            };

            let keep_from = price_rows.len().saturating_sub(history_sessions);
            let bars = price_rows
                .into_iter()
                .skip(keep_from)
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

            Ok(DailyMarketSnapshotSymbol {
                instrument,
                bars,
                adjusted,
                include_dividend_adjustments,
                include_rights_adjustments,
                events: build_chart_events(&context, &from, &to),
            })
        })();

        match load_result {
            Ok(symbol) => symbols.push(symbol),
            Err(error) => {
                failed_symbol_count += 1;
                if failures.len() < MAX_FAILURE_DETAILS {
                    failures.push(DailyMarketSnapshotFailure {
                        symbol: failure_symbol.clone(),
                        exchange: failure_exchange.clone(),
                        error,
                    });
                }
            }
        }

        processed_symbol_count += 1;
        if processed_symbol_count % PROGRESS_EMIT_INTERVAL == 0
            || processed_symbol_count == target_symbol_count
        {
            emit_progress(
                app,
                request_id,
                processed_symbol_count,
                target_symbol_count,
                symbols.len(),
                failed_symbol_count,
                Some(failure_symbol),
                Some(failure_exchange),
                false,
            );
        }
    }

    if cancellation.load(Ordering::Acquire) {
        emit_progress(
            app,
            request_id,
            processed_symbol_count,
            target_symbol_count,
            symbols.len(),
            failed_symbol_count,
            None,
            None,
            true,
        );
        return Err("Daily market snapshot scan cancelled.".to_string());
    }

    let modified_millis = fs::metadata(&database_file_path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let database_identity = database_file_path.to_string_lossy().to_string();
    let database_revision = format!(
        "{}:{}:{}:{}:{}",
        database_identity,
        db_stats.date_to.clone().unwrap_or_default(),
        db_stats.symbol_count,
        db_stats.bar_count,
        modified_millis
    );
    let fetched_symbol_count = symbols.len();

    Ok(DailyMarketSnapshotResult {
        request_id: request_id.to_string(),
        database_identity,
        database_revision,
        latest_database_date,
        target_symbol_count,
        fetched_symbol_count,
        failed_symbol_count,
        symbols,
        failures,
    })
}

fn scan_registry() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    ACTIVE_SCAN_CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_scan(request_id: &str) -> AppResult<Arc<AtomicBool>> {
    let cancellation = Arc::new(AtomicBool::new(false));
    let mut guard = scan_registry()
        .lock()
        .map_err(|_| "Market snapshot cancellation registry is unavailable.".to_string())?;
    if let Some(previous) = guard.insert(request_id.to_string(), Arc::clone(&cancellation)) {
        previous.store(true, Ordering::Release);
    }
    Ok(cancellation)
}

fn unregister_scan(request_id: &str, cancellation: &Arc<AtomicBool>) -> AppResult<()> {
    let mut guard = scan_registry()
        .lock()
        .map_err(|_| "Market snapshot cancellation registry is unavailable.".to_string())?;
    let should_remove = guard
        .get(request_id)
        .map(|current| Arc::ptr_eq(current, cancellation))
        .unwrap_or(false);
    if should_remove {
        guard.remove(request_id);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app: &AppHandle,
    request_id: &str,
    processed_symbol_count: usize,
    target_symbol_count: usize,
    fetched_symbol_count: usize,
    failed_symbol_count: usize,
    current_symbol: Option<String>,
    current_exchange: Option<String>,
    cancelled: bool,
) {
    let _ = app.emit(
        "daily-market-snapshot:progress",
        DailyMarketSnapshotProgressEvent {
            request_id: request_id.to_string(),
            processed_symbol_count,
            target_symbol_count,
            fetched_symbol_count,
            failed_symbol_count,
            current_symbol,
            current_exchange,
            cancelled,
        },
    );
}

fn normalize_request_id(value: Option<&str>) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            format!(
                "market-snapshot-{}",
                NEXT_FALLBACK_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
            )
        })
}

fn normalize_market_exchange(value: Option<&str>) -> AppResult<String> {
    let normalized = value.unwrap_or("NSE").trim().to_uppercase();
    match normalized.as_str() {
        "NSE" | "BSE" | "ALL" => Ok(normalized),
        _ => Err("Market snapshot exchange must be NSE, BSE, or all.".to_string()),
    }
}

fn bounded_from_date(to: &str, lookback_days: i64) -> String {
    NaiveDate::parse_from_str(to, "%Y-%m-%d")
        .map(|date| date - Duration::days(lookback_days))
        .map(|date| date.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|_| "1900-01-01".to_string())
}

#[cfg(test)]
mod tests {
    use super::{bounded_from_date, normalize_market_exchange, normalize_request_id};

    #[test]
    fn normalizes_supported_exchanges() {
        assert_eq!(normalize_market_exchange(Some("nse")).unwrap(), "NSE");
        assert_eq!(normalize_market_exchange(Some("BSE")).unwrap(), "BSE");
        assert_eq!(normalize_market_exchange(Some("all")).unwrap(), "ALL");
        assert!(normalize_market_exchange(Some("NASDAQ")).is_err());
    }

    #[test]
    fn calculates_bounded_history_date() {
        assert_eq!(bounded_from_date("2026-08-04", 30), "2026-07-05");
        assert_eq!(bounded_from_date("invalid", 30), "1900-01-01");
    }

    #[test]
    fn preserves_or_generates_request_ids() {
        assert_eq!(normalize_request_id(Some(" scan-1 ")), "scan-1");
        assert!(normalize_request_id(None).starts_with("market-snapshot-"));
    }
}

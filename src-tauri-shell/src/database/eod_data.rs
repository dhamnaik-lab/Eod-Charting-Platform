use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tauri::AppHandle;

use super::binary_eod::{date_to_u32, u32_to_date, BinaryEodFile, EodRecord};
use super::connection_registry::{resolve_active_database_folder, with_connection_for_folder};
use super::index_aliases::nse_index_alias_family;
mod index_alias_history;
mod bse_code_history;
use index_alias_history::{
    augment_index_alias_context, guard_index_previous_close, resolve_index_alias_context,
    validate_index_alias_rows,
};
use super::{
    get_price_storage_mode, map_identity_history_row, normalize_exchange,
    normalize_optional_trade_date, normalize_symbol, question_marks, round_price,
    trim_numeric_string, AppResult, ChartEventRecord, CorporateActionRow,
    EodDataInputPayload, EodDataResult, EodRow, InstrumentRecord, InstrumentSummary, PriceRow,
    PriceStorageMode, ResolvedInstrumentContext, SymbolTransition,
};

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EodDataBinaryResult {
    pub requested_symbol: String,
    pub requested_exchange: String,
    pub adjusted: bool,
    pub include_dividend_adjustments: bool,
    pub include_rights_adjustments: bool,
    pub instrument: Option<InstrumentSummary>,
    pub bar_count: usize,
    pub bars_b64: String,
    pub events: Vec<ChartEventRecord>,
}

fn encode_b64_bytes(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { TABLE[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[(n & 63) as usize] as char } else { '=' });
    }
    out
}

pub fn encode_eod_rows_binary_b64(rows: &[EodRow]) -> String {
    let mut buf = Vec::with_capacity(rows.len() * 64);
    for row in rows {
        let ymd = date_to_u32(&row.date);
        let flags: u32 = if row.prev_close.is_some() { 1 } else { 0 };
        buf.extend_from_slice(&ymd.to_le_bytes());
        buf.extend_from_slice(&flags.to_le_bytes());
        buf.extend_from_slice(&row.open.to_le_bytes());
        buf.extend_from_slice(&row.high.to_le_bytes());
        buf.extend_from_slice(&row.low.to_le_bytes());
        buf.extend_from_slice(&row.close.to_le_bytes());
        buf.extend_from_slice(&row.prev_close.unwrap_or(0.0).to_le_bytes());
        buf.extend_from_slice(&(row.volume as f64).to_le_bytes());
        buf.extend_from_slice(&(row.open_interest as f64).to_le_bytes());
    }
    encode_b64_bytes(&buf)
}

#[tauri::command]
pub async fn get_eod_data_binary(app: AppHandle, input: EodDataInputPayload) -> AppResult<EodDataBinaryResult> {
    let res = get_eod_data(app, input).await?;
    let bar_count = res.bars.len();
    let bars_b64 = encode_eod_rows_binary_b64(&res.bars);
    Ok(EodDataBinaryResult {
        requested_symbol: res.requested_symbol,
        requested_exchange: res.requested_exchange,
        adjusted: res.adjusted,
        include_dividend_adjustments: res.include_dividend_adjustments,
        include_rights_adjustments: res.include_rights_adjustments,
        instrument: res.instrument,
        bar_count,
        bars_b64,
        events: res.events,
    })
}

#[tauri::command]
pub async fn get_eod_data(app: AppHandle, input: EodDataInputPayload) -> AppResult<EodDataResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let requested_symbol = normalize_symbol(&input.symbol)?;
        let requested_exchange = normalize_exchange(&input.exchange)?;
        let adjusted = input.adjusted.unwrap_or(false);
        let include_dividend_adjustments = input.include_dividend_adjustments.unwrap_or(false);
        let include_rights_adjustments = input.include_rights_adjustments.unwrap_or(false);

        let empty = || EodDataResult {
            requested_symbol: requested_symbol.clone(),
            requested_exchange: requested_exchange.clone(),
            adjusted,
            include_dividend_adjustments,
            include_rights_adjustments,
            instrument: None,
            bars: Vec::new(),
            events: Vec::new(),
        };

        let folder_path = resolve_active_database_folder(&app)?
            .ok_or_else(|| "No active database".to_string())?;

        with_connection_for_folder(&app, &folder_path, false, |connection| {
            let from = normalize_optional_trade_date(input.from.as_deref())?
                .unwrap_or_else(|| "1900-01-01".to_string());
            let to = normalize_optional_trade_date(input.to.as_deref())?
                .unwrap_or_else(|| "2100-12-31".to_string());

            let resolve_identity = input.resolve_identity.unwrap_or(true);
            let context = if resolve_identity {
                resolve_instrument_context(connection, &requested_symbol, &requested_exchange)?
            } else {
                resolve_exact_instrument_context(
                    connection,
                    &requested_symbol,
                    &requested_exchange,
                )?
            };
            let Some(context) = context else {
                return Ok(empty());
            };

            let price_rows =
                load_unified_price_rows(&folder_path, connection, &context, &from, &to)?;
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
            let price_rows = if requested_exchange == "NSE_INDEX" {
                guard_index_previous_close(price_rows)
            } else {
                price_rows
            };

            Ok(EodDataResult {
                requested_symbol: requested_symbol.clone(),
                requested_exchange: requested_exchange.clone(),
                adjusted,
                include_dividend_adjustments,
                include_rights_adjustments,
                instrument: Some(InstrumentSummary {
                    symbol: context.current_symbol.clone(),
                    exchange: context.exchange.clone(),
                    name: context.current_name.clone(),
                    series: context
                        .current_instrument
                        .as_ref()
                        .and_then(|instrument| instrument.series.clone()),
                    isin: context.isin.clone(),
                    is_active: context
                        .current_instrument
                        .as_ref()
                        .map(|instrument| instrument.is_active)
                        .unwrap_or(true),
                    lifecycle_status: context
                        .current_instrument
                        .as_ref()
                        .and_then(|instrument| instrument.lifecycle_status.clone())
                        .or_else(|| Some("CURRENT".to_string())),
                    last_price_date: price_rows.last().map(|row| row.date.clone()),
                    exchange_latest_price_date: price_rows.last().map(|row| row.date.clone()),
                    resolved_from_alias: Some(context.resolved_from_alias),
                    matched_symbol: if context.resolved_from_alias {
                        Some(context.requested_symbol.clone())
                    } else {
                        None
                    },
                    matched_name: None,
                }),
                bars: price_rows
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
                    .collect(),
                events: build_chart_events(&context, &from, &to),
            })
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

/// One completed bar returned by the native-scanner read gateway, in real price units.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ScanPriceBar {
    pub date: u32,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub prev_close: Option<f64>,
    pub volume: f64,
    pub open_interest: f64,
}

/// How many extra rows are loaded *before* the requested window so that the
/// previous-close and index-adjacency semantics stay identical to a full read.
///
/// Eight calendar days covers a weekend plus the longest ordinary Indian trading
/// holiday run, which is the window `guard_index_previous_close` treats as "adjacent".
const SCAN_PADDING_BARS: usize = 8;

/// Native-scanner read gateway (NS-01/NS-02).
///
/// Returns a bounded, date-ascending window of completed bars for one target with the
/// *same* canonical resolution, unified binary/Hybrid read and approved adjustment
/// projection that `get_eod_data` uses. Read-only by construction: it never writes, never
/// mutates corporate actions and never touches `.eod` files.
///
/// `window` is clamped to the native reader bound. `as_of_date` is inclusive.
///
/// Reads are genuinely bounded: at most `window + SCAN_PADDING_BARS` rows are
/// materialized, never the full history. See the in-function rationale for why the
/// truncated slice produces identical bars.
#[allow(clippy::too_many_arguments)]
pub fn read_scan_bars_for_folder(
    folder_path: &Path,
    connection: &Connection,
    requested_symbol: &str,
    requested_exchange: &str,
    as_of_date: Option<&str>,
    window: usize,
    adjusted: bool,
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
) -> Result<Vec<ScanPriceBar>, String> {
    let symbol = normalize_symbol(requested_symbol)?;
    let exchange = normalize_exchange(requested_exchange)?;
    let Some(context) = resolve_instrument_context(connection, &symbol, &exchange)? else {
        return Err(format!(
            "Target {exchange}:{symbol} has no resolvable instrument identity."
        ));
    };
    let from = "1900-01-01";
    let to = match as_of_date {
        Some(value) => normalize_optional_trade_date(Some(value))?.ok_or_else(|| {
            format!("Invalid as-of date for {exchange}:{symbol}.")
        })?,
        None => "2100-12-31".to_string(),
    };

    let bounded = window
        .min(crate::native_scanner::reader::MAX_WINDOW_BARS)
        .max(1);

    // Genuinely bounded read: at most `bounded + SCAN_PADDING_BARS` rows are
    // materialized, never the whole history.
    //
    // Correctness of the truncated slice, consumer by consumer:
    //
    // - `apply_corporate_adjustments` multiplies a row by the factors of actions whose
    //   `effective_date` is *after* that row. Those factors come from the corporate-action
    //   rows in `context` (read from the database, not from the price slice), so an action
    //   older than the slice still contributes its factor to every in-window row; it
    //   simply has no older rows left to rescale. Adjusted prices are never derived from
    //   neighbouring adjusted rows here.
    // - The dividend presence gate asks only whether *some* loaded row precedes the
    //   effective date. A dividend older than the slice is therefore skipped, which is
    //   equivalent: it would have had no in-window row to rescale either way.
    // - `recompute_prev_close` and `guard_index_previous_close` look back exactly one
    //   bar, which `SCAN_PADDING_BARS` supplies. The first window row still sees its real
    //   predecessor, so `prev_close` and the >7-day index break behave identically.
    // - Per-date identity/alias selection (`select_preferred_price_row`,
    //   `validate_index_alias_rows`, `validate_bse_code_rows`) does not depend on which
    //   older dates are present.
    //
    // The `p3_*` tests assert bounded and full reads agree bar-for-bar for the raw,
    // adjusted and binary paths rather than relying on this argument alone.
    let rows = load_unified_price_rows_bounded(
        folder_path,
        connection,
        &context,
        from,
        &to,
        bounded.saturating_add(SCAN_PADDING_BARS),
    )?;
    let rows = if adjusted {
        apply_corporate_adjustments(
            rows,
            &context.corporate_actions,
            include_dividend_adjustments,
            include_rights_adjustments,
        )?
    } else {
        rows
    };
    let rows = if exchange == "NSE_INDEX" {
        guard_index_previous_close(rows)
    } else {
        rows
    };

    let start = rows.len().saturating_sub(bounded);
    rows[start..].iter().map(scan_price_bar_from_row).collect()
}

fn scan_price_bar_from_row(row: &PriceRow) -> AppResult<ScanPriceBar> {
    let date = date_to_u32(&row.date);
    if date == 0 {
        return Err(format!(
            "Invalid price row date for {}.",
            row.symbol
        ));
    }
    let finite = |value: f64, label: &str| -> AppResult<f64> {
        if !value.is_finite() {
            return Err(format!(
                "Non-finite {label} on {} for {}.",
                row.date, row.symbol
            ));
        }
        Ok(value)
    };
    let open = finite(row.open, "open")?;
    let high = finite(row.high, "high")?;
    let low = finite(row.low, "low")?;
    let close = finite(row.close, "close")?;
    if high < low {
        return Err(format!(
            "Price row on {} for {} has high < low.",
            row.date, row.symbol
        ));
    }
    let prev_close = match row.prev_close {
        Some(value) => Some(finite(value, "prev_close")?),
        None => None,
    };
    Ok(ScanPriceBar {
        date,
        open,
        high,
        low,
        close,
        prev_close,
        volume: row.volume.max(0) as f64,
        open_interest: row.open_interest.max(0) as f64,
    })
}

fn resolve_exact_instrument_context(
    connection: &Connection,
    requested_symbol: &str,
    exchange: &str,
) -> AppResult<Option<ResolvedInstrumentContext>> {
    let Some(requested_instrument) =
        find_instrument_record(connection, requested_symbol, exchange)?
    else {
        return Ok(None);
    };
    let isin = requested_instrument.isin.clone();
    let current_name = requested_instrument.name.clone();
    let related_symbols = vec![requested_symbol.to_string()];
    let corporate_actions =
        load_corporate_actions(connection, exchange, &related_symbols, isin.as_deref())?;

    Ok(Some(ResolvedInstrumentContext {
        requested_symbol: requested_symbol.to_string(),
        exchange: exchange.to_string(),
        current_symbol: requested_symbol.to_string(),
        current_name,
        isin,
        current_instrument: Some(requested_instrument),
        related_symbols,
        identity_history: Vec::new(),
        symbol_transitions: Vec::new(),
        corporate_actions,
        resolved_from_alias: false,
    }))
}

fn same_chart_settlement(exchange: &str, requested: &str, candidate: &str) -> bool {
    // BSE publishes T+0 as a separate '#' ticker with the T+1 security's ISIN.
    // Equal ISINs must not make those two trading histories interchangeable.
    exchange != "BSE" || requested.ends_with('#') == candidate.ends_with('#')
}

fn history_matches_chart_settlement(
    exchange: &str,
    requested: &str,
    row: &super::IdentityHistoryRow,
) -> bool {
    [&row.current_symbol, &row.old_symbol, &row.new_symbol]
        .into_iter()
        .flatten()
        .filter(|symbol| !symbol.is_empty())
        .all(|symbol| same_chart_settlement(exchange, requested, symbol))
}

pub(super) fn resolve_instrument_context(
    connection: &Connection,
    requested_symbol: &str,
    exchange: &str,
) -> AppResult<Option<ResolvedInstrumentContext>> {
    let requested_instrument = find_instrument_record(connection, requested_symbol, exchange)?;
    let alias_row = connection
        .query_row(
            "
              SELECT
                id,
                exchange,
                isin,
                current_symbol,
                current_name,
                old_symbol,
                old_name,
                new_symbol,
                new_name,
                effective_date,
                change_type
              FROM instrument_identity_history
              WHERE exchange = ?
                AND (
                  old_symbol = ?
                  OR new_symbol = ?
                  OR current_symbol = ?
                )
              ORDER BY effective_date DESC, id DESC
              LIMIT 1
            ",
            params![
                exchange,
                requested_symbol,
                requested_symbol,
                requested_symbol
            ],
            map_identity_history_row,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .filter(|row| history_matches_chart_settlement(exchange, requested_symbol, row));

    let current_symbol = alias_row
        .as_ref()
        .and_then(|row| row.current_symbol.clone())
        .or_else(|| alias_row.as_ref().and_then(|row| row.new_symbol.clone()))
        .or_else(|| requested_instrument.as_ref().map(|row| row.symbol.clone()))
        .unwrap_or_else(|| requested_symbol.to_string());
    let current_instrument = find_instrument_record(connection, &current_symbol, exchange)?
        .or(requested_instrument.clone());
    let current_name = current_instrument
        .as_ref()
        .and_then(|row| row.name.clone())
        .or_else(|| alias_row.as_ref().and_then(|row| row.current_name.clone()))
        .or_else(|| alias_row.as_ref().and_then(|row| row.new_name.clone()))
        .or_else(|| alias_row.as_ref().and_then(|row| row.old_name.clone()))
        .or_else(|| {
            requested_instrument
                .as_ref()
                .and_then(|row| row.name.clone())
        });
    let isin = current_instrument
        .as_ref()
        .and_then(|row| row.isin.clone())
        .or_else(|| alias_row.as_ref().and_then(|row| row.isin.clone()))
        .or_else(|| {
            requested_instrument
                .as_ref()
                .and_then(|row| row.isin.clone())
        });

    if current_instrument.is_none() && alias_row.is_none() {
        if exchange == "NSE_INDEX" && nse_index_alias_family(requested_symbol).is_some() {
            return resolve_index_alias_context(connection, requested_symbol, exchange);
        }
        return Ok(None);
    }

    let history_sql = if isin.is_some() {
        "
          SELECT
            id,
            exchange,
            isin,
            current_symbol,
            current_name,
            old_symbol,
            old_name,
            new_symbol,
            new_name,
            effective_date,
            change_type
          FROM instrument_identity_history
          WHERE exchange = ?
            AND (
              current_symbol = ?
              OR old_symbol = ?
              OR new_symbol = ?
              OR isin = ?
            )
          ORDER BY effective_date ASC, id ASC
        "
    } else {
        "
          SELECT
            id,
            exchange,
            isin,
            current_symbol,
            current_name,
            old_symbol,
            old_name,
            new_symbol,
            new_name,
            effective_date,
            change_type
          FROM instrument_identity_history
          WHERE exchange = ?
            AND (
              current_symbol = ?
              OR old_symbol = ?
              OR new_symbol = ?
            )
          ORDER BY effective_date ASC, id ASC
        "
    };
    let mut history_statement = connection
        .prepare(history_sql)
        .map_err(|error| error.to_string())?;
    let mut identity_history = if let Some(isin_value) = isin.clone() {
        history_statement
            .query_map(
                params![
                    exchange,
                    current_symbol,
                    requested_symbol,
                    requested_symbol,
                    isin_value
                ],
                map_identity_history_row,
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        history_statement
            .query_map(
                params![exchange, current_symbol, requested_symbol, requested_symbol],
                map_identity_history_row,
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    identity_history.retain(|row| {
        history_matches_chart_settlement(exchange, requested_symbol, row)
    });

    // Current ISIN lookup does not reach predecessors whose ISIN changed later.
    // Follow persisted ticker edges backwards without inferring any ISIN period.
    for predecessor in load_chart_predecessor_history(connection, exchange, &current_symbol)? {
        if !identity_history.iter().any(|row| row.id == predecessor.id) {
            identity_history.push(predecessor);
        }
    }
    identity_history.sort_by(|a, b| a.effective_date.cmp(&b.effective_date).then(a.id.cmp(&b.id)));
    let mut seen_rename_rows = HashSet::new();
    identity_history.retain(|row| {
        !matches!(row.change_type.as_str(), "SYMBOL_CHANGE" | "BOTH") ||
            seen_rename_rows.insert((row.exchange.clone(), row.isin.clone(),
                row.current_symbol.clone(), row.old_symbol.clone(), row.new_symbol.clone(),
                row.effective_date.clone(), row.change_type.clone()))
    });

    let mut related_symbols = HashSet::from([requested_symbol.to_string(), current_symbol.clone()]);
    if let Some(instrument) = current_instrument.as_ref() {
        related_symbols.insert(instrument.symbol.clone());
    }
    for row in &identity_history {
        for value in [&row.current_symbol, &row.old_symbol, &row.new_symbol] {
            if let Some(symbol) = value {
                related_symbols.insert(symbol.clone());
            }
        }
    }

    if let Some(isin_value) = isin.clone() {
        let mut same_isin_statement = connection
            .prepare(
                "
                  SELECT symbol
                  FROM instruments
                  WHERE exchange = ?
                    AND isin = ?
                ",
            )
            .map_err(|error| error.to_string())?;
        let same_isin_rows = same_isin_statement
            .query_map(params![exchange, isin_value], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        for symbol in same_isin_rows {
            if same_chart_settlement(exchange, requested_symbol, &symbol) {
                related_symbols.insert(symbol);
            }
        }
    }

    let mut symbol_transitions = identity_history
        .iter()
        .filter(|row| row.change_type == "SYMBOL_CHANGE" || row.change_type == "BOTH")
        .map(|row| SymbolTransition {
            effective_date: row.effective_date.clone(),
            old_symbol: row.old_symbol.clone(),
            new_symbol: row
                .new_symbol
                .clone()
                .or_else(|| row.current_symbol.clone()),
        })
        .collect::<Vec<_>>();
    symbol_transitions.sort_by(|left, right| left.effective_date.cmp(&right.effective_date));

    let related_symbols = related_symbols.into_iter().collect::<Vec<_>>();
    let corporate_actions =
        load_corporate_actions(connection, exchange, &related_symbols, isin.as_deref())?;

    let context = ResolvedInstrumentContext {
        requested_symbol: requested_symbol.to_string(),
        exchange: exchange.to_string(),
        current_symbol: current_symbol.clone(),
        current_name,
        isin,
        current_instrument,
        related_symbols,
        identity_history,
        symbol_transitions,
        corporate_actions,
        resolved_from_alias: requested_symbol != current_symbol
            || alias_row
                .as_ref()
                .and_then(|row| row.old_symbol.clone())
                .as_deref()
                == Some(requested_symbol),
    };
    let context = bse_code_history::augment_bse_code_context(connection, context)?;
    Ok(Some(augment_index_alias_context(connection, context)?))
}

fn load_chart_predecessor_history(
    connection: &Connection,
    exchange: &str,
    current_symbol: &str,
) -> AppResult<Vec<super::IdentityHistoryRow>> {
    let mut history = Vec::new();
    let mut symbol = current_symbol.to_string();
    let mut visited = HashSet::from([symbol.clone()]);
    let mut later_date: Option<String> = None;
    let mut statement = connection.prepare(
        "SELECT MIN(id), exchange, isin, current_symbol, current_name, old_symbol,
                old_name, new_symbol, new_name, effective_date, change_type
         FROM instrument_identity_history
         WHERE exchange = ? AND new_symbol = ?
           AND change_type IN ('SYMBOL_CHANGE', 'BOTH')
         GROUP BY exchange, isin, current_symbol, old_symbol, new_symbol, effective_date, change_type
         ORDER BY effective_date, MIN(id) LIMIT 2"
    ).map_err(|error| error.to_string())?;
    loop {
        let edges = statement.query_map(params![exchange, symbol], map_identity_history_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?
            .into_iter()
            .filter(|row| history_matches_chart_settlement(exchange, current_symbol, row))
            .collect::<Vec<_>>();
        if edges.is_empty() {
            return Ok(history);
        }
        if edges.len() != 1 {
            return Err(format!("Ambiguous chart predecessor history for {exchange}:{symbol}."));
        }
        if history.len() == 32 {
            return Err("Chart predecessor history exceeds 32 transitions.".to_string());
        }
        let edge = edges.into_iter().next().unwrap();
        let predecessor = edge.old_symbol.as_deref().filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Chart predecessor history has no old symbol.".to_string())?;
        if !visited.insert(predecessor.to_string()) {
            return Err("Chart predecessor history contains a cycle.".to_string());
        }
        if later_date.as_deref().is_some_and(|date| edge.effective_date.as_str() >= date) {
            return Err("Chart predecessor dates must increase along the rename chain.".to_string());
        }
        symbol = predecessor.to_string();
        later_date = Some(edge.effective_date.clone());
        history.push(edge);
    }
}

fn load_corporate_actions(
    connection: &Connection,
    exchange: &str,
    related_symbols: &[String],
    isin: Option<&str>,
) -> AppResult<Vec<CorporateActionRow>> {
    if related_symbols.is_empty() && isin.is_none() {
        return Ok(Vec::new());
    }

    // Resolve each identity branch through its existing index. A combined
    // symbol/ISIN OR can otherwise scan every action in the exchange when
    // planner statistics are absent. UNION also keeps overlapping aliases unique.
    let mut matches = Vec::new();
    let mut values = vec![Value::Text(exchange.to_string())];
    if !related_symbols.is_empty() {
        matches.push(format!(
            "SELECT id FROM corporate_actions WHERE exchange = ? AND symbol IN ({})",
            question_marks(related_symbols.len())
        ));
        values.push(Value::Text(exchange.to_string()));
        values.extend(
            related_symbols
                .iter()
                .cloned()
                .map(Value::Text)
                .collect::<Vec<_>>(),
        );
    }
    if let Some(isin_value) = isin {
        matches.push("SELECT id FROM corporate_actions WHERE isin = ?".to_string());
        values.push(Value::Text(isin_value.to_string()));
    }

    let sql = format!(
        "
          SELECT
            id,
            effective_date,
            action_type,
            factor,
            adjust_volume,
            ratio_num,
            ratio_den,
            old_face_value,
            new_face_value,
            cash_amount,
            source
          FROM corporate_actions NOT INDEXED
          WHERE exchange = ?
            AND id IN ({})
            AND action_type IN ('SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS', 'DEMERGER')
          ORDER BY effective_date ASC, id ASC
        ",
        matches.join(" UNION ")
    );

    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let actions = statement
        .query_map(params_from_iter(values), |row| {
            Ok(CorporateActionRow {
                id: row.get(0)?,
                effective_date: row.get(1)?,
                action_type: row.get(2)?,
                factor: row.get(3)?,
                adjust_volume: row.get(4)?,
                ratio_num: row.get(5)?,
                ratio_den: row.get(6)?,
                old_face_value: row.get(7)?,
                new_face_value: row.get(8)?,
                cash_amount: row.get(9)?,
                source: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(actions)
}

pub(super) fn load_unified_price_rows(
    folder_path: &Path,
    connection: &Connection,
    context: &ResolvedInstrumentContext,
    from: &str,
    to: &str,
) -> AppResult<Vec<PriceRow>> {
    let storage_mode = get_price_storage_mode(connection);
    load_unified_price_rows_with_mode(folder_path, connection, context, from, to, storage_mode)
}

/// Loads at most `limit` rows (the newest within `from..=to`) instead of the whole
/// history, then runs exactly the same merge/validation pipeline as the unbounded loader.
///
/// Bounding is per related symbol: each `.eod` file and each SQLite symbol contributes at
/// most `limit` rows. Identity/alias resolution still runs over whatever was read, and
/// `prev_close` is recomputed across the slice, so the newest rows are byte-identical to
/// an unbounded read of the same dates.
pub(super) fn load_unified_price_rows_bounded(
    folder_path: &Path,
    connection: &Connection,
    context: &ResolvedInstrumentContext,
    from: &str,
    to: &str,
    limit: usize,
) -> AppResult<Vec<PriceRow>> {
    let storage_mode = get_price_storage_mode(connection);
    let mut raw_rows = Vec::new();
    let from_u32 = date_to_u32(from);
    let to_u32 = date_to_u32(to);
    let limit = limit.max(1);

    for symbol in &context.related_symbols {
        if !same_chart_settlement(&context.exchange, &context.current_symbol, symbol) {
            continue;
        }
        let bin_path = super::storage_paths::eod_path(folder_path, &context.exchange, symbol)?;
        if bin_path.exists() {
            let bin_file = BinaryEodFile::open(&bin_path)?;
            if context.exchange == "BSE"
                && bse_code_history::is_security_code(symbol)
                && (bin_file.header.symbol != *symbol
                    || bin_file.header.exchange != "BSE"
                    || bin_file.header.price_scale == 0)
            {
                return Err(format!(
                    "BSE security-code file identity/scale mismatch: {symbol}"
                ));
            }
            // Seeks to the newest `limit` records instead of decoding the whole file.
            let records = bin_file.read_range_bounded(from_u32, to_u32, limit)?;
            for r in records {
                raw_rows.push(eod_record_to_price_row(
                    &r,
                    symbol,
                    bin_file.header.price_scale,
                ));
            }
        } else if storage_mode == PriceStorageMode::Hybrid {
            let mut statement = connection
                .prepare(
                    "
                      SELECT
                        symbol,
                        date,
                        open,
                        high,
                        low,
                        close,
                        prev_close,
                        volume,
                        open_interest
                      FROM eod_prices
                      WHERE exchange = ?
                        AND symbol = ?
                        AND date BETWEEN ? AND ?
                      ORDER BY date DESC
                      LIMIT ?
                    ",
                )
                .map_err(|error| error.to_string())?;
            let sql_rows = statement
                .query_map(
                    params![context.exchange, symbol, from, to, limit as i64],
                    |row| {
                        Ok(PriceRow {
                            symbol: row.get(0)?,
                            date: row.get(1)?,
                            open: row.get(2)?,
                            high: row.get(3)?,
                            low: row.get(4)?,
                            close: row.get(5)?,
                            prev_close: row.get(6)?,
                            volume: row.get(7)?,
                            open_interest: row.get(8).unwrap_or(0),
                        })
                    },
                )
                .map_err(|error| error.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| error.to_string())?;
            raw_rows.extend(sql_rows);
        }
    }

    let mut by_date = HashMap::<String, Vec<PriceRow>>::new();
    for row in raw_rows {
        by_date.entry(row.date.clone()).or_default().push(row);
    }

    let mut rows = by_date.into_iter().collect::<Vec<_>>();
    rows.sort_by(|left, right| left.0.cmp(&right.0));
    let merged = rows
        .into_iter()
        .map(|(date, rows)| {
            validate_index_alias_rows(&date, &rows, context)?;
            bse_code_history::validate_bse_code_rows(&date, &rows, context)?;
            Ok(select_preferred_price_row(&date, &rows, context))
        })
        .collect::<AppResult<Vec<_>>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    let merged = recompute_prev_close(merged);
    Ok(if context.exchange == "NSE_INDEX" {
        guard_index_previous_close(merged)
    } else {
        merged
    })
}

pub(super) fn load_unified_price_rows_with_mode(
    folder_path: &Path,
    connection: &Connection,
    context: &ResolvedInstrumentContext,
    from: &str,
    to: &str,
    storage_mode: PriceStorageMode,
) -> AppResult<Vec<PriceRow>> {
    let mut raw_rows = Vec::new();
    let from_u32 = date_to_u32(from);
    let to_u32 = date_to_u32(to);

    for symbol in &context.related_symbols {
        if !same_chart_settlement(&context.exchange, &context.current_symbol, symbol) {
            continue;
        }
        let bin_path = super::storage_paths::eod_path(folder_path, &context.exchange, symbol)?;
        if bin_path.exists() {
            let bin_file = BinaryEodFile::open(&bin_path)?;
            if context.exchange == "BSE" && bse_code_history::is_security_code(symbol)
                && (bin_file.header.symbol != *symbol || bin_file.header.exchange != "BSE" || bin_file.header.price_scale == 0)
            {
                return Err(format!("BSE security-code file identity/scale mismatch: {symbol}"));
            }
            let records = bin_file.read_range(from_u32, to_u32)?;
            for r in records {
                raw_rows.push(eod_record_to_price_row(
                    &r,
                    symbol,
                    bin_file.header.price_scale,
                ));
            }
        } else if storage_mode == PriceStorageMode::Hybrid {
            // Fallback to SQLite for this symbol in Hybrid mode
            let mut statement = connection
                .prepare(
                    "
                      SELECT
                        symbol,
                        date,
                        open,
                        high,
                        low,
                        close,
                        prev_close,
                        volume,
                        open_interest
                      FROM eod_prices
                      WHERE exchange = ?
                        AND symbol = ?
                        AND date BETWEEN ? AND ?
                      ORDER BY date ASC
                    ",
                )
                .map_err(|error| error.to_string())?;
            let sql_rows = statement
                .query_map(params![context.exchange, symbol, from, to], |row| {
                    Ok(PriceRow {
                        symbol: row.get(0)?,
                        date: row.get(1)?,
                        open: row.get(2)?,
                        high: row.get(3)?,
                        low: row.get(4)?,
                        close: row.get(5)?,
                        prev_close: row.get(6)?,
                        volume: row.get(7)?,
                        open_interest: row.get(8).unwrap_or(0),
                    })
                })
                .map_err(|error| error.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| error.to_string())?;
            raw_rows.extend(sql_rows);
        }
    }

    let mut by_date = HashMap::<String, Vec<PriceRow>>::new();
    for row in raw_rows {
        by_date.entry(row.date.clone()).or_default().push(row);
    }

    let mut rows = by_date.into_iter().collect::<Vec<_>>();
    rows.sort_by(|left, right| left.0.cmp(&right.0));
    let merged = rows
        .into_iter()
        .map(|(date, rows)| {
            validate_index_alias_rows(&date, &rows, context)?;
            bse_code_history::validate_bse_code_rows(&date, &rows, context)?;
            Ok(select_preferred_price_row(&date, &rows, context))
        })
        .collect::<AppResult<Vec<_>>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    let merged = recompute_prev_close(merged);
    Ok(if context.exchange == "NSE_INDEX" {
        guard_index_previous_close(merged)
    } else {
        merged
    })
}

fn eod_record_to_price_row(r: &EodRecord, symbol: &str, scale: u32) -> PriceRow {
    PriceRow {
        symbol: symbol.to_string(),
        date: u32_to_date(r.date),
        open: r.open as f64 / scale as f64,
        high: r.high as f64 / scale as f64,
        low: r.low as f64 / scale as f64,
        close: r.close as f64 / scale as f64,
        prev_close: Some(r.prev_close as f64 / scale as f64),
        volume: r.volume as i64,
        open_interest: r.oi as i64,
    }
}

fn select_preferred_price_row(
    date: &str,
    rows: &[PriceRow],
    context: &ResolvedInstrumentContext,
) -> Option<PriceRow> {
    if rows.is_empty() {
        return None;
    }
    let expected_symbol = get_expected_symbol_for_date(context, date);
    if let Some(row) = rows.iter().find(|row| row.symbol == expected_symbol) {
        return Some(row.clone());
    }
    if let Some(row) = rows.iter().find(|row| row.symbol == context.current_symbol) {
        return Some(row.clone());
    }

    rows.iter().cloned().max_by(|left, right| {
        left.volume
            .cmp(&right.volume)
            .then_with(|| right.symbol.cmp(&left.symbol))
    })
}

fn get_expected_symbol_for_date(context: &ResolvedInstrumentContext, date: &str) -> String {
    if context.symbol_transitions.is_empty() {
        return context.current_symbol.clone();
    }

    let mut active_symbol = context
        .symbol_transitions
        .first()
        .and_then(|transition| {
            transition
                .old_symbol
                .clone()
                .or_else(|| transition.new_symbol.clone())
        })
        .unwrap_or_else(|| context.current_symbol.clone());

    for transition in &context.symbol_transitions {
        if date < transition.effective_date.as_str() {
            return active_symbol;
        }
        if let Some(new_symbol) = transition.new_symbol.clone() {
            active_symbol = new_symbol;
        }
    }

    active_symbol
}

pub(super) fn apply_corporate_adjustments(
    rows: Vec<PriceRow>,
    actions: &[CorporateActionRow],
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
) -> AppResult<Vec<PriceRow>> {
    let readable_actions = build_readable_adjustment_actions(
        &rows,
        actions,
        include_dividend_adjustments,
        include_rights_adjustments,
    )?;
    if readable_actions.is_empty() {
        return Ok(recompute_prev_close(rows));
    }

    let adjusted_rows = rows
        .into_iter()
        .map(|row| {
            let mut price_factor = 1.0;
            let mut volume_factor = 1.0;
            for action in &readable_actions {
                if row.date < action.effective_date {
                    price_factor *= action.factor;
                    if action.adjust_volume == 1 {
                        volume_factor *= action.factor;
                    }
                }
            }

            if price_factor == 1.0 && volume_factor == 1.0 {
                return row;
            }

            PriceRow {
                open: round_price(row.open / price_factor),
                high: round_price(row.high / price_factor),
                low: round_price(row.low / price_factor),
                close: round_price(row.close / price_factor),
                prev_close: row
                    .prev_close
                    .map(|value| round_price(value / price_factor)),
                volume: ((row.volume as f64) * volume_factor).round().max(0.0) as i64,
                open_interest: ((row.open_interest as f64) * volume_factor)
                    .round()
                    .max(0.0) as i64,
                ..row
            }
        })
        .collect::<Vec<_>>();
    Ok(recompute_prev_close(adjusted_rows))
}

fn build_readable_adjustment_actions(
    rows: &[PriceRow],
    actions: &[CorporateActionRow],
    include_dividend_adjustments: bool,
    include_rights_adjustments: bool,
) -> AppResult<Vec<CorporateActionRow>> {
    let filtered_actions = actions
        .iter()
        .filter(|action| {
            if action.source.as_deref() == Some("LEGACY_MUTATED") {
                return false;
            }
            match action.action_type.as_str() {
                "SPLIT" | "BONUS" | "DEMERGER" => true,
                "DIVIDEND" => include_dividend_adjustments,
                "RIGHTS" => include_rights_adjustments,
                _ => false,
            }
        })
        .cloned()
        .collect::<Vec<_>>();

    let mut readable_actions = Vec::new();
    let mut dividends_by_date: HashMap<String, Vec<CorporateActionRow>> = HashMap::new();
    for action in filtered_actions {
        if action.action_type == "DIVIDEND" {
            dividends_by_date
                .entry(action.effective_date.clone())
                .or_default()
                .push(action);
        } else {
            readable_actions.push(action);
        }
    }

    for (effective_date, dividend_actions) in dividends_by_date {
        if !rows.iter().any(|row| row.date < effective_date) {
            continue;
        }

        // Approval recorded F = P / (P - D) against the actual cum-date close.
        // Sum D/P = 1 - 1/F for same-day components, rather than deriving a new
        // basis from whichever bars happen to be in a chart/export date range.
        let mut total_price_reduction = 0.0;
        let total_cash = dividend_actions.iter().try_fold(0.0, |total, action| {
            let cash = action.cash_amount.ok_or_else(|| {
                format!(
                    "Dividend adjustment on {effective_date} is missing a cash amount per share."
                )
            })?;
            if !cash.is_finite() || cash <= 0.0 {
                return Err(format!(
                    "Dividend adjustment on {effective_date} requires positive cash amounts."
                ));
            }
            if !action.factor.is_finite() || action.factor <= 1.0 {
                return Err(format!(
                    "Dividend adjustment on {effective_date} requires a valid recorded factor."
                ));
            }
            total_price_reduction += 1.0 - 1.0 / action.factor;
            Ok(total + cash)
        })?;
        if !total_cash.is_finite() || !total_price_reduction.is_finite()
            || total_price_reduction <= 0.0 || total_price_reduction >= 1.0 {
            return Err(format!(
                "Combined dividend cash on {effective_date} must be positive and smaller than the local previous close."
            ));
        }

        let mut combined_action = dividend_actions[0].clone();
        combined_action.cash_amount = Some(total_cash);
        combined_action.factor = 1.0 / (1.0 - total_price_reduction);
        combined_action.adjust_volume = 0;
        readable_actions.push(combined_action);
    }

    Ok(readable_actions)
}

fn recompute_prev_close(rows: Vec<PriceRow>) -> Vec<PriceRow> {
    let mut previous_close = None;
    rows.into_iter()
        .map(|row| {
            let next_row = PriceRow {
                prev_close: previous_close,
                ..row
            };
            previous_close = Some(next_row.close);
            next_row
        })
        .collect()
}

pub(super) fn build_chart_events(
    context: &ResolvedInstrumentContext,
    from: &str,
    to: &str,
) -> Vec<ChartEventRecord> {
    let mut events = Vec::new();

    for action in &context.corporate_actions {
        if action.effective_date.as_str() < from || action.effective_date.as_str() > to {
            continue;
        }
        let ratio_text = if let (Some(num), Some(den)) = (action.ratio_num, action.ratio_den) {
            Some(format!(
                "{}:{}",
                trim_numeric_string(num),
                trim_numeric_string(den)
            ))
        } else {
            None
        };
        let face_value_text = if let (Some(old_value), Some(new_value)) =
            (action.old_face_value, action.new_face_value)
        {
            format!(
                " | FV {} -> {}",
                trim_numeric_string(old_value),
                trim_numeric_string(new_value)
            )
        } else {
            String::new()
        };
        let event_type = action.action_type.clone();
        let cash_text = action
            .cash_amount
            .map(|value| format!(" Rs {}", trim_numeric_string(value)))
            .unwrap_or_default();
        let (label, description) = match event_type.as_str() {
            "SPLIT" => (
                "S",
                format!(
                    "Split{}{}",
                    ratio_text
                        .as_ref()
                        .map(|value| format!(" {value}"))
                        .unwrap_or_default(),
                    face_value_text
                ),
            ),
            "BONUS" => (
                "B",
                format!(
                    "Bonus{}",
                    ratio_text
                        .as_ref()
                        .map(|value| format!(" {value}"))
                        .unwrap_or_default()
                ),
            ),
            "DIVIDEND" => ("D", format!("Dividend{}", cash_text)),
            "RIGHTS" => (
                "R",
                format!(
                    "Rights{}{}",
                    ratio_text
                        .as_ref()
                        .map(|value| format!(" {value}"))
                        .unwrap_or_default(),
                    if cash_text.is_empty() {
                        String::new()
                    } else {
                        format!(" @{}", cash_text)
                    }
                ),
            ),
            _ => continue,
        };
        events.push(ChartEventRecord {
            id: format!("corp-{}", action.id),
            effective_date: action.effective_date.clone(),
            event_type,
            label: label.to_string(),
            description,
        });
    }

    for change in &context.identity_history {
        if change.effective_date.as_str() < from || change.effective_date.as_str() > to {
            continue;
        }
        if change.change_type == "NAME_CHANGE" || change.change_type == "BOTH" {
            events.push(ChartEventRecord {
                id: format!("name-{}", change.id),
                effective_date: change.effective_date.clone(),
                event_type: "NAME_CHANGE".to_string(),
                label: "N".to_string(),
                description: format!(
                    "Name change: {} -> {}",
                    change
                        .old_name
                        .clone()
                        .unwrap_or_else(|| "Unknown".to_string()),
                    change
                        .new_name
                        .clone()
                        .or_else(|| change.current_name.clone())
                        .unwrap_or_else(|| "Unknown".to_string())
                ),
            });
        }
        if change.change_type == "SYMBOL_CHANGE" || change.change_type == "BOTH" {
            events.push(ChartEventRecord {
                id: format!("symbol-{}", change.id),
                effective_date: change.effective_date.clone(),
                event_type: "SYMBOL_CHANGE".to_string(),
                label: "T".to_string(),
                description: format!(
                    "Ticker change: {} -> {}",
                    change
                        .old_symbol
                        .clone()
                        .unwrap_or_else(|| "Unknown".to_string()),
                    change
                        .new_symbol
                        .clone()
                        .or_else(|| change.current_symbol.clone())
                        .unwrap_or_else(|| "Unknown".to_string())
                ),
            });
        }
    }

    events.sort_by(|left, right| {
        left.effective_date
            .cmp(&right.effective_date)
            .then_with(|| left.label.cmp(&right.label))
    });
    events
}

pub(super) fn find_instrument_record(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<Option<InstrumentRecord>> {
    connection
        .query_row(
            "
              SELECT symbol, exchange, isin, name, series, COALESCE(is_active, 1), sector, industry
              FROM instruments
              WHERE symbol = ? AND exchange = ?
            ",
            params![symbol, exchange],
            |row| {
                Ok(InstrumentRecord {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    isin: row.get(2)?,
                    name: row.get(3)?,
                    series: row.get(4)?,
                    is_active: row.get::<_, i64>(5)? != 0,
                    lifecycle_status: None,
                    last_price_date: None,
                    exchange_latest_price_date: None,
                    sector: row.get(6)?,
                    industry: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::set_price_storage_mode;
    use rusqlite::params;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn corporate_action_lookup_preserves_alias_isin_union_and_order() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(
            "CREATE TABLE corporate_actions (
                id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, isin TEXT,
                effective_date TEXT, action_type TEXT, factor REAL DEFAULT 2,
                adjust_volume INTEGER DEFAULT 1, ratio_num REAL, ratio_den REAL,
                old_face_value REAL, new_face_value REAL, cash_amount REAL, source TEXT
             );
             CREATE INDEX lookup_symbol ON corporate_actions(exchange,symbol,effective_date);
             CREATE INDEX lookup_isin ON corporate_actions(isin,effective_date);
             INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,action_type) VALUES
                (1,'OLD','NSE','MATCH','2026-08-01','SPLIT'),
                (2,'NEW','NSE','MATCH','2026-08-01','BONUS'),
                (3,'ALIAS','NSE','OTHER','2026-08-02','DIVIDEND'),
                (4,'NEW','BSE','MATCH','2026-08-01','SPLIT'),
                (5,'OTHER','NSE','OTHER','2026-08-01','BONUS'),
                (6,'NEW','NSE','MATCH','2026-08-01','OTHER'),
                (7,'RENAMED','NSE','MATCH','2026-07-01','RIGHTS'),
                (8,'UNLISTED','NSE','','2026-06-01','DEMERGER');"
        ).unwrap();
        let ids = |symbols: &[&str], isin: Option<&str>, exchange: &str| {
            load_corporate_actions(&connection, exchange,
                &symbols.iter().map(|s| s.to_string()).collect::<Vec<_>>(), isin)
                .unwrap().into_iter().map(|action| action.id).collect::<Vec<_>>()
        };
        assert_eq!(ids(&["NEW","ALIAS","NEW"],Some("MATCH"),"NSE"),vec![7,1,2,3]);
        assert_eq!(ids(&["ALIAS"],None,"NSE"),vec![3]);
        assert_eq!(ids(&[],Some("MATCH"),"NSE"),vec![7,1,2]);
        assert!(ids(&[],None,"NSE").is_empty());
        assert_eq!(ids(&["NEW"],Some("MATCH"),"BSE"),vec![4]);
        assert_eq!(ids(&[],Some(""),"NSE"),vec![8]);
    }

    fn chart_rename_chain_db() -> Connection {
        let connection = setup_test_db();
        connection.execute_batch(
            "ALTER TABLE instruments ADD COLUMN isin TEXT;
             ALTER TABLE instruments ADD COLUMN series TEXT;
             ALTER TABLE instruments ADD COLUMN is_active INTEGER;
             ALTER TABLE instruments ADD COLUMN sector TEXT;
             ALTER TABLE instruments ADD COLUMN industry TEXT;
             CREATE TABLE instrument_identity_history (
               id INTEGER PRIMARY KEY, exchange TEXT, isin TEXT, current_symbol TEXT,
               current_name TEXT, old_symbol TEXT, old_name TEXT, new_symbol TEXT,
               new_name TEXT, effective_date TEXT, change_type TEXT);
             CREATE TABLE corporate_actions (
               id INTEGER PRIMARY KEY, symbol TEXT, exchange TEXT, isin TEXT,
               effective_date TEXT, action_type TEXT, factor REAL, adjust_volume INTEGER,
               ratio_num REAL, ratio_den REAL, old_face_value REAL, new_face_value REAL,
               cash_amount REAL, source TEXT);
             INSERT INTO instruments(symbol,exchange,isin,is_active) VALUES
               ('WEIZFOREX','NSE','OLDISIN',0), ('EBIXFOREX','NSE',NULL,0),
               ('DELPHIFX','NSE','NEWISIN',1);
             INSERT INTO instrument_identity_history
               (id,exchange,isin,current_symbol,old_symbol,new_symbol,effective_date,change_type)
             VALUES (1,'NSE',NULL,'EBIXFOREX','WEIZFOREX','EBIXFOREX','2020-03-20','SYMBOL_CHANGE'),
               (2,'NSE','NEWISIN','DELPHIFX','EBIXFOREX','DELPHIFX','2021-09-01','BOTH'),
               (3,'BSE',NULL,'WEIZFOREX','UNRELATED','WEIZFOREX','2010-01-01','SYMBOL_CHANGE');"
        ).unwrap();
        connection
    }

    fn bse_settlement_db() -> Connection {
        let connection = chart_rename_chain_db();
        connection.execute_batch(
            "INSERT INTO instruments(symbol,exchange,isin,is_active) VALUES
               ('OLDTCS','BSE','TCSISIN',0), ('TCS','BSE','TCSISIN',1),
               ('OLDTCS#','BSE','TCSISIN',0), ('TCS#','BSE','TCSISIN',1);
             INSERT INTO instrument_identity_history
               (id,exchange,isin,current_symbol,old_symbol,new_symbol,effective_date,change_type)
             VALUES (10,'BSE','TCSISIN','TCS','OLDTCS','TCS','2025-08-01','SYMBOL_CHANGE'),
               (11,'BSE','TCSISIN','TCS#','OLDTCS#','TCS#','2025-08-01','SYMBOL_CHANGE');"
        ).unwrap();
        connection
    }

    #[test]
    fn bse_settlement_binary_charts_preserve_same_cycle_renames_without_cross_fill() {
        let connection = bse_settlement_db();
        let dir = tempdir().unwrap();
        let binary_dir = dir.path().join("eod_data").join("BSE");
        fs::create_dir_all(&binary_dir).unwrap();
        for (symbol, data) in [
            ("OLDTCS", vec![(20250731, 3100.0, 100)]),
            ("TCS", vec![(20250811, 3040.35, 82049), (20261023, 2528.0, 200)]),
            ("OLDTCS#", vec![(20250731, 3090.0, 1)]),
            ("TCS#", vec![(20250811, 3040.35, 1), (20250812, 3050.0, 2)]),
        ] {
            let mut records = data.into_iter().map(|(date, close, volume)| EodRecord {
                date, flags: 0, open: (close * 10000.0) as i64,
                high: (close * 10000.0) as i64, low: (close * 10000.0) as i64,
                close: (close * 10000.0) as i64, prev_close: 0, volume, oi: 0,
            }).collect::<Vec<_>>();
            BinaryEodFile::write_all(
                binary_dir.join(format!("{symbol}.eod")), symbol, "BSE", 10000, &mut records,
            ).unwrap();
        }
        for mode in [PriceStorageMode::Binary, PriceStorageMode::Hybrid] {
            set_price_storage_mode(&connection, mode).unwrap();
            for (symbol, expected_symbols, expected_dates, expected_volumes) in [
                ("TCS", vec!["OLDTCS", "TCS"],
                 vec!["2025-07-31", "2025-08-11", "2026-10-23"], vec![100, 82049, 200]),
                ("TCS#", vec!["OLDTCS#", "TCS#"],
                 vec!["2025-07-31", "2025-08-11", "2025-08-12"], vec![1, 1, 2]),
            ] {
                let context = resolve_instrument_context(&connection, symbol, "BSE").unwrap().unwrap();
                let mut related = context.related_symbols.clone();
                related.sort();
                assert_eq!(related, expected_symbols);
                assert_eq!(context.symbol_transitions.len(), 1);
                assert_eq!(get_expected_symbol_for_date(&context, "2025-07-31"), expected_symbols[0]);
                let rows = load_unified_price_rows(
                    dir.path(), &connection, &context, "1900-01-01", "2100-01-01",
                ).unwrap();
                assert_eq!(rows.iter().map(|row| row.date.as_str()).collect::<Vec<_>>(), expected_dates);
                assert_eq!(rows.iter().map(|row| row.volume).collect::<Vec<_>>(), expected_volumes);
            }
        }
    }

    #[test]
    fn bse_settlement_hybrid_loader_filters_opposite_cycle_in_supplied_context() {
        let connection = bse_settlement_db();
        set_price_storage_mode(&connection, PriceStorageMode::Hybrid).unwrap();
        connection.execute_batch(
            "INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume) VALUES
               ('TCS','BSE','2026-10-23',2500,2530,2490,2528,82049),
               ('TCS#','BSE','2025-08-11',3040,3040,3040,3040.35,1);"
        ).unwrap();
        let dir = tempdir().unwrap();
        for (symbol, opposite, expected_date, expected_volume) in [
            ("TCS", "TCS#", "2026-10-23", 82049),
            ("TCS#", "TCS", "2025-08-11", 1),
        ] {
            let mut context = resolve_instrument_context(&connection, symbol, "BSE").unwrap().unwrap();
            context.related_symbols.push(opposite.to_string());
            let rows = load_unified_price_rows(
                dir.path(), &connection, &context, "1900-01-01", "2100-01-01",
            ).unwrap();
            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].date, expected_date);
            assert_eq!(rows[0].volume, expected_volume);
        }
    }

    #[test]
    fn bse_settlement_cross_cycle_history_is_not_a_ticker_rename() {
        let connection = bse_settlement_db();
        connection.execute_batch(
            "INSERT INTO instrument_identity_history
               (id,exchange,isin,current_symbol,old_symbol,new_symbol,effective_date,change_type)
             VALUES (12,'BSE','TCSISIN','TCS#','TCS','TCS#','2026-01-01','SYMBOL_CHANGE');"
        ).unwrap();
        for symbol in ["TCS", "TCS#"] {
            let context = resolve_instrument_context(&connection, symbol, "BSE").unwrap().unwrap();
            assert_eq!(context.current_symbol, symbol);
            assert!(context.identity_history.iter().all(|row| row.id != 12));
            assert!(context.related_symbols.iter().all(|related| {
                related.ends_with('#') == symbol.ends_with('#')
            }));
        }
    }

    #[test]
    fn chart_rename_chain_routes_old_prices_and_existing_dividends_once() {
        let connection = chart_rename_chain_db();
        set_price_storage_mode(&connection, PriceStorageMode::Hybrid).unwrap();
        let events = [
            (10199, "2015-09-04", "2015-09-03", 245.4, 7.5),
            (9769, "2016-03-18", "2016-03-17", 188.15, 7.5),
            (8699, "2017-08-14", "2017-08-11", 707.85, 3.0),
            (7991, "2018-07-30", "2018-07-27", 538.8, 1.0),
        ];
        for (id, date, previous, close, cash) in events {
            connection.execute(
                "INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,
                 action_type,factor,adjust_volume,cash_amount,source)
                 VALUES (?,'EBIXFOREX','NSE','OLDISIN',?,'DIVIDEND',?,0,?,'NSE_API')",
                params![id, date, close / (close - cash), cash],
            ).unwrap();
            for trade_date in [previous, date] {
                connection.execute(
                    "INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume)
                     VALUES ('WEIZFOREX','NSE',?,?,?,?,?,100)",
                    params![trade_date, close, close, close, close],
                ).unwrap();
            }
        }
        let context = resolve_instrument_context(&connection, "DELPHIFX", "NSE").unwrap().unwrap();
        assert_eq!(context.current_symbol, "DELPHIFX");
        assert_eq!(context.isin.as_deref(), Some("NEWISIN"));
        let mut symbols = context.related_symbols.clone();
        symbols.sort();
        assert_eq!(symbols, vec!["DELPHIFX", "EBIXFOREX", "WEIZFOREX"]);
        assert_eq!(context.symbol_transitions.len(), 2);
        assert_eq!(get_expected_symbol_for_date(&context, "2015-09-03"), "WEIZFOREX");
        assert_eq!(get_expected_symbol_for_date(&context, "2020-03-20"), "EBIXFOREX");
        assert_eq!(get_expected_symbol_for_date(&context, "2021-09-01"), "DELPHIFX");
        assert_eq!(context.corporate_actions.len(), 4);
        let dir = tempdir().unwrap();
        let rows = load_unified_price_rows(dir.path(), &connection, &context, "1900-01-01", "2100-01-01").unwrap();
        assert_eq!(rows.len(), 8);
        let binary_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&binary_dir).unwrap();
        let path = binary_dir.join("WEIZFOREX.eod");
        let mut records = rows.iter().map(|row| EodRecord {
            date: date_to_u32(&row.date), flags: 0,
            open: (row.open * 10000.0).round() as i64,
            high: (row.high * 10000.0).round() as i64,
            low: (row.low * 10000.0).round() as i64,
            close: (row.close * 10000.0).round() as i64,
            prev_close: 0, volume: row.volume as u64, oi: 0,
        }).collect::<Vec<_>>();
        BinaryEodFile::write_all(&path, "WEIZFOREX", "NSE", 10000, &mut records).unwrap();
        let original_bytes = fs::read(&path).unwrap();
        set_price_storage_mode(&connection, PriceStorageMode::Binary).unwrap();
        let rows = load_unified_price_rows(dir.path(), &connection, &context, "1900-01-01", "2100-01-01").unwrap();
        assert_eq!(rows.len(), 8);
        let adjusted = apply_corporate_adjustments(rows.clone(), &context.corporate_actions, true, false).unwrap();
        for (raw, actual) in rows.iter().zip(&adjusted) {
            let product: f64 = context.corporate_actions.iter()
                .filter(|action| raw.date < action.effective_date).map(|action| action.factor).product();
            assert_eq!(actual.close, round_price(raw.close / product));
            assert_eq!(actual.volume, raw.volume);
        }
        let disabled = apply_corporate_adjustments(rows.clone(), &context.corporate_actions, false, false).unwrap();
        assert_eq!(disabled[0].close, rows[0].close);
        let exact = resolve_exact_instrument_context(&connection, "DELPHIFX", "NSE").unwrap().unwrap();
        assert_eq!(exact.related_symbols, vec!["DELPHIFX"]);
        assert!(exact.corporate_actions.is_empty());
        assert_eq!(fs::read(path).unwrap(), original_bytes);
    }

    #[test]
    fn chart_rename_chain_rejects_ambiguous_cyclic_and_unordered_history() {
        for (sql, reason) in [
            ("INSERT INTO instrument_identity_history SELECT 4,exchange,isin,current_symbol,current_name,'OTHER',old_name,new_symbol,new_name,effective_date,change_type FROM instrument_identity_history WHERE id=1", "Ambiguous"),
            ("UPDATE instrument_identity_history SET old_symbol='DELPHIFX' WHERE id=1", "cycle"),
            ("UPDATE instrument_identity_history SET effective_date='2022-01-01' WHERE id=1", "dates"),
        ] {
            let connection = chart_rename_chain_db();
            connection.execute_batch(sql).unwrap();
            let error = resolve_instrument_context(&connection, "DELPHIFX", "NSE").err().unwrap();
            assert!(error.contains(reason), "{error}");
        }
    }

    #[test]
    fn chart_rename_chain_duplicate_edges_preserve_evidence_and_expose_conflicts() {
        let connection = chart_rename_chain_db();
        for id in [4, 5, 6] {
            connection.execute("INSERT INTO instrument_identity_history
                SELECT ?,exchange,isin,current_symbol,current_name,old_symbol,old_name,new_symbol,new_name,effective_date,change_type
                FROM instrument_identity_history WHERE id=2", [id]).unwrap();
        }
        // Repeated ingestion may enrich descriptive names without changing the ticker edge.
        connection.execute("UPDATE instrument_identity_history SET old_name='Enriched company name' WHERE id=5", []).unwrap();
        connection.execute_batch("PRAGMA query_only=ON").unwrap();
        let context = resolve_instrument_context(&connection, "DELPHIFX", "NSE").unwrap().unwrap();
        assert_eq!(context.symbol_transitions.len(), 2);
        assert_eq!(context.identity_history.len(), 2);
        assert_eq!(connection.query_row("SELECT COUNT(*) FROM instrument_identity_history", [],
            |r| r.get::<_, i64>(0)).unwrap(), 6);
        connection.execute_batch("PRAGMA query_only=OFF").unwrap();
        // A later contradictory observation must not be hidden by LIMIT 2 duplicates.
        for mutation in ["old_symbol='OTHER'", "effective_date='2021-09-02'", "isin='OTHER'"] {
            connection.execute(&format!("UPDATE instrument_identity_history SET {mutation} WHERE id=6"), []).unwrap();
            let error = load_chart_predecessor_history(&connection, "NSE", "DELPHIFX").err().unwrap();
            assert!(error.contains("Ambiguous"), "{error}");
            connection.execute("DELETE FROM instrument_identity_history WHERE id=6", []).unwrap();
            connection.execute("INSERT INTO instrument_identity_history SELECT 6,exchange,isin,current_symbol,current_name,old_symbol,old_name,new_symbol,new_name,effective_date,change_type FROM instrument_identity_history WHERE id=2", []).unwrap();
        }
    }

    #[test]
    #[ignore = "Explicit read-only acceptance on a disposable online backup"]
    fn chart_rename_chain_chembondch_copy_acceptance() {
        let folder = std::path::PathBuf::from(std::env::var("CA_DUPLICATE_EDGE_AUDIT").unwrap());
        assert!(folder.is_absolute());
        assert_eq!(folder.file_name().unwrap(), "ca-duplicate-chart-edges-20261024");
        let connection = Connection::open_with_flags(folder.join("market-data.sqlite3"),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        connection.execute_batch("PRAGMA query_only=ON").unwrap();
        let count = || connection.query_row("SELECT COUNT(*) FROM instrument_identity_history WHERE exchange='NSE' AND old_symbol='CHEMBONDIN' AND new_symbol='CHEMBONDCH'", [], |r| r.get::<_, i64>(0)).unwrap();
        assert_eq!(count(), 2);
        let context = resolve_instrument_context(&connection, "CHEMBONDCH", "NSE").unwrap().unwrap();
        assert!(context.related_symbols.iter().any(|s| s == "CHEMBONDIN"));
        assert_eq!(context.symbol_transitions.iter().filter(|e| e.old_symbol.as_deref()==Some("CHEMBONDIN") && e.new_symbol.as_deref()==Some("CHEMBONDCH")).count(), 1);
        assert_eq!(count(), 2);
        println!("PASS CHEMBONDCH: two retained evidence rows, one logical chart transition; read-only resolution succeeds.");
    }

    #[test]
    fn chart_rename_chain_enforces_depth_bound() {
        let connection = chart_rename_chain_db();
        connection.execute("DELETE FROM instrument_identity_history", []).unwrap();
        for index in 0..33 {
            connection.execute(
                "INSERT INTO instrument_identity_history
                 (exchange,old_symbol,new_symbol,effective_date,change_type)
                 VALUES ('NSE',?,?,?,'SYMBOL_CHANGE')",
                params![format!("S{index}"), format!("S{}", index + 1), format!("{:04}-01-01", 1900 + index)],
            ).unwrap();
        }
        assert!(load_chart_predecessor_history(&connection, "NSE", "S33")
            .err().unwrap().contains("32 transitions"));
        assert_eq!(load_chart_predecessor_history(&connection, "NSE", "S32").unwrap().len(), 32);
    }

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE instruments (symbol TEXT, exchange TEXT, name TEXT, updated_at TEXT, PRIMARY KEY(symbol, exchange))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (
                symbol TEXT,
                exchange TEXT,
                date TEXT,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                prev_close REAL,
                volume INTEGER,
                open_interest INTEGER,
                PRIMARY KEY(symbol, exchange, date)
            )",
            [],
        )
        .unwrap();
        conn
    }

    fn phase5a_price_row(date: &str, close: f64) -> PriceRow {
        PriceRow {
            symbol: "TEST".to_string(),
            date: date.to_string(),
            open: close,
            high: close,
            low: close,
            close,
            prev_close: None,
            volume: 1_000,
            open_interest: 0,
        }
    }

    fn phase5a_dividend_action(id: i64, cash_amount: f64, factor: f64) -> CorporateActionRow {
        CorporateActionRow {
            id,
            effective_date: "2026-06-04".to_string(),
            action_type: "DIVIDEND".to_string(),
            factor,
            adjust_volume: 0,
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: Some(cash_amount),
            source: Some("TEST".to_string()),
        }
    }

    #[test]
    fn ca_stabilization_dividend_adjustments_are_independent_of_requested_range() {
        let rows = vec![
            phase5a_price_row("2026-06-01", 90.0),
            phase5a_price_row("2026-06-03", 100.0),
            phase5a_price_row("2026-06-04", 95.0),
        ];
        let actions = vec![phase5a_dividend_action(1, 5.0, 100.0 / 95.0)];
        let full = apply_corporate_adjustments(rows.clone(), &actions, true, false).unwrap();
        let historical = apply_corporate_adjustments(vec![rows[0].clone()], &actions, true, false).unwrap();
        assert_eq!(historical[0].close, 85.5);
        assert_eq!(historical[0].close, full[0].close);
        assert_eq!(historical[0].volume, rows[0].volume);

        let components = vec![
            phase5a_dividend_action(1, 3.0, 100.0 / 97.0),
            phase5a_dividend_action(2, 2.0, 100.0 / 98.0),
        ];
        let combined = apply_corporate_adjustments(vec![rows[0].clone()], &components, true, false).unwrap();
        assert_eq!(combined[0].close, full[0].close);
        let raw = apply_corporate_adjustments(rows.clone(), &actions, false, false).unwrap();
        assert_eq!(raw[0].close, 90.0);
    }

    #[test]
    fn phase5a_adjusted_chart_aggregates_same_day_dividend_cash() {
        let rows = vec![
            phase5a_price_row("2026-06-03", 100.0),
            phase5a_price_row("2026-06-04", 95.0),
        ];
        let actions = vec![
            phase5a_dividend_action(1, 3.0, 100.0 / 97.0),
            phase5a_dividend_action(2, 2.0, 100.0 / 98.0),
        ];

        let adjusted = apply_corporate_adjustments(rows, &actions, true, false).unwrap();

        assert_eq!(adjusted[0].close, 95.0);
        assert_eq!(adjusted[1].close, 95.0);
        assert_eq!(adjusted[1].prev_close, Some(95.0));
    }

    #[test]
    fn phase5a_adjusted_chart_rejects_invalid_combined_dividend_cash() {
        let rows = vec![
            phase5a_price_row("2026-06-03", 100.0),
            phase5a_price_row("2026-06-04", 1.0),
        ];
        let actions = vec![
            phase5a_dividend_action(1, 60.0, 2.5),
            phase5a_dividend_action(2, 50.0, 2.0),
        ];

        let error = apply_corporate_adjustments(rows, &actions, true, false).unwrap_err();

        assert!(error.contains("Combined dividend cash"));
    }

    fn phase1_split_action(id: i64, effective_date: &str, factor: f64) -> CorporateActionRow {
        CorporateActionRow {
            id,
            effective_date: effective_date.to_string(),
            action_type: "SPLIT".to_string(),
            factor,
            adjust_volume: 1,
            ratio_num: Some(factor),
            ratio_den: Some(1.0),
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            source: Some("TEST".to_string()),
        }
    }

    #[test]
    fn phase1_split_adjustment_preserves_real_plus_five_percent_ex_date_gap() {
        let rows = vec![
            PriceRow {
                symbol: "TEST".to_string(),
                date: "2026-08-13".to_string(),
                open: 98.0,
                high: 102.0,
                low: 97.0,
                close: 100.0,
                prev_close: None,
                volume: 1_000,
                open_interest: 200,
            },
            PriceRow {
                symbol: "TEST".to_string(),
                date: "2026-08-14".to_string(),
                open: 52.5,
                high: 54.0,
                low: 51.0,
                close: 53.0,
                prev_close: Some(100.0),
                volume: 2_400,
                open_interest: 450,
            },
        ];
        let adjusted = apply_corporate_adjustments(
            rows,
            &[phase1_split_action(1, "2026-08-14", 2.0)],
            false,
            false,
        )
        .unwrap();

        assert_eq!(adjusted[0].open, 49.0);
        assert_eq!(adjusted[0].high, 51.0);
        assert_eq!(adjusted[0].low, 48.5);
        assert_eq!(adjusted[0].close, 50.0);
        assert_eq!(adjusted[0].volume, 2_000);
        assert_eq!(adjusted[0].open_interest, 400);
        assert_eq!(adjusted[1].open, 52.5);
        assert_eq!(adjusted[1].close, 53.0);
        assert_eq!(adjusted[1].volume, 2_400);
        assert_eq!(adjusted[1].prev_close, Some(50.0));
        assert!(((adjusted[1].open / adjusted[0].close - 1.0) * 100.0 - 5.0).abs() < 1e-9);
    }

    #[test]
    fn phase1_split_adjustment_preserves_real_minus_five_percent_ex_date_gap() {
        let rows = vec![
            phase5a_price_row("2026-08-13", 100.0),
            PriceRow {
                open: 47.5,
                high: 49.0,
                low: 46.0,
                close: 48.0,
                ..phase5a_price_row("2026-08-14", 48.0)
            },
        ];
        let adjusted = apply_corporate_adjustments(
            rows,
            &[phase1_split_action(1, "2026-08-14", 2.0)],
            false,
            false,
        )
        .unwrap();

        assert_eq!(adjusted[0].close, 50.0);
        assert_eq!(adjusted[1].open, 47.5);
        assert_eq!(adjusted[1].prev_close, Some(50.0));
        assert!(((adjusted[1].open / adjusted[0].close - 1.0) * 100.0 + 5.0).abs() < 1e-9);
    }

    #[test]
    fn phase1_multiple_split_bonus_factors_accumulate_only_before_each_effective_date() {
        let rows = vec![
            phase5a_price_row("2020-01-01", 600.0),
            phase5a_price_row("2024-01-01", 400.0),
            phase5a_price_row("2026-08-14", 205.0),
        ];
        let mut bonus = phase1_split_action(1, "2022-01-01", 1.5);
        bonus.action_type = "BONUS".to_string();
        let split = phase1_split_action(2, "2026-08-14", 2.0);
        let adjusted = apply_corporate_adjustments(rows, &[bonus, split], false, false).unwrap();

        assert_eq!(adjusted[0].close, 200.0);
        assert_eq!(adjusted[1].close, 200.0);
        assert_eq!(adjusted[2].close, 205.0);
        assert_eq!(adjusted[2].prev_close, Some(200.0));
    }

    #[test]
    fn test_load_unified_price_rows_hybrid_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();

        // Add SQLite data
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-15", 100.0, 110.0, 90.0, 105.0, 1000],
        ).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let context = ResolvedInstrumentContext {
            requested_symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            current_symbol: "TEST".to_string(),
            current_name: Some("Test".to_string()),
            isin: None,
            current_instrument: None,
            related_symbols: vec!["TEST".to_string()],
            identity_history: Vec::new(),
            symbol_transitions: Vec::new(),
            corporate_actions: Vec::new(),
            resolved_from_alias: false,
        };

        let rows = load_unified_price_rows(dir.path(), &conn, &context, "2024-05-01", "2024-05-31")
            .unwrap();

        // Hybrid mode with missing .eod file should fallback to SQLite
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].date, "2024-05-15");
    }

    #[test]
    fn test_load_unified_price_rows_binary_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        // Add SQLite data
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-15", 100.0, 110.0, 90.0, 105.0, 1000],
        ).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let context = ResolvedInstrumentContext {
            requested_symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            current_symbol: "TEST".to_string(),
            current_name: Some("Test".to_string()),
            isin: None,
            current_instrument: None,
            related_symbols: vec!["TEST".to_string()],
            identity_history: Vec::new(),
            symbol_transitions: Vec::new(),
            corporate_actions: Vec::new(),
            resolved_from_alias: false,
        };

        let rows = load_unified_price_rows(dir.path(), &conn, &context, "2024-05-01", "2024-05-31")
            .unwrap();

        // Binary mode with missing .eod file should NOT fallback to SQLite
        assert_eq!(rows.len(), 0);
    }
}

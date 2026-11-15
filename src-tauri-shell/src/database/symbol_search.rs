use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

use super::{
    map_identity_history_row, normalize_exchange, with_active_connection, AppResult,
    IdentityHistoryRow, InstrumentRecord, InstrumentSummary, ListSymbolsInput, SearchSymbolsInput,
    SymbolSeriesFilter,
};

#[derive(Clone, Debug)]
struct SearchEntry {
    summary: InstrumentSummary,
    symbols: Vec<String>,
    names: Vec<String>,
}

#[tauri::command]
pub async fn search_symbols(
    app: AppHandle,
    input: SearchSymbolsInput,
) -> AppResult<Vec<InstrumentSummary>> {
    tauri::async_runtime::spawn_blocking(move || search_symbols_internal(&app, input))
        .await
        .map_err(|error| error.to_string())?
}

fn search_symbols_internal(
    app: &AppHandle,
    input: SearchSymbolsInput,
) -> AppResult<Vec<InstrumentSummary>> {
    if input.query.trim().is_empty() {
        return Ok(Vec::new());
    }

    with_active_connection(app, |connection| {
        list_instrument_summaries_internal(
            connection,
            Some(input.query.as_str()),
            input.exchange.as_deref(),
            Some(input.limit.unwrap_or(30)),
            input.series_filter.as_ref(),
            false,
        )
    })
    .map(|value| value.unwrap_or_default())
}

#[tauri::command]
pub async fn list_symbols(
    app: AppHandle,
    input: Option<ListSymbolsInput>,
) -> AppResult<Vec<InstrumentSummary>> {
    tauri::async_runtime::spawn_blocking(move || list_symbols_internal(&app, input))
        .await
        .map_err(|error| error.to_string())?
}

fn list_symbols_internal(
    app: &AppHandle,
    input: Option<ListSymbolsInput>,
) -> AppResult<Vec<InstrumentSummary>> {
    with_active_connection(app, |connection| {
        list_instrument_summaries_internal(
            connection,
            input.as_ref().and_then(|value| value.query.as_deref()),
            input.as_ref().and_then(|value| value.exchange.as_deref()),
            input.as_ref().and_then(|value| value.limit),
            input
                .as_ref()
                .and_then(|value| value.series_filter.as_ref()),
            input
                .as_ref()
                .and_then(|value| value.include_inactive)
                .unwrap_or(false),
        )
    })
    .map(|value| value.unwrap_or_default())
}

pub(super) fn list_instrument_summaries_internal(
    connection: &Connection,
    query: Option<&str>,
    exchange: Option<&str>,
    limit: Option<u32>,
    series_filter: Option<&SymbolSeriesFilter>,
    include_inactive: bool,
) -> AppResult<Vec<InstrumentSummary>> {
    let trimmed_query = query.unwrap_or("").trim();
    let effective_limit = limit
        .map(|value| value.clamp(20, 50_000) as usize)
        .unwrap_or(250);
    let normalized_exchange = match exchange {
        Some(value) if !value.trim().is_empty() => Some(normalize_exchange(value)?),
        _ => None,
    };
    let series_filter_key = symbol_series_filter_key(series_filter);

    if trimmed_query.is_empty() {
        return list_basic_instrument_summaries(
            connection,
            normalized_exchange.as_deref(),
            series_filter_key,
            effective_limit,
            include_inactive,
        );
    }

    let direct_results = search_basic_instrument_summaries(
        connection,
        trimmed_query,
        normalized_exchange.as_deref(),
        series_filter_key,
        effective_limit,
        include_inactive,
    )?;
    if direct_results.len() >= std::cmp::min(effective_limit, 20) {
        return Ok(direct_results);
    }

    let entries = build_instrument_search_entries(
        connection,
        normalized_exchange.as_deref(),
        series_filter_key,
        include_inactive,
    )?;
    let mut ranked = rank_instrument_entries(entries, trimmed_query);
    let mut merged = Vec::new();
    let mut seen = HashSet::new();
    for summary in direct_results.into_iter().chain(ranked.drain(..)) {
        let key = format!("{}:{}", summary.exchange, summary.symbol);
        if seen.insert(key) {
            merged.push(summary);
            if merged.len() >= effective_limit {
                break;
            }
        }
    }

    Ok(merged)
}

fn list_basic_instrument_summaries(
    connection: &Connection,
    exchange: Option<&str>,
    series_filter_key: &str,
    limit: usize,
    include_inactive: bool,
) -> AppResult<Vec<InstrumentSummary>> {
    let (exchange_primary, exchange_secondary) = exchange_filter_members(exchange);
    let sql = "
      SELECT
        i.symbol,
        i.exchange,
        i.isin,
        i.name,
        i.series,
        COALESCE(i.is_active, 1) AS is_active,
        COALESCE(i.lifecycle_status, CASE WHEN COALESCE(i.is_active, 1) = 1 THEN 'CURRENT' ELSE 'UNKNOWN_INACTIVE' END) AS lifecycle_status,
        (
          SELECT MAX(price.date)
          FROM eod_prices price
          WHERE price.symbol = i.symbol
            AND price.exchange = i.exchange
        ) AS last_price_date,
        latest.exchange_latest_price_date
      FROM instruments i
      LEFT JOIN (
        SELECT exchange, MAX(date) AS exchange_latest_price_date
        FROM eod_prices
        GROUP BY exchange
      ) latest ON latest.exchange = i.exchange
      WHERE (? IS NULL OR i.exchange = ? OR i.exchange = ?)
        AND (? = 1 OR COALESCE(i.is_active, 1) = 1)
        AND (
          ? = 'all'
          OR i.exchange <> 'NSE'
          OR (? = 'nseEquity' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ', 'SM', 'ST', 'SZ'))
          OR (? = 'nseEq' AND UPPER(COALESCE(i.series, '')) = 'EQ')
          OR (? = 'nseEqTradeForTrade' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ'))
          OR (? = 'nseSme' AND UPPER(COALESCE(i.series, '')) IN ('SM', 'ST', 'SZ'))
        )
      ORDER BY i.symbol ASC
      LIMIT ?
    ";

    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                exchange_primary,
                exchange_primary,
                exchange_secondary,
                include_inactive as i64,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                limit as i64
            ],
            |row| {
                Ok(InstrumentSummary {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    isin: row.get(2)?,
                    name: row.get(3)?,
                    series: row.get(4)?,
                    is_active: row.get::<_, i64>(5)? != 0,
                    lifecycle_status: row.get(6)?,
                    last_price_date: row.get(7)?,
                    exchange_latest_price_date: row.get(8)?,
                    resolved_from_alias: None,
                    matched_symbol: None,
                    matched_name: None,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(rows)
}

fn search_basic_instrument_summaries(
    connection: &Connection,
    query: &str,
    exchange: Option<&str>,
    series_filter_key: &str,
    limit: usize,
    include_inactive: bool,
) -> AppResult<Vec<InstrumentSummary>> {
    let (exchange_primary, exchange_secondary) = exchange_filter_members(exchange);
    let normalized_query = query.trim().to_uppercase();
    let prefix_query = format!("{normalized_query}%");
    let contains_query = format!("%{normalized_query}%");
    let sql = "
      SELECT
        i.symbol,
        i.exchange,
        i.isin,
        i.name,
        i.series,
        COALESCE(i.is_active, 1) AS is_active,
        COALESCE(i.lifecycle_status, CASE WHEN COALESCE(i.is_active, 1) = 1 THEN 'CURRENT' ELSE 'UNKNOWN_INACTIVE' END) AS lifecycle_status,
        (
          SELECT MAX(price.date)
          FROM eod_prices price
          WHERE price.symbol = i.symbol
            AND price.exchange = i.exchange
        ) AS last_price_date,
        latest.exchange_latest_price_date
      FROM instruments i
      LEFT JOIN (
        SELECT exchange, MAX(date) AS exchange_latest_price_date
        FROM eod_prices
        GROUP BY exchange
      ) latest ON latest.exchange = i.exchange
      WHERE (? IS NULL OR i.exchange = ? OR i.exchange = ?)
        AND (? = 1 OR COALESCE(i.is_active, 1) = 1)
        AND (
          ? = 'all'
          OR i.exchange <> 'NSE'
          OR (? = 'nseEquity' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ', 'SM', 'ST', 'SZ'))
          OR (? = 'nseEq' AND UPPER(COALESCE(i.series, '')) = 'EQ')
          OR (? = 'nseEqTradeForTrade' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ'))
          OR (? = 'nseSme' AND UPPER(COALESCE(i.series, '')) IN ('SM', 'ST', 'SZ'))
        )
        AND (
          UPPER(i.symbol) LIKE ?
          OR UPPER(COALESCE(i.name, '')) LIKE ?
        )
      ORDER BY
        CASE
          WHEN UPPER(i.symbol) = ? THEN 0
          WHEN UPPER(i.symbol) LIKE ? THEN 1
          WHEN UPPER(i.symbol) LIKE ? THEN 2
          WHEN UPPER(COALESCE(i.name, '')) LIKE ? THEN 3
          ELSE 4
        END,
        i.symbol ASC
      LIMIT ?
    ";

    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                exchange_primary,
                exchange_primary,
                exchange_secondary,
                include_inactive as i64,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                series_filter_key,
                contains_query,
                contains_query,
                normalized_query,
                prefix_query,
                contains_query,
                prefix_query,
                limit as i64
            ],
            |row| {
                Ok(InstrumentSummary {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    isin: row.get(2)?,
                    name: row.get(3)?,
                    series: row.get(4)?,
                    is_active: row.get::<_, i64>(5)? != 0,
                    lifecycle_status: row.get(6)?,
                    last_price_date: row.get(7)?,
                    exchange_latest_price_date: row.get(8)?,
                    resolved_from_alias: None,
                    matched_symbol: None,
                    matched_name: None,
                })
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(rows)
}

fn build_instrument_search_entries(
    connection: &Connection,
    exchange: Option<&str>,
    series_filter_key: &str,
    include_inactive: bool,
) -> AppResult<Vec<SearchEntry>> {
    let (exchange_primary, exchange_secondary) = exchange_filter_members(exchange);
    let sql = if exchange.is_some() {
        "
          SELECT
            i.symbol,
            i.exchange,
            i.isin,
            i.name,
            i.series,
            COALESCE(i.is_active, 1) AS is_active,
            COALESCE(i.lifecycle_status, CASE WHEN COALESCE(i.is_active, 1) = 1 THEN 'CURRENT' ELSE 'UNKNOWN_INACTIVE' END) AS lifecycle_status,
            (
              SELECT MAX(price.date)
              FROM eod_prices price
              WHERE price.symbol = i.symbol
                AND price.exchange = i.exchange
            ) AS last_price_date,
            latest.exchange_latest_price_date
          FROM instruments i
          LEFT JOIN (
            SELECT exchange, MAX(date) AS exchange_latest_price_date
            FROM eod_prices
            GROUP BY exchange
          ) latest ON latest.exchange = i.exchange
          WHERE (i.exchange = ? OR i.exchange = ?)
            AND (? = 1 OR COALESCE(i.is_active, 1) = 1)
            AND (
              ? = 'all'
              OR i.exchange <> 'NSE'
              OR (? = 'nseEquity' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ', 'SM', 'ST', 'SZ'))
              OR (? = 'nseEq' AND UPPER(COALESCE(i.series, '')) = 'EQ')
              OR (? = 'nseEqTradeForTrade' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ'))
              OR (? = 'nseSme' AND UPPER(COALESCE(i.series, '')) IN ('SM', 'ST', 'SZ'))
            )
          ORDER BY i.symbol ASC
        "
    } else {
        "
          SELECT
            i.symbol,
            i.exchange,
            i.isin,
            i.name,
            i.series,
            COALESCE(i.is_active, 1) AS is_active,
            COALESCE(i.lifecycle_status, CASE WHEN COALESCE(i.is_active, 1) = 1 THEN 'CURRENT' ELSE 'UNKNOWN_INACTIVE' END) AS lifecycle_status,
            (
              SELECT MAX(price.date)
              FROM eod_prices price
              WHERE price.symbol = i.symbol
                AND price.exchange = i.exchange
            ) AS last_price_date,
            latest.exchange_latest_price_date
          FROM instruments i
          LEFT JOIN (
            SELECT exchange, MAX(date) AS exchange_latest_price_date
            FROM eod_prices
            GROUP BY exchange
          ) latest ON latest.exchange = i.exchange
          WHERE (? = 1 OR COALESCE(i.is_active, 1) = 1)
            AND (
              ? = 'all'
              OR i.exchange <> 'NSE'
              OR (? = 'nseEquity' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ', 'SM', 'ST', 'SZ'))
              OR (? = 'nseEq' AND UPPER(COALESCE(i.series, '')) = 'EQ')
              OR (? = 'nseEqTradeForTrade' AND UPPER(COALESCE(i.series, '')) IN ('EQ', 'BE', 'BZ'))
              OR (? = 'nseSme' AND UPPER(COALESCE(i.series, '')) IN ('SM', 'ST', 'SZ'))
            )
          ORDER BY i.symbol ASC
        "
    };
    let mut instrument_statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let instruments = if exchange.is_some() {
        instrument_statement
            .query_map(
                params![
                    exchange_primary,
                    exchange_secondary,
                    include_inactive as i64,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key
                ],
                |row| {
                    Ok(InstrumentRecord {
                        symbol: row.get(0)?,
                        exchange: row.get(1)?,
                        isin: row.get(2)?,
                        name: row.get(3)?,
                        series: row.get(4)?,
                        is_active: row.get::<_, i64>(5)? != 0,
                        lifecycle_status: row.get(6)?,
                        last_price_date: row.get(7)?,
                        exchange_latest_price_date: row.get(8)?,
                        sector: None,
                        industry: None,
                    })
                },
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        instrument_statement
            .query_map(
                params![
                    include_inactive as i64,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key,
                    series_filter_key
                ],
                |row| {
                    Ok(InstrumentRecord {
                        symbol: row.get(0)?,
                        exchange: row.get(1)?,
                        isin: row.get(2)?,
                        name: row.get(3)?,
                        series: row.get(4)?,
                        is_active: row.get::<_, i64>(5)? != 0,
                        lifecycle_status: row.get(6)?,
                        last_price_date: row.get(7)?,
                        exchange_latest_price_date: row.get(8)?,
                        sector: None,
                        industry: None,
                    })
                },
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    let history_rows = load_identity_history_rows(connection, exchange)?;
    let mut map = HashMap::<String, SearchEntry>::new();

    for instrument in instruments {
        let key = format!("{}:{}", instrument.exchange, instrument.symbol);
        let entry = map.entry(key).or_insert_with(|| SearchEntry {
            summary: InstrumentSummary {
                symbol: instrument.symbol.clone(),
                exchange: instrument.exchange.clone(),
                name: instrument.name.clone(),
                series: instrument.series.clone(),
                isin: instrument.isin.clone(),
                is_active: instrument.is_active,
                lifecycle_status: instrument.lifecycle_status.clone(),
                last_price_date: instrument.last_price_date.clone(),
                exchange_latest_price_date: instrument.exchange_latest_price_date.clone(),
                resolved_from_alias: None,
                matched_symbol: None,
                matched_name: None,
            },
            symbols: Vec::new(),
            names: Vec::new(),
        });
        if !entry.symbols.contains(&instrument.symbol) {
            entry.symbols.push(instrument.symbol.clone());
        }
        if let Some(name) = instrument.name {
            if !entry.names.contains(&name) {
                entry.names.push(name);
            }
        }
    }

    for row in history_rows {
        let Some(current_symbol) = row
            .current_symbol
            .clone()
            .or_else(|| row.new_symbol.clone())
            .or_else(|| row.old_symbol.clone())
        else {
            continue;
        };
        let current_name = row
            .current_name
            .clone()
            .or_else(|| row.new_name.clone())
            .or_else(|| row.old_name.clone());
        let key = format!("{}:{}", row.exchange, current_symbol);
        if series_filter_key != "all" && !map.contains_key(&key) {
            continue;
        }
        let entry = map.entry(key).or_insert_with(|| SearchEntry {
            summary: InstrumentSummary {
                symbol: row
                    .current_symbol
                    .clone()
                    .or_else(|| row.new_symbol.clone())
                    .or_else(|| row.old_symbol.clone())
                    .unwrap_or_default(),
                exchange: row.exchange.clone(),
                name: current_name,
                series: None,
                isin: row.isin.clone(),
                is_active: false,
                lifecycle_status: Some("OLD_SYMBOL".to_string()),
                last_price_date: None,
                exchange_latest_price_date: None,
                resolved_from_alias: None,
                matched_symbol: None,
                matched_name: None,
            },
            symbols: Vec::new(),
            names: Vec::new(),
        });

        for symbol in [row.old_symbol, row.new_symbol] {
            if let Some(symbol) = symbol {
                if !entry.symbols.contains(&symbol) {
                    entry.symbols.push(symbol);
                }
            }
        }

        for name in [row.old_name, row.new_name, row.current_name] {
            if let Some(name) = name {
                if !entry.names.contains(&name) {
                    entry.names.push(name);
                }
            }
        }
    }

    Ok(map.into_values().collect())
}

fn symbol_series_filter_key(filter: Option<&SymbolSeriesFilter>) -> &'static str {
    match filter.unwrap_or(&SymbolSeriesFilter::All) {
        SymbolSeriesFilter::All => "all",
        SymbolSeriesFilter::NseEquity => "nseEquity",
        SymbolSeriesFilter::NseEq => "nseEq",
        SymbolSeriesFilter::NseEqTradeForTrade => "nseEqTradeForTrade",
        SymbolSeriesFilter::NseSme => "nseSme",
    }
}

fn exchange_filter_members(exchange: Option<&str>) -> (Option<&str>, Option<&str>) {
    match exchange {
        Some("NSE") => (Some("NSE"), Some("NSE_INDEX")),
        Some("BSE") => (Some("BSE"), Some("BSE_INDEX")),
        Some(value) => (Some(value), None),
        None => (None, None),
    }
}

fn load_identity_history_rows(
    connection: &Connection,
    exchange: Option<&str>,
) -> AppResult<Vec<IdentityHistoryRow>> {
    let (exchange_primary, exchange_secondary) = exchange_filter_members(exchange);
    let history_sql = if exchange.is_some() {
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
          WHERE exchange = ? OR exchange = ?
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
          ORDER BY effective_date ASC, id ASC
        "
    };
    let mut history_statement = connection
        .prepare(history_sql)
        .map_err(|error| error.to_string())?;

    if exchange.is_some() {
        history_statement
            .query_map(
                params![exchange_primary, exchange_secondary],
                map_identity_history_row,
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    } else {
        history_statement
            .query_map([], map_identity_history_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }
}

fn rank_instrument_entries(entries: Vec<SearchEntry>, query: &str) -> Vec<InstrumentSummary> {
    let normalized_query = query.trim().to_uppercase();
    let mut ranked = entries
        .into_iter()
        .filter_map(|entry| score_search_entry(entry, &normalized_query))
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then_with(|| left.1.summary.symbol.cmp(&right.1.summary.symbol))
    });

    let mut seen = HashSet::<String>::new();
    let mut results = Vec::new();
    for (_, entry, matched_symbol, matched_name, resolved_from_alias) in ranked {
        let key = format!("{}:{}", entry.summary.exchange, entry.summary.symbol);
        if !seen.insert(key) {
            continue;
        }
        results.push(InstrumentSummary {
            resolved_from_alias: Some(resolved_from_alias),
            matched_symbol,
            matched_name,
            ..entry.summary
        });
    }
    results
}

fn score_search_entry(
    entry: SearchEntry,
    normalized_query: &str,
) -> Option<(i32, SearchEntry, Option<String>, Option<String>, bool)> {
    let current_symbol = entry.summary.symbol.to_uppercase();
    let current_name = entry
        .summary
        .name
        .clone()
        .unwrap_or_default()
        .to_uppercase();
    let mut best_score = i32::MAX;
    let mut matched_symbol = None;
    let mut matched_name = None;
    let mut resolved_from_alias = false;

    if current_symbol == normalized_query {
        best_score = 0;
        matched_symbol = Some(entry.summary.symbol.clone());
    } else if current_symbol.starts_with(normalized_query) {
        best_score = 1;
        matched_symbol = Some(entry.summary.symbol.clone());
    } else if current_symbol.contains(normalized_query) {
        best_score = 2;
        matched_symbol = Some(entry.summary.symbol.clone());
    }

    for symbol in entry
        .symbols
        .iter()
        .filter(|value| value.to_uppercase() != current_symbol)
    {
        let normalized = symbol.to_uppercase();
        if normalized == normalized_query {
            if 3 < best_score {
                best_score = 3;
            }
            matched_symbol = Some(symbol.clone());
            resolved_from_alias = true;
        } else if normalized.starts_with(normalized_query) {
            if 4 < best_score {
                best_score = 4;
            }
            matched_symbol = Some(symbol.clone());
            resolved_from_alias = true;
        } else if normalized.contains(normalized_query) {
            if 5 < best_score {
                best_score = 5;
            }
            matched_symbol = Some(symbol.clone());
            resolved_from_alias = true;
        }
    }

    if !current_name.is_empty() {
        if current_name == normalized_query {
            best_score = best_score.min(6);
            matched_name = entry.summary.name.clone();
        } else if current_name.contains(normalized_query) {
            best_score = best_score.min(7);
            matched_name = entry.summary.name.clone();
        }
    }

    for name in entry
        .names
        .iter()
        .filter(|value| value.to_uppercase() != current_name)
    {
        let normalized = name.to_uppercase();
        if normalized == normalized_query {
            best_score = best_score.min(8);
            matched_name = Some(name.clone());
            resolved_from_alias = true;
        } else if normalized.contains(normalized_query) {
            best_score = best_score.min(9);
            matched_name = Some(name.clone());
            resolved_from_alias = true;
        }
    }

    if best_score == i32::MAX {
        return None;
    }

    Some((
        best_score,
        entry,
        matched_symbol,
        matched_name,
        resolved_from_alias,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn setup_symbol_filter_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE instruments (
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL,
              isin TEXT,
              name TEXT,
              series TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              lifecycle_status TEXT NOT NULL DEFAULT 'CURRENT',
              PRIMARY KEY(symbol, exchange)
            );
            CREATE TABLE instrument_identity_history (
              id INTEGER PRIMARY KEY,
              exchange TEXT NOT NULL DEFAULT 'NSE',
              isin TEXT,
              current_symbol TEXT,
              current_name TEXT,
              old_symbol TEXT,
              old_name TEXT,
              new_symbol TEXT,
              new_name TEXT,
              effective_date TEXT,
              change_type TEXT
            );
            CREATE TABLE eod_prices (
              symbol TEXT NOT NULL,
              exchange TEXT NOT NULL,
              date TEXT NOT NULL,
              open REAL NOT NULL DEFAULT 0,
              high REAL NOT NULL DEFAULT 0,
              low REAL NOT NULL DEFAULT 0,
              close REAL NOT NULL DEFAULT 0,
              volume INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY(symbol, exchange, date)
            );
            ",
        )
        .unwrap();

        for (symbol, exchange, name, series) in [
            ("MAINCO", "NSE", "Main Company", "EQ"),
            ("WATCHCO", "NSE", "Trade For Trade Company", "BE"),
            ("BZCO", "NSE", "BZ Trade For Trade Company", "BZ"),
            ("SMECO", "NSE", "SME Company", "SM"),
            ("1018GS2026", "NSE", "Government Security", "GS"),
            ("NIFTY", "NSE_INDEX", "Nifty 50", ""),
            ("500325", "BSE", "BSE Company", "A"),
            ("SENSEX", "BSE_INDEX", "Sensex", ""),
        ] {
            conn.execute(
                "
                  INSERT INTO instruments (symbol, exchange, name, series)
                  VALUES (?, ?, ?, ?)
                ",
                params![symbol, exchange, name, series],
            )
            .unwrap();
        }

        conn
    }

    fn symbols_for_filter(filter: SymbolSeriesFilter) -> Vec<String> {
        let conn = setup_symbol_filter_db();
        list_instrument_summaries_internal(&conn, None, None, Some(100), Some(&filter), false)
            .unwrap()
            .into_iter()
            .map(|item| format!("{}:{}", item.exchange, item.symbol))
            .collect()
    }

    #[test]
    fn nse_eq_filter_keeps_only_eq_for_nse_and_leaves_bse_visible() {
        let symbols = symbols_for_filter(SymbolSeriesFilter::NseEq);

        assert!(symbols.contains(&"NSE:MAINCO".to_string()));
        assert!(symbols.contains(&"BSE:500325".to_string()));
        assert!(!symbols.contains(&"NSE:WATCHCO".to_string()));
        assert!(!symbols.contains(&"NSE:BZCO".to_string()));
        assert!(!symbols.contains(&"NSE:SMECO".to_string()));
        assert!(!symbols.contains(&"NSE:1018GS2026".to_string()));
    }

    #[test]
    fn nse_trade_for_trade_filter_keeps_eq_be_and_bz_for_nse() {
        let symbols = symbols_for_filter(SymbolSeriesFilter::NseEqTradeForTrade);

        assert!(symbols.contains(&"NSE:MAINCO".to_string()));
        assert!(symbols.contains(&"NSE:WATCHCO".to_string()));
        assert!(symbols.contains(&"NSE:BZCO".to_string()));
        assert!(!symbols.contains(&"NSE:SMECO".to_string()));
        assert!(!symbols.contains(&"NSE:1018GS2026".to_string()));
    }

    #[test]
    fn nse_equity_filter_keeps_equity_trade_for_trade_and_sme() {
        let symbols = symbols_for_filter(SymbolSeriesFilter::NseEquity);

        assert!(symbols.contains(&"NSE:MAINCO".to_string()));
        assert!(symbols.contains(&"NSE:WATCHCO".to_string()));
        assert!(symbols.contains(&"NSE:BZCO".to_string()));
        assert!(symbols.contains(&"NSE:SMECO".to_string()));
        assert!(symbols.contains(&"BSE:500325".to_string()));
        assert!(!symbols.contains(&"NSE:1018GS2026".to_string()));
    }

    #[test]
    fn nse_sme_filter_keeps_only_sme_series_for_nse() {
        let symbols = symbols_for_filter(SymbolSeriesFilter::NseSme);

        assert!(symbols.contains(&"NSE:SMECO".to_string()));
        assert!(symbols.contains(&"BSE:500325".to_string()));
        assert!(!symbols.contains(&"NSE:MAINCO".to_string()));
        assert!(!symbols.contains(&"NSE:WATCHCO".to_string()));
    }

    #[test]
    fn search_respects_nse_series_filter() {
        let conn = setup_symbol_filter_db();
        let results = list_instrument_summaries_internal(
            &conn,
            Some("watch"),
            None,
            Some(100),
            Some(&SymbolSeriesFilter::NseEq),
            false,
        )
        .unwrap();

        assert!(results.is_empty());
    }

    #[test]
    fn inactive_symbols_require_explicit_include_inactive() {
        let conn = setup_symbol_filter_db();
        conn.execute(
            "
              INSERT INTO instruments (symbol, exchange, name, series, is_active, lifecycle_status)
              VALUES ('OLDCO', 'NSE', 'Old Company', 'EQ', 0, 'UNKNOWN_INACTIVE')
            ",
            [],
        )
        .unwrap();

        let active_only =
            list_instrument_summaries_internal(&conn, None, Some("NSE"), Some(100), None, false)
                .unwrap()
                .into_iter()
                .map(|item| item.symbol)
                .collect::<Vec<_>>();
        assert!(!active_only.contains(&"OLDCO".to_string()));

        let with_inactive =
            list_instrument_summaries_internal(&conn, None, Some("NSE"), Some(100), None, true)
                .unwrap()
                .into_iter()
                .find(|item| item.symbol == "OLDCO")
                .expect("inactive symbol should be returned when requested");
        assert!(!with_inactive.is_active);
        assert_eq!(
            with_inactive.lifecycle_status.as_deref(),
            Some("UNKNOWN_INACTIVE")
        );
    }

    #[test]
    fn exchange_tabs_include_matching_index_exchanges() {
        let conn = setup_symbol_filter_db();

        let nse_symbols =
            list_instrument_summaries_internal(&conn, None, Some("NSE"), Some(100), None, false)
                .unwrap()
                .into_iter()
                .map(|item| format!("{}:{}", item.exchange, item.symbol))
                .collect::<Vec<_>>();
        assert!(nse_symbols.contains(&"NSE:MAINCO".to_string()));
        assert!(nse_symbols.contains(&"NSE_INDEX:NIFTY".to_string()));
        assert!(!nse_symbols.contains(&"BSE_INDEX:SENSEX".to_string()));

        let bse_symbols =
            list_instrument_summaries_internal(&conn, None, Some("BSE"), Some(100), None, false)
                .unwrap()
                .into_iter()
                .map(|item| format!("{}:{}", item.exchange, item.symbol))
                .collect::<Vec<_>>();
        assert!(bse_symbols.contains(&"BSE:500325".to_string()));
        assert!(bse_symbols.contains(&"BSE_INDEX:SENSEX".to_string()));
        assert!(!bse_symbols.contains(&"NSE_INDEX:NIFTY".to_string()));
    }
}

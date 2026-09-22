use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tauri::AppHandle;

use super::binary_eod::{date_to_u32, u32_to_date, BinaryEodFile, EodRecord};
use super::connection_registry::resolve_active_database_folder;
use super::{
    get_price_storage_mode, map_identity_history_row, normalize_exchange,
    normalize_optional_trade_date, normalize_symbol, question_marks, round_price,
    trim_numeric_string, with_active_connection, AppResult, ChartEventRecord, CorporateActionRow,
    EodDataInputPayload, EodDataResult, EodRow, InstrumentRecord, InstrumentSummary, PriceRow,
    PriceStorageMode, ResolvedInstrumentContext, SymbolTransition,
};

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

        with_active_connection(&app, |connection| {
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
        .map(|value| value.unwrap_or_else(empty))
    })
    .await
    .map_err(|error| error.to_string())?
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
        .map_err(|error| error.to_string())?;

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
    let identity_history = if let Some(isin_value) = isin.clone() {
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
            related_symbols.insert(symbol);
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

    Ok(Some(ResolvedInstrumentContext {
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
    }))
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

    let mut clauses = Vec::new();
    let mut values = vec![Value::Text(exchange.to_string())];
    if !related_symbols.is_empty() {
        clauses.push(format!(
            "symbol IN ({})",
            question_marks(related_symbols.len())
        ));
        values.extend(
            related_symbols
                .iter()
                .cloned()
                .map(Value::Text)
                .collect::<Vec<_>>(),
        );
    }
    if let Some(isin_value) = isin {
        clauses.push("isin = ?".to_string());
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
          FROM corporate_actions
          WHERE exchange = ?
            AND ({})
            AND action_type IN ('SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS', 'DEMERGER')
          ORDER BY effective_date ASC, id ASC
        ",
        clauses.join(" OR ")
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
    let mut raw_rows = Vec::new();
    let from_u32 = date_to_u32(from);
    let to_u32 = date_to_u32(to);

    let storage_mode = get_price_storage_mode(connection);

    for symbol in &context.related_symbols {
        let bin_path = folder_path
            .join("eod_data")
            .join(&context.exchange)
            .join(format!("{}.eod", symbol));
        if bin_path.exists() {
            let bin_file = BinaryEodFile::open(&bin_path)?;
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
        .filter_map(|(date, rows)| select_preferred_price_row(&date, &rows, context))
        .collect::<Vec<_>>();
    Ok(recompute_prev_close(merged))
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
        let previous_close = rows
            .iter()
            .filter(|row| row.date < effective_date)
            .max_by(|left, right| left.date.cmp(&right.date))
            .map(|row| row.close);
        let Some(previous_close) = previous_close else {
            continue;
        };
        if !previous_close.is_finite() || previous_close <= 0.0 {
            return Err(format!(
                "Dividend adjustment on {effective_date} requires a positive local previous close."
            ));
        }

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
            Ok(total + cash)
        })?;
        if !total_cash.is_finite() || total_cash >= previous_close {
            return Err(format!(
                "Combined dividend cash on {effective_date} must be positive and smaller than the local previous close."
            ));
        }

        let mut combined_action = dividend_actions[0].clone();
        combined_action.cash_amount = Some(total_cash);
        combined_action.factor = previous_close / (previous_close - total_cash);
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

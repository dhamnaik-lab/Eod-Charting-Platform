use super::*;
use chrono::NaiveDate;

pub(super) fn augment_index_alias_context(
    connection: &Connection,
    mut context: ResolvedInstrumentContext,
) -> AppResult<ResolvedInstrumentContext> {
    if context.exchange != "NSE_INDEX" {
        return Ok(context);
    }
    let Some(family) = nse_index_alias_family(&context.current_symbol) else {
        return Ok(context);
    };
    context.current_symbol = family.canonical.to_string();
    context.resolved_from_alias |= context.requested_symbol != family.canonical;
    if let Some(instrument) =
        find_instrument_record(connection, family.canonical, &context.exchange)?
    {
        context.current_name = instrument.name.clone();
        context.current_instrument = Some(instrument);
    }
    for symbol in family.symbols {
        if !context
            .related_symbols
            .iter()
            .any(|existing| existing == symbol)
        {
            context.related_symbols.push(symbol.to_string());
        }
    }
    context.corporate_actions = load_corporate_actions(
        connection,
        &context.exchange,
        &context.related_symbols,
        context.isin.as_deref(),
    )?;
    Ok(context)
}

pub(super) fn resolve_index_alias_context(
    connection: &Connection,
    requested_symbol: &str,
    exchange: &str,
) -> AppResult<Option<ResolvedInstrumentContext>> {
    let family = nse_index_alias_family(requested_symbol)
        .ok_or_else(|| "Unknown NSE index alias family".to_string())?;
    let mut instrument = None;
    // Prefer canonical metadata, but allow legacy-only databases. File lookup
    // includes every explicit alias even when its instrument row is absent.
    for symbol in family.symbols {
        if let Some(found) = find_instrument_record(connection, symbol, exchange)? {
            instrument = Some(found);
            break;
        }
    }
    let Some(instrument) = instrument else {
        return Ok(None);
    };
    let related_symbols = family
        .symbols
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let corporate_actions = load_corporate_actions(connection, exchange, &related_symbols, None)?;
    Ok(Some(ResolvedInstrumentContext {
        requested_symbol: requested_symbol.to_string(),
        exchange: exchange.to_string(),
        current_symbol: family.canonical.to_string(),
        current_name: instrument.name.clone(),
        isin: instrument.isin.clone(),
        current_instrument: Some(instrument),
        related_symbols,
        // Registry equivalences do not fabricate persisted identity events.
        identity_history: Vec::new(),
        symbol_transitions: Vec::new(),
        corporate_actions,
        resolved_from_alias: requested_symbol != family.canonical,
    }))
}

pub(super) fn validate_index_alias_rows(
    date: &str,
    rows: &[PriceRow],
    context: &ResolvedInstrumentContext,
) -> AppResult<()> {
    if context.exchange != "NSE_INDEX" || nse_index_alias_family(&context.current_symbol).is_none()
    {
        return Ok(());
    }
    if let Some(first) = rows.first() {
        if rows.iter().skip(1).any(|row| {
            row.open != first.open
                || row.high != first.high
                || row.low != first.low
                || row.close != first.close
                || row.volume != first.volume
                || row.open_interest != first.open_interest
        }) {
            let mut symbols = rows
                .iter()
                .map(|row| row.symbol.as_str())
                .collect::<Vec<_>>();
            symbols.sort_unstable();
            symbols.dedup();
            return Err(format!(
                "Conflicting NSE index alias bars for {} on {} ({}). Review source history before charting.",
                context.current_symbol, date, symbols.join(", ")
            ));
        }
    }
    Ok(())
}

/// A long break is not proof of a holiday or of complete daily coverage.
/// Suppress the comparison after >7 calendar days rather than treating a stale
/// candle as yesterday's close. Ordinary weekends/small holiday breaks still work.
pub(super) fn guard_index_previous_close(rows: Vec<PriceRow>) -> Vec<PriceRow> {
    let mut previous_date: Option<NaiveDate> = None;
    rows.into_iter()
        .map(|mut row| {
            let date = NaiveDate::parse_from_str(&row.date, "%Y-%m-%d").ok();
            let adjacent = previous_date.zip(date).is_some_and(|(previous, current)| {
                (1..=7).contains(&(current - previous).num_days())
            });
            if !adjacent {
                row.prev_close = None;
            }
            previous_date = date;
            row
        })
        .collect()
}

#[cfg(test)]
mod tests;

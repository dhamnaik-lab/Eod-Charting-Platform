//! Verify the persisted Split/Bonus scan against the current authoritative EOD bars.
//! The existing scan fingerprint covers event terms; this closes the price-data
//! drift window between Load & Validate and the financial approval writer.
use super::*;

pub(super) fn ensure_scan_uses_current_price_window(
    connection: &Connection,
    folder: &Path,
    import_row: &CorporateActionImportRow,
) -> AppResult<()> {
    let validation = load_latest_official_split_bonus_validation(connection, import_row.id)?
        .ok_or_else(|| "Split/Bonus price validation is missing.".to_string())?;
    let symbol = validation
        .symbol
        .as_deref()
        .ok_or_else(|| "Split/Bonus price validation has no event symbol.".to_string())?;
    let date = import_row
        .ex_date
        .as_deref()
        .ok_or_else(|| "Split/Bonus price validation has no ex-date.".to_string())?;

    // Use the same window selection order as scan_candidate, including the
    // strictly evidenced dated-identity route when the legacy window is absent.
    let window = match load_trade_window(connection, folder, symbol, &import_row.exchange, date)? {
        Some(window) => Some(window),
        None if import_row.symbol.as_deref() == Some(symbol) =>
            load_import_trade_window(connection, folder, import_row, symbol, &import_row.exchange, date)?,
        None => None,
    };
    let Some((previous, ex_bar)) = window else {
        return Err("Split/Bonus validation is stale: current authoritative EOD price window is unavailable. Re-run validation.".to_string());
    };
    let unchanged = validation.prev_trade_date.as_deref() == Some(previous.date.as_str())
        && validation.ex_trade_date.as_deref() == Some(ex_bar.date.as_str())
        && validation.prev_close.map(f64::to_bits) == Some(previous.close.to_bits())
        && validation.ex_open.map(f64::to_bits) == Some(ex_bar.open.to_bits())
        && validation.ex_close.map(f64::to_bits) == Some(ex_bar.close.to_bits());
    if !unchanged {
        return Err("Split/Bonus validation is stale: EOD prices or trading dates changed after the scan. Re-run validation.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;

    #[test]
    fn ca_financial_integrity_changed_ex_close_invalidates_saved_scan() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute_batch(
            "INSERT INTO instruments (symbol,exchange,isin,name,is_active)
               VALUES ('CA_FRESHNESS','NSE','INE000A00033','Freshness',1);
             INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close)
               VALUES ('CA_FRESHNESS','NSE','2026-08-13',100,101,99,100),
                      ('CA_FRESHNESS','NSE','2026-08-14',52.5,54,50,51.8);
             INSERT INTO corporate_action_imports
               (dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,
                ratio_num,ratio_den,factor,price_factor,parse_status,review_status)
               VALUES ('ca-freshness','NSE','NSE_API','CA_FRESHNESS','INE000A00033',
                       'Split 2:1','2026-08-14','SPLIT',2,1,2,0.5,'PARSED','PENDING');
             INSERT INTO scan_runs(scope,action_types,started_at,status)
               VALUES ('official_imports','SPLIT,BONUS','2026-08-14T00:00:00Z','COMPLETED');
             INSERT INTO corporate_action_scan_results
               (scan_run_id,corporate_action_import_id,symbol,exchange,scan_status,
                prev_trade_date,ex_trade_date,prev_close,ex_open,ex_close,expected_factor,
                actual_open_factor,actual_close_factor,confidence,scanned_at)
               VALUES (1,1,'CA_FRESHNESS','NSE','MATCHED','2026-08-13','2026-08-14',
                       100,52.5,51.8,2,100.0/52.5,100.0/51.8,0.95,'2026-08-14T00:00:01Z');",
        ).unwrap();
        let row = get_import_row(&connection, 1).unwrap();
        let folder = std::env::temp_dir();
        ensure_scan_uses_current_price_window(&connection, &folder, &row).unwrap();

        connection.execute(
            "UPDATE eod_prices SET close=45.0
             WHERE symbol='CA_FRESHNESS' AND date='2026-08-14'", [],
        ).unwrap();
        let error = ensure_scan_uses_current_price_window(&connection, &folder, &row).unwrap_err();
        assert!(error.contains("stale"), "{error}");
    }
}

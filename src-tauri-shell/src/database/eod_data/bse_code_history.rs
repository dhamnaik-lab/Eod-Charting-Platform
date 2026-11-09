//! Join legacy numeric BSE files only through a saved, unambiguous security code.
//! No company-name matching, inferred tickers, identity writes or file rewrites.
use super::*;

pub(super) fn is_security_code(symbol: &str) -> bool {
    symbol.len() == 6 && symbol.bytes().all(|b| b.is_ascii_digit())
}

pub(super) fn augment_bse_code_context(
    connection: &Connection,
    mut context: ResolvedInstrumentContext,
) -> AppResult<ResolvedInstrumentContext> {
    if context.exchange != "BSE"
        || context.current_symbol.ends_with('#')
        || is_security_code(&context.current_symbol)
    {
        return Ok(context);
    }
    // Older isolated fixtures predate the existing additive identity column.
    let has_column: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('instruments') WHERE name='bse_security_code')",
        [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if !has_column {
        return Ok(context);
    }
    let code: Option<String> = connection
        .query_row(
            "SELECT bse_security_code FROM instruments WHERE exchange='BSE' AND symbol=?1",
            params![context.current_symbol],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    let Some(code) = code.filter(|code| is_security_code(code)) else {
        return Ok(context);
    };
    let owners: i64 = connection.query_row(
        "SELECT COUNT(*) FROM instruments WHERE exchange='BSE' AND bse_security_code=?1 AND symbol<>?1 AND symbol NOT LIKE '%#'",
        params![code], |r| r.get(0)).map_err(|e| e.to_string())?;
    if owners != 1 {
        return Err(format!(
            "Ambiguous BSE security-code mapping for {code}; review identity before charting."
        ));
    }
    if let Some(numeric) = find_instrument_record(connection, &code, "BSE")? {
        if let (Some(a), Some(b)) = (numeric.isin.as_deref(), context.isin.as_deref()) {
            if !a.is_empty() && !b.is_empty() && a != b {
                return Err(format!("Conflicting BSE security-code ISIN for {code}; review identity before charting."));
            }
        }
    }
    if !context.related_symbols.contains(&code) {
        context.related_symbols.push(code);
    }
    context.corporate_actions = load_corporate_actions(
        connection,
        "BSE",
        &context.related_symbols,
        context.isin.as_deref(),
    )?;
    Ok(context)
}

pub(super) fn validate_bse_code_rows(
    date: &str,
    rows: &[PriceRow],
    context: &ResolvedInstrumentContext,
) -> AppResult<()> {
    if context.exchange != "BSE" || is_security_code(&context.current_symbol) {
        return Ok(());
    }
    let Some(code_row) = rows.iter().find(|r| is_security_code(&r.symbol)) else {
        return Ok(());
    };
    if rows.iter().any(|r| {
        r.open != code_row.open
            || r.high != code_row.high
            || r.low != code_row.low
            || r.close != code_row.close
            || r.volume != code_row.volume
            || r.open_interest != code_row.open_interest
    }) {
        return Err(format!("Conflicting BSE security-code bars for {} on {date}; stored prices preserved. Review source history before charting.", context.current_symbol));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{prepare_database_connection, PriceStorageMode};

    fn fixture() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        prepare_database_connection(&c).unwrap();
        c.execute_batch(
            "INSERT INTO instruments(symbol,exchange,name,isin,bse_security_code) VALUES
          ('JAYUSH','BSE','Jay Ushin','ISIN1','513252'), ('513252','BSE','513252',NULL,NULL),
          ('JAYUSH#','BSE','Jay Ushin','ISIN1',NULL), ('TCS','BSE','TCS','ISIN2',NULL);",
        )
        .unwrap();
        c
    }

    #[test]
    fn saved_code_joins_legacy_history_without_mutating_source_files() {
        let c = fixture();
        let root = tempfile::tempdir().unwrap();
        let mut old = [EodRecord {
            date: 20110103,
            flags: 0,
            open: 1000000,
            high: 1100000,
            low: 900000,
            close: 1050000,
            prev_close: 0,
            volume: 10,
            oi: 0,
        }];
        let mut new = [EodRecord {
            date: 20231205,
            ..old[0]
        }];
        let p = root.path().join("eod_data/BSE/513252.eod");
        BinaryEodFile::write_all(&p, "513252", "BSE", 10000, &mut old).unwrap();
        BinaryEodFile::write_all(
            root.path().join("eod_data/BSE/JAYUSH.eod"),
            "JAYUSH",
            "BSE",
            10000,
            &mut new,
        )
        .unwrap();
        let before = std::fs::read(&p).unwrap();
        let context = resolve_instrument_context(&c, "JAYUSH", "BSE")
            .unwrap()
            .unwrap();
        assert!(context.related_symbols.contains(&"513252".into()));
        let rows = load_unified_price_rows_with_mode(
            root.path(),
            &c,
            &context,
            "2011-01-01",
            "2024-01-01",
            PriceStorageMode::Binary,
        )
        .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].date, "2011-01-03");
        assert_eq!(std::fs::read(&p).unwrap(), before);
        let t0 = resolve_instrument_context(&c, "JAYUSH#", "BSE")
            .unwrap()
            .unwrap();
        assert!(!t0.related_symbols.contains(&"513252".into()));
        let unmapped = resolve_instrument_context(&c, "TCS", "BSE")
            .unwrap()
            .unwrap();
        assert!(!unmapped.related_symbols.contains(&"532540".into()));
    }

    #[test]
    fn ambiguous_code_and_conflicting_isin_fail_closed() {
        let c = fixture();
        // The production schema prevents ambiguous saved mappings at write time.
        assert!(c
            .execute(
                "UPDATE instruments SET bse_security_code='513252' WHERE symbol='TCS'",
                []
            )
            .is_err());
        c.execute(
            "UPDATE instruments SET isin='OTHER' WHERE symbol='513252'",
            [],
        )
        .unwrap();
        assert!(resolve_instrument_context(&c, "JAYUSH", "BSE")
            .err()
            .unwrap()
            .contains("ISIN"));
    }

    #[test]
    fn overlap_conflict_is_not_silently_ranked_away() {
        let c = fixture();
        let context = resolve_instrument_context(&c, "JAYUSH", "BSE")
            .unwrap()
            .unwrap();
        let a = PriceRow {
            symbol: "513252".into(),
            date: "2023-12-05".into(),
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            prev_close: None,
            volume: 10,
            open_interest: 0,
        };
        let mut b = a.clone();
        b.symbol = "JAYUSH".into();
        b.close = 106.0;
        assert!(validate_bse_code_rows(&a.date, &[a.clone(), b], &context).is_err());
    }
}

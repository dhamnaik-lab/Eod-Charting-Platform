//! Identity proof for a Split (or same-day Bonus + Split) whose own event changed
//! the equity ISIN. A shared issuer prefix alone is never enough. Every check
//! below must hold: same active symbol, an ordinary-equity split in the event
//! terms, the same issuer and equity security type, no other owner of the old
//! ISIN, and a current MATCHED local price validation for this exact import.
use super::*;

pub(super) const DECISION: &str = "VERIFIED_SPLIT_ISIN_PRICE_PROOF";

const SPLIT_MARKERS: [&str; 7] = [
    "SPLIT",
    "SUB DIVISION",
    "SUBDIVISION",
    "SUB-DIVISION",
    "CONSOLIDATION",
    "CONSOLIDATE",
    "REVERSE SPLIT",
];

const NON_EQUITY_MARKERS: [&str; 7] = [
    "DEBENTURE",
    "PREFERENCE",
    "NCRPS",
    "CRPS",
    "NCD",
    "WARRANT",
    "BOND",
];

fn event_includes_equity_split(row: &CorporateActionImportRow) -> bool {
    let normalized = expand_legacy_abbreviations(&normalize_text(&row.purpose_raw));
    if NON_EQUITY_MARKERS
        .iter()
        .any(|marker| normalized.split_whitespace().any(|token| token.starts_with(marker)))
    {
        return false;
    }
    match row.action_type.as_str() {
        "SPLIT" => true,
        "BONUS" => SPLIT_MARKERS.iter().any(|marker| normalized.contains(marker)),
        _ => false,
    }
}

/// Indian equity ISIN: `IN` + issuer type + 4-character company + `01` + serial + check.
/// Both ISINs must share the first 9 characters and carry the equity code `01`.
fn same_equity_issuer(raw: &str, current: &str) -> bool {
    raw.len() == 12
        && current.len() == 12
        && raw.is_ascii()
        && current.is_ascii()
        && raw.starts_with("IN")
        && raw != current
        && raw[..9] == current[..9]
        && &raw[7..9] == "01"
}

pub(super) fn evaluate(
    connection: &Connection,
    row: &CorporateActionImportRow,
    suggestion: &CorporateActionImportResolutionSuggestion,
) -> AppResult<bool> {
    // PENDING_ISIN_MISMATCH is the same case seen from the other side: the
    // symbol matched, but the event ISIN differs from today's ISIN.
    if !matches!(row.review_status.as_str(), "UNRESOLVED" | "PENDING_ISIN_MISMATCH")
        || row.approved_corporate_action_id.is_some()
        || row.parse_status != "PARSED"
        || !matches!(row.action_type.as_str(), "SPLIT" | "BONUS")
        || !suggestion.is_active
        || suggestion.exchange != row.exchange
        || row.symbol.as_deref() != Some(suggestion.symbol.as_str())
        || !event_includes_equity_split(row)
    {
        return Ok(false);
    }
    let Some(raw) = normalize_isin(row.isin.as_deref()) else {
        return Ok(false);
    };
    let Some(instrument) = find_instrument_record(connection, &suggestion.symbol, &suggestion.exchange)? else {
        return Ok(false);
    };
    let Some(current) = normalize_isin(instrument.isin.as_deref()) else {
        return Ok(false);
    };
    if !same_equity_issuer(&raw, &current) {
        return Ok(false);
    }
    // The old ISIN must not belong to any other symbol, now or in recorded history.
    let other_owner: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM instruments WHERE upper(isin)=? AND NOT (symbol=? AND exchange=?))
                 OR EXISTS(SELECT 1 FROM instrument_isin_history WHERE upper(isin)=? AND NOT (symbol=? AND exchange=?))",
            params![raw, suggestion.symbol, suggestion.exchange, raw, suggestion.symbol, suggestion.exchange],
            |r| r.get(0),
        )
        .map_err(|error| error.to_string())?;
    if other_owner {
        return Ok(false);
    }
    let Some(validation) = load_latest_official_split_bonus_validation(connection, row.id)? else {
        return Ok(false);
    };
    if validation.scan_status != "MATCHED"
        || validation.symbol.as_deref() != Some(suggestion.symbol.as_str())
        || !is_split_bonus_validation_current(connection, row, &validation)?
    {
        return Ok(false);
    }
    // The saved scan must still match today's authoritative EOD bars. A price
    // correction or deletion after the scan removes the proof (fail closed).
    let folder = database_folder(connection)?;
    Ok(price_validation_freshness::ensure_scan_uses_current_price_window(connection, &folder, row).is_ok())
}

/// Folder of the open database file. An in-memory database has no file, so its
/// bars come only from SQL tables; the temp folder holds no `.eod` files for it.
fn database_folder(connection: &Connection) -> AppResult<std::path::PathBuf> {
    let file: String = connection
        .query_row("SELECT file FROM pragma_database_list WHERE name='main'", [], |r| r.get(0))
        .map_err(|error| error.to_string())?;
    Ok(match Path::new(&file).parent() {
        Some(parent) if !file.trim().is_empty() => parent.to_path_buf(),
        _ => std::env::temp_dir(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;

    const RAW_ISIN: &str = "INE669C01028";
    const CURRENT_ISIN: &str = "INE669C01036";

    fn fixture(purpose: &str, action: &str, factor: f64, scan_status: &str) -> Connection {
        let c = Connection::open_in_memory().unwrap();
        prepare_database_connection(&c).unwrap();
        c.execute(
            "INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES ('SPLITCO','NSE',?,'Split Co',1)",
            [CURRENT_ISIN],
        )
        .unwrap();
        c.execute(
            "INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,
                action_type,ratio_num,ratio_den,factor,price_factor,parse_status,review_status)
             VALUES (1,'split-proof','NSE','NSE_API','SPLITCO',?,?,'2015-03-19',?,1,1,?,?,'PARSED','UNRESOLVED')",
            params![RAW_ISIN, purpose, action, factor, 1.0 / factor],
        )
        .unwrap();
        c.execute_batch(
            "INSERT INTO scan_runs(scope,action_types,started_at,status)
               VALUES ('official_imports','SPLIT,BONUS','2015-03-20T00:00:00Z','COMPLETED');
             INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close)
               VALUES ('SPLITCO','NSE','2015-03-18',990,1010,980,1000),
                      ('SPLITCO','NSE','2015-03-19',250,255,245,248);",
        )
        .unwrap();
        c.execute(
            "INSERT INTO corporate_action_scan_results
               (scan_run_id,corporate_action_import_id,symbol,exchange,scan_status,prev_trade_date,ex_trade_date,
                prev_close,ex_open,ex_close,expected_factor,actual_open_factor,actual_close_factor,confidence,scanned_at)
             VALUES (1,1,'SPLITCO','NSE',?,'2015-03-18','2015-03-19',1000,250,248,?,4.0,4.03,0.95,'2015-03-20T00:00:01Z')",
            params![scan_status, factor],
        )
        .unwrap();
        c
    }

    fn proven(c: &Connection) -> bool {
        let row = get_import_row(c, 1).unwrap();
        let suggestions = list_resolution_suggestions_for_import_row(c, &row).unwrap();
        let candidate = suggestions
            .iter()
            .find(|s| s.symbol == "SPLITCO")
            .expect("same-symbol candidate");
        evaluate(c, &row, candidate).unwrap()
    }

    const COMBINED: &str = "Bonus 1:1 / Face Value Split - From Rs 10/- Per Share To Rs 5/- Per Share";

    #[test]
    fn ca_phase2a_split_isin_price_proof_accepts_matched_combined_split() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        assert!(proven(&c));
        let result = quick_resolve_corporate_action_import_internal(
            &c,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.isin.as_deref(), Some(RAW_ISIN));
        assert_eq!(result.import_record.approved_corporate_action_id, None);
        let decision: String = c
            .query_row(
                "SELECT decision_type FROM corporate_action_import_decisions WHERE import_id=1 ORDER BY id DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(decision, DECISION);
        // The recorded machine decision is re-verified, not trusted forever.
        assert!(!identity_recheck::machine_identity_is_unproven(&c, &result.import_record).unwrap());
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r.get::<_, i64>(0)).unwrap(),
            0
        );
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_accepts_pending_isin_mismatch_status() {
        let c = fixture("Fv Splt Frm Rs 10 To Re 1", "SPLIT", 10.0, "MATCHED");
        c.execute("UPDATE corporate_action_imports SET review_status='PENDING_ISIN_MISMATCH'", []).unwrap();
        assert!(proven(&c));
        let result = quick_resolve_corporate_action_import_internal(
            &c,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.approved_corporate_action_id, None);
        c.execute("UPDATE corporate_action_imports SET review_status='NEEDS_REVIEW'", []).unwrap();
        assert!(!proven(&c), "other statuses stay out");
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_rejects_without_matched_prices() {
        for status in ["REVIEW", "NO_PRICE_DATA", "MISMATCH"] {
            let c = fixture(COMBINED, "BONUS", 2.0, status);
            assert!(!proven(&c), "{status}");
        }
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        c.execute("DELETE FROM corporate_action_scan_results", []).unwrap();
        assert!(!proven(&c));
    }

    #[test]
    fn pr25_split_isin_price_proof_rejects_prices_changed_after_scan() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        assert!(proven(&c));
        c.execute("UPDATE eod_prices SET close=260 WHERE symbol='SPLITCO' AND date='2015-03-19'", []).unwrap();
        assert!(!proven(&c), "corrected bar removes the proof");
        c.execute("DELETE FROM eod_prices WHERE symbol='SPLITCO' AND date='2015-03-19'", []).unwrap();
        assert!(!proven(&c), "deleted bar removes the proof");
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_rejects_bonus_without_split_terms() {
        let c = fixture("Bonus 1:1", "BONUS", 2.0, "MATCHED");
        assert!(!proven(&c));
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_rejects_non_equity_terms() {
        let c = fixture("Scheme Of Arrangement - Bonus Ncrps 4:1 and Split", "BONUS", 5.0, "MATCHED");
        assert!(!proven(&c));
        let c = fixture("Bonus Debentures and Face Value Split", "BONUS", 2.0, "MATCHED");
        assert!(!proven(&c));
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_rejects_other_issuer_type_or_owner() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        c.execute("UPDATE corporate_action_imports SET isin='INE111C01028'", []).unwrap();
        assert!(!proven(&c), "different issuer");
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        c.execute("UPDATE corporate_action_imports SET isin='INE669C02028'", []).unwrap();
        c.execute("UPDATE instruments SET isin='INE669C02036'", []).unwrap();
        assert!(!proven(&c), "not the equity security type");
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        c.execute(
            "INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES ('OTHERCO','NSE',?,'Other',0)",
            [RAW_ISIN],
        )
        .unwrap();
        assert!(!proven(&c), "old ISIN owned by another symbol");
    }

    #[test]
    fn ca_phase2a_split_isin_price_proof_rejects_stale_factor_scan() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        c.execute("UPDATE corporate_action_scan_results SET expected_factor=3.0", []).unwrap();
        assert!(!proven(&c));
    }
}

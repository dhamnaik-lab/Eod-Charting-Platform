//! Identity proof for a Split (or same-day Bonus + Split) whose own event changed
//! the equity ISIN. A shared issuer prefix alone is never enough. Every check
//! below must hold: same active symbol, an ordinary-equity split in the event
//! terms, the same issuer and equity security type, only dated linked inactive
//! predecessors as other ISIN owners, and a current MATCHED local price validation.
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

pub(super) fn event_includes_equity_split(row: &CorporateActionImportRow) -> bool {
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
pub(super) fn same_equity_issuer(raw: &str, current: &str) -> bool {
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
    // Every other owner, including historical-only owners, must be provably
    // inactive on this exchange and a recorded direct predecessor by the event.
    // Missing instrument/activity/date evidence fails closed.
    let disallowed_owner: bool = connection
        .query_row(
            "SELECT EXISTS (
                SELECT 1 FROM (
                    SELECT symbol,exchange FROM instruments WHERE upper(isin)=?
                    UNION
                    SELECT symbol,exchange FROM instrument_isin_history WHERE upper(isin)=?
                ) owners
                LEFT JOIN instruments owner ON owner.symbol=owners.symbol AND owner.exchange=owners.exchange
                WHERE NOT (owners.symbol=? AND owners.exchange=?)
                  AND (owners.exchange<>? OR COALESCE(owner.is_active,1)<>0 OR NOT EXISTS (
                    SELECT 1 FROM instrument_identity_history h
                    WHERE h.exchange=owners.exchange AND h.old_symbol=owners.symbol AND h.new_symbol=?
                      AND h.effective_date<=? AND date(h.effective_date)=h.effective_date
                  ))
             )",
            params![raw, raw, suggestion.symbol, suggestion.exchange, suggestion.exchange,
                suggestion.symbol, row.ex_date],
            |r| r.get(0),
        )
        .map_err(|error| error.to_string())?;
    if disallowed_owner {
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
pub(super) fn database_folder(connection: &Connection) -> AppResult<std::path::PathBuf> {
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

    fn predecessor(c: &Connection, active: i64, date: &str) {
        c.execute(
            "INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES ('OLDCO','NSE',?,'Old Co',?)",
            params![RAW_ISIN, active],
        ).unwrap();
        c.execute(
            "INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
             VALUES ('NSE','OLDCO',?,'2014-01-01','NSE_IDENTITY')",
            [RAW_ISIN],
        ).unwrap();
        c.execute(
            "INSERT INTO instrument_identity_history(exchange,isin,old_symbol,new_symbol,current_symbol,effective_date,change_type,source)
             VALUES ('NSE',?,'OLDCO','SPLITCO','SPLITCO',?,'SYMBOL_CHANGE','NSE_IDENTITY')",
            params![CURRENT_ISIN, date],
        ).unwrap();
    }

    #[test]
    fn ca_nse_remaining_split_isin_accepts_linked_inactive_predecessor() {
        for date in ["2015-03-18", "2015-03-19"] {
            let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
            predecessor(&c, 0, date);
            assert!(proven(&c), "link on or before event: {date}");
            // Historical raw-ISIN ownership also needs a provably inactive instrument.
            c.execute("UPDATE instruments SET isin=NULL WHERE symbol='OLDCO'", []).unwrap();
            assert!(proven(&c));
            let resolved = quick_resolve_corporate_action_import_internal(
                &c, &CorporateActionImportQuickResolveInput { import_id: 1 },
            ).unwrap().import_record;
            assert_eq!(resolved.review_status, "PENDING");
            assert_eq!(resolved.approved_corporate_action_id, None);
            assert!(!identity_recheck::machine_identity_is_unproven(&c, &resolved).unwrap());
            c.execute("UPDATE instruments SET is_active=1 WHERE symbol='OLDCO'", []).unwrap();
            assert!(identity_recheck::machine_identity_is_unproven(&c, &resolved).unwrap());
            assert_eq!(c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
        }
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        predecessor(&c, 0, "2015-03-18");
        c.execute("DELETE FROM instruments WHERE symbol='OLDCO'", []).unwrap();
        assert!(!proven(&c), "historical-only owner without activity evidence");
    }

    #[test]
    fn ca_nse_remaining_split_isin_rejects_active_owner() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        predecessor(&c, 1, "2015-03-18");
        assert!(!proven(&c));
        c.execute("UPDATE instruments SET is_active=0 WHERE symbol='OLDCO'", []).unwrap();
        assert!(proven(&c));
        c.execute("INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES ('SECOND','NSE',?,'Second',1)", [RAW_ISIN]).unwrap();
        assert!(!proven(&c), "every owner must qualify");
    }

    #[test]
    fn ca_nse_remaining_split_isin_rejects_unlinked_inactive_owner() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        predecessor(&c, 0, "2015-03-18");
        c.execute("DELETE FROM instrument_identity_history", []).unwrap();
        assert!(!proven(&c));
        c.execute("INSERT INTO instrument_identity_history(exchange,old_symbol,new_symbol,effective_date,change_type)
            VALUES ('NSE','SPLITCO','OLDCO','2015-03-18','SYMBOL_CHANGE')", []).unwrap();
        assert!(!proven(&c), "reverse transition does not link old to current");
        c.execute("UPDATE instrument_identity_history SET old_symbol='OLDCO',new_symbol='SPLITCO',exchange='BSE'", []).unwrap();
        assert!(!proven(&c), "link on another exchange does not qualify");
        c.execute("UPDATE instrument_identity_history SET exchange='NSE'", []).unwrap();
        assert!(proven(&c));
        c.execute("INSERT INTO instruments(symbol,exchange,isin,name,is_active) VALUES ('OLDCO','BSE',?,'Other exchange',0)", [RAW_ISIN]).unwrap();
        assert!(!proven(&c), "a cross-exchange owner still fails");
    }

    #[test]
    fn ca_nse_remaining_split_isin_rejects_later_link_and_retains_price_gates() {
        let c = fixture(COMBINED, "BONUS", 2.0, "MATCHED");
        predecessor(&c, 0, "2015-03-20");
        assert!(!proven(&c));
        c.execute("UPDATE instrument_identity_history SET effective_date='not-a-date'", []).unwrap();
        assert!(!proven(&c));
        c.execute("UPDATE instrument_identity_history SET effective_date='2015-03-18'", []).unwrap();
        assert!(proven(&c));
        c.execute("UPDATE corporate_action_scan_results SET scan_status='REVIEW'", []).unwrap();
        assert!(!proven(&c), "linked predecessor cannot bypass MATCHED scan");
        c.execute("UPDATE corporate_action_scan_results SET scan_status='MATCHED'", []).unwrap();
        c.execute("UPDATE eod_prices SET close=260 WHERE symbol='SPLITCO' AND date='2015-03-19'", []).unwrap();
        assert!(!proven(&c), "linked predecessor cannot bypass current price window");
    }

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

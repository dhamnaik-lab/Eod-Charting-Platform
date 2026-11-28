//! Revalidate old machine identity claims without changing source identity or financial data.
use super::*;

pub(super) fn machine_identity_is_unproven(
    c: &Connection,
    row: &CorporateActionImportRow,
) -> AppResult<bool> {
    if row.approved_corporate_action_id.is_some() || row.review_status == "APPROVED" {
        return Ok(false);
    }
    // A route decision must be revalidated before the exact-ISIN shortcut.
    if split_bonus_symbol_chain::has_decision(c, row.id)? {
        if !matches!(
            row.review_status.as_str(),
            "PENDING" | "UNRESOLVED" | "PENDING_ISIN_MISMATCH"
        ) {
            return Ok(false);
        }
        return Ok(split_bonus_symbol_chain::verified(
            c,
            &split_isin_price_proof::database_folder(c)?,
            row,
        )?
        .is_none());
    }
    let machine: bool = c.query_row("SELECT EXISTS(SELECT 1 FROM corporate_action_import_decisions
        WHERE import_id=? AND decision_type IN ('VERIFIED_QUICK_RESOLUTION',
        'VERIFIED_EVENT_IDENTITY_RESOLUTION','VERIFIED_HISTORICAL_ISIN_TRANSITION','COMPOUND_COMPONENT_PREPARED','VERIFIED_DATED_SYMBOL_CHAIN_R1',
        'VERIFIED_SPLIT_ISIN_PRICE_PROOF'))",
        [row.id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if !machine {
        return Ok(false);
    }
    let Some(symbol) = row.symbol.as_deref() else {
        return Ok(true);
    };
    // An unchanged complete current ISIN is an exact match, including an inactive
    // historical instrument. Shared issuer prefixes are deliberately insufficient.
    if let Some(instrument) = find_instrument_record(c, symbol, &row.exchange)? {
        if let (Some(raw), Some(current)) = (
            normalize_isin(row.isin.as_deref()),
            normalize_isin(instrument.isin.as_deref()),
        ) {
            if raw == current {
                return Ok(false);
            }
        }
    }
    let mut unresolved = row.clone();
    unresolved.review_status = "UNRESOLVED".to_string();
    let suggestions = list_resolution_suggestions_for_import_row(c, &unresolved)?;
    let latest:Option<String>=c.query_row("SELECT decision_type FROM corporate_action_import_decisions WHERE import_id=?
        AND decision_type IN ('VERIFIED_QUICK_RESOLUTION','VERIFIED_EVENT_IDENTITY_RESOLUTION','VERIFIED_HISTORICAL_ISIN_TRANSITION','VERIFIED_DATED_SYMBOL_CHAIN_R1') ORDER BY id DESC LIMIT 1",
        [row.id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    if latest.as_deref() == Some(dated_symbol_chain::DECISION) {
        let active: Vec<_> = suggestions.iter().filter(|s| s.is_active).collect();
        return if active.len() == 1 {
            Ok(!dated_symbol_chain::verify_persisted(
                c,
                &unresolved,
                active[0],
            )?)
        } else {
            Ok(true)
        };
    }
    Ok(
        !unique_proven_identity_suggestion(c, &unresolved, &suggestions)?
            .map(|(s, _)| s.symbol == symbol && s.exchange == row.exchange)
            .unwrap_or(false),
    )
}

pub(super) fn recheck_pending_machine_identity(
    c: &Connection,
    row: &CorporateActionImportRow,
) -> AppResult<()> {
    if !machine_identity_is_unproven(c, row)? {
        return Ok(());
    }
    let message = "Awaiting verified historical identity evidence. The app could not substantiate the previous machine match; no adjustment applied.";
    if row.review_status == "UNRESOLVED" && row.message.as_deref() == Some(message) {
        return Ok(());
    }
    c.execute(
        "UPDATE corporate_action_imports SET review_status='UNRESOLVED',message=?
        WHERE id=? AND approved_corporate_action_id IS NULL AND review_status<>'APPROVED'",
        params![message, row.id],
    )
    .map_err(|e| e.to_string())?;
    let updated = get_import_row(c, row.id)?;
    record_corporate_action_import_decision(c, row, &updated, "IDENTITY_PROOF_RECHECK",
        "Previous machine identity could not be independently revalidated; raw symbol/ISIN and official evidence retained.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires CA_VERIFIED_PAIR_AUDIT_ROOT containing a marked disposable database copy"]
    fn auto_id1_disposable_verified_rename_pair_audit() {
        let folder =
            std::path::PathBuf::from(std::env::var("CA_VERIFIED_PAIR_AUDIT_ROOT").unwrap())
                .canonicalize()
                .unwrap();
        let allowed = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tmp")
            .canonicalize()
            .unwrap();
        assert!(folder.starts_with(allowed));
        assert_eq!(
            std::fs::read_to_string(folder.join("VERIFIED_PAIR_AUDIT.txt")).unwrap(),
            "CA_VERIFIED_RENAME_PAIR_AUDIT"
        );
        let output = folder.join("verified-pair-results.json");
        assert!(!output.exists());
        // Open the copy directly: no application initialization, migrations,
        // price access, source collection or approval API is called.
        let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
        let tables: Vec<String> = c
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        let mut guards = 0;
        for table in tables.iter().filter(|t| {
            !matches!(
                t.as_str(),
                "corporate_action_imports" | "corporate_action_import_decisions"
            )
        }) {
            for operation in ["INSERT", "UPDATE", "DELETE"] {
                let name = format!("pair_guard_{}_{}", guards, operation);
                let table = table.replace('"', "\"\"");
                c.execute_batch(&format!("CREATE TEMP TRIGGER {name} BEFORE {operation} ON \"{table}\" BEGIN SELECT RAISE(ABORT,'audit forbids non-resolution writes'); END;")).unwrap();
                guards += 1;
            }
        }
        c.execute_batch("CREATE TEMP TRIGGER pair_guard_import_finance BEFORE UPDATE ON corporate_action_imports
            WHEN NEW.approved_corporate_action_id IS NOT OLD.approved_corporate_action_id OR NEW.approved_at IS NOT OLD.approved_at
            OR NEW.review_status='APPROVED' OR NEW.symbol IS NOT OLD.symbol OR NEW.isin IS NOT OLD.isin OR NEW.exchange IS NOT OLD.exchange
            OR NEW.cash_amount IS NOT OLD.cash_amount OR NEW.ex_date IS NOT OLD.ex_date OR NEW.action_type IS NOT OLD.action_type
            OR NEW.factor IS NOT OLD.factor OR NEW.price_factor IS NOT OLD.price_factor OR NEW.source IS NOT OLD.source OR NEW.purpose_raw IS NOT OLD.purpose_raw
            BEGIN SELECT RAISE(ABORT,'audit forbids approval or source identity changes'); END;
            CREATE TEMP TRIGGER pair_guard_import_insert BEFORE INSERT ON corporate_action_imports BEGIN SELECT RAISE(ABORT,'audit forbids import insert'); END;
            CREATE TEMP TRIGGER pair_guard_import_delete BEFORE DELETE ON corporate_action_imports BEGIN SELECT RAISE(ABORT,'audit forbids import delete'); END;").unwrap();
        let ids:Vec<i64>=c.prepare("SELECT i.id FROM corporate_action_imports i WHERE i.action_type='DIVIDEND'
            AND i.parse_status='PARSED' AND i.review_status='UNRESOLVED' AND i.approved_corporate_action_id IS NULL
            AND EXISTS(SELECT 1 FROM corporate_action_import_decisions d WHERE d.import_id=i.id AND d.decision_type='VERIFIED_EVENT_IDENTITY_RESOLUTION') ORDER BY i.id").unwrap()
            .query_map([],|r|r.get(0)).unwrap().collect::<Result<_,_>>().unwrap();
        assert!(!ids.is_empty());
        let mut reconciled = Vec::new();
        for id in &ids {
            let before = get_import_row(&c, *id).unwrap();
            if !build_resolution_hint_for_import_row(&c, &before)
                .unwrap()
                .quick_resolvable
            {
                continue;
            }
            let result = quick_resolve_corporate_action_import_internal(
                &c,
                &CorporateActionImportQuickResolveInput { import_id: *id },
            )
            .unwrap();
            assert_eq!(result.import_record.review_status, "PENDING");
            assert_eq!(result.import_record.approved_corporate_action_id, None);
            assert_eq!(result.import_record.symbol, before.symbol);
            assert_eq!(result.import_record.isin, before.isin);
            assert!(!machine_identity_is_unproven(&c, &result.import_record).unwrap());
            reconciled.push(*id);
        }
        assert!(!reconciled.is_empty());
        let result = serde_json::json!({"checked":ids.len(),"reconciled_pending":reconciled.len(),"remaining":ids.len()-reconciled.len(),
            "reconciled_ids":reconciled,"non_resolution_write_guards":guards,"financial_approvals":0,"source_identity_preserved":true});
        std::fs::write(output, serde_json::to_string_pretty(&result).unwrap()).unwrap();
        println!("VERIFIED_PAIR_AUDIT {}", result);
    }

    fn fixture(active: bool, status: &str) -> Connection {
        let c = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&c).unwrap();
        c.execute("INSERT INTO instruments(symbol,exchange,isin,is_active) VALUES ('TEST','NSE','INE123A01029',?)", [active as i64]).unwrap();
        c.execute("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,
            action_type,parse_status,review_status,ratio_num,ratio_den,factor,price_factor)
            VALUES (1,'test','NSE','NSE_API','TEST','INE123A01011','Bonus 1:1','2013-07-03','BONUS','PARSED',?,1,1,2,0.5)", [status]).unwrap();
        ensure_import_evidence(
            &c,
            1,
            "NSE_API",
            Some("official capture"),
            None,
            Some("TEST"),
            Some("INE123A01011"),
            None,
            Some("BONUS"),
            Some("2013-07-03"),
            Some(2.0),
            Some("retained raw payload"),
            None,
        )
        .unwrap();
        c
    }

    #[test]
    fn identity_recheck_rejects_prefix_and_forged_suggestion_flag() {
        let c = fixture(true, "UNRESOLVED");
        let row = get_import_row(&c, 1).unwrap();
        let mut suggestions = list_resolution_suggestions_for_import_row(&c, &row).unwrap();
        assert!(!suggestions[0].has_event_date_isin_evidence);
        suggestions[0].has_event_date_isin_evidence = true;
        assert!(strict_quick_resolve_proof(&c, &row, &suggestions[0])
            .unwrap()
            .is_none());
        assert!(quick_resolve_corporate_action_import_internal(
            &c,
            &CorporateActionImportQuickResolveInput { import_id: 1 }
        )
        .is_err());
        assert_eq!(get_import_row(&c, 1).unwrap().isin, row.isin);
    }

    #[test]
    fn identity_recheck_resolves_inactive_exact_history_without_reactivation() {
        let c = fixture(false, "UNRESOLVED");
        c.execute(
            "INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source)
            VALUES ('NSE','TEST','INE123A01011','2013-07-03','NSE_IDENTITY')",
            [],
        )
        .unwrap();
        let hint =
            build_resolution_hint_for_import_row(&c, &get_import_row(&c, 1).unwrap()).unwrap();
        assert_eq!(hint.status, "ONE_HISTORICAL");
        assert!(hint.quick_resolvable);
        let result = quick_resolve_corporate_action_import_internal(
            &c,
            &CorporateActionImportQuickResolveInput { import_id: 1 },
        )
        .unwrap();
        assert_eq!(result.import_record.review_status, "PENDING");
        assert_eq!(result.import_record.isin.as_deref(), Some("INE123A01011"));
        assert_eq!(
            c.query_row("SELECT is_active FROM instruments", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn identity_recheck_revokes_old_unproven_machine_claim_and_blocks_approval() {
        let c = fixture(true, "PENDING");
        c.execute(
            "INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason)
            VALUES (1,'VERIFIED_QUICK_RESOLUTION','Legacy issuer-prefix match')",
            [],
        )
        .unwrap();
        let row = get_import_row(&c, 1).unwrap();
        assert!(approve_corporate_action_import_without_transaction(
            &c,
            Path::new("."),
            1,
            false,
            false
        )
        .unwrap_err()
        .contains("Stored machine identity"));
        recheck_pending_machine_identity(&c, &row).unwrap();
        let updated = get_import_row(&c, 1).unwrap();
        assert_eq!(updated.review_status, "UNRESOLVED");
        assert_eq!(updated.isin, row.isin);
        assert_eq!(updated.symbol, row.symbol);
        assert_eq!(updated.evidence_count, row.evidence_count);
        recheck_pending_machine_identity(&c, &updated).unwrap();
        assert_eq!(c.query_row("SELECT count(*) FROM corporate_action_import_decisions WHERE decision_type='IDENTITY_PROOF_RECHECK'",[],|r|r.get::<_,i64>(0)).unwrap(),1);
        assert_eq!(
            c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }

    #[test]
    fn identity_recheck_rejects_wrong_date_and_conflicting_history() {
        let c = fixture(false, "UNRESOLVED");
        c.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES ('NSE','TEST','INE123A01011','2013-07-04')",[]).unwrap();
        assert!(
            !build_resolution_hint_for_import_row(&c, &get_import_row(&c, 1).unwrap())
                .unwrap()
                .quick_resolvable
        );
        c.execute(
            "UPDATE instrument_isin_history SET effective_date='2013-07-03'",
            [],
        )
        .unwrap();
        c.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES ('NSE','TEST','INE123A01029','2013-07-03')",[]).unwrap();
        assert!(
            !build_resolution_hint_for_import_row(&c, &get_import_row(&c, 1).unwrap())
                .unwrap()
                .quick_resolvable
        );
    }
}

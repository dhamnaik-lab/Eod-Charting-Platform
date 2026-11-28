use super::*;

const URL: &str = "https://nsearchives.nseindia.com/content/equities/symbolchange.csv";
const CSV:&str="NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nExample,OLD,MID,20-MAR-2020\nExample,MID,NEW,01-SEP-2021\n";

fn fixture() -> Connection {
    let c = Connection::open_in_memory().unwrap();
    crate::database::prepare_database_connection(&c).unwrap();
    c.execute_batch("INSERT INTO instruments(symbol,exchange,isin,name,series,is_active) VALUES
        ('NEW','NSE','INE123A01029','Example','EQ',1),('MID','NSE','INE123A01011','Example','EQ',0),('OLD','NSE','INE123A01011','Example','EQ',0);
        INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,cash_amount,parse_status,review_status)
        VALUES(1,'chain-fixture','NSE','NSE_API','NEW','INE123A01011','Dividend - Rs 2 Per Share','2018-07-30','DIVIDEND',2,'PARSED','UNRESOLVED');
        INSERT INTO instrument_identity_history(exchange,current_symbol,old_symbol,new_symbol,effective_date,change_type,source) VALUES
        ('NSE','NEW','OLD','MID','2020-03-20','SYMBOL_CHANGE','NSE_IDENTITY'),('NSE','NEW','MID','NEW','2021-09-01','SYMBOL_CHANGE','NSE_IDENTITY');
        INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date,source) VALUES
        ('NSE','OLD','INE123A01011','2018-07-30','NSE_IDENTITY'),('NSE','MID','INE123A01011','2018-07-30','NSE_IDENTITY');
        INSERT INTO eod_prices(symbol,exchange,date,open,high,low,close,volume,open_interest) VALUES
        ('NEW','NSE','2018-07-27',100,100,100,100,1000,0),('NEW','NSE','2018-07-30',98,98,98,98,1000,0);").unwrap();
    retain_source(&c, URL, CSV.as_bytes()).unwrap();
    let row = get_import_row(&c, 1).unwrap();
    let raw = build_import_evidence_raw_reference(
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        None,
        &row.purpose_raw,
        row.ex_date.as_deref(),
        None,
    )
    .unwrap();
    ensure_import_evidence(
        &c,
        1,
        "NSE_API",
        Some("https://www.nseindia.com/api/corporates-corporateActions?index=equities"),
        None,
        row.symbol.as_deref(),
        row.isin.as_deref(),
        None,
        Some("DIVIDEND"),
        row.ex_date.as_deref(),
        None,
        Some(&raw),
        Some("Fresh official fetch"),
    )
    .unwrap();
    c
}
fn target(c: &Connection) -> CorporateActionImportResolutionSuggestion {
    list_resolution_suggestions_for_import_row(c, &get_import_row(c, 1).unwrap())
        .unwrap()
        .into_iter()
        .find(|s| s.symbol == "NEW")
        .unwrap()
}

#[test]
fn ca_a1_gujgas_split_cannot_borrow_the_dividend_chain_proof() {
    let c = fixture();
    // Exact edge captured from the official symbolchange.csv on 8 November 2026.
    let csv = b"NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE\nGUJARAT ENERGY LIMITED,GUJGASLTD,GUJENERGY,01-JUL-2026\n";
    retain_source(&c, URL, csv).unwrap();
    let parsed =
        super::super::super::nse_identity_imports::parse_ca_symbol_change_source(csv).unwrap();
    assert_eq!(parsed.len(), 1);
    assert_eq!(parsed[0].0, "GUJGASLTD");
    assert_eq!(parsed[0].1, "GUJENERGY");
    assert_eq!(parsed[0].2, "2026-07-01");

    c.execute_batch(
        "UPDATE instruments SET symbol='GUJENERGY',isin='INE844O01030' WHERE symbol='NEW';
        UPDATE corporate_action_imports SET symbol='GUJGASLTD',isin='INE844O01022',
        ex_date='2019-01-15',action_type='SPLIT',purpose_raw='Face Value Split',cash_amount=NULL
        WHERE id=1;",
    )
    .unwrap();
    let before = get_import_row(&c, 1).unwrap();
    let s = CorporateActionImportResolutionSuggestion {
        symbol: "GUJENERGY".to_string(),
        exchange: "NSE".to_string(),
        name: None,
        series: Some("EQ".to_string()),
        isin: Some("INE844O01030".to_string()),
        is_active: true,
        has_event_date_isin_evidence: false,
        reason: "Official rename is metadata, not split approval proof".to_string(),
    };
    assert!(evaluate(&c, &before, &s).unwrap().is_none());
    assert!(!verify_persisted(&c, &before, &s).unwrap());
    let after = get_import_row(&c, 1).unwrap();
    assert_eq!(after.symbol, before.symbol);
    assert_eq!(after.isin, before.isin);
    assert_eq!(after.purpose_raw, before.purpose_raw);
    assert_eq!(after.review_status, "UNRESOLVED");
    assert_eq!(after.approved_corporate_action_id, None);
}

fn eligible(c: &Connection) -> bool {
    matches!(
        super::super::auto_approval::evaluate_simple_cash_dividend_policy_r1(c, Path::new("."), 1)
            .unwrap(),
        super::super::auto_approval::SimpleCashDividendPolicyEligibility::Eligible(_)
    )
}

#[test]
fn dated_chain_reconciles_three_names_offline_and_keeps_approval_explicit() {
    let c = fixture();
    let row = get_import_row(&c, 1).unwrap();
    let s = target(&c);
    let proof = evaluate(&c, &row, &s).unwrap().unwrap();
    assert_eq!(proof.event_symbol, "OLD");
    assert!(!verify_persisted(&c, &row, &s).unwrap());
    let hint = build_resolution_hint_for_import_row(&c, &row).unwrap();
    assert!(hint.quick_resolvable);
    let result = quick_resolve_corporate_action_import_internal(
        &c,
        &CorporateActionImportQuickResolveInput { import_id: 1 },
    )
    .unwrap();
    assert_eq!(result.import_record.review_status, "PENDING");
    assert_eq!(result.import_record.symbol, row.symbol);
    assert_eq!(result.import_record.isin, row.isin);
    assert!(verify_persisted(&c, &result.import_record, &s).unwrap());
    assert!(eligible(&c));
    assert!(
        !super::super::identity_recheck::machine_identity_is_unproven(&c, &result.import_record)
            .unwrap()
    );
    assert_eq!(
        c.query_row("SELECT count(*) FROM corporate_actions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(result.import_record.approved_corporate_action_id, None);
}

#[test]
fn dated_chain_transition_dates_are_half_open_and_no_interval_is_invented() {
    let edges =
        super::super::super::nse_identity_imports::parse_ca_symbol_change_source(CSV.as_bytes())
            .unwrap()
            .into_iter()
            .map(|(old, new, date, line)| Edge {
                old,
                new,
                date,
                line,
            })
            .collect::<Vec<_>>();
    for (date, symbol) in [
        ("2018-07-30", "OLD"),
        ("2020-03-19", "OLD"),
        ("2020-03-20", "MID"),
        ("2021-08-31", "MID"),
        ("2021-09-01", "NEW"),
    ] {
        assert_eq!(path(&edges, "NEW", date).unwrap().1, symbol);
    }
    assert!(path(&edges, "NEW", "invalid-date").is_none());
}

#[test]
fn dated_chain_rejects_forks_merges_cycles_and_non_monotonic_dates() {
    for tail in [
        "Example,OLD,OTHER,21-MAR-2020\n",
        "Example,OTHER,NEW,02-SEP-2021\n",
        "Example,NEW,OLD,02-SEP-2021\n",
    ] {
        let c = fixture();
        retain_source(&c, URL, format!("{CSV}{tail}").as_bytes()).unwrap();
        assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
            .unwrap()
            .is_none());
    }
    let c = fixture();
    retain_source(
        &c,
        URL,
        CSV.replace("01-SEP-2021", "01-SEP-2019").as_bytes(),
    )
    .unwrap();
    assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
        .unwrap()
        .is_none());
}

#[test]
fn dated_chain_rejects_legacy_backfills_and_conflicting_or_duplicate_witnesses() {
    let c = fixture();
    c.execute("UPDATE corporate_action_import_evidence SET note='Backfilled from an existing corporate_action_imports row'",[]).unwrap();
    assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
        .unwrap()
        .is_none());
    c.execute("UPDATE corporate_action_import_evidence SET note='Fresh official fetch',isin_seen='INE999A01011'",[]).unwrap();
    assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
        .unwrap()
        .is_none());
    let c = fixture();
    c.execute("INSERT INTO corporate_action_import_evidence(import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,event_date_seen,action_type_seen,raw_reference,note)
        SELECT import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,event_date_seen,action_type_seen,raw_reference,note FROM corporate_action_import_evidence WHERE import_id=1",[]).unwrap();
    assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
        .unwrap()
        .is_none());
}

#[test]
fn dated_chain_rejects_active_alias_and_unrelated_proven_target() {
    let c = fixture();
    c.execute("UPDATE instruments SET is_active=1 WHERE symbol='MID'", [])
        .unwrap();
    assert!(evaluate(&c, &get_import_row(&c, 1).unwrap(), &target(&c))
        .unwrap()
        .is_none());
    let c = fixture();
    let row = get_import_row(&c, 1).unwrap();
    let mut suggestions = list_resolution_suggestions_for_import_row(&c, &row).unwrap();
    let mut other = suggestions
        .iter()
        .find(|s| s.symbol == "OLD")
        .unwrap()
        .clone();
    other.symbol = "UNRELATED".to_string();
    c.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES('NSE','UNRELATED','INE123A01011','2018-07-30')",[]).unwrap();
    suggestions.push(other);
    assert!(unique_proven_identity_suggestion(&c, &row, &suggestions)
        .unwrap()
        .is_none());
}

#[test]
fn dated_chain_rechecks_source_witness_import_context_and_stored_proof() {
    for sql in ["UPDATE corporate_action_symbol_chain_sources SET raw_csv=x'00'", "UPDATE corporate_action_import_evidence SET raw_reference='{}'",
        "UPDATE corporate_action_symbol_chain_proofs SET fingerprint='tampered'", "UPDATE corporate_action_imports SET ex_date='2018-07-31'",
        "UPDATE corporate_action_imports SET cash_amount=3", "UPDATE corporate_action_symbol_chain_proofs SET proof_json=replace(proof_json,'CA_DATED_SYMBOL_CHAIN_R1','OTHER_DATABASE')"] {
        let c=fixture();quick_resolve_corporate_action_import_internal(&c,&CorporateActionImportQuickResolveInput{import_id:1}).unwrap();assert!(eligible(&c));
        c.execute(sql,[]).unwrap();let row=get_import_row(&c,1).unwrap();
        assert!(!verify_persisted(&c,&row,&target(&c)).unwrap_or(false));
        assert!(!matches!(super::super::auto_approval::evaluate_simple_cash_dividend_policy_r1(&c,Path::new("."),1),Ok(super::super::auto_approval::SimpleCashDividendPolicyEligibility::Eligible(_))));
    }
}

#[test]
fn dated_chain_source_refresh_and_peer_checks_remain_conservative() {
    let c = fixture();
    quick_resolve_corporate_action_import_internal(
        &c,
        &CorporateActionImportQuickResolveInput { import_id: 1 },
    )
    .unwrap();
    assert!(eligible(&c));
    // A fresh validated cache makes no network request (the test downloader is disabled).
    collect(&c, false).unwrap();
    retain_source(
        &c,
        URL,
        format!("{CSV}Unrelated,X,Y,01-JAN-2022\n").as_bytes(),
    )
    .unwrap();
    assert!(!verify_persisted(&c, &get_import_row(&c, 1).unwrap(), &target(&c)).unwrap());
    assert!(!eligible(&c));
    super::super::identity_recheck::recheck_pending_machine_identity(
        &c,
        &get_import_row(&c, 1).unwrap(),
    )
    .unwrap();
    assert_eq!(get_import_row(&c, 1).unwrap().review_status, "UNRESOLVED");
    quick_resolve_corporate_action_import_internal(
        &c,
        &CorporateActionImportQuickResolveInput { import_id: 1 },
    )
    .unwrap();
    assert!(eligible(&c));
    c.execute("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,purpose_raw,ex_date,action_type,parse_status,review_status)
        VALUES(2,'peer','NSE','NSE_API','NEW','INE123A01011','Split','2018-07-30','SPLIT','PARSED','PENDING')",[]).unwrap();
    assert!(!eligible(&c));
    assert!(retain_source(&c, "https://example.com/symbolchange.csv", CSV.as_bytes()).is_err());
}

#[test]
fn dated_chain_database_context_and_missing_source_never_reuse_persisted_authority() {
    let c = fixture();
    quick_resolve_corporate_action_import_internal(
        &c,
        &CorporateActionImportQuickResolveInput { import_id: 1 },
    )
    .unwrap();
    let s = target(&c);
    let row = get_import_row(&c, 1).unwrap();
    let mut proof = evaluate(&c, &row, &s).unwrap().unwrap();
    proof.database = "different database".to_string();
    proof.store(&c).unwrap();
    assert!(!verify_persisted(&c, &row, &s).unwrap());
    assert!(!eligible(&c));
    c.execute("DELETE FROM corporate_action_symbol_chain_sources", [])
        .unwrap();
    assert!(!verify_persisted(&c, &row, &s).unwrap());
    assert!(!eligible(&c));
}

#[test]
fn dated_chain_does_not_explain_post_rename_isin_mismatch_or_forged_target_isin() {
    let c = fixture();
    let row = get_import_row(&c, 1).unwrap();
    let mut s = target(&c);
    s.isin = Some("INE999A01011".to_string());
    assert!(evaluate(&c, &row, &s).unwrap().is_none());
    let mut row = row;
    row.ex_date = Some("2021-09-01".to_string());
    assert!(evaluate(&c, &row, &target(&c)).unwrap().is_none());
}

#[test]
#[ignore = "requires CA_DATED_CHAIN_AUDIT_ROOT with a marked disposable copy and official symbolchange.csv"]
fn dated_chain_disposable_preparation_and_policy_audit() {
    let folder = std::path::PathBuf::from(std::env::var("CA_DATED_CHAIN_AUDIT_ROOT").unwrap())
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
        std::fs::read_to_string(folder.join("DATED_CHAIN_AUDIT.txt")).unwrap(),
        "CA_DATED_CHAIN_AUDIT"
    );
    let output = folder.join("dated-chain-results.json");
    assert!(!output.exists());
    let c = Connection::open(folder.join("market-data.sqlite3")).unwrap();
    retain_source(
        &c,
        URL,
        &std::fs::read(folder.join("symbolchange.csv")).unwrap(),
    )
    .unwrap();
    // Optional fresh, byte-retained official response. Exercise the same field
    // parser and evidence writer as Fetch without rewriting source imports.
    let response_path = folder.join("official-response.json");
    let mut fresh_witnesses = 0;
    if response_path.exists() {
        let manifest: Value = serde_json::from_slice(
            &std::fs::read(folder.join("official-response-manifest.json")).unwrap(),
        )
        .unwrap();
        let bytes = std::fs::read(response_path).unwrap();
        assert_eq!(hash(&bytes), manifest["sha256"].as_str().unwrap());
        assert_eq!(manifest["status"].as_u64(), Some(200));
        let locator = manifest["url"].as_str().unwrap();
        let captured = manifest["captured_at"].as_str().unwrap();
        assert!(locator.starts_with("https://www.nseindia.com/api/corporates-corporateActions?"));
        let rows: Value = serde_json::from_slice(&bytes).unwrap();
        for id in [20928, 22118, 24836, 26670] {
            let import = get_import_row(&c, id).unwrap();
            let matching: Vec<_> = rows
                .as_array()
                .unwrap()
                .iter()
                .filter(|raw| {
                    json_text(raw, &["symbol"]) == import.symbol
                        && json_text(raw, &["isin"]) == import.isin
                        && json_text(raw, &["subject"]).map(|s| s.trim().to_string())
                            == Some(import.purpose_raw.clone())
                        && json_text(raw, &["exDate"]).and_then(|s| parse_official_date(&s).ok())
                            == import.ex_date
                })
                .collect();
            assert_eq!(matching.len(), 1, "fresh exact witness for {id}");
            let raw = matching[0];
            let candidate = build_import_candidate_from_fields(
                &c,
                "NSE",
                "NSE_API",
                Some(locator.to_string()),
                json_text(raw, &["symbol"]),
                json_text(raw, &["isin"]),
                None,
                json_text(raw, &["comp", "companyName"]),
                json_text(raw, &["subject"]).unwrap().trim().to_string(),
                json_text(raw, &["exDate"]).and_then(|s| parse_official_date(&s).ok()),
                json_text(raw, &["recDate"]).and_then(|s| parse_official_date(&s).ok()),
            )
            .unwrap();
            ensure_candidate_import_evidence(&c, id, &candidate, Some(captured)).unwrap();
            fresh_witnesses += 1;
        }
    }
    let tables: Vec<String> = c
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    let mut guards = 0;
    for t in tables.iter().filter(|t| {
        !matches!(
            t.as_str(),
            "corporate_action_imports"
                | "corporate_action_import_decisions"
                | "corporate_action_symbol_chain_proofs"
        )
    }) {
        for op in ["INSERT", "UPDATE", "DELETE"] {
            let name = t.replace('"', "\"\"");
            c.execute_batch(&format!("CREATE TEMP TRIGGER dated_guard_{guards} BEFORE {op} ON \"{name}\" BEGIN SELECT RAISE(ABORT,'audit forbids non-resolution writes'); END;")).unwrap();
            guards += 1;
        }
    }
    c.execute_batch("CREATE TEMP TRIGGER dated_import_guard BEFORE UPDATE ON corporate_action_imports
        WHEN NEW.symbol IS NOT OLD.symbol OR NEW.isin IS NOT OLD.isin OR NEW.exchange IS NOT OLD.exchange
        OR NEW.approved_corporate_action_id IS NOT OLD.approved_corporate_action_id OR NEW.approved_at IS NOT OLD.approved_at
        OR NEW.review_status='APPROVED' OR NEW.cash_amount IS NOT OLD.cash_amount OR NEW.ex_date IS NOT OLD.ex_date
        OR NEW.action_type IS NOT OLD.action_type OR NEW.factor IS NOT OLD.factor OR NEW.price_factor IS NOT OLD.price_factor
        OR NEW.source IS NOT OLD.source OR NEW.purpose_raw IS NOT OLD.purpose_raw
        BEGIN SELECT RAISE(ABORT,'audit forbids identity/financial changes'); END;
        CREATE TEMP TRIGGER dated_import_insert BEFORE INSERT ON corporate_action_imports BEGIN SELECT RAISE(ABORT,'no inserts'); END;
        CREATE TEMP TRIGGER dated_import_delete BEFORE DELETE ON corporate_action_imports BEGIN SELECT RAISE(ABORT,'no deletes'); END;").unwrap();
    let ids:Vec<i64>=c.prepare("SELECT i.id FROM corporate_action_imports i WHERE i.action_type='DIVIDEND'
        AND i.parse_status='PARSED' AND i.review_status='UNRESOLVED' AND i.approved_corporate_action_id IS NULL
        AND EXISTS(SELECT 1 FROM corporate_action_import_decisions d WHERE d.import_id=i.id AND d.decision_type='VERIFIED_EVENT_IDENTITY_RESOLUTION') ORDER BY i.id").unwrap()
        .query_map([],|r|r.get(0)).unwrap().collect::<Result<_,_>>().unwrap();
    assert!(!ids.is_empty());
    let mut legacy_recovered = 0;
    let mut new_recovered = 0;
    let mut unready = 0;
    let mut fresh_policy_results = Vec::new();
    for id in &ids {
        let before = get_import_row(&c, *id).unwrap();
        let suggestions = list_resolution_suggestions_for_import_row(&c, &before).unwrap();
        let new = suggestions
            .iter()
            .any(|s| evaluate(&c, &before, s).unwrap().is_some());
        if build_resolution_hint_for_import_row(&c, &before)
            .unwrap()
            .quick_resolvable
        {
            let after = quick_resolve_corporate_action_import_internal(
                &c,
                &CorporateActionImportQuickResolveInput { import_id: *id },
            )
            .unwrap()
            .import_record;
            assert_eq!(after.symbol, before.symbol);
            assert_eq!(after.isin, before.isin);
            assert_eq!(after.approved_corporate_action_id, None);
            if new {
                new_recovered += 1;
                let policy = super::super::auto_approval::evaluate_simple_cash_dividend_policy_r1(
                    &c, &folder, *id,
                )
                .unwrap();
                fresh_policy_results
                    .push(serde_json::json!({"import_id":id,"policy":format!("{policy:?}")}));
            } else {
                legacy_recovered += 1;
            }
        } else {
            assert!(matches!(
                super::super::auto_approval::evaluate_simple_cash_dividend_policy_r1(
                    &c, &folder, *id
                )
                .unwrap(),
                super::super::auto_approval::SimpleCashDividendPolicyEligibility::Ineligible(_)
            ));
            unready += 1;
        }
    }
    if fresh_witnesses > 0 {
        assert_eq!(fresh_witnesses, 4);
        assert_eq!(new_recovered, 4);
        assert_eq!(unready, 0);
        assert_eq!(fresh_policy_results.len(), 4);
    }
    let result = serde_json::json!({"checked":ids.len(),"existing_pair_pending":legacy_recovered,"new_chain_pending":new_recovered,
        "remaining_identity_unresolved":unready,"fresh_witnesses":fresh_witnesses,"fresh_policy_results":fresh_policy_results,
        "financial_approvals":0,"non_resolution_write_guards":guards,"source_identity_preserved":true});
    std::fs::write(output, serde_json::to_string_pretty(&result).unwrap()).unwrap();
    println!("DATED_CHAIN_AUDIT {}", result);
}

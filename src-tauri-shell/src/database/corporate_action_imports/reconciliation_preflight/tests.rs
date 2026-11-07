use super::*;

    fn fixture() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE instruments (
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  name TEXT,
                  is_active INTEGER NOT NULL DEFAULT 1,
                  series TEXT,
                  -- Read by the shared instrument lookup used by the Safe V2 same-date peer check.
                  sector TEXT,
                  industry TEXT
                );
                CREATE TABLE instrument_identity_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  current_symbol TEXT,
                  current_name TEXT,
                  old_symbol TEXT,
                  old_name TEXT,
                  new_symbol TEXT,
                  new_name TEXT,
                  effective_date TEXT NOT NULL,
                  change_type TEXT NOT NULL,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT DEFAULT (datetime('now')),
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE instrument_isin_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  exchange TEXT NOT NULL,
                  symbol TEXT NOT NULL,
                  isin TEXT NOT NULL,
                  effective_date TEXT,
                  source TEXT,
                  source_ref TEXT,
                  note TEXT,
                  created_at TEXT DEFAULT (datetime('now')),
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE corporate_action_imports (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dedupe_key TEXT NOT NULL UNIQUE,
                  exchange TEXT NOT NULL,
                  source TEXT NOT NULL,
                  source_file TEXT,
                  symbol TEXT,
                  isin TEXT,
                  bse_scrip_code TEXT,
                  company_name TEXT,
                  purpose_raw TEXT NOT NULL,
                  ex_date TEXT,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  factor REAL,
                  price_factor REAL,
                  parse_status TEXT NOT NULL,
                  review_status TEXT NOT NULL,
                  message TEXT,
                  approved_corporate_action_id INTEGER,
                  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                  approved_at TEXT
                );
                CREATE TABLE corporate_action_import_evidence (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  source_code TEXT NOT NULL,
                  source_locator TEXT,
                  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
                  symbol_seen TEXT,
                  isin_seen TEXT,
                  company_name_seen TEXT,
                  action_type_seen TEXT,
                  event_date_seen TEXT,
                  factor_seen REAL,
                  raw_reference TEXT,
                  note TEXT
                );
                CREATE TABLE corporate_action_import_decisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  import_id INTEGER NOT NULL,
                  decision_type TEXT NOT NULL,
                  previous_symbol TEXT,
                  previous_exchange TEXT,
                  previous_isin TEXT,
                  resolved_symbol TEXT,
                  resolved_exchange TEXT,
                  resolved_isin TEXT,
                  reason TEXT NOT NULL,
                  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE scan_runs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scope TEXT NOT NULL,
                  action_types TEXT NOT NULL,
                  started_at TEXT NOT NULL,
                  completed_at TEXT,
                  status TEXT NOT NULL,
                  message TEXT,
                  total_results INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE corporate_action_scan_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  scan_run_id INTEGER NOT NULL,
                  corporate_action_import_id INTEGER,
                  corporate_action_id INTEGER,
                  symbol TEXT,
                  exchange TEXT NOT NULL,
                  scan_status TEXT NOT NULL,
                  prev_trade_date TEXT,
                  ex_trade_date TEXT,
                  prev_close REAL,
                  ex_open REAL,
                  ex_close REAL,
                  expected_factor REAL,
                  actual_open_factor REAL,
                  actual_close_factor REAL,
                  confidence REAL,
                  message TEXT,
                  scanned_at TEXT NOT NULL
                );
                CREATE TABLE corporate_actions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol TEXT NOT NULL,
                  exchange TEXT NOT NULL,
                  isin TEXT,
                  effective_date TEXT NOT NULL,
                  record_date TEXT,
                  action_type TEXT NOT NULL,
                  factor REAL,
                  ratio_num REAL,
                  ratio_den REAL,
                  old_face_value REAL,
                  new_face_value REAL,
                  cash_amount REAL,
                  adjust_volume INTEGER,
                  note TEXT,
                  source TEXT,
                  source_ref TEXT,
                  created_at TEXT,
                  updated_at TEXT,
                  applied_at TEXT
                );
                INSERT INTO instruments(symbol, exchange, isin, name, is_active, series)
                VALUES ('TEST', 'NSE', 'INEAUTO01001', 'Test Limited', 1, 'EQ');
                ",
            )
            .unwrap();
        connection
    }


fn seed(c: &Connection, id: i64, state: &str) {
 c.execute("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,old_face_value,new_face_value,factor,price_factor,parse_status,review_status) VALUES(?,?,'NSE','NSE_API','TEST','INEAUTO01001','Test Limited','Face Value Split from Rs 10 to Rs 5','2026-08-14','SPLIT',10,5,2,0.5,'PARSED',?)",params![id,format!("r1a-{id}"),state]).unwrap();
}
fn scan(c: &Connection, id: i64, status: &str, confidence: f64, factor: f64) {
 c.execute("INSERT INTO scan_runs(id,scope,action_types,started_at,completed_at,status) VALUES(?,'official_imports','SPLIT,BONUS','2026-08-14','2026-08-14','COMPLETED')",[id]).unwrap();
 c.execute("INSERT INTO corporate_action_scan_results(id,scan_run_id,corporate_action_import_id,symbol,exchange,scan_status,prev_trade_date,ex_trade_date,prev_close,ex_open,ex_close,expected_factor,actual_open_factor,actual_close_factor,confidence,message,scanned_at) VALUES(?,?,?,'TEST','NSE',?,'2026-08-13','2026-08-14',100,50,50,?,?,?,?,NULL,'2026-08-14T10:00:00Z')",params![id,id,id,status,factor,factor,factor,confidence]).unwrap();
}
fn input(ids: Vec<i64>) -> CorporateActionReconciliationPreflightInput { CorporateActionReconciliationPreflightInput {import_ids:ids, expected_database_path:"E:/TEST".into(), request_token:"test".into()} }
fn run(c:&Connection, ids:Vec<i64>)->CorporateActionReconciliationPreflightResult {
 c.pragma_update(None,"query_only",true).unwrap();
 preflight_with_connection(c,&input(ids),"E:/TEST","fixture","fixture-build")
}
fn codes(r:&CorporateActionReconciliationPreflightRow)->Vec<&str>{r.blockers.iter().map(|b|b.code.as_str()).collect()}
fn canonical(c:&Connection,id:i64,factor:f64){c.execute("INSERT INTO corporate_actions(id,symbol,exchange,isin,effective_date,action_type,factor,old_face_value,new_face_value,adjust_volume,applied_at) VALUES(?,'TEST','NSE','INEAUTO01001','2026-08-14','SPLIT',?,10,5,1,'2026-08-14T00:00:00Z')",params![id,factor]).unwrap();}

#[test] fn r1a_preflight_accounts_for_missing_and_duplicate_ids(){let c=fixture();seed(&c,1,"UNRESOLVED");let r=run(&c,vec![1,1,999999]);assert_eq!(r.selection.requested_count,3);assert_eq!(r.selection.duplicate_count,1);assert_eq!(r.rows.iter().map(|x|x.import_id).collect::<Vec<_>>(),vec![1,999999]);assert_eq!(r.rows[1].outcome,"MISSING_IMPORT");assert_eq!(r.status,"PARTIAL");}
#[test] fn r1a_preflight_rejects_invalid_ids_and_limits(){let c=fixture();for ids in [vec![],vec![0],vec![-1],vec![9_007_199_254_740_992],vec![1;501]]{assert_eq!(run(&c,ids).status,"REJECTED");}}
#[test] fn r1a_preflight_accepts_500_unique_valid_ids(){let c=fixture();let r=run(&c,(1..=500).collect());assert_eq!(r.rows.len(),500);assert_eq!(r.summary.accounted_for,500);}
#[test] fn r1a_preflight_requires_read_only_connection(){let c=fixture();let r=preflight_with_connection(&c,&input(vec![1]),"E:/TEST","fixture","b");assert_eq!(r.status,"REJECTED");assert!(c.is_autocommit());}
#[test] fn r1a_preflight_preserves_business_tables_and_schema(){let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);let before=logical_database_fingerprint(&c).unwrap();let changes:i64=c.query_row("SELECT total_changes()",[],|r|r.get(0)).unwrap();let r=run(&c,vec![1]);assert_eq!(r.status,"COMPLETE");assert_eq!(logical_database_fingerprint(&c).unwrap(),before);assert_eq!(c.query_row("SELECT total_changes()",[],|r|r.get::<_,i64>(0)).unwrap(),changes);assert!(c.execute("UPDATE corporate_action_imports SET review_status='APPROVED'",[]).is_err());assert_eq!(r.approval_writes,0);assert_eq!(r.executed_repairs,0);}
#[test] fn r1a_preflight_preserves_isin_mismatch_gate(){let c=fixture();seed(&c,1,"PENDING_ISIN_MISMATCH");scan(&c,1,"MATCHED",0.99,2.0);let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"ISIN_MISMATCH_BOUNDARY"));assert_eq!(r.rows[0].safe_v1.state,"INELIGIBLE");assert_eq!(r.rows[0].stored_state.review_status.as_deref(),Some("PENDING_ISIN_MISMATCH"));}
#[test] fn r1a_preflight_keeps_alias_as_candidate(){let c=fixture();seed(&c,1,"UNRESOLVED");c.execute("UPDATE corporate_action_imports SET isin='OLDISIN'",[]).unwrap();c.execute("INSERT INTO instruments(symbol,exchange,isin,is_active) VALUES('OLD','NSE','OLDISIN',0)",[]).unwrap();c.execute("INSERT INTO instrument_identity_history(exchange,isin,old_symbol,new_symbol,current_symbol,effective_date,change_type) VALUES('NSE','OLDISIN','OLD','TEST','TEST','2021-01-01','SYMBOL_CHANGE')",[]).unwrap();c.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES('NSE','OLD','OLDISIN','2026-08-14')",[]).unwrap();let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"IDENTITY_ALIAS_EVIDENCE_CANDIDATE"));assert_eq!(r.rows[0].outcome,"REPAIR_CANDIDATE");assert!(r.rows[0].repair_plan.iter().all(|p|!p.executed));}
#[test] fn r1a_preflight_no_active_is_not_not_applicable(){let c=fixture();seed(&c,1,"UNRESOLVED");c.execute("UPDATE instruments SET is_active=0",[]).unwrap();let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"IDENTITY_NO_ACTIVE_CANDIDATE"));assert_ne!(r.rows[0].blocks_in_scope_completeness,Some(false));}
#[test] fn r1a_preflight_ambiguous_identity_fails_closed() {
    let c=fixture();
    seed(&c,1,"UNRESOLVED");
    c.execute("INSERT INTO instruments(symbol,exchange,isin,is_active) VALUES('OTHER','NSE','INEAUTO01001',1)",[]).unwrap();
    c.execute("INSERT INTO instrument_identity_history(exchange,isin,old_symbol,new_symbol,current_symbol,effective_date,change_type) VALUES('NSE','INEAUTO01001','TEST','OTHER','OTHER','2021-01-01','SYMBOL_CHANGE')",[]).unwrap();
    let r=run(&c,vec![1]);
    assert!(codes(&r.rows[0]).contains(&"IDENTITY_AMBIGUOUS"));
}#[test] fn r1a_preflight_missing_schema_does_not_migrate(){let c=Connection::open_in_memory().unwrap();let r=run(&c,vec![1]);assert_eq!(r.status,"REJECTED");assert_eq!(r.global_blockers[0].code,"SCHEMA_UNSUPPORTED");assert_eq!(c.query_row("SELECT count(*) FROM sqlite_master",[],|r|r.get::<_,i64>(0)).unwrap(),0);}
#[test] fn r1a_preflight_same_date_different_factor_not_equivalent(){let c=fixture();seed(&c,1,"PENDING");canonical(&c,1,3.0);let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"CANONICAL_CONFLICT"));assert_ne!(r.rows[0].canonical.state,"LINKED_RECORD_PRESENT");}
#[test] fn r1a_preflight_multiple_canonicals_reported(){let c=fixture();seed(&c,1,"PENDING");canonical(&c,1,2.0);canonical(&c,2,2.0);let r=run(&c,vec![1]);assert_eq!(r.rows[0].canonical.candidate_ids,vec![1,2]);assert_eq!(r.rows[0].canonical.state,"MULTIPLE_OR_CONFLICTING");}
#[test] fn r1a_preflight_broken_approved_link_not_complete(){let c=fixture();seed(&c,1,"APPROVED");c.execute("UPDATE corporate_action_imports SET approved_corporate_action_id=99",[]).unwrap();let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"CANONICAL_CONFLICT"));assert_ne!(r.rows[0].blocks_in_scope_completeness,Some(false));assert!(!r.summary.database_complete);}
#[test] fn r1a_preflight_manual_match_not_safe_v1(){let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.94,2.0);let r=run(&c,vec![1]);assert_eq!(r.rows[0].ordinary_readiness.state,"READY_FOR_WRITER_RECHECK");assert_eq!(r.rows[0].safe_v1.state,"INELIGIBLE");}
#[test] fn r1a_preflight_safe_v1_095_observed_not_executed(){let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.95,2.0);let r=run(&c,vec![1]);assert_eq!(r.rows[0].safe_v1.state,"ELIGIBLE_AT_READ_SNAPSHOT");assert_eq!(r.approval_writes,0);}
#[test] fn r1a_preflight_forbidden_provenance_not_upgraded(){for kind in ["MANUAL_RESOLUTION","ISIN_MISMATCH_APPROVAL","PRICE_VALIDATION_EXCEPTION"]{let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);c.execute("INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES(1,?,'review')",[kind]).unwrap();let r=run(&c,vec![1]);assert_eq!(r.rows[0].safe_v1.state,"INELIGIBLE");}}
#[test] fn r1a_preflight_scan_missing_stale_and_no_price_distinct(){for (status,factor,code) in [("NONE",2.0,"VALIDATION_MISSING"),("MATCHED",3.0,"VALIDATION_STALE"),("NO_PRICE_DATA",2.0,"PRICE_DATA_MISSING"),("REVIEW",2.0,"PRICE_REVIEW_REQUIRED")]{let c=fixture();seed(&c,1,"PENDING");if status!="NONE"{scan(&c,1,status,0.99,factor);}let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&code));}}
#[test] fn r1a_preflight_compound_validation_not_auto_authority(){let c=fixture();seed(&c,1,"PENDING");seed(&c,2,"PENDING");c.execute("UPDATE corporate_action_imports SET action_type='BONUS',purpose_raw='Bonus 1:1',old_face_value=NULL,new_face_value=NULL,ratio_num=1,ratio_den=1 WHERE id=2",[]).unwrap();scan(&c,1,"MATCHED",0.99,2.0);let r=run(&c,vec![1]);assert_eq!(r.rows[0].safe_v1.state,"INELIGIBLE");assert_eq!(r.rows[0].classification.state,"SUPPORTED_COMPOUND_REVIEW");}
#[test] fn r1a_preflight_legacy_mixed_terms_proposal_only(){let c=fixture();seed(&c,1,"PENDING");c.execute("UPDATE corporate_action_imports SET purpose_raw='Bonus 1:1 and Face Value Split from Rs 10 to Rs 5'",[]).unwrap();let r=run(&c,vec![1]);assert!(codes(&r.rows[0]).contains(&"CLASSIFICATION_CONFLICT"));assert!(r.rows[0].classification.proposal_only);}
#[test] fn r1a_preflight_nonordinary_security_not_erased(){let c=fixture();seed(&c,1,"UNRESOLVED");c.execute("UPDATE corporate_action_imports SET action_type='BONUS',purpose_raw='Scheme of Arrangement - Bonus NCRPS 4:1'",[]).unwrap();let r=run(&c,vec![1]);assert_eq!(r.rows[0].classification.state,"OTHER_SECURITY_REVIEW");assert_ne!(r.rows[0].blocks_in_scope_completeness,Some(false));}
#[test] fn r1a_preflight_outer_fingerprint_stable_and_sensitive(){let c=fixture();seed(&c,1,"PENDING");seed(&c,2,"PENDING");let a=run(&c,vec![1,2]);let mut inp=input(vec![2,1]);inp.request_token="other".into();let b=preflight_with_connection(&c,&inp,"E:/TEST","fixture","fixture-build");assert_eq!(a.fingerprint,b.fingerprint);c.pragma_update(None,"query_only",false).unwrap();c.execute("UPDATE corporate_action_imports SET factor=3 WHERE id=2",[]).unwrap();let d=run(&c,vec![1,2]);assert_ne!(a.fingerprint,d.fingerprint);}
#[test] fn r1a_preflight_unresolved_cannot_complete_database(){let c=fixture();seed(&c,1,"UNRESOLVED");let r=run(&c,vec![1]);assert!(!r.summary.database_complete);assert_eq!(r.summary.coverage_certification,"NOT_ASSESSED");assert_eq!(r.rows[0].blocks_in_scope_completeness,Some(true));}
#[test] fn r1a_fingerprint_golden_types(){let value=json!({"z":null,"float":1.5,"int":1,"empty":""});let encoded=canonical_content(&value).unwrap();assert_eq!(serde_json::to_string(&encoded).unwrap(),r#"{"empty":"","float":{"f64":"3ff8000000000000"},"int":{"i64":"1"},"z":null}"#);}
#[test] fn r1a_file_backed_read_only_control_write_rejected(){let dir=tempfile::tempdir().unwrap();let db=dir.path().join("market-data.sqlite3");let c=Connection::open(&db).unwrap();c.execute("CREATE TABLE t(id INTEGER)",[]).unwrap();drop(c);let c=open_validated_read_only(&db).unwrap();assert!(c.execute("INSERT INTO t VALUES(1)",[]).is_err());assert_eq!(c.query_row("PRAGMA query_only",[],|r|r.get::<_,i64>(0)).unwrap(),1);}

#[test]
#[ignore = "Only the guarded R1-A runner supplies a sealed query copy and IDs"]
fn r1a_copy_local_real_cohort_exact_accounting(){
 let folder=std::env::var("EOD_R1A_QUERY_DIR").expect("explicit query-copy path required");
 let ids_file=std::env::var("EOD_R1A_IDS_JSON").expect("explicit IDs file required");
 let output=std::env::var("EOD_R1A_RESULT_JSON").expect("explicit output required");
 let ids:Vec<i64>=serde_json::from_str(&std::fs::read_to_string(ids_file).unwrap()).unwrap();
 let root=PathBuf::from(folder);assert!(root.components().any(|x|x.as_os_str()=="query-copy"));
 let db=validate_database_path(&root).unwrap();let c=open_validated_read_only(&db).unwrap();
 let before=logical_database_fingerprint(&c).unwrap();let p=root.to_string_lossy().to_string();let mut i=input(ids);i.expected_database_path=p.clone();
 let a=preflight_with_connection(&c,&i,&p,"sealed-query-copy",&build_identity());let b=preflight_with_connection(&c,&i,&p,"sealed-query-copy",&build_identity());
 assert_ne!(a.status,"REJECTED");assert_eq!(a.fingerprint,b.fingerprint);assert_eq!(before,logical_database_fingerprint(&c).unwrap());assert_eq!(a.rows.len(),a.selection.unique_count);assert_eq!(a.approval_writes,0);assert_eq!(a.executed_repairs,0);
 std::fs::write(output,serde_json::to_vec_pretty(&json!({"first":a,"repeatFingerprint":b.fingerprint,"logicalBefore":before,"logicalAfter":logical_database_fingerprint(&c).unwrap(),"source":"REAL_RUST_PREFLIGHT_ON_QUERY_COPY"})).unwrap()).unwrap();
}

#[test]
fn r1a_preflight_wrong_identity_link_stays_blocked() {
    let c = fixture(); seed(&c, 1, "APPROVED"); canonical(&c, 99, 2.0);
    c.execute("UPDATE corporate_action_imports SET approved_corporate_action_id=99", []).unwrap();
    c.execute("UPDATE corporate_actions SET symbol='UNRELATED',isin='OTHERISIN' WHERE id=99", []).unwrap();
    let r = run(&c, vec![1]);
    assert_eq!(r.rows[0].canonical.state, "MULTIPLE_OR_CONFLICTING");
    assert_ne!(r.rows[0].blocks_in_scope_completeness, Some(false));
}
#[test]
fn r1a_request_token_invalid_and_oversized_rejected() {
    let c = fixture(); c.pragma_update(None,"query_only",true).unwrap();
    for token in ["".to_string(), "bad token".to_string(), "x".repeat(65)] {
        let mut i=input(vec![1]); i.request_token=token;
        assert_eq!(preflight_with_connection(&c,&i,"E:/TEST","f","b").status,"REJECTED");
    }
}
#[test]
fn r1a_outside_scope_does_not_call_safe_v1() {
    let c=fixture();seed(&c,1,"PENDING");
    c.execute("UPDATE corporate_action_imports SET exchange='BSE'",[]).unwrap();
    let r=run(&c,vec![1]);assert_eq!(r.rows[0].outcome,"DEFERRED_SCOPE");
    assert_eq!(r.rows[0].safe_v1.state,"NOT_EVALUATED");
    assert_eq!(r.rows[0].blocks_in_scope_completeness,Some(false));
}
#[test]
fn r1a_unsafe_database_manifest_name_rejected() {
    for name in ["../x.sqlite3","C:\\x.sqlite3","a:b.sqlite3","CON.sqlite3","LPT1.db","x.sqlite3 ","\\\\server\\x.sqlite3"] {
        assert!(!safe_database_name(name),"{name}");
    }
    assert!(safe_database_name("market-data.sqlite3"));
}
#[test]
fn r1a_path_validation_does_not_create_missing_database() {
    let d=tempfile::tempdir().unwrap();
    assert!(validate_database_path(d.path()).is_err());
    assert_eq!(std::fs::read_dir(d.path()).unwrap().count(),0);
}
#[test]
fn r1a_owner_read_error_becomes_partial_not_success() {
    let c=fixture();seed(&c,1,"PENDING");
    c.execute("CREATE TABLE corporate_action_event_identity_resolutions(import_id INTEGER)",[]).unwrap();
    let r=run(&c,vec![1]);
    assert_eq!(r.status,"PARTIAL");assert_eq!(r.rows.len(),1);
    assert_eq!(r.rows[0].outcome,"PREPARATION_ERROR");assert_eq!(r.approval_writes,0);
}
#[test]
fn r1a_nonfinite_import_is_not_sanitized_to_zero() {
    let c=fixture();seed(&c,1,"PENDING");
    c.execute("UPDATE corporate_action_imports SET factor=?",[f64::INFINITY]).unwrap();
    let r=run(&c,vec![1]);assert_eq!(r.status,"PARTIAL");
    assert_eq!(r.rows[0].classification.stored_share_factor,None);
    assert!(serde_json::to_string(&r).unwrap().contains("PREPARATION_ERROR"));
}

#[test]
fn r1a_preflight_preserves_raw_and_effective_identity() {
    let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);
    // Fixture setup only. The preview itself never invokes this schema helper.
    event_identity_resolution::create_event_identity_resolution_schema_for_controlled_apply(&c).unwrap();
    c.execute("INSERT INTO corporate_action_event_identity_resolutions(import_id,exchange,raw_symbol,raw_isin,event_symbol,event_isin,resolution_type,resolution_authority,chain_id,transition_old_symbol,transition_new_symbol,transition_effective_date,raw_identity_source_ref,raw_identity_source_sha256,raw_identity_source_line_number,v114d1_evidence_sha256,resolution_fingerprint) VALUES(1,'NSE','TEST','INEAUTO01001','OLDTEST',NULL,'NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL','V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH','fixture-chain','OLDTEST','TEST','2026-09-01','fixture.csv','fixture-sha',1,'fixture-evidence','fixture-fingerprint')",[]).unwrap();
    c.execute("UPDATE corporate_action_scan_results SET symbol='OLDTEST'",[]).unwrap();
    let r=run(&c,vec![1]);
    assert_eq!(r.rows[0].identity.raw_symbol.as_deref(),Some("TEST"));
    assert_eq!(r.rows[0].identity.event_symbol.as_deref(),Some("OLDTEST"));
    assert_eq!(r.rows[0].price.row_fingerprint_check,"PASS");
    assert_eq!(c.query_row("SELECT symbol FROM corporate_action_imports WHERE id=1",[],|r|r.get::<_,String>(0)).unwrap(),"TEST");
    // This synthetic resolution is not a whitelisted real identity authority.
    assert_eq!(r.rows[0].safe_v1.state,"ELIGIBLE_AT_READ_SNAPSHOT");
}
#[test]
fn r1a_fingerprint_history_canonical_and_scan_sensitivity() {
    let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);
    let before=run(&c,vec![1]).fingerprint;
    c.pragma_update(None,"query_only",false).unwrap();
    c.execute("INSERT INTO instrument_isin_history(exchange,symbol,isin,effective_date) VALUES('NSE','TEST','INEAUTO01001','2026-08-14')",[]).unwrap();
    let history=run(&c,vec![1]).fingerprint;assert_ne!(before,history);
    c.pragma_update(None,"query_only",false).unwrap();canonical(&c,9,2.0);
    let ca=run(&c,vec![1]).fingerprint;assert_ne!(history,ca);
    c.pragma_update(None,"query_only",false).unwrap();c.execute("UPDATE corporate_action_scan_results SET confidence=0.97",[]).unwrap();
    assert_ne!(ca,run(&c,vec![1]).fingerprint);
}
#[test]
fn r1a_context_peek_canonicalizes_and_checks_cached_folder() {
    let a=tempfile::tempdir().unwrap();let b=tempfile::tempdir().unwrap();
    let expected=a.path().to_string_lossy().to_string();
    assert!(expected_context_path(a.path(),&expected).is_ok());
    let error=expected_context_path(b.path(),&expected).unwrap_err();assert_eq!(error.0,"DATABASE_CHANGED");
    assert_eq!(std::fs::read_dir(a.path()).unwrap().count(),0);
    assert_eq!(std::fs::read_dir(b.path()).unwrap().count(),0);
}

#[test]
fn r1a_outer_sha256_golden_vector() {
    assert_eq!(digest(&json!({"z":null,"float":1.5,"int":1,"empty":""})).unwrap(),"903E50A76BB897968C7A16D8B4E98C5D641D2053DFAB9AB4721688203D266BE7");
}

#[test]
fn r1a_read_only_open_handles_canonical_local_windows_paths() {
    let folder=tempfile::tempdir().unwrap();let db=folder.path().join("space and #data.sqlite3");
    { let setup=Connection::open(&db).unwrap();setup.execute_batch("CREATE TABLE probe(id INTEGER); INSERT INTO probe VALUES(1);").unwrap(); }
    let canonical=db.canonicalize().unwrap();
    let reader=open_validated_read_only(&canonical).unwrap();
    assert_eq!(reader.query_row("SELECT id FROM probe",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    assert_eq!(reader.query_row("PRAGMA query_only",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    assert!(reader.execute("INSERT INTO probe VALUES(2)",[]).is_err());
}

#[test]
fn r1a_fingerprint_decision_compound_peer_and_schema_sensitivity() {
    for change in [
        "INSERT INTO corporate_action_import_decisions(import_id,decision_type,reason) VALUES(1,'MANUAL_RESOLUTION','fixture only')",
        "UPDATE corporate_action_imports SET factor=3 WHERE id=2",
        "CREATE INDEX r1a_fixture_probe_index ON corporate_action_imports(ex_date)",
    ] {
        let c=fixture();seed(&c,1,"PENDING");seed(&c,2,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);
        let a=run(&c,vec![1]);
        c.pragma_update(None,"query_only",false).unwrap();c.execute_batch(change).unwrap();
        let b=run(&c,vec![1]);assert_ne!(a.fingerprint,b.fingerprint,"{change}");
    }
}
#[test]
fn r1a_all_named_security_subtypes_remain_review_conditions() {
    for purpose in ["Bonus Debentures 1:1", "Bonus NCRPS 4:1", "Bonus 1 DVR : 10 Equity", "Entitlement Scheme of Arrangement"] {
        let c=fixture();seed(&c,1,"UNRESOLVED");
        c.execute("UPDATE corporate_action_imports SET action_type='BONUS',purpose_raw=?",[purpose]).unwrap();
        let r=run(&c,vec![1]);assert_eq!(r.rows[0].classification.state,"OTHER_SECURITY_REVIEW");
        assert_eq!(r.rows[0].blocks_in_scope_completeness,None);
    }
}
#[test]
fn r1a_input_deserialization_rejects_fractional_ids_and_force_arguments() {
    for body in [
        r#"{"importIds":[1.5],"expectedDatabasePath":"E:/TEST","requestToken":"r1"}"#,
        r#"{"importIds":[null],"expectedDatabasePath":"E:/TEST","requestToken":"r1"}"#,
        r#"{"importIds":[1],"expectedDatabasePath":"E:/TEST","requestToken":"r1","force":true}"#,
    ] { assert!(serde_json::from_str::<CorporateActionReconciliationPreflightInput>(body).is_err()); }
}


#[test]
fn phase5b_preflight_safe_v2_exposes_typed_split_bonus_scan_id() {
    let c=fixture();seed(&c,1,"PENDING");scan(&c,1,"MATCHED",0.99,2.0);
    let r=run(&c,vec![1]);
    assert_eq!(r.rows[0].safe_v1.policy_version,"AUTO_APPROVAL_SAFE_V2");
    assert_eq!(r.rows[0].safe_v1.state,"ELIGIBLE_AT_READ_SNAPSHOT");
    assert!(r.rows[0].safe_v1.evidence.iter().any(|e| e.owner=="auto_approval::evaluate_auto_approval_r1" && e.record_id.is_some()));
}

#[test]
#[ignore = "explicit NSE Phase 1 query-copy audit; never opens the live database"]
fn phase1_nse_query_copy_proof_matrix() {
    let project = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let audit = project.join("outputs/2026-10-27-ca-nse-phase1").canonicalize().unwrap();
    let root = audit.join("query-copy").canonicalize().unwrap();
    assert!(root.starts_with(&audit));
    assert_eq!(
        fs::read_to_string(root.join("PHASE1_QUERY_ONLY.txt")).unwrap().replace("\r\n", "\n"),
        "CA_NSE_PHASE1_QUERY_ONLY_COPY\nNo app startup, repairs, approvals, imports or raw prices.\n"
    );
    let output = audit.join("preflight-result.json");
    assert!(!output.exists(), "never replace retained audit evidence");
    let ids: Vec<i64> = serde_json::from_slice(&fs::read(audit.join("ids.json")).unwrap()).unwrap();
    assert!(!ids.is_empty() && ids.len() <= 114);
    let db = validate_database_path(&root).unwrap();
    assert!(db.starts_with(&root));
    let before = format!("{:x}", Sha256::digest(fs::read(&db).unwrap()));
    let c = open_validated_read_only(&db).unwrap();
    for id in &ids {
        let raw = get_import_row(&c, *id).unwrap();
        assert_eq!(raw.exchange, "NSE");
        assert!(matches!(raw.action_type.as_str(), "SPLIT" | "BONUS"));
        assert_ne!(raw.review_status, "APPROVED");
        assert!(raw.approved_corporate_action_id.is_none());
    }
    let folder = root.to_string_lossy().to_string();
    let mut request = input(ids);
    request.expected_database_path = folder.clone();
    let started = std::time::Instant::now();
    let first = preflight_with_connection(&c, &request, &folder, "sealed-query-copy", &build_identity());
    let first_seconds = started.elapsed().as_secs_f64();
    println!("PHASE1 first pass: {} rows, {}, {:.3}s", first.rows.len(), first.status, first_seconds);
    let repeated = std::time::Instant::now();
    let second = preflight_with_connection(&c, &request, &folder, "sealed-query-copy", &build_identity());
    let repeat_seconds = repeated.elapsed().as_secs_f64();
    assert_ne!(first.status, "REJECTED");
    assert_eq!(first.fingerprint, second.fingerprint);
    assert_eq!(first.rows.len(), first.selection.unique_count);
    assert_eq!(first.approval_writes, 0);
    assert_eq!(first.executed_repairs, 0);
    assert_eq!(c.query_row("SELECT total_changes()", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
    assert_eq!(c.query_row("PRAGMA query_only", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
    drop(c);
    let after = format!("{:x}", Sha256::digest(fs::read(&db).unwrap()));
    assert_eq!(before, after);
    let result = json!({
        "first": first, "repeatFingerprint": second.fingerprint,
        "byteHashBefore": before, "byteHashAfter": after,
        "firstSeconds": first_seconds, "repeatSeconds": repeat_seconds,
        "queryOnly": true, "totalChanges": 0,
        "source": "REAL_RUST_PREFLIGHT_ON_SEALED_NSE_QUERY_COPY"
    });
    fs::write(output, serde_json::to_vec_pretty(&result).unwrap()).unwrap();
    println!("PHASE1 repeat pass: {:.3}s; zero writes; identical result and database hashes", repeat_seconds);
}

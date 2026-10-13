//! R1-A diagnostic snapshot only. This module has no approval/repair writer.
use super::{auto_approval, event_identity_resolution, repair_preview};
use super::{build_resolution_hint_for_import_row, detected_corporate_action_families,
    ensure_compound_scan_fingerprint_current, ensure_split_bonus_price_validation,
    find_existing_corporate_action, get_import_row, is_split_bonus_validation_current,
    list_resolution_suggestions_for_import_row, load_latest_official_split_bonus_validation,
    load_same_date_split_bonus_compound_context, normalize_text, parse_compound_action_components,
    parse_corporate_action_purpose, ScanCandidate};
use crate::database::{peek_active_database_folder_read_only, AppResult, CorporateActionImportRow};
use rusqlite::{params, params_from_iter, types::Value as SqlValue, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const VERSION: &str = "CA_RECONCILIATION_PREFLIGHT_V1";
const MAX_SAFE_ID: i64 = 9_007_199_254_740_991;
const OUTCOMES: [&str; 8] = ["ALREADY_LINKED_REVIEW", "READY_FOR_EXISTING_APPROVAL_RECHECK", "REPAIR_CANDIDATE",
    "EVIDENCE_BLOCKED", "DEFERRED_SCOPE", "CLASSIFICATION_REVIEW", "MISSING_IMPORT", "PREPARATION_ERROR"];
/// Exact outer field inventory, exercised by deterministic/golden tests. Old digests are untouched.
const FINGERPRINT_FIELDS: [&str; 10] = ["rulesVersion", "buildIdentity", "databaseFileIdentity", "schemaFingerprint",
    "sortedUniqueIds", "rawImport", "effectiveIdentity", "relatedIdentityEvidence", "canonicalAndCompoundPeers", "storedScansAndDecisions"];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorporateActionReconciliationPreflightInput {
    pub import_ids: Vec<i64>, pub expected_database_path: String, pub request_token: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1AEvidenceReference { pub owner: String, pub kind: String, pub record_id: Option<i64>, pub fingerprint: Option<String> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionReconciliationBlocker {
    pub code: String, pub stage: String, pub severity: String, pub message: String,
    pub evidence: Vec<R1AEvidenceReference>, pub next_operation: String, pub retryable_read_only: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ACandidate { pub symbol: String, pub exchange: String, pub isin: Option<String>, pub is_active: bool, pub evidence: Vec<R1AEvidenceReference> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ARepairPlanItem { pub operation: String, pub owner: String, pub availability: String, pub prerequisites: Vec<String>, pub evidence: Vec<R1AEvidenceReference>, pub executed: bool }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1AStoredState { pub review_status: Option<String>, pub parse_status: Option<String>, pub approved_corporate_action_id: Option<i64> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1AIdentity {
    pub raw_symbol: Option<String>, pub raw_isin: Option<String>, pub event_symbol: Option<String>, pub event_isin: Option<String>,
    pub candidates: Vec<R1ACandidate>, pub proof_state: String, pub proof_owner: Option<String>, pub proof_description: Option<String>, pub evidence: Vec<R1AEvidenceReference>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1AClassification { pub state: String, pub stored_share_factor: Option<f64>, pub proposed_share_factor: Option<f64>, pub proposed_price_factor: Option<f64>, pub proposal_only: bool }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ACanonical { pub state: String, pub linked_id: Option<i64>, pub owner_match_candidate_id: Option<i64>, pub candidate_ids: Vec<i64>, pub evidence: Vec<R1AEvidenceReference> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1APrice {
    pub scan_id: Option<i64>, pub scan_run_id: Option<i64>, pub scanned_at: Option<String>, pub scan_status: Option<String>, pub confidence: Option<f64>,
    pub expected_factor: Option<f64>, pub previous_trade_date: Option<String>, pub ex_trade_date: Option<String>, pub previous_close: Option<f64>, pub ex_open: Option<f64>, pub ex_close: Option<f64>,
    pub row_fingerprint_check: String, pub compound_fingerprint_check: String, pub raw_price_revalidation: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1AOrdinaryReadiness { pub state: String, pub message: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ASafeV1 { pub policy_version: String, pub state: String, pub reason: Option<String>, pub evidence: Vec<R1AEvidenceReference> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionReconciliationPreflightRow {
    pub import_id: i64, pub exists: bool, pub exchange: Option<String>, pub symbol: Option<String>, pub action_type: Option<String>, pub ex_date: Option<String>, pub record_date: Option<String>, pub purpose_raw: Option<String>, pub row_fingerprint: String,
    pub stored_state: R1AStoredState, pub identity: R1AIdentity, pub classification: R1AClassification, pub canonical: R1ACanonical, pub price: R1APrice,
    pub ordinary_readiness: R1AOrdinaryReadiness, pub safe_v1: R1ASafeV1, pub blockers: Vec<CorporateActionReconciliationBlocker>, pub repair_plan: Vec<R1ARepairPlanItem>, pub outcome: String, pub blocks_in_scope_completeness: Option<bool>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ADatabaseContext { pub canonical_database_path: String, pub database_file_identity: String, pub schema_fingerprint: String, pub read_context: String, pub selection_source: String, pub build_identity: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ASelection { pub requested_count: usize, pub unique_count: usize, pub duplicate_count: usize, pub unique_import_ids: Vec<i64>, pub id_set_fingerprint: Option<String> }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct R1ASummary { pub accounted_for: usize, pub outcome_counts: BTreeMap<String, usize>, pub in_scope_blocked_rows: usize, pub applicability_unknown_rows: usize, pub deferred_rows: usize, pub coverage_certification: String, pub database_complete: bool }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorporateActionReconciliationPreflightResult {
    pub version: String, pub status: String, pub request_token: String, pub generated_at: String, pub database_context: Option<R1ADatabaseContext>, pub selection: R1ASelection, pub fingerprint: Option<String>,
    pub read_only: bool, pub executed_repairs: usize, pub approval_writes: usize, pub rows: Vec<CorporateActionReconciliationPreflightRow>, pub global_blockers: Vec<CorporateActionReconciliationBlocker>, pub summary: R1ASummary,
}

fn checked_id(id: i64) -> AppResult<i64> { if id > 0 && id <= MAX_SAFE_ID { Ok(id) } else { Err("Out-of-range record identifier; not representable in the diagnostic contract.".into()) } }
fn validate_request(input: &CorporateActionReconciliationPreflightInput) -> AppResult<Vec<i64>> {
    if input.import_ids.is_empty() || input.import_ids.len() > 500 || input.import_ids.iter().any(|id| checked_id(*id).is_err()) { return Err("Use 1..500 positive safe-integer import IDs; no implicit truncation.".into()); }
    if input.request_token.is_empty() || input.request_token.len() > 64 || !input.request_token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') { return Err("Request token must contain 1..64 ASCII letters, digits, hyphen or underscore.".into()); }
    if input.expected_database_path.is_empty() || input.expected_database_path.len() > 32768 || input.expected_database_path.contains('\0') { return Err("Expected database folder is required.".into()); }
    Ok(repair_preview::validate_repair_preview_import_ids(&input.import_ids)?)
}
fn safe_message(text: &str) -> String {
    text.split_whitespace().map(|word| {
        if word.contains("://") || word.contains(":\\") || word.contains(":/") || word.starts_with("\\\\") || word.starts_with('/') { "[path/source omitted]".to_string() }
        else { word.chars().filter(|c| !c.is_control()).collect::<String>() }
    }).collect::<Vec<_>>().join(" ").chars().take(1200).collect()
}
fn evidence(owner: &str, kind: &str, id: Option<i64>, fp: Option<String>) -> R1AEvidenceReference {
    R1AEvidenceReference { owner: owner.into(), kind: kind.into(), record_id: id.filter(|id| checked_id(*id).is_ok()), fingerprint: fp }
}
fn blocker(code: &str, stage: &str, severity: &str, message: &str, next: &str) -> CorporateActionReconciliationBlocker {
    CorporateActionReconciliationBlocker { code: code.into(), stage: stage.into(), severity: severity.into(), message: safe_message(message), evidence: vec![], next_operation: next.into(), retryable_read_only: true }
}
fn add(row: &mut CorporateActionReconciliationPreflightRow, code: &str, stage: &str, message: &str, next: &str) {
    row.blockers.push(blocker(code, stage, "BLOCKING", message, next));
}
fn plan(row: &mut CorporateActionReconciliationPreflightRow, operation: &str, owner: &str, availability: &str, prerequisites: &[&str]) {
    row.repair_plan.push(R1ARepairPlanItem { operation: operation.into(), owner: owner.into(), availability: availability.into(), prerequisites: prerequisites.iter().map(|s| (*s).into()).collect(), evidence: vec![], executed: false });
}
fn owner_error(row: &mut CorporateActionReconciliationPreflightRow, code: &str, stage: &str, error: &str) {
    add(row, code, stage, error, "Retry read-only diagnostics after the underlying evidence/schema issue is resolved");
    row.outcome = "PREPARATION_ERROR".into();
}
fn blank_row(id: i64, exists: bool) -> CorporateActionReconciliationPreflightRow {
    CorporateActionReconciliationPreflightRow { import_id: id, exists, exchange: None, symbol: None, action_type: None, ex_date: None, record_date: None, purpose_raw: None, row_fingerprint: String::new(),
        stored_state: R1AStoredState { review_status: None, parse_status: None, approved_corporate_action_id: None },
        identity: R1AIdentity { raw_symbol: None, raw_isin: None, event_symbol: None, event_isin: None, candidates: vec![], proof_state: "NOT_EVALUATED".into(), proof_owner: None, proof_description: None, evidence: vec![] },
        classification: R1AClassification { state: "UNPARSED".into(), stored_share_factor: None, proposed_share_factor: None, proposed_price_factor: None, proposal_only: true },
        canonical: R1ACanonical { state: "CANDIDATE_ONLY".into(), linked_id: None, owner_match_candidate_id: None, candidate_ids: vec![], evidence: vec![] },
        price: R1APrice { scan_id: None, scan_run_id: None, scanned_at: None, scan_status: None, confidence: None, expected_factor: None, previous_trade_date: None, ex_trade_date: None, previous_close: None, ex_open: None, ex_close: None, row_fingerprint_check: "NOT_EVALUATED".into(), compound_fingerprint_check: "NOT_EVALUATED".into(), raw_price_revalidation: "NOT_RUN".into() },
        ordinary_readiness: R1AOrdinaryReadiness { state: "NOT_EVALUATED".into(), message: "No writer call is made by this preview.".into() },
        safe_v1: R1ASafeV1 { policy_version: "AUTO_APPROVAL_SAFE_V2".into(), state: "NOT_EVALUATED".into(), reason: None, evidence: vec![] },
        blockers: vec![], repair_plan: vec![], outcome: if exists { "EVIDENCE_BLOCKED" } else { "MISSING_IMPORT" }.into(), blocks_in_scope_completeness: None }
}
fn empty_result(input: &CorporateActionReconciliationPreflightInput) -> CorporateActionReconciliationPreflightResult {
    CorporateActionReconciliationPreflightResult { version: VERSION.into(), status: "REJECTED".into(), request_token: input.request_token.clone(), generated_at: chrono::Utc::now().to_rfc3339(), database_context: None,
        selection: R1ASelection { requested_count: input.import_ids.len(), unique_count: 0, duplicate_count: 0, unique_import_ids: vec![], id_set_fingerprint: None }, fingerprint: None,
        read_only: true, executed_repairs: 0, approval_writes: 0, rows: vec![], global_blockers: vec![], summary: R1ASummary { accounted_for: 0, outcome_counts: OUTCOMES.iter().map(|s| ((*s).into(), 0)).collect(), in_scope_blocked_rows: 0, applicability_unknown_rows: 0, deferred_rows: 0, coverage_certification: "NOT_ASSESSED".into(), database_complete: false } }
}
fn rejected(input: &CorporateActionReconciliationPreflightInput, code: &str, message: &str) -> CorporateActionReconciliationPreflightResult {
    let mut r = empty_result(input); r.global_blockers.push(blocker(code, "REQUEST", "BLOCKING", message, "Reload or correct the read-only request")); r
}

fn canonical_content(value: &Value) -> AppResult<Value> {
    Ok(match value {
        Value::Number(n) if n.is_i64() => json!({"i64": n.as_i64().unwrap().to_string()}),
        Value::Number(n) if n.is_u64() => json!({"u64": n.as_u64().unwrap().to_string()}),
        Value::Number(n) => { let x = n.as_f64().ok_or("Invalid number")?; if !x.is_finite() { return Err("Non-finite diagnostic number".into()); } json!({"f64": format!("{:016x}", x.to_bits())}) },
        Value::Array(a) => Value::Array(a.iter().map(canonical_content).collect::<AppResult<Vec<_>>>()?),
        Value::Object(m) => { let sorted = m.iter().map(|(k,v)| Ok((k.clone(), canonical_content(v)?))).collect::<AppResult<BTreeMap<_,_>>>()?; serde_json::to_value(sorted).map_err(|e|e.to_string())? },
        other => other.clone(),
    })
}
fn digest(value: &Value) -> AppResult<String> {
    let bytes = serde_json::to_vec(&canonical_content(value)?).map_err(|e|e.to_string())?;
    let mut hash = Sha256::new(); hash.update(VERSION.as_bytes()); hash.update([0]); hash.update(bytes); Ok(format!("{:X}", hash.finalize()))
}
fn tagged_rows(c: &Connection, sql: &str, parameters: &[SqlValue]) -> AppResult<Value> {
    let mut statement = c.prepare(sql).map_err(|e|e.to_string())?;
    let columns = statement.column_names().iter().map(|s|s.to_string()).collect::<Vec<_>>();
    let mut query = statement.query(params_from_iter(parameters.iter())).map_err(|e|e.to_string())?; let mut output = vec![];
    while let Some(row) = query.next().map_err(|e|e.to_string())? {
        let mut item = BTreeMap::new();
        for (i,name) in columns.iter().enumerate() {
            let v: SqlValue = row.get(i).map_err(|e|e.to_string())?;
            let v = match v { SqlValue::Null => Value::Null, SqlValue::Integer(x) => json!({"sqlInteger": x.to_string()}), SqlValue::Real(x) => {
                if !x.is_finite() { return Err("Non-finite stored numeric evidence; refused to manufacture a finite value.".into()); } json!({"sqlRealBits": format!("{:016x}",x.to_bits())}) }, SqlValue::Text(s) => json!({"sqlText":s}), SqlValue::Blob(b) => json!({"sqlBlobHex":b.iter().map(|x|format!("{x:02x}")).collect::<String>()}) };
            item.insert(name.clone(),v);
        }
        output.push(serde_json::to_value(item).map_err(|e|e.to_string())?);
    }
    Ok(Value::Array(output))
}
fn schema_fingerprint(c: &Connection) -> AppResult<String> { digest(&tagged_rows(c, "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name", &[])?) }
fn verify_schema(c: &Connection) -> AppResult<()> {
    // Validate exactly the readers' required fields, not an inferred schema version. No migration.
    for query in [
        "SELECT id,dedupe_key,exchange,source,source_file,symbol,isin,bse_scrip_code,company_name,purpose_raw,ex_date,record_date,action_type,ratio_num,ratio_den,old_face_value,new_face_value,cash_amount,factor,price_factor,parse_status,review_status,message,approved_corporate_action_id,imported_at,approved_at FROM corporate_action_imports LIMIT 0",
        "SELECT id,symbol,exchange,isin,effective_date,record_date,action_type,factor,ratio_num,ratio_den,old_face_value,new_face_value,cash_amount,adjust_volume,note,source,source_ref,applied_at,created_at,updated_at FROM corporate_actions LIMIT 0",
        "SELECT symbol,exchange,isin,name,series,is_active FROM instruments LIMIT 0",
        "SELECT id,exchange,isin,current_symbol,old_symbol,new_symbol,effective_date,change_type FROM instrument_identity_history LIMIT 0",
        "SELECT id,exchange,symbol,isin,effective_date FROM instrument_isin_history LIMIT 0",
        "SELECT id,import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,factor_seen,raw_reference,note FROM corporate_action_import_evidence LIMIT 0",
        "SELECT id,import_id,decision_type,previous_symbol,resolved_symbol,resolved_exchange,resolved_isin,reason,decided_at FROM corporate_action_import_decisions LIMIT 0",
        "SELECT id,scope,status FROM scan_runs LIMIT 0",
        "SELECT id,scan_run_id,corporate_action_import_id,corporate_action_id,symbol,exchange,scan_status,prev_trade_date,ex_trade_date,prev_close,ex_open,ex_close,expected_factor,actual_open_factor,actual_close_factor,confidence,message,scanned_at FROM corporate_action_scan_results LIMIT 0",
    ] { c.prepare(query).map_err(|e|e.to_string())?; }
    Ok(())
}
fn row_dependencies(c: &Connection, raw: &CorporateActionImportRow, symbols: &BTreeSet<String>) -> AppResult<Value> {
    let mut identities = vec![];
    for symbol in symbols {
        let args = [SqlValue::Text(raw.exchange.clone()), SqlValue::Text(symbol.clone())];
        identities.push(json!({"symbol":symbol,
            "instruments":tagged_rows(c,"SELECT * FROM instruments WHERE exchange=? AND symbol=? ORDER BY symbol,isin,series",&args)?,
            "isinHistory":tagged_rows(c,"SELECT * FROM instrument_isin_history WHERE exchange=? AND symbol=? ORDER BY id",&args)?,
            "identityHistory":tagged_rows(c,"SELECT * FROM instrument_identity_history WHERE exchange=? AND (old_symbol=? OR new_symbol=? OR current_symbol=?) ORDER BY id",&[args[0].clone(),args[1].clone(),args[1].clone(),args[1].clone()])?}));
    }
    let id = [SqlValue::Integer(raw.id)];
    let peers = tagged_rows(c,"SELECT * FROM corporate_action_imports WHERE exchange=? AND ex_date=? ORDER BY id", &[SqlValue::Text(raw.exchange.clone()),raw.ex_date.clone().map(SqlValue::Text).unwrap_or(SqlValue::Null)])?;
    // Existing compound owner can project other same-date peers through persisted event identity.
    let event_table = c.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='corporate_action_event_identity_resolutions')",[],|r|r.get::<_,i64>(0)).map_err(|e|e.to_string())? != 0;
    let event_rows = if event_table { tagged_rows(c,"SELECT * FROM corporate_action_event_identity_resolutions WHERE import_id=? OR import_id IN(SELECT id FROM corporate_action_imports WHERE exchange=? AND ex_date=?) ORDER BY id",&[SqlValue::Integer(raw.id),SqlValue::Text(raw.exchange.clone()),raw.ex_date.clone().map(SqlValue::Text).unwrap_or(SqlValue::Null)])? } else { json!({"tableAbsent":true}) };
    Ok(json!({"rawImport":tagged_rows(c,"SELECT * FROM corporate_action_imports WHERE id=?",&id)?,
        "importEvidence":tagged_rows(c,"SELECT * FROM corporate_action_import_evidence WHERE import_id=? ORDER BY id",&id)?,
        "storedScansAndDecisions": {"decisions":tagged_rows(c,"SELECT * FROM corporate_action_import_decisions WHERE import_id=? ORDER BY id",&id)?,
          "scans":tagged_rows(c,"SELECT * FROM corporate_action_scan_results WHERE corporate_action_import_id=? ORDER BY id",&id)?,
          "runs":tagged_rows(c,"SELECT * FROM scan_runs WHERE id IN(SELECT scan_run_id FROM corporate_action_scan_results WHERE corporate_action_import_id=?) ORDER BY id",&id)?},
        "relatedIdentityEvidence":identities,"effectiveIdentity":event_rows,"canonicalAndCompoundPeers":peers}))
}
fn finite_fields(values: &[Option<f64>]) -> bool { values.iter().all(|v|v.map(|x|x.is_finite()).unwrap_or(true)) }
fn event_terms_match(raw: &CorporateActionImportRow, canonical: &crate::database::CorporateActionRepairCanonicalValues) -> bool {
    raw.exchange == canonical.exchange
        && (raw.symbol.as_deref() == Some(canonical.symbol.as_str())
            || raw.isin.as_deref().zip(canonical.isin.as_deref()).map(|(a,b)| a == b).unwrap_or(false))
        && raw.ex_date.as_deref() == Some(canonical.effective_date.as_str()) && raw.action_type == canonical.action_type
        && raw.factor == Some(canonical.factor) && raw.ratio_num == canonical.ratio_num && raw.ratio_den == canonical.ratio_den
        && raw.old_face_value == canonical.old_face_value && raw.new_face_value == canonical.new_face_value && raw.cash_amount == canonical.cash_amount
}

fn evaluate_row(c: &Connection, id: i64) -> AppResult<CorporateActionReconciliationPreflightRow> {
    let loaded = repair_preview::load_repair_preview_import(c,id)?;
    let Some((source, stored)) = loaded else {
        let mut r=blank_row(id,false);add(&mut r,"IMPORT_MISSING","REQUEST","The requested import ID does not exist in this read snapshot.","Reload explicit IDs");
        r.row_fingerprint=digest(&json!({"importId":id,"missing":true}))?;return Ok(r);
    };
    let raw = get_import_row(c,id)?;
    if !finite_fields(&[raw.ratio_num,raw.ratio_den,raw.old_face_value,raw.new_face_value,raw.cash_amount,raw.factor,raw.price_factor]) { return Err("Non-finite import terms; no numeric default or approval inferred.".into()); }
    let mut r=blank_row(id,true);r.exchange=Some(raw.exchange.clone());r.symbol=raw.symbol.clone();r.action_type=Some(raw.action_type.clone());r.ex_date=raw.ex_date.clone();r.record_date=raw.record_date.clone();r.purpose_raw=Some(raw.purpose_raw.clone());
    r.stored_state=R1AStoredState{review_status:Some(raw.review_status.clone()),parse_status:Some(raw.parse_status.clone()),approved_corporate_action_id:raw.approved_corporate_action_id.map(checked_id).transpose()?};
    r.identity.raw_symbol=raw.symbol.clone();r.identity.raw_isin=raw.isin.clone();r.classification.stored_share_factor=raw.factor;
    let in_scope=raw.exchange=="NSE"&&matches!(raw.action_type.as_str(),"SPLIT"|"BONUS");
    r.blocks_in_scope_completeness=Some(in_scope);
    let mut symbols=BTreeSet::new();if let Some(s)=&raw.symbol{symbols.insert(s.clone());}
    match event_identity_resolution::load_effective_event_identity(c,id) {
        Ok(e)=>{r.identity.event_symbol=e.event_symbol.clone();r.identity.event_isin=e.event_isin.clone();if let Some(s)=e.event_symbol{symbols.insert(s);}
            r.identity.evidence.push(evidence("event_identity_resolution::load_effective_event_identity","EVENT_IDENTITY",Some(id),e.resolution_fingerprint));},
        Err(e)=>{r.identity.proof_state="ERROR".into();owner_error(&mut r,"IDENTITY_PROOF_ERROR","IDENTITY",&e);},
    }
    let ev=repair_preview::list_repair_preview_evidence(c,id)?;
    let grade=repair_preview::grade_repair_preview_evidence(&source,&ev);
    let ev_fp=repair_preview::stable_repair_preview_fingerprint(&source,&stored,None,&[],&ev)?;
    r.identity.evidence.push(evidence("repair_preview::grade_repair_preview_evidence",&format!("SOURCE_GRADE_{grade}"),Some(id),Some(ev_fp)));
    if grade!="STRUCTURED_OFFICIAL" {r.blockers.push(blocker("EVIDENCE_SOURCE_REFRESH_REQUIRED","TERMS","WARNING",&format!("Existing source evidence grade: {grade}. Repair proposals may require a separately authorized source refresh."),"Refresh official evidence only under separate acquisition authority"));}
    let normalized=normalize_text(&raw.purpose_raw);let families=detected_corporate_action_families(&normalized);
    let compound=families.len()>1;
    let proposal=if compound{parse_compound_action_components(&raw.purpose_raw,&families)}else{vec![parse_corporate_action_purpose(&raw.purpose_raw)]};
    let own=proposal.iter().filter(|p|p.action_type==raw.action_type&&p.parse_status=="PARSED").collect::<Vec<_>>();
    if own.len()==1 { r.classification.proposed_share_factor=own[0].factor;r.classification.proposed_price_factor=own[0].price_factor; }
    let security_review=["DEBENT","NCRPS","DVR","ENTITLEMENT","PREFERENCE"].iter().any(|s|normalized.contains(s));
    let mut terms_conflict=false;
    if !in_scope {r.classification.state="OUTSIDE_REQUEST_SCOPE".into();add(&mut r,"ACTION_OUTSIDE_R1_SCOPE","SCOPE","This record is outside the ordinary NSE Split/Bonus request scope.","Use the separately supported workflow");}
    else if security_review {r.classification.state="OTHER_SECURITY_REVIEW".into();r.blocks_in_scope_completeness=None;add(&mut r,"UNSUPPORTED_AUTOMATION_SCOPE","SCOPE","Source text describes a security/arrangement subtype; applicability is not discharged.","Review the existing source classification owner");}
    else if compound { r.classification.state=if families.iter().all(|f|matches!(f.as_str(),"SPLIT"|"BONUS")){"SUPPORTED_COMPOUND_REVIEW"}else{"CONFLICT"}.into();terms_conflict=true;add(&mut r,"CLASSIFICATION_CONFLICT","TERMS","Mixed-purpose stored row requires separate component review. Proposed terms are not saved or approved.","Review current parser/compound preview proposals"); }
    else if raw.parse_status!="PARSED"||own.len()!=1 {r.classification.state="UNPARSED".into();terms_conflict=true;add(&mut r,"TERMS_UNPARSED","TERMS","The source purpose cannot currently establish a complete ordinary action proposal.","Inspect structured event terms; no ratio is invented");}
    else {r.classification.state=if raw.action_type=="SPLIT"{"ORDINARY_SPLIT"}else{"ORDINARY_BONUS"}.into();let p=own[0];
        if p.factor!=raw.factor||p.price_factor!=raw.price_factor||p.ratio_num!=raw.ratio_num||p.ratio_den!=raw.ratio_den||p.old_face_value!=raw.old_face_value||p.new_face_value!=raw.new_face_value {terms_conflict=true;r.classification.state="CONFLICT".into();add(&mut r,"CLASSIFICATION_CONFLICT","TERMS","Current parser terms differ from stored terms; proposals remain read-only.","Review source/parsed-term provenance");}
    }
    let mut identity_ready=false;
    if in_scope {
        match list_resolution_suggestions_for_import_row(c,&raw) {
            Ok(suggestions)=>{
                let active=suggestions.iter().filter(|x|x.is_active).collect::<Vec<_>>();
                for s in &suggestions {symbols.insert(s.symbol.clone());r.identity.candidates.push(R1ACandidate{symbol:s.symbol.clone(),exchange:s.exchange.clone(),isin:s.isin.clone(),is_active:s.is_active,evidence:vec![evidence("list_resolution_suggestions_for_import_row",if s.has_event_date_isin_evidence{"EXACT_EVENT_DATE_ISIN_HISTORY"}else{"IDENTITY_CHAIN_CANDIDATE"},None,None)]});}
                if active.is_empty(){add(&mut r,"IDENTITY_NO_ACTIVE_CANDIDATE","IDENTITY","No active candidate exists in the stored chain. This does not establish economic non-applicability.","Investigate historical identity/lifecycle evidence");}
                if active.len()>1{add(&mut r,"IDENTITY_AMBIGUOUS","IDENTITY","More than one active identity candidate exists.","Gather discriminating date-valid evidence");}
                let exact=active.len()==1&&active[0].exchange==raw.exchange&&Some(active[0].symbol.as_str())==raw.symbol.as_deref()
                    &&raw.isin.as_deref().zip(active[0].isin.as_deref()).map(|(a,b)|a.trim().eq_ignore_ascii_case(b.trim())).unwrap_or(false);
                match build_resolution_hint_for_import_row(c,&raw) {
                    Ok(h)=>{if r.identity.proof_state!="ERROR"{r.identity.proof_state=if exact||h.quick_resolvable{"PASS"}else{"BLOCKED"}.into();r.identity.proof_owner=Some("build_resolution_hint_for_import_row / exact active candidate".into());r.identity.proof_description=Some(safe_message(&h.message));}
                        if h.quick_resolvable && raw.review_status=="UNRESOLVED" {plan(&mut r,"Existing Quick Resolve proof is available; not executed","strict_quick_resolve_proof","EXISTING_OWNER_REQUIRES_SEPARATE_EXECUTION",&["Current proof recheck","Separate repair execution authorization"]);}
                    },Err(e)=>{r.identity.proof_state="ERROR".into();owner_error(&mut r,"IDENTITY_PROOF_ERROR","IDENTITY",&e);}
                }
                if active.len()==1&&!exact&&suggestions.iter().any(|s|s.has_event_date_isin_evidence&&s.symbol!=active[0].symbol){
                    add(&mut r,"IDENTITY_ALIAS_EVIDENCE_CANDIDATE","IDENTITY","Exact-date historical ISIN evidence exists under a related symbol, not yet proven on the active target by an R1-B rule.","Design/validate temporal alias proof; no history write here");
                    plan(&mut r,"Reconcile date-valid alias/event evidence","existing identity-history and event-identity owners","CANDIDATE_REQUIRES_R1B_PROOF",&["Unique active target","Date-valid relationship","No contradictory ISIN","Canonical duplicate check"]);
                }
                identity_ready=!matches!(raw.review_status.as_str(),"UNRESOLVED"|"PENDING_ISIN_MISMATCH")&&raw.symbol.is_some();
            },Err(e)=>{r.identity.proof_state="ERROR".into();owner_error(&mut r,"IDENTITY_PROOF_ERROR","IDENTITY",&e);}
        }
        if raw.review_status=="UNRESOLVED"{add(&mut r,"IDENTITY_UNRESOLVED","IDENTITY","The stored import is still UNRESOLVED. A candidate or proof description is not an executed resolution.","Inspect date-valid identity evidence");}
        if raw.review_status=="PENDING_ISIN_MISMATCH"{add(&mut r,"ISIN_MISMATCH_BOUNDARY","IDENTITY","PENDING_ISIN_MISMATCH remains blocked from ordinary approval.","Use the established reviewed identity workflow; no automatic exception");}
    }
    // Canonical candidate retrieval is independent of price/identity readiness and never links.
    let mut canonical_payload=vec![];let mut canonical_conflict=false;
    let canonical_read=(||->AppResult<()> {
        let mut ids=BTreeSet::new();
        for symbol in &symbols {
            let mut st=c.prepare("SELECT id FROM corporate_actions WHERE exchange=? AND effective_date=? AND (symbol=? OR (? IS NOT NULL AND isin=?)) ORDER BY id").map_err(|e|e.to_string())?;
            let found=st.query_map(params![raw.exchange,raw.ex_date,symbol,raw.isin,raw.isin],|x|x.get::<_,i64>(0)).map_err(|e|e.to_string())?.collect::<rusqlite::Result<Vec<_>>>().map_err(|e|e.to_string())?;
            for x in found{ids.insert(checked_id(x)?);}
        }
        let matched=find_existing_corporate_action(c,&raw)?.map(checked_id).transpose()?;if let Some(x)=matched{ids.insert(x);}
        if let Some(x)=raw.approved_corporate_action_id{ids.insert(checked_id(x)?);}
        let mut matching_type_count=0;let mut linked_found=false;
        for x in ids {
            if let Some(action)=repair_preview::load_repair_preview_canonical(c,x)? {
                if !finite_fields(&[Some(action.factor),action.ratio_num,action.ratio_den,action.old_face_value,action.new_face_value,action.cash_amount]){return Err("Non-finite canonical terms.".into());}
                r.canonical.candidate_ids.push(x);canonical_payload.push(serde_json::to_value(&action).map_err(|e|e.to_string())?);
                if action.action_type==raw.action_type {matching_type_count+=1;}
                if Some(x)==matched && !event_terms_match(&raw,&action){canonical_conflict=true;}
                if Some(x)==raw.approved_corporate_action_id {linked_found=true;if !event_terms_match(&raw,&action){canonical_conflict=true;}}
                r.canonical.evidence.push(evidence("repair_preview::load_repair_preview_canonical","CANONICAL_CANDIDATE",Some(x),None));
            }
        }
        r.canonical.owner_match_candidate_id=matched;r.canonical.linked_id=raw.approved_corporate_action_id;
        let declared_approved=raw.approved_corporate_action_id.is_some()||raw.review_status=="APPROVED";
        if declared_approved && (!linked_found||raw.approved_corporate_action_id.is_none()){canonical_conflict=true;}
        if matching_type_count>1{canonical_conflict=true;}
        r.canonical.state=if canonical_conflict{"MULTIPLE_OR_CONFLICTING"}else if linked_found{"LINKED_RECORD_PRESENT"}else if matched.is_some(){"OWNER_MATCH_REQUIRES_RECHECK"}else if r.canonical.candidate_ids.is_empty(){"NONE"}else{"CANDIDATE_ONLY"}.into();
        Ok(())
    })();
    if let Err(e)=canonical_read{canonical_conflict=true;owner_error(&mut r,"OWNER_CHECK_FAILED","CANONICAL",&e);}
    if canonical_conflict{add(&mut r,"CANONICAL_CONFLICT","CANONICAL","Canonical links/candidates are missing, multiple or inconsistent with the stored event terms. No duplicate or repair is inferred.","Review exact canonical semantics and linkage");}
    else if r.canonical.linked_id.is_none()&&!r.canonical.candidate_ids.is_empty(){
        r.blockers.push(blocker("CANONICAL_CANDIDATE_UNPROVEN","CANONICAL","WARNING","An existing canonical candidate was found. No link was written; identity, terms and writer rechecks still apply.","Reconcile only through the existing writer after all proofs"));
        plan(&mut r,"Recheck existing canonical candidate before any new action","find_existing_corporate_action / existing approval writer","EXISTING_OWNER_REQUIRES_SEPARATE_EXECUTION",&["Current identity and price prerequisites","No contradictory or duplicate canonical action"]);
    }
    let mut price_ready=false;
    if in_scope {
        match load_latest_official_split_bonus_validation(c,id) {
            Ok(Some(v))=>{
                checked_id(v.id)?;checked_id(v.scan_run_id)?;
                if !finite_fields(&[v.confidence,v.expected_factor,v.prev_close,v.ex_open,v.ex_close,v.actual_open_factor,v.actual_close_factor]){owner_error(&mut r,"OWNER_CHECK_FAILED","PRICE","Non-finite stored price evidence; outward numeric fields remain null.");}
                else {
                    r.price.scan_id=Some(v.id);r.price.scan_run_id=Some(v.scan_run_id);r.price.scanned_at=Some(v.scanned_at.clone());r.price.scan_status=Some(v.scan_status.clone());r.price.confidence=v.confidence;r.price.expected_factor=v.expected_factor;r.price.previous_trade_date=v.prev_trade_date.clone();r.price.ex_trade_date=v.ex_trade_date.clone();r.price.previous_close=v.prev_close;r.price.ex_open=v.ex_open;r.price.ex_close=v.ex_close;
                    match is_split_bonus_validation_current(c,&raw,&v){Ok(current)=>{r.price.row_fingerprint_check=if current{"PASS"}else{"BLOCKED"}.into();if !current{add(&mut r,"VALIDATION_STALE","PRICE","The existing current-row/effective-identity validation check rejects the stored scan.","Run separately authorized targeted validation");}},Err(e)=>{r.price.row_fingerprint_check="ERROR".into();owner_error(&mut r,"OWNER_CHECK_FAILED","PRICE",&e);}}
                    match ensure_compound_scan_fingerprint_current(c,&raw){Ok(())=>r.price.compound_fingerprint_check="PASS".into(),Err(e)=>{r.price.compound_fingerprint_check="BLOCKED".into();add(&mut r,"COMPOUND_COMPONENT_CHANGED","PRICE",&e,"Revalidate the current component set outside this read-only preview");}}
                    if v.scan_status=="NO_PRICE_DATA"{add(&mut r,"PRICE_DATA_MISSING","PRICE","Stored scan has no usable price window. No new scan was run.","Diagnose coverage/provenance before a separately authorized data repair");plan(&mut r,"Recover missing raw-price evidence","existing data import/validation owners","NEEDS_SEPARATE_DATA_REPAIR",&["Correct instrument and event","Authorized source/data repair"]);}
                    else if v.scan_status!="MATCHED"{add(&mut r,"PRICE_REVIEW_REQUIRED","PRICE","The stored scan is not MATCHED. No date shift, ratio inversion or exception is performed.","Inspect existing price/source evidence");}
                    if r.price.row_fingerprint_check=="PASS"&&r.price.compound_fingerprint_check=="PASS"&&v.scan_status=="MATCHED" {
                        match ensure_split_bonus_price_validation(c,&raw,false){Ok(())=>price_ready=true,Err(e)=>owner_error(&mut r,"OWNER_CHECK_FAILED","PRICE",&e)}
                    }
                }
            },Ok(None)=>add(&mut r,"VALIDATION_MISSING","PRICE","No completed official-import validation is stored for this import.","Run targeted validation separately; diagnostics do not write scans"),
            Err(e)=>{r.price.row_fingerprint_check="ERROR".into();owner_error(&mut r,"OWNER_CHECK_FAILED","PRICE",&e);}
        }
        let candidate=ScanCandidate{import_id:id,symbol:r.identity.event_symbol.clone(),exchange:raw.exchange.clone(),ex_date:raw.ex_date.clone(),factor:raw.factor};
        match load_same_date_split_bonus_compound_context(c,&candidate){
            Ok(Some(_))=>{if !compound&&!security_review&&!terms_conflict{r.classification.state="SUPPORTED_COMPOUND_REVIEW".into();}r.blockers.push(blocker("UNSUPPORTED_AUTOMATION_SCOPE","POLICY","WARNING","Existing same-date component validation may be supported; Safe V2 compound auto-approval is not authorized.","Preserve existing manual compound-validation workflow"));},
            Ok(None)=>{},Err(e)=>owner_error(&mut r,"OWNER_CHECK_FAILED","PRICE",&e),
        }
        match auto_approval::evaluate_auto_approval_r1(c,id) {
            Ok(auto_approval::AutoApprovalEligibility::Eligible(e))=>{let scan_id=match &e.basis{auto_approval::ActionApprovalBasis::SplitBonusScan{scan_id,..}=>Some(checked_id(*scan_id)?)};r.safe_v1.state="ELIGIBLE_AT_READ_SNAPSHOT".into();r.safe_v1.reason=Some("Existing Safe V2 evaluator is eligible at this read snapshot only; not preparation-scope authority or approval.".into());r.safe_v1.evidence.push(evidence("auto_approval::evaluate_auto_approval_r1",&e.identity_proof,scan_id,None));},
            Ok(auto_approval::AutoApprovalEligibility::Ineligible(reason))=>{r.safe_v1.state="INELIGIBLE".into();r.safe_v1.reason=Some(safe_message(&reason));r.blockers.push(blocker("SAFE_V1_INELIGIBLE","POLICY","INFORMATION",&reason,"Existing Safe V2 policy is read-only in this preview"));},
            Ok(auto_approval::AutoApprovalEligibility::AlreadyApproved)=>r.safe_v1.state="ALREADY_APPROVED".into(),
            Err(e)=>{r.safe_v1.state="ERROR".into();r.safe_v1.reason=Some(safe_message(&e));owner_error(&mut r,"OWNER_CHECK_FAILED","POLICY",&e);}
        }
    }
    let linked=r.canonical.state=="LINKED_RECORD_PRESENT";
    if linked {r.ordinary_readiness.state="ALREADY_LINKED".into();r.ordinary_readiness.message="The linked record is present; chart adjustment output is not certified by this preview.".into();}
    else if in_scope&&raw.parse_status=="PARSED"&&identity_ready&&price_ready&&raw.ex_date.is_some()&&raw.factor.map(|x|x>0.0).unwrap_or(false)&&r.outcome!="PREPARATION_ERROR" {
        r.ordinary_readiness.state="READY_FOR_WRITER_RECHECK".into();r.ordinary_readiness.message="Stored ordinary prerequisites pass; existing final writer performs its own instrument/term checks. No approval is executed.".into();
    } else if in_scope {r.ordinary_readiness.state=if r.outcome=="PREPARATION_ERROR"{"ERROR"}else{"BLOCKED"}.into();}
    if r.outcome!="PREPARATION_ERROR" {
        r.outcome=if !in_scope{"DEFERRED_SCOPE"}else if terms_conflict||security_review{"CLASSIFICATION_REVIEW"}else if linked&&!canonical_conflict{"ALREADY_LINKED_REVIEW"}else if canonical_conflict{"EVIDENCE_BLOCKED"}else if r.ordinary_readiness.state=="READY_FOR_WRITER_RECHECK"{"READY_FOR_EXISTING_APPROVAL_RECHECK"}else if !r.repair_plan.is_empty(){"REPAIR_CANDIDATE"}else{"EVIDENCE_BLOCKED"}.into();
        if linked&&!canonical_conflict&&!terms_conflict&&!security_review{r.blocks_in_scope_completeness=Some(false);}
    }
    let dependencies=row_dependencies(c,&raw,&symbols)?;
    let proposals=proposal.iter().map(|p|json!({"actionType":p.action_type,"ratioNum":p.ratio_num,"ratioDen":p.ratio_den,"oldFaceValue":p.old_face_value,"newFaceValue":p.new_face_value,"factor":p.factor,"priceFactor":p.price_factor,"parseStatus":p.parse_status})).collect::<Vec<_>>();
    r.row_fingerprint=digest(&json!({"rulesVersion":VERSION,"dependencies":dependencies,"canonicals":canonical_payload,"classificationProposals":proposals,"diagnostic":&r}))?;
    Ok(r)
}

fn preflight_with_connection(c: &Connection, input: &CorporateActionReconciliationPreflightInput, folder: &str, file_identity: &str, build: &str) -> CorporateActionReconciliationPreflightResult {
    let ids=match validate_request(input){Ok(x)=>x,Err(e)=>return rejected(input,"REQUEST_INVALID",&e)};
    let query_only=c.query_row("PRAGMA query_only",[],|r|r.get::<_,i64>(0)).unwrap_or(0);
    if query_only!=1||!c.is_autocommit(){return rejected(input,"OWNER_CHECK_FAILED","A dedicated query-only connection with no caller-owned transaction is required.");}
    if let Err(e)=c.execute_batch("BEGIN DEFERRED"){return rejected(input,"OWNER_CHECK_FAILED",&e.to_string());}
    let result=(||->AppResult<CorporateActionReconciliationPreflightResult>{
        if let Err(e)=verify_schema(c){return Ok(rejected(input,"SCHEMA_UNSUPPORTED",&e));}
        let schema=schema_fingerprint(c)?;let mut r=empty_result(input);r.status="COMPLETE".into();
        let sorted=ids.iter().copied().collect::<BTreeSet<_>>().into_iter().collect::<Vec<_>>();
        r.selection=R1ASelection{requested_count:input.import_ids.len(),unique_count:ids.len(),duplicate_count:input.import_ids.len()-ids.len(),unique_import_ids:ids.clone(),id_set_fingerprint:Some(digest(&json!(sorted))?)};
        r.database_context=Some(R1ADatabaseContext{canonical_database_path:folder.into(),database_file_identity:file_identity.into(),schema_fingerprint:schema,read_context:"CONSISTENT_READ_TRANSACTION".into(),selection_source:"EXISTING_CACHED_ACTIVE_FOLDER".into(),build_identity:build.into()});
        for id in ids {
            let row=match evaluate_row(c,id){Ok(row)=>row,Err(e)=>{let mut row=blank_row(id,true);owner_error(&mut row,"OWNER_CHECK_FAILED","REQUEST",&e);row.row_fingerprint=digest(&json!({"importId":id,"error":safe_message(&e)}))?;row}};
            if matches!(row.outcome.as_str(),"MISSING_IMPORT"|"PREPARATION_ERROR"){r.status="PARTIAL".into();}
            *r.summary.outcome_counts.get_mut(&row.outcome).ok_or("Unknown row outcome")?+=1;
            if row.blocks_in_scope_completeness==Some(true){r.summary.in_scope_blocked_rows+=1;}
            if row.blocks_in_scope_completeness.is_none(){r.summary.applicability_unknown_rows+=1;}
            if row.outcome=="DEFERRED_SCOPE"{r.summary.deferred_rows+=1;}
            r.rows.push(row);
        }
        r.summary.accounted_for=r.rows.len();let sorted_rows=r.rows.iter().map(|row|(row.import_id,row.row_fingerprint.clone())).collect::<BTreeMap<_,_>>();
        r.fingerprint=Some(digest(&json!({"rulesVersion":VERSION,"fieldInventory":FINGERPRINT_FIELDS,"context":&r.database_context,"sortedUniqueIds":sorted,"rowFingerprints":sorted_rows}))?);Ok(r)
    })();
    match result {
        Ok(r)=>{if let Err(e)=c.execute_batch("COMMIT"){let _=c.execute_batch("ROLLBACK");return rejected(input,"OWNER_CHECK_FAILED",&e.to_string());}r},
        Err(e)=>{let _=c.execute_batch("ROLLBACK");rejected(input,"OWNER_CHECK_FAILED",&e)},
    }
}

fn path_key(path: &str) -> String { let s=path.replace('\\',"/").trim_end_matches('/').to_string(); #[cfg(windows)] { return s.to_lowercase(); } #[cfg(not(windows))] { s } }
fn reject_reparse(path: &Path) -> AppResult<()> {
    for part in path.ancestors() {
        let m=fs::symlink_metadata(part).map_err(|_|"Path metadata could not be verified".to_string())?;
        if m.file_type().is_symlink(){return Err("Symbolic-link path is not permitted for R1-A diagnostic access.".into());}
        #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if m.file_attributes() & 0x400 != 0 {return Err("Reparse-point redirection is not permitted for R1-A diagnostic access.".into());} }
    } Ok(())
}
fn safe_database_name(name:&str)->bool {
    if name.is_empty()||name.len()>255||name=="."||name==".."||name.ends_with('.')||name.ends_with(' ')||name.chars().any(|c|c.is_control()||matches!(c,'/'|'\\'|':'|'*'|'?'|'"'|'<'|'>'|'|')){return false;}
    let stem=name.split('.').next().unwrap_or_default().to_ascii_uppercase();
    if matches!(stem.as_str(),"CON"|"PRN"|"AUX"|"NUL")||(stem.len()==4&&(stem.starts_with("COM")||stem.starts_with("LPT"))&&matches!(stem.as_bytes()[3],b'1'..=b'9')){return false;}
    [".sqlite3",".sqlite",".db"].iter().any(|suffix|name.to_ascii_lowercase().ends_with(suffix))
}
fn validate_database_path(folder: &Path) -> AppResult<PathBuf> {
    if !folder.is_absolute(){return Err("Active database folder must be absolute.".into());}reject_reparse(folder)?;
    let root=folder.canonicalize().map_err(|_|"Could not resolve active folder".to_string())?;let manifest=root.join("database.json");let mut name="market-data.sqlite3".to_string();
    if manifest.exists(){reject_reparse(&manifest)?;if fs::metadata(&manifest).map_err(|e|e.to_string())?.len()>1_048_576{return Err("Database manifest is too large".into());}
        let m:Value=serde_json::from_slice(&fs::read(&manifest).map_err(|e|e.to_string())?).map_err(|_|"Malformed database manifest".to_string())?;
        if m["format"]!="eod-chart-db"||m["version"]!=1{return Err("Unsupported database manifest".into());}name=m["dbFile"].as_str().ok_or("Missing dbFile")?.into();
    }
    if !safe_database_name(&name){return Err("Unsafe database manifest filename".into());}let db=root.join(&name);reject_reparse(&db)?;
    let resolved=db.canonicalize().map_err(|_|"Database file is unavailable".to_string())?;
    if !resolved.starts_with(&root)||!resolved.is_file(){return Err("Database file escaped its active folder".into());}
    for suffix in ["-wal","-shm"]{let side=root.join(format!("{name}{suffix}"));if side.exists(){reject_reparse(&side)?;}}
    Ok(resolved)
}
fn open_validated_read_only(db: &Path) -> AppResult<Connection> {
    // Windows canonicalize() adds \\?\ to a local drive path. It is an OS
    // namespace prefix, not a SQLite URI authority; remove it only for X:\ paths.
    let display=db.to_string_lossy();
    let local=display.strip_prefix(r"\\?\")
        .filter(|rest|rest.as_bytes().get(1)==Some(&b':'))
        .unwrap_or(display.as_ref());
    let text=local.replace('\\',"/");let mut encoded=String::new();
    for b in text.bytes(){if b.is_ascii_alphanumeric()||matches!(b,b'-'|b'_'|b'.'|b'~'|b'/'|b':'){encoded.push(char::from(b));}else{encoded.push_str(&format!("%{b:02X}"));}}
    let c=Connection::open_with_flags(format!("file:{encoded}?mode=ro"),OpenFlags::SQLITE_OPEN_READ_ONLY|OpenFlags::SQLITE_OPEN_URI|OpenFlags::SQLITE_OPEN_NO_MUTEX).map_err(|e|e.to_string())?;
    c.pragma_update(None,"query_only",true).map_err(|e|e.to_string())?;Ok(c)
}
fn build_identity()->String{let bytes=include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"),"/gen/build-info.json"));format!("{}:{:X}",env!("CARGO_PKG_VERSION"),Sha256::digest(bytes))}

fn expected_context_path(folder: &Path, expected: &str) -> Result<String, (&'static str, String)> {
    let canonical=folder.canonicalize().map_err(|_| ("DATABASE_PATH_REJECTED", "Cached active folder could not be verified.".to_string()))?;
    let text=canonical.to_string_lossy().trim_start_matches("\\\\?\\").to_string();
    if path_key(expected)!=path_key(&text) && path_key(expected)!=path_key(&folder.to_string_lossy()) {
        return Err(("DATABASE_CHANGED", "Expected and cached active database paths differ.".to_string()));
    }
    Ok(text)
}

pub(super) async fn preview_split_bonus_reconciliation_internal(app: AppHandle, input: CorporateActionReconciliationPreflightInput) -> AppResult<CorporateActionReconciliationPreflightResult> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(e)=validate_request(&input){return Ok(rejected(&input,"REQUEST_INVALID",&e));}
        let folder=match peek_active_database_folder_read_only(&app){Ok(Some(p))=>p,Ok(None)=>return Ok(rejected(&input,"DATABASE_CONTEXT_UNAVAILABLE","No initialized cached active database exists. No registry or connection was initialized.")),Err(e)=>return Ok(rejected(&input,"DATABASE_CONTEXT_UNAVAILABLE",&e))};
        // Never interpret expectedDatabasePath as authority to open another database.
        let canonical_text=match expected_context_path(&folder,&input.expected_database_path) {
            Ok(text)=>text,Err((code,message))=>return Ok(rejected(&input,code,&message)),
        };
        let db=match validate_database_path(&folder){Ok(p)=>p,Err(e)=>return Ok(rejected(&input,"DATABASE_PATH_REJECTED",&e))};
        let file_identity=match fs::metadata(&db){Ok(m)=>format!("{}|{}|{:?}",db.to_string_lossy(),m.len(),m.created().ok()),Err(e)=>return Ok(rejected(&input,"DATABASE_PATH_REJECTED",&e.to_string()))};
        let c=match open_validated_read_only(&db){Ok(c)=>c,Err(e)=>return Ok(rejected(&input,"DATABASE_PATH_REJECTED",&e))};
        let r=preflight_with_connection(&c,&input,&canonical_text,&file_identity,&build_identity());
        if peek_active_database_folder_read_only(&app)?.as_ref()!=Some(&folder){return Ok(rejected(&input,"DATABASE_CHANGED","Active database changed while preview was running. Discarded result."));}
        if validate_database_path(&folder).ok().as_ref()!=Some(&db){return Ok(rejected(&input,"DATABASE_PATH_REJECTED","Database path changed during preview. Discarded result."));}
        Ok(r)
    }).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
fn logical_database_fingerprint(c:&Connection)->AppResult<String>{
    let mut tables=BTreeMap::new();
    for name in ["corporate_action_imports","corporate_actions","corporate_action_import_evidence","corporate_action_import_decisions","instrument_identity_history","instrument_isin_history","instruments","corporate_action_scan_results","scan_runs","corporate_action_event_identity_resolutions"] {
        let exists=c.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",[name],|r|r.get::<_,i64>(0)).map_err(|e|e.to_string())?!=0;
        if exists{let order=if name=="instruments"{"symbol,exchange,isin"}else{"id"};tables.insert(name,tagged_rows(c,&format!("SELECT * FROM {name} ORDER BY {order}"),&[])?);}
    }digest(&json!({"schema":schema_fingerprint(c)?,"tables":tables}))
}
#[cfg(test)]
mod tests;

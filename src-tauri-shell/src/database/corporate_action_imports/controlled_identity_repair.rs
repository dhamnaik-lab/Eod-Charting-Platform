use crate::database::instrument_mutations::{
    insert_historical_isin_evidence_v113b1_strict_no_promotion,
    V113B1StrictHistoricalIsinInsertOutcome,
};
use crate::database::AppResult;
use chrono::Utc;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

const V113B1_AUTHORITY_SHA256: &str =
    "0d5ec6ca4a8c2a889411aedb1d02664e550e2a21d11da54f38351c5e3c8aa554";
const V113B1_PARENT_CANDIDATE_SET_FINGERPRINT: &str =
    "b4f61783db9a84958b3a278a0ff00d2687925463dea63a97bd39e46a28e504cf";
const V113B1_PARENT_DISPOSITION_SET_FINGERPRINT: &str =
    "f9254415fd96434f43a32b686d90519d30cc2b30210e913c57fe016283894f35";
const V113B1_PARENT_MUTATION_SET_FINGERPRINT: &str =
    "60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7";
const V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT: &str =
    "4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7";
const V113B1_APPLY_PLAN_FINGERPRINT_VERSION: &str = "ca-v113b1-apply-plan-v1";
const V113B1_COMMITTED_REPORT_FAILURE_EXIT: i32 = 43;
const V113B1_SOURCE: &str = "V1.12.1_EXTERNAL_EVIDENCE";

#[derive(Clone, Copy, Debug)]
struct AuthorizedMutationSpec {
    import_id: i64,
    exchange: &'static str,
    symbol: &'static str,
    historical_isin: &'static str,
    company_name: &'static str,
    ex_date: &'static str,
    action_type: &'static str,
    destination_symbol: &'static str,
    destination_isin: &'static str,
    destination_company: &'static str,
    source_ref: &'static str,
    note: &'static str,
    candidate_fingerprint: &'static str,
    mutation_fingerprint: &'static str,
}

static AUTHORIZED_MUTATIONS: [AuthorizedMutationSpec; 6] = [
    AuthorizedMutationSpec {
        import_id: 12841,
        exchange: "NSE",
        symbol: "TITAN",
        historical_isin: "INE280A01010",
        company_name: "Titan Company Limited",
        ex_date: "2011-06-23",
        action_type: "BONUS",
        destination_symbol: "TITAN",
        destination_isin: "INE280A01028",
        destination_company: "Titan Company Limited",
        source_ref: "V112-EVID-0001",
        note: "V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001",
        candidate_fingerprint: "da29a101e6d77956313a50fb358cf0a887445c67bb7f0e001d95097eb7c01036",
        mutation_fingerprint: "017ce461b70361e13daa875ef0ea3b9c81fb9a2fe23fd673fed47a7777e19a9a",
    },
    AuthorizedMutationSpec {
        import_id: 19888,
        exchange: "NSE",
        symbol: "SBIN",
        historical_isin: "INE062A01012",
        company_name: "State Bank of India",
        ex_date: "2014-11-20",
        action_type: "SPLIT",
        destination_symbol: "SBIN",
        destination_isin: "INE062A01020",
        destination_company: "State Bank of India",
        source_ref: "V112-EVID-0003",
        note: "V1.13 controlled identity repair; importIds=19888; evidence=V112-EVID-0003",
        candidate_fingerprint: "20e767523c28d6c604472dbcf0e28c5bb478d3c4228126c79bc9090499a2bbfc",
        mutation_fingerprint: "05c02da876bcb5c59844ee5e9b20030fb5d6d11fd6e7981f4a562289f6a098a1",
    },
    AuthorizedMutationSpec {
        import_id: 23036,
        exchange: "NSE",
        symbol: "BAJFINANCE",
        historical_isin: "INE296A01016",
        company_name: "Bajaj Finance Limited",
        ex_date: "2016-09-08",
        action_type: "BONUS",
        destination_symbol: "BAJFINANCE",
        destination_isin: "INE296A01032",
        destination_company: "Bajaj Finance Limited",
        source_ref: "V112-EVID-0002",
        note: "V1.13 controlled identity repair; importIds=23036; evidence=V112-EVID-0002",
        candidate_fingerprint: "6cca72caffe3939672c285ee40722c68594c9a545265dc1f8a83cb99df1dded7",
        mutation_fingerprint: "94ef9a56909a80414f3cb70a81da1bff43ae3cd3ead85327318edb7aaaf6d259",
    },
    AuthorizedMutationSpec {
        import_id: 24025,
        exchange: "NSE",
        symbol: "GAYAPROJ",
        historical_isin: "INE336H01015",
        company_name: "GAYAPROJ",
        ex_date: "2017-02-10",
        action_type: "SPLIT",
        destination_symbol: "GAYAPROJ",
        destination_isin: "INE336H01023",
        destination_company: "Gayatri Projects Limited",
        source_ref: "V112-EVID-0026",
        note: "V1.13 controlled identity repair; importIds=24025; evidence=V112-EVID-0026",
        candidate_fingerprint: "26c04b61d616c1380f4f164b75fbbfdf80a18cc91f0e49cf14dbb22dc99b6130",
        mutation_fingerprint: "f547dd7a3ffd71be79147b46b356d481a50b690bf85d7481ae211ea36b151db0",
    },
    AuthorizedMutationSpec {
        import_id: 24224,
        exchange: "NSE",
        symbol: "HINDCOMPOS",
        historical_isin: "INE310C01011",
        company_name: "Hindustan Composites Limited",
        ex_date: "2017-05-25",
        action_type: "BONUS",
        destination_symbol: "HINDCOMPOS",
        destination_isin: "INE310C01029",
        destination_company: "Hindustan Composites Limited",
        source_ref: "V112-EVID-0006",
        note: "V1.13 controlled identity repair; importIds=24224; evidence=V112-EVID-0006",
        candidate_fingerprint: "23558e6c75cfb44706f9bbff188c7910d040127c0fd8c812d86e0cc1a7923a25",
        mutation_fingerprint: "df352f3f2040eb82e1f6bbfd0c4383cd419ea9f599b72ac3eab32acc21c591f8",
    },
    AuthorizedMutationSpec {
        import_id: 42274,
        exchange: "NSE",
        symbol: "PARSVNATH",
        historical_isin: "INE561H01018",
        company_name: "PARSVNATH",
        ex_date: "2010-10-18",
        action_type: "SPLIT",
        destination_symbol: "PARSVNATH",
        destination_isin: "INE561H01026",
        destination_company: "Parsvnath Developers Limited",
        source_ref: "V112-EVID-0027",
        note: "V1.13 controlled identity repair; importIds=42274; evidence=V112-EVID-0027",
        candidate_fingerprint: "e3c5148788a82d0dcd3d8a71ef0b848417e043960ed2e40deb57e86bd4d372f2",
        mutation_fingerprint: "af77845ccff45db329228f17f6e53d4ea71a0aae91570eb9222f3e35df62d3ae",
    },
];

static PROTECTED_IMPORT_IDS: [i64; 8] = [819, 19896, 19973, 19977, 22969, 41025, 41574, 42863];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityDocument {
    status: String,
    basis: AuthorityBasis,
    tranche: AuthorityTranche,
    constraints: AuthorityConstraints,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityBasis {
    v113a2: AuthorityV113A2,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityV113A2 {
    candidate_set_fingerprint: String,
    disposition_set_fingerprint: String,
    mutation_set_fingerprint: String,
    safe_count: usize,
    ready_insert_count: usize,
    already_satisfied_count: usize,
    blocked_count: usize,
    unique_mutation_count: usize,
    non_safe_excluded_count: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityTranche {
    version: String,
    parent_candidate_set_fingerprint: String,
    parent_mutation_set_fingerprint: String,
    authorized_import_ids: Vec<i64>,
    protected_blocked_import_ids: Vec<i64>,
    non_safe_excluded_count: usize,
    authorization_tranche_fingerprint: String,
    authorized_mutations: Vec<AuthorityMutation>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityMutation {
    import_id: i64,
    exchange: String,
    symbol: String,
    historical_isin: String,
    effective_date: String,
    source: String,
    source_ref: String,
    note: String,
    candidate_fingerprint: String,
    mutation_fingerprint: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityConstraints {
    only_writable_table: String,
    must_not_write_tables: Vec<String>,
    corporate_action_approvals: usize,
    quick_resolves: usize,
    status_promotions: usize,
    raw_price_writes: usize,
    factor_adjustment_writes: usize,
    git_operations: usize,
    transaction_policy: String,
    post_audit_required_before_full_success: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct V113B1DatabaseFamilyHashes {
    main_sha256: String,
    wal_sha256: String,
    shm_sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CandidatePreflightResult {
    import_id: i64,
    symbol: String,
    outcome: String,
    reason: String,
    history_row_id: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ProtectedCandidateCheck {
    import_id: i64,
    status: String,
    reason: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MutationPlanRow {
    mutation_index: usize,
    table: String,
    exchange: String,
    symbol: String,
    isin: String,
    effective_date: String,
    source: String,
    source_ref: String,
    note: String,
    authorized_import_ids: Vec<i64>,
    evidence_source_ids: Vec<String>,
    mutation_fingerprint: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MutationPlanCsvRow {
    mutation_index: usize,
    table: String,
    exchange: String,
    symbol: String,
    isin: String,
    effective_date: String,
    source: String,
    source_ref: String,
    note: String,
    authorized_import_ids: String,
    evidence_source_ids: String,
    mutation_fingerprint: String,
}

impl From<&MutationPlanRow> for MutationPlanCsvRow {
    fn from(row: &MutationPlanRow) -> Self {
        Self {
            mutation_index: row.mutation_index,
            table: row.table.clone(),
            exchange: row.exchange.clone(),
            symbol: row.symbol.clone(),
            isin: row.isin.clone(),
            effective_date: row.effective_date.clone(),
            source: row.source.clone(),
            source_ref: row.source_ref.clone(),
            note: row.note.clone(),
            authorized_import_ids: row
                .authorized_import_ids
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(";"),
            evidence_source_ids: row.evidence_source_ids.join(";"),
            mutation_fingerprint: row.mutation_fingerprint.clone(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreflightManifest {
    format_version: String,
    version: String,
    mode: String,
    status: String,
    authority_sha256: String,
    authorization_tranche_fingerprint: String,
    parent_candidate_set_fingerprint: String,
    parent_disposition_set_fingerprint: String,
    mutation_set_fingerprint: String,
    apply_plan_fingerprint_version: String,
    apply_plan_fingerprint: String,
    database_file: String,
    database_family_hashes: V113B1DatabaseFamilyHashes,
    authorized_import_ids: Vec<i64>,
    protected_import_ids: Vec<i64>,
    ready_insert_count: usize,
    already_satisfied_count: usize,
    blocked_count: usize,
    candidate_results: Vec<CandidatePreflightResult>,
    protected_checks: Vec<ProtectedCandidateCheck>,
    mutation_plan: Vec<MutationPlanRow>,
    created_at: String,
    database_writes: usize,
    corporate_action_writes: usize,
    quick_resolves: usize,
    approvals: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    verified: bool,
    source_database_family: V113B1DatabaseFamilyHashes,
    backup_directory: String,
    created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyMutationResult {
    import_id: i64,
    symbol: String,
    history_row_id: i64,
    outcome: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyResult {
    version: String,
    mode: String,
    result: String,
    transaction_committed: bool,
    authority_sha256: String,
    authorization_tranche_fingerprint: String,
    mutation_set_fingerprint: String,
    apply_plan_fingerprint: String,
    history_rows_inserted: usize,
    history_rows_already_satisfied: usize,
    candidate_count: usize,
    protected_count: usize,
    database_writes: usize,
    corporate_action_writes: usize,
    quick_resolves: usize,
    approvals: usize,
    mutation_results: Vec<ApplyMutationResult>,
}

#[derive(Clone, Debug)]
enum MaintenanceMode {
    Preflight,
    Apply,
}

#[derive(Clone, Debug)]
struct MaintenanceInput {
    mode: MaintenanceMode,
    database_file: PathBuf,
    authority_path: PathBuf,
    authority_sha256: String,
    output_path: PathBuf,
    live_database_family_hashes: V113B1DatabaseFamilyHashes,
    preflight_manifest_path: Option<PathBuf>,
    backup_manifest_path: Option<PathBuf>,
}

fn normalize_compare(value: Option<&str>) -> String {
    value.unwrap_or("").trim().to_uppercase()
}

fn canonical_sha256(value: &Value) -> AppResult<String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn sidecar_path(database_file: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", database_file.to_string_lossy(), suffix))
}

fn compute_database_family_hashes(database_file: &Path) -> AppResult<V113B1DatabaseFamilyHashes> {
    if !database_file.is_file() {
        return Err(format!(
            "Database file does not exist: {}",
            database_file.display()
        ));
    }
    let wal = sidecar_path(database_file, "-wal");
    let shm = sidecar_path(database_file, "-shm");
    Ok(V113B1DatabaseFamilyHashes {
        main_sha256: sha256_file(database_file)?,
        wal_sha256: if wal.is_file() {
            sha256_file(&wal)?
        } else {
            String::new()
        },
        shm_sha256: if shm.is_file() {
            sha256_file(&shm)?
        } else {
            String::new()
        },
    })
}

fn require_database_family_matches(
    database_file: &Path,
    expected: &V113B1DatabaseFamilyHashes,
) -> AppResult<()> {
    let actual = compute_database_family_hashes(database_file)?;
    if &actual != expected {
        return Err(format!(
            "Database-family bytes differ from the V1.13B-1 manifest. expected={:?} actual={:?}",
            expected, actual
        ));
    }
    Ok(())
}

fn final_mutation_value(spec: &AuthorizedMutationSpec) -> Value {
    json!({
        "authorizedImportIds": [spec.import_id],
        "effectiveDate": spec.ex_date,
        "evidenceSourceIds": [spec.source_ref],
        "exchange": spec.exchange,
        "isin": spec.historical_isin,
        "note": spec.note,
        "source": V113B1_SOURCE,
        "sourceRef": spec.source_ref,
        "symbol": spec.symbol,
        "table": "instrument_isin_history"
    })
}

fn semantic_mutation_value(spec: &AuthorizedMutationSpec) -> Value {
    json!({
        "effectiveDate": spec.ex_date,
        "exchange": spec.exchange,
        "isin": spec.historical_isin,
        "source": V113B1_SOURCE,
        "symbol": spec.symbol,
        "table": "instrument_isin_history"
    })
}

fn mutation_specs_in_plan_order() -> AppResult<Vec<&'static AuthorizedMutationSpec>> {
    let mut keyed = Vec::<(String, &'static AuthorizedMutationSpec)>::new();
    for spec in &AUTHORIZED_MUTATIONS {
        keyed.push((canonical_sha256(&semantic_mutation_value(spec))?, spec));
    }
    keyed.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(keyed.into_iter().map(|(_, spec)| spec).collect())
}

fn recompute_mutation_set_fingerprint() -> AppResult<String> {
    let values = mutation_specs_in_plan_order()?
        .into_iter()
        .map(final_mutation_value)
        .collect::<Vec<_>>();
    canonical_sha256(&Value::Array(values))
}

fn recompute_authorization_tranche_fingerprint() -> AppResult<String> {
    canonical_sha256(&json!({
        "authorizedImportIds": AUTHORIZED_MUTATIONS.iter().map(|spec| spec.import_id).collect::<Vec<_>>(),
        "nonSafeExcludedCount": 97,
        "parentCandidateSetFingerprint": V113B1_PARENT_CANDIDATE_SET_FINGERPRINT,
        "parentMutationSetFingerprint": V113B1_PARENT_MUTATION_SET_FINGERPRINT,
        "protectedBlockedImportIds": PROTECTED_IMPORT_IDS.iter().copied().collect::<Vec<_>>(),
        "version": "V1.13B-1-AUTHORIZATION-V1"
    }))
}

fn mutation_plan_rows() -> AppResult<Vec<MutationPlanRow>> {
    let mut rows = Vec::new();
    for (index, spec) in mutation_specs_in_plan_order()?.into_iter().enumerate() {
        rows.push(MutationPlanRow {
            mutation_index: index + 1,
            table: "instrument_isin_history".to_string(),
            exchange: spec.exchange.to_string(),
            symbol: spec.symbol.to_string(),
            isin: spec.historical_isin.to_string(),
            effective_date: spec.ex_date.to_string(),
            source: V113B1_SOURCE.to_string(),
            source_ref: spec.source_ref.to_string(),
            note: spec.note.to_string(),
            authorized_import_ids: vec![spec.import_id],
            evidence_source_ids: vec![spec.source_ref.to_string()],
            mutation_fingerprint: spec.mutation_fingerprint.to_string(),
        });
    }
    Ok(rows)
}

fn verify_authority_semantics(authority: &AuthorityDocument) -> AppResult<()> {
    if authority.status != "DESIGN_AUTHORITY_ONLY_NO_WRITE_IMPLEMENTATION" {
        return Err("V1.13B-1 authority status is not the accepted design lock.".to_string());
    }
    let v113a2 = &authority.basis.v113a2;
    if v113a2.candidate_set_fingerprint != V113B1_PARENT_CANDIDATE_SET_FINGERPRINT
        || v113a2.disposition_set_fingerprint != V113B1_PARENT_DISPOSITION_SET_FINGERPRINT
        || v113a2.mutation_set_fingerprint != V113B1_PARENT_MUTATION_SET_FINGERPRINT
        || v113a2.safe_count != 14
        || v113a2.ready_insert_count != 6
        || v113a2.already_satisfied_count != 0
        || v113a2.blocked_count != 8
        || v113a2.unique_mutation_count != 6
        || v113a2.non_safe_excluded_count != 97
    {
        return Err("V1.13A.2 parent authority contract mismatch.".to_string());
    }

    let tranche = &authority.tranche;
    let expected_authorized = AUTHORIZED_MUTATIONS
        .iter()
        .map(|spec| spec.import_id)
        .collect::<Vec<_>>();
    if tranche.version != "V1.13B-1-AUTHORIZATION-V1"
        || tranche.parent_candidate_set_fingerprint != V113B1_PARENT_CANDIDATE_SET_FINGERPRINT
        || tranche.parent_mutation_set_fingerprint != V113B1_PARENT_MUTATION_SET_FINGERPRINT
        || tranche.authorized_import_ids != expected_authorized
        || tranche.protected_blocked_import_ids.as_slice() != &PROTECTED_IMPORT_IDS[..]
        || tranche.non_safe_excluded_count != 97
        || tranche.authorization_tranche_fingerprint != V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT
    {
        return Err("V1.13B-1 six-row/eight-row authority partition mismatch.".to_string());
    }
    if recompute_authorization_tranche_fingerprint()? != V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT {
        return Err("Compiled V1.13B-1 authorization-tranche fingerprint mismatch.".to_string());
    }
    if recompute_mutation_set_fingerprint()? != V113B1_PARENT_MUTATION_SET_FINGERPRINT {
        return Err("Compiled V1.13B-1 mutation-set fingerprint mismatch.".to_string());
    }

    if tranche.authorized_mutations.len() != AUTHORIZED_MUTATIONS.len() {
        return Err("V1.13B-1 authority mutation count is not six.".to_string());
    }
    for spec in &AUTHORIZED_MUTATIONS {
        let row = tranche
            .authorized_mutations
            .iter()
            .find(|row| row.import_id == spec.import_id)
            .ok_or_else(|| format!("V1.13B-1 authority is missing import {}.", spec.import_id))?;
        if normalize_compare(Some(&row.exchange)) != spec.exchange
            || normalize_compare(Some(&row.symbol)) != spec.symbol
            || normalize_compare(Some(&row.historical_isin)) != spec.historical_isin
            || row.effective_date.trim() != spec.ex_date
            || row.source.trim() != V113B1_SOURCE
            || row.source_ref.trim() != spec.source_ref
            || row.note.trim() != spec.note
            || row.candidate_fingerprint != spec.candidate_fingerprint
            || row.mutation_fingerprint != spec.mutation_fingerprint
        {
            return Err(format!(
                "V1.13B-1 authority mutation drift for import {}.",
                spec.import_id
            ));
        }
        if canonical_sha256(&final_mutation_value(spec))? != spec.mutation_fingerprint {
            return Err(format!(
                "V1.13B-1 compiled mutation fingerprint drift for import {}.",
                spec.import_id
            ));
        }
    }

    let constraints = &authority.constraints;
    let required_forbidden = [
        "instrument_identity_history",
        "instruments",
        "corporate_action_imports",
        "corporate_action_import_evidence",
        "corporate_action_import_decisions",
        "corporate_actions",
        "eod_prices",
    ];
    let forbidden = constraints
        .must_not_write_tables
        .iter()
        .map(|value| value.as_str())
        .collect::<BTreeSet<_>>();
    if constraints.only_writable_table != "instrument_isin_history"
        || required_forbidden
            .iter()
            .any(|table| !forbidden.contains(*table))
        || constraints.corporate_action_approvals != 0
        || constraints.quick_resolves != 0
        || constraints.status_promotions != 0
        || constraints.raw_price_writes != 0
        || constraints.factor_adjustment_writes != 0
        || constraints.git_operations != 0
        || constraints.transaction_policy != "ALL_SIX_OR_ROLLBACK"
        || !constraints.post_audit_required_before_full_success
    {
        return Err("V1.13B-1 write-boundary authority mismatch.".to_string());
    }
    Ok(())
}

fn load_and_verify_authority(path: &Path, supplied_sha256: &str) -> AppResult<AuthorityDocument> {
    let actual = sha256_file(path)?;
    if actual != V113B1_AUTHORITY_SHA256 || supplied_sha256 != V113B1_AUTHORITY_SHA256 {
        return Err(format!(
            "V1.13B-1 authority SHA-256 mismatch. expected={} supplied={} actual={}",
            V113B1_AUTHORITY_SHA256, supplied_sha256, actual
        ));
    }
    let authority: AuthorityDocument =
        serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Invalid V1.13B-1 authority JSON: {error}"))?;
    verify_authority_semantics(&authority)?;
    Ok(authority)
}

fn query_history_rows(
    connection: &Connection,
    spec: &AuthorizedMutationSpec,
) -> AppResult<Vec<(i64, String, Option<String>, Option<String>, Option<String>)>> {
    let mut statement = connection
        .prepare(
            "
              SELECT id, isin, source, source_ref, note
              FROM instrument_isin_history
              WHERE exchange = ? AND symbol = ? AND COALESCE(effective_date, '') = ?
              ORDER BY id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![spec.exchange, spec.symbol, spec.ex_date], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn blocked(
    spec: &AuthorizedMutationSpec,
    outcome: &str,
    reason: String,
) -> CandidatePreflightResult {
    CandidatePreflightResult {
        import_id: spec.import_id,
        symbol: spec.symbol.to_string(),
        outcome: outcome.to_string(),
        reason,
        history_row_id: None,
    }
}

fn analyze_authorized_candidate(
    connection: &Connection,
    spec: &AuthorizedMutationSpec,
) -> AppResult<CandidatePreflightResult> {
    let live = connection
        .query_row(
            "
              SELECT exchange, symbol, isin, company_name, ex_date, action_type,
                     parse_status, review_status, approved_corporate_action_id
              FROM corporate_action_imports
              WHERE id = ?
            ",
            params![spec.import_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<i64>>(8)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((
        exchange,
        symbol,
        isin,
        company_name,
        ex_date,
        action_type,
        parse_status,
        review_status,
        approved_id,
    )) = live
    else {
        return Ok(blocked(
            spec,
            "BLOCKED_IMPORT_STATE_DRIFT",
            "Corporate Action import row is missing.".to_string(),
        ));
    };

    let comparisons = [
        (
            "exchange",
            normalize_compare(Some(&exchange)),
            spec.exchange.to_string(),
        ),
        (
            "symbol",
            normalize_compare(symbol.as_deref()),
            spec.symbol.to_string(),
        ),
        (
            "isin",
            normalize_compare(isin.as_deref()),
            spec.historical_isin.to_string(),
        ),
        (
            "company_name",
            normalize_compare(company_name.as_deref()),
            normalize_compare(Some(spec.company_name)),
        ),
        (
            "ex_date",
            normalize_compare(ex_date.as_deref()),
            normalize_compare(Some(spec.ex_date)),
        ),
        (
            "action_type",
            normalize_compare(Some(&action_type)),
            spec.action_type.to_string(),
        ),
    ];
    let drift = comparisons
        .into_iter()
        .filter_map(|(name, actual, expected)| if actual != expected { Some(name) } else { None })
        .collect::<Vec<_>>();
    if !drift.is_empty() {
        return Ok(blocked(
            spec,
            "BLOCKED_IMPORT_STATE_DRIFT",
            format!("business-key drift: {}", drift.join(", ")),
        ));
    }
    if parse_status != "PARSED" || review_status != "UNRESOLVED" || approved_id.is_some() {
        return Ok(blocked(
            spec,
            "BLOCKED_IMPORT_STATE_DRIFT",
            format!(
                "expected PARSED/UNRESOLVED/unapproved; actual parse_status={} review_status={} approved={}",
                parse_status,
                review_status,
                approved_id.is_some()
            ),
        ));
    }

    let destination = connection
        .query_row(
            "
              SELECT isin, name, is_active
              FROM instruments
              WHERE exchange = ? AND symbol = ?
            ",
            params![spec.exchange, spec.destination_symbol],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((destination_isin, destination_name, is_active)) = destination else {
        return Ok(blocked(
            spec,
            "BLOCKED_DESTINATION_IDENTITY_DRIFT",
            "destination instrument is missing.".to_string(),
        ));
    };
    if normalize_compare(destination_isin.as_deref()) != spec.destination_isin
        || normalize_compare(destination_name.as_deref())
            != normalize_compare(Some(spec.destination_company))
        || is_active != 1
    {
        return Ok(blocked(
            spec,
            "BLOCKED_DESTINATION_IDENTITY_DRIFT",
            "destination symbol/ISIN/name/active-state differs from accepted authority."
                .to_string(),
        ));
    }

    let rows = query_history_rows(connection, spec)?;
    if rows.len() > 1 {
        return Ok(blocked(
            spec,
            "BLOCKED_MULTIPLE_EXACT_HISTORY_ROWS",
            format!(
                "{} exact exchange/symbol/date historical-ISIN rows exist.",
                rows.len()
            ),
        ));
    }
    if let Some((id, existing_isin, source, source_ref, note)) = rows.into_iter().next() {
        if normalize_compare(Some(&existing_isin)) != spec.historical_isin {
            return Ok(blocked(
                spec,
                "BLOCKED_HISTORY_VALUE_CONFLICT",
                format!(
                    "existing exact-date ISIN {} conflicts with authorized {}.",
                    existing_isin, spec.historical_isin
                ),
            ));
        }
        let bound = source.as_deref().map(str::trim) == Some(V113B1_SOURCE)
            && source_ref.as_deref().map(str::trim) == Some(spec.source_ref)
            && note.as_deref().map(str::trim) == Some(spec.note);
        if !bound {
            return Ok(blocked(
                spec,
                "BLOCKED_PREEXISTING_UNBOUND_MATCH",
                "matching exact-date historical ISIN exists without exact V1.13B-1 provenance."
                    .to_string(),
            ));
        }
        return Ok(CandidatePreflightResult {
            import_id: spec.import_id,
            symbol: spec.symbol.to_string(),
            outcome: "READY_ALREADY_SATISFIED".to_string(),
            reason: "exact authorized V1.13B-1 historical ISIN evidence already exists."
                .to_string(),
            history_row_id: Some(id),
        });
    }

    Ok(CandidatePreflightResult {
        import_id: spec.import_id,
        symbol: spec.symbol.to_string(),
        outcome: "READY_INSERT".to_string(),
        reason: "exact authorized historical ISIN evidence is absent.".to_string(),
        history_row_id: None,
    })
}

fn analyze_all_authorized(connection: &Connection) -> AppResult<Vec<CandidatePreflightResult>> {
    AUTHORIZED_MUTATIONS
        .iter()
        .map(|spec| analyze_authorized_candidate(connection, spec))
        .collect()
}

fn check_protected_candidates(connection: &Connection) -> AppResult<Vec<ProtectedCandidateCheck>> {
    let mut checks = Vec::new();
    for import_id in PROTECTED_IMPORT_IDS.iter().copied() {
        let state = connection
            .query_row(
                "
                  SELECT review_status, approved_corporate_action_id
                  FROM corporate_action_imports
                  WHERE id = ?
                ",
                params![import_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        match state {
            Some((review_status, approved_id))
                if review_status == "UNRESOLVED" && approved_id.is_none() =>
            {
                checks.push(ProtectedCandidateCheck {
                    import_id,
                    status: "PROTECTED_UNCHANGED".to_string(),
                    reason: "excluded from V1.13B-1 and still unresolved/unapproved.".to_string(),
                });
            }
            Some((review_status, approved_id)) => checks.push(ProtectedCandidateCheck {
                import_id,
                status: "PROTECTED_STATE_DRIFT".to_string(),
                reason: format!(
                    "protected import state changed: review_status={} approved={}.",
                    review_status,
                    approved_id.is_some()
                ),
            }),
            None => checks.push(ProtectedCandidateCheck {
                import_id,
                status: "PROTECTED_STATE_DRIFT".to_string(),
                reason: "protected import row is missing.".to_string(),
            }),
        }
    }
    Ok(checks)
}

fn compute_apply_plan_fingerprint(
    database_family_hashes: &V113B1DatabaseFamilyHashes,
    candidate_results: &[CandidatePreflightResult],
    protected_checks: &[ProtectedCandidateCheck],
) -> AppResult<String> {
    canonical_sha256(&json!({
        "authoritySha256": V113B1_AUTHORITY_SHA256,
        "authorizationTrancheFingerprint": V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT,
        "candidateResults": candidate_results,
        "databaseFamilyHashes": database_family_hashes,
        "mutationSetFingerprint": V113B1_PARENT_MUTATION_SET_FINGERPRINT,
        "protectedChecks": protected_checks,
        "version": V113B1_APPLY_PLAN_FINGERPRINT_VERSION
    }))
}

fn build_preflight_manifest(
    database_file: &Path,
    database_family_hashes: V113B1DatabaseFamilyHashes,
    candidate_results: Vec<CandidatePreflightResult>,
    protected_checks: Vec<ProtectedCandidateCheck>,
) -> AppResult<PreflightManifest> {
    let ready_insert_count = candidate_results
        .iter()
        .filter(|row| row.outcome == "READY_INSERT")
        .count();
    let already_satisfied_count = candidate_results
        .iter()
        .filter(|row| row.outcome == "READY_ALREADY_SATISFIED")
        .count();
    let blocked_count = candidate_results.len() - ready_insert_count - already_satisfied_count;
    let protected_drift = protected_checks
        .iter()
        .any(|row| row.status != "PROTECTED_UNCHANGED");
    let status = if candidate_results.len() == 6 && blocked_count == 0 && !protected_drift {
        "READY"
    } else {
        "NOT_READY"
    };
    let apply_plan_fingerprint = compute_apply_plan_fingerprint(
        &database_family_hashes,
        &candidate_results,
        &protected_checks,
    )?;
    Ok(PreflightManifest {
        format_version: "1".to_string(),
        version: "V1.13B-1".to_string(),
        mode: "PREFLIGHT".to_string(),
        status: status.to_string(),
        authority_sha256: V113B1_AUTHORITY_SHA256.to_string(),
        authorization_tranche_fingerprint: V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT.to_string(),
        parent_candidate_set_fingerprint: V113B1_PARENT_CANDIDATE_SET_FINGERPRINT.to_string(),
        parent_disposition_set_fingerprint: V113B1_PARENT_DISPOSITION_SET_FINGERPRINT.to_string(),
        mutation_set_fingerprint: V113B1_PARENT_MUTATION_SET_FINGERPRINT.to_string(),
        apply_plan_fingerprint_version: V113B1_APPLY_PLAN_FINGERPRINT_VERSION.to_string(),
        apply_plan_fingerprint,
        database_file: database_file.display().to_string(),
        database_family_hashes,
        authorized_import_ids: AUTHORIZED_MUTATIONS
            .iter()
            .map(|spec| spec.import_id)
            .collect(),
        protected_import_ids: PROTECTED_IMPORT_IDS.iter().copied().collect(),
        ready_insert_count,
        already_satisfied_count,
        blocked_count,
        candidate_results,
        protected_checks,
        mutation_plan: mutation_plan_rows()?,
        created_at: Utc::now().to_rfc3339(),
        database_writes: 0,
        corporate_action_writes: 0,
        quick_resolves: 0,
        approvals: 0,
    })
}

fn run_integrity_checks(connection: &Connection) -> AppResult<()> {
    let quick_check: String = connection
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if quick_check != "ok" {
        return Err(format!("PRAGMA quick_check failed: {quick_check}"));
    }
    let mut fk_statement = connection
        .prepare("PRAGMA foreign_key_check")
        .map_err(|error| error.to_string())?;
    let mut fk_rows = fk_statement.query([]).map_err(|error| error.to_string())?;
    if fk_rows.next().map_err(|error| error.to_string())?.is_some() {
        return Err("PRAGMA foreign_key_check reported at least one violation.".to_string());
    }
    Ok(())
}

fn preflight_internal(
    connection: &Connection,
    database_file: &Path,
    database_family_hashes: V113B1DatabaseFamilyHashes,
) -> AppResult<PreflightManifest> {
    run_integrity_checks(connection)?;
    let candidate_results = analyze_all_authorized(connection)?;
    let protected_checks = check_protected_candidates(connection)?;
    build_preflight_manifest(
        database_file,
        database_family_hashes,
        candidate_results,
        protected_checks,
    )
}

fn validate_preflight_manifest(manifest: &PreflightManifest) -> AppResult<()> {
    let expected_authorized = AUTHORIZED_MUTATIONS
        .iter()
        .map(|spec| spec.import_id)
        .collect::<Vec<_>>();
    if manifest.format_version != "1"
        || manifest.version != "V1.13B-1"
        || manifest.mode != "PREFLIGHT"
        || manifest.status != "READY"
        || manifest.authority_sha256 != V113B1_AUTHORITY_SHA256
        || manifest.authorization_tranche_fingerprint != V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT
        || manifest.parent_candidate_set_fingerprint != V113B1_PARENT_CANDIDATE_SET_FINGERPRINT
        || manifest.parent_disposition_set_fingerprint != V113B1_PARENT_DISPOSITION_SET_FINGERPRINT
        || manifest.mutation_set_fingerprint != V113B1_PARENT_MUTATION_SET_FINGERPRINT
        || manifest.apply_plan_fingerprint_version != V113B1_APPLY_PLAN_FINGERPRINT_VERSION
        || manifest.authorized_import_ids != expected_authorized
        || manifest.protected_import_ids.as_slice() != &PROTECTED_IMPORT_IDS[..]
        || manifest.candidate_results.len() != 6
        || manifest.protected_checks.len() != 8
        || manifest.blocked_count != 0
        || manifest.ready_insert_count + manifest.already_satisfied_count != 6
        || manifest.database_writes != 0
        || manifest.corporate_action_writes != 0
        || manifest.quick_resolves != 0
        || manifest.approvals != 0
    {
        return Err("V1.13B-1 Apply requires an exact READY Preflight manifest.".to_string());
    }
    if compute_apply_plan_fingerprint(
        &manifest.database_family_hashes,
        &manifest.candidate_results,
        &manifest.protected_checks,
    )? != manifest.apply_plan_fingerprint
    {
        return Err("V1.13B-1 Preflight apply-plan fingerprint mismatch.".to_string());
    }
    Ok(())
}

fn apply_internal(
    connection: &mut Connection,
    manifest: &PreflightManifest,
) -> AppResult<ApplyResult> {
    validate_preflight_manifest(manifest)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;

    let current_results = analyze_all_authorized(&transaction)?;
    let current_protected = check_protected_candidates(&transaction)?;
    if current_results != manifest.candidate_results
        || current_protected != manifest.protected_checks
    {
        return Err(
            "V1.13B-1 state changed after Preflight; transaction aborted before mutation."
                .to_string(),
        );
    }
    if compute_apply_plan_fingerprint(
        &manifest.database_family_hashes,
        &current_results,
        &current_protected,
    )? != manifest.apply_plan_fingerprint
    {
        return Err("V1.13B-1 in-transaction apply-plan fingerprint drift.".to_string());
    }

    let mut mutation_results = Vec::new();
    let mut inserted = 0usize;
    let mut already = 0usize;
    for spec in mutation_specs_in_plan_order()? {
        let expected = manifest
            .candidate_results
            .iter()
            .find(|row| row.import_id == spec.import_id)
            .ok_or_else(|| format!("Preflight candidate {} disappeared.", spec.import_id))?;
        let outcome = insert_historical_isin_evidence_v113b1_strict_no_promotion(
            &transaction,
            spec.exchange,
            spec.symbol,
            spec.historical_isin,
            spec.ex_date,
            V113B1_SOURCE,
            Some(spec.source_ref),
            spec.note,
        )?;
        let (history_row_id, outcome_label) = match (expected.outcome.as_str(), outcome) {
            ("READY_INSERT", V113B1StrictHistoricalIsinInsertOutcome::Inserted(id)) => {
                inserted += 1;
                (id, "INSERTED")
            }
            (
                "READY_ALREADY_SATISFIED",
                V113B1StrictHistoricalIsinInsertOutcome::MatchingAuthorizedRow(id),
            ) => {
                already += 1;
                (id, "ALREADY_SATISFIED")
            }
            (_, V113B1StrictHistoricalIsinInsertOutcome::ExistingExternalMatch(id)) => {
                return Err(format!(
                    "V1.13B-1 HISTORY_CONFLICT: import {} has unbound matching history row {}.",
                    spec.import_id, id
                ));
            }
            (
                _,
                V113B1StrictHistoricalIsinInsertOutcome::Conflict {
                    existing_id,
                    existing_isin,
                },
            ) => {
                return Err(format!(
                    "V1.13B-1 HISTORY_CONFLICT: import {} conflicts with history row {} ISIN {}.",
                    spec.import_id, existing_id, existing_isin
                ));
            }
            (expected_outcome, actual_outcome) => {
                return Err(format!(
                    "V1.13B-1 mutation outcome drift for import {}. expected={} actual={:?}",
                    spec.import_id, expected_outcome, actual_outcome
                ));
            }
        };
        mutation_results.push(ApplyMutationResult {
            import_id: spec.import_id,
            symbol: spec.symbol.to_string(),
            history_row_id,
            outcome: outcome_label.to_string(),
        });
    }

    for spec in &AUTHORIZED_MUTATIONS {
        let state = transaction
            .query_row(
                "
                  SELECT review_status, approved_corporate_action_id
                  FROM corporate_action_imports WHERE id=?
                ",
                params![spec.import_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .map_err(|error| error.to_string())?;
        if state.0 != "UNRESOLVED" || state.1.is_some() {
            return Err(format!(
                "V1.13B-1 forbidden Corporate Action state mutation detected for import {}.",
                spec.import_id
            ));
        }
    }
    let protected_after = check_protected_candidates(&transaction)?;
    if protected_after != manifest.protected_checks {
        return Err("V1.13B-1 protected-candidate state changed inside transaction.".to_string());
    }

    transaction.commit().map_err(|error| error.to_string())?;
    Ok(ApplyResult {
        version: "V1.13B-1".to_string(),
        mode: "APPLY".to_string(),
        result: "COMMITTED_PENDING_POST_AUDIT".to_string(),
        transaction_committed: true,
        authority_sha256: V113B1_AUTHORITY_SHA256.to_string(),
        authorization_tranche_fingerprint: V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT.to_string(),
        mutation_set_fingerprint: V113B1_PARENT_MUTATION_SET_FINGERPRINT.to_string(),
        apply_plan_fingerprint: manifest.apply_plan_fingerprint.clone(),
        history_rows_inserted: inserted,
        history_rows_already_satisfied: already,
        candidate_count: 6,
        protected_count: 8,
        database_writes: inserted,
        corporate_action_writes: 0,
        quick_resolves: 0,
        approvals: 0,
        mutation_results,
    })
}

fn write_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

fn write_preflight_outputs(output: &Path, manifest: &PreflightManifest) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    write_json(&output.join("v1-13b-1-ready-manifest.json"), manifest)?;
    write_json(
        &output.join("v1-13b-1-preflight-summary.json"),
        &json!({
            "version": "V1.13B-1",
            "mode": "PREFLIGHT",
            "status": manifest.status,
            "authorizedCandidateCount": 6,
            "protectedCandidateCount": 8,
            "readyInsertCount": manifest.ready_insert_count,
            "alreadySatisfiedCount": manifest.already_satisfied_count,
            "blockedCount": manifest.blocked_count,
            "mutationSetFingerprint": manifest.mutation_set_fingerprint,
            "authorizationTrancheFingerprint": manifest.authorization_tranche_fingerprint,
            "applyPlanFingerprint": manifest.apply_plan_fingerprint,
            "databaseWrites": 0,
            "corporateActionWrites": 0,
            "quickResolves": 0,
            "approvals": 0
        }),
    )?;

    let mut candidate_writer =
        csv::Writer::from_path(output.join("v1-13b-1-preflight-candidates.csv"))
            .map_err(|error| error.to_string())?;
    for row in &manifest.candidate_results {
        candidate_writer
            .serialize(row)
            .map_err(|error| error.to_string())?;
    }
    candidate_writer
        .flush()
        .map_err(|error| error.to_string())?;

    let mut mutation_writer = csv::Writer::from_path(output.join("v1-13b-1-mutation-plan.csv"))
        .map_err(|error| error.to_string())?;
    for row in &manifest.mutation_plan {
        mutation_writer
            .serialize(MutationPlanCsvRow::from(row))
            .map_err(|error| error.to_string())?;
    }
    mutation_writer.flush().map_err(|error| error.to_string())?;
    Ok(())
}

fn write_apply_outputs(
    output: &Path,
    result: &ApplyResult,
    backup: &BackupManifest,
) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    write_json(&output.join("v1-13b-1-apply-result.json"), result)?;
    write_json(&output.join("v1-13b-1-backup-manifest-used.json"), backup)?;
    Ok(())
}

fn parse_required_arg(values: &HashMap<String, String>, name: &str) -> AppResult<String> {
    values
        .get(name)
        .cloned()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Missing required V1.13B-1 maintenance argument {name}."))
}

fn parse_maintenance_args(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<MaintenanceInput>> {
    let args = args.into_iter().collect::<Vec<_>>();
    if !args
        .iter()
        .any(|arg| arg == "--maintenance-corporate-action-v113b1")
    {
        return Ok(None);
    }
    let mut values = HashMap::<String, String>::new();
    let mut index = 0usize;
    while index < args.len() {
        let key = args[index].as_str();
        if matches!(
            key,
            "--mode"
                | "--database-file"
                | "--authority"
                | "--authority-sha256"
                | "--output"
                | "--live-main-sha256"
                | "--live-wal-sha256"
                | "--live-shm-sha256"
                | "--preflight-manifest"
                | "--backup-manifest"
        ) {
            let value = args
                .get(index + 1)
                .ok_or_else(|| format!("Missing value for {key}."))?;
            values.insert(key.to_string(), value.clone());
            index += 2;
        } else {
            index += 1;
        }
    }

    let mode = match parse_required_arg(&values, "--mode")?
        .to_lowercase()
        .as_str()
    {
        "preflight" => MaintenanceMode::Preflight,
        "apply" => MaintenanceMode::Apply,
        other => return Err(format!("Invalid V1.13B-1 maintenance mode: {other}")),
    };
    let authority_sha256 = parse_required_arg(&values, "--authority-sha256")?.to_lowercase();
    let main_sha256 = parse_required_arg(&values, "--live-main-sha256")?.to_lowercase();
    let wal_sha256 = values
        .get("--live-wal-sha256")
        .cloned()
        .unwrap_or_default()
        .to_lowercase();
    let shm_sha256 = values
        .get("--live-shm-sha256")
        .cloned()
        .unwrap_or_default()
        .to_lowercase();
    if !is_sha256_hex(&authority_sha256)
        || !is_sha256_hex(&main_sha256)
        || (!wal_sha256.is_empty() && !is_sha256_hex(&wal_sha256))
        || (!shm_sha256.is_empty() && !is_sha256_hex(&shm_sha256))
    {
        return Err(
            "V1.13B-1 SHA-256 arguments must be 64 hex characters when present.".to_string(),
        );
    }
    if authority_sha256 != V113B1_AUTHORITY_SHA256 {
        return Err("V1.13B-1 authority SHA-256 is not the approved design authority.".to_string());
    }

    let preflight_manifest_path = values.get("--preflight-manifest").map(PathBuf::from);
    let backup_manifest_path = values.get("--backup-manifest").map(PathBuf::from);
    if matches!(mode, MaintenanceMode::Apply)
        && (preflight_manifest_path.is_none() || backup_manifest_path.is_none())
    {
        return Err(
            "V1.13B-1 Apply requires --preflight-manifest and --backup-manifest.".to_string(),
        );
    }

    Ok(Some(MaintenanceInput {
        mode,
        database_file: PathBuf::from(parse_required_arg(&values, "--database-file")?),
        authority_path: PathBuf::from(parse_required_arg(&values, "--authority")?),
        authority_sha256,
        output_path: PathBuf::from(parse_required_arg(&values, "--output")?),
        live_database_family_hashes: V113B1DatabaseFamilyHashes {
            main_sha256,
            wal_sha256,
            shm_sha256,
        },
        preflight_manifest_path,
        backup_manifest_path,
    }))
}

fn run_maintenance(input: MaintenanceInput) -> AppResult<i32> {
    load_and_verify_authority(&input.authority_path, &input.authority_sha256)?;
    require_database_family_matches(&input.database_file, &input.live_database_family_hashes)?;
    fs::create_dir_all(&input.output_path).map_err(|error| error.to_string())?;

    match input.mode {
        MaintenanceMode::Preflight => {
            let connection = Connection::open_with_flags(
                &input.database_file,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(|error| error.to_string())?;
            connection
                .execute_batch("PRAGMA query_only=ON;")
                .map_err(|error| error.to_string())?;
            let manifest = preflight_internal(
                &connection,
                &input.database_file,
                input.live_database_family_hashes.clone(),
            )?;
            write_preflight_outputs(&input.output_path, &manifest)?;
            println!("[PASS] V1.13B-1 Preflight authorized candidates: 6");
            println!("[PASS] Protected candidates: 8");
            println!("[PASS] READY_INSERT: {}", manifest.ready_insert_count);
            println!(
                "[PASS] READY_ALREADY_SATISFIED: {}",
                manifest.already_satisfied_count
            );
            println!("[PASS] Blocking: {}", manifest.blocked_count);
            println!("[PASS] Preflight status: {}", manifest.status);
            Ok(if manifest.status == "READY" { 0 } else { 3 })
        }
        MaintenanceMode::Apply => {
            let preflight_path = input
                .preflight_manifest_path
                .as_deref()
                .ok_or_else(|| "V1.13B-1 Apply requires Preflight manifest.".to_string())?;
            let manifest: PreflightManifest = serde_json::from_slice(
                &fs::read(preflight_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("Invalid V1.13B-1 Preflight manifest: {error}"))?;
            validate_preflight_manifest(&manifest)?;
            if manifest.database_family_hashes != input.live_database_family_hashes {
                return Err(
                    "V1.13B-1 live database-family hashes differ from Preflight manifest."
                        .to_string(),
                );
            }

            let backup_path = input
                .backup_manifest_path
                .as_deref()
                .ok_or_else(|| "V1.13B-1 Apply requires backup manifest.".to_string())?;
            let backup: BackupManifest =
                serde_json::from_slice(&fs::read(backup_path).map_err(|error| error.to_string())?)
                    .map_err(|error| format!("Invalid V1.13B-1 backup manifest: {error}"))?;
            if !backup.verified || backup.source_database_family != manifest.database_family_hashes
            {
                return Err(
                    "V1.13B-1 verified backup does not match the Preflight database family."
                        .to_string(),
                );
            }
            if backup.backup_directory.trim().is_empty() || backup.created_at.trim().is_empty() {
                return Err("V1.13B-1 backup manifest is incomplete.".to_string());
            }

            require_database_family_matches(
                &input.database_file,
                &manifest.database_family_hashes,
            )?;
            let mut connection =
                Connection::open(&input.database_file).map_err(|error| error.to_string())?;
            let result = apply_internal(&mut connection, &manifest)?;
            drop(connection);

            if let Err(error) = write_apply_outputs(&input.output_path, &result, &backup) {
                eprintln!("COMMITTED_REPORT_FAILURE");
                eprintln!("V1.13B-1 transaction committed; report writing failed. Do not restore automatically.");
                eprintln!("Report error: {error}");
                return Ok(V113B1_COMMITTED_REPORT_FAILURE_EXIT);
            }

            println!("[PASS] V1.13B-1 transaction committed.");
            println!("[PASS] Result: COMMITTED_PENDING_POST_AUDIT");
            println!(
                "[PASS] History rows inserted: {}",
                result.history_rows_inserted
            );
            println!(
                "[PASS] History rows already satisfied: {}",
                result.history_rows_already_satisfied
            );
            println!("[PASS] Corporate Action writes: 0");
            println!("[PASS] Quick Resolves: 0");
            println!("[PASS] Approvals: 0");
            Ok(0)
        }
    }
}

pub(crate) fn try_run_controlled_identity_repair_maintenance(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<i32>> {
    let Some(input) = parse_maintenance_args(args)? else {
        return Ok(None);
    };
    run_maintenance(input).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;
    use tempfile::tempdir;

    fn insert_authorized_fixture(connection: &Connection, spec: &AuthorizedMutationSpec) {
        connection
            .execute(
                "INSERT INTO instruments (symbol,exchange,isin,name,is_active,lifecycle_status)
             VALUES (?,?,?,?,1,'CURRENT')",
                params![
                    spec.destination_symbol,
                    spec.exchange,
                    spec.destination_isin,
                    spec.destination_company
                ],
            )
            .unwrap();
        connection.execute(
            "INSERT INTO corporate_action_imports
             (id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'PARSED','UNRESOLVED')",
            params![
                spec.import_id,
                format!("v113b1-{}", spec.import_id),
                spec.exchange,
                "NSE_API",
                spec.symbol,
                spec.historical_isin,
                spec.company_name,
                "fixture",
                spec.ex_date,
                spec.action_type
            ],
        ).unwrap();
    }

    fn insert_protected_fixtures(connection: &Connection) {
        for import_id in PROTECTED_IMPORT_IDS.iter().copied() {
            connection.execute(
                "INSERT INTO corporate_action_imports
                 (id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,'PARSED','UNRESOLVED')",
                params![
                    import_id,
                    format!("protected-{}", import_id),
                    "NSE",
                    "NSE_API",
                    format!("P{}", import_id),
                    format!("INE{:09}", import_id),
                    "Protected",
                    "fixture",
                    "2020-01-01",
                    "SPLIT"
                ],
            ).unwrap();
        }
    }

    fn fixture_database() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        for spec in &AUTHORIZED_MUTATIONS {
            insert_authorized_fixture(&connection, spec);
        }
        insert_protected_fixtures(&connection);
        connection
    }

    fn dummy_hashes() -> V113B1DatabaseFamilyHashes {
        V113B1DatabaseFamilyHashes {
            main_sha256: "a".repeat(64),
            wal_sha256: "b".repeat(64),
            shm_sha256: "c".repeat(64),
        }
    }

    #[test]
    fn v113b1_compiled_mutation_fingerprint_matches_v113a2() {
        assert_eq!(
            recompute_mutation_set_fingerprint().unwrap(),
            V113B1_PARENT_MUTATION_SET_FINGERPRINT
        );
        for spec in &AUTHORIZED_MUTATIONS {
            assert_eq!(
                canonical_sha256(&final_mutation_value(spec)).unwrap(),
                spec.mutation_fingerprint
            );
        }
    }

    #[test]
    fn v113b1_compiled_authorization_tranche_fingerprint_matches_design_lock() {
        assert_eq!(
            recompute_authorization_tranche_fingerprint().unwrap(),
            V113B1_AUTHORIZATION_TRANCHE_FINGERPRINT
        );
    }

    #[test]
    fn v113b1_preflight_exact_six_rows_are_ready_insert() {
        let connection = fixture_database();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        assert_eq!(manifest.status, "READY");
        assert_eq!(manifest.ready_insert_count, 6);
        assert_eq!(manifest.already_satisfied_count, 0);
        assert_eq!(manifest.blocked_count, 0);
        assert_eq!(
            manifest
                .protected_checks
                .iter()
                .filter(|row| row.status == "PROTECTED_UNCHANGED")
                .count(),
            8
        );
    }

    #[test]
    fn v113b1_preflight_blocks_import_state_drift() {
        let connection = fixture_database();
        connection
            .execute(
                "UPDATE corporate_action_imports SET review_status='PENDING' WHERE id=12841",
                [],
            )
            .unwrap();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        assert_eq!(manifest.status, "NOT_READY");
        assert!(manifest
            .candidate_results
            .iter()
            .any(|row| { row.import_id == 12841 && row.outcome == "BLOCKED_IMPORT_STATE_DRIFT" }));
    }

    #[test]
    fn v113b1_preflight_blocks_unbound_matching_history() {
        let connection = fixture_database();
        connection
            .execute(
                "INSERT INTO instrument_isin_history
             (exchange,symbol,isin,effective_date,source,source_ref,note)
             VALUES ('NSE','TITAN','INE280A01010','2011-06-23','OTHER','OTHER','external')",
                [],
            )
            .unwrap();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        assert_eq!(manifest.status, "NOT_READY");
        assert!(manifest.candidate_results.iter().any(|row| {
            row.import_id == 12841 && row.outcome == "BLOCKED_PREEXISTING_UNBOUND_MATCH"
        }));
    }

    #[test]
    fn v113b1_apply_inserts_exact_six_and_preserves_import_status() {
        let mut connection = fixture_database();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        let result = apply_internal(&mut connection, &manifest).unwrap();
        assert_eq!(result.result, "COMMITTED_PENDING_POST_AUDIT");
        assert_eq!(result.history_rows_inserted, 6);
        assert_eq!(result.corporate_action_writes, 0);
        let history_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM instrument_isin_history WHERE source='V1.12.1_EXTERNAL_EVIDENCE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(history_count, 6);
        let changed_imports: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM corporate_action_imports
                 WHERE id IN (12841,19888,23036,24025,24224,42274)
                   AND (review_status <> 'UNRESOLVED' OR approved_corporate_action_id IS NOT NULL)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(changed_imports, 0);
    }

    #[test]
    fn v113b1_transaction_rolls_back_all_six_on_mid_apply_failure() {
        let mut connection = fixture_database();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        connection
            .execute_batch(
                "
              CREATE TRIGGER v113b1_force_failure
              BEFORE INSERT ON instrument_isin_history
              WHEN NEW.symbol = 'GAYAPROJ'
              BEGIN
                SELECT RAISE(ABORT, 'forced V1.13B-1 rollback test');
              END;
            ",
            )
            .unwrap();

        let result = apply_internal(&mut connection, &manifest);
        assert!(result.is_err());
        let history_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM instrument_isin_history WHERE source='V1.12.1_EXTERNAL_EVIDENCE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(history_count, 0);
    }

    #[test]
    fn v113b1_maintenance_args_absent_flag_preserves_normal_startup() {
        assert!(parse_maintenance_args(vec!["app".to_string()])
            .unwrap()
            .is_none());
    }

    #[test]
    fn v113b1_maintenance_args_require_explicit_apply_manifests() {
        let args = vec![
            "app".to_string(),
            "--maintenance-corporate-action-v113b1".to_string(),
            "--mode".to_string(),
            "apply".to_string(),
            "--database-file".to_string(),
            "db".to_string(),
            "--authority".to_string(),
            "authority.json".to_string(),
            "--authority-sha256".to_string(),
            V113B1_AUTHORITY_SHA256.to_string(),
            "--output".to_string(),
            "out".to_string(),
            "--live-main-sha256".to_string(),
            "a".repeat(64),
        ];
        assert!(parse_maintenance_args(args).is_err());
    }

    #[test]
    fn v113b1_preflight_manifest_round_trip_is_stable() {
        let connection = fixture_database();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        let bytes = serde_json::to_vec_pretty(&manifest).unwrap();
        let round_trip: PreflightManifest = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            manifest.apply_plan_fingerprint,
            round_trip.apply_plan_fingerprint
        );
        validate_preflight_manifest(&round_trip).unwrap();
    }

    #[test]
    fn v113b1_write_outputs_are_filesystem_only() {
        let connection = fixture_database();
        let manifest =
            preflight_internal(&connection, Path::new("fixture.sqlite3"), dummy_hashes()).unwrap();
        let dir = tempdir().unwrap();
        write_preflight_outputs(dir.path(), &manifest).unwrap();
        assert!(dir.path().join("v1-13b-1-ready-manifest.json").is_file());
        assert!(dir.path().join("v1-13b-1-preflight-summary.json").is_file());
        assert!(dir
            .path()
            .join("v1-13b-1-preflight-candidates.csv")
            .is_file());
        assert!(dir.path().join("v1-13b-1-mutation-plan.csv").is_file());

        let ready_json = fs::read(dir.path().join("v1-13b-1-ready-manifest.json")).unwrap();
        let ready_value: serde_json::Value = serde_json::from_slice(&ready_json).unwrap();
        assert!(ready_value["mutationPlan"][0]["authorizedImportIds"].is_array());
        assert!(ready_value["mutationPlan"][0]["evidenceSourceIds"].is_array());

        let mut mutation_reader =
            csv::Reader::from_path(dir.path().join("v1-13b-1-mutation-plan.csv")).unwrap();
        let headers = mutation_reader.headers().unwrap().clone();
        let import_ids_index = headers
            .iter()
            .position(|value| value == "authorizedImportIds")
            .unwrap();
        let evidence_ids_index = headers
            .iter()
            .position(|value| value == "evidenceSourceIds")
            .unwrap();
        let records = mutation_reader
            .records()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(records.len(), manifest.mutation_plan.len());
        for (record, mutation) in records.iter().zip(&manifest.mutation_plan) {
            let expected_import_ids = mutation
                .authorized_import_ids
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(";");
            let expected_evidence_ids = mutation.evidence_source_ids.join(";");
            assert_eq!(
                record.get(import_ids_index),
                Some(expected_import_ids.as_str())
            );
            assert_eq!(
                record.get(evidence_ids_index),
                Some(expected_evidence_ids.as_str())
            );
        }

        assert_eq!(records[0].get(import_ids_index), Some("42274"));
        assert_eq!(records[0].get(evidence_ids_index), Some("V112-EVID-0027"));
        assert_eq!(records[5].get(import_ids_index), Some("12841"));
        assert_eq!(records[5].get(evidence_ids_index), Some("V112-EVID-0001"));
    }
}

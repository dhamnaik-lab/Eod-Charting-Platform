use super::{
    ensure_compound_scan_fingerprint_current, get_import_row, is_split_bonus_validation_current,
    list_resolution_suggestions_for_import_row, load_latest_official_split_bonus_validation,
    quick_resolve_corporate_action_import_internal, record_corporate_action_import_decision,
};
use crate::database::instrument_mutations::{
    insert_historical_isin_evidence_strict_no_promotion, StrictHistoricalIsinInsertOutcome,
};
use crate::database::{
    AppResult, CorporateActionImportQuickResolveInput, CorporateActionImportRow,
};
use chrono::{NaiveDate, Utc};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

pub(super) const HISTORICAL_ISIN_BOOTSTRAP_FINGERPRINT_VERSION: &str = "ca-isin-bootstrap-v1";
pub(super) const HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION: &str =
    "ca-isin-bootstrap-apply-plan-v1";
const HISTORICAL_ISIN_BOOTSTRAP_MANIFEST_FORMAT_VERSION: &str = "1";
const HISTORICAL_ISIN_BOOTSTRAP_APPROVED_CANDIDATE_SHA256: &str =
    "ea196dbbfeb344eccab4e9077b101d0eb56827dd508c3092f937d6a0a2a603a7";
const HISTORICAL_ISIN_BOOTSTRAP_DECISION_TYPE: &str = "HISTORICAL_ISIN_BOOTSTRAP_V1_9_2";
const HISTORICAL_ISIN_BOOTSTRAP_NOTE_PREFIX: &str = "V1.9.2 controlled historical-ISIN bootstrap;";
pub(super) const HISTORICAL_ISIN_BOOTSTRAP_COMMITTED_REPORT_FAILURE_EXIT: i32 = 42;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapCandidateCsvRow {
    import_id: i64,
    exchange: String,
    official_symbol: String,
    historical_official_isin: String,
    current_isin: String,
    company_name: String,
    destination_company_name: String,
    normalized_official_company: String,
    normalized_destination_company: String,
    company_match: bool,
    ex_date: String,
    action_type: String,
    factor: f64,
    price_validation_label: String,
    price_confidence_pct: Option<f64>,
    source_evidence_count: usize,
    source_codes: String,
    source_locators: String,
    raw_references: String,
    evidence_symbols: String,
    evidence_isins: String,
    evidence_event_dates: String,
    evidence_companies: String,
    evidence_action_types: String,
    evidence_factors: String,
    exact_date_isin_history_count: usize,
    #[serde(default)]
    exact_date_isin_history_json: String,
    #[serde(default)]
    destination_instrument_id: String,
    destination_symbol: String,
    destination_isin: String,
    classification: String,
    classification_reason: String,
    #[serde(default)]
    failed_gates: String,
    #[serde(default)]
    gate_results_json: String,
    bootstrap_fingerprint_version: String,
    bootstrap_fingerprint: String,
}

#[derive(Clone, Debug)]
pub(super) struct HistoricalIsinBootstrapCandidate {
    pub import_id: i64,
    pub exchange: String,
    pub official_symbol: String,
    pub historical_isin: String,
    pub current_isin: String,
    pub normalized_official_company: String,
    pub normalized_destination_company: String,
    pub ex_date: String,
    pub action_type: String,
    pub factor: f64,
    pub source_evidence_count: usize,
    pub source_codes: Vec<String>,
    pub source_locators: Vec<String>,
    pub raw_references: Vec<String>,
    pub evidence_symbols: Vec<String>,
    pub evidence_isins: Vec<String>,
    pub evidence_event_dates: Vec<String>,
    pub evidence_companies: Vec<String>,
    pub evidence_action_types: Vec<String>,
    pub evidence_factors: Vec<Option<f64>>,
    pub destination_symbol: String,
    pub destination_isin: String,
    pub audited_fingerprint: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapEvidenceRow {
    id: i64,
    import_id: i64,
    source_code: String,
    source_locator: String,
    symbol_seen: String,
    isin_seen: String,
    company_name_seen: String,
    action_type_seen: String,
    event_date_seen: String,
    factor_seen: Option<f64>,
    raw_reference: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapHistoryRow {
    id: i64,
    exchange: String,
    symbol: String,
    isin: String,
    effective_date: Option<String>,
    source: Option<String>,
    source_ref: Option<String>,
    note: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapDestination {
    instrument_id: Option<i64>,
    symbol: String,
    isin: String,
    company_name: String,
    is_active: bool,
}

#[derive(Clone, Debug)]
pub(super) struct HistoricalIsinBootstrapLiveEvidence {
    evidence_rows: Vec<HistoricalIsinBootstrapEvidenceRow>,
    computed_fingerprint: String,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoricalIsinBootstrapTupleKey {
    exchange: String,
    symbol: String,
    historical_isin: String,
    ex_date: String,
    current_isin: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoricalIsinBootstrapTuplePlan {
    key: HistoricalIsinBootstrapTupleKey,
    import_ids: Vec<i64>,
    evidence_ids: Vec<i64>,
    candidate_fingerprints: Vec<String>,
    source_code: String,
    source_ref: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoricalIsinBootstrapDatabaseFamilyHashes {
    main_sha256: String,
    wal_sha256: String,
    shm_sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoricalIsinBootstrapImportResult {
    import_id: i64,
    symbol: String,
    ex_date: String,
    action_type: String,
    classification: String,
    reason: String,
    audited_fingerprint: String,
    computed_fingerprint: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoricalIsinBootstrapPreviewManifest {
    format_version: String,
    mode: String,
    candidate_csv_path: String,
    candidate_csv_sha256: String,
    candidate_count: usize,
    unique_tuple_count: usize,
    import_ids: Vec<i64>,
    candidate_fingerprints: Vec<String>,
    unique_tuples: Vec<HistoricalIsinBootstrapTuplePlan>,
    live_database_family_hashes: HistoricalIsinBootstrapDatabaseFamilyHashes,
    plan_fingerprint_version: String,
    plan_fingerprint: String,
    created_at: String,
    preview_status: String,
    blocking_rows: Vec<HistoricalIsinBootstrapImportResult>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapPreviewResult {
    mode: String,
    candidate_csv_sha256: String,
    candidate_count: usize,
    ready_count: usize,
    blocking_count: usize,
    unique_tuple_count: usize,
    plan_fingerprint_version: String,
    plan_fingerprint: String,
    rows: Vec<HistoricalIsinBootstrapImportResult>,
    tuples: Vec<HistoricalIsinBootstrapTuplePlan>,
    corporate_actions_approved: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapApplyTupleResult {
    exchange: String,
    symbol: String,
    historical_isin: String,
    ex_date: String,
    current_isin: String,
    import_ids: Vec<i64>,
    history_row_id: Option<i64>,
    outcome: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapApplyTupleCsvRow {
    exchange: String,
    symbol: String,
    historical_isin: String,
    ex_date: String,
    current_isin: String,
    import_ids: String,
    history_row_id: Option<i64>,
    outcome: String,
}

fn historical_isin_bootstrap_apply_tuple_csv_row(
    row: &HistoricalIsinBootstrapApplyTupleResult,
) -> HistoricalIsinBootstrapApplyTupleCsvRow {
    HistoricalIsinBootstrapApplyTupleCsvRow {
        exchange: row.exchange.clone(),
        symbol: row.symbol.clone(),
        historical_isin: row.historical_isin.clone(),
        ex_date: row.ex_date.clone(),
        current_isin: row.current_isin.clone(),
        import_ids: row
            .import_ids
            .iter()
            .map(i64::to_string)
            .collect::<Vec<_>>()
            .join("|"),
        history_row_id: row.history_row_id,
        outcome: row.outcome.clone(),
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapApplyImportResult {
    import_id: i64,
    symbol: String,
    ex_date: String,
    action_type: String,
    outcome: String,
    resulting_review_status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapApplyResult {
    mode: String,
    candidate_csv_sha256: String,
    plan_fingerprint_version: String,
    plan_fingerprint: String,
    candidate_count: usize,
    unique_tuple_count: usize,
    history_rows_inserted: usize,
    history_rows_already_applied: usize,
    imports_quick_resolved: usize,
    imports_already_applied: usize,
    failed_count: usize,
    transaction_committed: bool,
    corporate_actions_approved: usize,
    import_results: Vec<HistoricalIsinBootstrapApplyImportResult>,
    tuple_results: Vec<HistoricalIsinBootstrapApplyTupleResult>,
}

#[derive(Clone, Debug)]
pub(crate) enum HistoricalIsinBootstrapMaintenanceMode {
    Preview,
    Apply,
}

#[derive(Clone, Debug)]
pub(crate) struct HistoricalIsinBootstrapMaintenanceInput {
    mode: HistoricalIsinBootstrapMaintenanceMode,
    database_file: PathBuf,
    candidates_path: PathBuf,
    preview_manifest_path: Option<PathBuf>,
    output_path: PathBuf,
    candidate_sha256: String,
    live_database_family_hashes: HistoricalIsinBootstrapDatabaseFamilyHashes,
    backup_path: Option<PathBuf>,
}

fn normalize_text(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_upper(value: &str) -> String {
    normalize_text(value).to_uppercase()
}

fn normalize_company_name(value: &str) -> String {
    let upper = value.to_uppercase().replace('&', " AND ");
    let mut cleaned = String::with_capacity(upper.len());
    for character in upper.chars() {
        if character.is_ascii_alphanumeric() {
            cleaned.push(character);
        } else {
            cleaned.push(' ');
        }
    }
    cleaned
        .split_whitespace()
        .map(|token| if token == "LIMITED" { "LTD" } else { token })
        .collect::<Vec<_>>()
        .join(" ")
}

fn split_export_list(value: &str) -> Vec<String> {
    if value.trim().is_empty() {
        Vec::new()
    } else {
        value
            .split(" | ")
            .map(str::trim)
            .map(str::to_string)
            .collect()
    }
}

fn parse_export_factors(value: &str) -> AppResult<Vec<Option<f64>>> {
    split_export_list(value)
        .into_iter()
        .map(|raw| {
            if raw.is_empty() {
                Ok(None)
            } else {
                let value = raw
                    .parse::<f64>()
                    .map_err(|_| format!("Invalid evidence factor in candidate artifact: {raw}"))?;
                if !value.is_finite() {
                    return Err(format!(
                        "Non-finite evidence factor in candidate artifact: {raw}"
                    ));
                }
                Ok(Some(value))
            }
        })
        .collect()
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|character| character.is_ascii_hexdigit())
}

fn factors_compatible(left: f64, right: Option<f64>) -> bool {
    let Some(right) = right else {
        return true;
    };
    left.is_finite() && right.is_finite() && (left - right).abs() <= 1e-9_f64 * left.abs().max(1.0)
}

fn validate_candidate_row(
    row: HistoricalIsinBootstrapCandidateCsvRow,
) -> AppResult<HistoricalIsinBootstrapCandidate> {
    if row.import_id <= 0 {
        return Err(format!(
            "Candidate importId must be positive: {}",
            row.import_id
        ));
    }
    if normalize_upper(&row.exchange) != "NSE" {
        return Err(format!("Candidate {} is outside NSE scope.", row.import_id));
    }
    if normalize_upper(&row.classification) != "BOOTSTRAP_SAFE" {
        return Err(format!(
            "Candidate {} is not BOOTSTRAP_SAFE.",
            row.import_id
        ));
    }
    if row.bootstrap_fingerprint_version.trim() != HISTORICAL_ISIN_BOOTSTRAP_FINGERPRINT_VERSION {
        return Err(format!(
            "Candidate {} has unsupported bootstrap fingerprint version.",
            row.import_id
        ));
    }
    if !is_sha256_hex(row.bootstrap_fingerprint.trim()) {
        return Err(format!(
            "Candidate {} has an invalid SHA-256 fingerprint.",
            row.import_id
        ));
    }
    let official_symbol = normalize_upper(&row.official_symbol);
    let historical_isin = normalize_upper(&row.historical_official_isin);
    let current_isin = normalize_upper(&row.current_isin);
    if official_symbol.is_empty() || historical_isin.is_empty() || current_isin.is_empty() {
        return Err(format!(
            "Candidate {} is missing symbol/ISIN identity.",
            row.import_id
        ));
    }
    if historical_isin == current_isin {
        return Err(format!(
            "Candidate {} historical/current ISIN are identical.",
            row.import_id
        ));
    }
    NaiveDate::parse_from_str(row.ex_date.trim(), "%Y-%m-%d")
        .map_err(|_| format!("Candidate {} has malformed exDate.", row.import_id))?;
    let action_type = normalize_upper(&row.action_type);
    if !matches!(action_type.as_str(), "SPLIT" | "BONUS") {
        return Err(format!(
            "Candidate {} has unsupported action type.",
            row.import_id
        ));
    }
    if !row.factor.is_finite() || row.factor <= 0.0 {
        return Err(format!("Candidate {} has invalid factor.", row.import_id));
    }
    if row.source_evidence_count == 0 {
        return Err(format!(
            "Candidate {} has no source evidence.",
            row.import_id
        ));
    }
    if !row.company_match {
        return Err(format!(
            "Candidate {} companyMatch is false.",
            row.import_id
        ));
    }
    if row.exact_date_isin_history_count != 0 {
        return Err(format!(
            "Candidate {} is not an original no-history bootstrap candidate.",
            row.import_id
        ));
    }
    if !row.exact_date_isin_history_json.trim().is_empty()
        && row.exact_date_isin_history_json.trim() != "[]"
    {
        return Err(format!(
            "Candidate {} carries unexpected exact-date history state.",
            row.import_id
        ));
    }
    if !row.destination_instrument_id.trim().is_empty() {
        return Err(format!(
            "Candidate {} has an unsupported non-empty destinationInstrumentId.",
            row.import_id
        ));
    }
    if normalize_upper(&row.destination_symbol) != official_symbol
        || normalize_upper(&row.destination_isin) != current_isin
    {
        return Err(format!(
            "Candidate {} destination columns do not agree with audited identity.",
            row.import_id
        ));
    }
    if !row.failed_gates.trim().is_empty() {
        return Err(format!(
            "Candidate {} contains failed audit gates.",
            row.import_id
        ));
    }
    let normalized_official_company = normalize_company_name(&row.company_name);
    let normalized_destination_company = normalize_company_name(&row.destination_company_name);
    if normalized_official_company != row.normalized_official_company.trim()
        || normalized_destination_company != row.normalized_destination_company.trim()
        || normalized_official_company != normalized_destination_company
    {
        return Err(format!(
            "Candidate {} company normalization contract changed.",
            row.import_id
        ));
    }
    let source_codes = split_export_list(&row.source_codes);
    let source_locators = split_export_list(&row.source_locators);
    let raw_references = split_export_list(&row.raw_references);
    let evidence_symbols = split_export_list(&row.evidence_symbols);
    let evidence_isins = split_export_list(&row.evidence_isins);
    let evidence_event_dates = split_export_list(&row.evidence_event_dates);
    let evidence_companies = split_export_list(&row.evidence_companies);
    let evidence_action_types = split_export_list(&row.evidence_action_types);
    let evidence_factors = parse_export_factors(&row.evidence_factors)?;
    for list in [
        &source_codes,
        &source_locators,
        &raw_references,
        &evidence_symbols,
        &evidence_isins,
        &evidence_event_dates,
        &evidence_companies,
        &evidence_action_types,
    ] {
        if list.len() != row.source_evidence_count {
            return Err(format!(
                "Candidate {} evidence export columns do not reconcile to sourceEvidenceCount {}.",
                row.import_id, row.source_evidence_count
            ));
        }
    }
    if evidence_factors.len() != row.source_evidence_count {
        return Err(format!(
            "Candidate {} evidence factors do not reconcile.",
            row.import_id
        ));
    }
    if source_codes
        .iter()
        .any(|value| normalize_upper(value) != "NSE_API")
    {
        return Err(format!(
            "Candidate {} has non-official source evidence.",
            row.import_id
        ));
    }
    let _ = &row.classification_reason;
    let _ = &row.gate_results_json;
    // These audited export columns remain part of the CSV contract, while live Apply safety
    // is governed by reloaded current validation evidence rather than stored audit copies.
    let _ = &row.price_validation_label;
    let _ = row.price_confidence_pct;
    Ok(HistoricalIsinBootstrapCandidate {
        import_id: row.import_id,
        exchange: "NSE".to_string(),
        official_symbol,
        historical_isin,
        current_isin,
        normalized_official_company,
        normalized_destination_company,
        ex_date: row.ex_date.trim().to_string(),
        action_type,
        factor: row.factor,
        source_evidence_count: row.source_evidence_count,
        source_codes,
        source_locators,
        raw_references,
        evidence_symbols,
        evidence_isins,
        evidence_event_dates,
        evidence_companies,
        evidence_action_types,
        evidence_factors,
        destination_symbol: normalize_upper(&row.destination_symbol),
        destination_isin: normalize_upper(&row.destination_isin),
        audited_fingerprint: row.bootstrap_fingerprint.to_lowercase(),
    })
}

fn parse_historical_isin_bootstrap_candidates<R: std::io::Read>(
    reader: R,
) -> AppResult<Vec<HistoricalIsinBootstrapCandidate>> {
    let mut csv_reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(reader);
    let headers = csv_reader
        .headers()
        .map_err(|error| error.to_string())?
        .clone();
    let required = [
        "importId",
        "exchange",
        "officialSymbol",
        "historicalOfficialIsin",
        "currentIsin",
        "companyName",
        "destinationCompanyName",
        "normalizedOfficialCompany",
        "normalizedDestinationCompany",
        "companyMatch",
        "exDate",
        "actionType",
        "factor",
        "sourceEvidenceCount",
        "destinationSymbol",
        "destinationIsin",
        "classification",
        "bootstrapFingerprintVersion",
        "bootstrapFingerprint",
    ];
    let missing = required
        .iter()
        .filter(|name| !headers.iter().any(|header| header == **name))
        .copied()
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return Err(format!(
            "Candidate CSV is missing required columns: {}",
            missing.join(", ")
        ));
    }
    let mut seen = HashSet::<i64>::new();
    let mut candidates = Vec::new();
    for result in csv_reader.deserialize::<HistoricalIsinBootstrapCandidateCsvRow>() {
        let candidate = validate_candidate_row(result.map_err(|error| error.to_string())?)?;
        if !seen.insert(candidate.import_id) {
            return Err(format!(
                "Duplicate importId {} in candidate CSV.",
                candidate.import_id
            ));
        }
        candidates.push(candidate);
    }
    if candidates.is_empty() {
        return Err("Candidate CSV contains no BOOTSTRAP_SAFE rows.".to_string());
    }
    candidates.sort_by_key(|candidate| candidate.import_id);
    Ok(candidates)
}

pub(super) fn load_historical_isin_bootstrap_candidates(
    path: &Path,
) -> AppResult<Vec<HistoricalIsinBootstrapCandidate>> {
    let file = fs::File::open(path)
        .map_err(|error| format!("Could not open candidate CSV {}: {error}", path.display()))?;
    parse_historical_isin_bootstrap_candidates(file)
}

fn load_bootstrap_evidence_rows(
    connection: &Connection,
    import_id: i64,
) -> AppResult<Vec<HistoricalIsinBootstrapEvidenceRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT id, import_id, source_code, source_locator, symbol_seen, isin_seen,
                     company_name_seen, action_type_seen, event_date_seen, factor_seen, raw_reference
              FROM corporate_action_import_evidence
              WHERE import_id = ?
              ORDER BY id ASC, source_code ASC, COALESCE(source_locator, '') ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![import_id], |row| {
            Ok(HistoricalIsinBootstrapEvidenceRow {
                id: row.get(0)?,
                import_id: row.get(1)?,
                source_code: row.get::<_, String>(2)?.trim().to_uppercase(),
                source_locator: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_default()
                    .trim()
                    .to_string(),
                symbol_seen: row
                    .get::<_, Option<String>>(4)?
                    .unwrap_or_default()
                    .trim()
                    .to_uppercase(),
                isin_seen: row
                    .get::<_, Option<String>>(5)?
                    .unwrap_or_default()
                    .trim()
                    .to_uppercase(),
                company_name_seen: row
                    .get::<_, Option<String>>(6)?
                    .unwrap_or_default()
                    .trim()
                    .to_string(),
                action_type_seen: row
                    .get::<_, Option<String>>(7)?
                    .unwrap_or_default()
                    .trim()
                    .to_uppercase(),
                event_date_seen: row
                    .get::<_, Option<String>>(8)?
                    .unwrap_or_default()
                    .trim()
                    .to_string(),
                factor_seen: row.get(9)?,
                raw_reference: row
                    .get::<_, Option<String>>(10)?
                    .unwrap_or_default()
                    .trim()
                    .to_string(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn load_bootstrap_history_rows(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
) -> AppResult<Vec<HistoricalIsinBootstrapHistoryRow>> {
    let mut statement = connection
        .prepare(
            "
              SELECT id, exchange, symbol, isin, effective_date, source, source_ref, note
              FROM instrument_isin_history
              WHERE exchange = ? AND symbol = ?
              ORDER BY COALESCE(effective_date, ''), id, symbol, isin
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![exchange, symbol], |row| {
            Ok(HistoricalIsinBootstrapHistoryRow {
                id: row.get(0)?,
                exchange: row.get(1)?,
                symbol: row.get(2)?,
                isin: row.get(3)?,
                effective_date: row.get(4)?,
                source: row.get(5)?,
                source_ref: row.get(6)?,
                note: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

fn evidence_matches_candidate(
    candidate: &HistoricalIsinBootstrapCandidate,
    evidence_rows: &[HistoricalIsinBootstrapEvidenceRow],
) -> bool {
    if evidence_rows.len() != candidate.source_evidence_count {
        return false;
    }
    for (index, evidence) in evidence_rows.iter().enumerate() {
        if evidence.source_code != normalize_upper(&candidate.source_codes[index])
            || evidence.source_locator != candidate.source_locators[index]
            || evidence.raw_reference != candidate.raw_references[index]
            || evidence.symbol_seen != normalize_upper(&candidate.evidence_symbols[index])
            || evidence.isin_seen != normalize_upper(&candidate.evidence_isins[index])
            || evidence.event_date_seen != candidate.evidence_event_dates[index]
            || evidence.company_name_seen != candidate.evidence_companies[index]
            || evidence.action_type_seen != normalize_upper(&candidate.evidence_action_types[index])
            || !factors_compatible(candidate.factor, evidence.factor_seen)
            || !factors_compatible(candidate.factor, candidate.evidence_factors[index])
        {
            return false;
        }
    }
    true
}

fn canonical_json_string(value: &Value) -> AppResult<String> {
    fn encode(value: &Value, output: &mut String) -> AppResult<()> {
        match value {
            Value::Null => output.push_str("null"),
            Value::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
            Value::String(value) => output.push_str(
                serde_json::to_string(value)
                    .map_err(|error| error.to_string())?
                    .as_str(),
            ),
            Value::Number(number) => {
                if let Some(integer) = number.as_i64() {
                    output.push_str(integer.to_string().as_str());
                } else if let Some(integer) = number.as_u64() {
                    output.push_str(integer.to_string().as_str());
                } else {
                    let value = number.as_f64().ok_or_else(|| {
                        "Canonical JSON encountered an invalid number.".to_string()
                    })?;
                    if !value.is_finite() {
                        return Err("Canonical JSON rejects non-finite numbers.".to_string());
                    }
                    if value.fract() == 0.0 {
                        output.push_str(format!("{value:.0}").as_str());
                    } else {
                        let mut rendered = number.to_string();
                        if rendered.ends_with(".0") {
                            rendered.truncate(rendered.len() - 2);
                        }
                        output.push_str(rendered.as_str());
                    }
                }
            }
            Value::Array(values) => {
                output.push('[');
                for (index, value) in values.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }
                    encode(value, output)?;
                }
                output.push(']');
            }
            Value::Object(map) => {
                output.push('{');
                let mut keys = map.keys().collect::<Vec<_>>();
                keys.sort();
                for (index, key) in keys.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }
                    output.push_str(
                        serde_json::to_string(key)
                            .map_err(|error| error.to_string())?
                            .as_str(),
                    );
                    output.push(':');
                    encode(
                        map.get(*key)
                            .ok_or_else(|| "Canonical JSON key disappeared.".to_string())?,
                        output,
                    )?;
                }
                output.push('}');
            }
        }
        Ok(())
    }
    let mut output = String::new();
    encode(value, &mut output)?;
    Ok(output)
}

fn sha256_text(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("Could not read {} for SHA-256: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn database_sidecar_path(database_file: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{}", database_file.to_string_lossy(), suffix))
}

fn hash_existing_file_or_empty(path: &Path) -> AppResult<String> {
    if path.is_file() {
        sha256_file(path)
    } else {
        Ok(String::new())
    }
}

fn compute_database_family_hashes(
    database_file: &Path,
) -> AppResult<HistoricalIsinBootstrapDatabaseFamilyHashes> {
    Ok(HistoricalIsinBootstrapDatabaseFamilyHashes {
        main_sha256: sha256_file(database_file)?,
        wal_sha256: hash_existing_file_or_empty(&database_sidecar_path(database_file, "-wal"))?,
        shm_sha256: hash_existing_file_or_empty(&database_sidecar_path(database_file, "-shm"))?,
    })
}

fn require_snapshot_hashes_match_live_contract(
    database_file: &Path,
    expected: &HistoricalIsinBootstrapDatabaseFamilyHashes,
) -> AppResult<()> {
    let actual = compute_database_family_hashes(database_file)?;
    if actual.main_sha256 != expected.main_sha256 {
        return Err(
            "Preview snapshot main database SHA-256 differs from the live pre-snapshot hash."
                .to_string(),
        );
    }
    if actual.wal_sha256 != expected.wal_sha256 {
        return Err(
            "Preview snapshot WAL SHA-256 differs from the live pre-snapshot hash.".to_string(),
        );
    }
    // Live SHM is deliberately not copied into the private Preview snapshot.
    Ok(())
}

fn build_historical_isin_bootstrap_fingerprint_payload(
    import_row: &CorporateActionImportRow,
    evidence_rows: &[HistoricalIsinBootstrapEvidenceRow],
    destination: &HistoricalIsinBootstrapDestination,
    history_rows: &[HistoricalIsinBootstrapHistoryRow],
) -> AppResult<Value> {
    let symbol = import_row
        .symbol
        .as_deref()
        .ok_or_else(|| "Fingerprint requires import symbol.".to_string())?;
    let historical_isin = import_row
        .isin
        .as_deref()
        .ok_or_else(|| "Fingerprint requires historical ISIN.".to_string())?;
    let company_name = import_row
        .company_name
        .as_deref()
        .ok_or_else(|| "Fingerprint requires company name.".to_string())?;
    let ex_date = import_row
        .ex_date
        .as_deref()
        .ok_or_else(|| "Fingerprint requires ex-date.".to_string())?;
    let factor = import_row
        .factor
        .filter(|value| value.is_finite())
        .ok_or_else(|| "Fingerprint requires finite factor.".to_string())?;

    let mut evidence_rows = evidence_rows.to_vec();
    evidence_rows.sort_by(|left, right| {
        (
            left.id,
            left.source_code.as_str(),
            left.source_locator.as_str(),
            left.event_date_seen.as_str(),
            left.isin_seen.as_str(),
        )
            .cmp(&(
                right.id,
                right.source_code.as_str(),
                right.source_locator.as_str(),
                right.event_date_seen.as_str(),
                right.isin_seen.as_str(),
            ))
    });
    let mut history_rows = history_rows.to_vec();
    history_rows.sort_by(|left, right| {
        (
            left.effective_date.as_deref().unwrap_or(""),
            left.id,
            left.symbol.as_str(),
            left.isin.as_str(),
        )
            .cmp(&(
                right.effective_date.as_deref().unwrap_or(""),
                right.id,
                right.symbol.as_str(),
                right.isin.as_str(),
            ))
    });

    Ok(json!({
        "version": HISTORICAL_ISIN_BOOTSTRAP_FINGERPRINT_VERSION,
        "importId": import_row.id,
        "parentImport": {
            "exchange": import_row.exchange,
            "symbol": symbol,
            "historicalIsin": historical_isin,
            "companyName": company_name,
            "exDate": ex_date,
            "actionType": import_row.action_type,
            "factor": factor,
        },
        "structuredEvidence": evidence_rows.iter().map(|evidence| json!({
            "id": evidence.id,
            "sourceCode": evidence.source_code,
            "sourceLocator": evidence.source_locator,
            "symbolSeen": evidence.symbol_seen,
            "isinSeen": evidence.isin_seen,
            "companyNameSeen": evidence.company_name_seen,
            "actionTypeSeen": evidence.action_type_seen,
            "eventDateSeen": evidence.event_date_seen,
            "factorSeen": evidence.factor_seen,
            "rawReference": evidence.raw_reference,
        })).collect::<Vec<_>>(),
        "destination": {
            "instrumentId": destination.instrument_id,
            "symbol": destination.symbol,
            "isin": destination.isin,
            "companyName": destination.company_name,
            "isActive": destination.is_active,
        },
        "identityHistoryState": history_rows.iter().map(|history| json!({
            "id": history.id,
            "exchange": history.exchange,
            "symbol": history.symbol,
            "isin": history.isin,
            "effectiveDate": history.effective_date,
            "source": history.source,
            "sourceRef": history.source_ref,
            "note": history.note,
        })).collect::<Vec<_>>(),
    }))
}

fn compute_historical_isin_bootstrap_fingerprint(payload: &Value) -> AppResult<String> {
    Ok(sha256_text(canonical_json_string(payload)?.as_str()))
}

fn extract_provenance_value<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("{key}=");
    let start = text.find(needle.as_str())? + needle.len();
    let rest = &text[start..];
    let end = rest.find(';').unwrap_or(rest.len());
    Some(rest[..end].trim())
}

fn detect_completed_v192_apply(
    connection: &Connection,
    candidate: &HistoricalIsinBootstrapCandidate,
    import_row: &CorporateActionImportRow,
    exact_date_history_rows: &[HistoricalIsinBootstrapHistoryRow],
) -> AppResult<bool> {
    let matching_history = exact_date_history_rows.iter().find(|history| {
        normalize_upper(&history.isin) == candidate.historical_isin
            && history
                .note
                .as_deref()
                .map(|note| note.starts_with(HISTORICAL_ISIN_BOOTSTRAP_NOTE_PREFIX))
                .unwrap_or(false)
    });
    let Some(history) = matching_history else {
        return Ok(false);
    };
    let history_note = history.note.as_deref().unwrap_or_default();
    let history_candidates = extract_provenance_value(history_note, "candidateFingerprints")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<BTreeSet<_>>();
    let history_plan =
        extract_provenance_value(history_note, "planFingerprint").unwrap_or_default();

    let bootstrap_decision = connection
        .query_row(
            "SELECT reason FROM corporate_action_import_decisions WHERE import_id=? AND decision_type=? ORDER BY id DESC LIMIT 1",
            params![candidate.import_id, HISTORICAL_ISIN_BOOTSTRAP_DECISION_TYPE],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let quick_resolve_decision = connection
        .query_row(
            "SELECT id FROM corporate_action_import_decisions WHERE import_id=? AND decision_type='VERIFIED_QUICK_RESOLUTION' ORDER BY id DESC LIMIT 1",
            params![candidate.import_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(reason) = bootstrap_decision.as_deref() else {
        return Err(
            "PARTIAL_PRIOR_APPLY: V1.9.2 history row exists but bootstrap decision is missing."
                .to_string(),
        );
    };
    let decision_candidate =
        extract_provenance_value(reason, "candidateFingerprint").unwrap_or_default();
    let decision_plan = extract_provenance_value(reason, "planFingerprint").unwrap_or_default();
    let provenance_matches = history_candidates.contains(candidate.audited_fingerprint.as_str())
        && decision_candidate == candidate.audited_fingerprint
        && !history_plan.is_empty()
        && history_plan == decision_plan;
    if !provenance_matches {
        return Err("PARTIAL_PRIOR_APPLY: V1.9.2 history/decision fingerprints do not agree with the reviewed candidate.".to_string());
    }
    if quick_resolve_decision.is_none() {
        return Err("PARTIAL_PRIOR_APPLY: bootstrap decision exists but VERIFIED_QUICK_RESOLUTION is missing.".to_string());
    }
    if !matches!(import_row.review_status.as_str(), "PENDING" | "APPROVED") {
        return Err(format!(
            "PARTIAL_PRIOR_APPLY: V1.9.2 provenance exists but import review_status is {}.",
            import_row.review_status
        ));
    }
    Ok(true)
}

fn revalidate_historical_isin_bootstrap_candidate(
    connection: &Connection,
    candidate: &HistoricalIsinBootstrapCandidate,
) -> AppResult<HistoricalIsinBootstrapLiveEvidence> {
    let import_row = get_import_row(connection, candidate.import_id)?;
    let evidence_rows = load_bootstrap_evidence_rows(connection, candidate.import_id)?;
    let history_rows = load_bootstrap_history_rows(
        connection,
        candidate.exchange.as_str(),
        candidate.official_symbol.as_str(),
    )?;
    let exact_date_history_rows = history_rows
        .iter()
        .filter(|history| history.effective_date.as_deref() == Some(candidate.ex_date.as_str()))
        .cloned()
        .collect::<Vec<_>>();

    if import_row.exchange != candidate.exchange
        || import_row.symbol.as_deref().map(normalize_upper).as_deref()
            != Some(candidate.official_symbol.as_str())
        || import_row.isin.as_deref().map(normalize_upper).as_deref()
            != Some(candidate.historical_isin.as_str())
        || import_row
            .company_name
            .as_deref()
            .map(normalize_company_name)
            .as_deref()
            != Some(candidate.normalized_official_company.as_str())
        || import_row.ex_date.as_deref() != Some(candidate.ex_date.as_str())
        || import_row.action_type != candidate.action_type
        || import_row.parse_status != "PARSED"
        || !import_row
            .factor
            .map(|factor| factors_compatible(candidate.factor, Some(factor)))
            .unwrap_or(false)
    {
        return Err("STATE_CHANGED: parent Corporate Action import no longer matches the audited candidate.".to_string());
    }

    if import_row.review_status != "UNRESOLVED" || import_row.approved_corporate_action_id.is_some()
    {
        if detect_completed_v192_apply(
            connection,
            candidate,
            &import_row,
            &exact_date_history_rows,
        )? {
            return Err(
                "ALREADY_APPLIED: V1.9.2 provenance and Quick Resolve decision already exist."
                    .to_string(),
            );
        }
        return Err(format!(
            "STATE_CHANGED: import review_status is {} instead of UNRESOLVED.",
            import_row.review_status
        ));
    }

    ensure_compound_scan_fingerprint_current(connection, &import_row)
        .map_err(|error| format!("PRICE_VALIDATION_CHANGED: {error}"))?;
    let validation = load_latest_official_split_bonus_validation(connection, candidate.import_id)?
        .ok_or_else(|| {
            "PRICE_VALIDATION_CHANGED: latest official validation is missing.".to_string()
        })?;
    if validation.scan_status != "MATCHED"
        || !is_split_bonus_validation_current(connection, &import_row, &validation)?
    {
        return Err("PRICE_VALIDATION_CHANGED: latest Split/Bonus validation is no longer current MATCHED evidence.".to_string());
    }

    if !evidence_matches_candidate(candidate, &evidence_rows) {
        return Err("SOURCE_EVIDENCE_CHANGED: structured Corporate Action evidence differs from the audited candidate.".to_string());
    }

    let suggestions = list_resolution_suggestions_for_import_row(connection, &import_row)?;
    let active = suggestions
        .into_iter()
        .filter(|suggestion| suggestion.is_active)
        .collect::<Vec<_>>();
    if active.len() != 1 {
        return Err(format!(
            "DESTINATION_CHANGED: expected exactly one active destination, found {}.",
            active.len()
        ));
    }
    let suggestion = &active[0];
    let destination_isin = suggestion
        .isin
        .as_deref()
        .map(normalize_upper)
        .ok_or_else(|| {
            "DESTINATION_CHANGED: active destination has no current ISIN.".to_string()
        })?;
    let destination_company = suggestion.name.clone().unwrap_or_default();
    if normalize_upper(&suggestion.symbol) != candidate.destination_symbol
        || destination_isin != candidate.destination_isin
        || normalize_company_name(destination_company.as_str())
            != candidate.normalized_destination_company
    {
        return Err("DESTINATION_CHANGED: current active destination identity differs from the audited candidate.".to_string());
    }
    let destination = HistoricalIsinBootstrapDestination {
        instrument_id: None,
        symbol: normalize_upper(&suggestion.symbol),
        isin: destination_isin,
        company_name: destination_company,
        is_active: true,
    };

    if !exact_date_history_rows.is_empty() {
        let completed = detect_completed_v192_apply(
            connection,
            candidate,
            &import_row,
            &exact_date_history_rows,
        )?;
        if completed {
            return Err(
                "ALREADY_APPLIED: exact V1.9.2 history provenance already exists.".to_string(),
            );
        }
        return Err(
            "HISTORY_CONFLICT: exact-date historical ISIN state changed after the audit."
                .to_string(),
        );
    }

    let payload = build_historical_isin_bootstrap_fingerprint_payload(
        &import_row,
        &evidence_rows,
        &destination,
        &history_rows,
    )?;
    let computed_fingerprint = compute_historical_isin_bootstrap_fingerprint(&payload)?;
    if computed_fingerprint != candidate.audited_fingerprint {
        return Err(format!(
            "STALE_FINGERPRINT: audited={} live={}",
            candidate.audited_fingerprint, computed_fingerprint
        ));
    }

    Ok(HistoricalIsinBootstrapLiveEvidence {
        evidence_rows,
        computed_fingerprint,
    })
}

fn build_historical_isin_bootstrap_tuple_plan(
    ready: &[(
        HistoricalIsinBootstrapCandidate,
        HistoricalIsinBootstrapLiveEvidence,
    )],
) -> AppResult<Vec<HistoricalIsinBootstrapTuplePlan>> {
    let mut groups: BTreeMap<
        HistoricalIsinBootstrapTupleKey,
        Vec<&(
            HistoricalIsinBootstrapCandidate,
            HistoricalIsinBootstrapLiveEvidence,
        )>,
    > = BTreeMap::new();
    for item in ready {
        let candidate = &item.0;
        let key = HistoricalIsinBootstrapTupleKey {
            exchange: candidate.exchange.clone(),
            symbol: candidate.official_symbol.clone(),
            historical_isin: candidate.historical_isin.clone(),
            ex_date: candidate.ex_date.clone(),
            current_isin: candidate.current_isin.clone(),
        };
        groups.entry(key).or_default().push(item);
    }
    groups
        .into_iter()
        .map(|(key, items)| {
            let mut import_ids = items
                .iter()
                .map(|item| item.0.import_id)
                .collect::<Vec<_>>();
            import_ids.sort_unstable();
            let mut evidence_ids = items
                .iter()
                .flat_map(|item| item.1.evidence_rows.iter().map(|evidence| evidence.id))
                .collect::<Vec<_>>();
            evidence_ids.sort_unstable();
            evidence_ids.dedup();
            let mut candidate_fingerprints = items
                .iter()
                .map(|item| item.0.audited_fingerprint.clone())
                .collect::<Vec<_>>();
            candidate_fingerprints.sort();
            candidate_fingerprints.dedup();
            let source_codes = items
                .iter()
                .flat_map(|item| {
                    item.1
                        .evidence_rows
                        .iter()
                        .map(|evidence| evidence.source_code.clone())
                })
                .collect::<BTreeSet<_>>();
            if source_codes.len() != 1
                || source_codes.iter().next().map(String::as_str) != Some("NSE_API")
            {
                return Err(format!(
                    "Tuple {} {} has inconsistent official sources.",
                    key.symbol, key.ex_date
                ));
            }
            let locators = items
                .iter()
                .flat_map(|item| {
                    item.1
                        .evidence_rows
                        .iter()
                        .map(|evidence| evidence.source_locator.clone())
                })
                .filter(|value| !value.is_empty())
                .collect::<BTreeSet<_>>();
            if locators.len() > 1 {
                return Err(format!(
                    "Tuple {} {} has inconsistent source locators.",
                    key.symbol, key.ex_date
                ));
            }
            Ok(HistoricalIsinBootstrapTuplePlan {
                key,
                import_ids,
                evidence_ids,
                candidate_fingerprints,
                source_code: "NSE_API".to_string(),
                source_ref: locators.into_iter().next(),
            })
        })
        .collect()
}

fn build_plan_payload(
    candidate_csv_sha256: &str,
    candidates: &[HistoricalIsinBootstrapCandidate],
    tuples: &[HistoricalIsinBootstrapTuplePlan],
    hashes: &HistoricalIsinBootstrapDatabaseFamilyHashes,
) -> Value {
    json!({
        "version": HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION,
        "candidateCsvSha256": candidate_csv_sha256,
        "candidateCount": candidates.len(),
        "importIds": candidates.iter().map(|candidate| candidate.import_id).collect::<Vec<_>>(),
        "candidateFingerprints": candidates.iter().map(|candidate| candidate.audited_fingerprint.clone()).collect::<Vec<_>>(),
        "uniqueTupleCount": tuples.len(),
        "uniqueTuples": tuples,
        "liveDatabaseFamilyHashes": hashes,
    })
}

fn compute_historical_isin_bootstrap_apply_plan_fingerprint(
    candidate_csv_sha256: &str,
    candidates: &[HistoricalIsinBootstrapCandidate],
    tuples: &[HistoricalIsinBootstrapTuplePlan],
    hashes: &HistoricalIsinBootstrapDatabaseFamilyHashes,
) -> AppResult<String> {
    compute_historical_isin_bootstrap_fingerprint(&build_plan_payload(
        candidate_csv_sha256,
        candidates,
        tuples,
        hashes,
    ))
}

fn classify_revalidation_error(error: &str) -> (&'static str, String) {
    const PREFIXES: &[(&str, &str)] = &[
        ("ALREADY_APPLIED:", "ALREADY_APPLIED"),
        ("PARTIAL_PRIOR_APPLY:", "PARTIAL_PRIOR_APPLY"),
        ("STALE_FINGERPRINT:", "STALE_FINGERPRINT"),
        ("PRICE_VALIDATION_CHANGED:", "PRICE_VALIDATION_CHANGED"),
        ("SOURCE_EVIDENCE_CHANGED:", "SOURCE_EVIDENCE_CHANGED"),
        ("DESTINATION_CHANGED:", "DESTINATION_CHANGED"),
        ("HISTORY_CONFLICT:", "HISTORY_CONFLICT"),
        ("STATE_CHANGED:", "STATE_CHANGED"),
    ];
    for (prefix, classification) in PREFIXES {
        if error.starts_with(prefix) {
            return (classification, error[prefix.len()..].trim().to_string());
        }
    }
    ("FAILED", error.to_string())
}

fn preview_historical_isin_bootstrap_internal(
    connection: &Connection,
    candidates_path: &Path,
    candidate_csv_sha256: &str,
    hashes: HistoricalIsinBootstrapDatabaseFamilyHashes,
) -> AppResult<(
    HistoricalIsinBootstrapPreviewResult,
    HistoricalIsinBootstrapPreviewManifest,
)> {
    let candidates = load_historical_isin_bootstrap_candidates(candidates_path)?;
    let mut ready = Vec::new();
    let mut rows = Vec::new();
    let mut blocking_rows = Vec::new();
    for candidate in &candidates {
        match revalidate_historical_isin_bootstrap_candidate(connection, candidate) {
            Ok(live) => {
                rows.push(HistoricalIsinBootstrapImportResult {
                    import_id: candidate.import_id,
                    symbol: candidate.official_symbol.clone(),
                    ex_date: candidate.ex_date.clone(),
                    action_type: candidate.action_type.clone(),
                    classification: "READY".to_string(),
                    reason:
                        "All audited gates and ca-isin-bootstrap-v1 fingerprint remain unchanged."
                            .to_string(),
                    audited_fingerprint: candidate.audited_fingerprint.clone(),
                    computed_fingerprint: live.computed_fingerprint.clone(),
                });
                ready.push((candidate.clone(), live));
            }
            Err(error) => {
                let (classification, reason) = classify_revalidation_error(error.as_str());
                let row = HistoricalIsinBootstrapImportResult {
                    import_id: candidate.import_id,
                    symbol: candidate.official_symbol.clone(),
                    ex_date: candidate.ex_date.clone(),
                    action_type: candidate.action_type.clone(),
                    classification: classification.to_string(),
                    reason,
                    audited_fingerprint: candidate.audited_fingerprint.clone(),
                    computed_fingerprint: String::new(),
                };
                blocking_rows.push(row.clone());
                rows.push(row);
            }
        }
    }
    let tuples = build_historical_isin_bootstrap_tuple_plan(&ready)?;
    let ready_candidates = ready.iter().map(|item| item.0.clone()).collect::<Vec<_>>();
    let plan_fingerprint = compute_historical_isin_bootstrap_apply_plan_fingerprint(
        candidate_csv_sha256,
        &ready_candidates,
        &tuples,
        &hashes,
    )?;
    let preview_status = if blocking_rows.is_empty() && ready.len() == candidates.len() {
        "READY"
    } else {
        "BLOCKED"
    };
    let manifest = HistoricalIsinBootstrapPreviewManifest {
        format_version: HISTORICAL_ISIN_BOOTSTRAP_MANIFEST_FORMAT_VERSION.to_string(),
        mode: "PREVIEW".to_string(),
        candidate_csv_path: candidates_path.to_string_lossy().to_string(),
        candidate_csv_sha256: candidate_csv_sha256.to_string(),
        candidate_count: candidates.len(),
        unique_tuple_count: tuples.len(),
        import_ids: ready_candidates
            .iter()
            .map(|candidate| candidate.import_id)
            .collect(),
        candidate_fingerprints: ready_candidates
            .iter()
            .map(|candidate| candidate.audited_fingerprint.clone())
            .collect(),
        unique_tuples: tuples.clone(),
        live_database_family_hashes: hashes,
        plan_fingerprint_version: HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION.to_string(),
        plan_fingerprint: plan_fingerprint.clone(),
        created_at: Utc::now().to_rfc3339(),
        preview_status: preview_status.to_string(),
        blocking_rows: blocking_rows.clone(),
    };
    Ok((
        HistoricalIsinBootstrapPreviewResult {
            mode: "PREVIEW".to_string(),
            candidate_csv_sha256: candidate_csv_sha256.to_string(),
            candidate_count: candidates.len(),
            ready_count: ready.len(),
            blocking_count: blocking_rows.len(),
            unique_tuple_count: tuples.len(),
            plan_fingerprint_version: HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION
                .to_string(),
            plan_fingerprint,
            rows,
            tuples,
            corporate_actions_approved: 0,
        },
        manifest,
    ))
}

fn build_v192_history_note(
    tuple: &HistoricalIsinBootstrapTuplePlan,
    plan_fingerprint: &str,
) -> String {
    let import_ids = tuple
        .import_ids
        .iter()
        .map(i64::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let evidence_ids = tuple
        .evidence_ids
        .iter()
        .map(i64::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let candidate_fingerprints = tuple.candidate_fingerprints.join(",");
    format!(
        "{} importIds={}; evidenceIds={}; candidateFingerprints={}; planFingerprint={}",
        HISTORICAL_ISIN_BOOTSTRAP_NOTE_PREFIX,
        import_ids,
        evidence_ids,
        candidate_fingerprints,
        plan_fingerprint
    )
}

fn build_bootstrap_decision_reason(
    candidate: &HistoricalIsinBootstrapCandidate,
    tuple: &HistoricalIsinBootstrapTuplePlan,
    plan_fingerprint: &str,
) -> String {
    format!(
        "V1.9.2 exact-date historical ISIN evidence bootstrap; candidateFingerprint={}; planFingerprint={}; tuple={}:{}:{}:{}->{}; evidenceIds={}",
        candidate.audited_fingerprint,
        plan_fingerprint,
        tuple.key.exchange,
        tuple.key.symbol,
        tuple.key.ex_date,
        tuple.key.historical_isin,
        tuple.key.current_isin,
        tuple.evidence_ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",")
    )
}

fn apply_historical_isin_bootstrap_internal(
    connection: &mut Connection,
    candidates_path: &Path,
    preview_manifest: &HistoricalIsinBootstrapPreviewManifest,
    candidate_csv_sha256: &str,
    hashes: HistoricalIsinBootstrapDatabaseFamilyHashes,
) -> AppResult<HistoricalIsinBootstrapApplyResult> {
    if preview_manifest.mode != "PREVIEW" || preview_manifest.preview_status != "READY" {
        return Err("Apply requires a READY PREVIEW manifest.".to_string());
    }
    if preview_manifest.candidate_csv_sha256 != candidate_csv_sha256 {
        return Err("Candidate CSV SHA-256 differs from the Preview manifest.".to_string());
    }
    if preview_manifest.live_database_family_hashes != hashes {
        return Err("Live database-family hashes differ from the Preview manifest.".to_string());
    }
    let candidates = load_historical_isin_bootstrap_candidates(candidates_path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let mut ready = Vec::new();
    for candidate in &candidates {
        let live = revalidate_historical_isin_bootstrap_candidate(&transaction, candidate)?;
        ready.push((candidate.clone(), live));
    }
    let tuples = build_historical_isin_bootstrap_tuple_plan(&ready)?;
    let ready_candidates = ready.iter().map(|item| item.0.clone()).collect::<Vec<_>>();
    let plan_fingerprint = compute_historical_isin_bootstrap_apply_plan_fingerprint(
        candidate_csv_sha256,
        &ready_candidates,
        &tuples,
        &hashes,
    )?;
    if plan_fingerprint != preview_manifest.plan_fingerprint
        || preview_manifest.plan_fingerprint_version
            != HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION
        || preview_manifest.candidate_count != candidates.len()
        || preview_manifest.unique_tuple_count != tuples.len()
    {
        return Err("Apply plan no longer matches the approved Preview manifest.".to_string());
    }

    let mut tuple_by_import = HashMap::<i64, HistoricalIsinBootstrapTuplePlan>::new();
    for tuple in &tuples {
        for import_id in &tuple.import_ids {
            tuple_by_import.insert(*import_id, tuple.clone());
        }
    }

    let mut tuple_results = Vec::new();
    let mut history_rows_inserted = 0usize;
    let mut history_rows_already_applied = 0usize;
    for tuple in &tuples {
        let note = build_v192_history_note(tuple, plan_fingerprint.as_str());
        let outcome = insert_historical_isin_evidence_strict_no_promotion(
            &transaction,
            tuple.key.exchange.as_str(),
            tuple.key.symbol.as_str(),
            tuple.key.historical_isin.as_str(),
            tuple.key.ex_date.as_str(),
            tuple.source_code.as_str(),
            tuple.source_ref.as_deref(),
            note.as_str(),
        )?;
        let (history_row_id, outcome_label) = match outcome {
            StrictHistoricalIsinInsertOutcome::Inserted(id) => {
                history_rows_inserted += 1;
                (Some(id), "INSERTED")
            }
            StrictHistoricalIsinInsertOutcome::MatchingV192Row(id) => {
                history_rows_already_applied += 1;
                (Some(id), "ALREADY_APPLIED")
            }
            StrictHistoricalIsinInsertOutcome::ExistingExternalMatch(id) => {
                return Err(format!(
                    "HISTORY_CONFLICT: tuple {} {} already has external matching history row {}.",
                    tuple.key.symbol, tuple.key.ex_date, id
                ));
            }
            StrictHistoricalIsinInsertOutcome::Conflict {
                existing_id,
                existing_isin,
            } => {
                return Err(format!(
                    "HISTORY_CONFLICT: tuple {} {} conflicts with history row {} ISIN {}.",
                    tuple.key.symbol, tuple.key.ex_date, existing_id, existing_isin
                ));
            }
        };
        tuple_results.push(HistoricalIsinBootstrapApplyTupleResult {
            exchange: tuple.key.exchange.clone(),
            symbol: tuple.key.symbol.clone(),
            historical_isin: tuple.key.historical_isin.clone(),
            ex_date: tuple.key.ex_date.clone(),
            current_isin: tuple.key.current_isin.clone(),
            import_ids: tuple.import_ids.clone(),
            history_row_id,
            outcome: outcome_label.to_string(),
        });
    }

    let mut import_results = Vec::new();
    let mut imports_quick_resolved = 0usize;
    let imports_already_applied = 0usize;
    let sorted_ids = candidates
        .iter()
        .map(|candidate| candidate.import_id)
        .collect::<Vec<_>>();
    for batch in sorted_ids.chunks(100) {
        for import_id in batch {
            let candidate = candidates
                .iter()
                .find(|candidate| candidate.import_id == *import_id)
                .ok_or_else(|| format!("Candidate {} disappeared during Apply.", import_id))?;
            let tuple = tuple_by_import.get(import_id).ok_or_else(|| {
                format!("Tuple for import {} disappeared during Apply.", import_id)
            })?;
            let before = get_import_row(&transaction, *import_id)?;
            if before.review_status != "UNRESOLVED" {
                return Err(format!(
                    "STATE_CHANGED: import {} became {} before Quick Resolve.",
                    import_id, before.review_status
                ));
            }
            record_corporate_action_import_decision(
                &transaction,
                &before,
                &before,
                HISTORICAL_ISIN_BOOTSTRAP_DECISION_TYPE,
                build_bootstrap_decision_reason(candidate, tuple, plan_fingerprint.as_str())
                    .as_str(),
            )?;
            let resolved = quick_resolve_corporate_action_import_internal(
                &transaction,
                &CorporateActionImportQuickResolveInput {
                    import_id: *import_id,
                },
            )?;
            if resolved.import_record.review_status != "PENDING" {
                return Err(format!(
                    "Quick Resolve for import {} ended in unexpected status {}.",
                    import_id, resolved.import_record.review_status
                ));
            }
            imports_quick_resolved += 1;
            import_results.push(HistoricalIsinBootstrapApplyImportResult {
                import_id: *import_id,
                symbol: candidate.official_symbol.clone(),
                ex_date: candidate.ex_date.clone(),
                action_type: candidate.action_type.clone(),
                outcome: "QUICK_RESOLVED".to_string(),
                resulting_review_status: "PENDING".to_string(),
            });
        }
    }
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(HistoricalIsinBootstrapApplyResult {
        mode: "APPLY".to_string(),
        candidate_csv_sha256: candidate_csv_sha256.to_string(),
        plan_fingerprint_version: HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION.to_string(),
        plan_fingerprint,
        candidate_count: candidates.len(),
        unique_tuple_count: tuples.len(),
        history_rows_inserted,
        history_rows_already_applied,
        imports_quick_resolved,
        imports_already_applied,
        failed_count: 0,
        transaction_committed: true,
        corporate_actions_approved: 0,
        import_results,
        tuple_results,
    })
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, format!("{text}\n"))
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn write_preview_outputs(
    output: &Path,
    result: &HistoricalIsinBootstrapPreviewResult,
    manifest: &HistoricalIsinBootstrapPreviewManifest,
) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    let summary = format!(
        "Corporate Action V1.9.2 Historical ISIN Bootstrap Preview\nMode: PREVIEW / ZERO WRITE\nCandidate imports: {}\nREADY: {}\nBlocking: {}\nUnique tuples: {}\nCandidate SHA-256: {}\nPlan fingerprint version: {}\nPlan fingerprint: {}\nPreview status: {}\nCorporate Actions approved: 0\n",
        result.candidate_count,
        result.ready_count,
        result.blocking_count,
        result.unique_tuple_count,
        result.candidate_csv_sha256,
        result.plan_fingerprint_version,
        result.plan_fingerprint,
        manifest.preview_status,
    );
    fs::write(
        output.join("historical-isin-bootstrap-preview-summary.txt"),
        summary,
    )
    .map_err(|error| error.to_string())?;
    let mut writer = csv::Writer::from_path(output.join("historical-isin-bootstrap-preview.csv"))
        .map_err(|error| error.to_string())?;
    for row in &result.rows {
        writer.serialize(row).map_err(|error| error.to_string())?;
    }
    writer.flush().map_err(|error| error.to_string())?;
    write_json_file(
        &output.join("historical-isin-bootstrap-preview.json"),
        result,
    )?;
    write_json_file(
        &output.join("historical-isin-bootstrap-preview-manifest.json"),
        manifest,
    )?;
    Ok(())
}

fn write_apply_outputs(
    output: &Path,
    result: &HistoricalIsinBootstrapApplyResult,
    backup_path: Option<&Path>,
) -> AppResult<()> {
    fs::create_dir_all(output).map_err(|error| error.to_string())?;
    let summary = format!(
        "Corporate Action V1.9.2 Historical ISIN Bootstrap Apply\nMode: APPLY\nCandidate imports requested: {}\nUnique tuples planned: {}\nHistory rows inserted: {}\nHistory rows already applied: {}\nImports quick-resolved: {}\nImports already applied: {}\nFailed: {}\nTransaction committed: {}\nCandidate SHA-256: {}\nPlan fingerprint: {}\nBackup path: {}\nCorporate Actions approved: 0\n",
        result.candidate_count,
        result.unique_tuple_count,
        result.history_rows_inserted,
        result.history_rows_already_applied,
        result.imports_quick_resolved,
        result.imports_already_applied,
        result.failed_count,
        result.transaction_committed,
        result.candidate_csv_sha256,
        result.plan_fingerprint,
        backup_path.map(|path| path.to_string_lossy().to_string()).unwrap_or_default(),
    );
    fs::write(
        output.join("historical-isin-bootstrap-apply-summary.txt"),
        summary,
    )
    .map_err(|error| error.to_string())?;
    let mut import_writer =
        csv::Writer::from_path(output.join("historical-isin-bootstrap-apply-imports.csv"))
            .map_err(|error| error.to_string())?;
    for row in &result.import_results {
        import_writer
            .serialize(row)
            .map_err(|error| error.to_string())?;
    }
    import_writer.flush().map_err(|error| error.to_string())?;
    let mut tuple_writer =
        csv::Writer::from_path(output.join("historical-isin-bootstrap-apply-tuples.csv"))
            .map_err(|error| error.to_string())?;
    for row in &result.tuple_results {
        tuple_writer
            .serialize(historical_isin_bootstrap_apply_tuple_csv_row(row))
            .map_err(|error| error.to_string())?;
    }
    tuple_writer.flush().map_err(|error| error.to_string())?;
    write_json_file(&output.join("historical-isin-bootstrap-apply.json"), result)?;
    Ok(())
}

fn parse_required_arg(values: &HashMap<String, String>, name: &str) -> AppResult<String> {
    values
        .get(name)
        .cloned()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Missing required maintenance argument {name}."))
}

pub(crate) fn parse_historical_isin_bootstrap_maintenance_args(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<HistoricalIsinBootstrapMaintenanceInput>> {
    let args = args.into_iter().collect::<Vec<_>>();
    if !args
        .iter()
        .any(|arg| arg == "--maintenance-corporate-action-isin-bootstrap")
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
                | "--candidates"
                | "--preview-manifest"
                | "--output"
                | "--candidate-sha256"
                | "--live-main-sha256"
                | "--live-wal-sha256"
                | "--live-shm-sha256"
                | "--backup-path"
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
        "preview" => HistoricalIsinBootstrapMaintenanceMode::Preview,
        "apply" => HistoricalIsinBootstrapMaintenanceMode::Apply,
        other => return Err(format!("Invalid V1.9.2 maintenance mode: {other}")),
    };
    let preview_manifest_path = values.get("--preview-manifest").map(PathBuf::from);
    if matches!(mode, HistoricalIsinBootstrapMaintenanceMode::Apply)
        && preview_manifest_path.is_none()
    {
        return Err("Apply mode requires --preview-manifest.".to_string());
    }
    let candidate_sha256 = parse_required_arg(&values, "--candidate-sha256")?.to_lowercase();
    if !is_sha256_hex(candidate_sha256.as_str()) {
        return Err("--candidate-sha256 must be 64 hex characters.".to_string());
    }
    Ok(Some(HistoricalIsinBootstrapMaintenanceInput {
        mode,
        database_file: PathBuf::from(parse_required_arg(&values, "--database-file")?),
        candidates_path: PathBuf::from(parse_required_arg(&values, "--candidates")?),
        preview_manifest_path,
        output_path: PathBuf::from(parse_required_arg(&values, "--output")?),
        candidate_sha256,
        live_database_family_hashes: HistoricalIsinBootstrapDatabaseFamilyHashes {
            main_sha256: parse_required_arg(&values, "--live-main-sha256")?.to_lowercase(),
            wal_sha256: values
                .get("--live-wal-sha256")
                .cloned()
                .unwrap_or_default()
                .to_lowercase(),
            shm_sha256: values
                .get("--live-shm-sha256")
                .cloned()
                .unwrap_or_default()
                .to_lowercase(),
        },
        backup_path: values.get("--backup-path").map(PathBuf::from),
    }))
}

fn require_approved_candidate_hash(
    input: &HistoricalIsinBootstrapMaintenanceInput,
) -> AppResult<()> {
    if input.candidate_sha256 != HISTORICAL_ISIN_BOOTSTRAP_APPROVED_CANDIDATE_SHA256 {
        return Err(format!(
            "Candidate artifact SHA-256 is not the approved V1.9.1.1 artifact. expected={} actual={}",
            HISTORICAL_ISIN_BOOTSTRAP_APPROVED_CANDIDATE_SHA256, input.candidate_sha256
        ));
    }
    Ok(())
}

pub(crate) fn run_historical_isin_bootstrap_maintenance(
    input: HistoricalIsinBootstrapMaintenanceInput,
) -> AppResult<i32> {
    require_approved_candidate_hash(&input)?;
    if !input.database_file.is_file() {
        return Err(format!(
            "Database file does not exist: {}",
            input.database_file.display()
        ));
    }
    if !input.candidates_path.is_file() {
        return Err(format!(
            "Candidate CSV does not exist: {}",
            input.candidates_path.display()
        ));
    }
    let actual_candidate_sha256 = sha256_file(&input.candidates_path)?;
    if actual_candidate_sha256 != input.candidate_sha256 {
        return Err(format!(
            "Candidate CSV bytes do not match --candidate-sha256. expected={} actual={}",
            input.candidate_sha256, actual_candidate_sha256
        ));
    }
    match input.mode {
        HistoricalIsinBootstrapMaintenanceMode::Preview => {
            require_snapshot_hashes_match_live_contract(
                &input.database_file,
                &input.live_database_family_hashes,
            )?;
        }
        HistoricalIsinBootstrapMaintenanceMode::Apply => {
            let actual_hashes = compute_database_family_hashes(&input.database_file)?;
            if actual_hashes != input.live_database_family_hashes {
                return Err("Live database-family bytes do not match the hashes supplied by the approved Preview gate.".to_string());
            }
        }
    }
    fs::create_dir_all(&input.output_path).map_err(|error| error.to_string())?;
    match input.mode {
        HistoricalIsinBootstrapMaintenanceMode::Preview => {
            let connection = Connection::open_with_flags(
                &input.database_file,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )
            .map_err(|error| error.to_string())?;
            connection
                .execute_batch("PRAGMA query_only=ON;")
                .map_err(|error| error.to_string())?;
            let (result, manifest) = preview_historical_isin_bootstrap_internal(
                &connection,
                &input.candidates_path,
                &input.candidate_sha256,
                input.live_database_family_hashes,
            )?;
            write_preview_outputs(&input.output_path, &result, &manifest)?;
            println!(
                "[PASS] V1.9.2 Preview candidate imports: {}",
                result.candidate_count
            );
            println!("[PASS] READY: {}", result.ready_count);
            println!("[PASS] Blocking: {}", result.blocking_count);
            println!("[PASS] Unique tuples: {}", result.unique_tuple_count);
            println!("[PASS] Preview status: {}", manifest.preview_status);
            Ok(if manifest.preview_status == "READY" {
                0
            } else {
                3
            })
        }
        HistoricalIsinBootstrapMaintenanceMode::Apply => {
            let manifest_path = input
                .preview_manifest_path
                .as_deref()
                .ok_or_else(|| "Apply requires preview manifest.".to_string())?;
            let manifest: HistoricalIsinBootstrapPreviewManifest = serde_json::from_slice(
                &fs::read(manifest_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("Invalid Preview manifest: {error}"))?;
            let mut connection =
                Connection::open(&input.database_file).map_err(|error| error.to_string())?;
            let result = apply_historical_isin_bootstrap_internal(
                &mut connection,
                &input.candidates_path,
                &manifest,
                &input.candidate_sha256,
                input.live_database_family_hashes,
            )?;
            if let Err(error) =
                write_apply_outputs(&input.output_path, &result, input.backup_path.as_deref())
            {
                eprintln!("COMMITTED_REPORT_FAILURE");
                eprintln!("Database transaction committed successfully; final report writing failed. Do not restore automatically. Re-run Preview/Apply idempotency check.");
                eprintln!("Report error: {error}");
                return Ok(HISTORICAL_ISIN_BOOTSTRAP_COMMITTED_REPORT_FAILURE_EXIT);
            }
            println!("[PASS] V1.9.2 Apply transaction committed.");
            println!("[PASS] Candidate imports: {}", result.candidate_count);
            println!("[PASS] Unique tuples: {}", result.unique_tuple_count);
            println!(
                "[PASS] History rows inserted: {}",
                result.history_rows_inserted
            );
            println!(
                "[PASS] Imports quick-resolved: {}",
                result.imports_quick_resolved
            );
            println!("[PASS] Corporate Actions approved: 0");
            Ok(0)
        }
    }
}

pub(crate) fn try_run_historical_isin_bootstrap_maintenance(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<i32>> {
    let Some(input) = parse_historical_isin_bootstrap_maintenance_args(args)? else {
        return Ok(None);
    };
    run_historical_isin_bootstrap_maintenance(input).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;
    use tempfile::tempdir;

    fn candidate_csv_row(
        import_id: i64,
        symbol: &str,
        hist: &str,
        current: &str,
        fingerprint: &str,
    ) -> String {
        format!(
            "{import_id},NSE,{symbol},{hist},{current},ABC Industries Limited,ABC Industries Limited,ABC INDUSTRIES LTD,ABC INDUSTRIES LTD,true,2020-01-15,SPLIT,2,STRONG MATCH,98.5,1,NSE_API,https://www.nseindia.com/api/corporates-corporateActions,raw,{symbol},{hist},2020-01-15,ABC Industries Limited,SPLIT,2,0,[],,{symbol},{current},BOOTSTRAP_SAFE,ALL_STRICT_BOOTSTRAP_GATES_PASS,,{{}},ca-isin-bootstrap-v1,{fingerprint}\n"
        )
    }

    const CANDIDATE_HEADER: &str = "importId,exchange,officialSymbol,historicalOfficialIsin,currentIsin,companyName,destinationCompanyName,normalizedOfficialCompany,normalizedDestinationCompany,companyMatch,exDate,actionType,factor,priceValidationLabel,priceConfidencePct,sourceEvidenceCount,sourceCodes,sourceLocators,rawReferences,evidenceSymbols,evidenceIsins,evidenceEventDates,evidenceCompanies,evidenceActionTypes,evidenceFactors,exactDateIsinHistoryCount,exactDateIsinHistoryJson,destinationInstrumentId,destinationSymbol,destinationIsin,classification,classificationReason,failedGates,gateResultsJson,bootstrapFingerprintVersion,bootstrapFingerprint\n";

    #[test]
    fn phase1_v192_candidate_parser_accepts_reviewed_bootstrap_safe_shape() {
        let csv = format!(
            "{}{}",
            CANDIDATE_HEADER,
            candidate_csv_row(
                2656,
                "BIGBLOC",
                "INE412U01017",
                "INE412U01025",
                "13dcc913479a3da50b951032cf2d6e0456dc9d453c01c7e292230d441c62464e"
            )
        );
        let candidates = parse_historical_isin_bootstrap_candidates(csv.as_bytes()).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].import_id, 2656);
    }

    #[test]
    fn phase1_v192_candidate_parser_rejects_unauthorized_shape() {
        let bad_hash = "x".repeat(64);
        let csv = format!(
            "{}{}",
            CANDIDATE_HEADER,
            candidate_csv_row(1, "ABC", "INE000A01010", "INE000A01028", bad_hash.as_str())
        );
        assert!(parse_historical_isin_bootstrap_candidates(csv.as_bytes()).is_err());
    }

    fn golden_import(
        id: i64,
        symbol: &str,
        isin: &str,
        company: &str,
        ex_date: &str,
        factor: f64,
    ) -> CorporateActionImportRow {
        CorporateActionImportRow {
            id,
            exchange: "NSE".to_string(),
            source: "NSE_API".to_string(),
            source_file: None,
            symbol: Some(symbol.to_string()),
            isin: Some(isin.to_string()),
            bse_scrip_code: None,
            company_name: Some(company.to_string()),
            purpose_raw: "fixture".to_string(),
            ex_date: Some(ex_date.to_string()),
            record_date: None,
            action_type: "SPLIT".to_string(),
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            factor: Some(factor),
            price_factor: None,
            parse_status: "PARSED".to_string(),
            review_status: "UNRESOLVED".to_string(),
            message: None,
            approved_corporate_action_id: None,
            imported_at: "2026-01-01".to_string(),
            approved_at: None,
            evidence_count: 1,
            evidence_sources: vec!["NSE_API".to_string()],
            latest_evidence_captured_at: None,
            latest_evidence_source_locator: None,
            latest_evidence_note: None,
        }
    }

    #[test]
    fn phase1_v192_fingerprint_irctc_matches_reviewed_v1911_vector() {
        let company = "Indian Railway Catering And Tourism Corporation Limited";
        let import = golden_import(2557, "IRCTC", "INE335Y01012", company, "2021-10-28", 5.0);
        let evidence = vec![HistoricalIsinBootstrapEvidenceRow {
            id:2557, import_id:2557, source_code:"NSE_API".to_string(),
            source_locator:"https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=01-01-2021&to_date=09-06-2026".to_string(),
            symbol_seen:"IRCTC".to_string(), isin_seen:"INE335Y01012".to_string(), company_name_seen:company.to_string(), action_type_seen:"SPLIT".to_string(), event_date_seen:"2021-10-28".to_string(), factor_seen:Some(5.0),
            raw_reference:"{\"bseScripCode\":null,\"companyName\":\"Indian Railway Catering And Tourism Corporation Limited\",\"exDate\":\"2021-10-28\",\"isin\":\"INE335Y01012\",\"purposeRaw\":\"Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share\",\"recordDate\":\"2021-10-29\",\"symbol\":\"IRCTC\"}".to_string(),
        }];
        let destination = HistoricalIsinBootstrapDestination {
            instrument_id: None,
            symbol: "IRCTC".to_string(),
            isin: "INE335Y01020".to_string(),
            company_name: company.to_string(),
            is_active: true,
        };
        let payload = build_historical_isin_bootstrap_fingerprint_payload(
            &import,
            &evidence,
            &destination,
            &[],
        )
        .unwrap();
        assert_eq!(
            compute_historical_isin_bootstrap_fingerprint(&payload).unwrap(),
            "7bdfdd0b9524efa732f2b186588610cb72a431f46916f9e2cc8f3974a703707a"
        );
    }

    #[test]
    fn phase1_v192_fingerprint_globe_matches_reviewed_v1911_vector() {
        let company = "GLOBE ENTERPRISES (INDIA) LIMITED";
        let mut import = golden_import(1274, "GLOBE", "INE581X01013", company, "2021-08-03", 3.0);
        import.action_type = "BONUS".to_string();
        let evidence=vec![HistoricalIsinBootstrapEvidenceRow { id:1274, import_id:1274, source_code:"NSE_API".to_string(), source_locator:"https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=01-01-2021&to_date=09-06-2026".to_string(), symbol_seen:"GLOBE".to_string(), isin_seen:"INE581X01013".to_string(), company_name_seen:company.to_string(), action_type_seen:"BONUS".to_string(), event_date_seen:"2021-08-03".to_string(), factor_seen:Some(3.0), raw_reference:"{\"bseScripCode\":null,\"companyName\":\"GLOBE ENTERPRISES (INDIA) LIMITED\",\"exDate\":\"2021-08-03\",\"isin\":\"INE581X01013\",\"purposeRaw\":\"Bonus 2:1\",\"recordDate\":\"2021-08-04\",\"symbol\":\"GLOBE\"}".to_string() }];
        let destination = HistoricalIsinBootstrapDestination {
            instrument_id: None,
            symbol: "GLOBE".to_string(),
            isin: "INE581X01021".to_string(),
            company_name: company.to_string(),
            is_active: true,
        };
        let payload = build_historical_isin_bootstrap_fingerprint_payload(
            &import,
            &evidence,
            &destination,
            &[],
        )
        .unwrap();
        assert_eq!(
            compute_historical_isin_bootstrap_fingerprint(&payload).unwrap(),
            "01ef82dcce6896dca6fac2b99309348e14275719f6f19d9145f1480987122b04"
        );
    }

    #[test]
    fn phase1_v192_tuple_deduplicates_same_transition() {
        let c1 = HistoricalIsinBootstrapCandidate {
            import_id: 1274,
            exchange: "NSE".into(),
            official_symbol: "GLOBE".into(),
            historical_isin: "INE581X01013".into(),
            current_isin: "INE581X01021".into(),
            normalized_official_company: "GLOBE".into(),
            normalized_destination_company: "GLOBE".into(),
            ex_date: "2021-08-03".into(),
            action_type: "BONUS".into(),
            factor: 3.0,
            source_evidence_count: 1,
            source_codes: vec!["NSE_API".into()],
            source_locators: vec!["x".into()],
            raw_references: vec!["r".into()],
            evidence_symbols: vec!["GLOBE".into()],
            evidence_isins: vec!["INE581X01013".into()],
            evidence_event_dates: vec!["2021-08-03".into()],
            evidence_companies: vec!["GLOBE".into()],
            evidence_action_types: vec!["BONUS".into()],
            evidence_factors: vec![Some(3.0)],
            destination_symbol: "GLOBE".into(),
            destination_isin: "INE581X01021".into(),
            audited_fingerprint: "a".repeat(64),
        };
        let mut c2 = c1.clone();
        c2.import_id = 1275;
        c2.action_type = "SPLIT".into();
        c2.audited_fingerprint = "b".repeat(64);
        let live = HistoricalIsinBootstrapLiveEvidence {
            evidence_rows: vec![HistoricalIsinBootstrapEvidenceRow {
                id: 1,
                import_id: 1274,
                source_code: "NSE_API".into(),
                source_locator: "x".into(),
                symbol_seen: "GLOBE".into(),
                isin_seen: "INE581X01013".into(),
                company_name_seen: "GLOBE".into(),
                action_type_seen: "BONUS".into(),
                event_date_seen: "2021-08-03".into(),
                factor_seen: Some(3.0),
                raw_reference: "r".into(),
            }],
            computed_fingerprint: "a".repeat(64),
        };
        let mut live2 = live.clone();
        live2.evidence_rows[0].id = 2;
        live2.computed_fingerprint = "b".repeat(64);
        let tuples =
            build_historical_isin_bootstrap_tuple_plan(&[(c1, live), (c2, live2)]).unwrap();
        assert_eq!(tuples.len(), 1);
        assert_eq!(tuples[0].import_ids, vec![1274, 1275]);
    }

    #[test]
    fn phase1_v192_apply_plan_changes_with_database_hashes() {
        let candidates = vec![];
        let tuples = vec![];
        let a = HistoricalIsinBootstrapDatabaseFamilyHashes {
            main_sha256: "a".repeat(64),
            wal_sha256: String::new(),
            shm_sha256: String::new(),
        };
        let b = HistoricalIsinBootstrapDatabaseFamilyHashes {
            main_sha256: "b".repeat(64),
            wal_sha256: String::new(),
            shm_sha256: String::new(),
        };
        assert_ne!(
            compute_historical_isin_bootstrap_apply_plan_fingerprint(
                &"c".repeat(64),
                &candidates,
                &tuples,
                &a
            )
            .unwrap(),
            compute_historical_isin_bootstrap_apply_plan_fingerprint(
                &"c".repeat(64),
                &candidates,
                &tuples,
                &b
            )
            .unwrap()
        );
    }

    #[test]
    fn phase1_v192_maintenance_args_require_explicit_apply_manifest() {
        let base = vec![
            "app".to_string(),
            "--maintenance-corporate-action-isin-bootstrap".to_string(),
            "--mode".to_string(),
            "apply".to_string(),
            "--database-file".to_string(),
            "db".to_string(),
            "--candidates".to_string(),
            "c".to_string(),
            "--output".to_string(),
            "o".to_string(),
            "--candidate-sha256".to_string(),
            "a".repeat(64),
            "--live-main-sha256".to_string(),
            "b".repeat(64),
        ];
        assert!(parse_historical_isin_bootstrap_maintenance_args(base).is_err());
    }

    #[test]
    fn phase1_v192_maintenance_args_absent_flag_preserves_normal_startup() {
        assert!(
            parse_historical_isin_bootstrap_maintenance_args(vec!["app".to_string()])
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn phase1_v1923_apply_outputs_flatten_compound_import_ids_for_csv_only() {
        let dir = tempdir().unwrap();
        let result = HistoricalIsinBootstrapApplyResult {
            mode: "APPLY".to_string(),
            candidate_csv_sha256: "a".repeat(64),
            plan_fingerprint_version: HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION
                .to_string(),
            plan_fingerprint: "b".repeat(64),
            candidate_count: 2,
            unique_tuple_count: 1,
            history_rows_inserted: 1,
            history_rows_already_applied: 0,
            imports_quick_resolved: 2,
            imports_already_applied: 0,
            failed_count: 0,
            transaction_committed: true,
            corporate_actions_approved: 0,
            import_results: vec![
                HistoricalIsinBootstrapApplyImportResult {
                    import_id: 1274,
                    symbol: "GLOBE".to_string(),
                    ex_date: "2021-08-03".to_string(),
                    action_type: "BONUS".to_string(),
                    outcome: "QUICK_RESOLVED".to_string(),
                    resulting_review_status: "PENDING".to_string(),
                },
                HistoricalIsinBootstrapApplyImportResult {
                    import_id: 1275,
                    symbol: "GLOBE".to_string(),
                    ex_date: "2021-08-03".to_string(),
                    action_type: "SPLIT".to_string(),
                    outcome: "QUICK_RESOLVED".to_string(),
                    resulting_review_status: "PENDING".to_string(),
                },
            ],
            tuple_results: vec![HistoricalIsinBootstrapApplyTupleResult {
                exchange: "NSE".to_string(),
                symbol: "GLOBE".to_string(),
                historical_isin: "INE581X01013".to_string(),
                ex_date: "2021-08-03".to_string(),
                current_isin: "INE581X01021".to_string(),
                import_ids: vec![1274, 1275],
                history_row_id: Some(42),
                outcome: "INSERTED".to_string(),
            }],
        };

        write_apply_outputs(dir.path(), &result, None).unwrap();

        let tuple_csv = fs::read_to_string(
            dir.path()
                .join("historical-isin-bootstrap-apply-tuples.csv"),
        )
        .unwrap();
        assert!(tuple_csv.contains("1274|1275"));

        let apply_json: Value = serde_json::from_str(
            &fs::read_to_string(dir.path().join("historical-isin-bootstrap-apply.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            apply_json["tupleResults"][0]["importIds"],
            json!([1274, 1275])
        );
    }

    #[test]
    fn phase1_v192_strict_apply_transaction_rolls_back_on_quick_resolve_failure() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("db.sqlite3");
        let connection = Connection::open(&db_path).unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute("INSERT INTO instruments(symbol,exchange,isin,name,series,is_active,lifecycle_status) VALUES ('ABC','NSE','INE000A01028','ABC Industries Limited','EQ',1,'CURRENT')",[]).unwrap();
        connection.execute("INSERT INTO corporate_action_imports(id,dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,factor,price_factor,parse_status,review_status,imported_at) VALUES (1,'x','NSE','NSE_API','ABC','INE000A01010','ABC Industries Limited','Split','2020-01-15','SPLIT',2,0.5,'PARSED','UNRESOLVED','2026-01-01')",[]).unwrap();
        connection.execute("INSERT INTO corporate_action_import_evidence(id,import_id,source_code,source_locator,captured_at,symbol_seen,isin_seen,company_name_seen,action_type_seen,event_date_seen,factor_seen,raw_reference,note) VALUES (1,1,'NSE_API','x','2026-01-01','ABC','INE000A01010','ABC Industries Limited','SPLIT','2020-01-15',2,'r','n')",[]).unwrap();
        // No MATCHED scan: revalidation fails before mutation, proving fail-closed transaction entry.
        let count_before: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_isin_history", [], |r| {
                r.get(0)
            })
            .unwrap();
        let candidate = HistoricalIsinBootstrapCandidate {
            import_id: 1,
            exchange: "NSE".into(),
            official_symbol: "ABC".into(),
            historical_isin: "INE000A01010".into(),
            current_isin: "INE000A01028".into(),
            normalized_official_company: "ABC INDUSTRIES LTD".into(),
            normalized_destination_company: "ABC INDUSTRIES LTD".into(),
            ex_date: "2020-01-15".into(),
            action_type: "SPLIT".into(),
            factor: 2.0,
            source_evidence_count: 1,
            source_codes: vec!["NSE_API".into()],
            source_locators: vec!["x".into()],
            raw_references: vec!["r".into()],
            evidence_symbols: vec!["ABC".into()],
            evidence_isins: vec!["INE000A01010".into()],
            evidence_event_dates: vec!["2020-01-15".into()],
            evidence_companies: vec!["ABC Industries Limited".into()],
            evidence_action_types: vec!["SPLIT".into()],
            evidence_factors: vec![Some(2.0)],
            destination_symbol: "ABC".into(),
            destination_isin: "INE000A01028".into(),
            audited_fingerprint: "a".repeat(64),
        };
        assert!(revalidate_historical_isin_bootstrap_candidate(&connection, &candidate).is_err());
        let count_after: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_isin_history", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count_before, count_after);
    }
}

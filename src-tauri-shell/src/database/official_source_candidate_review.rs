use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

use super::official_source_candidate_validation::{
    revalidate_nse_candidate_for_er4, validate_nse_candidate_recovery,
    Er3bCandidateValidationResult, Er3bRecoveryReport, Er3bRecoveryRequest,
    ER3B_CLASS_INDETERMINATE, ER3B_CLASS_REJECTED, ER3B_CLASS_VALIDATED,
};
use super::official_source_version_history::{
    apply_official_source_rollback_internal, list_official_source_history_internal,
    promote_official_source_candidate_internal, read_er4_current_source_authority,
    read_official_source_configuration_authority, read_official_source_version_for_rollback,
    read_post_health_retry_context, record_candidate_decision_internal,
    update_review_event_post_health_internal, OfficialSourceConfigurationAuthority,
    OfficialSourceHistoryEntry, PromotionRevalidationEvidence, RollbackRevalidationEvidence,
};
use super::official_source_health::{
    assess_official_source_health_for_urls, er1_health_result_is_healthy,
    OfficialSourceHealthReport,
};
use super::{with_active_connection, AppResult};
use tauri::AppHandle;

pub(crate) const ER4_REVIEW_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Er4SourceRegistryEntry {
    pub source_key: &'static str,
    pub exchange: &'static str,
    pub source_id: Option<&'static str>,
    pub source_role: Option<&'static str>,
    pub config_field: &'static str,
    pub candidate_promotion_eligible: bool,
}

pub(crate) const ER4_SOURCE_REGISTRY: [Er4SourceRegistryEntry; 9] = [
    Er4SourceRegistryEntry {
        source_key: "NSE_SECURITIES_AVAILABLE_PAGE",
        exchange: "NSE",
        source_id: None,
        source_role: None,
        config_field: "nseSecuritiesAvailablePageUrl",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_CURRENT_EQUITY_MASTER",
        exchange: "NSE",
        source_id: Some("NSE_CURRENT_EQUITY_MASTER"),
        source_role: Some("CURRENT_IDENTITY_MASTER"),
        config_field: "nseEquityMasterUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_CURRENT_SME_MASTER",
        exchange: "NSE",
        source_id: Some("NSE_CURRENT_SME_MASTER"),
        source_role: Some("CURRENT_IDENTITY_MASTER_SME"),
        config_field: "nseSmeMasterUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_SYMBOL_CHANGE_HISTORY",
        exchange: "NSE",
        source_id: Some("NSE_SYMBOL_CHANGE_HISTORY"),
        source_role: Some("HISTORICAL_SYMBOL_CONTINUITY"),
        config_field: "nseSymbolChangeUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_COMPANY_NAME_CHANGE_HISTORY",
        exchange: "NSE",
        source_id: Some("NSE_COMPANY_NAME_CHANGE_HISTORY"),
        source_role: Some("HISTORICAL_NAME_CONTINUITY"),
        config_field: "nseCompanyNameChangeUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_DELISTED_PAGE",
        exchange: "NSE",
        source_id: None,
        source_role: None,
        config_field: "nseDelistedPageUrl",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_DELISTED_COMPANIES_WORKBOOK",
        exchange: "NSE",
        source_id: Some("NSE_DELISTED_COMPANIES_WORKBOOK"),
        source_role: Some("DELISTED_LIFECYCLE_EVIDENCE"),
        config_field: "nseDelistedWorkbookUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "BSE_LIST_SCRIPS_URL_PREFIX",
        exchange: "BSE",
        source_id: None,
        source_role: None,
        config_field: "bseListScripsUrlPrefix",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "BSE_LIST_SCRIPS_REFERER",
        exchange: "BSE",
        source_id: None,
        source_role: None,
        config_field: "bseListScripsReferer",
        candidate_promotion_eligible: false,
    },
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Er4CurrentSourceAuthority {
    pub source_key: String,
    pub exchange: String,
    pub source_id: Option<String>,
    pub source_role: Option<String>,
    pub config_field: String,
    pub candidate_promotion_eligible: bool,
    pub current_version_id: i64,
    pub revision: i64,
    pub current_url: String,
}

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Er4ConfigurationAuthority {
    pub schema_version: u32,
    pub configuration_fingerprint: String,
    pub sources: Vec<Er4CurrentSourceAuthority>,
}



pub(crate) struct Er4ValidationProjection<'a> {
    pub source_key: &'a str,
    pub source_id: &'a str,
    pub source_role: &'a str,
    pub current_url: &'a str,
    pub candidate_url: &'a str,
    pub candidate_final_url: Option<&'a str>,
    pub candidate_content_sha256: Option<&'a str>,
    pub classification: &'a str,
    pub discovery_reason: &'a str,
    pub http_status: Option<u16>,
    pub content_type: Option<&'a str>,
    pub response_bytes: Option<u64>,
    pub parser_status: &'a str,
    pub schema_status: &'a str,
    pub population_status: &'a str,
    pub population_count: Option<u32>,
    pub freshness_status: &'a str,
    pub validation_reason: &'a str,
}

#[derive(Clone, Copy)]
pub(crate) struct Er4ReviewFingerprintInput<'a> {
    pub source_key: &'a str,
    pub source_id: &'a str,
    pub source_role: &'a str,
    pub base_version_id: i64,
    pub base_revision: i64,
    pub current_url: &'a str,
    pub candidate_url: &'a str,
    pub candidate_final_url: Option<&'a str>,
    pub candidate_content_sha256: Option<&'a str>,
    pub classification: &'a str,
    pub validation_report_sha256: &'a str,
}

fn sha256_upper_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}

fn serialize_compact_array(values: Vec<Value>) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&Value::Array(values))
        .map_err(|error| format!("ER4_CANONICAL_SERIALIZATION_FAILED: {error}"))
}

pub(crate) fn compute_er4_configuration_fingerprint(
    sources: &[Er4CurrentSourceAuthority],
) -> Result<String, String> {
    if sources.len() != ER4_SOURCE_REGISTRY.len() {
        return Err("ER4_CONFIGURATION_AUTHORITY_INVALID".to_string());
    }

    let mut by_key: BTreeMap<&str, &Er4CurrentSourceAuthority> = BTreeMap::new();
    for source in sources {
        if !ER4_SOURCE_REGISTRY
            .iter()
            .any(|entry| entry.source_key == source.source_key.as_str())
        {
            return Err("ER4_CONFIGURATION_AUTHORITY_INVALID".to_string());
        }
        if by_key.insert(source.source_key.as_str(), source).is_some() {
            return Err("ER4_CONFIGURATION_AUTHORITY_INVALID".to_string());
        }
    }

    let actual_keys = by_key.keys().copied().collect::<BTreeSet<_>>();
    let expected_keys = ER4_SOURCE_REGISTRY
        .iter()
        .map(|entry| entry.source_key)
        .collect::<BTreeSet<_>>();
    if actual_keys != expected_keys {
        return Err("ER4_CONFIGURATION_AUTHORITY_INVALID".to_string());
    }

    let mut ordered_rows = Vec::with_capacity(ER4_SOURCE_REGISTRY.len());
    for entry in ER4_SOURCE_REGISTRY {
        let source = by_key
            .get(entry.source_key)
            .copied()
            .ok_or_else(|| "ER4_CONFIGURATION_AUTHORITY_INVALID".to_string())?;
        ordered_rows.push(json!([
            source.source_key,
            source.current_version_id,
            source.revision,
            source.current_url
        ]));
    }

    let bytes = serialize_compact_array(vec![
        json!("ER4_CONFIG_V1"),
        Value::Array(ordered_rows),
    ])?;
    Ok(sha256_upper_hex(&bytes))
}

fn er4_validation_report_value(input: &Er4ValidationProjection<'_>) -> Value {
    Value::Array(vec![
        json!("ER4_VALIDATION_V1"),
        json!(input.source_key),
        json!(input.source_id),
        json!(input.source_role),
        json!(input.current_url),
        json!(input.candidate_url),
        json!(input.candidate_final_url),
        json!(input.candidate_content_sha256),
        json!(input.classification),
        json!(input.discovery_reason),
        json!(input.http_status),
        json!(input.content_type),
        json!(input.response_bytes),
        json!(input.parser_status),
        json!(input.schema_status),
        json!(input.population_status),
        json!(input.population_count),
        json!(input.freshness_status),
        json!(input.validation_reason),
    ])
}

pub(crate) fn compute_er4_validation_report_sha256(
    input: &Er4ValidationProjection<'_>,
) -> Result<String, String> {
    let bytes = serde_json::to_vec(&er4_validation_report_value(input))
        .map_err(|error| format!("ER4_CANONICAL_SERIALIZATION_FAILED: {error}"))?;
    Ok(sha256_upper_hex(&bytes))
}

pub(crate) fn compute_er4_review_fingerprint(
    input: &Er4ReviewFingerprintInput<'_>,
) -> Result<String, String> {
    let bytes = serialize_compact_array(vec![
        json!("ER4_REVIEW_V1"),
        json!(input.source_key),
        json!(input.source_id),
        json!(input.source_role),
        json!(input.base_version_id),
        json!(input.base_revision),
        json!(input.current_url),
        json!(input.candidate_url),
        json!(input.candidate_final_url),
        json!(input.candidate_content_sha256),
        json!(input.classification),
        json!(input.validation_report_sha256),
    ])?;
    Ok(sha256_upper_hex(&bytes))
}


#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceCandidateReviewPlan {
    pub schema_version: u32,
    pub source_key: String,
    pub exchange: String,
    pub source_id: String,
    pub source_role: String,
    pub base_version_id: i64,
    pub base_revision: i64,
    pub current_url: String,
    pub candidate_url: String,
    pub candidate_final_url: Option<String>,
    pub candidate_content_sha256: Option<String>,
    pub classification: String,
    pub discovery_reason: String,
    pub http_status: Option<u16>,
    pub content_type: Option<String>,
    pub response_bytes: Option<u64>,
    pub parser_status: String,
    pub schema_status: String,
    pub population_status: String,
    pub population_count: Option<u32>,
    pub freshness_status: String,
    pub validation_reason: String,
    pub validation_report_sha256: String,
    pub review_fingerprint: String,
    pub promotable: bool,
}

fn registry_entry(source_key: &str) -> Option<Er4SourceRegistryEntry> {
    ER4_SOURCE_REGISTRY
        .iter()
        .copied()
        .find(|entry| entry.source_key == source_key)
}

fn validate_base_against_registry(
    base: &Er4CurrentSourceAuthority,
    entry: &Er4SourceRegistryEntry,
) -> Result<(), String> {
    if base.source_key.as_str() != entry.source_key
        || base.exchange.as_str() != entry.exchange
        || base.source_id.as_deref() != entry.source_id
        || base.source_role.as_deref() != entry.source_role
        || base.config_field.as_str() != entry.config_field
        || base.candidate_promotion_eligible != entry.candidate_promotion_eligible
    {
        return Err("ER4_BASE_AUTHORITY_MISMATCH".to_string());
    }
    Ok(())
}

pub(crate) fn build_er4_candidate_review_plan(
    base: &Er4CurrentSourceAuthority,
    candidate: &Er3bCandidateValidationResult,
) -> Result<OfficialSourceCandidateReviewPlan, String> {
    let entry = registry_entry(&base.source_key)
        .ok_or_else(|| "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE".to_string())?;
    validate_base_against_registry(base, &entry)?;
    if !entry.candidate_promotion_eligible {
        return Err("ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE".to_string());
    }

    let expected_source_id = entry
        .source_id
        .ok_or_else(|| "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE".to_string())?;
    let expected_source_role = entry
        .source_role
        .ok_or_else(|| "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE".to_string())?;

    if candidate.source_id.as_str() != expected_source_id
        || candidate.source_role.as_str() != expected_source_role
    {
        return Err("ER4_CANDIDATE_AUTHORITY_MISMATCH".to_string());
    }
    if candidate.configured_url.as_str() != base.current_url.as_str() {
        return Err("ER4_CANDIDATE_BASE_URL_MISMATCH".to_string());
    }

    let promotable = match candidate.classification.as_str() {
        ER3B_CLASS_VALIDATED => true,
        ER3B_CLASS_INDETERMINATE | ER3B_CLASS_REJECTED => false,
        _ => return Err("ER4_CANDIDATE_CLASSIFICATION_UNSUPPORTED".to_string()),
    };
    if promotable && candidate.content_sha256.is_none() {
        return Err("ER4_VALIDATED_CANDIDATE_MISSING_SHA256".to_string());
    }

    let validation = Er4ValidationProjection {
        source_key: entry.source_key,
        source_id: expected_source_id,
        source_role: expected_source_role,
        current_url: &base.current_url,
        candidate_url: &candidate.candidate_url,
        candidate_final_url: candidate.final_url.as_deref(),
        candidate_content_sha256: candidate.content_sha256.as_deref(),
        classification: &candidate.classification,
        discovery_reason: &candidate.discovery_reason,
        http_status: candidate.http_status,
        content_type: candidate.content_type.as_deref(),
        response_bytes: candidate.response_bytes,
        parser_status: &candidate.parser_status,
        schema_status: &candidate.schema_status,
        population_status: &candidate.population_status,
        population_count: candidate.population_count,
        freshness_status: &candidate.freshness_status,
        validation_reason: &candidate.validation_reason,
    };
    let validation_report_sha256 = compute_er4_validation_report_sha256(&validation)?;

    let review = Er4ReviewFingerprintInput {
        source_key: entry.source_key,
        source_id: expected_source_id,
        source_role: expected_source_role,
        base_version_id: base.current_version_id,
        base_revision: base.revision,
        current_url: &base.current_url,
        candidate_url: &candidate.candidate_url,
        candidate_final_url: candidate.final_url.as_deref(),
        candidate_content_sha256: candidate.content_sha256.as_deref(),
        classification: &candidate.classification,
        validation_report_sha256: &validation_report_sha256,
    };
    let review_fingerprint = compute_er4_review_fingerprint(&review)?;

    Ok(OfficialSourceCandidateReviewPlan {
        schema_version: ER4_REVIEW_SCHEMA_VERSION,
        source_key: entry.source_key.to_string(),
        exchange: entry.exchange.to_string(),
        source_id: expected_source_id.to_string(),
        source_role: expected_source_role.to_string(),
        base_version_id: base.current_version_id,
        base_revision: base.revision,
        current_url: base.current_url.clone(),
        candidate_url: candidate.candidate_url.clone(),
        candidate_final_url: candidate.final_url.clone(),
        candidate_content_sha256: candidate.content_sha256.clone(),
        classification: candidate.classification.clone(),
        discovery_reason: candidate.discovery_reason.clone(),
        http_status: candidate.http_status,
        content_type: candidate.content_type.clone(),
        response_bytes: candidate.response_bytes,
        parser_status: candidate.parser_status.clone(),
        schema_status: candidate.schema_status.clone(),
        population_status: candidate.population_status.clone(),
        population_count: candidate.population_count,
        freshness_status: candidate.freshness_status.clone(),
        validation_reason: candidate.validation_reason.clone(),
        validation_report_sha256,
        review_fingerprint,
        promotable,
    })
}

pub(crate) fn verify_er4_review_base(
    expected_version_id: i64,
    expected_revision: i64,
    expected_url: &str,
    actual: &Er4CurrentSourceAuthority,
) -> Result<(), String> {
    if actual.current_version_id != expected_version_id
        || actual.revision != expected_revision
        || actual.current_url != expected_url
    {
        return Err("ER4_STALE_REJECTED".to_string());
    }
    Ok(())
}

fn validation_projection_from_review(
    review: &OfficialSourceCandidateReviewPlan,
) -> Er4ValidationProjection<'_> {
    Er4ValidationProjection {
        source_key: &review.source_key,
        source_id: &review.source_id,
        source_role: &review.source_role,
        current_url: &review.current_url,
        candidate_url: &review.candidate_url,
        candidate_final_url: review.candidate_final_url.as_deref(),
        candidate_content_sha256: review.candidate_content_sha256.as_deref(),
        classification: &review.classification,
        discovery_reason: &review.discovery_reason,
        http_status: review.http_status,
        content_type: review.content_type.as_deref(),
        response_bytes: review.response_bytes,
        parser_status: &review.parser_status,
        schema_status: &review.schema_status,
        population_status: &review.population_status,
        population_count: review.population_count,
        freshness_status: &review.freshness_status,
        validation_reason: &review.validation_reason,
    }
}

pub(crate) fn validation_report_json_from_review(
    review: &OfficialSourceCandidateReviewPlan,
) -> Result<String, String> {
    let projection = validation_projection_from_review(review);
    serde_json::to_string(&er4_validation_report_value(&projection))
        .map_err(|error| format!("ER4_CANONICAL_SERIALIZATION_FAILED: {error}"))
}

pub(crate) fn validate_er4_candidate_review_plan_integrity(
    review: &OfficialSourceCandidateReviewPlan,
) -> Result<(), String> {
    if review.schema_version != ER4_REVIEW_SCHEMA_VERSION {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }
    let entry = registry_entry(&review.source_key)
        .ok_or_else(|| "ER4_REVIEW_PLAN_INVALID".to_string())?;
    if !entry.candidate_promotion_eligible
        || review.exchange != entry.exchange
        || review.source_id != entry.source_id.unwrap_or_default()
        || review.source_role != entry.source_role.unwrap_or_default()
    {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }

    let expected_promotable = match review.classification.as_str() {
        ER3B_CLASS_VALIDATED => true,
        ER3B_CLASS_INDETERMINATE | ER3B_CLASS_REJECTED => false,
        _ => return Err("ER4_REVIEW_PLAN_INVALID".to_string()),
    };
    if review.promotable != expected_promotable {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }
    if expected_promotable && review.candidate_content_sha256.is_none() {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }

    let validation = validation_projection_from_review(review);
    let expected_validation_hash = compute_er4_validation_report_sha256(&validation)?;
    if expected_validation_hash != review.validation_report_sha256 {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }

    let fingerprint = Er4ReviewFingerprintInput {
        source_key: &review.source_key,
        source_id: &review.source_id,
        source_role: &review.source_role,
        base_version_id: review.base_version_id,
        base_revision: review.base_revision,
        current_url: &review.current_url,
        candidate_url: &review.candidate_url,
        candidate_final_url: review.candidate_final_url.as_deref(),
        candidate_content_sha256: review.candidate_content_sha256.as_deref(),
        classification: &review.classification,
        validation_report_sha256: &review.validation_report_sha256,
    };
    if compute_er4_review_fingerprint(&fingerprint)? != review.review_fingerprint {
        return Err("ER4_REVIEW_PLAN_INVALID".to_string());
    }
    Ok(())
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindOfficialSourceReplacementCandidatesInput {
    pub source_key: String,
    pub trigger_category: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceReplacementCandidatesResult {
    pub authority: OfficialSourceConfigurationAuthority,
    pub source_key: String,
    pub candidates: Vec<OfficialSourceCandidateReviewPlan>,
    pub discovery_rejection_count: u32,
}

fn validate_er4_recovery_trigger(trigger_category: &str) -> Result<(), String> {
    match trigger_category {
        "PROVENANCE_FAILURE"
        | "TRANSPORT_FAILURE"
        | "HTTP_FAILURE"
        | "FORMAT_OR_SCHEMA_FAILURE"
        | "POPULATION_FAILURE"
        | "SEMANTIC_FAILURE" => Ok(()),
        _ => Err(format!(
            "ER4_CANDIDATE_TRIGGER_NOT_ELIGIBLE: '{trigger_category}'."
        )),
    }
}

fn er1_source_for_er4_source_key(source_key: &str) -> Result<&'static str, String> {
    match source_key {
        "NSE_CURRENT_EQUITY_MASTER" => Ok("NSE_EQUITY_MASTER"),
        "NSE_CURRENT_SME_MASTER" => Ok("NSE_SME_MASTER"),
        "NSE_SYMBOL_CHANGE_HISTORY" => Ok("NSE_SYMBOL_CHANGE"),
        "NSE_COMPANY_NAME_CHANGE_HISTORY" => Ok("NSE_COMPANY_NAME_CHANGE"),
        "NSE_DELISTED_COMPANIES_WORKBOOK" => Ok("NSE_DELISTED_WORKBOOK"),
        _ => Err(format!(
            "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE: '{source_key}'."
        )),
    }
}

fn landing_page_for_source<'a>(
    source_key: &str,
    authority: &'a OfficialSourceConfigurationAuthority,
) -> Result<&'a str, String> {
    match source_key {
        "NSE_DELISTED_COMPANIES_WORKBOOK" => Ok(&authority.urls.nse_delisted_page_url),
        "NSE_CURRENT_EQUITY_MASTER"
        | "NSE_CURRENT_SME_MASTER"
        | "NSE_SYMBOL_CHANGE_HISTORY"
        | "NSE_COMPANY_NAME_CHANGE_HISTORY" => {
            Ok(&authority.urls.nse_securities_available_page_url)
        }
        _ => Err(format!(
            "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE: '{source_key}'."
        )),
    }
}

fn build_replacement_candidates_result(
    authority: OfficialSourceConfigurationAuthority,
    base: &Er4CurrentSourceAuthority,
    report: Er3bRecoveryReport,
) -> Result<OfficialSourceReplacementCandidatesResult, String> {
    let mut candidates = Vec::with_capacity(report.candidate_results.len());
    for candidate in &report.candidate_results {
        candidates.push(build_er4_candidate_review_plan(base, candidate)?);
    }
    Ok(OfficialSourceReplacementCandidatesResult {
        source_key: base.source_key.clone(),
        authority,
        candidates,
        discovery_rejection_count: report.discovery_rejection_count,
    })
}

#[tauri::command]
pub async fn find_official_source_replacement_candidates(
    app: AppHandle,
    input: FindOfficialSourceReplacementCandidatesInput,
) -> AppResult<OfficialSourceReplacementCandidatesResult> {
    validate_er4_recovery_trigger(&input.trigger_category)?;
    let er1_source_id = er1_source_for_er4_source_key(&input.source_key)?;
    let source_key = input.source_key.clone();
    let trigger_category = input.trigger_category.clone();

    let snapshot = with_active_connection(&app, |connection| {
        let authority = read_official_source_configuration_authority(connection)?;
        let base = read_er4_current_source_authority(connection, &source_key)?;
        if !base.candidate_promotion_eligible || base.exchange != "NSE" {
            return Err(format!(
                "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE: '{}'.",
                base.source_key
            ));
        }
        let landing_page = landing_page_for_source(&source_key, &authority)?.to_string();
        Ok((authority, base, landing_page))
    })?
    .ok_or_else(|| "Open a database before finding replacement candidates.".to_string())?;

    let (authority, base, landing_page_url) = snapshot;
    let configured_url = base.current_url.clone();
    let er1_source_id = er1_source_id.to_string();

    let report = tauri::async_runtime::spawn_blocking(move || {
        validate_nse_candidate_recovery(&Er3bRecoveryRequest {
            er1_source_id: &er1_source_id,
            trigger_category: &trigger_category,
            configured_url: &configured_url,
            landing_page_url: &landing_page_url,
        })
    })
    .await
    .map_err(|error| error.to_string())??;

    build_replacement_candidates_result(authority, &base, report)
}


fn validation_report_sha256_for_revalidation(
    review: &OfficialSourceCandidateReviewPlan,
    fresh: &Er3bCandidateValidationResult,
) -> Result<String, String> {
    let projection = Er4ValidationProjection {
        source_key: &review.source_key,
        source_id: &fresh.source_id,
        source_role: &fresh.source_role,
        current_url: &review.current_url,
        candidate_url: &fresh.candidate_url,
        candidate_final_url: fresh.final_url.as_deref(),
        candidate_content_sha256: fresh.content_sha256.as_deref(),
        classification: &fresh.classification,
        discovery_reason: &review.discovery_reason,
        http_status: fresh.http_status,
        content_type: fresh.content_type.as_deref(),
        response_bytes: fresh.response_bytes,
        parser_status: &fresh.parser_status,
        schema_status: &fresh.schema_status,
        population_status: &fresh.population_status,
        population_count: fresh.population_count,
        freshness_status: &fresh.freshness_status,
        validation_reason: &fresh.validation_reason,
    };
    compute_er4_validation_report_sha256(&projection)
}

fn validate_promotion_revalidation(
    review: &OfficialSourceCandidateReviewPlan,
    fresh: &Er3bCandidateValidationResult,
) -> Result<PromotionRevalidationEvidence, String> {
    validate_er4_candidate_review_plan_integrity(review)?;
    if !review.promotable || review.classification != ER3B_CLASS_VALIDATED {
        return Err("ER4_PROMOTION_NOT_ELIGIBLE".to_string());
    }
    if fresh.source_id != review.source_id
        || fresh.source_role != review.source_role
        || fresh.candidate_url != review.candidate_url
        || fresh.classification != ER3B_CLASS_VALIDATED
    {
        return Err("ER4_REVALIDATION_MISMATCH".to_string());
    }
    let reviewed_sha = review
        .candidate_content_sha256
        .as_deref()
        .ok_or_else(|| "ER4_REVIEW_PLAN_INVALID".to_string())?;
    let fresh_sha = fresh
        .content_sha256
        .as_deref()
        .ok_or_else(|| "ER4_REVALIDATION_MISMATCH".to_string())?;
    if reviewed_sha != fresh_sha {
        return Err("ER4_REVALIDATION_MISMATCH".to_string());
    }
    let fresh_report_sha = validation_report_sha256_for_revalidation(review, fresh)?;
    if fresh_report_sha != review.validation_report_sha256 {
        return Err("ER4_REVALIDATION_MISMATCH".to_string());
    }
    Ok(PromotionRevalidationEvidence {
        candidate_content_sha256: fresh_sha.to_string(),
        validation_report_sha256: fresh_report_sha,
    })
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromoteOfficialSourceCandidateReviewedInput {
    pub review: OfficialSourceCandidateReviewPlan,
    pub operator_note: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourcePromotionResult {
    pub result_status: String,
    pub result_version_id: i64,
    pub authority: OfficialSourceConfigurationAuthority,
    pub post_health_report: Option<OfficialSourceHealthReport>,
}

#[tauri::command]
pub async fn promote_official_source_candidate_reviewed(
    app: AppHandle,
    input: PromoteOfficialSourceCandidateReviewedInput,
) -> AppResult<OfficialSourcePromotionResult> {
    validate_er4_candidate_review_plan_integrity(&input.review)?;
    if !input.review.promotable || input.review.classification != ER3B_CLASS_VALIDATED {
        return Err("ER4_PROMOTION_NOT_ELIGIBLE".to_string());
    }

    let source_key = input.review.source_key.clone();
    let preflight = with_active_connection(&app, |connection| {
        let authority = read_official_source_configuration_authority(connection)?;
        let current = read_er4_current_source_authority(connection, &source_key)?;
        verify_er4_review_base(
            input.review.base_version_id,
            input.review.base_revision,
            &input.review.current_url,
            &current,
        )?;
        let landing = landing_page_for_source(&source_key, &authority)?.to_string();
        Ok(landing)
    })?
    .ok_or_else(|| "Open a database before promoting source candidates.".to_string())?;

    let review_for_network = input.review.clone();
    let fresh = tauri::async_runtime::spawn_blocking(move || {
        revalidate_nse_candidate_for_er4(
            &review_for_network.source_id,
            &review_for_network.source_role,
            &review_for_network.current_url,
            &preflight,
            &review_for_network.candidate_url,
        )
    })
    .await
    .map_err(|error| error.to_string())??;
    let revalidation = validate_promotion_revalidation(&input.review, &fresh)?;

    let operator_note = input.operator_note.clone();
    let review = input.review.clone();
    let committed = with_active_connection(&app, |connection| {
        promote_official_source_candidate_internal(
            connection,
            &review,
            &revalidation,
            operator_note.as_deref(),
            None,
        )
    })?
    .ok_or_else(|| "Open a database before promoting source candidates.".to_string())?;

    let health_urls = committed.authority.urls.clone();
    let health_result = tauri::async_runtime::spawn_blocking(move || {
        assess_official_source_health_for_urls(&health_urls)
    })
    .await
    .map_err(|error| error.to_string())?;

    let affected_er1_source = er1_source_for_er4_source_key(&source_key)?;
    let (result_status, post_health_report, report_json) = match health_result {
        Ok(report) => {
            let healthy = report
                .results
                .iter()
                .find(|result| result.source_id == affected_er1_source)
                .map(er1_health_result_is_healthy)
                .unwrap_or(false);
            let status = if healthy {
                "PROMOTED_HEALTHY"
            } else {
                "PROMOTED_HEALTH_CHECK_FAILED"
            };
            let json = serde_json::to_string(&report).map_err(|error| error.to_string())?;
            (status.to_string(), Some(report), Some(json))
        }
        Err(_) => (
            "PROMOTED_HEALTH_CHECK_FAILED".to_string(),
            None,
            None,
        ),
    };

    with_active_connection(&app, |connection| {
        update_review_event_post_health_internal(
            connection,
            committed.review_event_id,
            &committed.authority.configuration_fingerprint,
            report_json.as_deref(),
            &result_status,
        )
    })?
    .ok_or_else(|| "Open a database before recording post-promotion health.".to_string())?;

    Ok(OfficialSourcePromotionResult {
        result_status,
        result_version_id: committed.result_version_id,
        authority: committed.authority,
        post_health_report,
    })
}


#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceRollbackReview {
    pub schema_version: u32,
    pub source_key: String,
    pub current_version_id: i64,
    pub current_revision: i64,
    pub current_url: String,
    pub target_version_id: i64,
    pub target_url: String,
    pub target_validation_sha256: String,
    pub rollback_fingerprint: String,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOfficialSourceRollbackReviewInput {
    pub source_key: String,
    pub target_version_id: i64,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyOfficialSourceRollbackReviewedInput {
    pub review: OfficialSourceRollbackReview,
    pub operator_note: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceRollbackResult {
    pub result_status: String,
    pub result_version_id: i64,
    pub authority: OfficialSourceConfigurationAuthority,
    pub post_health_report: Option<OfficialSourceHealthReport>,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryOfficialSourcePostHealthInput {
    pub source_key: String,
    pub result_version_id: i64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourcePostHealthResult {
    pub result_status: String,
    pub result_version_id: i64,
    pub post_health_report: Option<OfficialSourceHealthReport>,
}

fn compute_rollback_target_validation_sha256(
    source_key: &str,
    current_url: &str,
    fresh: &Er3bCandidateValidationResult,
) -> Result<String, String> {
    let projection = Er4ValidationProjection {
        source_key,
        source_id: &fresh.source_id,
        source_role: &fresh.source_role,
        current_url,
        candidate_url: &fresh.candidate_url,
        candidate_final_url: fresh.final_url.as_deref(),
        candidate_content_sha256: fresh.content_sha256.as_deref(),
        classification: &fresh.classification,
        discovery_reason: "ER4_ROLLBACK_TARGET_REVALIDATION",
        http_status: fresh.http_status,
        content_type: fresh.content_type.as_deref(),
        response_bytes: fresh.response_bytes,
        parser_status: &fresh.parser_status,
        schema_status: &fresh.schema_status,
        population_status: &fresh.population_status,
        population_count: fresh.population_count,
        freshness_status: &fresh.freshness_status,
        validation_reason: &fresh.validation_reason,
    };
    compute_er4_validation_report_sha256(&projection)
}

fn compute_er4_rollback_fingerprint(
    source_key: &str,
    current_version_id: i64,
    current_revision: i64,
    current_url: &str,
    target_version_id: i64,
    target_url: &str,
    target_validation_sha256: &str,
) -> Result<String, String> {
    let bytes = serialize_compact_array(vec![
        json!("ER4_ROLLBACK_V1"),
        json!(source_key),
        json!(current_version_id),
        json!(current_revision),
        json!(current_url),
        json!(target_version_id),
        json!(target_url),
        json!(target_validation_sha256),
    ])?;
    Ok(sha256_upper_hex(&bytes))
}

fn validate_official_source_rollback_review_integrity(
    review: &OfficialSourceRollbackReview,
) -> Result<(), String> {
    if review.schema_version != ER4_REVIEW_SCHEMA_VERSION {
        return Err("ER4_ROLLBACK_REVIEW_INVALID".to_string());
    }
    let entry = registry_entry(&review.source_key)
        .ok_or_else(|| "ER4_ROLLBACK_REVIEW_INVALID".to_string())?;
    if entry.exchange != "NSE" || !entry.candidate_promotion_eligible {
        return Err("ER4_ROLLBACK_NOT_ELIGIBLE".to_string());
    }
    if review.target_version_id == review.current_version_id {
        return Err("ER4_ROLLBACK_TARGET_IS_CURRENT".to_string());
    }
    let expected = compute_er4_rollback_fingerprint(
        &review.source_key,
        review.current_version_id,
        review.current_revision,
        &review.current_url,
        review.target_version_id,
        &review.target_url,
        &review.target_validation_sha256,
    )?;
    if expected != review.rollback_fingerprint {
        return Err("ER4_ROLLBACK_REVIEW_INVALID".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn create_official_source_rollback_review(
    app: AppHandle,
    input: CreateOfficialSourceRollbackReviewInput,
) -> AppResult<OfficialSourceRollbackReview> {
    let source_key = input.source_key.clone();
    let target_version_id = input.target_version_id;
    let preflight = with_active_connection(&app, |connection| {
        let authority = read_official_source_configuration_authority(connection)?;
        let current = read_er4_current_source_authority(connection, &source_key)?;
        if current.exchange != "NSE" || !current.candidate_promotion_eligible {
            return Err("ER4_ROLLBACK_NOT_ELIGIBLE".to_string());
        }
        if current.current_version_id == target_version_id {
            return Err("ER4_ROLLBACK_TARGET_IS_CURRENT".to_string());
        }
        let target = read_official_source_version_for_rollback(
            connection,
            &source_key,
            target_version_id,
        )?;
        if target.source_id != current.source_id || target.source_role != current.source_role {
            return Err("ER4_ROLLBACK_TARGET_SOURCE_MISMATCH".to_string());
        }
        let landing = landing_page_for_source(&source_key, &authority)?.to_string();
        Ok((current, target, landing))
    })?
    .ok_or_else(|| "Open a database before reviewing source rollback.".to_string())?;

    let (current, target, landing_page_url) = preflight;
    let source_id = current
        .source_id
        .as_deref()
        .ok_or_else(|| "ER4_ROLLBACK_NOT_ELIGIBLE".to_string())?;
    let source_role = current
        .source_role
        .as_deref()
        .ok_or_else(|| "ER4_ROLLBACK_NOT_ELIGIBLE".to_string())?;
    let configured_url = current.current_url.clone();
    let target_url = target.url.clone();
    let source_id_owned = source_id.to_string();
    let source_role_owned = source_role.to_string();
    let fresh = tauri::async_runtime::spawn_blocking(move || {
        revalidate_nse_candidate_for_er4(
            &source_id_owned,
            &source_role_owned,
            &configured_url,
            &landing_page_url,
            &target_url,
        )
    })
    .await
    .map_err(|error| error.to_string())??;
    if fresh.classification != ER3B_CLASS_VALIDATED || fresh.content_sha256.is_none() {
        return Err("ER4_ROLLBACK_TARGET_REVALIDATION_FAILED".to_string());
    }
    let target_validation_sha256 = compute_rollback_target_validation_sha256(
        &source_key,
        &current.current_url,
        &fresh,
    )?;
    let rollback_fingerprint = compute_er4_rollback_fingerprint(
        &source_key,
        current.current_version_id,
        current.revision,
        &current.current_url,
        target.version_id,
        &target.url,
        &target_validation_sha256,
    )?;

    Ok(OfficialSourceRollbackReview {
        schema_version: ER4_REVIEW_SCHEMA_VERSION,
        source_key,
        current_version_id: current.current_version_id,
        current_revision: current.revision,
        current_url: current.current_url,
        target_version_id: target.version_id,
        target_url: target.url,
        target_validation_sha256,
        rollback_fingerprint,
    })
}

#[tauri::command]
pub async fn apply_official_source_rollback_reviewed(
    app: AppHandle,
    input: ApplyOfficialSourceRollbackReviewedInput,
) -> AppResult<OfficialSourceRollbackResult> {
    validate_official_source_rollback_review_integrity(&input.review)?;
    let source_key = input.review.source_key.clone();
    let preflight = with_active_connection(&app, |connection| {
        let authority = read_official_source_configuration_authority(connection)?;
        let current = read_er4_current_source_authority(connection, &source_key)?;
        verify_er4_review_base(
            input.review.current_version_id,
            input.review.current_revision,
            &input.review.current_url,
            &current,
        )?;
        let target = read_official_source_version_for_rollback(
            connection,
            &source_key,
            input.review.target_version_id,
        )?;
        if target.url != input.review.target_url
            || target.source_id != current.source_id
            || target.source_role != current.source_role
        {
            return Err("ER4_ROLLBACK_TARGET_CHANGED".to_string());
        }
        let landing = landing_page_for_source(&source_key, &authority)?.to_string();
        Ok((current, landing))
    })?
    .ok_or_else(|| "Open a database before applying source rollback.".to_string())?;

    let (current, landing_page_url) = preflight;
    let source_id = current
        .source_id
        .clone()
        .ok_or_else(|| "ER4_ROLLBACK_NOT_ELIGIBLE".to_string())?;
    let source_role = current
        .source_role
        .clone()
        .ok_or_else(|| "ER4_ROLLBACK_NOT_ELIGIBLE".to_string())?;
    let configured_url = current.current_url.clone();
    let target_url = input.review.target_url.clone();
    let fresh = tauri::async_runtime::spawn_blocking(move || {
        revalidate_nse_candidate_for_er4(
            &source_id,
            &source_role,
            &configured_url,
            &landing_page_url,
            &target_url,
        )
    })
    .await
    .map_err(|error| error.to_string())??;
    if fresh.classification != ER3B_CLASS_VALIDATED {
        return Err("ER4_ROLLBACK_TARGET_REVALIDATION_FAILED".to_string());
    }
    let target_validation_sha256 = compute_rollback_target_validation_sha256(
        &source_key,
        &input.review.current_url,
        &fresh,
    )?;
    if target_validation_sha256 != input.review.target_validation_sha256 {
        return Err("ER4_REVALIDATION_MISMATCH".to_string());
    }
    let target_content_sha256 = fresh
        .content_sha256
        .clone()
        .ok_or_else(|| "ER4_REVALIDATION_MISMATCH".to_string())?;
    let evidence = RollbackRevalidationEvidence {
        target_content_sha256,
        target_validation_sha256,
    };

    let review = input.review.clone();
    let operator_note = input.operator_note.clone();
    let committed = with_active_connection(&app, |connection| {
        apply_official_source_rollback_internal(
            connection,
            &review,
            &evidence,
            operator_note.as_deref(),
            None,
        )
    })?
    .ok_or_else(|| "Open a database before applying source rollback.".to_string())?;

    let health_urls = committed.authority.urls.clone();
    let health_result = tauri::async_runtime::spawn_blocking(move || {
        assess_official_source_health_for_urls(&health_urls)
    })
    .await
    .map_err(|error| error.to_string())?;
    let affected_er1_source = er1_source_for_er4_source_key(&source_key)?;
    let (result_status, post_health_report, report_json) = match health_result {
        Ok(report) => {
            let healthy = report
                .results
                .iter()
                .find(|result| result.source_id == affected_er1_source)
                .map(er1_health_result_is_healthy)
                .unwrap_or(false);
            let status = if healthy {
                "ROLLBACK_HEALTHY"
            } else {
                "ROLLBACK_HEALTH_CHECK_FAILED"
            };
            let json = serde_json::to_string(&report).map_err(|error| error.to_string())?;
            (status.to_string(), Some(report), Some(json))
        }
        Err(_) => (
            "ROLLBACK_HEALTH_CHECK_FAILED".to_string(),
            None,
            None,
        ),
    };

    with_active_connection(&app, |connection| {
        update_review_event_post_health_internal(
            connection,
            committed.review_event_id,
            &committed.authority.configuration_fingerprint,
            report_json.as_deref(),
            &result_status,
        )
    })?
    .ok_or_else(|| "Open a database before recording post-rollback health.".to_string())?;

    Ok(OfficialSourceRollbackResult {
        result_status,
        result_version_id: committed.result_version_id,
        authority: committed.authority,
        post_health_report,
    })
}

#[tauri::command]
pub async fn retry_official_source_post_health(
    app: AppHandle,
    input: RetryOfficialSourcePostHealthInput,
) -> AppResult<OfficialSourcePostHealthResult> {
    let source_key = input.source_key.clone();
    let context = with_active_connection(&app, |connection| {
        read_post_health_retry_context(connection, &source_key, input.result_version_id)
    })?
    .ok_or_else(|| "Open a database before retrying source health.".to_string())?;

    let health_urls = context.authority.urls.clone();
    let health_result = tauri::async_runtime::spawn_blocking(move || {
        assess_official_source_health_for_urls(&health_urls)
    })
    .await
    .map_err(|error| error.to_string())?;
    let affected_er1_source = er1_source_for_er4_source_key(&source_key)?;
    let healthy = health_result
        .as_ref()
        .ok()
        .and_then(|report| {
            report
                .results
                .iter()
                .find(|result| result.source_id == affected_er1_source)
        })
        .map(er1_health_result_is_healthy)
        .unwrap_or(false);
    let result_status = match context.decision.as_str() {
        "APPROVE_PROMOTION" => {
            if healthy { "PROMOTED_HEALTHY" } else { "PROMOTED_HEALTH_CHECK_FAILED" }
        }
        "ROLLBACK_APPROVED" => {
            if healthy { "ROLLBACK_HEALTHY" } else { "ROLLBACK_HEALTH_CHECK_FAILED" }
        }
        _ => return Err("ER4_POST_HEALTH_RETRY_NOT_ALLOWED".to_string()),
    }
    .to_string();
    let report_json = match health_result.as_ref() {
        Ok(report) => Some(serde_json::to_string(report).map_err(|error| error.to_string())?),
        Err(_) => None,
    };

    with_active_connection(&app, |connection| {
        let refreshed = read_post_health_retry_context(
            connection,
            &source_key,
            context.result_version_id,
        )?;
        if refreshed.authority.configuration_fingerprint
            != context.authority.configuration_fingerprint
            || refreshed.review_event_id != context.review_event_id
        {
            return Err("ER4_STALE_REJECTED".to_string());
        }
        update_review_event_post_health_internal(
            connection,
            context.review_event_id,
            &context.authority.configuration_fingerprint,
            report_json.as_deref(),
            &result_status,
        )
    })?
    .ok_or_else(|| "Open a database before recording retried source health.".to_string())?;

    Ok(OfficialSourcePostHealthResult {
        result_status,
        result_version_id: context.result_version_id,
        post_health_report: health_result.ok(),
    })
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OfficialSourceCandidateDecision {
    KeepCurrent,
    RejectCandidate,
}

impl OfficialSourceCandidateDecision {
    fn as_str(&self) -> &'static str {
        match self {
            Self::KeepCurrent => "KEEP_CURRENT",
            Self::RejectCandidate => "REJECT_CANDIDATE",
        }
    }
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordOfficialSourceCandidateDecisionInput {
    pub review: OfficialSourceCandidateReviewPlan,
    pub decision: OfficialSourceCandidateDecision,
    pub operator_note: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceCandidateDecisionResult {
    pub success: bool,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListOfficialSourceHistoryInput {
    pub source_key: String,
}

#[tauri::command]
pub fn record_official_source_candidate_decision(
    app: AppHandle,
    input: RecordOfficialSourceCandidateDecisionInput,
) -> AppResult<OfficialSourceCandidateDecisionResult> {
    let decision = input.decision.as_str().to_string();
    let note = input.operator_note.clone();
    with_active_connection(&app, |connection| {
        record_candidate_decision_internal(
            connection,
            &input.review,
            &decision,
            note.as_deref(),
        )?;
        Ok(OfficialSourceCandidateDecisionResult { success: true })
    })?
    .ok_or_else(|| "Open a database before recording source candidate decisions.".to_string())
}

#[tauri::command]
pub fn list_official_source_history(
    app: AppHandle,
    input: ListOfficialSourceHistoryInput,
) -> AppResult<Vec<OfficialSourceHistoryEntry>> {
    with_active_connection(&app, |connection| {
        list_official_source_history_internal(connection, &input.source_key)
    })?
    .ok_or_else(|| "Open a database before reading official source history.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn er4a_registry_contains_exactly_nine_unique_source_keys() {
        assert_eq!(ER4_SOURCE_REGISTRY.len(), 9);
        let keys = ER4_SOURCE_REGISTRY
            .iter()
            .map(|entry| entry.source_key)
            .collect::<std::collections::BTreeSet<_>>();
        assert_eq!(keys.len(), 9);
    }

    #[test]
    fn er4a_registry_has_exactly_five_candidate_promotion_sources() {
        let promotable = ER4_SOURCE_REGISTRY
            .iter()
            .filter(|entry| entry.candidate_promotion_eligible)
            .map(|entry| entry.source_key)
            .collect::<Vec<_>>();
        assert_eq!(
            promotable,
            vec![
                "NSE_CURRENT_EQUITY_MASTER",
                "NSE_CURRENT_SME_MASTER",
                "NSE_SYMBOL_CHANGE_HISTORY",
                "NSE_COMPANY_NAME_CHANGE_HISTORY",
                "NSE_DELISTED_COMPANIES_WORKBOOK",
            ]
        );
    }

    #[test]
    fn er4a_bse_and_landing_entries_are_manual_only() {
        for key in [
            "NSE_SECURITIES_AVAILABLE_PAGE",
            "NSE_DELISTED_PAGE",
            "BSE_LIST_SCRIPS_URL_PREFIX",
            "BSE_LIST_SCRIPS_REFERER",
        ] {
            let entry = ER4_SOURCE_REGISTRY
                .iter()
                .find(|entry| entry.source_key == key)
                .unwrap();
            assert!(!entry.candidate_promotion_eligible);
        }
    }
}


#[cfg(test)]
mod fingerprint_tests {
    use super::*;

    fn fixture_configuration_authority_rows() -> Vec<Er4CurrentSourceAuthority> {
        ER4_SOURCE_REGISTRY
            .iter()
            .enumerate()
            .map(|(index, entry)| Er4CurrentSourceAuthority {
                source_key: entry.source_key.to_string(),
                exchange: entry.exchange.to_string(),
                source_id: entry.source_id.map(str::to_string),
                source_role: entry.source_role.map(str::to_string),
                config_field: entry.config_field.to_string(),
                candidate_promotion_eligible: entry.candidate_promotion_eligible,
                current_version_id: (index + 1) as i64,
                revision: 1,
                current_url: format!("https://authority.example/{index}"),
            })
            .collect()
    }

    fn validation_projection<'a>(candidate_sha: &'a str) -> Er4ValidationProjection<'a> {
        Er4ValidationProjection {
            source_key: "NSE_CURRENT_EQUITY_MASTER",
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "CURRENT_IDENTITY_MASTER",
            current_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
            candidate_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv",
            candidate_final_url: Some(
                "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv",
            ),
            candidate_content_sha256: Some(candidate_sha),
            classification: "VALIDATED_CANDIDATE_NOT_PROMOTED",
            discovery_reason: "SOURCE_ROLE_MATCH",
            http_status: Some(200),
            content_type: Some("text/csv"),
            response_bytes: Some(1234),
            parser_status: "PASS",
            schema_status: "PASS",
            population_status: "PASS",
            population_count: Some(2000),
            freshness_status: "NOT_APPLICABLE",
            validation_reason: "ER3B_SOURCE_CONTRACT_VALIDATED",
        }
    }

    #[test]
    fn er4a_configuration_fingerprint_is_registry_ordered_and_content_sensitive() {
        let mut a = fixture_configuration_authority_rows();
        let mut b = a.clone();
        b.reverse();

        assert_eq!(
            compute_er4_configuration_fingerprint(&a).unwrap(),
            compute_er4_configuration_fingerprint(&b).unwrap()
        );

        a[1].revision += 1;
        assert_ne!(
            compute_er4_configuration_fingerprint(&a).unwrap(),
            compute_er4_configuration_fingerprint(&b).unwrap()
        );
    }

    #[test]
    fn er4a_configuration_fingerprint_rejects_missing_duplicate_and_unknown_sources() {
        let mut missing = fixture_configuration_authority_rows();
        missing.pop();
        assert_eq!(
            compute_er4_configuration_fingerprint(&missing).unwrap_err(),
            "ER4_CONFIGURATION_AUTHORITY_INVALID"
        );

        let mut duplicate = fixture_configuration_authority_rows();
        duplicate[8] = duplicate[0].clone();
        assert_eq!(
            compute_er4_configuration_fingerprint(&duplicate).unwrap_err(),
            "ER4_CONFIGURATION_AUTHORITY_INVALID"
        );

        let mut unknown = fixture_configuration_authority_rows();
        unknown[0].source_key = "UNKNOWN_SOURCE".to_string();
        assert_eq!(
            compute_er4_configuration_fingerprint(&unknown).unwrap_err(),
            "ER4_CONFIGURATION_AUTHORITY_INVALID"
        );
    }

    #[test]
    fn er4a_validation_report_fingerprint_is_deterministic_and_content_sensitive() {
        let first = validation_projection("AAAABBBB");
        let second = validation_projection("AAAABBBB");
        let changed = validation_projection("CCCCDDDD");

        assert_eq!(
            compute_er4_validation_report_sha256(&first).unwrap(),
            compute_er4_validation_report_sha256(&second).unwrap()
        );
        assert_ne!(
            compute_er4_validation_report_sha256(&first).unwrap(),
            compute_er4_validation_report_sha256(&changed).unwrap()
        );
    }

    #[test]
    fn er4a_review_fingerprint_is_deterministic_and_content_sensitive() {
        let first = Er4ReviewFingerprintInput {
            source_key: "NSE_CURRENT_EQUITY_MASTER",
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "CURRENT_IDENTITY_MASTER",
            base_version_id: 7,
            base_revision: 3,
            current_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
            candidate_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv",
            candidate_final_url: Some(
                "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv",
            ),
            candidate_content_sha256: Some("AAAABBBB"),
            classification: "VALIDATED_CANDIDATE_NOT_PROMOTED",
            validation_report_sha256: "REPORTA",
        };
        let same = first;
        let changed = Er4ReviewFingerprintInput {
            candidate_content_sha256: Some("CCCCDDDD"),
            ..first
        };

        assert_eq!(
            compute_er4_review_fingerprint(&first).unwrap(),
            compute_er4_review_fingerprint(&same).unwrap()
        );
        assert_ne!(
            compute_er4_review_fingerprint(&first).unwrap(),
            compute_er4_review_fingerprint(&changed).unwrap()
        );
    }
}


#[cfg(test)]
mod review_tests {
    use super::*;
    use crate::database::official_source_candidate_validation::Er3bCandidateValidationResult;

    fn base_authority(source_key: &str) -> Er4CurrentSourceAuthority {
        let entry = ER4_SOURCE_REGISTRY
            .iter()
            .find(|entry| entry.source_key == source_key)
            .unwrap();
        Er4CurrentSourceAuthority {
            source_key: entry.source_key.to_string(),
            exchange: entry.exchange.to_string(),
            source_id: entry.source_id.map(str::to_string),
            source_role: entry.source_role.map(str::to_string),
            config_field: entry.config_field.to_string(),
            candidate_promotion_eligible: entry.candidate_promotion_eligible,
            current_version_id: 7,
            revision: 3,
            current_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv".to_string(),
        }
    }

    fn candidate(classification: &str) -> Er3bCandidateValidationResult {
        Er3bCandidateValidationResult {
            source_id: "NSE_CURRENT_EQUITY_MASTER".to_string(),
            source_role: "CURRENT_IDENTITY_MASTER".to_string(),
            configured_url:
                "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv".to_string(),
            landing_page_url:
                "https://www.nseindia.com/static/market-data/securities-available-for-trading"
                    .to_string(),
            candidate_url:
                "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv".to_string(),
            discovery_reason: "SOURCE_ROLE_MATCH".to_string(),
            request_url:
                "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv".to_string(),
            final_url: Some(
                "https://nsearchives.nseindia.com/content/equities/EQUITY_NEW.csv".to_string(),
            ),
            http_status: Some(200),
            content_type: Some("text/csv".to_string()),
            response_bytes: Some(1234),
            content_sha256: Some("ABCDEF0123456789".to_string()),
            parser_status: "PASS".to_string(),
            schema_status: "PASS".to_string(),
            population_status: "PASS".to_string(),
            population_count: Some(2000),
            freshness_status: "NOT_APPLICABLE".to_string(),
            validation_reason: "ER3B_SOURCE_CONTRACT_VALIDATED".to_string(),
            classification: classification.to_string(),
        }
    }

    #[test]
    fn er4a_review_plan_maps_frozen_er3b_contract_and_only_validated_is_promotable() {
        let base = base_authority("NSE_CURRENT_EQUITY_MASTER");
        let validated =
            build_er4_candidate_review_plan(&base, &candidate("VALIDATED_CANDIDATE_NOT_PROMOTED"))
                .unwrap();
        let indeterminate =
            build_er4_candidate_review_plan(&base, &candidate("INDETERMINATE_CANDIDATE"))
                .unwrap();
        let rejected =
            build_er4_candidate_review_plan(&base, &candidate("REJECTED_CANDIDATE")).unwrap();

        assert_eq!(validated.source_id, "NSE_CURRENT_EQUITY_MASTER");
        assert_eq!(validated.source_role, "CURRENT_IDENTITY_MASTER");
        assert!(validated.promotable);
        assert!(!indeterminate.promotable);
        assert!(!rejected.promotable);
        assert!(!validated.validation_report_sha256.is_empty());
        assert!(!validated.review_fingerprint.is_empty());
    }

    #[test]
    fn er4a_review_plan_rejects_manual_only_or_mismatched_candidate_authority() {
        let manual = base_authority("BSE_LIST_SCRIPS_URL_PREFIX");
        assert_eq!(
            build_er4_candidate_review_plan(
                &manual,
                &candidate("VALIDATED_CANDIDATE_NOT_PROMOTED")
            )
            .unwrap_err(),
            "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE"
        );

        let base = base_authority("NSE_CURRENT_EQUITY_MASTER");
        let mut mismatch = candidate("VALIDATED_CANDIDATE_NOT_PROMOTED");
        mismatch.source_role = "WRONG_ROLE".to_string();
        assert_eq!(
            build_er4_candidate_review_plan(&base, &mismatch).unwrap_err(),
            "ER4_CANDIDATE_AUTHORITY_MISMATCH"
        );

        let mut url_mismatch = candidate("VALIDATED_CANDIDATE_NOT_PROMOTED");
        url_mismatch.configured_url = "https://nsearchives.nseindia.com/other.csv".to_string();
        assert_eq!(
            build_er4_candidate_review_plan(&base, &url_mismatch).unwrap_err(),
            "ER4_CANDIDATE_BASE_URL_MISMATCH"
        );
    }

    #[test]
    fn er4a_review_plan_rejects_unknown_classification_and_malformed_validated_hash() {
        let base = base_authority("NSE_CURRENT_EQUITY_MASTER");
        assert_eq!(
            build_er4_candidate_review_plan(&base, &candidate("UNSUPPORTED_CLASS"))
                .unwrap_err(),
            "ER4_CANDIDATE_CLASSIFICATION_UNSUPPORTED"
        );

        let mut missing_sha = candidate("VALIDATED_CANDIDATE_NOT_PROMOTED");
        missing_sha.content_sha256 = None;
        assert_eq!(
            build_er4_candidate_review_plan(&base, &missing_sha).unwrap_err(),
            "ER4_VALIDATED_CANDIDATE_MISSING_SHA256"
        );
    }

    #[test]
    fn er4a_review_plan_serialization_contains_no_raw_body_field() {
        let base = base_authority("NSE_CURRENT_EQUITY_MASTER");
        let plan =
            build_er4_candidate_review_plan(&base, &candidate("VALIDATED_CANDIDATE_NOT_PROMOTED"))
                .unwrap();
        let value = serde_json::to_value(plan).unwrap();
        let object = value.as_object().unwrap();
        assert!(!object.contains_key("body"));
        assert!(!object.contains_key("rawBody"));
        assert!(!object.contains_key("responseBody"));
    }

    #[test]
    fn er4a_review_base_stale_version_revision_or_url_rejects() {
        let actual = base_authority("NSE_CURRENT_EQUITY_MASTER");
        assert!(verify_er4_review_base(7, 3, &actual.current_url, &actual).is_ok());

        assert_eq!(
            verify_er4_review_base(8, 3, &actual.current_url, &actual).unwrap_err(),
            "ER4_STALE_REJECTED"
        );
        assert_eq!(
            verify_er4_review_base(7, 4, &actual.current_url, &actual).unwrap_err(),
            "ER4_STALE_REJECTED"
        );
        assert_eq!(
            verify_er4_review_base(7, 3, "https://example.invalid/stale.csv", &actual)
                .unwrap_err(),
            "ER4_STALE_REJECTED"
        );
    }
}


#[cfg(test)]
mod er4c_candidate_tests {
    use super::*;
    use rusqlite::Connection;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                PRAGMA foreign_keys = ON;
                CREATE TABLE settings (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ",
            )
            .unwrap();
        super::super::official_source_version_history::ensure_official_source_baseline(&connection)
            .unwrap();
        connection
    }

    fn candidate_for(base: &Er4CurrentSourceAuthority) -> Er3bCandidateValidationResult {
        Er3bCandidateValidationResult {
            source_id: base.source_id.clone().unwrap(),
            source_role: base.source_role.clone().unwrap(),
            configured_url: base.current_url.clone(),
            landing_page_url: "https://www.nseindia.com/static/market-data/securities-available-for-trading".to_string(),
            candidate_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv".to_string(),
            discovery_reason: "SOURCE_ROLE_MATCH".to_string(),
            request_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv".to_string(),
            final_url: Some("https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv".to_string()),
            http_status: Some(200),
            content_type: Some("text/csv".to_string()),
            response_bytes: Some(1024),
            content_sha256: Some("ABCDEF0123456789".to_string()),
            parser_status: "PASS".to_string(),
            schema_status: "PASS".to_string(),
            population_status: "PASS".to_string(),
            population_count: Some(2000),
            freshness_status: "NOT_APPLICABLE".to_string(),
            validation_reason: "ER3B_SOURCE_CONTRACT_VALIDATED".to_string(),
            classification: ER3B_CLASS_VALIDATED.to_string(),
        }
    }

    #[test]
    fn er4c_candidate_eligibility_rejects_healthy_bse_and_landing_sources_before_recovery() {
        assert!(validate_er4_recovery_trigger("HEALTHY").is_err());
        for source_key in [
            "NSE_SECURITIES_AVAILABLE_PAGE",
            "NSE_DELISTED_PAGE",
            "BSE_LIST_SCRIPS_URL_PREFIX",
            "BSE_LIST_SCRIPS_REFERER",
        ] {
            assert!(er1_source_for_er4_source_key(source_key).is_err());
        }
    }

    #[test]
    fn er4c_candidate_source_mapping_is_exact_for_five_nse_contracts() {
        assert_eq!(
            er1_source_for_er4_source_key("NSE_CURRENT_EQUITY_MASTER").unwrap(),
            "NSE_EQUITY_MASTER"
        );
        assert_eq!(
            er1_source_for_er4_source_key("NSE_CURRENT_SME_MASTER").unwrap(),
            "NSE_SME_MASTER"
        );
        assert_eq!(
            er1_source_for_er4_source_key("NSE_SYMBOL_CHANGE_HISTORY").unwrap(),
            "NSE_SYMBOL_CHANGE"
        );
        assert_eq!(
            er1_source_for_er4_source_key("NSE_COMPANY_NAME_CHANGE_HISTORY").unwrap(),
            "NSE_COMPANY_NAME_CHANGE"
        );
        assert_eq!(
            er1_source_for_er4_source_key("NSE_DELISTED_COMPANIES_WORKBOOK").unwrap(),
            "NSE_DELISTED_WORKBOOK"
        );
    }

    #[test]
    fn er4c_recovery_report_converts_to_review_plan_without_raw_body() {
        let connection = test_connection();
        let authority =
            read_official_source_configuration_authority(&connection).unwrap();
        let base =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let candidate = candidate_for(&base);
        let report = Er3bRecoveryReport {
            er1_source_id: "NSE_EQUITY_MASTER".to_string(),
            trigger_category: "TRANSPORT_FAILURE".to_string(),
            source_id: candidate.source_id.clone(),
            source_role: candidate.source_role.clone(),
            configured_url: base.current_url.clone(),
            landing_page_url: candidate.landing_page_url.clone(),
            discovery_candidate_count: 1,
            discovery_rejection_count: 2,
            candidate_results: vec![candidate],
        };

        let result = build_replacement_candidates_result(authority, &base, report).unwrap();
        assert_eq!(result.candidates.len(), 1);
        assert_eq!(result.discovery_rejection_count, 2);
        assert!(result.candidates[0].promotable);
        validate_er4_candidate_review_plan_integrity(&result.candidates[0]).unwrap();
        let json = serde_json::to_string(&result.candidates[0]).unwrap();
        assert!(!json.to_ascii_lowercase().contains("body"));
    }

    #[test]
    fn er4c_review_integrity_rejects_tampered_validation_or_fingerprint() {
        let connection = test_connection();
        let base =
            read_er4_current_source_authority(&connection, "NSE_CURRENT_EQUITY_MASTER").unwrap();
        let mut review = build_er4_candidate_review_plan(&base, &candidate_for(&base)).unwrap();
        review.validation_report_sha256 = "TAMPERED".to_string();
        assert_eq!(
            validate_er4_candidate_review_plan_integrity(&review).unwrap_err(),
            "ER4_REVIEW_PLAN_INVALID"
        );

        let mut review = build_er4_candidate_review_plan(&base, &candidate_for(&base)).unwrap();
        review.review_fingerprint = "TAMPERED".to_string();
        assert_eq!(
            validate_er4_candidate_review_plan_integrity(&review).unwrap_err(),
            "ER4_REVIEW_PLAN_INVALID"
        );
    }
}

#[cfg(test)]
mod er4e_review_tests {
    use super::*;

    #[test]
    fn er4e_rollback_review_rejects_bse_and_manual_only_sources() {
        let review = OfficialSourceRollbackReview {
            schema_version: ER4_REVIEW_SCHEMA_VERSION,
            source_key: "BSE_LIST_SCRIPS_URL_PREFIX".to_string(),
            current_version_id: 10,
            current_revision: 2,
            current_url: "https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?Group=&Scripcode=&segment=Equity&status=".to_string(),
            target_version_id: 9,
            target_url: "https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?Group=&Scripcode=&segment=Equity&status=".to_string(),
            target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            rollback_fingerprint: "IGNORED_FOR_INELIGIBLE_SOURCE".to_string(),
        };
        assert_eq!(
            validate_official_source_rollback_review_integrity(&review).unwrap_err(),
            "ER4_ROLLBACK_NOT_ELIGIBLE"
        );
    }

    #[test]
    fn er4e_rollback_review_fingerprint_is_tamper_evident() {
        let review = OfficialSourceRollbackReview {
            schema_version: ER4_REVIEW_SCHEMA_VERSION,
            source_key: "NSE_CURRENT_EQUITY_MASTER".to_string(),
            current_version_id: 10,
            current_revision: 2,
            current_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_ALT.csv".to_string(),
            target_version_id: 9,
            target_url: "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv".to_string(),
            target_validation_sha256: "TARGET_VALIDATION_SHA".to_string(),
            rollback_fingerprint: "TAMPERED".to_string(),
        };
        assert_eq!(
            validate_official_source_rollback_review_integrity(&review).unwrap_err(),
            "ER4_ROLLBACK_REVIEW_INVALID"
        );
    }
}


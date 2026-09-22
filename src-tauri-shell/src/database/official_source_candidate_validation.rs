use reqwest::blocking::{Client, Response};
use reqwest::header::{ACCEPT, CONTENT_TYPE, REFERER, USER_AGENT};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::cmp::min;
use std::io::Read;
use std::time::Duration;

use super::nse_identity_imports::{
    validate_nse_company_name_change_bytes_for_health,
    validate_nse_current_population_for_health, validate_nse_delisted_workbook_bytes_for_health,
    validate_nse_equity_master_bytes_for_health, validate_nse_sme_master_bytes_for_health,
    validate_nse_symbol_change_bytes_for_health, NSE_USER_AGENT,
};
use super::official_source_discovery::{
    discover_nse_official_source_candidates, NseDiscoveryContract,
    NseOfficialSourceDiscoveryCandidate, NseOfficialSourceDiscoveryRequest,
};
use super::official_source_urls::{
    nse_official_redirect_policy, validate_nse_official_source_url,
};

pub(crate) const ER3B_CLASS_VALIDATED: &str = "VALIDATED_CANDIDATE_NOT_PROMOTED";
pub(crate) const ER3B_CLASS_INDETERMINATE: &str = "INDETERMINATE_CANDIDATE";
pub(crate) const ER3B_CLASS_REJECTED: &str = "REJECTED_CANDIDATE";
const PASS: &str = "PASS";
const FAIL: &str = "FAIL";
const NOT_EVALUATED: &str = "NOT_EVALUATED";
const NOT_APPLICABLE: &str = "NOT_APPLICABLE";
const ER3B_MAX_LANDING_BYTES: usize = 4 * 1024 * 1024;
const ER3B_MAX_CANDIDATE_BYTES: usize = 32 * 1024 * 1024;
const ER3B_MAX_TOTAL_CANDIDATE_BYTES: usize = 64 * 1024 * 1024;
const ER3B_MAX_CANDIDATES: usize = 5;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Er3bMappedSource {
    pub er1_source_id: &'static str,
    pub contract: NseDiscoveryContract,
    pub landing_failure_context: bool,
}

impl Er3bMappedSource {
    fn source_id(&self) -> &'static str {
        self.contract.source_id()
    }

    fn source_role(&self) -> &'static str {
        self.contract.source_role()
    }
}

#[derive(Clone, Debug)]
pub(crate) struct Er3bRecoveryRequest<'a> {
    pub er1_source_id: &'a str,
    pub trigger_category: &'a str,
    pub configured_url: &'a str,
    pub landing_page_url: &'a str,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Er3bCandidateValidationResult {
    pub source_id: String,
    pub source_role: String,
    pub configured_url: String,
    pub landing_page_url: String,
    pub candidate_url: String,
    pub discovery_reason: String,
    pub request_url: String,
    pub final_url: Option<String>,
    pub http_status: Option<u16>,
    pub content_type: Option<String>,
    pub response_bytes: Option<u64>,
    pub content_sha256: Option<String>,
    pub parser_status: String,
    pub schema_status: String,
    pub population_status: String,
    pub population_count: Option<u32>,
    pub freshness_status: String,
    pub validation_reason: String,
    pub classification: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Er3bRecoveryReport {
    pub er1_source_id: String,
    pub trigger_category: String,
    pub source_id: String,
    pub source_role: String,
    pub configured_url: String,
    pub landing_page_url: String,
    pub discovery_candidate_count: u32,
    pub discovery_rejection_count: u32,
    pub candidate_results: Vec<Er3bCandidateValidationResult>,
}

#[derive(Clone, Debug)]
struct Er3bFetchedResponse {
    request_url: String,
    final_url: String,
    http_status: u16,
    content_type: Option<String>,
    body: Vec<u8>,
}

#[derive(Clone, Debug)]
struct Er3bTransportFailure {
    request_url: String,
    final_url: Option<String>,
    http_status: Option<u16>,
    content_type: Option<String>,
    reason: String,
}

trait Er3bTransport {
    fn get(
        &self,
        request_url: &str,
        accept: &str,
        referer: Option<&str>,
        max_body_bytes: usize,
    ) -> Result<Er3bFetchedResponse, Er3bTransportFailure>;
}

struct ReqwestNseEr3bTransport {
    client: Client,
}

impl ReqwestNseEr3bTransport {
    fn new() -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(45))
            .cookie_store(true)
            .redirect(nse_official_redirect_policy())
            .build()
            .map_err(|error| format!("ER3B_CLIENT_CREATE_FAILED: {error}"))?;
        Ok(Self { client })
    }
}

impl Er3bTransport for ReqwestNseEr3bTransport {
    fn get(
        &self,
        request_url: &str,
        accept: &str,
        referer: Option<&str>,
        max_body_bytes: usize,
    ) -> Result<Er3bFetchedResponse, Er3bTransportFailure> {
        validate_nse_official_source_url(request_url).map_err(|reason| Er3bTransportFailure {
            request_url: request_url.to_string(),
            final_url: None,
            http_status: None,
            content_type: None,
            reason,
        })?;
        if let Some(referer_url) = referer {
            validate_nse_official_source_url(referer_url).map_err(|reason| Er3bTransportFailure {
                request_url: request_url.to_string(),
                final_url: None,
                http_status: None,
                content_type: None,
                reason: format!("ER3B_REFERER_PROVENANCE_REJECTED: {reason}"),
            })?;
        }

        let mut request = self
            .client
            .get(request_url)
            .header(ACCEPT, accept)
            .header(USER_AGENT, NSE_USER_AGENT);
        if let Some(referer_url) = referer {
            request = request.header(REFERER, referer_url);
        }

        let response = request.send().map_err(|error| Er3bTransportFailure {
            request_url: request_url.to_string(),
            final_url: None,
            http_status: None,
            content_type: None,
            reason: format!("ER3B_TRANSPORT_FAILURE: {error}"),
        })?;
        response_to_bounded_fetch(response, request_url, max_body_bytes)
    }
}

pub(crate) fn map_er1_source_to_er3_contract(
    er1_source_id: &str,
) -> Result<Er3bMappedSource, String> {
    let (source_id, landing_failure_context) = match er1_source_id {
        "NSE_EQUITY_MASTER" => ("NSE_CURRENT_EQUITY_MASTER", false),
        "NSE_SME_MASTER" => ("NSE_CURRENT_SME_MASTER", false),
        "NSE_SYMBOL_CHANGE" => ("NSE_SYMBOL_CHANGE_HISTORY", false),
        "NSE_COMPANY_NAME_CHANGE" => ("NSE_COMPANY_NAME_CHANGE_HISTORY", false),
        "NSE_DELISTED_WORKBOOK" => ("NSE_DELISTED_COMPANIES_WORKBOOK", false),
        "NSE_DELISTED_LANDING" => ("NSE_DELISTED_COMPANIES_WORKBOOK", true),
        _ => {
            return Err(format!(
                "ER3B_NOT_ELIGIBLE_FOR_ER3B: ER1 source '{er1_source_id}' is not eligible for NSE ER3-B."
            ));
        }
    };
    Ok(Er3bMappedSource {
        er1_source_id: match er1_source_id {
            "NSE_EQUITY_MASTER" => "NSE_EQUITY_MASTER",
            "NSE_SME_MASTER" => "NSE_SME_MASTER",
            "NSE_SYMBOL_CHANGE" => "NSE_SYMBOL_CHANGE",
            "NSE_COMPANY_NAME_CHANGE" => "NSE_COMPANY_NAME_CHANGE",
            "NSE_DELISTED_WORKBOOK" => "NSE_DELISTED_WORKBOOK",
            "NSE_DELISTED_LANDING" => "NSE_DELISTED_LANDING",
            _ => unreachable!(),
        },
        contract: NseDiscoveryContract::from_source_id(source_id)?,
        landing_failure_context,
    })
}

fn validate_trigger_category(value: &str) -> Result<(), String> {
    match value {
        "PROVENANCE_FAILURE"
        | "TRANSPORT_FAILURE"
        | "HTTP_FAILURE"
        | "FORMAT_OR_SCHEMA_FAILURE"
        | "POPULATION_FAILURE"
        | "SEMANTIC_FAILURE" => Ok(()),
        _ => Err(format!(
            "ER3B_TRIGGER_NOT_ELIGIBLE: trigger category '{value}' cannot start recovery."
        )),
    }
}

fn is_xlsx_contract(contract: NseDiscoveryContract) -> bool {
    matches!(contract, NseDiscoveryContract::DelistedCompaniesWorkbook)
}

fn accept_header(contract: NseDiscoveryContract) -> &'static str {
    if is_xlsx_contract(contract) {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*";
    }
    "text/csv,application/csv,text/plain,application/octet-stream,*/*"
}

fn normalize_content_type(value: Option<&str>) -> Option<String> {
    value
        .map(|raw| raw.split(';').next().unwrap_or_default().trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
}

fn content_type_compatible(contract: NseDiscoveryContract, content_type: &str) -> bool {
    if is_xlsx_contract(contract) {
        return matches!(
            content_type,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                | "application/octet-stream"
        );
    }
    matches!(
        content_type,
        "text/csv" | "application/csv" | "text/plain" | "application/octet-stream"
    )
}

fn sha256_upper_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}

fn validate_source_bytes(
    contract: NseDiscoveryContract,
    bytes: &[u8],
    source_label: &str,
) -> Result<usize, String> {
    let count = match contract {
        NseDiscoveryContract::CurrentEquityMaster => {
            let count = validate_nse_equity_master_bytes_for_health(bytes, source_label)?;
            validate_nse_current_population_for_health(count)?;
            count
        }
        NseDiscoveryContract::CurrentSmeMaster => {
            validate_nse_sme_master_bytes_for_health(bytes, source_label)?
        }
        NseDiscoveryContract::SymbolChangeHistory => {
            validate_nse_symbol_change_bytes_for_health(bytes, source_label)?
        }
        NseDiscoveryContract::CompanyNameChangeHistory => {
            validate_nse_company_name_change_bytes_for_health(bytes, source_label)?
        }
        NseDiscoveryContract::DelistedCompaniesWorkbook => {
            validate_nse_delisted_workbook_bytes_for_health(bytes)?
        }
    };
    if count == 0 {
        return Err(format!(
            "ER3B_SOURCE_POPULATION_REJECTED: {} returned zero supported rows.",
            contract.source_id()
        ));
    }
    Ok(count)
}

fn base_result(
    mapped: &Er3bMappedSource,
    configured_url: &str,
    landing_page_url: &str,
    candidate: &NseOfficialSourceDiscoveryCandidate,
) -> Er3bCandidateValidationResult {
    Er3bCandidateValidationResult {
        source_id: mapped.source_id().to_string(),
        source_role: mapped.source_role().to_string(),
        configured_url: configured_url.to_string(),
        landing_page_url: landing_page_url.to_string(),
        candidate_url: candidate.url.clone(),
        discovery_reason: candidate.reason.clone(),
        request_url: candidate.url.clone(),
        final_url: None,
        http_status: None,
        content_type: None,
        response_bytes: None,
        content_sha256: None,
        parser_status: NOT_EVALUATED.to_string(),
        schema_status: NOT_EVALUATED.to_string(),
        population_status: NOT_EVALUATED.to_string(),
        population_count: None,
        freshness_status: NOT_APPLICABLE.to_string(),
        validation_reason: String::new(),
        classification: ER3B_CLASS_REJECTED.to_string(),
    }
}

fn validate_candidate_response(
    mapped: &Er3bMappedSource,
    configured_url: &str,
    landing_page_url: &str,
    candidate: &NseOfficialSourceDiscoveryCandidate,
    fetch: &Er3bFetchedResponse,
) -> Er3bCandidateValidationResult {
    let mut result = base_result(mapped, configured_url, landing_page_url, candidate);
    result.request_url = fetch.request_url.clone();
    result.final_url = Some(fetch.final_url.clone());
    result.http_status = Some(fetch.http_status);
    result.content_type = normalize_content_type(fetch.content_type.as_deref());

    if let Err(error) = validate_nse_official_source_url(&fetch.final_url) {
        result.validation_reason = format!("ER3B_FINAL_URL_PROVENANCE_REJECTED: {error}");
        return result;
    }
    if !(200..300).contains(&fetch.http_status) {
        result.validation_reason = format!("ER3B_HTTP_FAILURE: status {}.", fetch.http_status);
        return result;
    }

    result.response_bytes = Some(fetch.body.len() as u64);
    result.content_sha256 = Some(sha256_upper_hex(&fetch.body));
    let content_type_missing = result.content_type.is_none();
    if let Some(content_type) = result.content_type.as_deref() {
        if content_type == "text/html" || content_type == "application/xhtml+xml" {
            result.validation_reason = format!(
                "ER3B_CONTENT_TYPE_REJECTED: HTML content type '{content_type}' is invalid for {}.",
                mapped.source_id()
            );
            return result;
        }
        if !content_type_compatible(mapped.contract, content_type) {
            result.validation_reason = format!(
                "ER3B_CONTENT_TYPE_REJECTED: content type '{content_type}' is incompatible with {}.",
                mapped.source_id()
            );
            return result;
        }
    }

    match validate_source_bytes(mapped.contract, &fetch.body, &candidate.url) {
        Ok(count) => {
            result.parser_status = PASS.to_string();
            result.schema_status = PASS.to_string();
            result.population_status = PASS.to_string();
            result.population_count = Some(count as u32);
            if content_type_missing {
                result.classification = ER3B_CLASS_INDETERMINATE.to_string();
                result.validation_reason =
                    "ER3B_CONTENT_TYPE_MISSING: parser/schema/population passed but response content type was absent."
                        .to_string();
            } else {
                result.classification = ER3B_CLASS_VALIDATED.to_string();
                result.validation_reason = "ER3B_SOURCE_CONTRACT_VALIDATED".to_string();
            }
        }
        Err(error) => {
            result.parser_status = FAIL.to_string();
            result.schema_status = FAIL.to_string();
            result.population_status = FAIL.to_string();
            result.validation_reason = format!("ER3B_SOURCE_CONTRACT_REJECTED: {error}");
        }
    }
    result
}

fn rejected_transport_result(
    mapped: &Er3bMappedSource,
    configured_url: &str,
    landing_page_url: &str,
    candidate: &NseOfficialSourceDiscoveryCandidate,
    failure: Er3bTransportFailure,
) -> Er3bCandidateValidationResult {
    let mut result = base_result(mapped, configured_url, landing_page_url, candidate);
    result.request_url = failure.request_url;
    result.final_url = failure.final_url;
    result.http_status = failure.http_status;
    result.content_type = failure.content_type;
    result.validation_reason = failure.reason;
    result
}

fn enforce_declared_content_length(
    content_length: Option<u64>,
    max_body_bytes: usize,
) -> Result<(), String> {
    if let Some(length) = content_length {
        if length > max_body_bytes as u64 {
            return Err(format!(
                "ER3B_BODY_LIMIT_EXCEEDED: declared Content-Length {length} exceeds limit {max_body_bytes}."
            ));
        }
    }
    Ok(())
}

fn read_bounded_body<R: Read>(reader: R, max_body_bytes: usize) -> Result<Vec<u8>, String> {
    let read_limit = max_body_bytes
        .checked_add(1)
        .ok_or_else(|| "ER3B_BODY_LIMIT_INVALID: body limit overflowed.".to_string())?;
    let mut limited = reader.take(read_limit as u64);
    let mut body = Vec::new();
    limited
        .read_to_end(&mut body)
        .map_err(|error| format!("ER3B_BODY_READ_FAILED: {error}"))?;
    if body.len() > max_body_bytes {
        return Err(format!(
            "ER3B_BODY_LIMIT_EXCEEDED: streamed body exceeded limit {max_body_bytes}."
        ));
    }
    Ok(body)
}

fn response_to_bounded_fetch(
    response: Response,
    request_url: &str,
    max_body_bytes: usize,
) -> Result<Er3bFetchedResponse, Er3bTransportFailure> {
    let status = response.status();
    let final_url = response.url().as_str().to_string();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    if let Err(reason) = validate_nse_official_source_url(&final_url) {
        return Err(Er3bTransportFailure {
            request_url: request_url.to_string(),
            final_url: Some(final_url),
            http_status: Some(status.as_u16()),
            content_type,
            reason: format!("ER3B_FINAL_URL_PROVENANCE_REJECTED: {reason}"),
        });
    }
    if let Err(reason) = enforce_declared_content_length(response.content_length(), max_body_bytes) {
        return Err(Er3bTransportFailure {
            request_url: request_url.to_string(),
            final_url: Some(final_url),
            http_status: Some(status.as_u16()),
            content_type,
            reason,
        });
    }
    if !status.is_success() {
        return Ok(Er3bFetchedResponse {
            request_url: request_url.to_string(),
            final_url,
            http_status: status.as_u16(),
            content_type,
            body: Vec::new(),
        });
    }
    let body = read_bounded_body(response, max_body_bytes).map_err(|reason| Er3bTransportFailure {
        request_url: request_url.to_string(),
        final_url: Some(final_url.clone()),
        http_status: Some(status.as_u16()),
        content_type: content_type.clone(),
        reason,
    })?;
    Ok(Er3bFetchedResponse {
        request_url: request_url.to_string(),
        final_url,
        http_status: status.as_u16(),
        content_type,
        body,
    })
}

fn next_candidate_body_limit(remaining_bytes: usize) -> Option<usize> {
    if remaining_bytes == 0 {
        return None;
    }
    Some(min(ER3B_MAX_CANDIDATE_BYTES, remaining_bytes))
}

fn validate_nse_candidate_recovery_with_transport<T: Er3bTransport>(
    request: &Er3bRecoveryRequest<'_>,
    transport: &T,
) -> Result<Er3bRecoveryReport, String> {
    validate_trigger_category(request.trigger_category)?;
    let mapped = map_er1_source_to_er3_contract(request.er1_source_id)?;
    validate_nse_official_source_url(request.configured_url)?;
    validate_nse_official_source_url(request.landing_page_url)?;

    let landing = transport
        .get(request.landing_page_url, "text/html,*/*", None, ER3B_MAX_LANDING_BYTES)
        .map_err(|failure| format!("ER3B_LANDING_FETCH_FAILED: {}", failure.reason))?;
    if !(200..300).contains(&landing.http_status) {
        return Err(format!(
            "ER3B_LANDING_HTTP_FAILURE: status {}.",
            landing.http_status
        ));
    }
    if landing.body.is_empty() {
        return Err("ER3B_LANDING_EMPTY: trusted landing-page response was empty.".to_string());
    }
    let landing_html = String::from_utf8_lossy(&landing.body);
    let discovery = discover_nse_official_source_candidates(&NseOfficialSourceDiscoveryRequest {
        source_id: mapped.source_id(),
        source_role: mapped.source_role(),
        configured_url: request.configured_url,
        landing_page_url: request.landing_page_url,
        landing_page_html: &landing_html,
    })?;

    let mut remaining_bytes = ER3B_MAX_TOTAL_CANDIDATE_BYTES;
    let mut candidate_results = Vec::new();
    for candidate in discovery.candidates.iter().take(ER3B_MAX_CANDIDATES) {
        if next_candidate_body_limit(remaining_bytes).is_none() {
            candidate_results.push(rejected_transport_result(
                &mapped,
                request.configured_url,
                request.landing_page_url,
                candidate,
                Er3bTransportFailure {
                    request_url: candidate.url.clone(),
                    final_url: None,
                    http_status: None,
                    content_type: None,
                    reason: "ER3B_TOTAL_CANDIDATE_BYTE_LIMIT_EXCEEDED".to_string(),
                },
            ));
            continue;
        }
        let max_body = next_candidate_body_limit(remaining_bytes).expect("remaining byte budget checked above");
        match transport.get(
            &candidate.url,
            accept_header(mapped.contract),
            Some(request.landing_page_url),
            max_body,
        ) {
            Ok(fetch) => {
                remaining_bytes = remaining_bytes.saturating_sub(fetch.body.len());
                candidate_results.push(validate_candidate_response(
                    &mapped,
                    request.configured_url,
                    request.landing_page_url,
                    candidate,
                    &fetch,
                ));
            }
            Err(failure) => candidate_results.push(rejected_transport_result(
                &mapped,
                request.configured_url,
                request.landing_page_url,
                candidate,
                failure,
            )),
        }
    }

    Ok(Er3bRecoveryReport {
        er1_source_id: request.er1_source_id.to_string(),
        trigger_category: request.trigger_category.to_string(),
        source_id: mapped.source_id().to_string(),
        source_role: mapped.source_role().to_string(),
        configured_url: request.configured_url.to_string(),
        landing_page_url: request.landing_page_url.to_string(),
        discovery_candidate_count: discovery.candidates.len() as u32,
        discovery_rejection_count: discovery.rejected_candidates.len() as u32,
        candidate_results,
    })
}

pub(crate) fn validate_nse_candidate_recovery(
    request: &Er3bRecoveryRequest<'_>,
) -> Result<Er3bRecoveryReport, String> {
    let transport = ReqwestNseEr3bTransport::new()?;
    validate_nse_candidate_recovery_with_transport(request, &transport)
}


fn map_er4_direct_source(
    source_id: &str,
    source_role: &str,
) -> Result<Er3bMappedSource, String> {
    let er1_source_id = match source_id {
        "NSE_CURRENT_EQUITY_MASTER" => "NSE_EQUITY_MASTER",
        "NSE_CURRENT_SME_MASTER" => "NSE_SME_MASTER",
        "NSE_SYMBOL_CHANGE_HISTORY" => "NSE_SYMBOL_CHANGE",
        "NSE_COMPANY_NAME_CHANGE_HISTORY" => "NSE_COMPANY_NAME_CHANGE",
        "NSE_DELISTED_COMPANIES_WORKBOOK" => "NSE_DELISTED_WORKBOOK",
        _ => {
            return Err(format!(
                "ER4_SOURCE_NOT_CANDIDATE_ELIGIBLE: '{source_id}'."
            ));
        }
    };
    let mapped = map_er1_source_to_er3_contract(er1_source_id)?;
    if mapped.source_id() != source_id || mapped.source_role() != source_role {
        return Err("ER4_SOURCE_CONTRACT_MISMATCH".to_string());
    }
    Ok(mapped)
}

fn revalidate_nse_candidate_for_er4_with_transport<T: Er3bTransport>(
    source_id: &str,
    source_role: &str,
    configured_url: &str,
    landing_page_url: &str,
    candidate_url: &str,
    transport: &T,
) -> Result<Er3bCandidateValidationResult, String> {
    let mapped = map_er4_direct_source(source_id, source_role)?;
    validate_nse_official_source_url(configured_url)?;
    validate_nse_official_source_url(landing_page_url)?;
    validate_nse_official_source_url(candidate_url)?;

    let candidate = NseOfficialSourceDiscoveryCandidate {
        url: candidate_url.to_string(),
        discovered_from: landing_page_url.to_string(),
        reason: "ER4_DIRECT_REVALIDATION".to_string(),
        discovery_authority: "ER4_DIRECT_REVALIDATION",
    };

    match transport.get(
        candidate_url,
        accept_header(mapped.contract),
        Some(landing_page_url),
        ER3B_MAX_CANDIDATE_BYTES,
    ) {
        Ok(fetch) => Ok(validate_candidate_response(
            &mapped,
            configured_url,
            landing_page_url,
            &candidate,
            &fetch,
        )),
        Err(failure) => Ok(rejected_transport_result(
            &mapped,
            configured_url,
            landing_page_url,
            &candidate,
            failure,
        )),
    }
}

pub(crate) fn revalidate_nse_candidate_for_er4(
    source_id: &str,
    source_role: &str,
    configured_url: &str,
    landing_page_url: &str,
    candidate_url: &str,
) -> Result<Er3bCandidateValidationResult, String> {
    let transport = ReqwestNseEr3bTransport::new()?;
    revalidate_nse_candidate_for_er4_with_transport(
        source_id,
        source_role,
        configured_url,
        landing_page_url,
        candidate_url,
        &transport,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::official_source_urls::{
        DEFAULT_NSE_EQUITY_MASTER_URL, DEFAULT_NSE_SECURITIES_AVAILABLE_PAGE_URL,
    };
    use std::collections::HashMap;
    use std::io::{Cursor, Write};
    use zip::write::FileOptions;
    use zip::ZipWriter;

    const LANDING: &str = DEFAULT_NSE_SECURITIES_AVAILABLE_PAGE_URL;
    const EQUITY: &str = DEFAULT_NSE_EQUITY_MASTER_URL;

    #[derive(Default)]
    struct FixtureTransport {
        responses: HashMap<String, Result<Er3bFetchedResponse, Er3bTransportFailure>>,
    }

    impl FixtureTransport {
        fn insert_response(&mut self, response: Er3bFetchedResponse) {
            self.responses.insert(response.request_url.clone(), Ok(response));
        }

        fn insert_failure(&mut self, url: &str, reason: &str) {
            self.responses.insert(
                url.to_string(),
                Err(Er3bTransportFailure {
                    request_url: url.to_string(),
                    final_url: None,
                    http_status: None,
                    content_type: None,
                    reason: reason.to_string(),
                }),
            );
        }
    }

    impl Er3bTransport for FixtureTransport {
        fn get(
            &self,
            request_url: &str,
            _accept: &str,
            _referer: Option<&str>,
            max_body_bytes: usize,
        ) -> Result<Er3bFetchedResponse, Er3bTransportFailure> {
            let result = self.responses.get(request_url).cloned().unwrap_or_else(|| {
                Err(Er3bTransportFailure {
                    request_url: request_url.to_string(),
                    final_url: None,
                    http_status: None,
                    content_type: None,
                    reason: "ER3B_FIXTURE_MISSING".to_string(),
                })
            });
            match result {
                Ok(response) if response.body.len() > max_body_bytes => Err(Er3bTransportFailure {
                    request_url: request_url.to_string(),
                    final_url: Some(response.final_url),
                    http_status: Some(response.http_status),
                    content_type: response.content_type,
                    reason: format!(
                        "ER3B_BODY_LIMIT_EXCEEDED: fixture body {} exceeds limit {max_body_bytes}.",
                        response.body.len()
                    ),
                }),
                other => other,
            }
        }
    }

    fn fetched(url: &str, content_type: Option<&str>, body: Vec<u8>) -> Er3bFetchedResponse {
        Er3bFetchedResponse {
            request_url: url.to_string(),
            final_url: url.to_string(),
            http_status: 200,
            content_type: content_type.map(|value| value.to_string()),
            body,
        }
    }

    fn candidate(url: &str) -> NseOfficialSourceDiscoveryCandidate {
        NseOfficialSourceDiscoveryCandidate {
            url: url.to_string(),
            discovered_from: LANDING.to_string(),
            reason: "EXACT_FILENAME_MATCH".to_string(),
            discovery_authority: "DISCOVERED_NOT_PROMOTED",
        }
    }

    fn mapped(er1_source_id: &str) -> Er3bMappedSource {
        map_er1_source_to_er3_contract(er1_source_id).unwrap()
    }

    fn equity_csv(count: usize) -> Vec<u8> {
        let mut csv = String::from("SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\n");
        for index in 0..count {
            csv.push_str(&format!(
                "EQ{index:04},Equity {index},EQ,INE{index:09}\n"
            ));
        }
        csv.into_bytes()
    }

    fn sme_csv() -> Vec<u8> {
        b"SYMBOL,NAME_OF_COMPANY,SERIES,ISIN_NUMBER\nSMEONE,SME One,SM,INESME000001\n".to_vec()
    }

    fn symbol_change_csv() -> Vec<u8> {
        b"Example Limited,OLDCO,NEWCO,23-JAN-2023\n".to_vec()
    }

    fn name_change_csv() -> Vec<u8> {
        b"NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT\nEXAMPLE,Example Industries Limited,Example Limited,01-Jan-2026\n".to_vec()
    }

    fn delisted_xlsx() -> Vec<u8> {
        let cursor = Cursor::new(Vec::<u8>::new());
        let mut writer = ZipWriter::new(cursor);
        let options = FileOptions::default();
        writer.start_file("xl/sharedStrings.xml", options).unwrap();
        writer
            .write_all(
                br#"<sst><si><t>Sr.no</t></si><si><t>Symbol</t></si><si><t>Name of Company</t></si><si><t>ARCOTECH</t></si><si><t>Arcotech Limited</t></si></sst>"#,
            )
            .unwrap();
        writer.start_file("xl/worksheets/sheet1.xml", options).unwrap();
        writer
            .write_all(
                br#"<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row></sheetData></worksheet>"#,
            )
            .unwrap();
        writer.finish().unwrap().into_inner()
    }

    fn validate_fixture(
        er1_source_id: &str,
        url: &str,
        content_type: Option<&str>,
        body: Vec<u8>,
    ) -> Er3bCandidateValidationResult {
        let mapped = mapped(er1_source_id);
        validate_candidate_response(
            &mapped,
            EQUITY,
            LANDING,
            &candidate(url),
            &fetched(url, content_type, body),
        )
    }

    #[test]
    fn er3b_b1_exact_er1_to_er3_mapping_is_frozen() {
        let cases = [
            ("NSE_EQUITY_MASTER", "NSE_CURRENT_EQUITY_MASTER"),
            ("NSE_SME_MASTER", "NSE_CURRENT_SME_MASTER"),
            ("NSE_SYMBOL_CHANGE", "NSE_SYMBOL_CHANGE_HISTORY"),
            ("NSE_COMPANY_NAME_CHANGE", "NSE_COMPANY_NAME_CHANGE_HISTORY"),
            ("NSE_DELISTED_WORKBOOK", "NSE_DELISTED_COMPANIES_WORKBOOK"),
            ("NSE_DELISTED_LANDING", "NSE_DELISTED_COMPANIES_WORKBOOK"),
        ];
        for (er1, er3) in cases {
            assert_eq!(map_er1_source_to_er3_contract(er1).unwrap().source_id(), er3);
        }
        assert!(map_er1_source_to_er3_contract("BSE_LIST_SCRIPS_ACTIVE").is_err());
        assert!(map_er1_source_to_er3_contract("NSE_UNKNOWN").is_err());
    }

    #[test]
    fn er3b_b1_healthy_trigger_cannot_start_recovery() {
        assert!(validate_trigger_category("HEALTHY").unwrap_err().contains("ER3B_TRIGGER_NOT_ELIGIBLE"));
        assert!(validate_trigger_category("TRANSPORT_FAILURE").is_ok());
    }

    #[test]
    fn er3b_b1_equity_1000_passes_and_999_rejects() {
        let good = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            Some("text/csv"),
            equity_csv(1000),
        );
        assert_eq!(good.classification, ER3B_CLASS_VALIDATED);
        assert_eq!(good.population_count, Some(1000));
        let bad = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            Some("text/csv"),
            equity_csv(999),
        );
        assert_eq!(bad.classification, ER3B_CLASS_REJECTED);
        assert!(bad.validation_reason.contains("SOURCE_POPULATION_SANITY_REJECTED"));
    }

    #[test]
    fn er3b_b1_other_source_contracts_reuse_frozen_parsers() {
        let cases = [
            (
                "NSE_SME_MASTER",
                "https://archives.nseindia.com/moved/SME_EQUITY_L.csv",
                "text/csv",
                sme_csv(),
            ),
            (
                "NSE_SYMBOL_CHANGE",
                "https://archives.nseindia.com/moved/symbolchange.csv",
                "text/plain",
                symbol_change_csv(),
            ),
            (
                "NSE_COMPANY_NAME_CHANGE",
                "https://archives.nseindia.com/moved/namechange.csv",
                "application/csv",
                name_change_csv(),
            ),
            (
                "NSE_DELISTED_WORKBOOK",
                "https://archives.nseindia.com/moved/List%20of%20delisted%20Companies.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                delisted_xlsx(),
            ),
        ];
        for (source, url, content_type, bytes) in cases {
            let result = validate_fixture(source, url, Some(content_type), bytes);
            assert_eq!(result.classification, ER3B_CLASS_VALIDATED, "{source}: {}", result.validation_reason);
            assert!(result.population_count.unwrap_or_default() > 0);
        }
    }

    #[test]
    fn er3b_b1_html_is_rejected_even_when_parser_bytes_look_csv_like() {
        let result = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            Some("text/html; charset=utf-8"),
            equity_csv(1000),
        );
        assert_eq!(result.classification, ER3B_CLASS_REJECTED);
        assert!(result.validation_reason.contains("CONTENT_TYPE_REJECTED"));
    }

    #[test]
    fn er3b_b1_missing_content_type_is_indeterminate_after_parser_passes() {
        let result = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            None,
            equity_csv(1000),
        );
        assert_eq!(result.classification, ER3B_CLASS_INDETERMINATE);
        assert_eq!(result.parser_status, PASS);
    }

    #[test]
    fn er3b_b1_sha_is_deterministic_and_report_has_no_body_field() {
        let bytes = equity_csv(1000);
        let a = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            Some("application/octet-stream"),
            bytes.clone(),
        );
        let b = validate_fixture(
            "NSE_EQUITY_MASTER",
            "https://archives.nseindia.com/moved/EQUITY_L.csv",
            Some("application/octet-stream"),
            bytes,
        );
        assert_eq!(a.content_sha256, b.content_sha256);
        let json = serde_json::to_string(&a).unwrap();
        assert!(!json.to_ascii_lowercase().contains("body"));
        for forbidden in ["APPROVED", "PROMOTED", "CONFIGURED", "APPLIED"] {
            assert_ne!(a.classification, forbidden);
        }
    }

    #[test]
    fn er3b_b2_declared_and_streamed_body_limits_fail_closed() {
        assert!(enforce_declared_content_length(Some(11), 10).unwrap_err().contains("BODY_LIMIT_EXCEEDED"));
        assert!(read_bounded_body(Cursor::new(vec![0u8; 11]), 10).unwrap_err().contains("BODY_LIMIT_EXCEEDED"));
        assert_eq!(read_bounded_body(Cursor::new(vec![0u8; 10]), 10).unwrap().len(), 10);
    }

    #[test]
    fn er3b_b2_total_candidate_byte_budget_caps_each_next_fetch() {
        assert_eq!(next_candidate_body_limit(ER3B_MAX_TOTAL_CANDIDATE_BYTES), Some(ER3B_MAX_CANDIDATE_BYTES));
        assert_eq!(next_candidate_body_limit(ER3B_MAX_CANDIDATE_BYTES + 1), Some(ER3B_MAX_CANDIDATE_BYTES));
        assert_eq!(next_candidate_body_limit(1024), Some(1024));
        assert_eq!(next_candidate_body_limit(0), None);
    }

    #[test]
    fn er3b_b2_orchestration_caps_candidates_and_preserves_order() {
        let mut landing_html = String::new();
        let mut transport = FixtureTransport::default();
        transport.insert_response(fetched(LANDING, Some("text/html"), Vec::new()));
        for index in 0..8 {
            let url = format!("https://archives.nseindia.com/moved{index}/EQUITY_L.csv");
            landing_html.push_str(&format!(r#"<a href="{url}">candidate</a>"#));
            transport.insert_response(fetched(&url, Some("text/csv"), equity_csv(1000)));
        }
        transport.insert_response(fetched(LANDING, Some("text/html"), landing_html.into_bytes()));
        let report = validate_nse_candidate_recovery_with_transport(
            &Er3bRecoveryRequest {
                er1_source_id: "NSE_EQUITY_MASTER",
                trigger_category: "TRANSPORT_FAILURE",
                configured_url: EQUITY,
                landing_page_url: LANDING,
            },
            &transport,
        )
        .unwrap();
        assert_eq!(report.discovery_candidate_count, 8);
        assert_eq!(report.candidate_results.len(), 5);
        let urls: Vec<_> = report.candidate_results.iter().map(|item| item.candidate_url.clone()).collect();
        let mut sorted = urls.clone();
        sorted.sort();
        assert_eq!(urls, sorted);
    }

    #[test]
    fn er3b_b2_transport_failure_never_validates_candidate() {
        let candidate_url = "https://archives.nseindia.com/moved/EQUITY_L.csv";
        let mut transport = FixtureTransport::default();
        transport.insert_response(fetched(
            LANDING,
            Some("text/html"),
            format!(r#"<a href="{candidate_url}">candidate</a>"#).into_bytes(),
        ));
        transport.insert_failure(candidate_url, "ER3B_TRANSPORT_FAILURE: fixture");
        let report = validate_nse_candidate_recovery_with_transport(
            &Er3bRecoveryRequest {
                er1_source_id: "NSE_EQUITY_MASTER",
                trigger_category: "TRANSPORT_FAILURE",
                configured_url: EQUITY,
                landing_page_url: LANDING,
            },
            &transport,
        )
        .unwrap();
        assert_eq!(report.candidate_results.len(), 1);
        assert_eq!(report.candidate_results[0].classification, ER3B_CLASS_REJECTED);
        assert!(report.candidate_results[0].validation_reason.contains("TRANSPORT_FAILURE"));
    }

    #[test]
    fn er3b_b2_fixture_order_does_not_change_report() {
        let urls = [
            "https://archives.nseindia.com/a/EQUITY_L.csv",
            "https://nsearchives.nseindia.com/z/EQUITY_L.csv",
        ];
        let html = format!(r#"<a href="{}">a</a><a href="{}">z</a>"#, urls[0], urls[1]);
        let make = |reverse: bool| {
            let mut transport = FixtureTransport::default();
            transport.insert_response(fetched(LANDING, Some("text/html"), html.clone().into_bytes()));
            let order: Vec<_> = if reverse { urls.iter().rev().collect() } else { urls.iter().collect() };
            for url in order {
                transport.insert_response(fetched(url, Some("text/csv"), equity_csv(1000)));
            }
            validate_nse_candidate_recovery_with_transport(
                &Er3bRecoveryRequest {
                    er1_source_id: "NSE_EQUITY_MASTER",
                    trigger_category: "HTTP_FAILURE",
                    configured_url: EQUITY,
                    landing_page_url: LANDING,
                },
                &transport,
            )
            .unwrap()
        };
        assert_eq!(make(false), make(true));
    }

    #[test]
    #[ignore = "requires explicit online NSE verification"]
    fn er3b_online_nse_equity_characterization_requires_explicit_authorization() {
        if std::env::var("EOD_ER3B_ONLINE_VERIFY").ok().as_deref() != Some("1") {
            panic!("ER3B_ONLINE_AUTHORIZATION_REQUIRED");
        }
        let transport = ReqwestNseEr3bTransport::new().expect("online NSE transport");
        let landing = transport
            .get(LANDING, "text/html,*/*", None, ER3B_MAX_LANDING_BYTES)
            .expect("official NSE landing fetch must succeed");
        assert!((200..300).contains(&landing.http_status));
        assert!(!landing.body.is_empty());
        validate_nse_official_source_url(&landing.final_url).unwrap();

        let equity = transport
            .get(
                EQUITY,
                accept_header(NseDiscoveryContract::CurrentEquityMaster),
                Some(LANDING),
                ER3B_MAX_CANDIDATE_BYTES,
            )
            .expect("official NSE equity fetch must succeed");
        let mapped = mapped("NSE_EQUITY_MASTER");
        let result = validate_candidate_response(
            &mapped,
            EQUITY,
            LANDING,
            &candidate(EQUITY),
            &equity,
        );
        assert_eq!(result.classification, ER3B_CLASS_VALIDATED, "{}", result.validation_reason);
        println!(
            "ER3B_ONLINE_VERIFICATION_JSON={}",
            serde_json::json!({
                "landingFinalUrl": landing.final_url,
                "landingStatus": landing.http_status,
                "landingBytes": landing.body.len(),
                "candidateFinalUrl": result.final_url,
                "candidateStatus": result.http_status,
                "candidateBytes": result.response_bytes,
                "candidateSha256": result.content_sha256,
                "populationCount": result.population_count,
                "classification": result.classification,
            })
        );
    }
}


#[cfg(test)]
mod er4d_direct_revalidation_tests {
    use super::*;
    use std::collections::HashMap;

    #[derive(Default)]
    struct Er4dFixtureTransport {
        responses: HashMap<String, Result<Er3bFetchedResponse, Er3bTransportFailure>>,
    }

    impl Er3bTransport for Er4dFixtureTransport {
        fn get(
            &self,
            request_url: &str,
            _accept: &str,
            _referer: Option<&str>,
            _max_body_bytes: usize,
        ) -> Result<Er3bFetchedResponse, Er3bTransportFailure> {
            self.responses
                .get(request_url)
                .cloned()
                .unwrap_or_else(|| Err(Er3bTransportFailure {
                    request_url: request_url.to_string(),
                    final_url: None,
                    http_status: None,
                    content_type: None,
                    reason: "ER4D_FIXTURE_MISSING".to_string(),
                }))
        }
    }

    fn equity_csv(count: usize) -> Vec<u8> {
        let mut csv = String::from("SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\n");
        for index in 0..count {
            csv.push_str(&format!("ER4D{index:04},ER4 D Company {index},EQ,\n"));
        }
        csv.into_bytes()
    }

    #[test]
    fn er4d_direct_candidate_revalidation_reuses_er3b_contract_and_hash() {
        let configured = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
        let landing = "https://www.nseindia.com/static/market-data/securities-available-for-trading";
        let candidate = "https://nsearchives.nseindia.com/content/equities/EQUITY_REPLACEMENT.csv";
        let body = equity_csv(1000);
        let expected_sha = sha256_upper_hex(&body);
        let mut transport = Er4dFixtureTransport::default();
        transport.responses.insert(
            candidate.to_string(),
            Ok(Er3bFetchedResponse {
                request_url: candidate.to_string(),
                final_url: candidate.to_string(),
                http_status: 200,
                content_type: Some("text/csv".to_string()),
                body,
            }),
        );

        let result = revalidate_nse_candidate_for_er4_with_transport(
            "NSE_CURRENT_EQUITY_MASTER",
            "CURRENT_IDENTITY_MASTER",
            configured,
            landing,
            candidate,
            &transport,
        )
        .unwrap();

        assert_eq!(result.classification, ER3B_CLASS_VALIDATED);
        assert_eq!(result.content_sha256.as_deref(), Some(expected_sha.as_str()));
        assert_eq!(result.population_count, Some(1000));
    }
}

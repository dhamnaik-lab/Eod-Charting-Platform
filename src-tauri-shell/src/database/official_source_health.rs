use chrono::Utc;
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, REFERER, USER_AGENT};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::AppHandle;

use super::bse_identity_imports::{
    validate_bse_active_population_for_health, validate_bse_master_bytes_for_health,
    BSE_USER_AGENT,
};
use super::nse_identity_imports::{
    discover_nse_actual_delisted_workbook_url_for_health,
    validate_nse_company_name_change_bytes_for_health,
    validate_nse_current_population_for_health, validate_nse_delisted_workbook_bytes_for_health,
    validate_nse_equity_master_bytes_for_health, validate_nse_sme_master_bytes_for_health,
    validate_nse_symbol_change_bytes_for_health, NSE_USER_AGENT,
};
use super::official_source_urls::{
    bse_official_redirect_policy, load_official_source_urls, nse_official_redirect_policy,
    validate_bse_official_source_url, validate_nse_official_source_url, OfficialSourceUrls,
};
use super::{
    open_read_only_connection_for_folder, resolve_active_database_folder, AppResult,
};

const PASS: &str = "PASS";
const FAIL: &str = "FAIL";
const NOT_APPLICABLE: &str = "NOT_APPLICABLE";
const NOT_EVALUATED: &str = "NOT_EVALUATED";
const COMPATIBLE: &str = "COMPATIBLE";
const OFFICIAL_SOURCE_PROVENANCE_REJECTED: &str = "OFFICIAL_SOURCE_PROVENANCE_REJECTED";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceHealthReport {
    pub assessed_at_utc: String,
    pub results: Vec<OfficialSourceHealthResult>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceHealthResult {
    pub source_id: String,
    pub exchange: String,
    pub role: String,
    pub request_url: String,
    pub final_url: Option<String>,
    pub provenance_status: String,
    pub transport_status: String,
    pub http_status: Option<u16>,
    pub content_bytes: Option<u64>,
    pub content_sha256: Option<String>,
    pub format_status: String,
    pub population_status: String,
    pub population_count: Option<u32>,
    pub freshness_status: String,
    pub drift_class: Option<String>,
    pub reason: String,
    pub diagnostic: Option<String>,
}


pub(crate) fn er1_health_result_is_healthy(result: &OfficialSourceHealthResult) -> bool {
    result.provenance_status == PASS
        && result.transport_status == PASS
        && result.format_status == PASS
        && result.population_status != FAIL
        && result.population_status != NOT_EVALUATED
        && result.freshness_status != FAIL
        && result.freshness_status != NOT_EVALUATED
}

#[derive(Clone, Debug)]
struct FetchEvidence {
    request_url: String,
    final_url: Option<String>,
    provenance_status: String,
    transport_status: String,
    http_status: Option<u16>,
    body: Option<Vec<u8>>,
    content_sha256: Option<String>,
    reason: String,
}

impl FetchEvidence {
    fn unavailable(request_url: &str) -> Self {
        Self {
            request_url: request_url.to_string(),
            final_url: None,
            provenance_status: NOT_EVALUATED.to_string(),
            transport_status: NOT_EVALUATED.to_string(),
            http_status: None,
            body: None,
            content_sha256: None,
            reason: String::new(),
        }
    }

    fn usable_body(&self) -> Option<&[u8]> {
        if self.provenance_status == PASS && self.transport_status == PASS {
            return self.body.as_deref();
        }
        None
    }
}

#[tauri::command]
pub async fn assess_identity_official_source_health(
    app: AppHandle,
) -> AppResult<OfficialSourceHealthReport> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before checking Official Source Health.".to_string()
        })?;
        let connection = open_read_only_connection_for_folder(&folder_path)?;
        let urls = load_official_source_urls(Some(&connection))?;
        assess_official_source_health_with_diagnostics(&urls, Some(&folder_path.join("reference-data")))
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn assess_official_source_health_for_urls(
    urls: &OfficialSourceUrls,
) -> AppResult<OfficialSourceHealthReport> {
    assess_official_source_health_with_diagnostics(urls, None)
}

fn assess_official_source_health_with_diagnostics(
    urls: &OfficialSourceUrls,
    archive_root: Option<&std::path::Path>,
) -> AppResult<OfficialSourceHealthReport> {
    let nse_client = Client::builder()
        .timeout(Duration::from_secs(45))
        .cookie_store(true)
        .redirect(nse_official_redirect_policy())
        .build()
        .map_err(|error| format!("Could not create NSE health-check client: {error}"))?;
    let bse_client = Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(bse_official_redirect_policy())
        .build()
        .map_err(|error| format!("Could not create BSE health-check client: {error}"))?;

    let mut results = Vec::with_capacity(11);

    let nse_landing_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_securities_available_page_url,
        "text/html,*/*",
        None,
    );
    results.push(assess_non_empty_landing(
        "NSE_SECURITIES_AVAILABLE_LANDING",
        "NSE",
        "Securities Available landing page",
        &nse_landing_fetch,
        false,
    ));

    let equity_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_equity_master_url,
        "text/csv,application/csv,*/*",
        Some(&urls.nse_securities_available_page_url),
    );
    results.push(assess_nse_equity_master(&equity_fetch));

    let sme_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_sme_master_url,
        "text/csv,application/csv,*/*",
        Some(&urls.nse_securities_available_page_url),
    );
    results.push(assess_nse_sme_master(&sme_fetch));

    let symbol_change_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_symbol_change_url,
        "text/csv,application/csv,*/*",
        Some(&urls.nse_securities_available_page_url),
    );
    results.push(assess_nse_symbol_change(&symbol_change_fetch));

    let company_name_change_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_company_name_change_url,
        "text/csv,application/csv,*/*",
        Some(&urls.nse_securities_available_page_url),
    );
    let mut company_result = assess_nse_company_name_change(&company_name_change_fetch);
    if !er1_health_result_is_healthy(&company_result) {
        if let Some(bytes) = company_name_change_fetch.body.as_deref() {
            company_result.diagnostic = Some(super::nse_identity_imports::company_name_failure_diagnostic(
                archive_root, bytes, &company_name_change_fetch.request_url,
                company_name_change_fetch.final_url.as_deref(), company_name_change_fetch.http_status,
                &company_result.reason,
            ));
        }
    }
    results.push(company_result);

    let delisted_landing_fetch = fetch_source(
        &nse_client,
        "NSE",
        &urls.nse_delisted_page_url,
        "text/html,*/*",
        None,
    );
    let discovered_delisted_url = delisted_landing_fetch.usable_body().and_then(|bytes| {
        let page_html = String::from_utf8_lossy(bytes);
        discover_nse_actual_delisted_workbook_url_for_health(&page_html)
    });
    results.push(assess_nse_delisted_landing(
        &delisted_landing_fetch,
        discovered_delisted_url.as_deref(),
    ));

    let workbook_url = discovered_delisted_url
        .unwrap_or_else(|| urls.nse_delisted_workbook_url.clone());
    let delisted_workbook_fetch = fetch_source(
        &nse_client,
        "NSE",
        &workbook_url,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        Some(&urls.nse_delisted_page_url),
    );
    results.push(assess_nse_delisted_workbook(&delisted_workbook_fetch));

    let bse_referer_fetch = fetch_source(
        &bse_client,
        "BSE",
        &urls.bse_list_scrips_referer,
        "text/html,*/*",
        None,
    );
    results.push(assess_non_empty_landing(
        "BSE_LIST_SCRIPS_REFERER",
        "BSE",
        "List Scrips referer page",
        &bse_referer_fetch,
        false,
    ));

    for (status, source_id, role, enforce_population) in [
        (
            "Active",
            "BSE_LIST_SCRIPS_ACTIVE",
            "List Scrips Active lifecycle CSV",
            true,
        ),
        (
            "Delisted",
            "BSE_LIST_SCRIPS_DELISTED",
            "List Scrips Delisted lifecycle CSV",
            false,
        ),
        (
            "Suspended",
            "BSE_LIST_SCRIPS_SUSPENDED",
            "List Scrips Suspended lifecycle CSV",
            false,
        ),
    ] {
        let request_url = format!("{}{}", urls.bse_list_scrips_url_prefix, status);
        let fetch = fetch_source(
            &bse_client,
            "BSE",
            &request_url,
            "text/csv,*/*",
            Some(&urls.bse_list_scrips_referer),
        );
        results.push(assess_bse_lifecycle(
            source_id,
            role,
            &fetch,
            enforce_population,
        ));
    }

    Ok(OfficialSourceHealthReport {
        assessed_at_utc: Utc::now().to_rfc3339(),
        results,
    })
}

fn fetch_source(
    client: &Client,
    exchange: &str,
    request_url: &str,
    accept: &str,
    referer: Option<&str>,
) -> FetchEvidence {
    let mut evidence = FetchEvidence::unavailable(request_url);

    if let Err(error) = validate_exchange_url(exchange, request_url) {
        evidence.provenance_status = FAIL.to_string();
        evidence.reason = error;
        return evidence;
    }
    if let Some(referer_url) = referer {
        if let Err(error) = validate_exchange_url(exchange, referer_url) {
            evidence.provenance_status = FAIL.to_string();
            evidence.reason = format!("Request referer failed official provenance validation: {error}");
            return evidence;
        }
    }

    evidence.provenance_status = PASS.to_string();
    let user_agent = if exchange == "NSE" {
        NSE_USER_AGENT
    } else {
        BSE_USER_AGENT
    };
    let mut request = client
        .get(request_url)
        .header(ACCEPT, accept)
        .header(USER_AGENT, user_agent);
    if let Some(referer_url) = referer {
        request = request.header(REFERER, referer_url);
    }

    let response = match request.send() {
        Ok(response) => response,
        Err(error) => {
            let message = error.to_string();
            if message.contains(OFFICIAL_SOURCE_PROVENANCE_REJECTED) {
                evidence.provenance_status = FAIL.to_string();
                evidence.transport_status = NOT_EVALUATED.to_string();
                evidence.reason = message;
                return evidence;
            }
            evidence.transport_status = FAIL.to_string();
            evidence.reason = format!("Official-source request failed: {message}");
            return evidence;
        }
    };

    let status = response.status();
    let final_url = response.url().as_str().to_string();
    evidence.http_status = Some(status.as_u16());
    evidence.final_url = Some(final_url.clone());

    if let Err(error) = validate_exchange_url(exchange, &final_url) {
        evidence.provenance_status = FAIL.to_string();
        evidence.transport_status = if status.is_success() {
            PASS.to_string()
        } else {
            FAIL.to_string()
        };
        evidence.reason = format!("Final response URL failed official provenance validation: {error}");
        return evidence;
    }

    let body = match response.bytes() {
        Ok(bytes) => bytes.to_vec(),
        Err(error) => {
            evidence.transport_status = FAIL.to_string();
            evidence.reason = format!("Could not read official-source response body: {error}");
            return evidence;
        }
    };

    evidence.content_sha256 = Some(sha256_upper_hex(&body));
    evidence.body = Some(body);
    if !status.is_success() {
        evidence.transport_status = FAIL.to_string();
        evidence.reason = format!("Official-source HTTP request returned status {}.", status.as_u16());
        return evidence;
    }

    evidence.transport_status = PASS.to_string();
    evidence.reason = format!("Official-source HTTP request returned status {}.", status.as_u16());
    evidence
}

fn validate_exchange_url(exchange: &str, value: &str) -> Result<(), String> {
    match exchange {
        "NSE" => validate_nse_official_source_url(value),
        "BSE" => validate_bse_official_source_url(value),
        other => Err(format!("Unsupported official-source exchange: {other}")),
    }
}

fn sha256_upper_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes)).to_ascii_uppercase()
}

fn base_result(source_id: &str, exchange: &str, role: &str, fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    OfficialSourceHealthResult {
        source_id: source_id.to_string(),
        exchange: exchange.to_string(),
        role: role.to_string(),
        request_url: fetch.request_url.clone(),
        final_url: fetch.final_url.clone(),
        provenance_status: fetch.provenance_status.clone(),
        transport_status: fetch.transport_status.clone(),
        http_status: fetch.http_status,
        content_bytes: fetch.body.as_ref().map(|bytes| bytes.len() as u64),
        content_sha256: fetch.content_sha256.clone(),
        format_status: NOT_EVALUATED.to_string(),
        population_status: NOT_EVALUATED.to_string(),
        population_count: None,
        freshness_status: NOT_APPLICABLE.to_string(),
        drift_class: None,
        reason: fetch.reason.clone(),
        diagnostic: None,
    }
}

fn assess_non_empty_landing(
    source_id: &str,
    exchange: &str,
    role: &str,
    fetch: &FetchEvidence,
    compatible_on_pass: bool,
) -> OfficialSourceHealthResult {
    let mut result = base_result(source_id, exchange, role, fetch);
    result.population_status = NOT_APPLICABLE.to_string();
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    if !contains_non_whitespace(bytes) {
        result.format_status = FAIL.to_string();
        result.reason = "Official landing response was empty.".to_string();
        return result;
    }

    result.format_status = PASS.to_string();
    if compatible_on_pass {
        result.drift_class = Some(COMPATIBLE.to_string());
    }
    result.reason = "Official landing response was non-empty and provenance-valid.".to_string();
    result
}

fn assess_nse_equity_master(fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_EQUITY_MASTER",
        "NSE",
        "Equity current-universe master CSV",
        fetch,
    );
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    let count = match validate_nse_equity_master_bytes_for_health(bytes, &fetch.request_url) {
        Ok(count) => count,
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
            return result;
        }
    };
    result.format_status = PASS.to_string();
    result.population_count = Some(count as u32);

    match validate_nse_current_population_for_health(count) {
        Ok(()) => {
            result.population_status = PASS.to_string();
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!(
                "NSE equity master passed the frozen parser and supported-symbol population floor with {count} row(s)."
            );
        }
        Err(error) => {
            result.population_status = FAIL.to_string();
            result.reason = error;
        }
    }
    result
}

fn assess_nse_sme_master(fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_SME_MASTER",
        "NSE",
        "SME current-universe master CSV",
        fetch,
    );
    result.population_status = NOT_APPLICABLE.to_string();
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    match validate_nse_sme_master_bytes_for_health(bytes, &fetch.request_url) {
        Ok(count) => {
            result.format_status = PASS.to_string();
            result.population_count = Some(count as u32);
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!("NSE SME master passed the frozen parser with {count} supported row(s).");
        }
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
        }
    }
    result
}

fn assess_nse_symbol_change(fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_SYMBOL_CHANGE",
        "NSE",
        "Official symbol-change CSV",
        fetch,
    );
    result.population_status = NOT_APPLICABLE.to_string();
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    match validate_nse_symbol_change_bytes_for_health(bytes, &fetch.request_url) {
        Ok(count) => {
            result.format_status = PASS.to_string();
            result.population_count = Some(count as u32);
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!("NSE symbol-change source passed the frozen parser with {count} row(s).");
        }
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
        }
    }
    result
}

fn assess_nse_company_name_change(fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_COMPANY_NAME_CHANGE",
        "NSE",
        "Official company-name-change CSV",
        fetch,
    );
    result.population_status = NOT_APPLICABLE.to_string();
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    match validate_nse_company_name_change_bytes_for_health(bytes, &fetch.request_url) {
        Ok(count) => {
            result.format_status = PASS.to_string();
            result.population_count = Some(count as u32);
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!("NSE company-name-change source passed the frozen I4 parser with {count} row(s).");
        }
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
        }
    }
    result
}

fn assess_nse_delisted_landing(
    fetch: &FetchEvidence,
    discovered_workbook_url: Option<&str>,
) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_DELISTED_LANDING",
        "NSE",
        "Delisted-company discovery landing page",
        fetch,
    );
    result.population_status = NOT_APPLICABLE.to_string();
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    if !contains_non_whitespace(bytes) {
        result.format_status = FAIL.to_string();
        result.reason = "NSE delisted landing response was empty.".to_string();
        return result;
    }

    match discovered_workbook_url {
        Some(url) => {
            result.format_status = PASS.to_string();
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!(
                "NSE delisted landing retained actual-delisted workbook semantics: {url}"
            );
        }
        None => {
            result.format_status = FAIL.to_string();
            result.reason = "NSE delisted landing did not expose a deterministically identifiable actual-delisted workbook; fallback configuration remains separate and no drift class is forced.".to_string();
        }
    }
    result
}

fn assess_nse_delisted_workbook(fetch: &FetchEvidence) -> OfficialSourceHealthResult {
    let mut result = base_result(
        "NSE_DELISTED_WORKBOOK",
        "NSE",
        "Actual-delisted workbook",
        fetch,
    );
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    match validate_nse_delisted_workbook_bytes_for_health(bytes) {
        Ok(count) => {
            result.format_status = PASS.to_string();
            result.population_status = PASS.to_string();
            result.population_count = Some(count as u32);
            result.drift_class = Some(COMPATIBLE.to_string());
            result.reason = format!("NSE delisted workbook passed the frozen Symbol-column parser with {count} symbol(s).");
        }
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
        }
    }
    result
}

fn assess_bse_lifecycle(
    source_id: &str,
    role: &str,
    fetch: &FetchEvidence,
    enforce_population: bool,
) -> OfficialSourceHealthResult {
    let mut result = base_result(source_id, "BSE", role, fetch);
    if !enforce_population {
        result.population_status = NOT_APPLICABLE.to_string();
    }
    let Some(bytes) = fetch.usable_body() else {
        return result;
    };

    let count = match validate_bse_master_bytes_for_health(bytes, &fetch.request_url) {
        Ok(count) => count,
        Err(error) => {
            result.format_status = FAIL.to_string();
            result.reason = error;
            return result;
        }
    };
    result.format_status = PASS.to_string();
    result.population_count = Some(count as u32);

    if enforce_population {
        match validate_bse_active_population_for_health(count) {
            Ok(()) => {
                result.population_status = PASS.to_string();
                result.drift_class = Some(COMPATIBLE.to_string());
                result.reason = format!(
                    "BSE Active source passed the frozen five-field contract and active-symbol population floor with {count} row(s)."
                );
            }
            Err(error) => {
                result.population_status = FAIL.to_string();
                result.reason = error;
            }
        }
        return result;
    }

    result.drift_class = Some(COMPATIBLE.to_string());
    result.reason = format!("BSE lifecycle source passed the frozen five-field contract with {count} row(s).");
    result
}

fn contains_non_whitespace(bytes: &[u8]) -> bool {
    bytes.iter().any(|byte| !byte.is_ascii_whitespace())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::FileOptions;
    use zip::ZipWriter;

    fn successful_fetch(url: &str, body: Vec<u8>) -> FetchEvidence {
        FetchEvidence {
            request_url: url.to_string(),
            final_url: Some(url.to_string()),
            provenance_status: PASS.to_string(),
            transport_status: PASS.to_string(),
            http_status: Some(200),
            content_sha256: Some(sha256_upper_hex(&body)),
            body: Some(body),
            reason: "test transport pass".to_string(),
        }
    }

    fn nse_master_csv(count: usize) -> Vec<u8> {
        let mut csv = String::from("SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\n");
        for index in 0..count {
            csv.push_str(&format!("ER1N{index:04},ER1 Company {index},EQ,\n"));
        }
        csv.into_bytes()
    }

    fn bse_master_csv(count: usize) -> Vec<u8> {
        let mut csv = String::from("Security Code,Security Id,Security Name,Group,ISIN\n");
        for index in 0..count {
            csv.push_str(&format!(
                "{},ER1B{index:04},ER1 BSE Company {index},A,\n",
                500000 + index
            ));
        }
        csv.into_bytes()
    }

    fn delisted_workbook_bytes() -> Vec<u8> {
        let cursor = std::io::Cursor::new(Vec::<u8>::new());
        let mut zip = ZipWriter::new(cursor);
        zip.start_file("xl/worksheets/sheet1.xml", FileOptions::default())
            .unwrap();
        zip.write_all(
            br#"<worksheet><sheetData><row r="1"><c r="A1"><v>Symbol</v></c></row><row r="2"><c r="A2"><v>ER1DEL</v></c></row></sheetData></worksheet>"#,
        )
        .unwrap();
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn er1_nse_equity_1000_rows_is_compatible() {
        let fetch = successful_fetch("https://nsearchives.nseindia.com/equity.csv", nse_master_csv(1000));
        let result = assess_nse_equity_master(&fetch);

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, PASS);
        assert_eq!(result.population_count, Some(1000));
        assert_eq!(result.drift_class.as_deref(), Some(COMPATIBLE));
    }

    #[test]
    fn er1_nse_equity_999_rows_fails_population_without_forcing_drift() {
        let fetch = successful_fetch("https://nsearchives.nseindia.com/equity.csv", nse_master_csv(999));
        let result = assess_nse_equity_master(&fetch);

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, FAIL);
        assert_eq!(result.population_count, Some(999));
        assert_eq!(result.drift_class, None);
        assert!(result.reason.contains("SOURCE_POPULATION_SANITY_REJECTED"));
    }

    #[test]
    fn er1_bse_active_1000_rows_is_compatible() {
        let fetch = successful_fetch("https://api.bseindia.com/source.csv", bse_master_csv(1000));
        let result = assess_bse_lifecycle(
            "BSE_LIST_SCRIPS_ACTIVE",
            "List Scrips Active lifecycle CSV",
            &fetch,
            true,
        );

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, PASS);
        assert_eq!(result.population_count, Some(1000));
        assert_eq!(result.drift_class.as_deref(), Some(COMPATIBLE));
    }

    #[test]
    fn er1_bse_active_999_rows_fails_population_without_inactive_compensation() {
        let fetch = successful_fetch("https://api.bseindia.com/source.csv", bse_master_csv(999));
        let result = assess_bse_lifecycle(
            "BSE_LIST_SCRIPS_ACTIVE",
            "List Scrips Active lifecycle CSV",
            &fetch,
            true,
        );

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, FAIL);
        assert_eq!(result.population_count, Some(999));
        assert_eq!(result.drift_class, None);
        assert!(result.reason.contains("SOURCE_POPULATION_SANITY_REJECTED"));
    }

    #[test]
    fn er1_bse_parser_failure_does_not_guess_a_drift_class() {
        let body = b"Security Code,Security Id,Security Name,Group\n500001,ER1B,ER1 Company,A\n".to_vec();
        let fetch = successful_fetch("https://api.bseindia.com/source.csv", body);
        let result = assess_bse_lifecycle(
            "BSE_LIST_SCRIPS_ACTIVE",
            "List Scrips Active lifecycle CSV",
            &fetch,
            true,
        );

        assert_eq!(result.format_status, FAIL);
        assert_eq!(result.population_status, NOT_EVALUATED);
        assert_eq!(result.drift_class, None);
        assert!(result.reason.contains("BSE_SOURCE_CONTRACT_REJECTED"));
    }

    #[test]
    fn er1_bse_inactive_lifecycle_has_no_population_minimum() {
        let fetch = successful_fetch("https://api.bseindia.com/source.csv", bse_master_csv(1));
        let result = assess_bse_lifecycle(
            "BSE_LIST_SCRIPS_DELISTED",
            "List Scrips Delisted lifecycle CSV",
            &fetch,
            false,
        );

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, NOT_APPLICABLE);
        assert_eq!(result.population_count, Some(1));
        assert_eq!(result.drift_class.as_deref(), Some(COMPATIBLE));
    }

    #[test]
    fn er1_delisted_landing_rejects_proposed_only_without_forcing_drift() {
        let html = br#"<a href="https://nsearchives.nseindia.com/proposed/List%20of%20Companies%20Proposed%20to%20be%20Delisted.xlsx">Proposed</a>"#.to_vec();
        let fetch = successful_fetch("https://www.nseindia.com/delisted", html);
        let discovered = fetch.usable_body().and_then(|bytes| {
            let page_html = String::from_utf8_lossy(bytes);
            discover_nse_actual_delisted_workbook_url_for_health(&page_html)
        });
        let result = assess_nse_delisted_landing(&fetch, discovered.as_deref());

        assert_eq!(result.format_status, FAIL);
        assert_eq!(result.drift_class, None);
        assert!(result.reason.contains("no drift class is forced"));
    }

    #[test]
    fn er1_delisted_workbook_requires_non_empty_symbol_column() {
        let fetch = successful_fetch("https://nsearchives.nseindia.com/delisted.xlsx", delisted_workbook_bytes());
        let result = assess_nse_delisted_workbook(&fetch);

        assert_eq!(result.format_status, PASS);
        assert_eq!(result.population_status, PASS);
        assert_eq!(result.population_count, Some(1));
        assert_eq!(result.drift_class.as_deref(), Some(COMPATIBLE));
    }

    #[test]
    fn er1_transport_failure_never_forces_a_drift_class() {
        let mut fetch = FetchEvidence::unavailable("https://nsearchives.nseindia.com/equity.csv");
        fetch.provenance_status = PASS.to_string();
        fetch.transport_status = FAIL.to_string();
        fetch.reason = "network timeout".to_string();

        let result = assess_nse_equity_master(&fetch);

        assert_eq!(result.format_status, NOT_EVALUATED);
        assert_eq!(result.population_status, NOT_EVALUATED);
        assert_eq!(result.drift_class, None);
        assert_eq!(result.reason, "network timeout");
    }
}

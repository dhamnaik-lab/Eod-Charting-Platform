use reqwest::Url;
use std::collections::BTreeMap;

use super::official_source_urls::validate_nse_official_source_url;

const ER3A_DISCOVERY_AUTHORITY: &str = "DISCOVERED_NOT_PROMOTED";
const ER3A_MAX_HREFS: usize = 256;
const ER3A_MAX_CANDIDATES: usize = 25;
const ER3A_MAX_REJECTIONS: usize = 50;

const NSE_CURRENT_EQUITY_MASTER: &str = "NSE_CURRENT_EQUITY_MASTER";
const NSE_CURRENT_SME_MASTER: &str = "NSE_CURRENT_SME_MASTER";
const NSE_SYMBOL_CHANGE_HISTORY: &str = "NSE_SYMBOL_CHANGE_HISTORY";
const NSE_COMPANY_NAME_CHANGE_HISTORY: &str = "NSE_COMPANY_NAME_CHANGE_HISTORY";
const NSE_DELISTED_COMPANIES_WORKBOOK: &str = "NSE_DELISTED_COMPANIES_WORKBOOK";

#[derive(Clone, Debug)]
pub(crate) struct NseOfficialSourceDiscoveryRequest<'a> {
    pub source_id: &'a str,
    pub source_role: &'a str,
    pub configured_url: &'a str,
    pub landing_page_url: &'a str,
    pub landing_page_html: &'a str,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NseOfficialSourceDiscoveryCandidate {
    pub url: String,
    pub discovered_from: String,
    pub reason: String,
    pub discovery_authority: &'static str,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NseOfficialSourceDiscoveryRejection {
    pub raw_href: String,
    pub reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NseOfficialSourceDiscoveryReport {
    pub source_id: String,
    pub source_role: String,
    pub configured_url: String,
    pub landing_page_url: String,
    pub candidates: Vec<NseOfficialSourceDiscoveryCandidate>,
    pub rejected_candidates: Vec<NseOfficialSourceDiscoveryRejection>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum NseDiscoveryContract {
    CurrentEquityMaster,
    CurrentSmeMaster,
    SymbolChangeHistory,
    CompanyNameChangeHistory,
    DelistedCompaniesWorkbook,
}

impl NseDiscoveryContract {
    pub(crate) fn from_source_id(source_id: &str) -> Result<Self, String> {
        match source_id {
            NSE_CURRENT_EQUITY_MASTER => Ok(Self::CurrentEquityMaster),
            NSE_CURRENT_SME_MASTER => Ok(Self::CurrentSmeMaster),
            NSE_SYMBOL_CHANGE_HISTORY => Ok(Self::SymbolChangeHistory),
            NSE_COMPANY_NAME_CHANGE_HISTORY => Ok(Self::CompanyNameChangeHistory),
            NSE_DELISTED_COMPANIES_WORKBOOK => Ok(Self::DelistedCompaniesWorkbook),
            _ => Err(format!(
                "ER3A_UNSUPPORTED_SOURCE_ID: '{source_id}' is not an approved NSE ER3-A source contract."
            )),
        }
    }

    pub(crate) fn source_id(self) -> &'static str {
        match self {
            Self::CurrentEquityMaster => NSE_CURRENT_EQUITY_MASTER,
            Self::CurrentSmeMaster => NSE_CURRENT_SME_MASTER,
            Self::SymbolChangeHistory => NSE_SYMBOL_CHANGE_HISTORY,
            Self::CompanyNameChangeHistory => NSE_COMPANY_NAME_CHANGE_HISTORY,
            Self::DelistedCompaniesWorkbook => NSE_DELISTED_COMPANIES_WORKBOOK,
        }
    }

    pub(crate) fn source_role(self) -> &'static str {
        match self {
            Self::CurrentEquityMaster => "CURRENT_IDENTITY_MASTER",
            Self::CurrentSmeMaster => "CURRENT_IDENTITY_MASTER_SME",
            Self::SymbolChangeHistory => "HISTORICAL_SYMBOL_CONTINUITY",
            Self::CompanyNameChangeHistory => "HISTORICAL_NAME_CONTINUITY",
            Self::DelistedCompaniesWorkbook => "DELISTED_LIFECYCLE_EVIDENCE",
        }
    }

    fn from_request(source_id: &str, source_role: &str) -> Result<Self, String> {
        let contract = Self::from_source_id(source_id)?;
        let expected_role = contract.source_role();
        if source_role != expected_role {
            return Err(format!(
                "ER3A_SOURCE_ROLE_MISMATCH: source '{source_id}' requires role '{expected_role}', got '{source_role}'."
            ));
        }
        Ok(contract)
    }

    fn semantic_score(self, configured: &Url, candidate: &Url, _context: &str) -> Option<u8> {
        let configured_filename = url_filename(configured);
        let candidate_filename = url_filename(candidate);
        if !configured_filename.is_empty()
            && configured_filename.eq_ignore_ascii_case(&candidate_filename)
        {
            if self == Self::DelistedCompaniesWorkbook
                && contains_proposed_delisting(candidate.as_str())
            {
                return None;
            }
            return Some(0);
        }

        let url_text = candidate.as_str().to_ascii_lowercase();
        let is_csv = candidate.path().to_ascii_lowercase().ends_with(".csv");
        let is_xlsx = candidate.path().to_ascii_lowercase().ends_with(".xlsx");

        match self {
            Self::CurrentEquityMaster => {
                if is_csv && url_text.contains("equity") && !url_text.contains("sme") {
                    return Some(10);
                }
            }
            Self::CurrentSmeMaster => {
                if is_csv && url_text.contains("sme") && url_text.contains("equity") {
                    return Some(10);
                }
            }
            Self::SymbolChangeHistory => {
                if is_csv && url_text.contains("symbol") && url_text.contains("change") {
                    return Some(10);
                }
            }
            Self::CompanyNameChangeHistory => {
                if is_csv && url_text.contains("name") && url_text.contains("change") {
                    return Some(10);
                }
            }
            Self::DelistedCompaniesWorkbook => {
                if is_xlsx
                    && !contains_proposed_delisting(candidate.as_str())
                    && url_text.contains("delist")
                    && url_text.contains("compan")
                {
                    return Some(10);
                }
            }
        }

        None
    }
}

#[derive(Clone, Debug)]
struct ExtractedHref {
    raw_href: String,
    context: String,
}

#[derive(Clone, Debug)]
struct ScoredCandidate {
    score: u8,
    candidate: NseOfficialSourceDiscoveryCandidate,
}

pub(crate) fn discover_nse_official_source_candidates(
    request: &NseOfficialSourceDiscoveryRequest<'_>,
) -> Result<NseOfficialSourceDiscoveryReport, String> {
    let contract = NseDiscoveryContract::from_request(request.source_id, request.source_role)?;

    validate_nse_official_source_url(request.configured_url)?;
    validate_nse_official_source_url(request.landing_page_url)?;

    let mut configured_url = Url::parse(request.configured_url).map_err(|error| {
        format!("ER3A_INVALID_CONFIGURED_URL: could not parse configured URL: {error}")
    })?;
    configured_url.set_fragment(None);

    let mut landing_page_url = Url::parse(request.landing_page_url).map_err(|error| {
        format!("ER3A_INVALID_LANDING_PAGE_URL: could not parse landing-page URL: {error}")
    })?;
    landing_page_url.set_fragment(None);

    let configured_canonical = configured_url.as_str().to_string();
    let landing_canonical = landing_page_url.as_str().to_string();
    let mut accepted_by_url: BTreeMap<String, ScoredCandidate> = BTreeMap::new();
    let mut rejections: BTreeMap<(String, String), NseOfficialSourceDiscoveryRejection> =
        BTreeMap::new();

    for extracted in extract_hrefs(request.landing_page_html, ER3A_MAX_HREFS) {
        let raw_href = decode_minimal_html_entities(extracted.raw_href.trim());
        if raw_href.is_empty() {
            insert_rejection(&mut rejections, raw_href, "EMPTY_HREF");
            continue;
        }

        let mut resolved = match landing_page_url.join(&raw_href) {
            Ok(url) => url,
            Err(_) => {
                insert_rejection(&mut rejections, raw_href, "MALFORMED_URL");
                continue;
            }
        };
        resolved.set_fragment(None);
        let resolved_url = resolved.as_str().to_string();

        if validate_nse_official_source_url(&resolved_url).is_err() {
            insert_rejection(&mut rejections, raw_href, "PROVENANCE_REJECTED");
            continue;
        }

        if resolved_url == configured_canonical {
            insert_rejection(
                &mut rejections,
                raw_href,
                "CONFIGURED_URL_UNCHANGED",
            );
            continue;
        }

        let Some(score) = contract.semantic_score(&configured_url, &resolved, &extracted.context)
        else {
            insert_rejection(&mut rejections, raw_href, "SOURCE_ROLE_MISMATCH");
            continue;
        };

        if accepted_by_url.contains_key(&resolved_url) {
            insert_rejection(&mut rejections, raw_href, "DUPLICATE_CANDIDATE");
            continue;
        }

        let reason = if score == 0 {
            "EXACT_FILENAME_MATCH"
        } else {
            "SOURCE_ROLE_MATCH"
        };
        accepted_by_url.insert(
            resolved_url.clone(),
            ScoredCandidate {
                score,
                candidate: NseOfficialSourceDiscoveryCandidate {
                    url: resolved_url,
                    discovered_from: landing_canonical.clone(),
                    reason: reason.to_string(),
                    discovery_authority: ER3A_DISCOVERY_AUTHORITY,
                },
            },
        );
    }

    let mut scored_candidates: Vec<_> = accepted_by_url.into_values().collect();
    scored_candidates.sort_by(|left, right| {
        left.score
            .cmp(&right.score)
            .then_with(|| left.candidate.url.cmp(&right.candidate.url))
    });

    if scored_candidates.len() > ER3A_MAX_CANDIDATES {
        for overflow in scored_candidates.iter().skip(ER3A_MAX_CANDIDATES) {
            insert_rejection(
                &mut rejections,
                overflow.candidate.url.clone(),
                "CANDIDATE_LIMIT_EXCEEDED",
            );
        }
        scored_candidates.truncate(ER3A_MAX_CANDIDATES);
    }

    let candidates = scored_candidates
        .into_iter()
        .map(|item| item.candidate)
        .collect();
    let rejected_candidates = rejections
        .into_values()
        .take(ER3A_MAX_REJECTIONS)
        .collect();

    Ok(NseOfficialSourceDiscoveryReport {
        source_id: request.source_id.to_string(),
        source_role: request.source_role.to_string(),
        configured_url: configured_canonical,
        landing_page_url: landing_canonical,
        candidates,
        rejected_candidates,
    })
}

fn insert_rejection(
    rejections: &mut BTreeMap<(String, String), NseOfficialSourceDiscoveryRejection>,
    raw_href: String,
    reason: &str,
) {
    let key = (raw_href.clone(), reason.to_string());
    rejections.entry(key).or_insert_with(|| NseOfficialSourceDiscoveryRejection {
        raw_href,
        reason: reason.to_string(),
    });
}

fn url_filename(url: &Url) -> String {
    url.path_segments()
        .and_then(|mut parts| parts.next_back())
        .unwrap_or_default()
        .to_string()
}

fn contains_proposed_delisting(url: &str) -> bool {
    let url = url.to_ascii_lowercase();
    url.contains("proposed") && url.contains("delist")
}

fn extract_hrefs(html: &str, limit: usize) -> Vec<ExtractedHref> {
    let bytes = html.as_bytes();
    let lower = html.to_ascii_lowercase();
    let lower_bytes = lower.as_bytes();
    let mut results = Vec::new();
    let mut cursor = 0usize;

    while cursor + 4 <= lower_bytes.len() && results.len() < limit {
        let Some(relative) = find_ascii_sequence(&lower_bytes[cursor..], b"href") else {
            break;
        };
        let start = cursor + relative;
        cursor = start + 4;

        if start > 0 && is_attribute_name_byte(lower_bytes[start - 1]) {
            continue;
        }
        if cursor < lower_bytes.len() && is_attribute_name_byte(lower_bytes[cursor]) {
            continue;
        }

        while cursor < lower_bytes.len() && lower_bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= lower_bytes.len() || lower_bytes[cursor] != b'=' {
            continue;
        }
        cursor += 1;
        while cursor < lower_bytes.len() && lower_bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= lower_bytes.len() {
            break;
        }

        let quote = if lower_bytes[cursor] == b'\'' || lower_bytes[cursor] == b'"' {
            let quote = lower_bytes[cursor];
            cursor += 1;
            Some(quote)
        } else {
            None
        };
        let value_start = cursor;
        if let Some(quote) = quote {
            while cursor < lower_bytes.len() && lower_bytes[cursor] != quote {
                cursor += 1;
            }
        } else {
            while cursor < lower_bytes.len()
                && !lower_bytes[cursor].is_ascii_whitespace()
                && lower_bytes[cursor] != b'>'
            {
                cursor += 1;
            }
        }
        let value_end = cursor;
        if quote.is_some() && cursor < lower_bytes.len() {
            cursor += 1;
        }

        let raw_href = String::from_utf8_lossy(&bytes[value_start..value_end]).to_string();
        let context_start = value_start.saturating_sub(128);
        let context_end = (value_end + 128).min(bytes.len());
        let context = String::from_utf8_lossy(&bytes[context_start..context_end]).to_string();
        results.push(ExtractedHref { raw_href, context });
    }

    results
}

fn find_ascii_sequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn is_attribute_name_byte(value: u8) -> bool {
    value.is_ascii_alphanumeric() || value == b'-' || value == b'_'
}

fn decode_minimal_html_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&AMP;", "&")
        .replace("&quot;", "\"")
        .replace("&#34;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&#X27;", "'")
}

#[cfg(test)]
mod tests {
    use super::*;

    const LANDING: &str =
        "https://www.nseindia.com/static/market-data/securities-available-for-trading";
    const EQUITY_CONFIGURED: &str =
        "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

    fn equity_request<'a>(html: &'a str) -> NseOfficialSourceDiscoveryRequest<'a> {
        NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "CURRENT_IDENTITY_MASTER",
            configured_url: EQUITY_CONFIGURED,
            landing_page_url: LANDING,
            landing_page_html: html,
        }
    }

    #[test]
    fn er3a_accepts_absolute_official_nse_candidate() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://archives.nseindia.com/moved/EQUITY_L.csv">Equity master</a>"#,
        ))
        .expect("official NSE candidate should be discoverable");

        assert_eq!(report.candidates.len(), 1);
        assert_eq!(
            report.candidates[0].url,
            "https://archives.nseindia.com/moved/EQUITY_L.csv"
        );
        assert_eq!(report.candidates[0].discovered_from, LANDING);
    }

    #[test]
    fn er3a_resolves_relative_official_candidate_against_trusted_landing_page() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="/downloads/EQUITY_L.csv?version=2">Download</a>"#,
        ))
        .unwrap();

        assert_eq!(report.candidates.len(), 1);
        assert_eq!(
            report.candidates[0].url,
            "https://www.nseindia.com/downloads/EQUITY_L.csv?version=2"
        );
    }

    #[test]
    fn er3a_deduplicates_candidates_deterministically() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"
            <a href="https://archives.nseindia.com/moved/EQUITY_L.csv">One</a>
            <a href="https://archives.nseindia.com/moved/EQUITY_L.csv#download">Two</a>
            "#,
        ))
        .unwrap();

        assert_eq!(report.candidates.len(), 1);
        assert_eq!(
            report.candidates[0].url,
            "https://archives.nseindia.com/moved/EQUITY_L.csv"
        );
    }

    #[test]
    fn er3a_rejects_non_https_candidate() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="http://archives.nseindia.com/moved/EQUITY_L.csv">HTTP</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.raw_href.starts_with("http://") && item.reason.contains("PROVENANCE")));
    }

    #[test]
    fn er3a_rejects_nse_lookalike_domain() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://nseindia.com.evil.example/EQUITY_L.csv">Fake</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.raw_href.contains("nseindia.com.evil.example")));
    }

    #[test]
    fn er3a_rejects_unapproved_nse_subdomain() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://downloads.nseindia.com/EQUITY_L.csv">Unapproved subdomain</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.raw_href.contains("downloads.nseindia.com")));
    }

    #[test]
    fn er3a_rejects_third_party_candidate() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://example.com/EQUITY_L.csv">Mirror</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert_eq!(report.rejected_candidates.len(), 1);
    }

    #[test]
    fn er3a_rejects_bse_candidate_from_nse_discovery() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://www.bseindia.com/EQUITY_L.csv">Wrong exchange</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.raw_href.contains("bseindia.com")));
    }

    #[test]
    fn er3a_candidate_order_is_score_then_lexical_and_input_order_independent() {
        let a = equity_request(
            r#"
            <a href="https://nsearchives.nseindia.com/z/EQUITY_L.csv?b=2">Z</a>
            <a href="https://archives.nseindia.com/a/EQUITY_L.csv?a=1">A</a>
            "#,
        );
        let b = equity_request(
            r#"
            <a href="https://archives.nseindia.com/a/EQUITY_L.csv?a=1">A</a>
            <a href="https://nsearchives.nseindia.com/z/EQUITY_L.csv?b=2">Z</a>
            "#,
        );

        let report_a = discover_nse_official_source_candidates(&a).unwrap();
        let report_b = discover_nse_official_source_candidates(&b).unwrap();

        let urls_a: Vec<_> = report_a.candidates.iter().map(|item| item.url.as_str()).collect();
        let urls_b: Vec<_> = report_b.candidates.iter().map(|item| item.url.as_str()).collect();
        assert_eq!(urls_a, urls_b);
        assert_eq!(
            urls_a,
            vec![
                "https://archives.nseindia.com/a/EQUITY_L.csv?a=1",
                "https://nsearchives.nseindia.com/z/EQUITY_L.csv?b=2"
            ]
        );
    }

    #[test]
    fn er3a_candidate_is_discovery_only_and_never_approved() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://archives.nseindia.com/moved/EQUITY_L.csv">Equity</a>"#,
        ))
        .unwrap();

        assert_eq!(report.candidates[0].discovery_authority, "DISCOVERED_NOT_PROMOTED");
        assert!(report.candidates[0].reason.contains("MATCH"));
    }

    #[test]
    fn er3a_malformed_html_fails_safely_without_panicking() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"garbage <a href='https://archives.nseindia.com/EQUITY_L.csv><<<<<"#,
        ))
        .expect("malformed page text must not crash discovery");

        assert!(report.candidates.is_empty());
        assert!(report.rejected_candidates.len() <= 50);
    }

    #[test]
    fn er3a_rejects_configured_url_as_unchanged_not_replacement() {
        let report = discover_nse_official_source_candidates(&equity_request(
            r#"<a href="https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv">Current</a>"#,
        ))
        .unwrap();

        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.reason == "CONFIGURED_URL_UNCHANGED"));
    }

    #[test]
    fn er3a_supports_all_frozen_nse_source_contract_roles() {
        let cases = [
            (
                "NSE_CURRENT_SME_MASTER",
                "CURRENT_IDENTITY_MASTER_SME",
                "https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv",
                "https://archives.nseindia.com/moved/SME_EQUITY_L.csv",
            ),
            (
                "NSE_SYMBOL_CHANGE_HISTORY",
                "HISTORICAL_SYMBOL_CONTINUITY",
                "https://nsearchives.nseindia.com/content/equities/symbolchange.csv",
                "https://archives.nseindia.com/moved/symbolchange.csv",
            ),
            (
                "NSE_COMPANY_NAME_CHANGE_HISTORY",
                "HISTORICAL_NAME_CONTINUITY",
                "https://nsearchives.nseindia.com/content/equities/namechange.csv",
                "https://archives.nseindia.com/moved/namechange.csv",
            ),
            (
                "NSE_DELISTED_COMPANIES_WORKBOOK",
                "DELISTED_LIFECYCLE_EVIDENCE",
                "https://nsearchives.nseindia.com/web/sites/default/files/inline-files/List%20of%20delisted%20Companies.xlsx",
                "https://archives.nseindia.com/moved/List%20of%20delisted%20Companies.xlsx",
            ),
        ];

        for (source_id, source_role, configured_url, candidate_url) in cases {
            let html = format!(r#"<a href="{candidate_url}">Download</a>"#);
            let request = NseOfficialSourceDiscoveryRequest {
                source_id,
                source_role,
                configured_url,
                landing_page_url: LANDING,
                landing_page_html: &html,
            };
            let report = discover_nse_official_source_candidates(&request)
                .unwrap_or_else(|error| panic!("{source_id} should be supported: {error}"));
            assert_eq!(report.candidates.len(), 1, "{source_id}");
        }
    }

    #[test]
    fn er3a_delisted_rejects_proposed_only_workbook() {
        let request = NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_DELISTED_COMPANIES_WORKBOOK",
            source_role: "DELISTED_LIFECYCLE_EVIDENCE",
            configured_url: "https://nsearchives.nseindia.com/web/sites/default/files/inline-files/List%20of%20delisted%20Companies.xlsx",
            landing_page_url: "https://www.nseindia.com/static/list/list-of-companies-proposed-to-be-delisted",
            landing_page_html: r#"<a href="https://archives.nseindia.com/List%20of%20Companies%20Proposed%20to%20be%20Delisted.xlsx">Proposed</a>"#,
        };

        let report = discover_nse_official_source_candidates(&request).unwrap();
        assert!(report.candidates.is_empty());
        assert!(report
            .rejected_candidates
            .iter()
            .any(|item| item.reason == "SOURCE_ROLE_MISMATCH"));
    }

    #[test]
    fn er3a_unknown_source_id_fails_closed() {
        let request = NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_UNKNOWN_SOURCE",
            source_role: "UNKNOWN",
            configured_url: EQUITY_CONFIGURED,
            landing_page_url: LANDING,
            landing_page_html: "",
        };

        let error = discover_nse_official_source_candidates(&request)
            .expect_err("unknown source IDs must fail closed");
        assert!(error.contains("ER3A_UNSUPPORTED_SOURCE_ID"));
    }

    #[test]
    fn er3a_source_role_mismatch_fails_closed() {
        let request = NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "HISTORICAL_SYMBOL_CONTINUITY",
            configured_url: EQUITY_CONFIGURED,
            landing_page_url: LANDING,
            landing_page_html: "",
        };

        let error = discover_nse_official_source_candidates(&request)
            .expect_err("source role must match the frozen source contract");
        assert!(error.contains("ER3A_SOURCE_ROLE_MISMATCH"));
    }

    #[test]
    fn er3a_invalid_configured_url_fails_closed() {
        let request = NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "CURRENT_IDENTITY_MASTER",
            configured_url: "https://evil.example/EQUITY_L.csv",
            landing_page_url: LANDING,
            landing_page_html: "",
        };

        let error = discover_nse_official_source_candidates(&request)
            .expect_err("configured authority must be official NSE");
        assert!(error.contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED"));
    }

    #[test]
    fn er3a_invalid_landing_page_url_fails_closed() {
        let request = NseOfficialSourceDiscoveryRequest {
            source_id: "NSE_CURRENT_EQUITY_MASTER",
            source_role: "CURRENT_IDENTITY_MASTER",
            configured_url: EQUITY_CONFIGURED,
            landing_page_url: "https://evil.example/landing",
            landing_page_html: "",
        };

        let error = discover_nse_official_source_candidates(&request)
            .expect_err("landing-page authority must be official NSE");
        assert!(error.contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED"));
    }
}

use reqwest::{redirect::Policy, Url};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use super::settings::read_setting_value;

pub const OFFICIAL_SOURCE_URLS_SETTING_KEY: &str = "officialSourceUrls.v1";

pub const DEFAULT_NSE_SECURITIES_AVAILABLE_PAGE_URL: &str =
    "https://www.nseindia.com/static/market-data/securities-available-for-trading";
pub const DEFAULT_NSE_EQUITY_MASTER_URL: &str =
    "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
pub const DEFAULT_NSE_SME_MASTER_URL: &str =
    "https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv";
pub const DEFAULT_NSE_SYMBOL_CHANGE_URL: &str =
    "https://nsearchives.nseindia.com/content/equities/symbolchange.csv";
pub const DEFAULT_NSE_COMPANY_NAME_CHANGE_URL: &str =
    "https://nsearchives.nseindia.com/content/equities/namechange.csv";
pub const DEFAULT_NSE_DELISTED_PAGE_URL: &str =
    "https://www.nseindia.com/static/list/list-of-companies-proposed-to-be-delisted";
pub const DEFAULT_NSE_DELISTED_WORKBOOK_URL: &str =
    "https://nsearchives.nseindia.com/web/sites/default/files/inline-files/List%20of%20delisted%20Companies.xlsx";
pub const DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX: &str =
    "https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?Group=&Scripcode=&segment=Equity&status=";
pub const DEFAULT_BSE_LIST_SCRIPS_REFERER: &str =
    "https://www.bseindia.com/corporates/List_Scrips.html";

const NSE_OFFICIAL_SOURCE_HOSTS: &[&str] = &[
    "nseindia.com",
    "www.nseindia.com",
    "nsearchives.nseindia.com",
    "archives.nseindia.com",
];
const BSE_OFFICIAL_SOURCE_HOSTS: &[&str] =
    &["bseindia.com", "www.bseindia.com", "api.bseindia.com"];
const OFFICIAL_SOURCE_PROVENANCE_REJECTED: &str = "OFFICIAL_SOURCE_PROVENANCE_REJECTED";

pub fn validate_nse_official_source_url(value: &str) -> Result<(), String> {
    validate_official_source_url("NSE", value, NSE_OFFICIAL_SOURCE_HOSTS)
}

pub fn validate_bse_official_source_url(value: &str) -> Result<(), String> {
    validate_official_source_url("BSE", value, BSE_OFFICIAL_SOURCE_HOSTS)
}

pub fn nse_official_redirect_policy() -> Policy {
    official_source_redirect_policy("NSE", NSE_OFFICIAL_SOURCE_HOSTS)
}

pub fn bse_official_redirect_policy() -> Policy {
    official_source_redirect_policy("BSE", BSE_OFFICIAL_SOURCE_HOSTS)
}

fn validate_official_source_url(
    exchange: &str,
    value: &str,
    allowed_hosts: &[&str],
) -> Result<(), String> {
    let parsed = Url::parse(value).map_err(|error| {
        format!(
            "{OFFICIAL_SOURCE_PROVENANCE_REJECTED}: {exchange} official source URL is invalid: {error}"
        )
    })?;

    if parsed.scheme() != "https" {
        return Err(format!(
            "{OFFICIAL_SOURCE_PROVENANCE_REJECTED}: {exchange} official source URL must use HTTPS."
        ));
    }

    let Some(host) = parsed.host_str() else {
        return Err(format!(
            "{OFFICIAL_SOURCE_PROVENANCE_REJECTED}: {exchange} official source URL has no host."
        ));
    };

    if !allowed_hosts
        .iter()
        .any(|allowed| host.eq_ignore_ascii_case(allowed))
    {
        return Err(format!(
            "{OFFICIAL_SOURCE_PROVENANCE_REJECTED}: {exchange} host '{host}' is outside the approved official host boundary."
        ));
    }

    Ok(())
}

fn official_source_redirect_policy(
    exchange: &'static str,
    allowed_hosts: &'static [&'static str],
) -> Policy {
    Policy::custom(move |attempt| {
        if attempt.previous().len() > 10 {
            return attempt.error(
                "OFFICIAL_SOURCE_PROVENANCE_REJECTED: official-source redirect chain exceeded 10 hops.",
            );
        }

        match validate_official_source_url(exchange, attempt.url().as_str(), allowed_hosts) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                error,
            )),
        }
    })
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceUrls {
    pub nse_securities_available_page_url: String,
    pub nse_equity_master_url: String,
    pub nse_sme_master_url: String,
    pub nse_symbol_change_url: String,
    pub nse_company_name_change_url: String,
    pub nse_delisted_page_url: String,
    pub nse_delisted_workbook_url: String,
    pub bse_list_scrips_url_prefix: String,
    pub bse_list_scrips_referer: String,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfficialSourceUrlOverrides {
    nse_securities_available_page_url: Option<String>,
    nse_equity_master_url: Option<String>,
    nse_sme_master_url: Option<String>,
    nse_symbol_change_url: Option<String>,
    nse_company_name_change_url: Option<String>,
    nse_delisted_page_url: Option<String>,
    nse_delisted_workbook_url: Option<String>,
    bse_list_scrips_url_prefix: Option<String>,
    bse_list_scrips_referer: Option<String>,
}

impl OfficialSourceUrls {
    pub(crate) fn defaults() -> Self {
        Self {
            nse_securities_available_page_url: DEFAULT_NSE_SECURITIES_AVAILABLE_PAGE_URL
                .to_string(),
            nse_equity_master_url: DEFAULT_NSE_EQUITY_MASTER_URL.to_string(),
            nse_sme_master_url: DEFAULT_NSE_SME_MASTER_URL.to_string(),
            nse_symbol_change_url: DEFAULT_NSE_SYMBOL_CHANGE_URL.to_string(),
            nse_company_name_change_url: DEFAULT_NSE_COMPANY_NAME_CHANGE_URL.to_string(),
            nse_delisted_page_url: DEFAULT_NSE_DELISTED_PAGE_URL.to_string(),
            nse_delisted_workbook_url: DEFAULT_NSE_DELISTED_WORKBOOK_URL.to_string(),
            bse_list_scrips_url_prefix: DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX.to_string(),
            bse_list_scrips_referer: DEFAULT_BSE_LIST_SCRIPS_REFERER.to_string(),
        }
    }

    fn apply(&mut self, overrides: OfficialSourceUrlOverrides) {
        apply_url(
            &mut self.nse_securities_available_page_url,
            overrides.nse_securities_available_page_url,
        );
        apply_url(
            &mut self.nse_equity_master_url,
            overrides.nse_equity_master_url,
        );
        apply_url(&mut self.nse_sme_master_url, overrides.nse_sme_master_url);
        apply_url(
            &mut self.nse_symbol_change_url,
            overrides.nse_symbol_change_url,
        );
        apply_url(
            &mut self.nse_company_name_change_url,
            overrides.nse_company_name_change_url,
        );
        apply_url(
            &mut self.nse_delisted_page_url,
            overrides.nse_delisted_page_url,
        );
        apply_url(
            &mut self.nse_delisted_workbook_url,
            overrides.nse_delisted_workbook_url,
        );
        apply_url(
            &mut self.bse_list_scrips_url_prefix,
            overrides.bse_list_scrips_url_prefix,
        );
        apply_url(
            &mut self.bse_list_scrips_referer,
            overrides.bse_list_scrips_referer,
        );
    }
}

pub(crate) fn load_legacy_official_source_urls(
    connection: Option<&Connection>,
) -> OfficialSourceUrls {
    let mut urls = OfficialSourceUrls::defaults();
    let Some(connection) = connection else {
        return urls;
    };
    let Ok(Some(raw)) = read_setting_value(connection, OFFICIAL_SOURCE_URLS_SETTING_KEY) else {
        return urls;
    };
    if let Ok(overrides) = serde_json::from_str::<OfficialSourceUrlOverrides>(&raw) {
        urls.apply(overrides);
    }
    urls
}

pub fn load_official_source_urls(
    connection: Option<&Connection>,
) -> Result<OfficialSourceUrls, String> {
    let Some(connection) = connection else {
        return Ok(OfficialSourceUrls::defaults());
    };

    if let Some(urls) =
        super::official_source_version_history::try_load_official_source_urls_from_ledger(
            connection,
        )?
    {
        return Ok(urls);
    }

    Ok(load_legacy_official_source_urls(Some(connection)))
}

fn apply_url(target: &mut String, override_value: Option<String>) {
    let Some(value) = override_value else {
        return;
    };
    let trimmed = value.trim();
    if !trimmed.is_empty() {
        *target = trimmed.to_string();
    }
}

#[cfg(test)]
mod runtime_provenance_tests {
    use super::*;

    #[test]
    fn official_source_runtime_provenance_accepts_frozen_nse_hosts() {
        for url in [
            "https://nseindia.com/source.csv",
            "https://www.nseindia.com/source.csv",
            "https://nsearchives.nseindia.com/source.csv",
            "https://archives.nseindia.com/source.csv",
        ] {
            assert!(
                validate_nse_official_source_url(url).is_ok(),
                "frozen NSE official host should be accepted: {url}"
            );
        }
    }

    #[test]
    fn official_source_runtime_provenance_rejects_non_https_and_nse_lookalikes() {
        for url in [
            "http://www.nseindia.com/source.csv",
            "https://nseindia.com.evil.example/source.csv",
            "https://sub.nseindia.com/source.csv",
            "https://evil.example/source.csv",
            "not-a-url",
        ] {
            let error = validate_nse_official_source_url(url)
                .expect_err("non-official NSE runtime source must fail closed");
            assert!(
                error.contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED"),
                "NSE rejection must be explicit: {error}"
            );
        }
    }

    #[test]
    fn official_source_runtime_provenance_accepts_frozen_bse_hosts() {
        for url in [
            "https://bseindia.com/source.csv",
            "https://www.bseindia.com/source.csv",
            "https://api.bseindia.com/source.csv",
        ] {
            assert!(
                validate_bse_official_source_url(url).is_ok(),
                "frozen BSE official host should be accepted: {url}"
            );
        }
    }

    #[test]
    fn official_source_runtime_provenance_rejects_non_https_and_bse_lookalikes() {
        for url in [
            "http://www.bseindia.com/source.csv",
            "https://bseindia.com.evil.example/source.csv",
            "https://sub.bseindia.com/source.csv",
            "https://evil.example/source.csv",
            "not-a-url",
        ] {
            let error = validate_bse_official_source_url(url)
                .expect_err("non-official BSE runtime source must fail closed");
            assert!(
                error.contains("OFFICIAL_SOURCE_PROVENANCE_REJECTED"),
                "BSE rejection must be explicit: {error}"
            );
        }
    }

    #[test]
    fn official_source_runtime_provenance_does_not_rewrite_saved_override() {
        let mut target = DEFAULT_NSE_EQUITY_MASTER_URL.to_string();
        let configured = "https://example.invalid/custom.csv".to_string();

        apply_url(&mut target, Some(configured.clone()));

        assert_eq!(
            target, configured,
            "F5 runtime enforcement must not redesign or rewrite saved override settings"
        );
    }
}

#[cfg(test)]
mod f2_official_namechange_acquisition_tests {
    use super::*;

    #[test]
    fn f2_official_namechange_default_url_is_frozen() {
        assert_eq!(
            DEFAULT_NSE_COMPANY_NAME_CHANGE_URL,
            "https://nsearchives.nseindia.com/content/equities/namechange.csv"
        );

        let urls = OfficialSourceUrls::defaults();
        assert_eq!(
            urls.nse_company_name_change_url,
            DEFAULT_NSE_COMPANY_NAME_CHANGE_URL
        );
    }

    #[test]
    fn f2_official_namechange_override_is_supported_without_rewriting() {
        let mut urls = OfficialSourceUrls::defaults();
        let configured =
            "https://nsearchives.nseindia.com/content/equities/namechange-custom.csv".to_string();

        let overrides: OfficialSourceUrlOverrides = serde_json::from_value(serde_json::json!({
            "nseCompanyNameChangeUrl": configured.clone()
        }))
        .expect("F2 namechange override should deserialize");

        urls.apply(overrides);

        assert_eq!(urls.nse_company_name_change_url, configured);
    }
}

//! Official lifecycle CSV transport only. Never applies instrument or price changes.
use super::*;
use crate::bhavcopy::bse_price_history::{collect_official, BrowserRequest};
use crate::database::official_source_urls::{
    bse_official_redirect_policy, validate_bse_official_source_url,
    DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX,
};
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, REFERER, USER_AGENT};
use std::collections::BTreeMap;
use std::sync::{atomic::AtomicBool, Arc};
use std::time::Duration;

const PAGE: &str = "https://www.bseindia.com/corporates/List_Scrips";
const MAX_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone)]
struct MasterScope {
    url: String,
    status: &'static str,
    lifecycle: &'static str,
}

pub(super) fn canonical(raw: &str) -> Option<(String, BTreeMap<String, String>)> {
    let mut url = reqwest::Url::parse(raw).ok()?;
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let mut query = BTreeMap::new();
    for (key, value) in url.query_pairs() {
        if query.insert(key.into_owned(), value.into_owned()).is_some() {
            return None;
        }
    }
    url.set_query(None);
    Some((url.into(), query))
}

impl MasterScope {
    fn new(status: &str, url: &str) -> AppResult<Self> {
        let &(status, lifecycle) = BSE_LIFECYCLE_STATUSES
            .iter()
            .find(|(allowed, _)| *allowed == status)
            .ok_or("Unsupported BSE lifecycle status.")?;
        let expected = format!("{DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX}{status}");
        if !matches!((canonical(url),canonical(&expected)),(Some(a),Some(b)) if a==b) {
            return Err("BSE browser recovery requires the exact official lifecycle CSV endpoint; the configured URL was not substituted.".into());
        }
        Ok(Self {
            url: url.to_string(),
            status,
            lifecycle,
        })
    }
}

impl BrowserRequest for MasterScope {
    fn page_url(&self) -> &'static str {
        PAGE
    }
    fn request_url(&self) -> &str {
        &self.url
    }
    fn matches(&self, raw: &str) -> bool {
        matches!((canonical(raw),canonical(&self.url)),(Some(a),Some(b)) if a==b)
    }
    fn download_body_capture(&self) -> bool {
        true
    }
    fn permits_resource(&self, raw: &str) -> bool {
        if self.matches(raw) {
            return true;
        }
        let Ok(url) = reqwest::Url::parse(raw) else {
            return false;
        };
        url.scheme() == "https"
            && url.host_str() == Some("www.bseindia.com")
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
            && (raw == PAGE || url.path().starts_with("/assets/") || url.path() == "/env.js")
    }
    fn validate(&self, status: i32, bytes: &[u8]) -> AppResult<usize> {
        if status != 200 {
            return Err(format!(
                "BSE {} browser download returned HTTP {status}.",
                self.status
            ));
        }
        validate_csv(self.status, self.lifecycle, bytes)
    }
    fn validate_download(&self, bytes: &[u8]) -> AppResult<usize> {
        self.validate(200, bytes)
    }
}

fn validate_csv(status: &str, lifecycle: &str, bytes: &[u8]) -> AppResult<usize> {
    if bytes.len() > MAX_BYTES {
        return Err("BSE master response exceeds 8 MiB.".into());
    }
    let csv =
        std::str::from_utf8(bytes).map_err(|e| format!("BSE {status} CSV is not UTF-8: {e}"))?;
    if !csv
        .trim_start_matches('\u{feff}')
        .trim_start()
        .starts_with("Security Code")
    {
        return Err(format!("BSE {status} response is not the expected master CSV; saved sources were not replaced."));
    }
    let mut tagged = String::new();
    append_bse_lifecycle_csv(&mut tagged, csv, lifecycle)?;
    let rows = load_bse_master_rows_from_bytes(
        tagged.as_bytes(),
        &format!("BSE official {status} master"),
    )?;
    if status == "Active" {
        validate_bse_current_population_sanity(rows.len(), 0, 0)?;
    }
    Ok(rows.len())
}

fn client() -> AppResult<Client> {
    Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(bse_official_redirect_policy())
        .build()
        .map_err(|e| e.to_string())
}

fn direct(client: &Client, url: &str, referer: &str) -> AppResult<(u16, Vec<u8>)> {
    validate_bse_official_source_url(url)?;
    validate_bse_official_source_url(referer)?;
    let response = client
        .get(url)
        .header(ACCEPT, "text/csv,*/*")
        .header(REFERER, referer)
        .header(USER_AGENT, BSE_USER_AGENT)
        .send()
        .map_err(|e| format!("BSE master connection failed: {e}"))?;
    validate_bse_official_source_url(response.url().as_str())?;
    let status = response.status().as_u16();
    let mut bytes = Vec::new();
    response
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    Ok((status, bytes))
}

fn fetch(
    status: &str,
    lifecycle: &str,
    url: &str,
    direct: &mut dyn FnMut() -> AppResult<(u16, Vec<u8>)>,
    browser: &mut dyn FnMut(MasterScope) -> AppResult<Vec<u8>>,
) -> AppResult<(Vec<u8>, bool)> {
    let (http, bytes) = direct()?;
    let recovered = http == 403;
    let bytes = if recovered {
        browser(MasterScope::new(status,url)?).map_err(|error|format!("BSE {status} direct download returned HTTP 403; browser recovery failed: {error}. Saved sources were not replaced."))?
    } else if http != 200 {
        return Err(format!("BSE {status} master download returned HTTP {http}; saved sources were not replaced. Retry later if the source is temporarily unavailable."));
    } else {
        bytes
    };
    validate_csv(status, lifecycle, &bytes)?;
    Ok((bytes, recovered))
}

fn save_bundle(
    folder: &Path,
    urls: &OfficialSourceUrls,
    fetch: &mut dyn FnMut(&str, &str, &str) -> AppResult<(Vec<u8>, bool)>,
) -> AppResult<BseCurrentUniverseMasterDownloadResult> {
    let mut combined = String::new();
    let mut rows_read = 0;
    let mut browser_count = 0;
    for (status, lifecycle) in BSE_LIFECYCLE_STATUSES {
        let url = format!("{}{status}", urls.bse_list_scrips_url_prefix);
        validate_bse_official_source_url(&url)?;
        let (bytes, recovered) = fetch(status, lifecycle, &url)?;
        rows_read += validate_csv(status, lifecycle, &bytes)? as u32;
        browser_count += u32::from(recovered);
        append_bse_lifecycle_csv(
            &mut combined,
            std::str::from_utf8(&bytes).map_err(|e| e.to_string())?,
            lifecycle,
        )?;
    }
    let rows =
        load_bse_master_rows_from_bytes(combined.as_bytes(), "BSE combined lifecycle download")?;
    let count = |kind: &str| {
        rows.iter()
            .filter(|row| row.lifecycle_status == kind)
            .count()
    };
    let (active, delisted, suspended) = (count("CURRENT"), count("DELISTED"), count("SUSPENDED"));
    validate_bse_current_population_sanity(active, delisted, suspended)?;
    let target = folder.join("reference-data/bse");
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let path = target.join(format!(
        "bse-lifecycle-master-{}.csv",
        chrono::Utc::now().format("%Y%m%d_%H%M%S_%f")
    ));
    use std::io::Write;
    let partial = path.with_extension("csv.partial");
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&partial)
        .map_err(|e| e.to_string())?;
    file.write_all(combined.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    if path.exists() {
        return Err(
            "BSE source destination already exists; saved sources were not overwritten.".into(),
        );
    }
    fs::rename(&partial, &path).map_err(|e| e.to_string())?;
    Ok(BseCurrentUniverseMasterDownloadResult {file_path:path.display().to_string(),
        source_url:format!("{}<Active|Delisted|Suspended>",urls.bse_list_scrips_url_prefix), rows_read,
        message:format!("Downloaded BSE lifecycle master with {active} active, {delisted} delisted, and {suspended} suspended symbols. Browser recovery used for {browser_count} sources.")})
}

pub(super) fn download(
    app: &AppHandle,
    folder: &Path,
    urls: &OfficialSourceUrls,
) -> AppResult<BseCurrentUniverseMasterDownloadResult> {
    validate_bse_official_source_url(&urls.bse_list_scrips_referer)?;
    let client = client()?;
    save_bundle(folder, urls, &mut |status, lifecycle, url| {
        fetch(
            status,
            lifecycle,
            url,
            &mut || direct(&client, url, &urls.bse_list_scrips_referer),
            &mut |scope| {
                crate::runtime::log_runtime_event(app,"INFO","bse-identity-browser-recovery",Some(&format!("{status}: direct HTTP 403; retrying exact official CSV through the native browser")));
                collect_official(app.clone(), scope, Arc::new(AtomicBool::new(false)))
            },
        )
    })
}

#[cfg(test)]
mod tests;

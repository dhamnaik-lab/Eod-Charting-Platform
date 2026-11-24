use super::types::*;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, REFERER, USER_AGENT};
use std::thread;
use std::time::Duration as StdDuration;

pub const NSE_BASE_URL: &str = "https://www.nseindia.com";
pub const NSE_INDEX_HISTORY_PAGE_URL: &str =
    "https://www.nseindia.com/reports-indices-historical-index-data";
pub const NSE_INDEX_HISTORY_API_URL: &str =
    "https://www.nseindia.com/api/historicalOR/indicesHistory";
pub const BSE_BASE_URL: &str = "https://www.bseindia.com";
pub const BSE_INDEX_ARCHIVE_API_URL: &str =
    "https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAllPar/w";
pub const BSE_INDEX_ARCHIVE_PAGE_URL: &str =
    "https://www.bseindia.com/indices/IndexArchiveData.html";

pub fn create_http_client() -> Result<Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static(
            "application/json,text/csv,application/zip,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ),
    );
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-US,en;q=0.9"));
    Client::builder()
        .default_headers(headers)
        .http1_only()
        .pool_idle_timeout(StdDuration::from_secs(10))
        .pool_max_idle_per_host(4)
        .cookie_store(true)
        .timeout(StdDuration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())
}

pub fn warm_session(client: &Client, base_url: &str) {
    if client.get(base_url).send().is_err() {
        thread::sleep(StdDuration::from_millis(150));
    }
}

pub fn normalize_exchange_key(exchange: &str) -> String {
    exchange
        .to_uppercase()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .collect()
}

pub fn is_bse_exchange(exchange: &str) -> bool {
    normalize_exchange_key(exchange).starts_with("BSE")
}

pub fn bhavcopy_referer_for_exchange(exchange: &str) -> &'static str {
    match normalize_exchange_key(exchange).as_str() {
        "BSEINDEX" => "https://www.bseindia.com/bsedata/Index_Bhavcopy/",
        "BSE" => "https://www.bseindia.com/download/BhavCopy/Equity/",
        _ => "https://www.nseindia.com/",
    }
}

pub fn is_html_response(value: &str) -> bool {
    let lowercase = value.trim_start().to_ascii_lowercase();
    lowercase.starts_with("<!doctype") || lowercase.starts_with("<html")
}

pub fn normalize_bse_api_filename(response_key: &str, filename: &str) -> String {
    if response_key == "dsIndexSum" {
        if let Some((_, suffix)) = filename.split_once('_') {
            return format!("IndexSummary_{suffix}");
        }
    }

    filename.to_string()
}

pub fn fetch_candidate_bytes(
    client: &Client,
    url: &str,
    referer: &str,
    retries: usize,
) -> Result<Option<Vec<u8>>, String> {
    let mut backoff_ms = 1_000_u64;
    let mut last_error: Option<String> = None;

    for attempt in 1..=retries {
        let mut request = client.get(url).header(REFERER, referer);
        if url.starts_with(BSE_INDEX_ARCHIVE_API_URL) {
            request = request
                .header(REFERER, BSE_INDEX_ARCHIVE_PAGE_URL)
                .header(ACCEPT, "application/json, text/plain, */*")
                .header("Origin", BSE_BASE_URL);
        }
        match request.send() {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    let bytes = match response.bytes() {
                        Ok(b) => b,
                        Err(error) => {
                            let mut detailed = error.to_string();
                            let mut source = std::error::Error::source(&error);
                            while let Some(err) = source {
                                detailed.push_str(&format!(" -> {err}"));
                                source = err.source();
                            }
                            last_error = Some(detailed);
                            if attempt < retries {
                                thread::sleep(StdDuration::from_millis(backoff_ms));
                                backoff_ms *= 2;
                                continue;
                            }
                            return Err(last_error.unwrap());
                        }
                    };
                    return Ok(Some(bytes.to_vec()));
                }
                if status.as_u16() == 404 {
                    return Ok(None);
                }
                if status.as_u16() == 403 {
                    return Err(format!("HTTP 403: source request blocked for {url}"));
                }
                if status.as_u16() == 429 || status.as_u16() >= 500 {
                    last_error = Some(format!("HTTP {}: {}", status.as_u16(), status));
                    if attempt < retries {
                        thread::sleep(StdDuration::from_millis(backoff_ms));
                        backoff_ms *= 2;
                        continue;
                    }
                } else {
                    return Err(format!("HTTP {}: {}", status.as_u16(), status));
                }
            }
            Err(error) => {
                let mut detailed = error.to_string();
                let mut source = std::error::Error::source(&error);
                while let Some(err) = source {
                    detailed.push_str(&format!(" -> {err}"));
                    source = err.source();
                }
                last_error = Some(detailed);
                if attempt < retries {
                    thread::sleep(StdDuration::from_millis(backoff_ms));
                    backoff_ms *= 2;
                    continue;
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| format!("Request failed for {url}")))
}

pub fn fetch_candidate_content_bytes(
    client: &Client,
    candidate: &Candidate,
    referer: &str,
    retries: usize,
    trade_date: &str,
) -> Result<Option<Vec<u8>>, String> {
    let Some(download_base) = candidate.bse_download_base else {
        return fetch_candidate_bytes(client, &candidate.url, referer, retries);
    };
    let response_key = candidate
        .bse_response_key
        .ok_or_else(|| "BSE candidate missing response key".to_string())?;
    let Some(api_bytes) = fetch_candidate_bytes(client, &candidate.url, referer, retries)? else {
        return Err("BSE filename discovery endpoint returned HTTP 404.".into());
    };
    let Some(filename) = parse_bse_api_filename(&api_bytes, response_key)? else {
        return Ok(None);
    };
    let (download_url, _) =
        validated_bse_filename_url(download_base, response_key, &filename, trade_date)?;
    fetch_candidate_bytes(client, &download_url, referer, retries)?
        .map(Some)
        .ok_or_else(|| "BSE API referenced a file that returned HTTP 404.".to_string())
}

/// Only an explicitly empty array under the expected key establishes absence.
pub(super) fn parse_bse_api_filename(
    bytes: &[u8],
    response_key: &str,
) -> AppResult<Option<String>> {
    let content = String::from_utf8_lossy(bytes);
    if is_html_response(&content) {
        return Err("BSE bhavcopy API returned HTML instead of JSON.".into());
    }
    let value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("BSE bhavcopy API JSON parse failed: {error}"))?;
    if value.get("error").and_then(|flag| flag.as_bool()) == Some(true) {
        return Err("BSE bhavcopy API reported an error.".into());
    }
    let items = value
        .get(response_key)
        .and_then(|value| value.as_array())
        .ok_or_else(|| format!("BSE bhavcopy API missing expected array: {response_key}"))?;
    if items.is_empty() {
        return Ok(None);
    }
    let filename = items[0]
        .get("filename")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "BSE bhavcopy API returned a row without a filename.".to_string())?;
    Ok(Some(filename.to_string()))
}

pub(super) fn validated_bse_filename_url(
    base: &str,
    key: &str,
    name: &str,
    trade_date: &str,
) -> Result<(String, bool), String> {
    let filename = normalize_bse_api_filename(key, name.trim());
    if filename.is_empty()
        || !filename
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-' | b'.'))
        || filename.contains("..")
    {
        return Err("BSE API returned an unsafe filename.".into());
    }
    let lower = filename.to_ascii_lowercase();
    let date = super::calendar::parse_trade_date(trade_date)?;
    if ![
        date.format("%Y%m%d").to_string(),
        date.format("%d%m%Y").to_string(),
        date.format("%d%m%y").to_string(),
    ]
    .iter()
    .any(|token| filename.contains(token))
    {
        return Err("BSE API filename does not match the requested trading date.".into());
    }
    let zipped = if lower.ends_with(".zip") {
        true
    } else if lower.ends_with(".csv") {
        false
    } else {
        return Err("BSE API filename is not a CSV/ZIP source.".into());
    };
    if !matches!(
        base,
        "https://www.bseindia.com/download/BhavCopy/Equity/"
            | "https://www.bseindia.com/bsedata/Index_Bhavcopy/"
    ) {
        return Err("Unapproved BSE download base.".into());
    }
    Ok((format!("{base}{filename}"), zipped))
}

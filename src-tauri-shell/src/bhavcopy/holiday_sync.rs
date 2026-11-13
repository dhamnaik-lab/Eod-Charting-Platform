//! HOL-03: explicit, exchange/year-scoped official equity holiday snapshots.
//! No network request or preview writes to a database. A preview must be accepted
//! from the same active database before its verified exchange/year becomes active.
use std::collections::{BTreeMap, HashSet};
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration as StdDuration, Instant, SystemTime, UNIX_EPOCH};

use chrono::{Datelike, NaiveDate};
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, ACCEPT_LANGUAGE};
use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::bhavcopy::types::AppResult;

const NSE_URL: &str = "https://www.nseindia.com/api/holiday-master?type=trading";
const BSE_2026_BASE: &str = "https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20251212-8";
const BSE_2026_AMEND: &str = "https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20260112-8";
const MAX_SOURCE_BYTES: usize = 512 * 1024;
const PREVIEW_TTL: StdDuration = StdDuration::from_secs(600);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayRow {
    pub date: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayExchangePreview {
    pub exchange: String,
    pub verified: bool,
    pub message: String,
    pub source_urls: Vec<String>,
    pub source_sha256: Option<String>,
    pub holidays: Vec<OfficialHolidayRow>,
    pub new_dates: Vec<String>,
    pub legacy_only_dates: Vec<String>,
    pub changed_names: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidaySyncPreview {
    pub token: String,
    pub year: i32,
    pub exchanges: Vec<OfficialHolidayExchangePreview>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayAcceptedSnapshot {
    pub exchange: String,
    pub year: i32,
    pub accepted_at: String,
    pub record_count: i64,
    pub source_urls: Vec<String>,
    pub source_sha256: String,
}

#[tauri::command]
pub fn list_official_exchange_holiday_snapshots(app: AppHandle, year: i32) -> AppResult<Vec<OfficialHolidayAcceptedSnapshot>> {
    let folder = active_folder(&app)?;
    let db = crate::database::open_read_only_connection_for_folder(&folder)?;
    let mut stmt = db.prepare("SELECT exchange,year,accepted_at,record_count,source_urls,source_sha256 FROM official_exchange_holiday_snapshots WHERE year=?1 ORDER BY exchange")
        .map_err(|e|e.to_string())?;
    let rows = stmt.query_map(params![year], |row| {
        let urls: String = row.get(4)?;
        Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?,urls,row.get(5)?))
    }).map_err(|e|e.to_string())?;
    let mut snapshots=Vec::new();
    for row in rows {
        let (exchange,year,accepted_at,record_count,urls,source_sha256): (String,i32,String,i64,String,String) = row.map_err(|e|e.to_string())?;
        let source_urls:Vec<String> = serde_json::from_str(&urls).map_err(|e|e.to_string())?;
        snapshots.push(OfficialHolidayAcceptedSnapshot{exchange,year,accepted_at,record_count,source_urls,source_sha256});
    }
    Ok(snapshots)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidaySyncResult {
    pub year: i32,
    pub accepted: Vec<String>,
    pub records: usize,
}

struct PendingPreview {
    created: Instant,
    db_folder: PathBuf,
    legacy_hash: String,
    original_snapshot_hash: String,
    data: OfficialHolidaySyncPreview,
}

static PENDING: OnceLock<Mutex<Option<PendingPreview>>> = OnceLock::new();
fn preview_slot() -> &'static Mutex<Option<PendingPreview>> {
    PENDING.get_or_init(|| Mutex::new(None))
}
fn hex_sha(bytes: &[u8]) -> String {
    format!("{:X}", Sha256::digest(bytes))
}
fn active_folder(app: &AppHandle) -> AppResult<crate::database::database_use::DatabasePath> {
    crate::database::resolve_active_database_folder(app)?
        .ok_or_else(|| "Open a database before syncing holidays.".to_string())
}
fn source_client() -> AppResult<Client> {
    Client::builder()
        .http1_only()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(StdDuration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0 Safari/537.36")
        .build().map_err(|e| e.to_string())
}

/// HOL-06: where an exchange's official holiday calendar for one year is fetched
/// from. Editable from the UI so a changed exchange URL needs no code change.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HolidaySourceRow {
    pub exchange: String,
    pub year: i32,
    pub document_index: i32,
    pub url: String,
    pub parser: String,
    pub required_fragments: Vec<String>,
    pub expected_rows: Option<i64>,
    pub operator_note: Option<String>,
    pub updated_at: String,
}

/// Hosts permitted as a holiday source. HTTPS is required and the URL may not
/// carry a redirect parameter, so an edited URL cannot become an open fetch.
const ALLOWED_HOLIDAY_SOURCE_HOSTS: &[&str] =
    &["www.nseindia.com", "www.bseindia.com", "nsearchives.nseindia.com"];

fn validate_holiday_source_url(url: &str) -> AppResult<()> {
    let parsed = reqwest::Url::parse(url)
        .map_err(|_| "Holiday source URL is not a valid URL.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Holiday source URL must use https.".into());
    }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    if !ALLOWED_HOLIDAY_SOURCE_HOSTS
        .iter()
        .any(|allowed| host == *allowed)
    {
        return Err(format!("Holiday source host is not approved: {host}"));
    }
    Ok(())
}

fn parser_for_exchange(exchange: &str) -> AppResult<&'static str> {
    match exchange {
        "NSE" => Ok("NSE_JSON"),
        "BSE" => Ok("BSE_NOTICE_HTML"),
        other => Err(format!("Unsupported holiday source exchange: {other}")),
    }
}

fn read_source_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<HolidaySourceRow> {
    let fragments: String = row.get(5)?;
    Ok(HolidaySourceRow {
        exchange: row.get(0)?,
        year: row.get(1)?,
        document_index: row.get(2)?,
        url: row.get(3)?,
        parser: row.get(4)?,
        required_fragments: serde_json::from_str(&fragments).unwrap_or_default(),
        expected_rows: row.get(6)?,
        operator_note: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

const SOURCE_COLUMNS: &str =
    "exchange,year,document_index,url,parser,required_fragments,expected_rows,operator_note,updated_at";

/// HOL-06: accepted official holidays for one year, per exchange. The Market
/// Holiday tab renders this instead of `market_holidays`, whose `date` column is
/// globally unique and therefore cannot show two exchanges on the same date.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayEntry {
    pub exchange: String,
    pub date: String,
    pub name: String,
}

#[tauri::command]
pub fn list_official_exchange_holidays(
    app: AppHandle,
    year: i32,
) -> AppResult<Vec<OfficialHolidayEntry>> {
    let folder = active_folder(&app)?;
    let db = crate::database::open_read_only_connection_for_folder(&folder)?;
    let mut statement = db
        .prepare(
            "SELECT exchange,date,name FROM official_exchange_holidays\n             WHERE year=?1 ORDER BY exchange,date",
        )
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![year], |row| {
            Ok(OfficialHolidayEntry {
                exchange: row.get(0)?,
                date: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_holiday_source_registry(
    app: AppHandle,
    year: Option<i32>,
) -> AppResult<Vec<HolidaySourceRow>> {
    let folder = active_folder(&app)?;
    let db = crate::database::open_read_only_connection_for_folder(&folder)?;
    let mut statement = db
        .prepare(&format!(
            "SELECT {SOURCE_COLUMNS} FROM holiday_source_registry\n             WHERE (?1 IS NULL OR year = ?1) ORDER BY year DESC, exchange, document_index"
        ))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![year], read_source_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_holiday_source_url(
    app: AppHandle,
    exchange: String,
    year: i32,
    url: String,
    required_fragments: Option<Vec<String>>,
    operator_note: Option<String>,
) -> AppResult<HolidaySourceRow> {
    if !(1990..=2100).contains(&year) {
        return Err("Holiday source year is out of range.".into());
    }
    let parser = parser_for_exchange(&exchange)?;
    let url = url.trim().to_string();
    validate_holiday_source_url(&url)?;
    let fragments = required_fragments.unwrap_or_default();
    if fragments.iter().any(|fragment| fragment.trim().is_empty()) {
        return Err("Holiday source fragments must not be empty.".into());
    }
    let fragments_json = serde_json::to_string(&fragments).map_err(|e| e.to_string())?;
    let folder = active_folder(&app)?;
    let db = crate::database::open_connection_for_folder(&folder, false)?;
    db.execute(
        "INSERT INTO holiday_source_registry
           (exchange,year,url,parser,required_fragments,operator_note,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,datetime('now'))
         ON CONFLICT(exchange,year) DO UPDATE SET
           url = excluded.url,
           parser = excluded.parser,
           required_fragments = excluded.required_fragments,
           operator_note = excluded.operator_note,
           updated_at = datetime('now')",
        params![exchange, year, url, parser, fragments_json, operator_note],
    )
    .map_err(|e| e.to_string())?;
    db.query_row(
        &format!(
            "SELECT {SOURCE_COLUMNS} FROM holiday_source_registry\n             WHERE exchange=?1 AND year=?2 ORDER BY document_index LIMIT 1"
        ),
        params![exchange, year],
        read_source_row,
    )
    .map_err(|e| e.to_string())
}

/// Every registered document for one exchange/year, in fetch order.
fn registry_documents(
    connection: &Connection,
    exchange: &str,
    year: i32,
) -> AppResult<Vec<HolidaySourceRow>> {
    let mut statement = connection
        .prepare(&format!(
            "SELECT {SOURCE_COLUMNS} FROM holiday_source_registry\n             WHERE exchange=?1 AND year=?2 ORDER BY document_index"
        ))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![exchange, year], read_source_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn bse_month_number(month: &str) -> Option<u32> {
    Some(match month {
        "January" => 1,
        "February" => 2,
        "March" => 3,
        "April" => 4,
        "May" => 5,
        "June" => 6,
        "July" => 7,
        "August" => 8,
        "September" => 9,
        "October" => 10,
        "November" => 11,
        "December" => 12,
        _ => return None,
    })
}

/// "January 26,2023" — the 2019–2021 and 2023–2025 BSE annual notices.
fn parse_bse_long_date(month: &str, day_year: &str) -> Option<NaiveDate> {
    let (day, year) = day_year.split_once(',')?;
    NaiveDate::from_ymd_opt(
        year.trim().parse().ok()?,
        bse_month_number(month)?,
        day.trim().parse().ok()?,
    )
}

/// "26 January 2024" — the 2024 BSE annual notice layout (three tokens).
fn parse_bse_day_month_year(day: &str, month: &str, year: &str) -> Option<NaiveDate> {
    NaiveDate::from_ymd_opt(
        year.parse().ok()?,
        bse_month_number(month)?,
        day.parse().ok()?,
    )
}

/// Generic BSE annual-notice parser: the notice identity and the expected row
/// count come from the registry row, so a new year needs data, not code.
fn parse_bse_notice(
    html: &[u8],
    year: i32,
    required: &[String],
    expected_rows: Option<i64>,
) -> AppResult<Vec<OfficialHolidayRow>> {
    let raw = std::str::from_utf8(html).map_err(|_| "BSE notice is not UTF-8.".to_string())?;
    let text = html_visible_text(raw);
    if required.iter().any(|fragment| !text.contains(fragment.as_str())) {
        return Err(format!(
            "BSE response is not the registered equity holiday notice for {year}."
        ));
    }
    let start = text
        .find("Trading Members are hereby informed")
        .ok_or_else(|| "BSE circular content not found.".to_string())?;
    let content = &text[start..];
    let tokens: Vec<&str> = content.split_whitespace().collect();
    let mut rows = Vec::new();
    let mut i = 1_usize;
    while i + 1 < tokens.len() {
        // Two date layouts exist in the BSE annual notices:
        //   2026-style  "26-Jan-26"          (one token)
        //   older       "January 26,2023"     (two tokens)
        let parsed = match NaiveDate::parse_from_str(tokens[i], "%d-%b-%y") {
            Ok(date) => Some((date, i + 1)),
            Err(_) => {
                let long_form = if i + 1 < tokens.len() {
                    parse_bse_long_date(tokens[i], tokens[i + 1]).map(|date| (date, i + 2))
                } else {
                    None
                };
                long_form.or_else(|| {
                    if i + 2 < tokens.len() {
                        parse_bse_day_month_year(tokens[i], tokens[i + 1], tokens[i + 2])
                            .map(|date| (date, i + 3))
                    } else {
                        None
                    }
                })
            }
        };
        let Some((date, weekday_index)) = parsed else {
            i += 1;
            continue;
        };
        if date.year() != year {
            i += 1;
            continue;
        }
        let weekday = super::calendar::weekday_name(date.weekday());
        match tokens.get(weekday_index) {
            Some(token) if *token == weekday => {}
            _ => return Err("BSE circular weekday mismatch.".into()),
        }
        let row_number = (i.saturating_sub(18)..i)
            .rev()
            .find(|&j| {
                tokens[j]
                    .parse::<usize>()
                    .ok()
                    .is_some_and(|n| n > 0 && n <= 60)
            })
            .ok_or_else(|| "BSE circular row number missing.".to_string())?;
        let name = tokens[row_number + 1..i].join(" ");
        if name.is_empty() || name.len() > 160 {
            return Err("BSE circular holiday name invalid.".into());
        }
        rows.push(OfficialHolidayRow {
            date: date.format("%Y-%m-%d").to_string(),
            name,
        });
        i = weekday_index + 1;
    }
    if let Some(expected) = expected_rows {
        if rows.len() as i64 != expected {
            return Err(format!(
                "BSE notice for {year} expected {expected} dated rows, found {}.",
                rows.len()
            ));
        }
    } else if rows.is_empty() {
        return Err(format!("BSE notice for {year} produced no dated rows."));
    }
    validate_rows(rows, year)
}

fn parse_registered_document(
    bytes: &[u8],
    document: &HolidaySourceRow,
    year: i32,
) -> AppResult<Vec<OfficialHolidayRow>> {
    match document.parser.as_str() {
        "NSE_JSON" => parse_nse_cash_market(bytes, year),
        "BSE_NOTICE_HTML" => parse_bse_notice(
            bytes,
            year,
            &document.required_fragments,
            document.expected_rows,
        ),
        "BSE_AMENDMENT_2026" => {
            let raw = std::str::from_utf8(bytes)
                .map_err(|_| "BSE amendment is not UTF-8.".to_string())?;
            let text = html_visible_text(raw);
            if document
                .required_fragments
                .iter()
                .any(|fragment| !text.contains(fragment.as_str()))
            {
                return Err(format!(
                    "BSE amendment for {year} could not be authenticated from its official text."
                ));
            }
            // The amendment notice asserts one dated holiday; keep it as one row.
            validate_bse_2026_amendment(bytes).map(|row| vec![row])
        }
        other => Err(format!("Unsupported holiday source parser: {other}")),
    }
}

/// Fetch, authenticate and parse every registered document for one exchange/year.
fn fetch_exchange_from_registry(
    client: &Client,
    connection: &Connection,
    exchange: &str,
    year: i32,
) -> AppResult<(Vec<OfficialHolidayRow>, Vec<String>, String)> {
    let documents = registry_documents(connection, exchange, year)?;
    if documents.is_empty() {
        return Err(format!(
            "No official holiday source is registered for {exchange} {year}."
        ));
    }
    let mut rows = Vec::new();
    let mut urls = Vec::new();
    let mut concat = Vec::new();
    for document in &documents {
        validate_holiday_source_url(&document.url)?;
        let bytes = fetch_official(client, &document.url)?;
        rows.extend(parse_registered_document(&bytes, document, year)?);
        urls.push(document.url.clone());
        concat.extend_from_slice(&bytes);
    }
    let rows = validate_rows(rows, year)?;
    Ok((rows, urls, hex_sha(&concat)))
}
fn fetch_official(client: &Client, url: &str) -> AppResult<Vec<u8>> {
    // Callers pass a registry URL. Validate scheme/host here as well so an edited
    // URL can never turn into an open fetch, and never follow a redirect.
    validate_holiday_source_url(url)?;
    let response = client.get(url)
        .header(ACCEPT, "application/json,text/html;q=0.9,*/*;q=0.8")
        .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send().map_err(|e| format!("Official source unavailable: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Official source returned HTTP {}", response.status()));
    }
    if response.url().as_str() != url {
        return Err("Official source redirected; refusing unverified response.".into());
    }
    let mut bytes = Vec::new();
    response.take((MAX_SOURCE_BYTES + 1) as u64)
        .read_to_end(&mut bytes).map_err(|e| format!("Official source read failed: {e}"))?;
    if bytes.is_empty() || bytes.len() > MAX_SOURCE_BYTES {
        return Err("Official source body empty or over size limit.".into());
    }
    Ok(bytes)
}
fn validate_rows(rows: Vec<OfficialHolidayRow>, year: i32) -> AppResult<Vec<OfficialHolidayRow>> {
    if rows.len() < 12 || rows.len() > 35 {
        return Err(format!("Unexpected official holiday count: {}", rows.len()));
    }
    let mut seen = HashSet::new();
    for row in &rows {
        let date = NaiveDate::parse_from_str(&row.date, "%Y-%m-%d")
            .map_err(|_| format!("Invalid official holiday date: {}", row.date))?;
        if date.year() != year || row.name.trim().is_empty() || row.name.len() > 160 {
            return Err("Official holiday year/name failed validation.".into());
        }
        if !seen.insert(row.date.as_str()) {
            return Err(format!("Duplicate official holiday: {}", row.date));
        }
    }
    let mut rows = rows;
    rows.sort_by(|a, b| a.date.cmp(&b.date));
    Ok(rows)
}
fn parse_nse_cash_market(bytes: &[u8], year: i32) -> AppResult<Vec<OfficialHolidayRow>> {
    let json: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|_| "NSE holiday response is not valid JSON.".to_string())?;
    let cm = json.get("CM").and_then(|v| v.as_array())
        .ok_or_else(|| "NSE response lacks an equity cash-market (CM) array.".to_string())?;
    let mut rows = Vec::new();
    for value in cm {
        let date_str = value.get("tradingDate").and_then(|v| v.as_str())
            .ok_or_else(|| "NSE CM row lacks tradingDate.".to_string())?;
        let date = NaiveDate::parse_from_str(date_str, "%d-%b-%Y")
            .map_err(|_| "NSE CM date format unrecognized.".to_string())?;
        if date.year() != year { continue; }
        let name = value.get("description").and_then(|v| v.as_str())
            .ok_or_else(|| "NSE CM row lacks a description.".to_string())?;
        let weekday = value.get("weekDay").and_then(|v| v.as_str())
            .ok_or_else(|| "NSE CM weekday absent.".to_string())?;
        if super::calendar::weekday_name(date.weekday()) != weekday {
            return Err(format!("NSE CM weekday mismatch: {date_str}"));
        }
        rows.push(OfficialHolidayRow {date: date.format("%Y-%m-%d").to_string(),name:name.trim().to_string()});
    }
    validate_rows(rows, year)
}

// Convert the first-party BSE notice's visible text to tokens without treating
// scripts, attributes or hidden state as holiday data. The table parser below
// requires the exact notice/year/equity header and a consistent dated row set.
fn html_visible_text(html: &str) -> String {
    let mut text = String::with_capacity(html.len().min(100_000));
    let mut in_tag = false;
    let mut tag = String::new();
    let mut ignored: Option<String> = None;
    for ch in html.chars() {
        if ch == '<' { in_tag = true; tag.clear(); text.push(' '); continue; }
        if in_tag {
            if ch == '>' {
                in_tag = false;
                let t = tag.trim().to_ascii_lowercase();
                if t.starts_with("script") || t.starts_with("style") { ignored = Some(t.split_whitespace().next().unwrap_or("").to_string()); }
                if t.starts_with("/script") || t.starts_with("/style") { ignored = None; }
            } else { tag.push(ch); }
            continue;
        }
        if ignored.is_none() { text.push(ch); }
    }
    text.replace("&nbsp;", " ").replace("&#160;", " ").replace("&amp;", "&")
        .replace("&quot;", "\"").replace("&#10;", " ").replace("&lt;", "<")
        .replace("&gt;", ">").split_whitespace().collect::<Vec<_>>().join(" ")
}
fn parse_bse_base(html: &[u8], year: i32) -> AppResult<Vec<OfficialHolidayRow>> {
    if year != 2026 { return Err("BSE official circular source for this year has not been verified.".into()); }
    let raw = std::str::from_utf8(html).map_err(|_| "BSE notice is not UTF-8.".to_string())?;
    let text = html_visible_text(raw);
    let required = ["Notice No. 20251212-8", "Trading Holidays for the Calendar Year 2026", "Equity and Equity Derivatives Segments", "Following Holidays are Falling on Saturday / Sunday", "Muhurat Trading"];
    if required.iter().any(|fragment| !text.contains(fragment)) {
        return Err("BSE response is not the verified 2026 equity holiday circular.".into());
    }
    let start = text.find("Trading Members are hereby informed")
        .ok_or_else(|| "BSE circular content not found.".to_string())?;
    let content = &text[start..];
    let tokens: Vec<&str> = content.split_whitespace().collect();
    let mut rows = Vec::new();
    for i in 1..tokens.len().saturating_sub(1) {
        let Ok(date) = NaiveDate::parse_from_str(tokens[i], "%d-%b-%y") else {continue};
        if date.year() != year { continue; }
        let weekday = super::calendar::weekday_name(date.weekday());
        if tokens[i + 1] != weekday { return Err("BSE circular weekday mismatch.".into()); }
        let row_number = (i.saturating_sub(18)..i).rev().find(|&j| {
            tokens[j].parse::<usize>().ok().is_some_and(|n| n > 0 && n <= 25)
        }).ok_or_else(|| "BSE circular row number missing.".to_string())?;
        let name = tokens[row_number + 1..i].join(" ");
        if name.is_empty() || name.len() > 160 {return Err("BSE circular holiday name invalid.".into());}
        rows.push(OfficialHolidayRow {date: date.format("%Y-%m-%d").to_string(), name});
    }
    if rows.len() != 19 {return Err(format!("BSE base circular expected 19 dated rows, found {}", rows.len()));}
    validate_rows(rows, year)
}
fn validate_bse_2026_amendment(html: &[u8]) -> AppResult<OfficialHolidayRow> {
    let raw = std::str::from_utf8(html).map_err(|_| "BSE amendment is not UTF-8.".to_string())?;
    let text = html_visible_text(raw);
    if !text.contains("Notice No. 20260112-8")
        || !text.contains("Trading Holiday on account of Municipal Corporation Elections in Maharashtra 2026")
        || !text.contains("January 15, 2026")
        || !text.contains("Equity Segment") {
        return Err("BSE 15 January amendment could not be authenticated from its official text.".into());
    }
    Ok(OfficialHolidayRow {date:"2026-01-15".into(), name:"Municipal Corporation Elections in Maharashtra".into()})
}
#[allow(dead_code)] // strict 2026 reference path, kept for regression comparison
fn fetch_nse(client: &Client, year: i32) -> AppResult<(Vec<OfficialHolidayRow>, Vec<String>, String)> {
    let body = fetch_official(client, NSE_URL)?;
    let rows = parse_nse_cash_market(&body, year)?;
    Ok((rows, vec![NSE_URL.into()], hex_sha(&body)))
}
#[allow(dead_code)] // strict 2026 reference path, kept for regression comparison
fn fetch_bse(client: &Client, year: i32) -> AppResult<(Vec<OfficialHolidayRow>, Vec<String>, String)> {
    if year != 2026 { return Err("BSE official equity calendar for this year is not yet supported. No changes applied.".into()); }
    let base = fetch_official(client, BSE_2026_BASE)?;
    let amendment = fetch_official(client, BSE_2026_AMEND)?;
    let mut rows = parse_bse_base(&base, year)?;
    rows.push(validate_bse_2026_amendment(&amendment)?);
    let rows = validate_rows(rows, year)?;
    let mut concat = base;
    concat.extend_from_slice(&amendment);
    Ok((rows, vec![BSE_2026_BASE.into(), BSE_2026_AMEND.into()], hex_sha(&concat)))
}
fn legacy_hash(connection: &Connection) -> AppResult<String> {
    let mut stmt = connection.prepare("SELECT date, name, source FROM market_holidays ORDER BY date")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(format!("{}|{}|{}\n", row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)))
        .map_err(|e| e.to_string())?;
    let mut text = String::new();
    for row in rows {text.push_str(&row.map_err(|e| e.to_string())?);}
    Ok(hex_sha(text.as_bytes()))
}
fn snapshot_hash(connection: &Connection) -> AppResult<String> {
    let mut stmt = connection.prepare("SELECT exchange,year,source_sha256,accepted_at FROM official_exchange_holiday_snapshots ORDER BY exchange,year")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(format!("{}|{}|{}|{}\n", row.get::<_, String>(0)?, row.get::<_, i32>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)))
        .map_err(|e| e.to_string())?;
    let mut text = String::new();
    for row in rows {text.push_str(&row.map_err(|e| e.to_string())?);}
    Ok(hex_sha(text.as_bytes()))
}
fn local_comparison(connection: &Connection, year: i32, exchange: &str, official: &[OfficialHolidayRow]) -> AppResult<(Vec<String>,Vec<String>,Vec<String>)> {
    let exists: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM official_exchange_holiday_snapshots WHERE exchange=?1 AND year=?2)",params![exchange,year], |r| r.get(0)).map_err(|e| e.to_string())?;
    let sql = if exists {
        "SELECT date, name FROM official_exchange_holidays WHERE exchange=?1 AND year=?2 ORDER BY date"
    } else {
        "SELECT date, name FROM market_holidays WHERE date >= (?2 || '-01-01') AND date <= (?2 || '-12-31') ORDER BY date"
    };
    let mut stmt = connection.prepare(sql).map_err(|e| e.to_string())?;
    let local: BTreeMap<String,String> = stmt
        .query_map(params![exchange,year], |r| Ok((r.get(0)?,r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<BTreeMap<_,_>,_>>().map_err(|e| e.to_string())?;
    let wanted: BTreeMap<_,_> = official.iter().map(|r| (r.date.clone(),r.name.clone())).collect();
    let new_dates = wanted.keys().filter(|d| !local.contains_key(*d)).cloned().collect();
    let legacy_only = local.keys().filter(|d| !wanted.contains_key(*d)).cloned().collect();
    let changed = wanted.iter().filter(|(d,n)| local.get(*d).is_some_and(|current| current != *n))
        .map(|(d,_)|d.clone()).collect();
    Ok((new_dates,legacy_only,changed))
}
#[tauri::command]
pub async fn preview_official_exchange_holidays(app: AppHandle, year: i32) -> AppResult<OfficialHolidaySyncPreview> {
    if !(1990..=2100).contains(&year) { return Err("Choose a supported official holiday calendar year.".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let folder = active_folder(&app)?;
        let db = crate::database::open_read_only_connection_for_folder(&folder)?;
        let legacy = legacy_hash(&db)?;
        let originals = snapshot_hash(&db)?;
        let client = source_client()?;
        let mut exchanges = Vec::new();
        for exchange in ["NSE","BSE"] {
            // HOL-06: the year is served only when the registry holds a document
            // for it, so a new year is added as data rather than by editing code.
            let source = fetch_exchange_from_registry(&client, &db, exchange, year);
            let preview = match source {
                Ok((holidays,urls,sha)) => {
                    let (new_dates,legacy_only_dates,changed_names) = local_comparison(&db,year,exchange,&holidays)?;
                    OfficialHolidayExchangePreview { exchange: exchange.into(), verified:true,
                        message:"Official source validated; review additions, differences and referenced notices before acceptance.".into(),
                        source_urls:urls, source_sha256:Some(sha),holidays,new_dates,legacy_only_dates,changed_names }
                }
                Err(error) => OfficialHolidayExchangePreview { exchange:exchange.into(), verified:false,
                    message:error,source_urls:if exchange == "NSE"{vec![NSE_URL.into()]}else{vec![BSE_2026_BASE.into(),BSE_2026_AMEND.into()]},
                    source_sha256:None,holidays:Vec::new(),new_dates:Vec::new(),legacy_only_dates:Vec::new(),changed_names:Vec::new() }
            };
            exchanges.push(preview);
        }
        let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let digest = format!("{}|{}|{}|{:?}|{}",now,std::process::id(),legacy,folder,originals);
        let token = hex_sha(digest.as_bytes());
        let data = OfficialHolidaySyncPreview {token,year,exchanges};
        *preview_slot().lock().map_err(|_|"Holiday preview lock unavailable".to_string())? = Some(PendingPreview {
            created:Instant::now(),db_folder:folder.to_path_buf(),legacy_hash:legacy,original_snapshot_hash:originals,data:data.clone()
        });
        Ok(data)
    }).await.map_err(|e|e.to_string())?
}
// HOL03-R1.2: Parent must exist before child writes while SQLite foreign keys
// are enabled. All three operations remain inside the caller's transaction.
fn write_verified_exchange_snapshot(
    tx: &rusqlite::Transaction<'_>,
    preview: &OfficialHolidayExchangePreview,
    year: i32,
) -> AppResult<usize> {
    if !preview.verified || preview.source_sha256.is_none() {
        return Err("Cannot store an unverified official calendar.".into());
    }
    let urls = serde_json::to_string(&preview.source_urls).map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO official_exchange_holiday_snapshots(exchange,year,source_urls,source_sha256,accepted_at,record_count) VALUES (?1,?2,?3,?4,datetime('now'),?5) ON CONFLICT(exchange,year) DO UPDATE SET source_urls=excluded.source_urls,source_sha256=excluded.source_sha256,accepted_at=excluded.accepted_at,record_count=excluded.record_count",
        params![preview.exchange, year, urls, preview.source_sha256, preview.holidays.len() as i64],
    ).map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM official_exchange_holidays WHERE exchange=?1 AND year=?2",
        params![preview.exchange, year],
    ).map_err(|e| e.to_string())?;
    for row in &preview.holidays {
        tx.execute(
            "INSERT INTO official_exchange_holidays(exchange,year,date,name) VALUES (?1,?2,?3,?4)",
            params![preview.exchange, year, row.date, row.name],
        ).map_err(|e| e.to_string())?;
    }
    Ok(preview.holidays.len())
}

#[tauri::command]
pub fn apply_official_exchange_holidays(app:AppHandle, token:String, exchanges:Vec<String>) -> AppResult<OfficialHolidaySyncResult> {
    if exchanges.is_empty() || exchanges.len()>2 {return Err("Select one or both verified exchanges.".into());}
    let selected:HashSet<&str> = exchanges.iter().map(String::as_str).collect();
    if selected.len()!=exchanges.len() || !selected.iter().all(|x| matches!(*x,"NSE"|"BSE")) {
        return Err("Invalid exchange selection.".into());
    }
    let mut slot = preview_slot().lock().map_err(|_|"Holiday preview lock unavailable".to_string())?;
    let pending = slot.as_ref().ok_or_else(||"Preview expired; fetch official calendars again.".to_string())?;
    if pending.data.token != token || pending.created.elapsed() > PREVIEW_TTL {return Err("Official preview token expired or mismatched.".into());}
    let active = active_folder(&app)?;
    if active.as_ref() != pending.db_folder.as_path() {return Err("Active database changed; preview invalidated.".into());}
    let mut db = crate::database::open_connection_for_folder(&active,false)?;
    if legacy_hash(&db)? != pending.legacy_hash || snapshot_hash(&db)? != pending.original_snapshot_hash {
        return Err("Holiday records changed since preview; refresh before accepting.".into());
    }
    for exchange in &selected {
        if !pending.data.exchanges.iter().any(|p|p.exchange == *exchange && p.verified && p.source_sha256.is_some()) {
            return Err(format!("{exchange} did not return a verified official calendar."));
        }
    }
    let tx = db.transaction().map_err(|e|e.to_string())?;
    let mut records = 0;
    for exchange in &exchanges {
        let preview = pending.data.exchanges.iter().find(|p| &p.exchange == exchange)
            .ok_or_else(|| "Exchange missing from approved preview.".to_string())?;
        records += write_verified_exchange_snapshot(&tx, preview, pending.data.year)?;
    }
    // If the active database changes during the transaction, drop the
    // uncommitted transaction rather than publish to the previous profile.
    if active_folder(&app)? != active {
        return Err("Active database changed during holiday acceptance; transaction rolled back.".into());
    }
    tx.commit().map_err(|e|e.to_string())?;
    let year = pending.data.year;
    *slot = None; // one-shot approval; no replay
    Ok(OfficialHolidaySyncResult {year,accepted:exchanges,records})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture_nse() -> Vec<u8> {
        // All entries are synthetic, not purported exchange records.
        let rows:Vec<_> = (1..=16).map(|day| {
            let d=NaiveDate::from_ymd_opt(2026,6,day).unwrap();
            serde_json::json!({"tradingDate":d.format("%d-%b-%Y").to_string(), "weekDay":super::super::calendar::weekday_name(d.weekday()),"description":format!("Fixture {day}")})
        }).collect();
        serde_json::to_vec(&serde_json::json!({"CM":rows,"CD":[]})).unwrap()
    }
    #[test]
    fn hol03_nse_accepts_only_cm_and_validated_year() {
        assert_eq!(parse_nse_cash_market(&fixture_nse(),2026).unwrap().len(),16);
        assert!(parse_nse_cash_market(&fixture_nse(),2027).is_err());
        assert!(parse_nse_cash_market(br#"{"CD":[]}"#,2026).is_err());
    }
    #[test]
    fn hol03_bse_parses_2026_equity_circular_dates_and_amendment() {
        let weekdays = [
            ("26-Jan-26", "Monday"),("03-Mar-26","Tuesday"),("26-Mar-26","Thursday"),
            ("31-Mar-26","Tuesday"),("03-Apr-26","Friday"),("14-Apr-26","Tuesday"),
            ("01-May-26","Friday"),("28-May-26","Thursday"),("26-Jun-26","Friday"),
            ("14-Sep-26","Monday"),("02-Oct-26","Friday"),("20-Oct-26","Tuesday"),
            ("10-Nov-26","Tuesday"),("24-Nov-26","Tuesday"),("25-Dec-26","Friday")
        ];
        let weekends = [("15-Feb-26","Sunday"),("21-Mar-26","Saturday"),
            ("15-Aug-26","Saturday"),("08-Nov-26","Sunday")];
        let mut html=String::from("<html>Notice No. 20251212-8 Subject Trading Holidays for the Calendar Year 2026 for Equity and Equity Derivatives Segments Trading Members are hereby informed Sr.No. Holidays Date Day ");
        for (i,(date,weekday)) in weekdays.iter().enumerate() {
            html.push_str(&format!("<tr><td>{}</td><td>Fixture Holiday</td><td>{date}</td><td>{weekday}</td></tr>",i+1));
        }
        html.push_str(" Following Holidays are Falling on Saturday / Sunday Sr.No. Holidays Date Day ");
        for (i,(date,weekday)) in weekends.iter().enumerate() {
            html.push_str(&format!("<tr><td>{}</td><td>Fixture Holiday</td><td>{date}</td><td>{weekday}</td></tr>",i+1));
        }
        html.push_str(" Muhurat Trading</html>");
        let base=parse_bse_base(html.as_bytes(),2026).unwrap();
        assert_eq!(base.len(),19);
        let amended = b"Notice No. 20260112-8 Subject Trading Holiday on account of Municipal Corporation Elections in Maharashtra 2026 January 15, 2026 Equity Segment";
        let extra=validate_bse_2026_amendment(amended).unwrap();
        assert_eq!(extra.date,"2026-01-15");
        let mut rows=base;
        rows.push(extra);
        assert_eq!(validate_rows(rows,2026).unwrap().len(),20);
    }

    #[test]
    fn hol03_bse_wrong_notice_and_amendment_fail_closed() {
        assert!(parse_bse_base(b"a third-party holiday page",2026).is_err());
        assert!(validate_bse_2026_amendment(b"An HTML error page").is_err());
        assert!(parse_bse_base(b"test",2027).is_err());
    }
    #[test]
    fn hol03_snapshot_schema_and_lookup_is_exchange_scoped() {
        let db=Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE market_holidays(date TEXT NOT NULL UNIQUE,name TEXT NOT NULL,source TEXT NOT NULL); CREATE TABLE official_exchange_holiday_snapshots(exchange TEXT,year INTEGER,source_urls TEXT,source_sha256 TEXT,accepted_at TEXT,record_count INTEGER,PRIMARY KEY(exchange,year)); CREATE TABLE official_exchange_holidays(exchange TEXT,year INTEGER,date TEXT,name TEXT,PRIMARY KEY(exchange,year,date));").unwrap();
        db.execute("INSERT INTO market_holidays VALUES('2026-01-15','Legacy','BUILTIN')",[]).unwrap();
        db.execute("INSERT INTO official_exchange_holiday_snapshots VALUES ('NSE',2026,'u','h','t',1)",[]).unwrap();
        db.execute("INSERT INTO official_exchange_holidays VALUES ('NSE',2026,'2026-01-15','NSE official')",[]).unwrap();
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE", "2026-01-15").unwrap(),Some("NSE official".into()));
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"BSE", "2026-01-15").unwrap(),Some("NSE official".into()));
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE_INDEX", "2026-01-15").unwrap(),Some("NSE official".into()));
        db.execute("INSERT INTO market_holidays VALUES('2026-01-16','User global','USER')",[]).unwrap();
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE", "2026-01-16").unwrap(),Some("User global".into()));
        db.execute("INSERT INTO market_holidays VALUES('2027-01-15','Legacy next year','BUILTIN')",[]).unwrap();
        // PHASE-1: a year without an accepted official snapshot no longer reads
        // unverified BUILTIN seed rows; only manual USER rows apply.
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE", "2027-01-15").unwrap(),None);
        db.execute("INSERT INTO official_exchange_holidays VALUES ('NSE',2026,'2026-11-08','Muhurat holiday')",[]).unwrap();
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE", "2026-11-08").unwrap(),None);
    }
    #[test]
    fn hol03_fk_parent_first_acceptance_and_idempotent_reaccept() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE official_exchange_holiday_snapshots (exchange TEXT NOT NULL CHECK(exchange IN ('NSE','BSE')), year INTEGER NOT NULL, source_urls TEXT NOT NULL, source_sha256 TEXT NOT NULL, accepted_at TEXT NOT NULL, record_count INTEGER NOT NULL, PRIMARY KEY(exchange,year)); CREATE TABLE official_exchange_holidays (exchange TEXT NOT NULL CHECK(exchange IN ('NSE','BSE')), year INTEGER NOT NULL, date TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(exchange,year,date), FOREIGN KEY(exchange,year) REFERENCES official_exchange_holiday_snapshots(exchange,year));").unwrap();
        let make_preview = |name: &str| OfficialHolidayExchangePreview {
            exchange: "NSE".into(), verified: true, message: String::new(),
            source_urls: vec![NSE_URL.into()], source_sha256: Some("fixture-sha".into()),
            holidays: vec![OfficialHolidayRow {date:"2026-01-15".into(),name:name.into()}],
            new_dates: vec![], legacy_only_dates: vec![],changed_names: vec![],
        };
        let tx = db.transaction().unwrap();
        assert_eq!(write_verified_exchange_snapshot(&tx, &make_preview("Fixture A"), 2026).unwrap(),1);
        tx.commit().unwrap();
        let mut fk_check = db.prepare("PRAGMA foreign_key_check").unwrap();
        let mut violations = fk_check.query([]).unwrap();
        assert!(violations.next().unwrap().is_none());
        drop(violations);
        drop(fk_check);
        let tx = db.transaction().unwrap();
        assert_eq!(write_verified_exchange_snapshot(&tx, &make_preview("Fixture B"), 2026).unwrap(),1);
        tx.commit().unwrap();
        let rows: i64 = db.query_row("SELECT COUNT(*) FROM official_exchange_holidays WHERE exchange='NSE' AND year=2026",[],|row|row.get(0)).unwrap();
        let name: String = db.query_row("SELECT name FROM official_exchange_holidays WHERE exchange='NSE' AND year=2026",[],|row|row.get(0)).unwrap();
        assert_eq!((rows,name),(1,"Fixture B".into()));
        let mut invalid = make_preview("bad");
        invalid.verified=false;
        let tx = db.transaction().unwrap();
        assert!(write_verified_exchange_snapshot(&tx,&invalid,2026).is_err());
        tx.rollback().unwrap();
    }

    #[test]
    fn hol03_additive_migration_is_idempotent() {
        let db = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&db).unwrap();
        crate::database::prepare_database_connection(&db).unwrap();
        let count: i64 = db.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('market_holidays','official_exchange_holiday_snapshots','official_exchange_holidays')",[],|r|r.get(0)).unwrap();
        assert_eq!(count,3);
    }
}

#[cfg(test)]
mod hol06_tests {
    use super::*;

    #[test]
    fn hol06_source_url_policy_is_https_and_host_pinned() {
        assert!(validate_holiday_source_url(
            "https://www.nseindia.com/api/holiday-master?type=trading"
        )
        .is_ok());
        assert!(validate_holiday_source_url(
            "https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20251212-8"
        )
        .is_ok());
        assert!(validate_holiday_source_url("http://www.nseindia.com/api").is_err());
        assert!(validate_holiday_source_url("https://evil.example.com/holidays").is_err());
        assert!(validate_holiday_source_url("https://www.nseindia.com.evil.example/h").is_err());
        assert!(validate_holiday_source_url("not a url").is_err());
        assert!(validate_holiday_source_url("").is_err());
    }

    #[test]
    fn hol06_parser_is_derived_from_exchange_not_user_input() {
        assert_eq!(parser_for_exchange("NSE").unwrap(), "NSE_JSON");
        assert_eq!(parser_for_exchange("BSE").unwrap(), "BSE_NOTICE_HTML");
        assert!(parser_for_exchange("NSE_INDEX").is_err());
        assert!(parser_for_exchange("bse").is_err());
    }

    #[test]
    fn hol06_registry_schema_and_defaults_are_additive() {
        let db = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&db).unwrap();
        let rows: Vec<(String, i32, i32, String)> = db
            .prepare(
                "SELECT exchange,year,document_index,parser FROM holiday_source_registry\n                 ORDER BY exchange,year,document_index",
            )
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(
            rows,
            vec![
                ("BSE".to_string(), 2026, 0, "BSE_NOTICE_HTML".to_string()),
                ("BSE".to_string(), 2026, 1, "BSE_AMENDMENT_2026".to_string()),
                ("NSE".to_string(), 2026, 0, "NSE_JSON".to_string()),
            ]
        );
        // Defaults must be idempotent: a second preparation must not duplicate.
        crate::database::prepare_database_connection(&db).unwrap();
        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM holiday_source_registry", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn hol06_registry_presence_is_the_year_gate() {
        // A year without a registered document fails closed before any network
        // call, so an unsupported year can never silently return an empty calendar.
        let db = Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&db).unwrap();
        let client = source_client().unwrap();
        let error = fetch_exchange_from_registry(&client, &db, "NSE", 2023).unwrap_err();
        assert!(error.contains("No official holiday source is registered"), "{error}");
        let error = fetch_exchange_from_registry(&client, &db, "BSE", 2025).unwrap_err();
        assert!(error.contains("No official holiday source is registered"), "{error}");
        // 2026 is registered for both exchanges, so it must not fail on registry.
        assert!(registry_documents(&db, "NSE", 2026).unwrap().len() == 1);
        assert!(registry_documents(&db, "BSE", 2026).unwrap().len() == 2);
    }
}

#[cfg(test)]
mod hol06_bse_date_formats {
    use super::*;

    fn long_form_notice(dates: &[&str]) -> Vec<u8> {
        let mut body = String::from("Trading Members are hereby informed ");
        for (index, iso) in dates.iter().enumerate() {
            let date = NaiveDate::parse_from_str(iso, "%Y-%m-%d").unwrap();
            let weekday = super::super::calendar::weekday_name(date.weekday());
            body.push_str(&format!(
                "{} Holiday {} {:02},{} {} ",  // N Holiday <MonthName> <DD>,<YYYY> <Weekday>
                index + 1,
                date.format("%B"),
                date.day(),
                date.year(),
                weekday,
            ));
        }
        format!("<html>{body}</html>").into_bytes()
    }

    const Y2023: &[&str] = &[
        "2023-01-26", "2023-03-07", "2023-03-30", "2023-04-04", "2023-04-07", "2023-04-14",
        "2023-05-01", "2023-06-29", "2023-08-15", "2023-09-19", "2023-10-02", "2023-10-24",
        "2023-11-14", "2023-11-27", "2023-12-25",
    ];

    #[test]
    fn parses_the_older_long_date_notice_layout() {
        let rows = parse_bse_notice(&long_form_notice(Y2023), 2023, &[], Some(15)).unwrap();
        assert_eq!(rows.len(), 15);
        assert_eq!(rows[0].date, "2023-01-26");
        // The month token belongs to the date, so it is not part of the name.
        assert_eq!(rows[0].name, "Holiday");
        assert_eq!(rows[14].date, "2023-12-25");
        // A row-count mismatch still fails closed.
        assert!(parse_bse_notice(&long_form_notice(Y2023), 2023, &[], Some(19)).is_err());
        // A wrong year fails closed.
        assert!(parse_bse_notice(&long_form_notice(Y2023), 2024, &[], Some(15)).is_err());
    }

    #[test]
    fn still_parses_the_2026_short_date_layout() {
        let mut body = String::from("Trading Members are hereby informed ");
        for (index, iso) in Y2023.iter().enumerate() {
            let date = NaiveDate::parse_from_str(iso, "%Y-%m-%d").unwrap();
            let weekday = super::super::calendar::weekday_name(date.weekday());
            body.push_str(&format!(
                "{} Holiday {} {} ",
                index + 1,
                date.format("%d-%b-%y"),
                weekday
            ));
        }
        let html = format!("<html>{body}</html>").into_bytes();
        let rows = parse_bse_notice(&html, 2023, &[], Some(15)).unwrap();
        assert_eq!(rows.len(), 15);
        assert_eq!(rows[0].date, "2023-01-26");
    }

    #[test]
    fn weekday_mismatch_fails_closed() {
        let good = String::from_utf8(long_form_notice(Y2023)).unwrap();
        let broken = good.replacen("Thursday", "Friday", 1);
        assert!(parse_bse_notice(broken.as_bytes(), 2023, &[], Some(15)).is_err());
    }
}

/// One (exchange, year) block inside an imported CSV.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayCsvGroup {
    pub exchange: String,
    pub year: i32,
    pub rows: usize,
    pub replaces_existing: usize,
}

/// Dry-run result of an official-holiday CSV import. `sha256` binds the later
/// apply to the exact text that was previewed.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayCsvPreview {
    pub sha256: String,
    pub total_rows: usize,
    pub groups: Vec<OfficialHolidayCsvGroup>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialHolidayCsvImportResult {
    pub rows: usize,
    pub groups: usize,
    pub years: Vec<i32>,
}

struct ImportedHoliday {
    exchange: String,
    year: i32,
    date: String,
    name: String,
    source_urls: Option<String>,
    source_sha256: Option<String>,
}

/// Parse and validate an official-holiday CSV. Rows land in
/// `official_exchange_holidays`, so every rule that protects the accepted
/// snapshots applies here too: known exchange, date/year agreement, non-empty
/// name, no duplicate (exchange, year, date), and a plausible 12-35 rows per
/// (exchange, year) block so a truncated file cannot silently wipe a calendar.
fn parse_official_holiday_csv(text: &str) -> AppResult<Vec<ImportedHoliday>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(text.as_bytes());
    let headers = reader.headers().map_err(|e| e.to_string())?.clone();
    let column = |want: &str| headers.iter().position(|h| h.eq_ignore_ascii_case(want));
    let (Some(exchange_at), Some(year_at), Some(date_at), Some(name_at)) = (
        column("exchange"),
        column("year"),
        column("date"),
        column("name"),
    ) else {
        return Err("Official holiday CSV needs exchange, year, date and name columns.".into());
    };
    let urls_at = column("source_urls");
    let sha_at = column("source_sha256");

    let mut rows: Vec<ImportedHoliday> = Vec::new();
    let mut seen = HashSet::<(String, String)>::new();
    for (line, record) in reader.records().enumerate() {
        let record = record.map_err(|e| format!("CSV line {}: {e}", line + 2))?;
        let field = |at: Option<usize>| at.and_then(|i| record.get(i)).unwrap_or("").trim().to_string();
        let exchange = field(Some(exchange_at)).to_uppercase();
        if exchange != "NSE" && exchange != "BSE" {
            return Err(format!("CSV line {}: exchange must be NSE or BSE.", line + 2));
        }
        let year: i32 = field(Some(year_at))
            .parse()
            .map_err(|_| format!("CSV line {}: year is not a number.", line + 2))?;
        if !(1990..=2100).contains(&year) {
            return Err(format!("CSV line {}: year {year} is out of range.", line + 2));
        }
        let date = field(Some(date_at));
        let parsed = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
            .map_err(|_| format!("CSV line {}: date '{date}' is not YYYY-MM-DD.", line + 2))?;
        if parsed.year() != year {
            return Err(format!(
                "CSV line {}: date {date} does not belong to year {year}.",
                line + 2
            ));
        }
        let name = field(Some(name_at));
        if name.is_empty() || name.len() > 160 {
            return Err(format!("CSV line {}: holiday name is invalid.", line + 2));
        }
        if !seen.insert((exchange.clone(), date.clone())) {
            return Err(format!(
                "CSV line {}: duplicate {exchange} holiday on {date}.",
                line + 2
            ));
        }
        rows.push(ImportedHoliday {
            exchange,
            year,
            date,
            name,
            source_urls: urls_at.map(|_| field(urls_at)).filter(|v| !v.is_empty()),
            source_sha256: sha_at.map(|_| field(sha_at)).filter(|v| !v.is_empty()),
        });
    }
    if rows.is_empty() {
        return Err("Official holiday CSV has no data rows.".into());
    }
    let mut counts: BTreeMap<(String, i32), usize> = BTreeMap::new();
    for row in &rows {
        *counts.entry((row.exchange.clone(), row.year)).or_insert(0) += 1;
    }
    for ((exchange, year), count) in &counts {
        if !(12..=35).contains(count) {
            return Err(format!(
                "{exchange} {year} has {count} rows; an official calendar needs 12-35."
            ));
        }
    }
    Ok(rows)
}

#[tauri::command]
pub fn preview_official_holiday_csv(app: AppHandle, csv_text: String) -> AppResult<OfficialHolidayCsvPreview> {
    if csv_text.len() > 2 * 1024 * 1024 {
        return Err("Official holiday CSV is too large.".into());
    }
    let rows = parse_official_holiday_csv(&csv_text)?;
    let folder = active_folder(&app)?;
    let db = crate::database::open_read_only_connection_for_folder(&folder)?;
    let mut groups: Vec<OfficialHolidayCsvGroup> = Vec::new();
    for ((exchange, year), count) in rows
        .iter()
        .fold(BTreeMap::<(String, i32), usize>::new(), |mut acc, row| {
            *acc.entry((row.exchange.clone(), row.year)).or_insert(0) += 1;
            acc
        })
    {
        let existing: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM official_exchange_holidays WHERE exchange=?1 AND year=?2",
                params![exchange, year],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        groups.push(OfficialHolidayCsvGroup {
            exchange,
            year,
            rows: count,
            replaces_existing: existing as usize,
        });
    }
    Ok(OfficialHolidayCsvPreview {
        sha256: hex_sha(csv_text.as_bytes()),
        total_rows: rows.len(),
        groups,
    })
}

#[tauri::command]
pub fn apply_official_holiday_csv(
    app: AppHandle,
    csv_text: String,
    sha256: String,
) -> AppResult<OfficialHolidayCsvImportResult> {
    if hex_sha(csv_text.as_bytes()) != sha256.to_uppercase() {
        return Err("Official holiday CSV changed since it was previewed.".into());
    }
    let rows = parse_official_holiday_csv(&csv_text)?;
    let folder = active_folder(&app)?;
    let mut db = crate::database::open_connection_for_folder(&folder, false)?;
    let csv_sha = hex_sha(csv_text.as_bytes());
    let accepted_at = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let mut touched = BTreeMap::<(String, i32), Vec<&ImportedHoliday>>::new();
    for row in &rows {
        touched.entry((row.exchange.clone(), row.year)).or_default().push(row);
    }
    let mut years = Vec::new();
    for ((exchange, year), group) in &touched {
        tx.execute(
            "DELETE FROM official_exchange_holidays WHERE exchange=?1 AND year=?2",
            params![exchange, year],
        )
        .map_err(|e| e.to_string())?;
        let urls = group
            .iter()
            .find_map(|row| row.source_urls.clone())
            .unwrap_or_else(|| format!("csv:sha256:{csv_sha}"));
        let source_sha = group
            .iter()
            .find_map(|row| row.source_sha256.clone())
            .unwrap_or_else(|| csv_sha.clone());
        tx.execute(
            "INSERT OR REPLACE INTO official_exchange_holiday_snapshots
               (exchange,year,source_urls,source_sha256,accepted_at,record_count)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![exchange, year, urls, source_sha, accepted_at, group.len() as i64],
        )
        .map_err(|e| e.to_string())?;
        for row in group {
            tx.execute(
                "INSERT INTO official_exchange_holidays (exchange,year,date,name)
                 VALUES (?1,?2,?3,?4)",
                params![row.exchange, row.year, row.date, row.name],
            )
            .map_err(|e| e.to_string())?;
        }
        years.push(*year);
    }
    tx.commit().map_err(|e| e.to_string())?;
    years.sort_unstable();
    years.dedup();
    Ok(OfficialHolidayCsvImportResult {
        rows: rows.len(),
        groups: touched.len(),
        years,
    })
}

#[cfg(test)]
mod hol06_bse_third_layout {
    use super::*;

    // The 2024 BSE notice writes "26 January 2024", a three-token date.
    fn notice_2024(rows: usize) -> Vec<u8> {
        let mut body = String::from("Trading Members are hereby informed ");
        for day in 1..=rows {
            let date = NaiveDate::from_ymd_opt(2024, 1, day as u32).unwrap();
            let weekday = super::super::calendar::weekday_name(date.weekday());
            body.push_str(&format!(
                "{} Holiday {:02} {} {} ",
                day,
                date.day(),
                date.format("%B"),
                date.year()
            ));
            body.push_str(&format!("{} ", weekday));
        }
        format!("<html>{body}</html>").into_bytes()
    }

    #[test]
    fn parses_day_month_year_notices() {
        let rows = parse_bse_notice(&notice_2024(12), 2024, &[], Some(12)).unwrap();
        assert_eq!(rows.len(), 12);
        assert_eq!(rows[0].date, "2024-01-01");
        // The day token belongs to the date, so it is not part of the name.
        assert_eq!(rows[0].name, "Holiday");
        // Weekday mismatch still fails closed for this layout too.
        let broken = String::from_utf8(notice_2024(12))
            .unwrap()
            .replacen("Monday", "Tuesday", 1);
        assert!(parse_bse_notice(broken.as_bytes(), 2024, &[], Some(12)).is_err());
        // A wrong row count is still refused.
        assert!(parse_bse_notice(&notice_2024(12), 2024, &[], Some(19)).is_err());
    }
}

#[cfg(test)]
mod hol06_csv_import {
    use super::*;

    fn csv_of(exchange: &str, year: i32, count: usize) -> String {
        let mut text = String::from("exchange,year,date,name,source_urls,source_sha256
");
        for day in 1..=count {
            text.push_str(&format!(
                "{exchange},{year},{year}-01-{day:02},Holiday {day},https://example.org/n,ABC
"
            ));
        }
        text
    }

    #[test]
    fn accepts_a_well_formed_block() {
        let rows = parse_official_holiday_csv(&csv_of("BSE", 2027, 12)).unwrap();
        assert_eq!(rows.len(), 12);
        assert_eq!(rows[0].exchange, "BSE");
        assert_eq!(rows[0].year, 2027);
        assert_eq!(rows[0].source_urls.as_deref(), Some("https://example.org/n"));
    }

    #[test]
    fn rejects_bad_exchange_year_and_date() {
        assert!(parse_official_holiday_csv(&csv_of("NSEX", 2027, 12)).is_err());
        // date must belong to the declared year
        let mut text = csv_of("NSE", 2027, 12);
        text = text.replace("NSE,2027,2027-01-03", "NSE,2027,2026-01-03");
        assert!(parse_official_holiday_csv(&text).is_err());
        // duplicate (exchange, date)
        let mut text = csv_of("NSE", 2027, 12);
        text = text.replace("NSE,2027,2027-01-05", "NSE,2027,2027-01-04");
        assert!(parse_official_holiday_csv(&text).is_err());
        // malformed date
        let mut text = csv_of("NSE", 2027, 12);
        text = text.replace("NSE,2027,2027-01-06", "NSE,2027,06-01-2027");
        assert!(parse_official_holiday_csv(&text).is_err());
    }

    #[test]
    fn rejects_missing_columns_and_implausible_counts() {
        assert!(parse_official_holiday_csv("date,name
2027-01-01,Holi
").is_err());
        // too few rows for an annual calendar
        assert!(parse_official_holiday_csv(&csv_of("NSE", 2027, 5)).is_err());
        // empty file
        assert!(parse_official_holiday_csv("exchange,year,date,name
").is_err());
    }
}

/// Everything the Market Holiday tab needs for one year, in a single read-only
/// connection and a single IPC round-trip. The tab used to issue three separate
/// commands (entries, sources, snapshots), each opening its own SQLite handle,
/// which is what made opening the tab feel slow.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HolidayCalendarView {
    pub year: i32,
    /// Every year that has an accepted snapshot, newest first. The tab builds its
    /// year selector from this, so a year with data can never be unreachable.
    pub available_years: Vec<i32>,
    pub official_entries: Vec<OfficialHolidayEntry>,
    pub sources: Vec<HolidaySourceRow>,
    pub snapshots: Vec<OfficialHolidayAcceptedSnapshot>,
}

#[tauri::command]
pub fn get_holiday_calendar_view(app: AppHandle, year: i32) -> AppResult<HolidayCalendarView> {
    let folder = active_folder(&app)?;
    let db = crate::database::open_read_only_connection_for_folder(&folder)?;

    let mut entry_stmt = db
        .prepare(
            "SELECT exchange,date,name FROM official_exchange_holidays
             WHERE year=?1 ORDER BY exchange,date",
        )
        .map_err(|e| e.to_string())?;
    let official_entries = entry_stmt
        .query_map(params![year], |row| {
            Ok(OfficialHolidayEntry {
                exchange: row.get(0)?,
                date: row.get(1)?,
                name: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let sources = registry_documents_for_year(&db, year)?;

    let mut snap_stmt = db
        .prepare(
            "SELECT exchange,year,accepted_at,record_count,source_urls,source_sha256
             FROM official_exchange_holiday_snapshots WHERE year=?1 ORDER BY exchange",
        )
        .map_err(|e| e.to_string())?;
    let snapshots = snap_stmt
        .query_map(params![year], |row| {
            let urls: String = row.get(4)?;
            Ok(OfficialHolidayAcceptedSnapshot {
                exchange: row.get(0)?,
                year: row.get(1)?,
                accepted_at: row.get(2)?,
                record_count: row.get(3)?,
                source_urls: serde_json::from_str(&urls).unwrap_or_default(),
                source_sha256: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut years_stmt = db
        .prepare("SELECT DISTINCT year FROM official_exchange_holiday_snapshots ORDER BY year DESC")
        .map_err(|e| e.to_string())?;
    let available_years = years_stmt
        .query_map([], |row| row.get::<_, i32>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(HolidayCalendarView {
        year,
        available_years,
        official_entries,
        sources,
        snapshots,
    })
}

fn registry_documents_for_year(
    connection: &Connection,
    year: i32,
) -> AppResult<Vec<HolidaySourceRow>> {
    let mut statement = connection
        .prepare(&format!(
            "SELECT {SOURCE_COLUMNS} FROM holiday_source_registry
             WHERE year=?1 ORDER BY exchange, document_index"
        ))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map(params![year], read_source_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

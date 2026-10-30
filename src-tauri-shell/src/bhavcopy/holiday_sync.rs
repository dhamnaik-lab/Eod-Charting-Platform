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
fn active_folder(app: &AppHandle) -> AppResult<PathBuf> {
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
fn fetch_official(client: &Client, url: &'static str) -> AppResult<Vec<u8>> {
    // The only callers pass pinned first-party HTTPS URLs. Never accept a redirect.
    if !matches!(url, NSE_URL | BSE_2026_BASE | BSE_2026_AMEND) {
        return Err("Official holiday source URL is not approved.".into());
    }
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
fn fetch_nse(client: &Client, year: i32) -> AppResult<(Vec<OfficialHolidayRow>, Vec<String>, String)> {
    let body = fetch_official(client, NSE_URL)?;
    let rows = parse_nse_cash_market(&body, year)?;
    Ok((rows, vec![NSE_URL.into()], hex_sha(&body)))
}
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
    if !(2026..=2100).contains(&year) { return Err("Choose a supported official holiday calendar year.".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let folder = active_folder(&app)?;
        let db = crate::database::open_read_only_connection_for_folder(&folder)?;
        let legacy = legacy_hash(&db)?;
        let originals = snapshot_hash(&db)?;
        let client = source_client()?;
        let mut exchanges = Vec::new();
        for exchange in ["NSE","BSE"] {
            let source = if exchange == "NSE" {fetch_nse(&client,year)} else {fetch_bse(&client,year)};
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
            created:Instant::now(),db_folder:folder,legacy_hash:legacy,original_snapshot_hash:originals,data:data.clone()
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
    if active_folder(&app)? != pending.db_folder {return Err("Active database changed; preview invalidated.".into());}
    let mut db = crate::database::open_connection_for_folder(&pending.db_folder,false)?;
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
    if active_folder(&app)? != pending.db_folder {
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
        assert_eq!(super::super::calendar::get_exchange_holiday_name(&db,"NSE", "2027-01-15").unwrap(),Some("Legacy next year".into()));
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

//! Normal NSE index fallback. A supported subset is never an exchange-day certificate.
//! Request names/2011 compatibility: retained six-index probes in the implementation plan.
//! NIFTY500 evidence: https://www.niftyindices.com/Press_Release/ind_prs16122009.pdf
//! NIFTYIT evidence: https://www.niftyindices.com/Press_Release/ind_prs23112009.pdf
use super::*;
use crate::database::{get_price_storage_mode, index_aliases::nse_index_alias_family};
use chrono::{Duration, NaiveDate};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

pub(super) struct SupportedIndex {
    pub name: &'static str,
    pub symbol: &'static str,
    // A conservative admission floor, NOT an upstream availability guarantee.
    pub admitted_from: &'static str,
}

pub(super) const SUPPORTED: &[SupportedIndex] = &[
    SupportedIndex {
        name: "NIFTY 50",
        symbol: "NIFTY",
        admitted_from: "1996-04-22",
    },
    SupportedIndex {
        name: "NIFTY BANK",
        symbol: "BANKNIFTY",
        admitted_from: "2003-09-15",
    },
    SupportedIndex {
        name: "NIFTY NEXT 50",
        symbol: "NIFTYNEXT50",
        admitted_from: "1996-12-24",
    },
    SupportedIndex {
        name: "NIFTY 100",
        symbol: "NIFTY100",
        admitted_from: "2005-12-01",
    },
    // IISL notices establish both series before the tested 2010 range.
    SupportedIndex {
        name: "NIFTY 500",
        symbol: "NIFTY500",
        admitted_from: "2010-01-01",
    },
    SupportedIndex {
        name: "NIFTY IT",
        symbol: "NIFTYIT",
        admitted_from: "2010-01-01",
    },
    SupportedIndex {
        name: "NIFTY MIDCAP 100",
        symbol: "NIFTYMIDCAP100",
        admitted_from: "2005-07-18",
    },
    SupportedIndex {
        name: "NIFTY SMALLCAP 100",
        symbol: "SMALLCAP100",
        admitted_from: "2011-03-30",
    },
    SupportedIndex {
        name: "NIFTY FINANCIAL SERVICES",
        symbol: "FINNIFTY",
        admitted_from: "2011-09-07",
    },
    SupportedIndex {
        name: "NIFTY MIDCAP SELECT",
        symbol: "MIDCPNIFTY",
        admitted_from: "2021-09-14",
    },
    SupportedIndex {
        name: "NIFTY MIDCAP 150",
        symbol: "NIFTYMIDCAP150",
        admitted_from: "2016-04-01",
    },
    SupportedIndex {
        name: "NIFTY SMALLCAP 250",
        symbol: "NIFTYSMALLCAP250",
        admitted_from: "2016-04-01",
    },
];

#[derive(Debug)]
pub(super) struct Request {
    pub task: NseIndexHistoryTask,
    pub dates: BTreeSet<String>,
}

pub(super) fn requests(symbol: &str, dates: &BTreeSet<String>) -> AppResult<Vec<Request>> {
    let index = SUPPORTED
        .iter()
        .find(|i| i.symbol == symbol)
        .ok_or("Unsupported index")?;
    let mut pending = dates.iter().peekable();
    let mut result = Vec::new();
    while let Some(start) = pending.next() {
        let end = parse_trade_date(start)?
            .checked_add_signed(Duration::days(365))
            .ok_or("Date overflow")?;
        let mut selected = BTreeSet::from([start.clone()]);
        while let Some(date) = pending.peek() {
            if parse_trade_date(date)? > end {
                break;
            }
            selected.insert((*date).clone());
            pending.next();
        }
        result.push(Request {
            task: NseIndexHistoryTask {
                index_type: index.name.into(),
                symbol: symbol.into(),
                from_date: start.clone(),
                to_date: selected.last().unwrap().clone(),
            },
            dates: selected,
        });
    }
    Ok(result)
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(super) struct Observation {
    pub date: String,
    pub name: String,
    pub prices: [f64; 4],
    pub volume: Option<u64>,
}

#[derive(Default, Serialize)]
pub(super) struct Normalized {
    pub rows: Vec<Observation>,
    pub held: BTreeMap<String, String>,
    pub identical_duplicates: usize,
    pub outside_unresolved_set: usize,
}

fn valid_prices(p: [f64; 4]) -> bool {
    p.iter()
        .all(|v| v.is_finite() && *v > 0.0 && *v < (i64::MAX as f64 / DEFAULT_SCALE as f64))
        && p[1] >= p[0].max(p[3])
        && p[2] <= p[0].min(p[3])
        && p[1] >= p[2]
}

pub(super) fn normalize(bytes: &[u8], request: &Request, today: &str) -> AppResult<Normalized> {
    let response: NseIndexHistoryResponse =
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid NSE historical JSON: {e}"))?;
    if response.error.unwrap_or(false) {
        return Err(format!(
            "NSE source refusal: {}",
            response.show_message.unwrap_or_default()
        ));
    }
    let records = response
        .data
        .ok_or("NSE response missing data (availability unknown)")?;
    let index = SUPPORTED
        .iter()
        .find(|i| i.symbol == request.task.symbol)
        .ok_or("Unsupported index")?;
    let mut out = Normalized::default();
    let mut seen = BTreeMap::<String, Observation>::new();
    for record in records {
        let name = record.index_name.ok_or("Missing response identity")?;
        // No synthesized ticker or prefix matching is accepted here.
        let family = nse_index_alias_family(&normalize_index_key(&name))
            .ok_or_else(|| format!("Unknown index alias: {name}"))?;
        if family.canonical != index.symbol {
            return Err(format!("Wrong response identity: {name}"));
        }
        let raw_date = record.timestamp.ok_or("Missing response date")?;
        let date = normalize_trade_date_value(&raw_date)
            .or_else(|| {
                NaiveDate::parse_from_str(&raw_date, "%d-%b-%Y")
                    .ok()
                    .map(|d| d.to_string())
            })
            .ok_or_else(|| format!("Invalid response date: {raw_date}"))?;
        if date < request.task.from_date || date > request.task.to_date || date.as_str() > today {
            return Err(format!("Out-of-range response date: {date}"));
        }
        if !request.dates.contains(&date) {
            out.outside_unresolved_set += 1;
            continue;
        }
        let prices = [
            record.open.unwrap_or(0.0),
            record.high.unwrap_or(0.0),
            record.low.unwrap_or(0.0),
            record.close.unwrap_or(0.0),
        ];
        let reason = if date.as_str() < index.admitted_from {
            Some("Pre-launch or earlier than evidenced admission floor")
        } else if !valid_prices(prices) {
            Some("Invalid, partial or close-only OHLC")
        } else if record
            .traded_qty
            .is_some_and(|v| !v.is_finite() || v < 0.0 || v.fract() != 0.0 || v >= i64::MAX as f64)
        {
            Some("Invalid volume")
        } else {
            None
        };
        if let Some(reason) = reason {
            out.held.insert(date, reason.into());
            continue;
        }
        let row = Observation {
            date: date.clone(),
            name,
            prices,
            volume: record.traded_qty.filter(|v| *v > 0.0).map(|v| v as u64),
        };
        if let Some(previous) = seen.get(&date) {
            if previous.prices == row.prices && previous.volume == row.volume {
                out.identical_duplicates += 1;
            } else {
                out.held.insert(date, "Conflicting duplicate date".into());
            }
        } else {
            seen.insert(date, row);
        }
    }
    out.rows = seen
        .into_values()
        .filter(|r| !out.held.contains_key(&r.date))
        .collect();
    Ok(out)
}

// None marks an invalid stored quotation that must be held for review.
type Existing = HashMap<(String, String), Vec<Option<([i64; 4], u64)>>>;
fn scaled(p: [f64; 4]) -> [i64; 4] {
    p.map(|v| (v * DEFAULT_SCALE as f64).round() as i64)
}

// Reads only the requested ranges of the relevant canonical/accepted alias files.
fn existing_rows(
    database: &Path,
    symbols: &BTreeSet<String>,
    from: &str,
    to: &str,
) -> AppResult<Existing> {
    let connection =
        Connection::open_with_flags(database, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
    let binary = get_price_storage_mode(&connection) == PriceStorageMode::Binary;
    let root = database.parent().ok_or("Missing database folder")?;
    let mut existing = Existing::new();
    for symbol in symbols {
        let aliases: Vec<&str> = nse_index_alias_family(symbol)
            .map(|f| f.symbols.to_vec())
            .unwrap_or_else(|| vec![symbol.as_str()]);
        for alias in aliases {
            // The full filename owns the identity; never use the truncated header
            // as a lookup key (different long names can share all 32 bytes).
            if alias.is_empty() || !alias.bytes().all(|b| b.is_ascii_alphanumeric()) {
                return Err(format!("Invalid existing index filename identity: {alias}"));
            }
            let path = root.join("eod_data/NSE_INDEX").join(format!("{alias}.eod"));
            // Hybrid databases can contain binary history absent from SQLite.
            // Check both representations before deciding a date is a gap.
            if path.exists() {
                let file = BinaryEodFile::open(&path)?;
                // write_all stores the first 32 bytes, retaining the full filename.
                // Truncated identities additionally require their exact metadata owner.
                let header_symbol = &alias[..alias.len().min(32)];
                let owned = alias.len() <= 32 || connection.query_row(
                    "SELECT EXISTS(SELECT 1 FROM instruments WHERE symbol=?1 COLLATE BINARY AND exchange='NSE_INDEX')",
                    [alias], |r| r.get::<_, bool>(0),
                ).map_err(|e| e.to_string())?;
                if file.header.symbol != header_symbol
                    || !owned
                    || file.header.exchange != "NSE_INDEX"
                    || file.header.price_scale == 0
                {
                    return Err(format!(
                        "Existing index identity/scale mismatch: {}",
                        path.display()
                    ));
                }
                let mut records = file.forward_records()?;
                while let Some(r) = records.next_record()? {
                    if r.date < date_to_u32(from) || r.date > date_to_u32(to) {
                        continue;
                    }
                    let p = [r.open, r.high, r.low, r.close]
                        .map(|v| v as f64 / file.header.price_scale as f64);
                    existing
                        .entry((symbol.clone(), u32_to_date(r.date)))
                        .or_default()
                        .push(valid_prices(p).then(|| (scaled(p), r.volume)));
                }
            }
            if !binary {
                let mut stmt = connection.prepare("SELECT date, open, high, low, close, volume FROM eod_prices WHERE exchange='NSE_INDEX' AND symbol=?1 AND date BETWEEN ?2 AND ?3").map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![alias, from, to], |r| {
                        Ok((
                            r.get::<_, String>(0)?,
                            [r.get::<_, f64>(1)?, r.get(2)?, r.get(3)?, r.get(4)?],
                            r.get::<_, i64>(5)?,
                        ))
                    })
                    .map_err(|e| e.to_string())?;
                for row in rows {
                    let (date, p, volume) = row.map_err(|e| e.to_string())?;
                    existing
                        .entry((symbol.clone(), date))
                        .or_default()
                        .push((valid_prices(p) && volume >= 0).then(|| (scaled(p), volume as u64)));
                }
            }
        }
    }
    Ok(existing)
}

#[derive(Default, Serialize)]
pub(super) struct AdditiveOutcome {
    pub identical: usize,
    pub conflicts: usize,
    pub invalid: usize,
    pub inserted_candidates: usize,
    pub details: Vec<String>,
}

// Called under the batch price-store permit immediately before journal creation.
// A second call from replay protects against changed alias files as well.
pub(super) fn guard_additive(
    database: &Path,
    files: &mut [ParsedBhavcopyFile],
) -> AppResult<BTreeMap<String, AdditiveOutcome>> {
    let mut symbols = BTreeSet::new();
    let mut dates = BTreeSet::new();
    for file in files.iter().filter(|f| f.exchange == "NSE_INDEX") {
        for row in &file.rows {
            symbols.insert(row.symbol.clone());
            dates.insert(row.trade_date.clone());
        }
    }
    let Some(from) = dates.first() else {
        return Ok(BTreeMap::new());
    };
    let existing = existing_rows(database, &symbols, from, dates.last().unwrap())?;
    let mut incoming = HashMap::<(String, String), Vec<([i64; 4], i64)>>::new();
    for file in files.iter().filter(|f| f.exchange == "NSE_INDEX") {
        for row in &file.rows {
            incoming
                .entry((row.symbol.clone(), row.trade_date.clone()))
                .or_default()
                .push((scaled([row.open, row.high, row.low, row.close]), row.volume));
        }
    }
    let mut accepted = HashSet::new();
    let mut outcomes = BTreeMap::<String, AdditiveOutcome>::new();
    for file in files.iter_mut().filter(|f| f.exchange == "NSE_INDEX") {
        let out = outcomes.entry(file.trade_date.clone()).or_default();
        file.rows.retain(|row| {
            let key = (row.symbol.clone(), row.trade_date.clone());
            let p = [row.open, row.high, row.low, row.close];
            if !valid_prices(p) || row.volume < 0 {
                out.invalid += 1;
                out.details
                    .push(format!("{}: invalid OHLC/volume", row.symbol));
                return false;
            }
            let p = scaled(p);
            if incoming[&key].iter().any(|r| *r != (p, row.volume)) {
                out.conflicts += 1;
                out.details
                    .push(format!("{}: conflicting incoming duplicates", row.symbol));
                return false;
            }
            if let Some(bars) = existing.get(&key) {
                if bars.iter().any(Option::is_none) {
                    out.conflicts += 1;
                    out.details.push(format!(
                        "{}: invalid existing quotation preserved for review",
                        row.symbol
                    ));
                } else if bars.iter().flatten().all(|(other, volume)| {
                    *other == p && (row.volume == 0 || *volume == row.volume as u64)
                }) {
                    out.identical += 1;
                } else {
                    out.conflicts += 1;
                    out.details
                        .push(format!("{}: existing quotation preserved", row.symbol));
                }
                return false;
            }
            if !accepted.insert(key) {
                out.identical += 1;
                return false;
            }
            out.inserted_candidates += 1;
            true
        });
        file.max_volume = file.rows.iter().map(|r| r.volume as u64).max().unwrap_or(0);
    }
    Ok(outcomes)
}

pub(super) fn save_evidence(database: &Path, label: &str, bytes: &[u8]) -> AppResult<PathBuf> {
    let directory = database
        .parent()
        .ok_or("Missing database folder")?
        .join("bhavcopy_index_evidence");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let hash = format!("{:x}", Sha256::digest(bytes));
    let path = directory.join(format!("{label}-{hash}.json"));
    match OpenOptions::new().create_new(true).write(true).open(&path) {
        Ok(mut file) => {
            file.write_all(bytes).map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            if fs::read(&path).map_err(|e| e.to_string())? != bytes {
                return Err("Evidence hash collision or damaged evidence".into());
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(path)
}

fn fetch(client: &Client, url: &str, stop: &AtomicBool) -> AppResult<Vec<u8>> {
    if stop.load(Ordering::SeqCst) {
        return Err("Index fallback cancelled".into());
    }
    // Serial, one attempt, 30-second client timeout, no browser or retry loop.
    let response = client
        .get(url)
        .header(reqwest::header::REFERER, NSE_INDEX_HISTORY_PAGE_URL)
        .send()
        .map_err(|e| format!("NSE source failure: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "NSE HTTP {} (availability unknown)",
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > 8 * 1024 * 1024)
    {
        return Err("NSE response exceeds 8 MiB".into());
    }
    let mut bytes = Vec::new();
    response
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("NSE response exceeds 8 MiB".into());
    }
    if stop.load(Ordering::SeqCst) {
        return Err("Index fallback cancelled".into());
    }
    Ok(bytes)
}

fn unresolved_requests(
    dates: &BTreeSet<String>,
    staged: &[StagedDownload],
    existing: &Existing,
) -> AppResult<Vec<Request>> {
    let mut resolved = HashSet::<(String, String)>::new();
    for ((symbol, date), bars) in existing {
        // Alias disagreement is visible as unresolved and rechecked before writes.
        if bars[0].is_some() && bars.iter().all(|bar| bar == &bars[0]) {
            resolved.insert((symbol.clone(), date.clone()));
        }
    }
    for download in staged.iter().filter(|s| s.task.exchange == "NSE_INDEX") {
        if let StagedDownloadContent::Csv(csv) = &download.content {
            if let Ok((parsed, _rejected)) =
                parse_download_csv(csv, "NSE_INDEX", &download.task.trade_date)
            {
                if parsed.debug.is_none() {
                    let mut archive = HashMap::<(String, String), Vec<([i64; 4], i64)>>::new();
                    for row in parsed.rows {
                        if valid_prices([row.open, row.high, row.low, row.close]) && row.volume >= 0
                        {
                            archive
                                .entry((row.symbol, row.trade_date))
                                .or_default()
                                .push((
                                    scaled([row.open, row.high, row.low, row.close]),
                                    row.volume,
                                ));
                        }
                    }
                    for (key, bars) in archive {
                        if bars.iter().all(|bar| *bar == bars[0]) {
                            resolved.insert(key);
                        }
                    }
                }
            }
        }
    }
    let mut planned = Vec::new();
    for index in SUPPORTED {
        let unresolved = dates
            .iter()
            .filter(|d| !resolved.contains(&(index.symbol.into(), (*d).clone())))
            .cloned()
            .collect();
        planned.extend(requests(index.symbol, &unresolved)?);
    }
    Ok(planned)
}

pub(super) fn stage_fallback(
    app: &AppHandle,
    client: &Client,
    database: &Path,
    dates: &BTreeSet<String>,
    staged: &mut Vec<StagedDownload>,
    results: &mut Vec<DownloadResult>,
    stop: &AtomicBool,
) -> AppResult<()> {
    if dates.is_empty() {
        return Ok(());
    }
    let symbols = SUPPORTED.iter().map(|i| i.symbol.to_string()).collect();
    let existing = existing_rows(
        database,
        &symbols,
        dates.first().unwrap(),
        dates.last().unwrap(),
    )?;
    let planned = unresolved_requests(dates, staged, &existing)?;
    let mut fallback_rows = BTreeMap::<String, Vec<Observation>>::new();
    let mut consecutive_failures = 0;
    let mut circuit_open = false;
    for request in planned {
        let index = SUPPORTED
            .iter()
            .find(|i| i.symbol == request.task.symbol)
            .ok_or("Unsupported index")?;
        if stop.load(Ordering::SeqCst) {
            return Err("Index fallback cancelled".into());
        }
        let scope = format!(
            "{}..{} {}",
            request.task.from_date, request.task.to_date, index.symbol
        );
        let url = build_nse_index_history_url(&request.task)?;
        emit_progress(
            app,
            60,
            format!("NSE historical fallback: {} ({})", scope, index.name),
        );
        let fetched = if circuit_open {
            Err("Source circuit open after refusal/repeated failures; request not attempted".into())
        } else {
            fetch(client, &url, stop)
        };
        let mut raw_path = None;
        let normalized = match fetched {
            Ok(bytes) => {
                raw_path = Some(save_evidence(database, "response", &bytes)?);
                normalize(&bytes, &request, &today_trade_date())
            }
            Err(error) => Err(error),
        };
        let message;
        let success;
        let outcome;
        match normalized {
            Ok(normalized) => {
                consecutive_failures = 0;
                let acquired = normalized.rows.len();
                let missing = request
                    .dates
                    .len()
                    .saturating_sub(acquired + normalized.held.len());
                success = missing == 0 && normalized.held.is_empty();
                outcome = if success {
                    DownloadOutcome::SourceAcquired
                } else {
                    DownloadOutcome::PartialCoverage
                };
                message = format!("Historical subset: acquired {acquired}, held {}, missing/unsupported {missing}, identical duplicates {}; volume absent/zero remains unknown; other indices unresolved", normalized.held.len(), normalized.identical_duplicates);
                let evidence = serde_json::to_vec_pretty(&serde_json::json!({
                        "url": url, "symbol": index.symbol, "requestedDates": request.dates,
                        "rawResponse": raw_path, "normalized": normalized,
                        "volumePolicy": "null/zero = unknown; storage zero is not certified zero volume",
                        "status": "STAGED_NOT_IMPORTED", "createdAt": chrono::Utc::now().to_rfc3339(),
                    })).map_err(|e| e.to_string())?;
                save_evidence(database, "request", &evidence)?;
                for row in normalized.rows {
                    fallback_rows.entry(row.date.clone()).or_default().push(row);
                }
            }
            Err(error) => {
                consecutive_failures += 1;
                circuit_open |=
                    error.contains("403") || error.contains("429") || consecutive_failures >= 3;
                success = false;
                outcome = DownloadOutcome::SourceError;
                message = format!("Historical source failure: {error}");
                let evidence = serde_json::to_vec_pretty(&serde_json::json!({"url": url, "requestedDates": request.dates, "rawResponse": raw_path, "error": error, "createdAt": chrono::Utc::now().to_rfc3339()})).map_err(|e| e.to_string())?;
                save_evidence(database, "request-failed", &evidence)?;
            }
        }
        results.push(DownloadResult {
            outcome,
            diagnostic: true,
            follow_up_warning: None,
            success,
            exchange: "NSE_INDEX".into(),
            trade_date: scope,
            rows_inserted: 0,
            max_volume: 0,
            message,
        });
    }
    for (date, rows) in fallback_rows {
        let mut writer = ::csv::Writer::from_writer(Vec::new());
        writer
            .write_record([
                "INDEX_NAME",
                "INDEX_DATE",
                "OPEN_INDEX_VALUE",
                "HIGH_INDEX_VALUE",
                "LOW_INDEX_VALUE",
                "CLOSING_INDEX_VALUE",
                "VOLUME",
            ])
            .map_err(|e| e.to_string())?;
        for row in rows {
            let [o, h, l, c] = row.prices;
            writer
                .write_record([
                    row.name,
                    date.clone(),
                    o.to_string(),
                    h.to_string(),
                    l.to_string(),
                    c.to_string(),
                    row.volume.unwrap_or(0).to_string(),
                ])
                .map_err(|e| e.to_string())?;
        }
        let csv = String::from_utf8(writer.into_inner().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        staged.push(StagedDownload {
            task: DownloadTask {
                exchange: "NSE_INDEX".into(),
                trade_date: date,
                candidates: vec![],
                nse_index_history: None,
            },
            content: StagedDownloadContent::Csv(csv),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests;

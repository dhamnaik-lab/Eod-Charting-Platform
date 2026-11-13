//! Reviewed NIFTY backfill. Evidence is separate from prices; only post-launch
//! OHLC corroborated by the fixed official endpoint can reach Manual Import.
use crate::bhavcopy::{
    build_nse_index_history_url, create_http_client, map_index_symbol, NseIndexHistoryResponse,
    NseIndexHistoryTask, NSE_INDEX_HISTORY_PAGE_URL,
};
use crate::database::binary_eod::{date_to_u32, BinaryEodFile, EodRecord, DEFAULT_SCALE};
use crate::database::{
    get_active_database_file_path, get_price_storage_mode, try_acquire_price_store_operation,
    PriceStorageMode, PriceStoreOperationKind,
};
use crate::imports::{
    import_csv_internal_reviewed_nifty, notify_import_result, ImportOptionsInput, ImportResult,
    MANUAL_IMPORT_MUTATION_LOCK,
};
use chrono::{Local, NaiveDate};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

type Result<T> = std::result::Result<T, String>;
const MAX_BYTES: u64 = 8_000_000;
const LAUNCH: &str = "1996-04-22";
const ALIASES: [&str; 4] = ["NIFTY", "NIFTY50", "CNXNIFTY", "SPCNXNIFTY"];

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NiftyHistoryInput {
    pub file_path: Option<String>,
    pub from_date: String,
    pub to_date: String,
    /// False means local review only, never a trust assertion.
    pub verify_official: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRow {
    pub date: String,
    pub original_name: String,
    pub open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub close: Option<f64>,
    pub volume: Option<u64>,
    pub status: String,
    pub reason: String,
}

impl HistoryRow {
    fn prices(&self) -> Option<[f64; 4]> {
        Some([self.open?, self.high?, self.low?, self.close?])
    }
    fn record(&self) -> Result<EodRecord> {
        let [o, h, l, c] = self
            .prices()
            .ok_or("Close-only rows cannot become candles")?;
        validate_ohlc([o, h, l, c])?;
        Ok(EodRecord {
            date: date_to_u32(&self.date),
            flags: 0,
            open: scaled(o),
            high: scaled(h),
            low: scaled(l),
            close: scaled(c),
            prev_close: 0,
            volume: self.volume.unwrap_or(0),
            oi: 0,
        })
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NiftyHistoryPreview {
    pub token: String,
    pub database_path: String,
    pub source_sha256: String,
    pub official_sha256: Option<String>,
    pub source_url: Option<String>,
    pub source_rows: usize,
    pub ready: usize,
    pub existing: usize,
    pub conflicts: usize,
    pub held: usize,
    pub rejected: usize,
    pub close_only: usize,
    pub status: String,
    pub certification_scope: String,
    pub evidence_path: String,
    pub rows: Vec<HistoryRow>,
}

#[derive(Clone)]
struct Review {
    database: PathBuf,
    preview: NiftyHistoryPreview,
    // The backend alone creates these after comparing official observations.
    verified: Vec<HistoryRow>,
}
static REVIEWS: OnceLock<Mutex<HashMap<String, Review>>> = OnceLock::new();
fn reviews() -> &'static Mutex<HashMap<String, Review>> {
    REVIEWS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn scaled(value: f64) -> i64 {
    (value * DEFAULT_SCALE as f64).round() as i64
}

pub(crate) fn validate_ohlc(p: [f64; 4]) -> Result<()> {
    if p.iter()
        .any(|v| !v.is_finite() || *v <= 0.0 || *v > 1_000_000_000.0)
    {
        return Err("Prices must be positive, finite and representable".into());
    }
    let [o, h, l, c] = p;
    if h < o.max(c).max(l) || l > o.min(c).min(h) {
        return Err("Invalid OHLC relationships".into());
    }
    Ok(())
}

pub(crate) fn historical_date(value: &str) -> Result<String> {
    for format in ["%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d-%m-%Y", "%Y%m%d"] {
        if let Ok(date) = NaiveDate::parse_from_str(value.trim(), format) {
            return Ok(date.format("%Y-%m-%d").to_string());
        }
    }
    Err(format!("Invalid historical date: {value}"))
}

fn optional_number(value: &str) -> Result<Option<f64>> {
    let v = value.trim();
    if ["", "-", "NA", "N/A", "NULL"].contains(&v.to_ascii_uppercase().as_str()) {
        return Ok(None);
    }
    let number = v
        .replace(',', "")
        .parse::<f64>()
        .map_err(|_| format!("Invalid numeric value: {v}"))?;
    if !number.is_finite() || number <= 0.0 || number > 1_000_000_000.0 {
        return Err(format!("Invalid price: {v}"));
    }
    Ok(Some(number))
}

fn bounded_read(path: &Path) -> Result<Vec<u8>> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("Historical source exceeds 8 MB limit".into());
    }
    Ok(bytes)
}

fn parse_local(bytes: &[u8], today: &str) -> Result<Vec<HistoryRow>> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| "Historical CSV must be UTF-8")?
        .trim_start_matches('\u{feff}');
    let mut reader = csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .from_reader(text.as_bytes());
    let headers = reader.headers().map_err(|e| e.to_string())?.clone();
    let column = |names: &[&str]| {
        headers
            .iter()
            .position(|h| names.iter().any(|n| h.eq_ignore_ascii_case(n)))
    };
    let name = column(&["Index Name", "Index_Name", "Symbol"])
        .ok_or("CSV must identify Index Name or Symbol explicitly")?;
    let date = column(&["Date", "Index Date", "Timestamp"]).ok_or("CSV missing Date")?;
    let cols = ["Open", "High", "Low", "Close"]
        .map(|n| column(&[n]).ok_or_else(|| format!("CSV missing {n}")));
    let [o, h, l, c] = cols;
    let cols = [o?, h?, l?, c?];
    let vol = column(&["Volume", "Total Traded Quantity"]);
    let mut rows = Vec::new();
    for (i, record) in reader.records().enumerate() {
        let r = record.map_err(|e| format!("CSV row {}: {e}", i + 2))?;
        let mut row = HistoryRow {
            date: r[date].into(),
            original_name: r[name].into(),
            open: None,
            high: None,
            low: None,
            close: None,
            volume: None,
            status: "HOLD".into(),
            reason: "Not verified against an official source".into(),
        };
        let parsed = (|| -> Result<()> {
            row.date = historical_date(&r[date])?;
            if row.date.as_str() < "1990-07-03" || row.date.as_str() > today {
                return Err("Date outside supported history or in the future".into());
            }
            if map_index_symbol(&row.original_name) != "NIFTY" {
                return Err("Only explicit NIFTY 50 aliases are supported".into());
            }
            row.open = optional_number(&r[cols[0]])?;
            row.high = optional_number(&r[cols[1]])?;
            row.low = optional_number(&r[cols[2]])?;
            row.close = optional_number(&r[cols[3]])?;
            if row.close.is_none() {
                return Err("Missing Close".into());
            }
            if let Some(p) = row.prices() {
                validate_ohlc(p)?;
            } else if [row.open, row.high, row.low].iter().any(Option::is_some) {
                return Err("Partially missing OHLC".into());
            }
            if let Some(v) = vol {
                let raw = r[v].replace(',', "");
                if !["", "-", "NA", "N/A"].contains(&raw.as_str()) {
                    let parsed = raw
                        .parse::<u64>()
                        .map_err(|_| "Volume must be a nonnegative integer")?;
                    if parsed > i64::MAX as u64 {
                        return Err("Volume exceeds storage limit".into());
                    }
                    // Source zero means unknown for an index; never invent volume.
                    row.volume = (parsed > 0).then_some(parsed);
                }
            }
            Ok(())
        })();
        if let Err(error) = parsed {
            row.status = "REJECTED".into();
            row.reason = error;
        }
        rows.push(row);
    }
    if rows.is_empty() {
        return Err("No historical observations in CSV".into());
    }
    mark_duplicates(&mut rows);
    Ok(rows)
}

fn mark_duplicates(rows: &mut [HistoryRow]) {
    let mut counts = HashMap::new();
    for row in rows.iter() {
        *counts.entry(row.date.clone()).or_insert(0usize) += 1;
    }
    for row in rows {
        if counts[&row.date] > 1 {
            row.status = "REJECTED".into();
            row.reason = "Duplicate date; retain and resolve all observations before import".into();
        }
    }
}

fn parse_official(bytes: &[u8], from: &str, to: &str, today: &str) -> Result<Vec<HistoryRow>> {
    let response: NseIndexHistoryResponse =
        serde_json::from_slice(bytes).map_err(|e| format!("NSE response schema error: {e}"))?;
    if response.error.unwrap_or(false) {
        return Err(response
            .show_message
            .unwrap_or("NSE API returned an error".into()));
    }
    let records = response
        .data
        .ok_or("NSE response missing data; availability is unknown")?;
    let mut rows = Vec::new();
    for record in records {
        let name = record
            .index_name
            .ok_or("NSE response missing index identity")?;
        if map_index_symbol(&name) != "NIFTY" {
            return Err(format!("Unexpected NSE index identity: {name}"));
        }
        let date = historical_date(&record.timestamp.ok_or("NSE response missing date")?)?;
        if date.as_str() < from || date.as_str() > to || date.as_str() > today {
            return Err("NSE returned a date outside the requested range".into());
        }
        let mut row = HistoryRow {
            date,
            original_name: name,
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
            volume: None,
            status: "HOLD".into(),
            reason: String::new(),
        };
        // Observed in pre-base history and 1996-10-30: zero marks an
        // unavailable O/H/L field. Retain other observed fields without filling it.
        row.open = row.open.filter(|v| *v != 0.0);
        row.high = row.high.filter(|v| *v != 0.0);
        row.low = row.low.filter(|v| *v != 0.0);
        if [row.open, row.high, row.low]
            .iter()
            .flatten()
            .any(|v| !v.is_finite() || *v <= 0.0)
        {
            return Err("Invalid official price".into());
        }
        if let Some(v) = record.traded_qty {
            if !v.is_finite() || v < 0.0 || v.fract() != 0.0 || v >= i64::MAX as f64 {
                return Err("Invalid official volume".into());
            }
            row.volume = (v > 0.0).then_some(v as u64);
        }
        if row.close.is_none_or(|v| !v.is_finite() || v <= 0.0) {
            return Err("Invalid official Close".into());
        }
        if let Some(p) = row.prices() {
            validate_ohlc(p)?;
        }
        rows.push(row);
    }
    mark_duplicates(&mut rows);
    if rows.iter().any(|r| r.status == "REJECTED") {
        return Err("Official response contains duplicate dates".into());
    }
    if rows.is_empty() {
        return Err(
            "NSE returned no observations; this does not prove a holiday or unavailable history"
                .into(),
        );
    }
    Ok(rows)
}

fn verify_rows(rows: &mut [HistoryRow], official: &[HistoryRow]) -> Vec<HistoryRow> {
    let by_date: BTreeMap<_, _> = official.iter().map(|r| (r.date.as_str(), r)).collect();
    let mut verified = Vec::new();
    for row in rows {
        if row.status == "REJECTED" {
            continue;
        }
        // Close-only conflicts still matter even though candle admission is held.
        if let Some(reference) = by_date.get(row.date.as_str()) {
            let local = [row.open, row.high, row.low, row.close];
            let remote = [
                reference.open,
                reference.high,
                reference.low,
                reference.close,
            ];
            if local
                .iter()
                .zip(remote)
                .any(|(a, b)| a.is_some() && b.is_some() && *a != b)
            {
                row.status = "CONFLICT".into();
                row.reason =
                    "Local and official prices disagree; both observations retained in evidence"
                        .into();
                continue;
            }
        }
        if row.prices().is_none() {
            row.reason =
                "Incomplete OHLC: observed fields retained; candle and analytics integration HOLD"
                    .into();
            continue;
        }
        if row.date.as_str() < LAUNCH {
            row.reason = "Pre-launch reconstructed OHLC: analytics integration HOLD".into();
            continue;
        }
        let Some(reference) = by_date.get(row.date.as_str()) else {
            row.reason = "No official corroboration for this date; HOLD".into();
            continue;
        };
        if row.prices() != reference.prices()
            || (row.volume.is_some() && row.volume != reference.volume)
        {
            row.status = "CONFLICT".into();
            row.reason =
                "Local and official observations disagree; both retained in evidence".into();
            continue;
        }
        row.status = "READY".into();
        row.reason =
            "Officially corroborated OHLC for this date; coverage completeness is not certified"
                .into();
        // Missing local volume stays unknown; it is never filled from price fields.
        verified.push(row.clone());
    }
    verified
}

fn check_existing(database: &Path, rows: &mut [HistoryRow]) -> Result<()> {
    let connection = Connection::open_with_flags(database, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    if get_price_storage_mode(&connection) != PriceStorageMode::Binary {
        return Err(
            "Historical backfill requires binary storage so Manual Import recovery is available"
                .into(),
        );
    }
    let root = database.parent().ok_or("Database folder unavailable")?;
    let mut existing: HashMap<u32, Vec<([i64; 4], u64)>> = HashMap::new();
    for symbol in ALIASES {
        let path = root
            .join("eod_data/NSE_INDEX")
            .join(format!("{symbol}.eod"));
        if !path.exists() {
            continue;
        }
        let file = BinaryEodFile::open(&path)?;
        if file.header.symbol != symbol || file.header.exchange != "NSE_INDEX" {
            return Err(format!("Binary identity mismatch: {}", path.display()));
        }
        if file.header.price_scale == 0 {
            return Err("Invalid existing binary price scale".into());
        }
        let scale = file.header.price_scale as f64;
        for r in file.read_all()? {
            let p = [r.open, r.high, r.low, r.close].map(|v| scaled(v as f64 / scale));
            existing.entry(r.date).or_default().push((p, r.volume));
        }
    }
    for row in rows {
        if row.status != "READY" {
            continue;
        }
        let record = row.record()?;
        if let Some(bars) = existing.get(&record.date) {
            let p = [record.open, record.high, record.low, record.close];
            if bars
                .iter()
                .all(|(other, volume)| *other == p && row.volume.is_none_or(|v| v == *volume))
            {
                row.status = "EXISTING".into();
                row.reason =
                    "Matching bar already exists in the canonical or historical alias file".into();
            } else {
                row.status = "CONFLICT".into();
                row.reason =
                    "Existing binary observation differs; no overwrite is permitted".into();
            }
        }
    }
    Ok(())
}

fn validate_window(input: &NiftyHistoryInput, today: &str) -> Result<()> {
    let from =
        NaiveDate::parse_from_str(&input.from_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let to = NaiveDate::parse_from_str(&input.to_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    if from > to || input.from_date.as_str() < "1990-07-03" || input.to_date.as_str() > today {
        return Err("Select a valid historical range ending no later than today".into());
    }
    if input.verify_official && (to - from).num_days() > 365 {
        return Err(
            "Official verification is limited to 366 calendar days per explicit request".into(),
        );
    }
    if input.file_path.is_none() && !input.verify_official {
        return Err("Select a local file or request official acquisition".into());
    }
    Ok(())
}

fn fetch_official(input: &NiftyHistoryInput) -> Result<(String, Vec<u8>)> {
    let task = NseIndexHistoryTask {
        index_type: "NIFTY 50".into(),
        symbol: "NIFTY".into(),
        from_date: input.from_date.clone(),
        to_date: input.to_date.clone(),
    };
    let url = build_nse_index_history_url(&task)?;
    // One bounded request. Never fall back to a third party or relabel an HTTP failure.
    let response = create_http_client()?
        .get(&url)
        .header(reqwest::header::REFERER, NSE_INDEX_HISTORY_PAGE_URL)
        .send()
        .map_err(|e| format!("NSE network failure (availability unknown): {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "NSE HTTP {} (availability unknown)",
            response.status()
        ));
    }
    let mut bytes = Vec::new();
    response
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("NSE response exceeds 8 MB".into());
    }
    Ok((url, bytes))
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}

fn preview_internal(
    database: &Path,
    input: &NiftyHistoryInput,
    official_input: Option<(String, Vec<u8>)>,
    today: &str,
) -> Result<Review> {
    validate_window(input, today)?;
    let official_rows = match &official_input {
        Some((_, bytes)) => parse_official(bytes, &input.from_date, &input.to_date, today)?,
        None => Vec::new(),
    };
    let source = match &input.file_path {
        Some(path) => bounded_read(Path::new(path))?,
        None => official_input
            .as_ref()
            .ok_or("Missing official evidence")?
            .1
            .clone(),
    };
    let mut rows = if input.file_path.is_some() {
        parse_local(&source, today)?
    } else {
        official_rows.clone()
    };
    let source_rows = rows.len();
    // Local parsing audits the entire file; only the user's selected range may be admitted.
    let mut verified = verify_rows(&mut rows, &official_rows);
    verified.retain(|r| r.date >= input.from_date && r.date <= input.to_date);
    check_existing(database, &mut rows)?;
    let source_hash = hash(&source);
    let official_hash = official_input.as_ref().map(|(_, bytes)| hash(bytes));
    let root = database
        .parent()
        .ok_or("Database folder unavailable")?
        .join("historical_index_review");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let token = hash(
        format!(
            "{}:{}:{:?}:{}",
            database.display(),
            source_hash,
            official_hash,
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        )
        .as_bytes(),
    );
    let evidence = root.join(&token);
    fs::create_dir(&evidence).map_err(|e| e.to_string())?;
    write_new(
        &evidence.join(if input.file_path.is_some() {
            "original.csv"
        } else {
            "original.json"
        }),
        &source,
    )?;
    if let Some((_, bytes)) = &official_input {
        write_new(&evidence.join("official.json"), bytes)?;
    }
    let count = |status: &str| rows.iter().filter(|r| r.status == status).count();
    let ready = count("READY");
    // Freeze the approved set: conflicts/held rows cannot become eligible merely
    // because a different writer removes or changes a bar after this preview.
    verified.retain(|r| rows.iter().any(|p| p.date == r.date && p.status == "READY"));
    let preview = NiftyHistoryPreview { token: token.clone(), database_path: database.to_string_lossy().into(), source_sha256: source_hash,
        official_sha256: official_hash, source_url: official_input.map(|(url,_)|url), source_rows, ready,
        existing: count("EXISTING"), conflicts: count("CONFLICT"), held: count("HOLD"), rejected: count("REJECTED"),
        close_only: rows.iter().filter(|r| r.close.is_some() && r.open.is_none() && r.high.is_none() && r.low.is_none()).count(),
        status: if ready > 0 { "PARTIALLY_CERTIFIED" } else { "HOLD" }.into(),
        certification_scope: "Only explicitly corroborated post-launch OHLC observations are eligible. Session completeness and absent/zero volume are NOT certified. Original sources and held records remain outside chart/scan storage.".into(),
        evidence_path: evidence.to_string_lossy().into(), rows };
    write_new(
        &evidence.join("review.json"),
        &serde_json::to_vec_pretty(&preview).map_err(|e| e.to_string())?,
    )?;
    write_new(&evidence.join("request.json"),serde_json::json!({"filePath":input.file_path,"fromDate":input.from_date,"toDate":input.to_date,"retrievedAtUtc":chrono::Utc::now().to_rfc3339(),"redistribution":"not granted"}).to_string().as_bytes())?;
    Ok(Review {
        database: database.into(),
        preview,
        verified,
    })
}

#[tauri::command]
pub async fn preview_nifty_history(
    app: AppHandle,
    input: NiftyHistoryInput,
) -> Result<NiftyHistoryPreview> {
    let database = get_active_database_file_path(&app)?
        .ok_or("Open a database before reviewing historical data")?;
    tauri::async_runtime::spawn_blocking(move || {
        let today = Local::now().date_naive().to_string();
        validate_window(&input, &today)?;
        let official = if input.verify_official {
            Some(fetch_official(&input)?)
        } else {
            None
        };
        let review = preview_internal(&database, &input, official, &today)?;
        let mut cache = reviews().lock().map_err(|_| "Review cache lock poisoned")?;
        if cache.len() >= 8 {
            cache.clear();
        } // Evidence persists; evicted previews must be recreated.
        let preview = review.preview.clone();
        cache.insert(preview.token.clone(), review);
        Ok(preview)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NiftyHistoryApplyInput {
    pub token: String,
    pub approved: bool,
}

fn apply_internal(review: &Review) -> Result<ImportResult> {
    if review.verified.is_empty() {
        return Err("No verified new bars were approved in this preview".into());
    }
    let evidence = Path::new(&review.preview.evidence_path);
    let original = if evidence.join("original.csv").exists() {
        "original.csv"
    } else {
        "original.json"
    };
    if hash(&bounded_read(&evidence.join(original))?) != review.preview.source_sha256
        || review
            .preview
            .official_sha256
            .as_ref()
            .is_none_or(|expected| {
                bounded_read(&evidence.join("official.json"))
                    .map(|bytes| hash(&bytes) != *expected)
                    .unwrap_or(true)
            })
    {
        return Err("Retained source evidence changed or is missing; review again".into());
    }
    let mut rows = review.verified.clone();
    for row in &mut rows {
        row.status = "READY".into();
    }
    check_existing(&review.database, &mut rows)?;
    let eligible: Vec<_> = rows.iter().filter(|r| r.status == "READY").collect();
    if rows.iter().any(|r| r.status == "CONFLICT") {
        return Err("Existing data changed since preview; a conflict now exists. Review again; nothing was overwritten.".into());
    }
    if eligible.is_empty() {
        return Ok(ImportResult {
            success: true,
            rows_read: rows.len(),
            rows_inserted: 0,
            rows_skipped: rows.len(),
            rows_error: 0,
            symbol_count: 1,
            date_range: None,
            sample_symbols: vec![],
            errors: vec![],
            duration_ms: 0,
            binary_diagnostics: None,
            recovery_session: None,
        });
    }
    // The immutable preview is evidence, not an executable user-edited manifest.
    let mut writer = csv::Writer::from_writer(Vec::new());
    writer
        .write_record(["symbol", "date", "open", "high", "low", "close", "volume"])
        .map_err(|e| e.to_string())?;
    for row in eligible {
        let [o, h, l, c] = row.prices().ok_or("Missing verified OHLC")?;
        writer
            .write_record([
                "NIFTY".into(),
                row.date.clone(),
                o.to_string(),
                h.to_string(),
                l.to_string(),
                c.to_string(),
                row.volume.unwrap_or(0).to_string(),
            ])
            .map_err(|e| e.to_string())?;
    }
    let bytes = writer.into_inner().map_err(|e| e.to_string())?;
    let path = evidence.join(format!(
        "approved-{}.csv",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    write_new(&path, &bytes)?;
    let options = ImportOptionsInput {
        file_paths: vec![path.to_string_lossy().into()],
        exchange: Some("NSE_INDEX".into()),
        has_header: Some(true),
        date_format: Some("YYYY-MM-DD".into()),
        delimiter: Some(",".into()),
        on_duplicate: Some("skip".into()),
        trim_whitespace: Some(true),
        allow_exchange_mismatch: Some(false),
    };
    // Reuses the durable journal, worker cap, synchronous binary writes and Undo.
    let mut result = import_csv_internal_reviewed_nifty(&review.database, &options, |_, _| {})?;
    if let Err(error) = write_new(
        &evidence.join(format!(
            "receipt-{}.json",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        )),
        &serde_json::to_vec_pretty(&result).map_err(|e| e.to_string())?,
    ) {
        // Do not hide an applied write from database-change/cache notifications.
        result.success = false;
        result.errors.push(format!("Historical receipt failed: {error}. Manual Import recovery journal remains authoritative."));
    }
    Ok(result)
}

#[tauri::command]
pub async fn apply_nifty_history(
    app: AppHandle,
    input: NiftyHistoryApplyInput,
) -> Result<ImportResult> {
    if !input.approved {
        return Err("Explicit approval of the historical preview is required".into());
    }
    let active = get_active_database_file_path(&app)?.ok_or("Open a database before importing")?;
    let review = reviews()
        .lock()
        .map_err(|_| "Review cache lock poisoned")?
        .get(&input.token)
        .cloned()
        .ok_or("Preview expired; review the source again")?;
    if review.database.as_path() != active.as_ref() {
        return Err("Database changed since preview; review again".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _active = active;
        let _permit = try_acquire_price_store_operation(PriceStoreOperationKind::ManualImport)?;
        let _lock = MANUAL_IMPORT_MUTATION_LOCK
            .lock()
            .map_err(|_| "Manual Import lock poisoned")?;
        if get_active_database_file_path(&app)?.as_deref() != Some(review.database.as_path()) {
            return Err("Database changed; review again".into());
        }
        let result = apply_internal(&review)?;
        notify_import_result(&app, &review.database, &result)?;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
pub(crate) mod tests;

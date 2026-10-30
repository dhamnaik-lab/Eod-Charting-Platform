//! Explicit BSE security-wise source downloads. Never imports or modifies a price database.
use chrono::{Datelike, Duration as Days, NaiveDate};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const LABEL: &str = "bse-price-history-source";
const PAGE: &str = "https://www.bseindia.com/markets/equity/eqreports/stockprchistori?flag=0";
const API: &str = "https://api.bseindia.com/BseIndiaAPI/api/StockpricesearchData/w";
const MAX_BYTES: usize = 8 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(60);
static BUSY: AtomicBool = AtomicBool::new(false);
static CANCEL: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();
static BROWSER_SESSION: OnceLock<Mutex<()>> = OnceLock::new();

pub(crate) trait BrowserRequest: Clone + Send + Sync + 'static {
    fn validate_download(&self, _bytes: &[u8]) -> Result<usize, String> {
        Err("This source does not allow native downloads.".into())
    }
    fn download_body_capture(&self) -> bool {
        false
    }
    fn page_url(&self) -> &'static str;
    fn request_url(&self) -> &str;
    fn matches(&self, raw: &str) -> bool;
    fn permits_resource(&self, raw: &str) -> bool;
    fn validate(&self, status: i32, bytes: &[u8]) -> Result<usize, String>;
}

pub(crate) fn collect_official<S: BrowserRequest>(
    app: AppHandle,
    scope: S,
    cancelled: Arc<AtomicBool>,
) -> Result<Vec<u8>, String> {
    let _session = BROWSER_SESSION
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|e| e.to_string())?;
    let profile = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("bse-price-history-browser");
    fs::create_dir_all(&profile).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        native::collect(app, scope, profile, cancelled)
    }
    #[cfg(not(windows))]
    {
        let _ = (scope, profile, cancelled);
        Err("BSE browser fallback requires Windows.".into())
    }
}

#[cfg(all(test, windows))]
pub(crate) fn collect_proof<S: BrowserRequest>(
    app: AppHandle,
    scope: S,
    profile: PathBuf,
    stop: Arc<AtomicBool>,
) -> Result<Vec<u8>, String> {
    native::collect(app, scope, profile, stop)
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BseHistoryDownloadInput {
    pub start_date: String,
    pub end_date: String,
    pub scope: String,
    pub codes: Vec<String>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BseHistoryDownloadSummary {
    pub output_folder: String,
    pub securities: usize,
    pub planned_windows: usize,
    pub completed_windows: usize,
    pub failed_windows: usize,
    pub empty_windows: usize,
    pub source_rows: usize,
    pub review_rows: usize,
    pub missing_volume_rows: usize,
    pub held_rows: usize,
    pub cancelled: bool,
}

#[derive(Clone)]
struct Scope {
    from: String,
    to: String,
    code: String,
    url: String,
}

impl BrowserRequest for Scope {
    fn page_url(&self) -> &'static str {
        Scope::page_url(self)
    }
    fn request_url(&self) -> &str {
        &self.url
    }
    fn matches(&self, raw: &str) -> bool {
        Scope::matches(self, raw)
    }
    fn permits_resource(&self, raw: &str) -> bool {
        Scope::permits_resource(self, raw)
    }
    fn validate(&self, status: i32, bytes: &[u8]) -> Result<usize, String> {
        Scope::validate(self, status, bytes)
    }
}

impl Scope {
    fn new(code: &str, from: NaiveDate, to: NaiveDate) -> Result<Self, String> {
        if code.len() != 6
            || !code.bytes().all(|c| c.is_ascii_digit())
            || to < from
            || (to - from).num_days() > 30
        {
            return Err(
                "BSE history requires a six-digit code and at most 365 dates per window.".into(),
            );
        }
        let mut url = reqwest::Url::parse(API).map_err(|e| e.to_string())?;
        url.query_pairs_mut().extend_pairs([
            ("MonthDate", from.format("%d/%m/%Y").to_string()),
            ("YearDate", to.format("%d/%m/%Y").to_string()),
            ("pageType", "0".into()),
            ("Scode", code.into()),
            ("Seg", "C".into()),
            ("rbType", "D".into()),
            ("SortOrder", "true".into()),
        ]);
        Ok(Self {
            from: from.to_string(),
            to: to.to_string(),
            code: code.into(),
            url: url.into(),
        })
    }
    fn page_url(&self) -> &'static str {
        PAGE
    }
    fn matches(&self, raw: &str) -> bool {
        fn parts(raw: &str) -> Option<(String, BTreeMap<String, String>)> {
            let mut url = reqwest::Url::parse(raw).ok()?;
            if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
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
        matches!((parts(raw),parts(&self.url)),(Some(a),Some(b)) if a==b)
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
    fn validate(&self, status: i32, bytes: &[u8]) -> Result<usize, String> {
        if status != 200 || bytes.len() > MAX_BYTES {
            return Err(format!(
                "BSE history source refused or exceeded its bound (HTTP {status})."
            ));
        }
        let value: Value =
            serde_json::from_slice(bytes).map_err(|e| format!("BSE history JSON: {e}"))?;
        let code = source_text(&value["scrip_cd"]);
        if code != self.code {
            return Err("BSE history returned a different/missing security code.".into());
        }
        if source_text(&value["scrip_id"]).ends_with('#') {
            return Err(
                "This history source is T+1 only; T+0 identifiers must remain separate.".into(),
            );
        }
        if value.get("StockData").is_none() {
            return Err("BSE history response has no StockData field.".into());
        }
        let rows = if value["StockData"].is_null() {
            &[][..]
        } else {
            value["StockData"]
                .as_array()
                .ok_or("BSE StockData is not an array.")?
                .as_slice()
        };
        let mut dates = BTreeSet::new();
        for row in rows {
            let date = source_date(row)?;
            if date < self.from || date > self.to || !dates.insert(date) {
                return Err("BSE history returned an out-of-range or duplicate date.".into());
            }
        }
        Ok(rows.len())
    }
}

fn source_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.trim().to_string(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

fn source_date(row: &Value) -> Result<String, String> {
    let raw = source_text(&row["RealDate"]);
    let date = raw
        .get(..10)
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .ok_or("BSE history row has no valid ISO RealDate.")?;
    let shown = source_text(&row["Dates"]);
    let parts = shown
        .split('/')
        .map(str::parse::<u32>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "Invalid BSE displayed date.")?;
    if parts.len() != 3
        || parts[0] != date.day()
        || parts[1] != date.month()
        || (parts[2] != date.year() as u32 && parts[2] != (date.year() % 100) as u32)
    {
        return Err("BSE ISO and displayed dates disagree.".into());
    }
    Ok(date.to_string())
}

fn selected_codes(input: &BseHistoryDownloadInput) -> Result<Vec<String>, String> {
    let codes = input
        .codes
        .iter()
        .map(|s| s.trim().to_string())
        .collect::<BTreeSet<_>>();
    if codes.is_empty()
        || codes
            .iter()
            .any(|s| s.len() != 6 || !s.bytes().all(|c| c.is_ascii_digit()))
    {
        return Err("Enter one or more six-digit BSE security codes.".into());
    }
    Ok(codes.into_iter().collect())
}

fn known_codes(connection: &rusqlite::Connection) -> Result<Vec<String>, String> {
    let mut stmt = connection
        .prepare("SELECT symbol,bse_security_code FROM instruments WHERE exchange='BSE'")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut codes = BTreeSet::new();
    let mut t0 = BTreeSet::new();
    for row in rows {
        let (symbol, code) = row.map_err(|e| e.to_string())?;
        let code = code
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| symbol.clone())
            .trim()
            .to_string();
        if code.len() == 6 && code.bytes().all(|c| c.is_ascii_digit()) {
            if symbol.ends_with('#') {
                t0.insert(code);
            } else {
                codes.insert(code);
            }
        }
    }
    Ok(codes.difference(&t0).cloned().collect())
}

fn windows(from: NaiveDate, to: NaiveDate) -> Vec<(NaiveDate, NaiveDate)> {
    let mut ranges = Vec::new();
    let mut cursor = from;
    while cursor <= to {
        // The source silently caps broad requests at 31 records. Calendar-month
        // windows cannot exceed that cap with at most one validated row per day.
        let next_month = if cursor.month() == 12 {
            NaiveDate::from_ymd_opt(cursor.year() + 1, 1, 1).unwrap()
        } else {
            NaiveDate::from_ymd_opt(cursor.year(), cursor.month() + 1, 1).unwrap()
        };
        let end = std::cmp::min(next_month - Days::days(1), to);
        ranges.push((cursor, end));
        cursor = end + Days::days(1);
    }
    ranges
}

struct BusyGuard;
impl Drop for BusyGuard {
    fn drop(&mut self) {
        if let Some(state) = CANCEL.get() {
            if let Ok(mut state) = state.lock() {
                *state = None;
            }
        }
        BUSY.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn cancel_bse_price_history_download() -> bool {
    if let Some(state) = CANCEL.get() {
        if let Ok(state) = state.lock() {
            if let Some(cancelled) = state.as_ref() {
                cancelled.store(true, Ordering::SeqCst);
                return true;
            }
        }
    }
    false
}

#[tauri::command]
pub async fn download_bse_price_history(
    app: AppHandle,
    input: BseHistoryDownloadInput,
) -> Result<BseHistoryDownloadSummary, String> {
    let from =
        NaiveDate::parse_from_str(&input.start_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let to = NaiveDate::parse_from_str(&input.end_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    if from > to || from.year() < 1900 || to > chrono::Local::now().date_naive() {
        return Err("Choose valid past dates in ascending order.".into());
    }
    if BUSY
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A BSE history download is already running.".into());
    }
    let guard = BusyGuard;
    let cancelled = Arc::new(AtomicBool::new(false));
    *CANCEL
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|e| e.to_string())? = Some(cancelled.clone());
    tauri::async_runtime::spawn_blocking(move || {
        let _guard=guard;
        let codes=match input.scope.as_str() {
            "selected"=>selected_codes(&input)?,
            "known"=>{
                let path=crate::database::get_active_database_file_path(&app)?.ok_or("Open a database to use its known BSE codes.")?;
                let connection=rusqlite::Connection::open_with_flags(path,rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e|e.to_string())?;
                connection.execute_batch("PRAGMA query_only=ON").map_err(|e|e.to_string())?;
                known_codes(&connection)?
            },
            _=>return Err("Unknown BSE history scope.".into()),
        };
        if codes.is_empty() { return Err("No usable T+1 BSE security codes were found.".into()) }
        let ranges=windows(from,to);
        let count=codes.len().checked_mul(ranges.len()).ok_or("History request is too large.")?;
        if count>50_000 { return Err(format!("This needs {count} source windows. Choose fewer codes or a shorter date range (limit 50,000).")) }
        let base=app.path().app_data_dir().map_err(|e|e.to_string())?.join("bse-price-history-downloads");
        fs::create_dir_all(&base).map_err(|e|e.to_string())?;
        let folder=base.join(format!("{}-{}",chrono::Utc::now().format("%Y%m%dT%H%M%S%.9f"),std::process::id()));
        fs::create_dir(&folder).map_err(|e|e.to_string())?;
        let mut summary=BseHistoryDownloadSummary { output_folder:folder.to_string_lossy().into_owned(),securities:codes.len(),planned_windows:count,..Default::default() };
        let mut attempts=Vec::<Value>::new();
        let mut consecutive_errors=0usize;
        super::emit_progress(&app,0,format!("BSE security-wise review download: {} known/selected codes, {count} source windows. No database import.",codes.len()));
        'codes:for code in codes {
            for &(start,end) in &ranges {
                if cancelled.load(Ordering::SeqCst) { summary.cancelled=true; break 'codes }
                let scope=Scope::new(&code,start,end)?;
                super::emit_progress(&app,((attempts.len()*100)/count) as u32,format!("BSE {code}: {start} to {end} ({}/{count})",attempts.len()+1));
                #[cfg(windows)]
                let collected=collect_official(app.clone(),scope.clone(),cancelled.clone());
                #[cfg(not(windows))]
                let collected:Result<Vec<u8>,String>=Err("BSE browser history download requires Windows.".into());
                let mut attempt=serde_json::json!({"code":code,"from":scope.from,"to":scope.to,"url":scope.url,"transport":"webview2","reviewOnly":true});
                match collected {
                    Ok(bytes)=>{
                        consecutive_errors=0;
                        let (rows,held,missing)=save_capture(&folder,&scope,&bytes)?;
                        summary.source_rows+=scope.validate(200,&bytes)?;
                        summary.review_rows+=rows; summary.held_rows+=held; summary.missing_volume_rows+=missing;
                        summary.completed_windows+=1;
                        if rows==0 { summary.empty_windows+=1; }
                        attempt["status"]=Value::String(if rows==0 {"NO_ADMITTED_ROWS"} else {"REVIEW_DATA"}.into());
                        attempt["reviewRows"]=rows.into(); attempt["heldRows"]=held.into(); attempt["missingVolumeRows"]=missing.into();
                    },
                    Err(error)=>{
                        consecutive_errors+=1;
                        summary.failed_windows+=1;
                        attempt["status"]=Value::String("SOURCE_ERROR".into()); attempt["error"]=error.clone().into();
                        super::emit_progress(&app,((attempts.len()*100)/count) as u32,format!("BSE {code}: {error}"));
                        if cancelled.load(Ordering::SeqCst) { summary.cancelled=true; }
                    },
                }
                attempts.push(attempt);
                write_json(&folder.join("manifest.json"),&serde_json::json!({"request":input,"summary":summary,"attempts":attempts,"databaseImport":false}))?;
                if summary.cancelled { break 'codes }
                // A refused browser session is not retried across thousands of codes.
                if consecutive_errors>=3 || attempts.last().and_then(|v|v["error"].as_str()).is_some_and(|s|s.contains("HTTP 403")) { break 'codes }
            }
        }
        summary.cancelled |= cancelled.load(Ordering::SeqCst);
        write_json(&folder.join("manifest.json"),&serde_json::json!({"request":input,"summary":summary,"attempts":attempts,"databaseImport":false}))?;
        super::emit_progress(&app,100,format!("BSE history sources saved: {} review rows, {} missing volumes, {} held rows, {} failed windows. Folder: {}. No database import.",summary.review_rows,summary.missing_volume_rows,summary.held_rows,summary.failed_windows,summary.output_folder));
        Ok(summary)
    }).await.map_err(|e|e.to_string())?
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(
        serde_json::to_string_pretty(value)
            .map_err(|e| e.to_string())?
            .as_bytes(),
    )
    .and_then(|_| file.sync_data())
    .map_err(|e| e.to_string())
}

fn save_capture(
    folder: &Path,
    scope: &Scope,
    bytes: &[u8],
) -> Result<(usize, usize, usize), String> {
    use sha2::{Digest, Sha256};
    scope.validate(200, bytes)?;
    let stem = format!("{}-{}-{}", scope.code, scope.from, scope.to);
    let raw = folder.join(format!("{stem}.json"));
    let mut original = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&raw)
        .map_err(|e| e.to_string())?;
    original
        .write_all(bytes)
        .and_then(|_| original.sync_data())
        .map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let rows = value["StockData"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let csv_file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(folder.join(format!("{stem}.review.csv")))
        .map_err(|e| e.to_string())?;
    let mut writer = csv::Writer::from_writer(csv_file);
    writer
        .write_record([
            "BSE_CODE",
            "DATE",
            "OPEN",
            "HIGH",
            "LOW",
            "CLOSE",
            "VOLUME",
            "SOURCE_PHYSICAL_DEMAT_FLAG",
            "SOURCE_PERIOD_FLAG",
        ])
        .map_err(|e| e.to_string())?;
    let (mut admitted, mut held, mut missing) = (0, 0, 0);
    for row in rows {
        let price = |key: &str| {
            source_text(&row[key])
                .replace(',', "")
                .parse::<f64>()
                .ok()
                .filter(|n| n.is_finite() && *n > 0.0)
        };
        let values = [
            price("qe_open"),
            price("qe_high"),
            price("qe_low"),
            price("qe_close"),
        ];
        let [Some(open), Some(high), Some(low), Some(close)] = values else {
            held += 1;
            continue;
        };
        if high < low || open < low || close < low || open > high || close > high {
            held += 1;
            continue;
        }
        let raw_volume = source_text(&row["no_of_shrs"]);
        let volume = if matches!(
            raw_volume.to_uppercase().as_str(),
            "" | "-" | "NA" | "N/A" | "NULL"
        ) {
            missing += 1;
            String::new()
        } else {
            let Ok(volume) = raw_volume.replace(',', "").parse::<u64>() else {
                held += 1;
                continue;
            };
            volume.to_string()
        };
        writer
            .write_record([
                scope.code.clone(),
                source_date(row)?,
                open.to_string(),
                high.to_string(),
                low.to_string(),
                close.to_string(),
                volume,
                source_text(&row["dematflagExist"]),
                source_text(&row["strflag"]),
            ])
            .map_err(|e| e.to_string())?;
        admitted += 1;
    }
    writer.flush().map_err(|e| e.to_string())?;
    writer.get_ref().sync_data().map_err(|e| e.to_string())?;
    write_json(
        &folder.join(format!("{stem}.manifest.json")),
        &serde_json::json!({"url":scope.url,"code":scope.code,"from":scope.from,"to":scope.to,"httpStatus":200,"sha256":format!("{:x}",Sha256::digest(bytes)),"reviewRows":admitted,"heldRows":held,"missingVolumeRows":missing,"reviewOnly":true}),
    )?;
    Ok((admitted, held, missing))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn scope() -> Scope {
        Scope::new(
            "500325",
            NaiveDate::from_ymd_opt(1995, 1, 1).unwrap(),
            NaiveDate::from_ymd_opt(1995, 1, 31).unwrap(),
        )
        .unwrap()
    }
    fn source() -> Value {
        serde_json::json!({"scrip_cd":"500325","scrip_id":"RELIANCE","StockData":[{"Dates":"2/01/95","RealDate":"1995-01-02T00:00:00","qe_open":"10","qe_high":"12","qe_low":"9","qe_close":"11","no_of_shrs":"","dematflagExist":"@","strflag":"a"}]})
    }
    #[test]
    fn source_identity_dates_and_settlement_are_checked() {
        let scope = scope();
        let mut value = source();
        assert_eq!(
            scope
                .validate(200, &serde_json::to_vec(&value).unwrap())
                .unwrap(),
            1
        );
        value["scrip_cd"] = "500002".into();
        assert!(scope
            .validate(200, &serde_json::to_vec(&value).unwrap())
            .is_err());
        value = source();
        value["scrip_id"] = "RELIANCE#".into();
        assert!(scope
            .validate(200, &serde_json::to_vec(&value).unwrap())
            .is_err());
        value = source();
        value["StockData"][0]["Dates"] = "3/01/95".into();
        assert!(scope
            .validate(200, &serde_json::to_vec(&value).unwrap())
            .is_err());
        value = source();
        let row = value["StockData"][0].clone();
        value["StockData"].as_array_mut().unwrap().push(row);
        assert!(scope
            .validate(200, &serde_json::to_vec(&value).unwrap())
            .is_err());
        assert!(scope.validate(403, b"denied").is_err());
    }
    #[test]
    fn only_fixed_source_request_and_page_resources_are_permitted() {
        let scope = scope();
        assert!(scope.matches(&scope.url));
        assert!(!scope.matches(&(scope.url.clone() + "&Scode=500002")));
        assert!(!scope.matches(&scope.url.replace("500325", "500002")));
        assert!(scope.permits_resource(PAGE));
        assert!(!scope.permits_resource("https://example.com/file"));
        assert!(!scope.permits_resource("https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w"));
    }
    #[test]
    fn review_export_retains_blank_volume_and_physical_flags_and_holds_bad_prices() {
        let folder = tempfile::tempdir().unwrap();
        let scope = scope();
        let mut value = source();
        let mut bad = value["StockData"][0].clone();
        bad["Dates"] = "3/01/95".into();
        bad["RealDate"] = "1995-01-03T00:00:00".into();
        bad["qe_high"] = "8".into();
        value["StockData"].as_array_mut().unwrap().push(bad);
        let bytes = serde_json::to_vec(&value).unwrap();
        assert_eq!(
            save_capture(folder.path(), &scope, &bytes).unwrap(),
            (1, 1, 1)
        );
        let stem = "500325-1995-01-01-1995-01-31";
        assert_eq!(
            fs::read(folder.path().join(format!("{stem}.json"))).unwrap(),
            bytes
        );
        let mut csv =
            csv::Reader::from_path(folder.path().join(format!("{stem}.review.csv"))).unwrap();
        let records = csv.records().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(&records[0][6], "");
        assert_eq!(&records[0][7], "@");
        assert_eq!(&records[0][8], "a");
        assert!(
            save_capture(folder.path(), &scope, &bytes).is_err(),
            "never overwrite previous capture"
        );
    }
    #[test]
    fn known_code_lookup_is_read_only_and_never_infers_from_names() {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection.execute_batch("CREATE TABLE instruments(symbol TEXT,exchange TEXT,bse_security_code TEXT); INSERT INTO instruments VALUES ('RELIANCE','BSE','500325'),('500325','BSE',NULL),('NAMEONLY','BSE',NULL),('NSEONLY','NSE','500002'),('T0#','BSE','500003'); PRAGMA query_only=ON;").unwrap();
        assert_eq!(known_codes(&connection).unwrap(), vec!["500325"]);
        let count: i64 = connection
            .query_row("SELECT count(*) FROM instruments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 5);
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "Explicit official-source WebView2 proof; no application setup or database access"]
    fn native_history_source_proof() {
        let profile = tempfile::Builder::new()
            .prefix("eod-history-proof-")
            .tempdir()
            .unwrap();
        let outputs = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../outputs");
        let evidence = tempfile::Builder::new()
            .prefix("bse-history-native-")
            .tempdir_in(outputs)
            .unwrap()
            .keep();
        let mut context = tauri::generate_context!();
        context.config_mut().app.windows.clear();
        // Deliberately no normal app setup, commands, plugins, or database initialization.
        let app = tauri::Builder::default()
            .any_thread()
            .build(context)
            .unwrap();
        let handle = app.handle().clone();
        let profile_path = profile.path().to_path_buf();
        let saved = evidence.clone();
        let worker = std::thread::spawn(move || {
            let result = (|| -> Result<Value, String> {
                let mut captures = Vec::new();
                let mut ranges = windows(
                    NaiveDate::from_ymd_opt(1995, 1, 1).unwrap(),
                    NaiveDate::from_ymd_opt(1995, 1, 31).unwrap(),
                );
                ranges.extend(windows(
                    NaiveDate::from_ymd_opt(2005, 1, 1).unwrap(),
                    NaiveDate::from_ymd_opt(2005, 12, 31).unwrap(),
                ));
                for (from, to) in ranges {
                    let scope = Scope::new("500325", from, to)?;
                    let bytes = native::collect(
                        handle.clone(),
                        scope.clone(),
                        profile_path.clone(),
                        Arc::new(AtomicBool::new(false)),
                    )?;
                    let count = scope.validate(200, &bytes)?;
                    let (rows, held, missing) = save_capture(&saved, &scope, &bytes)?;
                    if count == 0 || rows == 0 {
                        return Err("Expected an available source window.".into());
                    }
                    captures.push(serde_json::json!({"from":from.to_string(),"to":to.to_string(),"sourceRows":count,"reviewRows":rows,"heldRows":held,"missingVolumeRows":missing}));
                }
                // A Full History run begins before many securities had prices.
                // Verify a code-bound empty response rather than inferring a
                // listing date or treating a missing archive as a holiday.
                let empty = Scope::new(
                    "532540",
                    NaiveDate::from_ymd_opt(1995, 1, 1).unwrap(),
                    NaiveDate::from_ymd_opt(1995, 1, 31).unwrap(),
                )?;
                let bytes = native::collect(
                    handle.clone(),
                    empty.clone(),
                    profile_path.clone(),
                    Arc::new(AtomicBool::new(false)),
                )?;
                let count = empty.validate(200, &bytes)?;
                let exported = save_capture(&saved, &empty, &bytes)?;
                if count != 0 || exported != (0, 0, 0) {
                    return Err("Expected a valid empty security-history window.".into());
                }
                captures.push(serde_json::json!({"code":empty.code,"from":empty.from,"to":empty.to,"sourceRows":count,"expectedEmpty":true}));
                Ok(
                    serde_json::json!({"captures":captures,"databaseOpened":false,"databaseImport":false}),
                )
            })();
            handle.exit(0);
            result
        });
        app.run_return(|_, event| {
            // Each capture destroys its temporary window. Keep this isolated app
            // alive between windows until the worker explicitly requests exit.
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
        let result = worker.join().unwrap();
        write_json(
            &evidence.join("proof.json"),
            &serde_json::json!({"result":result,"databaseOpened":false,"databaseImport":false}),
        )
        .unwrap();
        println!("BSE native history evidence: {}", evidence.display());
        let profile_path = profile.path().canonicalize().unwrap();
        assert_eq!(
            profile_path.parent(),
            Some(std::env::temp_dir().canonicalize().unwrap().as_path())
        );
        let mut cleanup = profile.close();
        for _ in 0..20 {
            if cleanup.is_ok() || !profile_path.exists() {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
            cleanup = fs::remove_dir_all(&profile_path);
        }
        assert!(
            !profile_path.exists(),
            "Temporary WebView profile cleanup incomplete"
        );
        println!("Native history result: {result:?}");
        result.unwrap();
    }

    #[test]
    fn long_ranges_are_bounded_and_contiguous_including_leap_days() {
        let start = NaiveDate::from_ymd_opt(1995, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2006, 1, 1).unwrap();
        let ranges = windows(start, end);
        assert_eq!(ranges[0].0, start);
        assert_eq!(ranges.last().unwrap().1, end);
        for range in &ranges {
            assert!((range.1 - range.0).num_days() <= 30);
            assert_eq!(range.0.month(), range.1.month());
        }
        for pair in ranges.windows(2) {
            assert_eq!(pair[0].1 + Days::days(1), pair[1].0);
        }
    }
}

// Native lifecycle adapted from the accepted CA collector; CA source stays unchanged.
#[cfg(windows)]
mod native {
    use super::*;
    use tauri::{
        webview::{DownloadEvent, NewWindowResponse},
        AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
    };
    use webview2_com::{
        BytesReceivedChangedEventHandler, CoTaskMemPWSTR, DownloadStartingEventHandler,
        Microsoft::Web::WebView2::Win32::*, PermissionRequestedEventHandler,
        WebResourceRequestedEventHandler, WebResourceResponseReceivedEventHandler,
        WebResourceResponseViewGetContentCompletedHandler,
    };
    use windows::{
        core::{w, Interface, PWSTR},
        Win32::System::Com::IStream,
    };

    struct Completion {
        finished: AtomicBool,
        sender: SyncSender<Result<Vec<u8>, String>>,
    }

    impl Completion {
        fn finish(&self, result: Result<Vec<u8>, String>) {
            if !self.finished.swap(true, Ordering::SeqCst) {
                let _ = self.sender.try_send(result);
            }
        }
    }

    #[derive(Default)]
    struct Tokens {
        request: Option<i64>,
        response: Option<i64>,
        permission: Option<i64>,
        download: Option<i64>,
    }

    thread_local! {
        // COM download operations stay on the WebView UI thread and are
        // cancelled/unregistered before destroying this serialized window.
        static DOWNLOAD_OPERATIONS: std::cell::RefCell<Vec<(ICoreWebView2DownloadOperation,i64)>> = const { std::cell::RefCell::new(Vec::new()) };
    }

    unsafe fn install_download_limit<S: BrowserRequest>(
        core: &ICoreWebView2,
        scope: S,
        done: Arc<Completion>,
        tokens: &Arc<Mutex<Tokens>>,
    ) -> windows::core::Result<()> {
        let core4: ICoreWebView2_4 = core.cast()?;
        let mut token = 0;
        core4.add_DownloadStarting(
            &DownloadStartingEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()) };
                let operation = args.DownloadOperation()?;
                let mut raw = PWSTR::null();
                operation.Uri(&mut raw)?;
                let url = CoTaskMemPWSTR::from(raw).to_string();
                if done.finished.load(Ordering::SeqCst) || !scope.matches(&url) {
                    args.SetCancel(true)?;
                    return Ok(());
                }
                let mut total = 0;
                operation.TotalBytesToReceive(&mut total)?;
                if total > MAX_BYTES as i64 {
                    args.SetCancel(true)?;
                    done.finish(Err("BSE download exceeds the byte limit.".into()));
                    return Ok(());
                }
                let size_done = done.clone();
                let mut size_token = 0;
                operation.add_BytesReceivedChanged(
                    &BytesReceivedChangedEventHandler::create(Box::new(move |operation, _| {
                        if let Some(operation) = operation {
                            let mut bytes = 0;
                            operation.BytesReceived(&mut bytes)?;
                            if bytes > MAX_BYTES as i64 {
                                let _ = operation.Cancel();
                                size_done
                                    .finish(Err("BSE download exceeded the byte limit.".into()));
                            }
                        }
                        Ok(())
                    })),
                    &mut size_token,
                )?;
                DOWNLOAD_OPERATIONS
                    .with(|operations| operations.borrow_mut().push((operation, size_token)));
                Ok(())
            })),
            &mut token,
        )?;
        tokens.lock().unwrap().download = Some(token);
        Ok(())
    }

    struct DownloadFile {
        folder: PathBuf,
    }
    impl DownloadFile {
        fn new() -> Result<Self, String> {
            let folder = std::env::temp_dir().join(format!(
                "eod-bse-source-{}-{}",
                std::process::id(),
                chrono::Utc::now().format("%Y%m%d%H%M%S%.9f")
            ));
            fs::create_dir(&folder).map_err(|e| e.to_string())?;
            Ok(Self { folder })
        }
        fn path(&self) -> PathBuf {
            self.folder.join("response.bin")
        }
        fn cleanup(&self) -> Result<(), String> {
            // Only this freshly-created directory and fixed filename are removed.
            for _ in 0..20 {
                match fs::remove_file(self.path()) {
                    Ok(()) => break,
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => break,
                    Err(_) => std::thread::sleep(Duration::from_millis(50)),
                }
            }
            match fs::remove_dir(&self.folder) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(format!("BSE temporary capture cleanup: {e}")),
            }
        }
    }
    impl Drop for DownloadFile {
        fn drop(&mut self) {
            let _ = self.cleanup();
        }
    }

    unsafe fn request_uri(
        request: &ICoreWebView2WebResourceRequest,
    ) -> windows::core::Result<String> {
        let mut uri = PWSTR::null();
        request.Uri(&mut uri)?;
        Ok(CoTaskMemPWSTR::from(uri).to_string())
    }

    unsafe fn read_body(stream: &IStream) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        loop {
            let mut chunk = [0u8; 16384];
            let mut read = 0u32;
            stream
                .Read(
                    chunk.as_mut_ptr().cast(),
                    chunk.len() as u32,
                    Some(&mut read),
                )
                .ok()
                .map_err(|e| e.to_string())?;
            if bytes.len() + read as usize > MAX_BYTES {
                return Err("BSE browser response exceeded the byte limit.".into());
            }
            bytes.extend_from_slice(&chunk[..read as usize]);
            if read == 0 {
                return Ok(bytes);
            }
        }
    }

    unsafe fn install<S: BrowserRequest>(
        platform: tauri::webview::PlatformWebview,
        scope: S,
        completion: Arc<Completion>,
        tokens: Arc<Mutex<Tokens>>,
    ) -> windows::core::Result<()> {
        let core = platform.controller().CoreWebView2()?;
        let core2: ICoreWebView2_2 = core.cast()?;
        if scope.download_body_capture() {
            install_download_limit(&core, scope.clone(), completion.clone(), &tokens)?;
        }
        let settings = core.Settings()?;
        settings.SetIsWebMessageEnabled(false)?;
        settings.SetAreHostObjectsAllowed(false)?;
        settings.SetAreDefaultScriptDialogsEnabled(false)?;
        settings.SetAreDevToolsEnabled(false)?;
        let mut messaging = windows::core::BOOL::default();
        settings.IsWebMessageEnabled(&mut messaging)?;
        if messaging.as_bool() {
            return Err(windows::core::Error::from_hresult(windows::core::HRESULT(
                0x80004005u32 as i32,
            )));
        }
        let mut token = 0;
        core.add_PermissionRequested(
            &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                }
                Ok(())
            })),
            &mut token,
        )?;
        tokens.lock().unwrap().permission = Some(token);

        core.AddWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?;
        let policy = scope.clone();
        let environment = platform.environment();
        let request_completion = completion.clone();
        core.add_WebResourceRequested(
            &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                let result = (|| -> windows::core::Result<()> {
                    if let Some(args) = args {
                        let uri = request_uri(&args.Request()?)?;
                        if request_completion.finished.load(Ordering::SeqCst)
                            || !policy.permits_resource(&uri)
                        {
                            let response = environment.CreateWebResourceResponse(
                                None::<&IStream>,
                                403,
                                w!("Blocked by source collector"),
                                w!("Content-Length: 0\r\n"),
                            )?;
                            args.SetResponse(&response)?;
                        }
                    }
                    Ok(())
                })();
                if let Err(error) = result {
                    request_completion.finish(Err(format!("BSE browser request guard: {error}")));
                }
                Ok(())
            })),
            &mut token,
        )?;
        tokens.lock().unwrap().request = Some(token);

        let page_url = scope.page_url();
        core2.add_WebResourceResponseReceived(
            &WebResourceResponseReceivedEventHandler::create(Box::new(move |_, args| {
                if completion.finished.load(Ordering::SeqCst) {
                    return Ok(());
                }
                let result = (|| -> windows::core::Result<()> {
                    let Some(args) = args else { return Ok(()) };
                    if !scope.matches(&request_uri(&args.Request()?)?) {
                        return Ok(());
                    }
                    let response = args.Response()?;
                    let mut status = 0;
                    response.StatusCode(&mut status)?;
                    if status != 200 {
                        completion.finish(Err(format!("BSE browser API returned HTTP {status}.")));
                        return Ok(());
                    }
                    let done = completion.clone();
                    let response_scope = scope.clone();
                    response.GetContent(
                        &WebResourceResponseViewGetContentCompletedHandler::create(Box::new(
                            move |status, stream| {
                                if done.finished.load(Ordering::SeqCst) {
                                    return Ok(());
                                }
                                if stream.is_none() && response_scope.download_body_capture() {
                                    return Ok(());
                                }
                                let result = status
                                    .map_err(|e| e.to_string())
                                    .and_then(|_| {
                                        read_body(
                                            &stream.ok_or("BSE browser response has no body.")?,
                                        )
                                    })
                                    .and_then(|bytes| {
                                        response_scope.validate(200, &bytes).map(|_| bytes)
                                    });
                                done.finish(result);
                                Ok(())
                            },
                        )),
                    )?;
                    Ok(())
                })();
                if let Err(error) = result {
                    completion.finish(Err(format!("BSE browser response capture: {error}")));
                }
                Ok(())
            })),
            &mut token,
        )?;
        tokens.lock().unwrap().response = Some(token);
        let page = CoTaskMemPWSTR::from(page_url);
        core.Navigate(*page.as_ref().as_pcwstr())?;
        Ok(())
    }

    fn wait_result(
        receiver: Receiver<Result<Vec<u8>, String>>,
        cancelled: &AtomicBool,
        deadline: Instant,
    ) -> Result<Vec<u8>, String> {
        loop {
            if cancelled.load(Ordering::SeqCst) {
                return Err(
                    "BSE history download cancelled. Completed source files are retained.".into(),
                );
            }
            if Instant::now() >= deadline {
                return Err("BSE browser collection timed out after 60 seconds.".into());
            }
            match receiver.recv_timeout(Duration::from_millis(100)) {
                Ok(result) => return result,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(error) => return Err(format!("BSE browser collector disconnected: {error}")),
            }
        }
    }

    #[test]
    fn temporary_download_capture_is_removed_without_touching_other_files() {
        let other = tempfile::tempdir().unwrap();
        let sentinel = other.path().join("keep.txt");
        fs::write(&sentinel, "keep").unwrap();
        let capture = DownloadFile::new().unwrap();
        let folder = capture.folder.clone();
        fs::write(capture.path(), "source").unwrap();
        capture.cleanup().unwrap();
        assert!(!folder.exists());
        assert_eq!(fs::read_to_string(sentinel).unwrap(), "keep");
    }

    #[test]
    fn cancelled_and_expired_browser_waits_return_without_a_response() {
        let (_sender, receiver) = mpsc::sync_channel(1);
        assert!(
            wait_result(receiver, &AtomicBool::new(true), Instant::now() + TIMEOUT)
                .unwrap_err()
                .contains("cancelled")
        );
        let (_sender, receiver) = mpsc::sync_channel(1);
        assert!(
            wait_result(receiver, &AtomicBool::new(false), Instant::now())
                .unwrap_err()
                .contains("timed out")
        );
    }

    pub(crate) fn collect<S: BrowserRequest>(
        app: AppHandle,
        scope: S,
        profile: PathBuf,
        cancelled: Arc<AtomicBool>,
    ) -> Result<Vec<u8>, String> {
        if cancelled.load(Ordering::SeqCst) {
            return Err(
                "BSE history download cancelled. Completed source files are retained.".into(),
            );
        }
        let deadline = Instant::now() + TIMEOUT;
        let (ready, initialized) = mpsc::sync_channel(1);
        let (sender, receiver) = mpsc::sync_channel(1);
        let completion = Arc::new(Completion {
            finished: AtomicBool::new(false),
            sender,
        });
        let tokens = Arc::new(Mutex::new(Tokens::default()));
        let setup_done = completion.clone();
        let download = DownloadFile::new()?;
        let download_path = download.path();
        let setup_tokens = tokens.clone();
        let handle = app.clone();
        app.run_on_main_thread(move || {
        if setup_done.finished.load(Ordering::SeqCst) { let _ = ready.try_send(()); return }
        let navigation_done = setup_done.clone();
        let navigation_scope=scope.clone();
        let page_done = setup_done.clone();
        let download_done=setup_done.clone(); let download_scope=scope.clone();
        let triggered = AtomicBool::new(false);
        let page_url = scope.page_url();
        // Drain the body with an explicit bound. Large CSV/ZIP responses can
        // otherwise stall under Fetch backpressure before native GetContent
        // completes. Bytes still enter Rust only through native response capture.
        let script = if scope.download_body_capture() {
            format!("(() => {{ const link = document.createElement('a'); link.href = {}; link.download = 'response.bin'; document.body.appendChild(link); link.click(); link.remove(); }})();",serde_json::to_string(scope.request_url()).unwrap())
        } else {
            format!("void fetch({}, {{credentials:'omit',cache:'no-store',redirect:'error'}}).then(async response => {{ const reader = response.body?.getReader(); if (!reader) return; let total = 0; while (true) {{ const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > {}) {{ await reader.cancel(); break; }} }} }}).catch(() => {{}});", serde_json::to_string(scope.request_url()).unwrap(), MAX_BYTES)
        };
        let window = WebviewWindowBuilder::new(&handle, LABEL, WebviewUrl::External("about:blank".parse().unwrap()))
            .title("BSE official source collection")
            .visible(false).skip_taskbar(true).incognito(true).data_directory(profile)
            .devtools(false).disable_drag_drop_handler()
            .on_navigation(move |url| {
                let allowed = url.as_str() == "about:blank" || url.as_str() == page_url || (navigation_scope.download_body_capture() && navigation_scope.matches(url.as_str()));
                if !allowed { navigation_done.finish(Err(format!("BSE browser unexpected navigation: {}", url.origin().ascii_serialization()))); }
                allowed
            })
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_download(move |_, event| {
                match event {
                    DownloadEvent::Requested{url,destination} => {
                        if download_done.finished.load(Ordering::SeqCst) || !download_scope.download_body_capture() || !download_scope.matches(url.as_str()) {return false}
                        *destination=download_path.clone(); true
                    },
                    DownloadEvent::Finished{url,path,success} => {
                        if download_done.finished.load(Ordering::SeqCst) {return false}
                        let result=(|| -> Result<Vec<u8>,String> {
                            use std::io::Read;
                            let path_matches=matches!((path.as_ref().and_then(|p|p.canonicalize().ok()),download_path.canonicalize().ok()),(Some(actual),Some(expected)) if actual==expected);
                            if !success || !download_scope.matches(url.as_str()) || !path_matches {return Err(format!("BSE controlled download verification: success={success}; scopedUrl={}; destination={path_matches}",download_scope.matches(url.as_str())))}
                            let file=fs::File::open(&download_path).map_err(|e|e.to_string())?;
                            let mut bytes=Vec::new(); file.take((MAX_BYTES+1) as u64).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
                            download_scope.validate_download(&bytes)?; Ok(bytes)
                        })();
                        match result {Ok(bytes)=>download_done.finish(Ok(bytes)),Err(error)=>download_done.finish(Err(error))}; true
                    },
                    _=>false,
                }
            })
            .on_page_load(move |window, payload| {
                if payload.url().as_str() == page_url
                    && payload.event() == tauri::webview::PageLoadEvent::Finished
                    && !page_done.finished.load(Ordering::SeqCst)
                    && !triggered.swap(true, Ordering::SeqCst)
                {
                    if let Err(error) = window.eval(&script) { page_done.finish(Err(format!("BSE browser request dispatch: {error}"))); }
                }
            }).build();
        match window {
            Ok(window) => {
                let closed = setup_done.clone();
                window.on_window_event(move |event| {
                    if matches!(event, tauri::WindowEvent::Destroyed | tauri::WindowEvent::CloseRequested { .. }) {
                        closed.finish(Err("BSE collection window closed. Completed windows are saved.".into()));
                    }
                });
                if setup_done.finished.load(Ordering::SeqCst) { let _ = window.destroy(); let _ = ready.try_send(()); return }
                let failed = setup_done.clone();
                let setup_failed = ready.clone();
                if let Err(error) = window.with_webview(move |platform| unsafe {
                    if let Err(error) = install(platform, scope, setup_done.clone(), setup_tokens) {
                        setup_done.finish(Err(format!("BSE native browser setup: {error}")));
                    }
                    let _ = ready.try_send(());
                }) { failed.finish(Err(error.to_string())); let _ = setup_failed.try_send(()); }
            }
            Err(error) => { setup_done.finish(Err(format!("BSE browser creation: {error}"))); let _ = ready.try_send(()); }
        }
    }).map_err(|e| e.to_string())?;
        // Do not tear down a half-created window. Native initialization must
        // acknowledge registration first, even if cancellation arrived meanwhile.
        let result =
            match initialized.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(()) => wait_result(receiver, &cancelled, deadline),
                Err(error) => Err(format!(
                    "BSE browser initialization did not complete: {error}"
                )),
            };
        completion.finished.store(true, Ordering::SeqCst);
        // Explicitly remove native handlers, stop requests, then destroy this window.
        let (cleaned, cleanup) = mpsc::sync_channel(1);
        let cleanup_app = app.clone();
        app.run_on_main_thread(move || {
            if let Some(window) = cleanup_app.get_webview_window(LABEL) {
                let destroyed = cleaned.clone();
                window.on_window_event(move |event| {
                    if matches!(event, tauri::WindowEvent::Destroyed) {
                        let _ = destroyed.try_send(Ok(()));
                    }
                });
                let close_window = window.clone();
                let failed = cleaned.clone();
                if let Err(error) = window.with_webview(move |platform| unsafe {
                    let core = platform.controller().CoreWebView2();
                    if let Ok(core) = core {
                        let _ = core.Stop();
                        DOWNLOAD_OPERATIONS.with(|operations| {
                            for (operation, token) in operations.borrow_mut().drain(..) {
                                let _ = operation.Cancel();
                                let _ = operation.remove_BytesReceivedChanged(token);
                            }
                        });
                        let tokens = tokens.lock().unwrap();
                        if let (Ok(core4), Some(token)) =
                            (core.cast::<ICoreWebView2_4>(), tokens.download)
                        {
                            let _ = core4.remove_DownloadStarting(token);
                        }
                        if let Some(t) = tokens.request {
                            let _ = core.remove_WebResourceRequested(t);
                        }
                        if let Some(t) = tokens.permission {
                            let _ = core.remove_PermissionRequested(t);
                        }
                        if let (Ok(core2), Some(t)) =
                            (core.cast::<ICoreWebView2_2>(), tokens.response)
                        {
                            let _ = core2.remove_WebResourceResponseReceived(t);
                        }
                    }
                    if let Err(error) = close_window.destroy() {
                        let _ = cleaned.try_send(Err(error.to_string()));
                    }
                }) {
                    let _ = window.destroy();
                    let _ = failed.try_send(Err(error.to_string()));
                }
            } else {
                let _ = cleaned.try_send(Ok(()));
            }
        })
        .map_err(|e| e.to_string())?;
        cleanup
            .recv_timeout(Duration::from_secs(5))
            .map_err(|e| format!("BSE browser cleanup incomplete: {e}"))??;
        download.cleanup()?;
        result
    }
}

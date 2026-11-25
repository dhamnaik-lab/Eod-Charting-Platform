//! Internal transport fallback for the same official daily sources. Never
//! converts security-wise history into Bhavcopy or guesses an instrument name.
use super::{
    bse_price_history::{collect_official, BrowserRequest},
    calendar::parse_trade_date,
    parsers::{extract_first_csv_from_zip, normalize_bse_index_archive_json},
    sources::{generate_bse_candidates, generate_bse_index_candidates},
    transport::{is_html_response, parse_bse_api_filename},
    types::*,
};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    sync::{atomic::AtomicBool, Arc, Mutex},
};
use tauri::AppHandle;

const PAGE: &str = "https://www.bseindia.com/markets/equity/eqreports/stockprchistori?flag=0";
const MAX_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone)]
struct RequestScope {
    url: String,
    kind: Payload,
}
#[derive(Clone)]
enum Payload {
    Csv,
    Zip,
    Filename(&'static str),
    Index,
}

fn canonical_url(raw: &str) -> Option<(String, BTreeMap<String, String>)> {
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

impl BrowserRequest for RequestScope {
    fn download_body_capture(&self) -> bool {
        matches!(self.kind, Payload::Csv | Payload::Zip)
    }
    fn page_url(&self) -> &'static str {
        PAGE
    }
    fn request_url(&self) -> &str {
        &self.url
    }
    fn matches(&self, raw: &str) -> bool {
        matches!((canonical_url(raw),canonical_url(&self.url)),(Some(a),Some(b)) if a==b)
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
                "BSE browser source refused or exceeded bounds (HTTP {status})."
            ));
        }
        self.validate_payload(bytes)
    }
    fn validate_download(&self, bytes: &[u8]) -> Result<usize, String> {
        if !self.download_body_capture() {
            return Err("Only daily CSV/ZIP sources may use native downloads.".into());
        }
        self.validate_payload(bytes)
    }
}

impl RequestScope {
    fn validate_payload(&self, bytes: &[u8]) -> Result<usize, String> {
        if bytes.len() > MAX_BYTES {
            return Err("BSE browser source exceeded the byte limit.".into());
        }
        match self.kind {
            Payload::Zip if bytes.starts_with(b"PK\x03\x04") => Ok(bytes.len()),
            Payload::Zip => Err("BSE browser response is not the requested ZIP archive.".into()),
            Payload::Csv => {
                let text = std::str::from_utf8(bytes).map_err(|e| e.to_string())?;
                if is_html_response(text) {
                    return Err("BSE browser returned HTML instead of Bhavcopy.".into());
                }
                let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
                let headers = reader.headers().map_err(|e| e.to_string())?;
                let keys = headers
                    .iter()
                    .map(|s| s.trim().trim_start_matches('\u{feff}').to_ascii_uppercase())
                    .collect::<Vec<_>>();
                if !keys.iter().any(|s| {
                    matches!(
                        s.as_str(),
                        "SC_CODE" | "TCKRSYMB" | "SYMBOL" | "INDEX_NAME" | "INDEXNAME"
                    )
                }) || !keys.iter().any(|s| {
                    matches!(
                        s.as_str(),
                        "CLOSE" | "CLSPRIC" | "CLOSING_INDEX_VALUE" | "CLOSE_PRICE"
                    )
                }) {
                    return Err("BSE browser response has no recognized Bhavcopy header.".into());
                }
                Ok(bytes.len())
            }
            Payload::Filename(key) => {
                let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
                if value.get(key).is_some_and(|v| v.is_array()) {
                    Ok(bytes.len())
                } else {
                    Err("BSE browser response has no expected filename list.".into())
                }
            }
            Payload::Index => {
                let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
                if value.get("Table").is_some_and(|v| v.is_array()) {
                    Ok(bytes.len())
                } else {
                    Err("BSE browser response has no index Table.".into())
                }
            }
        }
    }
}

fn builtins(task: &DownloadTask) -> Result<Vec<Candidate>, String> {
    let date = parse_trade_date(&task.trade_date)?;
    match task.exchange.as_str() {
        "BSE" => Ok(generate_bse_candidates(date, None)),
        "BSE_INDEX" | "BSEINDEX" => Ok(generate_bse_index_candidates(date, None)),
        _ => Ok(Vec::new()),
    }
}
fn payload(candidate: &Candidate) -> Payload {
    if let Some(key) = candidate.bse_response_key {
        Payload::Filename(key)
    } else if candidate.bse_index_archive_json {
        Payload::Index
    } else if candidate.zipped {
        Payload::Zip
    } else {
        Payload::Csv
    }
}
fn filename_url(
    base: &str,
    key: &str,
    name: &str,
    trade_date: &str,
) -> Result<(String, Payload), String> {
    let (url, zipped) = super::transport::validated_bse_filename_url(base, key, name, trade_date)?;
    let kind = if zipped { Payload::Zip } else { Payload::Csv };
    Ok((url, kind))
}

fn fetch_candidate(
    candidate: &Candidate,
    trade_date: &str,
    mut fetch: impl FnMut(RequestScope) -> Result<Option<Vec<u8>>, String>,
) -> Result<Option<Vec<u8>>, String> {
    let Some(bytes) = fetch(RequestScope {
        url: candidate.url.clone(),
        kind: payload(candidate),
    })?
    else {
        if candidate.bse_download_base.is_some() {
            return Err("BSE browser filename discovery endpoint returned HTTP 404.".into());
        }
        return Ok(None);
    };
    let Some(base) = candidate.bse_download_base else {
        return Ok(Some(bytes));
    };
    let key = candidate
        .bse_response_key
        .ok_or("BSE source is missing its response key.")?;
    let Some(name) = parse_bse_api_filename(&bytes, key)? else {
        return Ok(None);
    };
    let (url, kind) = filename_url(base, key, &name, trade_date)?;
    fetch(RequestScope { url, kind })?
        .map(Some)
        .ok_or_else(|| "BSE browser API referenced a file that returned HTTP 404.".to_string())
}

fn decode(
    candidate: &Candidate,
    bytes: &[u8],
    task: &DownloadTask,
) -> Result<Option<String>, String> {
    if candidate.bse_index_archive_json {
        return normalize_bse_index_archive_json(bytes, &task.trade_date);
    }
    let zipped = candidate.zipped || bytes.starts_with(b"PK\x03\x04");
    let content = if zipped {
        let Some(csv) = extract_first_csv_from_zip(bytes)? else {
            return Err("BSE browser ZIP did not contain readable CSV/TXT data.".into());
        };
        csv
    } else {
        bytes.to_vec()
    };
    RequestScope {
        url: candidate.url.clone(),
        kind: Payload::Csv,
    }
    .validate(200, &content)?;
    String::from_utf8(content)
        .map(Some)
        .map_err(|e| e.to_string())
}

pub(super) fn should_recover(
    task: &DownloadTask,
    outcome: &Result<StagedDownloadOutcome, String>,
) -> bool {
    if !matches!(task.exchange.as_str(), "BSE" | "BSE_INDEX" | "BSEINDEX") {
        return false;
    }
    match outcome {
        Err(_) => true,
        Ok(StagedDownloadOutcome::Result(result)) => !result.success,
        Ok(StagedDownloadOutcome::Ready(_) | StagedDownloadOutcome::Cancelled) => false,
    }
}

#[derive(Default)]
struct Circuit {
    failures: usize,
    disabled: bool,
}
impl Circuit {
    fn failed(&mut self, error: &str) {
        self.failures += 1;
        self.disabled =
            self.failures >= 3 || error.contains("HTTP 403") || error.contains("HTTP 429");
    }
}
fn browser_response(result: Result<Vec<u8>, String>) -> Result<Option<Vec<u8>>, String> {
    match result {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error == "BSE browser API returned HTTP 404." => Ok(None),
        Err(error) => Err(error),
    }
}
#[derive(Default)]
pub(super) struct BrowserFallback {
    circuit: Mutex<Circuit>,
    progress: std::sync::atomic::AtomicU32,
}
impl BrowserFallback {
    pub(super) fn set_progress(&self, progress: u32) {
        self.progress
            .fetch_max(progress, std::sync::atomic::Ordering::Relaxed);
    }
    pub(super) fn recover(
        &self,
        app: &AppHandle,
        task: &DownloadTask,
        worker_stop: Arc<AtomicBool>,
        user_stop: &super::BatchStop,
    ) -> Result<Option<StagedDownload>, String> {
        self.recover_with(app, task, worker_stop.clone(), |scope| {
            // Let a browser request already in flight finish normally.
            user_stop
                .run_if_active(|| {
                    browser_response(collect_official(app.clone(), scope, worker_stop.clone()))
                })
                .unwrap_or(Ok(None))
        })
    }

    fn recover_with(
        &self,
        app: &AppHandle,
        task: &DownloadTask,
        stop: Arc<AtomicBool>,
        mut fetch: impl FnMut(RequestScope) -> Result<Option<Vec<u8>>, String>,
    ) -> Result<Option<StagedDownload>, String> {
        let mut state = self.circuit.lock().map_err(|e| e.to_string())?;
        if state.disabled {
            return Err("BSE browser fallback stopped after a source refusal/repeated failures; normal URL alternatives remain active.".into());
        }
        super::emit_progress(
            app,
            self.progress.load(std::sync::atomic::Ordering::Relaxed),
            format!(
                "[{}] {}: official URL alternatives failed; trying automatic browser fallback.",
                task.exchange, task.trade_date
            ),
        );
        let mut last_error = None;
        for candidate in builtins(task)? {
            if stop.load(std::sync::atomic::Ordering::SeqCst) {
                return Err("Bhavcopy fallback stopped.".into());
            }
            let result =
                fetch_candidate(&candidate, &task.trade_date, &mut fetch).and_then(|bytes| {
                    match bytes {
                        Some(bytes) => {
                            let decoded = decode(&candidate, &bytes, task)?;
                            if let Some(csv) = &decoded {
                                let parsed = super::parse_bhavcopy_csv(
                                    csv,
                                    &task.exchange,
                                    &task.trade_date,
                                    &[],
                                )?;
                                if let Some(debug) = parsed.debug {
                                    return Err(debug);
                                }
                                if parsed.rows.is_empty() {
                                    return Err(
                                        "BSE browser candidate contains no usable rows.".into()
                                    );
                                }
                            }
                            Ok(decoded)
                        }
                        None => Ok(None),
                    }
                });
            match result {
                Ok(Some(csv)) => {
                    state.failures = 0;
                    super::emit_progress(app,self.progress.load(std::sync::atomic::Ordering::Relaxed),format!("[{}] {}: browser recovered an official source; normal import validation follows.",task.exchange,task.trade_date));
                    return Ok(Some(StagedDownload {
                        task: task.clone(),
                        content: StagedDownloadContent::Csv(csv),
                    }));
                }
                Ok(None) => {}
                Err(error) => {
                    state.failed(&error);
                    last_error = Some(error);
                    if state.disabled {
                        break;
                    }
                }
            }
        }
        if let Some(error) = last_error {
            Err(error)
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_and_blocked_responses_have_different_outcomes_and_circuit_is_bounded() {
        assert!(
            browser_response(Err("BSE browser API returned HTTP 404.".into()))
                .unwrap()
                .is_none()
        );
        assert!(browser_response(Err("BSE browser API returned HTTP 403.".into())).is_err());
        let mut circuit = Circuit::default();
        circuit.failed("timeout");
        assert!(!circuit.disabled);
        circuit.failed("timeout");
        assert!(!circuit.disabled);
        circuit.failed("timeout");
        assert!(circuit.disabled);
        let mut blocked = Circuit::default();
        blocked.failed("HTTP 403");
        assert!(blocked.disabled);
    }
    #[test]
    fn direct_http_403_is_not_reported_as_a_missing_archive() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
            time::Duration,
        };
        for status in [403, 404] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut buffer = [0; 4096];
                let _ = stream.read(&mut buffer);
                write!(
                    stream,
                    "HTTP/1.1 {status} Source\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                )
                .unwrap();
            });
            let client = reqwest::blocking::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(3))
                .build()
                .unwrap();
            let result = super::super::transport::fetch_candidate_bytes(
                &client,
                &format!("http://{address}/source"),
                PAGE,
                1,
            );
            server.join().unwrap();
            if status == 403 {
                assert!(result.unwrap_err().contains("403"))
            } else {
                assert!(result.unwrap().is_none())
            }
        }
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "Explicit isolated native official-source fallback proof, no database setup or access"]
    fn native_daily_source_fallback_proof() {
        use sha2::{Digest, Sha256};
        use std::{fs, path::PathBuf, time::Duration};
        let profile = tempfile::Builder::new()
            .prefix("eod-bse-daily-proof-")
            .tempdir()
            .unwrap();
        let outputs = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../outputs");
        let evidence = tempfile::Builder::new()
            .prefix("bse-daily-browser-proof-")
            .tempdir_in(outputs)
            .unwrap()
            .keep();
        let mut context = tauri::generate_context!();
        context.config_mut().app.windows.clear();
        let app = tauri::Builder::default()
            .any_thread()
            .build(context)
            .unwrap();
        let handle = app.handle().clone();
        let saved = evidence.clone();
        let data = profile.path().to_path_buf();
        let worker = std::thread::spawn(move || {
            let result = (|| -> Result<Value, String> {
                let fallback = BrowserFallback::default();
                let mut captures = Vec::new();
                for exchange in ["BSE", "BSE_INDEX"] {
                    let task = task(exchange);
                    let stop = Arc::new(AtomicBool::new(false));
                    let staged = fallback
                        .recover_with(&handle, &task, stop.clone(), |scope| {
                            let bytes = super::super::bse_price_history::collect_proof(
                                handle.clone(),
                                scope.clone(),
                                data.clone(),
                                stop.clone(),
                            );
                            if let Ok(bytes) = &bytes {
                                fs::write(
                                    saved.join(format!("{exchange}-{}.source", captures.len())),
                                    bytes,
                                )
                                .map_err(|e| e.to_string())?;
                            }
                            browser_response(bytes)
                        })?
                        .ok_or("Expected the known available official source.")?;
                    let StagedDownloadContent::Csv(csv) = staged.content else {
                        return Err("Expected normal CSV staging.".into());
                    };
                    let parsed =
                        super::super::parse_bhavcopy_csv(&csv, exchange, &task.trade_date, &[])?;
                    if parsed.rows.is_empty() || parsed.debug.is_some() {
                        return Err(format!(
                            "No admitted official {exchange} source rows: {:?}",
                            parsed.debug
                        ));
                    }
                    fs::write(saved.join(format!("{exchange}.csv")), &csv)
                        .map_err(|e| e.to_string())?;
                    captures.push(serde_json::json!({"exchange":exchange,"date":task.trade_date,"rows":parsed.rows.len(),"sha256":format!("{:x}",Sha256::digest(csv.as_bytes()))}));
                }
                Ok(
                    serde_json::json!({"captures":captures,"databaseOpened":false,"databaseImport":false}),
                )
            })();
            handle.exit(0);
            result
        });
        app.run_return(|_, event| {
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
        let result = worker.join().unwrap();
        fs::write(
            evidence.join("proof.json"),
            serde_json::to_vec_pretty(
                &serde_json::json!({"result":result,"databaseOpened":false,"databaseImport":false}),
            )
            .unwrap(),
        )
        .unwrap();
        println!(
            "Daily source browser proof: {}\n{result:?}",
            evidence.display()
        );
        let profile_path = profile.path().canonicalize().unwrap();
        assert_eq!(
            profile_path.parent(),
            Some(std::env::temp_dir().canonicalize().unwrap().as_path())
        );
        assert!(profile_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("eod-bse-daily-proof-"));
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
            "Temporary browser profile cleanup incomplete"
        );
        result.unwrap();
    }
    fn task(exchange: &str) -> DownloadTask {
        DownloadTask {
            exchange: exchange.into(),
            trade_date: "2026-10-23".into(),
            mode: DownloadMode::Range,
            candidates: Vec::new(),
            nse_index_history: None,
        }
    }
    #[test]
    fn browser_payload_stays_bounded_and_wrong_date_is_held_by_the_normal_parser() {
        let task = task("BSE");
        let candidate = builtins(&task).unwrap().remove(0);
        let scope = RequestScope {
            url: candidate.url.clone(),
            kind: Payload::Csv,
        };
        assert!(scope.validate_download(&vec![b'x'; MAX_BYTES + 1]).is_err());
        assert!(scope.validate_download(b"<html>denied</html>").is_err());
        let wrong = b"SC_CODE,OPEN,HIGH,LOW,CLOSE,NO_OF_SHRS,DATE\n500325,1,2,1,2,10,2026-10-22\n";
        let csv = decode(&candidate, wrong, &task).unwrap().unwrap();
        let parsed = super::super::parse_bhavcopy_csv(&csv, "BSE", &task.trade_date, &[]).unwrap();
        assert!(parsed.rows.is_empty());
        assert!(parsed.debug.unwrap().contains("date mismatch"));
    }

    #[test]
    fn browser_is_last_resort_for_bse_source_errors_only() {
        let bse = task("BSE");
        assert!(should_recover(&bse, &Err("HTTP 403".into())));
        assert!(should_recover(
            &bse,
            &Err("invalid HTTP header parsed".into())
        ));
        assert!(!should_recover(&task("NSE"), &Err("HTTP 403".into())));
        let missing = super::super::calendar::skipped_download_result(
            "BSE",
            "2026-10-23",
            "Source unavailable".to_string(),
        );
        assert!(!should_recover(
            &bse,
            &Ok(StagedDownloadOutcome::Result(missing))
        ));
        let ready = StagedDownloadOutcome::Ready(StagedDownload {
            task: bse.clone(),
            content: StagedDownloadContent::Csv("valid primary".into()),
        });
        assert!(!should_recover(&bse, &Ok(ready)));
    }
    #[test]
    fn source_scope_rejects_html_duplicate_query_and_other_hosts() {
        let candidate =
            generate_bse_candidates(parse_trade_date("2026-10-23").unwrap(), None).remove(0);
        let scope = RequestScope {
            url: candidate.url.clone(),
            kind: Payload::Csv,
        };
        assert!(scope.matches(&candidate.url));
        assert!(!scope.matches(&(candidate.url + "?x=1&x=2")));
        assert!(!scope.permits_resource("https://example.com/anything"));
        assert!(scope.validate(200, b"<html>Access denied</html>").is_err());
        assert!(scope
            .validate(
                200,
                b"SC_CODE,OPEN,HIGH,LOW,CLOSE,NO_OF_SHRS\n500325,1,2,1,2,10\n"
            )
            .is_ok());
    }
    #[test]
    fn filename_indirection_is_bounded_to_official_csv_or_zip() {
        let candidate = generate_bse_candidates(parse_trade_date("2026-10-23").unwrap(), None)
            .into_iter()
            .find(|c| c.bse_response_key.is_some())
            .unwrap();
        let key = candidate.bse_response_key.unwrap();
        let mut calls = Vec::new();
        let result=fetch_candidate(&candidate,"2026-10-23",|scope| {
            calls.push(scope.url.clone());
            if calls.len()==1 {Ok(Some(serde_json::to_vec(&serde_json::json!({key:[{"filename":"BhavCopy_BSE_CM_0_0_0_20261023_F_0000.CSV"}]})).unwrap()))} else {Ok(Some(b"SC_CODE,CLOSE\n500325,1".to_vec()))}
        }).unwrap();
        assert!(result.is_some());
        assert_eq!(calls.len(), 2);
        assert!(calls[1].starts_with("https://www.bseindia.com/download/BhavCopy/Equity/"));
        assert!(filename_url(
            candidate.bse_download_base.unwrap(),
            key,
            "../../other.csv",
            "2026-10-23"
        )
        .is_err());
        assert!(filename_url(
            candidate.bse_download_base.unwrap(),
            key,
            "https://example.com/other.csv",
            "2026-10-23"
        )
        .is_err());
        assert!(filename_url(
            candidate.bse_download_base.unwrap(),
            key,
            "EQ221026_CSV.ZIP",
            "2026-10-23"
        )
        .is_err());
    }
}

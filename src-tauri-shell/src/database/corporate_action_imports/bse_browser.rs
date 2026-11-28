//! Bounded native BSE source collection. No database, approval, or IPC result bridge.

use super::{format_bse_api_date, parse_official_date, BSE_ACTIONS_API_URL, BSE_ACTIONS_PAGE_URL};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
const LABEL: &str = "bse-source-collector";
const MAX_BYTES: usize = 8 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(60);
// The legacy .html URL now redirects here. Start at the verified canonical
// page; do not broaden the collector's navigation policy to follow redirects.
const BSE_IDENTITY_PAGE_URL: &str = "https://www.bseindia.com/corporates/List_Scrips";

#[derive(Clone)]
pub(super) struct Scope {
    pub(super) from: String,
    pub(super) to: String,
    pub(super) url: String,
    identity_master: bool,
}

impl Scope {
    pub(super) fn new(from: &str, to: &str) -> Result<Self, String> {
        let from =
            chrono::NaiveDate::parse_from_str(from, "%Y-%m-%d").map_err(|e| e.to_string())?;
        let to = chrono::NaiveDate::parse_from_str(to, "%Y-%m-%d").map_err(|e| e.to_string())?;
        if to < from || (to - from).num_days() >= 7 {
            return Err("BSE collection requires one to seven calendar days per window.".into());
        }
        let from = from.to_string();
        let to = to.to_string();
        let url = format!(
            "{BSE_ACTIONS_API_URL}?scripcode=&Fdate={}&Purposecode=&TDate={}&ddlcategorys=E&ddlindustrys=&segment=0&strSearch=S",
            format_bse_api_date(&from)?, format_bse_api_date(&to)?
        );
        Ok(Self {
            from,
            to,
            url,
            identity_master: false,
        })
    }

    // A single fixed official endpoint, not a generic browser fetch capability.
    pub(super) fn identity_master() -> Self {
        Self {
            from: "identity".into(),
            to: "active".into(),
            url: format!(
                "{}Active",
                crate::database::official_source_urls::DEFAULT_BSE_LIST_SCRIPS_URL_PREFIX
            ),
            identity_master: true,
        }
    }

    pub(super) fn is_identity_master(&self) -> bool {
        self.identity_master
    }

    fn page_url(&self) -> &'static str {
        if self.identity_master {
            BSE_IDENTITY_PAGE_URL
        } else {
            BSE_ACTIONS_PAGE_URL
        }
    }

    fn matches(&self, raw: &str) -> bool {
        fn parts(raw: &str) -> Option<(String, BTreeMap<String, String>)> {
            let mut url = reqwest::Url::parse(raw).ok()?;
            if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
                return None;
            }
            let mut query = BTreeMap::new();
            for (key, value) in url.query_pairs() {
                if query.insert(key.to_string(), value.to_string()).is_some() {
                    return None;
                }
            }
            url.set_query(None);
            Some((url.to_string(), query))
        }
        matches!((parts(raw), parts(&self.url)), (Some(a), Some(b)) if a == b)
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
            && (raw == self.page_url()
                || url.path().starts_with("/assets/")
                || url.path() == "/env.js")
    }

    pub(super) fn validate(&self, status: i32, bytes: &[u8]) -> Result<usize, String> {
        if status != 200 {
            return Err(format!("BSE browser API returned HTTP {status}."));
        }
        if bytes.len() > MAX_BYTES {
            return Err("BSE browser response exceeded the byte limit.".into());
        }
        if self.identity_master {
            let count =
                crate::database::bse_identity_imports::validate_bse_master_bytes_for_health(
                    bytes,
                    "BSE official active identity master",
                )?;
            crate::database::bse_identity_imports::validate_bse_active_population_for_health(
                count,
            )?;
            return Ok(count);
        }
        let value: Value =
            serde_json::from_slice(bytes).map_err(|e| format!("BSE browser JSON: {e}"))?;
        let rows = value
            .as_array()
            .ok_or("BSE browser response is not an array.")?;
        // A complete HTTP 200 array for the exact requested URL can be empty
        // (weekends, holidays, early history). Refusal/HTML/partial JSON fail above.
        for row in rows {
            let date = row
                .get("Ex_date")
                .and_then(Value::as_str)
                .ok_or("BSE browser row has no ex-date.")?;
            let date = parse_official_date(date)?;
            if date < self.from || date > self.to {
                return Err(format!("BSE browser returned out-of-scope ex-date {date}."));
            }
            let code = row
                .get("scrip_code")
                .and_then(|v| match v {
                    Value::String(s) => Some(s.clone()),
                    Value::Number(n) => Some(n.to_string()),
                    _ => None,
                })
                .ok_or("BSE browser row has no official security code.")?;
            if code.len() != 6
                || !code.bytes().all(|b| b.is_ascii_digit())
                || row
                    .get("Purpose")
                    .and_then(Value::as_str)
                    .is_none_or(|s| s.trim().is_empty())
            {
                return Err("BSE browser row has an invalid security code or purpose.".into());
            }
        }
        Ok(rows.len())
    }
}

#[cfg(all(test, windows))]
pub(super) use native::close_profile;
#[cfg(windows)]
pub(super) use native::collect;

#[cfg(windows)]
mod native {
    use super::*;
    use tauri::{webview::NewWindowResponse, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
    use webview2_com::{
        CoTaskMemPWSTR, Microsoft::Web::WebView2::Win32::*, PermissionRequestedEventHandler,
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

    unsafe fn install(
        platform: tauri::webview::PlatformWebview,
        scope: Scope,
        completion: Arc<Completion>,
        tokens: Arc<Mutex<Tokens>>,
    ) -> windows::core::Result<()> {
        let core = platform.controller().CoreWebView2()?;
        let core2: ICoreWebView2_2 = core.cast()?;
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
                return Err("Official fetch cancelled. Completed windows are saved; use Fetch Official to resume.".into());
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

    pub(crate) fn collect(
        app: AppHandle,
        scope: Scope,
        profile: PathBuf,
        cancelled: Arc<AtomicBool>,
    ) -> Result<Vec<u8>, String> {
        if cancelled.load(Ordering::SeqCst) {
            return Err("Official fetch cancelled. Completed windows are saved; use Fetch Official to resume.".into());
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
        let setup_tokens = tokens.clone();
        let handle = app.clone();
        app.run_on_main_thread(move || {
        if setup_done.finished.load(Ordering::SeqCst) { let _ = ready.try_send(()); return }
        let navigation_done = setup_done.clone();
        let page_done = setup_done.clone();
        let triggered = AtomicBool::new(false);
        let page_url = scope.page_url();
        let script = format!("void fetch({}, {{credentials:'omit',cache:'no-store',redirect:'error'}}).catch(() => {{}});", serde_json::to_string(&scope.url).unwrap());
        let window = WebviewWindowBuilder::new(&handle, LABEL, WebviewUrl::External("about:blank".parse().unwrap()))
            .title("BSE official source collection")
            .visible(false).skip_taskbar(true).incognito(true).data_directory(profile)
            .devtools(false).disable_drag_drop_handler()
            .on_navigation(move |url| {
                let allowed = url.as_str() == "about:blank" || url.as_str() == page_url;
                if !allowed { navigation_done.finish(Err(format!("BSE browser unexpected navigation: {}", url.origin().ascii_serialization()))); }
                allowed
            })
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_download(|_, _| false)
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
                        let tokens = tokens.lock().unwrap();
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
        result
    }

    #[test]
    fn bse_browser_proof_rejects_unbounded_or_invalid_dates() {
        assert!(Scope::new("1990-01-01", "2026-10-24").is_err());
        assert!(Scope::new("2026-10-24", "2026-10-23").is_err());
        assert!(Scope::new("bad", "2026-10-23").is_err());
        assert!(Scope::new("2026-10-17", "2026-10-23").is_ok());
    }

    #[test]
    fn bse_identity_master_scope_is_fixed_and_rejects_refusal_or_small_populations() {
        let scope = Scope::identity_master();
        assert!(scope.matches(&scope.url));
        assert!(scope.permits_resource(scope.page_url()));
        assert!(!scope.permits_resource(BSE_ACTIONS_PAGE_URL));
        assert!(!scope.permits_resource(
            crate::database::official_source_urls::DEFAULT_BSE_LIST_SCRIPS_REFERER
        ));
        for bad in [
            scope.url.replace("status=Active", "status=Delisted"),
            scope.url.replace("segment=Equity", "segment=Debt"),
            format!("{}&status=Active", scope.url),
            scope.url.replace("https://", "http://"),
            scope.url.replace("api.bseindia.com", "example.com"),
        ] {
            assert!(!scope.permits_resource(&bad));
        }
        assert!(!scope.permits_resource(&Scope::new("2026-10-23", "2026-10-23").unwrap().url));
        assert!(scope.validate(403, b"Access denied").is_err());
        assert!(scope.validate(200, b"<html>Access denied</html>").is_err());
        assert!(scope.validate(200, b"[]").is_err());
        assert!(scope.validate(200,b"Security Code,Security Id,Security Name,Group,ISIN\n544131,GPTHEALTH,GPT Healthcare Ltd,A,INE486R01017\n").is_err());
        let mut valid = String::from("Security Code,Security Id,Security Name,Group,ISIN\n");
        for n in 0..1000 {
            valid.push_str(&format!("{},TEST{n},Test {n},A,INE000A01001\n", 500000 + n));
        }
        assert_eq!(scope.validate(200, valid.as_bytes()).unwrap(), 1000);
    }

    #[test]
    fn bse_browser_proof_requires_exact_official_request() {
        let scope = Scope::new("2026-10-23", "2026-10-23").unwrap();
        assert!(scope.matches(&scope.url));
        for bad in [
            scope.url.replace("https://", "http://"),
            scope
                .url
                .replace("api.bseindia.com", "api.bseindia.com.example.com"),
            scope.url.replace("Fdate=20261023", "Fdate=20261022"),
            format!("{}&Fdate=20261023", scope.url),
            format!("{}#fragment", scope.url),
        ] {
            assert!(!scope.matches(&bad), "{bad}");
        }
        assert!(scope.permits_resource(BSE_ACTIONS_PAGE_URL));
        assert!(scope.permits_resource("https://www.bseindia.com/assets/site.js"));
        for bad in [
            "https://example.com/",
            "http://www.bseindia.com/assets/site.js",
            "https://www.bseindia.com:444/assets/site.js",
            "https://user@www.bseindia.com/assets/site.js",
            "https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w",
        ] {
            assert!(!scope.permits_resource(bad), "{bad}");
        }
    }

    #[test]
    fn bse_browser_proof_rejects_refusal_empty_html_and_wrong_dates() {
        let scope = Scope::new("2026-10-23", "2026-10-23").unwrap();
        let good = br#"[{"scrip_code":"500052","Ex_date":"23 Oct 2026","Purpose":"Interim Dividend - Rs. - 1.0000"}]"#;
        assert_eq!(scope.validate(200, good).unwrap(), 1);
        assert!(scope.validate(403, good).is_err());
        assert_eq!(scope.validate(200, b"[]").unwrap(), 0);
        assert!(scope.validate(200, b"<html>Access denied</html>").is_err());
        assert!(scope.validate(200, &vec![b' '; MAX_BYTES + 1]).is_err());
        assert!(scope
            .validate(
                200,
                String::from_utf8(good.to_vec())
                    .unwrap()
                    .replace("23 Oct", "22 Oct")
                    .as_bytes()
            )
            .is_err());
        assert!(scope
            .validate(200, br#"[{"Purpose":"Dividend","Ex_date":"23 Oct 2026"}]"#)
            .is_err());
    }

    #[test]
    fn bse_browser_proof_cancellation_and_single_completion() {
        let (sender, receiver) = mpsc::sync_channel(1);
        let done = Completion {
            finished: AtomicBool::new(false),
            sender,
        };
        done.finish(Ok(b"first".to_vec()));
        done.finish(Err("late callback".into()));
        assert_eq!(receiver.try_recv().unwrap().unwrap(), b"first");
        assert!(receiver.try_recv().is_err());
        let (_, receiver) = mpsc::sync_channel(1);
        assert!(
            wait_result(receiver, &AtomicBool::new(true), Instant::now() + TIMEOUT)
                .unwrap_err()
                .contains("cancelled")
        );
    }

    #[test]
    #[ignore = "Explicit native WebView2 proof: official BSE network only, no database access"]
    fn bse_browser_proof_live() {
        use sha2::{Digest, Sha256};
        let scope = Scope::new("2026-10-23", "2026-10-23").unwrap();
        let profile = tempfile::Builder::new()
            .prefix("eod-bse-proof-profile-")
            .tempdir()
            .unwrap();
        let mut context = tauri::generate_context!();
        context.config_mut().app.windows.clear();
        // No setup, plugins, app commands, database initialization or main window.
        let app = tauri::Builder::default()
            .any_thread()
            .build(context)
            .unwrap();
        let handle = app.handle().clone();
        let data_path = profile.path().to_path_buf();
        let requested = scope.clone();
        let worker = std::thread::spawn(move || {
            let result = collect(
                handle.clone(),
                requested,
                data_path,
                Arc::new(AtomicBool::new(false)),
            );
            handle.exit(0);
            result
        });
        app.run_return(|_, _| {});
        let result = worker.join().unwrap();
        let outputs = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../outputs");
        let evidence = tempfile::Builder::new()
            .prefix("bse-webview-proof-")
            .tempdir_in(outputs)
            .unwrap()
            .keep();
        let profile_cleanup = close_profile(profile);
        let mut manifest = serde_json::json!({
            "requestedUrl": scope.url, "fromDate": scope.from, "toDate": scope.to,
            "productionEnabled": false, "databaseOpened": false,
            "profileCleanup": profile_cleanup,
            "result": result.as_ref().map(|b| b.len()).map_err(Clone::clone),
        });
        if let Ok(bytes) = &result {
            std::fs::write(evidence.join("response.json"), bytes).unwrap();
            manifest["sha256"] = Value::String(format!("{:x}", Sha256::digest(bytes)));
            manifest["rowCount"] = scope.validate(200, bytes).unwrap().into();
        }
        std::fs::write(
            evidence.join("manifest.json"),
            serde_json::to_vec_pretty(&manifest).unwrap(),
        )
        .unwrap();
        println!("BSE native proof evidence: {}", evidence.display());
        println!("BSE native proof result: {manifest}");
        result.unwrap();
        assert!(
            profile_cleanup.is_ok(),
            "Temporary browser profile cleanup incomplete"
        );
    }

    #[cfg(test)]
    pub(crate) fn close_profile(profile: tempfile::TempDir) -> Result<(), String> {
        // The WebView2 process can release its files shortly after controller/window
        // destruction. Retry cleanup only for this freshly created, verified TempDir.
        let path = profile.path().canonicalize().map_err(|e| e.to_string())?;
        let temp = std::env::temp_dir()
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if path.parent() != Some(temp.as_path())
            || !path
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with("eod-bse-proof-profile-"))
        {
            return Err("Refusing cleanup outside the dedicated proof profile directory.".into());
        }
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut result = profile.close();
        loop {
            match result {
                Ok(()) => return Ok(()),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
                Err(error) => {
                    // TempDir::close wraps the OS error with path context, so
                    // raw_os_error() can be None even for a sharing violation.
                    if Instant::now() >= deadline {
                        return Err(format!(
                            "Proof profile cleanup incomplete at {}: {error}",
                            path.display()
                        ));
                    }
                    std::thread::sleep(Duration::from_millis(100));
                    result = std::fs::remove_dir_all(&path);
                }
            }
        }
    }

    #[test]
    fn bse_browser_proof_closes_only_its_temporary_profile() {
        let profile = tempfile::Builder::new()
            .prefix("eod-bse-proof-profile-")
            .tempdir()
            .unwrap();
        let path = profile.path().to_path_buf();
        close_profile(profile).unwrap();
        assert!(!path.exists());
    }
}

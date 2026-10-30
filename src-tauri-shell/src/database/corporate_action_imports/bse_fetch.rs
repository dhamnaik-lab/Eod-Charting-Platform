//! Production BSE fetch routing, bounded windows, cancellation and retained source bytes.
use super::{
    bse_action_fetch_client, bse_browser::Scope, emit_corporate_action_progress,
    fetch_bse_action_bytes_with_cancel, fetch_bse_action_text_with_cancel, AppResult,
    FetchCoverageRange, BSE_ACTIONS_PAGE_URL,
};
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Manager};

static ACTIVE_FETCH: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

pub(super) struct FetchGuard(pub(super) Arc<AtomicBool>);

impl FetchGuard {
    pub(super) fn start() -> AppResult<Self> {
        let mut active = ACTIVE_FETCH.lock().map_err(|e| e.to_string())?;
        if active.is_some() {
            return Err(
                "An official fetch is already running. Cancel it or wait for it to finish.".into(),
            );
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        *active = Some(cancelled.clone());
        Ok(Self(cancelled))
    }
}

impl Drop for FetchGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = ACTIVE_FETCH.lock() {
            if active
                .as_ref()
                .is_some_and(|flag| Arc::ptr_eq(flag, &self.0))
            {
                *active = None;
            }
        }
    }
}

pub(super) fn cancel() -> bool {
    if let Ok(active) = ACTIVE_FETCH.lock() {
        if let Some(flag) = active.as_ref() {
            flag.store(true, Ordering::SeqCst);
            return true;
        }
    }
    false
}

pub(super) fn check_cancel(flag: &AtomicBool) -> AppResult<()> {
    if flag.load(Ordering::SeqCst) {
        Err("Official fetch cancelled. Completed windows and imported rows are saved. Use Fetch Official (without Force Re-fetch) to resume.".into())
    } else {
        Ok(())
    }
}

pub(super) fn bounded_ranges(
    ranges: Vec<FetchCoverageRange>,
) -> AppResult<Vec<FetchCoverageRange>> {
    let mut bounded = Vec::new();
    for range in ranges {
        let mut from = chrono::NaiveDate::parse_from_str(&range.from_date, "%Y-%m-%d")
            .map_err(|e| e.to_string())?;
        let to = chrono::NaiveDate::parse_from_str(&range.to_date, "%Y-%m-%d")
            .map_err(|e| e.to_string())?;
        if from > to {
            return Err("From date cannot be after to date.".into());
        }
        loop {
            let end = from
                .checked_add_signed(chrono::Duration::days(6))
                .unwrap_or(to)
                .min(to);
            bounded.push(FetchCoverageRange {
                from_date: from.to_string(),
                to_date: end.to_string(),
            });
            if bounded.len() > 20000 {
                return Err("BSE fetch exceeds the bounded window limit.".into());
            }
            if end == to {
                break;
            }
            from = end.succ_opt().ok_or("BSE date window overflow.")?;
        }
    }
    Ok(bounded)
}

pub(super) fn commit_window(
    connection: &rusqlite::Connection,
    range: &FetchCoverageRange,
    row_errors: u32,
    cancelled: &AtomicBool,
    errors: &mut Vec<String>,
) -> AppResult<u32> {
    check_cancel(cancelled)?;
    if !super::record_fetch_coverage_if_complete(
        connection,
        "BSE",
        "BSE_API",
        &range.from_date,
        &range.to_date,
        row_errors,
        errors,
    )? {
        return Err(format!("BSE {} to {} had {} row error(s); coverage was not marked complete. Completed earlier windows remain saved. Retry Fetch Official to resume.", range.from_date, range.to_date, row_errors));
    }
    super::inclusive_day_count(&range.from_date, &range.to_date)
}

pub(super) struct BseSession {
    client: Client,
    warmed: bool,
    browser_only: bool,
    cancelled: Arc<AtomicBool>,
    #[cfg(test)]
    directories: Option<(std::path::PathBuf, std::path::PathBuf)>,
}

impl BseSession {
    pub(super) fn new(cancelled: Arc<AtomicBool>) -> AppResult<Self> {
        Ok(Self {
            client: bse_action_fetch_client()?,
            warmed: false,
            browser_only: false,
            cancelled,
            #[cfg(test)]
            directories: None,
        })
    }

    pub(super) fn fetch(&mut self, app: &AppHandle, scope: &Scope) -> AppResult<Vec<u8>> {
        check_cancel(&self.cancelled)?;
        #[cfg(test)]
        let directories = self.directories.clone();
        let client = &self.client;
        let warmed = &mut self.warmed;
        let cancelled = &self.cancelled;
        let (bytes, transport) = route(
            &mut self.browser_only,
            || {
                if !*warmed {
                    fetch_bse_action_text_with_cancel(
                        client,
                        BSE_ACTIONS_PAGE_URL,
                        false,
                        Some(cancelled),
                    )?;
                    *warmed = true;
                }
                let bytes =
                    fetch_bse_action_bytes_with_cancel(client, &scope.url, true, Some(cancelled))?;
                scope.validate(200, &bytes)?;
                Ok(bytes)
            },
            || {
                check_cancel(cancelled)?;
                emit_corporate_action_progress(app, 10, format!(
                    "BSE direct access unavailable. Collecting official rows through the app browser for {} to {}...",
                    scope.from, scope.to
                ));
                #[cfg(windows)]
                {
                    // A dedicated incognito cache profile, never the main renderer or
                    // the user's browser profile. Wry owns its environment until app exit.
                    let profile = app
                        .path()
                        .app_cache_dir()
                        .map_err(|e| e.to_string())?
                        .join("bse-official-source");
                    #[cfg(test)]
                    let profile = directories
                        .as_ref()
                        .map(|paths| paths.0.clone())
                        .unwrap_or(profile);
                    fs::create_dir_all(&profile).map_err(|e| e.to_string())?;
                    super::bse_browser::collect(
                        app.clone(),
                        scope.clone(),
                        profile,
                        cancelled.clone(),
                    )
                }
                #[cfg(not(windows))]
                {
                    Err("Automatic BSE browser collection is supported on Windows only.".into())
                }
            },
        )?;
        check_cancel(&self.cancelled)?;
        scope.validate(200, &bytes)?;
        let capture_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("official-source-captures/bse");
        #[cfg(test)]
        let capture_dir = directories
            .as_ref()
            .map(|paths| paths.1.clone())
            .unwrap_or(capture_dir);
        retain_capture(&capture_dir, scope, &bytes, transport)?;
        Ok(bytes)
    }
}

fn route(
    browser_only: &mut bool,
    direct: impl FnOnce() -> AppResult<Vec<u8>>,
    browser: impl FnOnce() -> AppResult<Vec<u8>>,
) -> AppResult<(Vec<u8>, &'static str)> {
    if *browser_only {
        return browser().map(|body| (body, "webview2"));
    }
    match direct() {
        Ok(body) => Ok((body, "http")),
        Err(direct_error) => {
            *browser_only = true;
            browser().map(|body| (body, "webview2")).map_err(|error| format!(
                "BSE automatic collection failed. Direct request: {direct_error}. App browser: {error}. Completed windows remain saved; retry Fetch Official to resume."
            ))
        }
    }
}

fn retain_capture(folder: &Path, scope: &Scope, bytes: &[u8], transport: &str) -> AppResult<()> {
    scope.validate(200, bytes)?;
    fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    let hash = format!("{:x}", Sha256::digest(bytes));
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let stem = format!("{}_{}_{}_{}", scope.from, scope.to, stamp, &hash[..16]);
    let extension = if scope.is_identity_master() { "csv" } else { "json" };
    let body_path = folder.join(format!("{stem}.{extension}"));
    let manifest_path = folder.join(format!("{stem}.manifest.json"));
    let manifest = serde_json::json!({
        "source": if scope.is_identity_master() { "BSE_IDENTITY_MASTER" } else { "BSE_API" }, "transport": transport, "url": scope.url,
        "fromDate": scope.from, "toDate": scope.to, "httpStatus": 200,
        "sha256": hash, "bytes": bytes.len(), "rows": scope.validate(200, bytes)?,
        "capturedAt": chrono::Utc::now().to_rfc3339(),
    });
    for (path, payload) in [
        (body_path, bytes.to_vec()),
        (
            manifest_path,
            serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
        ),
    ] {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| format!("Cannot retain BSE source capture: {e}"))?;
        file.write_all(&payload)
            .and_then(|_| file.sync_data())
            .map_err(|e| format!("Cannot retain BSE source capture: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bse_fetch_windows_preserve_leap_days_and_gaps() {
        let windows = bounded_ranges(vec![
            FetchCoverageRange {
                from_date: "2024-02-26".into(),
                to_date: "2024-03-05".into(),
            },
            FetchCoverageRange {
                from_date: "2024-03-09".into(),
                to_date: "2024-03-09".into(),
            },
        ])
        .unwrap();
        assert_eq!(
            windows
                .iter()
                .map(|w| (w.from_date.as_str(), w.to_date.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("2024-02-26", "2024-03-03"),
                ("2024-03-04", "2024-03-05"),
                ("2024-03-09", "2024-03-09")
            ]
        );
    }
    #[test]
    fn bse_fetch_routes_to_browser_once_and_keeps_refusals_as_errors() {
        let mut browser_only = false;
        assert_eq!(
            route(
                &mut browser_only,
                || Err("403".into()),
                || Ok(b"[]".to_vec())
            )
            .unwrap()
            .1,
            "webview2"
        );
        assert!(browser_only);
        assert!(route(
            &mut browser_only,
            || panic!("must not retry direct access"),
            || Err("403".into())
        )
        .is_err());
        let mut direct_mode = false;
        assert_eq!(
            route(
                &mut direct_mode,
                || Ok(b"[]".to_vec()),
                || panic!("unnecessary browser")
            )
            .unwrap()
            .1,
            "http"
        );
    }
    #[test]
    fn bse_fetch_guard_serializes_fetch_and_cancels_without_affecting_next_run() {
        let guard = FetchGuard::start().unwrap();
        assert!(FetchGuard::start().is_err());
        assert!(cancel());
        assert!(check_cancel(&guard.0).is_err());
        drop(guard);
        let next = FetchGuard::start().unwrap();
        assert!(check_cancel(&next.0).is_ok());
    }
    #[test]
    fn bse_fetch_retains_valid_empty_capture_but_rejects_truncated_json() {
        let folder = tempfile::tempdir().unwrap();
        let scope = Scope::new("2026-10-24", "2026-10-24").unwrap();
        retain_capture(folder.path(), &scope, b"[]", "webview2").unwrap();
        assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 2);
        assert!(retain_capture(folder.path(), &scope, b"[{", "webview2").is_err());
        assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 2);
    }

    #[test]
    fn bse_fetch_coverage_resumes_after_row_failure_or_cancellation() {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::prepare_database_connection(&connection).unwrap();
        let ranges = bounded_ranges(vec![FetchCoverageRange {
            from_date: "2026-10-01".into(),
            to_date: "2026-10-16".into(),
        }])
        .unwrap();
        let cancelled = AtomicBool::new(false);
        let mut errors = Vec::new();
        assert_eq!(
            commit_window(&connection, &ranges[0], 0, &cancelled, &mut errors).unwrap(),
            7
        );
        assert!(commit_window(&connection, &ranges[1], 1, &cancelled, &mut errors).is_err());
        cancelled.store(true, Ordering::SeqCst);
        assert!(commit_window(&connection, &ranges[2], 0, &cancelled, &mut errors).is_err());
        let missing = super::super::load_missing_fetch_ranges(
            &connection,
            "BSE",
            "BSE_API",
            "2026-10-01",
            "2026-10-16",
        )
        .unwrap();
        assert_eq!(missing.len(), 1);
        assert_eq!(missing[0].from_date, "2026-10-08");
        assert_eq!(missing[0].to_date, "2026-10-16");
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "Explicit live production BSE route with isolated in-memory storage and retained captures"]
    fn bse_fetch_production_live() {
        let outputs = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../outputs");
        let evidence = tempfile::Builder::new()
            .prefix("bse-production-fetch-")
            .tempdir_in(outputs)
            .unwrap()
            .keep();
        let captures = evidence.join("captures");
        let profile = tempfile::Builder::new()
            .prefix("eod-bse-proof-profile-")
            .tempdir()
            .unwrap();
        let profile_path = profile.path().to_path_buf();
        let mut context = tauri::generate_context!();
        context.config_mut().app.windows.clear();
        let app = tauri::Builder::default()
            .any_thread()
            .build(context)
            .unwrap();
        let handle = app.handle().clone();
        let worker = std::thread::spawn(move || {
            let result = (|| -> AppResult<serde_json::Value> {
                let connection =
                    rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
                crate::database::prepare_database_connection(&connection)?;
                // Match the normal user workflow: missing instrument codes are
                // collected by Fetch itself, before its CA date windows.
                connection.execute("INSERT INTO instruments(symbol,exchange,isin,name)
                    VALUES('GPTHEALTH','BSE','INE486R01017','GPT Healthcare Ltd')",[]).map_err(|e|e.to_string())?;
                let run = |from: &str, to: &str| -> AppResult<super::super::CorporateActionOfficialFetchResult> {
                    let guard = FetchGuard::start()?;
                    let mut session = BseSession::new(guard.0.clone())?;
                    session.directories = Some((profile_path.clone(), captures.clone()));
                    super::super::fetch_official_corporate_actions_with_session(&handle, &connection,
                        &super::super::CorporateActionOfficialFetchInput { exchange: "BSE".into(), from_date: from.into(), to_date: to.into(), force_refresh: Some(false) },
                        guard.0.clone(), Some(session))
                };
                let recent = run("2026-10-15", "2026-10-24")?;
                let mapped_code: Option<String> = connection.query_row("SELECT bse_security_code FROM instruments WHERE exchange='BSE' AND symbol='GPTHEALTH'",[],|r|r.get(0)).map_err(|e|e.to_string())?;
                if mapped_code.as_deref() != Some("544131") {
                    return Err(format!("Official identity mapping failed: {mapped_code:?}; {:?}",recent.errors));
                }
                let identity_mappings = 1;
                if recent.fetched_ranges != 2 || recent.fetched_days != 10 || recent.rows_read == 0
                {
                    return Err("Recent-window coverage/rows did not match the request.".into());
                }
                let capture_count = fs::read_dir(&captures).map_err(|e| e.to_string())?.count();
                let cached = run("2026-10-15", "2026-10-24")?;
                if cached.fetched_days != 0
                    || cached.cached_days != 10
                    || fs::read_dir(&captures).map_err(|e| e.to_string())?.count() != capture_count
                {
                    return Err("Cached retry downloaded data again.".into());
                }
                let historical = run("2016-03-01", "2016-03-07")?;
                let early = run("1990-01-01", "1990-01-07")?;
                let weekend = run("2026-10-25", "2026-10-25")?;
                if weekend.rows_read != 0 || weekend.fetched_days != 1 {
                    return Err("Empty-period coverage was not handled correctly.".into());
                }
                let guard = FetchGuard::start()?;
                let mut session = BseSession::new(guard.0.clone())?;
                session.directories = Some((profile_path, captures));
                session.browser_only = true;
                let stop = std::thread::spawn(|| {
                    std::thread::sleep(std::time::Duration::from_millis(30));
                    cancel()
                });
                let interrupted = super::super::fetch_official_corporate_actions_with_session(
                    &handle,
                    &connection,
                    &super::super::CorporateActionOfficialFetchInput {
                        exchange: "BSE".into(),
                        from_date: "2026-10-08".into(),
                        to_date: "2026-10-08".into(),
                        force_refresh: Some(false),
                    },
                    guard.0.clone(),
                    Some(session),
                );
                let stop_sent = stop.join().map_err(|_| "Cancellation worker failed.")?;
                if !stop_sent
                    || !interrupted
                        .as_ref()
                        .is_err_and(|error| error.to_lowercase().contains("cancelled"))
                {
                    return Err(format!("Native cancellation check failed: request_sent={stop_sent}, result={interrupted:?}, window_remaining={}", handle.get_webview_window("bse-source-collector").is_some()));
                }
                let covered: i64 = connection.query_row("SELECT COUNT(*) FROM corporate_action_fetch_coverage WHERE from_date = '2026-10-08'", [], |row| row.get(0)).map_err(|e| e.to_string())?;
                let canonical: i64 = connection
                    .query_row("SELECT COUNT(*) FROM corporate_actions", [], |row| {
                        row.get(0)
                    })
                    .map_err(|e| e.to_string())?;
                let approved: i64 = connection.query_row("SELECT COUNT(*) FROM corporate_action_imports WHERE approved_at IS NOT NULL", [], |row| row.get(0)).map_err(|e| e.to_string())?;
                if covered != 0
                    || canonical != 0
                    || approved != 0
                    || handle.get_webview_window("bse-source-collector").is_some()
                {
                    return Err(
                        "Cancellation, approval isolation or browser cleanup failed.".into(),
                    );
                }
                Ok(
                    serde_json::json!({ "recentRows": recent.rows_read, "recentWindows": recent.fetched_ranges, "cachedDays": cached.cached_days,
                    "historicalRows": historical.rows_read, "earlyRows": early.rows_read, "weekendRows": weekend.rows_read,
                    "cancelledWindowCovered": covered, "approvedRows": approved, "canonicalActions": canonical, "database": "isolated in-memory", "browserClosed": true,
                    "identityMappings": identity_mappings, "identityCode": mapped_code }),
                )
            })();
            handle.exit(0);
            result
        });
        app.run_return(|_, event| {
            // This test has no main window. Keep its event loop alive between
            // collector windows until the worker explicitly calls exit(0).
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
        let result = worker.join().unwrap();
        let cleanup = super::super::bse_browser::close_profile(profile);
        let manifest = serde_json::json!({ "result": result, "profileCleanup": cleanup });
        fs::write(
            evidence.join("manifest.json"),
            serde_json::to_vec_pretty(&manifest).unwrap(),
        )
        .unwrap();
        println!(
            "BSE production-route evidence: {}\n{manifest}",
            evidence.display()
        );
        result.unwrap();
        cleanup.unwrap();
    }
}

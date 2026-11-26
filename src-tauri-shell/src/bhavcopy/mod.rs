#[cfg(test)]
pub use crate::bhavcopy_recovery::{
    RecoveryBinaryBaseline, RecoveryBinaryBaselineKind, RecoverySessionState,
    MAX_BUFFERED_CHECKPOINT_WORKERS,
};
pub use crate::database::binary_eod::*;
#[cfg(test)]
pub use crate::database::eod_binary_state::*;
use crate::database::{
    configure_database_connection, emit_database_changed, get_active_database_file_path,
    get_app_snapshot_internal, invalidate_cached_db_stats, try_acquire_price_store_operation,
    PriceStorageMode, PriceStoreOperationKind, SnapshotOptions,
};
use crate::runtime::log_runtime_event;
use batch_runtime::{BatchCancellation, BatchStop};
#[cfg(test)]
use chrono::NaiveDate;
pub use chrono::{Datelike, Local};
use reqwest::blocking::Client;
pub use rusqlite::params;
use rusqlite::Connection;
use std::collections::{HashSet, VecDeque};
#[cfg(test)]
use std::fs;
use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Instant;
use tauri::{ipc::Channel, AppHandle};

pub mod types;
pub use types::AppResult;
pub use types::*;
pub mod transport;
pub use transport::*;
pub mod calendar;
pub use calendar::*;
pub mod holiday_sync;
pub use holiday_sync::*;
pub mod sources;
pub use sources::*;
pub mod parsers;
pub use parsers::*;
pub mod ingestion;
pub(crate) mod security_admission;
pub use ingestion::*;
pub mod settings;
pub use settings::*;
pub mod bse_price_history;
pub use bse_price_history::{cancel_bse_price_history_download, download_bse_price_history};
mod activity_report;
mod batch_runtime;
mod bse_browser_fallback;
mod coverage;
mod index_fallback;

#[tauri::command]
pub async fn download_bhavcopy(app: AppHandle, date: Option<String>) -> AppResult<DownloadResult> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before downloading bhavcopy data.".to_string())?;
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started_at = Instant::now();
        let _price_store_operation_permit =
            try_acquire_price_store_operation(PriceStoreOperationKind::BhavcopyWrite)?;
        recover_pending_bhavcopy_sessions(&app_handle, &database_file_path)?;
        let trade_date =
            date.unwrap_or_else(|| Local::now().date_naive().format("%Y-%m-%d").to_string());
        let parsed_date = parse_trade_date(&trade_date)?;
        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-start",
            Some(&format!(
                "kind=single exchange=NSE date={trade_date}"
            )),
        );
        let holiday_connection = Connection::open(&database_file_path).map_err(|e| e.to_string())?;
        configure_database_connection(&holiday_connection)?;
        if let Some(result) = create_calendar_skip_result(&holiday_connection, "NSE", &trade_date, parsed_date.weekday())
        {
            log_runtime_event(
                &app_handle,
                "INFO",
                "bhavcopy-write-complete",
                Some(&format!(
                    "kind=single exchange=NSE date={} rowsInserted={} status=calendar-skip elapsedMs={}",
                    result.trade_date,
                    result.rows_inserted,
                    started_at.elapsed().as_millis()
                )),
            );
            emit_download_result(&app_handle, &result);
            return Ok(result);
        }

        let client = create_http_client()?;
        warm_session(&client, NSE_BASE_URL);

        let settings =
            get_bhavcopy_settings(app_handle.clone()).unwrap_or_else(|_| default_settings());

        let task = DownloadTask {
            exchange: "NSE".to_string(),
            trade_date: trade_date.clone(),
            mode: DownloadMode::Update,
            candidates: generate_nse_candidates(
                parsed_date,
                settings.nse_equity_url_override.as_ref(),
            ),
            nse_index_history: None,
        };
        let write_lock = Mutex::new(());
        let mut result = process_download_task(
            &client,
            &database_file_path,
            &task,
            &[],
            &write_lock,
        )?;

        if result.rows_inserted > 0 {
            if let Err(error) = refresh_after_import(&app_handle, &database_file_path) {
                append_follow_up_warning(&mut result, format!("Prices retained; chart refresh failed: {error}"));
            }
        }
        if let Some(warning) = &result.follow_up_warning {
            log_runtime_event(&app_handle, "WARN", "bhavcopy-follow-up-warning", Some(warning));
        }

        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-complete",
            Some(&format!(
                "kind=single exchange={} date={} rowsInserted={} success={} elapsedMs={}",
                result.exchange,
                result.trade_date,
                result.rows_inserted,
                result.success,
                started_at.elapsed().as_millis()
            )),
        );
        emit_download_result(&app_handle, &result);
        Ok(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

static TRACKED_BATCH: std::sync::LazyLock<BatchCancellation> =
    std::sync::LazyLock::new(BatchCancellation::default);

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BatchStopReply {
    Accepted,
    AlreadyRequested,
    NoMatchingRun,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedBhavcopyBatchResult {
    cancelled: bool,
    results: Vec<DownloadResult>,
    activity: activity_report::ActivityReport,
    no_new_quotation_writes: bool,
}

// Preserve the original returned outcomes for coverage, legacy callers and diagnostics.
// Prefiltered dates are carried separately for display only.
struct BatchRunReport {
    results: Vec<DownloadResult>,
    prefiltered: Vec<DownloadResult>,
    clock: activity_report::ActivityClock,
    no_new_quotation_writes: bool,
}

#[tauri::command]
pub fn cancel_bhavcopy_batch(run_id: String) -> BatchStopReply {
    TRACKED_BATCH.request(&run_id)
}

#[tauri::command]
pub async fn run_tracked_bhavcopy_batch(
    app: AppHandle,
    config: BatchDownloadConfig,
    run_id: String,
    started: Channel<()>,
) -> AppResult<TrackedBhavcopyBatchResult> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before downloading bhavcopy data.".to_string())?;
    let run = TRACKED_BATCH.start(run_id)?;
    started.send(()).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let results =
            run_bhavcopy_batch(app.clone(), database_file_path.clone(), config, &run.stop);
        let cancelled = run.finish();
        finish_batch_progress(&app, &database_file_path, results, cancelled)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn download_bhavcopy_batch(
    app: AppHandle,
    config: BatchDownloadConfig,
) -> AppResult<Vec<DownloadResult>> {
    let database_file_path = get_active_database_file_path(&app)?
        .ok_or_else(|| "Open a database before downloading bhavcopy data.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let results = run_bhavcopy_batch(
            app.clone(),
            database_file_path.clone(),
            config,
            &BatchStop::default(),
        );
        Ok(finish_batch_progress(&app, &database_file_path, results, false)?.results)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn run_bhavcopy_batch(
    app_handle: AppHandle,
    database_file_path: crate::database::database_use::DatabasePath,
    config: BatchDownloadConfig,
    stop: &BatchStop,
) -> AppResult<BatchRunReport> {
    let started_at = Instant::now();
    let clock = activity_report::ActivityClock::now();
    if stop.is_requested() {
        return Ok(BatchRunReport {
            results: Vec::new(),
            prefiltered: Vec::new(),
            clock,
            no_new_quotation_writes: false,
        });
    }
    let normalized_config = normalize_batch_config(config)?;
    let _price_store_operation_permit =
        try_acquire_price_store_operation(PriceStoreOperationKind::BhavcopyWrite)?;
    if stop.is_requested() {
        return Ok(BatchRunReport {
            results: Vec::new(),
            prefiltered: Vec::new(),
            clock,
            no_new_quotation_writes: false,
        });
    }
    recover_pending_bhavcopy_sessions(&app_handle, &database_file_path)?;
    if stop.is_requested() {
        return Ok(BatchRunReport {
            results: Vec::new(),
            prefiltered: Vec::new(),
            clock,
            no_new_quotation_writes: false,
        });
    }
    let connection = open_database_connection(&database_file_path)?;
    let BatchPlan {
        info_messages,
        calendar_skip_results,
        prefiltered_results,
        tasks,
    } = build_batch_plan(&connection, &normalized_config)?;
    log_runtime_event(
        &app_handle,
        "INFO",
        "bhavcopy-write-start",
        Some(&format!(
            "kind=batch mode={:?} fromDate={} toDate={} jobs={} calendarSkips={} workers={}",
            normalized_config.mode,
            normalized_config.start_date,
            normalized_config.end_date,
            tasks.len(),
            calendar_skip_results.len(),
            normalized_config.workers
        )),
    );

    let active_trading_days = tasks
        .iter()
        .map(|task| task.trade_date.as_str())
        .collect::<HashSet<_>>()
        .len();
    let source_categories = summarize_source_categories(&tasks);
    for message in info_messages {
        emit_progress(&app_handle, 0, message);
    }
    emit_progress(
        &app_handle,
        0,
        if calendar_skip_results.is_empty() {
            format!("Found {active_trading_days} eligible download dates")
        } else {
            format!(
                "Found {active_trading_days} eligible download dates ({} calendar-skipped exchange/date pairs)",
                calendar_skip_results.len()
            )
        },
    );
    if !source_categories.is_empty() {
        emit_progress(
            &app_handle,
            0,
            format!("Source categories: {source_categories}"),
        );
    }
    emit_progress(&app_handle, 0, format!("Download jobs: {}", tasks.len()));
    for result in &calendar_skip_results {
        emit_download_result(&app_handle, result);
    }

    if stop.is_requested() {
        return Ok(BatchRunReport {
            results: calendar_skip_results,
            prefiltered: prefiltered_results,
            clock,
            no_new_quotation_writes: false,
        });
    }
    if tasks.is_empty() {
        let imported_rows = calendar_skip_results
            .iter()
            .map(|result| result.rows_inserted)
            .sum::<usize>();
        log_runtime_event(
            &app_handle,
            "INFO",
            "bhavcopy-write-complete",
            Some(&format!(
                "kind=batch mode={:?} fromDate={} toDate={} jobs=0 calendarSkips={} rowsInserted={} elapsedMs={}",
                normalized_config.mode,
                normalized_config.start_date,
                normalized_config.end_date,
                calendar_skip_results.len(),
                imported_rows,
                started_at.elapsed().as_millis()
            )),
        );
        return Ok(BatchRunReport {
            results: calendar_skip_results,
            prefiltered: prefiltered_results,
            clock,
            no_new_quotation_writes: true,
        });
    }

    let client = create_http_client()?;
    stop.run_if_active(|| warm_session(&client, NSE_BASE_URL));
    if tasks.iter().any(|task| task.nse_index_history.is_some()) {
        stop.run_if_active(|| warm_session(&client, NSE_INDEX_HISTORY_PAGE_URL));
    }
    stop.run_if_active(|| warm_session(&client, BSE_BASE_URL));
    emit_progress(
        &app_handle,
        0,
        if calendar_skip_results.is_empty() {
            format!("Starting {} download jobs...", tasks.len())
        } else {
            format!(
                "Starting {} download jobs after logging {} non-trading calendar days...",
                tasks.len(),
                calendar_skip_results.len()
            )
        },
    );

    let workers = normalized_config.workers.clamp(1, 10) as usize;
    let mut results = Vec::<DownloadResult>::new();
    let mut staged_downloads = Vec::<StagedDownload>::new();
    let mut completed = 0_usize;
    let total_tasks = tasks.len();
    let planned_jobs = tasks
        .iter()
        .map(|task| (task.exchange.clone(), task.trade_date.clone()))
        .collect::<HashSet<_>>();
    let mut staged_jobs = HashSet::new();
    let index_dates = tasks
        .iter()
        .filter(|task| task.exchange == "NSE_INDEX")
        .map(|task| task.trade_date.clone())
        .collect();
    let task_queue = Arc::new(Mutex::new(VecDeque::from(tasks)));
    let write_lock = Arc::new(Mutex::new(()));
    let (result_tx, result_rx) = mpsc::channel::<StagedDownloadOutcome>();
    let mut download_workers = batch_runtime::DownloadWorkers::default();
    let browser_fallback = Arc::new(bse_browser_fallback::BrowserFallback::default());

    for _ in 0..workers {
        if stop.is_requested() {
            break;
        }
        let user_stop = stop.clone();
        let app = app_handle.clone();
        let browser_fallback = browser_fallback.clone();
        let client = client.clone();
        let database_file_path = database_file_path.clone();
        let task_queue = Arc::clone(&task_queue);
        let result_tx = result_tx.clone();
        download_workers.spawn(move |stop| loop {
            if stop.load(std::sync::atomic::Ordering::SeqCst) {
                return;
            }
            let Some(task) = user_stop.next_task(&task_queue) else {
                return;
            };
            if stop.load(std::sync::atomic::Ordering::SeqCst) {
                return;
            }
            let result = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                stage_download_task(
                    &app,
                    &client,
                    &database_file_path,
                    &task,
                    &browser_fallback,
                    stop.clone(),
                    &user_stop,
                )
            })) {
                Ok(Ok(result)) => result,
                Ok(Err(error)) => StagedDownloadOutcome::Result(failed_download_result(
                    &task.exchange,
                    &task.trade_date,
                    error,
                )),
                Err(_) => StagedDownloadOutcome::Result(failed_download_result(
                    &task.exchange,
                    &task.trade_date,
                    "Bhavcopy download worker thread panicked.",
                )),
            };
            if stop.load(std::sync::atomic::Ordering::SeqCst) || result_tx.send(result).is_err() {
                return;
            }
        });
    }
    drop(result_tx);

    for outcome in result_rx {
        if matches!(outcome, StagedDownloadOutcome::Cancelled) {
            continue;
        }
        completed += 1;
        let progress = ((completed as f64 / total_tasks as f64) * 60.0)
            .round()
            .clamp(0.0, 60.0) as u32;
        browser_fallback.set_progress(progress);
        match outcome {
            StagedDownloadOutcome::Cancelled => unreachable!("cancelled staging was skipped"),
            StagedDownloadOutcome::Ready(staged) => {
                emit_progress(
                    &app_handle,
                    progress,
                    format!(
                        "Staged {completed}/{total_tasks}: [{}] {}",
                        staged.task.exchange, staged.task.trade_date
                    ),
                );
                staged_jobs.insert((staged.task.exchange.clone(), staged.task.trade_date.clone()));
                staged_downloads.push(staged);
            }
            StagedDownloadOutcome::Result(mut result) => {
                if result.exchange == "NSE_INDEX" {
                    // Keep archive diagnostics distinct from the date's import result.
                    result.trade_date = format!("{} archive", result.trade_date);
                    result.diagnostic = true;
                }
                if should_write_download_log(&result) {
                    let _write_guard = lock_bhavcopy_write(&write_lock)?;
                    upsert_batch_download_log_entry(&connection, &result)?;
                }
                emit_progress(
                    &app_handle,
                    progress,
                    format!(
                        "{completed}/{total_tasks}: [{}] {}",
                        result.exchange, result.trade_date
                    ),
                );
                emit_download_result(&app_handle, &result);
                results.push(result);
            }
        }
    }
    download_workers.finish()?;
    if completed != total_tasks && !stop.is_requested() {
        return Err(format!("Bhavcopy staging stopped early: {completed}/{total_tasks} jobs returned; all workers stopped."));
    }

    if get_active_database_file_path(&app_handle)?.as_ref() != Some(&database_file_path) {
        return Err(
            "Active database changed during download; staged prices were not imported.".into(),
        );
    }
    if !stop.is_requested() {
        let prior_result_count = results.len();
        let fallback = index_fallback::stage_fallback(
            &app_handle,
            &client,
            &database_file_path,
            &normalized_config,
            &index_dates,
            &mut staged_downloads,
            &mut results,
            stop.flag(),
        );
        match fallback {
            Err(error) if stop.is_requested() && error == "Index fallback cancelled" => {}
            outcome => outcome?,
        }
        if stop.is_requested()
            && results.len() > prior_result_count
            && results.last().is_some_and(|result| {
                result.message == "Historical source failure: Index fallback cancelled"
            })
        {
            results.pop();
        }
    }
    if get_active_database_file_path(&app_handle)?.as_ref() != Some(&database_file_path) {
        return Err(
            "Active database changed during download; staged prices were not imported.".into(),
        );
    }

    staged_jobs.extend(
        staged_downloads
            .iter()
            .map(|staged| (staged.task.exchange.clone(), staged.task.trade_date.clone())),
    );
    staged_downloads.sort_by(|left, right| compare_download_task(&left.task, &right.task));
    let staged_total = staged_downloads.len();
    if staged_total > 0 && !stop.is_requested() {
        emit_progress(
            &app_handle,
            60,
            format!("Importing staged download jobs: {staged_total}"),
        );
    }

    let mut staged_csv_downloads = Vec::new();
    let mut staged_other_downloads = Vec::new();
    for staged in staged_downloads {
        if matches!(&staged.content, StagedDownloadContent::Csv(_)) {
            staged_csv_downloads.push(staged);
        } else {
            staged_other_downloads.push(staged);
        }
    }

    let mut csv_no_write = staged_csv_downloads.is_empty();
    if !staged_csv_downloads.is_empty() && !stop.is_requested() {
        emit_progress(
            &app_handle,
            70,
            format!(
                "Importing staged CSV jobs by symbol: {}",
                staged_csv_downloads.len()
            ),
        );
        let csv_results = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            import_staged_csv_downloads(
                &app_handle,
                &database_file_path,
                staged_csv_downloads,
                &normalized_config,
                &write_lock,
                stop,
            )
        })) {
            Ok(Ok((results, no_write))) => {
                csv_no_write = no_write;
                results
            }
            Ok(Err(error)) => vec![failed_download_result("BHAVCOPY", "staged-csv", error)
                .with_outcome(DownloadOutcome::ImportError)],
            Err(_) => vec![failed_download_result(
                "BHAVCOPY",
                "staged-csv",
                "Bhavcopy staged CSV import worker thread panicked.",
            )
            .with_outcome(DownloadOutcome::ImportError)],
        };
        for mut result in csv_results {
            if result.exchange == "BHAVCOPY" {
                result.diagnostic = true;
            }
            emit_download_result(&app_handle, &result);
            results.push(result);
        }
    }

    let other_total = staged_other_downloads.len();
    for (index, staged) in staged_other_downloads.into_iter().enumerate() {
        if stop.is_requested() {
            break;
        }
        let import_number = index + 1;
        let progress = 80
            + ((import_number as f64 / other_total.max(1) as f64) * 19.0)
                .round()
                .clamp(0.0, 19.0) as u32;
        emit_progress(
            &app_handle,
            progress.min(99),
            format!(
                "Importing staged fallback job {import_number}/{other_total}: [{}] {}",
                staged.task.exchange, staged.task.trade_date
            ),
        );
        let exchange = staged.task.exchange.clone();
        let trade_date = staged.task.trade_date.clone();
        let Some(import) = stop.run_if_active(|| {
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                import_staged_download(
                    &database_file_path,
                    staged,
                    &normalized_config.excluded_series,
                    &write_lock,
                )
            }))
        }) else {
            break;
        };
        let result = match import {
            Ok(Ok(result)) => result,
            Ok(Err(error)) => failed_download_result(&exchange, &trade_date, error)
                .with_outcome(DownloadOutcome::ImportError),
            Err(_) => failed_download_result(
                &exchange,
                &trade_date,
                "Bhavcopy import worker thread panicked.",
            )
            .with_outcome(DownloadOutcome::ImportError),
        };
        if !result.success && should_write_download_log(&result) {
            let _write_guard = lock_bhavcopy_write(&write_lock)?;
            upsert_batch_download_log_entry(&connection, &result)?;
        }
        emit_download_result(&app_handle, &result);
        results.push(result);
    }

    finalize_planned_jobs(
        &planned_jobs,
        &staged_jobs,
        &mut results,
        stop.is_requested(),
    );
    let mut combined_results = calendar_skip_results;
    combined_results.extend(results);
    combined_results.sort_by(compare_download_results);
    let completed_download_jobs = combined_results
        .iter()
        .filter(|result| {
            !result.diagnostic
                && !is_calendar_skip_result(result)
                && result.outcome != DownloadOutcome::Cancelled
        })
        .count();
    let non_trading_calendar_days = combined_results
        .iter()
        .filter(|result| is_calendar_skip_result(result))
        .count();
    let imported_rows: usize = combined_results
        .iter()
        .map(|result| result.rows_inserted)
        .sum();
    if imported_rows > 0 {
        // Keep checkpointing applied imports even if Stop was requested
        // or chart refresh fails.
        spawn_background_bhavcopy_checkpoint(app_handle.clone(), database_file_path.clone());
    }

    let attempt_report = record_latest_attempts(&connection, &combined_results);
    if let Err(error) = attempt_report {
        push_reporting_warning(
            &app_handle,
            &mut combined_results,
            "attempt-log",
            format!("Latest-attempt records could not be saved: {error}"),
        );
    }
    if imported_rows > 0 {
        if let Err(error) = refresh_after_import(&app_handle, &database_file_path) {
            push_reporting_warning(
                &app_handle,
                &mut combined_results,
                "chart-refresh",
                format!("Prices retained; chart refresh failed: {error}"),
            );
        }
    }

    log_runtime_event(
        &app_handle,
        "INFO",
        "bhavcopy-write-complete",
        Some(&format!(
            "kind=batch mode={:?} fromDate={} toDate={} jobs={} calendarSkips={} rowsInserted={} elapsedMs={}",
            normalized_config.mode,
            normalized_config.start_date,
            normalized_config.end_date,
            completed_download_jobs,
            non_trading_calendar_days,
            imported_rows,
            started_at.elapsed().as_millis()
        )),
    );
    let no_new_quotation_writes = can_report_no_new_quotation_writes(
        csv_no_write,
        other_total,
        stop.is_requested(),
        &combined_results,
    );
    Ok(BatchRunReport {
        results: combined_results,
        prefiltered: prefiltered_results,
        clock,
        no_new_quotation_writes,
    })
}

// Reporting only: require positive control-flow evidence that neither import
// writer ran. Be conservative for cancellations, failures and unknown paths.
fn can_report_no_new_quotation_writes(
    csv_no_write: bool,
    other_total: usize,
    cancelled: bool,
    results: &[DownloadResult],
) -> bool {
    csv_no_write
        && other_total == 0
        && !cancelled
        && results.iter().all(|result| {
            result.rows_inserted == 0
                && !matches!(
                    result.outcome,
                    DownloadOutcome::Imported
                        | DownloadOutcome::ImportError
                        | DownloadOutcome::WorkerError
                        | DownloadOutcome::Cancelled
                )
        })
}

fn finalize_planned_jobs(
    planned: &HashSet<(String, String)>,
    staged: &HashSet<(String, String)>,
    results: &mut Vec<DownloadResult>,
    cancelled: bool,
) {
    let aggregate_import_failed = results.iter().any(|result| {
        result.exchange == "BHAVCOPY" && result.outcome == DownloadOutcome::ImportError
    });
    let mut terminal = HashSet::new();
    let mut archive = std::collections::HashMap::new();
    // The last terminal result owns each job (e.g. a valid fallback import
    // after a parse diagnostic). Retain superseded results as diagnostics.
    for result in results.iter_mut().rev() {
        let key = (result.exchange.clone(), result.trade_date.clone());
        if result.diagnostic {
            if let Some(date) = result.trade_date.strip_suffix(" archive") {
                archive.insert((result.exchange.clone(), date.to_string()), result.clone());
            }
            continue;
        }
        if !planned.contains(&key) || !terminal.insert(key) {
            result.diagnostic = true;
        }
    }
    let mut superseded_rows = std::collections::HashMap::<(String, String), usize>::new();
    for result in results
        .iter_mut()
        .filter(|result| result.diagnostic && result.rows_inserted > 0)
    {
        let key = (result.exchange.clone(), result.trade_date.clone());
        if terminal.contains(&key) {
            *superseded_rows.entry(key).or_default() += result.rows_inserted;
            result.rows_inserted = 0;
        }
    }
    for result in results.iter_mut().filter(|result| !result.diagnostic) {
        if let Some(rows) =
            superseded_rows.remove(&(result.exchange.clone(), result.trade_date.clone()))
        {
            result.rows_inserted += rows;
        }
    }
    for (exchange, date) in planned {
        let key = (exchange.clone(), date.clone());
        if terminal.contains(&key) {
            continue;
        }
        if cancelled && !staged.contains(&key) && !archive.contains_key(&key) {
            continue;
        }
        let archive_failure = archive.get(&key).filter(|result| !result.success);
        let result = if cancelled && staged.contains(&key) && aggregate_import_failed {
            failed_download_result(
                exchange,
                date,
                "Import failed before final result; inspect recovery evidence before retrying",
            )
            .with_outcome(DownloadOutcome::ImportError)
        } else if cancelled && !staged.contains(&key) && archive_failure.is_some() {
            let source = archive_failure.expect("archive failure checked");
            failed_download_result(
                exchange,
                date,
                format!("{}; fallback cancelled", source.message),
            )
            .with_outcome(source.outcome)
        } else if cancelled {
            failed_download_result(exchange, date, "Cancelled before import completed")
                .with_outcome(DownloadOutcome::Cancelled)
        } else if staged.contains(&key) {
            failed_download_result(
                exchange,
                date,
                "Import result unavailable; inspect recovery evidence before retrying",
            )
            .with_outcome(DownloadOutcome::ImportError)
        } else if let Some(source) = archive.get(&key) {
            let outcome = if source.outcome == DownloadOutcome::ConfirmedAbsent {
                DownloadOutcome::PartialCoverage
            } else {
                source.outcome
            };
            failed_download_result(
                exchange,
                date,
                format!(
                    "{}; no final NSE index import reported; coverage unresolved",
                    source.message
                ),
            )
            .with_outcome(outcome)
        } else {
            failed_download_result(exchange, date, "No final result returned for planned job")
        };
        results.push(result);
    }
}

fn append_follow_up_warning(result: &mut DownloadResult, warning: String) {
    result.follow_up_warning = Some(match result.follow_up_warning.take() {
        Some(previous) => format!("{previous}; {warning}"),
        None => warning,
    });
}

fn push_reporting_warning(
    app: &AppHandle,
    results: &mut Vec<DownloadResult>,
    scope: &str,
    warning: String,
) {
    log_runtime_event(app, "WARN", "bhavcopy-follow-up-warning", Some(&warning));
    let result = DownloadResult {
        outcome: DownloadOutcome::ReportingWarning,
        diagnostic: true,
        follow_up_warning: None,
        success: true,
        exchange: "BHAVCOPY".into(),
        trade_date: scope.into(),
        rows_inserted: 0,
        max_volume: 0,
        message: warning,
    };
    emit_download_result(app, &result);
    results.push(result);
}

fn refresh_after_import(app: &AppHandle, database_file_path: &Path) -> AppResult<()> {
    let started = Instant::now();
    if let Some(folder_path) = database_file_path.parent() {
        invalidate_cached_db_stats(app, folder_path)
            .map_err(|error| format!("statistics invalidation: {error}"))?;
    }
    let invalidate_ms = started.elapsed().as_millis();
    let started = Instant::now();
    let snapshot = get_app_snapshot_internal(
        app,
        Some(&SnapshotOptions {
            include_stats: Some(false),
            include_watchlists: Some(false),
        }),
    )
    .map_err(|error| format!("snapshot retrieval: {error}"))?;
    let snapshot_ms = started.elapsed().as_millis();
    let started = Instant::now();
    emit_database_changed(app, &snapshot)
        .map_err(|error| format!("database change notification: {error}"))?;
    emit_progress(app, 99, format!("Bhavcopy refresh timings: invalidate stats {invalidate_ms} ms; snapshot {snapshot_ms} ms; emit change {} ms", started.elapsed().as_millis()));
    Ok(())
}

fn finish_batch_progress(
    app: &AppHandle,
    database_file_path: &Path,
    results: AppResult<BatchRunReport>,
    cancelled: bool,
) -> AppResult<TrackedBhavcopyBatchResult> {
    let BatchRunReport {
        results,
        prefiltered,
        clock,
        no_new_quotation_writes,
    } = results?;
    if !cancelled {
        let calendar_skips = results
            .iter()
            .filter(|result| is_calendar_skip_result(result))
            .count();
        let jobs = results
            .iter()
            .filter(|result| {
                !result.diagnostic
                    && !is_calendar_skip_result(result)
                    && result.outcome != DownloadOutcome::Cancelled
            })
            .count();
        let rows: usize = results.iter().map(|result| result.rows_inserted).sum();
        emit_progress(app, 100, format!(
            "Completed download jobs: {jobs}; non-trading calendar days: {calendar_skips}; imported rows: {rows}"
        ));
        if let Some(line) = no_data_annotation_line(database_file_path, &results) {
            emit_progress(app, 100, line);
        }
    }
    let activity =
        activity_report::build_report(database_file_path, &results, &prefiltered, &clock);
    Ok(TrackedBhavcopyBatchResult {
        cancelled,
        results,
        activity,
        no_new_quotation_writes: no_new_quotation_writes && !cancelled,
    })
}

/// Annotate only explicit source-absence outcomes with saved calendar context.
/// Calendar records are informational, not proof of exchange closure or coverage.
fn no_data_annotation_line(
    database_file_path: &Path,
    results: &[DownloadResult],
) -> Option<String> {
    let mut pairs: Vec<(String, String)> = results
        .iter()
        .filter(|result| result.outcome == DownloadOutcome::ConfirmedAbsent && !result.diagnostic)
        .map(|result| (result.exchange.clone(), result.trade_date.clone()))
        .collect();
    if pairs.is_empty() {
        return None;
    }
    pairs.sort();
    pairs.dedup();
    let connection = Connection::open(database_file_path).ok()?;
    let mut holiday = Vec::new();
    let mut gap = Vec::new();
    for (exchange, date) in &pairs {
        match get_exchange_holiday_name(&connection, exchange, calendar_date_key(date))
            .ok()
            .flatten()
        {
            Some(name) => holiday.push(format!("{date} {exchange} = saved calendar annotation ({name}; not independent proof of closure)")),
            None => gap.push(format!("{date} {exchange}")),
        }
    }
    let mut line = format!(
        "No-data review: {} date/exchange pairs - {} with a saved calendar annotation, {} without a calendar annotation",
        pairs.len(),
        holiday.len(),
        gap.len()
    );
    if !holiday.is_empty() {
        line.push_str(&format!(". Holidays: {}", holiday.join("; ")));
    }
    if !gap.is_empty() {
        line.push_str(&format!(". Gaps: {}", gap.join("; ")));
    }
    Some(line)
}

fn build_batch_plan(connection: &Connection, config: &BatchDownloadConfig) -> AppResult<BatchPlan> {
    let mut info_messages = Vec::<String>::new();
    let mut calendar_skip_results = Vec::<DownloadResult>::new();
    let mut prefiltered_results = Vec::<DownloadResult>::new();
    let mut tasks = Vec::<DownloadTask>::new();

    for exchange in selected_exchanges(&config.exchanges) {
        if exchange == "NSE_INDEX" {
            let supported = index_fallback::SUPPORTED
                .iter()
                .map(|index| index.name)
                .collect::<Vec<_>>()
                .join(", ");
            info_messages.push(format!("[NSE Index] Daily archives first; missing supported indices use historical fallback in chunks up to 366 days. Supported subset: {supported}. Other indices and unavailable dates remain unresolved; no full-history certification. Existing prices are preserved."));
        }
        let regular_window = resolve_exchange_date_window(
            connection,
            &config.mode,
            &exchange,
            &config.start_date,
            &config.end_date,
            &mut info_messages,
        )?;
        let end_date = regular_window
            .as_ref()
            .map(|(_, end)| end.clone())
            .unwrap_or_else(update_end_trade_date);
        let retry_start = if config.mode == DownloadMode::Update {
            Some(coverage::retry_window_start(&end_date)?)
        } else {
            None
        };
        let start_date = match (regular_window.as_ref(), retry_start.as_ref()) {
            (Some((start, _)), Some(retry)) => start.min(retry).clone(),
            (Some((start, _)), None) => start.clone(),
            (None, Some(retry)) => retry.clone(),
            (None, None) => continue,
        };
        let imported_dates = if config.force_redownload {
            ImportedTradeDates::default()
        } else {
            storage_mode_load_imported_trade_dates(connection, &exchange, &start_date, &end_date)?
        };
        let retries = if config.mode == DownloadMode::Update {
            coverage::update_retries(
                connection,
                &exchange,
                &end_date,
                coverage::now_timestamp(),
                &imported_dates.dates,
            )?
        } else {
            coverage::RetryPlan::default()
        };
        if config.mode == DownloadMode::Update {
            info_messages.push(format!("[{}] Earlier unresolved/unverified dates: {} scheduled, {} deferred (90-day window, 10 per exchange/run, 24h cooldown); {} older legacy error/partial markers outside window; use Date Range for older history",format_exchange_log_label(&exchange),retries.dates.len(),retries.deferred,retries.outside_window));
        }

        // PHASE-1: make a missing official calendar explicit rather than letting
        // an unverified built-in seed silently stand in for it.
        let start_year: i32 = start_date
            .get(..4)
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        let end_year: i32 = end_date.get(..4).and_then(|v| v.parse().ok()).unwrap_or(0);
        for year in start_year..=end_year {
            if year > 0 && !has_official_holiday_snapshot(connection, &exchange, year)? {
                info_messages.push(format!(
                    "[{}] Calendar: no official holiday snapshot for {year}; built-in dates are not used (manual holidays only)",
                    format_exchange_log_label(&exchange)
                ));
            }
        }
        if imported_dates.metadata_lookup_ms > 0
            || imported_dates.binary_reconcile_ms > 0
            || imported_dates.binary_reconcile_files_scanned > 0
        {
            info_messages.push(format!(
                "[{}] Prefilter timings: metadata {} ms; binary reconcile {} ms; binary files scanned {}; target dates {}",
                format_exchange_log_label(&exchange),
                imported_dates.metadata_lookup_ms,
                imported_dates.binary_reconcile_ms,
                imported_dates.binary_reconcile_files_scanned,
                imported_dates.binary_reconcile_target_dates
            ));
        }

        let mut calendar_days = std::collections::BTreeSet::new();
        if let Some((start, end)) = regular_window {
            calendar_days.extend(generate_calendar_days(&start, &end)?);
        }
        if !retries.dates.is_empty() {
            info_messages.push(format!(
                "[{}] Earlier retry dates: {}",
                format_exchange_log_label(&exchange),
                retries.dates.iter().cloned().collect::<Vec<_>>().join(", ")
            ));
        }
        calendar_days.extend(retries.dates);
        let mut skipped_existing_days = 0_usize;

        let calendar_days = calendar_days.into_iter().collect::<Vec<_>>();
        let mut presence_ms = 0_u128;
        let mut presence_dates = 0_usize;
        for window in calendar_days.chunks(31) {
            let mut planned = Vec::with_capacity(window.len());
            let mut probe_dates = Vec::new();
            for trade_date in window {
                let parsed_date = parse_trade_date(trade_date)?;
                let special = special_trading_day_name(&exchange, trade_date);
                let skip = create_calendar_skip_result(
                    connection,
                    &exchange,
                    trade_date,
                    parsed_date.weekday(),
                );
                if skip.is_some() && !imported_dates.dates.contains(trade_date) {
                    probe_dates.push(trade_date.clone());
                }
                planned.push((trade_date.clone(), parsed_date, special, skip));
            }
            let probe_started = Instant::now();
            let contradicted =
                ingestion::calendar_contradiction_dates(connection, &exchange, &probe_dates)?;
            presence_ms += probe_started.elapsed().as_millis();
            presence_dates += probe_dates.len();
            for (trade_date, parsed_date, special, skip) in planned {
                if let Some(special_name) = special {
                    info_messages.push(format!(
                    "[{}] {}: Special trading day override ({special_name}); treated as trading day",
                    format_exchange_log_label(&exchange),
                    trade_date
                ));
                }
                if let Some(skip_result) = skip {
                    // PHASE-1: observed bars outrank the calendar. A wrong holiday row
                    // must not suppress a real session (2023-09-28 held 2,331 NSE bars
                    // while market_holidays called it Id-E-Milad).
                    if is_calendar_skip_contradicted(
                        &skip_result,
                        imported_dates.dates.contains(&trade_date)
                            || contradicted.contains(&trade_date),
                    ) {
                        info_messages.push(format!(
                        "[{}] {}: CALENDAR CONTRADICTION - stored bars exist but the calendar says '{}'; scheduling instead of skipping",
                        format_exchange_log_label(&exchange),
                        trade_date,
                        skip_result.message
                    ));
                    } else {
                        calendar_skip_results.push(skip_result);
                        continue;
                    }
                }

                // Normal Range behaviour is gap-filling: already-imported days are
                // skipped. `force_redownload` is the explicit repair switch that
                // plans every session so an existing (possibly wrong) bar can be
                // replaced by the source row.
                if !config.force_redownload && imported_dates.dates.contains(&trade_date) {
                    skipped_existing_days += 1;
                    prefiltered_results.push(
                    skipped_download_result(
                        &exchange,
                        &trade_date,
                        "Already imported (checkpointed source OHLC scope verified against current records; not full-market certification)",
                    )
                    .with_outcome(DownloadOutcome::AlreadyPresent),
                );
                    continue;
                }

                if exchange == "NSE" {
                    tasks.push(DownloadTask {
                        exchange: "NSE".to_string(),
                        trade_date: trade_date.clone(),
                        mode: config.mode.clone(),
                        candidates: generate_nse_candidates(
                            parsed_date,
                            config.nse_equity_url_override.as_ref(),
                        ),
                        nse_index_history: None,
                    });
                    continue;
                }

                if exchange == "NSE_INDEX" {
                    tasks.push(DownloadTask {
                        exchange: "NSE_INDEX".to_string(),
                        trade_date: trade_date.clone(),
                        mode: config.mode.clone(),
                        candidates: generate_nse_index_candidates(
                            parsed_date,
                            config.nse_index_url_override.as_ref(),
                        ),
                        nse_index_history: None,
                    });
                    continue;
                }

                let candidates = if exchange == "BSE" {
                    generate_bse_candidates(parsed_date, config.bse_equity_url_override.as_ref())
                } else {
                    generate_bse_index_candidates(
                        parsed_date,
                        config.bse_index_url_override.as_ref(),
                    )
                };
                tasks.push(DownloadTask {
                    exchange: exchange.clone(),
                    trade_date,
                    mode: config.mode.clone(),
                    candidates,
                    nse_index_history: None,
                });
            }
        }
        if presence_dates > 0 {
            info_messages.push(format!(
                "[{}] Calendar contradiction probe: {presence_dates} dates in {presence_ms} ms",
                format_exchange_log_label(&exchange)
            ));
        }
        if skipped_existing_days > 0 {
            info_messages.push(format!(
                "[{}] Prefiltered {skipped_existing_days} already imported trading days",
                format_exchange_log_label(&exchange)
            ));
        }
        if imported_dates.stale_zero_volume_dates > 0 {
            info_messages.push(format!(
                "[{}] Scheduled {} previously imported zero-volume trading days for refresh",
                format_exchange_log_label(&exchange),
                imported_dates.stale_zero_volume_dates
            ));
        }
        if imported_dates.metadata_only_dates > 0 {
            info_messages.push(format!(
                "[{}] Scheduled {} metadata-only/unverified trading days for source verification (legacy counts alone do not prove coverage)",
                format_exchange_log_label(&exchange),
                imported_dates.metadata_only_dates
            ));
        }
        if config.force_redownload {
            info_messages.push(format!(
                "[{}] Repair re-download: existing coverage ignored for this range; every planned session is imported and existing bars are replaced by the source rows",
                format_exchange_log_label(&exchange)
            ));
        }
    }

    Ok(BatchPlan {
        info_messages,
        calendar_skip_results,
        prefiltered_results,
        tasks,
    })
}

fn stage_download_task(
    app: &AppHandle,
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    browser: &bse_browser_fallback::BrowserFallback,
    worker_stop: Arc<std::sync::atomic::AtomicBool>,
    stop: &BatchStop,
) -> AppResult<StagedDownloadOutcome> {
    if stop.is_requested() {
        return Ok(StagedDownloadOutcome::Cancelled);
    }
    // The planner's evidence decision is authoritative. Physical presence of
    // one bar must never cancel a scheduled gap/retry/forced repair.
    if task.exchange == "NSE_INDEX" && task.nse_index_history.is_none() {
        return stage_single_download_with_evidence(client, task, stop, Some(database_file_path));
    }

    if stop.is_requested() {
        return Ok(StagedDownloadOutcome::Cancelled);
    }
    if let Some(history_task) = &task.nse_index_history {
        return stage_nse_index_history_task(client, task, history_task);
    }

    let normal = stage_single_download_with_evidence(client, task, stop, Some(database_file_path));
    if bse_browser_fallback::should_recover(task, &normal) {
        if stop.is_requested() {
            return Ok(StagedDownloadOutcome::Cancelled);
        }
        let recovered = browser.recover(app, task, worker_stop, stop);
        if stop.is_requested() {
            return Ok(StagedDownloadOutcome::Cancelled);
        }
        match recovered {
            Ok(Some(staged)) => return Ok(StagedDownloadOutcome::Ready(staged)),
            Ok(None) => {}
            Err(error) => {
                let primary = match &normal {
                    Err(error) => error.as_str(),
                    Ok(StagedDownloadOutcome::Result(result)) => result.message.as_str(),
                    _ => "Official source unavailable",
                };
                return Ok(StagedDownloadOutcome::Result(
                    failed_download_result(
                        &task.exchange,
                        &task.trade_date,
                        format!("{primary}; automatic BSE browser fallback: {error}"),
                    )
                    .with_outcome(DownloadOutcome::SourceError),
                ));
            }
        }
    }
    normal
}

fn stage_nse_index_history_task(
    client: &Client,
    task: &DownloadTask,
    history_task: &NseIndexHistoryTask,
) -> AppResult<StagedDownloadOutcome> {
    let url = build_nse_index_history_url(history_task)?;
    let bytes = fetch_candidate_bytes(client, &url, NSE_INDEX_HISTORY_PAGE_URL, 3)?
        .ok_or_else(|| "No data returned by NSE historical index API".to_string())?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let parsed = serde_json::from_str::<NseIndexHistoryResponse>(&content)
        .map_err(|error| format!("NSE historical index API JSON parse failed: {error}"))?;

    if parsed.error.unwrap_or(false) {
        return Ok(StagedDownloadOutcome::Result(
            failed_download_result(
                &task.exchange,
                &task.trade_date,
                parsed
                    .show_message
                    .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
            )
            .with_outcome(DownloadOutcome::SourceError),
        ));
    }

    let rows = parsed
        .data
        .ok_or_else(|| "NSE historical index API missing data array".to_string())?;
    if rows.is_empty() {
        return Ok(StagedDownloadOutcome::Result(
            skipped_download_result(
                &task.exchange,
                &task.trade_date,
                format!(
                    "No NSE historical index API rows for {} {} to {}",
                    history_task.index_type, history_task.from_date, history_task.to_date
                ),
            )
            .with_outcome(DownloadOutcome::ConfirmedAbsent),
        ));
    }

    let normalized =
        normalize_nse_index_history_rows(&rows, &history_task.symbol, &history_task.index_type);
    Ok(StagedDownloadOutcome::Ready(StagedDownload {
        task: task.clone(),
        content: StagedDownloadContent::NseIndexHistory(normalized),
    }))
}

fn candidate_scan_should_skip(
    candidate_count: usize,
    absent_count: usize,
    has_error: bool,
) -> bool {
    !has_error && candidate_count > 0 && absent_count == candidate_count
}

/// Decode and validate a candidate before any storage mutation. Only an
/// explicit empty archive response may return None; malformed content is rejected.
fn decode_candidate_csv(
    candidate: &Candidate,
    bytes: Vec<u8>,
    exchange: &str,
    trade_date: &str,
) -> AppResult<Option<String>> {
    decode_candidate_csv_with_evidence(candidate, bytes, exchange, trade_date, None)
}

fn decode_candidate_csv_with_evidence(
    candidate: &Candidate,
    bytes: Vec<u8>,
    exchange: &str,
    trade_date: &str,
    evidence_database: Option<&Path>,
) -> AppResult<Option<String>> {
    let csv = if candidate.bse_index_archive_json {
        let Some(csv) = normalize_bse_index_archive_json(&bytes, trade_date)? else {
            return Ok(None);
        };
        csv
    } else {
        let bytes = if candidate.zipped || bytes.starts_with(b"PK\x03\x04") {
            extract_first_csv_from_zip(&bytes)?
                .ok_or_else(|| "ZIP did not contain readable CSV/TXT data.".to_string())?
        } else {
            bytes
        };
        String::from_utf8_lossy(&bytes).into_owned()
    };
    let (parsed, rejected) = parse_download_csv(&csv, exchange, trade_date)?;
    if let Some(database) = evidence_database {
        if !rejected.is_empty() {
            let evidence = serde_json::to_vec_pretty(&serde_json::json!({"schema":"bhavcopy-index-quarantine-v1","exchange":exchange,"date":trade_date,"decodedArchiveSha256":coverage::digest(csv.as_bytes()),"rows":&rejected})).map_err(|e|e.to_string())?;
            index_fallback::save_evidence(database, "quarantine", &evidence)?;
        }
    }
    if let Some(debug) = parsed.debug {
        return Err(debug);
    }
    if parsed.rows.is_empty() {
        return Err(format!(
            "Candidate CSV contains no usable rows; {} held/unsupported index rows",
            rejected.len()
        ));
    }
    Ok(Some(csv))
}

#[cfg(test)]
fn stage_single_download(
    client: &Client,
    task: &DownloadTask,
    stop: &BatchStop,
) -> AppResult<StagedDownloadOutcome> {
    stage_single_download_with_evidence(client, task, stop, None)
}

fn stage_single_download_with_evidence(
    client: &Client,
    task: &DownloadTask,
    stop: &BatchStop,
    evidence_database: Option<&Path>,
) -> AppResult<StagedDownloadOutcome> {
    let mut last_hard_error: Option<String> = None;
    let mut primary_hard_error: Option<String> = None;
    let mut last_rejection: Option<String> = None;
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(&task.exchange);

    for (candidate_idx, candidate) in task.candidates.iter().enumerate() {
        if stop.is_requested() {
            return Ok(StagedDownloadOutcome::Cancelled);
        }
        match fetch_candidate_content_bytes(client, candidate, referer, 3, &task.trade_date) {
            Ok(Some(bytes)) => {
                let csv_content = match decode_candidate_csv_with_evidence(
                    candidate,
                    bytes,
                    &task.exchange,
                    &task.trade_date,
                    evidence_database,
                ) {
                    Ok(Some(csv)) => csv,
                    Ok(None) => {
                        not_found_count += 1;
                        continue;
                    }
                    Err(error) => {
                        last_rejection = Some(format!("Candidate rejected: {error}"));
                        continue;
                    }
                };
                return Ok(StagedDownloadOutcome::Ready(StagedDownload {
                    task: task.clone(),
                    content: StagedDownloadContent::Csv(csv_content),
                }));
            }
            Ok(None) => {
                not_found_count += 1;
            }
            Err(error) => {
                if candidate_idx == 0 {
                    primary_hard_error = Some(error.clone());
                }
                last_hard_error = Some(error);
            }
        }
    }

    if candidate_scan_should_skip(
        task.candidates.len(),
        not_found_count,
        last_hard_error.is_some() || last_rejection.is_some(),
    ) {
        let message = if is_bse_exchange(&task.exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (all reported absence)",
                task.candidates.len()
            )
        } else {
            "No data available for this date (all candidates reported absence)".to_string()
        };
        return Ok(StagedDownloadOutcome::Result(
            skipped_download_result(&task.exchange, &task.trade_date, message)
                .with_outcome(DownloadOutcome::ConfirmedAbsent),
        ));
    }

    Ok(StagedDownloadOutcome::Result(DownloadResult {
        outcome: if last_hard_error.is_some() || last_rejection.is_none() {
            DownloadOutcome::SourceError
        } else {
            DownloadOutcome::SourceRejected
        },
        diagnostic: false,
        follow_up_warning: None,
        success: false,
        trade_date: task.trade_date.clone(),
        exchange: task.exchange.clone(),
        rows_inserted: 0,
        max_volume: 0,
        message: primary_hard_error
            .or(last_hard_error)
            .or(last_rejection)
            .unwrap_or_else(|| "Download failed".to_string()),
    }))
}

fn process_download_task(
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    excluded_series: &[String],
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    if let Some(history_task) = &task.nse_index_history {
        return process_nse_index_history_task(
            client,
            database_file_path,
            task,
            history_task,
            write_lock,
        );
    }

    let connection = open_database_connection(database_file_path)?;
    if coverage::verified_dates(
        &connection,
        &task.exchange,
        &task.trade_date,
        &task.trade_date,
    )?
    .dates
    .contains(&task.trade_date)
    {
        return Ok(DownloadResult {
            outcome: DownloadOutcome::AlreadyPresent,
            diagnostic: false,
            follow_up_warning: None,
            success: true,
            trade_date: task.trade_date.clone(),
            exchange: task.exchange.clone(),
            rows_inserted: 0,
            max_volume: 0,
            message:
                "Already imported (checkpointed source OHLC scope verified against current records)"
                    .to_string(),
        });
    }
    let mut result = download_single(
        client,
        database_file_path,
        &task.exchange,
        &task.trade_date,
        &task.candidates,
        excluded_series,
        write_lock,
    )
    .unwrap_or_else(|error| {
        failed_download_result(&task.exchange, &task.trade_date, error)
            .with_outcome(DownloadOutcome::ImportError)
    });

    let report = (|| -> AppResult<()> {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        // The normal single importer already records the verified source
        // member count. Do not replace it with this attempt's number of writes.
        if !matches!(
            result.outcome,
            DownloadOutcome::Imported
                | DownloadOutcome::AlreadyPresent
                | DownloadOutcome::PartialCoverage
        ) && should_write_download_log(&result)
        {
            upsert_batch_download_log_entry(&connection, &result)?;
        }
        record_latest_attempts(&connection, std::slice::from_ref(&result))
    })();
    if let Err(error) = report {
        append_follow_up_warning(
            &mut result,
            format!("Download metadata update failed: {error}"),
        );
    }
    Ok(result)
}

fn process_nse_index_history_task(
    client: &Client,
    database_file_path: &Path,
    task: &DownloadTask,
    history_task: &NseIndexHistoryTask,
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    let url = build_nse_index_history_url(history_task)?;
    let bytes = fetch_candidate_bytes(client, &url, NSE_INDEX_HISTORY_PAGE_URL, 3)?
        .ok_or_else(|| "No data returned by NSE historical index API".to_string())?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let parsed = serde_json::from_str::<NseIndexHistoryResponse>(&content)
        .map_err(|error| format!("NSE historical index API JSON parse failed: {error}"))?;

    if parsed.error.unwrap_or(false) {
        return Ok(failed_download_result(
            &task.exchange,
            &task.trade_date,
            parsed
                .show_message
                .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
        )
        .with_outcome(DownloadOutcome::SourceError));
    }

    let rows = parsed
        .data
        .ok_or_else(|| "NSE historical index API missing data array".to_string())?;
    if rows.is_empty() {
        return Ok(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            format!(
                "No NSE historical index API rows for {} {} to {}",
                history_task.index_type, history_task.from_date, history_task.to_date
            ),
        )
        .with_outcome(DownloadOutcome::ConfirmedAbsent));
    }

    let parsed_rows =
        normalize_nse_index_history_rows(&rows, &history_task.symbol, &history_task.index_type);
    let result = {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        insert_nse_index_history_rows(database_file_path, &task.exchange, &parsed_rows)?
    };
    let message = format!(
        "NSE index API {} {} to {}: {} imported, {} close-only skipped",
        history_task.symbol,
        history_task.from_date,
        history_task.to_date,
        result.rows_inserted,
        result.close_only_skipped
    );

    Ok(DownloadResult {
        outcome: DownloadOutcome::Imported,
        diagnostic: false,
        follow_up_warning: None,
        success: true,
        trade_date: task.trade_date.clone(),
        exchange: task.exchange.clone(),
        rows_inserted: result.rows_inserted,
        max_volume: result.max_volume,
        message,
    })
}

fn download_single(
    client: &Client,
    database_file_path: &Path,
    exchange: &str,
    trade_date: &str,
    candidates: &[Candidate],
    excluded_series: &[String],
    write_lock: &Mutex<()>,
) -> AppResult<DownloadResult> {
    let mut last_hard_error: Option<String> = None;
    let mut primary_hard_error: Option<String> = None;
    let mut last_rejection: Option<String> = None;
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(exchange);

    for (candidate_idx, candidate) in candidates.iter().enumerate() {
        match fetch_candidate_content_bytes(client, candidate, referer, 3, trade_date) {
            Ok(Some(bytes)) => {
                let csv_content = match decode_candidate_csv(candidate, bytes, exchange, trade_date)
                {
                    Ok(Some(csv)) => csv,
                    Ok(None) => {
                        not_found_count += 1;
                        continue;
                    }
                    Err(error) => {
                        last_rejection = Some(format!("Candidate rejected: {error}"));
                        continue;
                    }
                };
                let parsed = {
                    let _write_guard = lock_bhavcopy_write(write_lock)?;
                    parse_and_insert_normal_download(
                        database_file_path,
                        &csv_content,
                        exchange,
                        trade_date,
                        excluded_series,
                    )?
                };
                let (parsed, coverage_message, coverage_complete) = parsed;
                if let Some(debug) = parsed.debug {
                    return Ok(failed_download_result(exchange, trade_date, debug)
                        .with_outcome(DownloadOutcome::ImportError));
                }
                let written = parsed.rows_inserted + parsed.rows_replaced;
                return Ok(DownloadResult {
                    outcome: if parsed.admission.conflicted == 0 && coverage_complete {
                        if written == 0 {
                            DownloadOutcome::AlreadyPresent
                        } else {
                            DownloadOutcome::Imported
                        }
                    } else {
                        DownloadOutcome::PartialCoverage
                    },
                    diagnostic: false,
                    follow_up_warning: None,
                    success: parsed.admission.conflicted == 0 && coverage_complete,
                    trade_date: trade_date.to_string(),
                    exchange: exchange.to_string(),
                    rows_inserted: written,
                    max_volume: parsed.max_volume,
                    message: parsed.admission.describe_result(format!(
                        "Downloaded {written} missing records; {coverage_message}"
                    )),
                });
            }
            Ok(None) => {
                not_found_count += 1;
            }
            Err(error) => {
                if candidate_idx == 0 {
                    primary_hard_error = Some(error.clone());
                }
                last_hard_error = Some(error);
            }
        }
    }

    if candidate_scan_should_skip(
        candidates.len(),
        not_found_count,
        last_hard_error.is_some() || last_rejection.is_some(),
    ) {
        let message = if is_bse_exchange(exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (all reported absence)",
                candidates.len()
            )
        } else {
            "No data available for this date (all candidates reported absence)".to_string()
        };
        return Ok(skipped_download_result(exchange, trade_date, message)
            .with_outcome(DownloadOutcome::ConfirmedAbsent));
    }

    Ok(DownloadResult {
        outcome: if last_hard_error.is_some() || last_rejection.is_none() {
            DownloadOutcome::SourceError
        } else {
            DownloadOutcome::SourceRejected
        },
        diagnostic: false,
        follow_up_warning: None,
        success: false,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: primary_hard_error
            .or(last_hard_error)
            .or(last_rejection)
            .unwrap_or_else(|| "Download failed".to_string()),
    })
}

fn compare_download_results(left: &DownloadResult, right: &DownloadResult) -> std::cmp::Ordering {
    left.trade_date.cmp(&right.trade_date).then_with(|| {
        normalize_exchange_key(&left.exchange).cmp(&normalize_exchange_key(&right.exchange))
    })
}

fn compare_download_task(left: &DownloadTask, right: &DownloadTask) -> std::cmp::Ordering {
    left.trade_date.cmp(&right.trade_date).then_with(|| {
        normalize_exchange_key(&left.exchange).cmp(&normalize_exchange_key(&right.exchange))
    })
}

#[cfg(test)]
mod tests;

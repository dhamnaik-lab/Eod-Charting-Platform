#[cfg(test)]
pub use crate::bhavcopy_recovery::{
    RecoveryBinaryBaseline, RecoveryBinaryBaselineKind, RecoverySessionState,
    MAX_BUFFERED_CHECKPOINT_WORKERS,
};
pub use crate::database::binary_eod::*;
#[cfg(test)]
pub use crate::database::eod_binary_state::*;
use crate::database::{
    emit_database_changed, get_active_database_file_path, get_app_snapshot_internal,
    invalidate_cached_db_stats, prepare_database_connection,
    try_acquire_price_store_operation, PriceStorageMode, PriceStoreOperationKind, SnapshotOptions,
};
use crate::runtime::log_runtime_event;
pub use chrono::{Datelike, Local};
#[cfg(test)]
use chrono::NaiveDate;
use reqwest::blocking::Client;
pub use rusqlite::params;
use rusqlite::{Connection, OptionalExtension};
use std::collections::{HashSet, VecDeque};
#[cfg(test)]
use std::fs;
use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Instant;
use tauri::{ipc::Channel, AppHandle};
use batch_runtime::{BatchCancellation, BatchStop};

pub mod types;
pub use types::*;
pub use types::AppResult;
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
pub use ingestion::*;
pub mod settings;
pub use settings::*;
pub mod bse_price_history;
pub use bse_price_history::{cancel_bse_price_history_download, download_bse_price_history};
mod batch_runtime;
mod bse_browser_fallback;
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
        prepare_database_connection(&holiday_connection)?;
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
        let result = process_download_task(
            &client,
            &database_file_path,
            &task,
            &[],
            &write_lock,
        )?;

        if result.rows_inserted > 0 {
            if let Some(folder_path) = database_file_path.parent() {
                invalidate_cached_db_stats(&app_handle, folder_path)?;
            }
            let snapshot = get_app_snapshot_internal(
                &app_handle,
                Some(&SnapshotOptions {
                    include_stats: Some(false),
                    include_watchlists: Some(false),
                }),
            )?;
            emit_database_changed(&app_handle, &snapshot)?;
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
        let results = run_bhavcopy_batch(app.clone(), database_file_path, config, &run.stop);
        let cancelled = run.finish();
        finish_batch_progress(&app, results, cancelled)
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
        let results = run_bhavcopy_batch(app.clone(), database_file_path, config, &BatchStop::default());
        Ok(finish_batch_progress(&app, results, false)?.results)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn run_bhavcopy_batch(
    app_handle: AppHandle,
    database_file_path: std::path::PathBuf,
    config: BatchDownloadConfig,
    stop: &BatchStop,
) -> AppResult<Vec<DownloadResult>> {
    let started_at = Instant::now();
    if stop.is_requested() {
        return Ok(Vec::new());
    }
    let normalized_config = normalize_batch_config(config)?;
    let _price_store_operation_permit =
        try_acquire_price_store_operation(PriceStoreOperationKind::BhavcopyWrite)?;
    if stop.is_requested() {
        return Ok(Vec::new());
    }
    recover_pending_bhavcopy_sessions(&app_handle, &database_file_path)?;
    if stop.is_requested() {
        return Ok(Vec::new());
    }
    let connection = open_database_connection(&database_file_path)?;
    let BatchPlan {
        info_messages,
        calendar_skip_results,
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
            format!("Found {active_trading_days} trading days")
        } else {
            format!(
                "Found {active_trading_days} active trading days ({} non-trading calendar days logged)",
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
    emit_progress(
        &app_handle,
        0,
        format!("Download jobs: {}", tasks.len()),
    );
    for result in &calendar_skip_results {
        emit_download_result(&app_handle, result);
    }

    if stop.is_requested() {
        return Ok(calendar_skip_results);
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
        return Ok(calendar_skip_results);
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
    let index_dates = tasks.iter().filter(|task| task.exchange == "NSE_INDEX")
        .map(|task| task.trade_date.clone()).collect();
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
            if stop.load(std::sync::atomic::Ordering::SeqCst) { return; }
            let Some(task) = user_stop.next_task(&task_queue) else {
                return;
            };
            if stop.load(std::sync::atomic::Ordering::SeqCst) { return; }
            let result = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                stage_download_task(
                    &app, &client, &database_file_path, &task, &browser_fallback, stop.clone(), &user_stop,
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
                staged_downloads.push(staged);
            }
            StagedDownloadOutcome::Result(mut result) => {
                if result.exchange == "NSE_INDEX" {
                    // Keep archive diagnostics distinct from the date's import result.
                    result.trade_date = format!("{} archive", result.trade_date);
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
        return Err("Active database changed during download; staged prices were not imported.".into());
    }
    if !stop.is_requested() {
        let prior_result_count = results.len();
        let fallback = index_fallback::stage_fallback(
            &app_handle, &client, &database_file_path, &normalized_config, &index_dates,
            &mut staged_downloads, &mut results, stop.flag(),
        );
        match fallback {
            Err(error) if stop.is_requested() && error == "Index fallback cancelled" => {}
            outcome => outcome?,
        }
        if stop.is_requested() && results.len() > prior_result_count
            && results.last().is_some_and(|result| result.message == "Historical source failure: Index fallback cancelled")
        {
            results.pop();
        }
    }
    if get_active_database_file_path(&app_handle)?.as_ref() != Some(&database_file_path) {
        return Err("Active database changed during download; staged prices were not imported.".into());
    }

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
            Ok(Ok(results)) => results,
            Ok(Err(error)) => vec![failed_download_result("BHAVCOPY", "staged-csv", error)],
            Err(_) => vec![failed_download_result(
                "BHAVCOPY",
                "staged-csv",
                "Bhavcopy staged CSV import worker thread panicked.",
            )],
        };
        for result in csv_results {
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
            Ok(Err(error)) => failed_download_result(&exchange, &trade_date, error),
            Err(_) => failed_download_result(
                &exchange,
                &trade_date,
                "Bhavcopy import worker thread panicked.",
            ),
        };
        if !result.success && should_write_download_log(&result) {
            let _write_guard = lock_bhavcopy_write(&write_lock)?;
            upsert_batch_download_log_entry(&connection, &result)?;
        }
        emit_download_result(&app_handle, &result);
        results.push(result);
    }

    let mut combined_results = calendar_skip_results;
    combined_results.extend(results);
    combined_results.sort_by(compare_download_results);
    let completed_download_jobs = combined_results
        .iter()
        .filter(|result| !is_calendar_skip_result(result))
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

    if combined_results.iter().any(|r| r.rows_inserted > 0) {
        let invalidate_stats_started = Instant::now();
        if let Some(folder_path) = database_file_path.parent() {
            invalidate_cached_db_stats(&app_handle, folder_path)?;
        }
        let invalidate_stats_ms = invalidate_stats_started.elapsed().as_millis();

        let snapshot_started = Instant::now();
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        let snapshot_ms = snapshot_started.elapsed().as_millis();

        let emit_database_changed_started = Instant::now();
        emit_database_changed(&app_handle, &snapshot)?;
        let emit_database_changed_ms = emit_database_changed_started.elapsed().as_millis();

        emit_progress(
            &app_handle,
            99,
            format!(
                "Bhavcopy refresh timings: invalidate stats {} ms; snapshot {} ms; emit change {} ms",
                invalidate_stats_ms,
                snapshot_ms,
                emit_database_changed_ms
            ),
        );
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
    Ok(combined_results)
}

fn finish_batch_progress(
    app: &AppHandle,
    results: AppResult<Vec<DownloadResult>>,
    cancelled: bool,
) -> AppResult<TrackedBhavcopyBatchResult> {
    let results = results?;
    if !cancelled {
        let calendar_skips = results.iter().filter(|result| is_calendar_skip_result(result)).count();
        let jobs = results.len() - calendar_skips;
        let rows: usize = results.iter().map(|result| result.rows_inserted).sum();
        emit_progress(app, 100, format!(
            "Completed download jobs: {jobs}; non-trading calendar days: {calendar_skips}; imported rows: {rows}"
        ));
    }
    Ok(TrackedBhavcopyBatchResult { cancelled, results })
}

fn build_batch_plan(connection: &Connection, config: &BatchDownloadConfig) -> AppResult<BatchPlan> {
    let mut info_messages = Vec::<String>::new();
    let mut calendar_skip_results = Vec::<DownloadResult>::new();
    let mut tasks = Vec::<DownloadTask>::new();

    for exchange in selected_exchanges(&config.exchanges) {
        if exchange == "NSE_INDEX" {
            let supported = index_fallback::SUPPORTED.iter().map(|index| index.name).collect::<Vec<_>>().join(", ");
            info_messages.push(format!("[NSE Index] Daily archives first; missing supported indices use historical fallback in chunks up to 366 days. Supported subset: {supported}. Other indices and unavailable dates remain unresolved; no full-history certification. Existing prices are preserved."));
        }
        let Some((start_date, end_date)) = resolve_exchange_date_window(
            connection,
            &config.mode,
            &exchange,
            &config.start_date,
            &config.end_date,
            &mut info_messages,
        )?
        else {
            continue;
        };

        let imported_dates = if exchange == "NSE_INDEX" {
            // An exchange-date marker cannot establish per-index coverage.
            ImportedTradeDates::default()
        } else {
            storage_mode_load_imported_trade_dates(connection, &exchange, &start_date, &end_date)?
        };
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

        let calendar_days = generate_calendar_days(&start_date, &end_date)?;
        let mut skipped_existing_days = 0_usize;

        for trade_date in calendar_days {
            let parsed_date = parse_trade_date(&trade_date)?;
            if let Some(special_name) = special_trading_day_name(&exchange, &trade_date) {
                info_messages.push(format!(
                    "[{}] {}: Special trading day override ({special_name}); treated as trading day",
                    format_exchange_log_label(&exchange),
                    trade_date
                ));
            }
            if let Some(skip_result) = create_calendar_skip_result(
                connection,
                &exchange,
                &trade_date,
                parsed_date.weekday(),
            ) {
                calendar_skip_results.push(skip_result);
                continue;
            }

            if imported_dates.dates.contains(&trade_date) {
                skipped_existing_days += 1;
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
                generate_bse_index_candidates(parsed_date, config.bse_index_url_override.as_ref())
            };
            tasks.push(DownloadTask {
                exchange: exchange.clone(),
                trade_date,
                mode: config.mode.clone(),
                candidates,
                nse_index_history: None,
            });
        }

        if skipped_existing_days > 0 {
            info_messages.push(format!(
                "[{}] Prefiltered {skipped_existing_days} already imported trading days",
                format_exchange_log_label(&exchange)
            ));
            if exchange == "NSE_INDEX" {
                info_messages.push(
                    "[NSE Index] Already-imported dates describe exchange-day imports, not complete per-index history. Charts join verified historical index aliases without rewriting source files.".to_string(),
                );
                if crate::database::get_price_storage_mode(connection) == PriceStorageMode::Binary
                    && imported_dates.dates.len() > BINARY_PREFILTER_RECONCILE_MAX_DATES
                {
                    info_messages.push(format!(
                        "[NSE Index] Binary reconciliation was not run: {} imported dates exceed the {}-date scan limit; metadata completion is not binary coverage verification.",
                        imported_dates.dates.len(), BINARY_PREFILTER_RECONCILE_MAX_DATES
                    ));
                }
            }
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
                "[{}] Scheduled {} metadata-only trading days for refresh because binary files are missing or incomplete",
                format_exchange_log_label(&exchange),
                imported_dates.metadata_only_dates
            ));
        }
    }

    Ok(BatchPlan {
        info_messages,
        calendar_skip_results,
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
    if task.exchange == "NSE_INDEX" && task.nse_index_history.is_none() {
        return stage_single_download(client, task, stop);
    }
    let connection = batch_runtime::open_staging_connection(database_file_path)?;
    let existing_log_id = connection
        .query_row(
            "
              SELECT id
              FROM download_log
              WHERE trade_date = ? AND exchange = ? AND status = 'ok'
              LIMIT 1
            ",
            params![&task.trade_date, &task.exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if existing_log_id.is_some() {
        let has_imported_rows =
            storage_mode_has_imported_rows_for_date(&connection, &task.trade_date, &task.exchange)?;
        let has_stale_zero_volume_rows = storage_mode_has_stale_zero_volume_rows_for_date(
            &connection,
            &task.trade_date,
            &task.exchange,
        )?;

        if has_imported_rows && !has_stale_zero_volume_rows && task.mode != DownloadMode::Range {
            return Ok(StagedDownloadOutcome::Result(DownloadResult {
                success: true,
                trade_date: task.trade_date.clone(),
                exchange: task.exchange.clone(),
                rows_inserted: 0,
                max_volume: 0,
                message: "Already downloaded".to_string(),
            }));
        }
        // A replacement can update the successful log only after import.
    }
    drop(connection);

    if stop.is_requested() {
        return Ok(StagedDownloadOutcome::Cancelled);
    }
    if let Some(history_task) = &task.nse_index_history {
        return stage_nse_index_history_task(client, task, history_task);
    }

    let normal = stage_single_download(client, task, stop);
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
            Ok(None) => {},
            Err(error) => {
                let primary = match &normal {
                    Err(error) => error.as_str(),
                    Ok(StagedDownloadOutcome::Result(result)) => result.message.as_str(),
                    _ => "Official source unavailable",
                };
                return Err(format!("{primary}; automatic BSE browser fallback: {error}"));
            },
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
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            parsed
                .show_message
                .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
        )));
    }

    let rows = parsed.data.unwrap_or_default();
    if rows.is_empty() {
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            format!(
                "No NSE historical index API rows for {} {} to {}",
                history_task.index_type, history_task.from_date, history_task.to_date
            ),
        )));
    }

    let normalized =
        normalize_nse_index_history_rows(&rows, &history_task.symbol, &history_task.index_type);
    Ok(StagedDownloadOutcome::Ready(StagedDownload {
        task: task.clone(),
        content: StagedDownloadContent::NseIndexHistory(normalized),
    }))
}

fn candidate_scan_should_skip(
    exchange: &str,
    candidate_count: usize,
    soft_mismatch_count: usize,
    bse_api_reported_no_file: bool,
    has_hard_error: bool,
) -> bool {
    !has_hard_error
        && (soft_mismatch_count == candidate_count
            || (is_bse_exchange(exchange) && bse_api_reported_no_file))
}
fn stage_single_download(
    client: &Client,
    task: &DownloadTask,
    stop: &BatchStop,
) -> AppResult<StagedDownloadOutcome> {
    let mut last_hard_error: Option<String> = None;
    let mut primary_hard_error: Option<String> = None;
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(&task.exchange);
    let mut bse_api_reported_no_file = false;

    for (candidate_idx, candidate) in task.candidates.iter().enumerate() {
        if stop.is_requested() {
            return Ok(StagedDownloadOutcome::Cancelled);
        }
        match fetch_candidate_content_bytes(client, candidate, referer, 3) {
            Ok(Some(bytes)) => {
                let csv_content = if candidate.bse_index_archive_json {
                    match normalize_bse_index_archive_json(&bytes, &task.trade_date)? {
                        Some(content) => content,
                        None => {
                            not_found_count += 1;
                            continue;
                        }
                    }
                } else {
                    let csv_bytes = if candidate.zipped {
                        match extract_first_csv_from_zip(&bytes) {
                            Ok(Some(extracted)) => extracted,
                            Ok(None) => {
                                not_found_count += 1;
                                continue;
                            }
                            Err(error) => {
                                if candidate_idx == 0 {
                                    primary_hard_error = Some(error.clone());
                                }
                                last_hard_error = Some(error);
                                continue;
                            }
                        }
                    } else {
                        bytes
                    };
                    String::from_utf8_lossy(&csv_bytes).into_owned()
                };
                if is_html_response(&csv_content) {
                    last_hard_error = Some("Official source returned HTML instead of Bhavcopy data.".into());
                    continue;
                }
                if task.exchange == "NSE_INDEX" {
                    let validation = parse_bhavcopy_csv(&csv_content, &task.exchange, &task.trade_date, &[]);
                    let error = match validation {
                        Ok(parsed) => parsed.debug,
                        Err(error) => Some(error),
                    };
                    if let Some(error) = error {
                        last_hard_error = Some(format!("Index archive integrity: {error}"));
                        continue;
                    }
                }
                return Ok(StagedDownloadOutcome::Ready(StagedDownload {
                    task: task.clone(),
                    content: StagedDownloadContent::Csv(csv_content),
                }));
            }
            Ok(None) => {
                if is_bse_exchange(&task.exchange) && candidate.bse_response_key.is_some() {
                    bse_api_reported_no_file = true;
                }
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
        &task.exchange,
        task.candidates.len(),
        not_found_count,
        bse_api_reported_no_file,
        last_hard_error.is_some(),
    ) {
        let message = if is_bse_exchange(&task.exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (unavailable archive or source mismatch)",
                task.candidates.len()
            )
        } else {
            "No data available for this date (source unavailable or missing)".to_string()
        };
        return Ok(StagedDownloadOutcome::Result(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            message,
        )));
    }

    Ok(StagedDownloadOutcome::Result(DownloadResult {
        success: false,
        trade_date: task.trade_date.clone(),
        exchange: task.exchange.clone(),
        rows_inserted: 0,
        max_volume: 0,
        message: primary_hard_error.or(last_hard_error).unwrap_or_else(|| "Download failed".to_string()),
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
    let existing_log_id = connection
        .query_row(
            "
              SELECT id
              FROM download_log
              WHERE trade_date = ? AND exchange = ? AND status = 'ok'
              LIMIT 1
            ",
            params![&task.trade_date, &task.exchange],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(log_id) = existing_log_id {
        let has_imported_rows =
            storage_mode_has_imported_rows_for_date(&connection, &task.trade_date, &task.exchange)?;
        let has_stale_zero_volume_rows = storage_mode_has_stale_zero_volume_rows_for_date(
            &connection,
            &task.trade_date,
            &task.exchange,
        )?;

        if has_imported_rows && !has_stale_zero_volume_rows && task.mode != DownloadMode::Range {
            return Ok(DownloadResult {
                success: true,
                trade_date: task.trade_date.clone(),
                exchange: task.exchange.clone(),
                rows_inserted: 0,
                max_volume: 0,
                message: "Already downloaded".to_string(),
            });
        }
        {
            let _write_guard = lock_bhavcopy_write(write_lock)?;
            let _ = clear_download_log_entry(&connection, log_id);
        }
    }

    let result = download_single(
        client,
        database_file_path,
        &task.exchange,
        &task.trade_date,
        &task.candidates,
        excluded_series,
        write_lock,
    )?;

    if should_write_download_log(&result) {
        let _write_guard = lock_bhavcopy_write(write_lock)?;
        upsert_download_log_entry(&connection, &result)?;
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
        return Ok(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            parsed
                .show_message
                .unwrap_or_else(|| "NSE historical index API returned an error".to_string()),
        ));
    }

    let rows = parsed.data.unwrap_or_default();
    if rows.is_empty() {
        return Ok(skipped_download_result(
            &task.exchange,
            &task.trade_date,
            format!(
                "No NSE historical index API rows for {} {} to {}",
                history_task.index_type, history_task.from_date, history_task.to_date
            ),
        ));
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
    let mut not_found_count = 0_usize;
    let referer = bhavcopy_referer_for_exchange(exchange);
    let mut bse_api_reported_no_file = false;

    for (candidate_idx, candidate) in candidates.iter().enumerate() {
        match fetch_candidate_content_bytes(client, candidate, referer, 3) {
            Ok(Some(bytes)) => {
                let csv_content = if candidate.bse_index_archive_json {
                    match normalize_bse_index_archive_json(&bytes, trade_date)? {
                        Some(content) => content,
                        None => {
                            not_found_count += 1;
                            continue;
                        }
                    }
                } else {
                    let csv_bytes = if candidate.zipped {
                        match extract_first_csv_from_zip(&bytes) {
                            Ok(Some(extracted)) => extracted,
                            Ok(None) => {
                                not_found_count += 1;
                                continue;
                            }
                            Err(error) => {
                                if candidate_idx == 0 {
                                    primary_hard_error = Some(error.clone());
                                }
                                last_hard_error = Some(error);
                                continue;
                            }
                        }
                    } else {
                        bytes
                    };
                    String::from_utf8_lossy(&csv_bytes).into_owned()
                };
                if is_html_response(&csv_content) {
                    not_found_count += 1;
                    continue;
                }
                let parsed = {
                    let _write_guard = lock_bhavcopy_write(write_lock)?;
                    parse_and_insert(
                        database_file_path,
                        &csv_content,
                        exchange,
                        trade_date,
                        excluded_series,
                    )?
                };
                if parsed.rows_inserted == 0 {
                    if let Some(debug) = parsed.debug {
                        last_hard_error = Some(debug);
                        continue;
                    }
                }
                return Ok(DownloadResult {
                    success: true,
                    trade_date: trade_date.to_string(),
                    exchange: exchange.to_string(),
                    rows_inserted: parsed.rows_inserted,
                    max_volume: parsed.max_volume,
                    message: format!("Downloaded {} records", parsed.rows_inserted),
                });
            }
            Ok(None) => {
                if is_bse_exchange(exchange) && candidate.bse_response_key.is_some() {
                    bse_api_reported_no_file = true;
                }
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
        exchange,
        candidates.len(),
        not_found_count,
        bse_api_reported_no_file,
        last_hard_error.is_some(),
    ) {
        let message = if is_bse_exchange(exchange) {
            format!(
                "No downloadable BSE source found after trying {} candidates (unavailable archive or source mismatch)",
                candidates.len()
            )
        } else {
            "No data available for this date (source unavailable or missing)".to_string()
        };
        return Ok(skipped_download_result(exchange, trade_date, message));
    }

    Ok(DownloadResult {
        success: false,
        trade_date: trade_date.to_string(),
        exchange: exchange.to_string(),
        rows_inserted: 0,
        max_volume: 0,
        message: primary_hard_error.or(last_hard_error).unwrap_or_else(|| "Download failed".to_string()),
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

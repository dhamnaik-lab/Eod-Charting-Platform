use rusqlite::{params, params_from_iter, types::Value, Connection};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use super::binary_eod::{date_to_u32, u32_to_date, BinaryEodFile, EodRecord, DEFAULT_SCALE};
use super::eod_binary_state::{BinaryStateIndex, BinaryStateKey};
use super::{
    get_price_storage_mode, normalize_exchange, normalize_symbol, normalize_trade_date,
    run_connection_transaction, AppResult, DeleteQuoteDateInput, DeleteQuoteInput,
    DeleteQuoteRangeInput, DeleteQuoteResult, PriceStorageMode, QuoteDateListInput,
    QuoteInputPayload, QuoteListInput, QuoteRow,
};

#[derive(Clone, Debug)]
struct NormalizedQuoteInput {
    symbol: String,
    exchange: String,
    date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: i64,
    open_interest: i64,
}

#[derive(Clone, Debug)]
pub(super) struct QuoteDeleteProgress {
    pub processed_files: usize,
    pub total_files: usize,
    pub current_symbol: Option<String>,
}

#[derive(Clone, Debug, Default)]
struct BinaryDeleteBatchResult {
    deleted: i64,
    mutated_symbols: Vec<String>,
}

type QuoteDeleteProgressCallback<'a> = &'a (dyn Fn(QuoteDeleteProgress) + Sync);

fn symbol_from_eod_path(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}

fn emit_delete_progress(
    progress_callback: Option<QuoteDeleteProgressCallback<'_>>,
    processed_files: usize,
    total_files: usize,
    path: Option<&Path>,
) {
    if let Some(callback) = progress_callback {
        callback(QuoteDeleteProgress {
            processed_files,
            total_files,
            current_symbol: path.and_then(symbol_from_eod_path),
        });
    }
}

fn collect_binary_delete_targets(
    exchange_path: &Path,
    requested_symbols: Option<&Vec<String>>,
) -> AppResult<Vec<PathBuf>> {
    if let Some(symbols) = requested_symbols {
        return Ok(symbols
            .iter()
            .map(|symbol| exchange_path.join(format!("{}.eod", symbol)))
            .collect());
    }

    let paths = fs::read_dir(exchange_path)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("eod"))
        .collect::<Vec<_>>();
    Ok(paths)
}

fn delete_binary_records_for_path(
    path: &Path,
    start_date_u32: u32,
    end_date_u32: u32,
    single_date: bool,
) -> AppResult<i64> {
    if single_date {
        Ok(
            if BinaryEodFile::delete_record_by_date(path, start_date_u32)? {
                1
            } else {
                0
            },
        )
    } else {
        BinaryEodFile::delete_records_in_range(path, start_date_u32, end_date_u32)
    }
}

fn delete_binary_records_across_paths(
    paths: Vec<PathBuf>,
    start_date_u32: u32,
    end_date_u32: u32,
    single_date: bool,
    progress_callback: Option<QuoteDeleteProgressCallback<'_>>,
) -> AppResult<BinaryDeleteBatchResult> {
    if paths.is_empty() {
        return Ok(BinaryDeleteBatchResult::default());
    }

    let total_files = paths.len();
    emit_delete_progress(progress_callback, 0, total_files, None);

    let worker_count = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(4)
        .min(4)
        .min(total_files);

    if worker_count <= 1 || total_files <= 1 {
        let mut result = BinaryDeleteBatchResult::default();
        let mut processed_files = 0_usize;
        for path in paths {
            let deleted =
                delete_binary_records_for_path(&path, start_date_u32, end_date_u32, single_date)?;
            result.deleted += deleted;
            if deleted > 0 {
                if let Some(symbol) = symbol_from_eod_path(&path) {
                    result.mutated_symbols.push(symbol);
                }
            }
            processed_files += 1;
            emit_delete_progress(progress_callback, processed_files, total_files, Some(&path));
        }
        result.mutated_symbols.sort();
        result.mutated_symbols.dedup();
        return Ok(result);
    }

    let processed_files = AtomicUsize::new(0);
    let chunk_size = total_files.div_ceil(worker_count);
    std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for chunk in paths.chunks(chunk_size) {
            let chunk_paths = chunk.to_vec();
            let processed_files = &processed_files;
            handles.push(scope.spawn(move || -> AppResult<BinaryDeleteBatchResult> {
                let mut result = BinaryDeleteBatchResult::default();
                for path in chunk_paths {
                    let deleted = delete_binary_records_for_path(
                        &path,
                        start_date_u32,
                        end_date_u32,
                        single_date,
                    )?;
                    result.deleted += deleted;
                    if deleted > 0 {
                        if let Some(symbol) = symbol_from_eod_path(&path) {
                            result.mutated_symbols.push(symbol);
                        }
                    }
                    let processed = processed_files.fetch_add(1, Ordering::SeqCst) + 1;
                    emit_delete_progress(progress_callback, processed, total_files, Some(&path));
                }
                Ok(result)
            }));
        }

        let mut result = BinaryDeleteBatchResult::default();
        for handle in handles {
            let worker_result = handle
                .join()
                .map_err(|_| "Binary quote delete worker panicked.".to_string())?;
            let mut worker_result = worker_result?;
            result.deleted += worker_result.deleted;
            result.mutated_symbols.append(&mut worker_result.mutated_symbols);
        }
        result.mutated_symbols.sort();
        result.mutated_symbols.dedup();
        Ok(result)
    })
}

fn invalidate_binary_state_rows_after_mutation(
    base_path: &Path,
    exchange: &str,
    symbols: &[String],
) {
    if symbols.is_empty() {
        return;
    }

    let sidecar_path = BinaryStateIndex::sidecar_path_for(base_path);
    if !sidecar_path.is_file() {
        return;
    }

    let keys = symbols
        .iter()
        .map(|symbol| BinaryStateKey::new(exchange.to_string(), symbol.clone()))
        .collect::<Vec<_>>();

    let result = BinaryStateIndex::open_existing_read_write(base_path)
        .and_then(|mut index| index.remove_keys(&keys));
    if let Err(error) = result {
        // The sidecar is derived acceleration metadata. Quote mutation remains
        // authoritative; stale state will fail closed on physical identity checks.
        eprintln!(
            "Quote Editor localized EOD binary state invalidation failed for {} ({} symbol(s)): {}",
            exchange,
            symbols.len(),
            error
        );
    }
}

pub(super) fn list_quotes_internal(
    connection: &Connection,
    input: &QuoteListInput,
    base_path: Option<&Path>,
) -> AppResult<Vec<QuoteRow>> {
    let symbol = normalize_symbol(&input.symbol)?;
    let exchange = normalize_exchange(&input.exchange)?;
    let limit = input.limit.unwrap_or(500).clamp(25, 2_000) as usize;

    let storage_mode = get_price_storage_mode(connection);

    // 1. Load from Binary if exists
    let mut merged: HashMap<String, QuoteRow> = HashMap::new();
    if let Some(folder_path) = base_path {
        let bin_path = folder_path
            .join("eod_data")
            .join(&exchange)
            .join(format!("{}.eod", symbol));
        if bin_path.exists() {
            let bin_file = BinaryEodFile::open(&bin_path)?;
            let records = bin_file.read_latest(limit)?;
            let scale = bin_file.header.price_scale as f64;
            for r in records {
                let date_str = u32_to_date(r.date);
                merged.insert(
                    date_str.clone(),
                    QuoteRow {
                        symbol: symbol.clone(),
                        exchange: exchange.clone(),
                        date: date_str,
                        open: r.open as f64 / scale,
                        high: r.high as f64 / scale,
                        low: r.low as f64 / scale,
                        close: r.close as f64 / scale,
                        prev_close: Some(r.prev_close as f64 / scale),
                        volume: r.volume as i64,
                        open_interest: r.oi as i64,
                    },
                );
            }
        }
    }

    // 2. Load from SQLite (fallback/merge) in Hybrid mode
    if storage_mode == PriceStorageMode::Hybrid {
        let mut statement = connection
            .prepare(
                "
                  SELECT
                    symbol,
                    exchange,
                    date,
                    open,
                    high,
                    low,
                    close,
                    prev_close,
                    volume,
                    open_interest
                  FROM eod_prices
                  WHERE symbol = ?
                    AND exchange = ?
                  ORDER BY date DESC
                  LIMIT ?
                ",
            )
            .map_err(|error| error.to_string())?;

        let sql_rows = statement
            .query_map(params![symbol, exchange, limit], |row| {
                Ok(QuoteRow {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    date: row.get(2)?,
                    open: row.get(3)?,
                    high: row.get(4)?,
                    low: row.get(5)?,
                    close: row.get(6)?,
                    prev_close: row.get(7)?,
                    volume: row.get(8)?,
                    open_interest: row.get(9).unwrap_or(0),
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        // Add SQLite rows only if not already present from binary (binary takes priority)
        for row in sql_rows {
            merged.entry(row.date.clone()).or_insert(row);
        }
    }

    let mut final_rows: Vec<QuoteRow> = merged.into_values().collect();

    // Sort descending by date (matches existing behavior)
    final_rows.sort_by(|a, b| b.date.cmp(&a.date));

    // Apply limit
    final_rows.truncate(limit);

    Ok(final_rows)
}

const QUOTE_EDITOR_EXCHANGES: [&str; 5] = ["NSE", "NSE_INDEX", "BSE", "BSE_INDEX", "MCX"];

pub(super) fn quote_editor_exchange_targets(scope: &str) -> AppResult<Vec<String>> {
    let normalized = scope.trim().to_uppercase().replace('-', "_");
    if normalized == "ALL" {
        return Ok(QUOTE_EDITOR_EXCHANGES
            .iter()
            .map(|exchange| (*exchange).to_string())
            .collect());
    }

    if QUOTE_EDITOR_EXCHANGES.contains(&normalized.as_str()) {
        return Ok(vec![normalized]);
    }

    Err(format!("Unsupported Quote Editor exchange scope: {scope}"))
}

pub(super) fn list_quotes_by_date_scope_internal(
    connection: &Connection,
    input: &QuoteDateListInput,
    base_path: Option<&Path>,
) -> AppResult<Vec<QuoteRow>> {
    let targets = quote_editor_exchange_targets(&input.exchange)?;
    if targets.len() == 1 {
        let mut concrete = input.clone();
        concrete.exchange = targets[0].clone();
        return list_quotes_by_date_internal(connection, &concrete, base_path);
    }

    let limit = input.limit.unwrap_or(10_000).clamp(25, 50_000) as usize;
    let mut rows = Vec::new();
    for exchange in targets {
        let mut concrete = input.clone();
        concrete.exchange = exchange;
        concrete.limit = Some(limit as u32);
        rows.extend(list_quotes_by_date_internal(
            connection, &concrete, base_path,
        )?);
    }

    rows.sort_by(|left, right| {
        left.exchange
            .cmp(&right.exchange)
            .then_with(|| left.symbol.cmp(&right.symbol))
    });
    rows.truncate(limit);
    Ok(rows)
}

pub(super) fn list_quotes_by_date_internal(
    connection: &Connection,
    input: &QuoteDateListInput,
    base_path: Option<&Path>,
) -> AppResult<Vec<QuoteRow>> {
    let exchange = normalize_exchange(&input.exchange)?;
    let date = normalize_trade_date(&input.date)?;
    let limit = input.limit.unwrap_or(10_000).clamp(100, 20_000) as usize;
    let storage_mode = get_price_storage_mode(connection);
    let mut merged = HashMap::<String, QuoteRow>::new();

    if let Some(folder_path) = base_path {
        let exchange_path = folder_path.join("eod_data").join(&exchange);
        if exchange_path.exists() {
            let target_date = date_to_u32(&date);
            for entry in fs::read_dir(&exchange_path).map_err(|error| error.to_string())? {
                let entry = entry.map_err(|error| error.to_string())?;
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) != Some("eod") {
                    continue;
                }

                let bin_file = BinaryEodFile::open(&path)?;
                let records = bin_file.read_range(target_date, target_date)?;
                if let Some(record) = records.into_iter().next() {
                    let scale = bin_file.header.price_scale as f64;
                    let symbol = bin_file.header.symbol.clone();
                    merged.insert(
                        symbol.clone(),
                        QuoteRow {
                            symbol,
                            exchange: exchange.clone(),
                            date: date.clone(),
                            open: record.open as f64 / scale,
                            high: record.high as f64 / scale,
                            low: record.low as f64 / scale,
                            close: record.close as f64 / scale,
                            prev_close: Some(record.prev_close as f64 / scale),
                            volume: record.volume as i64,
                            open_interest: record.oi as i64,
                        },
                    );
                }
            }
        }
    }

    if storage_mode == PriceStorageMode::Hybrid {
        let mut statement = connection
            .prepare(
                "
                  SELECT
                    symbol,
                    exchange,
                    date,
                    open,
                    high,
                    low,
                    close,
                    prev_close,
                    volume,
                    open_interest
                  FROM eod_prices
                  WHERE exchange = ?
                    AND date = ?
                  ORDER BY symbol ASC
                  LIMIT ?
                ",
            )
            .map_err(|error| error.to_string())?;
        let sql_rows = statement
            .query_map(params![exchange, date, limit], |row| {
                Ok(QuoteRow {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    date: row.get(2)?,
                    open: row.get(3)?,
                    high: row.get(4)?,
                    low: row.get(5)?,
                    close: row.get(6)?,
                    prev_close: row.get(7)?,
                    volume: row.get(8)?,
                    open_interest: row.get(9).unwrap_or(0),
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        for row in sql_rows {
            merged.entry(row.symbol.clone()).or_insert(row);
        }
    }

    let mut final_rows: Vec<QuoteRow> = merged.into_values().collect();
    final_rows.sort_by(|a, b| a.symbol.cmp(&b.symbol));
    final_rows.truncate(limit);
    Ok(final_rows)
}

pub(super) fn upsert_quote_internal(
    connection: &Connection,
    input: &QuoteInputPayload,
    base_path: Option<&Path>,
) -> AppResult<QuoteRow> {
    let quote = normalize_quote_input(input)?;

    run_connection_transaction(connection, |connection| {
        connection
            .execute(
                "
                  INSERT INTO instruments (symbol, exchange, name, updated_at)
                  VALUES (?, ?, ?, datetime('now'))
                  ON CONFLICT(symbol, exchange) DO UPDATE SET
                    updated_at = excluded.updated_at
                ",
                params![quote.symbol, quote.exchange, quote.symbol],
            )
            .map_err(|error| error.to_string())?;

        connection
            .execute(
                "
                  INSERT INTO eod_prices (
                    symbol,
                    exchange,
                    date,
                    open,
                    high,
                    low,
                    close,
                    volume,
                    open_interest
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(symbol, exchange, date) DO UPDATE SET
                    open = excluded.open,
                    high = excluded.high,
                    low = excluded.low,
                    close = excluded.close,
                    volume = excluded.volume,
                    open_interest = excluded.open_interest
                ",
                params![
                    quote.symbol,
                    quote.exchange,
                    quote.date,
                    quote.open,
                    quote.high,
                    quote.low,
                    quote.close,
                    quote.volume,
                    quote.open_interest,
                ],
            )
            .map_err(|error| error.to_string())?;

        recompute_prev_close_for_symbol(connection, &quote.symbol, &quote.exchange)?;
        Ok(())
    })?;

    let final_row = connection
        .query_row(
            "
              SELECT
                symbol,
                exchange,
                date,
                open,
                high,
                low,
                close,
                prev_close,
                volume,
                open_interest
              FROM eod_prices
              WHERE symbol = ?
                AND exchange = ?
                AND date = ?
            ",
            params![quote.symbol, quote.exchange, quote.date],
            |row| {
                Ok(QuoteRow {
                    symbol: row.get(0)?,
                    exchange: row.get(1)?,
                    date: row.get(2)?,
                    open: row.get(3)?,
                    high: row.get(4)?,
                    low: row.get(5)?,
                    close: row.get(6)?,
                    prev_close: row.get(7)?,
                    volume: row.get(8)?,
                    open_interest: row.get(9).unwrap_or(0),
                })
            },
        )
        .map_err(|error| error.to_string())?;

    // Dual-write to Binary EOD
    if let Some(folder_path) = base_path {
        let bin_path = folder_path
            .join("eod_data")
            .join(&final_row.exchange)
            .join(format!("{}.eod", final_row.symbol));
        let record = EodRecord {
            date: date_to_u32(&final_row.date),
            flags: 0,
            open: (final_row.open * DEFAULT_SCALE as f64).round() as i64,
            high: (final_row.high * DEFAULT_SCALE as f64).round() as i64,
            low: (final_row.low * DEFAULT_SCALE as f64).round() as i64,
            close: (final_row.close * DEFAULT_SCALE as f64).round() as i64,
            prev_close: (final_row.prev_close.unwrap_or(0.0) * DEFAULT_SCALE as f64).round() as i64,
            volume: final_row.volume as u64,
            oi: final_row.open_interest as u64,
        };

        match BinaryEodFile::append_or_merge_records(
            &bin_path,
            &final_row.symbol,
            &final_row.exchange,
            DEFAULT_SCALE,
            vec![record],
        ) {
            Ok(_) => invalidate_binary_state_rows_after_mutation(
                folder_path,
                &final_row.exchange,
                std::slice::from_ref(&final_row.symbol),
            ),
            Err(e) => {
                eprintln!(
                    "Binary EOD manual upsert failure for {}:{}: {}",
                    final_row.exchange, final_row.symbol, e
                );
            }
        }
    }

    Ok(final_row)
}


const QUOTE_EDITOR_DOWNLOAD_LOG_INVALIDATION_NOTE: &str =
    "Quote Editor deletion invalidated imported quote coverage.";

fn download_log_table_exists(connection: &Connection) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'download_log')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}

fn invalidate_download_log_for_deleted_quote_range(
    connection: &Connection,
    exchange: &str,
    start_date: &str,
    end_date: &str,
) -> AppResult<usize> {
    if !download_log_table_exists(connection)? {
        return Ok(0);
    }

    connection
        .execute(
            "
              UPDATE download_log
              SET status = 'invalidated',
                  note = CASE
                    WHEN note IS NULL OR TRIM(note) = '' THEN ?
                    WHEN INSTR(LOWER(note), LOWER(?)) > 0 THEN note
                    ELSE note || ' | ' || ?
                  END
              WHERE exchange = ?
                AND trade_date >= ?
                AND trade_date <= ?
                AND status = 'ok'
            ",
            params![
                QUOTE_EDITOR_DOWNLOAD_LOG_INVALIDATION_NOTE,
                QUOTE_EDITOR_DOWNLOAD_LOG_INVALIDATION_NOTE,
                QUOTE_EDITOR_DOWNLOAD_LOG_INVALIDATION_NOTE,
                exchange,
                start_date,
                end_date,
            ],
        )
        .map_err(|error| error.to_string())
}

pub(super) fn delete_quote_internal(
    connection: &Connection,
    input: &DeleteQuoteInput,
    base_path: Option<&Path>,
) -> AppResult<DeleteQuoteResult> {
    let symbol = normalize_symbol(&input.symbol)?;
    let exchange = normalize_exchange(&input.exchange)?;
    let date = normalize_trade_date(&input.date)?;
    let mut deleted_sqlite = 0_i64;

    run_connection_transaction(connection, |connection| {
        deleted_sqlite = connection
            .execute(
                "
                  DELETE FROM eod_prices
                  WHERE symbol = ?
                    AND exchange = ?
                    AND date = ?
                ",
                params![symbol, exchange, date],
            )
            .map_err(|error| error.to_string())? as i64;
        recompute_prev_close_for_symbol(connection, &symbol, &exchange)?;
        Ok(())
    })?;

    let mut deleted_binary = false;
    // Dual-delete from Binary EOD
    if let Some(folder_path) = base_path {
        let bin_path = folder_path
            .join("eod_data")
            .join(&exchange)
            .join(format!("{}.eod", symbol));
        deleted_binary = BinaryEodFile::delete_record_by_date(&bin_path, date_to_u32(&date))?;
        if deleted_binary {
            invalidate_binary_state_rows_after_mutation(
                folder_path,
                &exchange,
                std::slice::from_ref(&symbol),
            );
        }
    }

    let deleted = if deleted_sqlite > 0 {
        deleted_sqlite
    } else if deleted_binary {
        1
    } else {
        0
    };

    if deleted > 0 {
        invalidate_download_log_for_deleted_quote_range(
            connection,
            &exchange,
            &date,
            &date,
        )?;
    }

    Ok(DeleteQuoteResult {
        success: deleted > 0,
        deleted,
    })
}

pub(super) fn delete_quote_range_internal(
    connection: &Connection,
    input: &DeleteQuoteRangeInput,
    base_path: Option<&Path>,
) -> AppResult<DeleteQuoteResult> {
    let symbol = normalize_symbol(&input.symbol)?;
    let exchange = normalize_exchange(&input.exchange)?;
    let from_date = normalize_trade_date(&input.from_date)?;
    let to_date = normalize_trade_date(&input.to_date)?;
    let (start_date, end_date) = if from_date <= to_date {
        (from_date, to_date)
    } else {
        (to_date, from_date)
    };

    let mut deleted_sqlite = 0_i64;
    run_connection_transaction(connection, |connection| {
        deleted_sqlite = connection
            .execute(
                "
                  DELETE FROM eod_prices
                  WHERE symbol = ?
                    AND exchange = ?
                    AND date >= ?
                    AND date <= ?
                ",
                params![symbol, exchange, start_date, end_date],
            )
            .map_err(|error| error.to_string())? as i64;
        recompute_prev_close_for_symbol(connection, &symbol, &exchange)?;
        Ok(())
    })?;

    let mut deleted_binary = 0_i64;
    if let Some(folder_path) = base_path {
        let bin_path = folder_path
            .join("eod_data")
            .join(&exchange)
            .join(format!("{}.eod", symbol));
        deleted_binary = BinaryEodFile::delete_records_in_range(
            &bin_path,
            date_to_u32(&start_date),
            date_to_u32(&end_date),
        )?;
        if deleted_binary > 0 {
            invalidate_binary_state_rows_after_mutation(
                folder_path,
                &exchange,
                std::slice::from_ref(&symbol),
            );
        }
    }

    let deleted = deleted_sqlite.max(deleted_binary);
    if deleted > 0 {
        invalidate_download_log_for_deleted_quote_range(
            connection,
            &exchange,
            &start_date,
            &end_date,
        )?;
    }

    Ok(DeleteQuoteResult {
        success: deleted > 0,
        deleted,
    })
}

pub(super) fn delete_quote_date_internal(
    connection: &Connection,
    input: &DeleteQuoteDateInput,
    base_path: Option<&Path>,
    progress_callback: Option<QuoteDeleteProgressCallback<'_>>,
) -> AppResult<DeleteQuoteResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    let date = normalize_trade_date(&input.date)?;
    let to_date = input
        .to_date
        .as_ref()
        .map(|value| normalize_trade_date(value))
        .transpose()?
        .unwrap_or_else(|| date.clone());
    let (start_date, end_date) = if date <= to_date {
        (date, to_date)
    } else {
        (to_date, date)
    };
    let single_date = start_date == end_date;
    let requested_symbols = input
        .symbols
        .as_ref()
        .filter(|symbols| !symbols.is_empty())
        .map(|symbols| {
            symbols
                .iter()
                .map(|symbol| normalize_symbol(symbol))
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;

    let affected_symbols = if let Some(symbols) = requested_symbols.clone() {
        symbols
    } else {
        let mut statement = connection
            .prepare(
                "
                  SELECT DISTINCT symbol
                  FROM eod_prices
                  WHERE exchange = ?
                    AND date >= ?
                    AND date <= ?
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![exchange, start_date, end_date], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        if !rows.is_empty() {
            rows
        } else if let Some(folder_path) = base_path {
            let exchange_path = folder_path.join("eod_data").join(&exchange);
            if exchange_path.exists() {
                fs::read_dir(&exchange_path)
                    .map_err(|error| error.to_string())?
                    .filter_map(|entry| entry.ok())
                    .map(|entry| entry.path())
                    .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("eod"))
                    .filter_map(|path| {
                        path.file_stem()
                            .and_then(|value| value.to_str())
                            .map(|value| value.to_string())
                    })
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        }
    };

    if affected_symbols.is_empty() {
        return Ok(DeleteQuoteResult {
            success: false,
            deleted: 0,
        });
    }

    let mut deleted_sqlite = 0_i64;
    run_connection_transaction(connection, |connection| {
        deleted_sqlite = if let Some(symbols) = requested_symbols.as_ref() {
            let placeholders = std::iter::repeat_n("?", symbols.len())
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                "
                  DELETE FROM eod_prices
                  WHERE exchange = ?
                    AND date >= ?
                    AND date <= ?
                    AND symbol IN ({})
                ",
                placeholders
            );
            let mut values = vec![
                Value::from(exchange.clone()),
                Value::from(start_date.clone()),
                Value::from(end_date.clone()),
            ];
            values.extend(symbols.iter().cloned().map(Value::from));
            connection
                .execute(&sql, params_from_iter(values))
                .map_err(|error| error.to_string())? as i64
        } else {
            connection
                .execute(
                    "
                  DELETE FROM eod_prices
                  WHERE exchange = ?
                    AND date >= ?
                    AND date <= ?
                    ",
                    params![exchange, start_date, end_date],
                )
                .map_err(|error| error.to_string())? as i64
        };

        for symbol in &affected_symbols {
            recompute_prev_close_for_symbol(connection, symbol, &exchange)?;
        }
        Ok(())
    })?;

    let mut deleted_binary = 0_i64;
    if let Some(folder_path) = base_path {
        let exchange_path = folder_path.join("eod_data").join(&exchange);
        if exchange_path.exists() {
            let start_date_u32 = date_to_u32(&start_date);
            let end_date_u32 = date_to_u32(&end_date);
            let target_paths =
                collect_binary_delete_targets(&exchange_path, requested_symbols.as_ref())?;
            let binary_result = delete_binary_records_across_paths(
                target_paths,
                start_date_u32,
                end_date_u32,
                single_date,
                progress_callback,
            )?;
            deleted_binary = binary_result.deleted;
            invalidate_binary_state_rows_after_mutation(
                folder_path,
                &exchange,
                &binary_result.mutated_symbols,
            );
        }
    }

    let deleted = deleted_sqlite.max(deleted_binary);
    if deleted > 0 {
        invalidate_download_log_for_deleted_quote_range(
            connection,
            &exchange,
            &start_date,
            &end_date,
        )?;
    }

    Ok(DeleteQuoteResult {
        success: deleted > 0,
        deleted,
    })
}

#[derive(Clone, Debug)]
pub(super) struct DeleteQuoteDateScopeResult {
    pub result: DeleteQuoteResult,
    pub exchange_deleted: Vec<(String, i64)>,
}

pub(super) fn delete_quote_date_scope_internal(
    connection: &Connection,
    input: &DeleteQuoteDateInput,
    base_path: Option<&Path>,
    progress_callback: Option<QuoteDeleteProgressCallback<'_>>,
) -> AppResult<DeleteQuoteDateScopeResult> {
    let targets = quote_editor_exchange_targets(&input.exchange)?;
    if targets.len() == 1 {
        let mut concrete = input.clone();
        concrete.exchange = targets[0].clone();
        let result =
            delete_quote_date_internal(connection, &concrete, base_path, progress_callback)?;
        return Ok(DeleteQuoteDateScopeResult {
            exchange_deleted: vec![(targets[0].clone(), result.deleted)],
            result,
        });
    }

    let requested_symbols = input
        .symbols
        .as_ref()
        .filter(|symbols| !symbols.is_empty())
        .cloned();

    let target_file_counts = if let Some(folder_path) = base_path {
        targets
            .iter()
            .map(|exchange| {
                let exchange_path = folder_path.join("eod_data").join(exchange);
                if !exchange_path.exists() {
                    return Ok(0_usize);
                }
                collect_binary_delete_targets(&exchange_path, requested_symbols.as_ref())
                    .map(|paths| paths.len())
            })
            .collect::<AppResult<Vec<_>>>()?
    } else {
        vec![0; targets.len()]
    };
    let total_files: usize = target_file_counts.iter().sum();

    let mut total_deleted = 0_i64;
    let mut exchange_deleted = Vec::with_capacity(targets.len());
    let mut processed_offset = 0_usize;

    for (index, exchange) in targets.iter().enumerate() {
        let mut concrete = input.clone();
        concrete.exchange = exchange.clone();

        let target_file_count = target_file_counts[index];
        let scoped_progress = |progress: QuoteDeleteProgress| {
            if let Some(callback) = progress_callback {
                let current_symbol = progress
                    .current_symbol
                    .map(|symbol| format!("{exchange}:{symbol}"));
                callback(QuoteDeleteProgress {
                    processed_files: processed_offset
                        + progress.processed_files.min(target_file_count),
                    total_files,
                    current_symbol,
                });
            }
        };

        let result = delete_quote_date_internal(
            connection,
            &concrete,
            base_path,
            if total_files > 0 {
                Some(&scoped_progress)
            } else {
                None
            },
        )?;
        total_deleted += result.deleted;
        exchange_deleted.push((exchange.clone(), result.deleted));
        processed_offset += target_file_count;
    }

    Ok(DeleteQuoteDateScopeResult {
        result: DeleteQuoteResult {
            success: total_deleted > 0,
            deleted: total_deleted,
        },
        exchange_deleted,
    })
}

pub(super) fn recompute_prev_close_for_symbol(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
) -> AppResult<()> {
    let mut statement = connection
        .prepare(
            "
              SELECT date, close
              FROM eod_prices
              WHERE symbol = ?
                AND exchange = ?
              ORDER BY date ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![symbol, exchange], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut previous_close: Option<f64> = None;
    for (date, close) in rows {
        connection
            .execute(
                "
                  UPDATE eod_prices
                  SET prev_close = ?
                  WHERE symbol = ?
                    AND exchange = ?
                    AND date = ?
                ",
                params![previous_close, symbol, exchange, date],
            )
            .map_err(|error| error.to_string())?;
        previous_close = Some(close);
    }

    Ok(())
}

fn normalize_quote_input(input: &QuoteInputPayload) -> AppResult<NormalizedQuoteInput> {
    let symbol = normalize_symbol(&input.symbol)?;
    let exchange = normalize_exchange(&input.exchange)?;
    let date = normalize_trade_date(&input.date)?;
    let open = input.open;
    let high = input.high;
    let low = input.low;
    let close = input.close;
    let volume = input.volume.round().max(0.0) as i64;
    let open_interest = input.open_interest.unwrap_or(0.0).round().max(0.0) as i64;

    if ![open, high, low, close]
        .iter()
        .all(|value| value.is_finite())
    {
        return Err("Open, high, low, and close must be valid numbers.".to_string());
    }

    if ![open, high, low, close].iter().all(|value| *value > 0.0) {
        return Err("Open, high, low, and close must be greater than zero.".to_string());
    }

    if high < open.max(close).max(low) || low > open.min(close).min(high) {
        return Err("High/low values do not match the selected OHLC values.".to_string());
    }

    if !input.volume.is_finite() {
        return Err("Volume must be a valid number.".to_string());
    }

    Ok(NormalizedQuoteInput {
        symbol,
        exchange,
        date,
        open,
        high,
        low,
        close,
        volume,
        open_interest,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{
        set_price_storage_mode, DeleteQuoteDateInput, DeleteQuoteInput, DeleteQuoteRangeInput,
        QuoteDateListInput,
    };
    use rusqlite::params;
    use std::fs;
    use tempfile::tempdir;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE instruments (symbol TEXT, exchange TEXT, name TEXT, updated_at TEXT, PRIMARY KEY(symbol, exchange))",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (
                symbol TEXT,
                exchange TEXT,
                date TEXT,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                prev_close REAL,
                volume INTEGER,
                open_interest INTEGER,
                PRIMARY KEY(symbol, exchange, date)
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_list_quotes_hybrid_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();

        // Add SQLite data
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-15", 100.0, 110.0, 90.0, 105.0, 1000],
        ).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        // Add Binary data
        let bin_path = eod_dir.join("TEST.eod");
        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 11000,
            high: 12000,
            low: 10500,
            close: 11500,
            prev_close: 10500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let input = QuoteListInput {
            symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            limit: None,
        };

        let quotes = list_quotes_internal(&conn, &input, Some(dir.path())).unwrap();

        // Hybrid should see both
        assert_eq!(quotes.len(), 2);
        assert_eq!(quotes[0].date, "2024-05-16"); // Descending order
        assert_eq!(quotes[1].date, "2024-05-15");
    }

    #[test]
    fn test_normalize_quote_input_rejects_zero_ohlc() {
        let result = normalize_quote_input(&QuoteInputPayload {
            symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            date: "2026-06-28".to_string(),
            open: 0.0,
            high: 0.0,
            low: 0.0,
            close: 0.0,
            volume: 0.0,
            open_interest: Some(0.0),
        });

        assert_eq!(
            result.unwrap_err(),
            "Open, high, low, and close must be greater than zero."
        );
    }

    #[test]
    fn test_list_quotes_binary_mode() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        // Add SQLite data
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-15", 100.0, 110.0, 90.0, 105.0, 1000],
        ).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        // Add Binary data
        let bin_path = eod_dir.join("TEST.eod");
        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 11000,
            high: 12000,
            low: 10500,
            close: 11500,
            prev_close: 10500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let input = QuoteListInput {
            symbol: "TEST".to_string(),
            exchange: "NSE".to_string(),
            limit: None,
        };

        let quotes = list_quotes_internal(&conn, &input, Some(dir.path())).unwrap();

        // Binary should see only binary
        assert_eq!(quotes.len(), 1);
        assert_eq!(quotes[0].date, "2024-05-16");
    }

    #[test]
    fn test_list_quotes_by_date_internal_binary_mode_loads_multiple_symbols() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let mut alpha_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9500,
            close: 10500,
            prev_close: 9800,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &eod_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut alpha_records,
        )
        .unwrap();

        let mut beta_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 20000,
            high: 21000,
            low: 19000,
            close: 20500,
            prev_close: 19800,
            volume: 2000,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &eod_dir.join("BETA.eod"),
            "BETA",
            "NSE",
            100,
            &mut beta_records,
        )
        .unwrap();

        let quotes = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();

        assert_eq!(quotes.len(), 2);
        assert_eq!(quotes[0].symbol, "ALPHA");
        assert_eq!(quotes[1].symbol, "BETA");
    }

    #[test]
    fn test_delete_quote_range_internal_hybrid_removes_selected_dates() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Hybrid).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");

        let mut records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 10000,
                high: 11000,
                low: 9000,
                close: 10500,
                prev_close: 9500,
                volume: 1000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 11000,
                high: 12000,
                low: 10500,
                close: 11500,
                prev_close: 10500,
                volume: 1001,
                oi: 0,
            },
            EodRecord {
                date: 20240517,
                flags: 0,
                open: 12000,
                high: 13000,
                low: 11500,
                close: 12500,
                prev_close: 11500,
                volume: 1002,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-15", 100.0, 110.0, 90.0, 105.0, 95.0, 1000, 0],
        ).unwrap();
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-16", 110.0, 120.0, 105.0, 115.0, 105.0, 1001, 0],
        ).unwrap();
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, open, high, low, close, prev_close, volume, open_interest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params!["TEST", "NSE", "2024-05-17", 120.0, 130.0, 115.0, 125.0, 115.0, 1002, 0],
        ).unwrap();

        let result = delete_quote_range_internal(
            &conn,
            &DeleteQuoteRangeInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                from_date: "2024-05-15".to_string(),
                to_date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 2);

        let quotes = list_quotes_internal(
            &conn,
            &QuoteListInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(quotes.len(), 1);
        assert_eq!(quotes[0].date, "2024-05-17");
    }

    #[test]
    fn test_delete_quote_internal_binary_mode_removes_single_binary_row() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");

        let mut records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 10000,
                high: 11000,
                low: 9000,
                close: 10500,
                prev_close: 9500,
                volume: 1000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 11000,
                high: 12000,
                low: 10500,
                close: 11500,
                prev_close: 10500,
                volume: 1001,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 1);

        let quotes = list_quotes_internal(
            &conn,
            &QuoteListInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(quotes.len(), 1);
        assert_eq!(quotes[0].date, "2024-05-15");
    }

    #[test]
    fn test_delete_quote_date_internal_binary_mode_removes_selected_day_across_symbols() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let mut alpha_records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 10000,
                high: 11000,
                low: 9500,
                close: 10500,
                prev_close: 9800,
                volume: 1000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 10100,
                high: 11100,
                low: 9600,
                close: 10600,
                prev_close: 10500,
                volume: 1001,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(
            &eod_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut alpha_records,
        )
        .unwrap();

        let mut beta_records = vec![
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 20000,
                high: 21000,
                low: 19000,
                close: 20500,
                prev_close: 19800,
                volume: 2000,
                oi: 0,
            },
            EodRecord {
                date: 20240517,
                flags: 0,
                open: 20100,
                high: 21100,
                low: 19100,
                close: 20600,
                prev_close: 20500,
                volume: 2001,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(
            &eod_dir.join("BETA.eod"),
            "BETA",
            "NSE",
            100,
            &mut beta_records,
        )
        .unwrap();

        let progress_updates = std::sync::Mutex::new(Vec::<QuoteDeleteProgress>::new());
        let result = delete_quote_date_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: None,
            },
            Some(dir.path()),
            Some(&|progress| progress_updates.lock().unwrap().push(progress)),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 2);
        let progress_updates = progress_updates.into_inner().unwrap();
        assert!(progress_updates
            .iter()
            .any(|progress| progress.total_files == 2 && progress.processed_files == 0));
        assert!(progress_updates
            .iter()
            .any(|progress| progress.total_files == 2 && progress.processed_files == 2));
        assert!(progress_updates.iter().any(|progress| progress
            .current_symbol
            .as_deref()
            .is_some_and(|symbol| symbol == "ALPHA" || symbol == "BETA")));

        let remaining = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(remaining.is_empty());
    }

    #[test]
    fn test_delete_quote_date_internal_binary_mode_targets_loaded_symbols_only() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let mut alpha_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10100,
            high: 11100,
            low: 9600,
            close: 10600,
            prev_close: 10500,
            volume: 1001,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &eod_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut alpha_records,
        )
        .unwrap();

        let mut beta_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 20100,
            high: 21100,
            low: 19100,
            close: 20600,
            prev_close: 20500,
            volume: 2001,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &eod_dir.join("BETA.eod"),
            "BETA",
            "NSE",
            100,
            &mut beta_records,
        )
        .unwrap();

        let result = delete_quote_date_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: Some(vec!["ALPHA".to_string()]),
            },
            Some(dir.path()),
            None,
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 1);

        let remaining = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].symbol, "BETA");
    }

    #[test]
    fn test_delete_quote_date_internal_binary_mode_removes_selected_range_across_symbols() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let mut alpha_records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 10000,
                high: 11000,
                low: 9500,
                close: 10500,
                prev_close: 9800,
                volume: 1000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 10100,
                high: 11100,
                low: 9600,
                close: 10600,
                prev_close: 10500,
                volume: 1001,
                oi: 0,
            },
            EodRecord {
                date: 20240517,
                flags: 0,
                open: 10200,
                high: 11200,
                low: 9700,
                close: 10700,
                prev_close: 10600,
                volume: 1002,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(
            &eod_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut alpha_records,
        )
        .unwrap();

        let mut beta_records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 20000,
                high: 21000,
                low: 19000,
                close: 20500,
                prev_close: 19800,
                volume: 2000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 20100,
                high: 21100,
                low: 19100,
                close: 20600,
                prev_close: 20500,
                volume: 2001,
                oi: 0,
            },
            EodRecord {
                date: 20240517,
                flags: 0,
                open: 20200,
                high: 21200,
                low: 19200,
                close: 20700,
                prev_close: 20600,
                volume: 2002,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(
            &eod_dir.join("BETA.eod"),
            "BETA",
            "NSE",
            100,
            &mut beta_records,
        )
        .unwrap();

        let result = delete_quote_date_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "NSE".to_string(),
                date: "2024-05-15".to_string(),
                to_date: Some("2024-05-16".to_string()),
                symbols: None,
            },
            Some(dir.path()),
            None,
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 4);

        let remaining_15 = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-15".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(remaining_15.is_empty());

        let remaining_16 = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(remaining_16.is_empty());

        let remaining_17 = list_quotes_by_date_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "NSE".to_string(),
                date: "2024-05-17".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(remaining_17.len(), 2);
    }
    #[test]
    fn test_delete_quote_range_keeps_instrument_when_last_quote_is_removed() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        conn.execute(
            "INSERT INTO instruments (symbol, exchange, name) VALUES ('ONLY', 'NSE', 'ONLY')",
            [],
        )
        .unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("ONLY.eod");
        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9500,
            close: 10500,
            prev_close: 9800,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "ONLY", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_range_internal(
            &conn,
            &DeleteQuoteRangeInput {
                symbol: "ONLY".to_string(),
                exchange: "NSE".to_string(),
                from_date: "2024-05-16".to_string(),
                to_date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.deleted, 1);
        assert!(!bin_path.exists());
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM instruments WHERE symbol='ONLY' AND exchange='NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 1,
            "Quotation deletion must not remove instrument identity"
        );
    }

    #[test]
    fn test_quote_editor_exchange_scope_all_is_bounded_and_includes_future_mcx() {
        let exchanges = quote_editor_exchange_targets("ALL").unwrap();
        assert_eq!(
            exchanges,
            vec![
                "NSE".to_string(),
                "NSE_INDEX".to_string(),
                "BSE".to_string(),
                "BSE_INDEX".to_string(),
                "MCX".to_string(),
            ]
        );

        assert_eq!(
            quote_editor_exchange_targets("NSE-INDEX").unwrap(),
            vec!["NSE_INDEX".to_string()]
        );
        assert_eq!(
            quote_editor_exchange_targets("BSE_INDEX").unwrap(),
            vec!["BSE_INDEX".to_string()]
        );
    }

    #[test]
    fn test_quote_editor_exchange_scope_all_date_load_preserves_exchange_identity() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let nse_dir = dir.path().join("eod_data").join("NSE");
        let bse_index_dir = dir.path().join("eod_data").join("BSE_INDEX");
        fs::create_dir_all(&nse_dir).unwrap();
        fs::create_dir_all(&bse_index_dir).unwrap();

        let mut nse_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9500,
            close: 10500,
            prev_close: 9800,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &nse_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut nse_records,
        )
        .unwrap();

        let mut bse_index_records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 20000,
            high: 21000,
            low: 19500,
            close: 20500,
            prev_close: 19800,
            volume: 2000,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &bse_index_dir.join("ALPHA.eod"),
            "ALPHA",
            "BSE_INDEX",
            100,
            &mut bse_index_records,
        )
        .unwrap();

        let rows = list_quotes_by_date_scope_internal(
            &conn,
            &QuoteDateListInput {
                exchange: "ALL".to_string(),
                date: "2024-05-16".to_string(),
                limit: None,
            },
            Some(dir.path()),
        )
        .unwrap();

        assert_eq!(rows.len(), 2);
        assert!(rows
            .iter()
            .any(|row| row.exchange == "NSE" && row.symbol == "ALPHA"));
        assert!(rows
            .iter()
            .any(|row| row.exchange == "BSE_INDEX" && row.symbol == "ALPHA"));
    }

    #[test]
    fn test_quote_editor_exchange_scope_all_delete_reports_per_exchange_counts() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();

        let dir = tempdir().unwrap();
        let nse_dir = dir.path().join("eod_data").join("NSE");
        let bse_dir = dir.path().join("eod_data").join("BSE");
        fs::create_dir_all(&nse_dir).unwrap();
        fs::create_dir_all(&bse_dir).unwrap();

        for (directory, exchange, symbol, close) in [
            (&nse_dir, "NSE", "ALPHA", 10500_i64),
            (&bse_dir, "BSE", "BETA", 20500_i64),
        ] {
            let mut records = vec![EodRecord {
                date: 20240516,
                flags: 0,
                open: close - 500,
                high: close + 500,
                low: close - 1000,
                close,
                prev_close: close - 700,
                volume: 1000,
                oi: 0,
            }];
            BinaryEodFile::write_all(
                &directory.join(format!("{symbol}.eod")),
                symbol,
                exchange,
                100,
                &mut records,
            )
            .unwrap();
        }

        let scope_result = delete_quote_date_scope_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "ALL".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: None,
            },
            Some(dir.path()),
            None,
        )
        .unwrap();

        assert!(scope_result.result.success);
        assert_eq!(scope_result.result.deleted, 2);
        assert_eq!(
            scope_result.exchange_deleted,
            vec![
                ("NSE".to_string(), 1),
                ("NSE_INDEX".to_string(), 0),
                ("BSE".to_string(), 1),
                ("BSE_INDEX".to_string(), 0),
                ("MCX".to_string(), 0),
            ]
        );
        assert!(!nse_dir.join("ALPHA.eod").exists());
        assert!(!bse_dir.join("BETA.eod").exists());
    }

    fn v15_create_download_log_table(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE download_log (
                    id INTEGER PRIMARY KEY,
                    trade_date TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    rows_inserted INTEGER,
                    max_volume INTEGER,
                    status TEXT,
                    note TEXT,
                    downloaded_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(trade_date, exchange)
                );
                ",
            )
            .unwrap();
    }

    fn v15_insert_download_log_ok(connection: &Connection, trade_date: &str, exchange: &str) {
        connection
            .execute(
                "
                INSERT INTO download_log (
                    trade_date,
                    exchange,
                    rows_inserted,
                    max_volume,
                    status,
                    note
                ) VALUES (?, ?, 100, 1000, 'ok', NULL)
                ",
                params![trade_date, exchange],
            )
            .unwrap();
    }

    fn v15_download_log_state(
        connection: &Connection,
        trade_date: &str,
        exchange: &str,
    ) -> (String, Option<String>) {
        connection
            .query_row(
                "
                SELECT status, note
                FROM download_log
                WHERE trade_date = ?
                  AND exchange = ?
                ",
                params![trade_date, exchange],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap()
    }

    #[test]
    fn v15_quote_delete_metadata_single_symbol_delete_invalidates_download_log() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        v15_insert_download_log_ok(&conn, "2024-05-16", "NSE");

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");

        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9000,
            close: 10500,
            prev_close: 9500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert_eq!(result.deleted, 1);
        let (status, note) = v15_download_log_state(&conn, "2024-05-16", "NSE");
        assert_eq!(
            status, "invalidated",
            "V1.5 RED: successful single-symbol quote deletion must invalidate download_log"
        );
        assert!(
            note.as_deref()
                .unwrap_or("")
                .to_ascii_lowercase()
                .contains("quote"),
            "V1.5 RED: invalidated metadata should retain a Quote Editor audit note"
        );
    }

    #[test]
    fn v15_quote_delete_metadata_date_wide_delete_invalidates_download_log() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        v15_insert_download_log_ok(&conn, "2024-05-16", "NSE");

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();

        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9000,
            close: 10500,
            prev_close: 9500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(
            &eod_dir.join("ALPHA.eod"),
            "ALPHA",
            "NSE",
            100,
            &mut records,
        )
        .unwrap();

        let result = delete_quote_date_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: None,
            },
            Some(dir.path()),
            None,
        )
        .unwrap();

        assert_eq!(result.deleted, 1);
        let (status, _) = v15_download_log_state(&conn, "2024-05-16", "NSE");
        assert_eq!(
            status, "invalidated",
            "V1.5 RED: successful date-wide quote deletion must invalidate download_log"
        );
    }

    #[test]
    fn v15_quote_delete_metadata_range_delete_invalidates_matching_dates_only() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        for date in ["2024-05-15", "2024-05-16", "2024-05-17"] {
            v15_insert_download_log_ok(&conn, date, "NSE");
        }

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");

        let mut records = vec![
            EodRecord {
                date: 20240515,
                flags: 0,
                open: 10000,
                high: 11000,
                low: 9000,
                close: 10500,
                prev_close: 9500,
                volume: 1000,
                oi: 0,
            },
            EodRecord {
                date: 20240516,
                flags: 0,
                open: 11000,
                high: 12000,
                low: 10000,
                close: 11500,
                prev_close: 10500,
                volume: 1100,
                oi: 0,
            },
            EodRecord {
                date: 20240517,
                flags: 0,
                open: 12000,
                high: 13000,
                low: 11000,
                close: 12500,
                prev_close: 11500,
                volume: 1200,
                oi: 0,
            },
        ];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_range_internal(
            &conn,
            &DeleteQuoteRangeInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                from_date: "2024-05-15".to_string(),
                to_date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert_eq!(result.deleted, 2);
        assert_eq!(
            v15_download_log_state(&conn, "2024-05-15", "NSE").0,
            "invalidated",
            "V1.5 RED: first deleted date must be invalidated"
        );
        assert_eq!(
            v15_download_log_state(&conn, "2024-05-16", "NSE").0,
            "invalidated",
            "V1.5 RED: second deleted date must be invalidated"
        );
        assert_eq!(
            v15_download_log_state(&conn, "2024-05-17", "NSE").0,
            "ok",
            "V1.5 RED: dates outside the delete range must remain untouched"
        );
    }

    #[test]
    fn v15_quote_delete_metadata_zero_row_delete_keeps_download_log_ok() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        v15_insert_download_log_ok(&conn, "2024-05-16", "NSE");

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");

        let mut records = vec![EodRecord {
            date: 20240515,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9000,
            close: 10500,
            prev_close: 9500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();

        assert!(!result.success);
        assert_eq!(result.deleted, 0);
        assert_eq!(
            v15_download_log_state(&conn, "2024-05-16", "NSE").0,
            "ok",
            "V1.5 RED: zero-row delete must not invalidate untouched metadata"
        );
    }


    #[test]
    fn v15_quote_delete_metadata_preserves_download_history_fields() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        conn.execute(
            "
            INSERT INTO download_log (
                trade_date,
                exchange,
                rows_inserted,
                max_volume,
                status,
                note,
                downloaded_at
            ) VALUES (?, ?, 321, 987654, 'ok', 'prior audit note', '2024-05-16 10:11:12')
            ",
            params!["2024-05-16", "NSE"],
        )
        .unwrap();

        let dir = tempdir().unwrap();
        let eod_dir = dir.path().join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let bin_path = eod_dir.join("TEST.eod");
        let mut records = vec![EodRecord {
            date: 20240516,
            flags: 0,
            open: 10000,
            high: 11000,
            low: 9000,
            close: 10500,
            prev_close: 9500,
            volume: 1000,
            oi: 0,
        }];
        BinaryEodFile::write_all(&bin_path, "TEST", "NSE", 100, &mut records).unwrap();

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(result.deleted, 1);

        let state = conn
            .query_row(
                "
                SELECT status, rows_inserted, max_volume, note, downloaded_at
                FROM download_log
                WHERE trade_date = ? AND exchange = ?
                ",
                params!["2024-05-16", "NSE"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(state.0, "invalidated");
        assert_eq!(state.1, 321);
        assert_eq!(state.2, 987654);
        assert!(state.3.as_deref().unwrap_or("").contains("prior audit note"));
        assert!(state.3.as_deref().unwrap_or("").contains("Quote Editor"));
        assert_eq!(state.4, "2024-05-16 10:11:12");
    }

    #[test]
    fn v15_quote_delete_metadata_all_scope_invalidates_each_deleted_exchange() {
        let conn = setup_test_db();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        v15_create_download_log_table(&conn);
        v15_insert_download_log_ok(&conn, "2024-05-16", "NSE");
        v15_insert_download_log_ok(&conn, "2024-05-16", "BSE");

        let dir = tempdir().unwrap();
        let nse_dir = dir.path().join("eod_data").join("NSE");
        let bse_dir = dir.path().join("eod_data").join("BSE");
        fs::create_dir_all(&nse_dir).unwrap();
        fs::create_dir_all(&bse_dir).unwrap();

        for (directory, exchange, symbol, close) in [
            (&nse_dir, "NSE", "ALPHA", 10500_i64),
            (&bse_dir, "BSE", "BETA", 20500_i64),
        ] {
            let mut records = vec![EodRecord {
                date: 20240516,
                flags: 0,
                open: close - 500,
                high: close + 500,
                low: close - 1000,
                close,
                prev_close: close - 700,
                volume: 1000,
                oi: 0,
            }];
            BinaryEodFile::write_all(
                &directory.join(format!("{symbol}.eod")),
                symbol,
                exchange,
                100,
                &mut records,
            )
            .unwrap();
        }

        let result = delete_quote_date_scope_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "ALL".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: None,
            },
            Some(dir.path()),
            None,
        )
        .unwrap();

        assert_eq!(result.result.deleted, 2);
        assert_eq!(v15_download_log_state(&conn, "2024-05-16", "NSE").0, "invalidated");
        assert_eq!(v15_download_log_state(&conn, "2024-05-16", "BSE").0, "invalidated");
    }

}


#[cfg(test)]
mod v16_localized_state_invalidation_tests {
    use super::*;
    use crate::database::eod_binary_state::{BinaryStateIndex, BinaryStateKey};
    use crate::database::{
        set_price_storage_mode, DeleteQuoteDateInput, DeleteQuoteInput, DeleteQuoteRangeInput,
        QuoteInputPayload,
    };
    use rusqlite::Connection;
    use std::fs;
    use std::path::Path;
    use tempfile::tempdir;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE instruments (symbol TEXT, exchange TEXT, name TEXT, updated_at TEXT, PRIMARY KEY(symbol, exchange))",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE eod_prices (
                symbol TEXT,
                exchange TEXT,
                date TEXT,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                prev_close REAL,
                volume INTEGER,
                open_interest INTEGER,
                PRIMARY KEY(symbol, exchange, date)
            )",
            [],
        )
        .unwrap();
        set_price_storage_mode(&conn, PriceStorageMode::Binary).unwrap();
        conn
    }

    fn write_symbol(base: &Path, symbol: &str, dates: &[u32]) {
        let eod_dir = base.join("eod_data").join("NSE");
        fs::create_dir_all(&eod_dir).unwrap();
        let path = eod_dir.join(format!("{symbol}.eod"));
        let mut records = dates
            .iter()
            .enumerate()
            .map(|(offset, date)| EodRecord {
                date: *date,
                flags: 0,
                open: 10_000 + offset as i64,
                high: 11_000 + offset as i64,
                low: 9_000 + offset as i64,
                close: 10_500 + offset as i64,
                prev_close: 9_500 + offset as i64,
                volume: 1_000 + offset as u64,
                oi: 0,
            })
            .collect::<Vec<_>>();
        BinaryEodFile::write_all(&path, symbol, "NSE", DEFAULT_SCALE, &mut records).unwrap();
    }

    fn rebuild_state(base: &Path) -> i64 {
        let mut index = BinaryStateIndex::open(base).unwrap();
        index.rebuild().unwrap().generation
    }

    fn verified_keys(base: &Path) -> std::collections::HashSet<BinaryStateKey> {
        BinaryStateIndex::open_existing_read_only(base)
            .unwrap()
            .load_verified()
            .unwrap()
            .into_keys()
            .collect()
    }

    #[test]
    fn v16_single_quote_binary_delete_removes_only_affected_state_row() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20240515, 20240516]);
        write_symbol(dir.path(), "KEEP", &[20240515]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(result.success);

        let verified = verified_keys(dir.path());
        assert!(!verified.contains(&BinaryStateKey::new("NSE", "TEST")));
        assert!(verified.contains(&BinaryStateKey::new("NSE", "KEEP")));
    }

    #[test]
    fn v16_date_delete_invalidates_mutated_symbols_only() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "ALPHA", &[20240515, 20240516]);
        write_symbol(dir.path(), "BETA", &[20240515, 20240516]);
        write_symbol(dir.path(), "GAMMA", &[20240515, 20240517]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let result = delete_quote_date_internal(
            &conn,
            &DeleteQuoteDateInput {
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                to_date: None,
                symbols: Some(vec![
                    "ALPHA".to_string(),
                    "BETA".to_string(),
                    "GAMMA".to_string(),
                ]),
            },
            Some(dir.path()),
            None,
        )
        .unwrap();
        assert!(result.success);

        let verified = verified_keys(dir.path());
        assert!(!verified.contains(&BinaryStateKey::new("NSE", "ALPHA")));
        assert!(!verified.contains(&BinaryStateKey::new("NSE", "BETA")));
        assert!(verified.contains(&BinaryStateKey::new("NSE", "GAMMA")));
    }

    #[test]
    fn v16_quote_range_delete_invalidates_its_symbol_state() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20240515, 20240516, 20240517]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let result = delete_quote_range_internal(
            &conn,
            &DeleteQuoteRangeInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                from_date: "2024-05-16".to_string(),
                to_date: "2024-05-17".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(result.success);
        assert!(!verified_keys(dir.path()).contains(&BinaryStateKey::new("NSE", "TEST")));
    }

    #[test]
    fn v16_zero_row_quote_delete_preserves_existing_state_row() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20240515]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let result = delete_quote_internal(
            &conn,
            &DeleteQuoteInput {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
            },
            Some(dir.path()),
        )
        .unwrap();
        assert!(!result.success);
        assert!(verified_keys(dir.path()).contains(&BinaryStateKey::new("NSE", "TEST")));
    }

    #[test]
    fn v16_quote_upsert_invalidates_existing_state_row_after_binary_mutation() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20240515]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let row = upsert_quote_internal(
            &conn,
            &QuoteInputPayload {
                symbol: "TEST".to_string(),
                exchange: "NSE".to_string(),
                date: "2024-05-16".to_string(),
                open: 101.0,
                high: 105.0,
                low: 99.0,
                close: 103.0,
                volume: 1000.0,
                open_interest: Some(0.0),
            },
            Some(dir.path()),
        )
        .unwrap();
        assert_eq!(row.symbol, "TEST");
        assert!(!verified_keys(dir.path()).contains(&BinaryStateKey::new("NSE", "TEST")));
    }

    #[test]
    fn v16_missing_state_row_does_not_make_whole_index_unhealthy() {
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "ALPHA", &[20240515]);
        write_symbol(dir.path(), "BETA", &[20240515]);
        assert_eq!(rebuild_state(dir.path()), 1);

        let mut index = BinaryStateIndex::open_existing_read_write(dir.path()).unwrap();
        assert_eq!(
            index
                .remove_keys(&[BinaryStateKey::new("NSE", "ALPHA")])
                .unwrap(),
            1
        );
        let status = index.status().unwrap();
        assert!(status.healthy);
        assert_eq!(status.indexed, 1);
        assert_eq!(status.verified, 1);
    }
}

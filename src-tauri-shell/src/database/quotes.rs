use super::storage_paths::{check_sibling, eod_directory, eod_file, eod_path, eod_write_path};
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use super::binary_eod::{date_to_u32, u32_to_date, BinaryEodFile, EodRecord, DEFAULT_SCALE};
use super::database_use::{
    BinaryAfterDelete, CanonicalAccess, QuoteContext, QuoteDeletion, QuoteDeletionContext,
    QuoteIntent,
};
use super::eod_binary_state::{BinaryStateIndex, BinaryStateKey};
use super::{
    get_price_storage_mode, normalize_exchange, normalize_symbol, normalize_trade_date,
    run_connection_transaction, AppResult, DeleteQuoteDateInput, DeleteQuoteInput,
    DeleteQuoteRangeInput, DeleteQuoteResult, PriceStorageMode, QuoteDateListInput,
    QuoteInputPayload, QuoteListInput, QuoteRow,
};

mod bulk_recovery;
pub(super) use bulk_recovery::{
    delete_quote_date_scope_coordinated, delete_quote_range_coordinated,
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
        return symbols.iter().map(|symbol| {
            let path = eod_file(exchange_path, symbol)?;
            check_sibling(&path.with_extension("tmp"))?;
            Ok(path)
        }).collect();
    }

    let paths = fs::read_dir(exchange_path)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("eod"))
        .collect::<Vec<_>>();
    for path in &paths {
        check_sibling(path)?;
        check_sibling(&path.with_extension("tmp"))?;
    }
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
        let bin_path = eod_path(folder_path, &exchange, &symbol)?;
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
        let exchange_path = eod_directory(folder_path, &exchange)?;
        if exchange_path.exists() {
            let target_date = date_to_u32(&date);
            for entry in fs::read_dir(&exchange_path).map_err(|error| error.to_string())? {
                let entry = entry.map_err(|error| error.to_string())?;
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) != Some("eod") {
                    continue;
                }

                check_sibling(&path)?;
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

fn quote_intent(quote: &NormalizedQuoteInput) -> QuoteIntent {
    QuoteIntent {
        exchange: quote.exchange.clone(),
        symbol: quote.symbol.clone(),
        date: quote.date.clone(),
        price_bits: [quote.open, quote.high, quote.low, quote.close].map(f64::to_bits),
        volume: quote.volume,
        open_interest: quote.open_interest,
        context: None,
    }
}

fn quote_predecessor(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
    date: &str,
) -> AppResult<Option<(String, u64)>> {
    connection
        .query_row(
            "SELECT date, close FROM eod_prices WHERE symbol = ?1 AND exchange = ?2
         AND date < ?3 ORDER BY date DESC LIMIT 1",
            params![symbol, exchange, date],
            |row| Ok((row.get(0)?, row.get::<_, f64>(1)?.to_bits())),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn open_quote_binary(path: &Path, intent: &QuoteIntent) -> AppResult<BinaryEodFile> {
    use crate::native_scanner::reader::{open_validated, validate_identity};

    let file = open_validated(path)?;
    validate_identity(&file, &intent.symbol, &intent.exchange)?;
    if file.header.price_scale != DEFAULT_SCALE {
        return Err("Unexpected binary quote price scale.".into());
    }
    Ok(BinaryEodFile {
        path: path.to_path_buf(),
        header: file.header,
    })
}

fn quote_binary_record(row: &QuoteRow) -> EodRecord {
    EodRecord {
        date: date_to_u32(&row.date),
        flags: 0,
        open: (row.open * DEFAULT_SCALE as f64).round() as i64,
        high: (row.high * DEFAULT_SCALE as f64).round() as i64,
        low: (row.low * DEFAULT_SCALE as f64).round() as i64,
        close: (row.close * DEFAULT_SCALE as f64).round() as i64,
        prev_close: (row.prev_close.unwrap_or(0.0) * DEFAULT_SCALE as f64).round() as i64,
        volume: row.volume as u64,
        oi: row.open_interest as u64,
    }
}

fn verify_quote_intent(
    connection: &Connection,
    folder: &Path,
    intent: &QuoteIntent,
) -> AppResult<bool> {
    let Some(context) = &intent.context else {
        return Ok(false);
    };
    let Some(row) = read_sqlite_quote(connection, &intent.symbol, &intent.exchange, &intent.date)?
    else {
        return Ok(false);
    };
    let price_bits = [row.open, row.high, row.low, row.close].map(f64::to_bits);
    if price_bits != intent.price_bits
        || row.volume != intent.volume
        || row.open_interest != intent.open_interest
        || row.prev_close.map(f64::to_bits) != context.previous.as_ref().map(|(_, close)| *close)
        || quote_predecessor(connection, &intent.symbol, &intent.exchange, &intent.date)?
            != context.previous
    {
        return Ok(false);
    }
    let successor_previous_close = connection
        .query_row(
            "SELECT prev_close FROM eod_prices WHERE symbol = ?1 AND exchange = ?2
         AND date > ?3 ORDER BY date ASC LIMIT 1",
            params![intent.symbol, intent.exchange, intent.date],
            |row| row.get::<_, Option<f64>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if successor_previous_close
        .is_some_and(|close| close.map(f64::to_bits) != Some(row.close.to_bits()))
    {
        return Ok(false);
    }

    let path = eod_path(folder, &intent.exchange, &intent.symbol)?;
    if !path.try_exists().map_err(|error| error.to_string())? {
        return Ok(false);
    }
    let binary = open_quote_binary(&path, intent)?;
    let expected = quote_binary_record(&row);
    let observed = binary.read_range_bounded(expected.date, expected.date, 2)?;
    Ok(observed.as_slice() == [expected])
}

pub(super) fn upsert_quote_internal(
    folder: &Path,
    input: &QuoteInputPayload,
    access: &CanonicalAccess,
    connect: impl FnOnce() -> AppResult<Connection>,
) -> AppResult<QuoteRow> {
    let quote = normalize_quote_input(input)?;
    let bin_path = eod_write_path(folder, &quote.exchange, &quote.symbol)?;
    let intent = quote_intent(&quote);
    let mut lease = access.begin_quote_mutation(intent.clone())?;
    let connection = connect()?;
    // A changed scale can affect every older binary record. Leave these intents
    // unprepared for reviewed recovery instead of certifying a single matching row.
    let safe_binary_before = match fs::metadata(&bin_path) {
        Ok(_) => open_quote_binary(&bin_path, &intent).is_ok(),
        Err(error) => error.kind() == std::io::ErrorKind::NotFound,
    };
    if safe_binary_before {
        let previous =
            quote_predecessor(&connection, &intent.symbol, &intent.exchange, &intent.date)?;
        lease.prepare_quote(QuoteContext { previous })?;
    }
    let final_row = upsert_sqlite_quote(&connection, &quote)?;
    let record = quote_binary_record(&final_row);

    match BinaryEodFile::append_or_merge_records(
        &bin_path,
        &final_row.symbol,
        &final_row.exchange,
        DEFAULT_SCALE,
        vec![record],
    ) {
        Ok(_) => {
            invalidate_binary_state_rows_after_mutation(
                folder,
                &final_row.exchange,
                std::slice::from_ref(&final_row.symbol),
            );
            match lease.verify_quote(|intent| verify_quote_intent(&connection, folder, intent)) {
                Ok(true) => {}
                Ok(false) => {
                    eprintln!("Quote upsert awaits exact canonical recovery verification.")
                }
                Err(error) => {
                    eprintln!("Canonical price store remains blocked after quote upsert: {error}");
                }
            }
        }
        Err(error) => {
            // Keep the legacy SQL result. The unresolved intent denies canonical reads.
            eprintln!(
                "Binary EOD manual upsert failure for {}:{}: {}",
                final_row.exchange, final_row.symbol, error
            );
        }
    }
    Ok(final_row)
}

fn upsert_sqlite_quote(
    connection: &Connection,
    quote: &NormalizedQuoteInput,
) -> AppResult<QuoteRow> {
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

    read_sqlite_quote(connection, &quote.symbol, &quote.exchange, &quote.date)?
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows.to_string())
}

fn read_sqlite_quote(
    connection: &Connection,
    symbol: &str,
    exchange: &str,
    date: &str,
) -> AppResult<Option<QuoteRow>> {
    connection
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
            params![symbol, exchange, date],
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
                    open_interest: row.get(9)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
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

fn quote_deletion(input: &DeleteQuoteInput) -> AppResult<QuoteDeletion> {
    Ok(QuoteDeletion {
        symbol: normalize_symbol(&input.symbol)?,
        exchange: normalize_exchange(&input.exchange)?,
        date: normalize_trade_date(&input.date)?,
        context: None,
    })
}

/// Scan dates in order and hash the untouched records without retaining the file in memory.
fn binary_deletion_state(
    path: &Path,
    deletion: &QuoteDeletion,
) -> AppResult<(BinaryAfterDelete, bool)> {
    let date = date_to_u32(&deletion.date);
    binary_range_deletion_state(path, &deletion.exchange, &deletion.symbol, date, date)
}

fn binary_range_deletion_state(
    path: &Path,
    exchange: &str,
    symbol: &str,
    start: u32,
    end: u32,
) -> AppResult<(BinaryAfterDelete, bool)> {
    use std::io::{BufReader, Read, Seek, SeekFrom};

    use sha2::{Digest, Sha256};

    use super::binary_eod::{HEADER_SIZE, RECORD_SIZE};
    use crate::native_scanner::reader::{open_validated, validate_identity};

    if !path.try_exists().map_err(|error| error.to_string())? {
        return Ok((BinaryAfterDelete::Absent, false));
    }
    let validated = open_validated(path)?;
    validate_identity(&validated, symbol, exchange)?;
    let mut file = BufReader::new(fs::File::open(path).map_err(|error| error.to_string())?);
    file.seek(SeekFrom::Start(HEADER_SIZE as u64))
        .map_err(|error| error.to_string())?;
    let mut previous_date = 0;
    let mut removed = 0;
    let mut hash = Sha256::new();
    let mut record = [0; RECORD_SIZE];

    for _ in 0..validated.record_count {
        file.read_exact(&mut record)
            .map_err(|error| error.to_string())?;
        let date = u32::from_le_bytes(record[..4].try_into().expect("binary quote date"));
        if date <= previous_date {
            return Err(
                "Binary quote dates must be unique and ascending for deletion proof.".into(),
            );
        }
        previous_date = date;
        if (start..=end).contains(&date) {
            removed += 1;
        } else {
            hash.update(record);
        }
    }
    let remaining = validated.record_count - removed;
    let after = if removed > 0 && remaining == 0 {
        BinaryAfterDelete::Absent
    } else {
        BinaryAfterDelete::Present {
            scale: validated.header.price_scale,
            count: remaining,
            digest: format!("{:x}", hash.finalize()),
        }
    };
    Ok((after, removed > 0))
}

fn deletion_instrument_exists(
    connection: &Connection,
    deletion: &QuoteDeletion,
) -> AppResult<bool> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM instruments WHERE symbol = ?1 AND exchange = ?2)",
            params![deletion.symbol, deletion.exchange],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn deletion_context(
    connection: &Connection,
    bin_path: &Path,
    deletion: &QuoteDeletion,
) -> AppResult<QuoteDeletionContext> {
    Ok(QuoteDeletionContext {
        had_instrument: deletion_instrument_exists(connection, deletion)?,
        previous: quote_predecessor(
            connection,
            &deletion.symbol,
            &deletion.exchange,
            &deletion.date,
        )?,
        binary: binary_deletion_state(bin_path, deletion)?.0,
    })
}

fn verify_quote_deletion(
    connection: &Connection,
    bin_path: &Path,
    deletion: &QuoteDeletion,
) -> AppResult<bool> {
    let Some(expected) = &deletion.context else {
        return Ok(false);
    };
    let sqlite_contains_quote: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM eod_prices WHERE symbol = ?1 AND exchange = ?2 AND date = ?3)",
        params![deletion.symbol, deletion.exchange, deletion.date],
        |row| row.get(0),
    ).map_err(|error| error.to_string())?;
    if sqlite_contains_quote
        || deletion_instrument_exists(connection, deletion)? != expected.had_instrument
        || quote_predecessor(
            connection,
            &deletion.symbol,
            &deletion.exchange,
            &deletion.date,
        )? != expected.previous
    {
        return Ok(false);
    }
    let successor_previous_close = connection
        .query_row(
            "SELECT prev_close FROM eod_prices WHERE symbol = ?1 AND exchange = ?2
         AND date > ?3 ORDER BY date ASC LIMIT 1",
            params![deletion.symbol, deletion.exchange, deletion.date],
            |row| row.get::<_, Option<f64>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let expected_previous_close = expected.previous.as_ref().map(|(_, close)| *close);
    if successor_previous_close
        .is_some_and(|close| close.map(f64::to_bits) != expected_previous_close)
    {
        return Ok(false);
    }

    let (observed, binary_contains_quote) = binary_deletion_state(bin_path, deletion)?;
    Ok(!binary_contains_quote && observed == expected.binary)
}

pub(super) fn delete_quote_coordinated(
    folder: &Path,
    input: &DeleteQuoteInput,
    access: &CanonicalAccess,
    connect: impl FnOnce() -> AppResult<Connection>,
) -> AppResult<DeleteQuoteResult> {
    let deletion = quote_deletion(input)?;
    let bin_path = eod_write_path(folder, &deletion.exchange, &deletion.symbol)?;
    let mut lease = access.begin_quote_deletion(deletion.clone())?;
    let connection = connect()?;
    match deletion_context(&connection, &bin_path, &deletion) {
        Ok(context) => lease.prepare(context)?,
        Err(error) => {
            eprintln!("Quote deletion could not prepare canonical recovery proof: {error}")
        }
    }
    let result = delete_quote_stores(&connection, &deletion, Some((folder, &bin_path)))?;
    match lease.verify(|intent| verify_quote_deletion(&connection, &bin_path, intent)) {
        Ok(true) => {}
        Ok(false) => eprintln!("Quote deletion awaits exact canonical recovery verification."),
        Err(error) => {
            eprintln!("Canonical price store remains blocked after quote deletion: {error}")
        }
    }
    Ok(result)
}

#[cfg(test)]
fn delete_quote_internal(
    connection: &Connection,
    input: &DeleteQuoteInput,
    base_path: Option<&Path>,
) -> AppResult<DeleteQuoteResult> {
    let deletion = quote_deletion(input)?;
    let path = base_path
        .map(|folder| eod_write_path(folder, &deletion.exchange, &deletion.symbol))
        .transpose()?;
    delete_quote_stores(connection, &deletion, base_path.zip(path.as_deref()))
}

fn delete_sqlite_quote(connection: &Connection, deletion: &QuoteDeletion) -> AppResult<i64> {
    let mut deleted = 0;
    run_connection_transaction(connection, |connection| {
        deleted = connection
            .execute(
                "DELETE FROM eod_prices WHERE symbol = ?1 AND exchange = ?2 AND date = ?3",
                params![deletion.symbol, deletion.exchange, deletion.date],
            )
            .map_err(|error| error.to_string())? as i64;
        recompute_prev_close_for_symbol(connection, &deletion.symbol, &deletion.exchange)?;
        Ok(())
    })?;
    Ok(deleted)
}

fn delete_quote_stores(
    connection: &Connection,
    deletion: &QuoteDeletion,
    binary: Option<(&Path, &Path)>,
) -> AppResult<DeleteQuoteResult> {
    let deleted_sqlite = delete_sqlite_quote(connection, deletion)?;
    let mut deleted_binary = false;
    if let Some((folder, path)) = binary {
        deleted_binary = BinaryEodFile::delete_record_by_date(path, date_to_u32(&deletion.date))?;
        if deleted_binary {
            invalidate_binary_state_rows_after_mutation(
                folder,
                &deletion.exchange,
                std::slice::from_ref(&deletion.symbol),
            );
        }
    }

    let deleted = if deleted_sqlite > 0 {
        deleted_sqlite
    } else {
        deleted_binary as i64
    };
    if deleted > 0 {
        invalidate_download_log_for_deleted_quote_range(
            connection,
            &deletion.exchange,
            &deletion.date,
            &deletion.date,
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

    let bin_path = base_path
        .map(|folder| eod_write_path(folder, &exchange, &symbol))
        .transpose()?;
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
    if let (Some(folder_path), Some(bin_path)) = (base_path, bin_path) {
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

    let exchange_path = base_path.map(|folder| eod_directory(folder, &exchange)).transpose()?;
    let target_paths = match exchange_path.as_deref() {
        Some(path) if path.exists() => collect_binary_delete_targets(path, requested_symbols.as_ref())?,
        _ => Vec::new(),
    };
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
        } else {
            target_paths.iter()
                .filter_map(|path| path.file_stem()?.to_str().map(str::to_owned))
                .collect()
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
        if exchange_path.as_deref().is_some_and(Path::exists) {
            let start_date_u32 = date_to_u32(&start_date);
            let end_date_u32 = date_to_u32(&end_date);
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
        .map(|symbols| symbols.iter().map(|symbol| normalize_symbol(symbol)).collect::<AppResult<Vec<_>>>())
        .transpose()?;

    let target_file_counts = if let Some(folder_path) = base_path {
        targets
            .iter()
            .map(|exchange| {
                let exchange_path = eod_directory(folder_path, exchange)?;
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
    fn issue_01_refuses_unsafe_binary_target_before_deleting_sqlite_quote() {
        let conn = setup_test_db();
        let root = tempdir().unwrap();
        let exchange_dir = root.path().join("eod_data").join("NSE");
        fs::create_dir_all(exchange_dir.join("M&M.eod")).unwrap();
        conn.execute(
            "INSERT INTO eod_prices (symbol, exchange, date, close) VALUES ('M&M', 'NSE', '2024-05-15', 10)",
            [],
        ).unwrap();

        let input = DeleteQuoteInput {
            symbol: "M&M".to_string(),
            exchange: "NSE".to_string(),
            date: "2024-05-15".to_string(),
        };
        let error = delete_quote_internal(&conn, &input, Some(root.path())).unwrap_err();
        assert!(error.contains("Unexpected storage path type"));
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM eod_prices", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
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
        setup_test_db_on(Connection::open_in_memory().unwrap())
    }

    pub(super) fn setup_test_db_on(conn: Connection) -> Connection {
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

        let access = CanonicalAccess::in_namespace(dir.path(), dir.path()).unwrap();
        let row = upsert_quote_internal(
            dir.path(),
            &coordinated_quote("2024-05-16"),
            &access,
            || Ok(conn),
        )
        .unwrap();
        assert!(access.begin_read().is_ok());
        assert_eq!(row.symbol, "TEST");
        assert!(!verified_keys(dir.path()).contains(&BinaryStateKey::new("NSE", "TEST")));
    }

    pub(super) fn coordinated_quote(date: &str) -> QuoteInputPayload {
        QuoteInputPayload {
            symbol: "TEST".into(),
            exchange: "NSE".into(),
            date: date.into(),
            open: 101.0,
            high: 105.0,
            low: 99.0,
            close: 103.0,
            volume: 1000.0,
            open_interest: Some(0.0),
        }
    }

    #[test]
    fn nsr7_quote_lease_crash_child() {
        let Some(root) = std::env::var_os("EOD_NSR7_QUOTE_LEASE_CHILD_FIXTURE").map(PathBuf::from)
        else {
            return;
        };
        assert_eq!(
            fs::read(root.join("fixture-id")).unwrap().as_slice(),
            b"nsr7-quote-lease-v1"
        );
        let database = root.join("database");
        let access = CanonicalAccess::in_namespace(&database, &root).unwrap();
        let input = coordinated_quote("2024-05-16");

        match std::env::var("EOD_NSR7_QUOTE_LEASE_CHILD_ACTION")
            .unwrap()
            .as_str()
        {
            "busy" => {
                let error = upsert_quote_internal(&database, &input, &access, || {
                    panic!("a busy mutation must not open the writable connection")
                })
                .unwrap_err();
                assert_eq!(error, "CANONICAL_PRICE_STORE_BUSY");
            }
            "crash" => {
                let quote = normalize_quote_input(&input).unwrap();
                let intent = quote_intent(&quote);
                let mut mutation = access.begin_quote_mutation(intent.clone()).unwrap();
                let connection = Connection::open(database.join("quote-fixture.sqlite")).unwrap();
                mutation
                    .prepare_quote(QuoteContext {
                        previous: quote_predecessor(
                            &connection,
                            &intent.symbol,
                            &intent.exchange,
                            &intent.date,
                        )
                        .unwrap(),
                    })
                    .unwrap();
                upsert_sqlite_quote(&connection, &quote).unwrap();
                // Leave the SQLite commit visible and exit before writing the binary row.
                std::process::exit(86);
            }
            action => panic!("unknown child action: {action}"),
        }
    }

    #[test]
    fn nsr7_quote_lease_survives_an_interrupted_dual_store_write() {
        let dir = match std::env::var_os("EOD_NSR7_QUOTE_LEASE_FIXTURE_ROOT") {
            Some(root) => tempfile::tempdir_in(root).unwrap(),
            None => tempdir().unwrap(),
        };
        let root = dir.path();
        fs::write(root.join("fixture-id"), b"nsr7-quote-lease-v1").unwrap();
        let database = root.join("database");
        let second_database = root.join("other-database");
        fs::create_dir(&database).unwrap();
        fs::create_dir(&second_database).unwrap();
        let sqlite = database.join("quote-fixture.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        write_symbol(&database, "TEST", &[20240515]);
        let binary = eod_path(&database, "NSE", "TEST").unwrap();
        let access = CanonicalAccess::in_namespace(&database, root).unwrap();
        let alias = CanonicalAccess::in_namespace(&database.join("."), root).unwrap();
        let independent = CanonicalAccess::in_namespace(&second_database, root).unwrap();
        let module = module_path!().split_once("::").unwrap().1;
        let child_test = format!("{module}::nsr7_quote_lease_crash_child");

        let run_child = |action: &str, exit_code: i32| {
            let output = std::process::Command::new(std::env::current_exe().unwrap())
                .args(["--exact", &child_test, "--nocapture"])
                .env("EOD_NSR7_QUOTE_LEASE_CHILD_FIXTURE", root)
                .env("EOD_NSR7_QUOTE_LEASE_CHILD_ACTION", action)
                .output()
                .unwrap();
            assert_eq!(
                output.status.code(),
                Some(exit_code),
                "{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            if action == "busy" {
                assert!(String::from_utf8_lossy(&output.stdout).contains("1 passed"));
            }
        };

        let reader = access.begin_read().unwrap();
        let second_reader = alias.begin_read().unwrap();
        let intent =
            quote_intent(&normalize_quote_input(&coordinated_quote("2024-05-16")).unwrap());
        assert_eq!(
            alias.begin_quote_mutation(intent.clone()).err().unwrap(),
            "CANONICAL_PRICE_STORE_BUSY"
        );
        assert!(independent.begin_quote_mutation(intent).is_ok());
        let busy =
            access.verify_pending_quote(|_| panic!("busy verification must not inspect stores"));
        assert_eq!(busy.unwrap_err(), "CANONICAL_PRICE_STORE_BUSY");
        run_child("busy", 0);
        drop(reader);
        drop(second_reader);
        let quote_count = |date: &str| {
            Connection::open(&sqlite)
                .unwrap()
                .query_row(
                    "SELECT COUNT(*) FROM eod_prices WHERE date = ?1",
                    [date],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap()
        };
        assert_eq!(quote_count("2024-05-16"), 0);

        run_child("crash", 86);
        assert_eq!(quote_count("2024-05-16"), 1);
        assert!(BinaryEodFile::open(&binary)
            .unwrap()
            .read_range(20240516, 20240516)
            .unwrap()
            .is_empty());
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );

        upsert_quote_internal(&database, &coordinated_quote("2024-05-17"), &access, || {
            Connection::open(&sqlite).map_err(|error| error.to_string())
        })
        .unwrap();
        assert_eq!(quote_count("2024-05-17"), 1);
        let read_only =
            Connection::open_with_flags(&sqlite, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .unwrap();
        let cleared = access
            .verify_pending_quote(|intent| {
                assert_eq!(intent.date, "2024-05-16");
                verify_quote_intent(&read_only, &database, intent)
            })
            .unwrap();
        assert_eq!(cleared, 0);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
        if std::env::var_os("EOD_NSR7_QUOTE_LEASE_FIXTURE_ROOT").is_some() {
            println!("Retained quote lease fixture: {}", dir.keep().display());
        }
    }

    #[test]
    fn nsr7_quote_lease_preserves_sqlite_success_after_a_binary_error() {
        let dir = tempdir().unwrap();
        let connection = setup_test_db();
        write_symbol(dir.path(), "TEST", &[20240515]);
        fs::write(
            eod_path(dir.path(), "NSE", "TEST").unwrap(),
            b"invalid EOD file",
        )
        .unwrap();
        let access = CanonicalAccess::in_namespace(dir.path(), dir.path()).unwrap();
        let row = upsert_quote_internal(
            dir.path(),
            &coordinated_quote("2024-05-16"),
            &access,
            || Ok(connection),
        )
        .unwrap();
        assert_eq!(row.close, 103.0);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
    }

    #[test]
    fn nsr7_quote_recovery_requires_exact_values_and_preserves_legacy_block() {
        let dir = tempdir().unwrap();
        let database = dir.path();
        let sqlite = database.join("quote-proof.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        let access = CanonicalAccess::in_namespace(database, database).unwrap();
        let input = coordinated_quote("2024-05-16");
        let connect = || Connection::open(&sqlite).map_err(|error| error.to_string());
        let row = upsert_quote_internal(database, &input, &access, connect).unwrap();
        let intent = quote_intent(&normalize_quote_input(&input).unwrap());
        let path = eod_path(database, "NSE", "TEST").unwrap();

        let prepare = || {
            let mut lease = access.begin_quote_mutation(intent.clone()).unwrap();
            lease
                .prepare_quote(QuoteContext { previous: None })
                .unwrap();
        };
        let verify = || {
            access.verify_pending_quote(|intent| {
                let read_only = Connection::open_with_flags(
                    &sqlite,
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
                )
                .map_err(|error| error.to_string())?;
                verify_quote_intent(&read_only, database, intent)
            })
        };
        prepare();
        connect()
            .unwrap()
            .execute("UPDATE eod_prices SET close = close + 0.01", [])
            .unwrap();
        assert_eq!(verify().unwrap(), 0);
        connect()
            .unwrap()
            .execute("UPDATE eod_prices SET close = ?1", [row.close])
            .unwrap();

        let expected = quote_binary_record(&row);
        let different_price = EodRecord {
            close: expected.close + 1,
            ..expected
        };
        BinaryEodFile::append_or_merge_records(
            &path,
            "TEST",
            "NSE",
            DEFAULT_SCALE,
            vec![different_price],
        )
        .unwrap();
        assert_eq!(verify().unwrap(), 0);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
        BinaryEodFile::append_or_merge_records(&path, "TEST", "NSE", DEFAULT_SCALE, vec![expected])
            .unwrap();
        assert_eq!(verify().unwrap(), 1);
        assert!(access.begin_read().is_ok());

        let state = fs::read_dir(database.join("canonical-price-store-v1"))
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| {
                path.extension()
                    .is_some_and(|extension| extension == "state")
            })
            .unwrap();
        fs::write(&state, b"dirty-v1\n").unwrap();
        prepare();
        assert_eq!(verify().unwrap(), 1);
        assert_eq!(fs::read(&state).unwrap().as_slice(), b"dirty-v1\n");
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
    }

    #[test]
    fn nsr7_quote_recovery_refuses_unsafe_preexisting_binary_scale() {
        let dir = tempdir().unwrap();
        write_symbol(dir.path(), "TEST", &[20240515]);
        let path = eod_path(dir.path(), "NSE", "TEST").unwrap();
        let mut rows = BinaryEodFile::open(&path).unwrap().read_all().unwrap();
        BinaryEodFile::write_all(&path, "TEST", "NSE", DEFAULT_SCALE / 10, &mut rows).unwrap();

        let access = CanonicalAccess::in_namespace(dir.path(), dir.path()).unwrap();
        upsert_quote_internal(
            dir.path(),
            &coordinated_quote("2024-05-16"),
            &access,
            || Ok(setup_test_db()),
        )
        .unwrap();
        let mut intent_was_unprepared = false;
        let verified = access
            .verify_pending_quote(|intent| {
                assert_eq!(intent.date, "2024-05-16");
                assert!(intent.context.is_none());
                intent_was_unprepared = true;
                Ok(false)
            })
            .unwrap();
        assert!(intent_was_unprepared);
        assert_eq!(verified, 0);
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
    }

    fn single_delete_input(date: &str) -> DeleteQuoteInput {
        DeleteQuoteInput {
            symbol: "TEST".into(),
            exchange: "NSE".into(),
            date: date.into(),
        }
    }

    #[test]
    fn nsr7_single_delete_proves_last_quote_absent_and_keeps_the_instrument() {
        let dir = tempdir().unwrap();
        let folder = dir.path();
        let sqlite = folder.join("delete-proof.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        let connect = || Connection::open(&sqlite).map_err(|error| error.to_string());
        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        upsert_quote_internal(folder, &coordinated_quote("2024-05-16"), &access, connect).unwrap();
        let input = single_delete_input("2024-05-16");
        let deletion = quote_deletion(&input).unwrap();
        let held = access.begin_read().unwrap();
        let blocked = delete_quote_coordinated(folder, &input, &access, || {
            panic!("contended deletion must not open SQLite for writing")
        });
        assert_eq!(blocked.err().unwrap(), "CANONICAL_PRICE_STORE_BUSY");
        assert!(
            read_sqlite_quote(&connect().unwrap(), "TEST", "NSE", "2024-05-16")
                .unwrap()
                .is_some()
        );
        drop(held);

        let result = delete_quote_coordinated(folder, &input, &access, connect).unwrap();
        assert!(result.success);
        assert_eq!(result.deleted, 1);
        let connection = connect().unwrap();
        assert!(deletion_instrument_exists(&connection, &deletion).unwrap());
        assert!(read_sqlite_quote(&connection, "TEST", "NSE", "2024-05-16")
            .unwrap()
            .is_none());
        assert!(!eod_path(folder, "NSE", "TEST").unwrap().exists());
        assert!(access.begin_read().is_ok());

        let retry = delete_quote_coordinated(folder, &input, &access, connect).unwrap();
        assert!(!retry.success);
        assert_eq!(retry.deleted, 0);
        assert!(access.begin_read().is_ok());
    }

    #[test]
    fn nsr7_single_delete_retains_interruption_until_both_stores_are_verified() {
        let dir = tempdir().unwrap();
        let folder = dir.path();
        let sqlite = folder.join("delete-proof.sqlite");
        setup_test_db_on(Connection::open(&sqlite).unwrap());
        let connect = || Connection::open(&sqlite).map_err(|error| error.to_string());
        let access = CanonicalAccess::in_namespace(folder, folder).unwrap();
        for date in ["2024-05-15", "2024-05-16", "2024-05-17"] {
            let mut input = coordinated_quote(date);
            if date == "2024-05-16" {
                input.close = 102.0;
            }
            upsert_quote_internal(folder, &input, &access, connect).unwrap();
        }
        let binary_path = eod_path(folder, "NSE", "TEST").unwrap();
        let mut deletion = quote_deletion(&single_delete_input("2024-05-16")).unwrap();
        let mut lease = access.begin_quote_deletion(deletion.clone()).unwrap();
        let connection = connect().unwrap();
        let context = deletion_context(&connection, &binary_path, &deletion).unwrap();
        lease.prepare(context.clone()).unwrap();
        deletion.context = Some(context);

        assert_eq!(delete_sqlite_quote(&connection, &deletion).unwrap(), 1);
        drop(lease);
        assert!(!verify_quote_deletion(&connection, &binary_path, &deletion).unwrap());
        assert_eq!(
            access.begin_read().unwrap_err(),
            "CANONICAL_PRICE_STORE_INTERRUPTED"
        );
        let original = BinaryEodFile::open(&binary_path)
            .unwrap()
            .read_all()
            .unwrap();

        let moved = folder.join("unexpected-missing.eod");
        fs::rename(&binary_path, &moved).unwrap();
        assert!(!verify_quote_deletion(&connection, &binary_path, &deletion).unwrap());
        fs::rename(&moved, &binary_path).unwrap();

        let mut changed = vec![original[0], original[2]];
        changed[1].volume += 1;
        BinaryEodFile::write_all(&binary_path, "TEST", "NSE", DEFAULT_SCALE, &mut changed).unwrap();
        assert!(!verify_quote_deletion(&connection, &binary_path, &deletion).unwrap());

        let mut original = original;
        BinaryEodFile::write_all(&binary_path, "TEST", "NSE", DEFAULT_SCALE, &mut original)
            .unwrap();
        let result =
            delete_quote_coordinated(folder, &single_delete_input("2024-05-16"), &access, connect)
                .unwrap();
        assert_eq!(result.deleted, 1);
        assert!(verify_quote_deletion(&connection, &binary_path, &deletion).unwrap());
        let successor = read_sqlite_quote(&connection, "TEST", "NSE", "2024-05-17")
            .unwrap()
            .unwrap();
        assert_eq!(successor.prev_close, Some(103.0));
        assert!(deletion_instrument_exists(&connection, &deletion).unwrap());
        assert!(access.begin_read().is_ok());
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

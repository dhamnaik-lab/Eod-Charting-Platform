use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use std::collections::HashSet;
use tauri::AppHandle;

use super::binary_eod::{BinaryEodFile, DEFAULT_SCALE};
use super::{
    emit_database_changed, find_instrument_record, get_app_snapshot_internal, normalize_exchange,
    normalize_optional_text, normalize_optional_trade_date, normalize_symbol, question_marks,
    recompute_prev_close_for_symbol, resolve_active_database_folder, resolve_instrument_context,
    run_connection_transaction, trim_numeric_string, AppResult, CorporateActionInputPayload,
    CorporateActionResult, MergeSymbolsInput, MergeSymbolsResult, SnapshotOptions,
};
use std::path::Path;

#[tauri::command]
pub async fn merge_symbols(
    app: AppHandle,
    input: MergeSymbolsInput,
) -> AppResult<MergeSymbolsResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before merging symbols.".to_string())?;

        // 1. Open a temporary connection to perform the merge outside the global lock
        let connection =
            super::connection_registry::open_connection_for_folder(&folder_path, false)?;

        // 2. Perform the heavy merge (SQLite + Binary EOD)
        let result = merge_symbols_internal(&connection, &input, Some(&folder_path))?;

        // 3. Invalidate the stats cache since we just modified data
        super::connection_registry::invalidate_cached_db_stats(&app_handle, &folder_path)?;

        // 4. Generate snapshot and emit (snapshot handles its own internal locks)
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;

        Ok::<MergeSymbolsResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn apply_corporate_action(
    app: AppHandle,
    input: CorporateActionInputPayload,
) -> AppResult<CorporateActionResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?.ok_or_else(|| {
            "Open a database before saving corporate actions or identity history.".to_string()
        })?;

        // 1. Open a temporary connection to perform the mutation outside the global lock
        let connection =
            super::connection_registry::open_connection_for_folder(&folder_path, false)?;

        // 2. Perform the heavy SQLite work
        let result = apply_corporate_action_internal(&connection, &input, Some(&folder_path))?;

        // 3. Invalidate the stats cache since we just modified data
        super::connection_registry::invalidate_cached_db_stats(&app_handle, &folder_path)?;

        // 4. Generate snapshot and emit
        let snapshot = get_app_snapshot_internal(
            &app_handle,
            Some(&SnapshotOptions {
                include_stats: Some(false),
                include_watchlists: Some(false),
            }),
        )?;
        emit_database_changed(&app_handle, &snapshot)?;

        Ok::<CorporateActionResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn merge_symbols_internal(
    connection: &Connection,
    input: &MergeSymbolsInput,
    base_path: Option<&Path>,
) -> AppResult<MergeSymbolsResult> {
    let source_symbol = normalize_symbol(&input.source_symbol)?;
    let source_exchange = normalize_exchange(&input.source_exchange)?;
    let target_symbol = normalize_symbol(&input.target_symbol)?;
    let target_exchange = normalize_exchange(&input.target_exchange)?;
    let target_name = normalize_optional_text(input.target_name.as_deref());
    let overwrite_duplicates = input.overwrite_duplicates.unwrap_or(true);
    let delete_source_after_merge = input.delete_source_after_merge.unwrap_or(true);

    if source_symbol == target_symbol && source_exchange == target_exchange {
        return Err("Source and target symbols must be different.".to_string());
    }

    let source_instrument =
        find_instrument_record(connection, &source_symbol, &source_exchange)?
            .ok_or_else(|| "Source symbol was not found in the current database.".to_string())?;
    let target_instrument = find_instrument_record(connection, &target_symbol, &target_exchange)?;

    let merged_rows: i64 = connection
        .query_row(
            "
              SELECT COUNT(*)
              FROM eod_prices
              WHERE symbol = ?
                AND exchange = ?
            ",
            params![source_symbol, source_exchange],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let merged_watchlist_items: i64 = connection
        .query_row(
            "
              SELECT COUNT(*)
              FROM watchlist_items
              WHERE symbol = ?
                AND exchange = ?
            ",
            params![source_symbol, source_exchange],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    let merged_name = if let Some(name) = target_name.clone() {
        Some(name)
    } else {
        target_instrument
            .as_ref()
            .and_then(|instrument| instrument.name.clone())
            .or_else(|| source_instrument.name.clone())
            .or(Some(source_instrument.symbol.clone()))
    };
    let merged_isin = target_instrument
        .as_ref()
        .and_then(|instrument| instrument.isin.clone())
        .or_else(|| source_instrument.isin.clone());
    let merged_series = target_instrument
        .as_ref()
        .and_then(|instrument| instrument.series.clone())
        .or_else(|| source_instrument.series.clone());
    let merged_sector = target_instrument
        .as_ref()
        .and_then(|instrument| instrument.sector.clone())
        .or_else(|| source_instrument.sector.clone());
    let merged_industry = target_instrument
        .as_ref()
        .and_then(|instrument| instrument.industry.clone())
        .or_else(|| source_instrument.industry.clone());

    run_connection_transaction(connection, |connection| {
        connection
            .execute(
                "
                  INSERT INTO instruments (
                    symbol,
                    exchange,
                    isin,
                    name,
                    series,
                    sector,
                    industry,
                    is_active,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                  ON CONFLICT(symbol, exchange) DO UPDATE SET
                    isin = excluded.isin,
                    name = excluded.name,
                    series = excluded.series,
                    sector = excluded.sector,
                    industry = excluded.industry,
                    is_active = excluded.is_active,
                    updated_at = excluded.updated_at
                ",
                params![
                    target_symbol,
                    target_exchange,
                    merged_isin,
                    merged_name,
                    merged_series,
                    merged_sector,
                    merged_industry,
                    1_i64,
                ],
            )
            .map_err(|error| error.to_string())?;

        let merge_price_sql = if overwrite_duplicates {
            "
              INSERT INTO eod_prices (
                symbol,
                exchange,
                date,
                open,
                high,
                low,
                close,
                prev_close,
                volume,
                trades,
                delivery_qty,
                delivery_pct
              )
              SELECT
                ?,
                ?,
                date,
                open,
                high,
                low,
                close,
                prev_close,
                volume,
                trades,
                delivery_qty,
                delivery_pct
              FROM eod_prices
              WHERE symbol = ?
                AND exchange = ?
              ON CONFLICT(symbol, exchange, date) DO UPDATE SET
                open = excluded.open,
                high = excluded.high,
                low = excluded.low,
                close = excluded.close,
                prev_close = excluded.prev_close,
                volume = excluded.volume,
                trades = excluded.trades,
                delivery_qty = excluded.delivery_qty,
                delivery_pct = excluded.delivery_pct
            "
        } else {
            "
              INSERT OR IGNORE INTO eod_prices (
                symbol,
                exchange,
                date,
                open,
                high,
                low,
                close,
                prev_close,
                volume,
                trades,
                delivery_qty,
                delivery_pct
              )
              SELECT
                ?,
                ?,
                date,
                open,
                high,
                low,
                close,
                prev_close,
                volume,
                trades,
                delivery_qty,
                delivery_pct
              FROM eod_prices
              WHERE symbol = ?
                AND exchange = ?
            "
        };

        connection
            .execute(
                merge_price_sql,
                params![
                    target_symbol,
                    target_exchange,
                    source_symbol,
                    source_exchange
                ],
            )
            .map_err(|error| error.to_string())?;

        connection
            .execute(
                "
                  INSERT OR IGNORE INTO watchlist_items (
                    watchlist_id,
                    symbol,
                    exchange,
                    added_at,
                    sort_order
                  )
                  SELECT
                    watchlist_id,
                    ?,
                    ?,
                    added_at,
                    sort_order
                  FROM watchlist_items
                  WHERE symbol = ?
                    AND exchange = ?
                ",
                params![
                    target_symbol,
                    target_exchange,
                    source_symbol,
                    source_exchange
                ],
            )
            .map_err(|error| error.to_string())?;

        if delete_source_after_merge {
            connection
                .execute(
                    "
                      DELETE FROM watchlist_items
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                    params![source_symbol, source_exchange],
                )
                .map_err(|error| error.to_string())?;
            connection
                .execute(
                    "
                      DELETE FROM eod_prices
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                    params![source_symbol, source_exchange],
                )
                .map_err(|error| error.to_string())?;
            connection
                .execute(
                    "
                      UPDATE instruments
                      SET is_active = 0,
                          updated_at = datetime('now')
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                    params![source_symbol, source_exchange],
                )
                .map_err(|error| error.to_string())?;
        }

        recompute_prev_close_for_symbol(connection, &target_symbol, &target_exchange)?;
        Ok(())
    })?;

    if let Some(folder_path) = base_path {
        let source_bin_path = folder_path
            .join("eod_data")
            .join(&source_exchange)
            .join(format!("{}.eod", source_symbol));
        let target_bin_path = folder_path
            .join("eod_data")
            .join(&target_exchange)
            .join(format!("{}.eod", target_symbol));

        if source_bin_path.exists() {
            let mut can_delete = false;
            match BinaryEodFile::open(&source_bin_path) {
                Ok(source_bin) => {
                    match source_bin.read_all() {
                        Ok(source_records) => {
                            if source_records.is_empty() {
                                can_delete = true;
                            } else {
                                let mut final_source_records = source_records;
                                let mut skip_binary_merge = false;

                                if !overwrite_duplicates && target_bin_path.exists() {
                                    match BinaryEodFile::open(&target_bin_path) {
                                        Ok(target_bin) => match target_bin.read_all() {
                                            Ok(target_records) => {
                                                let target_dates: HashSet<u32> = target_records
                                                    .into_iter()
                                                    .map(|r| r.date)
                                                    .collect();
                                                final_source_records
                                                    .retain(|r| !target_dates.contains(&r.date));
                                            }
                                            Err(e) => {
                                                eprintln!("Binary EOD target read failure for {} at {:?}: {}", target_symbol, target_bin_path, e);
                                                skip_binary_merge = true;
                                            }
                                        },
                                        Err(e) => {
                                            eprintln!(
                                                "Binary EOD target open failure for {} at {:?}: {}",
                                                target_symbol, target_bin_path, e
                                            );
                                            skip_binary_merge = true;
                                        }
                                    }
                                }

                                if !skip_binary_merge {
                                    if final_source_records.is_empty() {
                                        // Rule 5: Successful no-op (all records were duplicates)
                                        can_delete = true;
                                    } else {
                                        match BinaryEodFile::append_or_merge_records(
                                            &target_bin_path,
                                            &target_symbol,
                                            &target_exchange,
                                            DEFAULT_SCALE,
                                            final_source_records,
                                        ) {
                                            Ok(_) => can_delete = true,
                                            Err(e) => {
                                                eprintln!(
                                                    "Binary EOD merge failure for {}: {}",
                                                    target_symbol, e
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "Binary EOD source read failure for {}: {}",
                                source_symbol, e
                            )
                        }
                    }
                }
                Err(e) => eprintln!(
                    "Binary EOD source open failure for {}: {}",
                    source_symbol, e
                ),
            }

            if delete_source_after_merge && can_delete {
                if let Err(e) = std::fs::remove_file(&source_bin_path) {
                    eprintln!(
                        "Binary EOD merge delete failure for {}: {}",
                        source_symbol, e
                    );
                }
            }
        }
    }

    Ok(MergeSymbolsResult {
        merged_rows,
        merged_watchlist_items,
        target_symbol,
        target_exchange,
    })
}

pub(super) fn apply_corporate_action_internal(
    connection: &Connection,
    input: &CorporateActionInputPayload,
    base_path: Option<&Path>,
) -> AppResult<CorporateActionResult> {
    let action_type = normalize_corporate_action_type(&input.action_type)?;
    if matches!(
        action_type.as_str(),
        "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS"
    ) {
        return record_price_adjustment_action(connection, input, &action_type, base_path);
    }
    record_identity_change(connection, input, &action_type)
}

fn record_price_adjustment_action(
    connection: &Connection,
    input: &CorporateActionInputPayload,
    action_type: &str,
    base_path: Option<&Path>,
) -> AppResult<CorporateActionResult> {
    record_price_adjustment_action_with_basis(connection,input,action_type,base_path,None)
}

// Called only from the ordinary guarded official-import writer, never from IPC
// or manual numeric overrides. Independently rebuild the route inside its txn.
pub(super) fn apply_official_import_price_adjustment(
    connection: &Connection, input: &CorporateActionInputPayload, folder: &Path,
    import: &super::CorporateActionImportRow,
) -> AppResult<CorporateActionResult> {
    if input.symbol != import.symbol || input.exchange != import.exchange || Some(&input.effective_date) != import.ex_date.as_ref()
        || input.action_type != import.action_type || input.cash_amount != import.cash_amount {
        return Err("Official adjustment context changed.".into());
    }
    if !matches!(input.action_type.as_str(), "DIVIDEND"|"SPLIT"|"BONUS"|"RIGHTS") {
        return apply_corporate_action_internal(connection,input,Some(folder));
    }
    let route = super::corporate_action_imports::event_price_route::resolve(connection,folder,import)?;
    let previous = route.as_ref().map(|route|route.previous());
    let mut bound = input.clone();
    if let Some(route) = &route {
        bound.note = Some(format!("{}\n[eventPriceRouteR1={}]",input.note.as_deref().unwrap_or_default(),route.fingerprint()));
    }
    record_price_adjustment_action_with_basis(connection,&bound,&bound.action_type,Some(folder),previous)
}

fn record_price_adjustment_action_with_basis(
    connection: &Connection, input: &CorporateActionInputPayload, action_type: &str,
    base_path: Option<&Path>, verified_previous: Option<(&str,f64)>,
) -> AppResult<CorporateActionResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    let requested_symbol = normalize_symbol(
        input
            .symbol
            .as_deref()
            .or(input.current_symbol.as_deref())
            .or(input.new_symbol.as_deref())
            .or(input.old_symbol.as_deref())
            .unwrap_or(""),
    )?;
    let effective_date = super::normalize_trade_date(&input.effective_date)?;
    let context = resolve_instrument_context(connection, &requested_symbol, &exchange)?
        .ok_or_else(|| {
            "The selected instrument was not found in the active database.".to_string()
        })?;

    let factor = if let Some((previous_date,previous_close)) = verified_previous {
        if action_type == "DIVIDEND" {
            compute_dividend_adjustment_basis_from_values(previous_date.to_string(),previous_close,
                require_positive_adjustment_number(input.cash_amount,"Dividend cash amount per share")?)?.computed_factor
        } else if action_type == "RIGHTS" {
            compute_rights_adjustment_factor(previous_close,
                require_positive_adjustment_number(input.ratio_num,"Rights ratio numerator")?,
                require_positive_adjustment_number(input.ratio_den,"Rights ratio denominator")?,
                require_positive_adjustment_number(input.cash_amount,"Rights issue price")?)?
        } else { compute_adjustment_factor(connection,base_path,&context,&effective_date,action_type,input)? }
    } else { compute_adjustment_factor(
        connection,
        base_path,
        &context,
        &effective_date,
        action_type,
        input,
    )? };
    if !factor.is_finite() || factor <= 0.0 || (factor - 1.0).abs() < f64::EPSILON {
        return Err("The selected action needs valid adjustment inputs.".to_string());
    }

    let ratio_num = normalize_optional_number(input.ratio_num);
    let ratio_den = normalize_optional_number(input.ratio_den);
    let old_face_value = normalize_optional_number(input.old_face_value);
    let new_face_value = normalize_optional_number(input.new_face_value);
    let cash_amount = normalize_optional_number(input.cash_amount);
    let note = normalize_optional_text(input.note.as_deref()).unwrap_or_else(|| {
        build_default_action_note(action_type, ratio_num, ratio_den, cash_amount)
    });
    let record_date = normalize_optional_trade_date(input.record_date.as_deref())?;
    let source =
        normalize_optional_text(input.source.as_deref()).unwrap_or_else(|| "MANUAL".to_string());
    let source_ref = normalize_optional_text(input.source_ref.as_deref());
    let approved_action_isin = normalize_optional_text(input.isin.as_deref());

    let duplicate = connection
        .query_row(
            "
              SELECT id
              FROM corporate_actions
              WHERE exchange = ?
                AND effective_date = ?
                AND action_type = ?
                AND (
                  (? IS NOT NULL AND isin = ?)
                  OR symbol = ?
                )
                AND COALESCE(ratio_num, -1) = COALESCE(?, -1)
                AND COALESCE(ratio_den, -1) = COALESCE(?, -1)
                AND COALESCE(old_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(new_face_value, -1) = COALESCE(?, -1)
                AND COALESCE(cash_amount, -1) = COALESCE(?, -1)
            ",
            params![
                exchange.as_str(),
                effective_date.as_str(),
                action_type,
                context.isin.as_deref(),
                context.isin.as_deref(),
                context.current_symbol.as_str(),
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount
            ],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if duplicate.is_some() {
        return Err("This corporate action already exists.".to_string());
    }

    connection
        .execute(
            "
              INSERT INTO corporate_actions (
                symbol,
                exchange,
                isin,
                effective_date,
                record_date,
                action_type,
                factor,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount,
                adjust_volume,
                note,
                source,
                source_ref,
                created_at,
                updated_at,
                applied_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            ",
            params![
                context.current_symbol.as_str(),
                exchange.as_str(),
                context.isin.as_deref(),
                effective_date.as_str(),
                record_date,
                action_type,
                factor,
                ratio_num,
                ratio_den,
                old_face_value,
                new_face_value,
                cash_amount,
                if matches!(action_type, "DIVIDEND" | "RIGHTS") {
                    if input.adjust_volume == Some(true) {
                        1_i64
                    } else {
                        0_i64
                    }
                } else if input.adjust_volume == Some(false) {
                    0_i64
                } else {
                    1_i64
                },
                note,
                source.as_str(),
                source_ref.as_deref()
            ],
        )
        .map_err(|error| error.to_string())?;
    let stored_record_id = connection.last_insert_rowid();

    if let Some(isin) = approved_action_isin.as_deref() {
        upsert_instrument_isin_history_evidence(
            connection,
            &exchange,
            &context.current_symbol,
            isin,
            Some(effective_date.as_str()),
            Some(source.as_str()),
            source_ref.as_deref(),
            Some("Captured from approved corporate-action source evidence."),
        )?;
    }

    let affected_rows = count_rows_before_date(
        connection,
        &context.related_symbols,
        &exchange,
        &effective_date,
    )?;

    Ok(CorporateActionResult {
        stored_record_id,
        action_type: action_type.to_string(),
        exchange,
        effective_date,
        current_symbol: context.current_symbol,
        current_name: context.current_name,
        factor: Some(factor),
        affected_rows,
        message: match action_type {
            "SPLIT" => "Split saved. Raw prices were not changed.".to_string(),
            "BONUS" => "Bonus saved. Raw prices were not changed.".to_string(),
            "DIVIDEND" => "Dividend saved. Raw prices were not changed.".to_string(),
            "RIGHTS" => "Rights issue saved. Raw prices were not changed.".to_string(),
            _ => "Corporate action saved. Raw prices were not changed.".to_string(),
        },
    })
}

struct IdentityChangePersistence<'a> {
    exchange: &'a str,
    isin: Option<&'a str>,
    current_symbol: &'a str,
    current_name: Option<&'a str>,
    old_symbol: Option<&'a str>,
    old_name: Option<&'a str>,
    new_symbol: Option<&'a str>,
    new_name: Option<&'a str>,
    effective_date: &'a str,
    action_type: &'a str,
    source: &'a str,
    source_ref: Option<&'a str>,
}

fn persist_identity_change_in_open_transaction(
    connection: &Connection,
    change: &IdentityChangePersistence<'_>,
) -> AppResult<i64> {
    connection
        .execute(
            "
              INSERT INTO instrument_identity_history (
                exchange,
                isin,
                current_symbol,
                current_name,
                old_symbol,
                old_name,
                new_symbol,
                new_name,
                effective_date,
                change_type,
                source,
                source_ref,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ",
            params![
                change.exchange,
                change.isin,
                change.current_symbol,
                change.current_name,
                change.old_symbol,
                change.old_name,
                change.new_symbol,
                change.new_name,
                change.effective_date,
                change.action_type,
                change.source,
                change.source_ref
            ],
        )
        .map_err(|error| error.to_string())?;
    let stored_id = connection.last_insert_rowid();

    connection
        .execute(
            "
              INSERT INTO instruments (
                symbol,
                exchange,
                isin,
                name,
                is_active,
                updated_at
              )
              VALUES (?, ?, ?, ?, 1, datetime('now'))
              ON CONFLICT(symbol, exchange) DO UPDATE SET
                isin = COALESCE(excluded.isin, instruments.isin),
                name = COALESCE(excluded.name, instruments.name),
                is_active = 1,
                updated_at = excluded.updated_at
            ",
            params![
                change.current_symbol,
                change.exchange,
                change.isin,
                change.current_name
            ],
        )
        .map_err(|error| error.to_string())?;

    if let Some(symbol) = change.old_symbol {
        if symbol != change.current_symbol {
            connection
                .execute(
                    "
                      UPDATE instruments
                      SET is_active = 0,
                          updated_at = datetime('now')
                      WHERE symbol = ?
                        AND exchange = ?
                    ",
                    params![symbol, change.exchange],
                )
                .map_err(|error| error.to_string())?;
        }
    } else if let Some(name) = change.current_name {
        connection
            .execute(
                "
                  UPDATE instruments
                  SET name = ?,
                      updated_at = datetime('now')
                  WHERE symbol = ?
                    AND exchange = ?
                ",
                params![name, change.current_symbol, change.exchange],
            )
            .map_err(|error| error.to_string())?;
    }

    update_identity_current_metadata(
        connection,
        change.exchange,
        change.current_symbol,
        change.current_name,
        change.isin,
        change.old_symbol,
        change.new_symbol,
    )?;

    Ok(stored_id)
}

fn record_identity_change(
    connection: &Connection,
    input: &CorporateActionInputPayload,
    action_type: &str,
) -> AppResult<CorporateActionResult> {
    let exchange = normalize_exchange(&input.exchange)?;
    let seed_symbol = normalize_optional_symbol(
        input
            .current_symbol
            .as_deref()
            .or(input.new_symbol.as_deref())
            .or(input.old_symbol.as_deref())
            .or(input.symbol.as_deref()),
    )?;
    let resolved_context = if let Some(ref symbol) = seed_symbol {
        resolve_instrument_context(connection, symbol, &exchange)?
    } else {
        None
    };
    let effective_date = super::normalize_trade_date(&input.effective_date)?;
    let isin = normalize_optional_text(input.isin.as_deref()).or_else(|| {
        resolved_context
            .as_ref()
            .and_then(|context| context.isin.clone())
    });

    let old_symbol = normalize_optional_symbol(input.old_symbol.as_deref())?.or_else(|| {
        if action_type == "NAME_CHANGE" {
            resolved_context
                .as_ref()
                .map(|context| context.current_symbol.clone())
                .or_else(|| seed_symbol.clone())
        } else {
            None
        }
    });
    let new_symbol = normalize_optional_symbol(input.new_symbol.as_deref())?
        .or_else(|| {
            normalize_optional_symbol(input.current_symbol.as_deref())
                .ok()
                .flatten()
        })
        .or_else(|| {
            resolved_context
                .as_ref()
                .map(|context| context.current_symbol.clone())
        })
        .or_else(|| old_symbol.clone());

    let current_symbol = new_symbol
        .clone()
        .or_else(|| old_symbol.clone())
        .ok_or_else(|| "A current symbol is required for identity history.".to_string())?;

    let existing_current_instrument =
        find_instrument_record(connection, &current_symbol, &exchange)?;
    let old_instrument = if let Some(ref symbol) = old_symbol {
        find_instrument_record(connection, symbol, &exchange)?
    } else {
        None
    };

    let old_name = normalize_optional_text(input.old_name.as_deref())
        .or_else(|| {
            old_instrument
                .as_ref()
                .and_then(|instrument| instrument.name.clone())
        })
        .or_else(|| {
            resolved_context
                .as_ref()
                .and_then(|context| context.current_name.clone())
        })
        .or_else(|| {
            existing_current_instrument
                .as_ref()
                .and_then(|instrument| instrument.name.clone())
        });
    let new_name = normalize_optional_text(input.new_name.as_deref())
        .or_else(|| normalize_optional_text(input.current_name.as_deref()))
        .or_else(|| {
            existing_current_instrument
                .as_ref()
                .and_then(|instrument| instrument.name.clone())
        })
        .or_else(|| {
            resolved_context
                .as_ref()
                .and_then(|context| context.current_name.clone())
        })
        .or_else(|| old_name.clone());
    let current_name = normalize_optional_text(input.current_name.as_deref())
        .or_else(|| new_name.clone())
        .or_else(|| old_name.clone());
    let source =
        normalize_optional_text(input.source.as_deref()).unwrap_or_else(|| "MANUAL".to_string());
    let source_ref = normalize_optional_text(input.source_ref.as_deref());

    if action_type == "SYMBOL_CHANGE" || action_type == "BOTH" {
        if old_symbol.is_none() || new_symbol.is_none() || old_symbol == new_symbol {
            return Err("Symbol changes require different old and new symbols.".to_string());
        }
    }

    if action_type == "NAME_CHANGE" || action_type == "BOTH" {
        if old_name.is_none() || new_name.is_none() || old_name == new_name {
            return Err("Name changes require different old and new names.".to_string());
        }
    }

    let duplicate = connection
        .query_row(
            "
              SELECT id
              FROM instrument_identity_history
              WHERE exchange = ?
                AND effective_date = ?
                AND change_type = ?
                AND COALESCE(old_symbol, '') = COALESCE(?, '')
                AND COALESCE(new_symbol, '') = COALESCE(?, '')
                AND COALESCE(old_name, '') = COALESCE(?, '')
                AND COALESCE(new_name, '') = COALESCE(?, '')
            ",
            params![
                exchange,
                effective_date,
                action_type,
                old_symbol,
                new_symbol,
                old_name,
                new_name
            ],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if duplicate.is_some() {
        return Err("This identity change already exists.".to_string());
    }

    let persistence = IdentityChangePersistence {
        exchange: &exchange,
        isin: isin.as_deref(),
        current_symbol: &current_symbol,
        current_name: current_name.as_deref(),
        old_symbol: old_symbol.as_deref(),
        old_name: old_name.as_deref(),
        new_symbol: new_symbol.as_deref(),
        new_name: new_name.as_deref(),
        effective_date: &effective_date,
        action_type,
        source: &source,
        source_ref: source_ref.as_deref(),
    };

    let stored_record_id = if connection.is_autocommit() {
        run_connection_transaction(connection, |connection| {
            persist_identity_change_in_open_transaction(connection, &persistence)
        })?
    } else {
        persist_identity_change_in_open_transaction(connection, &persistence)?
    };

    Ok(CorporateActionResult {
        stored_record_id,
        action_type: action_type.to_string(),
        exchange,
        effective_date,
        current_symbol,
        current_name,
        factor: None,
        affected_rows: 0,
        message: "Identity history saved.".to_string(),
    })
}

fn update_identity_current_metadata(
    connection: &Connection,
    exchange: &str,
    current_symbol: &str,
    current_name: Option<&str>,
    isin: Option<&str>,
    old_symbol: Option<&str>,
    new_symbol: Option<&str>,
) -> AppResult<()> {
    connection
        .execute(
            "
              UPDATE instrument_identity_history
              SET current_symbol = ?,
                  current_name = ?,
                  isin = COALESCE(?, isin),
                  updated_at = datetime('now')
              WHERE exchange = ?
                AND (
                  current_symbol = ?
                  OR (? IS NOT NULL AND old_symbol = ?)
                  OR (? IS NOT NULL AND new_symbol = ?)
                  OR (? IS NOT NULL AND isin = ?)
                )
            ",
            params![
                current_symbol,
                current_name,
                isin,
                exchange,
                current_symbol,
                old_symbol,
                old_symbol,
                new_symbol,
                new_symbol,
                isin,
                isin
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(super) fn upsert_instrument_isin_history_evidence(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: Option<&str>,
    source: Option<&str>,
    source_ref: Option<&str>,
    note: Option<&str>,
) -> AppResult<()> {
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_isin = normalize_optional_text(Some(isin))
        .ok_or_else(|| "ISIN evidence requires an ISIN.".to_string())?;
    let normalized_effective_date = super::normalize_optional_trade_date(effective_date)?;
    let normalized_source = normalize_optional_text(source);
    let normalized_source_ref = normalize_optional_text(source_ref);
    let normalized_note = normalize_optional_text(note);

    let existing_id = connection
        .query_row(
            "
              SELECT id
              FROM instrument_isin_history
              WHERE exchange = ?
                AND symbol = ?
                AND isin = ?
                AND COALESCE(effective_date, '') = COALESCE(?, '')
              LIMIT 1
            ",
            params![
                normalized_exchange,
                normalized_symbol,
                normalized_isin,
                normalized_effective_date
            ],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(existing_id) = existing_id {
        connection
            .execute(
                "
                  UPDATE instrument_isin_history
                  SET source = COALESCE(?, source),
                      source_ref = COALESCE(?, source_ref),
                      note = COALESCE(?, note),
                      updated_at = datetime('now')
                  WHERE id = ?
                ",
                params![
                    normalized_source,
                    normalized_source_ref,
                    normalized_note,
                    existing_id
                ],
            )
            .map_err(|error| error.to_string())?;
        promote_matching_pending_isin_mismatch_imports(
            connection,
            &normalized_exchange,
            &normalized_symbol,
            &normalized_isin,
            normalized_effective_date.as_deref(),
        )?;
        return Ok(());
    }

    connection
        .execute(
            "
              INSERT INTO instrument_isin_history (
                exchange,
                symbol,
                isin,
                effective_date,
                source,
                source_ref,
                note,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ",
            params![
                normalized_exchange,
                normalized_symbol,
                normalized_isin,
                normalized_effective_date,
                normalized_source,
                normalized_source_ref,
                normalized_note
            ],
        )
        .map_err(|error| error.to_string())?;

    promote_matching_pending_isin_mismatch_imports(
        connection,
        &normalized_exchange,
        &normalized_symbol,
        &normalized_isin,
        normalized_effective_date.as_deref(),
    )?;

    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum StrictHistoricalIsinInsertOutcome {
    Inserted(i64),
    MatchingV192Row(i64),
    ExistingExternalMatch(i64),
    Conflict {
        existing_id: i64,
        existing_isin: String,
    },
}

pub(super) fn insert_historical_isin_evidence_strict_no_promotion(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: &str,
    source: &str,
    source_ref: Option<&str>,
    note: &str,
) -> AppResult<StrictHistoricalIsinInsertOutcome> {
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_isin = normalize_optional_text(Some(isin))
        .ok_or_else(|| "Strict historical ISIN evidence requires an ISIN.".to_string())?;
    let normalized_effective_date = super::normalize_trade_date(effective_date)?;
    let normalized_source = normalize_optional_text(Some(source))
        .ok_or_else(|| "Strict historical ISIN evidence requires a source.".to_string())?;
    let normalized_source_ref = normalize_optional_text(source_ref);
    let normalized_note = normalize_optional_text(Some(note))
        .ok_or_else(|| "Strict historical ISIN evidence requires a provenance note.".to_string())?;

    let mut statement = connection
        .prepare(
            "
              SELECT id, isin, note
              FROM instrument_isin_history
              WHERE exchange = ?
                AND symbol = ?
                AND COALESCE(effective_date, '') = ?
              ORDER BY id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                normalized_exchange.as_str(),
                normalized_symbol.as_str(),
                normalized_effective_date.as_str()
            ],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if rows.len() > 1 {
        return Err(format!(
            "Strict historical ISIN insert found {} exact exchange/symbol/date rows; manual investigation is required.",
            rows.len()
        ));
    }
    if let Some((existing_id, existing_isin, existing_note)) = rows.into_iter().next() {
        if existing_isin == normalized_isin {
            if existing_note
                .as_deref()
                .map(|value| value.starts_with("V1.9.2 controlled historical-ISIN bootstrap;"))
                .unwrap_or(false)
            {
                return Ok(StrictHistoricalIsinInsertOutcome::MatchingV192Row(
                    existing_id,
                ));
            }
            return Ok(StrictHistoricalIsinInsertOutcome::ExistingExternalMatch(
                existing_id,
            ));
        }
        return Ok(StrictHistoricalIsinInsertOutcome::Conflict {
            existing_id,
            existing_isin,
        });
    }

    connection
        .execute(
            "
              INSERT INTO instrument_isin_history (
                exchange,
                symbol,
                isin,
                effective_date,
                source,
                source_ref,
                note,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ",
            params![
                normalized_exchange,
                normalized_symbol,
                normalized_isin,
                normalized_effective_date,
                normalized_source,
                normalized_source_ref,
                normalized_note,
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(StrictHistoricalIsinInsertOutcome::Inserted(
        connection.last_insert_rowid(),
    ))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum V113B1StrictHistoricalIsinInsertOutcome {
    Inserted(i64),
    MatchingAuthorizedRow(i64),
    ExistingExternalMatch(i64),
    Conflict {
        existing_id: i64,
        existing_isin: String,
    },
}

/// V1.13B-1 additive strict historical-ISIN writer.
///
/// This intentionally does not call the ordinary upsert path and therefore has
/// no Corporate Action promotion side effect. An existing row is idempotent
/// only when the exact authorized source/source_ref/note provenance matches.
pub(super) fn insert_historical_isin_evidence_v113b1_strict_no_promotion(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: &str,
    source: &str,
    source_ref: Option<&str>,
    note: &str,
) -> AppResult<V113B1StrictHistoricalIsinInsertOutcome> {
    let normalized_exchange = normalize_exchange(exchange)?;
    let normalized_symbol = normalize_symbol(symbol)?;
    let normalized_isin = normalize_optional_text(Some(isin))
        .ok_or_else(|| "V1.13B-1 historical ISIN evidence requires an ISIN.".to_string())?;
    let normalized_effective_date = super::normalize_trade_date(effective_date)?;
    let normalized_source = normalize_optional_text(Some(source))
        .ok_or_else(|| "V1.13B-1 historical ISIN evidence requires a source.".to_string())?;
    let normalized_source_ref = normalize_optional_text(source_ref);
    let normalized_note = normalize_optional_text(Some(note)).ok_or_else(|| {
        "V1.13B-1 historical ISIN evidence requires a provenance note.".to_string()
    })?;

    let mut statement = connection
        .prepare(
            "
              SELECT id, isin, source, source_ref, note
              FROM instrument_isin_history
              WHERE exchange = ?
                AND symbol = ?
                AND COALESCE(effective_date, '') = ?
              ORDER BY id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                normalized_exchange.as_str(),
                normalized_symbol.as_str(),
                normalized_effective_date.as_str()
            ],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if rows.len() > 1 {
        return Err(format!(
            "V1.13B-1 strict historical ISIN insert found {} exact exchange/symbol/date rows; manual investigation is required.",
            rows.len()
        ));
    }

    if let Some((existing_id, existing_isin, existing_source, existing_source_ref, existing_note)) =
        rows.into_iter().next()
    {
        if existing_isin == normalized_isin {
            let provenance_matches = normalize_optional_text(existing_source.as_deref())
                == Some(normalized_source.clone())
                && normalize_optional_text(existing_source_ref.as_deref()) == normalized_source_ref
                && normalize_optional_text(existing_note.as_deref())
                    == Some(normalized_note.clone());
            if provenance_matches {
                return Ok(
                    V113B1StrictHistoricalIsinInsertOutcome::MatchingAuthorizedRow(existing_id),
                );
            }
            return Ok(V113B1StrictHistoricalIsinInsertOutcome::ExistingExternalMatch(existing_id));
        }
        return Ok(V113B1StrictHistoricalIsinInsertOutcome::Conflict {
            existing_id,
            existing_isin,
        });
    }

    connection
        .execute(
            "
              INSERT INTO instrument_isin_history (
                exchange,
                symbol,
                isin,
                effective_date,
                source,
                source_ref,
                note,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ",
            params![
                normalized_exchange,
                normalized_symbol,
                normalized_isin,
                normalized_effective_date,
                normalized_source,
                normalized_source_ref,
                normalized_note,
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(V113B1StrictHistoricalIsinInsertOutcome::Inserted(
        connection.last_insert_rowid(),
    ))
}

fn promote_matching_pending_isin_mismatch_imports(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: Option<&str>,
) -> AppResult<()> {
    connection
        .execute(
            "
              UPDATE corporate_action_imports
              SET review_status = 'PENDING',
                  message = 'Exact symbol matched, and the same official ISIN was already confirmed for this event date in the database.'
              WHERE review_status = 'PENDING_ISIN_MISMATCH'
                AND exchange = ?
                AND symbol = ?
                AND isin = ?
                AND COALESCE(ex_date, '') = COALESCE(?, '')
            ",
            params![exchange, symbol, isin, effective_date],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn count_rows_before_date(
    connection: &Connection,
    symbols: &[String],
    exchange: &str,
    effective_date: &str,
) -> AppResult<i64> {
    let unique_symbols = symbols
        .iter()
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if unique_symbols.is_empty() {
        return Ok(0);
    }

    let sql = format!(
        "
          SELECT COUNT(*)
          FROM eod_prices
          WHERE exchange = ?
            AND date < ?
            AND symbol IN ({})
        ",
        question_marks(unique_symbols.len())
    );
    let mut values = vec![
        Value::Text(exchange.to_string()),
        Value::Text(effective_date.to_string()),
    ];
    values.extend(unique_symbols.into_iter().map(Value::Text));
    connection
        .query_row(&sql, params_from_iter(values), |row| row.get::<_, i64>(0))
        .map_err(|error| error.to_string())
}

fn normalize_optional_symbol(value: Option<&str>) -> AppResult<Option<String>> {
    match value {
        Some(raw) if !raw.trim().is_empty() => Ok(Some(normalize_symbol(raw)?)),
        _ => Ok(None),
    }
}

fn normalize_optional_number(value: Option<f64>) -> Option<f64> {
    value.filter(|numeric| numeric.is_finite())
}

fn normalize_corporate_action_type(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_uppercase();
    match normalized.as_str() {
        "SPLIT" | "BONUS" | "DIVIDEND" | "RIGHTS" | "NAME_CHANGE" | "SYMBOL_CHANGE" | "BOTH" => {
            Ok(normalized)
        }
        _ => Err(format!("Unsupported action type: {value}")),
    }
}

fn compute_adjustment_factor(
    connection: &Connection,
    base_path: Option<&Path>,
    context: &super::ResolvedInstrumentContext,
    effective_date: &str,
    action_type: &str,
    input: &CorporateActionInputPayload,
) -> AppResult<f64> {
    if action_type == "DIVIDEND" {
        return Ok(load_dividend_adjustment_basis(
            connection,
            base_path,
            context,
            effective_date,
            input.cash_amount,
        )?
        .computed_factor);
    }

    if action_type == "RIGHTS" {
        let ratio_num =
            require_positive_adjustment_number(input.ratio_num, "Rights ratio numerator")?;
        let ratio_den =
            require_positive_adjustment_number(input.ratio_den, "Rights ratio denominator")?;
        let issue_price =
            require_positive_adjustment_number(input.cash_amount, "Rights issue price")?;
        let previous_close =
            load_previous_trade_close(connection, base_path, context, effective_date)?;
        return compute_rights_adjustment_factor(previous_close, ratio_num, ratio_den, issue_price);
    }

    let factor_from_face_value = match (input.old_face_value, input.new_face_value) {
        (Some(old_value), Some(new_value))
            if old_value.is_finite()
                && new_value.is_finite()
                && old_value > 0.0
                && new_value > 0.0 =>
        {
            Some(old_value / new_value)
        }
        _ => None,
    };
    let ratio_num = normalize_optional_number(input.ratio_num);
    let ratio_den = normalize_optional_number(input.ratio_den);

    if let Some(factor) = factor_from_face_value {
        return Ok(factor);
    }

    if let (Some(num), Some(den)) = (ratio_num, ratio_den) {
        if den > 0.0 {
            if action_type == "SPLIT" {
                return Ok(num / den);
            }
            return Ok((num + den) / den);
        }
    }

    // Neither face-value pair nor ratio was present — cannot compute a factor.
    Err(
        "The selected action requires either a face-value pair (old/new) or a ratio \
         (num:den) to compute an adjustment factor."
            .to_string(),
    )
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct DividendAdjustmentBasis {
    pub(super) previous_trade_date: String,
    pub(super) previous_close: f64,
    pub(super) cash_amount: f64,
    pub(super) computed_factor: f64,
}

#[derive(Clone, Debug, PartialEq)]
struct PreviousTradeCloseBasis {
    previous_trade_date: String,
    previous_close: f64,
}

pub(super) fn load_dividend_adjustment_basis(
    connection: &Connection,
    base_path: Option<&Path>,
    context: &super::ResolvedInstrumentContext,
    effective_date: &str,
    cash_amount: Option<f64>,
) -> AppResult<DividendAdjustmentBasis> {
    let cash_amount =
        require_positive_adjustment_number(cash_amount, "Dividend cash amount per share")?;
    let previous = load_previous_trade_close_basis(connection, base_path, context, effective_date)?;
    compute_dividend_adjustment_basis_from_values(
        previous.previous_trade_date,
        previous.previous_close,
        cash_amount,
    )
}

pub(super) fn compute_dividend_adjustment_basis_from_values(
    previous_trade_date: String,
    previous_close: f64,
    cash_amount: f64,
) -> AppResult<DividendAdjustmentBasis> {
    if cash_amount >= previous_close {
        return Err("Dividend amount must be smaller than the local previous close.".to_string());
    }
    let ex_basis = previous_close - cash_amount;
    if ex_basis <= 0.0 {
        return Err("Dividend adjustment produced a non-positive ex-basis price.".to_string());
    }
    Ok(DividendAdjustmentBasis {
        previous_trade_date,
        previous_close,
        cash_amount,
        computed_factor: previous_close / ex_basis,
    })
}

fn require_positive_adjustment_number(value: Option<f64>, label: &str) -> AppResult<f64> {
    let value = normalize_optional_number(value)
        .ok_or_else(|| format!("{label} is required and must be finite."))?;
    if value <= 0.0 {
        return Err(format!("{label} must be greater than zero."));
    }
    Ok(value)
}

fn compute_rights_adjustment_factor(
    previous_close: f64,
    ratio_num: f64,
    ratio_den: f64,
    issue_price: f64,
) -> AppResult<f64> {
    if !previous_close.is_finite() || previous_close <= 0.0 {
        return Err("Rights issue adjustment requires a positive previous close.".to_string());
    }
    let denominator = ratio_den + ratio_num;
    let numerator = (ratio_den * previous_close) + (ratio_num * issue_price);
    if !denominator.is_finite() || denominator <= 0.0 || !numerator.is_finite() {
        return Err("Rights issue adjustment produced an invalid TERP.".to_string());
    }
    let terp = numerator / denominator;
    if !terp.is_finite() || terp <= 0.0 {
        return Err("Rights issue adjustment produced an invalid TERP.".to_string());
    }
    let factor = previous_close / terp;
    if !factor.is_finite() || factor <= 0.0 {
        return Err("Rights issue adjustment produced an invalid factor.".to_string());
    }
    Ok(factor)
}

fn build_default_action_note(
    action_type: &str,
    ratio_num: Option<f64>,
    ratio_den: Option<f64>,
    cash_amount: Option<f64>,
) -> String {
    if action_type == "DIVIDEND" {
        return format!(
            "Dividend Rs {} per share",
            trim_numeric_string(cash_amount.unwrap_or_default())
        );
    }

    if action_type == "RIGHTS" {
        let ratio_text = match (ratio_num, ratio_den) {
            (Some(num), Some(den)) => {
                format!(" {}:{}", trim_numeric_string(num), trim_numeric_string(den))
            }
            _ => String::new(),
        };
        let price_text = cash_amount
            .map(|value| format!(" @ Rs {}", trim_numeric_string(value)))
            .unwrap_or_default();
        return format!("Rights issue{ratio_text}{price_text}");
    }

    if let (Some(num), Some(den)) = (ratio_num, ratio_den) {
        return format!(
            "{} {}:{}",
            if action_type == "SPLIT" {
                "Split"
            } else {
                "Bonus"
            },
            super::trim_numeric_string(num),
            super::trim_numeric_string(den)
        );
    }

    if action_type == "SPLIT" {
        "Split".to_string()
    } else {
        "Bonus".to_string()
    }
}

fn load_previous_trade_close_basis(
    connection: &Connection,
    base_path: Option<&Path>,
    context: &super::ResolvedInstrumentContext,
    effective_date: &str,
) -> AppResult<PreviousTradeCloseBasis> {
    let base_path = base_path.ok_or_else(|| {
        "Price adjustments need the active database folder to load local price history.".to_string()
    })?;
    let rows = super::eod_data::load_unified_price_rows(
        base_path,
        connection,
        context,
        "1900-01-01",
        effective_date,
    )?;
    rows.into_iter()
        .rev()
        .find(|row| row.date.as_str() < effective_date)
        .map(|row| PreviousTradeCloseBasis {
            previous_trade_date: row.date,
            previous_close: row.close,
        })
        .ok_or_else(|| {
            "No local previous trading-day close was found before the effective date.".to_string()
        })
}

fn load_previous_trade_close(
    connection: &Connection,
    base_path: Option<&Path>,
    context: &super::ResolvedInstrumentContext,
    effective_date: &str,
) -> AppResult<f64> {
    Ok(
        load_previous_trade_close_basis(connection, base_path, context, effective_date)?
            .previous_close,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_database_connection;

    #[test]
    fn dividend_basis_shared_seam_preserves_factor_math_and_trade_date() {
        let basis =
            compute_dividend_adjustment_basis_from_values("2026-08-13".to_string(), 100.0, 5.0)
                .unwrap();
        assert_eq!(basis.previous_trade_date, "2026-08-13");
        assert_eq!(basis.previous_close, 100.0);
        assert_eq!(basis.cash_amount, 5.0);
        assert_eq!(basis.computed_factor, 100.0 / 95.0);
    }

    #[test]
    fn dividend_basis_shared_seam_preserves_cash_not_smaller_error() {
        for cash_amount in [100.0, 101.0] {
            assert_eq!(
                compute_dividend_adjustment_basis_from_values(
                    "2026-08-13".to_string(),
                    100.0,
                    cash_amount,
                )
                .unwrap_err(),
                "Dividend amount must be smaller than the local previous close."
            );
        }
    }

    #[test]
    fn dividend_basis_shared_seam_preserves_nonpositive_previous_close_error_precedence() {
        for previous_close in [0.0, -1.0] {
            assert_eq!(
                compute_dividend_adjustment_basis_from_values(
                    "2026-08-13".to_string(),
                    previous_close,
                    1.0,
                )
                .unwrap_err(),
                "Dividend amount must be smaller than the local previous close."
            );
        }
    }

    #[test]
    fn dividend_basis_shared_seam_does_not_add_new_nan_validation() {
        let basis =
            compute_dividend_adjustment_basis_from_values("2026-08-13".to_string(), f64::NAN, 1.0)
                .unwrap();
        assert!(basis.computed_factor.is_nan());
    }

    #[test]
    fn dividend_basis_shared_seam_exact_math_has_no_new_rounding() {
        let basis =
            compute_dividend_adjustment_basis_from_values("2026-08-13".to_string(), 0.3, 0.1)
                .unwrap();
        assert_eq!(basis.computed_factor, 0.3 / (0.3 - 0.1));
    }

    #[test]
    fn phase5a_adjustment_inputs_reject_nonpositive_values() {
        assert!(
            require_positive_adjustment_number(Some(0.0), "Dividend cash")
                .unwrap_err()
                .contains("greater than zero")
        );
        assert!(
            require_positive_adjustment_number(Some(-1.0), "Rights issue price")
                .unwrap_err()
                .contains("greater than zero")
        );
        assert!(
            require_positive_adjustment_number(None, "Rights ratio numerator")
                .unwrap_err()
                .contains("required and must be finite")
        );
    }

    #[test]
    fn phase5a_adjustment_inputs_reject_invalid_rights_terp() {
        let error =
            compute_rights_adjustment_factor(f64::MAX, f64::MAX, f64::MAX, f64::MAX).unwrap_err();
        assert!(error.contains("invalid TERP"));

        let factor = compute_rights_adjustment_factor(100.0, 1.0, 4.0, 80.0).unwrap();
        assert!((factor - (100.0 / 96.0)).abs() < 1e-12);
    }

    #[test]
    fn i4_identity_transaction_preserves_standalone_atomicity_and_respects_outer_rollback() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO instruments (symbol, exchange, isin, name, is_active, series) VALUES ('OLDCO', 'NSE', 'INEOLD1', 'Old Company', 1, 'EQ')",
                [],
            )
            .unwrap();
        let payload = CorporateActionInputPayload {
            action_type: "SYMBOL_CHANGE".to_string(),
            exchange: "NSE".to_string(),
            effective_date: "2026-01-01".to_string(),
            symbol: Some("NEWCO".to_string()),
            isin: Some("INENEW1".to_string()),
            record_date: None,
            ratio_num: None,
            ratio_den: None,
            old_face_value: None,
            new_face_value: None,
            cash_amount: None,
            adjust_volume: None,
            old_symbol: Some("OLDCO".to_string()),
            old_name: None,
            new_symbol: Some("NEWCO".to_string()),
            new_name: None,
            current_symbol: Some("NEWCO".to_string()),
            current_name: Some("New Company".to_string()),
            note: Some("I4 transaction test".to_string()),
            source: Some("TEST".to_string()),
            source_ref: Some("fixture".to_string()),
        };

        connection
            .execute_batch(
                "
                  CREATE TRIGGER i4_fail_identity_instrument_upsert
                  BEFORE INSERT ON instruments
                  WHEN NEW.symbol = 'NEWCO' AND NEW.exchange = 'NSE'
                  BEGIN
                    SELECT RAISE(FAIL, 'i4 injected identity instrument failure');
                  END;
                ",
            )
            .unwrap();
        let error = apply_corporate_action_internal(&connection, &payload, None)
            .expect_err("standalone identity failure must roll back its history insert");
        assert!(error.contains("i4 injected identity instrument failure"));
        let history_after_failure: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_identity_history", [], |row| row.get(0))
            .unwrap();
        assert_eq!(history_after_failure, 0);

        connection
            .execute_batch("DROP TRIGGER i4_fail_identity_instrument_upsert")
            .unwrap();
        connection.execute_batch("BEGIN IMMEDIATE TRANSACTION").unwrap();
        apply_corporate_action_internal(&connection, &payload, None).unwrap();
        let history_inside_outer: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_identity_history", [], |row| row.get(0))
            .unwrap();
        assert_eq!(history_inside_outer, 1);
        connection.execute_batch("ROLLBACK").unwrap();

        let history_after_outer_rollback: i64 = connection
            .query_row("SELECT COUNT(*) FROM instrument_identity_history", [], |row| row.get(0))
            .unwrap();
        let new_symbol_rows: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM instruments WHERE symbol = 'NEWCO' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let old_is_active: i64 = connection
            .query_row(
                "SELECT is_active FROM instruments WHERE symbol = 'OLDCO' AND exchange = 'NSE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(history_after_outer_rollback, 0);
        assert_eq!(new_symbol_rows, 0);
        assert_eq!(old_is_active, 1);
    }

    #[test]
    fn price_adjustment_keeps_corporate_action_id_after_isin_evidence_insert() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();

        connection
            .execute(
                "
                  INSERT INTO instrument_isin_history (
                    exchange, symbol, isin, effective_date, source, created_at, updated_at
                  )
                  VALUES ('NSE', 'SEED', 'INE000A00001', '2026-01-01', 'TEST', datetime('now'), datetime('now'))
                ",
                [],
            )
            .unwrap();
        connection
            .execute(
                "
                  INSERT INTO instruments (symbol, exchange, isin, name, is_active, series)
                  VALUES ('CUB', 'NSE', 'INE491A01021', 'City Union Bank Limited', 1, 'EQ')
                ",
                [],
            )
            .unwrap();

        let result = apply_corporate_action_internal(
            &connection,
            &CorporateActionInputPayload {
                action_type: "BONUS".to_string(),
                exchange: "NSE".to_string(),
                effective_date: "2026-06-12".to_string(),
                symbol: Some("CUB".to_string()),
                isin: Some("INE491A01021".to_string()),
                record_date: None,
                ratio_num: Some(1.0),
                ratio_den: Some(3.0),
                old_face_value: None,
                new_face_value: None,
                cash_amount: None,
                adjust_volume: Some(true),
                old_symbol: None,
                old_name: None,
                new_symbol: None,
                new_name: None,
                current_symbol: Some("CUB".to_string()),
                current_name: Some("City Union Bank Limited".to_string()),
                note: Some("Bonus 1:3".to_string()),
                source: Some("NSE_API".to_string()),
                source_ref: Some("https://example.test/cub".to_string()),
            },
            None,
        )
        .unwrap();

        let corporate_action_id: i64 = connection
            .query_row(
                "SELECT id FROM corporate_actions WHERE symbol = 'CUB' AND effective_date = '2026-06-12'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let evidence_id: i64 = connection
            .query_row(
                "SELECT id FROM instrument_isin_history WHERE symbol = 'CUB' AND effective_date = '2026-06-12'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(result.stored_record_id, corporate_action_id);
        assert_ne!(result.stored_record_id, evidence_id);
    }

    #[test]
    fn upsert_instrument_isin_history_evidence_promotes_matching_pending_mismatch_rows() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();

        connection
            .execute(
                "
                  INSERT INTO corporate_action_imports (
                    dedupe_key,
                    exchange,
                    source,
                    symbol,
                    isin,
                    company_name,
                    purpose_raw,
                    ex_date,
                    action_type,
                    parse_status,
                    review_status,
                    message
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    "trent-live-mismatch",
                    "NSE",
                    "NSE_API",
                    "TRENT",
                    "INE849A09999",
                    "TRENT LIMITED",
                    "Bonus 1:2",
                    "2026-06-04",
                    "BONUS",
                    "PARSED",
                    "PENDING_ISIN_MISMATCH",
                    "stale mismatch"
                ],
            )
            .unwrap();

        upsert_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "TRENT",
            "INE849A09999",
            Some("2026-06-04"),
            Some("NSE_API"),
            Some("https://example.test/trent"),
            Some("live evidence"),
        )
        .unwrap();

        let (review_status, message): (String, Option<String>) = connection
            .query_row(
                "
                  SELECT review_status, message
                  FROM corporate_action_imports
                  WHERE dedupe_key = 'trent-live-mismatch'
                ",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(review_status, "PENDING");
        assert_eq!(
            message.as_deref(),
            Some(
                "Exact symbol matched, and the same official ISIN was already confirmed for this event date in the database."
            )
        );
    }

    #[test]
    fn upsert_instrument_isin_history_evidence_leaves_other_mismatch_rows_unchanged() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();

        connection
            .execute(
                "
                  INSERT INTO corporate_action_imports (
                    dedupe_key,
                    exchange,
                    source,
                    symbol,
                    isin,
                    company_name,
                    purpose_raw,
                    ex_date,
                    action_type,
                    parse_status,
                    review_status
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    "trent-still-live-mismatch",
                    "NSE",
                    "NSE_API",
                    "TRENT",
                    "INE849A09999",
                    "TRENT LIMITED",
                    "Bonus 1:2",
                    "2026-06-04",
                    "BONUS",
                    "PARSED",
                    "PENDING_ISIN_MISMATCH"
                ],
            )
            .unwrap();

        upsert_instrument_isin_history_evidence(
            &connection,
            "NSE",
            "TRENT",
            "INE849A09999",
            Some("2026-06-05"),
            Some("NSE_API"),
            None,
            Some("different-date evidence"),
        )
        .unwrap();

        let review_status: String = connection
            .query_row(
                "
                  SELECT review_status
                  FROM corporate_action_imports
                  WHERE dedupe_key = 'trent-still-live-mismatch'
                ",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(review_status, "PENDING_ISIN_MISMATCH");
    }

    #[test]
    fn phase1_v192_strict_insert_adds_exact_history_without_promoting_imports() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO corporate_action_imports (dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            params!["v192-pending","NSE","NSE_API","ABC","INE000A01010","ABC LIMITED","Split 10 to 5","2020-01-15","SPLIT","PARSED","PENDING_ISIN_MISMATCH"],
        ).unwrap();

        let outcome = insert_historical_isin_evidence_strict_no_promotion(
            &connection,
            "NSE",
            "ABC",
            "INE000A01010",
            "2020-01-15",
            "NSE_API",
            Some("https://www.nseindia.com/api/corporates-corporateActions"),
            "V1.9.2 controlled historical-ISIN bootstrap; importIds=1; evidenceIds=1; candidateFingerprints=abc; planFingerprint=def",
        ).unwrap();
        assert!(matches!(
            outcome,
            StrictHistoricalIsinInsertOutcome::Inserted(_)
        ));
        let status: String = connection.query_row(
            "SELECT review_status FROM corporate_action_imports WHERE dedupe_key='v192-pending'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(status, "PENDING_ISIN_MISMATCH");
    }

    #[test]
    fn phase1_v192_strict_insert_rejects_conflicting_exact_date_isin() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date,source,note,created_at,updated_at) VALUES ('NSE','ABC','INE999Z01010','2020-01-15','TEST','external',datetime('now'),datetime('now'))",
            [],
        ).unwrap();
        let outcome = insert_historical_isin_evidence_strict_no_promotion(
            &connection,"NSE","ABC","INE000A01010","2020-01-15","NSE_API",None,
            "V1.9.2 controlled historical-ISIN bootstrap; importIds=1; evidenceIds=1; candidateFingerprints=abc; planFingerprint=def",
        ).unwrap();
        assert_eq!(
            outcome,
            StrictHistoricalIsinInsertOutcome::Conflict {
                existing_id: 1,
                existing_isin: "INE999Z01010".to_string()
            }
        );
    }

    #[test]
    fn phase1_v192_strict_insert_does_not_modify_unrelated_pending_isin_mismatch() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO corporate_action_imports (dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status) VALUES ('unrelated','NSE','NSE_API','ABC','INE000A01010','ABC LIMITED','Split','2020-01-15','SPLIT','PARSED','PENDING_ISIN_MISMATCH')",
            [],
        ).unwrap();
        let _ = insert_historical_isin_evidence_strict_no_promotion(
            &connection,"NSE","ABC","INE000A01010","2020-01-15","NSE_API",None,
            "V1.9.2 controlled historical-ISIN bootstrap; importIds=99; evidenceIds=99; candidateFingerprints=abc; planFingerprint=def",
        ).unwrap();
        let status: String = connection
            .query_row(
                "SELECT review_status FROM corporate_action_imports WHERE dedupe_key='unrelated'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "PENDING_ISIN_MISMATCH");
    }

    #[test]
    fn phase1_v192_strict_insert_recognizes_matching_v192_provenance() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date,source,note,created_at,updated_at) VALUES ('NSE','ABC','INE000A01010','2020-01-15','NSE_API','V1.9.2 controlled historical-ISIN bootstrap; importIds=1; evidenceIds=1; candidateFingerprints=abc; planFingerprint=def',datetime('now'),datetime('now'))",
            [],
        ).unwrap();
        let outcome = insert_historical_isin_evidence_strict_no_promotion(
            &connection,"NSE","ABC","INE000A01010","2020-01-15","NSE_API",None,
            "V1.9.2 controlled historical-ISIN bootstrap; importIds=1; evidenceIds=1; candidateFingerprints=abc; planFingerprint=def",
        ).unwrap();
        assert_eq!(
            outcome,
            StrictHistoricalIsinInsertOutcome::MatchingV192Row(1)
        );
    }

    #[test]
    fn v113b1_strict_insert_recognizes_matching_authorized_provenance() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date,source,source_ref,note,created_at,updated_at)
             VALUES ('NSE','TITAN','INE280A01010','2011-06-23','V1.12.1_EXTERNAL_EVIDENCE','V112-EVID-0001',
             'V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001',datetime('now'),datetime('now'))",
            [],
        ).unwrap();

        let outcome = insert_historical_isin_evidence_v113b1_strict_no_promotion(
            &connection,
            "NSE",
            "TITAN",
            "INE280A01010",
            "2011-06-23",
            "V1.12.1_EXTERNAL_EVIDENCE",
            Some("V112-EVID-0001"),
            "V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001",
        )
        .unwrap();

        assert_eq!(
            outcome,
            V113B1StrictHistoricalIsinInsertOutcome::MatchingAuthorizedRow(1)
        );
        let count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM instrument_isin_history WHERE exchange='NSE' AND symbol='TITAN' AND effective_date='2011-06-23'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn v113b1_strict_insert_does_not_adopt_unbound_matching_row() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date,source,source_ref,note,created_at,updated_at)
             VALUES ('NSE','TITAN','INE280A01010','2011-06-23','OTHER_SOURCE','OTHER-REF','external',datetime('now'),datetime('now'))",
            [],
        ).unwrap();

        let outcome = insert_historical_isin_evidence_v113b1_strict_no_promotion(
            &connection,
            "NSE",
            "TITAN",
            "INE280A01010",
            "2011-06-23",
            "V1.12.1_EXTERNAL_EVIDENCE",
            Some("V112-EVID-0001"),
            "V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001",
        )
        .unwrap();

        assert_eq!(
            outcome,
            V113B1StrictHistoricalIsinInsertOutcome::ExistingExternalMatch(1)
        );
    }

    #[test]
    fn v113b1_strict_insert_rejects_conflicting_exact_date_isin() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO instrument_isin_history (exchange,symbol,isin,effective_date,source,note,created_at,updated_at)
             VALUES ('NSE','TITAN','INE999Z01010','2011-06-23','TEST','external',datetime('now'),datetime('now'))",
            [],
        ).unwrap();

        let outcome = insert_historical_isin_evidence_v113b1_strict_no_promotion(
            &connection,
            "NSE",
            "TITAN",
            "INE280A01010",
            "2011-06-23",
            "V1.12.1_EXTERNAL_EVIDENCE",
            Some("V112-EVID-0001"),
            "V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001",
        )
        .unwrap();

        assert_eq!(
            outcome,
            V113B1StrictHistoricalIsinInsertOutcome::Conflict {
                existing_id: 1,
                existing_isin: "INE999Z01010".to_string()
            }
        );
    }

    #[test]
    fn v113b1_strict_insert_adds_exact_history_without_promoting_imports() {
        let connection = Connection::open_in_memory().unwrap();
        prepare_database_connection(&connection).unwrap();
        connection.execute(
            "INSERT INTO corporate_action_imports
             (dedupe_key,exchange,source,symbol,isin,company_name,purpose_raw,ex_date,action_type,parse_status,review_status)
             VALUES ('v113b1-pending','NSE','NSE_API','TITAN','INE280A01010','Titan Company Limited','Bonus','2011-06-23','BONUS','PARSED','UNRESOLVED')",
            [],
        ).unwrap();

        let outcome = insert_historical_isin_evidence_v113b1_strict_no_promotion(
            &connection,
            "NSE",
            "TITAN",
            "INE280A01010",
            "2011-06-23",
            "V1.12.1_EXTERNAL_EVIDENCE",
            Some("V112-EVID-0001"),
            "V1.13 controlled identity repair; importIds=12841; evidence=V112-EVID-0001",
        )
        .unwrap();

        assert!(matches!(
            outcome,
            V113B1StrictHistoricalIsinInsertOutcome::Inserted(_)
        ));
        let status: String = connection.query_row(
            "SELECT review_status FROM corporate_action_imports WHERE dedupe_key='v113b1-pending'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(status, "UNRESOLVED");
    }
}

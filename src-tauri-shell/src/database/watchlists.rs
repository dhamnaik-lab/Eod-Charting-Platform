use rusqlite::{params, Connection, OptionalExtension};
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

use super::{
    normalize_exchange, normalize_optional_text, normalize_symbol, run_connection_transaction,
    with_active_connection, AppResult, InstrumentKeyInput, OfficialWatchlistUpdateInput,
    OperationResult, ReplaceSourceLinkedWatchlistInput, Watchlist, WatchlistCreateInput,
    WatchlistDeleteInput, WatchlistItem, WatchlistRenameInput, WatchlistSourceMeta,
    WatchlistSymbolInput,
};

type WatchlistSourceRow = (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

#[tauri::command]
pub fn get_watchlists(app: AppHandle) -> AppResult<Vec<Watchlist>> {
    with_active_connection(&app, load_watchlists).map(|value| value.unwrap_or_default())
}

#[tauri::command]
pub fn create_watchlist(app: AppHandle, input: WatchlistCreateInput) -> AppResult<Watchlist> {
    with_active_connection(&app, |connection| {
        let trimmed = input.name.trim();
        if trimmed.is_empty() {
            return Err("Watchlist name is required.".to_string());
        }

        let source_meta = normalize_watchlist_source_meta(input.source_meta.as_ref())?;

        let id = connection
            .prepare(
                "
                  INSERT INTO watchlists (
                    name,
                    source_type,
                    source_exchange,
                    source_group_type,
                    source_key,
                    source_display_name,
                    last_synced_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                ",
            )
            .and_then(|mut statement| {
                statement.insert(params![
                    trimmed,
                    source_meta.as_ref().map(|value| value.source_type.as_str()),
                    source_meta
                        .as_ref()
                        .map(|value| value.source_exchange.as_str()),
                    source_meta
                        .as_ref()
                        .map(|value| value.source_group_type.as_str()),
                    source_meta.as_ref().map(|value| value.source_key.as_str()),
                    source_meta
                        .as_ref()
                        .map(|value| value.source_display_name.as_str()),
                    source_meta
                        .as_ref()
                        .and_then(|value| value.last_synced_at.as_deref()),
                ])
            })
            .map_err(|error| error.to_string())?;

        Ok(Watchlist {
            id,
            name: trimmed.to_string(),
            source_meta,
            items: Vec::new(),
        })
    })?
    .ok_or_else(|| "Open a database before creating a watchlist.".to_string())
}

#[tauri::command]
pub fn rename_watchlist(app: AppHandle, input: WatchlistRenameInput) -> AppResult<Watchlist> {
    with_active_connection(&app, |connection| {
        let trimmed = input.name.trim();
        if trimmed.is_empty() {
            return Err("Watchlist name is required.".to_string());
        }

        let source_row = load_watchlist_source_row(connection, input.watchlist_id)?;
        let Some((
            source_type,
            source_exchange,
            source_group_type,
            source_key,
            source_display_name,
            last_synced_at,
        )) = source_row
        else {
            return Err("Selected watchlist was not found.".to_string());
        };

        connection
            .execute(
                "
                  UPDATE watchlists
                  SET name = ?
                  WHERE id = ?
                ",
                params![trimmed, input.watchlist_id],
            )
            .map_err(|error| error.to_string())?;

        let items = load_watchlists(connection)?
            .into_iter()
            .find(|watchlist| watchlist.id == input.watchlist_id)
            .map(|watchlist| watchlist.items)
            .unwrap_or_default();

        Ok(Watchlist {
            id: input.watchlist_id,
            name: trimmed.to_string(),
            source_meta: map_watchlist_source_meta(
                source_type,
                source_exchange,
                source_group_type,
                source_key,
                source_display_name,
                last_synced_at,
            ),
            items,
        })
    })?
    .ok_or_else(|| "Open a database before renaming a watchlist.".to_string())
}

#[tauri::command]
pub fn delete_watchlist(app: AppHandle, input: WatchlistDeleteInput) -> AppResult<OperationResult> {
    with_active_connection(&app, |connection| {
        let deleted = connection
            .execute(
                "
                  DELETE FROM watchlists
                  WHERE id = ?
                ",
                params![input.watchlist_id],
            )
            .map_err(|error| error.to_string())?;

        if deleted == 0 {
            return Err("Selected watchlist was not found.".to_string());
        }

        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before deleting a watchlist.".to_string())
}

#[tauri::command]
pub fn add_to_watchlist(app: AppHandle, input: WatchlistSymbolInput) -> AppResult<OperationResult> {
    with_active_connection(&app, |connection| {
        let symbol = normalize_symbol(&input.symbol)?;
        let exchange = normalize_exchange(&input.exchange)?;
        let next_sort_order: i64 = connection
            .query_row(
                "
                  SELECT COALESCE(MAX(sort_order), -1) + 1
                  FROM watchlist_items
                  WHERE watchlist_id = ?
                ",
                params![input.watchlist_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;

        connection
            .execute(
                "
                  INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol, exchange, sort_order)
                  VALUES (?, ?, ?, ?)
                ",
                params![input.watchlist_id, symbol, exchange, next_sort_order],
            )
            .map_err(|error| error.to_string())?;

        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before adding watchlist symbols.".to_string())
}

#[tauri::command]
pub fn remove_from_watchlist(
    app: AppHandle,
    input: WatchlistSymbolInput,
) -> AppResult<OperationResult> {
    with_active_connection(&app, |connection| {
        let symbol = normalize_symbol(&input.symbol)?;
        let exchange = normalize_exchange(&input.exchange)?;
        connection
            .execute(
                "
                  DELETE FROM watchlist_items
                  WHERE watchlist_id = ? AND symbol = ? AND exchange = ?
                ",
                params![input.watchlist_id, symbol, exchange],
            )
            .map_err(|error| error.to_string())?;

        Ok(OperationResult { success: true })
    })?
    .ok_or_else(|| "Open a database before removing watchlist symbols.".to_string())
}

#[tauri::command]
pub async fn apply_official_watchlist_update(
    app: AppHandle,
    input: OfficialWatchlistUpdateInput,
) -> AppResult<OperationResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = super::resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| "Open a database before updating an official watchlist.".to_string())?;

        let connection = super::connection_registry::open_connection_for_folder(&folder_path, false)?;

        let last_synced_at = input.last_synced_at.trim();
        if last_synced_at.is_empty() {
            return Err("A sync timestamp is required.".to_string());
        }

        let source_type = connection
            .query_row(
                "
                  SELECT source_type
                  FROM watchlists
                  WHERE id = ?
                ",
                params![input.watchlist_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        let Some(source_type) = source_type else {
            return Err("Selected watchlist was not found.".to_string());
        };

        if source_type.as_deref() != Some("official") {
            return Err("Only official source-linked watchlists can be updated.".to_string());
        }

        let symbols_to_add = dedupe_instrument_keys(&input.symbols_to_add)?;
        let symbols_to_remove = dedupe_instrument_keys(&input.symbols_to_remove)?;

        let result = run_connection_transaction(&connection, |connection| {
            let mut delete_statement = connection
                .prepare(
                    "
                      DELETE FROM watchlist_items
                      WHERE watchlist_id = ? AND symbol = ? AND exchange = ?
                    ",
                )
                .map_err(|error| error.to_string())?;
            for instrument in &symbols_to_remove {
                delete_statement
                    .execute(params![
                        input.watchlist_id,
                        instrument.symbol,
                        instrument.exchange
                    ])
                    .map_err(|error| error.to_string())?;
            }

            let mut next_sort_order: i64 = connection
                .query_row(
                    "
                      SELECT COALESCE(MAX(sort_order), -1) + 1
                      FROM watchlist_items
                      WHERE watchlist_id = ?
                    ",
                    params![input.watchlist_id],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;

            let mut insert_statement = connection
                .prepare(
                    "
                      INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol, exchange, sort_order)
                      VALUES (?, ?, ?, ?)
                    ",
                )
                .map_err(|error| error.to_string())?;
            for instrument in &symbols_to_add {
                insert_statement
                    .execute(params![
                        input.watchlist_id,
                        instrument.symbol,
                        instrument.exchange,
                        next_sort_order
                    ])
                    .map_err(|error| error.to_string())?;
                next_sort_order += 1;
            }

            connection
                .execute(
                    "
                      UPDATE watchlists
                      SET last_synced_at = ?
                      WHERE id = ?
                    ",
                    params![last_synced_at, input.watchlist_id],
                )
                .map_err(|error| error.to_string())?;

            Ok(OperationResult { success: true })
        })?;

        Ok::<OperationResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn replace_source_linked_watchlist(
    app: AppHandle,
    input: ReplaceSourceLinkedWatchlistInput,
) -> AppResult<OperationResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = super::resolve_active_database_folder(&app_handle)?
            .ok_or_else(|| {
                "Open a database before replacing a source-linked watchlist.".to_string()
            })?;

        let connection = super::connection_registry::open_connection_for_folder(&folder_path, false)?;

        let source_meta = normalize_watchlist_source_meta(Some(&input.source_meta))?
            .ok_or_else(|| "Watchlist source metadata is required.".to_string())?;
        let members = dedupe_instrument_keys(&input.members)?;

        let watchlist_exists = connection
            .query_row(
                "
                  SELECT 1
                  FROM watchlists
                  WHERE id = ?
                ",
                params![input.watchlist_id],
                |_| Ok(()),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        if watchlist_exists.is_none() {
            return Err("Selected watchlist was not found.".to_string());
        }

        let result = run_connection_transaction(&connection, |connection| {
            connection
                .execute(
                    "
                      DELETE FROM watchlist_items
                      WHERE watchlist_id = ?
                    ",
                    params![input.watchlist_id],
                )
                .map_err(|error| error.to_string())?;

            let mut insert_statement = connection
                .prepare(
                    "
                      INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol, exchange, sort_order)
                      VALUES (?, ?, ?, ?)
                    ",
                )
                .map_err(|error| error.to_string())?;
            for (sort_order, instrument) in members.iter().enumerate() {
                insert_statement
                    .execute(params![
                        input.watchlist_id,
                        instrument.symbol,
                        instrument.exchange,
                        sort_order as i64
                    ])
                    .map_err(|error| error.to_string())?;
            }

            connection
                .execute(
                    "
                      UPDATE watchlists
                      SET source_type = ?,
                          source_exchange = ?,
                          source_group_type = ?,
                          source_key = ?,
                          source_display_name = ?,
                          last_synced_at = ?
                      WHERE id = ?
                    ",
                    params![
                        source_meta.source_type,
                        source_meta.source_exchange,
                        source_meta.source_group_type,
                        source_meta.source_key,
                        source_meta.source_display_name,
                        source_meta.last_synced_at.as_deref(),
                        input.watchlist_id,
                    ],
                )
                .map_err(|error| error.to_string())?;

            Ok(OperationResult { success: true })
        })?;

        Ok::<OperationResult, String>(result)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(super) fn load_watchlists(connection: &Connection) -> AppResult<Vec<Watchlist>> {
    let mut watchlist_statement = connection
        .prepare(
            "
              SELECT
                id,
                name,
                source_type,
                source_exchange,
                source_group_type,
                source_key,
                source_display_name,
                last_synced_at
              FROM watchlists
              ORDER BY id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let watchlists = watchlist_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut item_statement = connection
        .prepare(
            "
              SELECT
                wi.watchlist_id,
                wi.symbol,
                wi.exchange
              FROM watchlist_items wi
              ORDER BY wi.watchlist_id ASC, wi.sort_order ASC, wi.symbol ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let item_rows = item_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut grouped_items = HashMap::<i64, Vec<WatchlistItem>>::new();
    for (watchlist_id, symbol, exchange) in item_rows {
        grouped_items
            .entry(watchlist_id)
            .or_default()
            .push(WatchlistItem {
                symbol,
                exchange,
                name: None,
            });
    }

    Ok(watchlists
        .into_iter()
        .map(
            |(
                id,
                name,
                source_type,
                source_exchange,
                source_group_type,
                source_key,
                source_display_name,
                last_synced_at,
            )| Watchlist {
                id,
                name,
                source_meta: map_watchlist_source_meta(
                    source_type,
                    source_exchange,
                    source_group_type,
                    source_key,
                    source_display_name,
                    last_synced_at,
                ),
                items: grouped_items.remove(&id).unwrap_or_default(),
            },
        )
        .collect())
}

fn load_watchlist_source_row(
    connection: &Connection,
    watchlist_id: i64,
) -> AppResult<Option<WatchlistSourceRow>> {
    connection
        .query_row(
            "
              SELECT
                source_type,
                source_exchange,
                source_group_type,
                source_key,
                source_display_name,
                last_synced_at
              FROM watchlists
              WHERE id = ?
            ",
            params![watchlist_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn map_watchlist_source_meta(
    source_type: Option<String>,
    source_exchange: Option<String>,
    source_group_type: Option<String>,
    source_key: Option<String>,
    source_display_name: Option<String>,
    last_synced_at: Option<String>,
) -> Option<WatchlistSourceMeta> {
    let source_type = source_type?;
    let source_exchange = source_exchange?;
    let source_group_type = source_group_type?;
    let source_key = source_key?;
    let source_display_name = source_display_name?;

    if source_type != "official" {
        return None;
    }

    if source_exchange != "NSE" && source_exchange != "BSE" {
        return None;
    }

    if source_group_type != "sector" && source_group_type != "index" {
        return None;
    }

    Some(WatchlistSourceMeta {
        source_type,
        source_exchange,
        source_group_type,
        source_key,
        source_display_name,
        last_synced_at,
    })
}

fn normalize_watchlist_source_meta(
    input: Option<&WatchlistSourceMeta>,
) -> AppResult<Option<WatchlistSourceMeta>> {
    let Some(meta) = input else {
        return Ok(None);
    };

    if meta.source_type != "official" {
        return Err(format!(
            "Unsupported watchlist source type: {}",
            meta.source_type
        ));
    }

    if meta.source_exchange != "NSE" && meta.source_exchange != "BSE" {
        return Err(format!(
            "Unsupported watchlist source exchange: {}",
            meta.source_exchange
        ));
    }

    if meta.source_group_type != "sector" && meta.source_group_type != "index" {
        return Err(format!(
            "Unsupported watchlist source group type: {}",
            meta.source_group_type
        ));
    }

    let source_key = normalize_optional_text(Some(meta.source_key.as_str()))
        .ok_or_else(|| "Official watchlist source key is required.".to_string())?;
    let source_display_name = normalize_optional_text(Some(meta.source_display_name.as_str()))
        .ok_or_else(|| "Official watchlist source display name is required.".to_string())?;

    Ok(Some(WatchlistSourceMeta {
        source_type: "official".to_string(),
        source_exchange: meta.source_exchange.clone(),
        source_group_type: meta.source_group_type.clone(),
        source_key,
        source_display_name,
        last_synced_at: normalize_optional_text(meta.last_synced_at.as_deref()),
    }))
}

fn dedupe_instrument_keys(input: &[InstrumentKeyInput]) -> AppResult<Vec<InstrumentKeyInput>> {
    let mut seen = HashSet::<String>::new();
    let mut deduped = Vec::new();
    for instrument in input {
        let symbol = normalize_symbol(&instrument.symbol)?;
        let exchange = normalize_exchange(&instrument.exchange)?;
        let key = format!("{exchange}:{symbol}");
        if seen.insert(key) {
            deduped.push(InstrumentKeyInput { symbol, exchange });
        }
    }

    Ok(deduped)
}

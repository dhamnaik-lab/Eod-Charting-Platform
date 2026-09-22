# DB Open Async Command Fix Report

Date: 2026-04-08

## Goal

Prevent the native window from blocking while database-open work runs.

## Fix

Converted the main database-open/snapshot commands in `src-tauri-shell/src/database.rs` from synchronous command handlers to async handlers that move blocking database work onto `tauri::async_runtime::spawn_blocking(...)`.

Commands updated:

- `get_app_snapshot`
- `get_db_stats`
- `create_database_interactive`
- `open_database_interactive`
- `activate_database_path`

The file dialog remains on the direct path, but the actual DB open/snapshot work now runs on a background blocking worker instead of the native event loop thread.

## Files Changed

- `src-tauri-shell/src/database.rs`

## Validation

- `npm run build`

## Backup

- `backups/pre_opencode_changes_20260408_233249_db_open_async_command_fix`

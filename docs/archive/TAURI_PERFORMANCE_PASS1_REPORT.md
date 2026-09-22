# Tauri Performance Pass 1 Report

## Scope

This pass targeted the highest-value backend bottleneck in the active Tauri runtime path:

- remove the per-command SQLite reopen/re-prepare cycle
- keep the renderer/platform contract unchanged
- preserve the Electron fallback path

This pass does **not** yet split the app snapshot, add a symbol/EOD cache, or redesign the watchlist/sidebar/chart UI.

## What Changed

- `src-tauri-shell/src/database.rs` now owns a small active-connection cache keyed by the normalized active database folder.
- `src-tauri-shell/src/main.rs` now registers that cache as managed Tauri app state during startup.
- Snapshot reads and command-backed database operations now reuse the same live SQLite connection while the same database stays active.
- Closing the database, deleting the active database, or losing the active path clears the cached connection explicitly.
- Opening or creating a different database swaps the cache over to the newly active folder.

## Why This Helps

Before this pass, the active Tauri path reopened SQLite and reran connection preparation for nearly every command through:

- `with_active_connection(...)`
- `get_app_snapshot_internal(...)`
- open/create database flows

That meant repeated:

- SQLite open/close overhead
- WAL/pragma setup
- migration/default checks

Those costs showed up during:

- opening a database
- changing symbols
- changing sheets
- refreshing watchlists/snapshots

## Files Modified

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_022219_tauri_performance_pass1`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `cargo check` in `src-tauri-shell`
- `npm run tauri:portable:win`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Limitations

- `getAppSnapshot()` is still heavier than it should be because it still loads full DB stats plus full watchlists.
- symbol browser/search still rebuilds more in-memory search data than necessary
- symbol changes still reload full EOD data without a warm recent-symbol cache
- sheet switching still rehydrates chart data more often than necessary
- deleting a non-active database currently clears the cached active connection too; this is safe but not yet optimal

## Suggested Next Steps

1. split `getAppSnapshot()` into lightweight shell state vs heavier DB/watchlist detail
2. stop rebuilding the full instrument search catalog for normal sidebar usage
3. add a recent-symbol EOD cache in the renderer/store
4. make sheet switching reuse already loaded bars where possible

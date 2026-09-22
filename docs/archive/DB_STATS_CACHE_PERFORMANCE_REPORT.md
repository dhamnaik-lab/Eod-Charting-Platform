# DB Stats Cache Performance Report

## Scope

This pass targeted one remaining backend cost in the active Tauri-only runtime path:

- repeated expensive `getDbStats()` recomputation during routine shell refreshes
- repeated recounting of `eod_prices` even when the active SQLite file had not changed

Preserved intentionally:

- the current Tauri-only runtime structure
- the active `src-tauri-shell` backend path
- the renderer/runtime seam in `src/platform/*`
- current chart, Sheets, sidebar, watchlist, and workspace behavior
- the earlier connection-cache, lightweight snapshot, symbol-search, and watchlist refresh optimizations

## What Changed

- `src-tauri-shell/src/database.rs` now stores an optional cached DB-stats payload alongside the active cached SQLite connection.
- The cache is keyed by the active database file signature:
  - database file length
  - database file modified timestamp in Unix milliseconds
- `get_db_stats(...)` now returns cached stats when the file signature has not changed.
- `get_app_snapshot_internal(...)` now reuses that same DB-stats cache whenever `includeStats` is requested.
- The active connection cache initialization path now also resets the DB-stats cache whenever the active database folder changes.

## Why This Helps

Before this pass:

- `getDbStats()` always recalculated:
  - symbol count
  - bar count
  - min/max trade date
- those queries still ran even when the same database was already open and unchanged

After this pass:

- unchanged databases reuse the last computed stats immediately
- the expensive recount only happens when the active SQLite file signature changes
- lightweight shell refreshes plus the earlier watchlist-only refresh path now avoid another layer of unnecessary backend work

## Files Modified

- `src-tauri-shell/src/database.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `DB_STATS_CACHE_PERFORMANCE_REPORT.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_152020_db_stats_cache_pass`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- `load_db_stats(...)` itself still performs real counts when the cache invalidates
- cache invalidation is file-signature based, not query-result based
- if the database file changes very frequently, the cache naturally helps less
- the next likely bottlenecks are selected-watchlist render churn, sheet-switch handoff, and any remaining DB-open latency outside the stats path

## Suggested Next Steps

1. manually verify the remaining slowest interaction in the portable Tauri build:
   - database open
   - watchlist switching
   - symbol switching
   - sheet switching
2. if watchlist switching is still the main lag point, target selected-watchlist render churn and tab-load handoff next
3. if database open is still the main lag point, consider a safe stale-while-revalidate shell-info path for startup-only DB stats

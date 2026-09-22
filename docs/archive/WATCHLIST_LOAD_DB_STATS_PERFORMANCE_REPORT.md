# Watchlist Load And DB Stats Performance Report

## Scope

This pass targeted the next visible performance hotspots after the Tauri connection-cache, lightweight snapshot split, and symbol/EOD cache work:

- watchlist-only actions still refreshed full app snapshot data
- routine watchlist hydration still did unnecessary per-item instrument-name resolution
- DB stats were still being re-requested during watchlist-only flows even though watchlist mutations do not change bar or symbol counts

Preserved intentionally:

- current watchlist behavior and watchlist UI structure
- official watchlist import/update/live-source behavior
- symbol matching rules
- current chart, Sheets, sidebar, and workspace behavior
- Electron fallback and the active `src-tauri-shell` path

## What Changed

- `src/store/chartStore.ts` now has a watchlist-only refresh path for:
  - create watchlist
  - rename watchlist
  - delete watchlist
  - add symbol to watchlist
  - remove symbol from watchlist
  - official watchlist import completion
  - official watchlist update completion
- `refreshSnapshot()` now skips `getDbStats()` unless:
  - DB stats are currently missing, or
  - the caller explicitly requests a DB-stats refresh
- backend `db:changed` handling now still refreshes DB stats, so price/instrument mutations remain accurate
- `downloadBhavcopy()` now explicitly refreshes DB stats because it changes the bar set
- `electron/db.ts` now loads watchlists by grouping raw `watchlist_items` rows directly and no longer resolves each symbol through instrument context during routine watchlist hydration
- `src-tauri-shell/src/database.rs` now follows the same lighter watchlist hydration path

## Why This Helps

Before this pass:

- many watchlist actions called `refreshSnapshot()`
- `refreshSnapshot()` always requested:
  - `getWatchlists()`
  - `getDbStats()`
  - sometimes symbol browser data
- `getWatchlists()` itself still resolved every item name through instrument context

That meant even cheap watchlist actions could feel slower than necessary.

After this pass:

- watchlist-only actions refresh only the watchlist payload
- routine watchlist hydration returns symbol/exchange rows without per-item name lookups
- DB stats are still refreshed when actual database-content mutations happen, but they are no longer dragged into normal watchlist management flows

## Files Modified

- `src/store/chartStore.ts`
- `electron/db.ts`
- `src-tauri-shell/src/database.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_041500_watchlist_load_db_stats_perf_pass`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `cargo check`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- DB stats still calculate real counts when they are refreshed; this pass reduces refresh frequency instead of changing the count query itself
- watchlist items now intentionally carry `name: null` during routine hydration because the sidebar/watchlist navigation currently uses symbol-first display
- background `db:changed` events still trigger a full stats refresh because those changes can affect prices and symbols
- deeper watchlist/store profiling is still needed if watchlist switching itself remains noticeably slow in manual use

## Suggested Next Steps

1. manually smoke-test:
   - watchlist create/rename/delete
   - add/remove symbol from watchlist
   - official watchlist import/update completion
   - watchlist switching
2. if watchlist switching still feels slow, profile selected-watchlist rendering and tab load handoff
3. if DB open still feels heavy, tighten `getDbStats()` itself by introducing a safe cached/stale-while-revalidate strategy for bar counts

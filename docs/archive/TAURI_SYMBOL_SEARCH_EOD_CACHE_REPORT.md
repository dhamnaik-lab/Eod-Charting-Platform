# Tauri Symbol Search And EOD Cache Report

## Scope

This pass targeted the next major speed issues after the Tauri connection-cache and lightweight-snapshot work:

- normal symbol-browser listing still used a heavy in-memory search-entry build
- typed symbol search still hit the heavy alias-aware ranking path immediately
- symbol changes and sheet restores still reloaded bars even when the same symbol had just been loaded

## What Changed

- `electron/db.ts` now uses a direct SQL instrument list for normal no-query symbol-browser usage instead of building the full search-entry catalog.
- `src-tauri-shell/src/database.rs` now uses the same direct SQL list path for normal no-query symbol-browser usage.
- Both runtimes now use a fast current-instrument SQL search first for explicit query searches.
- The old alias-aware in-memory ranking path is still preserved as fallback when the fast SQL search does not produce enough results.
- `chartStore.ts` now keeps a recent in-memory EOD result cache keyed by:
  - active database path
  - exchange
  - symbol
  - raw vs adjusted mode
- The cache is used for:
  - repeated symbol switches
  - sheet restores that point back to recently loaded instruments
  - tab hydration of already-seen instruments
- The cache is cleared on database-change events and on active-database changes so correctness stays ahead of reuse.

## Why This Helps

Before this pass:

- the sidebar’s normal symbol list built the full search/alias catalog even when the user had not typed a query
- repeated symbol changes reloaded full EOD bars even if the app had just loaded the same symbol
- loading a sheet could trigger another identical EOD fetch even when the symbol was already warm in memory

After this pass:

- normal symbol browsing is backed by simpler SQL listing
- explicit search stays fast for common matches while still preserving fallback alias-aware search behavior
- repeated symbol/sheet reuse can often resolve from memory instead of hitting the backend again

## Files Modified

- `electron/db.ts`
- `src-tauri-shell/src/database.rs`
- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_025900_lightweight_snapshot_split`

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

- DB stats are still expensive because they still count the full price table.
- watchlist loading still resolves more metadata than the sidebar strictly needs.
- typed search can still fall back to the heavier alias-aware ranking path when the fast SQL path is not enough.
- the EOD cache is in-memory only and is invalidated on any backend `db:changed` event.

## Suggested Next Steps

1. make watchlist loading cheaper for sidebar usage
2. consider a more targeted database-change invalidation signal instead of clearing the full EOD cache on any `db:changed`
3. run an interactive Tauri smoke pass focused on:
   - DB open
   - symbol switches
   - sheet switches
   - watchlist switching

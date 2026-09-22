# Tauri Lightweight Snapshot Split Report

## Scope

This pass reduces startup and refresh overhead by making the app snapshot lightweight by default when requested and moving heavier database details onto separate fetches.

Preserved intentionally:

- current renderer/platform seam in `src/platform/*`
- current watchlist behavior and symbol matching rules
- current Sheets/sidebar/chart behavior
- Electron fallback runtime
- the active Tauri connection-cache baseline added in the previous performance pass

## What Changed

- Added optional `SnapshotOptions` to the desktop contract so the renderer can request a lightweight app snapshot.
- Exposed a dedicated `getDbStats()` call through both Electron and Tauri.
- Updated the active Tauri backend so `get_app_snapshot` can omit:
  - database stats
  - watchlists
- Updated the Electron fallback bridge to support the same lightweight snapshot contract.
- Refactored `chartStore.ts` so database open/init now behaves as:
  1. fetch lightweight shell snapshot
  2. restore workspace
  3. start chart hydration
  4. fetch watchlists and DB stats separately in the background
- Reduced unnecessary symbol-browser rebuilds by making `refreshSnapshot()` refresh the browser list only when explicitly requested.

## Why This Helps

Before this pass:

- `getAppSnapshot()` bundled shell state, full DB stats, and full watchlists
- `applySnapshot()` then called `getWatchlists()` again anyway
- many refreshes also rebuilt the symbol browser even when the action did not change the symbol universe

That meant the first open/init snapshot did too much work before the renderer could continue.

## Files Modified

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`
- `electron/db.ts`
- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
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

- DB stats are still expensive when requested because they still count the full price table.
- watchlist loading still resolves more metadata than the sidebar strictly needs.
- symbol browser/search still rebuilds too much data in the backend path.
- symbol changes and sheet changes still need a warm EOD cache pass after this.

## Recommended Next Step

Implement the symbol-browser/search reduction pass next:

1. stop rebuilding the full search catalog for normal list/search usage
2. keep list limits lower by default
3. reserve the larger search path for explicit broader searches only

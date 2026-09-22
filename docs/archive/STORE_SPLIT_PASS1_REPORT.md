# Store Split Pass 1 Report

Date: 2026-04-05

## Interaction / Architecture Limitation Fixed

Before this pass, `src/store/chartStore.ts` owned too many unrelated responsibilities at once:

- shell visibility flags
- import / manager / utility dialog open state
- command palette open state
- drawing-tool UI state
- magnet toggle state
- drawing-properties request state
- persisted sidebar shell layout state in `RootApp.tsx`
- chart/workspace/watchlist/data orchestration

That coupling made the active store harder to reason about and increased the chance that simple shell UI work would keep accreting into the same file as chart loading and database flows.

## What Was Added

- `src/store/uiStore.ts`
  - dedicated shell UI state for:
    - sidebar / OHLCV / status-bar visibility
    - import / official import / utility dialog open state
    - command palette open state
    - drawing-tool, magnet, and drawing-properties UI state
- `src/store/workspaceStore.ts`
  - persisted shell layout state for:
    - sidebar width
    - sidebar collapsed state
    - sidebar pinned state
- `src/features/watchlists/watchlistService.ts`
  - thin watchlist domain service wrappers over the desktop bridge
- `src/features/workspace/workspaceService.ts`
  - thin workspace persistence wrappers over the desktop bridge

## What Changed

- `src/store/chartStore.ts`
  - now delegates shell UI actions to `uiStore`
  - now delegates watchlist CRUD/update calls through `watchlistService`
  - now delegates workspace setting reads/writes through `workspaceService`
  - no longer stores shell UI/dialog/drawing-tool state directly
  - still owns chart data orchestration, workspace chart state, watchlist selection/import/update logic, search, bars, and indicator/drawing data mutations
- `src/RootApp.tsx`
  - now reads shell visibility/dialog state from `uiStore`
  - now reads persisted sidebar width/collapsed/pinned state from `workspaceStore`
- `src/components/ChartCanvas.tsx`
  - now reads drawing-tool/magnet/properties UI state from `uiStore`
- `src/components/ChartToolDock.tsx`
  - now reads drawing-tool/magnet UI state from `uiStore`
- `src/components/Toolbar.tsx`
  - now reads magnet state from `uiStore`
- `src/components/CommandPalette.tsx`
  - now reads command-palette state from `uiStore`
  - shell-style commands now open/toggle UI through `uiStore`
- `src/components/ImportCsvDialog.tsx`
  - now reads import-dialog open state from `uiStore`
- `src/components/OfficialWatchlistImportDialog.tsx`
  - now reads official-import-dialog state from `uiStore`
- `src/components/DatabaseToolsDialogs.tsx`
  - now reads quote/merge/corporate-action dialog state from `uiStore`

## Files Added

- `src/store/uiStore.ts`
- `src/store/workspaceStore.ts`
- `src/features/watchlists/watchlistService.ts`
- `src/features/workspace/workspaceService.ts`
- `STORE_SPLIT_PASS1_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `src/RootApp.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/Toolbar.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/ImportCsvDialog.tsx`
- `src/components/OfficialWatchlistImportDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation Performed

Passed:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Bounded runtime recheck:

- launched `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- confirmed a running `EOD Chart` window/process
- shut it down cleanly afterward

## Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260405_125411_store_split_pass1`

## Remaining Limitations

- `src/store/chartStore.ts` is smaller in responsibility but still owns most chart-session, workspace-chart, and watchlist orchestration.
- `workspaceStore.ts` currently handles persisted shell layout state only; full chart workspace orchestration still lives in `chartStore`.
- `watchlistService.ts` and `workspaceService.ts` are intentionally thin wrappers in this pass; they are extraction seams, not a final architecture end state yet.
- Rust backend domain splitting was intentionally deferred.

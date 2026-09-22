# Store Split Pass 2 Report

Date: 2026-04-05

## Interaction / Architecture Limitation Fixed

Before this pass, `src/store/chartStore.ts` still mixed chart/session state with two large clusters of non-renderer orchestration:

- workspace persistence parsing/serialization
- database snapshot lifecycle and hydration helpers

That kept the store responsible for both chart behavior and low-level desktop/workspace bootstrapping logic, which made further extraction harder and left layout persistence shared only through `chartStore`.

## What Was Added

- `src/features/workspace/workspacePersistence.ts`
  - canonical persisted workspace/sheet/layout types
  - workspace serialization/stringification helpers
  - persisted workspace parsing/sanitization helpers
  - generic workspace restoration helper
  - primary-sheet content helper
- `src/features/workspace/databaseSnapshotService.ts`
  - lightweight snapshot fetch helper
  - active-database snapshot refresh helper
  - post-open snapshot hydration helper

## What Changed

- `src/store/chartStore.ts`
  - now imports workspace persistence helpers from `src/features/workspace/workspacePersistence.ts`
  - now imports snapshot loading helpers from `src/features/workspace/databaseSnapshotService.ts`
  - no longer owns the persisted workspace parsing/sanitization/serialization implementation directly
  - no longer owns the Promise-all snapshot hydration/refresh detail loading implementation directly
  - still owns chart data loading, chart session state, symbol navigation, indicators, drawings, watchlist orchestration, and chart-tab hydration
- `src/components/LayoutManagerDialog.tsx`
  - now saves layouts through the shared workspace persistence serializer instead of importing serialization from `chartStore`

## Files Added

- `src/features/workspace/workspacePersistence.ts`
- `src/features/workspace/databaseSnapshotService.ts`
- `STORE_SPLIT_PASS2_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `src/components/LayoutManagerDialog.tsx`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
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

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260405_153406_store_split_pass2`

## Remaining Limitations

- `src/store/chartStore.ts` is smaller again, but it still owns most chart-tab/session orchestration and menu-command routing.
- `workspacePersistence.ts` centralizes workspace persistence logic, but layout/load actions still execute from UI/store layers rather than a fuller layout service seam.
- `databaseSnapshotService.ts` centralizes snapshot loading behavior, but database lifecycle actions (`create/open/activate/close`) still remain directly in `chartStore`.
- Rust backend domain splitting remains deferred.

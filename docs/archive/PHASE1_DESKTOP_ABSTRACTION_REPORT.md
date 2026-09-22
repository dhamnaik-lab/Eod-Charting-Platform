# PHASE1_DESKTOP_ABSTRACTION_REPORT

Date: 2026-03-28

## Summary

Phase 1 was implemented by introducing a renderer-facing desktop abstraction under `src/platform/*` while keeping Electron as the active runtime.

The new platform layer currently wraps the existing Electron preload contract and exposes only the desktop APIs that the active renderer actually uses. No Tauri scaffolding or Rust migration was started in this phase.

## Files Added

- `src/platform/types.ts`
- `src/platform/desktop.ts`
- `src/platform/index.ts`

## Files Modified

- `src/store/chartStore.ts`
- `src/components/ImportCsvDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/LayoutManagerDialog.tsx`
- `src/components/DeleteDatabaseDialog.tsx`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/Sidebar.tsx`
- `src/components/CommandPalette.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`

## What Was Added

### `src/platform/types.ts`

- defines the Phase 1 desktop API surface for the active renderer
- re-exports renderer-facing desktop types from the existing Electron type contract
- narrows the desktop API to the methods/events the renderer actually uses today

### `src/platform/desktop.ts`

- provides `getDesktopApi()`
- provides `requireDesktopApi()`
- provides `hasDesktopApi()`
- provides `getDesktopRuntime()`
- isolates the actual `window.electronAPI` lookup to one place

### `src/platform/index.ts`

- provides a single renderer import path for the platform layer

## Old Renderer-To-Electron Direct Touchpoints Reduced Or Removed

The following active renderer files were changed to use `@/platform` instead of reaching for Electron globals or Electron types directly:

- `src/store/chartStore.ts`
- `src/components/ImportCsvDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/LayoutManagerDialog.tsx`
- `src/components/DeleteDatabaseDialog.tsx`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/Sidebar.tsx`
- `src/components/CommandPalette.tsx`

## Remaining Direct Renderer Electron Dependencies

Remaining active direct dependencies are intentionally limited to:

- `src/platform/desktop.ts`
  - still reads `window.electronAPI`
- `src/types/electron.d.ts`
  - still defines the Electron preload compatibility contract and ambient window type

No active renderer file outside `src/platform/desktop.ts` now references `window.electronAPI` directly.

## Current Desktop API Surface In Phase 1

The platform layer currently covers the renderer features that are already exercised by the active UI:

- app snapshot and database lifecycle actions
- search/list/get data flows
- quote CRUD
- merge and corporate actions
- watchlist actions
- CSV pick/preview/import
- bhavcopy single and batch download actions
- bhavcopy settings persistence
- layout save/load/delete
- generic settings get/set
- menu command subscription
- import progress subscription
- download progress subscription
- database changed subscription

## Validation

Completed successfully:

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`

Additional runtime validation:

- Electron smoke launch still reached app startup
- main window creation still completed
- renderer load still completed

Blocked validation:

- the data-driven portion of `scripts/runtime-smoke-check.js` could not complete because the fixture file `D:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv` was not present on this machine
- a bounded `npm run dev:electron` startup attempt timed out without reusable logs, so dev-mode startup is not claimed as fully verified in this report

## Backup / Snapshot Location

Pre-change snapshot created at:

- `backups/pre_opencode_changes_20260328_152128_phase1_desktop_abstraction`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `PHASE1_DESKTOP_ABSTRACTION_REPORT.md`

## Recommended Next Step For Phase 2

Scaffold a fresh Tauri 2 shell around the active React app, but do not port database/import/bhavcopy/business logic yet.

Phase 2 should:

- keep Electron as the working runtime and rollback path
- avoid reusing the legacy `src-tauri` backend as the baseline
- wire Tauri only far enough to launch the existing frontend shell
- keep renderer runtime access flowing through `src/platform/*`

## Notes

- This phase intentionally did not rename `src/types/electron.d.ts` yet; it remains the compatibility contract until a second runtime is introduced
- This phase intentionally did not rewrite preload, IPC, database, import, or bhavcopy logic
- The abstraction is intentionally minimal and based on actual renderer usage instead of a speculative future API

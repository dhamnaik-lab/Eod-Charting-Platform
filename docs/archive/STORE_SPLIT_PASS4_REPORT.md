# Store Split Pass 4 Report

Date: 2026-04-07

## What Was Addressed

Two clusters of logic were extracted from `src/store/chartStore.ts` in this pass:

1. **Pure helper functions** — five stateless utility functions that had no dependency on store state
2. **Database lifecycle wrappers** — four action implementations that all followed the same `get-api / suppress-event / call-api / apply-snapshot` pattern

Neither extraction changes any runtime behavior. Both are structural moves only.

## Part 1 — Pure Helpers Extraction

### What Was Added

- `src/features/charts/chartDataUtils.ts`
  - `toBar(row: EodRow): OHLCBar` — converts a raw EOD row from the backend into a chart bar
  - `aggregateBars(bars, timeframe)` — aggregates daily bars into W/M/Q/Y OHLCV groups
  - `createDefaultViewport(totalBars)` — builds the default right-aligned 120-bar viewport
  - `fitViewportToBarCount(viewport, totalBars)` — re-fits a persisted viewport span to a new bar count
  - `upsertIndicator(indicators, next)` — inserts or replaces an indicator by kind

### What Changed in `chartStore.ts`

- removed `import { endOfMonth, format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'` (all five used only by moved functions)
- removed `type EodRow` from `@/platform` imports (used only by `toBar`)
- added `import { aggregateBars, createDefaultViewport, fitViewportToBarCount, toBar, upsertIndicator } from '@/features/charts/chartDataUtils'`
- deleted the five function bodies (~110 lines)

### Line Delta After Part 1

2,002 → 1,901 (−101 lines)

## Part 2 — Database Lifecycle Wrappers

### What Was Added

- `src/features/workspace/databaseLifecycleService.ts`
  - `DatabaseLifecycleHandlers` interface — `getApi`, `setSuppressEvent`, `applySnapshot`
  - `bindDatabaseLifecycle(handlers)` — returns four lifecycle actions wired to the provided handlers; each calls `getApi`, suppresses the `onDatabaseChanged` event during the operation, invokes the API method, applies the returned snapshot, and restores the event flag in a `finally` block

### What Changed in `chartStore.ts`

- added `import { bindDatabaseLifecycle } from '@/features/workspace/databaseLifecycleService'`
- added `const db = bindDatabaseLifecycle({ getApi, setSuppressEvent: (v) => { suppressDatabaseChangedEvent = v; }, applySnapshot })` inside the `create(...)` closure, after `applySnapshot` is defined
- replaced four 10-line action bodies with four 1-line delegates:
  ```ts
  createDatabaseInteractive: () => db.createDatabaseInteractive(),
  openDatabaseInteractive: () => db.openDatabaseInteractive(),
  activateDatabasePath: (filePath) => db.activateDatabasePath(filePath),
  closeDatabase: () => db.closeDatabase(),
  ```

### Design Notes

`chartStore` remains the orchestrator — it supplies the context and calls the returned delegates. `databaseLifecycleService` owns only the shared execution pattern (null-guard, suppress, try/finally). `suppressDatabaseChangedEvent` stays as a module-level variable in `chartStore`; the service writes it through the `setSuppressEvent` callback.

### Line Delta After Part 2

1,901 → 1,868 (−33 lines)

## Combined Pass 4 Delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `chartStore.ts` lines | 2,002 | 1,868 | −134 |

## Files Added

- `src/features/charts/chartDataUtils.ts`
- `src/features/workspace/databaseLifecycleService.ts`
- `STORE_SPLIT_PASS4_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260407_012434_store_split_pass4`

## Validation Performed

Passed:

- `npm run typecheck:renderer` (twice — after each extraction step)
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining `chartStore.ts` Hotspots

- **Official watchlist import/update** (~260 lines — `importOfficialWatchlists`, `updateOfficialWatchlist`): still deferred because the implementations have store-side orchestration (toast calls, `selectedWatchlistId` updates, `refreshWatchlistsOnly`, dialog close) woven through the business logic. Extraction requires carefully separating the pure resolution logic from the store effects before it is safe.
- **Chart tab management** (`createChartTab`, `activateChartTab`, `closeChartTab`) — small, tightly coupled to store state
- **Official watchlist resolution helpers** (`resolveOfficialWatchlistMember`, `buildOfficialWatchlistLookupMaps`, etc.) — could eventually move to `officialWatchlistProviders.ts` or a dedicated resolver module

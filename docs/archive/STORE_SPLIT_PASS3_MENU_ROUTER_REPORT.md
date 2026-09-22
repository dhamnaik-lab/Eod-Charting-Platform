# Store Split Pass 3 — Menu Command Router Extraction Report

Date: 2026-04-07

## Architecture Limitation Fixed

Before this pass, `src/store/chartStore.ts` owned the complete native menu command dispatch table inside its `init()` method. A single `shellApi.onMenuCommand(...)` callback contained a 115-line if-chain that routed 30+ `menu:*` commands to chart store actions, UI store actions, and the `menu:about` app-info handler.

This created two problems:

- `init()` was responsible for both bootstrap sequencing and dispatch routing — two distinct concerns living in one closure
- adding, removing, or auditing menu commands required navigating deep into the store's initialization logic

## What Was Added

- `src/features/app/menuCommandRouter.ts`
  - `MenuRouterChartHandle` interface — minimal structural subset of ChartStoreState that the router requires
  - `registerMenuCommandRouter(shellApi, getHandle)` — registers the `onMenuCommand` listener and routes all menu commands

## What Changed

- `src/store/chartStore.ts`
  - added import of `registerMenuCommandRouter` from `@/features/app/menuCommandRouter`
  - removed import of `getDesktopCapabilities` (now only used in the router)
  - removed `DrawingTool` from engine types import (now only used in the router)
  - `init()` now calls `registerMenuCommandRouter(shellApi, () => ({ ...get(), getActiveSelectedDrawingId: ... }))` — 5 lines replacing 115
  - reduced from 2,111 lines to 2,002 lines (−109 lines)

## Files Added

- `src/features/app/menuCommandRouter.ts`
- `STORE_SPLIT_PASS3_MENU_ROUTER_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Design Notes

`registerMenuCommandRouter` receives a `getHandle` factory — called once per incoming menu event — that returns the chart store handle plus a `getActiveSelectedDrawingId()` helper (needed for `menu:openDrawingProperties`). The factory is `() => ({ ...get(), getActiveSelectedDrawingId: ... })`, so the handle is always fresh and structurally compatible with `ChartStoreState`.

`MenuRouterChartHandle` is a structural interface, not a class. The full `ChartStoreState` satisfies it, so no wrapper or adapter is needed.

The router imports `getUiStoreState` directly (no circular dependency) and `getDesktopCapabilities` from `@/platform`. `chartStore.ts` no longer imports either of those for menu-routing purposes.

## Validation Performed

Passed:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260407_004730_store_split_pass3_menu_router`

## Remaining `chartStore.ts` Hotspots

- official watchlist import/update logic (~260 lines of business logic inside the store)
- database lifecycle actions (4 thin wrappers, ~50 lines — could go to `databaseLifecycleService.ts`)
- bar aggregation and viewport pure helpers (~100 lines at end of file — could go to engine or a chart utils module)
- chart tab management (`createChartTab`, `activateChartTab`, `closeChartTab`)

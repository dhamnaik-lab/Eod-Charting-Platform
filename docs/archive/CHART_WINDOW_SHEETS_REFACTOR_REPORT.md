# Chart Window Sheets Refactor Report

## Update Note
This report remains accurate for sheet ownership and persistence. The visual sizing and placement details of the bottom sheet strip are now partially superseded by `CHART_WORKSPACE_UX_STABILITY_REPORT.md`, which makes the tabs roomier and keeps the new-sheet `+` directly in the strip after the last visible sheet tab.

## Review
Implemented the requested sheet-ownership refactor so sheets are now truly owned by each chart window/tab instead of behaving like a global app-level sheet set. The store, serializer, and bottom sheet-tab UI now all target the owning chart window explicitly. The portable Tauri build completed successfully at the end of the pass.

## Previous Sheet Ownership Model
- `SheetTabs.tsx` could render a specific tab's `sheets`, but the actions still operated through implicit `activeChartTabId`
- `saveCurrentAsSheet`, `loadSheet`, `deleteSheet`, and `renameSheet` were effectively active-tab/global actions
- `loadSheet` restored a sheet by calling `loadWorkspaceFromLayout(...)`, which replaced the whole top-level workspace instead of only the owning chart window
- the shared workspace serializer did not persist per-tab `sheets`, `activeSheetId`, or `layoutMode`
- named layouts therefore could not faithfully preserve chart-window-owned sheets

## New Sheet Ownership Model
- each `ChartTabState` owns:
  - `sheets[]`
  - `activeSheetId`
  - `layoutMode`
- each sheet stores a chart-window-scoped workspace snapshot:
  - instrument
  - timeframe
  - viewport
  - indicators
  - drawings
  - indicator pane height
  - the owning chart window's `layoutMode`
- full workspace autosave and named layout save/load now persist those per-window sheet fields inside the same shared workspace payload
- sheet load now restores only the owning chart window/tab instead of rewriting the full top-level chart window list

## How Chart Window State Now Owns Sheets
- `src/store/chartStore.ts`
  - `ChartTabState` remains the owner of `sheets`, `activeSheetId`, and `layoutMode`
  - the persisted chart-tab contract now includes:
    - `sheets`
    - `activeSheetId`
    - `layoutMode`
  - sheet save/load/delete/rename actions are now explicitly tab-scoped:
    - `saveCurrentAsSheet(tabId, name)`
    - `loadSheet(tabId, sheetId)`
    - `deleteSheet(tabId, sheetId)`
    - `renameSheet(tabId, sheetId, newName)`
  - `loadSheet` now rebuilds only the target tab from the saved sheet snapshot and then rehydrates that tab's market data
- `src/components/SheetTabs.tsx`
  - now requires a concrete `tabId` context
  - no longer falls back to implicit active-tab behavior
  - focuses the owning chart window before running the tab-scoped action

## How Bottom Sheet Tabs Behave Now
- in single-chart mode, the bottom sheet strip shows only the active chart window's sheets
- in tiled mode, each rendered chart tile shows its own bottom sheet strip
- create/delete/rename/load affect only the owning chart window passed into `SheetTabs`
- clicking a sheet in a tile focuses that chart window and restores only that chart window

## Tile Compatibility
- status: partial
- what works:
  - each tile renders the owning chart window's sheet strip
  - sheet actions target that owning chart window only
  - per-window sheet state persists through autosave and named layouts
- current limitation:
  - the overall single/tiled workspace view still follows the active chart window's `layoutMode`
  - shared chart chrome above the tiled grid still reflects the active chart window

## Files Added
- `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`

## Files Modified
- `src/store/chartStore.ts`
- `src/components/SheetTabs.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_ARCHITECTURE_AUDIT.md`
- `SHEETS_FOUNDATION_REPORT.md`
- `SHEETS_PERSISTENCE_REPORT.md`
- `WINDOW_TILE_REPORT.md`
- `CHART_WORKSPACE_CORRECTION_REPORT.md`

## Backup Location
- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260401_200453_chart_window_sheets_refactor`

## Markdown Files Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_ARCHITECTURE_AUDIT.md`
- `SHEETS_FOUNDATION_REPORT.md`
- `SHEETS_PERSISTENCE_REPORT.md`
- `WINDOW_TILE_REPORT.md`
- `CHART_WORKSPACE_CORRECTION_REPORT.md`
- `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`

## Exact Validation / Build Commands Run
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Windows Output
- `npm run tauri:portable:win` was run successfully: yes
- output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## What Stayed Intentionally Unchanged
- no chart-engine rewrite
- no new sheet import/export
- no sheet reordering/metadata/cloud sync
- no direct Tauri imports were added outside `src/platform/*`
- Electron fallback files were preserved
- active drawing tool and magnet state were not moved in this pass:
  - active drawing tool remains global/ephemeral
  - magnet remains global

## Remaining Limitations
- tiled/single view selection still follows the active chart window's `layoutMode`
- shared header/toolbar state still reflects the active chart window in tiled mode
- this pass did not add manual UI smoke proof for every sheet/tile interaction inside the staged portable app
- legacy disconnected files under `src/app.js` and `src/modules/*` still contain historical Tauri imports, but the active React/TypeScript renderer path remains clean behind `src/platform/*`

## Next Recommended Step
Perform a manual validation pass inside the staged portable Tauri app focused on:
- switching top chart windows and confirming sheet isolation
- create/load/delete/rename behavior in single mode
- create/load/delete/rename behavior from individual tiles in tiled mode
- named layout round-trip with per-window sheets intact
- only then fix any low-risk sheet/tile UX regressions that show up during that validation

# Chart Readability / Space Pass Report

## Update Note
This report remains accurate for the readability-first spacing decisions. The bottom sheet strip details are now partially superseded by `CHART_WORKSPACE_UX_STABILITY_REPORT.md`, which makes the sheet tabs roomier and keeps the new-sheet `+` attached directly to the strip.

## Review
Implemented a strict readability-first chart spacing pass. The chart window now gains usable space mainly by trimming wasted chrome and tightening wrappers, while key text became easier to read instead of smaller. The portable Tauri build completed successfully at the end of the pass.

## What Was Made More Readable
- `src/components/ChartHeader.tsx`
  - single-chart timeframe buttons increased to `10px`
  - single-chart OHLC readout increased to `10px`
  - symbol label increased to `13px`
- `src/components/TileHeader.tsx`
  - per-tile timeframe buttons increased to `9px`
  - tile symbol text increased to `10px`
  - tile price/change text increased to `9px`
- `src/components/SheetTabs.tsx`
  - bottom workbook tab labels increased to `9px` without increasing strip height
- `src/components/ChartCanvas.tsx`
  - price-pane overlay indicator labels increased to `11px`
  - overlay labels remain plain text with no chip, pill, or badge background
- `src/engine/Renderer.ts`
  - dedicated indicator-pane titles now render at `11px`
  - pane titles remain plain text with no badge styling

## What Chrome / Padding Was Reduced
- `src/components/Toolbar.tsx`
  - toolbar min-height reduced from `28px` to `24px`
  - controls remain readable at `10px` instead of being crushed smaller
- `src/components/ChartCanvas.tsx`
  - chart wrapper padding reduced from `4px 4px 3px` to `3px 3px 2px`
  - chart wrapper gap reduced from `4px` to `3px`
  - bottom chart control strip min-height reduced from `28px` to `24px`
  - bottom control strip padding reduced from `0 6px` to `0 4px`
  - viewport border radius reduced slightly from `10px` to `8px`
- No new chrome blocks were added.
- No essential controls were hidden.

## Timeframe Visibility
- Single-chart mode still keeps exactly one timeframe control set.
- That single timeframe set remains in `ChartHeader.tsx`; the toolbar still does not duplicate it.
- The single-chart timeframe buttons were made larger and clearer:
  - height: `20px`
  - text: `10px`
  - stronger active-state contrast
- Tile mode still keeps compact local timeframe controls in `TileHeader.tsx`, now slightly more legible at `9px`.

## Last-Candle Visibility
- `src/engine/ScaleManager.ts` increased the inner x-scale gutter from `4px` to `10px`.
- This keeps the last candle from feeling pressed into the right edge without rewriting viewport behavior.
- The dedicated price-scale gap in the engine layout was preserved at `8px`.

## Left / Right Chart Margins
- Left inner plot margin is now clearer because the shared x-scale gutter is `10px`.
- Right-side breathing room is also improved by that same `10px` gutter.
- The price-scale strip and its existing `8px` gap were preserved rather than removed.

## Files Modified
- `src/components/ChartHeader.tsx`
- `src/components/Toolbar.tsx`
- `src/components/TileHeader.tsx`
- `src/components/SheetTabs.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/Renderer.ts`
- `src/engine/ScaleManager.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added
- `CHART_READABILITY_SPACE_PASS_REPORT.md`

## Backup Location
- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260402_003850_chart_readability_space_pass`

## Markdown Files Updated
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_READABILITY_SPACE_PASS_REPORT.md`

## Exact Build Commands Run
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Windows Output
- output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- staged executable path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## What Stayed Intentionally Unchanged
- no chart-engine rewrite
- no indicator calculation changes
- no pane ownership changes
- no sheet ownership changes
- no tile layout model changes
- no direct Tauri imports were added outside `src/platform/*`
- Electron fallback remains intact

## Remaining Visual Limitations
- This pass is build-verified, not yet manually smoke-verified inside the staged portable UI.
- The right drawing dock still trades width for quick text labels instead of using icons.
- Shared top-level header/toolbar behavior in tiled mode still follows the active chart window.

# Chart UI Compact Pass Report

## Scope
Visual refinement only. No chart-engine logic, data structures, workspace serializer, indicator logic, or menu structure changes were made in this pass.

## Before vs After
- Before: single-chart mode showed a larger chart header plus a duplicated timeframe strip in the toolbar, which consumed vertical space above the canvas.
- After: single-chart mode uses one compact header row for symbol, timeframe, and OHLC only. The toolbar keeps price-mode, magnet, and indicator controls, but no longer repeats timeframe controls.
- Before: tile headers used a taller two-row presentation and tiles carried more visible chrome.
- After: each tile uses a compact single-row header with its own timeframe selector and tighter spacing.
- Before: sheet tabs already belonged to each chart window, but the strip still had more visual weight than a workbook tab bar.
- After: the per-window sheet strip remains intact and is styled as a smaller workbook-style tab row.

## Layout Changes
- `src/components/ChartHeader.tsx`
  - reduced header to symbol, timeframe selector, and OHLC line only
  - reduced header min-height to 30px
  - reduced padding to `2px 8px`
  - removed exchange, date, right-side price block, and extra chrome
- `src/components/Toolbar.tsx`
  - removed the duplicated timeframe button strip from single-chart mode
  - reduced toolbar min-height to 28px
  - reduced button heights, font sizes, and gaps
- `src/components/TileHeader.tsx`
  - collapsed tile header into a compact single row
  - reduced tile header min-height to 28px
  - reduced padding to `1px 4px`
  - kept per-tile timeframe buttons so tile mode still exposes local timeframe changes
- `src/components/SheetTabs.tsx`
  - preserved per-chart-window ownership
  - reduced strip min-height to 23px
  - reduced tab height to 22px
  - reduced tab padding, font size, and gaps to match workbook-style tabs
- `src/components/ChartCanvas.tsx`
  - reduced outer chart padding from `10px 10px 8px` to `4px 4px 3px`
  - reduced chart shell gap from `8` to `4`
  - reduced viewport border radius from `14` to `10`
  - reduced scrollbar/control strip min-height from `34px` to `28px`
  - reduced scrollbar/control strip horizontal padding from `10px` to `6px`
  - reduced control button sizing and visible-date label width
  - reduced indicator-pane pill overlay offsets from `12px` to `8px` and tightened its padding
- `src/RootApp.tsx`
  - kept single-chart chrome limited to `ChartHeader` and `Toolbar`
  - preserved zero tile-grid gap and zero tile-grid padding
  - reduced tile divider border from `rgba(121, 153, 189, 0.06)` to `rgba(121, 153, 189, 0.04)`

## Price-Scale Gap
- Preserved. This pass did not touch chart-engine layout math or scale calculations.
- Candle-to-price-scale separation continues to rely on the existing engine/layout path rather than CSS widening.

## Sheet Ownership Confirmation
- Sheets remain per-chart-window.
- This pass did not modify `src/store/chartStore.ts` or the workspace serializer.
- `SheetTabs` still operate on the active chart window passed from `RootApp.tsx`.

## Files Modified
- `src/components/ChartHeader.tsx`
- `src/components/Toolbar.tsx`
- `src/components/TileHeader.tsx`
- `src/components/SheetTabs.tsx`
- `src/components/ChartCanvas.tsx`
- `src/RootApp.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added
- `CHART_UI_COMPACT_PASS_REPORT.md`

## Backup Location
- `backups/pre_opencode_changes_20260401_231031_chart_ui_compact_pass`

## Validation Commands Run
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Windows Output
- Output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations
- This pass was intentionally visual only; it does not change tile-mode state ownership or chart-engine behavior.
- Tile mode still reflects the active chart window for shared top-level chrome decisions outside per-tile headers.
- The current validation is build/package level. A manual in-app visual smoke pass should still be done against the staged portable launcher.

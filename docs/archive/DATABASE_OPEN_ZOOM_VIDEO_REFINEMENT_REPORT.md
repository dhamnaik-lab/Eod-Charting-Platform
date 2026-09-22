# DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT

Date: 2026-04-04

## Scope

This pass was driven by direct review of three local videos:

- `C:\Users\Admin\Videos\Captures\EOD charting platfor database opening.mp4`
- `C:\Users\Admin\Videos\Captures\EOD Charting Platform ZOOM-IN ZOOM-OUT.mp4`
- `C:\Users\Admin\Videos\Captures\Tradingview ZOOM-IN ZOOM-OUT.mp4`

The goal was to improve:

- database-open responsiveness
- perceived UI freeze during first active-database load
- zoom-in / zoom-out behavior relative to the TradingView clip

This pass did not redesign the app shell, watchlists, Sheets, or the chart engine architecture.

## What The Videos Showed

### Database opening clip

- the app spent too long in a blank or partially loaded state after opening the database
- the left sidebar symbol panel was still trying to render the full symbol universe during early hydration
- that kind of full-row paint is enough to make a desktop React app feel frozen even after backend work is already reduced

### EOD zoom clip

- zoom-out was still losing user focus compared with TradingView
- the drift was most visible when the user zoomed from a point near the right side of the chart
- the clip strongly suggested that once the pointer left the plot area for UI-driven zoom, the chart fell back to a weaker pivot

### TradingView comparison clip

- TradingView keeps the visible focus materially more stable during repeated zoom changes
- it also tolerates more future/right-side empty space during zoom-out, which helps preserve the hovered date under the same screen position

## Root Causes Found

### Database-open responsiveness

Two renderer-side causes still mattered:

1. `src/components/Sidebar.tsx` rendered the full symbol list immediately after first database hydration.
2. `src/store/chartStore.ts` still kicked off the initial symbol-browser refresh very early in the post-open sequence.

### Zoom behavior

Two zoom-path issues still mattered:

1. `src/components/ChartCanvas.tsx` used `hoverBarIndex` for button and keyboard zoom, but moving the pointer away from the chart clears the live hover state. That means UI-driven zoom could lose the last meaningful anchor and drift toward a weaker fallback pivot.
2. `src/engine/ScaleManager.ts` still allowed only a very tight fixed future/right margin during zoom-out, so preserving a cursor anchor near the right edge became impossible after a few zoom-out steps.

## Changes Applied

### Sidebar rendering / database-open responsiveness

Updated `src/components/Sidebar.tsx`:

- added lightweight virtualization for the Symbols panel list
- added lightweight virtualization for the Watchlists panel item list
- preserved the current sidebar layout, scroll-index rail, watchlist behavior, and symbol-only watchlist rows

Updated `src/store/chartStore.ts`:

- delayed the initial post-open symbol-browser refresh so chart/workspace hydration gets a cleaner first paint before the symbol universe loads

### Zoom stability

Updated `src/engine/types.ts`, `src/engine/Crosshair.ts`, and `src/engine/ChartEngine.ts`:

- `CrosshairState` now carries a precise logical index in addition to the snapped bar index
- crosshair computation now preserves that logical hover anchor instead of exposing only the rounded bar center

Updated `src/components/ChartCanvas.tsx`:

- button and keyboard zoom now reuse the last known logical hover anchor even after the pointer leaves the plot area
- this avoids the video-observed behavior where zooming from UI controls loses the intended chart focus
- scrollbar math now also accounts for any current future/right margin present in the viewport

Updated `src/engine/ScaleManager.ts`:

- zoom/pan clamping now allows a bounded dynamic future margin during wider zoom-out states instead of enforcing only the old fixed 4-bar right margin
- this keeps right-edge zoom-out behavior materially closer to TradingView when the user focus is near the most recent data

## Files Modified

- `src/components/Sidebar.tsx`
- `src/store/chartStore.ts`
- `src/components/ChartCanvas.tsx`
- `src/engine/ScaleManager.ts`
- `src/engine/Crosshair.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/types.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_162034_database_open_zoom_video_fix`

## Validation

Passed:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Bounded packaged-launch recheck passed:

- launched `release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- detected a running `EOD Chart` window/process
- shut it down cleanly afterward

## Runnable Windows Output

- output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- this pass reduces sidebar render cost, but it does not yet introduce full end-to-end profiling or a dedicated performance trace harness
- database open can still feel slow if the active workspace itself needs expensive chart hydration or if the selected database is very large
- zoom stability is improved for both wheel and UI-driven zoom, but extreme history-bound clamp cases can still move slightly when the viewport reaches hard dataset limits
- the current symbol-browser list remains complete; this pass reduced paint cost rather than changing the loaded symbol catalog behavior

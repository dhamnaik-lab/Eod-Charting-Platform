# Indicator Label UI Cleanup Report

## Scope
Strict chart UI cleanup only. No new indicator features, no chart-engine behavior changes, no data-structure changes, no workspace-serializer changes, and no sheet/tile ownership changes were made.

## Previous Indicator Label Behavior
- `src/components/ChartCanvas.tsx` rendered a highlighted chip row inside the chart area.
- The chip row mixed both overlay and pane indicators into one badge-style block.
- Each chip used dot/chip styling plus an inline remove button, which made the chart area look like a tag list instead of a compact desktop chart.
- Dedicated indicator panes already had engine-drawn titles, but those titles used only the short label and did not include indicator parameters.

## New Indicator Label Behavior
- Overlay indicators plotted in the main price pane now render as plain compact text labels at the top-left inside the price pane.
- Dedicated pane indicators now render plain compact name-plus-parameter titles at the top-left inside their own panes.
- The chart-area chip row is removed.
- No pill, badge, or highlighted container remains in the chart area for indicator labels.
- Indicator management remains outside this label path; this pass did not move indicator controls into a new panel.

## Pane Coverage
- Main price pane:
  - all overlay indicators now show name plus parameters as compact plain text
- Dedicated indicator panes:
  - all pane indicators now show name plus parameters as compact plain text in the owning pane

## Files Modified
- `src/components/ChartCanvas.tsx`
- `src/engine/Indicators.ts`
- `src/engine/Renderer.ts`
- `src/indicators/catalog.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added
- `INDICATOR_LABEL_UI_CLEANUP_REPORT.md`

## Backup Location
- `backups/pre_opencode_changes_20260401_234201_indicator_label_ui_cleanup`

## Markdown Files Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `INDICATOR_LABEL_UI_CLEANUP_REPORT.md`

## Exact Build Commands Run
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Output
- Output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Notes
- The first `npm run tauri:portable:win` attempt failed because a stale staged `EOD Chart.exe` process had the previous portable executable locked.
- After stopping that stale process, `npm run tauri:portable:win` completed successfully and refreshed the portable output.
- Tile behavior, sheet behavior, indicator calculations, and chart-engine behavior were preserved.

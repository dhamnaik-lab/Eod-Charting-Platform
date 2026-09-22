# Chart Workspace UX Stability Report

## Review
Implemented a strict chart workspace UX stability pass for the active React + Vite + TypeScript frontend. The pass keeps the AmiBroker-style workflow intact while correcting sheet-tab comfort, left-sidebar reveal/pin behavior, and zoom anchoring. Validation passed through `npm run tauri:portable:win`.

## What Problems Existed Before
- Bottom sheet tabs had become too small and too compressed for comfortable scanning and clicking.
- The new-sheet `+` sat detached at the far right of the bar because the sheet list stretched to fill the row.
- The active sheet state was readable but too subtle for a workspace tab strip.
- The left sidebar rail, panel controls, and list rows were too compact for consistent desktop use.
- The left sidebar could collapse, but it did not expose a clearer AmiBroker-style pin vs auto-hide workflow.
- Wheel zoom still pivoted around the viewport center, which made the visible range drift away from the candle/date under the cursor.
- The bottom scrollbar intentionally skipped sync during zoom, which left it lagging behind the actual visible range after repeated zoom changes.

## Sheets Changes
- `src/components/SheetTabs.tsx` now uses roomier workbook-style tabs with higher click comfort and clearer active-state styling.
- Tab labels are more readable, close buttons are easier to hit, and tabs no longer collapse into tiny unreadable pills.
- The new-sheet `+` now sits immediately after the last visible sheet tab inside the same strip.
- The per-chart-window sheet model, create/rename/delete behavior, and bottom placement were preserved.
- If many sheets exist, the strip now scrolls horizontally instead of shrinking tabs into unusable widths.

## Left Sidebar Changes
- `src/components/Sidebar.tsx` now uses a wider, more obvious rail with larger collapse/panel buttons and larger list/control sizing inside the panel.
- `src/components/RootApp.tsx` now persists sidebar pin state separately from collapse state.
- The sidebar now supports two clear modes:
  - `Pinned`: reveal the sidebar and keep it open.
  - `Auto-hide`: leave it unpinned so it can reopen from the rail and collapse again on chart-area click.
- Reopen behavior is click-based, not hover-based.
- The slim visible rail remains available when collapsed so the sidebar can be reopened easily without removing the left sidebar from the product.

## Zoom Stability Changes
- `src/engine/ChartEngine.ts` now computes wheel-zoom pivot from the current cursor position instead of the viewport center.
- `src/components/ChartCanvas.tsx` and `src/store/chartStore.ts` now reuse the current hover focus for keyboard and bottom-strip zoom buttons when available.
- `src/components/ChartCanvas.tsx` now keeps the native bottom scrollbar aligned with the real visible range during zoom changes instead of freezing its position during zoom.
- The visible candle/date under the cursor is now preserved much more predictably during repeated zoom in/out operations, subject only to natural clamping at the data boundaries.

## Readability / Space Balance
- This pass did not try to reclaim space by shrinking essential text.
- Existing readable timeframe controls, indicator labels, and chart-dominant layout were preserved.
- Space gains come primarily from the click-based auto-hide sidebar option and from removing awkward sheet-strip placement rather than from compressing chart text further.

## What Was Preserved Intentionally
- per-chart-window sheet ownership
- bottom sheet tabs
- create / rename / delete sheet workflow
- workspace serializer behavior
- core sheet model
- left sidebar functional role
- Electron fallback
- the `src/platform/*` runtime seam
- the active `src-tauri-shell` path and the rule that legacy `src-tauri` remains disconnected
- the chart engine architecture beyond low-risk interaction math adjustments

## Files Modified
- `src/components/SheetTabs.tsx`
- `src/components/Sidebar.tsx`
- `src/RootApp.tsx`
- `src/components/ChartCanvas.tsx`
- `src/store/chartStore.ts`
- `src/engine/ChartEngine.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`
- `CHART_WINDOW_UI_CLEANUP_REPORT.md`
- `CHART_WORKSPACE_CORRECTION_REPORT.md`
- `CHART_READABILITY_SPACE_PASS_REPORT.md`

## Backup Location
- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260402_114831_chart_workspace_ux_stability`

## Markdown Files Updated
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`
- `CHART_WINDOW_UI_CLEANUP_REPORT.md`
- `CHART_WORKSPACE_CORRECTION_REPORT.md`
- `CHART_READABILITY_SPACE_PASS_REPORT.md`
- `CHART_WORKSPACE_UX_STABILITY_REPORT.md`

## Exact Build Commands Run
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Windows Output
- output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- staged executable path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations
- Sheet rename still uses the existing prompt-based rename flow rather than inline editing.
- In unpinned mode, the sidebar collapses on main-workspace click; it does not yet auto-close immediately after every in-sidebar action.
- Zoom anchoring still clamps near the extreme left/right history limits because the viewport cannot scroll beyond available data.
- Tiled mode still follows the active chart window for shared top-level chrome outside each tile.

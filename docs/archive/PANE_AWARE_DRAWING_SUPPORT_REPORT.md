# Pane-Aware Drawing Support Report

Date: 2026-04-05

## Problem Fixed

Before this pass, drawing interaction was effectively hard-wired to the main price pane:

- pointer hit-testing always mapped Y coordinates through the main price-scale only
- new drawings could only be created against the main price pane scale
- existing indicator panes were visible, but drawings inside them could not be created, selected, dragged, or edited correctly
- crosshair value behavior also remained tied to the price pane, which made pane-local drawing work inconsistent

## Interaction Limitation Fixed

The exact limitation fixed was:

- drawing tools only worked in the main price pane because pane detection, pane Y-scale mapping, and drawing ownership were all price-pane only

## What Changed

### Pane-aware pointer interaction

- the chart engine now detects the active pane under the cursor
- pointer state now carries:
  - active pane id
  - pane top
  - pane height
  - pane-local value derived from that pane's own Y scale

### Pane ownership for drawings

- drawings now support optional `paneId` ownership
- existing saved drawings without `paneId` continue to default safely to the main price pane
- vertical lines remain intentionally global across the chart stack

### Indicator-pane tool support

The following tools now work inside indicator panes:

- Horizontal Line
- Vertical Line
- Trend Line
- Ray
- Arrow
- Rectangle
- Text
- Channel

The following tools remain intentionally restricted to the main price pane:

- Fib
- Gann

Reason:

- fib and gann are still treated as price-analysis tools, and keeping them price-only is the safest low-risk restriction for this pass

### Rendering and editing behavior

- pane-owned drawings now render inside their assigned pane instead of being forced into the price pane
- selection and hit-testing now use the drawing's owning pane scale
- dragging/editing a pane-owned drawing stays inside its pane
- drawing properties wording now uses `Value`, `Start Value`, and `End Value` when the selected drawing belongs to an indicator pane

## Files Modified

- `src/engine/types.ts`
- `src/engine/Crosshair.ts`
- `src/engine/ChartEngine.ts`
- `src/components/ChartCanvas.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `PANE_AWARE_DRAWING_SUPPORT_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260405_003650_pane_aware_drawing_support`

## Validation Performed

Required validation for this pass:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Manual runtime validation target after packaging:

- launch `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- verify pane-aware drawing behavior in at least one indicator pane such as RSI or MACD

## Output

- output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- fib and gann remain price-pane only by design in this pass
- pane ownership is stable for current indicator ids, but this pass does not add any cross-pane migration UI if a user later removes/reorders indicators in a way that makes an old pane-owned drawing ambiguous
- vertical lines are intentionally global rather than pane-owned
- this pass does not redesign the drawing toolbar or properties dialog beyond the minimum wording needed for pane-aware value editing

# Visual Parity TradingView Pass

Date: 2026-04-05

## Scope

Focused TradingView-style visual parity pass for the active Tauri-only chart engine.

## Exact Limitation Fixed

The chart still used a fixed right-axis width and inconsistent value formatting, and it did not show TradingView-style live indicator values in indicator panes, overlay-indicator readouts in the price pane, or indicator right-axis value tags. Those gaps reduced readability and made indicator panes feel less informative than the main price pane.

## What Changed

1. Shared price/value formatting was aligned across:
   - `src/engine/Renderer.ts`
   - `src/engine/Crosshair.ts`
   - `src/components/ChartHeader.tsx`

2. The right price scale now uses dynamic width measurement based on visible tick labels and latest visible pane values.

3. Indicator pane scaling was tightened slightly for non-fixed-range panes by reducing pane padding from `0.1 / 0.1` to `0.06 / 0.06` while preserving existing `fixedRange` behavior.

4. Indicator panes now show live values in the pane header area using the overlay render path:
   - hovered bar when crosshair is visible
   - latest visible bar when crosshair is hidden

5. Indicator panes now show colored right-axis value tags for latest visible line and histogram values.

6. Overlay indicators in the main price pane now show live readouts inside the chart area using the overlay render path.

7. Pane title rails were refined slightly to stay readable while looking less heavy.

## Files Modified

- `src/engine/Renderer.ts`
- `src/engine/Crosshair.ts`
- `src/engine/ChartEngine.ts`
- `src/components/ChartHeader.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260405_014950_visual_parity_pass`

## Validation Performed

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`
- bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

## Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- The pass improves information density and scale behavior, but it does not include a full manual screenshot-driven parity audit against TradingView.
- Indicator right-axis tags currently apply to indicator panes only; the price pane still keeps its existing dashed last-price marker behavior.
- Dynamic axis width is data-driven and clamped, but it is still chart-wide rather than pane-specific.
- Optional lower-priority polish such as 4-color histogram momentum styling and broader grid/candle visual tuning remains open.

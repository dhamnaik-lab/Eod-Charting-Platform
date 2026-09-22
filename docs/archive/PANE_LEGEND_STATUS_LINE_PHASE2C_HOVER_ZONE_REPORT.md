# Pane Legend and Status-Line Phase 2C Hover Zone Report

## Summary
Successfully implemented Phase 2C: mouse hover/crosshair hit-zone fix for the reserved pane legend/status strip. This ensures that the legend area at the top of each pane is treated as a non-interaction zone, preventing price mismatches and clamping issues when the mouse is over status text.

## Backup created path/name
E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_234315_pane_legend_phase2c_hover_zone

## Files changed
- `src/engine/ChartEngine.ts`

## Exact hover-zone handling approach
1. **Pointer State Enhancement**: Added `isInPlot` boolean to the `PointerState` interface.
2. **Hit-Zone Detection**: Updated `getPointerState` to calculate `isInPlot` by checking if the mouse `offsetY` falls within the `[legendHeight, height]` range of the resolved pane.
3. **Crosshair Suppression**: Modified `onMouseMove` and `onWheel` to set `crosshair.visible = false` whenever `isInPlot` is false. This effectively hides the crosshair lines and labels when the mouse is over the legend strip.
4. **Clamping Correction**: Refined the vertical clamping in `getPointerState` so that even when suppressed, the calculated `localY` and `price` consistently map to the top edge of the plot area (`y=0` in plot coordinates) instead of floating ambiguously inside the legend area.

## How legend/status strip is treated as non-plot interaction zone
- The strip (`y < legendHeight`) is explicitly excluded from the `isInPlot` flag.
- Crosshair visibility is force-disabled when the pointer is in this zone.
- Pointer capture for panning and drawing tool activation is blocked if the initial interaction occurs within this zone.

## How plot-area hover/crosshair still works
- When `y >= legendHeight`, `isInPlot` is true.
- The `localY` is calculated as `offsetY - pane.top - legendHeight`, which correctly aligns with the `ScaleY` mapping established in Phase 2.
- All crosshair and price calculations proceed normally using these corrected local coordinates.

## How drawing tools are protected from legend-strip clicks
- Updated `buildDrawingFromPointer` to check `pointerState.isInPlot`. If false, the function returns `null`, preventing the start of any new drawing (e.g. trendlines, horizontal lines) if the click lands in the legend area.
- Updated `onMouseDown` to prevent starting a chart pan if the click is in the legend strip.

## Validation results
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `npm run build`: Passed.
- Verified that horizontal crosshair and hover price label disappear when entering the legend strip.
- Verified that clicking in the legend strip does not start a drawing or pan the chart.

## Known risks/manual QA needed
- **Border Sensitivity**: At the exact boundary between legend and plot, the crosshair might flicker if the mouse movement is jittery.
- **Axis Interaction**: Hovering the axis at the legend level also hides the crosshair price label, which is the intended behavior to maintain status strip integrity.

## Explicit confirmation
- **Scrollbar logic**: Not modified.
- **Sheet switching logic**: Not modified.
- **Workspace persistence**: Not modified.
- **Indicator formulas**: Not modified.
- **TradingView-style legend buttons**: Not modified.

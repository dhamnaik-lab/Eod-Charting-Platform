# Pane Legend and Status-Line Phase 2 Report

## Summary
Successfully implemented Phase 2 of the TradingView-style pane legend and status-line fix. This phase formalizes the separation between the **legend/status area** at the top of each pane and the **plot area** below it. All chart data rendering, value-to-Y mapping, and crosshair interactions now respect these boundaries, preventing visual overlap between status text and chart elements.

## Backup created path/name
E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_195618_pane_legend_phase2

## Files changed
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`

## Exact implementation approach
1.  **Reservation**: Introduced `PRICE_LEGEND_HEIGHT` (48px) and `INDICATOR_LEGEND_HEIGHT` (28px) constants.
2.  **State Management**: Updated `PaneContext` to explicitly track `plotHeight` and `legendHeight`.
3.  **Scaling**: Modified `buildRenderState` to pass the `plotHeight` to `buildScaleY`. This ensures that the chart's vertical scale is confined to the space below the legend.
4.  **Rendering Loop**:
    *   In `renderBase`, the coordinate system is translated by `legendHeight` before drawing chart content.
    *   A clipping rectangle is applied to the plot area to ensure no data (like long candle wicks or indicator lines) bleeds into the legend area.
    *   Axis backgrounds are drawn for the full pane height, but axis ticks and labels are drawn relative to the translated plot area.
5.  **Interaction**: Updated `getPointerState` to clamp mouse coordinates and map prices relative to the plot area, ensuring crosshair and tooltip accuracy.

## How legend/status area is reserved
The area is reserved by subtracting the legend height from the available pane height during the layout phase. This "missing" height is then used as a vertical offset (`translate`) during the rendering of all chart-related series.

## How plot area is calculated
```typescript
const plotHeight = isCollapsed ? paneHeight : Math.max(paneHeight - legendHeight, 1);
```
The plot area starts at `pane.top + legendHeight` and spans `plotHeight` pixels.

## How ScaleY/value-to-Y mapping was adjusted
`ScaleY` objects are now constructed using `plotHeight` instead of the full `paneHeight`. Consequently, `ScaleY.toPixel(value)` returns a coordinate from `0` to `plotHeight`. Since the rendering context is translated by `legendHeight`, these coordinates correctly align with the visual plot area.

## How crosshair/hover was adjusted
- **Clamping**: The crosshair Y position is now clamped to the plot area: `[pane.top + legendHeight, pane.top + paneHeight]`.
- **Price Mapping**: The Y coordinate passed to `scaleY.toPrice()` is now relative to the plot start (`offsetY - pane.top - legendHeight`).
- **Visuals**: The crosshair vertical line now spans the entire chart height (from `y=0`), with legends drawn on top to maintain a clean status strip.

## Validation results
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `npm run build`: Passed.
- `git status`: Verified only `ChartEngine.ts` and `Renderer.ts` were modified in `src/`.

## Known risks or manual QA needed
- **Small Panes**: Extremely small panes (e.g., height < 60px) might have very cramped plot areas.
- **Many Overlay Indicators**: If a user adds more than 2 rows of overlay indicators to the price pane, the text might bleed out of the 48px reserved area. Throttling/clipping of legend rows might be needed in Phase 3.
- **Drawing Tool Edge Cases**: Verified that horizontal and vertical lines work, but complex multi-point drawings should be checked for clipping at the legend boundary.

## Explicit Confirmation
- **Scrollbar**: Logic was not modified.
- **Sheet Switching**: Logic was not modified.
- **Workspace Persistence**: Logic was not modified.
- **Indicator Formulas**: Formulas were not modified.
- **Runtime Source**: Only `ChartEngine.ts` and `Renderer.ts` were changed.

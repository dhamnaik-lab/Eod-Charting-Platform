# Pane Legend and Status-Line Audit Report

## Summary
This audit examines the current rendering and layout architecture of the EOD Charting Platform to facilitate the implementation of a TradingView-style pane legend and status-line. Currently, indicator labels and values are overlaid directly on the chart plotting area, leading to visual conflicts with candles, indicators, and gridlines.

## Current Visible Problem
- **Overlapping Content**: Indicator legends (titles and values) are drawn inside the same coordinate space as the chart data.
- **Lack of Reserved Space**: There is no dedicated vertical space for the legend. Candles or indicators with extreme values can "touch" or "go under" the legend text, making both hard to read.
- **Manual Offsets**: The crosshair currently uses a `protectedTop` or `reservedTop` parameter to avoid drawing its labels over the legend, but this is a purely visual dodge and does not affect the chart's value-to-Y scaling.

## Files Inspected
- `src/engine/ChartEngine.ts`: Layout calculation and main rendering loop.
- `src/engine/Renderer.ts`: Low-level drawing functions for candles, lines, legends, and titles.
- `src/engine/ScaleManager.ts`: Price/Value to pixel mapping logic.
- `src/engine/Crosshair.ts`: Crosshair computation and rendering.
- `src/components/ChartCanvas.tsx`: React wrapper and canvas setup.
- `src/components/ChartPaneControlsOverlay.tsx`: HTML overlays for pane handles and buttons.

## Current Label Rendering Map
1.  **Main Price Pane Legend**:
    *   **Symbol/OHLC**: Drawn via `ChartEngine.drawTradingViewPriceSummaryLine`. Located at `y=10` relative to the pane top.
    *   **Overlay Indicators (SMA, etc.)**: Drawn via `ChartEngine.drawPriceOverlayLegend`. Located below the OHLC line.
    *   **Compare Instruments**: Drawn via `ChartEngine.drawPriceOverlayLegend`.
2.  **Indicator Pane Legends**:
    *   **Oscillators/Indicators (MACD, RSI, etc.)**: Drawn via `ChartEngine.drawIndicatorPaneLegends`. Located at `y=8` relative to the pane top, offset horizontally by the pane title.
3.  **Pane Titles**:
    *   Drawn via `Renderer.drawPaneTitle` on the **Base Canvas**. Located at `labelTop = 5`.

All legend elements are currently rendered on the **Overlay Canvas** (except Pane Titles), meaning they are always on top of the chart data.

## Current Pane/Layout Model
- **Pane Calculation**: `computeChartLayout` in `ChartEngine.ts` divides the total `contentHeight` into vertical panes (`priceHeight` and `paneHeights[]`).
- **Layout Object**: Contains `paneTops` and `paneHeights`. 
- **Pane Context**: Each pane has a `top` and `height`.
- **Plot Area**: Currently, the entire `height` of the pane is used as the plot area.

## Current Scale/Value-to-Y Model
- **Scaling**: `ScaleManager.buildScaleY` creates a `ScaleY` object.
- **Height Usage**: It receives the full `paneHeight` as the `height` parameter.
- **Mapping**: It maps `[min, max]` values to `[0, height]` pixels.
- **Result**: Chart data (candles, lines, histograms) can occupy the full vertical span of the pane, overlapping with the legend area.

## Current Crosshair/Hover Model
- **Computation**: `computeCrosshair` calculates the value and bar index.
- **Rendering**: `drawCrosshair` renders lines and labels.
- **Protection**: It accepts a `reservedTop` (from `ChartEngine.getPriceOverlayReservedTop`) which it uses to clamp the crosshair's vertical line and horizontal line `y` position so they don't visually interfere with the legend.

## Current Clipping/Render Order
- **Clipping**: There is **no explicit canvas clipping** (`ctx.clip()`) for panes or the plot area in `ChartEngine.ts` (except for Y-axis labels in `Renderer.ts`).
- **Order**:
    1. Base Canvas: Grid -> Volume -> Candles/Lines -> Axis -> Titles.
    2. Overlay Canvas: Crosshair -> Legend -> Drawing Previews.

## Recommended TradingView-Style Target Model
- **LegendRect**: A reserved area at the top of each pane (e.g., height 20-40px).
- **PlotRect**: The remaining area of the pane where chart data is drawn.
- **Scale Isolation**: `ScaleManager` should only use `PlotRect.height`.
- **Clipping**: Explicitly clip rendering to `PlotRect` for all data series and drawings.

## Smallest Safe Phase 2 Implementation Plan
1.  **Enhance `ChartLayout`**: Add a `legendHeight` property (standardized across panes).
2.  **Refine `computeChartLayout`**: Ensure `paneHeight` accounts for the minimum required legend rows.
3.  **Update `ScaleY` Calculation**:
    *   In `ChartEngine.buildRenderState`, subtract `legendHeight` from the height passed to `buildScaleY`.
4.  **Coordinate Translation**:
    *   In `ChartEngine.renderBase`, translate the context by `(0, legendHeight)` before drawing data series.
    *   Apply `ctx.clip()` to the `plotRect` (0 to `paneWidth`, 0 to `plotHeight` relative to translation).
5.  **Adjust Overlay Rendering**:
    *   Align `drawPriceOverlayLegend` and `drawIndicatorPaneLegends` to fit within the `legendHeight` area.
    *   Update `Crosshair.drawCrosshair` to use the formal `legendHeight` as its `reservedTop`.

## Files Likely to Change in Phase 2
- `src/engine/ChartEngine.ts`: Layout logic, render loop coordinate adjustments, and clipping.
- `src/engine/ScaleManager.ts`: Potentially minor adjustments if padding needs to be pane-aware.
- `src/engine/Crosshair.ts`: Syncing `protectedTop` with the new layout model.
- `src/components/ChartPaneControlsOverlay.tsx`: Adjusting HTML overlay positions to avoid legend overlap.

## Risks and Regression Checklist
- [ ] **Price Alignment**: Ensure `ScaleY.toPixel` and `toPrice` are used consistently with the new offsets.
- [ ] **Indicator Accuracy**: Verify oscillators in separate panes still map correctly to their scales.
- [ ] **Pane Resizing**: Verify that resizing a pane correctly recalculates the plot area.
- [ ] **Collapsed Panes**: Ensure legends and plot areas behave correctly when a pane is collapsed.
- [ ] **Crosshair Sync**: Verify that the crosshair value matches the price even with the legend offset.
- [ ] **Marker/Drawing Clipping**: Verify that markers and drawings are properly clipped at the top of the plot area.

## Explicit Confirmation
No runtime source code was modified during this audit.

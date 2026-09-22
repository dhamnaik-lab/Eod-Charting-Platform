# LC-A2 Chart Visual-Area Clipping Hardening Report

## 1. Files Changed
- `src/engine/ChartEngine.ts`

## 2. Exact Clipping Strategy Used
I implemented explicit canvas clipping using the `ctx.save()`, `ctx.beginPath()`, `ctx.rect()`, `ctx.clip()`, and `ctx.restore()` pattern. 

- **Price Pane**: Clipped rendering of candles, volume overlay, indicators (overlays), and drawings to the price pane boundaries (`layout.chartWidth` and `layout.priceHeight`).
- **Indicator Panes**: Clipped rendering of indicator lines, histograms, and pane-specific drawings to each indicator pane's individual boundaries (`layout.chartWidth` and `context.height`).
- **Vertical Lines (vlines)**: Clipped to the full plot area (`layout.chartWidth` and `layout.contentHeight`) to prevent horizontal bleed into the price axis.
- **Drawing Previews**: Applied equivalent clipping to drawing previews on the overlay canvas via `drawDrawingInPane` and local blocks in `renderOverlay`.
- **Axes**: Deliberately kept axes (`drawYAxis`, `drawXAxis`, `drawAxisValueTags`) outside the primary clipping blocks to ensure labels and ticks remain fully visible.

## 3. Why the fix is small/surgical
- The fix only touches one file: `src/engine/ChartEngine.ts`.
- It leverages existing layout data (`layout.chartWidth`, `layout.priceHeight`, `context.height`, etc.) already computed by the engine.
- It does not modify any core state, store logic, or coordinate conversion math.
- It follows the standard canvas API patterns for clipping without introducing new dependencies or abstractions.

## 4. What was deliberately not changed
- `src/store/chartStore.ts` and `src/store/chartStoreTypes.ts` (State and persistence).
- `src/engine/ScaleManager.ts` (Coordinate math).
- `src/engine/Renderer.ts` (Drawing primitives).
- Viewport and zoom/pan logic.
- Persistence and workspace serialization.

## 5. Validation Results
- **Typecheck**: `npm run typecheck:renderer` passed successfully.
- **Tauri Check**: `npm run tauri:check` passed successfully.
- **Git Status**: Only `src/engine/ChartEngine.ts` was modified in `src/engine`.

## 6. Manual QA Checklist
- [ ] **Candle clipping**: Verify candles do not overlap the price axis background.
- [ ] **Wicks clipping**: Verify wicks are cut off exactly at the plot boundaries.
- [ ] **Volume bars**: Verify volume bars stop at the time axis.
- [ ] **Indicator bounds**: Verify RSI/MACD/etc. do not bleed into the price pane or adjacent indicator panes.
- [ ] **Drawing bleed**: Verify long trendlines are clipped at the price axis and time axis.
- [ ] **Drawing preview**: Verify trendline previews follow the same clipping as committed drawings.
- [ ] **Crosshair alignment**: Verify crosshair still aligns perfectly with price/time axes.
- [ ] **Zoom/Pan stability**: Verify that rapid zooming and panning does not cause visual artifacts or "ghosting" of clipped areas.
- [ ] **Sheet switch**: Verify switching sheets preserves the correct clipping for the new layout.
- [ ] **Symbol switch**: Verify switching symbols updates clipping bounds correctly.
- [ ] **Startup restore**: Verify latest/right-side viewport is restored correctly with clipping active.

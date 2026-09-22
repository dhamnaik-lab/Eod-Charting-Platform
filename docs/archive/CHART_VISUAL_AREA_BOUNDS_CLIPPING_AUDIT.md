# Chart Visual Area Bounds and Clipping Audit

## 1. Scope
This is an audit-only review of the chart visual boundaries, clipping behavior, panes, axes, gridlines, crosshair, drawings, volume rendering, and Device Pixel Ratio (DPR) handling within the EOD Charting Platform. The goal is to identify areas where rendering may "bleed" into unintended areas and suggest a low-risk strategy for formalizing the layout contract.

## 2. Files Inspected
- `src/components/ChartCanvas.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/Indicators.ts`
- `src/engine/Crosshair.ts`
- `src/store/chartStore.ts` (read-only)
- `src/store/chartStoreTypes.ts` (read-only)

## 3. Current Layout / Bounds Model
The layout is primarily calculated in `ChartEngine.ts` via `getRenderState` and `computeChartLayout`.

- **Full Canvas Area**: Defined by the container size and window `devicePixelRatio`. Resized in `ChartEngine.resize()`.
- **Plot Area**: The main region excluding the price axis (right) and time axis (bottom). Width is `width - axisWidth`, height is `height - xAxisHeight`.
- **Price Axis Area**: A vertical strip of width `axisWidth` on the right side.
- **Time Axis Area**: A horizontal strip of height `xAxisHeight` at the bottom.
- **Pane Bounds**: Vertical segments within the plot area. 
  - Price pane height is calculated as the remainder after indicator panes.
  - Indicator pane heights are either default, overridden, or collapsed.
- **Overlay Canvas Bounds**: Syncs with the base canvas; used for crosshair and drawing previews.

## 4. Current Clipping Behavior
The engine currently relies on **procedural restraint** (calculating coordinates and skipping points outside the viewport) rather than **explicit canvas clipping** (`ctx.clip()`).

### Clipping Status Table

| Rendered element | File/function | Current bounds used | Clipping present? | Risk level | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Candles** | `Renderer.drawCandles` | `viewport` start/end indices | No | Medium | Wicks/bodies can bleed into price axis if wide. |
| **Wicks** | `Renderer.drawCandles` | `viewport` start/end indices | No | Medium | Can bleed into price/time axes. |
| **Volume bars** | `Renderer.drawVolume` | `viewport` start/end indices | No | Medium | Can bleed into time axis or next pane. |
| **Gridlines** | `Renderer.drawGrid` / `drawVerticalGrid` | `width`, `height` params | No | Low | Usually restricted by parameter passing. |
| **Price axis labels** | `Renderer.drawYAxis` | `axisX`, `axisWidth`, `height` | **Yes** | Low | Uses `ctx.clip()` for the vertical axis strip. |
| **Time axis labels** | `Renderer.drawXAxis` | `width`, `height`, `axisHeight` | No | Low | Relies on drawing at `height - axisHeight`. |
| **Crosshair vertical** | `Crosshair.drawCrosshair` | `protectedTop`, `chartHeight` | No | Medium | Procedurally clamped but draws over all panes. |
| **Crosshair horizontal**| `Crosshair.drawCrosshair` | `0`, `chartWidth` | No | Medium | Clamped to plot area horizontally. |
| **Crosshair labels** | `Crosshair.drawCrosshair` | `width`, `height`, `axisWidth` | No | Low | Positioning logic prevents bleed. |
| **Drawings** | `Renderer.drawDrawing` | `width`, `height` params | No | **High** | Trendlines/Rays bleed into axes and other panes. |
| **Drawing previews** | `ChartEngine.renderOverlay` | Same as drawings | No | **High** | Very noticeable bleed during drag/placement. |
| **Indicator plots** | `Renderer.drawLine` / `drawHistogram` | `viewport` indices | No | **High** | Bleeds vertically into neighboring panes. |
| **Pane dividers** | `Renderer.drawPaneTitle` | `width` | No | Low | Simple horizontal line at top of pane. |
| **Future Vol Profile** | N/A | N/A | N/A | Medium | Will require strict horizontal clipping. |

## 5. Risk Findings

### High Risk
- **Indicator/Drawing Bleed**: Because `drawLine` and `drawDrawing` do not clip vertically, extreme data values or long trendlines visually spill over into adjacent panes. This is most visible when a pane is small or collapsed.
- **Axis Overlap**: Large drawings or candle wicks can overlap the price axis background, especially since the axis background is drawn *before* the price axis strip in the same pass.

### Medium Risk
- **Crosshair Transparency**: Crosshair lines are drawn on the `overlayCanvas` across the entire plot area. While they are clamped to the chart width/height, they lack pane-specific context, which might be confusing if multiple panes have different scales.
- **Volume Overlay**: Volume bars in the price pane are drawn on top of the grid but below candles. They can bleed into the time axis if the scale calculation is slightly off.

### Low Risk
- **DPR Sharpness**: Subpixel alignment (`Math.floor(x) + 0.5`) is used in many places but not consistently everywhere. This can cause slightly blurry gridlines or axis ticks on certain zoom levels.

## 6. Recommended Fix Strategy

### LC-A2 Small Safe Fix
**Goal**: Add explicit `ctx.clip()` boundaries to panes and axes where clearly missing, using existing layout data.

**Plan**:
1.  **Define a Clipping Helper**: Create a simple utility in `Renderer.ts` or `ChartEngine.ts` to wrap drawing operations in a `save() -> clip() -> draw() -> restore()` block.
2.  **Pane Clipping**: In `ChartEngine.renderBase`, wrap the rendering of each pane (Price and Indicators) in a clipping rectangle matching the pane's layout bounds.
3.  **Plot Area Clipping**: Wrap drawings and series rendering in a clipping rectangle that excludes the price and time axes.
4.  **Overlay Clipping**: Ensure the crosshair and drawing previews on `overlayCanvas` are clipped to the plot area.

**Rules**:
- No changes to `chartStore.ts` or state model.
- No changes to `ScaleManager.ts` logic.
- No persistent scale objects or complex refactors.

### LC-A3 Manual QA
- Verify that a long Trendline stops exactly at the price axis boundary.
- Verify that an indicator with extreme values (e.g. RSI > 100) stays inside its pane.
- Verify that crosshair lines do not draw over the date/time labels on the bottom axis.
- Verify that symbol/sheet switching correctly updates the clipping bounds.

### Future Only
- Transitioning to a `Series` object model that handles its own clipping.
- Implementing a persistent `Pane` class with its own coordinate system.

## 7. Files That Should Not Be Changed Yet
- `src/store/chartStore.ts`
- `src/store/chartStoreTypes.ts`
- `src/engine/ScaleManager.ts`

These should remain untouched to preserve current stable behavior.

## 8. Suggested LC-A2 Implementation Scope
- `src/engine/Renderer.ts`: Add `ctx.clip()` to series/drawing functions or provide a wrapper.
- `src/engine/ChartEngine.ts`: Apply clipping blocks in `renderBase` and `renderOverlay` loops.
- **Smallest possible change**: 4-5 lines of `ctx.clip()` logic in `ChartEngine.ts` loops.

## 9. Manual QA Checklist
- [ ] Candle clipping at Price Axis.
- [ ] Drawing clipping at Price/Time Axis.
- [ ] Volume clipping at Time Axis.
- [ ] Indicator pane vertical clipping.
- [ ] Gridline alignment with axis ticks.
- [ ] Price axis boundary respect.
- [ ] Time axis boundary respect.
- [ ] Crosshair alignment and clamping.
- [ ] Zoom/Pan stability.
- [ ] Sheet/Symbol switch viewport stability.

## 10. Final Recommendation
A small **LC-A2 clipping fix** is definitely needed to resolve high-risk bleed issues. It is safe to proceed to implementation with a surgical approach in `ChartEngine.ts`. No major refactoring is required yet.

Validation:
`git status --short` should show only the new report.
`npm run typecheck:renderer` and `npm run test` should be run if any code is touched (but for LC-A1, no code is touched).

---
*End of Audit Report*

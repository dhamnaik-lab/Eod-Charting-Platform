# Lightweight Charts Visual Area Audit for EOD Charting Platform

## 1. Scope
This audit compares the chart visual-area architecture of the EOD Charting Platform against TradingView's `lightweight-charts` library. The focus is strictly on the visual presentation layer, including:
- Plot area and axis boundary calculation.
- Rendering models (Canvas layering, invalidation, and performance).
- Coordinate mapping (Time and Price scales).
- User interaction guides (Crosshair, gridlines, tooltips).
- Pane management and scaling behavior.
- Volume rendering and overlay strategies.

This audit does not cover data storage, networking, database operations, or trading functionality.

## 2. Current EOD Chart Visual Area Summary
The EOD Charting Platform utilizes a custom-built Canvas engine structured as follows:

- **Two-Canvas Layering**: 
  - `baseCanvas`: Renders relatively static data (candles, volume, grid, axes, drawings).
  - `overlayCanvas`: Renders highly dynamic elements (crosshair, drawing previews, tooltips).
- **Procedural Rendering**: The `Renderer.ts` file contains pure functions (`drawCandles`, `drawVolume`, `drawGrid`) called sequentially by the `ChartEngine`.
- **Transient State Model**: `ChartEngine` calculates a `RenderState` on each frame (if dirty), which includes layout dimensions and built scales (`ScaleX`, `ScaleY`).
- **Scale Management**: `ScaleManager.ts` provides logic for building linear/log scales and generating "nice" ticks for axes.
- **Pane System**: Supports a main price pane and multiple indicator panes. Each pane has its own `ScaleY`.
- **Volume Handling**: Volume is typically drawn as an overlay in the price pane background using a dedicated volume scale (`buildVolumeScaleY`).
- **React Integration**: The `ChartCanvas.tsx` component acts as a bridge, mounting the engine and syncing viewport state back to the React store.

**Key Files**:
- `src/engine/ChartEngine.ts`: Core orchestration and event handling.
- `src/engine/Renderer.ts`: Low-level Canvas drawing logic.
- `src/engine/ScaleManager.ts`: Mathematical coordinate mapping and tick generation.
- `src/engine/Indicators.ts`: Logic for building renderable indicator data.

## 3. Lightweight Charts Architecture Summary
TradingView's `lightweight-charts` is designed for high-performance, decoupled rendering:

- **Model-View-Renderer (MVR)**:
  - **Model**: Stores the source of truth (series data, options).
  - **View**: A "view model" that uses scales to convert data into pixel-ready coordinates.
  - **Renderer**: A stateless drawing component that executes Canvas API calls.
- **Dedicated Scale Objects**: `TimeScale` and `PriceScale` are persistent objects that manage their own tick generation, formatting, and auto-scaling logic.
- **Hierarchical Layout**:
  - `ChartModel` manages the global state.
  - `Pane` manages a vertical slice containing series and axes.
  - `Series` represents data (Line, Candlestick, etc.).
- **Multiple Price Scales**: Supports left, right, and overlay scales within the same pane.
- **Layering Model**: Renders in distinct passes (Background, Grid, Series, Markers, Crosshair).
- **Invalidation Strategy**: Instead of redrawing everything, it marks specific layers as "invalid" to minimize redundant calculations.

## 4. Side-by-Side Comparison Table

| Area | EOD Charting Platform Current Behavior | lightweight-charts Behavior | Useful Idea for EOD? | Risk / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Main plot area** | Calculated via `computeChartLayout` helper. Clipping handled manually in drawing functions. | Pane-based layout with strict boundary protection. | **Yes**: Clearer boundary contract for panes. | Low risk; mainly a code organization improvement. |
| **Price axis** | Right-only right now. Width measured dynamically in `measureDynamicAxisWidth`. | Supports Left, Right, and No-axis (overlay) modes. | **Yes**: Multiple axis support (Left/Right). | Medium; requires `ScaleManager` and `Layout` refactor. |
| **Time axis** | Integrated in `ScaleX`. Ticks generated in `niceXTicks`. | Managed by dedicated `TimeScale` object. | **Yes**: Move time logic into a dedicated class. | Low; cleaner separation of concerns. |
| **Gridlines** | Drawn as a full background pass in `drawGrid`. | Integrated into the pane rendering pass. | **No**: Our current model is efficient enough. | N/A |
| **Crosshair** | Two-canvas overlay. Coordinates computed in `computeCrosshair`. | High-performance interaction layer with hit-testing. | **Yes**: Hit-testing for drawings/markers. | We already do some hit-testing; could be formalized. |
| **Candles/OHLC** | Drawn in one pass on `baseCanvas`. | Series-based View/Renderer pattern. | **Yes**: Series abstraction. | Medium; would change how indicators are handled. |
| **Volume bars** | Hardcoded overlay in `Renderer.drawVolume`. | Just another series type (`HistogramSeries`). | **Yes**: Treat volume as a first-class series. | Low; makes volume more flexible. |
| **Volume profile** | Not currently supported. | Supported via custom primitives/plugins. | **Yes**: Plugin model for advanced overlays. | High; requires a major architectural shift. |
| **Indicator panes** | Vertical stack. Resizing handled via React state. | Managed by the `ChartModel`. | **Yes**: Native engine-level pane management. | Medium; reduces React -> Engine bridge noise. |
| **Autoscale** | Recomputed on every `getRenderState` pass. | Optimized "auto-scale" with margin awareness. | **Yes**: Better margin/padding configuration. | Low. |
| **Viewport** | Managed in engine, synced to React. `startIndex`/`endIndex` model. | Internal `TimeScale` state. Logical range model. | **No**: Our current model is stable. | N/A |
| **DPR Handling** | Handled in `resize()` via `setTransform`. | Sophisticated sub-pixel alignment and scaling. | **Yes**: Sharper lines via floor/round precision. | We already do some, but could be refined. |
| **Redraw Model** | `isDirty` flag for `baseCanvas`. Overlay always redrawn. | Granular invalidation (data vs. visual). | **Yes**: Invalidate only what changed. | Medium; improves performance for large charts. |

## 5. Detailed Findings

### 5.1 Plot Area and Axis Boundary Model
EOD uses a "top-down" layout where the `ChartEngine` decides where everything goes and passes these coordinates to the `Renderer`. While simple, it can lead to "leakage" where drawings aren't perfectly clipped to their panes.
**Lightweight-charts** uses a more robust boundary model where each pane is effectively a self-contained drawing context, ensuring series never bleed into axes or other panes.

### 5.2 Volume Bars and Volume Profile Overlay
In EOD, Volume is special-cased in `renderBase`. To support features like **Volume Profile** (horizontal volume), we would need to add a new rendering function.
**Lightweight-charts** handles this via "Custom Series" or "Plugins". This allows any data to be rendered in any orientation without modifying the core engine.

### 5.3 Gridlines, Crosshair, and Coordinates
Both systems use a two-step process: `Value -> Coordinate` and `Coordinate -> Value`.
EOD's `ScaleX` and `ScaleY` are very similar to LW's `TimeScale` and `PriceScale`, but EOD's versions are transient (recreated every pass). LW's persistent objects allow for smoother animations and better state retention (e.g., maintaining a user-dragged manual scale during a symbol switch).

### 5.4 Chart Pane, Indicator Pane, and Price Scale Model
EOD's indicator panes are built as "RenderablePane" objects. 
LW's model is more flexible: you can have 5 different indicators in one pane, each with its own scale, or all sharing one. EOD currently assumes 1 indicator group per pane (except overlays in the price pane).

### 5.5 Time/Date Bar and Horizontal Viewport Model
EOD's `startIndex/endIndex` model is robust for EOD data.
LW uses a "Logical Range" which is more abstract and better for handling intraday gaps or different trading sessions. For our EOD-only platform, EOD's current model is actually simpler and works well with our binary storage searching.

### 5.6 Rendering and Performance Model
EOD's two-canvas model is excellent for interaction performance (crosshair is "free").
LW's View/Renderer decoupling is better for complex scenes. If we add 50 indicators, LW would only re-calculate coordinates when data changes, whereas EOD re-calculates many of them on every "dirty" redraw.

## 6. What We Should Borrow Conceptually
1.  **Series Abstraction**: Instead of `drawCandles`, `drawVolume`, etc., define a `Series` contract. Each series (Price, Volume, RSI) provides its own `Renderer`.
2.  **Persistent Scale Objects**: Move scale logic out of `getRenderState` into objects that persist across frames. This makes "Manual Scale" and "Log Scale" transitions much easier to manage.
3.  **Formal Pane Objects**: Let a `Pane` class handle its own layout and axis measurement.
4.  **Renderer Invalidation**: Add a way to mark parts of the `RenderState` as "valid" so we don't re-calculate every coordinate when only the crosshair moved.
5.  **Multi-Scale Panes**: Allow a single pane to host multiple price scales (e.g., an "Overlay" scale that doesn't affect the main candle scale).

## 7. What We Should Avoid
- **Logical Range Complexity**: LW's time-scale logic is very complex because it supports many timeframes and intraday gaps. Since EOD is strictly daily (or higher), our index-based model is faster and safer.
- **Deep Decoupling**: Don't over-engineer the View/Renderer split. For a custom engine, having "High-Signal" functions in `Renderer.ts` is often easier to debug than a hierarchy of View/Renderer classes.
- **DOM-heavy Overlays**: LW uses a lot of absolute-positioned DIVs for axes. EOD's "All-in-Canvas" approach for axes is more "portable" and easier to style consistently via the `theme` object.

## 8. Recommended Incremental Improvements

### Phase A: Plot-Area Cleanup
- **Goal**: Formalize the layout contract.
- **Files**: `src/engine/ChartEngine.ts`, `src/engine/Renderer.ts`.
- **Action**: Ensure all drawing functions receive a strict `clippingRect` or `bounds` object.

### Phase B: Scale Objectification
- **Goal**: Move from transient scales to persistent scale objects.
- **Files**: `src/engine/ScaleManager.ts`.
- **Action**: Create a `PriceScale` class that holds `min/max`, `logScale`, and `invert` state.

### Phase C: Series/Renderer Decoupling
- **Goal**: Allow indicators to provide their own rendering logic.
- **Files**: `src/engine/Indicators.ts`, `src/engine/Renderer.ts`.
- **Action**: Define a `Renderable` interface with a `draw(ctx, scales)` method.

### Phase D: Volume Overlay Flexibility
- **Goal**: Support Volume Profile and better Volume Overlay positioning.
- **Files**: `src/engine/Renderer.ts`.
- **Action**: Refactor `drawVolume` to be a standard series that can be added to any pane.

## 9. Specific File-Level Recommendations

- `src/engine/ChartEngine.ts`: **Small refactor**. Move layout calculation into a dedicated `LayoutManager`.
- `src/engine/ScaleManager.ts`: **Medium refactor**. Transition to a class-based approach for scales.
- `src/engine/Renderer.ts`: **Small refactor**. Parameterize all drawing functions with `bounds`.
- `src/store/chartStore.ts`: **No change**.
- `src/components/ChartCanvas.tsx`: **No change**.

## 10. Manual QA Suggestions
- **Alignment**: Verify candles don't overlap the price axis when scrolling.
- **Clipping**: Add a "very high" indicator and ensure it doesn't bleed into the pane title.
- **DPR**: Check for "fuzzy" lines on 4K monitors; ensure `Math.floor(x) + 0.5` is consistently used for 1px lines.
- **Resizing**: Rapidly resize indicator panes and verify the axis scales update instantly without "jumping".

## 11. Final Recommendation
TradingView's `lightweight-charts` provides an excellent architectural blueprint for **Scale Persistence** and **Series Abstraction**. EOD Charting Platform should **not** replace its engine, but should incrementally adopt the **Series -> View -> Renderer** pattern to make the engine more extensible for future features like Volume Profile, advanced drawing tools, and custom indicators.

The most immediate value lies in **Phase B (Scale Objectification)**, as it would stabilize the "Manual Scale" and "Log Scale" behavior which currently feels "recalculated" on every symbol change.

---
*End of Audit Report*

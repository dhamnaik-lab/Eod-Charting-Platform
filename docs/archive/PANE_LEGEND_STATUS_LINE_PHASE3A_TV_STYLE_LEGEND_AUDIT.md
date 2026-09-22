# Pane Legend / Status Line Phase 3A - TradingView-Style Legend Audit

Date: 2026-05-23

Scope: audit only. No runtime source code was modified for this Phase 3A audit; this markdown file is the only intended deliverable.

## Summary

Phase 2 reserved legend/status strips inside `ChartEngine` so chart plots, crosshair, drawings, and axis labels do not overlap the top legend area. The remaining gap is interaction and presentation: the visible legend/status text is still canvas text, so it cannot naturally expose TradingView-style hover controls near each indicator label.

The safest Phase 3B direction is a React/HTML legend overlay, not canvas hit-tested buttons. The first implementation should target the price-pane legend only: main OHLC/status row plus price-pane overlay/compare rows with compact hover actions. Separate indicator-pane legend replacement should follow after the shared legend/layout model is proven.

Important checkout note: initial `git status --short` was already dirty before this audit, and `HEAD` was `b6a0e97` rather than the prompt-stated `e19e3c8`. This report audits the current working tree as found.

## Current Visible Limitation

- Price-pane OHLC/status text, overlay indicator values, compare labels, indicator-pane title pills, and indicator-pane value rows are canvas-rendered.
- Canvas text cannot host native buttons, focus states, tooltips, or hover-revealed controls without adding manual hit testing to the chart engine.
- Current React controls are split away from the actual labels:
  - toolbar study chips above the chart can open settings/remove indicators
  - separate pane controls on the right can collapse, hide/show, fit, move, configure, and remove pane indicators
  - price-pane overlay legend rows have no near-label gear/eye/remove controls
- Existing hidden pane indicator behavior is a risk area: `ChartCanvas` computes pane-control layout from all pane indicators, while `ChartEngine` computes rendered pane layout from visible indicators only.

## Files Inspected

- `AGENTS.md`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartPaneControlsOverlay.tsx`
- `src/components/Toolbar.tsx`
- `src/components/IndicatorSettingsDialog.tsx`
- `src/components/CustomFormulaDialog.tsx`
- `src/components/ChartSettingsMenu.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/types.ts`
- `src/engine/Indicators.ts`
- `src/indicators/catalog.ts`
- `src/store/chartStore.ts`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/features/charts/chartIndicatorPaneService.ts`
- `src/features/workspace/workspacePersistence.ts`

## Current Canvas Legend Rendering Map

### Price Pane

Current price-pane legend rendering is centered in `src/engine/ChartEngine.ts`.

- `renderOverlay()` computes `valueIndex` from crosshair state or latest visible bar and then calls:
  - `drawPriceOverlayLegend(this.overlayCtx, renderState, valueIndex)`
  - `drawIndicatorPaneLegends(this.overlayCtx, renderState, valueIndex)`
- `drawPriceOverlayLegend()` renders:
  - main TradingView-style OHLC/status line via `drawTradingViewPriceSummaryLine()`
  - overlay indicator rows via `buildOverlayLegendRows()`
  - compare instrument rows via `buildCompareLegendRows()`
- `drawTradingViewPriceSummaryLine()` uses canvas `fillText` and `measureText` for:
  - symbol/timeframe/exchange title, e.g. `NIFTY | D | NSE_INDEX`
  - O/H/L/C values
  - signed price and percent change
- `buildOverlayLegendRows()` reads `RenderableOverlay` line/point values at `valueIndex` and formats rows such as SMA/EMA/WMA values.
- `buildCompareLegendRows()` reads compare percent values and formats compare instrument labels.
- `drawLegendTokens()` in `src/engine/Renderer.ts` performs the actual canvas token drawing and wrapping.

Price-pane labels that should eventually move to React/HTML:

- main OHLC/status row if it needs TradingView-style hover/actions and consistent text layout
- overlay indicator label/value rows
- compare label/value rows if they need controls or clickable behavior later

Price-pane labels that can remain canvas:

- right/left axis labels and value tags
- last price marker
- crosshair price/date labels
- event marker badges

### Separate Indicator Panes

Separate indicator panes also render labels through canvas.

- `ChartEngine.buildRenderState()` builds `indicatorPanes` from visible renderable pane indicators.
- Each pane has a `PaneContext` with:
  - `id`
  - `title`
  - `top`
  - `height`
  - `plotHeight`
  - `legendHeight`
  - `collapsed`
  - `scaleY`
- `renderBase()` draws each indicator pane and calls `drawPaneTitle()` for the pane title pill.
- `drawPaneTitle()` in `src/engine/Renderer.ts` canvas-draws the title pill, separator line, and title text.
- `drawIndicatorPaneLegends()` canvas-draws values next to the pane title.
- `buildPaneLegendTokens()` formats pane line/histogram values at `valueIndex`.
- MACD values are produced by `buildRenderableIndicator()` in `src/engine/Indicators.ts`:
  - line `MACD`
  - line `Signal`
  - histogram `Histogram`
- RSI values are produced as a single line with reference lines and fixed range.

Indicator-pane labels that should eventually move to React/HTML:

- pane title row if it should expose gear/eye/delete near the title
- pane value rows such as MACD/Signal/Histogram and RSI value text

Indicator-pane labels that can remain canvas:

- actual plotted indicator lines/histograms/reference lines
- Y-axis labels and value tags
- crosshair/value labels

## Existing Indicator Settings / Visibility / Remove Flow

### Settings

Existing settings UI is reusable.

- `Toolbar.tsx`
  - renders study chips from `activeTab.indicators`
  - chip click sets `editingIndicatorId`
  - non-custom studies open `IndicatorSettingsDialog`
  - custom studies open `CustomFormulaDialog`
- `ChartPaneControlsOverlay.tsx`
  - renders pane action buttons for pane indicators
  - gear button calls `onOpenPaneSettings(indicator.id)`
  - settings dialogs are rendered with `createPortal(..., document.body)`
- `IndicatorSettingsDialog.tsx`
  - accepts `indicator`, `onSave`, `onRemove`, `onClose`
  - clones a draft, edits typed fields, calls `onSave(draft)`
- `CustomFormulaDialog.tsx`
  - supports create and edit modes
  - validates formula definition before submit
  - calls `onSubmit(draft)` and optional `onRemove(id)`

### Visibility

- `OverlayIndicator` has optional `visible?: boolean` in `src/engine/types.ts`.
- `buildRenderableIndicators()` filters `indicator.visible !== false`.
- `ChartPaneControlsOverlay` already exposes an eye/hide button for pane indicators.
- `ChartCanvas.toggleIndicatorVisibility()` updates an indicator with `{ ...indicator, visible }`.
- There is no equivalent near-label visibility action for price-pane overlay indicators today.

### Remove

- `Toolbar.tsx` remove chip calls `removeIndicator(indicator.id)`.
- `ChartPaneControlsOverlay.tsx` remove button calls `onRemoveIndicator(indicator.id)`.
- `chartStore.ts` wires `removeIndicator` through `removeTabIndicator()`.
- `removeTabIndicator()` filters the indicator out and prunes stale pane heights, collapsed state, and scale overrides.
- Custom indicators do not need a separate remove flow; they use the same `removeIndicator(id)` path.

## Current Pane / Layout Data Available To React

`ChartCanvas.tsx` already has substantial data:

- `bars`
- `compareOverlays`
- `overlays`
- `viewport`
- `indicatorPaneHeights`
- `collapsedIndicatorPanes`
- `paneScaleOverrides`
- `axisWidth`
- `showLeftAxis`
- `futureMarginMode`
- `timeframe`

`ChartCanvas` also recomputes a layout with exported `computeChartLayout()` and passes it to `ChartPaneControlsOverlay`.

Current limitations for a React legend overlay:

- `ChartCanvas` only stores `hoverBar`, not the active `barIndex` / `valueIndex` needed for indicator arrays.
- `ChartEngine` has the authoritative `RenderState`, but it is private.
- `ChartEngine` emits `crosshairMove`, `viewportChange`, `paneScaleChange`, and `axisWidthChange`, but no legend/layout snapshot event.
- Overlay indicator renderable values can be produced by `buildRenderableIndicators()`, but compare legend values are currently private to `ChartEngine.buildCompareRenderables()`.
- Pane layout can mismatch if React computes pane ids differently from the engine. The current hidden pane risk comes from `ChartCanvas` using all pane indicators while the engine uses visible renderable panes.

Conclusion: React can know enough for a first price-pane overlay, but only if Phase 3B either extracts/shared the legend-value model or exposes a small engine legend snapshot. A full pane legend replacement should not duplicate private engine layout/value logic.

## Recommended UI Architecture

### A. Canvas-Drawn Buttons With Manual Hit Testing

Not recommended.

Pros:

- No DOM overlay alignment problem.
- Existing canvas render path already knows exact values and layout.

Cons:

- Requires manual hit rectangles, hover state, focus behavior, tooltip behavior, and click routing inside `ChartEngine`.
- Increases pointer complexity in an engine already handling pan, crosshair, drawing tools, axis drag, pane resize, and kinetic scrolling.
- Harder to make accessible and maintainable.
- High risk of breaking chart panning/crosshair/drawing interactions.

### B. React/HTML Overlay Positioned Above Canvas

Recommended.

Pros:

- Natural buttons, hover, focus, title/tooltips, keyboard semantics, and CSS.
- Reuses existing `IndicatorSettingsDialog` and `CustomFormulaDialog`.
- Keeps chart rendering in canvas and UI controls in React.
- Lower long-term maintenance cost.

Cons:

- Needs a reliable shared layout/value model to avoid canvas/HTML drift.
- Must manage pointer-events carefully.
- Must suppress duplicate canvas legend text when HTML replacement is active.

### C. Hybrid: Keep Canvas Text, Add HTML Buttons

Acceptable only as a very short transitional step, but not recommended as the final direction.

Pros:

- Smallest visual change.
- Buttons can reuse existing dialogs/actions.

Cons:

- Creates duplicate layout ownership.
- Buttons can drift away from canvas text after resize, axis width changes, hidden indicators, or pane collapse.
- Still leaves labels non-interactive and canvas-only.

Recommendation: choose B, implemented in small slices. Avoid A.

## Proposed TradingView-Style Legend Design

### Price Pane

Render an absolute React legend block inside the price pane legend strip.

Target rows:

- Main row:
  - `BANKNIFTY | D | NSE_INDEX`
  - `O 55,250`
  - `H 55,800`
  - `L 54,920`
  - `C 55,401`
  - signed change and percent
- Overlay rows:
  - `SMA 20 55,401`
  - `EMA 21 54,868`
  - `WMA 20 54,854`
  - optional compact color swatch
  - hover actions: gear, eye, remove
- Compare rows:
  - symbol
  - percent change
  - optional remove action later; compare removal already exists in toolbar/dialog flow

### Indicator Panes

After price-pane legend is stable, replace each pane title/value row with a React row.

Target rows:

- `MACD 12 26 9`
  - `MACD -420.51`
  - `Signal -211.69`
  - `Histogram -208.83`
  - hover actions: gear, eye, delete
- `RSI 14`
  - `RSI 42.12`
  - hover actions: gear, eye, delete

### Control Style

- Compact inline icon buttons, visible on row hover/focus.
- Use existing dialog components.
- Use clear controls:
  - gear/settings
  - eye show/hide
  - x/delete
- Keep row height stable even when buttons appear.

## Required Data / Events / API Changes

For Phase 3B price-pane only:

- Add or extract a pure legend model that returns:
  - active value index
  - OHLC/status tokens
  - overlay legend rows
  - compare legend rows
  - indicator ids tied to each row
- Track active hover index in React, not only `hoverBar`.
  - Current `CrosshairState` already includes `barIndex`, `logicalIndex`, `paneId`, and `bar`.
  - `ChartCanvas` currently keeps only `event.crosshair?.bar`; Phase 3B needs the index or full crosshair state.
- Add a way to suppress price-pane canvas legend text while the HTML price legend is active.

For later indicator-pane replacement:

- Add a chart layout/legend snapshot event or public getter from `ChartEngine`, containing:
  - chart width
  - axis widths
  - price pane rect and legend rect
  - indicator pane rects and legend rects
  - collapsed state
  - visible pane order
- Use the same visible pane list as `ChartEngine` to avoid hidden-pane layout mismatch.
- Extract compare renderable value computation if compare rows become fully HTML-rendered.

Possible event shape:

```ts
type ChartLegendLayoutSnapshot = {
  chartWidth: number;
  axisWidth: number;
  leftAxisWidth: number;
  price: { top: number; height: number; legendHeight: number };
  panes: Array<{ id: string; top: number; height: number; legendHeight: number; collapsed: boolean }>;
};
```

## Smallest Safe Phase 3B Implementation Plan

1. Implement a React price-pane legend overlay only.
2. Use current `bars`, `overlays`, `compareOverlays`, `viewport`, `hover/crosshair index`, and `timeframe` to build a compact legend model.
3. Reuse existing dialogs/actions:
   - settings: `IndicatorSettingsDialog` / `CustomFormulaDialog`
   - hide/show: `updateIndicator({ ...indicator, visible })`
   - remove: `removeIndicator(indicator.id)`
4. Add a narrow engine flag or render option to suppress canvas price legend text when HTML price legend is enabled.
5. Keep existing `ChartPaneControlsOverlay` unchanged in Phase 3B.
6. Do not replace separate indicator pane legends until price-pane overlay alignment and pointer behavior are validated manually.

Recommended Phase 3B scope:

- price-pane main row
- price-pane overlay indicator rows
- hover buttons for overlay indicator rows
- no pane-title replacement yet
- no workspace schema changes

## Files Likely To Change In Phase 3B

Likely runtime files:

- `src/components/ChartCanvas.tsx`
- new `src/components/ChartLegendOverlay.tsx` or similar
- new `src/features/charts/chartLegendModel.ts` or similar
- `src/engine/ChartEngine.ts`
- `src/engine/types.ts`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabStateMutationService.ts` only if hover index/state is stored there

Potentially affected existing UI files:

- `src/components/IndicatorSettingsDialog.tsx`
- `src/components/CustomFormulaDialog.tsx`
- `src/components/ChartPaneControlsOverlay.tsx` in a later pane phase
- `src/indicators/catalog.ts` if compact label formatting is centralized

Docs likely to update after implementation:

- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- any phase-specific pane legend status document

## Mouse / Pointer Behavior

Recommended rules:

- HTML legend overlay root: `pointer-events: none`.
- Rows can use CSS hover for reveal without intercepting drag.
- Actual buttons: `pointer-events: auto`.
- Buttons must call `event.preventDefault()` and `event.stopPropagation()` on pointer down/click so chart pan/crosshair/drawing handlers do not also fire.
- Do not put a full-width interactive layer over the chart plot.
- Keep controls inside the reserved legend strip so plot interactions below remain unchanged.
- Keyboard focus should be limited to visible/actionable buttons.

## Overflow Strategy

For Phase 3B:

- Price main row should be single-line with internal truncation of the title first.
- Overlay rows should wrap only within the reserved legend area if there is space, otherwise clip/fade with `+N`.
- Prefer a deterministic visible-row cap before increasing the reserved strip height.
- Hidden indicators should remain in the model as hidden action targets only if the UX explicitly wants a hidden row. Otherwise hidden indicators should not reserve pane/legend space.

For later pane phase:

- Collapsed panes should show at most title + compact action cluster, not full values.
- Small panes should hide value tokens before hiding action buttons.
- Many indicators should use `+N more` rather than expanding pane legend height unexpectedly.
- Narrow charts should keep the first label and controls reachable.

## Risks And Regression Checklist

Risks:

- Duplicate canvas + HTML labels if canvas legend text is not suppressed.
- Layout mismatch between React-computed layout and engine render layout.
- Hidden pane indicator mismatch between `ChartCanvas` and `ChartEngine`.
- Pointer event conflicts with panning, crosshair, drawing selection, axis drag, pane resize, and context menus.
- Extra React renders on every mouse move if full crosshair state is stored globally without throttling or careful selectors.
- Settings dialog conflicts if toolbar and legend open the same indicator at the same time.
- Custom formula edit path can accidentally lose formula/name/placement if draft merge is not precise.
- Workspace persistence risk if visibility or placement changes alter pane order and stale pane state is not pruned.
- Small pane sizing risk if HTML rows exceed `INDICATOR_LEGEND_HEIGHT`.
- Compare legend values can drift if React duplicates private `ChartEngine.buildCompareRenderables()` logic.

Regression checklist for Phase 3B:

- Price-pane OHLC row updates on crosshair move and falls back to latest visible bar when crosshair is hidden.
- SMA/EMA/WMA overlay values match previous canvas values at the same crosshair bar.
- Compare percent values match previous canvas values.
- Gear opens the correct dialog for normal and custom indicators.
- Eye hides and re-shows the indicator without leaving stale legend rows.
- Delete removes the indicator and prunes pane state.
- Chart pan/zoom/crosshair/drawing tools still work under and below the legend strip.
- Right-click drawing context menu still works outside legend controls.
- Axis drag and pane resize still work.
- Small/narrow chart does not overflow text outside chart bounds.
- Hidden pane indicators do not create ghost pane controls or layout gaps.
- Existing toolbar study chips still work.
- Workspace save/restore preserves indicator visibility and layout.

## Explicit Confirmation

No runtime source code was modified for this Phase 3A audit. The only intended file created by this task is:

`PANE_LEGEND_STATUS_LINE_PHASE3A_TV_STYLE_LEGEND_AUDIT.md`

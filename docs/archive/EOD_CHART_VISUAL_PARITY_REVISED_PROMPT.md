# EOD Charting Platform
# TradingView-Style Visual Parity Pass
# Revised implementation prompt for the current Tauri-only codebase

Use this prompt instead of the older `EOD_CHART_VISUAL_PARITY_CODEX_PROMPT.md` draft in Downloads. That draft has useful goals, but several instructions are stale for the current repository state.

## Work only inside

`D:\TA Projects\EOD Charting Platform`

## Goal

Implement a focused visual parity pass that improves chart readability and indicator information density toward TradingView/lightweight-charts behavior, without broad UI redesign and without regressing the current Tauri-only architecture or the recent pane-aware drawing work.

## Before changing anything

Read:

1. `AGENTS.md`
2. `README.md`
3. `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
4. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
5. `FILE_INVENTORY.md`
6. `DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT.md`
7. `PANE_AWARE_DRAWING_SUPPORT_REPORT.md`
8. `src-tauri-shell/README.md`

Inspect first:

- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/Crosshair.ts`
- `src/engine/Indicators.ts`
- `src/engine/types.ts`
- `src/components/ChartHeader.tsx`

## Hard rules

- Treat `src-tauri-shell` as the only active backend path
- Treat `src/platform/*` as the only renderer/runtime seam
- Do not reintroduce Electron
- Do not broadly redesign the app shell
- Do not rewrite zoom/pan/drawing logic unless a small compatibility fix is required
- Preserve watchlists, Sheets, sidebar behavior, and pane-aware drawing behavior
- Preserve current Tauri-only runtime structure
- Create a backup first using the existing timestamped backup style
- Update the relevant `.md` files after the pass

## Important current-project realities

### 1. Base layer vs overlay layer matters

The current chart engine intentionally separates:

- `renderBase()` for heavier pane/candle/grid rendering
- `renderOverlay()` for per-frame hover/crosshair updates

Do not force the base canvas to redraw on every crosshair move just to show live indicator values. That would work against recent performance passes.

### 2. Dynamic axis width must be consistent everywhere

`axisWidth` is currently used by:

- layout calculation
- panning math
- crosshair rendering
- event tooltip placement
- last-price marker extent
- pane and x-axis alignment

If you make axis width dynamic, thread it through both base and overlay paths consistently. Do not update only `renderBase()` while leaving overlay logic on a stale width.

### 3. Indicator pane scales already exist

Indicator panes are already built with pane-local contexts and `ScaleY` values in `ChartEngine.ts`.

Any auto-fit refinement must preserve:

- the current multi-series pane scale behavior
- existing `pane.fixedRange` support where present

Do not bypass the current pane architecture with a separate ad hoc scale path unless that path also preserves fixed-range semantics.

### 4. Formatting is duplicated today

Price/value formatting currently exists in both:

- `src/engine/Renderer.ts`
- `src/engine/Crosshair.ts`

Any formatting refinement must keep them consistent or centralize them safely without introducing a bad dependency cycle.

### 5. The old pane-separator diagnosis is stale

The current app no longer uses the old loud full-width `INDICATOR PANE` banner. Pane identity is currently drawn through `drawPaneTitle(...)` in `Renderer.ts`.

If you refine pane headers/separators, refine the current title-rail treatment. Do not implement against a removed older UI element.

## Required fixes

### Fix 1. Pane indicator legends with live values

Target:

- indicator panes should show live values for the hovered bar, similar to TradingView
- when the crosshair is not visible, they should fall back to the latest bar

Implement safely:

- keep static pane title/identity rendering in the base layer if needed
- draw the live values in `renderOverlay()` so they can update per-frame without dirtying the full base canvas
- support single-series and multi-series pane indicators
- color the values to match each line/histogram series

Examples:

- `MACD (12, 26, 9)  18.73  67.14  48.40`
- `RSI (14)  42.35`
- `STOCH (14, 3)  61.22  57.08`

### Fix 2. Dynamic Y-axis width

Target:

- adaptive right-axis width based on the visible labels, similar to TradingView/lightweight-charts

Implement:

- measure visible label widths
- apply sane clamps
- use the resulting width consistently in:
  - `computeChartLayout(...)`
  - `renderBase()`
  - `renderOverlay()`
  - panning math
  - crosshair/value/date-label alignment
  - tooltip and last-value marker alignment

Avoid:

- jittery width changes from tiny per-frame differences
- base/overlay desynchronization

### Fix 3. Comma-separated readable formatting

Target:

- easier-to-read values on the axis, crosshair labels, and readouts

Implement:

- Indian-number-style separators where appropriate
- consistent decimal handling for:
  - price axis
  - crosshair Y label
  - OHLC header values if needed
  - pane legend values
  - right-axis indicator value tags

### Fix 4. Indicator pane scale auto-fit to visible data

Target:

- pane indicators should fill the pane more effectively based on visible data, with sensible padding

Implement:

- tighten visible-range pane scaling where appropriate
- preserve current multi-series support
- preserve current `fixedRange` semantics

This should work correctly for:

- RSI
- MACD
- STOCH
- ROC
- CCI
- WILLR
- MOM
- ATR
- ADX
- AROON
- MFI
- OBV
- CMF

### Fix 5. Right-axis indicator value tags

Target:

- pane indicators should show TradingView-style colored right-axis tags for the latest visible values

Implement:

- one tag per visible series in a pane
- use pane-local `ScaleY`
- keep tags aligned with the plotted line/histogram value
- use latest visible bar values in the base layer

### Fix 6. Overlay-indicator live values in the price pane

Target:

- overlay indicators such as SMA, EMA, VWAP, BOLL, and PSAR should show live values in the price pane header/readout area

Implement:

- hovered-bar values when crosshair is visible
- latest-bar values when crosshair is hidden
- compact, line-colored, readable output
- keep the price header/chart top area readable and not overloaded

### Fix 7. Pane title/separator refinement

Target:

- more subtle TradingView-like pane boundaries

Implement:

- refine the existing `drawPaneTitle(...)` treatment if necessary
- keep pane identification readable
- avoid loud blocks or visual clutter

### Optional lower-priority polish

Only if the core parity items above are stable:

- candle wick stroke consistency
- subtler major grid line opacity
- thinner indicator line widths where they look heavy
- date-axis dedup only if you confirm a real duplicate-label bug from current behavior

Do not treat these as the main pass if the higher-value parity items are still open.

## Safe implementation order

1. Align or centralize price/value formatting.
2. Implement dynamic axis width in a way that is consistent across layout/base/overlay.
3. Refine pane scale fitting while preserving fixed-range behavior.
4. Add overlay-layer live pane indicator values.
5. Add right-axis indicator value tags.
6. Add price-pane overlay indicator live values.
7. Refine pane header/separator treatment only as needed.
8. Validate and package.

## Validation

Run:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

After validation:

- launch `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- manually verify:
  1. NIFTY + MACD shows multi-series pane values that follow the crosshair
  2. RSI shows a single live pane value
  3. STOCH / ADX / AROON still behave correctly with multi-series values
  4. right-axis indicator tags align with plotted values
  5. price-scale width adapts between high-price and low-price instruments
  6. crosshair/value formatting uses separators consistently
  7. overlay indicators in the main price pane show live values without clutter

## Documentation updates required

Update:

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

Create:

- `VISUAL_PARITY_TRADINGVIEW_REPORT.md`

## Report must include

- what visual parity gaps existed before the pass
- how pane legend live values were implemented
- how axis width was made dynamic
- how formatting was aligned
- how indicator pane scaling was refined
- how right-axis indicator tags were implemented
- how overlay indicator live values were implemented
- whether pane title/separator styling changed
- files modified
- backup location
- validation performed
- output folder
- launcher path
- remaining limitations

# EOD Charting Platform
# Price Scale + Indicator Live Values
# Revised implementation prompt for the current Tauri-only codebase

Use this prompt instead of the older `CODEX_PRICE_SCALE_INDICATOR_VALUES.md` draft. The older draft assumes an older chart layout and contains stale constraints.

## Scope

Implement a focused chart-rendering pass for:

1. dynamic Y-axis width
2. consistent price/value label formatting
3. indicator-pane scale auto-fit to visible data
4. live indicator values in pane headers
5. indicator right-axis value tags
6. lighter pane title/separator treatment
7. overlay-indicator live values in the main price pane

This is not a broad UI redesign.

## Before changing anything

Read:

1. `AGENTS.md`
2. `README.md`
3. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
4. `FILE_INVENTORY.md`
5. `PANE_AWARE_DRAWING_SUPPORT_REPORT.md`
6. `DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT.md`
7. `src-tauri-shell/README.md`

## Important current-project constraints

- The app is now Tauri-only. Do not reintroduce Electron.
- Treat `src-tauri-shell` as the only active backend path.
- Treat `src/platform/*` as the only renderer/runtime seam.
- Preserve the current chart engine structure in `src/engine/*`.
- Preserve watchlists, Sheets, sidebar behavior, pane-aware drawing behavior, and the current Tauri-only runtime flow.
- Do not rewrite zoom/pan/drawing logic unless a very small compatibility fix is required for this rendering pass.

## Files to inspect first

- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/Crosshair.ts`
- `src/engine/Indicators.ts`
- `src/engine/types.ts`

## Current architecture notes you must respect

1. `axisWidth` is currently fixed in `ChartEngine.ts` and is consumed by:
   - layout calculation
   - panning math
   - crosshair rendering
   - event tooltip width
   - empty-state placement
   - pane/x-axis rendering

   A dynamic width fix must update both base-layer and overlay-layer use consistently. Do not measure width in one place and leave overlay/pointer/layout on stale fixed values.

2. Indicator panes already have pane-local contexts in `ChartEngine.ts`.
   - Each indicator pane already gets its own `ScaleY`.
   - Current pane scales are built through `buildScaleY(...)` with:
     - `pane.lines.map((line) => line.values)`
     - optional `pane.fixedRange`

   Any visible-range scale refinement must preserve this model. Do not blindly fork a separate scale path that drops `fixedRange`.

3. Price formatting currently exists in both:
   - `src/engine/Renderer.ts`
   - `src/engine/Crosshair.ts`

   If formatting changes, keep both paths consistent or centralize them safely.

4. The pane header/separator is no longer an old bright full-width `INDICATOR PANE` banner.
   - Current pane header rendering uses `drawPaneTitle(...)` in `Renderer.ts`.
   - If you refine separator/header treatment, refine the current title rail. Do not implement against a stale banner assumption.

## Required implementation goals

### 1. Dynamic Y-axis width

Target:
- TradingView/lightweight-charts style adaptive right-axis width

Implement:
- measure the widest visible tick label for the current pane scale
- compute a sane width with padding and clamp it to a reasonable range
- use that dynamic width consistently in:
  - chart layout
  - base rendering
  - overlay rendering
  - x-axis alignment
  - crosshair/date/tooltip alignment
  - panning math

Do not:
- leave `renderOverlay()` on a stale fixed axis width
- let grid/candles/x-axis use a different width than the crosshair/value labels

### 2. Consistent price/value formatting

Target:
- easier-to-read values, including separators/decimals where appropriate

Implement:
- one consistent formatting policy for:
  - Y-axis tick labels
  - crosshair value labels
  - indicator live values
  - last-price / indicator-value tags

Important:
- if you keep formatting functions in multiple files, they must stay behaviorally identical
- do not make price-pane values and indicator-pane values disagree visually without a deliberate rule

### 3. Indicator pane scale auto-fit to visible data

Target:
- pane-type indicators should fit visible data tightly with padding, similar to TradingView

Implement safely:
- refine indicator-pane scale calculation using the current pane-series model
- keep support for multi-series pane indicators
- preserve `pane.fixedRange` support where it already exists

Examples that must remain correct:
- MACD: macd + signal + histogram
- STOCH: k + d
- ADX: adx + plusDI + minusDI
- AROON: up + down
- single-series panes like RSI / ROC / ATR / OBV / CMF

Do not:
- apply pane-only scaling changes to overlay indicators that correctly share the price pane scale

### 4. Live indicator values in pane headers

Target:
- TradingView-like indicator pane headers with live values for the hovered bar
- when crosshair is not visible, show the last bar values

Implement:
- draw live pane values in the overlay layer, not the base layer
- keep values colored to match line colors
- support:
  - single-series pane indicators
  - multi-series pane indicators

Examples:
- `RSI (14)  42.35`
- `MACD (12, 26, 9)  18.73  67.14  48.40`

### 5. Indicator right-axis value tags

Target:
- colored right-axis tags for pane indicator series, similar to the price last-value marker pattern

Implement:
- one tag per visible series in a pane
- use the last visible bar value for base-layer tags
- ensure tag Y positions are derived from the pane’s own `ScaleY`
- keep tags within the pane bounds

### 6. Pane header / separator refinement

Target:
- lighter, TradingView-like pane separation

Implement:
- refine the current `drawPaneTitle(...)` treatment if needed
- keep pane identity readable
- avoid loud banners or thick separators

Do not:
- assume there is still a legacy blue `INDICATOR PANE` strip to remove

### 7. Overlay-indicator live values in the price pane

Target:
- overlay indicators on the price pane should show live values at the top of the price pane

Implement:
- overlay values should follow hovered bar when crosshair is visible
- otherwise show last bar values
- support:
  - moving averages
  - VWAP
  - PSAR
  - Bollinger bands

Keep:
- main symbol/price/OHLC area readable
- overlay readouts compact and color-matched

## Safe implementation order

1. Inspect current formatting, pane scaling, and axis-width usage paths.
2. Implement dynamic right-axis measurement and thread it through layout/base/overlay consistently.
3. Unify or safely align value formatting.
4. Refine indicator pane scale fitting while preserving current pane-series and `fixedRange` behavior.
5. Add overlay-layer live indicator pane titles.
6. Add right-axis indicator value tags.
7. Refine current pane title/separator styling only as needed.
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
  - price axis width changes appropriately while zooming/panning
  - indicator pane scales fit visible data
  - live pane values follow crosshair
  - indicator value tags appear on the right axis
  - overlay indicator values update in the main price pane

## Documentation updates required after implementation

Update:

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

Add:

- `PRICE_SCALE_INDICATOR_VALUES_REFINEMENT_REPORT.md`

## Report must include

- what in the current rendering was limiting price-scale and indicator readability before the pass
- how dynamic axis width was implemented
- how formatting was unified or aligned
- how indicator pane scale fitting was refined
- how live indicator values now work
- how right-axis indicator value tags were implemented
- whether pane header/separator treatment was refined
- files modified
- backup location
- validation performed
- output folder
- launcher path
- remaining limitations

## Hard rules

- Do not reintroduce Electron
- Do not touch `src-tauri-shell` unless absolutely required for packaging/runtime compatibility
- Do not change `src/platform/*` unless absolutely required for compatibility
- Do not modify watchlist logic, Sheets behavior, or sidebar behavior for this pass
- Do not broadly redesign the chart header or app shell
- Do not bypass the current pane-aware chart architecture with a parallel ad hoc implementation
- Preserve TypeScript correctness

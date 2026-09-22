# Canvas Engine

## Overview

The canvas engine is fully custom — no third-party charting library is used.
Each chart pane has its own `<canvas>` element. The engine reads from `ChartTabState`
and redraws on every relevant state change.

---

## Coordinate system

### X axis (time / bar index)
```
pixel_x = ((barIndex - viewport.startIndex) / visibleBars) * canvasWidth

visibleBars = viewport.endIndex - viewport.startIndex
barIndex    = fractional (sub-bar precision for smooth scroll)
```

### Y axis (price)
```
// Linear scale:
pixel_y = paddingTop + (1 - (price - priceMin) / priceRange) * usableHeight

// Log scale (logScale=true):
pixel_y = paddingTop + (1 - (log(price) - log(priceMin)) / log(priceMax/priceMin)) * usableHeight

priceMin/priceMax = derived from visible bars only (viewport slice), not all bars
Padding: top ~12px, bottom ~6px (leaves room for crosshair label on Y axis)
```

### Inverse (pixel → price / index)
```
barIndex = viewport.startIndex + (pixel_x / canvasWidth) * visibleBars
price    = priceMin + (1 - (pixel_y - paddingTop) / usableHeight) * priceRange
```

---

## Draw order (per frame, main price pane)

1. **Clear canvas** — `ctx.clearRect(0, 0, W, H)`
2. **Horizontal grid lines** — at Y-axis price tick positions
3. **Vertical grid lines** — at X-axis time tick positions (monthly, weekly etc)
4. **Compare overlay lines** — one line series per compareOverlay, normalized to % return
5. **Volume bars** — if `showVolume=true`, drawn at bottom 20% of pane
6. **Candlesticks / OHLC bars** — main price series
7. **Overlay indicators** — EMA, BB, VWAP, PSAR etc (drawn over candles)
8. **Chart drawings** — trend lines, rectangles, Fibonacci, text annotations
9. **Crosshair** — dashed H+V lines, snaps to nearest bar center

## Draw order (indicator panes)

Each pane indicator gets a separate `<canvas>`. Per pane:
1. **Clear**
2. **OB/OS zone fills** — e.g. 80/20 for STOCH, 70/30 for RSI
3. **Grid lines** — at fixed values (20, 50, 80 etc)
4. **Indicator line(s)** — e.g. %K + %D for STOCH, signal + histogram for MACD
5. **Crosshair vertical** — aligned with main pane crosshair X position

---

## ScaleManager (engine/ScaleManager.ts)

**Do not modify without understanding all callers.**

### `clampViewport(viewport, totalBars, minSpan, futureMarginMode)`
Ensures viewport stays within legal bounds:
- `startIndex >= 0`
- `endIndex <= totalBars + futureBars`
- `span >= minSpan` (default 5 bars)
- Preserves span when possible, shifts window if out of bounds

### `zoomViewport(viewport, pivotIndex, factor, totalBars, futureMarginMode)`
Zoom centered on `pivotIndex`:
- `factor > 1` = zoom in (fewer bars visible)
- `factor < 1` = zoom out (more bars visible)
- Clamps result through `clampViewport`

### `getAllowedFutureBars(span, futureMarginMode)`
Returns how many bars beyond the last data bar are allowed:
- `'normal'` → ~15% of span
- `'tight'`  → ~5% of span
- `'wide'`   → ~30% of span

---

## Crosshair (engine/Crosshair.ts)

- Tracks mouse position on main canvas via `mousemove`
- Snaps X to nearest bar center (integer bar index)
- Sets `hoverBar` in chartStore on each snap
- Paints dashed crosshair lines on both main and indicator panes
- Draws price label on Y axis and date label on X axis at crosshair position
- Exits canvas → clears `hoverBar`

---

## Y-axis label rendering

**Current known issue (P0):** Y-axis width is fixed (hardcoded `62px`).
Should be computed via `ctx.measureText(longestPriceLabel).width + padding`.

Labels are rendered as DOM elements positioned absolutely over the Y-axis `<div>`,
not drawn on canvas — this allows text rendering without canvas font metrics issues.

Live price tag: colored `<div>` at `toY(lastBar.close)`, background = up/down color.
Crosshair price tag: accent-colored `<div>` at `toY(crosshairPrice)`.

---

## Indicator pane headers (legend system)

**Current known issue (P0):** Pane headers do not show live values.
The header shows only `STOCH (14, 3)` — no `%K 95.19  %D 89.47`.

The legend system needs to:
- Receive the last computed indicator values for the hovered (or last) bar
- Pass them as props to the pane header component
- Update on crosshair move without triggering full canvas redraw

---

## Canvas sizing

```ts
// On mount and on resize (ResizeObserver):
canvas.width  = wrapper.clientWidth   // device pixels via devicePixelRatio if HiDPI
canvas.height = wrapper.clientHeight
ctx.scale(dpr, dpr)                   // if HiDPI scaling applied
```

Wrapper `<div>` is `flex: 1` in the layout — canvas fills available space.
Pane canvases are fixed-height `<div>` containers driven by `indicatorPaneHeights`.

---

## Adding a new indicator draw function

1. Create `src/engine/drawers/draw[Name].ts`
   ```ts
   export function draw[Name](
     ctx: CanvasRenderingContext2D,
     bars: OHLCBar[],
     viewport: Viewport,
     width: number,
     height: number,
     params: [Name]Params,
   ): void { ... }
   ```
2. Register in the main draw loop (placement determines which pane)
3. Add compute function in `src/indicators/[name].ts`
4. Add to catalog in `src/indicators/catalog.ts`
5. Add `kind` to `ChartIndicator` union in `src/engine/types.ts`
6. Add to `menuCommandRouter.ts` payload validation list

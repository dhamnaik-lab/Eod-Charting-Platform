# Future TV Chart UI Implementation Notes

Date: 2026-05-24

## Purpose

Capture the TradingView-inspired chart UI follow-ups so future implementation can start from repo truth without redoing the visual review.

## Reference Links

- TradingView Chart UI docs: https://www.tradingview.com/charting-library-docs/latest/ui_elements/Chart/
- TradingView Legend docs: https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend/
- TradingView Price Scale docs: https://www.tradingview.com/charting-library-docs/latest/ui_elements/Price-Scale/
- TradingView Panes and Scales Behavior docs: https://www.tradingview.com/charting-library-docs/latest/ui_elements/Panes-And-Scales-Behavior/

## Current Baseline

- Price legend is inside the price plot area.
- Price legend grid/crosshair continuity is preserved; the grid should continue behind the legend.
- Price candles and overlay lines get top breathing room through price-scale padding, not by shifting the grid down.
- Price-pane overlay indicator labels are vertical one-by-one rows below the price/OHLC row.
- Price-scale settings use a bottom-right scale gear.
- Scale label controls are split into separate toggles instead of one global value-label switch.
- Scale settings menu height is bounded and scrolls internally when opened from the bottom-right scale gear.
- Bottom chart scrollbar visual polish is implemented with a scoped native-scrollbar class; behavior sync is unchanged.

## TradingView Behavior Notes

- Legend belongs at the chart top-left; do not move it to a separate outside strip.
- Scale settings belong at or below the price scale, not as a floating button inside the plot.
- Legend/status-line visibility and scale-label visibility are separate behavior areas.
- Price-scale labels should be separately controllable for symbol labels, last price, indicator values, indicator names, compare labels, and countdown-style items.
- Grid and crosshair should not stop at legend overlays. Legend overlays sit above the plot; grid remains a full-pane drawing concern.

## Future Implementation Items

### 1. Indicator Pane Internal Padding

Status:
- Strengthened on 2026-05-24 in `src/engine/ChartEngine.ts`.

Issue:
- Pane indicators such as Stoch can visually touch or crowd the indicator pane top/bottom borders.

Implementation direction:
- Treat this as an indicator-pane Y-scale padding issue, not a pane-height issue.
- Keep indicator pane height unchanged.
- Do not add or restore an outside indicator legend/header strip.
- Preserve current in-plot indicator pane legend behavior and existing pane controls.
- Current implementation uses `0.12 / 0.12` padding and lets built-in fixed ranges such as Stoch/RSI `0-100` ranges receive that padding.
- Manual pane scale overrides remain exact/locked.

### 2. Scrollbar Visual Polish

Status:
- Implemented on 2026-05-24 in `src/components/ChartCanvas.tsx` and `src/styles/global.css`.

Issue:
- Horizontal scrollbar behavior was functionally fixed, but the visible scrollbar area was still eye-catching.

Implementation direction:
- Completed first pass kept the current drag/viewport synchronization logic unchanged.
- Completed first pass focused on visual styling only: reduced strip weight, improved thumb/track styling, and preserved current sheet-switch behavior.
- Re-check manually that changing sheets does not auto-scroll left unexpectedly after a local build.
- Relevant audit/fix doc: `CHART_SCROLLBAR_VIEWPORT_SYNC_REGRESSION_AUDIT.md`.

### 3. Scale Label Menu Refinement

Issue:
- Current scale label controls are functional, but the menu can be refined over time to more closely match TradingView grouping.

Implementation direction:
- Keep separate label settings as the source of truth.
- Avoid collapsing all label behavior back into one global `showValueLabels` setting.
- Future candidates:
  - symbol name label
  - symbol last price label
  - previous day close label
  - high/low price labels
  - indicator name labels
  - indicator value labels
  - countdown to bar close
  - no overlapping labels

### 4. Full-Zoom Scrollbar / Navigator Parity

Status:
- Pending follow-up after reviewing `images/20260524_182352.mp4`.

Reference behavior:
- AmiBroker keeps the horizontal navigator/scrollbar area visible while zooming in and zooming out.
- At broad/full-history zoom, the visible range changes but the bottom navigator does not disappear.

Current EOD symptom:
- When the chart is zoomed out to the complete available range, the chart can visually shift at the limit and the native horizontal scrollbar thumb disappears.

Likely cause:
- `src/components/ChartCanvas.tsx` derives `maxScrollStart` from available bars, future bars, and `visibleSpan`.
- At full range, `maxScrollStart` becomes `0`.
- `scrollbarContentWidth` then resolves to the same width as the scrollbar viewport, so the native browser scrollbar has no overflow and Windows stops showing a draggable thumb.
- Zoom clamping is handled in `src/engine/ScaleManager.ts`; repeated zoom-out at the max span should be treated as a no-op to avoid visual movement.

Implementation direction:
- Keep a visible bottom navigator/track even when full history fits in the viewport.
- Prefer a controlled/custom scrollbar thumb state for the full-range case instead of depending only on native overflow visibility.
- Add a no-op guard for zoom-out when the viewport is already at the maximum allowed span.
- Preserve the 2026-05-24 sheet/tab viewport sync fix; changing sheets must not auto-scroll left.
- Preserve current drag behavior when there is real overflow.

Manual validation:
- Zoom out repeatedly until full history is visible; the bottom navigator remains visible.
- Continue zooming out at the limit; chart does not jump or drift.
- Zoom back in; scrollbar thumb returns to normal draggable behavior.
- Drag the scrollbar left/right; chart and x-axis move together.
- Switch sheets/tabs after zooming; viewport does not reset unexpectedly.

## Constraints

- Active app baseline is the Tauri renderer path, not legacy `src-tauri`.
- Preserve local-first behavior.
- Do not reintroduce Electron runtime or packaging.
- Create a project backup before implementation.
- Keep implementation slices narrow and visual-regression focused.

# Chart time axis and tool-status overlay - 29 October 2026

## Request and causes

The user requested removal of the lower-left `Crosshair active`/drawing-tool
instruction overlay and a zoom-adaptive date axis without overlapping year labels.

- The shared `ChartCanvas` status badge covered the bottom-left of every chart
  whenever a tool other than the cursor was active, including the date-axis area.
- `formatXAxisLabel` suppressed non-year labels above fixed 480/1,200-bar cutoffs
  even if pixel-based boundary selection found space for month labels.
- `niceXTicks` pre-collected all boundary ticks, bypassing later spacing checks.
  `drawXAxis` clamped each label independently at the edges without checking
  collisions, piling compressed starting years on top of one another.

## Changes

- `src/components/ChartCanvas.tsx`: remove the shared tool-status JSX, badge
  styles and its now-unused instruction helper for all tools. Drawing labels used
  by properties and the existing dock tooltips remain available. Drawing actions,
  shortcuts and accepted Fibonacci/Gann geometry are untouched.
- `src/engine/ScaleManager.ts`: remove bar-count-only month suppression. Existing
  pixel-based boundary selection governs month/quarter/year density. Add shared
  label placement that filters empty/off-screen labels, clamps text bounds, and
  resolves collisions. Real year transitions outrank initial context years,
  followed by month/quarter boundaries and day labels.
- `src/engine/Renderer.ts`: apply the same layout using actual canvas font metrics
  before drawing. Tick coordinates and underlying bar/date geometry are unchanged.

January transitions can show the year instead of `Jan`; readable month names
appear between year markers when space permits. Close zoom shows day/month detail;
wide/narrow views omit labels that cannot fit rather than overlapping them.

References checked:
- [AmiBroker charting guide](https://amibroker.com/guide/h_charting.html): date axis,
  scroll bar and chart-pane arrangement.
- [TradingView tick formatting](https://tradingview.github.io/lightweight-charts/docs/api/type-aliases/TickMarkFormatter):
  calendar-specific year/month/day labels and compact formatting.
- [TradingView time scale](https://tradingview.github.io/lightweight-charts/docs/time-scale):
  visible range depends on plot width and bar spacing.

## Verification

Backup: `backups/pre_opencode_changes_20261029_130221_chart_axis_labels_tool_hint`.

- PASS: focused tests, 20/20 across `TimeAxisLayout`, existing `ScaleManager`,
  `ChartLayerPartition`, dock tooltips and drawing-tool groups.
- Covers the old 480-bar cutoff, close zoom, crowded starting years, 220/540/1,740px
  panes, actual measured/clamped text bounds and year-transition priority.
- PASS: browser-canvas inspection using the actual ScaleManager/Renderer modules
  on illustrative data: 225 and 616 daily bars, a 7,583-bar compressed-history
  scenario, narrow pane and close zoom. The first inspection identified the
  initial-year-context priority issue; the corrected version was rechecked.
- Evidence: `tmp/chart-axis-visual-20261029_1306/axis-check.jpg`, with the HTML,
  TypeScript fixture and bundled preview retained alongside it. This is isolated
  canvas evidence, not native application acceptance. The temporary browser tab
  was closed and the localhost preview server was stopped.
- PASS: `scripts/validate-change.ps1 -Profile renderer` for the three source
  paths and the new axis test: renderer typecheck and scoped whitespace.

No database operations, downloads, backend edits, agent-run release builds, commit
or push occurred. The user subsequently rebuilt/restarted and supplied native
screenshots confirming the reported label-density/overlap fixes and absence of
the persistent tool instructions in the shown cursor/crosshair views. Follow-up
density/monthly changes and their acceptance are recorded in
[the native closeout](2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).
Every drawing tool and every pane-size/zoom combination were not manually retested.

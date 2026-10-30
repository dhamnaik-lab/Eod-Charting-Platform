# Monthly axis density and May label review - 29 October 2026

## Scope and findings

The user authorized a focused follow-up on two observations from their 13 native
screenshots. Earlier tool-status removal, collision filtering and daily/weekly
quarter/half-year density are visibly present in those screenshots.

### Image 6: April to June on WIPRO daily

Read the current `EOD DATABASE/eod_data/NSE/WIPRO.eod` without writing it.
It contains 7,574 daily records. Adjacent stored dates at the transition are
`2025-04-30` and `2025-06-02`; there are zero stored May 2025 bars in this file.
Therefore the daily axis has no May bar boundary to label. This case is not a
suppressed label. No missing month label, candle or empty calendar slot was
manufactured, and no history repair/download was attempted.

This finding concerns this current file and these dates. It does not establish
why that month is absent, when the sequence arose, or whether another source
contains it. Those questions are outside this axis correction.

### Image 11: monthly chart with 76 visible slots

`resolveBoundaryMode` had a separate monthly-chart rule: use quarters only at
36 or fewer visible candles with at least 90px quarter spacing, otherwise years.
That rule discarded quarterly context on the screenshot's wide 76-slot view.

## Changes

- `src/engine/ScaleManager.ts`: monthly charts now select month, quarter,
  half-year or year boundaries by available CSS-pixel spacing, using the same
  48px label threshold as the existing daily calendar modes. Removed the
  36-candle cutoff. Monthly labels always use month names or year transitions,
  including the first visible label at close zoom.
- `src/engine/__tests__/TimeAxisLayout.test.ts`: cover 60/76-slot panned monthly
  views with future slots, close monthly zoom, half-years at 120 slots, years at
  189 slots/narrow panes, text collisions and a daily calendar with no May bars.
- `src/engine/__tests__/ScaleManager.test.ts`: replace the old year-only
  60-month expectation with the newly intended quarterly labels when they fit.
- `HANDOFF.md` and this report record the findings and native follow-up.

No backend, data, aggregation, price adjustment, coordinates or drawing geometry
changed. Pre-edit backup:
`backups/pre_opencode_changes_20261029_155505_monthly_axis_density`.

## Verification

- Before correction: 16 tests passed and 3 new monthly-density cases failed,
  reproducing the absent 60/76-slot quarters and close-zoom month detail.
- PASS: 29 focused tests via `npx vitest run --exclude 'tmp/**'` for
  `TimeAxisLayout.test.ts`, `ScaleManager.test.ts`, `ChartLayerPartition.test.ts`.
- PASS: renderer validation profile: TypeScript and scoped whitespace checks.
- PASS: read-only WIPRO date replay through the actual `aggregateBars(..., 'M')`
  implementation produced 381 monthly bars. Before/after tick replay covers
  76/24/120/189 slots, a narrow pane and the unchanged daily 376-slot view.
- PASS: current WIPRO file SHA-256 unchanged across the replay.
- PASS: browser-canvas review with the actual renderer/font metrics using these
  tick positions. Month/quarter/half-year/year cases remain separated and
  non-overlapping. Temporary preview tab/server were closed afterward.

Evidence: `tmp/chart-monthly-axis-20261029/` contains pre/post axis bundles,
the actual aggregation bundle, calendar/hash proof, test JSON, preview sources
and `monthly-axis.jpg`. The actual date replay is additional evidence; durable
unit tests use independent fixtures and do not require a production database.

Native follow-up: the user's later four screenshots confirm WIPRO monthly
half-year and quarterly labels, NIFTY monthly quarterly labels, readable yearly
spacing and month/year or year crosshair formats. Tool-status text remains absent.
The reported axis issues are closed for those native views. Other pane sizes,
all drawing tools and every possible zoom level were not exhaustively exercised.
See [the native closeout and preserved screenshots](2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).

No agent-run EXE/package build, data modification, download, commit or push occurred.

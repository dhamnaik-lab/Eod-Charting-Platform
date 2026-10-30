# Date-axis density transition follow-up - 29 October 2026

## Observed issue and reproduction

User screenshots confirmed that persistent tool instructions had disappeared and
starting year labels no longer overlapped. One remaining defect was visible:
quarterly month labels at 1,104 slots became years only at 1,237 slots, with an
isolated `Nov` at the right edge.

The production WIPRO date sequence was read without modification. Running the
actual pre-edit `niceXTicks` at a 1,395 CSS-pixel plot width and eight future slots
reproduced both label patterns. The earlier 1,744px estimate used physical
screenshot pixels. `ChartEngine.resize` uses CSS coordinates and a device-pixel
transform; 1,395 CSS pixels corresponds approximately to 1,744 physical pixels
at 125% scaling. The native window's exact scale was not independently measured.

The causes were in `src/engine/ScaleManager.ts`:

- Month boundaries required 48px average spacing, but quarters required 72px.
  WIPRO quarter spacing at 1,237 slots / 1,395px was below 72px despite enough
  room for three-letter month labels, so the selector jumped directly to years.
- There was no intermediate half-year cadence.
- A separate sampled/future-tick path could add unrelated month names to an
  otherwise yearly axis, producing the isolated `Nov`.

## AmiBroker reference

Inspected the installed `C:\Program Files\AmiBroker\Broker.exe` file version
6.20.1.6201, `ReleaseNotes.html` and `Tips.txt`. The installed release notes for
5.52.0 describe rewriting the X-axis algorithm to avoid overcrowded labels.
The [official charting guide](https://amibroker.com/guide/h_charting.html),
[Preferences reference](https://amibroker.com/guide/w_preferences.html), and
[Parameters / Axes & Grid reference](https://amibroker.com/guide/w_param.html)
describe the date axis, axis font, and per-pane axis visibility controls.

These are behavior and configuration references, not AmiBroker source code or
proof of its internal tick-selection algorithm. Native AmiBroker zoom was not
operated. Its installation, settings and database were not modified. The local
compiled help was found, but attempts to extract it with Windows `hh.exe`
produced no extracted files; the installed HTML notes and official help were
used instead.

## Focused correction

- Use the same 48px spacing threshold for months and quarters on daily charts;
  retain the weekly month threshold and align its quarterly threshold too.
- Add January/July half-year boundaries before falling back to years for daily
  and weekly charts. Existing yearly collision filtering still applies.
- On coarse calendar views, accept only the selected calendar boundaries.
  Keep sampled/future label logic for fine weekly/step modes.
- Preserve data dates, bar coordinates, drawing geometry, price calculations,
  history loading and Corporate Actions behavior.

Changed: `src/engine/ScaleManager.ts`, focused tests in
`src/engine/__tests__/TimeAxisLayout.test.ts`, this report and `HANDOFF.md`.
Pre-edit backup:
`backups/pre_opencode_changes_20261029_134402_chart_axis_density_transition`.

## Verification and limits

- Regression proof before the fix: 10 passed, 3 expected failures for the
  1,237/1,400-slot transition and absent half-year cadence.
- PASS: `npx vitest run --exclude 'tmp/**'
  src/engine/__tests__/TimeAxisLayout.test.ts
  src/engine/__tests__/ScaleManager.test.ts
  src/engine/__tests__/ChartLayerPartition.test.ts` — 22/22.
  Includes panned/fractional starts, future slots, close zoom, crowded years,
  narrow panes and measured label collision checks.
- One initial invocation without the project's normal `tmp/**` exclusion also
  discovered historical scratch copies and failed on two missing imports there.
  The corrected scoped invocation above passed; no scratch source was changed.
- PASS: renderer validation profile for the two source/test files: TypeScript
  typecheck and scoped whitespace.
- PASS: before/after tick replay with the actual WIPRO calendar at 986, 1,104,
  1,237, 1,400, 1,800 and 2,441 slots across four CSS widths. At 1,395px the
  1,237-slot view now retains quarterly months; 1,800/2,441 use July between years.
- PASS: browser-canvas inspection with the real axis renderer/font metrics and
  production-calendar tick positions: before/after transition, half-year, full
  history and narrow-pane rows. This is isolated renderer evidence, not native
  desktop acceptance. Temporary tab/server were closed after inspection.
- PASS: WIPRO `.eod` SHA-256 unchanged across the read-only replay.

Evidence directory: `tmp/chart-axis-amibroker-20261029/` contains before/after
bundles, tick replay JSONL, regression reports, preview sources/data, hash proof
and `axis-transition.jpg`.

Native follow-up: the user's subsequent screenshots show quarterly daily labels,
half-year weekly labels and readable full-history year labels without the earlier
overlap. Further monthly-axis follow-up was implemented and checked separately;
the final scoped native closeout is recorded in
[the acceptance record](2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).
No agent-run release/portable build, download, database repair, commit or push occurred.

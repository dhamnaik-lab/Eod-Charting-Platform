# Scanner — deeper audit and implementation review — 8 November 2026

Scope: the renderer Scanner subsystem only — [`scannerRunner`](../../src/plugins/scanner/scannerRunner.ts),
the four definition packs, chart-pattern evaluation/worker/geometry, the Scanner window
([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx)), and the chart-overlay/pattern-map
integration. Corporate Actions, Bhavcopy, identity and Rust storage code were read only where the
Scanner depends on them. No source file was modified by this review.

Method: source reading of the modules above, incremental `git diff` inspection of the uncommitted
scanner work, focused Vitest runs, the project renderer validation profile, and one throwaway
enumeration test (removed afterwards) to count live scanner definitions. Statement below are
code-grounded unless explicitly marked **inference**.

---

## 1. What the Scanner is, as built

| Layer | Location | Note |
|---|---|---|
| Definitions (74) | `dailyMarketScanners` (5), `coreOhlcvScanners` (10), `chartPatternScanners` (54), `signalScanners` (5) | `listCoreScannerDefinitions()` appends plugin-host scanners ([`scannerPlugin.ts`](../../src/plugins/scanner/scannerPlugin.ts)) |
| Batch runner | [`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) `runCoreEodScannerBatch` | per-symbol `getEodData` → core + signal + dynamic + chart-pattern → alerts |
| Chart-pattern history | [`chartPatternEvaluation.ts`](../../src/plugins/scanner/chartPatternEvaluation.ts) + [`.worker.ts`](../../src/plugins/scanner/chartPatternEvaluation.worker.ts) + [`chartPatternWorkerClient.ts`](../../src/plugins/scanner/chartPatternWorkerClient.ts) | one dedicated worker per batch, one symbol at a time |
| Overlay alignment | [`scannerChartPriceBasis.ts`](../../src/plugins/scanner/scannerChartPriceBasis.ts) | re-derives geometry on the chart's own series instead of scaling |
| Pattern map | [`scannerPatternMap.ts`](../../src/plugins/scanner/scannerPatternMap.ts) | transient markers clustered per instrument/date |
| Workspace persistence | [`scannerWorkspace.ts`](../../src/plugins/scanner/scannerWorkspace.ts) → `readAppSettings`/`writeAppSettings` | `scannerWorkspace` in the app profile |
| UI | [`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) (2,632 lines) | Run / Results / Alerts / Library / Market Movers sections |

Measured live inventory (throwaway test, deleted after the run): **74 definitions, 74 unique ids,
54 chart-pattern handlers for 54 chart-pattern definitions (no orphans either way)**.

---

## 2. Findings

Severity is mine. "High" means a user-visible behavioural gap in the current build; "Medium" means
misleading or fragile semantics; "Low" is maintainability.

### High

**S-01 — "Top Gainers / Top Losers" are not rankings.**
`top_gainers` matches *any* symbol closing positive, `top_losers` any symbol closing negative
([`dailyMarketScanners.ts`](../../src/plugins/scanner/dailyMarketScanners.ts) lines 163–199). There
is no cross-sectional ordering, no top-N cut, and the final sort is
`date desc → scannerName asc` ([`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) line
174), so the rows come out in symbol order. The run-screen preset buttons ("🚀 Top Gainers",
"🔻 Top Losers") and the definition names imply a ranking that the engine does not produce.

**S-02 — The Symbol List universe is an alphabetical prefix.**
`resolveScannerTargets` requests `listSymbols({ limit: maxSymbols })`
([`scannerRunConfig.ts`](../../src/plugins/scanner/scannerRunConfig.ts) lines 75–83) and the backend
orders `ORDER BY i.symbol ASC ... LIMIT ?`
([`symbol_search.rs`](../../src-tauri-shell/src/database/symbol_search.rs) lines 129–181). With the
profile default `maxSymbols = 500` ([`appSettingsService.ts`](../../src/features/app/appSettingsService.ts)
line 70) a "market-wide" scan is really "the first N symbols alphabetically" — heavily biased toward
numeric and `A*` symbols. Combined with S-01, a Symbol List "Top Gainers" run is not interpretable
as market breadth. The NSE series filter correctly remains the broad-equity set
(`EQ/BE/BZ/SM/ST/SZ`), and BSE uses `all`. Watchlist universes are uncapped and correct
(Phase 16 contract).

**S-03 — Batch scans always read unadjusted prices.**
`runCoreEodScannerBatch` calls `getEodData({ symbol, exchange, to })` with no adjustment flags
([`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) lines 55–59), and the backend
defaults `adjusted` to `false` ([`eod_data.rs`](../../src-tauri-shell/src/database/eod_data.rs) line
94). Only the *chart-side* single-instrument scan uses the chart's basis
([`Toolbar.tsx`](../../src/components/Toolbar.tsx) lines 122–142). Consequence: on a raw series, an
approved split/bonus leaves a price cliff that produces systematic false `gap`, `breakdown`,
`V-bottom` and `measured-move` detections across the event date, while the same symbol displays
adjusted bars on the chart. The overlay path then re-derives geometry on the chart basis
([`scannerChartPriceBasis.ts`](../../src/plugins/scanner/scannerChartPriceBasis.ts) lines 42–73) and
can legitimately return "cannot be drawn on the loaded price series" for a row that the Results table
just showed. This is the single largest analytical limitation of the current Scanner.

**S-04 — Custom signal rules silently degrade to close-price comparisons.**
The scanner always builds the same four preset indicators (`ema_20`, `sma_50`, `sma_200`, `rsi_14` —
[`signalScanners.ts`](../../src/plugins/scanner/signalScanners.ts) lines 79–86, 196–197). When a
rule references an indicator id outside that bundle, `extractTargetSeries` falls back to the bar's
close instead of failing ([`Signals.ts`](../../src/engine/Signals.ts) lines 112–119). A user rule such
as "EMA 9 crosses above static 100" therefore evaluates as "close crosses above 100" with **no error,
no warning and no diagnostic** — and the chart can show a different signal because it builds the
bundle from the chart's real overlays ([`ChartEngine.ts`](../../src/engine/ChartEngine.ts) line 1348).

**S-05 — Closing the Scanner window abandons a running scan.**
`ScannerWindow` is mounted only while `scannerWindowOpen` is true
([`RootApp.tsx`](../../src/RootApp.tsx) lines 412–416). The `handleRun` loop lives in the component
closure, so on close the promise keeps running, `cancelRequestedRef` can no longer be set by any UI,
results are discarded on unmount, and the chart-pattern worker is only terminated when the loop
finishes on its own ([`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) lines 45, 113–148,
169–171). An all-history multi-symbol run can therefore keep a CPU core busy for a long time with no
visible owner. There is no unmount cleanup and no "closing will cancel" confirmation.

**S-06 — Alert scans never pass the user's signal rules.**
`handleRunAlertScan` builds its request without `signalRules`
([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) lines 788–796), while the normal run
passes them (line 681). `evaluateSignalScannerDefinitions` therefore receives
`customSignalRules === undefined`, so an alert created from a custom-rule scanner result
(`signal_active_custom_rules`, the id `createScannerMatchAlertRule` stores) can never fire.

**S-07 — Duplicate React row keys for multiple custom signal rules.**
Every custom rule emits `scannerId: 'signal_active_custom_rules'`
([`signalScanners.ts`](../../src/plugins/scanner/signalScanners.ts) lines 169–178), while the React
key is built from exchange/symbol/scannerId/first-match-date/pattern-start
([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) lines 1937–1946). Two custom rules
triggering on the same symbol and date produce identical keys; the rule id exists in
`values.rule_id` but is not part of the key.

### Medium

**S-08 — Priority is effectively a constant.**
The definition factories hardcode `priority: 1` and ignore their `reliability` argument
([`chartPatternScanners.ts`](../../src/plugins/scanner/chartPatternScanners.ts) lines 2277–2387).
Measured distribution across all 74 scanners: **73 × High, 1 × Medium, 0 × Low**. The Phase 18
Priority filter and High-to-Low / Low-to-High sort therefore have no observable effect, and the
`H`/`M`/`L` badges imply a curation that the data does not contain.

**S-09 — "Score" and "Min Score" do not mean signal strength.**
53 of the 54 chart-pattern detectors emit a fixed literal confidence (the only data-dependent case is
`chart_runaway_gap`: 75 or 68), and all core/daily scanners emit no `score` at all
([`coreOhlcvScanners.ts`](../../src/plugins/scanner/coreOhlcvScanners.ts) lines 328–352). `Min Score`
compares `result.score ?? 0`, so any value above 0 removes every core and daily-market row while
keeping the fixed chart-pattern constants ([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx)
lines 2004–2035). It behaves as a scanner-class filter, not a strength filter.

**S-10 — Historical grouping merges distinct simultaneous episodes.**
`historicalMatchKey` is `scannerId:direction`
([`chartPatternEvaluation.ts`](../../src/plugins/scanner/chartPatternEvaluation.ts) lines 132–134), and
`matchCount` counts the consecutive endpoints of one matching stretch (lines 96–116). Two genuinely
different instances of the same pattern (e.g. two double bottoms at different supports) on the same
symbol collapse into one row, and "N matches" means "N consecutive endpoints", not "N episodes".

**S-11 — The last historical endpoint is evaluated twice with different windows.**
`latestResults` (used for `scanner_match` alerts) is computed on the full bar array (lines 63–77),
while `historicalResults` from the final loop iteration use `bars.slice(max(0, len-260), len)`
(`MAX_PATTERN_WINDOW_BARS`, lines 11, 86–93). A `scanner_match` alert can therefore fire for a
detection that never appears in the displayed historical set, and vice versa for input longer than
260 bars.

**S-12 — Scanner-window overlays ignore the chart timeframe.**
`resolveScannerOverlayPriceBasis` rejects a mismatched timeframe only when the overlay declares one
([`scannerChartPriceBasis.ts`](../../src/plugins/scanner/scannerChartPriceBasis.ts) lines 49, 57), and
the Scanner-window candidate never sets `timeframe`
([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) lines 851–865), whereas the Toolbar
overlay does ([`Toolbar.tsx`](../../src/components/Toolbar.tsx) lines 176–181). Showing a daily
Scanner row on a weekly chart re-evaluates the detector on daily bars and then draws the geometry onto
weekly bar indexes without any validation.

**S-13 — No OHLCV sanity validation on the core and chart-pattern paths.**
The batch only checks `bars.length < 2` ([`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts)
lines 61–64). `gap_up` divides by `yesterday.high` unguarded
([`coreOhlcvScanners.ts`](../../src/plugins/scanner/coreOhlcvScanners.ts) lines 231–236), so a zero or
missing high yields `Infinity` in `values.gap_pct`; NaN inputs propagate into geometry. The
daily-market pack *does* validate finiteness and positivity
([`dailyMarketScanners.ts`](../../src/plugins/scanner/dailyMarketScanners.ts) lines 26–45) — the
validation is inconsistent across packs.

**S-14 — Workspace defaults fall outside the UI's own ranges.**
`normalizeScannerWorkspaceConfig` accepts `lookbackBars` down to **2**
([`scannerWorkspace.ts`](../../src/plugins/scanner/scannerWorkspace.ts) lines 187–192) while the input
enforces `MIN_LOOKBACK_BARS = 20` and the map clamps to `Math.max(2, …)`
([`scannerRunConfig.ts`](../../src/plugins/scanner/scannerRunConfig.ts) lines 5–7,
[`types.ts`](../../src/plugins/scanner/types.ts) lines 113–136). The profile default `maxSymbols` is
**500** while the component's own default is **50**. Persisted or hand-edited values can therefore
describe configurations the UI cannot express.

**S-15 — Settings writes are read-modify-write.**
`persistWorkspaceProfile` reads the whole profile, then writes the whole profile back
([`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) lines 282–296); the alert-trigger write
does the same (lines 700–718). `writeAppSettings` replaces every field
([`appSettingsService.ts`](../../src/features/app/appSettingsService.ts) lines 120–141). The
`workspaceSaveGenerationRef` guard only orders writes **inside** the Scanner, so a debounced
workspace autosave that started before a Settings-dialog save can overwrite it. Low frequency, real
lost-update path.

**S-16 — "52-Week" labels a window that can be 20 bars.**
`high_52w`/`low_52w` accept `period = Math.min(252, bars.length)` from 20 bars up and still report
"`${period}-bar (52-week) high`" in the reason text
([`dailyMarketScanners.ts`](../../src/plugins/scanner/dailyMarketScanners.ts) lines 221–245). A newly
listed symbol produces a confidently-worded 52-week claim from five weeks of data.

### Low / maintainability

**S-17 — Dead and unreferenced code.**
`runCustomFormulaScannerBatch` ([`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) lines
201–281) has no caller and no test. `findSwingPivots`, `findMultiScalePivots`, `computeAtrAt` and
`SwingPivot` ([`chartPatternPrimitives.ts`](../../src/plugins/scanner/chartPatternPrimitives.ts) lines
89–204) are exercised only by the primitives test — no detector uses the multi-scale pivot engine.
`chartPatternScanners.ts` imports `findSwingPivots` and `hasPatternVolumeProfile` without using them
(lines 6, 10).

**S-18 — Signal-scanner tests assert almost nothing.**
`expect(Array.isArray(results)).toBe(true)` is the whole assertion for golden cross, and the custom-rule
test asserts only the same
([`signalScanners.test.ts`](../../src/plugins/scanner/__tests__/signalScanners.test.ts) lines 37–39,
75–77). A regression that always returned `[]` would pass.

**S-19 — The Scanner window itself has no unit tests.**
`ScannerWindow.tsx` (2,632 lines, ~40 hooks) is untested directly. Scanner UI coverage is achieved by
compiling private functions out of `Toolbar.tsx`/`ChartCanvas.tsx` source text and evaluating them in
a `vm` context ([`scannerDrawingTestHarness.ts`](../../src/components/__tests__/scannerDrawingTestHarness.ts)).
It fails closed when a symbol is renamed, but it is refactor-sensitive and does not exercise the
window's run/filter/persist/alert flow. The chart-pattern detector pack *is* well covered: all 54 ids
appear in [`chartPatternScanners.test.ts`](../../src/plugins/scanner/__tests__/chartPatternScanners.test.ts)
with synthetic OHLC fixtures.

**S-20 — Duplicated logic across the window and helpers.**
The exchange/universe/lookback/max-symbols control block is duplicated between Run and Alerts; the
priority filter/sort block between Run and Library; level extraction exists three times
(`ScannerWindow.getScannerChartLevels`, `scannerPatternMap.getScannerPatternMapLevels`,
`scannerChartPriceBasis` inline); family→group-label mapping is duplicated between
`scannerGroupLabel` and the definition `categoryName` strings. Each duplicate is a divergence risk.

**S-21 — Stale definition text.**
The factory `limitations` strings still say "does not draw the pattern on chart" although every
detector now ships `chartPattern.geometry`.

### Verified as intentional, not defects

- **Non-repaint:** each historical endpoint is evaluated on an independent prefix
  (`bars.slice(windowStart, endIndex)`), so a confirmed episode cannot be rewritten by later bars. The
  only window inconsistency is S-11.
- **Cancel semantics:** results from completed symbols survive, the interrupted symbol's partial
  history is deliberately not promoted, and an in-flight `getEodData` is not abortable — all match the
  Phase 16 record in `outputs/`.
- **Price-basis handling:** re-running the detector on the chart's own series instead of scaling
  detected prices is the correct trade-off, and the label-only early return for core rows is right.
- **Read-only:** no database mutation anywhere in the scanner path; the `scan_runs` table in
  [`bootstrap.rs`](../../src-tauri-shell/src/database/bootstrap.rs) lines 271–300 belongs to
  Corporate Actions, not the EOD scanner. Scan results are not persisted or exportable — the window
  is explicitly documented as not restoring results, alerts or To Date.
- **Plugin isolation:** dynamic plugin scanner errors are swallowed (empty `catch`,
  [`scannerRunner.ts`](../../src/plugins/scanner/scannerRunner.ts) lines 108–110). Defensible for
  untrusted plugins, but it means a broken external scanner is invisible; diagnostics would be better
  than silence.
- **Theme integration:** the window uses theme CSS variables, not hardcoded colours, so dark/light
  works (only the priority badge hex values are literal).

---

## 3. Uncommitted work in the tree (context, not a finding)

The Scanner is **not** clean in the working copy. On branch `feat/ca-nse-final-20261108` (HEAD
`d8df73d`) the scanner scope has 8 modified files, **+337 / −34**:

| File | Change |
|---|---|
| [`ScannerWindow.tsx`](../../src/components/ScannerWindow.tsx) | `handleShowOnChart` now routes through `resolveScannerOverlayPriceBasis` and refuses to draw on a mismatched basis |
| [`chartPatternScanners.ts`](../../src/plugins/scanner/chartPatternScanners.ts) | +211: pivot markers, neckline/role trendlines, zones with `fillOpacity`, channel/three-pivot/rounding geometry enrichment |
| [`chartPatternScanService.ts`](../../src/plugins/scanner/chartPatternScanService.ts) | +15: price-basis verification on history load |
| [`chartPatternPrimitives.ts`](../../src/plugins/scanner/chartPatternPrimitives.ts) | `findSwingPivots` defaults changed (5 %/2.5 ATR → 4 %/2 ATR) and `scale` now populated |
| [`chartPatternTypes.ts`](../../src/plugins/scanner/chartPatternTypes.ts) | geometry contract additions (`role`, `midline`, `fillOpacity`) |
| [`scannerPatternMap.ts`](../../src/plugins/scanner/scannerPatternMap.ts) | carries `scannerId` into map entries |
| two test files | +103 assertions/fixtures |

Everything in this review describes that working-copy state plus HEAD, not a released build.

---

## 4. Validation actually run

| Command | Result |
|---|---|
| `npx vitest run --exclude "tmp/**" src/plugins/scanner src/components/__tests__/Scanner* src/engine/__tests__/Scanner*` | **PASS** — 15 files, 116 tests |
| `scripts/validate-change.ps1 -Profile renderer` | **PASS** — renderer typecheck + whitespace check |
| Throwaway definition-enumeration test (created, run, deleted) | 74 definitions / 74 unique ids / priority 73 H · 1 M · 0 L |
| `npx vitest run src/plugins/scanner` **without** the `tmp/**` exclude | 6 files / 12 tests failed — every failure was inside stale copies under `tmp/UX13_PR_Promotion_…/worktree/…`, **not** project source. Reported for honesty; the `tmp/**` exclusion in `package.json` is required and load-bearing. |

Not run, and therefore not claimed: Rust compile/tests (no backend change reviewed), portable rebuild,
and any manual native QA of the Scanner window.

---

## 5. Recommended order of work

1. **S-05** (unmount/close cancellation) — smallest change, largest loss-of-control risk: cancel the
   run on unmount and ask before closing mid-run.
2. **S-06** (alert scan `signalRules`) and **S-07** (row key) — one-line and one-key fixes.
3. **S-04** (signal-rule indicator contract) — decide whether the scanner should build the bundle from
   the user's Signal Manager indicators, or fail closed with a visible "indicator not available in
   scanner" warning. Silent close-price fallback should not survive.
4. **S-03** (price basis) — expose a basis choice for batch scans and record it on each result, so a
   row carries the basis it was computed on. This is the change that most affects trustworthiness of
   historical results; it needs an explicit decision because it changes what a scan means.
5. **S-01/S-02** (ranking and universe) — either rename the presets to "Positive close" / "Negative
   close" and label the universe as alphabetical, or add real top-N ranking plus a paged full-universe
   target resolution. Naming-only is the low-risk option.
6. **S-08/S-09** (priority and score honesty) — derive priority from the existing `reliability`
   metadata and either compute scores from data or rename the column.
7. **S-10/S-11/S-12** — grouping key, single-window endpoint parity, and timeframe propagation.
8. **S-17..S-21** — delete or wire the dead code, strengthen the signal tests, extract `ScannerWindow`
   logic into testable helpers before any further growth.

Any of items 1–3 also requires the user's portable rebuild before it can be observed at runtime.

---

## 6. Limits of this audit

- Detector heuristics were reviewed structurally (thresholds, windows, shared primitives, geometry
  contracts), not validated against real NSE/BSE data. Whether the 54 patterns fire at a sensible rate
  on live history remains **unverified**; the fixtures are synthetic.
- No native Windows run, no populated database, no market-data parity check. Everything above is
  source-level evidence.
- Rust was inspected only for the two behaviours the Scanner depends on (`ORDER BY symbol ASC LIMIT`,
  and `adjusted` defaulting to false).
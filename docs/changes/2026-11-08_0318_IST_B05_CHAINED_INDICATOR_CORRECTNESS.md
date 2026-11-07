# B05 — Strict chained-indicator dependencies, missing data and warmup

**IST timestamp:** 2026-11-08 03:18 IST (UTC+05:30)
**Active workstream:** EOD Charting Platform
**Authorized local Windows project root:** `E:\TA Projects\EOD Charting Platform` (not accessed)
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Authoritative task baseline:** GitHub `main` `bc472085f9bf11d45ed68da953577ea98bd6a48e`, Git tree `f0474c008911532612ebfd9c6bc943cc29b6eb1e`
**Tracking:** B05 issue #34, master #28, draft PR #74
**Isolated branch:** `fix/b05-chained-indicator-dependencies-20261108`
**First tested commit:** `746f59a097db719f1bae069faff6c03f36e6ee21`
**Expanded test commit:** `51f54664b3c0fa95ca09c48a7a238e2e80c61678`

## Objective, explicit authorization and previous defects

The user explicitly approved the following strict mathematical policy before implementation: never use price Close to replace a selected upstream indicator's unavailable/missing/nonfinite values; preserve initial warmup nulls; reset downstream calculations after internal invalid gaps; calculate upstream dependencies before consumers while keeping the original display order; reject missing, hidden, failed, cyclic and unresolved-plot upstream references; preserve standalone studies, valid saved identifiers, cache isolation and completed-bar behavior.

Prior defect mechanisms in GitHub `main`: `getSourceValues` substituted `bar.close` for null/NaN upstream values or absent series; `buildRenderableIndicators` evaluated studies in on-screen order so reversed chains silently failed/fell back; the recursive cache key only guarded recursion but the evaluation engine did not detect dependency cycles; `sourcePlotKey` was stored but ignored. Study-as-Source already existed in the settings UI, and no new control is added here.

## Inspected source files and evidence

- `src/indicators/base.ts` — source value resolution, `padSeries`, renderable lines and bundles.
- `src/indicators/registry.ts` — indicator registry and dispatch, recursive cache-key signature, successful renderable cache, diagnostic reporting and input-order reduction.
- `src/engine/Indicators.ts` facade and `src/engine/types.ts` overlay/pane, `sourceIndicatorId`, `sourcePlotKey` and saved-field contracts.
- `src/engine/__tests__/IndicatorsChaining.test.ts` and `IndicatorsCache.test.ts` plus B03 `indicatorCalculationDiagnostics.test.tsx` to preserve accepted regression expectations.
- Source-consuming builders for SMA, EMA, RSI, MACD, Bollinger, VWMA, STOCHRSI, Ripster EMA Clouds and others; their algorithms are not edited.
- `src/components/IndicatorSettingsDialog.tsx` existing Study-as-Source options and `src/engine/Signals.ts` independent signal-source resolver. Both are unchanged.
- Pinned GitHub `main` was rechecked before the branch; no other workstream files, local Windows databases, snapshots or older chat ZIPs were treated as source authority.

## Files created and modified

- **Modified:** `src/indicators/base.ts` — when `sourceIndicatorId` is supplied, require a present and bar-aligned upstream array containing only finite numbers; throw a descriptive error instead of substituting Close for any null/nonfinite/missing value. Unchained price input semantics are unchanged.
- **Created:** `src/indicators/chaining.ts` — confirmed chain-consumer kind whitelist, exact chosen line/histogram plot lookup, and reassembly of line values/colors, histogram values/colors, bands, markers and points across contiguous valid upstream runs. Missing input locations remain null; each downstream calculation restarts on its next valid run.
- **Modified:** `src/indicators/registry.ts` — dependency-first recursion with per-indicator memoization, cycle detection, missing/hidden/failed source diagnostics, selected plot-key checking, ambiguous duplicate-ID rejection and segmentation. Keep successful cache-key invalidation, object identity reuse, original overlay/pane display order and existing error reporter. Never cache failures.
- **Created:** `src/engine/__tests__/IndicatorsChainingCorrectness.test.ts` — fourteen new focused tests including independently computed upstream/downstream reference values, gap resets, MACD histogram/Bollinger band composition, explicit plot selection, duplicate IDs, absence/failure/cycles, cache and persistence, and completed-bar prefix stability.
- **Created:** `docs/changes/2026-11-08_0318_IST_B05_CHAINED_INDICATOR_CORRECTNESS.md` — this maintained IST source-change record.
- **Not modified:** original indicator mathematical builders, chart UI/source selection components, signal source resolver, types and workspace storage, Rust/Tauri, databases, dependency manifests/locks, build packaging or source-control infrastructure.

## Exact behavior changes

- If an upstream indicator is valid, its requested line (or histogram) is resolved by its ID and optional `sourcePlotKey` before computing dependent studies, irrespective of chart display order.
- If an upstream output has initial warmup nulls, the downstream study starts only when the upstream begins producing finite values. If it has an internal gap, the downstream study resets at the next contiguous finite run. It never bridges the gap with price Close.
- A missing, hidden, failed, circular, ambiguous-duplicate, unsupported-consumer or unresolved-plot source produces a diagnostic and prevents the invalid downstream plot. Healthy independent studies continue rendering.
- Existing successful output caching and upstream settings invalidation still apply. Computed visuals remain ordered by the original indicator list, not dependency execution order. Cached failures are never retained.
- Standalone indicator arrays, formula builders and completed historical bar outputs are unchanged; the correction deliberately changes incorrect historical chained results that previously used fallback Close.

## Accepted behavior preserved and validation scope

- Standalone SMA/EMA/RSI/MACD etc., chart prices and source settings, existing saved indicator IDs and plot keys, persisted workspace schema, completed-bar non-repaint behavior and normal chart layout remain unchanged.
- Existing valid RSI→SMA/EMA and longer chains preserve correct numeric output, and the revised tests verify exact arrays against independently combined technical-indicator references.
- Existing success cache identity and B03 diagnostic isolation behavior were checked by the complete renderer test suite. No new external dependency, data migration, local source checkout change, market data/network call or native mutation.
- The chart settings UI already offers Study-as-Source; this task does not expose any new UI or redesign the existing selector. Unsupported consumers are rejected at calculation instead of being silently treated as Close.

## Actual GitHub Actions verification

**First implementation run:** [#42417169884](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42417169884), source/test commit `746f59a097db719f1bae069faff6c03f36e6ee21`.

| Check | Verified first-run result |
|---|---|
| Checkout, Node.js 24, `npm ci` | PASS |
| `npm test` complete renderer suite | PASS — 1,502 passed, 1 skipped, 0 failed |
| B05 chaining-correctness suite | PASS — 10/10 |
| Existing chaining suite | PASS — 1/1 |
| Existing indicator-cache suite | PASS — 6/6 |
| B03 diagnostic suite | PASS — 9/9 |
| `npm run typecheck:renderer` | PASS |
| `npm run build:renderer` | PASS — Vite 6.19 seconds |

**Expanded regression run:** [#42417434116](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42417434116), exact source/test commit `51f54664b3c0fa95ca09c48a7a238e2e80c61678`.

| Check | Verified expanded-run result |
|---|---|
| GitHub checkout / `npm ci` | PASS |
| `npm test` full Vitest | **PASS:** 226 test files passed, 1 skipped; 1,506 tests passed, 1 skipped, 0 failed |
| B05 `IndicatorsChainingCorrectness.test.ts` | **PASS: 14/14** (26 ms) |
| Existing `IndicatorsChaining.test.ts` | PASS: 1/1 |
| Existing `IndicatorsCache.test.ts` | PASS: 6/6 |
| B03 `indicatorCalculationDiagnostics.test.tsx` | PASS: 9/9 |
| `npm run typecheck:renderer` | PASS |
| `npm run build:renderer` | PASS — Vite 6.59 seconds |
| Standalone focused Vitest command | NOT RUN; focused suites ran as part of full renderer suite |
| Windows installed application, manual plot review, portable build, Rust tests, real market data/DB | NOT RUN; not accessible or in scope for GitHub-only B05 |

**Final documentation-commit gate:** Adding this file changes the PR head SHA. Verify GitHub CI **again** on that exact documented commit before recommending any merge. The successful prior runs apply only to their stated SHAs.

## Risks and limitations

- This is a **user-approved numerical behavior change** for previously incorrect chained plots. Existing saved chain IDs/configurations are retained, but values that previously used Close during missing input will now be null or computed from later valid runs. Manual visual review of known workspaces is required for release acceptance.
- Multi-output stitching (line colors, histogram, bands, markers, points) is implemented and covered by MACD/Bollinger reference tests, but cannot exhaustively prove all community or third-party plugins behave like numerical-source builders.
- A fixed allowlist identifies built-in builders confirmed to read `sourceIndicatorId`; builders that ignore it are rejected rather than silently plot a Close-derived value. Additional chain-capable builders require deliberate tests/allowlist extension.
- A selected upstream line with no finite data reports unavailable; an unmatched `sourcePlotKey`, missing/hidden/failed/cyclic source, or duplicated upstream ID reports an error. No migration or rewrite of legacy workspaces was attempted.
- A dependency chain is calculated during the existing render invocation, without background polling or extra remote calls. Long chains or highly fragmented source data may add calculation work; neither performance profiling nor Windows portable/native stress tests were run.
- All chart tests remain renderer tests. Rust/Tauri/Windows and real-data checkpoints are not claimed; the one previously skipped Vitest remains skipped.

## Rollback and bounded closure

Before merge, close draft PR #74 without modifying `main`. After a separately approved merge, revert only the B05 commit through a reviewed PR, guarding the exact GitHub SHA and preserving unrelated newer changes. B05 issue #34 stays OPEN until the user approves the validated final PR and the actual merge is confirmed. Record the final doc-commit run and any review limitations in PR/issue/master. No B06 changes, branch deletion, database access, or local sync are authorized by this B05 implementation.

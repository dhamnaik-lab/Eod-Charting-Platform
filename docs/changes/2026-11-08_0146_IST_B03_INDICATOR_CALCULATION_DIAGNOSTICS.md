# B03 — Per-indicator calculation diagnostics without chart failure

**IST timestamp:** 2026-11-08 01:46 IST (UTC+05:30)
**Active workstream:** EOD Charting Platform only
**Authorized local Windows project root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Confirmed baseline:** GitHub `main` `31487aa3be2f495b725b962ce719c296c4427595`, tree `e904fa59580a5790ae24292882658da396417e20`
**Issue:** [#32](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/32); **Master:** [#28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28); **Draft PR:** [#71](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/71)
**Working GitHub branch:** `fix/b03-indicator-calculation-error-status-20261108`
**First tested commit SHA:** `927ae6979741e0be2b6d557a77c6318e61d31bbe`

## Objective and previous defect

In `src/indicators/registry.ts`, both built-in and dynamic/plugin indicator builder calls silently suppressed thrown exceptions with `catch { return null; }`. The failed study vanished from the chart without an explanation while successful studies continued. A builder returning `null` because it cannot produce a plot was also silently skipped. The bounded objective was to provide an accessible, per-indicator status without crashing the chart, changing formula math, introducing toast floods, or disturbing successful renderables.

## Files inspected

- `src/indicators/registry.ts` — normal/plugin dispatch, null/exception suppression, per-bars cache signatures and successful-renderable caching.
- `src/indicators/base.ts` — overlay, pane and bundle contracts; source series/line renderer and helper types.
- `src/components/ChartPriceLegendOverlay.tsx` — existing price summary, indicator/compare legend, collapsed secondary row and screenshot snapshot behavior.
- `src/components/ChartPaneControlsOverlay.tsx` and `src/components/ChartCanvas.tsx` — existing pane settings/controls, legend mounting, chart engine handoff.
- `src/engine/ChartEngine.ts` — chart render-state construction and successful pane/overlay behavior.
- `src/engine/__tests__/IndicatorsCache.test.ts`, `IndicatorsChaining.test.ts`, `src/components/__tests__/ChartPriceLegendIndexGap.test.ts`, other renderer indicator regression coverage.
- Latest `main` and issue #32 were reverified before creating the isolated branch; no other workstream material was used.

## Files created and modified

- **Modified** `src/indicators/base.ts`: Add `IndicatorCalculationDiagnostic` and an optional `diagnostics` field to the render bundle. Healthy bundle output fields `overlays`/`panes` are unchanged.
- **Modified** `src/indicators/registry.ts`: Preserve the existing exported builder's null/return behavior while adding an optional failure callback; report caught exceptions or missing implementation, distinguish an unsuccessful `null` build as `unavailable`, attach one bounded message per visible indicator ID, never throw to the chart. Existing successful cache behavior remains unchanged and failures are not cached.
- **Modified** `src/components/ChartPriceLegendOverlay.tsx`: Use the full existing render bundle and show a compact, scrollable `<div role="status" aria-label="Indicator calculation status">` in the always-visible legend shell when there are failures. Covers both price overlays and pane indicators, even when the secondary indicator legend is collapsed. The old price summary and controls remain untouched. No notification/toast effect.
- **Created** `src/indicators/__tests__/indicatorCalculationDiagnostics.test.tsx`: Nine focused regression cases for failure isolation, healthy siblings, deduplication, simulated bad persisted parameters, `null` as unavailable, no-bars/short-history behavior, hidden indicators, recovery after builder repair, persistent accessible legend display and pane failures.
- **Created** `docs/changes/2026-11-08_0146_IST_B03_INDICATOR_CALCULATION_DIAGNOSTICS.md` (this file).
- **Not changed:** indicator formula builders, math, bar data, saved workspace schemas, chart store persistence, data sources, Tauri/Rust/native package files, lockfile, dependencies, or UI stylesheets.

## Final behavior changed

- If a visible study's builder throws, calculation continues for other indicators; a one-row diagnostic identifies the study and a concise error message (maximum 160 input-message characters). Non-Error throws produce a generic failure message.
- If a builder returns `null` with nonempty history, it shows a less severe `No output for current bars or settings`, rather than incorrectly asserting an exception.
- There is no diagnostic for zero bars or an intentionally hidden indicator. Ordinary warmup outputs with null line *values* remain valid renderables and do not report false failures.
- A single diagnostic is emitted per indicator ID per calculation bundle. No toasts are created. Healthy renderables still use the original cache and ordering.
- A failing indicator's status clears when a subsequent calculation succeeds (for example when settings or bars change and the React legend recomputes). The failure is not cached to avoid blocking recovery.
- The price legend status is visible independently of secondary legend expansion and is scrollable when several failures occur. Pane indicator diagnostics also appear in this chart status area.

## Accepted behavior preserved

- All numerical algorithms, indicator configuration and workspace persistence, price summary/compare legend text, settings actions, successful overlay and pane output, indicator order and success cache identity remain unchanged.
- The registry still returns `null` for unsuccessful single-indicator calculation. Charts are not prevented from rendering because of one failed study.
- No new dependencies, global event listeners, toast spamming, database reads/writes or network calls were added. No native/Rust or chart engine architecture changes were introduced.
- Existing charts without errors do not display an extra status, and successful render bundles retain their prior shape.

## Actual validation commands and evidence

**First full CI run:** [GitHub Actions #42410072062](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42410072062) at test commit `927ae6979741e0be2b6d557a77c6318e61d31bbe`.

| Check | Actual result at first tested commit |
|---|---|
| GitHub checkout, Node.js 24, `npm ci` | **PASS** |
| `npm test` (full Vitest) | **PASS:** 224 test files passed, 1 skipped; 1,482 tests passed, 1 skipped, 0 failed |
| B03 `indicatorCalculationDiagnostics.test.tsx` | **PASS: 9/9** (38 ms) |
| Existing `IndicatorsCache.test.ts` | **PASS: 6/6** |
| Existing `IndicatorsChaining.test.ts` | **PASS: 1/1** |
| Existing `ChartPriceLegendIndexGap.test.ts` | **PASS: 9/9** |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS** (Vite 6.61 s) |
| Standalone focused test command | **NOT RUN**; B03 and other focused suites were run and passed as part of full Vitest |
| Windows installed UI / manual chart, native portable, Rust, real DB and market-data validation | **NOT RUN** (out of this bounded GitHub renderer task) |

**Final-head validation gate:** This documentation commit changes the GitHub branch head. Check a new CI run against the exact final documentation SHA and record its outcome in the PR and issue before recommending a merge. Do not infer the new run passed based on the first run.

## Risks / limitations

- React SSR tests prove the status markup is present, including collapsed-legend and pane cases, but do not certify Windows layout, DPI, keyboard accessibility, overflow behavior or visual collision. Manual chart testing remains a separate required acceptance checkpoint.
- Unexpected malformed source/bar records, out-of-schema cyclic objects or invalid renderable shapes beyond a catchable builder error are not certified safe; this task intentionally focuses on builder exception/null handling.
- Dynamic/plugin builder exception handling was updated through the same failure callback; the focused synthetic tests directly exercise the built-in registry and observable chart status, not a live third-party plugin lifecycle.
- The chart legend uses the existing memoized calculation path; a repaired plugin may need normal chart data/settings changes or reinitialization for a React update. No new background polling was added.
- Failed builders can be retried when the engine recalculates, matching existing behavior. Failures are not cached so as not to conceal recovery.
- The one skipped pre-existing Vitest test is unchanged and no post-merge/native/portable certification is implied by renderer CI.

## Rollback guidance and next checkpoint

Before merge, close draft PR #71 and leave `main` unchanged. If later approved and merged, revert only B03 via a reviewed GitHub PR and preserve unrelated newer commits. Use actual GitHub SHA/diff guards. Update issue #32 and master #28 only with validated facts; **do not close issue #32 or merge without explicit user approval**. Finish a manual Windows chart checkpoint when a synchronized local checkout/portable build is available. B04 and later audit tasks remain independent and unstarted.

# F-01 — selected-bar volume in price legend

- **IST timestamp:** 2026-11-16 01:36 (+05:30)
- **Workstream / authorized local root:** EOD Charting Platform, `E:\\TA Projects\\EOD Charting Platform`
- **GitHub authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Implementation branch:** `fix/f01-price-legend-volume-20261116`
- **Source audit:** 2026-11-15 Deep Review & UX Audit, F-01

## Objective

Display the selected OHLC bar's share volume in the HTML chart price legend and the shared screenshot-legend snapshot. This is a single bounded correction, not a new Status Line settings system.

## Previous defect / limitation

`ChartPriceLegendOverlay.tsx` renders date, O/H/L/C and price change, but `buildPriceSummary()` omitted `bar.volume`. The canvas price legend is disabled in `ChartCanvas.tsx`, so the active chart's HTML price legend had no volume readout. The existing `showVolume` preference controls the chart's **volume pane**; it is not a legend visibility setting. The audit's assertion that volume had no UI path at all was overstated.

## Files inspected

- `src/components/ChartPriceLegendOverlay.tsx`
- `src/components/__tests__/ChartPriceLegendOverlay.test.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartSettingsDialog.tsx`
- `src/features/charts/chartScreenshotLegendRenderer.ts`
- `src/engine/Crosshair.ts`
- `src/engine/types.ts`
- `src/store/chartStoreTypes.ts`
- `src/components/OhlcvBar.tsx`
- `package.json`
- `docs/changes/2026-11-15_2019_IST_AUDIT_BOUNDED_UI_PERFORMANCE.md`

## Files changed

1. `src/components/ChartPriceLegendOverlay.tsx` — uses the existing exported `formatVolume` from `Crosshair.ts`, adds a compact `Vol` label/value for the selected bar, and shows exact `en-IN` grouped volume in its tooltip. Invalid or negative values show an unavailable marker; zero remains zero.
2. `src/components/__tests__/ChartPriceLegendOverlay.test.tsx` — tests DOM and screenshot snapshot parity, hover selection, zero/unavailable volumes, existing price-change output, and empty chart.
3. This IST change record.

## Implementation and preserved behaviour

- `buildPriceSummary()` already feeds both the HTML chart legend and the screenshot snapshot, so updating it avoids duplicate formatters and keeps the two data models aligned.
- Retains all existing OHLC/change formatting, colour tokens, layout and hover selection.
- Retains the existing volume pane toggle, without attaching this readout to it.
- Does not introduce app settings, persistence, native bridge calls, dependencies, database reads or unrelated refactors.
- Existing screenshot renderer may still clip long summaries on narrow canvases; F-10 is separately tracked, not silently redesigned here.

## Validation commands and results

| Validation | Command / evidence | Actual outcome |
| --- | --- | --- |
| GitHub source authority | Compare prior `ca1cd936...` audit commit to `main` | **Verified**: latest `main@42ae31ba...` includes intervening code changes; F-01 still applies |
| Source review | GitHub file reads | **Verified**: summary did not use `bar.volume`; existing formatter available |
| Full regression suite | `npm test` through GitHub Renderer CI | **FAIL** at source commit `8276f723a505099fb793742a0df760d30e1d8027`: 1,830 passed, 2 failed, 1 skipped (266 files: 263 passed, 2 failed, 1 skipped) |
| F-01 and chart-index focused test files | Included in full `npm test`; no separate focused command | **PASS:** `ChartPriceLegendOverlay.test.tsx` 7/7 and `ChartPriceLegendIndexGap.test.ts` 9/9 |
| Renderer typecheck | `npm run typecheck:renderer` in GitHub CI | **PASS** |
| Renderer build | `npm run build:renderer` in GitHub CI | **PASS**, Vite built in 7.35s |
| Source diff | GitHub compare `main@42ae31ba` vs branch | **PASS:** exactly 3 files; 0 behind base |
| Initial regression run | GitHub Renderer CI [43756237999](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43756237999) | **FAIL:** 11 tests: 9 existing index-gap tests assumed change segment was last; 2 unrelated tests failed. F-01 tests 7/7 PASS. |
| Corrected regression run | GitHub Renderer CI [43756539811](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43756539811) | **FAIL overall:** all 9 chart-index tests recovered; 2 unrelated failures remain. TypeScript and build passed. |
| Windows portable | `npm run tauri:portable:win` | **On hold by user** |
| Windows manual | Chart legend for hovered/unhovered equity/zero-volume index, screenshot, toggle pane | **On hold by user** |

## Risks and limitations

- The extra volume label may expand long legend rows; narrow-screen screenshot clipping remains F-10.
- Existing `ChartPriceLegendIndexGap.test.ts` asserts the price-change segment remains the final summary segment. The first implementation placed volume after it and failed 9 tests. The corrected implementation places volume **before** change, preserving that existing contract; all 9 tests passed on rerun.
- Full-suite failure remains in two out-of-scope tests after that correction:
  - `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` — expected readiness values differ from actual (`ready` vs `needsReview`).
  - `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` — expected explicit reviewed rollback invocation differs from actual.
  These two fail in both GitHub runs and neither test nor corresponding application source was modified in this PR. Their pre-existing baseline status at `main@42ae31ba` is **not independently established**; record separately for a later bounded investigation. They are not silently fixed here.
- `formatVolume()` is an existing compact formatter, not a refactor of volume number formatting; exact volume is available in a tooltip.
- A separate legend visibility setting is intentionally out of scope; the current `showVolume` flag refers to the volume pane.
- GitHub CI does not replace Windows portable/WebView2 visual acceptance.
- Prior F-52 draft PR #103 remains held for separate Windows acceptance; it was based on an older `main` and must be re-evaluated before merge.

## Rollback

Do not merge the draft pull request if CI or Windows visual acceptance fails. Revert only the added formatter import and two volume legend segments, remove the newly added regression tests, and preserve other source changes. Baseline content for the changed files is identified by GitHub commit `42ae31bae7937dde944c87a997b94da933ad1a0b`.

## Evidence

- Base commit: `42ae31bae7937dde944c87a997b94da933ad1a0b`
- Working branch: `fix/f01-price-legend-volume-20261116`
- Tested source commit: `8276f723a505099fb793742a0df760d30e1d8027`.
- [Initial CI run](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43756237999): 11 failures; nine were corrected within the F-01 boundary.
- [Corrected CI run](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43756539811): F-01 and index regression suites pass, typecheck and renderer build pass; full Vitest fails in 2 unrelated tests.
- Final change-record-only commit changes documentation, not renderer/test source.

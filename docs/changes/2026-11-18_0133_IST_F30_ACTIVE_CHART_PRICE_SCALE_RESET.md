# F-30 follow-up — active-chart price scale reset on instrument replacement

- **IST timestamp:** 2026-11-18 01:33:24 (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Windows source root:** `E:\TA Projects\EOD Charting Platform`
- **GitHub PR:** [#118](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/118) (draft, unmerged)
- **Source authority before patch:** `fcae74e2102c8cc09c226ebd1fcb352eb1a56b39`
- **Baseline main:** `70b01fa86a1cbef1d1b59588b1462f3bcf16a193`

## Objective and previous defect

During F-30 native acceptance, the operator selected NSE:CHEMPLASTS in the compact Market Movers list, replacing the active chart. The chart loaded 1,273 OHLCV bars and reported a last price near ₹238, but retained a right-hand price scale around ₹72,000–₹88,000. Candles were effectively invisible. The operator confirmed opening in a new chart worked.

**Source-level cause:** `chartInstrumentCompareController.loadInstrument` first calls `buildInstrumentLoadStartTab`, which replaces `tab.instrument` with the requested symbol but leaves `paneScaleOverrides.price` intact. When `applyEodResultToTab` later attempts to identify a changed instrument, it compares against the already-replaced `tab.instrument`, so its existing stale-price-range cleanup is bypassed. `ChartEngine.buildRenderState` honors `paneScaleOverrides.price` when building its Y-axis. This affects any active-tab instrument replacement with a manual price-scale override, not just Market Movers.

## Files changed

1. `src/features/charts/chartInstrumentHydrationService.ts` — discard only the old `price` pane override at the **start** of a different-instrument load. Leave all other pane overrides unchanged, and keep the old price range on same-instrument refresh.
2. `src/features/charts/__tests__/chartRequestConsistency.test.ts` — integration coverage through the actual asynchronous chart instrument controller: high-valued NIFTY axis to ₹238 CHEMPLASTS, retention of unrelated indicator pane override, unchanged background tab, and same-instrument price override preservation.
3. This timestamped change record.

## Behavior preserved

- No change to Market Movers scan logic, results, sorting, filtering, chart navigation triggers or tab duplication.
- No change to database, binary EOD bars, adjustment calculations, instrument identity mapping, chart indicators, viewport preservation, drawing scope persistence, or compare overlays.
- Same-symbol reload retains its manually adjusted price scale. Other indicator pane overrides remain intact across a new symbol.
- The existing completion-stage safety cleanup remains as an additional defense when results are applied directly.

## Validation and evidence

**Source review:** path and mechanism verified against the exact PR source. This GitHub patch is not a local Windows test or build.

**Required automated checks:** `npm.cmd test -- src/features/charts/__tests__/chartRequestConsistency.test.ts`, `npm.cmd test -- src/features/marketMovers/__tests__`, full `npm.cmd test`, `npm.cmd run typecheck:renderer`, `npm.cmd run build:renderer`, and relevant native build/check. Do not claim these passed until command output confirms it.

**Previous F-30 validation:** prior PR head `fcae74e2102c8cc09c226ebd1fcb352eb1a56b39` passed Windows focused 20/20, full Vitest 1,890 passed/1 skipped, renderer typecheck, Vite, `cargo check`, and portable build (reported in operator evidence). These results do **not** validate this new source fix.

**Manual acceptance:** new portable must be built and checked for switching from a high-priced manually scaled chart to CHEMPLASTS in the **same tab**; testing a new tab alone cannot close this defect. Also verify original F-30 filter controls and opening in a new tab. Existing stale CHEMPLASTS tabs may need one switch to another symbol and back (or price auto-fit) after updating.

## Risks and rollback

Price-axis manual ranges are intentionally instrument-specific, so clearing one on symbol change corrects a display defect. A new symbol in a tab with custom axis adjustments now reverts price to auto-fit; indicator pane custom ranges remain untouched. Manual Windows visual acceptance is pending. Do not merge PR #118 without separate approval.

Rollback by reverting the patch to `buildInstrumentLoadStartTab` and the two matching regression tests if an unanticipated behavior breaks; no database rollback is required.

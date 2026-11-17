# F-11 — retire the unused legacy OHLCV bar

**Timestamp:** 2026-11-17 16:26 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform  
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `main` at `fa73870330dcdb814c98c51bb9ceefee3f28b463`  
**Scope:** One bounded cleanup, F-11 of the 76-item UX audit

## Objective and previous limitation

Delete `src/components/OhlcvBar.tsx`, an unmounted legacy OHLCV presentation component. It used `Math.max(prevClose ?? open, 1)` as a percentage divisor, yielding incorrect percentage changes for sub-unit reference closes. It was not the active chart price legend.

## Inspection and implementation

GitHub source search found no JSX mount or active import of the legacy component. The active UI renders `ChartPriceLegendOverlay` via `ChartCanvas`; its summary uses the actual reference close and its existing snapshot is shared with screenshot export.

- Deleted the unused `src/components/OhlcvBar.tsx` file.
- Added a sub-unit reference-close percentage regression in `src/components/__tests__/ChartPriceLegendOverlay.test.tsx`.
- After verification, reconcile F-11 in the audit tracker and report, preserving the historical PR #116 acceptance record.

## Behavior preserved

No edits to `ChartCanvas`, `ChartPriceLegendOverlay`, `uiStore`, the persisted `ohlcvBarVisible` flag, View-menu routing, screenshot export, scanner, corporate actions, market data, or database. Current OHLCV and volume render behavior, including existing zero-reference handling, is unchanged.

## Validation and results

**Pending at initial commit; do not interpret an initial commit as a successful test.** Requested verification: GitHub PR Renderer CI (full Vitest, TypeScript typecheck and Vite build), focused `npm.cmd test -- src/components/__tests__/ChartPriceLegendOverlay.test.tsx` when a suitable Windows checkout is available, and review of the final diff for remaining code imports. No local Windows build or real-database run is authorized by this cleanup.

## Risks and rollback

Residual risk: an unindexed dynamic import of the legacy component would fail after deletion; check code search and CI. Since this was unmounted and the active overlay is unchanged, no native visual change is expected. If an actual consumer is found, revert this bounded deletion from the feature branch; preserve the existing shared legend behavior. Do not modify the accepted PR #116 portable or the primary Windows checkout.

**Evidence:** original component Git blob `945ea649cc48fbe4459f15faedf6da082e799d03`; active-legend regression original blob `71a5259b65f1f823c006fd7fcad5c9434add4686`; original merged main `fa73870330dcdb814c98c51bb9ceefee3f28b463`.

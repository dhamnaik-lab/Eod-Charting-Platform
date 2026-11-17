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
- After verification, reconciled F-11 as FIXED_AND_VALIDATED in the tracker (21 fixed, 15 deferred, 25 architecture pending, 13 already fixed, 2 not applicable = 76). Updated the current findings summary while retaining the historical PR #116 acceptance counts in an explicit post-merge note.

## Behavior preserved

No edits to `ChartCanvas`, `ChartPriceLegendOverlay`, `uiStore`, the persisted `ohlcvBarVisible` flag, View-menu routing, screenshot export, scanner, corporate actions, market data, or database. Current OHLCV and volume render behavior, including existing zero-reference handling, is unchanged.

## Validation and results

**GitHub CI source commit:** `b59b71de1d9a59f6aaabadc54aed674a6dc45d77`, [Renderer CI run 44069641820](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44069641820): **PASS**. Full Vitest reported **272 passed / 1 skipped test files**, **1,886 passed / 1 skipped tests**. Renderer TypeScript typecheck passed and Vite built **845 modules** in 4.75s. The newly added sub-unit percentage regression is included in the full Vitest run; a separate focused CLI invocation was **not** executed. This validation is an actual GitHub Actions run; no local Windows source tests, native Tauri build or real-database run was performed. The docs/tracker follow-up commit has its own CI status to confirm separately.

## Risks and rollback

Residual risk: an unindexed dynamic import of the legacy component would fail after deletion; check code search and CI. Since this was unmounted and the active overlay is unchanged, no native visual change is expected. If an actual consumer is found, revert this bounded deletion from the feature branch; preserve the existing shared legend behavior. Do not modify the accepted PR #116 portable or the primary Windows checkout.

**Evidence:** original component Git blob `945ea649cc48fbe4459f15faedf6da082e799d03`; active-legend regression original blob `71a5259b65f1f823c006fd7fcad5c9434add4686`; original merged main `fa73870330dcdb814c98c51bb9ceefee3f28b463`.

## Final documentation files

- Modified `docs/audits/2026-11-17-ux-audit-completion/FINDINGS_TRACKER.csv` (F-11 only).
- Modified `docs/audits/2026-11-17-ux-audit-completion/FINAL_REPORT.md` (current counts and post-merge note).
- Updated this IST change record with real CI output.

**Documentation rollback:** Revert this F-11 branch commit if the cleanup is rejected; PR #116 merged main and the original accepted portable remain unchanged.

# F-30 — Market Movers Full View filter-control parity

**IST timestamp:** 2026-11-17 (Asia/Kolkata)  
**Workstream:** EOD Charting Platform  
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `main@70b01fa86a1cbef1d1b59588b1462f3bcf16a193`  
**Scope:** One bounded missing-controls defect, F-30

## Objective and previous limitation

The compact Market Movers panel allowed operators to set minimum close price, minimum volume, and exclude warned corporate actions with Cancel/Apply semantics. Full View already had Volume Surge, exchange selection, and 100-row pagination after PR #116, but lacked the equivalent filter controls. Before the initial scan, Full View displayed only a Scan action.

## Implementation

- Add `MarketMoversFilterControls.tsx`: one shared presentation and normalization implementation for the three existing filter criteria, no new dependencies.
- Reuse that form in `MarketMoversPanel.tsx`'s existing portal, preserving its mounting and event behavior.
- Add Full View's Filters trigger and inline controls for both pre-scan and snapshot-present states; changes apply only on Apply.
- Add four focused regression tests for shared fields, normalization, Full View pre-scan accessibility, and the existing Full View results layout.
- No change to backend fetches, data computations, filters' persisted schema, scan invalidation, or chart loading.

## Preserved behavior

The compact panel still uses the existing portal and unpinned-sidebar interaction. The Full View remains a combined two-table Gainers/Losers view with independent Volume Surge selection and 100-row paging; the 5/10/20 cap remains compact-only by design. Neither view scans automatically. Cancel discards draft criteria; Apply changes settings and requires the existing manual Update scan. NSE/BSE selection, warning banners, chart actions, scanner, corporate actions and database are unchanged.

## Validation commands and evidence

**First CI attempt (commit `660c6185718c4250828adbcfa41d01f529073d66`):** [Renderer run 44101908492](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44101908492) failed 1 new static-markup test (1,889 passed, 1 skipped; TypeScript and Vite PASS). This was a test-fixture error: Zustand's SSR snapshot is captured at initialization, so setting the store after initialization did not affect React's server-rendered output. The fix mocks only `useDailyMarketMovers` within the test to read current fixture state. No production component or store changes. Final-head CI status must be checked independently after this follow-up.

Required focused: `npm.cmd test -- src/features/marketMovers/__tests__`; full: `npm.cmd test`, `npm.cmd run typecheck:renderer`, `npm.cmd run build:renderer`. Rust and Windows native build are not invoked from this GitHub-only run. Report their actual status and results, not assumptions. The pre-existing mounted sidebar portal regression must be retained; it cannot be claimed re-executed unless its command runs.

## Risk, limitations and rollback

The Full View filter form is inline instead of a portal, to avoid new outside-click/focus issues. Native click behavior and responsive layout require later Windows visual acceptance. Search, new market universes, corporate-action adjustment modes and scan-cache restructuring are outside F-30. Do not modify F-33, F-34, F-39 or backend data.

Rollback: revert this bounded PR from its feature branch before merge if regression tests fail; the accepted GitHub `main@70b01fa86a1cbef1d1b59588b1462f3bcf16a193` and production database remain unchanged.

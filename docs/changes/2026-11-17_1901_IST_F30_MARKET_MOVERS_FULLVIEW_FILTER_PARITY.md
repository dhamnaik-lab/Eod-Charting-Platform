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

## Verified follow-up validation (18 November 2026, 00:20 IST)

The corrected test and untouched application files at source commit `522976ee5c43b2186b12ce18103a9220d797b6a7` passed [GitHub Renderer workflow 44151794409](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44151794409): **273 test files passed, 1 skipped; 1,890 tests passed, 1 skipped; TypeScript typecheck PASS; Vite build PASS (846 modules transformed, 4.75 seconds)**. The former cached-snapshot test failure is resolved. This is GitHub runner evidence, **not** Windows-native browser or production-database acceptance.

The follow-up to this change record is documentation-only. Full renderer CI should also be confirmed at its exact final commit before the PR can be considered CI-validated. The previously accepted Windows portable binaries were not changed.

## Pre-scan exchange control follow-up (18 November 2026 IST)

Final scope inspection identified that the Full View's existing NSE/BSE selector was accessible only when a snapshot existed. The same selector and setting callback are now reused in the empty/pre-scan toolbar, so a fresh Full View can choose NSE, BSE, or both before a manual scan. The loaded-snapshot toolbar still uses the identical select control. Added focused server-markup assertions for pre-scan exchange options; no fetch, snapshot generation, or store logic changed. **CI for this final source commit must be checked separately.**

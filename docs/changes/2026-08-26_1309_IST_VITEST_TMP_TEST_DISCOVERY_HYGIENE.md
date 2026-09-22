# Vitest tmp Test-Discovery Hygiene

**IST timestamp:** 2026-08-26 13:09:51 +05:30 IST

## Objective

Make the ordinary npm test command validate the live source tree without discovering historical copied tests stored under tmp.

## Previous defect or limitation

The default npm test command expanded Vitest discovery into tmp and executed stale historical snapshot tests. V1.14Y R5 demonstrated this when a copied officialWatchlistDataSplit.test.ts failed because its historical snapshot did not contain split-official-watchlist-data.mjs, while the real src test passed.

## Files changed

- package.json

## Final implementation

- Changed scripts.test from itest run to itest run --exclude tmp/**.
- package-lock.json remained byte-identical.
- No Vite/Vitest production build configuration changed.
- Historical tmp evidence remained untouched.

## Validation commands and actual results

- Preserved R5 RED evidence: PASS; plain npm test discovered stale tmp tests before this change.
- 
pm test: PASS; 110 test files / 632 tests, 0 failures.
- Confirmed no tmp test path was executed by the default npm test command.
- 
pm run typecheck:renderer: PASS.
- 
pm run build:renderer: PASS; 742 modules transformed.

## Behaviour deliberately preserved

- Production runtime behavior.
- V1.14Y Approved-validation hydration.
- V1.14X Corporate Action consolidation.
- V1.7A-P2 test isolation.
- Historical tmp audit/snapshot evidence.

## Risks or limitations

- Direct ad-hoc 
px vitest run outside the project npm script can still use Vitest default discovery unless the caller supplies an exclusion.

## Rollback guidance

- Restore package.json from E:\TA Projects\EOD Charting Platform\tmp\vitest-tmp-discovery-hygiene_20260826_130951_021\source-before\package.json.
- No database, package-lock, production-source, or portable rollback is required.

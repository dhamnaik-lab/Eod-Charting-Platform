# Issue #113 — Plugin-loader test import timing

- **IST timestamp:** 2026-11-16 16:17:50 (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** `main@cf779ae51645b3c8194340db43fbd6a0e45b54a0`
- **Branch:** `fix/issue113-plugin-loader-import-timing-20261116`
- **Issue:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/113

## Objective / previous defect
On Windows at the merged main source, the full default Vitest suite twice reported 1,860 passing, 1 failing and 1 skipped test. The same `pluginLoader.test.ts` case timed out at the 5-second default threshold. The focused file passed (2/2, previously timed callback about 2.80s). Full-suite runs passed at `--maxWorkers=2` (1,861 passed, 1 skipped; 86.73s) and `--testTimeout=15000` (1,861 passed, 1 skipped; 51.52s; affected callback ~6.63s). The module-import cost under parallel worker contention is the best-supported explanation; individual import timing was not directly measured.

## Files changed
1. `src/plugins/__tests__/pluginLoader.test.ts`: convert the same three imports from in-test dynamic imports to static file-scope imports.
2. This IST change record.

## Final implementation
Move `../registry`, `@/indicators/registry`, and `@/plugins/scanner/scannerPlugin` to static imports in the test file. Keep all existing test bodies, assertions, plugin lifecycle callbacks, registration and unregister checks unchanged. This removes module-transform/import overhead from the timed test callback without extending timeout limits.

## Behavior preserved
No changes to production plugin loader, plugin host, indicator/scanner registration, database operations, charting, source imports used in production, dependencies, Vitest configuration, or CI concurrency. The test still exercises the same registration, calculation and cleanup checks. Static imports now initialize test-only module dependencies before test execution, so module initialization ordering is a possible regression risk that must be checked.

## Validation commands / results
- GitHub authority and original blob SHA `c54e58668ba8cdc4fb0b520711079b0290a886ab`: inspected and verified prior to patch.
- GitHub Renderer CI (`npm test`, `npm run typecheck:renderer`, `npm run build:renderer`): **PENDING** until the PR workflow finishes; report actual results afterward.
- Windows focused and repeated **default** `npm.cmd test`, TypeScript and renderer build: **NOT RUN after this change**; operator/Codex validation required before merge.
- Rust / portable build: **not required for a test-only import change** and not run.
- No database access or Windows checkout changes.

## Risks / limitations
- Static imports run at module evaluation time, which could change test-module setup ordering. The dynamic-import code is not part of the production runtime.
- CI on Ubuntu cannot prove default-concurrency Windows stability. Do **not** call Issue #113 resolved on CI alone.
- Do not adopt a global timeout or worker-count increase to conceal the issue.

## Rollback
Do not merge this branch if Windows full-suite defaults fail. Restore the three dynamic-import lines to the second test at the previously verified test blob and drop these three static imports. No database rollback is needed.

## Next step
Run GitHub renderer CI, then have Codex fetch the exact branch onto the normal Windows repository, verify scoped changes, and execute focused + repeated standard `npm.cmd test` followed by TS and Vite. Merge only after operator acceptance and separate approval.

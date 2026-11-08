# B20 — Calculate each active-tab state transformation once

- **IST:** 2026-11-08 16:28 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform `E:\TA Projects\EOD Charting Platform` (GitHub-only; local checkout not accessed)
- **Baseline GitHub `main`:** `ed8cd93e614aaff864d12f5da0aab3742eeb8745`
- **Tracking:** [B20 issue #49](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/49), [master issue #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #85](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/85)
- **Authorization:** one bounded B20 implementation. B12 and B15 are independent, unmerged draft PRs. No batch merges authorized.

## Previous defect and objective

`src/store/chartStore.ts` originally called the active-tab updater once while scanning `chartTabs.some` and again for the same selected tab during `chartTabs.map`. This could repeat expensive transformations, calculations and other updater side effects. The goal is to apply each matching active-tab updater **once** while preserving identity, no-op and autosave behavior.

## Files inspected

- `src/store/chartStore.ts` (current updater and all action call sites)
- `src/features/charts/chartTabStateMutationService.ts` (real tab transformation semantics)
- `src/store/chartStoreTypes.ts` (chart tab/state types)
- Relevant existing tests `chartTabStateMutationService.test.ts` and `workspaceAutosaveQueue.test.ts` reviewed through test inventory/CI.

## Files created and modified

1. **New** `src/features/charts/chartActiveTabUpdateService.ts`: Pure `updateActiveTab` helper. One pass of `chartTabs`, calls each matching updater once; allocates a shallow copy only when a reference changes; returns original array when no tab changed; still visits all matching IDs even if duplicates exist.
2. **Modified** `src/store/chartStore.ts`: imports the helper in place of its duplicate-evaluation implementation; every existing action and autosave scheduling call site remains unchanged.
3. **New** `src/features/charts/__tests__/chartActiveTabUpdateB20.test.ts`: Eight focused tests for missing active ID, no-op identity, exactly-one callback, duplicate active IDs, legacy multiple no-op, real volume mutation, viewport/drawing/hover behavior and exception nonmutation.
4. **New** `docs/changes/2026-11-08_1628_IST_B20_SINGLE_ACTIVE_TAB_UPDATE.md`: this IST source change record.

## Behavior changed and behavior preserved

- **Changed:** computational work is no longer repeated due to the `.some` + `.map` pattern. Copies array only on the first actual reference change.
- **Preserved:** relative order and length of chart tabs; untouched sibling references; no-op original-array identity; multiple entries with a matching ID; selection, active ID ownership, indicator changes, drawings, viewport, timeframe, chart types and autosave scheduling/signature interactions (their call sites and queue are not edited).
- The pure helper intentionally does not suppress or swallow thrown updater exceptions. No backend, dependencies, database, native Rust code, build/portable artifacts or settings changed.

## Actual testing and build evidence

**First implementation/tests commit:** `09bbacfae26e75c039768a49618bccb863a76605`, [GitHub Actions #42473320709](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42473320709). `npm test` PASS, **1,562 tests passed / 1 skipped / 0 failed**, focused B20 **8/8**; Vite build PASS. **TypeScript FAIL** because the deliberately minimal test fixture was asserted directly to `ChartTabState` (TS2352). No production source change was required.

**Test-only correction commit:** `f6f3b65d997a3833c19548d1371dd555c0378ee8`. The partial fixture now uses the explicit `unknown` assertion recommended by TypeScript.

**Corrected code/test run:** [GitHub Actions #42473471100](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42473471100) **SUCCESS**, independently checked from job steps and full logs:
- `npm ci` PASS.
- `npm test` PASS: **233 test files passed / 1 skipped; 1,562 tests passed / 1 skipped / 0 failed**.
- New B20 tests **8/8 PASS**; existing chart tab mutation tests **7/7 PASS**; workspace autosave queue tests **10/10 PASS**.
- `npm run typecheck:renderer` PASS.
- `npm run build:renderer` PASS (Vite 6.50 seconds).
- **Final documented-head CI remains to be checked separately after this docs commit.**

## Risks / limitations / manual validation

- No Windows GUI chart interaction or actual autosave/manual Save checkpoint, native Tauri/Rust, Windows portable build, database access or performance benchmark executed. Numerical equivalence and call counts are unit-tested; full renderer regressions passed.
- Changes to updater invocation count may alter behavior of incorrectly side-effectful updaters, which is precisely the documented defect; review previously accepted chart interactions manually before release.
- One pre-existing skipped Vitest remains. No new dependencies, suppressed tests or source-tree build artifacts.

## Rollback

Before merge, close draft PR #85; GitHub `main` remains unchanged. After separately approved merge, revert the B20 commit with review of intervening changes. No database migration/rollback required.

## Next checkpoint

Verify final-head CI, update B20 issue/master audit register, leave B12/B15/B20 PRs all draft/unmerged for a **separate batch merge approval**. Do not begin B13 or unrelated tasks.

## B12+B15+B20 integration CI checkpoint — 2026-11-08 16:47 IST

The approved B12 and B15 changes are now merged into GitHub `main`:
- B12: PR #83, squash commit `32ba7a68247ca41ca23de07cf45e8e93239a7c57`.
- B15: PR #84, squash commit `e867af13f2d586f4cd5aa4aca97fb304eacb29b3`.

This **documentation-only B20 branch update** is intended to trigger a new `pull_request` renderer CI workflow against the updated `main` with B12+B15 already integrated. The new workflow result must be verified as **SUCCESS** before merging B20. It does not change source code or invalidate the original B20 focused regression results. The combined result is **pending** at the time of this commit; no CI result is presumed.

# CA Safe V2 outcome test harness — pending Review snapshot reference

**IST timestamp:** 2026-11-02 00:42 IST  
**Workstream:** EOD Charting Platform  
**Authorized local source root:** `E:\TA Projects\EOD Charting Platform` (not mounted in this session)  
**Source authority:** GitHub `dhamnaik-lab/Eod-Charting-Platform`, `main` at `da63ccb3d9abf33e6d4f00f60d5a6ded5e882370`.  
**Repair branch:** `fix/ca-pr4-safe-v2-outcome-harness-20261102` — do not modify or merge `main` directly.

## Objective / previous failure

Address one bounded related failure group in the prior Windows Corporate Actions regression evidence `EOD_CA_PR3_VALIDATION_20261101_235107_IST.zip`: the Safe V2 outcome observability tests (R9–R16, 8 failures). The tests extract and execute the live `loadAndPrepareOfficialImports` and `setLoadedImportRows` closures with a small isolated VM binding set. The production handler now uses `pendingReviewRef.current = null` as a pending-review snapshot invalidation guard, but the test harness omitted that reference. The old log showed `ReferenceError: pendingReviewRef is not defined` and an early assertion failure that the outcome was not yet cleared. This is an **isolated test harness defect**, not proof the app's pending Review logic is defective.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts` (whole test)
- `src/components/DatabaseToolsDialogs.tsx` (live ref declaration, Load & Validate handler, pending-review state invalidation, and loaded-row setter)
- Prior user-supplied `02_CorporateActions_Vitest.log` (failing test output) and confirmed prior R1 frontend validation status.
- No pre-existing project documentation read.

## File modified

- `src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts` only:
  - Add an isolated `pendingReview` ref with a deliberately stale test snapshot and inject `pendingReviewRef` into `loadAndPrepareOfficialImports` VM bindings.
  - Expose the ref from the harness and assert the handler clears it immediately when preparation begins.
  - Inject the same ref shape into the separate `setLoadedImportRows` test binding and assert that authoritative reload invalidates it.
  - Retain all existing test expectations for async outcome publication, cancellation, database switching, stale generations, manual approval independence, and no UI injection.

## Behavior changed / preserved

**Production behavior changed:** None.  
**Accepted behavior preserved:** Safe V2 outcomes remain session-scoped, failed preparations remain failed, cancellation and stale response must never publish approval evidence, pending snapshot invalidation remains active, financial approval rules untouched.

No production files, dependencies, databases, configuration, Rust code, or application navigation changed.

## Validation

**Source inspection completed:** GitHub refetch returned updated Git blob SHA-1 `c23a700205035e4c560a35671af30db3f18f5d91`; verified presence of the new VM ref binding, both new assertions, and the matching production `pendingReviewRef.current = null` line. **This is source-presence verification only**, not a test pass.

**Not run:** Vitest (focused or full), TypeScript typecheck, frontend build, Rust tests, Windows runtime. The source checkout and installed project dependencies are not present in this execution environment; do not report passing tests/builds for this repair.

Prior evidence `02_CorporateActions_Vitest.log` reported 21 failures before PR #4's separately verified focused R1 corrections. The remaining failures, including Safe V2 skipped focus, compact layout, dividend observability, identity transaction, and backend Rust, are explicitly outside this bounded fix and not waived.

## Required Windows verification

Verify GitHub Desktop is on the repair branch (not on `main`), with the intended source and a clean worktree. From the authorized project root, execute:

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
npm test -- src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts
npm run typecheck:renderer
npm run build:renderer
```

After a pass, rerun the whole Corporate Actions Vitest suite, collect detailed failures and ensure no unhandled rejections; the broader and Rust qualification gates remain open. Do not merge based on source presence or a narrow test alone.

## Risks and rollback

The VM harness still depends on the live handler's extracted closure structure; future source-level dependencies should be supplied faithfully or tested through stable dependency injection, without weakening guards. Failure to observe snapshot invalidation is a genuine regression and must not be silenced.  

Rollback: revert only the bounded test-file edit on this repair branch. The new change record may be reverted with it. No production data rollback is necessary.

## Next step

Obtain actual focused test/typecheck/build command-output evidence for the repair branch; only then review merge eligibility. Start the next bounded failure group after approval.
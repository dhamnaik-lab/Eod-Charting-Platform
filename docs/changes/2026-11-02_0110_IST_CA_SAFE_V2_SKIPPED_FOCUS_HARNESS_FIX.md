# CA-SAFE-V2-FILTER-R1 — Restore Classic filter bindings in Safe V2 isolated test harness

**IST timestamp:** 2026-11-02 01:10 IST  
**Active workstream:** EOD Charting Platform  
**Authorized Windows project root:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** `dhamnaik-lab/Eod-Charting-Platform` `main` commit `1ae2e29ac34433d8c69aecbbfc62d9010554682c` (merged PR #5).  
**Repair branch:** `fix/ca-safe-v2-skipped-focus-harness-20261102`.  
**Status:** Remote test-only patch committed; Windows test/typecheck/build validation pending. No production implementation was modified.

## Objective and previous defect

The user-provided, SHA-256-verified evidence `EOD_CA_FULL_VITEST_POST_PR5_20261102_005928_IST.zip` reported 524 passing and 11 failing Corporate Actions tests (71 files total). Exactly three failures in `corporateActionSafeV2SkippedFocusFilter.test.ts` (F2, F3, F4) arose from `ReferenceError: classicReview is not defined` when the test evaluated the current `visibleImportRows` closure using an isolated Node VM. Current production filtering also depends on `classicTypeFilters`, `activeCorporateTab`, and `activeOfficialImportSection`, all absent from the old fixture. This was a **test harness binding omission**, not proven erroneous production filtering.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts` (entire test)
- `src/components/DatabaseToolsDialogs.tsx`, `visibleImportRows` memo at approximately lines 2039–2058 (source read-only)
- `01_CorporateActions_Full_Vitest.log` from the user-uploaded previous evidence ZIP, specific F2/F3/F4 errors
- `package.json` scripts verified via connected GitHub
- No existing project documentation read.

## Files modified / created

Modified **only** `src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts`:
- The isolated `visible()` test harness supplies `classicReview: true`, `activeCorporateTab: 'imports'`, `activeOfficialImportSection: 'review'` and all three action types in `classicTypeFilters`. This faithfully represents Classic Pending Review without touching production.
- Extended F3 to assert that backend SKIPPED focus intersects Classic action-type selections: it hides BONUS import 2 when only SPLIT is selected, and shows it when BONUS is selected.
- All prior tests for search, symbol scope, approved view and manual Apply independence remain.

Created this new change record.

## Final implementation and preserved behavior

**Production behavior changed: none.** No automatic approval, financial adjustment, database modification, identity resolution, import parser, network call, dependency, build configuration, user interface or Rust source was changed. The Safe V2 SKIPPED filter must continue to intersect the current user filters, and the Approved view must remain independent of pending Safe V2 focus.

## Validation commands and actual results

**Performed here:** 
- GitHub branch created from the exact `main` commit specified above.
- GitHub write/read-back confirmed the test file contains all four missing fixture bindings and both new Classic action-filter assertions.
- Updated Git blob SHA-1 `0e407cbb243a6b1be682bb06e92d9aaf9f68b10c` (this is a Git blob identifier, **not** a SHA-256 checksum).

**Not executed:** Vitest, TypeScript typecheck, Vite build, Tauri/Rust checks, full Corporate Actions regression, Windows runtime checks. Therefore the three previously failed tests **are not yet certified fixed**.

After safely fetching/checking out the repair branch in GitHub Desktop, run on Windows from the authorized project root:

```powershell
npm test -- src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts
npm run typecheck:renderer
npm run build:renderer
```

Maintain exact console logs, source hashes, and timestamped downloadable evidence. Do not merge until actual command output confirms success. Broader 8 remaining Vitest failures, previously observed 19 Rust failures, and manual runtime verification remain independently open.

## Risks / limitations

- If the production filter gains another dependency, this extracted-AST harness will need an explicit source-equivalent binding; never bypass the real predicate.
- Vitest focus is not a substitute for broader regression or Windows acceptance.
- This is a test-only repair on a Draft PR; it does not qualify production Corporate Actions financial integrity.

## Rollback guidance

Revert the isolated test modification and this new change record from the review branch (or restore test blob `96a45b33e04f7e01fcef0f2bc98fef3ca31d081d`). Do not touch `main` or production data.

## Next bounded step

Obtain passing focused Vitest/typecheck/build evidence, review and close this bounded repair before pursuing another failure group.
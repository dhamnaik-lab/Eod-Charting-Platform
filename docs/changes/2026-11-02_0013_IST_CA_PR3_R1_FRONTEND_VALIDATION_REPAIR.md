# CA-PR3-R1 — Focused frontend validation test repair

**IST:** 2026-11-02 00:13 IST
**Active workstream:** EOD Charting Platform
**Authorized project root:** `E:\TA Projects\EOD Charting Platform` (local checkout not available from this session)
**Source authority:** `dhamnaik-lab/Eod-Charting-Platform`, merged `main` commit `a699576ca8d407bf030ae2a268cd44a9b86094fe`.
**Repair branch:** `fix/ca-pr3-r1-frontend-validation-20261102` created from that exact commit.

## Objective / prior defects
On 2026-11-01 IST, the user's pinned Windows validation evidence ZIP `EOD_CA_PR3_VALIDATION_20261101_235107_IST.zip` reported **92 focused Vitest tests passed / 2 failed**, **three TypeScript TS7006 errors**, **21 broader Corporate Actions Vitest failures** and **19 full Rust test failures**. Renderer build, Tauri/Rust check and 4 targeted financial-integrity Rust tests passed in that earlier run. The complete PR was not qualified.

This bounded repair addresses only the two **focused** Vitest test failures and three typecheck diagnostics, without editing production logic.

## Files inspected
- Source tests: `corporateActionPendingPreparation.test.ts`, `corporateActionNormalReviewAdapter.test.ts`, `corporateActionNormalApprovalAdapter.test.ts`, `corporateActionNormalWorkflowAdapter.test.ts`.
- Runtime context read only (not changed): `corporateActionImportOperations.ts` and `corporateActionEconomicEventViewModel.ts`.
- User-supplied ZIP logs read: `01_Focused_Vitest.log`, `03_Renderer_Typecheck.log`, `summary.json`.
- No existing project documentation read.

## Files modified
All paths below are inside `src/features/corporateActions/__tests__/`:
1. `corporateActionPendingPreparation.test.ts`: after reparsing a legacy import into a parsed Dividend, expect one targeted read-only EOD scan of import 91; fake scan returns no evidence so the test still confirms no approval and a failed classification refresh aborts before further scans.
2. `corporateActionNormalReviewAdapter.test.ts`: preserve the actual exception-first event ordering (`NEEDS_REVIEW` before `READY`), and locate the compound event by its authoritative fingerprint rather than its array index; still assert the Split + Bonus economic group has exactly import IDs 1 and 2.
3. `corporateActionNormalApprovalAdapter.test.ts`: annotate callback `importId: number`.
4. `corporateActionNormalWorkflowAdapter.test.ts`: annotate the two callback `id: number` parameters.

No production, Rust, database, or build configuration files modified; no dependencies added.

## Exact behavior changed / preserved
- Only test fixtures, typing, and assertions changed. There are **no production behavior changes**.
- Strict Dividend/Rights EOD-scanning policy, exception-first status ordering, compound event grouping, all-symbol READY default, unverified-identity gating, explicit approval, and financial adjustment guards all remain preserved.
- No automatic approval, network fetching, identity override, or raw-price mutation was added.

## Validation and evidence
**Already executed on previous merged-main source (user evidence; not a result of these edits):**
- Source pin check 17/17 PASS.
- Focused Vitest: 92 passed, 2 failed; failures were outdated scan expectation and ordering assertion.
- Renderer typecheck: exit 2; exactly three TS7006 callback parameter diagnostics in these two tests.
- Renderer build PASS; Tauri/Rust check PASS; financial-integrity focused Rust tests PASS.
- Broader Corporate Actions Vitest: 21 failed; full Rust suite: 19 failed.

**Executed this session (new repair branch):**
- GitHub fetched the exact merged-main sources; updated four isolated test files using exact anchor replacement.
- GitHub refetched all four files and confirmed the intended code signatures. GitHub content blob SHA-1 (not SHA-256):
  - `corporateActionPendingPreparation.test.ts` `54433b60205685f694664959664d5022de15fd5b`
  - `corporateActionNormalReviewAdapter.test.ts` `ffe4edf40e2159c1c5d0b2165bf6d213e1a2a6d1`
  - `corporateActionNormalApprovalAdapter.test.ts` `742f0baa0af748544c98fe62d87714e8cec05903`
  - `corporateActionNormalWorkflowAdapter.test.ts` `bc1570114f2fa0cb6217f85dccc956d1589df31a`

**NOT EXECUTED on this new branch:** Vitest, TypeScript typecheck, Vite build, Rust tests/check, Windows application runtime verification. Do not mark them as passed without new command-output evidence. No local source checkout or installed project dependencies are available in the current execution context.

## Next required validation on authorized Windows checkout
First use GitHub Desktop to switch to this repair branch and pull/fetch it; ensure the worktree is clean and matches the GitHub branch. Run:

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
npm test -- src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts src/features/corporateActions/__tests__/corporateActionNormalReviewAdapter.test.ts src/features/corporateActions/__tests__/corporateActionNormalApprovalAdapter.test.ts src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts
npm run typecheck:renderer
npm run build:renderer
```

Then rerun the remaining focused PR #3 suites before approving this bounded correction. Full Corporate Actions Vitest and Rust failures remain separately open until corrected and validated.

## Risks / limitations
- The four test repairs are source-verified only. TypeScript and behavioral correctness require real execution.
- The 21 broader Vitest failures and 19 Rust failures are **not** waived, reclassified, or asserted pre-existing.
- The test suite explicitly exercises no approval from the read-only scan even when successful classification makes a Dividend eligible for scanning.

## Rollback
Revert the four bounded test-only commits on the repair branch or restore the files to their prior `a699576` Git blobs. Do not reset production data, alter unrelated source, or undo accepted merged-main behavior.

## Closeout
Implementation of this bounded test correction is source-committed. **Qualification remains OPEN** until the specified command outputs and review are obtained.

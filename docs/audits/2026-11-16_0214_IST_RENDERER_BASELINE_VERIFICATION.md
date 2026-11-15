# Renderer baseline verification — Corporate Actions and identity recovery

- **Timestamp (IST):** 2026-11-16 02:14:12 +05:30
- **Workstream:** EOD Charting Platform, local root `E:\\TA Projects\\EOD Charting Platform` (not accessed)
- **GitHub source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main@42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Branch:** `test/baseline-regressions-20261116`
- **Scope:** Documentation-only CI baseline check; **zero production, test, build, or configuration file edits**.

## Objective

Determine whether the two failures observed in F-01 draft PR #104 also occur when the exact `main` source and locked dependencies are tested unchanged. Do not make any fix until independently verified.

## Prior CI evidence

F-01 PR #104, corrected source commit `8276f723a505099fb793742a0df760d30e1d8027`, [renderer run 43756539811](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43756539811), reported:

- **Vitest:** 1,830 passed, 2 failed, 1 skipped.
- **Renderer typecheck and build:** passed.
- **F-01 tests:** 7/7 passed; price legend index-gap tests: 9/9 passed.
- Two failures in `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts` and `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`.

Those tests and their relevant source files were unchanged by PR #104; nevertheless, a separate `main` CI is required to prove the baseline.

## Method

1. Branch from exact `main` commit above (no merge/pull of F-01 or F-52).
2. Add only this evidence file to trigger the repository's existing pull-request Renderer CI.
3. Compare the branch with the exact baseline and verify this document is the **only** diff.
4. Record the GitHub Actions renderer run and actual test/typecheck/build results.
5. Leave this PR draft and unmerged. Investigate each failure in a separate bounded task only if the baseline reproduces it.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts`
- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`
- `package.json`
- GitHub commit search, PR #104 CI results.

## Initial failure signatures

- **Corporate Actions:** test `scans Dividend/Rights for local EOD readiness without requiring imported factors` expects `{loaded: 3, ready: 2, needsReview: 1, conflicts: 0}`, but PR CI reports `needsReview: 2` instead of `ready: 2`. Financial readiness/approval behaviour must not be changed merely to satisfy this test.
- **Identity recovery:** test `requires explicit review and operator confirmation before applying a rollback` expects `window.confirm(` before the rollback API call. An existing modal-confirmation refactor may have replaced that invocation. Safety of confirmation must be verified from the actual component before a test or code change.

## Current baseline validation

**Confirmed — GitHub Renderer CI [run 43759843377](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43759843377)** at documentation-only head `bd28578add1b0c1d493916f2b6dd7f3e0fb3cdc5`:

- Full `npm test`: **FAIL**, 1,826 passed, 2 failed, 1 skipped (263 files passed, 2 failed, 1 skipped; 266 total).
- `npm run typecheck:renderer`: **PASS**.
- `npm run build:renderer`: **PASS**, Vite built in 5.32 seconds.
- Failing test 1: `src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts:308` — `scans Dividend/Rights for local EOD readiness without requiring imported factors`.
- Failing test 2: `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts:136` — `requires explicit review and operator confirmation before applying a rollback`.
- GitHub compare baseline-to-branch: **1 changed documentation file only**. All production, test, dependency and build files were identical to the pinned source authority.
- Consequently both failures are confirmed on the unmodified main source and are **not introduced by F-01 PR #104**. PR #104 reported 1,830 pass / 2 fail / 1 skipped because four new F-01 tests passed.
- Actual CI source execution evidence is GitHub Actions, not local Windows. No local Node, Rust, Tauri, portable, production-database or manual checks were executed.

**Correction strategy:** Do not weaken Rights term verification or rollback confirmation. Separately verify the test expectations against accepted implementation, then correct the stale contract assertions or fixtures in bounded, reviewable branches. This baseline-verification PR remains draft and must not be merged.

## Preservation, risks, rollback

All application and test behaviour is intentionally preserved. The only added repository file is this read-only audit evidence. Do not merge the verification branch. If the CI comparison is invalid, discard the branch/PR without affecting `main`. No automatic database modification or financial action is permitted.

## Follow-up

Once actual CI output is available, update this evidence with run IDs, pass/fail counts, and a conclusion. Do not conflate a baseline reproduction with authorization to change the underlying Corporate Actions or rollback protections.

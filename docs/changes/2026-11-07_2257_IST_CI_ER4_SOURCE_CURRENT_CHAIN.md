# CI-BASELINE-03 — ER4 Source Recovery assertion (current chain)

**IST timestamp:** 2026-11-07 22:57 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized Windows root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**GitHub:** `dhamnaik-lab/Eod-Charting-Platform`
**Main source baseline:** `44bbf2126aa66484dcdcad13b23d6276a3ad821f` (unchanged)
**Current parent:** draft PR #66 head `3451f21fb6ffd770a291412c9419dd9369e433c3`, whose chain is #56 → #64 → #66
**Existing issue:** #61 (the same issue had already been implemented in parallel draft PR #62)
**Current-chain draft PR:** #67
**Focused test commit:** `1d059396b09b7cb6c88737602be75c9c19c382f3`

## Objective / previous limitation

The final baseline renderer failure was a stale source-text assertion in `identityEr4SourceRecovery.test.ts:153`: it looked for the label `Find Official Replacement Candidates` inside `DatabaseToolsDialogs.tsx`, but the action had moved into `src/features/corporateActions/identity/IdentitySourceHealth.tsx` during accepted UI componentization. The parent still correctly gates discovery via five eligible NSE source mappings and callback wiring. This was a stale test assumption, **not a confirmed runtime/source-recovery defect**.

## Source authority, duplicate-branch conflict and decision

Before editing, the current GitHub `main`, draft PRs #56/#64/#66, original test blob, `IdentitySourceHealth`, parent recovery mapping, and previous CI failures were checked. GitHub also contained **parallel draft PR #62** with exactly this correction (issue #61), already green in a separate #56 → #58 → #60 → #62 branch chain. The parallel chain's #60 retained legacy dynamic JSX execution; our current #66 instead uses direct component-based ER4 history tests. To keep the current history-test improvements, this bounded action **reused the exact PR #62 test patch and resulting file content**, rather than designing another fix. Both branch chains remain drafts; do not merge both or close either chain without approval.

## Files changed

- **Modified:** `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`.
- **Created:** `docs/changes/2026-11-07_2257_IST_CI_ER4_SOURCE_CURRENT_CHAIN.md` (this record).
- **Unchanged:** production application source, UI, CSS, backend, identity/rollback authority, dependencies, lockfile, GitHub Actions workflow, native code and database.
- Prior test Git blob `eac66b673a5a72a33974cedd76070db7c32c3952`; new test blob `8ecea739e12573cc752b61beb25d4e1ffe3efa1a`, byte-for-byte identical to independently checked PR #62 test file.

## Final implementation

- Add a source path for `IdentitySourceHealth.tsx` to the static test.
- Assert that the action label exists **in that child component**, is displayed only under `canRecover(selected)`, and invokes `onRecover(selected)`.
- Assert that the parent `DatabaseToolsDialogs.tsx` still uses `getEr4RecoveryRequestForHealthResult(result)` for `canRecover` and invokes `findOfficialReplacementCandidates(result)` from `onRecover`.
- Preserve tests for the exact five NSE health mappings, absence of `NSE_DELISTED_LANDING` and BSE, and every other ER4 ledger/promotion/rollback safety assertion.
- No tests were skipped, weakened by blanket exclusion, or deleted.

## Validation commands and actual results

**First current-chain CI:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42396277777

| Verification | Actual output |
|---|---|
| GitHub source and blob SHA inspection | **PASS**; base/source authority confirmed, exact test diff matches PR #62's proven patch |
| GitHub checkout, Node 24 setup, `npm ci` | **PASS** in run #42396277777 |
| `npm test` (Vitest complete renderer) | **PASS**: 220 test files passed, 1 skipped; **1,457 tests passed, 1 skipped, 0 failed** |
| `identityEr4SourceRecovery.test.ts` | **PASS: 15/15** in full suite (16 ms) |
| `identityEr4HistoryVisibility.test.ts` | **PASS: 6/6** in full suite (9 ms) |
| `sidebarKeyboardFocus.test.ts` | **PASS: 3/3** in full suite (2 ms) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**, Vite build log 4.67 seconds |
| Standalone focused Vitest invocation | **NOT RUN**; all targeted suites actually executed within full Vitest |
| Native/Rust, Windows portable build, installed GUI, real database, real official network or source recovery | **NOT RUN** (outside this test-only task) |

**IMPORTANT:** The documentation commit changes the branch head SHA and triggers a second GitHub Actions run. That run's actual result must be checked independently before approving this draft PR; the first run cannot be presented as validation of a later commit.

## Accepted behavior preserved

Existing tabbed Identity workspace, health Details modal, strict NSE-only candidate discovery mapping, BSE exclusion, operator-reviewed promotions/rollbacks, safe history and no auto-apply, plus all chart, indicator, workspace and other EOD behavior remain unchanged. The source-recovery action still appears only when the selected source is eligible. The correction is solely a test-location and wiring-assertion update.

## Risks and limitations

- The test asserts source contracts, not actual UI clicking or live API/database operation; it is not end-to-end Corporate Actions certification.
- This branch is stacked on two other unmerged test-fix drafts and the unmerged CI workflow. Even with a green CI run, `main` itself has not received these corrections.
- There are parallel duplicate draft chains (#58/#60/#62 and #64/#66/#67). Consolidate and close superseded drafts only after approval; do not merge both independently.
- Windows manual UI acceptance and Rust/native packaging were not performed because no runtime/backend files were changed.

## Rollback and closure

Before merging, close PR #67 and discard only its isolated branch. If later merged, revert the test-only assertion and this change record through a reviewed PR. Retarget PR #67 to the current parent branch `fix/ci-er4-history-component-tests-20261107` after its final-head CI is verified. Do not change production UI to placate obsolete tests; do not auto-merge. Next separate task is consolidation of duplicate draft PR chains and explicit approval for merge.

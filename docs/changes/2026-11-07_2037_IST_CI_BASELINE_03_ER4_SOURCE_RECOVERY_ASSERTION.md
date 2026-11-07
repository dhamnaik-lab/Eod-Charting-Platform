# CI Baseline 03 — ER4 source recovery action test

**Timestamp:** 2026-11-07 20:37 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform  
**Authorized local root (not accessed):** `E:\TA Projects\EOD Charting Platform`  
**Repository:** `dhamnaik-lab/Eod-Charting-Platform`  
**Main source baseline:** `44bbf2126aa66484dcdcad13b23d6276a3ad821f`  
**Parent:** CI Baseline 02 PR #60, `a31c07fa5787e6412ecacdd15c5e93fa88583824`  
**Branch:** `fix/ci-er4-source-test-20261107`  
**Issue:** #61; **Draft PR:** #62  
**Test-only correction commit:** `b250b9eeec7b52835f00cc01dff8d2cab3d247f8`

## Objective and previous limitation

One remaining test, `identityEr4SourceRecovery.test.ts`, expected `DatabaseToolsDialogs.tsx` to contain the literal button label `Find Official Replacement Candidates`. The current implementation renders that button inside the dedicated `IdentitySourceHealth.tsx` child component, with a parent mapping guard and callback wired in `DatabaseToolsDialogs.tsx`. The assertion followed the obsolete source location, not current behavior.

## Files inspected first

- `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`
- `src/features/corporateActions/identity/IdentitySourceHealth.tsx`
- `src/components/DatabaseToolsDialogs.tsx`, specifically `getEr4RecoveryRequestForHealthResult` and `renderOfficialSourceHealthPanel`
- Existing identity-history suite, project `AGENTS.md`, prior B00 CI runs

## Files created/modified

- **Modified:** `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts` (one scope-specific test function; static test source only).
- **Created:** `docs/changes/2026-11-07_2037_IST_CI_BASELINE_03_ER4_SOURCE_RECOVERY_ASSERTION.md` (this report).
- **Application UI source, Rust/backend, identity authority, database, scripts, dependencies, CI, installed binaries, packaging and CSS:** unchanged.
- PR #62 is stacked after drafts #56 → #58 → #60. Inherited changes are dependencies only, not part of this bounded correction.

## Final implementation

- Read the dedicated `IdentitySourceHealth.tsx` implementation in the existing source-text test.
- Verify the label in the actual child component, plus `canRecover(selected)` gating and `onRecover(selected)` callback.
- Verify the parent `DatabaseToolsDialogs.tsx` still supplies `getEr4RecoveryRequestForHealthResult(result)` as the `canRecover` condition and `findOfficialReplacementCandidates(result)` as the callback.
- Preserve all original assertions for **exactly five NSE source mappings**, explicit rejection of `NSE_DELISTED_LANDING` and BSE, and existing approval and review separation; do not disable or skip any test.

## Validation performed — actual result

**[GitHub Actions run #42384632761](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42384632761)** at test commit `b250b9eeec7b52835f00cc01dff8d2cab3d247f8`:

| Validation | Actual result |
|---|---|
| Checkout / Node.js 24 / `npm ci` | **PASS** |
| `identityEr4SourceRecovery.test.ts` | **PASS, 15 tests** |
| `identityEr4HistoryVisibility.test.ts` | **PASS, 6 tests** |
| `sidebarKeyboardFocus.test.ts` | **PASS, 3 tests** |
| `themeContrast.test.ts` | **PASS, 9 tests** |
| Full `npm test` | **PASS: 220 test files passed, 1 skipped; 1,457 tests passed, 1 skipped (1,458 total), 0 failed** |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**; Vite build log 6.86 seconds |
| Windows manual UI, Rust/Tauri test harness, native portable build, DB/official network access | **NOT RUN** (out of scope) |

**Important:** The documented PR head will have a new SHA after this change record is committed. Its separate GitHub Actions run must be checked before PR approval. No passing result is inferred for that future run.

## Behavior preserved

The source-recovery eligibility guard, exact NSE mappings, absence of BSE approval, explicit operator approval before promotion/rollback, existing candidate decision logging, and all chart/domain behavior are preserved. This is a static test-alignment change, not a production calculation/financial workflow change.

## Risks and limitations

- The test validates source declarations/wiring, not rendered user actions or a native app. Do not treat source-text tests alone as end-to-end Corporate Actions certification.
- The accepted extracted component could later move again; this test will need maintenance then, but it now guards both component display and parent's safety wiring.
- PRs #56, #58, #60 and #62 are dependent drafts; they must be reviewed and merged in correct order only after approval. No automatic merge, protection-rule changes, or local working tree actions.
- The existing skipped test remains skipped; it was not changed or newly excluded.

## Rollback

Before merge, close this draft PR and stop using its isolated branch. If subsequently merged, revert only the source-recovery test and this IST record through a reviewed correction. Do not change the actual identity source-health UI to satisfy an obsolete assertion. Retain CI run URLs and hashes for reproducibility.

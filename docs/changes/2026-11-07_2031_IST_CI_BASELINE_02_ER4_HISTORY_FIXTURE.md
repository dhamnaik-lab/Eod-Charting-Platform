# CI Baseline 02 — ER4 history fixture aligned to Identity diagnostics

**Timestamp:** 2026-11-07 20:31 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform  
**Authorized local root (not accessed):** `E:\TA Projects\EOD Charting Platform`  
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`  
**Main source baseline:** `44bbf2126aa66484dcdcad13b23d6276a3ad821f`  
**Dependent parent:** CI baseline 01 draft PR #58, `ce66e47a9cfbef8773c0748d601399d32760dab5`  
**Issue:** #59; **draft PR:** #60  
**Test correction commit:** `548a8a9d6c536e1b2c699a8aefe2738228e4b786`

## Objective and previous defect

The six cases in `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` failed with `ReferenceError: IdentityImportWorkspace is not defined`. The test built an isolated JSX AST fixture around the old monolithic `renderIdentityTab`, but current UI mounts `IdentityImportWorkspace` and supplies the actual source-panel rollback and history features in its diagnostics view. Tests should verify existing behavior without requiring the old root style or faking a React UI.

## Files inspected

- `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts`
- `src/components/DatabaseToolsDialogs.tsx`, specifically `renderOfficialSourceHealthPanel`, `renderIdentityTab`, rollback buttons and eligibility checks
- `src/features/corporateActions/identity/IdentityImportWorkspace.tsx`, `identityImportWorkspace.css`
- `src/features/corporateActions/identity/IdentitySourceHealth.tsx`, `IdentitySourceHistory.tsx`
- Existing B00 CI failures, `AGENTS.md`, and repository validation guidance

## Files created or modified

- **Modified (test-only):** `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` — 5 small fixture/assertion adjustments; 188 to 193 lines.
- **Created:** `docs/changes/2026-11-07_2031_IST_CI_BASELINE_02_ER4_HISTORY_FIXTURE.md`.
- **Production source, CSS, API, database, CA approval/rollback, dependencies, package scripts, CI workflow, Rust and portable packaging:** **unchanged by this bounded task**.
- This branch is stacked after #58 and #56; inherited prior changes are not part of this issue's differential.

## Final implementation

- Evaluate `renderOfficialSourceHealthPanel` directly from its current production AST with existing read-only fixtures, rather than invoking retired monolithic `renderIdentityTab` as a fake JSX root.
- Pass imported child components as **opaque JSX tags**, not simulated business logic, avoiding any hook, desktop API, source fetch or database invocation.
- Replace the old `overflowY` root-style assertion with checks that actual `IdentityImportWorkspace` routes diagnostics to the source panel and that identity-specific CSS bounds the workspace while allowing diagnostics scrolling.
- Preserve the original tests for zero-candidate messaging, eligible prior-version rollback button count, active/BSE/ineligible rollback exclusion, reviewed rollback dormant status, no-discovery/empty-history cases, and untouched shared Corporate Actions tab layout. No assertions were simply removed to obtain a pass.

## Validation performed — actual command results

**[GitHub Actions run #42384119998](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42384119998)** at test commit `548a8a9d6c536e1b2c699a8aefe2738228e4b786`.

| Check | Actual result |
|---|---|
| Checkout, Node.js 24, `npm ci` | **PASS** |
| `identityEr4HistoryVisibility.test.ts` within full Vitest | **PASS, 6/6** |
| Sidebar focus and theme contrast accepted tests | **PASS** in full suite |
| Complete `npm test` | **FAIL overall**: 1 failed, 219 passed, 1 skipped files (221); 1 failed, 1,456 passed, 1 skipped tests (1,458) |
| Remaining failure | `identityEr4SourceRecovery.test.ts` expects old `Find Official Replacement Candidates` source text in `DatabaseToolsDialogs.tsx`; the action now belongs to `IdentitySourceHealth.tsx` |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS** (Vite build 6.43 s) |
| Windows UI, manual keyboard checks, Rust/Cargo, native packaging, databases | **NOT RUN** (outside test-only scope) |

The full suite remains red on the final independent source-recovery suite. A new GitHub Actions run is expected after this document commit; its outcome must be checked separately.

## Behavior preserved and scope

No financial approval, source replacement, rollback, network/download, chart state or database logic is changed. No automated candidate promotion or reviewed rollback is invoked. The diagnostic view remains isolated, the CSS scroll owner remains its actual workspace, and other Corporate Actions tabs retain their layout.

## Risks, limitations and follow-up

- The AST source fixture verifies JSX and presentation conditions but is not a native Windows runtime or mounted React DOM test. The layout checks use actual CSS text, not screenshots.
- The imported `IdentitySourceHealth` and `IdentitySourceHistory` JSX child components are intentionally opaque in this fixture; their own source behavior must be covered separately.
- PR #60 remains draft and should be retargeted from `main` to PR #58's branch after exact-head CI validation. Do not merge or require baseline checks until the remaining failing suite is resolved.
- No dependencies added, existing data/approval contracts preserved.

## Rollback

Close the isolated draft PR without merge. After merge, revert only this test-harness update and change record in a reviewed PR; never remove the accepted Identity workspace or rollback gating to accommodate an old test. Retain the CI run URL and pinned hashes as evidence.

# CI-BASELINE-02 — ER4 history-visibility test harness updated for tabbed workspace

**Timestamp:** 2026-11-07 22:44 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized Windows root (not accessed):** `E:\TA Projects\EOD Charting Platform`
**Repository:** `dhamnaik-lab/Eod-Charting-Platform`
**GitHub baseline:** `main` at `44bbf2126aa66484dcdcad13b23d6276a3ad821f`
**Stacked branch origin:** PR #64 head `85ff9a99ec3228d4818ec8e459e93689cbd7a71f` (includes draft B00 PR #56)
**Issue:** #65; **draft PR:** #66

## Objective and original defect

The six tests in `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` all failed in the B00 renderer CI with `ReferenceError: IdentityImportWorkspace is not defined`. Their September fixture extracted a JSX closure from the main `DatabaseToolsDialogs.tsx`, transpiled it and invoked it using `new Function`, without preserving the imported component. The current Identity UI is a separate tabbed React workspace, not the older inline root; adding one missing mock would not restore meaningful coverage.

## Files changed

- **Modified:** `src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` (test-only; 188 lines replaced with 166 lines).
- **Created:** `docs/changes/2026-11-07_2244_IST_CI_ER4_HISTORY_COMPONENT_TESTS.md` (this record).
- **Existing application/backend/CSS/dependency files modified:** **none**.
- Original test blob: `3935942a723fdaef92a246cd40a2b6fe954bfd2e`; replacement test blob: `6b859fac153850acc20dec8a15a1c24378419803`.

## Final implementation

Remove the test-only dynamic source evaluation. Use existing React `createElement` and `renderToStaticMarkup` to render actual `IdentityImportWorkspace`, `IdentitySourceHistory`, and `SourceHistoryContent` with an offline, read-only fixture and a mocked history loader. Retain six source/current-component regression contracts:

1. Bounded Identity diagnostics scroll ownership (CSS, selected diagnostics tab, responsive overflow).
2. Independently reachable saved source history before candidate-only review; rendering triggers neither load nor mutation.
3. Candidate rollback review still requires an inactive prior `VERSION`, NSE authority and `candidatePromotionEligible` before displaying its action.
4. Reviewed rollback requires a separate explicit review and operator `window.confirm` before backend apply.
5. Saved-source history renders distinct idle, loading, error, empty and loaded states; read-only history never creates an Apply control.
6. Imports, Scan and Issues retain the shared Corporate Actions panel style, separate from Identity-specific layout.

Items 3–4 use deliberately narrow *source-contract* assertions because candidate rollback callbacks remain inside `DatabaseToolsDialogs`; they do not simulate an actual database-backed rollback or certify real click paths. Do not weaken these guards or expose rollback from the independent read-only history without separate approved requirements.

## Behavior preserved

Original app source is unchanged: NSE/BSE filtering, historical/version history, review/promotion authority, confirmation, no automatic rollback, transaction semantics, UI layouts, keyboard focus, data integrity and charting behavior. No new dependencies, runtime commands, network sources or database APIs were introduced. The first CI run used only GitHub-hosted test dependencies via the pre-existing `npm ci` workflow.

## Validation — actual commands, outputs and evidence

**GitHub Actions first run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42395131978
**Test-only commit:** `a25c622b03ee93a6b2e95cc1ac59e630ae09afa3`.

| Check | Actual result |
|---|---|
| Source authority/branch/blob confirmation | PASS, correct pin and test-only diff at first commit |
| Static checks of CSS, independent history placement, explicit eligibility and rollback actions | PASS (source-level; not a runtime browser/DB test) |
| Original six ER4 history-visibility tests | **PASS 6/6**, 19 ms, via `npm test` full GitHub Actions run |
| Existing `identityImportWorkspace.test.tsx` | **PASS 7/7** |
| Existing `identitySourceHistory.test.tsx` | **PASS 8/8** |
| Existing `corporateActionIdentityOfficialSourceHealthUsability.test.ts` | **PASS 4/4** |
| Existing `corporateActionIdentityCompactWorkspace.test.ts` | **PASS 8/8** |
| `npm ci` | PASS |
| `npm test` (Vitest full renderer) | **FAIL overall:** 1 failed, 219 passed, 1 skipped test file (221); **1 failed, 1,456 passed, 1 skipped** tests (1,458) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**, Vite build 6.37 s |
| `npm test -- src/features/identityRecovery/__tests__/identityEr4HistoryVisibility.test.ts` as standalone command | NOT RUN; suite executed and PASSED within full Vitest |
| Rust, database, network data, installed Windows/portable build, keyboard/scroll manual checkpoint | NOT RUN — outside test-only scope |

**Known unrelated failure, not corrected under #65:** `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`, one source-string expectation concerning `Find Official Replacement Candidates`. All 6 history failures are resolved in the tested branch, but GitHub CI remains **RED**, not release-certified.

## Risks and limitations

- SSR validates markup, selected view, offline read-only history and accessibility structural attributes; it cannot prove actual browser scrolling, resize or keyboard focus at Windows DPI levels.
- Rollback eligibility and confirmation conditions use source-level checks, not synthetic invocations of the real huge React/Tauri component. A full application UI + mocked API interaction test would require a separately approved integration harness if needed.
- No production/real database, source refresh, network probe, rollback Apply or local Windows checkout was accessed.
- The prior CI workflow and sidebar fix are still two separate unmerged draft PRs; this child PR is stacked on both. Do not infer `main` is fixed.
- A subsequent documentation commit can trigger another CI run; that new exact SHA must be independently checked before PR acceptance.

## Rollback and next step

Before merge: close draft PR #66 and discard only its child branch. Since the work is isolated, original `main` and draft parents remain unaffected. If merged later, revert the single test change through a reviewed PR; retain evidence and do not modify production Identity logic to satisfy an old test. Next bounded issue is the single `identityEr4SourceRecovery.test.ts` failure, subject to separate inspection/approval. Do not merge #66 automatically.

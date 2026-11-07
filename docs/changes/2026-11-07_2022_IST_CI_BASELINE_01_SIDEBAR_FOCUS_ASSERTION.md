# CI Baseline 01 — Sidebar keyboard-focus assertion

**Created:** 2026-11-07 20:22 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform  
**Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not accessed)  
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`  
**Base main:** `44bbf2126aa66484dcdcad13b23d6276a3ad821f`  
**Dependent source baseline:** draft PR #56 @ `c205d3c56b99e76ba22c7b9e898fa8eed73baea1`  
**Branch:** `fix/ci-sidebar-focus-test-20261107`  
**Issue:** #57; **Draft PR:** #58

## Objective and previous defect

Correct one stale **test assertion** in the renderer's existing sidebar focus-visibility regression suite. The original assertion required `button:focus-visible` to use `var(--accent)`, but accepted UX-12 CSS now intentionally uses `var(--focus-ring, var(--accent))` for theme-specific high-contrast focus rings. Two actual B00 GitHub runs failed this assertion while preserving existing CSS. Reverting CSS would regress the accepted theme contrast.

## Files inspected

- `src/features/app/__tests__/sidebarKeyboardFocus.test.ts` — complete 27-line test
- `src/styles/global.css` — focus rules, the refined-light selector and shared theme tokens
- `src/features/app/__tests__/themeContrast.test.ts` — seven-theme contrast tests and exact focus fallback token expectations
- `.github/workflows/renderer-ci.yml` (dependency inherited from draft PR #56)
- `AGENTS.md`, `REQUIREMENTS.md`, package.json and prior B00 run results (source and validation guidance)

## Files changed

- **Modified:** `src/features/app/__tests__/sidebarKeyboardFocus.test.ts`, one regex assertion.
- **Created:** `docs/changes/2026-11-07_2022_IST_CI_BASELINE_01_SIDEBAR_FOCUS_ASSERTION.md` (this record).
- **No application source, CSS, indicator, database, native, dependency, CI workflow or packaging changes** in this bounded task.
- PR #58 initially targets `main` to trigger the not-yet-merged CI workflow; its branch inherits PR #56's two B00 files **unchanged**. Retarget base to the PR #56 branch after validation to display only this correction.

## Final implementation

Require `button:focus-visible` to reference the theme-aware `var(--focus-ring, var(--accent))` value. All other assertions and test suites remain unchanged. This updates the test to reflect the existing accepted design; it does not modify the CSS.

## Actual validation results

**[GitHub Actions run #42383474979](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42383474979)** on test-only commit `d7cea1210291b130de047e8d4bd7b734fd7db4de`.

| Check | Actual result |
|---|---|
| GitHub workflow checkout/Node 24/`npm ci` | **PASS** |
| `src/features/app/__tests__/sidebarKeyboardFocus.test.ts` within full Vitest | **PASS**, 3 tests |
| `src/features/app/__tests__/themeContrast.test.ts` within full Vitest | **PASS**, 9 tests |
| Complete `npm test` | **FAIL overall**, 2 files failed / 218 passed / 1 skipped; **7 tests failed / 1,450 passed / 1 skipped (1,458 total)** |
| Seven remaining failures | **6** `identityEr4HistoryVisibility.test.ts` (`IdentityImportWorkspace` undefined); **1** `identityEr4SourceRecovery.test.ts` (expected source text not present) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**; log reports Vite build in 5.03 s |
| CSS structural token check against actual GitHub source | **PASS**, exact updated regex matches the focus rule |
| Local Windows, screen reader, keyboard/DPI, Rust, database, portable builds | **NOT RUN**, outside test-only scope |

**Result:** the single targeted failing test is repaired and verified, while the CI suite remains red on two separate pre-existing identity-recovery suites. This record does **not** mark the full baseline or PR merge-ready.

## Behaviour preserved

All accepted CSS/UX-12 focus contrast, focused-vs-pointer suppression, refined-light sidebar ring, seven-theme appearance, chart and CA logic, alert behavior, drawing geometry, quote/data identity and workspace state remain exactly unchanged.

## Risks and limitations

- The test checks CSS source text, not a rendered browser/screen-reader focus ring. The separate contrast test passes, but actual Windows visual acceptance has not been performed.
- PR #58 is stacked on unmerged PR #56, and `main` remains unchanged. It must not be merged directly while its inherited CI changes are unreviewed.
- Two unrelated failing identity recovery suites still prevent all-tests PASS. Do not skip/exclude tests to force a green CI result.
- A CI rerun after this documentation commit is required to verify the new PR-head commit separately; report its real status before closing.

## Rollback

Close draft PR #58 without merging to leave `main` and PR #56 untouched. If eventually merged, revert only the changed test assertion and this record via a separately reviewed PR; do **not** revert the accepted theme CSS. Preserve GitHub run links and commit hashes as evidence.

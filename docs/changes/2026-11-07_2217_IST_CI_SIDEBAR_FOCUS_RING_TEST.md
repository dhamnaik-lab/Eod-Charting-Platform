# CI-BASELINE-01 — Sidebar keyboard focus-ring test contract correction

**IST timestamp:** 2026-11-07 22:17 IST (UTC+05:30)
**Workstream:** EOD Charting Platform
**Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not accessed)
**Pinned application source:** GitHub `main` at `44bbf2126aa66484dcdcad13b23d6276a3ad821f`
**CI parent:** B00 draft PR #56 at `c205d3c56b99e76ba22c7b9e898fa8eed73baea1` (same application source)
**Issue:** #63; **isolated branch:** `fix/ci-sidebar-focus-ring-test-20261107`

## Objective / previous defect

The B00 GitHub renderer CI runs #42382741871 and #42382982395 failed the existing `sidebarKeyboardFocus.test.ts` test `retains the shared accent focus ring for all themes`. The test expected a direct `var(--accent)` CSS value, but accepted `global.css` uses `var(--focus-ring, var(--accent))` for a theme-specific focus colour with an accent fallback. The `refinitiv-dark` theme deliberately supplies `--focus-ring: #38bdf8`.

This is a stale **test expectation**, not evidence that the focus ring is visually absent. Correct the assertion without changing the runtime CSS or application behavior. The separate identity-recovery test failures remain out of scope.

## Files changed

- **Modified:** `src/features/app/__tests__/sidebarKeyboardFocus.test.ts` (test expectation only).
- **Created:** `docs/changes/2026-11-07_2217_IST_CI_SIDEBAR_FOCUS_RING_TEST.md` (this record).
- **Unchanged:** `src/styles/global.css`, `src/components/Sidebar.tsx`, all application/indicator/Rust/data files, `package.json`, `package-lock.json`, and B00 CI workflow.

## Final correction

- Require `button:focus-visible` to retain a 2px outline using `var(--focus-ring, var(--accent))`.
- Check that `[data-theme="refinitiv-dark"]` declares a hexadecimal `--focus-ring` override.
- Preserve the original pointer-only suppression, refined-light sidebar white halo and outline offset assertions.
- This revision strengthens test coverage of the actual theme-aware focus contract rather than deleting the failing test.

## Behavior preserved

No executable styles, layout, rendering, keyboard shortcuts, mouse behavior, active indicator, persisted user settings, chart loading, or database behavior was modified. Focus ring remains a visible keyboard outline with theme override/fallback; pointer focus remains suppressed and refined-light retains its white halo.

## Validation commands and actual evidence

| Check | Actual status |
|---|---|
| GitHub source/CI failure inspected at immutable base | **PASS** — observed original `var(--accent)` mismatch in first B00 run log |
| Static JS assertion against exact checked GitHub CSS | **PASS** — old test matcher fails; new matcher passes; theme override present |
| Static negative-control check (replace `button:focus-visible` with `button:focus`) | **PASS** — new matcher rejects missing focus-visible selector |
| Updated GitHub test blob verified after commit | **PASS** — `74c721214b678257c6121768cbf7ecfd6cf6928c` |
| `npm test -- src/features/app/__tests__/sidebarKeyboardFocus.test.ts` | **NOT RUN as a separate command**; full GitHub Vitest suite executed this exact file: **PASS (3/3)** |
| Full GitHub renderer CI against this change | **FAIL overall:** run #42393143002 on `ff9823c064e651f8b2650516c644be44374f433b`: 7 failed, 1,450 passed, 1 skipped; focus suite 3 passed |
| `npm run typecheck:renderer` / `npm run build:renderer` | **PASS / PASS** in run #42393143002 (Vite build 3.95 s) |
| Rust, Tauri Windows portable build, keyboard manual visual check | **NOT RUN** (unmodified Rust/native/renderer CSS; manual focus remains user checkpoint) |

### Source of actual automated results

- First branch run: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42393143002
- Commit under test: `ff9823c064e651f8b2650516c644be44374f433b`.
- Focus test output: `✓ src/features/app/__tests__/sidebarKeyboardFocus.test.ts (3 tests) 2ms`; no failing tests in that file.
- Full renderer Vitest output: `Test Files 2 failed | 218 passed | 1 skipped (221)` and `Tests 7 failed | 1450 passed | 1 skipped (1458)`.
- Remaining errors are unchanged identity-recovery tests: six `ReferenceError: IdentityImportWorkspace is not defined` and one source-string expectation for `Find Official Replacement Candidates`.
- Native/Windows manual verification remains NOT RUN. The final documentation commit will trigger another CI run; its result must be checked before calling this branch validated.

## Risks / limitations

- This test asserts source strings and does not substitute for actual browser computed-style or Windows 100/125/150% keyboard focus inspections.
- The full CI baseline contains seven independent identity-recovery failures. This isolated test correction must not suppress or silently repair those failures.
- Validation uses a dependency branch stacked on B00 because the repository's GitHub workflow is not yet on `main`. Merging a child branch into the unmerged parent is not authorized. Once the required CI evidence is collected, the child PR should target the B00 branch for a test-only review.
- The user's local dirty checkout, backups and databases were not accessed; no local Git/source-control operation was performed.

## Rollback

Close the isolated draft PR and delete only its unmerged branch, or revert this test-only commit through a new reviewed PR if merged later. Do not alter user CSS or any other CI failures. Before merging, verify the exact branch head and evidence for that head.

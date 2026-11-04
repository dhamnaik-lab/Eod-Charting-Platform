# UX-01 — Restore keyboard-focus visibility for sidebar buttons

**IST timestamp:** 2026-11-04 21:24 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**GitHub source authority:** `dhamnaik-lab/Eod-Charting-Platform` at `main` commit `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux01-sidebar-keyboard-focus-20261104`

## Objective / previous defect
The global CSS suppressed focus outlines on `aside button` in every state, including `:focus-visible`, with `!important`. The existing normal `button:focus-visible` ring therefore could not show in most sidebar themes. A more-specific Classic Light Refined exception existed, but the broader other themes had no reliable ring.

Restore focus visibility for keyboard users **without changing sidebar geometry, hover behavior, pointer click behavior, theme palettes or the chart**.

## Files changed
- Modified: `src/styles/global.css`
- Created: `src/features/app/__tests__/sidebarKeyboardFocus.test.ts`
- Created: this change record under `docs/changes/`

## Final implementation
The outline-and-shadow reset now applies only to `aside button:not(:focus-visible)` and `button:not(:focus-visible)`. This preserves pointer/no-focus rendering while allowing the existing shared `button:focus-visible` accent outline to render in every theme. The special Classic Light Refined focus outline and its white halo remain unchanged. No theme colors, component dimensions or scripts were changed.

## Behavior preserved
- Pointer hover, selection and active styles; button semantics; sidebar row behavior.
- Default theme and every existing optional theme and palette.
- Special Classic Light Refined styling.
- Chart rendering, data, indicator, database and backend behavior.

## Validation performed / results
- Pinned current `main` GitHub SHA and original CSS inspected: **PASS**.
- Created isolated branch from pinned `main`: **PASS**.
- Four in-memory structural checks verified that suppression no longer targets `:focus-visible`, pointer reset remains, shared accent focus ring exists and Refined exception remains: **PASS (4/4 static)**.
- Three focused regression test cases added: **source present; NOT RUN**.
- `npm run test -- src/features/app/__tests__/sidebarKeyboardFocus.test.ts`: **NOT RUN**.
- `npm run typecheck:renderer`: **NOT RUN**.
- `npm run build:renderer`: **NOT RUN**, deferred by user.
- Windows tab navigation and visual focus verification in every theme: **NOT RUN**, deferred by user.
- `scripts/validate-change.ps1 -Profile renderer`: **NOT RUN**.

**Static source checks are not equivalent to executed tests.**

## Risks / limitations
- Focus-ring positioning and clipping in very narrow sidebar rows or at Windows display scaling above 100% are unverified visually.
- Existing controls outside the sidebar retain their original focus behavior; other accessibility findings are separate issues.
- CSS contract tests inspect source text, not computed browser styles; manual testing is required.

## Rollback
The original unmodified `main` commit is the source baseline. A local project backup was not generated because all work is limited to the connected GitHub branch and the user's desktop is unavailable. Close the unmerged draft PR to discard the candidate; if merged, revert the isolated PR through another reviewed PR. Do not reset unrelated repository history.

## Deferred acceptance
Run the focused Vitest, relevant existing theme tests, renderer typecheck and build. In Windows, tab through the sidebar using each supported theme; confirm a readable focus indicator, unaffected mouse hover, no layout shift, no clipped ring at 100%, 125%, 150% and 200% display scale. Keep the PR draft until actual results are recorded and accepted.

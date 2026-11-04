# UX-03 — Chart shortcut focus protection

**IST timestamp:** 2026-11-04 21:01 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `dhamnaik-lab/Eod-Charting-Platform`, `main` commit `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Change branch:** `fix/ux03-chart-viewport-shortcuts-20261104`  
**Mode:** GitHub-only source change. No local working-tree, SQLite, binary EOD or external API access.

## Objective
Keep chart drawing/navigation shortcuts active only on the explicitly focused chart viewport. Prevent a global window keyboard listener from changing chart mode, selected drawings, symbol or viewport while another dialog/control has focus. Preserve working chart shortcuts and chart navigation after chart focus.

## Previous defect / limitation
`ChartCanvas.tsx` attached `window.addEventListener('keydown', onGlobalKeyDown)` whenever a chart tab was active. Its editable-target check excluded inputs/selects/contenteditable but not other buttons, menus and modeless dialogs. Consequently, a shortcut such as `Shift+Delete` or arrow navigation could reach chart state while focus was outside the chart, conflicting with the Keyboard Shortcuts dialog's documented “Requires chart focus” behavior.

The chart viewport already had `tabIndex={0}`, `onKeyDown={handleChartKeyDown}`, and pointer/mouse capture focusing it. Those existing entry points made the global listener redundant for chart-focused keyboard use.

## Files changed
- **Modified:** `src/components/ChartCanvas.tsx` — removed the window keydown listener; constrained the existing keyboard handler to the active tab and direct viewport-origin events; removed the now-obsolete editable-target helper.
- **Created:** `src/features/charts/chartKeyboardFocusService.ts` — small DOM-independent focus predicate for direct chart viewport keyboard events.
- **Created:** `src/features/charts/__tests__/chartKeyboardFocusService.test.ts` — five focused tests for viewport events, outside controls, nested child controls, previously handled/cross-tile events, and source wiring.
- **Created:** this change record.

## Final implementation / exact behavior
- The viewport's own keyboard handler is the **only** `ChartCanvas` shortcut entry point.
- Events are accepted only when `event.target === event.currentTarget`, `currentTarget` exists, and the event has not already been prevented.
- The handler refuses inactive chart tabs when a `tabId` is provided.
- The chart viewport remains focusable and receives focus on existing pointer/mouse interaction.
- A focused child button, inline editor, another chart tile, sidebar control or floating dialog no longer routes a keyboard event through the chart viewport handler.
- Once a chart viewport regains focus, the existing mapped shortcuts work through unchanged action branches.

## Behavior preserved
- Existing chart shortcut keys and corresponding drawing, viewport, symbol and mode actions.
- Active-tab selection on chart mouse interaction; viewport `tabIndex`, `onKeyDown`, mouse/pointer focus handlers.
- Chart/drawing persistence and lock behavior; all chart geometries, rendering, chart settings, Corporate Actions, NSE/BSE, Bhavcopy, database and backend logic.
- RootApp's distinct global workspace/timeframe shortcuts were intentionally **not** changed (separate potential audit finding).

## Validation performed / actual results
1. Connected GitHub verified `main` HEAD SHA equals pinned source authority before branch creation: **PASS**.
2. Created a separate branch from the exact pinned SHA (without moving `main`): **PASS**.
3. Read all three changed/created source files back from the branch; checked exact response blob SHAs and nine structural invariants (viewport handler/focus retained, active-tab and target guards, old listener/helper removed, five test cases): **PASS (9/9 static source checks)**.
4. Focused Vitest run (`npm run test -- src/features/charts/__tests__/chartKeyboardFocusService.test.ts`): **NOT RUN**. GitHub-only source editing lacks the user's installed dependency/runtime context.
5. Renderer TypeScript check (`npm run typecheck:renderer`): **NOT RUN**.
6. Frontend build (`npm run build:renderer`): **NOT RUN** at user's request to defer builds.
7. Windows visual/keyboard acceptance: **NOT RUN** at user's request; manual checkpoint pending.
8. Documentation validation (`scripts/validate-change.ps1 -Profile docs`): **NOT RUN**; requires local checked-out project.

Static source checks are not equivalent to a passing Vitest, TypeScript or build result. There is no CI evidence used to claim otherwise.

## Risks / limitations
- **Expected focus change:** chart shortcuts no longer work when focus is on non-chart controls. Click/focus the chart viewport first, as documented.
- **Unverified native interactions:** dialog focus ownership, browser event propagation, chart tab/tile interaction, chart-context menus and Escape behavior require keyboard-only Windows acceptance.
- **Out of scope:** RootApp global timeframe shortcuts, modal focus traps, sidebar accessibility and other UI/UX findings are not changed in this bounded task.
- The code-level guard does not automatically focus a chart when a user opens/closes a dialog; intentionally preserve standard explicit focus behavior.
- Automated test source is committed but has not been run in the actual project.

## Backup and rollback
GitHub-only scope precluded running `scripts/create-project-backup.ps1` or modifying the user's local checkout. The original `main` commit `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a` remains the immutable rollback baseline, and the implementation resides on a separate branch. Do not merge the PR until focused tests, typecheck, build and keyboard acceptance are reviewed. To roll back **before merge**, close the PR and retain/delete the branch under explicit review; `main` is unchanged. If merged later, revert the UX-03 commits in a new reviewed PR; do not reset unrelated project history.

## Deferred acceptance checklist
- Run the new five-case Vitest suite and relevant chart regression suites.
- Run renderer TypeScript check and Vite build, recording actual command output.
- Windows test: focus chart; verify X/H/V/L/C, arrow navigation, +/- zoom, Home/End, Delete/Shift+Delete and Escape preserve intended chart behavior.
- Focus a dialog/button, text editor, floating window, sidebar, or second chart tile; verify these shortcuts cannot alter the previously active chart.
- Open/close a window, return focus to the chart, and confirm shortcuts resume.
- Verify no unrelated time-frame/drawing/indicator changes or keyboard event conflicts.

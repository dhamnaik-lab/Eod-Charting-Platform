# UX-06 — Restore native context menus for editable controls

**IST timestamp:** 2026-11-04 21:32 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `dhamnaik-lab/Eod-Charting-Platform` main `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux06-native-editable-context-menu-20261104`

## Objective / previous defect
`RootApp.tsx` installed a global `contextmenu` listener that unconditionally prevented native right-click menus. This suppressed ordinary Copy/Paste/Select All and text-editor behavior in inputs and textareas, even where no app-specific menu replaces the native menu.

## Files changed
- Modified: `src/RootApp.tsx`
- Created: `src/components/__tests__/NativeEditableContextMenu.test.ts`
- Created: this change report in `docs/changes/`.

## Final implementation
Keep the global context-menu suppression for the existing non-editable UI, but allow native menus for events originating on, or nested within, input, textarea, select and contenteditable controls. Only a small target guard was added ahead of the existing `preventDefault`. Existing custom chart/drawing/symbol context menu behavior remains separate and is not changed.

## Behavior preserved
- Chart and symbol custom menu listeners, mouse/pointer actions and all drawing/indicator handlers.
- Global non-editable context-menu behavior remains suppressed.
- Keyboard shortcuts, app state, storage, backend and all other workflows are unchanged.
- No new dependencies, redesign or other workstream changes.

## Validation performed / results
- Pinned current main GitHub source inspected: **PASS**.
- Narrow source modification and four in-memory structural checks (editable allowance, context event listener, suppression fallback, cleanup): **PASS (4/4 static)**.
- Three regression test cases created, including chart custom-menu source check: **NOT EXECUTED**.
- Vitest, renderer typecheck, Vite build, Windows right-click visual tests: **NOT RUN**, intentionally deferred.
- No claim of runtime or automated test success.

## Risks / limitations
- Context menus in embedded third-party widgets and unusual shadow-DOM editable elements require Windows acceptance and are not fully covered by the minimal target guard.
- The global context-menu suppression remains on noneditable controls by design; removing it entirely was outside this bounded task.
- Browser-native menu availability ultimately depends on the Tauri WebView and Windows host configuration.
- GitHub-only operation: local PowerShell backup was not run and no local production files were accessed.

## Rollback guidance
The pinned main baseline is untouched. Close the unmerged draft PR to reject this candidate or revert via a new reviewed PR after any later merge, not by resetting unrelated history.

## Deferred acceptance
Run `npm run test -- src/components/__tests__/NativeEditableContextMenu.test.ts`, renderer typecheck/build and manual Windows checks: right-click editable input (symbol search, Quote Editor, dialogs, chart text), verify Copy/Paste/Select All; verify chart, drawing and symbol right-click custom menus still work; verify noneditable app background remains unchanged.

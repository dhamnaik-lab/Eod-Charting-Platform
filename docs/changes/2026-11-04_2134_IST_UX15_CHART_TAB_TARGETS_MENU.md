# UX-15 — Chart-tab close targets and viewport-safe context menu

**IST timestamp:** 2026-11-04 21:34 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`  
**GitHub source authority:** `dhamnaik-lab/Eod-Charting-Platform`, `main` @ `4cf6c66ce65c6cfe76a97af8e1636dbd16e9519a`  
**Branch:** `fix/ux15-chart-tab-targets-and-menu-20261104`

## Objective / previous defect
Chart-tab close controls had a 16×16 px hit target in a dense tab strip, and the context menu used unbounded click coordinates with `position:fixed`; an edge click could place the menu partly offscreen. Buttons also lacked explicit accessible labels.

## Files changed
- Modified: `src/components/ChartTabs.tsx`.
- Created: `src/features/charts/chartTabContextMenuLayout.ts`.
- Created: `src/features/charts/__tests__/chartTabContextMenuLayout.test.ts`.
- Created: this `docs/changes/` record.

## Final implementation
- Increase tab-close button target from 16×16 to 22×22 within the existing 26px tab height.
- Adjust tab internal gap from 8px to 6px and horizontal padding from 10px to 8px, keeping nominal nonlabel width consumption identical: originally 16+8+20=44px; after 22+6+16=44px. Tab strip height, widths, min/max widths and button actions are unchanged.
- Add accessible names to Close chart tab and New chart tab buttons.
- Clamp the menu's x/y coordinates using current window size, menu dimensions and an 8px margin; keep Duplicate tab action, positioning mode and existing close behavior.
- Add five focused regression cases for in-bounds, edge, negative, narrow-window and component wiring contracts.

## Behavior preserved
- Existing chart tabs, selection, scroll, duplicate/close/new, right-click activation and context menu action.
- Chart content, drawn objects, geometry, data, persistence and all backend behavior.
- No new dependencies, visual redesign, database access or source outside this workstream.

## Validation performed / actual results
- Pinned main GitHub source and precise tab component inspected: **PASS**.
- Isolated GitHub branch and exact source changes: **PASS**.
- In-memory structural checks for bounded menu coordinates, control labels, 22px target, unchanged nominal width and menu action: **PASS (5/5 static)**.
- Five focused tests added: **NOT EXECUTED**.
- Vitest, typecheck and renderer build: **NOT RUN**, user deferred.
- Windows hit-target, context-menu edge placement, tab strip at 100–200% display scale: **NOT RUN**.
- Do not claim a runtime or compiler pass from static inspection.

## Risks / limitations
- Menu dimensions are based on the current single menu item, min width, padding and border. Future additions to menu contents may require remeasurement and updated clamp constants.
- Very small windows narrower than the menu cannot fully fit it; coordinates still remain nonnegative.
- Changing target size may subtly alter pixel alignment and close-button visuals, requiring visual acceptance.
- The preexisting tab wrapper's `role="button"` and ARIA tablist semantics remain unchanged; addressed in a separate accessibility issue if approved.
- No local PowerShell backup was created because the task is GitHub-only while the user is away from desktop.

## Rollback guidance
The original `main` SHA remains untouched. Close the unmerged draft PR to discard, or revert through a new reviewed PR after any later merge. Do not reset unrelated commits.

## Deferred acceptance
Run `npm run test -- src/features/charts/__tests__/chartTabContextMenuLayout.test.ts`, relevant chart-tab regression suites, `npm run typecheck:renderer`, `npm run build:renderer`, then Windows manual checks at 960×640/1920×1080 and 100–200% display scaling. Test new/close/duplicate, keyboard activation, tab overflow/scroll, context menu at all four edges and no unintended chart state changes.

## Validation update — 2026-11-04 23:55 IST

The user's first isolated Windows integration run (`EOD_UI8_Validation_20261104_234817_IST`) completed `npm ci` (exit 0; `esbuild@0.25.12` install-script warning) and attempted all eight focused Vitest suites. Actual result: **30 passed, 1 failed**. The failure was the UX-15 source-text assertion looking for `width: 22,\n  height: 22,` using literal LF, whereas the Windows checkout appears to contain CRLF. GitHub's `ChartTabs.tsx` source retains the intended 22×22 values. A simulated CRLF checkout reproduces this exact string mismatch; normalizing CRLF/CR to LF resolves the three multiline source-text expectations without weakening them.

**Correction:** `chartTabContextMenuLayout.test.ts` now normalizes line endings on the source string before running the same style/geometry assertions. No product code or chart dimensions changed. This is a test-only portability repair. GitHub source verification: **PASS**. **Rerun after correction: NOT YET EXECUTED**; typecheck, build, visual checks **NOT RUN** because the initial runner stopped at focused tests.

**Rollback:** Revert this test-only commit through the draft PR, or close the draft PR. The original `main` remains unchanged.

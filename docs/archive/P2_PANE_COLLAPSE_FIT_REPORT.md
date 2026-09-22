# P2 Pane Collapse And Fit Report

Date: 2026-04-08

## Scope

Started P2 from the EOD-only TradingView parity list with the first two pane-ergonomics items:

- per-pane collapse / expand
- per-pane fit / autoscale reset for manual indicator-pane scale overrides

This pass stayed inside the active Tauri renderer path and preserved the platform's EOD-only scope.

## Exact Gaps Closed

Before this pass, indicator panes could be resized and reordered, but every pane always remained
fully expanded and there was no pane-local chart-chrome action to clear manual scale overrides.
That left the pane stack denser than necessary on multi-study layouts and forced users back to
axis gestures to recover autoscale after manual pane scaling.

This pass adds compact collapsed pane rails, persists collapsed-pane state per chart tab, and
adds a pane-level fit/autoscale reset in the pane controls.

## What Changed

1. `src/store/chartStore.ts`
   - Added persisted `collapsedIndicatorPanes` state to each chart tab.
   - Added `setIndicatorPaneCollapsed(paneId, collapsed?)`.
   - Kept collapsed-pane state pruned and synchronized during add/update/remove/clear/reorder
     indicator flows.

2. `src/features/workspace/workspacePersistence.ts`
   - Extended workspace serialization/deserialization with `collapsedIndicatorPanes`.
   - Added sanitization so only active pane ids can restore as collapsed.

3. `src/components/ChartCanvas.tsx`
   - Added pane collapse / expand buttons in pane chrome.
   - Added pane-level fit/autoscale reset button that clears manual pane scale overrides.
   - Hid the pane resize separator when a pane is collapsed.
   - Applied persisted collapsed-pane state to both local layout calculation and the chart engine.

4. `src/engine/ChartEngine.ts`
   - Added engine-level collapsed-pane state via `setCollapsedIndicatorPanes(...)`.
   - Updated pane layout calculation to use compact collapsed-pane heights while preserving stored
     expanded heights separately.
   - Rendered collapsed panes as compact rails instead of full indicator plots.
   - Excluded collapsed panes from axis drag scaling and from indicator-pane legends.
   - Prevented new pane drawings from being created inside collapsed panes.

5. `src/RootApp.tsx`
   - Passed persisted collapsed-pane state into `ChartCanvas`.

6. Documentation
   - Updated `README.md`
   - Updated `FILE_INVENTORY.md`
   - Updated `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
   - Updated `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Modified

- `src/RootApp.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/types.ts`
- `src/features/workspace/workspacePersistence.ts`
- `src/store/chartStore.ts`
- `README.md`
- `FILE_INVENTORY.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260408_134252_p2_pane_controls`

## Validation Performed

- `npm run typecheck:renderer`
- `npm run test`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Portable output folder:
  `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Notes

- Collapsing a pane does not overwrite its remembered expanded height.
- The pane-level fit button clears only manual pane scale overrides; fixed-range panes keep their
  intended fixed-range behavior.
- This pass does not add compare overlays, left price scales, or main price-pane last-value tags.

## Remaining P2 Follow-Up

- Main price-pane last-value tags
- Compare overlays only if they remain EOD-only and local-first
- Optional expand-all / collapse-all affordances if they fit the current shell cleanly
- Optional per-pane fit command for the main price pane if price-pane chrome is expanded later
- Manual screenshot-driven visual parity audit against TradingView

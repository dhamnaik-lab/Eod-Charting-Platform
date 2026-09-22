# P1 EOD Parity Upgrade Report

Date: 2026-04-08

## Scope

Completed the P1 TradingView-vs-current-project parity pass for the active EOD-only charting
platform. This pass focused on the highest-value charting gaps that matter for end-of-day use:

- per-pane resize separators instead of one shared indicator-pane rail
- persisted per-pane heights
- pane reorder controls
- right-axis drag-to-rescale
- right-axis double-click reset
- pane-local manual/autoscale override persistence
- EOD time-scale label density improvements for longer histories

Trading-terminal features, intraday workflows, and broker/order-entry parity were intentionally
kept out of scope.

## Exact Gaps Closed

Before this pass, the chart engine still treated indicator panes as a single resizable block with
one shared height model, and the right axis could not be dragged or double-clicked for manual
scale control. That left pane ergonomics and price-scale interaction notably behind TradingView's
pane model even though the renderer already had good EOD chart basics.

This pass closes those P1 gaps by introducing pane-specific height and scale state, wiring that
state through persistence and store contracts, and exposing TradingView-style axis interactions
inside the active renderer without changing the product's EOD-only scope.

## What Changed

1. `src/components/ChartCanvas.tsx`
   - Replaced the single shared indicator resize rail with per-pane separator handles.
   - Added per-pane move up / move down controls alongside the existing pane actions.
   - Forwarded pane-height and pane-scale changes into store persistence.
   - Applied persisted pane height and scale override state back into the chart engine.

2. `src/engine/ChartEngine.ts`
   - Refactored pane layout to use pane-specific heights and pane-specific top offsets.
   - Added right-axis drag-to-rescale for the price pane and non-fixed-range indicator panes.
   - Added right-axis double-click reset back to autoscale for the active pane.
   - Added wheel-over-axis pane scaling behavior.
   - Prevented axis clicks from leaking into drawing creation.
   - Added pane-scale change events so manual scale overrides can be persisted.

3. `src/store/chartStore.ts`
   - Added persisted `indicatorPaneHeights` state keyed by pane id.
   - Added persisted `paneScaleOverrides` state keyed by pane id.
   - Added pane reorder action support.
   - Added reset behavior for per-pane heights while preserving the older shared-height default as
     backward-compatible fallback state.

4. `src/features/workspace/workspacePersistence.ts`
   - Extended workspace serialization/deserialization with pane-height and pane-scale override
     contracts.
   - Added sanitizers for persisted pane layout and scale state.

5. `src/engine/types.ts`
   - Added shared types for pane heights, pane scale ranges, pane scale overrides, and pane scale
     change events.

6. `src/engine/ScaleManager.ts`
   - Added lockable manual scale-range behavior so fixed/manual pane ranges render exactly.
   - Improved EOD x-axis tick density and long-range labeling for month / quarter / year
     boundaries.

7. `src/components/ChartToolDock.tsx`
   - Updated pane-height reset behavior to reset all per-pane heights instead of writing one shared
     override value.

8. `src/RootApp.tsx`
   - Plumbed the new persisted pane-height and pane-scale state into `ChartCanvas`.

9. Documentation
   - Updated `README.md`
   - Updated `FILE_INVENTORY.md`
   - Updated `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
   - Updated `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Modified

- `src/RootApp.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/types.ts`
- `src/features/workspace/workspacePersistence.ts`
- `src/store/chartStore.ts`
- `README.md`
- `FILE_INVENTORY.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260408_130224_p1_parity_upgrade`

## Validation Performed

- `npm run typecheck:renderer`
- `npm run test`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Portable output folder:
  `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Notes

- The platform remains EOD-only. No trading-terminal, order-entry, DOM, or intraday feature work
  was introduced in this pass.
- Fixed-range oscillator panes intentionally keep their fixed-range behavior and do not expose
  manual right-axis dragging.
- The older shared `indicatorPaneHeight` field remains in persistence as a backward-compatible
  default, but pane-specific heights are now the active source of truth.

## Remaining P2 Follow-Up

- Per-pane collapse / expand
- Per-pane fit-studies command
- Optional left price scale for compare workflows
- Multi-symbol compare overlays if they become product-relevant
- Additional EOD-focused chart types where justified
- More refined daily / weekly / monthly visible-range controls
- Manual screenshot-driven parity audit against TradingView for visual polish

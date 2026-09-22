# P2 Compare Overlays Report

Date: 2026-04-08

## Scope

Complete the next P2 TradingView-style parity slice for this EOD-only product by adding local-first compare overlays without introducing intraday, broker, or trading-terminal behavior.

## What Changed

- Added persisted compare overlay descriptors to `workspacePersistence.ts` through `compareOverlays`.
- Added `ChartCompareOverlay` plumbing to `chartStore.ts` so compare overlays now:
  - persist per chart tab and per sheet
  - rehydrate from the existing local EOD database
  - re-aggregate when the chart timeframe changes
  - reload with the current raw/adjusted mode when chart data is rehydrated
- Added `src/components/CompareOverlayDialog.tsx` as the in-app compare search/manage dialog over the existing symbol search flow.
- Updated `src/components/Toolbar.tsx` to expose compare overlay chips plus a `Compare` button.
- Updated `src/components/ChartCanvas.tsx` and `src/RootApp.tsx` to pass compare overlays into the chart engine.
- Updated `src/engine/ChartEngine.ts` so compare overlays:
  - stay separate from indicator overlays
  - render in the main price pane
  - rebase from the first visible shared bar
  - contribute legend tokens and right-axis tags showing relative performance
  - expand axis width when compare labels need more room
- Updated `src/engine/Renderer.ts` with axis-label width measurement for wider compare tags.

## Design Notes

- Compare overlays remain EOD-only and local-first.
- Compare overlays do not introduce a second price scale or percent axis in this pass.
- The compare line is normalized into price-space using the first visible shared bar, while legend/tag text shows signed percent performance.
- Compare overlays are capped at three symbols per chart tab.

## Files Changed

- `src/features/workspace/workspacePersistence.ts`
- `src/store/chartStore.ts`
- `src/components/Toolbar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/CompareOverlayDialog.tsx`
- `src/RootApp.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `README.md`
- `FILE_INVENTORY.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260408_143938_p2_compare_overlays`

# Chart Settings Menu Report

Date: 2026-04-08

## Summary

Added an EOD-only TradingView-style scale settings menu without pulling in TradingView features that do not fit an offline end-of-day charting product.

## What Changed

- Added `src/components/ChartSettingsMenu.tsx` as a dark popover surfaced from the new `Scale` button in `src/components/Toolbar.tsx`.
- Added a second TradingView-style entrypoint inside `src/components/ChartCanvas.tsx` as a right-click interaction on the price-scale zone, with the menu opening leftward from the axis while keeping the scale area visually blank instead of showing a permanent or hover gear button.
- The menu exposes only working EOD-relevant options:
  - Auto fit price pane
  - Fit all panes
  - Regular / Logarithmic scale
  - Invert price scale
  - Show right-axis value labels
  - Show volume pane
  - Future bar space: `tight` / `normal` / `wide`
- Added `fitAllPanes()` in `src/store/chartStore.ts` so the menu can clear all manual pane scale overrides in one action.
- Persisted new per-tab settings through `src/store/chartStore.ts` and `src/features/workspace/workspacePersistence.ts`:
  - `invertPriceScale`
  - `showValueLabels`
  - `futureMarginMode`
- Updated viewport helpers in `src/features/charts/chartDataUtils.ts` and `src/engine/ScaleManager.ts` so reset, scroll, zoom, and clamp logic now honor the selected future-bar spacing instead of relying on a hidden fixed margin.
- Updated `src/components/ChartCanvas.tsx` and `src/engine/ChartEngine.ts` so scrollbar alignment, drag-pan, wheel zoom, axis scaling, and rendering all use the same settings model.

## Scope Boundaries

Intentionally not added in this pass:

- left-side price scale switching
- session controls
- Trading Terminal options
- percent / indexed-to-100 mode for the whole price pane
- lock price-to-bar ratio

Those were excluded because they either do not fit the current EOD/offline scope or would require a broader chart model change than this incremental pass.

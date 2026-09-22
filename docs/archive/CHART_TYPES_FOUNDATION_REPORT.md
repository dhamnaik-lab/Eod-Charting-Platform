# Chart Types Foundation Report

## Scope
- Date: April 22, 2026
- Goal: add the first chart-type foundation pass without changing database/import/watchlist/sidebar/sheet/workspace ownership behavior
- Preserved intentionally:
  - existing Tauri-only runtime path
  - existing EOD load/import/storage flow
  - existing sheet ownership model
  - existing volume overlay toggle behavior
  - existing indicator/drawing persistence model

## What Changed
- Added persisted per-chart `chartType` state with four supported modes:
  - `candles`
  - `line`
  - `heikinAshi`
  - `renko`
- Added persisted per-chart `renkoBrickSize`
- Added `src/features/charts/chartTypeTransformService.ts` as the chart-type transform seam
- Updated chart hydration and timeframe changes so `displayBars` now come from:
  - raw bars
  - timeframe aggregation
  - chart-type transform
- Updated compare-overlay hydration/reaggregation to follow the active chart type where practical
- Updated the renderer/engine so:
  - line charts render as a close-only line
  - line charts use close-based price scaling instead of full OHLC range
  - Heikin Ashi uses transformed OHLC bars
  - Renko uses a fixed-brick MVP transform
- Updated the toolbar with a compact chart-type selector and Renko brick-size input
- Updated workspace/sheet persistence so chart type survives save/load/restart
- Preserved plain-sheet behavior:
  - new sheets still reset to a fresh plain-candle chart instead of cloning the current chart type/layout

## Files Added
- `src/features/charts/chartTypeTransformService.ts`
- `CHART_TYPES_FOUNDATION_REPORT.md`

## Files Modified
- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/components/Toolbar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/RootApp.tsx`
- `src/store/chartStore.ts`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/features/charts/chartInstrumentHydrationService.ts`
- `src/features/charts/compareOverlayService.ts`
- `src/features/charts/chartInstrumentCompareController.ts`
- `src/features/charts/chartTabWorkspaceService.ts`
- `src/features/charts/chartSheetWorkspaceService.ts`
- `src/features/workspace/workspacePersistence.ts`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`

## Validation
- `npm run typecheck:renderer`
- `npm run build`
- `npm run tauri:portable:win`

## Backup
- `backups/pre_opencode_changes_20260422_110955_chart_types_pass`

## Runnable Output
- `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`

## Current Limitations
- May 22, 2026 correction: the toolbar now exposes eight selectable chart types (`candles`, `line`, `area`, `bar`, `baseline`, `hlcArea`, `heikinAshi`, `renko`). `normalizeChartType` preserves every selectable value, and `area` now renders through its own area branch instead of falling back to candles.
- July 4, 2026 correction: Renko now adopts the TA Content Source Code Renko surface for ATR, fixed, and percent sizing, close or high/low source, first-close or rounded anchoring, optional wicks, and optional latest incomplete bricks.
- Renko value edits now commit on blur/Enter instead of every keystroke, and the transform rejects unsafe sizes that would generate runaway synthetic brick counts.
- Renko drawings now store optional source-brick anchors and resolve those anchors back to the current synthetic brick before render/hit-test, so existing drawings do not drift just because the Renko index sequence is regenerated.
- Compare overlays are intentionally suppressed on Renko charts in this pass. The existing compare normalization path is date-based and was not rewritten for synthetic multi-brick timelines.
- No dedicated chart-type legend/readout text was added yet.
- No separate pane-based volume indicator was added here. This pass only covers chart type selection/rendering.

## Next Recommended Pass
- If the next priority is analysis tools, do drawings and Fibonacci next.
- If the next priority is renderer completeness, add chart-type-specific legend/readout handling and a safer Renko strategy for compare overlays/drawings.

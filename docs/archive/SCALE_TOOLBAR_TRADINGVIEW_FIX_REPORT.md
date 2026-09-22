# Scale Toolbar TradingView Fix Report

Date: April 9, 2026

## Summary
- moved the visible chart `Scale` trigger into the top toolbar row beside the timeframe and indicator controls so it behaves like a TradingView-style top control instead of a chart/axis overlay
- removed the visible `Scale` button from the chart canvas and price-scale area
- preserved the existing right-click-on-price-scale shortcut so scale settings can still be opened directly from the axis
- reverted the temporary main-price-axis top-header reservation because the final visible trigger no longer lives inside the axis gutter

## Files Changed
- `src/components/Toolbar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_204231_scale_toolbar_tradingview_fix`

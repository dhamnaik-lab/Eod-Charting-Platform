# Scale TradingView Axis Header Fix Report

Date: April 9, 2026

## Summary
- moved the chart `Scale` control back into the top of the measured right price-axis gutter so it behaves like a compact axis-header control instead of floating over the chart body
- centered the control within the axis gutter and kept the existing axis-side settings popover path
- updated the main price-axis renderer to reserve a top header band before drawing tick labels so the control and the top scale labels no longer overlap

## Files Changed
- `src/components/ChartCanvas.tsx`
- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_201611_scale_tradingview_axis_header_fix`

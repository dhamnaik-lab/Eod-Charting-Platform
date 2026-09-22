# Scale Header Slot Move Report

Date: April 9, 2026

## Summary
- moved the chart `Scale` control out of the right price-scale pane and into the blank top-right chart header area
- moved the axis-settings popover anchor with it so the button and menu stay visually paired
- preserved the existing right-click-on-price-scale entrypoint for opening the same chart scale settings menu

## Files Changed
- `src/components/ChartCanvas.tsx`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_191757_scale_header_slot_move`

# Scale Right Axis Trigger Fix Report

Date: April 9, 2026

## Summary
- moved the visible chart `Scale` trigger out of the top toolbar and back into the top-right price-scale header region
- kept the scale menu opening from the right axis area rather than the top control strip
- restored a compact reserved top band on the main price axis so the trigger and the topmost right-axis labels do not collide
- kept the existing right-click-on-price-scale shortcut for opening the same menu

## Files Changed
- `src/components/ChartCanvas.tsx`
- `src/components/Toolbar.tsx`
- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_210015_scale_right_axis_trigger_fix`

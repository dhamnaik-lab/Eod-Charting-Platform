# Right Scroll Gap Fix Report

Date: 2026-04-08

## Scope

Fix the large dead space appearing after the last visible bar when the user scrolls right to the chart edge.

## Root Cause

`src/engine/ScaleManager.ts` still allowed a dynamic future/right margin from the earlier zoom-refinement pass. That made right-scroll and scroll-end states preserve too many blank future slots, which looked like a layout gap between the chart and the price scale.

## Change Applied

- Tightened the allowed future/right margin in `src/engine/ScaleManager.ts`.
- Kept the future-bar model instead of removing it: the chart now uses a small fixed future-bar space near the right edge.
- Updated `src/components/ChartCanvas.tsx` so the bottom scrollbar now uses the same allowed future-bar bound as drag and right-button movement.
- This makes all rightward movement paths land on the same future-bar space instead of letting the scrollbar end-position snap flush to the price scale.

## Files Modified

- `src/engine/ScaleManager.ts`
- `src/components/ChartCanvas.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation

- `npm run typecheck:renderer`
- `npm run test`
- `npm run build`
- `npm run tauri:portable:win`

## Backup

- `backups/pre_opencode_changes_20260408_153534_right_scroll_gap_fix`

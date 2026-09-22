# DYNAMIC_PRICE_SCALE_WIDTH_REPORT

Date: 2026-04-09

## Summary

Replaced the fixed right price-scale width with measured content-fit width.

## Changes

- updated `src/engine/ChartEngine.ts` so the engine no longer stays pinned to the old fixed `96px` axis width
- reconnected axis-width measurement using the existing renderer text-measure helpers
- measured width now considers visible price-scale tick labels and active right-axis value tags across the price pane and indicator panes
- added a small `axisWidthChange` engine event so `src/components/ChartCanvas.tsx` can use the same measured width for pane chrome and price-scale hit zones
- kept a floor/ceiling clamp so the price scale can shrink for small-price symbols without exploding for longer labels

## User-visible result

- the right price scale is no longer permanently wide
- low-price and shorter-label symbols now use a narrower price-scale column
- wider labels still expand the axis only as needed
- chart-side controls and right-click price-scale interactions stay aligned with the measured axis width

## Files changed

- `src/engine/ChartEngine.ts`
- `src/engine/types.ts`
- `src/components/ChartCanvas.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation

- `npm run typecheck:renderer`

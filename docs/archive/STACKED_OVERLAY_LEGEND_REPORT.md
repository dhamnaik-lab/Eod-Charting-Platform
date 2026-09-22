# Stacked Overlay Legend Report

Date: 2026-04-09

## Summary

The chart-top overlay legend in the main price pane no longer flattens multiple overlay studies into one horizontal token stream. Overlay studies such as `EMA`, `SMA`, `VWAP`, `TEMA`, and compare overlays now render as separate rows beneath the TradingView-style price summary.

## What Changed

- Updated `src/engine/ChartEngine.ts`.
- Kept the main chart-top price summary line unchanged.
- Replaced the old flattened legend-token path with row-based rendering:
  - `drawPriceOverlayLegend(...)` now renders one row per overlay or compare item
  - `buildOverlayLegendRows(...)` now returns `LegendToken[][]`
  - `buildCompareLegendRows(...)` now returns `LegendToken[][]`
- Added extra vertical spacing between the price summary line and the first study row.

## Result

- Price summary remains on the first line.
- Each overlay study now steps downward on its own line.
- Multiple studies no longer collide visually in one packed horizontal row.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_145128_stacked_overlay_legend_fix`

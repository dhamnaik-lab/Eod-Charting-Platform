# Price Legend Gap And Vertical Indicators Report

Date: 2026-05-24

## Summary

Adjusted the in-plot price legend area so the main price/OHLC row has a small visual gap before plotted chart content, and restored price-pane overlay indicator labels to a vertical one-by-one list.

## What Changed

- Added `PRICE_LEGEND_IN_PLOT_CLEARANCE` in `src/engine/ChartEngine.ts`.
- Used that clearance as price-scale top padding when the canvas price legend is disabled and the React/HTML price legend is active, keeping the grid and crosshair on the full price pane.
- Updated `src/components/ChartPriceLegendOverlay.tsx` so overlay indicator legend items stack vertically below the price row.
- Preserved the compact function labels such as `SMA(20)`, `EMA(21)`, `WMA(20)`, and `DEMA(21)`.
- Preserved the price legend chevron show/hide behavior.

## Scope

- Price-pane legend spacing and overlay indicator legend layout only.
- No change to indicator calculations, price-scale label settings, scrollbar behavior, sheet switching, chart storage, or Tauri/runtime architecture.
- No legacy `src-tauri` or Electron changes.

## Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_LEGEND_GAP_VERTICAL_INDICATORS_REPORT.md`
- `rg -n "[ \t]+$" src/components/ChartPriceLegendOverlay.tsx src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_LEGEND_GAP_VERTICAL_INDICATORS_REPORT.md`

## Backup

- `backups/pre_opencode_changes_20260524_002637_price-legend-gap-vertical-indicators`
- `backups/pre_opencode_changes_20260524_005211_price-legend-gap-grid-continuity`

# Price Pane Legend In-Plot TV Style Report

Date: 2026-05-23

## Summary

Moved the active price-pane HTML legend from the old reserved top band into the live price plot area, matching the observed TradingView desktop behavior more closely.

## What Changed

- Updated `src/engine/ChartEngine.ts` so disabling the canvas price legend also removes the reserved price-pane legend height.
- Kept `src/components/ChartPriceLegendOverlay.tsx` as the HTML legend surface, but it now overlays the actual price plot rather than consuming a separate strip above it.
- Added a compact chevron control to collapse or expand overlay/compare legend rows while keeping the main price OHLC row visible.
- Preserved compact function-style overlay indicator labels such as `SMA(20)`, `EMA(21)`, and `WMA(20)`.
- Preserved the existing hover actions for indicator settings, indicator show/hide, and indicator removal.

## Scope

- Main price-pane legend and overlay/compare legend behavior only.
- No change to separate indicator-pane canvas legends.
- No change to indicator calculations, value tags, price scaling, chart storage, or Tauri/runtime architecture.

## Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`
- `rg -n "[ \t]+$" src/components/ChartPriceLegendOverlay.tsx src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`

## Backup

- `backups/pre_opencode_changes_20260523_142738_tv-like-price-legend`

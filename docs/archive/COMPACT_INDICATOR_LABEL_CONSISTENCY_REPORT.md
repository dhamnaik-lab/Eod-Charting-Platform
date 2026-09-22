# Compact Indicator Label Consistency Report

Date: 2026-05-23

## Summary

Standardized indicator display labels so the chart UI uses compact function-style labels consistently, including the price-pane overlay legend, top Studies chips, separate indicator-pane legends, and indicator pane controls.

## What Changed

- Added `getCompactIndicatorDisplayLabel()` in `src/indicators/catalog.ts` as the shared formatter for compact function labels.
- Updated `src/components/Toolbar.tsx` so Studies chips render labels such as `SMA(20)`, `EMA(21)`, and `WMA(20)`.
- Updated `src/engine/Indicators.ts` so renderable overlay and pane titles use compact labels, including separate indicator panes such as `MACD(12,26,9)`.
- Updated `src/components/ChartPaneControlsOverlay.tsx` so pane control accessibility labels and tooltips match the compact label contract.
- Updated `src/components/ChartPriceLegendOverlay.tsx` so the existing price-pane overlay legend reuses the shared helper instead of a local copy.

## Scope

- Label formatting only.
- No change to indicator calculations, visibility state, show/hide controls, pane sizing, chart scaling, scrollbar behavior, storage, or Tauri/runtime architecture.

## Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/indicators/catalog.ts src/engine/Indicators.ts src/components/Toolbar.tsx src/components/ChartPaneControlsOverlay.tsx src/components/ChartPriceLegendOverlay.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md COMPACT_INDICATOR_LABEL_CONSISTENCY_REPORT.md`
- `rg -n "[ \t]+$" src/indicators/catalog.ts src/engine/Indicators.ts src/components/Toolbar.tsx src/components/ChartPaneControlsOverlay.tsx src/components/ChartPriceLegendOverlay.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md COMPACT_INDICATOR_LABEL_CONSISTENCY_REPORT.md`

## Backup

- `backups/pre_opencode_changes_20260523_200733_compact-indicator-labels`

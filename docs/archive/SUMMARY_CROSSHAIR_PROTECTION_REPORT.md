# Summary Crosshair Protection Report

Date: 2026-04-09

## Summary

Protected the chart-top price summary and stacked overlay legend area from crosshair interaction so the hover line no longer runs through that header-style band.

## What Changed

- Updated `src/engine/ChartEngine.ts`.
- Updated `src/engine/Crosshair.ts`.
- The chart engine now computes a reserved top band for the price summary plus stacked overlay rows.
- Pointer Y-position is clamped below that reserved band when deriving hover price/crosshair state.
- The vertical crosshair line now starts below the reserved band instead of from `y=0`.

## Result

- The chart-top summary behaves more like a protected header overlay.
- Hover/crosshair no longer visually cuts through the symbol/OHLC summary area.
- Hover price alignment stays consistent because pointer math is clamped before crosshair rendering.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_154820_summary_crosshair_protection_fix`

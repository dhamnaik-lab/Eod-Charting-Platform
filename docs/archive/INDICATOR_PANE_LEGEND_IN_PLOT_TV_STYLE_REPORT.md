# Indicator Pane Legend In-Plot TV Style Report

Date: 2026-05-23

## Summary

Moved indicator-pane legends from a reserved pane-header band into the plotted indicator area, matching the same TradingView-style placement rule used for the price pane.

## Finding

The indicator-pane path still subtracted `INDICATOR_LEGEND_HEIGHT` from every non-collapsed indicator pane. The pane title and live legend were drawn in that reserved top band, so the plotted indicator content started lower than the visible pane boundary.

## What Changed

- Updated `src/engine/ChartEngine.ts` so non-collapsed indicator panes use `legendHeight = 0`.
- Indicator plots, grids, axis labels, drawings, and pointer math now use the full indicator pane height.
- Existing canvas-rendered pane title and live legend values still draw at the top-left, but now as an overlay on the indicator plot.
- Collapsed indicator pane chrome is unchanged.

## Scope

- Indicator-pane legend placement only.
- No indicator formula, rendering, pane height persistence, axis scaling, value tag, or collapsed-pane behavior changes beyond the removal of the reserved top band for non-collapsed panes.

## Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md INDICATOR_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`
- `rg -n "[ \t]+$" src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md INDICATOR_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`

## Backup

- `backups/pre_opencode_changes_20260523_150331_tv-like-indicator-legend`

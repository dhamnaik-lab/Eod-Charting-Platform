# Context Menu, Timeframe, and Scale Relayout Report

Date: April 9, 2026

## Summary
- suppressed the remaining native WebView/browser context menu at the app-shell level so it no longer leaks through on the bottom strip or other surfaces
- removed the standalone timeframe row and moved timeframe controls into the single toolbar row below chart tabs
- moved the `Scale` control out of the toolbar and into the chart viewport above the right price scale
- refined the `Scale` control to sit inside the blank top header area of the measured right price-scale gutter, matching the TradingView-style placement instead of floating over the plot

## Files Changed
- `src/RootApp.tsx`
- `src/components/Toolbar.tsx`
- `src/components/ChartHeader.tsx`
- `src/components/ChartCanvas.tsx`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_174434_contextmenu_timeframe_scale_relayout`

# Sidebar Indicator Double-Click Fix Report

Date: 2026-04-09

## Summary

This pass changes the sidebar indicator list so studies are added on double-click instead of single-click.

The previous behavior made it too easy to plot indicators accidentally while browsing the sidebar. The new behavior matches the requested workflow:

- single click: only focus/select the row
- double click: add the indicator
- drag: still drag the indicator onto the chart

## What Changed

- `src/components/Sidebar.tsx`
  - removed single-click indicator add behavior from the sidebar indicator list
  - added double-click indicator add behavior
  - updated the tooltip and empty-state hint to say "Double-click or drag indicators to the chart"

## Result

- sidebar indicator browsing no longer plots studies on the first click
- indicator plotting from the sidebar now requires a deliberate double-click
- drag-to-chart behavior is unchanged

## Validation

- `npm run typecheck:renderer`
- `npm run build`
- `npm run tauri:portable:win`

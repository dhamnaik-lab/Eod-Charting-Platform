# Viewport Scale Root Fix Report

Date: 2026-04-08

## Summary

Fixed the shared chart geometry problems that were causing zoom/unzoom drift and price-scale UI bleed.

## Root Cause

- `ChartEngine.ts` was dynamically resizing the right price-axis width from live labels and value tags while the user zoomed.
- `ChartCanvas.tsx` still laid out pane chrome and price-scale hit zones with a separate hardcoded axis width.
- `Renderer.ts` drew y-axis labels at pane edges without clipping to pane bounds.
- Zoom controls were still using cursor/hover anchoring, which made zoom-out feel like a horizontal chart scroll.

That meant the chart drawing width could change during zoom and the UI layer could disagree with the canvas layer about where the price scale actually started and ended.

## What Changed

- Added a shared stable axis-width constant in `src/engine/ChartEngine.ts`:
  - `SHARED_AXIS_WIDTH = 96`
- Removed per-frame axis-width remeasurement from `ChartEngine.ts` so horizontal zoom no longer reflows the chart width during interaction.
- Updated `src/components/ChartCanvas.tsx` to use the same shared axis width for:
  - `computeChartLayout(...)`
  - indicator-pane chrome offsets
  - right price-scale interaction hit testing
- Updated `src/engine/Renderer.ts` so `drawYAxis(...)` clips to the pane's axis rectangle and skips edge labels that would bleed outside the pane.
- Updated zoom anchoring so:
  - `ScaleManager.ts` now keeps the current right edge fixed during zoom
  - `ChartEngine.ts` wheel zoom no longer follows the cursor position
  - `ChartCanvas.tsx` zoom buttons and keyboard zoom no longer use the last hovered bar

## User-Visible Effect

- Wheel zoom and zoom/unzoom controls no longer shift the chart sideways because the right axis is no longer changing width underneath the viewport.
- Zoom-out now reveals more history to the left while keeping the current right edge fixed instead of horizontally scrolling the chart.
- Price-scale rendering now stops at the pane boundary instead of scratching into the pane below or the x-axis area.
- Right-axis UI interactions are now based on the same geometry in both the DOM/UI layer and the canvas renderer.

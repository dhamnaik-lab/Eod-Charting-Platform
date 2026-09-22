# CHART_TOP_PRICE_SUMMARY_REPORT

Date: 2026-04-09

## Summary

Moved the active symbol/price summary out of the header and onto the chart surface in a TradingView-style top-left series line.

## What Changed

- Reduced `src/components/ChartHeader.tsx` to a slim timeframe-only strip.
- Updated `src/engine/ChartEngine.ts` so the chart now draws:
  - `symbol | timeframe | exchange`
  - inline `O / H / L / C`
  - signed change and percent
- Kept overlay and compare legends below the new top summary instead of mixing everything into the old header chrome.

## Why

- The old header carried too much chart identity and price data.
- TradingView-style charting keeps the active series summary on the chart itself, which reads faster and frees header space for controls.
- This makes the chart area feel more like a charting platform and less like a dashboard card layout.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_132347_chart_top_price_summary`

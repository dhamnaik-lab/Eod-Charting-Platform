# Price Summary Style Refinement Report

Date: 2026-04-09

## Summary

Refined the TradingView-style chart-top price summary so the symbol title and OHLC line use the same visual scale, the live-status circle is removed, and OHLC rendering uses cleaner candle-direction styling.

## What Changed

- Updated `src/engine/ChartEngine.ts`.
- Removed the chart-top status circle from the TradingView-style price summary.
- Replaced the old tiny legend-font summary tokens with a dedicated 14px summary-token renderer.
- Kept the symbol title at 14px and matched the OHLC row to the same size.
- Changed OHLC value and change text to use the active candle-direction color.
- Changed the `O / H / L / C` label text to a neutral theme-aware contrast color.

## Result

- Symbol name and OHLC line now read as one coherent top summary instead of mixed font sizes.
- The unnecessary live-market circle is gone.
- OHLC values and change now visually align with the candle direction.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_152546_price_summary_style_fix`

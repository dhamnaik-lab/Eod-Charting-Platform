# Market Movers UI Correction

- Applied: 2026-08-04 16:17:51 +05:30
- Project root: E:\TA Projects\EOD Charting Platform
- Patch source: E:\TA Projects\EOD Charting Platform\market_movers_ui_fix_20260804_1559_IST\2026-08-04_1559_IST_MARKET_MOVERS_UI_FIX.patch
- Backup directory: E:\TA Projects\EOD Charting Platform\docs\changes\backups\2026-08-04_1617_IST_MARKET_MOVERS_UI_FIX

## Scope completed

1. Removed horizontal scrolling from the Market Movers sidebar list.
2. Repaired the sidebar footer accounting layout.
3. Redesigned expanded gainers/losers tables so Symbol remains visible and the tables fit without horizontal scrolling.
4. Replaced unrelated selected-watchlist text while Market Movers is active.
5. Hid the misleading conventional scanner Results count while Market Movers is active.

## Additional presentation adjustments

- Sidebar rows now show one context-appropriate metric: change percentage in Gainers/Losers and volume ratio in Volume.
- Expanded Market Movers header now shows exchange universe, as-of date, and complete scan accounting.
- Counts use Indian digit grouping.

## Explicitly deferred

The BSE equity-series/universe filter is not changed in this patch. Its group/series audit and backend correction remain a separate task.

## Files changed

- src\components\ScannerWindow.tsx
- src\features\marketMovers\MarketMoverRow.tsx
- src\features\marketMovers\MarketMoversPanel.tsx
- src\features\marketMovers\MarketMoversFullView.tsx
- src\features\marketMovers\marketMoversStyles.ts

## Validation

See: 2026-08-04_1617_IST_MARKET_MOVERS_UI_FIX_VALIDATION.txt
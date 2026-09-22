# NEW_SHEET_PLAIN_CANDLE_REPORT

Date: 2026-04-09

## Summary

Changed new-sheet creation so the `+` button opens a fresh plain-candle sheet instead of cloning the active chart layout.

## What Changed

- Updated `src/store/chartStore.ts`:
  - new sheet creation no longer serializes the active workspace as-is
  - new sheets now preserve the current symbol/timeframe but reset:
    - indicators
    - compare overlays
    - drawings
    - pane overrides/collapsed panes
    - pane layout back to a single plain-candle chart
- Updated `src/components/SheetTabs.tsx` copy so the UI now describes the action as creating a plain candle sheet.

## Result

- Creating a new sheet no longer opens a duplicate chart by default.
- The new sheet opens immediately as a fresh candle chart for the current symbol.
- The first new sheet still defaults to `Sheet1`, with later sheets following the existing sequential naming.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_141215_new_sheet_plain_chart_fix`

# Sheet Scrollbar Single Row Report

Date: April 9, 2026

## Summary
- moved per-chart-window sheet tabs into the chart canvas bottom strip so sheets and the horizontal scrollbar now share one row
- removed the old separate sheet row under each chart
- kept existing per-window sheet ownership and in-app create/rename/delete dialogs unchanged

## Files Changed
- `src/components/ChartCanvas.tsx`
- `src/components/SheetTabs.tsx`
- `src/RootApp.tsx`

## Validation
- `npm run typecheck:renderer`

## Backup
- `backups/pre_opencode_changes_20260409_170137_sheets_scrollbar_single_row`

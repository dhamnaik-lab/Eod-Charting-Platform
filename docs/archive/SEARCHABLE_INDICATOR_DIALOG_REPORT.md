# Searchable Indicator Dialog Report

Date: 2026-04-08

## Goal

Replace the plain toolbar indicator dropdown with a searchable in-app picker so adding studies stays fast as the catalog grows.

## What Changed

- Added `src/components/IndicatorPickerDialog.tsx`
  - grouped searchable modal over `INDICATOR_CATALOG`
  - filters by label, short label, description, kind, group, and placement
  - shows a compact detail panel with placement, description, and default setup
  - supports Enter to add, Escape to close, and double-click to add immediately
- Updated `src/components/Toolbar.tsx`
  - replaced the plain indicator `<select>` with an `Indicators` button
  - the button opens the searchable picker
  - existing indicator chip editing and removal flows remain unchanged

## Behavior Preserved

- indicators still add through `addIndicatorCatalog(...)`
- existing `IndicatorSettingsDialog` flow is unchanged
- no chart-engine, store, platform, or Tauri runtime behavior changed

## Backup

- `backups/pre_opencode_changes_20260408_105106_searchable_indicator_dialog`

## Validation

- `npm run test`
- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Best Next Step

- line style controls for indicators
- line width controls for indicators
- optional per-series visibility toggles for multi-series indicators

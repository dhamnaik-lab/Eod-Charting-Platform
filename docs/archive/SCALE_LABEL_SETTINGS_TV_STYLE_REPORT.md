# Scale Label Settings TV Style Report

Date: 2026-05-23

## Summary

Moved the chart scale settings trigger to the bottom-right scale/x-axis corner and added TradingView-style label controls inside the scale settings menu.

## What Changed

- Replaced the upper-right plot-area `Scale` text button with a compact gear button in the bottom-right scale/x-axis corner in `src/components/ChartCanvas.tsx`.
- Kept price-scale right-click behavior, but the bottom-right gear now opens the same settings surface upward and left from the scale corner.
- Added a dedicated `Labels` section in `src/components/ChartSettingsMenu.tsx`.
- Added separate label controls for:
  - all value labels
  - symbol last price label
  - overlay indicator value labels
  - compare value labels
  - indicator-pane value labels
  - no overlapping labels
- Added `ChartValueLabelSettings` and the shared normalization helpers used by the renderer, store, and workspace persistence.
- Preserved backward compatibility for saved sheets that only contain the older `showValueLabels` boolean.

## Scope

- Active Tauri renderer/store/workspace path only.
- No Electron runtime or legacy `src-tauri` changes.
- No change to indicator calculations, scale drag behavior, pane height behavior, scrollbar behavior, chart type transforms, or database APIs.

## Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/Renderer.ts src/engine/types.ts src/engine/valueLabelSettings.ts src/features/charts/chartSheetWorkspaceService.ts src/features/charts/chartTabStateMutationService.ts src/features/charts/chartTabWorkspaceService.ts src/features/workspace/workspacePersistence.ts src/store/chartStore.ts src/store/chartStoreTypes.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_TV_STYLE_REPORT.md`
- `rg -n "[ \t]+$" src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/Renderer.ts src/engine/types.ts src/engine/valueLabelSettings.ts src/features/charts/chartSheetWorkspaceService.ts src/features/charts/chartTabStateMutationService.ts src/features/charts/chartTabWorkspaceService.ts src/features/workspace/workspacePersistence.ts src/store/chartStore.ts src/store/chartStoreTypes.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_TV_STYLE_REPORT.md`

## Backup

- `backups/pre_opencode_changes_20260523_203113_scale-label-settings-tv-style`

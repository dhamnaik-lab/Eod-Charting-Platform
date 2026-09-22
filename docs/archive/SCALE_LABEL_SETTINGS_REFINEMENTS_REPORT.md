# Scale Label Settings Refinements Report

## Scope

This slice refines the existing bottom-right scale settings menu and right-scale label behavior. It keeps the separate value-label settings model and does not return to one global label switch.

## Changes

- Updated `src/engine/types.ts` and `src/engine/valueLabelSettings.ts`.
  - Added explicit settings for:
    - symbol name label
    - symbol previous close label
    - high/low price labels
    - indicator name labels
  - Preserved existing controls for symbol last price, overlay indicator values, compare values, indicator-pane values, and no-overlap behavior.
- Updated `src/components/ChartSettingsMenu.tsx`.
  - The `Labels` section now exposes TradingView-style separate label controls:
    - all scale labels
    - symbol name label
    - symbol last price label
    - previous close label
    - high and low price labels
    - indicator name labels
    - overlay indicator value labels
    - compare value labels
    - indicator pane value labels
    - no overlapping labels
- Updated `src/engine/ChartEngine.ts`.
  - Symbol name and last price can share one right-scale label at the symbol last close.
  - Previous close can render as a separate right-scale label when available.
  - Visible price-pane high/low can render as right-scale labels.
  - Overlay and indicator-pane value tags can include their indicator/line label when `Indicator name labels` is enabled.
  - Dynamic right-axis width measurement includes the expanded label text.

## Behavior Notes

- Default behavior remains close to the previous baseline: symbol last price, overlay indicator values, compare values, and indicator-pane values remain enabled; newly added symbol-name, previous-close, high/low, and indicator-name labels default off to avoid sudden scale clutter.
- The old `showValueLabels` compatibility path still normalizes older saved sheets.

## Backup

- `backups/pre_opencode_changes_20260524_133328_scale-label-settings-refinements`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
- `git diff --check -- src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/types.ts src/engine/valueLabelSettings.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_REFINEMENTS_REPORT.md`: PASS
- `rg -n "[ \t]+$" src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/types.ts src/engine/valueLabelSettings.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_REFINEMENTS_REPORT.md`: PASS (no trailing whitespace matches)

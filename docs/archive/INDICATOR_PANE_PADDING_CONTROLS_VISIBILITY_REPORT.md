# Indicator Pane Padding And Controls Visibility Report

## Scope

This slice polishes the existing indicator-pane area without changing pane height, legend placement, or the in-plot legend behavior.

## Changes

- Updated `src/engine/ChartEngine.ts`.
  - Indicator-pane Y-scale padding now uses `0.10` top and bottom instead of the previous `0.06 / 0.06`.
  - This gives pane indicators such as Stoch more internal breathing room so lines are less likely to touch pane borders.
  - Pane height and indicator legend positioning are unchanged.
- Updated `src/components/ChartPaneControlsOverlay.tsx`.
  - Pane action controls now default to `opacity: 0`.
  - Controls reveal to full opacity on hover and on keyboard focus within the control cluster.

## Backup

- `backups/pre_opencode_changes_20260524_132632_indicator-pane-padding-controls-hover`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

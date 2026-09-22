# Scale Menu Bounds And Indicator Padding Report

Date: 2026-05-24

## Scope

- Fix scale/settings menu clipping when opened from the bottom-right scale gear.
- Add stronger internal indicator-pane Y-scale breathing room.
- Leave chart scrollbar behavior and sheet switching untouched.

## Changes

- `src/components/ChartCanvas.tsx`
  - Computes a chart-viewport-aware maximum height for the scale settings menu.
  - Passes that height to the scale settings menu for both bottom-right gear opening and price-scale context opening.

- `src/components/ChartSettingsMenu.tsx`
  - Accepts an optional `maxHeight`.
  - Applies internal vertical scrolling so the menu remains inside the chart viewport instead of clipping off the top.

- `src/engine/ChartEngine.ts`
  - Increases indicator pane Y-scale padding from `0.10 / 0.10` to `0.12 / 0.12`.
  - Lets default fixed-range oscillator panes receive padding, so Stoch/RSI-style `0-100` lines do not map directly onto the pane borders.
  - Keeps manual pane scale overrides locked/exact.

## Preserved Behavior

- Indicator pane heights were not changed.
- Indicator legends remain inside the plot area.
- Pane controls and show/hide behavior were not changed.
- Scrollbar drag/sync and sheet switching behavior were not changed.

## Backup

- `backups/pre_opencode_changes_20260524_155849_scale-menu-indicator-padding`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS
  - Existing Vite CJS API deprecation warning remains.
  - Existing large chunk warning remains.

## Manual QA Checklist

- Open bottom-right scale settings; header should remain visible and menu should scroll internally if needed.
- Open scale settings from right-click on price scale near different vertical positions.
- Add Stoch or RSI-style indicator pane; lines should have visible breathing room from pane top/bottom.
- Confirm manual pane scale override still maps exactly to the user-selected range.

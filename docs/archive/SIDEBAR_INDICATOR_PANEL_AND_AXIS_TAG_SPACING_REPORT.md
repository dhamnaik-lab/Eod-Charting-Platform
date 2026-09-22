# SIDEBAR_INDICATOR_PANEL_AND_AXIS_TAG_SPACING_REPORT

Date: 2026-04-09

## Summary

Cleaned up the indicator sidebar and made right-axis study labels step away from the main price label more clearly.

## What Changed

- Updated `src/components/Sidebar.tsx`:
  - removed the `Active Chart` indicator chip section from the Indicators sidebar
  - the sidebar now only acts as the indicator catalog / launcher

- Updated `src/engine/Renderer.ts`:
  - extended axis value tags with a role so the renderer can treat price and study tags differently
  - changed right-axis tag stacking to keep the price label as the anchor and add more separation before stacking study labels

- Updated `src/engine/ChartEngine.ts`:
  - tagged the main last-price label as `price`
  - tagged overlay labels as `overlay`
  - tagged compare labels as `compare`
  - tagged pane indicator labels as `indicator`

## Result

- The Indicators sidebar no longer repeats the active chart’s indicators.
- The right-side price label stays in place.
- Overlay/indicator labels now step away from the price label instead of packing too tightly into the same stack.

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_143248_sidebar_indicator_axis_tag_cleanup`

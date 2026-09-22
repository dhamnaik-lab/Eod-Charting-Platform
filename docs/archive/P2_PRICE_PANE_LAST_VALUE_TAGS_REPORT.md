# P2 Price Pane Last-Value Tags Report

Date: 2026-04-08

## Scope

Completed the next P2 TradingView-style parity slice for the EOD-only chart engine:

- main price-pane right-axis last-value tags

This pass stayed narrowly focused on the active price pane and preserved the existing dashed EOD
last-price marker.

## Exact Gap Closed

Before this pass, indicator panes already had right-axis value tags, but the main price pane did
not. The price pane still relied only on the dashed last-price marker plus in-chart overlay
legends, which made it feel less complete than the lower panes.

This pass adds right-axis last-value tags for the latest price and latest overlay-study values in
the main price pane.

## What Changed

1. `src/engine/ChartEngine.ts`
   - Added price-pane value-tag rendering after `drawYAxis(...)`.
   - Added `buildPriceValueTags(...)` for:
     - the latest price bar close
     - latest overlay line values
     - latest overlay point values
   - Added `collectPricePaneLastValueSamples(...)` so right-axis width measurement also accounts
     for the new price-pane tag values.

2. Behavior preserved
   - The existing dashed EOD last-price marker remains unchanged.
   - Overlay legend behavior remains unchanged.
   - Indicator-pane value tags remain unchanged.

3. Documentation
   - Updated `README.md`
   - Updated `FILE_INVENTORY.md`
   - Updated `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
   - Updated `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Modified

- `src/engine/ChartEngine.ts`
- `README.md`
- `FILE_INVENTORY.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260408_142610_p2_price_tags`

## Validation Performed

- `npm run typecheck:renderer`
- `npm run test`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Portable output folder:
  `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Notes

- Price-pane tags use the latest real bar and latest overlay-study values rather than hover-driven
  values.
- This pass does not add compare overlays, left price scales, or extra price-pane chrome.

## Remaining P2 Follow-Up

- Compare overlays only if they remain EOD-only and local-first
- Optional expand-all / collapse-all pane affordances if they fit the current shell cleanly
- Optional broader price-pane chrome if future parity work justifies it
- Manual screenshot-driven visual parity audit against TradingView

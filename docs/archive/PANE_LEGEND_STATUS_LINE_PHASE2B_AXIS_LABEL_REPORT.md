# Pane Legend and Status-Line Phase 2B Axis Label Report

## Summary
Successfully implemented Phase 2B: right price-scale label collision handling. This resolves visual overlaps on the right Y-axis scale by establishing priority-based rendering for crosshair, current price, indicator, and standard tick labels.

## Backup created path/name
E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_225308_pane_legend_phase2b_axis_labels

## Files changed
- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Crosshair.ts`

## Exact collision-handling approach
1. **Layout Extraction**: We extracted the layout calculation logic from `drawAxisValueTags` into a standalone `computeAxisValueTagsLayout` function that returns `ResolvedAxisValueTag[]`.
2. **Pre-computation**: In `ChartEngine.ts` inside `buildRenderState`, we now pre-calculate the layout of all fixed axis tags (current price and indicators) and generate a list of `occupiedRanges` (`{ top: number, bottom: number }[]`) for each pane.
3. **Tick Skipping (Lowest Priority)**: `drawYAxis` in `Renderer.ts` now accepts `occupiedRanges`. It checks each normal Y-axis tick against these ranges and skips rendering the text if a collision is detected (padding included).
4. **Crosshair Adjustment (Highest Priority)**: `drawCrosshair` in `Crosshair.ts` now accepts `occupiedRanges`. When calculating its `priceLabelTop`, it checks against the occupied vertical space. If the crosshair moves directly over an occupied range (e.g. current price), the crosshair label intelligently pushes itself slightly above or below the range to remain fully readable without obscuring the fixed labels.

## Which labels are treated as high/medium/low priority
1. **Crosshair/Hover Label**: Highest priority. It dynamically shifts itself vertically if the user hovers over an occupied label.
2. **Current Price Label**: High priority. Placed first in the layout stack without movement (anchor).
3. **Indicator Value Labels**: Medium priority. Placed around the current price label, stacked to avoid mutual overlapping.
4. **Y-axis Tick Labels**: Lowest priority. Skipped entirely if they collide with any higher-priority label.

## How hover price label collision is handled
The `drawCrosshair` function iteratively checks its `priceLabelTop` against the `occupiedRanges` array. If a collision is found, it calculates the midpoint of the occupied range and shifts the hover label to sit just outside the range (`Math.max(2, range.top - labelHeight - 2)` or `Math.min(chartHeight - labelHeight - 2, range.bottom + 2)`). This ensures it remains visible while avoiding stacking right on top of a colored label.

## How indicator/current price labels are handled
Their stacking logic is preserved from the original `drawAxisValueTags` implementation but runs earlier in `buildRenderState`. The current price anchors its position, while indicator values stack above and below it as needed. These resolved positions are saved into `PaneContext.occupiedRanges`.

## How Y-axis tick labels are handled
During `drawYAxis`, each tick's `y` coordinate and estimated height are checked against `occupiedRanges` using a `Array.prototype.some` collision test. If the tick's bounding box overlaps, the label text rendering is bypassed, though the small tick line indicator on the axis edge is preserved.

## Validation results
- `npm run typecheck:renderer`: Passed
- `npm run tauri:check`: Passed
- `npm run build`: Passed

## Known risks/manual QA needed
- **Fast Crosshair Movements**: Adjusting the crosshair label slightly away from the mouse horizontal line could momentarily decouple the user's perception of exact value versus label value if they move rapidly.
- **Many Active Indicators**: If too many overlay indicators are active simultaneously on small screens, the `occupiedRanges` may cover the entire Y-axis, causing all tick labels to be hidden.

## Explicit confirmation
- **Scrollbar logic**: Not modified.
- **Sheet switching logic**: Not modified.
- **Workspace persistence**: Not modified.
- **Indicator formulas**: Not modified.
- **TradingView-style legend buttons**: Not modified.

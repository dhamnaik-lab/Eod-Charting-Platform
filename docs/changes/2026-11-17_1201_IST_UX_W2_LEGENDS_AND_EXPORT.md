# UX audit W2 | Legends And Export

17 November 2026 at 12:01 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_114624_ux_f10, pre_opencode_changes_20261117_114747_ux_f03_f07_f15_f23, pre_opencode_changes_20261117_115823_ux_f04_f05_f06, pre_opencode_changes_20261117_120039_ux_f05_test. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-03 | Collapsing an indicator pane hides its canvas legend readout entirely

src/engine/ChartEngine.ts:2765. Paints a clipped selected-bar readout for collapsed and expanded panes.

Changed paths include `src/engine/ChartEngine.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f03-f07-after.log [npm.cmd test -- src/components/__tests__/ChartPaneControlsOverlay.test.tsx src/engine/__tests__/ChartLayerPartition.test.ts src/features/charts/__tests__/indicatorPaneScaleStatusB23.test.tsx; Tests  14 passed (14)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-04 | VWAP / AVWAP / VWMA silently render blank cells on zero-volume or index bars

src/components/ChartPriceLegendOverlay.tsx:691. Shows an unavailable indicator value for VWAP/AVWAP/VWMA gaps; calculations and real zero-volume OHLCV remain intact.

Changed paths include `src/components/ChartPriceLegendOverlay.tsx`, `src/components/__tests__/ChartPriceLegendOverlay.test.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f04-f23-direct.log [npm.cmd test -- src/components/__tests__/ChartPriceLegendOverlay.test.tsx; Tests  9 passed (9)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-05 | Pane value tags reuse formatPrice → 9-digit strings, 132 px axis tax on every pane

src/engine/ChartEngine.ts:171. Indian compact signed magnitudes in volume pane legend, tags and ticks. Price overlays retain adaptive price formatting.

Changed paths include `src/engine/ChartEngine.ts`, `src/engine/Renderer.ts`, `src/engine/__tests__/ChartMarketPriceFormatting.test.ts`, `src/engine/__tests__/VolumePaneReadouts.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f05-rerun.log [npm.cmd test -- src/engine/__tests__/ChartMarketPriceFormatting.test.ts src/engine/__tests__/ScaleManager.test.ts src/features/charts/__tests__/indicatorPaneScaleStatusB23.test.tsx; Tests  19 passed (19)] | f06-after.log [npm.cmd test -- src/engine/__tests__/VolumePaneReadouts.test.ts src/engine/__tests__/IndicatorsChaining.test.ts; Tests  3 passed (3)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-06 | CVD and UP_DOWN_VOL duplicate the same value as both line and histogram tags

src/engine/ChartEngine.ts:161. CVD and Up/Down Volume duplicate readouts are suppressed only when the matching line is displayed with the same value.

Changed paths include `src/engine/ChartEngine.ts`, `src/indicators/base.ts`, `src/indicators/standard/volume/cumulative-volume-delta.ts`, `src/indicators/standard/volume/up-down-volume.ts`, `src/engine/__tests__/VolumePaneReadouts.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f06-after.log [npm.cmd test -- src/engine/__tests__/VolumePaneReadouts.test.ts src/engine/__tests__/IndicatorsChaining.test.ts; Tests  3 passed (3)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-07 | indicatorLegendHeight = 0 — plots can paint over the pane legend header

src/engine/ChartEngine.ts:2035. Current plot layout reserves an existing 28 px legend area, bounded by available pane height. Pane data and label geometry share the inset.

Changed paths include `src/engine/ChartEngine.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f03-f07-after.log [npm.cmd test -- src/components/__tests__/ChartPaneControlsOverlay.test.tsx src/engine/__tests__/ChartLayerPartition.test.ts src/features/charts/__tests__/indicatorPaneScaleStatusB23.test.tsx; Tests  14 passed (14)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-10 | Screenshot legend export clips all legend rows below y > 112 px

src/features/charts/chartScreenshotLegendRenderer.ts:50. Exports every fitting secondary row, with an explicit overflow count when capacity is limited. UI summary cap retained and mock canvas verifies 8 rows.

Changed paths include `src/components/ChartPriceLegendOverlay.tsx`, `src/features/charts/chartScreenshotLegendRenderer.ts`, `src/features/charts/__tests__/chartScreenshotLegendRenderer.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f10-after.log [npm.cmd test -- src/features/charts/__tests__/chartScreenshotLegendRenderer.test.ts src/components/__tests__/ChartPriceLegendOverlay.test.tsx; Tests  9 passed (9)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-15 | “Status line” section actually edits Y-axis value labels — naming trap

src/components/ChartSettingsDialog.tsx:482. Labels the draft section and master toggle as axis value labels.

Changed paths include `src/components/ChartSettingsDialog.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f15-f23-after.log [npm.cmd test -- src/features/charts/__tests__/chartSettingsDraftF14.test.ts src/components/__tests__/ChartPriceLegendOverlay.test.tsx src/store/__tests__/uiStore.test.ts; Tests  16 passed (16)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-23 | View → OHLCV Bar toggles a dead component

src/components/ChartCanvas.tsx:175. The native toggle now changes OHLCV segments in chart and screenshot. Titles and study actions remain usable.

Changed paths include `src/components/ChartCanvas.tsx`, `src/components/ChartPriceLegendOverlay.tsx`, `src/components/__tests__/ChartPriceLegendOverlay.test.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f15-f23-after.log [npm.cmd test -- src/features/charts/__tests__/chartSettingsDraftF14.test.ts src/components/__tests__/ChartPriceLegendOverlay.test.tsx src/store/__tests__/uiStore.test.ts; Tests  16 passed (16)] | f04-f23-direct.log [npm.cmd test -- src/components/__tests__/ChartPriceLegendOverlay.test.tsx; Tests  9 passed (9)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

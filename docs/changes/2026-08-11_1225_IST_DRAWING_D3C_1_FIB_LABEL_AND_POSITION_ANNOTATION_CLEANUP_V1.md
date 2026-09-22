# Drawing D3C.1 — Fib Label and Position Annotation Cleanup V1

**IST timestamp:** 2026-08-11 12:25 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_120835_IST`  
**Baseline ZIP SHA-256:** `8cf0b7e74d6d88c41734f58d0d199c2a327129ee03774077e8a9c92e263b8c22`

## Objective

Correct two visible post-D3C drawing-quality defects before beginning the unified TradingView-style Properties/Style architecture:

1. Fibonacci / level text must not sit directly on top of its drawing stroke and must remain readable without restoring a filled label background.
2. Long/Short Position Target / Entry / Stop text must render as clean inline level annotations (`--- text ---`) rather than floating labels, and the old debug-style orientation warning must not appear on the chart.

## Observed limitation

Manual post-grouped-dock review showed:

- Fib Retracement labels visually intersected their horizontal level strokes and the 10px text/3px halo treatment was difficult to read.
- Long Position rendered separate floating annotations and could display the internal guidance string `Check target / stop orientation` on the chart.
- These issues were renderer/layout concerns; drawing geometry, persistence, symbol/sheet scoping, timeframe remapping and the grouped dock were otherwise accepted.

## External reference review

This change uses a deliberately hybrid approach rather than copying one platform.

- TradingView Fib Retracement exposes independent label position along the level, font size, Prices/Levels visibility and per-level styling. The documented Style UI includes left/right level placement and adjustable font size.  
  https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/
- TradingView Long Position uses separate profit/loss zones, target/stop/entry statistics, configurable text size/color, compact stats and target/stop colors.  
  https://www.tradingview.com/support/solutions/43000517002-long-position-drawing-tool/
- TradingView's Long/Short guide documents target/stop offsets and risk/reward as first-class displayed information.  
  https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/
- TrendSpider Auto Fib supports explicit text alignment choices (Top Left, Bottom Left, Top Right, Bottom Right), reinforcing that level labels should have both horizontal and vertical placement semantics.  
  https://help.trendspider.com/kb/automated-technical-analysis/customization-and-tuning
- thinkorswim Fib Retracement exposes where coefficients/prices are shown and gives each Fib curve line independent color/style/width properties.  
  https://toslc.thinkorswim.com/center/reference/Drawings/Fibonacci/Fibonacci-Retracements
- Sierra Chart exposes horizontal/vertical label alignment and transparent-vs-opaque label backgrounds, including top/bottom/center vertical label choices.  
  https://www.sierrachart.com/index.php?page=doc%2FTools.html
- MetaTrader 5 exposes a dedicated Fibonacci Levels configuration and supports showing price values in Fib descriptions.  
  https://www.metatrader5.com/en/terminal/help/objects/fibo/fibo_retracement

No external source code was copied.

## Files changed

### Modified

- `src/engine/Renderer.ts`
- `src/engine/DrawingLabelLayout.ts`
- `src/engine/__tests__/DrawingLabelLayout.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

### Created

- `src/engine/__tests__/DrawingD3C1Contracts.test.ts`
- `docs/changes/2026-08-11_1225_IST_DRAWING_D3C_1_FIB_LABEL_AND_POSITION_ANNOTATION_CLEANUP_V1.md`

## Final implementation

### Fib / level labels

`DrawingLabelLayout.ts` now supports explicit vertical placement:

- `center`
- `above`
- `below`

For an `above` request, the layout first tries to place the label fully above the stroke. If the chart's top edge does not have enough room, it tries below the stroke before final viewport clamping. The same symmetric fallback applies to `below`.

Horizontal/sloped Fib and fan labels that previously sat centered on the line now request `above` placement. This includes the applicable paths for:

- Fib Retracement
- Fib Extension
- Trend-Based Fib Extension
- Fibonacci Channel
- Fibonacci Wedge
- Fib Circles
- Fib Arcs
- Fib Fan / Gann Fan
- Pitchfan
- Projection target label

Time-zone labels retain their existing side-of-vertical-line placement because they are not the horizontal-line overlap defect shown in manual testing.

Drawing-level label typography changes from 10px to **12px semibold**. The filled background remains absent. The outline/halo is reduced from 3px to 2px to improve glyph sharpness instead of producing a heavy glow.

### Long / Short Position

A new reusable pure layout function, `computeInlineHorizontalLabelLayout`, reserves a centered text gap in a horizontal line. The renderer draws the left and right stroke segments around that gap and then centers the annotation inside it.

The three displayed lines become conceptually:

```text
---- Target 820.00 (+6.35%) ----
---- LONG · Entry 771.00 · R:R 2.10 ----
---- Stop 747.00 (-3.11%) ----
```

Short Position uses `SHORT` in the entry annotation.

The chart no longer renders the internal `Check target / stop orientation` guidance text. Existing risk/reward calculations and anchor semantics are preserved in this focused visual pass; no broker/account/risk-management behavior is introduced.

When `Show Label` is disabled, the position lines remain full uninterrupted lines exactly as before.

## Behavior deliberately preserved

- all 48 persisted drawing kinds;
- grouped Drawing Tool Dock and per-group last-used UI state;
- D3B.2 default Left / optional Right level placement;
- no filled numeric-label background;
- Show Label behavior;
- common drawing color / width / line-style properties;
- per-symbol and per-sheet drawing scopes;
- timeframe and Renko anchor identity/remapping;
- drawing lock/delete protection;
- workspace backward compatibility;
- existing drawing-alert whitelist;
- Long/Short Position remains chart-planning only with no broker execution or account authority.

## Validation performed before packaging

- TypeScript/TSX syntax transpilation for changed/new source/test files: **PASS**
- deterministic above-line layout harness: **PASS**
- top-edge vertical fallback harness: **PASS**
- inline `--- text ---` gap layout harness: **PASS**
- right-edge/viewport clamping regression harness: **PASS**
- renderer source check confirms `Check target / stop orientation` is absent: **PASS**
- grouped-dock source remains unchanged by this patch: **PASS**

## Windows validation to run after application

```powershell
npm test -- `
  'src/engine/__tests__/DrawingD3C1Contracts.test.ts' `
  'src/engine/__tests__/DrawingLabelLayout.test.ts' `
  'src/components/__tests__/DrawingToolGroups.test.ts' `
  'src/components/__tests__/ChartToolDockTooltips.test.ts' `
  'src/engine/__tests__/DrawingD3CGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3CContracts.test.ts' `
  'src/engine/__tests__/DrawingD3B2Contracts.test.ts' `
  'src/engine/__tests__/DrawingD3BGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3BContracts.test.ts' `
  'src/engine/__tests__/DrawingMultiAnchorGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3AContracts.test.ts' `
  'src/engine/__tests__/DrawingCapabilities.test.ts' `
  'src/engine/__tests__/DrawingAdvancedGeometry.test.ts' `
  'src/engine/__tests__/DrawingD2Contracts.test.ts' `
  'src/engine/__tests__/DrawingGeometry.test.ts' `
  'src/engine/__tests__/DrawingD1Contracts.test.ts' `
  'src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts' `
  'src/engine/__tests__/DrawingMagnet.test.ts' `
  'src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts' `
  'src/features/charts/__tests__/drawingScopeService.test.ts' `
  'src/features/charts/__tests__/chartInstrumentDrawingScopes.test.ts' `
  'src/features/charts/__tests__/chartSheetWorkspaceService.test.ts' `
  'src/features/charts/__tests__/chartTabStateMutationService.test.ts' `
  'src/features/charts/__tests__/drawingLockProtection.test.ts' `
  'src/features/workspace/__tests__/workspacePersistence.test.ts' `
  'src/features/alerts/__tests__/eodAlerts.test.ts'

npm run typecheck:renderer
npm run build:renderer
```

## Risks / limitations

- The larger TradingView-style Style settings system is intentionally not implemented here. Per-level colors, editable Fib ratios, font-size user controls, top/bottom user controls, and independent multi-line styling remain for the unified settings phase.
- Long/Short Position still uses the existing three-anchor model and existing metric semantics. This pass removes visual debug guidance but does not redesign creation mechanics.
- Exact visual acceptance requires a later portable/manual check on both candle and Renko charts.

## Rollback

Use the installer-created targeted backup to restore the modified existing files. Remove the new D3C.1 contract test/report if a complete rollback is required.

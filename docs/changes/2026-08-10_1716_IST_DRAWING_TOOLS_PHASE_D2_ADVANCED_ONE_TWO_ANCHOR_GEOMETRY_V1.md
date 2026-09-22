# Drawing Tools Phase D2 — Advanced One/Two-Anchor Geometry V1

**IST timestamp:** 2026-08-10 17:16 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-10_170038_IST`  
**Baseline ZIP SHA-256:** `e1b320918d0221743d5d4d3e819c7cfd5fc3425ce37fec726d8c9cb3f1610f1f`

## Objective

Implement Drawing Tools Phase D2 using the existing native Canvas chart/drawing architecture after the accepted D1/D1.1 baseline. D2 adds advanced one/two-anchor geometry without introducing generalized 3/4-anchor storage or a second chart runtime.

## Previous limitation

The accepted platform had the original drawing set plus the seven D1 additions, but lacked advanced regression, radial/time Fibonacci, Gann-box, basic curved-shape, manual forecast, and one-point arrow-marker tools identified in the uploaded drawing-reference repository.

The reference repository targets TradingView Lightweight Charts v5, while the EOD platform uses its own `ChartEngine` / `Renderer` Canvas pipeline. Direct package installation or replacement of the native drawing engine would therefore create duplicate architecture and unnecessary regression risk.

## Files inspected

- `AGENTS.md`
- `HANDOFF.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/DrawingGeometry.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/features/charts/drawingTimeframeAnchorService.ts`
- D1/D1.1 drawing, workspace, magnet, timeframe and alert tests
- uploaded `lightweight-charts-drawing-main` tool registry and relevant D2 reference implementations

## Files created

- `src/engine/DrawingAdvancedGeometry.ts`
- `src/engine/__tests__/DrawingAdvancedGeometry.test.ts`
- `src/engine/__tests__/DrawingD2Contracts.test.ts`
- this report

## Files modified

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/features/charts/drawingTimeframeAnchorService.ts`
- `src/engine/__tests__/DrawingMagnet.test.ts`
- `src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts`
- `src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts`
- `HANDOFF.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-08-10_1631_IST_DRAWING_TOOLS_PHASE_D1_1_RUNTIME_ACCEPTANCE_FIXES_V1.md` (post-report manual acceptance note only)

## Final implementation

### 1. Regression Trend

Adds a two-bar selection that calculates a least-squares regression over the **displayed bars' close prices** for the inclusive selected range.

The native helper calculates:

- center regression line;
- slope per displayed bar;
- population RMS residual standard deviation;
- upper/lower bands at ±2 residual standard deviations.

The renderer shows the channel fill, center/band lines and a concise LR/2σ/slope label. Hit testing uses the actual three regression lines rather than the original clicked Y coordinates.

### 2. Fibonacci Time Zone

Adds two-anchor Fibonacci time projections using the anchor-index interval and Fibonacci sequence multiples:

`0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89`

Only projected lines inside/near the current viewport are rendered/hit-tested. The tool remains price-pane-only because it is a chart-time construction rather than an indicator-pane annotation.

### 3. Fibonacci Circles

Adds concentric screen-space circles centered on the first anchor with the second anchor defining the base radius. Levels:

`0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618`

The circles are regenerated from chart anchors during zoom/pan rather than persisted as raw pixels.

### 4. Fibonacci Arcs

Adds oriented semicircular Fibonacci arcs using the first anchor as pivot and the second anchor as base extent. Levels:

`0.236, 0.382, 0.5, 0.618, 0.786, 1`

Hit testing checks both radial distance and the visible arc half-plane so the invisible backside is not selectable.

### 5. Gann Box

Adds a two-corner price/time box with internal horizontal/vertical ratio lines and diagonals. V1 ratios are:

`0, 0.25, 1/3, 0.5, 2/3, 0.75, 1`

This is a native geometric Gann Box drawing. It does not change the existing Gann Fan.

### 6. Circle and Ellipse

Adds:

- `Circle`: first anchor is center, second anchor sets screen-space radius;
- `Ellipse`: two anchors define opposite corners of the axis-aligned ellipse bounds.

Both redraw from chart-space anchors across zoom/pan and use geometry-aware hit testing.

### 7. Forecast

Adds a two-point **manual projection drawing** showing the selected start/target relationship and percentage change. It is intentionally not described or implemented as a statistical/AI prediction model.

### 8. Arrow Marker / Arrow Up / Arrow Down

Adds three one-click, price-anchored marker tools:

- outlined Arrow Marker;
- filled Arrow Up;
- filled Arrow Down.

They participate in existing timestamp remapping, magnet behavior, selection, dragging, locking, persistence and Drawing Properties.

### 9. Timeframe-stable anchors

D2 point markers were added to the D1.1 one-point timestamp-remap path. All D2 two-anchor tools use the existing generalized anchored-drawing remap path, retaining `startTimestamp` / `endTimestamp` so Daily → Weekly/Monthly/etc. → Daily can restore deterministic source dates.

### 10. Properties/color standard

All D2 tools use the accepted D1.1 Drawing Properties draft-color → **Save** workflow. There is no D2-specific color popup or second commit path.

The D2 tools expose the existing common color/line width/line style/lock controls. Where start/end price editing is not semantically meaningful (for example Regression Trend and Fibonacci Time Zone), the dialog keeps style/lock controls without exposing misleading price fields.

### 11. Alert isolation

Drawing alerts remain deliberately restricted to the pre-existing whitelist:

- Horizontal Line
- Trend Line
- Ray

No D2 tool automatically becomes a persisted alert source.

### 12. Fib Speed Resistance Fan decision

A separate `Fib Speed Resistance Fan` is **not** added in D2 V1.

The uploaded implementation uses the same two-anchor slope-fan construction already provided by the current Fib Fan; its principal differences are a ratio set (`0.25, 0.382, 0.5, 0.618, 0.75, 1, 1.618, 2, 4`) and optional fill/label behavior. A second persisted kind would create near-duplicate UX and workspace complexity without a distinct geometry model.

If desired later, ratio/style customization can be added to the existing Fib Fan during the dedicated Drawing Settings work.

## Behaviour deliberately preserved

- all original drawing kinds and saved-workspace schemas;
- all seven D1 drawing kinds;
- D1.1 timestamp-anchor behavior;
- locked-drawing deletion protection;
- unified Drawing Properties color-save behavior;
- existing Measure semantics;
- existing two-anchor Fibonacci Extension;
- existing Fibonacci Fan and Gann Fan;
- existing drawing-alert whitelist;
- current magnet behavior;
- existing Renko anchor metadata and reconciliation paths;
- current custom Canvas chart engine;
- SMA indicator-cache correction;
- no `lightweight-charts` runtime dependency.

## Tests added/extended

- `DrawingAdvancedGeometry.test.ts`
  - exact linear regression;
  - symmetric residual-deviation bands;
  - forward/reverse Fibonacci time zones;
  - triangle inclusion;
  - ellipse-boundary distance.
- `DrawingD2Contracts.test.ts`
  - all 11 approved D2 tool identifiers;
  - no D2 drawing enters the alert whitelist;
  - no duplicate Fib Speed Fan persisted kind.
- `DrawingWorkspaceCompatibility.test.ts`
  - D2 drawing kinds round-trip through existing workspace persistence.
- `drawingTimeframeAnchorService.test.ts`
  - D2 one-point markers remap by timestamp;
  - D2 two-anchor D → W → D restoration.
- `DrawingMagnet.test.ts`
  - D2 price anchors/markers continue using existing price-pane magnet rules;
  - indicator-pane drawing anchors remain unsnapped.

## Validation performed in implementation environment

### TypeScript/TSX syntax transpilation

Changed/new TypeScript and TSX files were parsed/transpiled with the available TypeScript compiler API.

**Result:** PASS for the inspected D2 source/test files.

### Deterministic advanced-geometry harness

Validated:

- linear regression slope and zero residual deviation;
- Fibonacci time-zone index projection;
- marker triangle inclusion;
- ellipse boundary distance.

**Result:** `DrawingAdvancedGeometry deterministic harness: PASS`.

### Dependency/full-project validation limitation

An attempt to obtain the project dependency tree with `npm ci --ignore-scripts --prefer-offline` in the extracted implementation snapshot could not complete because the execution environment's npm mirror returned a 404 for `zustand-4.5.7.tgz`.

Therefore the following are **not claimed** in the implementation environment:

- Vitest project suite;
- renderer TypeScript project typecheck;
- renderer production build;
- Tauri/Rust build;
- portable Windows package;
- manual runtime acceptance.

These must run against the user's actual Windows project.

## Required Windows validation

Minimum focused tests:

```powershell
npm test -- `
    "src/engine/__tests__/DrawingAdvancedGeometry.test.ts" `
    "src/engine/__tests__/DrawingD2Contracts.test.ts" `
    "src/engine/__tests__/DrawingGeometry.test.ts" `
    "src/engine/__tests__/DrawingD1Contracts.test.ts" `
    "src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts" `
    "src/engine/__tests__/DrawingMagnet.test.ts" `
    "src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts" `
    "src/features/alerts/__tests__/eodAlerts.test.ts"

npm run typecheck:renderer
npm run build:renderer
```

After automated PASS:

```powershell
npm run tauri:portable:win
```

## Manual acceptance checklist

For every D2 tool:

1. create / preview / commit;
2. select and drag;
3. drag available anchors;
4. Properties color change → Save;
5. line width/style where applicable;
6. lock, verify deletion is refused, unlock, delete;
7. zoom and pan;
8. save/reload workspace;
9. change symbols;
10. Daily → Weekly → Monthly → Daily where practical;
11. spot-check Renko only for tools the runtime allows there.

Specific checks:

- Regression Trend follows close-price regression and recalculates for the active displayed timeframe.
- Fibonacci Time Zone projects in the direction established by the two anchors.
- Fib Circles/Arcs remain anchored after zoom/pan and timeframe changes.
- Gann Box remains editable from both original corners.
- Forecast is presented only as a manual projection.
- Arrow Up/Down orientation remains correct while dragging and after timeframe switching.
- Existing D1 and original tools remain operational.

## Risks / limitations

1. Regression Trend is defined on **displayed timeframe close bars**. Its numerical regression can therefore legitimately differ between Daily and Weekly because the samples differ; returning to Daily restores the original anchor dates and Daily calculation.
2. Fibonacci Circles/Arcs and Circle use screen-space radial geometry derived from chart anchors. They remain anchored, but their apparent radii naturally change with chart X/Y scaling.
3. The Gann Box V1 is a geometric ratio grid inside the user-selected price/time rectangle. It does not claim a separate market-calibrated unit normalization beyond the selected chart coordinates.
4. Forecast is manual geometry, not a forecast-quality model.
5. D2 does not add separate stroke/fill/text color controls; the common color setting is intentionally standardized. More granular styling belongs in the later Drawing Settings UX work.
6. D3 generalized multi-anchor work must not begin until D2 passes Windows automated and manual runtime acceptance.

## Rollback guidance

Use the installer-created pre-change backup. Restore the modified files listed above and remove the D2-created `DrawingAdvancedGeometry.ts`, D2 tests and this report. Do not roll back the accepted SMA fix or D1/D1.1 work when reverting D2 only.

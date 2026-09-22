# Settings S2.1 — Advanced Drawing Style UI: Regression + Channels V1

**IST timestamp:** 2026-08-11 13:56 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_133728_IST`  
**Baseline ZIP SHA-256:** `60b419e6b03482ead1efbb3d5625488830c060a6585e8c8b8ce68c70362cebe6`

## Objective

Activate the Settings S1 unified visual-style foundation for the first high-value multi-component drawing family without broadening the change to every drawing tool.

S2.1 makes advanced per-component Style settings visible and renderer-effective for:

1. Regression Trend
2. Parallel Channel
3. Flat Top/Bottom Channel
4. Disjoint Channel

## Reference review

The UI/behavior is deliberately hybrid rather than a direct clone.

- TradingView Regression Trend exposes separate Base / Up / Down line appearance and visibility, plus extension and correlation-label controls.
- TradingView Parallel Channel exposes per-level color, opacity, thickness, style and visibility, plus independent background fill color/opacity and left/right extension.
- thinkorswim Regression Channel exposes per-deviation-line Visible / Color / Style / Width properties and additional regression calculation controls.

Primary official references reviewed:

- https://www.tradingview.com/support/solutions/43000518108-regression-trend-drawing-tool/
- https://www.tradingview.com/support/solutions/43000518117-parallel-channel-drawing-tool/
- https://toslc.thinkorswim.com/center/reference/Drawings/Regression/Regression-Channel

No external source code was copied.

## S1 validation reconciled

The baseline already contains Settings S1. The user's Windows validation after S1 application was:

- focused Vitest: **32/32 files PASS**
- tests: **133/133 PASS**
- renderer TypeScript typecheck: **PASS**
- renderer production build: **PASS**
- production build modules transformed: **592**

S2.1 updates project status documentation to reflect that result.

## Files changed

### Modified

- `src/engine/DrawingStyleSchema.ts`
- `src/engine/Renderer.ts`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/__tests__/DrawingStyleSchema.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

### Created

- `src/engine/__tests__/DrawingS21Contracts.test.ts`
- `docs/changes/2026-08-11_1356_IST_SETTINGS_S2_1_ADVANCED_DRAWING_STYLE_REGRESSION_CHANNELS_V1.md`

## Advanced Style UI

For the four S2.1 drawing kinds, the Properties dialog now shows a wider structured Style editor instead of the old single Color / Line Style / Line Width controls.

Each line component exposes:

- visibility checkbox;
- independent color;
- line width;
- solid / dashed / dotted style;
- opacity percentage.

The dialog also exposes:

- `Use one color`;
- one common/handle color;
- fill visibility;
- fill color;
- fill opacity.

Existing controls such as Lock Position, Extend Left, Extend Right and Show Label remain in the same Properties workflow where the drawing capability supports them.

### Use one color semantics

`Use one color` affects line colors only. Width, line style, visibility and opacity remain independent per component.

When `Use one color` is enabled, component color controls are disabled and the drawing's common color is used by the renderer. Saved independent colors are retained under the override so turning `Use one color` off can restore them.

Legacy drawings with no `presentation` settings open with `Use one color` enabled. Drawings that already contain independent S1 line overrides and omit the flag remain independent rather than being silently collapsed to one color.

## Renderer binding

S2.1 binds the S1 resolved line/fill presentation to actual canvas output.

### Regression Trend

Components:

- Upper
- Basis
- Lower
- Channel Fill

Legacy rendering is preserved when no advanced overrides exist:

- upper/lower inherit the drawing line style;
- basis remains solid;
- missing regression line width retains the prior 1.5px fallback;
- channel fill remains visible at 8% opacity.

### Parallel Channel

Components:

- Base
- Middle
- Parallel
- Channel Fill

Legacy rendering is preserved when no advanced overrides exist:

- Base and Parallel inherit the existing drawing line style;
- Middle remains dashed with the prior 6/4 dash geometry;
- Channel Fill remains off by default;
- the prior selection-only channel highlight remains when Fill is disabled.

Unlike the legacy renderer, the user can now explicitly enable a persistent channel fill.

### Flat Top/Bottom Channel

Components:

- Trend Line
- Flat Line
- Channel Fill

Legacy channel fill remains visible at 8% opacity unless changed.

### Disjoint Channel

Components:

- First Line
- Second Line
- Channel Fill

Legacy channel fill remains visible at 8% opacity unless changed.

## Compatibility correction in S1 resolver

S2.1 corrects one S1 resolver edge case discovered while activating the UI: a component whose schema default was hidden could not previously be explicitly changed to visible because resolution used `override !== false && default`.

Resolution now uses the explicit override when present and otherwise falls back to the schema default. This is required for Parallel Channel Fill, whose legacy default is hidden but must be user-enableable.

## Deliberately deferred

S2.1 does **not** yet activate advanced Style controls for:

- Pitchforks / Pitchfan;
- Fibonacci / Gann families;
- Long / Short Position;
- shapes;
- single-line tools;
- indicators.

It also does not activate the future `Coordinates` and `Visibility` tabs. Those remain part of the staged S2/S3 roadmap.

## Behavior preserved

- all 48 persisted drawing kinds;
- grouped Drawing Tool Dock;
- D3C.1 label-spacing and Long/Short annotation cleanup;
- per-symbol/per-sheet drawing scoping;
- timeframe/Renko anchor persistence;
- drawing lock/delete protection;
- current drawing-alert whitelist;
- existing indicator rendering/settings behavior;
- workspace JSON compatibility;
- no broker/order/account authority added.

## Preparation validation before packaging

Performed on the extracted authoritative snapshot:

- TypeScript/TSX syntax transpilation for all changed/new source and test files: **PASS**
- S2.1 schema runtime harness: **PASS**
- advanced family registry is limited to exactly four kinds: **PASS**
- legacy Parallel Channel middle-line dashed default: **PASS**
- legacy Parallel Channel fill hidden default: **PASS**
- explicit hidden-default fill → visible override: **PASS**
- legacy Regression fill visible at 8% opacity: **PASS**
- legacy/independent `Use one color` draft semantics: **PASS**
- source-level renderer binding contract: **PASS**

Full Windows Vitest/typecheck/build is intentionally left to the project machine.

## Windows validation target

The guarded installer runs the new S2.1 contracts plus S1, D3C.1, grouped-dock, drawing persistence/scope/lock and indicator-cache regression coverage, followed by:

```powershell
npm run typecheck:renderer
npm run build:renderer
```

## Manual acceptance after automated PASS

A later combined portable/manual check should verify:

1. Regression Trend: Upper/Basis/Lower independently hide/show and accept separate colors/width/style/opacity.
2. Parallel Channel: Base/Middle/Parallel independently style; Middle remains dashed by default; Channel Fill is off by default but can be enabled.
3. Flat Top/Bottom and Disjoint Channel: line/fill controls work independently.
4. `Use one color` disables component color pickers and applies the common color without discarding saved independent colors.
5. Extend Left/Right, lock, labels, selection/editing and persistence remain intact.

## Rollback

Use the installer-created targeted backup to restore modified existing files and remove the two new S2.1 files if a complete rollback is required.

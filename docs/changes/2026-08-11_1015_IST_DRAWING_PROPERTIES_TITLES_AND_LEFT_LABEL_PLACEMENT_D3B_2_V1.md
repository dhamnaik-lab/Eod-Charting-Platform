# Drawing Properties Titles and Left Label Placement — D3B.2 V1

**IST timestamp:** 2026-08-11 10:15 IST  
**Project:** EOD Charting Platform  
**Baseline:** post-D3B.1 V1 state reconstructed exactly from `Eod Charting Platform Source Code 2026-08-11_022259_IST` plus the validated D3B.1 payload  
**Scope:** drawing Properties dialog identification and numeric/level-label presentation only

## Objective

Apply the manual-acceptance refinements requested after D3B.1:

1. identify the selected tool in the Properties dialog header;
2. make left-side numeric/level labels the default where side placement is geometrically meaningful;
3. remove the filled label background introduced by D3B.1;
4. expose a persisted Left / Right label-position choice for applicable drawings.

## Defect / limitation

D3B.1 successfully made level labels readable and viewport-safe, but its filled blue label boxes were visually heavy and the default placement remained concentrated near the right/current-price side for important Fibonacci drawings. That competes with latest candles, the current-price marker, the price axis, and forward chart margin.

The generic `Drawing Properties` title also did not identify which selected drawing was being edited.

## Files changed

### Modified
- `src/engine/types.ts`
- `src/engine/DrawingCapabilities.ts`
- `src/engine/DrawingLabelLayout.ts`
- `src/engine/Renderer.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`

### Created
- `src/engine/DrawingMetadata.ts`
- `src/engine/__tests__/DrawingD3B2Contracts.test.ts`
- `docs/changes/2026-08-11_1015_IST_DRAWING_PROPERTIES_TITLES_AND_LEFT_LABEL_PLACEMENT_D3B_2_V1.md`

## Final implementation

### Tool-specific Properties title

The dialog now uses `<Tool Name> Properties`, for example:

- `Trend-Based Fib Extension Properties`
- `Fibonacci Retracement Properties`
- `Andrews' Pitchfork Properties`
- `Horizontal Line Properties`

A shared persisted-drawing title map was added for future reuse by the planned grouped drawing-tool UI.

### Left-side default

A backward-compatible optional drawing property was added:

```ts
labelPosition?: 'left' | 'right'
```

When omitted, supported drawings resolve to `left`. Existing saved workspaces therefore require no migration and immediately adopt the new default.

The explicit side selector is currently exposed only where Left / Right has a stable, non-overlapping geometric meaning:

- Fibonacci Retracement
- Fibonacci Extension
- Fib Time Zone
- Fib Circles
- Fib Arcs
- Trend-Based Fib Extension
- Fibonacci Channel
- Trend-Based Fib Time
- Fibonacci Wedge

Fan families (`Fib Fan`, `Gann Fan`, `Pitchfan`) retain their current non-overlap label placement for now because multiple rays converge on a common pivot; forcing all labels to the pivot-side endpoint would stack them on top of one another. Their richer label-position model belongs in the later TradingView-style Style settings phase.

### No filled label background

The D3B.1 rounded filled label box was removed. Numeric labels now render as line-color text with a compact high-contrast outline/halo. The existing viewport-safe label bounding calculation remains in use, so labels still clamp inside the chart.

### Left/right line-end semantics

For horizontal/sloped level segments, `Left` means the label is attached to the left end of the level and placed inward from that edge. `Right` does the inverse. This avoids placing the default labels in the latest-price corridor.

Time-level drawings place the label immediately to the selected side of each vertical line. Radial drawings use the selected left/right side of the circle/arc geometry.

## Behavior preserved

- all D1/D2/D3A/D3B drawing geometry;
- D3B.1 viewport clamping;
- `Show Label` behavior;
- symbol/sheet drawing scopes;
- timeframe and Renko anchor persistence;
- lock/delete protection;
- standardized drawing color workflow;
- D3A.1 name-only tool hover;
- drawing alert whitelist;
- workspace backward compatibility.

## Validation commands

```powershell
npm test -- "src/engine/__tests__/DrawingD3B2Contracts.test.ts" "src/engine/__tests__/DrawingLabelLayout.test.ts" "src/engine/__tests__/DrawingD3BGeometry.test.ts" "src/engine/__tests__/DrawingD3BContracts.test.ts" "src/engine/__tests__/DrawingCapabilities.test.ts" "src/components/__tests__/ChartToolDockTooltips.test.ts" --exclude **/EOD_Chart_Drawing_Tools_Phase_*/**
npm run typecheck:renderer
npm run build:renderer
```

## Validation performed before delivery

- modified/new TS/TSX syntax transpilation: **PASS**;
- deterministic default-left / explicit-right runtime harness: **PASS**;
- tool-title runtime harness: **PASS**;
- exact post-D3B.1 baseline hash guards: **PASS** during package construction;
- simulated post-copy SHA-256 verification: **PASS** during package construction;
- payload/outer ZIP integrity: **PASS** during package construction;
- Windows Vitest/typecheck/build: **pending user execution**.

## Risks

Low-to-moderate UI risk. The persisted schema change is optional/backward-compatible. The primary manual risk is visual preference for exact text offset on unusually narrow drawings; viewport clamping remains active.

## Rollback

Use the installer-created pre-change backup to restore the six modified existing files, and remove the two new source/test files plus this report if a complete rollback is required.

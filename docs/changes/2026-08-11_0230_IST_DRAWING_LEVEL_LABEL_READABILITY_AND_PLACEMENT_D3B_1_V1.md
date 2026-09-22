# Drawing Level Label Readability and Placement — D3B.1 V1

**IST timestamp:** 2026-08-11 02:30 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_022259_IST`  
**Baseline ZIP SHA-256:** `49723ba94733e68eaf215bcb306e685c64cca126fba00e091c3633b8589823b1`

## Objective

Correct the post-D3B manual-readability defect where Fibonacci/ratio values can be difficult to read or clip against the chart edge, especially the Trend-Based Fib Extension labels shown near the right side of the plot.

The correction is a shared renderer/layout change. It does not alter drawing geometry, stored anchors, level mathematics, tool identities, drawing scopes, or Properties semantics.

## Manual defect evidence

Post-D3B V2 manual testing accepted the new drawing geometry and interactions, but Trend-Based Fib Extension level labels were visibly low-contrast and positioned too close to the right edge. The same direct `fillText` pattern was present in several older and D3B Fibonacci/ratio render paths, so correcting only one tool would leave the same defect class elsewhere.

## Reference audit

### Uploaded `lightweight-charts-drawing-main.zip`

The uploaded reference implementation was inspected again. Relevant findings:

- its Trend-Based Fib/Fib Extension renderer places the level label at the right side of the viewport;
- the Fib Extension reference uses a compact background label with high-contrast text rather than bare line-colored text;
- Fib Channel places labels next to the line endpoint;
- Fib Time places labels along the top of the vertical level line;
- Wedge/Pitchfan place labels around the corresponding line midpoint;
- the reference repository does not provide a robust generic viewport-clamping layer for every Fibonacci label, so its placement code is used as behavioral guidance rather than copied wholesale.

### TradingView behavior checked

Current official TradingView Help Center documentation confirms that Fibonacci Retracement and Trend-Based Fib Extension expose level/price visibility, label position along a level, and font-size controls. Trend-Based Fib Time likewise exposes value visibility and position along the fib levels.

D3B.1 does not add those future per-tool style controls yet. Instead it establishes a safe, readable default placement that can later become the renderer foundation for the planned Drawing Settings UI phase.

## Files inspected

- `src/engine/Renderer.ts`
- `src/engine/DrawingD3BGeometry.ts`
- `src/engine/DrawingCapabilities.ts`
- `src/engine/DrawingAdvancedGeometry.ts`
- `src/engine/__tests__/DrawingD3BGeometry.test.ts`
- `src/engine/__tests__/DrawingD3BContracts.test.ts`
- `src/engine/__tests__/DrawingCapabilities.test.ts`
- uploaded `lightweight-charts-drawing-main` Fibonacci pane-view implementations
- official TradingView Help Center pages for Trend-Based Fib Extension, Fibonacci Retracement, and Trend-Based Fib Time

## Files modified

- `src/engine/Renderer.ts`

## Files created

- `src/engine/DrawingLabelLayout.ts`
- `src/engine/__tests__/DrawingLabelLayout.test.ts`
- `docs/changes/2026-08-11_0230_IST_DRAWING_LEVEL_LABEL_READABILITY_AND_PLACEMENT_D3B_1_V1.md`

## Final implementation

### 1. Shared viewport-safe label layout

`DrawingLabelLayout.ts` adds `computeDrawingLevelLabelBox()`.

The helper:

- measures a compact label box from the rendered text width;
- supports preferred left/right/center placement around the geometric label anchor;
- tries the opposite horizontal side before clamping when the preferred side would clip;
- clamps the complete box inside the plot width and height;
- keeps a small edge margin so text cannot sit directly against the chart boundary.

### 2. Shared readable level-label renderer

`Renderer.ts` adds a single `drawDrawingLevelLabel()` path that uses:

- semibold 10 px Segoe UI text;
- the drawing color as an opaque-enough compact background;
- automatic high-contrast foreground text;
- rounded compact boxes;
- cleared line dashes and shadow so label rendering is independent of the line style;
- complete viewport clamping through `computeDrawingLevelLabelBox()`.

This deliberately follows the useful part of the reference Fib Extension behavior — a readable background label — while adding viewport safety that the reference repository does not consistently provide across all fib tools.

### 3. Audited tools switched to the shared label renderer

D3B tools:

- Trend-Based Fib Extension — percentage + projected price, attached to the right-hand level end and kept inside the plot;
- Fibonacci Channel — percentage at the rightmost visible segment endpoint;
- Trend-Based Fib Time — centered on the vertical time line near the top of the plot;
- Fibonacci Wedge — ratio labels remain around the line midpoint but use the readable box and clamping;
- Pitchfan — ratio labels remain around the line midpoint but use the readable box and clamping.

Existing tools:

- Fibonacci Retracement;
- existing two-anchor Fibonacci Extension;
- Fibonacci Fan;
- Gann Fan level labels;
- Fibonacci Time Zone;
- Fibonacci Circles;
- Fibonacci Arcs.

The existing `Show Label` capability remains the authoritative visibility gate. No labels are forced on when a drawing has labels hidden.

### 4. Placement policy

Horizontal price levels default to the level end and place their label *inside* the chart when the line reaches an edge. This avoids the D3B screenshot defect where text was drawn into the clipping boundary.

Sloped/radial tools retain the semantic location used by their geometry (endpoint or midpoint) but the final label box may flip/clamp to remain fully visible.

Time-line tools keep their values near the top of the plot and center the label on the vertical level line, with horizontal clamping at the left/right chart edges.

## Behavior deliberately preserved

- all 45 post-D3B persisted drawing kinds;
- all D3B geometry and level calculations;
- D3A generalized `DrawingAnchor[]` lifecycle;
- existing two-anchor Fibonacci Extension semantics;
- per-chart/per-sheet/per-symbol drawing scopes;
- D/W/M/Q/Y timestamp anchor remapping;
- Renko anchor identity/reconciliation;
- common Properties color/line width/line style behavior;
- `Extend Left` / `Extend Right` behavior;
- `Show Label` behavior;
- lock/delete protection;
- drawing alert whitelist;
- D3A.1 name-only tool hover behavior;
- indicator/SMA cache behavior.

No drawing settings redesign and no per-level color/font/label-position editor is added in D3B.1. Those remain for the later grouped Drawing Tool Dock / Drawing Settings UI phase.

## Validation performed in the implementation environment

### TypeScript syntax transpilation

Parsed/transpiled with the available TypeScript compiler:

- `src/engine/Renderer.ts`
- `src/engine/DrawingLabelLayout.ts`
- `src/engine/__tests__/DrawingLabelLayout.test.ts`

**Result:** PASS — 3/3.

### Deterministic label-layout harness

Validated:

- a preferred-right label at the right chart edge flips to the inside;
- a preferred-left label at the left chart edge flips to the inside;
- centered time labels remain centered when there is room and clamp at an edge;
- labels clamp inside top/bottom plot limits.

**Result:** `DrawingLabelLayout deterministic harness: PASS`.

### Reference/source audit

Confirmed all intended Fibonacci/ratio label render paths now call the shared `drawDrawingLevelLabel()` renderer rather than their prior bare `fillText` path.

**Result:** PASS.

### Full project validation

The source snapshot does not include the Windows project's installed dependency tree. Full Vitest, renderer typecheck, renderer production build, Tauri portable build and visual runtime acceptance are therefore **not claimed** here.

## Required Windows validation

Run through the supplied installer with `-RunValidation`.

The validation must include:

- new `DrawingLabelLayout.test.ts`;
- D3B geometry/contracts;
- D3A/D2/D1 drawing regressions;
- capability, workspace, timeframe, symbol/sheet scope and lock tests;
- alert isolation;
- name-only drawing-tool tooltip contract;
- renderer TypeScript typecheck;
- renderer production build.

After automated PASS, rebuild the portable app and visually check the affected level-label tools, particularly Trend-Based Fib Extension near the right chart boundary.

## Risks / limitations

1. D3B.1 establishes one safe default label placement; TradingView-style user-selectable label position and font size are intentionally deferred to the later Drawing Settings UI phase.
2. Very densely clustered levels can still produce overlapping boxes because D3B.1 solves clipping/contrast, not full inter-label collision packing.
3. Background colors use the current single drawing color because per-level colors are also deferred to Drawing Settings work.
4. Visual acceptance is required because Canvas text metrics and display scaling are runtime-dependent.

## Rollback guidance

Restore the installer backup of `src/engine/Renderer.ts`, then remove the new helper/test/report files. Re-run the pre-D3B.1 focused D3B validation before proceeding.

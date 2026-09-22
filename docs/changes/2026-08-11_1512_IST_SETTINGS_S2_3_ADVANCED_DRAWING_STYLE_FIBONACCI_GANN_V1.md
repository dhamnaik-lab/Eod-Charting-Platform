# Settings S2.3 — Advanced Drawing Style: Fibonacci / Gann V1

**IST timestamp:** 2026-08-11 15:12 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_144341_IST`  
**Baseline ZIP SHA-256:** `6b9380d809079bab748f6f6df45bcfb4e1a4c6f9fa4892385096132e8f652627`

## Objective

Activate the Settings-S1 unified presentation architecture for the planned Fibonacci/Gann drawing family, using the same generic advanced Properties UI already proven in S2.1/S2.2. Preserve existing geometry, D3C.1 label readability, workspace compatibility, and legacy visual emphasis while allowing individual geometric components to be styled and hidden independently.

## S2.3 rollout boundary

Advanced Style is activated for exactly these 12 drawing kinds:

1. Trend-Based Fib Extension (`trendFibExtension`)
2. Fib Channel (`fibChannel`)
3. Trend-Based Fib Time (`fibTimeExtension`)
4. Fib Wedge (`fibWedge`)
5. Fib Time Zone (`fibTimeZone`)
6. Fib Circles (`fibCircles`)
7. Fib Arcs (`fibArcs`)
8. Gann Box (`gannBox`)
9. Fib Retracement (`fib`)
10. Fib Extension (`fibExtension`)
11. Fib Fan (`fibFan`)
12. Gann Fan (`gann`)

No new drawing kinds or geometry schemas are introduced.

## External reference review

The implementation remains hybrid rather than a visual clone.

- TradingView Fib Retracement exposes per-level show/hide and level configuration, plus a separately styled trend line, level line styling, extension controls and label placement.  
  https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/
- TradingView Trend-Based Fib Extension exposes a separately styled Trend Line, per-level visibility/color/opacity, `Use one color`, background, label positioning/font sizing, coordinates and timeframe visibility.  
  https://www.tradingview.com/support/solutions/43000518137-trend-based-fib-extension-drawing-tool/
- TradingView Fib Time Zone exposes per-line visibility/color/thickness/style and individual line opacity, plus `Use one color`, background and label visibility.  
  https://www.tradingview.com/support/solutions/43000518155-fib-time-zone-drawing-tool/
- TradingView Fib Circles exposes per-circle visibility/color/opacity/thickness and editable level values.  
  https://www.tradingview.com/support/solutions/43000518159-fib-circles-drawing-tool/
- TradingView Gann Fan exposes independent angle visibility/color/opacity/thickness/style, `Use one color`, background and labels.  
  https://www.tradingview.com/support/solutions/43000518151-gann-fan-drawing-tool/
- TradingView Gann Box separates Price Levels / Time Levels and their visibility/color/opacity.  
  https://www.tradingview.com/support/solutions/43000518152-gann-box-drawing-tool/
- thinkorswim Fib Retracement and Fib Extension expose each Fibonacci curve's visibility, coefficient, color, style and width, while separately controlling coefficient/price placement.  
  https://toslc.thinkorswim.com/center/reference/Drawings/Fibonacci/Fibonacci-Retracements  
  https://toslc.thinkorswim.com/center/reference/Drawings/Fibonacci/Fibonacci-Extensions

No external source code was copied.

## Implementation

### Shared Properties UI

No Fib/Gann-only dialog was created. The existing generic advanced Style surface renders each schema row with:

- Show / Hide
- Color
- Width
- Solid / Dashed / Dotted
- Opacity
- `Use one color`
- applicable fill visibility/color/opacity

Existing shared `Extend Left`, `Extend Right`, `Show Label`, and supported Left/Right label-position controls remain outside the component table and continue to use their established persisted fields.

### Level / ray / radial bindings

Renderer output now resolves named presentation slots instead of using one global drawing stroke for all components.

- Fib Retracement / Fib Extension: `trend` + `level:<ratio>`
- Trend-Based Fib Extension: `trend` + `level:<ratio>`
- Fib Channel: `level:<ratio>`
- Trend-Based Fib Time: `trend` + `level:<ratio>`
- Fib Wedge: `guide` + `level:<ratio>`
- Fib Time Zone: `level:<sequence>`
- Fib Circles: `circle:<ratio>`
- Fib Arcs: `trend` + `arc:<ratio>`
- Fib Fan: `trend` + `ray:<ratio>`
- Gann Fan: `trend` + `ray:<angle-label>`
- Gann Box: `border`, internal `grid:<ratio>` pairs, and `diagonals`

If an individual component is hidden, its associated numeric/ray label is also suppressed.

### Legacy visual preservation

The active renderer now encodes previously hard-coded emphasis in the schema so legacy drawings render the same until the user saves an advanced override:

- Trend-Based Fib Extension guide: 0.40 opacity
- Fib Channel: 0/50/61.8/100% strong at 1.0; secondary levels 0.65
- Trend-Based Fib Time: 0/50/100/161.8% strong at 1.0; secondary lines 0.60; trend guide 0.40
- Fib Wedge: strong levels 1.0; secondary levels 0.55; guide 0.40; wedge fill 0.06
- Fib Arcs / standard Fib trend guides / Fib Fan / Gann Fan guide: 0.42
- Gann Box internal grid: 0.62; diagonals: 0.80

Previously absent persistent fills remain OFF by default. Fib Wedge keeps its existing 6% fill ON by default.

### Optional fills

The generic fill resolver is now connected where the geometry has a clear single-surface interpretation:

- Fib Retracement / Fib Extension: optional Levels Fill between 0 and 1
- Fib Channel: optional Channel Fill across the outer level envelope
- Fib Wedge: persisted Wedge Fill, preserving the old 6% default
- Gann Box: optional Box Fill

These fills are deliberately single-surface controls. Per-band/per-zone multi-color background matrices are not invented in S2.3.

### Renderer helper

`strokeDrawingPathWithPresentation` generalizes the S2.1 segment renderer binding to non-straight paths such as circles, arcs, Gann Box rectangles/grids and multi-segment diagonals while preserving the existing `strokeDrawingSegmentWithPresentation` API for prior S2 phases.

## Behavior preserved

- 48 persisted drawing kinds
- grouped Drawing Tool Dock
- symbol/sheet drawing scopes
- timeframe/Renko anchor remapping
- lock/delete protection
- D3C.1 label-to-line spacing, 12px semibold numeric labels and viewport fallback
- Long/Short Position rendering
- existing drawing-alert whitelist
- workspace backward compatibility
- S2.1 Regression/Channel styles
- S2.2 Pitchfork/Pitchfan styles

## Deliberately deferred advanced items

These are desirable for the later unified settings continuation but are not mixed into this renderer-binding phase:

- editable/custom Fib numeric coefficients and add/remove level rows
- per-level custom text
- per-band / per-zone independently colored backgrounds
- user-selectable label text color/font size/vertical placement
- full `Coordinates` tab
- full timeframe `Visibility` tab UI
- reverse/log-scale Fib calculation controls
- Gann scale-ratio controls
- adding geometry components not already rendered by this app (for example a new Fib Circles trend line)

The S1 contracts already reserve text/label/timeframe-visibility state so these can be added without creating another persistence model.

## Files changed

### Modified

- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `src/engine/DrawingStyleSchema.ts`
- `src/engine/Renderer.ts`
- `src/engine/__tests__/DrawingStyleSchema.test.ts`

### Created

- `src/engine/__tests__/DrawingS23Contracts.test.ts`
- `docs/changes/2026-08-11_1512_IST_SETTINGS_S2_3_ADVANCED_DRAWING_STYLE_FIBONACCI_GANN_V1.md`

## Preparation validation

- focused S2.3 schema semantic TypeScript typecheck with local platform-type stub: **PASS**
- changed-source TypeScript syntax transpilation: **PASS**
- S2.3 runtime style-contract harness: **PASS**
- all 12 planned S2.3 kinds registered in the advanced rollout: **PASS**
- no duplicate advanced kinds: **PASS**
- legacy Fib Channel emphasis: **PASS**
- legacy Fib Wedge fill/emphasis: **PASS**
- legacy Gann Box grid/diagonal emphasis: **PASS**
- independent Fib level override resolution: **PASS**

## Windows validation required after application

Run the installer with `-RunValidation`. It executes the new S2.3 contracts plus the full accumulated focused drawing/style/indicator-cache regression set, renderer typecheck and renderer production build.

## Manual acceptance

Portable/manual visual acceptance remains intentionally deferred until S2.3 Windows automated validation passes. At that point S2.1 + S2.2 + S2.3 can be inspected together in one portable build.

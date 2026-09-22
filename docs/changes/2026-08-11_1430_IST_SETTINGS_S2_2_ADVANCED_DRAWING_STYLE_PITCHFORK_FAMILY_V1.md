# Settings S2.2 — Advanced Drawing Style: Pitchfork Family V1

**IST timestamp:** 2026-08-11 14:30 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_141840_IST`  
**Baseline ZIP SHA-256:** `88d73c79dfce325cf1e38bb8eceac6d3706beed6bc2508b93b0b39a06d2b6b81`

## Objective

Activate the Settings S1/S2.1 unified advanced Style path for the current Pitchfork family without introducing tool-specific dialogs or changing multi-anchor geometry.

Rollout scope:

1. Andrews’ Pitchfork
2. Schiff Pitchfork
3. Modified Schiff Pitchfork
4. Inside Pitchfork
5. Pitchfan

## Reference review

TradingView documents Pitchfork Style controls for Median plus independently visible/styled additional lines, `Use one color`, optional background, Coordinates, and timeframe Visibility. TradingView also documents Pitchfan as a Fibonacci-ray family with a Median, independently configurable additional levels, `Use one color`, optional background, Coordinates, and timeframe Visibility. MetaTrader 5 independently confirms a dedicated Levels model for Andrews’ Pitchfork. These references support the existing EOD staged architecture: independent component style first, Coordinates/Visibility later, without coupling the style pass to geometry redesign.

References reviewed:

- TradingView — Pitchfork drawing tool: https://www.tradingview.com/support/solutions/43000518141-pitchfork-drawing-tool/
- TradingView — Schiff pitchfork drawing tool: https://www.tradingview.com/support/solutions/43000518140-schiff-pitchfork-drawing-tool/
- TradingView — Inside pitchfork drawing tool: https://www.tradingview.com/support/solutions/43000518146-inside-pitchfork-drawing-tool/
- TradingView — Pitchfan drawing tool: https://www.tradingview.com/support/solutions/43000518143-pitchfan-drawing-tool/
- MetaTrader 5 — Andrews’ Pitchfork: https://www.metatrader5.com/en/terminal/help/objects/channels/andrews_pitchfork
- MetaTrader 5 — Analytical Objects / Levels: https://www.metatrader5.com/en/terminal/help/charts_analysis/objects

No external source code was copied.

## Files changed

### Modified

- `src/engine/DrawingStyleSchema.ts`
- `src/engine/Renderer.ts`
- `src/engine/__tests__/DrawingStyleSchema.test.ts`
- `src/engine/__tests__/DrawingS21Contracts.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

### Created

- `src/engine/__tests__/DrawingS22Contracts.test.ts`
- `docs/changes/2026-08-11_1430_IST_SETTINGS_S2_2_ADVANCED_DRAWING_STYLE_PITCHFORK_FAMILY_V1.md`

## Implementation

### Four Pitchfork variants

The shared advanced Style schema is now active for all four current Pitchfork variants. Properties exposes:

- Median — Show / Color / Width / Style / Opacity
- Upper — Show / Color / Width / Style / Opacity
- Lower — Show / Color / Width / Style / Opacity
- `Use one color`
- Common / handle color
- existing Extend Left / Extend Right capability controls

The renderer resolves each named slot independently through `resolveDrawingLinePresentationForSlot` and draws it through the common `strokeDrawingSegmentWithPresentation` helper.

The geometry engine continues to return its existing three segments. The renderer maps the two side segments to visual Upper/Lower based on their anchor pixel Y positions so that the Properties labels remain visually meaningful even when point 2 and point 3 are placed in the opposite vertical order.

Legacy emphasis is preserved:

- Median opacity: `1.0`
- Upper opacity: `0.9`
- Lower opacity: `0.9`

The existing anchor-construction polyline remains a low-emphasis (`0.35`) common-color guide. It is deliberately not promoted into a separate persisted style slot in S2.2 because it is an editing/construction aid rather than a primary analytical line.

### Pitchfan

Pitchfan remains a six-ray Fibonacci structure using the existing levels:

- 23.6%
- 38.2%
- 50.0% Median
- 61.8%
- 78.6%
- 100.0%

Each ray now has independent:

- Show/Hide
- Color
- Width
- Solid / Dashed / Dotted style
- Opacity

The 50% row is labelled `Median (50.0%)` in Properties so the UI reflects common Pitchfan terminology without changing the underlying persisted slot identity (`ray:0.5`).

Legacy ray emphasis is preserved:

- 38.2%, 50%, 61.8%: opacity `1.0`
- 23.6%, 78.6%, 100%: opacity `0.65`

A hidden ray no longer draws its numeric label. Visible labels use the resolved ray color, so independent ray colors are reflected consistently in both line and label.

The existing point-2 → point-3 correction-wave guide remains a low-emphasis common-color construction aid.

### `Use one color`

Behavior is unchanged from S2.1:

- when enabled, all analytical line/ray colors resolve to the drawing's common color;
- visibility, width, line style, and opacity stay independent;
- independent saved colors are retained and return if `Use one color` is later disabled;
- handle/construction-guide color remains the common drawing color.

## Scope deliberately deferred

S2.2 does **not** add or redesign:

- additional Pitchfork line sets beyond the current geometry;
- Pitchfork/Pitchfan background-band fills;
- Pitchfork variant conversion from one type to another inside Properties;
- Coordinates editing UI;
- timeframe Visibility UI;
- Fibonacci/Gann advanced Style rollout;
- drawing geometry, hit-testing, persistence identity, or alert eligibility.

TradingView exposes some of these capabilities; they remain appropriate follow-on work, but mixing them into this Style activation would expand the geometry/persistence scope unnecessarily.

## Compatibility preserved

- all 48 persisted drawing kinds;
- grouped Drawing Tool Dock;
- D3A multi-anchor creation/editing;
- D3B Pitchfork/Pitchfan geometry;
- D3C/D3C.1 Long/Short/Projection and label cleanup;
- drawing lock/delete protection;
- per-symbol/per-sheet drawing scopes;
- timeframe/Renko anchor remapping;
- drawing-alert whitelist;
- existing generic Properties save workflow.

## Validation performed before packaging

- TypeScript syntax transpilation for changed/new source/test files: **PASS**
- advanced rollout includes S2.1 families plus all five S2.2 families: **PASS**
- four Pitchfork schemas expose exactly Median/Upper/Lower: **PASS**
- Pitchfork legacy opacity defaults (1.0 / 0.9 / 0.9): **PASS**
- Pitchfan six-ray slot identity: **PASS**
- Pitchfan legacy strong/secondary opacity defaults: **PASS**
- renderer uses shared component presentation resolver for Pitchfork and Pitchfan: **PASS**
- hidden Pitchfan ray suppresses its label by renderer contract: **PASS**
- generic Properties/ChartCanvas draft-save path reused; no Pitchfork-only dialog: **PASS**

## Windows validation to run after application

The guarded installer runs focused Vitest covering S2.2 + S2.1 + S1 + D1–D3C.1 regressions, followed by:

```powershell
npm run typecheck:renderer
npm run build:renderer
```

## Manual/portable acceptance

Still intentionally deferred until the Pitchfork and Fibonacci/Gann Style families are together. That later combined build should check independent colors, hidden components, line styles/widths, opacity, `Use one color`, labels, and legacy visual defaults.

## Rollback

Use the installer-created targeted backup to restore the modified existing files. Remove the new S2.2 contract test/report for a complete rollback.

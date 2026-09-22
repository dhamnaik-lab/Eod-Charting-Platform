# Settings S1 — Unified Properties / Style Foundation V1

**IST timestamp:** 2026-08-11 13:16 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_124746_IST`

## Objective

Create the reusable, renderer-independent settings foundation required for a TradingView-class drawing Properties system without destabilizing the already accepted D1–D3C.1 drawing runtime.

S1 is architecture first. It does **not** yet replace the visible drawing Properties dialog and it does not switch any renderer path to per-line/per-level styles. Those changes belong to S2.

## Baseline acceptance carried forward

The baseline already contains:

- 48 persisted drawing kinds;
- grouped Drawing Tool Dock;
- D3B.2 tool-specific Properties titles and left/right labels;
- D3C Long Position, Short Position, Projection;
- D3C.1 Fib/fan label spacing and Long/Short split inline annotations;
- D3C.1 Windows validation: **26 files / 113 tests PASS**, renderer TypeScript typecheck PASS, renderer production build PASS.

## Cross-platform reference conclusions

The design is intentionally hybrid, with TradingView as the primary UX reference.

### TradingView

TradingView drawing properties separate visual Style from Coordinates and Visibility for supported drawing tools. Individual visual components expose visibility and line appearance controls, while Fib tools expose level-specific configuration. TradingView also supports quick interval visibility for drawings and indicators.

Reference pages:

- https://www.tradingview.com/support/solutions/43000518095-trendline-drawing-tool/
- https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/
- https://www.tradingview.com/support/solutions/43000686263-how-to-quickly-adjust-visibility-of-a-drawing-or-indicator/
- https://www.tradingview.com/support/solutions/43000480333-how-to-adjust-the-indicator-settings/

### thinkorswim

thinkorswim reinforces independent component controls: channel extra lines can have their own visibility, coefficient, color, style, and width; regression/pitchfork families expose line color/style/width controls.

Reference pages:

- https://toslc.thinkorswim.com/center/reference/Drawings/Basic/Channel
- https://toslc.thinkorswim.com/center/reference/Drawings/Regression/Regression-Channel
- https://toslc.thinkorswim.com/center/reference/Drawings/Advanced/Andrews-Pitchfork

### Sierra Chart

Sierra Chart exposes explicit horizontal/vertical label alignment and detailed drawing properties. This supports keeping label layout as a first-class style concern rather than hard-coding it into each drawing renderer.

Reference:

- https://www.sierrachart.com/index.php?page=doc%2FTools.html

### MetaTrader 5

MetaTrader separates object Parameters (coordinates), Visualization (timeframe visibility), and Fibonacci/Pitchfork Levels. Level values can be added/removed and style includes color/width/line style. This strongly supports separate coordinate and visibility contracts.

Reference:

- https://www.metatrader5.com/en/terminal/help/charts_analysis/objects

### TrendSpider

TrendSpider exposes drawing Properties, timeframe visibility (`Visible On`), color preferences, and Fib fill controls. This supports explicit visibility state and saved style preferences without coupling them to geometry.

Reference:

- https://help.trendspider.com/kb/charting/drawing-and-annotating-charts

No external source code was copied.

## Existing platform capability discovered and reused

The EOD platform's **indicator** settings are already more advanced than the drawing dialog. `IndicatorSettingsDialog.tsx` already has:

- Inputs
- Style
- Levels
- Scale
- Visibility

and existing `IndicatorPresentationSettings` supports per-plot and per-level settings.

S1 therefore does **not** create a second competing indicator architecture. Instead, the existing indicator types are refactored to derive from the new shared visual contracts. Their persisted shape and UI behavior remain unchanged.

## New shared contracts

### `src/engine/UnifiedStyleContracts.ts`

Introduces reusable contracts for:

- line visibility, color, width, line style, opacity;
- plot style;
- fill visibility, color, opacity;
- text color/opacity/font/weight/italic/alignment;
- label horizontal and vertical placement;
- master + D/W/M/Q/Y timeframe visibility;
- drawing `Use one color` state;
- stable opacity normalization;
- backward-compatible timeframe visibility resolution.

The module has no React or renderer dependency.

## Drawing persistence extension

`ChartDrawingBase` now has two **optional** fields:

```ts
presentation?: DrawingPresentationSettings;
visibility?: UnifiedTimeframeVisibilitySettings;
```

If both are omitted, the drawing behaves exactly as before S1.

`presentation` is reserved for:

- per-line styles;
- per-fill styles;
- text style;
- label style;
- `useOneColor`.

`visibility` is reserved for:

- master drawing visibility;
- per-timeframe D/W/M/Q/Y visibility.

No workspace version bump or migration is required because drawings are already serialized as complete objects and the new fields are optional.

## Drawing style registry

### `src/engine/DrawingStyleSchema.ts`

Every persisted drawing kind is registered exactly once.

The registry declares:

- line component slots;
- fill component slots;
- text/label style capability;
- whether `Use one color` is meaningful;
- coordinate mode;
- timeframe-visibility support.

High-value examples:

- Regression Trend: `Upper`, `Basis`, `Lower`;
- Parallel Channel: `Base`, `Middle`, `Parallel` + fill;
- Pitchforks: `Median`, `Upper`, `Lower`;
- Fib tools: trend/level/ray slots;
- Long/Short Position: `Target`, `Entry`, `Stop` + `Reward`/`Risk` fills;
- Projection: measured move / projected move / target;
- Shapes: outline + fill;
- Text: text-style contract.

The registry also defines the future Drawing Properties tabs:

```text
Style | Coordinates | Visibility
```

and coordinate modes for horizontal-price, vertical-time, point, two-anchor, and multi-anchor drawings.

## Legacy-compatible style resolution

S1 supplies pure resolver functions that:

- use the existing root drawing `color`, `lineWidth`, and `lineStyle` when no per-component override exists;
- honor independent per-line visibility/color/width/style/opacity when present;
- when `useOneColor` is enabled, use the root drawing color across line slots while retaining independent width/style/visibility;
- default missing timeframe visibility to visible.

These resolvers are deliberately **not connected to `Renderer.ts` in S1**. This prevents a broad visual behavior change before S2 has complete tool-family coverage and Windows validation.

## Indicator compatibility

Existing indicator presentation types now derive from the same shared contracts:

- `IndicatorPlotSettings` → shared plot presentation contract;
- `IndicatorLevelSettings` → shared line presentation contract;
- `BandFillSettings` → shared fill presentation contract.

No indicator settings field is removed or renamed.

## Files changed

### New

- `src/engine/UnifiedStyleContracts.ts`
- `src/engine/DrawingStyleSchema.ts`
- `src/engine/__tests__/UnifiedStyleContracts.test.ts`
- `src/engine/__tests__/DrawingStyleSchema.test.ts`
- `docs/changes/2026-08-11_1316_IST_SETTINGS_S1_UNIFIED_STYLE_FOUNDATION_V1.md`

### Modified

- `src/engine/types.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

## Local preparation validation

Performed before packaging:

- TypeScript syntax transpilation for changed/new TS files: **PASS**
- focused semantic TypeScript check for the new shared contracts/schema/type integration: **PASS**
- runtime contract harness: **PASS**
- 48 drawing schemas / 48 unique persisted kinds: **PASS**
- `Style | Coordinates | Visibility` drawing-tab contract: **PASS**
- legacy style-resolution compatibility: **PASS**
- independent line override behavior: **PASS**
- `Use one color` retains independent width/style/visibility: **PASS**
- omitted timeframe visibility remains visible: **PASS**

## Windows validation required after application

Run focused drawing/indicator regression tests, renderer TypeScript typecheck, and renderer production build. A portable rebuild is not required for S1 because S1 intentionally introduces no visible UI or renderer change.

## Next phase — Settings S2

S2 should consume this foundation and implement the actual advanced Drawing Properties `Style` tab, starting with multi-line/high-value families:

1. Regression Trend and Channels;
2. Pitchfork family;
3. Fib/Gann families with per-level visibility/color/style and optional `Use one color`;
4. Long/Short Position target/entry/stop and risk/reward fills;
5. shapes/fill/text families;
6. single-line tools through the same generic controls.

Only after complete S2 rendering/property coverage should Coordinates and timeframe Visibility be exposed as active editing tabs.

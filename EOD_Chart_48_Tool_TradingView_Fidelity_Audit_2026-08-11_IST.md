# EOD Charting Platform — 48-Tool TradingView Fidelity Audit

**Audit date:** 2026-08-11 IST  
**Mode:** Read-only source/behavior audit — **no production source files changed**  
**Authoritative EOD snapshot:** `Eod Charting Platform Source Code 2026-08-11_222627_IST`  
**Snapshot ZIP SHA-256:** `e7b3a31e6b33563695c161411f6e0bba8c14cc3d7dcff01d83c082b492658bf6`  
**Reference ZIP:** `lightweight-charts-drawing-main.zip`  
**Reference ZIP SHA-256:** `cec7f0b3a602c44f7a161b09b31d36f988c26aea8b8c707aaaba65d20f8a7266`

## Executive result

The audit confirms the user's concern: the current drawing subsystem is **architecturally substantial but not yet TradingView-fidelity complete**. The issue is broader than Fibonacci. Some tools need only visual/settings completion, while several have geometry or identity mismatches substantial enough to warrant a re-port.

| Class | Meaning | Count |
|---|---|---:|
| A | Fidelity good; no material gap found | 0 |
| B | Core geometry/identity good; mainly visual/settings/interaction polish remains | 23 |
| C | Important semantic, geometry, interaction or settings gap | 18 |
| D | Substantially wrong, identity mismatch, or re-port needed | 7 |
| **Total** |  | **48** |

**Interpretation:** zero A-class tools does **not** mean the drawing system is unusable. It means the audit standard is strict: "faithful to current TradingView behavior," not merely "works as a drawing." Many B-class tools already have sound native EOD geometry and can be retained.

## Authority and methodology

The audit uses this precedence:

1. **Current TradingView official Supercharts behavior/documentation/images** — final fidelity authority.
2. **`deepentropy/lightweight-charts-drawing` reference ZIP** — implementation aid and secondary behavioral reference.
3. **Current EOD native Canvas implementation** — compared against the two sources above.

This ordering is essential. The reference ZIP is **not TradingView Supercharts source code**. It is a third-party plugin for TradingView's open-source Lightweight Charts v5. Its current GitHub repository reports an MIT license. That makes it useful for studying/porting implementation patterns, but it must not override official TradingView behavior when the two disagree.

### Porting rule going forward

When a faithful reference exists, do not reduce it to a formula only. Port the complete behavior into EOD's architecture:

- anchor count and click order;
- geometry and calculations;
- line start/end/extension semantics;
- fill regions;
- labels and exact positions;
- handles and selected-state rendering;
- drag/hit-testing behavior;
- defaults;
- Style / Inputs / Coordinates / Visibility settings.

The EOD renderer remains native Canvas 2D; this is a behavioral translation, not an engine replacement.

## Classification definitions

- **A — Fidelity good:** no material behavior/visual/settings difference found at the audited scope.
- **B — Core good:** fundamental geometry and identity align; mostly settings, labels, visual details, selected state, or secondary interaction remain.
- **C — Material gap:** core idea exists but meaningful geometry, semantics, input model, or interaction differs.
- **D — Re-port:** current implementation is structurally different from TradingView, the tool identity does not map cleanly, or the reference ZIP itself is misleading for TradingView fidelity.
- **D\*** — identity decision required before implementation.

## Full 48-tool matrix

|Group|EOD ID|EOD title|TradingView counterpart|Reference ZIP source|EOD anchors|Reference anchors|Class|Key mismatch|Recommended action|
|---|---|---|---|---|---|---|---|---|---|
|Lines|trendline|Trend Line|Trendline|src/tools/lines/trend-line.ts|2|2|B|Core two-point segment is aligned, but TradingView has endpoint arrows, midpoint, price labels, stats and text controls not yet matched.|Keep geometry; port full Style/Text/Stats controls and selected-state presentation.|
|Lines|ray|Ray|Ray|src/tools/lines/ray.ts|2|2|B|Correct origin + direction model; current EOD lacks much of TradingView ray metadata/stats/text and endpoint styling.|Keep geometry; expand fidelity controls and labels.|
|Lines|extendedLine|Extended Line|Extended line|src/tools/lines/extended-line.ts|2|2|B|Infinite-both-directions geometry is aligned; TradingView has endpoint/midpoint/price-label/stats/text options.|Keep geometry; port settings and selected-state visuals.|
|Lines|horizontalRay|Horizontal Ray|Horizontal ray|src/tools/lines/horizontal-ray.ts|1|1|B|Core one-point horizontal ray is aligned; price/label/direction presentation is incomplete.|Keep geometry; add TradingView-style label/price options.|
|Lines|hline|Horizontal Line|Horizontal line|src/tools/lines/horizontal-line.ts|1 price|1|B|Core infinite horizontal level is aligned; labels/axis price/text capabilities are incomplete.|Keep geometry; port label/price/text options.|
|Lines|vline|Vertical Line|Vertical line|src/tools/lines/vertical-line.ts|1 bar|1|B|Core vertical line is aligned; time label/text controls and richer style behavior are incomplete.|Keep geometry; add TradingView-style time/label controls.|
|Lines|crossLine|Cross Line|Crossline|src/tools/lines/cross-line.ts|1|1|B|Core horizontal+vertical intersection is aligned; price/time labels and style controls are incomplete.|Keep geometry; port label/time/price controls.|
|Lines|infoLine|Info Line|Info line|src/tools/lines/info-line.ts|2|2|B|Core line plus metrics concept is aligned, but TradingView exposes a richer selectable statistics set and text placement.|Keep geometry; normalize metrics, text and settings to TradingView.|
|Lines|trendAngle|Trend Angle|Trend angle|src/tools/lines/trend-angle.ts|2|2|C|Current EOD is essentially a line with slope/visual-angle text; Trend Angle has angle-specific presentation/interaction semantics.|Re-check visual geometry and angle annotation; re-port angle-specific behavior before polishing settings.|
|Channels|channel|Parallel Channel|Parallel channel|src/tools/channels/parallel-channel.ts|3-click / 2+offset|3|B|Core channel geometry is usable and broadly aligned; TradingView has richer line/background/text/extension behavior.|Keep core geometry; port full controls and selected-state rendering.|
|Channels|flatChannel|Flat Top / Bottom|Flat top/bottom|src/tools/channels/flat-top-bottom.ts|3|3|B|Core 3-anchor construction is aligned; style/text/extension fidelity is incomplete.|Keep geometry; complete settings and visual fidelity.|
|Channels|disjointChannel|Disjoint Channel|Disjoint channel|src/tools/channels/disjoint-channel.ts|4|4|B|Core independent two-line / four-anchor construction is aligned; full TradingView controls are incomplete.|Keep geometry; complete settings and labels.|
|Channels|regressionTrend|Regression Trend|Regression trend|src/tools/channels/regression-trend.ts|2 time anchors|2|C|EOD uses a fixed regression-channel model; TradingView exposes upper/lower deviation values, enable switches, source, Pearson R and richer style semantics.|Port TradingView input contract (source/deviations/Pearson R) and then verify renderer.|
|Pitchforks|andrewsPitchfork|Andrews' Pitchfork|Pitchfork / Classic|src/tools/pitchforks/andrews-pitchfork.ts|3|3|C|Basic three-point median/side-line structure exists, but TradingView supports configurable additional line sets (up to 9), background, style switching and exact extension behavior.|Re-port full pitchfork line-set model and shared pitchfork settings.|
|Pitchforks|schiffPitchfork|Schiff Pitchfork|Schiff pitchfork|src/tools/pitchforks/schiff-pitchfork.ts|3|3|C|Core Schiff pivot transform exists; additional line-set/background/style fidelity remains incomplete.|Re-port from official pitchfork model; verify Schiff transform visually.|
|Pitchforks|modifiedSchiffPitchfork|Modified Schiff Pitchfork|Modified Schiff pitchfork|src/tools/pitchforks/modified-schiff-pitchfork.ts|3|3|C|Core modified-Schiff transform exists; TradingView line-set and settings model is not fully represented.|Re-port shared pitchfork model and verify modified origin exactly.|
|Pitchforks|insidePitchfork|Inside Pitchfork|Inside pitchfork|src/tools/pitchforks/inside-pitchfork.ts|3|3|D|TradingView explicitly places Inside origin at the midpoint in both horizontal and vertical distance between the first two points. Current/reference implementation does not faithfully implement that model and lacks TradingView additional line sets.|Re-port from official Inside Pitchfork definition; do not trust reference ZIP geometry here.|
|Pitchforks|pitchfan|Pitchfan|Pitchfan|src/tools/fibonacci/pitchfan.ts|3|3|C|Three-point fan concept is present, but fixed rays and simplified rendering/settings do not match TradingView’s configurable Fibonacci rays/background/labels.|Port exact levels, line origin/span, background and label controls.|
|Fibonacci / Gann|fib|Fibonacci Retracement|Fibonacci retracement|src/tools/channels/fib-retracement.ts|2|2|C|EOD hard-codes only 0..1 levels. TradingView supports up to 24 configurable levels; >1 external retracements, <0 extensions, reverse, labels/prices, custom text, background and log-scale calculation.|Re-port as configurable 2-anchor Fib engine; preserve independent per-level colors.|
|Fibonacci / Gann|fibExtension|Fibonacci Extension|No separate current Supercharts counterpart identified; TradingView exposes Trend-Based Fib Extension|No exact match: reference src/tools/fibonacci/fib-extension.ts is 3-anchor Trend-Based Fib Extension|2|3|D*|Identity mismatch. EOD has a separate 2-anchor Fibonacci Extension, while current TradingView tool inventory names Fibonacci Retracement + Trend-Based Fib Extension; reference “fib-extension” is itself 3-anchor.|Decide: retain as EOD custom/legacy tool with explicit name, or migrate/remove in favor of faithful Trend-Based Fib Extension.|
|Fibonacci / Gann|trendFibExtension|Trend-Based Fib Extension|Trend-Based Fib Extension|src/tools/fibonacci/fib-extension.ts|3 A/B/C|3|C|A/B/C projection formula is broadly correct, but current EOD/reference line-span behavior and fixed settings differ from TradingView. TradingView supports custom levels, level-line style, left/right extension, reverse/background/labels and more.|Re-port complete three-point behavior from official visual reference; use reference ZIP only as secondary implementation aid.|
|Fibonacci / Gann|fibChannel|Fibonacci Channel|Fib channel|src/tools/fibonacci/fib-channel.ts|3|3|C|Core three-point level-channel idea exists, but level configurability, exact span/extension, labels/background and interaction need fidelity work.|Re-port exact channel construction and full level schema.|
|Fibonacci / Gann|fibTimeZone|Fib Time Zone|Fib time zone|src/tools/fibonacci/fib-time-zone.ts|2|2|B|Core two-point time-zone sequence is aligned; level customization, labels and style controls are incomplete.|Keep core model; port configurable levels and full Style/Visibility behavior.|
|Fibonacci / Gann|fibTimeExtension|Trend-Based Fib Time|Trend-Based Fib Time|src/tools/fibonacci/fib-time-extension.ts|3|3|B|Core trend-based Fibonacci time projection is present; visual/settings fidelity and customizable ratios remain incomplete.|Keep core geometry pending screenshot verification; port level/settings fidelity.|
|Fibonacci / Gann|fibCircles|Fib Circles|Fib circles|src/tools/fibonacci/fib-circles.ts|2|2|C|EOD/reference use screen-space radii multiplied by fixed ratios. TradingView supports a larger configurable circle-level model and scale-sensitive behavior that needs exact visual verification.|Re-port configurable circle levels and verify behavior under chart scaling/aspect changes.|
|Fibonacci / Gann|fibArcs|Fib Arcs|Fib Speed Resistance Arcs|src/tools/fibonacci/fib-arcs.ts|2|2|C|Current arcs are simplified concentric semicircles with fixed levels. TradingView exposes configurable arc percentages, background, label placement and full-circle behavior.|Re-port official Speed Resistance Arcs model and settings.|
|Fibonacci / Gann|fibWedge|Fibonacci Wedge|Fib wedge|src/tools/fibonacci/fib-wedge.ts|3|3|D|Hard contradiction: TradingView defines Fib Wedge as Fibonacci arcs spreading from the trend origin; current EOD and reference ZIP render straight radiating segments.|Discard current/reference wedge geometry and re-port from TradingView’s arc-based model.|
|Fibonacci / Gann|fibFan|Fibonacci Fan|Fib Speed Resistance Fan|src/tools/fibonacci/fib-speed-fan.ts|2|2|D|Current EOD is a simplified slope fan. TradingView Speed Resistance Fan combines trend line with independent price/time percentage levels, grid, labels, background and reverse.|Re-port the actual Speed Resistance Fan model rather than extending current simple fan.|
|Fibonacci / Gann|gann|Gann Fan|Gann fan|src/tools/gann/gann-fan.ts|2|2|C|Nine rays exist, but Gann requires a meaningful price/time scale ratio; EOD currently derives rays from chart slope without a true Gann scale-ratio contract.|Introduce Gann price/time scale ratio and verify 1x1 / related angles against official behavior.|
|Fibonacci / Gann|gannBox|Gann Box|Gann box|src/tools/gann/gann-box.ts|2|2|D|EOD uses one common fractional grid for both axes. TradingView has separate price levels and time levels, scale ratio, angles, backgrounds, labels and Reverse.|Re-port Gann Box structure and settings from scratch around separate price/time partitions.|
|Shapes|rect|Rectangle / Box|Rectangle|src/tools/shapes/rectangle.ts|2|2|B|Core rectangle geometry is aligned; TradingView offers text, background/border and richer settings.|Keep geometry; port full Style/Text/Coordinates controls.|
|Shapes|rotatedRect|Rotated Rectangle|Rotated rectangle|src/tools/shapes/rotated-rectangle.ts|3|3|B|Core rotated rectangle construction is aligned; style/text/interaction fidelity needs finishing.|Keep geometry; complete visual/settings fidelity.|
|Shapes|circle|Circle|Circle|src/tools/shapes/circle.ts|2|2|B|Core center/radius circle is aligned, but TradingView’s shape is visually invariant under scale changes and has fill/text/settings behavior to match.|Keep core screen-space circle model; verify scale behavior and add full style/text controls.|
|Shapes|ellipse|Ellipse|Ellipse|src/tools/shapes/ellipse.ts|2|2|B|Core bounding-box ellipse is aligned; text/fill/style and selection behavior are incomplete.|Keep geometry; port full controls.|
|Shapes|triangle|Triangle|Triangle|src/tools/shapes/triangle.ts|3|3|B|Core 3-point geometric triangle is aligned; style/text/fill fidelity is incomplete.|Keep geometry; port full controls.|
|Shapes|arc|Arc|Arc|src/tools/shapes/arc.ts|3|3|B|Core 3-point arc concept is aligned; exact sweep/selection and Style/Coordinates fidelity need refinement.|Keep geometry unless visual audit finds sweep mismatch; complete controls.|
|Measure / Projection|measure|Measure|Measure (quick measurement mode)|No dedicated exact reference tool; reference has persistent range tools|2|—|C|TradingView Measure is a quick measurement interaction (also accessible via Shift+click), while EOD stores Measure as a persistent drawing object.|Decide product behavior: transient quick measure vs persisted custom Measure. If TV fidelity is desired, implement transient mode separately.|
|Measure / Projection|priceRange|Price Range|Price range|src/tools/shapes/price-range.ts|2|2|C|Current EOD/reference fill the range across the chart width by default. TradingView’s selected points bound the box horizontally; Extend is an optional setting to extend through the chart.|Correct default bounded rectangle geometry; add Extend and exact stats/label/background controls.|
|Measure / Projection|dateRange|Date Range|Date range|src/tools/forecasting/date-range.ts|2|2|C|Current EOD/reference extend through full chart height by default. TradingView uses a bounded box between two selected points; vertical Extend is optional.|Correct default bounded rectangle geometry; add Extend, stats, label and volume controls.|
|Measure / Projection|forecast|Forecast|Position forecast / Forecast|src/tools/forecasting/forecast.ts|2|2|D|Current EOD/reference render a static two-point rectangle/line forecast. TradingView Position Forecast tracks source/target and duration and automatically labels success/failure as time/price progresses.|Re-port current TradingView Position Forecast semantics; keep legacy implementation only if intentionally renamed custom.|
|Measure / Projection|projection|Projection|Projection (present in TradingView drawing inventory; exact English help semantics not sufficiently documented in audit)|src/tools/forecasting/projection.ts|3 A/B/C|3|C|Current/ref use A→B vector projected from C. A TradingView Projection tool exists, but exact current Supercharts rendering/controls need visual/interactive confirmation before declaring parity.|Keep provisional; obtain official/current screenshot or live behavior and then match geometry/labels/settings exactly.|
|Positions|longPosition|Long Position|Long position|src/tools/forecasting/long-position.ts|3 semantic anchors|3|C|S2.3.1 now has correct green profit/red loss zones and LONG orientation, but TradingView also calculates account size, lot size, risk, leverage, quantity, ticks, PnL and richer stats.|Keep corrected geometry; port optional Inputs/Stats while preserving EOD chart-planning/no-broker-authority boundary.|
|Positions|shortPosition|Short Position|Short position|src/tools/forecasting/short-position.ts|3 semantic anchors|3|C|S2.3.1 now has correct SHORT orientation and zones, but TradingView’s full risk/position-size/PnL input/stat model is not present.|Keep corrected geometry; port optional Inputs/Stats without adding execution authority.|
|Arrows / Markers|arrow|Arrow|Arrow|src/tools/lines/arrow.ts|2|2|B|Core two-point arrow is aligned; TradingView has richer style/text/coordinates/alert behavior.|Keep geometry; port Style/Text/Coordinates options.|
|Arrows / Markers|arrowMarker|Arrow Marker|Arrow Marker|src/tools/annotations/arrow-marker.ts|1|1|D|Hard contradiction: TradingView Arrow Marker is set by two reference points, with the second determining direction, and supports custom text. EOD/reference use a one-point triangle marker.|Re-port as a two-point arrow-marker object; retain current one-point marker only under a different custom name if desired.|
|Arrows / Markers|arrowUp|Arrow Up|Arrow mark up|src/tools/annotations/arrow-mark-up.ts|1|1|B|One-point significance marker aligns; TradingView uses fixed size and simple color customization.|Keep geometry; align default color/style and property surface.|
|Arrows / Markers|arrowDown|Arrow Down|Arrow mark down|src/tools/annotations/arrow-mark-down.ts|1|1|B|One-point significance marker aligns; TradingView uses fixed size and simple color customization.|Keep geometry; align default color/style and property surface.|
|Text|text|Text Label|Text|src/tools/annotations/text-annotation.ts|1|1|B|Core anchored text exists; EOD has font family/size/alignment/bold/italic but lacks parts of TradingView/reference background/border/padding and richer text behavior.|Keep anchor model; complete text box, background/border and formatting fidelity.|

## Hard contradictions: reference ZIP itself must not be treated as authority

These are the highest-risk examples because blindly converting the reference implementation would preserve the wrong behavior.

### 1. Inside Pitchfork

TradingView states that the Inside Pitchfork origin is located at **half the horizontal and half the vertical distance between the first two points**. It also shares the pitchfork additional-line-set model and supports up to nine added line sets. Current EOD/reference geometry does not faithfully implement that official origin/line-set behavior.

**Decision:** re-port from official TradingView definition; use the ZIP only for generic drawing-manager/Canvas patterns.

### 2. Fib Wedge

TradingView defines Fib Wedge as a **set of arcs spreading from the beginning of the trend**, with configurable Fibonacci arc levels and background fills. Current EOD and the reference ZIP construct straight radiating segments.

**Decision:** current/reference geometry is not salvageable as a faithful Fib Wedge; replace it with an arc-based implementation.

### 3. Arrow Marker

TradingView's Arrow Marker is set using **two reference points**, with the second point defining the arrow direction, and supports a text signature. Current EOD and the reference ZIP use a one-point triangle-style marker.

**Decision:** implement a genuine two-point Arrow Marker. If the current one-point marker is useful, rename it as an EOD custom marker instead of calling it TradingView Arrow Marker.

### 4. Price Range

TradingView Price Range is bounded by its two chosen points by default. Horizontal full-chart extension is an explicit **Extend** option. Current EOD/reference render the price range across chart width by default.

**Decision:** restore bounded default geometry; make extension optional.

### 5. Date Range

TradingView Date Range is a bounded box between the selected points. Vertical full-chart extension is an explicit **Extend** option. Current EOD/reference use full chart height by default.

**Decision:** restore bounded default geometry; make vertical extension optional.

### 6. Forecast

TradingView's current Position Forecast is not just a static two-point rectangle. It defines entry/exit and duration, then evaluates the forecast as **success or failure** as time/price progresses. Current EOD/reference are static.

**Decision:** re-port the current TradingView forecast behavior or retain the legacy object only under an explicitly custom name.

### 7. Fib Speed Resistance Fan

TradingView's Speed Resistance Fan combines price and time percentage levels and exposes grid, background, labels and Reverse. EOD's simple fan-ray model is not equivalent.

**Decision:** implement the actual Speed Resistance Fan rather than incrementally extending the current simple fan.

## Identity / naming issues requiring a product decision

### `fibExtension`

EOD currently exposes both:

- `fibExtension` — two-anchor **Fibonacci Extension**;
- `trendFibExtension` — three-anchor **Trend-Based Fib Extension**.

Current TradingView's public tool inventory lists Fibonacci Retracement and Trend-Based Fib Extension, not a separate conventional two-anchor Fibonacci Extension. The reference ZIP file named `fib-extension.ts` is itself a **three-anchor** Trend-Based-style implementation.

**Recommendation:** preserve `fibExtension` only if the user wants a custom EOD legacy tool, and label it clearly. It should not be used as the TradingView fidelity reference for Trend-Based Fib Extension.

### `projection`

A Projection tool appears in TradingView drawing inventories, and the reference ZIP implements a three-anchor A→B vector projected from C. The audit did not find a sufficiently detailed current English Supercharts help article that proves exact present-day Projection geometry/settings.

**Recommendation:** retain as **C/provisional** until an official/current TradingView screenshot or live interaction is captured and compared point-by-point.

### `measure`

TradingView's Measure is a fast temporary measurement interaction; it can also be invoked by holding Shift while selecting start/end points. EOD currently treats Measure as a persisted drawing kind.

**Recommendation:** support a TradingView-like transient Measure mode; keep persisted Measure only if desired as an EOD-specific extension.

### `forecast`

EOD title `Forecast` currently maps more closely to a static custom forecast box, while TradingView's documented Position Forecast has time-progress success/failure semantics.

**Recommendation:** re-port/rename deliberately rather than silently claiming parity.

## High-priority Fibonacci findings

### Fibonacci Retracement

Current EOD constants only expose:

`0, 0.236, 0.382, 0.5, 0.618, 0.786, 1`

TradingView supports up to 24 user-defined levels. Values above 1 are external retracement levels; values below 0 are extensions. This directly explains why the user's TradingView example showing 1.272 / 1.618 did not match EOD.

### Trend-Based Fib Extension

The correct conceptual model is three anchors:

- A = start of measured move;
- B = end of measured move;
- C = end of retracement;
- projected price at ratio `r` = `C + r × (B − A)`.

EOD already has the core three-anchor projection calculation, but the horizontal line span, labels, level schema and controls need to be matched against TradingView's official visual rather than assumed from the reference ZIP.

### Fib Wedge

This is the strongest Fibonacci re-port requirement: TradingView uses arcs, while EOD/reference use straight segments.

### Fib Speed Resistance Fan

This is not a generic Fibonacci fan. TradingView defines price/time percentage levels, grid, background and reverse. Treating it as a few slope-multiplied rays loses the tool's identity.

## Other structural findings

### Pitchfork family

The four pitchfork variants should share one common configurable line-set/style engine. TradingView permits multiple additional line sets, with common style/background controls and variant switching. Current EOD has hard-coded median/upper/lower-style representations and must be generalized before claiming fidelity.

### Gann family

TradingView explicitly requires a meaningful price/time scale relationship for Gann drawings. Gann Box also separates **Price Levels** from **Time Levels** and includes angles, labels, two background controls and Reverse. The current common fractional x/y grid is not equivalent.

### Long / Short Position

S2.3.1 fixed the most obvious geometry/visual defect: Long now has target above entry and stop below, Short is the inverse, with green profit/red loss zones. That work should be retained. Full TradingView parity would additionally require account/risk/lot/leverage/quantity/tick/PnL calculations. Those can remain chart-planning calculations and do not require broker execution authority.

## Recommended correction waves

### F1 — Fibonacci identity + geometry

Highest priority because it contains both user-visible errors and hard contradictions:

- Fibonacci Retracement
- `fibExtension` identity decision
- Trend-Based Fib Extension
- Fib Channel
- Fib Time Zone / Trend-Based Fib Time completion
- Fib Circles
- Fib Speed Resistance Arcs
- Fib Wedge — full re-port
- Fib Speed Resistance Fan — full re-port

**Acceptance:** side-by-side screenshot/interaction parity with official TradingView examples before moving on.

### F2 — Pitchfork + Gann structural fidelity

- Classic / Schiff / Modified Schiff common line-set model
- Inside Pitchfork full re-port
- Pitchfan
- Gann Fan scale ratio
- Gann Box separate price/time partitions, angles, backgrounds, labels and Reverse

### F3 — Measurement / forecasting / positions

- TradingView-like transient Measure
- Price Range bounded-default geometry + Extend
- Date Range bounded-default geometry + Extend
- Forecast / Position Forecast full re-port
- Projection exact current-behavior verification
- Long/Short optional full Inputs/Stats model

### F4 — B-class fidelity completion

- standard lines
- channels
- shapes
- Arrow / Arrow Up / Arrow Down
- Text
- plus Regression Trend and Trend Angle completion

This wave is mostly settings, stats, text, selected-state visuals and interaction polish after the structurally risky tools are corrected.

## Testing standard for the re-port program

Each corrected tool should receive tests at four levels:

1. **Geometry contracts** — anchors, coefficients, line/arc/box endpoints, direction, extension.
2. **Renderer contracts** — labels, fills, colors, selected handles, no debug text.
3. **Interaction contracts** — click count/order, drag handles, whole-object move, hit-testing, Esc cancel.
4. **Persistence/timeframe contracts** — symbol/sheet scope, timestamps, Renko/timeframe remap, visibility.

For complex tools, add image/screenshot-based manual acceptance against an official TradingView reference before marking the tool A-class.

## Licensing and provenance

- The uploaded reference project identifies itself as `lightweight-charts-drawing`, version `0.1.1`, with `license: MIT` and repository `https://github.com/deepentropy/lightweight-charts-drawing`.
- The current public GitHub repository also reports **MIT** and describes itself as drawing tools for TradingView's Lightweight Charts v5.
- TradingView's **Lightweight Charts** library is a separate open-source TradingView project (Apache 2.0). The reference drawing plugin is third-party and must not be described as TradingView Supercharts source code.
- If EOD reuses substantial code from the MIT reference, preserve required copyright/license notice and document provenance. A clean behavioral translation remains preferable where practical.

## Official TradingView sources used in this audit

- Drawing tool inventory: https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/
- Fibonacci Retracement: https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/
- Trend-Based Fib Extension: https://www.tradingview.com/support/solutions/43000518137-trend-based-fib-extension-drawing-tool/
- Fib Wedge: https://www.tradingview.com/support/solutions/43000518153-fib-wedge-drawing-tool/
- Fib Speed Resistance Fan: https://www.tradingview.com/support/solutions/43000518156-fib-speed-resistance-fan-drawing-tool/
- Fib Speed Resistance Arcs: https://www.tradingview.com/support/solutions/43000518157-fib-speed-resistance-arcs-drawing-tool/
- Fib Circles: https://www.tradingview.com/support/solutions/43000518159-fib-circles-drawing-tool/
- Inside Pitchfork: https://www.tradingview.com/support/solutions/43000518146-inside-pitchfork-drawing-tool/
- Pitchfork: https://www.tradingview.com/support/solutions/43000518141-pitchfork-drawing-tool/
- Gann Box: https://www.tradingview.com/support/solutions/43000518152-gann-box-drawing-tool/
- Gann Fan: https://www.tradingview.com/support/solutions/43000518151-gann-fan-drawing-tool/
- Regression Trend: https://www.tradingview.com/support/solutions/43000518108-regression-trend-drawing-tool/
- Price Range: https://www.tradingview.com/support/solutions/43000516996-price-range-drawing-tool/
- Date Range: https://www.tradingview.com/support/solutions/43000517005-date-range-drawing-tool/
- Position Forecast: https://www.tradingview.com/support/solutions/43000517004-position-forecast-drawing-tool/
- Long Position: https://www.tradingview.com/support/solutions/43000517002-long-position-drawing-tool/
- Long/Short calculations: https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/
- Arrow Marker announcement/behavior: https://www.tradingview.com/blog/en/arrow-marker-drawing-tool-18467/
- Arrow Marks: https://www.tradingview.com/support/solutions/43000518087-arrow-marks-drawing-tools/
- Measure quick use: https://www.tradingview.com/support/solutions/43000537228-how-to-use-measure-tool-quickly/
- Reference repository: https://github.com/deepentropy/lightweight-charts-drawing

## Audit conclusion

The correct next step is **not D4** and not a one-off Fib patch. The safest route is the F1–F4 fidelity program above, beginning with Fibonacci. The current EOD architecture (native Canvas renderer, persisted drawing model, scopes, timeframe anchoring, grouped dock and S2.3.1 tabbed settings) should be retained; the tools that fail fidelity should be re-ported **inside that architecture**.

**No EOD production source files were modified during this audit.**

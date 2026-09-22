# Phase D2 — Advanced One/Two-Anchor Geometry

**Status:** PLANNED — NOT IMPLEMENTED  
**Prerequisite:** Phase D1 accepted.

## 1. Goal

Add richer drawing geometry that still fits one/two-anchor persistence, while avoiding the generalized multi-anchor migration reserved for D3.

## 2. Planned tools

- Regression Trend
- Fibonacci Time Zone
- Fibonacci Speed Fan — only as a separate/enhanced tool if materially distinct from the current Fib Fan
- Fibonacci Circles
- Fibonacci Arcs
- Gann Box
- Circle
- Ellipse
- Forecast
- Arrow Marker
- Arrow Up
- Arrow Down

## 3. Main architectural concern

D2 is not merely renderer work. Some tools need:

- access to underlying bars between anchors;
- axis-aware geometry;
- labels that stay legible during zoom/pan;
- geometry-specific hit testing.

The current fixed two-anchor model may remain, but rendering and hit testing should be factored enough to avoid a giant `Renderer.ts` conditional block.

## 4. Regression Trend

Must use actual chart bars between the selected indexes.

Define before implementation:

- regression source: default `close`;
- center line: least-squares linear regression;
- channel bands: specify standard-deviation method and multiplier;
- behavior with fewer than two valid bars;
- behavior when data contains gaps.

Do not copy a renderer-only approximation if the reference implementation does not calculate the expected statistical channel correctly.

## 5. Fibonacci Time Zone

- Two anchors establish base time/index interval.
- Fibonacci multiples project along the X axis.
- Prefer logical bar indexes for EOD chart consistency.
- Labels must clearly distinguish projected bar positions from calendar days.

## 6. Fibonacci Circles / Arcs

Geometry must be defined in chart coordinate space carefully because X and Y axes have different scales.

Acceptance must verify:

- zoom
- pan
- resize
- reversed anchors
- very small anchor distance
- log/alternate scale behavior if later supported

## 7. Gann Box

Do not assume pixel-square geometry equals price/time-square semantics.

Document and test:

- anchor interpretation
- internal ratios
- vertical/horizontal divisions
- fan/diagonal ratios if included

## 8. Circle and Ellipse

Recommended native distinction:

- Circle: screen-space or defined constrained ellipse behavior.
- Ellipse: independent X/Y radii.

The chosen semantics must remain stable during zoom/pan.

## 9. Forecast

Keep it a drawing/annotation aid, not a prediction engine.

It may visualize a user-defined path/range from two anchors, but must not imply statistical forecasting unless an explicit calculation model is later added.

## 10. Arrow markers

Arrow Marker / Up / Down are one-anchor chart markers and should remain distinct from the existing two-anchor Arrow.

They require:

- one-click creation;
- consistent anchoring above/below price;
- selection/hit testing;
- persistence;
- sizing/property support.

## 11. Files to inspect first

D1 files plus any new renderer helpers created in D1. Also inspect:

- bar access APIs in `ChartEngine.ts`
- scale APIs used by `Renderer.ts`
- persistence normalization code
- screenshot/export rendering paths if drawings are included there

## 12. Tests required

- regression numerical fixtures;
- projection index fixtures;
- circle/ellipse geometry;
- arc clipping;
- Gann ratio fixtures;
- marker persistence;
- zoom/pan stability;
- hit testing;
- backward compatibility of all D1 and original drawings.

## 13. Exit gate

D2 is accepted only after D1 remains green and the richer geometry survives workspace reload, symbol/timeframe changes and portable runtime testing.

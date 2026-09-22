# F1C.1 — Fib Circles TradingView Fidelity V1

## Scope

This phase re-ports only `fibCircles`. Fibonacci Retracement, Trend-Based Fib Extension, Fib Arcs, Fib Wedge and the remaining drawing tools are outside this patch.

## Geometry contract

- Two selected anchors define opposite points of the level-1 ellipse bounding geometry.
- The common center is the midpoint of the two anchors in chart-pixel space.
- Base X/Y radii are one-half of the absolute anchor pixel deltas.
- Every enabled Fibonacci coefficient scales both base radii.
- Holding Shift while selecting the second point constrains the construction to 45 degrees in chart-pixel space, producing equal X/Y radii and therefore round circles.
- Renderer and hit-test use the same canonical `DrawingF1CGeometry.ts` geometry.

## Default levels

`0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618`

## Presentation

- Adds a separately configurable dashed Trend Line.
- Uses independent Fib-Circle level colors.
- Adds translucent background fills from the center through the enabled concentric bands.
- Labels are fixed at each ellipse bottom-center and use the existing F1 Fibonacci coefficient/percent formatter.
- Generic Left/Right label-position controls are disabled for Fib Circles.

## Compatibility

- Existing persisted `kind: fibCircles` is retained.
- Existing F1 settings/migration are reused.
- Existing coefficient-keyed circle presentation overrides remain compatible through stable-ID/legacy fallback resolution.
- No drawing-driven autoscale is introduced.

## Manual acceptance

1. Draw Fib Circles with a non-45-degree Point 1 → Point 2 construction: ellipses must be centered at the midpoint of the two anchors.
2. Hold Shift while selecting Point 2: the preview and committed geometry must become round circles.
3. Confirm all 11 default levels, including 3.618, 4.236 and 4.618.
4. Confirm each level can retain an independent color and visibility.
5. Confirm Background and Trend Line controls work.
6. Confirm labels appear at the bottom-center of their corresponding ellipse and coefficient/percent formatting follows Fibonacci options.
7. Confirm ring and trend-line hit-testing tracks the rendered geometry.
8. Regression-check Fib Retracement and Trend-Based Fib Extension; this patch must not alter their geometry or plotting behavior.

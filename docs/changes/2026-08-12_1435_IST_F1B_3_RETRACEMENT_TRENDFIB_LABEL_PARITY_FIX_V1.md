# F1B.3 Retracement / Trend-Based Fib Label Parity Fix V1

## Scope

This is a narrow post-F1B.2 visual-fidelity correction.

- Fibonacci Retracement now uses the same shared segment-side label placement/rendering path already used successfully by Trend-Based Fib Extension.
- Retracement geometry, coefficient/price math, finite A-to-B span, Extend Left/Right, Reverse semantics, and background rendering are unchanged.
- Trend-Based Fib Extension is not modified.
- F1B.2 removal of drawing-driven autoscale remains intact.
- The shared off-screen Y guard remains intact so labels outside the visible price range are not clamped and stacked at chart edges.

## Fidelity rule

For a visible horizontal Fib level:

- `Left` labels anchor at the left endpoint and render outside that endpoint using the shared drawing-label layout.
- `Right` labels anchor at the right endpoint and render outside that endpoint using the same shared layout.
- Retracement and Trend-Based Fib Extension therefore use one label-placement behavior instead of separate implementations.

## Non-goals

No changes to Fib Channel, Fib Time Zone, Trend-Based Fib Time, radial Fib tools, Speed Resistance Fan, Fib Spiral, legacy Fib Projection, workspace persistence, or price autoscale.

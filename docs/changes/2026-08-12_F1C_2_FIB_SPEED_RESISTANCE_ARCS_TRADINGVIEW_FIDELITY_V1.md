# F1C.2 — Fib Speed Resistance Arcs TradingView Fidelity V1

## Scope

This wave upgrades only `fibArcs` and preserves the accepted F1C.1 Fib Circles plus the F1B Retracement / Trend-Based Fib paths.

## Implemented

- Public name: **Fib Speed Resistance Arcs**.
- Point 1 is the common arc center; Point 1→Point 2 pixel distance is the level-1 radius.
- Upward price construction uses horizontal upper semicircles; downward price construction uses horizontal lower semicircles.
- Full 11-level F1 family through 4.618.
- Trend Line renderer/style.
- Background annular-sector bands using adjacent level colors.
- Full Circles setting connected end-to-end.
- Left / Right / Top / Bottom level-label toggles connected end-to-end.
- F1 coefficient/percent formatting reused.
- Canonical F1C geometry shared by renderer and hit-test.
- Generic Fib-Arcs Left/Right label-position dropdown removed.

## Non-goals / protected paths

- No Fib Retracement changes.
- No Trend-Based Fib Extension changes.
- No Fib Circles geometry/rendering changes.
- No drawing-driven autoscale changes.

## Validation

Focused F1C.2/F1C.1/F1B contract and geometry tests, renderer TypeScript typecheck, and renderer production build.

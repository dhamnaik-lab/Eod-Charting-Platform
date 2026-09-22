# F1B.5 Retracement / Trend-Based Fib Plot-Style Parity V1

## Scope
Correct only the remaining Fibonacci Retracement horizontal level plotting-style mismatch identified after F1B.4.

## Fresh-source audit finding
F1B.4's TradingView/video price orientation is already correct and remains unchanged:
- Point 2 = level 0.
- Point 1 = level 1.
- Low→high first/second placement retraces and extends downward.
- High→low mirrors upward.

The remaining mismatch is horizontal level projection. Trend-Based Fib Extension already defaults to `extendRight=true`, while two-point Fib Retracement was still created and interpreted with `extendRight` disabled unless explicitly set. This produced the short A↔B-only level block visible in the reported screenshot.

## Fix
- Fib Retracement now follows the working Trend-Based Fib plotting style by enabling Extend Right by default.
- Existing Retracement drawings with no persisted `extendRight` value are interpreted as right-extended.
- Explicit `extendRight=false` remains authoritative, so "Don't extend" and Left-only continue to work.
- Renderer, hit testing, new-drawing creation, and Drawing Properties use the same effective Extend Right rule.
- F1B.4 price orientation, F1B.3 label parity, no-label-autoscale behavior, and every other Fibonacci tool remain unchanged.

## Non-goals
No change to Retracement coefficient-to-price math, Reverse semantics, labels, colors, background bands, Trend-Based Fib Extension, other F1B tools, radial tools, workspace schema, or price autoscale.

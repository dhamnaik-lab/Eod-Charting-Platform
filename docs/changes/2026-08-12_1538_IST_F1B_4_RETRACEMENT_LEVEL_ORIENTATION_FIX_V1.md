# F1B.4 Retracement Level Orientation Fix V1

## Scope
Correct Fibonacci Retracement coefficient-to-price orientation only. The F1B.3 label-parity behavior, finite A↔B horizontal span, independent Extend Left/Right controls, label/scaling separation, and all other F1B tools remain unchanged.

## TradingView/video contract
- Point 2 is level `0` by default.
- Point 1 is level `1` by default.
- A low→high draw therefore places `0` at the high and retracement/extension levels progress downward; ratios above `1` continue below Point 1.
- A high→low draw mirrors this upward.
- Reverse swaps the price orientation but does not alter horizontal geometry.

## Formula
Default: `price(r) = Point2.price + r * (Point1.price - Point2.price)`.
Reverse: apply `q = 1-r` before the same formula.

## Non-goals
No changes to Trend-Based Fib Extension, Fibonacci Channel, Fib Time Zone, Trend-Based Fib Time, label placement, autoscale, workspace persistence, or radial Fibonacci tools.

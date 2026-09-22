# F1B.1 Fibonacci Retracement Projection + Autoscale Fix V1

Baseline: validated F1B V1.1 over F1A V1.1.

Scope:
- Fibonacci Retracement horizontal projection now originates at Point B and follows the A->B time-axis direction.
- Reverse remains a price-orientation control only and does not flip horizontal projection direction.
- Visible F1B horizontal Fibonacci price levels can contribute to price-pane Auto Scale when no manual price-scale override is active.
- Auto Scale retains normal chart padding around the combined candle/indicator/drawing range.
- Off-screen drawing label anchors are not clamped into a shared top/bottom pixel, preventing stacked level text when manual scaling hides a level.
- Trend-Based Fib Extension participates in the shared F1B autoscale collector.

Non-goals:
- No changes to Fibonacci Channel, Fib Time Zone, or Trend-Based Fib Time geometry.
- No changes to radial/fan/spiral tools.
- No change to legacy fibExtension semantics.

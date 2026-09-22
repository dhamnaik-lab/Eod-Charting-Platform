# F1B.2 Fib Retracement Span + Outside-Label Fix V1

Corrective TradingView-fidelity patch over validated F1B.1.

- Restores default Fib Retracement horizontal levels to the finite A<->B span.
- Keeps Extend Left and Extend Right as independent opt-in expansions to pane edges.
- Keeps F1B price orientation: level 0 = Point A, level 1 = Point B; Reverse changes price mapping only.
- Renders Fib Retracement level text outside the level span: left labels grow left, right labels grow right.
- Removes the F1B.1 drawing-level-driven Auto Scale integration. Labels no longer force off-screen Fib levels into the visible price range.
- Retains the F1B.1 off-screen label guard so labels are not stacked by clamping to chart top/bottom.

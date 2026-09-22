# F1B — Linear + Time Fibonacci Fidelity V1

**IST timestamp:** 2026-08-12 02:04 IST (+05:30)  
**Required baseline:** validated F1A Fibonacci Foundation V1.1 over `Eod Charting Platform Source Code 2026-08-11_222627_IST`

## Scope

F1B activates the audited geometry/runtime foundation for exactly five modern Fibonacci tools:

1. Fibonacci Retracement (`fib`)
2. Trend-Based Fib Extension (`trendFibExtension`)
3. Fib Channel (`fibChannel`)
4. Fib Time Zone (`fibTimeZone`)
5. Trend-Based Fib Time (`fibTimeExtension`)

The separate two-point `fibExtension` / **Fib Projection (Legacy)** behavior is deliberately preserved. Radial tools, Fib Wedge, Fib Speed Resistance Fan and Fib Spiral are not changed in this package.

## Implemented

- shared F1B runtime adapter consumes F1A stable persisted level definitions without binding renderer code to one exact serialized shape;
- shared F1B canonical geometry is consumed by renderer and hit-testing;
- Fib Retracement maps 0 to Point 1 and 1 to Point 2; Reverse reflects the level order;
- Trend-Based Fib Extension projects from Point C using the A→B price move and supports vertical Reverse around Point C;
- Fib Channel translates A→B by the A→C vector for each coefficient;
- Fib Time Zone keeps Fibonacci time spacing from the A→B interval and adds the Initial Line;
- Trend-Based Fib Time projects vertical levels from Point C using the A→B time span;
- stored enabled/disabled custom level rows are honored;
- stable level IDs retain saved component presentation, with coefficient-keyed S2.x style fallback for legacy drawings;
- coefficient vs percent label formatting, price visibility, left/right label position and top/bottom time-label placement are runtime-capable;
- optional Background style slots added for Trend-Based Fib Extension, Fib Time Zone and Trend-Based Fib Time;
- Fib Channel/retracement existing band fills remain in their established slots;
- legacy `fibExtension` renderer/hit test remains isolated and unchanged.

## Deliberately deferred

F1B V1 does not yet expose every new F1A tool-setting field as a dedicated TradingView-style control in the Properties UI. The runtime and persistence path accepts those settings, while the existing advanced per-component Style table remains authoritative for line colors/width/style/opacity. Log-scale Fib calculation also remains deferred because it requires chart-log-state-aware geometry rather than a local renderer toggle.

## Validation

The installer performs a semantic F1A V1.1 guard, pre-change backup, SHA-256 payload verification, narrowly-scoped semantic source patching, post-patch state verification, focused Vitest regression, the known slower Renko state-mutation test with a 15-second timeout, renderer TypeScript typecheck, and renderer production build.

No portable rebuild is required for automated validation. Visual/manual acceptance should be done after F1B PASS and before proceeding to F1C radial tools.

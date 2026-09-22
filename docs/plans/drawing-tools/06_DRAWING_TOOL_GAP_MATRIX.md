# Drawing Tool Gap Matrix

**Baseline current tools:** 13  
**Reference registry:** 67 implemented tools

Legend:

- **HAVE** — current platform already provides the capability.
- **SIMILAR** — current platform has related behavior; do not replace blindly.
- **D1-D5** — planned implementation phase.
- **DEFER** — not implemented in reference or outside current scope.

| Reference tool | Anchors | Current status | Plan |
|---|---:|---|---|
| Trend Line | 2 | HAVE | Preserve |
| Horizontal Line | 1 | HAVE | Preserve |
| Vertical Line | 1 | HAVE | Preserve |
| Ray | 2 | HAVE | Preserve |
| Arrow | 2 | HAVE | Preserve |
| Extended Line | 2 | Missing | D1 |
| Cross Line | 1 | Missing | D1 |
| Info Line | 2 | Missing | D1 |
| Trend Angle | 2 | Missing | D1 |
| Horizontal Ray | 1 | Missing | D1 |
| Rectangle | 2 | HAVE | Preserve |
| Circle | 2 | Missing | D2 |
| Triangle | 3 | Missing | D3 |
| Price Range | 2 | Missing | D1 |
| Parallel Channel | 3 ref / native special model | HAVE | Preserve |
| Regression Trend | 2 | Missing | D2 |
| Flat Top/Bottom | 3 | Missing | D3 |
| Disjoint Channel | 4 | Missing | D3 |
| Fibonacci Retracement | 2 | HAVE | Preserve |
| Fibonacci Extension | 3 ref | SIMILAR: native is 2-anchor | Add separate Trend-Based version in D3 |
| Fibonacci Channel | 3 | Missing | D3 |
| Fibonacci Time Zone | 2 | Missing | D2 |
| Fibonacci Speed Fan | 2 | SIMILAR: native Fib Fan | D2 only if materially distinct |
| Trend-Based Fib Time | 3 | Missing | D3 |
| Fibonacci Circles | 2 | Missing | D2 |
| Fibonacci Spiral | 2 | Missing | D4 |
| Fibonacci Arcs | 2 | Missing | D2 |
| Fibonacci Wedge | 3 | Missing | D3 |
| Pitchfan | 3 | Missing | D3 |
| Andrews' Pitchfork | 3 | Missing | D3 |
| Schiff Pitchfork | 3 | Missing | D3 |
| Modified Schiff Pitchfork | 3 | Missing | D3 |
| Inside Pitchfork | 3 | Missing | D3 |
| Gann Box | 2 | Missing | D2 |
| Gann Fan | 2 | HAVE | Preserve |
| Gann Square Fixed | 1 | Missing | D4 |
| Gann Square | 2 | Missing | D4 |
| Long Position | 3 | Missing | D3 |
| Short Position | 3 | Missing | D3 |
| Date Range | 2 | Missing | D1 |
| Date and Price Range | 2 | SIMILAR: native Measure | Preserve Measure; no duplicate initially |
| Projection | 3 | Missing | D3 |
| Text | 1 | SIMILAR/HAVE: native Text Label | Preserve |
| Callout | 2 | Missing | D4 |
| Brush | variable in practice | Missing | D4 |
| Highlighter | variable in practice | Missing | D4 |
| Arrow Marker | 1 | Missing | D2 |
| Arrow Mark Up | 1 | Missing | D2 |
| Arrow Mark Down | 1 | Missing | D2 |
| Ellipse | 2 | Missing | D2 |
| Arc | 3 | Missing | D3 |
| Rotated Rectangle | 3 | Missing | D3 |
| Path | variable in practice | Missing | D4 |
| Polyline | variable in practice | Missing | D4 |
| Curve | 4 | Missing | D4 |
| Double Curve | 3 | Missing | D4 |
| Anchored Text | 2 | Missing | D4 |
| Note | 1 | Missing | D4 |
| Price Note | 1 | Missing | D4 |
| Price Label | 1 | Missing | D4 |
| Flag Mark | 1 | Missing | D4 |
| Pin | 1 | Missing | D4 |
| Comment | 1 | Missing | D4 |
| Signpost | 1 | Missing | D4 |
| Table | 1 | Missing | D5 |
| Forecast | 2 | Missing | D2 |
| Bars Pattern | 3 | Missing | D5 |

## Current-native-only behavior to retain

The current platform's `Measure` is not discarded simply because the reference has Date Range / Price Range / Date+Price Range variants.

The current two-anchor `fibExtension` is also retained even though the reference repository's Fibonacci Extension requires three anchors.

## Deferred reference concepts with no registered implementation

- Ghost Feed
- Anchored VWAP drawing
- Fixed Range Volume Profile
- Anchored Volume Profile
- Image
- Tweet
- Idea

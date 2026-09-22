# Deep Audit: Chart Patterns Subsystem
**EOD Charting Platform** · *Read-Only Subsystem Audit* · Date: 2026-08-13

---

## 1. Executive Summary & Scope

The Chart Patterns subsystem in the **EOD Charting Platform** consists of three primary architectural layers:

1. **Candlestick Pattern Engine ([`Patterns.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Patterns.ts))**: In-line single/multi-bar pattern detection engine registered as a main pane indicator overlay (`kind: 'PATTERN'`).
2. **Geometric Chart Pattern & Scanner Engine ([`src/plugins/scanner/`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/))**: Web Worker-driven 54-pattern scanner execution engine evaluating geometric bases, trendlines, channels, triangles, gaps, and island reversals.
3. **Interactive Drawing Tools ([`src/engine/`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/))**: Native Canvas 2D manual drawing tools for chart shapes and channels (`triangle`, `rotatedRect`, `flatChannel`, `disjointChannel`, `regressionTrend`).

### Core Audit Conclusion
The EOD Charting Platform possesses a **formidable, high-performance geometric scanner framework** (54 scanner patterns across 6 families) and a working **candlestick marker system** (13 patterns). However, when evaluated against **TradingView Supercharts** and **Thomas Bulkowski’s Encyclopedia of Chart Patterns** fidelity standards, critical gaps exist:
- **Candlestick Engine**: 13 patterns implemented vs 87 standard candlestick patterns; hardcoded ratio thresholds without user customization.
- **Scanner Engine**: Fixed pivot strength lookbacks; single-stage volume validation; incomplete default target/stop visual projections on live chart panes.
- **Manual Pattern Drawing Tools**: Complete absence of dedicated multi-point TradingView pattern drawing tools (`XABCD Harmonic`, `ABCD`, `Head & Shoulders 7-point`, `Elliott Wave 1-5 / ABC`).

---

## 2. Candlestick Pattern Engine Audit ([`Patterns.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Patterns.ts))

### 2.1 Architecture & Flow
- **Entry Point**: Called via [`Indicators.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Indicators.ts#L1480-L1487) when indicator `kind === 'PATTERN'`.
- **Function**: `detectPatterns(bars: OHLCBar[], selectedPatterns: string[], fallbackColor?: string): RenderableMarker[]` ([`Patterns.ts:L19`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Patterns.ts#L19)).
- **Output**: Array of `RenderableMarker` objects positioned `'above'` or `'below'` bars with short codes (`DOJ`, `HMR`, `ENG`, etc.).

### 2.2 Implemented Patterns (13 Total)

| Pattern ID | Label | Type | Detection Logic | Limitations / Risk |
|---|---|---|---|---|
| `doji` | DOJ | Neutral | `body <= range * 0.1` | Fixed 10% threshold; ignores Dragonfly/Gravestone variants |
| `hammer` | HMR | Bullish | `lowerWick >= body * 2 && upperWick <= body * 0.5` | No prior downtrend requirement; false signals in uptrends |
| `inv_hammer` | I-HMR | Bullish | `upperWick >= body * 2 && lowerWick <= body * 0.5` | No prior downtrend requirement |
| `shooting_star` | STAR | Bearish | `upperWick >= body * 2 && lowerWick <= body * 0.5 && isDown` | Fixed 2:1 wick ratio; requires prior uptrend check |
| `engulfing` | ENG | Bull/Bear | `currBody > prevBody && opposite colors && close/open engulf` | Only compares previous 1 bar; ignores shadows/wicks |
| `harami` | HAR | Bull/Bear | `prevBody > currBody && inside previous body` | Strictly body-inside-body; ignores shadow context |
| `morning_star` | M-STAR | Bullish | 3-bar: `isDown(i-2) && body(i-1) <= range(i-1)*0.3 && isUp(i) && close > mid(i-2)` | Fixed 30% star body threshold |
| `evening_star` | E-STAR | Bearish | 3-bar: `isUp(i-2) && body(i-1) <= range(i-1)*0.3 && isDown(i) && close < mid(i-2)` | Fixed 30% star body threshold |
| `marubozu` | MARU | Bull/Bear | `body >= range * 0.95 && body > 0` | 95% ratio is overly strict for volatile EOD bars |
| `piercing` | PRC | Bullish | 2-bar: `isDown(i-1) && isUp(i) && open < prev.low && close > prev.mid && close < prev.open` | Rigid `open < prev.low` requirement |
| `dark_cloud` | D-CLD | Bearish | 2-bar: `isUp(i-1) && isDown(i) && open > prev.high && close < prev.mid && close > prev.open` | Rigid `open > prev.high` requirement |
| `soldiers` | 3-SOL | Bullish | 3-bar: consecutive green, higher closes, `lowerWick < body * 0.3` | Ignores upper wick limits and relative candle sizes |
| `crows` | 3-CRW | Bearish | 3-bar: consecutive red, lower closes, `upperWick < body * 0.3` | Ignores lower wick limits and relative candle sizes |

### 2.3 Key Deficiencies in Candlestick Subsystem
1. **Hardcoded Detection Thresholds**: Ratios like `0.1` (Doji), `0.95` (Marubozu), `2.0` (Hammer wick) are hardcoded inline in [`Patterns.ts:L33-L144`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/Patterns.ts#L33-L144). Users cannot adjust sensitivity.
2. **Missing Trend Context**: Patterns like Hammer, Inverted Hammer, Shooting Star, Engulfing, and Harami rely on prior trend context. `detectPatterns()` evaluates bars in isolation without evaluating prior 5-10 bar direction.
3. **Limited Catalog**: Only 13 patterns vs TradingView’s 40+ candlestick indicators and Bulkowski’s 87 candlestick patterns (missing Spinning Top, Tweezer Top/Bottom, Kicker, Belt Hold, Three Inside/Outside, Mat Hold, etc.).

---

## 3. Geometric Chart Pattern Scanner Subsystem Audit ([`src/plugins/scanner/`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/))

### 3.1 Architecture Overview
The platform features an advanced multi-threaded pattern scanner subsystem ([`chartPatternScanners.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternScanners.ts), [`chartPatternEvaluation.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternEvaluation.ts), [`chartPatternWorkerClient.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternWorkerClient.ts)):
- **54 Pattern Algorithms**: Divided into 6 structured families.
- **Web Worker Parallelization**: Offloads expensive pivot-finding and linear-regression calculations off the main UI thread.
- **Primitive Engine ([`chartPatternPrimitives.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternPrimitives.ts))**: Handles local pivots (`findLocalPivots`), range-bound checks (`isRangeBound`), linear slope fitting (`linearSlope`), and volume spikes (`isVolumeSpike`).

### 3.2 54-Pattern Coverage Matrix

| Family | Planned Count | Implemented Patterns | Key Algorithmic Mechanics | Audit Status |
|---|---:|---|---|---|
| **Bullish Reversals** | 12 | Double Bottom, Triple Bottom, Inv. H&S, Cup & Handle, Rounding Bottom, Falling Wedge, V-Bottom, Adam & Eve Bottom, Diamond Bottom, Broadening Bottom, Bump-and-Run, Horn Bottom | `findLocalPivots(bars, strength)` matching trough depth within tolerance; neckline breakout check | 🟢 Implemented in `chartPatternScanners.ts` |
| **Bearish Reversals** | 12 | Head & Shoulders, Double Top, Triple Top, Rounding Top, Rising Wedge, Inv. Cup & Handle, Spike Top, Adam & Eve Top, Diamond Top, Blow-off Top, Bump-and-Run, Horn Top | Peak pivot clustering, inverted neckline fit, volume decay | 🟢 Implemented in `chartPatternScanners.ts` |
| **Bullish Continuations** | 10 | Bull Flag, Bull Pennant, Ascending Triangle, Rising Channel, High Tight Flag, Scallop & Handle, 3 Rising Valleys, Measured Move Up, Rising Three Methods, Mat Hold | Pole detection (`minMovePct`), consolidation channel/triangle bounds, upper boundary breakout | 🟢 Implemented in `chartPatternScanners.ts` |
| **Bearish Continuations** | 8 | Bear Flag, Bear Pennant, Descending Triangle, Falling Channel, 3 Falling Peaks, Measured Move Down, Falling Three Methods, Mat Hold | Down-pole detection, descending consolidation bounds, lower breakdown | 🟢 Implemented in `chartPatternScanners.ts` |
| **Neutral / Bilateral** | 6 | Symmetrical Triangle, Rectangle Range, Broadening Formation, Volatility Squeeze (Coil), Diamond Pattern, Complex H&S | Converging/diverging trendlines via `linearSlope`, range midpoint stability | 🟢 Implemented in `chartPatternScanners.ts` |
| **Gap Patterns** | 6 | Common Gap, Breakaway Gap, Runaway Gap, Exhaustion Gap, Island Reversal Top, Island Reversal Bottom | `gapUpPct` / `gapDownPct`, volume multiplier, post-gap trend continuation or island isolation | 🟢 Implemented in `chartPatternScanners.ts` |

### 3.3 Critical Scanner Engine Deficiencies
1. **Fixed Pivot Strength (`strength: number`)**:
   - [`chartPatternPrimitives.ts:L68-L87`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternPrimitives.ts#L68-L87): `findLocalPivots` uses a static neighbor window `[index - strength, index + strength]`.
   - On daily EOD charts, a fixed `strength` (e.g. 3 or 5 bars) fails to detect multi-month macro patterns (e.g., 90-day Head & Shoulders) or creates noisy micro-pivots during consolidation.
2. **Simplified Linear Regression / Trendline Fit**:
   - `linearSlope` computes ordinary least squares (OLS) across pivot indices. It does not enforce upper/lower outer envelope bounds (touchpoint validation).
   - Real-world chart pattern trendlines require at least 2-3 distinct touchpoints with price action staying strictly on one side of the line.
3. **Single-Stage Volume Filter**:
   - Volume confirmation (`isVolumeSpike`) only checks if current bar volume exceeds a simple average multiplier (`volume >= average * multiplier`).
   - Standard chart pattern theory (Bulkowski / TradingView) requires volume contraction during pattern formation followed by a volume surge on breakout.

---

## 4. Interactive Pattern Drawing Tools Audit ([`src/engine/`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/))

### 4.1 Current Manual Drawing Tool Inventory
In [`types.ts:L331-L379`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/types.ts#L331-L379) and [`DrawingStyleSchema.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts), the platform supports general shapes:
- `triangle` (3-point polygon)
- `rotatedRect` (3-point rotated box)
- `flatChannel` (3-point horizontal channel)
- `disjointChannel` (4-point non-parallel channel)
- `regressionTrend` (2-point linear regression channel)

### 4.2 Missing TradingView Standard Pattern Drawing Tools (Severity: 🔴 HIGH)
TradingView Supercharts provides a dedicated **"Patterns"** drawing tool category. The EOD Charting Platform currently has **ZERO** native interactive pattern tools in this group:

| TradingView Tool Name | Anchor Count | Geometry / Semantics | Status in EOD Platform |
|---|---:|---|---|
| **XABCD Pattern** | 5 (X, A, B, C, D) | Harmonic pattern tool with automatic Fibonacci ratio labels between legs (XA, AB, BC, CD) | ❌ **MISSING** |
| **ABCD Pattern** | 4 (A, B, C, D) | 3-segment vector tool displaying AB=CD length and time ratios | ❌ **MISSING** |
| **Head and Shoulders** | 7 (LS, Head, RS + Neckline points) | 3-peak structure with shaded shoulders, head peak, and extended neckline | ❌ **MISSING** |
| **Elliott Impulse Wave (1-2-3-4-5)** | 6 (0, 1, 2, 3, 4, 5) | 5-wave impulse sequence with numerical badges and wave leg projection | ❌ **MISSING** |
| **Elliott Correction Wave (A-B-C)** | 4 (0, A, B, C) | 3-wave corrective structure with lettered badges | ❌ **MISSING** |
| **Elliott Combo Wave (W-X-Y)** | 4 (0, W, X, Y) | Double combination corrective wave tool | ❌ **MISSING** |
| **Three-Drives Pattern** | 7 (0, 1, 2, 3, A, B, C) | Harmonic 3-drive symmetry tool with Fibonacci ratio annotations | ❌ **MISSING** |
| **Cypher Pattern** | 5 (X, A, B, C, D) | Specific harmonic ratio pattern tool | ❌ **MISSING** |

---

## 5. Comparison & Parity Summary

| Subsystem Component | EOD Charting Platform Current State | TradingView / Bulkowski Parity Standard | Gap Rating |
|---|---|---|---|
| **Candlestick Patterns** | 13 patterns in `Patterns.ts`; fixed thresholds | 40+ TV indicators / 87 Bulkowski patterns; configurable thresholds | 🟡 **Medium Gap** |
| **Candlestick Trend Context** | Isolated bar evaluation; no prior trend checks | Prior 5-10 bar trend validation before declaring reversal markers | 🔴 **High Gap** |
| **Chart Pattern Scanner** | 54 geometric pattern scanners across 6 families; Web Worker runner | Full pattern recognition with multi-timeframe swing scaling & volume profiles | 🟢 **Strong Foundation** |
| **On-Chart Scanner Overlays** | Scanner metadata exists; auto-overlay promotion undergoing rollout | Automatic drawing overlay (shaded zones, target lines, stop-loss lines) | 🟠 **In Progress** |
| **Interactive Pattern Drawing Tools** | 0 dedicated pattern tools (relies on general shapes/channels) | 8+ interactive multi-point pattern tools (`XABCD`, `H&S`, `Elliott Waves`) | 🔴 **Critical Defect** |

---

## 6. Actionable Remediation Roadmap

### Phase 1 — Interactive Pattern Drawing Tools (TradingView Parity)
1. **Define Multi-Anchor Pattern Contracts**:
   - Add `xabcdPattern`, `abcdPattern`, `headAndShouldersPattern`, `elliottImpulse`, `elliottCorrection` to `ChartDrawing` union in [`types.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/types.ts).
2. **Implement Interactive Geometry & Ratio Calculations**:
   - Calculate real-time Fibonacci ratios (e.g. AB/XA, BC/AB, CD/BC for `xabcd`) and render ratio badges on canvas segments.
3. **Register Style Schemas**:
   - Add line, fill, text, and ratio presentation slots to [`DrawingStyleSchema.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/DrawingStyleSchema.ts).

### Phase 2 — Candlestick Engine Hardening
1. **Configurable Thresholds**:
   - Move hardcoded constants (`0.1`, `0.95`, `2.0`) into user-configurable indicator settings.
2. **Prior Trend Context Verification**:
   - Integrate `hasUpTrend()` / `hasDownTrend()` helpers from `chartPatternPrimitives.ts` into `detectPatterns()` to eliminate false reversal markers.
3. **Expand Pattern Catalog**:
   - Add Spinning Top, Tweezer Top/Bottom, Kicker, Three Inside, and Belt Hold.

### Phase 3 — Scanner & Overlay Synergy
1. **Dynamic Pivot Window Scaling**:
   - Multi-scale pivot search (`strength: 3, 5, 10, 20`) to capture both short-term swing patterns and multi-month bases.
2. **Automatic Target & Stop Visual Overlays**:
   - Auto-generate interactive drawing projections when a user clicks a scanned pattern result in the Scanner Window.

---

## 7. Detailed Technical Specifications for Implementation

### 7.1 Proposed `ChartDrawing` Interface Additions ([`src/engine/types.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/engine/types.ts))

```ts
// Proposed addition to ChartDrawing union type in src/engine/types.ts
export type ChartPatternDrawing =
  | (MultiAnchorDrawingBase & { kind: 'xabcdPattern'; anchors: DrawingAnchor[] }) // 5 anchors: X, A, B, C, D
  | (MultiAnchorDrawingBase & { kind: 'abcdPattern'; anchors: DrawingAnchor[] })  // 4 anchors: A, B, C, D
  | (MultiAnchorDrawingBase & { kind: 'headAndShouldersPattern'; anchors: DrawingAnchor[] }) // 7 anchors: LS, Head, RS, NecklinePoints
  | (MultiAnchorDrawingBase & { kind: 'elliottImpulse'; anchors: DrawingAnchor[] }) // 6 anchors: 0, 1, 2, 3, 4, 5
  | (MultiAnchorDrawingBase & { kind: 'elliottCorrection'; anchors: DrawingAnchor[] }); // 4 anchors: 0, A, B, C
```

### 7.2 Harmonic & Pattern Ratio Formulas
1. **XABCD Pattern Ratios**:
   - $\text{AB/XA Ratio} = \frac{|P_B - P_A|}{|P_A - P_X|}$ (Target Fibs: 0.382, 0.500, 0.618, 0.786)
   - $\text{BC/AB Ratio} = \frac{|P_C - P_B|}{|P_B - P_A|}$ (Target Fibs: 0.382, 0.886)
   - $\text{CD/BC Ratio} = \frac{|P_D - P_C|}{|P_C - P_B|}$ (Target Fibs: 1.272, 1.618, 2.618)
   - $\text{CD/XA Retracement} = \frac{|P_D - P_A|}{|P_A - P_X|}$ (Target Fibs: 0.786 Gartley, 0.886 Bat, 1.130 Spike)

2. **Head and Shoulders 7-Point Geometry**:
   - Points 1, 3, 5: Troughs / Peaks (Left Shoulder, Head, Right Shoulder)
   - Points 2, 4: Neckline Intercepts
   - Neckline Line: Ray passing through $P_2(x_2, y_2)$ and $P_4(x_4, y_4)$
   - Pattern Height: $H = |y_{\text{Head}} - y_{\text{Neckline at Head Index}}|$
   - Target Objective: $P_{\text{Target}} = y_{\text{Neckline Breakout}} \pm H$

### 7.3 Multi-Scale Pivot Search Algorithm (Proposed Enhancement to [`chartPatternPrimitives.ts`](file:///E:/TA%20Projects/EOD%20Charting%20Platform/src/plugins/scanner/chartPatternPrimitives.ts))

```ts
export function findMultiScalePivots(bars: EodBar[], scales: number[] = [3, 5, 10, 20]): ChartPatternPivot[] {
  const pivotMap = new Map<number, ChartPatternPivot>();
  for (const strength of scales) {
    const pivots = findLocalPivots(bars, strength);
    for (const p of pivots) {
      if (!pivotMap.has(p.index)) {
        pivotMap.set(p.index, { ...p, strength });
      } else {
        const existing = pivotMap.get(p.index)!;
        existing.strength = Math.max(existing.strength ?? 0, strength);
      }
    }
  }
  return Array.from(pivotMap.values()).sort((a, b) => a.index - b.index);
}
```

---

> [!NOTE]
> This is a **read-only architectural and behavioral audit report**. No source files have been modified.

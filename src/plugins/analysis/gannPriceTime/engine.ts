/**
 * Gann Price-Time Analysis Plugin — Pure Computational Engine
 *
 * No DOM, no Canvas API, no React, no external dependencies.
 * All functions are pure and deterministic given the same bar inputs.
 */

import type {
  GannAngleRay,
  GannBar,
  GannBreakoutStatus,
  GannCycleSignal,
  GannPivot,
  GannPluginOptions,
  GannSetup,
  SquareOfNineLevel,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CYCLE_INTERVALS = [45, 90, 180, 360] as const;
const BREAKOUT_LOOKOUT_BARS = 5;
const VOLUME_LOOKBACK_BARS = 20;
const MIN_BARS_REQUIRED = 360;

const ANGLE_RAY_DEFINITIONS: Array<{ label: string; multiplier: number; color: string }> = [
  { label: '2×1', multiplier: 2.0, color: '#f59e0b' }, // amber — fast bull line
  { label: '1×1', multiplier: 1.0, color: '#3b82f6' }, // blue — equilibrium
  { label: '1×2', multiplier: 0.5, color: '#a78bfa' }, // violet — half velocity
];

const SQUARE_OF_NINE_ANGLES = [45, 90, 135, 180, 225, 270, 315, 360] as const;

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

export const DEFAULT_GANN_OPTIONS: GannPluginOptions = {
  pivotWindowRadius: 8,
  atrPeriod: 14,
  fixedScale: null,
  rayLookForward: 180,
  showAngles: true,
  showSquareOfNine: true,
  showCycles: true,
};

// ---------------------------------------------------------------------------
// 1. ATR Calculator
// ---------------------------------------------------------------------------

/**
 * Computes the Wilder Average True Range over the last `period` completed bars.
 *
 * Returns the ATR value (points per bar), which serves as the scale constant S
 * for the 1×1 Gann angle.
 *
 * Returns 0 if there are fewer than 2 bars (cannot compute true range).
 */
export function computeATR(bars: GannBar[], period: number): number {
  if (bars.length < 2) return 0;

  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close),
    );
    trValues.push(tr);
  }

  // Use only the last `period` TRs
  const window = trValues.slice(-period);
  if (window.length === 0) return 0;

  const atr = window.reduce((sum, v) => sum + v, 0) / window.length;
  return atr;
}

// ---------------------------------------------------------------------------
// 2. Pivot Detector
// ---------------------------------------------------------------------------

/**
 * Scans `bars` with a centred rolling window of half-width `windowRadius`
 * to identify objective swing highs and swing lows.
 *
 * Returns the most recent confirmed swing high and swing low as a pivot pair.
 * A bar at index `i` is a swing high if its `high` is the maximum over the
 * range [i - r, i + r], and a swing low if its `low` is the minimum.
 *
 * Only fully-windowed bars (indices [r, n-1-r]) are evaluated.
 */
export function detectPivots(bars: GannBar[], windowRadius: number): GannPivot[] {
  const r = windowRadius;
  const n = bars.length;
  const pivots: GannPivot[] = [];

  // Track the last seen swing high and swing low to return only the most recent pair
  let lastHigh: GannPivot | null = null;
  let lastLow: GannPivot | null = null;

  for (let i = r; i < n - r; i++) {
    const bar = bars[i];

    // Swing high check
    let isHigh = true;
    for (let j = i - r; j <= i + r; j++) {
      if (j !== i && bars[j].high >= bar.high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) {
      lastHigh = {
        barIndex: i,
        date: bar.date,
        price: bar.high,
        polarity: 'high',
      };
    }

    // Swing low check
    let isLow = true;
    for (let j = i - r; j <= i + r; j++) {
      if (j !== i && bars[j].low <= bar.low) {
        isLow = false;
        break;
      }
    }
    if (isLow) {
      lastLow = {
        barIndex: i,
        date: bar.date,
        price: bar.low,
        polarity: 'low',
      };
    }
  }

  if (lastHigh) pivots.push(lastHigh);
  if (lastLow) pivots.push(lastLow);

  return pivots;
}

// ---------------------------------------------------------------------------
// 3. Square of Nine Transformer
// ---------------------------------------------------------------------------

/**
 * Computes 8 Square of Nine harmonic price levels from an anchor price using
 * the angular square-root rotation formula:
 *
 *   P_θ = (√P₀ + θ/360)²
 *
 * for θ ∈ {45, 90, 135, 180, 225, 270, 315, 360}.
 *
 * Levels below the anchor price act as support; levels above act as resistance.
 */
export function computeSquareOfNineLevels(anchorPrice: number): SquareOfNineLevel[] {
  if (anchorPrice <= 0) return [];

  const sqrtBase = Math.sqrt(anchorPrice);
  const levels: SquareOfNineLevel[] = [];

  for (const angleDeg of SQUARE_OF_NINE_ANGLES) {
    const rotated = sqrtBase + angleDeg / 360;
    const price = Math.round(rotated * rotated * 100) / 100;
    levels.push({
      angleDeg,
      price,
      label: `${angleDeg}°`,
    });
  }

  return levels;
}

// ---------------------------------------------------------------------------
// 4. Angle Ray Calculator
// ---------------------------------------------------------------------------

/**
 * Computes Gann angle rays (2×1, 1×1, 1×2) projected forward from a pivot.
 *
 * Slope direction:
 * - Low pivot → rays project upward (bullish fan)
 * - High pivot → rays project downward (bearish fan, multiplier negated)
 *
 * @param pivot    - Swing anchor
 * @param scaleS   - Positive points-per-bar scale for the 1×1 line
 * @param lookForward - Number of bars to extend the ray
 */
export function computeAngleRays(
  pivot: GannPivot,
  scaleS: number,
  lookForward: number,
): GannAngleRay[] {
  if (scaleS <= 0 || lookForward <= 0) return [];

  const direction = pivot.polarity === 'low' ? 1 : -1;
  const toBarIndex = pivot.barIndex + lookForward;

  return ANGLE_RAY_DEFINITIONS.map(({ label, multiplier, color }) => {
    const slope = direction * multiplier * scaleS;
    const toPrice = pivot.price + slope * lookForward;
    return {
      label,
      slope,
      fromBarIndex: pivot.barIndex,
      fromPrice: pivot.price,
      toBarIndex,
      toPrice,
      color,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. Time Cycle Tracker
// ---------------------------------------------------------------------------

/**
 * Projects 45, 90, 180, and 360-bar time cycles from a pivot anchor.
 *
 * At each cycle boundary bar the function reads the candle OHLC and then
 * scans up to BREAKOUT_LOOKOUT_BARS (5) subsequent bars for:
 * - Bullish breakout: close above the cycle candle's high, with volume
 *   ≥ the 20-bar average volume preceding the cycle bar
 * - Bearish breakout: close below the cycle candle's low, same volume guard
 *
 * Bars beyond the available series are marked 'pending'.
 */
export function computeCycleSignals(
  bars: GannBar[],
  pivot: GannPivot,
): GannCycleSignal[] {
  const n = bars.length;
  const signals: GannCycleSignal[] = [];

  for (const interval of CYCLE_INTERVALS) {
    const cycleBarIndex = pivot.barIndex + interval;

    if (cycleBarIndex >= n) {
      // Cycle boundary is in the future
      signals.push({
        interval,
        anchorBarIndex: pivot.barIndex,
        cycleBarIndex,
        cycleHigh: 0,
        cycleLow: 0,
        breakoutStatus: 'pending',
        breakoutBarIndex: null,
      });
      continue;
    }

    const cycleBar = bars[cycleBarIndex];

    // Compute 20-bar average volume preceding the cycle bar
    const volStart = Math.max(0, cycleBarIndex - VOLUME_LOOKBACK_BARS);
    const volSlice = bars.slice(volStart, cycleBarIndex);
    const avgVolume =
      volSlice.length > 0
        ? volSlice.reduce((sum, b) => sum + b.volume, 0) / volSlice.length
        : 0;

    let breakoutStatus: GannBreakoutStatus = 'unconfirmed';
    let breakoutBarIndex: number | null = null;

    // Scan the subsequent 5 bars for confirmation
    const lookoutEnd = Math.min(n - 1, cycleBarIndex + BREAKOUT_LOOKOUT_BARS);
    for (let j = cycleBarIndex + 1; j <= lookoutEnd; j++) {
      const candidate = bars[j];
      const volumeOk = avgVolume <= 0 || candidate.volume >= avgVolume;

      if (volumeOk && candidate.close > cycleBar.high) {
        breakoutStatus = 'bullish';
        breakoutBarIndex = j;
        break;
      }
      if (volumeOk && candidate.close < cycleBar.low) {
        breakoutStatus = 'bearish';
        breakoutBarIndex = j;
        break;
      }
    }

    // If the lookout window hasn't fully elapsed (bars not yet in series), mark pending
    if (lookoutEnd < cycleBarIndex + BREAKOUT_LOOKOUT_BARS && breakoutStatus === 'unconfirmed') {
      breakoutStatus = 'pending';
    }

    signals.push({
      interval,
      anchorBarIndex: pivot.barIndex,
      cycleBarIndex,
      cycleHigh: cycleBar.high,
      cycleLow: cycleBar.low,
      breakoutStatus,
      breakoutBarIndex,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 6. Top-level Orchestrator
// ---------------------------------------------------------------------------

/**
 * Derives the canonical positive 1×1 price-time scale from two opposite
 * confirmed pivots. This matches the existing manual Gann Fan geometry:
 * price distance divided by bar distance defines the base slope.
 */
function computePivotPairScale(anchor: GannPivot, reference: GannPivot): number {
  if (anchor.polarity === reference.polarity) return 0;

  const barDistance = Math.abs(anchor.barIndex - reference.barIndex);
  const priceDistance = Math.abs(anchor.price - reference.price);
  if (barDistance <= 0 || !Number.isFinite(priceDistance)) return 0;

  return priceDistance / barDistance;
}

/**
 * Runs the full Gann Price-Time computation pipeline on the supplied bars.
 *
 * Returns `null` when preconditions are not met:
 * - Fewer than MIN_BARS_REQUIRED (360) bars
 * - No confirmed pivot could be detected
 * - Automatic geometry has no opposite-polarity pivot reference
 * - The derived pivot-pair price/time scale resolves to zero
 *
 * The most recently detected pivot (highest barIndex) is selected as the
 * primary anchor. Automatic 1×1 scale is derived from that anchor and the
 * most recent confirmed pivot of the opposite polarity. `fixedScale` remains
 * an explicit override and does not require an opposite pivot.
 */
export function computeGannSetup(
  bars: GannBar[],
  options: Partial<GannPluginOptions> = {},
): GannSetup | null {
  const opts: GannPluginOptions = { ...DEFAULT_GANN_OPTIONS, ...options };

  // Guard: minimum lookback
  if (bars.length < MIN_BARS_REQUIRED) return null;

  // Pivot detection
  const pivots = detectPivots(bars, opts.pivotWindowRadius);
  if (pivots.length === 0) return null;

  // Select the most recent pivot as the primary anchor.
  const pivot = pivots.reduce((best, p) => (p.barIndex > best.barIndex ? p : best));
  const scaleReference = pivots.find((candidate) => candidate.polarity !== pivot.polarity) ?? null;

  const scaleS =
    opts.fixedScale != null
      ? opts.fixedScale
      : scaleReference != null
        ? computePivotPairScale(pivot, scaleReference)
        : 0;

  if (scaleS <= 0) return null;

  // Projections
  const angleRays = computeAngleRays(pivot, scaleS, opts.rayLookForward);
  const squareOfNineLevels = computeSquareOfNineLevels(pivot.price);
  const cycleSignals = computeCycleSignals(bars, pivot);

  return {
    pivot,
    scaleS,
    angleRays,
    squareOfNineLevels,
    cycleSignals,
  };
}

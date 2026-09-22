/**
 * Gann Price-Time Engine — Unit Tests
 *
 * All tests use deterministic synthetic bar sequences.
 * No real market data or external dependencies are required.
 */

import { describe, expect, it } from 'vitest';
import {
  computeATR,
  computeAngleRays,
  computeCycleSignals,
  computeGannSetup,
  computeSquareOfNineLevels,
  DEFAULT_GANN_OPTIONS,
  detectPivots,
} from '../engine';
import type { GannBar, GannPivot } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a flat bar sequence with configurable high/low/close per bar. */
function makeBar(
  index: number,
  overrides: Partial<Omit<GannBar, 'date' | 'timestamp'>> = {},
): GannBar {
  const base = 100 + index * 0.1;
  return {
    date: `2024-01-${String(index + 1).padStart(2, '0')}`,
    timestamp: 1704067200000 + index * 86400000,
    open: base,
    high: overrides.high ?? base + 2,
    low: overrides.low ?? base - 2,
    close: overrides.close ?? base,
    volume: overrides.volume ?? 100_000,
  };
}

/** Build a flat series of `count` bars (all ranges equal, easy ATR). */
function makeFlatBars(count: number, highLowSpread = 2): GannBar[] {
  return Array.from({ length: count }, (_, i) =>
    makeBar(i, { high: 100 + highLowSpread, low: 100 - highLowSpread, close: 100 }),
  );
}

/** Build a bar series with exactly `count` bars meeting minimum lookback.
 *  Uses a sinusoidal base price so real swing highs/lows exist for pivot detection. */
function makeMinBars(count = 400): GannBar[] {
  return Array.from({ length: count }, (_, i) => {
    // Period ≈ 126 bars → ~3 full cycles in 400 bars → several clear pivots
    const base = 100 + Math.sin(i / 20) * 15;
    return makeBar(i, { high: base + 2, low: base - 2, close: base });
  });
}

// ---------------------------------------------------------------------------
// 1. computeATR
// ---------------------------------------------------------------------------

describe('computeATR', () => {
  it('returns 0 when fewer than 2 bars are provided', () => {
    expect(computeATR([], 14)).toBe(0);
    expect(computeATR([makeBar(0)], 14)).toBe(0);
  });

  it('computes the correct ATR for a flat bar series', () => {
    // All bars have high=104, low=96, close=100 → TR = max(8, |4|, |4|) = 8 for every bar
    const bars = makeFlatBars(20, 4);
    const atr = computeATR(bars, 14);
    // Each TR = high - low = 8 (first bar has no prev, so TR starts at bar index 1)
    expect(atr).toBeCloseTo(8, 5);
  });

  it('uses only the last `period` true ranges', () => {
    // Build 30 bars. First 15 have spread 2, next 15 have spread 10.
    const bars: GannBar[] = [
      ...Array.from({ length: 15 }, (_, i) =>
        makeBar(i, { high: 102, low: 98, close: 100 }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeBar(15 + i, { high: 110, low: 90, close: 100 }),
      ),
    ];
    // ATR(14) uses the last 14 TRs → all from the high-spread region ≈ 20
    const atr = computeATR(bars, 14);
    expect(atr).toBeCloseTo(20, 0);
  });
});

// ---------------------------------------------------------------------------
// 2. detectPivots
// ---------------------------------------------------------------------------

describe('detectPivots', () => {
  it('returns an empty array when the series is too short for the window', () => {
    const bars = makeFlatBars(10);
    const pivots = detectPivots(bars, 8); // requires at least 17 bars
    expect(pivots).toHaveLength(0);
  });

  it('detects a swing high and swing low in a synthetic V-shape', () => {
    // Build: descend for 15 bars, then ascend for 15 bars → swing low at index 15
    const bars: GannBar[] = [];
    for (let i = 0; i < 15; i++) {
      bars.push(makeBar(i, { high: 200 - i * 2 + 1, low: 200 - i * 2 - 1, close: 200 - i * 2 }));
    }
    // Add the bottom
    bars.push(makeBar(15, { high: 171, low: 169, close: 170 }));
    for (let i = 1; i <= 14; i++) {
      bars.push(makeBar(15 + i, { high: 170 + i * 2 + 1, low: 170 + i * 2 - 1, close: 170 + i * 2 }));
    }

    const pivots = detectPivots(bars, 5);
    const lowPivot = pivots.find((p) => p.polarity === 'low');
    expect(lowPivot).toBeDefined();
    expect(lowPivot?.barIndex).toBe(15);
    expect(lowPivot?.price).toBe(169);
  });

  it('selects the most recent high and low pivot', () => {
    // 50-bar series with a clear peak at bar 10, trough at bar 35
    const bars: GannBar[] = Array.from({ length: 50 }, (_, i) => {
      const high = i === 10 ? 200 : 100;
      const low = i === 35 ? 50 : 100;
      return makeBar(i, { high, low, close: 100 });
    });

    const pivots = detectPivots(bars, 4);
    const highPivot = pivots.find((p) => p.polarity === 'high');
    const lowPivot = pivots.find((p) => p.polarity === 'low');
    expect(highPivot?.barIndex).toBe(10);
    expect(lowPivot?.barIndex).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// 3. computeSquareOfNineLevels
// ---------------------------------------------------------------------------

describe('computeSquareOfNineLevels', () => {
  it('returns exactly 8 levels', () => {
    const levels = computeSquareOfNineLevels(100);
    expect(levels).toHaveLength(8);
  });

  it('returns an empty array for non-positive anchor price', () => {
    expect(computeSquareOfNineLevels(0)).toHaveLength(0);
    expect(computeSquareOfNineLevels(-10)).toHaveLength(0);
  });

  it('all prices are above the anchor price (the formula adds to √P₀)', () => {
    const anchor = 100;
    const levels = computeSquareOfNineLevels(anchor);
    for (const level of levels) {
      expect(level.price).toBeGreaterThan(anchor);
    }
  });

  it('prices are strictly increasing with angle', () => {
    const levels = computeSquareOfNineLevels(100);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].price).toBeGreaterThan(levels[i - 1].price);
    }
  });

  it('360° level is the full square rotation: (√P + 1)²', () => {
    const anchor = 144; // sqrt = 12, so 360° = (12+1)² = 169
    const levels = computeSquareOfNineLevels(anchor);
    const deg360 = levels.find((l) => l.angleDeg === 360);
    expect(deg360?.price).toBeCloseTo(169, 1);
  });

  it('labels match the angle', () => {
    const levels = computeSquareOfNineLevels(100);
    expect(levels[0].label).toBe('45°');
    expect(levels[7].label).toBe('360°');
  });
});

// ---------------------------------------------------------------------------
// 4. computeAngleRays
// ---------------------------------------------------------------------------

describe('computeAngleRays', () => {
  const lowPivot: GannPivot = {
    barIndex: 10,
    date: '2024-01-11',
    price: 100,
    polarity: 'low',
  };

  it('returns 3 rays for a valid pivot', () => {
    const rays = computeAngleRays(lowPivot, 2, 50);
    expect(rays).toHaveLength(3);
  });

  it('returns empty array when scaleS is 0', () => {
    expect(computeAngleRays(lowPivot, 0, 50)).toHaveLength(0);
  });

  it('2×1 ray rises twice as fast as 1×1 from a low pivot', () => {
    const rays = computeAngleRays(lowPivot, 2, 100);
    const ray2x1 = rays.find((r) => r.label === '2×1')!;
    const ray1x1 = rays.find((r) => r.label === '1×1')!;
    const rise2x1 = ray2x1.toPrice - ray2x1.fromPrice;
    const rise1x1 = ray1x1.toPrice - ray1x1.fromPrice;
    expect(rise2x1).toBeCloseTo(rise1x1 * 2, 5);
  });

  it('1×2 ray rises half as fast as 1×1 from a low pivot', () => {
    const rays = computeAngleRays(lowPivot, 2, 100);
    const ray1x2 = rays.find((r) => r.label === '1×2')!;
    const ray1x1 = rays.find((r) => r.label === '1×1')!;
    const rise1x2 = ray1x2.toPrice - ray1x2.fromPrice;
    const rise1x1 = ray1x1.toPrice - ray1x1.fromPrice;
    expect(rise1x2).toBeCloseTo(rise1x1 * 0.5, 5);
  });

  it('rays project downward from a high pivot', () => {
    const highPivot: GannPivot = { ...lowPivot, polarity: 'high', price: 200 };
    const rays = computeAngleRays(highPivot, 2, 50);
    for (const ray of rays) {
      expect(ray.toPrice).toBeLessThan(ray.fromPrice);
    }
  });

  it('toBarIndex = fromBarIndex + lookForward', () => {
    const rays = computeAngleRays(lowPivot, 2, 75);
    for (const ray of rays) {
      expect(ray.toBarIndex).toBe(lowPivot.barIndex + 75);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. computeCycleSignals
// ---------------------------------------------------------------------------

describe('computeCycleSignals', () => {
  it('returns 4 signals (one per interval)', () => {
    const bars = makeFlatBars(500);
    const pivot: GannPivot = { barIndex: 50, date: bars[50].date, price: 100, polarity: 'low' };
    const signals = computeCycleSignals(bars, pivot);
    expect(signals).toHaveLength(4);
    expect(signals.map((s) => s.interval)).toEqual([45, 90, 180, 360]);
  });

  it('marks cycles beyond available bars as pending', () => {
    const bars = makeFlatBars(200);
    // Pivot at bar 50: 360-bar cycle = bar 410, which is beyond 200 bars
    const pivot: GannPivot = { barIndex: 50, date: bars[50].date, price: 100, polarity: 'low' };
    const signals = computeCycleSignals(bars, pivot);
    const signal360 = signals.find((s) => s.interval === 360)!;
    expect(signal360.breakoutStatus).toBe('pending');
    expect(signal360.cycleBarIndex).toBe(410);
  });

  it('detects a bullish breakout when close exceeds the cycle candle high', () => {
    // Build a 200-bar series. Set bar 95 (cycle boundary for 45-bar from pivot 50)
    // to have a well-defined high. Set bar 96 to close above that high with high volume.
    const bars = makeFlatBars(200);
    const pivot: GannPivot = { barIndex: 50, date: bars[50].date, price: 100, polarity: 'low' };

    const cycleIdx = 95; // pivot(50) + 45
    bars[cycleIdx] = makeBar(cycleIdx, { high: 115, low: 95, close: 110, volume: 50_000 });
    bars[cycleIdx + 1] = makeBar(cycleIdx + 1, { high: 120, low: 110, close: 118, volume: 200_000 });

    const signals = computeCycleSignals(bars, pivot);
    const signal45 = signals.find((s) => s.interval === 45)!;
    expect(signal45.breakoutStatus).toBe('bullish');
    expect(signal45.breakoutBarIndex).toBe(cycleIdx + 1);
  });

  it('detects a bearish breakout when close falls below the cycle candle low', () => {
    const bars = makeFlatBars(200);
    const pivot: GannPivot = { barIndex: 50, date: bars[50].date, price: 100, polarity: 'high' };

    const cycleIdx = 95;
    bars[cycleIdx] = makeBar(cycleIdx, { high: 110, low: 90, close: 95, volume: 50_000 });
    bars[cycleIdx + 1] = makeBar(cycleIdx + 1, { high: 92, low: 82, close: 85, volume: 200_000 });

    const signals = computeCycleSignals(bars, pivot);
    const signal45 = signals.find((s) => s.interval === 45)!;
    expect(signal45.breakoutStatus).toBe('bearish');
    expect(signal45.breakoutBarIndex).toBe(cycleIdx + 1);
  });

  it('marks as unconfirmed when no breakout occurs within the lookout window', () => {
    const bars = makeFlatBars(200);
    const pivot: GannPivot = { barIndex: 0, date: bars[0].date, price: 100, polarity: 'low' };
    // Bar 45 and the next 5 bars all have closes within the cycle candle range (no breakout)
    const cycleIdx = 45;
    bars[cycleIdx] = makeBar(cycleIdx, { high: 105, low: 95, close: 100, volume: 50_000 });
    for (let i = 1; i <= 5; i++) {
      bars[cycleIdx + i] = makeBar(cycleIdx + i, { high: 103, low: 97, close: 100, volume: 80_000 });
    }

    const signals = computeCycleSignals(bars, pivot);
    const signal45 = signals.find((s) => s.interval === 45)!;
    expect(signal45.breakoutStatus).toBe('unconfirmed');
    expect(signal45.breakoutBarIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. computeGannSetup — orchestrator
// ---------------------------------------------------------------------------

describe('computeGannSetup', () => {
  it('returns null when fewer than 360 bars are provided', () => {
    const bars = makeFlatBars(359);
    expect(computeGannSetup(bars)).toBeNull();
  });

  it('returns a valid setup for a sufficient series', () => {
    const bars = makeMinBars(400);
    const setup = computeGannSetup(bars);
    expect(setup).not.toBeNull();
    expect(setup?.pivot).toBeDefined();
    expect(setup?.angleRays.length).toBeGreaterThan(0);
    expect(setup?.squareOfNineLevels).toHaveLength(8);
    expect(setup?.cycleSignals).toHaveLength(4);
  });

  it('honours fixedScale override — scaleS matches provided value', () => {
    const bars = makeMinBars(400);
    const setup = computeGannSetup(bars, { fixedScale: 7.5 });
    expect(setup?.scaleS).toBe(7.5);
  });

  it('uses default options when no overrides are provided', () => {
    const bars = makeMinBars(400);
    const setup = computeGannSetup(bars);
    // Automatic pivot-pair scale should be positive when both pivot polarities exist.
    expect(setup?.scaleS).toBeGreaterThan(0);
  });

  it('derives automatic 1×1 scale from the latest opposite-polarity pivot pair instead of ATR', () => {
    const bars = makeFlatBars(400);
    bars[300] = makeBar(300, { high: 102, low: 80, close: 100 });
    bars[330] = makeBar(330, { high: 130, low: 98, close: 100 });

    const setup = computeGannSetup(bars, { pivotWindowRadius: 4 });

    expect(setup).not.toBeNull();
    expect(setup?.pivot.polarity).toBe('high');
    expect(setup?.pivot.barIndex).toBe(330);
    expect(setup?.scaleS).toBeCloseTo((130 - 80) / (330 - 300), 8);
    expect(setup?.scaleS).not.toBeCloseTo(computeATR(bars, DEFAULT_GANN_OPTIONS.atrPeriod), 8);
    expect(setup?.angleRays.find((ray) => ray.label === '1×1')?.slope).toBeCloseTo(-((130 - 80) / 30), 8);
  });

  it('fails closed when automatic scaling has no opposite-polarity pivot reference', () => {
    const bars = makeFlatBars(400);
    bars[330] = makeBar(330, { high: 130, low: 98, close: 100 });

    expect(computeGannSetup(bars, { pivotWindowRadius: 4 })).toBeNull();
  });

  it('preserves explicit fixedScale override even when only one pivot polarity exists', () => {
    const bars = makeFlatBars(400);
    bars[330] = makeBar(330, { high: 130, low: 98, close: 100 });

    const setup = computeGannSetup(bars, { pivotWindowRadius: 4, fixedScale: 7.5 });
    expect(setup).not.toBeNull();
    expect(setup?.scaleS).toBe(7.5);
  });

  it('pivot is the most recent detected pivot (highest barIndex)', () => {
    // Use a series long enough to generate multiple pivots
    const bars = makeMinBars(400);
    // The engine should always return the one with the highest barIndex
    const setup = computeGannSetup(bars, { pivotWindowRadius: DEFAULT_GANN_OPTIONS.pivotWindowRadius });
    if (!setup) return; // guard for environments with no pivot
    const allPivots = detectPivots(bars, DEFAULT_GANN_OPTIONS.pivotWindowRadius);
    const expectedPivot = allPivots.reduce((best, p) => (p.barIndex > best.barIndex ? p : best));
    expect(setup.pivot.barIndex).toBe(expectedPivot.barIndex);
  });
});

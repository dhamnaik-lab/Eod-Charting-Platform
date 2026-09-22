import { describe, expect, it } from 'vitest';
import { buildRenderableIndicator, buildRenderableIndicators } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';

describe('Supertrend (SUPERTREND) Indicator Engine', () => {
  // Helper to generate a trending price sequence
  function createTrendingBars(): OHLCBar[] {
    const bars: OHLCBar[] = [];
    let price = 100;

    // Upward trend: bars 0..14 (price goes 100 -> 170)
    for (let i = 0; i < 15; i++) {
      const open = price;
      const high = price + 6;
      const low = price - 2;
      const close = price + 5;
      price = close;
      bars.push({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        timestamp: (i + 1) * 86400,
        open,
        high,
        low,
        close,
        volume: 1000 + i * 100,
      });
    }

    // Downward trend: bars 15..25 (sharp drop to trigger reversal)
    for (let i = 15; i < 25; i++) {
      const open = price;
      const high = price + 1;
      const low = price - 12;
      const close = price - 10;
      price = close;
      bars.push({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        timestamp: (i + 1) * 86400,
        open,
        high,
        low,
        close,
        volume: 2000 + i * 100,
      });
    }

    return bars;
  }

  const sampleBars = createTrendingBars();
  const sources = {
    highs: sampleBars.map((b) => b.high),
    lows: sampleBars.map((b) => b.low),
    closes: sampleBars.map((b) => b.close),
    volumes: sampleBars.map((b) => b.volume),
  };

  it('calculates standard Supertrend (10, 3) and correctly pads warmup nulls', () => {
    const indicator: OverlayIndicator = {
      id: 'supertrend-1',
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 10,
      multiplier: 3,
      upColor: '#22c55e',
      downColor: '#ef4444',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(1);

    const line = renderable!.lines[0];
    expect(line.key).toBe('st');
    expect(line.label).toBe('Supertrend');
    expect(line.values).toHaveLength(sampleBars.length);

    // Warmup: indices 0..9 should be null
    for (let i = 0; i < 10; i++) {
      expect(line.values[i]).toBeNull();
    }
    // Bar index 10 should have a valid numerical value
    expect(typeof line.values[10]).toBe('number');
  });

  it('enforces non-decreasing trailing lower band in a sustained uptrend', () => {
    const indicator: OverlayIndicator = {
      id: 'supertrend-uptrend',
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 5,
      multiplier: 2,
      upColor: '#22c55e',
      downColor: '#ef4444',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    const line = renderable!.lines[0];

    // Check uptrend section (bars 5..14): lower band should never decrease
    let prevVal: number | null = null;
    for (let i = 5; i < 15; i++) {
      const val = line.values[i];
      if (val !== null) {
        if (prevVal !== null) {
          expect(val).toBeGreaterThanOrEqual(prevVal);
        }
        prevVal = val;
      }
    }
  });

  it('switches from uptrend (upColor) to downtrend (downColor) on sharp decline', () => {
    const indicator: OverlayIndicator = {
      id: 'supertrend-flip',
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 5,
      multiplier: 2,
      upColor: '#22c55e',
      downColor: '#ef4444',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    const line = renderable!.lines[0];
    const colorValues = line.colorValues;
    expect(colorValues).toBeDefined();

    // Bar 10 is strongly in uptrend
    expect(colorValues![10]).toBe('#22c55e');

    // Bar 20 is strongly in downtrend
    expect(colorValues![20]).toBe('#ef4444');
  });

  it('handles edge cases safely (empty bars, bars < period, invalid inputs)', () => {
    const indicator: OverlayIndicator = {
      id: 'supertrend-edge',
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 10,
      multiplier: 3,
      upColor: '#22c55e',
      downColor: '#ef4444',
    };

    // Empty bars
    const emptyResult = buildRenderableIndicator([], indicator, { highs: [], lows: [], closes: [], volumes: [] });
    expect(emptyResult).toBeNull();

    // Fewer bars than period
    const shortBars = sampleBars.slice(0, 5);
    const shortSources = {
      highs: shortBars.map((b) => b.high),
      lows: shortBars.map((b) => b.low),
      closes: shortBars.map((b) => b.close),
      volumes: shortBars.map((b) => b.volume),
    };
    const shortResult = buildRenderableIndicator(shortBars, indicator, shortSources);
    expect(shortResult).not.toBeNull();
    expect(shortResult?.lines[0].values).toEqual([null, null, null, null, null]);
  });

  it('integrates properly into buildRenderableIndicators bundle with placement as overlay', () => {
    const indicator: OverlayIndicator = {
      id: 'supertrend-bundle',
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 10,
      multiplier: 3,
      upColor: '#22c55e',
      downColor: '#ef4444',
    };

    const bundle = buildRenderableIndicators(sampleBars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.panes).toHaveLength(0);
    expect(bundle.overlays[0].indicator.kind).toBe('SUPERTREND');
  });
});

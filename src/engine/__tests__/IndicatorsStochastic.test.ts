import { describe, expect, it } from 'vitest';
import { buildRenderableIndicator, buildRenderableIndicators } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';

const sampleBars: OHLCBar[] = [
  { date: '2026-01-01', timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
  { date: '2026-01-02', timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1500 },
  { date: '2026-01-03', timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 2000 },
  { date: '2026-01-04', timestamp: 4, open: 115, high: 125, low: 105, close: 120, volume: 2500 },
  { date: '2026-01-05', timestamp: 5, open: 120, high: 130, low: 110, close: 125, volume: 3000 },
  { date: '2026-01-06', timestamp: 6, open: 125, high: 135, low: 115, close: 130, volume: 3500 },
  { date: '2026-01-07', timestamp: 7, open: 130, high: 140, low: 120, close: 135, volume: 4000 },
  { date: '2026-01-08', timestamp: 8, open: 135, high: 145, low: 125, close: 140, volume: 4500 },
  { date: '2026-01-09', timestamp: 9, open: 140, high: 150, low: 130, close: 145, volume: 5000 },
  { date: '2026-01-10', timestamp: 10, open: 145, high: 155, low: 135, close: 150, volume: 5500 },
];

const sources = {
  highs: sampleBars.map((b) => b.high),
  lows: sampleBars.map((b) => b.low),
  closes: sampleBars.map((b) => b.close),
  volumes: sampleBars.map((b) => b.volume),
};

describe('Stochastic Oscillator (STOCH) Calculation Engine', () => {
  it('calculates Full/Slow Stochastic (5, 3, 3) with %K and %D smoothing', () => {
    const indicator: OverlayIndicator = {
      id: 'stoch-default-5-3-3',
      kind: 'STOCH',
      placement: 'pane',
      period: 5,
      smoothK: 3,
      signalPeriod: 3,
      color: '#7bd389',
      signalColor: '#ff9f1c',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(2);
    expect(renderable?.lines[0].key).toBe('stoch-k');
    expect(renderable?.lines[0].label).toBe('%K');
    expect(renderable?.lines[1].key).toBe('stoch-d');
    expect(renderable?.lines[1].label).toBe('%D');

    // Values should be padded to sampleBars length
    expect(renderable?.lines[0].values).toHaveLength(sampleBars.length);
    expect(renderable?.lines[1].values).toHaveLength(sampleBars.length);

    // Initial bars before period + smoothK - 1 should be null
    // period = 5 (indices 0..3 null, bar 4 is first raw value)
    // smoothK = 3 (bar 4, 5, 6 -> bar 6 is first smoothed %K value)
    expect(renderable?.lines[0].values[0]).toBeNull();
    expect(renderable?.lines[0].values[3]).toBeNull();
    expect(renderable?.lines[0].values[6]).not.toBeNull();

    // %D (signalPeriod = 3) smoothed over %K (bar 6, 7, 8 -> bar 8 is first smoothed %D value)
    expect(renderable?.lines[1].values[6]).toBeNull();
    expect(renderable?.lines[1].values[8]).not.toBeNull();
  });

  it('calculates Fast Stochastic when smoothK = 1', () => {
    const indicator: OverlayIndicator = {
      id: 'stoch-fast-5-1-3',
      kind: 'STOCH',
      placement: 'pane',
      period: 5,
      smoothK: 1,
      signalPeriod: 3,
      color: '#7bd389',
      signalColor: '#ff9f1c',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();

    // With smoothK = 1, bar index 4 (5th bar) has the first Raw %K value
    expect(renderable?.lines[0].values[3]).toBeNull();
    expect(renderable?.lines[0].values[4]).not.toBeNull();

    // Check Raw %K calculation on bar 4 (lookback 5: bars 0..4, high=130, low=90, close=125)
    // %K = (125 - 90) / (130 - 90) * 100 = 35 / 40 * 100 = 87.5
    expect(renderable?.lines[0].values[4]).toBeCloseTo(87.5, 2);
  });

  it('handles flat prices (H === L) gracefully without NaN or divide-by-zero', () => {
    const flatBars: OHLCBar[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      timestamp: i + 1,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }));

    const flatSources = {
      highs: flatBars.map((b) => b.high),
      lows: flatBars.map((b) => b.low),
      closes: flatBars.map((b) => b.close),
      volumes: flatBars.map((b) => b.volume),
    };

    const indicator: OverlayIndicator = {
      id: 'stoch-flat',
      kind: 'STOCH',
      placement: 'pane',
      period: 5,
      smoothK: 3,
      signalPeriod: 3,
      color: '#7bd389',
      signalColor: '#ff9f1c',
    };

    const renderable = buildRenderableIndicator(flatBars, indicator, flatSources);
    expect(renderable).not.toBeNull();
    const kVal = renderable?.lines[0].values[9];
    const dVal = renderable?.lines[1].values[9];
    expect(kVal).toBe(50);
    expect(dVal).toBe(50);
  });

  it('works within buildRenderableIndicators bundle and includes standard reference levels and range', () => {
    const indicator: OverlayIndicator = {
      id: 'stoch-bundle',
      kind: 'STOCH',
      placement: 'pane',
      period: 5,
      smoothK: 3,
      signalPeriod: 3,
      color: '#7bd389',
      signalColor: '#ff9f1c',
    };

    const bundle = buildRenderableIndicators(sampleBars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    const pane = bundle.panes[0];
    expect(pane.fixedRange).toEqual({ min: 0, max: 100 });
    expect(pane.referenceLines).toEqual([
      { key: 'oversold', id: 'oversold', label: 'Oversold', value: 20 },
      { key: 'overbought', id: 'overbought', label: 'Overbought', value: 80 },
    ]);
  });
});

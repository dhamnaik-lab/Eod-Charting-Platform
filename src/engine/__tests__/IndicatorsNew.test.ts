import { describe, expect, it } from 'vitest';
import { buildRenderableIndicator } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';

const sampleBars: OHLCBar[] = [
  { date: '2026-01-01', timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
  { date: '2026-01-02', timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1500 },
  { date: '2026-01-03', timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 2000 },
  { date: '2026-01-04', timestamp: 4, open: 115, high: 125, low: 105, close: 120, volume: 2500 },
  { date: '2026-01-05', timestamp: 5, open: 120, high: 130, low: 110, close: 125, volume: 3000 },
];

const sources = {
  highs: sampleBars.map((b) => b.high),
  lows: sampleBars.map((b) => b.low),
  closes: sampleBars.map((b) => b.close),
  volumes: sampleBars.map((b) => b.volume),
};

describe('New Indicators (CPR, StochRSI, AVWAP)', () => {
  it('calculates CPR lines correctly', () => {
    const indicator: OverlayIndicator = {
      id: 'cpr-1',
      kind: 'CPR',
      placement: 'overlay',
      pivotColor: '#00b4d8',
      tcColor: '#26a69a',
      bcColor: '#ef5350',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(3);
    expect(renderable?.lines[0].label).toBe('Pivot');
    expect(renderable?.lines[1].label).toBe('TC');
    expect(renderable?.lines[2].label).toBe('BC');

    const expectedPivotBar1 = (110 + 90 + 105) / 3;
    expect(renderable?.lines[0].values[1]).toBeCloseTo(expectedPivotBar1, 4);
  });

  it('calculates Anchored VWAP correctly from anchor bar', () => {
    const indicator: OverlayIndicator = {
      id: 'avwap-1',
      kind: 'AVWAP',
      placement: 'overlay',
      anchorIndex: 2,
      color: '#f9d423',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(1);
    expect(renderable?.lines[0].values[0]).toBeNull();
    expect(renderable?.lines[0].values[1]).toBeNull();
    expect(renderable?.lines[0].values[2]).not.toBeNull();
  });

  it('calculates Stochastic RSI lines correctly', () => {
    const indicator: OverlayIndicator = {
      id: 'stochrsi-1',
      kind: 'STOCHRSI',
      placement: 'pane',
      rsiPeriod: 2,
      stochPeriod: 2,
      kPeriod: 2,
      dPeriod: 2,
      color: '#00d2ff',
      signalColor: '#ff9f43',
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(2);
    expect(renderable?.lines[0].label).toBe('%K');
    expect(renderable?.lines[1].label).toBe('%D');
  });
});

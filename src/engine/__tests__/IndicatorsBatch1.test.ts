import { describe, expect, it } from 'vitest';
import { buildRenderableIndicator, buildRenderableIndicators } from '../Indicators';
import { calculateLSMA } from '@/indicators/standard/moving-averages/lsma';
import { calculateVWMA } from '@/indicators/standard/moving-averages/vwma';
import { calculateMcGinley } from '@/indicators/standard/moving-averages/mcginley-dynamic';
import { calculateSMMA } from '@/indicators/standard/trend/alligator';
import type { OHLCBar, OverlayIndicator } from '../types';

const sampleBars: OHLCBar[] = [
  { timestamp: 1, date: '2026-01-01', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
  { timestamp: 2, date: '2026-01-02', open: 102, high: 108, low: 100, close: 106, volume: 1500 },
  { timestamp: 3, date: '2026-01-03', open: 106, high: 110, low: 104, close: 108, volume: 1200 },
  { timestamp: 4, date: '2026-01-04', open: 108, high: 112, low: 105, close: 110, volume: 2000 },
  { timestamp: 5, date: '2026-01-05', open: 110, high: 115, low: 109, close: 114, volume: 2500 },
  { timestamp: 6, date: '2026-01-06', open: 114, high: 118, low: 112, close: 116, volume: 1800 },
  { timestamp: 7, date: '2026-01-07', open: 116, high: 120, low: 115, close: 119, volume: 3000 },
  { timestamp: 8, date: '2026-01-08', open: 119, high: 122, low: 117, close: 121, volume: 2200 },
  { timestamp: 9, date: '2026-01-09', open: 121, high: 125, low: 119, close: 123, volume: 2800 },
  { timestamp: 10, date: '2026-01-10', open: 123, high: 126, low: 120, close: 125, volume: 3200 },
  { timestamp: 11, date: '2026-01-11', open: 125, high: 124, low: 118, close: 120, volume: 1500 },
  { timestamp: 12, date: '2026-01-12', open: 120, high: 121, low: 115, close: 116, volume: 2000 },
  { timestamp: 13, date: '2026-01-13', open: 116, high: 118, low: 110, close: 112, volume: 2500 },
  { timestamp: 14, date: '2026-01-14', open: 112, high: 114, low: 108, close: 110, volume: 3000 },
];

describe('Batch 1 Standard Indicators (LSMA, VWMA, McGinley, Alligator, MA Cross, MA Ribbon)', () => {
  it('calculates LSMA linear regression correctly', () => {
    const closes = sampleBars.map((b) => b.close);
    const lsma = calculateLSMA(closes, 5, 0);

    expect(lsma[0]).toBeNull();
    expect(lsma[3]).toBeNull();
    expect(typeof lsma[4]).toBe('number');
    expect(lsma[4]).toBeCloseTo(114, 0);
  });

  it('calculates VWMA volume-weighted average correctly', () => {
    const closes = sampleBars.map((b) => b.close);
    const volumes = sampleBars.map((b) => b.volume);
    const vwma = calculateVWMA(closes, volumes, 5);

    expect(vwma[0]).toBeNull();
    expect(typeof vwma[4]).toBe('number');
    expect(vwma[4]!).toBeGreaterThan(102);
    expect(vwma[4]!).toBeLessThan(115);
  });

  it('calculates McGinley Dynamic correctly', () => {
    const closes = sampleBars.map((b) => b.close);
    const md = calculateMcGinley(closes, 14, 0.6);

    expect(md[0]).toBe(closes[0]);
    expect(typeof md[5]).toBe('number');
    expect(md[5]!).toBeGreaterThan(100);
  });

  it('calculates Williams Alligator with 3 offset lines', () => {
    const indicator: OverlayIndicator = {
      id: 'test-alligator',
      kind: 'ALLIGATOR',
      placement: 'overlay',
      jawPeriod: 5,
      jawOffset: 3,
      teethPeriod: 3,
      teethOffset: 2,
      lipsPeriod: 2,
      lipsOffset: 1,
      jawColor: '#2962FF',
      teethColor: '#E91E63',
      lipsColor: '#66BB6A',
    };

    const sources = {
      highs: sampleBars.map((b) => b.high),
      lows: sampleBars.map((b) => b.low),
      closes: sampleBars.map((b) => b.close),
      volumes: sampleBars.map((b) => b.volume),
    };

    const renderable = buildRenderableIndicator(sampleBars, indicator, sources);
    expect(renderable).not.toBeNull();
    expect(renderable?.lines).toHaveLength(3);
    expect(renderable?.lines.map((l) => l.key)).toEqual(['jaw', 'teeth', 'lips']);
  });

  it('detects MA Cross signals correctly', () => {
    const indicator: OverlayIndicator = {
      id: 'test-ma-cross',
      kind: 'MA_CROSS',
      placement: 'overlay',
      fastPeriod: 3,
      slowPeriod: 6,
      fastColor: '#FF6D00',
      slowColor: '#43A047',
      crossColor: '#2962FF',
      maType: 'SMA',
    };

    const bundle = buildRenderableIndicators(sampleBars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const overlay = bundle.overlays[0];
    expect(overlay.lines).toHaveLength(2);
    expect(overlay.markers).toBeDefined();
    expect(overlay.markers!.length).toBeGreaterThan(0);
  });

  it('builds MA Ribbon with 4 lines', () => {
    const indicator: OverlayIndicator = {
      id: 'test-ma-ribbon',
      kind: 'MA_RIBBON',
      placement: 'overlay',
      period1: 2,
      period2: 4,
      period3: 6,
      period4: 8,
      color1: '#f6c309',
      color2: '#fb9800',
      color3: '#fb6500',
      color4: '#f60c0c',
      maType: 'SMA',
    };

    const bundle = buildRenderableIndicators(sampleBars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(4);
  });
});

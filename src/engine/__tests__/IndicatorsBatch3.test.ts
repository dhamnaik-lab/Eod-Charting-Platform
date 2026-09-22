import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '../Indicators';
import { calculateEnvelope } from '@/indicators/standard/volatility/envelope';
import { calculateHV } from '@/indicators/standard/volatility/historical-volatility';
import { calculateStDev } from '@/indicators/standard/volatility/standard-deviation';
import { calculateRelativeVolatilityIndex } from '@/indicators/standard/volatility/relative-volatility-index';
import { calculateChandeKrollStop } from '@/indicators/standard/volatility/chande-kroll-stop';
import { calculateVolatilityStop } from '@/indicators/standard/volatility/volatility-stop';
import { calculateUlcerIndex } from '@/indicators/standard/volatility/ulcer-index';
import { calculateChoppiness } from '@/indicators/standard/volatility/choppiness';
import { calculateChopZone } from '@/indicators/standard/volatility/chop-zone';
import { calculateBBTrend } from '@/indicators/standard/volatility/bbtrend';
import type { OHLCBar, OverlayIndicator } from '../types';

const sampleBars: OHLCBar[] = Array.from({ length: 60 }, (_, i) => ({
  timestamp: i + 1,
  date: `2026-01-${String(i + 1).padStart(2, '0')}`,
  open: 100 + Math.sin(i / 3) * 10,
  high: 105 + Math.sin(i / 3) * 10,
  low: 95 + Math.sin(i / 3) * 10,
  close: 102 + Math.sin((i + 1) / 3) * 10,
  volume: 1000 + (i % 5) * 200,
}));

describe('Batch 3 Volatility, Bands & Trailing Stops', () => {
  it('calculates Envelope with upper/lower percentage bands', () => {
    const closes = sampleBars.map((b) => b.close);
    const { basis, upper, lower } = calculateEnvelope(closes, 10, 5, false);

    expect(typeof basis[15]).toBe('number');
    expect(typeof upper[15]).toBe('number');
    expect(typeof lower[15]).toBe('number');
    expect(upper[15]!).toBeGreaterThan(basis[15]!);
    expect(lower[15]!).toBeLessThan(basis[15]!);
  });

  it('calculates Historical Volatility (HV)', () => {
    const closes = sampleBars.map((b) => b.close);
    const hv = calculateHV(closes, 10, 365);
    expect(typeof hv[15]).toBe('number');
    expect(hv[15]!).toBeGreaterThan(0);
  });

  it('calculates Standard Deviation (StDev)', () => {
    const closes = sampleBars.map((b) => b.close);
    const stdev = calculateStDev(closes, 10);
    expect(typeof stdev[15]).toBe('number');
    expect(stdev[15]!).toBeGreaterThan(0);
  });

  it('calculates Relative Volatility Index (RVI_VOL)', () => {
    const closes = sampleBars.map((b) => b.close);
    const { rvi, signal } = calculateRelativeVolatilityIndex(closes, 10, 5);
    expect(typeof rvi[25]).toBe('number');
    expect(rvi[25]!).toBeGreaterThanOrEqual(0);
    expect(rvi[25]!).toBeLessThanOrEqual(100);
  });

  it('calculates Chande Kroll Stop', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const { stopLong, stopShort } = calculateChandeKrollStop(highs, lows, closes, 10, 1, 9);

    expect(typeof stopLong[25]).toBe('number');
    expect(typeof stopShort[25]).toBe('number');
  });

  it('calculates Volatility Stop', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const { longStop, shortStop } = calculateVolatilityStop(highs, lows, closes, 10, 2.0);

    const hasStop = longStop.some((v) => v !== null) || shortStop.some((v) => v !== null);
    expect(hasStop).toBe(true);
  });

  it('calculates Ulcer Index', () => {
    const closes = sampleBars.map((b) => b.close);
    const ui = calculateUlcerIndex(closes, 14);
    expect(typeof ui[20]).toBe('number');
    expect(ui[20]!).toBeGreaterThanOrEqual(0);
  });

  it('calculates Choppiness Index (CHOP)', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const chop = calculateChoppiness(highs, lows, closes, 14);

    expect(typeof chop[20]).toBe('number');
  });

  it('calculates Chop Zone', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const { values, colorValues } = calculateChopZone(highs, lows, closes, 30);

    expect(values[35]).toBe(1);
    expect(typeof colorValues[35]).toBe('string');
  });

  it('calculates BBTrend', () => {
    const closes = sampleBars.map((b) => b.close);
    const bbtrend = calculateBBTrend(closes, 10, 25, 2.0);
    expect(typeof bbtrend[30]).toBe('number');
  });

  it('builds renderable bundles for Batch 3 indicators', () => {
    const indicators: OverlayIndicator[] = [
      { id: 'env1', kind: 'ENVELOPE', placement: 'overlay', period: 10, percent: 5, basisColor: '#FF6D00', upperColor: '#2962FF', lowerColor: '#2962FF' },
      { id: 'cks1', kind: 'CHANDE_KROLL', placement: 'overlay', atrPeriod: 10, atrMultiplier: 1, stopPeriod: 9, longColor: '#2962FF', shortColor: '#FF6D00' },
      { id: 'hv1', kind: 'HV', placement: 'pane', period: 10, color: '#2962FF' },
      { id: 'stdev1', kind: 'STDEV', placement: 'pane', period: 10, color: '#2962FF' },
      { id: 'chop1', kind: 'CHOP', placement: 'pane', period: 14, color: '#2962FF' },
    ];

    const bundle = buildRenderableIndicators(sampleBars, indicators);
    expect(bundle.overlays).toHaveLength(2);
    expect(bundle.panes).toHaveLength(3);
  });
});

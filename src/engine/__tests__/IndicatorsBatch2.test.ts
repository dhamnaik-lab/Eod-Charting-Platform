import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '../Indicators';
import { calculateAO } from '@/indicators/standard/momentum/awesome-oscillator';
import { calculateTSI } from '@/indicators/standard/momentum/tsi';
import { calculateCRSI } from '@/indicators/standard/momentum/connors-rsi';
import { calculateRVI } from '@/indicators/standard/momentum/rvi';
import { calculateFisher } from '@/indicators/standard/momentum/fisher-transform';
import { calculateSMIErgodic } from '@/indicators/standard/momentum/smi-ergodic';
import { calculateRCI } from '@/indicators/standard/momentum/rank-correlation-index';
import { calculateWoodiesCCI } from '@/indicators/standard/momentum/woodies-cci';
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

describe('Batch 2 Momentum & Oscillators', () => {
  it('calculates Awesome Oscillator (AO) correctly', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const ao = calculateAO(highs, lows, 5, 34);

    expect(ao[0]).toBeNull();
    expect(ao[32]).toBeNull();
    expect(typeof ao[33]).toBe('number');
  });

  it('calculates TSI with double smoothing and signal line', () => {
    const closes = sampleBars.map((b) => b.close);
    const { tsi, signal } = calculateTSI(closes, 10, 5, 5);

    expect(typeof tsi[25]).toBe('number');
    expect(typeof signal[30]).toBe('number');
  });

  it('calculates Connors RSI (CRSI)', () => {
    const closes = sampleBars.map((b) => b.close);
    const crsi = calculateCRSI(closes, 3, 2, 20);

    expect(typeof crsi[15]).toBe('number');
    expect(crsi[15]!).toBeGreaterThanOrEqual(0);
    expect(crsi[15]!).toBeLessThanOrEqual(100);
  });

  it('calculates Relative Vigor Index (RVI)', () => {
    const { rvi, signal } = calculateRVI(sampleBars, 10);
    expect(typeof rvi[20]).toBe('number');
    expect(typeof signal[25]).toBe('number');
  });

  it('calculates Fisher Transform', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const { fisher, trigger } = calculateFisher(highs, lows, 9);

    expect(typeof fisher[15]).toBe('number');
    expect(typeof trigger[15]).toBe('number');
  });

  it('calculates SMI Ergodic & Oscillator', () => {
    const closes = sampleBars.map((b) => b.close);
    const { smi, signal, osc } = calculateSMIErgodic(closes, 10, 5, 5);

    expect(typeof smi[25]).toBe('number');
    expect(typeof signal[30]).toBe('number');
    expect(typeof osc[30]).toBe('number');
  });

  it('calculates Rank Correlation Index (RCI)', () => {
    const closes = sampleBars.map((b) => b.close);
    const { rci, signal } = calculateRCI(closes, 10, 5);

    expect(typeof rci[15]).toBe('number');
    expect(rci[15]!).toBeGreaterThanOrEqual(-100);
    expect(rci[15]!).toBeLessThanOrEqual(100);
  });

  it('calculates Woodies CCI (Dual CCI)', () => {
    const closes = sampleBars.map((b) => b.close);
    const { cci14, turbo } = calculateWoodiesCCI(closes, 14, 6);

    expect(typeof cci14[20]).toBe('number');
    expect(typeof turbo[20]).toBe('number');
  });

  it('builds renderable bundles for Batch 2 pane indicators', () => {
    const indicators: OverlayIndicator[] = [
      { id: 'ao1', kind: 'AO', placement: 'pane', fastPeriod: 5, slowPeriod: 34, positiveColor: '#009688', negativeColor: '#F44336' },
      { id: 'tsi1', kind: 'TSI', placement: 'pane', longLength: 10, shortLength: 5, signalLength: 5, color: '#2962FF', signalColor: '#E91E63' },
      { id: 'crsi1', kind: 'CRSI', placement: 'pane', rsiLength: 3, upDownLength: 2, rocLength: 20, color: '#2962FF' },
      { id: 'rvi1', kind: 'RVI', placement: 'pane', length: 10, color: '#008000', signalColor: '#FF0000' },
      { id: 'fish1', kind: 'FISHER', placement: 'pane', period: 9, color: '#2962FF', signalColor: '#FF6D00' },
      { id: 'wcci1', kind: 'WOODIES_CCI', placement: 'pane', cciPeriod: 14, turboPeriod: 6, cciColor: '#F44336', turboColor: '#009688' },
    ];

    const bundle = buildRenderableIndicators(sampleBars, indicators);
    expect(bundle.panes).toHaveLength(6);
  });
});

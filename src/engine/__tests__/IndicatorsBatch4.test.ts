import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '../Indicators';
import { calculateVolumeOscillator } from '@/indicators/standard/volume/volume-oscillator';
import { calculateChaikinOscillator } from '@/indicators/standard/volume/chaikin-oscillator';
import { calculateKlinger } from '@/indicators/standard/volume/klinger';
import { calculatePVT } from '@/indicators/standard/volume/pvt';
import { calculatePVI } from '@/indicators/standard/volume/pvi';
import { calculateNVI } from '@/indicators/standard/volume/nvi';
import { calculateCVD } from '@/indicators/standard/volume/cumulative-volume-delta';
import { calculateVolumeDelta } from '@/indicators/standard/volume/volume-delta';
import { calculateRVOL } from '@/indicators/standard/volume/rvol';
import { calculateUpDownVolume } from '@/indicators/standard/volume/up-down-volume';
import { calculateNetVolume } from '@/indicators/standard/volume/net-volume';
import { calculateEOM } from '@/indicators/standard/volume/ease-of-movement';
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

describe('Batch 4 Volume & Order Flow Oscillators', () => {
  it('calculates Volume Oscillator (VOL_OSC)', () => {
    const volumes = sampleBars.map((b) => b.volume);
    const osc = calculateVolumeOscillator(volumes, 5, 10);
    expect(typeof osc[15]).toBe('number');
  });

  it('calculates Chaikin Oscillator', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const volumes = sampleBars.map((b) => b.volume);
    const osc = calculateChaikinOscillator(highs, lows, closes, volumes, 3, 10);
    expect(typeof osc[15]).toBe('number');
  });

  it('calculates Klinger Oscillator (KVO)', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const closes = sampleBars.map((b) => b.close);
    const volumes = sampleBars.map((b) => b.volume);
    const { kvo, signal } = calculateKlinger(highs, lows, closes, volumes, 10, 20, 5);
    expect(typeof kvo[25]).toBe('number');
    expect(typeof signal[30]).toBe('number');
  });

  it('calculates Price Volume Trend (PVT)', () => {
    const closes = sampleBars.map((b) => b.close);
    const volumes = sampleBars.map((b) => b.volume);
    const pvt = calculatePVT(closes, volumes);
    expect(typeof pvt[10]).toBe('number');
  });

  it('calculates Positive Volume Index (PVI) & Negative Volume Index (NVI)', () => {
    const closes = sampleBars.map((b) => b.close);
    const volumes = sampleBars.map((b) => b.volume);
    const { pvi } = calculatePVI(closes, volumes, 10);
    const { nvi } = calculateNVI(closes, volumes, 10);
    expect(typeof pvi[15]).toBe('number');
    expect(typeof nvi[15]).toBe('number');
  });

  it('calculates CVD, Volume Delta, and Net Volume', () => {
    const cvd = calculateCVD(sampleBars);
    const volDelta = calculateVolumeDelta(sampleBars);
    const netVol = calculateNetVolume(sampleBars);

    expect(typeof cvd[10]).toBe('number');
    expect(typeof volDelta[10]).toBe('number');
    expect(typeof netVol[10]).toBe('number');
  });

  it('calculates RVOL (Relative Volume)', () => {
    const volumes = sampleBars.map((b) => b.volume);
    const rvol = calculateRVOL(volumes, 10);
    expect(typeof rvol[15]).toBe('number');
    expect(rvol[15]!).toBeGreaterThan(0);
  });

  it('calculates Up/Down Volume & Ease of Movement (EOM)', () => {
    const { up, down, delta } = calculateUpDownVolume(sampleBars);
    expect(typeof up[5]).toBe('number');
    expect(typeof down[5]).toBe('number');
    expect(typeof delta[5]).toBe('number');

    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const volumes = sampleBars.map((b) => b.volume);
    const eom = calculateEOM(highs, lows, volumes, 10, 10000);
    expect(typeof eom[15]).toBe('number');
  });

  it('builds renderable bundles for Batch 4 volume indicators', () => {
    const indicators: OverlayIndicator[] = [
      { id: 'vo1', kind: 'VOL_OSC', placement: 'pane', fastPeriod: 5, slowPeriod: 10, color: '#2962FF' },
      { id: 'ch1', kind: 'CHAIKIN_OSC', placement: 'pane', fastPeriod: 3, slowPeriod: 10, color: '#EC407A' },
      { id: 'pvt1', kind: 'PVT', placement: 'pane', color: '#2962FF' },
      { id: 'rvol1', kind: 'RVOL', placement: 'pane', period: 10, color: '#2962FF' },
      { id: 'eom1', kind: 'EOM', placement: 'pane', period: 10, divisor: 10000, color: '#43A047' },
    ];

    const bundle = buildRenderableIndicators(sampleBars, indicators);
    expect(bundle.panes).toHaveLength(5);
  });
});

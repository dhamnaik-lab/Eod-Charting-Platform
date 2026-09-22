import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '../Indicators';
import { calculateTWAP } from '@/indicators/standard/moving-averages/twap';
import { calculateADR } from '@/indicators/standard/volatility/adr';
import { calculateAutoKeyLevels } from '@/indicators/standard/special/auto-key-levels';
import { calculateAutoTrend } from '@/indicators/standard/special/auto-trend';
import { calculateFractals } from '@/indicators/standard/special/fractals';
import { calculateTrendStrength } from '@/indicators/standard/trend/trend-strength';
import { calculateRCIRibbon } from '@/indicators/standard/momentum/rci-ribbon';
import { calculateBBWidth } from '@/indicators/standard/volatility/bb-width';
import { calculateBBPctB } from '@/indicators/standard/volatility/bb-percent-b';
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

describe('Batch 5 Key Levels, Structures & Range', () => {
  it('calculates TWAP', () => {
    const closes = sampleBars.map((b) => b.close);
    const twap = calculateTWAP(closes);
    expect(typeof twap[10]).toBe('number');
    expect(twap[0]).toBe(closes[0]);
  });

  it('calculates Average Day Range (ADR)', () => {
    const highs = sampleBars.map((b) => b.high);
    const lows = sampleBars.map((b) => b.low);
    const adr = calculateADR(highs, lows, 14);
    expect(typeof adr[15]).toBe('number');
    expect(adr[15]!).toBeGreaterThan(0);
  });

  it('calculates Auto Key Levels', () => {
    const { levels } = calculateAutoKeyLevels(sampleBars, 5, 4);
    expect(Array.isArray(levels)).toBe(true);
    expect(levels.length).toBeGreaterThan(0);
  });

  it('calculates Auto Trend Lines', () => {
    const { resistanceLine, supportLine } = calculateAutoTrend(sampleBars, 5);
    const hasTrend = resistanceLine.some((v) => v !== null) || supportLine.some((v) => v !== null);
    expect(hasTrend).toBe(true);
  });

  it('calculates Williams Fractals', () => {
    const { upFractals, downFractals } = calculateFractals(sampleBars, 2);
    const hasFractals = upFractals.some((v) => v !== null) || downFractals.some((v) => v !== null);
    expect(hasFractals).toBe(true);
  });

  it('calculates Trend Strength Index', () => {
    const closes = sampleBars.map((b) => b.close);
    const tsi = calculateTrendStrength(closes, 14);
    expect(typeof tsi[20]).toBe('number');
    expect(tsi[20]!).toBeGreaterThanOrEqual(-1);
    expect(tsi[20]!).toBeLessThanOrEqual(1);
  });

  it('calculates RCI Ribbon', () => {
    const closes = sampleBars.map((b) => b.close);
    const { shortRCI, middleRCI, longRCI } = calculateRCIRibbon(closes, 5, 10, 20);
    expect(typeof shortRCI[10]).toBe('number');
    expect(typeof middleRCI[15]).toBe('number');
    expect(typeof longRCI[25]).toBe('number');
  });

  it('calculates BB Width and BB %B', () => {
    const closes = sampleBars.map((b) => b.close);
    const width = calculateBBWidth(closes, 10, 2.0);
    const pctB = calculateBBPctB(closes, 10, 2.0);
    expect(typeof width[15]).toBe('number');
    expect(typeof pctB[15]).toBe('number');
  });

  it('builds renderable bundles for Batch 5 indicators', () => {
    const indicators: OverlayIndicator[] = [
      { id: 'tw1', kind: 'TWAP', placement: 'overlay', color: '#DD7A28' },
      { id: 'kl1', kind: 'AUTO_KEY_LEVELS', placement: 'overlay', pivotLength: 5, maxLevels: 3 },
      { id: 'at1', kind: 'AUTO_TREND', placement: 'overlay', pivotLength: 5 },
      { id: 'fr1', kind: 'FRACTALS', placement: 'overlay', periods: 2 },
      { id: 'adr1', kind: 'ADR', placement: 'pane', period: 14, color: '#2962FF' },
      { id: 'ts1', kind: 'TREND_STRENGTH', placement: 'pane', period: 14, color: '#7E57C2' },
      { id: 'rcir1', kind: 'RCI_RIBBON', placement: 'pane', shortLength: 5, middleLength: 10, longLength: 20 },
      { id: 'bbw1', kind: 'BB_WIDTH', placement: 'pane', period: 10, stdDev: 2.0, color: '#2962FF' },
      { id: 'bbp1', kind: 'BB_PCT_B', placement: 'pane', period: 10, stdDev: 2.0, color: '#2962FF' },
    ];

    const bundle = buildRenderableIndicators(sampleBars, indicators);
    expect(bundle.overlays).toHaveLength(4);
    expect(bundle.panes).toHaveLength(5);
  });
});

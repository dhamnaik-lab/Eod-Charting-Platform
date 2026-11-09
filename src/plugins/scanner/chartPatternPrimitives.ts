import type { EodBar } from '@/plugins/scanner/types';
import type { ChartPatternPivot } from '@/plugins/scanner/chartPatternTypes';

export function candleRange(bar: EodBar): number {
  return Math.max(0, bar.high - bar.low);
}

export function averageRange(bars: EodBar[], period: number, excludeCurrent = false): number | null {
  const source = excludeCurrent ? bars.slice(0, -1) : bars;
  if (source.length < period) return null;
  const window = source.slice(-period);
  return window.reduce((sum, bar) => sum + candleRange(bar), 0) / period;
}

export function averageVolume(bars: EodBar[], period: number, excludeCurrent = false): number | null {
  const source = excludeCurrent ? bars.slice(0, -1) : bars;
  if (source.length < period) return null;
  const window = source.slice(-period);
  return window.reduce((sum, bar) => sum + bar.volume, 0) / period;
}

export function gapUpPct(today: EodBar, previous: EodBar): number | null {
  if (previous.high <= 0 || today.open <= previous.high) return null;
  return round((today.open / previous.high - 1) * 100, 2);
}

export function gapDownPct(today: EodBar, previous: EodBar): number | null {
  if (previous.low <= 0 || today.open >= previous.low) return null;
  return round((1 - today.open / previous.low) * 100, 2);
}

export function highestHigh(bars: EodBar[]): number | null {
  if (bars.length === 0) return null;
  return Math.max(...bars.map((bar) => bar.high));
}

export function lowestLow(bars: EodBar[]): number | null {
  if (bars.length === 0) return null;
  return Math.min(...bars.map((bar) => bar.low));
}

export function isRangeBound(bars: EodBar[], maxWidthPct: number): boolean {
  const high = highestHigh(bars);
  const low = lowestLow(bars);
  if (high === null || low === null || high <= 0 || low <= 0) return false;
  const midpoint = (high + low) / 2;
  return midpoint > 0 && ((high - low) / midpoint) * 100 <= maxWidthPct;
}

export function hasUpTrend(bars: EodBar[], minMovePct: number): boolean {
  if (bars.length < 2) return false;
  const first = bars[0];
  const last = bars[bars.length - 1];
  return first.close > 0 && ((last.close / first.close - 1) * 100) >= minMovePct;
}

export function hasDownTrend(bars: EodBar[], minMovePct: number): boolean {
  if (bars.length < 2) return false;
  const first = bars[0];
  const last = bars[bars.length - 1];
  return first.close > 0 && ((1 - last.close / first.close) * 100) >= minMovePct;
}

export function isVolumeSpike(volume: number, average: number | null, multiplier: number): boolean {
  return average !== null && average > 0 && volume >= average * multiplier;
}

export function findLocalPivots(bars: EodBar[], strength: number): ChartPatternPivot[] {
  if (strength < 1 || bars.length < strength * 2 + 1) return [];
  const pivots: ChartPatternPivot[] = [];

  for (let index = strength; index < bars.length - strength; index += 1) {
    const bar = bars[index];
    const neighbors = [
      ...bars.slice(index - strength, index),
      ...bars.slice(index + 1, index + strength + 1),
    ];
    if (neighbors.every((neighbor) => bar.high > neighbor.high)) {
      pivots.push({ index, date: bar.date, price: bar.high, kind: 'high' });
    }
    if (neighbors.every((neighbor) => bar.low < neighbor.low)) {
      pivots.push({ index, date: bar.date, price: bar.low, kind: 'low' });
    }
  }

  return pivots;
}

export function computeAtrAt(bars: EodBar[], index: number, period: number): number | null {
  if (index < period || period <= 0 || bars.length <= index) return null;
  const slice = bars.slice(index - period, index + 1);
  if (slice.length < 2) return null;
  let trSum = 0;
  for (let i = 1; i < slice.length; i += 1) {
    const current = slice[i];
    const prev = slice[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close),
    );
    trSum += tr;
  }
  return trSum / period;
}

export function linearSlope(valuesOrPoints: number[] | Array<{ x: number; y: number }>): number | null {
  if (valuesOrPoints.length < 2) return null;
  const isPoints = typeof valuesOrPoints[0] === 'object' && valuesOrPoints[0] !== null;
  const points: Array<{ x: number; y: number }> = isPoints
    ? (valuesOrPoints as Array<{ x: number; y: number }>)
    : (valuesOrPoints as number[]).map((y, index) => ({ x: index, y }));
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface SwingPivot extends ChartPatternPivot {
  scale: number;
  magnitudePct: number;
}

export interface SwingPivotOptions {
  scales?: number[];
  minMovePct?: number;
  atrPeriod?: number;
  atrMultiplier?: number;
}

export function findMultiScalePivots(bars: EodBar[], scales: number[] = [3, 5, 10, 20]): ChartPatternPivot[] {
  const pivotMap = new Map<number, ChartPatternPivot>();
  for (const strength of scales) {
    const pivots = findLocalPivots(bars, strength);
    for (const p of pivots) {
      if (!pivotMap.has(p.index)) {
        pivotMap.set(p.index, p);
      }
    }
  }
  return Array.from(pivotMap.values()).sort((a, b) => a.index - b.index);
}

export function findSwingPivots(bars: EodBar[], opts: SwingPivotOptions = {}): SwingPivot[] {
  const { scales = [3, 5, 10, 20], minMovePct = 4, atrPeriod = 14, atrMultiplier = 2 } = opts;
  const scaleByKey = new Map<string, number>();
  for (const strength of scales) {
    for (const pivot of findLocalPivots(bars, strength)) {
      const key = `${pivot.index}:${pivot.kind}`;
      const prev = scaleByKey.get(key) ?? 0;
      if (strength > prev) scaleByKey.set(key, strength);
    }
  }
  const candidates = findMultiScalePivots(bars, scales);
  if (candidates.length === 0) return [];

  const confirmed: SwingPivot[] = [];
  let lastConfirmed: ChartPatternPivot | null = null;

  for (const candidate of candidates) {
    const atr = atrPeriod ? computeAtrAt(bars, candidate.index, atrPeriod) : null;
    const threshold = atr !== null && atr > 0
      ? atr * atrMultiplier
      : (lastConfirmed?.price ?? candidate.price) * (minMovePct / 100);

    if (!lastConfirmed) {
      confirmed.push({ ...candidate, scale: scaleByKey.get(`${candidate.index}:${candidate.kind}`) ?? 0, magnitudePct: 0 });
      lastConfirmed = candidate;
      continue;
    }

    const move = Math.abs(candidate.price - lastConfirmed.price);
    if (move < threshold) continue;

    if (candidate.kind === lastConfirmed.kind) {
      const isMoreExtreme = candidate.kind === 'high'
        ? candidate.price > lastConfirmed.price
        : candidate.price < lastConfirmed.price;
      if (isMoreExtreme) {
        const revisedMove = Math.abs(candidate.price - (confirmed.length > 1 ? confirmed[confirmed.length - 2].price : candidate.price));
        const basePrice = confirmed.length > 1 ? confirmed[confirmed.length - 2].price : lastConfirmed.price;
        const mag = basePrice > 0 ? round((revisedMove / basePrice) * 100, 2) : 0;
        confirmed[confirmed.length - 1] = { ...candidate, scale: scaleByKey.get(`${candidate.index}:${candidate.kind}`) ?? 0, magnitudePct: mag };
        lastConfirmed = candidate;
      }
      continue;
    }

    const mag = lastConfirmed.price > 0 ? round((move / lastConfirmed.price) * 100, 2) : 0;
    confirmed.push({ ...candidate, scale: scaleByKey.get(`${candidate.index}:${candidate.kind}`) ?? 0, magnitudePct: mag });
    lastConfirmed = candidate;
  }

  return confirmed;
}

export function retracementDepthPct(extreme1: number, extreme2: number, intervening: number): number {
  const avgExtreme = (extreme1 + extreme2) / 2;
  if (avgExtreme <= 0) return 0;
  return round((Math.abs(avgExtreme - intervening) / avgExtreme) * 100, 2);
}

export function hasPatternVolumeProfile(bars: EodBar[], patternStartIndex: number, breakoutIndex: number): boolean {
  if (patternStartIndex >= breakoutIndex || breakoutIndex >= bars.length) return false;
  const consolidationBars = bars.slice(patternStartIndex, breakoutIndex);
  if (consolidationBars.length === 0) return false;
  const avgConsolidationVol = consolidationBars.reduce((sum, b) => sum + b.volume, 0) / consolidationBars.length;
  const breakoutVol = bars[breakoutIndex].volume;
  return avgConsolidationVol > 0 && breakoutVol >= avgConsolidationVol * 1.25;
}

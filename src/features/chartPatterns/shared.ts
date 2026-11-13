import type { EodBar, ScannerContext, ScannerDefinition, ScannerResult } from '@/features/scanner/types';
import type { ChartPatternPivot } from '@/features/chartPatterns/types';
import { candleRange, highestHigh, lowestLow } from '@/features/chartPatterns/primitives';
import { LEVEL_TOLERANCE_PCT } from '@/features/chartPatterns/constants';

export function movePct(bars: EodBar[]): number {
  if (bars.length < 2 || bars[0].close <= 0) return 0;
  return (bars[bars.length - 1].close / bars[0].close - 1) * 100;
}

export function averageClose(bars: EodBar[]): number {
  return bars.reduce((sum, bar) => sum + bar.close, 0) / bars.length;
}

export function averageSegmentRange(bars: EodBar[]): number {
  if (bars.length === 0) return 0;
  return bars.reduce((sum, bar) => sum + candleRange(bar), 0) / bars.length;
}

export function segmentWidth(bars: EodBar[]): number | null {
  const high = highestHigh(bars);
  const low = lowestLow(bars);
  if (high === null || low === null) return null;
  return high - low;
}

export function isLongDirectionalCandle(bar: EodBar, direction: 'bullish' | 'bearish'): boolean {
  const range = candleRange(bar);
  const body = Math.abs(bar.close - bar.open);
  if (range <= 0 || body / range < 0.55) return false;
  return direction === 'bullish' ? bar.close > bar.open : bar.close < bar.open;
}

export function isSharpPivot(
  bars: EodBar[],
  pivot: ChartPatternPivot,
  kind: 'bottom' | 'top',
): boolean {
  const previous = bars[pivot.index - 1];
  const next = bars[pivot.index + 1];
  if (!previous || !next || pivot.price <= 0) return false;
  if (kind === 'bottom') {
    return previous.low > pivot.price * 1.07 && next.low > pivot.price * 1.07;
  }
  return previous.high < pivot.price * 0.93 && next.high < pivot.price * 0.93;
}

export function isRoundedPivot(
  bars: EodBar[],
  pivot: ChartPatternPivot,
  kind: 'bottom' | 'top',
): boolean {
  if (pivot.price <= 0) return false;
  const window = bars.slice(Math.max(0, pivot.index - 2), pivot.index + 3);
  if (window.length < 5) return false;
  if (kind === 'bottom') {
    return window.filter((bar) => bar.low <= pivot.price * 1.08).length >= 3;
  }
  return window.filter((bar) => bar.high >= pivot.price * 0.92).length >= 3;
}

export function countTouches(bars: EodBar[], field: 'high' | 'low', level: number, tolerancePct: number): number {
  return bars.filter((bar) => {
    const value = bar[field];
    if (level <= 0) return false;
    return (Math.abs(value - level) / level) * 100 <= tolerancePct;
  }).length;
}

export function pivotsComparable(pivots: Array<{ price: number }>, tolerancePct: number = LEVEL_TOLERANCE_PCT): boolean {
  return pricesComparable(pivots.map((pivot) => pivot.price), tolerancePct);
}

export function pricesComparable(prices: number[], tolerancePct: number): boolean {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const midpoint = (min + max) / 2;
  return midpoint > 0 && ((max - min) / midpoint) * 100 <= tolerancePct;
}

export function pivotsHaveSpacing(pivots: Array<{ index: number }>, minSpacing: number): boolean {
  return pivots.every((pivot, index) => index === 0 || pivot.index - pivots[index - 1].index >= minSpacing);
}

export function averagePivotPrice(pivots: Array<{ price: number }>): number {
  return pivots.reduce((sum, pivot) => sum + pivot.price, 0) / pivots.length;
}

export function indexOfLowestLow(bars: EodBar[]): number {
  return bars.reduce((bestIndex, bar, index) => (bar.low < bars[bestIndex].low ? index : bestIndex), 0);
}

export function indexOfHighestHigh(bars: EodBar[]): number {
  return bars.reduce((bestIndex, bar, index) => (bar.high > bars[bestIndex].high ? index : bestIndex), 0);
}

export function createChartPatternResult(
  context: ScannerContext,
  definition: ScannerDefinition,
  direction: ScannerResult['direction'],
  confidence: number,
  reasons: string[],
  values: ScannerResult['values'],
  details: Partial<NonNullable<ScannerResult['chartPattern']>>,
): ScannerResult {
  const latest = context.bars[context.bars.length - 1];
  return {
    symbol: context.symbol,
    exchange: context.exchange,
    scannerId: definition.id,
    scannerName: definition.name,
    categoryId: definition.categoryId,
    categoryName: definition.categoryName,
    date: latest.date,
    matched: true,
    direction,
    score: confidence,
    reasons,
    values,
    chartPattern: {
      family: definition.chartPattern?.family ?? 'gap',
      confidence,
      patternEndDate: latest.date,
      ...details,
    },
    warnings: [],
    source: 'EODChartPatternScanner_v1',
    generatedAt: new Date().toISOString(),
  };
}

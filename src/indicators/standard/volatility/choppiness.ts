import { ATR } from 'technicalindicators';
import {
  buildLineSeries,
  padSeries,
  slidingWindowMax,
  slidingWindowMin,
  type IndicatorBuilder,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateChoppiness(
  highs: number[],
  lows: number[],
  closes: number[],
  length = 14,
): Array<number | null> {
  const total = highs.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < length || length <= 1) return result;

  const atr1Raw = ATR.calculate({ high: highs, low: lows, close: closes, period: 1 });
  const atr1 = padSeries(atr1Raw, total);

  const highestHigh = slidingWindowMax(highs, length);
  const lowestLow = slidingWindowMin(lows, length);

  const log10Length = Math.log10(length);

  for (let i = length - 1; i < total; i++) {
    let sumATR = 0;
    for (let j = i - length + 1; j <= i; j++) {
      const a = atr1[j];
      if (a !== null) sumATR += a;
    }

    const hh = highestHigh[i];
    const ll = lowestLow[i];

    if (hh !== null && ll !== null && hh > ll) {
      const range = hh - ll;
      result[i] = (100 * Math.log10(sumATR / range)) / log10Length;
    }
  }

  return result;
}

export const buildCHOP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CHOP' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 14;

  const values = calculateChoppiness(highs, lows, closes, period);

  return {
    indicator,
    title,
    lines: [buildLineSeries('chop', 'CHOP', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
    referenceLines: [38.2, 50, 61.8],
    fixedRange: { min: 0, max: 100 },
  };
};

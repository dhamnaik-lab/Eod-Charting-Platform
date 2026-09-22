import { SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, slidingWindowMax, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateUlcerIndex(closes: number[], length = 14): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < length) return result;

  const highestCloses = slidingWindowMax(closes, length);
  const drawdownSq: number[] = new Array(total).fill(0);

  for (let i = 0; i < total; i++) {
    const hi = highestCloses[i];
    if (hi !== null && hi > 0) {
      const dd = (100 * (closes[i] - hi)) / hi;
      drawdownSq[i] = dd * dd;
    }
  }

  const smaRaw = SMA.calculate({ values: drawdownSq, period: length });
  const smaPadded = padSeries(smaRaw, total);

  for (let i = length - 1; i < total; i++) {
    const v = smaPadded[i];
    if (v !== null && v >= 0) {
      result[i] = Math.sqrt(v);
    }
  }

  return result;
}

export const buildULCER_INDEX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ULCER_INDEX' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 14;

  const values = calculateUlcerIndex(srcValues, period);

  return {
    indicator,
    title,
    lines: [buildLineSeries('ulcer', 'Ulcer Index', values, bars.length, indicator.color ?? '#E91E63', 1.8)],
  };
};

import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateLSMA(values: number[], period: number, offset = 0): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  const n = period;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const denominator = n * sumX2 - sumX * sumX;

  for (let i = n - 1; i < values.length; i++) {
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < n; j++) {
      const y = values[i - (n - 1 - j)];
      sumY += y;
      sumXY += j * y;
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    result[i] = intercept + slope * (n - 1 + offset);
  }

  return result;
}

export const buildLSMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'LSMA' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculateLSMA(srcValues, indicator.period, indicator.offset ?? 0);
  return {
    indicator,
    title,
    lines: [buildLineSeries('lsma', title, values, bars.length, indicator.color, 1.8)],
  };
};

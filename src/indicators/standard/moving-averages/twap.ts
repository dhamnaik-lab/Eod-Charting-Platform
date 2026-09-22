import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateTWAP(prices: number[]): Array<number | null> {
  const total = prices.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (!total) return result;

  let sum = 0;
  for (let i = 0; i < total; i++) {
    sum += prices[i];
    result[i] = sum / (i + 1);
  }

  return result;
}

export const buildTWAP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TWAP' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = getSourceValues(bars, indicator.source, indicator.sourceIndicatorId, sourceSeriesMap);
  const twap = calculateTWAP(values);

  return {
    indicator,
    title,
    lines: [buildLineSeries('twap', 'TWAP', twap, bars.length, indicator.color ?? '#DD7A28', 1.8)],
  };
};

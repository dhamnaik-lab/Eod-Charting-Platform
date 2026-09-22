import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateVWMA(values: number[], volumes: number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  let sumPV = 0;
  let sumV = 0;
  for (let i = 0; i < period; i++) {
    sumPV += values[i] * volumes[i];
    sumV += volumes[i];
  }

  for (let i = period - 1; i < values.length; i++) {
    result[i] = sumV > 0 ? sumPV / sumV : null;
    if (i + 1 < values.length) {
      sumPV = sumPV - values[i - period + 1] * volumes[i - period + 1] + values[i + 1] * volumes[i + 1];
      sumV = sumV - volumes[i - period + 1] + volumes[i + 1];
    }
  }

  return result;
}

export const buildVWMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VWMA' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculateVWMA(srcValues, sources.volumes, indicator.period);
  return {
    indicator,
    title,
    lines: [buildLineSeries('vwma', title, values, bars.length, indicator.color, 1.8)],
  };
};

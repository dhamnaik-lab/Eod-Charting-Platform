import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildALMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ALMA' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const { period, sigma, offset } = indicator;
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let sumWeights = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(w);
    sumWeights += w;
  }
  const values: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += srcValues[i - ((period - 1) - j)] * weights[j];
    }
    values[i] = sum / sumWeights;
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('alma', title, values, bars.length, indicator.color, 1.8)],
  };
};

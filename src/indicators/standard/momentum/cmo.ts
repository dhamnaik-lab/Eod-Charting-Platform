import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCMO: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CMO' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const values: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length > period) {
    let sumGains = 0;
    let sumLosses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = srcValues[i] - (srcValues[i - 1] ?? srcValues[i]);
      if (diff > 0) sumGains += diff;
      else sumLosses += Math.abs(diff);
    }
    values[period] = (sumGains + sumLosses) === 0 ? 0 : (100 * (sumGains - sumLosses)) / (sumGains + sumLosses);

    for (let i = period + 1; i < bars.length; i++) {
      const prevDiff = srcValues[i - period] - (srcValues[i - period - 1] ?? srcValues[i - period]);
      if (prevDiff > 0) sumGains -= prevDiff;
      else sumLosses -= Math.abs(prevDiff);

      const currDiff = srcValues[i] - srcValues[i - 1];
      if (currDiff > 0) sumGains += currDiff;
      else sumLosses += Math.abs(currDiff);

      const sum = sumGains + sumLosses;
      values[i] = sum === 0 ? 0 : (100 * (sumGains - sumLosses)) / sum;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('cmo', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [-50, 0, 50],
    fixedRange: { min: -100, max: 100 },
  };
};

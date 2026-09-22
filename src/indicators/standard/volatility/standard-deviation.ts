import { SD } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateStDev(values: number[], period = 20): Array<number | null> {
  const total = values.length;
  if (total < period) return new Array(total).fill(null);
  const sdRaw = SD.calculate({ values, period });
  return padSeries(sdRaw, total);
}

export const buildSTDEV: IndicatorBuilder<Extract<ChartIndicator, { kind: 'STDEV' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;

  const values = calculateStDev(srcValues, period);

  return {
    indicator,
    title,
    lines: [buildLineSeries('stdev', 'StDev', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
  };
};

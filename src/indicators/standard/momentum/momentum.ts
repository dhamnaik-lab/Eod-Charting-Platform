import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildMOM: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MOM' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const momValues: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = indicator.period; i < bars.length; i++) {
    momValues[i] = srcValues[i] - srcValues[i - indicator.period];
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('mom', title, momValues, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

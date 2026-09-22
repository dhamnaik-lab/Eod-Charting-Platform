import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildAPO: IndicatorBuilder<Extract<ChartIndicator, { kind: 'APO' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fast = EMA.calculate({ values: srcValues, period: indicator.fastPeriod });
  const slow = EMA.calculate({ values: srcValues, period: indicator.slowPeriod });
  const values: Array<number | null> = new Array(bars.length).fill(null);
  const offset = Math.max(indicator.fastPeriod, indicator.slowPeriod) - 1;
  for (let i = offset; i < bars.length; i++) {
    const f = fast[i - (indicator.fastPeriod - 1)];
    const s = slow[i - (indicator.slowPeriod - 1)];
    if (f !== undefined && s !== undefined) {
      values[i] = f - s;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('apo', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

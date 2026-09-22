import { ROC } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildROC: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ROC' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [
      buildLineSeries(
        'roc',
        title,
        ROC.calculate({ values: srcValues, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
    referenceLines: [0],
  };
};

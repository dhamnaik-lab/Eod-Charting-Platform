import { RSI } from 'technicalindicators';
import { buildLineSeries, getIndicatorReferenceLines, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildRSI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RSI' }>> = (
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
        'rsi',
        title,
        RSI.calculate({ values: srcValues, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
    referenceLines: getIndicatorReferenceLines(indicator, [
      { id: 'oversold', label: 'Oversold', value: 30 },
      { id: 'overbought', label: 'Overbought', value: 70 },
    ]),
    fixedRange: { min: 0, max: 100 },
  };
};

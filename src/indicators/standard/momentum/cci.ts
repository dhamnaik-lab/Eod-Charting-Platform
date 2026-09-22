import { CCI } from 'technicalindicators';
import { buildLineSeries, getIndicatorReferenceLines, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCCI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CCI' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [
      buildLineSeries(
        'cci',
        title,
        CCI.calculate({ high: highs, low: lows, close: closes, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
    referenceLines: getIndicatorReferenceLines(indicator, [
      { id: 'lower', label: 'Lower', value: -100 },
      { id: 'upper', label: 'Upper', value: 100 },
    ]),
  };
};

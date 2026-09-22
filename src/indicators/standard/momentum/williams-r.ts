import { WilliamsR } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildWILLR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'WILLR' }>> = (
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
        'willr',
        title,
        WilliamsR.calculate({ high: highs, low: lows, close: closes, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
    referenceLines: [-80, -20],
    fixedRange: { min: -100, max: 0 },
  };
};

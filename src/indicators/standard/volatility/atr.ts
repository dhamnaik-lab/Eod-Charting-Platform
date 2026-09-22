import { ATR } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildATR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ATR' }>> = (
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
        'atr',
        title,
        ATR.calculate({ high: highs, low: lows, close: closes, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
  };
};

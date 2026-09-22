import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateDoubleEma(values: number[], period: number): Array<number | null> {
  if (period <= 0 || values.length < period) {
    return [];
  }
  const ema1 = EMA.calculate({ values, period });
  const ema2 = EMA.calculate({ values: ema1, period });
  const result: Array<number | null> = new Array(values.length).fill(null);
  const start = period * 2 - 2;
  for (let i = 0; i < ema2.length; i++) {
    result[start + i] = 2 * ema1[period - 1 + i] - (ema2[i] ?? 0);
  }
  return result;
}

export const buildDEMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'DEMA' }>> = (
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
        'dema',
        title,
        calculateDoubleEma(srcValues, indicator.period),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
  };
};

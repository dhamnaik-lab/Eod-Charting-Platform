import { SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildDPO: IndicatorBuilder<Extract<ChartIndicator, { kind: 'DPO' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const offset = Math.floor(period / 2 + 1);
  const sma = SMA.calculate({ values: srcValues, period });
  const values: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = period + offset - 1; i < bars.length; i++) {
    const s = sma[i - offset - (period - 1)];
    if (s !== undefined) {
      values[i] = srcValues[i] - s;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('dpo', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

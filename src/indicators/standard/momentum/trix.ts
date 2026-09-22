import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildTRIX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TRIX' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const ema1 = EMA.calculate({ values: srcValues, period });
  const ema2 = EMA.calculate({ values: ema1, period });
  const ema3 = EMA.calculate({ values: ema2, period });
  const values: Array<number | null> = new Array(bars.length).fill(null);
  const startIdx = (period - 1) * 3 + 1;
  for (let i = startIdx; i < bars.length; i++) {
    const prev = ema3[i - (period - 1) * 3 - 1];
    const curr = ema3[i - (period - 1) * 3];
    if (prev && curr && prev !== 0) {
      values[i] = ((curr - prev) / prev) * 100;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('trix', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

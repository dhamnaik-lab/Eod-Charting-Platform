import { WMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildHMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'HMA' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const wmaHalf = WMA.calculate({ values: srcValues, period: Math.floor(period / 2) });
  const wmaFull = WMA.calculate({ values: srcValues, period: period });
  const diff: number[] = [];
  for (let i = 0; i < wmaFull.length; i++) {
    diff.push(2 * (wmaHalf[wmaHalf.length - wmaFull.length + i] ?? 0) - (wmaFull[i] ?? 0));
  }
  const hma = WMA.calculate({ values: diff, period: Math.floor(Math.sqrt(period)) });
  return {
    indicator,
    title,
    lines: [buildLineSeries('hma', title, hma, bars.length, indicator.color, 1.8)],
  };
};

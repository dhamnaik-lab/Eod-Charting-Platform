import { WMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCOPPOCK: IndicatorBuilder<Extract<ChartIndicator, { kind: 'COPPOCK' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const rf = indicator.rocFast;
  const rs = indicator.rocSlow;
  const wp = indicator.wmaPeriod;
  const values: Array<number | null> = new Array(bars.length).fill(null);
  const maxRoc = Math.max(rf, rs);
  const sumRoc: number[] = [];
  for (let i = maxRoc; i < bars.length; i++) {
    const roc1 = ((srcValues[i] - srcValues[i - rf]) / srcValues[i - rf]) * 100;
    const roc2 = ((srcValues[i] - srcValues[i - rs]) / srcValues[i - rs]) * 100;
    sumRoc.push(roc1 + roc2);
  }
  const smoothed = WMA.calculate({ values: sumRoc, period: wp });
  const start = maxRoc + wp - 1;
  for (let i = 0; i < smoothed.length; i++) {
    values[start + i] = smoothed[i];
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('coppock', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

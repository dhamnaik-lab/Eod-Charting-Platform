import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildVWAP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VWAP' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values: Array<number | null> = new Array(bars.length).fill(null);
  let cumulativeTPV = 0;
  let cumulativeVol = 0;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += tp * bar.volume;
    cumulativeVol += bar.volume;
    values[i] = cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : null;
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('vwap', title, values, bars.length, indicator.color, 1.8)],
  };
};

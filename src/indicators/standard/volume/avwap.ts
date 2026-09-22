import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildAVWAP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AVWAP' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values: Array<number | null> = new Array(bars.length).fill(null);
  let anchorIndex = indicator.anchorIndex ?? 0;
  if (indicator.anchorDate) {
    const found = bars.findIndex((b) => b.date >= indicator.anchorDate!);
    if (found !== -1) anchorIndex = found;
  }

  let cumTPV = 0;
  let cumVol = 0;
  for (let i = anchorIndex; i < bars.length; i++) {
    const bar = bars[i];
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumTPV += tp * bar.volume;
    cumVol += bar.volume;
    values[i] = cumVol > 0 ? cumTPV / cumVol : null;
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('avwap', title, values, bars.length, indicator.color ?? '#f9d423', 1.8)],
  };
};

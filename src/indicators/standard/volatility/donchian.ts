import { buildLineSeries, slidingWindowMax, slidingWindowMin, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildDONCHIAN: IndicatorBuilder<Extract<ChartIndicator, { kind: 'DONCHIAN' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const upper: Array<number | null> = new Array(bars.length).fill(null);
  const lower: Array<number | null> = new Array(bars.length).fill(null);
  const mid: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length >= period) {
    const h = slidingWindowMax(highs, period);
    const l = slidingWindowMin(lows, period);
    for (let i = period - 1; i < bars.length; i++) {
      upper[i] = h[i];
      lower[i] = l[i];
      mid[i] = (h[i] + l[i]) / 2;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('mid', 'Mid', mid, bars.length, indicator.color, 1)],
    band: { upper, lower, color: indicator.color },
  };
};

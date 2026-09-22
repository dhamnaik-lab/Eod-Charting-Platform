import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildZIGZAG: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ZIGZAG' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const dev = indicator.deviation / 100;
  const values: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length < 2) return null;

  let lastPeakPrice = bars[0].close;
  let lastPeakIdx = 0;
  let dir = 0; // 1 up, -1 down

  for (let i = 1; i < bars.length; i++) {
    const price = bars[i].close;
    const diff = (price - lastPeakPrice) / lastPeakPrice;

    if (dir === 0) {
      if (Math.abs(diff) >= dev) {
        dir = diff > 0 ? 1 : -1;
        values[lastPeakIdx] = lastPeakPrice;
        lastPeakPrice = price;
        lastPeakIdx = i;
        values[i] = price;
      }
    } else if (dir === 1) {
      if (price > lastPeakPrice) {
        lastPeakPrice = price;
        values[lastPeakIdx] = null;
        lastPeakIdx = i;
        values[i] = price;
      } else if (diff <= -dev) {
        dir = -1;
        lastPeakPrice = price;
        lastPeakIdx = i;
        values[i] = price;
      }
    } else {
      if (price < lastPeakPrice) {
        lastPeakPrice = price;
        values[lastPeakIdx] = null;
        lastPeakIdx = i;
        values[i] = price;
      } else if (diff >= dev) {
        dir = 1;
        lastPeakPrice = price;
        lastPeakIdx = i;
        values[i] = price;
      }
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('zigzag', title, values, bars.length, indicator.color, 2)],
  };
};

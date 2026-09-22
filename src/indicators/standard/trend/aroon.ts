import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildAROON: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AROON' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const aroonUp: Array<number | null> = new Array(bars.length).fill(null);
  const aroonDown: Array<number | null> = new Array(bars.length).fill(null);
  const p = indicator.period;
  if (bars.length > p) {
    const highIdxs: number[] = new Array(bars.length).fill(0);
    const lowIdxs: number[] = new Array(bars.length).fill(0);
    const highDeque: number[] = [];
    const lowDeque: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (highDeque.length > 0 && highDeque[0] <= i - p - 1) highDeque.shift();
      while (highDeque.length > 0 && highs[highDeque[highDeque.length - 1]] <= highs[i]) highDeque.pop();
      highDeque.push(i);
      highIdxs[i] = highDeque[0];

      if (lowDeque.length > 0 && lowDeque[0] <= i - p - 1) lowDeque.shift();
      while (lowDeque.length > 0 && lows[lowDeque[lowDeque.length - 1]] >= lows[i]) lowDeque.pop();
      lowDeque.push(i);
      lowIdxs[i] = lowDeque[0];

      if (i >= p) {
        aroonUp[i] = ((p - (i - highIdxs[i])) / p) * 100;
        aroonDown[i] = ((p - (i - lowIdxs[i])) / p) * 100;
      }
    }
  }
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('aroon-up', 'Up', aroonUp, bars.length, indicator.upColor, 1.6),
      buildLineSeries('aroon-down', 'Down', aroonDown, bars.length, indicator.downColor, 1.6),
    ],
    referenceLines: [50],
    fixedRange: { min: 0, max: 100 },
  };
};

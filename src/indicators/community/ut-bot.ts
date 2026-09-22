import { ATR } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateUTBot(
  bars: OHLCBar[],
  keyValue = 1,
  atrPeriod = 10,
): { trailStop: Array<number | null>; direction: Array<number | null> } {
  const n = bars.length;
  const trailStop: Array<number | null> = new Array(n).fill(null);
  const direction: Array<number | null> = new Array(n).fill(null);
  if (n < atrPeriod) return { trailStop, direction };

  const atrRaw = ATR.calculate({
    high: bars.map((b) => b.high),
    low: bars.map((b) => b.low),
    close: bars.map((b) => b.close),
    period: atrPeriod,
  });
  const atrPadded = padSeries(atrRaw, n);

  let currentStop = bars[0].close;

  for (let i = 0; i < n; i++) {
    const atr = atrPadded[i] ?? (bars[i].high - bars[i].low);
    const nLoss = keyValue * atr;
    const src = bars[i].close;

    if (i === 0) {
      currentStop = src - nLoss;
    } else {
      const prevStop = trailStop[i - 1] ?? currentStop;
      const prevSrc = bars[i - 1].close;

      if (src > prevStop && prevSrc > prevStop) {
        currentStop = Math.max(prevStop, src - nLoss);
      } else if (src < prevStop && prevSrc < prevStop) {
        currentStop = Math.min(prevStop, src + nLoss);
      } else if (src > prevStop) {
        currentStop = src - nLoss;
      } else {
        currentStop = src + nLoss;
      }
    }

    trailStop[i] = currentStop;
    direction[i] = src > currentStop ? 1 : -1;
  }

  return { trailStop, direction };
}

export const buildUT_BOT: IndicatorBuilder<Extract<ChartIndicator, { kind: 'UT_BOT' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const keyValue = indicator.keyValue ?? 1;
  const atrPeriod = indicator.atrPeriod ?? 10;

  const { trailStop } = calculateUTBot(bars, keyValue, atrPeriod);

  return {
    indicator,
    title,
    lines: [buildLineSeries('ut_bot', 'UT Bot', trailStop, bars.length, indicator.color ?? '#26A69A', 2)],
  };
};

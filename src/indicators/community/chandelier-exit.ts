import { ATR } from 'technicalindicators';
import { buildLineSeries, padSeries, slidingWindowMax, slidingWindowMin, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateChandelierExit(
  bars: OHLCBar[],
  atrPeriod = 22,
  atrMult = 3.0,
  useClose = true,
): {
  longStop: Array<number | null>;
  shortStop: Array<number | null>;
  direction: Array<number | null>;
} {
  const n = bars.length;
  const longStop: Array<number | null> = new Array(n).fill(null);
  const shortStop: Array<number | null> = new Array(n).fill(null);
  const direction: Array<number | null> = new Array(n).fill(null);
  if (n < atrPeriod) return { longStop, shortStop, direction };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: atrPeriod });
  const atrPadded = padSeries(atrRaw, n);

  const highSrc = useClose ? closes : highs;
  const lowSrc = useClose ? closes : lows;

  const highestHighs = slidingWindowMax(highSrc, atrPeriod);
  const lowestLows = slidingWindowMin(lowSrc, atrPeriod);

  let currentDir = 1;

  for (let i = atrPeriod - 1; i < n; i++) {
    const atr = atrPadded[i] ?? (highs[i] - lows[i]);
    const hh = highestHighs[i] ?? highs[i];
    const ll = lowestLows[i] ?? lows[i];

    const lStop = hh - atr * atrMult;
    const sStop = ll + atr * atrMult;

    longStop[i] = lStop;
    shortStop[i] = sStop;

    const close = closes[i];
    if (i > atrPeriod - 1) {
      const prevLong = longStop[i - 1] ?? lStop;
      const prevShort = shortStop[i - 1] ?? sStop;

      if (close > prevShort) {
        currentDir = 1;
      } else if (close < prevLong) {
        currentDir = -1;
      }
    }

    direction[i] = currentDir;
  }

  return { longStop, shortStop, direction };
}

export const buildCHANDELIER_EXIT: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CHANDELIER_EXIT' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const atrPeriod = indicator.atrPeriod ?? 22;
  const atrMult = indicator.atrMult ?? 3.0;
  const useClose = indicator.useClose ?? true;

  const { longStop, shortStop } = calculateChandelierExit(bars, atrPeriod, atrMult, useClose);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('long_stop', 'Long Stop', longStop, bars.length, indicator.longColor ?? '#26A69A', 1.8),
      buildLineSeries('short_stop', 'Short Stop', shortStop, bars.length, indicator.shortColor ?? '#EF5350', 1.8),
    ],
  };
};

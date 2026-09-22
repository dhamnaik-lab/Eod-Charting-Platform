import { ATR, SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateHalfTrend(
  bars: OHLCBar[],
  amplitude = 2,
  channelDeviation = 2,
): {
  halfTrend: Array<number | null>;
  atrHigh: Array<number | null>;
  atrLow: Array<number | null>;
  trend: Array<number | null>;
} {
  const n = bars.length;
  const halfTrend: Array<number | null> = new Array(n).fill(null);
  const atrHigh: Array<number | null> = new Array(n).fill(null);
  const atrLow: Array<number | null> = new Array(n).fill(null);
  const trend: Array<number | null> = new Array(n).fill(null);

  if (n < amplitude + 2) return { halfTrend, atrHigh, atrLow, trend };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: 100 });
  const atrPadded = padSeries(atrRaw, n);

  const highmaRaw = SMA.calculate({ values: highs, period: amplitude });
  const lowmaRaw = SMA.calculate({ values: lows, period: amplitude });

  const highmaPadded = padSeries(highmaRaw, n);
  const lowmaPadded = padSeries(lowmaRaw, n);

  let currentTrend = 0;
  let nextTrend = 0;
  let maxLowPrice = bars[0].low;
  let minHighPrice = bars[0].high;
  let up = 0;
  let down = 0;

  for (let i = 0; i < n; i++) {
    const atr2 = (atrPadded[i] ?? (highs[i] - lows[i])) / 2;
    const dev = channelDeviation * atr2;

    const highPrice = highs[i];
    const lowPrice = lows[i];
    const highma = highmaPadded[i] ?? highPrice;
    const lowma = lowmaPadded[i] ?? lowPrice;
    const prevLow = i > 0 ? lows[i - 1] : lows[i];
    const prevHigh = i > 0 ? highs[i - 1] : highs[i];

    if (nextTrend === 1) {
      maxLowPrice = Math.max(lowPrice, maxLowPrice);
      if (highma < maxLowPrice && closes[i] < prevLow) {
        currentTrend = 1;
        nextTrend = 0;
        minHighPrice = highPrice;
      }
    } else {
      minHighPrice = Math.min(highPrice, minHighPrice);
      if (lowma > minHighPrice && closes[i] > prevHigh) {
        currentTrend = 0;
        nextTrend = 1;
        maxLowPrice = lowPrice;
      }
    }

    trend[i] = currentTrend;

    if (currentTrend === 0) {
      up = i === 0 ? maxLowPrice : Math.max(maxLowPrice, up);
      halfTrend[i] = up;
      atrHigh[i] = up + dev;
      atrLow[i] = up - dev;
    } else {
      down = i === 0 ? minHighPrice : Math.min(minHighPrice, down);
      halfTrend[i] = down;
      atrHigh[i] = down + dev;
      atrLow[i] = down - dev;
    }
  }

  return { halfTrend, atrHigh, atrLow, trend };
}

export const buildHALF_TREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'HALF_TREND' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const amplitude = indicator.amplitude ?? 2;
  const dev = indicator.channelDeviation ?? 2;

  const { halfTrend, atrHigh, atrLow } = calculateHalfTrend(bars, amplitude, dev);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('half_trend', 'HalfTrend', halfTrend, bars.length, indicator.color ?? '#2962FF', 2),
      buildLineSeries('atr_high', 'ATR High', atrHigh, bars.length, indicator.atrHighColor ?? '#EF5350', 1, 'dashed'),
      buildLineSeries('atr_low', 'ATR Low', atrLow, bars.length, indicator.atrLowColor ?? '#26A69A', 1, 'dashed'),
    ],
  };
};

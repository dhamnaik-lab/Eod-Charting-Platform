import { ATR } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateFVG(
  bars: OHLCBar[],
  lookback = 30,
  atrMultiplier = 0.25,
): {
  bullAvg: Array<number | null>;
  bearAvg: Array<number | null>;
} {
  const n = bars.length;
  const bullAvg: Array<number | null> = new Array(n).fill(null);
  const bearAvg: Array<number | null> = new Array(n).fill(null);
  if (n < 10) return { bullAvg, bearAvg };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: Math.min(n - 1, 50) });
  const atrPadded = padSeries(atrRaw, n);

  const upFvgs: { barIdx: number; value: number }[] = [];
  const downFvgs: { barIdx: number; value: number }[] = [];

  for (let i = 2; i < n; i++) {
    const atr = (atrPadded[i] ?? (highs[i] - lows[i])) * atrMultiplier;

    const low0 = lows[i];
    const high2 = highs[i - 2];
    const close1 = closes[i - 1];
    const high0 = highs[i];
    const low2 = lows[i - 2];

    if (low0 > high2 && close1 > high2 && low0 - high2 > atr) {
      upFvgs.push({ barIdx: i, value: (low0 + high2) / 2 });
    }

    if (high0 < low2 && close1 < low2 && low2 - high0 > atr) {
      downFvgs.push({ barIdx: i, value: (high0 + low2) / 2 });
    }

    // Filter by lookback
    const recentUp = upFvgs.filter((f) => i - f.barIdx <= lookback);
    const recentDown = downFvgs.filter((f) => i - f.barIdx <= lookback);

    if (recentUp.length > 0) {
      bullAvg[i] = recentUp.reduce((s, f) => s + f.value, 0) / recentUp.length;
    }
    if (recentDown.length > 0) {
      bearAvg[i] = recentDown.reduce((s, f) => s + f.value, 0) / recentDown.length;
    }
  }

  return { bullAvg, bearAvg };
}

export const buildFVG: IndicatorBuilder<Extract<ChartIndicator, { kind: 'FVG' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const lookback = indicator.lookback ?? 30;
  const mult = indicator.atrMultiplier ?? 0.25;

  const { bullAvg, bearAvg } = calculateFVG(bars, lookback, mult);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('bull_avg', 'Bull FVG Avg', bullAvg, bars.length, indicator.bullColor ?? '#089981', 2),
      buildLineSeries('bear_avg', 'Bear FVG Avg', bearAvg, bars.length, indicator.bearColor ?? '#F23645', 2),
    ],
  };
};

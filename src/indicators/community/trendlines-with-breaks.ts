import { ATR } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateTrendlinesWithBreaks(
  bars: OHLCBar[],
  length = 14,
  mult = 1.0,
): {
  upperLine: Array<number | null>;
  lowerLine: Array<number | null>;
} {
  const n = bars.length;
  const upperLine: Array<number | null> = new Array(n).fill(null);
  const lowerLine: Array<number | null> = new Array(n).fill(null);
  if (n < length * 2) return { upperLine, lowerLine };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: length });
  const atrPadded = padSeries(atrRaw, n);

  let curUpper: number | null = null;
  let curLower: number | null = null;
  let slopeUpper = 0;
  let slopeLower = 0;

  for (let i = length; i < n; i++) {
    const atr = atrPadded[i] ?? (highs[i] - lows[i]);
    const slope = (atr / length) * mult;

    // Check pivot high at i - length
    const pIdx = i - length;
    if (pIdx >= length) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= length; j++) {
        if (highs[pIdx] <= highs[pIdx - j] || highs[pIdx] <= highs[pIdx + j]) isHigh = false;
        if (lows[pIdx] >= lows[pIdx - j] || lows[pIdx] >= lows[pIdx + j]) isLow = false;
      }
      if (isHigh) {
        curUpper = highs[pIdx];
        slopeUpper = slope;
      }
      if (isLow) {
        curLower = lows[pIdx];
        slopeLower = slope;
      }
    }

    if (curUpper !== null) {
      curUpper -= slopeUpper;
      if (closes[i] > curUpper) curUpper = null;
    }
    if (curLower !== null) {
      curLower += slopeLower;
      if (closes[i] < curLower) curLower = null;
    }

    upperLine[i] = curUpper;
    lowerLine[i] = curLower;
  }

  return { upperLine, lowerLine };
}

export const buildTRENDLINES_BREAKS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TRENDLINES_BREAKS' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.length ?? 14;
  const mult = indicator.mult ?? 1.0;

  const { upperLine, lowerLine } = calculateTrendlinesWithBreaks(bars, length, mult);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('upper', 'Upper Trendline', upperLine, bars.length, indicator.upperColor ?? '#26A69A', 1.8),
      buildLineSeries('lower', 'Lower Trendline', lowerLine, bars.length, indicator.lowerColor ?? '#EF5350', 1.8),
    ],
  };
};

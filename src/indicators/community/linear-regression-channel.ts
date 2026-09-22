import { buildLineSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateLinRegChannel(
  bars: OHLCBar[],
  length = 100,
): {
  linregHigh: Array<number | null>;
  linregLow: Array<number | null>;
  upperBand: Array<number | null>;
  lowerBand: Array<number | null>;
  middleBand: Array<number | null>;
} {
  const n = bars.length;
  const linregHigh: Array<number | null> = new Array(n).fill(null);
  const linregLow: Array<number | null> = new Array(n).fill(null);
  const upperBand: Array<number | null> = new Array(n).fill(null);
  const lowerBand: Array<number | null> = new Array(n).fill(null);
  const middleBand: Array<number | null> = new Array(n).fill(null);
  if (n < length) return { linregHigh, linregLow, upperBand, lowerBand, middleBand };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  for (let i = length - 1; i < n; i++) {
    let sumX = 0;
    let sumYHigh = 0;
    let sumYLow = 0;
    let sumXYHigh = 0;
    let sumXYLow = 0;
    let sumX2 = 0;

    for (let j = 0; j < length; j++) {
      const x = j;
      const yh = highs[i - length + 1 + j];
      const yl = lows[i - length + 1 + j];
      sumX += x;
      sumYHigh += yh;
      sumYLow += yl;
      sumXYHigh += x * yh;
      sumXYLow += x * yl;
      sumX2 += x * x;
    }

    const len = length;
    const slopeH = (len * sumXYHigh - sumX * sumYHigh) / (len * sumX2 - sumX * sumX);
    const interceptH = (sumYHigh - slopeH * sumX) / len;
    const regH = interceptH + slopeH * (len - 1);

    const slopeL = (len * sumXYLow - sumX * sumYLow) / (len * sumX2 - sumX * sumX);
    const interceptL = (sumYLow - slopeL * sumX) / len;
    const regL = interceptL + slopeL * (len - 1);

    // StDev
    let meanH = sumYHigh / len;
    let varH = 0;
    for (let j = 0; j < length; j++) varH += Math.pow(highs[i - length + 1 + j] - meanH, 2);
    const devH = Math.sqrt(varH / len);

    let meanL = sumYLow / len;
    let varL = 0;
    for (let j = 0; j < length; j++) varL += Math.pow(lows[i - length + 1 + j] - meanL, 2);
    const devL = Math.sqrt(varL / len);

    linregHigh[i] = regH;
    linregLow[i] = regL;
    upperBand[i] = regH + devH;
    lowerBand[i] = regL - devL;
    middleBand[i] = (upperBand[i]! + lowerBand[i]!) / 2;
  }

  return { linregHigh, linregLow, upperBand, lowerBand, middleBand };
}

export const buildLINREG_CHANNEL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'LINREG_CHANNEL' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.length ?? 100;

  const { upperBand, lowerBand, middleBand } = calculateLinRegChannel(bars, length);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('upper', 'Upper Band', upperBand, bars.length, indicator.upperColor ?? '#EF5350', 1.8),
      buildLineSeries('middle', 'Regression Middle', middleBand, bars.length, indicator.middleColor ?? '#2962FF', 1.4, 'dashed'),
      buildLineSeries('lower', 'Lower Band', lowerBand, bars.length, indicator.lowerColor ?? '#26A69A', 1.8),
    ],
  };
};

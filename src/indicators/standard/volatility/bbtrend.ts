import { SD, SMA } from 'technicalindicators';
import { getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateBBTrend(
  closes: number[],
  shortLength = 20,
  longLength = 50,
  stdDevMultiplier = 2.0,
): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < longLength) return result;

  const sSMARaw = SMA.calculate({ values: closes, period: shortLength });
  const sSDRaw = SD.calculate({ values: closes, period: shortLength });
  const lSMARaw = SMA.calculate({ values: closes, period: longLength });
  const lSDRaw = SD.calculate({ values: closes, period: longLength });

  const sSMA = padSeries(sSMARaw, total);
  const sSD = padSeries(sSDRaw, total);
  const lSMA = padSeries(lSMARaw, total);
  const lSD = padSeries(lSDRaw, total);

  for (let i = longLength - 1; i < total; i++) {
    const sm = sSMA[i];
    const ssd = sSD[i];
    const lm = lSMA[i];
    const lsd = lSD[i];

    if (sm !== null && ssd !== null && lm !== null && lsd !== null && sm !== 0) {
      const sUpper = sm + ssd * stdDevMultiplier;
      const sLower = sm - ssd * stdDevMultiplier;
      const lUpper = lm + lsd * stdDevMultiplier;
      const lLower = lm - lsd * stdDevMultiplier;

      const diffLower = Math.abs(sLower - lLower);
      const diffUpper = Math.abs(sUpper - lUpper);

      result[i] = ((diffLower - diffUpper) / sm) * 100;
    }
  }

  return result;
}

export const buildBBTREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'BBTREND' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const shortLen = indicator.shortPeriod ?? 20;
  const longLen = indicator.longPeriod ?? 50;
  const stdDev = indicator.stdDev ?? 2.0;

  const values = calculateBBTrend(srcValues, shortLen, longLen, stdDev);

  const posColor = indicator.positiveColor ?? '#089981';
  const negColor = indicator.negativeColor ?? '#F23645';

  const colorValues: Array<string | null> = values.map((val, i) => {
    if (val === null) return null;
    const prev = i > 0 ? values[i - 1] : null;
    if (val >= 0) {
      return prev !== null && val >= prev ? posColor : '#08998180';
    } else {
      return prev !== null && val <= prev ? negColor : '#F2364580';
    }
  });

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'bbtrend-hist',
      label: 'BBTrend',
      values,
      positiveColor: posColor,
      negativeColor: negColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

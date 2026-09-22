import { SMA } from 'technicalindicators';
import { padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateAO(highs: number[], lows: number[], fastPeriod = 5, slowPeriod = 34): Array<number | null> {
  const total = highs.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < slowPeriod) return result;

  const hl2: number[] = new Array(total).fill(0);
  for (let i = 0; i < total; i++) {
    hl2[i] = (highs[i] + lows[i]) / 2;
  }

  const fastSMA = SMA.calculate({ values: hl2, period: fastPeriod });
  const slowSMA = SMA.calculate({ values: hl2, period: slowPeriod });

  const fastPadded = padSeries(fastSMA, total);
  const slowPadded = padSeries(slowSMA, total);

  for (let i = slowPeriod - 1; i < total; i++) {
    const f = fastPadded[i];
    const s = slowPadded[i];
    if (f !== null && s !== null) {
      result[i] = f - s;
    }
  }

  return result;
}

export const buildAO: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AO' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fastPeriod = indicator.fastPeriod ?? 5;
  const slowPeriod = indicator.slowPeriod ?? 34;
  const values = calculateAO(highs, lows, fastPeriod, slowPeriod);

  const posColor = indicator.positiveColor ?? '#009688';
  const negColor = indicator.negativeColor ?? '#F44336';

  const colorValues: Array<string | null> = values.map((val, i) => {
    if (val === null) return null;
    const prev = i > 0 ? values[i - 1] : null;
    if (prev !== null && val < prev) return negColor;
    return posColor;
  });

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'ao-hist',
      label: 'AO',
      values,
      positiveColor: posColor,
      negativeColor: negColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

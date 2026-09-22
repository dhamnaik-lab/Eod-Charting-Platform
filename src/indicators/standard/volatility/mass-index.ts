import { EMA } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildMASS_INDEX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MASS_INDEX' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const ep = indicator.emaPeriod;
  const sp = indicator.sumPeriod;
  const diff = highs.map((h, i) => h - lows[i]);
  const ema1 = EMA.calculate({ values: diff, period: ep });
  const ema2 = EMA.calculate({ values: ema1, period: ep });
  const ratio: number[] = [];
  const offset = ep * 2 - 2;
  for (let i = 0; i < ema2.length; i++) {
    ratio.push(ema1[ep - 1 + i] / ema2[i]);
  }
  const mass: Array<number | null> = new Array(bars.length).fill(null);
  if (ratio.length >= sp) {
    let sum = 0;
    for (let i = 0; i < sp; i++) sum += ratio[i];
    for (let i = sp - 1; i < ratio.length; i++) {
      mass[offset + i] = sum;
      if (i + 1 < ratio.length) {
        sum = sum - ratio[i - sp + 1] + ratio[i + 1];
      }
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('mass', title, mass, bars.length, indicator.color, 1.8)],
    referenceLines: [26.5, 27],
  };
};

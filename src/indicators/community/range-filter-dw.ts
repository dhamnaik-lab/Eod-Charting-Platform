import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateRangeFilterDW(
  bars: OHLCBar[],
  period = 50,
  mult = 3.0,
): {
  filter: Array<number | null>;
  upperBand: Array<number | null>;
  lowerBand: Array<number | null>;
  direction: Array<number | null>;
} {
  const n = bars.length;
  const filter: Array<number | null> = new Array(n).fill(null);
  const upperBand: Array<number | null> = new Array(n).fill(null);
  const lowerBand: Array<number | null> = new Array(n).fill(null);
  const direction: Array<number | null> = new Array(n).fill(null);
  if (n < period) return { filter, upperBand, lowerBand, direction };

  const closes = bars.map((b) => b.close);

  const absDiff: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    absDiff[i] = Math.abs(closes[i] - closes[i - 1]);
  }

  const smoothRangeRaw = EMA.calculate({ values: absDiff, period });
  const smoothRangePadded = padSeries(smoothRangeRaw, n);

  let curFilter = closes[0];
  let curDir = 1;

  for (let i = 0; i < n; i++) {
    const sr = (smoothRangePadded[i] ?? 0) * mult;
    const s = closes[i];

    if (i === 0) {
      curFilter = s;
    } else {
      const prevFilter = filter[i - 1] ?? curFilter;
      if (s > prevFilter) {
        curFilter = Math.max(prevFilter, s - sr);
      } else if (s < prevFilter) {
        curFilter = Math.min(prevFilter, s + sr);
      } else {
        curFilter = prevFilter;
      }
      curDir = curFilter > prevFilter ? 1 : curFilter < prevFilter ? -1 : (direction[i - 1] ?? 1);
    }

    if (i >= period) {
      filter[i] = curFilter;
      upperBand[i] = curFilter + sr;
      lowerBand[i] = curFilter - sr;
      direction[i] = curDir;
    }
  }

  return { filter, upperBand, lowerBand, direction };
}

export const buildRANGE_FILTER_DW: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RANGE_FILTER_DW' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 50;
  const mult = indicator.mult ?? 3.0;

  const { filter, upperBand, lowerBand } = calculateRangeFilterDW(bars, period, mult);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('filter', 'Range Filter', filter, bars.length, indicator.color ?? '#2962FF', 2),
      buildLineSeries('upper', 'Upper Band', upperBand, bars.length, indicator.upperColor ?? '#26A69A', 1.2, 'dashed'),
      buildLineSeries('lower', 'Lower Band', lowerBand, bars.length, indicator.lowerColor ?? '#EF5350', 1.2, 'dashed'),
    ],
  };
};

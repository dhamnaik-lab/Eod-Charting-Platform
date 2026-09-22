import { SMA } from 'technicalindicators';
import { padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateRVOL(volumes: number[], period = 20): Array<number | null> {
  const total = volumes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < period) return result;

  const smaRaw = SMA.calculate({ values: volumes, period });
  const smaPadded = padSeries(smaRaw, total);

  for (let i = period - 1; i < total; i++) {
    const avg = smaPadded[i];
    const curr = volumes[i] ?? 0;
    if (avg !== null && avg > 0) {
      result[i] = curr / avg;
    }
  }

  return result;
}

export const buildRVOL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RVOL' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;
  const values = calculateRVOL(sources.volumes, period);

  const color = indicator.color ?? '#2962FF';
  const colorValues: Array<string | null> = values.map((val) => {
    if (val === null) return null;
    return val >= 1.5 ? '#FF6D00' : val >= 1.0 ? '#26A69A' : color;
  });

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'rvol_hist',
      label: 'RVOL',
      values,
      positiveColor: '#26A69A',
      negativeColor: '#EF5350',
      colorValues,
    },
    referenceLines: [1.0, 2.0],
  };
};

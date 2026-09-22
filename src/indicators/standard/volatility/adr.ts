import { SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateADR(highs: number[], lows: number[], period = 14): Array<number | null> {
  const total = highs.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < period) return result;

  const ranges = highs.map((h, i) => h - lows[i]);
  const smaRaw = SMA.calculate({ values: ranges, period });
  const smaPadded = padSeries(smaRaw, total);

  for (let i = period - 1; i < total; i++) {
    result[i] = smaPadded[i];
  }

  return result;
}

export const buildADR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ADR' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 14;
  const values = calculateADR(highs, lows, period);

  return {
    indicator,
    title,
    lines: [buildLineSeries('adr', 'ADR', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
  };
};

import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculatePVT(closes: number[], volumes: number[]): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (!total) return result;

  let cum = 0;
  result[0] = cum;

  for (let i = 1; i < total; i++) {
    const prev = closes[i - 1];
    const vol = volumes[i] ?? 0;
    if (prev !== 0) {
      cum += ((closes[i] - prev) / prev) * vol;
    }
    result[i] = cum;
  }

  return result;
}

export const buildPVT: IndicatorBuilder<Extract<ChartIndicator, { kind: 'PVT' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculatePVT(sources.closes, sources.volumes);

  return {
    indicator,
    title,
    lines: [buildLineSeries('pvt', 'PVT', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
  };
};

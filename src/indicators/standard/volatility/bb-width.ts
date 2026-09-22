import { BollingerBands } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateBBWidth(
  closes: number[],
  period = 20,
  stdDev = 2.0,
): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < period) return result;

  const raw = BollingerBands.calculate({ values: closes, period, stdDev });

  for (let i = period - 1; i < total; i++) {
    const band = raw[i - (period - 1)];
    if (band && band.middle !== 0) {
      result[i] = ((band.upper - band.lower) / band.middle) * 100;
    }
  }

  return result;
}

export const buildBB_WIDTH: IndicatorBuilder<Extract<ChartIndicator, { kind: 'BB_WIDTH' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;
  const stdDev = indicator.stdDev ?? 2.0;

  const values = calculateBBWidth(sources.closes, period, stdDev);

  return {
    indicator,
    title,
    lines: [buildLineSeries('bb_width', 'BB Width', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
  };
};

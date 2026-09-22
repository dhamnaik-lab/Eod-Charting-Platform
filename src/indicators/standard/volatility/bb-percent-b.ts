import { BollingerBands } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateBBPctB(
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
    if (band && band.upper !== band.lower) {
      result[i] = (closes[i] - band.lower) / (band.upper - band.lower);
    }
  }

  return result;
}

export const buildBB_PCT_B: IndicatorBuilder<Extract<ChartIndicator, { kind: 'BB_PCT_B' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;
  const stdDev = indicator.stdDev ?? 2.0;

  const values = calculateBBPctB(sources.closes, period, stdDev);

  return {
    indicator,
    title,
    lines: [buildLineSeries('bb_pct_b', 'BB %B', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
    referenceLines: [0, 0.5, 1],
  };
};

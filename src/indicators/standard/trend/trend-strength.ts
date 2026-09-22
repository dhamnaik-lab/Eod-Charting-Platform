import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateTrendStrength(closes: number[], length = 14): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < length) return result;

  for (let i = length - 1; i < total; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let j = 0; j < length; j++) {
      const x = j;
      const y = closes[i - length + 1 + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const n = length;
    const numerator = n * sumXY - sumX * sumY;
    const denomX = n * sumX2 - sumX * sumX;
    const denomY = n * sumY2 - sumY * sumY;
    const denominator = Math.sqrt(denomX * denomY);

    if (denominator !== 0) {
      result[i] = Math.max(-1, Math.min(1, numerator / denominator));
    }
  }

  return result;
}

export const buildTREND_STRENGTH: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TREND_STRENGTH' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.period ?? 14;
  const values = calculateTrendStrength(sources.closes, length);

  return {
    indicator,
    title,
    lines: [buildLineSeries('trend_strength', 'TSI (Trend)', values, bars.length, indicator.color ?? '#7E57C2', 1.8)],
    referenceLines: [-1, 0, 1],
  };
};

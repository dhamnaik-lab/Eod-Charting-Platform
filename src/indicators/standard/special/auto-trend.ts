import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateAutoTrend(
  bars: OHLCBar[],
  pivotLength = 10,
): {
  resistanceLine: Array<number | null>;
  supportLine: Array<number | null>;
} {
  const n = bars.length;
  const resLine: Array<number | null> = new Array(n).fill(null);
  const supLine: Array<number | null> = new Array(n).fill(null);
  if (n < pivotLength * 2 + 2) return { resistanceLine: resLine, supportLine: supLine };

  const highPivots: Array<{ index: number; price: number }> = [];
  const lowPivots: Array<{ index: number; price: number }> = [];

  for (let i = pivotLength; i < n - pivotLength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= pivotLength; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highPivots.push({ index: i, price: bars[i].high });
    if (isLow) lowPivots.push({ index: i, price: bars[i].low });
  }

  if (highPivots.length >= 2) {
    const a = highPivots[highPivots.length - 2];
    const b = highPivots[highPivots.length - 1];
    const slope = (b.price - a.price) / (b.index - a.index);
    for (let i = a.index; i < n; i++) {
      resLine[i] = a.price + slope * (i - a.index);
    }
  }

  if (lowPivots.length >= 2) {
    const a = lowPivots[lowPivots.length - 2];
    const b = lowPivots[lowPivots.length - 1];
    const slope = (b.price - a.price) / (b.index - a.index);
    for (let i = a.index; i < n; i++) {
      supLine[i] = a.price + slope * (i - a.index);
    }
  }

  return { resistanceLine: resLine, supportLine: supLine };
}

export const buildAUTO_TREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AUTO_TREND' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const pivotLength = indicator.pivotLength ?? 10;
  const resColor = indicator.resistanceColor ?? '#F23645';
  const supColor = indicator.supportColor ?? '#089981';

  const { resistanceLine, supportLine } = calculateAutoTrend(bars, pivotLength);

  const lines = [
    buildLineSeries('res_trend', 'Resistance Trend', resistanceLine, bars.length, resColor, 1.8),
    buildLineSeries('sup_trend', 'Support Trend', supportLine, bars.length, supColor, 1.8),
  ];

  return {
    indicator,
    title,
    lines,
  };
};

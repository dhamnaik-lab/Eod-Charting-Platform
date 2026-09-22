import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateAutoKeyLevels(
  bars: OHLCBar[],
  pivotLength = 20,
  maxLevels = 6,
): { levels: Array<{ price: number; kind: 'high' | 'low'; barIndex: number }> } {
  const n = bars.length;
  const pivots: Array<{ price: number; kind: 'high' | 'low'; barIndex: number }> = [];

  for (let i = pivotLength; i < n - pivotLength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= pivotLength; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ barIndex: i, price: bars[i].high, kind: 'high' });
    if (isLow) pivots.push({ barIndex: i, price: bars[i].low, kind: 'low' });
  }

  const kept = pivots.slice(-maxLevels);
  return { levels: kept };
}

export const buildAUTO_KEY_LEVELS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AUTO_KEY_LEVELS' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const pivotLength = indicator.pivotLength ?? 20;
  const maxLevels = indicator.maxLevels ?? 6;
  const resColor = indicator.resistanceColor ?? '#F23645';
  const supColor = indicator.supportColor ?? '#089981';

  const { levels } = calculateAutoKeyLevels(bars, pivotLength, maxLevels);

  const lines = levels.map((lvl, idx) => {
    const series: Array<number | null> = new Array(bars.length).fill(null);
    for (let i = lvl.barIndex; i < bars.length; i++) {
      series[i] = lvl.price;
    }
    const color = lvl.kind === 'high' ? resColor : supColor;
    return buildLineSeries(`lvl_${idx}`, `${lvl.kind === 'high' ? 'Res' : 'Sup'} ${lvl.price.toFixed(2)}`, series, bars.length, color, 1.2, 'dashed');
  });

  return {
    indicator,
    title,
    lines,
  };
};

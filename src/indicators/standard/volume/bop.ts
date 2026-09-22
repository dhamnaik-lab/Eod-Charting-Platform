import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildBOP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'BOP' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const hl = highs[i] - lows[i];
    values[i] = hl === 0 ? 0 : (closes[i] - bars[i].open) / hl;
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('bop', title, values, bars.length, indicator.color, 1.6)],
    referenceLines: [0],
    fixedRange: { min: -1, max: 1 },
  };
};

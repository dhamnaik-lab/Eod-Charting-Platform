import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCPR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CPR' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const pivot: Array<number | null> = new Array(bars.length).fill(null);
  const tc: Array<number | null> = new Array(bars.length).fill(null);
  const bc: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const p = (prev.high + prev.low + prev.close) / 3;
    const b = (prev.high + prev.low) / 2;
    const t = p - b + p;
    pivot[i] = p;
    tc[i] = Math.max(t, b);
    bc[i] = Math.min(t, b);
  }
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('pivot', 'Pivot', pivot, bars.length, indicator.pivotColor ?? '#00b4d8', 1.8),
      buildLineSeries('tc', 'TC', tc, bars.length, indicator.tcColor ?? '#26a69a', 1.4, 'dashed'),
      buildLineSeries('bc', 'BC', bc, bars.length, indicator.bcColor ?? '#ef5350', 1.4, 'dashed'),
    ],
  };
};

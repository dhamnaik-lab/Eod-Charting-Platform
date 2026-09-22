import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateMcGinley(values: number[], period: number, kFactor = 0.6): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (!values.length || period <= 0) return result;

  let prevMD = values[0];
  result[0] = prevMD;

  for (let i = 1; i < values.length; i++) {
    const src = values[i];
    if (prevMD === 0) {
      prevMD = src;
      result[i] = prevMD;
      continue;
    }
    const ratio = src / prevMD;
    const k = period * Math.pow(ratio, 4);
    const md = prevMD + (src - prevMD) / (k || 1);
    result[i] = md;
    prevMD = md;
  }

  return result;
}

export const buildMCGINLEY: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MCGINLEY' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculateMcGinley(srcValues, indicator.period, indicator.k ?? 0.6);
  return {
    indicator,
    title,
    lines: [buildLineSeries('mcginley', title, values, bars.length, indicator.color, 1.8)],
  };
};

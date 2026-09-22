import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateCVD(bars: OHLCBar[]): Array<number | null> {
  const total = bars.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (!total) return result;

  let cum = 0;
  for (let i = 0; i < total; i++) {
    const bar = bars[i];
    const vol = bar.volume ?? 0;
    let delta = 0;
    if (bar.close > bar.open) {
      delta = vol;
    } else if (bar.close < bar.open) {
      delta = -vol;
    }
    cum += delta;
    result[i] = cum;
  }

  return result;
}

export const buildCVD: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CVD' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculateCVD(bars);

  const posColor = indicator.positiveColor ?? '#26A69A';
  const negColor = indicator.negativeColor ?? '#EF5350';

  const colorValues: Array<string | null> = values.map((val) => {
    if (val === null) return null;
    return val >= 0 ? posColor : negColor;
  });

  return {
    indicator,
    title,
    lines: [buildLineSeries('cvd_line', 'CVD', values, bars.length, '#2962FF', 1.8)],
    histogram: {
      key: 'cvd_hist',
      label: 'CVD Histogram',
      values,
      positiveColor: posColor,
      negativeColor: negColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

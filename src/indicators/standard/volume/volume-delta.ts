import { type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateVolumeDelta(bars: OHLCBar[]): Array<number | null> {
  const total = bars.length;
  const result: Array<number | null> = new Array(total).fill(null);
  for (let i = 0; i < total; i++) {
    const bar = bars[i];
    const vol = bar.volume ?? 0;
    if (bar.close > bar.open) {
      result[i] = vol;
    } else if (bar.close < bar.open) {
      result[i] = -vol;
    } else {
      result[i] = 0;
    }
  }
  return result;
}

export const buildVOLUME_DELTA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VOLUME_DELTA' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculateVolumeDelta(bars);

  const posColor = indicator.positiveColor ?? '#26A69A';
  const negColor = indicator.negativeColor ?? '#EF5350';

  const colorValues: Array<string | null> = values.map((val) => {
    if (val === null) return null;
    return val >= 0 ? posColor : negColor;
  });

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'vol_delta_hist',
      label: 'Volume Delta',
      values,
      positiveColor: posColor,
      negativeColor: negColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

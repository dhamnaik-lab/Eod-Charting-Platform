import { EMA } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildFORCE_INDEX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'FORCE_INDEX' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { closes, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const fiRaw: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    fiRaw.push((closes[i] - closes[i - 1]) * volumes[i]);
  }
  const values = EMA.calculate({ values: fiRaw, period });
  return {
    indicator,
    title,
    lines: [buildLineSeries('fi', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [0],
  };
};

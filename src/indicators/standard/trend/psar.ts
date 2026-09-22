import { PSAR } from 'technicalindicators';
import { padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildPSAR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'PSAR' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [],
    points: {
      values: padSeries(
        PSAR.calculate({
          high: highs,
          low: lows,
          step: indicator.step,
          max: indicator.max,
        }).map((v) => v ?? null),
        bars.length,
      ),
      color: indicator.color,
      radius: 1.8,
    },
  };
};

import { OBV } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildOBV: IndicatorBuilder<Extract<ChartIndicator, { kind: 'OBV' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { closes, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('obv', title, OBV.calculate({ close: closes, volume: volumes }), bars.length, indicator.color, 1.8),
    ],
  };
};

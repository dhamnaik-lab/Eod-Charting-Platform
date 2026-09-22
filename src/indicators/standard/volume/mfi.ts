import { MFI } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildMFI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MFI' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [
      buildLineSeries(
        'mfi',
        title,
        MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: indicator.period }),
        bars.length,
        indicator.color,
        1.8,
      ),
    ],
    referenceLines: [20, 80],
    fixedRange: { min: 0, max: 100 },
  };
};

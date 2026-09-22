import { EMA } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildELDER_RAY: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ELDER_RAY' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const ema = EMA.calculate({ values: closes, period: indicator.period });
  const bullPower: Array<number | null> = new Array(bars.length).fill(null);
  const bearPower: Array<number | null> = new Array(bars.length).fill(null);
  const offset = indicator.period - 1;
  for (let i = offset; i < bars.length; i++) {
    const m = ema[i - offset];
    if (m !== undefined) {
      bullPower[i] = highs[i] - m;
      bearPower[i] = lows[i] - m;
    }
  }
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('bull', 'Bull Power', bullPower, bars.length, indicator.bullColor, 1.4),
      buildLineSeries('bear', 'Bear Power', bearPower, bars.length, indicator.bearColor, 1.4),
    ],
    referenceLines: [0],
  };
};

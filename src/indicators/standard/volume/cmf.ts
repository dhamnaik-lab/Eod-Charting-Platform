import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCMF: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CMF' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const mfv = new Float32Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const hl = bar.high - bar.low;
    if (hl !== 0) {
      const mfm = (bar.close - bar.low - (bar.high - bar.close)) / hl;
      mfv[i] = mfm * bar.volume;
    }
  }
  const cmfValues: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length >= period) {
    let sumMFV = 0;
    let sumVol = 0;
    for (let i = 0; i < period; i++) {
      sumMFV += mfv[i];
      sumVol += volumes[i];
    }
    for (let i = period - 1; i < bars.length; i++) {
      cmfValues[i] = sumVol > 0 ? sumMFV / sumVol : 0;
      if (i + 1 < bars.length) {
        sumMFV = sumMFV - mfv[i - period + 1] + mfv[i + 1];
        sumVol = sumVol - volumes[i - period + 1] + volumes[i + 1];
      }
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('cmf', title, cmfValues, bars.length, indicator.color, 1.8)],
    referenceLines: [0, 0.1, -0.1],
    fixedRange: { min: -1, max: 1 },
  };
};

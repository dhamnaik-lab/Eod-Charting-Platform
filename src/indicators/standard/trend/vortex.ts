import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildVORTEX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VORTEX' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const p = indicator.period;
  const vPlus: Array<number | null> = new Array(bars.length).fill(null);
  const vMinus: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length > p) {
    const tr = new Float32Array(bars.length);
    const vmPlus = new Float32Array(bars.length);
    const vmMinus = new Float32Array(bars.length);
    for (let i = 1; i < bars.length; i++) {
      tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
      vmPlus[i] = Math.abs(highs[i] - lows[i - 1]);
      vmMinus[i] = Math.abs(lows[i] - highs[i - 1]);
    }

    let sumTR = 0,
      sumVP = 0,
      sumVM = 0;
    for (let i = 1; i <= p; i++) {
      sumTR += tr[i];
      sumVP += vmPlus[i];
      sumVM += vmMinus[i];
    }

    for (let i = p; i < bars.length; i++) {
      if (sumTR > 0) {
        vPlus[i] = sumVP / sumTR;
        vMinus[i] = sumVM / sumTR;
      }
      if (i + 1 < bars.length) {
        sumTR = sumTR - tr[i - p + 1] + tr[i + 1];
        sumVP = sumVP - vmPlus[i - p + 1] + vmPlus[i + 1];
        sumVM = sumVM - vmMinus[i - p + 1] + vmMinus[i + 1];
      }
    }
  }
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('vplus', 'VI+', vPlus, bars.length, indicator.plusColor, 1.6),
      buildLineSeries('vminus', 'VI-', vMinus, bars.length, indicator.minusColor, 1.6),
    ],
    referenceLines: [1],
  };
};

import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildULTIMATE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ULTIMATE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const { shortPeriod, medPeriod, longPeriod } = indicator;
  const values: Array<number | null> = new Array(bars.length).fill(null);
  const maxPeriod = Math.max(shortPeriod, medPeriod, longPeriod);

  if (bars.length > maxPeriod) {
    const bp = new Float32Array(bars.length);
    const tr = new Float32Array(bars.length);
    for (let i = 1; i < bars.length; i++) {
      const minLPC = Math.min(lows[i], closes[i - 1]);
      const maxHPC = Math.max(highs[i], closes[i - 1]);
      bp[i] = closes[i] - minLPC;
      tr[i] = maxHPC - minLPC;
    }

    const getSums = (p: number) => {
      const sumBP = new Float32Array(bars.length);
      const sumTR = new Float32Array(bars.length);
      let sBP = 0, sTR = 0;
      for (let i = 1; i <= p; i++) {
        sBP += bp[i];
        sTR += tr[i];
      }
      for (let i = p; i < bars.length; i++) {
        sumBP[i] = sBP;
        sumTR[i] = sTR;
        if (i + 1 < bars.length) {
          sBP = sBP - bp[i - p + 1] + bp[i + 1];
          sTR = sTR - tr[i - p + 1] + tr[i + 1];
        }
      }
      return { sumBP, sumTR };
    };

    const s1 = getSums(shortPeriod);
    const s2 = getSums(medPeriod);
    const s3 = getSums(longPeriod);

    for (let i = maxPeriod; i < bars.length; i++) {
      const a1 = s1.sumTR[i] === 0 ? 0 : s1.sumBP[i] / s1.sumTR[i];
      const a2 = s2.sumTR[i] === 0 ? 0 : s2.sumBP[i] / s2.sumTR[i];
      const a3 = s3.sumTR[i] === 0 ? 0 : s3.sumBP[i] / s3.sumTR[i];
      values[i] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('ultimate', title, values, bars.length, indicator.color, 1.8)],
    referenceLines: [30, 50, 70],
    fixedRange: { min: 0, max: 100 },
  };
};

import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateChaikinOscillator(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  fast = 3,
  slow = 10,
): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < slow) return result;

  const adl: number[] = [];
  let cumAD = 0;

  for (let i = 0; i < total; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] ?? 0;

    if (h === l) {
      adl.push(cumAD);
    } else {
      const clv = (c - l - (h - c)) / (h - l);
      cumAD += clv * v;
      adl.push(cumAD);
    }
  }

  const fastRaw = EMA.calculate({ values: adl, period: fast });
  const slowRaw = EMA.calculate({ values: adl, period: slow });

  const fastPadded = padSeries(fastRaw, total);
  const slowPadded = padSeries(slowRaw, total);

  for (let i = slow - 1; i < total; i++) {
    const f = fastPadded[i];
    const s = slowPadded[i];
    if (f !== null && s !== null) {
      result[i] = f - s;
    }
  }

  return result;
}

export const buildCHAIKIN_OSC: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CHAIKIN_OSC' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fast = indicator.fastPeriod ?? 3;
  const slow = indicator.slowPeriod ?? 10;

  const values = calculateChaikinOscillator(highs, lows, closes, volumes, fast, slow);

  return {
    indicator,
    title,
    lines: [buildLineSeries('chaikin_osc', 'Chaikin Osc', values, bars.length, indicator.color ?? '#EC407A', 1.8)],
    referenceLines: [0],
  };
};

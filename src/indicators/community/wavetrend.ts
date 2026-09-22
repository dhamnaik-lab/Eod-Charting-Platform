import { EMA, SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateWaveTrend(
  highs: number[],
  lows: number[],
  closes: number[],
  channelLength = 10,
  averageLength = 21,
): {
  wt1: Array<number | null>;
  wt2: Array<number | null>;
  diff: Array<number | null>;
} {
  const n = closes.length;
  const wt1: Array<number | null> = new Array(n).fill(null);
  const wt2: Array<number | null> = new Array(n).fill(null);
  const diff: Array<number | null> = new Array(n).fill(null);

  const warmup = channelLength + averageLength + 4;
  if (n < warmup) return { wt1, wt2, diff };

  const ap = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);

  const esaRaw = EMA.calculate({ values: ap, period: channelLength });
  const esaPadded = padSeries(esaRaw, n);

  const absDev: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const esa = esaPadded[i] ?? ap[i];
    absDev[i] = Math.abs(ap[i] - esa);
  }

  const dRaw = EMA.calculate({ values: absDev, period: channelLength });
  const dPadded = padSeries(dRaw, n);

  const ci: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const esa = esaPadded[i] ?? ap[i];
    const d = dPadded[i] ?? 0;
    const denom = 0.015 * d;
    ci[i] = denom !== 0 ? (ap[i] - esa) / denom : 0;
  }

  const wt1Raw = EMA.calculate({ values: ci, period: averageLength });
  const wt1Padded = padSeries(wt1Raw, n);

  const validWt1: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = wt1Padded[i];
    wt1[i] = val;
    if (val !== null) validWt1.push(val);
  }

  if (validWt1.length >= 4) {
    const wt2Raw = SMA.calculate({ values: validWt1, period: 4 });
    const wt2Padded = padSeries(wt2Raw, n);
    for (let i = 0; i < n; i++) {
      const w2 = wt2Padded[i];
      wt2[i] = w2;
      const w1 = wt1[i];
      if (w1 !== null && w2 !== null) {
        diff[i] = w1 - w2;
      }
    }
  }

  return { wt1, wt2, diff };
}

export const buildWAVETREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'WAVETREND' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const chan = indicator.channelLength ?? 10;
  const avg = indicator.averageLength ?? 21;

  const { wt1, wt2 } = calculateWaveTrend(highs, lows, closes, chan, avg);

  const ob1 = indicator.obLevel1 ?? 60;
  const os1 = indicator.osLevel1 ?? -60;

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('wt1', 'WT1', wt1, bars.length, indicator.wt1Color ?? '#26A69A', 1.8),
      buildLineSeries('wt2', 'WT2', wt2, bars.length, indicator.wt2Color ?? '#EF5350', 1.4),
    ],
    referenceLines: [ob1, 53, 0, -53, os1],
  };
};

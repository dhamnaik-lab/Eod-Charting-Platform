import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateKlinger(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  fastLength = 34,
  slowLength = 55,
  signalLength = 13,
): { kvo: Array<number | null>; signal: Array<number | null> } {
  const total = closes.length;
  const kvo: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (total < slowLength) return { kvo, signal };

  const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const signedVolume: number[] = new Array(total).fill(0);

  for (let i = 0; i < total; i++) {
    const vol = volumes[i] ?? 0;
    if (i === 0) {
      signedVolume[i] = vol;
    } else {
      const change = hlc3[i] - hlc3[i - 1];
      signedVolume[i] = change >= 0 ? vol : -vol;
    }
  }

  const fastRaw = EMA.calculate({ values: signedVolume, period: fastLength });
  const slowRaw = EMA.calculate({ values: signedVolume, period: slowLength });

  const fastPadded = padSeries(fastRaw, total);
  const slowPadded = padSeries(slowRaw, total);

  const validKVO: number[] = [];
  for (let i = 0; i < total; i++) {
    const f = fastPadded[i];
    const s = slowPadded[i];
    if (f !== null && s !== null) {
      const val = f - s;
      kvo[i] = val;
      validKVO.push(val);
    }
  }

  if (signalLength > 0 && validKVO.length >= signalLength) {
    const sigRaw = EMA.calculate({ values: validKVO, period: signalLength });
    const sigPadded = padSeries(sigRaw, total);
    for (let i = 0; i < total; i++) {
      signal[i] = sigPadded[i];
    }
  }

  return { kvo, signal };
}

export const buildKVO: IndicatorBuilder<Extract<ChartIndicator, { kind: 'KVO' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fast = indicator.fastPeriod ?? 34;
  const slow = indicator.slowPeriod ?? 55;
  const sig = indicator.signalPeriod ?? 13;

  const { kvo, signal } = calculateKlinger(highs, lows, closes, volumes, fast, slow, sig);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('kvo', 'KVO', kvo, bars.length, indicator.color ?? '#2962FF', 1.8),
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#43A047', 1.4),
    ],
    referenceLines: [0],
  };
};

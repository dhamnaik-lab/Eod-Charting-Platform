import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateNVI(
  closes: number[],
  volumes: number[],
  signalLength = 255,
): { nvi: Array<number | null>; signal: Array<number | null> } {
  const total = closes.length;
  const nvi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (!total) return { nvi, signal };

  const nviVals: number[] = [1000];
  nvi[0] = 1000;

  for (let i = 1; i < total; i++) {
    const prevClose = closes[i - 1];
    const prevNvi = nviVals[i - 1];
    const vol = volumes[i] ?? 0;
    const prevVol = volumes[i - 1] ?? 0;

    let curr = prevNvi;
    if (vol < prevVol && prevClose !== 0) {
      curr += ((closes[i] - prevClose) / prevClose) * 100;
    }
    nviVals.push(curr);
    nvi[i] = curr;
  }

  if (signalLength > 0 && nviVals.length >= signalLength) {
    const emaRaw = EMA.calculate({ values: nviVals, period: signalLength });
    const emaPadded = padSeries(emaRaw, total);
    for (let i = 0; i < total; i++) {
      signal[i] = emaPadded[i];
    }
  }

  return { nvi, signal };
}

export const buildNVI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'NVI' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const signalPeriod = indicator.signalPeriod ?? 255;

  const { nvi, signal } = calculateNVI(sources.closes, sources.volumes, signalPeriod);

  const lines = [buildLineSeries('nvi', 'NVI', nvi, bars.length, indicator.color ?? '#2962FF', 1.8)];
  if (signalPeriod > 0) {
    lines.push(buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#FF6D00', 1.4));
  }

  return {
    indicator,
    title,
    lines,
  };
};

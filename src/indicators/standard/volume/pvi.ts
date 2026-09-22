import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculatePVI(
  closes: number[],
  volumes: number[],
  signalLength = 255,
): { pvi: Array<number | null>; signal: Array<number | null> } {
  const total = closes.length;
  const pvi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (!total) return { pvi, signal };

  const pviVals: number[] = [1000];
  pvi[0] = 1000;

  for (let i = 1; i < total; i++) {
    const prevClose = closes[i - 1];
    const prevPvi = pviVals[i - 1];
    const vol = volumes[i] ?? 0;
    const prevVol = volumes[i - 1] ?? 0;

    let curr = prevPvi;
    if (vol > prevVol && prevClose !== 0) {
      curr += ((closes[i] - prevClose) / prevClose) * 100;
    }
    pviVals.push(curr);
    pvi[i] = curr;
  }

  if (signalLength > 0 && pviVals.length >= signalLength) {
    const emaRaw = EMA.calculate({ values: pviVals, period: signalLength });
    const emaPadded = padSeries(emaRaw, total);
    for (let i = 0; i < total; i++) {
      signal[i] = emaPadded[i];
    }
  }

  return { pvi, signal };
}

export const buildPVI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'PVI' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const signalPeriod = indicator.signalPeriod ?? 255;

  const { pvi, signal } = calculatePVI(sources.closes, sources.volumes, signalPeriod);

  const lines = [buildLineSeries('pvi', 'PVI', pvi, bars.length, indicator.color ?? '#2962FF', 1.8)];
  if (signalPeriod > 0) {
    lines.push(buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#FF6D00', 1.4));
  }

  return {
    indicator,
    title,
    lines,
  };
};

import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateTSI(
  closes: number[],
  longLength = 25,
  shortLength = 13,
  signalLength = 13,
): { tsi: Array<number | null>; signal: Array<number | null> } {
  const total = closes.length;
  const tsi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (total < longLength + shortLength) return { tsi, signal };

  const mtm: number[] = [];
  const absMtm: number[] = [];
  for (let i = 1; i < total; i++) {
    const diff = closes[i] - closes[i - 1];
    mtm.push(diff);
    absMtm.push(Math.abs(diff));
  }

  const emaMtm1 = EMA.calculate({ values: mtm, period: longLength });
  const emaMtm2 = EMA.calculate({ values: emaMtm1, period: shortLength });

  const emaAbs1 = EMA.calculate({ values: absMtm, period: longLength });
  const emaAbs2 = EMA.calculate({ values: emaAbs1, period: shortLength });

  const mtmPadded = padSeries(emaMtm2, total);
  const absPadded = padSeries(emaAbs2, total);

  const tsiValid: number[] = [];
  const tsiIndices: number[] = [];

  for (let i = 0; i < total; i++) {
    const num = mtmPadded[i];
    const den = absPadded[i];
    if (num !== null && den !== null && den !== 0) {
      const val = 100 * (num / den);
      tsi[i] = val;
      tsiValid.push(val);
      tsiIndices.push(i);
    }
  }

  if (tsiValid.length >= signalLength) {
    const sigEMA = EMA.calculate({ values: tsiValid, period: signalLength });
    const sigPadded = padSeries(sigEMA, total);
    for (let i = 0; i < total; i++) {
      signal[i] = sigPadded[i];
    }
  }

  return { tsi, signal };
}

export const buildTSI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TSI' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const longLength = indicator.longLength ?? 25;
  const shortLength = indicator.shortLength ?? 13;
  const signalLength = indicator.signalLength ?? 13;

  const { tsi, signal } = calculateTSI(srcValues, longLength, shortLength, signalLength);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('tsi', 'TSI', tsi, bars.length, indicator.color ?? '#2962FF', 1.8),
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#E91E63', 1.4),
    ],
    referenceLines: [0],
  };
};

import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateSMIErgodic(
  closes: number[],
  longLength = 20,
  shortLength = 5,
  signalLength = 5,
): { smi: Array<number | null>; signal: Array<number | null>; osc: Array<number | null> } {
  const total = closes.length;
  const smi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  const osc: Array<number | null> = new Array(total).fill(null);
  if (total < longLength + shortLength) return { smi, signal, osc };

  const mtm: number[] = [];
  const absMtm: number[] = [];
  for (let i = 1; i < total; i++) {
    const diff = closes[i] - closes[i - 1];
    mtm.push(diff);
    absMtm.push(Math.abs(diff));
  }

  const ema1 = EMA.calculate({ values: mtm, period: longLength });
  const ema2 = EMA.calculate({ values: ema1, period: shortLength });

  const emaAbs1 = EMA.calculate({ values: absMtm, period: longLength });
  const emaAbs2 = EMA.calculate({ values: emaAbs1, period: shortLength });

  const mtmPadded = padSeries(ema2, total);
  const absPadded = padSeries(emaAbs2, total);

  const smiValid: number[] = [];
  const smiIndices: number[] = [];

  for (let i = 0; i < total; i++) {
    const num = mtmPadded[i];
    const den = absPadded[i];
    if (num !== null && den !== null && den !== 0) {
      const val = num / den;
      smi[i] = val;
      smiValid.push(val);
      smiIndices.push(i);
    }
  }

  if (smiValid.length >= signalLength) {
    const sigEMA = EMA.calculate({ values: smiValid, period: signalLength });
    const sigPadded = padSeries(sigEMA, total);
    for (let i = 0; i < total; i++) {
      signal[i] = sigPadded[i];
      if (smi[i] !== null && signal[i] !== null) {
        osc[i] = smi[i]! - signal[i]!;
      }
    }
  }

  return { smi, signal, osc };
}

export const buildSMI_ERGODIC: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SMI_ERGODIC' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const longLength = indicator.longLength ?? 20;
  const shortLength = indicator.shortLength ?? 5;
  const signalLength = indicator.signalLength ?? 5;

  const { smi, signal } = calculateSMIErgodic(srcValues, longLength, shortLength, signalLength);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('smi', 'SMI', smi, bars.length, indicator.color ?? '#2962FF', 1.8),
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#FF6D00', 1.4),
    ],
    referenceLines: [0],
  };
};

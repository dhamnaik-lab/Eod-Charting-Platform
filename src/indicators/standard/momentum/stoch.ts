import { SMA } from 'technicalindicators';
import {
  buildLineSeries,
  getIndicatorReferenceLines,
  padSeries,
  slidingWindowMax,
  slidingWindowMin,
  type IndicatorBuilder,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildSTOCH: IndicatorBuilder<Extract<ChartIndicator, { kind: 'STOCH' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = Math.max(1, indicator.period || 5);
  const smoothK = Math.max(1, indicator.smoothK ?? 3);
  const signalPeriod = Math.max(1, indicator.signalPeriod || 3);

  const rawK: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length >= period) {
    const h = slidingWindowMax(highs, period);
    const l = slidingWindowMin(lows, period);
    for (let i = period - 1; i < bars.length; i++) {
      const highVal = h[i];
      const lowVal = l[i];
      rawK[i] = highVal === lowVal ? 50 : ((closes[i] - lowVal) / (highVal - lowVal)) * 100;
    }
  }

  let kValues: Array<number | null>;
  if (smoothK <= 1) {
    kValues = rawK;
  } else {
    const validRawK = rawK.filter((v): v is number => v !== null);
    const kSmoothed = SMA.calculate({ values: validRawK, period: smoothK });
    kValues = padSeries(kSmoothed, bars.length);
  }

  let dValues: Array<number | null>;
  if (signalPeriod <= 1) {
    dValues = kValues;
  } else {
    const validK = kValues.filter((v): v is number => v !== null);
    const dSmoothed = SMA.calculate({ values: validK, period: signalPeriod });
    dValues = padSeries(dSmoothed, bars.length);
  }

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('stoch-k', '%K', kValues, bars.length, indicator.color, 1.6),
      buildLineSeries('stoch-d', '%D', dValues, bars.length, indicator.signalColor, 1.6),
    ],
    referenceLines: getIndicatorReferenceLines(indicator, [
      { id: 'oversold', label: 'Oversold', value: 20 },
      { id: 'overbought', label: 'Overbought', value: 80 },
    ]),
    fixedRange: { min: 0, max: 100 },
  };
};

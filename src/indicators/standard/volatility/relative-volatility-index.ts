import { EMA, SD, SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateRelativeVolatilityIndex(
  closes: number[],
  length = 10,
  signalPeriod = 14,
): { rvi: Array<number | null>; signal: Array<number | null> } {
  const total = closes.length;
  const rvi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (total < length + 14) return { rvi, signal };

  const sdRaw = SD.calculate({ values: closes, period: length });
  const sdPadded = padSeries(sdRaw, total);

  const upperInput: number[] = new Array(total).fill(0);
  const lowerInput: number[] = new Array(total).fill(0);

  for (let i = 1; i < total; i++) {
    const diff = closes[i] - closes[i - 1];
    const std = sdPadded[i] ?? 0;
    if (diff > 0) {
      upperInput[i] = std;
      lowerInput[i] = 0;
    } else {
      upperInput[i] = 0;
      lowerInput[i] = std;
    }
  }

  const emaUpperRaw = EMA.calculate({ values: upperInput, period: 14 });
  const emaLowerRaw = EMA.calculate({ values: lowerInput, period: 14 });

  const emaUpper = padSeries(emaUpperRaw, total);
  const emaLower = padSeries(emaLowerRaw, total);

  const validRVI: number[] = [];
  for (let i = 0; i < total; i++) {
    const u = emaUpper[i];
    const l = emaLower[i];
    if (u !== null && l !== null && u + l > 0) {
      const val = (u / (u + l)) * 100;
      rvi[i] = val;
      validRVI.push(val);
    }
  }

  if (signalPeriod > 1 && validRVI.length >= signalPeriod) {
    const sigRaw = SMA.calculate({ values: validRVI, period: signalPeriod });
    const sigPadded = padSeries(sigRaw, total);
    for (let i = 0; i < total; i++) {
      signal[i] = sigPadded[i];
    }
  }

  return { rvi, signal };
}

export const buildRVI_VOL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RVI_VOL' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 10;
  const signalPeriod = indicator.signalPeriod ?? 14;

  const { rvi, signal } = calculateRelativeVolatilityIndex(srcValues, period, signalPeriod);

  const lines = [
    buildLineSeries('rvi_vol', 'RVI (Vol)', rvi, bars.length, indicator.color ?? '#7E57C2', 1.8),
  ];
  if (signalPeriod > 1) {
    lines.push(
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#E2CC00', 1.4),
    );
  }

  return {
    indicator,
    title,
    lines,
    referenceLines: [20, 50, 80],
    fixedRange: { min: 0, max: 100 },
  };
};

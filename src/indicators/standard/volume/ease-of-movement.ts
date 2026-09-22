import { SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateEOM(
  highs: number[],
  lows: number[],
  volumes: number[],
  length = 14,
  divisor = 10000,
): Array<number | null> {
  const total = highs.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < length + 1) return result;

  const rawEOM: number[] = new Array(total).fill(0);
  for (let i = 1; i < total; i++) {
    const hl2Curr = (highs[i] + lows[i]) / 2;
    const hl2Prev = (highs[i - 1] + lows[i - 1]) / 2;
    const distance = hl2Curr - hl2Prev;

    const range = highs[i] - lows[i];
    const vol = (volumes[i] ?? 0) / (divisor || 1);
    const boxRatio = vol > 0 ? range / vol : 0;

    rawEOM[i] = distance * boxRatio;
  }

  const smaRaw = SMA.calculate({ values: rawEOM, period: length });
  const smaPadded = padSeries(smaRaw, total);

  for (let i = length; i < total; i++) {
    result[i] = smaPadded[i];
  }

  return result;
}

export const buildEOM: IndicatorBuilder<Extract<ChartIndicator, { kind: 'EOM' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, volumes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 14;
  const divisor = indicator.divisor ?? 10000;

  const values = calculateEOM(highs, lows, volumes, period, divisor);

  return {
    indicator,
    title,
    lines: [buildLineSeries('eom', 'EOM', values, bars.length, indicator.color ?? '#43A047', 1.8)],
    referenceLines: [0],
  };
};

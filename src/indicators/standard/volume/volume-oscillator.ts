import { EMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateVolumeOscillator(
  volumes: number[],
  shortLength = 5,
  longLength = 10,
): Array<number | null> {
  const total = volumes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < longLength) return result;

  const shortRaw = EMA.calculate({ values: volumes, period: shortLength });
  const longRaw = EMA.calculate({ values: volumes, period: longLength });

  const shortPadded = padSeries(shortRaw, total);
  const longPadded = padSeries(longRaw, total);

  for (let i = longLength - 1; i < total; i++) {
    const s = shortPadded[i];
    const l = longPadded[i];
    if (s !== null && l !== null && l !== 0) {
      result[i] = ((s - l) / l) * 100;
    }
  }

  return result;
}

export const buildVOL_OSC: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VOL_OSC' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fastPeriod = indicator.fastPeriod ?? 5;
  const slowPeriod = indicator.slowPeriod ?? 10;

  const values = calculateVolumeOscillator(sources.volumes, fastPeriod, slowPeriod);

  return {
    indicator,
    title,
    lines: [buildLineSeries('vol_osc', 'Volume Osc', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
    referenceLines: [0],
  };
};

import { EMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateRipsterEMAClouds(
  prices: number[],
  s1 = 8,
  l1 = 9,
  s2 = 5,
  l2 = 12,
  s3 = 34,
  l3 = 50,
): {
  emaS1: Array<number | null>;
  emaL1: Array<number | null>;
  emaS2: Array<number | null>;
  emaL2: Array<number | null>;
  emaS3: Array<number | null>;
  emaL3: Array<number | null>;
} {
  const n = prices.length;
  const emaS1 = padSeries(EMA.calculate({ values: prices, period: s1 }), n);
  const emaL1 = padSeries(EMA.calculate({ values: prices, period: l1 }), n);
  const emaS2 = padSeries(EMA.calculate({ values: prices, period: s2 }), n);
  const emaL2 = padSeries(EMA.calculate({ values: prices, period: l2 }), n);
  const emaS3 = padSeries(EMA.calculate({ values: prices, period: s3 }), n);
  const emaL3 = padSeries(EMA.calculate({ values: prices, period: l3 }), n);

  return { emaS1, emaL1, emaS2, emaL2, emaS3, emaL3 };
}

export const buildRIPSTER_EMA_CLOUDS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RIPSTER_EMA_CLOUDS' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = getSourceValues(bars, indicator.source, indicator.sourceIndicatorId, sourceSeriesMap);

  const s1 = indicator.shortLen1 ?? 8;
  const l1 = indicator.longLen1 ?? 9;
  const s2 = indicator.shortLen2 ?? 5;
  const l2 = indicator.longLen2 ?? 12;
  const s3 = indicator.shortLen3 ?? 34;
  const l3 = indicator.longLen3 ?? 50;

  const { emaS1, emaL1, emaS2, emaL2, emaS3, emaL3 } = calculateRipsterEMAClouds(
    values,
    s1,
    l1,
    s2,
    l2,
    s3,
    l3,
  );

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('ema_s1', `EMA ${s1}`, emaS1, bars.length, '#4CAF50', 1.2),
      buildLineSeries('ema_l1', `EMA ${l1}`, emaL1, bars.length, '#2E7D32', 1.2),
      buildLineSeries('ema_s2', `EMA ${s2}`, emaS2, bars.length, '#2196F3', 1.2),
      buildLineSeries('ema_l2', `EMA ${l2}`, emaL2, bars.length, '#1565C0', 1.2),
      buildLineSeries('ema_s3', `EMA ${s3}`, emaS3, bars.length, '#FF9800', 1.4),
      buildLineSeries('ema_l3', `EMA ${l3}`, emaL3, bars.length, '#E65100', 1.4),
    ],
  };
};

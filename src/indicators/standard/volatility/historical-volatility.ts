import { SD } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateHV(
  closes: number[],
  period = 10,
  annual = 365,
): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < period + 1) return result;

  const logReturns: number[] = [];
  for (let i = 1; i < total; i++) {
    const prev = closes[i - 1];
    logReturns.push(prev > 0 && closes[i] > 0 ? Math.log(closes[i] / prev) : 0);
  }

  const sdRaw = SD.calculate({ values: logReturns, period });
  const sdPadded = padSeries(sdRaw, total);

  const annualMultiplier = 100 * Math.sqrt(annual);

  for (let i = 0; i < total; i++) {
    const s = sdPadded[i];
    if (s !== null) {
      result[i] = s * annualMultiplier;
    }
  }

  return result;
}

export const buildHV: IndicatorBuilder<Extract<ChartIndicator, { kind: 'HV' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 10;
  const annual = indicator.annual ?? 365;

  const values = calculateHV(srcValues, period, annual);

  return {
    indicator,
    title,
    lines: [buildLineSeries('hv', 'HV', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
  };
};

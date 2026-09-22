import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

function calculateWoodiesCCIHelper(source: number[], length: number): Array<number | null> {
  const result: Array<number | null> = new Array(source.length).fill(null);
  if (length <= 0 || source.length < length) return result;

  for (let i = length - 1; i < source.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sum += source[j];
    }
    const sma = sum / length;

    let devSum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      devSum += Math.abs(source[j] - sma);
    }
    const meanDev = devSum / length;

    result[i] = meanDev === 0 ? 0 : (source[i] - sma) / (0.015 * meanDev);
  }

  return result;
}

export function calculateWoodiesCCI(
  closes: number[],
  cciLength = 14,
  turboLength = 6,
): { cci14: Array<number | null>; turbo: Array<number | null> } {
  const cci14 = calculateWoodiesCCIHelper(closes, cciLength);
  const turbo = calculateWoodiesCCIHelper(closes, turboLength);
  return { cci14, turbo };
}

export const buildWOODIES_CCI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'WOODIES_CCI' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const cciLen = indicator.cciPeriod ?? 14;
  const turboLen = indicator.turboPeriod ?? 6;

  const { cci14, turbo } = calculateWoodiesCCI(srcValues, cciLen, turboLen);

  const posColor = indicator.histogramPositiveColor ?? '#009688';
  const negColor = indicator.histogramNegativeColor ?? '#F44336';

  const colorValues: Array<string | null> = cci14.map((val) => {
    if (val === null) return null;
    return val >= 0 ? posColor : negColor;
  });

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('wcci-main', `CCI (${cciLen})`, cci14, bars.length, indicator.cciColor ?? '#F44336', 1.6),
      buildLineSeries('wcci-turbo', `Turbo (${turboLen})`, turbo, bars.length, indicator.turboColor ?? '#009688', 1.4),
    ],
    histogram: {
      key: 'wcci-hist',
      label: 'CCI Histogram',
      values: cci14,
      positiveColor: posColor,
      negativeColor: negColor,
      colorValues,
    },
    referenceLines: [-100, 0, 100],
  };
};

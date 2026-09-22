import { SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

const ROC_LEN = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
const SMA_LEN = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
const WEIGHTS = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];

export function calculatePringSpecialK(closes: number[]): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < 50) return result;

  const terms: Array<Array<number | null>> = [];

  for (let k = 0; k < ROC_LEN.length; k++) {
    const rocPeriod = ROC_LEN[k];
    const smaPeriod = SMA_LEN[k];
    if (total < rocPeriod + smaPeriod) {
      terms.push(new Array(total).fill(null));
      continue;
    }

    const roc: number[] = [];
    for (let i = rocPeriod; i < total; i++) {
      const prev = closes[i - rocPeriod];
      roc.push(prev !== 0 ? ((closes[i] - prev) / prev) * 100 : 0);
    }

    const sma = SMA.calculate({ values: roc, period: smaPeriod });
    terms.push(padSeries(sma, total));
  }

  for (let i = 0; i < total; i++) {
    let sum = 0;
    let validCount = 0;
    for (let k = 0; k < terms.length; k++) {
      const val = terms[k][i];
      if (val !== null) {
        sum += WEIGHTS[k] * val;
        validCount++;
      }
    }
    // Output value if at least the core short/medium terms are valid
    if (validCount >= 4) {
      result[i] = sum;
    }
  }

  return result;
}

export const buildPRING_SPECIAL_K: IndicatorBuilder<Extract<ChartIndicator, { kind: 'PRING_SPECIAL_K' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = calculatePringSpecialK(srcValues);

  return {
    indicator,
    title,
    lines: [buildLineSeries('special_k', "Pring's Special K", values, bars.length, indicator.color ?? '#2962FF', 1.8)],
    referenceLines: [0],
  };
};

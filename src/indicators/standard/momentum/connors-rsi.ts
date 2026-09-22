import { RSI } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateCRSI(
  closes: number[],
  rsiLength = 3,
  upDownLength = 2,
  rocLength = 100,
): Array<number | null> {
  const total = closes.length;
  const result: Array<number | null> = new Array(total).fill(null);
  if (total < Math.max(rsiLength, upDownLength, 2)) return result;

  // Streak counter
  const streak: number[] = new Array(total).fill(0);
  for (let i = 1; i < total; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) {
      streak[i] = streak[i - 1] > 0 ? streak[i - 1] + 1 : 1;
    } else if (diff < 0) {
      streak[i] = streak[i - 1] < 0 ? streak[i - 1] - 1 : -1;
    } else {
      streak[i] = 0;
    }
  }

  // 1-bar ROC
  const roc1: number[] = new Array(total).fill(0);
  for (let i = 1; i < total; i++) {
    roc1[i] = closes[i - 1] !== 0 ? ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100 : 0;
  }

  const rsiCloses = RSI.calculate({ values: closes, period: rsiLength });
  const rsiStreak = RSI.calculate({ values: streak, period: upDownLength });

  const rsiClosesPadded = padSeries(rsiCloses, total);
  const rsiStreakPadded = padSeries(rsiStreak, total);

  // Percent rank of ROC1 over rocLength
  const prArr: Array<number | null> = new Array(total).fill(null);
  for (let i = 0; i < total; i++) {
    const start = Math.max(0, i - rocLength + 1);
    const window = roc1.slice(start, i + 1);
    const curr = roc1[i];
    let count = 0;
    for (let j = 0; j < window.length; j++) {
      if (window[j] <= curr) count++;
    }
    prArr[i] = (count / window.length) * 100;
  }

  for (let i = 0; i < total; i++) {
    const r1 = rsiClosesPadded[i];
    const r2 = rsiStreakPadded[i];
    const r3 = prArr[i];
    if (r1 !== null && r2 !== null && r3 !== null) {
      result[i] = (r1 + r2 + r3) / 3;
    }
  }

  return result;
}

export const buildCRSI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CRSI' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const rsiLen = indicator.rsiLength ?? 3;
  const udLen = indicator.upDownLength ?? 2;
  const rocLen = indicator.rocLength ?? 100;

  const values = calculateCRSI(srcValues, rsiLen, udLen, rocLen);

  return {
    indicator,
    title,
    lines: [buildLineSeries('crsi', 'CRSI', values, bars.length, indicator.color ?? '#2962FF', 1.8)],
    referenceLines: [30, 50, 70],
    fixedRange: { min: 0, max: 100 },
  };
};

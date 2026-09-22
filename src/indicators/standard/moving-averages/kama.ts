import { buildLineSeries, getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildKAMA: IndicatorBuilder<Extract<ChartIndicator, { kind: 'KAMA' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period;
  const values: Array<number | null> = new Array(bars.length).fill(null);
  if (bars.length > period) {
    let kama = srcValues[period - 1];
    values[period - 1] = kama;
    const fastSC = 2 / (2 + 1);
    const slowSC = 2 / (30 + 1);

    let volatility = 0;
    for (let i = 1; i < period; i++) {
      volatility += Math.abs(srcValues[i] - srcValues[i - 1]);
    }

    for (let i = period; i < bars.length; i++) {
      const change = Math.abs(srcValues[i] - srcValues[i - period]);
      volatility =
        volatility -
        Math.abs(srcValues[i - period + 1] - (srcValues[i - period] ?? srcValues[i - period + 1])) +
        Math.abs(srcValues[i] - srcValues[i - 1]);
      const er = volatility === 0 ? 0 : change / volatility;
      const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
      kama = kama + sc * (srcValues[i] - kama);
      values[i] = kama;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('kama', title, values, bars.length, indicator.color, 1.8)],
  };
};

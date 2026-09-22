import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

function swma(values: number[]): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  for (let i = 3; i < values.length; i++) {
    result[i] = (values[i - 3] + 2 * values[i - 2] + 2 * values[i - 1] + values[i]) / 6;
  }
  return result;
}

export function calculateRVI(
  bars: OHLCBar[],
  length = 10,
): { rvi: Array<number | null>; signal: Array<number | null> } {
  const total = bars.length;
  const rvi: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (total < length + 3) return { rvi, signal };

  const closeMinusOpen = bars.map((b) => b.close - b.open);
  const highMinusLow = bars.map((b) => b.high - b.low);

  const swmaCO = swma(closeMinusOpen);
  const swmaHL = swma(highMinusLow);

  const rviRaw: number[] = new Array(total).fill(0);

  for (let i = length + 2; i < total; i++) {
    let sumCO = 0;
    let sumHL = 0;
    for (let j = i - length + 1; j <= i; j++) {
      const co = swmaCO[j];
      const hl = swmaHL[j];
      if (co !== null) sumCO += co;
      if (hl !== null) sumHL += hl;
    }
    const val = sumHL !== 0 ? sumCO / sumHL : 0;
    rvi[i] = val;
    rviRaw[i] = val;
  }

  const sigSwma = swma(rviRaw);
  for (let i = length + 5; i < total; i++) {
    signal[i] = sigSwma[i];
  }

  return { rvi, signal };
}

export const buildRVI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RVI' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.length ?? 10;
  const { rvi, signal } = calculateRVI(bars, length);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('rvi', 'RVI', rvi, bars.length, indicator.color ?? '#008000', 1.8),
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#FF0000', 1.4),
    ],
    referenceLines: [0],
  };
};

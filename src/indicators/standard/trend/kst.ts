import { SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildKST: IndicatorBuilder<Extract<ChartIndicator, { kind: 'KST' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const { roc1, roc2, roc3, roc4, s1, s2, s3, s4, sig } = indicator;
  const calcRC = (rp: number, sp: number) => {
    const roc: number[] = [];
    for (let i = rp; i < closes.length; i++) roc.push(((closes[i] - closes[i - rp]) / closes[i - rp]) * 100);
    return SMA.calculate({ values: roc, period: sp });
  };
  const rc1 = calcRC(roc1, s1);
  const rc2 = calcRC(roc2, s2);
  const rc3 = calcRC(roc3, s3);
  const rc4 = calcRC(roc4, s4);
  const kst: Array<number | null> = new Array(bars.length).fill(null);
  const maxStart = Math.max(roc1 + s1, roc2 + s2, roc3 + s3, roc4 + s4) - 1;
  for (let i = maxStart; i < bars.length; i++) {
    kst[i] =
      rc1[i - (roc1 + s1 - 1)] * 1 +
      rc2[i - (roc2 + s2 - 1)] * 2 +
      rc3[i - (roc3 + s3 - 1)] * 3 +
      rc4[i - (roc4 + s4 - 1)] * 4;
  }
  const signal = SMA.calculate({ values: kst.filter((v): v is number => v !== null), period: sig });
  const signalPadded = padSeries(signal, bars.length);
  return {
    indicator,
    title,
    lines: [
      buildLineSeries('kst', 'KST', kst, bars.length, indicator.color, 1.8),
      buildLineSeries('kst-sig', 'Signal', signalPadded, bars.length, indicator.signalColor, 1.4),
    ],
    referenceLines: [0],
  };
};

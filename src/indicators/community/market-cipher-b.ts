import { EMA, SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateMarketCipherB(
  highs: number[],
  lows: number[],
  closes: number[],
  opens: number[],
  wtChannelLen = 9,
  wtAvgLen = 12,
  wtMALen = 3,
  rsiMFIPeriod = 60,
  rsiMFIMult = 150,
): {
  wt1: Array<number | null>;
  wt2: Array<number | null>;
  vwap: Array<number | null>;
  mfi: Array<number | null>;
} {
  const n = closes.length;
  const wt1: Array<number | null> = new Array(n).fill(null);
  const wt2: Array<number | null> = new Array(n).fill(null);
  const vwap: Array<number | null> = new Array(n).fill(null);
  const mfi: Array<number | null> = new Array(n).fill(null);

  const warmup = Math.max(wtChannelLen + wtAvgLen, rsiMFIPeriod);
  if (n < warmup) return { wt1, wt2, vwap, mfi };

  const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);

  // WaveTrend calculation
  const esaRaw = EMA.calculate({ values: hlc3, period: wtChannelLen });
  const esaPadded = padSeries(esaRaw, n);

  const absDev: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const esa = esaPadded[i] ?? hlc3[i];
    absDev[i] = Math.abs(hlc3[i] - esa);
  }

  const dRaw = EMA.calculate({ values: absDev, period: wtChannelLen });
  const dPadded = padSeries(dRaw, n);

  const ci: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const esa = esaPadded[i] ?? hlc3[i];
    const d = dPadded[i] ?? 0;
    const denom = 0.015 * d;
    ci[i] = denom !== 0 ? (hlc3[i] - esa) / denom : 0;
  }

  const wt1Raw = EMA.calculate({ values: ci, period: wtAvgLen });
  const wt1Padded = padSeries(wt1Raw, n);

  const validWt1: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = wt1Padded[i];
    wt1[i] = val;
    if (val !== null) validWt1.push(val);
  }

  if (validWt1.length >= wtMALen) {
    const wt2Raw = SMA.calculate({ values: validWt1, period: wtMALen });
    const wt2Padded = padSeries(wt2Raw, n);
    for (let i = 0; i < n; i++) {
      const w2 = wt2Padded[i];
      wt2[i] = w2;
      const w1 = wt1[i];
      if (w1 !== null && w2 !== null) {
        vwap[i] = w1 - w2;
      }
    }
  }

  // MFI calculation
  const rawMfi: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const range = highs[i] - lows[i];
    rawMfi[i] = range !== 0 ? ((closes[i] - opens[i]) / range) * rsiMFIMult : 0;
  }

  const mfiRaw = SMA.calculate({ values: rawMfi, period: rsiMFIPeriod });
  const mfiPadded = padSeries(mfiRaw, n);
  for (let i = 0; i < n; i++) {
    mfi[i] = mfiPadded[i];
  }

  return { wt1, wt2, vwap, mfi };
}

export const buildMARKET_CIPHER_B: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MARKET_CIPHER_B' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const opens = bars.map((b) => b.open);
  const title = getCompactIndicatorDisplayLabel(indicator);

  const chLen = indicator.wtChannelLen ?? 9;
  const avgLen = indicator.wtAvgLen ?? 12;
  const maLen = indicator.wtMALen ?? 3;
  const mfiPer = indicator.rsiMFIPeriod ?? 60;
  const mfiMult = indicator.rsiMFIMult ?? 150;

  const { wt1, wt2, vwap, mfi } = calculateMarketCipherB(
    highs,
    lows,
    closes,
    opens,
    chLen,
    avgLen,
    maLen,
    mfiPer,
    mfiMult,
  );

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('wt1', 'WT1', wt1, bars.length, indicator.wt1Color ?? '#4994EC', 1.8),
      buildLineSeries('wt2', 'WT2', wt2, bars.length, indicator.wt2Color ?? '#1F1559', 1.4),
      buildLineSeries('mfi', 'MFI Area', mfi, bars.length, indicator.mfiColor ?? '#3EE145', 1.2),
      buildLineSeries('vwap', 'VWAP Line', vwap, bars.length, '#FFFFFF80', 1.2, 'dashed'),
    ],
    referenceLines: [60, 53, 0, -53, -60],
  };
};

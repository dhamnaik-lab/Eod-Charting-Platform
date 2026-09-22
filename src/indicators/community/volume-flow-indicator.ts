import { EMA, SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateVFI(
  bars: OHLCBar[],
  length = 130,
  coef = 0.2,
  vcoef = 2.5,
  signalLength = 5,
): {
  vfi: Array<number | null>;
  signal: Array<number | null>;
} {
  const n = bars.length;
  const vfi: Array<number | null> = new Array(n).fill(null);
  const signal: Array<number | null> = new Array(n).fill(null);
  if (n < length + 30) return { vfi, signal };

  const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const volumes = bars.map((b) => b.volume);

  const inter: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    inter[i] = Math.log(hlc3[i]) - Math.log(hlc3[i - 1]);
  }

  // 30-period rolling standard deviation of log returns
  const vinter: number[] = new Array(n).fill(0);
  for (let i = 29; i < n; i++) {
    let mean = 0;
    for (let j = 0; j < 30; j++) mean += inter[i - j];
    mean /= 30;
    let variance = 0;
    for (let j = 0; j < 30; j++) variance += Math.pow(inter[i - j] - mean, 2);
    vinter[i] = Math.sqrt(variance / 30);
  }

  const vaveRaw = SMA.calculate({ values: volumes, period: length });
  const vavePadded = padSeries(vaveRaw, n);

  const vcp: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const vInt = vinter[i] ?? 0;
    const cutoff = coef * vInt * bars[i].close;
    const vave = i > 0 ? (vavePadded[i - 1] ?? 1) : 1;
    const vmax = vave * vcoef;
    const vol = volumes[i] ?? 0;
    const vc = Math.min(vol, vmax);
    const mf = i > 0 ? hlc3[i] - hlc3[i - 1] : 0;
    vcp[i] = mf > cutoff ? vc : mf < -cutoff ? -vc : 0;
  }

  const rawVfi: Array<number | null> = new Array(n).fill(null);
  let runningSum = 0;
  for (let i = 0; i < n; i++) {
    runningSum += vcp[i];
    if (i >= length) runningSum -= vcp[i - length];
    const v = vavePadded[i];
    if (i >= length + 30 && v && v !== 0) {
      rawVfi[i] = runningSum / v;
    }
  }

  const validVfi: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = rawVfi[i];
    vfi[i] = val;
    if (val !== null) validVfi.push(val);
  }

  if (signalLength > 0 && validVfi.length >= signalLength) {
    const sigRaw = EMA.calculate({ values: validVfi, period: signalLength });
    const sigPadded = padSeries(sigRaw, n);
    for (let i = 0; i < n; i++) {
      signal[i] = sigPadded[i];
    }
  }

  return { vfi, signal };
}

export const buildVFI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VFI' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.length ?? 130;
  const coef = indicator.coef ?? 0.2;
  const vcoef = indicator.vcoef ?? 2.5;
  const signalLength = indicator.signalLength ?? 5;

  const { vfi, signal } = calculateVFI(bars, length, coef, vcoef, signalLength);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('vfi', 'VFI', vfi, bars.length, indicator.color ?? '#26A69A', 1.8),
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#FF6D00', 1.4),
    ],
    referenceLines: [0],
  };
};

import { BollingerBands } from 'technicalindicators';
import { buildLineSeries, slidingWindowMax, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateCMVixFix(
  bars: OHLCBar[],
  length = 22,
  bbLen = 20,
  bbMult = 2.0,
  lookbackPct = 50,
  pctHighest = 0.85,
): {
  wvf: Array<number | null>;
  bbUpper: Array<number | null>;
  rangeHigh: Array<number | null>;
  colorValues: Array<string | null>;
} {
  const n = bars.length;
  const wvf: Array<number | null> = new Array(n).fill(null);
  const bbUpper: Array<number | null> = new Array(n).fill(null);
  const rangeHigh: Array<number | null> = new Array(n).fill(null);
  const colorValues: Array<string | null> = new Array(n).fill(null);
  if (n < Math.max(length, bbLen)) return { wvf, bbUpper, rangeHigh, colorValues };

  const closes = bars.map((b) => b.close);
  const lows = bars.map((b) => b.low);

  const highestCloses = slidingWindowMax(closes, length);
  const rawWvf: number[] = new Array(n).fill(0);

  for (let i = length - 1; i < n; i++) {
    const hc = highestCloses[i] ?? closes[i];
    const val = hc !== 0 ? ((hc - lows[i]) / hc) * 100 : 0;
    rawWvf[i] = val;
    wvf[i] = val;
  }

  // Bollinger Bands on rawWvf
  const bbRaw = BollingerBands.calculate({ values: rawWvf, period: bbLen, stdDev: bbMult });
  for (let i = bbLen - 1; i < n; i++) {
    const band = bbRaw[i - (bbLen - 1)];
    if (band) {
      bbUpper[i] = band.upper;
    }
  }

  // Percentile threshold
  const wvfHighest = slidingWindowMax(rawWvf, lookbackPct);
  for (let i = lookbackPct - 1; i < n; i++) {
    const highVal = wvfHighest[i] ?? 0;
    rangeHigh[i] = highVal * pctHighest;
  }

  // Coloring
  for (let i = 0; i < n; i++) {
    const v = wvf[i];
    const bbu = bbUpper[i];
    const rh = rangeHigh[i];
    if (v !== null && ((bbu !== null && v >= bbu) || (rh !== null && v >= rh))) {
      colorValues[i] = '#00E676'; // Alert condition: market panic bottom
    } else {
      colorValues[i] = '#787B86';
    }
  }

  return { wvf, bbUpper, rangeHigh, colorValues };
}

export const buildCM_VIX_FIX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CM_VIX_FIX' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const length = indicator.length ?? 22;
  const bbLen = indicator.bbLen ?? 20;
  const bbMult = indicator.bbMult ?? 2.0;
  const lookbackPct = indicator.lookbackPct ?? 50;
  const pctHigh = indicator.pctHighest ?? 0.85;

  const { wvf, bbUpper, rangeHigh, colorValues } = calculateCMVixFix(
    bars,
    length,
    bbLen,
    bbMult,
    lookbackPct,
    pctHigh,
  );

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('bb_upper', 'BB Upper Threshold', bbUpper, bars.length, '#FF6D00', 1.4, 'dashed'),
      buildLineSeries('range_high', 'Range High Threshold', rangeHigh, bars.length, '#2962FF', 1.4, 'dotted'),
    ],
    histogram: {
      key: 'wvf_hist',
      label: 'Williams Vix Fix',
      values: wvf,
      positiveColor: indicator.alertColor ?? '#00E676',
      negativeColor: indicator.color ?? '#787B86',
      colorValues,
    },
    referenceLines: [0],
  };
};

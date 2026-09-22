import { EMA, RSI } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator } from '@/engine/types';

function runQQESingle(
  closes: number[],
  rsiLength: number,
  smoothingFactor: number,
  qqeFactor: number,
): { trendLine: Array<number | null>; smoothedRsi: Array<number | null> } {
  const n = closes.length;
  const trendLine: Array<number | null> = new Array(n).fill(null);
  const smoothedRsi: Array<number | null> = new Array(n).fill(null);
  if (n < rsiLength + smoothingFactor) return { trendLine, smoothedRsi };

  const rsiRaw = RSI.calculate({ values: closes, period: rsiLength });
  const rsiPadded = padSeries(rsiRaw, n);

  const validRsi: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = rsiPadded[i];
    if (val !== null) validRsi.push(val);
  }

  if (validRsi.length < smoothingFactor) return { trendLine, smoothedRsi };

  const smoothRaw = EMA.calculate({ values: validRsi, period: smoothingFactor });
  const smoothPadded = padSeries(smoothRaw, n);

  for (let i = 0; i < n; i++) {
    smoothedRsi[i] = smoothPadded[i];
  }

  // atrRsi = EMA(abs(change(smoothedRsi)), rsiLength * 2 - 1)
  const wildersLen = rsiLength * 2 - 1;
  const diffs: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const prev = smoothPadded[i - 1] ?? 0;
    const curr = smoothPadded[i] ?? 0;
    diffs[i] = Math.abs(curr - prev);
  }

  const atrRsiRaw = EMA.calculate({ values: diffs, period: wildersLen });
  const atrRsiPadded = padSeries(atrRsiRaw, n);

  let currentStop = 50;
  let trend = 1;

  for (let i = 0; i < n; i++) {
    const sr = smoothPadded[i];
    const dar = (atrRsiPadded[i] ?? 0) * qqeFactor;
    if (sr === null) continue;

    const newLong = sr - dar;
    const newShort = sr + dar;

    if (i === 0) {
      currentStop = newLong;
    } else {
      const prevStop = trendLine[i - 1] ?? currentStop;
      const prevSr = smoothPadded[i - 1] ?? sr;

      if (trend === 1) {
        if (sr < prevStop) {
          trend = -1;
          currentStop = newShort;
        } else {
          currentStop = prevSr > prevStop ? Math.max(prevStop, newLong) : newLong;
        }
      } else {
        if (sr > prevStop) {
          trend = 1;
          currentStop = newLong;
        } else {
          currentStop = prevSr < prevStop ? Math.min(prevStop, newShort) : newShort;
        }
      }
    }

    trendLine[i] = currentStop;
  }

  return { trendLine, smoothedRsi };
}

export function calculateQQEMod(
  closes: number[],
  rsiLengthPrimary = 6,
  rsiSmoothingPrimary = 5,
  qqeFactorPrimary = 3.0,
  rsiLengthSecondary = 6,
  rsiSmoothingSecondary = 5,
  qqeFactorSecondary = 1.61,
): {
  primaryTrend: Array<number | null>;
  primaryRsi: Array<number | null>;
  secondaryTrend: Array<number | null>;
  histogram: Array<number | null>;
  colorValues: Array<string | null>;
} {
  const { trendLine: primaryTrend, smoothedRsi: primaryRsi } = runQQESingle(
    closes,
    rsiLengthPrimary,
    rsiSmoothingPrimary,
    qqeFactorPrimary,
  );
  const { trendLine: secondaryTrend, smoothedRsi: secondaryRsi } = runQQESingle(
    closes,
    rsiLengthSecondary,
    rsiSmoothingSecondary,
    qqeFactorSecondary,
  );

  const n = closes.length;
  const histogram: Array<number | null> = new Array(n).fill(null);
  const colorValues: Array<string | null> = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const sRsi = secondaryRsi[i];
    const sTrend = secondaryTrend[i];
    if (sRsi !== null && sTrend !== null) {
      const diff = sRsi - 50;
      histogram[i] = diff;
      colorValues[i] = diff >= 0 ? (sRsi > sTrend ? '#00E676' : '#26A69A') : (sRsi < sTrend ? '#FF5252' : '#EF5350');
    }
  }

  return { primaryTrend, primaryRsi, secondaryTrend, histogram, colorValues };
}

export const buildQQE_MOD: IndicatorBuilder<Extract<ChartIndicator, { kind: 'QQE_MOD' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const rsiP = indicator.rsiLengthPrimary ?? 6;
  const smoothP = indicator.rsiSmoothingPrimary ?? 5;
  const factP = indicator.qqeFactorPrimary ?? 3.0;
  const rsiS = indicator.rsiLengthSecondary ?? 6;
  const smoothS = indicator.rsiSmoothingSecondary ?? 5;
  const factS = indicator.qqeFactorSecondary ?? 1.61;

  const { secondaryTrend, histogram, colorValues } = calculateQQEMod(
    sources.closes,
    rsiP,
    smoothP,
    factP,
    rsiS,
    smoothS,
    factS,
  );

  return {
    indicator,
    title,
    lines: [buildLineSeries('secondary_trend', 'QQE Signal', secondaryTrend, bars.length, '#FFFFFF', 1.6)],
    histogram: {
      key: 'qqe_hist',
      label: 'QQE Histogram',
      values: histogram,
      positiveColor: '#00E676',
      negativeColor: '#FF5252',
      colorValues,
    },
    referenceLines: [0],
  };
};

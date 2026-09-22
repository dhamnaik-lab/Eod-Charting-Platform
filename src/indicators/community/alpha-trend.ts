import { MFI, RSI, SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateAlphaTrend(
  bars: OHLCBar[],
  coeff = 1.0,
  period = 14,
  useRSI = false,
): {
  alphaTrend: Array<number | null>;
  alphaTrendLag: Array<number | null>;
} {
  const n = bars.length;
  const alphaTrend: Array<number | null> = new Array(n).fill(null);
  const alphaTrendLag: Array<number | null> = new Array(n).fill(null);
  if (n < period + 2) return { alphaTrend, alphaTrendLag };

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  // TR
  const tr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = highs[0] - lows[0];
    } else {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr[i] = Math.max(hl, hc, lc);
    }
  }

  const atrRaw = SMA.calculate({ values: tr, period });
  const atrPadded = padSeries(atrRaw, n);

  let filterPadded: Array<number | null>;
  if (useRSI) {
    const rsiRaw = RSI.calculate({ values: closes, period });
    filterPadded = padSeries(rsiRaw, n);
  } else {
    const mfiRaw = MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period });
    filterPadded = padSeries(mfiRaw, n);
  }

  let currentAT = closes[0];

  for (let i = 0; i < n; i++) {
    const atr = atrPadded[i] ?? (highs[i] - lows[i]);
    const upT = lows[i] - atr * coeff;
    const downT = highs[i] + atr * coeff;
    const filt = filterPadded[i] ?? 50;
    const prev = i > 0 ? (alphaTrend[i - 1] ?? currentAT) : currentAT;

    if (filt >= 50) {
      currentAT = upT < prev ? prev : upT;
    } else {
      currentAT = downT > prev ? prev : downT;
    }

    if (i >= period) {
      alphaTrend[i] = currentAT;
      if (i >= period + 2) {
        alphaTrendLag[i] = alphaTrend[i - 2];
      }
    }
  }

  return { alphaTrend, alphaTrendLag };
}

export const buildALPHA_TREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ALPHA_TREND' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const coeff = indicator.coeff ?? 1.0;
  const period = indicator.period ?? 14;
  const useRSI = indicator.useRSI ?? false;

  const { alphaTrend, alphaTrendLag } = calculateAlphaTrend(bars, coeff, period, useRSI);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('alpha_trend', 'AlphaTrend', alphaTrend, bars.length, indicator.color ?? '#0022FC', 2),
      buildLineSeries('alpha_lag', 'AlphaTrend [2]', alphaTrendLag, bars.length, indicator.lagColor ?? '#FC0400', 2),
    ],
  };
};

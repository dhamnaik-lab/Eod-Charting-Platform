import { slidingWindowMax, slidingWindowMin, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateDonchianTrendRibbon(
  bars: OHLCBar[],
  dlen = 20,
): {
  netTrend: Array<number | null>;
  mainTrend: Array<number | null>;
  colorValues: Array<string | null>;
} {
  const n = bars.length;
  const netTrend: Array<number | null> = new Array(n).fill(null);
  const mainTrend: Array<number | null> = new Array(n).fill(null);
  const colorValues: Array<string | null> = new Array(n).fill(null);
  if (n < dlen) return { netTrend, mainTrend, colorValues };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  // Compute 10 trend layers
  const layers: number[][] = [];
  for (let offset = 0; offset < 10; offset++) {
    const len = Math.max(2, dlen - offset);
    const hh = slidingWindowMax(highs, len);
    const ll = slidingWindowMin(lows, len);

    const trend: number[] = new Array(n).fill(0);
    let curTrend = 0;

    for (let i = 0; i < n; i++) {
      const prevHh = i > 0 ? (hh[i - 1] ?? highs[i]) : highs[i];
      const prevLl = i > 0 ? (ll[i - 1] ?? lows[i]) : lows[i];

      if (closes[i] > prevHh) {
        curTrend = 1;
      } else if (closes[i] < prevLl) {
        curTrend = -1;
      }
      trend[i] = curTrend;
    }
    layers.push(trend);
  }

  for (let i = dlen; i < n; i++) {
    let sum = 0;
    for (let l = 0; l < 10; l++) {
      sum += layers[l][i];
    }
    netTrend[i] = sum;
    mainTrend[i] = layers[0][i];
    colorValues[i] = sum > 0 ? '#00E676' : sum < 0 ? '#FF5252' : '#787B86';
  }

  return { netTrend, mainTrend, colorValues };
}

export const buildDONCHIAN_RIBBON: IndicatorBuilder<Extract<ChartIndicator, { kind: 'DONCHIAN_RIBBON' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const dlen = indicator.dlen ?? 20;

  const { netTrend, colorValues } = calculateDonchianTrendRibbon(bars, dlen);

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'dtr_hist',
      label: 'Donchian Trend Ribbon',
      values: netTrend,
      positiveColor: indicator.bullColor ?? '#00E676',
      negativeColor: indicator.bearColor ?? '#FF5252',
      colorValues,
    },
    referenceLines: [0],
  };
};

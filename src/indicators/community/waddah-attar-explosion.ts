import { BollingerBands, EMA, WEMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateWaddahAttar(
  closes: number[],
  highs: number[],
  lows: number[],
  sensitivity = 150,
  fastLength = 20,
  slowLength = 40,
  channelLength = 20,
  bbMult = 2.0,
): {
  trendUp: Array<number | null>;
  trendDown: Array<number | null>;
  explosionLine: Array<number | null>;
  deadZone: Array<number | null>;
} {
  const n = closes.length;
  const trendUp: Array<number | null> = new Array(n).fill(null);
  const trendDown: Array<number | null> = new Array(n).fill(null);
  const explosionLine: Array<number | null> = new Array(n).fill(null);
  const deadZone: Array<number | null> = new Array(n).fill(null);

  const warmup = Math.max(slowLength, channelLength, 100);
  if (n < warmup) return { trendUp, trendDown, explosionLine, deadZone };

  const fastRaw = EMA.calculate({ values: closes, period: fastLength });
  const slowRaw = EMA.calculate({ values: closes, period: slowLength });
  const bbRaw = BollingerBands.calculate({ values: closes, period: channelLength, stdDev: bbMult });

  const fastPadded = padSeries(fastRaw, n);
  const slowPadded = padSeries(slowRaw, n);

  // True range for Dead Zone
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
  const rmaTr = WEMA.calculate({ values: tr, period: 100 });
  const rmaPadded = padSeries(rmaTr, n);

  for (let i = channelLength - 1; i < n; i++) {
    const band = bbRaw[i - (channelLength - 1)];
    if (band) {
      explosionLine[i] = band.upper - band.lower;
    }
  }

  for (let i = 1; i < n; i++) {
    const fCurr = fastPadded[i];
    const sCurr = slowPadded[i];
    const fPrev = fastPadded[i - 1];
    const sPrev = slowPadded[i - 1];

    if (fCurr !== null && sCurr !== null && fPrev !== null && sPrev !== null) {
      const macdCurr = fCurr - sCurr;
      const macdPrev = fPrev - sPrev;
      const t1 = (macdCurr - macdPrev) * sensitivity;

      if (t1 >= 0) {
        trendUp[i] = t1;
        trendDown[i] = 0;
      } else {
        trendUp[i] = 0;
        trendDown[i] = -t1;
      }
    }

    if (rmaPadded[i] !== null) {
      deadZone[i] = (rmaPadded[i] ?? 0) * 3.7;
    }
  }

  return { trendUp, trendDown, explosionLine, deadZone };
}

export const buildWADDAH_ATTAR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'WADDAH_ATTAR' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { closes, highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const sens = indicator.sensitivity ?? 150;
  const fast = indicator.fastLength ?? 20;
  const slow = indicator.slowLength ?? 40;
  const chan = indicator.channelLength ?? 20;
  const mult = indicator.bbMult ?? 2.0;

  const { trendUp, trendDown, explosionLine, deadZone } = calculateWaddahAttar(
    closes,
    highs,
    lows,
    sens,
    fast,
    slow,
    chan,
    mult,
  );

  const upColor = indicator.upColor ?? '#00E676';
  const downColor = indicator.downColor ?? '#FF5252';

  // Net histogram for visualization
  const netHistogram: Array<number | null> = trendUp.map((up, i) => {
    const dn = trendDown[i];
    if (up === null && dn === null) return null;
    return (up ?? 0) > 0 ? (up ?? 0) : -(dn ?? 0);
  });

  const colorValues: Array<string | null> = netHistogram.map((val) => {
    if (val === null) return null;
    return val >= 0 ? upColor : downColor;
  });

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('explosion', 'Explosion Line', explosionLine, bars.length, indicator.explosionColor ?? '#A0522D', 2),
      buildLineSeries('dead_zone', 'Dead Zone', deadZone, bars.length, indicator.deadZoneColor ?? '#2962FF', 1.4, 'dashed'),
    ],
    histogram: {
      key: 'wae_hist',
      label: 'Trend Power',
      values: netHistogram,
      positiveColor: upColor,
      negativeColor: downColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

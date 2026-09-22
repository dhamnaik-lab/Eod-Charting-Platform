import { EMA, SMA } from 'technicalindicators';
import type { OHLCBar } from '../types';

export interface CandlePropsArrays {
  bodyHi: Float64Array;
  bodyLo: Float64Array;
  body: Float64Array;
  bodyAvg: Float64Array;
  smallBody: Uint8Array;
  longBody: Uint8Array;
  upShadow: Float64Array;
  dnShadow: Float64Array;
  hasUpShadow: Uint8Array;
  hasDnShadow: Uint8Array;
  whiteBody: Uint8Array;
  blackBody: Uint8Array;
  range: Float64Array;
  isInsideBar: Uint8Array;
  shadowEquals: Uint8Array;
  isDojiBody: Uint8Array;
  doji: Uint8Array;
  downTrend: Uint8Array;
  upTrend: Uint8Array;
}

const C_LEN = 14;
const C_SHADOW_PERCENT = 5.0;
const C_SHADOW_EQUALS_PERCENT = 100.0;
const C_DOJI_BODY_PERCENT = 5.0;

export function computeCandleProps(bars: OHLCBar[]): CandlePropsArrays {
  const n = bars.length;

  const bodyHi = new Float64Array(n);
  const bodyLo = new Float64Array(n);
  const body = new Float64Array(n);
  const upShadow = new Float64Array(n);
  const dnShadow = new Float64Array(n);
  const range = new Float64Array(n);
  const whiteBody = new Uint8Array(n);
  const blackBody = new Uint8Array(n);
  const hasUpShadow = new Uint8Array(n);
  const hasDnShadow = new Uint8Array(n);
  const isInsideBar = new Uint8Array(n);
  const shadowEquals = new Uint8Array(n);
  const isDojiBody = new Uint8Array(n);
  const doji = new Uint8Array(n);

  const rawBodies: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const hi = Math.max(b.close, b.open);
    const lo = Math.min(b.close, b.open);
    const bSize = hi - lo;
    const r = b.high - b.low;
    const us = b.high - hi;
    const ds = lo - b.low;

    bodyHi[i] = hi;
    bodyLo[i] = lo;
    body[i] = bSize;
    rawBodies[i] = bSize;
    range[i] = r;
    upShadow[i] = us;
    dnShadow[i] = ds;

    whiteBody[i] = b.close > b.open ? 1 : 0;
    blackBody[i] = b.close < b.open ? 1 : 0;
    hasUpShadow[i] = us > bSize * (C_SHADOW_PERCENT / 100) ? 1 : 0;
    hasDnShadow[i] = ds > bSize * (C_SHADOW_PERCENT / 100) ? 1 : 0;

    if (i > 0) {
      isInsideBar[i] = bodyHi[i - 1] > hi && bodyLo[i - 1] < lo ? 1 : 0;
    }

    const eqShadow =
      us === ds ||
      (ds > 0 && us > 0 &&
        (Math.abs(us - ds) / ds) * 100 < C_SHADOW_EQUALS_PERCENT &&
        (Math.abs(ds - us) / us) * 100 < C_SHADOW_EQUALS_PERCENT);
    shadowEquals[i] = eqShadow ? 1 : 0;

    const isDojiB = r > 0 && bSize <= r * (C_DOJI_BODY_PERCENT / 100);
    isDojiBody[i] = isDojiB ? 1 : 0;
    doji[i] = isDojiB && eqShadow ? 1 : 0;
  }

  // 14-period EMA of body size
  const bodyAvg = new Float64Array(n);
  const smallBody = new Uint8Array(n);
  const longBody = new Uint8Array(n);

  if (n > 0) {
    const emaRaw = EMA.calculate({ values: rawBodies, period: Math.min(n, C_LEN) });
    const offset = n - emaRaw.length;
    for (let i = 0; i < n; i++) {
      const avg = i >= offset ? emaRaw[i - offset] : rawBodies[i];
      bodyAvg[i] = avg;
      smallBody[i] = body[i] < avg ? 1 : 0;
      longBody[i] = body[i] > avg ? 1 : 0;
    }
  }

  // 50-period SMA for trend detection (or 5-period slope fallback)
  const upTrend = new Uint8Array(n);
  const downTrend = new Uint8Array(n);
  const closes = bars.map((b) => b.close);

  if (n >= 5) {
    const trendPeriod = Math.min(n, 50);
    const smaRaw = SMA.calculate({ values: closes, period: trendPeriod });
    const offset = n - smaRaw.length;

    for (let i = 1; i < n; i++) {
      if (i >= offset && i - offset > 0) {
        const currSma = smaRaw[i - offset];
        const prevSma = smaRaw[i - offset - 1];
        upTrend[i] = currSma > prevSma ? 1 : 0;
        downTrend[i] = currSma < prevSma ? 1 : 0;
      } else {
        // Fallback: 5-bar price direction
        const lookback = Math.min(i, 5);
        upTrend[i] = closes[i] > closes[i - lookback] ? 1 : 0;
        downTrend[i] = closes[i] < closes[i - lookback] ? 1 : 0;
      }
    }
  }

  return {
    bodyHi,
    bodyLo,
    body,
    bodyAvg,
    smallBody,
    longBody,
    upShadow,
    dnShadow,
    hasUpShadow,
    hasDnShadow,
    whiteBody,
    blackBody,
    range,
    isInsideBar,
    shadowEquals,
    isDojiBody,
    doji,
    downTrend,
    upTrend,
  };
}

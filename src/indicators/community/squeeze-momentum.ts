import { ATR, BollingerBands, EMA, SMA } from 'technicalindicators';
import { padSeries, slidingWindowMax, slidingWindowMin, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateSqueezeMomentum(
  bars: OHLCBar[],
  bbLength = 20,
  bbMult = 2.0,
  kcLength = 20,
  kcMult = 1.5,
): {
  momentum: Array<number | null>;
  squeezeOn: Array<boolean | null>;
  colorValues: Array<string | null>;
} {
  const n = bars.length;
  const momentum: Array<number | null> = new Array(n).fill(null);
  const squeezeOn: Array<boolean | null> = new Array(n).fill(null);
  const colorValues: Array<string | null> = new Array(n).fill(null);

  const warmup = Math.max(bbLength, kcLength);
  if (n < warmup) return { momentum, squeezeOn, colorValues };

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  // Bollinger Bands
  const bbRaw = BollingerBands.calculate({ values: closes, period: bbLength, stdDev: bbMult });

  // Keltner Channels
  const kcBasisRaw = EMA.calculate({ values: closes, period: kcLength });
  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: kcLength });

  const kcBasisPadded = padSeries(kcBasisRaw, n);
  const atrPadded = padSeries(atrRaw, n);

  // Donchian mid & SMA for Momentum
  const smaCloseRaw = SMA.calculate({ values: closes, period: kcLength });
  const smaClosePadded = padSeries(smaCloseRaw, n);

  const highestHighs = slidingWindowMax(highs, kcLength);
  const lowestLows = slidingWindowMin(lows, kcLength);

  // Price deviation
  const deviation: Array<number | null> = new Array(n).fill(null);
  for (let i = kcLength - 1; i < n; i++) {
    const hh = highestHighs[i];
    const ll = lowestLows[i];
    const sma = smaClosePadded[i];
    if (hh !== null && ll !== null && sma !== null) {
      const donchianMid = (hh + ll) / 2;
      const midline = (donchianMid + sma) / 2;
      deviation[i] = closes[i] - midline;
    }
  }

  // Linear regression slope of deviation over kcLength
  for (let i = kcLength * 2 - 2; i < n; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let j = 0; j < kcLength; j++) {
      const x = j;
      const y = deviation[i - kcLength + 1 + j] ?? 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const len = kcLength;
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / len;
    const linregVal = intercept + slope * (len - 1);

    momentum[i] = linregVal;

    // Squeeze detection
    const bbIndex = i - (bbLength - 1);
    const bb = bbIndex >= 0 ? bbRaw[bbIndex] : null;
    const kcBasis = kcBasisPadded[i];
    const atr = atrPadded[i];

    if (bb && kcBasis !== null && atr !== null) {
      const kcUpper = kcBasis + atr * kcMult;
      const kcLower = kcBasis - atr * kcMult;
      squeezeOn[i] = bb.lower > kcLower && bb.upper < kcUpper;
    }

    // 4-color momentum
    const prev = i > 0 ? momentum[i - 1] ?? linregVal : linregVal;
    if (linregVal >= 0) {
      colorValues[i] = linregVal > prev ? '#00E676' : '#26A69A';
    } else {
      colorValues[i] = linregVal < prev ? '#FF5252' : '#EF5350';
    }
  }

  return { momentum, squeezeOn, colorValues };
}

export const buildSQUEEZE_MOMENTUM: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SQUEEZE_MOMENTUM' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const bbLength = indicator.bbLength ?? 20;
  const bbMult = indicator.bbMult ?? 2.0;
  const kcLength = indicator.kcLength ?? 20;
  const kcMult = indicator.kcMult ?? 1.5;

  const { momentum, colorValues } = calculateSqueezeMomentum(
    bars,
    bbLength,
    bbMult,
    kcLength,
    kcMult,
  );

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'sqz_hist',
      label: 'Squeeze Momentum',
      values: momentum,
      positiveColor: '#00E676',
      negativeColor: '#FF5252',
      colorValues,
    },
    referenceLines: [0],
  };
};

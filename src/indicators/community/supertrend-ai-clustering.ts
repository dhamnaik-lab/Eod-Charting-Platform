import { ATR } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateSuperTrendAI(
  bars: OHLCBar[],
  atrLen = 10,
  minFactor = 1.0,
  maxFactor = 5.0,
  factorStep = 0.5,
  perfAlpha = 10,
): {
  supertrend: Array<number | null>;
  supertrendAma: Array<number | null>;
  direction: Array<number | null>;
} {
  const n = bars.length;
  const supertrend: Array<number | null> = new Array(n).fill(null);
  const supertrendAma: Array<number | null> = new Array(n).fill(null);
  const direction: Array<number | null> = new Array(n).fill(null);
  if (n < atrLen + 5) return { supertrend, supertrendAma, direction };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: atrLen });
  const atrPadded = padSeries(atrRaw, n);

  // Generate factors array
  const factors: number[] = [];
  for (let f = minFactor; f <= maxFactor + 0.001; f += factorStep) {
    factors.push(f);
  }
  const m = factors.length;

  // Track each factor's trailing stop and performance
  const factorUpper = new Float64Array(m);
  const factorLower = new Float64Array(m);
  const factorDir = new Int8Array(m);
  const factorPerf = new Float64Array(m);

  for (let j = 0; j < m; j++) {
    factorDir[j] = 1;
    factorPerf[j] = 0;
  }

  let ama = closes[0];

  for (let i = 0; i < n; i++) {
    const atr = atrPadded[i] ?? (highs[i] - lows[i]);
    const hl2 = (highs[i] + lows[i]) / 2;
    const c = closes[i];
    const prevC = i > 0 ? closes[i - 1] : c;

    // Update each factor
    for (let j = 0; j < m; j++) {
      const f = factors[j];
      const basicUpper = hl2 + f * atr;
      const basicLower = hl2 - f * atr;

      if (i === 0) {
        factorUpper[j] = basicUpper;
        factorLower[j] = basicLower;
      } else {
        const prevUpper = factorUpper[j];
        const prevLower = factorLower[j];
        factorLower[j] = prevC > prevLower ? Math.max(basicLower, prevLower) : basicLower;
        factorUpper[j] = prevC < prevUpper ? Math.min(basicUpper, prevUpper) : basicUpper;

        const prevDir = factorDir[j];
        if (prevDir === -1 && c > prevUpper) {
          factorDir[j] = 1;
        } else if (prevDir === 1 && c < prevLower) {
          factorDir[j] = -1;
        }

        // Performance tracking: reward trend continuity, penalize flip
        const perfDelta = factorDir[j] === prevDir ? Math.abs(c - prevC) : -Math.abs(c - prevC);
        factorPerf[j] = factorPerf[j] + (perfDelta - factorPerf[j]) / perfAlpha;
      }
    }

    if (i >= atrLen) {
      // Find top performing factors (top 50% or max cluster)
      let bestPerf = -Infinity;
      let bestFactor = factors[0];
      let bestIdx = 0;

      for (let j = 0; j < m; j++) {
        if (factorPerf[j] > bestPerf) {
          bestPerf = factorPerf[j];
          bestFactor = factors[j];
          bestIdx = j;
        }
      }

      const activeDir = factorDir[bestIdx];
      const stVal = activeDir === 1 ? factorLower[bestIdx] : factorUpper[bestIdx];
      supertrend[i] = stVal;
      direction[i] = activeDir;

      ama = i === atrLen ? stVal : ama + (stVal - ama) * 0.2;
      supertrendAma[i] = ama;
    }
  }

  return { supertrend, supertrendAma, direction };
}

export const buildSUPERTREND_AI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SUPERTREND_AI' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const atrLen = indicator.atrLen ?? 10;
  const minF = indicator.minFactor ?? 1.0;
  const maxF = indicator.maxFactor ?? 5.0;
  const step = indicator.factorStep ?? 0.5;
  const alpha = indicator.perfAlpha ?? 10;

  const { supertrend, supertrendAma } = calculateSuperTrendAI(bars, atrLen, minF, maxF, step, alpha);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('st_ai', 'SuperTrend AI', supertrend, bars.length, indicator.upColor ?? '#26A69A', 2),
      buildLineSeries('st_ama', 'SuperTrend AMA', supertrendAma, bars.length, '#26A69A80', 1.2, 'dashed'),
    ],
  };
};

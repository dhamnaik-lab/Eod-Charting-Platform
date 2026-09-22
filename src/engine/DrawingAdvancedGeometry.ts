import type { OHLCBar } from './types';

export interface RegressionChannelResult {
  startIndex: number;
  endIndex: number;
  centerStart: number;
  centerEnd: number;
  upperStart: number;
  upperEnd: number;
  lowerStart: number;
  lowerEnd: number;
  slopePerBar: number;
  intercept: number;
  residualStdDev: number;
  sampleCount: number;
}

export const FIB_TIME_RATIOS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;
export const FIB_RADIAL_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const FIB_ARC_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const GANN_BOX_LEVELS = [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1] as const;

/**
 * Calculates a close-price least-squares regression channel over the inclusive
 * bar range. The channel width is based on population RMS residuals so it is
 * deterministic and stable for the same displayed bar series.
 */
export function calculateRegressionChannel(
  bars: readonly OHLCBar[],
  startIndex: number,
  endIndex: number,
  standardDeviations = 2,
): RegressionChannelResult | null {
  if (!bars.length) return null;

  const left = Math.max(0, Math.min(bars.length - 1, Math.min(Math.round(startIndex), Math.round(endIndex))));
  const right = Math.max(0, Math.min(bars.length - 1, Math.max(Math.round(startIndex), Math.round(endIndex))));
  const samples: Array<{ x: number; y: number }> = [];
  for (let index = left; index <= right; index += 1) {
    const value = bars[index]?.close;
    if (Number.isFinite(value)) samples.push({ x: index, y: value });
  }
  if (samples.length < 2) return null;

  const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
  let numerator = 0;
  let denominator = 0;
  samples.forEach((sample) => {
    const dx = sample.x - meanX;
    numerator += dx * (sample.y - meanY);
    denominator += dx * dx;
  });
  const slopePerBar = Math.abs(denominator) < 1e-12 ? 0 : numerator / denominator;
  const intercept = meanY - slopePerBar * meanX;
  const residualVariance = samples.reduce((sum, sample) => {
    const fitted = intercept + slopePerBar * sample.x;
    const residual = sample.y - fitted;
    return sum + residual * residual;
  }, 0) / samples.length;
  const residualStdDev = Math.sqrt(Math.max(0, residualVariance));
  const width = residualStdDev * Math.max(0, standardDeviations);

  const centerStart = intercept + slopePerBar * left;
  const centerEnd = intercept + slopePerBar * right;
  return {
    startIndex: left,
    endIndex: right,
    centerStart,
    centerEnd,
    upperStart: centerStart + width,
    upperEnd: centerEnd + width,
    lowerStart: centerStart - width,
    lowerEnd: centerEnd - width,
    slopePerBar,
    intercept,
    residualStdDev,
    sampleCount: samples.length,
  };
}

export function buildFibTimeZoneIndexes(
  startIndex: number,
  endIndex: number,
  ratios: readonly number[] = FIB_TIME_RATIOS,
): number[] {
  const roundedStart = Math.round(startIndex);
  const delta = Math.round(endIndex) - roundedStart;
  const signedBase = delta === 0 ? 1 : delta;
  return ratios.map((ratio) => roundedStart + signedBase * ratio);
}

export function pointInTriangle(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const sign = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

export function distanceToEllipseBoundary(
  point: { x: number; y: number },
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
): number {
  const rx = Math.max(Math.abs(radiusX), 1e-6);
  const ry = Math.max(Math.abs(radiusY), 1e-6);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const normalized = Math.hypot(dx / rx, dy / ry);
  const localScale = Math.min(rx, ry);
  return Math.abs(normalized - 1) * localScale;
}

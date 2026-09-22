import { extendSegmentHorizontally, type DrawingPoint, type DrawingSegment } from './DrawingGeometry';
import type { RuntimeFibonacciLevel } from './DrawingF1BRuntime';

export interface FibHorizontalLevelGeometry {
  level: RuntimeFibonacciLevel;
  price: number;
  segment: DrawingSegment;
}

export interface FibTimeLevelGeometry {
  level: RuntimeFibonacciLevel;
  index: number;
}

export function buildF1BRetracementLevels(
  startPrice: number,
  endPrice: number,
  startX: number,
  endX: number,
  width: number,
  levels: readonly RuntimeFibonacciLevel[],
  extendLeft = false,
  extendRight = true,
  reverse = false,
  logScaleLevels = false,
): FibHorizontalLevelGeometry[] {
  // F1B.5 plotting-style parity: Fib Retracement keeps the F1B.4 price orientation
  // but, like the working Trend-Based Fib Extension / user reference, extends the
  // level block to the chart's right side by default. The finite A↔B base span is
  // still preserved when Extend Right is explicitly disabled.
  // F1B.4 TradingView/video fidelity: without extension, Fib Retracement level lines
  // are bounded by the two anchor X positions. Point 2 is level 0 and Point 1 is
  // level 1 by default, so a low->high draw retraces downward from 0 toward 1 and
  // extension ratios above 1 continue beyond Point 1. Reverse flips only the
  // coefficient-to-price mapping; it never changes horizontal geometry.
  const baseLeft = Math.min(startX, endX);
  const baseRight = Math.max(startX, endX);
  const projectedLeft = extendLeft ? 0 : baseLeft;
  const projectedRight = extendRight ? width : baseRight;
  const canUseLog = logScaleLevels && startPrice > 0 && endPrice > 0;

  return levels.filter((level) => level.enabled).map((level) => {
    const ratio = reverse ? 1 - level.value : level.value;
    const price = canUseLog
      ? endPrice * Math.pow(startPrice / endPrice, ratio)
      : endPrice + (startPrice - endPrice) * ratio;
    const yPlaceholder = price;
    return {
      level,
      price,
      segment: {
        start: { x: projectedLeft, y: yPlaceholder },
        end: { x: projectedRight, y: yPlaceholder },
      },
    };
  });
}

export function buildF1BTrendFibExtensionLevels(
  anchors: readonly DrawingPoint[],
  prices: readonly number[],
  width: number,
  levels: readonly RuntimeFibonacciLevel[],
  extendLeft = false,
  extendRight = true,
  reverse = false,
  logScaleLevels = false,
): FibHorizontalLevelGeometry[] {
  if (anchors.length < 3 || prices.length < 3) return [];
  const [a, b, c] = anchors;
  const [priceA, priceB, priceC] = prices;
  const baseSpan = Math.max(Math.abs(b.x - a.x), 48);
  const canUseLog = logScaleLevels && priceA > 0 && priceB > 0 && priceC > 0;
  return levels.filter((level) => level.enabled).map((level) => {
    const direction = reverse ? -1 : 1;
    const effectiveValue = level.value * direction;
    const price = canUseLog
      ? priceC * Math.pow(priceB / priceA, effectiveValue)
      : priceC + (priceB - priceA) * effectiveValue;
    const raw: DrawingSegment = { start: { x: c.x, y: price }, end: { x: c.x + baseSpan, y: price } };
    return { level, price, segment: extendSegmentHorizontally(raw.start, raw.end, width, extendLeft, extendRight) };
  });
}

export function buildF1BFibChannelLevels(
  anchors: readonly DrawingPoint[],
  width: number,
  levels: readonly RuntimeFibonacciLevel[],
  extendLeft = false,
  extendRight = false,
): Array<{ level: RuntimeFibonacciLevel; segment: DrawingSegment }> {
  if (anchors.length < 3) return [];
  const [a, b, c] = anchors;
  const offset = { x: c.x - a.x, y: c.y - a.y };
  return levels.filter((level) => level.enabled).map((level) => {
    const start = { x: a.x + offset.x * level.value, y: a.y + offset.y * level.value };
    const end = { x: b.x + offset.x * level.value, y: b.y + offset.y * level.value };
    return { level, segment: extendSegmentHorizontally(start, end, width, extendLeft, extendRight) };
  });
}

export function buildF1BFibTimeZoneLevels(
  startIndex: number,
  endIndex: number,
  levels: readonly RuntimeFibonacciLevel[],
): FibTimeLevelGeometry[] {
  const delta = endIndex - startIndex;
  const signedBase = Math.abs(delta) < 1e-9 ? 1 : delta;
  return levels.filter((level) => level.enabled).map((level) => ({
    level,
    index: startIndex + signedBase * level.value,
  }));
}

export function buildF1BTrendFibTimeLevels(
  anchors: readonly DrawingPoint[],
  levels: readonly RuntimeFibonacciLevel[],
): Array<{ level: RuntimeFibonacciLevel; x: number }> {
  if (anchors.length < 3) return [];
  const [a, b, c] = anchors;
  const span = b.x - a.x;
  return levels.filter((level) => level.enabled).map((level) => ({ level, x: c.x + span * level.value }));
}

import type { OHLCBar } from './types';

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingSegment {
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface DrawingRangeMetrics {
  startPrice: number;
  endPrice: number;
  priceChange: number;
  percentChange: number | null;
  barSpan: number;
  calendarDays: number | null;
  startDate: string | null;
  endDate: string | null;
}

const EPSILON = 1e-9;
const DAY_MS = 86_400_000;

/**
 * Clips the infinite line through two screen-space points to a rectangular pane.
 * Returns the two farthest valid boundary intersections, or null for a degenerate line.
 */
export function extendInfiniteLineToRect(
  start: DrawingPoint,
  end: DrawingPoint,
  width: number,
  height: number,
): DrawingSegment | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return null;
  }

  const candidates: DrawingPoint[] = [];
  const addCandidate = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < -EPSILON || x > width + EPSILON || y < -EPSILON || y > height + EPSILON) return;
    const clamped = {
      x: Math.min(Math.max(x, 0), width),
      y: Math.min(Math.max(y, 0), height),
    };
    if (!candidates.some((point) => Math.hypot(point.x - clamped.x, point.y - clamped.y) < 0.01)) {
      candidates.push(clamped);
    }
  };

  if (Math.abs(dx) >= EPSILON) {
    let t = (0 - start.x) / dx;
    addCandidate(0, start.y + t * dy);
    t = (width - start.x) / dx;
    addCandidate(width, start.y + t * dy);
  }

  if (Math.abs(dy) >= EPSILON) {
    let t = (0 - start.y) / dy;
    addCandidate(start.x + t * dx, 0);
    t = (height - start.y) / dy;
    addCandidate(start.x + t * dx, height);
  }

  if (candidates.length < 2) {
    return null;
  }

  let bestStart = candidates[0];
  let bestEnd = candidates[1];
  let bestDistance = -1;
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const distance = Math.hypot(
        candidates[right].x - candidates[left].x,
        candidates[right].y - candidates[left].y,
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestStart = candidates[left];
        bestEnd = candidates[right];
      }
    }
  }

  return { start: bestStart, end: bestEnd };
}

export function isHorizontalRayHit(
  point: DrawingPoint,
  anchor: DrawingPoint,
  tolerance: number,
  direction: 'right' | 'left' = 'right',
): boolean {
  if (Math.abs(point.y - anchor.y) > tolerance) {
    return false;
  }
  return direction === 'right' ? point.x >= anchor.x - tolerance : point.x <= anchor.x + tolerance;
}

export function calculatePercentChange(startPrice: number, endPrice: number): number | null {
  if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice) || Math.abs(startPrice) < EPSILON) {
    return null;
  }
  return ((endPrice - startPrice) / startPrice) * 100;
}

export function calculatePriceRangePercent(priceA: number, priceB: number): number | null {
  const min = Math.min(priceA, priceB);
  const max = Math.max(priceA, priceB);
  if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(min) < EPSILON) {
    return null;
  }
  return ((max - min) / Math.abs(min)) * 100;
}

export function calculateSlopePerBar(
  startIndex: number,
  startPrice: number,
  endIndex: number,
  endPrice: number,
): number | null {
  const deltaIndex = endIndex - startIndex;
  if (!Number.isFinite(deltaIndex) || deltaIndex === 0) {
    return null;
  }
  return (endPrice - startPrice) / deltaIndex;
}

/** Visual screen-space angle. This intentionally changes with chart scaling. */
export function calculateVisualAngleDegrees(start: DrawingPoint, end: DrawingPoint): number {
  const dx = end.x - start.x;
  const dy = start.y - end.y;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return 0;
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function calculateDrawingRangeMetrics(
  startIndex: number,
  startPrice: number,
  endIndex: number,
  endPrice: number,
  bars: readonly OHLCBar[] = [],
): DrawingRangeMetrics {
  const startBar = bars[startIndex];
  const endBar = bars[endIndex];
  const startTimestamp = startBar?.timestamp;
  const endTimestamp = endBar?.timestamp;
  const calendarDays =
    typeof startTimestamp === 'number' &&
    typeof endTimestamp === 'number' &&
    Number.isFinite(startTimestamp) &&
    Number.isFinite(endTimestamp)
      ? Math.abs((endTimestamp - startTimestamp) / DAY_MS)
      : null;

  return {
    startPrice,
    endPrice,
    priceChange: endPrice - startPrice,
    percentChange: calculatePercentChange(startPrice, endPrice),
    barSpan: Math.abs(endIndex - startIndex),
    calendarDays,
    startDate: startBar?.date ?? null,
    endDate: endBar?.date ?? null,
  };
}

/**
 * Chooses a label Y outside the candle body/range where practical.
 * Bottom placement is preferred so date-range labels do not collide with the chart title/OHLC header.
 */
export function chooseRangeLabelY(
  candleTopY: number | null,
  candleBottomY: number | null,
  paneHeight: number,
  options: { reservedTop?: number; reservedBottom?: number; labelHeight?: number; gap?: number } = {},
): number {
  const reservedTop = options.reservedTop ?? 46;
  const reservedBottom = options.reservedBottom ?? 8;
  const labelHeight = options.labelHeight ?? 19;
  const gap = options.gap ?? 8;
  const half = labelHeight / 2;
  const minimumY = reservedTop + half;
  const maximumY = Math.max(minimumY, paneHeight - reservedBottom - half);

  if (candleBottomY != null && Number.isFinite(candleBottomY)) {
    const below = candleBottomY + gap + half;
    if (below <= maximumY) {
      return Math.max(minimumY, below);
    }
  }

  if (candleTopY != null && Number.isFinite(candleTopY)) {
    const above = candleTopY - gap - half;
    if (above >= minimumY) {
      return Math.min(maximumY, above);
    }
  }

  // When neither side has enough clear space, keep the label near the lower edge,
  // away from the title/OHLC strip. It remains clamped inside the pane.
  return maximumY;
}

/**
 * Extends a screen-space segment toward the visible chart's left/right edges while preserving
 * the line slope. Canvas clipping handles Y values that project outside the pane.
 */
export function extendSegmentHorizontally(
  start: DrawingPoint,
  end: DrawingPoint,
  width: number,
  extendLeft: boolean,
  extendRight: boolean,
): DrawingSegment {
  const dx = end.x - start.x;
  if (Math.abs(dx) < EPSILON) {
    return { start, end };
  }

  const leftAnchor = start.x <= end.x ? start : end;
  const rightAnchor = start.x <= end.x ? end : start;
  const slope = (rightAnchor.y - leftAnchor.y) / (rightAnchor.x - leftAnchor.x);
  const left = extendLeft
    ? { x: 0, y: leftAnchor.y + (0 - leftAnchor.x) * slope }
    : leftAnchor;
  const right = extendRight
    ? { x: width, y: rightAnchor.y + (width - rightAnchor.x) * slope }
    : rightAnchor;

  return { start: left, end: right };
}

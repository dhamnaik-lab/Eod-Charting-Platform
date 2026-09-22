import type { FibonacciLevelDefinition, FibonacciSpeedResistanceFanSettings } from './DrawingFibonacciContracts';
import type { FibonacciPixelPoint, FibonacciPixelSegment } from './DrawingFibonacciGeometry';

export interface ScaleXLike {
  toPixel(barIndex: number): number;
}

export interface ScaleYLike {
  toPixel(price: number): number;
}

export interface FibSpeedResistanceFanRayGeometry {
  level: FibonacciLevelDefinition;
  type: 'price' | 'time';
  coefficient: number;
  targetPrice: number;
  targetBarIndex: number;
  targetPoint: FibonacciPixelPoint;
  segment: FibonacciPixelSegment;
  labelAnchor: FibonacciPixelPoint;
}

export interface FibSpeedResistanceFanGridGeometry {
  priceGridSegments: FibonacciPixelSegment[];
  timeGridSegments: FibonacciPixelSegment[];
  boundaryRectangle: FibonacciPixelSegment[];
}

export interface FibSpeedResistanceFanBandGeometry {
  points: FibonacciPixelPoint[];
  levelId: string;
}

export interface FibSpeedResistanceFanGeometry {
  apex: FibonacciPixelPoint;
  handle: FibonacciPixelPoint;
  trendSegment: FibonacciPixelSegment;
  priceRays: FibSpeedResistanceFanRayGeometry[];
  timeRays: FibSpeedResistanceFanRayGeometry[];
  grid: FibSpeedResistanceFanGridGeometry | null;
  backgroundBands: FibSpeedResistanceFanBandGeometry[];
}

/**
 * Extends the already-projected ray from `start` through `target` far enough
 * beyond the pane that the caller's canvas clip owns the visible boundary.
 *
 * The Fibonacci construction is defined by the two authoritative data points
 * first; both are projected through the *current* scales before extension.
 * Therefore the rendered straight ray always passes exactly through its
 * Fibonacci price/time target, regardless of zoom, auto-scale, invert-scale,
 * or log-scale transforms. No arbitrary far data-space point participates.
 */
export function extendProjectedRayBeyondPane(
  start: FibonacciPixelPoint,
  target: FibonacciPixelPoint,
  width: number,
  height: number,
): FibonacciPixelSegment {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const length = Math.hypot(dx, dy);

  if (!Number.isFinite(length) || length < 1e-9) {
    return { start: { ...start }, end: { ...target } };
  }

  const unitX = dx / length;
  const unitY = dy / length;
  // Cover the complete pane even when the apex itself is off-screen. Keeping
  // the extension in pixel space avoids huge data coordinates and rasterizer
  // precision drift while canvas clipping still produces the visible ray.
  const paneDiagonal = Math.hypot(Math.max(width, 1), Math.max(height, 1));
  const startOffset = Math.hypot(
    Math.max(Math.abs(start.x), Math.abs(start.x - width)),
    Math.max(Math.abs(start.y), Math.abs(start.y - height)),
  );
  const extension = Math.max(paneDiagonal * 2, paneDiagonal + startOffset + length);

  return {
    start: { ...start },
    end: {
      x: target.x + unitX * extension,
      y: target.y + unitY * extension,
    },
  };
}

/**
 * Canonical TradingView-fidelity Fib Speed Resistance Fan geometry builder.
 */
export function buildF1EFibSpeedResistanceFanGeometry(
  startIndex: number,
  startPrice: number,
  endIndex: number,
  endPrice: number,
  settings: FibonacciSpeedResistanceFanSettings,
  scaleX: ScaleXLike,
  scaleY: ScaleYLike,
  width: number,
  height: number,
  _viewport?: { startIndex: number; endIndex: number },
): FibSpeedResistanceFanGeometry {
  const apex = { x: scaleX.toPixel(startIndex), y: scaleY.toPixel(startPrice) };
  const handle = { x: scaleX.toPixel(endIndex), y: scaleY.toPixel(endPrice) };
  const trendSegment: FibonacciPixelSegment = { start: { ...apex }, end: { ...handle } };

  const deltaIndex = endIndex - startIndex;
  const deltaPrice = endPrice - startPrice;
  const effectiveDeltaIndex = deltaIndex === 0 ? 1 : deltaIndex;

  const reverse = settings.reverse === true;
  const showGrid = settings.showGrid !== false;
  const showBackground = settings.showBackground !== false;

  // Build Price Rays from authoritative data targets, then extend the projected ray.
  const priceLevels = (settings.priceLevels ?? []).filter((level) => level.enabled !== false);
  const priceRays: FibSpeedResistanceFanRayGeometry[] = priceLevels.map((level) => {
    const rawCoeff = level.value;
    const effectiveRatio = reverse ? 1 - rawCoeff : rawCoeff;
    const targetPrice = startPrice + effectiveRatio * deltaPrice;
    const targetBarIndex = endIndex;
    const targetPoint = { x: scaleX.toPixel(targetBarIndex), y: scaleY.toPixel(targetPrice) };
    const segment = extendProjectedRayBeyondPane(apex, targetPoint, width, height);

    return {
      level,
      type: 'price',
      coefficient: rawCoeff,
      targetPrice,
      targetBarIndex,
      targetPoint,
      segment,
      labelAnchor: targetPoint,
    };
  });

  // Build Time Rays from authoritative data targets, then extend the projected ray.
  const timeLevels = (settings.timeLevels ?? []).filter((level) => level.enabled !== false);
  const timeRays: FibSpeedResistanceFanRayGeometry[] = timeLevels.map((level) => {
    const rawCoeff = level.value;
    const targetBarIndex = startIndex + rawCoeff * effectiveDeltaIndex;
    const targetPrice = endPrice;
    const targetPoint = { x: scaleX.toPixel(targetBarIndex), y: scaleY.toPixel(targetPrice) };
    const segment = extendProjectedRayBeyondPane(apex, targetPoint, width, height);

    return {
      level,
      type: 'time',
      coefficient: rawCoeff,
      targetPrice,
      targetBarIndex,
      targetPoint,
      segment,
      labelAnchor: targetPoint,
    };
  });

  // Build Grid Geometry if enabled
  let grid: FibSpeedResistanceFanGridGeometry | null = null;
  if (showGrid) {
    const priceGridSegments: FibonacciPixelSegment[] = priceRays.map((ray) => {
      const y = ray.targetPoint.y;
      return {
        start: { x: apex.x, y },
        end: { x: handle.x, y },
      };
    });

    const timeGridSegments: FibonacciPixelSegment[] = timeRays.map((ray) => {
      const x = ray.targetPoint.x;
      return {
        start: { x, y: apex.y },
        end: { x, y: handle.y },
      };
    });

    const boundaryRectangle: FibonacciPixelSegment[] = [
      { start: { x: apex.x, y: apex.y }, end: { x: handle.x, y: apex.y } },
      { start: { x: handle.x, y: apex.y }, end: { x: handle.x, y: handle.y } },
      { start: { x: handle.x, y: handle.y }, end: { x: apex.x, y: handle.y } },
      { start: { x: apex.x, y: handle.y }, end: { x: apex.x, y: apex.y } },
    ];

    grid = { priceGridSegments, timeGridSegments, boundaryRectangle };
  }

  // Build Background Bands if enabled
  const backgroundBands: FibSpeedResistanceFanBandGeometry[] = [];
  if (showBackground) {
    const sortedPriceRays = [...priceRays].sort((a, b) => a.targetPoint.y - b.targetPoint.y);
    for (let i = 0; i < sortedPriceRays.length - 1; i += 1) {
      const ray1 = sortedPriceRays[i];
      const ray2 = sortedPriceRays[i + 1];
      backgroundBands.push({
        points: [apex, ray1.segment.end, ray2.segment.end],
        levelId: ray1.level.id,
      });
    }
  }

  return {
    apex,
    handle,
    trendSegment,
    priceRays,
    timeRays,
    grid,
    backgroundBands,
  };
}

/**
 * Calculates perpendicular distance from a point `p` to segment `(a, b)`.
 */
export function distanceToPixelSegment(
  p: FibonacciPixelPoint,
  a: FibonacciPixelPoint,
  b: FibonacciPixelPoint,
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared <= 1e-12) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lengthSquared));
  const projX = a.x + t * vx;
  const projY = a.y + t * vy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Canonical hit-test function for Fib Speed Resistance Fan matching rendered lines.
 */
export function hitTestF1EFibSpeedResistanceFan(
  point: FibonacciPixelPoint,
  geometry: FibSpeedResistanceFanGeometry,
  tolerance = 6,
): boolean {
  if (distanceToPixelSegment(point, geometry.trendSegment.start, geometry.trendSegment.end) <= tolerance) {
    return true;
  }

  for (const ray of geometry.priceRays) {
    if (distanceToPixelSegment(point, ray.segment.start, ray.segment.end) <= tolerance) {
      return true;
    }
  }

  for (const ray of geometry.timeRays) {
    if (distanceToPixelSegment(point, ray.segment.start, ray.segment.end) <= tolerance) {
      return true;
    }
  }

  if (geometry.grid) {
    for (const seg of geometry.grid.priceGridSegments) {
      if (distanceToPixelSegment(point, seg.start, seg.end) <= tolerance) return true;
    }
    for (const seg of geometry.grid.timeGridSegments) {
      if (distanceToPixelSegment(point, seg.start, seg.end) <= tolerance) return true;
    }
    for (const seg of geometry.grid.boundaryRectangle) {
      if (distanceToPixelSegment(point, seg.start, seg.end) <= tolerance) return true;
    }
  }

  return false;
}

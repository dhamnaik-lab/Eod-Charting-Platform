import type { RuntimeFibonacciLevel } from './DrawingF1BRuntime';

export interface DrawingPixelPoint {
  x: number;
  y: number;
}

export interface FibCircleLevelGeometry {
  level: RuntimeFibonacciLevel;
  center: DrawingPixelPoint;
  radiusX: number;
  radiusY: number;
  labelAnchor: DrawingPixelPoint;
}

export interface FibCirclesGeometry {
  trend: {
    start: DrawingPixelPoint;
    end: DrawingPixelPoint;
  };
  center: DrawingPixelPoint;
  baseRadiusX: number;
  baseRadiusY: number;
  levels: FibCircleLevelGeometry[];
}

/**
 * F1C.1 TradingView-fidelity Fib Circles geometry.
 *
 * The two selected points are opposite corners of the level-1 bounding box.
 * Their midpoint is the common ellipse center. Each Fibonacci coefficient
 * scales the half-width/half-height independently, so a 45-degree trend line
 * (equal absolute pixel deltas) produces perfectly round circles.
 */
export function buildF1CFibCirclesGeometry(
  start: DrawingPixelPoint,
  end: DrawingPixelPoint,
  levels: readonly RuntimeFibonacciLevel[],
): FibCirclesGeometry | null {
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const baseRadiusX = Math.abs(end.x - start.x) / 2;
  const baseRadiusY = Math.abs(end.y - start.y) / 2;
  if (baseRadiusX < 0.5 && baseRadiusY < 0.5) return null;

  const renderedLevels = levels
    .filter((level) => level.enabled && Number.isFinite(level.value))
    .map((level) => {
      const coefficient = Math.abs(level.value);
      const radiusX = baseRadiusX * coefficient;
      const radiusY = baseRadiusY * coefficient;
      return {
        level,
        center,
        radiusX,
        radiusY,
        labelAnchor: {
          x: center.x,
          y: center.y + radiusY,
        },
      };
    })
    .filter((entry) => entry.radiusX >= 0.5 || entry.radiusY >= 0.5)
    .sort((left, right) => Math.abs(left.level.value) - Math.abs(right.level.value));

  return {
    trend: { start: { ...start }, end: { ...end } },
    center,
    baseRadiusX,
    baseRadiusY,
    levels: renderedLevels,
  };
}

/**
 * Orthogonally projects a pointer onto the nearest 45-degree diagonal through
 * the first anchor. ChartEngine converts the returned pixel point back to the
 * nearest logical bar/price on commit.
 */
export function snapFibCirclePointTo45Degrees(
  start: DrawingPixelPoint,
  candidate: DrawingPixelPoint,
): DrawingPixelPoint {
  const dx = candidate.x - start.x;
  const dy = candidate.y - start.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { ...candidate };

  const xSign = dx < 0 ? -1 : 1;
  const ySign = dy < 0 ? -1 : 1;
  const projectedMagnitude = (Math.abs(dx) + Math.abs(dy)) / 2;
  return {
    x: start.x + xSign * projectedMagnitude,
    y: start.y + ySign * projectedMagnitude,
  };
}

export type FibArcDirection = 'upper' | 'lower';
export type FibArcLabelSide = 'left' | 'right' | 'top' | 'bottom';

export interface FibArcLevelGeometry {
  level: RuntimeFibonacciLevel;
  center: DrawingPixelPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  fullCircle: boolean;
  direction: FibArcDirection;
  labelAnchors: Record<FibArcLabelSide, DrawingPixelPoint>;
}

export interface FibArcsGeometry {
  trend: {
    start: DrawingPixelPoint;
    end: DrawingPixelPoint;
  };
  center: DrawingPixelPoint;
  baseRadius: number;
  direction: FibArcDirection;
  fullCircles: boolean;
  levels: FibArcLevelGeometry[];
}

/**
 * F1C.2 TradingView-fidelity Fib Speed Resistance Arcs geometry.
 *
 * Point 1 is the common arc center. The Point-1 -> Point-2 pixel distance is
 * the level-1 radius. Unlike the legacy EOD implementation, the semicircle is
 * not rotated to the trend-line angle: an upward price move opens upward and a
 * downward price move opens downward. Full Circles appends the opposite half.
 */
export function buildF1CFibArcsGeometry(
  start: DrawingPixelPoint,
  end: DrawingPixelPoint,
  levels: readonly RuntimeFibonacciLevel[],
  fullCircles = false,
): FibArcsGeometry | null {
  const baseRadius = Math.hypot(end.x - start.x, end.y - start.y);
  if (baseRadius < 0.5) return null;

  const direction: FibArcDirection = end.y <= start.y ? 'upper' : 'lower';
  const startAngle = fullCircles ? 0 : direction === 'upper' ? Math.PI : 0;
  const endAngle = fullCircles ? Math.PI * 2 : direction === 'upper' ? Math.PI * 2 : Math.PI;
  const renderedLevels = levels
    .filter((level) => level.enabled && Number.isFinite(level.value))
    .map((level) => {
      const radius = baseRadius * Math.abs(level.value);
      return {
        level,
        center: { ...start },
        radius,
        startAngle,
        endAngle,
        fullCircle: fullCircles,
        direction,
        labelAnchors: {
          left: { x: start.x - radius, y: start.y },
          right: { x: start.x + radius, y: start.y },
          top: { x: start.x, y: start.y - radius },
          bottom: { x: start.x, y: start.y + radius },
        },
      } satisfies FibArcLevelGeometry;
    })
    .filter((entry) => entry.radius >= 0.5)
    .sort((left, right) => Math.abs(left.level.value) - Math.abs(right.level.value));

  return {
    trend: { start: { ...start }, end: { ...end } },
    center: { ...start },
    baseRadius,
    direction,
    fullCircles,
    levels: renderedLevels,
  };
}

/** Returns true when a pointer is inside the active arc sweep, with tolerance. */
export function isPointInsideF1CFibArcSweep(
  point: DrawingPixelPoint,
  entry: FibArcLevelGeometry,
  tolerance = 0,
): boolean {
  if (entry.fullCircle) return true;
  return entry.direction === 'upper'
    ? point.y <= entry.center.y + tolerance
    : point.y >= entry.center.y - tolerance;
}


export interface FibWedgeLevelGeometry {
  level: RuntimeFibonacciLevel;
  center: DrawingPixelPoint;
  radiusX: number;
  radiusY: number;
  startAngle: number;
  endAngle: number;
  anticlockwise: boolean;
  labelAnchor: DrawingPixelPoint;
  points: DrawingPixelPoint[];
}

export interface FibWedgeGeometry {
  apex: DrawingPixelPoint;
  firstHandle: DrawingPixelPoint;
  secondHandle: DrawingPixelPoint;
  baseRadiusX: number;
  baseRadiusY: number;
  startAngle: number;
  endAngle: number;
  sweepDelta: number;
  anticlockwise: boolean;
  firstBoundary: { start: DrawingPixelPoint; end: DrawingPixelPoint };
  secondBoundary: { start: DrawingPixelPoint; end: DrawingPixelPoint };
  levels: FibWedgeLevelGeometry[];
}

function shortestSignedAngleDelta(startAngle: number, endAngle: number): number {
  return Math.atan2(Math.sin(endAngle - startAngle), Math.cos(endAngle - startAngle));
}

function solveCenteredWedgeEllipseRadii(
  apex: DrawingPixelPoint,
  point2: DrawingPixelPoint,
  point3: DrawingPixelPoint,
): { radiusX: number; radiusY: number } | null {
  const ux = point2.x - apex.x;
  const uy = point2.y - apex.y;
  const vx = point3.x - apex.x;
  const vy = point3.y - apex.y;
  const uDistance = Math.hypot(ux, uy);
  const vDistance = Math.hypot(vx, vy);
  if (uDistance < 0.5 || vDistance < 0.5) return null;

  const a = ux * ux;
  const b = uy * uy;
  const c = vx * vx;
  const d = vy * vy;
  const determinant = a * d - c * b;
  const determinantScale = Math.max(Math.abs(a * d), Math.abs(c * b), 1);

  if (Math.abs(determinant) > determinantScale * 1e-9) {
    const inverseRadiusXSquared = (d - b) / determinant;
    const inverseRadiusYSquared = (a - c) / determinant;
    if (
      inverseRadiusXSquared > 1e-12 &&
      inverseRadiusYSquared > 1e-12 &&
      Number.isFinite(inverseRadiusXSquared) &&
      Number.isFinite(inverseRadiusYSquared)
    ) {
      return {
        radiusX: 1 / Math.sqrt(inverseRadiusXSquared),
        radiusY: 1 / Math.sqrt(inverseRadiusYSquared),
      };
    }
  }

  // Symmetric/near-degenerate wedges can leave the centered ellipse underdetermined.
  // This component-wise RMS choice remains affine-covariant under independent X/Y
  // chart scaling and gives an exact solution for the common mirrored case.
  const radiusX = Math.sqrt(a + c);
  const radiusY = Math.sqrt(b + d);
  if (radiusX < 0.5 || radiusY < 0.5 || !Number.isFinite(radiusX + radiusY)) return null;
  return { radiusX, radiusY };
}

function ellipseParameterAngle(
  center: DrawingPixelPoint,
  point: DrawingPixelPoint,
  radiusX: number,
  radiusY: number,
): number {
  return Math.atan2(
    (point.y - center.y) / Math.max(radiusY, 1e-9),
    (point.x - center.x) / Math.max(radiusX, 1e-9),
  );
}

function pointOnEllipse(
  center: DrawingPixelPoint,
  radiusX: number,
  radiusY: number,
  angle: number,
): DrawingPixelPoint {
  return {
    x: center.x + Math.cos(angle) * radiusX,
    y: center.y + Math.sin(angle) * radiusY,
  };
}

function scalePointFromApex(
  apex: DrawingPixelPoint,
  point: DrawingPixelPoint,
  factor: number,
): DrawingPixelPoint {
  return {
    x: apex.x + (point.x - apex.x) * factor,
    y: apex.y + (point.y - apex.y) * factor,
  };
}

function buildWedgeEllipsePath(
  center: DrawingPixelPoint,
  radiusX: number,
  radiusY: number,
  startAngle: number,
  sweepDelta: number,
  exactStart: DrawingPixelPoint,
  exactEnd: DrawingPixelPoint,
): DrawingPixelPoint[] {
  const steps = Math.max(18, Math.ceil(Math.abs(sweepDelta) / (Math.PI / 48)));
  const points: DrawingPixelPoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const angle = startAngle + sweepDelta * t;
    points.push(pointOnEllipse(center, radiusX, radiusY, angle));
  }
  points[0] = exactStart;
  points[points.length - 1] = exactEnd;
  return points;
}

/**
 * F1C.3.2 data-anchored Fib Wedge geometry.
 *
 * IMPORTANT: the input coordinates are canonical chart-data coordinates
 * (bar index on X and price on Y), not pixels. The wedge curve is therefore
 * resolved once in a deterministic dimensionless coordinate system derived
 * only from the three stored anchors. Rendering then projects every sampled
 * data point through the current ScaleX/ScaleY. Zoom, pan, auto-fit and even
 * non-linear price scales can change the visible shape, but cannot move a
 * Fibonacci level to a different bar/price coordinate.
 */
export function buildF1CFibWedgeGeometry(
  anchors: readonly DrawingPixelPoint[],
  levels: readonly RuntimeFibonacciLevel[],
): FibWedgeGeometry | null {
  if (anchors.length < 3) return null;
  const [apex, point2, point3] = anchors;

  // Normalize bar/price units using only persisted anchor deltas. This avoids
  // giving raw price units or raw bar counts accidental geometric dominance,
  // while remaining completely independent of the current viewport.
  const unitX = Math.max(
    Math.abs(point2.x - apex.x),
    Math.abs(point3.x - apex.x),
    1e-6,
  );
  const unitY = Math.max(
    Math.abs(point2.y - apex.y),
    Math.abs(point3.y - apex.y),
    1e-9,
  );
  const toNormalized = (point: DrawingPixelPoint): DrawingPixelPoint => ({
    x: (point.x - apex.x) / unitX,
    y: (point.y - apex.y) / unitY,
  });
  const fromNormalized = (point: DrawingPixelPoint): DrawingPixelPoint => ({
    x: apex.x + point.x * unitX,
    y: apex.y + point.y * unitY,
  });

  const normalizedApex = { x: 0, y: 0 };
  const normalizedPoint2 = toNormalized(point2);
  const normalizedPoint3 = toNormalized(point3);
  const ellipse = solveCenteredWedgeEllipseRadii(
    normalizedApex,
    normalizedPoint2,
    normalizedPoint3,
  );
  if (!ellipse) return null;

  const startAngle = ellipseParameterAngle(
    normalizedApex,
    normalizedPoint2,
    ellipse.radiusX,
    ellipse.radiusY,
  );
  const rawEndAngle = ellipseParameterAngle(
    normalizedApex,
    normalizedPoint3,
    ellipse.radiusX,
    ellipse.radiusY,
  );
  const sweepDelta = shortestSignedAngleDelta(startAngle, rawEndAngle);
  if (Math.abs(sweepDelta) < 1e-4) return null;
  const endAngle = startAngle + sweepDelta;
  const anticlockwise = sweepDelta < 0;

  const renderedLevels = levels
    .filter((level) => level.enabled && Number.isFinite(level.value) && Math.abs(level.value) > 1e-9)
    .map((level) => {
      const factor = Math.abs(level.value);
      const normalizedRadiusX = ellipse.radiusX * factor;
      const normalizedRadiusY = ellipse.radiusY * factor;
      const exactStart = scalePointFromApex(apex, point2, factor);
      const exactEnd = scalePointFromApex(apex, point3, factor);
      const normalizedExactStart = scalePointFromApex(normalizedApex, normalizedPoint2, factor);
      const normalizedExactEnd = scalePointFromApex(normalizedApex, normalizedPoint3, factor);
      const normalizedPoints = buildWedgeEllipsePath(
        normalizedApex,
        normalizedRadiusX,
        normalizedRadiusY,
        startAngle,
        sweepDelta,
        normalizedExactStart,
        normalizedExactEnd,
      );
      const points = normalizedPoints.map(fromNormalized);
      // Preserve exact persisted-boundary intersections after normalization.
      points[0] = exactStart;
      points[points.length - 1] = exactEnd;
      const normalizedLabelAnchor = pointOnEllipse(
        normalizedApex,
        normalizedRadiusX,
        normalizedRadiusY,
        startAngle + sweepDelta / 2,
      );
      return {
        level,
        center: { ...apex },
        radiusX: normalizedRadiusX * unitX,
        radiusY: normalizedRadiusY * unitY,
        startAngle,
        endAngle,
        anticlockwise,
        labelAnchor: fromNormalized(normalizedLabelAnchor),
        points,
      } satisfies FibWedgeLevelGeometry;
    })
    .filter((entry) => entry.points.length >= 2)
    .sort((left, right) => Math.abs(left.level.value) - Math.abs(right.level.value));

  const maxFactor = Math.max(1, ...renderedLevels.map((entry) => Math.abs(entry.level.value)));

  return {
    apex: { ...apex },
    firstHandle: { ...point2 },
    secondHandle: { ...point3 },
    baseRadiusX: ellipse.radiusX * unitX,
    baseRadiusY: ellipse.radiusY * unitY,
    startAngle,
    endAngle,
    sweepDelta,
    anticlockwise,
    firstBoundary: { start: { ...apex }, end: scalePointFromApex(apex, point2, maxFactor) },
    secondBoundary: { start: { ...apex }, end: scalePointFromApex(apex, point3, maxFactor) },
    levels: renderedLevels,
  };
}

/**
 * Projects an already-built data-space Fib Wedge into a viewport. No curve is
 * re-solved here: every sampled bar/price point is mapped independently.
 */
export function projectF1CFibWedgeGeometry(
  geometry: FibWedgeGeometry,
  project: (point: DrawingPixelPoint) => DrawingPixelPoint,
): FibWedgeGeometry {
  const apex = project(geometry.apex);
  const firstHandle = project(geometry.firstHandle);
  const secondHandle = project(geometry.secondHandle);
  const levels = geometry.levels.map((entry) => {
    const center = project(entry.center);
    const points = entry.points.map(project);
    const radiusX = points.reduce((maximum, point) => Math.max(maximum, Math.abs(point.x - center.x)), 0);
    const radiusY = points.reduce((maximum, point) => Math.max(maximum, Math.abs(point.y - center.y)), 0);
    return {
      ...entry,
      center,
      radiusX,
      radiusY,
      labelAnchor: project(entry.labelAnchor),
      points,
    };
  });
  return {
    ...geometry,
    apex,
    firstHandle,
    secondHandle,
    baseRadiusX: levels.find((entry) => Math.abs(entry.level.value - 1) < 1e-9)?.radiusX ?? geometry.baseRadiusX,
    baseRadiusY: levels.find((entry) => Math.abs(entry.level.value - 1) < 1e-9)?.radiusY ?? geometry.baseRadiusY,
    firstBoundary: {
      start: project(geometry.firstBoundary.start),
      end: project(geometry.firstBoundary.end),
    },
    secondBoundary: {
      start: project(geometry.secondBoundary.start),
      end: project(geometry.secondBoundary.end),
    },
    levels,
  };
}

export function distanceToF1CFibWedgeLevel(
  point: DrawingPixelPoint,
  level: FibWedgeLevelGeometry,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < level.points.length; index += 1) {
    const start = level.points[index - 1];
    const end = level.points[index];
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const wx = point.x - start.x;
    const wy = point.y - start.y;
    const lengthSquared = vx * vx + vy * vy;
    const t = lengthSquared <= 1e-12
      ? 0
      : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
    const px = start.x + vx * t;
    const py = start.y + vy * t;
    minimum = Math.min(minimum, Math.hypot(point.x - px, point.y - py));
  }
  return minimum;
}

/** Returns true when a point angle falls inside the wedge's canonical sweep. */
export function isPointInsideF1CFibWedgeSweep(
  point: DrawingPixelPoint,
  geometry: FibWedgeGeometry,
  angularTolerance = 0,
): boolean {
  const angle = ellipseParameterAngle(
    geometry.apex,
    point,
    geometry.baseRadiusX,
    geometry.baseRadiusY,
  );
  const delta = shortestSignedAngleDelta(geometry.startAngle, angle);
  if (geometry.sweepDelta >= 0) {
    return delta >= -angularTolerance && delta <= geometry.sweepDelta + angularTolerance;
  }
  return delta <= angularTolerance && delta >= geometry.sweepDelta - angularTolerance;
}

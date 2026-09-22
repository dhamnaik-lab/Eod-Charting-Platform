import type { FibonacciPixelPoint } from './DrawingFibonacciGeometry';

export const FIBONACCI_GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export interface FibSpiralDataPoint {
  x: number;
  y: number;
}

export interface FibSpiralPerpBasis {
  barDelta: number;
  priceDelta: number;
}

export interface FibSpiralGeometry {
  center: FibSpiralDataPoint;
  reference: FibSpiralDataPoint;
  points: FibSpiralDataPoint[];
}

export function buildF1DFibSpiralPerpBasis(
  center: FibSpiralDataPoint,
  reference: FibSpiralDataPoint,
  project: (point: FibSpiralDataPoint) => FibonacciPixelPoint,
  unproject: (point: FibonacciPixelPoint) => FibSpiralDataPoint,
): FibSpiralPerpBasis | null {
  const centerPx = project(center);
  const referencePx = project(reference);
  const dx = referencePx.x - centerPx.x;
  const dy = referencePx.y - centerPx.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 1e-6) return null;

  // Canvas y grows downward. (-dy, dx) is the clockwise 90° basis.
  const perpPx = { x: centerPx.x - dy, y: centerPx.y + dx };
  const perpData = unproject(perpPx);
  return {
    barDelta: perpData.x - center.x,
    priceDelta: perpData.y - center.y,
  };
}

export function buildF1DFibSpiralGeometry(
  center: FibSpiralDataPoint,
  reference: FibSpiralDataPoint,
  basisPerp: FibSpiralPerpBasis,
  counterclockwise = false,
  options: { inwardTurns?: number; outwardTurns?: number; samplesPerTurn?: number } = {},
): FibSpiralGeometry | null {
  const radial = { x: reference.x - center.x, y: reference.y - center.y };
  if (
    !Number.isFinite(radial.x) || !Number.isFinite(radial.y) ||
    !Number.isFinite(basisPerp.barDelta) || !Number.isFinite(basisPerp.priceDelta) ||
    Math.hypot(radial.x, radial.y) < 1e-9
  ) return null;

  const inwardTurns = Math.max(0.5, Math.min(options.inwardTurns ?? 2, 4));
  const outwardTurns = Math.max(1, Math.min(options.outwardTurns ?? 4, 6));
  const samplesPerTurn = Math.max(48, Math.min(Math.round(options.samplesPerTurn ?? 96), 192));
  const step = (Math.PI * 2) / samplesPerTurn;
  const tMin = -inwardTurns * Math.PI * 2;
  const tMax = outwardTurns * Math.PI * 2;
  const direction = counterclockwise ? -1 : 1;
  const points: FibSpiralDataPoint[] = [];
  const total = Math.round((tMax - tMin) / step);

  for (let i = 0; i <= total; i += 1) {
    const t = tMin + i * step;
    const growth = Math.pow(FIBONACCI_GOLDEN_RATIO, (2 * t) / Math.PI);
    const cos = Math.cos(t);
    const sin = Math.sin(t) * direction;
    points.push({
      x: center.x + growth * (cos * radial.x + sin * basisPerp.barDelta),
      y: center.y + growth * (cos * radial.y + sin * basisPerp.priceDelta),
    });
  }

  return { center: { ...center }, reference: { ...reference }, points };
}

export function projectF1DFibSpiralGeometry(
  geometry: FibSpiralGeometry,
  project: (point: FibSpiralDataPoint) => FibonacciPixelPoint,
): { center: FibonacciPixelPoint; reference: FibonacciPixelPoint; points: FibonacciPixelPoint[] } {
  return {
    center: project(geometry.center),
    reference: project(geometry.reference),
    points: geometry.points.map(project),
  };
}

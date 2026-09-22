import type { FibonacciLevelDefinition } from './DrawingFibonacciContracts';

/** Shared renderer/hit-test geometry primitives for the F1 Fibonacci family. */
export interface FibonacciPixelPoint {
  x: number;
  y: number;
}

export interface FibonacciPixelSegment {
  start: FibonacciPixelPoint;
  end: FibonacciPixelPoint;
}

export interface FibonacciRenderedLevel<TGeometry> {
  levelId: string;
  coefficient: number;
  geometry: TGeometry;
}

export interface FibonacciBandGeometry {
  fromLevelId: string;
  toLevelId: string;
  points: FibonacciPixelPoint[];
}

export interface FibonacciArcGeometry {
  center: FibonacciPixelPoint;
  radiusX: number;
  radiusY: number;
  startAngle: number;
  endAngle: number;
  counterclockwise?: boolean;
}

export interface FibonacciSampledPathGeometry {
  points: FibonacciPixelPoint[];
  bounds: { left: number; top: number; right: number; bottom: number };
}

export function getEnabledFibonacciLevels(levels: readonly FibonacciLevelDefinition[]): FibonacciLevelDefinition[] {
  return levels.filter((level) => level.enabled !== false).map((level) => ({ ...level }));
}

export function findFibonacciLevelById(
  levels: readonly FibonacciLevelDefinition[],
  levelId: string,
): FibonacciLevelDefinition | undefined {
  return levels.find((level) => level.id === levelId);
}

export function normalizeFibonacciAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  const turn = Math.PI * 2;
  let normalized = angle % turn;
  if (normalized < 0) normalized += turn;
  return normalized;
}

export function createFibonacciLevelStyleSlotId(levelId: string, family: 'level' | 'price' | 'time' = 'level'): string {
  return `${family}:${levelId}`;
}

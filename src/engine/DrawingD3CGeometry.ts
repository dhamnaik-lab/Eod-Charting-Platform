import type { DrawingAnchor } from './types';
import type { DrawingPoint, DrawingSegment } from './DrawingGeometry';

export type PositionDrawingKind = 'longPosition' | 'shortPosition';
export type D3CDrawingKind = PositionDrawingKind | 'projection';

export interface PositionMetrics {
  entry: number;
  target: number;
  stop: number;
  risk: number;
  reward: number;
  riskPercent: number;
  rewardPercent: number;
  riskRewardRatio: number | null;
  validOrientation: boolean;
}

export interface PositionPixelGeometry {
  entry: DrawingSegment;
  target: DrawingSegment;
  stop: DrawingSegment;
  leftEdge: DrawingSegment;
  rightEdge: DrawingSegment;
  left: number;
  right: number;
  entryY: number;
  targetY: number;
  stopY: number;
}

export interface ProjectionMetrics {
  startPrice: number;
  endPrice: number;
  projectionStartPrice: number;
  targetPrice: number;
  moveSize: number;
  movePercent: number;
  barSpan: number;
  targetBarIndex: number;
  isUp: boolean;
}

export interface ProjectionPixelGeometry {
  a: DrawingPoint;
  b: DrawingPoint;
  c: DrawingPoint;
  d: DrawingPoint;
  reference: DrawingSegment;
  projected: DrawingSegment;
  connectorA: DrawingSegment;
  connectorB: DrawingSegment;
}

const EPSILON = 1e-9;

export function isD3CDrawingKind(kind: string): kind is D3CDrawingKind {
  return kind === 'longPosition' || kind === 'shortPosition' || kind === 'projection';
}

/**
 * Position tools use anchor 0 = Entry, anchor 1 = Target/end-time,
 * anchor 2 = Stop. Target and Stop intentionally share one horizontal end
 * index so the risk/reward zones remain a single coherent planning block.
 */
export function normalizePositionAnchors(
  kind: PositionDrawingKind,
  anchors: readonly DrawingAnchor[],
): DrawingAnchor[] {
  const normalized = anchors.map((anchor) => ({ ...anchor }));
  if (normalized.length >= 3) {
    const entry = normalized[0].price;
    const targetDistance = Math.abs(normalized[1].price - entry);
    const stopDistance = Math.abs(normalized[2].price - entry);
    normalized[1] = {
      ...normalized[1],
      price: kind === 'longPosition' ? entry + targetDistance : entry - targetDistance,
    };
    normalized[2] = {
      ...normalized[2],
      barIndex: normalized[1].barIndex,
      price: kind === 'longPosition' ? entry - stopDistance : entry + stopDistance,
    };
  }
  return normalized;
}

export function calculatePositionMetrics(
  kind: PositionDrawingKind,
  anchors: readonly Pick<DrawingAnchor, 'price'>[],
): PositionMetrics | null {
  if (anchors.length < 3) return null;
  const entry = anchors[0].price;
  const target = anchors[1].price;
  const stop = anchors[2].price;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const denominator = Math.abs(entry) > EPSILON ? Math.abs(entry) : 0;
  const riskPercent = denominator > 0 ? (risk / denominator) * 100 : 0;
  const rewardPercent = denominator > 0 ? (reward / denominator) * 100 : 0;
  const riskRewardRatio = risk > EPSILON ? reward / risk : null;
  const validOrientation = kind === 'longPosition'
    ? target > entry && stop < entry
    : target < entry && stop > entry;

  return {
    entry,
    target,
    stop,
    risk,
    reward,
    riskPercent,
    rewardPercent,
    riskRewardRatio,
    validOrientation,
  };
}

export function buildPositionPixelGeometry(anchors: readonly DrawingPoint[]): PositionPixelGeometry | null {
  if (anchors.length < 3) return null;
  const entryPoint = anchors[0];
  const targetPoint = anchors[1];
  const stopPoint = anchors[2];
  const endX = targetPoint.x;
  const left = Math.min(entryPoint.x, endX);
  const right = Math.max(entryPoint.x, endX);

  return {
    entry: { start: { x: entryPoint.x, y: entryPoint.y }, end: { x: endX, y: entryPoint.y } },
    target: { start: { x: entryPoint.x, y: targetPoint.y }, end: { x: endX, y: targetPoint.y } },
    stop: { start: { x: entryPoint.x, y: stopPoint.y }, end: { x: endX, y: stopPoint.y } },
    leftEdge: { start: { x: entryPoint.x, y: targetPoint.y }, end: { x: entryPoint.x, y: stopPoint.y } },
    rightEdge: { start: { x: endX, y: targetPoint.y }, end: { x: endX, y: stopPoint.y } },
    left,
    right,
    entryY: entryPoint.y,
    targetY: targetPoint.y,
    stopY: stopPoint.y,
  };
}

export function pointInPositionGeometry(point: DrawingPoint, geometry: PositionPixelGeometry): boolean {
  const top = Math.min(geometry.targetY, geometry.stopY);
  const bottom = Math.max(geometry.targetY, geometry.stopY);
  return point.x >= geometry.left && point.x <= geometry.right && point.y >= top && point.y <= bottom;
}

export function calculateProjectionMetrics(
  anchors: readonly Pick<DrawingAnchor, 'barIndex' | 'price'>[],
): ProjectionMetrics | null {
  if (anchors.length < 3) return null;
  const [a, b, c] = anchors;
  const moveSize = b.price - a.price;
  const movePercent = Math.abs(a.price) > EPSILON ? (moveSize / a.price) * 100 : 0;
  const barSpan = b.barIndex - a.barIndex;
  return {
    startPrice: a.price,
    endPrice: b.price,
    projectionStartPrice: c.price,
    targetPrice: c.price + moveSize,
    moveSize,
    movePercent,
    barSpan,
    targetBarIndex: c.barIndex + barSpan,
    isUp: moveSize >= 0,
  };
}

export function buildProjectionPixelGeometry(anchors: readonly DrawingPoint[]): ProjectionPixelGeometry | null {
  if (anchors.length < 3) return null;
  const [a, b, c] = anchors;
  const d = { x: c.x + (b.x - a.x), y: c.y + (b.y - a.y) };
  return {
    a,
    b,
    c,
    d,
    reference: { start: a, end: b },
    projected: { start: c, end: d },
    connectorA: { start: a, end: c },
    connectorB: { start: b, end: d },
  };
}

export function buildD3CHitSegments(kind: D3CDrawingKind, anchors: readonly DrawingPoint[]): DrawingSegment[] {
  if (kind === 'projection') {
    const geometry = buildProjectionPixelGeometry(anchors);
    return geometry
      ? [geometry.reference, geometry.projected, geometry.connectorA, geometry.connectorB]
      : [];
  }

  const geometry = buildPositionPixelGeometry(anchors);
  return geometry
    ? [geometry.entry, geometry.target, geometry.stop, geometry.leftEdge, geometry.rightEdge]
    : [];
}

import type { DrawingPoint, DrawingSegment } from './DrawingGeometry';
import { extendSegmentHorizontally } from './DrawingGeometry';

export type PitchforkKind = 'andrewsPitchfork' | 'schiffPitchfork' | 'modifiedSchiffPitchfork' | 'insidePitchfork';

export const TREND_FIB_EXTENSION_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618] as const;
export const FIB_CHANNEL_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618] as const;
export const FIB_TIME_EXTENSION_LEVELS = [0, 0.382, 0.5, 0.618, 1, 1.618, 2, 2.618, 4.236] as const;
export const FIB_WEDGE_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const PITCHFAN_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

function midpoint(a: DrawingPoint, b: DrawingPoint): DrawingPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pitchforkPivot(kind: PitchforkKind, p0: DrawingPoint, p1: DrawingPoint): DrawingPoint {
  if (kind === 'schiffPitchfork') return midpoint(p0, p1);
  if (kind === 'modifiedSchiffPitchfork') return { x: p0.x, y: (p0.y + p1.y) / 2 };
  return p0;
}

export function buildPitchforkSegments(
  kind: PitchforkKind,
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = true,
): DrawingSegment[] {
  if (anchors.length < 3) return [];
  const [p0, p1, p2] = anchors;
  const pivot = pitchforkPivot(kind, p0, p1);
  const mid = midpoint(p1, p2);
  const dx = mid.x - pivot.x;
  const dy = mid.y - pivot.y;
  if (Math.hypot(dx, dy) < 1e-9) return [];
  const convergence = { x: pivot.x + dx * 3, y: pivot.y + dy * 3 };
  const raw: DrawingSegment[] = kind === 'insidePitchfork'
    ? [
        { start: pivot, end: convergence },
        { start: p1, end: convergence },
        { start: p2, end: convergence },
      ]
    : [
        { start: pivot, end: convergence },
        { start: p1, end: { x: p1.x + dx * 3, y: p1.y + dy * 3 } },
        { start: p2, end: { x: p2.x + dx * 3, y: p2.y + dy * 3 } },
      ];
  return raw.map((segment) => extendSegmentHorizontally(segment.start, segment.end, width, extendLeft, extendRight));
}

export function buildTrendFibExtensionSegments(
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = true,
): Array<{ level: number; segment: DrawingSegment }> {
  if (anchors.length < 3) return [];
  const [a, b, c] = anchors;
  const baseSpan = Math.max(Math.abs(b.x - a.x), 48);
  return TREND_FIB_EXTENSION_LEVELS.map((level) => {
    const y = c.y + (b.y - a.y) * level;
    const base = { start: { x: c.x, y }, end: { x: c.x + baseSpan, y } };
    return { level, segment: extendSegmentHorizontally(base.start, base.end, width, extendLeft, extendRight) };
  });
}

export function buildFibChannelSegments(
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = false,
): Array<{ level: number; segment: DrawingSegment }> {
  if (anchors.length < 3) return [];
  const [p1, p2, p3] = anchors;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  let offset = { x: 0, y: p3.y - p1.y };
  if (len > 1e-9) {
    const nx = -dy / len;
    const ny = dx / len;
    const dist = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;
    offset = { x: nx * dist, y: ny * dist };
  }
  return FIB_CHANNEL_LEVELS.map((level) => {
    const start = { x: p1.x + offset.x * level, y: p1.y + offset.y * level };
    const end = { x: p2.x + offset.x * level, y: p2.y + offset.y * level };
    return { level, segment: extendSegmentHorizontally(start, end, width, extendLeft, extendRight) };
  });
}

export function buildFibTimeExtensionXs(anchors: readonly DrawingPoint[]): Array<{ level: number; x: number }> {
  if (anchors.length < 3) return [];
  const [p1, p2, p3] = anchors;
  const span = p2.x - p1.x;
  return FIB_TIME_EXTENSION_LEVELS.map((level) => ({ level, x: p3.x + span * level }));
}

export function buildFibWedgeSegments(anchors: readonly DrawingPoint[]): Array<{ level: number; segment: DrawingSegment }> {
  if (anchors.length < 3) return [];
  const [apex, p1, p2] = anchors;
  return FIB_WEDGE_LEVELS.map((level) => ({
    level,
    segment: {
      start: apex,
      end: { x: p1.x + (p2.x - p1.x) * level, y: p1.y + (p2.y - p1.y) * level },
    },
  }));
}

export function buildPitchfanSegments(
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = true,
): Array<{ level: number; segment: DrawingSegment }> {
  if (anchors.length < 3) return [];
  const [pivot, p1, p2] = anchors;
  return PITCHFAN_LEVELS.map((level) => {
    const target = { x: p1.x + (p2.x - p1.x) * level, y: p1.y + (p2.y - p1.y) * level };
    const end = { x: pivot.x + (target.x - pivot.x) * 3, y: pivot.y + (target.y - pivot.y) * 3 };
    return { level, segment: extendSegmentHorizontally(pivot, end, width, extendLeft, extendRight) };
  });
}

export type D3BDrawingKind = PitchforkKind | 'trendFibExtension' | 'fibChannel' | 'fibTimeExtension' | 'fibWedge' | 'pitchfan';

const D3B_KINDS = new Set<D3BDrawingKind>([
  'andrewsPitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork',
  'trendFibExtension', 'fibChannel', 'fibTimeExtension', 'fibWedge', 'pitchfan',
]);

export function isD3BDrawingKind(kind: string): kind is D3BDrawingKind {
  return D3B_KINDS.has(kind as D3BDrawingKind);
}

export function buildD3BHitSegments(
  kind: D3BDrawingKind,
  anchors: readonly DrawingPoint[],
  width: number,
  height: number,
  extendLeft = false,
  extendRight = false,
): DrawingSegment[] {
  if (kind === 'andrewsPitchfork' || kind === 'schiffPitchfork' || kind === 'modifiedSchiffPitchfork' || kind === 'insidePitchfork') {
    return buildPitchforkSegments(kind, anchors, width, extendLeft, extendRight);
  }
  if (kind === 'trendFibExtension') {
    return buildTrendFibExtensionSegments(anchors, width, extendLeft, extendRight).map((entry) => entry.segment);
  }
  if (kind === 'fibChannel') {
    return buildFibChannelSegments(anchors, width, extendLeft, extendRight).map((entry) => entry.segment);
  }
  if (kind === 'fibTimeExtension') {
    return buildFibTimeExtensionXs(anchors).map(({ x }) => ({ start: { x, y: 0 }, end: { x, y: height } }));
  }
  if (kind === 'fibWedge') {
    return buildFibWedgeSegments(anchors).map((entry) => entry.segment);
  }
  return buildPitchfanSegments(anchors, width, extendLeft, extendRight).map((entry) => entry.segment);
}

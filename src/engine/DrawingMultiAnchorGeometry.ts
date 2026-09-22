import type { DrawingTool } from './types';
import type { DrawingPoint, DrawingSegment } from './DrawingGeometry';
import { extendSegmentHorizontally } from './DrawingGeometry';

export type MultiAnchorDrawingTool =
  | 'flatChannel'
  | 'disjointChannel'
  | 'triangle'
  | 'rotatedRect'
  | 'arc'
  | 'andrewsPitchfork'
  | 'schiffPitchfork'
  | 'modifiedSchiffPitchfork'
  | 'insidePitchfork'
  | 'trendFibExtension'
  | 'fibChannel'
  | 'fibTimeExtension'
  | 'fibWedge'
  | 'pitchfan'
  | 'longPosition'
  | 'shortPosition'
  | 'projection'
  | 'xabcdPattern'
  | 'abcdPattern'
  | 'headAndShouldersPattern'
  | 'elliottImpulse'
  | 'elliottCorrection';

const REQUIRED_ANCHORS: Record<MultiAnchorDrawingTool, number> = {
  flatChannel: 3,
  disjointChannel: 4,
  triangle: 3,
  rotatedRect: 3,
  arc: 3,
  andrewsPitchfork: 3,
  schiffPitchfork: 3,
  modifiedSchiffPitchfork: 3,
  insidePitchfork: 3,
  trendFibExtension: 3,
  fibChannel: 3,
  fibTimeExtension: 3,
  fibWedge: 3,
  pitchfan: 3,
  longPosition: 3,
  shortPosition: 3,
  projection: 3,
  xabcdPattern: 5,
  abcdPattern: 4,
  headAndShouldersPattern: 7,
  elliottImpulse: 6,
  elliottCorrection: 4,
};

export function isMultiAnchorDrawingTool(tool: DrawingTool): tool is MultiAnchorDrawingTool {
  return Object.prototype.hasOwnProperty.call(REQUIRED_ANCHORS, tool);
}

export function getRequiredMultiAnchorCount(tool: MultiAnchorDrawingTool): number {
  return REQUIRED_ANCHORS[tool];
}

export function buildFlatChannelSegments(
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = false,
): [DrawingSegment, DrawingSegment] | null {
  if (anchors.length < 3) return null;
  const [p1, p2, p3] = anchors;
  const trend = extendSegmentHorizontally(p1, p2, width, extendLeft, extendRight);
  const flat = extendSegmentHorizontally(
    { x: p1.x, y: p3.y },
    { x: p2.x, y: p3.y },
    width,
    extendLeft,
    extendRight,
  );
  return [trend, flat];
}

export function buildDisjointChannelSegments(
  anchors: readonly DrawingPoint[],
  width: number,
  extendLeft = false,
  extendRight = false,
): [DrawingSegment, DrawingSegment] | null {
  if (anchors.length < 4) return null;
  return [
    extendSegmentHorizontally(anchors[0], anchors[1], width, extendLeft, extendRight),
    extendSegmentHorizontally(anchors[2], anchors[3], width, extendLeft, extendRight),
  ];
}

export function getRotatedRectangleCorners(anchors: readonly DrawingPoint[]): DrawingPoint[] | null {
  if (anchors.length < 3) return null;
  const [p1, p2, p3] = anchors;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const edgeLength = Math.hypot(dx, dy);
  if (edgeLength < 1e-9) return null;

  const perpX = -dy / edgeLength;
  const perpY = dx / edgeLength;
  const height = (p3.x - p1.x) * perpX + (p3.y - p1.y) * perpY;

  return [
    p1,
    p2,
    { x: p2.x + perpX * height, y: p2.y + perpY * height },
    { x: p1.x + perpX * height, y: p1.y + perpY * height },
  ];
}

export interface DrawingArcParameters {
  center: DrawingPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export function getArcParameters(anchors: readonly DrawingPoint[]): DrawingArcParameters | null {
  if (anchors.length < 3) return null;
  const [center, start, end] = anchors;
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  if (radius < 1e-9) return null;
  return {
    center,
    radius,
    startAngle: Math.atan2(start.y - center.y, start.x - center.x),
    endAngle: Math.atan2(end.y - center.y, end.x - center.x),
  };
}

export function pointInPolygon(point: DrawingPoint, polygon: readonly DrawingPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const denom = b.y - a.y;
    if (Math.abs(denom) < 1e-9) continue;
    const xAtY = ((b.x - a.x) * (point.y - a.y)) / denom + a.x;
    if (point.x < xAtY) inside = !inside;
  }
  return inside;
}

export function isAngleOnArc(angle: number, startAngle: number, endAngle: number): boolean {
  const tau = Math.PI * 2;
  const normalize = (value: number) => ((value % tau) + tau) % tau;
  const start = normalize(startAngle);
  const end = normalize(endAngle);
  const candidate = normalize(angle);
  return start <= end ? candidate >= start && candidate <= end : candidate >= start || candidate <= end;
}

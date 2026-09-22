import { describe, expect, it } from 'vitest';
import {
  buildDisjointChannelSegments,
  buildFlatChannelSegments,
  getArcParameters,
  getRequiredMultiAnchorCount,
  getRotatedRectangleCorners,
  isMultiAnchorDrawingTool,
  pointInPolygon,
} from '../DrawingMultiAnchorGeometry';

describe('DrawingMultiAnchorGeometry', () => {
  it('declares stable required anchor counts for the D3A tools', () => {
    expect(getRequiredMultiAnchorCount('flatChannel')).toBe(3);
    expect(getRequiredMultiAnchorCount('disjointChannel')).toBe(4);
    expect(getRequiredMultiAnchorCount('triangle')).toBe(3);
    expect(getRequiredMultiAnchorCount('rotatedRect')).toBe(3);
    expect(getRequiredMultiAnchorCount('arc')).toBe(3);
    expect(isMultiAnchorDrawingTool('triangle')).toBe(true);
    expect(isMultiAnchorDrawingTool('trendline')).toBe(false);
  });

  it('builds flat and disjoint channel segments while respecting extension flags', () => {
    const flat = buildFlatChannelSegments(
      [{ x: 20, y: 20 }, { x: 80, y: 40 }, { x: 50, y: 70 }],
      100,
      true,
      true,
    );
    expect(flat).not.toBeNull();
    expect(flat?.[0].start.x).toBe(0);
    expect(flat?.[0].end.x).toBe(100);
    expect(flat?.[1].start.x).toBe(0);
    expect(flat?.[1].end.x).toBe(100);

    const disjoint = buildDisjointChannelSegments(
      [{ x: 10, y: 10 }, { x: 50, y: 20 }, { x: 20, y: 60 }, { x: 70, y: 45 }],
      100,
    );
    expect(disjoint).toEqual([
      { start: { x: 10, y: 10 }, end: { x: 50, y: 20 } },
      { start: { x: 20, y: 60 }, end: { x: 70, y: 45 } },
    ]);
  });

  it('calculates rotated-rectangle corners from an edge plus height anchor', () => {
    expect(getRotatedRectangleCorners([
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 20, y: 30 },
    ])).toEqual([
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 50, y: 30 },
      { x: 10, y: 30 },
    ]);
  });

  it('calculates arc center/radius/angles from three anchors', () => {
    const arc = getArcParameters([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]);
    expect(arc?.radius).toBeCloseTo(10);
    expect(arc?.startAngle).toBeCloseTo(0);
    expect(arc?.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it('detects interior points for multi-anchor filled geometry', () => {
    expect(pointInPolygon(
      { x: 5, y: 5 },
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    )).toBe(true);
    expect(pointInPolygon(
      { x: 15, y: 5 },
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    )).toBe(false);
  });
});

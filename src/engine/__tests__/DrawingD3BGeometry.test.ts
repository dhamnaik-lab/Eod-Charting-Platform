import { describe, expect, it } from 'vitest';
import {
  FIB_CHANNEL_LEVELS,
  FIB_TIME_EXTENSION_LEVELS,
  FIB_WEDGE_LEVELS,
  PITCHFAN_LEVELS,
  TREND_FIB_EXTENSION_LEVELS,
  buildFibChannelSegments,
  buildFibTimeExtensionXs,
  buildFibWedgeSegments,
  buildPitchfanSegments,
  buildPitchforkSegments,
  buildTrendFibExtensionSegments,
} from '../DrawingD3BGeometry';

const anchors = [
  { x: 20, y: 80 },
  { x: 80, y: 30 },
  { x: 100, y: 95 },
] as const;

describe('D3B geometry', () => {
  it('builds three-line pitchfork geometry for all four variants', () => {
    for (const kind of ['andrewsPitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork'] as const) {
      const segments = buildPitchforkSegments(kind, anchors, 240, false, true);
      expect(segments).toHaveLength(3);
      expect(segments.every((segment) => Number.isFinite(segment.start.x + segment.start.y + segment.end.x + segment.end.y))).toBe(true);
    }
  });

  it('projects trend-based Fibonacci extension levels from point C', () => {
    const levels = buildTrendFibExtensionSegments(anchors, 240, false, true);
    expect(levels).toHaveLength(TREND_FIB_EXTENSION_LEVELS.length);
    expect(levels.find((entry) => entry.level === 1)?.segment.start.y).toBeCloseTo(45);
  });

  it('builds parallel Fibonacci channel levels from the third anchor offset', () => {
    const levels = buildFibChannelSegments(anchors, 240);
    expect(levels).toHaveLength(FIB_CHANNEL_LEVELS.length);
    expect(levels[0].segment.start).toEqual(anchors[0]);
  });

  it('projects trend-based Fibonacci time levels from the third anchor', () => {
    const levels = buildFibTimeExtensionXs(anchors);
    expect(levels).toHaveLength(FIB_TIME_EXTENSION_LEVELS.length);
    expect(levels.find((entry) => entry.level === 1)?.x).toBeCloseTo(160);
  });

  it('builds wedge and pitchfan level families from three anchors', () => {
    expect(buildFibWedgeSegments(anchors)).toHaveLength(FIB_WEDGE_LEVELS.length);
    expect(buildPitchfanSegments(anchors, 240, false, true)).toHaveLength(PITCHFAN_LEVELS.length);
  });
});

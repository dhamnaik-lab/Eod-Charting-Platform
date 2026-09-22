import { describe, expect, it } from 'vitest';
import { drawingSupportsExtension, drawingSupportsLabelVisibility } from '../DrawingCapabilities';
import { getRequiredMultiAnchorCount, isMultiAnchorDrawingTool } from '../DrawingMultiAnchorGeometry';
import type { ChartDrawing, DrawingTool } from '../types';

const d3bTools: DrawingTool[] = [
  'andrewsPitchfork',
  'schiffPitchfork',
  'modifiedSchiffPitchfork',
  'insidePitchfork',
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'fibWedge',
  'pitchfan',
];

describe('D3B drawing contracts', () => {
  it('registers all nine tools as three-anchor drawings', () => {
    for (const tool of d3bTools) {
      expect(isMultiAnchorDrawingTool(tool)).toBe(true);
      expect(getRequiredMultiAnchorCount(tool as Parameters<typeof getRequiredMultiAnchorCount>[0])).toBe(3);
    }
  });

  it('exposes shared extension and label capabilities only where the geometry supports them', () => {
    for (const kind of ['andrewsPitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork', 'trendFibExtension', 'fibChannel', 'pitchfan'] as const) {
      expect(drawingSupportsExtension(kind)).toBe(true);
    }
    expect(drawingSupportsExtension('fibTimeExtension')).toBe(false);
    expect(drawingSupportsExtension('fibWedge')).toBe(false);

    for (const kind of ['trendFibExtension', 'fibChannel', 'fibTimeExtension', 'fibWedge', 'pitchfan'] as const) {
      expect(drawingSupportsLabelVisibility(kind)).toBe(true);
    }
    expect(drawingSupportsLabelVisibility('andrewsPitchfork')).toBe(false);
  });

  it('keeps D3B drawings JSON-safe for workspace persistence', () => {
    const drawing: ChartDrawing = {
      id: 'd3b',
      kind: 'trendFibExtension',
      color: '#4fa7ff',
      lineWidth: 1.4,
      lineStyle: 'solid',
      paneId: 'price',
      extendRight: true,
      showLabel: true,
      anchors: [
        { barIndex: 1, price: 100, timestamp: 1 },
        { barIndex: 3, price: 120, timestamp: 3 },
        { barIndex: 5, price: 110, timestamp: 5 },
      ],
    };
    expect(JSON.parse(JSON.stringify(drawing))).toEqual(drawing);
  });
});

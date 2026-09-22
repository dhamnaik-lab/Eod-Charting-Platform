import { describe, expect, it } from 'vitest';
import {
  drawingSupportsExtension,
  drawingSupportsLabelPosition,
  drawingSupportsLabelVisibility,
} from '../DrawingCapabilities';
import { getDrawingKindTitle } from '../DrawingMetadata';
import { getRequiredMultiAnchorCount, isMultiAnchorDrawingTool } from '../DrawingMultiAnchorGeometry';
import type { ChartDrawing, DrawingTool } from '../types';

const d3cTools: DrawingTool[] = ['longPosition', 'shortPosition', 'projection'];

describe('D3C drawing contracts', () => {
  it('registers Long Position, Short Position and Projection as three-anchor tools', () => {
    for (const tool of d3cTools) {
      expect(isMultiAnchorDrawingTool(tool)).toBe(true);
      expect(getRequiredMultiAnchorCount(tool as Parameters<typeof getRequiredMultiAnchorCount>[0])).toBe(3);
    }
  });

  it('exposes only the shared properties that apply to these tools', () => {
    expect(drawingSupportsLabelVisibility('longPosition')).toBe(true);
    expect(drawingSupportsLabelVisibility('shortPosition')).toBe(true);
    expect(drawingSupportsLabelVisibility('projection')).toBe(true);
    expect(drawingSupportsLabelPosition('projection')).toBe(true);
    expect(drawingSupportsLabelPosition('longPosition')).toBe(false);
    expect(drawingSupportsExtension('longPosition')).toBe(false);
    expect(drawingSupportsExtension('shortPosition')).toBe(false);
    expect(drawingSupportsExtension('projection')).toBe(false);
  });

  it('keeps the new drawings JSON-safe and gives them stable Properties titles', () => {
    const drawing: ChartDrawing = {
      id: 'projection-1',
      kind: 'projection',
      color: '#4fa7ff',
      lineWidth: 1.4,
      lineStyle: 'solid',
      paneId: 'price',
      showLabel: true,
      labelPosition: 'left',
      anchors: [
        { barIndex: 1, price: 100, timestamp: 1 },
        { barIndex: 3, price: 120, timestamp: 3 },
        { barIndex: 5, price: 110, timestamp: 5 },
      ],
    };
    expect(JSON.parse(JSON.stringify(drawing))).toEqual(drawing);
    expect(getDrawingKindTitle('longPosition')).toBe('Long Position');
    expect(getDrawingKindTitle('shortPosition')).toBe('Short Position');
    expect(getDrawingKindTitle('projection')).toBe('Projection');
  });
});

import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '../types';
import { drawingSupportsExtension, drawingSupportsLabelVisibility } from '../DrawingCapabilities';

const common = {
  color: '#3b82f6',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

const anchors3 = [
  { barIndex: 1, price: 100 },
  { barIndex: 4, price: 110 },
  { barIndex: 3, price: 95 },
];

const anchors4 = [...anchors3, { barIndex: 6, price: 105 }];

describe('D3A multi-anchor drawing contracts', () => {
  it('stores generalized anchors without changing legacy two-anchor schemas', () => {
    const drawings: ChartDrawing[] = [
      { ...common, id: 'flat', kind: 'flatChannel', anchors: anchors3 },
      { ...common, id: 'disjoint', kind: 'disjointChannel', anchors: anchors4 },
      { ...common, id: 'triangle', kind: 'triangle', anchors: anchors3 },
      { ...common, id: 'rotated', kind: 'rotatedRect', anchors: anchors3 },
      { ...common, id: 'arc', kind: 'arc', anchors: anchors3 },
      { ...common, id: 'legacy', kind: 'trendline', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
    ];
    expect(drawings.filter((drawing) => 'anchors' in drawing)).toHaveLength(5);
    expect('startIndex' in drawings[5]).toBe(true);
  });

  it('reuses shared extension capabilities for the channel families only', () => {
    expect(drawingSupportsExtension('flatChannel')).toBe(true);
    expect(drawingSupportsExtension('disjointChannel')).toBe(true);
    expect(drawingSupportsExtension('triangle')).toBe(false);
    expect(drawingSupportsExtension('rotatedRect')).toBe(false);
    expect(drawingSupportsExtension('arc')).toBe(false);
  });

  it('does not invent labels for D3A tools that have no label contract', () => {
    for (const kind of ['flatChannel', 'disjointChannel', 'triangle', 'rotatedRect', 'arc'] as const) {
      expect(drawingSupportsLabelVisibility(kind)).toBe(false);
    }
  });
});

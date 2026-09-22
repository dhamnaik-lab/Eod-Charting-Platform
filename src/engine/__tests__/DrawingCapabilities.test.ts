import { describe, expect, it } from 'vitest';
import {
  drawingSupportsExtension,
  drawingSupportsLabelVisibility,
  isDrawingLabelVisible,
  drawingSupportsLabelPosition,
} from '../DrawingCapabilities';
import type { ChartDrawing } from '../types';

const common = {
  id: 'drawing',
  color: '#4fa7ff',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

describe('DrawingCapabilities', () => {
  it('exposes Extend Left/Right only for drawings with extendable line or channel geometry', () => {
    for (const kind of ['trendline', 'infoLine', 'trendAngle', 'regressionTrend', 'channel', 'fib', 'flatChannel', 'disjointChannel'] as const) {
      expect(drawingSupportsExtension(kind)).toBe(true);
    }
    for (const kind of ['ray', 'extendedLine', 'forecast', 'fibTimeZone', 'circle'] as const) {
      expect(drawingSupportsExtension(kind)).toBe(false);
    }
  });

  it('exposes Show Label for every existing drawing family that renders a configurable label', () => {
    for (const kind of [
      'infoLine',
      'trendAngle',
      'priceRange',
      'dateRange',
      'regressionTrend',
      'fibTimeZone',
      'fibCircles',
      'fibArcs',
      'forecast',
      'fib',
      'fibExtension',
      'fibFan',
      'gann',
      'measure',
    ] as const) {
      expect(drawingSupportsLabelVisibility(kind)).toBe(true);
    }
    expect(drawingSupportsLabelVisibility('trendline')).toBe(false);
    expect(drawingSupportsLabelVisibility('gannBox')).toBe(false);
  });

  it('keeps Fib Circles labels on their canonical bottom-center placement instead of Left/Right', () => {
    expect(drawingSupportsLabelPosition('fibCircles')).toBe(false);
    expect(drawingSupportsLabelPosition('fib')).toBe(true);
  });

  it('keeps labels visible by default and hides them only after an explicit property change', () => {
    const drawing: ChartDrawing = {
      ...common,
      kind: 'infoLine',
      startIndex: 1,
      startPrice: 100,
      endIndex: 2,
      endPrice: 110,
    };
    expect(isDrawingLabelVisible(drawing)).toBe(true);
    expect(isDrawingLabelVisible({ ...drawing, showLabel: false })).toBe(false);
  });
});

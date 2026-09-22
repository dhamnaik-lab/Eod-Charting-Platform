import { describe, expect, it } from 'vitest';
import { getTextBoxBounds } from '@/engine/Renderer';
import type { ChartDrawing, ScaleX, ScaleY } from '@/engine/types';

const scaleX: ScaleX = {
  barWidth: 10,
  barGap: 2,
  bodyWidth: 8,
  toPixel: (index) => index * 10,
  toIndex: (pixel) => pixel / 10,
};

const scaleY: ScaleY = {
  min: 0,
  max: 100,
  toPixel: (value) => 300 - value,
  toPrice: (pixel) => 300 - pixel,
};

describe('getTextBoxBounds', () => {
  it('keeps legacy labels sized to their visible text', () => {
    const drawing: ChartDrawing = {
      id: 'legacy-text',
      kind: 'text',
      paneId: 'price',
      barIndex: 10,
      price: 100,
      text: 'Text',
      fontSize: 13,
      color: '#3b82f6',
      locked: false,
    };

    expect(getTextBoxBounds(drawing, scaleX, scaleY)).toEqual({ left: 102, top: 175, width: 80, height: 21 });
  });

  it('uses persisted box dimensions for resized labels', () => {
    const drawing: ChartDrawing = {
      id: 'resized-text',
      kind: 'text',
      paneId: 'price',
      barIndex: 10,
      price: 100,
      text: 'Text',
      fontSize: 13,
      width: 240,
      height: 72,
      color: '#3b82f6',
      locked: false,
    };

    expect(getTextBoxBounds(drawing, scaleX, scaleY)).toEqual({ left: 102, top: 124, width: 240, height: 72 });
  });
});

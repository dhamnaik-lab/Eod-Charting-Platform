import { describe, expect, it } from 'vitest';
import { computeDrawingLevelLabelBox, computeInlineHorizontalLabelLayout } from '../DrawingLabelLayout';

describe('DrawingLabelLayout', () => {

  it('defaults an unqualified level label to the left side of its anchor', () => {
    const box = computeDrawingLevelLabelBox({
      anchorX: 250,
      anchorY: 120,
      textWidth: 60,
      plotWidth: 500,
      plotHeight: 300,
    });

    expect(box.left + box.width).toBeLessThan(250);
  });

  it('flips a right-edge label to the inside of the plot', () => {
    const box = computeDrawingLevelLabelBox({
      anchorX: 498,
      anchorY: 120,
      textWidth: 82,
      plotWidth: 500,
      plotHeight: 300,
      preferredSide: 'right',
    });

    expect(box.left).toBeLessThan(498);
    expect(box.left + box.width).toBeLessThanOrEqual(497);
  });

  it('flips a left-edge label to the inside of the plot', () => {
    const box = computeDrawingLevelLabelBox({
      anchorX: 2,
      anchorY: 120,
      textWidth: 56,
      plotWidth: 500,
      plotHeight: 300,
      preferredSide: 'left',
    });

    expect(box.left).toBeGreaterThan(2);
    expect(box.left).toBeGreaterThanOrEqual(3);
  });

  it('centers time-level labels on their vertical line and clamps horizontally', () => {
    const middle = computeDrawingLevelLabelBox({
      anchorX: 250,
      anchorY: 12,
      textWidth: 44,
      plotWidth: 500,
      plotHeight: 300,
      preferredSide: 'center',
    });
    const edge = computeDrawingLevelLabelBox({
      anchorX: 499,
      anchorY: 12,
      textWidth: 44,
      plotWidth: 500,
      plotHeight: 300,
      preferredSide: 'center',
    });

    expect(middle.left + middle.width / 2).toBeCloseTo(250, 6);
    expect(edge.left + edge.width).toBeLessThanOrEqual(497);
  });

  it('clamps labels inside the vertical plot bounds', () => {
    const top = computeDrawingLevelLabelBox({
      anchorX: 120,
      anchorY: -20,
      textWidth: 40,
      plotWidth: 500,
      plotHeight: 200,
    });
    const bottom = computeDrawingLevelLabelBox({
      anchorX: 120,
      anchorY: 240,
      textWidth: 40,
      plotWidth: 500,
      plotHeight: 200,
    });

    expect(top.top).toBe(3);
    expect(bottom.top + bottom.height).toBeLessThanOrEqual(197);
  });

  it('places horizontal level labels above the stroke when requested', () => {
    const box = computeDrawingLevelLabelBox({
      anchorX: 180,
      anchorY: 120,
      textWidth: 64,
      plotWidth: 500,
      plotHeight: 300,
      preferredSide: 'right',
      verticalPlacement: 'above',
      verticalGap: 3,
      boxHeight: 16,
    });

    expect(box.top + box.height).toBeLessThan(120);
  });

  it('flips an above-line label below when the top edge has no room', () => {
    const box = computeDrawingLevelLabelBox({
      anchorX: 180,
      anchorY: 8,
      textWidth: 64,
      plotWidth: 500,
      plotHeight: 300,
      verticalPlacement: 'above',
      verticalGap: 3,
      boxHeight: 16,
    });

    expect(box.top).toBeGreaterThan(8);
  });

  it('reserves a centered line gap for inline position text', () => {
    const layout = computeInlineHorizontalLabelLayout({
      leftX: 100,
      rightX: 400,
      textWidth: 120,
      textPadding: 8,
    });

    expect(layout.textX).toBe(250);
    expect(layout.leftSegment?.endX).toBeLessThan(layout.textX);
    expect(layout.rightSegment?.startX).toBeGreaterThan(layout.textX);
    expect(layout.gapRight - layout.gapLeft).toBeGreaterThan(120);
  });

});

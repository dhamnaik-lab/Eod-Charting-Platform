import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rendererSource = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/Renderer.ts'), 'utf8');
const geometrySource = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/DrawingF1BGeometry.ts'), 'utf8');

describe('F1B.5 TradingView Retracement label/layout contracts', () => {
  it('keeps the finite A-to-B base span and independent extension flags', () => {
    expect(geometrySource).toContain('const baseLeft = Math.min(startX, endX);');
    expect(geometrySource).toContain('const baseRight = Math.max(startX, endX);');
    expect(geometrySource).toContain('const projectedLeft = extendLeft ? 0 : baseLeft;');
    expect(geometrySource).toContain('const projectedRight = extendRight ? width : baseRight;');
  });

  it('uses the same segment-side label placement path as Trend-Based Fib Extension', () => {
    expect(rendererSource).not.toContain('function drawF1BOutsideHorizontalLabel(');
    const sharedPlacement = 'const labelPlacement = getSegmentLabelPlacement(segment, options.horizontalLabelPosition);';
    expect(rendererSource.split(sharedPlacement).length - 1).toBeGreaterThanOrEqual(2);
    expect(rendererSource).toContain('labelPlacement.anchorX');
    expect(rendererSource).toContain('labelPlacement.anchorY');
    expect(rendererSource).toContain('labelPlacement.preferredSide');
  });

  it('keeps off-screen labels off-screen instead of clamping them to chart edges', () => {
    expect(rendererSource).toContain('anchorY < 0 || anchorY > height');
  });
});

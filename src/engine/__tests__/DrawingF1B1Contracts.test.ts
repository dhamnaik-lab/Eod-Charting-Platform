import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'src', relativePath), 'utf8');
}

describe('F1B.3 correction over F1B.2 contracts', () => {
  it('keeps Fibonacci label layout independent from price Auto Scale', () => {
    const source = readSource('engine/ChartEngine.ts');
    expect(source).not.toContain("from './DrawingF1BAutoscale'");
    expect(source).not.toContain('drawingAutoscalePrices');
    expect(source).not.toContain('collectF1BAutoscalePrices(');
  });

  it('keeps the normal ScaleManager buildScaleY contract', () => {
    const source = readSource('engine/ScaleManager.ts');
    expect(source).not.toContain('extraValues: readonly number[] = []');
    expect(source).not.toContain('extraValues.forEach((value) => {');
  });

  it('reuses the working Trend-Based Fib label placement for Retracement', () => {
    const source = readSource('engine/Renderer.ts');
    expect(source).toContain('if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY) || anchorY < 0 || anchorY > height)');
    expect(source).not.toContain('function drawF1BOutsideHorizontalLabel(');
    expect(source.match(/const labelPlacement = getSegmentLabelPlacement\(segment, options\.horizontalLabelPosition\);/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain('labelPlacement.preferredSide');
  });
});

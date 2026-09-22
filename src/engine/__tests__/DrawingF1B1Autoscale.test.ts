import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const engineSource = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/ChartEngine.ts'), 'utf8');
const scaleSource = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/ScaleManager.ts'), 'utf8');

describe('F1B.2 Fibonacci label/scaling separation contracts', () => {
  it('does not feed Fibonacci drawing levels into automatic price scaling', () => {
    expect(engineSource).not.toContain("from './DrawingF1BAutoscale'");
    expect(engineSource).not.toContain('drawingAutoscalePrices');
    expect(engineSource).not.toContain('collectF1BAutoscalePrices(');
  });

  it('restores the normal buildScaleY contract without drawing extraValues', () => {
    expect(scaleSource).not.toContain('extraValues: readonly number[] = []');
    expect(scaleSource).not.toContain('extraValues.forEach((value) =>');
  });
});

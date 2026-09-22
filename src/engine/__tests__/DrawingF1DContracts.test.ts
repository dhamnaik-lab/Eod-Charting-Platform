import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultFibonacciSettings } from '../DrawingFibonacciDefaults';
import { getDrawingStyleSchema, isAdvancedDrawingStyleKind, resolveDrawingLinePresentationForSlot } from '../DrawingStyleSchema';
import { normalizeFibonacciSettings } from '../DrawingFibonacciMigration';
import type { ChartDrawing } from '../types';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('F1D Fib Spiral contracts', () => {
  it('promotes fibSpiral to a persisted two-anchor drawing and Fibonacci/Gann dock tool', () => {
    const types = source('src/engine/types.ts');
    const groups = source('src/components/DrawingToolGroups.ts');
    expect(types).toContain("| 'fibSpiral'");
    expect(types).toContain("kind: 'fibSpiral'");
    expect(groups).toContain("'fibSpiral'");
  });

  it('keeps clockwise as the default with no Fibonacci level rows', () => {
    expect(createDefaultFibonacciSettings('fibSpiral')).toEqual({
      schemaVersion: 1,
      kind: 'fibSpiral',
      counterclockwise: false,
    });
  });

  it('exposes line-only advanced Style plus Counterclockwise control', () => {
    const schema = getDrawingStyleSchema('fibSpiral');
    expect(schema.coordinateMode).toBe('two-anchor');
    expect(schema.lines.map((line) => line.id)).toEqual(['spiral']);
    expect(schema.fills).toEqual([]);
    expect(isAdvancedDrawingStyleKind('fibSpiral')).toBe(true);
    const dialog = source('src/components/ChartDrawingPropertiesDialog.tsx');
    expect(dialog).toContain('Counterclockwise');
    expect(dialog).toContain('fibSpiralCounterclockwise');
  });

  it('preserves Counterclockwise and the persisted data-space basis through normalization', () => {
    const normalized = normalizeFibonacciSettings('fibSpiral', {
      schemaVersion: 1,
      kind: 'fibSpiral',
      counterclockwise: true,
      basisPerp: { barDelta: 12.5, priceDelta: -31.25 },
    });
    expect(normalized).toEqual({
      schemaVersion: 1,
      kind: 'fibSpiral',
      counterclockwise: true,
      basisPerp: { barDelta: 12.5, priceDelta: -31.25 },
    });
  });

  it('uses drawing color by default and accepts a persisted spiral-line color override', () => {
    const drawing = {
      id: 'spiral-color',
      kind: 'fibSpiral',
      paneId: 'price',
      startIndex: 10,
      startPrice: 500,
      endIndex: 20,
      endPrice: 550,
      color: '#11aa33',
      lineWidth: 1.2,
    } as ChartDrawing;
    expect(resolveDrawingLinePresentationForSlot(drawing, 'spiral').color).toBe('#11aa33');
    const overridden = {
      ...drawing,
      presentation: { lines: { spiral: { color: '#ff22aa' } } },
    } as ChartDrawing;
    expect(resolveDrawingLinePresentationForSlot(overridden, 'spiral').color).toBe('#ff22aa');
  });

  it('uses one canonical F1D path for renderer and hit-test', () => {
    const renderer = source('src/engine/Renderer.ts');
    const engine = source('src/engine/ChartEngine.ts');
    expect(renderer).toContain('buildF1DFibSpiralGeometry');
    expect(renderer).toContain('projectF1DFibSpiralGeometry');
    expect(engine).toContain('buildF1DFibSpiralGeometry');
    expect(engine).toContain('projectF1DFibSpiralGeometry');
    expect(engine).toContain("drawing.kind === 'fibSpiral'");
  });
});

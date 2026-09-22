import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIB_RADIAL_LEVELS } from '../DrawingAdvancedGeometry';
import { FIB_CIRCLES_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import { drawingSupportsLabelPosition } from '../DrawingCapabilities';
import { getDrawingStyleSchema } from '../DrawingStyleSchema';

const source = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('F1C.1 Fib Circles TradingView-fidelity contracts', () => {
  it('keeps the old advanced-geometry fallback aligned to all 11 F1 defaults', () => {
    expect([...FIB_RADIAL_LEVELS]).toEqual([...FIB_CIRCLES_DEFAULT_VALUES]);
  });

  it('exposes Trend Line, all 11 circles, and Background in the shared Style schema', () => {
    const schema = getDrawingStyleSchema('fibCircles');
    expect(schema.lines[0]).toMatchObject({ id: 'trend', label: 'Trend Line' });
    expect(schema.lines.filter((line) => line.semantic === 'level')).toHaveLength(11);
    expect(schema.lines.some((line) => line.id === 'circle:4.618')).toBe(true);
    expect(schema.fills).toContainEqual(expect.objectContaining({ id: 'background', usesLineColors: true }));
  });

  it('uses canonical midpoint/ellipse geometry in both renderer and hit-test paths', () => {
    const renderer = source('src/engine/Renderer.ts');
    const engine = source('src/engine/ChartEngine.ts');
    expect(renderer).toContain('buildF1CFibCirclesGeometry(start, end, levels)');
    expect(renderer).toContain('ctx.ellipse(entry.center.x, entry.center.y');
    expect(renderer).toContain("resolveDrawingFillPresentationForSlot(drawing, 'background')");
    expect(renderer).toContain("resolveDrawingLinePresentationForSlot(drawing, 'trend')");
    expect(engine).toContain('buildF1CFibCirclesGeometry(');
    expect(engine).toContain('distanceToEllipseBoundary(');
    expect(engine).toContain('snapFibCirclePointTo45Degrees(');
    expect(engine).toContain('event.shiftKey');
  });

  it('formats labels through F1 coefficient/percent options and fixes them at circle bottom-center', () => {
    const renderer = source('src/engine/Renderer.ts');
    expect(renderer).toContain('buildF1BLabelText(entry.level, null, drawing)');
    expect(renderer).toContain("'center',");
    expect(renderer).toContain("'below',");
    expect(drawingSupportsLabelPosition('fibCircles')).toBe(false);
  });

  it('does not alter the Trend-Based Fib Extension renderer entry point', () => {
    const renderer = source('src/engine/Renderer.ts');
    expect(renderer).toContain('function drawTrendFibExtension(');
    expect(renderer).toContain('buildF1BTrendFibExtensionLevels(');
  });
});

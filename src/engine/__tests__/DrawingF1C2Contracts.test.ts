import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIB_ARC_LEVELS } from '../DrawingAdvancedGeometry';
import { FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import { drawingSupportsLabelPosition } from '../DrawingCapabilities';
import { getDrawingKindTitle } from '../DrawingMetadata';

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('F1C.2 Fib Speed Resistance Arcs contracts', () => {
  it('aligns the legacy fallback/static style family with all eleven F1 levels', () => {
    expect([...FIB_ARC_LEVELS]).toEqual([...FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES]);
    expect(FIB_ARC_LEVELS).toHaveLength(11);
    expect(FIB_ARC_LEVELS.at(-1)).toBe(4.618);
  });

  it('uses canonical F1C arc geometry for both renderer and hit-test', () => {
    const renderer = source('src/engine/Renderer.ts');
    const engine = source('src/engine/ChartEngine.ts');
    expect(renderer).toContain('buildF1CFibArcsGeometry(start, end, levels, fullCircles)');
    expect(renderer).toContain('fillF1CFibArcBands(ctx, drawing, geometry.levels)');
    expect(renderer).not.toContain('const angle = Math.atan2(extentY - pivotY, extentX - pivotX);');
    expect(engine).toContain('buildF1CFibArcsGeometry(');
    expect(engine).toContain('isPointInsideF1CFibArcSweep(');
    expect(engine).not.toContain('pointX * directionX + pointY * directionY');
  });

  it('renders Trend Line, Background, F1 labels and Full Circles without generic Left/Right placement', () => {
    const renderer = source('src/engine/Renderer.ts');
    const schema = source('src/engine/DrawingStyleSchema.ts');
    const dialog = source('src/components/ChartDrawingPropertiesDialog.tsx');
    const canvas = source('src/components/ChartCanvas.tsx');
    expect(schema).toContain("slot('trend', 'Trend Line'");
    expect(schema).toContain("fill('background', 'Background'");
    expect(renderer).toContain('buildF1BLabelText(entry.level, null, drawing)');
    expect(dialog).toContain('<span>Full Circles</span>');
    expect(dialog).toContain("(['left', 'right', 'top', 'bottom'] as const)");
    expect(canvas).toContain('fullCircles: drawingProperties.fibArcFullCircles');
    expect(canvas).toContain('labelSides: { ...drawingProperties.fibArcLabelSides }');
    expect(drawingSupportsLabelPosition('fibArcs')).toBe(false);
  });

  it('keeps the public TradingView tool name explicit', () => {
    expect(getDrawingKindTitle('fibArcs')).toBe('Fib Speed Resistance Arcs');
    expect(source('src/components/ChartToolDock.tsx')).toContain("title: 'Fib Speed Resistance Arcs'");
  });

  it('retains accepted Fib Circles and F1B renderers unchanged in scope', () => {
    const renderer = source('src/engine/Renderer.ts');
    expect(renderer).toContain('function drawFibCircles(');
    expect(renderer).toContain('buildF1CFibCirclesGeometry(start, end, levels)');
    expect(renderer).toContain('function drawFibRetracement(');
    expect(renderer).toContain('function drawTrendFibExtension(');
  });
});

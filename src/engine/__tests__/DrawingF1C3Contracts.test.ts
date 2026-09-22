import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { drawingSupportsLabelPosition } from '../DrawingCapabilities';
import { FIB_WEDGE_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import { getDrawingKindTitle } from '../DrawingMetadata';
import { getDrawingStyleSchema } from '../DrawingStyleSchema';

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('F1C.3 Fib Wedge contracts', () => {
  it('keeps the full 11-level F1 wedge family with six defaults enabled', () => {
    expect(FIB_WEDGE_DEFAULT_VALUES).toEqual([0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618]);
    const schema = getDrawingStyleSchema('fibWedge');
    const levelSlots = schema.lines.filter((line) => line.semantic === 'level');
    expect(levelSlots).toHaveLength(11);
    expect(levelSlots.filter((line) => line.defaultVisible !== false)).toHaveLength(6);
  });

  it('uses Trend Line + Background naming and drops generic Left/Right label placement', () => {
    const schema = getDrawingStyleSchema('fibWedge');
    expect(schema.lines.some((line) => line.id === 'trend' && line.label === 'Trend Line')).toBe(true);
    expect(schema.fills.some((fill) => fill.id === 'background' && fill.label === 'Background')).toBe(true);
    expect(drawingSupportsLabelPosition('fibWedge')).toBe(false);
    expect(getDrawingKindTitle('fibWedge')).toBe('Fib Wedge');
  });

  it('routes renderer and hit-test through canonical F1C wedge geometry', () => {
    const renderer = source('src/engine/Renderer.ts');
    const engine = source('src/engine/ChartEngine.ts');
    expect(renderer).toContain('buildF1CFibWedgeGeometry(dataAnchors, levels)');
    expect(renderer).toContain('projectF1CFibWedgeGeometry(dataGeometry');
    expect(renderer).toContain('x: scaleX.toPixel(point.x)');
    expect(renderer).toContain('y: scaleY.toPixel(point.y)');
    expect(renderer).toContain('fillF1CFibWedgeBands(ctx, drawing, geometry.levels)');
    expect(renderer).toContain('entry.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))');
    expect(renderer).not.toContain('const levels = buildFibWedgeSegments(points);');
    expect(engine).toContain("if (drawing.kind === 'fibWedge') {");
    expect(engine).toContain('const dataAnchors = drawing.anchors.map((anchor) => ({ x: anchor.barIndex, y: anchor.price }))');
    expect(engine).toContain('projectF1CFibWedgeGeometry(dataGeometry');
    expect(engine).toContain('distanceToF1CFibWedgeLevel(pointer, entry) <= tolerance');
  });

  it('renders two data-anchored trend boundaries and no Point2-to-Point3 chord', () => {
    const renderer = source('src/engine/Renderer.ts');
    expect(renderer).toContain('geometry.firstBoundary');
    expect(renderer).toContain('geometry.secondBoundary');
    expect(renderer).not.toContain("{ start: points[1], end: points[2] },\n    resolveDrawingLinePresentationForSlot(drawing, 'guide')");
  });

  it('persists wedge coefficient/percent formatting in Properties', () => {
    const canvas = source('src/components/ChartCanvas.tsx');
    const dialog = source('src/components/ChartDrawingPropertiesDialog.tsx');
    expect(canvas).toContain('fibWedgeCoefficientFormat');
    expect(canvas).toContain('coefficientFormat: drawingProperties.fibWedgeCoefficientFormat');
    expect(dialog).toContain('isFibWedgeDrawing');
    expect(dialog).toContain('drawingProperties.fibWedgeCoefficientFormat');
  });
});

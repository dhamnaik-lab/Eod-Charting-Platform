import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '../types';
import {
  ADVANCED_DRAWING_STYLE_KINDS,
  createDrawingPresentationDraft,
  getDrawingStyleSchema,
  resolveDrawingFillPresentationForSlot,
  resolveDrawingLinePresentationForSlot,
} from '../DrawingStyleSchema';

const readSource = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const s23Kinds = [
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'fibWedge',
  'fibTimeZone',
  'fibCircles',
  'fibArcs',
  'gannBox',
  'fib',
  'fibExtension',
  'fibFan',
  'gann',
] as const;

describe('Settings S2.3 Fibonacci / Gann advanced Style contracts', () => {
  it('activates the complete planned S2.3 Fibonacci / Gann family', () => {
    for (const kind of s23Kinds) {
      expect(ADVANCED_DRAWING_STYLE_KINDS).toContain(kind);
      expect(getDrawingStyleSchema(kind).supportsUseOneColor).toBe(true);
    }
    expect(getDrawingStyleSchema('fib').lines.map((line) => line.id)).toEqual([
      'trend',
      'level:0',
      'level:0.236',
      'level:0.382',
      'level:0.5',
      'level:0.618',
      'level:0.786',
      'level:1',
      'level:1.272',
      'level:1.414',
      'level:1.618',
      'level:2',
      'level:2.272',
      'level:2.414',
      'level:2.618',
      'level:3.618',
      'level:4.236',
    ]);
    expect(getDrawingStyleSchema('gannBox').lines.map((line) => line.id)).toEqual([
      'border', 'grid:0.25', `grid:${1 / 3}`, 'grid:0.5', `grid:${2 / 3}`, 'grid:0.75', 'diagonals',
    ]);
  });

  it('preserves legacy emphasis/fill defaults while allowing independent level overrides', () => {
    const drawing: ChartDrawing = {
      id: 'styled-fib-channel',
      kind: 'fibChannel',
      color: '#ffffff',
      lineWidth: 1.4,
      lineStyle: 'solid',
      anchors: [
        { barIndex: 10, price: 100 },
        { barIndex: 20, price: 112 },
        { barIndex: 24, price: 94 },
      ],
      presentation: {
        lines: {
          'level:0.236': { color: '#ff0000', visible: false, lineWidth: 3, lineStyle: 'dotted', opacity: 0.25 },
          'level:0.618': { color: '#00ff00' },
        },
        fills: { bands: { visible: true, color: '#334455', opacity: 0.2 } },
      },
    };

    expect(resolveDrawingLinePresentationForSlot(drawing, 'level:0.236')).toEqual({
      visible: false,
      color: '#ff0000',
      lineWidth: 3,
      lineStyle: 'dotted',
      opacity: 0.25,
    });
    expect(resolveDrawingLinePresentationForSlot(drawing, 'level:0.618').opacity).toBe(1);
    expect(resolveDrawingFillPresentationForSlot(drawing, 'bands')).toEqual({
      visible: true,
      color: '#334455',
      opacity: 0.2,
    });

    const draft = createDrawingPresentationDraft(drawing);
    expect(draft.useOneColor).toBe(false);
    expect(draft.lines?.['level:0.236']?.color).toBe('#ff0000');
    expect(draft.fills?.bands?.visible).toBe(true);
  });

  it('binds level/ray/arc/circle/grid styling and optional fills through the shared renderer resolvers', () => {
    const rendererSource = readSource('engine/Renderer.ts');
    expect(rendererSource).toContain('resolveDrawingLinePresentationForSlot(drawing, `level:${level}`)');
    expect(rendererSource).toContain('const legacySlot = `circle:${level.value}`;');
    expect(rendererSource).toContain('const legacySlot = `arc:${level.value}`;');
    expect(rendererSource).toContain('resolveDrawingLinePresentationForSlot(drawing, `grid:${level}`)');
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'diagonals')");
    expect(rendererSource).toContain("resolveDrawingFillPresentationForSlot(drawing, 'levels')");
    expect(rendererSource).toContain("resolveDrawingFillPresentationForSlot(drawing, 'bands')");
    expect(rendererSource).toContain("resolveDrawingFillPresentationForSlot(drawing, 'wedge')");
    expect(rendererSource).toContain("resolveDrawingFillPresentationForSlot(drawing, 'box')");
    expect(rendererSource).toContain("const slotId = drawing.kind === 'gann' ? `ray:${line.label}` : `ray:${line.factor}`;");
    expect(rendererSource).toContain('presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)');
  });

  it('reuses the generic advanced Properties UI instead of creating Fib/Gann-specific dialogs', () => {
    const dialogSource = readSource('components/ChartDrawingPropertiesDialog.tsx');
    const chartCanvasSource = readSource('components/ChartCanvas.tsx');
    expect(dialogSource).toContain('advancedStyleSchema.lines.map');
    expect(dialogSource).toContain('advancedStyleSchema.fills.map');
    expect(dialogSource).not.toContain('>Use one color<');
    expect(chartCanvasSource).toContain('const normalizedDrawing = normalizeFibonacciDrawing(drawing);');
    expect(chartCanvasSource).toContain('createDrawingPresentationDraft(normalizedDrawing)');
    expect(chartCanvasSource).toContain('presentation: drawingProperties.presentation');
    expect(dialogSource).not.toContain('FibStyleDialog');
    expect(dialogSource).not.toContain('GannStyleDialog');
  });
});

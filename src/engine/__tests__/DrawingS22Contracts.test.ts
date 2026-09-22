import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADVANCED_DRAWING_STYLE_KINDS,
  createDrawingPresentationDraft,
  getDrawingStyleSchema,
  resolveDrawingLinePresentationForSlot,
} from '../DrawingStyleSchema';
import type { ChartDrawing } from '../types';

const readSource = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const pitchforkKinds = [
  'andrewsPitchfork',
  'schiffPitchfork',
  'modifiedSchiffPitchfork',
  'insidePitchfork',
] as const;

describe('Settings S2.2 Pitchfork family contracts', () => {
  it('activates all four pitchfork variants plus pitchfan in the shared advanced Style rollout', () => {
    for (const kind of [...pitchforkKinds, 'pitchfan'] as const) {
      expect(ADVANCED_DRAWING_STYLE_KINDS).toContain(kind);
    }
    for (const kind of pitchforkKinds) {
      expect(getDrawingStyleSchema(kind).lines.map((line) => line.id)).toEqual(['median', 'upper', 'lower']);
    }
    expect(getDrawingStyleSchema('pitchfan').lines.map((line) => line.id)).toEqual([
      'ray:0.236', 'ray:0.382', 'ray:0.5', 'ray:0.618', 'ray:0.786', 'ray:1',
    ]);
  });

  it('preserves pitchfan strong/secondary legacy opacity while allowing independent overrides', () => {
    const drawing: ChartDrawing = {
      id: 'styled-pitchfan',
      kind: 'pitchfan',
      color: '#ffffff',
      lineWidth: 1.4,
      anchors: [
        { barIndex: 10, price: 100 },
        { barIndex: 20, price: 112 },
        { barIndex: 24, price: 94 },
      ],
      presentation: {
        lines: {
          'ray:0.236': { color: '#ff0000', visible: false, lineWidth: 3, lineStyle: 'dotted', opacity: 0.25 },
          'ray:0.5': { color: '#00ff00' },
        },
      },
    };

    expect(resolveDrawingLinePresentationForSlot(drawing, 'ray:0.236')).toEqual({
      visible: false,
      color: '#ff0000',
      lineWidth: 3,
      lineStyle: 'dotted',
      opacity: 0.25,
    });
    expect(resolveDrawingLinePresentationForSlot(drawing, 'ray:0.5').opacity).toBe(1);

    const draft = createDrawingPresentationDraft(drawing);
    expect(draft.useOneColor).toBe(false);
    expect(draft.lines?.['ray:0.236']?.color).toBe('#ff0000');
    expect(draft.lines?.['ray:0.5']?.color).toBe('#00ff00');
  });

  it('binds pitchfork lines and pitchfan rays through the common renderer presentation resolver', () => {
    const rendererSource = readSource('engine/Renderer.ts');
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'median')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, firstSideSlot)");
    expect(rendererSource).toContain('const slotId = `ray:${level}`;');
    expect(rendererSource).toContain('strokeDrawingSegmentWithPresentation(ctx, segment, presentation)');
    expect(rendererSource).toContain('presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)');
  });

  it('keeps the generic Properties UI and ChartCanvas draft/save path shared instead of adding pitchfork-only dialogs', () => {
    const dialogSource = readSource('components/ChartDrawingPropertiesDialog.tsx');
    const chartCanvasSource = readSource('components/ChartCanvas.tsx');
    expect(dialogSource).toContain('advancedStyleSchema.lines.map');
    expect(dialogSource).not.toContain('>Use one color<');
    expect(chartCanvasSource).toContain('createDrawingPresentationDraft(');
    expect(chartCanvasSource).toContain('presentation: drawingProperties.presentation');
    expect(dialogSource).not.toContain('PitchforkStyleDialog');
  });
});

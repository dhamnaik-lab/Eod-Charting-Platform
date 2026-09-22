import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '../types';
import {
  ADVANCED_DRAWING_STYLE_KINDS,
  createDrawingPresentationDraft,
  resolveDrawingFillPresentationForSlot,
  resolveDrawingLinePresentationForSlot,
} from '../DrawingStyleSchema';

describe('Settings S2.1 advanced drawing Style contracts', () => {
  it('keeps Regression + Channels as the first completed advanced-style rollout', () => {
    expect(ADVANCED_DRAWING_STYLE_KINDS.slice(0, 4)).toEqual([
      'regressionTrend',
      'channel',
      'flatChannel',
      'disjointChannel',
    ]);
  });

  it('keeps legacy channel visuals stable until an advanced override is saved', () => {
    const parallel: ChartDrawing = {
      id: 'parallel',
      kind: 'channel',
      color: '#60a5fa',
      lineWidth: 2,
      lineStyle: 'solid',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 110,
      offset: 6,
    };

    expect(resolveDrawingLinePresentationForSlot(parallel, 'base')).toMatchObject({
      visible: true,
      color: '#60a5fa',
      lineWidth: 2,
      lineStyle: 'solid',
    });
    expect(resolveDrawingLinePresentationForSlot(parallel, 'center').lineStyle).toBe('dashed');
    expect(resolveDrawingFillPresentationForSlot(parallel, 'channel')).toEqual({
      visible: false,
      color: '#60a5fa',
      opacity: 0.08,
    });

    const draft = createDrawingPresentationDraft(parallel);
    expect(draft.useOneColor).toBe(false);
    expect(draft.lines?.base?.color).toBe('#60a5fa');
    expect(draft.lines?.center?.lineStyle).toBe('dashed');
  });

  it('binds per-component visibility/color/width/style/opacity plus fill controls into Properties', () => {
    const dialogSource = readFileSync(resolve(process.cwd(), 'src/components/ChartDrawingPropertiesDialog.tsx'), 'utf8');
    const chartCanvasSource = readFileSync(resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');

    expect(dialogSource).not.toContain('>Use one color<');
    expect(dialogSource).toContain('advancedStyleSchema.lines.map');
    expect(dialogSource).toContain('updateLinePresentation');
    expect(dialogSource).toContain('updateFillPresentation');
    expect(dialogSource).toContain('opacity percent');
    expect(dialogSource).toContain('Handle / construction color');
    expect(chartCanvasSource).toContain('createDrawingPresentationDraft(');
    expect(chartCanvasSource).toContain('presentation: drawingProperties.presentation');
  });

  it('binds renderer output to resolved component styles for all S2.1 families', () => {
    const rendererSource = readFileSync(resolve(process.cwd(), 'src/engine/Renderer.ts'), 'utf8');

    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'upper')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'basis')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'lower')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'base')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'center')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'offset')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'trend')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'flat')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'first')");
    expect(rendererSource).toContain("resolveDrawingLinePresentationForSlot(drawing, 'second')");
    expect(rendererSource).toContain("resolveDrawingFillPresentationForSlot(drawing, 'channel')");
    expect(rendererSource).toContain('strokeDrawingSegmentWithPresentation');
    expect(rendererSource).toContain('fillDrawingPolygonWithPresentation');
  });
});

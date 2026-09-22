import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  drawingSupportsLabelPosition,
  getDrawingLabelPosition,
} from '../DrawingCapabilities';
import { getDrawingKindTitle } from '../DrawingMetadata';
import type { ChartDrawing } from '../types';

const common = {
  id: 'drawing',
  color: '#3b82f6',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

describe('D3B.2 properties and label-position contracts', () => {
  it('defaults side-position-capable numeric labels to the left and persists an explicit right choice', () => {
    const drawing: ChartDrawing = {
      ...common,
      kind: 'trendFibExtension',
      showLabel: true,
      anchors: [
        { barIndex: 1, price: 100 },
        { barIndex: 3, price: 120 },
        { barIndex: 5, price: 110 },
      ],
    };

    expect(drawingSupportsLabelPosition('trendFibExtension')).toBe(true);
    expect(getDrawingLabelPosition(drawing)).toBe('left');
    expect(getDrawingLabelPosition({ ...drawing, labelPosition: 'right' })).toBe('right');
    expect(JSON.parse(JSON.stringify({ ...drawing, labelPosition: 'right' })).labelPosition).toBe('right');
  });

  it('limits Left/Right label-position controls to drawings with unambiguous side placement', () => {
    for (const kind of [
      'fib',
      'fibExtension',
      'fibTimeZone',
      'trendFibExtension',
      'fibChannel',
      'fibTimeExtension',
    ] as const) {
      expect(drawingSupportsLabelPosition(kind)).toBe(true);
    }

    for (const kind of ['infoLine', 'dateRange', 'fibCircles', 'fibArcs', 'fibWedge', 'fibFan', 'gann', 'pitchfan'] as const) {
      expect(drawingSupportsLabelPosition(kind)).toBe(false);
    }
  });

  it('uses tool-specific Properties titles and keeps label-side controls in the tabbed Style UI', () => {
    expect(getDrawingKindTitle('trendFibExtension')).toBe('Trend-Based Fib Extension');
    expect(getDrawingKindTitle('andrewsPitchfork')).toBe("Andrews' Pitchfork");

    const dialogSource = readFileSync(resolve(process.cwd(), 'src/components/ChartDrawingPropertiesDialog.tsx'), 'utf8');
    const rendererSource = readFileSync(resolve(process.cwd(), 'src/engine/Renderer.ts'), 'utf8');

    expect(dialogSource).toContain('`${getDrawingKindTitle(selectedDrawing.kind)} Properties`');
    expect(dialogSource).toContain('<strong style={subSectionTitleStyle}>Labels</strong>');
    expect(dialogSource).toContain('<span>Position</span>');
    expect(dialogSource).toContain('<option value="left">Left</option>');
    expect(dialogSource).toContain('<option value="right">Right</option>');

    // S2.3.1 deliberately replaced the old heavy outlined/halo label treatment
    // with clean colored glyphs plus a small dark shadow.
    expect(rendererSource).not.toContain('ctx.roundRect(box.left, box.top, box.width, box.height, 3);');
    expect(rendererSource).not.toContain('ctx.strokeText(text, box.textX, box.textY);');
    expect(rendererSource).toContain('ctx.shadowBlur = 2;');
    expect(rendererSource).toContain('ctx.fillText(text, box.textX, box.textY);');
  });
});

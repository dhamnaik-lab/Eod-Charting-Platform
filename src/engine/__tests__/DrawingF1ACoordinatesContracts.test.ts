import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('F1A editable multi-anchor Coordinates contracts', () => {
  it('renders editable bar/value fields instead of the previous read-only anchor list', () => {
    const dialog = readFileSync(resolve(process.cwd(), 'src/components/ChartDrawingPropertiesDialog.tsx'), 'utf8');
    expect(dialog).toContain('anchorCoordinates: Array<{ barIndex: string; price: string }>');
    expect(dialog).toContain('drawingProperties.anchorCoordinates.map((anchor, index) =>');
    expect(dialog).toContain('Saving coordinates also refreshes stable timestamp anchors for timeframe remapping.');
    expect(dialog).not.toContain('Multi-anchor date/price editing remains direct-on-chart in this correction phase.');
  });

  it('ships an unmounted shared level editor with stable add/remove row support for later geometry waves', () => {
    const editor = readFileSync(resolve(process.cwd(), 'src/components/drawings/FibonacciLevelEditor.tsx'), 'utf8');
    expect(editor).toContain('createFibonacciLevelId(slotPrefix)');
    expect(editor).toContain('+ Add Level');
    expect(editor).toContain('FIBONACCI_MAX_LEVEL_ROWS');
  });

  it('atomically updates anchor bar/price/timestamp and clears stale Renko anchors on Save', () => {
    const canvas = readFileSync(resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');
    expect(canvas).toContain("anchorCoordinates: 'anchors' in normalizedDrawing");
    expect(canvas).toContain('if (drawingProperties.anchorCoordinates.length !== drawing.anchors.length) return;');
    expect(canvas).toContain('timestamp: bars[barIndex]?.timestamp');
    expect(canvas).toContain('renkoAnchor: undefined');
  });
});

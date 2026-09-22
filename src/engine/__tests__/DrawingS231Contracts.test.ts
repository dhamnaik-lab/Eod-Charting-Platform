import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '../types';
import {
  ADVANCED_DRAWING_STYLE_KINDS,
  createDrawingPresentationDraft,
  getDrawingSettingsTabs,
  getDrawingStyleSchema,
  isDrawingVisibleOnTimeframe,
} from '../DrawingStyleSchema';
import { normalizePositionAnchors } from '../DrawingD3CGeometry';

const readSource = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

describe('Settings S2.3.1 TradingView UX / visual-acceptance corrections', () => {
  it('uses tabbed settings shells and no longer exposes the shared-color checkbox', () => {
    expect(getDrawingSettingsTabs('fib').map((tab) => tab.id)).toEqual(['style', 'coordinates', 'visibility']);
    expect(getDrawingSettingsTabs('longPosition').map((tab) => tab.id)).toEqual(['inputs', 'style', 'visibility']);

    const dialogSource = readSource('components/ChartDrawingPropertiesDialog.tsx');
    expect(dialogSource).toContain('getDrawingSettingsTabs');
    expect(dialogSource).toContain("resize: 'both'");
    expect(dialogSource).toContain('ResizeObserver');
    expect(dialogSource).toContain('eod.chart.drawing-properties.bounds.v1');
    expect(dialogSource).toContain('Handle / construction color');
    expect(dialogSource).not.toContain('>Use one color<');
    expect(dialogSource).toContain('Each line color is always editable.');
  });

  it('migrates a legacy shared-color drawing into direct per-line colors on edit', () => {
    const drawing: ChartDrawing = {
      id: 'legacy-shared-fib',
      kind: 'fib',
      color: '#2962ff',
      lineWidth: 1.2,
      lineStyle: 'solid',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 80,
      presentation: {
        useOneColor: true,
        lines: {
          'level:0.236': { color: '#ef4444', lineWidth: 2 },
        },
      },
    };

    const draft = createDrawingPresentationDraft(drawing);
    expect(draft.useOneColor).toBe(false);
    expect(draft.lines?.['level:0.236']?.color).toBe('#2962ff');
    expect(draft.lines?.['level:0.236']?.lineWidth).toBe(2);
  });

  it('uses TradingView-inspired per-level defaults and background composition for Fib Retracement', () => {
    const schema = getDrawingStyleSchema('fib');
    const fibColors = schema.lines
      .filter((line) => line.id.startsWith('level:'))
      .map((line) => line.defaultColor);
    expect(new Set(fibColors).size).toBeGreaterThan(4);
    expect(schema.fills).toContainEqual(expect.objectContaining({
      id: 'levels',
      label: 'Background',
      defaultVisible: true,
      usesLineColors: true,
    }));

    const rendererSource = readSource('engine/Renderer.ts');
    expect(rendererSource).toContain('TradingView-style Fib composition');
    expect(rendererSource).toContain('resolveTransparentColor(presentation.color, background.opacity)');
    expect(rendererSource).not.toContain('drawInlinePositionLevel');
    expect(rendererSource).toContain('drawPositionStatText');
  });

  it('enforces position direction and activates advanced style + timeframe visibility for Long/Short', () => {
    expect(ADVANCED_DRAWING_STYLE_KINDS).toContain('longPosition');
    expect(ADVANCED_DRAWING_STYLE_KINDS).toContain('shortPosition');

    const long = normalizePositionAnchors('longPosition', [
      { barIndex: 5, price: 100 },
      { barIndex: 15, price: 90 },
      { barIndex: 20, price: 110 },
    ]);
    expect(long[1].price).toBe(110);
    expect(long[2].price).toBe(90);
    expect(long[2].barIndex).toBe(long[1].barIndex);

    const hiddenWeekly: ChartDrawing = {
      id: 'visible-contract',
      kind: 'hline',
      color: '#fff',
      price: 100,
      visibility: { timeframes: { W: false } },
    };
    expect(isDrawingVisibleOnTimeframe(hiddenWeekly, 'D')).toBe(true);
    expect(isDrawingVisibleOnTimeframe(hiddenWeekly, 'W')).toBe(false);

    const engineSource = readSource('engine/ChartEngine.ts');
    expect(engineSource).toContain('isDrawingVisibleOnTimeframe');
    expect(engineSource).toContain('normalizePositionAnchors(drawing.kind, drawing.anchors)');
  });
});

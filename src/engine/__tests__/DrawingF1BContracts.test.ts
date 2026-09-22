import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDrawingStyleSchema } from '../DrawingStyleSchema';

const readSource = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

describe('F1B linear/time Fibonacci fidelity contracts', () => {
  it('routes renderer and hit-testing through the same F1B geometry/runtime layer', () => {
    const renderer = readSource('engine/Renderer.ts');
    const chartEngine = readSource('engine/ChartEngine.ts');
    for (const symbol of [
      'buildF1BRetracementLevels',
      'buildF1BTrendFibExtensionLevels',
      'buildF1BFibChannelLevels',
      'buildF1BFibTimeZoneLevels',
      'buildF1BTrendFibTimeLevels',
      'resolveFibonacciLevels',
    ]) {
      expect(renderer).toContain(symbol);
      expect(chartEngine).toContain(symbol);
    }
  });

  it('adds Time Zone Initial Line and background-capable time/extension style slots', () => {
    expect(getDrawingStyleSchema('fibTimeZone').lines.map((slot) => slot.id)).toContain('initial');
    expect(getDrawingStyleSchema('fibTimeZone').fills.map((slot) => slot.id)).toContain('background');
    expect(getDrawingStyleSchema('trendFibExtension').fills.map((slot) => slot.id)).toContain('background');
    expect(getDrawingStyleSchema('fibTimeExtension').fills.map((slot) => slot.id)).toContain('background');
  });

  it('keeps the separate legacy two-point fibExtension renderer and hit-test path', () => {
    const renderer = readSource('engine/Renderer.ts');
    const chartEngine = readSource('engine/ChartEngine.ts');
    const legacyRendererStart = renderer.indexOf('function drawFibExtension(');
    const legacyRendererEnd = renderer.indexOf('function drawMeasure(', legacyRendererStart);
    expect(legacyRendererStart).toBeGreaterThan(-1);
    expect(renderer.slice(legacyRendererStart, legacyRendererEnd)).toContain('FIB_EXTENSION_LEVELS');
    expect(chartEngine).toContain("if (drawing.kind === 'fibExtension')");
    expect(chartEngine).toContain('const priceDelta = renderDrawing.startPrice - renderDrawing.endPrice');
  });
});

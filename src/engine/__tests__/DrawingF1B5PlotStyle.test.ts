import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getEffectiveDrawingExtendRight } from '../DrawingCapabilities';
import { buildF1BRetracementLevels } from '../DrawingF1BGeometry';
import type { ChartDrawing } from '../types';

const levels = [0, 0.5, 1].map((value, index) => ({ id: `plot-${index}`, value, enabled: true }));

function fibDrawing(extendRight?: boolean): Extract<ChartDrawing, { kind: 'fib' }> {
  return {
    id: 'fib-plot-style',
    kind: 'fib',
    startIndex: 10,
    startPrice: 661.5,
    endIndex: 20,
    endPrice: 775,
    color: '#3b82f6',
    ...(typeof extendRight === 'boolean' ? { extendRight } : {}),
  };
}

describe('F1B.5 Fib Retracement plotting-style parity with Trend-Based Fib Extension', () => {
  it('treats missing legacy/current Retracement Extend Right as enabled while respecting explicit false', () => {
    expect(getEffectiveDrawingExtendRight(fibDrawing())).toBe(true);
    expect(getEffectiveDrawingExtendRight(fibDrawing(true))).toBe(true);
    expect(getEffectiveDrawingExtendRight(fibDrawing(false))).toBe(false);
  });

  it('keeps the F1B.4 video-locked price orientation while extending levels right by default', () => {
    const geometry = buildF1BRetracementLevels(661.5, 775, 100, 160, 500, levels);
    expect(geometry.map((entry) => entry.price)).toEqual([775, 718.25, 661.5]);
    expect(geometry.every((entry) => entry.segment.start.x === 100)).toBe(true);
    expect(geometry.every((entry) => entry.segment.end.x === 500)).toBe(true);
  });

  it('uses one effective Extend Right rule in renderer, hit testing, creation, and Properties initialization', () => {
    const renderer = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/Renderer.ts'), 'utf8');
    const engine = fs.readFileSync(path.resolve(process.cwd(), 'src/engine/ChartEngine.ts'), 'utf8');
    const chartCanvas = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');

    expect(renderer).toContain('getEffectiveDrawingExtendRight(drawing)');
    expect(engine).toContain('getEffectiveDrawingExtendRight(drawing)');
    expect(engine).toContain("if (kind === 'fib') {");
    expect(engine).toContain('extendRight: true,');
    expect(chartCanvas).toContain('getEffectiveDrawingExtendRight(normalizedDrawing)');
  });
});

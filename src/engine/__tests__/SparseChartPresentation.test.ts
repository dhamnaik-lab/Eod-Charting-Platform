import { describe, expect, it, vi } from 'vitest';
import { drawCandles, drawVolume } from '../Renderer';
import { buildScaleX, buildScaleY, countVisibleBars } from '../ScaleManager';
import type { ChartTheme, OHLCBar } from '../types';

const bar: OHLCBar = {
  date: '2025-08-11', timestamp: 1754870400000,
  open: 3040, high: 3040, low: 3040, close: 3040.35, volume: 1,
};
const viewport = { startIndex: 0, endIndex: 9 };

describe('sparse chart presentation', () => {
  it('counts actual bars inside the viewport, including fractional edges', () => {
    expect(countVisibleBars(viewport, 1)).toBe(1);
    expect(countVisibleBars({ startIndex: 1, endIndex: 9 }, 1)).toBe(0);
    expect(countVisibleBars({ startIndex: 1.2, endIndex: 3 }, 10)).toBe(2);
  });

  it('fits the official close and draws a compact candle and volume bar', () => {
    const scaleY = buildScaleY([bar], 0, 9, 600);
    expect(scaleY.toPixel(bar.close)).toBeGreaterThan(200);
    expect(scaleY.toPixel(bar.open)).toBeLessThan(400);
    const ctx = {
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      fillRect: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
    };
    const canvas = ctx as unknown as CanvasRenderingContext2D;
    const scaleX = buildScaleX(viewport, 1700);
    const theme = {} as ChartTheme;
    drawCandles(canvas, [bar], viewport, scaleX, scaleY, theme);
    drawVolume(canvas, [bar], viewport, scaleX, 80, 600, theme);
    const rectangles = [...ctx.fillRect.mock.calls, ...ctx.roundRect.mock.calls];
    expect(rectangles).toHaveLength(2);
    for (const rectangle of rectangles) expect(rectangle[2]).toBeLessThanOrEqual(16);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { ChartLayout } from '@/engine/ChartEngine';
import { drawScreenshotPriceLegend } from '../chartScreenshotLegendRenderer';

function drawStudies(priceHeight: number) {
  const fillText = vi.fn();
  const noop = () => {};
  const context = {
    save: noop, restore: noop, scale: noop, beginPath: noop, arc: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, closePath: noop,
    fill: noop, stroke: noop, fillText,
    measureText: (value: string) => ({ width: value.length * 6 }),
  };
  const screenshot = { width: 1200, height: 800, getContext: () => context } as unknown as HTMLCanvasElement;
  drawScreenshotPriceLegend(screenshot, {
    layout: { priceHeight, leftAxisWidth: 0, axisWidth: 55 } as ChartLayout,
    cssWidth: 600,
    snapshot: {
      title: 'Example',
      segments: [],
      hiddenItemCount: 0,
      secondaryItems: Array.from({ length: 8 }, (_, index) => ({
        label: `Study ${index + 1}`,
        color: '#ffffff',
        hidden: false,
        segments: [],
      })),
    },
    secondaryLegendExpanded: true,
  });
  return fillText.mock.calls.map(([text]) => text);
}

describe('screenshot legend row capacity', () => {
  it('exports all eight studies when the price pane has room', () => {
    expect(drawStudies(210)).toEqual([
      'Example', 'Study 1', 'Study 2', 'Study 3', 'Study 4',
      'Study 5', 'Study 6', 'Study 7', 'Study 8',
    ]);
  });

  it('reserves the last fitting row for the overflow count', () => {
    expect(drawStudies(84)).toEqual(['Example', 'Study 1', 'Study 2', '+6 more']);
  });
});

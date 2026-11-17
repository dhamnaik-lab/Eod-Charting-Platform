import { describe, expect, it } from 'vitest';
import { ChartEngine } from '../ChartEngine';
import { DARK_THEME } from '../types';
import type { RenderablePane } from '@/indicators/base';

const pane: RenderablePane = {
  indicator: { kind: 'CVD', id: 'cvd', placement: 'pane' },
  title: 'CVD',
  lines: [{ key: 'cvd_line', label: 'CVD', values: [-17200000], color: '#2962ff' }],
  histogram: {
    key: 'cvd_hist', label: 'CVD Histogram', values: [-17200000],
    positiveColor: '#26a69a', negativeColor: '#ef5350', readoutDuplicateOf: 'cvd_line',
  },
};

const engine = Object.assign(Object.create(ChartEngine.prototype), {
  theme: DARK_THEME,
  valueLabelSettings: { showIndicatorNameLabels: false },
}) as {
  buildPaneLegendTokens: (pane: RenderablePane, index: number) => { text: string }[];
  buildIndicatorValueTags: (pane: RenderablePane, context: { scaleY: { toPixel: (v: number) => number } }, index: number) => { text: string }[];
};
const context = { scaleY: { toPixel: () => 0 } };

describe('volume pane readouts', () => {
  it('shows one signed compact number for a duplicated line and histogram', () => {
    expect(engine.buildPaneLegendTokens(pane, 0).map(({ text }) => text)).toEqual(['CVD', '-1.72 Cr']);
    expect(engine.buildIndicatorValueTags(pane, context, 0).map(({ text }) => text)).toEqual(['-1.72 Cr']);
  });

  it('retains the histogram readout when the matching line is hidden', () => {
    const histogramOnly = { ...pane, lines: [] };
    expect(engine.buildPaneLegendTokens(histogramOnly, 0).map(({ text }) => text))
      .toEqual(['CVD Histogram', '-1.72 Cr']);
    expect(engine.buildIndicatorValueTags(histogramOnly, context, 0).map(({ text }) => text))
      .toEqual(['-1.72 Cr']);
  });
});

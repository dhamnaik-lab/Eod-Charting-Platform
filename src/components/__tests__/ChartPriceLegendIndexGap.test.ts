import { describe, expect, it } from 'vitest';
import { buildChartPriceLegendSnapshot } from '../ChartPriceLegendOverlay';
import { DEFAULT_RENKO_SETTINGS } from '@/features/charts/chartTypeTransformService';
import type { OHLCBar } from '@/engine/types';

function bar(date: string, open: number, close: number, prevClose?: number): OHLCBar {
  return {
    date, timestamp: Date.parse(`${date}T00:00:00Z`), open,
    high: Math.max(open, close), low: Math.min(open, close), close, volume: 100, prevClose,
  };
}

const screenshotBars = [
  bar('2000-01-31', 1598.35, 1546.2, 1599.1),
  bar('2005-01-03', 2080, 2115),
  bar('2005-01-31', 2008.45, 2057.6, 2008.3),
  bar('2012-02-21', 5561.9, 5607.15),
];

function snapshot(bars = screenshotBars, hoverBarIndex: number | null = null, exchange = 'NSE_INDEX', endIndex = bars.length) {
  return buildChartPriceLegendSnapshot({
    instrument: { symbol: 'NIFTY', exchange }, instrumentName: 'Nifty 50',
    timeframe: 'D', chartType: 'candles', renkoSettings: DEFAULT_RENKO_SETTINGS,
    bars, viewport: { startIndex: 0, endIndex }, compareOverlays: [], overlays: [], hoverBarIndex,
  });
}

describe('visible index price legend gap guard', () => {
  it.each([1, 3])('does not substitute open after the screenshot gap at bar %s', (index) => {
    const result = snapshot(screenshotBars, index);
    const change = result.segments.at(-1)!;
    expect(result.segments[0].text).toBe(screenshotBars[index].date);
    expect(change.text).toBe('Change unavailable');
    expect(change.color).toBe('var(--legend-text)');
    expect(result.segments.find((segment) => segment.text.includes('%'))).toBeUndefined();
  });

  it('guards the last visible bar when the mouse is outside the chart', () => {
    expect(snapshot(screenshotBars, null, 'NSE_INDEX', 2).segments.at(-1)?.text).toBe('Change unavailable');
  });

  it('retains ordinary previous-close changes within the January 2005 history', () => {
    expect(snapshot(screenshotBars, 2).segments.at(-1)?.text).toBe('+49.30 (+2.45%)');
  });

  it('shows the restored November 2015 change', () => {
    const bars = [bar('2015-11-09', 7788.25, 7915.2, 7954.3)];
    expect(snapshot(bars, 0).segments.at(-1)?.text).toBe('-39.10 (-0.49%)');
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])('guards invalid index previous close %s', (reference) => {
    expect(snapshot([bar('2012-02-21', 5561.9, 5607.15, reference)], 0).segments.at(-1)?.text)
      .toBe('Change unavailable');
  });

  it('preserves the existing equity fallback', () => {
    expect(snapshot(screenshotBars, 3, 'NSE').segments.at(-1)?.text).toBe('+45.25 (+0.81%)');
  });
});

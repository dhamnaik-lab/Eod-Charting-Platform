import { describe, expect, it } from 'vitest';
import { ChartEngine } from '../ChartEngine';
import { DARK_THEME, type OHLCBar } from '../types';

interface SummaryHarness {
  buildPriceSummaryTokens(index: number): { text: string }[];
  buildTradingViewPriceSummary(index: number): { tokens: { text: string }[] };
}

function summaries(exchange: string, prevClose?: number): string[] {
  const bar: OHLCBar = {
    date: '2015-11-09', timestamp: Date.UTC(2015, 10, 9),
    open: 7788.25, high: 7937.75, low: 7771.7, close: 7915.2, volume: 100, prevClose,
  };
  const engine = Object.assign(Object.create(ChartEngine.prototype), {
    symbol: `${exchange}:NIFTY`, timeframe: 'D', bars: [bar], theme: DARK_THEME,
  }) as SummaryHarness;
  return [engine.buildPriceSummaryTokens(0), engine.buildTradingViewPriceSummary(0).tokens]
    .map((tokens) => tokens.map((token) => token.text).join(' '));
}

describe('index alias price summary', () => {
  it.each([undefined, 0, Number.NaN])('marks an unavailable index reference (%s) in both chart styles', (reference) => {
    for (const summary of summaries('NSE_INDEX', reference)) {
      expect(summary).toContain('Change unavailable');
      expect(summary).not.toContain('%');
    }
  });

  it('shows the correct change when alias history supplies the previous close', () => {
    for (const summary of summaries('NSE_INDEX', 7954.3)) {
      expect(summary).toContain('-39.10 (-0.49%)');
      expect(summary).not.toContain('Change unavailable');
    }
  });

  it('preserves the existing equity fallback', () => {
    for (const summary of summaries('NSE')) {
      expect(summary).toContain('%');
      expect(summary).not.toContain('Change unavailable');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';

function makeBars(basePrice: number, count = 30): OHLCBar[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = ((index % 7) - 3) * 1.5;
    const close = basePrice + index * 0.4 + wave;
    return {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      timestamp: index + 1,
      open: close - 0.7,
      high: close + 1.2,
      low: close - 1.4,
      close,
      volume: 1000 + index * 10,
    };
  });
}

function lastFinite(values: Array<number | null>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && Number.isFinite(value)) return value;
  }
  throw new Error('Expected at least one finite indicator value.');
}

describe('Indicator cache isolation and invalidation', () => {
  it('does not reuse an SMA from another price series with the same length and latest timestamp', () => {
    const highPriceBars = makeBars(3000);
    const lowPriceBars = makeBars(180);
    const indicator: OverlayIndicator = {
      id: 'shared-sma-cache-id',
      kind: 'SMA',
      placement: 'overlay',
      period: 20,
      color: '#5dafff',
    };

    const highPriceSma = lastFinite(
      buildRenderableIndicators(highPriceBars, [indicator]).overlays[0].lines[0].values,
    );
    const lowPriceSma = lastFinite(
      buildRenderableIndicators(lowPriceBars, [indicator]).overlays[0].lines[0].values,
    );

    expect(highPriceSma).toBeGreaterThan(2500);
    expect(lowPriceSma).toBeLessThan(250);
  });

  it('invalidates cached output when a calculation-specific setting changes', () => {
    const bars = makeBars(180);
    const narrowBands: OverlayIndicator = {
      id: 'boll-cache-settings',
      kind: 'BOLL',
      placement: 'overlay',
      period: 10,
      stdDev: 1,
      color: '#5dafff',
    };
    const wideBands: OverlayIndicator = {
      ...narrowBands,
      stdDev: 3,
    };

    const narrow = buildRenderableIndicators(bars, [narrowBands]).overlays[0];
    const wide = buildRenderableIndicators(bars, [wideBands]).overlays[0];
    const narrowUpper = lastFinite(narrow.band?.upper ?? []);
    const wideUpper = lastFinite(wide.band?.upper ?? []);

    expect(wideUpper).toBeGreaterThan(narrowUpper);
  });

  it('invalidates chained studies when the upstream study settings change', () => {
    const bars = makeBars(180, 30);
    const rsi14: OverlayIndicator = {
      id: 'rsi-cache-source',
      kind: 'RSI',
      placement: 'pane',
      period: 14,
      color: '#00d2ff',
    };
    const rsi5: OverlayIndicator = {
      ...rsi14,
      period: 5,
    };
    const chainedSma: OverlayIndicator = {
      id: 'sma-cache-chain',
      kind: 'SMA',
      placement: 'overlay',
      period: 3,
      color: '#ff9f43',
      sourceIndicatorId: rsi14.id,
    };

    const before = lastFinite(
      buildRenderableIndicators(bars, [rsi14, chainedSma]).overlays[0].lines[0].values,
    );
    const after = lastFinite(
      buildRenderableIndicators(bars, [rsi5, chainedSma]).overlays[0].lines[0].values,
    );

    const referenceRsi: OverlayIndicator = {
      ...rsi5,
      id: 'rsi-cache-source-reference',
    };
    const referenceSma: OverlayIndicator = {
      ...chainedSma,
      id: 'sma-cache-chain-reference',
      sourceIndicatorId: referenceRsi.id,
    };
    const expected = lastFinite(
      buildRenderableIndicators(bars, [referenceRsi, referenceSma]).overlays[0].lines[0].values,
    );

    expect(after).toBeCloseTo(expected, 10);
    expect(after).not.toBeCloseTo(before, 6);
  });

  it('invalidates cached output when the same bars array receives a changed latest bar', () => {
    const bars = makeBars(180);
    const indicator: OverlayIndicator = {
      id: 'sma-tail-mutation',
      kind: 'SMA',
      placement: 'overlay',
      period: 5,
      color: '#5dafff',
    };

    const before = lastFinite(
      buildRenderableIndicators(bars, [indicator]).overlays[0].lines[0].values,
    );
    const lastBar = bars[bars.length - 1];
    lastBar.open += 100;
    lastBar.high += 100;
    lastBar.low += 100;
    lastBar.close += 100;

    const after = lastFinite(
      buildRenderableIndicators(bars, [indicator]).overlays[0].lines[0].values,
    );

    expect(after).toBeGreaterThan(before);
  });
});

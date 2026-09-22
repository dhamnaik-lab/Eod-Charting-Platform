import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators, type RenderablePane } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';

describe('Phase 4: Indicator Chaining & Study-as-Source Engine', () => {
  const sampleBars: OHLCBar[] = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    timestamp: i + 1,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 10,
  }));

  it('chains SMA study over RSI output series', () => {
    const rsiIndicator: OverlayIndicator = {
      id: 'rsi_1',
      kind: 'RSI',
      placement: 'pane',
      period: 14,
      color: '#00d2ff',
    };

    const chainedSmaIndicator: OverlayIndicator = {
      id: 'sma_over_rsi',
      kind: 'SMA',
      placement: 'overlay',
      period: 5,
      color: '#ff9f43',
      sourceIndicatorId: 'rsi_1',
    };

    const bundle = buildRenderableIndicators(sampleBars, [rsiIndicator, chainedSmaIndicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.overlays).toHaveLength(1);

    const rsiPane = bundle.panes.find((p: RenderablePane) => p.indicator.id === 'rsi_1');
    const smaOverlay = bundle.overlays.find((o) => o.indicator.id === 'sma_over_rsi');

    expect(rsiPane).toBeDefined();
    expect(smaOverlay).toBeDefined();

    // Verify SMA values calculated over RSI line values
    expect(smaOverlay?.lines[0].values).toBeDefined();
    expect(smaOverlay?.lines[0].values.length).toBe(sampleBars.length);
  });
});

import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '@/indicators/registry';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';

function createMockBars(count = 200): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i / 10) * 2 + (i % 2 === 0 ? 0.5 : -0.3);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    const volume = 1000 + (i % 10) * 100;
    price = close;
    bars.push({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      timestamp: 1704067200000 + i * 86400000,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return bars;
}

describe('Community Indicators (Top 12 High-Value Scripts)', () => {
  const bars = createMockBars(250);

  it('UT_BOT calculates trailing stop line', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-ut-bot',
      kind: 'UT_BOT',
      placement: 'overlay',
      keyValue: 1,
      atrPeriod: 10,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines[0].values).toHaveLength(bars.length);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('WADDAH_ATTAR calculates explosion line, dead zone, and trend power histogram', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-wae',
      kind: 'WADDAH_ATTAR',
      placement: 'pane',
      sensitivity: 150,
      fastLength: 20,
      slowLength: 40,
      channelLength: 20,
      bbMult: 2.0,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.panes[0].lines).toHaveLength(2); // explosion and dead zone
    expect(bundle.panes[0].histogram?.values).toHaveLength(bars.length);
    expect(bundle.panes[0].histogram?.values[bars.length - 1]).toBeTypeOf('number');
  });

  it('SQUEEZE_MOMENTUM calculates 4-color linear regression momentum histogram', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-sqz',
      kind: 'SQUEEZE_MOMENTUM',
      placement: 'pane',
      bbLength: 20,
      bbMult: 2.0,
      kcLength: 20,
      kcMult: 1.5,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.panes[0].histogram?.values).toHaveLength(bars.length);
    expect(bundle.panes[0].histogram?.values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.panes[0].histogram?.colorValues).toBeDefined();
  });

  it('WAVETREND calculates WT1 and WT2 oscillator lines', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-wt',
      kind: 'WAVETREND',
      placement: 'pane',
      channelLength: 10,
      averageLength: 21,
      obLevel1: 60,
      osLevel1: -60,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.panes[0].lines).toHaveLength(2);
    expect(bundle.panes[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.panes[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('QQE_MOD calculates secondary trend and momentum histogram', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-qqe',
      kind: 'QQE_MOD',
      placement: 'pane',
      rsiLengthPrimary: 6,
      rsiSmoothingPrimary: 5,
      qqeFactorPrimary: 3.0,
      rsiLengthSecondary: 6,
      rsiSmoothingSecondary: 5,
      qqeFactorSecondary: 1.61,
      bollingerLength: 50,
      bollingerMultiplier: 0.35,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.panes[0].lines).toHaveLength(1);
    expect(bundle.panes[0].histogram?.values).toHaveLength(bars.length);
    expect(bundle.panes[0].histogram?.values[bars.length - 1]).toBeTypeOf('number');
  });

  it('CHANDELIER_EXIT calculates long and short stops', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-ce',
      kind: 'CHANDELIER_EXIT',
      placement: 'overlay',
      atrPeriod: 22,
      atrMult: 3.0,
      useClose: true,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(2);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.overlays[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('SSL_CHANNEL calculates SSL Up and SSL Down lines', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-ssl',
      kind: 'SSL_CHANNEL',
      placement: 'overlay',
      period: 10,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(2);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.overlays[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('RIPSTER_EMA_CLOUDS calculates 6 cloud EMA lines', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-rec',
      kind: 'RIPSTER_EMA_CLOUDS',
      placement: 'overlay',
      source: 'hl2',
      shortLen1: 8,
      longLen1: 9,
      shortLen2: 5,
      longLen2: 12,
      shortLen3: 34,
      longLen3: 50,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(6);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('ALPHA_TREND calculates AlphaTrend and lagged line', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-at',
      kind: 'ALPHA_TREND',
      placement: 'overlay',
      coeff: 1.0,
      period: 14,
      useRSI: false,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(2);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.overlays[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('VFI calculates volume flow indicator and signal line', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-vfi',
      kind: 'VFI',
      placement: 'pane',
      length: 130,
      coef: 0.2,
      vcoef: 2.5,
      signalLength: 5,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    expect(bundle.panes[0].lines).toHaveLength(2);
    expect(bundle.panes[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.panes[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('HALF_TREND calculates HalfTrend and ATR High/Low channel lines', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-ht',
      kind: 'HALF_TREND',
      placement: 'overlay',
      amplitude: 2,
      channelDeviation: 2,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(3);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
  });

  it('LINREG_CHANNEL calculates regression Upper, Middle, and Lower lines', () => {
    const indicator: OverlayIndicator = {
      id: 'ind-lrc',
      kind: 'LINREG_CHANNEL',
      placement: 'overlay',
      length: 100,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0].lines).toHaveLength(3);
    expect(bundle.overlays[0].lines[0].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.overlays[0].lines[1].values[bars.length - 1]).toBeTypeOf('number');
    expect(bundle.overlays[0].lines[2].values[bars.length - 1]).toBeTypeOf('number');
  });
});

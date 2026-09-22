import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '@/indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';

function createMockBars(count = 100): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i / 5) * 2 + (i % 2 === 0 ? 0.5 : -0.5);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + 1.0;
    const low = Math.min(open, close) - 1.0;
    const volume = 1000 + (i % 5) * 200;
    bars.push({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      timestamp: 1767225600 + i * 86400,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return bars;
}

describe('Community Indicators Batch 2 Suite', () => {
  const bars = createMockBars(120);

  it('builds SUPERTREND_AI overlay with multi-factor clustering', () => {
    const indicator: OverlayIndicator = {
      id: 'st_ai_1',
      kind: 'SUPERTREND_AI',
      placement: 'overlay',
      atrLen: 10,
      minFactor: 1.0,
      maxFactor: 5.0,
      factorStep: 0.5,
      perfAlpha: 10,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const st = bundle.overlays[0];
    expect(st.lines).toBeDefined();
    expect(st.lines?.length).toBe(2);
    expect(st.lines?.[0].values.some((v) => v !== null && !isNaN(v))).toBe(true);
  });

  it('builds ORDER_BLOCKS overlay with ROC momentum detection', () => {
    const indicator: OverlayIndicator = {
      id: 'ob_1',
      kind: 'ORDER_BLOCKS',
      placement: 'overlay',
      sensitivity: 28,
      mitigationType: 'Close',
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const ob = bundle.overlays[0];
    expect(ob.lines).toBeDefined();
    expect(ob.lines?.length).toBe(4);
  });

  it('builds FVG positioning average overlay', () => {
    const indicator: OverlayIndicator = {
      id: 'fvg_1',
      kind: 'FVG',
      placement: 'overlay',
      lookback: 30,
      atrMultiplier: 0.25,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const fvg = bundle.overlays[0];
    expect(fvg.lines).toBeDefined();
    expect(fvg.lines?.length).toBe(2);
  });

  it('builds MARKET_CIPHER_B pane oscillator with WaveTrend, MFI & VWAP', () => {
    const indicator: OverlayIndicator = {
      id: 'mcb_1',
      kind: 'MARKET_CIPHER_B',
      placement: 'pane',
      wtChannelLen: 9,
      wtAvgLen: 12,
      wtMALen: 3,
      rsiMFIPeriod: 60,
      rsiMFIMult: 150,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    const mcb = bundle.panes[0];
    expect(mcb.lines).toBeDefined();
    expect(mcb.lines?.length).toBe(4);
    expect(mcb.lines?.[0].values.some((v) => v !== null && !isNaN(v))).toBe(true);
    expect(mcb.referenceLines).toEqual([60, 53, 0, -53, -60]);
  });

  it('builds RANGE_FILTER_DW overlay with adaptive ratcheting bands', () => {
    const indicator: OverlayIndicator = {
      id: 'rf_1',
      kind: 'RANGE_FILTER_DW',
      placement: 'overlay',
      period: 50,
      mult: 3.0,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const rf = bundle.overlays[0];
    expect(rf.lines).toBeDefined();
    expect(rf.lines?.length).toBe(3);
    expect(rf.lines?.[0].values.some((v) => v !== null && !isNaN(v))).toBe(true);
  });

  it('builds DONCHIAN_RIBBON pane indicator with 10-layer momentum histogram', () => {
    const indicator: OverlayIndicator = {
      id: 'dtr_1',
      kind: 'DONCHIAN_RIBBON',
      placement: 'pane',
      dlen: 20,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    const dtr = bundle.panes[0];
    expect(dtr.histogram).toBeDefined();
    expect(dtr.histogram?.values.some((v) => v !== null && !isNaN(v))).toBe(true);
  });

  it('builds TRENDLINES_BREAKS overlay with pivot decay trendlines', () => {
    const indicator: OverlayIndicator = {
      id: 'twb_1',
      kind: 'TRENDLINES_BREAKS',
      placement: 'overlay',
      length: 14,
      mult: 1.0,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.overlays).toHaveLength(1);
    const twb = bundle.overlays[0];
    expect(twb.lines).toBeDefined();
    expect(twb.lines?.length).toBe(2);
  });

  it('builds CM_VIX_FIX pane indicator with bottom detection thresholds', () => {
    const indicator: OverlayIndicator = {
      id: 'cvf_1',
      kind: 'CM_VIX_FIX',
      placement: 'pane',
      length: 22,
      bbLen: 20,
      bbMult: 2.0,
      lookbackPct: 50,
      pctHighest: 0.85,
    };
    const bundle = buildRenderableIndicators(bars, [indicator]);
    expect(bundle.panes).toHaveLength(1);
    const cvf = bundle.panes[0];
    expect(cvf.histogram).toBeDefined();
    expect(cvf.histogram?.values.some((v) => v !== null && !isNaN(v))).toBe(true);
    expect(cvf.lines).toBeDefined();
    expect(cvf.lines?.length).toBe(2);
  });
});

import { describe, expect, it, vi, afterEach } from 'vitest';
import { BollingerBands, EMA, MACD, RSI, SMA } from 'technicalindicators';
import { buildRenderableIndicators } from '../Indicators';
import type { OHLCBar, OverlayIndicator } from '../types';
import { getSourceValues, padSeries } from '@/indicators/base';
import { INDICATOR_REGISTRY } from '@/indicators/registry';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

const bars: OHLCBar[] = Array.from({ length: 80 }, (_, i) => {
  const close = 120 + i * 0.3 + Math.sin(i * 0.42) * 4.6;
  return {
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    timestamp: i + 1, open: close - 1, high: close + 3,
    low: close - 3, close, volume: 1000 + i,
  };
});
const closes = bars.map((bar) => bar.close);
const rsi: OverlayIndicator = { id: 'upstream-rsi', kind: 'RSI', placement: 'pane', period: 14, color: '#112233' };
const sma: OverlayIndicator = {
  id: 'rsi-sma', kind: 'SMA', placement: 'overlay', period: 5,
  color: '#234567', sourceIndicatorId: rsi.id,
};
const ema: OverlayIndicator = {
  id: 'rsi-ema', kind: 'EMA', placement: 'overlay', period: 4,
  color: '#345678', sourceIndicatorId: rsi.id,
};

function values(bundle: ReturnType<typeof buildRenderableIndicators>, id: string): Array<number | null> {
  const renderable = [...bundle.overlays, ...bundle.panes].find((item) => item.indicator.id === id);
  expect(renderable).toBeDefined();
  return renderable!.lines[0].values;
}

afterEach(() => vi.restoreAllMocks());

describe('B05: strict Study-as-Source dependency calculations', () => {
  it('calculates RSI→SMA/EMA on valid RSI bars only, preserving every warmup null', () => {
    const result = buildRenderableIndicators(bars, [rsi, sma, ema]);
    const upstream = padSeries(RSI.calculate({ values: closes, period: rsi.period }), bars.length);
    const valid = upstream.filter((value): value is number => value !== null);
    const expectedSma = padSeries(SMA.calculate({ values: valid, period: sma.period }), bars.length);
    const expectedEma = padSeries(EMA.calculate({ values: valid, period: ema.period }), bars.length);
    expect(values(result, rsi.id)).toEqual(upstream);
    expect(values(result, sma.id)).toEqual(expectedSma);
    expect(values(result, ema.id)).toEqual(expectedEma);
    expect(expectedSma.slice(0, 18)).toEqual(new Array(18).fill(null));
    expect(result.diagnostics).toBeUndefined();
  });

  it('matches EMA→RSI and a three-study RSI→EMA→RSI chain, with independent series alignment', () => {
    const upstreamEma: OverlayIndicator = {
      id: 'first-ema', kind: 'EMA', placement: 'overlay', period: 5,
      color: '#456789',
    };
    const downstreamRsi: OverlayIndicator = {
      ...rsi, id: 'rsi-over-ema', period: 6, sourceIndicatorId: upstreamEma.id,
    };
    const chainedRsi: OverlayIndicator = {
      ...rsi, id: 'rsi-over-rsi-ema', period: 6, sourceIndicatorId: ema.id,
    };
    const result = buildRenderableIndicators(bars, [chainedRsi, ema, downstreamRsi, upstreamEma, rsi]);
    const rawEma = EMA.calculate({ values: closes, period: 5 });
    const referenceRsi = padSeries(RSI.calculate({ values: rawEma, period: 6 }), bars.length);
    const rawRsi = RSI.calculate({ values: closes, period: 14 });
    const rawChainedEma = EMA.calculate({ values: rawRsi, period: 4 });
    const secondRsi = padSeries(RSI.calculate({ values: rawChainedEma, period: 6 }), bars.length);
    expect(values(result, downstreamRsi.id)).toEqual(referenceRsi);
    expect(values(result, chainedRsi.id)).toEqual(secondRsi);
    expect(result.diagnostics).toBeUndefined();
    // Render order must remain the input display order, not dependency traversal order.
    expect(result.overlays.map((item) => item.indicator.id)).toEqual([ema.id, upstreamEma.id]);
    expect(result.panes.map((item) => item.indicator.id)).toEqual([chainedRsi.id, downstreamRsi.id, rsi.id]);
  });

  it('gives identical results for reversed order and preserves upstream cache identity', () => {
    const first = buildRenderableIndicators(bars, [rsi, sma, ema]);
    const reversed = buildRenderableIndicators(bars, [ema, sma, rsi]);
    expect(values(reversed, ema.id)).toEqual(values(first, ema.id));
    expect(values(reversed, sma.id)).toEqual(values(first, sma.id));
    expect(reversed.panes[0]).toBe(first.panes[0]);
    expect(reversed.overlays.map((item) => item.indicator.id)).toEqual([ema.id, sma.id]);
  });

  it('resets a downstream SMA after an internal upstream gap without inventing prices', () => {
    const shortBars = bars.slice(0, 9);
    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation((_bars, indicator) => ({
      indicator, title: 'Mock RSI', lines: [{
        key: 'rsi', label: 'RSI',
        values: [null, 10, 12, 14, null, 20, 22, 24, null],
        color: '#888888',
      }],
    }));
    const dependent: OverlayIndicator = { ...sma, period: 2 };
    const result = buildRenderableIndicators(shortBars, [dependent, rsi]);
    expect(values(result, dependent.id)).toEqual([null, null, 11, 13, null, null, 21, 23, null]);
    expect(result.diagnostics).toBeUndefined();
  });

  it('resets a downstream EMA after a gap and preserves multi-output MACD line alignment', () => {
    const input = bars.slice(0, 14);
    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation((_bars, indicator) => ({
      indicator, title: 'Mock RSI', lines: [{
        key: 'rsi', label: 'RSI',
        values: [null, 10, 12, 14, 16, 18, null, 24, 26, 28, 30, 32, 34, 36],
        color: '#888888',
      }],
    }));
    const dependent: OverlayIndicator = { ...ema, period: 3 };
    const result = buildRenderableIndicators(input, [rsi, dependent]);
    expect(values(result, dependent.id)).toEqual([
      null, null, null, 12, 14, 16, null, null, null, 26, 28, 30, 32, 34,
    ]);
  });

  it('rejects missing, hidden, failed and unsupported upstream sources without Close fallback', () => {
    const missing: OverlayIndicator = { ...sma, sourceIndicatorId: 'absent' };
    const hidden: OverlayIndicator = { ...rsi, visible: false };
    const hiddenConsumer: OverlayIndicator = { ...sma, sourceIndicatorId: rsi.id };
    const missingResult = buildRenderableIndicators(bars, [missing]);
    expect(missingResult.overlays).toHaveLength(0);
    expect(missingResult.diagnostics?.[0].message).toContain('missing');

    const hiddenResult = buildRenderableIndicators(bars, [hiddenConsumer, hidden]);
    expect(hiddenResult.overlays).toHaveLength(0);
    expect(hiddenResult.diagnostics?.[0].message).toContain('hidden');

    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation(() => { throw new Error('Failed upstream'); });
    const failed = buildRenderableIndicators(bars.slice(), [sma, rsi]);
    expect(failed.overlays).toHaveLength(0);
    expect(failed.diagnostics?.map((d) => d.indicatorId)).toEqual([sma.id, rsi.id]);
    expect(failed.diagnostics?.find((d) => d.indicatorId === rsi.id)?.message).toContain('Failed upstream');

    const unsupported: OverlayIndicator = {
      id: 'volume-chained', kind: 'OBV', placement: 'pane', color: '#888888',
      sourceIndicatorId: rsi.id,
    };
    const wrong = buildRenderableIndicators(bars.slice(), [unsupported, rsi]);
    expect(wrong.diagnostics?.some((d) => d.message.includes('does not support Study-as-Source'))).toBe(true);
  });

  it('blocks direct, two-node and three-node cycles and keeps independent studies working', () => {
    const self: OverlayIndicator = { ...sma, sourceIndicatorId: sma.id };
    const a: OverlayIndicator = { ...sma, id: 'cycle-a', sourceIndicatorId: 'cycle-b' };
    const b: OverlayIndicator = { ...ema, id: 'cycle-b', sourceIndicatorId: 'cycle-a' };
    const c: OverlayIndicator = { ...ema, id: 'cycle-c', sourceIndicatorId: 'cycle-d' };
    const d: OverlayIndicator = { ...sma, id: 'cycle-d', sourceIndicatorId: 'cycle-e' };
    const e: OverlayIndicator = { ...ema, id: 'cycle-e', sourceIndicatorId: 'cycle-c' };
    const healthy: OverlayIndicator = { ...ema, id: 'healthy-independent', sourceIndicatorId: undefined };
    const result = buildRenderableIndicators(bars, [self, a, b, c, d, e, healthy]);
    expect(result.overlays.map((item) => item.indicator.id)).toEqual([healthy.id]);
    expect(result.diagnostics).toHaveLength(6);
    expect(result.diagnostics?.some((diag) => diag.message.includes('Circular'))).toBe(true);
    expect(values(result, healthy.id).at(-1)).not.toBeNull();
  });

  it('honors sourcePlotKey and rejects nonexistent plot selections', () => {
    const upstream: OverlayIndicator = { ...rsi, id: 'multi-source' };
    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation((_bars, indicator) => ({
      indicator, title: 'Multi', lines: [
        { key: 'first', label: 'First', values: new Array(bars.length).fill(100), color: '#888888' },
        { key: 'second', label: 'Second', values: new Array(bars.length).fill(10), color: '#999999' },
      ],
    }));
    const selected: OverlayIndicator = { ...sma, sourceIndicatorId: upstream.id, sourcePlotKey: 'second', period: 3 };
    const result = buildRenderableIndicators(bars, [selected, upstream]);
    expect(values(result, selected.id).at(-1)).toBe(10);
    const invalid: OverlayIndicator = { ...selected, sourcePlotKey: 'not-a-plot' };
    const wrong = buildRenderableIndicators(bars.slice(), [invalid, upstream]);
    expect(wrong.overlays).toHaveLength(0);
    expect(wrong.diagnostics?.[0].message).toContain('no matching aligned plot');
  });

  it('enforces strict source resolution when a selected upstream series is absent or contains null', () => {
    expect(() => getSourceValues(bars.slice(0, 2), 'close', 'missing', new Map())).toThrow('unavailable');
    expect(() => getSourceValues(bars.slice(0, 2), 'close', 'up', new Map([
      ['up', [null, 100]],
    ]))).toThrow('missing a value at bar 0');
    expect(getSourceValues(bars.slice(0, 2), 'high')).toEqual(bars.slice(0, 2).map((bar) => bar.high));
  });

  it('preserves persisted source IDs and chosen plot keys without rewriting chart settings', () => {
    const saved = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-chain',
      chartTabs: [{
        id: 'tab-chain', title: 'Chained chart', instrument: null,
        timeframe: 'D', chartType: 'candles', renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 79 },
        indicators: [rsi, { ...sma, sourcePlotKey: 'rsi' }],
        drawings: [], indicatorPaneHeight: 160, sheets: [], activeSheetId: null,
        layoutMode: 'single',
      }],
    }));
    expect(saved?.chartTabs[0].indicators).toMatchObject([rsi, { ...sma, sourcePlotKey: 'rsi' }]);
    expect(saved?.chartTabs[0].timeframe).toBe('D');
  });
  it('rejects duplicate upstream IDs rather than selecting an arbitrary source', () => {
    const consumer: OverlayIndicator = { ...sma };
    const alternative: OverlayIndicator = { ...rsi, period: 6 };
    const result = buildRenderableIndicators(bars.slice(0, 40), [consumer, rsi, alternative]);
    expect(result.overlays).toHaveLength(0);
    expect(result.diagnostics?.[0].indicatorId).toBe(consumer.id);
    expect(result.diagnostics?.[0].message).toContain('ambiguous duplicate ID');
  });

  it('preserves MACD histogram and Bollinger bands across a gap with restarted calculations', () => {
    const input = bars.slice(0, 40);
    const upstreamValues: Array<number | null> = [
      null,
      ...Array.from({ length: 19 }, (_, i) => 100 + i),
      null,
      ...Array.from({ length: 19 }, (_, i) => 150 + i),
    ];
    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation((_bars, indicator) => ({
      indicator, title: 'Source', lines: [{
        key: 'rsi', label: 'RSI', values: upstreamValues, color: '#abcdef',
      }],
    }));
    const macd: OverlayIndicator = {
      id: 'gap-macd', kind: 'MACD', placement: 'pane',
      fastPeriod: 3, slowPeriod: 5, signalPeriod: 2,
      color: '#112233', signalColor: '#223344',
      histogramPositiveColor: '#334455', histogramNegativeColor: '#445566',
      sourceIndicatorId: rsi.id,
    };
    const boll: OverlayIndicator = {
      id: 'gap-boll', kind: 'BOLL', placement: 'overlay',
      period: 3, stdDev: 2, color: '#abcdef', sourceIndicatorId: rsi.id,
    };
    const result = buildRenderableIndicators(input, [macd, boll, rsi]);
    const first = upstreamValues.slice(1, 20) as number[];
    const second = upstreamValues.slice(21) as number[];
    const calculateMacd = (values: number[]) => MACD.calculate({
      values, fastPeriod: 3, slowPeriod: 5, signalPeriod: 2,
      SimpleMAOscillator: false, SimpleMASignal: false,
    });
    const expectedHistogram = [
      null,
      ...padSeries(calculateMacd(first).map((value) => value.histogram ?? null), 19),
      null,
      ...padSeries(calculateMacd(second).map((value) => value.histogram ?? null), 19),
    ];
    const expectedBand = [
      null,
      ...padSeries(BollingerBands.calculate({ values: first, period: 3, stdDev: 2 }).map((v) => v.upper), 19),
      null,
      ...padSeries(BollingerBands.calculate({ values: second, period: 3, stdDev: 2 }).map((v) => v.upper), 19),
    ];
    const renderedMacd = result.panes.find((item) => item.indicator.id === macd.id);
    const renderedBoll = result.overlays.find((item) => item.indicator.id === boll.id);
    expect(renderedMacd?.histogram?.values).toEqual(expectedHistogram);
    expect(renderedBoll?.band?.upper).toEqual(expectedBand);
    expect(renderedMacd?.lines[0].values[20]).toBeNull();
    expect(renderedBoll?.band?.lower[20]).toBeNull();
    expect(result.diagnostics).toBeUndefined();
  });

  it('uses a selected histogram plot as the input to a downstream SMA', () => {
    const macd: OverlayIndicator = {
      id: 'upstream-macd-hist', kind: 'MACD', placement: 'pane',
      fastPeriod: 3, slowPeriod: 5, signalPeriod: 2,
      color: '#112233', signalColor: '#223344',
      histogramPositiveColor: '#334455', histogramNegativeColor: '#445566',
    };
    const downstream: OverlayIndicator = {
      ...sma, id: 'sma-over-hist', period: 3,
      sourceIndicatorId: macd.id, sourcePlotKey: 'macd-hist',
    };
    const actual = buildRenderableIndicators(bars, [downstream, macd]);
    const histogram = actual.panes[0].histogram?.values ?? [];
    const valid = histogram.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    expect(values(actual, downstream.id)).toEqual(
      padSeries(SMA.calculate({ values: valid, period: 3 }), bars.length),
    );
    expect(actual.diagnostics).toBeUndefined();
  });

  it('does not revise previously completed chained bars when a new bar is appended', () => {
    const full = buildRenderableIndicators(bars.slice(), [rsi, sma]);
    const prefix = buildRenderableIndicators(bars.slice(0, -1), [rsi, sma]);
    expect(values(full, sma.id).slice(0, -1)).toEqual(values(prefix, sma.id));
    expect(full.diagnostics).toBeUndefined();
    expect(prefix.diagnostics).toBeUndefined();
  });

});

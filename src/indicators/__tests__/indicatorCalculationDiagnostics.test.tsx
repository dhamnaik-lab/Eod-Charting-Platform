import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChartPriceLegendOverlay } from '@/components/ChartPriceLegendOverlay';
import { DEFAULT_RENKO_SETTINGS } from '@/features/charts/chartTypeTransformService';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { INDICATOR_REGISTRY } from '../registry';

const makeBars = (count = 25): OHLCBar[] => Array.from({ length: count }, (_, index) => ({
  date: '2026-01-' + String(index + 1).padStart(2, '0'),
  timestamp: index + 1,
  open: 100 + index,
  high: 104 + index,
  low: 98 + index,
  close: 102 + index,
  volume: 1000 + index,
}));

const ema: OverlayIndicator = {
  id: 'ema-issue-b03',
  kind: 'EMA',
  placement: 'overlay',
  period: 6,
  source: 'close',
  color: '#4287f5',
};

const sma: OverlayIndicator = {
  id: 'sma-b03-healthy',
  kind: 'SMA',
  placement: 'overlay',
  period: 5,
  source: 'close',
  color: '#1d9a7b',
};

function renderLegend(bars: OHLCBar[], overlays: OverlayIndicator[], expanded = true) {
  return renderToStaticMarkup(createElement(ChartPriceLegendOverlay, {
    instrument: { symbol: 'TEST', exchange: 'NSE' },
    instrumentName: 'Test symbol',
    timeframe: 'D',
    chartType: 'candles',
    renkoSettings: DEFAULT_RENKO_SETTINGS,
    bars,
    viewport: { startIndex: 0, endIndex: bars.length },
    compareOverlays: [],
    overlays,
    layout: {
      axisWidth: 64,
      leftAxisWidth: 0,
      chartWidth: 780,
      contentHeight: 420,
      priceHeight: 300,
      volumeHeight: 70,
      paneHeight: 50,
      paneHeights: [],
      paneTops: [],
      priceAxisGap: 0,
    },
    hoverBarIndex: null,
    onSaveIndicator: () => undefined,
    onRemoveIndicator: () => undefined,
    onToggleIndicatorVisibility: () => undefined,
    secondaryLegendExpanded: expanded,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('B03 indicator calculation diagnostic visibility', () => {
  it('isolates a throwing builder and preserves healthy sibling values', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => {
      throw new Error('Invalid calculation parameter');
    });
    const bars = makeBars();
    const result = buildRenderableIndicators(bars, [ema, sma]);

    expect(result.overlays.map((item) => item.indicator.id)).toEqual([sma.id]);
    expect(result.overlays[0].lines[0].values.some((value) => typeof value === 'number')).toBe(true);
    expect(result.diagnostics).toEqual([{
      indicatorId: ema.id,
      indicatorKind: 'EMA',
      severity: 'error',
      message: 'Calculation failed: Invalid calculation parameter',
    }]);
  });

  it('deduplicates messages by indicator ID without notifications or repeated status entries', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => {
      throw new Error('Bad period');
    });
    const duplicate = { ...ema, period: 12 };
    const result = buildRenderableIndicators(makeBars(), [ema, duplicate, sma]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics?.[0].message).toContain('Bad period');
    expect(result.overlays.map((item) => item.indicator.id)).toEqual([sma.id]);
  });

  it('keeps bad persisted parameters localized to the failing indicator', () => {
    const original = INDICATOR_REGISTRY.EMA;
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation((bars, indicator, sources, sourceSeriesMap) => {
      if (indicator.period <= 0) throw new Error('Period must be positive');
      return original(bars, indicator, sources, sourceSeriesMap);
    });
    const broken: OverlayIndicator = { ...ema, period: 0 };
    const result = buildRenderableIndicators(makeBars(), [broken, sma]);
    expect(result.diagnostics?.[0]).toMatchObject({ indicatorId: ema.id, severity: 'error' });
    expect(result.diagnostics?.[0].message).toContain('Period must be positive');
    expect(result.overlays).toHaveLength(1);
  });

  it('reports a null builder as unavailable, not as an exception', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => null);
    const result = buildRenderableIndicators(makeBars(3), [ema, sma]);
    expect(result.diagnostics).toEqual([{
      indicatorId: ema.id,
      indicatorKind: 'EMA',
      severity: 'unavailable',
      message: 'No output for current bars or settings',
    }]);
  });

  it('does not report an empty chart or ordinary short-history warmup as a failure', () => {
    expect(buildRenderableIndicators([], [ema]).diagnostics).toBeUndefined();
    const result = buildRenderableIndicators(makeBars(2), [{ ...ema, period: 20 }]);
    expect(result.diagnostics).toBeUndefined();
    expect(result.overlays).toHaveLength(1);
  });

  it('never diagnoses a hidden study', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => {
      throw new Error('Should never run');
    });
    const result = buildRenderableIndicators(makeBars(), [{ ...ema, visible: false }, sma]);
    expect(result.diagnostics).toBeUndefined();
    expect(result.overlays.map((overlay) => overlay.indicator.id)).toEqual([sma.id]);
  });

  it('clears the visible failure status automatically after the builder recovers', () => {
    const spy = vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => {
      throw new Error('Temporary failure');
    });
    const bars = makeBars();
    const first = buildRenderableIndicators(bars, [ema, sma]);
    expect(first.diagnostics).toHaveLength(1);
    spy.mockRestore();
    const next = buildRenderableIndicators(bars, [ema, sma]);
    expect(next.diagnostics).toBeUndefined();
    expect(next.overlays.map((item) => item.indicator.id)).toEqual([ema.id, sma.id]);
    expect(next.overlays[1]).toBe(first.overlays[0]);
  });

  it('renders failure in an accessible legend status even when indicator legend is collapsed', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'EMA').mockImplementation(() => {
      throw new Error('Unable to calculate EMA');
    });
    const markup = renderLegend(makeBars(), [ema, sma], false);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Indicator calculation status"');
    expect(markup).toContain('Calculation failed: Unable to calculate EMA');
    expect(markup.match(/Calculation failed: Unable to calculate EMA/g)).toHaveLength(1);
    expect(markup).toContain('Test symbol');
  });

  it('surfaces pane indicator failures from the same bundle in the price legend', () => {
    vi.spyOn(INDICATOR_REGISTRY, 'RSI').mockImplementation(() => {
      throw new Error('RSI builder failed');
    });
    const rsi: OverlayIndicator = { id: 'rsi-b03-pane', kind: 'RSI', placement: 'pane', period: 14, color: '#a335d4' };
    const markup = renderLegend(makeBars(), [sma, rsi]);
    expect(markup).toContain('RSI builder failed');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('SMA');
  });
});

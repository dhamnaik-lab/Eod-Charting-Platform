import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { SMA } from 'technicalindicators';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { ChartPaneControlsOverlay } from '@/components/ChartPaneControlsOverlay';
import { ChartPriceLegendOverlay } from '@/components/ChartPriceLegendOverlay';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import type { ChartLayout } from '@/engine/ChartEngine';
import { padSeries } from '@/indicators/base';
import {
  getEligibleStudySourceChoices,
  studySourceOptionValue,
} from '@/indicators/studySourceChoices';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

let editingLegendIndicator = false;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const result = actual.useState(initial);
      if (editingLegendIndicator && initial === null) {
        return ['downstream', result[1]] as unknown as typeof result;
      }
      return result;
    },
  };
});
vi.mock('react-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-dom')>(),
  createPortal: (node: unknown) => node,
}));

const bars: OHLCBar[] = Array.from({ length: 100 }, (_, i) => {
  const close = 115 + i * 0.2 + Math.sin(i * 0.32) * 4;
  return {
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    timestamp: i + 1,
    open: close - 1,
    high: close + 3,
    low: close - 3,
    close,
    volume: 1000 + i * 17,
  };
});

const rsi: OverlayIndicator = {
  id: 'rsi-source', kind: 'RSI', placement: 'pane', period: 14, color: '#445566',
};
const macd: OverlayIndicator = {
  id: 'macd-source', kind: 'MACD', placement: 'pane',
  fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#334455',
  signalColor: '#667788', histogramPositiveColor: '#22aa44', histogramNegativeColor: '#aa2244',
};
const downstream: OverlayIndicator = {
  id: 'downstream', kind: 'SMA', placement: 'overlay', period: 3, color: '#aabbcc',
};

function dialog(indicator: OverlayIndicator, allIndicators: OverlayIndicator[], sourceBars = bars) {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator, allIndicators, sourceBars,
    onSave: () => undefined, onRemove: () => undefined, onClose: () => undefined,
  }));
}

afterEach(() => {
  editingLegendIndicator = false;
  vi.unstubAllGlobals();
});

describe('B13: valid Study-as-Source choices and both settings mounts', () => {
  it('offers only actual numeric, aligned upstream plots with their explicit output keys', () => {
    const list = [downstream, rsi, macd];
    const choices = getEligibleStudySourceChoices(bars, list, downstream);
    expect(choices.map((item) => item.plotKey)).toContain('rsi');
    expect(choices.map((item) => item.plotKey)).toContain('macd-main');
    expect(choices.map((item) => item.plotKey)).toContain('macd-sig');
    expect(choices.map((item) => item.plotKey)).toContain('macd-hist');
    expect(choices.every((item) => item.indicatorId !== downstream.id)).toBe(true);
    const hist = choices.find((item) => item.plotKey === 'macd-hist');
    expect(hist?.indicatorId).toBe(macd.id);
    expect(hist?.label).toContain('Histogram');
    expect(hist?.value).toBe(studySourceOptionValue(macd.id, 'macd-hist'));
  });

  it('rejects self, transitively cyclic, hidden, missing-output and ambiguous duplicate sources', () => {
    const hidden: OverlayIndicator = { ...rsi, id: 'hidden', visible: false };
    const cyclic: OverlayIndicator = { ...rsi, id: 'dependent', sourceIndicatorId: downstream.id };
    const missing: OverlayIndicator = { ...rsi, id: 'missing-upstream', sourceIndicatorId: 'not-found' };
    const duplicate: OverlayIndicator = { ...rsi, id: 'duplicate', period: 8 };
    const choices = getEligibleStudySourceChoices(
      bars, [downstream, rsi, hidden, cyclic, missing, duplicate, { ...duplicate, period: 11 }],
      downstream,
    );
    expect(choices.map((item) => item.indicatorId)).toEqual([rsi.id]);
    expect(getEligibleStudySourceChoices(bars, [downstream, rsi], { ...downstream, kind: 'SMA' })).toHaveLength(1);
  });

  it('does not offer unsupported consumers, entirely unavailable outputs, or empty bar histories', () => {
    const unsupported: OverlayIndicator = { id: 'obv', kind: 'OBV', placement: 'pane', color: '#445566' };
    expect(getEligibleStudySourceChoices(bars, [rsi, unsupported], unsupported)).toEqual([]);
    expect(getEligibleStudySourceChoices([], [rsi, downstream], downstream)).toEqual([]);
    expect(getEligibleStudySourceChoices(bars.slice(0, 5), [rsi, downstream], downstream)).toEqual([]);
  });

  it('renders keyboard-native Source select with valid line/histogram options and original price choices', () => {
    const markup = dialog(downstream, [downstream, rsi, macd]);
    expect(markup).toContain('Active Indicators (Study-as-Source)');
    expect(markup).toContain('Price Data');
    for (const label of ['Close', 'Open', 'High', 'Low', 'HL/2', 'HLC/3', 'OHLC/4']) {
      expect(markup).toContain(`>${label}</option>`);
    }
    expect(markup).toContain(`value="${studySourceOptionValue(rsi.id, 'rsi')}"`);
    expect(markup).toContain(`value="${studySourceOptionValue(macd.id, 'macd-hist')}"`);
    expect(markup).not.toContain('study:downstream:');
    expect(markup).toContain('Save');
  });

  it('preserves saved chosen plot and flags missing source rather than silently displaying Close', () => {
    const selected = {
      ...downstream, source: 'close' as const,
      sourceIndicatorId: macd.id, sourcePlotKey: 'macd-hist',
    };
    const html = dialog(selected, [selected, rsi, macd]);
    expect(html).toContain(`value="${studySourceOptionValue(macd.id, 'macd-hist')}" selected=""`);
    const unavailable = dialog({ ...selected, sourceIndicatorId: 'gone' }, [selected, rsi, macd]);
    expect(unavailable).toContain('Unavailable saved study source');
    expect(unavailable).toContain('disabled=""');
    expect(unavailable).toContain('Price Data');
    const saved = parsePersistedWorkspace(JSON.stringify({
      version: 1, activeChartTabId: 'chart',
      chartTabs: [{
        id: 'chart', title: 'Source chart', instrument: null, timeframe: 'D',
        chartType: 'candles', renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 100 },
        indicators: [rsi, macd, selected], drawings: [],
        indicatorPaneHeight: 160, sheets: [], activeSheetId: null, layoutMode: 'single',
      }],
    }));
    expect(saved?.chartTabs[0].indicators[2]).toMatchObject({
      sourceIndicatorId: macd.id, sourcePlotKey: 'macd-hist',
    });
  });

  it('retains histogram-based numerical calculation, reorder independence and warmup nulls', () => {
    const selected: OverlayIndicator = {
      ...downstream, sourceIndicatorId: macd.id, sourcePlotKey: 'macd-hist',
    };
    const result = buildRenderableIndicators(bars, [selected, rsi, macd]);
    const reversed = buildRenderableIndicators(bars, [macd, rsi, selected]);
    const histogram = result.panes.find((item) => item.indicator.id === macd.id)?.histogram?.values ?? [];
    const finite = histogram.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const expected = padSeries(SMA.calculate({ values: finite, period: 3 }), bars.length);
    expect(result.overlays.find((item) => item.indicator.id === selected.id)?.lines[0].values).toEqual(expected);
    expect(reversed.overlays.find((item) => item.indicator.id === selected.id)?.lines[0].values).toEqual(expected);
    expect(expected[0]).toBeNull();
    expect(result.diagnostics).toBeUndefined();
  });

  it('forwards pane settings to the actual modal with every chart study available', () => {
    vi.stubGlobal('document', { body: {} });
    const markup = renderToStaticMarkup(createElement(ChartPaneControlsOverlay, {
      paneIndicators: [],
      allIndicators: [downstream, rsi, macd],
      sourceBars: bars,
      layout: { paneTops: [], priceHeight: 300, volumeHeight: 0, axisWidth: 65 },
      indicatorPaneHeights: {},
      indicatorPaneHeight: 160,
      collapsedIndicatorPanes: {},
      paneScaleOverrides: {},
      paneSettingsIndicator: downstream,
      onStartPaneResize: () => undefined,
      onTogglePaneCollapsed: () => undefined,
      onResetPaneScale: () => undefined,
      onMovePane: () => undefined,
      onOpenPaneSettings: () => undefined,
      onCreateAlert: () => undefined,
      onSaveIndicator: () => undefined,
      onRemoveIndicator: () => undefined,
      onToggleIndicatorVisibility: () => undefined,
      onClosePaneSettings: () => undefined,
    }));
    expect(markup).toContain(studySourceOptionValue(macd.id, 'macd-hist'));
    expect(markup).toContain('Active Indicators (Study-as-Source)');
  });

  it('forwards price-legend settings with the identical set of upstream choices', () => {
    editingLegendIndicator = true;
    const markup = renderToStaticMarkup(createElement(ChartPriceLegendOverlay, {
      instrument: { exchange: 'NSE', symbol: 'B13' },
      instrumentName: null,
      timeframe: 'D', chartType: 'candles',
      renkoSettings: { boxSizeMode: 'traditional', boxSize: 10 } as never,
      bars, viewport: { startIndex: 0, endIndex: 100 },
      compareOverlays: [],
      overlays: [downstream, rsi, macd],
      layout: { chartWidth: 960, priceHeight: 400, volumeHeight: 0 } as unknown as ChartLayout,
      hoverBarIndex: null,
      onSaveIndicator: () => undefined,
      onRemoveIndicator: () => undefined,
      onToggleIndicatorVisibility: () => undefined,
    }));
    expect(markup).toContain(studySourceOptionValue(macd.id, 'macd-hist'));
    expect(markup).toContain('Active Indicators (Study-as-Source)');
  });
});

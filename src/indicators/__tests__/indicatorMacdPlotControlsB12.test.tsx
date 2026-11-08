import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

let showStyleTab = false;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const result = actual.useState(initial);
      if (initial === 'inputs' && showStyleTab) {
        return ['style', result[1]] as unknown as typeof result;
      }
      return result;
    },
  };
});

const macd: OverlayIndicator = {
  id: 'b12-macd', kind: 'MACD', placement: 'pane',
  fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
  color: '#112233', signalColor: '#445566',
  histogramPositiveColor: '#117744', histogramNegativeColor: '#aa3344',
};

const bars: OHLCBar[] = Array.from({ length: 90 }, (_, i) => {
  const close = 100 + Math.sin(i / 7) * 8 + i / 8;
  return {
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    timestamp: i + 1,
    open: close - 1,
    high: close + 2,
    low: close - 3,
    close,
    volume: 1000 + 10 * i,
  };
});

function styleMarkup(indicator: OverlayIndicator): string {
  showStyleTab = true;
  try {
    return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
      indicator, onSave: () => undefined, onRemove: () => undefined, onClose: () => undefined,
    }));
  } finally {
    showStyleTab = false;
  }
}

function pane(indicator: OverlayIndicator) {
  const result = buildRenderableIndicators(bars, [indicator]);
  expect(result.diagnostics).toBeUndefined();
  expect(result.panes).toHaveLength(1);
  return result.panes[0];
}

afterEach(() => { showStyleTab = false; });

describe('B12: MACD settings reflect actual supported plot rendering', () => {
  it('hides only ineffective MACD Plot Type and Opacity controls', () => {
    const html = styleMarkup(macd);
    expect(html).toContain('MACD');
    expect(html).toContain('Signal');
    expect(html).toContain('Histogram');
    expect(html).not.toContain('<span>Plot Type</span>');
    expect(html).not.toContain('<span>Opacity (');
    expect(html).toContain('<span>Width</span>');
    expect(html).toContain('<span>Line Style</span>');
    expect(html).toContain('aria-label="Color"');
    expect(html).toContain('aria-label="Up"');
    expect(html).toContain('aria-label="Down"');
    expect(html).toContain('Save');
  });

  it('does not hide plot controls for another indicator kind', () => {
    const adx: OverlayIndicator = {
      id: 'b12-adx', kind: 'ADX', placement: 'pane',
      period: 14, color: '#112233', plusColor: '#223344', minusColor: '#334455',
    };
    const html = styleMarkup(adx);
    expect(html).toContain('<span>Plot Type</span>');
    expect(html).toContain('<span>Opacity (100%)</span>');
  });

  it('retains exact numeric MACD, signal and histogram values for ignored legacy metadata', () => {
    const legacy: OverlayIndicator = {
      ...macd,
      presentation: {
        plots: {
          macd: { plotStyle: 'histogram', opacity: 0.2 },
          signal: { plotStyle: 'area', opacity: 0.4 },
          histogram: { opacity: 0.6 },
        },
      },
    };
    expect(styleMarkup(legacy)).not.toContain('<span>Plot Type</span>');
    expect(styleMarkup(legacy)).not.toContain('<span>Opacity (');
    const original = pane(macd);
    const previous = pane(legacy);
    expect(previous.lines.map(line => line.values)).toEqual(original.lines.map(line => line.values));
    expect(previous.histogram?.values).toEqual(original.histogram?.values);
    expect(previous.lines.map(line => line.color)).toEqual(original.lines.map(line => line.color));
    expect(previous.histogram?.positiveColor).toBe(original.histogram?.positiveColor);
  });

  it('retains supported MACD plot colors, line widths, styles and visibility', () => {
    const customized: OverlayIndicator = {
      ...macd,
      presentation: {
        plots: {
          macd: { color: '#abcdef', lineWidth: 3, lineStyle: 'dashed' },
          signal: { visible: false },
          histogram: { positiveColor: '#123abc', negativeColor: '#ab3210' },
        },
      },
    };
    const result = pane(customized);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ color: '#abcdef', lineWidth: 3, lineStyle: 'dashed' });
    expect(result.histogram).toMatchObject({
      positiveColor: '#123abc', negativeColor: '#ab3210',
    });
    expect(result.histogram?.values.some(value => typeof value === 'number')).toBe(true);
  });

  it('preserves legacy plot-style, opacity and supported fields through workspace restore', () => {
    const legacy = {
      ...macd,
      presentation: {
        plots: {
          macd: { color: '#aabbcc', lineWidth: 2.5, lineStyle: 'dotted', plotStyle: 'area', opacity: 0.3 },
          signal: { plotStyle: 'cross', opacity: 0.5 },
          histogram: { positiveColor: '#119911', opacity: 0.1 },
        },
      },
    };
    const saved = JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-b12',
      chartTabs: [{
        id: 'tab-b12', title: 'B12 MACD',
        instrument: null, timeframe: 'D', chartType: 'candles',
        renkoBrickSize: 10, viewport: { startIndex: 0, endIndex: 89 },
        indicators: [legacy], drawings: [], indicatorPaneHeight: 160,
        sheets: [], activeSheetId: null, layoutMode: 'single',
      }],
    });
    const restored = parsePersistedWorkspace(saved);
    const indicator = restored?.chartTabs[0].indicators[0];
    expect(indicator).toMatchObject(legacy);
    expect(indicator && styleMarkup(indicator)).not.toContain('<span>Plot Type</span>');
    expect(indicator && styleMarkup(indicator)).not.toContain('<span>Opacity (');
    expect(indicator && pane(indicator).lines[0]).toMatchObject({
      color: '#aabbcc', lineWidth: 2.5, lineStyle: 'dotted',
    });
  });
});

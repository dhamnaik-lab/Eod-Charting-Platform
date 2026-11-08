import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

const closes = [10, 12, 19, 21, 24, 30];
const bars: OHLCBar[] = closes.map((close, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  timestamp: index + 1,
  open: close - 1,
  high: close + index * 4 + 1,
  low: close - index * 2 - 1,
  close,
  volume: 1000,
}));

const stdev: OverlayIndicator = {
  id: 'stdev-b08',
  kind: 'STDEV',
  placement: 'pane',
  period: 3,
  color: '#2962FF',
};

function dialogHtml(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

function stdevValues(indicator: OverlayIndicator, inputBars = bars): Array<number | null> {
  const result = buildRenderableIndicators(inputBars, [indicator]);
  expect(result.diagnostics).toBeUndefined();
  expect(result.panes).toHaveLength(1);
  return result.panes[0].lines[0].values;
}

describe('B08: STDEV settings reflect Close-only computation', () => {
  it('hides only the ineffective STDEV Source field while retaining Period and Save', () => {
    const html = dialogHtml(stdev);
    expect(html).toContain('Standard Deviation');
    expect(html).toMatch(/<span>Period<\/span>/);
    expect(html).not.toMatch(/<span>Source<\/span>/);
    expect(html).toContain('Save');

    const ema: OverlayIndicator = {
      id: 'ema-source-control',
      kind: 'EMA',
      placement: 'overlay',
      period: 3,
      color: '#2962FF',
      source: 'high',
    };
    expect(dialogHtml(ema)).toMatch(/<span>Source<\/span>/);
  });

  it('continues to compute Close-price population standard deviation with the same warmup', () => {
    const actual = stdevValues(stdev);
    expect(actual).toHaveLength(closes.length);
    expect(actual.slice(0, 2)).toEqual([null, null]);

    for (let index = 2; index < closes.length; index += 1) {
      const window = closes.slice(index - 2, index + 1);
      const mean = window.reduce((sum, value) => sum + value, 0) / 3;
      const expected = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 3);
      expect(actual[index]).toBeCloseTo(expected, 10);
    }
  });

  it('keeps the saved but unsupported Source value inert, rather than reinterpreting it', () => {
    const legacy = { ...stdev, source: 'high' as const };
    expect(dialogHtml(legacy)).not.toMatch(/<span>Source<\/span>/);
    expect(stdevValues(legacy)).toEqual(stdevValues(stdev));

    const highSeries = bars.map((bar) => bar.high);
    const highMean = highSeries.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3;
    const highStd = Math.sqrt(highSeries.slice(0, 3)
      .reduce((sum, value) => sum + (value - highMean) ** 2, 0) / 3);
    expect(stdevValues(stdev)[2]).not.toBeCloseTo(highStd, 6);
  });

  it('restores legacy STDEV Source metadata, period and color without schema migration', () => {
    const legacy = { ...stdev, source: 'high' as const };
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-b08',
      chartTabs: [{
        id: 'tab-b08',
        title: 'STDEV legacy workspace',
        instrument: null,
        timeframe: 'D',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 5 },
        indicators: [legacy],
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));
    expect(restored?.chartTabs[0].indicators[0]).toMatchObject(legacy);
    expect(restored?.chartTabs[0].timeframe).toBe('D');
    expect(restored?.chartTabs[0].indicators[0] && dialogHtml(restored.chartTabs[0].indicators[0]))
      .not.toMatch(/<span>Source<\/span>/);
  });

  it('preserves the all-null warmup output on histories shorter than the STDEV period', () => {
    expect(stdevValues(stdev, bars.slice(0, 2))).toEqual([null, null]);
  });
});

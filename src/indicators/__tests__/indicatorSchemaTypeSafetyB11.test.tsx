import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import type { OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

const stdev: OverlayIndicator = {
  id: 'stdev-b11', kind: 'STDEV', placement: 'pane', period: 20, color: '#123456',
};
const twap: OverlayIndicator = {
  id: 'twap-b11', kind: 'TWAP', placement: 'overlay', source: 'ohlc4', color: '#654321',
};
const stochRsi: OverlayIndicator = {
  id: 'stoch-b11', kind: 'STOCHRSI', placement: 'pane',
  rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3,
  color: '#111111', signalColor: '#222222',
};
const cpr: OverlayIndicator = {
  id: 'cpr-b11', kind: 'CPR', placement: 'overlay',
  pivotColor: '#333333', tcColor: '#444444', bcColor: '#555555',
};
const avwap: OverlayIndicator = {
  id: 'avwap-b11', kind: 'AVWAP', placement: 'overlay',
  color: '#666666', anchorIndex: 4,
};

function inputMarkup(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

describe('B11 typed indicator schema runtime preservation', () => {
  it('retains the B08 STDEV and B09 TWAP unsupported-field exclusions', () => {
    const stdevHtml = inputMarkup(stdev);
    expect(stdevHtml).toContain('<span>Period</span>');
    expect(stdevHtml).not.toContain('<span>Source</span>');
    const twapHtml = inputMarkup(twap);
    expect(twapHtml).toContain('<span>Source</span>');
    expect(twapHtml).not.toContain('<span>Period</span>');
    expect(stdevHtml).toContain('Save');
    expect(twapHtml).toContain('Save');
  });

  it('retains all four B10 STOCHRSI period controls', () => {
    const html = inputMarkup(stochRsi);
    for (const label of ['RSI Period', 'Stochastic Period', '%K Smoothing', '%D Smoothing']) {
      expect(html).toContain(`<span>${label}</span>`);
    }
    expect((html.match(/type="number"/g) ?? [])).toHaveLength(4);
  });

  it('retains CPR and AVWAP input presentation without adding unsupported controls', () => {
    for (const indicator of [cpr, avwap]) {
      const html = inputMarkup(indicator);
      expect(html).toContain('No editable inputs.');
      expect(html).toContain('Save');
    }
  });

  it('preserves legacy indicator fields and saved configuration values', () => {
    const studies = [
      { ...stdev, source: 'high' },
      { ...twap, period: 'legacy-ignored' },
      stochRsi,
      cpr,
      avwap,
    ];
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'b11-tab',
      chartTabs: [{
        id: 'b11-tab',
        title: 'B11 schema compatibility',
        instrument: null,
        timeframe: 'D',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 40 },
        indicators: studies,
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));
    expect(restored?.chartTabs[0].indicators).toMatchObject(studies);
    expect(restored?.chartTabs[0].indicators).toHaveLength(5);
    expect(restored?.chartTabs[0].indicators[4]).toMatchObject({ anchorIndex: 4, color: '#666666' });
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

// SSR cannot click a tab. Keep the production component intact and render the
// selected tab through the same React hook used by the real dialog.
let renderStyleTab = false;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const result = actual.useState(initial);
      if (initial === 'inputs' && renderStyleTab) {
        return ['style', result[1]] as unknown as typeof result;
      }
      return result;
    },
  };
});

const bars: OHLCBar[] = Array.from({ length: 90 }, (_, index) => {
  const close = 95 + Math.sin(index * 0.47) * 12 + Math.cos(index * 0.13) * 5 + index * 0.08;
  return {
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    timestamp: index + 1,
    open: close - 1,
    high: close + 3,
    low: close - 4,
    close,
    volume: 1000 + index * 11,
  };
});

const stochRsi: OverlayIndicator = {
  id: 'stochrsi-b10',
  kind: 'STOCHRSI',
  placement: 'pane',
  rsiPeriod: 14,
  stochPeriod: 14,
  kPeriod: 3,
  dPeriod: 3,
  color: '#00d2ff',
  signalColor: '#ff9f43',
};

const cpr: OverlayIndicator = {
  id: 'cpr-b10',
  kind: 'CPR',
  placement: 'overlay',
  pivotColor: '#00b4d8',
  tcColor: '#26a69a',
  bcColor: '#ef5350',
};

const avwap: OverlayIndicator = {
  id: 'avwap-b10',
  kind: 'AVWAP',
  placement: 'overlay',
  color: '#f9d423',
};

function dialog(indicator: OverlayIndicator, tab: 'inputs' | 'style' = 'inputs'): string {
  renderStyleTab = tab === 'style';
  try {
    return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
      indicator,
      onSave: () => undefined,
      onRemove: () => undefined,
      onClose: () => undefined,
    }));
  } finally {
    renderStyleTab = false;
  }
}

function rendered(indicator: OverlayIndicator) {
  const result = buildRenderableIndicators(bars, [indicator]);
  expect(result.diagnostics).toBeUndefined();
  return result;
}

afterEach(() => {
  renderStyleTab = false;
});

describe('B10: missing indicator settings schemas reflect supported builder fields', () => {
  it('exposes only the four effective STOCHRSI calculation periods on Inputs', () => {
    const html = dialog(stochRsi);
    for (const label of ['RSI Period', 'Stochastic Period', '%K Smoothing', '%D Smoothing']) {
      expect(html).toContain(`<span>${label}</span>`);
    }
    expect(html).not.toMatch(/<span>Source<\/span>/);
    expect(html).toContain('Save');
    expect((html.match(/type="number"/g) ?? [])).toHaveLength(4);
  });

  it('exposes only STOCHRSI %K and %D plot colors on Style', () => {
    const html = dialog(stochRsi, 'style');
    expect(html).toContain('<span>%K Color</span>');
    expect(html).toContain('<span>%D Color</span>');
    expect(html).toContain('aria-label="%K Color"');
    expect(html).toContain('aria-label="%D Color"');
  });

  it('exposes three CPR colors on Style without fabricating algorithm inputs', () => {
    expect(dialog(cpr)).toContain('No editable inputs.');
    const html = dialog(cpr, 'style');
    for (const label of ['Pivot Color', 'Top Central Color', 'Bottom Central Color']) {
      expect(html).toContain(`<span>${label}</span>`);
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect((html.match(/aria-label="(?:Pivot Color|Top Central Color|Bottom Central Color)"/g) ?? [])).toHaveLength(3);
  });

  it('exposes supported AVWAP line Color only, keeping anchor editing out of scope', () => {
    const inputs = dialog(avwap);
    expect(inputs).toContain('No editable inputs.');
    expect(inputs).not.toMatch(/<span>(?:Anchor Date|Anchor Index|Period|Source)<\/span>/);
    const style = dialog(avwap, 'style');
    expect(style).toContain('<span>Color</span>');
    expect(style).toContain('aria-label="Color"');
  });

  it('preserves existing unrelated EMA Period and Source settings', () => {
    const ema: OverlayIndicator = {
      id: 'ema-b10-control',
      kind: 'EMA',
      placement: 'overlay',
      period: 12,
      source: 'high',
      color: '#2962FF',
    };
    const html = dialog(ema);
    expect(html).toContain('<span>Period</span>');
    expect(html).toContain('<span>Source</span>');
  });

  it('keeps default STOCHRSI output stable when only its two colors change', () => {
    const original = rendered(stochRsi);
    const restyled = rendered({ ...stochRsi, color: '#112233', signalColor: '#334455' });
    expect(original.panes).toHaveLength(1);
    expect(restyled.panes).toHaveLength(1);
    expect(original.panes[0].lines.map((line) => line.color)).toEqual(['#00d2ff', '#ff9f43']);
    expect(restyled.panes[0].lines.map((line) => line.color)).toEqual(['#112233', '#334455']);
    expect(restyled.panes[0].lines.map((line) => line.values))
      .toEqual(original.panes[0].lines.map((line) => line.values));
  });

  it('confirms STOCHRSI periods are effective numerical inputs without changing the builder', () => {
    const original = rendered(stochRsi).panes[0].lines;
    const changed = rendered({
      ...stochRsi,
      rsiPeriod: 8,
      stochPeriod: 9,
      kPeriod: 2,
      dPeriod: 4,
    }).panes[0].lines;
    expect(original[0].values.some((value) => typeof value === 'number')).toBe(true);
    expect(changed[0].values.some((value) => typeof value === 'number')).toBe(true);
    expect(changed.map((line) => line.values)).not.toEqual(original.map((line) => line.values));
  });

  it('keeps CPR previous-completed-bar pivot math and allows all three colors', () => {
    const custom: OverlayIndicator = {
      ...cpr,
      pivotColor: '#111111',
      tcColor: '#222222',
      bcColor: '#333333',
    };
    const [pivot, top, bottom] = rendered(custom).overlays[0].lines;
    expect([pivot.color, top.color, bottom.color]).toEqual(['#111111', '#222222', '#333333']);
    expect([pivot.values[0], top.values[0], bottom.values[0]]).toEqual([null, null, null]);
    const prev = bars[0];
    const expectedPivot = (prev.high + prev.low + prev.close) / 3;
    const midpoint = (prev.high + prev.low) / 2;
    const opposite = 2 * expectedPivot - midpoint;
    expect(pivot.values[1]).toBeCloseTo(expectedPivot, 10);
    expect(top.values[1]).toBeCloseTo(Math.max(midpoint, opposite), 10);
    expect(bottom.values[1]).toBeCloseTo(Math.min(midpoint, opposite), 10);
  });

  it('preserves AVWAP default and historical anchor-index/date calculations and color', () => {
    const ordinary = rendered(avwap).overlays[0].lines[0];
    const styled = rendered({ ...avwap, color: '#abc123' }).overlays[0].lines[0];
    expect(styled.color).toBe('#abc123');
    expect(styled.values).toEqual(ordinary.values);
    expect(ordinary.values[0]).toBeCloseTo((bars[0].high + bars[0].low + bars[0].close) / 3, 10);
    const anchored = rendered({ ...avwap, anchorIndex: 5 }).overlays[0].lines[0];
    const dated = rendered({ ...avwap, anchorIndex: 1, anchorDate: bars[5].date }).overlays[0].lines[0];
    expect(anchored.values.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(anchored.values[5]).toBeCloseTo((bars[5].high + bars[5].low + bars[5].close) / 3, 10);
    expect(dated.values).toEqual(anchored.values);
  });

  it('restores supported custom values and existing AVWAP anchors from legacy saved chart', () => {
    const studies: OverlayIndicator[] = [
      { ...stochRsi, rsiPeriod: 7, stochPeriod: 10, kPeriod: 2, dPeriod: 5, color: '#112233', signalColor: '#445566' },
      { ...cpr, pivotColor: '#101010', tcColor: '#202020', bcColor: '#303030' },
      { ...avwap, anchorDate: bars[10].date, anchorIndex: 7, color: '#aabbcc' },
    ];
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-b10',
      chartTabs: [{
        id: 'tab-b10',
        title: 'Indicator schema preservation',
        instrument: null,
        timeframe: 'D',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: bars.length - 1 },
        indicators: studies,
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));
    expect(restored?.chartTabs[0].indicators).toMatchObject(studies);
    const entries = restored?.chartTabs[0].indicators ?? [];
    expect(entries).toHaveLength(3);
    expect(dialog(entries[0])).toContain('<span>RSI Period</span>');
    expect(dialog(entries[1], 'style')).toContain('<span>Pivot Color</span>');
    expect(dialog(entries[2], 'style')).toContain('<span>Color</span>');
    expect(rendered(entries[2]).overlays[0].lines[0].values.slice(0, 10)).toEqual(Array(10).fill(null));
  });
});

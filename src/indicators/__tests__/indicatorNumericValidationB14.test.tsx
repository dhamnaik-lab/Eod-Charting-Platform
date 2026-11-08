import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { getIndicatorNumericInputErrors, validateIndicatorNumericInput } from '@/indicators/indicatorNumericInputValidation';
import { buildRenderableIndicators } from '@/engine/Indicators';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';

const rsi: OverlayIndicator = {
  id: 'b14-rsi', kind: 'RSI', placement: 'pane', period: 14, color: '#235789', source: 'close',
};
const alma: OverlayIndicator = {
  id: 'b14-alma', kind: 'ALMA', placement: 'overlay', period: 9, sigma: 6, offset: 0.85, color: '#235789',
};
const lsma: OverlayIndicator = {
  id: 'b14-lsma', kind: 'LSMA', placement: 'overlay', period: 10, offset: -3, color: '#235789',
};

function markup(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator, onSave: () => undefined, onRemove: () => undefined, onClose: () => undefined,
  }));
}

const bars: OHLCBar[] = Array.from({ length: 70 }, (_, i) => {
  const close = 90 + i / 3 + Math.sin(i / 4) * 4;
  return {
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    timestamp: i + 1, open: close - 1, high: close + 2, low: close - 2, close, volume: 1000 + i,
  };
});

describe('B14: indicator-kind numeric input validation', () => {
  it('rejects empty, NaN, Infinity, non-numeric and fractional RSI periods, never coercing empty to zero', () => {
    const field = { key: 'period', label: 'Period', step: '1' };
    for (const value of ['', '  ', Number.NaN, Number.POSITIVE_INFINITY, 'bad', 0, -2, 14.5]) {
      expect(validateIndicatorNumericInput('RSI', field, value)).toBeTruthy();
    }
    expect(validateIndicatorNumericInput('RSI', field, 14)).toBeNull();
    expect(validateIndicatorNumericInput('RSI', field, '18')).toBeNull();
  });

  it('allows valid fractional ALMA offsets and positive sigmas without clamping them', () => {
    const offset = { key: 'offset', label: 'Offset', step: '0.05' };
    const sigma = { key: 'sigma', label: 'Sigma', step: '0.1' };
    for (const value of [0, 0.25, 0.85, 1]) {
      expect(validateIndicatorNumericInput('ALMA', offset, value)).toBeNull();
    }
    for (const value of [-0.01, 1.01, Number.NaN]) {
      expect(validateIndicatorNumericInput('ALMA', offset, value)).toBeTruthy();
    }
    expect(validateIndicatorNumericInput('ALMA', sigma, 0)).toContain('greater than zero');
    expect(validateIndicatorNumericInput('ALMA', sigma, 0.1)).toBeNull();
  });

  it('retains signed LSMA offsets and enforces a valid regression period', () => {
    const offset = { key: 'offset', label: 'Offset', step: '1' };
    const period = { key: 'period', label: 'Period', step: '1' };
    for (const value of [-12, -3, 0, 4]) {
      expect(validateIndicatorNumericInput('LSMA', offset, value)).toBeNull();
    }
    expect(validateIndicatorNumericInput('LSMA', offset, 0.75)).toContain('whole');
    expect(validateIndicatorNumericInput('LSMA', offset, undefined)).toBeNull();
    expect(validateIndicatorNumericInput('LSMA', period, 1)).toContain('at least 2');
    expect(validateIndicatorNumericInput('LSMA', period, 2)).toBeNull();
  });

  it('does not apply generic positive clamps to other legitimately signed numeric parameters', () => {
    const signed = { key: 'threshold', label: 'Threshold', step: '0.1' };
    expect(validateIndicatorNumericInput('RSI', signed, -20.5)).toBeNull();
    expect(validateIndicatorNumericInput('RSI', signed, 0)).toBeNull();
    expect(validateIndicatorNumericInput('SUPERTREND', { key: 'multiplier', label: 'Factor', min: 0.1, max: 20 }, 0)).toContain('at least');
  });

  it('detects invalid stored numbers without overwriting the original configuration', () => {
    const stored = { ...rsi, period: Number.NaN };
    const fields = [{ key: 'period', label: 'Period', step: '1' }];
    const before = stored.period;
    const errors = getIndicatorNumericInputErrors(stored, fields);
    expect(errors.period).toContain('finite');
    expect(Number.isNaN(stored.period)).toBe(true);
    expect(Number.isNaN(before)).toBe(true);
    expect(getIndicatorNumericInputErrors(rsi, fields, { period: '' }).period).toContain('Enter a number');
    expect(getIndicatorNumericInputErrors(rsi, fields, { period: '20' })).toEqual({});
  });

  it('shows a visible error and disables Save for invalid saved RSI periods', () => {
    const html = markup({ ...rsi, period: 0 });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Correct invalid numeric inputs before saving.');
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/disabled=""[^>]*>Save|disabled=""[^>]*>\s*Save/);
    expect(html).toContain('Enter a value of at least 1.');
    const valid = markup(rsi);
    expect(valid).not.toContain('Correct invalid numeric inputs before saving.');
    expect(valid).toContain('aria-invalid="false"');
  });

  it('permits fractional ALMA and signed LSMA values in settings without disabling Save', () => {
    const almaHtml = markup(alma);
    const lsmaHtml = markup(lsma);
    for (const html of [almaHtml, lsmaHtml]) {
      expect(html).not.toContain('Correct invalid numeric inputs before saving.');
      expect(html).toContain('Save</button>');
    }
    expect(almaHtml).toContain('value="0.85"');
    expect(lsmaHtml).toContain('value="-3"');
  });

  it('keeps valid calculation outputs identical and does not rewrite legacy saved fields', () => {
    const studies = [rsi, alma, lsma];
    const stored = JSON.stringify({
      version: 1, activeChartTabId: 'b14-tab',
      chartTabs: [{
        id: 'b14-tab', title: 'B14',
        instrument: null, timeframe: 'D', chartType: 'candles',
        renkoBrickSize: 10, viewport: { startIndex: 0, endIndex: 69 },
        indicators: studies, drawings: [], indicatorPaneHeight: 160,
        sheets: [], activeSheetId: null, layoutMode: 'single',
      }],
    });
    const restored = parsePersistedWorkspace(stored)?.chartTabs[0].indicators;
    expect(restored).toMatchObject(studies);
    const prior = buildRenderableIndicators(bars, studies);
    const after = buildRenderableIndicators(bars, restored ?? []);
    expect(after.panes.map(pane => pane.lines.map(line => line.values)))
      .toEqual(prior.panes.map(pane => pane.lines.map(line => line.values)));
    expect(after.overlays.map(overlay => overlay.lines.map(line => line.values)))
      .toEqual(prior.overlays.map(overlay => overlay.lines.map(line => line.values)));
  });
});

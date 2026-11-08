import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';
import { getCompactIndicatorDisplayLabel } from '@/indicators/catalog';

const bars: OHLCBar[] = [
  { open: 8, high: 14, low: 6, close: 10 },
  { open: 15, high: 21, low: 8, close: 12 },
  { open: 20, high: 27, low: 12, close: 18 },
  { open: 10, high: 19, low: 7, close: 13 },
  { open: 22, high: 30, low: 14, close: 24 },
].map((bar, index) => ({
  ...bar,
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  timestamp: index + 1,
  volume: 1000 + index,
}));

const twap: OverlayIndicator = {
  id: 'twap-b09',
  kind: 'TWAP',
  placement: 'overlay',
  source: 'ohlc4',
  color: '#DD7A28',
};

function dialogHtml(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

function twapValues(indicator: OverlayIndicator, data = bars): Array<number | null> {
  const rendered = buildRenderableIndicators(data, [indicator]);
  expect(rendered.diagnostics).toBeUndefined();
  expect(rendered.overlays).toHaveLength(1);
  return rendered.overlays[0].lines[0].values;
}

describe('B09: TWAP is cumulative and has no Period setting', () => {
  it('shows Source, hides unsupported Period, and retains Save for TWAP', () => {
    const html = dialogHtml(twap);
    expect(html).toContain('Time Weighted Average Price');
    expect(html).toMatch(/<span>Source<\/span>/);
    expect(html).not.toMatch(/<span>Period<\/span>/);
    expect(html).toContain('Save');

    const ema: OverlayIndicator = {
      id: 'ema-b09-control',
      kind: 'EMA',
      placement: 'overlay',
      period: 3,
      source: 'close',
      color: '#2962FF',
    };
    expect(dialogHtml(ema)).toMatch(/<span>Period<\/span>/);
    expect(dialogHtml(ema)).toMatch(/<span>Source<\/span>/);
  });

  it('matches an independent golden cumulative OHLC4 TWAP series from the first bar', () => {
    // OHLC4 inputs: 9.5, 14, 19.25, 12.25, 22.5.
    expect(twapValues(twap)).toEqual([9.5, 11.75, 14.25, 13.75, 15.5]);
  });

  it('continues to honor Source instead of ignoring the remaining control', () => {
    const high: OverlayIndicator = { ...twap, source: 'high' };
    const actual = twapValues(high);
    const expected = [14, 17.5, 62 / 3, 20.25, 22.2];
    for (let index = 0; index < expected.length; index += 1) {
      expect(actual[index]).toBeCloseTo(expected[index], 10);
    }
    expect(actual).not.toEqual(twapValues(twap));
  });

  it.each([0, -20, 10_000, 'broken', null])(
    'preserves inert legacy Period value %s without changing cumulative output',
    (period) => {
      // Period was never part of the supported TWAP type or builder.
      const legacy = { ...twap, period } as unknown as OverlayIndicator;
      expect(dialogHtml(legacy)).not.toMatch(/<span>Period<\/span>/);
      expect(twapValues(legacy)).toEqual(twapValues(twap));
      expect(getCompactIndicatorDisplayLabel(legacy)).toBe(getCompactIndicatorDisplayLabel(twap));
    },
  );

  it('preserves legacy Period and source fields on workspace restore without migration', () => {
    const legacy = { ...twap, source: 'low' as const, period: 'invalid-period' };
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-b09',
      chartTabs: [{
        id: 'tab-b09',
        title: 'TWAP legacy workspace',
        instrument: null,
        timeframe: 'W',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 4 },
        indicators: [legacy],
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));

    const recovered = restored?.chartTabs[0].indicators[0];
    expect(restored?.chartTabs[0].timeframe).toBe('W');
    expect(recovered).toMatchObject(legacy);
    expect(recovered && dialogHtml(recovered)).toMatch(/<span>Source<\/span>/);
    expect(recovered && dialogHtml(recovered)).not.toMatch(/<span>Period<\/span>/);
    expect(recovered && twapValues(recovered)).toEqual([6, 7, 26 / 3, 8.25, 9.4]);
  });

  it('keeps missing and unknown legacy sources on the existing Close fallback', () => {
    const missing = { ...twap, source: undefined };
    const unknown = { ...twap, source: 'not-a-source' } as unknown as OverlayIndicator;
    const expected = [10, 11, 40 / 3, 13.25, 15.4];
    for (const legacy of [missing, unknown]) {
      const actual = twapValues(legacy);
      for (let index = 0; index < expected.length; index += 1) {
        expect(actual[index]).toBeCloseTo(expected[index], 10);
      }
      expect(dialogHtml(legacy)).not.toMatch(/<span>Period<\/span>/);
    }
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { buildRenderableIndicators } from '@/engine/Indicators';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';
import { getCompactIndicatorDisplayLabel, getIndicatorDisplayLabel } from '@/indicators/catalog';

const ema: OverlayIndicator = {
  id: 'legacy-ema',
  kind: 'EMA',
  placement: 'overlay',
  period: 5,
  color: '#4287f5',
  source: 'close',
};

const bars: OHLCBar[] = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  timestamp: index + 1,
  open: 100 + index,
  high: 105 + index,
  low: 95 + index,
  close: 102 + index,
  volume: 1000 + index,
}));

describe('B01: indicator timeframe presentation is truthful', () => {
  it('hides unsupported per-indicator timeframe and generic offset controls but retains existing inputs', () => {
    const html = renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
      indicator: { ...ema, timeframe: 'W' },
      onSave: () => undefined,
      onRemove: () => undefined,
      onClose: () => undefined,
    }));

    expect(html).toContain('Period');
    expect(html).toContain('Offset (bars)'); // B02 is a separate correction.
    expect(html).toContain('Save');
    expect(html).not.toContain('Weekly (W)');
    expect(html).not.toContain('Same as Chart (Daily)');
    expect(html).not.toMatch(/<span>Timeframe<\/span>/);
  });

  it('does not falsely label legacy W/M/Q/Y metadata as computed indicator timeframes', () => {
    const ordinary = getIndicatorDisplayLabel(ema);
    const compact = getCompactIndicatorDisplayLabel(ema);

    for (const timeframe of ['W', 'M', 'Q', 'Y'] as const) {
      const legacy: OverlayIndicator = { ...ema, timeframe };
      expect(getIndicatorDisplayLabel(legacy)).toBe(ordinary);
      expect(getCompactIndicatorDisplayLabel(legacy)).toBe(compact);
    }
  });

  it('retains unrelated offset-label behavior while removing legacy timeframe tags', () => {
    const withOffset: OverlayIndicator = { ...ema, offset: 2 };
    const legacyWithOffset: OverlayIndicator = { ...withOffset, timeframe: 'M' };
    expect(getIndicatorDisplayLabel(legacyWithOffset)).toBe(getIndicatorDisplayLabel(withOffset));
  });

  it('computes the same EMA series from the chart bars regardless of legacy timeframe metadata', () => {
    const standard = buildRenderableIndicators(bars, [ema]);
    const legacy = buildRenderableIndicators(bars, [{ ...ema, timeframe: 'W' }]);

    expect(standard.overlays).toHaveLength(1);
    expect(legacy.overlays).toHaveLength(1);
    expect(legacy.overlays[0].lines[0].values).toEqual(standard.overlays[0].lines[0].values);
    expect(legacy.overlays[0].title).toBe(standard.overlays[0].title);
  });

  it('restores a legacy indicator timeframe without changing the chart timeframe or saved fields', () => {
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-1',
      chartTabs: [{
        id: 'tab-1',
        title: 'Legacy chart',
        instrument: null,
        timeframe: 'M',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 29 },
        indicators: [{ ...ema, timeframe: 'W' }],
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));

    expect(restored?.chartTabs[0].timeframe).toBe('M');
    expect(restored?.chartTabs[0].indicators[0]).toMatchObject({ ...ema, timeframe: 'W' });
  });
});

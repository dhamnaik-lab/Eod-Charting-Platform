import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';
import { getCompactIndicatorDisplayLabel, getIndicatorDisplayLabel } from '@/indicators/catalog';

const closeValues = [10, 12, 19, 21, 24, 30];
const bars: OHLCBar[] = closeValues.map((close, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  timestamp: index + 1,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1000,
}));

const ema: OverlayIndicator = {
  id: 'ema-b02',
  kind: 'EMA',
  placement: 'overlay',
  period: 3,
  color: '#2962ff',
  source: 'close',
};

const alma: OverlayIndicator = {
  id: 'alma-b02',
  kind: 'ALMA',
  placement: 'overlay',
  period: 3,
  sigma: 6,
  offset: 0.85,
  color: '#833ab4',
};

const lsma: OverlayIndicator = {
  id: 'lsma-b02',
  kind: 'LSMA',
  placement: 'overlay',
  period: 3,
  offset: 2,
  color: '#ff6d00',
  source: 'close',
};

function dialogHtml(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

function values(indicator: OverlayIndicator): Array<number | null> {
  const renderables = buildRenderableIndicators(bars, [indicator]);
  expect(renderables.overlays).toHaveLength(1);
  return renderables.overlays[0].lines[0].values;
}

describe('B02: algorithm offsets remain distinct from unsupported visual plot shifting', () => {
  it('hides the generic visual Offset control but keeps the ordinary EMA Inputs', () => {
    const html = dialogHtml({ ...ema, offset: 4 });
    expect(html).toContain('Period');
    expect(html).toContain('Save');
    expect(html).not.toContain('Offset (bars)');
    expect(html).not.toMatch(/<span>Offset<\/span>/);
  });

  it.each([alma, lsma])('retains exactly one algorithmic Offset input for $kind', (indicator) => {
    const html = dialogHtml(indicator);
    expect(html.match(/<span>Offset<\/span>/g)).toHaveLength(1);
    expect(html).not.toContain('Offset (bars)');
    expect(html).toContain('Period');
    expect(html).toContain('Save');
  });

  it('does not claim a generic offset shifts an EMA plot or its label', () => {
    const legacy: OverlayIndicator = { ...ema, offset: 4 };
    expect(values(legacy)).toEqual(values(ema));
    expect(getIndicatorDisplayLabel(legacy)).toBe(getIndicatorDisplayLabel(ema));
    expect(getCompactIndicatorDisplayLabel(legacy)).toBe(getCompactIndicatorDisplayLabel(ema));
  });

  it('preserves ALMA phase-weighted numerical values for different algorithmic offsets', () => {
    const early: OverlayIndicator = { ...alma, offset: 0.15 };
    const lateValues = values(alma);
    const earlyValues = values(early);

    expect(lateValues.slice(0, 2)).toEqual([null, null]);
    expect(earlyValues.slice(0, 2)).toEqual([null, null]);
    expect(lateValues[2]).toBeCloseTo(16.812439893482352, 10);
    expect(lateValues[5]).toBeCloseTo(28.121676416518284, 10);
    expect(earlyValues[2]).toBeCloseTo(10.641377491337998, 10);
    expect(earlyValues[5]).toBeCloseTo(21.95061401437393, 10);
    expect(getIndicatorDisplayLabel(alma)).toContain('(3, 6, 0.85)');
    expect(getIndicatorDisplayLabel(alma)).not.toContain('[');
  });

  it('preserves LSMA regression endpoint values at zero, positive and negative offsets', () => {
    const none: OverlayIndicator = { ...lsma, offset: 0 };
    const negative: OverlayIndicator = { ...lsma, offset: -1 };
    const normal = values(none);
    const positive = values(lsma);
    const backward = values(negative);

    expect(positive.slice(0, 2)).toEqual([null, null]);
    expect(normal[2]).toBeCloseTo(18.166666666666664, 10);
    expect(normal[5]).toBeCloseTo(29.5, 10);
    expect(positive[2]).toBeCloseTo(27.166666666666664, 10);
    expect(positive[5]).toBeCloseTo(38.5, 10);
    expect(backward[2]).toBeCloseTo(13.666666666666666, 10);
    expect(backward[5]).toBeCloseTo(25, 10);
    expect(getIndicatorDisplayLabel(lsma)).toContain('(3, 2)');
    expect(getIndicatorDisplayLabel(lsma)).not.toContain('[');
  });

  it('restores legacy generic and algorithm-specific offset fields without migration', () => {
    const saved: OverlayIndicator[] = [{ ...ema, offset: 4 }, alma, lsma];
    const restored = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-b02',
      chartTabs: [{
        id: 'tab-b02',
        title: 'Offset legacy workspace',
        instrument: null,
        timeframe: 'D',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 5 },
        indicators: saved,
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    }));
    expect(restored?.chartTabs[0].indicators).toMatchObject(saved);
    expect(restored?.chartTabs[0].timeframe).toBe('D');
  });
});

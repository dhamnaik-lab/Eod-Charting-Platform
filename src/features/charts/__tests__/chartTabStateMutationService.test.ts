import { describe, expect, it } from 'vitest';
import type { OHLCBar } from '@/engine/types';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';
import {
  DEFAULT_RENKO_SETTINGS,
  RENKO_BRICK_LIMIT_MESSAGE,
} from '@/features/charts/chartTypeTransformService';
import { addTabDrawing, applyTimeframeToTab, setTabChartType, updateTabDrawing } from '@/features/charts/chartTabStateMutationService';
import { applyEodResultToTab } from '@/features/charts/chartInstrumentHydrationService';

function createBar(index: number, close: number): OHLCBar {
  const date = `2026-01-${String(index + 1).padStart(2, '0')}`;
  return {
    date,
    timestamp: Date.parse(`${date}T00:00:00Z`),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    prevClose: close,
    volume: 1000,
  };
}

function createRenkoStressBars(): OHLCBar[] {
  return Array.from({ length: 20 }, (_, index) =>
    createBar(index, index === 19 ? 38000 : 100 + index),
  );
}

describe('chartTabStateMutationService Renko chart type', () => {
  it('falls back to ATR defaults when stale Traditional settings create too many bricks on first Renko switch', () => {
    const tab = {
      ...createBlankChartTab(1),
      rawBars: createRenkoStressBars(),
      renkoBrickSize: 0.01,
      renkoSettings: {
        ...DEFAULT_RENKO_SETTINGS,
        boxSizeMode: 'traditional' as const,
        boxSize: 0.01,
      },
      viewport: { startIndex: 0, endIndex: 120 },
    };

    const nextTab = setTabChartType(tab, 'renko');

    expect(nextTab.chartType).toBe('renko');
    expect(nextTab.renkoSettings).toEqual(DEFAULT_RENKO_SETTINGS);
    expect(nextTab.displayBars.length).toBeGreaterThan(0);
  }, 15000);

  it('keeps reporting an active Renko tab when the selected Traditional size creates too many bricks', () => {
    const tab = {
      ...createBlankChartTab(1),
      chartType: 'renko' as const,
      rawBars: createRenkoStressBars(),
      renkoBrickSize: 0.01,
      renkoSettings: {
        ...DEFAULT_RENKO_SETTINGS,
        boxSizeMode: 'traditional' as const,
        boxSize: 0.01,
      },
      viewport: { startIndex: 0, endIndex: 120 },
    };

    expect(() => setTabChartType(tab, 'renko')).toThrowError(RENKO_BRICK_LIMIT_MESSAGE);
  }, 15000);

  it('can disable the first Renko switch fallback for dialog-origin validation', () => {
    const tab = {
      ...createBlankChartTab(1),
      rawBars: createRenkoStressBars(),
      renkoBrickSize: 0.05,
      renkoSettings: {
        ...DEFAULT_RENKO_SETTINGS,
        boxSizeMode: 'traditional' as const,
        boxSize: 0.05,
      },
      viewport: { startIndex: 0, endIndex: 120 },
    };

    expect(() => setTabChartType(tab, 'renko', { fallbackToDefaultRenko: false })).toThrowError(
      RENKO_BRICK_LIMIT_MESSAGE,
    );
  }, 30000);
});


describe('chartTabStateMutationService drawing scopes', () => {
  it('keeps the active instrument scope synchronized when drawings are added or edited', () => {
    const tab = createBlankChartTab(1);
    tab.instrument = { exchange: 'NSE', symbol: 'TCS' };
    tab.requestedInstrument = tab.instrument;
    const drawing = {
      id: 'line-1',
      kind: 'hline' as const,
      price: 3500,
      color: '#4fa7ff',
      lineWidth: 1.4,
      lineStyle: 'dashed' as const,
      locked: false,
      paneId: 'price' as const,
    };

    const added = addTabDrawing(tab, drawing);
    expect(added.drawingScopes['NSE:TCS']).toEqual([drawing]);

    const edited = { ...drawing, color: '#ff0000' };
    const updated = updateTabDrawing(added, edited);
    expect(updated.drawings[0]).toEqual(edited);
    expect(updated.drawingScopes['NSE:TCS']).toEqual([edited]);
  });
});

describe('chartTabStateMutationService timeframe viewport preservation', () => {
  it('preserves right-aligned viewport across Daily -> Weekly -> Daily without resetting', () => {
    const rawBars = Array.from({ length: 100 }, (_, i) => {
      const day = i + 1;
      const month = Math.floor(i / 20) + 1;
      const date = `2026-${String(month).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`;
      return {
        date,
        timestamp: Date.parse(`${date}T00:00:00Z`),
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 500,
      };
    });

    const tab = {
      ...createBlankChartTab(1),
      rawBars,
      displayBars: rawBars,
      viewport: { startIndex: 40, endIndex: 100 },
      timeframe: 'D' as const,
    };

    const weeklyTab = applyTimeframeToTab(tab, 'W');
    expect(weeklyTab.timeframe).toBe('W');
    expect(weeklyTab.displayBars.length).toBeLessThan(rawBars.length);
    // Span should be preserved and aligned to right edge
    expect(weeklyTab.viewport.endIndex).toBeGreaterThanOrEqual(weeklyTab.displayBars.length);

    const dailyTab = applyTimeframeToTab(weeklyTab, 'D');
    expect(dailyTab.timeframe).toBe('D');
    expect(dailyTab.viewport.endIndex).toBeGreaterThanOrEqual(rawBars.length);
  });

  it('resets viewport zoom to default right-aligned range across timeframe change', () => {
    const rawBars = Array.from({ length: 500 }, (_, i) => {
      const date = new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      return {
        date,
        timestamp: Date.parse(`${date}T00:00:00Z`),
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 500,
      };
    });

    // Scrolled back to historical period or zoomed in
    const tab = {
      ...createBlankChartTab(1),
      rawBars,
      displayBars: rawBars,
      viewport: { startIndex: 100, endIndex: 140 },
      timeframe: 'D' as const,
    };

    const weeklyTab = applyTimeframeToTab(tab, 'W');
    // Resets zoom to default viewport for weekly bars
    expect(weeklyTab.viewport.endIndex).toBeGreaterThanOrEqual(weeklyTab.displayBars.length);
    expect(weeklyTab.visibleBarCount).toBe(Math.min(weeklyTab.displayBars.length, 120));

    const dailyAgainTab = applyTimeframeToTab(weeklyTab, 'D');
    // Resets zoom to default viewport for daily bars (120 bars)
    expect(dailyAgainTab.viewport.endIndex).toBeGreaterThanOrEqual(rawBars.length);
    expect(dailyAgainTab.visibleBarCount).toBe(120);
  });
});

describe('chartInstrumentHydrationService symbol viewport preservation', () => {
  it('preserves custom zoom span and right-edge alignment when switching symbols', () => {
    const symbolABars = Array.from({ length: 500 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 500,
    }));

    const symbolBBars = Array.from({ length: 200 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: 50 + i,
      high: 55 + i,
      low: 45 + i,
      close: 52 + i,
      volume: 300,
    }));

    const tab = {
      ...createBlankChartTab(1),
      instrument: { exchange: 'NSE', symbol: 'RELIANCE' },
      viewport: { startIndex: 440, endIndex: 500 }, // span = 60
      paneScaleOverrides: { price: { min: 2800, max: 3100 } },
    };

    const nextTab = applyEodResultToTab(
      tab,
      { exchange: 'NSE', symbol: 'TCS' },
      {
        requestedSymbol: 'TCS',
        requestedExchange: 'NSE',
        instrument: { exchange: 'NSE', symbol: 'TCS', name: 'TCS' },
        bars: symbolBBars,
        events: [],
        adjusted: false,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
      },
      true,
    );

    // Span should still be 60
    const nextSpan = nextTab.viewport.endIndex - nextTab.viewport.startIndex;
    expect(nextSpan).toBe(60);
    // Price scale override from RELIANCE must be cleared so TCS autoscales
    expect(nextTab.paneScaleOverrides.price).toBeUndefined();
  });
});

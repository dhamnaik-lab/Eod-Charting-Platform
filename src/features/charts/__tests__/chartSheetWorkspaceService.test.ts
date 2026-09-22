import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_VISUAL_SETTINGS, type ChartDrawing } from '@/engine/types';
import { DEFAULT_RENKO_SETTINGS } from '@/features/charts/chartTypeTransformService';
import {
  buildLoadSheetState,
  buildSaveCurrentAsSheetState,
  createChartTabStateFromPersistedContent,
  createPlainCandleSheetContent,
} from '@/features/charts/chartSheetWorkspaceService';
import type { PersistedChartContent } from '@/features/workspace/workspacePersistence';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';
import type { Sheet } from '@/store/chartStoreTypes';

function createPersistedContent(chartType: 'candles' | 'renko'): PersistedChartContent {
  return {
    id: `${chartType}-tab`,
    title: chartType,
    instrument: null,
    timeframe: 'D',
    chartType,
    renkoBrickSize: 15,
    visualSettings: {
      ...DEFAULT_CHART_VISUAL_SETTINGS,
      renkoProjectionUpColor: '#123456',
    },
    viewport: { startIndex: 0, endIndex: 120 },
    indicators: [],
    drawings: [],
    indicatorPaneHeight: 160,
  };
}

describe('chartSheetWorkspaceService Renko restoration', () => {
  it('keeps legacy brick size scoped to restored Renko sheet charts', () => {
    const candlesTab = createChartTabStateFromPersistedContent(createPersistedContent('candles'), 0);
    const renkoTab = createChartTabStateFromPersistedContent(createPersistedContent('renko'), 1);

    expect(candlesTab.renkoSettings).toEqual(DEFAULT_RENKO_SETTINGS);
    expect(renkoTab.renkoSettings).toMatchObject({
      boxSizeMode: 'traditional',
      boxSize: 15,
    });
    expect(renkoTab.visualSettings).toMatchObject({
      renkoProjectionUpColor: '#123456',
    });
  });
});


function scopedLine(id: string, price: number): ChartDrawing {
  return {
    id,
    kind: 'hline',
    price,
    color: '#4fa7ff',
    lineWidth: 1.4,
    lineStyle: 'dashed',
    locked: false,
    paneId: 'price',
  };
}

function sheetWithContent(id: string, name: string, content: PersistedChartContent): Sheet {
  return {
    id,
    name,
    createdAt: '2026-08-10T12:00:00.000Z',
    workspace: {
      version: 1,
      activeChartTabId: content.id,
      chartTabs: [content],
      layoutMode: 'single',
    },
  };
}

describe('chartSheetWorkspaceService drawing ownership', () => {
  it('commits the active sheet drawings before creating a new sheet', () => {
    const tab = createBlankChartTab(1);
    tab.id = 'tab-1';
    tab.instrument = { exchange: 'NSE', symbol: 'TCS' };
    tab.requestedInstrument = tab.instrument;
    tab.drawings = [scopedLine('sheet-1-tcs', 3500)];
    tab.drawingScopes = { 'NSE:TCS': tab.drawings };
    const existing = sheetWithContent('sheet-1', 'Sheet 1', createPlainCandleSheetContent(tab));
    tab.sheets = [existing];
    tab.activeSheetId = existing.id;

    const result = buildSaveCurrentAsSheetState([tab], tab.id, 'Sheet 2');
    expect(result).not.toBeNull();
    const nextTab = result!.chartTabs[0];
    expect(nextTab.activeSheetId).not.toBe('sheet-1');
    expect(nextTab.drawings).toEqual([]);

    const committedSheet1 = nextTab.sheets.find((sheet) => sheet.id === 'sheet-1');
    const committedContent = committedSheet1?.workspace.chartTabs[0];
    expect(committedContent?.drawings.map((drawing) => drawing.id)).toEqual(['sheet-1-tcs']);
    expect(committedContent?.drawingScopes?.['NSE:TCS'].map((drawing) => drawing.id)).toEqual(['sheet-1-tcs']);
  });

  it('restores a different drawing collection for the same symbol on each sheet', () => {
    const tab = createBlankChartTab(1);
    tab.id = 'tab-1';
    tab.instrument = { exchange: 'NSE', symbol: 'TCS' };
    tab.requestedInstrument = tab.instrument;

    const first = scopedLine('sheet-1-line', 3500);
    const second = scopedLine('sheet-2-line', 3600);
    const sheet1Content = {
      ...createPlainCandleSheetContent(tab),
      drawings: [first],
      drawingScopes: { 'NSE:TCS': [first] },
    };
    const sheet2Content = {
      ...createPlainCandleSheetContent(tab),
      drawings: [second],
      drawingScopes: { 'NSE:TCS': [second] },
    };
    const sheet1 = sheetWithContent('sheet-1', 'Sheet 1', sheet1Content);
    const sheet2 = sheetWithContent('sheet-2', 'Sheet 2', sheet2Content);
    tab.sheets = [sheet1, sheet2];
    tab.activeSheetId = sheet1.id;
    tab.drawings = [first];
    tab.drawingScopes = { 'NSE:TCS': [first] };

    const toSheet2 = buildLoadSheetState([tab], tab.id, sheet2.id);
    expect(toSheet2?.chartTabs[0].drawings.map((drawing) => drawing.id)).toEqual(['sheet-2-line']);

    const backToSheet1 = buildLoadSheetState(toSheet2!.chartTabs, tab.id, sheet1.id);
    expect(backToSheet1?.chartTabs[0].drawings.map((drawing) => drawing.id)).toEqual(['sheet-1-line']);
  });
});

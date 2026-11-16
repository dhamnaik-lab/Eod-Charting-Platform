import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_VISUAL_SETTINGS } from '@/engine/types';
import { DEFAULT_RENKO_SETTINGS } from '@/features/charts/chartTypeTransformService';
import { parsePersistedWorkspace, resolveWorkspaceLayoutMode, stringifyWorkspaceState } from '@/features/workspace/workspacePersistence';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';

function createPersistedWorkspace(chartType: 'candles' | 'renko'): string {
  return JSON.stringify({
    version: 1,
    activeChartTabId: 'tab-1',
    chartTabs: [{
      id: 'tab-1',
      title: 'BANKNIFTY',
      instrument: null,
      timeframe: 'D',
      chartType,
      renkoBrickSize: 10,
      viewport: { startIndex: 0, endIndex: 120 },
      indicators: [],
      drawings: [],
      indicatorPaneHeight: 160,
      sheets: [],
      activeSheetId: null,
      layoutMode: 'single',
    }],
  });
}

describe('workspacePersistence Renko migration', () => {
  it('uses safe default Renko settings for restored non-Renko tabs', () => {
    const workspace = parsePersistedWorkspace(createPersistedWorkspace('candles'));

    expect(workspace?.chartTabs[0].renkoSettings).toEqual(DEFAULT_RENKO_SETTINGS);
    expect(workspace?.chartTabs[0].visualSettings).toEqual(DEFAULT_CHART_VISUAL_SETTINGS);
  });

  it('preserves legacy fixed brick sizing for restored Renko tabs', () => {
    const workspace = parsePersistedWorkspace(createPersistedWorkspace('renko'));

    expect(workspace?.chartTabs[0].renkoSettings).toMatchObject({
      boxSizeMode: 'traditional',
      boxSize: 10,
    });
  });

  it('keeps chart type and Renko settings isolated per restored tab', () => {
    const workspace = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-2',
      chartTabs: [
        {
          id: 'tab-1',
          title: 'Candles',
          instrument: null,
          timeframe: 'D',
          chartType: 'candles',
          renkoBrickSize: 5,
          visualSettings: {
            ...DEFAULT_CHART_VISUAL_SETTINGS,
            renkoUpColor: '#00ff00',
          },
          viewport: { startIndex: 0, endIndex: 120 },
          indicators: [],
          drawings: [],
          indicatorPaneHeight: 160,
          sheets: [],
          activeSheetId: null,
          layoutMode: 'single',
        },
        {
          id: 'tab-2',
          title: 'Renko',
          instrument: null,
          timeframe: 'D',
          chartType: 'renko',
          renkoBrickSize: 50,
          renkoSettings: {
            ...DEFAULT_RENKO_SETTINGS,
            boxSizeMode: 'traditional',
            boxSize: 50,
            priceSource: 'high_low',
          },
          visualSettings: {
            ...DEFAULT_CHART_VISUAL_SETTINGS,
            backgroundColor: '#101010',
            renkoDownColor: '#ff00ff',
          },
          viewport: { startIndex: 0, endIndex: 120 },
          indicators: [],
          drawings: [],
          indicatorPaneHeight: 160,
          sheets: [],
          activeSheetId: null,
          layoutMode: 'single',
        },
      ],
    }));

    expect(workspace?.chartTabs[0]).toMatchObject({
      chartType: 'candles',
      renkoSettings: DEFAULT_RENKO_SETTINGS,
      visualSettings: {
        renkoUpColor: '#00ff00',
      },
    });
    expect(workspace?.chartTabs[1]).toMatchObject({
      chartType: 'renko',
      renkoSettings: {
        boxSizeMode: 'traditional',
        boxSize: 50,
        priceSource: 'high_low',
      },
      visualSettings: {
        backgroundColor: '#101010',
        renkoDownColor: '#ff00ff',
      },
    });
  });
});

describe('workspacePersistence drawing scopes', () => {
  const tcsLine = {
    id: 'tcs-line',
    kind: 'hline',
    price: 3500,
    color: '#4fa7ff',
    lineWidth: 1.4,
    lineStyle: 'dashed',
    locked: false,
    paneId: 'price',
  };
  const relianceLine = {
    ...tcsLine,
    id: 'reliance-line',
    price: 1400,
  };

  function baseChart() {
    return {
      id: 'tab-1',
      title: 'NSE:TCS',
      instrument: { exchange: 'NSE', symbol: 'TCS' },
      timeframe: 'D',
      chartType: 'candles',
      renkoBrickSize: 10,
      viewport: { startIndex: 0, endIndex: 120 },
      indicators: [],
      indicatorPaneHeight: 160,
      sheets: [],
      activeSheetId: null,
      layoutMode: 'single',
    };
  }

  it('preserves independent per-symbol drawing scopes when restoring a workspace', () => {
    const workspace = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-1',
      chartTabs: [{
        ...baseChart(),
        drawings: [tcsLine],
        drawingScopes: {
          'NSE:TCS': [tcsLine],
          'NSE:RELIANCE': [relianceLine],
        },
      }],
    }));

    expect(workspace?.chartTabs[0].drawingScopes?.['NSE:TCS'].map((drawing) => drawing.id)).toEqual(['tcs-line']);
    expect(workspace?.chartTabs[0].drawingScopes?.['NSE:RELIANCE'].map((drawing) => drawing.id)).toEqual(['reliance-line']);
  });

  it('migrates legacy active drawings into the active instrument scope without changing workspace version', () => {
    const workspace = parsePersistedWorkspace(JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-1',
      chartTabs: [{
        ...baseChart(),
        drawings: [tcsLine],
      }],
    }));

    expect(workspace?.version).toBe(1);
    expect(workspace?.chartTabs[0].drawingScopes?.['NSE:TCS'].map((drawing) => drawing.id)).toEqual(['tcs-line']);
  });
});


describe('workspace-level Auto-Tile migration', () => {
  it('restores legacy per-tab tile modes without altering stored chart settings', () => {
    const legacy = JSON.parse(createPersistedWorkspace('candles'));
    legacy.chartTabs[0].layoutMode = 'tile-grid';
    const restored = parsePersistedWorkspace(JSON.stringify(legacy));
    expect(resolveWorkspaceLayoutMode(restored)).toBe('tile');
    expect(restored?.chartTabs[0].layoutMode).toBe('tile-grid');
  });

  it('prefers workspace-level mode over conflicting per-tab modes', () => {
    const legacy = JSON.parse(createPersistedWorkspace('candles'));
    legacy.chartTabs[0].layoutMode = 'tile-v';
    legacy.layoutMode = 'single';
    const restored = parsePersistedWorkspace(JSON.stringify(legacy));
    expect(resolveWorkspaceLayoutMode(restored)).toBe('single');
    expect(restored?.chartTabs[0].layoutMode).toBe('tile-v');
  });

  it('serializes workspace layout without incrementing schema version', () => {
    const tab = createBlankChartTab(1);
    const persisted = JSON.parse(stringifyWorkspaceState({
      chartTabs: [tab],
      activeChartTabId: tab.id,
      workspaceLayoutMode: 'tile',
    }));
    expect(persisted.version).toBe(1);
    expect(persisted.layoutMode).toBe('tile');
    expect(resolveWorkspaceLayoutMode(parsePersistedWorkspace(JSON.stringify(persisted)))).toBe('tile');
  });
});

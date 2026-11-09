import { describe, expect, it, vi } from 'vitest';
import { loadNestedSourceFunction, loadSourceFunctions } from './scannerDrawingTestHarness';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/plugins/scanner/chartPatternScanners';
import { loadCompleteChartHistory, scannerHistoryMatchesChart } from '@/plugins/scanner/chartPatternScanService';
import { getLoadedScannerPriceBasis, resolveScannerOverlayPriceBasis, sameScannerPriceBasis } from '@/plugins/scanner/scannerChartPriceBasis';
import { buildScannerPatternMapEntries } from '@/plugins/scanner/scannerPatternMap';
import { buildScannerTimeframeBars } from '@/plugins/scanner/scannerChartTimeframe';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';
import type { EodBar } from '@/plugins/scanner/types';

const instrument = { exchange:'NSE', symbol:'ABC' };
const ranges = [
  ...Array.from({ length:4 }, () => [85,87,83,85]),
  [88,92,86,90],[90,96,88,94],[94,104,92,101],[101,110,99,106],
  [105,108,96,98],[98,103,92,95],[96,112,95,110],[110,124,108,120],
  [118,121,104,106],[106,111,94,96],[98,108,96,106],[106,112,102,108],
  [104,108,98,100],[100,104,96,98],[98,101,93,95],[94,98,89,91],
];
const rawBars = ranges.map(([open, high, low, close], i) => ({ date:`2028-06-${String(i+1).padStart(2,'0')}`,
  timestamp:Date.UTC(2028,5,i+1), open,high,low,close,volume:100000 }));
const toolbar = loadSourceFunctions('src/components/Toolbar.tsx', [
  'runActiveChartPatternScan', 'clusterNearbyMacroResults', 'selectBestChartPatternResult',
  'isDrawableBoundaryPattern', 'getChartPatternGeometryRank', 'getScannerChartLevels',
  'ACTIVE_CHART_PATTERN_MIN_BARS', 'ACTIVE_CHART_PATTERN_CONTEXT_BARS',
], { chartPatternScannerDefinitions, runChartPatternScanner });
const store = loadSourceFunctions('src/store/chartStore.ts', ['getActiveChartTab']);

function setup(afterRead?: (state: any) => void, timeframe: WorkspaceTimeframe = 'D', sourceBars = rawBars) {
  const activeTab = { id:'tab-A', instrument, rawBars:sourceBars, timeframe, loadedAdjusted:true,
    loadedDividendAdjusted:true, loadedRightsAdjusted:true };
  const state = { activeChartTabId:activeTab.id, chartTabs:[activeTab], snapshot:{ activeDatabasePath:'A' }, isDatabaseTransitioning:false };
  const showScannerChartOverlay = vi.fn(); const addToast = vi.fn();
  const getEodData = vi.fn(async () => {
    afterRead?.(state);
    return { instrument, bars:sourceBars, adjusted:true, includeDividendAdjustments:true, includeRightsAdjustments:true, events:[] };
  });
  const runActiveChartPatternScan = vi.fn((target: typeof instrument, bars: EodBar[]) => toolbar.runActiveChartPatternScan(target, bars));
  const handler = loadNestedSourceFunction('src/components/Toolbar.tsx', 'handleRunChartPatternScan', {
    activeTab, isChartPatternActive:false, getDesktopApi:() => ({ getEodData }),
    useChartStore:{ getState:() => state }, getActiveChartTab:store.getActiveChartTab,
    loadCompleteChartHistory, scannerHistoryMatchesChart, getLoadedScannerPriceBasis, sameScannerPriceBasis, buildScannerTimeframeBars,
    runActiveChartPatternScan, selectBestChartPatternResult:toolbar.selectBestChartPatternResult,
    chartPatternScannerDefinitions, buildScannerPatternMapEntries, getScannerChartLevels:toolbar.getScannerChartLevels,
    ACTIVE_CHART_PATTERN_CONTEXT_BARS:220, showScannerChartOverlay, addToast,
    clearScannerChartOverlay:vi.fn(), clearScannerPatternMap:vi.fn(), setChartPatternScanRunning:vi.fn(),
  });
  return { handler, getEodData, showScannerChartOverlay, addToast, state, runActiveChartPatternScan };
}

describe('one-click chart-pattern source routing', () => {
  it.each(['W','M','Q','Y'] as const)('detects from aggregated %s bars rather than daily or transformed display candles', async (timeframe) => {
    const source = ranges.flatMap(([open,high,low,close], i) => [0,1].map(day => {
      const timestamp = timeframe === 'W' ? Date.UTC(2028,0,3+i*7+day)
        : timeframe === 'M' ? Date.UTC(2028,i,1+day)
        : timeframe === 'Q' ? Date.UTC(2028,i*3,1+day) : Date.UTC(2028+i,0,1+day);
      return { date:new Date(timestamp).toISOString().slice(0,10), timestamp, open,high,low,close,volume:100000 };
    }));
    const test = setup(undefined, timeframe, source);
    await test.handler();
    expect(test.runActiveChartPatternScan).toHaveBeenCalledOnce();
    const input = test.runActiveChartPatternScan.mock.calls[0][1];
    expect(input).toHaveLength(20); expect(source).toHaveLength(40);
    expect(input[0].volume).toBe(200000);
    expect(test.showScannerChartOverlay).toHaveBeenCalledOnce();
    expect(test.showScannerChartOverlay.mock.calls[0][0].timeframe).toBe(timeframe);
  });
  it('runs the actual historical scanner and forwards loaded flags and source identity', async () => {
    const test = setup(); await test.handler();
    expect(test.getEodData).toHaveBeenCalledWith({ ...instrument, adjusted:true, includeDividendAdjustments:true, includeRightsAdjustments:true, databasePath:'A' });
    expect(test.showScannerChartOverlay).toHaveBeenCalledOnce();
    const overlay = test.showScannerChartOverlay.mock.calls[0][0];
    expect(overlay.geometry).toBeDefined(); expect(overlay.sourceBars).toBe(rawBars);
    expect(overlay.priceBasis).toEqual({ adjusted:true, includeDividendAdjustments:true, includeRightsAdjustments:true });
    expect(overlay.databasePath).toBe('A');
  });

  it.each(['tab','database','bars','timeframe','basis'])('discards stale async completion after %s changes', async (change) => {
    const test = setup(state => {
      if (change === 'tab') state.activeChartTabId = 'missing';
      if (change === 'database') state.snapshot = { activeDatabasePath:'B' };
      if (change === 'bars') state.chartTabs = [{ ...state.chartTabs[0], rawBars:[...rawBars] }];
      if (change === 'timeframe') state.chartTabs = [{ ...state.chartTabs[0], timeframe:'W' }];
      if (change === 'basis') state.chartTabs = [{ ...state.chartTabs[0], loadedAdjusted:false }];
    });
    await test.handler();
    expect(test.showScannerChartOverlay).not.toHaveBeenCalled();
    expect(test.addToast.mock.calls[0][0]).toContain('changed while loading');
  });

  it.each([true, false])('preserves row navigation and only shows geometry that still matches (match=%s)', async (matched) => {
    const definition = chartPatternScannerDefinitions.find(d => d.id === 'chart_head_shoulders')!;
    const result = runChartPatternScanner({ ...instrument, instrument, bars:rawBars.map(bar => ({ ...bar, symbol:'ABC' })) }, definition)!;
    expect(result?.matched).toBe(true);
    const displayBars = rawBars.map(bar => matched
      ? { ...bar, open:bar.open/2, high:bar.high/2, low:bar.low/2, close:bar.close/2 }
      : { ...bar, open:100, high:101, low:99, close:100 });
    const loadedTab = { id:'tab-A', instrument, rawBars:displayBars, displayBars, visibleBarCount:120,
      loadedAdjusted:true, loadedDividendAdjusted:true, loadedRightsAdjusted:true };
    const showScannerChartOverlay = vi.fn(); const clearScannerChartOverlay = vi.fn();
    const loadInstrument = vi.fn().mockResolvedValue(undefined); const scrollToViewportStart = vi.fn(); const setStatus = vi.fn();
    const row = loadSourceFunctions('src/components/ScannerWindow.tsx', ['getScannerChartLevels', 'findBarIndexOnOrAfter']);
    const handler = loadNestedSourceFunction('src/components/ScannerWindow.tsx', 'handleShowOnChart', {
      scannerPatternMap:null, selectScannerPatternMapEntry:vi.fn(), loadInstrument, scrollToViewportStart, setStatus,
      useChartStore:{ getState:() => ({ chartTabs:[loadedTab], activeChartTabId:loadedTab.id, snapshot:{ activeDatabasePath:'A' } }) },
      useUiStore:{ getState:() => ({ clearScannerChartOverlay }) }, getActiveChartTab:store.getActiveChartTab,
      getLoadedScannerPriceBasis, resolveScannerOverlayPriceBasis, getScannerChartLevels:row.getScannerChartLevels,
      findBarIndexOnOrAfter:row.findBarIndexOnOrAfter,
      showScannerChartOverlay, addToast:vi.fn(),
    });
    await handler(result);
    expect(loadInstrument).toHaveBeenCalledWith(instrument, null, { preserveViewport:false });
    expect(scrollToViewportStart).toHaveBeenCalledOnce();
    if (matched) {
      expect(showScannerChartOverlay).toHaveBeenCalledOnce();
      expect(showScannerChartOverlay.mock.calls[0][0].geometry.pivotMarkers.map((p: { price:number }) => p.price)).toEqual([55,46,62,47,56]);
    } else {
      expect(showScannerChartOverlay).not.toHaveBeenCalled(); expect(clearScannerChartOverlay).toHaveBeenCalledOnce();
      expect(setStatus.mock.calls.at(-1)?.[0]).toContain('cannot be drawn');
    }
  });

  it('honors custom toolbar chart pattern selection stored in localStorage', () => {
    const storage = new Map<string, string>();
    const customToolbar = loadSourceFunctions(
      'src/components/Toolbar.tsx',
      ['runActiveChartPatternScan', 'clusterNearbyMacroResults', 'ACTIVE_CHART_PATTERN_MIN_BARS', 'ACTIVE_CHART_PATTERN_CONTEXT_BARS'],
      {
        chartPatternScannerDefinitions,
        runChartPatternScanner,
        window: {
          localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
          },
        },
      },
    );
    const barsWithSymbol = rawBars.map((b) => ({ ...b, symbol: 'ABC' }));
    expect(customToolbar.runActiveChartPatternScan(instrument, barsWithSymbol).some((r: any) => r.scannerId === 'chart_head_shoulders')).toBe(true);

    storage.set('eod-chart.toolbar-chart-patterns.ids.v1', JSON.stringify(['chart_double_bottom']));
    expect(customToolbar.runActiveChartPatternScan(instrument, barsWithSymbol)).toEqual([]);

    storage.set('eod-chart.toolbar-chart-patterns.ids.v1', JSON.stringify(['chart_head_shoulders']));
    expect(customToolbar.runActiveChartPatternScan(instrument, barsWithSymbol).map((r: any) => r.scannerId)).toEqual(['chart_head_shoulders']);
  });
});

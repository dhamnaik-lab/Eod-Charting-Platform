import { describe, expect, it, vi } from 'vitest';
import { createBlankChartTab } from '../chartTabWorkspaceService';
import { createChartTabSessionController } from '../chartTabSessionController';
import type { ChartStoreState, LayoutMode } from '@/store/chartStoreTypes';

function createHarness() {
  const first = { ...createBlankChartTab(1), id: 'first', layoutMode: 'tile-grid' as LayoutMode };
  const second = { ...createBlankChartTab(2), id: 'second', layoutMode: 'single' as LayoutMode };
  const third = { ...createBlankChartTab(3), id: 'third', layoutMode: 'tile-v' as LayoutMode };
  let state = {
    chartTabs: [first, second, third],
    activeChartTabId: 'first',
    workspaceLayoutMode: 'tile',
    maximizedChartTabId: null,
    adjustedMode: false,
    includeDividendAdjustments: false,
    includeRightsAdjustments: false,
  } as ChartStoreState;
  const resetChartInteractionUi = vi.fn();
  const hydrateChartTabData = vi.fn(async (_tabId: string) => undefined);
  const session = createChartTabSessionController({
    getState: () => state,
    setState: (update) => {
      state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
    },
    resetChartInteractionUi,
    hydrateChartTabData,
  });
  return { session, getState: () => state, resetChartInteractionUi, hydrateChartTabData };
}

describe('F-52 workspace Auto-Tile activation', () => {
  it.each<LayoutMode>(['tile', 'tile-h', 'tile-v', 'tile-grid'])(
    'normalizes %s to workspace Auto-Tile and preserves it across tab activation',
    (mode) => {
      const h = createHarness();
      h.session.setLayoutMode(mode);
      h.session.activateChartTab('second');
      expect(h.getState().workspaceLayoutMode).toBe('tile');
      expect(h.getState().activeChartTabId).toBe('second');
      expect(h.getState().chartTabs[1].layoutMode).toBe('single');
      expect(h.resetChartInteractionUi).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves legacy per-tab modes on ordinary tab selection', () => {
    const h = createHarness();
    h.session.activateChartTab('second');
    expect(h.getState().workspaceLayoutMode).toBe('tile');
    expect(h.getState().chartTabs.map((tab) => tab.layoutMode)).toEqual(['tile-grid', 'single', 'tile-v']);
  });

  it('does not maximize on tile-header activation', () => {
    const h = createHarness();
    h.session.activateChartTab('second');
    h.session.activateChartTab('second');
    expect(h.getState().maximizedChartTabId).toBeNull();
    expect(h.getState().workspaceLayoutMode).toBe('tile');
  });

  it('maximizes only on explicit command and restores the tiled workspace', () => {
    const h = createHarness();
    h.session.toggleChartMaximize('second');
    expect(h.getState().maximizedChartTabId).toBe('second');
    expect(h.getState().activeChartTabId).toBe('second');
    h.session.toggleChartMaximize('second');
    expect(h.getState().maximizedChartTabId).toBeNull();
    expect(h.getState().workspaceLayoutMode).toBe('tile');
  });

  it('returns to tiles when another chart tab is selected during maximize', () => {
    const h = createHarness();
    h.session.toggleChartMaximize('first');
    h.session.activateChartTab('third');
    expect(h.getState().maximizedChartTabId).toBeNull();
    expect(h.getState().workspaceLayoutMode).toBe('tile');
  });

  it('new chart tabs preserve workspace Auto-Tile', () => {
    const h = createHarness();
    h.session.createChartTab();
    expect(h.getState().chartTabs).toHaveLength(4);
    expect(h.getState().workspaceLayoutMode).toBe('tile');
    expect(h.getState().maximizedChartTabId).toBeNull();
  });

  it('does not change state for an unknown tab', () => {
    const h = createHarness();
    const before = h.getState();
    h.session.activateChartTab('missing');
    h.session.toggleChartMaximize('missing');
    expect(h.getState()).toBe(before);
    expect(h.resetChartInteractionUi).not.toHaveBeenCalled();
  });

  it('keeps instrument hydration on tile activation', () => {
    const h = createHarness();
    const second = h.getState().chartTabs[1];
    h.getState().chartTabs[1] = {
      ...second,
      instrument: { symbol: 'NIFTY', exchange: 'NSE_INDEX' },
      requestedInstrument: { symbol: 'NIFTY', exchange: 'NSE_INDEX' },
    };
    h.session.activateChartTab('second');
    expect(h.hydrateChartTabData).toHaveBeenCalledExactlyOnceWith('second');
    expect(h.getState().workspaceLayoutMode).toBe('tile');
  });
});

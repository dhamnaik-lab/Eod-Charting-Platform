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
    adjustedMode: false,
    includeDividendAdjustments: false,
    includeRightsAdjustments: false,
  } as ChartStoreState;

  const resetChartInteractionUi = vi.fn();
  const hydrateChartTabData = vi.fn(async (_tabId: string) => undefined);
  const session = createChartTabSessionController({
    getState: () => state,
    setState: (update) => {
      state = {
        ...state,
        ...(typeof update === 'function' ? update(state) : update),
      };
    },
    resetChartInteractionUi,
    hydrateChartTabData,
  });

  return { session, getState: () => state, resetChartInteractionUi, hydrateChartTabData };
}

describe('F-52 tiled workspace activation', () => {
  it.each<LayoutMode>(['tile', 'tile-h', 'tile-v', 'tile-grid'])(
    'retains %s when an inactive tile becomes active',
    (mode) => {
      const h = createHarness();
      h.session.setLayoutMode(mode);
      h.session.activateChartTab('second', mode);

      expect(h.getState().activeChartTabId).toBe('second');
      expect(h.getState().chartTabs.find((tab) => tab.id === 'second')?.layoutMode).toBe(mode);
      expect(h.getState().chartTabs.find((tab) => tab.id === 'first')?.layoutMode).toBe(mode);
      expect(h.getState().chartTabs.find((tab) => tab.id === 'third')?.layoutMode).toBe('tile-v');
      expect(h.resetChartInteractionUi).toHaveBeenCalledTimes(1);
    },
  );

  it('leaves ordinary chart-tab activation and saved per-tab modes unchanged', () => {
    const h = createHarness();
    h.session.activateChartTab('second');

    expect(h.getState().activeChartTabId).toBe('second');
    expect(h.getState().chartTabs.map((tab) => tab.layoutMode)).toEqual([
      'tile-grid', 'single', 'tile-v',
    ]);
  });

  it('retains the transferred layout after the tile header activates the same tab again', () => {
    const h = createHarness();
    h.session.activateChartTab('second', 'tile-grid');
    h.session.activateChartTab('second');

    expect(h.getState().activeChartTabId).toBe('second');
    expect(h.getState().chartTabs.find((tab) => tab.id === 'second')?.layoutMode).toBe('tile-grid');
  });

  it('does not change state or reset interaction UI for an unknown tab', () => {
    const h = createHarness();
    const before = h.getState();
    h.session.activateChartTab('missing', 'tile-grid');

    expect(h.getState()).toBe(before);
    expect(h.resetChartInteractionUi).not.toHaveBeenCalled();
    expect(h.hydrateChartTabData).not.toHaveBeenCalled();
  });

  it('keeps existing instrument hydration on tile activation', () => {
    const h = createHarness();
    const second = h.getState().chartTabs[1];
    h.getState().chartTabs[1] = {
      ...second,
      instrument: { symbol: 'NIFTY', exchange: 'NSE_INDEX' },
      requestedInstrument: { symbol: 'NIFTY', exchange: 'NSE_INDEX' },
    };

    h.session.activateChartTab('second', 'tile-grid');

    expect(h.hydrateChartTabData).toHaveBeenCalledExactlyOnceWith('second');
    expect(h.getState().chartTabs[1].layoutMode).toBe('tile-grid');
  });
});

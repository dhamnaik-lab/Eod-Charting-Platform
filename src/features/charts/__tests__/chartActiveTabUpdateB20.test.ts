import { describe, expect, it, vi } from 'vitest';
import { updateActiveTab } from '@/features/charts/chartActiveTabUpdateService';
import {
  selectTabDrawing, setTabHoverBar, setTabShowVolume, syncTabViewport,
} from '@/features/charts/chartTabStateMutationService';
import type { ChartTabState } from '@/store/chartStoreTypes';

function tab(id: string): ChartTabState {
  return {
    id,
    timeframe: 'D',
    chartType: 'candles',
    showVolume: true,
    hoverBar: null,
    selectedDrawingId: null,
    indicators: [],
    drawings: [],
    viewport: { startIndex: 0, endIndex: 10 },
    visibleBarCount: 10,
  } as unknown as ChartTabState;
}

describe('B20: single evaluation of active chart-tab state mutations', () => {
  it('updates the originating tile without changing the active tile', () => {
    const original = [tab('active'), tab('tile')];
    const state = { chartTabs: original, activeChartTabId: 'active' };
    const next = updateActiveTab(state, (value) => setTabShowVolume(value, false), 'tile');
    expect(next.chartTabs[0]).toBe(original[0]);
    expect(next.chartTabs[1].showVolume).toBe(false);
    expect(state.activeChartTabId).toBe('active');
  });

  it('does not call the updater when the active ID is missing', () => {
    const original = [tab('one'), tab('two')];
    const updater = vi.fn((value: ChartTabState) => ({ ...value, showVolume: false }));
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'missing' }, updater);
    expect(updater).not.toHaveBeenCalled();
    expect(next.chartTabs).toBe(original);
  });

  it('keeps exact tab-array and tab identities when the updater returns the input', () => {
    const original = [tab('one'), tab('two')];
    const updater = vi.fn((value: ChartTabState) => value);
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'one' }, updater);
    expect(updater).toHaveBeenCalledExactlyOnceWith(original[0]);
    expect(next.chartTabs).toBe(original);
    expect(next.chartTabs[0]).toBe(original[0]);
    expect(next.chartTabs[1]).toBe(original[1]);
  });

  it('calls the changed active-tab updater exactly once and preserves siblings', () => {
    const original = [tab('one'), tab('two'), tab('three')];
    const updater = vi.fn((value: ChartTabState) => ({ ...value, showVolume: false }));
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'two' }, updater);
    expect(updater).toHaveBeenCalledExactlyOnceWith(original[1]);
    expect(next.chartTabs).not.toBe(original);
    expect(next.chartTabs[0]).toBe(original[0]);
    expect(next.chartTabs[2]).toBe(original[2]);
    expect(next.chartTabs[1].showVolume).toBe(false);
    expect(original[1].showVolume).toBe(true);
  });

  it('continues to apply all legacy duplicate active IDs, once each', () => {
    const original = [tab('one'), tab('two'), tab('one')];
    const updater = vi.fn((value: ChartTabState) => ({ ...value, showVolume: false }));
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'one' }, updater);
    expect(updater).toHaveBeenCalledTimes(2);
    expect(updater).toHaveBeenNthCalledWith(1, original[0]);
    expect(updater).toHaveBeenNthCalledWith(2, original[2]);
    expect(next.chartTabs[0].showVolume).toBe(false);
    expect(next.chartTabs[2].showVolume).toBe(false);
    expect(next.chartTabs[1]).toBe(original[1]);
  });

  it('keeps array identity when all matching legacy IDs return unchanged', () => {
    const original = [tab('one'), tab('two'), tab('one')];
    const updater = vi.fn((value: ChartTabState) => value);
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'one' }, updater);
    expect(updater).toHaveBeenCalledTimes(2);
    expect(next.chartTabs).toBe(original);
  });

  it('preserves real chart action output while calculating only once', () => {
    const original = [tab('one'), tab('two')];
    const updater = vi.fn((value: ChartTabState) => setTabShowVolume(value, false));
    const next = updateActiveTab({ chartTabs: original, activeChartTabId: 'one' }, updater);
    expect(updater).toHaveBeenCalledOnce();
    expect(next.chartTabs[0]).toEqual(setTabShowVolume(original[0], false));
    expect(next.chartTabs[1]).toBe(original[1]);
    expect(original[0].showVolume).toBe(true);
  });

  it('preserves viewport, drawing selection and no-op hover identity', () => {
    const a = tab('one');
    const original = [a, tab('two')];
    const noHover = updateActiveTab({
      chartTabs: original, activeChartTabId: 'one',
    }, (value) => setTabHoverBar(value, null));
    expect(noHover.chartTabs).toBe(original);

    const viewport = { startIndex: 3, endIndex: 17 };
    const nextViewport = updateActiveTab({
      chartTabs: original, activeChartTabId: 'one',
    }, (value) => syncTabViewport(value, viewport));
    expect(nextViewport.chartTabs[0].viewport).toBe(viewport);
    expect(nextViewport.chartTabs[0].visibleBarCount).toBe(14);
    expect(nextViewport.chartTabs[1]).toBe(original[1]);

    const selected = updateActiveTab({
      chartTabs: nextViewport.chartTabs, activeChartTabId: 'one',
    }, (value) => selectTabDrawing(value, 'drawing-1'));
    expect(selected.chartTabs[0].selectedDrawingId).toBe('drawing-1');
    expect(selected.chartTabs[0].viewport).toBe(viewport);
    expect(selected.chartTabs[0].indicators).toBe(a.indicators);
    expect(selected.chartTabs[0].drawings).toBe(a.drawings);
  });

  it('does not partially mutate the original tab array when the updater throws', () => {
    const original = [tab('one'), tab('two'), tab('one')];
    const updater = vi.fn((value: ChartTabState) => {
      if (value === original[2]) throw new Error('expected failure');
      return { ...value, showVolume: false };
    });
    expect(() => updateActiveTab({ chartTabs: original, activeChartTabId: 'one' }, updater))
      .toThrow('expected failure');
    expect(original[0].showVolume).toBe(true);
    expect(original[2].showVolume).toBe(true);
    expect(updater).toHaveBeenCalledTimes(2);
  });
});

import { expect, it } from 'vitest';
import { useChartStore } from '@/store/chartStore';
import type { ChartTabState } from '@/store/chartStoreTypes';
import type { OHLCBar } from '@/engine/types';
import { useChartHoverStore } from '../chartHoverStore';

it('keeps 1000 tile hover updates out of persistent workspace subscribers', () => {
  const original = useChartStore.getState();
  const tabs = ['active', 'background'].map(id => ({
    id, displayBars: [], hoverBar: null,
  } as unknown as ChartTabState));
  useChartStore.setState({ chartTabs: tabs, activeChartTabId: 'active' });
  let persistentUpdates = 0;
  const unsubscribe = useChartStore.subscribe((next, previous) => {
    if (next.chartTabs !== previous.chartTabs) persistentUpdates++;
  });
  const started = performance.now();
  try {
    for (let i = 0; i < 1000; i++) {
      useChartStore.getState().setHoverBar({ date: `bar-${i}`, close: i } as OHLCBar, 'background');
    }
    console.info(JSON.stringify({ hoverUpdates: 1000, persistentUpdates, elapsedMs: performance.now() - started }));
    expect(persistentUpdates).toBe(0);
    expect(useChartStore.getState().chartTabs).toBe(tabs);
    expect(useChartStore.getState().activeChartTabId).toBe('active');
    expect(useChartHoverStore.getState().byTab.background.bar?.close).toBe(999);
    expect(useChartHoverStore.getState().byTab.active).toBeUndefined();
    useChartStore.setState({ chartTabs: [{ ...tabs[1], displayBars: [] }] });
    expect(useChartHoverStore.getState().byTab.background).toBeUndefined();
  } finally {
    unsubscribe();
    useChartStore.setState(original);
  }
});

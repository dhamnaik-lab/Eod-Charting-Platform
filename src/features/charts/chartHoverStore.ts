import { create } from 'zustand';
import type { OHLCBar } from '@/engine/types';
import type { ChartTabState } from '@/store/chartStoreTypes';

interface HoverEntry { bars: OHLCBar[]; bar: OHLCBar | null }
export const useChartHoverStore = create<{ byTab: Record<string, HoverEntry> }>(() => ({ byTab: {} }));

export function setChartHover(tab: ChartTabState, bar: OHLCBar | null): void {
  const previous = useChartHoverStore.getState().byTab[tab.id];
  if (previous?.bars === tab.displayBars && previous.bar === bar) return;
  useChartHoverStore.setState(state => ({ byTab: { ...state.byTab, [tab.id]: { bars: tab.displayBars, bar } } }));
}

export function retainChartHover(tabs: ChartTabState[]): void {
  const entries = useChartHoverStore.getState().byTab;
  const byTab = Object.fromEntries(Object.entries(entries).filter(([id, entry]) =>
    tabs.some(tab => tab.id === id && tab.displayBars === entry.bars)));
  if (Object.keys(byTab).length !== Object.keys(entries).length) useChartHoverStore.setState({ byTab });
}

export function useChartHover(tab: ChartTabState | null): OHLCBar | null {
  return useChartHoverStore(state => {
    const entry = tab ? state.byTab[tab.id] : undefined;
    return entry && entry.bars === tab?.displayBars ? entry.bar : null;
  });
}

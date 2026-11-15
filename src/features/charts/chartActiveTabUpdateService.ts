import type { ChartStoreState, ChartTabState } from '@/store/chartStoreTypes';

/**
 * Apply each matching tab transformation once, preserving the original
 * tab-array reference when no tab changes. Copy only on the first real change.
 */
export function updateActiveTab(
  state: Pick<ChartStoreState, 'chartTabs' | 'activeChartTabId'>,
  updater: (tab: ChartTabState) => ChartTabState,
  tabId: string | null = state.activeChartTabId,
): Pick<ChartStoreState, 'chartTabs'> {
  const { chartTabs } = state;
  let updatedTabs: ChartTabState[] | null = null;

  for (let index = 0; index < chartTabs.length; index += 1) {
    const tab = chartTabs[index];
    if (tab.id !== tabId) {
      continue;
    }

    const nextTab = updater(tab);
    if (nextTab === tab) {
      continue;
    }

    if (!updatedTabs) {
      updatedTabs = chartTabs.slice();
    }
    updatedTabs[index] = nextTab;
  }

  return { chartTabs: updatedTabs ?? chartTabs };
}

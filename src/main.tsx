import React from 'react';
import ReactDOM from 'react-dom/client';
import RootApp from './RootApp';
import './styles/theme-tokens.generated.css';
import './styles/global.css';
import { useChartStore } from '@/store/chartStore';

if (typeof window !== 'undefined') {
  window.__EOD_CHART_TEST__ = {
    createChartTab: () => {
      useChartStore.getState().createChartTab();
    },
    activateChartTab: (tabId) => {
      useChartStore.getState().activateChartTab(tabId);
    },
    loadInstrument: async ({ symbol, exchange, meta }) => {
      await useChartStore.getState().loadInstrument({ symbol, exchange }, meta ?? null);
    },
    getState: () => {
      const state = useChartStore.getState();
      return {
        activeChartTabId: state.activeChartTabId,
        chartTabs: state.chartTabs.map((tab) => ({
          id: tab.id,
          title: tab.title,
          instrument: tab.instrument,
          timeframe: tab.timeframe,
          displayBarCount: tab.displayBars.length,
          rawBarCount: tab.rawBars.length,
        })),
        snapshot: state.snapshot,
      };
    },
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);

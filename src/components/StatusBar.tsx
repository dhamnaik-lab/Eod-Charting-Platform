import { useEffect, useState } from 'react';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';

export function StatusBar() {
  const snapshot = useChartStore((state) => state.snapshot);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const isDatabaseTransitioning = useChartStore((state) => state.isDatabaseTransitioning);
  const databaseTransitionMessage = useChartStore((state) => state.databaseTransitionMessage);
  const importProgress = useChartStore((state) => state.importProgress);
  const downloadProgress = useChartStore((state) => state.downloadProgress);
  const [clock, setClock] = useState(() => new Date());
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={statusBarStyle}>
      <span>
        {isDatabaseTransitioning
          ? (databaseTransitionMessage ?? 'Opening DB...')
          : snapshot?.dbStats?.dbName ?? (snapshot?.activeDatabasePath ? 'Loading DB...' : 'No DB')}
      </span>
      <span>
        Range {snapshot?.dbStats?.dateFrom ?? '-'} - {snapshot?.dbStats?.dateTo ?? '-'}
      </span>
      {importProgress.running ? <span>Import {importProgress.progress}% {importProgress.message}</span> : null}
      {downloadProgress.running ? <span>Download {downloadProgress.progress}%</span> : null}
      {downloadProgress.error ? <span style={{ color: 'var(--red)' }}>Download Error: {downloadProgress.error}</span> : null}
      <span style={{ marginLeft: 'auto' }}>
        {activeTab?.instrument ? `${activeTab.instrument.exchange}:${activeTab.instrument.symbol}` : 'No Symbol'} | {activeTab?.visibleBarCount ?? 0} bars
      </span>
      <span>{clock.toLocaleTimeString('en-IN', { hour12: false })}</span>
    </div>
  );
}

const statusBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 20,
  padding: '0 8px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 9,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

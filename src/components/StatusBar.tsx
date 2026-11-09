import { useEffect, useState } from 'react';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { countVisibleBars } from '@/engine/ScaleManager';

export function StatusBar() {
  const snapshot = useChartStore((state) => state.snapshot);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const isDatabaseTransitioning = useChartStore((state) => state.isDatabaseTransitioning);
  const databaseTransitionMessage = useChartStore((state) => state.databaseTransitionMessage);
  const importProgress = useChartStore((state) => state.importProgress);
  const downloadProgress = useChartStore((state) => state.downloadProgress);
  const workspaceAutosaveError = useChartStore((state) => state.workspaceAutosaveError);
  const [clock, setClock] = useState(() => new Date());
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const visibleBarCount = activeTab ? countVisibleBars(activeTab.viewport, activeTab.displayBars.length) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dbName = isDatabaseTransitioning
    ? (databaseTransitionMessage ?? 'Opening DB...')
    : snapshot?.dbStats?.dbName ?? (snapshot?.activeDatabasePath ? 'Loading DB...' : 'No DB');

  const dbStatusColor = isDatabaseTransitioning
    ? '#f59e0b'
    : snapshot?.dbStats?.dbName
      ? 'var(--green)'
      : 'var(--text-mute)';

  return (
    <div style={statusBarStyle}>
      <span style={badgeStyle}>
        <span style={{ ...dotStyle, background: dbStatusColor }} />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{dbName}</span>
      </span>

      <span style={badgeStyle}>
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>Range</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: 10.5 }}>
          {snapshot?.dbStats?.dateFrom ?? '-'} – {snapshot?.dbStats?.dateTo ?? '-'}
        </span>
      </span>

      {importProgress.running ? (
        <span style={progressBadgeStyle}>
          Import {importProgress.progress}% {importProgress.message}
        </span>
      ) : null}

      {downloadProgress.running ? (
        <span style={progressBadgeStyle}>
          Download {downloadProgress.progress}%
        </span>
      ) : null}

      {downloadProgress.error ? (
        <span style={errorBadgeStyle}>
          Download Error: {downloadProgress.error}
        </span>
      ) : null}

      {workspaceAutosaveError ? (
        <span style={errorBadgeStyle} role="status" title={workspaceAutosaveError}>
          Workspace save failed — retrying
        </span>
      ) : null}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {activeTab?.instrument ? (
          <span style={badgeStyle}>
            <span style={exchangeTagStyle}>{activeTab.instrument.exchange}</span>
            <span style={{ fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {activeTab.instrument.symbol}
            </span>
          </span>
        ) : (
          <span style={badgeStyle}>
            <span style={{ color: 'var(--text-dim)' }}>No Symbol</span>
          </span>
        )}

        <span style={badgeStyle}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {visibleBarCount}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{visibleBarCount === 1 ? 'bar' : 'bars'}</span>
        </span>

        <span style={badgeStyle}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {clock.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })}
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--text-mute)', fontWeight: 600 }}>IST</span>
        </span>
      </div>
    </div>
  );
}

const statusBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 8px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 11,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '1px 6px',
  borderRadius: 3,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  lineHeight: '18px',
};

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
};

const exchangeTagStyle: React.CSSProperties = {
  padding: '0 3px',
  borderRadius: 2,
  background: 'var(--accent-soft)',
  color: 'var(--accent-text)',
  fontSize: 9.5,
  fontWeight: 700,
  lineHeight: '14px',
};

const progressBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent-faint)',
  color: 'var(--accent-text)',
  fontSize: 10.5,
};

const errorBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  borderColor: 'var(--red)',
  background: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--red-text)',
  fontSize: 10.5,
};

import { format } from 'date-fns';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useChartHover } from '@/features/charts/chartHoverStore';

export function OhlcvBar() {
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const hoverBar = useChartHover(activeTab);
  const latestBar = activeTab?.displayBars[activeTab.displayBars.length - 1] ?? null;
  const bar = hoverBar ?? latestBar;

  return (
    <div style={ohlcvBarStyle}>
      {bar ? (
        <>
          <span style={{ color: 'var(--text)' }}>{format(new Date(bar.timestamp), 'yyyy-MM-dd')}</span>
          <span>{activeTab?.instrumentMeta?.name ?? activeTab?.instrument?.symbol ?? 'Symbol'}</span>
          <span>O {bar.open.toFixed(2)}</span>
          <span>H {bar.high.toFixed(2)}</span>
          <span>L {bar.low.toFixed(2)}</span>
          <span>C {bar.close.toFixed(2)}</span>
          <span style={{ color: bar.close >= (bar.prevClose ?? bar.open) ? 'var(--green)' : 'var(--red)' }}>
            {((bar.close - (bar.prevClose ?? bar.open)) / Math.max(bar.prevClose ?? bar.open, 1) * 100).toFixed(2)}%
          </span>
          <span>Vol {formatIndianVolume(bar.volume)}</span>
        </>
      ) : (
        <span>No OHLCV data available.</span>
      )}
    </div>
  );
}

const ohlcvBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 22,
  padding: '0 10px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 10,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

function formatIndianVolume(volume: number): string {
  if (volume >= 10000000) return `${(volume / 10000000).toFixed(2)} Cr`;
  if (volume >= 100000) return `${(volume / 100000).toFixed(2)} L`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}

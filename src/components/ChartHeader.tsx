import { getActiveChartTab, useChartStore } from '@/store/chartStore';

const TIMEFRAMES: { value: 'D' | 'W' | 'M' | 'Q' | 'Y'; label: string }[] = [
  { value: 'D', label: 'D' },
  { value: 'W', label: 'W' },
  { value: 'M', label: 'M' },
  { value: 'Q', label: 'Q' },
  { value: 'Y', label: 'Y' },
];

interface ChartHeaderProps {
  inline?: boolean;
}

export function ChartHeader({ inline = false }: ChartHeaderProps) {
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const setTimeframe = useChartStore((state) => state.setTimeframe);

  return (
    <div style={inline ? inlineHeaderStyle : headerStyle}>
      <div style={timeframeGroupStyle}>
        <span style={groupCaptionStyle}>Timeframe</span>
        <div style={timeframeSectionStyle}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              style={tfButtonStyle((activeTab?.timeframe ?? 'D') === tf.value)}
              onClick={() => setTimeframe(tf.value)}
              title={`Switch to ${tf.label}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  minHeight: 34,
  padding: '6px 8px 3px',
  color: 'var(--text)',
  background: 'transparent',
};

const inlineHeaderStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minWidth: 0,
};

const timeframeGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 30,
  padding: '4px 8px 4px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  borderRadius: 'var(--panel-radius)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

const groupCaptionStyle: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--text-dim)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  whiteSpace: 'nowrap',
};

const timeframeSectionStyle: React.CSSProperties = {
  display: 'flex',
  gap: 3,
  padding: '2px',
  borderRadius: 'var(--control-radius)',
  background: 'var(--control-bg)',
  border: '1px solid var(--border)',
  flexShrink: 0,
};

const tfButtonStyle = (active: boolean): React.CSSProperties => ({
  minWidth: 28,
  height: 22,
  border: active ? '1px solid var(--accent)' : '1px solid transparent',
  borderRadius: 'var(--control-radius)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  background: active ? 'var(--control-bg-active)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  padding: '0 8px',
  lineHeight: '20px',
  textAlign: 'center',
  boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
});

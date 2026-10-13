import { getActiveChartTab, useChartStore } from '@/store/chartStore';

const TIMEFRAMES: { value: 'D' | 'W' | 'M' | 'Q' | 'Y'; label: string; tooltip: string }[] = [
  { value: 'D', label: 'D', tooltip: 'Daily' },
  { value: 'W', label: 'W', tooltip: 'Weekly' },
  { value: 'M', label: 'M', tooltip: 'Monthly' },
  { value: 'Q', label: 'Q', tooltip: 'Quarterly' },
  { value: 'Y', label: 'Y', tooltip: 'Yearly' },
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
      <div style={inline ? inlineTimeframeGroupStyle : timeframeGroupStyle}>
        <div style={timeframeSectionStyle}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              style={tfButtonStyle((activeTab?.timeframe ?? 'D') === tf.value)}
              onClick={() => setTimeframe(tf.value)}
              title={tf.tooltip}
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
  justifyContent: 'flex-start',
  minWidth: 0,
};

const timeframeGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 30,
  padding: '4px 6px',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  borderRadius: 'var(--panel-radius)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

const inlineTimeframeGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const timeframeSectionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: '1px',
  borderRadius: 'var(--control-radius)',
  background: 'var(--control-bg)',
  border: '1px solid var(--border)',
  flexShrink: 0,
};

const tfButtonStyle = (active: boolean): React.CSSProperties => ({
  minWidth: 26,
  height: 24,
  border: active ? '1px solid var(--accent)' : '1px solid transparent',
  borderRadius: 'calc(var(--control-radius) - 1px)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  background: active ? 'var(--control-bg-active)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  padding: '0 6px',
  lineHeight: '22px',
  textAlign: 'center',
  boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
});

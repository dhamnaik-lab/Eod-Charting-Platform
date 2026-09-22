import type { ChartTabState } from '@/store/chartStoreTypes';
import { useChartStore } from '@/store/chartStore';

type Tf = 'D' | 'W' | 'M' | 'Q' | 'Y';
const TF_ORDER: Tf[] = ['D', 'W', 'M', 'Q', 'Y'];

interface TileHeaderProps {
  tab: ChartTabState;
}

export function TileHeader({ tab }: TileHeaderProps) {
  const setTimeframe = useChartStore((state) => state.setTimeframe);
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const hoverBar = tab.hoverBar ?? null;
  const latestBar = tab.displayBars[tab.displayBars.length - 1] ?? null;
  const bar = hoverBar ?? latestBar;
  const symbol = tab.instrument?.symbol ?? '---';
  const exchange = tab.instrument?.exchange ?? '--';
  const referenceClose = bar?.prevClose ?? bar?.open ?? null;
  const priceLabel = bar ? bar.close.toFixed(2) : '--';
  const change = bar && referenceClose !== null ? bar.close - referenceClose : null;
  const changePct =
    change !== null && referenceClose !== null && referenceClose !== 0 ? (change / referenceClose) * 100 : null;
  const isUp = (change ?? 0) >= 0;

  return (
    <div style={tileHeaderStyle} onClick={() => activateChartTab(tab.id)}>
      <div style={{ ...tileGroupStyle, ...tileIdentityGroupStyle }}>
        <span style={tileSymbolStyle}>{symbol}</span>
        <span style={tileBadgeStyle}>{exchange}</span>
      </div>

      <div style={{ ...tileGroupStyle, ...tilePriceGroupStyle }}>
        <span style={tilePriceStyle}>{priceLabel}</span>
        <span style={tileChangeStyle(isUp)}>
          {change === null ? '--' : `${formatSigned(change)} (${formatSigned(changePct ?? 0)}%)`}
        </span>
      </div>

      <div style={{ ...tileGroupStyle, ...tileTfGroupStyle }}>
        {TF_ORDER.map((tf) => (
          <button
            key={tf}
            type="button"
            style={tileTfBtnStyle(tab.timeframe === tf)}
            onClick={(event) => {
              event.stopPropagation();
              activateChartTab(tab.id);
              setTimeframe(tf);
            }}
            title={`Switch to ${tf}`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}

const tileHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 6px',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  minHeight: 31,
  cursor: 'pointer',
};

const tileGroupStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 22,
  padding: '0 7px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--control-bg)',
};

const tileIdentityGroupStyle: React.CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
};

const tileSymbolStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const tileBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 16,
  padding: '0 5px',
  borderRadius: 999,
  background: 'var(--accent-soft)',
  color: 'var(--text)',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const tilePriceGroupStyle: React.CSSProperties = {
  flex: '0 0 auto',
};

const tilePriceStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 10.5,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const tileChangeStyle = (up: boolean): React.CSSProperties => ({
  color: up ? 'var(--green)' : 'var(--red)',
  fontSize: 9,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const tileTfGroupStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '2px',
  gap: 2,
};

const tileTfBtnStyle = (active: boolean): React.CSSProperties => ({
  minWidth: 20,
  height: 18,
  border: active ? '1px solid var(--accent)' : '1px solid transparent',
  borderRadius: 4,
  fontSize: 9.5,
  fontWeight: 800,
  cursor: 'pointer',
  background: active ? 'var(--accent-soft)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-mute)',
  padding: '0 4px',
  lineHeight: '16px',
});

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(2)}`;
  }
  return value.toFixed(2);
}

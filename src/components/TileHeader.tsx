import type { ChartTabState } from '@/store/chartStoreTypes';
import { useChartStore } from '@/store/chartStore';
import { useChartHover } from '@/features/charts/chartHoverStore';

interface TileHeaderProps {
  tab: ChartTabState;
  isActive?: boolean;
  isMaximized?: boolean;
}

export function TileHeader({ tab, isActive = false, isMaximized = false }: TileHeaderProps) {
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const toggleChartMaximize = useChartStore((state) => state.toggleChartMaximize);
  const closeChartTab = useChartStore((state) => state.closeChartTab);
  const hoverBar = useChartHover(tab);
  const latestBar = tab.displayBars[tab.displayBars.length - 1] ?? null;
  const bar = hoverBar ?? latestBar;
  const symbol = tab.instrument?.symbol ?? '---';
  const exchange = tab.instrument?.exchange ?? '--';
  const missingIndexReference = exchange === 'NSE_INDEX'
    && (bar?.prevClose == null || !Number.isFinite(bar.prevClose) || bar.prevClose <= 0);
  const referenceClose = missingIndexReference ? null : bar?.prevClose ?? bar?.open ?? null;
  const priceLabel = bar ? bar.close.toFixed(2) : '--';
  const change = bar && referenceClose !== null ? bar.close - referenceClose : null;
  const changePct =
    change !== null && referenceClose !== null && referenceClose !== 0 ? (change / referenceClose) * 100 : null;
  const isUp = (change ?? 0) >= 0;

  return (
    <div style={tileHeaderStyle(isActive)} onClick={() => activateChartTab(tab.id)}>
      <div style={{ ...tileGroupStyle, ...tileIdentityGroupStyle }}>
        {isActive ? <span style={activeDotStyle} title="Active Chart" /> : null}
        <span style={tileSymbolStyle}>{symbol}</span>
        <span style={tileBadgeStyle}>{exchange}</span>
      </div>

      <div style={{ ...tileGroupStyle, ...tilePriceGroupStyle }}>
        <span style={tilePriceStyle}>{priceLabel}</span>
        <span style={change === null ? { ...tileChangeStyle(isUp), color: 'var(--text-dim)' } : tileChangeStyle(isUp)}>
          {change === null ? (bar && missingIndexReference ? 'Change unavailable' : '--') : `${formatSigned(change)} (${formatSigned(changePct ?? 0)}%)`}
        </span>
      </div>
      <button type="button" data-tile-control="maximize" style={tileControlStyle}
        title={isMaximized ? 'Restore tiled charts' : 'Maximize chart'}
        aria-label={isMaximized ? `Restore ${symbol} chart` : `Maximize ${symbol} chart`}
        onClick={(event) => { event.stopPropagation(); toggleChartMaximize(tab.id); }}>
        {isMaximized ? '❐' : '□'}
      </button>
      <button type="button" data-tile-control="close" style={tileControlStyle}
        title="Close chart tab" aria-label={`Close ${symbol} chart`}
        onClick={(event) => { event.stopPropagation(); closeChartTab(tab.id); }}>
        ×
      </button>
    </div>
  );
}

function tileHeaderStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    background: isActive ? 'var(--control-bg)' : 'var(--bg2)',
    borderBottom: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
    minHeight: 28,
    cursor: 'pointer',
  };
}

const activeDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--accent)',
  flexShrink: 0,
  display: 'inline-block',
};

const tileControlStyle: React.CSSProperties = {
  flex: '0 0 auto',
  height: 22,
  minWidth: 23,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
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

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(2)}`;
  }
  return value.toFixed(2);
}

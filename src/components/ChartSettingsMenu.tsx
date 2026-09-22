import { useEffect, useRef, type CSSProperties } from 'react';
import type { ChartValueLabelSettings, FutureMarginMode } from '@/engine/types';
import { useUiStore } from '@/store/uiStore';

interface ChartSettingsMenuProps {
  placement?: 'toolbar' | 'axis';
  side?: 'left' | 'right';
  direction?: 'down' | 'up';
  maxHeight?: number;
  width?: number;
  priceAutoFit: boolean;
  allPanesAutoFit: boolean;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  logScale: boolean;
  invertPriceScale: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis: boolean;
  volumeProfileEnabled?: boolean;
  onSetVolumeProfileEnabled?: (enabled: boolean) => void;
  futureMarginMode: FutureMarginMode;
  onAutoFitPriceScale: () => void;
  onFitAllPanes: () => void;
  onSetIncludeDividendAdjustments: (enabled: boolean) => void;
  onSetIncludeRightsAdjustments: (enabled: boolean) => void;
  onSetLogScale: (enabled: boolean) => void;
  onSetInvertPriceScale: (enabled: boolean) => void;
  onSetShowValueLabels: (show: boolean) => void;
  onSetValueLabelSettings: (settings: Partial<ChartValueLabelSettings>) => void;
  onSetShowLeftAxis: (show: boolean) => void;
  onSetFutureMarginMode: (mode: FutureMarginMode) => void;
  onClose: () => void;
}

export function resolveChartSettingsMenuWidth(axisWidth: number, chartWidth: number): number {
  const preferredWidth = Math.min(384, Math.max(240, Math.round(axisWidth * 4)));
  const availableWidth = Math.max(180, Math.floor(chartWidth - 12));
  return Math.min(preferredWidth, availableWidth);
}

function MenuToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      style={menuToggleRowStyle}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span style={menuToggleTrackStyle(checked)}>
        <span style={menuToggleThumbStyle(checked)} />
      </span>
    </button>
  );
}

export function ChartSettingsMenu({
  placement = 'toolbar',
  side = 'right',
  direction = 'down',
  maxHeight,
  width,
  priceAutoFit,
  allPanesAutoFit,
  adjustedMode,
  includeDividendAdjustments,
  includeRightsAdjustments,
  logScale,
  invertPriceScale,
  valueLabelSettings,
  showLeftAxis,
  volumeProfileEnabled = false,
  onSetVolumeProfileEnabled,
  futureMarginMode,
  onAutoFitPriceScale,
  onFitAllPanes,
  onSetIncludeDividendAdjustments,
  onSetIncludeRightsAdjustments,
  onSetLogScale,
  onSetInvertPriceScale,
  onSetShowValueLabels,
  onSetValueLabelSettings,
  onSetShowLeftAxis,
  onSetFutureMarginMode,
  onClose,
}: ChartSettingsMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const crosshairSyncEnabled = useUiStore((state) => state.crosshairSyncEnabled);
  const toggleCrosshairSync = useUiStore((state) => state.toggleCrosshairSync);
  const symbolLinkEnabled = useUiStore((state) => state.symbolLinkEnabled);
  const toggleSymbolLink = useUiStore((state) => state.toggleSymbolLink);
  const allValueLabelsEnabled =
    valueLabelSettings.showSymbolNameLabel &&
    valueLabelSettings.showSymbolLastPrice &&
    valueLabelSettings.showSymbolPreviousClose &&
    valueLabelSettings.showHighLowPriceLabels &&
    valueLabelSettings.showIndicatorNameLabels &&
    valueLabelSettings.showOverlayIndicatorValues &&
    valueLabelSettings.showCompareValues &&
    valueLabelSettings.showIndicatorPaneValues;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={panelRef} style={menuStyle(placement, side, direction, maxHeight, width)} onMouseDown={(event) => event.stopPropagation()}>
      <div style={menuHeaderStyle}>
        <div style={menuTitleStyle}>Scale Settings</div>
        <div style={menuSubtitleStyle}>Price scale, labels, panes, and future space</div>
      </div>

      <button type="button" style={menuActionStyle(priceAutoFit)} onClick={onAutoFitPriceScale}>
        <span>Auto fit price pane</span>
        <span style={menuActionStateStyle}>{priceAutoFit ? 'On' : 'Reset'}</span>
      </button>
      <button type="button" style={menuActionStyle(allPanesAutoFit)} onClick={onFitAllPanes}>
        <span>Fit all panes</span>
        <span style={menuActionStateStyle}>{allPanesAutoFit ? 'On' : 'Reset'}</span>
      </button>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Corporate Action Adjustments</div>
        <div style={menuSectionHintStyle}>These toggles affect Adjusted mode only.</div>
        <div style={menuRowStyle(adjustedMode)}>
          <span>Price mode</span>
          <span style={radioPillStyle(adjustedMode)}>{adjustedMode ? 'Adjusted' : 'Raw'}</span>
        </div>
        <MenuToggle
          label="Include dividend adjustments"
          checked={includeDividendAdjustments}
          onChange={onSetIncludeDividendAdjustments}
        />
        <MenuToggle
          label="Include rights adjustments"
          checked={includeRightsAdjustments}
          onChange={onSetIncludeRightsAdjustments}
        />
      </div>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Scale Mode</div>
        <button type="button" style={menuRowStyle(!logScale)} onClick={() => onSetLogScale(false)}>
          <span>Regular</span>
          <span style={radioPillStyle(!logScale)}>Active</span>
        </button>
        <button type="button" style={menuRowStyle(logScale)} onClick={() => onSetLogScale(true)}>
          <span>Logarithmic</span>
          <span style={radioPillStyle(logScale)}>Active</span>
        </button>
        <MenuToggle label="Invert scale" checked={invertPriceScale} onChange={onSetInvertPriceScale} />
        {onSetVolumeProfileEnabled && (
          <MenuToggle label="Volume Profile (FRVP)" checked={volumeProfileEnabled} onChange={onSetVolumeProfileEnabled} />
        )}
      </div>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Labels</div>
        <MenuToggle label="All scale labels" checked={allValueLabelsEnabled} onChange={onSetShowValueLabels} />
        <MenuToggle
          label="Symbol name label"
          checked={valueLabelSettings.showSymbolNameLabel}
          onChange={(showSymbolNameLabel) => onSetValueLabelSettings({ showSymbolNameLabel })}
        />
        <MenuToggle
          label="Symbol last price label"
          checked={valueLabelSettings.showSymbolLastPrice}
          onChange={(showSymbolLastPrice) => onSetValueLabelSettings({ showSymbolLastPrice })}
        />
        <MenuToggle
          label="Previous close label"
          checked={valueLabelSettings.showSymbolPreviousClose}
          onChange={(showSymbolPreviousClose) => onSetValueLabelSettings({ showSymbolPreviousClose })}
        />
        <MenuToggle
          label="High and low price labels"
          checked={valueLabelSettings.showHighLowPriceLabels}
          onChange={(showHighLowPriceLabels) => onSetValueLabelSettings({ showHighLowPriceLabels })}
        />
        <MenuToggle
          label="Indicator name labels"
          checked={valueLabelSettings.showIndicatorNameLabels}
          onChange={(showIndicatorNameLabels) => onSetValueLabelSettings({ showIndicatorNameLabels })}
        />
        <MenuToggle
          label="Overlay indicator value labels"
          checked={valueLabelSettings.showOverlayIndicatorValues}
          onChange={(showOverlayIndicatorValues) => onSetValueLabelSettings({ showOverlayIndicatorValues })}
        />
        <MenuToggle
          label="Compare value labels"
          checked={valueLabelSettings.showCompareValues}
          onChange={(showCompareValues) => onSetValueLabelSettings({ showCompareValues })}
        />
        <MenuToggle
          label="Indicator pane value labels"
          checked={valueLabelSettings.showIndicatorPaneValues}
          onChange={(showIndicatorPaneValues) => onSetValueLabelSettings({ showIndicatorPaneValues })}
        />
        <MenuToggle
          label="No overlapping labels"
          checked={valueLabelSettings.noOverlappingLabels}
          onChange={(noOverlappingLabels) => onSetValueLabelSettings({ noOverlappingLabels })}
        />
      </div>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Panes</div>
        <MenuToggle label="Show left-axis price scale" checked={showLeftAxis} onChange={onSetShowLeftAxis} />
      </div>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Future Bar Space</div>
        <button type="button" style={menuRowStyle(futureMarginMode === 'tight')} onClick={() => onSetFutureMarginMode('tight')}>
          <span>Tight</span>
          <span style={menuHintStyle}>4 bars</span>
        </button>
        <button type="button" style={menuRowStyle(futureMarginMode === 'normal')} onClick={() => onSetFutureMarginMode('normal')}>
          <span>Normal</span>
          <span style={menuHintStyle}>8 bars</span>
        </button>
        <button type="button" style={menuRowStyle(futureMarginMode === 'wide')} onClick={() => onSetFutureMarginMode('wide')}>
          <span>Wide</span>
          <span style={menuHintStyle}>12 bars</span>
        </button>
      </div>

      <div style={menuSectionStyle}>
        <div style={menuSectionTitleStyle}>Multi-Chart Grid & Sync</div>
        <MenuToggle label="Sync crosshairs across charts" checked={crosshairSyncEnabled} onChange={toggleCrosshairSync} />
        <MenuToggle label="Link symbol across grid" checked={symbolLinkEnabled} onChange={toggleSymbolLink} />
      </div>
    </div>
  );
}

const menuStyle = (
  placement: 'toolbar' | 'axis',
  side: 'left' | 'right' = 'right',
  direction: 'down' | 'up' = 'down',
  maxHeight?: number,
  width = 336,
): CSSProperties => ({
  position: 'absolute',
  top: placement === 'axis' ? (direction === 'up' ? 'auto' : -2) : 'calc(100% + 6px)',
  bottom: placement === 'axis' && direction === 'up' ? 0 : 'auto',
  right: placement === 'axis' ? (side === 'right' ? 'calc(100% + 8px)' : 'auto') : 0,
  left: placement === 'axis' ? (side === 'left' ? 'calc(100% + 8px)' : 'auto') : 'auto',
  width,
  maxHeight,
  overflowX: 'hidden',
  overflowY: maxHeight ? 'auto' : 'visible',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  padding: 10,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 30,
});

const menuHeaderStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
};

const menuTitleStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 700,
};

const menuSubtitleStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 600,
};

const menuSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingTop: 2,
};

const menuSectionTitleStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '0 2px 2px',
};

const menuSectionHintStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 9.5,
  lineHeight: 1.4,
  padding: '0 2px 2px',
};

const menuActionStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 8,
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-soft)' : 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
});

const menuActionStateStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
};

const menuRowStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: active ? 'var(--control-bg-active)' : 'var(--control-bg)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 10.5,
  fontWeight: 600,
});

const menuToggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 10.5,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
};

const menuToggleTrackStyle = (checked: boolean): CSSProperties => ({
  width: 42,
  height: 22,
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: checked ? 'flex-end' : 'flex-start',
  borderRadius: 999,
  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border2)'}`,
  background: checked ? 'var(--accent)' : 'var(--bg3)',
  transition: 'background 120ms ease, border-color 120ms ease',
  flex: '0 0 auto',
});

const menuToggleThumbStyle = (checked: boolean): CSSProperties => ({
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: checked ? '#ffffff' : 'var(--text-dim)',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
});

const radioPillStyle = (active: boolean): CSSProperties => ({
  minWidth: 40,
  padding: '2px 6px',
  borderRadius: 999,
  background: active ? 'var(--accent-soft)' : 'var(--bg3)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  fontSize: 9,
  fontWeight: 700,
  textAlign: 'center',
});

const menuHintStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 9.5,
  fontWeight: 600,
};

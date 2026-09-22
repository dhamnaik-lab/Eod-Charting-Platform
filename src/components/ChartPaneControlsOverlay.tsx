import { Fragment, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type {
  CollapsedIndicatorPanes,
  IndicatorPaneHeights,
  OverlayIndicator,
  PaneScaleOverrides,
} from '@/engine/types';
import { getDefaultIndicatorAlertPresetForIndicator } from '@/features/alerts/indicatorAlertContracts';
import { getCompactIndicatorDisplayLabel } from '@/indicators/catalog';
import { CustomFormulaDialog } from './CustomFormulaDialog';
import { IndicatorSettingsDialog } from './IndicatorSettingsDialog';

interface ChartPaneControlsOverlayProps {
  paneIndicators: OverlayIndicator[];
  layout: {
    paneTops: number[];
    priceHeight: number;
    volumeHeight: number;
    axisWidth: number;
    leftAxisWidth?: number;
  };
  indicatorPaneHeights: IndicatorPaneHeights;
  indicatorPaneHeight: number;
  collapsedIndicatorPanes: CollapsedIndicatorPanes;
  paneScaleOverrides: PaneScaleOverrides;
  paneSettingsIndicator: OverlayIndicator | null;
  onStartPaneResize: (paneId: string, startHeight: number, startY: number) => void;
  onTogglePaneCollapsed: (paneId: string, nextCollapsed: boolean) => void;
  onResetPaneScale: (paneId: string) => void;
  onMovePane: (paneId: string, direction: 'up' | 'down') => void;
  onOpenPaneSettings: (paneId: string) => void;
  onCreateAlert: (indicatorId: string) => void;
  onSaveIndicator: (indicator: OverlayIndicator) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicatorVisibility: (indicatorId: string, visible: boolean) => void;
  onClosePaneSettings: () => void;
}

export function ChartPaneControlsOverlay({
  paneIndicators,
  layout,
  indicatorPaneHeights,
  indicatorPaneHeight,
  collapsedIndicatorPanes,
  paneScaleOverrides,
  paneSettingsIndicator,
  onStartPaneResize,
  onTogglePaneCollapsed,
  onResetPaneScale,
  onMovePane,
  onOpenPaneSettings,
  onCreateAlert,
  onSaveIndicator,
  onRemoveIndicator,
  onToggleIndicatorVisibility,
  onClosePaneSettings,
}: ChartPaneControlsOverlayProps) {
  return (
    <>
      {paneIndicators.map((indicator, index) => {
        const indicatorLabel = getCompactIndicatorDisplayLabel(indicator);
        const paneTop = layout.paneTops[index] ?? layout.priceHeight + layout.volumeHeight;
        const paneHeightValue = indicatorPaneHeights[indicator.id] ?? indicatorPaneHeight;
        const isCollapsed = collapsedIndicatorPanes[indicator.id] === true;
        const isVisible = indicator.visible !== false;
        const hasManualScaleOverride = Boolean(paneScaleOverrides[indicator.id]);
        const canCreateAlert = Boolean(getDefaultIndicatorAlertPresetForIndicator(indicator));
        const canMoveUp = index > 0;
        const canMoveDown = index < paneIndicators.length - 1;
        const safeId = indicator.id.replace(/[^a-zA-Z0-9]/g, '');

        return (
          <Fragment key={indicator.id}>
            {!isCollapsed ? (
              <div
                role="separator"
                className="pane-resize-handle"
                tabIndex={0}
                aria-label={`Resize ${indicatorLabel} pane`}
                aria-orientation="horizontal"
                style={{
                  ...paneResizeHandleStyle,
                  left: layout.leftAxisWidth ?? 0,
                  right: layout.axisWidth,
                  top: Math.max(paneTop - 2, 0),
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onStartPaneResize(indicator.id, paneHeightValue, event.clientY);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                  }
                }}
                title={`Drag to resize ${indicatorLabel} pane`}
              >
                <div style={paneResizeGripStyle} />
              </div>
            ) : null}
            <div
              className="pane-controls"
              style={{
                position: 'absolute',
                top: paneTop + (isCollapsed ? 4 : 6),
                right: layout.axisWidth + 4,
                display: 'flex',
                gap: 4,
                zIndex: 7,
                transition: 'opacity 0.15s ease-in-out',
                pointerEvents: 'auto',
              }}
              onContextMenu={(event) => {
                if (!canCreateAlert) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onCreateAlert(indicator.id);
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  style={paneActionButtonStyle}
                  title={`${isCollapsed ? 'Expand' : 'Collapse'} ${indicatorLabel} pane`}
                  onClick={() => onTogglePaneCollapsed(indicator.id, !isCollapsed)}
                >
                  {isCollapsed ? '+' : '−'}
                </button>
                <button
                  type="button"
                  style={{ ...paneActionButtonStyle, fontSize: 13, opacity: isVisible ? 1 : 0.4 }}
                  title={`${isVisible ? 'Hide' : 'Show'} ${indicatorLabel}`}
                  onClick={() => onToggleIndicatorVisibility(indicator.id, !isVisible)}
                >
                  {isVisible ? '👁' : 'Ø'}
                </button>
                {!isCollapsed && (
                  <>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      title={hasManualScaleOverride ? `Fit ${indicatorLabel}` : `${indicatorLabel} is auto-fit`}
                      disabled={!hasManualScaleOverride}
                      onClick={() => onResetPaneScale(indicator.id)}
                    >
                      ⟲
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      title={`Move up`}
                      disabled={!canMoveUp}
                      onClick={() => onMovePane(indicator.id, 'up')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      title={`Move down`}
                      disabled={!canMoveDown}
                      onClick={() => onMovePane(indicator.id, 'down')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      title={`${indicatorLabel} settings`}
                      onClick={() => onOpenPaneSettings(indicator.id)}
                    >
                      ⚙
                    </button>
                    {canCreateAlert ? (
                      <button
                        type="button"
                        style={paneActionButtonStyle}
                        title={`Add alert on ${indicatorLabel}`}
                        onClick={() => onCreateAlert(indicator.id)}
                      >
                        !
                      </button>
                    ) : null}
                  </>
                )}
                <button
                  type="button"
                  style={{ ...paneActionButtonStyle, color: 'var(--red)' }}
                  title={`Remove ${indicatorLabel}`}
                  onClick={() => onRemoveIndicator(indicator.id)}
                >
                  ✕
                </button>
              </div>
            </div>
            <style>{`
              .pane-controls {
                opacity: 0;
              }
              .pane-controls:hover,
              .pane-controls:focus-within {
                opacity: 1 !important;
              }
              .pane-controls button:hover {
                background: var(--control-bg-hover) !important;
                border-color: var(--accent) !important;
                color: var(--accent) !important;
                transform: scale(1.05);
              }
              .pane-controls button:active {
                transform: scale(0.95);
              }
              .pane-resize-handle:hover {
                background: var(--accent-faint) !important;
                border-top: 1px solid var(--accent-soft) !important;
                border-bottom: 1px solid var(--accent-soft) !important;
              }
              .pane-resize-handle:hover div {
                background: var(--accent) !important;
                width: 56px !important;
              }
            `}</style>
          </Fragment>
        );
      })}
      {paneSettingsIndicator?.kind === 'CUSTOM' ? (
        createPortal(
          <CustomFormulaDialog
            indicator={paneSettingsIndicator}
            onSubmit={(draft) =>
              onSaveIndicator({
                ...paneSettingsIndicator,
                ...draft,
              })
            }
            onRemove={onRemoveIndicator}
            onClose={onClosePaneSettings}
          />,
          document.body
        )
      ) : paneSettingsIndicator ? (
        createPortal(
          <IndicatorSettingsDialog
            indicator={paneSettingsIndicator}
            onSave={onSaveIndicator}
            onRemove={onRemoveIndicator}
            onClose={onClosePaneSettings}
          />,
          document.body
        )
      ) : null}
    </>
  );
}

const paneResizeHandleStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 66,
  height: 4,
  cursor: 'row-resize',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  borderTop: '1px solid transparent',
  borderBottom: '1px solid transparent',
  transition: 'background 0.2s ease',
  pointerEvents: 'auto',
  outline: 'none',
};

const paneResizeGripStyle: CSSProperties = {
  width: 40,
  height: 2,
  borderRadius: 999,
  background: 'var(--border2)',
};

const paneActionButtonStyle: CSSProperties = {
  width: 22,
  height: 22,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--legend-bg)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
  transition: 'all 0.1s ease',
  outline: 'none',
};

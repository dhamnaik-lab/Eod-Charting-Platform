import { Fragment, type CSSProperties, type MouseEvent, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import type {
  CollapsedIndicatorPanes,
  IndicatorPaneHeights,
  OHLCBar,
  OverlayIndicator,
  PaneScaleOverrides,
} from '@/engine/types';
import { getDefaultIndicatorAlertPresetForIndicator, getIndicatorAlertSourceUnsupportedReason } from '@/features/alerts/indicatorAlertContracts';
import { getCompactIndicatorDisplayLabel } from '@/indicators/catalog';
import { getIndicatorPaneScaleStatus } from '@/features/charts/indicatorPaneScaleStatusService';
import { CustomFormulaDialog } from './CustomFormulaDialog';
import { IndicatorSettingsDialog } from './IndicatorSettingsDialog';

interface ChartPaneControlsOverlayProps {
  paneIndicators: OverlayIndicator[];
  allIndicators?: OverlayIndicator[];
  sourceBars?: OHLCBar[];
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
  onResizePane: (paneId: string, height: number) => void;
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
  allIndicators = paneIndicators,
  sourceBars = [],
  layout,
  indicatorPaneHeights,
  indicatorPaneHeight,
  collapsedIndicatorPanes,
  paneScaleOverrides,
  paneSettingsIndicator,
  onStartPaneResize,
  onResizePane,
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
  const paneSettingsDialog =
    paneSettingsIndicator?.kind === 'CUSTOM' ? (
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
      />
    ) : paneSettingsIndicator ? (
      <IndicatorSettingsDialog
        indicator={paneSettingsIndicator}
        scaleMode={getIndicatorPaneScaleStatus(paneSettingsIndicator, paneScaleOverrides)}
        allIndicators={allIndicators}
        sourceBars={sourceBars}
        onSave={onSaveIndicator}
        onRemove={onRemoveIndicator}
        onClose={onClosePaneSettings}
      />
    ) : null;

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
        const alertSourceReason = getIndicatorAlertSourceUnsupportedReason(indicator);
        const canMoveUp = index > 0;
        const canMoveDown = index < paneIndicators.length - 1;

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
                onDoubleClick={stopPaneControlPointer}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    event.stopPropagation();
                    onResizePane(indicator.id, paneHeightValue + (event.key === 'ArrowUp' ? 12 : -12));
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
                top: paneTop + (isCollapsed ? 2 : 6),
                right: layout.axisWidth + 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 2,
                borderRadius: 6,
                background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.06)',
                zIndex: 7,
                pointerEvents: 'auto',
              }}
              onMouseDown={stopPaneControlPointer}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={stopPaneControlPointer}
              onContextMenu={(event) => {
                if (!canCreateAlert) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onCreateAlert(indicator.id);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  style={paneActionButtonStyle}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${indicatorLabel} pane`}
                  title={`${isCollapsed ? 'Expand' : 'Collapse'} ${indicatorLabel} pane`}
                  onMouseDown={stopPaneControlPointer}
                  onClick={() => onTogglePaneCollapsed(indicator.id, !isCollapsed)}
                >
                  {isCollapsed ? <PaneExpandIcon /> : <PaneCollapseIcon />}
                </button>
                <button
                  type="button"
                  style={{
                    ...paneActionButtonStyle,
                    background: isVisible ? 'var(--bg4)' : 'var(--bg3)',
                    color: isVisible ? 'var(--text)' : 'var(--text-dim)',
                  }}
                  aria-label={`${isVisible ? 'Hide' : 'Show'} ${indicatorLabel}`}
                  title={`${isVisible ? 'Hide' : 'Show'} ${indicatorLabel}`}
                  onMouseDown={stopPaneControlPointer}
                  onClick={() => onToggleIndicatorVisibility(indicator.id, !isVisible)}
                >
                  {isVisible ? <PaneEyeIcon /> : <PaneEyeOffIcon />}
                </button>
                {!isCollapsed && (
                  <>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      aria-label={hasManualScaleOverride ? `Fit ${indicatorLabel}` : `${indicatorLabel} is auto-fit`}
                      title={hasManualScaleOverride ? `Fit ${indicatorLabel}` : `${indicatorLabel} is auto-fit`}
                      disabled={!hasManualScaleOverride}
                      onMouseDown={stopPaneControlPointer}
                      onClick={() => onResetPaneScale(indicator.id)}
                    >
                      <PaneResetScaleIcon />
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      aria-label={`Move ${indicatorLabel} pane up`}
                      title="Move up"
                      disabled={!canMoveUp}
                      onMouseDown={stopPaneControlPointer}
                      onClick={() => onMovePane(indicator.id, 'up')}
                    >
                      <PaneArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      aria-label={`Move ${indicatorLabel} pane down`}
                      title="Move down"
                      disabled={!canMoveDown}
                      onMouseDown={stopPaneControlPointer}
                      onClick={() => onMovePane(indicator.id, 'down')}
                    >
                      <PaneArrowDownIcon />
                    </button>
                    <button
                      type="button"
                      style={paneActionButtonStyle}
                      aria-label={`${indicatorLabel} settings`}
                      title={`${indicatorLabel} settings`}
                      onMouseDown={stopPaneControlPointer}
                      onClick={() => onOpenPaneSettings(indicator.id)}
                    >
                      <PaneSettingsIcon />
                    </button>
                    {canCreateAlert ? (
                      <button
                        type="button"
                        style={paneActionButtonStyle}
                        aria-label={`Add alert on ${indicatorLabel}`}
                        title={`Add alert on ${indicatorLabel}`}
                        onMouseDown={stopPaneControlPointer}
                        onClick={() => onCreateAlert(indicator.id)}
                      >
                        <PaneAlertIcon />
                      </button>
                    ) : alertSourceReason ? (
                      <span title={alertSourceReason} style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          style={paneActionButtonStyle}
                          aria-label={alertSourceReason}
                          onMouseDown={stopPaneControlPointer}
                          disabled
                        >
                          <PaneAlertIcon />
                        </button>
                      </span>
                    ) : null}
                  </>
                )}
                <button
                  type="button"
                  data-tone="danger"
                  style={{ ...paneActionButtonStyle, color: 'var(--red-text)' }}
                  aria-label={`Remove ${indicatorLabel}`}
                  title={`Remove ${indicatorLabel}`}
                  onMouseDown={stopPaneControlPointer}
                  onClick={() => onRemoveIndicator(indicator.id)}
                >
                  <PaneRemoveIcon />
                </button>
              </div>
            </div>
          </Fragment>
        );
      })}
      {paneSettingsDialog
        ? (typeof document !== 'undefined' && document.body
            ? createPortal(
                <div
                  style={{ display: 'contents' }}
                  onMouseDown={stopPortalBubble}
                  onPointerDown={stopPortalBubble}
                  onClick={stopPortalBubble}
                  onDoubleClick={stopPortalBubble}
                  onContextMenu={stopPortalBubble}
                >
                  {paneSettingsDialog}
                </div>,
                document.body,
              )
            : paneSettingsDialog)
        : null}
    </>
  );
}

function stopPaneControlPointer(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function stopPortalBubble(event: SyntheticEvent) {
  event.stopPropagation();
}

function PaneCollapseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaneExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaneEyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PaneEyeOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.2 2.2 13.8 13.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M6.4 4.2A6.6 6.6 0 0 1 8 4c3.9 0 6.2 4 6.2 4a11.3 11.3 0 0 1-1.9 2.4M4.1 5.6A11.3 11.3 0 0 0 1.8 8S4.1 12 8 12c.9 0 1.8-.2 2.5-.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaneResetScaleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.2 8a4.8 4.8 0 1 0 1.3-3.3L3 6.2"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3v3.2h3.2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaneArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaneArrowDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaneSettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 2.2v2M8 11.8v2M3.9 3.9l1.4 1.4M10.7 10.7l1.4 1.4M2.2 8h2M11.8 8h2M3.9 12.1l1.4-1.4M10.7 5.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaneAlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.6v6.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="8" cy="12.4" r="1.15" fill="currentColor" />
    </svg>
  );
}

function PaneRemoveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
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
  pointerEvents: 'auto',
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
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg4)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
};

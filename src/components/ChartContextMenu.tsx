import { useEffect, useState, type CSSProperties } from 'react';

export interface ChartContextMenuState {
  x: number;
  y: number;
}

interface ChartContextMenuProps {
  menu: ChartContextMenuState | null;
  drawingItems: ChartContextMenuRemoveItem[];
  indicatorItems: ChartContextMenuRemoveItem[];
  indicatorAlertItems: ChartContextMenuRemoveItem[];
  onResetView: () => void;
  onOpenSettings: () => void;
  onRemoveDrawing: (drawingId: string) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onCreateIndicatorAlert: (indicatorId: string) => void;
  onClose: () => void;
}

export interface ChartContextMenuRemoveItem {
  id: string;
  label: string;
}

export function ChartContextMenu({
  menu,
  drawingItems,
  indicatorItems,
  indicatorAlertItems,
  onResetView,
  onOpenSettings,
  onRemoveDrawing,
  onRemoveIndicator,
  onCreateIndicatorAlert,
  onClose,
}: ChartContextMenuProps) {
  const [expandedGroup, setExpandedGroup] = useState<'drawings' | 'indicators' | 'indicatorAlerts' | null>(null);

  useEffect(() => {
    setExpandedGroup(null);
  }, [menu]);

  if (!menu) {
    return null;
  }

  const runAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      style={{ ...contextMenuStyle, left: menu.x, top: menu.y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button type="button" style={contextMenuButtonStyle} onClick={() => runAction(onResetView)}>
        Reset chart view
      </button>
      <div style={contextMenuDividerStyle} />
      <button type="button" style={contextMenuButtonStyle} onClick={() => runAction(onOpenSettings)}>
        Chart settings...
      </button>
      <div style={contextMenuDividerStyle} />
      <button
        type="button"
        style={contextMenuButtonStyle}
        onClick={() => setExpandedGroup((group) => (group === 'indicatorAlerts' ? null : 'indicatorAlerts'))}
      >
        <span>Add indicator alert</span>
        <span style={contextMenuChevronStyle}>›</span>
      </button>
      {expandedGroup === 'indicatorAlerts' ? (
        <div style={contextSubmenuStyle}>
          {indicatorAlertItems.length ? (
            indicatorAlertItems.map((item) => (
              <button
                key={item.id}
                type="button"
                style={contextSubmenuButtonStyle}
                onClick={() => runAction(() => onCreateIndicatorAlert(item.id))}
              >
                {item.label}
              </button>
            ))
          ) : (
            <div style={contextSubmenuEmptyStyle}>No alertable indicators on this chart</div>
          )}
        </div>
      ) : null}
      <button
        type="button"
        style={contextMenuButtonStyle}
        onClick={() => setExpandedGroup((group) => (group === 'drawings' ? null : 'drawings'))}
      >
        <span>Remove drawings</span>
        <span style={contextMenuChevronStyle}>›</span>
      </button>
      {expandedGroup === 'drawings' ? (
        <div style={contextSubmenuStyle}>
          {drawingItems.length ? (
            drawingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                style={contextSubmenuButtonStyle}
                onClick={() => runAction(() => onRemoveDrawing(item.id))}
              >
                {item.label}
              </button>
            ))
          ) : (
            <div style={contextSubmenuEmptyStyle}>No drawings on this chart</div>
          )}
        </div>
      ) : null}
      <button
        type="button"
        style={contextMenuButtonStyle}
        onClick={() => setExpandedGroup((group) => (group === 'indicators' ? null : 'indicators'))}
      >
        <span>Remove indicators</span>
        <span style={contextMenuChevronStyle}>›</span>
      </button>
      {expandedGroup === 'indicators' ? (
        <div style={contextSubmenuStyle}>
          {indicatorItems.length ? (
            indicatorItems.map((item) => (
              <button
                key={item.id}
                type="button"
                style={contextSubmenuButtonStyle}
                onClick={() => runAction(() => onRemoveIndicator(item.id))}
              >
                {item.label}
              </button>
            ))
          ) : (
            <div style={contextSubmenuEmptyStyle}>No indicators on this chart</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const contextMenuStyle: CSSProperties = {
  position: 'absolute',
  width: 190,
  maxHeight: 360,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 18,
};

const contextMenuButtonStyle: CSSProperties = {
  height: 30,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  textAlign: 'left',
  padding: '0 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const contextMenuChevronStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 15,
};

const contextSubmenuStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  maxHeight: 180,
  overflowY: 'auto',
  padding: '2px 0 4px 8px',
};

const contextSubmenuButtonStyle: CSSProperties = {
  ...contextMenuButtonStyle,
  height: 28,
  paddingLeft: 10,
  color: 'var(--text2)',
};

const contextSubmenuEmptyStyle: CSSProperties = {
  padding: '7px 10px',
  color: 'var(--muted)',
  fontSize: 12,
};

const contextMenuDividerStyle: CSSProperties = {
  height: 1,
  margin: '4px 6px',
  background: 'var(--border)',
};

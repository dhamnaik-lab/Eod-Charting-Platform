import { useEffect, useState } from 'react';
import { useChartStore } from '@/store/chartStore';
import { clampChartTabContextMenuPosition } from '@/features/charts/chartTabContextMenuLayout';

interface TabContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export function ChartTabs() {
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const closeChartTab = useChartStore((state) => state.closeChartTab);
  const createChartTab = useChartStore((state) => state.createChartTab);
  const duplicateChartTab = useChartStore((state) => state.duplicateChartTab);
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('blur', closeMenu);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('blur', closeMenu);
    };
  }, [contextMenu]);

  return (
    <>
      <div style={tabStripStyle}>
        <div style={tabListStyle} className="tab-strip-scroll">
          {chartTabs.map((tab) => (
            <div
              key={tab.id}
              style={tabContainerStyle(tab.id === activeChartTabId)}
              onClick={() => activateChartTab(tab.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                activateChartTab(tab.id);
                setContextMenu({
                  tabId: tab.id,
                  ...clampChartTabContextMenuPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight),
                });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activateChartTab(tab.id);
                }
              }}
            >
              <span style={tabLabelStyle(tab.id === activeChartTabId)}>{tab.title}</span>
              <button
                type="button"
                style={closeTabButtonStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  closeChartTab(tab.id);
                }}
                title="Close tab"
                aria-label={`Close chart tab ${tab.title}`}
              >
                x
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          style={newTabButtonStyle}
          onClick={() => createChartTab()}
          title="New chart tab"
          aria-label="New chart tab"
        >
          +
        </button>
      </div>
      {contextMenu ? (
        <div style={contextMenuStyle(contextMenu.x, contextMenu.y)} role="menu" onMouseDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            style={contextMenuItemStyle}
            role="menuitem"
            onClick={() => {
              duplicateChartTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Duplicate tab
          </button>
        </div>
      ) : null}
    </>
  );
}

const tabStripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 0,
  padding: '0 8px',
  background: 'var(--tab-strip-bg)',
  borderBottom: '1px solid var(--border)',
};

const tabListStyle: React.CSSProperties = {
  display: 'flex',
  gap: 1,
  minWidth: 0,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

function tabContainerStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    maxWidth: 140,
    height: 26,
    padding: '0 8px',
    background: active ? 'var(--bg)' : 'var(--bg2)',
    border: '1px solid var(--border)',
    borderBottom: active ? '1px solid var(--bg)' : '1px solid transparent',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    marginBottom: -1,
  };
}

function tabLabelStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? 'var(--text)' : 'var(--text-dim)',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    lineHeight: 1,
  };
}

const closeTabButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-mute)',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: 1,
  padding: 0,
  flex: '0 0 auto',
};

const newTabButtonStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  border: 'none',
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  borderRadius: '6px 6px 0 0',
  cursor: 'pointer',
  flex: '0 0 auto',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const contextMenuStyle = (x: number, y: number): React.CSSProperties => ({
  position: 'fixed',
  left: x,
  top: y,
  zIndex: 100,
  minWidth: 156,
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 'var(--control-radius)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
});

const contextMenuItemStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 28,
  padding: '0 10px',
  border: 'none',
  borderRadius: 'var(--control-radius)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'left',
};

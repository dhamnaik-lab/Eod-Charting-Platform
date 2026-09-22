import React from 'react';
import { useWindowStore } from '@/store/windowStore';
import { useUiStore } from '@/store/uiStore';

export function WindowTray() {
  const sidebarVisible = useUiStore((state) => state.uiFlags.sidebarVisible);
  const windows = useWindowStore((state) => state.windows);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const minimizedWindows = Object.values(windows).filter((w) => w.isOpen && w.isMinimized);

  // If sidebar is visible, minimized windows are docked in the left sidebar rail.
  if (sidebarVisible || minimizedWindows.length === 0) {
    return null;
  }

  return (
    <div style={trayStyle}>
      {minimizedWindows.map((w) => (
        <div key={w.id} style={trayItemWrapperStyle}>
          <button
            type="button"
            style={trayButtonStyle}
            onClick={() => {
              restoreWindow(w.id);
              focusWindow(w.id);
            }}
            title={`Restore ${w.title}`}
          >
            <span style={dotStyle} />
            <span style={textStyle}>{w.title}</span>
          </button>
          <button
            type="button"
            style={trayCloseButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(w.id);
            }}
            title={`Close ${w.title}`}
            aria-label={`Close ${w.title}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const trayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 32,
  left: 16,
  display: 'flex',
  gap: 8,
  padding: '4px 8px',
  backgroundColor: 'var(--bg2)',
  backdropFilter: 'blur(8px)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  zIndex: 2000,
  boxShadow: 'var(--shadow-lg)',
};

const trayItemWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--control-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'hidden',
};

const trayButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  maxWidth: 160,
};

const trayCloseButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: '100%',
  background: 'transparent',
  border: 'none',
  borderLeft: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 10,
  cursor: 'pointer',
  padding: '0 4px',
};

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: 'var(--accent)',
  flexShrink: 0,
};

const textStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};


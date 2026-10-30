import React, { useEffect, useRef } from 'react';
import { useWindowStore } from '@/store/windowStore';

interface FloatingWindowProps {
  id: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  preserveChildrenWhenMinimized?: boolean;
}

export function FloatingWindow({
  id,
  children,
  onClose,
  className,
  style,
  preserveChildrenWhenMinimized = false,
}: FloatingWindowProps) {
  const windowState = useWindowStore((state) => state.windows[id]);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const moveWindow = useWindowStore((state) => state.moveWindow);
  const resizeWindow = useWindowStore((state) => state.resizeWindow);
  const closeWindowStore = useWindowStore((state) => state.closeWindow);
  const maximizeWindow = useWindowStore((state) => state.maximizeWindow);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);

  const dragRef = useRef<{ startX: number; startY: number; startWindowX: number; startWindowY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const idRef = useRef(id);
  idRef.current = id;
  const windowStateRef = useRef(windowState);
  windowStateRef.current = windowState;

  // Stable event handlers that use refs to access latest state and actions
  const moveWindowRef = useRef(moveWindow);
  const resizeWindowRef = useRef(resizeWindow);
  moveWindowRef.current = moveWindow;
  resizeWindowRef.current = resizeWindow;

  const handleMouseMoveStable = useRef((e: MouseEvent) => {
    if (dragRef.current && windowStateRef.current) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      let nextX = dragRef.current.startWindowX + deltaX;
      let nextY = dragRef.current.startWindowY + deltaY;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      nextX = Math.max(-windowStateRef.current.bounds.width + 100, Math.min(nextX, viewportWidth - 100));
      nextY = Math.max(0, Math.min(nextY, viewportHeight - 40));

      moveWindowRef.current(idRef.current, nextX, nextY);
    }
  }).current;

  const handleMouseUpStable = useRef(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleMouseMoveStable);
    window.removeEventListener('mouseup', handleMouseUpStable);
  }).current;

  const handleResizeMouseMoveStable = useRef((e: MouseEvent) => {
    if (resizeRef.current && windowStateRef.current) {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;

      let nextWidth = resizeRef.current.startWidth + deltaX;
      let nextHeight = resizeRef.current.startHeight + deltaY;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (windowStateRef.current.bounds.x + nextWidth > viewportWidth) {
        nextWidth = viewportWidth - windowStateRef.current.bounds.x;
      }
      if (windowStateRef.current.bounds.y + nextHeight > viewportHeight) {
        nextHeight = viewportHeight - windowStateRef.current.bounds.y;
      }

      resizeWindowRef.current(idRef.current, nextWidth, nextHeight);
    }
  }).current;

  const handleResizeMouseUpStable = useRef(() => {
    resizeRef.current = null;
    window.removeEventListener('mousemove', handleResizeMouseMoveStable);
    window.removeEventListener('mouseup', handleResizeMouseUpStable);
  }).current;

  const stopActiveInteractions = useRef(() => {
    dragRef.current = null;
    resizeRef.current = null;
    window.removeEventListener('mousemove', handleMouseMoveStable);
    window.removeEventListener('mouseup', handleMouseUpStable);
    window.removeEventListener('mousemove', handleResizeMouseMoveStable);
    window.removeEventListener('mouseup', handleResizeMouseUpStable);
  }).current;

  useEffect(() => {
    if (!windowState?.isOpen || windowState?.isMinimized || windowState?.isMaximized) {
      stopActiveInteractions();
    }
  }, [windowState?.isOpen, windowState?.isMinimized, windowState?.isMaximized, stopActiveInteractions]);

  useEffect(() => {
    window.addEventListener('blur', stopActiveInteractions);
    return () => {
      window.removeEventListener('blur', stopActiveInteractions);
      stopActiveInteractions();
    };
  }, [stopActiveInteractions]);

  if (!windowState || !windowState.isOpen) {
    return null;
  }

  if (windowState.isMinimized && !preserveChildrenWhenMinimized) {
    return null;
  }

  const { bounds, zIndex, title, isMaximized } = windowState;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeWindowStore(id);
    }
  };

  const handleMouseDown = () => {
    focusWindow(id);
  };

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    if (isMaximized) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWindowX: bounds.x,
      startWindowY: bounds.y,
    };
    window.addEventListener('mousemove', handleMouseMoveStable);
    window.addEventListener('mouseup', handleMouseUpStable);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: bounds.width,
      startHeight: bounds.height,
    };
    window.addEventListener('mousemove', handleResizeMouseMoveStable);
    window.addEventListener('mouseup', handleResizeMouseUpStable);
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: isMaximized ? 0 : bounds.x,
    top: isMaximized ? 0 : bounds.y,
    width: isMaximized ? '100vw' : bounds.width,
    height: isMaximized ? '100vh' : bounds.height,
    zIndex,
    display: windowState.isMinimized ? 'none' : 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg)',
    border: isMaximized ? 'none' : '1px solid var(--border)',
    borderRadius: isMaximized ? 0 : 'var(--panel-radius)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div
      style={containerStyle}
      className={className}
      onMouseDown={handleMouseDown}
      role="dialog"
      aria-labelledby={`${id}-title`}
    >
      <div
        style={headerStyle}
        onMouseDown={handleTitleMouseDown}
        onDoubleClick={() => (isMaximized ? restoreWindow(id) : maximizeWindow(id))}
      >
        <div id={`${id}-title`} style={titleStyle}>{title}</div>
        <div style={actionsStyle}>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={(e) => { e.stopPropagation(); minimizeWindow(id); }}
            title="Minimize"
          >
            —
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={(e) => { e.stopPropagation(); isMaximized ? restoreWindow(id) : maximizeWindow(id); }}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? '❒' : '☐'}
          </button>
          <button
            type="button"
            style={{ ...actionButtonStyle, color: 'var(--red)' }}
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div style={bodyStyle}>
        {children}
      </div>
      {!isMaximized && (
        <div
          style={resizeHandleStyle}
          onMouseDown={handleResizeMouseDown}
          title="Resize"
        />
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  cursor: 'default',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginRight: 12,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const actionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-mute)',
  fontSize: 14,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 24,
  transition: 'background-color 0.2s',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  position: 'relative',
};

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  width: 16,
  height: 16,
  cursor: 'nwse-resize',
  zIndex: 10,
};

import React, { useEffect, useRef } from 'react';
import { useWindowStore } from '@/store/windowStore';
import { getFloatingWindowArrowDelta } from '@/components/common/floatingWindowKeyboard';

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

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isMaximized) return;
    const delta = getFloatingWindowArrowDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    focusWindow(id);
    moveWindow(
      id,
      Math.max(-bounds.width + 100, Math.min(bounds.x + delta.x, window.innerWidth - 100)),
      Math.max(0, Math.min(bounds.y + delta.y, window.innerHeight - 40)),
    );
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isMaximized) return;
    const delta = getFloatingWindowArrowDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    focusWindow(id);
    resizeWindow(
      id,
      Math.min(bounds.width + delta.x, Math.max(windowState.minWidth, window.innerWidth - bounds.x)),
      Math.min(bounds.height + delta.y, Math.max(windowState.minHeight, window.innerHeight - bounds.y)),
    );
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
        onKeyDown={handleTitleKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`Move ${title} window with arrow keys`}
      >
        <div id={`${id}-title`} style={titleStyle}>{title}</div>
        <div style={actionsStyle}>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={(e) => { e.stopPropagation(); minimizeWindow(id); }}
            title="Minimize"
            aria-label={`Minimize ${title}`}
          >
            —
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={(e) => { e.stopPropagation(); isMaximized ? restoreWindow(id) : maximizeWindow(id); }}
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={`${isMaximized ? "Restore" : "Maximize"} ${title}`}
          >
            {isMaximized ? '❒' : '☐'}
          </button>
          <button
            type="button"
            style={{ ...actionButtonStyle, color: 'var(--red)' }}
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            title="Close"
            aria-label={`Close ${title}`}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={bodyStyle}>
        {children}
      </div>
      {!isMaximized && (
        <button
          type="button"
          style={resizeHandleStyle}
          onMouseDown={handleResizeMouseDown}
          onKeyDown={handleResizeKeyDown}
          aria-label={`Resize ${title} window with arrow keys`}
          title="Drag to resize, or use arrow keys"
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
  border: 'none',
  background: 'transparent',
  padding: 0,
  right: 0,
  bottom: 0,
  width: 16,
  height: 16,
  cursor: 'nwse-resize',
  zIndex: 10,
};

import React, { useId, type ReactNode } from 'react';
import { useDraggableFloatingWindow } from './useDraggableFloatingWindow';
import { getFloatingWindowArrowDelta } from './floatingWindowKeyboard';

export interface FloatingDialogShellProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onClose: () => void;
  storageKey?: string;
  width?: number;
  height?: number;
  children: ReactNode;
  headerRightContent?: ReactNode;
  footerContent?: ReactNode;
  isModeless?: boolean; // If true, no full-screen click catcher; chart is directly clickable
}

export function FloatingDialogShell({
  title,
  subtitle,
  icon,
  onClose,
  storageKey,
  width = 880,
  height = 620,
  children,
  headerRightContent,
  footerContent,
  isModeless = true,
}: FloatingDialogShellProps) {
  const { position, handlePointerDown, isDragging, resetPosition, moveByKeyboard } = useDraggableFloatingWindow({
    storageKey,
    width,
    height,
  });

  const titleId = useId();
  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const delta = getFloatingWindowArrowDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    moveByKeyboard(delta.x, delta.y);
  };

  return (
    <>
      {/* If not modeless, render an ultra-light, crystal-clear click-outside catcher (zero blur) */}
      {!isModeless ? (
        <div
          style={clearBackdropStyle}
          onMouseDown={onClose}
          aria-hidden="true"
        />
      ) : null}

      <div
        className="floating-dialog-panel"
        role="dialog"
        aria-modal={!isModeless}
        aria-labelledby={titleId}
        style={{
          ...floatingPanelStyle,
          left: position.x,
          top: position.y,
          width: `min(${width}px, calc(100vw - 20px))`,
          maxHeight: `min(${height}px, calc(100vh - 20px))`,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Draggable Header Bar */}
        <div
          style={floatingHeaderStyle}
          onPointerDown={handlePointerDown}
          onKeyDown={handleHeaderKeyDown}
          tabIndex={0}
          role="group"
          aria-label={`Move ${title} window with arrow keys`}
          title="Drag to move window, or use arrow keys"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', minWidth: 0 }}>
            {icon ? <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong id={titleId} style={headerTitleStyle}>{title}</strong>
                <span style={dragHandleHintStyle}>⠿ Drag to move</span>
              </div>
              {subtitle ? <div style={headerSubtitleStyle}>{subtitle}</div> : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onPointerDown={(e) => e.stopPropagation()}>
            {headerRightContent}
            <button
              type="button"
              style={headerIconButtonStyle}
              onClick={resetPosition}
              title="Reset window position to center"
              aria-label={`Reset ${title} position`}
            >
              ⤢
            </button>
            <button
              type="button"
              style={headerIconButtonStyle}
              onClick={onClose}
              title="Close window (Escape)"
              aria-label={`Close ${title}`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dialog Content Area */}
        <div style={floatingBodyStyle}>{children}</div>

        {/* Optional Footer */}
        {footerContent ? <div style={floatingFooterStyle}>{footerContent}</div> : null}
      </div>
    </>
  );
}

const clearBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.25)', // Ultra-light tint without any blur
  zIndex: 45,
};

const floatingPanelStyle: React.CSSProperties = {
  position: 'fixed',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border2)',
  zIndex: 50,
  userSelect: 'auto',
};

const floatingHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border2)',
  background: 'var(--bg)',
  cursor: 'grab',
  touchAction: 'none',
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text)',
};

const dragHandleHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  padding: '1px 5px',
  borderRadius: 4,
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  fontWeight: 600,
};

const headerSubtitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  marginTop: 1,
};

const headerIconButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 11.5,
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.1s, background 0.1s',
};

const floatingBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const floatingFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderTop: '1px solid var(--border2)',
  background: 'var(--bg)',
};

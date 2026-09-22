import type { CSSProperties } from 'react';

export interface DrawingContextMenuState {
  x: number;
  y: number;
  drawingId: string;
}

interface ChartDrawingContextMenuProps {
  drawingContextMenu: DrawingContextMenuState | null;
  locked: boolean;
  canCreateAlert: boolean;
  onOpenProperties: (drawingId: string) => void;
  onCreateAlert: (drawingId: string) => void;
  onToggleLock: (drawingId: string) => void;
  onDelete: (drawingId: string) => void;
}

export function ChartDrawingContextMenu({
  drawingContextMenu,
  locked,
  canCreateAlert,
  onOpenProperties,
  onCreateAlert,
  onToggleLock,
  onDelete,
}: ChartDrawingContextMenuProps) {
  if (!drawingContextMenu) {
    return null;
  }

  return (
    <div
      style={{ ...drawingContextMenuStyle, left: drawingContextMenu.x, top: drawingContextMenu.y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        style={contextMenuButtonStyle}
        onClick={() => onOpenProperties(drawingContextMenu.drawingId)}
      >
        Properties
      </button>
      {canCreateAlert ? (
        <button
          type="button"
          style={contextMenuButtonStyle}
          onClick={() => onCreateAlert(drawingContextMenu.drawingId)}
        >
          Add alert on drawing
        </button>
      ) : null}
      <button
        type="button"
        style={contextMenuButtonStyle}
        onClick={() => onToggleLock(drawingContextMenu.drawingId)}
      >
        {locked ? 'Unlock' : 'Lock'}
      </button>
      <button
        type="button"
        disabled={locked}
        title={locked ? 'Unlock the drawing before deleting it.' : undefined}
        style={{
          ...contextMenuButtonStyle,
          color: 'var(--red)',
          opacity: locked ? 0.45 : 1,
          cursor: locked ? 'not-allowed' : 'pointer',
        }}
        onClick={() => {
          if (!locked) onDelete(drawingContextMenu.drawingId);
        }}
      >
        Delete
      </button>
    </div>
  );
}

const drawingContextMenuStyle: CSSProperties = {
  position: 'absolute',
  width: 176,
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 9,
};

const contextMenuButtonStyle: CSSProperties = {
  height: 30,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  textAlign: 'left',
  padding: '0 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

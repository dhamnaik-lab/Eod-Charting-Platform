import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DrawingTool } from '@/engine/types';
import { useUiStore } from '@/store/uiStore';
import { getDrawingToolMeta } from './ChartToolDock';

interface Position {
  x: number;
  y: number;
}

const FAVORITE_TOOLBAR_POS_KEY = 'eod-chart.favorite-toolbar.position.v1';

function readStoredPosition(): Position {
  if (typeof window === 'undefined') return { x: 80, y: 60 };
  try {
    const raw = window.localStorage.getItem(FAVORITE_TOOLBAR_POS_KEY);
    if (!raw) return { x: 80, y: 60 };
    const parsed = JSON.parse(raw);
    return typeof parsed.x === 'number' && typeof parsed.y === 'number'
      ? parsed
      : { x: 80, y: 60 };
  } catch {
    return { x: 80, y: 60 };
  }
}

function writeStoredPosition(pos: Position): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITE_TOOLBAR_POS_KEY, JSON.stringify(pos));
  } catch {}
}

export function FavoriteToolsToolbar() {
  const favoriteTools = useUiStore((state) => state.favoriteDrawingTools);
  const visible = useUiStore((state) => state.favoriteToolbarVisible);
  const orientation = useUiStore((state) => state.favoriteToolbarOrientation);
  const activeDrawingTool = useUiStore((state) => state.activeDrawingTool);
  const setDrawingTool = useUiStore((state) => state.setDrawingTool);
  const setFavoriteToolbarVisible = useUiStore((state) => state.setFavoriteToolbarVisible);
  const setFavoriteToolbarOrientation = useUiStore((state) => state.setFavoriteToolbarOrientation);

  const [position, setPosition] = useState<Position>(readStoredPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    writeStoredPosition(position);
  }, [position]);

  if (!visible || favoriteTools.length === 0) {
    return null;
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      const nextX = Math.max(10, Math.min(window.innerWidth - 100, dragStartRef.current.posX + dx));
      const nextY = Math.max(40, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1100,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: 'center',
        gap: 3,
        padding: '3px 5px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
      }}
      title="Drag to reposition favorites toolbar"
    >
      {/* Drag Handle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isHorizontal ? '0 3px' : '3px 0',
          color: 'var(--text-dim)',
          fontSize: 10,
          opacity: 0.7,
        }}
      >
        {isHorizontal ? '⠿' : '⋯'}
      </div>

      {/* Tool Buttons */}
      {favoriteTools.map((toolId) => {
        let meta;
        try {
          meta = getDrawingToolMeta(toolId);
        } catch {
          return null;
        }

        const isActive = activeDrawingTool === toolId;

        return (
          <button
            key={toolId}
            type="button"
            onClick={() => setDrawingTool(toolId)}
            title={`${meta.title} — ${meta.hint}`}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--text)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'background 0.1s, border-color 0.1s',
            }}
          >
            {meta.icon}
          </button>
        );
      })}

      {/* Divider */}
      <div
        style={{
          width: isHorizontal ? 1 : '100%',
          height: isHorizontal ? 18 : 1,
          background: 'var(--border)',
          margin: isHorizontal ? '0 2px' : '2px 0',
        }}
      />

      {/* Orientation Toggle */}
      <button
        type="button"
        onClick={() => setFavoriteToolbarOrientation(isHorizontal ? 'vertical' : 'horizontal')}
        title={isHorizontal ? 'Switch to Vertical Layout' : 'Switch to Horizontal Layout'}
        style={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--text-dim)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 10,
        }}
      >
        {isHorizontal ? '⇅' : '⇄'}
      </button>

      {/* Close Button */}
      <button
        type="button"
        onClick={() => setFavoriteToolbarVisible(false)}
        title="Hide Favorites Toolbar"
        style={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--text-dim)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        ✕
      </button>
    </div>
  );
}

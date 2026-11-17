import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DrawingTool } from '@/engine/types';
import { useUiStore } from '@/store/uiStore';
import { getDrawingToolMeta } from './ChartToolDock';
import { clampCoordinate } from './common/useDraggableFloatingWindow';

interface Position {
  x: number;
  y: number;
}

export function clampFavoriteToolbarPosition(
  position: Position,
  toolbar: { width: number; height: number },
  viewport: { width: number; height: number },
): Position {
  const margin = 8;
  return {
    x: clampCoordinate(position.x, margin, Math.max(margin, viewport.width - toolbar.width - margin)),
    y: clampCoordinate(position.y, margin, Math.max(margin, viewport.height - toolbar.height - margin)),
  };
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    writeStoredPosition(position);
  }, [position]);

  const hasTools = favoriteTools.length > 0;
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const keepVisible = () => {
      const bounds = toolbar.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setPosition((current) => {
        const next = clampFavoriteToolbarPosition(current, bounds, viewport);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };

    keepVisible();
    window.addEventListener('resize', keepVisible);
    const observer = new ResizeObserver(keepVisible);
    observer.observe(toolbar);
    return () => {
      window.removeEventListener('resize', keepVisible);
      observer.disconnect();
    };
  }, [visible, hasTools]);

  if (!visible || !hasTools) {
    return null;
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const toolbar = e.currentTarget;
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
      const bounds = toolbar.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const next = { x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy };
      setPosition(clampFavoriteToolbarPosition(next, bounds, viewport));
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
      ref={toolbarRef}
      className="favorite-tools-toolbar"
      role="group"
      aria-label="Favorite drawing tools"
      onPointerDown={handlePointerDown}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1100,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        flexWrap: isHorizontal ? 'wrap' : 'nowrap',
        alignItems: 'center',
        gap: 3,
        padding: '3px 5px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        boxSizing: 'border-box',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100vh - 16px)',
        overflow: 'auto',
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
            aria-label={meta.title}
            aria-pressed={isActive}
            title={`${meta.title} — ${meta.hint}`}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'var(--accent-contrast)' : 'var(--text)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
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
        aria-label={isHorizontal ? 'Switch to Vertical Layout' : 'Switch to Horizontal Layout'}
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
        aria-label="Hide Favorites Toolbar"
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

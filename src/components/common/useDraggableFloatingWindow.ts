import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface UseDraggableFloatingWindowOptions {
  storageKey?: string;
  defaultPosition?: { x: number; y: number };
  width?: number;
  height?: number;
  storage?: Storage | null;
}

export interface UseDraggableFloatingWindowReturn {
  position: { x: number; y: number };
  handlePointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  isDragging: boolean;
  resetPosition: () => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

export function clampCoordinate(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeInitialFloatingPosition(
  width: number,
  height: number,
  screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920,
  screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080,
): { x: number; y: number } {
  const x = Math.max(16, Math.round((screenWidth - width) / 2));
  const y = Math.max(32, Math.round((screenHeight - height) / 3));
  return { x, y };
}

function resolveStorage(customStorage?: Storage | null): Storage | null {
  if (customStorage !== undefined) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function readStoredFloatingPosition(
  storageKey: string,
  width: number,
  height: number,
  screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920,
  screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080,
  storage?: Storage | null,
): { x: number; y: number } | null {
  const s = resolveStorage(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      const maxX = Math.max(0, screenWidth - 80);
      const maxY = Math.max(0, screenHeight - 60);
      return {
        x: clampCoordinate(parsed.x, 0, maxX),
        y: clampCoordinate(parsed.y, 0, maxY),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredFloatingPosition(
  storageKey: string,
  pos: { x: number; y: number },
  storage?: Storage | null,
): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(storageKey, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function useDraggableFloatingWindow(
  options: UseDraggableFloatingWindowOptions = {},
): UseDraggableFloatingWindowReturn {
  const { storageKey, defaultPosition, width = 860, height = 600, storage } = options;

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (storageKey) {
      const stored = readStoredFloatingPosition(storageKey, width, height, undefined, undefined, storage);
      if (stored) return stored;
    }
    if (defaultPosition) {
      return defaultPosition;
    }
    return computeInitialFloatingPosition(width, height);
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const resetPosition = useCallback(() => {
    const center = computeInitialFloatingPosition(width, height);
    setPosition(center);
    if (storageKey) {
      saveStoredFloatingPosition(storageKey, center, storage);
    }
  }, [width, height, storageKey, storage]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // Only drag with primary mouse button
      if (e.button !== 0) return;

      // Don't start drag if clicking an interactive element like button or input
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('textarea'))
      ) {
        return;
      }

      e.preventDefault();
      setIsDragging(true);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: position.x,
        initialY: position.y,
      };
    },
    [position.x, position.y],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      const maxX = Math.max(0, window.innerWidth - 120);
      const maxY = Math.max(0, window.innerHeight - 80);

      const nextX = clampCoordinate(dragRef.current.initialX + deltaX, 0, maxX);
      const nextY = clampCoordinate(dragRef.current.initialY + deltaY, 0, maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      setPosition((curr) => {
        if (storageKey) {
          saveStoredFloatingPosition(storageKey, curr, storage);
        }
        return curr;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
    };
  }, [isDragging, storageKey, storage]);

  return {
    position,
    handlePointerDown,
    isDragging,
    resetPosition,
    setPosition,
  };
}

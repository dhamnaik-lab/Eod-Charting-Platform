import { useEffect, useRef, type ReactNode } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { useWindowStore } from '@/store/windowStore';
import './corporateActionManagedWindow.css';

export const CORPORATE_ACTION_NORMAL_WINDOW_ID = 'corporate-action-normal';
export const CORPORATE_ACTION_MAINTENANCE_WINDOW_ID = 'corporate-action-maintenance';

export interface CorporateActionManagedWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  openRequestCount: number;
  children: ReactNode;
}

export function CorporateActionManagedWindow({
  id,
  title,
  onClose,
  openRequestCount,
  children,
}: CorporateActionManagedWindowProps) {
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const unregisterWindow = useWindowStore((state) => state.unregisterWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const maximizeWindow = useWindowStore((state) => state.maximizeWindow);
  const windowState = useWindowStore((state) => state.windows[id]);
  const mountedRef = useRef(false);
  const lastOpenRequestCountRef = useRef(openRequestCount);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    const width = Math.max(320, Math.min(1200, viewportWidth - 48));
    const height = Math.max(320, Math.min(760, viewportHeight - 48));

    registerWindow({
      id,
      title,
      bounds: {
        x: Math.max(0, Math.floor((viewportWidth - width) / 2)),
        y: Math.max(0, Math.floor((viewportHeight - height) / 2)),
        width,
        height,
      },
      minWidth: Math.min(720, width),
      minHeight: Math.min(480, height),
    });
    openWindow(id);
    maximizeWindow(id);
    lastOpenRequestCountRef.current = openRequestCount;
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      unregisterWindow(id);
    };
  }, [id, title, registerWindow, unregisterWindow, openWindow, maximizeWindow]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (lastOpenRequestCountRef.current === openRequestCount) {
      return;
    }

    lastOpenRequestCountRef.current = openRequestCount;
    openWindow(id);
  }, [id, openRequestCount, openWindow]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    if (!windowState) {
      return;
    }

    if (windowState.isOpen) {
      return;
    }

    onCloseRef.current();
  }, [windowState]);

  return (
    <FloatingWindow
      id={id}
      onClose={onClose}
      className="corporate-action-managed-window"
      preserveChildrenWhenMinimized
    >
      {children}
    </FloatingWindow>
  );
}
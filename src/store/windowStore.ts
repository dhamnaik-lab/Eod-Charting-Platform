import { create } from 'zustand';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingWindowState {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  bounds: WindowBounds;
  previousBounds?: WindowBounds; // Bounds before maximize
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface WindowStoreState {
  windows: Record<string, FloatingWindowState>;
  activeWindowId: string | null;
  registerWindow: (window: Omit<FloatingWindowState, 'zIndex' | 'isMinimized' | 'isMaximized' | 'isOpen'>) => void;
  unregisterWindow: (id: string) => void;
  openWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: Partial<WindowBounds>) => void;
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  windows: {},
  activeWindowId: null,

  registerWindow: (windowConfig) =>
    set((state) => {
      if (state.windows[windowConfig.id]) return state;

      const maxZIndex = Object.values(state.windows).reduce((max, w) => Math.max(max, w.zIndex), 100);

      return {
        windows: {
          ...state.windows,
          [windowConfig.id]: {
            ...windowConfig,
            isOpen: false,
            isMinimized: false,
            isMaximized: false,
            zIndex: maxZIndex + 1,
          },
        },
      };
    }),

  unregisterWindow: (id) =>
    set((state) => {
      if (!state.windows[id]) return state;
      const { [id]: _, ...remainingWindows } = state.windows;
      return {
        windows: remainingWindows,
        activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
      };
    }),

  openWindow: (id) => {
    if (!get().windows[id]) return;
    get().focusWindow(id);
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], isOpen: true, isMinimized: false },
      },
    }));
  },

  closeWindow: (id) =>
    set((state) => {
      if (!state.windows[id]) return state;
      return {
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id], isOpen: false },
        },
      };
    }),

  focusWindow: (id) =>
    set((state) => {
      if (!state.windows[id]) return state;

      const maxZIndex = Object.values(state.windows).reduce((max, w) => Math.max(max, w.zIndex), 100);

      return {
        activeWindowId: id,
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id], zIndex: maxZIndex + 1 },
        },
      };
    }),

  moveWindow: (id, x, y) =>
    set((state) => {
      if (!state.windows[id]) return state;
      return {
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            bounds: { ...state.windows[id].bounds, x, y },
          },
        },
      };
    }),

  resizeWindow: (id, width, height) =>
    set((state) => {
      const win = state.windows[id];
      if (!win) return state;

      let nextWidth = Math.max(win.minWidth, width);
      let nextHeight = Math.max(win.minHeight, height);

      if (win.maxWidth) nextWidth = Math.min(nextWidth, win.maxWidth);
      if (win.maxHeight) nextHeight = Math.min(nextHeight, win.maxHeight);

      return {
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            bounds: {
              ...win.bounds,
              width: nextWidth,
              height: nextHeight,
            },
          },
        },
      };
    }),

  maximizeWindow: (id) =>
    set((state) => {
      const window = state.windows[id];
      if (!window || window.isMaximized) return state;

      return {
        windows: {
          ...state.windows,
          [id]: {
            ...window,
            isMaximized: true,
            isMinimized: false,
            previousBounds: { ...window.bounds },
          },
        },
      };
    }),

  restoreWindow: (id) =>
    set((state) => {
      const window = state.windows[id];
      if (!window) return state;

      return {
        windows: {
          ...state.windows,
          [id]: {
            ...window,
            isMaximized: false,
            isMinimized: false,
            bounds: window.previousBounds ?? window.bounds,
          },
        },
      };
    }),

  minimizeWindow: (id) =>
    set((state) => {
      if (!state.windows[id]) return state;
      return {
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id], isMinimized: true },
        },
      };
    }),

  updateWindowBounds: (id, newBounds) =>
    set((state) => {
      if (!state.windows[id]) return state;
      return {
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id],
            bounds: { ...state.windows[id].bounds, ...newBounds },
          },
        },
      };
    }),
}));

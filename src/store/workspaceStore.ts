import { create } from 'zustand';

const SIDEBAR_WIDTH_KEY = 'eod-chart.sidebar.width.v1';
const SIDEBAR_COLLAPSED_KEY = 'eod-chart.sidebar.collapsed.v1';
const SIDEBAR_PINNED_KEY = 'eod-chart.sidebar.pinned.v1';
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 320;

interface WorkspaceStoreState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  sidebarPinned: boolean;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarPinned: (pinned: boolean) => void;
  toggleSidebarPinned: () => void;
}

function clampSidebarWidth(width: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(width)));
}

function writeStorageValue(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}

function readStoredSidebarWidth(): number {
  if (typeof window === 'undefined') {
    return 228;
  }

  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return clampSidebarWidth(Number.isFinite(stored) ? stored : 228);
}

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
}

function readStoredSidebarPinned(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const stored = window.localStorage.getItem(SIDEBAR_PINNED_KEY);
  return stored === null ? true : stored === '1';
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  sidebarWidth: readStoredSidebarWidth(),
  sidebarCollapsed: readStoredSidebarCollapsed(),
  sidebarPinned: readStoredSidebarPinned(),
  setSidebarWidth: (width) => {
    const nextWidth = clampSidebarWidth(width);
    writeStorageValue(SIDEBAR_WIDTH_KEY, String(nextWidth));
    set({ sidebarWidth: nextWidth });
  },
  setSidebarCollapsed: (collapsed) => {
    writeStorageValue(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebarCollapsed: () => {
    const nextCollapsed = !get().sidebarCollapsed;
    writeStorageValue(SIDEBAR_COLLAPSED_KEY, nextCollapsed ? '1' : '0');
    set({ sidebarCollapsed: nextCollapsed });
  },
  setSidebarPinned: (pinned) => {
    writeStorageValue(SIDEBAR_PINNED_KEY, pinned ? '1' : '0');
    set({ sidebarPinned: pinned });
  },
  toggleSidebarPinned: () => {
    const nextPinned = !get().sidebarPinned;
    writeStorageValue(SIDEBAR_PINNED_KEY, nextPinned ? '1' : '0');
    set({ sidebarPinned: nextPinned });
  },
}));

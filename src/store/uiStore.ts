import { create } from 'zustand';
import type { DrawingTool, ChartTheme, OHLCBar } from '@/engine/types';
import type { AppThemeId } from '@/features/app/themeService';
import { DEFAULT_APP_THEME_ID } from '@/features/app/themeService';
import type { OfficialWatchlistSourceId } from '@/features/watchlists/officialWatchlistProviders';
import type { ChartPatternGeometry } from '@/plugins/scanner/chartPatternTypes';
import type { InstrumentKey } from '@/platform';
import type { ScannerPatternMapEntry } from '@/plugins/scanner/scannerPatternMap';
import type { ScannerChartPriceBasis } from '@/plugins/scanner/scannerChartPriceBasis';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';

const MAGNET_ENABLED_KEY = 'eod-chart.magnet.enabled.v1';
const FAVORITE_TOOLS_KEY = 'eod-chart.favorite-tools.v1';
const FAVORITE_TOOLBAR_VISIBLE_KEY = 'eod-chart.favorite-toolbar.visible.v1';
const FAVORITE_TOOLBAR_ORIENTATION_KEY = 'eod-chart.favorite-toolbar.orientation.v1';

export const DEFAULT_FAVORITE_TOOLS: DrawingTool[] = [
  'trendline',
  'horizontalRay',
  'fib',
  'rect',
  'longPosition',
  'arrow',
  'measure',
];

function readStoredMagnetEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(MAGNET_ENABLED_KEY) === '1';
}

function writeStoredMagnetEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(MAGNET_ENABLED_KEY, enabled ? '1' : '0');
}

function readStoredFavoriteTools(): DrawingTool[] {
  if (typeof window === 'undefined') return DEFAULT_FAVORITE_TOOLS;
  try {
    const raw = window.localStorage.getItem(FAVORITE_TOOLS_KEY);
    if (!raw) return DEFAULT_FAVORITE_TOOLS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FAVORITE_TOOLS;
  } catch {
    return DEFAULT_FAVORITE_TOOLS;
  }
}

function writeStoredFavoriteTools(tools: DrawingTool[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITE_TOOLS_KEY, JSON.stringify(tools));
  } catch {}
}

function readStoredFavoriteToolbarVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(FAVORITE_TOOLBAR_VISIBLE_KEY) === '1';
}

function writeStoredFavoriteToolbarVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITE_TOOLBAR_VISIBLE_KEY, visible ? '1' : '0');
}

function readStoredFavoriteToolbarOrientation(): 'horizontal' | 'vertical' {
  if (typeof window === 'undefined') return 'horizontal';
  return window.localStorage.getItem(FAVORITE_TOOLBAR_ORIENTATION_KEY) === 'vertical'
    ? 'vertical'
    : 'horizontal';
}

function writeStoredFavoriteToolbarOrientation(orientation: 'horizontal' | 'vertical'): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITE_TOOLBAR_ORIENTATION_KEY, orientation);
}

import type { ScannerWorkspaceSection } from '@/plugins/scanner/scannerWorkspace';

export type SettingsDialogSection =
  | 'profile'
  | 'general'
  | 'database-defaults'
  | 'chart-colors'
  | 'plugins'
  | 'maintenance';

export interface UiFlagsState {
  sidebarVisible: boolean;
  ohlcvBarVisible: boolean;
  statusBarVisible: boolean;
}

export interface ImportDialogState {
  open: boolean;
  filePaths: string[];
  openRequestCount: number;
}

export interface OfficialWatchlistImportDialogState {
  open: boolean;
  sourceId: OfficialWatchlistSourceId | null;
  openRequestCount: number;
}

export interface ScannerChartLevel {
  label: string;
  value: number;
}

export interface ScannerChartOverlay {
  id: string;
  instrument: InstrumentKey;
  date: string;
  scannerName: string;
  scannerId?: string;
  priceBasis?: ScannerChartPriceBasis;
  databasePath?: string | null;
  contextBars?: number;
  sourceBars?: readonly OHLCBar[];
  timeframe?: WorkspaceTimeframe;
  direction?: 'bullish' | 'bearish' | 'neutral';
  score?: number;
  levels: ScannerChartLevel[];
  geometry?: ChartPatternGeometry;
  editable?: boolean;
}

export interface ScannerPatternMapState {
  entries: ScannerPatternMapEntry[];
  selectedEntryId: string | null;
  showVisibleGeometry: boolean;
}

export type ChartScreenshotAction = 'save' | 'copy';

export interface ChartScreenshotRequest {
  action: ChartScreenshotAction;
  requestCount: number;
}

interface UiStoreState {
  uiFlags: UiFlagsState;
  importDialog: ImportDialogState;
  officialWatchlistImportDialog: OfficialWatchlistImportDialogState;
  currentTheme: AppThemeId;
  customChartColors: Partial<ChartTheme> | null;
  compareDialogOpen: boolean;
  customFormulaDialogOpen: boolean;
  chartScreenshotRequest: ChartScreenshotRequest | null;
  drawingPropertiesDrawingId: string | null;
  quoteEditorOpen: boolean;
  quoteEditorOpenRequestCount: number;
  mergeSymbolsOpen: boolean;
  mergeSymbolsOpenRequestCount: number;
  corporateActionOpen: boolean;
  corporateActionOpenRequestCount: number;
  bhavcopyWindowOpen: boolean;
  bhavcopyOpenRequestCount: number;
  scannerWindowOpen: boolean;
  scannerOpenRequestCount: number;
  alertManagerOpen: boolean;
  alertManagerOpenRequestCount: number;
  scannerChartOverlay: ScannerChartOverlay | null;
  scannerPatternMap: ScannerPatternMapState | null;
  deleteDatabaseDialogOpen: boolean;
  recentDatabasesDialogOpen: boolean;
  recentDatabasesOpenRequestCount: number;
  layoutManagerDialogOpen: boolean;
  watchlistManagerDialogOpen: boolean;
  watchlistManagerOpenRequestCount: number;
  indicatorPickerOpen: boolean;
  indicatorPickerOpenRequestCount: number;
  settingsDialogOpen: boolean;
  settingsOpenRequestCount: number;
  settingsDialogRequestedSection: SettingsDialogSection | null;
  binaryEodParityOpen: boolean;
  binaryEodParityOpenRequestCount: number;
  faqDialogOpen: boolean;
  faqOpenRequestCount: number;
  keyboardShortcutsDialogOpen: boolean;
  keyboardShortcutsOpenRequestCount: number;
  aboutDialogOpen: boolean;
  aboutOpenRequestCount: number;
  commandPaletteOpen: boolean;
  commandPaletteMode: 'all' | 'symbol';
  signalSettingsDialogOpen: boolean;
  signalRules: import('@/engine/types').ChartSignalRule[];
  openSignalSettingsDialog: () => void;
  closeSignalSettingsDialog: () => void;
  setSignalRules: (rules: import('@/engine/types').ChartSignalRule[]) => void;
  syncedCrosshairDate: string | null;
  crosshairSyncEnabled: boolean;
  setSyncedCrosshairDate: (date: string | null) => void;
  toggleCrosshairSync: () => void;
  symbolLinkEnabled: boolean;
  toggleSymbolLink: () => void;
  activeDrawingTool: DrawingTool;
  magnetEnabled: boolean;
  favoriteDrawingTools: DrawingTool[];
  favoriteToolbarVisible: boolean;
  favoriteToolbarOrientation: 'horizontal' | 'vertical';
  toggleFavoriteDrawingTool: (tool: DrawingTool) => void;
  setFavoriteDrawingTools: (tools: DrawingTool[]) => void;
  toggleFavoriteToolbar: () => void;
  setFavoriteToolbarVisible: (visible: boolean) => void;
  setFavoriteToolbarOrientation: (orientation: 'horizontal' | 'vertical') => void;
  toggleSidebar: () => void;
  toggleOhlcvBar: () => void;
  toggleStatusBar: () => void;
  setCurrentTheme: (theme: AppThemeId) => void;
  setCustomChartColors: (colors: Partial<ChartTheme> | null) => void;
  openImportDialog: (filePaths?: string[] | null) => void;
  closeImportDialog: () => void;
  openOfficialWatchlistImportDialog: (sourceId?: OfficialWatchlistSourceId | null) => void;
  closeOfficialWatchlistImportDialog: () => void;
  openQuoteEditor: () => void;
  closeQuoteEditor: () => void;
  openMergeSymbols: () => void;
  closeMergeSymbols: () => void;
  openCorporateAction: () => void;
  closeCorporateAction: () => void;
  openBhavcopyWindow: () => void;
  closeBhavcopyWindow: () => void;
  scannerRequestedSection: ScannerWorkspaceSection | null;
  openScannerWindow: (section?: ScannerWorkspaceSection) => void;
  consumeScannerRequestedSection: () => void;
  closeScannerWindow: () => void;
  openAlertManager: () => void;
  closeAlertManager: () => void;
  showScannerChartOverlay: (overlay: ScannerChartOverlay) => void;
  clearScannerChartOverlay: () => void;
  showScannerPatternMap: (entries: ScannerPatternMapEntry[]) => void;
  clearScannerPatternMap: () => void;
  selectScannerPatternMapEntry: (entryId: string | null) => void;
  setScannerPatternMapVisibleGeometry: (visible: boolean) => void;
  openDeleteDatabaseDialog: () => void;
  closeDeleteDatabaseDialog: () => void;
  openRecentDatabasesDialog: () => void;
  closeRecentDatabasesDialog: () => void;
  openLayoutManagerDialog: () => void;
  closeLayoutManagerDialog: () => void;
  openWatchlistManagerDialog: () => void;
  closeWatchlistManagerDialog: () => void;
  openIndicatorPicker: () => void;
  closeIndicatorPicker: () => void;
  openSettingsDialog: (section?: SettingsDialogSection | null) => void;
  closeSettingsDialog: () => void;
  openBinaryEodParity: () => void;
  closeBinaryEodParity: () => void;
  openFaqDialog: () => void;
  closeFaqDialog: () => void;
  openKeyboardShortcutsDialog: () => void;
  closeKeyboardShortcutsDialog: () => void;
  openAboutDialog: () => void;
  closeAboutDialog: () => void;
  openCompareDialog: () => void;
  closeCompareDialog: () => void;
  openCustomFormulaDialog: () => void;
  closeCustomFormulaDialog: () => void;
  requestChartScreenshot: (action: ChartScreenshotAction) => void;
  setCommandPaletteOpen: (open: boolean, mode?: 'all' | 'symbol') => void;
  toggleCommandPalette: (mode?: 'all' | 'symbol') => void;
  setDrawingTool: (tool: DrawingTool) => void;
  setMagnetEnabled: (enabled: boolean) => void;
  toggleMagnet: () => void;
  openDrawingProperties: (drawingId: string | null) => void;
  closeDrawingProperties: () => void;
  resetDrawingInteraction: () => void;
}

function createInitialUiFlags(): UiFlagsState {
  return {
    sidebarVisible: true,
    ohlcvBarVisible: true,
    statusBarVisible: true,
  };
}

function createInitialImportDialog(): ImportDialogState {
  return {
    open: false,
    filePaths: [],
    openRequestCount: 0,
  };
}

function createInitialOfficialWatchlistImportDialog(): OfficialWatchlistImportDialogState {
  return {
    open: false,
    sourceId: null,
    openRequestCount: 0,
  };
}

export const useUiStore = create<UiStoreState>((set, get) => ({
  uiFlags: createInitialUiFlags(),
  importDialog: createInitialImportDialog(),
  officialWatchlistImportDialog: createInitialOfficialWatchlistImportDialog(),
  currentTheme: DEFAULT_APP_THEME_ID,
  customChartColors: null,
  compareDialogOpen: false,
  customFormulaDialogOpen: false,
  chartScreenshotRequest: null,
  drawingPropertiesDrawingId: null,
  quoteEditorOpen: false,
  quoteEditorOpenRequestCount: 0,
  mergeSymbolsOpen: false,
  mergeSymbolsOpenRequestCount: 0,
  corporateActionOpen: false,
  corporateActionOpenRequestCount: 0,
  bhavcopyWindowOpen: false,
  bhavcopyOpenRequestCount: 0,
  scannerWindowOpen: false,
  scannerOpenRequestCount: 0,
  scannerRequestedSection: null,
  alertManagerOpen: false,
  alertManagerOpenRequestCount: 0,
  scannerChartOverlay: null,
  scannerPatternMap: null,
  deleteDatabaseDialogOpen: false,
  recentDatabasesDialogOpen: false,
  recentDatabasesOpenRequestCount: 0,
  layoutManagerDialogOpen: false,
  watchlistManagerDialogOpen: false,
  watchlistManagerOpenRequestCount: 0,
  indicatorPickerOpen: false,
  indicatorPickerOpenRequestCount: 0,
  settingsDialogOpen: false,
  settingsOpenRequestCount: 0,
  settingsDialogRequestedSection: null,
  binaryEodParityOpen: false,
  binaryEodParityOpenRequestCount: 0,
  faqDialogOpen: false,
  faqOpenRequestCount: 0,
  keyboardShortcutsDialogOpen: false,
  keyboardShortcutsOpenRequestCount: 0,
  aboutDialogOpen: false,
  aboutOpenRequestCount: 0,
  commandPaletteOpen: false,
  commandPaletteMode: 'all',
  signalSettingsDialogOpen: false,
  signalRules: [],
  openSignalSettingsDialog: () => set({ signalSettingsDialogOpen: true }),
  closeSignalSettingsDialog: () => set({ signalSettingsDialogOpen: false }),
  setSignalRules: (rules) => set({ signalRules: rules }),
  syncedCrosshairDate: null,
  crosshairSyncEnabled: false,
  setSyncedCrosshairDate: (date) => set({ syncedCrosshairDate: date }),
  toggleCrosshairSync: () => set((state) => ({ crosshairSyncEnabled: !state.crosshairSyncEnabled })),
  symbolLinkEnabled: false,
  toggleSymbolLink: () => set((state) => ({ symbolLinkEnabled: !state.symbolLinkEnabled })),
  activeDrawingTool: 'cursor',
  magnetEnabled: readStoredMagnetEnabled(),
  toggleSidebar: () =>
    set((state) => ({ uiFlags: { ...state.uiFlags, sidebarVisible: !state.uiFlags.sidebarVisible } })),
  toggleOhlcvBar: () =>
    set((state) => ({ uiFlags: { ...state.uiFlags, ohlcvBarVisible: !state.uiFlags.ohlcvBarVisible } })),
  toggleStatusBar: () =>
    set((state) => ({ uiFlags: { ...state.uiFlags, statusBarVisible: !state.uiFlags.statusBarVisible } })),
  setCurrentTheme: (theme) => set({ currentTheme: theme }),
  setCustomChartColors: (colors) => set({ customChartColors: colors }),
  openImportDialog: (filePaths) =>
    set((state) => ({
      importDialog: {
        open: true,
        filePaths: filePaths ?? state.importDialog.filePaths,
        openRequestCount: state.importDialog.openRequestCount + 1,
      },
    })),
  closeImportDialog: () => set((state) => ({
    importDialog: {
      ...state.importDialog,
      open: false,
    }
  })),
  openOfficialWatchlistImportDialog: (sourceId = 'nse-sectors') =>
    set((state) => ({
      officialWatchlistImportDialog: {
        open: true,
        sourceId: sourceId ?? state.officialWatchlistImportDialog.sourceId,
        openRequestCount: state.officialWatchlistImportDialog.openRequestCount + 1,
      },
    })),
  closeOfficialWatchlistImportDialog: () =>
    set((state) => ({
      officialWatchlistImportDialog: {
        ...state.officialWatchlistImportDialog,
        open: false,
      }
    })),
  openQuoteEditor: () => set((state) => ({ quoteEditorOpen: true, quoteEditorOpenRequestCount: state.quoteEditorOpenRequestCount + 1 })),
  closeQuoteEditor: () => set({ quoteEditorOpen: false }),
  openMergeSymbols: () => set((state) => ({ mergeSymbolsOpen: true, mergeSymbolsOpenRequestCount: state.mergeSymbolsOpenRequestCount + 1 })),
  closeMergeSymbols: () => set({ mergeSymbolsOpen: false }),
  openCorporateAction: () =>
    set((state) => ({
      corporateActionOpen: true,
      corporateActionOpenRequestCount: state.corporateActionOpenRequestCount + 1,
    })),
  closeCorporateAction: () => set({ corporateActionOpen: false }),
  openBhavcopyWindow: () => set((state) => ({ bhavcopyWindowOpen: true, bhavcopyOpenRequestCount: state.bhavcopyOpenRequestCount + 1 })),
  closeBhavcopyWindow: () => set({ bhavcopyWindowOpen: false }),
  openScannerWindow: (section) =>
    set((state) => ({
      scannerWindowOpen: true,
      scannerOpenRequestCount: state.scannerOpenRequestCount + 1,
      scannerRequestedSection: section ?? null,
    })),
  consumeScannerRequestedSection: () => set({ scannerRequestedSection: null }),
  closeScannerWindow: () => set({ scannerWindowOpen: false }),
  openAlertManager: () =>
    set((state) => ({
      alertManagerOpen: true,
      alertManagerOpenRequestCount: state.alertManagerOpenRequestCount + 1,
    })),
  closeAlertManager: () => set({ alertManagerOpen: false }),
  showScannerChartOverlay: (overlay) => set({ scannerChartOverlay: overlay }),
  clearScannerChartOverlay: () => set({ scannerChartOverlay: null }),
  showScannerPatternMap: (entries) =>
    set((state) => ({
      scannerPatternMap: {
        entries,
        selectedEntryId: state.scannerPatternMap?.selectedEntryId && entries.some((entry) => entry.id === state.scannerPatternMap?.selectedEntryId)
          ? state.scannerPatternMap.selectedEntryId
          : null,
        showVisibleGeometry: false,
      },
    })),
  clearScannerPatternMap: () => set({ scannerPatternMap: null }),
  selectScannerPatternMapEntry: (entryId) =>
    set((state) => ({
      scannerPatternMap: state.scannerPatternMap ? { ...state.scannerPatternMap, selectedEntryId: entryId } : null,
    })),
  setScannerPatternMapVisibleGeometry: (visible) =>
    set((state) => ({
      scannerPatternMap: state.scannerPatternMap ? { ...state.scannerPatternMap, showVisibleGeometry: visible } : null,
    })),
  openDeleteDatabaseDialog: () => set({ deleteDatabaseDialogOpen: true }),
  closeDeleteDatabaseDialog: () => set({ deleteDatabaseDialogOpen: false }),
  openRecentDatabasesDialog: () =>
    set((state) => ({
      recentDatabasesDialogOpen: true,
      recentDatabasesOpenRequestCount: state.recentDatabasesOpenRequestCount + 1,
    })),
  closeRecentDatabasesDialog: () => set({ recentDatabasesDialogOpen: false }),
  openLayoutManagerDialog: () => set({ layoutManagerDialogOpen: true }),
  closeLayoutManagerDialog: () => set({ layoutManagerDialogOpen: false }),
  openWatchlistManagerDialog: () =>
    set((state) => ({
      watchlistManagerDialogOpen: true,
      watchlistManagerOpenRequestCount: state.watchlistManagerOpenRequestCount + 1,
    })),
  closeWatchlistManagerDialog: () => set({ watchlistManagerDialogOpen: false }),
  openIndicatorPicker: () =>
    set((state) => ({
      indicatorPickerOpen: true,
      indicatorPickerOpenRequestCount: state.indicatorPickerOpenRequestCount + 1,
    })),
  closeIndicatorPicker: () => set({ indicatorPickerOpen: false }),
  openSettingsDialog: (section = null) =>
    set((state) => ({
      settingsDialogOpen: true,
      settingsOpenRequestCount: state.settingsOpenRequestCount + 1,
      settingsDialogRequestedSection: section,
    })),
  closeSettingsDialog: () =>
    set({
      settingsDialogOpen: false,
      settingsDialogRequestedSection: null,
    }),
  openBinaryEodParity: () => set((state) => ({ binaryEodParityOpen: true, binaryEodParityOpenRequestCount: state.binaryEodParityOpenRequestCount + 1 })),
  closeBinaryEodParity: () => set({ binaryEodParityOpen: false }),
  openFaqDialog: () => set((state) => ({ faqDialogOpen: true, faqOpenRequestCount: state.faqOpenRequestCount + 1 })),
  closeFaqDialog: () => set({ faqDialogOpen: false }),
  openKeyboardShortcutsDialog: () =>
    set((state) => ({
      keyboardShortcutsDialogOpen: true,
      keyboardShortcutsOpenRequestCount: state.keyboardShortcutsOpenRequestCount + 1,
    })),
  closeKeyboardShortcutsDialog: () => set({ keyboardShortcutsDialogOpen: false }),
  openAboutDialog: () => set((state) => ({ aboutDialogOpen: true, aboutOpenRequestCount: state.aboutOpenRequestCount + 1 })),
  closeAboutDialog: () => set({ aboutDialogOpen: false }),
  openCompareDialog: () => set({ compareDialogOpen: true }),
  closeCompareDialog: () => set({ compareDialogOpen: false }),
  openCustomFormulaDialog: () => set({ customFormulaDialogOpen: true }),
  closeCustomFormulaDialog: () => set({ customFormulaDialogOpen: false }),
  requestChartScreenshot: (action) =>
    set((state) => ({
      chartScreenshotRequest: {
        action,
        requestCount: (state.chartScreenshotRequest?.requestCount ?? 0) + 1,
      },
    })),
  setCommandPaletteOpen: (open, mode = 'all') =>
    set({
      commandPaletteOpen: open,
      commandPaletteMode: mode,
    }),
  toggleCommandPalette: (mode = 'all') =>
    set((state) => ({
      commandPaletteOpen: !state.commandPaletteOpen,
      commandPaletteMode: mode,
    })),
  setDrawingTool: (tool) =>
    set({
      activeDrawingTool: tool,
      drawingPropertiesDrawingId: null,
    }),
  setMagnetEnabled: (enabled) => {
    writeStoredMagnetEnabled(enabled);
    set({ magnetEnabled: enabled });
  },
  toggleMagnet: () => {
    const nextEnabled = !get().magnetEnabled;
    writeStoredMagnetEnabled(nextEnabled);
    set({ magnetEnabled: nextEnabled });
  },
  favoriteDrawingTools: readStoredFavoriteTools(),
  favoriteToolbarVisible: readStoredFavoriteToolbarVisible(),
  favoriteToolbarOrientation: readStoredFavoriteToolbarOrientation(),
  toggleFavoriteDrawingTool: (tool) => {
    const current = get().favoriteDrawingTools;
    const next = current.includes(tool)
      ? current.filter((t) => t !== tool)
      : [...current, tool];
    writeStoredFavoriteTools(next);
    set({ favoriteDrawingTools: next });
  },
  setFavoriteDrawingTools: (tools) => {
    writeStoredFavoriteTools(tools);
    set({ favoriteDrawingTools: tools });
  },
  toggleFavoriteToolbar: () => {
    const next = !get().favoriteToolbarVisible;
    writeStoredFavoriteToolbarVisible(next);
    set({ favoriteToolbarVisible: next });
  },
  setFavoriteToolbarVisible: (visible) => {
    writeStoredFavoriteToolbarVisible(visible);
    set({ favoriteToolbarVisible: visible });
  },
  setFavoriteToolbarOrientation: (orientation) => {
    writeStoredFavoriteToolbarOrientation(orientation);
    set({ favoriteToolbarOrientation: orientation });
  },
  openDrawingProperties: (drawingId) =>
    set({
      drawingPropertiesDrawingId: drawingId,
    }),
  closeDrawingProperties: () => set({ drawingPropertiesDrawingId: null }),
  resetDrawingInteraction: () =>
    set({
      activeDrawingTool: 'cursor',
      drawingPropertiesDrawingId: null,
    }),
}));

export function getUiStoreState(): UiStoreState {
  return useUiStore.getState();
}

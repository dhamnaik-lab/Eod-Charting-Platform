import type {
  OfficialWatchlistSourceId,
} from '@/features/watchlists/officialWatchlistProviders';
import type {
  IndicatorCatalogId,
} from '@/indicators/catalog';
import type {
  RefreshSnapshotOptions,
} from '@/features/workspace/databaseSnapshotService';
import type {
  ChartType,
  ChartCompareOverlay,
  ChartDrawing,
  ChartDrawingScopes,
  ChartEventVisibility,
  ChartVisualSettings,
  ChartMarkerEventType,
  ChartIndicator,
  ChartValueLabelSettings,
  ChartMarkerEvent,
  ChartPaneId,
  CollapsedIndicatorPanes,
  FutureMarginMode,
  IndicatorPaneHeights,
  OHLCBar,
  OverlayIndicator,
  PaneScaleOverrides,
  PaneScaleRange,
  RenkoSettings,
  Viewport,
} from '@/engine/types';
import type {
  AppSnapshot,
  ImportResult,
  InstrumentKey,
  InstrumentSummary,
  SymbolSeriesFilter,
} from '@/platform';
import type { SymbolExchangeFilter } from '@/types/desktop';
import type {
  WorkspaceLayoutMode,
  WorkspaceSheetLike,
  WorkspaceTimeframe,
} from '@/features/workspace/workspacePersistence';
import type { CustomFormulaIndicatorInput } from '@/modules/formulaEngine/customFormulaEngine';

export type Timeframe = WorkspaceTimeframe;
export type LayoutMode = WorkspaceLayoutMode;

export interface ProgressState {
  running: boolean;
  progress: number;
  message: string;
  result?: ImportResult | null;
  error?: string | null;
}

export interface DownloadProgressState {
  running: boolean;
  progress: number;
  message: string;
  error?: string | null;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

export interface Sheet extends WorkspaceSheetLike {}

export interface ChartTabState {
  id: string;
  title: string;
  instrument: InstrumentKey | null;
  instrumentMeta: InstrumentSummary | null;
  requestedInstrument: InstrumentKey | null;
  rawBars: OHLCBar[];
  displayBars: OHLCBar[];
  events: ChartMarkerEvent[];
  compareOverlays: ChartCompareOverlay[];
  timeframe: Timeframe;
  chartType: ChartType;
  renkoBrickSize: number;
  renkoSettings: RenkoSettings;
  visualSettings: ChartVisualSettings;
  viewport: Viewport;
  hoverBar: OHLCBar | null;
  visibleBarCount: number;
  indicators: OverlayIndicator[];
  drawings: ChartDrawing[];
  drawingScopes: ChartDrawingScopes;
  selectedDrawingId: string | null;
  indicatorPaneHeight: number;
  indicatorPaneHeights: IndicatorPaneHeights;
  collapsedIndicatorPanes: CollapsedIndicatorPanes;
  paneScaleOverrides: PaneScaleOverrides;
  logScale: boolean;
  showVolume: boolean;
  invertPriceScale: boolean;
  showValueLabels: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis: boolean;
  futureMarginMode: FutureMarginMode;
  loadedAdjusted: boolean | null;
  loadedDividendAdjusted: boolean | null;
  loadedRightsAdjusted: boolean | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  layoutMode: LayoutMode;
}

export interface ChartStoreState {
  snapshot: AppSnapshot | null;
  chartTabs: ChartTabState[];
  activeChartTabId: string;
  workspaceLayoutMode: LayoutMode;
  maximizedChartTabId: string | null;
  isLoadingBars: boolean;
  adjustedMode: boolean;
  chartEventVisibility: ChartEventVisibility;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  searchQuery: string;
  searchResults: InstrumentSummary[];
  symbolBrowserQuery: string;
  symbolExchangeFilter: SymbolExchangeFilter;
  symbolSeriesFilter: SymbolSeriesFilter;
  symbolBrowserItems: InstrumentSummary[];
  symbolBrowserLoadedDatabasePath: string | null;
  isSymbolBrowserLoading: boolean;
  selectedWatchlistId: number | null;
  isDatabaseTransitioning: boolean;
  databaseTransitionMessage: string | null;
  importProgress: ProgressState;
  downloadProgress: DownloadProgressState;
  /** Persistent background autosave error; null after a confirmed recovery. */
  workspaceAutosaveError: string | null;
  setLayoutMode: (mode: LayoutMode) => void;
  saveCurrentAsSheet: (tabId: string, name: string) => void;
  loadSheet: (tabId: string, sheetId: string) => void;
  deleteSheet: (tabId: string, sheetId: string) => void;
  renameSheet: (tabId: string, sheetId: string, newName: string) => void;
  saveCurrentActiveDatabase: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
  setAdjustedMode: (adjusted: boolean) => void;
  toggleChartEventVisibility: (eventType: ChartMarkerEventType) => void;
  setIncludeDividendAdjustments: (enabled: boolean) => void;
  setIncludeRightsAdjustments: (enabled: boolean) => void;
  toggleAdjustedMode: () => void;
  init: () => Promise<void>;
  refreshSnapshot: (options?: RefreshSnapshotOptions) => Promise<void>;
  createDatabaseInteractive: (requestedMode?: 'hybrid' | 'binary') => Promise<void>;
  openDatabaseInteractive: () => Promise<void>;
  activateDatabasePath: (filePath: string) => Promise<void>;
  closeDatabase: () => Promise<void>;
  createChartTab: () => void;
  duplicateChartTab: (tabId: string) => void;
  activateChartTab: (tabId: string) => void;
  toggleChartMaximize: (tabId: string) => void;
  closeChartTab: (tabId: string) => void;
  loadInstrument: (
    key: InstrumentKey,
    meta?: InstrumentSummary | null,
    options?: { forceReload?: boolean; preserveViewport?: boolean },
  ) => Promise<void>;
  navigateSymbol: (direction: 'next' | 'prev') => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setChartType: (chartType: ChartType) => void;
  setRenkoBrickSize: (size: number) => void;
  setRenkoSettings: (settings: Partial<RenkoSettings>) => void;
  setChartVisualSettings: (settings: Partial<ChartVisualSettings>) => void;
  applyChartSettingsDialog: (chartType: ChartType, renkoSettings: RenkoSettings) => string | null;
  syncViewport: (viewport: Viewport, tabId?: string | null) => void;
  scrollToViewportStart: (startIndex: number, tabId?: string | null) => void;
  nudgeViewport: (deltaBars: number) => void;
  zoomViewportByFactor: (factor: number, pivotIndex?: number) => void;
  resetViewport: () => void;
  setIndicatorPaneHeight: (height: number, paneId?: string | null, tabId?: string | null) => void;
  resetIndicatorPaneHeights: () => void;
  setIndicatorPaneCollapsed: (paneId: string, collapsed?: boolean) => void;
  moveIndicatorPane: (indicatorId: string, direction: 'up' | 'down') => void;
  setPaneScaleOverride: (paneId: ChartPaneId, range: PaneScaleRange | null, tabId?: string | null) => void;
  fitAllPanes: () => void;
  setLogScale: (enabled: boolean) => void;
  setShowVolume: (show: boolean) => void;
  setInvertPriceScale: (enabled: boolean) => void;
  setShowValueLabels: (show: boolean) => void;
  setValueLabelSettings: (settings: Partial<ChartValueLabelSettings>) => void;
  setShowLeftAxis: (show: boolean) => void;
  setFutureMarginMode: (mode: FutureMarginMode) => void;
  setSearchQuery: (query: string) => void;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  addCompareOverlay: (instrument: InstrumentSummary) => Promise<void>;
  removeCompareOverlay: (compareId: string) => void;
  setSymbolBrowserQuery: (query: string) => void;
  setSymbolExchangeFilter: (filter: SymbolExchangeFilter) => void;
  setSymbolSeriesFilter: (filter: SymbolSeriesFilter) => void;
  refreshSymbolBrowser: (query?: string) => Promise<void>;
  setHoverBar: (bar: OHLCBar | null, tabId?: string | null) => void;
  setVisibleBarCount: (count: number) => void;
  setImportProgress: (patch: Partial<ProgressState>) => void;
  setDownloadProgress: (patch: Partial<DownloadProgressState>) => void;
  triggerDownload: () => Promise<void>;
  loadWorkspaceFromLayout: (layoutData: string) => void;
  addIndicator: (kind: ChartIndicator['kind']) => void;
  addIndicatorCatalog: (catalogId: IndicatorCatalogId) => void;
  addCustomFormulaIndicator: (draft: CustomFormulaIndicatorInput) => void;
  updateIndicator: (indicator: OverlayIndicator) => void;
  removeIndicator: (indicatorId: string) => void;
  clearIndicators: () => void;
  selectDrawing: (drawingId: string | null, tabId?: string | null) => void;
  addDrawing: (drawing: ChartDrawing, tabId?: string | null) => void;
  updateDrawing: (drawing: ChartDrawing, tabId?: string | null) => void;
  toggleDrawingLock: (drawingId?: string | null) => void;
  deleteSelectedDrawing: () => void;
  clearDrawings: () => void;
  removeLastDrawing: () => void;
  createWatchlist: (name: string) => Promise<void>;
  renameWatchlist: (watchlistId: number, name: string) => Promise<void>;
  deleteWatchlist: (watchlistId: number) => Promise<void>;
  importOfficialWatchlists: (
    sourceId: OfficialWatchlistSourceId,
    groupIds: string[],
  ) => Promise<void>;
  updateOfficialWatchlist: (watchlistId: number) => Promise<void>;
  updateAllOfficialWatchlists: () => Promise<void>;
  selectWatchlist: (watchlistId: number | null) => void;
  addToWatchlist: (watchlistId: number, instrument: InstrumentKey) => Promise<void>;
  removeFromWatchlist: (watchlistId: number, instrument: InstrumentKey) => Promise<void>;
}

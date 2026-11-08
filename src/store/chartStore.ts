import { create } from 'zustand';
import {
  ensureIndicatorPaneHeights,
  pruneCollapsedIndicatorPanes,
  prunePaneScaleOverrides,
} from '@/features/charts/chartIndicatorPaneService';
import {
  createChartSearchController,
} from '@/features/charts/chartSearchController';
import {
  applyCompareOverlaysTimeframe,
} from '@/features/charts/compareOverlayService';
import {
  createInstrumentDataCache,
} from '@/features/charts/chartInstrumentHydrationService';
import {
  RENKO_BRICK_LIMIT_MESSAGE,
} from '@/features/charts/chartTypeTransformService';
import {
  createChartInstrumentCompareController,
} from '@/features/charts/chartInstrumentCompareController';
import {
  addTabDrawing,
  addTabIndicator,
  addTabIndicatorCatalog,
  addTabCustomFormulaIndicator,
  applyTimeframeToTab,
  clearTabDrawings,
  clearTabIndicators,
  deleteSelectedTabDrawing,
  fitAllTabPanes,
  moveTabIndicatorPane,
  nudgeTabViewport,
  removeLastTabDrawing,
  removeTabIndicator,
  resetTabIndicatorPaneHeights,
  resetTabViewport,
  scrollTabViewportToStart,
  selectTabDrawing,
  setTabChartType,
  setTabFutureMarginMode,
  setTabHoverBar,
  setTabIndicatorPaneCollapsed,
  setTabIndicatorPaneHeight,
  setTabInvertPriceScale,
  setTabLogScale,
  setTabPaneScaleOverride,
  setTabRenkoBrickSize,
  setTabRenkoSettings,
  setTabVisualSettings,
  setTabShowLeftAxis,
  setTabShowValueLabels,
  setTabShowVolume,
  setTabValueLabelSettings,
  setTabVisibleBarCount,
  syncTabViewport,
  toggleTabDrawingLock,
  updateTabDrawing,
  updateTabIndicator,
  zoomTabViewportByFactor,
} from '@/features/charts/chartTabStateMutationService';
import {
  createChartWorkspace,
} from '@/features/charts/chartTabWorkspaceService';
import { updateActiveTab } from '@/features/charts/chartActiveTabUpdateService';
import {
  createChartTabSessionController,
} from '@/features/charts/chartTabSessionController';
import {
  resolveSelectedWatchlistId,
} from '@/features/watchlists/watchlistOrchestrationService';
import {
  createWatchlistStoreController,
} from '@/features/watchlists/watchlistStoreController';
import {
  getDesktopApi,
  getDesktopShellApi,
  type CorporateActionType,
  type InstrumentKey,
  type InstrumentSummary,
  type SnapshotOptions,
} from '@/platform';
import type {
  ChartMarkerEventType,
  ChartDrawing,
  ChartIndicator,
  OHLCBar,
  OverlayIndicator,
  Viewport,
} from '@/engine/types';
import { DEFAULT_CHART_EVENT_VISIBILITY } from '@/engine/types';
import { type IndicatorCatalogId } from '@/indicators/catalog';
import {
  type OfficialWatchlistSourceId,
} from '@/features/watchlists/officialWatchlistProviders';
import {
  writeWorkspaceLayoutSetting,
} from '@/features/workspace/workspaceService';
import {
  createWorkspaceAutosaveQueue,
  WorkspaceSaveContextChangedError,
  type WorkspaceAutosaveQueue,
} from '@/features/workspace/workspaceAutosaveQueue';
import {
  stringifyWorkspaceState,
} from '@/features/workspace/workspacePersistence';
import {
  createChartSnapshotHydrationController,
  type ChartSnapshotHydrationController,
} from '@/features/workspace/chartSnapshotHydrationService';
import { getUiStoreState } from '@/store/uiStore';
import { bindDatabaseLifecycle } from '@/features/workspace/databaseLifecycleService';
import {
  createChartRuntimeController,
} from '@/features/workspace/chartRuntimeController';
import type {
  ChartStoreState,
  ChartTabState,
  DownloadProgressState,
  LayoutMode,
  ProgressState,
  Sheet,
  Timeframe,
  ToastMessage,
  ToastType,
} from '@/store/chartStoreTypes';
import type { CustomFormulaIndicatorInput } from '@/modules/formulaEngine/customFormulaEngine';

export type {
  ChartStoreState,
  ChartTabState,
  DownloadProgressState,
  LayoutMode,
  ProgressState,
  Sheet,
  Timeframe,
  ToastMessage,
  ToastType,
} from '@/store/chartStoreTypes';

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let workspaceAutosaveQueue: WorkspaceAutosaveQueue | null = null;
let suppressDatabaseChangedEvent = false;
let chartSnapshotHydrationController: ChartSnapshotHydrationController | null = null;

function getApi() {
  return getDesktopApi();
}

export function getActiveChartTab(chartTabs: ChartTabState[], activeChartTabId: string): ChartTabState | null {
  return chartTabs.find((tab) => tab.id === activeChartTabId) ?? chartTabs[0] ?? null;
}

function resetChartInteractionUi() {
  getUiStoreState().resetDrawingInteraction();
}

function closeImportDialogUi() {
  getUiStoreState().closeImportDialog();
}

function clearWorkspaceAutosaveTimer() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

function persistSheets(_sheets: Sheet[]) {
  void _sheets;
  if (false) {



    // Storage full or unavailable — sheets are lost on reload
  }
}

function scheduleWorkspaceAutosave() {
  if (chartSnapshotHydrationController?.isRestoringWorkspace()) {
    return;
  }

  const api = getApi();
  const state = useChartStore.getState();
  if (!api || !state.snapshot?.activeDatabasePath) {
    return;
  }

  clearWorkspaceAutosaveTimer();
  autosaveTimer = setTimeout(() => {
    const latestState = useChartStore.getState();
    if (
      !getApi() ||
      !latestState.snapshot?.activeDatabasePath ||
      chartSnapshotHydrationController?.isRestoringWorkspace()
    ) {
      return;
    }

    const serialized = stringifyWorkspaceState(latestState);
    workspaceAutosaveQueue?.autosave(serialized);
  }, 260);
}

function toChartMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getDatabaseDisplayName(databasePath: string): string {
  const normalizedPath = databasePath.replace(/\\/g, '/');
  return normalizedPath.split('/').filter(Boolean).pop() ?? databasePath;
}

function getChartEventLabel(eventType: ChartMarkerEventType): string {
  if (eventType === 'SPLIT') {
    return 'Split';
  }
  if (eventType === 'BONUS') {
    return 'Bonus';
  }
  if (eventType === 'DIVIDEND') {
    return 'Dividend';
  }
  if (eventType === 'RIGHTS') {
    return 'Rights issue';
  }
  if (eventType === 'NAME_CHANGE') {
    return 'Name change';
  }
  return 'Symbol change';
}

export const useChartStore = create<ChartStoreState>((set, get, store) => {
  const instrumentDataCache = createInstrumentDataCache();
  const saveQueue = createWorkspaceAutosaveQueue({
    write: writeWorkspaceLayoutSetting,
    onFailure: (error) => {
      const message = toChartMutationErrorMessage(error, 'Workspace save failed.');
      set({ workspaceAutosaveError: message });
      get().addToast(`Workspace autosave failed; retrying automatically. ${message}`, 'error', 'Workspace');
    },
    onRecovered: () => set({ workspaceAutosaveError: null }),
  });
  workspaceAutosaveQueue = saveQueue;
  const chartSnapshotHydration = createChartSnapshotHydrationController({
    getApi,
    getState: get,
    setState: set,
    instrumentDataCache,
    reportLoadError: (message) => get().addToast(message, 'error', 'Chart Load Failure'),
    clearWorkspaceAutosaveTimer,
    closeImportDialogUi,
    resetChartInteractionUi,
    resolveSelectedWatchlistId,
    setAutosaveSignature: (signature) => {
      saveQueue.markRestored(signature);
    },
  });
  chartSnapshotHydrationController = chartSnapshotHydration;

  const chartTabSession = createChartTabSessionController({
    getState: get,
    setState: set,
    resetChartInteractionUi,
    hydrateChartTabData: chartSnapshotHydration.hydrateChartTabData,
    onAdjustedModeLoaded: (adjusted) => get().addToast(
      adjusted ? 'Capital adjustments loaded (Splits & Bonuses).' : 'Raw unadjusted prices loaded.',
      'info',
      'Adjusted Mode',
    ),
  });

  const chartInstrumentCompare = createChartInstrumentCompareController({
    getApi,
    getState: get,
    setState: set,
    instrumentDataCache,
    addToast: (message, type, title) => {
      get().addToast(message, type, title);
    },
  });

  const chartSearch = createChartSearchController({
    getState: get,
    setState: set,
    addToast: (message, type, title) => {
      get().addToast(message, type, title);
    },
  });

  const watchlists = createWatchlistStoreController({
    getState: get,
    setState: set,
    addToast: (message, type, title) => {
      get().addToast(message, type, title);
    },
  });

  const runtime = createChartRuntimeController({
    getApi,
    getShellApi: getDesktopShellApi,
    getState: get,
    subscribe: store.subscribe,
    setState: set,
    applySnapshot: chartSnapshotHydration.applySnapshot,
    clearInstrumentDataCache: instrumentDataCache.clear,
    shouldSuppressDatabaseChangedEvent: () => suppressDatabaseChangedEvent,
    getActiveSelectedDrawingId: () =>
      getActiveChartTab(get().chartTabs, get().activeChartTabId)?.selectedDrawingId ?? null,
    hydrateChartTabData: chartSnapshotHydration.hydrateChartTabData,
  });

  const db = bindDatabaseLifecycle({
    getApi,
    setSuppressEvent: (v) => { suppressDatabaseChangedEvent = v; },
    applySnapshot: chartSnapshotHydration.applySnapshot,
  });

  const runDatabaseAction = async (
    operation: () => Promise<void>,
    options: {
      busyMessage: string;
      duplicateMessage: string;
      failureMessage: string;
      successMessage?: (databasePath: string) => string;
    },
  ): Promise<void> => {
    const state = get();
    if (state.isDatabaseTransitioning) {
      state.addToast(options.duplicateMessage, 'info', 'Database');
      return;
    }

    const previousDatabasePath = state.snapshot?.activeDatabasePath ?? null;
    set({
      isDatabaseTransitioning: true,
      databaseTransitionMessage: options.busyMessage,
    });

    try {
      await operation();
      const nextDatabasePath = get().snapshot?.activeDatabasePath ?? null;
      if (options.successMessage && nextDatabasePath && nextDatabasePath !== previousDatabasePath) {
        get().addToast(options.successMessage(nextDatabasePath), 'success', 'Database');
      }
    } catch (error) {
      set({
        isDatabaseTransitioning: false,
        databaseTransitionMessage: null,
      });
      get().addToast(toChartMutationErrorMessage(error, options.failureMessage), 'error', 'Database');
    }
  };

  return ({
  snapshot: null,
  ...createChartWorkspace(),
  isLoadingBars: false,
  adjustedMode: false,
  chartEventVisibility: { ...DEFAULT_CHART_EVENT_VISIBILITY },
  includeDividendAdjustments: false,
  includeRightsAdjustments: false,
  searchQuery: '',
  searchResults: [],
  symbolBrowserQuery: '',
  symbolExchangeFilter: 'NSE',
  symbolSeriesFilter: 'nseEquity',
  symbolBrowserItems: [],
  symbolBrowserLoadedDatabasePath: null,
  isSymbolBrowserLoading: false,
  selectedWatchlistId: null,
  isDatabaseTransitioning: false,
  databaseTransitionMessage: null,
  importProgress: {
    running: false,
    progress: 0,
    message: '',
    result: null,
    error: null,
  },
  downloadProgress: {
    running: false,
    progress: 0,
    message: '',
    error: null,
  },
  workspaceAutosaveError: null,
  toasts: [],
  addToast: (message, type = 'info', title) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type, title }] }));
    // Auto remove after 5s
    setTimeout(() => get().removeToast(id), 5000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setLayoutMode: chartTabSession.setLayoutMode,
  saveCurrentAsSheet: chartTabSession.saveCurrentAsSheet,
  loadSheet: chartTabSession.loadSheet,
  deleteSheet: chartTabSession.deleteSheet,
  renameSheet: chartTabSession.renameSheet,
  saveCurrentActiveDatabase: async () => {
    const api = getApi();
    const state = get();
    if (!api || !state.snapshot?.activeDatabasePath) {
      state.addToast('Open a database before saving.', 'warning', 'Save');
      return;
    }

    clearWorkspaceAutosaveTimer();
    try {
      const serialized = stringifyWorkspaceState(state);
      await saveQueue.saveNow(serialized);
      state.addToast('Current active database saved.', 'success', 'Save');
    } catch (error) {
      // Failed writes are reported once by the queue, which keeps retrying.
      if (error instanceof WorkspaceSaveContextChangedError) {
        state.addToast('Save canceled because the active workspace changed.', 'warning', 'Save');
      }
    }
  },
  setAdjustedMode: chartTabSession.setAdjustedMode,
  toggleChartEventVisibility: (eventType) => {
    const currentVisibility = get().chartEventVisibility[eventType] !== false;
    const nextVisibility = !currentVisibility;
    set((state) => ({
      chartEventVisibility: {
        ...state.chartEventVisibility,
        [eventType]: nextVisibility,
      },
    }));
    get().addToast(
      `${getChartEventLabel(eventType)} markers ${nextVisibility ? 'shown' : 'hidden'} on charts.`,
      'info',
      'Chart Events',
    );
  },
  setIncludeDividendAdjustments: chartTabSession.setIncludeDividendAdjustments,
  setIncludeRightsAdjustments: chartTabSession.setIncludeRightsAdjustments,
  toggleAdjustedMode: () => {
    get().setAdjustedMode(!get().adjustedMode);
  },
  init: runtime.init,
  refreshSnapshot: runtime.refreshSnapshot,
  createDatabaseInteractive: () =>
    runDatabaseAction(() => db.createDatabaseInteractive(), {
      busyMessage: 'Creating database...',
      duplicateMessage: 'A database operation is already running.',
      failureMessage: 'Database creation failed.',
      successMessage: (databasePath) => `Database ready: ${getDatabaseDisplayName(databasePath)}`,
    }),
  openDatabaseInteractive: () =>
    runDatabaseAction(() => db.openDatabaseInteractive(), {
      busyMessage: 'Opening database...',
      duplicateMessage: 'A database open is already running.',
      failureMessage: 'Database open failed.',
      successMessage: (databasePath) => `Database opened: ${getDatabaseDisplayName(databasePath)}`,
    }),
  activateDatabasePath: (filePath) =>
    runDatabaseAction(() => db.activateDatabasePath(filePath), {
      busyMessage: 'Opening database...',
      duplicateMessage: 'A database open is already running.',
      failureMessage: 'Database open failed.',
      successMessage: (databasePath) => `Database opened: ${getDatabaseDisplayName(databasePath)}`,
    }),
  closeDatabase: () =>
    runDatabaseAction(() => db.closeDatabase(), {
      busyMessage: 'Closing database...',
      duplicateMessage: 'A database operation is already running.',
      failureMessage: 'Database close failed.',
    }),
  createChartTab: chartTabSession.createChartTab,
  duplicateChartTab: chartTabSession.duplicateChartTab,
  activateChartTab: chartTabSession.activateChartTab,
  closeChartTab: chartTabSession.closeChartTab,
  loadInstrument: chartInstrumentCompare.loadInstrument,
  navigateSymbol: chartInstrumentCompare.navigateSymbol,
  setTimeframe: (timeframe) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => applyTimeframeToTab(tab, timeframe)),
    })),
  setChartType: (chartType) => {
    try {
      set((state) => ({
        ...updateActiveTab(state, (tab) => setTabChartType(tab, chartType)),
      }));
    } catch (error) {
      get().addToast(
        toChartMutationErrorMessage(
          error,
          chartType === 'renko'
            ? RENKO_BRICK_LIMIT_MESSAGE
            : 'Unable to apply the selected chart type.',
        ),
        'warning',
        'Chart Type',
      );
    }
  },
  setRenkoBrickSize: (size) => {
    try {
      set((state) => ({
        ...updateActiveTab(state, (tab) => setTabRenkoBrickSize(tab, size)),
      }));
    } catch (error) {
      get().addToast(
        toChartMutationErrorMessage(error, RENKO_BRICK_LIMIT_MESSAGE),
        'warning',
        'Renko',
      );
    }
  },
  setRenkoSettings: (settings) => {
    try {
      set((state) => ({
        ...updateActiveTab(state, (tab) => setTabRenkoSettings(tab, settings)),
      }));
    } catch (error) {
      get().addToast(
        toChartMutationErrorMessage(error, RENKO_BRICK_LIMIT_MESSAGE),
        'warning',
        'Renko',
      );
    }
  },
  setChartVisualSettings: (settings) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabVisualSettings(tab, settings)),
    })),
  applyChartSettingsDialog: (chartType, renkoSettings) => {
    try {
      set((state) => ({
        ...updateActiveTab(state, (tab) => {
          if (chartType !== 'renko') {
            return setTabChartType(tab, chartType);
          }

          return setTabChartType(
            setTabRenkoSettings(tab, renkoSettings),
            chartType,
            { fallbackToDefaultRenko: false },
          );
        }),
      }));
      return null;
    } catch (error) {
      return toChartMutationErrorMessage(
        error,
        chartType === 'renko'
          ? RENKO_BRICK_LIMIT_MESSAGE
          : 'Unable to apply the selected chart type.',
      );
    }
  },
  syncViewport: (viewport) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => syncTabViewport(tab, viewport)),
    })),
  scrollToViewportStart: (startIndex) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => scrollTabViewportToStart(tab, startIndex)),
    })),
  nudgeViewport: (deltaBars) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => nudgeTabViewport(tab, deltaBars)),
    })),
  zoomViewportByFactor: (factor, pivotIndex) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => zoomTabViewportByFactor(tab, factor, pivotIndex)),
    })),
  resetViewport: () =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => resetTabViewport(tab)),
    })),
  setIndicatorPaneHeight: (height, paneId) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabIndicatorPaneHeight(tab, height, paneId)),
    })),
  resetIndicatorPaneHeights: () =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => resetTabIndicatorPaneHeights(tab)),
    })),
  setIndicatorPaneCollapsed: (paneId, collapsed) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) =>
        setTabIndicatorPaneCollapsed(tab, paneId, collapsed),
      ),
    })),
  setPaneScaleOverride: (paneId, range) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabPaneScaleOverride(tab, paneId, range)),
    })),
  fitAllPanes: () =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => fitAllTabPanes(tab)),
    })),
  setLogScale: (enabled) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabLogScale(tab, enabled)),
    })),
  setShowVolume: (show) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabShowVolume(tab, show)),
    })),
  setInvertPriceScale: (enabled) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabInvertPriceScale(tab, enabled)),
    })),
  setShowValueLabels: (show) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabShowValueLabels(tab, show)),
    })),
  setValueLabelSettings: (settings) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabValueLabelSettings(tab, settings)),
    })),
  setShowLeftAxis: (show) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabShowLeftAxis(tab, show)),
    })),
  setFutureMarginMode: (mode) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabFutureMarginMode(tab, mode)),
    })),
  addCompareOverlay: chartInstrumentCompare.addCompareOverlay,
  removeCompareOverlay: chartInstrumentCompare.removeCompareOverlay,
  setSearchQuery: chartSearch.setSearchQuery,
  runSearch: chartSearch.runSearch,
  clearSearch: chartSearch.clearSearch,
  setSymbolBrowserQuery: chartSearch.setSymbolBrowserQuery,
  setSymbolExchangeFilter: chartSearch.setSymbolExchangeFilter,
  setSymbolSeriesFilter: chartSearch.setSymbolSeriesFilter,
  refreshSymbolBrowser: chartSearch.refreshSymbolBrowser,
  setHoverBar: (bar) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabHoverBar(tab, bar)),
    })),
  setVisibleBarCount: (count) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => setTabVisibleBarCount(tab, count)),
    })),
  setImportProgress: (patch) => set((state) => ({ importProgress: { ...state.importProgress, ...patch } })),
  setDownloadProgress: (patch) => set((state) => ({ downloadProgress: { ...state.downloadProgress, ...patch } })),
  triggerDownload: runtime.triggerDownload,
  loadWorkspaceFromLayout: chartTabSession.loadWorkspaceFromLayout,
  addIndicator: (kind) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => addTabIndicator(tab, kind)),
    })),
  addIndicatorCatalog: (catalogId) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => addTabIndicatorCatalog(tab, catalogId)),
    })),
  addCustomFormulaIndicator: (draft: CustomFormulaIndicatorInput) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => addTabCustomFormulaIndicator(tab, draft)),
    })),
  updateIndicator: (indicator) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => updateTabIndicator(tab, indicator)),
    })),
  removeIndicator: (indicatorId) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => removeTabIndicator(tab, indicatorId)),
    })),
  clearIndicators: () =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => clearTabIndicators(tab)),
    })),
  moveIndicatorPane: (indicatorId, direction) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => moveTabIndicatorPane(tab, indicatorId, direction)),
    })),
  selectDrawing: (drawingId) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => selectTabDrawing(tab, drawingId)),
    })),
  addDrawing: (drawing) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => addTabDrawing(tab, drawing)),
    })),
  updateDrawing: (drawing) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => updateTabDrawing(tab, drawing)),
    })),
  toggleDrawingLock: (drawingId) =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => toggleTabDrawingLock(tab, drawingId)),
    })),
  deleteSelectedDrawing: () => {
    set((state) => ({
      ...updateActiveTab(state, (tab) => deleteSelectedTabDrawing(tab)),
    }));
    getUiStoreState().closeDrawingProperties();
  },
  clearDrawings: () => {
    set((state) => ({
      ...updateActiveTab(state, (tab) => clearTabDrawings(tab)),
    }));
    getUiStoreState().closeDrawingProperties();
  },
  removeLastDrawing: () =>
    set((state) => ({
      ...updateActiveTab(state, (tab) => removeLastTabDrawing(tab)),
    })),
  createWatchlist: watchlists.createWatchlist,
  renameWatchlist: watchlists.renameWatchlist,
  deleteWatchlist: watchlists.deleteWatchlist,
  importOfficialWatchlists: watchlists.importOfficialWatchlists,
  updateOfficialWatchlist: watchlists.updateOfficialWatchlist,
  updateAllOfficialWatchlists: watchlists.updateAllOfficialWatchlists,
  selectWatchlist: watchlists.selectWatchlist,
  addToWatchlist: watchlists.addToWatchlist,
  removeFromWatchlist: watchlists.removeFromWatchlist,
  });
});

useChartStore.subscribe((state, previousState) => {
  const nextDatabasePath = state.snapshot?.activeDatabasePath ?? '';
  const previousDatabasePath = previousState.snapshot?.activeDatabasePath ?? '';

  if (!nextDatabasePath) {
    workspaceAutosaveQueue?.markRestored('');
    clearWorkspaceAutosaveTimer();
    return;
  }

  if (nextDatabasePath !== previousDatabasePath) {
    workspaceAutosaveQueue?.markRestored('');
    clearWorkspaceAutosaveTimer();
  }

  // Optimization: Do not perform expensive serialization during workspace restoration
  if (chartSnapshotHydrationController?.isRestoringWorkspace()) {
    return;
  }

  // Skip if basic state hasn't changed (shallow check)
  // We include chartTabs because viewport changes (which we want to persist eventually)
  // will change the chartTabs array reference via updateActiveTab.
  // The throttling in scheduleWorkspaceAutosave will handle the frequency.
  if (
    nextDatabasePath === previousDatabasePath &&
    state.chartTabs === previousState.chartTabs &&
    state.activeChartTabId === previousState.activeChartTabId &&
    state.adjustedMode === previousState.adjustedMode &&
    state.includeDividendAdjustments === previousState.includeDividendAdjustments &&
    state.includeRightsAdjustments === previousState.includeRightsAdjustments
  ) {
    return;
  }

  scheduleWorkspaceAutosave();
});

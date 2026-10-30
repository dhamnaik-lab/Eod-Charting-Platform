import { registerMenuCommandRouter } from '@/features/app/menuCommandRouter';
import {
  fetchLightweightAppSnapshot,
  loadActiveDatabaseRefreshState,
  type RefreshSnapshotOptions,
} from '@/features/workspace/databaseSnapshotService';
import type {
  AppSnapshot,
  DesktopApi,
  DesktopShellApi,
  NativeMenuState,
} from '@/platform';
import type { ChartStoreState } from '@/store/chartStoreTypes';
import {
  resolveSelectedWatchlistId,
} from '@/features/watchlists/watchlistOrchestrationService';
import { getUiStoreState, useUiStore } from '@/store/uiStore';
import { applyDownloadProgress } from '@/features/bhavcopy/downloadRunState';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface ChartRuntimeController {
  init: () => Promise<void>;
  refreshSnapshot: (options?: RefreshSnapshotOptions) => Promise<void>;
  triggerDownload: () => Promise<void>;
}

interface ChartRuntimeControllerDeps {
  getApi: () => DesktopApi | null;
  getShellApi: () => DesktopShellApi | null;
  getState: () => ChartStoreState;
  subscribe: (listener: (state: ChartStoreState, previousState: ChartStoreState) => void) => () => void;
  setState: (update: StoreStateUpdate) => void;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
  clearInstrumentDataCache: () => void;
  shouldSuppressDatabaseChangedEvent: () => boolean;
  getActiveSelectedDrawingId: () => string | null;
  hydrateChartTabData: (tabId: string) => Promise<void>;
}

function emptySnapshot(): AppSnapshot {
  return {
    activeDatabasePath: null,
    knownDatabases: [],
    dbStats: null,
    watchlists: [],
    theme: 'dark',
  };
}

function getHydratableChartTabIds(state: ChartStoreState): string[] {
  const seen = new Set<string>();
  const tabIds: string[] = [];

  for (const tab of state.chartTabs) {
    if (!tab.instrument && !tab.requestedInstrument) {
      continue;
    }
    if (seen.has(tab.id)) {
      continue;
    }
    seen.add(tab.id);
    tabIds.push(tab.id);
  }

  return tabIds;
}

function getMenuActiveChartTab(state: ChartStoreState) {
  return state.chartTabs.find((tab) => tab.id === state.activeChartTabId) ?? state.chartTabs[0] ?? null;
}

function buildNativeMenuState(state: ChartStoreState): NativeMenuState {
  const activeTab = getMenuActiveChartTab(state);
  const uiState = getUiStoreState();

  return {
    timeframe: activeTab?.timeframe ?? 'D',
    chartType: activeTab?.chartType ?? 'candles',
    adjustedMode: state.adjustedMode,
    includeDividendAdjustments: state.includeDividendAdjustments,
    includeRightsAdjustments: state.includeRightsAdjustments,
    layoutMode: activeTab?.layoutMode ?? 'single',
    sidebarVisible: uiState.uiFlags.sidebarVisible,
    ohlcvBarVisible: uiState.uiFlags.ohlcvBarVisible,
    statusBarVisible: uiState.uiFlags.statusBarVisible,
    magnetEnabled: uiState.magnetEnabled,
    showSplitEvents: state.chartEventVisibility.SPLIT !== false,
    showBonusEvents: state.chartEventVisibility.BONUS !== false,
    showDividendEvents: state.chartEventVisibility.DIVIDEND !== false,
    showRightsEvents: state.chartEventVisibility.RIGHTS !== false,
    showSymbolChangeEvents: state.chartEventVisibility.SYMBOL_CHANGE !== false,
    showNameChangeEvents: state.chartEventVisibility.NAME_CHANGE !== false,
  };
}

function didRelevantChartMenuStateChange(
  state: ChartStoreState,
  previousState: ChartStoreState,
): boolean {
  const activeTab = getMenuActiveChartTab(state);
  const previousActiveTab = getMenuActiveChartTab(previousState);

  return (
    state.activeChartTabId !== previousState.activeChartTabId ||
    activeTab?.id !== previousActiveTab?.id ||
    activeTab?.timeframe !== previousActiveTab?.timeframe ||
    activeTab?.chartType !== previousActiveTab?.chartType ||
    activeTab?.layoutMode !== previousActiveTab?.layoutMode ||
    state.adjustedMode !== previousState.adjustedMode ||
    state.includeDividendAdjustments !== previousState.includeDividendAdjustments ||
    state.includeRightsAdjustments !== previousState.includeRightsAdjustments ||
    state.chartEventVisibility !== previousState.chartEventVisibility
  );
}

function didRelevantUiMenuStateChange(
  state: ReturnType<typeof getUiStoreState>,
  previousState: ReturnType<typeof getUiStoreState>,
): boolean {
  return (
    state.uiFlags.sidebarVisible !== previousState.uiFlags.sidebarVisible ||
    state.uiFlags.ohlcvBarVisible !== previousState.uiFlags.ohlcvBarVisible ||
    state.uiFlags.statusBarVisible !== previousState.uiFlags.statusBarVisible ||
    state.magnetEnabled !== previousState.magnetEnabled
  );
}

export function createChartRuntimeController(
  deps: ChartRuntimeControllerDeps,
): ChartRuntimeController {
  let initialized = false;
  let listenersRegistered = false;
  let lastSyncedMenuStateSignature = '';

  const refreshSnapshot = async (options?: RefreshSnapshotOptions) => {
    const api = deps.getApi();
    if (!api) {
      return;
    }

    const snapshot = await fetchLightweightAppSnapshot(api);
    if (snapshot.activeDatabasePath !== deps.getState().snapshot?.activeDatabasePath) {
      await deps.applySnapshot(snapshot);
      return;
    }

    if (snapshot.activeDatabasePath) {
      if (options?.refreshSymbolBrowser) {
        deps.setState({ isSymbolBrowserLoading: true });
      }
      const state = deps.getState();
      const { watchlists, dbStats, symbolBrowserItems } = await loadActiveDatabaseRefreshState({
        api,
        snapshot,
        currentSnapshot: state.snapshot,
        symbolBrowserQuery: state.symbolBrowserQuery,
        symbolExchangeFilter: state.symbolExchangeFilter,
        currentSymbolBrowserItems: state.symbolBrowserItems,
        options,
      });
      deps.setState({
        snapshot: {
          ...snapshot,
          watchlists,
          dbStats,
        },
        symbolBrowserItems,
        symbolBrowserLoadedDatabasePath: options?.refreshSymbolBrowser
          ? snapshot.activeDatabasePath
          : deps.getState().symbolBrowserLoadedDatabasePath,
        isSymbolBrowserLoading: false,
        selectedWatchlistId: resolveSelectedWatchlistId(watchlists, deps.getState().selectedWatchlistId),
      });
      return;
    }

    deps.setState({
      snapshot,
      searchQuery: '',
      searchResults: [],
      symbolBrowserQuery: '',
      symbolBrowserItems: [],
      symbolBrowserLoadedDatabasePath: null,
      isSymbolBrowserLoading: false,
      selectedWatchlistId: resolveSelectedWatchlistId(snapshot.watchlists, deps.getState().selectedWatchlistId),
    });
  };

  const triggerDownload = async () => {
    const api = deps.getApi();
    if (!api) {
      return;
    }

    deps.setState((state) => ({
      downloadProgress: {
        ...state.downloadProgress,
        running: true,
        progress: 0,
        message: 'Starting bhavcopy download',
        error: null,
      },
    }));

    try {
      await api.downloadBhavcopy();
      deps.setState((state) => ({
        downloadProgress: {
          ...state.downloadProgress,
          running: false,
          progress: 100,
          message: 'Bhavcopy download complete',
          error: null,
        },
      }));
      await refreshSnapshot({ refreshSymbolBrowser: true, refreshDbStats: true });
    } catch (error) {
      deps.setState((state) => ({
        downloadProgress: {
          ...state.downloadProgress,
          running: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const init = async () => {
    const api = deps.getApi();
    const shellApi = deps.getShellApi();

    if (initialized) {
      return;
    }

    initialized = true;
    if (!listenersRegistered) {
      if (shellApi) {
        const syncNativeMenuState = () => {
          const activeShellApi = deps.getShellApi();
          if (!activeShellApi) {
            return;
          }

          const nextState = buildNativeMenuState(deps.getState());
          const nextSignature = JSON.stringify(nextState);
          if (nextSignature === lastSyncedMenuStateSignature) {
            return;
          }

          lastSyncedMenuStateSignature = nextSignature;
          void activeShellApi.syncMenuState(nextState).catch(() => {
            if (lastSyncedMenuStateSignature === nextSignature) {
              lastSyncedMenuStateSignature = '';
            }
          });
        };

        registerMenuCommandRouter(shellApi, () => ({
          ...deps.getState(),
          getActiveSelectedDrawingId: deps.getActiveSelectedDrawingId,
        }), syncNativeMenuState);

        deps.subscribe((state, previousState) => {
          if (!didRelevantChartMenuStateChange(state, previousState)) {
            return;
          }

          syncNativeMenuState();
        });
        useUiStore.subscribe((state, previousState) => {
          if (!didRelevantUiMenuStateChange(state, previousState)) {
            return;
          }

          syncNativeMenuState();
        });
        syncNativeMenuState();
      }

      if (api) {
        api.onDatabaseChanged((snapshot) => {
          deps.clearInstrumentDataCache();
          if (deps.shouldSuppressDatabaseChangedEvent()) {
            return;
          }

          if (snapshot.activeDatabasePath !== deps.getState().snapshot?.activeDatabasePath) {
            void deps.applySnapshot(snapshot);
            return;
          }

          void refreshSnapshot({ refreshDbStats: true });

          const tabIds = getHydratableChartTabIds(deps.getState());
          for (const tabId of tabIds) {
            void deps.hydrateChartTabData(tabId);
          }
        });
        api.onImportProgress((progress, message) => {
          deps.setState((state) => ({
            importProgress: {
              ...state.importProgress,
              running: progress < 100,
              progress,
              message,
            },
          }));
        });
        api.onDownloadProgress((progress, message) => {
          deps.setState((state) => ({
            downloadProgress: applyDownloadProgress(state.downloadProgress, progress, message),
          }));
        });
      }

      listenersRegistered = Boolean(shellApi || api);
    }

    if (!api) {
      deps.setState({ snapshot: emptySnapshot() });
      return;
    }

    try {
      const snapshot = await fetchLightweightAppSnapshot(api);
      await deps.applySnapshot(snapshot);
    } catch (error) {
      initialized = false;
      deps.setState({ snapshot: emptySnapshot() });
      throw error;
    }
  };

  return {
    init,
    refreshSnapshot,
    triggerDownload,
  };
}

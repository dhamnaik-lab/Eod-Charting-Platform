import {
  createChartWorkspace,
} from '@/features/charts/chartTabWorkspaceService';
import { beginChartRequest, invalidateChartRequests } from '@/features/charts/chartLoadGuard';
import { readLatestChartData } from '@/platform/chartRequestErrors';
import {
  restoreWorkspaceState,
} from '@/features/charts/chartSheetWorkspaceService';
import {
  applyEodResultToTab,
  buildHydrationFailureTab,
  hydrateChartTabPayload,
  type InstrumentDataCache,
} from '@/features/charts/chartInstrumentHydrationService';
import {
  loadDeferredDbStats,
  loadSnapshotHydrationDetails,
} from '@/features/workspace/databaseSnapshotService';
import {
  readDatabaseDefaultPriceMode,
} from '@/features/workspace/databaseSettingsService';
import {
  readPersistedWorkspace,
  stringifyWorkspaceState,
} from '@/features/workspace/workspacePersistence';
import type {
  AppSnapshot,
  DesktopApi,
  Watchlist,
} from '@/platform';
import type {
  ChartStoreState,
  ChartTabState,
} from '@/store/chartStoreTypes';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface ChartSnapshotHydrationController {
  isRestoringWorkspace: () => boolean;
  hydrateChartTabData: (tabId: string, options?: HydrateChartTabDataOptions) => Promise<void>;
  applySnapshot: (snapshot: AppSnapshot) => Promise<void>;
}

interface ChartSnapshotHydrationControllerDeps {
  getApi: () => DesktopApi | null;
  getState: () => ChartStoreState;
  setState: (update: StoreStateUpdate) => void;
  instrumentDataCache: InstrumentDataCache;
  clearWorkspaceAutosaveTimer: () => void;
  closeImportDialogUi: () => void;
  resetChartInteractionUi: () => void;
  resolveSelectedWatchlistId: (watchlists: Watchlist[], selectedWatchlistId: number | null) => number | null;
  setAutosaveSignature: (signature: string) => void;
  reportLoadError?: (message: string) => void;
}

interface HydrateChartTabDataOptions {
  adjusted?: boolean;
  includeDividendAdjustments?: boolean;
  includeRightsAdjustments?: boolean;
  forceReload?: boolean;
}

function getActiveChartTab(chartTabs: ChartTabState[], activeChartTabId: string): ChartTabState | null {
  return chartTabs.find((tab) => tab.id === activeChartTabId) ?? chartTabs[0] ?? null;
}

export function createChartSnapshotHydrationController(
  deps: ChartSnapshotHydrationControllerDeps,
): ChartSnapshotHydrationController {
  let restoringWorkspace = false;
  let snapshotHydrationToken = 0;

  const setRestoreCompleteState = () => ({
    isDatabaseTransitioning: false,
    databaseTransitionMessage: null,
    isLoadingBars: false,
  });

  const hydrateChartTabData = async (
    tabId: string,
    options?: HydrateChartTabDataOptions,
  ) => {
    const api = deps.getApi();
    if (!api) {
      return;
    }

    const tab = deps.getState().chartTabs.find((candidate) => candidate.id === tabId);
    const targetInstrument = tab?.requestedInstrument ?? tab?.instrument;
    if (!tab || !targetInstrument) {
      return;
    }

    const request = beginChartRequest(deps.instrumentDataCache, [tabId]);
    const startState = deps.getState();
    const databasePath = startState.snapshot?.activeDatabasePath ?? null;
    const canApply = (state: ChartStoreState) => {
      const current = state.chartTabs.find((candidate) => candidate.id === tabId);
      const instrument = current?.requestedInstrument ?? current?.instrument;
      return request.isCurrent(tabId)
        && (state.snapshot?.activeDatabasePath ?? null) === databasePath
        && state.adjustedMode === startState.adjustedMode
        && state.includeDividendAdjustments === startState.includeDividendAdjustments
        && state.includeRightsAdjustments === startState.includeRightsAdjustments
        && instrument?.symbol === targetInstrument.symbol && instrument.exchange === targetInstrument.exchange;
    };
    if (deps.getState().activeChartTabId === tabId) {
      deps.setState({ isLoadingBars: true });
    }

    try {
      const state = deps.getState();
      const currentTab = state.chartTabs.find((candidate) => candidate.id === tabId);
      if (!currentTab) {
        return;
      }

      const adjusted =
        options?.adjusted ?? state.adjustedMode;
      const includeDividendAdjustments =
        options?.includeDividendAdjustments ?? state.includeDividendAdjustments;
      const includeRightsAdjustments =
        options?.includeRightsAdjustments ?? state.includeRightsAdjustments;

      const { result, compareOverlays: hydratedCompareOverlays } = await readLatestChartData((retry) => hydrateChartTabPayload({
        api,
        databasePath,
        tab: currentTab,
        targetInstrument,
        adjusted,
        includeDividendAdjustments,
        includeRightsAdjustments,
        instrumentDataCache: deps.instrumentDataCache,
        forceReload: retry ? false : options?.forceReload,
      }), () => canApply(deps.getState()));

      deps.setState((nextState) => !canApply(nextState) ? {} : ({
        isLoadingBars: nextState.activeChartTabId === tabId ? false : nextState.isLoadingBars,
        chartTabs: nextState.chartTabs.map((candidate) =>
          candidate.id === tabId
            ? applyEodResultToTab(
                {
                  ...candidate,
                  compareOverlays: hydratedCompareOverlays,
                },
                targetInstrument,
                result,
                candidate.viewport.endIndex > candidate.viewport.startIndex,
              )
            : candidate,
        ),
      }));
    } catch (error) {
      if (!canApply(deps.getState())) return;
      const adjustedMode = options?.adjusted ?? deps.getState().adjustedMode;
      const includeDividendAdjustments =
        options?.includeDividendAdjustments ?? deps.getState().includeDividendAdjustments;
      const includeRightsAdjustments =
        options?.includeRightsAdjustments ?? deps.getState().includeRightsAdjustments;
      deps.setState((state) => ({
        isLoadingBars: state.activeChartTabId === tabId ? false : state.isLoadingBars,
        chartTabs: state.chartTabs.map((candidate) =>
          candidate.id === tabId
            ? buildHydrationFailureTab(
              candidate,
              targetInstrument,
              adjustedMode,
              includeDividendAdjustments,
              includeRightsAdjustments,
            )
            : candidate,
        ),
      }));
      const backgroundTab = deps.getState().activeChartTabId !== tabId ? ' background chart tab' : '';
      deps.reportLoadError?.(`Failed to load${backgroundTab} ${targetInstrument.exchange}:${targetInstrument.symbol}. ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const applySnapshot = async (snapshot: AppSnapshot) => {
    const hydrationToken = ++snapshotHydrationToken;
    const previousSnapshot = deps.getState().snapshot;
    const databaseChanged = snapshot.activeDatabasePath !== previousSnapshot?.activeDatabasePath;
    invalidateChartRequests(deps.instrumentDataCache);
    deps.instrumentDataCache.clear();

    restoringWorkspace = true;
    deps.clearWorkspaceAutosaveTimer();
    deps.closeImportDialogUi();
    deps.resetChartInteractionUi();

    if (!snapshot.activeDatabasePath) {
      deps.setState({
        snapshot,
        selectedWatchlistId: deps.resolveSelectedWatchlistId(
          snapshot.watchlists,
          deps.getState().selectedWatchlistId,
        ),
        searchQuery: '',
        searchResults: [],
        symbolBrowserQuery: '',
        symbolBrowserItems: [],
        symbolBrowserLoadedDatabasePath: null,
        isSymbolBrowserLoading: false,
        ...setRestoreCompleteState(),
        ...createChartWorkspace(),
      });
      deps.setAutosaveSignature('');
      restoringWorkspace = false;
      return;
    }

    deps.setState((state) => ({
      snapshot: {
        ...snapshot,
        watchlists: databaseChanged ? [] : snapshot.watchlists,
        dbStats: databaseChanged ? null : snapshot.dbStats,
      },
      selectedWatchlistId: null,
      searchQuery: '',
      searchResults: [],
      symbolBrowserQuery: '',
      symbolBrowserItems: [],
      symbolBrowserLoadedDatabasePath: null,
      isSymbolBrowserLoading: false,
      isDatabaseTransitioning: true,
      databaseTransitionMessage: 'Opening database...',
      isLoadingBars: false,
      chartTabs: state.chartTabs,
      activeChartTabId: state.activeChartTabId,
    }));

    void (async () => {
      const api = deps.getApi();
      if (!api) {
        if (hydrationToken === snapshotHydrationToken) {
          restoringWorkspace = false;
          deps.setState(setRestoreCompleteState());
        }
        return;
      }

      try {
        const [persistedWorkspace, defaultPriceMode] = await Promise.all([
          readPersistedWorkspace(),
          readDatabaseDefaultPriceMode(),
        ]);
        if (hydrationToken !== snapshotHydrationToken) {
          return;
        }

        const workspace = restoreWorkspaceState(persistedWorkspace);
        const startupAdjustedMode = defaultPriceMode === 'adjusted';
        const startupDividendAdjustments = deps.getState().includeDividendAdjustments;
        const startupRightsAdjustments = deps.getState().includeRightsAdjustments;
        deps.setState({
          adjustedMode: startupAdjustedMode,
          chartTabs: workspace.chartTabs,
          activeChartTabId: workspace.activeChartTabId,
          isDatabaseTransitioning: false,
          databaseTransitionMessage: null,
        });
        deps.resetChartInteractionUi();
        deps.setAutosaveSignature(stringifyWorkspaceState(workspace));

        const activeTab = getActiveChartTab(workspace.chartTabs, workspace.activeChartTabId);
        if (activeTab?.instrument) {
          window.setTimeout(() => {
            if (hydrationToken !== snapshotHydrationToken) return;
            void hydrateChartTabData(workspace.activeChartTabId, {
              adjusted: startupAdjustedMode,
              includeDividendAdjustments: startupDividendAdjustments,
              includeRightsAdjustments: startupRightsAdjustments,
              forceReload: true,
            });
          }, 40);
        }

        window.setTimeout(() => {
          if (hydrationToken !== snapshotHydrationToken) {
            return;
          }

          void loadSnapshotHydrationDetails(api, snapshot).then(({ watchlists }) => {
            if (hydrationToken !== snapshotHydrationToken) {
              return;
            }

            deps.setState((state) => ({
              snapshot: state.snapshot
                ? {
                    ...state.snapshot,
                    watchlists,
                  }
                : state.snapshot,
              selectedWatchlistId: deps.resolveSelectedWatchlistId(
                watchlists,
                state.selectedWatchlistId,
              ),
            }));
          });
        }, 60);

        window.setTimeout(() => {
          if (hydrationToken !== snapshotHydrationToken) {
            return;
          }

          void loadDeferredDbStats(api, snapshot).then((dbStats) => {
            if (hydrationToken !== snapshotHydrationToken) {
              return;
            }

            deps.setState((state) => ({
              snapshot: state.snapshot
                ? {
                    ...state.snapshot,
                    dbStats,
                  }
                : state.snapshot,
            }));
          });
        }, 900);
      } catch {
        if (hydrationToken === snapshotHydrationToken) {
          deps.setAutosaveSignature('');
        }
      } finally {
        if (hydrationToken === snapshotHydrationToken) {
          restoringWorkspace = false;
          deps.setState(setRestoreCompleteState());
        }
      }
    })();
  };

  return {
    isRestoringWorkspace: () => restoringWorkspace,
    hydrateChartTabData,
    applySnapshot,
  };
}

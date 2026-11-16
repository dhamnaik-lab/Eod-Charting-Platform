import {
  buildDeleteSheetState,
  buildLoadSheetState,
  buildRenameSheetState,
  buildSaveCurrentAsSheetState,
  restoreWorkspaceState,
} from '@/features/charts/chartSheetWorkspaceService';
import {
  buildActivateChartTabState,
  buildCloseChartTabState,
  createChartTabWorkspaceState,
  duplicateChartTabWorkspaceState,
  shouldHydrateChartTab,
} from '@/features/charts/chartTabWorkspaceService';
import {
  parsePersistedWorkspace,
  resolveWorkspaceLayoutMode,
} from '@/features/workspace/workspacePersistence';
import {
  writeDatabaseDefaultPriceMode,
} from '@/features/workspace/databaseSettingsService';
import type {
  ChartStoreState,
  ChartTabState,
  LayoutMode,
} from '@/store/chartStoreTypes';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface ChartTabSessionController {
  setLayoutMode: (mode: LayoutMode) => void;
  saveCurrentAsSheet: (tabId: string, name: string) => void;
  loadSheet: (tabId: string, sheetId: string) => void;
  deleteSheet: (tabId: string, sheetId: string) => void;
  renameSheet: (tabId: string, sheetId: string, newName: string) => void;
  setAdjustedMode: (adjusted: boolean) => void;
  setIncludeDividendAdjustments: (enabled: boolean) => void;
  setIncludeRightsAdjustments: (enabled: boolean) => void;
  createChartTab: () => void;
  duplicateChartTab: (tabId: string) => void;
  activateChartTab: (tabId: string) => void;
  toggleChartMaximize: (tabId: string) => void;
  closeChartTab: (tabId: string) => void;
  loadWorkspaceFromLayout: (layoutData: string) => void;
}

interface ChartTabSessionControllerDeps {
  getState: () => ChartStoreState;
  setState: (update: StoreStateUpdate) => void;
  resetChartInteractionUi: () => void;
  hydrateChartTabData: (tabId: string) => Promise<void>;
  onAdjustedModeLoaded?: (adjusted: boolean) => void;
}

function updateActiveTab(
  state: Pick<ChartStoreState, 'chartTabs' | 'activeChartTabId'>,
  updater: (tab: ChartTabState) => ChartTabState,
): Pick<ChartStoreState, 'chartTabs'> {
  return {
    chartTabs: state.chartTabs.map((tab) =>
      tab.id === state.activeChartTabId ? updater(tab) : tab,
    ),
  };
}

export function createChartTabSessionController(
  deps: ChartTabSessionControllerDeps,
): ChartTabSessionController {
  let priceModeHydrationRevision = 0;
  const queueTabHydration = (tabId: string) => {
    queueMicrotask(() => {
      void deps.hydrateChartTabData(tabId);
    });
  };

  const queueSequentialTabHydration = (tabIds: string[]) => {
    queueMicrotask(() => {
      void (async () => {
        for (const tabId of tabIds) {
          await deps.hydrateChartTabData(tabId);
        }
      })();
    });
  };

  const rehydrateInstrumentTabs = (onLoaded?: () => void) => {
    const revision = ++priceModeHydrationRevision;
    const requested = deps.getState();
    const isCurrent = () => {
      const state = deps.getState();
      return revision === priceModeHydrationRevision
        && state.snapshot?.activeDatabasePath === requested.snapshot?.activeDatabasePath
        && state.adjustedMode === requested.adjustedMode
        && state.includeDividendAdjustments === requested.includeDividendAdjustments
        && state.includeRightsAdjustments === requested.includeRightsAdjustments;
    };
    const tabsToHydrate = requested
      .chartTabs.filter((tab) => tab.requestedInstrument ?? tab.instrument)
      .sort((left, right) => Number(right.id === requested.activeChartTabId) - Number(left.id === requested.activeChartTabId))
      .map((tab) => tab.id);
    queueMicrotask(() => {
      void (async () => {
        for (const tabId of tabsToHydrate) {
          if (!isCurrent()) return;
          const state = deps.getState();
          const tab = state.chartTabs.find((candidate) => candidate.id === tabId);
          if (tab && shouldHydrateChartTab(tab, state.adjustedMode, state.includeDividendAdjustments, state.includeRightsAdjustments)) {
            await deps.hydrateChartTabData(tabId);
          }
        }
        if (!isCurrent()) return;
        const state = deps.getState();
        const loaded = state.chartTabs.filter((tab) => tab.requestedInstrument ?? tab.instrument)
          .every((tab) => !shouldHydrateChartTab(tab, state.adjustedMode, state.includeDividendAdjustments, state.includeRightsAdjustments));
        if (loaded) onLoaded?.();
      })();
    });
  };

  return {
    setLayoutMode: (mode) => {
      // Old tile variants map to one workspace-owned Auto-Tile setting.
      const normalizedMode: LayoutMode = mode === 'single' ? 'single' : 'tile';
      deps.setState((state) => ({
        ...updateActiveTab(state, (tab) => ({ ...tab, layoutMode: normalizedMode })),
        workspaceLayoutMode: normalizedMode,
        maximizedChartTabId: null,
      }));
      if (normalizedMode !== 'single') {
        const state = deps.getState();
        const unhydratedTabIds = state.chartTabs
          .filter(
            (tab) =>
              (tab.requestedInstrument ?? tab.instrument) &&
              shouldHydrateChartTab(
                tab,
                state.adjustedMode,
                state.includeDividendAdjustments,
                state.includeRightsAdjustments,
              ),
          )
          .map((tab) => tab.id);
        if (unhydratedTabIds.length > 0) {
          queueSequentialTabHydration(unhydratedTabIds);
        }
      }
    },
    saveCurrentAsSheet: (tabId, name) => {
      const nextState = buildSaveCurrentAsSheetState(deps.getState().chartTabs, tabId, name);
      if (!nextState) {
        return;
      }

      deps.setState(nextState);
      deps.resetChartInteractionUi();
    },
    loadSheet: (tabId, sheetId) => {
      const nextState = buildLoadSheetState(deps.getState().chartTabs, tabId, sheetId);
      if (!nextState) {
        return;
      }

      deps.setState({
        chartTabs: nextState.chartTabs,
        activeChartTabId: nextState.activeChartTabId,
      });
      deps.resetChartInteractionUi();

      if (nextState.shouldHydrate) {
        queueTabHydration(tabId);
      }
    },
    deleteSheet: (tabId, sheetId) =>
      deps.setState((state) => buildDeleteSheetState(state.chartTabs, tabId, sheetId)),
    renameSheet: (tabId, sheetId, newName) =>
      deps.setState((state) => buildRenameSheetState(state.chartTabs, tabId, sheetId, newName)),
    setAdjustedMode: (adjusted) => {
      const currentState = deps.getState();
      if (currentState.adjustedMode === adjusted) {
        return;
      }

      deps.setState({ adjustedMode: adjusted });
      if (currentState.snapshot?.activeDatabasePath) {
        void writeDatabaseDefaultPriceMode(adjusted ? 'adjusted' : 'raw').catch(() => {
          // Keep live chart mode responsive even if the background default save fails.
        });
      }
      rehydrateInstrumentTabs(() => deps.onAdjustedModeLoaded?.(adjusted));
    },
    setIncludeDividendAdjustments: (enabled) => {
      if (deps.getState().includeDividendAdjustments === enabled) {
        return;
      }

      deps.setState({ includeDividendAdjustments: enabled });
      if (deps.getState().adjustedMode) {
        rehydrateInstrumentTabs();
      }
    },
    setIncludeRightsAdjustments: (enabled) => {
      if (deps.getState().includeRightsAdjustments === enabled) {
        return;
      }

      deps.setState({ includeRightsAdjustments: enabled });
      if (deps.getState().adjustedMode) {
        rehydrateInstrumentTabs();
      }
    },
    createChartTab: () => {
      deps.setState((state) => ({ ...createChartTabWorkspaceState(state.chartTabs), maximizedChartTabId: null }));
      deps.resetChartInteractionUi();
    },
    duplicateChartTab: (tabId) => {
      const nextState = duplicateChartTabWorkspaceState(deps.getState().chartTabs, tabId);
      if (!nextState) {
        return;
      }

      deps.setState({ ...nextState, maximizedChartTabId: null });
      deps.resetChartInteractionUi();
    },
    activateChartTab: (tabId) => {
      const currentState = deps.getState();
      const nextState = buildActivateChartTabState(currentState, tabId);
      if (!nextState) {
        return;
      }

      // Selecting a tab changes focus, never the workspace layout.
      deps.setState({
        ...nextState,
        maximizedChartTabId: currentState.maximizedChartTabId === tabId
          ? currentState.maximizedChartTabId : null,
      });
      deps.resetChartInteractionUi();

      const activeState = deps.getState();
      const nextTab = activeState.chartTabs.find((tab) => tab.id === tabId);
      if (
        shouldHydrateChartTab(
          nextTab,
          activeState.adjustedMode,
          activeState.includeDividendAdjustments,
          activeState.includeRightsAdjustments,
        )
      ) {
        void deps.hydrateChartTabData(tabId);
      }
    },
    toggleChartMaximize: (tabId) => {
      const state = deps.getState();
      if (!state.chartTabs.some((tab) => tab.id === tabId)) return;
      if (state.maximizedChartTabId === tabId) {
        deps.setState({ maximizedChartTabId: null });
        return;
      }
      deps.setState({ activeChartTabId: tabId, maximizedChartTabId: tabId });
      deps.resetChartInteractionUi();
      const nextState = deps.getState();
      const tab = nextState.chartTabs.find((candidate) => candidate.id === tabId);
      if (shouldHydrateChartTab(tab, nextState.adjustedMode, nextState.includeDividendAdjustments, nextState.includeRightsAdjustments)) {
        void deps.hydrateChartTabData(tabId);
      }
    },
    closeChartTab: (tabId) => {
      deps.setState((state) => ({ ...buildCloseChartTabState(state, tabId), maximizedChartTabId: null }));
      deps.resetChartInteractionUi();
    },
    loadWorkspaceFromLayout: (layoutData) => {
      const persistedWorkspace = parsePersistedWorkspace(layoutData);
      if (!persistedWorkspace) {
        console.error('Failed to load workspace from layout: invalid layout payload');
        return;
      }

      const workspace = restoreWorkspaceState(persistedWorkspace);
      deps.setState({
        chartTabs: workspace.chartTabs,
        activeChartTabId: workspace.activeChartTabId,
        workspaceLayoutMode: resolveWorkspaceLayoutMode(persistedWorkspace),
        maximizedChartTabId: null,
      });
      deps.resetChartInteractionUi();
      // Loading a named layout changes the active workspace but does not yet
      // persist its autosave setting. Keep it dirty for the normal scheduler.
      workspace.chartTabs.forEach((tab) => {
        if (tab.instrument) {
          queueTabHydration(tab.id);
        }
      });
    },
  };
}

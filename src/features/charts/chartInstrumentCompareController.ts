import { readLatestChartData } from '@/platform/chartRequestErrors';
import {
  applyCompareOverlayResult,
  createChartCompareOverlay,
  isSameInstrumentKey,
  loadCompareOverlayResult,
  MAX_COMPARE_OVERLAYS,
  pickCompareOverlayColor,
} from '@/features/charts/compareOverlayService';
import {
  applyEodResultToTab,
  buildInstrumentLoadFailureTab,
  buildInstrumentLoadStartTab,
  loadInstrumentResult,
  type InstrumentDataCache,
} from '@/features/charts/chartInstrumentHydrationService';
import {
  resolveWatchlistNavigationTarget,
} from '@/features/watchlists/watchlistNavigationService';
import type { DesktopApi, InstrumentKey, InstrumentSummary } from '@/platform';
import type {
  ChartStoreState,
  ChartTabState,
  ToastMessage,
} from '@/store/chartStoreTypes';
import type { ChartCompareOverlay } from '@/engine/types';
import { useUiStore } from '@/store/uiStore';
import { beginChartRequest } from '@/features/charts/chartLoadGuard';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface ChartInstrumentCompareController {
  loadInstrument: (
    key: InstrumentKey,
    meta?: InstrumentSummary | null,
    options?: { forceReload?: boolean; preserveViewport?: boolean },
  ) => Promise<void>;
  navigateSymbol: (direction: 'next' | 'prev') => void;
  addCompareOverlay: (instrument: InstrumentSummary) => Promise<void>;
  removeCompareOverlay: (compareId: string) => void;
}

interface ChartInstrumentCompareControllerDeps {
  getApi: () => DesktopApi | null;
  getState: () => ChartStoreState;
  setState: (update: StoreStateUpdate) => void;
  instrumentDataCache: InstrumentDataCache;
  addToast: (
    message: ToastMessage['message'],
    type?: ToastMessage['type'],
    title?: ToastMessage['title'],
  ) => void;
}

function shouldWarnOnMissingActiveChartTab(): boolean {
  return typeof window !== 'undefined' && window.location.protocol !== 'tauri:';
}

function resolveActiveChartTab(
  chartTabs: ChartTabState[],
  activeChartTabId: string,
): ChartTabState | null {
  const activeTab = chartTabs.find((tab) => tab.id === activeChartTabId);
  if (activeTab) {
    return activeTab;
  }

  const fallbackTab = chartTabs[0] ?? null;
  if (fallbackTab && shouldWarnOnMissingActiveChartTab()) {
    console.warn('[chart-instrument-compare] active chart tab missing, falling back to first tab', {
      activeChartTabId,
      fallbackTabId: fallbackTab.id,
    });
  }

  return fallbackTab;
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

function updateChartTabById(
  state: Pick<ChartStoreState, 'chartTabs'>,
  tabId: string,
  updater: (tab: ChartTabState) => ChartTabState,
): Pick<ChartStoreState, 'chartTabs'> {
  return {
    chartTabs: state.chartTabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
  };
}

export function createChartInstrumentCompareController(
  deps: ChartInstrumentCompareControllerDeps,
): ChartInstrumentCompareController {
  const loadInstrument = async (
    key: InstrumentKey,
    meta?: InstrumentSummary | null,
    options?: { forceReload?: boolean; preserveViewport?: boolean },
  ) => {
    const api = deps.getApi();
    if (!api) {
      return;
    }

    const adjusted = deps.getState().adjustedMode;
    const includeDividendAdjustments = deps.getState().includeDividendAdjustments;
    const includeRightsAdjustments = deps.getState().includeRightsAdjustments;
    const databasePath = deps.getState().snapshot?.activeDatabasePath ?? null;
    const symbolLinkEnabled = useUiStore.getState().symbolLinkEnabled;

    // Snapshot viewport for every tab BEFORE buildInstrumentLoadStartTab zeroes it
    // for new instruments. This is the viewport we want to restore after load.
    const preLoadState = deps.getState();
    const targetIds = preLoadState.chartTabs
      .filter((tab) => tab.id === preLoadState.activeChartTabId || symbolLinkEnabled)
      .map((tab) => tab.id);
    const request = beginChartRequest(deps.instrumentDataCache, targetIds);
    const canApply = (state: ChartStoreState, tab: ChartTabState) => {
      const instrument = tab.requestedInstrument ?? tab.instrument;
      return request.isCurrent(tab.id)
        && state.snapshot?.activeDatabasePath === databasePath
        && state.adjustedMode === adjusted
        && state.includeDividendAdjustments === includeDividendAdjustments
        && state.includeRightsAdjustments === includeRightsAdjustments
        && instrument?.symbol === key.symbol && instrument.exchange === key.exchange;
    };
    const viewportSnapshot = new Map<string, import('@/engine/types').Viewport>(
      preLoadState.chartTabs.map((tab) => [tab.id, tab.viewport]),
    );

    deps.setState((state) => ({
      isLoadingBars: true,
      chartTabs: state.chartTabs.map((tab) =>
        targetIds.includes(tab.id)
          ? buildInstrumentLoadStartTab(tab, key, meta)
          : tab,
      ),
    }));

    try {
      const result = await readLatestChartData((retry) => loadInstrumentResult({
        api,
        databasePath,
        instrument: key,
        adjusted,
        includeDividendAdjustments,
        includeRightsAdjustments,
        instrumentDataCache: deps.instrumentDataCache,
        forceReload: retry ? false : options?.forceReload,
        resolveIdentity: meta?.isActive === false ? false : undefined,
      }), () => deps.getState().chartTabs.some((tab) => canApply(deps.getState(), tab)));
      deps.setState((state) => ({
        isLoadingBars: state.chartTabs.some((tab) => tab.id === state.activeChartTabId && canApply(state, tab))
          ? false : state.isLoadingBars,
        chartTabs: state.chartTabs.map((tab) =>
          canApply(state, tab)
            ? applyEodResultToTab(
                {
                  ...tab,
                  instrumentMeta: meta ?? result.instrument ?? tab.instrumentMeta,
                },
                key,
                result,
                options?.preserveViewport ?? true,
                viewportSnapshot.get(tab.id),
              )
            : tab,
        ),
      }));
    } catch (error) {
      if (!deps.getState().chartTabs.some((tab) => canApply(deps.getState(), tab))) return;
      deps.setState((state) => ({
        isLoadingBars: state.chartTabs.some((tab) => tab.id === state.activeChartTabId && canApply(state, tab))
          ? false : state.isLoadingBars,
        chartTabs: state.chartTabs.map((tab) => canApply(state, tab)
          ? buildInstrumentLoadFailureTab(tab, key, meta, adjusted, includeDividendAdjustments, includeRightsAdjustments)
          : tab),
      }));
      deps.addToast(
        `Failed to load data for ${key.exchange}:${key.symbol}. ${error instanceof Error ? error.message : String(error)}`,
        'error',
        'Load Failure',
      );
    }
  };

  const addCompareOverlay = async (instrument: InstrumentSummary) => {
    const api = deps.getApi();
    const activeState = deps.getState();
    const activeTab = resolveActiveChartTab(activeState.chartTabs, activeState.activeChartTabId);
    if (!api || !activeTab) {
      return;
    }

    const baseInstrument = activeTab.requestedInstrument ?? activeTab.instrument;
    if (!baseInstrument) {
      deps.addToast('Load a base chart before adding a compare symbol.', 'info', 'Compare');
      return;
    }

    const compareInstrument = { symbol: instrument.symbol, exchange: instrument.exchange };
    if (isSameInstrumentKey(compareInstrument, baseInstrument)) {
      deps.addToast('The compare symbol already matches the base chart.', 'warning', 'Compare');
      return;
    }

    if (
      activeTab.compareOverlays.some((overlay) =>
        isSameInstrumentKey(overlay.instrument, compareInstrument),
      )
    ) {
      deps.addToast('That compare symbol is already on the chart.', 'info', 'Compare');
      return;
    }

    if (activeTab.compareOverlays.length >= MAX_COMPARE_OVERLAYS) {
      deps.addToast('Compare overlays are limited to three symbols per chart.', 'warning', 'Compare');
      return;
    }

    const compareOverlay: ChartCompareOverlay = createChartCompareOverlay(
      {
        id: crypto.randomUUID(),
        instrument: compareInstrument,
        instrumentMeta: instrument,
        color: pickCompareOverlayColor(activeTab.compareOverlays),
      },
      activeTab.timeframe,
      activeTab.chartType,
      activeTab.renkoBrickSize,
      activeTab.renkoSettings,
    );
    const databasePath = activeState.snapshot?.activeDatabasePath ?? null;
    const generation = deps.instrumentDataCache.getGeneration?.();
    const canApplyCompare = () => {
      const state = deps.getState();
      const current = state.chartTabs.find((tab) => tab.id === tabId);
      return (state.snapshot?.activeDatabasePath ?? null) === databasePath
        && generation === deps.instrumentDataCache.getGeneration?.()
        && isSameInstrumentKey(current?.requestedInstrument ?? current?.instrument, baseInstrument)
        && state.adjustedMode === adjusted
        && state.includeDividendAdjustments === includeDividendAdjustments
        && state.includeRightsAdjustments === includeRightsAdjustments;
    };
    const adjusted = activeState.adjustedMode;
    const includeDividendAdjustments = activeState.includeDividendAdjustments;
    const includeRightsAdjustments = activeState.includeRightsAdjustments;
    const tabId = activeTab.id;

    deps.setState((state) => ({
      ...updateChartTabById(state, tabId, (tab) => ({
        ...tab,
        compareOverlays: [...tab.compareOverlays, compareOverlay],
      })),
    }));

    try {
      const result = await loadCompareOverlayResult(
        compareOverlay,
        adjusted,
        includeDividendAdjustments,
        includeRightsAdjustments,
        {
          api,
          databasePath,
          readCachedInstrumentData: deps.instrumentDataCache.read,
          writeCachedInstrumentData: deps.instrumentDataCache.write,
          cacheGeneration: deps.instrumentDataCache.getGeneration,
          requestOwner: deps.instrumentDataCache,
        },
      );
      if (!canApplyCompare()) return;
      deps.setState((state) => ({
        ...updateChartTabById(state, tabId, (tab) => ({
          ...tab,
          compareOverlays: tab.compareOverlays.map((overlay) =>
            overlay.id === compareOverlay.id
              ? applyCompareOverlayResult(
                  compareOverlay,
                  result,
                  tab.timeframe,
                  tab.chartType,
                  tab.renkoBrickSize,
                  tab.renkoSettings,
                )
              : overlay,
          ),
        })),
      }));
    } catch {
      if (!canApplyCompare()) return;
      deps.setState((state) => ({
        ...updateChartTabById(state, tabId, (tab) => ({
          ...tab,
          compareOverlays: tab.compareOverlays.filter((overlay) => overlay.id !== compareOverlay.id),
        })),
      }));
      deps.addToast(
        `Unable to load compare data for ${compareInstrument.exchange}:${compareInstrument.symbol}.`,
        'warning',
        'Compare',
      );
    }
  };

  return {
    loadInstrument,
    navigateSymbol: (direction) => {
      const state = deps.getState();
      const target = resolveWatchlistNavigationTarget({
        watchlists: state.snapshot?.watchlists ?? [],
        selectedWatchlistId: state.selectedWatchlistId,
        currentInstrument:
          resolveActiveChartTab(state.chartTabs, state.activeChartTabId)?.instrument ?? null,
        direction,
      });
      if (target) {
        void loadInstrument(target.key, target.meta);
      }
    },
    addCompareOverlay,
    removeCompareOverlay: (compareId) =>
      deps.setState((state) => ({
        ...updateActiveTab(state, (tab) => ({
          ...tab,
          compareOverlays: tab.compareOverlays.filter((overlay) => overlay.id !== compareId),
        })),
      })),
  };
}

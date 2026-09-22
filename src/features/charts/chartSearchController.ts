import {
  buildEmptySearchResultsState,
  buildEmptySymbolBrowserState,
  loadSymbolBrowserState,
  searchChartSymbols,
} from '@/features/charts/chartSymbolSearchService';
import type { ChartStoreState } from '@/store/chartStoreTypes';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface ChartSearchController {
  setSearchQuery: (query: string) => void;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
  setSymbolBrowserQuery: (query: string) => void;
  setSymbolExchangeFilter: (filter: ChartStoreState['symbolExchangeFilter']) => void;
  setSymbolSeriesFilter: (filter: ChartStoreState['symbolSeriesFilter']) => void;
  refreshSymbolBrowser: (query?: string) => Promise<void>;
}

interface ChartSearchControllerDeps {
  getState: () => ChartStoreState;
  setState: (update: StoreStateUpdate) => void;
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', title?: string) => void;
}

export function createChartSearchController(
  deps: ChartSearchControllerDeps,
): ChartSearchController {
  let latestSearchRequestId = 0;
  let latestSymbolBrowserRequestId = 0;
  let symbolBrowserDebounceTimer: number | null = null;

  const runSearch = async (query: string) => {
    const requestId = ++latestSearchRequestId;
    const requestedDatabasePath = deps.getState().snapshot?.activeDatabasePath ?? null;
    const results = await searchChartSymbols(requestedDatabasePath, query);
    const state = deps.getState();
    if (requestId !== latestSearchRequestId) {
      return;
    }
    if (state.searchQuery !== query) {
      return;
    }
    if ((state.snapshot?.activeDatabasePath ?? null) !== requestedDatabasePath) {
      return;
    }
    deps.setState({ searchResults: results });
  };

  const refreshSymbolBrowser = async (query?: string) => {
    const requestId = ++latestSymbolBrowserRequestId;
    const activeDatabasePath = deps.getState().snapshot?.activeDatabasePath ?? null;
    if (!activeDatabasePath) {
      deps.setState(buildEmptySymbolBrowserState());
      return;
    }

    deps.setState({ isSymbolBrowserLoading: true });

    try {
      const effectiveQuery = query ?? deps.getState().symbolBrowserQuery;
      const effectiveExchangeFilter = deps.getState().symbolExchangeFilter;
      const result = await loadSymbolBrowserState(
        activeDatabasePath,
        effectiveQuery,
        effectiveExchangeFilter,
      );
      if (!result) {
        deps.setState(buildEmptySymbolBrowserState());
        return;
      }

      const state = deps.getState();
      if (requestId !== latestSymbolBrowserRequestId) {
        return;
      }

      if (state.snapshot?.activeDatabasePath !== result.requestedDatabasePath) {
        deps.setState({ isSymbolBrowserLoading: false });
        return;
      }

      if (
        effectiveQuery !== state.symbolBrowserQuery ||
        effectiveExchangeFilter !== state.symbolExchangeFilter
      ) {
        return;
      }

      deps.setState(result.state);
    } catch (error) {
      const state = deps.getState();
      if (requestId !== latestSymbolBrowserRequestId) {
        return;
      }

      if ((state.snapshot?.activeDatabasePath ?? null) !== activeDatabasePath) {
        deps.setState({ isSymbolBrowserLoading: false });
        return;
      }

      const effectiveQuery = query ?? state.symbolBrowserQuery;
      if (effectiveQuery !== state.symbolBrowserQuery) {
        deps.setState({ isSymbolBrowserLoading: false });
        return;
      }

      deps.setState({ isSymbolBrowserLoading: false });
      deps.addToast(
        error instanceof Error ? error.message : 'Unable to load symbol browser.',
        'warning',
        'Symbol Browser',
      );
    }
  };

  return {
    setSearchQuery: (query) => {
      deps.setState({ searchQuery: query });
      if (!query.trim()) {
        deps.setState(buildEmptySearchResultsState());
        return;
      }
      void runSearch(query);
    },
    runSearch,
    clearSearch: () => deps.setState({ searchQuery: '', ...buildEmptySearchResultsState() }),
    setSymbolBrowserQuery: (query) => {
      deps.setState({ symbolBrowserQuery: query });
      if (symbolBrowserDebounceTimer !== null) {
        clearTimeout(symbolBrowserDebounceTimer);
        symbolBrowserDebounceTimer = null;
      }
      if (!query.trim()) {
        void refreshSymbolBrowser(query);
        return;
      }
      symbolBrowserDebounceTimer = window.setTimeout(() => {
        symbolBrowserDebounceTimer = null;
        void refreshSymbolBrowser(query);
      }, 150);
    },
    setSymbolExchangeFilter: (filter) => {
      deps.setState({ symbolExchangeFilter: filter });
      void refreshSymbolBrowser();
    },
    setSymbolSeriesFilter: (filter) => {
      deps.setState({ symbolSeriesFilter: filter });
      void refreshSymbolBrowser();
    },
    refreshSymbolBrowser,
  };
}

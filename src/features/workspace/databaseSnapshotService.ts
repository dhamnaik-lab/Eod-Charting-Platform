import type {
  AppSnapshot,
  DesktopApi,
  InstrumentSummary,
  SnapshotOptions,
  Watchlist,
} from '@/platform';
import type { SymbolExchangeFilter } from '@/types/desktop';
import { fetchWatchlists } from '@/features/watchlists/watchlistService';
import { parseSymbolBrowserQuery } from '@/features/charts/chartSymbolSearchService';

export interface RefreshSnapshotOptions {
  refreshSymbolBrowser?: boolean;
  refreshDbStats?: boolean;
}

export const LIGHTWEIGHT_SNAPSHOT_OPTIONS: SnapshotOptions = {
  includeStats: false,
  includeWatchlists: false,
};

export async function fetchLightweightAppSnapshot(api: DesktopApi): Promise<AppSnapshot> {
  return api.getAppSnapshot(LIGHTWEIGHT_SNAPSHOT_OPTIONS);
}

export async function loadSnapshotHydrationDetails(
  api: DesktopApi,
  snapshot: AppSnapshot,
): Promise<{ watchlists: Watchlist[] }> {
  try {
    return {
      watchlists: await fetchWatchlists(),
    };
  } catch {
    return {
      watchlists: snapshot.watchlists,
    };
  }
}

export async function loadDeferredDbStats(
  api: DesktopApi,
  snapshot: AppSnapshot,
): Promise<AppSnapshot['dbStats']> {
  try {
    return await api.getDbStats();
  } catch {
    return snapshot.dbStats;
  }
}

export async function loadActiveDatabaseRefreshState(params: {
  api: DesktopApi;
  snapshot: AppSnapshot;
  currentSnapshot: AppSnapshot | null;
  symbolBrowserQuery: string;
  symbolExchangeFilter: SymbolExchangeFilter;
  currentSymbolBrowserItems: InstrumentSummary[];
  options?: RefreshSnapshotOptions;
}): Promise<{
  watchlists: Watchlist[];
  dbStats: AppSnapshot['dbStats'];
  symbolBrowserItems: InstrumentSummary[];
}> {
  const {
    api,
    snapshot,
    currentSnapshot,
    symbolBrowserQuery,
    symbolExchangeFilter,
    currentSymbolBrowserItems,
    options,
  } = params;
  const shouldRefreshDbStats = options?.refreshDbStats || !currentSnapshot?.dbStats;
  const parsedSymbolBrowserQuery = parseSymbolBrowserQuery(symbolBrowserQuery, symbolExchangeFilter);

  const [watchlists, dbStats, symbolBrowserItems] = await Promise.all([
    fetchWatchlists(),
    shouldRefreshDbStats
      ? api.getDbStats()
      : Promise.resolve(currentSnapshot?.dbStats ?? snapshot.dbStats),
    options?.refreshSymbolBrowser
      ? api.listSymbols({
          query: parsedSymbolBrowserQuery.query,
          exchange: parsedSymbolBrowserQuery.exchangeFilter === 'all' ? null : parsedSymbolBrowserQuery.exchangeFilter,
          limit: 700,
          seriesFilter: 'all',
          includeInactive: true,
        })
      : Promise.resolve(currentSymbolBrowserItems),
  ]);

  return {
    watchlists,
    dbStats,
    symbolBrowserItems,
  };
}

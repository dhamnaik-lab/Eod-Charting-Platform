import { getDesktopApi, type InstrumentSummary } from '@/platform';
import type { SymbolExchangeFilter } from '@/types/desktop';

const SYMBOL_EXCHANGE_PREFIX_PATTERN = /^(NSE|BSE)\s*:\s*/i;

export interface SymbolBrowserStatePatch {
  symbolBrowserItems: InstrumentSummary[];
  symbolBrowserLoadedDatabasePath: string | null;
  isSymbolBrowserLoading: boolean;
}

export interface SymbolBrowserLoadResult {
  requestedDatabasePath: string;
  state: SymbolBrowserStatePatch;
}

export function buildEmptySearchResultsState(): Pick<{ searchResults: InstrumentSummary[] }, 'searchResults'> {
  return { searchResults: [] };
}

export function buildEmptySymbolBrowserState(): SymbolBrowserStatePatch {
  return {
    symbolBrowserItems: [],
    symbolBrowserLoadedDatabasePath: null,
    isSymbolBrowserLoading: false,
  };
}

export async function searchChartSymbols(
  activeDatabasePath: string | null,
  query: string,
): Promise<InstrumentSummary[]> {
  const api = getDesktopApi();
  if (!api || !activeDatabasePath) {
    return [];
  }

  return api.searchSymbols({ query });
}

export async function loadSymbolBrowserState(
  activeDatabasePath: string | null,
  query: string,
  exchangeFilter: SymbolExchangeFilter,
): Promise<SymbolBrowserLoadResult | null> {
  const api = getDesktopApi();
  if (!api || !activeDatabasePath) {
    return null;
  }

  const parsedQuery = parseSymbolBrowserQuery(query, exchangeFilter);
  const symbolBrowserItems = await api.listSymbols({
    query: parsedQuery.query,
    exchange: parsedQuery.exchangeFilter === 'all' ? null : parsedQuery.exchangeFilter,
    limit: 50000,
    seriesFilter: 'all',
    includeInactive: true,
  });

  return {
    requestedDatabasePath: activeDatabasePath,
    state: {
      symbolBrowserItems,
      symbolBrowserLoadedDatabasePath: activeDatabasePath,
      isSymbolBrowserLoading: false,
    },
  };
}

export function parseSymbolBrowserQuery(
  query: string,
  exchangeFilter: SymbolExchangeFilter,
): { query: string; exchangeFilter: SymbolExchangeFilter } {
  const match = query.match(SYMBOL_EXCHANGE_PREFIX_PATTERN);
  if (!match) {
    return { query, exchangeFilter };
  }

  return {
    query: query.slice(match[0].length).trimStart(),
    exchangeFilter: match[1].toUpperCase() as Exclude<SymbolExchangeFilter, 'all'>,
  };
}

import type { InstrumentKey, InstrumentSummary, Watchlist } from '@/platform';

export type WatchlistNavigationDirection = 'next' | 'prev';

export interface WatchlistNavigationTarget {
  key: InstrumentKey;
  meta: InstrumentSummary;
}

export function findSelectedWatchlist(
  watchlists: Watchlist[],
  watchlistId: number | null,
): Watchlist | null {
  return watchlists.find((watchlist) => watchlist.id === watchlistId) ?? null;
}

function buildWatchlistNavigationTarget(
  watchlist: Watchlist,
  itemIndex: number,
): WatchlistNavigationTarget | null {
  const item = watchlist.items[itemIndex];
  if (!item) {
    return null;
  }

  return {
    key: {
      symbol: item.symbol,
      exchange: item.exchange,
    },
    meta: {
      symbol: item.symbol,
      exchange: item.exchange,
      name: item.name ?? null,
      series: null,
      isin: null,
    },
  };
}

export function resolveWatchlistNavigationTarget(params: {
  watchlists: Watchlist[];
  selectedWatchlistId: number | null;
  currentInstrument: InstrumentKey | null;
  direction: WatchlistNavigationDirection;
}): WatchlistNavigationTarget | null {
  const selectedWatchlist = findSelectedWatchlist(params.watchlists, params.selectedWatchlistId);
  if (!selectedWatchlist || selectedWatchlist.items.length === 0) {
    return null;
  }

  if (!params.currentInstrument) {
    return buildWatchlistNavigationTarget(selectedWatchlist, 0);
  }

  const currentIndex = selectedWatchlist.items.findIndex(
    (item) =>
      item.symbol === params.currentInstrument?.symbol &&
      item.exchange === params.currentInstrument?.exchange,
  );

  let nextIndex: number;
  if (currentIndex === -1) {
    nextIndex = 0;
  } else if (params.direction === 'next') {
    nextIndex = (currentIndex + 1) % selectedWatchlist.items.length;
  } else {
    nextIndex = (currentIndex - 1 + selectedWatchlist.items.length) % selectedWatchlist.items.length;
  }

  return buildWatchlistNavigationTarget(selectedWatchlist, nextIndex);
}

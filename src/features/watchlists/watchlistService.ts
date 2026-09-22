import {
  requireDesktopApi,
  type InstrumentKey,
  type SourceLinkedWatchlistReplaceInput,
  type Watchlist,
  type WatchlistCreateInput,
  type WatchlistSourceMeta,
} from '@/platform';

export async function fetchWatchlists(): Promise<Watchlist[]> {
  return requireDesktopApi().getWatchlists();
}

export async function createWatchlist(
  input: WatchlistCreateInput,
  sourceMeta?: WatchlistSourceMeta | null,
): Promise<Watchlist> {
  return requireDesktopApi().createWatchlist({ ...input, sourceMeta: sourceMeta ?? null });
}

export async function renameWatchlist(watchlistId: number, name: string): Promise<Watchlist> {
  return requireDesktopApi().renameWatchlist({ watchlistId, name });
}

export async function deleteWatchlist(watchlistId: number): Promise<void> {
  await requireDesktopApi().deleteWatchlist({ watchlistId });
}

export async function addInstrumentToWatchlist(
  watchlistId: number,
  instrument: InstrumentKey,
): Promise<void> {
  await requireDesktopApi().addToWatchlist({
    watchlistId,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
  });
}

export async function removeInstrumentFromWatchlist(
  watchlistId: number,
  instrument: InstrumentKey,
): Promise<void> {
  await requireDesktopApi().removeFromWatchlist({
    watchlistId,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
  });
}

export async function applyOfficialWatchlistUpdate(input: {
  watchlistId: number;
  symbolsToAdd: Array<{ symbol: string; exchange: string }>;
  symbolsToRemove: Array<{ symbol: string; exchange: string }>;
  lastSyncedAt: string;
}): Promise<void> {
  await requireDesktopApi().applyOfficialWatchlistUpdate(input);
}

export async function replaceSourceLinkedWatchlist(
  input: SourceLinkedWatchlistReplaceInput,
): Promise<void> {
  await requireDesktopApi().replaceSourceLinkedWatchlist(input);
}

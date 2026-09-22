import { getDesktopApi, type AppSnapshot, type InstrumentKey, type Watchlist, type WatchlistCreateInput } from '@/platform';
import { type OfficialWatchlistSourceId } from '@/features/watchlists/officialWatchlistProviders';
import {
  type OfficialImportResult,
  type OfficialUpdateResult,
} from '@/features/watchlists/officialWatchlistImportService';
import {
  addInstrumentToWatchlist,
  createWatchlist as createWatchlistCommand,
  deleteWatchlist as deleteWatchlistCommand,
  fetchWatchlists,
  removeInstrumentFromWatchlist,
  renameWatchlist as renameWatchlistCommand,
} from '@/features/watchlists/watchlistService';

export type WatchlistToastType = 'info' | 'success' | 'warning' | 'error';

export interface WatchlistRefreshResult {
  watchlists: Watchlist[];
  selectedWatchlistId: number | null;
}

export interface WatchlistSnapshotState {
  snapshot: AppSnapshot | null;
  selectedWatchlistId: number | null;
}

export interface WatchlistToastDescriptor {
  title: string;
  message: string;
  type: WatchlistToastType;
}

export interface WatchlistToastWorkflowResult {
  refreshedState: WatchlistRefreshResult;
  toast: WatchlistToastDescriptor;
}

export interface UpdateAllOfficialWatchlistsWorkflowResult {
  refreshedState: WatchlistRefreshResult | null;
  toast: WatchlistToastDescriptor;
}

interface UpdateAllOfficialWatchlistsSummary {
  added: number;
  removed: number;
  unchanged: number;
  unresolved: number;
}

async function loadOfficialWatchlistImportService() {
  return import('@/features/watchlists/officialWatchlistImportService');
}

function requireActiveDatabasePath(snapshot: AppSnapshot | null, errorMessage: string): string {
  if (!snapshot?.activeDatabasePath) {
    throw new Error(errorMessage);
  }

  return snapshot.activeDatabasePath;
}

function requireDesktopDatabase(snapshot: AppSnapshot | null, errorMessage: string): void {
  requireActiveDatabasePath(snapshot, errorMessage);
  if (!getDesktopApi()) {
    throw new Error(errorMessage);
  }
}

async function refreshWatchlistsStateOrThrow(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
): Promise<WatchlistRefreshResult> {
  const refreshedState = await refreshWatchlistsState(snapshot, selectedWatchlistId);
  if (!refreshedState) {
    throw new Error('Open a database before refreshing watchlists.');
  }

  return refreshedState;
}

function buildOfficialImportToast(result: OfficialImportResult): WatchlistToastDescriptor {
  const createdCount = result.createdWatchlists.length;
  const replacedCount = result.replacedWatchlists.length;
  const skippedCount = result.skippedExistingWatchlists.length;
  const removedDuplicateCount = result.removedDuplicateWatchlists.length;
  const appliedCount = createdCount + replacedCount;
  const importedSymbolCount = [...result.createdWatchlists, ...result.replacedWatchlists].reduce(
    (sum, entry) => sum + entry.importedCount,
    0,
  );
  const messageParts = [
    `Watchlists: ${createdCount} created, ${replacedCount} replaced, ${skippedCount} already linked`,
    `Duplicate linked rows removed: ${removedDuplicateCount}`,
    `Symbols applied: ${importedSymbolCount}`,
    `Unresolved: ${result.unresolvedMembers.length}`,
  ];

  return {
    title: 'Imported Watchlists',
    message:
      appliedCount === 0 && skippedCount > 0
        ? `${messageParts.join('. ')}. Reuse Update for already-linked watchlists.`
        : `${messageParts.join('. ')}.`,
    type:
      appliedCount === 0 && skippedCount > 0
        ? 'info'
        : result.unresolvedMembers.length || skippedCount
          ? 'warning'
          : 'success',
  };
}

function buildOfficialUpdateToast(result: OfficialUpdateResult): WatchlistToastDescriptor {
  return {
    title: 'Watchlist Update',
    message: `${result.watchlistName}: ${result.added} added, ${result.removed} removed, ${result.unchanged} unchanged, ${result.unresolvedCount} unresolved.`,
    type: result.unresolvedCount ? 'warning' : 'success',
  };
}

function buildUpdateAllOfficialWatchlistsToast(
  updated: number,
  total: number,
  failed: number,
  summary: UpdateAllOfficialWatchlistsSummary,
): WatchlistToastDescriptor {
  const baseMessage = failed
    ? `Updated ${updated} of ${total} watchlists, ${failed} failed`
    : `Updated ${updated} watchlist${updated !== 1 ? 's' : ''}`;

  return {
    title: 'Update All Imported Watchlists',
    message: `${baseMessage}. Symbols: ${summary.added} added, ${summary.removed} removed, ${summary.unchanged} unchanged, ${summary.unresolved} unresolved.`,
    type: failed || summary.unresolved ? 'warning' : 'success',
  };
}

export function resolveSelectedWatchlistId(
  watchlists: Watchlist[],
  selectedWatchlistId: number | null,
): number | null {
  if (
    selectedWatchlistId !== null &&
    watchlists.some((watchlist) => watchlist.id === selectedWatchlistId)
  ) {
    return selectedWatchlistId;
  }

  return watchlists[0]?.id ?? null;
}

export function createWatchlistInput(
  name: string,
  sourceMeta?: WatchlistCreateInput['sourceMeta'],
): WatchlistCreateInput {
  return {
    name,
    sourceMeta: sourceMeta ?? null,
  };
}

export function buildWatchlistSnapshotState(
  snapshot: AppSnapshot | null,
  watchlists: Watchlist[],
  selectedWatchlistId: number | null,
): WatchlistSnapshotState {
  return {
    snapshot: snapshot
      ? {
          ...snapshot,
          watchlists,
        }
      : snapshot,
    selectedWatchlistId,
  };
}

export async function refreshWatchlistsState(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
): Promise<WatchlistRefreshResult | null> {
  if (!snapshot?.activeDatabasePath) {
    return null;
  }

  const watchlists = await fetchWatchlists();
  return {
    watchlists,
    selectedWatchlistId: resolveSelectedWatchlistId(watchlists, selectedWatchlistId),
  };
}

export async function createWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  name: string,
): Promise<WatchlistRefreshResult> {
  requireActiveDatabasePath(snapshot, 'Open a database first to create a watchlist.');

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Watchlist name is required.');
  }

  const watchlist = await createWatchlistCommand(createWatchlistInput(trimmedName));
  return refreshWatchlistsStateOrThrow(snapshot, watchlist.id);
}

export async function renameWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  watchlistId: number,
  name: string,
): Promise<WatchlistRefreshResult> {
  requireActiveDatabasePath(snapshot, 'Open a database before renaming a watchlist.');

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Watchlist name is required.');
  }

  await renameWatchlistCommand(watchlistId, trimmedName);
  return refreshWatchlistsStateOrThrow(snapshot, watchlistId);
}

export async function deleteWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  watchlistId: number,
  selectedWatchlistId: number | null,
): Promise<WatchlistRefreshResult> {
  requireActiveDatabasePath(snapshot, 'Open a database before deleting a watchlist.');

  await deleteWatchlistCommand(watchlistId);
  return refreshWatchlistsStateOrThrow(snapshot, selectedWatchlistId);
}

export async function importOfficialWatchlistsAndRefresh(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
  sourceId: OfficialWatchlistSourceId,
  groupIds: string[],
): Promise<WatchlistToastWorkflowResult> {
  requireDesktopDatabase(snapshot, 'Open a database before importing watchlist groups.');

  const { runOfficialWatchlistImport } = await loadOfficialWatchlistImportService();
  const result = await runOfficialWatchlistImport(
    snapshot?.watchlists ?? [],
    sourceId,
    groupIds,
  );

  return {
    refreshedState: await refreshWatchlistsStateOrThrow(
      snapshot,
      result.selectWatchlistId ?? selectedWatchlistId,
    ),
    toast: buildOfficialImportToast(result),
  };
}

export async function updateOfficialWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
  watchlistId: number,
): Promise<WatchlistToastWorkflowResult> {
  requireDesktopDatabase(snapshot, 'Open a database before updating an imported watchlist.');

  const watchlist = (snapshot?.watchlists ?? []).find((candidate) => candidate.id === watchlistId);
  if (!watchlist) {
    throw new Error('Select an existing watchlist before updating.');
  }

  const { runOfficialWatchlistUpdate } = await loadOfficialWatchlistImportService();
  const result = await runOfficialWatchlistUpdate(watchlist);

  return {
    refreshedState: await refreshWatchlistsStateOrThrow(snapshot, selectedWatchlistId),
    toast: buildOfficialUpdateToast(result),
  };
}

export async function updateAllOfficialWatchlistsAndRefresh(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
): Promise<UpdateAllOfficialWatchlistsWorkflowResult> {
  requireDesktopDatabase(snapshot, 'Open a database before updating watchlists.');

  const officialWatchlists = (snapshot?.watchlists ?? []).filter(
    (watchlist) => watchlist.sourceMeta?.sourceType === 'official',
  );
  if (!officialWatchlists.length) {
    return {
      refreshedState: null,
      toast: {
        title: 'Update All Imported Watchlists',
        message: 'No imported watchlists to update.',
        type: 'info',
      },
    };
  }

  let updated = 0;
  let failed = 0;
  const summary: UpdateAllOfficialWatchlistsSummary = {
    added: 0,
    removed: 0,
    unchanged: 0,
    unresolved: 0,
  };
  const { runOfficialWatchlistUpdate } = await loadOfficialWatchlistImportService();

  for (const watchlist of officialWatchlists) {
    try {
      const result = await runOfficialWatchlistUpdate(watchlist);
      updated += 1;
      summary.added += result.added;
      summary.removed += result.removed;
      summary.unchanged += result.unchanged;
      summary.unresolved += result.unresolvedCount;
    } catch (error) {
      failed += 1;
      console.error('[official-watchlist-update-all] failed', {
        watchlistId: watchlist.id,
        watchlistName: watchlist.name,
        error,
      });
    }
  }

  return {
    refreshedState: await refreshWatchlistsStateOrThrow(snapshot, selectedWatchlistId),
    toast: buildUpdateAllOfficialWatchlistsToast(
      updated,
      officialWatchlists.length,
      failed,
      summary,
    ),
  };
}

export async function addInstrumentToWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
  watchlistId: number,
  instrument: InstrumentKey,
): Promise<WatchlistRefreshResult> {
  await addInstrumentToWatchlist(watchlistId, instrument);
  return refreshWatchlistsStateOrThrow(snapshot, selectedWatchlistId);
}

export async function removeInstrumentFromWatchlistAndRefresh(
  snapshot: AppSnapshot | null,
  selectedWatchlistId: number | null,
  watchlistId: number,
  instrument: InstrumentKey,
): Promise<WatchlistRefreshResult> {
  await removeInstrumentFromWatchlist(watchlistId, instrument);
  return refreshWatchlistsStateOrThrow(snapshot, selectedWatchlistId);
}

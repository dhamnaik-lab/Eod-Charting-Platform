import {
  addInstrumentToWatchlistAndRefresh,
  buildWatchlistSnapshotState,
  createWatchlistAndRefresh,
  deleteWatchlistAndRefresh,
  importOfficialWatchlistsAndRefresh,
  removeInstrumentFromWatchlistAndRefresh,
  renameWatchlistAndRefresh,
  resolveSelectedWatchlistId,
  updateAllOfficialWatchlistsAndRefresh,
  updateOfficialWatchlistAndRefresh,
} from '@/features/watchlists/watchlistOrchestrationService';
import type {
  OfficialWatchlistSourceId,
} from '@/features/watchlists/officialWatchlistProviders';
import type { InstrumentKey, Watchlist } from '@/platform';
import type { ChartStoreState, ToastMessage } from '@/store/chartStoreTypes';

type StoreStateUpdate =
  | Partial<ChartStoreState>
  | ((state: ChartStoreState) => Partial<ChartStoreState>);

export interface WatchlistStoreController {
  createWatchlist: (name: string) => Promise<void>;
  renameWatchlist: (watchlistId: number, name: string) => Promise<void>;
  deleteWatchlist: (watchlistId: number) => Promise<void>;
  importOfficialWatchlists: (
    sourceId: OfficialWatchlistSourceId,
    groupIds: string[],
  ) => Promise<void>;
  updateOfficialWatchlist: (watchlistId: number) => Promise<void>;
  updateAllOfficialWatchlists: () => Promise<void>;
  selectWatchlist: (watchlistId: number | null) => void;
  addToWatchlist: (watchlistId: number, instrument: InstrumentKey) => Promise<void>;
  removeFromWatchlist: (watchlistId: number, instrument: InstrumentKey) => Promise<void>;
}

interface WatchlistStoreControllerDeps {
  getState: () => ChartStoreState;
  setState: (update: StoreStateUpdate) => void;
  addToast: (
    message: ToastMessage['message'],
    type?: ToastMessage['type'],
    title?: ToastMessage['title'],
  ) => void;
}

export function createWatchlistStoreController(
  deps: WatchlistStoreControllerDeps,
): WatchlistStoreController {
  const mergeWatchlistsIntoSnapshot = (
    watchlists: Watchlist[],
    selectedWatchlistId?: number | null,
  ) => {
    deps.setState((state) => ({
      ...buildWatchlistSnapshotState(
        state.snapshot,
        watchlists,
        selectedWatchlistId ?? resolveSelectedWatchlistId(watchlists, state.selectedWatchlistId),
      ),
    }));
  };

  return {
    createWatchlist: async (name) => {
      const refreshedState = await createWatchlistAndRefresh(deps.getState().snapshot, name);
      mergeWatchlistsIntoSnapshot(
        refreshedState.watchlists,
        refreshedState.selectedWatchlistId,
      );
    },
    renameWatchlist: async (watchlistId, name) => {
      const refreshedState = await renameWatchlistAndRefresh(
        deps.getState().snapshot,
        watchlistId,
        name,
      );
      mergeWatchlistsIntoSnapshot(
        refreshedState.watchlists,
        refreshedState.selectedWatchlistId,
      );
    },
    deleteWatchlist: async (watchlistId) => {
      const state = deps.getState();
      const refreshedState = await deleteWatchlistAndRefresh(
        state.snapshot,
        watchlistId,
        state.selectedWatchlistId,
      );
      mergeWatchlistsIntoSnapshot(
        refreshedState.watchlists,
        refreshedState.selectedWatchlistId,
      );
    },
    importOfficialWatchlists: async (sourceId, groupIds) => {
      const state = deps.getState();
      const result = await importOfficialWatchlistsAndRefresh(
        state.snapshot,
        state.selectedWatchlistId,
        sourceId,
        groupIds,
      );
      mergeWatchlistsIntoSnapshot(
        result.refreshedState.watchlists,
        result.refreshedState.selectedWatchlistId,
      );
      deps.addToast(result.toast.message, result.toast.type, result.toast.title);
    },
    updateOfficialWatchlist: async (watchlistId) => {
      const state = deps.getState();
      const result = await updateOfficialWatchlistAndRefresh(
        state.snapshot,
        state.selectedWatchlistId,
        watchlistId,
      );
      mergeWatchlistsIntoSnapshot(
        result.refreshedState.watchlists,
        result.refreshedState.selectedWatchlistId,
      );
      deps.addToast(result.toast.message, result.toast.type, result.toast.title);
    },
    updateAllOfficialWatchlists: async () => {
      const state = deps.getState();
      const result = await updateAllOfficialWatchlistsAndRefresh(
        state.snapshot,
        state.selectedWatchlistId,
      );
      if (result.refreshedState) {
        mergeWatchlistsIntoSnapshot(
          result.refreshedState.watchlists,
          result.refreshedState.selectedWatchlistId,
        );
      }
      deps.addToast(result.toast.message, result.toast.type, result.toast.title);
    },
    selectWatchlist: (watchlistId) =>
      deps.setState((state) =>
        state.selectedWatchlistId === watchlistId
          ? state
          : { selectedWatchlistId: watchlistId },
      ),
    addToWatchlist: async (watchlistId, instrument) => {
      const state = deps.getState();
      const refreshedState = await addInstrumentToWatchlistAndRefresh(
        state.snapshot,
        state.selectedWatchlistId,
        watchlistId,
        instrument,
      );
      mergeWatchlistsIntoSnapshot(
        refreshedState.watchlists,
        refreshedState.selectedWatchlistId,
      );
    },
    removeFromWatchlist: async (watchlistId, instrument) => {
      const state = deps.getState();
      const refreshedState = await removeInstrumentFromWatchlistAndRefresh(
        state.snapshot,
        state.selectedWatchlistId,
        watchlistId,
        instrument,
      );
      mergeWatchlistsIntoSnapshot(
        refreshedState.watchlists,
        refreshedState.selectedWatchlistId,
      );
    },
  };
}

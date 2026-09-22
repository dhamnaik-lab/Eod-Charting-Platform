import { create } from 'zustand';
import { getDesktopApi } from '@/platform/desktop';
import type { DailyMarketSnapshotProgressEvent, DailyMarketSnapshotResult } from '@/platform';
import {
  buildMarketMoversSnapshotInWorker,
  cancelMarketMoversSnapshotWorker,
} from './marketMoversSnapshotWorkerClient';
import type {
  MarketMoversFilterSettings,
  MarketMoversSnapshot,
  MarketMoversStatus,
} from './marketMoversTypes';

const SETTINGS_KEY = 'eod-chart.market-movers.settings.v2';

const DEFAULT_SETTINGS: MarketMoversFilterSettings = {
  exchange: 'NSE',
  universeId: 'all-equity',
  resultCount: 10,
  minPrice: 10,
  minVolume: 10_000,
  excludeCorporateActionWarnings: false,
};

function sanitizeSettings(raw: Partial<MarketMoversFilterSettings> | null): MarketMoversFilterSettings {
  const resultCount = raw?.resultCount;
  return {
    exchange: raw?.exchange === 'BSE' || raw?.exchange === 'all' ? raw.exchange : 'NSE',
    universeId: 'all-equity',
    resultCount: resultCount === 5 || resultCount === 20 ? resultCount : 10,
    minPrice: Number.isFinite(raw?.minPrice) && Number(raw?.minPrice) >= 0 ? Number(raw?.minPrice) : 10,
    minVolume:
      Number.isFinite(raw?.minVolume) && Number(raw?.minVolume) >= 0
        ? Math.floor(Number(raw?.minVolume))
        : 10_000,
    excludeCorporateActionWarnings: raw?.excludeCorporateActionWarnings === true,
  };
}

function readStoredSettings(): MarketMoversFilterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(raw ? (JSON.parse(raw) as Partial<MarketMoversFilterSettings>) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeStoredSettings(settings: MarketMoversFilterSettings): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

function criteriaKey(settings: MarketMoversFilterSettings, generation: number): string {
  return [
    generation,
    settings.exchange,
    settings.universeId,
    settings.minPrice,
    settings.minVolume,
    settings.excludeCorporateActionWarnings,
  ].join('|');
}

function statusForSnapshot(snapshot: MarketMoversSnapshot): MarketMoversStatus {
  if (snapshot.asOfDate && snapshot.latestDatabaseDate && snapshot.asOfDate < snapshot.latestDatabaseDate) {
    return 'stale';
  }
  return snapshot.qualifyingSymbolCount > 0 ? 'ready' : 'empty';
}

export interface MarketMoversProgress {
  scanned: number;
  total: number;
  fetched: number;
  failed: number;
  currentSymbol: string | null;
}

interface MarketMoversState {
  settings: MarketMoversFilterSettings;
  snapshot: MarketMoversSnapshot | null;
  status: MarketMoversStatus;
  error: string | null;
  progress: MarketMoversProgress | null;
  databaseRevision: string;
  databaseChangeGeneration: number;
  consumerCount: number;
  initialized: boolean;
  dirty: boolean;
  activeRequestId: number;
  activeBackendRequestId: string | null;
  inFlightKey: string | null;
  inFlightPromise: Promise<MarketMoversSnapshot | null> | null;
  cachedCriteriaKey: string | null;
  cachedSnapshot: MarketMoversSnapshot | null;

  setSettings: (
    updater:
      | Partial<MarketMoversFilterSettings>
      | ((previous: MarketMoversFilterSettings) => MarketMoversFilterSettings),
  ) => void;
  initialize: () => void;
  activateConsumer: () => void;
  deactivateConsumer: () => void;
  refresh: () => Promise<void>;
  runScan: (forcedSettings?: MarketMoversFilterSettings) => Promise<void>;
  cancelScan: () => Promise<void>;
}

let databaseUnlisten: (() => void) | null = null;
let progressUnlisten: (() => void) | null = null;
let nextBackendRequestNumber = 1;

function createBackendRequestId(): string {
  const requestNumber = nextBackendRequestNumber;
  nextBackendRequestNumber += 1;
  return `market-movers-${Date.now()}-${requestNumber}`;
}

export const useMarketMoversStore = create<MarketMoversState>((set, get) => ({
  settings: readStoredSettings(),
  snapshot: null,
  status: 'idle',
  error: null,
  progress: null,
  databaseRevision: 'unknown',
  databaseChangeGeneration: 0,
  consumerCount: 0,
  initialized: false,
  dirty: true,
  activeRequestId: 0,
  activeBackendRequestId: null,
  inFlightKey: null,
  inFlightPromise: null,
  cachedCriteriaKey: null,
  cachedSnapshot: null,

  setSettings: (updater) => {
    const current = get().settings;
    const next = sanitizeSettings(
      typeof updater === 'function' ? updater(current) : { ...current, ...updater },
    );
    writeStoredSettings(next);
    const criteriaChanged =
      current.exchange !== next.exchange ||
      current.minPrice !== next.minPrice ||
      current.minVolume !== next.minVolume ||
      current.excludeCorporateActionWarnings !== next.excludeCorporateActionWarnings;
    set({
      settings: next,
      dirty: criteriaChanged ? true : get().dirty,
      cachedCriteriaKey: criteriaChanged ? null : get().cachedCriteriaKey,
      cachedSnapshot: criteriaChanged ? null : get().cachedSnapshot,
    });
  },

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });
    const api = getDesktopApi();
    if (!api) return;

    if (!databaseUnlisten) {
      databaseUnlisten = api.onDatabaseChanged(() => {
        const nextGeneration = get().databaseChangeGeneration + 1;
        set({
          databaseChangeGeneration: nextGeneration,
          dirty: true,
          cachedCriteriaKey: null,
          cachedSnapshot: null,
        });
        if (get().status === 'loading') void get().cancelScan();
      });
    }

    if (!progressUnlisten && typeof api.onDailyMarketSnapshotProgress === 'function') {
      progressUnlisten = api.onDailyMarketSnapshotProgress(
        (event: DailyMarketSnapshotProgressEvent) => {
          if (event.requestId !== get().activeBackendRequestId) return;
          set({
            progress: {
              scanned: event.processedSymbolCount,
              total: event.targetSymbolCount,
              fetched: event.fetchedSymbolCount,
              failed: event.failedSymbolCount,
              currentSymbol: event.currentSymbol,
            },
          });
        },
      );
    }
  },

  activateConsumer: () => {
    get().initialize();
    set({ consumerCount: get().consumerCount + 1 });
  },

  deactivateConsumer: () => {
    set({ consumerCount: Math.max(0, get().consumerCount - 1) });
  },

  refresh: async () => {
    await get().runScan();
  },

  runScan: async (forcedSettings) => {
    get().initialize();
    const api = getDesktopApi();
    if (!api) {
      set({ status: 'error', error: 'Desktop API is unavailable.' });
      return;
    }
    if (get().inFlightPromise) {
      await get().inFlightPromise;
      return;
    }

    const settings = forcedSettings ?? get().settings;
    const key = criteriaKey(settings, get().databaseChangeGeneration);
    const requestId = get().activeRequestId + 1;
    const backendRequestId = createBackendRequestId();

    set({
      activeRequestId: requestId,
      activeBackendRequestId: backendRequestId,
      inFlightKey: key,
      status: 'loading',
      error: null,
      progress: { scanned: 0, total: 0, fetched: 0, failed: 0, currentSymbol: null },
    });

    const promise = (async (): Promise<MarketMoversSnapshot | null> => {
      const batch: DailyMarketSnapshotResult = await api.getDailyMarketSnapshot({
        requestId: backendRequestId,
        exchange: settings.exchange,
        historySessions: 30,
        adjusted: true,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
      });
      if (get().activeRequestId !== requestId) return null;

      set({
        progress: {
          scanned: batch.targetSymbolCount,
          total: batch.targetSymbolCount,
          fetched: batch.fetchedSymbolCount,
          failed: batch.failedSymbolCount,
          currentSymbol: null,
        },
        databaseRevision: batch.databaseRevision,
      });

      return buildMarketMoversSnapshotInWorker({
        requestId: backendRequestId,
        batch,
        settings,
      });
    })();

    set({ inFlightPromise: promise });
    try {
      const snapshot = await promise;
      if (get().activeRequestId !== requestId || !snapshot) return;
      set({
        snapshot,
        status: statusForSnapshot(snapshot),
        error: null,
        progress: null,
        dirty: false,
        cachedCriteriaKey: key,
        cachedSnapshot: snapshot,
        activeBackendRequestId: null,
        inFlightKey: null,
        inFlightPromise: null,
      });
    } catch (error) {
      if (get().activeRequestId !== requestId) return;
      const previousSnapshot = get().snapshot;
      set({
        status: previousSnapshot ? statusForSnapshot(previousSnapshot) : 'error',
        error: error instanceof Error ? error.message : 'Failed to load market movers.',
        progress: null,
        activeBackendRequestId: null,
        inFlightKey: null,
        inFlightPromise: null,
      });
    }
  },

  cancelScan: async () => {
    const backendRequestId = get().activeBackendRequestId;
    if (!backendRequestId) return;

    cancelMarketMoversSnapshotWorker(backendRequestId);
    const previousSnapshot = get().snapshot;
    set({
      activeRequestId: get().activeRequestId + 1,
      activeBackendRequestId: null,
      inFlightKey: null,
      inFlightPromise: null,
      progress: null,
      status: previousSnapshot ? statusForSnapshot(previousSnapshot) : 'idle',
      error: null,
      dirty: true,
    });

    const api = getDesktopApi();
    if (!api) return;
    try {
      await api.cancelDailyMarketSnapshot({ requestId: backendRequestId });
    } catch {
      // The local request has already been invalidated. Backend cancellation is best effort.
    }
  },
}));

export function resetMarketMoversStoreRuntimeForTests(): void {
  databaseUnlisten?.();
  progressUnlisten?.();
  databaseUnlisten = null;
  progressUnlisten = null;
  nextBackendRequestNumber = 1;
}

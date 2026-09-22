import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as desktop from '@/platform/desktop';
import type {
  AppSnapshot,
  DailyMarketSnapshotProgressEvent,
  DailyMarketSnapshotResult,
  DesktopApi,
} from '@/platform';
import {
  resetMarketMoversStoreRuntimeForTests,
  useMarketMoversStore,
} from '../marketMoversStore';

function backendResult(requestId = 'request-1'): DailyMarketSnapshotResult {
  return {
    requestId,
    databaseIdentity: 'db',
    databaseRevision: 'rev',
    latestDatabaseDate: '2026-08-03',
    targetSymbolCount: 1,
    fetchedSymbolCount: 1,
    failedSymbolCount: 0,
    failures: [],
    symbols: [
      {
        instrument: { symbol: 'ABC', exchange: 'NSE' },
        adjusted: true,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
        events: [],
        bars: [
          { date: '2026-08-02', open: 100, high: 100, low: 100, close: 100, volume: 1_000 },
          { date: '2026-08-03', open: 105, high: 105, low: 105, close: 105, volume: 2_000 },
        ],
      },
    ],
  };
}


function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function resetStore(): void {
  useMarketMoversStore.setState({
    settings: {
      exchange: 'NSE',
      universeId: 'all-equity',
      resultCount: 10,
      minPrice: 10,
      minVolume: 100,
      excludeCorporateActionWarnings: false,
    },
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
  });
}

describe('marketMoversStore', () => {
  beforeEach(() => {
    resetMarketMoversStoreRuntimeForTests();
    resetStore();
    vi.restoreAllMocks();
  });

  it('does not scan automatically when the first consumer opens Market Movers', () => {
    const getDailyMarketSnapshot = vi.fn();
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    useMarketMoversStore.getState().activateConsumer();

    expect(getDailyMarketSnapshot).not.toHaveBeenCalled();
    expect(useMarketMoversStore.getState().status).toBe('idle');
    expect(useMarketMoversStore.getState().dirty).toBe(true);
  });

  it('shares one backend batch request across concurrent manual scans', async () => {
    const getDailyMarketSnapshot = vi.fn().mockImplementation(
      async (input: { requestId?: string }) => backendResult(input.requestId),
    );
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    await Promise.all([
      useMarketMoversStore.getState().runScan(),
      useMarketMoversStore.getState().runScan(),
    ]);

    expect(getDailyMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(useMarketMoversStore.getState().status).toBe('ready');
  });

  it('marks criteria changes dirty without starting a scan', () => {
    const getDailyMarketSnapshot = vi.fn();
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    useMarketMoversStore.setState({ dirty: false });
    useMarketMoversStore.getState().setSettings({ exchange: 'BSE' });

    expect(getDailyMarketSnapshot).not.toHaveBeenCalled();
    expect(useMarketMoversStore.getState().dirty).toBe(true);
  });

  it('does not mark result-count-only changes dirty or start a scan', () => {
    const getDailyMarketSnapshot = vi.fn();
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    useMarketMoversStore.setState({ dirty: false });
    useMarketMoversStore.getState().setSettings({ resultCount: 20 });

    expect(getDailyMarketSnapshot).not.toHaveBeenCalled();
    expect(useMarketMoversStore.getState().dirty).toBe(false);
  });

  it('marks database changes dirty without automatically rescanning', () => {
    const databaseChangedCallbacks: Array<(snapshot: AppSnapshot) => void> = [];
    const getDailyMarketSnapshot = vi.fn();

    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      onDatabaseChanged: vi.fn((callback: (snapshot: AppSnapshot) => void) => {
        databaseChangedCallbacks.push(callback);
        return () => {};
      }),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    useMarketMoversStore.getState().initialize();
    useMarketMoversStore.setState({ dirty: false });
    databaseChangedCallbacks[0]!({} as AppSnapshot);

    expect(getDailyMarketSnapshot).not.toHaveBeenCalled();
    expect(useMarketMoversStore.getState().dirty).toBe(true);
    expect(useMarketMoversStore.getState().databaseChangeGeneration).toBe(1);
  });

  it('accepts backend progress for only the active manual request', async () => {
    const batch = deferred<DailyMarketSnapshotResult>();
    const progressCallbacks: Array<(event: DailyMarketSnapshotProgressEvent) => void> = [];
    const getDailyMarketSnapshot = vi.fn(() => batch.promise);

    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      cancelDailyMarketSnapshot: vi.fn().mockResolvedValue({ cancelled: true }),
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn(
        (callback: (event: DailyMarketSnapshotProgressEvent) => void) => {
          progressCallbacks.push(callback);
          return () => {};
        },
      ),
    } as unknown as DesktopApi);

    useMarketMoversStore.getState().initialize();
    const scanPromise = useMarketMoversStore.getState().runScan();
    const activeRequestId = useMarketMoversStore.getState().activeBackendRequestId!;

    progressCallbacks[0]!({
      requestId: activeRequestId,
      processedSymbolCount: 25,
      targetSymbolCount: 100,
      fetchedSymbolCount: 24,
      failedSymbolCount: 1,
      currentSymbol: 'ABC',
      currentExchange: 'NSE',
      cancelled: false,
    });

    expect(useMarketMoversStore.getState().progress).toMatchObject({
      scanned: 25,
      total: 100,
      fetched: 24,
      failed: 1,
      currentSymbol: 'ABC',
    });

    batch.resolve(backendResult(activeRequestId));
    await scanPromise;
  });

  it('cancels the active backend and worker request without clearing previous results', async () => {
    const batch = deferred<DailyMarketSnapshotResult>();
    const getDailyMarketSnapshot = vi.fn(() => batch.promise);
    const cancelDailyMarketSnapshot = vi.fn().mockResolvedValue({ cancelled: true });

    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({
      getDailyMarketSnapshot,
      cancelDailyMarketSnapshot,
      onDatabaseChanged: vi.fn().mockReturnValue(() => {}),
      onDailyMarketSnapshotProgress: vi.fn().mockReturnValue(() => {}),
    } as unknown as DesktopApi);

    const scanPromise = useMarketMoversStore.getState().runScan();
    const activeRequestId = useMarketMoversStore.getState().activeBackendRequestId!;
    await useMarketMoversStore.getState().cancelScan();

    expect(cancelDailyMarketSnapshot).toHaveBeenCalledWith({ requestId: activeRequestId });
    expect(useMarketMoversStore.getState().status).toBe('idle');
    expect(useMarketMoversStore.getState().dirty).toBe(true);

    batch.resolve(backendResult(activeRequestId));
    await scanPromise;
    expect(useMarketMoversStore.getState().snapshot).toBeNull();
  });
});

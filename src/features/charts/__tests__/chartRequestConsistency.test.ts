import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankChartTab } from '../chartTabWorkspaceService';
import { createInstrumentDataCache, loadInstrumentResult } from '../chartInstrumentHydrationService';
import { createChartInstrumentCompareController } from '../chartInstrumentCompareController';
import { createChartTabSessionController } from '../chartTabSessionController';
import { ChartDataRequestSupersededError } from '@/platform/chartRequestErrors';
import { createChartSnapshotHydrationController } from '@/features/workspace/chartSnapshotHydrationService';
import { createChartCompareOverlay } from '../compareOverlayService';
import { DEFAULT_RENKO_SETTINGS } from '../chartTypeTransformService';
import type { DesktopApi, EodDataResult } from '@/platform';
import type { ChartStoreState } from '@/store/chartStoreTypes';

vi.mock('@/store/uiStore', () => ({ useUiStore: { getState: () => ({ symbolLinkEnabled: false }) } }));
const startup = vi.hoisted(() => ({ workspace: vi.fn(), saveMode: vi.fn(async () => undefined) }));
vi.mock('@/features/workspace/workspacePersistence', async (original) => ({
  ...await original<object>(), readPersistedWorkspace: startup.workspace, stringifyWorkspaceState: () => 'workspace',
}));
vi.mock('@/features/charts/chartSheetWorkspaceService', async (original) => ({
  ...await original<object>(), restoreWorkspaceState: (workspace: unknown) => workspace,
}));
vi.mock('@/features/workspace/databaseSettingsService', () => ({
  readDatabaseDefaultPriceMode: async () => 'raw', writeDatabaseDefaultPriceMode: startup.saveMode,
}));
vi.mock('@/features/workspace/databaseSnapshotService', () => ({
  loadDeferredDbStats: async () => null, loadSnapshotHydrationDetails: async () => ({ watchlists: [] }),
}));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function result(symbol = 'NIFTY', close = 100): EodDataResult {
  return { requestedSymbol: symbol, requestedExchange: 'NSE_INDEX', adjusted: false,
    includeDividendAdjustments: false, includeRightsAdjustments: false,
    instrument: { symbol, exchange: 'NSE_INDEX' }, events: [],
    bars: [{ date: '2015-11-09', open: close, high: close, low: close, close, volume: 10 }] };
}
function harness() {
  const instrument = { symbol: 'NIFTY', exchange: 'NSE_INDEX' };
  const tabs = ['one', 'two'].map((id, i) => ({ ...createBlankChartTab(i + 1), id, instrument, requestedInstrument: instrument }));
  let state = { chartTabs: tabs, activeChartTabId: 'one', snapshot: { activeDatabasePath: 'db-A' },
    adjustedMode: false, includeDividendAdjustments: false, includeRightsAdjustments: false, isLoadingBars: false } as unknown as ChartStoreState;
  const read = vi.fn(); const cache = createInstrumentDataCache(); const toast = vi.fn();
  const deps = { getApi: () => ({ getEodData: read }) as unknown as DesktopApi,
    getState: () => state,
    setState: (update: Partial<ChartStoreState> | ((value: ChartStoreState) => Partial<ChartStoreState>)) => {
      state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
    }, instrumentDataCache: cache, addToast: toast };
  const controller = createChartInstrumentCompareController(deps);
  const hydration = createChartSnapshotHydrationController({ ...deps,
    clearWorkspaceAutosaveTimer: vi.fn(), closeImportDialogUi: vi.fn(), resetChartInteractionUi: vi.fn(),
    resolveSelectedWatchlistId: () => null, setAutosaveSignature: vi.fn(), reportLoadError: toast });
  return { ...deps, read, cache, toast, controller, hydration, instrument };
}

function modeHarness() {
  const h = harness(); const confirmed = vi.fn();
  h.setState({ chartTabs: h.getState().chartTabs.map((tab, index) => index === 1
    ? { ...tab, instrument: { symbol: 'AARTIPHARM', exchange: 'NSE_INDEX' }, requestedInstrument: { symbol: 'AARTIPHARM', exchange: 'NSE_INDEX' } }
    : tab) });
  const hydrate = vi.fn((id: string) => h.hydration.hydrateChartTabData(id));
  const session = createChartTabSessionController({ ...h, hydrateChartTabData: hydrate,
    resetChartInteractionUi: vi.fn(), onAdjustedModeLoaded: confirmed });
  h.read.mockImplementation(async (input) => ({ ...result(input.symbol, input.adjusted ? 200 : 100),
    adjusted: input.adjusted, includeDividendAdjustments: input.includeDividendAdjustments,
    includeRightsAdjustments: input.includeRightsAdjustments }));
  return { ...h, session, confirmed, hydrate };
}

describe('adjustment-mode reloads', () => {
  it('loads the active tab first and confirms only after background tabs finish', async () => {
    const h = modeHarness(); h.setState({ activeChartTabId: 'two' });
    const active = deferred<EodDataResult>(); const background = deferred<EodDataResult>();
    h.read.mockReturnValueOnce(active.promise).mockReturnValueOnce(background.promise);
    h.session.setAdjustedMode(true);
    expect(h.confirmed).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(h.read).toHaveBeenCalledTimes(1));
    expect(h.read.mock.calls[0][0].symbol).toBe('AARTIPHARM');
    active.resolve({ ...result('AARTIPHARM', 200), adjusted: true });
    await vi.waitFor(() => expect(h.read).toHaveBeenCalledTimes(2));
    expect(h.confirmed).not.toHaveBeenCalled();
    background.resolve({ ...result('NIFTY', 200), adjusted: true });
    await vi.waitFor(() => expect(h.confirmed).toHaveBeenCalledWith(true));
    expect(h.getState().chartTabs.every((tab) => tab.loadedAdjusted === true && tab.rawBars[0].close === 200)).toBe(true);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('coalesces rapid ON/OFF/ON changes into the latest reload queue', async () => {
    const h = modeHarness();
    h.session.setAdjustedMode(true); h.session.setAdjustedMode(false); h.session.setAdjustedMode(true);
    await vi.waitFor(() => expect(h.confirmed).toHaveBeenCalledExactlyOnceWith(true));
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.read.mock.calls.every(([input]) => input.adjusted === true)).toBe(true);
    expect(h.getState().chartTabs.every((tab) => tab.loadedAdjusted === true)).toBe(true);
  });

  it('shares the refreshed history between duplicate instrument tabs', async () => {
    const h = modeHarness();
    h.setState({ chartTabs: h.getState().chartTabs.map((tab) => ({ ...tab, instrument: h.instrument, requestedInstrument: h.instrument })) });
    h.session.setAdjustedMode(true);
    await vi.waitFor(() => expect(h.confirmed).toHaveBeenCalledExactlyOnceWith(true));
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.getState().chartTabs.every((tab) => tab.loadedAdjusted === true && tab.rawBars[0].close === 200)).toBe(true);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('stops an older queue after its pending read finishes and retains the latest raw mode', async () => {
    const h = modeHarness(); const old = deferred<EodDataResult>();
    h.read.mockReturnValueOnce(old.promise);
    h.session.setAdjustedMode(true);
    await vi.waitFor(() => expect(h.read).toHaveBeenCalledTimes(1));
    h.session.setAdjustedMode(false);
    await vi.waitFor(() => expect(h.confirmed).toHaveBeenCalledExactlyOnceWith(false));
    old.resolve({ ...result('NIFTY', 200), adjusted: true });
    await h.hydrate.mock.results[0].value;
    expect(h.read).toHaveBeenCalledTimes(3);
    expect(h.getState().chartTabs.every((tab) => tab.loadedAdjusted === false && tab.rawBars[0].close === 100)).toBe(true);
    expect(h.confirmed).toHaveBeenCalledTimes(1);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('keeps a real background load failure visible and does not announce success', async () => {
    const h = modeHarness();
    h.read.mockResolvedValueOnce({ ...result('NIFTY'), adjusted: true }).mockRejectedValueOnce(new Error('source read failed'));
    h.session.setAdjustedMode(true);
    await vi.waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('background chart tab NSE_INDEX:AARTIPHARM. source read failed')));
    expect(h.confirmed).not.toHaveBeenCalled();
    expect(h.getState().chartTabs[1].loadedAdjusted).toBeNull();
  });
});

describe('chart request ownership', () => {
  it('resets the previous price-axis range when Market Movers replaces the active instrument', async () => {
    const h = harness();
    const oldPriceRange = { min: 72000, max: 88000 };
    const paneRange = { min: -50, max: 50 };
    h.setState({
      chartTabs: h.getState().chartTabs.map((tab) => tab.id === 'one'
        ? { ...tab, paneScaleOverrides: { price: oldPriceRange, obv: paneRange } }
        : tab),
    });
    const nextInstrument = { exchange: 'NSE' as const, symbol: 'CHEMPLASTS' };
    h.read.mockResolvedValue({
      ...result('CHEMPLASTS', 238),
      requestedExchange: 'NSE',
      instrument: nextInstrument,
    });

    await h.controller.loadInstrument(nextInstrument);

    const loaded = h.getState().chartTabs[0];
    expect(loaded.instrument).toEqual(nextInstrument);
    expect(loaded.rawBars[0].close).toBe(238);
    expect(loaded.paneScaleOverrides).toEqual({ obv: paneRange });
    expect(h.getState().chartTabs[1].instrument).toEqual(h.instrument);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('keeps manual price-axis and indicator ranges when reloading the same instrument', async () => {
    const h = harness();
    const priceRange = { min: 72000, max: 88000 };
    const paneRange = { min: -50, max: 50 };
    h.setState({
      chartTabs: h.getState().chartTabs.map((tab) => tab.id === 'one'
        ? { ...tab, paneScaleOverrides: { price: priceRange, obv: paneRange } }
        : tab),
    });
    h.read.mockResolvedValue(result());

    await h.controller.loadInstrument(h.instrument);

    expect(h.getState().chartTabs[0].paneScaleOverrides).toEqual({
      price: priceRange,
      obv: paneRange,
    });
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('retries a still-current canceled hydration without a false failure toast', async () => {
    const h = harness();
    h.read.mockRejectedValueOnce(new ChartDataRequestSupersededError()).mockResolvedValueOnce(result());
    await h.hydration.hydrateChartTabData('one', { forceReload: true });
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.read.mock.calls[1][0].forceReload).toBe(false);
    expect(h.getState().chartTabs[0].rawBars).toHaveLength(1);
    expect(h.getState().isLoadingBars).toBe(false);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('retries a still-current manual load after cancellation', async () => {
    const h = harness();
    h.read.mockRejectedValueOnce(new ChartDataRequestSupersededError()).mockResolvedValueOnce(result());
    await h.controller.loadInstrument(h.instrument);
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.getState().chartTabs[0].rawBars).toHaveLength(1);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('recovers a canceled comparison read as part of the current chart hydration', async () => {
    const h = harness(); const bank = { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' };
    const overlay = createChartCompareOverlay({ id: 'bank', instrument: bank, instrumentMeta: null, color: '#fff' },
      'D', 'candles', 10, DEFAULT_RENKO_SETTINGS);
    h.setState({ chartTabs: h.getState().chartTabs.map((tab) => tab.id === 'one' ? { ...tab, compareOverlays: [overlay] } : tab) });
    h.read.mockResolvedValueOnce(result()).mockRejectedValueOnce(new ChartDataRequestSupersededError()).mockResolvedValueOnce(result('BANKNIFTY', 250));
    await h.hydration.hydrateChartTabData('one', { forceReload: true });
    expect(h.read).toHaveBeenCalledTimes(3);
    expect(h.read.mock.calls[2][0].forceReload).toBe(false);
    expect(h.getState().chartTabs[0].compareOverlays[0].rawBars[0].close).toBe(250);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('does not retry or report cancellation for an obsolete mode', async () => {
    const h = harness(); const pending = deferred<EodDataResult>(); h.read.mockReturnValue(pending.promise);
    const loading = h.hydration.hydrateChartTabData('one');
    h.setState({ adjustedMode: true }); pending.reject(new ChartDataRequestSupersededError()); await loading;
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('reports a real comparison failure without marking the new chart mode loaded', async () => {
    const h = harness(); const bank = { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' };
    const overlay = createChartCompareOverlay({ id: 'bank', instrument: bank, instrumentMeta: null, color: '#fff' },
      'D', 'candles', 10, DEFAULT_RENKO_SETTINGS);
    h.setState({ chartTabs: h.getState().chartTabs.map((tab) => tab.id === 'one' ? { ...tab, compareOverlays: [overlay] } : tab) });
    h.read.mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error('source read failed'));
    await h.hydration.hydrateChartTabData('one');
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('Comparison history for NSE_INDEX:BANKNIFTY failed. source read failed'));
    expect(h.getState().chartTabs[0].loadedAdjusted).toBeNull();
  });
  it('bounds recovery and reports repeated interruption instead of silently keeping stale prices', async () => {
    const h = harness(); h.read.mockRejectedValue(new ChartDataRequestSupersededError());
    await h.hydration.hydrateChartTabData('one');
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('changed repeatedly during refresh'));
    expect(h.getState().isLoadingBars).toBe(false);
    expect(h.getState().chartTabs[0].loadedAdjusted).toBeNull();
  });
  it('finishes into the initiating tab after the active tab changes', async () => {
    const h = harness(); const pending = deferred<EodDataResult>(); h.read.mockReturnValue(pending.promise);
    const loading = h.controller.loadInstrument(h.instrument);
    h.setState({ activeChartTabId: 'two' }); pending.resolve(result()); await loading;
    expect(h.getState().chartTabs[0].rawBars).toHaveLength(1);
    expect(h.getState().chartTabs[1].rawBars).toHaveLength(0);
  });
  it('does not let an older instrument request overwrite a newer choice', async () => {
    const h = harness(); const old = deferred<EodDataResult>(); const fresh = deferred<EodDataResult>();
    h.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = h.controller.loadInstrument(h.instrument);
    const second = h.controller.loadInstrument({ symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' });
    fresh.resolve(result('BANKNIFTY', 200)); await second;
    old.resolve(result()); await first;
    expect(h.getState().chartTabs[0].instrument?.symbol).toBe('BANKNIFTY');
    expect(h.getState().chartTabs[0].rawBars[0].close).toBe(200);
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('rejects old database results and prevents upper-cache repopulation', async () => {
    const h = harness(); const old = deferred<EodDataResult>(); h.read.mockReturnValue(old.promise);
    const loading = h.controller.loadInstrument(h.instrument);
    h.cache.clear(); h.setState({ snapshot: { activeDatabasePath: 'db-B' } as ChartStoreState['snapshot'] });
    old.resolve(result()); await loading;
    expect(h.getState().chartTabs[0].rawBars).toHaveLength(0);
    expect(h.cache.read('db-A', h.instrument, false, false, false)).toBeNull();
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('discards a result when adjustment settings change during the read', async () => {
    const h = harness(); const pending = deferred<EodDataResult>(); h.read.mockReturnValue(pending.promise);
    const loading = h.controller.loadInstrument(h.instrument);
    h.setState({ adjustedMode: true }); pending.resolve(result()); await loading;
    expect(h.getState().chartTabs[0].rawBars).toHaveLength(0);
  });
  it('shares publication guards between hydration and manual instrument loads', async () => {
    const h = harness(); const old = deferred<EodDataResult>(); const fresh = deferred<EodDataResult>();
    h.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = h.hydration.hydrateChartTabData('one');
    const second = h.controller.loadInstrument({ symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' });
    fresh.resolve(result('BANKNIFTY', 200)); await second;
    old.resolve(result()); await first;
    expect(h.getState().chartTabs[0].instrument?.symbol).toBe('BANKNIFTY');
  });
  it('allows a newer hydration to supersede the same tab instead of dropping the refresh', async () => {
    const h = harness(); const old = deferred<EodDataResult>(); const fresh = deferred<EodDataResult>();
    h.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = h.hydration.hydrateChartTabData('one');
    const second = h.hydration.hydrateChartTabData('one', { forceReload: true });
    expect(h.read).toHaveBeenCalledTimes(2);
    fresh.resolve(result('NIFTY', 200)); await second;
    old.resolve(result()); await first;
    expect(h.getState().chartTabs[0].rawBars[0].close).toBe(200);
    expect(h.cache.read('db-A', h.instrument, false, false, false)?.bars[0].close).toBe(200);
  });
  it('reports current hydration errors without claiming a new adjustment mode loaded', async () => {
    const h = harness(); h.setState({ chartTabs: h.getState().chartTabs.map((tab) => ({ ...tab, loadedAdjusted: false })) });
    h.read.mockRejectedValue(new Error('Incomplete binary chart data'));
    await h.hydration.hydrateChartTabData('one', { adjusted: true });
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('Incomplete binary chart data'));
    expect(h.getState().chartTabs[0].loadedAdjusted).toBe(false);
  });
  it('does not retain loaded-mode claims after a failed change of instrument', async () => {
    const h = harness(); h.setState({ chartTabs: h.getState().chartTabs.map((tab) => ({ ...tab, loadedAdjusted: false })) });
    h.read.mockRejectedValue(new Error('Unavailable chart data'));
    await h.controller.loadInstrument({ symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' });
    expect(h.getState().chartTabs[0].loadedAdjusted).toBeNull();
    expect(h.toast).toHaveBeenCalled();
  });
  it('propagates force reload and database context to the lower cache', async () => {
    const h = harness(); h.read.mockResolvedValue(result());
    h.cache.write('db-A', h.instrument, result());
    await loadInstrumentResult({ api: h.getApi(), databasePath: 'db-A', instrument: h.instrument,
      adjusted: false, includeDividendAdjustments: false, includeRightsAdjustments: false,
      forceReload: true, instrumentDataCache: h.cache });
    expect(h.read).toHaveBeenCalledWith(expect.objectContaining({ databasePath: 'db-A', forceReload: true }));
  });
  it('force reload refreshes comparison history as well as the base chart', async () => {
    const h = harness(); const bank = { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' };
    const overlay = createChartCompareOverlay({ id: 'bank', instrument: bank, instrumentMeta: null, color: '#fff' },
      'D', 'candles', 10, DEFAULT_RENKO_SETTINGS);
    h.setState({ chartTabs: h.getState().chartTabs.map((tab) => tab.id === 'one' ? { ...tab, compareOverlays: [overlay] } : tab) });
    h.cache.write('db-A', h.instrument, result()); h.cache.write('db-A', bank, result('BANKNIFTY', 250));
    h.read.mockImplementation(async (input) => result(input.symbol, 200));
    await h.hydration.hydrateChartTabData('one', { forceReload: true });
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.read.mock.calls.every(([input]) => input.forceReload === true)).toBe(true);
    expect(h.getState().chartTabs[0].compareOverlays[0].rawBars[0].close).toBe(200);
  });
  it('does not publish or cache an old comparison after a database transition', async () => {
    const h = harness(); const pending = deferred<EodDataResult>(); h.read.mockReturnValue(pending.promise);
    const adding = h.controller.addCompareOverlay({ symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' });
    h.cache.clear(); h.setState({ snapshot: { activeDatabasePath: 'db-B' } as ChartStoreState['snapshot'] });
    pending.resolve(result('BANKNIFTY', 200)); await adding;
    expect(h.getState().chartTabs[0].compareOverlays[0].rawBars).toHaveLength(0);
    expect(h.cache.read('db-A', { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' }, false, false, false)).toBeNull();
    expect(h.toast).not.toHaveBeenCalled();
  });
  it('revokes the delayed startup callback when a newer database snapshot replaces it', async () => {
    vi.useFakeTimers(); vi.stubGlobal('window', { setTimeout });
    const h = harness(); h.read.mockResolvedValue(result());
    startup.workspace.mockResolvedValue({ chartTabs: h.getState().chartTabs, activeChartTabId: 'one' });
    await h.hydration.applySnapshot({ activeDatabasePath: 'db-A', watchlists: [] } as unknown as NonNullable<ChartStoreState['snapshot']>);
    await h.hydration.applySnapshot({ activeDatabasePath: 'db-B', watchlists: [] } as unknown as NonNullable<ChartStoreState['snapshot']>);
    await vi.advanceTimersByTimeAsync(45);
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.read).toHaveBeenCalledWith(expect.objectContaining({ databasePath: 'db-B', forceReload: true }));
    vi.clearAllTimers();
  });
});

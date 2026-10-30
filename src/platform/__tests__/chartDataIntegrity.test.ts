import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBinaryEodBars, encodeBinaryEodBars } from '../binaryEodDecoder';
import type { EodRow } from '../types';

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mock.invoke }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); vi.resetModules(); });

const bars: EodRow[] = [
  { date: '2015-11-06', open: 7954.3, high: 7954.3, low: 7954.3, close: 7954.3, volume: 100 },
  { date: '2015-11-09', open: 7788.25, high: 7937.75, low: 7771.7, close: 7915.2, volume: 100, prevClose: 7954.3 },
];
function payload(selected = bars) {
  return { requestedSymbol: 'NIFTY', requestedExchange: 'NSE_INDEX', adjusted: false,
    includeDividendAdjustments: false, includeRightsAdjustments: false,
    instrument: null, events: [], barCount: selected.length, barsB64: encodeBinaryEodBars(selected) };
}
async function api() {
  vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
  return (await import('../tauriDesktop')).getTauriDesktopApi()!;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const input = { symbol: 'NIFTY', exchange: 'NSE_INDEX', databasePath: 'database-A' };

describe('binary chart integrity', () => {
  it('preserves every date/value and optional previous close', () => {
    expect(decodeBinaryEodBars(encodeBinaryEodBars(bars), 2)).toEqual(bars);
    expect(decodeBinaryEodBars('', 0)).toEqual([]);
  });
  it.each([1, 3, -1, 1.5])('rejects inconsistent declared bar count %s', (count) => {
    expect(() => decodeBinaryEodBars(encodeBinaryEodBars(bars), count)).toThrow();
  });
  it('rejects invalid base64, invalid calendar dates and unordered rows', () => {
    expect(() => decodeBinaryEodBars('!!!!', 0)).toThrow();
    expect(() => decodeBinaryEodBars(encodeBinaryEodBars([{ ...bars[0], date: '2015-02-30' }]), 1)).toThrow(/date/);
    expect(() => decodeBinaryEodBars(encodeBinaryEodBars([...bars].reverse()), 2)).toThrow(/date/);
  });
});

describe('chart IPC cache freshness', () => {
  it('keeps a pending read and its cache valid when saving only the default price mode', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    mock.invoke.mockImplementation((command) => command === 'get_eod_data_binary' ? pending.promise : Promise.resolve({ success: true }));
    const desktop = await api(); const loading = desktop.getEodData(input);
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await desktop.setSetting({ key: 'default_price_mode', value: 'adjusted' });
    pending.resolve(payload());
    await expect(loading).resolves.toMatchObject({ bars });
    await expect(desktop.getEodData(input)).resolves.toMatchObject({ bars });
    expect(mock.invoke.mock.calls.filter(([command]) => command === 'get_eod_data_binary')).toHaveLength(1);
  });
  it('still invalidates pending price reads for other setting mutations', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    mock.invoke.mockImplementation((command) => command === 'get_eod_data_binary' ? pending.promise : Promise.resolve({ success: true }));
    const desktop = await api(); const loading = desktop.getEodData(input);
    const rejected = expect(loading).rejects.toMatchObject({ name: 'ChartDataRequestSupersededError' });
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await desktop.setSetting({ key: 'other_setting', value: 'changed' });
    pending.resolve(payload()); await rejected;
  });
  it('reports missing payloads instead of caching an empty chart', async () => {
    mock.invoke.mockResolvedValue({});
    await expect((await api()).getEodData(input)).rejects.toThrow(/Missing chart data payload/);
  });
  it('deduplicates unchanged reads, scopes databases, and bypasses cache for force reload', async () => {
    mock.invoke.mockResolvedValue(payload());
    const desktop = await api();
    await desktop.getEodData(input); await desktop.getEodData(input);
    expect(mock.invoke).toHaveBeenCalledTimes(1);
    await desktop.getEodData({ ...input, databasePath: 'database-B' });
    await desktop.getEodData({ ...input, forceReload: true });
    expect(mock.invoke).toHaveBeenCalledTimes(3);
    expect(mock.invoke.mock.calls[2][1]).toEqual({ input: { symbol: 'NIFTY', exchange: 'NSE_INDEX' } });
  });
  it('revokes pending reads on invalidation without letting their finally remove a new request', async () => {
    const old = deferred<ReturnType<typeof payload>>(); const fresh = deferred<ReturnType<typeof payload>>();
    mock.invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const desktop = await api();
    const stale = desktop.getEodData(input); const staleRejected = expect(stale).rejects.toThrow(/superseded/);
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    (await import('../tauriDesktop')).invalidateTauriEodDataCache();
    const next = desktop.getEodData(input);
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(2));
    old.resolve(payload([bars[0]])); await staleRejected;
    const joined = desktop.getEodData(input);
    fresh.resolve(payload()); await expect(next).resolves.toMatchObject({ bars });
    await expect(joined).resolves.toMatchObject({ bars });
    expect(mock.invoke).toHaveBeenCalledTimes(2);
  });
  it('force reload supersedes an older read of the same key', async () => {
    const old = deferred<ReturnType<typeof payload>>();
    mock.invoke.mockReturnValueOnce(old.promise).mockResolvedValueOnce(payload());
    const desktop = await api(); const stale = desktop.getEodData(input);
    const staleRejected = expect(stale).rejects.toThrow(/superseded/);
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await expect(desktop.getEodData({ ...input, forceReload: true })).resolves.toMatchObject({ bars });
    old.resolve(payload([bars[0]])); await staleRejected;
    await expect(desktop.getEodData(input)).resolves.toMatchObject({ bars });
    expect(mock.invoke).toHaveBeenCalledTimes(2);
  });
});

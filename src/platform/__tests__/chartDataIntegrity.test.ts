import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBinaryEodBars, encodeBinaryEodBars } from '../binaryEodDecoder';
import type { DesktopApi, EodRow } from '../types';

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
  it('keeps an in-flight EOD read and its cache valid through repeated workspace autosaves', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    mock.invoke.mockImplementation((command) =>
      command === 'get_eod_data_binary' ? pending.promise : Promise.resolve({ success: true }),
    );
    const desktop = await api();
    const load = desktop.getEodData(input);
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));

    const { writeWorkspaceLayoutSetting, WORKSPACE_SETTING_KEY } =
      await import('@/features/workspace/workspaceService');
    await writeWorkspaceLayoutSetting('layout-first');
    await writeWorkspaceLayoutSetting('layout-second');
    expect(mock.invoke.mock.calls.filter(([command]) => command === 'set_setting')).toEqual([
      ['set_setting', { input: { key: WORKSPACE_SETTING_KEY, value: 'layout-first' } }],
      ['set_setting', { input: { key: WORKSPACE_SETTING_KEY, value: 'layout-second' } }],
    ]);

    const joined = desktop.getEodData(input);
    pending.resolve(payload());
    const firstResult = await load;
    expect(await joined).toBe(firstResult);
    expect(await desktop.getEodData(input)).toBe(firstResult);
    expect(mock.invoke.mock.calls.filter(([command]) => command === 'get_eod_data_binary')).toHaveLength(1);
  });

  it('preserves cached prices after a completed workspace layout write', async () => {
    mock.invoke.mockImplementation((command) =>
      command === 'get_eod_data_binary' ? Promise.resolve(payload()) : Promise.resolve({ success: true }),
    );
    const desktop = await api();
    const before = await desktop.getEodData(input);
    await desktop.setSetting({ key: 'workspace.chartLayout.v1', value: '{"chartTabs":[]}' });
    const after = await desktop.getEodData(input);
    expect(after).toBe(before);
    expect(mock.invoke.mock.calls.filter(([command]) => command === 'get_eod_data_binary')).toHaveLength(1);
  });

  it.each([
    {
      label: 'unrelated setting',
      command: 'set_setting',
      mutate: (desktop: DesktopApi) => desktop.setSetting({ key: 'price_adjustment_config', value: 'changed' }),
    },
    {
      label: 'quotation',
      command: 'upsert_quote',
      mutate: (desktop: DesktopApi) => desktop.upsertQuote({
        symbol: 'NIFTY', exchange: 'NSE_INDEX', date: '2015-11-09',
        open: 7900, high: 8000, low: 7850, close: 7980, volume: 400,
      }),
    },
    {
      label: 'active database',
      command: 'activate_database_path',
      mutate: (desktop: DesktopApi) => desktop.activateDatabasePath('database-B'),
    },
    {
      label: 'corporate action',
      command: 'apply_corporate_action',
      mutate: (desktop: DesktopApi) => desktop.applyCorporateAction({
        actionType: 'SPLIT', exchange: 'NSE', effectiveDate: '2015-11-09',
        symbol: 'NIFTY', ratioNum: 2, ratioDen: 1,
      }),
    },
  ])('still supersedes pending EOD requests after a $label mutation', async ({ command, mutate }) => {
    const pending = deferred<ReturnType<typeof payload>>();
    let priceReadCount = 0;
    mock.invoke.mockImplementation((name) =>
      name === 'get_eod_data_binary'
        ? (priceReadCount++ === 0 ? pending.promise : Promise.resolve(payload()))
        : Promise.resolve({ success: true }),
    );
    const desktop = await api();
    const oldRead = desktop.getEodData(input);
    const oldRejected = expect(oldRead).rejects.toMatchObject({
      name: 'ChartDataRequestSupersededError',
    });
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await mutate(desktop);
    expect(mock.invoke.mock.calls.some(([name]) => name === command)).toBe(true);
    pending.resolve(payload([bars[0]]));
    await oldRejected;

    const fresh = await desktop.getEodData(input);
    expect(fresh.bars).toEqual(bars);
    expect(await desktop.getEodData(input)).toBe(fresh);
    expect(mock.invoke.mock.calls.filter(([name]) => name === 'get_eod_data_binary')).toHaveLength(2);
  });

  it('does not let workspace autosave prevent a subsequent price mutation from invalidating', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    let priceReadCount = 0;
    mock.invoke.mockImplementation((name) =>
      name === 'get_eod_data_binary'
        ? (priceReadCount++ === 0 ? pending.promise : Promise.resolve(payload()))
        : Promise.resolve({ success: true }),
    );
    const desktop = await api();
    const old = desktop.getEodData(input);
    const rejected = expect(old).rejects.toMatchObject({ name: 'ChartDataRequestSupersededError' });
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await desktop.setSetting({ key: 'workspace.chartLayout.v1', value: 'workspace' });
    await desktop.deleteQuote({ symbol: 'NIFTY', exchange: 'NSE_INDEX', date: '2015-11-06' });
    pending.resolve(payload([bars[0]]));
    await rejected;
    expect((await desktop.getEodData(input)).bars).toEqual(bars);
    expect(mock.invoke.mock.calls.filter(([name]) => name === 'get_eod_data_binary')).toHaveLength(2);
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

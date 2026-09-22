import { describe, expect, it } from 'vitest';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

async function loadHistoryModule() {
  const modulePath = '../workflow/' + 'corporateActionNormalFetchHistory';
  return import(/* @vite-ignore */ modulePath);
}

describe('Corporate Action Normal per-database last fetch history', () => {
  it('persists independent records by exact database path and formats IST', async () => {
    const history = await loadHistoryModule();
    const storage = new MemoryStorage();

    history.writeCorporateActionNormalLastFetch(
      'E:\\Private\\A.sqlite3',
      { scope: 'BOTH', completedAtIso: '2026-09-03T11:42:00.000Z' },
      storage,
    );
    history.writeCorporateActionNormalLastFetch(
      'E:\\Private\\B.sqlite3',
      { scope: 'NSE', completedAtIso: '2026-09-03T12:00:00.000Z' },
      storage,
    );

    const a = history.readCorporateActionNormalLastFetch('E:\\Private\\A.sqlite3', storage);
    const b = history.readCorporateActionNormalLastFetch('E:\\Private\\B.sqlite3', storage);

    expect(a).toEqual({ scope: 'BOTH', completedAtIso: '2026-09-03T11:42:00.000Z' });
    expect(b).toEqual({ scope: 'NSE', completedAtIso: '2026-09-03T12:00:00.000Z' });
    expect(history.formatCorporateActionNormalLastFetch(a)).toBe(
      'NSE + BSE \u00b7 03-09-2026 17:12 IST',
    );
  });

  it('fails closed for missing database paths and malformed storage', async () => {
    const history = await loadHistoryModule();
    const storage = new MemoryStorage();

    expect(history.readCorporateActionNormalLastFetch(null, storage)).toBeNull();
    expect(history.formatCorporateActionNormalLastFetch(null)).toBe('Never for this database.');

    storage.setItem('eod-chart.corporate-action.normal-last-fetch.v1', '{bad json');
    expect(history.readCorporateActionNormalLastFetch('E:\\Private\\A.sqlite3', storage)).toBeNull();
  });
});
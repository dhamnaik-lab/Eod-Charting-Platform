import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INDICATOR_FAVORITES, PICKER_LEGACY_FAVORITES_KEY, SHARED_INDICATOR_FAVORITES_KEY,
  SIDEBAR_LEGACY_FAVORITES_KEY, readFavoriteIndicatorIds, writeFavoriteIndicatorIds,
  toggleFavoriteIndicatorId,
} from '../indicatorFavoritesService';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}

describe('B24 unified indicator favourites with non-destructive migration', () => {
  it('uses valid Picker defaults when neither legacy key exists', () => {
    expect(readFavoriteIndicatorIds(fakeStorage())).toEqual([...DEFAULT_INDICATOR_FAVORITES]);
    expect(readFavoriteIndicatorIds(fakeStorage())).toContain('boll');
    expect(readFavoriteIndicatorIds(fakeStorage())).not.toContain('bollinger_bands');
  });
  it('preserves Picker-only configured favourites without adding defaults', () => {
    const store = fakeStorage({ [PICKER_LEGACY_FAVORITES_KEY]: '["ema","rsi"]' });
    expect(readFavoriteIndicatorIds(store)).toEqual(['ema', 'rsi']);
    expect(store.getItem(SHARED_INDICATOR_FAVORITES_KEY)).toBeNull();
  });
  it('preserves Sidebar-only configured favourites without replacing them', () => {
    const store = fakeStorage({ [SIDEBAR_LEGACY_FAVORITES_KEY]: '["supertrend","bollinger_bands"]' });
    expect(readFavoriteIndicatorIds(store)).toEqual(['supertrend', 'bollinger_bands']);
  });
  it('unites conflicting legacy lists in stable Picker-first order, without editing v1 keys', () => {
    const p = '["ema","macd"]', s = '["rsi","ema","patterns"]';
    const store = fakeStorage({ [PICKER_LEGACY_FAVORITES_KEY]: p, [SIDEBAR_LEGACY_FAVORITES_KEY]: s });
    expect(readFavoriteIndicatorIds(store)).toEqual(['ema','macd','rsi','patterns']);
    expect(store.getItem(PICKER_LEGACY_FAVORITES_KEY)).toBe(p);
    expect(store.getItem(SIDEBAR_LEGACY_FAVORITES_KEY)).toBe(s);
    expect(store.getItem(SHARED_INDICATOR_FAVORITES_KEY)).toBeNull();
  });
  it('keeps explicit empty lists meaningful rather than silently restoring defaults', () => {
    expect(readFavoriteIndicatorIds(fakeStorage({ [SIDEBAR_LEGACY_FAVORITES_KEY]: '[]' }))).toEqual([]);
    const store = fakeStorage({ [SHARED_INDICATOR_FAVORITES_KEY]: '[]', [PICKER_LEGACY_FAVORITES_KEY]: '["rsi"]' });
    expect(readFavoriteIndicatorIds(store)).toEqual([]);
  });
  it('prefers valid v2 and falls back to the other legacy key for corrupt data', () => {
    const store = fakeStorage({
      [SHARED_INDICATOR_FAVORITES_KEY]: '{bad',
      [PICKER_LEGACY_FAVORITES_KEY]: '{"wrong":"shape"}',
      [SIDEBAR_LEGACY_FAVORITES_KEY]: '["macd","macd",7,"unknown-id"]',
    });
    expect(readFavoriteIndicatorIds(store)).toEqual(['macd','unknown-id']);
    store.setItem(SHARED_INDICATOR_FAVORITES_KEY, '["sma","patterns"]');
    expect(readFavoriteIndicatorIds(store)).toEqual(['sma','patterns']);
  });
  it('writes v2 only, preserving both legacy lists byte-for-byte for rollback', () => {
    const p = '["ema"]', s = '["rsi"]';
    const store = fakeStorage({ [PICKER_LEGACY_FAVORITES_KEY]: p, [SIDEBAR_LEGACY_FAVORITES_KEY]: s });
    const next = toggleFavoriteIndicatorId(readFavoriteIndicatorIds(store), 'macd');
    expect(writeFavoriteIndicatorIds(next, store)).toEqual(['ema','rsi','macd']);
    expect(readFavoriteIndicatorIds(store)).toEqual(['ema','rsi','macd']);
    expect(store.getItem(PICKER_LEGACY_FAVORITES_KEY)).toBe(p);
    expect(store.getItem(SIDEBAR_LEGACY_FAVORITES_KEY)).toBe(s);
    expect(writeFavoriteIndicatorIds([], store)).toEqual([]);
    expect(readFavoriteIndicatorIds(store)).toEqual([]);
  });
  it('deduplicates toggles and keeps unavailable storage nonfatal', () => {
    expect(toggleFavoriteIndicatorId(['macd', 'rsi'], 'macd')).toEqual(['rsi']);
    expect(toggleFavoriteIndicatorId(['macd'], 'ema')).toEqual(['macd','ema']);
    const broken = { getItem: (): string | null => { throw Error('blocked'); }, setItem: (): void => { throw Error('blocked'); } };
    expect(readFavoriteIndicatorIds(broken)).toEqual([...DEFAULT_INDICATOR_FAVORITES]);
    expect(writeFavoriteIndicatorIds(['sma'], broken)).toEqual(['sma']);
  });
  it('wires both surfaces to the same service and event subscription', () => {
    const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
    const picker = readFileSync('src/components/IndicatorPickerDialog.tsx', 'utf8');
    for (const source of [sidebar, picker]) {
      expect(source).toContain("from '@/indicators/indicatorFavoritesService'");
      expect(source).toContain('readFavoriteIndicatorIds');
      expect(source).toContain('writeFavoriteIndicatorIds(next)');
      expect(source).toContain('subscribeFavoriteIndicatorUpdates(');
    }
    expect(sidebar).not.toContain('writeStoredFavoriteIndicators(');
    expect(picker).not.toContain('saveStoredFavoriteIndicators(');
  });
});

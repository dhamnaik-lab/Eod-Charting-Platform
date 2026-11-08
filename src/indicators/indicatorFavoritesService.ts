/**
 * B24: one visible favourites list; keep legacy localStorage keys intact for rollback.
 * A valid shared v2 list takes precedence. Without v2, merge legacy lists without loss.
 */
export const SHARED_INDICATOR_FAVORITES_KEY = 'eod-chart.indicator-favorites.v2';
export const PICKER_LEGACY_FAVORITES_KEY = 'eod-chart.indicator-favorites.v1';
export const SIDEBAR_LEGACY_FAVORITES_KEY = 'eod-chart.sidebar.favoriteIndicators.v1';
export const DEFAULT_INDICATOR_FAVORITES = ['sma', 'ema', 'rsi', 'macd', 'boll', 'supertrend', 'patterns', 'vwap'] as const;
const FAVORITES_CHANGED_EVENT = 'eod-chart.indicator-favorites-changed';

type FavoritesStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): FavoritesStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}

function readList(storage: FavoritesStorage, key: string): string[] | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const decoded: unknown = JSON.parse(raw);
    return Array.isArray(decoded) ? normalizeFavoriteIds(decoded) : null;
  } catch {
    return null;
  }
}

export function readFavoriteIndicatorIds(storage?: FavoritesStorage | null): string[] {
  const s = storage === undefined ? browserStorage() : storage;
  if (!s) return [...DEFAULT_INDICATOR_FAVORITES];
  const shared = readList(s, SHARED_INDICATOR_FAVORITES_KEY);
  if (shared !== null) return shared; // An intentional [] is authoritative.
  const picker = readList(s, PICKER_LEGACY_FAVORITES_KEY);
  const sidebar = readList(s, SIDEBAR_LEGACY_FAVORITES_KEY);
  if (picker === null && sidebar === null) return [...DEFAULT_INDICATOR_FAVORITES];
  return normalizeFavoriteIds([...(picker ?? []), ...(sidebar ?? [])]);
}

/** Write only the new shared key; never destroy or rewrite either historical list. */
export function writeFavoriteIndicatorIds(ids: readonly string[], storage?: FavoritesStorage | null): string[] {
  const values = normalizeFavoriteIds(ids);
  const s = storage === undefined ? browserStorage() : storage;
  try {
    s?.setItem(SHARED_INDICATOR_FAVORITES_KEY, JSON.stringify(values));
    if (s && typeof window !== 'undefined') window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  } catch {
    // Keep UI usable when localStorage is disabled; no legacy data is touched.
  }
  return values;
}

export function toggleFavoriteIndicatorId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : normalizeFavoriteIds([...ids, id]);
}

/** Same-document custom event plus standard cross-tab storage event. */
export function subscribeFavoriteIndicatorUpdates(listener: (ids: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const refresh = () => listener(readFavoriteIndicatorIds());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || [
      SHARED_INDICATOR_FAVORITES_KEY, PICKER_LEGACY_FAVORITES_KEY, SIDEBAR_LEGACY_FAVORITES_KEY,
    ].includes(event.key)) refresh();
  };
  window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
    window.removeEventListener('storage', handleStorage);
  };
}

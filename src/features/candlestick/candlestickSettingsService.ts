export interface SavedCandlestickSettings {
  patterns: string[];
  bullColor: string;
  bearColor: string;
  neutralColor: string;
}

export const DEFAULT_CANDLESTICK_SETTINGS: SavedCandlestickSettings = {
  patterns: [
    'doji',
    'hammer',
    'inv_hammer',
    'shooting_star',
    'engulfing',
    'harami',
    'morning_star',
    'evening_star',
    'marubozu',
    'piercing',
    'dark_cloud',
    'soldiers',
    'crows',
  ],
  bullColor: '#22c55e',
  bearColor: '#ef4444',
  neutralColor: '#f59e0b',
};

const STORAGE_KEY = 'eod-chart.candlestick-settings.v1';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function loadSavedCandlestickSettings(): SavedCandlestickSettings {
  const storage = getStorage();
  if (!storage) return DEFAULT_CANDLESTICK_SETTINGS;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CANDLESTICK_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      patterns: Array.isArray(parsed.patterns) && parsed.patterns.length > 0 ? parsed.patterns : DEFAULT_CANDLESTICK_SETTINGS.patterns,
      bullColor: typeof parsed.bullColor === 'string' && parsed.bullColor ? parsed.bullColor : DEFAULT_CANDLESTICK_SETTINGS.bullColor,
      bearColor: typeof parsed.bearColor === 'string' && parsed.bearColor ? parsed.bearColor : DEFAULT_CANDLESTICK_SETTINGS.bearColor,
      neutralColor: typeof parsed.neutralColor === 'string' && parsed.neutralColor ? parsed.neutralColor : DEFAULT_CANDLESTICK_SETTINGS.neutralColor,
    };
  } catch {
    return DEFAULT_CANDLESTICK_SETTINGS;
  }
}

export function saveCandlestickSettings(settings: SavedCandlestickSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

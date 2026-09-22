import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CANDLESTICK_SETTINGS,
  loadSavedCandlestickSettings,
  saveCandlestickSettings,
} from '@/features/candlestick/candlestickSettingsService';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe('Candlestick Settings Persistence Service', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage;
  });

  it('returns default settings when storage is empty', () => {
    const settings = loadSavedCandlestickSettings();
    expect(settings).toEqual(DEFAULT_CANDLESTICK_SETTINGS);
    expect(settings.bullColor).toBe('#22c55e');
    expect(settings.bearColor).toBe('#ef4444');
  });

  it('saves and loads customized candlestick settings', () => {
    const custom = {
      patterns: ['hammer_bullish', 'shooting_star_bearish', 'engulfing_bullish'],
      bullColor: '#10b981',
      bearColor: '#f43f5e',
      neutralColor: '#eab308',
    };

    saveCandlestickSettings(custom);
    const loaded = loadSavedCandlestickSettings();
    expect(loaded).toEqual(custom);
  });
});

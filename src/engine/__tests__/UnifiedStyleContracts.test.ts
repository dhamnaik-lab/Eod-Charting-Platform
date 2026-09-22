import { describe, expect, it } from 'vitest';
import { isVisibleOnTimeframe, normalizeUnitOpacity } from '../UnifiedStyleContracts';

describe('UnifiedStyleContracts', () => {
  it('keeps omitted visibility backward-compatible on every supported timeframe', () => {
    for (const timeframe of ['D', 'W', 'M', 'Q', 'Y'] as const) {
      expect(isVisibleOnTimeframe(undefined, timeframe)).toBe(true);
      expect(isVisibleOnTimeframe({}, timeframe)).toBe(true);
    }
  });

  it('honors the master and per-timeframe visibility switches', () => {
    expect(isVisibleOnTimeframe({ visible: false }, 'D')).toBe(false);
    expect(isVisibleOnTimeframe({ timeframes: { D: false, W: true } }, 'D')).toBe(false);
    expect(isVisibleOnTimeframe({ timeframes: { D: false, W: true } }, 'W')).toBe(true);
    expect(isVisibleOnTimeframe({ timeframes: { D: false } }, 'M')).toBe(true);
  });

  it('clamps opacity to a stable 0..1 contract', () => {
    expect(normalizeUnitOpacity(-0.5)).toBe(0);
    expect(normalizeUnitOpacity(0.42)).toBe(0.42);
    expect(normalizeUnitOpacity(2)).toBe(1);
    expect(normalizeUnitOpacity(undefined, 0.7)).toBe(0.7);
  });
});

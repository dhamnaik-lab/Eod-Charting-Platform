import { describe, expect, it } from 'vitest';
import { applyOffset, aggregateBarsToHTF } from '../Indicators';
import type { OHLCBar } from '../types';

describe('Phase 3: MTF Resolution & Offset Displacement', () => {
  it('shifts values forward with positive offset (+2)', () => {
    const values = [10, 20, 30, 40, 50];
    const shifted = applyOffset(values, 2);
    expect(shifted).toEqual([null, null, 10, 20, 30]);
  });

  it('shifts values backward with negative offset (-2)', () => {
    const values = [10, 20, 30, 40, 50];
    const shifted = applyOffset(values, -2);
    expect(shifted).toEqual([30, 40, 50, null, null]);
  });

  it('returns original array when offset is 0', () => {
    const values = [10, 20, 30];
    expect(applyOffset(values, 0)).toEqual([10, 20, 30]);
  });

  it('aggregates daily bars to weekly HTF bars', () => {
    const bars: OHLCBar[] = [
      { date: '2026-01-05', timestamp: 1, open: 10, high: 15, low: 9, close: 12, volume: 100 },
      { date: '2026-01-06', timestamp: 2, open: 12, high: 18, low: 11, close: 16, volume: 150 },
      { date: '2026-01-12', timestamp: 3, open: 16, high: 20, low: 14, close: 19, volume: 200 },
    ];

    const { htfBars, indexMap } = aggregateBarsToHTF(bars, 'W');
    expect(htfBars).toHaveLength(2);
    expect(indexMap).toEqual([0, 0, 1]);

    // Week 1 aggregated bar
    expect(htfBars[0].open).toBe(10);
    expect(htfBars[0].high).toBe(18);
    expect(htfBars[0].low).toBe(9);
    expect(htfBars[0].close).toBe(16);
    expect(htfBars[0].volume).toBe(250);
  });
});

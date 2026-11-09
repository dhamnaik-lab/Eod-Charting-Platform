import { describe, expect, it } from 'vitest';
import {
  averageRange,
  averageVolume,
  computeAtrAt,
  findLocalPivots,
  findSwingPivots,
  gapDownPct,
  gapUpPct,
  hasDownTrend,
  hasUpTrend,
  isRangeBound,
  linearSlope,
  retracementDepthPct,
} from '@/plugins/scanner/chartPatternPrimitives';
import type { EodBar } from '@/plugins/scanner/types';

describe('chart pattern primitives', () => {
  it('calculates gap percentages and averages', () => {
    const bars = [
      bar('2026-01-01', 100, 110, 90, 100, 1000),
      bar('2026-01-02', 112, 116, 111, 115, 2000),
      bar('2026-01-03', 88, 90, 85, 86, 3000),
    ];

    expect(gapUpPct(bars[1], bars[0])).toBe(1.82);
    expect(gapDownPct(bars[2], bars[1])).toBe(20.72);
    expect(averageRange(bars, 2)).toBe(5);
    expect(averageVolume(bars, 2)).toBe(2500);
  });

  it('detects range and trend context', () => {
    expect(isRangeBound([
      bar('2026-01-01', 100, 105, 95, 100),
      bar('2026-01-02', 101, 106, 96, 102),
      bar('2026-01-03', 99, 104, 94, 101),
    ], 15)).toBe(true);

    expect(hasUpTrend([
      bar('2026-01-01', 100, 102, 98, 100),
      bar('2026-01-10', 110, 114, 108, 112),
    ], 8)).toBe(true);

    expect(hasDownTrend([
      bar('2026-01-01', 100, 102, 98, 100),
      bar('2026-01-10', 90, 92, 88, 88),
    ], 8)).toBe(true);
  });

  it('finds local pivots and line slope', () => {
    const pivots = findLocalPivots([
      bar('2026-01-01', 10, 11, 9, 10),
      bar('2026-01-02', 10, 15, 8, 14),
      bar('2026-01-03', 10, 12, 7, 8),
      bar('2026-01-04', 10, 11, 9, 10),
    ], 1);

    expect(pivots).toEqual([
      { index: 1, date: '2026-01-02', price: 15, kind: 'high' },
      { index: 2, date: '2026-01-03', price: 7, kind: 'low' },
    ]);
    expect(linearSlope([1, 2, 3, 4])).toBe(1);
    expect(linearSlope([{ x: 0, y: 10 }, { x: 5, y: 20 }])).toBe(2);
  });

  it('computes ATR and finds swing pivots with noise filtering', () => {
    const bars: EodBar[] = [];
    for (let i = 0; i < 30; i += 1) {
      const date = `2026-01-${String(i + 1).padStart(2, '0')}`;
      let base = 100;
      if (i >= 5 && i <= 10) base = 100 + (i - 5) * 5; // rise to 125
      else if (i > 10 && i <= 15) base = 125 - (i - 10) * 5; // drop to 100
      else if (i > 15 && i <= 20) base = 100 + (i - 15) * 5; // rise to 125
      else if (i > 20) base = 125 - (i - 20) * 2;
      bars.push(bar(date, base, base + 2, base - 2, base));
    }

    const atr = computeAtrAt(bars, 20, 14);
    expect(atr).toBeGreaterThan(0);

    const swingPivots = findSwingPivots(bars, { scales: [2, 3], minMovePct: 10, atrPeriod: 14, atrMultiplier: 1.5 });
    expect(swingPivots.length).toBeGreaterThanOrEqual(2);
    expect(swingPivots.every((pivot) => pivot.scale >= 2)).toBe(true);
    const prefixPivots = findSwingPivots(bars.slice(0, 20), { scales: [2, 3], minMovePct: 10, atrPeriod: 14, atrMultiplier: 1.5 });
    expect(swingPivots.slice(0, prefixPivots.length)).toEqual(prefixPivots);
    expect(retracementDepthPct(125, 125, 100)).toBe(20);
  });
});

function bar(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100000,
): EodBar {
  return {
    symbol: 'ABC',
    date,
    open,
    high,
    low,
    close,
    volume,
  };
}

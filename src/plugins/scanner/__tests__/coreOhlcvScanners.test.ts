import { describe, expect, it } from 'vitest';
import type { EodRow } from '@/platform';
import { coreOhlcvScannerDefinitions, runCoreScanner } from '@/plugins/scanner/coreOhlcvScanners';
import { mapEodRowsToScannerBars, type EodBar, type ScannerContext } from '@/plugins/scanner/types';

const definitions = Object.fromEntries(
  coreOhlcvScannerDefinitions.map((definition) => [definition.id, definition]),
);

describe('core OHLCV scanners', () => {
  it('maps EOD rows to sorted scanner bars and applies lookback', () => {
    const rows: EodRow[] = [
      { date: '2026-01-03', open: 12, high: 14, low: 11, close: 13, volume: 300 },
      { date: '2026-01-01', open: 10, high: 11, low: 9, close: 10, volume: 100 },
      { date: '2026-01-02', open: 11, high: 12, low: 10, close: 11, volume: 200 },
    ];

    expect(mapEodRowsToScannerBars('ABC', rows, 2)).toEqual([
      { symbol: 'ABC', date: '2026-01-02', open: 11, high: 12, low: 10, close: 11, volume: 200 },
      { symbol: 'ABC', date: '2026-01-03', open: 12, high: 14, low: 11, close: 13, volume: 300 },
    ]);
  });

  it('matches previous-day high and low breaks', () => {
    expect(run('prev_day_high_break', [
      bar('2026-01-01', 100, 110, 95, 104),
      bar('2026-01-02', 105, 113, 101, 111),
    ])?.direction).toBe('bullish');

    expect(run('prev_day_low_break', [
      bar('2026-01-01', 100, 110, 95, 104),
      bar('2026-01-02', 94, 98, 90, 94),
    ])?.direction).toBe('bearish');
  });

  it('matches inside, outside, gap, close-location, NR7, and wide-range cases', () => {
    expect(run('inside_bar', [
      bar('2026-01-01', 100, 110, 90, 102),
      bar('2026-01-02', 101, 108, 92, 103),
    ])).not.toBeNull();

    expect(run('outside_bar', [
      bar('2026-01-01', 100, 110, 90, 102),
      bar('2026-01-02', 101, 112, 88, 103),
    ])).not.toBeNull();

    expect(run('gap_up', [
      bar('2026-01-01', 100, 110, 90, 102),
      bar('2026-01-02', 111, 115, 108, 113),
    ])).not.toBeNull();

    expect(run('gap_down', [
      bar('2026-01-01', 100, 110, 90, 102),
      bar('2026-01-02', 89, 95, 85, 90),
    ])).not.toBeNull();

    expect(run('close_near_high', [
      bar('2026-01-01', 100, 110, 90, 109),
    ])).not.toBeNull();

    expect(run('close_near_low', [
      bar('2026-01-01', 100, 110, 90, 91),
    ])).not.toBeNull();

    expect(run('nr7', [
      bar('2026-01-01', 100, 110, 90, 101),
      bar('2026-01-02', 100, 112, 93, 101),
      bar('2026-01-03', 100, 113, 95, 101),
      bar('2026-01-04', 100, 111, 94, 101),
      bar('2026-01-05', 100, 114, 98, 101),
      bar('2026-01-06', 100, 113, 98, 101),
      bar('2026-01-07', 100, 104, 100, 102),
    ])).not.toBeNull();

    expect(run('wide_range_candle', [
      ...Array.from({ length: 14 }, (_, index) => bar(`2026-01-${String(index + 1).padStart(2, '0')}`, 100, 110, 100, 105)),
      bar('2026-01-15', 100, 130, 100, 125),
    ])).not.toBeNull();
  });

  it('returns no result for non-matches', () => {
    expect(run('prev_day_high_break', [
      bar('2026-01-01', 100, 110, 90, 102),
      bar('2026-01-02', 101, 109, 95, 109),
    ])).toBeNull();
  });
});

function run(scannerId: string, bars: EodBar[]) {
  const definition = definitions[scannerId];
  if (!definition) {
    throw new Error(`Missing definition ${scannerId}`);
  }
  const context: ScannerContext = {
    symbol: 'ABC',
    exchange: 'NSE',
    bars,
  };
  return runCoreScanner(context, definition);
}

function bar(date: string, open: number, high: number, low: number, close: number): EodBar {
  return {
    symbol: 'ABC',
    date,
    open,
    high,
    low,
    close,
    volume: 100000,
  };
}

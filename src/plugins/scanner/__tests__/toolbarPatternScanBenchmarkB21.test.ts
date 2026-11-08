import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { runActiveChartPatternScan } from '@/components/Toolbar';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';

const INSTRUMENT = { exchange: 'NSE', symbol: 'B21_SYNTHETIC' };
const HISTORY_LENGTHS = [260, 520, 1000] as const;

function completedHistory(length: number): EodBar[] {
  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10);
    const trend = index * 0.04;
    const swing = Math.sin(index / 13) * 8 + Math.cos(index / 51) * 5;
    const close = 100 + trend + swing;
    const open = close - Math.cos(index / 8);
    return {
      symbol: INSTRUMENT.symbol,
      date,
      open,
      high: Math.max(open, close) + 1.6,
      low: Math.min(open, close) - 1.7,
      close,
      volume: Math.round(100_000 * (1 + (index % 17) / 25)),
    };
  });
}

function stable(results: ScannerResult[]) {
  return results.map(({ generatedAt: _generatedAt, ...rest }) => rest);
}

describe('B21: current synchronous toolbar macro-pattern benchmark (no migration)', () => {
  it('records repeatable elapsed and event-loop-blocking baseline on pinned 260/520/1000-bar histories', async () => {
    // Prime compilation/JIT separately from the measured runs.
    runActiveChartPatternScan(INSTRUMENT, completedHistory(120));
    for (const length of HISTORY_LENGTHS) {
      const bars = completedHistory(length);
      const originalBars = bars.map(bar => ({ ...bar }));
      const durations: number[] = [];
      const eventLoopDelays: number[] = [];
      const samples: ScannerResult[][] = [];
      for (let trial = 0; trial < 2; trial++) {
        // A zero-delay timer shows how long synchronous scanning blocks the
        // surrounding event loop. This is NOT a browser frame-time metric.
        const scheduledAt = performance.now();
        const timer = new Promise<number>(resolve => setTimeout(() => resolve(performance.now() - scheduledAt), 0));
        const scanStart = performance.now();
        const result = runActiveChartPatternScan(INSTRUMENT, bars);
        durations.push(performance.now() - scanStart);
        eventLoopDelays.push(await timer);
        samples.push(result);
      }
      expect(stable(samples[1])).toEqual(stable(samples[0]));
      expect(bars).toEqual(originalBars);
      for (const result of samples[0]) {
        expect(result.history?.matchCount).toBe(1);
        expect(result.history?.lastMatchedDate).toBe(result.date);
        expect(result.matched).toBe(true);
      }
      expect(new Set(samples[0].map(r => `${r.scannerId}|${r.date}|${r.direction ?? ''}`)).size)
        .toBe(samples[0].length);
      const rounded = (x: number) => Number(x.toFixed(2));
      console.log('B21_BENCHMARK ' + JSON.stringify({
        bars: length,
        scannerPath: 'Toolbar.runActiveChartPatternScan',
        source: 'deterministic synthetic completed OHLCV',
        runs: 2,
        scanMs: durations.map(rounded),
        eventLoopTimerDelayMs: eventLoopDelays.map(rounded),
        matchedMilestones: samples[0].length,
        resultParity: true,
      }));
    }
  }, 120_000);

  it('returns no results before the existing 20 completed-bar minimum, without changing input', () => {
    const bars = completedHistory(19);
    expect(runActiveChartPatternScan(INSTRUMENT, bars)).toEqual([]);
    expect(bars).toHaveLength(19);
  });
});

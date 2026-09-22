import { describe, expect, it, vi } from 'vitest';
import type { EodRow, Watchlist } from '@/platform';
import { loadCompleteChartHistory } from '@/plugins/scanner/chartPatternScanService';
import {
  DEFAULT_LOOKBACK_BARS,
  parseLookbackBars,
  parseLookbackSelection,
  resolveScannerTargets,
} from '@/plugins/scanner/scannerRunConfig';
import { runCoreEodScannerBatch } from '@/plugins/scanner/scannerRunner';
import { evaluateChartPatterns } from '@/plugins/scanner/chartPatternEvaluation';
import { mapEodRowsToScannerBars } from '@/plugins/scanner/types';

function makeRows(count: number): EodRow[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2020-${String(index + 1).padStart(5, '0')}`,
    open: index + 1,
    high: index + 2,
    low: index,
    close: index + 1.5,
    volume: 1000 + index,
  }));
}

function makeRangeRows(count = 25): EodRow[] {
  return Array.from({ length: count }, (_, index) => {
    const high = index % 5 === 0 ? 110 : 106 + (index % 3);
    const low = index % 4 === 0 ? 100 : 101 + (index % 2);
    return {
      date: `2027-02-${String(index + 1).padStart(2, '0')}`,
      open: 104,
      high,
      low,
      close: 105,
      volume: 1000,
    };
  });
}

describe('scanner history and scope', () => {
  it('defaults to 800 bars and keeps numeric lookback input unbounded', () => {
    expect(DEFAULT_LOOKBACK_BARS).toBe(800);
    expect(parseLookbackBars('800')).toBe(800);
    expect(parseLookbackBars('2400')).toBe(2400);
    expect(parseLookbackBars('not-a-number')).toBe(800);
  });

  it('represents All history explicitly and does not truncate it', () => {
    expect(parseLookbackSelection('all', '800')).toBeNull();
    const rows = makeRows(1200);
    expect(mapEodRowsToScannerBars('NIFTY500', rows, 800)).toHaveLength(800);
    expect(mapEodRowsToScannerBars('NIFTY500', rows, null)).toHaveLength(1200);
  });

  it('returns the complete selected watchlist without a replacement cap', async () => {
    const watchlist: Watchlist = {
      id: 1,
      name: 'Nifty 500',
      items: Array.from({ length: 500 }, (_, index) => ({
        symbol: `SYM${index + 1}`,
        exchange: 'NSE',
        name: `Symbol ${index + 1}`,
      })),
    };
    const listSymbols = vi.fn();
    const targets = await resolveScannerTargets(
      { listSymbols },
      {
        exchange: 'NSE',
        universeSource: 'watchlists',
        activeInstrument: null,
        selectedWatchlists: [watchlist],
        maxSymbols: 1,
      },
    );

    expect(targets).toHaveLength(500);
    expect(targets[0]?.symbol).toBe('SYM1');
    expect(targets[499]?.symbol).toBe('SYM500');
    expect(listSymbols).not.toHaveBeenCalled();
  });

  it('loads complete individual-chart history through getEodData', async () => {
    const getEodData = vi.fn().mockResolvedValue({
      requestedSymbol: 'ABC',
      requestedExchange: 'NSE',
      adjusted: false,
      includeDividendAdjustments: false,
      includeRightsAdjustments: false,
      instrument: null,
      bars: makeRows(1200),
      events: [],
    });

    const bars = await loadCompleteChartHistory(
      { getEodData },
      { exchange: 'NSE', symbol: 'ABC' },
    );

    expect(getEodData).toHaveBeenCalledWith({ symbol: 'ABC', exchange: 'NSE' });
    expect(bars).toHaveLength(1200);
    expect(bars[0]?.date).toBe('2020-00001');
    expect(bars[1199]?.date).toBe('2020-01200');
  });

  it('reports progress and stops between symbols when cancellation is requested', async () => {
    const progress: string[] = [];
    const getEodData = vi.fn().mockResolvedValue({
      requestedSymbol: 'ABC',
      requestedExchange: 'NSE',
      adjusted: false,
      includeDividendAdjustments: false,
      includeRightsAdjustments: false,
      instrument: null,
      bars: makeRows(2),
      events: [],
    });

    const output = await runCoreEodScannerBatch(
      { getEodData },
      {
        targets: [
          { symbol: 'ABC', exchange: 'NSE' },
          { symbol: 'DEF', exchange: 'NSE' },
        ],
        scannerIds: [],
        lookbackBars: DEFAULT_LOOKBACK_BARS,
        shouldCancel: () => progress.length > 0,
        onProgress: ({ symbol }) => progress.push(symbol),
      },
    );

    expect(output.cancelled).toBe(true);
    expect(output.scannedSymbols).toBe(1);
    expect(progress).toEqual(['ABC']);
    expect(getEodData).toHaveBeenCalledTimes(1);
  });

  it('evaluates All history as grouped chart-pattern episodes instead of latest-bar-only results', async () => {
    const streamedResults: number[] = [];
    const getEodData = vi.fn().mockResolvedValue({
      requestedSymbol: 'RANGE',
      requestedExchange: 'NSE',
      adjusted: false,
      includeDividendAdjustments: false,
      includeRightsAdjustments: false,
      instrument: null,
      bars: makeRangeRows(),
      events: [],
    });

    const output = await runCoreEodScannerBatch(
      { getEodData },
      {
        targets: [{ symbol: 'RANGE', exchange: 'NSE' }],
        scannerIds: ['chart_rectangle_range'],
        lookbackBars: null,
        evaluateHistory: true,
        onResultChunk: (chunk) => streamedResults.push(chunk.length),
      },
    );

    expect(output.results).not.toHaveLength(0);
    expect(output.results.every((result) => result.history?.firstMatchedDate === result.date)).toBe(true);
    expect(output.results.some((result) => (result.history?.matchCount ?? 0) > 1)).toBe(true);
    expect(output.results.some((result) => result.history?.lastMatchedDate !== result.date)).toBe(true);
    expect(streamedResults.reduce((total, count) => total + count, 0)).toBe(output.results.length);
  });

  it('keeps responsive and fast chart-pattern evaluation results equivalent', async () => {
    const input = {
      target: { symbol: 'RANGE', exchange: 'NSE' },
      bars: mapEodRowsToScannerBars('RANGE', makeRangeRows(60), null),
      scannerIds: ['chart_rectangle_range'],
      evaluateHistory: true,
    };

    const responsive = await evaluateChartPatterns({ ...input, executionMode: 'responsive' });
    const fast = await evaluateChartPatterns({ ...input, executionMode: 'fast' });

    expect(normalizeResults(responsive.historicalResults)).toEqual(normalizeResults(fast.historicalResults));
    expect(normalizeResults(responsive.latestResults)).toEqual(normalizeResults(fast.latestResults));
  });

  it('cancels a responsive active-history calculation without scanning the next symbol', async () => {
    let cancel = false;
    const getEodData = vi.fn().mockResolvedValue({
      requestedSymbol: 'RANGE',
      requestedExchange: 'NSE',
      adjusted: false,
      includeDividendAdjustments: false,
      includeRightsAdjustments: false,
      instrument: null,
      bars: makeRangeRows(60),
      events: [],
    });

    const output = await runCoreEodScannerBatch(
      { getEodData },
      {
        targets: [
          { symbol: 'RANGE', exchange: 'NSE' },
          { symbol: 'NEXT', exchange: 'NSE' },
        ],
        scannerIds: ['chart_rectangle_range'],
        lookbackBars: null,
        evaluateHistory: true,
        executionMode: 'responsive',
        shouldCancel: () => cancel,
        onProgress: ({ historyCompleted }) => {
          if (historyCompleted && historyCompleted >= 25) cancel = true;
        },
      },
    );

    expect(output.cancelled).toBe(true);
    expect(output.scannedSymbols).toBe(1);
    expect(getEodData).toHaveBeenCalledTimes(1);
  });
});

function normalizeResults(results: Array<{ scannerId: string; date: string; history?: { matchCount: number; lastMatchedDate: string } }>) {
  return results.map((result) => ({
    scannerId: result.scannerId,
    date: result.date,
    matchCount: result.history?.matchCount,
    lastMatchedDate: result.history?.lastMatchedDate,
  }));
}

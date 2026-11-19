import { afterEach, describe, expect, it, vi } from 'vitest';
import { runActiveChartPatternScan } from '@/components/Toolbar';
import { loadSourceFunctions } from '@/components/__tests__/scannerDrawingTestHarness';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/features/chartPatterns';
import {
  clusterToolbarChartPatternResults,
  evaluateToolbarChartPatterns,
  resolveToolbarChartPatternSelection,
  TOOLBAR_CHART_PATTERN_STORAGE_KEY,
} from '@/features/chartPatterns/evaluation';
import { createChartPatternEvaluationExecutor } from '@/features/chartPatterns/workerClient';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';

const INSTRUMENT = { exchange: 'NSE', symbol: 'CHIP01_TEST' };

function makeSyntheticHistory(length: number): EodBar[] {
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

function makeHeadAndShouldersHistory(): EodBar[] {
  const ranges = [
    ...Array.from({ length: 4 }, () => [85, 87, 83, 85]),
    [88, 92, 86, 90], [90, 96, 88, 94], [94, 104, 92, 101], [101, 110, 99, 106],
    [105, 108, 96, 98], [98, 103, 92, 95], [96, 112, 95, 110], [110, 124, 108, 120],
    [118, 121, 104, 106], [106, 111, 94, 96], [98, 108, 96, 106], [106, 112, 102, 108],
    [104, 108, 98, 100], [100, 104, 96, 98], [98, 101, 93, 95], [94, 98, 89, 91],
  ];
  return ranges.map(([open, high, low, close], index) => ({
    symbol: INSTRUMENT.symbol,
    date: `2028-06-${String(index + 1).padStart(2, '0')}`,
    open,
    high,
    low,
    close,
    volume: 100_000,
  }));
}

function stable(results: ScannerResult[]) {
  return results.map(({ generatedAt: _generatedAt, ...rest }) => rest);
}

class MockWorker {
  static instances: MockWorker[] = [];
  readonly url: string | URL;
  readonly options?: WorkerOptions;
  readonly posted: unknown[] = [];
  terminated = false;
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(data: unknown) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data });
    }
  }

  emitError(message: string) {
    for (const listener of this.listeners.get('error') ?? []) {
      listener({ message });
    }
  }

  emitMessageError() {
    for (const listener of this.listeners.get('messageerror') ?? []) {
      listener({});
    }
  }
}

describe('CHIP-01: toolbar chart-pattern worker evaluation and clustering', () => {
  afterEach(() => {
    MockWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it('preserves all 54 chart pattern definitions', () => {
    expect(chartPatternScannerDefinitions).toHaveLength(54);
  });

  it('produces exact result parity with runActiveChartPatternScan across 260/520/1000-bar histories', async () => {
    const { scannerIds, minScore } = resolveToolbarChartPatternSelection(null);
    expect(minScore).toBe(65);
    expect(scannerIds.length).toBeGreaterThan(0);

    for (const length of [19, 260, 520, 1000]) {
      const bars = makeSyntheticHistory(length);
      const expected = runActiveChartPatternScan(INSTRUMENT, bars);
      const actual = await evaluateToolbarChartPatterns({
        target: INSTRUMENT,
        bars,
        scannerIds,
        minScore,
        executionMode: 'fast',
      });
      expect(actual.cancelled).toBe(false);
      expect(stable(actual.results)).toEqual(stable(expected));
    }
  }, 60_000);

  it('preserves custom localStorage pattern selection, minScore=40, empty selection, and malformed fallback', async () => {
    const bars = makeHeadAndShouldersHistory();
    const storageMap = new Map<string, string>();
    const customToolbar = loadSourceFunctions(
      'src/components/Toolbar.tsx',
      ['runActiveChartPatternScan', 'clusterNearbyMacroResults', 'ACTIVE_CHART_PATTERN_MIN_BARS', 'ACTIVE_CHART_PATTERN_CONTEXT_BARS'],
      {
        chartPatternScannerDefinitions,
        runChartPatternScanner,
        window: {
          localStorage: {
            getItem: (key: string) => storageMap.get(key) ?? null,
          },
        },
      },
    );

    const mockStorage = { getItem: (key: string) => storageMap.get(key) ?? null };

    // Custom subset
    storageMap.set(TOOLBAR_CHART_PATTERN_STORAGE_KEY, JSON.stringify(['chart_head_shoulders', 'nonexistent_id']));
    const customSelection = resolveToolbarChartPatternSelection(mockStorage);
    expect(customSelection).toEqual({ scannerIds: ['chart_head_shoulders'], minScore: 40 });
    const customEval = await evaluateToolbarChartPatterns({
      target: INSTRUMENT,
      bars,
      ...customSelection,
      executionMode: 'fast',
    });
    expect(stable(customEval.results)).toEqual(stable(customToolbar.runActiveChartPatternScan(INSTRUMENT, bars)));
    expect(customEval.results.map((r) => r.scannerId)).toEqual(['chart_head_shoulders']);

    // Empty array selection
    storageMap.set(TOOLBAR_CHART_PATTERN_STORAGE_KEY, JSON.stringify([]));
    const emptySelection = resolveToolbarChartPatternSelection(mockStorage);
    expect(emptySelection).toEqual({ scannerIds: [], minScore: 40 });
    const emptyEval = await evaluateToolbarChartPatterns({
      target: INSTRUMENT,
      bars,
      ...emptySelection,
      executionMode: 'fast',
    });
    expect(emptyEval.results).toEqual([]);
    expect(customToolbar.runActiveChartPatternScan(INSTRUMENT, bars)).toEqual([]);

    // Malformed JSON falls back to default macro minScore=65
    storageMap.set(TOOLBAR_CHART_PATTERN_STORAGE_KEY, '{bad-json');
    const fallbackSelection = resolveToolbarChartPatternSelection(mockStorage);
    expect(fallbackSelection.minScore).toBe(65);
    const fallbackEval = await evaluateToolbarChartPatterns({
      target: INSTRUMENT,
      bars,
      ...fallbackSelection,
      executionMode: 'fast',
    });
    expect(stable(fallbackEval.results)).toEqual(stable(customToolbar.runActiveChartPatternScan(INSTRUMENT, bars)));
  });

  it('matches clusterNearbyMacroResults behavior exactly including duplicate dates and 12-bar boundary', () => {
    const toolbarFns = loadSourceFunctions('src/components/Toolbar.tsx', ['clusterNearbyMacroResults']);
    const bars: EodBar[] = Array.from({ length: 30 }, (_, index) => ({
      symbol: 'CLUS',
      date: index === 15 ? '2026-01-10' : `2026-01-${String(index + 1).padStart(2, '0')}`,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
    }));

    const mkResult = (scannerId: string, date: string, score: number, family: 'reversal' | 'continuation' = 'reversal'): ScannerResult => ({
      symbol: 'CLUS',
      exchange: 'NSE',
      scannerId,
      scannerName: scannerId,
      categoryId: 'chart',
      categoryName: 'Chart Patterns',
      date,
      matched: true,
      direction: 'bullish',
      score,
      generatedAt: '2026-01-01T00:00:00.000Z',
      chartPattern: { family, confidence: score, patternEndDate: date },
    });

    const input: ScannerResult[] = [
      mkResult('chart_double_bottom', bars[2]!.date, 70, 'reversal'),
      mkResult('chart_triple_bottom', bars[10]!.date, 85, 'reversal'), // same family within 12 bars -> replaces index 2
      mkResult('chart_head_shoulders', bars[22]!.date, 65, 'reversal'), // 12 bars from index 10 -> replaced if >85, else kept? 65 <= 85 so dropped!
      mkResult('chart_head_shoulders', bars[23]!.date, 75, 'reversal'), // 13 bars from index 10 -> separate cluster!
      mkResult('chart_falling_wedge', bars[11]!.date, 60, 'continuation'), // different family & scannerId -> separate cluster!
      mkResult('chart_double_bottom', bars[15]!.date, 90, 'reversal'), // duplicate date '2026-01-10' maps to index 9 (within 12 of 10) -> replaces 85!
    ];

    expect(clusterToolbarChartPatternResults([], bars)).toEqual([]);
    expect(clusterToolbarChartPatternResults([input[0]!], bars)).toEqual([input[0]!]);
    expect(clusterToolbarChartPatternResults(input, bars)).toEqual(toolbarFns.clusterNearbyMacroResults(input, bars));
  });

  it('dispatches evaluate-toolbar to Worker, isolates stale responses, terminates on cancel/dispose, and preserves ScannerWindow evaluate()', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const executor = createChartPatternEvaluationExecutor();
    // Lazy creation: no worker spawned until a scan is submitted
    expect(MockWorker.instances).toHaveLength(0);

    const bars = makeHeadAndShouldersHistory();
    const firstPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    expect(MockWorker.instances).toHaveLength(1);
    const worker1 = MockWorker.instances[0]!;
    expect(worker1.posted[0]).toMatchObject({
      type: 'evaluate-toolbar',
      requestId: 1,
      input: {
        target: INSTRUMENT,
        scannerIds: ['chart_head_shoulders'],
        minScore: 40,
        executionMode: 'fast',
      },
    });

    // Cancel terminates worker1 and resolves with cancelled=true
    executor.cancel();
    expect(worker1.terminated).toBe(true);
    await expect(firstPromise).resolves.toEqual({ results: [], cancelled: true });

    // Even if a late message arrives on terminated worker1, it is ignored
    worker1.emitMessage({ type: 'complete-toolbar', requestId: 1, output: { results: [{ scannerId: 'stale' }], cancelled: false } });

    // Next toolbar evaluation creates worker2 and succeeds
    const secondPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    expect(MockWorker.instances).toHaveLength(2);
    const worker2 = MockWorker.instances[1]!;
    const expectedOutput = { results: runActiveChartPatternScan(INSTRUMENT, bars), cancelled: false };
    worker2.emitMessage({ type: 'complete-toolbar', requestId: 999, output: { results: [], cancelled: false } }); // wrong requestId ignored
    worker2.emitMessage({ type: 'complete-toolbar', requestId: 2, output: expectedOutput });
    await expect(secondPromise).resolves.toEqual(expectedOutput);

    // Existing ScannerWindow evaluate() behavior remains intact on worker2
    const progressEvents: unknown[] = [];
    const scannerPromise = executor.evaluate({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      evaluateHistory: true,
      executionMode: 'responsive',
      onProgress: (progress) => progressEvents.push(progress),
    });
    expect(MockWorker.instances).toHaveLength(2); // reused worker2
    await expect(
      executor.evaluate({
        target: INSTRUMENT,
        bars,
        scannerIds: ['chart_head_shoulders'],
        evaluateHistory: false,
        executionMode: 'fast',
      }),
    ).rejects.toThrow('Chart-pattern worker is already evaluating a symbol.');

    worker2.emitMessage({ type: 'progress', requestId: 3, progress: { completed: 1, total: 1, resultCount: 1 } });
    worker2.emitMessage({
      type: 'complete',
      requestId: 3,
      output: { latestResults: [], historicalResults: expectedOutput.results, cancelled: false },
    });
    expect(progressEvents).toEqual([{ completed: 1, total: 1, resultCount: 1 }]);
    await expect(scannerPromise).resolves.toEqual({
      latestResults: [],
      historicalResults: expectedOutput.results,
      cancelled: false,
    });

    // Error terminates worker2 so subsequent run spawns a clean worker3
    const erroredPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    worker2.emitError('Worker crashed');
    await expect(erroredPromise).rejects.toThrow('Worker crashed');
    expect(worker2.terminated).toBe(true);

    // Dispose terminates active worker and blocks post-dispose launches
    const thirdPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    expect(MockWorker.instances).toHaveLength(3);
    const worker3 = MockWorker.instances[2]!;
    executor.dispose();
    expect(worker3.terminated).toBe(true);
    await expect(thirdPromise).resolves.toEqual({ results: [], cancelled: true });
    await expect(
      executor.evaluateToolbar({
        target: INSTRUMENT,
        bars,
        scannerIds: ['chart_head_shoulders'],
        minScore: 40,
        executionMode: 'fast',
      }),
    ).resolves.toEqual({ results: [], cancelled: true });
    expect(MockWorker.instances).toHaveLength(3);
  });

  it('supports responsive cancellation in inline fallback without un-cancelling an earlier run', async () => {
    vi.stubGlobal('Worker', undefined);
    const executor = createChartPatternEvaluationExecutor();
    const bars = makeSyntheticHistory(200);

    const first = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders', 'chart_double_bottom'],
      minScore: 40,
      executionMode: 'responsive',
    });
    executor.cancel();
    const second = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars: makeHeadAndShouldersHistory(),
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'responsive',
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual({ results: [], cancelled: true });
    expect(secondResult.cancelled).toBe(false);
    expect(secondResult.results.map((r) => r.scannerId)).toEqual(['chart_head_shoulders']);

    executor.dispose();
  });

  it('handles evaluate-toolbar and evaluate inside evaluation.worker.ts', async () => {
    const listeners = new Map<string, (event: { data: unknown }) => void>();
    const posted: unknown[] = [];
    vi.stubGlobal('self', {
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        listeners.set(type, listener);
      },
      postMessage: (message: unknown) => {
        posted.push(message);
      },
    });
    vi.resetModules();
    await import('@/features/chartPatterns/evaluation.worker');
    const onMessage = listeners.get('message');
    expect(onMessage).toBeTypeOf('function');

    const bars = makeHeadAndShouldersHistory();
    onMessage!({
      data: {
        type: 'evaluate-toolbar',
        requestId: 7,
        input: {
          target: INSTRUMENT,
          bars,
          scannerIds: ['chart_head_shoulders'],
          minScore: 40,
          executionMode: 'fast',
        },
      },
    });
    await vi.waitFor(() => {
      expect(posted.some((msg: any) => msg.type === 'complete-toolbar' && msg.requestId === 7)).toBe(true);
    });
    const toolbarReply = posted.find((msg: any) => msg.type === 'complete-toolbar' && msg.requestId === 7) as {
      output: { results: ScannerResult[]; cancelled: boolean };
    };
    expect(toolbarReply.output.cancelled).toBe(false);
    expect(toolbarReply.output.results.map((r) => r.scannerId)).toEqual(['chart_head_shoulders']);

    onMessage!({
      data: {
        type: 'evaluate',
        requestId: 8,
        input: {
          target: INSTRUMENT,
          bars,
          scannerIds: ['chart_head_shoulders'],
          evaluateHistory: true,
          executionMode: 'fast',
        },
      },
    });
    await vi.waitFor(() => {
      expect(posted.some((msg: any) => msg.type === 'complete' && msg.requestId === 8)).toBe(true);
    });
  });

  it('produces exact parity with runActiveChartPatternScan when all 54 patterns (minScore=40) are enabled via localStorage', async () => {
    const allIds = chartPatternScannerDefinitions.map((definition) => definition.id);
    expect(allIds).toHaveLength(54);
    const storageMap = new Map<string, string>([
      [TOOLBAR_CHART_PATTERN_STORAGE_KEY, JSON.stringify(allIds)],
    ]);
    const customToolbar = loadSourceFunctions(
      'src/components/Toolbar.tsx',
      ['runActiveChartPatternScan', 'clusterNearbyMacroResults', 'ACTIVE_CHART_PATTERN_MIN_BARS', 'ACTIVE_CHART_PATTERN_CONTEXT_BARS'],
      {
        chartPatternScannerDefinitions,
        runChartPatternScanner,
        window: {
          localStorage: {
            getItem: (key: string) => storageMap.get(key) ?? null,
          },
        },
      },
    );

    const bars = makeSyntheticHistory(420);
    const selection = resolveToolbarChartPatternSelection({ getItem: (key) => storageMap.get(key) ?? null });
    expect(selection).toEqual({ scannerIds: allIds, minScore: 40 });

    const expected = customToolbar.runActiveChartPatternScan(INSTRUMENT, bars);
    const actual = await evaluateToolbarChartPatterns({
      target: INSTRUMENT,
      bars,
      ...selection,
      executionMode: 'fast',
    });

    expect(actual.cancelled).toBe(false);
    expect(stable(actual.results)).toEqual(stable(expected));
  }, 60_000);

  it('rejects worker constructor, postMessage, and messageerror failures cleanly as Promises and recovers on next run', async () => {
    let failConstructor = true;
    class FlakyWorker extends MockWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (failConstructor) {
          throw new Error('CSP blocked worker creation');
        }
        super(url, options);
      }
    }
    vi.stubGlobal('Worker', FlakyWorker);

    const executor = createChartPatternEvaluationExecutor();
    const bars = makeHeadAndShouldersHistory();
    await expect(
      executor.evaluateToolbar({
        target: INSTRUMENT,
        bars,
        scannerIds: ['chart_head_shoulders'],
        minScore: 40,
        executionMode: 'fast',
      }),
    ).rejects.toThrow('CSP blocked worker creation');
    expect(MockWorker.instances).toHaveLength(0);

    // Subsequent call recovers once Worker creation succeeds
    failConstructor = false;
    const messageErrorPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    expect(MockWorker.instances).toHaveLength(1);
    const worker1 = MockWorker.instances[0]!;
    worker1.emitMessageError();
    await expect(messageErrorPromise).rejects.toThrow('Chart-pattern worker failed to deserialize response.');
    expect(worker1.terminated).toBe(true);

    // postMessage throw cleans activeRequest so subsequent run works on fresh worker
    const nextRun = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    expect(MockWorker.instances).toHaveLength(2);
    const worker2 = MockWorker.instances[1]!;
    const origPost = worker2.postMessage.bind(worker2);
    let failPost = true;
    worker2.postMessage = (message: unknown) => {
      if (failPost) {
        throw new Error('DataCloneError');
      }
      origPost(message);
    };

    // Wait: nextRun already posted, so test a failing postMessage on a fresh executor
    worker2.emitMessage({ type: 'complete-toolbar', requestId: 2, output: { results: [], cancelled: false } });
    await expect(nextRun).resolves.toEqual({ results: [], cancelled: false });

    failPost = true;
    worker2.postMessage = () => {
      throw new Error('DataCloneError');
    };
    await expect(
      executor.evaluateToolbar({
        target: INSTRUMENT,
        bars,
        scannerIds: ['chart_head_shoulders'],
        minScore: 40,
        executionMode: 'fast',
      }),
    ).rejects.toThrow('DataCloneError');

    worker2.postMessage = origPost;
    const expectedRecovered = runActiveChartPatternScan(INSTRUMENT, bars);
    const recoveredRun = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars,
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'fast',
    });
    worker2.emitMessage({
      type: 'complete-toolbar',
      requestId: 4,
      output: { results: expectedRecovered, cancelled: false },
    });
    const recovered = await recoveredRun;
    expect(recovered).toEqual({ results: expectedRecovered, cancelled: false });

    executor.dispose();
  });

  it('cancels an active inline toolbar evaluation immediately if evaluate() is invoked', async () => {
    vi.stubGlobal('Worker', undefined);
    const executor = createChartPatternEvaluationExecutor();
    const toolbarPromise = executor.evaluateToolbar({
      target: INSTRUMENT,
      bars: makeSyntheticHistory(200),
      scannerIds: ['chart_head_shoulders'],
      minScore: 40,
      executionMode: 'responsive',
    });
    const scannerPromise = executor.evaluate({
      target: INSTRUMENT,
      bars: makeHeadAndShouldersHistory(),
      scannerIds: ['chart_head_shoulders'],
      evaluateHistory: false,
      executionMode: 'fast',
    });

    const [toolbarOut, scannerOut] = await Promise.all([toolbarPromise, scannerPromise]);
    expect(toolbarOut).toEqual({ results: [], cancelled: true });
    expect(scannerOut.cancelled).toBe(false);
    expect(scannerOut.latestResults.map((r) => r.scannerId)).toEqual(['chart_head_shoulders']);
    executor.dispose();
  });
});

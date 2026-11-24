import { describe, expect, it, vi } from 'vitest';
import type { ScannerDefinition, ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';
import {
  canRunNatively,
  compileNativeScannerRules,
  describeNativeCapability,
  describeNativeUnsupportedScanners,
  formatNativeScannerStatus,
  formatScannerCompletionStatus,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import type {
  NativeScanMatchBatchEventV1,
  NativeScanProgressEventV1,
} from '@/features/scanner/nativeScanContract';
import {
  NATIVE_SUPPORTED_PATTERN_IDS,
  splitNativeSupportedScannerIds,
} from '@/features/scanner/nativeScanContract';

const definitions: ScannerDefinition[] = NATIVE_SUPPORTED_PATTERN_IDS.map((id) => ({
  id,
  name: id,
  categoryId: 'chart_patterns_gap',
  categoryName: 'Chart Patterns - Gaps',
  priority: 2,
  scannerType: 'gap',
  description: 'fixture',
  logicText: 'fixture',
  requiredData: ['ohlcv'],
  suggestedOutputColumns: [],
  implementationStatus: 'ready_for_engine',
}));

function tsOutput(overrides: Partial<ScannerRunOutput> = {}): ScannerRunOutput {
  return {
    results: [],
    alertTriggers: [],
    errors: [],
    scannedSymbols: 2,
    cancelled: false,
    ...overrides,
  };
}

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    targets: [
      { exchange: 'NSE', symbol: 'INFY' },
      { exchange: 'NSE', symbol: 'TCS' },
    ],
    scannerIds: ['chart_breakaway_gap'],
    lookbackBars: 800,
    toDate: null,
    evaluateHistory: false,
    alertRules: [],
    ...overrides,
  } as Parameters<typeof runNativeOrTypeScriptScannerBatch>[0];
}

describe('NS-04 native opt-in gating', () => {
  it('treats an unsupported or mixed scanner selection as TypeScript-only', () => {
    expect(canRunNatively(['chart_breakaway_gap'], definitions)).toBe(true);
    expect(canRunNatively(['core_volume_spike'], definitions)).toBe(false);
    expect(canRunNatively(['chart_breakaway_gap', 'core_volume_spike'], definitions)).toBe(false);
    expect(canRunNatively([], definitions)).toBe(false);
  });

  it('never silently drops unsupported scanner ids', () => {
    const split = splitNativeSupportedScannerIds([
      'chart_breakaway_gap',
      'core_volume_spike',
      'plugin_external',
    ]);
    expect(split.native).toEqual(['chart_breakaway_gap']);
    expect(split.remaining).toEqual(['core_volume_spike', 'plugin_external']);
    const message = describeNativeUnsupportedScanners([
      'chart_breakaway_gap',
      'core_volume_spike',
    ]);
    expect(message).toContain('core_volume_spike');
    expect(message).toContain('TypeScript backend');
    expect(describeNativeCapability()).toContain('off by default');
  });

  it('builds one native rule per supported scanner and flags absent ids', () => {
    const compiled = compileNativeScannerRules(
      ['chart_common_gap', 'not_a_real_scanner'],
      definitions,
    );
    // `not_a_real_scanner` is not a natively supported pattern id, so it is reported as
    // TypeScript-only instead of being silently mapped to something else.
    expect(compiled.rules).toEqual([
      { id: 'chart_common_gap', expression: { kind: 'pattern', id: 'chart_common_gap' } },
    ]);
    expect(compiled.unsupportedScannerIds).toEqual(['not_a_real_scanner']);
    expect(compiled.compileErrors).toHaveLength(0);

    // A supported id that is missing from the catalog is a compile error, not a silent skip.
    const missing = compileNativeScannerRules(['chart_common_gap'], []);
    expect(missing.rules).toHaveLength(0);
    expect(missing.compileErrors).toHaveLength(1);
    expect(missing.compileErrors[0]!.scannerId).toBe('chart_common_gap');
  });
});

describe('NS-04 native run with TypeScript preservation', () => {
  it('uses the TypeScript runner when native is not explicitly requested', async () => {
    const runTypeScript = vi.fn(async () => tsOutput({ results: [] }));
    const start = vi.fn();
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({ scannerIds: ['core_volume_spike'] }),
      { runTypeScript, start },
    );
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('TypeScript-only');
    expect(runTypeScript).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it('falls back for mixed selections before invoking the native backend', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const start = vi.fn();
    await runNativeOrTypeScriptScannerBatch(
      baseOptions({ scannerIds: ['chart_breakaway_gap', 'core_volume_spike'] }),
      { runTypeScript, start },
    );
    expect(start).not.toHaveBeenCalled();
    expect(runTypeScript).toHaveBeenCalledTimes(1);
  });

  it('falls back when alert rules are configured so alerts are never double-counted', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const start = vi.fn();
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({
        alertRules: [
          {
            id: 'alert-1',
            name: 'price',
            enabled: true,
            kind: 'price',
            condition: 'above',
            value: 100,
          } as never,
        ],
      }),
      { runTypeScript, start },
    );
    expect(start).not.toHaveBeenCalled();
    expect(outcome.fallbackReason).toContain('Alert rules');
  });

  it('falls back entirely when the native start command rejects', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const unsubscribe = vi.fn();
    const outcome = await runNativeOrTypeScriptScannerBatch(baseOptions(), {
      runTypeScript,
      subscribe: async () => unsubscribe,
      cancel: async () => ({ runId: 'x', cancelRequested: true, alreadyFinished: false }),
      start: async () => {
        throw { code: 'native-scan-database-unavailable', message: 'No active database.' };
      },
    });
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('No active database');
    expect(unsubscribe).toHaveBeenCalled();
    expect(runTypeScript).toHaveBeenCalled();
  });

  it('publishes native matches once, sorted, and never emits alert triggers', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const chunked: ScannerResult[][] = [];
    let complete: ((event: unknown) => void) | null = null;

    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({
        onResultChunk: (chunk: ScannerResult[]) => chunked.push(chunk),
      }),
      {
        runTypeScript,
        subscribe: async (runId, handlers) => {
          complete = handlers.onComplete as (event: unknown) => void;
          // Emit a batch for a different run first: it must be ignored by the bridge,
          // and this adapter only ever receives already-filtered events.
          handlers.onProgress?.({
            eventVersion: 1,
            runId,
            sequence: 1,
            databaseIdentity: 'db#1',
            completed: 1,
            total: 2,
            counts: { targets: 2, matched: 1, noMatch: 1, skipped: 0, failed: 0 },
          } satisfies NativeScanProgressEventV1);
          handlers.onMatches?.({
            eventVersion: 1,
            runId,
            sequence: 2,
            databaseIdentity: 'db#1',
            matches: [
              { exchange: 'NSE', symbol: 'TCS', ruleId: 'chart_breakaway_gap', date: '2026-01-02' },
              { exchange: 'NSE', symbol: 'INFY', ruleId: 'chart_breakaway_gap', date: '2026-01-03' },
              // Duplicate row: must be collapsed once.
              { exchange: 'NSE', symbol: 'INFY', ruleId: 'chart_breakaway_gap', date: '2026-01-03' },
            ],
          });
          return (() => undefined) satisfies () => void;
        },
        cancel: async () => ({ runId: 'x', cancelRequested: false, alreadyFinished: true }),
        start: async () => {
          // Terminal event arrives shortly after the start ack, like the real backend.
          setTimeout(() => {
            complete?.({
              eventVersion: 1,
              runId: 'native-run',
              sequence: 3,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 12,
              counts: { targets: 2, matched: 2, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return {
            accepted: true,
            runId: 'native-run',
            schemaVersion: 1,
            databaseIdentity: 'db#1',
            workerCount: 2,
            totalTargets: 2,
          };
        },
        newRunId: () => 'native-run',
      },
    );

    expect(outcome.backend).toBe('native');
    expect(runTypeScript).not.toHaveBeenCalled();
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results.map((result) => result.symbol)).toEqual(['INFY', 'TCS']);
    expect(outcome.alertTriggers).toEqual([]);
    expect(outcome.cancelled).toBe(false);
    // P1-09: matches are buffered until completion, then published exactly once with the
    // de-duplicated accepted set - never as provisional pre-terminal chunks.
    expect(chunked).toHaveLength(1);
    expect(chunked.flat()).toHaveLength(2);
    // P1-05: counts come from the backend terminal event, not zero-filled placeholders.
    expect(outcome.nativeCounts).toEqual({
      targets: 2,
      matched: 2,
      noMatch: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('P1-09 publishes nothing when native fails after several match batches arrived', async () => {
    const runTypeScript = vi.fn(async () => tsOutput({ results: [] }));
    const chunked: ScannerResult[][] = [];

    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({ onResultChunk: (chunk: ScannerResult[]) => chunked.push(chunk) }),
      {
        runTypeScript,
        newRunId: () => 'native-run',
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            // Two full match batches arrive first...
            for (const sequence of [1, 2]) {
              handlers.onMatches?.({
                eventVersion: 1,
                runId,
                sequence,
                databaseIdentity: 'db#1',
                matches: [
                  {
                    exchange: 'NSE',
                    symbol: `PRE${sequence}`,
                    ruleId: 'chart_breakaway_gap',
                    date: '2026-01-02',
                  },
                ],
              } satisfies NativeScanMatchBatchEventV1);
            }
            // ...and only then does the run fail.
            handlers.onError?.({
              eventVersion: 1,
              runId,
              sequence: 3,
              databaseIdentity: 'db#1',
              code: 'native-scan-failed',
              message: 'worker died',
              counts: { targets: 2, matched: 2, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return (() => undefined) satisfies () => void;
        },
        cancel: async () => ({ runId: 'x', cancelRequested: false, alreadyFinished: true }),
        start: async () => ({
          accepted: true,
          runId: 'native-run',
          schemaVersion: 1 as const,
          databaseIdentity: 'db#1',
          workerCount: 2,
          totalTargets: 2,
        }),
      },
    );

    // Whole run falls back; the provisional native rows must never reach the UI.
    expect(outcome.backend).toBe('typescript-fallback');
    expect(runTypeScript).toHaveBeenCalledTimes(1);
    expect(chunked).toEqual([]);
    expect(outcome.fallbackReason).toContain('worker died');
  });

  it('P1-05 reports skipped and failed targets instead of a clean success', async () => {
    const outcome = await runNativeOrTypeScriptScannerBatch(baseOptions(), {
      runTypeScript: vi.fn(async () => tsOutput()),
      newRunId: () => 'native-run',
      subscribe: async (runId, handlers) => {
        setTimeout(() => {
          handlers.onComplete?.({
            eventVersion: 1,
            runId,
            sequence: 2,
            databaseIdentity: 'db#1',
            cancelled: false,
            durationMs: 5,
            counts: { targets: 3, matched: 0, noMatch: 1, skipped: 1, failed: 1 },
            diagnostics: [
              {
                code: 'target-skipped',
                message: 'NSE:EMPTY has no completed bars.',
                target: { exchange: 'NSE', symbol: 'EMPTY' },
              },
              {
                code: 'target-error',
                message: 'NSE:BROKEN could not be read.',
                target: { exchange: 'NSE', symbol: 'BROKEN' },
              },
            ],
          });
        }, 0);
        return (() => undefined) satisfies () => void;
      },
      cancel: async () => ({ runId: 'x', cancelRequested: false, alreadyFinished: true }),
      start: async () => ({
        accepted: true,
        runId: 'native-run',
        schemaVersion: 1 as const,
        databaseIdentity: 'db#1',
        workerCount: 2,
        totalTargets: 3,
      }),
    });

    expect(outcome.nativeCounts).toEqual({
      targets: 3,
      matched: 0,
      noMatch: 1,
      skipped: 1,
      failed: 1,
    });
    expect(outcome.errors).toEqual([
      'NSE:EMPTY has no completed bars.',
      'NSE:BROKEN could not be read.',
    ]);
    const status = formatNativeScannerStatus(outcome, 3);
    expect(status).toContain('incomplete');
    expect(status).toContain('1 skipped');
    expect(status).toContain('1 failed');
  });

  it('P0-02 preserves accepted chart-pattern metadata end to end', async () => {
    const geometry = {
      family: 'gap-zone',
      zones: [
        { id: 'gap', role: 'gap', startDate: '2026-01-02', endDate: '2026-01-03', low: 100, high: 110 },
      ],
    };
    const outcome = await runNativeOrTypeScriptScannerBatch(baseOptions(), {
      runTypeScript: vi.fn(async () => tsOutput()),
      newRunId: () => 'native-run',
      subscribe: async (runId, handlers) => {
        setTimeout(() => {
          handlers.onMatches?.({
            eventVersion: 1,
            runId,
            sequence: 1,
            databaseIdentity: 'db#1',
            matches: [
              {
                exchange: 'NSE',
                symbol: 'GAP',
                ruleId: 'chart_breakaway_gap',
                date: '2026-01-03',
                value: 88,
                scannerName: 'Breakaway Gap',
                categoryId: 'chart_patterns_gap',
                categoryName: 'Chart Patterns - Gaps',
                direction: 'bullish',
                score: 88,
                reasons: ['Gap of 8.9% above resistance'],
                values: { gap_pct: 8.9, resistance: 101 },
                source: 'EODChartPatternScanner_v1',
                history: {
                  firstMatchedDate: '2026-01-02',
                  lastMatchedDate: '2026-01-03',
                  matchCount: 4,
                },
                pattern: {
                  family: 'gap',
                  confidence: 88,
                  patternStartDate: '2026-01-02',
                  patternEndDate: '2026-01-03',
                  breakoutLevel: 101,
                  supportLevel: 99,
                  resistanceLevel: 104,
                  targetPrice: 118,
                  stopLossPrice: 98,
                  potentialGainPct: 6.4,
                  riskRewardRatio: 2.1,
                  pivots: [{ index: 3, date: '2026-01-02', price: 101, kind: 'high' }],
                  geometry,
                },
              },
            ],
          });
          handlers.onComplete?.({
            eventVersion: 1,
            runId,
            sequence: 2,
            databaseIdentity: 'db#1',
            cancelled: false,
            durationMs: 3,
            counts: { targets: 1, matched: 1, noMatch: 0, skipped: 0, failed: 0 },
            workersUsed: 1,
            diagnostics: [],
          });
        }, 0);
        return (() => undefined) satisfies () => void;
      },
      cancel: async () => ({ runId: 'x', cancelRequested: false, alreadyFinished: true }),
      start: async () => ({
        accepted: true,
        runId: 'native-run',
        schemaVersion: 1 as const,
        databaseIdentity: 'db#1',
        workerCount: 1,
        totalTargets: 1,
      }),
    });

    const [result] = outcome.results;
    expect(result.scannerName).toBe('Breakaway Gap');
    expect(result.categoryId).toBe('chart_patterns_gap');
    expect(result.direction).toBe('bullish');
    expect(result.score).toBe(88);
    expect(result.reasons).toEqual(['Gap of 8.9% above resistance']);
    expect(result.values).toEqual({ gap_pct: 8.9, resistance: 101 });
    expect(result.source).toBe('EODChartPatternScanner_v1');
    expect(result.warnings).toEqual([]);
    const details = result.chartPattern;
    expect(details).toBeDefined();
    expect(details?.family).toBe('gap');
    expect(details?.confidence).toBe(88);
    expect(details?.patternStartDate).toBe('2026-01-02');
    expect(details?.breakoutLevel).toBe(101);
    expect(details?.resistanceLevel).toBe(104);
    expect(details?.targetPrice).toBe(118);
    expect(details?.riskRewardRatio).toBe(2.1);
    expect(details?.pivots).toEqual([{ index: 3, date: '2026-01-02', price: 101, kind: 'high' }]);
    // Overlay geometry must survive untouched so Show on Chart can render it.
    expect(details?.geometry).toEqual(geometry);
    // Grouped historical summary is transported, so ScannerWindow history annotations are
    // identical on the native and TypeScript backends.
    expect(result.history).toEqual({
      firstMatchedDate: '2026-01-02',
      lastMatchedDate: '2026-01-03',
      matchCount: 4,
    });
  });

  it('cancels and falls back when the native scanner reports an error', async () => {
    const runTypeScript = vi.fn(async () => tsOutput({ results: [] }));
    const cancel = vi.fn(async () => ({ runId: 'native-run', cancelRequested: true, alreadyFinished: false }));
    const outcome = await runNativeOrTypeScriptScannerBatch(baseOptions(), {
      runTypeScript,
      newRunId: () => 'native-run',
      subscribe: async (runId, handlers) => {
        setTimeout(() => {
          handlers.onError?.({
            eventVersion: 1,
            runId,
            sequence: 7,
            databaseIdentity: 'db#1',
            code: 'native-scan-failed',
            message: 'Native scan failed while reading a corrupt .eod file.',
            counts: { targets: 2, matched: 0, noMatch: 0, skipped: 0, failed: 2 },
            diagnostics: [],
          });
        }, 0);
        return (() => undefined) satisfies () => void;
      },
      cancel,
      start: async () => ({
        accepted: true,
        runId: 'native-run',
        schemaVersion: 1,
        databaseIdentity: 'db#1',
        workerCount: 2,
        totalTargets: 2,
      }),
    });
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('corrupt .eod');
    expect(runTypeScript).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalledWith(expect.stringContaining('nothing'));
  });


  it('does not run TypeScript fallback after the backend detects an A-B-A selection change', async () => {
    const runTypeScript = vi.fn(async () => tsOutput({ results: [] }));
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({
        expectedDatabasePath: 'E:\\Data\\Active',
        getActiveDatabasePath: () => 'E:\\Data\\Active',
      }),
      {
        runTypeScript,
        newRunId: () => 'native-run',
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onError?.({
              eventVersion: 1, runId, sequence: 2,
              databaseIdentity: 'E:\\Data\\Active#7',
              code: 'native-scan-database-changed',
              message: 'Native scanner detected an obsolete database revision.',
              counts: { targets: 2, matched: 0, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
        start: async () => ({
          accepted: true, runId: 'native-run', schemaVersion: 1,
          databaseIdentity: 'E:\\Data\\Active#7', workerCount: 2, totalTargets: 2,
        }),
      },
    );
    expect(outcome.backend).toBe('native');
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(runTypeScript).not.toHaveBeenCalled();
  });

  it('falls back when no targets were resolved instead of scanning an empty universe', async () => {
    const runTypeScript = vi.fn(async () => tsOutput({ scannedSymbols: 0 }));
    const start = vi.fn();
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({ targets: [] }),
      { runTypeScript, start },
    );
    expect(start).not.toHaveBeenCalled();
    expect(outcome.fallbackReason).toContain('No targets');
  });

  it('blocks a native acknowledgement for a different registered database', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const cancel = vi.fn(async () => ({ runId: 'native-run', cancelRequested: true, alreadyFinished: false }));
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({
        expectedDatabasePath: 'E:\\Data\\Active',
        getActiveDatabasePath: () => 'E:\\Data\\Active',
      }),
      {
        runTypeScript, newRunId: () => 'native-run',
        subscribe: async () => () => undefined, cancel,
        start: async () => ({
          accepted: true, runId: 'native-run', schemaVersion: 1,
          databaseIdentity: 'E:\\Data\\Other#123', workerCount: 1, totalTargets: 2,
        }),
      },
    );
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(outcome.errors.join(' ')).toContain('mismatched');
    expect(cancel).toHaveBeenCalledWith('native-run');
    expect(runTypeScript).not.toHaveBeenCalled();
  });

  it('never publishes native results or falls back after a midrun database switch', async () => {
    let activeDatabase = 'E:\\Data\\Active';
    const runTypeScript = vi.fn(async () => tsOutput());
    const published: ScannerResult[][] = [];
    const cancel = vi.fn(async () => ({ runId: 'native-run', cancelRequested: true, alreadyFinished: false }));
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({
        expectedDatabasePath: activeDatabase,
        getActiveDatabasePath: () => activeDatabase,
        onResultChunk: (chunk: ScannerResult[]) => published.push(chunk),
      }),
      {
        runTypeScript, newRunId: () => 'native-run',
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onMatches?.({
              eventVersion: 1, runId, sequence: 1,
              databaseIdentity: 'E:\\Data\\Active#123',
              matches: [
                { exchange: 'NSE', symbol: 'INFY', ruleId: 'chart_breakaway_gap', date: '2026-01-02' },
              ],
            });
            activeDatabase = 'E:\\Data\\Other';
            handlers.onComplete?.({
              eventVersion: 1, runId, sequence: 2,
              databaseIdentity: 'E:\\Data\\Active#123', cancelled: false, durationMs: 5,
              counts: { targets: 2, matched: 1, noMatch: 1, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
        cancel,
        start: async () => ({
          accepted: true, runId: 'native-run', schemaVersion: 1,
          databaseIdentity: 'E:\\Data\\Active#123', workerCount: 2, totalTargets: 2,
        }),
      },
    );
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(published).toEqual([]);
    expect(runTypeScript).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith('native-run');
  });

  it('rejects an early event with a different identity from the start acknowledgement', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const outcome = await runNativeOrTypeScriptScannerBatch(baseOptions(), {
      runTypeScript, newRunId: () => 'native-run',
      subscribe: async (runId, handlers) => {
        handlers.onMatches?.({
          eventVersion: 1, runId, sequence: 1,
          databaseIdentity: 'other-database#123',
          matches: [
            { exchange: 'NSE', symbol: 'INFY', ruleId: 'chart_breakaway_gap', date: '2026-01-02' },
          ],
        });
        return () => undefined;
      },
      cancel: async () => ({ runId: 'native-run', cancelRequested: true, alreadyFinished: false }),
      start: async () => ({
        accepted: true, runId: 'native-run', schemaVersion: 1,
        databaseIdentity: 'expected-database#123', workerCount: 1, totalTargets: 2,
      }),
    });
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toEqual([]);
    expect(runTypeScript).not.toHaveBeenCalled();
  });

  it('reports numeric history coverage independently of match rows', () => {
    const coverage = [
      {
        exchange: 'NSE',
        symbol: 'AAA',
        inputFirstDate: '2010-01-01',
        inputLastDate: '2024-05-17',
        inputBarCount: 5000,
        olderInputUnknown: true,
        rules: [{
          ruleId: 'numeric-a',
          firstEvaluatedDate: '2020-05-18',
          lastEvaluatedDate: '2024-05-17',
          evaluatedEndpointCount: 1000,
          omittedEligibleEndpointCount: 3900,
        }],
      },
      {
        exchange: 'BSE',
        symbol: 'BBB',
        inputFirstDate: '2021-01-01',
        inputLastDate: '2024-05-16',
        inputBarCount: 900,
        olderInputUnknown: false,
        rules: [{
          ruleId: 'numeric-b',
          firstEvaluatedDate: '2021-01-01',
          lastEvaluatedDate: '2024-05-16',
          evaluatedEndpointCount: 900,
          omittedEligibleEndpointCount: 0,
        }],
      },
    ];
    const outcome = {
      ...tsOutput({ results: [] }),
      backend: 'native' as const,
      nativeCounts: { targets: 3, matched: 0, noMatch: 2, skipped: 1, failed: 0 },
      numericHistoryCoverage: coverage,
    };

    const status = formatScannerCompletionStatus(outcome, 3);
    expect(status).toContain('1900 rule endpoints across 2 target symbols from 2020-05-18 through 2024-05-17');
    expect(status).toContain('3900 eligible rule endpoints were omitted within the loaded data');
    expect(status).toContain('Older bars may exist for 1 of these target symbols');
    expect(formatScannerCompletionStatus({ ...outcome, cancelled: true }, 3)).not.toContain('Numeric history');
    expect(formatScannerCompletionStatus({ ...outcome, backend: 'typescript-fallback' }, 3)).not.toContain('Numeric history');
  });

  it('formats honest status text for both backends', () => {
    const native = formatNativeScannerStatus(
      {
        ...tsOutput({ results: [] }),
        backend: 'native',
        nativeCounts: { targets: 5, matched: 1, noMatch: 3, skipped: 1, failed: 0 },
      },
      5,
    );
    expect(native).toContain('Native scan');
    expect(native).toContain('1 skipped');
    const fallback = formatNativeScannerStatus(
      { ...tsOutput(), backend: 'typescript-fallback', fallbackReason: 'reason here' },
      2,
    );
    expect(fallback).toContain('TypeScript scanner backend');
    expect(fallback).toContain('reason here');
  });
});

describe('NS-R1 native result publication safety', () => {
  it('falls back for unrequested rule IDs without exposing any provisional native rows', async () => {
    const runTypeScript = vi.fn(async () => tsOutput());
    const published: ScannerResult[][] = [];
    const outcome = await runNativeOrTypeScriptScannerBatch(
      baseOptions({ onResultChunk: (chunk: ScannerResult[]) => published.push(chunk) }),
      {
        runTypeScript,
        newRunId: () => 'native-run',
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onMatches?.({
              eventVersion: 1,
              runId,
              sequence: 1,
              databaseIdentity: 'db#1',
              matches: [
                {
                  exchange: 'NSE',
                  symbol: 'TCS',
                  ruleId: 'chart_breakaway_gap',
                  date: '2026-01-20',
                },
                {
                  exchange: 'NSE',
                  symbol: 'INFY',
                  ruleId: 'prev_day_high_break',
                  date: '2026-01-20',
                },
              ],
            } satisfies NativeScanMatchBatchEventV1);
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 2,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 1,
              counts: { targets: 2, matched: 2, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
        cancel: async () => ({ runId: 'native-run', cancelRequested: false, alreadyFinished: true }),
        start: async () => ({
          accepted: true,
          runId: 'native-run',
          schemaVersion: 1 as const,
          databaseIdentity: 'db#1',
          workerCount: 1,
          totalTargets: 2,
        }),
      },
    );
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('Unrequested rule ID');
    expect(runTypeScript).toHaveBeenCalledTimes(1);
    expect(published).toEqual([]);
    expect(outcome.results).toEqual([]);
    expect(outcome.alertTriggers).toEqual([]);
  });
});

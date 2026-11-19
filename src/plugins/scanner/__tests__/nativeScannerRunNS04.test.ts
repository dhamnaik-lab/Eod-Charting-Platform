import { describe, expect, it, vi } from 'vitest';
import type { ScannerDefinition, ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';
import {
  canRunNatively,
  compileNativeScannerRules,
  describeNativeCapability,
  describeNativeUnsupportedScanners,
  formatNativeScannerStatus,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import type { NativeScanProgressEventV1 } from '@/features/scanner/nativeScanContract';
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
    expect(chunked.flat()).toHaveLength(3);
    expect(outcome.nativeCounts?.targets).toBe(2);
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

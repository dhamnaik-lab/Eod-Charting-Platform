import { describe, expect, it, vi } from 'vitest';
import { coreOhlcvScannerDefinitions, runCoreScanner } from '@/plugins/scanner/coreOhlcvScanners';
import type { EodBar, ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';
import type { NativeScanMatchV1, NativeScanRequestV1 } from '@/features/scanner/nativeScanContract';
import { compileNativeCoreCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import {
  canRunNatively,
  compileNativeScannerRules,
  formatScannerCompletionStatus,
  describeNativeUnsupportedScanners,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';

function barsFor(id: string): EodBar[] {
  const bars = Array.from({ length: 20 }, (_, index): EodBar => ({
    symbol: 'TEST',
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    open: 100, high: 110, low: 90, close: 100, volume: 1000,
  }));
  const today = bars[bars.length - 1]!;
  const overrides: Record<string, Partial<EodBar>> = {
    prev_day_high_break: { open: 108, high: 115, low: 105, close: 112 },
    prev_day_low_break: { open: 92, high: 95, low: 85, close: 89 },
    inside_bar: { open: 100, high: 109, low: 91, close: 100 },
    outside_bar: { open: 100, high: 111, low: 89, close: 100 },
    close_near_high: { open: 100, high: 110, low: 90, close: 109 },
    close_near_low: { open: 100, high: 110, low: 90, close: 91 },
    gap_up: { open: 115, high: 120, low: 111, close: 118 },
    gap_down: { open: 85, high: 89, low: 80, close: 83 },
    nr7: { open: 100, high: 105, low: 95, close: 100 },
    wide_range_candle: { open: 100, high: 130, low: 70, close: 100 },
  };
  Object.assign(today, overrides[id]);
  return bars;
}

function asNativeMatch(result: ScannerResult): NativeScanMatchV1 {
  return {
    exchange: result.exchange,
    symbol: result.symbol,
    ruleId: result.scannerId,
    date: result.date,
    scannerName: result.scannerName,
    categoryId: result.categoryId,
    categoryName: result.categoryName,
    direction: result.direction,
    reasons: result.reasons,
    values: result.values,
    source: result.source,
  };
}

function emptyTypeScriptOutput(): ScannerRunOutput {
  return { results: [], alertTriggers: [], errors: [], scannedSymbols: 1, cancelled: false };
}

describe('NS-R2 opt-in core OHLCV native latest-only routing', () => {
  it('compiles all ten accepted core ASTs, optionally alongside the four gap patterns', () => {
    const ids = coreOhlcvScannerDefinitions.map((definition) => definition.id);
    expect(ids).toHaveLength(10);
    const compiled = compileNativeScannerRules([...ids, 'chart_breakaway_gap']);
    expect(compiled.unsupportedScannerIds).toEqual([]);
    expect(compiled.compileErrors).toEqual([]);
    expect(compiled.rules).toHaveLength(11);
    for (const id of ids) {
      expect(compiled.rules.find((rule) => rule.id === id)?.expression)
        .toEqual(compileNativeCoreCandidate(id));
      expect(canRunNatively([id])).toBe(true);
      expect(canRunNatively([id], undefined, true)).toBe(false);
    }
    expect(compiled.rules[10]?.expression).toEqual({ kind: 'pattern', id: 'chart_breakaway_gap' });
    expect(canRunNatively(['chart_breakaway_gap'], undefined, true)).toBe(true);
    expect(canRunNatively(['chart_breakaway_gap', ids[0]!], undefined, true)).toBe(false);
    expect(canRunNatively(['chart_breakaway_gap', 'plugin_unknown'])).toBe(false);
    expect(describeNativeUnsupportedScanners([ids[0]!], true)).toContain('Full-history');
  });

  it('falls back before native start for full-history core runs, even with other supported rules', async () => {
    const start = vi.fn();
    const runTypeScript = vi.fn(async () => emptyTypeScriptOutput());
    const outcome = await runNativeOrTypeScriptScannerBatch({
      targets: [{ exchange: 'NSE', symbol: 'TEST' }],
      scannerIds: ['prev_day_high_break', 'chart_common_gap'],
      lookbackBars: null,
      evaluateHistory: true,
      alertRules: [],
    }, { start, runTypeScript });
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('Full-history');
    expect(start).not.toHaveBeenCalled();
    expect(runTypeScript).toHaveBeenCalledTimes(1);
  });

  it('preserves all ten complete legacy metadata records in one accepted native run', async () => {
    const expected = coreOhlcvScannerDefinitions.map((definition) => {
      const result = runCoreScanner(
        { symbol: 'TEST', exchange: 'NSE', bars: barsFor(definition.id) },
        definition,
      );
      expect(result, definition.id).not.toBeNull();
      return result!;
    });
    const nativeMatches = expected.map(asNativeMatch);
    const published: ScannerResult[][] = [];
    const fallback = vi.fn(async () => emptyTypeScriptOutput());
    const sentRequests: NativeScanRequestV1[] = [];
    const outcome = await runNativeOrTypeScriptScannerBatch({
      targets: [{ exchange: 'NSE', symbol: 'TEST' }],
      scannerIds: expected.map((result) => result.scannerId),
      lookbackBars: 250,
      evaluateHistory: false,
      alertRules: [],
      onResultChunk: (chunk) => published.push(chunk),
    }, {
      runTypeScript: fallback,
      newRunId: () => 'nsr2-run',
      start: async (request) => {
        sentRequests.push(request);
        return {
          accepted: true, runId: request.requestedRunId,
          schemaVersion: 1, databaseIdentity: 'db#1', workerCount: 1, totalTargets: 1,
        };
      },
      cancel: async () => ({ runId: 'nsr2-run', cancelRequested: false, alreadyFinished: true }),
      subscribe: async (runId, handlers) => {
        setTimeout(() => {
          handlers.onMatches?.({
            eventVersion: 1, runId, sequence: 1, databaseIdentity: 'db#1',
            matches: nativeMatches,
          });
          handlers.onComplete?.({
            eventVersion: 1, runId, sequence: 2, databaseIdentity: 'db#1',
            cancelled: false, durationMs: 1,
            counts: { targets: 1, matched: 1, noMatch: 0, skipped: 0, failed: 0 },
            diagnostics: [],
          });
        }, 0);
        return () => undefined;
      },
    });
    expect(outcome.backend).toBe('native');
    expect(fallback).not.toHaveBeenCalled();
    expect(sentRequests[0]?.evaluation.evaluateHistory).toBe(false);
    expect(sentRequests[0]?.rules).toHaveLength(10);
    expect(outcome.results).toHaveLength(10);
    expect(outcome.alertTriggers).toEqual([]);
    expect(published).toHaveLength(1);
    for (const result of outcome.results) {
      const original = expected.find((item) => item.scannerId === result.scannerId)!;
      expect(result).toMatchObject({
        symbol: original.symbol, exchange: original.exchange,
        scannerId: original.scannerId, scannerName: original.scannerName,
        categoryId: original.categoryId, categoryName: original.categoryName,
        date: original.date, matched: true, direction: original.direction,
        source: original.source, reasons: original.reasons,
        values: original.values, warnings: [],
      });
      expect(result.score).toBeUndefined();
      expect(result.history).toBeUndefined();
    }
  });

  it.each([0, 1, 2])(
    'surfaces native core short-history diagnostics while preserving match counts (%i bars)',
    async (barCount) => {
      const fallback = vi.fn(async () => emptyTypeScriptOutput());
      const published: ScannerResult[][] = [];
      const reason = barCount === 0
        ? 'NSE:TEST has no completed bars at or before the requested window start.'
        : 'NSE:TEST has 1 completed bar(s); no selected rule can be evaluated yet (shortest needs 2).';
      const definition = coreOhlcvScannerDefinitions.find((item) => item.id === 'close_near_high')!;
      const completeResult = runCoreScanner(
        { symbol: 'TEST', exchange: 'NSE', bars: barsFor('close_near_high').slice(-2) },
        definition,
      );
      expect(completeResult).not.toBeNull();

      const outcome = await runNativeOrTypeScriptScannerBatch({
        targets: [{ exchange: 'NSE', symbol: 'TEST' }],
        scannerIds: ['close_near_high'],
        lookbackBars: 20,
        evaluateHistory: false,
        alertRules: [],
        onResultChunk: (chunk) => published.push(chunk),
      }, {
        runTypeScript: fallback,
        newRunId: () => 'nsr5-short-history',
        start: async (request) => ({
          accepted: true,
          runId: request.requestedRunId,
          schemaVersion: 1,
          databaseIdentity: 'db#1',
          workerCount: 1,
          totalTargets: 1,
        }),
        cancel: async () => ({
          runId: 'nsr5-short-history', cancelRequested: false, alreadyFinished: true,
        }),
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            if (barCount === 2) {
              handlers.onMatches?.({
                eventVersion: 1,
                runId,
                sequence: 1,
                databaseIdentity: 'db#1',
                matches: [asNativeMatch(completeResult!)],
              });
            }
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 2,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 1,
              counts: {
                targets: 1,
                matched: barCount === 2 ? 1 : 0,
                noMatch: 0,
                skipped: barCount < 2 ? 1 : 0,
                failed: 0,
              },
              diagnostics: barCount < 2
                ? [{
                    code: 'target-skipped',
                    message: reason,
                    target: { exchange: 'NSE', symbol: 'TEST' },
                  }]
                : [],
            });
          }, 0);
          return () => undefined;
        },
      });

      expect(outcome.backend).toBe('native');
      expect(outcome.cancelled).toBe(false);
      expect(outcome.nativeCounts).toEqual({
        targets: 1,
        matched: barCount === 2 ? 1 : 0,
        noMatch: 0,
        skipped: barCount < 2 ? 1 : 0,
        failed: 0,
      });
      expect(outcome.results).toHaveLength(barCount === 2 ? 1 : 0);
      expect(outcome.errors).toEqual(barCount < 2 ? [reason] : []);
      expect(published).toHaveLength(barCount === 2 ? 1 : 0);
      expect(fallback).not.toHaveBeenCalled();

      const status = formatScannerCompletionStatus(outcome, 1);
      if (barCount < 2) {
        expect(status).toContain('Native scan (incomplete)');
        expect(status).toContain('1 skipped');
        expect(status).toContain('1 diagnostic');
        expect(status).not.toContain('1 failed');
      } else {
        expect(status).toBe('Native scan: 1 symbol; 1 match.');
      }
    },
  );

  it('retains TypeScript, fallback, and cancellation completion wording', () => {
    const output = emptyTypeScriptOutput();
    expect(formatScannerCompletionStatus(output, 1))
      .toBe('Scanned 1 symbol; 0 matches; 0 alerts.');

    const fallback = {
      ...output, backend: 'typescript-fallback' as const, fallbackReason: 'unsupported native rule',
    };
    expect(formatScannerCompletionStatus(fallback, 1))
      .toBe('Used the TypeScript scanner backend. unsupported native rule Scanned 1 symbol; 0 matches; 0 alerts.');

    expect(formatScannerCompletionStatus({ ...fallback, cancelled: true }, 1))
      .toBe('Used the TypeScript scanner backend. unsupported native rule Scan cancelled after 1 symbol.');

    const cancelledNative = {
      ...output,
      backend: 'native' as const,
      cancelled: true,
      nativeCounts: { targets: 1, matched: 0, noMatch: 0, skipped: 1, failed: 0 },
      errors: ['NSE:TEST: run cancelled before this target was scanned.'],
    };
    expect(formatScannerCompletionStatus(cancelledNative, 1))
      .toBe('Scan cancelled after 1 symbol; 0 matches recorded.');
  });

  it('falls back without publishing partial matches when core metadata is incomplete', async () => {
    const fallback = vi.fn(async () => emptyTypeScriptOutput());
    const published: ScannerResult[][] = [];
    const outcome = await runNativeOrTypeScriptScannerBatch({
      targets: [{ exchange: 'NSE', symbol: 'TEST' }],
      scannerIds: ['prev_day_high_break'],
      lookbackBars: 20,
      evaluateHistory: false,
      alertRules: [],
      onResultChunk: (chunk) => published.push(chunk),
    }, {
      runTypeScript: fallback,
      newRunId: () => 'nsr2-run',
      start: async (request) => ({
        accepted: true, runId: request.requestedRunId,
        schemaVersion: 1, databaseIdentity: 'db#1', workerCount: 1, totalTargets: 1,
      }),
      cancel: async () => ({ runId: 'nsr2-run', cancelRequested: false, alreadyFinished: true }),
      subscribe: async (runId, handlers) => {
        setTimeout(() => {
          handlers.onMatches?.({
            eventVersion: 1, runId, sequence: 1, databaseIdentity: 'db#1',
            matches: [{
              exchange: 'NSE', symbol: 'TEST', ruleId: 'prev_day_high_break',
              date: '2026-01-20', values: { close: 112 },
            }],
          });
          handlers.onComplete?.({
            eventVersion: 1, runId, sequence: 2, databaseIdentity: 'db#1',
            cancelled: false, durationMs: 1,
            counts: { targets: 1, matched: 1, noMatch: 0, skipped: 0, failed: 0 },
            diagnostics: [],
          });
        }, 0);
        return () => undefined;
      },
    });
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('Native result rejected');
    expect(published).toEqual([]);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});

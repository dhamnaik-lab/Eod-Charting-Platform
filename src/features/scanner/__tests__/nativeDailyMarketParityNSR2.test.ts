import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  dailyMarketScannerDefinitions,
  runDailyMarketScanner,
} from '@/plugins/scanner/dailyMarketScanners';
import {
  isNativeBuiltInResultId,
  isNativeCoreResultId,
  isNativeDailyMarketResultId,
  nativeCoreResultMetadataIssue,
} from '@/features/scanner/nativeCoreResultMetadataGate';
import {
  compileNativeBuiltInCandidate,
  compileNativeCoreCandidate,
  compileNativeDailyMarketCandidate,
  NATIVE_DAILY_MARKET_CANDIDATE_IDS,
} from '@/features/scanner/nativeCoreRuleExpressions';
import {
  validateNativeScanRequestV1,
  type NativeScanMatchV1,
  type NativeScanRequestV1,
} from '@/features/scanner/nativeScanContract';
import {
  canRunNatively,
  compileNativeScannerRules,
  describeNativeCapability,
  describeNativeUnsupportedScanners,
  formatScannerCompletionStatus,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import type { EodBar, ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';
import {
  generateDailyMarketParityFixtures,
  normalizeNegativeZeroValues,
  type DailyMarketParityFixtureBundle,
} from './nativeDailyMarketFixtureGenerator';

const FIXTURE_PATH = resolve(
  __dirname,
  '../fixtures/nativeDailyMarketParityFixtures.v1.json',
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(FIXTURE_PATH) as DailyMarketParityFixtureBundle;

const definitionsById = new Map(
  dailyMarketScannerDefinitions.map((definition) => [definition.id, definition]),
);

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

describe('NS-R2 Daily Market native parity fixtures', () => {
  it('committed fixture bundle matches generator and covers all five Daily Market rules', () => {
    expect(existsSync(FIXTURE_PATH), `missing fixture bundle at ${FIXTURE_PATH}`).toBe(true);
    const regenerated = generateDailyMarketParityFixtures();
    expect(fixture).toEqual(regenerated);
    expect(fixture.version).toBe(1);

    const expectedIds = ['high_52w', 'low_52w', 'top_gainers', 'top_losers', 'volume_surge'];
    expect([...NATIVE_DAILY_MARKET_CANDIDATE_IDS].sort()).toEqual(expectedIds);
    expect(Object.keys(fixture.rules).sort()).toEqual(expectedIds);

    for (const id of expectedIds) {
      expect(isNativeDailyMarketResultId(id)).toBe(true);
      expect(isNativeBuiltInResultId(id)).toBe(true);
      expect(isNativeCoreResultId(id)).toBe(false);
      expect(compileNativeCoreCandidate(id)).toBeNull();
      const expr = compileNativeDailyMarketCandidate(id);
      expect(expr).not.toBeNull();
      expect(compileNativeBuiltInCandidate(id)).toEqual(expr);
      expect(fixture.rules[id]).toEqual(expr);
    }

    const validation = validateNativeScanRequestV1({
      schemaVersion: 1,
      requestedRunId: 'nsr2-dm-contract',
      universe: { source: 'explicitTargets', targets: [{ exchange: 'NSE', symbol: 'INFY' }] },
      evaluation: { evaluateHistory: false, priceBasis: 'raw' },
      rules: expectedIds.map((id) => ({ id, expression: fixture.rules[id]! })),
    });
    expect(validation.ok, validation.ok ? '' : JSON.stringify(validation.issues)).toBe(true);

    const caseIds = new Set<string>();
    for (const sample of fixture.cases) {
      expect(caseIds.has(sample.caseId), sample.caseId).toBe(false);
      caseIds.add(sample.caseId);
      expect(sample.description.trim(), sample.caseId).not.toBe('');
      expect(
        sample.bars.every((bar, idx) => idx === 0 || sample.bars[idx - 1]!.date < bar.date),
        sample.caseId,
      ).toBe(true);
    }
    expect(fixture.cases.length).toBeGreaterThanOrEqual(35);
  });

  it.each(fixture.cases.map((sample) => [sample.caseId, sample] as const))(
    '%s reproduces complete TypeScript Daily Market metadata from identical bars',
    (_caseId, sample) => {
      const definition = definitionsById.get(sample.ruleId);
      expect(definition, sample.caseId).toBeDefined();
      const bars: EodBar[] = sample.bars.map((bar) => ({ ...bar, symbol: sample.symbol }));
      const result = runDailyMarketScanner(
        {
          symbol: sample.symbol,
          exchange: sample.exchange,
          bars,
        },
        definition!,
      );
      if (result === null) {
        expect(sample.expected, sample.caseId).toBeNull();
        expect(sample.expectedStatus, sample.caseId).not.toBe('match');
        return;
      }
      expect(sample.expectedStatus, sample.caseId).toBe('match');
      const { generatedAt, ...stable } = result;
      expect(typeof generatedAt).toBe('string');
      expect(Number.isNaN(Date.parse(generatedAt))).toBe(false);
      const normalized = {
        ...stable,
        values: normalizeNegativeZeroValues(stable.values),
      };
      expect(normalized, sample.caseId).toEqual(sample.expected);
    },
  );
});

describe('NS-R2 Daily Market native metadata gate and routing', () => {
  it('validates all five Daily Market result shapes and rejects incomplete or wrong metadata', () => {
    const positiveSamples = fixture.cases.filter((sample) => sample.expectedStatus === 'match');
    expect(positiveSamples.length).toBeGreaterThanOrEqual(15);

    for (const sample of positiveSamples) {
      const nativeMatch = asNativeMatch({
        ...(sample.expected as Omit<ScannerResult, 'generatedAt'>),
        generatedAt: '2026-11-22T00:00:00.000Z',
      });
      expect(nativeCoreResultMetadataIssue(nativeMatch), sample.caseId).toBeNull();
      expect(
        nativeCoreResultMetadataIssue({ ...nativeMatch, source: undefined }),
        sample.caseId,
      ).toContain('source');
      expect(
        nativeCoreResultMetadataIssue({ ...nativeMatch, reasons: [] }),
        sample.caseId,
      ).toContain('reason');
      expect(
        nativeCoreResultMetadataIssue({ ...nativeMatch, scannerName: 'Wrong' }),
        sample.caseId,
      ).toContain('scanner and category');
      expect(
        nativeCoreResultMetadataIssue({ ...nativeMatch, score: 80 }),
        sample.caseId,
      ).toContain('score');
      expect(
        nativeCoreResultMetadataIssue({
          ...nativeMatch,
          direction: 'neutral',
        }),
        sample.caseId,
      ).toContain('direction');
      const changePct = nativeMatch.values?.change_pct;
      if (sample.ruleId !== 'volume_surge' || (typeof changePct === 'number' && changePct !== 0)) {
        expect(
          nativeCoreResultMetadataIssue({
            ...nativeMatch,
            direction: nativeMatch.direction === 'bullish' ? 'bearish' : 'bullish',
          }),
          sample.caseId,
        ).toContain('direction');
      }
      expect(
        nativeCoreResultMetadataIssue({
          ...nativeMatch,
          values: { ...nativeMatch.values, extra: 1 },
        }),
        sample.caseId,
      ).toContain('columns');
    }

    const surgeMatch = positiveSamples.find((sample) => sample.ruleId === 'volume_surge')!;
    const neutralSurge = asNativeMatch({
      ...(surgeMatch.expected as Omit<ScannerResult, 'generatedAt'>),
      generatedAt: '2026-11-22T00:00:00.000Z',
    });
    expect(
      nativeCoreResultMetadataIssue({ ...neutralSurge, direction: 'neutral' }),
    ).toContain('direction');
  });

  it('compiles Daily Market rules with Core OHLCV and gap patterns and blocks history/mixed fallback', () => {
    const dmIds = dailyMarketScannerDefinitions.map((definition) => definition.id);
    expect(dmIds).toHaveLength(5);

    const compiled = compileNativeScannerRules([
      ...dmIds,
      'prev_day_high_break',
      'chart_breakaway_gap',
    ]);
    expect(compiled.unsupportedScannerIds).toEqual([]);
    expect(compiled.compileErrors).toEqual([]);
    expect(compiled.rules).toHaveLength(7);

    expect(canRunNatively(dmIds)).toBe(true);
    expect(canRunNatively([...dmIds, 'prev_day_high_break', 'chart_common_gap'])).toBe(true);
    expect(canRunNatively(dmIds, undefined, true)).toBe(false);
    expect(canRunNatively(['top_gainers', 'chart_common_gap'], undefined, true)).toBe(false);
    expect(canRunNatively(['top_gainers', 'plugin_external'])).toBe(false);

    expect(describeNativeUnsupportedScanners(['top_gainers'], true)).toContain('Full-history');
    expect(describeNativeUnsupportedScanners(['top_gainers', 'plugin_external'])).toContain(
      'plugin_external',
    );
    expect(describeNativeCapability()).toContain('daily market scanners');
    expect(describeNativeCapability()).toContain('off by default');
  });

  it('publishes complete sorted Daily Market results in native mode and preserves TS fallback', async () => {
    const matchesByRule = [
      'top_gainers_2_bars_match_zero_volume',
      'top_losers_fractional_bse_match',
      'volume_surge_21_bars_above_1_5_bearish_bse',
      'high_52w_252_bars_exact_close_at_high',
      'low_52w_252_bars_exact_close_at_low',
    ].map((caseId) => {
      const sample = fixture.cases.find((item) => item.caseId === caseId)!;
      return asNativeMatch({
        ...(sample.expected as Omit<ScannerResult, 'generatedAt'>),
        generatedAt: '2026-11-22T00:00:00.000Z',
      });
    });

    const published: ScannerResult[][] = [];
    const fallback = vi.fn(async () => emptyTypeScriptOutput());
    const sentRequests: NativeScanRequestV1[] = [];

    const outcome = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [
          { exchange: 'NSE', symbol: 'RELIANCE' },
          { exchange: 'BSE', symbol: '500209' },
          { exchange: 'BSE', symbol: '500112' },
          { exchange: 'NSE', symbol: 'SBIN' },
          { exchange: 'NSE', symbol: 'LT' },
        ],
        scannerIds: dailyMarketScannerDefinitions.map((definition) => definition.id),
        lookbackBars: 800,
        evaluateHistory: false,
        alertRules: [],
        onResultChunk: (chunk) => published.push(chunk),
      },
      {
        runTypeScript: fallback,
        newRunId: () => 'nsr2-dm-run',
        start: async (request) => {
          sentRequests.push(request);
          return {
            accepted: true,
            runId: request.requestedRunId,
            schemaVersion: 1,
            databaseIdentity: 'db#1',
            workerCount: 2,
            totalTargets: 5,
          };
        },
        cancel: async () => ({
          runId: 'nsr2-dm-run',
          cancelRequested: false,
          alreadyFinished: true,
        }),
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onMatches?.({
              eventVersion: 1,
              runId,
              sequence: 1,
              databaseIdentity: 'db#1',
              matches: matchesByRule,
            });
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 2,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 4,
              counts: { targets: 5, matched: 5, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
      },
    );

    expect(outcome.backend).toBe('native');
    expect(fallback).not.toHaveBeenCalled();
    expect(sentRequests[0]?.evaluation.evaluateHistory).toBe(false);
    expect(sentRequests[0]?.rules).toHaveLength(5);
    expect(published).toHaveLength(1);
    expect(outcome.results).toHaveLength(5);
    expect(outcome.alertTriggers).toEqual([]);
    for (const row of outcome.results) {
      expect(row.warnings).toEqual([]);
      expect(row.source).toBe('EODScannerPlugin_v1');
      expect(row.categoryId).toBe('daily_market');
      expect(row.categoryName).toBe('Daily Market');
    }

    // History mode and alert-bearing runs must retain TypeScript fallback without starting native.
    const startMock = vi.fn();
    const historyFallback = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [{ exchange: 'NSE', symbol: 'RELIANCE' }],
        scannerIds: ['high_52w', 'chart_breakaway_gap'],
        lookbackBars: null,
        evaluateHistory: true,
        alertRules: [],
      },
      { start: startMock, runTypeScript: fallback },
    );
    expect(historyFallback.backend).toBe('typescript-fallback');
    expect(startMock).not.toHaveBeenCalled();

    const alertFallback = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [{ exchange: 'NSE', symbol: 'RELIANCE' }],
        scannerIds: ['top_gainers'],
        lookbackBars: 250,
        evaluateHistory: false,
        alertRules: [{ id: 'a1' } as never],
      },
      { start: startMock, runTypeScript: fallback },
    );
    expect(alertFallback.backend).toBe('typescript-fallback');
    expect(alertFallback.fallbackReason).toContain('Alert rules');
    expect(startMock).not.toHaveBeenCalled();
  });

  it('fails closed on incomplete Daily Market metadata and surfaces short-history skips', async () => {
    const fallback = vi.fn(async () => emptyTypeScriptOutput());
    const published: ScannerResult[][] = [];

    const rejectedOutcome = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [{ exchange: 'NSE', symbol: 'RELIANCE' }],
        scannerIds: ['high_52w'],
        lookbackBars: 250,
        evaluateHistory: false,
        alertRules: [],
        onResultChunk: (chunk) => published.push(chunk),
      },
      {
        runTypeScript: fallback,
        newRunId: () => 'nsr2-dm-bad',
        start: async (request) => ({
          accepted: true,
          runId: request.requestedRunId,
          schemaVersion: 1,
          databaseIdentity: 'db#1',
          workerCount: 1,
          totalTargets: 1,
        }),
        cancel: async () => ({
          runId: 'nsr2-dm-bad',
          cancelRequested: false,
          alreadyFinished: true,
        }),
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
                  symbol: 'RELIANCE',
                  ruleId: 'high_52w',
                  date: '2025-01-20',
                  values: { close: 114.25 },
                },
              ],
            });
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 2,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 1,
              counts: { targets: 1, matched: 1, noMatch: 0, skipped: 0, failed: 0 },
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
      },
    );
    expect(rejectedOutcome.backend).toBe('typescript-fallback');
    expect(rejectedOutcome.fallbackReason).toContain('Native result rejected');
    expect(published).toEqual([]);
    expect(fallback).toHaveBeenCalledTimes(1);

    // Skipped target accounting (e.g. 20 bars for volume_surge which requires 21).
    const skipMessage =
      'NSE:SHORT20 has 20 completed bar(s); no selected rule can be evaluated yet (shortest needs 21).';
    const skippedOutcome = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [{ exchange: 'NSE', symbol: 'SHORT20' }],
        scannerIds: ['volume_surge'],
        lookbackBars: 250,
        evaluateHistory: false,
        alertRules: [],
      },
      {
        runTypeScript: fallback,
        newRunId: () => 'nsr2-dm-skip',
        start: async (request) => ({
          accepted: true,
          runId: request.requestedRunId,
          schemaVersion: 1,
          databaseIdentity: 'db#1',
          workerCount: 1,
          totalTargets: 1,
        }),
        cancel: async () => ({
          runId: 'nsr2-dm-skip',
          cancelRequested: false,
          alreadyFinished: true,
        }),
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 1,
              databaseIdentity: 'db#1',
              cancelled: false,
              durationMs: 1,
              counts: { targets: 1, matched: 0, noMatch: 0, skipped: 1, failed: 0 },
              diagnostics: [
                {
                  code: 'target-skipped',
                  message: skipMessage,
                  target: { exchange: 'NSE', symbol: 'SHORT20' },
                },
              ],
            });
          }, 0);
          return () => undefined;
        },
      },
    );
    expect(skippedOutcome.backend).toBe('native');
    expect(skippedOutcome.nativeCounts?.skipped).toBe(1);
    expect(skippedOutcome.errors).toEqual([skipMessage]);
    expect(formatScannerCompletionStatus(skippedOutcome, 1)).toContain('1 skipped');
  });

  it('pins <100,000 3-digit volume_surge reason parity and documents the >=100,000 toLocaleString() locale merge blocker', () => {
    const surgeDef = definitionsById.get('volume_surge')!;

    // Below 100,000: TypeScript toLocaleString() matches Rust 3-digit grouping across en-IN & en-US.
    const below100kBars: EodBar[] = Array.from({ length: 21 }, (_, idx) => ({
      symbol: 'SURGE99K',
      date: `2025-01-${String(idx + 1).padStart(2, '0')}`,
      open: 100,
      high: 102,
      low: 99,
      close: idx === 20 ? 104 : 100,
      volume: idx === 20 ? 99_999 : 50_000,
    }));
    const below100kResult = runDailyMarketScanner(
      { symbol: 'SURGE99K', exchange: 'NSE', bars: below100kBars },
      surgeDef,
    );
    expect(below100kResult?.reasons).toEqual([
      `Volume surge: 2.00x of 20-day average (${(99_999).toLocaleString()} vs ${(50_000).toLocaleString()})`,
    ]);
    expect((99_999).toLocaleString('en-IN')).toBe('99,999');
    expect((99_999).toLocaleString('en-US')).toBe('99,999');

    // At/above 100,000: numeric values match, but en-IN TS toLocaleString() emits lakh grouping while Rust emits 3-digit grouping.
    const above100kBars: EodBar[] = Array.from({ length: 21 }, (_, idx) => ({
      symbol: 'SURGE150K',
      date: `2025-01-${String(idx + 1).padStart(2, '0')}`,
      open: 100,
      high: 102,
      low: 99,
      close: idx === 20 ? 104 : 100,
      volume: idx === 20 ? 150_000 : 100_000,
    }));
    const above100kResult = runDailyMarketScanner(
      { symbol: 'SURGE150K', exchange: 'NSE', bars: above100kBars },
      surgeDef,
    );
    expect(above100kResult?.values).toEqual({
      volume: 150_000,
      avg_volume_20: 100_000,
      vol_ratio: 1.5,
      change_pct: 4,
    });
    expect(
      nativeCoreResultMetadataIssue(
        asNativeMatch({
          ...above100kResult!,
          reasons: ['Volume surge: 1.50x of 20-day average (150,000 vs 100,000)'],
        }),
      ),
    ).toBeNull();
    // Explicit documentation of the unresolved cross-locale reason mismatch on >= 100,000 volumes:
    expect((150_000).toLocaleString('en-IN')).toBe('1,50,000');
    expect((150_000).toLocaleString('en-US')).toBe('150,000');
  });
});

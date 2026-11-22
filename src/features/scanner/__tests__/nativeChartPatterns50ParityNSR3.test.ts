import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { chartPatternScannerDefinitions } from '@/features/chartPatterns';
import {
  NATIVE_SCAN_LIMITS,
  NATIVE_SUPPORTED_PATTERN_IDS,
  type NativeScanMatchV1,
} from '@/features/scanner/nativeScanContract';
import { compileNativeScannerExpression } from '@/features/scanner/nativeScanAst';
import { evaluateRustScannerContractRequestV1 } from '@/features/scanner/rustScannerContract';
import {
  canRunNatively,
  compileNativeScannerRules,
  describeNativeCapability,
  describeNativeUnsupportedScanners,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import type { ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';
import {
  generateNativeChartPatterns50Fixtures,
  writeNativeChartPatterns50Fixtures,
  type ChartPattern50ParityBundleV1,
} from './nativeChartPatterns50FixtureGenerator';

const FIXTURE_PATH = resolve(
  __dirname,
  '../fixtures/nativeChartPatterns50ParityFixtures.v1.json',
);

function loadCommittedFixtures(): ChartPattern50ParityBundleV1 {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(FIXTURE_PATH) as ChartPattern50ParityBundleV1;
}

function toNativeMatch(result: ScannerResult): NativeScanMatchV1 {
  return {
    exchange: result.exchange,
    symbol: result.symbol,
    ruleId: result.scannerId,
    date: result.date,
    value: result.score,
    scannerName: result.scannerName,
    categoryId: result.categoryId,
    categoryName: result.categoryName,
    direction: result.direction,
    score: result.score,
    reasons: result.reasons,
    values: result.values,
    source: result.source,
    ...(result.history ? { history: result.history } : {}),
    ...(result.chartPattern
      ? {
          pattern: {
            family: result.chartPattern.family,
            confidence: result.chartPattern.confidence,
            ...(result.chartPattern.patternStartDate
              ? { patternStartDate: result.chartPattern.patternStartDate }
              : {}),
            patternEndDate: result.chartPattern.patternEndDate,
            ...(result.chartPattern.breakoutLevel !== undefined
              ? { breakoutLevel: result.chartPattern.breakoutLevel }
              : {}),
            ...(result.chartPattern.supportLevel !== undefined
              ? { supportLevel: result.chartPattern.supportLevel }
              : {}),
            ...(result.chartPattern.resistanceLevel !== undefined
              ? { resistanceLevel: result.chartPattern.resistanceLevel }
              : {}),
            ...(result.chartPattern.necklineLevel !== undefined
              ? { necklineLevel: result.chartPattern.necklineLevel }
              : {}),
            ...(result.chartPattern.pivots
              ? { pivots: result.chartPattern.pivots }
              : {}),
            ...(result.chartPattern.geometry
              ? { geometry: result.chartPattern.geometry }
              : {}),
          },
        }
      : {}),
  };
}

describe('NS-R3 all 50 remaining chart patterns parity & routing', () => {
  it('registers all 54 built-in chart patterns and maintains a matching parity fixture bundle', async () => {
    const catalogPatternIds = chartPatternScannerDefinitions.map((d) => d.id);
    expect(NATIVE_SUPPORTED_PATTERN_IDS).toHaveLength(54);
    expect(new Set(NATIVE_SUPPORTED_PATTERN_IDS)).toEqual(new Set(catalogPatternIds));

    if (process.env.GENERATE_NSR3_FIXTURES === '1') {
      await writeNativeChartPatterns50Fixtures();
    }
    expect(existsSync(FIXTURE_PATH), `missing ${FIXTURE_PATH}`).toBe(true);
    const committed = loadCommittedFixtures();
    const regenerated = await generateNativeChartPatterns50Fixtures();

    expect(committed.totalPatternCount).toBe(54);
    expect(committed.migratedPatternCount).toBe(50);
    expect(committed.manifest).toHaveLength(54);
    expect(committed).toEqual(regenerated);

    const migratedManifest = committed.manifest.filter((m) => m.status === 'migrated_nsr3');
    expect(migratedManifest).toHaveLength(50);
    expect(committed.manifest.filter((m) => m.status === 'existing_native_gap')).toHaveLength(4);
  }, 30_000);

  it('verifies every migrated pattern scenario against live TypeScript evaluation', async () => {
    const committed = loadCommittedFixtures();
    const positives = committed.scenarios.filter((s) => s.category === 'positive');
    const negatives = committed.scenarios.filter((s) => s.category === 'negative');
    const boundaries = committed.scenarios.filter((s) => s.category === 'boundary');
    const historicals = committed.scenarios.filter((s) => s.category === 'historical');

    expect(positives).toHaveLength(50);
    expect(negatives).toHaveLength(50);
    expect(boundaries).toHaveLength(50);
    expect(historicals.length).toBeGreaterThanOrEqual(4);

    for (const scenario of committed.scenarios) {
      const live = await evaluateRustScannerContractRequestV1(scenario.request);
      expect(live, scenario.id).toEqual(scenario.response);
    }
  }, 60_000);

  it('compiles AST expressions and enforces maxRules = 32 with whole-run TS fallback', async () => {
    const all54 = [...NATIVE_SUPPORTED_PATTERN_IDS];
    for (const id of all54) {
      const compiledExpr = compileNativeScannerExpression(`pattern('${id}')`, {
        allowPattern: true,
      });
      expect(compiledExpr.ok, id).toBe(true);
      expect(compiledExpr.expression).toEqual({ kind: 'pattern', id });
    }

    const batch1 = all54.slice(0, NATIVE_SCAN_LIMITS.maxRules);
    const batch2 = all54.slice(NATIVE_SCAN_LIMITS.maxRules);
    expect(batch1).toHaveLength(32);
    expect(batch2).toHaveLength(22);

    expect(canRunNatively(batch1, undefined, false)).toBe(true);
    expect(canRunNatively(batch1, undefined, true)).toBe(true);
    expect(canRunNatively(batch2, undefined, false)).toBe(true);
    expect(canRunNatively(batch2, undefined, true)).toBe(true);

    // Oversized (> 32 rules) selections must cleanly fall back to TypeScript without truncating.
    expect(canRunNatively(all54, undefined, false)).toBe(false);
    expect(canRunNatively(all54, undefined, true)).toBe(false);
    expect(describeNativeUnsupportedScanners(all54, false)).toContain('32');
    expect(describeNativeCapability()).toContain('54 built-in chart patterns');
    expect(describeNativeCapability()).toContain('daily market scanners');
    expect(describeNativeCapability()).toContain('off by default');

    const compiledAll = compileNativeScannerRules(all54);
    expect(compiledAll.rules).toHaveLength(54);
    expect(compiledAll.unsupportedScannerIds).toEqual([]);

    const tsResult: ScannerRunOutput = {
      results: [],
      alertTriggers: [],
      errors: [],
      scannedSymbols: 1,
      cancelled: false,
    };
    const runTypeScript = vi.fn(async () => tsResult);
    const start = vi.fn();
    const outcome = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [{ exchange: 'NSE', symbol: 'TCS' }],
        scannerIds: all54,
        lookbackBars: 250,
        evaluateHistory: false,
        alertRules: [],
      },
      { runTypeScript, start },
    );
    expect(outcome.backend).toBe('typescript-fallback');
    expect(outcome.fallbackReason).toContain('32');
    expect(start).not.toHaveBeenCalled();
    expect(runTypeScript).toHaveBeenCalledTimes(1);
  });

  it('preserves neutral-bilateral family, pivots, and complex overlay geometry through native transport', async () => {
    const committed = loadCommittedFixtures();
    const rectResult = committed.scenarios.find(
      (s) => s.id === 'chart_rectangle_range_positive',
    )!.response.latestResults[0]!;
    const hsResult = committed.scenarios.find(
      (s) => s.id === 'chart_head_shoulders_positive',
    )!.response.latestResults[0]!;
    expect(rectResult.chartPattern?.family).toBe('neutral-bilateral');

    const matches: NativeScanMatchV1[] = [toNativeMatch(rectResult), toNativeMatch(hsResult)];
    const published: ScannerResult[][] = [];
    const outcome = await runNativeOrTypeScriptScannerBatch(
      {
        targets: [
          { exchange: 'BSE', symbol: '500325' },
          { exchange: 'NSE', symbol: 'HNDS' },
        ],
        scannerIds: ['chart_rectangle_range', 'chart_head_shoulders'],
        lookbackBars: 250,
        evaluateHistory: false,
        alertRules: [],
        onResultChunk: (chunk) => published.push(chunk),
      },
      {
        runTypeScript: vi.fn(async () => ({
          results: [],
          alertTriggers: [],
          errors: [],
          scannedSymbols: 2,
          cancelled: false,
        })),
        newRunId: () => 'nsr3-transport-check',
        subscribe: async (runId, handlers) => {
          setTimeout(() => {
            handlers.onMatches?.({
              eventVersion: 1,
              runId,
              sequence: 1,
              databaseIdentity: 'db#nsr3',
              matches,
            });
            handlers.onComplete?.({
              eventVersion: 1,
              runId,
              sequence: 2,
              databaseIdentity: 'db#nsr3',
              cancelled: false,
              durationMs: 4,
              counts: { targets: 2, matched: 2, noMatch: 0, skipped: 0, failed: 0 },
              workersUsed: 2,
              diagnostics: [],
            });
          }, 0);
          return () => undefined;
        },
        cancel: async () => ({ runId: 'x', cancelRequested: false, alreadyFinished: true }),
        start: async () => ({
          accepted: true,
          runId: 'nsr3-transport-check',
          schemaVersion: 1,
          databaseIdentity: 'db#nsr3',
          workerCount: 2,
          totalTargets: 2,
        }),
      },
    );

    expect(outcome.backend).toBe('native');
    expect(outcome.results).toHaveLength(2);
    const transportedRect = outcome.results.find((r) => r.scannerId === 'chart_rectangle_range');
    const transportedHs = outcome.results.find((r) => r.scannerId === 'chart_head_shoulders');
    expect(transportedRect?.chartPattern?.family).toBe('neutral-bilateral');
    expect(transportedRect?.chartPattern?.geometry).toEqual(rectResult.chartPattern?.geometry);
    expect(transportedHs?.chartPattern?.pivots).toEqual(hsResult.chartPattern?.pivots);
    expect(transportedHs?.chartPattern?.geometry).toEqual(hsResult.chartPattern?.geometry);
    expect(published).toHaveLength(1);
  });
});

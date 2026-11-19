import { describe, expect, it } from 'vitest';
import {
  chartPatternScannerDefinitions,
  runChartPatternScanner,
} from '@/features/chartPatterns';
import {
  assertScannerParityFixtureBundle,
  type ScannerParityFixtureBundleV1,
} from '@/features/scanner/__tests__/parityFixtureHarness';
import rawFixtures from '@/features/scanner/fixtures/exhaustionGapParityFixtures.v1.json';
import {
  evaluateRustScannerContractRequestV1,
  normalizeScannerResultForContract,
} from '@/features/scanner/rustScannerContract';

const bundle = rawFixtures as unknown as ScannerParityFixtureBundleV1;

describe('RSC-06 isolated Exhaustion Gap parity', () => {
  it('matches 17 TypeScript-derived positive, boundary, negative, and historical fixtures', async () => {
    await assertScannerParityFixtureBundle(bundle, {
      scannerId: 'chart_exhaustion_gap',
      scenarioCount: 17,
      categories: ['positive', 'boundary', 'negative', 'historical'],
    });

    const definition = chartPatternScannerDefinitions.find(
      (item) => item.id === 'chart_exhaustion_gap',
    );
    expect(definition).toBeDefined();

    for (const scenario of bundle.scenarios) {
      if (!scenario.request.scannerIds.includes('chart_exhaustion_gap')) continue;
      const match = runChartPatternScanner(
        {
          symbol: scenario.request.target.symbol,
          exchange: scenario.request.target.exchange,
          instrument: scenario.request.target,
          bars: scenario.request.bars,
        },
        definition!,
      );
      expect(
        match
          ? normalizeScannerResultForContract(match, scenario.request.generatedAt)
          : null,
        `direct detector mismatch: ${scenario.id}`,
      ).toEqual(scenario.response.latestResults[0] ?? null);
    }

    const decimalGapFill = bundle.scenarios.find(
      (item) => item.id === 'positive_25_bars_gap_filled_decimal_formatting',
    );
    const gapFillResult = decimalGapFill?.response.latestResults[0];
    expect(gapFillResult?.direction).toBe('bearish');
    expect(gapFillResult?.score).toBe(70);
    expect(gapFillResult?.chartPattern?.resistanceLevel).toBe(126.25);
    expect(gapFillResult?.chartPattern?.breakoutLevel).toBeUndefined();
    expect(gapFillResult?.chartPattern?.geometry?.zones?.[0]).toMatchObject({
      role: 'gap',
      low: 118.9,
      high: 120.4,
    });
    expect(gapFillResult?.reasons).toEqual([
      'High-volume gap up after a 15.47% prior uptrend closed with bearish rejection',
    ]);
  });

  it('retains empty or omitted generatedAt UTC timestamp fallback', async () => {
    const positive = bundle.scenarios.find(
      (item) => item.id === 'positive_min_22_bars_standard',
    );
    expect(positive).toBeDefined();

    for (const generatedAt of ['', undefined]) {
      const response = await evaluateRustScannerContractRequestV1({
        ...positive!.request,
        generatedAt,
      });
      expect(response.latestResults).toHaveLength(1);
      expect(response.latestResults[0]?.generatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
  });

  it('preserves cancellation-envelope semantics and partial grouped history on mid-scan cancel', async () => {
    const grouped = bundle.scenarios.find(
      (item) => item.id === 'historical_grouped_episodes_and_progress',
    );
    expect(grouped).toBeDefined();

    let cancelChecks = 0;
    const response = await evaluateRustScannerContractRequestV1(grouped!.request, {
      shouldCancel: () => {
        cancelChecks += 1;
        return cancelChecks >= 6;
      },
    });

    expect(response.cancelled).toBe(true);
    expect(response.latestResults).toEqual(grouped!.response.latestResults);
    expect(response.historicalResults).toHaveLength(1);
    expect(response.historicalResults[0]?.history).toEqual({
      firstMatchedDate: '2025-01-24',
      lastMatchedDate: '2025-01-24',
      matchCount: 1,
    });
    expect(response.results).toEqual(response.historicalResults);

    let cancelAfter50 = 0;
    const responseAfter50 = await evaluateRustScannerContractRequestV1(grouped!.request, {
      shouldCancel: () => {
        cancelAfter50 += 1;
        return cancelAfter50 >= 52;
      },
    });
    expect(responseAfter50.cancelled).toBe(true);
    expect(responseAfter50.historicalResults.map((item) => item.date)).toEqual([
      '2025-01-24',
      '2025-03-01',
    ]);
    expect(responseAfter50.results.map((item) => item.date)).toEqual([
      '2025-03-01',
      '2025-01-24',
    ]);
    expect(responseAfter50.progressEvents).toHaveLength(1);
    expect(responseAfter50.progressEvents?.[0]).toMatchObject({
      historyCompleted: 50,
      historyTotal: 56,
      resultCount: 2,
    });

    const window275 = bundle.scenarios.find(
      (item) => item.id === 'historical_275_bars_260_window',
    );
    expect(window275).toBeDefined();
    let cancelAtStart = 0;
    const responseAtStart = await evaluateRustScannerContractRequestV1(window275!.request, {
      shouldCancel: () => {
        cancelAtStart += 1;
        return cancelAtStart >= 1;
      },
    });
    expect(responseAtStart.cancelled).toBe(true);
    expect(responseAtStart.latestResults).toEqual(window275!.response.latestResults);
    expect(responseAtStart.historicalResults).toEqual([]);
    expect(responseAtStart.results).toEqual([]);
    expect(responseAtStart.progressEvents).toBeUndefined();
  });

  it('deduplicates duplicate scannerIds and emits one event when historyTotal is 50', async () => {
    const positive = bundle.scenarios.find(
      (item) => item.id === 'positive_min_22_bars_standard',
    );
    expect(positive).toBeDefined();

    const dupResponse = await evaluateRustScannerContractRequestV1({
      ...positive!.request,
      scannerIds: ['chart_exhaustion_gap', 'chart_exhaustion_gap'],
    });
    expect(dupResponse.latestResults).toHaveLength(1);
    expect(dupResponse.results).toHaveLength(1);

    const bars69 = Array.from({ length: 69 }, (_, idx) => ({
      symbol: 'TCS',
      date: `2025-01-${String((idx % 28) + 1).padStart(2, '0')}`,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    const resp69 = await evaluateRustScannerContractRequestV1({
      ...positive!.request,
      bars: bars69,
      evaluateHistory: true,
    });
    expect(resp69.progressEvents).toHaveLength(1);
    expect(resp69.progressEvents?.[0]).toMatchObject({
      historyCompleted: 50,
      historyTotal: 50,
      resultCount: 0,
    });
  });
});

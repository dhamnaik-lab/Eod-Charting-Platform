import { describe, expect, it } from 'vitest';
import {
  assertScannerParityFixtureBundle,
  type ScannerParityFixtureBundleV1,
} from '@/features/scanner/__tests__/parityFixtureHarness';
import {
  chartPatternScannerDefinitions,
  runChartPatternScanner,
} from '@/features/chartPatterns';
import rawBreakawayFixtures from '@/features/scanner/fixtures/breakawayGapParityFixtures.v1.json';
import {
  evaluateRustScannerContractRequestV1,
  normalizeScannerResultForContract,
} from '@/features/scanner/rustScannerContract';

const fixtureBundle =
  rawBreakawayFixtures as unknown as ScannerParityFixtureBundleV1;

describe('RSC-02 Breakaway Gap parity fixtures', () => {
  it('verifies all 24 positive, boundary, negative, and historical scenarios against live TypeScript evaluation', async () => {
    await assertScannerParityFixtureBundle(fixtureBundle, {
      scannerId: 'chart_breakaway_gap',
      scenarioCount: 24,
      categories: ['positive', 'boundary', 'negative', 'historical'],
    });

    const breakawayDefinition = chartPatternScannerDefinitions.find(
      (definition) => definition.id === 'chart_breakaway_gap',
    );
    expect(breakawayDefinition).toBeDefined();

    for (const scenario of fixtureBundle.scenarios) {
      if (scenario.request.scannerIds.includes('chart_breakaway_gap')) {
        const directMatch = runChartPatternScanner(
          {
            symbol: scenario.request.target.symbol,
            exchange: scenario.request.target.exchange,
            instrument: scenario.request.target,
            bars: scenario.request.bars,
          },
          breakawayDefinition!,
        );
        const normalizedDirect = directMatch
          ? normalizeScannerResultForContract(directMatch, scenario.request.generatedAt)
          : null;
        expect(normalizedDirect).toEqual(scenario.response.latestResults[0] ?? null);
      }
    }
  });

  it('falls back to a UTC ISO-8601 millisecond timestamp when generatedAt is omitted or empty', async () => {
    const positiveScenario = fixtureBundle.scenarios.find(
      (scenario) => scenario.id === 'positive_decimal_resistance_22_bars',
    );
    expect(positiveScenario).toBeDefined();

    for (const generatedAt of [undefined, '']) {
      const response = await evaluateRustScannerContractRequestV1({
        ...positiveScenario!.request,
        generatedAt,
      });
      expect(response.latestResults).toHaveLength(1);
      expect(response.latestResults[0]?.generatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
  });
});

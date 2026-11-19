import { describe, expect, it } from 'vitest';
import {
  chartPatternScannerDefinitions,
  runChartPatternScanner,
} from '@/features/chartPatterns';
import {
  assertScannerParityFixtureBundle,
  type ScannerParityFixtureBundleV1,
} from '@/features/scanner/__tests__/parityFixtureHarness';
import rawFixtures from '@/features/scanner/fixtures/runawayGapParityFixtures.v1.json';
import {
  evaluateRustScannerContractRequestV1,
  normalizeScannerResultForContract,
} from '@/features/scanner/rustScannerContract';

const bundle = rawFixtures as unknown as ScannerParityFixtureBundleV1;

describe('RSC-05 isolated Runaway Gap parity', () => {
  it('matches 11 TypeScript-derived positive, boundary, negative, and historical fixtures', async () => {
    await assertScannerParityFixtureBundle(bundle, {
      scannerId: 'chart_runaway_gap',
      scenarioCount: 11,
      categories: ['positive', 'boundary', 'negative', 'historical'],
    });

    const definition = chartPatternScannerDefinitions.find(
      (item) => item.id === 'chart_runaway_gap',
    );
    expect(definition).toBeDefined();
    for (const scenario of bundle.scenarios) {
      if (!scenario.request.scannerIds.includes('chart_runaway_gap')) continue;
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
  });

  it('retains empty or omitted generatedAt UTC timestamp fallback', async () => {
    const positive = bundle.scenarios.find((item) => item.id === 'positive_75_min_22');
    expect(positive).toBeDefined();
    for (const generatedAt of ['', undefined]) {
      const response = await evaluateRustScannerContractRequestV1({
        ...positive!.request,
        generatedAt,
      });
      expect(response.latestResults[0]?.generatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
  });
});

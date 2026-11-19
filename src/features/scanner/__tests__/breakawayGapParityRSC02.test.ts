import { describe, expect, it } from 'vitest';
import {
  chartPatternScannerDefinitions,
  runChartPatternScanner,
} from '@/features/chartPatterns';
import rawBreakawayFixtures from '@/features/scanner/fixtures/breakawayGapParityFixtures.v1.json';
import {
  RUST_SCANNER_CONTRACT_VERSION,
  evaluateRustScannerContractRequestV1,
  normalizeScannerResultForContract,
  type RustScannerEvaluationRequestV1,
  type RustScannerEvaluationResponseV1,
} from '@/features/scanner/rustScannerContract';

type BreakawayGapScenarioCategory = 'positive' | 'negative' | 'boundary' | 'historical';

interface BreakawayGapParityFixtureScenarioV1 {
  id: string;
  category: BreakawayGapScenarioCategory;
  description: string;
  request: RustScannerEvaluationRequestV1;
  response: RustScannerEvaluationResponseV1;
}

interface BreakawayGapParityFixtureBundleV1 {
  contractVersion: typeof RUST_SCANNER_CONTRACT_VERSION;
  scannerId: 'chart_breakaway_gap';
  fixedGeneratedAt: string;
  scenarios: BreakawayGapParityFixtureScenarioV1[];
}

const fixtureBundle =
  rawBreakawayFixtures as unknown as BreakawayGapParityFixtureBundleV1;

describe('RSC-02 Breakaway Gap parity fixtures', () => {
  it('verifies all 24 positive, boundary, negative, and historical scenarios against live TypeScript evaluation', async () => {
    expect(fixtureBundle.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);
    expect(fixtureBundle.scannerId).toBe('chart_breakaway_gap');
    expect(fixtureBundle.scenarios).toHaveLength(24);

    const categories = new Set(fixtureBundle.scenarios.map((scenario) => scenario.category));
    expect(categories).toEqual(new Set(['positive', 'boundary', 'negative', 'historical']));

    const breakawayDefinition = chartPatternScannerDefinitions.find(
      (definition) => definition.id === 'chart_breakaway_gap',
    );
    expect(breakawayDefinition).toBeDefined();

    for (const scenario of fixtureBundle.scenarios) {
      const liveResponse = await evaluateRustScannerContractRequestV1(scenario.request);
      expect(liveResponse).toEqual(scenario.response);

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

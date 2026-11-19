import { describe, expect, it } from 'vitest';
import rawBreakawayFixtures from '@/features/scanner/fixtures/breakawayGapParityFixtures.v1.json';
import {
  assertScannerParityFixtureBundle,
  type ScannerParityFixtureBundleV1,
} from '@/features/scanner/__tests__/parityFixtureHarness';

const bundle = rawBreakawayFixtures as unknown as ScannerParityFixtureBundleV1;

function oneScenario(): ScannerParityFixtureBundleV1 {
  return { ...bundle, scenarios: [bundle.scenarios[0]!] };
}

const options = {
  scannerId: 'chart_breakaway_gap',
  scenarioCount: 1,
  categories: ['positive'],
};

describe('RSC-03 reusable TypeScript parity fixture harness', () => {
  it('accepts the committed deterministic TypeScript fixture unchanged', async () => {
    await assertScannerParityFixtureBundle(oneScenario(), options);
  });

  it('rejects fixture result drift with the scenario identity', async () => {
    const original = oneScenario();
    const scenario = original.scenarios[0]!;
    const corrupted: ScannerParityFixtureBundleV1 = {
      ...original,
      scenarios: [{
        ...scenario,
        response: {
          ...scenario.response,
          latestResults: scenario.response.latestResults.map((result) => ({
            ...result,
            date: '1900-01-01',
          })),
        },
      }],
    };
    await expect(assertScannerParityFixtureBundle(corrupted, options)).rejects.toThrow(
      /live TypeScript parity mismatch: positive_decimal_resistance_22_bars/,
    );
  });

  it('rejects duplicate scenario IDs before evaluating a fixture', async () => {
    const original = oneScenario();
    const corrupted = { ...original, scenarios: [original.scenarios[0]!, original.scenarios[0]!] };
    await expect(assertScannerParityFixtureBundle(corrupted, {
      ...options,
      scenarioCount: 2,
    })).rejects.toThrow(/duplicate scenario ID/);
  });
});

import { describe, expect, it } from 'vitest';
import { chartPatternScannerDefinitions } from '@/features/chartPatterns';
import type { ChartPatternFamily } from '@/features/chartPatterns/types';
import rawFixtureBundle from '@/features/scanner/fixtures/rustScannerContractFixtures.v1.json';
import {
  RUST_SCANNER_CONTRACT_VERSION,
  evaluateRustScannerContractRequestV1,
  sortScannerResultsForContract,
  type RustScannerContractFixtureBundleV1,
  type RustScannerEvaluationRequestV1,
} from '@/features/scanner/rustScannerContract';
import type { EodBar, ScannerDirection } from '@/features/scanner/types';

const fixtureBundle = rawFixtureBundle as unknown as RustScannerContractFixtureBundleV1;

describe('RSC-01 Rust scanner contract and TypeScript fixture foundation', () => {
  it('matches live TypeScript chart-pattern evaluation across all engine-derived contract fixtures', async () => {
    expect(fixtureBundle.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);

    const engineScenarios = fixtureBundle.scenarios.filter((scenario) => scenario.engineDerived);
    expect(engineScenarios).toHaveLength(4);
    expect(engineScenarios.map((scenario) => scenario.familyCoverage)).toEqual([
      'gap',
      'reversal',
      'continuation',
      'neutral-bilateral',
    ]);

    for (const scenario of engineScenarios) {
      const liveResponse = await evaluateRustScannerContractRequestV1(scenario.request);
      expect(liveResponse).toEqual(scenario.response);
    }
  });

  it('returns empty results with cancelled=false when bars do not match selected scanners', async () => {
    const flatBars: EodBar[] = Array.from({ length: 25 }, (_, index) => ({
      symbol: 'FLAT',
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 10000,
    }));
    const request: RustScannerEvaluationRequestV1 = {
      contractVersion: RUST_SCANNER_CONTRACT_VERSION,
      requestId: 'req-nonmatch-001',
      target: { symbol: 'FLAT', exchange: 'NSE' },
      bars: flatBars,
      scannerIds: [
        'chart_breakaway_gap',
        'chart_double_bottom',
        'chart_bull_flag',
        'chart_symmetrical_triangle',
      ],
      lookbackBars: 800,
      evaluateHistory: true,
      executionMode: 'fast',
      generatedAt: fixtureBundle.fixedGeneratedAt,
    };

    const response = await evaluateRustScannerContractRequestV1(request);

    expect(response).toEqual({
      contractVersion: RUST_SCANNER_CONTRACT_VERSION,
      requestId: 'req-nonmatch-001',
      target: { symbol: 'FLAT', exchange: 'NSE' },
      latestResults: [],
      historicalResults: [],
      results: [],
      scannedBars: 25,
      cancelled: false,
      errors: [],
      progressEvents: [
        {
          contractVersion: RUST_SCANNER_CONTRACT_VERSION,
          requestId: 'req-nonmatch-001',
          completed: 1,
          total: 1,
          symbol: 'FLAT',
          exchange: 'NSE',
          historyCompleted: 6,
          historyTotal: 6,
          resultCount: 0,
        },
      ],
    });
  });

  it('propagates cancellation and preserves partial historical episodes', async () => {
    const historyScenario = fixtureBundle.scenarios.find(
      (scenario) => scenario.id === 'neutral_bilateral_range_history_match',
    );
    expect(historyScenario).toBeDefined();

    let cancelChecks = 0;
    const response = await evaluateRustScannerContractRequestV1(historyScenario!.request, {
      shouldCancel: () => {
        cancelChecks += 1;
        return cancelChecks >= 3;
      },
    });

    expect(response.cancelled).toBe(true);
    expect(response.latestResults).toHaveLength(1);
    expect(response.historicalResults).toHaveLength(1);
    expect(response.historicalResults[0]?.history).toEqual({
      firstMatchedDate: '2027-02-21',
      lastMatchedDate: '2027-02-21',
      matchCount: 1,
    });
    expect(response.results).toEqual(response.historicalResults);
  });

  it('sorts scanner results descending by date and ascending by scannerName', () => {
    const sample = fixtureBundle.orderedResultsSample;
    const reordered = [sample[4], sample[2], sample[0], sample[3], sample[1]];

    expect(sortScannerResultsForContract(reordered)).toEqual(sample);
  });

  it('covers all 54 chart-pattern definitions and optional envelope fields in v1', () => {
    const validFamilies = new Set<ChartPatternFamily>([
      'gap',
      'reversal',
      'continuation',
      'neutral-bilateral',
    ]);
    const validDirections = new Set<ScannerDirection>(['bullish', 'bearish', 'neutral']);

    expect(chartPatternScannerDefinitions).toHaveLength(54);
    for (const definition of chartPatternScannerDefinitions) {
      expect(validFamilies.has(definition.chartPattern!.family)).toBe(true);
      expect(validDirections.has(definition.chartPattern!.signalDirection)).toBe(true);
    }

    const envelopeScenario = fixtureBundle.scenarios.find(
      (scenario) => scenario.id === 'nonmatch_and_cancelled_optional_envelope',
    );
    expect(envelopeScenario).toBeDefined();
    expect(envelopeScenario?.engineDerived).toBe(false);
    expect(envelopeScenario?.cancelRequest?.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);
    expect(envelopeScenario?.response.cancelled).toBe(true);
    expect(envelopeScenario?.response.results[0]?.matched).toBe(false);
    expect(envelopeScenario?.response.results[0]?.values).toEqual({
      flag_active: true,
      gap_direction: 'up',
      touch_count: 4,
      slope_ratio: -0.375,
      optional_metric: null,
    });
  });
});

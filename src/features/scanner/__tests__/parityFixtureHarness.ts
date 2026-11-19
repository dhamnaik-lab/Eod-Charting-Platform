import { expect } from 'vitest';
import {
  RUST_SCANNER_CONTRACT_VERSION,
  evaluateRustScannerContractRequestV1,
  type RustScannerEvaluationRequestV1,
  type RustScannerEvaluationResponseV1,
} from '@/features/scanner/rustScannerContract';

export interface ScannerParityFixtureScenarioV1 {
  id: string;
  category: string;
  description: string;
  request: RustScannerEvaluationRequestV1;
  response: RustScannerEvaluationResponseV1;
}

export interface ScannerParityFixtureBundleV1 {
  contractVersion: typeof RUST_SCANNER_CONTRACT_VERSION;
  scannerId: string;
  fixedGeneratedAt: string;
  scenarios: ScannerParityFixtureScenarioV1[];
}

/** Test-only fixture verifier; no scanner runtime routing. */
export async function assertScannerParityFixtureBundle(
  bundle: ScannerParityFixtureBundleV1,
  options: { scannerId: string; scenarioCount: number; categories: readonly string[] },
): Promise<void> {
  expect(bundle.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);
  expect(bundle.scannerId).toBe(options.scannerId);
  expect(bundle.fixedGeneratedAt.trim().length).toBeGreaterThan(0);
  expect(bundle.scenarios).toHaveLength(options.scenarioCount);
  const ids = new Set<string>();
  const categories = new Set<string>();
  for (const scenario of bundle.scenarios) {
    expect(scenario.id.trim().length, 'empty scenario ID').toBeGreaterThan(0);
    expect(ids.has(scenario.id), `duplicate scenario ID: ${scenario.id}`).toBe(false);
    ids.add(scenario.id);
    expect(scenario.description.trim().length, `empty description: ${scenario.id}`).toBeGreaterThan(0);
    categories.add(scenario.category);
    expect(scenario.request.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);
    expect(scenario.response.contractVersion).toBe(RUST_SCANNER_CONTRACT_VERSION);
    expect(scenario.response.requestId).toBe(scenario.request.requestId);
    expect(scenario.response.target).toEqual(scenario.request.target);
    expect(scenario.response.scannedBars).toBe(scenario.request.bars.length);
    expect(
      scenario.request.scannerIds.every((id) => id === options.scannerId),
      `unrelated scanner ID: ${scenario.id}`,
    ).toBe(true);
    const live = await evaluateRustScannerContractRequestV1(scenario.request);
    expect(live, `live TypeScript parity mismatch: ${scenario.id}`).toEqual(scenario.response);
  }
  expect(categories).toEqual(new Set(options.categories));
}

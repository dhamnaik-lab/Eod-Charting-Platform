import {
  evaluateChartPatterns,
  type ChartPatternEvaluationOutput,
  type ScannerExecutionMode,
} from '@/features/chartPatterns/evaluation';
import type { ChartPatternFamily } from '@/features/chartPatterns/types';
import type {
  EodBar,
  ScannerResult,
  ScannerRunTarget,
} from '@/features/scanner/types';

export const RUST_SCANNER_CONTRACT_VERSION = 'eod-scanner-contract-v1' as const;

export type RustScannerContractVersion = typeof RUST_SCANNER_CONTRACT_VERSION;

export type ScannerScalarValueV1 = number | string | boolean | null;

export interface RustScannerEvaluationRequestV1 {
  contractVersion: RustScannerContractVersion;
  requestId: string;
  target: ScannerRunTarget;
  bars: EodBar[];
  scannerIds: string[];
  lookbackBars: number | null;
  evaluateHistory: boolean;
  executionMode: ScannerExecutionMode;
  toDate?: string | null;
  generatedAt?: string;
}

export interface RustScannerProgressEventV1 {
  contractVersion: RustScannerContractVersion;
  requestId: string;
  completed: number;
  total: number;
  symbol: string;
  exchange: string;
  historyCompleted?: number;
  historyTotal?: number;
  resultCount?: number;
}

export interface RustScannerCancelRequestV1 {
  contractVersion: RustScannerContractVersion;
  requestId: string;
  reason?: string;
}

export interface RustScannerEvaluationResponseV1 {
  contractVersion: RustScannerContractVersion;
  requestId: string;
  target: ScannerRunTarget;
  latestResults: ScannerResult[];
  historicalResults: ScannerResult[];
  results: ScannerResult[];
  scannedBars: number;
  cancelled: boolean;
  errors: string[];
  progressEvents?: RustScannerProgressEventV1[];
}

export interface RustScannerContractFixtureScenarioV1 {
  id: string;
  description: string;
  familyCoverage: ChartPatternFamily | 'mixed';
  engineDerived: boolean;
  request: RustScannerEvaluationRequestV1;
  cancelRequest?: RustScannerCancelRequestV1;
  response: RustScannerEvaluationResponseV1;
}

export interface RustScannerContractFixtureBundleV1 {
  contractVersion: RustScannerContractVersion;
  fixedGeneratedAt: string;
  scenarios: RustScannerContractFixtureScenarioV1[];
  orderedResultsSample: ScannerResult[];
}

export function sortScannerResultsForContract(results: readonly ScannerResult[]): ScannerResult[] {
  return [...results].sort(
    (first, second) =>
      second.date.localeCompare(first.date) || first.scannerName.localeCompare(second.scannerName),
  );
}

export function normalizeScannerResultForContract(
  result: ScannerResult,
  fixedGeneratedAt?: string,
): ScannerResult {
  if (!fixedGeneratedAt) {
    return result;
  }
  return {
    ...result,
    generatedAt: fixedGeneratedAt,
  };
}

export async function evaluateRustScannerContractRequestV1(
  request: RustScannerEvaluationRequestV1,
  options?: { shouldCancel?: () => boolean },
): Promise<RustScannerEvaluationResponseV1> {
  const progressEvents: RustScannerProgressEventV1[] = [];
  const output: ChartPatternEvaluationOutput = await evaluateChartPatterns({
    target: request.target,
    bars: request.bars,
    scannerIds: request.scannerIds,
    evaluateHistory: request.evaluateHistory,
    executionMode: request.executionMode,
    shouldCancel: options?.shouldCancel,
    onProgress: (progress) => {
      progressEvents.push({
        contractVersion: RUST_SCANNER_CONTRACT_VERSION,
        requestId: request.requestId,
        completed: 1,
        total: 1,
        symbol: request.target.symbol,
        exchange: request.target.exchange,
        historyCompleted: progress.completed,
        historyTotal: progress.total,
        resultCount: progress.resultCount,
      });
    },
  });

  const latestResults = output.latestResults.map((result) =>
    normalizeScannerResultForContract(result, request.generatedAt),
  );
  const historicalResults = output.historicalResults.map((result) =>
    normalizeScannerResultForContract(result, request.generatedAt),
  );
  const results = sortScannerResultsForContract(
    request.evaluateHistory ? historicalResults : latestResults,
  );

  return {
    contractVersion: request.contractVersion,
    requestId: request.requestId,
    target: request.target,
    latestResults,
    historicalResults,
    results,
    scannedBars: request.bars.length,
    cancelled: output.cancelled,
    errors: [],
    ...(progressEvents.length > 0 ? { progressEvents } : {}),
  };
}

/**
 * Fail-closed metadata gate for native core OHLCV numeric matches.
 *
 * The existing TypeScript core scanners return a complete ScannerResult, not
 * merely a boolean decision. This protects opt-in bounded/latest native
 * results against missing metadata, NOT against all numeric/reason discrepancies.
 * Complete, independently verified Rust/TypeScript parity is still required
 * before retiring the TypeScript implementation.
 */
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import type { ScannerDirection } from '@/plugins/scanner/types';
import type { NativeScanMatchV1 } from './nativeScanContract';

const coreDefinitionsById = new Map(
  coreOhlcvScannerDefinitions.map((definition) => [definition.id, definition]),
);

/** Accepted direction for each built-in core scanner's successful result. */
const CORE_DIRECTIONS: Readonly<Record<string, ScannerDirection>> = {
  prev_day_high_break: 'bullish',
  prev_day_low_break: 'bearish',
  inside_bar: 'neutral',
  outside_bar: 'neutral',
  close_near_high: 'bullish',
  close_near_low: 'bearish',
  gap_up: 'bullish',
  gap_down: 'bearish',
  nr7: 'neutral',
  wide_range_candle: 'neutral',
};

/**
 * Returns null for non-core IDs (handled by their own evaluators) or for a
 * structurally complete core result. A non-null reason requires rejecting
 * the entire native run and invoking the existing TypeScript fallback.
 *
 * Semantic parity still requires an independent Rust-versus-TypeScript
 * comparison of numeric values and human-readable reasons using the same
 * completed EOD bars. This deliberately does NOT synthesize missing fields.
 */
export function nativeCoreResultMetadataIssue(match: NativeScanMatchV1): string | null {
  const definition = coreDefinitionsById.get(match.ruleId);
  if (!definition) return null;

  const failure = (detail: string): string => `${match.ruleId}: ${detail}`;
  if (match.pattern !== undefined || match.history !== undefined) {
    return failure('core matches must not contain chart-pattern or historical-group payloads.');
  }
  if (match.score !== undefined) {
    return failure('core matches must not invent a confidence score.');
  }
  if (
    match.scannerName !== definition.name ||
    match.categoryId !== definition.categoryId ||
    match.categoryName !== definition.categoryName
  ) {
    return failure('scanner and category metadata do not match the accepted core definition.');
  }
  if (match.direction !== CORE_DIRECTIONS[match.ruleId]) {
    return failure('direction does not match the accepted core scanner.');
  }
  if (match.source !== 'EODScannerPlugin_v1') {
    return failure('the original core result source is missing or changed.');
  }
  if (
    !Array.isArray(match.reasons) ||
    match.reasons.length !== 1 ||
    typeof match.reasons[0] !== 'string' ||
    match.reasons[0].trim().length === 0
  ) {
    return failure('the original single non-empty human-readable reason is required.');
  }
  if (!match.values || Array.isArray(match.values) || typeof match.values !== 'object') {
    return failure('the accepted numerical result columns are missing.');
  }

  const expectedColumns = [...definition.suggestedOutputColumns].sort();
  const providedColumns = Object.keys(match.values).sort();
  if (
    expectedColumns.length !== providedColumns.length ||
    expectedColumns.some((column, index) => column !== providedColumns[index])
  ) {
    return failure('result columns differ from the accepted core scanner.');
  }
  for (const column of expectedColumns) {
    const value = match.values[column];
    // The TypeScript engine permits null for zero-range CLV and unavailable
    // 10-bar inside-bar range ratios; every other core result is numerical.
    if (value === null && (column === 'clv' || column === 'range_ratio')) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return failure(`result column "${column}" is not a finite number.`);
    }
  }
  return null;
}

export function isNativeCoreResultId(ruleId: string): boolean {
  return coreDefinitionsById.has(ruleId);
}

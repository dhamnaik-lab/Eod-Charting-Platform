/**
 * Fail-closed metadata gate for native core OHLCV and Daily Market matches.
 *
 * The existing TypeScript core and Daily Market scanners return a complete ScannerResult, not
 * merely a boolean decision. This protects opt-in bounded/latest native
 * results against missing metadata, NOT against all numeric/reason discrepancies.
 * Complete, independently verified Rust/TypeScript parity is still required
 * before retiring the TypeScript implementation.
 */
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import { dailyMarketScannerDefinitions } from '@/plugins/scanner/dailyMarketScanners';
import type { ScannerDefinition, ScannerDirection } from '@/plugins/scanner/types';
import type { NativeScanMatchV1 } from './nativeScanContract';

const coreDefinitionsById = new Map(
  coreOhlcvScannerDefinitions.map((definition) => [definition.id, definition]),
);

const dailyMarketDefinitionsById = new Map(
  dailyMarketScannerDefinitions.map((definition) => [definition.id, definition]),
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

/** Fixed direction for directional Daily Market scanners; `volume_surge` depends on `change_pct`. */
const DAILY_MARKET_FIXED_DIRECTIONS: Readonly<Record<string, ScannerDirection>> = {
  top_gainers: 'bullish',
  top_losers: 'bearish',
  high_52w: 'bullish',
  low_52w: 'bearish',
};

/** Actual scalar output columns emitted by the TypeScript Daily Market handlers. */
const DAILY_MARKET_OUTPUT_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  top_gainers: ['change_amt', 'change_pct', 'close', 'prev_close', 'volume'],
  top_losers: ['change_amt', 'change_pct', 'close', 'prev_close', 'volume'],
  volume_surge: ['avg_volume_20', 'change_pct', 'vol_ratio', 'volume'],
  high_52w: ['change_pct', 'close', 'dist_52w_pct', 'high_52w'],
  low_52w: ['change_pct', 'close', 'dist_52w_pct', 'low_52w'],
};

function isValidDailyMarketDirection(match: NativeScanMatchV1): boolean {
  const fixed = Object.prototype.hasOwnProperty.call(DAILY_MARKET_FIXED_DIRECTIONS, match.ruleId)
    ? DAILY_MARKET_FIXED_DIRECTIONS[match.ruleId]
    : undefined;
  if (fixed) return match.direction === fixed;
  if (match.ruleId !== 'volume_surge') return false;
  if (match.direction !== 'bullish' && match.direction !== 'bearish') return false;
  const changePct = match.values?.change_pct;
  if (typeof changePct !== 'number' || !Number.isFinite(changePct)) return false;
  if (changePct > 0) return match.direction === 'bullish';
  if (changePct < 0) return match.direction === 'bearish';
  return true;
}

function validateBuiltInMatchMetadata(
  match: NativeScanMatchV1,
  definition: ScannerDefinition,
  expectedColumns: readonly string[],
  allowNullableColumns: ReadonlySet<string>,
  directionValid: boolean,
  directionErrorLabel: string,
): string | null {
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
  if (!directionValid) {
    return failure(`direction does not match the accepted ${directionErrorLabel} scanner.`);
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

  const expectedSorted = [...expectedColumns].sort();
  const providedSorted = Object.keys(match.values).sort();
  if (
    expectedSorted.length !== providedSorted.length ||
    expectedSorted.some((column, index) => column !== providedSorted[index])
  ) {
    return failure('result columns differ from the accepted core scanner.');
  }
  for (const column of expectedSorted) {
    const value = match.values[column];
    if (value === null && allowNullableColumns.has(column)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return failure(`result column "${column}" is not a finite number.`);
    }
  }
  return null;
}

const CORE_NULLABLE_COLUMNS = new Set(['clv', 'range_ratio']);
const NO_NULLABLE_COLUMNS = new Set<string>();

/**
 * Returns null for non-built-in IDs (handled by their own evaluators) or for a
 * structurally complete core / Daily Market result. A non-null reason requires rejecting
 * the entire native run and invoking the existing TypeScript fallback.
 *
 * Semantic parity still requires an independent Rust-versus-TypeScript
 * comparison of numeric values and human-readable reasons using the same
 * completed EOD bars. This deliberately does NOT synthesize missing fields.
 */
export function nativeCoreResultMetadataIssue(match: NativeScanMatchV1): string | null {
  const coreDefinition = coreDefinitionsById.get(match.ruleId);
  if (coreDefinition) {
    return validateBuiltInMatchMetadata(
      match,
      coreDefinition,
      coreDefinition.suggestedOutputColumns,
      CORE_NULLABLE_COLUMNS,
      match.direction === CORE_DIRECTIONS[match.ruleId],
      'core',
    );
  }

  const dailyMarketDefinition = dailyMarketDefinitionsById.get(match.ruleId);
  if (dailyMarketDefinition) {
    const expectedColumns = Object.prototype.hasOwnProperty.call(
      DAILY_MARKET_OUTPUT_COLUMNS,
      match.ruleId,
    )
      ? DAILY_MARKET_OUTPUT_COLUMNS[match.ruleId]!
      : [];
    return validateBuiltInMatchMetadata(
      match,
      dailyMarketDefinition,
      expectedColumns,
      NO_NULLABLE_COLUMNS,
      isValidDailyMarketDirection(match),
      'daily market',
    );
  }

  return null;
}

export function isNativeCoreResultId(ruleId: string): boolean {
  return coreDefinitionsById.has(ruleId);
}

export function isNativeDailyMarketResultId(ruleId: string): boolean {
  return dailyMarketDefinitionsById.has(ruleId);
}

export function isNativeBuiltInResultId(ruleId: string): boolean {
  return isNativeCoreResultId(ruleId) || isNativeDailyMarketResultId(ruleId);
}

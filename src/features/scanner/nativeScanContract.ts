/**
 * NS-01 — Versioned transport contract for the opt-in native (Rust) EOD scanner.
 *
 * This module is pure TypeScript: it declares the wire format, validates it at the
 * boundary, and negotiates capability. It performs no I/O and is not wired to the
 * desktop bridge. The native backend is OFF by default; the accepted TypeScript
 * scanner path is unchanged.
 *
 * Bar convention (documented once, used everywhere):
 * - The evaluation series is the bounded window of *completed* bars ending at the
 *   as-of date. The final element of the window is `Close[0]`.
 * - `Close[k]` means "k completed bars before the evaluation bar", i.e. the existing
 *   `ref(close, k)` semantics. `k` must be a non-negative integer < the bar count.
 * - No negative or future references exist, and no rule may read past `asOfDate`.
 */

export const NATIVE_SCAN_SCHEMA_VERSION = 1 as const;
export const NATIVE_SCAN_CONTRACT_VERSION = 'eod-native-scan-contract-v1' as const;
export const NATIVE_SCAN_EVENT_VERSION = 1 as const;

/** Bounded validation limits; the Rust validator enforces the same numbers. */
export const NATIVE_SCAN_LIMITS = {
  maxAstDepth: 24,
  maxAstNodes: 512,
  maxRules: 32,
  maxIndicatorPeriod: 400,
  maxLookback: 2000,
  maxLookbackBars: 5000,
  maxExplicitTargets: 5000,
  maxIdLength: 128,
  maxPatternRuleLookbackBars: 260,
} as const;

export type NativePriceBasis = 'raw' | 'adjusted';

export type NativeOhlcvField = 'open' | 'high' | 'low' | 'close' | 'volume';

export type NativeArithmeticOperator = 'add' | 'sub' | 'mul' | 'div';
export type NativeComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
export type NativeLogicalOperator = 'and' | 'or';
export type NativeBinaryOperator =
  | NativeArithmeticOperator
  | NativeComparisonOperator
  | NativeLogicalOperator;

export type NativeIndicatorName = 'sma' | 'ema' | 'rsi' | 'atr' | 'volumeSma';

/**
 * Chart patterns with accepted, fixture-backed Rust parity today.
 * Everything else stays on the TypeScript worker path; it is never silently dropped.
 */
export const NATIVE_SUPPORTED_PATTERN_IDS = [
  'chart_breakaway_gap',
  'chart_common_gap',
  'chart_runaway_gap',
  'chart_exhaustion_gap',
] as const;

export type NativeSupportedPatternId = (typeof NATIVE_SUPPORTED_PATTERN_IDS)[number];

export const NATIVE_SUPPORTED_PATTERN_NAMES: Record<NativeSupportedPatternId, string> = {
  chart_breakaway_gap: 'Breakaway Gap',
  chart_common_gap: 'Common Gap',
  chart_runaway_gap: 'Runaway Gap',
  chart_exhaustion_gap: 'Exhaustion Gap',
};

export interface NativeNumberExprV1 {
  kind: 'number';
  value: number;
}

export interface NativeFieldExprV1 {
  kind: 'field';
  field: NativeOhlcvField;
  lookback: number;
}

export interface NativeBinaryExprV1 {
  kind: 'binary';
  op: NativeBinaryOperator;
  left: NativeExprV1;
  right: NativeExprV1;
}

export interface NativeIndicatorExprV1 {
  kind: 'indicator';
  name: NativeIndicatorName;
  period: number;
  input?: NativeExprV1;
}

export interface NativeCrossExprV1 {
  kind: 'crossover' | 'crossunder';
  left: NativeExprV1;
  right: NativeExprV1;
}

export interface NativePatternExprV1 {
  kind: 'pattern';
  id: NativeSupportedPatternId;
}

export type NativeExprV1 =
  | NativeNumberExprV1
  | NativeFieldExprV1
  | NativeBinaryExprV1
  | NativeIndicatorExprV1
  | NativeCrossExprV1
  | NativePatternExprV1;

export interface NativeScanRuleV1 {
  id: string;
  expression: NativeExprV1;
}

export interface NativeExplicitTargetsUniverseV1 {
  source: 'explicitTargets';
  targets: Array<{ exchange: string; symbol: string }>;
}

/**
 * `activeNseEq` means exactly NSE series `EQ`. It is intentionally narrower than the
 * existing UI `nseEquity` option (EQ/BE/BZ/SM/ST/SZ) and never replaces it.
 */
export interface NativeActiveNseEqUniverseV1 {
  source: 'activeNseEq';
}

export interface NativeActiveBseUniverseV1 {
  source: 'activeBse';
}

export type NativeScanUniverseV1 =
  | NativeExplicitTargetsUniverseV1
  | NativeActiveNseEqUniverseV1
  | NativeActiveBseUniverseV1;

export interface NativeScanEvaluationV1 {
  /** Inclusive last bar date (`YYYY-MM-DD`). Omitted means "latest available". */
  asOfDate?: string | null;
  lookbackBars?: number | null;
  evaluateHistory: boolean;
  /** Raw is the compatibility-preserving default, matching `adjusted: false`. */
  priceBasis: NativePriceBasis;
  includeDividendAdjustments?: boolean;
  includeRightsAdjustments?: boolean;
}

export interface NativeScanRequestV1 {
  schemaVersion: typeof NATIVE_SCAN_SCHEMA_VERSION;
  requestedRunId: string;
  universe: NativeScanUniverseV1;
  evaluation: NativeScanEvaluationV1;
  rules: NativeScanRuleV1[];
}

export type NativeTargetOutcomeStatus = 'match' | 'no-match' | 'skipped' | 'error';

export interface NativeScanDiagnosticV1 {
  code: string;
  message: string;
  target?: { exchange: string; symbol: string } | null;
  ruleId?: string | null;
}

export interface NativeScanCountsV1 {
  targets: number;
  matched: number;
  noMatch: number;
  skipped: number;
  failed: number;
}

/**
 * Accepted chart-pattern details carried by a native match (P0-02).
 *
 * Field names and semantics mirror `ChartPatternResultDetailsV1` in
 * `src-tauri-shell/src/scanner_contract.rs`, so a native result can be converted into the
 * existing `ScannerResult` without dropping identity, levels or geometry.
 */
export interface NativeScanPatternDetailsV1 {
  family: string;
  confidence: number;
  patternStartDate?: string | null;
  patternEndDate: string;
  breakoutLevel?: number | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  necklineLevel?: number | null;
  targetPrice?: number | null;
  stopLossPrice?: number | null;
  potentialGainPct?: number | null;
  riskRewardRatio?: number | null;
  pivots?: Array<{ index: number; date: string; price: number; kind: string }> | null;
  /** Accepted overlay geometry, passed through untouched. */
  geometry?: unknown;
}

export interface NativeScanMatchV1 {
  exchange: string;
  symbol: string;
  ruleId: string;
  date: string;
  value?: number;
  /** Optional accepted metadata; absent means "not produced", never "neutral". */
  scannerName?: string;
  categoryId?: string;
  categoryName?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  score?: number;
  reasons?: string[];
  values?: Record<string, number | string | boolean | null>;
  source?: string;
  pattern?: NativeScanPatternDetailsV1;
}

export interface NativeScanProgressEventV1 {
  eventVersion: typeof NATIVE_SCAN_EVENT_VERSION;
  runId: string;
  /** Strictly increasing per run; ordering guard for stale/late events. */
  sequence: number;
  databaseIdentity: string;
  completed: number;
  total: number;
  currentTarget?: { exchange: string; symbol: string } | null;
  counts: NativeScanCountsV1;
}

export interface NativeScanMatchBatchEventV1 {
  eventVersion: typeof NATIVE_SCAN_EVENT_VERSION;
  runId: string;
  sequence: number;
  databaseIdentity: string;
  matches: NativeScanMatchV1[];
}

export interface NativeScanCompleteEventV1 {
  eventVersion: typeof NATIVE_SCAN_EVENT_VERSION;
  runId: string;
  sequence: number;
  databaseIdentity: string;
  cancelled: boolean;
  durationMs: number;
  counts: NativeScanCountsV1;
  /** Workers the run actually used, not the requested count (P1-08). */
  workersUsed?: number;
  diagnostics: NativeScanDiagnosticV1[];
}

export interface NativeScanErrorEventV1 {
  eventVersion: typeof NATIVE_SCAN_EVENT_VERSION;
  runId: string;
  sequence: number;
  databaseIdentity: string;
  code: string;
  message: string;
  counts: NativeScanCountsV1;
  diagnostics: NativeScanDiagnosticV1[];
}

export interface NativeScanStartAckV1 {
  accepted: true;
  runId: string;
  schemaVersion: typeof NATIVE_SCAN_SCHEMA_VERSION;
  databaseIdentity: string;
  workerCount: number;
  totalTargets: number;
}

export interface NativeScanCancelAckV1 {
  runId: string;
  cancelRequested: boolean;
  /** True when the run was already finished/unknown, so cancel was a no-op. */
  alreadyFinished: boolean;
}

export interface NativeScannerCapabilitiesV1 {
  contractVersion: typeof NATIVE_SCAN_CONTRACT_VERSION;
  schemaVersion: typeof NATIVE_SCAN_SCHEMA_VERSION;
  defaultEnabled: false;
  workerCount: number;
  supportedPatternIds: readonly string[];
  supportedIndicatorNames: readonly NativeIndicatorName[];
  supportedUniverseSources: readonly NativeScanUniverseV1['source'][];
  maxLimits: typeof NATIVE_SCAN_LIMITS;
}

export interface NativeScanValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type NativeScanValidationResult =
  | { ok: true; request: NativeScanRequestV1 }
  | { ok: false; issues: NativeScanValidationIssue[] };

const JSON_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: NativeScanValidationIssue[],
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    issues.push({ path, code: 'not-an-integer', message: `${path} must be a finite integer.` });
    return null;
  }
  if (value < minimum || value > maximum) {
    issues.push({
      path,
      code: 'out-of-range',
      message: `${path} must be between ${minimum} and ${maximum}; received ${value}.`,
    });
    return null;
  }
  return value;
}

function checkIdentifier(
  value: unknown,
  path: string,
  issues: NativeScanValidationIssue[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path, code: 'missing-identifier', message: `${path} must be a non-empty string.` });
    return null;
  }
  if (value.length > NATIVE_SCAN_LIMITS.maxIdLength || !ID_PATTERN.test(value)) {
    issues.push({
      path,
      code: 'invalid-identifier',
      message: `${path} must match ${ID_PATTERN.source} and be at most ${NATIVE_SCAN_LIMITS.maxIdLength} characters.`,
    });
    return null;
  }
  return value;
}

function checkIsoDate(
  value: unknown,
  path: string,
  issues: NativeScanValidationIssue[],
): string | null {
  if (typeof value !== 'string' || !JSON_DATE_PATTERN.test(value)) {
    issues.push({ path, code: 'invalid-date', message: `${path} must be a YYYY-MM-DD date.` });
    return null;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    issues.push({ path, code: 'invalid-date', message: `${path} is not a real calendar date.` });
    return null;
  }
  return value;
}

interface AstWalkState {
  nodes: number;
  issues: NativeScanValidationIssue[];
}

function requireObject(
  value: unknown,
  path: string,
  issues: NativeScanValidationIssue[],
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    issues.push({ path, code: 'not-an-object', message: `${path} must be an object.` });
    return null;
  }
  return value;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: NativeScanValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push({
        path: `${path}.${key}`,
        code: 'unknown-field',
        message: `${path} contains unsupported field "${key}".`,
      });
    }
  }
}

function walkExpr(
  value: unknown,
  path: string,
  depth: number,
  state: AstWalkState,
): NativeExprV1 | null {
  if (depth > NATIVE_SCAN_LIMITS.maxAstDepth) {
    state.issues.push({
      path,
      code: 'max-depth',
      message: `${path} exceeds the maximum AST depth of ${NATIVE_SCAN_LIMITS.maxAstDepth}.`,
    });
    return null;
  }
  state.nodes += 1;
  if (state.nodes > NATIVE_SCAN_LIMITS.maxAstNodes) {
    state.issues.push({
      path,
      code: 'max-nodes',
      message: `${path} exceeds the maximum AST node count of ${NATIVE_SCAN_LIMITS.maxAstNodes}.`,
    });
    return null;
  }

  const expr = requireObject(value, path, state.issues);
  if (!expr) return null;

  switch (expr.kind) {
    case 'number': {
      rejectUnknownKeys(expr, ['kind', 'value'], path, state.issues);
      const numeric = expr.value;
      if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
        state.issues.push({
          path: `${path}.value`,
          code: 'non-finite-number',
          message: `${path}.value must be a finite number.`,
        });
        return null;
      }
      return { kind: 'number', value: numeric };
    }
    case 'field': {
      rejectUnknownKeys(expr, ['kind', 'field', 'lookback'], path, state.issues);
      const fields: NativeOhlcvField[] = ['open', 'high', 'low', 'close', 'volume'];
      if (typeof expr.field !== 'string' || !fields.includes(expr.field as NativeOhlcvField)) {
        state.issues.push({
          path: `${path}.field`,
          code: 'unsupported-field',
          message: `${path}.field must be one of ${fields.join(', ')}.`,
        });
        return null;
      }
      const lookback = checkInteger(
        expr.lookback,
        `${path}.lookback`,
        0,
        NATIVE_SCAN_LIMITS.maxLookback,
        state.issues,
      );
      if (lookback === null) return null;
      return { kind: 'field', field: expr.field as NativeOhlcvField, lookback };
    }
    case 'binary': {
      rejectUnknownKeys(expr, ['kind', 'op', 'left', 'right'], path, state.issues);
      const operators: NativeBinaryOperator[] = [
        'add', 'sub', 'mul', 'div',
        'gt', 'gte', 'lt', 'lte', 'eq', 'neq',
        'and', 'or',
      ];
      if (typeof expr.op !== 'string' || !operators.includes(expr.op as NativeBinaryOperator)) {
        state.issues.push({
          path: `${path}.op`,
          code: 'unsupported-operator',
          message: `${path}.op must be one of ${operators.join(', ')}.`,
        });
        return null;
      }
      const left = walkExpr(expr.left, `${path}.left`, depth + 1, state);
      const right = walkExpr(expr.right, `${path}.right`, depth + 1, state);
      if (!left || !right) return null;
      return { kind: 'binary', op: expr.op as NativeBinaryOperator, left, right };
    }
    case 'indicator': {
      rejectUnknownKeys(expr, ['kind', 'name', 'period', 'input'], path, state.issues);
      const names: NativeIndicatorName[] = ['sma', 'ema', 'rsi', 'atr', 'volumeSma'];
      if (typeof expr.name !== 'string' || !names.includes(expr.name as NativeIndicatorName)) {
        state.issues.push({
          path: `${path}.name`,
          code: 'unsupported-indicator',
          message: `${path}.name must be one of ${names.join(', ')}.`,
        });
        return null;
      }
      const period = checkInteger(
        expr.period,
        `${path}.period`,
        2,
        NATIVE_SCAN_LIMITS.maxIndicatorPeriod,
        state.issues,
      );
      if (period === null) return null;
      const name = expr.name as NativeIndicatorName;
      // ATR consumes whole bars; volumeSma consumes volume. Only sma/ema/rsi take input.
      const acceptsInput = name === 'sma' || name === 'ema' || name === 'rsi';
      if (expr.input !== undefined && !acceptsInput) {
        state.issues.push({
          path: `${path}.input`,
          code: 'unsupported-input',
          message: `${path}.input is not supported for the ${name} indicator.`,
        });
        return null;
      }
      const input = acceptsInput && expr.input !== undefined
        ? walkExpr(expr.input, `${path}.input`, depth + 1, state)
        : undefined;
      if (acceptsInput && expr.input !== undefined && !input) return null;
      return input
        ? { kind: 'indicator', name, period, input }
        : { kind: 'indicator', name, period };
    }
    case 'crossover':
    case 'crossunder': {
      rejectUnknownKeys(expr, ['kind', 'left', 'right'], path, state.issues);
      const left = walkExpr(expr.left, `${path}.left`, depth + 1, state);
      const right = walkExpr(expr.right, `${path}.right`, depth + 1, state);
      if (!left || !right) return null;
      return { kind: expr.kind, left, right };
    }
    case 'pattern': {
      rejectUnknownKeys(expr, ['kind', 'id'], path, state.issues);
      if (
        typeof expr.id !== 'string' ||
        !(NATIVE_SUPPORTED_PATTERN_IDS as readonly string[]).includes(expr.id)
      ) {
        state.issues.push({
          path: `${path}.id`,
          code: 'unsupported-pattern',
          message: `${path}.id must be one of ${NATIVE_SUPPORTED_PATTERN_IDS.join(', ')}; other patterns stay on the TypeScript path.`,
        });
        return null;
      }
      return { kind: 'pattern', id: expr.id as NativeSupportedPatternId };
    }
    default:
      state.issues.push({
        path: `${path}.kind`,
        code: 'unsupported-node',
        message: `${path} has unsupported AST node kind "${String(expr.kind)}".`,
      });
      return null;
  }
}

/**
 * Validates an untrusted value as a `NativeScanRequestV1`.
 *
 * Rejects unknown fields, non-finite numbers, oversized/deep ASTs, unsupported
 * pattern ids, negative lookbacks and malformed dates *before* any scan work.
 */
export function validateNativeScanRequestV1(value: unknown): NativeScanValidationResult {
  const issues: NativeScanValidationIssue[] = [];
  const root = requireObject(value, 'request', issues);
  if (!root) return { ok: false, issues };

  rejectUnknownKeys(
    root,
    ['schemaVersion', 'requestedRunId', 'universe', 'evaluation', 'rules'],
    'request',
    issues,
  );

  if (root.schemaVersion !== NATIVE_SCAN_SCHEMA_VERSION) {
    issues.push({
      path: 'request.schemaVersion',
      code: 'unsupported-schema',
      message: `request.schemaVersion must be ${NATIVE_SCAN_SCHEMA_VERSION}.`,
    });
  }

  const requestedRunId = checkIdentifier(root.requestedRunId, 'request.requestedRunId', issues);

  // -- universe -------------------------------------------------------------
  const universeValue = requireObject(root.universe, 'request.universe', issues);
  let universe: NativeScanUniverseV1 | null = null;
  if (universeValue) {
    const source = universeValue.source;
    if (source === 'explicitTargets') {
      rejectUnknownKeys(universeValue, ['source', 'targets'], 'request.universe', issues);
      const rawTargets = universeValue.targets;
      if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
        issues.push({
          path: 'request.universe.targets',
          code: 'missing-targets',
          message: 'request.universe.targets must be a non-empty array for explicitTargets.',
        });
      } else if (rawTargets.length > NATIVE_SCAN_LIMITS.maxExplicitTargets) {
        issues.push({
          path: 'request.universe.targets',
          code: 'too-many-targets',
          message: `request.universe.targets must contain at most ${NATIVE_SCAN_LIMITS.maxExplicitTargets} entries.`,
        });
      } else {
        const seen = new Set<string>();
        const targets: Array<{ exchange: string; symbol: string }> = [];
        rawTargets.forEach((entry, index) => {
          const path = `request.universe.targets[${index}]`;
          const target = requireObject(entry, path, issues);
          if (!target) return;
          rejectUnknownKeys(target, ['exchange', 'symbol'], path, issues);
          const exchange = checkIdentifier(target.exchange, `${path}.exchange`, issues);
          const symbol = checkIdentifier(target.symbol, `${path}.symbol`, issues);
          if (!exchange || !symbol) return;
          const key = `${exchange.toUpperCase()}:${symbol.toUpperCase()}`;
          if (seen.has(key)) {
            issues.push({
              path,
              code: 'duplicate-target',
              message: `${path} duplicates ${exchange}:${symbol}.`,
            });
            return;
          }
          seen.add(key);
          targets.push({ exchange, symbol });
        });
        if (targets.length > 0) universe = { source: 'explicitTargets', targets };
      }
    } else if (source === 'activeNseEq' || source === 'activeBse') {
      rejectUnknownKeys(universeValue, ['source'], 'request.universe', issues);
      universe = { source };
    } else {
      issues.push({
        path: 'request.universe.source',
        code: 'unsupported-universe',
        message: 'request.universe.source must be explicitTargets, activeNseEq or activeBse.',
      });
    }
  }

  // -- evaluation -----------------------------------------------------------
  const evaluationValue = requireObject(root.evaluation, 'request.evaluation', issues);
  let evaluation: NativeScanEvaluationV1 | null = null;
  if (evaluationValue) {
    rejectUnknownKeys(
      evaluationValue,
      [
        'asOfDate',
        'lookbackBars',
        'evaluateHistory',
        'priceBasis',
        'includeDividendAdjustments',
        'includeRightsAdjustments',
      ],
      'request.evaluation',
      issues,
    );
    const rawAsOf = evaluationValue.asOfDate;
    const asOfDate = rawAsOf === undefined || rawAsOf === null
      ? null
      : checkIsoDate(rawAsOf, 'request.evaluation.asOfDate', issues);
    const rawLookback = evaluationValue.lookbackBars;
    const lookbackBars = rawLookback === undefined || rawLookback === null
      ? null
      : checkInteger(
          rawLookback,
          'request.evaluation.lookbackBars',
          1,
          NATIVE_SCAN_LIMITS.maxLookbackBars,
          issues,
        );
    if (typeof evaluationValue.evaluateHistory !== 'boolean') {
      issues.push({
        path: 'request.evaluation.evaluateHistory',
        code: 'not-a-boolean',
        message: 'request.evaluation.evaluateHistory must be a boolean.',
      });
    }
    const priceBasis = evaluationValue.priceBasis;
    if (priceBasis !== 'raw' && priceBasis !== 'adjusted') {
      issues.push({
        path: 'request.evaluation.priceBasis',
        code: 'unsupported-price-basis',
        message: 'request.evaluation.priceBasis must be "raw" or "adjusted".',
      });
    }
    for (const flag of ['includeDividendAdjustments', 'includeRightsAdjustments'] as const) {
      const raw = evaluationValue[flag];
      if (raw !== undefined && typeof raw !== 'boolean') {
        issues.push({
          path: `request.evaluation.${flag}`,
          code: 'not-a-boolean',
          message: `request.evaluation.${flag} must be a boolean when present.`,
        });
      }
    }
    const includeDividend = evaluationValue.includeDividendAdjustments === true;
    const includeRights = evaluationValue.includeRightsAdjustments === true;
    if (priceBasis === 'raw' && (includeDividend || includeRights)) {
      issues.push({
        path: 'request.evaluation.priceBasis',
        code: 'basis-flag-conflict',
        message: 'Dividend/rights adjustments require priceBasis "adjusted".',
      });
    }
    if (
      asOfDate !== undefined &&
      typeof evaluationValue.evaluateHistory === 'boolean' &&
      (priceBasis === 'raw' || priceBasis === 'adjusted')
    ) {
      evaluation = {
        asOfDate,
        lookbackBars,
        evaluateHistory: evaluationValue.evaluateHistory,
        priceBasis,
        ...(includeDividend ? { includeDividendAdjustments: true } : {}),
        ...(includeRights ? { includeRightsAdjustments: true } : {}),
      };
    }
  }

  // -- rules ----------------------------------------------------------------
  const rawRules = root.rules;
  let rules: NativeScanRuleV1[] | null = null;
  if (!Array.isArray(rawRules) || rawRules.length === 0) {
    issues.push({
      path: 'request.rules',
      code: 'missing-rules',
      message: 'request.rules must be a non-empty array.',
    });
  } else if (rawRules.length > NATIVE_SCAN_LIMITS.maxRules) {
    issues.push({
      path: 'request.rules',
      code: 'too-many-rules',
      message: `request.rules must contain at most ${NATIVE_SCAN_LIMITS.maxRules} entries.`,
    });
  } else {
    const state: AstWalkState = { nodes: 0, issues };
    const seenRuleIds = new Set<string>();
    const parsedRules: NativeScanRuleV1[] = [];
    rawRules.forEach((entry, index) => {
      const path = `request.rules[${index}]`;
      const rule = requireObject(entry, path, issues);
      if (!rule) return;
      rejectUnknownKeys(rule, ['id', 'expression'], path, issues);
      const id = checkIdentifier(rule.id, `${path}.id`, issues);
      if (id === null) return;
      if (seenRuleIds.has(id)) {
        issues.push({ path: `${path}.id`, code: 'duplicate-rule', message: `${path}.id "${id}" is duplicated.` });
        return;
      }
      seenRuleIds.add(id);
      const expression = walkExpr(rule.expression, `${path}.expression`, 1, state);
      if (!expression) return;
      parsedRules.push({ id, expression });
    });
    if (parsedRules.length === rawRules.length) rules = parsedRules;
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: {
      schemaVersion: NATIVE_SCAN_SCHEMA_VERSION,
      requestedRunId: requestedRunId!,
      universe: universe!,
      evaluation: evaluation!,
      rules: rules!,
    },
  };
}

/** Capabilities the UI negotiates before offering the native backend. */
export function createNativeScannerCapabilitiesV1(
  workerCount = 0,
): NativeScannerCapabilitiesV1 {
  return {
    contractVersion: NATIVE_SCAN_CONTRACT_VERSION,
    schemaVersion: NATIVE_SCAN_SCHEMA_VERSION,
    defaultEnabled: false,
    workerCount,
    supportedPatternIds: [...NATIVE_SUPPORTED_PATTERN_IDS],
    supportedIndicatorNames: ['sma', 'ema', 'rsi', 'atr', 'volumeSma'],
    supportedUniverseSources: ['explicitTargets', 'activeNseEq', 'activeBse'],
    maxLimits: NATIVE_SCAN_LIMITS,
  };
}

/**
 * Splits a requested scanner-id list into the native-supported subset and the rest.
 * The remainder must stay on the TypeScript path; it is never mapped to "nothing".
 */
export function splitNativeSupportedScannerIds(scannerIds: readonly string[]): {
  native: string[];
  remaining: string[];
} {
  const supported = new Set<string>(NATIVE_SUPPORTED_PATTERN_IDS);
  const native: string[] = [];
  const remaining: string[] = [];
  for (const id of scannerIds) {
    if (supported.has(id)) native.push(id);
    else remaining.push(id);
  }
  return { native, remaining };
}

/**
 * A rule expression is "pure math" when it contains no `pattern` node, so it is
 * independent of the chart-pattern worker and can be compiled by the TS AST compiler.
 */
export function isPureMathNativeExpression(expression: NativeExprV1): boolean {
  switch (expression.kind) {
    case 'number':
    case 'field':
      return true;
    case 'binary':
      return (
        isPureMathNativeExpression(expression.left) &&
        isPureMathNativeExpression(expression.right)
      );
    case 'indicator':
      return expression.input === undefined || isPureMathNativeExpression(expression.input);
    case 'crossover':
    case 'crossunder':
      return (
        isPureMathNativeExpression(expression.left) &&
        isPureMathNativeExpression(expression.right)
      );
    case 'pattern':
      return false;
  }
}

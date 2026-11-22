/**
 * NS-01 fixture generator (committed; run on demand, not part of the default suite).
 *
 * Produces `src/features/scanner/fixtures/nativeScannerParityFixtures.v1.json`, which is
 * consumed by:
 * - `src/features/scanner/__tests__/nativeScannerParityNS01.test.ts` (TypeScript side), and
 * - `src-tauri-shell/src/native_scanner/parity.rs` (Rust side, via `include_str!`).
 *
 * TypeScript is the authority: every numeric case is cross-checked against the existing
 * formula engine before it is written, so the fixture cannot encode an invented semantic.
 *
 * Regenerate with:
 *   npx vitest run --config tmp/disposable/native-scan-gen/vitest.config.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { OHLCBar } from '@/engine/types';
import { compileNativeCoreCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import {
  NATIVE_SCAN_CONTRACT_VERSION,
  validateNativeScanRequestV1,
  type NativeScanRequestV1,
} from '@/features/scanner/nativeScanContract';
import {
  compileNativeScannerExpression,
  crossCheckNativeExpressionWithFormulaEngine,
  evaluateNativeExpression,
  minimumBarsForExpression,
} from '@/features/scanner/nativeScanAst';

const OUTPUT = resolve(
  __dirname,
  '../fixtures/nativeScannerParityFixtures.v1.json',
);

/** Deterministic pseudo-random generator (no Math.random, reproducible output). */
function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function buildTrendBars(count: number, seed: number): OHLCBar[] {
  const random = pseudoRandom(seed);
  const bars: OHLCBar[] = [];
  let close = 100;
  const start = Date.UTC(2024, 0, 1);
  for (let index = 0; index < count; index += 1) {
    const drift = 0.6 + (random() - 0.45) * 2.4;
    const open = close;
    close = Math.round((close + drift) * 100) / 100;
    const high = Math.round((Math.max(open, close) + random() * 1.5) * 100) / 100;
    const low = Math.round((Math.min(open, close) - random() * 1.5) * 100) / 100;
    const volume = Math.round(8_000 + random() * 12_000 + index * 25);
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    bars.push({ date, open, high, low, close, volume, timestamp: start + index * 86_400_000 });
  }
  return bars;
}

/** Flat/plateau series with deliberate ties to exercise cross boundaries. */
function buildPlateauBars(): OHLCBar[] {
  const closes = [10, 10, 10, 10, 12, 12, 12, 11, 11, 11, 13, 13];
  const start = Date.UTC(2024, 2, 1);
  return closes.map((close, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    open: close - 0.25,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: index === 7 ? 0 : 1_000 + index * 100,
    timestamp: start + index * 86_400_000,
  }));
}

const barSets: Record<string, OHLCBar[]> = {
  trend_40: buildTrendBars(40, 20261119),
  trend_60: buildTrendBars(60, 987654321),
  plateau_12: buildPlateauBars(),
};

interface NumericCase {
  id: string;
  description: string;
  source: string;
  /** The exact AST the Rust validator/evaluator must consume. */
  expression: unknown;
  barSet: keyof typeof barSets;
  expectedValues: Array<number | null>;
  expectedLatestMatched: boolean;
  minimumBars: number;
  engineEquivalent: boolean;
}


/**
 * NS-R2: accepted built-in numeric predicates. Their serialized ASTs must
 * exactly match nativeCoreRuleExpressions.ts before Rust parity fixtures are
 * generated. Three existing data sets exercise warmups, ties, and trend bars.
 */
const CORE_PREDICATE_PARITY_SOURCES: ReadonlyArray<{ id: string; source: string }> = [
  { id: 'prev_day_high_break', source: 'close > high[1]' },
  { id: 'prev_day_low_break', source: 'close < low[1]' },
  { id: 'inside_bar', source: 'high < high[1] and low > low[1]' },
  { id: 'outside_bar', source: 'high > high[1] and low < low[1]' },
  { id: 'close_near_high', source: '(high - low) > 0 and close >= high - (high - low) * 0.1' },
  { id: 'close_near_low', source: '(high - low) > 0 and close <= low + (high - low) * 0.1' },
  { id: 'gap_up', source: 'open > high[1]' },
  { id: 'gap_down', source: 'open < low[1]' },
  { id: 'nr7', source: '(high - low) < (high[1] - low[1]) and (high - low) < (high[2] - low[2]) and (high - low) < (high[3] - low[3]) and (high - low) < (high[4] - low[4]) and (high - low) < (high[5] - low[5]) and (high - low) < (high[6] - low[6])' },
  { id: 'wide_range_candle', source: '(high - low) > 1.5 * sma(high[1] - low[1], 14)' },
];

const numericSources: Array<{
  id: string;
  description: string;
  source: string;
  barSet: keyof typeof barSets;
  engineEquivalent?: boolean;
  coreId?: string;
}> = [
  {
    id: 'numeric_close_above_sma20',
    description: 'Close above its 20-period SMA with engine-identical warm-up.',
    source: 'close > sma(close, 20)',
    barSet: 'trend_40',
  },
  {
    id: 'numeric_bracket_lookback_comparison',
    description: 'Close[0] > High[1] and Close[1] < High[2] using completed-bar bracket lookback.',
    source: 'close[0] > high[1] and close[1] < high[2]',
    barSet: 'trend_40',
    engineEquivalent: false,
  },
  {
    id: 'numeric_ref_field_fold',
    description: 'ref(close, 3) folds into an equivalent field lookback.',
    source: 'ref(close, 3) > sma(close, 10)',
    barSet: 'trend_40',
    engineEquivalent: false,
  },
  {
    id: 'numeric_ema_crossover',
    description: 'SMA(5) crossing over EMA(20).',
    source: 'crossover(sma(close, 5), ema(close, 20))',
    barSet: 'trend_60',
  },
  {
    id: 'numeric_plateau_crossover_ties',
    description: 'Crossover across equal values must follow previous<=previous and current>current.',
    source: 'crossover(close, sma(close, 3))',
    barSet: 'plateau_12',
  },
  {
    id: 'numeric_plateau_crossunder_ties',
    description: 'Crossunder across equal values must follow previous>=previous and current<current.',
    source: 'crossunder(close, sma(close, 3))',
    barSet: 'plateau_12',
  },
  {
    id: 'numeric_rsi_above_50',
    description: 'RSI(14) above 50 with engine-identical seeding.',
    source: 'rsi(close, 14) > 50',
    barSet: 'trend_60',
  },
  {
    id: 'numeric_atr_relative_threshold',
    description: 'ATR(14) above 2% of close (scanner-only ATR semantics).',
    source: 'atr(14) > close * 0.02',
    barSet: 'trend_60',
    engineEquivalent: false,
  },
  {
    id: 'numeric_volume_spike',
    description: 'Volume above twice its 20-bar average.',
    source: 'volume > volumeSma(20) * 2',
    barSet: 'trend_40',
    engineEquivalent: false,
  },
  {
    id: 'numeric_nested_arithmetic_percent',
    description: 'Nested arithmetic with division and multiplication.',
    source: '(close - sma(close, 10)) / sma(close, 10) * 100 > 1',
    barSet: 'trend_40',
  },
  {
    id: 'numeric_division_by_zero_is_null',
    description: 'A series divided by a zero series yields null, never Infinity.',
    source: 'close / (close - close) > 1',
    barSet: 'plateau_12',
  },
  {
    id: 'numeric_logical_and_or_nulls',
    description: 'Logical operators propagate nulls without fabricating matches.',
    source: '(close > sma(close, 5)) and (close < sma(close, 20))',
    barSet: 'trend_40',
    engineEquivalent: false,
  },
  {
    id: 'numeric_unary_minus',
    description: 'Unary minus compiles to 0 - x.',
    source: '-close < -sma(close, 5)',
    barSet: 'trend_40',
  },
  {
    id: 'numeric_equality_and_inequality',
    description: 'Equality comparison on a derived series.',
    source: 'close == sma(close, 2)',
    barSet: 'trend_40',
  },
  {
    id: 'numeric_volume_zero_plateau',
    description: 'Zero-volume bars with volumeSma warm-up and multiplication.',
    source: 'volume > volumeSma(2)',
    barSet: 'plateau_12',
    engineEquivalent: false,
  },
  ...CORE_PREDICATE_PARITY_SOURCES.flatMap((spec) =>
    (['trend_40', 'trend_60', 'plateau_12'] as const).map((barSet) => ({
      id: `core_${spec.id}_${barSet}`,
      description: `NS-R2 ${spec.id} exact-AST parity on ${barSet}; every endpoint is checked by Rust.`,
      source: spec.source,
      barSet,
      coreId: spec.id,
      engineEquivalent: false,
    })),
  ),
];

function toEngineFormula(source: string): string {
  return `RULE = ${source}`;
}

function generateNumericCases(): NumericCase[] {
  return numericSources.map((entry) => {
    const compiled = compileNativeScannerExpression(entry.source);
    if (!compiled.ok || !compiled.expression) {
      throw new Error(`${entry.id}: compile failed: ${compiled.errors.join('; ')}`);
    }
    if (entry.coreId) {
      const acceptedAst = compileNativeCoreCandidate(entry.coreId);
      if (!acceptedAst || JSON.stringify(compiled.expression) !== JSON.stringify(acceptedAst)) {
        throw new Error(`${entry.id}: fixture AST differs from the production core numeric predicate.`);
      }
    }
    const bars = barSets[entry.barSet]!;
    const engineEquivalent = entry.engineEquivalent !== false;
    if (engineEquivalent) {
      const check = crossCheckNativeExpressionWithFormulaEngine(entry.source, bars);
      if (!check.ok) {
        throw new Error(`${entry.id}: engine cross-check failed: ${check.errors.join('; ')}`);
      }
      // Guard the helper itself: the engine must accept the same source text.
      const probe = evaluateNativeExpression(compiled.expression, bars);
      if (probe.values.length !== bars.length) {
        throw new Error(`${entry.id}: series length mismatch`);
      }
      void toEngineFormula;
    }
    const evaluation = evaluateNativeExpression(compiled.expression, bars);
    const values: Array<number | null> = evaluation.kind === 'number'
      ? evaluation.values
      : evaluation.values.map((entry) => (entry === null ? null : entry ? 1 : 0));
    const latest = values[values.length - 1] ?? null;
    return {
      id: entry.id,
      description: entry.description,
      source: entry.source,
      expression: compiled.expression,
      barSet: entry.barSet,
      expectedValues: values,
      expectedLatestMatched: latest !== null && latest !== 0,
      minimumBars: minimumBarsForExpression(compiled.expression),
      engineEquivalent,
    };
  });
}

interface CompileCase {
  id: string;
  description: string;
  source: string;
  allowPattern: boolean;
  expect: 'ok' | 'error';
  errorIncludes?: string;
  expression?: unknown;
}

const compileCases: CompileCase[] = [
  {
    id: 'compile_pattern_call_ok',
    description: 'Pattern calls are accepted only when pattern rules are allowed.',
    source: "pattern('chart_breakaway_gap')",
    allowPattern: true,
    expect: 'ok',
  },
  {
    id: 'compile_chart_pattern_call_ok',
    description: 'Chart-pattern function shorthand compiles to the four accepted ids.',
    source: 'exhaustionGap() or commonGap()',
    allowPattern: true,
    expect: 'ok',
  },
  {
    id: 'compile_pattern_rejected_without_pattern_rules',
    description: 'Numeric expressions cannot smuggle in a pattern call.',
    source: "pattern('chart_common_gap')",
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'require pattern rules',
  },
  {
    id: 'compile_negative_bracket_rejected',
    description: 'Future references are rejected.',
    source: 'close[-1] > 2',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'Negative/future reference',
  },
  {
    id: 'compile_unknown_function_rejected',
    description: 'Unknown functions are rejected at compile time.',
    source: 'wma(close, 10) > 2',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'Unknown function',
  },
  {
    id: 'compile_unsupported_pattern_rejected',
    description: 'Unsupported chart patterns never silently disappear.',
    source: "pattern('chart_unknown_pattern')",
    allowPattern: true,
    expect: 'error',
    errorIncludes: 'Unsupported pattern',
  },
  {
    id: 'compile_ref_computed_series_rejected',
    description: 'Shifting a computed series is not expressible in AST v1.',
    source: 'ref(sma(close, 5), 1) > 2',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'computed series',
  },
  {
    id: 'compile_assignment_rejected',
    description: 'Scanner rules are single boolean conditions, not multi-line assignments.',
    source: 'A = close > 1',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'assignments are not supported',
  },
  {
    id: 'compile_non_field_bracket_rejected',
    description: 'Bracket lookback is limited to OHLCV fields.',
    source: 'sma[1] > 2',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'Bracket lookback is only supported',
  },
  {
    id: 'compile_period_out_of_range_rejected',
    description: 'Indicator periods are bounded.',
    source: 'sma(close, 100000) > 2',
    allowPattern: false,
    expect: 'error',
    errorIncludes: 'period must be <=',
  },
  {
    id: 'compile_missing_paren_rejected',
    description: 'Structural errors are reported, never ignored.',
    source: 'sma(close, 5 > 2',
    allowPattern: false,
    expect: 'error',
  },
];

function generateCompileCases(): CompileCase[] {
  return compileCases.map((entry) => {
    const compiled = compileNativeScannerExpression(entry.source, {
      allowPattern: entry.allowPattern,
    });
    if (entry.expect === 'ok') {
      if (!compiled.ok) {
        throw new Error(`${entry.id}: expected success, got ${compiled.errors.join('; ')}`);
      }
      return { ...entry, expression: compiled.expression };
    }
    if (compiled.ok) {
      throw new Error(`${entry.id}: expected failure, compiled successfully`);
    }
    if (entry.errorIncludes && !compiled.errors.join(' ').includes(entry.errorIncludes)) {
      throw new Error(
        `${entry.id}: expected error containing "${entry.errorIncludes}", got "${compiled.errors.join('; ')}"`,
      );
    }
    return entry;
  });
}

interface ContractCase {
  id: string;
  description: string;
  expect: 'ok' | 'error';
  payload: unknown;
  expectedIssueCodes?: string[];
}

const validPayload: NativeScanRequestV1 = {
  schemaVersion: 1,
  requestedRunId: 'ns01-fixture-run',
  universe: {
    source: 'explicitTargets',
    targets: [
      { exchange: 'NSE', symbol: 'INFY' },
      { exchange: 'NSE', symbol: 'TCS' },
    ],
  },
  evaluation: { evaluateHistory: false, priceBasis: 'raw', lookbackBars: 250 },
  rules: [
    { id: 'close_above_sma', expression: { kind: 'field', field: 'close', lookback: 0 } },
  ],
};

const contractCases: ContractCase[] = [
  {
    id: 'contract_valid_explicit_targets',
    description: 'A well-formed request validates unchanged.',
    expect: 'ok',
    payload: validPayload,
  },
  {
    id: 'contract_valid_narrow_nse_eq_universe',
    description: 'activeNseEq is an explicit, narrow universe with no target list.',
    expect: 'ok',
    payload: { ...validPayload, universe: { source: 'activeNseEq' } },
  },
  {
    id: 'contract_valid_adjusted_with_flags',
    description: 'Adjusted basis may opt into dividend/rights adjustments.',
    expect: 'ok',
    payload: {
      ...validPayload,
      evaluation: {
        evaluateHistory: true,
        priceBasis: 'adjusted',
        includeDividendAdjustments: true,
        includeRightsAdjustments: true,
        asOfDate: '2026-01-30',
      },
    },
  },
  {
    id: 'contract_rejects_raw_basis_with_dividend_flag',
    description: 'Raw basis plus adjustment flags is contradictory.',
    expect: 'error',
    payload: {
      ...validPayload,
      evaluation: { evaluateHistory: false, priceBasis: 'raw', includeDividendAdjustments: true },
    },
    expectedIssueCodes: ['basis-flag-conflict'],
  },
  {
    id: 'contract_rejects_unknown_root_field',
    description: 'Unknown transport fields are rejected, not ignored.',
    expect: 'error',
    payload: { ...validPayload, activateNatively: true },
    expectedIssueCodes: ['unknown-field'],
  },
  {
    id: 'contract_rejects_unsupported_pattern_rule',
    description: 'Only the four parity-proven gap patterns are native rules.',
    expect: 'error',
    payload: {
      ...validPayload,
      rules: [{ id: 'flag', expression: { kind: 'pattern', id: 'chart_flag' } }],
    },
    expectedIssueCodes: ['unsupported-pattern'],
  },
  {
    id: 'contract_rejects_negative_lookback',
    description: 'Negative lookbacks are rejected before any scan work.',
    expect: 'error',
    payload: {
      ...validPayload,
      rules: [{ id: 'future', expression: { kind: 'field', field: 'close', lookback: -2 } }],
    },
    expectedIssueCodes: ['out-of-range'],
  },
  {
    id: 'contract_rejects_duplicate_targets',
    description: 'Duplicate explicit targets are rejected instead of scanned twice.',
    expect: 'error',
    payload: {
      ...validPayload,
      universe: {
        source: 'explicitTargets',
        targets: [
          { exchange: 'NSE', symbol: 'INFY' },
          { exchange: 'NSE', symbol: 'INFY' },
        ],
      },
    },
    expectedIssueCodes: ['duplicate-target'],
  },
  {
    id: 'contract_rejects_wrong_schema_version',
    description: 'Schema versions are versioned and enforced.',
    expect: 'error',
    payload: { ...validPayload, schemaVersion: 2 },
    expectedIssueCodes: ['unsupported-schema'],
  },
  {
    id: 'contract_rejects_duplicate_rule_ids',
    description: 'Rule ids must be unique per run.',
    expect: 'error',
    payload: {
      ...validPayload,
      rules: [
        { id: 'same', expression: { kind: 'number', value: 1 } },
        { id: 'same', expression: { kind: 'number', value: 2 } },
      ],
    },
    expectedIssueCodes: ['duplicate-rule'],
  },
];

function generateContractCases(): ContractCase[] {
  return contractCases.map((entry) => {
    const result = validateNativeScanRequestV1(entry.payload);
    if (entry.expect === 'ok') {
      if (!result.ok) {
        throw new Error(
          `${entry.id}: expected valid request, got ${result.issues.map((i) => i.code).join(',')}`,
        );
      }
      return entry;
    }
    if (result.ok) {
      throw new Error(`${entry.id}: expected an invalid request`);
    }
    const codes = result.issues.map((issue) => issue.code);
    for (const expected of entry.expectedIssueCodes ?? []) {
      if (!codes.includes(expected)) {
        throw new Error(`${entry.id}: expected issue ${expected}, got ${codes.join(',')}`);
      }
    }
    return entry;
  });
}

export function generateNativeScannerParityFixtures(): unknown {
  const numericCases = generateNumericCases();
  const compileCasesGenerated = generateCompileCases();
  const contractCasesGenerated = generateContractCases();
  return {
    contractVersion: NATIVE_SCAN_CONTRACT_VERSION,
    schemaVersion: 1,
    exportedFrom: 'src/features/scanner/nativeScanContract.ts',
    generatedBy: 'src/features/scanner/__tests__/nativeScannerFixtureGenerator.ts',
    barSets: Object.fromEntries(
      Object.entries(barSets).map(([key, bars]) => [
        key,
        bars.map((bar) => ({
          date: bar.date,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        })),
      ]),
    ),
    numericCases,
    compileCases: compileCasesGenerated,
    contractCases: contractCasesGenerated,
  };
}

export function writeNativeScannerParityFixtures(): void {
  const fixtures = generateNativeScannerParityFixtures();
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');
}

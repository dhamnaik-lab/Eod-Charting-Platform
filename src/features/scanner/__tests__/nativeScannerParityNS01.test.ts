import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OHLCBar } from '@/engine/types';
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import {
  NATIVE_SCAN_CONTRACT_VERSION,
  NATIVE_SUPPORTED_PATTERN_IDS,
  NATIVE_SCAN_LIMITS,
  createNativeScannerCapabilitiesV1,
  isPureMathNativeExpression,
  splitNativeSupportedScannerIds,
  validateNativeScanRequestV1,
  type NativeExprV1,
} from '@/features/scanner/nativeScanContract';
import {
  compileNativeScannerExpression,
  containsPattern,
  crossCheckNativeExpressionWithFormulaEngine,
  evaluateNativeExpression,
  evaluateNativeRuleLatest,
  minimumBarsForExpression,
  serializeNativeExpression,
} from '@/features/scanner/nativeScanAst';
import { generateNativeScannerParityFixtures } from './nativeScannerFixtureGenerator';

const FIXTURE_PATH = resolve(__dirname, '../fixtures/nativeScannerParityFixtures.v1.json');

interface FixtureBundle {
  contractVersion: string;
  barSets: Record<
    string,
    Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
  >;
  numericCases: Array<{
    id: string;
    description: string;
    source: string;
    barSet: string;
    expectedValues: Array<number | null>;
    expectedLatestMatched: boolean;
    minimumBars: number;
    engineEquivalent: boolean;
  }>;
  compileCases: Array<{
    id: string;
    description: string;
    source: string;
    allowPattern: boolean;
    expect: 'ok' | 'error';
    errorIncludes?: string;
    expression?: unknown;
  }>;
  contractCases: Array<{
    id: string;
    description: string;
    expect: 'ok' | 'error';
    payload: unknown;
    expectedIssueCodes?: string[];
  }>;
}

function loadFixture(): FixtureBundle {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(FIXTURE_PATH) as FixtureBundle;
}

function toBars(
  bars: FixtureBundle['barSets'][string],
): OHLCBar[] {
  return bars.map((bar) => ({ ...bar, timestamp: new Date(bar.date).getTime() }));
}

describe('NS-01 native scanner transport contract', () => {
  it('exports a versioned, opt-out-of-by-default capability descriptor', () => {
    const capabilities = createNativeScannerCapabilitiesV1(3);
    expect(capabilities.contractVersion).toBe(NATIVE_SCAN_CONTRACT_VERSION);
    expect(capabilities.schemaVersion).toBe(1);
    expect(capabilities.defaultEnabled).toBe(false);
    expect(capabilities.workerCount).toBe(3);
    expect(capabilities.supportedPatternIds).toEqual([...NATIVE_SUPPORTED_PATTERN_IDS]);
    expect(capabilities.supportedPatternIds).toHaveLength(54);
    expect(capabilities.supportedIndicatorNames).toEqual(['sma', 'ema', 'rsi', 'atr', 'volumeSma']);
    expect(capabilities.supportedUniverseSources).toEqual([
      'explicitTargets',
      'activeNseEq',
      'activeBse',
    ]);
    expect(capabilities.maxLimits).toEqual(NATIVE_SCAN_LIMITS);
  });

  it('splits supported and unsupported scanners without dropping the remainder', () => {
    const split = splitNativeSupportedScannerIds([
      'chart_breakaway_gap',
      'core_volume_spike',
      'chart_exhaustion_gap',
      'plugin_custom',
    ]);
    expect(split.native).toEqual(['chart_breakaway_gap', 'chart_exhaustion_gap']);
    expect(split.remaining).toEqual(['core_volume_spike', 'plugin_custom']);
    expect([...split.native, ...split.remaining]).toHaveLength(4);
  });

  it('recognises pure-math versus pattern expressions', () => {
    expect(
      isPureMathNativeExpression({
        kind: 'binary',
        op: 'gt',
        left: { kind: 'field', field: 'close', lookback: 0 },
        right: { kind: 'number', value: 1 },
      }),
    ).toBe(true);
    expect(
      isPureMathNativeExpression({
        kind: 'pattern',
        id: 'chart_common_gap',
      } satisfies NativeExprV1),
    ).toBe(false);
  });
});

describe('NS-01 committed parity fixtures', () => {
  it('has a committed fixture file that matches the generator output', () => {
    expect(existsSync(FIXTURE_PATH), `missing fixture bundle at ${FIXTURE_PATH}`).toBe(true);
    const committed = loadFixture();
    const regenerated = generateNativeScannerParityFixtures() as FixtureBundle;
    expect(committed.contractVersion).toBe(NATIVE_SCAN_CONTRACT_VERSION);
    expect(committed.numericCases).toEqual(regenerated.numericCases);
    expect(committed.contractCases).toEqual(regenerated.contractCases);
    expect(committed.compileCases).toEqual(regenerated.compileCases);
    expect(committed.barSets).toEqual(regenerated.barSets);
  });

  it('has exact-AST Rust/TypeScript endpoint fixtures for all ten core rules on three series', () => {
    const bundle = loadFixture();
    const cases = new Set(bundle.numericCases.map((entry) => entry.id));
    for (const definition of coreOhlcvScannerDefinitions) {
      for (const series of ['trend_40', 'trend_60', 'plateau_12']) {
        expect(cases.has(`core_${definition.id}_${series}`)).toBe(true);
      }
    }
    expect(coreOhlcvScannerDefinitions).toHaveLength(10);
  });

  it('covers the required numeric, compile and contract scenarios', () => {
    const bundle = loadFixture();
    expect(bundle.numericCases.length).toBeGreaterThanOrEqual(12);
    expect(bundle.compileCases.length).toBeGreaterThanOrEqual(10);
    expect(bundle.contractCases.length).toBeGreaterThanOrEqual(10);
    const ids = new Set([
      ...bundle.numericCases.map((entry) => entry.id),
      ...bundle.compileCases.map((entry) => entry.id),
      ...bundle.contractCases.map((entry) => entry.id),
    ]);
    expect(ids.size).toBe(
      bundle.numericCases.length + bundle.compileCases.length + bundle.contractCases.length,
    );
    for (const entry of bundle.numericCases) {
      expect(entry.description.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.expectedValues).toHaveLength(bundle.barSets[entry.barSet]!.length);
    }
  });
});

describe('NS-01 numeric AST evaluation parity', () => {
  const bundle = loadFixture();

  it.each(bundle.numericCases.map((entry) => [entry.id, entry] as const))(
    '%s reproduces the recorded values exactly',
    (_id, entry) => {
      // Compare the boolean/numeric view as numbers so recorded fixtures stay numeric.
      const compiled = compileNativeScannerExpression(entry.source);
      expect(compiled.ok, compiled.errors.join('; ')).toBe(true);
      const bars = toBars(bundle.barSets[entry.barSet]!);
      const evaluation = evaluateNativeExpression(compiled.expression!, bars);
      const values = evaluation.kind === 'number'
        ? evaluation.values
        : evaluation.values.map((flag) => (flag === null ? null : flag ? 1 : 0));
      expect(values).toEqual(entry.expectedValues);
      const latest = evaluateNativeRuleLatest(compiled.expression!, bars);
      expect(latest.matched).toBe(entry.expectedLatestMatched);
      expect(minimumBarsForExpression(compiled.expression!)).toBe(entry.minimumBars);
    },
  );

  it('cross-checks every engine-equivalent case against the existing formula engine', () => {
    const engineCases = bundle.numericCases.filter((entry) => entry.engineEquivalent);
    expect(engineCases.length).toBeGreaterThanOrEqual(8);
    for (const entry of engineCases) {
      const result = crossCheckNativeExpressionWithFormulaEngine(
        entry.source,
        toBars(bundle.barSets[entry.barSet]!),
      );
      expect(result.ok, `${entry.id}: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('reports boolean-only constructs as not engine cross-checkable', () => {
    const result = crossCheckNativeExpressionWithFormulaEngine(
      '(close > sma(close, 5)) and (close < sma(close, 20))',
      toBars(bundle.barSets.trend_40!),
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('scanner-only');
  });

  it('never fabricates a match from a null series value', () => {
    const compiled = compileNativeScannerExpression('sma(close, 40) > 0');
    expect(compiled.ok).toBe(true);
    const bars = toBars(bundle.barSets.trend_40!);
    const values = evaluateNativeExpression(compiled.expression!, bars).values;
    expect(values[0]).toBeNull();
    expect(evaluateNativeRuleLatest(compiled.expression!, bars).matched).toBe(true);
    // With fewer bars than the warm-up the latest bar is null, which is not a match.
    const shortBars = bars.slice(0, 10);
    expect(evaluateNativeRuleLatest(compiled.expression!, shortBars)).toEqual({
      matched: false,
      value: null,
    });
  });
});

describe('NS-01 scanner-only compiler', () => {
  const bundle = loadFixture();

  it.each(bundle.compileCases.map((entry) => [entry.id, entry] as const))(
    '%s matches the recorded outcome',
    (_id, entry) => {
      const compiled = compileNativeScannerExpression(entry.source, {
        allowPattern: entry.allowPattern,
      });
      if (entry.expect === 'ok') {
        expect(compiled.ok, compiled.errors.join('; ')).toBe(true);
        expect(compiled.expression).toEqual(entry.expression);
        expect(serializeNativeExpression(compiled.expression!)).toBe(
          JSON.stringify(entry.expression),
        );
      } else {
        expect(compiled.ok).toBe(false);
        if (entry.errorIncludes) {
          expect(compiled.errors.join(' ')).toContain(entry.errorIncludes);
        }
      }
    },
  );

  it('produces strict JSON that round-trips and contains no functions', () => {
    const compiled = compileNativeScannerExpression(
      'crossover(sma(close, 5), ema(close, 20)) or close[1] > high[2]',
    );
    expect(compiled.ok).toBe(true);
    const json = serializeNativeExpression(compiled.expression!);
    expect(JSON.parse(json)).toEqual(compiled.expression);
    expect(json).not.toContain('undefined');
    expect(containsPattern(compiled.expression!)).toBe(false);
  });

  it('rejects future and negative lookbacks with actionable text', () => {
    for (const source of ['close[-1] > 1', 'close[-100] > 1']) {
      const compiled = compileNativeScannerExpression(source);
      expect(compiled.ok).toBe(false);
      expect(compiled.errors.join(' ')).toContain('Negative/future');
    }
    const huge = compileNativeScannerExpression(`close[${NATIVE_SCAN_LIMITS.maxLookback + 1}] > 1`);
    expect(huge.ok).toBe(false);
    expect(huge.errors.join(' ')).toContain('exceeds the maximum lookback');
  });

  it('rejects invalid indexes, unknown identifiers and empty input', () => {
    for (const source of ['close[1.5] > 1', 'close[] > 1', 'notAField > 1', '', '   ']) {
      expect(compileNativeScannerExpression(source).ok, source).toBe(false);
    }
  });

  it('keeps all 54 built-in chart patterns addressable and rejects unknown pattern ids', () => {
    for (const id of NATIVE_SUPPORTED_PATTERN_IDS) {
      const compiled = compileNativeScannerExpression(`pattern('${id}')`, { allowPattern: true });
      expect(compiled.ok, id).toBe(true);
      expect(compiled.expression).toEqual({ kind: 'pattern', id });
    }
    const unsupported = compileNativeScannerExpression("pattern('chart_unknown_pattern')", {
      allowPattern: true,
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.errors.join(' ')).toContain('Unsupported pattern');
  });
});

describe('NS-01 request validation boundary', () => {
  const bundle = loadFixture();

  it.each(bundle.contractCases.map((entry) => [entry.id, entry] as const))(
    '%s matches the recorded validation outcome',
    (_id, entry) => {
      const result = validateNativeScanRequestV1(entry.payload);
      if (entry.expect === 'ok') {
        expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const codes = result.issues.map((issue) => issue.code);
          for (const expected of entry.expectedIssueCodes ?? []) {
            expect(codes, entry.id).toContain(expected);
          }
          expect(result.issues.every((issue) => issue.path.length > 0)).toBe(true);
        }
      }
    },
  );

  it('rejects non-object payloads and null without throwing', () => {
    for (const payload of [null, 42, 'request', [], undefined]) {
      const result = validateNativeScanRequestV1(payload);
      expect(result.ok).toBe(false);
    }
  });

  it('enforces AST depth, node count and rule-count limits', () => {
    let deep: unknown = { kind: 'number', value: 1 };
    for (let index = 0; index < NATIVE_SCAN_LIMITS.maxAstDepth + 2; index += 1) {
      deep = { kind: 'binary', op: 'add', left: deep, right: { kind: 'number', value: 1 } };
    }
    const deepResult = validateNativeScanRequestV1({
      schemaVersion: 1,
      requestedRunId: 'run',
      universe: { source: 'activeBse' },
      evaluation: { evaluateHistory: false, priceBasis: 'raw' },
      rules: [{ id: 'r', expression: deep }],
    });
    expect(deepResult.ok).toBe(false);

    const tooManyRules = {
      schemaVersion: 1,
      requestedRunId: 'run',
      universe: { source: 'activeBse' },
      evaluation: { evaluateHistory: false, priceBasis: 'raw' },
      rules: Array.from({ length: NATIVE_SCAN_LIMITS.maxRules + 1 }, (_, index) => ({
        id: `rule_${index}`,
        expression: { kind: 'number', value: 1 },
      })),
    };
    const rulesResult = validateNativeScanRequestV1(tooManyRules);
    expect(rulesResult.ok).toBe(false);
    if (!rulesResult.ok) {
      expect(rulesResult.issues.map((issue) => issue.code)).toContain('too-many-rules');
    }
  });

  it('rejects non-finite numbers and unsupported operators', () => {
    const base = {
      schemaVersion: 1,
      requestedRunId: 'run',
      universe: { source: 'activeBse' },
      evaluation: { evaluateHistory: false, priceBasis: 'raw' },
    };
    const nonFinite = validateNativeScanRequestV1({
      ...base,
      rules: [{ id: 'r', expression: { kind: 'number', value: Number.POSITIVE_INFINITY } }],
    });
    expect(nonFinite.ok).toBe(false);
    const badOp = validateNativeScanRequestV1({
      ...base,
      rules: [
        {
          id: 'r',
          expression: {
            kind: 'binary',
            op: 'pow',
            left: { kind: 'number', value: 1 },
            right: { kind: 'number', value: 2 },
          },
        },
      ],
    });
    expect(badOp.ok).toBe(false);
    if (!badOp.ok) {
      expect(badOp.issues.map((issue) => issue.code)).toContain('unsupported-operator');
    }
  });

  it('accepts adjusted basis with explicit flags and rejects unknown evaluation fields', () => {
    const base = {
      schemaVersion: 1,
      requestedRunId: 'run',
      universe: { source: 'activeNseEq' },
      rules: [{ id: 'r', expression: { kind: 'number', value: 1 } }],
    };
    const adjusted = validateNativeScanRequestV1({
      ...base,
      evaluation: {
        evaluateHistory: true,
        priceBasis: 'adjusted',
        includeDividendAdjustments: true,
        asOfDate: '2026-01-30',
      },
    });
    expect(adjusted.ok, adjusted.ok ? '' : JSON.stringify(adjusted.issues)).toBe(true);

    const unknown = validateNativeScanRequestV1({
      ...base,
      evaluation: { evaluateHistory: true, priceBasis: 'adjusted', autoApproveActions: true },
    });
    expect(unknown.ok).toBe(false);
  });
});

describe('NS-01 opt-in safety properties', () => {
  it('keeps native patterns limited to the 54 built-in chart-pattern ids', () => {
    expect(NATIVE_SUPPORTED_PATTERN_IDS).toHaveLength(54);
    expect(new Set(NATIVE_SUPPORTED_PATTERN_IDS).size).toBe(54);
    expect(NATIVE_SUPPORTED_PATTERN_IDS).toContain('chart_exhaustion_gap');
    expect(NATIVE_SUPPORTED_PATTERN_IDS).toContain('chart_head_shoulders');
  });

  it('never reports native as enabled by default', () => {
    for (const workerCount of [0, 1, 4, 8]) {
      expect(createNativeScannerCapabilitiesV1(workerCount).defaultEnabled).toBe(false);
    }
  });
});

describe('NS-01 no-look-ahead and finished-bar semantics', () => {
  it('a rule evaluated on a truncated window cannot see later bars', () => {
    const bars = toBars(loadFixture().barSets.trend_40!);
    const source = 'crossover(sma(close, 5), sma(close, 20))';
    const compiled = compileNativeScannerExpression(source);
    expect(compiled.ok).toBe(true);
    for (let end = 21; end <= bars.length; end += 1) {
      const truncated = bars.slice(0, end);
      const full = evaluateNativeExpression(compiled.expression!, bars).values;
      const partial = evaluateNativeExpression(compiled.expression!, truncated).values;
      expect(partial[end - 1]).toEqual(full[end - 1]);
      expect(partial).toEqual(full.slice(0, end));
    }
  });

  it('minimum-bar accounting covers every indicator family', () => {
    const cases: Array<[string, number]> = [
      ['close > 1', 1],
      ['close[4] > 1', 5],
      ['sma(close, 20) > 1', 20],
      ['ema(close, 20) > 1', 20],
      ['rsi(close, 14) > 50', 15],
      ['atr(14) > 1', 14],
      ['volumeSma(20) > 1', 20],
      ['crossover(close, sma(close, 20))', 21],
    ];
    for (const [source, expected] of cases) {
      const compiled = compileNativeScannerExpression(source);
      expect(compiled.ok, source).toBe(true);
      expect(minimumBarsForExpression(compiled.expression!), source).toBe(expected);
    }
  });
});

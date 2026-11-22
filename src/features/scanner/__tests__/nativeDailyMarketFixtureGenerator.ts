import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  dailyMarketScannerDefinitions,
  runDailyMarketScanner,
} from '@/plugins/scanner/dailyMarketScanners';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';
import { compileNativeDailyMarketCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import type { NativeExprV1 } from '@/features/scanner/nativeScanContract';

export interface DailyMarketFixtureBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type DailyMarketExpectedOutcome = 'match' | 'no-match' | 'skipped';

export interface DailyMarketParityCase {
  caseId: string;
  ruleId: string;
  description: string;
  symbol: string;
  exchange: string;
  bars: DailyMarketFixtureBar[];
  expectedStatus: DailyMarketExpectedOutcome;
  expected: Omit<ScannerResult, 'generatedAt'> | null;
}

export interface DailyMarketParityFixtureBundle {
  version: number;
  description: string;
  rules: Record<string, NativeExprV1>;
  cases: DailyMarketParityCase[];
}

const OUTPUT_PATH = resolve(
  __dirname,
  '../fixtures/nativeDailyMarketParityFixtures.v1.json',
);

const START_MS = Date.UTC(2025, 0, 1);

function isoDate(dayOffset: number): string {
  return new Date(START_MS + dayOffset * 86_400_000).toISOString().slice(0, 10);
}

function makeBars(
  count: number,
  overrides: Record<number, Partial<DailyMarketFixtureBar>> = {},
  defaults: Partial<DailyMarketFixtureBar> = {},
): DailyMarketFixtureBar[] {
  const bars: DailyMarketFixtureBar[] = [];
  for (let index = 0; index < count; index += 1) {
    const base: DailyMarketFixtureBar = {
      date: isoDate(index),
      open: defaults.open ?? 100,
      high: defaults.high ?? 105,
      low: defaults.low ?? 95,
      close: defaults.close ?? 100,
      volume: defaults.volume ?? 1000,
    };
    const patch = overrides[index];
    bars.push(patch ? { ...base, ...patch } : base);
  }
  return bars;
}

/** Normalizes IEEE-754 `-0` to `+0` to match JSON IPC serialization. */
export function normalizeNegativeZeroValues(
  values: ScannerResult['values'],
): ScannerResult['values'] {
  if (!values) return values;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'number' && Object.is(value, -0) ? 0 : value,
    ]),
  );
}

const definitionsById = new Map(
  dailyMarketScannerDefinitions.map((definition) => [definition.id, definition]),
);

function buildCase(spec: {
  caseId: string;
  ruleId: string;
  description: string;
  symbol: string;
  exchange: string;
  bars: DailyMarketFixtureBar[];
  expectedStatus: DailyMarketExpectedOutcome;
}): DailyMarketParityCase {
  const definition = definitionsById.get(spec.ruleId);
  if (!definition) {
    throw new Error(`Unknown Daily Market definition: ${spec.ruleId}`);
  }
  const scannerBars: EodBar[] = spec.bars.map((bar) => ({
    symbol: spec.symbol,
    ...bar,
  }));
  const rawResult = runDailyMarketScanner(
    { symbol: spec.symbol, exchange: spec.exchange, bars: scannerBars },
    definition,
  );
  if (spec.expectedStatus === 'match' && rawResult === null) {
    throw new Error(`${spec.caseId}: expected match but TS handler returned null.`);
  }
  if (spec.expectedStatus !== 'match' && rawResult !== null) {
    throw new Error(`${spec.caseId}: expected ${spec.expectedStatus} but TS handler matched.`);
  }

  let expected: Omit<ScannerResult, 'generatedAt'> | null = null;
  if (rawResult !== null) {
    const { generatedAt: _generatedAt, ...stable } = rawResult;
    expected = {
      ...stable,
      values: normalizeNegativeZeroValues(stable.values),
    };
  }

  return {
    caseId: spec.caseId,
    ruleId: spec.ruleId,
    description: spec.description,
    symbol: spec.symbol,
    exchange: spec.exchange,
    bars: spec.bars,
    expectedStatus: spec.expectedStatus,
    expected,
  };
}

export function generateDailyMarketParityFixtures(): DailyMarketParityFixtureBundle {
  const rules: Record<string, NativeExprV1> = {};
  for (const definition of dailyMarketScannerDefinitions) {
    const expression = compileNativeDailyMarketCandidate(definition.id);
    if (!expression) {
      throw new Error(`Missing canonical AST for ${definition.id}`);
    }
    rules[definition.id] = expression;
  }

  const cases: DailyMarketParityCase[] = [
    // --- top_gainers ---
    buildCase({
      caseId: 'top_gainers_0_bars_skipped',
      ruleId: 'top_gainers',
      description: 'Zero completed bars are skipped without fabricating a match or error.',
      symbol: 'EMPTY0',
      exchange: 'NSE',
      bars: [],
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'top_gainers_1_bar_skipped',
      ruleId: 'top_gainers',
      description: 'One completed bar is below the 2-bar floor and skipped.',
      symbol: 'ONE1',
      exchange: 'NSE',
      bars: makeBars(1, { 0: { close: 105 } }),
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'top_gainers_2_bars_match_zero_volume',
      ruleId: 'top_gainers',
      description: 'Two completed bars with positive gain and nonnegative (zero) volume match.',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 100, volume: 5000 },
        1: { close: 105.25, high: 106, low: 100.5, open: 101, volume: 0 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'top_gainers_unchanged_zero_pct_nonmatch',
      ruleId: 'top_gainers',
      description: 'Unchanged close (0.00% change) is strictly excluded from top_gainers.',
      symbol: 'FLAT',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 100 },
        1: { close: 100 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_gainers_negative_pct_nonmatch',
      ruleId: 'top_gainers',
      description: 'Negative close change does not match top_gainers.',
      symbol: 'DOWN',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 100 },
        1: { close: 99.5 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_gainers_zero_prev_close_invalid',
      ruleId: 'top_gainers',
      description: 'Zero previous close denominator yields non-match instead of division-by-zero.',
      symbol: 'ZEROPREV',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 0 },
        1: { close: 100 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_gainers_negative_volume_invalid',
      ruleId: 'top_gainers',
      description: 'Negative current volume fails metric validity and yields non-match.',
      symbol: 'NEGVOL',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 100 },
        1: { close: 110, volume: -5 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_gainers_fractional_bse_match',
      ruleId: 'top_gainers',
      description: 'BSE target with fractional previous-close denominator and rounding parity.',
      symbol: '500325',
      exchange: 'BSE',
      bars: makeBars(5, {
        3: { close: 243.17, volume: 12000 },
        4: { close: 249.84, high: 251, low: 243, open: 244, volume: 18450 },
      }),
      expectedStatus: 'match',
    }),

    // --- top_losers ---
    buildCase({
      caseId: 'top_losers_0_bars_skipped',
      ruleId: 'top_losers',
      description: 'Zero completed bars are skipped for top_losers.',
      symbol: 'EMPTY0',
      exchange: 'NSE',
      bars: [],
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'top_losers_1_bar_skipped',
      ruleId: 'top_losers',
      description: 'One completed bar is skipped for top_losers.',
      symbol: 'ONE1',
      exchange: 'NSE',
      bars: makeBars(1, { 0: { close: 95 } }),
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'top_losers_2_bars_match',
      ruleId: 'top_losers',
      description: 'Two completed bars with negative percentage change match top_losers.',
      symbol: 'TCS',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 200, volume: 9000 },
        1: { close: 192.5, high: 200, low: 191, open: 199, volume: 12000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'top_losers_unchanged_zero_pct_nonmatch',
      ruleId: 'top_losers',
      description: 'Unchanged close (0.00% change) is strictly excluded from top_losers.',
      symbol: 'FLAT',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 200 },
        1: { close: 200 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_losers_positive_pct_nonmatch',
      ruleId: 'top_losers',
      description: 'Positive gain does not match top_losers.',
      symbol: 'UP',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 200 },
        1: { close: 201 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_losers_zero_prev_close_invalid',
      ruleId: 'top_losers',
      description: 'Zero previous close denominator yields non-match for top_losers.',
      symbol: 'ZEROPREV',
      exchange: 'NSE',
      bars: makeBars(2, {
        0: { close: 0 },
        1: { close: 90 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'top_losers_small_negative_tofixed_zero_sign_bse',
      ruleId: 'top_losers',
      description: 'Small negative percentage (-0.004%) retains "-0.00%" reason sign and BSE identity.',
      symbol: '532540',
      exchange: 'BSE',
      bars: makeBars(3, {
        1: { close: 1000, volume: 4000 },
        2: { close: 999.96, volume: 5000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'top_losers_fractional_bse_match',
      ruleId: 'top_losers',
      description: 'BSE target with fractional loss and rounding parity.',
      symbol: '500209',
      exchange: 'BSE',
      bars: makeBars(5, {
        3: { close: 312.45, volume: 22000 },
        4: { close: 298.11, high: 313, low: 297.5, open: 312, volume: 42100 },
      }),
      expectedStatus: 'match',
    }),

    // --- volume_surge ---
    buildCase({
      caseId: 'volume_surge_20_bars_skipped',
      ruleId: 'volume_surge',
      description: '20 completed bars are insufficient (needs 21) and are skipped.',
      symbol: 'SHORT20',
      exchange: 'NSE',
      bars: makeBars(20, { 19: { volume: 50000 } }),
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'volume_surge_21_bars_below_threshold',
      ruleId: 'volume_surge',
      description: 'Ratio 1.499x just below 1.5 does not match volume_surge.',
      symbol: 'BELOW15',
      exchange: 'NSE',
      bars: makeBars(21, { 20: { volume: 1499 } }, { volume: 1000 }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'volume_surge_21_bars_exact_1_5_bullish_zero_change',
      ruleId: 'volume_surge',
      description: 'Exact 1.50x threshold matches and unchanged close (0%) resolves bullish direction.',
      symbol: 'EXACT15',
      exchange: 'NSE',
      bars: makeBars(21, { 20: { close: 100, volume: 1500 } }, { close: 100, volume: 1000 }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_excludes_current_bar_from_average',
      ruleId: 'volume_surge',
      description: 'Prior-20 average excludes today bar (1500 vs 1000 avg = 1.50x, whereas 21-bar avg would fail).',
      symbol: 'EXCLCURR',
      exchange: 'NSE',
      bars: makeBars(
        21,
        {
          19: { close: 100, volume: 1000 },
          20: { close: 103.5, volume: 1500 },
        },
        { close: 100, volume: 1000 },
      ),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_21_bars_above_1_5_bearish_bse',
      ruleId: 'volume_surge',
      description: 'BSE volume surge on a negative close day resolves bearish direction and 20-day avg.',
      symbol: '500112',
      exchange: 'BSE',
      bars: makeBars(
        21,
        {
          19: { close: 100, volume: 10000 },
          20: { close: 97.25, volume: 22500 },
        },
        { close: 100, volume: 10000 },
      ),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_fractional_average_rounding',
      ruleId: 'volume_surge',
      description: 'Fractional 20-day average volume rounds avg_volume_20 to integer in values and reason.',
      symbol: 'INFY',
      exchange: 'NSE',
      bars: makeBars(
        21,
        {
          ...Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [
              i,
              { close: 150, volume: i % 2 === 0 ? 1000 : 1501 },
            ]),
          ),
          20: { close: 154.35, volume: 3127 },
        },
        { close: 150, volume: 1000 },
      ),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_lakh_scale_en_in_grouping_match',
      ruleId: 'volume_surge',
      description: 'Lakh-scale volumes (>=100,000) format deterministically with en-IN grouping (1,50,000 vs 1,00,000).',
      symbol: 'TATAMOTORS',
      exchange: 'NSE',
      bars: makeBars(
        21,
        { 20: { close: 104, volume: 150_000 } },
        { close: 100, volume: 100_000 },
      ),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_crore_scale_en_in_grouping_bse_match',
      ruleId: 'volume_surge',
      description: 'Crore-scale BSE volumes format deterministically with en-IN grouping (1,23,45,678 vs 12,50,000).',
      symbol: '500325',
      exchange: 'BSE',
      bars: makeBars(
        21,
        { 20: { close: 96, volume: 12_345_678 } },
        { close: 100, volume: 1_250_000 },
      ),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'volume_surge_zero_average_volume_nonmatch',
      ruleId: 'volume_surge',
      description: 'Zero prior-20 average volume yields non-match instead of dividing by zero.',
      symbol: 'ZEROAVG',
      exchange: 'NSE',
      bars: makeBars(21, { 20: { close: 105, volume: 5000 } }, { close: 100, volume: 0 }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'volume_surge_invalid_negative_prior_volume_nonmatch',
      ruleId: 'volume_surge',
      description: 'Negative volume inside the prior-20 window invalidates volume_surge.',
      symbol: 'BADPRIOR',
      exchange: 'NSE',
      bars: makeBars(
        21,
        {
          5: { volume: -1 },
          20: { close: 105, volume: 5000 },
        },
        { close: 100, volume: 1000 },
      ),
      expectedStatus: 'no-match',
    }),

    // --- high_52w ---
    buildCase({
      caseId: 'high_52w_19_bars_skipped',
      ruleId: 'high_52w',
      description: '19 completed bars are below the 20-bar minimum and skipped.',
      symbol: 'SHORT19',
      exchange: 'NSE',
      bars: makeBars(19, { 18: { high: 150, close: 145 } }),
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'high_52w_20_bars_match',
      ruleId: 'high_52w',
      description: 'Exactly 20 bars matching 20-bar high reports period=20 in reason.',
      symbol: 'HDFCBANK',
      exchange: 'NSE',
      bars: makeBars(20, {
        18: { close: 104 },
        19: { open: 105, high: 115, low: 104, close: 114.25, volume: 8000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'high_52w_20_bars_nonmatch',
      ruleId: 'high_52w',
      description: 'Today high strictly below window maximum high does not match.',
      symbol: 'BELOWH',
      exchange: 'NSE',
      bars: makeBars(20, {
        5: { high: 120 },
        19: { high: 119.99, close: 119 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'high_52w_251_bars_tie_and_down_reversal_bse',
      ruleId: 'high_52w',
      description: '251-bar tie with earlier high on a red reversal close day still matches bullish.',
      symbol: '500180',
      exchange: 'BSE',
      bars: makeBars(251, {
        10: { high: 150, close: 146 },
        249: { close: 148 },
        250: { open: 149, high: 150, low: 144, close: 145, volume: 25000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'high_52w_252_bars_exact_close_at_high',
      ruleId: 'high_52w',
      description: '252-bar breakout closing right at the 52-week high has dist_52w_pct=0.',
      symbol: 'SBIN',
      exchange: 'NSE',
      bars: makeBars(252, {
        250: { close: 200 },
        251: { open: 201, high: 205, low: 200, close: 205, volume: 15000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'high_52w_253_bars_ignores_bar0_outside_252_window',
      ruleId: 'high_52w',
      description: '253 bars ignore bar 0 (high 500) outside the trailing 252-bar window.',
      symbol: 'WIN253H',
      exchange: 'NSE',
      bars: makeBars(253, {
        0: { high: 500, close: 490 },
        251: { close: 202 },
        252: { open: 203, high: 210, low: 201, close: 208.5, volume: 9500 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'high_52w_zero_prev_close_fallback_change_pct',
      ruleId: 'high_52w',
      description: 'When metrics are null (prev close=0), high_52w still matches with change_pct=0.',
      symbol: 'FALLBACKH',
      exchange: 'NSE',
      bars: makeBars(20, {
        18: { close: 0 },
        19: { high: 115, close: 112 },
      }),
      expectedStatus: 'match',
    }),

    // --- low_52w ---
    buildCase({
      caseId: 'low_52w_19_bars_skipped',
      ruleId: 'low_52w',
      description: '19 completed bars are below the 20-bar minimum and skipped.',
      symbol: 'SHORT19L',
      exchange: 'NSE',
      bars: makeBars(19, { 18: { low: 50, close: 55 } }),
      expectedStatus: 'skipped',
    }),
    buildCase({
      caseId: 'low_52w_20_bars_match',
      ruleId: 'low_52w',
      description: 'Exactly 20 bars matching 20-bar low reports period=20 in reason.',
      symbol: 'WIPRO',
      exchange: 'NSE',
      bars: makeBars(20, {
        18: { close: 96 },
        19: { open: 95, high: 96, low: 85, close: 86.4, volume: 7000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'low_52w_20_bars_nonmatch',
      ruleId: 'low_52w',
      description: 'Today low strictly above window minimum low does not match.',
      symbol: 'ABOVEL',
      exchange: 'NSE',
      bars: makeBars(20, {
        5: { low: 80 },
        19: { low: 80.01, close: 82 },
      }),
      expectedStatus: 'no-match',
    }),
    buildCase({
      caseId: 'low_52w_251_bars_tie_and_up_reversal_bse',
      ruleId: 'low_52w',
      description: '251-bar tie with earlier low on a green reversal close day still matches bearish.',
      symbol: '507685',
      exchange: 'BSE',
      bars: makeBars(251, {
        15: { low: 75, close: 77 },
        249: { close: 78 },
        250: { open: 77, high: 81, low: 75, close: 80.5, volume: 19000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'low_52w_252_bars_exact_close_at_low',
      ruleId: 'low_52w',
      description: '252-bar breakdown closing right at the 52-week low has dist_52w_pct=0.',
      symbol: 'LT',
      exchange: 'NSE',
      bars: makeBars(252, {
        250: { close: 55 },
        251: { open: 54, high: 55, low: 50, close: 50, volume: 16000 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'low_52w_253_bars_ignores_bar0_outside_252_window',
      ruleId: 'low_52w',
      description: '253 bars ignore bar 0 (low 10) outside the trailing 252-bar window.',
      symbol: 'WIN253L',
      exchange: 'NSE',
      bars: makeBars(253, {
        0: { low: 10, close: 15 },
        251: { close: 82 },
        252: { open: 81, high: 83, low: 70, close: 72.15, volume: 11200 },
      }),
      expectedStatus: 'match',
    }),
    buildCase({
      caseId: 'low_52w_zero_prev_close_fallback_change_pct',
      ruleId: 'low_52w',
      description: 'When metrics are null (prev close=0), low_52w still matches with change_pct=0.',
      symbol: 'FALLBACKL',
      exchange: 'NSE',
      bars: makeBars(20, {
        18: { close: 0 },
        19: { low: 82, close: 88 },
      }),
      expectedStatus: 'match',
    }),
  ];

  // Independent specification assertions for lakh/crore en-IN formatting (C-1).
  const expectedReasonsByCaseId: Record<string, string> = {
    volume_surge_lakh_scale_en_in_grouping_match:
      'Volume surge: 1.50x of 20-day average (1,50,000 vs 1,00,000)',
    volume_surge_crore_scale_en_in_grouping_bse_match:
      'Volume surge: 9.88x of 20-day average (1,23,45,678 vs 12,50,000)',
  };
  for (const [caseId, expectedReason] of Object.entries(expectedReasonsByCaseId)) {
    const actualReason = cases.find((sample) => sample.caseId === caseId)?.expected?.reasons?.[0];
    if (actualReason !== expectedReason) {
      throw new Error(`${caseId}: expected reason "${expectedReason}", got "${actualReason ?? 'none'}"`);
    }
  }

  return {
    version: 1,
    description:
      'NS-R2 shared TypeScript/Rust parity cases for all five Daily Market scanners (generatedAt excluded).',
    rules,
    cases,
  };
}

export function writeDailyMarketParityFixtures(): void {
  const bundle = generateDailyMarketParityFixtures();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
}

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { ChartSignalRule, IndicatorSource, SignalTarget } from '@/engine/types';
import { compileNativeCustomSignalRules } from '@/features/scanner/nativeCustomSignals';
import { runCoreEodScannerBatch } from '@/plugins/scanner/scannerRunner';
import { ACTIVE_CUSTOM_SIGNAL_SCANNER_ID } from '@/plugins/scanner/signalScanners';

const fixturePath = resolve(__dirname, '../fixtures/nativeCustomSignalParityFixtures.v1.json');
const priceScale = 10_000;
const startDate = '2025-01-01';

type CloseRun = readonly [ticks: number, count: number];

function ticks(prices: number[]): CloseRun[] {
  return prices.map((price) => [Math.round(price * priceScale), 1]);
}

const barSets = {
  up: ticks([28, 30, 31, 32]),
  down: ticks([32, 30, 29, 28]),
  averages: [[1_000_000, 200], [1_100_000, 2]],
  rollingSma: [[985_275, 1], [1_000_004, 418], [1_000_003, 1]],
  rsiUp: ticks([100, 100.5, 101, 101.5, 102, 102.5, 103, 102, 101, 100, 99, 98, 97, 96, 96, 97, 97]),
  rsiDown: ticks([100, 99.5, 99, 98.5, 98, 97.5, 97, 98, 99, 100, 101, 102, 103, 104, 104, 103, 103]),
  rsiRoundsTo30: ticks([100, 100.5, 101, 101.5, 102, 102.5, 103, 102, 101, 100, 99, 98, 97, 96, 96, 96.0006]),
  rsiRoundsAbove30: ticks([100, 100.5, 101, 101.5, 102, 102.5, 103, 102, 101, 100, 99, 98, 97, 96, 96, 96.0007]),
} satisfies Record<string, readonly CloseRun[]>;

function rule(id: string, seriesA: SignalTarget, seriesB: SignalTarget, changes: Partial<ChartSignalRule> = {}): ChartSignalRule {
  return { id, label: id, enabled: true, conditionType: 'crosses_above', seriesA, seriesB, ...changes };
}

const closeThreshold = { staticValue: 30 };
const ema20 = { indicatorId: 'ema_20', plotKey: 'ema' };
const sma50 = { indicatorId: 'sma_50', plotKey: 'sma' };
const sma200 = { indicatorId: 'sma_200' };
const rsi14 = { indicatorId: 'rsi_14', plotKey: 'rsi' };

const emaSma = rule('ema-sma', ema20, sma50, { position: 'on_series' });
const smaPair = rule('sma-pair', { indicatorId: 'sma_50', plotKey: '' }, sma200, { position: 'on_series' });
const emaThreshold = rule('ema-limit', ema20, { staticValue: 100 }, { position: 'on_series' });
const above = rule('greater', {}, closeThreshold, { conditionType: 'greater_than', shape: 'arrow_up' });
const below = rule('less', {}, closeThreshold, { conditionType: 'less_than', shape: 'arrow_down' });
const rsiBounce = rule('rsi-bounce', rsi14, closeThreshold, { position: 'on_series' });
const sameLabel = [
  rule('first|rule', {}, closeThreshold, { label: 'Même règle' }),
  rule('disabled', {}, closeThreshold, { label: 'Même règle', enabled: false }),
  rule('second:rule', {}, closeThreshold, { label: 'Même règle' }),
];
const sourceLimits: Array<[IndicatorSource, number]> = [
  ['open', 30], ['high', 30.75], ['low', 28.75], ['close', 30], ['hl2', 30], ['hlc3', 30], ['ohlc4', 30],
];
const sourceRules = sourceLimits.map(([source, threshold]) => rule(
  source, { source }, { staticValue: threshold }, { position: 'on_series' },
));

interface Scenario {
  caseId: string;
  barSet: keyof typeof barSets;
  rules: ChartSignalRule[];
  expectedIds: string[];
  cutoffIndex?: number;
  lookbackBars?: number;
  exchange?: string;
  insufficientData?: boolean;
}

const scenarios: Scenario[] = [
  { caseId: 'all-ohlc-sources-and-on-series-prices', barSet: 'up', rules: sourceRules, expectedIds: sourceRules.map(({ id }) => id), cutoffIndex: 2 },
  { caseId: 'multiple-matches-same-label-in-configured-order', barSet: 'up', rules: sameLabel, expectedIds: ['first|rule', 'second:rule'], cutoffIndex: 2 },
  { caseId: 'disabled-rule-does-not-match', barSet: 'up', rules: [sameLabel[1]], expectedIds: [], cutoffIndex: 2 },
  { caseId: 'no-configured-rules', barSet: 'up', rules: [], expectedIds: [], cutoffIndex: 2 },
  { caseId: 'greater-from-equality', barSet: 'up', rules: [above], expectedIds: ['greater'], cutoffIndex: 2 },
  { caseId: 'greater-current-equality', barSet: 'up', rules: [above], expectedIds: [], cutoffIndex: 1 },
  { caseId: 'greater-already-on-the-same-side', barSet: 'up', rules: [above], expectedIds: [] },
  { caseId: 'less-from-equality', barSet: 'down', rules: [below], expectedIds: ['less'], cutoffIndex: 2, exchange: 'BSE' },
  { caseId: 'less-current-equality', barSet: 'down', rules: [below], expectedIds: [], cutoffIndex: 1 },
  { caseId: 'less-already-on-the-same-side', barSet: 'down', rules: [below], expectedIds: [] },
  { caseId: 'neutral-shape-with-explicit-price-position', barSet: 'up', cutoffIndex: 2,
    rules: [{ ...above, shape: 'circle', position: 'above_bar', label: '' }], expectedIds: ['greater'] },
  { caseId: 'plot-and-indicator-fallback', barSet: 'up', cutoffIndex: 2, rules: [
    rule('missing-plot', { indicatorId: 'rsi_14', plotKey: 'missing', source: 'open' }, closeThreshold, { position: 'on_series' }),
    rule('missing-indicator', { indicatorId: 'chart_only', source: 'high' }, { staticValue: 30.75 }, { position: 'on_series' }),
    rule('default-close', { indicatorId: 'chart_only' }, closeThreshold),
  ], expectedIds: ['missing-plot', 'missing-indicator', 'default-close'] },
  { caseId: 'constant-takes-precedence-over-indicator', barSet: 'up', cutoffIndex: 2, rules: [
    rule('rhs-constant', {}, { ...rsi14, staticValue: 30 }),
    rule('lhs-already-constant', { ...rsi14, staticValue: 31 }, closeThreshold),
  ], expectedIds: ['rhs-constant'] },
  { caseId: 'indicator-to-indicator-explicit-and-primary-plots', barSet: 'averages', rules: [emaSma, smaPair],
    cutoffIndex: 200, expectedIds: ['ema-sma', 'sma-pair'] },
  { caseId: 'sma-200-needs-a-previous-value', barSet: 'averages', rules: [smaPair],
    cutoffIndex: 200, lookbackBars: 200, expectedIds: [] },
  { caseId: 'sma-50-needs-a-previous-value', barSet: 'averages', rules: [emaSma],
    cutoffIndex: 200, lookbackBars: 50, expectedIds: [] },
  { caseId: 'ema-20-needs-a-previous-value', barSet: 'averages', rules: [emaThreshold],
    cutoffIndex: 200, lookbackBars: 20, expectedIds: [] },
  { caseId: 'ema-20-exact-warmup', barSet: 'averages', rules: [emaThreshold],
    cutoffIndex: 200, lookbackBars: 21, expectedIds: ['ema-limit'] },
  { caseId: 'fractional-rolling-sma-order', barSet: 'rollingSma', rules: [
    { ...emaSma, conditionType: 'crosses_below' },
  ], expectedIds: ['ema-sma'] },
  { caseId: 'exact-rsi-plot-and-trigger-price', barSet: 'rsiUp', rules: [rsiBounce], expectedIds: ['rsi-bounce'], cutoffIndex: 15 },
  { caseId: 'rsi-14-needs-a-previous-value', barSet: 'rsiUp', rules: [rsiBounce], expectedIds: [], cutoffIndex: 14 },
  { caseId: 'rsi-does-not-repeat-a-prior-match', barSet: 'rsiUp', rules: [rsiBounce], expectedIds: [] },
  { caseId: 'rsi-crosses-below-a-configured-constant', barSet: 'rsiDown',
    rules: [rule('rsi-drop', { indicatorId: 'rsi_14' }, { staticValue: 70 }, { conditionType: 'crosses_below', position: 'on_series' })],
    expectedIds: ['rsi-drop'], cutoffIndex: 15 },
  { caseId: 'rsi-rounds-to-equality', barSet: 'rsiRoundsTo30', rules: [rsiBounce], expectedIds: [] },
  { caseId: 'rsi-rounds-above-equality', barSet: 'rsiRoundsAbove30', rules: [rsiBounce], expectedIds: ['rsi-bounce'] },
  { caseId: 'zero-completed-bars', barSet: 'up', rules: [above], expectedIds: [], cutoffIndex: -1, insufficientData: true },
  { caseId: 'one-completed-bar', barSet: 'up', rules: [above], expectedIds: [], cutoffIndex: 0, insufficientData: true },
];

function dateAt(index: number): string {
  return new Date(Date.parse(startDate) + index * 86_400_000).toISOString().slice(0, 10);
}

async function generateCase(input: Scenario) {
  const { caseId, barSet, rules } = input;
  const target = { exchange: input.exchange ?? 'NSE', symbol: 'CUSTOM_PARITY' };
  const asOfDate = input.cutoffIndex === undefined ? null : dateAt(input.cutoffIndex);
  const lookbackBars = input.lookbackBars ?? 800;
  const closes = barSets[barSet].flatMap(([tick, count]) => Array<number>(count).fill(tick));
  const bars = closes.map((tick, index) => ({
    date: dateAt(index), open: (tick - 2_500) / priceScale, high: (tick + 7_500) / priceScale,
    low: (tick - 12_500) / priceScale, close: tick / priceScale, volume: 10_000,
  }));
  const result = await runCoreEodScannerBatch({
    getEodData: async (request) => {
      expect(request.to ?? null, caseId).toBe(asOfDate);
      return {
        requestedSymbol: target.symbol,
        requestedExchange: target.exchange,
        adjusted: false,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
        instrument: null,
        bars: request.to ? bars.filter((bar) => bar.date <= request.to!) : bars,
        events: [],
      };
    },
  }, { targets: [target], scannerIds: [ACTIVE_CUSTOM_SIGNAL_SCANNER_ID], toDate: asOfDate, lookbackBars, signalRules: rules });

  // The renderer owns locale-aware name sorting. Compare the evaluator records
  // in configured rule order, with the TypeScript batch still owning the oracle.
  const ruleOrder = new Map(rules.map(({ id }, index) => [id, index]));
  const byRuleOrder = (id: unknown) => ruleOrder.get(String(id)) ?? rules.length;
  const ordered = [...result.results].sort((left, right) =>
    byRuleOrder(left.values?.rule_id) - byRuleOrder(right.values?.rule_id),
  );
  expect(ordered.map((match) => match.values?.rule_id), caseId).toEqual(input.expectedIds);
  expect(result.errors, caseId).toEqual(
    input.insufficientData ? [target.exchange + ':' + target.symbol + ' has fewer than 2 completed bars.'] : [],
  );
  const matches = ordered.map(({ generatedAt, ...match }) => {
    expect(Number.isFinite(Date.parse(generatedAt)), caseId).toBe(true);
    return match;
  });
  const resolvedRules = compileNativeCustomSignalRules(rules);
  expect(resolvedRules, caseId).not.toBeNull();
  return { caseId, target, barSet, asOfDate, lookbackBars, rules, resolvedRules, expected: { matches, errors: result.errors } };
}

function roundingCases() {
  const buffer = new DataView(new ArrayBuffer(8));
  return [0.125, 0.375, 42.625, 70.875, 29.995, 70.005].flatMap((edge) => {
    buffer.setFloat64(0, edge);
    const bits = buffer.getBigUint64(0);
    return [-1n, 0n, 1n].map((offset) => {
      const valueBits = bits + offset;
      buffer.setBigUint64(0, valueBits);
      return { valueBits: valueBits.toString(16), expected: Number(buffer.getFloat64(0).toFixed(2)) };
    });
  });
}

it('records the TypeScript custom-signal results and RSI rounding for Rust parity', async () => {
  const fixture = {
    version: 1, priceScale, startDate, barSets, cases: await Promise.all(scenarios.map(generateCase)),
    rounding: roundingCases(),
  };
  if (process.env.GENERATE_WP04_CUSTOM_SIGNAL_FIXTURES === '1') {
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  }
  expect(JSON.parse(readFileSync(fixturePath, 'utf8'))).toEqual(fixture);
});

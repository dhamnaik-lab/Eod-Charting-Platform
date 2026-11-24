import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runCoreEodScannerBatch } from '@/plugins/scanner/scannerRunner';

const fixturePath = resolve(__dirname, '../fixtures/nativePresetSignalParityFixtures.v1.json');
const priceScale = 10_000;
const startDate = '2025-01-01';

const golden = 'signal_golden_cross';
const death = 'signal_death_cross';
const bounce = 'signal_rsi_oversold_bounce';
const drop = 'signal_rsi_overbought_drop';

function dateAt(index: number): string {
  return new Date(Date.parse(startDate) + index * 86_400_000).toISOString().slice(0, 10);
}

const flat = Array<number>(50).fill(1_000_000);
const oversold = [100, 100.5, 101, 101.5, 102, 102.5, 103, 102, 101, 100, 99, 98, 97, 96, 96]
  .map((close) => close * priceScale);
const overbought = oversold.map((tick) => 200 * priceScale - tick);

const barSets = {
  flat: [...flat, 1_000_000],
  golden: [...flat, 1_100_000, 1_100_000],
  death: [...flat, 900_000, 900_000],
  olderEmaSeed: [2_000_000, ...flat, 1_100_000],
  rollingSmaTie: [985_275, ...Array<number>(418).fill(1_000_004), 1_000_003],
  bounce: [...oversold, 970_000, 970_000],
  drop: [...overbought, 1_030_000, 1_030_000],
  bounceRoundsTo30: [...oversold, 960_006],
  bounceRoundsAbove30: [...oversold, 960_007],
  dropRoundsTo70: [...overbought, 1_039_994],
  dropRoundsBelow70: [...overbought, 1_039_993],
  rawPrice30Cross: [280_000, 290_000, 310_000],
  rawPrice70Cross: [720_000, 710_000, 690_000],
  doubleCross: [...flat, 800_000, 1_300_000],
};

interface CaseInput {
  caseId: string;
  barSet: keyof typeof barSets;
  scannerIds: string[];
  expectedIds: string[];
  cutoffIndex?: number;
  lookbackBars?: number;
  exchange?: string;
  insufficientData?: boolean;
}

const scenarios: CaseInput[] = [
  { caseId: 'zero-bars-before-cutoff', barSet: 'golden', scannerIds: [golden], expectedIds: [], cutoffIndex: -1, insufficientData: true },
  { caseId: 'one-bar-at-cutoff', barSet: 'golden', scannerIds: [golden], expectedIds: [], cutoffIndex: 0, insufficientData: true },
  { caseId: 'sma-warmup-50', barSet: 'golden', scannerIds: [golden], expectedIds: [], cutoffIndex: 50, lookbackBars: 50 },
  { caseId: 'short-window-would-match-if-widened', barSet: 'golden', scannerIds: [golden], expectedIds: [], cutoffIndex: 50, lookbackBars: 20 },
  { caseId: 'golden-cross-at-51', barSet: 'golden', scannerIds: [golden], expectedIds: [golden], cutoffIndex: 50 },
  { caseId: 'death-cross-at-51', barSet: 'death', scannerIds: [death], expectedIds: [death], cutoffIndex: 50, exchange: 'BSE' },
  { caseId: 'average-current-equality', barSet: 'flat', scannerIds: [golden, death], expectedIds: [] },
  { caseId: 'golden-only-at-prior-endpoint', barSet: 'golden', scannerIds: [golden], expectedIds: [] },
  { caseId: 'death-only-at-prior-endpoint', barSet: 'death', scannerIds: [death], expectedIds: [] },
  { caseId: 'no-golden-cross-with-older-ema-seed', barSet: 'olderEmaSeed', scannerIds: [golden], expectedIds: [], lookbackBars: 52 },
  { caseId: 'golden-cross-with-exact-trailing-51', barSet: 'olderEmaSeed', scannerIds: [golden], expectedIds: [golden], lookbackBars: 51 },
  { caseId: 'fractional-rolling-sma-death-cross', barSet: 'rollingSmaTie', scannerIds: [golden, death], expectedIds: [death] },
  { caseId: 'rsi-warmup-15', barSet: 'bounce', scannerIds: [bounce], expectedIds: [], cutoffIndex: 14 },
  { caseId: 'bounce-at-16', barSet: 'bounce', scannerIds: [bounce], expectedIds: [bounce], cutoffIndex: 15 },
  { caseId: 'drop-at-16', barSet: 'drop', scannerIds: [drop], expectedIds: [drop], cutoffIndex: 15 },
  { caseId: 'bounce-only-at-prior-endpoint', barSet: 'bounce', scannerIds: [bounce], expectedIds: [] },
  { caseId: 'drop-only-at-prior-endpoint', barSet: 'drop', scannerIds: [drop], expectedIds: [] },
  { caseId: 'rsi-rounds-to-30', barSet: 'bounceRoundsTo30', scannerIds: [bounce], expectedIds: [] },
  { caseId: 'rsi-rounds-above-30', barSet: 'bounceRoundsAbove30', scannerIds: [bounce], expectedIds: [bounce] },
  { caseId: 'rsi-rounds-to-70', barSet: 'dropRoundsTo70', scannerIds: [drop], expectedIds: [] },
  { caseId: 'rsi-rounds-below-70', barSet: 'dropRoundsBelow70', scannerIds: [drop], expectedIds: [drop] },
  { caseId: 'price-30-does-not-stand-in-for-rsi', barSet: 'rawPrice30Cross', scannerIds: [bounce], expectedIds: [] },
  { caseId: 'price-70-does-not-stand-in-for-rsi', barSet: 'rawPrice70Cross', scannerIds: [drop], expectedIds: [] },
  { caseId: 'two-matches-in-scanner-result-order', barSet: 'doubleCross', scannerIds: [drop, bounce, golden, death], expectedIds: [golden, bounce] },
];

async function generateCase(input: CaseInput) {
  const target = { exchange: input.exchange ?? 'NSE', symbol: 'PRESET_PARITY' };
  const asOfDate = input.cutoffIndex === undefined ? null : dateAt(input.cutoffIndex);
  const lookbackBars = input.lookbackBars ?? 800;
  const sourceBars = barSets[input.barSet].map((ticks, index) => ({
    date: dateAt(index),
    open: ticks / priceScale,
    high: (ticks + priceScale) / priceScale,
    low: (ticks - priceScale) / priceScale,
    close: ticks / priceScale,
    volume: 10_000,
  }));
  const result = await runCoreEodScannerBatch({
    getEodData: async (request) => {
      expect(request.to ?? null, input.caseId).toBe(asOfDate);
      const bars = request.to ? sourceBars.filter((bar) => bar.date <= request.to!) : sourceBars;
      return {
        requestedSymbol: target.symbol,
        requestedExchange: target.exchange,
        adjusted: false,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
        instrument: null,
        bars,
        events: [],
      };
    },
  }, { targets: [target], scannerIds: input.scannerIds, toDate: asOfDate, lookbackBars });

  // Keep the intended verdicts independent of the generated metadata.
  expect(result.results.map((match) => match.scannerId), input.caseId).toEqual(input.expectedIds);
  expect(result.errors, input.caseId).toEqual(
    input.insufficientData ? [target.exchange + ':' + target.symbol + ' has fewer than 2 completed bars.'] : [],
  );
  const matches = result.results.map(({ generatedAt, ...match }) => {
    expect(Number.isFinite(Date.parse(generatedAt)), input.caseId).toBe(true);
    return match;
  });

  return {
    caseId: input.caseId,
    target,
    scannerIds: input.scannerIds,
    barSet: input.barSet,
    asOfDate,
    lookbackBars,
    expected: { matches, errors: result.errors },
  };
}

function thresholdRoundingCases() {
  const bits = new DataView(new ArrayBuffer(8));
  return ([30, 70] as const).flatMap((threshold) =>
    [threshold - 0.005, threshold + 0.005].flatMap((edge) => {
      bits.setFloat64(0, edge);
      const edgeBits = bits.getBigUint64(0);
      return [-1n, 0n, 1n].map((offset) => {
        const valueBits = edgeBits + offset;
        bits.setBigUint64(0, valueBits);
        const rounded = Number(bits.getFloat64(0).toFixed(2));
        return { valueBits: valueBits.toString(16), threshold, comparison: Math.sign(rounded - threshold) };
      });
    }),
  );
}

it('records corrected TypeScript preset outcomes for the Rust fixture comparison', async () => {
  const fixture = {
    version: 1,
    priceScale,
    startDate,
    barSets,
    cases: await Promise.all(scenarios.map(generateCase)),
    rounding: thresholdRoundingCases(),
  };
  if (process.env.GENERATE_WP04_PRESET_FIXTURES === '1') {
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  }
  expect(JSON.parse(readFileSync(fixturePath, 'utf8'))).toEqual(fixture);
});

import { describe, expect, it, vi } from 'vitest';
import { evaluateCustomFormulaDefinition, prepareScannerFormula, validateCustomFormulaDefinition } from '@/modules/formulaEngine/customFormulaEngine';
import type { DesktopApi, EodDataResult, EodRow } from '@/platform';
import {
  formulaScannerMarketDate,
  runCustomFormulaScannerBatch,
  type FormulaScannerRunRequest,
} from '@/plugins/scanner/scannerRunner';

function row(date: string, close: number, volume = 100) {
  return { date, open: close, high: close, low: close, close, volume };
}

function series(...closes: number[]) {
  return closes.map((close, index) => {
    const timestamp = Date.UTC(2026, 0, index + 1);
    return { ...row(new Date(timestamp).toISOString().slice(0, 10), close), timestamp };
  });
}

function payload(...bars: EodRow[]): EodDataResult {
  return {
    requestedSymbol: 'TEST', requestedExchange: 'NSE', adjusted: false, includeDividendAdjustments: false,
    includeRightsAdjustments: false, instrument: null, events: [], bars,
  };
}

const request: FormulaScannerRunRequest = {
  formula: 'FIRST = close\nRule = close > 200',
  predicate: 'rule',
  databasePath: 'mock-eod',
  targets: [{ exchange: 'NSE', symbol: 'TEST' }],
  lookbackBars: 20,
  toDate: '2026-01-05',
};

describe('Scanner formula evaluation', () => {
  it('selects one boolean series by name using ordered, case-insensitive references', () => {
    const formula = prepareScannerFormula('FLAG = close - 10\nHit = flag != 0\nMiss = CLOSE < 0');
    expect(formula.predicates).toEqual(['Hit', 'Miss']);
    expect(formula.evaluateLatest('hIt', series(12))).toBe(true);
    expect(formula.evaluateLatest('Miss', series(12))).toBe(false);
    expect(formula.evaluateLatest('Hit', series(10))).toBe(false);
  });

  it('keeps chart plots and the chart-only numeric validation requirement', () => {
    expect(validateCustomFormulaDefinition('RULE = close > 0').ok).toBe(false);
    expect(prepareScannerFormula('RULE = close > 0').evaluateLatest('RULE', series(12))).toBe(true);
    const chart = evaluateCustomFormulaDefinition('PLOT = close\nPlot = REF(close, -1)\nRULE = close > 0', series(4, 7));
    expect(chart.errors).toEqual([]);
    expect(chart.plots.map(({ label, values }) => ({ label, values }))).toEqual([
      { label: 'PLOT', values: [4, 7] },
      { label: 'Plot', values: [7, null] },
    ]);
    expect(chart.booleanOutputs).toEqual(['RULE']);
  });

  it.each([
    ['', /empty/i],
    ['A = close >', /line 1/i],
    ['A = unknown > 0', /unknown identifier/i],
    ['A = WHAT(close) > 0', /unknown function/i],
    ['A = close > 0\na = volume > 0', /duplicate.*line 2/i],
    ['A = 1 > 0', /bar-by-bar boolean/i],
    ['A = close', /bar-by-bar boolean/i],
    ['A = SMA(close, 0) > 0', />= 1/i],
    ['A = REF(close, 1, 2) > 0', /expects 2 arguments/i],
    ['A = REF(close, -1) > 0', /nonnegative/i],
    ['A = CHANGE(close, -0.5) > 0', /nonnegative/i],
    ['A = close > 0\nB = A > A', /boolean comparisons/i],
    ['A = 1 / 0\nB = close > A', /division by zero/i],
  ])('fails preflight for %j', (source, diagnostic) => {
    expect(() => prepareScannerFormula(source)).toThrow(diagnostic);
  });

  it('reports missing and warm-up values at the actual endpoint and preserves false', () => {
    const predicate = prepareScannerFormula('RULE = close > SMA(close, 2)');
    expect(predicate.evaluateLatest('RULE', [])).toBeNull();
    expect(predicate.evaluateLatest('RULE', series(1))).toBeNull();
    expect(predicate.evaluateLatest('RULE', series(1, 2))).toBe(true);
    expect(predicate.evaluateLatest('RULE', series(1, 2, 0))).toBe(false);
    expect(predicate.evaluateLatest('RULE', series(1, 2, NaN))).toBeNull();
    expect(prepareScannerFormula('RULE = close * close != 0').evaluateLatest('RULE', series(1e200))).toBeNull();
    const division = prepareScannerFormula('RULE = close / volume > 0');
    const [previous, current] = series(1, 2);
    expect(division.evaluateLatest('RULE', [previous, { ...current, volume: 0 }])).toBeNull();
    const cross = prepareScannerFormula('RULE = CROSSOVER(close, 2)');
    expect(cross.evaluateLatest('RULE', series(1))).toBeNull();
    expect(cross.evaluateLatest('RULE', series(1, 3))).toBe(true);
    expect(cross.evaluateLatest('RULE', series(1, 3, 4))).toBe(false);
  });
});

describe('Formula Scanner batch through the desktop reader', () => {
  it('preserves exact identities, inclusive cutoff and separate outcomes', async () => {
    const getEodData = vi.fn<DesktopApi['getEodData']>()
      .mockResolvedValueOnce(payload(row('2026-01-05', 250), row('2026-01-06', 150)))
      .mockResolvedValueOnce(payload(row('2026-01-03', 250)))
      .mockResolvedValueOnce(payload(row('2026-01-03', 250), row('2026-01-05', 150)))
      .mockResolvedValueOnce(payload())
      .mockRejectedValueOnce(new Error('Read failed'))
      .mockResolvedValueOnce(payload(row('2026-01-04', 230), row('2026-01-05', Infinity)));
    const onProgress = vi.fn();
    const output = await runCustomFormulaScannerBatch({ getEodData }, {
      ...request,
      formulaName: ' My formula ',
      onProgress,
      targets: [
        { exchange: 'NSE', symbol: 'TEST' }, { exchange: 'BSE', symbol: 'TEST' },
        { exchange: 'NSE', symbol: 'TEST' }, { exchange: 'NSE', symbol: 'FALSE' },
        { exchange: 'NSE', symbol: 'EMPTY' }, { exchange: 'BSE', symbol: 'ERROR' },
        { exchange: 'NSE', symbol: 'MISSING' },
      ],
    });
    expect(getEodData).toHaveBeenCalledTimes(6);
    expect(getEodData).toHaveBeenNthCalledWith(2, {
      databasePath: 'mock-eod', exchange: 'BSE', symbol: 'TEST',
      to: '2026-01-05', adjusted: false, resolveIdentity: false,
    });
    expect(output.counts).toEqual({ matched: 2, false: 1, unavailable: 2, failed: 1 });
    expect(output.errors).toEqual(['BSE:ERROR: Read failed']);
    expect(output.results).toMatchObject([
      { exchange: 'NSE', symbol: 'TEST', direction: 'neutral', date: '2026-01-05', scannerName: 'My formula', values: { predicate: 'Rule' } },
      { exchange: 'BSE', symbol: 'TEST', direction: 'neutral', date: '2026-01-03', scannerName: 'My formula', values: { predicate: 'Rule' } },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 6, total: 6, resultCount: 2 }));
  });

  it.each([
    [{ predicate: '' }, /select a named/i],
    [{ predicate: 'FIRST' }, /select a named/i],
    [{ formula: 'A = close > 0' }, /select a named/i],
    [{ formula: 'A = close >' }, /line 1/i],
    [{ targets: [] }, /distinct symbols/i],
    [{ targets: Array.from({ length: 51 }, (_, i) => ({ exchange: 'NSE', symbol: String(i) })) }, /distinct symbols/i],
    [{ lookbackBars: 19 }, /lookback/i],
    [{ lookbackBars: 801 }, /lookback/i],
    [{ toDate: '2026-02-30' }, /cutoff/i],
    [{ toDate: '9999-01-01' }, /cutoff/i],
  ])('rejects invalid inputs before any desktop reads', async (overrides, diagnostic) => {
    const getEodData = vi.fn();
    await expect(runCustomFormulaScannerBatch({ getEodData }, { ...request, ...overrides })).rejects.toThrow(diagnostic);
    expect(getEodData).not.toHaveBeenCalled();
  });

  it('uses IST for the default cutoff and seeds stateful indicators with the selected lookback', async () => {
    expect(formulaScannerMarketDate(new Date('2026-11-24T19:00:00Z'))).toBe('2026-11-25');
    const bars = series(100, ...new Array<number>(20).fill(10));
    const getEodData = vi.fn().mockResolvedValue(payload(...bars));
    const inputs = { ...request, formula: 'Rule = EMA(close, 20) > 10', toDate: undefined };
    const short = await runCustomFormulaScannerBatch({ getEodData }, { ...inputs, lookbackBars: 20 });
    const long = await runCustomFormulaScannerBatch({ getEodData }, { ...inputs, lookbackBars: 21 });
    expect(getEodData).toHaveBeenCalledWith(expect.objectContaining({ to: formulaScannerMarketDate() }));
    expect(short.counts.false).toBe(1);
    expect(long.counts.matched).toBe(1);
  });

  it('retains completed results and stops before the next read on cancellation', async () => {
    let cancelled = false;
    const getEodData = vi.fn().mockResolvedValue(payload(row('2026-01-05', 250)));
    const output = await runCustomFormulaScannerBatch({ getEodData }, {
      ...request,
      targets: [...request.targets, { exchange: 'NSE', symbol: 'OTHER' }],
      shouldCancel: () => cancelled,
      onProgress: () => { cancelled = true; },
    });
    expect(getEodData).toHaveBeenCalledTimes(1);
    expect(output.cancelled).toBe(true);
    expect(output.results).toHaveLength(1);
  });
});

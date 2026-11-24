import { describe, expect, it, vi } from 'vitest';
import type { ChartSignalRule } from '@/engine/types';
import fixture from '@/features/scanner/fixtures/nativeCustomSignalParityFixtures.v1.json';
import {
  NATIVE_CUSTOM_SIGNAL_LIMITS,
  type NativeCustomSignalRequestV1,
} from '@/features/scanner/nativeCustomSignals';
import {
  createNativeScannerCapabilitiesV1,
  type NativeScanCountsV1,
  type NativeScanMatchV1,
  type NativeScannerCapabilitiesV1,
} from '@/features/scanner/nativeScanContract';
import { readNativeScannerCapabilities, type subscribeToNativeScanEvents } from '@/platform/nativeScannerBridge';
import {
  formatScannerCompletionStatus,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import { ACTIVE_CUSTOM_SIGNAL_SCANNER_ID } from '@/plugins/scanner/signalScanners';
import type { ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/platform/tauriDesktop', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/platform/tauriDesktop')>(),
  getTauriCore: async () => ({ invoke }),
}));

type Options = Parameters<typeof runNativeOrTypeScriptScannerBatch>[0];
type Handlers = Parameters<typeof subscribeToNativeScanEvents>[1];

const sample = fixture.cases.find(({ caseId }) => caseId === 'multiple-matches-same-label-in-configured-order')!;
const rules = sample.rules as ChartSignalRule[];
const { target } = sample;
const rows = sample.expected.matches as Omit<ScannerResult, 'generatedAt'>[];
const wireRows: NativeScanMatchV1[] = rows.map(({ scannerId, matched: _, ...row }) => ({ ...row, ruleId: scannerId }));
const identity = '/fixture#1';
const capabilities: NativeScannerCapabilitiesV1 = {
  ...createNativeScannerCapabilitiesV1(2),
  customSignals: { evaluatorVersion: 1, ...NATIVE_CUSTOM_SIGNAL_LIMITS },
  customSignalSelection: identity,
};
const matches = { targets: 1, matched: 1, noMatch: 0, skipped: 0, failed: 0 };

function harness(overrides: Partial<Options> = {}) {
  const options: Options = {
    targets: [target], scannerIds: [ACTIVE_CUSTOM_SIGNAL_SCANNER_ID], lookbackBars: 20,
    evaluateHistory: false, toDate: sample.asOfDate, alertRules: [], signalRules: rules,
    expectedDatabasePath: '/fixture', getActiveDatabasePath: () => '/fixture',
    customSignalCapabilities: capabilities, ...overrides,
  };
  let handlers: Handlers = {};
  let sequence = 1;
  let begin = () => {
    batch(wireRows);
    finish(2);
  };
  const close = vi.fn();
  const subscribe = vi.fn(async (_runId: string, callbacks: Handlers) => {
    handlers = callbacks;
    return close;
  });
  const startCustom = vi.fn(async (request: NativeCustomSignalRequestV1) => {
    begin();
    return { accepted: true, schemaVersion: 1, runId: request.requestedRunId,
      databaseIdentity: identity, workerCount: 1, totalTargets: options.targets.length };
  });
  const nativeStart = vi.fn();
  const readCapabilities = vi.fn(async (): Promise<NativeScannerCapabilitiesV1> => capabilities);
  const cancel = vi.fn(async (runId: string) => ({ runId, cancelRequested: true, alreadyFinished: false }));
  const fallback = vi.fn(async (): Promise<ScannerRunOutput> => ({
    results: rows.map((row) => ({ ...row, generatedAt: '2026-11-24T04:00:00Z' })),
    alertTriggers: [], errors: [], scannedSymbols: options.targets.length, cancelled: false,
  }));
  const publish = vi.fn();
  const event = () => ({ eventVersion: 1 as const, runId: 'wp04-custom-ui', sequence: sequence++, databaseIdentity: identity });
  const batch = (records: NativeScanMatchV1[]) => handlers.onMatches?.({ ...event(), matches: records });
  const finish = (count: number | undefined, counts: NativeScanCountsV1 = matches, cancelled = false) =>
    handlers.onComplete?.({ ...event(), cancelled, durationMs: 1, counts, diagnostics: [], customSignalResultCount: count });
  const run = () => runNativeOrTypeScriptScannerBatch({ ...options, onResultChunk: publish }, {
    runTypeScript: fallback, start: nativeStart, startCustom, subscribe, cancel, readCapabilities,
    newRunId: () => 'wp04-custom-ui',
  });
  return {
    run, startCustom, nativeStart, fallback, publish, readCapabilities, close, cancel, subscribe, batch, finish,
    omitEvent: () => { sequence++; },
    onStart: (handler: typeof begin) => { begin = handler; },
  };
}

describe('WP-04 bounded native custom-signal route', () => {
  it('validates the executable descriptor and obtains a selection snapshot on request', async () => {
    invoke.mockResolvedValueOnce(capabilities);
    await expect(readNativeScannerCapabilities(true)).resolves.toMatchObject({
      customSignals: capabilities.customSignals, customSignalSelection: identity,
    });
    expect(invoke).toHaveBeenLastCalledWith('native_scanner_capabilities', { includeSelection: true });
    for (const raw of [
      { ...capabilities, customSignals: undefined },
      { ...capabilities, contractVersion: 'incompatible' },
      { ...capabilities, customSignals: { ...capabilities.customSignals, maxPossibleResults: 1 } },
    ]) {
      invoke.mockResolvedValueOnce(raw);
      const result = await readNativeScannerCapabilities(true);
      expect(result.customSignals).toBeUndefined();
      expect(result.customSignalSelection).toBeUndefined();
    }
  });

  it('publishes all configured-rule matches in target and rule order after complete validation', async () => {
    const otherTarget = { exchange: 'BSE', symbol: 'OTHER' };
    const test = harness({ targets: [target, otherTarget] });
    test.onStart(() => {
      test.batch([...wireRows].reverse().map((row) => ({ ...row, ...otherTarget })));
      test.batch([...wireRows].reverse());
      expect(test.publish).not.toHaveBeenCalled();
      test.finish(4, { ...matches, targets: 2, matched: 2 });
    });
    const output = await test.run();
    expect(output.backend).toBe('native');
    expect(output.results).toEqual([...rows, ...rows.map((row) => ({ ...row, ...otherTarget }))]
      .map((row) => ({ ...row, generatedAt: expect.any(String) })));
    expect(Object.keys(output.results[0].values!)).toEqual(['close', 'trigger_price', 'condition', 'rule_id']);
    const request = test.startCustom.mock.calls[0][0];
    expect(request).not.toHaveProperty('rules');
    expect(request).toMatchObject({
      evaluation: { priceBasis: 'raw', evaluateHistory: false, lookbackBars: 20, asOfDate: sample.asOfDate },
      customSignals: { databaseIdentity: identity, rules: sample.resolvedRules },
    });
    expect(test.publish).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
    expect(test.fallback).not.toHaveBeenCalled();
  });

  it('accepts zero matches when every target completed', async () => {
    const test = harness();
    test.onStart(() => test.finish(0, { ...matches, matched: 0, noMatch: 1 }));
    await expect(test.run()).resolves.toMatchObject({ backend: 'native', results: [], scannedSymbols: 1 });
    expect(test.fallback).not.toHaveBeenCalled();
  });

  it.each([
    { scannerIds: [ACTIVE_CUSTOM_SIGNAL_SCANNER_ID, 'signal_golden_cross'] },
    { evaluateHistory: true, lookbackBars: null },
    { lookbackBars: 5001 },
    { toDate: '2025-02-31' },
    { targets: [target, target] },
    { signalRules: rules.filter(({ enabled }) => !enabled) },
    { signalRules: [rules[0], rules[0]] },
    { signalRules: [{ ...rules[0], label: 'é'.repeat(129) }] },
    { signalRules: [{ ...rules[0], seriesB: { staticValue: Infinity } }] },
    { customSignalCapabilities: createNativeScannerCapabilitiesV1(2) },
    { alertRules: [{} as Options['alertRules'][number]] },
    { targets: Array.from({ length: 129 }, (_, i) => ({ exchange: 'NSE', symbol: 'SYM' + i })),
      signalRules: Array.from({ length: 32 }, (_, i) => ({ ...rules[0], id: 'rule' + i })) },
  ] satisfies Partial<Options>[])('routes ineligible input wholly to TypeScript (%#)', async (options) => {
    const test = harness(options);
    const output = await test.run();
    expect(output.backend).toBe('typescript-fallback');
    expect(formatScannerCompletionStatus(output, 1)).toContain('Used the TypeScript scanner backend.');
    expect(test.startCustom).not.toHaveBeenCalled();
    expect(test.nativeStart).not.toHaveBeenCalled();
    expect(test.fallback).toHaveBeenCalledOnce();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'missing second record on a matched target', records: [wireRows[0]], count: 2 },
    { label: 'missing terminal record count', records: wireRows, count: undefined },
    { label: 'duplicate record', records: [wireRows[0], wireRows[0]], count: 2 },
    { label: 'unrequested rule', records: [{ ...wireRows[0], values: { ...wireRows[0].values, rule_id: 'foreign' } }], count: 1 },
    { label: 'unrequested symbol', records: [{ ...wireRows[0], symbol: 'OTHER' }], count: 1 },
    { label: 'invalid metadata', records: [{ ...wireRows[0], score: 12 }], count: 1 },
    { label: 'skipped target', records: [], count: 0, counts: { ...matches, matched: 0, skipped: 1 } },
    { label: 'sequence gap', records: wireRows, count: 2, gap: true },
  ])('discards the entire buffer for $label before retrying once', async ({ records, count, counts, gap }) => {
    const test = harness();
    test.onStart(() => {
      if (gap) test.omitEvent();
      test.batch(records);
      test.finish(count, counts);
    });
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback', results: rows });
    expect(test.fallback).toHaveBeenCalledOnce();
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.close).toHaveBeenCalledOnce();
  });

  it('retries the original selection after transport rejection and suppresses retry for selection errors', async () => {
    const rejected = harness();
    rejected.startCustom.mockRejectedValueOnce(new Error('transport rejected'));
    await expect(rejected.run()).resolves.toMatchObject({ backend: 'typescript-fallback' });
    expect(rejected.fallback).toHaveBeenCalledOnce();

    const stale = harness();
    stale.startCustom.mockRejectedValueOnce({ code: 'native-scan-database-changed', message: 'revision changed' });
    await expect(stale.run()).resolves.toMatchObject({ cancelled: true, results: [] });
    expect(stale.fallback).not.toHaveBeenCalled();
  });

  it('suppresses native publication and fallback after a same-path revision change', async () => {
    const test = harness();
    test.readCapabilities.mockResolvedValue({ ...capabilities, customSignalSelection: '/fixture#3' });
    await expect(test.run()).resolves.toMatchObject({ cancelled: true, results: [] });
    expect(test.fallback).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('discards the buffered TypeScript retry if the revision changes during it', async () => {
    const test = harness();
    test.onStart(() => {
      test.batch([wireRows[0]]);
      test.finish(2);
    });
    test.readCapabilities.mockResolvedValueOnce(capabilities)
      .mockResolvedValueOnce({ ...capabilities, customSignalSelection: '/fixture#3' });
    await expect(test.run()).resolves.toMatchObject({ cancelled: true, results: [] });
    expect(test.fallback).toHaveBeenCalledOnce();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('discards partial rows on cancellation without calling TypeScript', async () => {
    let cancelled = false;
    const test = harness({ shouldCancel: () => cancelled });
    test.onStart(() => {
      test.batch([wireRows[0]]);
      cancelled = true;
      test.finish(1, matches, true);
    });
    await expect(test.run()).resolves.toMatchObject({ cancelled: true, results: [] });
    expect(test.fallback).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });
});

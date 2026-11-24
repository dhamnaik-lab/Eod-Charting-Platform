import { describe, expect, it, vi } from 'vitest';
import {
  createNativeScannerCapabilitiesV1,
  NATIVE_SCAN_CONTRACT_VERSION,
  NATIVE_SIGNAL_PRESET_IDS,
  type NativeScanCountsV1,
  type NativeScanMatchV1,
  type NativeScanRequestV1,
  type NativeScannerCapabilitiesV1,
} from '@/features/scanner/nativeScanContract';
import fixture from '@/features/scanner/fixtures/nativePresetSignalParityFixtures.v1.json';
import {
  readNativeScannerCapabilities,
  type subscribeToNativeScanEvents,
} from '@/platform/nativeScannerBridge';
import {
  canRunNatively,
  runNativeOrTypeScriptScannerBatch,
} from '@/plugins/scanner/nativeScannerRun';
import type { ScannerResult, ScannerRunOutput } from '@/plugins/scanner/types';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/platform/tauriDesktop', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/platform/tauriDesktop')>(),
  getTauriCore: async () => ({ invoke }),
}));

type Options = Parameters<typeof runNativeOrTypeScriptScannerBatch>[0];
type Handlers = Parameters<typeof subscribeToNativeScanEvents>[1];

const golden = 'signal_golden_cross';
const death = 'signal_death_cross';
const sample = fixture.cases.find((item) => item.caseId === 'golden-cross-at-51')!;
const expected = sample.expected.matches[0] as Omit<ScannerResult, 'generatedAt'>;
const { scannerId, matched: _matched, ...metadata } = expected;
const { values: scalars, ...wireMetadata } = metadata;
const row: NativeScanMatchV1 = {
  ...wireMetadata,
  ruleId: scannerId,
  values: { rule_id: scalars!.rule_id, trigger_price: scalars!.trigger_price,
    condition: scalars!.condition, close: scalars!.close },
};
const identity = '/fixture#1';
const noMatch = { targets: 1, matched: 0, noMatch: 1, skipped: 0, failed: 0 };
const withMatch = { ...noMatch, matched: 1, noMatch: 0 };
const oldShell = createNativeScannerCapabilitiesV1(2);
const supported: NativeScannerCapabilitiesV1 = {
  ...oldShell,
  signalPresets: { evaluatorVersion: 1, supportedIds: NATIVE_SIGNAL_PRESET_IDS },
};

function harness(options: Partial<Options> = {}) {
  let handlers: Handlers = {};
  let nextSequence = 1;
  let onStart: (request: NativeScanRequestV1) => void = () => complete(noMatch);
  const close = vi.fn();
  const start = vi.fn(async (request: NativeScanRequestV1) => {
    onStart(request);
    return { accepted: true, schemaVersion: 1, runId: request.requestedRunId,
      databaseIdentity: identity, workerCount: 1, totalTargets: 1 };
  });
  const fallback = vi.fn(async (): Promise<ScannerRunOutput> => ({
    results: [], alertTriggers: [], errors: [], scannedSymbols: 1, cancelled: false,
  }));
  const publish = vi.fn();
  const capabilities = vi.fn(async (): Promise<NativeScannerCapabilitiesV1> => supported);
  const subscribe = vi.fn(async (_runId: string, callbacks: Handlers) => {
    handlers = callbacks;
    return close;
  });
  const cancel = vi.fn(async (runId: string) => ({ runId, cancelRequested: true, alreadyFinished: false }));
  const event = (sequence: number) => ({
    eventVersion: 1 as const, runId: 'wp04-ui', sequence, databaseIdentity: identity,
  });
  const batch = (matches: NativeScanMatchV1[], sequence = nextSequence++) =>
    handlers.onMatches?.({ ...event(sequence), matches });
  const complete = (counts: NativeScanCountsV1, sequence = nextSequence++) =>
    handlers.onComplete?.({ ...event(sequence), cancelled: false, durationMs: 1, counts, diagnostics: [] });
  const run = () => runNativeOrTypeScriptScannerBatch({
    targets: [sample.target], scannerIds: [golden], lookbackBars: 51, evaluateHistory: false,
    toDate: sample.asOfDate, alertRules: [], expectedDatabasePath: '/fixture',
    getActiveDatabasePath: () => '/fixture', onResultChunk: publish, ...options,
  }, { runTypeScript: fallback, start, cancel, subscribe, readCapabilities: capabilities, newRunId: () => 'wp04-ui' });

  return { run, start, cancel, subscribe, close, fallback, publish, capabilities, batch, complete,
    onStart: (callback: typeof onStart) => { onStart = callback; } };
}

describe('WP-04 native preset opt-in pilot', () => {
  it('validates the raw executable descriptor before normalizing capability defaults', async () => {
    const raw = { ...supported, contractVersion: NATIVE_SCAN_CONTRACT_VERSION, schemaVersion: 1 };
    invoke.mockResolvedValueOnce(raw);
    await expect(readNativeScannerCapabilities()).resolves.toMatchObject({ signalPresets: supported.signalPresets });

    const invalid = [
      { ...raw, signalPresets: undefined },
      { ...raw, contractVersion: 'other' },
      { ...raw, schemaVersion: 2 },
      { ...raw, workerCount: 0 },
      { ...raw, signalPresets: { evaluatorVersion: 2, supportedIds: [golden] } },
      { ...raw, signalPresets: { evaluatorVersion: 1, supportedIds: [golden, golden] } },
      { ...raw, signalPresets: { evaluatorVersion: 1, supportedIds: ['unrecognized'] } },
      { ...raw, signalPresets: { evaluatorVersion: 1 } },
    ];
    for (const response of invalid) {
      invoke.mockResolvedValueOnce(response);
      expect((await readNativeScannerCapabilities()).signalPresets).toBeUndefined();
    }
  });

  it('accepts a zero-match completion with an advertised preset and preserves the requested window', async () => {
    expect(canRunNatively([golden], undefined, false, 20)).toBe(true);
    expect(canRunNatively([golden], undefined, false, 5000)).toBe(true);
    const test = harness({ lookbackBars: 20 });
    await expect(test.run()).resolves.toMatchObject({ backend: 'native', results: [] });
    expect(test.fallback).not.toHaveBeenCalled();
    expect(test.start.mock.calls[0]![0]).toMatchObject({
      evaluation: { lookbackBars: 20, priceBasis: 'raw', asOfDate: sample.asOfDate },
      rules: [{
        id: golden,
        expression: { kind: 'crossover', left: { kind: 'indicator', name: 'ema', period: 20 },
          right: { kind: 'indicator', name: 'sma', period: 50 } },
      }],
    });
    expect(test.close).toHaveBeenCalledOnce();
  });

  it('publishes the complete corrected TypeScript result with the same visible field order', async () => {
    const test = harness();
    test.onStart(() => {
      test.batch([row]);
      expect(test.publish).not.toHaveBeenCalled();
      test.complete(withMatch);
    });
    const output = await test.run();
    expect(output.backend).toBe('native');
    expect(output.results).toEqual([{ ...expected, generatedAt: expect.any(String) }]);
    expect(Object.keys(output.results[0]!.values!)).toEqual(Object.keys(expected.values!));
    expect(test.publish).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'mixed batch', options: { scannerIds: [golden, 'high_52w'] } },
    { label: 'custom signal', options: { scannerIds: ['signal_active_custom_rules'] } },
    { label: 'All History', options: { lookbackBars: null, evaluateHistory: true } },
    { label: 'oversized window', options: { lookbackBars: 5001 } },
    { label: 'too small a window', options: { lookbackBars: 19 } },
    { label: 'alert rules', options: { alertRules: [{}] as Options['alertRules'] } },
    { label: 'V1-inadmissible target', options: { targets: [{ exchange: 'BSE', symbol: 'TCS#' }] } },
  ])('keeps a $label on TypeScript without negotiating', async ({ options }) => {
    const test = harness(options);
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback' });
    expect(test.fallback).toHaveBeenCalledOnce();
    expect(test.capabilities).not.toHaveBeenCalled();
    expect(test.start).not.toHaveBeenCalled();
  });

  it.each([
    ['older shell', oldShell],
    ['partial capability', { ...supported, signalPresets: { evaluatorVersion: 1, supportedIds: [death] } }],
  ] as const)('falls back before subscribing for %s', async (_label, capability) => {
    const test = harness();
    test.capabilities.mockResolvedValueOnce(capability);
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback' });
    expect(test.subscribe).not.toHaveBeenCalled();
    expect(test.start).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'forged score', matches: [{ ...row, score: 80 }], counts: withMatch },
    { label: 'post-cutoff date', matches: [{ ...row, date: '2025-04-01' }], counts: withMatch },
    { label: 'extra scalar', matches: [{ ...row, values: { ...row.values, extra: 1 } }], counts: withMatch },
    { label: 'unrequested target', matches: [{ ...row, symbol: 'OTHER' }], counts: withMatch },
    { label: 'duplicate result', matches: [row, row], counts: withMatch },
    { label: 'loss of the only result batch', matches: [], counts: withMatch },
    { label: 'skipped target', matches: [], counts: { ...noMatch, noMatch: 0, skipped: 1 } },
    { label: 'failed target', matches: [], counts: { ...noMatch, noMatch: 0, failed: 1 } },
  ])('discards the native batch on $label', async ({ matches, counts }) => {
    const test = harness();
    test.onStart(() => { test.batch(matches); test.complete(counts); });
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback', results: [] });
    expect(test.fallback).toHaveBeenCalledOnce();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('falls back on a sequence gap even when matched-target counts agree', async () => {
    const test = harness();
    test.onStart(() => { test.batch([row], 2); test.complete(withMatch, 3); });
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback', results: [] });
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('discards late matches instead of repairing an incomplete terminal event', async () => {
    const test = harness();
    test.onStart(() => { test.complete(withMatch); test.batch([row], 3); });
    await expect(test.run()).resolves.toMatchObject({ backend: 'typescript-fallback', results: [] });
    expect(test.publish).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'change database'] as const)('does not start or fall back after %s during capability lookup', async (action) => {
    let cancelled = false;
    let database = '/fixture';
    const test = harness({ shouldCancel: () => cancelled, getActiveDatabasePath: () => database });
    test.capabilities.mockImplementationOnce(async () => {
      if (action === 'cancel') cancelled = true;
      else database = '/other';
      return supported;
    });
    await expect(test.run()).resolves.toMatchObject({ cancelled: true, results: [] });
    expect(test.start).not.toHaveBeenCalled();
    expect(test.subscribe).not.toHaveBeenCalled();
    expect(test.fallback).not.toHaveBeenCalled();
  });
});

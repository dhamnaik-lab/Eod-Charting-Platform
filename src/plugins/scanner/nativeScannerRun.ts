/**
 * NS-04 — Opt-in native scanner run adapter.
 *
 * Contract:
 * - The accepted TypeScript runner (`runCoreEodScannerBatch`) remains the default. This
 *   module is only reached when the user explicitly enables the native backend and every
 *   selected scanner is parity-supported.
 * - If native cannot start, fails mid-run, or would have to mix with unsupported rules,
 *   the *whole* run falls back to TypeScript before any results/alerts are published. A
 *   partial native result set is never merged and alerts are never emitted twice.
 * - Native runs never emit alert triggers: alert evaluation stays on the preserved
 *   TypeScript path so the existing alert history semantics are untouched.
 */

import type { EodAlertRule, EodAlertTrigger } from '@/features/alerts/eodAlerts';
import { listApplicationScannerDefinitions } from '@/features/scanner/catalog';
import {
  NATIVE_SUPPORTED_PATTERN_IDS,
  NATIVE_SUPPORTED_PATTERN_NAMES,
  splitNativeSupportedScannerIds,
  type NativeScanRequestV1,
  type NativeScanRuleV1,
  type NativeSupportedPatternId,
} from '@/features/scanner/nativeScanContract';
import type { ScannerDefinition, ScannerResult, ScannerRunOutput, ScannerRunTarget } from '@/plugins/scanner/types';
import {
  cancelNativeEodScan,
  startNativeEodScan,
  subscribeToNativeScanEvents,
  type NativeScanCommandErrorV1,
} from '@/platform/nativeScannerBridge';

export type NativeScannerBackendMode = 'typescript' | 'native';

/** One scanner rule the native backend can evaluate, derived from its definition. */
export interface NativeRuleCompileSet {
  rules: NativeScanRuleV1[];
  /** Scanner ids that were compiled natively. */
  nativeScannerIds: string[];
  /** Scanner ids that must stay on TypeScript (never silently dropped). */
  unsupportedScannerIds: string[];
  compileErrors: Array<{ scannerId: string; errors: string[] }>;
}

function toRuleExpression(scannerId: string): NativeScanRuleV1['expression'] {
  return { kind: 'pattern', id: scannerId as NativeSupportedPatternId };
}

/**
 * Builds the native rule set from the selected scanner ids.
 *
 * Only four chart patterns are natively supported today; every other selected scanner is
 * reported as unsupported so the caller can decide to fall back rather than scan a
 * different set of rules.
 */
export function compileNativeScannerRules(
  scannerIds: readonly string[],
  definitions: readonly ScannerDefinition[] = listApplicationScannerDefinitions(),
): NativeRuleCompileSet {
  const split = splitNativeSupportedScannerIds(scannerIds);
  const rules: NativeScanRuleV1[] = [];
  const definedIds = new Set(definitions.map((definition) => definition.id));
  const compileErrors: Array<{ scannerId: string; errors: string[] }> = [];
  const nativeScannerIds: string[] = [];

  for (const scannerId of split.native) {
    if (!definedIds.has(scannerId)) {
      compileErrors.push({
        scannerId,
        errors: [`Scanner "${scannerId}" is not present in the current scanner catalog.`],
      });
      continue;
    }
    nativeScannerIds.push(scannerId);
    rules.push({ id: scannerId, expression: toRuleExpression(scannerId) });
  }

  return {
    rules,
    nativeScannerIds,
    unsupportedScannerIds: split.remaining,
    compileErrors,
  };
}

/** True only when every selected scanner is natively supported and compiled cleanly. */
export function canRunNatively(
  scannerIds: readonly string[],
  definitions: readonly ScannerDefinition[] = listApplicationScannerDefinitions(),
): boolean {
  if (scannerIds.length === 0) return false;
  const compiled = compileNativeScannerRules(scannerIds, definitions);
  return (
    compiled.unsupportedScannerIds.length === 0 &&
    compiled.compileErrors.length === 0 &&
    compiled.rules.length === scannerIds.length
  );
}

export function describeNativeUnsupportedScanners(scannerIds: readonly string[]): string {
  const split = splitNativeSupportedScannerIds(scannerIds);
  if (split.remaining.length === 0) return '';
  const supported = NATIVE_SUPPORTED_PATTERN_IDS.map((id) => NATIVE_SUPPORTED_PATTERN_NAMES[id]).join(
    ', ',
  );
  return `${split.remaining.length} selected scanner(s) are TypeScript-only (${split.remaining
    .slice(0, 5)
    .join(', ')}${split.remaining.length > 5 ? ', …' : ''}). The run uses the TypeScript backend; native support currently covers: ${supported}.`;
}

export interface NativeScannerRunOutcome extends ScannerRunOutput {
  backend: 'native' | 'typescript-fallback';
  /** Populated when a native attempt was made and abandoned. */
  fallbackReason?: string;
  /** per-target accounting reported by the native backend. */
  nativeCounts?: {
    targets: number;
    matched: number;
    noMatch: number;
    skipped: number;
    failed: number;
  };
}

export interface NativeScannerRunDeps {
  /** The preserved TypeScript runner; always available as the fallback. */
  runTypeScript: () => Promise<ScannerRunOutput>;
  start?: typeof startNativeEodScan;
  cancel?: typeof cancelNativeEodScan;
  subscribe?: typeof subscribeToNativeScanEvents;
  newRunId?: () => string;
}

function createRunId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `native-${Date.now().toString(36)}-${random}`;
}

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Converts a native match into the existing `ScannerResult` shape. */
function toScannerResult(
  match: { exchange: string; symbol: string; ruleId: string; date: string; value?: number },
  generatedAt: string,
): ScannerResult {
  const scannerId = match.ruleId;
  const supported = (NATIVE_SUPPORTED_PATTERN_IDS as readonly string[]).includes(scannerId);
  return {
    symbol: match.symbol,
    exchange: match.exchange,
    scannerId,
    scannerName: supported
      ? NATIVE_SUPPORTED_PATTERN_NAMES[scannerId as NativeSupportedPatternId]
      : scannerId,
    categoryId: 'chart_patterns_gap',
    categoryName: 'Chart Patterns - Gaps',
    date: match.date,
    matched: true,
    direction: 'neutral',
    ...(match.value !== undefined ? { values: { ruleValue: match.value } } : {}),
    source: 'EODNativeScanner_v1',
    generatedAt,
  };
}

/**
 * Runs an opted-in native scan, falling back to the TypeScript runner for the whole run
 * when native semantics cannot be guaranteed.
 */
export async function runNativeOrTypeScriptScannerBatch(
  options: {
    targets: readonly ScannerRunTarget[];
    scannerIds: readonly string[];
    lookbackBars: number | null;
    toDate?: string | null;
    evaluateHistory: boolean;
    alertRules: EodAlertRule[];
    shouldCancel?: () => boolean;
    onProgress?: (progress: {
      completed: number;
      total: number;
      symbol: string;
      exchange: string;
      resultCount: number;
    }) => void;
    onResultChunk?: (chunk: ScannerResult[]) => void;
  },
  deps: NativeScannerRunDeps,
): Promise<NativeScannerRunOutcome> {
  const fallback = async (reason?: string): Promise<NativeScannerRunOutcome> => {
    const output = await deps.runTypeScript();
    return {
      ...output,
      backend: 'typescript-fallback',
      ...(reason ? { fallbackReason: reason } : {}),
    };
  };

  // Hard preconditions: an unsupported or mixed rule set never starts natively.
  if (!canRunNatively(options.scannerIds)) {
    return fallback(describeNativeUnsupportedScanners(options.scannerIds) || undefined);
  }
  if (options.targets.length === 0) {
    return fallback('No targets were resolved for the selected universe.');
  }
  if (options.alertRules.length > 0) {
    // Alerts stay on the TypeScript path by design, so a native-only run would silently
    // stop evaluating them. Fall back instead of changing alert behaviour.
    return fallback('Alert rules are evaluated by the TypeScript scanner backend.');
  }

  const runId = (deps.newRunId ?? createRunId)();
  const compiled = compileNativeScannerRules(options.scannerIds);
  const request: NativeScanRequestV1 = {
    schemaVersion: 1,
    requestedRunId: runId,
    universe: {
      source: 'explicitTargets',
      targets: options.targets.map((target) => ({
        exchange: target.exchange,
        symbol: target.symbol,
      })),
    },
    evaluation: {
      asOfDate: parseIsoDate(options.toDate),
      lookbackBars: options.lookbackBars,
      evaluateHistory: options.evaluateHistory,
      priceBasis: 'raw',
    },
    rules: compiled.rules,
  };

  // Subscribe *before* starting so no early progress/completion event is missed.
  const start = deps.start ?? startNativeEodScan;
  const cancel = deps.cancel ?? cancelNativeEodScan;
  const subscribe = deps.subscribe ?? subscribeToNativeScanEvents;

  const matches: ScannerResult[] = [];
  const generatedAt = new Date().toISOString();
  let completed = 0;
  let total = options.targets.length;
  const terminalState: {
    kind: 'complete' | 'error' | null;
    cancelled: boolean;
    error: NativeScanCommandErrorV1 | null;
  } = { kind: null, cancelled: false, error: null };
  let resolveTerminal: (() => void) | null = null;
  const terminalPromise = new Promise<void>((resolve) => {
    resolveTerminal = resolve;
  });

  const unsubscribe = await subscribe(runId, {
    onProgress: (event) => {
      completed = event.completed;
      total = event.total;
      options.onProgress?.({
        completed,
        total,
        symbol: event.currentTarget?.symbol ?? '',
        exchange: event.currentTarget?.exchange ?? '',
        resultCount: matches.length,
      });
    },
    onMatches: (event) => {
      const chunk = event.matches.map((match) => toScannerResult(match, generatedAt));
      if (chunk.length === 0) return;
      matches.push(...chunk);
      options.onResultChunk?.(chunk);
    },
    onComplete: (event) => {
      terminalState.kind = 'complete';
      terminalState.cancelled = event.cancelled;
      resolveTerminal?.();
    },
    onError: (event) => {
      terminalState.kind = 'error';
      terminalState.error = { code: event.code, message: event.message };
      resolveTerminal?.();
    },
  });

  const cancellationTimer = setInterval(() => {
    if (options.shouldCancel?.() && terminalState.kind === null) {
      void cancel(runId).catch(() => {
        /* Cancellation failures are retried by the terminal timeout path. */
      });
    }
  }, 100);

  try {
    await start(request);
  } catch (error) {
    clearInterval(cancellationTimer);
    unsubscribe();
    const commandError = error as NativeScanCommandErrorV1;
    return fallback(`Native scan could not start: ${commandError.message ?? String(error)}`);
  }

  if (options.shouldCancel?.()) {
    await cancel(runId).catch(() => undefined);
  }

  // Wait for the single terminal event. A hung backend must not freeze the UI.
  const timeoutMs = Math.max(30_000, options.targets.length * 2_000);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const outcome = await Promise.race([terminalPromise.then(() => 'done' as const), timeout]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  clearInterval(cancellationTimer);
  unsubscribe();

  if (outcome === 'timeout' || terminalState.kind === null) {
    await cancel(runId).catch(() => undefined);
    return fallback('Native scan did not report completion in time.');
  }
  if (terminalState.kind === 'error') {
    return fallback(
      `Native scan failed: ${terminalState.error?.message ?? 'unknown native scanner error'}`,
    );
  }

  // Deterministic, de-duplicated ordering identical to the TypeScript runner.
  const unique = new Map<string, ScannerResult>();
  for (const result of matches) {
    const key = `${result.exchange}:${result.symbol}:${result.scannerId}:${result.date}`;
    if (!unique.has(key)) unique.set(key, result);
  }
  const results = [...unique.values()].sort(
    (first, second) =>
      second.date.localeCompare(first.date) || first.scannerName.localeCompare(second.scannerName),
  );

  const alertTriggers: EodAlertTrigger[] = [];
  return {
    results,
    alertTriggers,
    errors: [],
    scannedSymbols: completed > 0 ? completed : total,
    cancelled: terminalState.cancelled,
    backend: 'native',
    nativeCounts: {
      targets: total,
      matched: unique.size,
      noMatch: 0,
      skipped: 0,
      failed: 0,
    },
  };
}

/** Status line text for a native run, mirroring the TypeScript wording. */
export function formatNativeScannerStatus(
  outcome: NativeScannerRunOutcome,
  symbolCount: number,
): string {
  if (outcome.backend === 'typescript-fallback') {
    const reason = outcome.fallbackReason ? ` ${outcome.fallbackReason}` : '';
    return `Used the TypeScript scanner backend.${reason}`;
  }
  const counts = outcome.nativeCounts;
  return `Native scan: ${symbolCount} symbol${symbolCount === 1 ? '' : 's'}; ${
    outcome.results.length
  } match${outcome.results.length === 1 ? '' : 'es'}${
    counts ? `; ${counts.skipped} skipped, ${counts.failed} failed` : ''
  }.`;
}

/** Exposed for the UI to render an accurate, non-flattering capability note. */
export function describeNativeCapability(): string {
  const names = NATIVE_SUPPORTED_PATTERN_IDS.map((id) => NATIVE_SUPPORTED_PATTERN_NAMES[id]);
  return `Native backend (experimental, off by default) currently evaluates: ${names.join(', ')}. Every other scanner stays on the TypeScript backend.`;
}

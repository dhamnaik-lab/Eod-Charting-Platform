/**
 * NS-04 — Opt-in native scanner run adapter.
 *
 * Contract:
 * - The accepted TypeScript runner (`runCoreEodScannerBatch`) remains the default. This
 *   module is only reached when the user explicitly enables the native backend and every
 *   selected scanner has a supported native implementation. Core OHLCV rules are
 *   latest-endpoint only; full-history core runs stay on TypeScript.
 * - If native cannot start, fails mid-run, or would have to mix with unsupported rules,
 *   the *whole* run falls back to TypeScript before any results/alerts are published. A
 *   partial native result set is never merged and alerts are never emitted twice.
 * - Native runs never emit alert triggers: alert evaluation stays on the preserved
 *   TypeScript path so the existing alert history semantics are untouched.
 */

import type { EodAlertRule, EodAlertTrigger } from '@/features/alerts/eodAlerts';
import { listApplicationScannerDefinitions } from '@/features/scanner/catalog';
import { isNativeBuiltInResultId, nativeCoreResultMetadataIssue } from '@/features/scanner/nativeCoreResultMetadataGate';
import { compileNativeBuiltInCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import {
  NATIVE_SCAN_LIMITS,
  NATIVE_SUPPORTED_PATTERN_IDS,
  NATIVE_SUPPORTED_PATTERN_NAMES,
  type NativeScanCountsV1,
  type NativeScanDiagnosticV1,
  type NativeScanMatchV1,
  type NativeScanPatternDetailsV1,
  type NativeScanRequestV1,
  type NativeScanRuleV1,
  type NativeSupportedPatternId,
} from '@/features/scanner/nativeScanContract';
import type {
  ChartPatternFamily,
  ChartPatternGeometry,
  ChartPatternResultDetails,
} from '@/features/chartPatterns/types';
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import { dailyMarketScannerDefinitions } from '@/plugins/scanner/dailyMarketScanners';
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
 * Native eligibility is deliberately separate from the pattern-only V1 contract:
 * all 54 built-in chart patterns, the ten built-in core OHLCV rules, and the five
 * Daily Market rules may compile (bounded by `NATIVE_SCAN_LIMITS.maxRules` per run).
 * Other plugins, signals and custom rules remain TypeScript-only.
 */
function splitNativeRunnableScannerIds(scannerIds: readonly string[]): {
  native: string[];
  remaining: string[];
} {
  const patternIds = new Set<string>(NATIVE_SUPPORTED_PATTERN_IDS);
  const native: string[] = [];
  const remaining: string[] = [];
  for (const id of scannerIds) {
    if (patternIds.has(id) || isNativeBuiltInResultId(id)) {
      native.push(id);
    } else {
      remaining.push(id);
    }
  }
  return { native, remaining };
}

/**
 * Builds a complete native rule set. The Rust backend also validates built-in rule IDs
 * against the exact expected AST and rejects historical core/daily-market evaluations.
 */
export function compileNativeScannerRules(
  scannerIds: readonly string[],
  definitions: readonly ScannerDefinition[] = listApplicationScannerDefinitions(),
): NativeRuleCompileSet {
  const split = splitNativeRunnableScannerIds(scannerIds);
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
    const expression = isNativeBuiltInResultId(scannerId)
      ? compileNativeBuiltInCandidate(scannerId)
      : toRuleExpression(scannerId);
    if (!expression) {
      compileErrors.push({
        scannerId,
        errors: [`No approved native expression for scanner "${scannerId}".`],
      });
      continue;
    }
    nativeScannerIds.push(scannerId);
    rules.push({ id: scannerId, expression });
  }

  return {
    rules,
    nativeScannerIds,
    unsupportedScannerIds: split.remaining,
    compileErrors,
  };
}

/** True only when every selected scanner is natively supported, fits `maxRules`, and compiled cleanly. */
export function canRunNatively(
  scannerIds: readonly string[],
  definitions: readonly ScannerDefinition[] = listApplicationScannerDefinitions(),
  evaluateHistory = false,
): boolean {
  if (scannerIds.length === 0) return false;
  // Core and Daily Market handlers return one latest result even when the TypeScript runner
  // scans full history. Never claim a native history run would be equivalent.
  if (evaluateHistory && scannerIds.some(isNativeBuiltInResultId)) return false;
  const compiled = compileNativeScannerRules(scannerIds, definitions);
  return (
    compiled.unsupportedScannerIds.length === 0 &&
    compiled.compileErrors.length === 0 &&
    compiled.rules.length === scannerIds.length &&
    compiled.rules.length <= NATIVE_SCAN_LIMITS.maxRules
  );
}

export function describeNativeUnsupportedScanners(
  scannerIds: readonly string[],
  evaluateHistory = false,
): string {
  if (evaluateHistory && scannerIds.some(isNativeBuiltInResultId)) {
    return 'Core OHLCV and Daily Market native scanning support bounded/latest-bar runs only. Full-history core and daily market scans use the TypeScript backend.';
  }
  const split = splitNativeRunnableScannerIds(scannerIds);
  if (split.remaining.length === 0) {
    if (split.native.length > NATIVE_SCAN_LIMITS.maxRules) {
      return `Selected ${split.native.length} native rules exceeds the single-run limit of ${NATIVE_SCAN_LIMITS.maxRules} rules. The run uses the TypeScript backend for the complete selection.`;
    }
    return '';
  }
  return `${split.remaining.length} selected scanner(s) are TypeScript-only (${split.remaining
    .slice(0, 5)
    .join(', ')}${split.remaining.length > 5 ? ', …' : ''}). The run uses the TypeScript backend; native supports ${NATIVE_SUPPORTED_PATTERN_IDS.length} chart patterns, ten core OHLCV scanners, and five daily market scanners (latest-bar only).`;
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

/** The registry supplies a Windows folder; folder mtime is not a revision authority. */
function normalizeDatabasePath(path: string | null | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Recognize today's native identity as registered folder plus optional mtime suffix. */
function nativeIdentityMatchesPath(identity: string, selectedFolder: string): boolean {
  const suffixStart = identity.lastIndexOf('#');
  const folder =
    suffixStart >= 0 && /^\d+$/.test(identity.slice(suffixStart + 1))
      ? identity.slice(0, suffixStart)
      : identity;
  return normalizeDatabasePath(folder) === normalizeDatabasePath(selectedFolder);
}

/**
 * P0-02: converts native pattern details into the accepted `ChartPatternResultDetails`.
 *
 * The native side transports `family`/`pivot.kind` as strings because Rust enums are
 * lowered generically. Rather than casting blindly, the value is validated against the
 * accepted union: a recognised member is preserved, and anything unrecognised is dropped
 * with the rest of that detail group instead of being forced into a wrong category.
 */
const CHART_PATTERN_FAMILIES = new Set(['gap', 'reversal', 'continuation', 'neutral-bilateral']);
const PIVOT_KINDS = new Set(['high', 'low']);

function toChartPatternDetails(
  details: NativeScanPatternDetailsV1,
): ChartPatternResultDetails | undefined {
  if (!CHART_PATTERN_FAMILIES.has(details.family)) return undefined;
  const family = details.family as ChartPatternFamily;
  const pivots = details.pivots?.flatMap((pivot) =>
    PIVOT_KINDS.has(pivot.kind)
      ? [{ index: pivot.index, date: pivot.date, price: pivot.price, kind: pivot.kind as 'high' | 'low' }]
      : [],
  );
  const geometry =
    details.geometry && typeof details.geometry === 'object'
      ? (details.geometry as ChartPatternGeometry)
      : undefined;
  return {
    family,
    confidence: details.confidence,
    ...(details.patternStartDate ? { patternStartDate: details.patternStartDate } : {}),
    patternEndDate: details.patternEndDate,
    ...(details.breakoutLevel !== null && details.breakoutLevel !== undefined
      ? { breakoutLevel: details.breakoutLevel }
      : {}),
    ...(details.supportLevel !== null && details.supportLevel !== undefined
      ? { supportLevel: details.supportLevel }
      : {}),
    ...(details.resistanceLevel !== null && details.resistanceLevel !== undefined
      ? { resistanceLevel: details.resistanceLevel }
      : {}),
    ...(details.necklineLevel !== null && details.necklineLevel !== undefined
      ? { necklineLevel: details.necklineLevel }
      : {}),
    ...(details.targetPrice !== null && details.targetPrice !== undefined
      ? { targetPrice: details.targetPrice }
      : {}),
    ...(details.stopLossPrice !== null && details.stopLossPrice !== undefined
      ? { stopLossPrice: details.stopLossPrice }
      : {}),
    ...(details.potentialGainPct !== null && details.potentialGainPct !== undefined
      ? { potentialGainPct: details.potentialGainPct }
      : {}),
    ...(details.riskRewardRatio !== null && details.riskRewardRatio !== undefined
      ? { riskRewardRatio: details.riskRewardRatio }
      : {}),
    ...(pivots && pivots.length > 0 ? { pivots } : {}),
    ...(geometry ? { geometry } : {}),
  };
}

/**
 * Converts a native match into the existing `ScannerResult` shape.
 *
 * P0-02: the accepted metadata is propagated rather than replaced with neutral
 * placeholders — scanner identity/name, category, direction, score, reasons, scalar
 * values and the full chart-pattern details (levels, pivots, geometry) all survive.
 * Only genuinely absent fields fall back, so the renderer can still distinguish
 * "pattern did not report a level" from "level is zero".
 */
function toScannerResult(match: NativeScanMatchV1, generatedAt: string): ScannerResult {
  const scannerId = match.ruleId;
  const supported = (NATIVE_SUPPORTED_PATTERN_IDS as readonly string[]).includes(scannerId);
  const direction = match.direction ?? (match.pattern ? 'neutral' : undefined);
  return {
    symbol: match.symbol,
    exchange: match.exchange,
    scannerId,
    scannerName:
      match.scannerName ??
      (supported ? NATIVE_SUPPORTED_PATTERN_NAMES[scannerId as NativeSupportedPatternId] : scannerId),
    categoryId: match.categoryId ?? 'chart_patterns_gap',
    categoryName: match.categoryName ?? 'Chart Patterns - Gaps',
    date: match.date,
    matched: true,
    ...(direction ? { direction } : {}),
    ...(match.score !== undefined ? { score: match.score } : {}),
    ...(match.reasons && match.reasons.length > 0 ? { reasons: match.reasons } : {}),
    ...(match.values ? { values: match.values } : {}),
    ...(match.pattern
      ? (() => {
          const details = toChartPatternDetails(match.pattern);
          return details ? { chartPattern: details } : {};
        })()
      : {}),
    ...(match.source ? { source: match.source } : {}),
    // Accepted core and Daily Market TypeScript results include an explicit empty warnings array.
    ...(isNativeBuiltInResultId(scannerId) ? { warnings: [] } : {}),
    // Grouped historical annotation for consecutive pattern matches. The native executor
    // groups exactly like the TypeScript evaluation, so ScannerWindow can render the same
    // history counts on either backend.
    ...(match.history
      ? {
          history: {
            firstMatchedDate: match.history.firstMatchedDate,
            lastMatchedDate: match.history.lastMatchedDate,
            matchCount: match.history.matchCount,
          },
        }
      : {}),
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
    /** The registered database selection at the start of UI preparation. */
    expectedDatabasePath?: string | null;
    /** Read the live database selection instead of a stale React closure. */
    getActiveDatabasePath?: () => string | null;
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
  const databaseSelectionChanged = (): boolean =>
    options.getActiveDatabasePath !== undefined &&
    normalizeDatabasePath(options.getActiveDatabasePath()) !==
      normalizeDatabasePath(options.expectedDatabasePath);

  const cancelledForDatabaseChange = (
    reason = 'Native scan cancelled because the active database changed.',
  ): NativeScannerRunOutcome => ({
    backend: 'native',
    results: [],
    alertTriggers: [],
    errors: [reason],
    scannedSymbols: 0,
    cancelled: true,
  });

  const fallback = async (reason?: string): Promise<NativeScannerRunOutcome> => {
    // Never retry a scan of database A against the newly selected database B.
    if (databaseSelectionChanged()) return cancelledForDatabaseChange();
    const output = await deps.runTypeScript();
    if (databaseSelectionChanged()) return cancelledForDatabaseChange();
    return {
      ...output,
      backend: 'typescript-fallback',
      ...(reason ? { fallbackReason: reason } : {}),
    };
  };

  if (databaseSelectionChanged()) return cancelledForDatabaseChange();

  // Hard preconditions: an unsupported or mixed rule set never starts natively.
  if (!canRunNatively(options.scannerIds, undefined, options.evaluateHistory)) {
    return fallback(describeNativeUnsupportedScanners(options.scannerIds, options.evaluateHistory) || undefined);
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

  // P1-09: matches are buffered until the run is accepted as complete. If native fails or
  // is cancelled after several batches have already arrived, none of those provisional
  // results are ever published, so a TypeScript fallback cannot produce duplicates or
  // stale rows. `onResultChunk` therefore fires once, with the final accepted set.
  const matches: ScannerResult[] = [];
  // A malformed or unrequested native rule must never reach the published UI.
  // Reject the entire run rather than emitting partial results with guessed metadata.
  let rejectedNativeMatch: string | null = null;
  const selectedRuleIds = new Set(options.scannerIds);
  const generatedAt = new Date().toISOString();
  let completed = 0;
  let total = options.targets.length;
  const terminalState: {
    kind: 'complete' | 'error' | null;
    cancelled: boolean;
    error: NativeScanCommandErrorV1 | null;
    counts: NativeScanCountsV1 | null;
    diagnostics: NativeScanDiagnosticV1[];
  } = {
    kind: null,
    cancelled: false,
    error: null,
    counts: null,
    diagnostics: [],
  };
  let resolveTerminal: (() => void) | null = null;
  const terminalPromise = new Promise<void>((resolve) => {
    resolveTerminal = resolve;
  });
  // Event delivery may precede the start acknowledgement; pin every event identity
  // and compare against the authoritative acknowledgement before publishing.
  let acknowledgedIdentity: string | null = null;
  const observedIdentities = new Set<string>();
  let identityMismatch = false;
  const recordEventIdentity = (identity: string): boolean => {
    if (!identity) {
      identityMismatch = true;
    } else {
      observedIdentities.add(identity);
      if (acknowledgedIdentity !== null && identity !== acknowledgedIdentity) {
        identityMismatch = true;
      }
    }
    if (identityMismatch) resolveTerminal?.();
    return !identityMismatch;
  };

  const unsubscribe = await subscribe(runId, {
    onProgress: (event) => {
      // P1-10: a stale or superseded run can never move this run's progress.
      if (terminalState.kind !== null || !recordEventIdentity(event.databaseIdentity) ||
          databaseSelectionChanged()) return;
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
      if (!recordEventIdentity(event.databaseIdentity) || databaseSelectionChanged()) return;
      const chunk: ScannerResult[] = [];
      for (const match of event.matches) {
        if (!selectedRuleIds.has(match.ruleId)) {
          rejectedNativeMatch = `Unrequested rule ID "${match.ruleId}" in native match.`;
          continue;
        }
        const metadataIssue = nativeCoreResultMetadataIssue(match);
        if (metadataIssue) {
          rejectedNativeMatch = metadataIssue;
          continue;
        }
        chunk.push(toScannerResult(match, generatedAt));
      }
      if (chunk.length === 0) return;
      // Buffered only; published after the terminal event is accepted.
      matches.push(...chunk);
    },
    onComplete: (event) => {
      // P1-10: only the first terminal event for this run counts; duplicates are ignored.
      if (terminalState.kind !== null || !recordEventIdentity(event.databaseIdentity)) return;
      terminalState.kind = 'complete';
      terminalState.cancelled = event.cancelled;
      terminalState.counts = event.counts;
      terminalState.diagnostics = event.diagnostics;
      resolveTerminal?.();
    },
    onError: (event) => {
      // The bridge may emit a synthetic subscription failure without DB identity.
      if (terminalState.kind !== null ||
          (event.code !== 'native-scan-events-unavailable' &&
            !recordEventIdentity(event.databaseIdentity))) return;
      terminalState.kind = 'error';
      terminalState.error = { code: event.code, message: event.message };
      terminalState.counts = event.counts;
      terminalState.diagnostics = event.diagnostics;
      resolveTerminal?.();
    },
  });

  const cancellationTimer = setInterval(() => {
    if ((options.shouldCancel?.() || databaseSelectionChanged() || identityMismatch) &&
        terminalState.kind === null) {
      void cancel(runId).catch(() => {
        /* Cancellation failures are retried by the terminal timeout path. */
      });
    }
  }, 100);

  let acknowledgement: Awaited<ReturnType<typeof start>>;
  try {
    acknowledgement = await start(request);
  } catch (error) {
    clearInterval(cancellationTimer);
    unsubscribe();
    const commandError = error as NativeScanCommandErrorV1;
    return fallback(`Native scan could not start: ${commandError.message ?? String(error)}`);
  }
  acknowledgedIdentity = acknowledgement.databaseIdentity;
  const invalidAcknowledgement =
    !acknowledgement.accepted ||
    acknowledgement.runId !== runId ||
    !acknowledgedIdentity ||
    [...observedIdentities].some((identity) => identity !== acknowledgedIdentity) ||
    (options.expectedDatabasePath !== undefined &&
      (options.expectedDatabasePath === null ||
        !nativeIdentityMatchesPath(acknowledgedIdentity, options.expectedDatabasePath)));
  if (invalidAcknowledgement || identityMismatch || databaseSelectionChanged()) {
    await cancel(runId).catch(() => undefined);
    clearInterval(cancellationTimer);
    unsubscribe();
    return cancelledForDatabaseChange(
      invalidAcknowledgement || identityMismatch
        ? 'Native scan rejected a mismatched run or database identity.'
        : undefined,
    );
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

  // Never publish a completed result into an obsolete database-selection context.
  if (identityMismatch || databaseSelectionChanged()) {
    await cancel(runId).catch(() => undefined);
    return cancelledForDatabaseChange(
      identityMismatch ? 'Native scan rejected an event from another database.' : undefined,
    );
  }

  if (outcome === 'timeout' || terminalState.kind === null) {
    await cancel(runId).catch(() => undefined);
    return fallback('Native scan did not report completion in time.');
  }
  if (terminalState.kind === 'error') {
    // Backend detects registry revisions that a renderer path-only guard cannot see.
    // Never re-run TypeScript against an A -> B -> A reselected database.
    if (terminalState.error?.code === 'native-scan-database-changed') {
      return cancelledForDatabaseChange();
    }
    return fallback(
      `Native scan failed: ${terminalState.error?.message ?? 'unknown native scanner error'}`,
    );
  }

  // A native result with an unrequested rule or incomplete core metadata cannot be
  // considered an accepted scan. Buffered matches have not been published yet.
  if (rejectedNativeMatch && !terminalState.cancelled) {
    return fallback(`Native result rejected: ${rejectedNativeMatch}`);
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

  // P0-02/P1-05: a cancelled run publishes nothing partial, and the reported counts come
  // from the backend's own terminal event rather than zero-filled placeholders.
  const counts = terminalState.counts;
  const published = terminalState.cancelled || databaseSelectionChanged() ? [] : results;
  if (published.length > 0) {
    options.onResultChunk?.(published);
  }

  return {
    results: published,
    alertTriggers: [] as EodAlertTrigger[],
    // Skipped/failed targets are surfaced to the user, not hidden behind a success line.
    errors: terminalState.diagnostics
      .filter((diagnostic) => diagnostic.code !== 'target-notice')
      .map((diagnostic) => diagnostic.message),
    scannedSymbols: counts ? counts.targets : completed > 0 ? completed : total,
    cancelled: terminalState.cancelled || databaseSelectionChanged(),
    backend: 'native',
    nativeCounts: {
      targets: counts?.targets ?? total,
      matched: counts?.matched ?? 0,
      noMatch: counts?.noMatch ?? 0,
      skipped: counts?.skipped ?? 0,
      failed: counts?.failed ?? 0,
    },
  };
}

/**
 * Completion summary shared by the Scanner window's native and TypeScript paths.
 * Keep the accepted TypeScript, fallback, and cancellation wording unchanged;
 * only completed native scans use the backend's real skipped/failed accounting.
 */
export function formatScannerCompletionStatus(
  outcome: ScannerRunOutput | NativeScannerRunOutcome,
  symbolCount: number,
): string {
  const scannedSummary =
    `Scanned ${outcome.scannedSymbols} symbol${outcome.scannedSymbols === 1 ? '' : 's'}; ${outcome.results.length} match${outcome.results.length === 1 ? '' : 'es'}; ${outcome.alertTriggers.length} alert${outcome.alertTriggers.length === 1 ? '' : 's'}.`;

  if ('backend' in outcome && outcome.backend === 'typescript-fallback') {
    const suffix = outcome.cancelled
      ? `Scan cancelled after ${outcome.scannedSymbols} symbol${outcome.scannedSymbols === 1 ? '' : 's'}.`
      : scannedSummary;
    return `${formatNativeScannerStatus(outcome, symbolCount)} ${suffix}`;
  }

  if (outcome.cancelled) {
    return `Scan cancelled after ${outcome.scannedSymbols} symbol${outcome.scannedSymbols === 1 ? '' : 's'}; ${outcome.results.length} match${outcome.results.length === 1 ? '' : 'es'} recorded.`;
  }

  if ('backend' in outcome && outcome.backend === 'native') {
    return formatNativeScannerStatus(outcome, symbolCount);
  }

  return scannedSummary;
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
  const parts = [`${symbolCount} symbol${symbolCount === 1 ? '' : 's'}`];
  parts.push(`${outcome.results.length} match${outcome.results.length === 1 ? '' : 'es'}`);
  if (counts) {
    if (counts.noMatch > 0) parts.push(`${counts.noMatch} no match`);
    if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
    if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  }
  if (outcome.errors.length > 0) {
    parts.push(`${outcome.errors.length} diagnostic${outcome.errors.length === 1 ? '' : 's'}`);
  }
  const prefix = counts && (counts.skipped > 0 || counts.failed > 0) ? 'Native scan (incomplete)' : 'Native scan';
  return `${prefix}: ${parts.join('; ')}.`;
}

/** Exposed for the UI to render an accurate, non-flattering capability note. */
export function describeNativeCapability(): string {
  return `Native backend (experimental, off by default) evaluates all ${NATIVE_SUPPORTED_PATTERN_IDS.length} built-in chart patterns (up to ${NATIVE_SCAN_LIMITS.maxRules} rules per run), ${coreOhlcvScannerDefinitions.length} core OHLCV scanners, and ${dailyMarketScannerDefinitions.length} daily market scanners (latest-bar/bounded runs only). Oversized (> ${NATIVE_SCAN_LIMITS.maxRules} rule) selections, full-history core/daily market scans, and other rules stay on TypeScript.`;
}

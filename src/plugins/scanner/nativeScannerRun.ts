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

import type { ChartSignalRule } from '@/engine/types';
import type { EodAlertRule, EodAlertTrigger } from '@/features/alerts/eodAlerts';
import {
  compileNativeCustomSignalRules,
  isNativeCustomSignalCapability,
  isNativeCustomSignalSelection,
  NATIVE_CUSTOM_SIGNAL_LIMITS,
  nativeCustomSignalMatchIssue,
  type NativeCustomSignalRequestV1,
} from '@/features/scanner/nativeCustomSignals';
import { ACTIVE_CUSTOM_SIGNAL_SCANNER_ID } from '@/plugins/scanner/signalScanners';
import { listApplicationScannerDefinitions } from '@/features/scanner/catalog';
import { isNativeBuiltInResultId, nativeCoreResultMetadataIssue } from '@/features/scanner/nativeCoreResultMetadataGate';
import { compileNativeBuiltInCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import {
  compileNativeSignalPreset,
  isNativeSignalPresetWindow,
  nativeSignalPresetMatchIssue,
} from '@/features/scanner/nativeSignalPresets';
import {
  NATIVE_SCAN_LIMITS,
  NATIVE_SUPPORTED_PATTERN_IDS,
  NATIVE_SUPPORTED_PATTERN_NAMES,
  NATIVE_SIGNAL_PRESET_EVALUATOR_VERSION,
  isNativeSignalPresetId,
  type NativeNumericHistoryCoverageV1,
  type NativeScanCountsV1,
  type NativeScanDiagnosticV1,
  type NativeScanMatchV1,
  type NativeScanPatternDetailsV1,
  type NativeScanRequestV1,
  type NativeScanRuleV1,
  type NativeScannerCapabilitiesV1,
  validateNativeCustomSignalEnvelope,
  type NativeSupportedPatternId,
  validateNativeScanRequestV1,
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
  readNativeScannerCapabilities,
  startNativeEodScan,
  subscribeToNativeScanEvents,
  type NativeScanCommandErrorV1,
  type NativeScanStartAckV1,
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
 * The four signal presets can compile in a preset-only batch.
 */
function splitNativeRunnableScannerIds(scannerIds: readonly string[]): {
  native: string[];
  remaining: string[];
} {
  const patternIds = new Set<string>(NATIVE_SUPPORTED_PATTERN_IDS);
  const presetOnly = scannerIds.length > 0 && scannerIds.every(isNativeSignalPresetId);
  const native: string[] = [];
  const remaining: string[] = [];
  for (const id of scannerIds) {
    if (presetOnly || patternIds.has(id) || isNativeBuiltInResultId(id)) {
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
    const expression = isNativeSignalPresetId(scannerId)
      ? compileNativeSignalPreset(scannerId)
      : isNativeBuiltInResultId(scannerId)
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
  lookbackBars?: number | null,
): boolean {
  if (scannerIds.length === 0) return false;
  if (scannerIds.includes(ACTIVE_CUSTOM_SIGNAL_SCANNER_ID)) {
    return isNativeCustomSignalSelection(scannerIds) && !evaluateHistory && isNativeSignalPresetWindow(lookbackBars);
  }
  if (scannerIds.some(isNativeSignalPresetId) &&
      (evaluateHistory || !isNativeSignalPresetWindow(lookbackBars))) return false;
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
  lookbackBars?: number | null,
): string {
  if (scannerIds.includes(ACTIVE_CUSTOM_SIGNAL_SCANNER_ID) &&
      (!isNativeCustomSignalSelection(scannerIds) || evaluateHistory || !isNativeSignalPresetWindow(lookbackBars))) {
    return 'Native custom signals require Active Custom Signal Rules by itself and a latest scan with 20 to 5,000 bars. The complete selection uses TypeScript.';
  }
  if (scannerIds.some(isNativeSignalPresetId) &&
      (evaluateHistory || !isNativeSignalPresetWindow(lookbackBars) || !scannerIds.every(isNativeSignalPresetId))) {
    return 'Native signal presets require a preset-only latest scan with a lookback of 20 to 5,000 bars. The complete selection uses TypeScript.';
  }
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
  numericHistoryCoverage?: readonly NativeNumericHistoryCoverageV1[];
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
  start?: (request: NativeScanRequestV1) => Promise<NativeScanStartAckV1>;
  startCustom?: (request: NativeCustomSignalRequestV1) => Promise<NativeScanStartAckV1>;
  cancel?: typeof cancelNativeEodScan;
  subscribe?: typeof subscribeToNativeScanEvents;
  readCapabilities?: typeof readNativeScannerCapabilities;
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
  const values = (isNativeSignalPresetId(scannerId) || scannerId === ACTIVE_CUSTOM_SIGNAL_SCANNER_ID) && match.values
    ? {
        close: match.values.close,
        trigger_price: match.values.trigger_price,
        condition: match.values.condition,
        rule_id: match.values.rule_id,
      }
    : match.values;
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
    ...(values ? { values } : {}),
    ...(match.pattern
      ? (() => {
          const details = toChartPatternDetails(match.pattern);
          return details ? { chartPattern: details } : {};
        })()
      : {}),
    ...(match.source ? { source: match.source } : {}),
    // Accepted TypeScript results for built-in patterns, core, and Daily Market include empty warnings.
    ...(supported || isNativeBuiltInResultId(scannerId) ? { warnings: [] } : {}),
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
    signalRules?: readonly ChartSignalRule[];
    /** Captured before resolving the explicit target universe. */
    customSignalCapabilities?: NativeScannerCapabilitiesV1;
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
  const presetPilot = options.scannerIds.length > 0 && options.scannerIds.every(isNativeSignalPresetId);
  const customPilot = isNativeCustomSignalSelection(options.scannerIds);
  const strictSignals = presetPilot || customPilot;
  const signalKind = customPilot ? 'custom signal' : 'signal preset';
  const customCapability = options.customSignalCapabilities?.customSignals;
  const customIdentity = customPilot && isNativeCustomSignalCapability(customCapability)
    ? options.customSignalCapabilities?.customSignalSelection : undefined;
  const readCapabilities = deps.readCapabilities ?? readNativeScannerCapabilities;
  const databaseSelectionChanged = (): boolean =>
    options.getActiveDatabasePath !== undefined &&
    normalizeDatabasePath(options.getActiveDatabasePath()) !==
      normalizeDatabasePath(options.expectedDatabasePath);

  const customSelectionStillCurrent = async (): Promise<boolean> => {
    if (databaseSelectionChanged()) return false;
    if (!customIdentity) return true;
    if (!options.expectedDatabasePath || !nativeIdentityMatchesPath(customIdentity, options.expectedDatabasePath)) return false;
    const current = await readCapabilities(true).catch(() => undefined);
    return !databaseSelectionChanged() &&
      isNativeCustomSignalCapability(current?.customSignals) && current?.customSignalSelection === customIdentity;
  };

  const cancelledWithoutResults = (reason?: string): NativeScannerRunOutcome => ({
    backend: 'native',
    results: [],
    alertTriggers: [],
    errors: reason ? [reason] : [],
    scannedSymbols: 0,
    cancelled: true,
  });
  const cancelledForDatabaseChange = (reason = 'Native scan cancelled because the active database changed.') =>
    cancelledWithoutResults(reason);

  const fallback = async (reason?: string): Promise<NativeScannerRunOutcome> => {
    // Never retry a scan of database A against the newly selected database B.
    if (databaseSelectionChanged() || (customIdentity && !await customSelectionStillCurrent())) {
      return cancelledForDatabaseChange();
    }
    if (strictSignals && options.shouldCancel?.()) return cancelledWithoutResults();
    const output = await deps.runTypeScript();
    if (databaseSelectionChanged() || (customIdentity && !await customSelectionStillCurrent())) {
      return cancelledForDatabaseChange();
    }
    if (customPilot && options.shouldCancel?.()) return cancelledWithoutResults();
    return {
      ...output,
      backend: 'typescript-fallback',
      ...(reason ? { fallbackReason: reason } : {}),
    };
  };

  if (databaseSelectionChanged()) return cancelledForDatabaseChange();

  // Hard preconditions: an unsupported or mixed rule set never starts natively.
  if (!canRunNatively(options.scannerIds, undefined, options.evaluateHistory, options.lookbackBars)) {
    return fallback(describeNativeUnsupportedScanners(options.scannerIds, options.evaluateHistory, options.lookbackBars) || undefined);
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
  const compiled = customPilot ? null : compileNativeScannerRules(options.scannerIds);
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
    rules: compiled?.rules ?? [],
  };

  let customRequest: NativeCustomSignalRequestV1 | null = null;
  if (customPilot) {
    const customRules = compileNativeCustomSignalRules(options.signalRules);
    const { rules: _rules, ...envelope } = request;
    const validated = validateNativeCustomSignalEnvelope(envelope);
    const validatedTargets = validated.ok && validated.request.universe.source === 'explicitTargets'
      ? validated.request.universe.targets : [];
    if (!customRules?.length || validatedTargets.length !== options.targets.length ||
        (options.toDate && !request.evaluation.asOfDate) ||
        validatedTargets.some(({ exchange, symbol }, index) =>
          exchange !== options.targets[index].exchange || symbol !== options.targets[index].symbol)) {
      return fallback('The native custom-signal selection has unsupported rules, targets or dates.');
    }
    if (!isNativeCustomSignalCapability(customCapability)) {
      return fallback('This executable does not advertise the required native custom-signal capability.');
    }
    if (options.targets.length * customRules.length > customCapability.maxPossibleResults) {
      return fallback('The native custom-signal selection exceeds the result limit.');
    }
    if (!customIdentity || !options.expectedDatabasePath ||
        !nativeIdentityMatchesPath(customIdentity, options.expectedDatabasePath)) {
      return cancelledForDatabaseChange('The native custom-signal database selection could not be verified.');
    }
    customRequest = {
      ...envelope,
      customSignals: {
        evaluatorVersion: customCapability.evaluatorVersion,
        databaseIdentity: customIdentity,
        rules: customRules,
      },
    };
  }

  if (presetPilot) {
    if ((options.toDate && !request.evaluation.asOfDate) ||
        options.targets.some(({ exchange, symbol }) => exchange !== exchange.toUpperCase() || symbol !== symbol.toUpperCase()) ||
        !validateNativeScanRequestV1(request).ok) {
      return fallback('Native signal presets require valid V1 targets and an as-of date in YYYY-MM-DD format.');
    }

    if (options.shouldCancel?.()) return cancelledWithoutResults();
    const capability = await readCapabilities().catch(() => undefined);
    if (databaseSelectionChanged()) return cancelledForDatabaseChange();
    if (options.shouldCancel?.()) return cancelledWithoutResults();
    const presets = capability?.signalPresets;
    if (presets?.evaluatorVersion !== NATIVE_SIGNAL_PRESET_EVALUATOR_VERSION ||
        !Array.isArray(presets.supportedIds) || !options.scannerIds.every((id) => presets.supportedIds.includes(id))) {
      return fallback('This executable does not advertise the required native signal presets.');
    }
  }

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
  const targetKey = (target: { exchange: string; symbol: string }) => JSON.stringify([target.exchange, target.symbol]);
  const signalTargets = new Map(strictSignals ? options.targets.map((target, index) => [targetKey(target), index]) : []);
  const customRules = new Map(customRequest?.customSignals.rules.map((rule, index) => [rule.id, { rule, index }]));
  const signalMatchDates = new Map<string, string>();
  const signalMatchKeys = new Set<string>();
  let signalSequence = 0;
  const recordSignalSequence = (sequence: number) => {
    if (!strictSignals) return;
    if (sequence !== signalSequence + 1) {
      rejectedNativeMatch = 'The native ' + signalKind + ' event stream is incomplete.';
    }
    signalSequence = sequence;
  };
  const generatedAt = new Date().toISOString();
  let completed = 0;
  let total = options.targets.length;
  const terminalState: {
    kind: 'complete' | 'error' | null;
    cancelled: boolean;
    error: NativeScanCommandErrorV1 | null;
    counts: NativeScanCountsV1 | null;
    diagnostics: NativeScanDiagnosticV1[];
    numericHistoryCoverage?: readonly NativeNumericHistoryCoverageV1[];
    customSignalResultCount?: number;
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
    if (!identity || (customIdentity && identity !== customIdentity)) {
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
      recordSignalSequence(event.sequence);
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
      if (strictSignals && terminalState.kind !== null) return;
      if (!recordEventIdentity(event.databaseIdentity) || databaseSelectionChanged()) return;
      recordSignalSequence(event.sequence);
      if ((strictSignals && !Array.isArray(event.matches)) ||
          (customPilot && (event.matches.length > NATIVE_CUSTOM_SIGNAL_LIMITS.maxEventBatchSize ||
            event.matches.length + matches.length > signalTargets.size * customRules.size))) {
        rejectedNativeMatch = 'Missing or oversized native ' + signalKind + ' match batch.';
        return;
      }
      const chunk: ScannerResult[] = [];
      for (const match of event.matches) {
        if (strictSignals && (!match || typeof match !== 'object')) {
          rejectedNativeMatch = 'Malformed native ' + signalKind + ' match.';
          continue;
        }
        if (!selectedRuleIds.has(match.ruleId)) {
          rejectedNativeMatch = `Unrequested rule ID "${match.ruleId}" in native match.`;
          continue;
        }
        const ruleId = match.values?.rule_id;
        const metadataIssue = customPilot
          ? nativeCustomSignalMatchIssue(match, typeof ruleId === 'string' ? customRules.get(ruleId)?.rule : undefined, request.evaluation.asOfDate ?? null)
          : presetPilot
            ? nativeSignalPresetMatchIssue(match, request.evaluation.asOfDate ?? null)
            : nativeCoreResultMetadataIssue(match);
        if (metadataIssue) {
          rejectedNativeMatch = metadataIssue;
          continue;
        }
        if (strictSignals) {
          const target = targetKey(match);
          const matchKey = JSON.stringify([target, customPilot ? ruleId : match.ruleId, match.date]);
          const priorDate = signalMatchDates.get(target);
          if (!signalTargets.has(target) || signalMatchKeys.has(matchKey) ||
              (priorDate !== undefined && priorDate !== match.date)) {
            rejectedNativeMatch = 'Unexpected target, duplicate match or conflicting date in native ' + signalKind + ' results.';
            continue;
          }
          signalMatchDates.set(target, match.date);
          signalMatchKeys.add(matchKey);
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
      recordSignalSequence(event.sequence);
      terminalState.kind = 'complete';
      if (strictSignals && typeof event.cancelled !== 'boolean') {
        rejectedNativeMatch = 'Invalid native ' + signalKind + ' completion status.';
      }
      terminalState.cancelled = event.cancelled === true;
      terminalState.counts = event.counts;
      terminalState.diagnostics = event.diagnostics;
      terminalState.numericHistoryCoverage = event.numericHistoryCoverage;
      terminalState.customSignalResultCount = event.customSignalResultCount;
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
  }).catch((error: unknown) => {
    if (!customPilot) throw error;
    return null;
  });

  if (!unsubscribe) return fallback('Native custom-signal events could not be subscribed.');
  if (customPilot && terminalState.kind === 'error') {
    unsubscribe();
    return fallback('Native custom-signal events are unavailable.');
  }
  if (strictSignals && (databaseSelectionChanged() || options.shouldCancel?.())) {
    unsubscribe();
    return databaseSelectionChanged() ? cancelledForDatabaseChange() : cancelledWithoutResults();
  }

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
    acknowledgement = customRequest
      ? await (deps.startCustom ?? startNativeEodScan)(customRequest)
      : await start(request);
  } catch (error) {
    clearInterval(cancellationTimer);
    unsubscribe();
    const commandError = error as NativeScanCommandErrorV1;
    if (customPilot) {
      await cancel(runId).catch(() => undefined);
      if (commandError?.code === 'native-scan-database-changed') return cancelledForDatabaseChange();
    }
    return fallback(`Native scan could not start: ${commandError?.message ?? String(error)}`);
  }
  acknowledgedIdentity = acknowledgement?.databaseIdentity ?? null;
  const invalidAcknowledgement =
    !acknowledgement?.accepted ||
    acknowledgement.runId !== runId ||
    !acknowledgedIdentity ||
    (customIdentity !== undefined && acknowledgedIdentity !== customIdentity) ||
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

  if (strictSignals && (acknowledgement.schemaVersion !== request.schemaVersion ||
      acknowledgement.totalTargets !== signalTargets.size)) {
    await cancel(runId).catch(() => undefined);
    clearInterval(cancellationTimer);
    unsubscribe();
    return fallback('Native ' + signalKind + ' acknowledgement did not match the requested batch.');
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

  if (strictSignals && options.shouldCancel?.()) return cancelledWithoutResults();
  if (customPilot && terminalState.cancelled) return cancelledWithoutResults();
  if (strictSignals && !terminalState.cancelled) {
    const counts = terminalState.counts;
    if (!counts || counts.targets !== signalTargets.size || counts.failed !== 0 || counts.skipped !== 0 ||
        counts.matched !== signalMatchDates.size || counts.noMatch !== counts.targets - counts.matched ||
        (customPilot && terminalState.customSignalResultCount !== matches.length) ||
        !Array.isArray(terminalState.diagnostics) || terminalState.diagnostics.length !== 0) {
      return fallback('Native ' + signalKind + ' completion was incomplete; retrying the full selection in TypeScript.');
    }
  }
  if (customPilot) {
    if (!await customSelectionStillCurrent()) return cancelledForDatabaseChange();
    if (options.shouldCancel?.()) return cancelledWithoutResults();
  }

  // Generic matches have one rule per scanner ID. Custom matches already have
  // distinct configured rule identities and were validated as a complete set.
  const unique = new Map<string, ScannerResult>();
  for (const result of customPilot ? [] : matches) {
    const key = `${result.exchange}:${result.symbol}:${result.scannerId}:${result.date}`;
    if (!unique.has(key)) unique.set(key, result);
  }
  const targetOrder = (result: ScannerResult) => signalTargets.get(targetKey(result)) ?? 0;
  const ruleOrder = (result: ScannerResult) => customRules.get(String(result.values?.rule_id))?.index ?? 0;
  const results = (customPilot ? matches : [...unique.values()]).sort(
    (first, second) =>
      second.date.localeCompare(first.date) || first.scannerName.localeCompare(second.scannerName) ||
      (customPilot ? targetOrder(first) - targetOrder(second) || ruleOrder(first) - ruleOrder(second) : 0),
  );

  // P0-02/P1-05: a cancelled run publishes nothing partial, and the reported counts come
  // from the backend's own terminal event rather than zero-filled placeholders.
  const counts = terminalState.counts;
  const published = terminalState.cancelled || databaseSelectionChanged() ? [] : results;
  if (published.length > 0) {
    options.onResultChunk?.(published);
  }

  const cancelled = terminalState.cancelled || databaseSelectionChanged();
  return {
    results: published,
    alertTriggers: [] as EodAlertTrigger[],
    // Skipped/failed targets are surfaced to the user, not hidden behind a success line.
    errors: terminalState.diagnostics
      .filter((diagnostic) => diagnostic.code !== 'target-notice')
      .map((diagnostic) => diagnostic.message),
    scannedSymbols: counts ? counts.targets : completed > 0 ? completed : total,
    cancelled,
    backend: 'native',
    ...(!cancelled && options.evaluateHistory && terminalState.numericHistoryCoverage?.length
      ? { numericHistoryCoverage: terminalState.numericHistoryCoverage }
      : {}),
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
 * Keep TypeScript and fallback wording unchanged. Native terminal counts include
 * skipped targets, so a cancelled native run reports them as targets, not scanned symbols.
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
    if ('backend' in outcome && outcome.backend === 'native' && outcome.nativeCounts) {
      const { targets, skipped, failed } = outcome.nativeCounts;
      const resultCount = outcome.results.length;
      return `Native scan cancelled. Recorded ${resultCount} match${resultCount === 1 ? '' : 'es'}. ${targets} target symbol${targets === 1 ? '' : 's'} (${skipped} skipped, ${failed} failed).`;
    }
    return `Scan cancelled after ${outcome.scannedSymbols} symbol${outcome.scannedSymbols === 1 ? '' : 's'}; ${outcome.results.length} match${outcome.results.length === 1 ? '' : 'es'} recorded.`;
  }

  if ('backend' in outcome && outcome.backend === 'native') {
    const status = formatNativeScannerStatus(outcome, symbolCount);
    const coverage = formatNumericHistoryCoverage(outcome.numericHistoryCoverage ?? []);
    return coverage ? `${status} ${coverage}` : status;
  }

  return scannedSummary;
}

function formatNumericHistoryCoverage(coverage: readonly NativeNumericHistoryCoverageV1[]): string {
  let first = '';
  let last = '';
  let evaluated = 0;
  let omitted = 0;
  let targets = 0;
  let olderInputUnknown = 0;
  for (const target of coverage) {
    if (target.rules.length === 0) continue;
    targets += 1;
    if (target.olderInputUnknown) olderInputUnknown += 1;
    for (const rule of target.rules) {
      if (first === '' || rule.firstEvaluatedDate < first) first = rule.firstEvaluatedDate;
      if (last === '' || rule.lastEvaluatedDate > last) last = rule.lastEvaluatedDate;
      evaluated += rule.evaluatedEndpointCount;
      omitted += rule.omittedEligibleEndpointCount;
    }
  }
  if (targets === 0) return '';

  const messages = [
    `Numeric history evaluated ${evaluated} rule endpoints across ${targets} target symbols from ${first} through ${last}.`,
  ];
  if (omitted > 0) {
    messages.push(`${omitted} eligible rule endpoints were omitted within the loaded data.`);
  }
  if (olderInputUnknown > 0) {
    messages.push(`Older bars may exist for ${olderInputUnknown} of these target symbols.`);
  }
  return messages.join(' ');
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
  return `Native backend (experimental, off by default) evaluates all ${NATIVE_SUPPORTED_PATTERN_IDS.length} built-in chart patterns (up to ${NATIVE_SCAN_LIMITS.maxRules} rules per run), ${coreOhlcvScannerDefinitions.length} core OHLCV scanners, and ${dailyMarketScannerDefinitions.length} daily market scanners (latest-bar/bounded runs only). Built-in signal presets and Active Custom Signal Rules support their own latest-only selections with a 20–5,000 bar lookback. Oversized (> ${NATIVE_SCAN_LIMITS.maxRules} rule) selections, full-history core/daily market scans, and other rules stay on TypeScript.`;
}

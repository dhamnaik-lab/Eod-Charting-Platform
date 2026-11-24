import type { ChartSignalRule, IndicatorSource, SignalTarget } from '@/engine/types';
import { ACTIVE_CUSTOM_SIGNAL_SCANNER_ID } from '@/plugins/scanner/signalScanners';
import { NATIVE_SCAN_LIMITS, type NativeScanMatchV1, type NativeScanRequestV1 } from './nativeScanContract';

const CUSTOM_SIGNAL_VERSION = 1;
export const NATIVE_CUSTOM_SIGNAL_LIMITS = {
  maxRules: NATIVE_SCAN_LIMITS.maxRules,
  maxPossibleResults: 4096,
  maxEventBatchSize: 100,
  maxRuleIdBytes: 128,
  maxLabelBytes: 256,
} as const;

export type NativeCustomSignalCapabilitiesV1 = typeof NATIVE_CUSTOM_SIGNAL_LIMITS & {
  evaluatorVersion: typeof CUSTOM_SIGNAL_VERSION;
};

const indicatorPlots = new Map<string, 'ema20' | 'sma50' | 'sma200' | 'rsi14'>([
  ['ema_20', 'ema20'], ['ema_20:ema', 'ema20'],
  ['sma_50', 'sma50'], ['sma_50:sma', 'sma50'],
  ['sma_200', 'sma200'], ['sma_200:sma', 'sma200'],
  ['rsi_14', 'rsi14'], ['rsi_14:rsi', 'rsi14'],
]);
const supportedSources = new Set<IndicatorSource>(['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4']);
const supportedConditions = new Set(['crosses_above', 'crosses_below', 'greater_than', 'less_than']);
const supportedShapes = new Set(['arrow_up', 'arrow_down', 'circle', 'square', 'cross']);
const supportedPositions = new Set(['above_bar', 'below_bar', 'on_series']);
const utf8 = new TextEncoder();

type Binding =
  | { kind: 'constant'; value: number }
  | { kind: 'indicator'; plot: 'ema20' | 'sma50' | 'sma200' | 'rsi14' }
  | { kind: 'ohlc'; source: IndicatorSource };

export type NativeCustomSignalRule = Pick<ChartSignalRule, 'id' | 'label' | 'conditionType' | 'shape' | 'position'> & {
  seriesA: Binding;
  seriesB: Binding;
};

export type NativeCustomSignalRequestV1 = Omit<NativeScanRequestV1, 'rules'> & {
  customSignals: {
    evaluatorVersion: typeof CUSTOM_SIGNAL_VERSION;
    databaseIdentity: string;
    rules: NativeCustomSignalRule[];
  };
};

export function isNativeCustomSignalSelection(ids: readonly string[]): boolean {
  return ids.length === 1 && ids[0] === ACTIVE_CUSTOM_SIGNAL_SCANNER_ID;
}

export function isNativeCustomSignalCapability(value: unknown): value is NativeCustomSignalCapabilitiesV1 {
  if (typeof value !== 'object' || value === null) return false;
  const descriptor = value as Partial<NativeCustomSignalCapabilitiesV1>;
  return descriptor.evaluatorVersion === CUSTOM_SIGNAL_VERSION &&
    descriptor.maxRules === NATIVE_CUSTOM_SIGNAL_LIMITS.maxRules &&
    descriptor.maxPossibleResults === NATIVE_CUSTOM_SIGNAL_LIMITS.maxPossibleResults &&
    descriptor.maxEventBatchSize === NATIVE_CUSTOM_SIGNAL_LIMITS.maxEventBatchSize &&
    descriptor.maxRuleIdBytes === NATIVE_CUSTOM_SIGNAL_LIMITS.maxRuleIdBytes &&
    descriptor.maxLabelBytes === NATIVE_CUSTOM_SIGNAL_LIMITS.maxLabelBytes;
}

function resolveBinding(target: SignalTarget | undefined): Binding | null {
  if (target == null) return { kind: 'ohlc', source: 'close' };
  if (typeof target !== 'object' || Array.isArray(target)) return null;
  if (target.staticValue != null) {
    return Number.isFinite(target.staticValue) ? { kind: 'constant', value: target.staticValue } : null;
  }
  if ((target.indicatorId != null && typeof target.indicatorId !== 'string') ||
      (target.plotKey != null && typeof target.plotKey !== 'string')) return null;
  const key = target.indicatorId && target.plotKey
    ? target.indicatorId + ':' + target.plotKey
    : target.indicatorId;
  const plot = key ? indicatorPlots.get(key) : undefined;
  if (plot) return { kind: 'indicator', plot };
  const source = target.source ?? 'close';
  return supportedSources.has(source) ? { kind: 'ohlc', source } : null;
}

export function compileNativeCustomSignalRules(
  rules: readonly ChartSignalRule[] | undefined,
): NativeCustomSignalRule[] | null {
  const result: NativeCustomSignalRule[] = [];
  const ids = new Set<string>();
  for (const rule of rules ?? []) {
    if (!rule || typeof rule !== 'object') return null;
    if (rule.enabled === false) continue;
    if (rule.enabled !== true || typeof rule.id !== 'string' || rule.id.trim().length === 0 ||
        utf8.encode(rule.id).length > NATIVE_CUSTOM_SIGNAL_LIMITS.maxRuleIdBytes || ids.has(rule.id) ||
        typeof rule.label !== 'string' || utf8.encode(rule.label).length > NATIVE_CUSTOM_SIGNAL_LIMITS.maxLabelBytes ||
        !supportedConditions.has(rule.conditionType) ||
        (rule.shape != null && !supportedShapes.has(rule.shape)) ||
        (rule.position != null && !supportedPositions.has(rule.position)) ||
        result.length >= NATIVE_CUSTOM_SIGNAL_LIMITS.maxRules) return null;

    const seriesA = resolveBinding(rule.seriesA);
    const seriesB = resolveBinding(rule.seriesB);
    if (!seriesA || !seriesB) return null;
    ids.add(rule.id);
    result.push({
      id: rule.id,
      label: rule.label,
      conditionType: rule.conditionType,
      seriesA,
      seriesB,
      ...(rule.shape ? { shape: rule.shape } : {}),
      ...(rule.position ? { position: rule.position } : {}),
    });
  }
  return result;
}

export function nativeCustomSignalMatchIssue(
  match: NativeScanMatchV1,
  rule: NativeCustomSignalRule | undefined,
  cutoff: string | null,
): string | null {
  const values = match.values;
  const date = match.date;
  const time = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(date + 'T00:00:00Z') : NaN;
  if (!rule || match.ruleId !== ACTIVE_CUSTOM_SIGNAL_SCANNER_ID || !values ||
      Object.keys(values).length !== 4 || values.rule_id !== rule.id || values.condition !== rule.conditionType ||
      typeof values.close !== 'number' || !Number.isFinite(values.close) || values.close <= 0 ||
      typeof values.trigger_price !== 'number' || !Number.isFinite(values.trigger_price) ||
      !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date ||
      (cutoff !== null && date > cutoff) ||
      match.value != null || match.source != null || match.pattern != null || match.history != null) {
    return 'A native custom-signal result contains invalid rule, date or value data.';
  }
  const bullish = rule.conditionType === 'crosses_above' ||
    (rule.conditionType === 'greater_than' && rule.shape === 'arrow_up');
  const bearish = rule.conditionType === 'crosses_below' ||
    (rule.conditionType === 'less_than' && rule.shape === 'arrow_down');
  if (match.categoryId !== 'visual_signals' || match.categoryName !== 'Visual Signals & Crossovers' ||
      match.scannerName !== (rule.label || 'Custom Signal Rule') + ' (' + rule.label + ')' ||
      match.direction !== (bullish ? 'bullish' : bearish ? 'bearish' : 'neutral') ||
      match.score !== (bullish ? 85 : 80) ||
      !Array.isArray(match.reasons) || match.reasons.length !== 1 ||
      match.reasons[0] !== 'Triggered ' + rule.label + ' on ' + date) {
    return 'A native custom-signal result contains invalid Scanner metadata.';
  }
  return null;
}

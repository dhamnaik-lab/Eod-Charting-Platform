import { buildDefaultPresetSignalRules, signalScannerDefinitions } from '@/plugins/scanner/signalScanners';
import {
  isNativeSignalPresetId,
  NATIVE_SCAN_LIMITS,
  type NativeSignalPresetId,
  type NativeExprV1,
  type NativeScanMatchV1,
} from './nativeScanContract';

const ruleIds: Record<NativeSignalPresetId, string> = {
  signal_golden_cross: 'preset_golden_cross',
  signal_death_cross: 'preset_death_cross',
  signal_rsi_oversold_bounce: 'preset_rsi_oversold',
  signal_rsi_overbought_drop: 'preset_rsi_overbought',
};

const presetRules = new Map(buildDefaultPresetSignalRules().map((rule) => [rule.id, rule]));
const definitions = new Map(signalScannerDefinitions.map((definition) => [definition.id, definition]));

export function isNativeSignalPresetWindow(lookbackBars: number | null | undefined): boolean {
  return typeof lookbackBars === 'number' && Number.isInteger(lookbackBars) &&
    lookbackBars >= 20 && lookbackBars <= NATIVE_SCAN_LIMITS.maxLookbackBars;
}

export function compileNativeSignalPreset(id: NativeSignalPresetId): NativeExprV1 {
  const indicator = (name: 'ema' | 'sma' | 'rsi', period: number): NativeExprV1 =>
    ({ kind: 'indicator', name, period, input: { kind: 'field', field: 'close', lookback: 0 } });

  switch (id) {
    case 'signal_golden_cross':
      return { kind: 'crossover', left: indicator('ema', 20), right: indicator('sma', 50) };
    case 'signal_death_cross':
      return { kind: 'crossunder', left: indicator('ema', 20), right: indicator('sma', 50) };
    case 'signal_rsi_oversold_bounce':
      return { kind: 'crossover', left: indicator('rsi', 14), right: { kind: 'number', value: 30 } };
    case 'signal_rsi_overbought_drop':
      return { kind: 'crossunder', left: indicator('rsi', 14), right: { kind: 'number', value: 70 } };
  }
}

export function nativeSignalPresetMatchIssue(match: NativeScanMatchV1, asOfDate: string | null): string | null {
  if (!isNativeSignalPresetId(match.ruleId)) return 'Unrequested native signal preset.';
  if (typeof match.exchange !== 'string' || typeof match.symbol !== 'string' || typeof match.date !== 'string') {
    return 'Native signal preset returned an invalid identity.';
  }
  const rule = presetRules.get(ruleIds[match.ruleId]);
  const definition = definitions.get(match.ruleId);
  if (!rule || !definition) return 'Native signal preset definition is unavailable.';
  const date = new Date(match.date);
  if (!Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== match.date || (asOfDate && match.date > asOfDate)) {
    return 'Native signal preset returned an invalid date.';
  }

  const bullish = rule.conditionType === 'crosses_above';
  const expectedName = definition.name + ' (' + rule.label + ')';
  const expectedReason = 'Triggered ' + rule.label + ' on ' + match.date;
  if (match.scannerName !== expectedName || match.categoryId !== definition.categoryId ||
      match.categoryName !== definition.categoryName ||
      match.direction !== (bullish ? 'bullish' : 'bearish') || match.score !== (bullish ? 85 : 80) ||
      !Array.isArray(match.reasons) || match.reasons.length !== 1 || match.reasons[0] !== expectedReason ||
      match.source !== undefined || match.value !== undefined || match.pattern !== undefined ||
      match.history !== undefined || 'warnings' in match) {
    return 'Native signal preset result metadata differs from the TypeScript contract.';
  }
  const values = match.values;
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length !== 4 ||
      typeof values.close !== 'number' || !Number.isFinite(values.close) ||
      typeof values.trigger_price !== 'number' || !Number.isFinite(values.trigger_price) ||
      values.condition !== rule.conditionType || values.rule_id !== rule.id) {
    return 'Native signal preset result values differ from the TypeScript contract.';
  }
  return null;
}

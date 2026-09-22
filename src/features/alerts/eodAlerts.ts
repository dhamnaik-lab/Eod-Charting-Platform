import type { InstrumentKey } from '@/platform';
import type { ChartDrawing, ChartIndicator } from '@/engine/types';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';
import {
  buildIndicatorAlertSeriesBundle,
  getDefaultIndicatorAlertPresetForIndicator,
  getDefaultIndicatorAlertPresetDefinition,
  getIndicatorAlertLatestPair,
  getIndicatorAlertSeriesPair,
  type IndicatorAlertSeriesOperator,
  type IndicatorAlertSeriesKey,
  type IndicatorAlertSeriesRequest,
} from '@/features/alerts/indicatorAlertContracts';

export type EodAlertScope = 'current-chart' | 'any-scanned-symbol';
export type EodAlertConditionType = 'price' | 'scanner_match' | 'indicator' | 'drawing';
export type EodAlertPriceField = 'open' | 'high' | 'low' | 'close' | 'volume' | 'changePercent';
export type EodAlertOperator = 'above' | 'below' | 'crosses_above' | 'crosses_below';
export type EodAlertFrequency = 'once' | 'once_per_symbol_date' | 'every_scan' | 'once_until_reset';
export type EodAlertIndicatorOperator = IndicatorAlertSeriesOperator;
export type EodAlertDrawingKind = 'hline' | 'trendline' | 'ray';
export type EodAlertDrawingOperator = 'crosses' | 'crosses_above' | 'crosses_below';
export type EodAlertDrawingStatus = 'linked' | 'missing';

export interface EodAlertRule {
  id: string;
  enabled: boolean;
  locked: boolean;
  name: string;
  scope: EodAlertScope;
  conditionType: EodAlertConditionType;
  frequency: EodAlertFrequency;
  exchange?: string | null;
  symbol?: string | null;
  priceField?: EodAlertPriceField;
  operator?: EodAlertOperator;
  value?: number | null;
  scannerId?: string | null;
  scannerName?: string | null;
  indicatorId?: string | null;
  indicatorKind?: string | null;
  indicatorLabel?: string | null;
  indicatorPresetId?: string | null;
  indicatorLeft?: IndicatorAlertSeriesKey | null;
  indicatorRight?: IndicatorAlertSeriesKey | null;
  indicatorOperator?: EodAlertIndicatorOperator | null;
  indicatorValue?: number | null;
  drawingId?: string | null;
  drawingKind?: EodAlertDrawingKind | null;
  drawingLabel?: string | null;
  drawingOperator?: EodAlertDrawingOperator | null;
  drawingPrice?: number | null;
  drawingStartIndex?: number | null;
  drawingStartDate?: string | null;
  drawingStartPrice?: number | null;
  drawingEndIndex?: number | null;
  drawingEndDate?: string | null;
  drawingEndPrice?: number | null;
  drawingStatus?: EodAlertDrawingStatus | null;
  drawingMissingAt?: string | null;
  message?: string | null;
  lastTriggeredKey?: string | null;
  lastTriggeredAt?: string | null;
  triggeredKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EodAlertTrigger {
  id: string;
  ruleId: string;
  ruleName: string;
  exchange: string;
  symbol: string;
  date: string;
  condition: string;
  triggerValue?: number | string | null;
  message: string;
  scannerId?: string | null;
  scannerName?: string | null;
  generatedAt: string;
}

export interface EodAlertHistoryEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  exchange: string;
  symbol: string;
  date: string;
  condition: string;
  triggerValue?: number | string | null;
  message: string;
  scannerId?: string | null;
  scannerName?: string | null;
  triggeredAt: string;
  scannedAt: string;
}

export interface EodAlertEvaluationContext {
  exchange: string;
  symbol: string;
  bars: EodBar[];
}

const PRICE_FIELDS: EodAlertPriceField[] = ['open', 'high', 'low', 'close', 'volume', 'changePercent'];
const OPERATORS: EodAlertOperator[] = ['above', 'below', 'crosses_above', 'crosses_below'];
const INDICATOR_OPERATORS: EodAlertIndicatorOperator[] = ['above', 'below', 'crosses_above', 'crosses_below'];
const MAX_ALERT_HISTORY_EVENTS = 500;
const MAX_RULE_TRIGGERED_KEYS = 500;

export function normalizeEodAlertRules(value: unknown): EodAlertRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeEodAlertRule)
    .filter((rule): rule is EodAlertRule => Boolean(rule));
}

export function normalizeEodAlertHistoryEvents(value: unknown): EodAlertHistoryEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeEodAlertHistoryEvent)
    .filter((event): event is EodAlertHistoryEvent => Boolean(event))
    .sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))
    .slice(0, MAX_ALERT_HISTORY_EVENTS);
}

export function createPriceAlertRule(instrument: InstrumentKey | null, currentClose?: number | null): EodAlertRule {
  const now = new Date().toISOString();
  const symbolLabel = instrument ? `${instrument.exchange}:${instrument.symbol}` : 'Current chart';
  return {
    id: createAlertId(),
    enabled: true,
    locked: true,
    name: `${symbolLabel} close above`,
    scope: 'current-chart',
    conditionType: 'price',
    frequency: 'once_per_symbol_date',
    exchange: instrument?.exchange ?? null,
    symbol: instrument?.symbol ?? null,
    priceField: 'close',
    operator: 'above',
    value: Number.isFinite(currentClose) ? Number(currentClose) : null,
    message: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createScannerMatchAlertRule(result: ScannerResult): EodAlertRule {
  const now = new Date().toISOString();
  return {
    id: createAlertId(),
    enabled: true,
    locked: true,
    name: `${result.scannerName} match`,
    scope: 'any-scanned-symbol',
    conditionType: 'scanner_match',
    frequency: 'once_per_symbol_date',
    scannerId: result.scannerId,
    scannerName: result.scannerName,
    message: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createIndicatorAlertRule(
  instrument: InstrumentKey | null,
  indicator?: ChartIndicator | null,
): EodAlertRule | null {
  const now = new Date().toISOString();
  const symbolLabel = instrument ? `${instrument.exchange}:${instrument.symbol}` : 'Any scanned symbol';
  const preset = indicator
    ? getDefaultIndicatorAlertPresetForIndicator(indicator)
    : getDefaultIndicatorAlertPresetDefinition();
  if (!preset) {
    return null;
  }
  const rule: EodAlertRule = {
    id: createAlertId(),
    enabled: true,
    locked: true,
    name: `${symbolLabel} ${preset.label}`,
    scope: instrument ? 'current-chart' : 'any-scanned-symbol',
    conditionType: 'indicator',
    frequency: 'once_per_symbol_date',
    exchange: instrument?.exchange ?? null,
    symbol: instrument?.symbol ?? null,
    indicatorId: indicator?.id ?? null,
    indicatorKind: indicator?.kind ?? null,
    indicatorLabel: indicator ? formatIndicatorRuleSourceLabel(indicator) : null,
    indicatorPresetId: preset.id,
    indicatorLeft: preset.left,
    indicatorRight: preset.right,
    indicatorOperator: preset.operator,
    indicatorValue: preset.value,
    message: '',
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...rule,
    name: `${symbolLabel} ${formatIndicatorAlertCondition(rule)}`,
  };
}

export function createDrawingAlertRule(
  instrument: InstrumentKey,
  drawing: ChartDrawing,
  bars: EodBar[],
): EodAlertRule | null {
  if (!isSupportedDrawingAlertDrawing(drawing)) {
    return null;
  }
  const geometryPatch = buildDrawingAlertGeometryPatch(drawing, bars);
  if (!geometryPatch) {
    return null;
  }

  const now = new Date().toISOString();
  const drawingLabel = formatDrawingAlertLabel(drawing);
  const baseRule = {
    id: createAlertId(),
    enabled: true,
    locked: true,
    name: `${instrument.exchange}:${instrument.symbol} ${drawingLabel} cross`,
    scope: 'current-chart' as const,
    conditionType: 'drawing' as const,
    frequency: 'once_per_symbol_date' as const,
    exchange: instrument.exchange,
    symbol: instrument.symbol,
    drawingId: drawing.id,
    drawingKind: drawing.kind,
    drawingLabel,
    drawingOperator: 'crosses' as const,
    drawingStatus: 'linked' as const,
    drawingMissingAt: null,
    message: '',
    createdAt: now,
    updatedAt: now,
  };

  if (drawing.kind === 'hline') {
    return {
      ...baseRule,
      ...geometryPatch,
    };
  }

  return {
    ...baseRule,
    ...geometryPatch,
  };
}

export function buildDrawingAlertGeometryPatch(
  drawing: ChartDrawing,
  bars: EodBar[],
): Partial<EodAlertRule> | null {
  if (!isSupportedDrawingAlertDrawing(drawing)) {
    return null;
  }
  if (drawing.kind === 'hline') {
    return {
      drawingKind: drawing.kind,
      drawingLabel: formatDrawingAlertLabel(drawing),
      drawingPrice: drawing.price,
      drawingStatus: 'linked',
      drawingMissingAt: null,
    };
  }
  return {
    drawingKind: drawing.kind,
    drawingLabel: formatDrawingAlertLabel(drawing),
    drawingStartIndex: drawing.startIndex,
    drawingStartDate: bars[drawing.startIndex]?.date ?? null,
    drawingStartPrice: drawing.startPrice,
    drawingEndIndex: drawing.endIndex,
    drawingEndDate: bars[drawing.endIndex]?.date ?? null,
    drawingEndPrice: drawing.endPrice,
    drawingStatus: 'linked',
    drawingMissingAt: null,
  };
}

export function createEodAlertHistoryEvents(
  triggers: EodAlertTrigger[],
  scannedAt = new Date().toISOString(),
): EodAlertHistoryEvent[] {
  return triggers.map((trigger) => ({
    id: `${trigger.id}:${scannedAt}`,
    ruleId: trigger.ruleId,
    ruleName: trigger.ruleName,
    exchange: trigger.exchange,
    symbol: trigger.symbol,
    date: trigger.date,
    condition: trigger.condition,
    triggerValue: trigger.triggerValue ?? null,
    message: trigger.message,
    scannerId: trigger.scannerId ?? null,
    scannerName: trigger.scannerName ?? null,
    triggeredAt: trigger.generatedAt,
    scannedAt,
  }));
}

export function appendEodAlertHistoryEvents(
  history: EodAlertHistoryEvent[],
  events: EodAlertHistoryEvent[],
): EodAlertHistoryEvent[] {
  if (events.length === 0) {
    return history.slice(0, MAX_ALERT_HISTORY_EVENTS);
  }

  const byId = new Map<string, EodAlertHistoryEvent>();
  [...history, ...events].forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values())
    .sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))
    .slice(0, MAX_ALERT_HISTORY_EVENTS);
}

export function evaluatePriceEodAlertRules(
  rules: EodAlertRule[],
  context: EodAlertEvaluationContext,
): EodAlertTrigger[] {
  const latest = context.bars.at(-1);
  const previous = context.bars.at(-2);
  if (!latest) {
    return [];
  }

  return rules
    .filter((rule) => isPriceRuleForContext(rule, context))
    .map((rule) => evaluatePriceRule(rule, context, latest, previous))
    .filter((trigger): trigger is EodAlertTrigger => Boolean(trigger));
}

export function evaluateIndicatorEodAlertRules(
  rules: EodAlertRule[],
  context: EodAlertEvaluationContext,
): EodAlertTrigger[] {
  const latest = context.bars.at(-1);
  if (!latest) {
    return [];
  }

  const indicatorRules = rules.filter((rule) => isIndicatorRuleForContext(rule, context));
  if (indicatorRules.length === 0) {
    return [];
  }

  const seriesRequests = getIndicatorSeriesRequests(indicatorRules);
  const bundle = buildIndicatorAlertSeriesBundle(context.bars, seriesRequests);
  return indicatorRules
    .map((rule) => evaluateIndicatorRule(rule, context, latest.date, bundle))
    .filter((trigger): trigger is EodAlertTrigger => Boolean(trigger));
}

export function evaluateDrawingEodAlertRules(
  rules: EodAlertRule[],
  context: EodAlertEvaluationContext,
): EodAlertTrigger[] {
  const latestIndex = context.bars.length - 1;
  const previousIndex = context.bars.length - 2;
  const latest = context.bars[latestIndex];
  const previous = context.bars[previousIndex];
  if (!latest || !previous) {
    return [];
  }

  return rules
    .filter((rule) => isDrawingRuleForContext(rule, context))
    .map((rule) => evaluateDrawingRule(rule, context, latestIndex, previousIndex))
    .filter((trigger): trigger is EodAlertTrigger => Boolean(trigger));
}

export function evaluateScannerMatchEodAlertRules(
  rules: EodAlertRule[],
  results: ScannerResult[],
): EodAlertTrigger[] {
  return results.flatMap((result) =>
    rules
      .filter((rule) => isScannerMatchRuleForResult(rule, result))
      .map((rule) => {
        const key = buildAlertTriggerKey(rule.id, result.exchange, result.symbol, result.date);
        if (shouldSuppressTrigger(rule, key)) {
          return null;
        }
        const trigger: EodAlertTrigger = {
          id: key,
          ruleId: rule.id,
          ruleName: formatAlertRuleName(rule),
          exchange: result.exchange,
          symbol: result.symbol,
          date: result.date,
          condition: `${result.scannerName} match`,
          triggerValue: result.score ?? null,
          message: formatAlertMessage(rule, `${result.scannerName} matched ${result.exchange}:${result.symbol}`),
          scannerId: result.scannerId,
          scannerName: result.scannerName,
          generatedAt: new Date().toISOString(),
        };
        return trigger;
      })
      .filter((trigger): trigger is EodAlertTrigger => Boolean(trigger)),
  );
}

export function applyEodAlertTriggersToRules(
  rules: EodAlertRule[],
  triggers: EodAlertTrigger[],
): EodAlertRule[] {
  if (triggers.length === 0) {
    return rules;
  }

  const triggersByRule = new Map<string, EodAlertTrigger[]>();
  triggers.forEach((trigger) => {
    const ruleTriggers = triggersByRule.get(trigger.ruleId) ?? [];
    ruleTriggers.push(trigger);
    triggersByRule.set(trigger.ruleId, ruleTriggers);
  });

  return rules.map((rule) => {
    const ruleTriggers = triggersByRule.get(rule.id);
    if (!ruleTriggers?.length) {
      return rule;
    }
    const trigger = ruleTriggers.at(-1)!;
    const triggeredKeys = appendRuleTriggeredKeys(
      rule.triggeredKeys ?? [],
      ruleTriggers.map((candidate) => candidate.id),
    );
    return {
      ...rule,
      enabled: rule.frequency === 'once' ? false : rule.enabled,
      lastTriggeredKey: trigger.id,
      lastTriggeredAt: trigger.generatedAt,
      triggeredKeys,
      updatedAt: trigger.generatedAt,
    };
  });
}

export function resetEodAlertRuleTriggerState(rule: EodAlertRule): EodAlertRule {
  return {
    ...rule,
    lastTriggeredKey: null,
    lastTriggeredAt: null,
    triggeredKeys: [],
    updatedAt: new Date().toISOString(),
  };
}

export function formatAlertCondition(rule: EodAlertRule): string {
  if (rule.conditionType === 'scanner_match') {
    return rule.scannerName ? `Scanner match: ${rule.scannerName}` : 'Scanner match';
  }
  if (rule.conditionType === 'indicator') {
    return formatIndicatorAlertCondition(rule);
  }
  if (rule.conditionType === 'drawing') {
    return formatDrawingAlertCondition(rule);
  }

  const field = rule.priceField ?? 'close';
  const operator = formatAlertOperator(rule.operator ?? 'above');
  const value = rule.value ?? '';
  return `${formatPriceField(field)} ${operator} ${value}`;
}

export function formatAlertRuleName(rule: EodAlertRule): string {
  if (rule.conditionType === 'drawing') {
    const symbol = rule.exchange && rule.symbol ? `${rule.exchange}:${rule.symbol}` : 'Chart';
    return `${symbol} ${formatDrawingAlertRuleLabel(rule)} cross`;
  }
  return rule.name;
}

export function formatIndicatorAlertCondition(rule: EodAlertRule): string {
  const left = formatIndicatorSeriesKey(rule.indicatorLeft ?? null);
  const operator = formatAlertOperator(rule.indicatorOperator ?? 'crosses_above');
  if (rule.indicatorRight) {
    return `${left} ${operator} ${formatIndicatorSeriesKey(rule.indicatorRight)}`;
  }
  return `${left} ${operator} ${rule.indicatorValue ?? ''}`;
}

export function formatDrawingAlertCondition(rule: EodAlertRule): string {
  const drawing = formatDrawingAlertRuleLabel(rule);
  const operator = formatDrawingAlertOperator(rule.drawingOperator ?? 'crosses');
  if (rule.drawingStatus === 'missing') {
    return `Missing drawing: ${drawing}`;
  }
  return `Close ${operator} ${drawing}`;
}

export function formatIndicatorSeriesKey(key: IndicatorAlertSeriesKey | null): string {
  if (!key) {
    return 'Indicator';
  }
  const parts = key.split('.');
  if (key === 'price.close') {
    return 'Close';
  }
  if (parts[0] === 'ema') {
    return `EMA ${parts[1]}`;
  }
  if (parts[0] === 'rsi') {
    return `RSI ${parts[1]}`;
  }
  if (parts[0] === 'macd') {
    return `MACD ${parts[1]}/${parts[2]}/${parts[3]}`;
  }
  if (parts[0] === 'macdSignal') {
    return `MACD Signal ${parts[1]}/${parts[2]}/${parts[3]}`;
  }
  return key;
}

function formatIndicatorRuleSourceLabel(indicator: ChartIndicator): string {
  if ('period' in indicator && typeof indicator.period === 'number') {
    return `${indicator.kind} ${indicator.period}`;
  }
  if (
    'fastPeriod' in indicator &&
    typeof indicator.fastPeriod === 'number' &&
    'slowPeriod' in indicator &&
    typeof indicator.slowPeriod === 'number'
  ) {
    if ('signalPeriod' in indicator && typeof indicator.signalPeriod === 'number') {
      return `${indicator.kind} ${indicator.fastPeriod}/${indicator.slowPeriod}/${indicator.signalPeriod}`;
    }
    return `${indicator.kind} ${indicator.fastPeriod}/${indicator.slowPeriod}`;
  }
  return indicator.kind;
}

export function formatAlertFrequency(frequency: EodAlertFrequency): string {
  switch (frequency) {
    case 'once':
      return 'Once';
    case 'once_per_symbol_date':
      return 'Once per symbol/date';
    case 'every_scan':
      return 'Every scan';
    case 'once_until_reset':
      return 'Once until reset';
  }
}

function normalizeEodAlertHistoryEvent(value: unknown): EodAlertHistoryEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<EodAlertHistoryEvent>;
  if (!record.id || typeof record.id !== 'string') {
    return null;
  }
  if (!record.ruleId || typeof record.ruleId !== 'string') {
    return null;
  }
  if (!record.exchange || typeof record.exchange !== 'string') {
    return null;
  }
  if (!record.symbol || typeof record.symbol !== 'string') {
    return null;
  }
  if (!record.date || typeof record.date !== 'string') {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: record.id,
    ruleId: record.ruleId,
    ruleName: typeof record.ruleName === 'string' && record.ruleName.trim() ? record.ruleName.trim() : 'EOD Alert',
    exchange: record.exchange,
    symbol: record.symbol,
    date: record.date,
    condition: typeof record.condition === 'string' ? record.condition : '',
    triggerValue:
      typeof record.triggerValue === 'number' || typeof record.triggerValue === 'string'
        ? record.triggerValue
        : null,
    message: typeof record.message === 'string' ? record.message : '',
    scannerId: normalizeOptionalText(record.scannerId),
    scannerName: normalizeOptionalText(record.scannerName),
    triggeredAt: typeof record.triggeredAt === 'string' ? record.triggeredAt : now,
    scannedAt: typeof record.scannedAt === 'string' ? record.scannedAt : now,
  };
}

function normalizeEodAlertRule(value: unknown): EodAlertRule | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<EodAlertRule>;
  if (!record.id || typeof record.id !== 'string') {
    return null;
  }

  const conditionType =
    record.conditionType === 'scanner_match'
      ? 'scanner_match'
      : record.conditionType === 'indicator'
        ? 'indicator'
        : record.conditionType === 'drawing'
          ? 'drawing'
          : 'price';
  const now = new Date().toISOString();
  return {
    id: record.id,
    enabled: record.enabled !== false,
    locked: record.locked !== false,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'EOD Alert',
    scope: record.scope === 'any-scanned-symbol' ? 'any-scanned-symbol' : 'current-chart',
    conditionType,
    frequency: isFrequency(record.frequency) ? record.frequency : 'once_per_symbol_date',
    exchange: normalizeOptionalText(record.exchange),
    symbol: normalizeOptionalText(record.symbol),
    priceField: isPriceField(record.priceField) ? record.priceField : 'close',
    operator: isOperator(record.operator) ? record.operator : 'above',
    value: typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : null,
    scannerId: normalizeOptionalText(record.scannerId),
    scannerName: normalizeOptionalText(record.scannerName),
    indicatorId: normalizeOptionalText(record.indicatorId),
    indicatorKind: normalizeOptionalText(record.indicatorKind),
    indicatorLabel: normalizeOptionalText(record.indicatorLabel),
    indicatorPresetId: normalizeOptionalText(record.indicatorPresetId),
    indicatorLeft: normalizeIndicatorSeriesKey(record.indicatorLeft),
    indicatorRight: normalizeIndicatorSeriesKey(record.indicatorRight),
    indicatorOperator: isIndicatorOperator(record.indicatorOperator) ? record.indicatorOperator : 'crosses_above',
    indicatorValue: typeof record.indicatorValue === 'number' && Number.isFinite(record.indicatorValue) ? record.indicatorValue : null,
    drawingId: normalizeOptionalText(record.drawingId),
    drawingKind: isDrawingKind(record.drawingKind) ? record.drawingKind : null,
    drawingLabel: normalizeOptionalText(record.drawingLabel),
    drawingOperator: isDrawingOperator(record.drawingOperator) ? record.drawingOperator : 'crosses',
    drawingPrice: normalizeOptionalNumber(record.drawingPrice),
    drawingStartIndex: normalizeOptionalNumber(record.drawingStartIndex),
    drawingStartDate: normalizeOptionalText(record.drawingStartDate),
    drawingStartPrice: normalizeOptionalNumber(record.drawingStartPrice),
    drawingEndIndex: normalizeOptionalNumber(record.drawingEndIndex),
    drawingEndDate: normalizeOptionalText(record.drawingEndDate),
    drawingEndPrice: normalizeOptionalNumber(record.drawingEndPrice),
    drawingStatus: isDrawingStatus(record.drawingStatus) ? record.drawingStatus : null,
    drawingMissingAt: normalizeOptionalText(record.drawingMissingAt),
    message: normalizeOptionalText(record.message),
    lastTriggeredKey: normalizeOptionalText(record.lastTriggeredKey),
    lastTriggeredAt: normalizeOptionalText(record.lastTriggeredAt),
    triggeredKeys: normalizeTriggeredKeys(record.triggeredKeys),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
  };
}

function evaluateIndicatorRule(
  rule: EodAlertRule,
  context: EodAlertEvaluationContext,
  date: string,
  bundle: ReturnType<typeof buildIndicatorAlertSeriesBundle>,
): EodAlertTrigger | null {
  const leftKey = rule.indicatorLeft;
  if (!leftKey) {
    return null;
  }

  const rightKey = rule.indicatorRight ?? null;
  const threshold = rightKey ? null : rule.indicatorValue;
  const pair = rightKey
    ? getIndicatorAlertSeriesPair(bundle, leftKey, rightKey)
    : getIndicatorAlertSeriesPair(bundle, leftKey, 'price.close');
  if (!pair) {
    return null;
  }

  const latestPair = getIndicatorAlertLatestPair(pair.left, pair.right);
  if (!latestPair) {
    return null;
  }

  const rightLatest = rightKey ? latestPair.rightLatest : threshold;
  const rightPrevious = rightKey ? latestPair.rightPrevious : threshold;
  if (
    typeof rightLatest !== 'number' ||
    typeof rightPrevious !== 'number' ||
    !Number.isFinite(rightLatest) ||
    !Number.isFinite(rightPrevious)
  ) {
    return null;
  }

  const matched = evaluateOperator(
    rule.indicatorOperator ?? 'crosses_above',
    latestPair.leftLatest,
    rightLatest,
    latestPair.leftPrevious,
    rightPrevious,
  );
  if (!matched) {
    return null;
  }

  const key = buildAlertTriggerKey(rule.id, context.exchange, context.symbol, date);
  if (shouldSuppressTrigger(rule, key)) {
    return null;
  }

  return {
    id: key,
    ruleId: rule.id,
    ruleName: formatAlertRuleName(rule),
    exchange: context.exchange,
    symbol: context.symbol,
    date,
    condition: formatAlertCondition(rule),
    triggerValue: latestPair.leftLatest,
    message: formatAlertMessage(rule, `${rule.name} triggered on ${context.exchange}:${context.symbol}`),
    generatedAt: new Date().toISOString(),
  };
}

function evaluateDrawingRule(
  rule: EodAlertRule,
  context: EodAlertEvaluationContext,
  latestIndex: number,
  previousIndex: number,
): EodAlertTrigger | null {
  const latest = context.bars[latestIndex];
  const previous = context.bars[previousIndex];
  if (!latest || !previous) {
    return null;
  }

  const latestLine = getDrawingAlertLineValue(rule, context.bars, latestIndex);
  const previousLine = getDrawingAlertLineValue(rule, context.bars, previousIndex);
  if (
    typeof latestLine !== 'number' ||
    typeof previousLine !== 'number' ||
    !Number.isFinite(latestLine) ||
    !Number.isFinite(previousLine)
  ) {
    return null;
  }

  const operator = rule.drawingOperator ?? 'crosses';
  const crossesAbove = previous.close <= previousLine && latest.close > latestLine;
  const crossesBelow = previous.close >= previousLine && latest.close < latestLine;
  const matched =
    operator === 'crosses_above'
      ? crossesAbove
      : operator === 'crosses_below'
        ? crossesBelow
        : crossesAbove || crossesBelow;
  if (!matched) {
    return null;
  }

  const key = buildAlertTriggerKey(rule.id, context.exchange, context.symbol, latest.date);
  if (shouldSuppressTrigger(rule, key)) {
    return null;
  }

  return {
    id: key,
    ruleId: rule.id,
    ruleName: formatAlertRuleName(rule),
    exchange: context.exchange,
    symbol: context.symbol,
    date: latest.date,
    condition: formatAlertCondition(rule),
    triggerValue: latest.close,
    message: formatAlertMessage(rule, `${rule.name} triggered on ${context.exchange}:${context.symbol}`),
    generatedAt: new Date().toISOString(),
  };
}

function evaluatePriceRule(
  rule: EodAlertRule,
  context: EodAlertEvaluationContext,
  latest: EodBar,
  previous?: EodBar,
): EodAlertTrigger | null {
  if (rule.value === null || rule.value === undefined || !Number.isFinite(rule.value)) {
    return null;
  }

  const field = rule.priceField ?? 'close';
  const latestValue = getPriceFieldValue(field, latest, previous);
  const previousValue = previous ? getPriceFieldValue(field, previous, undefined) : null;
  if (latestValue === null) {
    return null;
  }

  const matched = evaluateOperator(rule.operator ?? 'above', latestValue, rule.value, previousValue);
  if (!matched) {
    return null;
  }

  const key = buildAlertTriggerKey(rule.id, context.exchange, context.symbol, latest.date);
  if (shouldSuppressTrigger(rule, key)) {
    return null;
  }

  return {
    id: key,
    ruleId: rule.id,
    ruleName: formatAlertRuleName(rule),
    exchange: context.exchange,
    symbol: context.symbol,
    date: latest.date,
    condition: formatAlertCondition(rule),
    triggerValue: latestValue,
    message: formatAlertMessage(rule, `${rule.name} triggered on ${context.exchange}:${context.symbol}`),
    generatedAt: new Date().toISOString(),
  };
}

export function getDrawingAlertLineValue(
  rule: EodAlertRule,
  bars: EodBar[],
  barIndex: number,
): number | null {
  if (rule.drawingKind === 'hline') {
    return normalizeOptionalNumber(rule.drawingPrice);
  }
  if (rule.drawingKind !== 'trendline' && rule.drawingKind !== 'ray') {
    return null;
  }

  const startPrice = normalizeOptionalNumber(rule.drawingStartPrice);
  const endPrice = normalizeOptionalNumber(rule.drawingEndPrice);
  if (startPrice === null || endPrice === null) {
    return null;
  }

  const startIndex = resolveDrawingAnchorIndex(bars, rule.drawingStartDate, rule.drawingStartIndex);
  const endIndex = resolveDrawingAnchorIndex(bars, rule.drawingEndDate, rule.drawingEndIndex);
  if (startIndex === null || endIndex === null || startIndex === endIndex) {
    return null;
  }

  const slope = (endPrice - startPrice) / (endIndex - startIndex);
  return startPrice + slope * (barIndex - startIndex);
}

function isPriceRuleForContext(rule: EodAlertRule, context: EodAlertEvaluationContext): boolean {
  if (!rule.enabled || rule.conditionType !== 'price') {
    return false;
  }
  if (rule.scope === 'any-scanned-symbol') {
    return true;
  }
  return matchesInstrument(rule, context.exchange, context.symbol);
}

function isIndicatorRuleForContext(rule: EodAlertRule, context: EodAlertEvaluationContext): boolean {
  if (!rule.enabled || rule.conditionType !== 'indicator') {
    return false;
  }
  if (rule.scope === 'any-scanned-symbol') {
    return true;
  }
  return matchesInstrument(rule, context.exchange, context.symbol);
}

function isDrawingRuleForContext(rule: EodAlertRule, context: EodAlertEvaluationContext): boolean {
  if (!rule.enabled || rule.conditionType !== 'drawing') {
    return false;
  }
  if (rule.drawingStatus === 'missing') {
    return false;
  }
  if (rule.scope === 'any-scanned-symbol') {
    return true;
  }
  return matchesInstrument(rule, context.exchange, context.symbol);
}

function isScannerMatchRuleForResult(rule: EodAlertRule, result: ScannerResult): boolean {
  if (!rule.enabled || rule.conditionType !== 'scanner_match') {
    return false;
  }
  if (rule.scannerId && rule.scannerId !== result.scannerId) {
    return false;
  }
  if (rule.scope === 'current-chart' && !matchesInstrument(rule, result.exchange, result.symbol)) {
    return false;
  }
  return true;
}

function shouldSuppressTrigger(rule: EodAlertRule, key: string): boolean {
  if (rule.frequency === 'every_scan') {
    return false;
  }
  if (rule.frequency === 'once' || rule.frequency === 'once_until_reset') {
    return Boolean(rule.lastTriggeredAt || rule.lastTriggeredKey || rule.triggeredKeys?.length);
  }
  return rule.lastTriggeredKey === key || Boolean(rule.triggeredKeys?.includes(key));
}

function appendRuleTriggeredKeys(current: string[], keys: string[]): string[] {
  const next = new Set(current);
  keys.forEach((key) => next.add(key));
  return Array.from(next).slice(-MAX_RULE_TRIGGERED_KEYS);
}

function matchesInstrument(rule: EodAlertRule, exchange: string, symbol: string): boolean {
  return (
    normalizeCompareText(rule.exchange) === normalizeCompareText(exchange) &&
    normalizeCompareText(rule.symbol) === normalizeCompareText(symbol)
  );
}

function getPriceFieldValue(field: EodAlertPriceField, bar: EodBar, previous?: EodBar): number | null {
  if (field === 'changePercent') {
    if (!previous || previous.close === 0) {
      return null;
    }
    return ((bar.close - previous.close) / previous.close) * 100;
  }
  return bar[field];
}

function evaluateOperator(
  operator: EodAlertOperator,
  current: number,
  target: number,
  previous: number | null,
  previousTarget = target,
): boolean {
  if (operator === 'above') {
    return current > target;
  }
  if (operator === 'below') {
    return current < target;
  }
  if (operator === 'crosses_above') {
    return previous !== null && previous <= previousTarget && current > target;
  }
  return previous !== null && previous >= previousTarget && current < target;
}

function buildAlertTriggerKey(ruleId: string, exchange: string, symbol: string, date: string): string {
  return `${ruleId}:${exchange}:${symbol}:${date}`;
}

function formatAlertMessage(rule: EodAlertRule, fallback: string): string {
  return rule.message?.trim() || fallback;
}

function formatPriceField(field: EodAlertPriceField): string {
  if (field === 'changePercent') {
    return 'Change %';
  }
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function formatAlertOperator(operator: EodAlertOperator): string {
  switch (operator) {
    case 'above':
      return 'above';
    case 'below':
      return 'below';
    case 'crosses_above':
      return 'crosses above';
    case 'crosses_below':
      return 'crosses below';
  }
}

function formatDrawingAlertOperator(operator: EodAlertDrawingOperator): string {
  if (operator === 'crosses_above') {
    return 'crosses above';
  }
  if (operator === 'crosses_below') {
    return 'crosses below';
  }
  return 'crosses';
}

function formatDrawingKind(kind: EodAlertDrawingKind | null): string {
  if (kind === 'hline') {
    return 'horizontal line';
  }
  if (kind === 'trendline') {
    return 'trendline';
  }
  if (kind === 'ray') {
    return 'ray';
  }
  return 'drawing';
}

function formatDrawingAlertLabel(drawing: ChartDrawing): string {
  if (drawing.kind === 'hline') {
    return `horizontal line ${formatAlertNumber(drawing.price)}`;
  }
  if (drawing.kind === 'ray') {
    return 'ray';
  }
  return 'trendline';
}

function formatDrawingAlertRuleLabel(rule: EodAlertRule): string {
  if (rule.drawingKind === 'hline') {
    const price = normalizeOptionalNumber(rule.drawingPrice);
    if (price !== null) {
      return `horizontal line ${formatAlertNumber(price)}`;
    }
  }
  return rule.drawingLabel ?? formatDrawingKind(rule.drawingKind ?? null);
}

function isSupportedDrawingAlertDrawing(drawing: ChartDrawing): drawing is Extract<ChartDrawing, { kind: EodAlertDrawingKind }> {
  return drawing.kind === 'hline' || drawing.kind === 'trendline' || drawing.kind === 'ray';
}

function resolveDrawingAnchorIndex(
  bars: EodBar[],
  date: string | null | undefined,
  fallbackIndex: number | null | undefined,
): number | null {
  if (date) {
    const matchedIndex = bars.findIndex((bar) => bar.date === date);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }
  if (typeof fallbackIndex === 'number' && Number.isFinite(fallbackIndex)) {
    return fallbackIndex;
  }
  return null;
}

function formatAlertNumber(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function isPriceField(value: unknown): value is EodAlertPriceField {
  return typeof value === 'string' && PRICE_FIELDS.includes(value as EodAlertPriceField);
}

function isOperator(value: unknown): value is EodAlertOperator {
  return typeof value === 'string' && OPERATORS.includes(value as EodAlertOperator);
}

function isIndicatorOperator(value: unknown): value is EodAlertIndicatorOperator {
  return typeof value === 'string' && INDICATOR_OPERATORS.includes(value as EodAlertIndicatorOperator);
}

function isDrawingKind(value: unknown): value is EodAlertDrawingKind {
  return value === 'hline' || value === 'trendline' || value === 'ray';
}

function isDrawingOperator(value: unknown): value is EodAlertDrawingOperator {
  return value === 'crosses' || value === 'crosses_above' || value === 'crosses_below';
}

function isDrawingStatus(value: unknown): value is EodAlertDrawingStatus {
  return value === 'linked' || value === 'missing';
}

function isFrequency(value: unknown): value is EodAlertFrequency {
  return (
    value === 'once' ||
    value === 'once_per_symbol_date' ||
    value === 'every_scan' ||
    value === 'once_until_reset'
  );
}

function normalizeTriggeredKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    .slice(-MAX_RULE_TRIGGERED_KEYS);
}

function normalizeIndicatorSeriesKey(value: unknown): IndicatorAlertSeriesKey | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (value === 'price.close') {
    return value;
  }
  const parts = value.split('.');
  if ((parts[0] === 'ema' || parts[0] === 'rsi') && isPositiveIntText(parts[1])) {
    return value as IndicatorAlertSeriesKey;
  }
  if (
    (parts[0] === 'macd' || parts[0] === 'macdSignal') &&
    isPositiveIntText(parts[1]) &&
    isPositiveIntText(parts[2]) &&
    isPositiveIntText(parts[3])
  ) {
    return value as IndicatorAlertSeriesKey;
  }
  return null;
}

function getIndicatorSeriesRequests(rules: EodAlertRule[]): IndicatorAlertSeriesRequest[] {
  const keys = new Set<IndicatorAlertSeriesKey>(['price.close']);
  rules.forEach((rule) => {
    if (rule.indicatorLeft) {
      keys.add(rule.indicatorLeft);
    }
    if (rule.indicatorRight) {
      keys.add(rule.indicatorRight);
    }
  });
  return Array.from(keys).map((key) => ({ key }));
}

function isPositiveIntText(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeCompareText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function createAlertId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

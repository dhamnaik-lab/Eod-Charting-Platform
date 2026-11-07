import { EMA, MACD, RSI } from 'technicalindicators';
import type { ChartIndicator } from '@/engine/types';
import type { EodBar } from '@/plugins/scanner/types';

export type IndicatorAlertSeriesKey =
  | 'price.close'
  | `ema.${number}`
  | `rsi.${number}`
  | `macd.${number}.${number}.${number}`
  | `macdSignal.${number}.${number}.${number}`;
export type IndicatorAlertSeriesOperator = 'above' | 'below' | 'crosses_above' | 'crosses_below';

export interface IndicatorAlertOutputContract {
  indicatorKind: string;
  outputId: string;
  label: string;
  seriesKeyTemplate: string;
  supportsThreshold: boolean;
  supportsCrossSeries: boolean;
  defaultPresetId?: string;
}

export interface IndicatorAlertPresetDefinition {
  id: string;
  label: string;
  left: IndicatorAlertSeriesKey;
  right: IndicatorAlertSeriesKey | null;
  operator: IndicatorAlertSeriesOperator;
  value: number | null;
}

export interface IndicatorAlertSeries {
  key: IndicatorAlertSeriesKey;
  label: string;
  values: Array<number | null>;
}

export interface IndicatorAlertSeriesBundle {
  series: Map<IndicatorAlertSeriesKey, IndicatorAlertSeries>;
}

export interface IndicatorAlertSeriesRequest {
  key: IndicatorAlertSeriesKey;
}

export const INDICATOR_ALERT_OUTPUT_CONTRACTS: IndicatorAlertOutputContract[] = [
  {
    indicatorKind: 'EMA',
    outputId: 'value',
    label: 'EMA value',
    seriesKeyTemplate: 'ema.{period}',
    supportsThreshold: true,
    supportsCrossSeries: true,
    defaultPresetId: 'price_ema_21',
  },
  {
    indicatorKind: 'RSI',
    outputId: 'value',
    label: 'RSI value',
    seriesKeyTemplate: 'rsi.{period}',
    supportsThreshold: true,
    supportsCrossSeries: true,
    defaultPresetId: 'rsi_14_threshold',
  },
  {
    indicatorKind: 'MACD',
    outputId: 'macd',
    label: 'MACD line',
    seriesKeyTemplate: 'macd.{fastPeriod}.{slowPeriod}.{signalPeriod}',
    supportsThreshold: true,
    supportsCrossSeries: true,
    defaultPresetId: 'macd_signal',
  },
  {
    indicatorKind: 'MACD',
    outputId: 'signal',
    label: 'MACD signal',
    seriesKeyTemplate: 'macdSignal.{fastPeriod}.{slowPeriod}.{signalPeriod}',
    supportsThreshold: true,
    supportsCrossSeries: true,
  },
];

export const INDICATOR_ALERT_PRESETS: IndicatorAlertPresetDefinition[] = [
  {
    id: 'rsi_14_threshold',
    label: 'RSI 14 crosses level',
    left: 'rsi.14',
    right: null,
    operator: 'crosses_above',
    value: 70,
  },
  {
    id: 'macd_signal',
    label: 'MACD crosses signal',
    left: 'macd.12.26.9',
    right: 'macdSignal.12.26.9',
    operator: 'crosses_above',
    value: null,
  },
  {
    id: 'ema_9_21',
    label: 'EMA 9 crosses EMA 21',
    left: 'ema.9',
    right: 'ema.21',
    operator: 'crosses_above',
    value: null,
  },
  {
    id: 'price_ema_21',
    label: 'Close crosses EMA 21',
    left: 'price.close',
    right: 'ema.21',
    operator: 'crosses_above',
    value: null,
  },
];

export function getIndicatorAlertPresetDefinition(
  presetId: string,
): IndicatorAlertPresetDefinition | null {
  return INDICATOR_ALERT_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function getDefaultIndicatorAlertPresetDefinition(): IndicatorAlertPresetDefinition {
  const preset = INDICATOR_ALERT_PRESETS[0];
  if (!preset) {
    throw new Error('No indicator alert presets are configured.');
  }
  return preset;
}

/**
 * Alert series keys encode the formula parameters but not its input series.
 * Reject chart studies with non-Close or chained inputs rather than creating
 * a rule that would silently evaluate the Close-based alert series.
 */
export function getIndicatorAlertSourceUnsupportedReason(indicator: ChartIndicator): string | null {
  if (getIndicatorAlertOutputContractsByKind(indicator.kind).length === 0) {
    return null;
  }
  const configured = indicator as ChartIndicator & { source?: string; sourceIndicatorId?: string };
  if (configured.sourceIndicatorId) {
    return 'Indicator alerts do not support chained sources. Remove the source indicator and select Close.';
  }
  if (configured.source && configured.source !== 'close') {
    return `Indicator alerts support Close only; ${indicator.kind} uses ${configured.source}. Select Close in indicator settings.`;
  }
  return null;
}

export function getDefaultIndicatorAlertPresetForIndicator(
  indicator: ChartIndicator,
): IndicatorAlertPresetDefinition | null {
  if (getIndicatorAlertSourceUnsupportedReason(indicator)) {
    return null;
  }
  const contracts = getIndicatorAlertOutputContractsByKind(indicator.kind);
  const defaultContract = contracts.find((contract) => contract.defaultPresetId);
  if (!defaultContract?.defaultPresetId) {
    return null;
  }

  if (defaultContract.defaultPresetId === 'price_ema_21') {
    const right = materializeIndicatorSeriesKey(defaultContract.seriesKeyTemplate, indicator);
    if (!right) {
      return null;
    }
    return {
      id: `price_${right.replaceAll('.', '_')}`,
      label: `Close crosses ${right.toUpperCase().replace('.', ' ')}`,
      left: 'price.close',
      right,
      operator: 'crosses_above',
      value: null,
    };
  }

  if (defaultContract.defaultPresetId === 'rsi_14_threshold') {
    const left = materializeIndicatorSeriesKey(defaultContract.seriesKeyTemplate, indicator);
    if (!left) {
      return null;
    }
    return {
      id: `${left.replaceAll('.', '_')}_threshold`,
      label: `${left.toUpperCase().replace('.', ' ')} crosses level`,
      left,
      right: null,
      operator: 'crosses_above',
      value: 70,
    };
  }

  if (defaultContract.defaultPresetId === 'macd_signal') {
    const macdContract = contracts.find((contract) => contract.outputId === 'macd');
    const signalContract = contracts.find((contract) => contract.outputId === 'signal');
    const left = macdContract ? materializeIndicatorSeriesKey(macdContract.seriesKeyTemplate, indicator) : null;
    const right = signalContract ? materializeIndicatorSeriesKey(signalContract.seriesKeyTemplate, indicator) : null;
    if (!left || !right) {
      return null;
    }
    return {
      id: `${left.replaceAll('.', '_')}_signal`,
      label: 'MACD crosses signal',
      left,
      right,
      operator: 'crosses_above',
      value: null,
    };
  }

  return getIndicatorAlertPresetDefinition(defaultContract.defaultPresetId);
}

export function getIndicatorAlertOutputContractsByKind(indicatorKind: string): IndicatorAlertOutputContract[] {
  return INDICATOR_ALERT_OUTPUT_CONTRACTS.filter((contract) => contract.indicatorKind === indicatorKind);
}

export function buildIndicatorAlertSeriesBundle(
  bars: EodBar[],
  requests: IndicatorAlertSeriesRequest[],
): IndicatorAlertSeriesBundle {
  const series = new Map<IndicatorAlertSeriesKey, IndicatorAlertSeries>();
  const closes = bars.map((bar) => bar.close);

  requests.forEach((request) => {
    if (series.has(request.key)) {
      return;
    }
    const built = buildSeries(request.key, closes, bars.length);
    if (built) {
      series.set(request.key, built);
    }
  });

  return { series };
}

export function getIndicatorAlertSeriesPair(
  bundle: IndicatorAlertSeriesBundle,
  leftKey: IndicatorAlertSeriesKey,
  rightKey: IndicatorAlertSeriesKey,
): { left: IndicatorAlertSeries; right: IndicatorAlertSeries } | null {
  const left = bundle.series.get(leftKey);
  const right = bundle.series.get(rightKey);
  if (!left || !right) {
    return null;
  }
  return { left, right };
}

export function getIndicatorAlertLatestPair(
  left: IndicatorAlertSeries,
  right: IndicatorAlertSeries,
): { leftLatest: number; leftPrevious: number; rightLatest: number; rightPrevious: number } | null {
  const lastIndex = Math.min(left.values.length, right.values.length) - 1;
  if (lastIndex < 1) {
    return null;
  }

  const leftLatest = left.values[lastIndex];
  const leftPrevious = left.values[lastIndex - 1];
  const rightLatest = right.values[lastIndex];
  const rightPrevious = right.values[lastIndex - 1];
  if (
    !Number.isFinite(leftLatest) ||
    !Number.isFinite(leftPrevious) ||
    !Number.isFinite(rightLatest) ||
    !Number.isFinite(rightPrevious)
  ) {
    return null;
  }
  return {
    leftLatest: Number(leftLatest),
    leftPrevious: Number(leftPrevious),
    rightLatest: Number(rightLatest),
    rightPrevious: Number(rightPrevious),
  };
}

function buildSeries(
  key: IndicatorAlertSeriesKey,
  closes: number[],
  barCount: number,
): IndicatorAlertSeries | null {
  if (key === 'price.close') {
    return {
      key,
      label: 'Close',
      values: closes,
    };
  }

  const parts = key.split('.');
  if (parts[0] === 'ema') {
    const period = parsePositiveInt(parts[1]);
    if (!period) {
      return null;
    }
    return {
      key,
      label: `EMA ${period}`,
      values: padSeries(EMA.calculate({ values: closes, period }), barCount),
    };
  }

  if (parts[0] === 'rsi') {
    const period = parsePositiveInt(parts[1]);
    if (!period) {
      return null;
    }
    return {
      key,
      label: `RSI ${period}`,
      values: padSeries(RSI.calculate({ values: closes, period }), barCount),
    };
  }

  if (parts[0] === 'macd' || parts[0] === 'macdSignal') {
    const fastPeriod = parsePositiveInt(parts[1]);
    const slowPeriod = parsePositiveInt(parts[2]);
    const signalPeriod = parsePositiveInt(parts[3]);
    if (!fastPeriod || !slowPeriod || !signalPeriod) {
      return null;
    }
    const values = MACD.calculate({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const output = parts[0] === 'macd'
      ? values.map((value) => value.MACD ?? null)
      : values.map((value) => value.signal ?? null);
    return {
      key,
      label: parts[0] === 'macd'
        ? `MACD ${fastPeriod}/${slowPeriod}/${signalPeriod}`
        : `MACD Signal ${fastPeriod}/${slowPeriod}/${signalPeriod}`,
      values: padSeries(output, barCount),
    };
  }

  return null;
}

function padSeries(values: Array<number | null>, targetLength: number): Array<number | null> {
  const padding = Math.max(0, targetLength - values.length);
  const padded: Array<number | null> = Array.from({ length: padding }, () => null);
  return padded.concat(values);
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function materializeIndicatorSeriesKey(
  template: string,
  indicator: ChartIndicator,
): IndicatorAlertSeriesKey | null {
  const key = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, fieldName: string) => {
    const value = getIndicatorNumericField(indicator, fieldName);
    return value === null ? '' : String(value);
  });
  if (!key || key.includes('{') || key.includes('}')) {
    return null;
  }
  return key as IndicatorAlertSeriesKey;
}

function getIndicatorNumericField(indicator: ChartIndicator, fieldName: string): number | null {
  const value = (indicator as unknown as Record<string, unknown>)[fieldName];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

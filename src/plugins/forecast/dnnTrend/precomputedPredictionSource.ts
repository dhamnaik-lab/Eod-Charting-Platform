import type { DnnTrendHorizon, DnnTrendHorizonProbability, DnnTrendTimeframe } from '@/plugins/forecast/dnnTrend/types';
import { DNN_TREND_SUPPORTED_HORIZONS } from '@/plugins/forecast/dnnTrend/types';
import {
  selectDnnTrendClass,
  validateDnnTrendProbability,
} from '@/plugins/forecast/dnnTrend/predictionValidation';

export const DNN_TREND_PRECOMPUTED_SCHEMA_VERSION = 'dnn-trend-predictions-v1';
export const DNN_TREND_PRECOMPUTED_MAX_RECORDS = 250_000;

export interface DnnTrendPrecomputedModelManifest {
  modelId: string;
  modelVersion: string;
  featureVersion: string;
  generatedAt: string;
  productionReady: boolean;
}

export interface DnnTrendPrecomputedPredictionRecord extends DnnTrendHorizonProbability {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  asOfDate: string;
  dataRevision: string;
}

export interface DnnTrendPrecomputedPredictionDocument {
  schemaVersion: typeof DNN_TREND_PRECOMPUTED_SCHEMA_VERSION;
  model: DnnTrendPrecomputedModelManifest;
  predictions: readonly DnnTrendPrecomputedPredictionRecord[];
}

export interface DnnTrendPrecomputedSourceSummary {
  recordCount: number;
  symbolCount: number;
  firstAsOfDate: string;
  lastAsOfDate: string;
  horizons: readonly DnnTrendHorizon[];
}

export interface DnnTrendPrecomputedPredictionSource {
  filePath: string;
  byteLength: number;
  document: DnnTrendPrecomputedPredictionDocument;
  summary: DnnTrendPrecomputedSourceSummary;
  recordsByKey: ReadonlyMap<string, DnnTrendPrecomputedPredictionRecord>;
  datesBySeriesKey: ReadonlyMap<string, readonly string[]>;
}

export interface DnnTrendPrecomputedLookupInput {
  symbol: string;
  exchange: string;
  timeframe?: DnnTrendTimeframe;
  asOfDate: string;
  horizonBars: DnnTrendHorizon;
  dataRevision?: string;
}

export type DnnTrendPrecomputedLookupResult =
  | {
      status: 'valid';
      record: DnnTrendPrecomputedPredictionRecord;
      predictedClass: 'bullish' | 'sideways' | 'bearish';
      confidence: number;
    }
  | {
      status: 'missing' | 'stale';
      reason: string;
      latestAvailableAsOfDate: string | null;
    };

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${label} contains unsupported field(s): ${unknownKeys.join(', ')}.`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month! - 1
    && date.getUTCDate() === day;
}

function requiredIsoDate(value: unknown, label: string): string {
  const date = requiredString(value, label);
  if (!isIsoDate(date)) {
    throw new Error(`${label} must use a valid YYYY-MM-DD calendar date.`);
  }
  return date;
}

function requiredIsoTimestamp(value: unknown, label: string): string {
  const timestamp = requiredString(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(timestamp);
  if (!match) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp with a timezone.`);
  }

  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  if (
    !isIsoDate(datePart)
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
    || !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp with a timezone.`);
  }
  return timestamp;
}

function normalizeSymbol(value: unknown, label: string): string {
  return requiredString(value, label).toUpperCase();
}

function normalizeExchange(value: unknown, label: string): string {
  const exchange = requiredString(value, label).toUpperCase();
  if (exchange !== 'NSE' && exchange !== 'BSE') {
    throw new Error(`${label} must be NSE or BSE.`);
  }
  return exchange;
}

function normalizeTimeframe(value: unknown, label: string): DnnTrendTimeframe {
  if (value !== '1D') {
    throw new Error(`${label} must be 1D.`);
  }
  return '1D';
}

function normalizeHorizon(value: unknown, label: string): DnnTrendHorizon {
  const horizon = requiredNumber(value, label);
  if (!DNN_TREND_SUPPORTED_HORIZONS.includes(horizon as DnnTrendHorizon)) {
    throw new Error(`${label} must be one of ${DNN_TREND_SUPPORTED_HORIZONS.join(', ')}.`);
  }
  return horizon as DnnTrendHorizon;
}

export function createDnnTrendPrecomputedRecordKey(input: {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  asOfDate: string;
  horizonBars: DnnTrendHorizon;
}): string {
  return [
    input.symbol.trim().toUpperCase(),
    input.exchange.trim().toUpperCase(),
    input.timeframe,
    input.asOfDate,
    input.horizonBars,
  ].join('|');
}

export function createDnnTrendPrecomputedSeriesKey(input: {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  horizonBars: DnnTrendHorizon;
}): string {
  return [
    input.symbol.trim().toUpperCase(),
    input.exchange.trim().toUpperCase(),
    input.timeframe,
    input.horizonBars,
  ].join('|');
}

export function parseDnnTrendPrecomputedPredictionSource(
  rawText: string,
  options: { filePath?: string; byteLength?: number } = {},
): DnnTrendPrecomputedPredictionSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error.';
    throw new Error(`DNN prediction source is not valid JSON. ${message}`);
  }

  const root = asRecord(parsed, 'DNN prediction source');
  rejectUnknownKeys(root, ['schemaVersion', 'model', 'predictions'], 'DNN prediction source');
  if (root.schemaVersion !== DNN_TREND_PRECOMPUTED_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported DNN prediction schema version. Expected ${DNN_TREND_PRECOMPUTED_SCHEMA_VERSION}.`,
    );
  }

  const modelValue = asRecord(root.model, 'model');
  rejectUnknownKeys(
    modelValue,
    ['modelId', 'modelVersion', 'featureVersion', 'generatedAt', 'productionReady'],
    'model',
  );
  const model: DnnTrendPrecomputedModelManifest = {
    modelId: requiredString(modelValue.modelId, 'model.modelId'),
    modelVersion: requiredString(modelValue.modelVersion, 'model.modelVersion'),
    featureVersion: requiredString(modelValue.featureVersion, 'model.featureVersion'),
    generatedAt: requiredIsoTimestamp(modelValue.generatedAt, 'model.generatedAt'),
    productionReady: requiredBoolean(modelValue.productionReady, 'model.productionReady'),
  };

  if (!Array.isArray(root.predictions) || root.predictions.length === 0) {
    throw new Error('predictions must contain at least one record.');
  }
  if (root.predictions.length > DNN_TREND_PRECOMPUTED_MAX_RECORDS) {
    throw new Error(
      `predictions contains ${root.predictions.length} records; the limit is ${DNN_TREND_PRECOMPUTED_MAX_RECORDS}.`,
    );
  }

  const recordsByKey = new Map<string, DnnTrendPrecomputedPredictionRecord>();
  const mutableDatesBySeriesKey = new Map<string, string[]>();
  const symbols = new Set<string>();
  const horizons = new Set<DnnTrendHorizon>();
  const asOfDates: string[] = [];
  const predictions = root.predictions.map((value, index) => {
    const row = asRecord(value, `predictions[${index}]`);
    rejectUnknownKeys(
      row,
      [
        'symbol',
        'exchange',
        'timeframe',
        'asOfDate',
        'dataRevision',
        'horizonBars',
        'bullishProbability',
        'sidewaysProbability',
        'bearishProbability',
      ],
      `predictions[${index}]`,
    );
    const record: DnnTrendPrecomputedPredictionRecord = {
      symbol: normalizeSymbol(row.symbol, `predictions[${index}].symbol`),
      exchange: normalizeExchange(row.exchange, `predictions[${index}].exchange`),
      timeframe: normalizeTimeframe(row.timeframe, `predictions[${index}].timeframe`),
      asOfDate: requiredIsoDate(row.asOfDate, `predictions[${index}].asOfDate`),
      dataRevision: requiredString(row.dataRevision, `predictions[${index}].dataRevision`),
      horizonBars: normalizeHorizon(row.horizonBars, `predictions[${index}].horizonBars`),
      bullishProbability: requiredNumber(
        row.bullishProbability,
        `predictions[${index}].bullishProbability`,
      ),
      sidewaysProbability: requiredNumber(
        row.sidewaysProbability,
        `predictions[${index}].sidewaysProbability`,
      ),
      bearishProbability: requiredNumber(
        row.bearishProbability,
        `predictions[${index}].bearishProbability`,
      ),
    };
    const probabilityError = validateDnnTrendProbability(record);
    if (probabilityError) {
      throw new Error(`predictions[${index}]: ${probabilityError}`);
    }

    const key = createDnnTrendPrecomputedRecordKey(record);
    if (recordsByKey.has(key)) {
      throw new Error(`Duplicate DNN prediction record: ${key}.`);
    }
    recordsByKey.set(key, record);
    const seriesKey = createDnnTrendPrecomputedSeriesKey(record);
    const seriesDates = mutableDatesBySeriesKey.get(seriesKey) ?? [];
    seriesDates.push(record.asOfDate);
    mutableDatesBySeriesKey.set(seriesKey, seriesDates);
    symbols.add(`${record.exchange}|${record.symbol}`);
    horizons.add(record.horizonBars);
    asOfDates.push(record.asOfDate);
    return record;
  });

  asOfDates.sort();
  const datesBySeriesKey = new Map<string, readonly string[]>();
  for (const [seriesKey, seriesDates] of mutableDatesBySeriesKey) {
    datesBySeriesKey.set(seriesKey, [...new Set(seriesDates)].sort());
  }

  const document: DnnTrendPrecomputedPredictionDocument = {
    schemaVersion: DNN_TREND_PRECOMPUTED_SCHEMA_VERSION,
    model,
    predictions,
  };

  return {
    filePath: options.filePath?.trim() ?? '',
    byteLength: options.byteLength ?? new TextEncoder().encode(rawText).byteLength,
    document,
    summary: {
      recordCount: predictions.length,
      symbolCount: symbols.size,
      firstAsOfDate: asOfDates[0]!,
      lastAsOfDate: asOfDates[asOfDates.length - 1]!,
      horizons: [...horizons].sort((left, right) => left - right),
    },
    recordsByKey,
    datesBySeriesKey,
  };
}

export function lookupDnnTrendPrecomputedPrediction(
  source: DnnTrendPrecomputedPredictionSource,
  input: DnnTrendPrecomputedLookupInput,
): DnnTrendPrecomputedLookupResult {
  const symbol = input.symbol.trim().toUpperCase();
  const exchange = input.exchange.trim().toUpperCase();
  const timeframe = input.timeframe ?? '1D';
  if (!symbol || !exchange || !isIsoDate(input.asOfDate)) {
    return {
      status: 'missing',
      reason: 'Symbol, exchange, and a valid as-of date are required.',
      latestAvailableAsOfDate: null,
    };
  }

  const key = createDnnTrendPrecomputedRecordKey({
    symbol,
    exchange,
    timeframe,
    asOfDate: input.asOfDate,
    horizonBars: input.horizonBars,
  });
  const exact = source.recordsByKey.get(key);
  if (exact) {
    const requestedDataRevision = input.dataRevision?.trim();
    if (requestedDataRevision && exact.dataRevision !== requestedDataRevision) {
      return {
        status: 'stale',
        reason: `Prediction data revision ${exact.dataRevision} does not match ${requestedDataRevision}.`,
        latestAvailableAsOfDate: exact.asOfDate,
      };
    }
    return {
      status: 'valid',
      record: exact,
      ...selectDnnTrendClass(exact),
    };
  }

  const seriesKey = createDnnTrendPrecomputedSeriesKey({
    symbol,
    exchange,
    timeframe,
    horizonBars: input.horizonBars,
  });
  const candidateDates = source.datesBySeriesKey.get(seriesKey) ?? [];
  let latestAvailableAsOfDate: string | null = null;
  for (const candidateDate of candidateDates) {
    if (candidateDate > input.asOfDate) break;
    latestAvailableAsOfDate = candidateDate;
  }
  if (latestAvailableAsOfDate) {
    return {
      status: 'stale',
      reason: `No exact ${input.asOfDate} prediction exists; latest causal prediction is ${latestAvailableAsOfDate}.`,
      latestAvailableAsOfDate,
    };
  }

  const firstAvailableAsOfDate = candidateDates[0] ?? null;
  if (firstAvailableAsOfDate) {
    return {
      status: 'missing',
      reason: `No prediction exists on or before ${input.asOfDate}; first available is ${firstAvailableAsOfDate}.`,
      latestAvailableAsOfDate: null,
    };
  }

  return {
    status: 'missing',
    reason: `No prediction exists for ${exchange}:${symbol}, ${input.horizonBars} sessions.`,
    latestAvailableAsOfDate: null,
  };
}

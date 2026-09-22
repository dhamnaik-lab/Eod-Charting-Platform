import { describe, expect, it } from 'vitest';
import { PrecomputedDnnTrendInferenceProvider } from '@/plugins/forecast/dnnTrend/precomputedInferenceProvider';
import {
  DNN_TREND_PRECOMPUTED_SCHEMA_VERSION,
  lookupDnnTrendPrecomputedPrediction,
  parseDnnTrendPrecomputedPredictionSource,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';

function sourceDocument() {
  return {
    schemaVersion: DNN_TREND_PRECOMPUTED_SCHEMA_VERSION,
    model: {
      modelId: 'DNN-TREND-RESEARCH',
      modelVersion: '0.1.0',
      featureVersion: 'dnn-trend-features-v1',
      generatedAt: '2026-08-05T12:30:00.000Z',
      productionReady: false,
    },
    predictions: [
      {
        symbol: 'TCS',
        exchange: 'NSE',
        timeframe: '1D',
        asOfDate: '2026-08-03',
        dataRevision: 'nse-eod-2026-08-03-adjusted-v1',
        horizonBars: 5,
        bullishProbability: 0.64,
        sidewaysProbability: 0.23,
        bearishProbability: 0.13,
      },
      {
        symbol: 'TCS',
        exchange: 'NSE',
        timeframe: '1D',
        asOfDate: '2026-08-03',
        dataRevision: 'nse-eod-2026-08-03-adjusted-v1',
        horizonBars: 10,
        bullishProbability: 0.55,
        sidewaysProbability: 0.3,
        bearishProbability: 0.15,
      },
    ],
  };
}

describe('precomputed DNN prediction source', () => {
  it('parses, normalizes, indexes, and summarizes a valid source', () => {
    const source = parseDnnTrendPrecomputedPredictionSource(
      JSON.stringify(sourceDocument()),
      { filePath: 'C:/predictions.json', byteLength: 1234 },
    );

    expect(source.filePath).toBe('C:/predictions.json');
    expect(source.byteLength).toBe(1234);
    expect(source.summary).toEqual({
      recordCount: 2,
      symbolCount: 1,
      firstAsOfDate: '2026-08-03',
      lastAsOfDate: '2026-08-03',
      horizons: [5, 10],
    });
    expect(source.document.predictions[0]?.symbol).toBe('TCS');
  });

  it('rejects malformed probabilities and duplicate exact keys', () => {
    const invalidProbability = sourceDocument();
    invalidProbability.predictions[0]!.bullishProbability = 0.9;
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(invalidProbability)))
      .toThrow('probabilities must sum to 1');

    const duplicate = sourceDocument();
    duplicate.predictions.push({ ...duplicate.predictions[0]! });
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(duplicate)))
      .toThrow('Duplicate DNN prediction record');
  });

  it('returns exact results and rejects stale dates', () => {
    const source = parseDnnTrendPrecomputedPredictionSource(JSON.stringify(sourceDocument()));
    const exact = lookupDnnTrendPrecomputedPrediction(source, {
      symbol: 'tcs',
      exchange: 'nse',
      asOfDate: '2026-08-03',
      horizonBars: 5,
    });
    expect(exact.status).toBe('valid');
    if (exact.status === 'valid') {
      expect(exact.predictedClass).toBe('bullish');
      expect(exact.confidence).toBe(0.64);
    }

    const stale = lookupDnnTrendPrecomputedPrediction(source, {
      symbol: 'TCS',
      exchange: 'NSE',
      asOfDate: '2026-08-04',
      horizonBars: 5,
    });
    expect(stale).toEqual({
      status: 'stale',
      reason: 'No exact 2026-08-04 prediction exists; latest causal prediction is 2026-08-03.',
      latestAvailableAsOfDate: '2026-08-03',
    });
  });

  it('never falls forward to a future prediction when an exact date is absent', () => {
    const document = sourceDocument();
    document.predictions = document.predictions.map((record) => ({
      ...record,
      asOfDate: '2026-08-10',
      dataRevision: 'nse-eod-2026-08-10-adjusted-v1',
    }));
    const source = parseDnnTrendPrecomputedPredictionSource(JSON.stringify(document));

    expect(lookupDnnTrendPrecomputedPrediction(source, {
      symbol: 'TCS',
      exchange: 'NSE',
      asOfDate: '2026-08-04',
      horizonBars: 5,
    })).toEqual({
      status: 'missing',
      reason: 'No prediction exists on or before 2026-08-04; first available is 2026-08-10.',
      latestAvailableAsOfDate: null,
    });
  });

  it('requires a valid ISO timestamp with an explicit timezone', () => {
    const withoutTimezone = sourceDocument();
    withoutTimezone.model.generatedAt = '2026-08-05 12:30:00';
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(withoutTimezone)))
      .toThrow('model.generatedAt must be a valid ISO-8601 timestamp with a timezone');

    const invalidCalendarDate = sourceDocument();
    invalidCalendarDate.model.generatedAt = '2026-02-30T12:30:00Z';
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(invalidCalendarDate)))
      .toThrow('model.generatedAt must be a valid ISO-8601 timestamp with a timezone');
  });

  it('rejects unsupported fields instead of silently accepting schema drift', () => {
    const document = sourceDocument() as ReturnType<typeof sourceDocument> & {
      unexpected?: string;
    };
    document.unexpected = 'not-allowed';
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(document)))
      .toThrow('DNN prediction source contains unsupported field(s): unexpected');
  });

  it('rejects exchanges outside the platform contract', () => {
    const document = sourceDocument();
    document.predictions[0]!.exchange = 'NASDAQ';
    expect(() => parseDnnTrendPrecomputedPredictionSource(JSON.stringify(document)))
      .toThrow('predictions[0].exchange must be NSE or BSE');
  });

  it('enforces feature and data-revision parity through the provider', async () => {
    const source = parseDnnTrendPrecomputedPredictionSource(JSON.stringify(sourceDocument()));
    const provider = new PrecomputedDnnTrendInferenceProvider(source);
    await provider.initialize();

    await expect(provider.predict({
      symbol: 'TCS',
      exchange: 'NSE',
      timeframe: '1D',
      dataRevision: 'different-revision',
      asOfDate: '2026-08-03',
      horizons: [5],
      featureVersion: 'dnn-trend-features-v1',
      featureNames: [],
      featureValues: [],
    })).rejects.toThrow('does not match different-revision');

    await expect(provider.predict({
      symbol: 'TCS',
      exchange: 'NSE',
      timeframe: '1D',
      dataRevision: 'nse-eod-2026-08-03-adjusted-v1',
      asOfDate: '2026-08-03',
      horizons: [5],
      featureVersion: 'wrong-features',
      featureNames: [],
      featureValues: [],
    })).rejects.toThrow('Feature version mismatch');
  });
});

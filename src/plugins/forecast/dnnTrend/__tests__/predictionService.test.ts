import { describe, expect, it, vi } from 'vitest';
import type {
  DnnTrendInferenceInput,
  DnnTrendInferenceOutput,
  DnnTrendInferenceProvider,
} from '@/plugins/forecast/dnnTrend/inferenceProvider';
import { DeterministicMockDnnTrendInferenceProvider } from '@/plugins/forecast/dnnTrend/mockInferenceProvider';
import { DnnTrendPredictionService } from '@/plugins/forecast/dnnTrend/predictionService';
import type {
  DnnTrendBar,
  DnnTrendPredictionRequest,
} from '@/plugins/forecast/dnnTrend/types';

function createBars(count: number, dailyChange = 0.5): DnnTrendBar[] {
  let previousClose = 100;
  return Array.from({ length: count }, (_, index) => {
    const close = previousClose + dailyChange;
    const bar = {
      date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
      open: previousClose,
      high: Math.max(previousClose, close) + 1,
      low: Math.min(previousClose, close) - 1,
      close,
      volume: 10_000 + index * 100,
    };
    previousClose = close;
    return bar;
  });
}

function request(overrides: Partial<DnnTrendPredictionRequest> = {}): DnnTrendPredictionRequest {
  return {
    symbol: 'ABC',
    exchange: 'NSE',
    timeframe: '1D',
    dataRevision: 'revision-1',
    bars: createBars(60),
    horizons: [5, 10, 20],
    lookbackBars: 60,
    ...overrides,
  };
}

class CountingProvider implements DnnTrendInferenceProvider {
  readonly descriptor = {
    id: 'counting-provider',
    version: '1.0.0',
    kind: 'local' as const,
    productionReady: false,
  };

  readonly initialize = vi.fn(async () => {});
  readonly predict = vi.fn(async (input: DnnTrendInferenceInput): Promise<DnnTrendInferenceOutput> => ({
    predictions: input.horizons.map((horizonBars) => ({
      horizonBars,
      bullishProbability: 0.6,
      sidewaysProbability: 0.3,
      bearishProbability: 0.1,
    })),
  }));
  readonly dispose = vi.fn(async () => {});
}

describe('DnnTrendPredictionService', () => {
  it('returns explicitly non-production mock probabilities for supported horizons', async () => {
    const service = new DnnTrendPredictionService(
      new DeterministicMockDnnTrendInferenceProvider(),
      { now: () => new Date('2026-08-05T11:45:00.000Z') },
    );

    const result = await service.predict(request());

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.providerKind).toBe('mock');
    expect(result.productionReady).toBe(false);
    expect(result.asOfDate).toBe('2026-03-04');
    expect(result.predictions.map((prediction) => prediction.horizonBars)).toEqual([5, 10, 20]);
    for (const prediction of result.predictions) {
      const sum = prediction.bullishProbability
        + prediction.sidewaysProbability
        + prediction.bearishProbability;
      expect(sum).toBeCloseTo(1, 10);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('shares a revision-aware cached prediction for identical requests', async () => {
    const provider = new CountingProvider();
    const service = new DnnTrendPredictionService(provider);
    const input = request();

    const first = await service.predict(input);
    const second = await service.predict(input);

    expect(first).toEqual(second);
    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(provider.predict).toHaveBeenCalledTimes(1);
  });

  it('does not reuse cached output after the database revision changes', async () => {
    const provider = new CountingProvider();
    const service = new DnnTrendPredictionService(provider);

    await service.predict(request({ dataRevision: 'revision-1' }));
    await service.predict(request({ dataRevision: 'revision-2' }));

    expect(provider.predict).toHaveBeenCalledTimes(2);
  });

  it('fails closed on malformed provider probabilities', async () => {
    const provider = new CountingProvider();
    provider.predict.mockResolvedValueOnce({
      predictions: [{
        horizonBars: 5,
        bullishProbability: 0.8,
        sidewaysProbability: 0.4,
        bearishProbability: 0.1,
      }],
    });
    const service = new DnnTrendPredictionService(provider);

    const result = await service.predict(request({ horizons: [5] }));

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('probabilities must sum to 1');
    }
  });

  it('returns cancelled without invoking inference when the request is already aborted', async () => {
    const provider = new CountingProvider();
    const service = new DnnTrendPredictionService(provider);
    const controller = new AbortController();
    controller.abort();

    const result = await service.predict(request(), controller.signal);

    expect(result.status).toBe('cancelled');
    expect(provider.initialize).not.toHaveBeenCalled();
    expect(provider.predict).not.toHaveBeenCalled();
  });

  it('disposes the provider and rejects later predictions', async () => {
    const provider = new CountingProvider();
    const service = new DnnTrendPredictionService(provider);

    await service.dispose();
    const result = await service.predict(request());

    expect(provider.dispose).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('disposed');
    }
  });
});

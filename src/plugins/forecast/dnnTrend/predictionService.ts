import {
  DNN_TREND_DEFAULT_LOOKBACK_BARS,
  buildDnnTrendFeatureWindow,
} from '@/plugins/forecast/dnnTrend/featureBuilder';
import type {
  DnnTrendInferenceInput,
  DnnTrendInferenceProvider,
} from '@/plugins/forecast/dnnTrend/inferenceProvider';
import {
  createDnnTrendPredictionCacheKey,
  MemoryDnnTrendPredictionCache,
  type DnnTrendPredictionCache,
} from '@/plugins/forecast/dnnTrend/predictionCache';
import {
  normalizeDnnTrendHorizons,
  selectDnnTrendClass,
  validateDnnTrendProbability,
} from '@/plugins/forecast/dnnTrend/predictionValidation';
import type {
  DnnTrendPredictionRequest,
  DnnTrendPredictionResult,
  DnnTrendUnavailablePrediction,
  DnnTrendValidPrediction,
} from '@/plugins/forecast/dnnTrend/types';

export interface DnnTrendPredictionServiceOptions {
  cache?: DnnTrendPredictionCache;
  now?: () => Date;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function lastBarDate(request: DnnTrendPredictionRequest): string | null {
  return request.bars[request.bars.length - 1]?.date ?? null;
}

export class DnnTrendPredictionService {
  private readonly cache: DnnTrendPredictionCache;
  private readonly now: () => Date;
  private initialization: Promise<void> | null = null;
  private disposed = false;

  constructor(
    private readonly provider: DnnTrendInferenceProvider,
    options: DnnTrendPredictionServiceOptions = {},
  ) {
    this.cache = options.cache ?? new MemoryDnnTrendPredictionCache();
    this.now = options.now ?? (() => new Date());
  }

  async predict(
    request: DnnTrendPredictionRequest,
    signal?: AbortSignal,
  ): Promise<DnnTrendPredictionResult> {
    const generatedAt = this.now().toISOString();
    const unavailable = (
      status: DnnTrendUnavailablePrediction['status'],
      reason: string,
      asOfDate = lastBarDate(request),
    ): DnnTrendUnavailablePrediction => ({
      status,
      reason,
      symbol: request.symbol,
      exchange: request.exchange,
      timeframe: request.timeframe,
      dataRevision: request.dataRevision,
      asOfDate,
      generatedAt,
    });

    if (signal?.aborted) {
      return unavailable('cancelled', 'DNN trend prediction was cancelled before execution.');
    }
    if (this.disposed) {
      return unavailable('failed', 'DNN trend prediction service has been disposed.');
    }
    if (!request.symbol.trim() || !request.exchange.trim() || !request.dataRevision.trim()) {
      return unavailable('failed', 'Symbol, exchange, and data revision are required.');
    }

    const horizons = normalizeDnnTrendHorizons(request.horizons);
    if (!horizons) {
      return unavailable('failed', 'One or more requested prediction horizons are unsupported.');
    }

    const lookbackBars = request.lookbackBars ?? DNN_TREND_DEFAULT_LOOKBACK_BARS;
    const featureBuild = buildDnnTrendFeatureWindow(request.bars, lookbackBars);
    if (!featureBuild.ok) {
      return unavailable('insufficient-data', featureBuild.reason);
    }

    const input: DnnTrendInferenceInput = {
      symbol: request.symbol.trim().toUpperCase(),
      exchange: request.exchange.trim().toUpperCase(),
      timeframe: request.timeframe,
      dataRevision: request.dataRevision,
      asOfDate: featureBuild.window.asOfDate,
      horizons,
      featureVersion: featureBuild.window.featureVersion,
      featureNames: featureBuild.window.featureNames,
      featureValues: featureBuild.window.values,
    };
    const cacheKey = createDnnTrendPredictionCacheKey({
      symbol: input.symbol,
      exchange: input.exchange,
      timeframe: input.timeframe,
      dataRevision: input.dataRevision,
      asOfDate: input.asOfDate,
      horizons,
      lookbackBars,
      featureVersion: input.featureVersion,
      provider: this.provider.descriptor,
    });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      if (!this.initialization) {
        this.initialization = this.provider.initialize();
      }
      await this.initialization;
      if (signal?.aborted) {
        return unavailable('cancelled', 'DNN trend prediction was cancelled before inference.', input.asOfDate);
      }

      const output = await this.provider.predict(input, signal);
      const expectedHorizons = new Set(horizons);
      if (output.predictions.length !== expectedHorizons.size) {
        return unavailable('failed', 'Inference provider returned an unexpected number of horizons.', input.asOfDate);
      }

      const predictions = output.predictions
        .slice()
        .sort((left, right) => left.horizonBars - right.horizonBars)
        .map((prediction) => {
          const validationError = validateDnnTrendProbability(prediction);
          if (validationError) throw new Error(validationError);
          if (!expectedHorizons.delete(prediction.horizonBars)) {
            throw new Error(`Inference provider returned an unexpected or duplicate horizon: ${prediction.horizonBars}.`);
          }
          return {
            ...prediction,
            ...selectDnnTrendClass(prediction),
          };
        });
      if (expectedHorizons.size > 0) {
        throw new Error('Inference provider omitted one or more requested horizons.');
      }

      const result: DnnTrendValidPrediction = {
        status: 'valid',
        symbol: input.symbol,
        exchange: input.exchange,
        timeframe: input.timeframe,
        dataRevision: input.dataRevision,
        asOfDate: input.asOfDate,
        generatedAt,
        modelId: this.provider.descriptor.id,
        modelVersion: this.provider.descriptor.version,
        providerKind: this.provider.descriptor.kind,
        productionReady: this.provider.descriptor.productionReady,
        featureVersion: input.featureVersion,
        predictions,
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return unavailable('cancelled', 'DNN trend prediction was cancelled.', input.asOfDate);
      }
      const reason = error instanceof Error ? error.message : 'Unknown DNN trend inference failure.';
      return unavailable('failed', reason, input.asOfDate);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.cache.clear();
    await this.provider.dispose();
  }
}

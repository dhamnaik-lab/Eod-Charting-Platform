import type {
  DnnTrendInferenceInput,
  DnnTrendInferenceOutput,
  DnnTrendInferenceProvider,
} from '@/plugins/forecast/dnnTrend/inferenceProvider';
import {
  lookupDnnTrendPrecomputedPrediction,
  type DnnTrendPrecomputedPredictionSource,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';

export class PrecomputedDnnTrendInferenceProvider implements DnnTrendInferenceProvider {
  readonly descriptor;
  private disposed = false;

  constructor(private readonly source: DnnTrendPrecomputedPredictionSource) {
    this.descriptor = {
      id: source.document.model.modelId,
      version: source.document.model.modelVersion,
      kind: 'local' as const,
      productionReady: source.document.model.productionReady,
    };
  }

  async initialize(): Promise<void> {
    if (this.disposed) {
      throw new Error('Precomputed DNN trend provider has been disposed.');
    }
  }

  async predict(
    input: DnnTrendInferenceInput,
    signal?: AbortSignal,
  ): Promise<DnnTrendInferenceOutput> {
    if (this.disposed) {
      throw new Error('Precomputed DNN trend provider has been disposed.');
    }
    if (signal?.aborted) {
      throw new DOMException('Prediction was cancelled.', 'AbortError');
    }
    if (input.featureVersion !== this.source.document.model.featureVersion) {
      throw new Error(
        `Feature version mismatch: source requires ${this.source.document.model.featureVersion}, received ${input.featureVersion}.`,
      );
    }

    return {
      predictions: input.horizons.map((horizonBars) => {
        const result = lookupDnnTrendPrecomputedPrediction(this.source, {
          symbol: input.symbol,
          exchange: input.exchange,
          timeframe: input.timeframe,
          asOfDate: input.asOfDate,
          horizonBars,
          dataRevision: input.dataRevision,
        });
        if (result.status !== 'valid') {
          throw new Error(result.reason);
        }
        return {
          horizonBars: result.record.horizonBars,
          bullishProbability: result.record.bullishProbability,
          sidewaysProbability: result.record.sidewaysProbability,
          bearishProbability: result.record.bearishProbability,
        };
      }),
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

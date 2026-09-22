import type {
  DnnTrendInferenceInput,
  DnnTrendInferenceOutput,
  DnnTrendInferenceProvider,
} from '@/plugins/forecast/dnnTrend/inferenceProvider';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('DNN trend prediction was cancelled.', 'AbortError');
  }
}

export class DeterministicMockDnnTrendInferenceProvider implements DnnTrendInferenceProvider {
  readonly descriptor = {
    id: 'dnn-trend-deterministic-mock',
    version: '0.1.0',
    kind: 'mock' as const,
    productionReady: false,
  };

  private initialized = false;
  private disposed = false;

  async initialize(): Promise<void> {
    if (this.disposed) {
      throw new Error('The mock DNN trend provider has been disposed.');
    }
    this.initialized = true;
  }

  async predict(
    input: DnnTrendInferenceInput,
    signal?: AbortSignal,
  ): Promise<DnnTrendInferenceOutput> {
    checkAbort(signal);
    if (!this.initialized || this.disposed) {
      throw new Error('The mock DNN trend provider is not initialized.');
    }

    const returnIndex = input.featureNames.indexOf('logReturn');
    if (returnIndex < 0) {
      throw new Error('Required logReturn feature is missing.');
    }

    const returns = input.featureValues.map((row) => row[returnIndex] ?? 0);
    const predictions = input.horizons.map((horizonBars) => {
      const recent = returns.slice(-Math.min(horizonBars, returns.length));
      const mean = recent.reduce((total, value) => total + value, 0) / recent.length;
      const variance = recent.reduce((total, value) => total + (value - mean) ** 2, 0) / recent.length;
      const volatility = Math.sqrt(variance);
      const normalizedMomentum = clamp(
        (mean / Math.max(volatility, 0.000_1)) * Math.sqrt(recent.length),
        -2,
        2,
      );
      const directionalWeight = Math.min(0.3, Math.abs(normalizedMomentum) * 0.15);
      const bullishProbability = 0.25 + (normalizedMomentum > 0 ? directionalWeight : 0);
      const bearishProbability = 0.25 + (normalizedMomentum < 0 ? directionalWeight : 0);
      const sidewaysProbability = 1 - bullishProbability - bearishProbability;

      return {
        horizonBars,
        bullishProbability,
        sidewaysProbability,
        bearishProbability,
      };
    });

    checkAbort(signal);
    return { predictions };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.initialized = false;
  }
}

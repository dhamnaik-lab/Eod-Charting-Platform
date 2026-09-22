import type {
  DnnTrendHorizon,
  DnnTrendHorizonProbability,
  DnnTrendTimeframe,
} from '@/plugins/forecast/dnnTrend/types';

export interface DnnTrendProviderDescriptor {
  id: string;
  version: string;
  kind: 'mock' | 'local' | 'remote';
  productionReady: boolean;
}

export interface DnnTrendInferenceInput {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  dataRevision: string;
  asOfDate: string;
  horizons: readonly DnnTrendHorizon[];
  featureVersion: string;
  featureNames: readonly string[];
  featureValues: readonly (readonly number[])[];
}

export interface DnnTrendInferenceOutput {
  predictions: readonly DnnTrendHorizonProbability[];
}

export interface DnnTrendInferenceProvider {
  readonly descriptor: DnnTrendProviderDescriptor;
  initialize(): Promise<void>;
  predict(
    input: DnnTrendInferenceInput,
    signal?: AbortSignal,
  ): Promise<DnnTrendInferenceOutput>;
  dispose(): Promise<void>;
}

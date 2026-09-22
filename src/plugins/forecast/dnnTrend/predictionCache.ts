import type { DnnTrendProviderDescriptor } from '@/plugins/forecast/dnnTrend/inferenceProvider';
import type {
  DnnTrendHorizon,
  DnnTrendValidPrediction,
} from '@/plugins/forecast/dnnTrend/types';

export interface DnnTrendPredictionCacheKeyInput {
  symbol: string;
  exchange: string;
  timeframe: string;
  dataRevision: string;
  asOfDate: string;
  horizons: readonly DnnTrendHorizon[];
  lookbackBars: number;
  featureVersion: string;
  provider: DnnTrendProviderDescriptor;
}

export interface DnnTrendPredictionCache {
  get(key: string): DnnTrendValidPrediction | null;
  set(key: string, prediction: DnnTrendValidPrediction): void;
  clear(): void;
}

export function createDnnTrendPredictionCacheKey(input: DnnTrendPredictionCacheKeyInput): string {
  return [
    input.symbol.trim().toUpperCase(),
    input.exchange.trim().toUpperCase(),
    input.timeframe,
    input.dataRevision,
    input.asOfDate,
    input.horizons.join(','),
    input.lookbackBars,
    input.featureVersion,
    input.provider.id,
    input.provider.version,
  ].join('|');
}

export class MemoryDnnTrendPredictionCache implements DnnTrendPredictionCache {
  private readonly entries = new Map<string, DnnTrendValidPrediction>();

  get(key: string): DnnTrendValidPrediction | null {
    return this.entries.get(key) ?? null;
  }

  set(key: string, prediction: DnnTrendValidPrediction): void {
    this.entries.set(key, prediction);
  }

  clear(): void {
    this.entries.clear();
  }
}

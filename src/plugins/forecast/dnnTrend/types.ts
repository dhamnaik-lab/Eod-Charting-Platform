export const DNN_TREND_SUPPORTED_HORIZONS = [5, 10, 20] as const;

export type DnnTrendHorizon = (typeof DNN_TREND_SUPPORTED_HORIZONS)[number];
export type DnnTrendClass = 'bullish' | 'sideways' | 'bearish';
export type DnnTrendTimeframe = '1D';

export interface DnnTrendBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DnnTrendPredictionRequest {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  dataRevision: string;
  bars: readonly DnnTrendBar[];
  horizons?: readonly DnnTrendHorizon[];
  lookbackBars?: number;
}

export interface DnnTrendHorizonProbability {
  horizonBars: DnnTrendHorizon;
  bullishProbability: number;
  sidewaysProbability: number;
  bearishProbability: number;
}

export interface DnnTrendHorizonPrediction extends DnnTrendHorizonProbability {
  predictedClass: DnnTrendClass;
  confidence: number;
}

interface DnnTrendPredictionResultBase {
  symbol: string;
  exchange: string;
  timeframe: DnnTrendTimeframe;
  dataRevision: string;
  asOfDate: string | null;
  generatedAt: string;
}

export interface DnnTrendValidPrediction extends DnnTrendPredictionResultBase {
  status: 'valid';
  modelId: string;
  modelVersion: string;
  providerKind: 'mock' | 'local' | 'remote';
  productionReady: boolean;
  featureVersion: string;
  predictions: readonly DnnTrendHorizonPrediction[];
}

export interface DnnTrendUnavailablePrediction extends DnnTrendPredictionResultBase {
  status: 'insufficient-data' | 'failed' | 'cancelled';
  reason: string;
}

export type DnnTrendPredictionResult =
  | DnnTrendValidPrediction
  | DnnTrendUnavailablePrediction;

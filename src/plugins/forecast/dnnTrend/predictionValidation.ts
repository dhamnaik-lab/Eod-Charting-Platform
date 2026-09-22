import {
  DNN_TREND_SUPPORTED_HORIZONS,
  type DnnTrendClass,
  type DnnTrendHorizon,
  type DnnTrendHorizonProbability,
} from '@/plugins/forecast/dnnTrend/types';

const PROBABILITY_SUM_TOLERANCE = 0.000_001;

export function normalizeDnnTrendHorizons(
  horizons: readonly DnnTrendHorizon[] | undefined,
): readonly DnnTrendHorizon[] | null {
  const requested = horizons ?? DNN_TREND_SUPPORTED_HORIZONS;
  if (requested.length === 0) return null;

  const unique = new Set<number>();
  for (const horizon of requested) {
    if (!DNN_TREND_SUPPORTED_HORIZONS.includes(horizon)) return null;
    unique.add(horizon);
  }

  return [...unique].sort((left, right) => left - right) as DnnTrendHorizon[];
}

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateDnnTrendProbability(
  prediction: DnnTrendHorizonProbability,
): string | null {
  if (!DNN_TREND_SUPPORTED_HORIZONS.includes(prediction.horizonBars)) {
    return `Unsupported prediction horizon: ${prediction.horizonBars}.`;
  }

  const values = [
    prediction.bullishProbability,
    prediction.sidewaysProbability,
    prediction.bearishProbability,
  ];
  if (!values.every(isProbability)) {
    return `Horizon ${prediction.horizonBars} contains an invalid probability.`;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
    return `Horizon ${prediction.horizonBars} probabilities must sum to 1.`;
  }

  return null;
}

export function selectDnnTrendClass(
  prediction: DnnTrendHorizonProbability,
): { predictedClass: DnnTrendClass; confidence: number } {
  const ranked: Array<[DnnTrendClass, number]> = [
    ['bullish', prediction.bullishProbability],
    ['sideways', prediction.sidewaysProbability],
    ['bearish', prediction.bearishProbability],
  ];
  ranked.sort((left, right) => right[1] - left[1]);
  return {
    predictedClass: ranked[0]![0],
    confidence: ranked[0]![1],
  };
}

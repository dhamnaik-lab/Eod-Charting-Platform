import type { DnnTrendBar } from '@/plugins/forecast/dnnTrend/types';

export const DNN_TREND_FEATURE_VERSION = 'dnn-trend-features-v1';
export const DNN_TREND_DEFAULT_LOOKBACK_BARS = 60;
export const DNN_TREND_MINIMUM_LOOKBACK_BARS = 20;
export const DNN_TREND_MAXIMUM_LOOKBACK_BARS = 500;

export const DNN_TREND_FEATURE_NAMES = [
  'logReturn',
  'gapReturn',
  'rangeToPreviousClose',
  'bodyToPreviousClose',
  'upperWickToPreviousClose',
  'lowerWickToPreviousClose',
  'closeLocation',
  'volumeToTrailing20',
] as const;

export interface DnnTrendFeatureWindow {
  asOfDate: string;
  featureVersion: string;
  featureNames: readonly string[];
  values: readonly (readonly number[])[];
}

export type DnnTrendFeatureBuildResult =
  | { ok: true; window: DnnTrendFeatureWindow }
  | { ok: false; reason: string };

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validateBar(bar: DnnTrendBar, index: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date)) {
    return `Bar ${index + 1} has an invalid ISO date.`;
  }
  if (
    !isFinitePositive(bar.open)
    || !isFinitePositive(bar.high)
    || !isFinitePositive(bar.low)
    || !isFinitePositive(bar.close)
  ) {
    return `Bar ${index + 1} has a non-positive or non-finite OHLC value.`;
  }
  if (!Number.isFinite(bar.volume) || bar.volume < 0) {
    return `Bar ${index + 1} has an invalid volume.`;
  }
  if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
    return `Bar ${index + 1} has inconsistent OHLC geometry.`;
  }
  if (bar.high < bar.low) {
    return `Bar ${index + 1} has high below low.`;
  }
  return null;
}

function trailingAverage(values: readonly number[], endExclusive: number, length: number): number | null {
  const start = Math.max(0, endExclusive - length);
  if (start >= endExclusive) return null;

  let sum = 0;
  for (let index = start; index < endExclusive; index += 1) {
    sum += values[index] ?? 0;
  }
  return sum / (endExclusive - start);
}

export function buildDnnTrendFeatureWindow(
  bars: readonly DnnTrendBar[],
  requestedLookbackBars = DNN_TREND_DEFAULT_LOOKBACK_BARS,
): DnnTrendFeatureBuildResult {
  const lookbackBars = Math.floor(requestedLookbackBars);
  if (
    !Number.isFinite(requestedLookbackBars)
    || lookbackBars < DNN_TREND_MINIMUM_LOOKBACK_BARS
    || lookbackBars > DNN_TREND_MAXIMUM_LOOKBACK_BARS
  ) {
    return {
      ok: false,
      reason: `Lookback must be between ${DNN_TREND_MINIMUM_LOOKBACK_BARS} and ${DNN_TREND_MAXIMUM_LOOKBACK_BARS} completed daily bars.`,
    };
  }

  if (bars.length < lookbackBars) {
    return {
      ok: false,
      reason: `At least ${lookbackBars} completed daily bars are required; received ${bars.length}.`,
    };
  }

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]!;
    const validationError = validateBar(bar, index);
    if (validationError) return { ok: false, reason: validationError };
    if (index > 0 && bars[index - 1]!.date >= bar.date) {
      return {
        ok: false,
        reason: 'Bars must be unique and strictly chronological from oldest to newest.',
      };
    }
  }

  const selectedBars = bars.slice(-lookbackBars);
  const selectedVolumes = selectedBars.map((bar) => bar.volume);
  const values = selectedBars.map((bar, index) => {
    const previousClose = index > 0 ? selectedBars[index - 1]!.close : bar.close;
    const priceBasis = previousClose > 0 ? previousClose : bar.close;
    const candleRange = bar.high - bar.low;
    const trailingVolume = trailingAverage(selectedVolumes, index, 20);

    return [
      index > 0 ? Math.log(bar.close / previousClose) : 0,
      index > 0 ? bar.open / previousClose - 1 : 0,
      candleRange / priceBasis,
      (bar.close - bar.open) / priceBasis,
      (bar.high - Math.max(bar.open, bar.close)) / priceBasis,
      (Math.min(bar.open, bar.close) - bar.low) / priceBasis,
      candleRange > 0 ? (bar.close - bar.low) / candleRange - 0.5 : 0,
      trailingVolume && trailingVolume > 0 ? bar.volume / trailingVolume - 1 : 0,
    ];
  });

  return {
    ok: true,
    window: {
      asOfDate: selectedBars[selectedBars.length - 1]!.date,
      featureVersion: DNN_TREND_FEATURE_VERSION,
      featureNames: DNN_TREND_FEATURE_NAMES,
      values,
    },
  };
}

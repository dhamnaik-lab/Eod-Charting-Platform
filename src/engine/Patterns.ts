import type { OHLCBar, RenderableMarker } from './types';
import {
  CANDLESTICK_PATTERN_DEFINITIONS,
  detectCandlestickPatterns,
  type PatternCategory,
  type PatternDirection,
  type PatternDetectionOptions,
} from './candlestick';

export * from './candlestick';
export type { PatternDetectionOptions };

export interface CandlestickPatternOptions {
  dojiThreshold?: number;
  marubozuThreshold?: number;
  wickRatio?: number;
  starThreshold?: number;
  requireTrendContext?: boolean;
  trendLookback?: number;
}

export interface SupportedPatternItem {
  id: string;
  label: string;
  short: string;
  category: PatternCategory;
  categoryLabel: string;
  direction: PatternDirection;
  tooltip: string;
}

const CATEGORY_LABELS: Record<PatternCategory, string> = {
  single: 'Single-Candle Patterns',
  double: 'Two-Candle Patterns',
  multi: 'Multi-Candle Patterns',
};

export const SUPPORTED_PATTERNS: SupportedPatternItem[] = CANDLESTICK_PATTERN_DEFINITIONS.map(
  (def) => ({
    id: def.id,
    label: def.name,
    short: def.shortLabel,
    category: def.category,
    categoryLabel: CATEGORY_LABELS[def.category],
    direction: def.direction,
    tooltip: def.tooltip,
  }),
);

export function detectPatterns(
  bars: OHLCBar[],
  selectedPatterns: string[],
  fallbackColorOrOptions?: string | PatternDetectionOptions,
  options?: PatternDetectionOptions & CandlestickPatternOptions,
): RenderableMarker[] {
  return detectCandlestickPatterns(bars, selectedPatterns, fallbackColorOrOptions, options);
}

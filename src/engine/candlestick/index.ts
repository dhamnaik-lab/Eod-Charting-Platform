import type { OHLCBar, RenderableMarker } from '../types';
import { computeCandleProps } from './candleProps';
import {
  CANDLESTICK_PATTERN_DEFINITIONS,
  type PatternDefinition,
  type PatternCategory,
  type PatternDirection,
} from './definitions';

export * from './candleProps';
export * from './definitions';

const DIRECTION_COLORS: Record<PatternDirection, string> = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#f59e0b',
};

const DIRECTION_POSITIONS: Record<PatternDirection, 'above' | 'below'> = {
  bullish: 'below',
  bearish: 'above',
  neutral: 'above',
};

// Aliases mapping legacy pattern IDs to new pattern IDs
const LEGACY_ALIASES: Record<string, string[]> = {
  hammer: ['hammer_bullish'],
  inv_hammer: ['inverted_hammer_bullish'],
  shooting_star: ['shooting_star_bearish'],
  engulfing: ['engulfing_bullish', 'engulfing_bearish'],
  harami: ['harami_bullish', 'harami_bearish'],
  morning_star: ['morning_star_bullish'],
  evening_star: ['evening_star_bearish'],
  marubozu: ['marubozu_white_bullish', 'marubozu_black_bearish'],
  piercing: ['piercing_bullish'],
  dark_cloud: ['dark_cloud_cover_bearish'],
  soldiers: ['three_white_soldiers_bullish'],
  crows: ['three_black_crows_bearish'],
  spinning_top: ['spinning_top_white', 'spinning_top_black'],
  tweezer_top: ['tweezer_top_bearish'],
  tweezer_bottom: ['tweezer_bottom_bullish'],
  kicker_bull: ['kicking_bullish'],
  kicker_bear: ['kicking_bearish'],
};

export function resolvePatternIds(selected: string[]): Set<string> {
  const resolved = new Set<string>();
  for (const id of selected) {
    if (LEGACY_ALIASES[id]) {
      for (const alias of LEGACY_ALIASES[id]) {
        resolved.add(alias);
      }
    } else {
      resolved.add(id);
    }
  }
  return resolved;
}

export interface PatternDetectionOptions {
  bullColor?: string;
  bearColor?: string;
  neutralColor?: string;
  fallbackColor?: string;
}

export function detectCandlestickPatterns(
  bars: OHLCBar[],
  selectedPatterns?: string[],
  fallbackColorOrOptions?: string | PatternDetectionOptions,
  options?: PatternDetectionOptions,
): RenderableMarker[] {
  const opts: PatternDetectionOptions =
    typeof fallbackColorOrOptions === 'object' && fallbackColorOrOptions !== null
      ? fallbackColorOrOptions
      : {
          fallbackColor: typeof fallbackColorOrOptions === 'string' ? fallbackColorOrOptions : undefined,
          ...options,
        };

  const markers: RenderableMarker[] = [];
  const n = bars.length;
  if (n < 5) return markers;

  const activeDefs: PatternDefinition[] =
    !selectedPatterns || selectedPatterns.length === 0
      ? CANDLESTICK_PATTERN_DEFINITIONS
      : (() => {
          const resolved = resolvePatternIds(selectedPatterns);
          return CANDLESTICK_PATTERN_DEFINITIONS.filter((def) => resolved.has(def.id));
        })();

  if (!activeDefs.length) return markers;

  const props = computeCandleProps(bars);

  for (let i = 2; i < n; i++) {
    for (const def of activeDefs) {
      if (def.detect(props, i, bars)) {
        let color: string;
        if (def.direction === 'bullish') {
          color = opts.bullColor || DIRECTION_COLORS.bullish;
        } else if (def.direction === 'bearish') {
          color = opts.bearColor || DIRECTION_COLORS.bearish;
        } else {
          color = opts.neutralColor || DIRECTION_COLORS.neutral;
        }
        if (!color && opts.fallbackColor) {
          color = opts.fallbackColor;
        }

        const position = DIRECTION_POSITIONS[def.direction];
        markers.push({
          key: `${def.id}-${i}`,
          index: i,
          label: def.shortLabel,
          position,
          color,
          title: def.name,
        });
      }
    }
  }

  return markers;
}

export const PATTERN_CATEGORIES: { id: PatternCategory; label: string }[] = [
  { id: 'single', label: 'Single-Candle Patterns' },
  { id: 'double', label: 'Two-Candle Patterns' },
  { id: 'multi', label: 'Multi-Candle Patterns' },
];

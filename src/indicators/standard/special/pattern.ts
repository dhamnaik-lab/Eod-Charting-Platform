import { detectPatterns } from '@/engine/Patterns';
import { type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildPATTERN: IndicatorBuilder<Extract<ChartIndicator, { kind: 'PATTERN' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [],
    markers: detectPatterns(bars, indicator.patterns, {
      bullColor: indicator.bullColor,
      bearColor: indicator.bearColor,
      neutralColor: indicator.neutralColor,
      fallbackColor: indicator.color,
      ...(indicator as any).options,
    }),
  };
};

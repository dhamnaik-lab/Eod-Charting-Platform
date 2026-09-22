import { ATR } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  getPlotOpacity,
  getPlotSecondaryColor,
  getPlotStyle,
  isPlotVisible,
  type IndicatorBuilder,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateSupertrend(
  bars: OHLCBar[],
  period: number,
  multiplier: number,
): { supertrendUp: Array<number | null>; supertrendDown: Array<number | null> } {
  const p = Math.max(1, period || 10);
  const mult = Math.max(0.01, multiplier ?? 3);
  if (!bars.length || bars.length < p) {
    return {
      supertrendUp: new Array(bars.length).fill(null),
      supertrendDown: new Array(bars.length).fill(null),
    };
  }

  const atr = ATR.calculate({
    high: bars.map((b) => b.high),
    low: bars.map((b) => b.low),
    close: bars.map((b) => b.close),
    period: p,
  });

  const upperBand: number[] = new Array(bars.length).fill(0);
  const lowerBand: number[] = new Array(bars.length).fill(0);
  const supertrendUp: Array<number | null> = new Array(bars.length).fill(null);
  const supertrendDown: Array<number | null> = new Array(bars.length).fill(null);
  const isUpTrend: boolean[] = new Array(bars.length).fill(true);

  for (let i = p; i < bars.length; i++) {
    const atrValue = atr[i - p];
    const mid = (bars[i].high + bars[i].low) / 2;

    upperBand[i] = mid + mult * atrValue;
    lowerBand[i] = mid - mult * atrValue;

    if (i > p) {
      if (upperBand[i] > upperBand[i - 1] && bars[i - 1].close <= upperBand[i - 1]) {
        upperBand[i] = upperBand[i - 1];
      }
      if (lowerBand[i] < lowerBand[i - 1] && bars[i - 1].close >= lowerBand[i - 1]) {
        lowerBand[i] = lowerBand[i - 1];
      }

      if (isUpTrend[i - 1]) {
        isUpTrend[i] = bars[i].close >= lowerBand[i];
      } else {
        isUpTrend[i] = bars[i].close > upperBand[i];
      }
    }

    if (isUpTrend[i]) {
      supertrendUp[i] = lowerBand[i];
    } else {
      supertrendDown[i] = upperBand[i];
    }
  }

  return { supertrendUp, supertrendDown };
}

export const buildSUPERTREND: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SUPERTREND' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = Math.max(1, indicator.period || 10);
  const multiplier = Math.max(0.01, indicator.multiplier ?? 3);
  const { supertrendUp, supertrendDown } = calculateSupertrend(bars, period, multiplier);
  const supertrendValues = supertrendUp.map((value, index) => value ?? supertrendDown[index] ?? null);
  const upColor = getPlotColor(indicator, 'line', getPlotColor(indicator, 'up', indicator.upColor));
  const downColor = getPlotSecondaryColor(indicator, 'line', getPlotColor(indicator, 'down', indicator.downColor));
  return {
    indicator,
    title,
    lines: isPlotVisible(indicator, 'line')
      ? [
          {
            ...buildLineSeries(
              'st',
              'Supertrend',
              supertrendValues,
              bars.length,
              upColor,
              getPlotLineWidth(indicator, 'line', getPlotLineWidth(indicator, 'up', 2)),
              getPlotLineStyle(indicator, 'line') ?? getPlotLineStyle(indicator, 'up'),
              getPlotStyle(indicator, 'line') ?? getPlotStyle(indicator, 'up'),
              getPlotOpacity(indicator, 'line') ?? getPlotOpacity(indicator, 'up'),
            ),
            colorValues: supertrendUp.map((value, index) =>
              value !== null ? upColor : supertrendDown[index] !== null ? downColor : null,
            ),
          },
        ]
      : [],
  };
};

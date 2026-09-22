import { EMA } from 'technicalindicators';
import { padSeries, slidingWindowMax, slidingWindowMin, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

const COLOR_TURQUOISE = '#26C6DA';
const COLOR_DARK_GREEN = '#43A047';
const COLOR_PALE_GREEN = '#A5D6A7';
const COLOR_LIME = '#009688';
const COLOR_DARK_RED = '#D50000';
const COLOR_RED = '#E91E63';
const COLOR_ORANGE = '#FF6D00';
const COLOR_LIGHT_ORANGE = '#FFB74D';
const COLOR_YELLOW = '#FDD835';

function getChopZoneColor(angle: number): string {
  if (angle >= 5) return COLOR_TURQUOISE;
  if (angle >= 3.57) return COLOR_DARK_GREEN;
  if (angle >= 2.14) return COLOR_PALE_GREEN;
  if (angle >= 0.71) return COLOR_LIME;
  if (angle <= -5) return COLOR_DARK_RED;
  if (angle <= -3.57) return COLOR_RED;
  if (angle <= -2.14) return COLOR_ORANGE;
  if (angle <= -0.71) return COLOR_LIGHT_ORANGE;
  return COLOR_YELLOW;
}

export function calculateChopZone(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 30,
): { values: Array<number | null>; colorValues: Array<string | null> } {
  const total = closes.length;
  const values: Array<number | null> = new Array(total).fill(null);
  const colorValues: Array<string | null> = new Array(total).fill(null);
  if (total < Math.max(34, period)) return { values, colorValues };

  const ema34Raw = EMA.calculate({ values: closes, period: 34 });
  const ema34 = padSeries(ema34Raw, total);

  const highestHigh = slidingWindowMax(highs, period);
  const lowestLow = slidingWindowMin(lows, period);

  const pi = Math.PI;

  for (let i = 0; i < total; i++) {
    const avg = (highs[i] + lows[i] + closes[i]) / 3;
    const currEMA = ema34[i];
    const prevEMA = i > 0 ? ema34[i - 1] : null;
    const hh = highestHigh[i];
    const ll = lowestLow[i];

    values[i] = 1;

    if (currEMA === null || prevEMA === null || hh === null || ll === null || hh === ll || avg === 0) {
      colorValues[i] = COLOR_YELLOW;
      continue;
    }

    const span = (25 / (hh - ll)) * ll;
    const y2 = ((prevEMA - currEMA) / avg) * span;
    const c = Math.sqrt(1 + y2 * y2);
    let angle = Math.round((180 * Math.acos(1 / c)) / pi);
    if (y2 > 0) angle = -angle;

    colorValues[i] = getChopZoneColor(angle);
  }

  return { values, colorValues };
}

export const buildCHOP_ZONE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CHOP_ZONE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 30;

  const { values, colorValues } = calculateChopZone(highs, lows, closes, period);

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'chop-zone-hist',
      label: 'Chop Zone',
      values,
      positiveColor: COLOR_TURQUOISE,
      negativeColor: COLOR_DARK_RED,
      colorValues,
    },
    fixedRange: { min: 0, max: 1.2 },
  };
};

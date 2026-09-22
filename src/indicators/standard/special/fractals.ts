import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateFractals(
  bars: OHLCBar[],
  n = 2,
): { upFractals: Array<number | null>; downFractals: Array<number | null> } {
  const total = bars.length;
  const upFractals: Array<number | null> = new Array(total).fill(null);
  const downFractals: Array<number | null> = new Array(total).fill(null);

  for (let c = n; c < total - n; c++) {
    // Up fractal (peak high)
    let isUp = true;
    for (let i = 1; i <= n; i++) {
      if (bars[c].high <= bars[c - i].high || bars[c].high <= bars[c + i].high) {
        isUp = false;
        break;
      }
    }
    if (isUp) {
      upFractals[c] = bars[c].high;
    }

    // Down fractal (trough low)
    let isDown = true;
    for (let i = 1; i <= n; i++) {
      if (bars[c].low >= bars[c - i].low || bars[c].low >= bars[c + i].low) {
        isDown = false;
        break;
      }
    }
    if (isDown) {
      downFractals[c] = bars[c].low;
    }
  }

  return { upFractals, downFractals };
}

export const buildFRACTALS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'FRACTALS' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const n = indicator.periods ?? 2;
  const upColor = indicator.upColor ?? '#089981';
  const downColor = indicator.downColor ?? '#F23645';

  const { upFractals, downFractals } = calculateFractals(bars, n);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('up_fractal', 'Up Fractal', upFractals, bars.length, upColor, 2, 'solid'),
      buildLineSeries('down_fractal', 'Down Fractal', downFractals, bars.length, downColor, 2, 'solid'),
    ],
  };
};

import { buildLineSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateOrderBlocks(
  bars: OHLCBar[],
  sensitivity = 28,
): {
  bullObTop: Array<number | null>;
  bullObBottom: Array<number | null>;
  bearObTop: Array<number | null>;
  bearObBottom: Array<number | null>;
} {
  const n = bars.length;
  const bullObTop: Array<number | null> = new Array(n).fill(null);
  const bullObBottom: Array<number | null> = new Array(n).fill(null);
  const bearObTop: Array<number | null> = new Array(n).fill(null);
  const bearObBottom: Array<number | null> = new Array(n).fill(null);
  if (n < 20) return { bullObTop, bullObBottom, bearObTop, bearObBottom };

  const sens = sensitivity / 100;
  const pc: number[] = new Array(n).fill(0);
  for (let i = 4; i < n; i++) {
    const prevOpen = bars[i - 4].open;
    pc[i] = prevOpen !== 0 ? ((bars[i].open - prevOpen) / prevOpen) * 100 : 0;
  }

  let curBullTop: number | null = null;
  let curBullBottom: number | null = null;
  let curBearTop: number | null = null;
  let curBearBottom: number | null = null;

  let crossIndex = -10;
  let prevCrossIndex = -10;

  for (let i = 5; i < n; i++) {
    const crossUnder = pc[i - 1] >= -sens && pc[i] < -sens;
    const crossOver = pc[i - 1] <= sens && pc[i] > sens;

    if (crossUnder) {
      prevCrossIndex = crossIndex;
      crossIndex = i;
      if (crossIndex - prevCrossIndex > 5) {
        for (let j = 4; j <= 15; j++) {
          const idx = i - j;
          if (idx < 0) break;
          if (bars[idx].close > bars[idx].open) {
            curBearTop = bars[idx].high;
            curBearBottom = bars[idx].low;
            break;
          }
        }
      }
    }

    if (crossOver) {
      prevCrossIndex = crossIndex;
      crossIndex = i;
      if (crossIndex - prevCrossIndex > 5) {
        for (let j = 4; j <= 15; j++) {
          const idx = i - j;
          if (idx < 0) break;
          if (bars[idx].close < bars[idx].open) {
            curBullTop = bars[idx].high;
            curBullBottom = bars[idx].low;
            break;
          }
        }
      }
    }

    // Mitigations
    if (curBullBottom !== null && bars[i].close < curBullBottom) {
      curBullTop = null;
      curBullBottom = null;
    }
    if (curBearTop !== null && bars[i].close > curBearTop) {
      curBearTop = null;
      curBearBottom = null;
    }

    bullObTop[i] = curBullTop;
    bullObBottom[i] = curBullBottom;
    bearObTop[i] = curBearTop;
    bearObBottom[i] = curBearBottom;
  }

  return { bullObTop, bullObBottom, bearObTop, bearObBottom };
}

export const buildORDER_BLOCKS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ORDER_BLOCKS' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const sens = indicator.sensitivity ?? 28;

  const { bullObTop, bullObBottom, bearObTop, bearObBottom } = calculateOrderBlocks(bars, sens);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('bull_top', 'Bull OB Top', bullObTop, bars.length, indicator.bullColor ?? '#26A69A', 1.8),
      buildLineSeries('bull_bot', 'Bull OB Bottom', bullObBottom, bars.length, indicator.bullColor ?? '#26A69A', 1.2, 'dashed'),
      buildLineSeries('bear_top', 'Bear OB Top', bearObTop, bars.length, indicator.bearColor ?? '#EF5350', 1.8),
      buildLineSeries('bear_bot', 'Bear OB Bottom', bearObBottom, bars.length, indicator.bearColor ?? '#EF5350', 1.2, 'dashed'),
    ],
  };
};

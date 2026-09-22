import { ATR, EMA } from 'technicalindicators';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildKELTNER: IndicatorBuilder<Extract<ChartIndicator, { kind: 'KELTNER' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const ema = EMA.calculate({ values: closes, period: indicator.period });
  const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: indicator.period });
  const upper: Array<number | null> = new Array(bars.length).fill(null);
  const lower: Array<number | null> = new Array(bars.length).fill(null);
  const offset = indicator.period - 1;
  for (let i = offset; i < bars.length; i++) {
    const m = ema[i - offset];
    const a = atr[i - offset];
    if (m !== undefined && a !== undefined) {
      upper[i] = m + a * indicator.multiplier;
      lower[i] = m - a * indicator.multiplier;
    }
  }
  return {
    indicator,
    title,
    lines: [buildLineSeries('mid', 'Basis', ema, bars.length, indicator.color, 1)],
    band: { upper, lower, color: indicator.color },
  };
};

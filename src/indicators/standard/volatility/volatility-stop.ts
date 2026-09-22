import { ATR } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  isPlotVisible,
  padSeries,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateVolatilityStop(
  highs: number[],
  lows: number[],
  closes: number[],
  length = 20,
  factor = 2.0,
): { longStop: Array<number | null>; shortStop: Array<number | null> } {
  const total = closes.length;
  const longStop: Array<number | null> = new Array(total).fill(null);
  const shortStop: Array<number | null> = new Array(total).fill(null);
  if (total < length) return { longStop, shortStop };

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: length });
  const atrPadded = padSeries(atrRaw, total);

  let max: number = closes[0];
  let min: number = closes[0];
  let uptrend: boolean = true;
  let stop: number = closes[0];

  for (let i = 0; i < total; i++) {
    const src = closes[i];
    const atr = atrPadded[i] ?? (highs[i] - lows[i]);
    const atrM = atr * factor;

    if (i === 0) {
      max = src;
      min = src;
      stop = src - atrM;
    } else {
      max = Math.max(max, src);
      min = Math.min(min, src);
    }

    const next: number = uptrend
      ? Math.max(stop, max - atrM)
      : Math.min(stop, min + atrM);
    stop = next;

    const prevUptrend: boolean = uptrend;
    uptrend = src >= stop;

    if (uptrend !== prevUptrend) {
      max = src;
      min = src;
      stop = uptrend ? max - atrM : min + atrM;
    }

    if (i >= length - 1) {
      if (uptrend) {
        longStop[i] = stop;
      } else {
        shortStop[i] = stop;
      }
    }
  }

  return { longStop, shortStop };
}

export const buildVOLATILITY_STOP: IndicatorBuilder<Extract<ChartIndicator, { kind: 'VOLATILITY_STOP' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;
  const multiplier = indicator.multiplier ?? 2.0;

  const { longStop, shortStop } = calculateVolatilityStop(highs, lows, closes, period, multiplier);

  const lines: Array<RenderableLineSeries | null> = [
    isPlotVisible(indicator, 'longStop')
      ? buildLineSeries(
          'longStop',
          'Long Stop',
          longStop,
          bars.length,
          getPlotColor(indicator, 'longStop', indicator.longColor ?? '#089981'),
          getPlotLineWidth(indicator, 'longStop', 1.8),
          getPlotLineStyle(indicator, 'longStop'),
        )
      : null,
    isPlotVisible(indicator, 'shortStop')
      ? buildLineSeries(
          'shortStop',
          'Short Stop',
          shortStop,
          bars.length,
          getPlotColor(indicator, 'shortStop', indicator.shortColor ?? '#F23645'),
          getPlotLineWidth(indicator, 'shortStop', 1.8),
          getPlotLineStyle(indicator, 'shortStop'),
        )
      : null,
  ];

  return {
    indicator,
    title,
    lines: lines.filter((l): l is RenderableLineSeries => Boolean(l)),
  };
};

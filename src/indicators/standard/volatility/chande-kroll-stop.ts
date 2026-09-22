import { ATR } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  isPlotVisible,
  padSeries,
  slidingWindowMax,
  slidingWindowMin,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateChandeKrollStop(
  highs: number[],
  lows: number[],
  closes: number[],
  atrLength = 10,
  atrCoeff = 1,
  stopLength = 9,
): { stopLong: Array<number | null>; stopShort: Array<number | null> } {
  const total = highs.length;
  const stopLong: Array<number | null> = new Array(total).fill(null);
  const stopShort: Array<number | null> = new Array(total).fill(null);
  if (total < atrLength + stopLength) return { stopLong, stopShort };

  const highestHigh = slidingWindowMax(highs, atrLength);
  const lowestLow = slidingWindowMin(lows, atrLength);

  const atrRaw = ATR.calculate({ high: highs, low: lows, close: closes, period: atrLength });
  const atrPadded = padSeries(atrRaw, total);

  const firstHighStop: number[] = new Array(total).fill(0);
  const firstLowStop: number[] = new Array(total).fill(0);

  for (let i = 0; i < total; i++) {
    const hh = highestHigh[i];
    const ll = lowestLow[i];
    const a = atrPadded[i];
    if (hh !== null && ll !== null && a !== null) {
      firstHighStop[i] = hh - atrCoeff * a;
      firstLowStop[i] = ll + atrCoeff * a;
    } else {
      firstHighStop[i] = highs[i];
      firstLowStop[i] = lows[i];
    }
  }

  const stopShortRaw = slidingWindowMax(firstHighStop, stopLength);
  const stopLongRaw = slidingWindowMin(firstLowStop, stopLength);

  for (let i = atrLength + stopLength - 2; i < total; i++) {
    stopLong[i] = stopLongRaw[i];
    stopShort[i] = stopShortRaw[i];
  }

  return { stopLong, stopShort };
}

export const buildCHANDE_KROLL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CHANDE_KROLL' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const atrLength = indicator.atrPeriod ?? 10;
  const atrCoeff = indicator.atrMultiplier ?? 1;
  const stopLength = indicator.stopPeriod ?? 9;

  const { stopLong, stopShort } = calculateChandeKrollStop(highs, lows, closes, atrLength, atrCoeff, stopLength);

  const lines: Array<RenderableLineSeries | null> = [
    isPlotVisible(indicator, 'stopLong')
      ? buildLineSeries(
          'stopLong',
          'Stop Long',
          stopLong,
          bars.length,
          getPlotColor(indicator, 'stopLong', indicator.longColor ?? '#2962FF'),
          getPlotLineWidth(indicator, 'stopLong', 1.4),
          getPlotLineStyle(indicator, 'stopLong'),
        )
      : null,
    isPlotVisible(indicator, 'stopShort')
      ? buildLineSeries(
          'stopShort',
          'Stop Short',
          stopShort,
          bars.length,
          getPlotColor(indicator, 'stopShort', indicator.shortColor ?? '#FF6D00'),
          getPlotLineWidth(indicator, 'stopShort', 1.4),
          getPlotLineStyle(indicator, 'stopShort'),
        )
      : null,
  ];

  return {
    indicator,
    title,
    lines: lines.filter((l): l is RenderableLineSeries => Boolean(l)),
  };
};

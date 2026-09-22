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

export const buildICHIMOKU: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ICHIMOKU' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const { conversionPeriod, basePeriod, spanBPeriod, laggingPeriod } = indicator;
  const tenkan: Array<number | null> = new Array(bars.length).fill(null);
  const kijun: Array<number | null> = new Array(bars.length).fill(null);
  const senkouA: Array<number | null> = new Array(bars.length).fill(null);
  const senkouB: Array<number | null> = new Array(bars.length).fill(null);
  const chikou: Array<number | null> = new Array(bars.length).fill(null);

  const buildMid = (p: number) => {
    const res = new Array(bars.length).fill(null);
    if (bars.length < p) return res;
    const h = slidingWindowMax(highs, p);
    const l = slidingWindowMin(lows, p);
    for (let i = p - 1; i < bars.length; i++) {
      res[i] = (h[i] + l[i]) / 2;
    }
    return res;
  };

  const tValues = buildMid(conversionPeriod);
  const kValues = buildMid(basePeriod);
  const bValues = buildMid(spanBPeriod);

  for (let i = 0; i < bars.length; i++) {
    tenkan[i] = tValues[i];
    kijun[i] = kValues[i];
    if (i + laggingPeriod < bars.length) {
      chikou[i] = closes[i + laggingPeriod];
    }
    const senA = (tenkan[i] !== null && kijun[i] !== null) ? (tenkan[i]! + kijun[i]!) / 2 : null;
    const senB = bValues[i];
    if (i + basePeriod < bars.length) {
      senkouA[i + basePeriod] = senA;
      senkouB[i + basePeriod] = senB;
    }
  }
  return {
    indicator,
    title,
    lines: [
      isPlotVisible(indicator, 'conversion')
        ? buildLineSeries(
            'tenkan',
            'Tenkan',
            tenkan,
            bars.length,
            getPlotColor(indicator, 'conversion', indicator.conversionColor),
            getPlotLineWidth(indicator, 'conversion', 1.2),
            getPlotLineStyle(indicator, 'conversion'),
          )
        : null,
      isPlotVisible(indicator, 'base')
        ? buildLineSeries(
            'kijun',
            'Kijun',
            kijun,
            bars.length,
            getPlotColor(indicator, 'base', indicator.baseColor),
            getPlotLineWidth(indicator, 'base', 1.2),
            getPlotLineStyle(indicator, 'base'),
          )
        : null,
      isPlotVisible(indicator, 'spanA')
        ? buildLineSeries(
            'senA',
            'Span A',
            senkouA,
            bars.length,
            getPlotColor(indicator, 'spanA', '#00b4d8'),
            getPlotLineWidth(indicator, 'spanA', 0.8),
            getPlotLineStyle(indicator, 'spanA'),
          )
        : null,
      isPlotVisible(indicator, 'spanB')
        ? buildLineSeries(
            'senB',
            'Span B',
            senkouB,
            bars.length,
            getPlotColor(indicator, 'spanB', '#ff4d6d'),
            getPlotLineWidth(indicator, 'spanB', 0.8),
            getPlotLineStyle(indicator, 'spanB'),
          )
        : null,
      isPlotVisible(indicator, 'lagging')
        ? buildLineSeries(
            'chikou',
            'Chikou',
            chikou,
            bars.length,
            getPlotColor(indicator, 'lagging', indicator.laggingColor),
            getPlotLineWidth(indicator, 'lagging', 1),
            getPlotLineStyle(indicator, 'lagging'),
          )
        : null,
    ].filter((line): line is RenderableLineSeries => Boolean(line)),
    band: {
      upper: padSeries(senkouA, bars.length),
      lower: padSeries(senkouB, bars.length),
      color: getPlotColor(indicator, 'cloud', 'rgba(38, 166, 154, 0.2)'),
      visible: isPlotVisible(indicator, 'cloud'),
    },
  };
};

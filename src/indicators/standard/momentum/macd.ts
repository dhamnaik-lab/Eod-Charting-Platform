import { MACD } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLabel,
  getPlotLineStyle,
  getPlotLineWidth,
  getPlotSettings,
  getSourceValues,
  isPlotVisible,
  padSeries,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildMACD: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MACD' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = MACD.calculate({
    values: srcValues,
    fastPeriod: indicator.fastPeriod,
    slowPeriod: indicator.slowPeriod,
    signalPeriod: indicator.signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLine = buildLineSeries(
    'macd-main',
    getPlotLabel(indicator, 'macd', 'MACD'),
    values.map((v) => v.MACD ?? null),
    bars.length,
    getPlotColor(indicator, 'macd', indicator.color),
    getPlotLineWidth(indicator, 'macd', 1.8),
    getPlotLineStyle(indicator, 'macd'),
  );
  const signalLine = buildLineSeries(
    'macd-sig',
    getPlotLabel(indicator, 'signal', 'Signal'),
    values.map((v) => v.signal ?? null),
    bars.length,
    getPlotColor(indicator, 'signal', indicator.signalColor),
    getPlotLineWidth(indicator, 'signal', 1.4),
    getPlotLineStyle(indicator, 'signal'),
  );
  const histogramSettings = getPlotSettings(indicator, 'histogram');
  return {
    indicator,
    title,
    lines: [
      isPlotVisible(indicator, 'macd') ? macdLine : null,
      isPlotVisible(indicator, 'signal') ? signalLine : null,
    ].filter((line): line is RenderableLineSeries => Boolean(line)),
    histogram: isPlotVisible(indicator, 'histogram')
      ? {
          key: 'macd-hist',
          label: getPlotLabel(indicator, 'histogram', 'Histogram'),
          values: padSeries(values.map((v) => v.histogram ?? null), bars.length),
          positiveColor: histogramSettings?.positiveColor ?? indicator.histogramPositiveColor,
          negativeColor: histogramSettings?.negativeColor ?? indicator.histogramNegativeColor,
        }
      : undefined,
  };
};

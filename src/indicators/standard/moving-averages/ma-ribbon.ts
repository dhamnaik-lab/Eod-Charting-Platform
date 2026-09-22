import { EMA, SMA, WMA } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  getSourceValues,
  isPlotVisible,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

function computeMA(values: number[], period: number, maType: 'SMA' | 'EMA' | 'WMA' = 'SMA'): Array<number | null> {
  if (period <= 0 || values.length < period) return new Array(values.length).fill(null);
  switch (maType) {
    case 'EMA':
      return EMA.calculate({ values, period });
    case 'WMA':
      return WMA.calculate({ values, period });
    case 'SMA':
    default:
      return SMA.calculate({ values, period });
  }
}

export const buildMA_RIBBON: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MA_RIBBON' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const maType = indicator.maType ?? 'SMA';

  const p1 = indicator.period1 ?? 20;
  const p2 = indicator.period2 ?? 50;
  const p3 = indicator.period3 ?? 100;
  const p4 = indicator.period4 ?? 200;

  const lines: Array<RenderableLineSeries | null> = [
    isPlotVisible(indicator, 'ma1')
      ? buildLineSeries(
          'ma1',
          `MA ${p1}`,
          computeMA(srcValues, p1, maType),
          bars.length,
          getPlotColor(indicator, 'ma1', indicator.color1 ?? '#f6c309'),
          getPlotLineWidth(indicator, 'ma1', 1.2),
          getPlotLineStyle(indicator, 'ma1'),
        )
      : null,
    isPlotVisible(indicator, 'ma2')
      ? buildLineSeries(
          'ma2',
          `MA ${p2}`,
          computeMA(srcValues, p2, maType),
          bars.length,
          getPlotColor(indicator, 'ma2', indicator.color2 ?? '#fb9800'),
          getPlotLineWidth(indicator, 'ma2', 1.2),
          getPlotLineStyle(indicator, 'ma2'),
        )
      : null,
    isPlotVisible(indicator, 'ma3')
      ? buildLineSeries(
          'ma3',
          `MA ${p3}`,
          computeMA(srcValues, p3, maType),
          bars.length,
          getPlotColor(indicator, 'ma3', indicator.color3 ?? '#fb6500'),
          getPlotLineWidth(indicator, 'ma3', 1.2),
          getPlotLineStyle(indicator, 'ma3'),
        )
      : null,
    isPlotVisible(indicator, 'ma4')
      ? buildLineSeries(
          'ma4',
          `MA ${p4}`,
          computeMA(srcValues, p4, maType),
          bars.length,
          getPlotColor(indicator, 'ma4', indicator.color4 ?? '#f60c0c'),
          getPlotLineWidth(indicator, 'ma4', 1.2),
          getPlotLineStyle(indicator, 'ma4'),
        )
      : null,
  ];

  return {
    indicator,
    title,
    lines: lines.filter((line): line is RenderableLineSeries => Boolean(line)),
  };
};

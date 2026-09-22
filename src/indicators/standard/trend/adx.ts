import { ADX } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  isPlotVisible,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildADX: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ADX' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: indicator.period,
  });
  return {
    indicator,
    title,
    lines: [
      isPlotVisible(indicator, 'adx')
        ? buildLineSeries(
            'adx',
            'ADX',
            values.map((item) => item.adx ?? null),
            bars.length,
            getPlotColor(indicator, 'adx', indicator.color),
            getPlotLineWidth(indicator, 'adx', 1.8),
            getPlotLineStyle(indicator, 'adx'),
          )
        : null,
      isPlotVisible(indicator, 'plusDI')
        ? buildLineSeries(
            'adx-plus',
            '+DI',
            values.map((item) => item.pdi ?? null),
            bars.length,
            getPlotColor(indicator, 'plusDI', indicator.plusColor),
            getPlotLineWidth(indicator, 'plusDI', 1.4),
            getPlotLineStyle(indicator, 'plusDI'),
          )
        : null,
      isPlotVisible(indicator, 'minusDI')
        ? buildLineSeries(
            'adx-minus',
            '-DI',
            values.map((item) => item.mdi ?? null),
            bars.length,
            getPlotColor(indicator, 'minusDI', indicator.minusColor),
            getPlotLineWidth(indicator, 'minusDI', 1.4),
            getPlotLineStyle(indicator, 'minusDI'),
          )
        : null,
    ].filter((line): line is RenderableLineSeries => Boolean(line)),
    referenceLines: [25],
    fixedRange: { min: 0, max: 100 },
  };
};

import { BollingerBands } from 'technicalindicators';
import {
  buildLineSeries,
  getPlotColor,
  getPlotLineStyle,
  getPlotLineWidth,
  getSourceValues,
  isPlotVisible,
  padSeries,
  type IndicatorBuilder,
  type RenderableLineSeries,
} from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildBOLL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'BOLL' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const values = BollingerBands.calculate({
    values: srcValues,
    period: indicator.period,
    stdDev: indicator.stdDev,
  });
  const basisValues = values.map((v) => v.middle ?? null);
  const upperValues = values.map((v) => v.upper ?? null);
  const lowerValues = values.map((v) => v.lower ?? null);
  const lineCandidates = [
    isPlotVisible(indicator, 'basis')
      ? buildLineSeries(
          'boll-mid',
          'Basis',
          basisValues,
          bars.length,
          getPlotColor(indicator, 'basis', indicator.color),
          getPlotLineWidth(indicator, 'basis', 1),
          getPlotLineStyle(indicator, 'basis'),
        )
      : null,
    isPlotVisible(indicator, 'upper', false)
      ? buildLineSeries(
          'boll-upper',
          'Upper',
          upperValues,
          bars.length,
          getPlotColor(indicator, 'upper', indicator.color),
          getPlotLineWidth(indicator, 'upper', 1),
          getPlotLineStyle(indicator, 'upper'),
        )
      : null,
    isPlotVisible(indicator, 'lower', false)
      ? buildLineSeries(
          'boll-lower',
          'Lower',
          lowerValues,
          bars.length,
          getPlotColor(indicator, 'lower', indicator.color),
          getPlotLineWidth(indicator, 'lower', 1),
          getPlotLineStyle(indicator, 'lower'),
        )
      : null,
  ];
  return {
    indicator,
    title,
    lines: lineCandidates.filter((line): line is RenderableLineSeries => Boolean(line)),
    band: {
      upper: padSeries(upperValues, bars.length),
      lower: padSeries(lowerValues, bars.length),
      color: getPlotColor(indicator, 'band', indicator.color),
      visible: isPlotVisible(indicator, 'band'),
    },
  };
};

import { EMA, SMA } from 'technicalindicators';
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

export function calculateEnvelope(
  values: number[],
  period = 20,
  percent = 10,
  exponential = false,
): { basis: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } {
  const total = values.length;
  const basis: Array<number | null> = new Array(total).fill(null);
  const upper: Array<number | null> = new Array(total).fill(null);
  const lower: Array<number | null> = new Array(total).fill(null);
  if (total < period) return { basis, upper, lower };

  const maRaw = exponential
    ? EMA.calculate({ values, period })
    : SMA.calculate({ values, period });
  const maPadded = padSeries(maRaw, total);

  const k = percent / 100;
  for (let i = 0; i < total; i++) {
    const b = maPadded[i];
    if (b !== null) {
      basis[i] = b;
      upper[i] = b * (1 + k);
      lower[i] = b * (1 - k);
    }
  }

  return { basis, upper, lower };
}

export const buildENVELOPE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ENVELOPE' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, indicator.source ?? 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 20;
  const percent = indicator.percent ?? 10;
  const exponential = indicator.exponential ?? false;

  const { basis, upper, lower } = calculateEnvelope(srcValues, period, percent, exponential);

  const lines: Array<RenderableLineSeries | null> = [
    isPlotVisible(indicator, 'basis')
      ? buildLineSeries(
          'basis',
          'Basis',
          basis,
          bars.length,
          getPlotColor(indicator, 'basis', indicator.basisColor ?? '#FF6D00'),
          getPlotLineWidth(indicator, 'basis', 1.4),
          getPlotLineStyle(indicator, 'basis'),
        )
      : null,
    isPlotVisible(indicator, 'upper')
      ? buildLineSeries(
          'upper',
          `Upper (+${percent}%)`,
          upper,
          bars.length,
          getPlotColor(indicator, 'upper', indicator.upperColor ?? '#2962FF'),
          getPlotLineWidth(indicator, 'upper', 1.2),
          getPlotLineStyle(indicator, 'upper'),
        )
      : null,
    isPlotVisible(indicator, 'lower')
      ? buildLineSeries(
          'lower',
          `Lower (-${percent}%)`,
          lower,
          bars.length,
          getPlotColor(indicator, 'lower', indicator.lowerColor ?? '#2962FF'),
          getPlotLineWidth(indicator, 'lower', 1.2),
          getPlotLineStyle(indicator, 'lower'),
        )
      : null,
  ];

  return {
    indicator,
    title,
    lines: lines.filter((l): l is RenderableLineSeries => Boolean(l)),
    bands: [
      {
        upperLineKey: 'upper',
        lowerLineKey: 'lower',
        fillColor: 'rgba(33, 150, 243, 0.08)',
      },
    ],
  };
};

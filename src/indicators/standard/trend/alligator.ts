import {
  applyOffset,
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

export function calculateSMMA(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let smma = sum / period;
  result[period - 1] = smma;

  for (let i = period; i < values.length; i++) {
    smma = (smma * (period - 1) + values[i]) / period;
    result[i] = smma;
  }

  return result;
}

export const buildALLIGATOR: IndicatorBuilder<Extract<ChartIndicator, { kind: 'ALLIGATOR' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const hl2 = bars.map((_, i) => (highs[i] + lows[i]) / 2);
  const title = getCompactIndicatorDisplayLabel(indicator);

  const jawPeriod = indicator.jawPeriod ?? 13;
  const jawOffset = indicator.jawOffset ?? 8;
  const teethPeriod = indicator.teethPeriod ?? 8;
  const teethOffset = indicator.teethOffset ?? 5;
  const lipsPeriod = indicator.lipsPeriod ?? 5;
  const lipsOffset = indicator.lipsOffset ?? 3;

  const jawRaw = calculateSMMA(hl2, jawPeriod);
  const teethRaw = calculateSMMA(hl2, teethPeriod);
  const lipsRaw = calculateSMMA(hl2, lipsPeriod);

  const jawShifted = applyOffset(jawRaw, jawOffset);
  const teethShifted = applyOffset(teethRaw, teethOffset);
  const lipsShifted = applyOffset(lipsRaw, lipsOffset);

  const lines: Array<RenderableLineSeries | null> = [
    isPlotVisible(indicator, 'jaw')
      ? buildLineSeries(
          'jaw',
          'Jaw',
          jawShifted,
          bars.length,
          getPlotColor(indicator, 'jaw', indicator.jawColor ?? '#2962FF'),
          getPlotLineWidth(indicator, 'jaw', 1.5),
          getPlotLineStyle(indicator, 'jaw'),
        )
      : null,
    isPlotVisible(indicator, 'teeth')
      ? buildLineSeries(
          'teeth',
          'Teeth',
          teethShifted,
          bars.length,
          getPlotColor(indicator, 'teeth', indicator.teethColor ?? '#E91E63'),
          getPlotLineWidth(indicator, 'teeth', 1.5),
          getPlotLineStyle(indicator, 'teeth'),
        )
      : null,
    isPlotVisible(indicator, 'lips')
      ? buildLineSeries(
          'lips',
          'Lips',
          lipsShifted,
          bars.length,
          getPlotColor(indicator, 'lips', indicator.lipsColor ?? '#66BB6A'),
          getPlotLineWidth(indicator, 'lips', 1.5),
          getPlotLineStyle(indicator, 'lips'),
        )
      : null,
  ];

  return {
    indicator,
    title,
    lines: lines.filter((line): line is RenderableLineSeries => Boolean(line)),
  };
};

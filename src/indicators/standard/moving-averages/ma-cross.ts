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
  type RenderableMarker,
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

export const buildMA_CROSS: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MA_CROSS' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const fastPeriod = indicator.fastPeriod ?? 9;
  const slowPeriod = indicator.slowPeriod ?? 21;
  const maType = indicator.maType ?? 'SMA';

  const fastMA = computeMA(srcValues, fastPeriod, maType);
  const slowMA = computeMA(srcValues, slowPeriod, maType);

  const fastLine = buildLineSeries(
    'fast',
    `Fast (${fastPeriod})`,
    fastMA,
    bars.length,
    getPlotColor(indicator, 'fast', indicator.fastColor ?? '#FF6D00'),
    getPlotLineWidth(indicator, 'fast', 1.5),
    getPlotLineStyle(indicator, 'fast'),
  );

  const slowLine = buildLineSeries(
    'slow',
    `Slow (${slowPeriod})`,
    slowMA,
    bars.length,
    getPlotColor(indicator, 'slow', indicator.slowColor ?? '#43A047'),
    getPlotLineWidth(indicator, 'slow', 1.5),
    getPlotLineStyle(indicator, 'slow'),
  );

  const markers: RenderableMarker[] = [];
  const crossColor = indicator.crossColor ?? '#2962FF';

  for (let i = 1; i < bars.length; i++) {
    const fPrev = fastLine.values[i - 1];
    const fCurr = fastLine.values[i];
    const sPrev = slowLine.values[i - 1];
    const sCurr = slowLine.values[i];

    if (fPrev !== null && fCurr !== null && sPrev !== null && sCurr !== null) {
      if (fPrev <= sPrev && fCurr > sCurr) {
        markers.push({
          key: `cross-bull-${i}`,
          index: i,
          label: '▲',
          position: 'below',
          color: crossColor,
          title: `Bullish Cross (${fastPeriod} > ${slowPeriod})`,
        });
      } else if (fPrev >= sPrev && fCurr < sCurr) {
        markers.push({
          key: `cross-bear-${i}`,
          index: i,
          label: '▼',
          position: 'above',
          color: crossColor,
          title: `Bearish Cross (${fastPeriod} < ${slowPeriod})`,
        });
      }
    }
  }

  return {
    indicator,
    title,
    lines: [
      isPlotVisible(indicator, 'fast') ? fastLine : null,
      isPlotVisible(indicator, 'slow') ? slowLine : null,
    ].filter((line): line is RenderableLineSeries => Boolean(line)),
    markers,
  };
};

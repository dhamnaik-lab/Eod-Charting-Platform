import { RSI, SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildSTOCHRSI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'STOCHRSI' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', indicator.sourceIndicatorId, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const rsiRaw = RSI.calculate({ values: srcValues, period: indicator.rsiPeriod ?? 14 });
  const rsiPadded = padSeries(rsiRaw, bars.length);
  const stochP = indicator.stochPeriod ?? 14;
  const kP = indicator.kPeriod ?? 3;
  const dP = indicator.dPeriod ?? 3;

  const kRaw: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = stochP - 1; i < bars.length; i++) {
    const slice = rsiPadded.slice(i - stochP + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length === stochP) {
      const minR = Math.min(...slice);
      const maxR = Math.max(...slice);
      const curr = rsiPadded[i]!;
      kRaw[i] = maxR === minR ? 50 : ((curr - minR) / (maxR - minR)) * 100;
    }
  }

  const validK = kRaw.filter((v): v is number => v !== null);
  const kSmoothed = SMA.calculate({ values: validK, period: kP });
  const kPadded = padSeries(kSmoothed, bars.length);

  const validKSmooth = kSmoothed.filter((v): v is number => v !== null);
  const dSmoothed = SMA.calculate({ values: validKSmooth, period: dP });
  const dPadded = padSeries(dSmoothed, bars.length);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('k', '%K', kPadded, bars.length, indicator.color ?? '#00d2ff', 1.8),
      buildLineSeries('d', '%D', dPadded, bars.length, indicator.signalColor ?? '#ff9f43', 1.4),
    ],
    referenceLines: [80, 20],
  };
};

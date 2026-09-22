import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import { calculateRCI } from './rank-correlation-index';
import type { ChartIndicator } from '@/engine/types';

export function calculateRCIRibbon(
  closes: number[],
  shortLength = 10,
  middleLength = 30,
  longLength = 50,
): { shortRCI: Array<number | null>; middleRCI: Array<number | null>; longRCI: Array<number | null> } {
  const { rci: shortRCI } = calculateRCI(closes, shortLength);
  const { rci: middleRCI } = calculateRCI(closes, middleLength);
  const { rci: longRCI } = calculateRCI(closes, longLength);

  return { shortRCI, middleRCI, longRCI };
}

export const buildRCI_RIBBON: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RCI_RIBBON' }>> = (
  bars,
  indicator,
  sources,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const sLen = indicator.shortLength ?? 10;
  const mLen = indicator.middleLength ?? 30;
  const lLen = indicator.longLength ?? 50;

  const { shortRCI, middleRCI, longRCI } = calculateRCIRibbon(sources.closes, sLen, mLen, lLen);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('short_rci', `RCI (${sLen})`, shortRCI, bars.length, indicator.shortColor ?? '#2962FF', 1.6),
      buildLineSeries('mid_rci', `RCI (${mLen})`, middleRCI, bars.length, indicator.middleColor ?? '#F23645', 1.6),
      buildLineSeries('long_rci', `RCI (${lLen})`, longRCI, bars.length, indicator.longColor ?? '#089981', 1.6),
    ],
    referenceLines: [-80, 0, 80],
  };
};

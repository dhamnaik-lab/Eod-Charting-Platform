import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateUpDownVolume(
  bars: OHLCBar[],
): { up: Array<number | null>; down: Array<number | null>; delta: Array<number | null> } {
  const total = bars.length;
  const up: Array<number | null> = new Array(total).fill(null);
  const down: Array<number | null> = new Array(total).fill(null);
  const delta: Array<number | null> = new Array(total).fill(null);

  for (let i = 0; i < total; i++) {
    const vol = bars[i].volume ?? 0;
    const ref = i > 0 ? bars[i - 1].close : bars[i].open;
    const isUp = bars[i].close >= ref;
    const upVol = isUp ? vol : 0;
    const downVol = isUp ? 0 : vol;

    up[i] = upVol;
    down[i] = -downVol;
    delta[i] = upVol - downVol;
  }

  return { up, down, delta };
}

export const buildUP_DOWN_VOL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'UP_DOWN_VOL' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const { delta } = calculateUpDownVolume(bars);

  const upColor = indicator.upColor ?? '#089981';
  const downColor = indicator.downColor ?? '#F23645';

  const colorValues: Array<string | null> = delta.map((val) => {
    if (val === null) return null;
    return val >= 0 ? upColor : downColor;
  });

  return {
    indicator,
    title,
    lines: [buildLineSeries('delta', 'Delta', delta, bars.length, indicator.deltaColor ?? '#2962FF', 1.8)],
    histogram: {
      key: 'up_down_hist',
      readoutDuplicateOf: 'delta',
      label: 'Net Volume',
      values: delta,
      positiveColor: upColor,
      negativeColor: downColor,
      colorValues,
    },
    referenceLines: [0],
  };
};

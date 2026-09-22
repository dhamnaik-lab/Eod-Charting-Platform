import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateFisher(
  highs: number[],
  lows: number[],
  period = 9,
): { fisher: Array<number | null>; trigger: Array<number | null> } {
  const total = highs.length;
  const fisher: Array<number | null> = new Array(total).fill(null);
  const trigger: Array<number | null> = new Array(total).fill(null);
  if (total < period) return { fisher, trigger };

  let value = 0;
  let fish1 = 0;

  for (let i = 0; i < total; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    let highestHl2 = hl2;
    let lowestHl2 = hl2;
    const lookback = Math.min(i + 1, period);

    for (let j = 0; j < lookback; j++) {
      const pHL2 = (highs[i - j] + lows[i - j]) / 2;
      if (pHL2 > highestHl2) highestHl2 = pHL2;
      if (pHL2 < lowestHl2) lowestHl2 = pHL2;
    }

    const range = highestHl2 - lowestHl2;
    const normalized = range !== 0 ? (hl2 - lowestHl2) / range - 0.5 : 0;
    const rawValue = 0.66 * normalized + 0.67 * value;
    value = Math.max(-0.999, Math.min(0.999, rawValue));

    const prevFish1 = fish1;
    fish1 = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * prevFish1;

    if (i >= period - 1) {
      fisher[i] = fish1;
      trigger[i] = prevFish1;
    }
  }

  return { fisher, trigger };
}

export const buildFISHER: IndicatorBuilder<Extract<ChartIndicator, { kind: 'FISHER' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 9;
  const { fisher, trigger } = calculateFisher(highs, lows, period);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('fisher', 'Fisher', fisher, bars.length, indicator.color ?? '#2962FF', 1.8),
      buildLineSeries('trigger', 'Trigger', trigger, bars.length, indicator.signalColor ?? '#FF6D00', 1.4),
    ],
    referenceLines: [-1.5, 0, 1.5],
  };
};

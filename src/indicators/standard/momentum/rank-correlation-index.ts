import { SMA } from 'technicalindicators';
import { buildLineSeries, getSourceValues, padSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export function calculateRCI(
  values: number[],
  period = 10,
  signalPeriod = 14,
): { rci: Array<number | null>; signal: Array<number | null> } {
  const total = values.length;
  const rci: Array<number | null> = new Array(total).fill(null);
  const signal: Array<number | null> = new Array(total).fill(null);
  if (total < period || period <= 1) return { rci, signal };

  const n = period;
  const denom = n * (n * n - 1);

  for (let i = n - 1; i < total; i++) {
    // Extract the window
    const window: Array<{ price: number; timeOrder: number }> = [];
    for (let j = 0; j < n; j++) {
      window.push({
        price: values[i - (n - 1 - j)],
        timeOrder: j + 1, // 1 to n (chronological)
      });
    }

    // Sort by price descending to assign price ranks
    const sorted = [...window].sort((a, b) => b.price - a.price);
    let d = 0;

    for (let rank = 1; rank <= n; rank++) {
      const item = sorted[rank - 1];
      const diff = item.timeOrder - (n - rank + 1); // Rank correlation
      d += diff * diff;
    }

    rci[i] = (1 - (6 * d) / denom) * 100;
  }

  if (signalPeriod > 1) {
    const validRCI = rci.filter((v): v is number => v !== null);
    const sma = SMA.calculate({ values: validRCI, period: signalPeriod });
    const smaPadded = padSeries(sma, total);
    for (let i = 0; i < total; i++) {
      signal[i] = smaPadded[i];
    }
  }

  return { rci, signal };
}

export const buildRCI: IndicatorBuilder<Extract<ChartIndicator, { kind: 'RCI' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 10;
  const sigPeriod = indicator.signalPeriod ?? 14;

  const { rci, signal } = calculateRCI(srcValues, period, sigPeriod);

  const lines = [
    buildLineSeries('rci', 'RCI', rci, bars.length, indicator.color ?? '#2962FF', 1.8),
  ];
  if (sigPeriod > 1) {
    lines.push(
      buildLineSeries('signal', 'Signal', signal, bars.length, indicator.signalColor ?? '#E2CC00', 1.4),
    );
  }

  return {
    indicator,
    title,
    lines,
    referenceLines: [-80, 0, 80],
    fixedRange: { min: -100, max: 100 },
  };
};

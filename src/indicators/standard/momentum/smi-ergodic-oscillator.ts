import { getSourceValues, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';
import { calculateSMIErgodic } from './smi-ergodic';

export const buildSMI_ERGODIC_OSC: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SMI_ERGODIC_OSC' }>> = (
  bars,
  indicator,
  sources,
  sourceSeriesMap,
) => {
  const srcValues = getSourceValues(bars, 'close', undefined, sourceSeriesMap);
  const title = getCompactIndicatorDisplayLabel(indicator);
  const longLength = indicator.longLength ?? 20;
  const shortLength = indicator.shortLength ?? 5;
  const signalLength = indicator.signalLength ?? 5;

  const { osc } = calculateSMIErgodic(srcValues, longLength, shortLength, signalLength);

  const posColor = indicator.positiveColor ?? '#26a69a';
  const negColor = indicator.negativeColor ?? '#FF5252';

  return {
    indicator,
    title,
    lines: [],
    histogram: {
      key: 'smi-osc-hist',
      label: 'SMI Oscillator',
      values: osc,
      positiveColor: posColor,
      negativeColor: negColor,
    },
    referenceLines: [0],
  };
};

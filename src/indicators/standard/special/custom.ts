import { evaluateCustomFormulaDefinition } from '@/modules/formulaEngine/customFormulaEngine';
import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildCUSTOM: IndicatorBuilder<Extract<ChartIndicator, { kind: 'CUSTOM' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const evaluation = evaluateCustomFormulaDefinition(indicator.formula, bars);
  const lineValues = evaluation.plots[0]?.values ?? [];
  return {
    indicator,
    title,
    lines: [buildLineSeries('custom', title, lineValues, bars.length, indicator.color, 1.8)],
    referenceLines: indicator.placement === 'pane' ? [0] : undefined,
  };
};

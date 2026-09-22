import { buildLineSeries, type IndicatorBuilder } from '../../base';
import { getCompactIndicatorDisplayLabel } from '../../catalog';
import type { ChartIndicator } from '@/engine/types';

export const buildAVGPRICE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'AVGPRICE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const values = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    values[i] = (bars[i].open + highs[i] + lows[i] + closes[i]) / 4;
  }
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [buildLineSeries('avgprice', title, values, bars.length, indicator.color, 1.8)],
  };
};

export const buildMEDPRICE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'MEDPRICE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows } = sources;
  const values = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    values[i] = (highs[i] + lows[i]) / 2;
  }
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [buildLineSeries('medprice', title, values, bars.length, indicator.color, 1.8)],
  };
};

export const buildTYPPRICE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'TYPPRICE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const values = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    values[i] = (highs[i] + lows[i] + closes[i]) / 3;
  }
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [buildLineSeries('typprice', title, values, bars.length, indicator.color, 1.8)],
  };
};

export const buildWCLPRICE: IndicatorBuilder<Extract<ChartIndicator, { kind: 'WCLPRICE' }>> = (
  bars,
  indicator,
  sources,
) => {
  const { highs, lows, closes } = sources;
  const values = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    values[i] = (highs[i] + lows[i] + 2 * closes[i]) / 4;
  }
  const title = getCompactIndicatorDisplayLabel(indicator);
  return {
    indicator,
    title,
    lines: [buildLineSeries('wclprice', title, values, bars.length, indicator.color, 1.8)],
  };
};

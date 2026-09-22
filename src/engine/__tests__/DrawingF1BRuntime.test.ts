import { describe, expect, it } from 'vitest';
import {
  formatFibonacciCoefficient,
  getFibonacciLevelSlotId,
  resolveFibonacciLevels,
  resolveFibonacciOptions,
} from '../DrawingF1BRuntime';
import type { ChartDrawing } from '../types';

const baseFib = {
  id: 'f1b-runtime',
  kind: 'fib',
  startIndex: 10,
  startPrice: 100,
  endIndex: 20,
  endPrice: 120,
  color: '#ffffff',
} as ChartDrawing;

describe('F1B Fibonacci runtime contracts', () => {
  it('consumes F1A-style stable persisted level rows and ignores disabled rows in geometry callers', () => {
    const drawing = {
      ...baseFib,
      toolSettings: {
        levels: [
          { id: 'fib-l0', value: 0, enabled: true },
          { id: 'fib-l1', value: 0.618, enabled: false, customText: 'Golden' },
          { id: 'fib-l2', value: 1.272, enabled: true },
        ],
      },
    } as unknown as ChartDrawing;
    expect(resolveFibonacciLevels(drawing, [0, 1])).toEqual([
      { id: 'fib-l0', value: 0, enabled: true, text: undefined },
      { id: 'fib-l1', value: 0.618, enabled: false, text: 'Golden' },
      { id: 'fib-l2', value: 1.272, enabled: true, text: undefined },
    ]);
    expect(getFibonacciLevelSlotId(resolveFibonacciLevels(drawing, [0, 1])[1])).toBe('level:fib-l1');
  });

  it('keeps a deterministic legacy fallback when a drawing has no persisted level settings', () => {
    expect(resolveFibonacciLevels(baseFib, [0, 0.5, 1])).toEqual([
      { id: 'legacy-0', value: 0, enabled: true },
      { id: 'legacy-1', value: 0.5, enabled: true },
      { id: 'legacy-2', value: 1, enabled: true },
    ]);
  });

  it('resolves reverse, price visibility, label placement and coefficient format structurally', () => {
    const drawing = {
      ...baseFib,
      toolSettings: {
        reverse: true,
        showPrices: false,
        coefficientFormat: 'percent',
        horizontalLabelPosition: 'right',
        verticalLabelPosition: 'top',
      },
    } as unknown as ChartDrawing;
    expect(resolveFibonacciOptions(drawing)).toEqual({
      reverse: true,
      showPrices: false,
      logScaleLevels: false,
      coefficientFormat: 'percent',
      horizontalLabelPosition: 'right',
      verticalLabelPosition: 'top',
    });
  });

  it('formats coefficient labels without forcing percentages', () => {
    expect(formatFibonacciCoefficient(0.618, 'coefficient')).toBe('0.618');
    expect(formatFibonacciCoefficient(1, 'coefficient')).toBe('1');
    expect(formatFibonacciCoefficient(0.618, 'percent')).toBe('61.8%');
  });
});

import { describe, expect, it } from 'vitest';
import {
  DNN_TREND_FEATURE_NAMES,
  DNN_TREND_FEATURE_VERSION,
  buildDnnTrendFeatureWindow,
} from '@/plugins/forecast/dnnTrend/featureBuilder';
import type { DnnTrendBar } from '@/plugins/forecast/dnnTrend/types';

function createBars(count: number): DnnTrendBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    return {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000 + index * 10,
    };
  });
}

describe('buildDnnTrendFeatureWindow', () => {
  it('builds a deterministic causal feature window from completed daily bars', () => {
    const bars = createBars(20);
    const original = structuredClone(bars);

    const result = buildDnnTrendFeatureWindow(bars, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.window.asOfDate).toBe('2026-01-20');
    expect(result.window.featureVersion).toBe(DNN_TREND_FEATURE_VERSION);
    expect(result.window.featureNames).toEqual(DNN_TREND_FEATURE_NAMES);
    expect(result.window.values).toHaveLength(20);
    expect(result.window.values.every((row) => row.length === DNN_TREND_FEATURE_NAMES.length)).toBe(true);
    expect(result.window.values.flat().every(Number.isFinite)).toBe(true);
    expect(bars).toEqual(original);
  });

  it('fails closed when completed history is insufficient', () => {
    const result = buildDnnTrendFeatureWindow(createBars(19), 20);

    expect(result).toEqual({
      ok: false,
      reason: 'At least 20 completed daily bars are required; received 19.',
    });
  });

  it('rejects duplicate or non-chronological bars instead of silently reordering them', () => {
    const bars = createBars(20);
    bars[10] = { ...bars[10]!, date: bars[9]!.date };

    const result = buildDnnTrendFeatureWindow(bars, 20);

    expect(result).toEqual({
      ok: false,
      reason: 'Bars must be unique and strictly chronological from oldest to newest.',
    });
  });

  it('rejects impossible OHLC geometry', () => {
    const bars = createBars(20);
    bars[5] = { ...bars[5]!, high: bars[5]!.close - 1 };

    const result = buildDnnTrendFeatureWindow(bars, 20);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('inconsistent OHLC geometry');
  });
});

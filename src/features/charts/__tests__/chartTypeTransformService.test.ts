import { describe, expect, it } from 'vitest';
import {
  buildChartDisplayBars,
  DEFAULT_RENKO_SETTINGS,
  MAX_RENKO_BRICKS,
  normalizeChartType,
  normalizeRenkoSettings,
  RENKO_BRICK_LIMIT_MESSAGE,
} from '@/features/charts/chartTypeTransformService';
import type { ChartType, OHLCBar } from '@/engine/types';

function createBar(date: string, close: number): OHLCBar {
  return {
    date,
    timestamp: Date.parse(`${date}T00:00:00Z`),
    open: close,
    high: close,
    low: close,
    close,
    prevClose: close,
    volume: 1000,
  };
}

describe('chartTypeTransformService renko guards', () => {
  it('throws when a renko brick size would generate too many bricks', () => {
    const bars: OHLCBar[] = [
      createBar('2026-01-01', 100),
      createBar('2026-01-02', 38000),
    ];

    expect(() => buildChartDisplayBars(bars, 'D', 'renko', 0.05)).toThrowError(
      RENKO_BRICK_LIMIT_MESSAGE,
    );
  });

  it('allows practical low-point Traditional Renko histories', () => {
    const bars = Array.from({ length: 320 }, (_, index) =>
      createBar(`2026-01-${String((index % 28) + 1).padStart(2, '0')}`, 57000 + index * 250),
    );

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 2,
    });

    expect(result.length).toBeGreaterThan(30000);
    expect(result.length).toBeLessThan(MAX_RENKO_BRICKS);
    expect(result[0].renkoBoxSize).toBe(2);
  });

  it('still generates renko bars for safe brick sizes', () => {
    const bars: OHLCBar[] = [
      createBar('2026-01-01', 100),
      createBar('2026-01-02', 140),
      createBar('2026-01-03', 90),
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(MAX_RENKO_BRICKS);
  });

  it('supports percent Renko sizing', () => {
    const bars: OHLCBar[] = [
      createBar('2026-01-01', 100),
      createBar('2026-01-02', 105),
      createBar('2026-01-03', 98),
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'percent',
      percent: 2,
    });

    expect(result).toHaveLength(4);
    expect(result[0].renkoBoxSize).toBe(2);
    expect(result[0].renkoSourceTimestamp).toBe(Date.parse('2026-01-02T00:00:00Z'));
    expect(result[0].renkoBrickOrdinal).toBe(1);
    expect(result[1].renkoBrickOrdinal).toBe(2);
    expect(result[2].open).toBe(102);
    expect(result[2].close).toBe(100);
    expect(result[3].close).toBe(98);
  });

  it('requires a two-box move before reversing Renko direction', () => {
    const bars: OHLCBar[] = [
      createBar('2026-01-01', 100),
      createBar('2026-01-02', 110),
      createBar('2026-01-03', 101),
      createBar('2026-01-04', 90),
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ renkoDirection: 'up', open: 100, close: 110 });
    expect(result[1]).toMatchObject({ renkoDirection: 'down', open: 100, close: 90 });
  });

  it('supports high-low source, wicks, and incomplete bricks', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 101, low: 99 },
      { ...createBar('2026-01-02', 101), high: 102, low: 100 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 2,
      priceSource: 'high_low',
      showWicks: true,
      includeIncompleteBrick: true,
    });

    expect(result).toHaveLength(2);
    expect(result[0].renkoDirection).toBe('up');
    expect(result[0].high).toBe(102);
    expect(result[0].low).toBe(100);
    expect(result[0].renkoComplete).toBe(true);
    expect(result[1].close).toBe(101);
    expect(result[1].renkoComplete).toBe(false);
  });

  it('draws one-sided Renko wicks by brick direction', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 100, low: 100 },
      { ...createBar('2026-01-02', 110), high: 110, low: 94 },
      { ...createBar('2026-01-03', 90), high: 116, low: 90 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 10,
      showWicks: true,
      wickMode: 'source_range',
    });

    expect(result[0]).toMatchObject({
      renkoDirection: 'up',
      open: 100,
      close: 110,
      high: 110,
      low: 94,
    });
    expect(result[1]).toMatchObject({
      renkoDirection: 'down',
      open: 100,
      close: 90,
      high: 116,
      low: 90,
    });
  });

  it('defaults to reversal-attempt wicks and suppresses ordinary continuation source range', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 100, low: 100 },
      { ...createBar('2026-01-02', 110), high: 110, low: 100 },
      { ...createBar('2026-01-03', 120), high: 120, low: 101 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 10,
      showWicks: true,
    });

    expect(DEFAULT_RENKO_SETTINGS.wickMode).toBe('reversal_attempt');
    expect(result[1]).toMatchObject({
      renkoDirection: 'up',
      open: 110,
      close: 120,
      high: 120,
      low: 110,
    });
  });

  it('draws reversal-attempt Renko wicks after a failed opposite move', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 100, low: 100 },
      { ...createBar('2026-01-02', 110), high: 110, low: 100 },
      { ...createBar('2026-01-03', 120), high: 120, low: 100 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 10,
      showWicks: true,
    });

    expect(result[1]).toMatchObject({
      renkoDirection: 'up',
      open: 110,
      close: 120,
      high: 120,
      low: 100,
    });
  });

  it('does not draw reversal-gap prices as Renko wicks', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 100, low: 100 },
      { ...createBar('2026-01-02', 110), high: 110, low: 100 },
      { ...createBar('2026-01-03', 90), high: 105, low: 90 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'traditional',
      boxSize: 10,
      showWicks: true,
      wickMode: 'source_range',
    });

    expect(result[1]).toMatchObject({
      renkoDirection: 'down',
      open: 100,
      close: 90,
      high: 100,
      low: 90,
    });
  });

  it('does not duplicate one source wick across every percent Renko brick from a weekly move', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-05', 100), high: 100, low: 100 },
      { ...createBar('2026-01-12', 130), high: 130, low: 92 },
    ];

    const result = buildChartDisplayBars(bars, 'W', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'percent',
      percent: 5,
      showWicks: true,
      wickMode: 'source_range',
    });

    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({ renkoDirection: 'up', open: 100, close: 105, low: 92 });
    expect(result[1]).toMatchObject({ renkoDirection: 'up', open: 105, close: 110, low: 105 });
    expect(result[5]).toMatchObject({ renkoDirection: 'up', open: 125, close: 130, low: 125 });
  });

  it('resolves ATR Renko size from latest ATR value', () => {
    const bars: OHLCBar[] = [
      { ...createBar('2026-01-01', 100), high: 101, low: 99 },
      { ...createBar('2026-01-02', 101), high: 102, low: 100 },
      { ...createBar('2026-01-03', 102), high: 103, low: 101 },
    ];

    const result = buildChartDisplayBars(bars, 'D', 'renko', 10, {
      ...DEFAULT_RENKO_SETTINGS,
      boxSizeMode: 'atr',
      atrPeriod: 3,
    });

    expect(result).toHaveLength(1);
    expect(result[0].renkoBoxSize).toBe(2);
    expect(result[0].close).toBe(102);
  });

  it('preserves legacy persisted brick sizes as traditional Renko settings', () => {
    expect(normalizeRenkoSettings(undefined, 5)).toMatchObject({
      boxSizeMode: 'traditional',
      boxSize: 5,
      wickMode: 'reversal_attempt',
    });
  });

});

describe('normalizeChartType', () => {
  it('preserves every selectable chart type', () => {
    const selectableTypes: ChartType[] = [
      'candles',
      'line',
      'area',
      'bar',
      'baseline',
      'hlcArea',
      'heikinAshi',
      'renko',
    ];

    selectableTypes.forEach((type) => {
      expect(normalizeChartType(type)).toBe(type);
    });
  });

  it('falls back to candles for unknown persisted values', () => {
    expect(normalizeChartType('unknown')).toBe('candles');
    expect(normalizeChartType(null)).toBe('candles');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveMagnetPrice } from '@/engine/ChartEngine';
import type { OHLCBar } from '@/engine/types';

const bar: OHLCBar = {
  date: '2026-07-13',
  timestamp: Date.parse('2026-07-13T00:00:00Z'),
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  prevClose: 99,
  volume: 1000,
};

describe('resolveMagnetPrice', () => {
  it('leaves TEXT placement free even when magnet is enabled', () => {
    expect(resolveMagnetPrice(true, 'text', 'price', bar, 101)).toBe(101);
  });

  it('continues snapping existing and D1 price drawing tools to the nearest candle extreme', () => {
    expect(resolveMagnetPrice(true, 'trendline', 'price', bar, 101)).toBe(110);
    expect(resolveMagnetPrice(true, 'extendedLine', 'price', bar, 101)).toBe(110);
    expect(resolveMagnetPrice(true, 'horizontalRay', 'price', bar, 101)).toBe(110);
    expect(resolveMagnetPrice(true, 'crossLine', 'price', bar, 91)).toBe(90);
    expect(resolveMagnetPrice(true, 'priceRange', 'price', bar, 91)).toBe(90);
  });

  it('continues snapping D2 price drawings and markers to the nearest candle extreme', () => {
    expect(resolveMagnetPrice(true, 'regressionTrend', 'price', bar, 101)).toBe(110);
    expect(resolveMagnetPrice(true, 'circle', 'price', bar, 91)).toBe(90);
    expect(resolveMagnetPrice(true, 'arrowUp', 'price', bar, 91)).toBe(90);
  });

  it('does not magnet-snap D1 or D2 drawings inside indicator panes', () => {
    expect(resolveMagnetPrice(true, 'infoLine', 'indicator:test', bar, 101)).toBe(101);
    expect(resolveMagnetPrice(true, 'ellipse', 'indicator:test', bar, 101)).toBe(101);
  });
});

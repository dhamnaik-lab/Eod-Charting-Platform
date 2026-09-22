import { describe, expect, it } from 'vitest';
import { buildF1BRetracementLevels } from '../DrawingF1BGeometry';

const tvLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618]
  .map((value, index) => ({ id: `tv-${index}`, value, enabled: true }));

describe('F1B.4 TradingView/video Retracement orientation', () => {
  it('low-to-high draw places 0 at the high and retraces/extensions downward', () => {
    const geometry = buildF1BRetracementLevels(661.5, 775, 10, 30, 200, tvLevels);
    const prices = new Map(geometry.map((entry) => [entry.level.value, entry.price]));
    expect(prices.get(0)).toBeCloseTo(775, 8);
    expect(prices.get(1)).toBeCloseTo(661.5, 8);
    expect(prices.get(1.272)).toBeCloseTo(630.628, 3);
    expect(prices.get(1.618)).toBeLessThan(prices.get(1)!);
    expect(prices.get(2.618)).toBeLessThan(prices.get(2)!);
  });

  it('high-to-low draw places 0 at the low and retraces/extensions upward', () => {
    const geometry = buildF1BRetracementLevels(775, 661.5, 10, 30, 200, tvLevels);
    const prices = new Map(geometry.map((entry) => [entry.level.value, entry.price]));
    expect(prices.get(0)).toBeCloseTo(661.5, 8);
    expect(prices.get(1)).toBeCloseTo(775, 8);
    expect(prices.get(1.272)).toBeGreaterThan(prices.get(1)!);
    expect(prices.get(2.618)).toBeGreaterThan(prices.get(2)!);
  });

  it('Reverse flips 0/1 price orientation without changing the A-B x span', () => {
    const normal = buildF1BRetracementLevels(661.5, 775, 20, 80, 200, tvLevels, false, false, false);
    const reverse = buildF1BRetracementLevels(661.5, 775, 20, 80, 200, tvLevels, false, false, true);
    expect(normal.find((entry) => entry.level.value === 0)?.price).toBeCloseTo(775, 8);
    expect(reverse.find((entry) => entry.level.value === 0)?.price).toBeCloseTo(661.5, 8);
    expect(normal.map((entry) => [entry.segment.start.x, entry.segment.end.x])).toEqual(
      reverse.map((entry) => [entry.segment.start.x, entry.segment.end.x]),
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildF1BFibChannelLevels,
  buildF1BFibTimeZoneLevels,
  buildF1BRetracementLevels,
  buildF1BTrendFibExtensionLevels,
  buildF1BTrendFibTimeLevels,
} from '../DrawingF1BGeometry';

const levels = [0, 0.5, 1].map((value, index) => ({ id: `l${index}`, value, enabled: true }));

describe('F1B canonical linear/time Fibonacci geometry', () => {
  it('maps Retracement 0 to Point 2 and 1 to Point 1 by default', () => {
    const geometry = buildF1BRetracementLevels(100, 200, 10, 30, 100, levels);
    expect(geometry.map((entry) => entry.price)).toEqual([200, 150, 100]);
  });

  it('projects Trend-Based Fib Extension prices from Point C', () => {
    const geometry = buildF1BTrendFibExtensionLevels(
      [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }],
      [100, 140, 120],
      200,
      levels,
    );
    expect(geometry.map((entry) => entry.price)).toEqual([120, 140, 160]);
    expect(geometry.every((entry) => entry.segment.start.x === 40)).toBe(true);
  });

  it('reflects Trend-Based Fib Extension vertically around Point C in Reverse mode', () => {
    const geometry = buildF1BTrendFibExtensionLevels(
      [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }],
      [100, 140, 120],
      200,
      levels,
      false,
      false,
      true,
    );
    expect(geometry.map((entry) => entry.price)).toEqual([120, 100, 80]);
  });

  it('builds Fib Channel by translating AB with the A-to-C vector', () => {
    const geometry = buildF1BFibChannelLevels(
      [{ x: 10, y: 20 }, { x: 40, y: 30 }, { x: 25, y: 50 }],
      200,
      levels,
    );
    expect(geometry[0].segment.start).toEqual({ x: 10, y: 20 });
    expect(geometry[2].segment.start).toEqual({ x: 25, y: 50 });
    expect(geometry[2].segment.end).toEqual({ x: 55, y: 60 });
  });

  it('places Fib Time Zone 0 at A and 1 at B', () => {
    const geometry = buildF1BFibTimeZoneLevels(20, 32, levels);
    expect(geometry.map((entry) => entry.index)).toEqual([20, 26, 32]);
  });

  it('places Trend-Based Fib Time 0 at C and uses the A-to-B span', () => {
    const geometry = buildF1BTrendFibTimeLevels(
      [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 50, y: 0 }],
      levels,
    );
    expect(geometry.map((entry) => entry.x)).toEqual([50, 60, 70]);
  });

  it('calculates logarithmic Fib Retracement levels when logScaleLevels is true', () => {
    const geometry = buildF1BRetracementLevels(
      100,
      1000,
      10,
      30,
      100,
      [0, 0.5, 1].map((value, index) => ({ id: `l${index}`, value, enabled: true })),
      false,
      true,
      false,
      true,
    );
    expect(geometry[1].price).toBeCloseTo(316.227766, 4);
  });
});

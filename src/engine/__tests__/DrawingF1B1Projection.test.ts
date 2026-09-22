import { describe, expect, it } from 'vitest';
import { buildF1BRetracementLevels } from '../DrawingF1BGeometry';

const levels = [0, 0.5, 1].map((value, index) => ({ id: `p${index}`, value, enabled: true }));

describe('F1B.5 Fibonacci Retracement Trend-Fib plotting-style parity contracts', () => {
  it('extends the A-to-B base span to the right by default, matching the working Trend-Based Fib plotting style', () => {
    const geometry = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels);
    expect(geometry.every((entry) => entry.segment.start.x === 20)).toBe(true);
    expect(geometry.every((entry) => entry.segment.end.x === 200)).toBe(true);
  });

  it('keeps the same right-side plotting style even when the two anchors were placed right-to-left', () => {
    const geometry = buildF1BRetracementLevels(100, 200, 160, 80, 200, levels);
    expect(geometry.every((entry) => entry.segment.start.x === 80)).toBe(true);
    expect(geometry.every((entry) => entry.segment.end.x === 200)).toBe(true);
  });

  it('preserves explicit extension choices, including finite span when Extend Right is disabled', () => {
    const finite = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, false, false);
    expect(finite.every((entry) => entry.segment.start.x === 20 && entry.segment.end.x === 60)).toBe(true);

    const left = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, true, false);
    expect(left.every((entry) => entry.segment.start.x === 0 && entry.segment.end.x === 60)).toBe(true);

    const right = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, false, true);
    expect(right.every((entry) => entry.segment.start.x === 20 && entry.segment.end.x === 200)).toBe(true);

    const both = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, true, true);
    expect(both.every((entry) => entry.segment.start.x === 0 && entry.segment.end.x === 200)).toBe(true);
  });

  it('puts level 0 at Point 2 and level 1 at Point 1, with Reverse swapping them', () => {
    const normal = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, false, false, false);
    const reversed = buildF1BRetracementLevels(100, 200, 20, 60, 200, levels, false, false, true);
    expect(normal.map((entry) => entry.price)).toEqual([200, 150, 100]);
    expect(reversed.map((entry) => entry.price)).toEqual([100, 150, 200]);
    expect(normal.map((entry) => [entry.segment.start.x, entry.segment.end.x])).toEqual(
      reversed.map((entry) => [entry.segment.start.x, entry.segment.end.x]),
    );
  });
});

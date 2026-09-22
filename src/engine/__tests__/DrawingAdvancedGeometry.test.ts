import { describe, expect, it } from 'vitest';
import {
  buildFibTimeZoneIndexes,
  calculateRegressionChannel,
  distanceToEllipseBoundary,
  pointInTriangle,
} from '../DrawingAdvancedGeometry';
import type { OHLCBar } from '../types';

function barsFromCloses(closes: number[]): OHLCBar[] {
  return closes.map((close, index) => ({
    timestamp: Date.UTC(2026, 0, index + 1),
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe('DrawingAdvancedGeometry', () => {
  it('calculates an exact regression line for linear closes', () => {
    const result = calculateRegressionChannel(barsFromCloses([10, 12, 14, 16, 18]), 0, 4, 2);
    expect(result).not.toBeNull();
    expect(result?.slopePerBar).toBeCloseTo(2, 10);
    expect(result?.centerStart).toBeCloseTo(10, 10);
    expect(result?.centerEnd).toBeCloseTo(18, 10);
    expect(result?.residualStdDev).toBeCloseTo(0, 10);
  });

  it('uses close residual deviation to build symmetric regression bands', () => {
    const result = calculateRegressionChannel(barsFromCloses([10, 13, 13, 17, 17]), 0, 4, 2);
    expect(result).not.toBeNull();
    expect((result?.upperStart ?? 0) - (result?.centerStart ?? 0)).toBeCloseTo(
      (result?.centerStart ?? 0) - (result?.lowerStart ?? 0),
      10,
    );
  });

  it('projects Fibonacci time zones in the anchor direction', () => {
    expect(buildFibTimeZoneIndexes(10, 15, [0, 1, 2, 3, 5])).toEqual([10, 15, 20, 25, 35]);
    expect(buildFibTimeZoneIndexes(15, 10, [0, 1, 2])).toEqual([15, 10, 5]);
  });

  it('detects triangle inclusion for arrow markers', () => {
    expect(pointInTriangle({ x: 5, y: 3 }, { x: 5, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(pointInTriangle({ x: 12, y: 3 }, { x: 5, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 })).toBe(false);
  });

  it('measures distance to ellipse boundary', () => {
    expect(distanceToEllipseBoundary({ x: 10, y: 0 }, { x: 0, y: 0 }, 10, 5)).toBeCloseTo(0, 10);
    expect(distanceToEllipseBoundary({ x: 0, y: 5 }, { x: 0, y: 0 }, 10, 5)).toBeCloseTo(0, 10);
  });
});

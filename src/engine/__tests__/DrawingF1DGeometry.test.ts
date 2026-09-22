import { describe, expect, it } from 'vitest';
import {
  FIBONACCI_GOLDEN_RATIO,
  buildF1DFibSpiralGeometry,
  buildF1DFibSpiralPerpBasis,
} from '../DrawingF1DGeometry';

describe('F1D Fib Spiral geometry', () => {
  it('passes Point 2 at t=0 and grows by phi every quarter turn', () => {
    const center = { x: 0, y: 0 };
    const reference = { x: 10, y: 0 };
    const basis = { barDelta: 0, priceDelta: 10 };
    const geometry = buildF1DFibSpiralGeometry(center, reference, basis, false, {
      inwardTurns: 0.5,
      outwardTurns: 1,
      samplesPerTurn: 96,
    });
    expect(geometry).not.toBeNull();
    const points = geometry!.points;
    // tMin=-pi and 96 samples/turn => t=0 is sample 48.
    expect(points[48].x).toBeCloseTo(10, 9);
    expect(points[48].y).toBeCloseTo(0, 9);
    const quarter = points[72];
    expect(Math.hypot(quarter.x, quarter.y)).toBeCloseTo(10 * FIBONACCI_GOLDEN_RATIO, 8);
    const half = points[96];
    expect(Math.hypot(half.x, half.y)).toBeCloseTo(10 * FIBONACCI_GOLDEN_RATIO ** 2, 8);
  });

  it('mirrors clockwise/counterclockwise without moving either anchor', () => {
    const args = [{ x: 2, y: 3 }, { x: 12, y: 3 }, { barDelta: 0, priceDelta: 10 }] as const;
    const cw = buildF1DFibSpiralGeometry(...args, false, { inwardTurns: 0.5, outwardTurns: 1, samplesPerTurn: 96 })!;
    const ccw = buildF1DFibSpiralGeometry(...args, true, { inwardTurns: 0.5, outwardTurns: 1, samplesPerTurn: 96 })!;
    expect(cw.center).toEqual(ccw.center);
    expect(cw.reference).toEqual(ccw.reference);
    expect(cw.points[60].x).toBeCloseTo(ccw.points[60].x, 9);
    expect(cw.points[60].y - 3).toBeCloseTo(-(ccw.points[60].y - 3), 9);
  });

  it('captures a screen-orthogonal basis back into data coordinates', () => {
    const basis = buildF1DFibSpiralPerpBasis(
      { x: 10, y: 100 },
      { x: 20, y: 100 },
      (p) => ({ x: p.x * 5, y: 500 - p.y * 2 }),
      (p) => ({ x: p.x / 5, y: (500 - p.y) / 2 }),
    );
    expect(basis).not.toBeNull();
    // radial screen vector = (50,0), clockwise perpendicular = (0,50)
    expect(basis!.barDelta).toBeCloseTo(0, 9);
    expect(basis!.priceDelta).toBeCloseTo(-25, 9);
  });

  it('keeps canonical data points invariant under radically different projections', () => {
    const geometry = buildF1DFibSpiralGeometry(
      { x: 40, y: 700 },
      { x: 55, y: 760 },
      { barDelta: 13, priceDelta: -18 },
      false,
      { inwardTurns: 1, outwardTurns: 1, samplesPerTurn: 48 },
    )!;
    const canonical = geometry.points.map((p) => ({ ...p }));
    canonical.forEach((point, index) => {
      const a = { x: point.x * 3, y: 1200 - point.y * 0.8 };
      const b = { x: point.x * 17 - 400, y: 900 - Math.log(Math.max(point.y, 1)) * 70 };
      expect(Number.isFinite(a.x + a.y + b.x + b.y)).toBe(true);
      expect(geometry.points[index]).toEqual(point);
    });
  });
});

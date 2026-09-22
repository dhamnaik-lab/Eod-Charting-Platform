import { describe, expect, it } from 'vitest';
import { FIB_CIRCLES_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import {
  buildF1CFibCirclesGeometry,
  snapFibCirclePointTo45Degrees,
} from '../DrawingF1CGeometry';
import type { RuntimeFibonacciLevel } from '../DrawingF1BRuntime';

const levels: RuntimeFibonacciLevel[] = FIB_CIRCLES_DEFAULT_VALUES.map((value, index) => ({
  id: `circle-${index}`,
  value,
  enabled: true,
}));

describe('F1C.1 Fib Circles canonical geometry', () => {
  it('uses the anchor midpoint as the common center and half-deltas as level-1 radii', () => {
    const geometry = buildF1CFibCirclesGeometry(
      { x: 100, y: 300 },
      { x: 300, y: 100 },
      levels,
    );
    expect(geometry).not.toBeNull();
    expect(geometry?.center).toEqual({ x: 200, y: 200 });
    expect(geometry?.baseRadiusX).toBe(100);
    expect(geometry?.baseRadiusY).toBe(100);
    const levelOne = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(levelOne?.radiusX).toBe(100);
    expect(levelOne?.radiusY).toBe(100);
  });

  it('produces ellipses for non-45-degree anchors and perfect circles for 45-degree anchors', () => {
    const ellipse = buildF1CFibCirclesGeometry(
      { x: 20, y: 80 },
      { x: 220, y: 180 },
      levels,
    );
    expect(ellipse?.baseRadiusX).toBe(100);
    expect(ellipse?.baseRadiusY).toBe(50);

    const circle = buildF1CFibCirclesGeometry(
      { x: 20, y: 180 },
      { x: 220, y: -20 },
      levels,
    );
    expect(circle?.baseRadiusX).toBe(circle?.baseRadiusY);
  });

  it('renders the complete audited 11-level default family and respects disabled rows', () => {
    const geometry = buildF1CFibCirclesGeometry(
      { x: 0, y: 0 },
      { x: 200, y: 200 },
      levels.map((level) => level.value === 2.618 ? { ...level, enabled: false } : level),
    );
    expect(FIB_CIRCLES_DEFAULT_VALUES).toHaveLength(11);
    expect(geometry?.levels).toHaveLength(10);
    expect(geometry?.levels.some((entry) => entry.level.value === 4.618)).toBe(true);
    expect(geometry?.levels.some((entry) => entry.level.value === 2.618)).toBe(false);
  });

  it('places labels at each ellipse bottom-center', () => {
    const geometry = buildF1CFibCirclesGeometry(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      levels,
    );
    const levelOne = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(levelOne?.center).toEqual({ x: 200, y: 150 });
    expect(levelOne?.labelAnchor).toEqual({ x: 200, y: 200 });
  });

  it('projects Shift construction onto a 45-degree diagonal', () => {
    const snapped = snapFibCirclePointTo45Degrees(
      { x: 100, y: 100 },
      { x: 260, y: 180 },
    );
    expect(Math.abs(snapped.x - 100)).toBeCloseTo(Math.abs(snapped.y - 100));
    expect(snapped.x).toBeGreaterThan(100);
    expect(snapped.y).toBeGreaterThan(100);
  });
});

import { describe, expect, it } from 'vitest';
import { FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import { buildF1CFibArcsGeometry, isPointInsideF1CFibArcSweep } from '../DrawingF1CGeometry';

const levels = FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES.map((value, index) => ({
  id: `speed-arcs-${index + 1}`,
  value,
  enabled: true,
}));

describe('F1C.2 Fib Speed Resistance Arcs geometry', () => {
  it('uses Point 1 as center and the Point1-Point2 pixel distance as level-1 radius', () => {
    const geometry = buildF1CFibArcsGeometry({ x: 100, y: 300 }, { x: 160, y: 220 }, levels);
    expect(geometry).not.toBeNull();
    expect(geometry?.center).toEqual({ x: 100, y: 300 });
    expect(geometry?.baseRadius).toBeCloseTo(100, 8);
    expect(geometry?.levels.find((entry) => entry.level.value === 1)?.radius).toBeCloseTo(100, 8);
  });

  it('opens an upward price move as a horizontal upper semicircle rather than rotating to the trend angle', () => {
    const geometry = buildF1CFibArcsGeometry({ x: 100, y: 300 }, { x: 180, y: 220 }, levels);
    expect(geometry?.direction).toBe('upper');
    const level1 = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(level1?.startAngle).toBeCloseTo(Math.PI, 8);
    expect(level1?.endAngle).toBeCloseTo(Math.PI * 2, 8);
    expect(level1?.labelAnchors.top.y).toBeLessThan(300);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 200 }, level1!, 0)).toBe(true);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 400 }, level1!, 0)).toBe(false);
  });

  it('opens a downward price move as a horizontal lower semicircle', () => {
    const geometry = buildF1CFibArcsGeometry({ x: 100, y: 200 }, { x: 180, y: 280 }, levels);
    expect(geometry?.direction).toBe('lower');
    const level1 = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(level1?.startAngle).toBeCloseTo(0, 8);
    expect(level1?.endAngle).toBeCloseTo(Math.PI, 8);
    expect(level1?.labelAnchors.bottom.y).toBeGreaterThan(200);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 300 }, level1!, 0)).toBe(true);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 100 }, level1!, 0)).toBe(false);
  });

  it('Full Circles enables the complete 0..2π sweep and both halves hit-test', () => {
    const geometry = buildF1CFibArcsGeometry({ x: 100, y: 300 }, { x: 160, y: 220 }, levels, true);
    const level1 = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(geometry?.fullCircles).toBe(true);
    expect(level1?.startAngle).toBe(0);
    expect(level1?.endAngle).toBeCloseTo(Math.PI * 2, 8);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 200 }, level1!, 0)).toBe(true);
    expect(isPointInsideF1CFibArcSweep({ x: 100, y: 400 }, level1!, 0)).toBe(true);
  });

  it('renders the full eleven-level F1 arc family through 4.618', () => {
    const geometry = buildF1CFibArcsGeometry({ x: 100, y: 300 }, { x: 160, y: 220 }, levels);
    expect(geometry?.levels.map((entry) => entry.level.value)).toEqual([...FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES]);
    expect(geometry?.levels).toHaveLength(11);
    expect(geometry?.levels.at(-1)?.level.value).toBe(4.618);
  });
});

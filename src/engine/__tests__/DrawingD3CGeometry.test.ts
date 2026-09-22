import { describe, expect, it } from 'vitest';
import {
  buildD3CHitSegments,
  buildPositionPixelGeometry,
  buildProjectionPixelGeometry,
  calculatePositionMetrics,
  calculateProjectionMetrics,
  normalizePositionAnchors,
  pointInPositionGeometry,
} from '../DrawingD3CGeometry';

describe('D3C position/projection geometry', () => {
  it('calculates long and short risk/reward metrics without trading side effects', () => {
    const long = calculatePositionMetrics('longPosition', [
      { price: 100 },
      { price: 110 },
      { price: 95 },
    ]);
    expect(long?.risk).toBeCloseTo(5);
    expect(long?.reward).toBeCloseTo(10);
    expect(long?.riskRewardRatio).toBeCloseTo(2);
    expect(long?.validOrientation).toBe(true);

    const short = calculatePositionMetrics('shortPosition', [
      { price: 100 },
      { price: 90 },
      { price: 105 },
    ]);
    expect(short?.riskRewardRatio).toBeCloseTo(2);
    expect(short?.validOrientation).toBe(true);
  });

  it('keeps target and stop on one shared position end-time anchor', () => {
    const normalized = normalizePositionAnchors('longPosition', [
      { barIndex: 10, price: 100 },
      { barIndex: 20, price: 110 },
      { barIndex: 30, price: 95 },
    ]);
    expect(normalized[2].barIndex).toBe(20);
    expect(normalized[2].price).toBe(95);
  });

  it('mirrors wrong-side target/stop values to preserve LONG and SHORT semantics', () => {
    const long = normalizePositionAnchors('longPosition', [
      { barIndex: 10, price: 100 },
      { barIndex: 20, price: 90 },
      { barIndex: 30, price: 112 },
    ]);
    expect(long[1].price).toBe(110);
    expect(long[2].price).toBe(88);
    expect(long[2].barIndex).toBe(20);
    expect(calculatePositionMetrics('longPosition', long)?.validOrientation).toBe(true);

    const short = normalizePositionAnchors('shortPosition', [
      { barIndex: 10, price: 100 },
      { barIndex: 20, price: 112 },
      { barIndex: 30, price: 90 },
    ]);
    expect(short[1].price).toBe(88);
    expect(short[2].price).toBe(110);
    expect(short[2].barIndex).toBe(20);
    expect(calculatePositionMetrics('shortPosition', short)?.validOrientation).toBe(true);
  });

  it('builds a coherent position block and detects its interior', () => {
    const geometry = buildPositionPixelGeometry([
      { x: 20, y: 60 },
      { x: 120, y: 30 },
      { x: 120, y: 90 },
    ]);
    expect(geometry?.entry.end.x).toBe(120);
    expect(geometry?.target.end.x).toBe(120);
    expect(geometry?.stop.end.x).toBe(120);
    expect(geometry && pointInPositionGeometry({ x: 70, y: 55 }, geometry)).toBe(true);
    expect(geometry && pointInPositionGeometry({ x: 150, y: 55 }, geometry)).toBe(false);
  });

  it('projects the complete A-B price/time vector from C', () => {
    const metrics = calculateProjectionMetrics([
      { barIndex: 2, price: 100 },
      { barIndex: 6, price: 120 },
      { barIndex: 10, price: 110 },
    ]);
    expect(metrics?.targetPrice).toBeCloseTo(130);
    expect(metrics?.barSpan).toBe(4);
    expect(metrics?.targetBarIndex).toBe(14);
    expect(metrics?.movePercent).toBeCloseTo(20);

    const geometry = buildProjectionPixelGeometry([
      { x: 20, y: 80 },
      { x: 80, y: 40 },
      { x: 100, y: 90 },
    ]);
    expect(geometry?.d).toEqual({ x: 160, y: 50 });
  });

  it('provides hit segments for both position and projection families', () => {
    expect(buildD3CHitSegments('longPosition', [
      { x: 20, y: 60 },
      { x: 120, y: 30 },
      { x: 120, y: 90 },
    ])).toHaveLength(5);
    expect(buildD3CHitSegments('projection', [
      { x: 20, y: 80 },
      { x: 80, y: 40 },
      { x: 100, y: 90 },
    ])).toHaveLength(4);
  });
});

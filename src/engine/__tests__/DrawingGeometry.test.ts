import { describe, expect, it } from 'vitest';
import {
  calculateDrawingRangeMetrics,
  calculatePercentChange,
  calculatePriceRangePercent,
  calculateSlopePerBar,
  calculateVisualAngleDegrees,
  chooseRangeLabelY,
  extendInfiniteLineToRect,
  extendSegmentHorizontally,
  isHorizontalRayHit,
} from '../DrawingGeometry';
import type { OHLCBar } from '../types';

const bars: OHLCBar[] = [
  { date: '2026-08-01', timestamp: Date.UTC(2026, 7, 1), open: 100, high: 105, low: 95, close: 102, volume: 1 },
  { date: '2026-08-04', timestamp: Date.UTC(2026, 7, 4), open: 102, high: 108, low: 101, close: 107, volume: 1 },
  { date: '2026-08-05', timestamp: Date.UTC(2026, 7, 5), open: 107, high: 112, low: 106, close: 110, volume: 1 },
];

describe('DrawingGeometry', () => {
  it('extends diagonal, vertical and horizontal infinite lines to pane boundaries', () => {
    expect(extendInfiniteLineToRect({ x: 20, y: 20 }, { x: 80, y: 80 }, 100, 100)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    });
    expect(extendInfiniteLineToRect({ x: 40, y: 20 }, { x: 40, y: 80 }, 100, 100)).toEqual({
      start: { x: 40, y: 0 },
      end: { x: 40, y: 100 },
    });
    expect(extendInfiniteLineToRect({ x: 20, y: 40 }, { x: 80, y: 40 }, 100, 100)).toEqual({
      start: { x: 0, y: 40 },
      end: { x: 100, y: 40 },
    });
  });

  it('extends a finite segment left/right without changing its slope or original anchor semantics', () => {
    expect(extendSegmentHorizontally({ x: 20, y: 20 }, { x: 80, y: 80 }, 100, true, false)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 80, y: 80 },
    });
    expect(extendSegmentHorizontally({ x: 20, y: 20 }, { x: 80, y: 80 }, 100, false, true)).toEqual({
      start: { x: 20, y: 20 },
      end: { x: 100, y: 100 },
    });
    expect(extendSegmentHorizontally({ x: 80, y: 80 }, { x: 20, y: 20 }, 100, true, true)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    });
  });

  it('returns null for a degenerate infinite line', () => {
    expect(extendInfiniteLineToRect({ x: 20, y: 20 }, { x: 20, y: 20 }, 100, 100)).toBeNull();
  });

  it('keeps horizontal-ray hit testing directional', () => {
    const anchor = { x: 50, y: 30 };
    expect(isHorizontalRayHit({ x: 80, y: 32 }, anchor, 5, 'right')).toBe(true);
    expect(isHorizontalRayHit({ x: 20, y: 32 }, anchor, 5, 'right')).toBe(false);
    expect(isHorizontalRayHit({ x: 20, y: 32 }, anchor, 5, 'left')).toBe(true);
  });

  it('calculates price, percentage, slope and visual angle without zero-division leakage', () => {
    expect(calculatePercentChange(100, 110)).toBeCloseTo(10);
    expect(calculatePercentChange(0, 110)).toBeNull();
    expect(calculatePriceRangePercent(80, 100)).toBeCloseTo(25);
    expect(calculatePriceRangePercent(0, 100)).toBeNull();
    expect(calculateSlopePerBar(10, 100, 15, 110)).toBeCloseTo(2);
    expect(calculateSlopePerBar(10, 100, 10, 110)).toBeNull();
    expect(calculateVisualAngleDegrees({ x: 0, y: 10 }, { x: 10, y: 0 })).toBeCloseTo(45);
  });


  it('prefers free space below candles for range labels and falls back away from the title strip', () => {
    expect(chooseRangeLabelY(90, 220, 400)).toBeGreaterThan(220);
    expect(chooseRangeLabelY(100, 385, 400)).toBeLessThan(100);
    expect(chooseRangeLabelY(50, 392, 400)).toBeGreaterThan(300);
  });

  it('uses actual bar timestamps for exact date-range metrics instead of assuming one bar per day', () => {
    const metrics = calculateDrawingRangeMetrics(0, 100, 2, 110, bars);
    expect(metrics.barSpan).toBe(2);
    expect(metrics.calendarDays).toBe(4);
    expect(metrics.startDate).toBe('2026-08-01');
    expect(metrics.endDate).toBe('2026-08-05');
    expect(metrics.priceChange).toBe(10);
    expect(metrics.percentChange).toBeCloseTo(10);
  });
});

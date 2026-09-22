import { describe, expect, it } from 'vitest';
import {
  buildF1EFibSpeedResistanceFanGeometry,
  extendProjectedRayBeyondPane,
  hitTestF1EFibSpeedResistanceFan,
} from '../DrawingF1EGeometry';
import { createDefaultFibonacciSettings, FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';
import type { FibonacciSpeedResistanceFanSettings } from '../DrawingFibonacciContracts';

describe('DrawingF1EGeometry — Fib Speed Resistance Fan', () => {
  const mockScaleX = { toPixel: (x: number) => x * 10 };
  const mockScaleY = { toPixel: (y: number) => 500 - y * 2 };
  const width = 1000;
  const height = 600;

  it('provides the default TradingView-fidelity levels in createDefaultFibonacciSettings', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    expect(settings.kind).toBe('fibFan');
    expect(settings.priceLevels.map((l) => l.value)).toEqual(FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES);
    expect(settings.timeLevels.map((l) => l.value)).toEqual(FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES);
    expect(settings.showBackground).toBe(true);
    expect(settings.showGrid).toBe(true);
    expect(settings.reverse).toBe(false);
  });

  it('builds canonical geometry for upward anchor pair', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    const geometry = buildF1EFibSpeedResistanceFanGeometry(
      10, 100, // Point 1 (Apex)
      60, 200, // Point 2 (Handle)
      settings,
      mockScaleX,
      mockScaleY,
      width,
      height,
    );

    expect(geometry.apex).toEqual({ x: 100, y: 300 });
    expect(geometry.handle).toEqual({ x: 600, y: 100 });
    expect(geometry.trendSegment.start).toEqual(geometry.apex);
    expect(geometry.trendSegment.end).toEqual(geometry.handle);

    // 7 price rays and 7 time rays by default
    expect(geometry.priceRays.length).toBe(7);
    expect(geometry.timeRays.length).toBe(7);

    // All rays originate from Apex
    geometry.priceRays.forEach((ray) => {
      expect(ray.segment.start).toEqual(geometry.apex);
    });
    geometry.timeRays.forEach((ray) => {
      expect(ray.segment.start).toEqual(geometry.apex);
    });

    // Verify Level 1 price ray passes through Point 2 (Handle)
    const level1PriceRay = geometry.priceRays.find((r) => r.coefficient === 1);
    expect(level1PriceRay?.targetPoint.x).toBe(geometry.handle.x);
    expect(level1PriceRay?.targetPoint.y).toBe(geometry.handle.y);

    // Verify Level 1 time ray passes through Point 2 (Handle)
    const level1TimeRay = geometry.timeRays.find((r) => r.coefficient === 1);
    expect(level1TimeRay?.targetPoint.x).toBe(geometry.handle.x);
    expect(level1TimeRay?.targetPoint.y).toBe(geometry.handle.y);
  });

  it('builds canonical geometry for downward anchor pair', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    const geometry = buildF1EFibSpeedResistanceFanGeometry(
      10, 200, // Point 1 (Apex High)
      60, 100, // Point 2 (Handle Low)
      settings,
      mockScaleX,
      mockScaleY,
      width,
      height,
    );

    expect(geometry.apex).toEqual({ x: 100, y: 100 });
    expect(geometry.handle).toEqual({ x: 600, y: 300 });
    expect(geometry.priceRays.length).toBe(7);
    expect(geometry.timeRays.length).toBe(7);
  });

  it('handles reverse option correctly', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    const normalGeom = buildF1EFibSpeedResistanceFanGeometry(10, 100, 60, 200, settings, mockScaleX, mockScaleY, width, height);

    const reversedSettings = { ...settings, reverse: true };
    const reversedGeom = buildF1EFibSpeedResistanceFanGeometry(10, 100, 60, 200, reversedSettings, mockScaleX, mockScaleY, width, height);

    // Level 0 in normal mode is at start price; in reversed mode Level 0 is at end price
    const normalL0 = normalGeom.priceRays.find((r) => r.coefficient === 0);
    const reversedL0 = reversedGeom.priceRays.find((r) => r.coefficient === 0);

    expect(normalL0?.targetPrice).toBe(100);
    expect(reversedL0?.targetPrice).toBe(200);
  });

  it('respects level disabled state', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    settings.priceLevels[1].enabled = false; // Disable level 0.25

    const geometry = buildF1EFibSpeedResistanceFanGeometry(10, 100, 60, 200, settings, mockScaleX, mockScaleY, width, height);
    expect(geometry.priceRays.length).toBe(6);
    expect(geometry.priceRays.some((r) => r.coefficient === 0.25)).toBe(false);
  });

  it('keeps price-ray data intersections invariant across linear zoom/auto-scale transforms', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    const startIndex = 20;
    const startPrice = 120;
    const endIndex = 60;
    const endPrice = 200;
    const sampleIndex = 90;

    const scalePairs = [
      {
        x: { toPixel: (index: number) => 8 + (index - 10) * 12 },
        y: { toPixel: (price: number) => 640 - (price - 80) * 2.4 },
        xToIndex: (pixel: number) => (pixel - 8) / 12 + 10,
        yToPrice: (pixel: number) => 80 + (640 - pixel) / 2.4,
      },
      {
        x: { toPixel: (index: number) => 8 + (index - 35) * 5.5 },
        y: { toPixel: (price: number) => 520 - (price - 105) * 4.1 },
        xToIndex: (pixel: number) => (pixel - 8) / 5.5 + 35,
        yToPrice: (pixel: number) => 105 + (520 - pixel) / 4.1,
      },
    ];

    const expectedByLevel = new Map<number, number>();
    scalePairs.forEach(({ x, y, yToPrice }, scaleIndex) => {
      const geometry = buildF1EFibSpeedResistanceFanGeometry(
        startIndex,
        startPrice,
        endIndex,
        endPrice,
        settings,
        x,
        y,
        1000,
        700,
        { startIndex: 0, endIndex: 120 },
      );
      const sampleX = x.toPixel(sampleIndex);

      geometry.priceRays.forEach((ray) => {
        const dx = ray.segment.end.x - ray.segment.start.x;
        expect(Math.abs(dx)).toBeGreaterThan(1e-9);
        const t = (sampleX - ray.segment.start.x) / dx;
        const sampleY = ray.segment.start.y + t * (ray.segment.end.y - ray.segment.start.y);
        const priceAtSample = yToPrice(sampleY);
        if (scaleIndex === 0) {
          expectedByLevel.set(ray.coefficient, priceAtSample);
        } else {
          expect(priceAtSample).toBeCloseTo(expectedByLevel.get(ray.coefficient)!, 8);
        }
      });
    });
  });

  it('keeps every projected ray exactly collinear with its Fibonacci target on nonlinear price scales', () => {
    const start = { x: 120, y: 430 };
    const target = { x: 520, y: 170 };
    const segment = extendProjectedRayBeyondPane(start, target, 1000, 600);
    const cross =
      (target.x - segment.start.x) * (segment.end.y - segment.start.y) -
      (target.y - segment.start.y) * (segment.end.x - segment.start.x);
    expect(Math.abs(cross)).toBeLessThan(1e-8);

    const nonlinearScaleY = { toPixel: (price: number) => 600 - Math.log(price) * 80 };
    const scaleX = { toPixel: (index: number) => index * 11 };
    const geometry = buildF1EFibSpeedResistanceFanGeometry(
      10,
      100,
      50,
      240,
      createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings,
      scaleX,
      nonlinearScaleY,
      1000,
      600,
      { startIndex: 0, endIndex: 90 },
    );
    geometry.priceRays.forEach((ray) => {
      const rayCross =
        (ray.targetPoint.x - ray.segment.start.x) * (ray.segment.end.y - ray.segment.start.y) -
        (ray.targetPoint.y - ray.segment.start.y) * (ray.segment.end.x - ray.segment.start.x);
      expect(Math.abs(rayCross)).toBeLessThan(1e-7);
    });
    geometry.timeRays.forEach((ray) => {
      const rayCross =
        (ray.targetPoint.x - ray.segment.start.x) * (ray.segment.end.y - ray.segment.start.y) -
        (ray.targetPoint.y - ray.segment.start.y) * (ray.segment.end.x - ray.segment.start.x);
      expect(Math.abs(rayCross)).toBeLessThan(1e-7);
    });
  });

  it('performs hit testing with ray tolerance', () => {
    const settings = createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings;
    const geometry = buildF1EFibSpeedResistanceFanGeometry(10, 100, 60, 200, settings, mockScaleX, mockScaleY, width, height);

    // Hit test on Apex
    expect(hitTestF1EFibSpeedResistanceFan(geometry.apex, geometry, 6)).toBe(true);

    // Hit test on Handle
    expect(hitTestF1EFibSpeedResistanceFan(geometry.handle, geometry, 6)).toBe(true);

    // Hit test far away from drawing
    expect(hitTestF1EFibSpeedResistanceFan({ x: 900, y: 10 }, geometry, 6)).toBe(false);
  });
});

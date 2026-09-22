import { describe, expect, it } from 'vitest';
import {
  buildF1CFibWedgeGeometry,
  distanceToF1CFibWedgeLevel,
  projectF1CFibWedgeGeometry,
} from '../DrawingF1CGeometry';
import { FIB_WEDGE_DEFAULT_VALUES } from '../DrawingFibonacciDefaults';

const levels = FIB_WEDGE_DEFAULT_VALUES.map((value, index) => ({
  id: `w-${index}`,
  value,
  enabled: value <= 1,
}));

describe('F1C.3.2 Fib Wedge data-anchored geometry', () => {
  it('uses stored bar/price anchors as authoritative geometry points', () => {
    const anchors = [{ x: 100, y: 520 }, { x: 145, y: 780 }, { x: 170, y: 690 }];
    const geometry = buildF1CFibWedgeGeometry(anchors, levels);
    expect(geometry?.apex).toEqual(anchors[0]);
    expect(geometry?.firstHandle).toEqual(anchors[1]);
    expect(geometry?.secondHandle).toEqual(anchors[2]);
  });

  it('keeps level-1 endpoints exactly on stored Points 2 and 3', () => {
    const anchors = [{ x: 20, y: 500 }, { x: 70, y: 780 }, { x: 95, y: 690 }];
    const geometry = buildF1CFibWedgeGeometry(anchors, levels);
    const level1 = geometry?.levels.find((entry) => entry.level.value === 1);
    expect(level1?.points[0]).toEqual(anchors[1]);
    expect(level1?.points.at(-1)).toEqual(anchors[2]);
  });

  it('places each Fibonacci level at a fixed coefficient on both data-space boundaries', () => {
    const anchors = [{ x: 10, y: 520 }, { x: 90, y: 780 }, { x: 120, y: 690 }];
    const geometry = buildF1CFibWedgeGeometry(anchors, levels);
    const level = geometry?.levels.find((entry) => entry.level.value === 0.618);
    expect(level?.points[0].x).toBeCloseTo(10 + (90 - 10) * 0.618);
    expect(level?.points[0].y).toBeCloseTo(520 + (780 - 520) * 0.618);
    expect(level?.points.at(-1)?.x).toBeCloseTo(10 + (120 - 10) * 0.618);
    expect(level?.points.at(-1)?.y).toBeCloseTo(520 + (690 - 520) * 0.618);
  });

  it('projects identical canonical bar/price samples under radically different zoom mappings', () => {
    const anchors = [{ x: 40, y: 510 }, { x: 105, y: 780 }, { x: 130, y: 690 }];
    const dataGeometry = buildF1CFibWedgeGeometry(anchors, levels);
    if (!dataGeometry) throw new Error('expected data geometry');
    const dataLevel = dataGeometry.levels.find((entry) => entry.level.value === 0.618);
    if (!dataLevel) throw new Error('expected 0.618 level');

    const projectionA = (point: { x: number; y: number }) => ({
      x: 80 + point.x * 3.1,
      y: 760 - point.y * 0.62,
    });
    // Deliberately different X zoom and a non-linear Y mapping. Because the
    // canonical curve is already in data coordinates, no level can migrate.
    const projectionB = (point: { x: number; y: number }) => ({
      x: -240 + point.x * 8.7,
      y: 980 - Math.log(Math.max(point.y, 1)) * 71,
    });
    const a = projectF1CFibWedgeGeometry(dataGeometry, projectionA);
    const b = projectF1CFibWedgeGeometry(dataGeometry, projectionB);
    const aLevel = a.levels.find((entry) => entry.level.value === 0.618)!;
    const bLevel = b.levels.find((entry) => entry.level.value === 0.618)!;

    expect(aLevel.points).toHaveLength(dataLevel.points.length);
    expect(bLevel.points).toHaveLength(dataLevel.points.length);
    dataLevel.points.forEach((dataPoint, index) => {
      expect(aLevel.points[index]).toEqual(projectionA(dataPoint));
      expect(bLevel.points[index]).toEqual(projectionB(dataPoint));
    });
  });

  it('extends both trend boundaries by the outermost enabled coefficient in data space', () => {
    const extended = levels.map((level) => ({ ...level, enabled: level.value <= 1.618 }));
    const geometry = buildF1CFibWedgeGeometry(
      [{ x: 10, y: 500 }, { x: 60, y: 700 }, { x: 90, y: 620 }],
      extended,
    );
    expect(geometry?.firstBoundary.end.x).toBeCloseTo(10 + (60 - 10) * 1.618);
    expect(geometry?.firstBoundary.end.y).toBeCloseTo(500 + (700 - 500) * 1.618);
    expect(geometry?.secondBoundary.end.x).toBeCloseTo(10 + (90 - 10) * 1.618);
    expect(geometry?.secondBoundary.end.y).toBeCloseTo(500 + (620 - 500) * 1.618);
  });

  it('uses the projected canonical curve for hit testing', () => {
    const dataGeometry = buildF1CFibWedgeGeometry(
      [{ x: 10, y: 500 }, { x: 70, y: 780 }, { x: 100, y: 690 }],
      levels,
    );
    if (!dataGeometry) throw new Error('expected geometry');
    const geometry = projectF1CFibWedgeGeometry(dataGeometry, (point) => ({
      x: point.x * 5,
      y: 900 - point.y * 0.7,
    }));
    const level = geometry.levels.find((entry) => entry.level.value === 0.618);
    if (!level) throw new Error('expected level');
    const onCurve = level.points[Math.floor(level.points.length / 2)];
    expect(distanceToF1CFibWedgeLevel(onCurve, level)).toBeCloseTo(0);
    expect(distanceToF1CFibWedgeLevel({ x: onCurve.x + 30, y: onCurve.y + 30 }, level)).toBeGreaterThan(5);
  });
});

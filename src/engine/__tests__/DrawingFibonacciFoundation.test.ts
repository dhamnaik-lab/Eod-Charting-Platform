import { describe, expect, it } from 'vitest';
import {
  FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES,
  FIB_TIME_ZONE_DEFAULT_VALUES,
  FIB_WEDGE_DEFAULT_VALUES,
  createDefaultFibonacciSettings,
} from '../DrawingFibonacciDefaults';
import {
  getNormalizedFibonacciSettings,
  normalizeFibonacciDrawing,
  normalizeFibonacciSettings,
} from '../DrawingFibonacciMigration';
import { getDrawingStyleSchema, getDrawingStyleSchemaForDrawing } from '../DrawingStyleSchema';
import { createFibonacciLevelStyleSlotId, getEnabledFibonacciLevels, normalizeFibonacciAngle } from '../DrawingFibonacciGeometry';
import { FIBONACCI_MAX_LEVEL_ROWS } from '../DrawingFibonacciContracts';
import type { ChartDrawing } from '../types';

const common = {
  id: 'f1a-test',
  paneId: 'price',
  color: '#4fa7ff',
  lineWidth: 1.2,
  lineStyle: 'solid' as const,
  locked: false,
};

describe('F1A Fibonacci foundation contracts', () => {
  it('uses stable row IDs that are independent from editable coefficient values', () => {
    const defaults = createDefaultFibonacciSettings('fib');
    expect(defaults.kind).toBe('fib');
    if (defaults.kind !== 'fib') throw new Error('unexpected settings kind');

    expect(new Set(defaults.levels.map((level) => level.id)).size).toBe(defaults.levels.length);
    expect(defaults.levels.some((level) => level.value === 1.618)).toBe(true);

    const changed = defaults.levels.map((level) =>
      Math.abs(level.value - 0.618) < 1e-9 ? { ...level, value: 0.65 } : level,
    );
    const originalId = defaults.levels.find((level) => Math.abs(level.value - 0.618) < 1e-9)?.id;
    const changedId = changed.find((level) => Math.abs(level.value - 0.65) < 1e-9)?.id;
    expect(changedId).toBe(originalId);
  });

  it('keeps legacy fibExtension a distinct two-point legacy settings identity', () => {
    const drawing: ChartDrawing = {
      ...common,
      kind: 'fibExtension',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 120,
    };

    const normalized = normalizeFibonacciDrawing(drawing);
    expect(normalized.kind).toBe('fibExtension');
    expect(normalized.toolSettings?.fibonacci?.kind).toBe('fibExtension');
  });

  it('adds stable presentation aliases without deleting legacy coefficient-keyed colors', () => {
    const drawing: ChartDrawing = {
      ...common,
      kind: 'fib',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 120,
      presentation: {
        lines: {
          'level:0.618': { color: '#123456', lineWidth: 2.2 },
        },
      },
    };

    const normalized = normalizeFibonacciDrawing(drawing);
    const settings = getNormalizedFibonacciSettings(normalized);
    if (!settings || settings.kind !== 'fib') throw new Error('missing normalized retracement settings');
    const row = settings.levels.find((level) => Math.abs(level.value - 0.618) < 1e-9);
    expect(row).toBeDefined();
    expect(normalized.presentation?.lines?.['level:0.618']?.color).toBe('#123456');
    expect(normalized.presentation?.lines?.[`level:${row!.id}`]?.color).toBe('#123456');
  });

  it('builds an instance-aware style schema from stable IDs while leaving the legacy schema unchanged', () => {
    const drawing: ChartDrawing = normalizeFibonacciDrawing({
      ...common,
      kind: 'fib',
      startIndex: 1,
      startPrice: 10,
      endIndex: 2,
      endPrice: 20,
    });
    const settings = getNormalizedFibonacciSettings(drawing);
    if (!settings || settings.kind !== 'fib') throw new Error('missing normalized retracement settings');

    const stableSchema = getDrawingStyleSchemaForDrawing(drawing);
    expect(stableSchema.lines.some((line) => line.id === `level:${settings.levels[0].id}`)).toBe(true);
    expect(getDrawingStyleSchema('fib').lines.some((line) => line.id === 'level:0.236')).toBe(true);
  });

  it('defines independent price and time level families for the future Speed Resistance Fan renderer', () => {
    const settings = createDefaultFibonacciSettings('fibFan');
    expect(settings.kind).toBe('fibFan');
    if (settings.kind !== 'fibFan') throw new Error('unexpected fan settings kind');

    expect(settings.priceLevels.map((level) => level.value)).toEqual([...FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES]);
    expect(settings.timeLevels.map((level) => level.value)).toEqual([...FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES]);
    expect(settings.priceLevels[0].id).not.toBe(settings.timeLevels[0].id);
    expect(settings.reverse).toBe(false);
    expect(settings.showGrid).toBe(true);
  });

  it('locks the audited time-zone and wedge defaults without changing current renderer geometry', () => {
    const timeZone = createDefaultFibonacciSettings('fibTimeZone');
    const wedge = createDefaultFibonacciSettings('fibWedge');
    if (timeZone.kind !== 'fibTimeZone' || wedge.kind !== 'fibWedge') throw new Error('unexpected settings kind');

    expect(timeZone.levels.map((level) => level.value)).toEqual([...FIB_TIME_ZONE_DEFAULT_VALUES]);
    expect(timeZone.labelHorizontalSide).toBe('right');
    expect(timeZone.labelVerticalSide).toBe('bottom');
    expect(wedge.levels.map((level) => level.value)).toEqual([...FIB_WEDGE_DEFAULT_VALUES]);
    expect(wedge.levels.slice(0, 6).every((level) => level.enabled !== false)).toBe(true);
    expect(wedge.levels.slice(6).every((level) => level.enabled === false)).toBe(true);
  });

  it('contains a Fib Spiral settings contract but keeps renderer rollout acceptance-gated', () => {
    const spiral = createDefaultFibonacciSettings('fibSpiral');
    expect(spiral).toEqual({ schemaVersion: 1, kind: 'fibSpiral', counterclockwise: false });
  });

  it('repairs malformed/missing level IDs deterministically without changing coefficients', () => {
    const normalized = normalizeFibonacciSettings('fibTimeZone', {
      schemaVersion: 1,
      kind: 'fibTimeZone',
      levels: [
        { id: '', value: 0 },
        { value: 1 },
        { id: 'custom-three', value: 3, enabled: false },
      ],
    });
    if (normalized.kind !== 'fibTimeZone') throw new Error('unexpected settings kind');
    expect(normalized.levels.map((level) => level.value)).toEqual([0, 1, 3]);
    expect(normalized.levels[0].id).toBeTruthy();
    expect(normalized.levels[1].id).toBeTruthy();
    expect(normalized.levels[2]).toMatchObject({ id: 'custom-three', value: 3, enabled: false });
  });

  it('repairs duplicate row IDs and caps malformed persisted lists to the shared row limit', () => {
    const normalized = normalizeFibonacciSettings('fib', {
      schemaVersion: 1,
      kind: 'fib',
      levels: Array.from({ length: FIBONACCI_MAX_LEVEL_ROWS + 5 }, (_unused, index) => ({
        id: index < 2 ? 'duplicate' : `row-${index}`,
        value: index / 10,
      })),
    });
    if (normalized.kind !== 'fib') throw new Error('unexpected settings kind');
    expect(normalized.levels).toHaveLength(FIBONACCI_MAX_LEVEL_ROWS);
    expect(new Set(normalized.levels.map((level) => level.id)).size).toBe(normalized.levels.length);
    expect(normalized.levels[0].id).toBe('duplicate');
    expect(normalized.levels[1].id).toBe('duplicate-2');
  });

  it('provides shared renderer/hit-test geometry primitives without changing audited formulas in F1A', () => {
    const settings = createDefaultFibonacciSettings('fibWedge');
    if (settings.kind !== 'fibWedge') throw new Error('unexpected wedge settings kind');
    expect(getEnabledFibonacciLevels(settings.levels)).toHaveLength(6);
    expect(createFibonacciLevelStyleSlotId(settings.levels[0].id)).toBe(`level:${settings.levels[0].id}`);
    expect(normalizeFibonacciAngle(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2);
  });
});

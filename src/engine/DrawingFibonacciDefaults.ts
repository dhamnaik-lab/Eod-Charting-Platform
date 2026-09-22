import type {
  FibonacciLevelDefinition,
  FibonacciToolKind,
  FibonacciToolSettings,
} from './DrawingFibonacciContracts';

const levelRows = (
  prefix: string,
  values: readonly number[],
  enabled: boolean | ((value: number, index: number) => boolean) = true,
): FibonacciLevelDefinition[] =>
  values.map((value, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    value,
    enabled: typeof enabled === 'function' ? enabled(value, index) : enabled,
  }));

/** TradingView-compatible/default-contract values confirmed during the F1 audit. */
export const FIB_RETRACEMENT_DEFAULT_VALUES = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3.618, 4.236,
] as const;
export const LEGACY_FIB_PROJECTION_VALUES = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618] as const;
export const TREND_FIB_EXTENSION_DEFAULT_VALUES = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618, 3.618, 4.236,
] as const;
export const FIB_CHANNEL_DEFAULT_VALUES = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2] as const;
export const FIB_TIME_ZONE_DEFAULT_VALUES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;
export const TREND_FIB_TIME_DEFAULT_VALUES = [0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3] as const;
export const FIB_CIRCLES_DEFAULT_VALUES = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const FIB_WEDGE_DEFAULT_VALUES = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 4.618] as const;
export const FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1] as const;

export function cloneFibonacciLevels(levels: readonly FibonacciLevelDefinition[]): FibonacciLevelDefinition[] {
  return levels.map((level) => ({ ...level }));
}

export function createDefaultFibonacciSettings(kind: FibonacciToolKind): FibonacciToolSettings {
  switch (kind) {
    case 'fib':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('retracement', FIB_RETRACEMENT_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
        reverse: false,
        showPrices: true,
        logScaleLevels: false,
      };
    case 'fibExtension':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('legacy-projection', LEGACY_FIB_PROJECTION_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
      };
    case 'trendFibExtension':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('trend-extension', TREND_FIB_EXTENSION_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
        reverse: false,
        showPrices: true,
        logScaleLevels: false,
      };
    case 'fibChannel':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('channel', FIB_CHANNEL_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
      };
    case 'fibTimeZone':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('time-zone', FIB_TIME_ZONE_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
        showBackground: false,
        labelHorizontalSide: 'right',
        labelVerticalSide: 'bottom',
      };
    case 'fibTimeExtension':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('trend-time', TREND_FIB_TIME_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
        showBackground: true,
        labelHorizontalSide: 'right',
        labelVerticalSide: 'bottom',
      };
    case 'fibCircles':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('circles', FIB_CIRCLES_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
      };
    case 'fibArcs':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('speed-arcs', FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES),
        showLevels: true,
        coefficientFormat: 'coefficient',
        fullCircles: false,
        labelSides: { top: true },
      };
    case 'fibWedge':
      return {
        schemaVersion: 1,
        kind,
        levels: levelRows('wedge', FIB_WEDGE_DEFAULT_VALUES, (_value, index) => index < 6),
        showLevels: true,
        coefficientFormat: 'coefficient',
        showBackground: true,
      };
    case 'fibFan':
      return {
        schemaVersion: 1,
        kind,
        priceLevels: levelRows('fan-price', FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES),
        timeLevels: levelRows('fan-time', FIB_SPEED_RESISTANCE_FAN_DEFAULT_VALUES),
        reverse: false,
        showBackground: true,
        showGrid: true,
        priceLabelSides: { left: true, right: true },
        timeLabelSides: { top: true, bottom: true },
      };
    case 'fibSpiral':
      return {
        schemaVersion: 1,
        kind,
        counterclockwise: false,
      };
  }
}

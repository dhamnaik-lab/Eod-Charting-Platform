/**
 * Persisted contracts shared by the TradingView-fidelity Fibonacci drawing family.
 *
 * Geometry is intentionally NOT implemented here. F1A establishes stable identities
 * and settings persistence so later geometry waves can consume one canonical model
 * without encoding coefficient values into style slot IDs.
 */

export type FibonacciToolKind =
  | 'fib'
  | 'fibExtension'
  | 'trendFibExtension'
  | 'fibChannel'
  | 'fibTimeZone'
  | 'fibTimeExtension'
  | 'fibCircles'
  | 'fibArcs'
  | 'fibWedge'
  | 'fibFan'
  | 'fibSpiral';

export type FibonacciCoefficientFormat = 'coefficient' | 'percent';
export type FibonacciHorizontalLabelSide = 'left' | 'right';
export type FibonacciVerticalLabelSide = 'top' | 'bottom';

/** TradingView Retracement/Extension level-editor capacity locked during the F1 audit. */
export const FIBONACCI_MAX_LEVEL_ROWS = 24;

export interface FibonacciLevelDefinition {
  /** Stable persisted row identity. Never derive this from the editable coefficient. */
  id: string;
  value: number;
  /** Hidden only when explicitly false. */
  enabled?: boolean;
  customText?: string;
}

export interface FibonacciCommonSettings {
  schemaVersion: 1;
  levels: FibonacciLevelDefinition[];
  showLevels?: boolean;
  coefficientFormat?: FibonacciCoefficientFormat;
}

export interface FibonacciRetracementSettings extends FibonacciCommonSettings {
  kind: 'fib';
  reverse?: boolean;
  showPrices?: boolean;
  logScaleLevels?: boolean;
}

/** Legacy EOD two-point projection. It deliberately remains distinct from trendFibExtension. */
export interface LegacyFibonacciProjectionSettings extends FibonacciCommonSettings {
  kind: 'fibExtension';
}

export interface TrendFibonacciExtensionSettings extends FibonacciCommonSettings {
  kind: 'trendFibExtension';
  reverse?: boolean;
  showPrices?: boolean;
  logScaleLevels?: boolean;
}

export interface FibonacciChannelSettings extends FibonacciCommonSettings {
  kind: 'fibChannel';
}

export interface FibonacciTimeZoneSettings extends FibonacciCommonSettings {
  kind: 'fibTimeZone';
  showBackground?: boolean;
  labelHorizontalSide?: FibonacciHorizontalLabelSide;
  labelVerticalSide?: FibonacciVerticalLabelSide;
}

export interface TrendFibonacciTimeSettings extends FibonacciCommonSettings {
  kind: 'fibTimeExtension';
  showBackground?: boolean;
  labelHorizontalSide?: FibonacciHorizontalLabelSide;
  labelVerticalSide?: FibonacciVerticalLabelSide;
}

export interface FibonacciCirclesSettings extends FibonacciCommonSettings {
  kind: 'fibCircles';
}

export interface FibonacciSpeedResistanceArcsSettings extends FibonacciCommonSettings {
  kind: 'fibArcs';
  fullCircles?: boolean;
  labelSides?: Partial<Record<'left' | 'right' | 'top' | 'bottom', boolean>>;
}

export interface FibonacciWedgeSettings extends FibonacciCommonSettings {
  kind: 'fibWedge';
  showBackground?: boolean;
}

export interface FibonacciSpeedResistanceFanSettings {
  schemaVersion: 1;
  kind: 'fibFan';
  priceLevels: FibonacciLevelDefinition[];
  timeLevels: FibonacciLevelDefinition[];
  coefficientFormat?: FibonacciCoefficientFormat;
  reverse?: boolean;
  showBackground?: boolean;
  showGrid?: boolean;
  priceLabelSides?: Partial<Record<'left' | 'right', boolean>>;
  timeLabelSides?: Partial<Record<'top' | 'bottom', boolean>>;
}

/**
 * Fib Spiral is acceptance-gated until its exact TradingView phase/orientation is proven.
 * The contract/default exists in F1A, but the selectable/persisted ChartDrawing kind is
 * intentionally introduced only with the later spiral renderer wave.
 */
export interface FibonacciSpiralSettings {
  schemaVersion: 1;
  kind: 'fibSpiral';
  counterclockwise?: boolean;
  /** Persisted data-space 90-degree basis captured when Point 2 is placed. */
  basisPerp?: { barDelta: number; priceDelta: number };
}

export type FibonacciToolSettings =
  | FibonacciRetracementSettings
  | LegacyFibonacciProjectionSettings
  | TrendFibonacciExtensionSettings
  | FibonacciChannelSettings
  | FibonacciTimeZoneSettings
  | TrendFibonacciTimeSettings
  | FibonacciCirclesSettings
  | FibonacciSpeedResistanceArcsSettings
  | FibonacciWedgeSettings
  | FibonacciSpeedResistanceFanSettings
  | FibonacciSpiralSettings;

export interface DrawingToolSettings {
  fibonacci?: FibonacciToolSettings;
}

export function isFibonacciToolKind(value: string): value is FibonacciToolKind {
  return (
    value === 'fib' ||
    value === 'fibExtension' ||
    value === 'trendFibExtension' ||
    value === 'fibChannel' ||
    value === 'fibTimeZone' ||
    value === 'fibTimeExtension' ||
    value === 'fibCircles' ||
    value === 'fibArcs' ||
    value === 'fibWedge' ||
    value === 'fibFan' ||
    value === 'fibSpiral'
  );
}


/** Create a new persisted row identity without coupling it to the editable coefficient. */
export function createFibonacciLevelId(prefix = 'custom'): string {
  const resolvedPrefix = prefix.trim().replace(/[^A-Za-z0-9_-]+/g, '-') || 'custom';
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${resolvedPrefix}-${uuid}`;
  return `${resolvedPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isFibonacciLevelEnabled(level: FibonacciLevelDefinition): boolean {
  return level.enabled !== false;
}

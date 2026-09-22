/**
 * Gann Price-Time Analysis Plugin — Type Contracts
 *
 * All interfaces are pure data shapes. No runtime code lives in this module.
 * The engine, overlay renderer, and plugin manifest each import from here.
 */

// ---------------------------------------------------------------------------
// Bar input
// ---------------------------------------------------------------------------

/**
 * Minimal OHLCV bar subset consumed by the Gann engine.
 * Mirrors the platform's OHLCBar fields that the engine actually needs.
 */
export interface GannBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Pivot anchor
// ---------------------------------------------------------------------------

export type GannPivotPolarity = 'high' | 'low';

/**
 * A confirmed swing pivot selected as a Gann anchor.
 */
export interface GannPivot {
  barIndex: number;
  date: string;
  price: number;
  polarity: GannPivotPolarity;
}

// ---------------------------------------------------------------------------
// Angle rays
// ---------------------------------------------------------------------------

/**
 * A single Gann angle ray projected forward from the pivot anchor.
 *
 * Coordinates are expressed in bar-index / price space.
 * Pixel conversion happens only inside the canvas renderer.
 */
export interface GannAngleRay {
  /** Human-readable label, e.g. "1×1", "2×1", "1×2" */
  label: string;
  /** Points-per-bar slope in price space */
  slope: number;
  fromBarIndex: number;
  fromPrice: number;
  toBarIndex: number;
  toPrice: number;
  /** Hex or CSS colour string */
  color: string;
}

// ---------------------------------------------------------------------------
// Square of Nine levels
// ---------------------------------------------------------------------------

/**
 * A single Square of Nine harmonic price level derived from the anchor price.
 */
export interface SquareOfNineLevel {
  /** Rotation angle in degrees (45, 90, 135, 180, 225, 270, 315, 360) */
  angleDeg: number;
  /** Computed support / resistance price */
  price: number;
  /** Display label, e.g. "45°", "360°" */
  label: string;
}

// ---------------------------------------------------------------------------
// Time cycle signals
// ---------------------------------------------------------------------------

export type GannBreakoutStatus =
  | 'bullish'      // Confirmed bullish close above cycle candle high
  | 'bearish'      // Confirmed bearish close below cycle candle low
  | 'unconfirmed'  // 5-bar lookout window passed without confirmation
  | 'pending';     // Cycle bar is in the future or lookout window still open

/**
 * A single time cycle signal projected from the pivot anchor.
 */
export interface GannCycleSignal {
  /** Number of bars from anchor (45 | 90 | 180 | 360) */
  interval: 45 | 90 | 180 | 360;
  anchorBarIndex: number;
  /** Absolute bar index of the cycle boundary candle */
  cycleBarIndex: number;
  /** OHLC snapshot of the cycle boundary candle */
  cycleHigh: number;
  cycleLow: number;
  breakoutStatus: GannBreakoutStatus;
  /** Bar index where breakout close was detected, if confirmed */
  breakoutBarIndex: number | null;
}

// ---------------------------------------------------------------------------
// Aggregate setup result
// ---------------------------------------------------------------------------

/**
 * The complete output of one Gann Price-Time computation pass.
 */
export interface GannSetup {
  /** The pivot that anchors all projections */
  pivot: GannPivot;
  /** Scale constant: pivot-pair price/time slope in points per bar for the 1×1 line */
  scaleS: number;
  angleRays: GannAngleRay[];
  squareOfNineLevels: SquareOfNineLevel[];
  cycleSignals: GannCycleSignal[];
}

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

/**
 * User-configurable options for the Gann Price-Time plugin.
 * All fields have defaults inside the engine; the UI may override any.
 */
export interface GannPluginOptions {
  /**
   * Half-width of the centred rolling window used by the pivot detector.
   * Default: 8 (17-bar window).
   */
  pivotWindowRadius: number;

  /**
   * Legacy ATR period retained for options compatibility and the standalone
   * ATR utility. Automatic fan geometry no longer uses ATR for its 1×1 scale.
   * Default: 14.
   */
  atrPeriod: number;

  /**
   * Optional fixed scale override (points per bar for the 1×1 line).
   * When provided, automatic pivot-pair scale derivation is bypassed.
   */
  fixedScale: number | null;

  /**
   * How many bars forward to extend angle rays from the anchor.
   * Default: 180.
   */
  rayLookForward: number;

  showAngles: boolean;
  showSquareOfNine: boolean;
  showCycles: boolean;
}

// ---------------------------------------------------------------------------
// Canvas coordinate mapping contract
// ---------------------------------------------------------------------------

/**
 * Interface that the canvas overlay renderer accepts for coordinate conversion.
 * The platform implementation supplies this via the active ChartEngine viewport.
 */
export interface GannCoordinateMapper {
  /** Convert a bar index (0-based) to a canvas X pixel coordinate */
  timeToX(barIndex: number): number;
  /** Convert a price value to a canvas Y pixel coordinate */
  priceToY(price: number): number;
}

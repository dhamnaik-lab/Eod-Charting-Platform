/**
 * Shared visual-style contracts for chart drawings and indicator plots.
 *
 * This module intentionally contains no renderer or React dependencies. It is the
 * common persistence/UI boundary used by the drawing Properties redesign and by
 * existing indicator presentation settings.
 */
export type UnifiedLineStyle = 'solid' | 'dashed' | 'dotted';
export type UnifiedPlotStyle = 'line' | 'stepline' | 'histogram' | 'area' | 'cross' | 'circles';
export type UnifiedSettingsTimeframe = 'D' | 'W' | 'M' | 'Q' | 'Y';
export type UnifiedFontFamily = 'sans' | 'serif' | 'mono';
export type UnifiedTextAlign = 'left' | 'center' | 'right';
export type UnifiedLabelHorizontalPosition = 'left' | 'center' | 'right';
export type UnifiedLabelVerticalPosition = 'above' | 'center' | 'below';

export interface UnifiedLinePresentationSettings {
  /** Hidden only when explicitly false. */
  visible?: boolean;
  color?: string;
  lineWidth?: number;
  lineStyle?: UnifiedLineStyle;
  /** 0..1; omitted means renderer/default opacity. */
  opacity?: number;
}

export interface UnifiedPlotPresentationSettings extends UnifiedLinePresentationSettings {
  plotStyle?: UnifiedPlotStyle;
}

export interface UnifiedFillPresentationSettings {
  /** Hidden only when explicitly false. */
  visible?: boolean;
  color?: string;
  /** 0..1; omitted means renderer/default opacity. */
  opacity?: number;
}

export interface UnifiedTextPresentationSettings {
  /** Hidden only when explicitly false. */
  visible?: boolean;
  color?: string;
  /** 0..1; omitted means renderer/default opacity. */
  opacity?: number;
  fontSize?: number;
  fontFamily?: UnifiedFontFamily;
  bold?: boolean;
  italic?: boolean;
  textAlign?: UnifiedTextAlign;
}

export interface UnifiedLabelPresentationSettings extends UnifiedTextPresentationSettings {
  horizontalPosition?: UnifiedLabelHorizontalPosition;
  verticalPosition?: UnifiedLabelVerticalPosition;
}

export interface UnifiedTimeframeVisibilitySettings {
  /** Master visibility. Hidden only when explicitly false. */
  visible?: boolean;
  /** Per-timeframe overrides. Missing entries remain visible for backward compatibility. */
  timeframes?: Partial<Record<UnifiedSettingsTimeframe, boolean>>;
}

export interface DrawingPresentationSettings {
  /**
   * When true, line color resolution uses the drawing's legacy `color` as the
   * common override while retaining independent width/style/visibility settings.
   */
  useOneColor?: boolean;
  lines?: Record<string, UnifiedLinePresentationSettings>;
  fills?: Record<string, UnifiedFillPresentationSettings>;
  text?: UnifiedTextPresentationSettings;
  labels?: UnifiedLabelPresentationSettings;
}

export function normalizeUnitOpacity(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

export function isVisibleOnTimeframe(
  settings: UnifiedTimeframeVisibilitySettings | undefined,
  timeframe: UnifiedSettingsTimeframe,
): boolean {
  if (settings?.visible === false) {
    return false;
  }
  return settings?.timeframes?.[timeframe] !== false;
}

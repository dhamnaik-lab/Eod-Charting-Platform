import type { InstrumentKey, InstrumentSummary } from '@/platform';
import type { DrawingToolSettings } from './DrawingFibonacciContracts';
import type {
  DrawingPresentationSettings,
  UnifiedFillPresentationSettings,
  UnifiedLinePresentationSettings,
  UnifiedLineStyle,
  UnifiedPlotPresentationSettings,
  UnifiedPlotStyle,
  UnifiedSettingsTimeframe,
  UnifiedTimeframeVisibilitySettings,
} from './UnifiedStyleContracts';
export type { DrawingPresentationSettings, UnifiedTimeframeVisibilitySettings } from './UnifiedStyleContracts';

export interface OHLCBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose?: number;
  renkoDirection?: RenkoBrickDirection;
  renkoBoxSize?: number;
  renkoComplete?: boolean;
  renkoSourceClose?: number;
  renkoSourceHigh?: number;
  renkoSourceLow?: number;
  renkoSourceTimestamp?: number;
  renkoBrickOrdinal?: number;
}

export interface ThemeVariables {
  primary: string;
  primaryHover: string;
}

export interface BackgroundZone {
  startIndex: number;
  endIndex: number;
  color: string;
}

export type ChartMarkerEventType =
  | 'BONUS'
  | 'SPLIT'
  | 'DIVIDEND'
  | 'RIGHTS'
  | 'DEMERGER'
  | 'NAME_CHANGE'
  | 'SYMBOL_CHANGE';

export interface ChartMarkerEvent {
  id: string;
  effectiveDate: string;
  type: ChartMarkerEventType;
  label: 'B' | 'S' | 'D' | 'R' | 'M' | 'N' | 'T';
  description: string;
}

export type ChartEventVisibility = Record<ChartMarkerEventType, boolean>;

export const DEFAULT_CHART_EVENT_VISIBILITY: ChartEventVisibility = {
  BONUS: true,
  SPLIT: true,
  DIVIDEND: true,
  RIGHTS: true,
  DEMERGER: true,
  NAME_CHANGE: true,
  SYMBOL_CHANGE: true,
};

export interface Viewport {
  startIndex: number;
  endIndex: number;
}

export interface RenderableMarker {
  key: string;
  index: number;
  label: string;
  position: 'above' | 'below';
  color: string;
  title?: string;
}

export interface ScaleX {
  barWidth: number;
  barGap: number;
  bodyWidth: number;
  toPixel: (index: number) => number;
  toIndex: (px: number) => number;
}

export interface ScaleY {
  min: number;
  max: number;
  toPixel: (price: number) => number;
  toPrice: (px: number) => number;
}

export interface PaneScaleRange {
  min: number;
  max: number;
}

export type ChartTimeframe = UnifiedSettingsTimeframe;
export type ChartType = 'candles' | 'line' | 'area' | 'bar' | 'baseline' | 'hlcArea' | 'heikinAshi' | 'renko';
export type RenkoBoxSizeMode = 'traditional' | 'percent' | 'atr';
export type RenkoPriceSource = 'close' | 'high_low';
export type RenkoAnchorPolicy = 'first_close' | 'rounded_to_box';
export type RenkoBrickDirection = 'up' | 'down';
export type RenkoWickMode = 'reversal_attempt' | 'source_range';
export interface RenkoSettings {
  boxSizeMode: RenkoBoxSizeMode;
  boxSize: number;
  percent: number;
  atrPeriod: number;
  priceSource: RenkoPriceSource;
  anchorPolicy: RenkoAnchorPolicy;
  showWicks: boolean;
  wickMode: RenkoWickMode;
  includeIncompleteBrick: boolean;
}
export type FutureMarginMode = 'tight' | 'normal' | 'wide';

export interface PersistedCompareOverlay {
  id: string;
  instrument: InstrumentKey;
  instrumentMeta?: InstrumentSummary | null;
  color: string;
}

export interface ChartCompareOverlay extends PersistedCompareOverlay {
  rawBars: OHLCBar[];
  displayBars: OHLCBar[];
}

export type IndicatorPaneHeights = Record<string, number>;
export type CollapsedIndicatorPanes = Record<string, boolean>;
export type PaneScaleOverrides = Record<string, PaneScaleRange>;

export interface CrosshairState {
  visible: boolean;
  x: number;
  y: number;
  barIndex: number;
  logicalIndex: number;
  dateLabel: string | null;
  paneId: ChartPaneId;
  paneTop: number;
  paneHeight: number;
  value: number;
  bar: OHLCBar | null;
}

export type DrawingTool =
  | 'cursor'
  | 'crosshair'
  | 'hline'
  | 'vline'
  | 'trendline'
  | 'extendedLine'
  | 'horizontalRay'
  | 'crossLine'
  | 'infoLine'
  | 'trendAngle'
  | 'priceRange'
  | 'dateRange'
  | 'regressionTrend'
  | 'fibTimeZone'
  | 'fibCircles'
  | 'fibSpiral'
  | 'fibArcs'
  | 'gannBox'
  | 'circle'
  | 'ellipse'
  | 'forecast'
  | 'arrowMarker'
  | 'arrowUp'
  | 'arrowDown'
  | 'flatChannel'
  | 'disjointChannel'
  | 'triangle'
  | 'rotatedRect'
  | 'arc'
  | 'andrewsPitchfork'
  | 'schiffPitchfork'
  | 'modifiedSchiffPitchfork'
  | 'insidePitchfork'
  | 'trendFibExtension'
  | 'fibChannel'
  | 'fibTimeExtension'
  | 'fibWedge'
  | 'pitchfan'
  | 'longPosition'
  | 'shortPosition'
  | 'projection'
  | 'xabcdPattern'
  | 'abcdPattern'
  | 'headAndShouldersPattern'
  | 'elliottImpulse'
  | 'elliottCorrection'
  | 'ray'
  | 'arrow'
  | 'rect'
  | 'text'
  | 'channel'
  | 'fib'
  | 'fibExtension'
  | 'fibFan'
  | 'gann'
  | 'measure';
export type DrawingLineStyle = UnifiedLineStyle;
export type DrawingLabelPosition = 'left' | 'right';
export type ChartPaneId = 'price' | string;

/** Source series used as input for price-based indicators. */
export type IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
export type PlotStyle = UnifiedPlotStyle;

export interface BandFillSettings extends UnifiedFillPresentationSettings {
  id: string;
  label: string;
  upperPlotId: string;
  lowerPlotId: string;
  color: string;
}

export interface IndicatorPlotSettings extends UnifiedPlotPresentationSettings {
  secondaryColor?: string;
  positiveColor?: string;
  negativeColor?: string;
  legendVisible?: boolean;
  valueLabelVisible?: boolean;
}

export interface IndicatorPresentationSettings {
  plots?: Record<string, IndicatorPlotSettings>;
  levels?: IndicatorLevelSettings[];
  bandFills?: BandFillSettings[];
}

export interface IndicatorLevelSettings extends UnifiedLinePresentationSettings {
  id: string;
  label?: string;
  value: number;
}

export interface CustomFormulaIndicator {
  id: string;
  kind: 'CUSTOM';
  placement: 'overlay' | 'pane';
  name: string;
  formula: string;
  color: string;
}

interface ChartDrawingBase {
  id: string;
  color: string;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  locked?: boolean;
  paneId?: ChartPaneId;
  /** Extend supported line/channel geometry toward the left edge of the visible pane. */
  extendLeft?: boolean;
  /** Extend supported line/channel geometry toward the right edge of the visible pane. */
  extendRight?: boolean;
  /** Hide labels for drawings that expose label visibility. Defaults to visible when omitted. */
  showLabel?: boolean;
  /** Preferred side for numeric/level labels when the drawing supports side placement. Defaults to left. */
  labelPosition?: DrawingLabelPosition;
  /** Optional S1+ per-component visual overrides. Omitted drawings retain legacy rendering exactly. */
  presentation?: DrawingPresentationSettings;
  /** Optional S1+ timeframe visibility. Omitted means visible on every supported timeframe. */
  visibility?: UnifiedTimeframeVisibilitySettings;
  /** Optional tool-specific settings. F1A introduces Fibonacci contracts without changing legacy geometry. */
  toolSettings?: DrawingToolSettings;
}

export interface RenkoDrawingAnchor {
  sourceTimestamp: number;
  sourceDate: string;
  brickOrdinal: number;
  open: number;
  close: number;
  direction?: RenkoBrickDirection;
  complete?: boolean;
}

export interface AnchoredDrawingBase extends ChartDrawingBase {
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  /** Stable source-bar timestamp used to remap the anchor across chart timeframes. */
  startTimestamp?: number;
  /** Stable source-bar timestamp used to remap the anchor across chart timeframes. */
  endTimestamp?: number;
  startRenkoAnchor?: RenkoDrawingAnchor;
  endRenkoAnchor?: RenkoDrawingAnchor;
}

export interface PointDrawingBase extends ChartDrawingBase {
  barIndex: number;
  price: number;
  /** Stable source-bar timestamp used to remap the anchor across chart timeframes. */
  anchorTimestamp?: number;
  renkoAnchor?: RenkoDrawingAnchor;
}

export interface DrawingAnchor {
  barIndex: number;
  price: number;
  /** Stable source-bar timestamp used to remap this anchor across chart timeframes. */
  timestamp?: number;
  renkoAnchor?: RenkoDrawingAnchor;
}

export interface MultiAnchorDrawingBase extends ChartDrawingBase {
  anchors: DrawingAnchor[];
}

export interface TextDrawingBase extends PointDrawingBase {
  text: string;
  fontSize?: number;
  fontFamily?: 'sans' | 'serif' | 'mono';
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
}

export type ChartDrawing =
  | (ChartDrawingBase & { kind: 'hline'; price: number })
  | (ChartDrawingBase & { kind: 'vline'; barIndex: number; anchorTimestamp?: number; renkoAnchor?: RenkoDrawingAnchor })
  | (TextDrawingBase & { kind: 'text' })
  | (PointDrawingBase & { kind: 'horizontalRay' })
  | (PointDrawingBase & { kind: 'crossLine' })
  | (PointDrawingBase & { kind: 'arrowMarker' })
  | (PointDrawingBase & { kind: 'arrowUp' })
  | (PointDrawingBase & { kind: 'arrowDown' })
  | (MultiAnchorDrawingBase & { kind: 'flatChannel' })
  | (MultiAnchorDrawingBase & { kind: 'disjointChannel' })
  | (MultiAnchorDrawingBase & { kind: 'triangle' })
  | (MultiAnchorDrawingBase & { kind: 'rotatedRect' })
  | (MultiAnchorDrawingBase & { kind: 'arc' })
  | (MultiAnchorDrawingBase & { kind: 'andrewsPitchfork' })
  | (MultiAnchorDrawingBase & { kind: 'schiffPitchfork' })
  | (MultiAnchorDrawingBase & { kind: 'modifiedSchiffPitchfork' })
  | (MultiAnchorDrawingBase & { kind: 'insidePitchfork' })
  | (MultiAnchorDrawingBase & { kind: 'trendFibExtension' })
  | (MultiAnchorDrawingBase & { kind: 'fibChannel' })
  | (MultiAnchorDrawingBase & { kind: 'fibTimeExtension' })
  | (MultiAnchorDrawingBase & { kind: 'fibWedge' })
  | (MultiAnchorDrawingBase & { kind: 'pitchfan' })
  | (MultiAnchorDrawingBase & { kind: 'longPosition' })
  | (MultiAnchorDrawingBase & { kind: 'shortPosition' })
  | (MultiAnchorDrawingBase & { kind: 'projection' })
  | (MultiAnchorDrawingBase & { kind: 'xabcdPattern' })
  | (MultiAnchorDrawingBase & { kind: 'abcdPattern' })
  | (MultiAnchorDrawingBase & { kind: 'headAndShouldersPattern' })
  | (MultiAnchorDrawingBase & { kind: 'elliottImpulse' })
  | (MultiAnchorDrawingBase & { kind: 'elliottCorrection' })
  | (AnchoredDrawingBase & { kind: 'trendline' })
  | (AnchoredDrawingBase & { kind: 'extendedLine' })
  | (AnchoredDrawingBase & { kind: 'infoLine' })
  | (AnchoredDrawingBase & { kind: 'trendAngle' })
  | (AnchoredDrawingBase & { kind: 'priceRange' })
  | (AnchoredDrawingBase & { kind: 'dateRange' })
  | (AnchoredDrawingBase & { kind: 'regressionTrend' })
  | (AnchoredDrawingBase & { kind: 'fibTimeZone' })
  | (AnchoredDrawingBase & { kind: 'fibCircles' })
  | (AnchoredDrawingBase & { kind: 'fibSpiral' })
  | (AnchoredDrawingBase & { kind: 'fibArcs' })
  | (AnchoredDrawingBase & { kind: 'gannBox' })
  | (AnchoredDrawingBase & { kind: 'circle' })
  | (AnchoredDrawingBase & { kind: 'ellipse' })
  | (AnchoredDrawingBase & { kind: 'forecast' })
  | (AnchoredDrawingBase & { kind: 'ray' })
  | (AnchoredDrawingBase & { kind: 'arrow' })
  | (AnchoredDrawingBase & { kind: 'rect' })
  | (AnchoredDrawingBase & { kind: 'channel'; offset: number })
  | (AnchoredDrawingBase & { kind: 'fib' })
  | (AnchoredDrawingBase & { kind: 'fibExtension' })
  | (AnchoredDrawingBase & { kind: 'fibFan' })
  | (AnchoredDrawingBase & { kind: 'gann' })
  | (AnchoredDrawingBase & { kind: 'measure' });

export type ChartDrawingScopes = Record<string, ChartDrawing[]>;

export interface ChartTheme {
  background: string;
  axisBackground: string;
  axisLabelBackground: string;
  panelBorder: string;
  gridLine: string;
  gridLineMajor: string;
  axisText: string;
  crosshair: string;
  candleUp: string;
  candleDown: string;
  wickUp: string;
  wickDown: string;
  renkoUp?: string;
  renkoDown?: string;
  renkoWickUp?: string;
  renkoWickDown?: string;
  renkoProjectionUp?: string;
  renkoProjectionDown?: string;
  renkoProjectionUpBorder?: string;
  renkoProjectionDownBorder?: string;
  volumeUp: string;
  volumeDown: string;
  borderColor: string;
  backgroundBottom?: string;
  sessionHighlight?: string;
}

export interface ChartVisualSettings {
  gridVisible: boolean;
  gridColor: string;
  gridMajorColor: string;
  backgroundColor: string;
  crosshairVisible: boolean;
  crosshairColor: string;
  watermarkVisible: boolean;
  watermarkColor: string;
  renkoUpColor: string;
  renkoDownColor: string;
  renkoProjectionUpColor: string;
  renkoProjectionDownColor: string;
  renkoProjectionUpBorderColor: string;
  renkoProjectionDownBorderColor: string;
  renkoWickUpColor: string;
  renkoWickDownColor: string;
}

export const DEFAULT_CHART_VISUAL_SETTINGS: ChartVisualSettings = {
  gridVisible: true,
  gridColor: 'rgba(78, 101, 128, 0.18)',
  gridMajorColor: 'rgba(116, 143, 174, 0.28)',
  backgroundColor: '#071019',
  crosshairVisible: true,
  crosshairColor: '#60a5fa',
  watermarkVisible: false,
  watermarkColor: 'rgba(159, 176, 195, 0.12)',
  renkoUpColor: '#22c55e',
  renkoDownColor: '#ef4444',
  renkoProjectionUpColor: 'rgba(34, 197, 94, 0.36)',
  renkoProjectionDownColor: 'rgba(239, 68, 68, 0.36)',
  renkoProjectionUpBorderColor: 'rgba(34, 197, 94, 0.88)',
  renkoProjectionDownBorderColor: 'rgba(239, 68, 68, 0.88)',
  renkoWickUpColor: '#4ade80',
  renkoWickDownColor: '#f87171',
};

export function normalizeChartVisualSettings(value: unknown): ChartVisualSettings {
  const record = typeof value === 'object' && value !== null
    ? value as Partial<ChartVisualSettings>
    : {};
  const color = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : fallback;

  return {
    gridVisible: record.gridVisible !== false,
    gridColor: color(record.gridColor, DEFAULT_CHART_VISUAL_SETTINGS.gridColor),
    gridMajorColor: color(record.gridMajorColor, DEFAULT_CHART_VISUAL_SETTINGS.gridMajorColor),
    backgroundColor: color(record.backgroundColor, DEFAULT_CHART_VISUAL_SETTINGS.backgroundColor),
    crosshairVisible: record.crosshairVisible === true,
    crosshairColor: color(record.crosshairColor, DEFAULT_CHART_VISUAL_SETTINGS.crosshairColor),
    watermarkVisible: record.watermarkVisible === true,
    watermarkColor: color(record.watermarkColor, DEFAULT_CHART_VISUAL_SETTINGS.watermarkColor),
    renkoUpColor: color(record.renkoUpColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoUpColor),
    renkoDownColor: color(record.renkoDownColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoDownColor),
    renkoProjectionUpColor: color(record.renkoProjectionUpColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoProjectionUpColor),
    renkoProjectionDownColor: color(record.renkoProjectionDownColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoProjectionDownColor),
    renkoProjectionUpBorderColor: color(record.renkoProjectionUpBorderColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoProjectionUpBorderColor),
    renkoProjectionDownBorderColor: color(record.renkoProjectionDownBorderColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoProjectionDownBorderColor),
    renkoWickUpColor: color(record.renkoWickUpColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoWickUpColor),
    renkoWickDownColor: color(record.renkoWickDownColor, DEFAULT_CHART_VISUAL_SETTINGS.renkoWickDownColor),
  };
}

export type ChartIndicator =
  // --- Overlay: Trend / Moving Averages ---
  | { id: string; kind: 'SMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'EMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'WMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'WEMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'DEMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'TEMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'VWAP'; placement: 'overlay'; color: string }
  // --- Overlay: Volatility / Bands ---
  | { id: string; kind: 'BOLL'; placement: 'overlay'; period: number; stdDev: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'PSAR'; placement: 'overlay'; step: number; max: number; color: string }
  // --- Overlay: Trend direction ---
  | { id: string; kind: 'SUPERTREND'; placement: 'overlay'; period: number; multiplier: number; upColor: string; downColor: string }
  // --- Pane: Momentum ---
  | { id: string; kind: 'RSI'; placement: 'pane'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'MACD'; placement: 'pane'; fastPeriod: number; slowPeriod: number; signalPeriod: number; color: string; signalColor: string; histogramPositiveColor: string; histogramNegativeColor: string; source?: IndicatorSource }
  | { id: string; kind: 'STOCH'; placement: 'pane'; period: number; smoothK?: number; signalPeriod: number; color: string; signalColor: string }
  | { id: string; kind: 'ROC'; placement: 'pane'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'CCI'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'WILLR'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'MOM'; placement: 'pane'; period: number; color: string; source?: IndicatorSource }
  // --- Pane: Volatility ---
  | { id: string; kind: 'ATR'; placement: 'pane'; period: number; color: string }
  // --- Pane: Trend Strength ---
  | { id: string; kind: 'ADX'; placement: 'pane'; period: number; color: string; plusColor: string; minusColor: string }
  | { id: string; kind: 'AROON'; placement: 'pane'; period: number; upColor: string; downColor: string }
  // --- Pane: Volume ---
  | { id: string; kind: 'MFI'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'OBV'; placement: 'pane'; color: string }
  | { id: string; kind: 'CMF'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'KAMA'; placement: 'overlay'; period: number; color: string }
  | { id: string; kind: 'ULTIMATE'; placement: 'pane'; shortPeriod: number; medPeriod: number; longPeriod: number; color: string }
  | { id: string; kind: 'HMA'; placement: 'overlay'; period: number; color: string }
  | { id: string; kind: 'ALMA'; placement: 'overlay'; period: number; sigma: number; offset: number; color: string }
  | { id: string; kind: 'BOP'; placement: 'pane'; color: string }
  | { id: string; kind: 'CMO'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'AVGPRICE'; placement: 'overlay'; color: string }
  | { id: string; kind: 'MEDPRICE'; placement: 'overlay'; color: string }
  | { id: string; kind: 'TYPPRICE'; placement: 'overlay'; color: string }
  | { id: string; kind: 'WCLPRICE'; placement: 'overlay'; color: string }
  | { id: string; kind: 'TRIX'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'APO'; placement: 'pane'; fastPeriod: number; slowPeriod: number; color: string }
  | { id: string; kind: 'PPO'; placement: 'pane'; fastPeriod: number; slowPeriod: number; color: string }
  | { id: string; kind: 'DPO'; placement: 'pane'; period: number; color: string }
  | {
      id: string;
      kind: 'ICHIMOKU';
      placement: 'overlay';
      conversionPeriod: number;
      basePeriod: number;
      spanBPeriod: number;
      laggingPeriod: number;
      conversionColor: string;
      baseColor: string;
      laggingColor: string;
      cloudUpColor: string;
      cloudDownColor: string;
    }
  | { id: string; kind: 'KELTNER'; placement: 'overlay'; period: number; multiplier: number; color: string }
  | { id: string; kind: 'DONCHIAN'; placement: 'overlay'; period: number; color: string }
  | { id: string; kind: 'ZIGZAG'; placement: 'overlay'; deviation: number; color: string }
  | { id: string; kind: 'ELDER_RAY'; placement: 'pane'; period: number; bullColor: string; bearColor: string }
  | { id: string; kind: 'COPPOCK'; placement: 'pane'; wmaPeriod: number; rocFast: number; rocSlow: number; color: string }
  | { id: string; kind: 'FORCE_INDEX'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'MASS_INDEX'; placement: 'pane'; emaPeriod: number; sumPeriod: number; color: string }
  | {
      id: string;
      kind: 'KST';
      placement: 'pane';
      roc1: number;
      roc2: number;
      roc3: number;
      roc4: number;
      s1: number;
      s2: number;
      s3: number;
      s4: number;
      sig: number;
      color: string;
      signalColor: string;
    }
  | { id: string; kind: 'VORTEX'; placement: 'pane'; period: number; plusColor: string; minusColor: string }
  | { id: string; kind: 'PATTERN'; placement: 'overlay'; patterns: string[]; color?: string; bullColor?: string; bearColor?: string; neutralColor?: string }
  | { id: string; kind: 'CPR'; placement: 'overlay'; pivotColor: string; tcColor: string; bcColor: string }
  | { id: string; kind: 'STOCHRSI'; placement: 'pane'; rsiPeriod: number; stochPeriod: number; kPeriod: number; dPeriod: number; color: string; signalColor: string; source?: IndicatorSource }
  | { id: string; kind: 'AVWAP'; placement: 'overlay'; anchorDate?: string; anchorIndex?: number; color: string }
  // --- Batch 1: Moving Averages & Trend Additions ---
  | { id: string; kind: 'LSMA'; placement: 'overlay'; period: number; offset?: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'VWMA'; placement: 'overlay'; period: number; color: string; source?: IndicatorSource }
  | { id: string; kind: 'MCGINLEY'; placement: 'overlay'; period: number; k?: number; color: string; source?: IndicatorSource }
  | {
      id: string;
      kind: 'ALLIGATOR';
      placement: 'overlay';
      jawPeriod: number;
      jawOffset: number;
      teethPeriod: number;
      teethOffset: number;
      lipsPeriod: number;
      lipsOffset: number;
      jawColor: string;
      teethColor: string;
      lipsColor: string;
    }
  | { id: string; kind: 'MA_CROSS'; placement: 'overlay'; fastPeriod: number; slowPeriod: number; fastColor: string; slowColor: string; crossColor?: string; maType?: 'SMA' | 'EMA' | 'WMA' }
  | { id: string; kind: 'MA_RIBBON'; placement: 'overlay'; period1: number; period2: number; period3: number; period4: number; color1: string; color2: string; color3: string; color4: string; maType?: 'SMA' | 'EMA' | 'WMA' }
  // --- Batch 2: Momentum & Oscillators ---
  | { id: string; kind: 'AO'; placement: 'pane'; fastPeriod: number; slowPeriod: number; positiveColor: string; negativeColor: string }
  | { id: string; kind: 'TSI'; placement: 'pane'; longLength: number; shortLength: number; signalLength: number; color: string; signalColor: string }
  | { id: string; kind: 'CRSI'; placement: 'pane'; rsiLength: number; upDownLength: number; rocLength: number; color: string }
  | { id: string; kind: 'RVI'; placement: 'pane'; length: number; color: string; signalColor: string }
  | { id: string; kind: 'FISHER'; placement: 'pane'; period: number; color: string; signalColor: string }
  | { id: string; kind: 'SMI_ERGODIC'; placement: 'pane'; longLength: number; shortLength: number; signalLength: number; color: string; signalColor: string }
  | { id: string; kind: 'SMI_ERGODIC_OSC'; placement: 'pane'; longLength: number; shortLength: number; signalLength: number; positiveColor: string; negativeColor: string }
  | { id: string; kind: 'PRING_SPECIAL_K'; placement: 'pane'; color: string }
  | { id: string; kind: 'RCI'; placement: 'pane'; period: number; signalPeriod?: number; color: string; signalColor?: string }
  | { id: string; kind: 'WOODIES_CCI'; placement: 'pane'; cciPeriod: number; turboPeriod: number; cciColor: string; turboColor: string; histogramPositiveColor?: string; histogramNegativeColor?: string }
  // --- Batch 3: Volatility, Bands & Trailing Stops ---
  | { id: string; kind: 'ENVELOPE'; placement: 'overlay'; period: number; percent: number; exponential?: boolean; basisColor?: string; upperColor?: string; lowerColor?: string; source?: IndicatorSource }
  | { id: string; kind: 'HV'; placement: 'pane'; period: number; annual?: number; color: string }
  | { id: string; kind: 'STDEV'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'RVI_VOL'; placement: 'pane'; period: number; signalPeriod?: number; color: string; signalColor?: string }
  | { id: string; kind: 'CHANDE_KROLL'; placement: 'overlay'; atrPeriod: number; atrMultiplier: number; stopPeriod: number; longColor: string; shortColor: string }
  | { id: string; kind: 'VOLATILITY_STOP'; placement: 'overlay'; period: number; multiplier: number; longColor: string; shortColor: string }
  | { id: string; kind: 'ULCER_INDEX'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'CHOP'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'CHOP_ZONE'; placement: 'pane'; period?: number }
  | { id: string; kind: 'BBTREND'; placement: 'pane'; shortPeriod: number; longPeriod: number; stdDev: number; positiveColor?: string; negativeColor?: string }
  // --- Batch 4: Volume & Order Flow Oscillators ---
  | { id: string; kind: 'VOL_OSC'; placement: 'pane'; fastPeriod: number; slowPeriod: number; color: string }
  | { id: string; kind: 'CHAIKIN_OSC'; placement: 'pane'; fastPeriod: number; slowPeriod: number; color: string }
  | { id: string; kind: 'KVO'; placement: 'pane'; fastPeriod: number; slowPeriod: number; signalPeriod: number; color: string; signalColor: string }
  | { id: string; kind: 'PVT'; placement: 'pane'; color: string }
  | { id: string; kind: 'PVI'; placement: 'pane'; signalPeriod: number; color: string; signalColor: string }
  | { id: string; kind: 'NVI'; placement: 'pane'; signalPeriod: number; color: string; signalColor: string }
  | { id: string; kind: 'CVD'; placement: 'pane'; positiveColor?: string; negativeColor?: string }
  | { id: string; kind: 'VOLUME_DELTA'; placement: 'pane'; positiveColor?: string; negativeColor?: string }
  | { id: string; kind: 'RVOL'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'UP_DOWN_VOL'; placement: 'pane'; upColor?: string; downColor?: string; deltaColor?: string }
  | { id: string; kind: 'NET_VOLUME'; placement: 'pane'; positiveColor?: string; negativeColor?: string }
  | { id: string; kind: 'EOM'; placement: 'pane'; period: number; divisor?: number; color: string }
  // --- Batch 5: Key Levels, Structures & Range ---
  | { id: string; kind: 'TWAP'; placement: 'overlay'; source?: IndicatorSource; color: string }
  | { id: string; kind: 'ADR'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'AUTO_KEY_LEVELS'; placement: 'overlay'; pivotLength?: number; maxLevels?: number; supportColor?: string; resistanceColor?: string }
  | { id: string; kind: 'AUTO_TREND'; placement: 'overlay'; pivotLength?: number; supportColor?: string; resistanceColor?: string }
  | { id: string; kind: 'FRACTALS'; placement: 'overlay'; periods?: number; upColor?: string; downColor?: string }
  | { id: string; kind: 'TREND_STRENGTH'; placement: 'pane'; period: number; color: string }
  | { id: string; kind: 'RCI_RIBBON'; placement: 'pane'; shortLength?: number; middleLength?: number; longLength?: number; shortColor?: string; middleColor?: string; longColor?: string }
  | { id: string; kind: 'BB_WIDTH'; placement: 'pane'; period: number; stdDev: number; color: string }
  | { id: string; kind: 'BB_PCT_B'; placement: 'pane'; period: number; stdDev: number; color: string }
  // --- Community Indicators ---
  | { id: string; kind: 'UT_BOT'; placement: 'overlay'; keyValue: number; atrPeriod: number; color?: string }
  | { id: string; kind: 'WADDAH_ATTAR'; placement: 'pane'; sensitivity: number; fastLength: number; slowLength: number; channelLength: number; bbMult: number; upColor?: string; downColor?: string; explosionColor?: string; deadZoneColor?: string }
  | { id: string; kind: 'SQUEEZE_MOMENTUM'; placement: 'pane'; bbLength: number; bbMult: number; kcLength: number; kcMult: number }
  | { id: string; kind: 'WAVETREND'; placement: 'pane'; channelLength: number; averageLength: number; obLevel1?: number; osLevel1?: number; wt1Color?: string; wt2Color?: string }
  | { id: string; kind: 'QQE_MOD'; placement: 'pane'; rsiLengthPrimary: number; rsiSmoothingPrimary: number; qqeFactorPrimary: number; rsiLengthSecondary: number; rsiSmoothingSecondary: number; qqeFactorSecondary: number; bollingerLength: number; bollingerMultiplier: number }
  | { id: string; kind: 'CHANDELIER_EXIT'; placement: 'overlay'; atrPeriod: number; atrMult: number; useClose?: boolean; longColor?: string; shortColor?: string }
  | { id: string; kind: 'SSL_CHANNEL'; placement: 'overlay'; period: number; upColor?: string; downColor?: string }
  | { id: string; kind: 'RIPSTER_EMA_CLOUDS'; placement: 'overlay'; source?: IndicatorSource; shortLen1?: number; longLen1?: number; shortLen2?: number; longLen2?: number; shortLen3?: number; longLen3?: number }
  | { id: string; kind: 'ALPHA_TREND'; placement: 'overlay'; coeff: number; period: number; useRSI?: boolean; color?: string; lagColor?: string }
  | { id: string; kind: 'VFI'; placement: 'pane'; length: number; coef: number; vcoef: number; signalLength: number; smoothVFI?: boolean; color?: string; signalColor?: string }
  | { id: string; kind: 'HALF_TREND'; placement: 'overlay'; amplitude: number; channelDeviation: number; color?: string; atrHighColor?: string; atrLowColor?: string }
  | { id: string; kind: 'LINREG_CHANNEL'; placement: 'overlay'; length: number; upperColor?: string; lowerColor?: string; middleColor?: string }
  // --- Community Indicators Batch 2 ---
  | { id: string; kind: 'SUPERTREND_AI'; placement: 'overlay'; atrLen: number; minFactor: number; maxFactor: number; factorStep: number; perfAlpha: number; upColor?: string; downColor?: string }
  | { id: string; kind: 'ORDER_BLOCKS'; placement: 'overlay'; sensitivity: number; mitigationType?: 'Close' | 'Wick'; bullColor?: string; bearColor?: string }
  | { id: string; kind: 'FVG'; placement: 'overlay'; lookback: number; atrMultiplier: number; bullColor?: string; bearColor?: string }
  | { id: string; kind: 'MARKET_CIPHER_B'; placement: 'pane'; wtChannelLen: number; wtAvgLen: number; wtMALen: number; rsiMFIPeriod: number; rsiMFIMult: number; wt1Color?: string; wt2Color?: string; mfiColor?: string }
  | { id: string; kind: 'RANGE_FILTER_DW'; placement: 'overlay'; period: number; mult: number; color?: string; upperColor?: string; lowerColor?: string }
  | { id: string; kind: 'DONCHIAN_RIBBON'; placement: 'pane'; dlen: number; bullColor?: string; bearColor?: string }
  | { id: string; kind: 'TRENDLINES_BREAKS'; placement: 'overlay'; length: number; mult: number; upperColor?: string; lowerColor?: string }
  | { id: string; kind: 'CM_VIX_FIX'; placement: 'pane'; length: number; bbLen: number; bbMult: number; lookbackPct: number; pctHighest: number; color?: string; alertColor?: string }
  // --- Custom formula studies ---
  | CustomFormulaIndicator;

export type OverlayIndicator = ChartIndicator & {
  visible?: boolean;
  offset?: number;
  timeframe?: ChartTimeframe;
  sourceIndicatorId?: string;
  sourcePlotKey?: string;
  presentation?: IndicatorPresentationSettings;
};

export interface VolumeProfileConfig {
  enabled: boolean;
  bucketCount?: number;
  maxWidth?: number;
  pocColor?: string;
  upColor?: string;
  downColor?: string;
  alignment?: 'left' | 'right';
}

export interface VolumeProfileBucket {
  priceTop: number;
  priceBottom: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isPOC: boolean;
}

export interface HeatmapCell {
  barIndex: number;
  priceTop: number;
  priceBottom: number;
  intensity: number; // 0 to 1
}

export interface HeatmapConfig {
  cells: HeatmapCell[];
  colorScale: 'warm' | 'cool' | 'custom';
  minColor?: string;
  maxColor?: string;
  opacity?: number;
}


export interface VolumeProfileConfig {
  enabled: boolean;
  bucketCount?: number;
  maxWidth?: number;
  pocColor?: string;
  upColor?: string;
  downColor?: string;
  alignment?: 'left' | 'right';
}

export interface VolumeProfileBucket {
  priceTop: number;
  priceBottom: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isPOC: boolean;
}

export interface HeatmapCell {
  barIndex: number;
  priceTop: number;
  priceBottom: number;
  intensity: number; // 0 to 1
}

export interface HeatmapConfig {
  cells: HeatmapCell[];
  colorScale: 'warm' | 'cool' | 'custom';
  minColor?: string;
  maxColor?: string;
  opacity?: number;
}

export interface ChartEngineConfig {
  symbol?: string;
  theme: ChartTheme;
  visualSettings: ChartVisualSettings;
  axisWidth?: number;
  leftAxisWidth?: number;
  leftAxisMode?: 'percentage' | 'absolute' | 'custom';
  xAxisHeight?: number;
  volumePct?: number;
  timeframe?: ChartTimeframe;
  chartType?: ChartType;
  futureMarginMode?: FutureMarginMode;
  volumeProfileConfig?: VolumeProfileConfig;
  onCrosshairMove?: (state: CrosshairState) => void;
}

export interface ChartValueLabelSettings {
  showSymbolNameLabel: boolean;
  showSymbolLastPrice: boolean;
  showSymbolPreviousClose: boolean;
  showHighLowPriceLabels: boolean;
  showIndicatorNameLabels: boolean;
  showOverlayIndicatorValues: boolean;
  showCompareValues: boolean;
  showIndicatorPaneValues: boolean;
  noOverlappingLabels: boolean;
}

export const DARK_THEME: ChartTheme = {
  background: '#08111a',
  axisBackground: '#0f1b29',
  axisLabelBackground: '#154f96',
  panelBorder: 'rgba(136, 163, 195, 0.2)',
  gridLine: 'rgba(72, 95, 121, 0.18)',
  gridLineMajor: 'rgba(112, 142, 173, 0.28)',
  axisText: '#9ab0c8',
  crosshair: '#4fa7ff',
  candleUp: '#22c55e',
  candleDown: '#ef4444',
  wickUp: '#4ade80',
  wickDown: '#f87171',
  volumeUp: 'rgba(34, 197, 94, 0.26)',
  volumeDown: 'rgba(239, 68, 68, 0.26)',
  borderColor: '#223247',
  backgroundBottom: '#040a12',
  sessionHighlight: 'rgba(255, 255, 255, 0.015)',
};

export type ChartEventType =
  | 'crosshairMove'
  | 'viewportChange'
  | 'drawingComplete'
  | 'drawingUpdate'
  | 'drawingSelect'
  | 'paneScaleChange'
  | 'axisWidthChange';

export type ChartEventListener = (event: {
  type: ChartEventType;
  crosshair?: CrosshairState;
  viewport?: Viewport;
  drawing?: ChartDrawing;
  drawingId?: string | null;
  paneId?: ChartPaneId;
  paneScaleRange?: PaneScaleRange | null;
  axisWidth?: number;
}) => void;

// --- Signal & Visual Alerts Engine ---
export type SignalConditionType = 'crosses_above' | 'crosses_below' | 'greater_than' | 'less_than';
export type SignalMarkerShape = 'arrow_up' | 'arrow_down' | 'circle' | 'square' | 'cross';
export type SignalMarkerPosition = 'above_bar' | 'below_bar' | 'on_series';

export interface SignalTarget {
  indicatorId?: string;
  plotKey?: string;
  source?: IndicatorSource;
  staticValue?: number;
}

export interface ChartSignalRule {
  id: string;
  label: string;
  enabled: boolean;
  conditionType: SignalConditionType;
  seriesA: SignalTarget;
  seriesB: SignalTarget;
  shape?: SignalMarkerShape;
  color?: string;
  position?: SignalMarkerPosition;
  text?: string;
}

export interface RenderableSignalMarker {
  id: string;
  ruleId: string;
  barIndex: number;
  date: string;
  price: number;
  shape: SignalMarkerShape;
  color: string;
  position: SignalMarkerPosition;
  text?: string;
}

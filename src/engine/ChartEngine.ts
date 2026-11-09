import { buildRenderableIndicators, type RenderableOverlay, type RenderablePane } from './Indicators';
import { computeCrosshair, drawCrosshair } from './Crosshair';
import { computeVolumeProfile } from './VolumeProfile';
import { drawHeatmap } from './Heatmap';
import { precomputeConflation, type ConflationLevel } from './DataConflation';
import { buildScaleX, buildScaleY, clampViewport, getAllowedFutureBars, niceXTicks, niceYTicks, panViewport, zoomViewport } from './ScaleManager';
import {
  drawAxisValueTags,
  computeAxisValueTagsLayout,
  type AxisValueTag,
  type ResolvedAxisValueTag,
  drawArea,
  drawBackgroundZones,
  drawBollingerBand,
  drawBaseline,
  drawBars,
  drawCandles,
  drawRenkoBricks,
  drawDrawing,
  drawEventMarkers,
  drawEventTooltip,
  drawLegendTokens,
  drawGrid,
  drawMeasure,
  drawHistogram,
  drawHLCArea,
  drawLastPriceMarker,
  drawLine,
  drawMarkers,
  drawVolumeProfile,
  type LegendToken,
  measureAxisLabelWidth,
  measurePaneTitleWidth,
  drawPaneTitle,
  drawPoints,
  drawReferenceLines,
  drawSignalMarkers,
  drawVolume,
  drawVerticalGrid,
  drawXAxis,
  drawYAxis,
  getPrecisionFromStep,
  getTextBoxBounds,
  formatSignedValue,
  formatPrice,
  resolveHighContrastText,
  resolveMutedChartText,
  type TextResizeHandle,
  type TextBoxBounds,
} from './Renderer';
import { layoutScannerLabelBoxes } from './ScannerLabelLayout';
import { evaluateSignalRules } from './Signals';
import { isDrawingVisibleOnTimeframe } from './DrawingStyleSchema';
import { getEffectiveDrawingExtendRight } from './DrawingCapabilities';
import { extendInfiniteLineToRect, extendSegmentHorizontally, isHorizontalRayHit } from './DrawingGeometry';
import { calculateRegressionChannel, distanceToEllipseBoundary, pointInTriangle } from './DrawingAdvancedGeometry';
import {
  buildDisjointChannelSegments,
  buildFlatChannelSegments,
  getArcParameters,
  getRequiredMultiAnchorCount,
  getRotatedRectangleCorners,
  isAngleOnArc,
  isMultiAnchorDrawingTool,
  pointInPolygon as pointInDrawingPolygon,
  type MultiAnchorDrawingTool,
} from './DrawingMultiAnchorGeometry';
import { buildD3BHitSegments, isD3BDrawingKind } from './DrawingD3BGeometry';
import {
  buildF1BFibChannelLevels,
  buildF1BFibTimeZoneLevels,
  buildF1BRetracementLevels,
  buildF1BTrendFibExtensionLevels,
  buildF1BTrendFibTimeLevels,
} from './DrawingF1BGeometry';
import {
  buildF1CFibArcsGeometry,
  buildF1CFibCirclesGeometry,
  buildF1CFibWedgeGeometry,
  projectF1CFibWedgeGeometry,
  distanceToF1CFibWedgeLevel,
  isPointInsideF1CFibArcSweep,
  snapFibCirclePointTo45Degrees,
} from './DrawingF1CGeometry';
import { resolveFibonacciLevels, resolveFibonacciOptions } from './DrawingF1BRuntime';

import {
  buildD3CHitSegments,
  buildPositionPixelGeometry,
  isD3CDrawingKind,
  normalizePositionAnchors,
  pointInPositionGeometry,
} from './DrawingD3CGeometry';
import { createDefaultFibonacciSettings, FIB_CIRCLES_DEFAULT_VALUES, FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES, FIB_WEDGE_DEFAULT_VALUES } from './DrawingFibonacciDefaults';
import { isFibonacciToolKind, type FibonacciSpeedResistanceFanSettings } from './DrawingFibonacciContracts';
import { getNormalizedFibonacciSettings } from './DrawingFibonacciMigration';
import {
  buildF1DFibSpiralGeometry,
  buildF1DFibSpiralPerpBasis,
  projectF1DFibSpiralGeometry,
} from './DrawingF1DGeometry';
import {
  buildF1EFibSpeedResistanceFanGeometry,
  hitTestF1EFibSpeedResistanceFan,
} from './DrawingF1EGeometry';
import {
  type ChartTimeframe,
  type ChartCompareOverlay,
  type ChartType,
  type ChartSignalRule,
  ChartEventListener,
  type ChartMarkerEvent,
  type ChartPaneId,
  type CollapsedIndicatorPanes,
  DARK_THEME,
  DEFAULT_CHART_VISUAL_SETTINGS,
  type ChartDrawing,
  type DrawingAnchor,
  type ChartEngineConfig,
  type CrosshairState,
  type DrawingTool,
  type FutureMarginMode,
  type IndicatorPaneHeights,
  type OHLCBar,
  type OverlayIndicator,
  type PaneScaleOverrides,
  type PaneScaleRange,
  type RenkoDrawingAnchor,
  type ScaleX,
  type ScaleY,
  type Viewport,
  type BackgroundZone,
  type ChartTheme,
  type ChartVisualSettings,
  type ChartValueLabelSettings,
  normalizeChartVisualSettings,
} from './types';
import {
  DEFAULT_CHART_VALUE_LABEL_SETTINGS,
  hasPricePaneValueLabels,
  normalizeChartValueLabelSettings,
  setAllChartValueLabelVisibility,
} from './valueLabelSettings';

const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_EXTENSION_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618];
const FIB_FAN_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
const GANN_FAN_FACTORS = [0.125, 0.25, 1 / 3, 0.5, 1, 2, 3, 4, 8];

const MIN_INDICATOR_PANE_HEIGHT = 72;
const MAX_INDICATOR_PANE_HEIGHT = 168;
const COLLAPSED_INDICATOR_PANE_HEIGHT = 32;
export const PRICE_LEGEND_HEIGHT = 48;
export const PRICE_LEGEND_IN_PLOT_CLEARANCE = 34;
export const INDICATOR_LEGEND_HEIGHT = 28;
const INDICATOR_PANE_SCALE_PADDING = 0.12;
export const SHARED_AXIS_WIDTH = 80;
export const PRICE_AXIS_HEADER_HEIGHT = 34;
const DEFAULT_DRAWING_COLOR = '#3b82f6';
const DEFAULT_DRAWING_PREVIEW_COLOR = 'rgba(59, 130, 246, 0.9)';

export interface ChartLayout {
  axisWidth: number;
  leftAxisWidth: number;
  chartWidth: number;
  contentHeight: number;
  priceHeight: number;
  volumeHeight: number;
  paneHeight: number;
  paneHeights: number[];
  paneTops: number[];
  priceAxisGap: number;
}

interface DrawingHitTarget {
  drawing: ChartDrawing;
  mode: 'move' | 'start' | 'end' | 'anchor' | TextResizeHandle;
  anchorOrdinal?: number;
}

interface DrawingDragState {
  drawingId: string;
  mode: 'move' | 'start' | 'end' | 'anchor' | TextResizeHandle;
  anchorOrdinal?: number;
  anchorIndex: number;
  anchorPrice: number;
  baseDrawing: ChartDrawing;
}

interface AxisDragState {
  paneId: ChartPaneId;
  ratio: number;
  range: PaneScaleRange;
  startClientY: number;
  logScale: boolean;
}

interface PaneContext {
  id: ChartPaneId;
  title: string;
  top: number;
  height: number;
  plotHeight: number;
  legendHeight: number;
  collapsed: boolean;
  scaleY: ScaleY;
  kind: 'price' | 'indicator';
  occupiedRanges: Array<{ top: number; bottom: number }>;
}

interface RenderState {
  layout: ChartLayout;
  scaleX: ScaleX;
  xTicks: Array<{ index: number; label: string }>;
  latestVisibleBarIndex: number;
  priceScaleY: ScaleY;
  pricePane: PaneContext;
  panes: PaneContext[];
  compareRenderables: RenderableCompareOverlay[];
  overlayRenderables: RenderableOverlay[];
  indicatorPanes: Array<{ pane: RenderablePane; context: PaneContext }>;
}

interface RenderableCompareOverlay {
  overlay: ChartCompareOverlay;
  title: string;
  color: string;
  normalizedValues: Array<number | null>;
  percentValues: Array<number | null>;
}

interface PointerState {
  renderState: RenderState;
  layout: ChartLayout;
  scaleX: ScaleX;
  pane: PaneContext;
  isInAxis: boolean;
  isInPlot: boolean;
  clampedX: number;
  clampedY: number;
  localY: number;
  barIndex: number;
  price: number;
}

export class ChartEngine {
  private readonly container: HTMLDivElement;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly baseCtx: CanvasRenderingContext2D;
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly listeners = new Set<ChartEventListener>();
  private readonly cleanupFns: Array<() => void> = [];

  private dataConflationEnabled = false;
  private canvasPriceLegendEnabled = true;
  private conflationLevels: ConflationLevel[] = [];
  private bars: OHLCBar[] = [];
  private compareOverlays: ChartCompareOverlay[] = [];
  private overlays: OverlayIndicator[] = [];
  private chartEvents: ChartMarkerEvent[] = [];
  private drawings: ChartDrawing[] = [];
  private scannerLabelBoxes = new Map<string, TextBoxBounds | null>();
  private selectedDrawingId: string | null = null;
  private drawingTool: DrawingTool = 'cursor';
  private symbol = '';
  private backgroundZones: BackgroundZone[] = [];
  private viewport: Viewport = { startIndex: 0, endIndex: 120 };
  private crosshair: CrosshairState = { visible: false, x: 0, y: 0, barIndex: -1, logicalIndex: -1, dateLabel: null, paneId: 'price', paneTop: 0, paneHeight: 0, value: 0, bar: null };
  private pendingAnchorStart: { paneId: ChartPaneId; index: number; price: number } | null = null;
  private fibCircleShiftPreview: { index: number; price: number } | null = null;
  private volumeProfileConfig: import('./types').VolumeProfileConfig | null = null;
  private heatmapConfig: import('./types').HeatmapConfig | null = null;
  private pendingChannelBase: { paneId: ChartPaneId; startIndex: number; startPrice: number; endIndex: number; endPrice: number } | null = null;
  private pendingMultiAnchors: { paneId: ChartPaneId; anchors: DrawingAnchor[] } | null = null;
  private isDirty = true;
  private isOverlayDirty = true;
  private baseRenderCount = 0;
  private overlayRenderCount = 0;
  private renderStateBuildCount = 0;
  private cachedRenderState: RenderState | null = null;
  private cachedRenderStateWidth = 0;
  private cachedRenderStateHeight = 0;
  private isPanning = false;
  private drawingDragState: DrawingDragState | null = null;
  private panStartX = 0;
  private panStartViewport: Viewport = { startIndex: 0, endIndex: 120 };
  private panVelocity = 0;
  private panLastX = 0;
  private panLastTime = 0;
  private kineticAnimationId: number | null = null;
  private rafId: number | null = null;
  private axisWidth: number;
  private leftAxisWidth: number;
  private leftAxisMode: 'percentage' | 'absolute' | 'custom';
  private readonly xAxisHeight: number;
  private volumePct: number;
  private logScale = false;
  private showVolume = true;
  private invertPriceScale = false;
  private valueLabelSettings: ChartValueLabelSettings = DEFAULT_CHART_VALUE_LABEL_SETTINGS;
  private futureMarginMode: FutureMarginMode = 'normal';
  private paneHeightOverrides: IndicatorPaneHeights = {};
  private collapsedIndicatorPanes: CollapsedIndicatorPanes = {};
  private paneScaleOverrides: PaneScaleOverrides = {};
  private magnetEnabled = false;
  private baseTheme: ChartTheme = DARK_THEME;
  private theme: ChartTheme = DARK_THEME;
  private visualSettings: ChartVisualSettings = DEFAULT_CHART_VISUAL_SETTINGS;
  private axisDragState: AxisDragState | null = null;
  private timeframe: ChartTimeframe;
  private chartType: ChartType;
  private signalRules: ChartSignalRule[] = [];
  private gannOverlayCallback: ((ctx: CanvasRenderingContext2D, scaleX: ScaleX, priceScaleY: ScaleY, width: number, height: number) => void) | null = null;
  private pluginOverlayCallbacks = new Map<string, (ctx: CanvasRenderingContext2D, scaleX: ScaleX, priceScaleY: ScaleY, width: number, height: number) => void>();

  registerPluginOverlay(
    id: string,
    callback: (ctx: CanvasRenderingContext2D, scaleX: ScaleX, priceScaleY: ScaleY, width: number, height: number) => void,
  ): () => void {
    this.pluginOverlayCallbacks.set(id, callback);
    this.markDirty();
    return () => this.unregisterPluginOverlay(id);
  }

  unregisterPluginOverlay(id: string): void {
    if (this.pluginOverlayCallbacks.delete(id)) {
      this.markDirty();
    }
  }

  setSignalRules(rules: ChartSignalRule[]): void {
    this.signalRules = rules ?? [];
    this.markDirty();
  }

  /**
   * Registers a callback invoked at the end of every overlay repaint cycle.
   * The callback receives the overlay canvas context and the current coordinate
   * projection functions so external code can draw on top of the chart without
   * needing access to private engine state.
   *
   * Pass `null` to remove a previously registered callback.
   */
  setGannOverlayCallback(
    callback: ((ctx: CanvasRenderingContext2D, scaleX: ScaleX, priceScaleY: ScaleY, width: number, height: number) => void) | null,
  ): void {
    this.gannOverlayCallback = callback;
    this.markDirty();
  }

  setSyncedCrosshairBarIndex(barIndex: number | null): void {
    if (barIndex === null || barIndex < 0 || barIndex >= this.bars.length) {
      if (this.crosshair.visible) {
        this.crosshair = {
          visible: false,
          x: 0,
          y: 0,
          barIndex: -1,
          logicalIndex: -1,
          dateLabel: null,
          paneId: 'price',
          paneTop: 0,
          paneHeight: 0,
          value: 0,
          bar: null,
        };
        this.markOverlayDirty();
      }
      return;
    }
    const bar = this.bars[barIndex];
    if (!bar) return;
    if (this.crosshair.visible && this.crosshair.barIndex === barIndex && this.crosshair.dateLabel === bar.date) return;
    const cx = this.cachedRenderState ? this.cachedRenderState.scaleX.toPixel(barIndex) : 0;
    const cy = this.cachedRenderState ? this.cachedRenderState.priceScaleY.toPixel(bar.close) : 0;
    const ch = this.cachedRenderState ? this.cachedRenderState.pricePane.height : 0;
    this.crosshair = { visible: true, x: cx, y: cy, barIndex, logicalIndex: barIndex, dateLabel: bar.date, paneId: 'price', paneTop: 0, paneHeight: ch, value: bar.close, bar };
    this.markOverlayDirty();
  }

  constructor(container: HTMLDivElement, config: ChartEngineConfig) {
    this.container = container;
    this.symbol = config.symbol ?? '';
    this.baseTheme = config.theme;
    this.visualSettings = normalizeChartVisualSettings(config.visualSettings);
    this.theme = resolveChartTheme(this.baseTheme, this.visualSettings);
    this.axisWidth = config.axisWidth ?? SHARED_AXIS_WIDTH;
    this.leftAxisWidth = config.leftAxisWidth ?? 0;
    this.leftAxisMode = config.leftAxisMode ?? 'percentage';
    this.xAxisHeight = config.xAxisHeight ?? PRICE_AXIS_HEADER_HEIGHT;
    this.volumePct = config.volumePct ?? 0.14;
    this.timeframe = config.timeframe ?? 'D';
    this.chartType = config.chartType ?? 'candles';
    this.futureMarginMode = config.futureMarginMode ?? 'tight';
    this.volumeProfileConfig = config.volumeProfileConfig ?? { enabled: false };

    this.baseCanvas = document.createElement('canvas');
    this.overlayCanvas = document.createElement('canvas');
    this.baseCtx = mustGetContext(this.baseCanvas);
    this.overlayCtx = mustGetContext(this.overlayCanvas);

    [this.baseCanvas, this.overlayCanvas].forEach((canvas, index) => {
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = String(index + 1);
    });
    this.overlayCanvas.style.cursor = 'default';
  }

  mount(): void {
    this.container.style.position = 'relative';
    this.container.append(this.baseCanvas, this.overlayCanvas);
    this.attachListeners();
    this.resize();
    this.startRenderLoop();
  }

  unmount(): void {
    this.cleanupFns.splice(0).forEach((cleanup) => cleanup());
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.kineticAnimationId !== null) {
      cancelAnimationFrame(this.kineticAnimationId);
      this.kineticAnimationId = null;
    }
    this.clearCachedRenderState();
    this.baseCanvas.width = 0;
    this.baseCanvas.height = 0;
    this.overlayCanvas.width = 0;
    this.overlayCanvas.height = 0;
    this.baseCanvas.remove();
    this.overlayCanvas.remove();
    this.listeners.clear();
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    [this.baseCanvas, this.overlayCanvas].forEach((canvas) => {
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = mustGetContext(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    this.markDirty();
  }

  loadBars(bars: OHLCBar[]): void {
    this.bars = bars;
    this.conflationLevels = this.dataConflationEnabled ? precomputeConflation(bars, [2, 4, 8]) : [];
    if (this.bars.length === 0) {
      this.viewport = { startIndex: 0, endIndex: 0 };
      this.markDirty();
      return;
    }

    const previousSpan = this.viewport.endIndex - this.viewport.startIndex;
    const span = previousSpan >= 5 ? previousSpan : Math.min(Math.max(this.bars.length, 5), 120);
    const endIndex = this.bars.length + getAllowedFutureBars(span, this.futureMarginMode);
    this.viewport = clampViewport(
      { startIndex: Math.max(endIndex - span, 0), endIndex },
      this.bars.length,
      5,
      this.futureMarginMode,
    );
    this.markDirty();
  }

  setSymbol(symbol: { symbol: string; exchange: string } | null): void {
    this.symbol = symbol ? `${symbol.exchange}:${symbol.symbol}` : '';
    this.markDirty();
  }

  setBackgroundZones(zones: BackgroundZone[]): void {
    this.backgroundZones = zones;
    this.markDirty();
  }

  setVolumeProfileConfig(config: import('./types').VolumeProfileConfig): void {
    this.volumeProfileConfig = config;
    this.markDirty();
  }

  setHeatmapConfig(config: import('./types').HeatmapConfig | null): void {
    this.heatmapConfig = config;
    this.markDirty();
  }

  setOverlays(overlays: OverlayIndicator[]): void {
    this.overlays = overlays;
    this.markDirty();
  }

  setCompareOverlays(compareOverlays: ChartCompareOverlay[]): void {
    this.compareOverlays = compareOverlays;
    this.markDirty();
  }

  setEvents(events: ChartMarkerEvent[]): void {
    this.chartEvents = events;
    this.markDirty();
  }

  setDrawings(drawings: ChartDrawing[]): void {
    const normalizedDrawings = drawings.map((drawing) =>
      drawing.kind === 'longPosition' || drawing.kind === 'shortPosition'
        ? { ...drawing, anchors: normalizePositionAnchors(drawing.kind, drawing.anchors) }
        : drawing,
    );
    this.drawings = this.chartType === 'renko'
      ? normalizedDrawings.map((drawing) => this.withMissingRenkoAnchors(drawing))
      : normalizedDrawings;
    if (this.selectedDrawingId && !drawings.some((drawing) => drawing.id === this.selectedDrawingId)) {
      this.selectedDrawingId = null;
    }
    this.markDirty();
  }

  setSelectedDrawingId(drawingId: string | null): void {
    this.selectedDrawingId = drawingId;
    this.markDirty();
  }

  pickDrawingAt(offsetX: number, offsetY: number): ChartDrawing | null {
    const pointerState = this.getPointerState(offsetX, offsetY);
    if (!pointerState) {
      return null;
    }

    return this.hitTestDrawing(pointerState)?.drawing ?? null;
  }

  setDrawingTool(tool: DrawingTool): void {
    this.drawingTool = tool;
    this.fibCircleShiftPreview = null;
    if (!isTwoPointDrawingTool(tool) && !isChannelDrawingTool(tool)) {
      this.pendingAnchorStart = null;
    }
    if (!isChannelDrawingTool(tool)) {
      this.pendingChannelBase = null;
    }
    if (!isMultiAnchorDrawingTool(tool)) {
      this.pendingMultiAnchors = null;
    } else {
      // Multi-anchor tools use their own generalized click lifecycle.
      this.pendingAnchorStart = null;
      this.pendingChannelBase = null;
    }
    this.overlayCanvas.style.cursor = resolvePointerCursor(tool);
    this.markOverlayDirty();
  }

  setIndicatorPaneHeights(heights: IndicatorPaneHeights): void {
    this.paneHeightOverrides = { ...heights };
    this.markDirty();
  }

  setCollapsedIndicatorPanes(collapsedIndicatorPanes: CollapsedIndicatorPanes): void {
    this.collapsedIndicatorPanes = { ...collapsedIndicatorPanes };
    this.markDirty();
  }

  setPaneScaleOverrides(overrides: PaneScaleOverrides): void {
    this.paneScaleOverrides = { ...overrides };
    this.markDirty();
  }

  setLogScale(enabled: boolean): void {
    this.logScale = enabled;
    this.markDirty();
  }

  setShowVolume(show: boolean): void {
    this.showVolume = show;
    this.markDirty();
  }

  setInvertPriceScale(enabled: boolean): void {
    this.invertPriceScale = enabled;
    this.markDirty();
  }

  setShowValueLabels(show: boolean): void {
    this.valueLabelSettings = setAllChartValueLabelVisibility(show, this.valueLabelSettings);
    this.markDirty();
  }

  setValueLabelSettings(settings: Partial<ChartValueLabelSettings>): void {
    this.valueLabelSettings = normalizeChartValueLabelSettings({
      ...this.valueLabelSettings,
      ...settings,
    });
    this.markDirty();
  }

  setLeftAxisWidth(width: number): void {
    if (this.leftAxisWidth === width) return;
    this.leftAxisWidth = width;
    this.markDirty();
  }

  setTimeframe(timeframe: ChartTimeframe): void {
    this.timeframe = timeframe;
    this.markDirty();
  }

  setChartType(chartType: ChartType): void {
    this.chartType = chartType;
    if (chartType === 'renko') {
      this.drawings = this.drawings.map((drawing) => this.withMissingRenkoAnchors(drawing));
    }
    this.markDirty();
  }

  setFutureMarginMode(mode: FutureMarginMode): void {
    this.futureMarginMode = mode;
    this.viewport = clampViewport(this.viewport, this.bars.length, 5, this.futureMarginMode);
    this.markDirty();
  }

  setMagnetEnabled(enabled: boolean): void {
    this.magnetEnabled = enabled;
    this.markDirty();
  }

  setCanvasPriceLegendEnabled(enabled: boolean): void {
    if (this.canvasPriceLegendEnabled === enabled) {
      return;
    }

    this.canvasPriceLegendEnabled = enabled;
    this.markDirty();
  }

  captureScreenshot(): HTMLCanvasElement {
    const screenshot = document.createElement('canvas');
    screenshot.width = this.baseCanvas.width;
    screenshot.height = this.baseCanvas.height;
    const context = mustGetContext(screenshot);

    context.drawImage(this.baseCanvas, 0, 0);
    context.drawImage(this.overlayCanvas, 0, 0);

    return screenshot;
  }

  setViewport(viewport: Viewport): void {
    const nextViewport = clampViewport(viewport, this.bars.length, 5, this.futureMarginMode);
    if (
      Math.abs(this.viewport.startIndex - nextViewport.startIndex) < 0.001 &&
      Math.abs(this.viewport.endIndex - nextViewport.endIndex) < 0.001
    ) {
      return;
    }

    this.viewport = nextViewport;
    this.markDirty();
  }

  setTheme(theme: ChartTheme): void {
    this.baseTheme = theme;
    this.theme = resolveChartTheme(this.baseTheme, this.visualSettings);
    this.markDirty();
  }

  setVisualSettings(settings: ChartVisualSettings): void {
    this.visualSettings = normalizeChartVisualSettings(settings);
    this.theme = resolveChartTheme(this.baseTheme, this.visualSettings);
    this.markDirty();
  }

  getAxisWidth(): number {
    return this.axisWidth;
  }

  on(listener: ChartEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private attachListeners(): void {
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);
    this.cleanupFns.push(() => resizeObserver.disconnect());

    const onMouseMove = (event: MouseEvent) => {
      const rect = this.overlayCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const pointerState = this.getPointerState(x, y, rect.width, rect.height);
      if (!pointerState) {
        return;
      }

      this.crosshair = computeCrosshair(
        x,
        pointerState.clampedY,
        this.bars,
        pointerState.scaleX,
        this.viewport,
        pointerState.layout.chartWidth,
        pointerState.layout.contentHeight,
        {
          paneId: pointerState.pane.id,
          paneTop: pointerState.pane.top,
          paneHeight: pointerState.pane.height,
          value: pointerState.price,
          timeframe: this.timeframe,
        },
      );

      if (!pointerState.isInPlot) {
        this.crosshair.visible = false;
      }

      this.emit({ type: 'crosshairMove', crosshair: this.crosshair });

      this.fibCircleShiftPreview =
        this.drawingTool === 'fibCircles' &&
        this.pendingAnchorStart &&
        event.shiftKey &&
        this.pendingAnchorStart.paneId === pointerState.pane.id
          ? this.buildFibCircle45DegreeEndpoint(pointerState)
          : null;

      if (this.axisDragState) {
        const nextRange = this.buildAxisDraggedScaleRange(this.axisDragState, event.clientY);
        if (nextRange) {
          this.paneScaleOverrides = {
            ...this.paneScaleOverrides,
            [this.axisDragState.paneId]: nextRange,
          };
          this.emit({
            type: 'paneScaleChange',
            paneId: this.axisDragState.paneId,
            paneScaleRange: nextRange,
          });
        }
        this.overlayCanvas.style.cursor = 'ns-resize';
        this.markDirty();
        return;
      }

      if (this.drawingDragState) {
        const updatedDrawing = this.buildUpdatedDrawingFromPointer(this.drawingDragState, pointerState);
        if (updatedDrawing) {
          this.emit({ type: 'drawingUpdate', drawing: updatedDrawing });
        }
        this.overlayCanvas.style.cursor = 'grabbing';
        this.markDirty();
        return;
      }

      if (this.isPanning) {
        const now = performance.now();
        const dt = now - this.panLastTime;
        if (dt > 0) {
          const v = (x - this.panLastX) / dt;
          this.panVelocity = this.panVelocity * 0.4 + v * 0.6;
        }
        this.panLastX = x;
        this.panLastTime = now;

        const scaleX = buildScaleX(this.panStartViewport, pointerState.layout.chartWidth);
        this.viewport = panViewport(
          this.panStartViewport,
          x - this.panStartX,
          scaleX,
          this.bars.length,
          this.futureMarginMode,
        );
        this.emit({ type: 'viewportChange', viewport: this.viewport });
        this.overlayCanvas.style.cursor = 'grabbing';
        this.markDirty();
        return;
      }

      if (this.drawingTool === 'cursor' || this.drawingTool === 'crosshair') {
        if (pointerState.isInAxis && pointerState.isInPlot && this.canAdjustPaneScale(pointerState.renderState, pointerState.pane.id)) {
          this.overlayCanvas.style.cursor = 'ns-resize';
        } else {
          const hit = this.hitTestDrawing(pointerState);
          this.overlayCanvas.style.cursor = hit ? resolveDrawingHitCursor(hit.mode) : resolvePointerCursor(this.drawingTool);
        }
      }
      this.markOverlayDirty();
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (this.drawingTool !== 'cursor' && this.drawingTool !== 'crosshair') {
        const drawing = this.buildDrawingFromPointer(event.offsetX, event.offsetY, event.shiftKey);
        if (drawing) {
          this.emit({ type: 'drawingComplete', drawing });
        }
        return;
      }

      const pointerState = this.getPointerState(event.offsetX, event.offsetY);
      if (!pointerState) {
        return;
      }

      if (pointerState.isInAxis) {
        if (pointerState.isInPlot && this.canAdjustPaneScale(pointerState.renderState, pointerState.pane.id)) {
          const range = this.getPaneVisibleRange(pointerState.renderState, pointerState.pane.id);
          if (range) {
            const paneLogScale = pointerState.pane.id === 'price' && this.logScale;
            const paneInvertScale = pointerState.pane.id === 'price' && this.invertPriceScale;
            this.axisDragState = {
              paneId: pointerState.pane.id,
              ratio: this.getPaneScaleAnchorRatio(pointerState.localY, pointerState.pane.plotHeight, paneInvertScale),
              range,
              startClientY: event.clientY,
              logScale: paneLogScale,
            };
            this.overlayCanvas.style.cursor = 'ns-resize';
          }
        }
        return;
      }

      const hit = this.hitTestDrawing(pointerState);
      if (hit) {
        this.selectedDrawingId = hit.drawing.id;
        if (hit.drawing.locked) {
          this.emit({ type: 'drawingSelect', drawingId: hit.drawing.id });
          this.markDirty();
          return;
        }
        this.drawingDragState = {
          drawingId: hit.drawing.id,
          mode: hit.mode,
          anchorOrdinal: hit.anchorOrdinal,
          anchorIndex: pointerState.barIndex,
          anchorPrice: this.snapValue(
            pointerState.barIndex,
            pointerState.price,
            this.getDrawingPaneId(hit.drawing),
            hit.drawing.kind,
          ),
          baseDrawing: hit.drawing,
        };
        this.emit({ type: 'drawingSelect', drawingId: hit.drawing.id });
        this.markDirty();
        return;
      }

      if (this.selectedDrawingId) {
        this.selectedDrawingId = null;
        this.emit({ type: 'drawingSelect', drawingId: null });
      }

      if (!pointerState.isInPlot) {
        return;
      }

      this.isPanning = true;
      this.panStartX = event.offsetX;
      this.panStartViewport = this.viewport;
      this.panLastX = event.offsetX;
      this.panLastTime = performance.now();
      this.panVelocity = 0;
      if (this.kineticAnimationId) {
        cancelAnimationFrame(this.kineticAnimationId);
        this.kineticAnimationId = null;
      }
      this.overlayCanvas.style.cursor = 'grabbing';
    };

    const onMouseUp = () => {
      if (this.isPanning && Math.abs(this.panVelocity) > 0.05) {
        this.startKineticScroll();
      }
      this.isPanning = false;
      this.drawingDragState = null;
      this.axisDragState = null;
      this.overlayCanvas.style.cursor = resolvePointerCursor(this.drawingTool);
      this.markOverlayDirty();
    };

    const onMouseLeave = () => {
      this.isPanning = false;
      this.drawingDragState = null;
      this.axisDragState = null;
      this.crosshair = { visible: false, x: 0, y: 0, barIndex: -1, logicalIndex: -1, dateLabel: null, paneId: 'price', paneTop: 0, paneHeight: 0, value: 0, bar: null };
      this.fibCircleShiftPreview = null;
      this.overlayCanvas.style.cursor = resolvePointerCursor(this.drawingTool);
      this.emit({ type: 'crosshairMove', crosshair: this.crosshair });
      this.markOverlayDirty();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!this.bars.length) {
        return;
      }

      const rect = this.overlayCanvas.getBoundingClientRect();
      const pointerState = this.getPointerState(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
      if (!pointerState) {
        return;
      }

      if (pointerState.isInAxis && pointerState.isInPlot && this.canAdjustPaneScale(pointerState.renderState, pointerState.pane.id)) {
        const currentRange = this.getPaneVisibleRange(pointerState.renderState, pointerState.pane.id);
        if (currentRange) {
          const deltaFactor = Math.pow(1.0015, event.deltaY);
          const nextRange = this.scaleRangeAroundRatio(
            currentRange,
            this.getPaneScaleAnchorRatio(
              pointerState.localY,
              pointerState.pane.plotHeight,
              pointerState.pane.id === 'price' && this.invertPriceScale,
            ),
            deltaFactor,
            pointerState.pane.id === 'price' && this.logScale,
          );
          this.paneScaleOverrides = {
            ...this.paneScaleOverrides,
            [pointerState.pane.id]: nextRange,
          };
          this.emit({ type: 'paneScaleChange', paneId: pointerState.pane.id, paneScaleRange: nextRange });
          this.markDirty();
        }
        return;
      }

      if (event.shiftKey) {
        const deltaPixels = event.deltaX !== 0 ? event.deltaX : event.deltaY;
        this.viewport = panViewport(
          this.viewport,
          deltaPixels,
          pointerState.scaleX,
          this.bars.length,
          this.futureMarginMode,
        );
      } else {
        const pivotIndex = (this.viewport.startIndex + this.viewport.endIndex) / 2;
        const stepCount = Math.max(1, Math.min(4, Math.round(Math.abs(event.deltaY) / 120) || 1));
        const zoomStep = 1.12;
        const factor = event.deltaY < 0 ? Math.pow(zoomStep, stepCount) : Math.pow(1 / zoomStep, stepCount);
        this.viewport = zoomViewport(
          this.viewport,
          pivotIndex,
          factor,
          this.bars.length,
          this.futureMarginMode,
        );
      }

      const nextScaleX = buildScaleX(this.viewport, pointerState.layout.chartWidth);
      this.crosshair = computeCrosshair(
        pointerState.clampedX,
        pointerState.clampedY,
        this.bars,
        nextScaleX,
        this.viewport,
        pointerState.layout.chartWidth,
        pointerState.layout.contentHeight,
        {
          paneId: pointerState.pane.id,
          paneTop: pointerState.pane.top,
          paneHeight: pointerState.pane.height,
          value: pointerState.price,
          timeframe: this.timeframe,
        },
      );

      if (!pointerState.isInPlot) {
        this.crosshair.visible = false;
      }

      this.emit({ type: 'crosshairMove', crosshair: this.crosshair });
      this.emit({ type: 'viewportChange', viewport: this.viewport });
      this.markDirty();
    };

    const onDoubleClick = (event: MouseEvent) => {
      const rect = this.overlayCanvas.getBoundingClientRect();
      const pointerState = this.getPointerState(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
      if (!pointerState) {
        return;
      }

      // 1. Double-click on Price Axis or Indicator Axis -> Auto-fit / Reset vertical scale for that pane
      if (pointerState.isInAxis && this.canAdjustPaneScale(pointerState.renderState, pointerState.pane.id)) {
        if (this.paneScaleOverrides[pointerState.pane.id]) {
          const nextOverrides = { ...this.paneScaleOverrides };
          delete nextOverrides[pointerState.pane.id];
          this.paneScaleOverrides = nextOverrides;
        }
        this.emit({ type: 'paneScaleChange', paneId: pointerState.pane.id, paneScaleRange: null });
        this.markDirty();
        return;
      }

      // 2. Double-click on bottom Date/Time Axis -> Reset horizontal viewport
      const offsetY = event.clientY - rect.top;
      const offsetX = event.clientX - rect.left;
      const isBottomDateAxis =
        offsetY >= pointerState.layout.contentHeight &&
        offsetX >= pointerState.layout.leftAxisWidth &&
        offsetX <= pointerState.layout.leftAxisWidth + pointerState.layout.chartWidth;

      if (isBottomDateAxis) {
        const span = Math.min(Math.max(this.bars.length, 5), 120);
        const endIndex = Math.max(this.bars.length + getAllowedFutureBars(span, this.futureMarginMode), span);
        this.viewport = clampViewport(
          { startIndex: Math.max(endIndex - span, 0), endIndex },
          this.bars.length,
          5,
          this.futureMarginMode,
        );
        this.emit({ type: 'viewportChange', viewport: this.viewport });
        this.markDirty();
        return;
      }

      // 3. Double-click during drawing mode -> cancel pending anchors
      if (this.drawingTool !== 'cursor') {
        this.pendingAnchorStart = null;
        this.pendingChannelBase = null;
        this.pendingMultiAnchors = null;
        this.markDirty();
        return;
      }

      // 4. Double-click on Text drawing is handled by inline editor
      if (this.hitTestDrawing(pointerState)?.drawing.kind === 'text') {
        return;
      }

      // 5. Double-click on main chart body (candles / canvas) -> Do not reset viewport
    };

    this.overlayCanvas.addEventListener('mousemove', onMouseMove);
    this.overlayCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    this.overlayCanvas.addEventListener('mouseleave', onMouseLeave);
    this.overlayCanvas.addEventListener('wheel', onWheel, { passive: false });
    this.overlayCanvas.addEventListener('dblclick', onDoubleClick);

    this.cleanupFns.push(() => this.overlayCanvas.removeEventListener('mousemove', onMouseMove));
    this.cleanupFns.push(() => this.overlayCanvas.removeEventListener('mousedown', onMouseDown));
    this.cleanupFns.push(() => window.removeEventListener('mouseup', onMouseUp));
    this.cleanupFns.push(() => this.overlayCanvas.removeEventListener('mouseleave', onMouseLeave));
    this.cleanupFns.push(() => this.overlayCanvas.removeEventListener('wheel', onWheel));
    this.cleanupFns.push(() => this.overlayCanvas.removeEventListener('dblclick', onDoubleClick));
  }

  private startRenderLoop(): void {
    const tick = () => {
      if (this.isDirty) {
        this.renderBase();
        this.isDirty = false;
        this.isOverlayDirty = true;
      }
      if (this.isOverlayDirty) {
        this.renderOverlay();
        this.isOverlayDirty = false;
      }
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private getActiveConflation(): { bars: OHLCBar[]; factor: number } {
    if (!this.dataConflationEnabled) return { bars: this.bars, factor: 1 };
    const visibleBars = this.viewport.endIndex - this.viewport.startIndex;
    if (visibleBars > 2000 && this.conflationLevels[2]) {
      return { bars: this.conflationLevels[2].bars, factor: 8 };
    }
    if (visibleBars > 1000 && this.conflationLevels[1]) {
      return { bars: this.conflationLevels[1].bars, factor: 4 };
    }
    if (visibleBars > 500 && this.conflationLevels[0]) {
      return { bars: this.conflationLevels[0].bars, factor: 2 };
    }
    return { bars: this.bars, factor: 1 };
  }

  private renderBase(): void {
    this.baseRenderCount += 1;
    this.scannerLabelBoxes.clear();
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    this.baseCtx.clearRect(0, 0, width, height);
    this.baseCtx.fillStyle = this.theme.background;
    this.baseCtx.fillRect(0, 0, width, height);

    if (this.bars.length === 0) {
      this.clearCachedRenderState();
      const layout = computeChartLayout(
        width,
        height,
        this.axisWidth,
        this.leftAxisWidth,
        this.xAxisHeight,
        0,
        [],
      );
      const axisX = width - layout.axisWidth - layout.priceAxisGap;

      this.baseCtx.fillStyle = this.theme.axisBackground;
      this.baseCtx.fillRect(Math.floor(axisX), 0, Math.ceil(layout.axisWidth), layout.priceHeight);
      this.baseCtx.strokeStyle = this.theme.panelBorder;
      this.baseCtx.lineWidth = 1;
      this.baseCtx.beginPath();
      this.baseCtx.moveTo(Math.floor(axisX) + 0.5, 0);
      this.baseCtx.lineTo(Math.floor(axisX) + 0.5, layout.priceHeight);
      this.baseCtx.stroke();

      if (layout.leftAxisWidth > 0) {
        this.baseCtx.fillStyle = this.theme.axisBackground;
        this.baseCtx.fillRect(0, 0, Math.ceil(layout.leftAxisWidth), layout.priceHeight);
        this.baseCtx.beginPath();
        this.baseCtx.moveTo(Math.floor(layout.leftAxisWidth) - 0.5, 0);
        this.baseCtx.lineTo(Math.floor(layout.leftAxisWidth) - 0.5, layout.priceHeight);
        this.baseCtx.stroke();
      }

      drawXAxis(
        this.baseCtx,
        [],
        buildScaleX({ startIndex: 0, endIndex: 1 }, layout.chartWidth),
        width,
        height,
        this.theme,
        this.xAxisHeight,
      );

      const centerX = layout.leftAxisWidth + layout.chartWidth / 2;
      const centerY = layout.priceHeight / 2;

      this.baseCtx.fillStyle = '#546e7a';
      this.baseCtx.font = '12px "Segoe UI", sans-serif';
      this.baseCtx.textAlign = 'center';
      this.baseCtx.textBaseline = 'middle';
      this.baseCtx.fillText('No chart data loaded', centerX, centerY);
      this.baseCtx.textAlign = 'start';
      this.baseCtx.textBaseline = 'alphabetic';
      return;
    }

    const { bars: renderBars, factor: conflationFactor } = this.getActiveConflation();
    const renderViewport = {
      startIndex: this.viewport.startIndex / conflationFactor,
      endIndex: this.viewport.endIndex / conflationFactor,
    };
    const renderState = this.getRenderState(width, height);
    this.cacheRenderState(renderState, width, height);
    const { layout, scaleX, xTicks, priceScaleY, pricePane, compareRenderables, overlayRenderables, indicatorPanes } = renderState;

    const volumeOverlayHeight = Math.min(layout.volumeHeight, pricePane.plotHeight);
    const volumeOverlayTop = Math.max(pricePane.plotHeight - volumeOverlayHeight, 0);

    const axisX = width - layout.axisWidth - layout.priceAxisGap;

    // Draw Price Pane Axis Background (full height)
    this.baseCtx.fillStyle = this.theme.axisBackground;
    this.baseCtx.fillRect(Math.floor(axisX), 0, Math.ceil(layout.axisWidth), layout.priceHeight);
    this.baseCtx.strokeStyle = this.theme.panelBorder;
    this.baseCtx.lineWidth = 1;
    this.baseCtx.beginPath();
    this.baseCtx.moveTo(Math.floor(axisX) + 0.5, 0);
    this.baseCtx.lineTo(Math.floor(axisX) + 0.5, layout.priceHeight);
    this.baseCtx.stroke();

    if (layout.leftAxisWidth > 0) {
      this.baseCtx.fillStyle = this.theme.axisBackground;
      this.baseCtx.fillRect(0, 0, Math.ceil(layout.leftAxisWidth), layout.priceHeight);
      this.baseCtx.beginPath();
      this.baseCtx.moveTo(Math.floor(layout.leftAxisWidth) - 0.5, 0);
      this.baseCtx.lineTo(Math.floor(layout.leftAxisWidth) - 0.5, layout.priceHeight);
      this.baseCtx.stroke();
    }

    this.baseCtx.save();
    // Clip chart content to plot area
    this.baseCtx.save();
    this.baseCtx.translate(layout.leftAxisWidth, pricePane.legendHeight);
    this.baseCtx.beginPath();
    this.baseCtx.rect(0, 0, layout.chartWidth, pricePane.plotHeight);
    this.baseCtx.clip();

    const renderScaleX = buildScaleX(renderViewport, layout.chartWidth);

    // --- Background Zones (before grid) ---
    if (this.backgroundZones.length > 0) {
      drawBackgroundZones(this.baseCtx, this.backgroundZones, renderViewport, renderScaleX, pricePane.plotHeight);
    }

    drawGrid(this.baseCtx, layout.chartWidth, pricePane.plotHeight, priceScaleY, this.theme);
    drawVerticalGrid(this.baseCtx, xTicks, scaleX, pricePane.plotHeight, this.theme);

    if (this.visualSettings.watermarkVisible && this.symbol) {
      this.drawWatermark(this.baseCtx, layout.chartWidth, pricePane.plotHeight);
    }
    
    // --- Volume Profile (before candles) ---
    if (this.volumeProfileConfig?.enabled) {
      const vpBuckets = computeVolumeProfile(
        renderBars,
        Math.floor(renderViewport.startIndex),
        Math.ceil(renderViewport.endIndex),
        this.volumeProfileConfig.bucketCount ?? 24,
      );
      drawVolumeProfile(
        this.baseCtx,
        vpBuckets,
        priceScaleY,
        layout.chartWidth,
        this.volumeProfileConfig,
      );
    }

    if (this.heatmapConfig && this.heatmapConfig.cells.length > 0) {
      // Heatmap uses original un-conflated indices, need to scale them or disable heatmap during conflation.
      // For now, let's just pass renderViewport and let it stretch.
      drawHeatmap(this.baseCtx, this.heatmapConfig.cells, renderViewport, renderScaleX, priceScaleY, this.heatmapConfig);
    }

    if (volumeOverlayHeight > 0) {
      drawVolume(this.baseCtx, renderBars, renderViewport, renderScaleX, volumeOverlayHeight, volumeOverlayTop, this.theme);
    }
    if (this.chartType === 'line') {
      drawLine(
        this.baseCtx,
        renderBars.map((b) => b.close),
        renderViewport,
        renderScaleX,
        priceScaleY,
        this.theme.candleUp,
        1.8,
      );
    } else if (this.chartType === 'area') {
      drawArea(
        this.baseCtx,
        renderBars.map((b) => b.close),
        renderViewport,
        renderScaleX,
        priceScaleY,
        this.theme.candleUp,
        'rgba(34, 197, 94, 0.25)',
        'rgba(34, 197, 94, 0.0)',
        1.8,
        pricePane.plotHeight,
      );
    } else if (this.chartType === 'bar') {
      drawBars(this.baseCtx, renderBars, renderViewport, renderScaleX, priceScaleY, this.theme);
    } else if (this.chartType === 'baseline') {
      const baselinePrice = renderBars[0]?.close ?? 0;
      drawBaseline(
        this.baseCtx,
        renderBars.map((b) => b.close),
        renderViewport,
        renderScaleX,
        priceScaleY,
        baselinePrice,
        'rgba(34, 197, 94, 0.15)',
        'rgba(239, 68, 68, 0.15)',
        1.8,
        pricePane.plotHeight,
      );
    } else if (this.chartType === 'hlcArea') {
      drawHLCArea(this.baseCtx, renderBars, renderViewport, renderScaleX, priceScaleY, this.theme);
    } else if (this.chartType === 'renko') {
      drawRenkoBricks(this.baseCtx, renderBars, renderViewport, renderScaleX, priceScaleY, this.theme);
    } else {
      drawCandles(this.baseCtx, renderBars, renderViewport, renderScaleX, priceScaleY, this.theme);
    }
    compareRenderables.forEach((compare) => {
      drawLine(
        this.baseCtx,
        compare.normalizedValues,
        this.viewport,
        scaleX,
        priceScaleY,
        compare.color,
        1.6,
      );
    });
    overlayRenderables.forEach((overlay) => {
      const band = overlay.band;
      if (band && band.visible !== false) {
        drawBollingerBand(
          this.baseCtx,
          band.upper,
          band.lower,
          this.viewport,
          scaleX,
          priceScaleY,
          band.color,
        );
      }
      overlay.lines.forEach((line) => {
        drawLine(
          this.baseCtx,
          line.values,
          this.viewport,
          scaleX,
          priceScaleY,
          line.color,
          line.lineWidth ?? 1.5,
          line.lineStyle,
          line.plotStyle,
          line.opacity,
          line.colorValues,
        );
      });
      if (overlay.points) {
        drawPoints(
          this.baseCtx,
          overlay.points.values,
          this.viewport,
          scaleX,
          priceScaleY,
          overlay.points.color,
          overlay.points.radius,
        );
      }
      if (overlay.markers?.length) {
        drawMarkers(
          this.baseCtx,
          overlay.markers,
          this.bars,
          this.viewport,
          scaleX,
          priceScaleY,
          pricePane.plotHeight,
          this.crosshair.visible ? this.crosshair.barIndex : null,
        );
      }
    });

    if (this.signalRules.length > 0) {
      const bundle = buildRenderableIndicators(renderBars, this.overlays);
      const signalMarkers = evaluateSignalRules(renderBars, bundle, this.signalRules);
      if (signalMarkers.length > 0) {
        drawSignalMarkers(
          this.baseCtx,
          signalMarkers,
          (barIdx) => renderScaleX.toPixel(barIdx),
          (price) => priceScaleY.toPixel(price),
        );
      }
    }
    this.prepareScannerLabelBoxes(pricePane.id, scaleX, priceScaleY, layout.chartWidth, pricePane.plotHeight);
    this.drawings
      .filter((drawing) => this.shouldRenderDrawingInPane(drawing, pricePane.id))
      .forEach((drawing) => {
        const renderDrawing = this.resolveDrawingForCurrentChart(drawing);
        drawDrawing(
          this.baseCtx,
          renderDrawing,
          this.viewport,
          scaleX,
          priceScaleY,
          layout.chartWidth,
          pricePane.plotHeight,
          drawing.id === this.selectedDrawingId,
          this.bars,
        );
      });
    drawEventMarkers(
      this.baseCtx,
      this.buildEventMarkers(scaleX, pricePane.plotHeight),
      pricePane.plotHeight,
      this.theme,
    );
    this.baseCtx.restore();

    this.baseCtx.save();
    this.baseCtx.translate(0, pricePane.legendHeight);
    drawLastPriceMarker(
      this.baseCtx,
      this.bars[this.bars.length - 1].close,
      this.bars[this.bars.length - 1].prevClose,
      priceScaleY,
      width,
      this.theme,
      layout.axisWidth,
    );

    let pricePaneTags: ResolvedAxisValueTag[] = [];
    if (hasPricePaneValueLabels(this.valueLabelSettings)) {
      pricePaneTags = computeAxisValueTagsLayout(
        this.buildPriceValueTags(renderState),
        pricePane.plotHeight,
        layout.axisWidth,
        this.valueLabelSettings.noOverlappingLabels,
      );
    }
    const priceOccupiedRanges = pricePaneTags.map((tag) => ({ top: tag.top, bottom: tag.top + tag.height }));

    drawYAxis(
      this.baseCtx,
      width,
      pricePane.plotHeight,
      priceScaleY,
      this.theme,
      layout.axisWidth,
      layout.priceAxisGap,
      0,
      Boolean(this.paneScaleOverrides.price),
      this.logScale,
      false, // drawBackground = false
      priceOccupiedRanges,
      'right',
      2,
    );

    if (layout.leftAxisWidth > 0) {
      drawYAxis(
        this.baseCtx,
        width,
        pricePane.plotHeight,
        priceScaleY,
        this.theme,
        layout.leftAxisWidth,
        0, // gap
        0,
        Boolean(this.paneScaleOverrides.price),
        this.logScale,
        false, // background drawn separately
        [], // no occupied ranges for left axis yet
        'left',
        2,
      );
    }

    if (hasPricePaneValueLabels(this.valueLabelSettings)) {
      drawAxisValueTags(
        this.baseCtx,
        pricePaneTags,
        width,
        layout.axisWidth,
        layout.priceAxisGap,
      );
    }
    this.baseCtx.restore();
    this.baseCtx.restore();

    indicatorPanes.forEach(({ pane, context }) => {
      this.baseCtx.save();
      this.baseCtx.translate(0, context.top);
      if (context.collapsed) {
        this.drawCollapsedPaneChrome(this.baseCtx, width, layout, context);
        this.baseCtx.restore();
        return;
      }

      // Indicator Axis Background
      this.baseCtx.fillStyle = this.theme.axisBackground;
      this.baseCtx.fillRect(Math.floor(axisX), 0, Math.ceil(layout.axisWidth), context.height);
      this.baseCtx.strokeStyle = this.theme.panelBorder;
      this.baseCtx.lineWidth = 1;
      this.baseCtx.beginPath();
      this.baseCtx.moveTo(Math.floor(axisX) + 0.5, 0);
      this.baseCtx.lineTo(Math.floor(axisX) + 0.5, context.height);
      this.baseCtx.stroke();

      this.baseCtx.save();
      this.baseCtx.translate(layout.leftAxisWidth, context.legendHeight);
      this.baseCtx.beginPath();
      this.baseCtx.rect(0, 0, layout.chartWidth, context.plotHeight);
      this.baseCtx.clip();

      drawGrid(this.baseCtx, layout.chartWidth, context.plotHeight, context.scaleY, this.theme);
      drawVerticalGrid(this.baseCtx, xTicks, scaleX, context.plotHeight, this.theme);
      if (pane.referenceLines?.length) {
        drawReferenceLines(this.baseCtx, pane.referenceLines, layout.chartWidth, context.scaleY, 'rgba(147, 163, 182, 0.35)');
      }
      if (pane.histogram) {
        drawHistogram(
          this.baseCtx,
          pane.histogram.values,
          this.viewport,
          scaleX,
          context.scaleY,
          pane.histogram.positiveColor,
          pane.histogram.negativeColor,
          pane.histogram.colorValues,
        );
      }
      pane.lines.forEach((line) => {
        drawLine(
          this.baseCtx,
          line.values,
          this.viewport,
          scaleX,
          context.scaleY,
          line.color,
          line.lineWidth ?? 1.4,
          line.lineStyle,
          line.plotStyle,
          line.opacity,
          line.colorValues,
        );
      });
      this.prepareScannerLabelBoxes(context.id, scaleX, context.scaleY, layout.chartWidth, context.plotHeight);
      this.drawings
        .filter((drawing) => this.shouldRenderDrawingInPane(drawing, context.id))
        .forEach((drawing) => {
          const renderDrawing = this.resolveDrawingForCurrentChart(drawing);
          drawDrawing(
            this.baseCtx,
            renderDrawing,
            this.viewport,
            scaleX,
            context.scaleY,
            layout.chartWidth,
            context.plotHeight,
            drawing.id === this.selectedDrawingId,
            this.bars,
          );
        });
      this.baseCtx.restore();

      this.baseCtx.save();
      this.baseCtx.translate(0, context.legendHeight);

      let indicatorPaneTags: ResolvedAxisValueTag[] = [];
      if (this.valueLabelSettings.showIndicatorPaneValues) {
        indicatorPaneTags = computeAxisValueTagsLayout(
          this.buildIndicatorValueTags(pane, context, renderState.latestVisibleBarIndex),
          context.plotHeight,
          layout.axisWidth,
          this.valueLabelSettings.noOverlappingLabels,
        );
      }
      const indicatorOccupiedRanges = indicatorPaneTags.map((tag) => ({ top: tag.top, bottom: tag.top + tag.height }));

      drawYAxis(
        this.baseCtx,
        width,
        context.plotHeight,
        context.scaleY,
        this.theme,
        layout.axisWidth,
        layout.priceAxisGap,
        0,
        Boolean(this.paneScaleOverrides[pane.indicator.id] ?? pane.fixedRange),
        false,
        false, // drawBackground = false
        indicatorOccupiedRanges,
      );

      if (this.valueLabelSettings.showIndicatorPaneValues) {
        drawAxisValueTags(
          this.baseCtx,
          indicatorPaneTags,
          width,
          layout.axisWidth,
          layout.priceAxisGap,
        );
      }
      this.baseCtx.restore();
      drawPaneTitle(this.baseCtx, pane.title, layout.chartWidth, this.theme);
      this.baseCtx.restore();
    });

    this.drawings
      .filter((drawing) => drawing.kind === 'vline' && isDrawingVisibleOnTimeframe(drawing, this.timeframe))
      .forEach((drawing) => {
        const renderDrawing = this.resolveDrawingForCurrentChart(drawing);
        drawDrawing(
          this.baseCtx,
          renderDrawing,
          this.viewport,
          scaleX,
          priceScaleY,
          layout.chartWidth,
          layout.contentHeight,
          drawing.id === this.selectedDrawingId,
          this.bars,
        );
      });

    this.baseCtx.save();
    this.baseCtx.translate(layout.leftAxisWidth, 0);
    drawXAxis(
      this.baseCtx,
      xTicks,
      scaleX,
      layout.chartWidth,
      height,
      this.theme,
      this.xAxisHeight,
    );
    this.baseCtx.restore();
  }

  private renderOverlay(): void {
    this.overlayRenderCount += 1;
    const rect = this.container.getBoundingClientRect();
    this.overlayCtx.clearRect(0, 0, rect.width, rect.height);
    if (!this.bars.length) {
      return;
    }

    const renderState = this.getCachedOrFreshRenderState(rect.width, rect.height);
    const { layout, scaleX, priceScaleY } = renderState;
    const activePane = this.findPaneContext(renderState, this.crosshair.paneId) ?? renderState.pricePane;
    const valueIndex = this.getActiveValueIndex(renderState);

    this.overlayCtx.save();
    this.overlayCtx.translate(layout.leftAxisWidth, 0);

    const shouldDrawCrosshair =
      this.visualSettings.crosshairVisible &&
      this.crosshair.visible &&
      this.drawingTool !== 'cursor' &&
      this.drawingTool !== 'hline';

    if (shouldDrawCrosshair) {
      drawCrosshair(
        this.overlayCtx,
        this.crosshair,
        layout.chartWidth + layout.axisWidth, // The crosshair will use this as width.
        rect.height,
        this.theme,
        layout.axisWidth,
        this.xAxisHeight,
        0, // Pass 0 to allow vertical line to span full height; legends will cover it.
        activePane.occupiedRanges,
        layout.leftAxisWidth
      );
    }

    if (this.crosshair.visible) {
      const hoveredMarkers = this.buildEventMarkers(scaleX, renderState.pricePane.plotHeight).filter(
        (marker) => marker.barIndex === this.crosshair.barIndex,
      );
      drawEventTooltip(
        this.overlayCtx,
        hoveredMarkers,
        layout.chartWidth,
        rect.height,
        this.xAxisHeight,
        this.theme,
      );
    }

    if (this.canvasPriceLegendEnabled) {
      this.drawPriceOverlayLegend(this.overlayCtx, renderState, valueIndex);
    }
    this.drawIndicatorPaneLegends(this.overlayCtx, renderState, valueIndex);

    if (this.drawingTool === 'hline' && this.crosshair.visible) {
      const preview = this.buildHorizontalLineFromCrosshair();
      if (preview) {
        this.drawDrawingInPane(this.overlayCtx, preview, activePane, scaleX, layout);
      }
    }

    if (this.drawingTool === 'vline' && this.crosshair.visible) {
      const preview = this.buildVerticalLineFromCrosshair();
      if (preview) {
        drawDrawing(this.overlayCtx, preview, this.viewport, scaleX, priceScaleY, layout.chartWidth, layout.contentHeight, false, this.bars);
      }
    }

    if ((this.drawingTool === 'horizontalRay' || this.drawingTool === 'crossLine' || this.drawingTool === 'arrowMarker' || this.drawingTool === 'arrowUp' || this.drawingTool === 'arrowDown') && this.crosshair.visible) {
      const preview = this.buildPointDrawingFromCrosshair(this.drawingTool);
      if (preview) {
        const previewPane = this.findPaneContext(renderState, this.getDrawingPaneId(preview));
        if (previewPane) {
          this.drawDrawingInPane(this.overlayCtx, preview, previewPane, scaleX, layout);
        }
      }
    }

    if (isTwoPointDrawingTool(this.drawingTool) && this.pendingAnchorStart && this.crosshair.visible) {
      const preview = this.buildAnchoredDrawingPreview(this.drawingTool as Extract<DrawingTool, 'trendline' | 'extendedLine' | 'infoLine' | 'trendAngle' | 'priceRange' | 'dateRange' | 'regressionTrend' | 'fibTimeZone' | 'fibCircles' | 'fibSpiral' | 'fibArcs' | 'gannBox' | 'circle' | 'ellipse' | 'forecast' | 'ray' | 'arrow' | 'rect' | 'fib' | 'fibExtension' | 'fibFan' | 'gann' | 'measure'>);
      if (preview) {
        const previewPane = this.findPaneContext(renderState, this.getDrawingPaneId(preview));
        if (previewPane) {
          this.drawDrawingInPane(this.overlayCtx, preview, previewPane, scaleX, layout);
        }
      }
    }

    if (isMultiAnchorDrawingTool(this.drawingTool) && this.pendingMultiAnchors && this.crosshair.visible) {
      const preview = this.buildMultiAnchorDrawingPreview(this.drawingTool);
      if (preview) {
        const previewPane = this.findPaneContext(renderState, this.getDrawingPaneId(preview));
        if (previewPane) {
          this.drawDrawingInPane(this.overlayCtx, preview, previewPane, scaleX, layout);
        }
      }
    }

    if (this.drawingTool === 'channel' && this.crosshair.visible) {
      if (this.pendingChannelBase) {
        const preview = this.createChannelDrawing(
          this.pendingChannelBase.startIndex,
          this.pendingChannelBase.startPrice,
          this.pendingChannelBase.endIndex,
          this.pendingChannelBase.endPrice,
          this.computeChannelOffset(this.pendingChannelBase, this.crosshair.barIndex, this.crosshair.value),
          this.pendingChannelBase.paneId,
          true,
        );
        if (this.pendingChannelBase.paneId === this.crosshair.paneId) {
          const previewPane = this.findPaneContext(renderState, this.pendingChannelBase.paneId);
          if (previewPane) {
            this.drawDrawingInPane(this.overlayCtx, preview, previewPane, scaleX, layout);
          }
        }
      } else if (this.pendingAnchorStart && this.pendingAnchorStart.paneId === this.crosshair.paneId) {
        const preview = this.createAnchoredDrawing(
          'trendline',
          this.pendingAnchorStart.index,
          this.pendingAnchorStart.price,
          this.crosshair.barIndex,
          this.snapValue(
            this.crosshair.barIndex,
            this.crosshair.value,
            this.pendingAnchorStart.paneId,
            'trendline',
          ),
          this.pendingAnchorStart.paneId,
          true,
        );
        const previewPane = this.findPaneContext(renderState, this.pendingAnchorStart.paneId);
        if (previewPane) {
          this.drawDrawingInPane(this.overlayCtx, preview, previewPane, scaleX, layout);
        }
      }
    }

    if (this.gannOverlayCallback) {
      this.overlayCtx.save();
      this.overlayCtx.beginPath();
      this.overlayCtx.rect(0, 0, layout.chartWidth, renderState.pricePane.plotHeight);
      this.overlayCtx.clip();
      this.gannOverlayCallback(
        this.overlayCtx,
        scaleX,
        priceScaleY,
        layout.chartWidth,
        renderState.pricePane.plotHeight,
      );
      this.overlayCtx.restore();
    }
    if (this.pluginOverlayCallbacks.size > 0) {
      for (const callback of this.pluginOverlayCallbacks.values()) {
        this.overlayCtx.save();
        this.overlayCtx.beginPath();
        this.overlayCtx.rect(0, 0, layout.chartWidth, renderState.pricePane.plotHeight);
        this.overlayCtx.clip();
        callback(
          this.overlayCtx,
          scaleX,
          priceScaleY,
          layout.chartWidth,
          renderState.pricePane.plotHeight,
        );
        this.overlayCtx.restore();
      }
    }

    this.overlayCtx.restore();
  }

  private drawCollapsedPaneChrome(
    ctx: CanvasRenderingContext2D,
    width: number,
    layout: ChartLayout,
    context: PaneContext,
  ): void {
    const axisX = width - layout.axisWidth - layout.priceAxisGap;
    ctx.fillStyle = 'rgba(8, 14, 22, 0.34)';
    ctx.fillRect(0, 0, layout.chartWidth, context.height);
    ctx.fillStyle = this.theme.axisBackground;
    ctx.fillRect(axisX, 0, layout.axisWidth, context.height);
    ctx.strokeStyle = this.theme.panelBorder;
    ctx.beginPath();
    ctx.moveTo(axisX + 0.5, 0);
    ctx.lineTo(axisX + 0.5, context.height);
    ctx.moveTo(axisX, 0.5);
    ctx.lineTo(width, 0.5);
    ctx.moveTo(0, context.height - 0.5);
    ctx.lineTo(width, context.height - 0.5);
    ctx.stroke();
    drawPaneTitle(ctx, context.title, layout.chartWidth, this.theme);
  }

  private markDirty(): void {
    this.isDirty = true;
    this.isOverlayDirty = true;
    this.clearCachedRenderState();
  }

  public markOverlayDirty(): void {
    this.isOverlayDirty = true;
  }
  public flushRenderFrame(): void {
    if (this.isDirty) { this.renderBase(); this.isDirty = false; this.isOverlayDirty = true; }
    if (this.isOverlayDirty) { this.renderOverlay(); this.isOverlayDirty = false; }
  }
  public getRenderDiagnostics() {
    return { baseRenderCount: this.baseRenderCount, overlayRenderCount: this.overlayRenderCount, renderStateBuildCount: this.renderStateBuildCount, isBaseDirty: this.isDirty, isOverlayDirty: this.isOverlayDirty };
  }

  private getCachedOrFreshRenderState(width: number, height: number): RenderState {
    if (
      this.cachedRenderState &&
      !this.isDirty &&
      this.cachedRenderStateWidth === width &&
      this.cachedRenderStateHeight === height
    ) {
      return this.cachedRenderState;
    }

    const renderState = this.getRenderState(width, height);
    this.cacheRenderState(renderState, width, height);
    return renderState;
  }

  private cacheRenderState(renderState: RenderState, width: number, height: number): void {
    this.cachedRenderState = renderState;
    this.cachedRenderStateWidth = width;
    this.cachedRenderStateHeight = height;
  }

  private clearCachedRenderState(): void {
    this.cachedRenderState = null;
    this.cachedRenderStateWidth = 0;
    this.cachedRenderStateHeight = 0;
  }

  private emit(event: {
    type: 'crosshairMove' | 'viewportChange' | 'drawingComplete' | 'drawingUpdate' | 'drawingSelect' | 'paneScaleChange' | 'axisWidthChange';
    crosshair?: CrosshairState;
    viewport?: Viewport;
    drawing?: ChartDrawing;
    drawingId?: string | null;
    paneId?: ChartPaneId;
    paneScaleRange?: PaneScaleRange | null;
    axisWidth?: number;
  }): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private getRenderState(width: number, height: number): RenderState {
    let nextAxisWidth = this.axisWidth;
    let renderState = this.buildRenderState(width, height, nextAxisWidth);

    for (let pass = 0; pass < 2; pass += 1) {
      const measuredAxisWidth = this.measureDynamicAxisWidth(renderState);
      if (measuredAxisWidth === nextAxisWidth) {
        break;
      }
      nextAxisWidth = measuredAxisWidth;
      renderState = this.buildRenderState(width, height, nextAxisWidth);
    }

    if (nextAxisWidth !== this.axisWidth) {
      this.axisWidth = nextAxisWidth;
      setTimeout(() => {
        this.emit({ type: 'axisWidthChange', axisWidth: nextAxisWidth });
      }, 0);
    }

    return renderState;
  }

  private buildRenderState(width: number, height: number, axisWidth: number): RenderState {
    this.renderStateBuildCount += 1;
    const renderableIndicators = buildRenderableIndicators(this.bars, this.overlays);
    const compareRenderables = this.buildCompareRenderables();
    const effectiveVolumePct = this.showVolume ? this.volumePct : 0;
    const layout = computeChartLayout(
      width,
      height,
      axisWidth,
      this.leftAxisWidth,
      this.xAxisHeight,
      effectiveVolumePct,
      renderableIndicators.panes.map((pane) => pane.indicator.id),
      this.paneHeightOverrides,
      this.collapsedIndicatorPanes,
    );
    const scaleX = buildScaleX(this.viewport, layout.chartWidth);
    const priceSeries = renderableIndicators.overlays.flatMap((overlay) => {
      const series = overlay.lines.map((line) => line.values);
      const band = overlay.band;
      if (band && band.visible !== false) {
        series.push(band.upper, band.lower);
      }
      if (overlay.points) {
        series.push(overlay.points.values);
      }
      return series;
    });
    compareRenderables.forEach((compare) => {
      priceSeries.push(compare.normalizedValues);
    });
    const priceLegendHeight = this.canvasPriceLegendEnabled ? PRICE_LEGEND_HEIGHT : 0;
    const pricePlotHeight = Math.max(layout.priceHeight - priceLegendHeight, 1);
    const priceTopPad = this.canvasPriceLegendEnabled ? 0.05 : computePriceLegendTopPadding(pricePlotHeight);
    const priceScaleY = buildScaleY(
      this.bars,
      this.viewport.startIndex,
      this.viewport.endIndex,
      pricePlotHeight,
      priceTopPad,
      0.05,
      priceSeries,
      this.paneScaleOverrides.price,
      this.logScale,
      Boolean(this.paneScaleOverrides.price),
      this.invertPriceScale,
      this.chartType === 'line',
    );
    const latestVisibleBarIndex = this.getLatestVisibleBarIndex();
    const pricePane: PaneContext = {
      id: 'price',
      title: 'Price',
      top: 0,
      height: layout.priceHeight,
      plotHeight: pricePlotHeight,
      legendHeight: priceLegendHeight,
      collapsed: false,
      scaleY: priceScaleY,
      kind: 'price',
      occupiedRanges: [],
    };

    const _renderStateTemp: RenderState = {
      layout,
      scaleX,
      xTicks: [],
      latestVisibleBarIndex,
      priceScaleY,
      pricePane,
      panes: [],
      compareRenderables,
      overlayRenderables: renderableIndicators.overlays,
      indicatorPanes: [],
    };

    pricePane.occupiedRanges = hasPricePaneValueLabels(this.valueLabelSettings)
      ? computeAxisValueTagsLayout(
          this.buildPriceValueTags(_renderStateTemp),
          pricePlotHeight,
          axisWidth,
          this.valueLabelSettings.noOverlappingLabels,
        ).map(tag => ({ top: tag.top, bottom: tag.top + tag.height }))
      : [];

    const indicatorPanes = renderableIndicators.panes.map((pane, paneIndex) => {
      const paneSeries = pane.lines.map((line) => line.values);
      if (pane.histogram) {
        paneSeries.push(pane.histogram.values);
      }
      if (pane.referenceLines) {
        paneSeries.push(...pane.referenceLines.map((line) => {
          const value = typeof line === 'number' ? line : line.value;
          return new Array(this.bars.length).fill(value);
        }));
      }

      const isCollapsed = this.collapsedIndicatorPanes[pane.indicator.id] === true;
      const indicatorPaneHeight = layout.paneHeights[paneIndex] ?? layout.paneHeight;
      const indicatorLegendHeight = isCollapsed ? INDICATOR_LEGEND_HEIGHT : 0;
      const indicatorPlotHeight = isCollapsed ? indicatorPaneHeight : Math.max(indicatorPaneHeight - indicatorLegendHeight, 1);
      const paneScaleOverride = this.paneScaleOverrides[pane.indicator.id];
      const paneScaleRange = paneScaleOverride ?? pane.fixedRange;

      const context: PaneContext = {
        id: pane.indicator.id,
        title: pane.title,
        top: layout.paneTops[paneIndex] ?? layout.priceHeight,
        height: indicatorPaneHeight,
        plotHeight: indicatorPlotHeight,
        legendHeight: indicatorLegendHeight,
        collapsed: isCollapsed,
        scaleY: buildScaleY(
          [],
          this.viewport.startIndex,
          this.viewport.endIndex,
          indicatorPlotHeight,
          INDICATOR_PANE_SCALE_PADDING,
          INDICATOR_PANE_SCALE_PADDING,
          paneSeries,
          paneScaleRange,
          false,
          Boolean(paneScaleOverride),
          false,
        ),
        kind: 'indicator',
        occupiedRanges: [],
      };

      context.occupiedRanges = this.valueLabelSettings.showIndicatorPaneValues
        ? computeAxisValueTagsLayout(
            this.buildIndicatorValueTags(pane, context, latestVisibleBarIndex),
            indicatorPlotHeight,
            axisWidth,
            this.valueLabelSettings.noOverlappingLabels,
          ).map(tag => ({ top: tag.top, bottom: tag.top + tag.height }))
        : [];

      return { pane, context };
    });

    return {
      layout,
      scaleX,
      xTicks: niceXTicks(this.bars, this.viewport, scaleX, layout.chartWidth, this.timeframe, 110),
      latestVisibleBarIndex,
      priceScaleY,
      pricePane,
      panes: [pricePane, ...indicatorPanes.map((item) => item.context)],
      compareRenderables,
      overlayRenderables: renderableIndicators.overlays,
      indicatorPanes,
    };
  }

  private getLatestVisibleBarIndex(): number {
    if (!this.bars.length) {
      return -1;
    }

    const lastVisible = Math.min(this.bars.length, this.viewport.endIndex);
    return Math.max(0, Math.min(this.bars.length - 1, Math.ceil(lastVisible) - 1));
  }

  private getActiveValueIndex(renderState: RenderState): number {
    if (this.crosshair.visible && this.crosshair.barIndex >= 0) {
      return Math.max(0, Math.min(this.bars.length - 1, this.crosshair.barIndex));
    }

    return renderState.latestVisibleBarIndex;
  }

  private buildCompareRenderables(): RenderableCompareOverlay[] {
    if (!this.bars.length || !this.compareOverlays.length || this.chartType === 'renko') {
      return [];
    }

    const visibleStartIndex = Math.max(0, Math.floor(this.viewport.startIndex));
    const visibleEndIndex = Math.min(this.bars.length - 1, Math.max(visibleStartIndex, Math.ceil(this.viewport.endIndex) - 1));

    return this.compareOverlays.flatMap((overlay) => {
      if (!overlay.displayBars.length) {
        return [];
      }

      const compareCloseByDate = new Map<string, number>();
      overlay.displayBars.forEach((bar) => {
        compareCloseByDate.set(bar.date, bar.close);
      });

      let referenceBaseClose: number | null = null;
      let referenceCompareClose: number | null = null;
      for (let index = visibleStartIndex; index <= visibleEndIndex; index += 1) {
        const baseBar = this.bars[index];
        const compareClose = compareCloseByDate.get(baseBar.date);
        if (typeof compareClose === 'number' && Number.isFinite(compareClose) && compareClose !== 0) {
          referenceBaseClose = baseBar.close;
          referenceCompareClose = compareClose;
          break;
        }
      }

      if (
        referenceBaseClose === null ||
        referenceCompareClose === null ||
        !Number.isFinite(referenceBaseClose) ||
        !Number.isFinite(referenceCompareClose) ||
        referenceCompareClose === 0
      ) {
        return [];
      }

      const normalizedValues = this.bars.map((baseBar) => {
        const compareClose = compareCloseByDate.get(baseBar.date);
        if (typeof compareClose !== 'number' || !Number.isFinite(compareClose)) {
          return null;
        }
        return referenceBaseClose! * (compareClose / referenceCompareClose!);
      });

      const percentValues = this.bars.map((baseBar) => {
        const compareClose = compareCloseByDate.get(baseBar.date);
        if (typeof compareClose !== 'number' || !Number.isFinite(compareClose)) {
          return null;
        }
        return ((compareClose / referenceCompareClose!) - 1) * 100;
      });

      return [{
        overlay,
        title: overlay.instrument.symbol,
        color: overlay.color,
        normalizedValues,
        percentValues,
      }];
    });
  }

  private getPointerState(offsetX: number, offsetY: number, width?: number, height?: number): PointerState | null {
    if (!this.bars.length) {
      return null;
    }

    const rect = this.overlayCanvas.getBoundingClientRect();
    const renderState = this.getCachedOrFreshRenderState(width ?? rect.width, height ?? rect.height);
    const { layout, scaleX } = renderState;
    const chartOffsetX = offsetX - layout.leftAxisWidth;
    const isInAxis = offsetX >= layout.leftAxisWidth + layout.chartWidth + layout.priceAxisGap || offsetX < layout.leftAxisWidth;
    const clampedX = Math.min(Math.max(chartOffsetX, 0), layout.chartWidth);

    // Initial pass to find which pane the mouse is over
    const tempPane = this.resolvePaneFromY(renderState.panes, offsetY);
    const plotMinY = tempPane.top + tempPane.legendHeight;
    const plotMaxY = tempPane.top + tempPane.height;

    // Check if pointer is in the actual plot area after any reserved pane chrome.
    const isInPlot = offsetY >= plotMinY && offsetY < plotMaxY;

    // Clamp Y to the plot area of the resolved pane
    const clampedY = Math.min(Math.max(offsetY, plotMinY), plotMaxY - 1);
    const localPlotY = clampedY - plotMinY;

    return {
      renderState,
      layout,
      scaleX,
      pane: tempPane,
      isInAxis,
      isInPlot,
      clampedX,
      clampedY,
      localY: localPlotY,
      barIndex: Math.max(0, Math.min(this.bars.length - 1, Math.round(scaleX.toIndex(clampedX)))),
      price: tempPane.scaleY.toPrice(localPlotY),
    };
  }

  private getPriceOverlayReservedTop(renderState: RenderState, valueIndex: number): number {
    const summary = this.buildTradingViewPriceSummary(valueIndex);
    const summaryBottom = summary.title || summary.tokens.length ? 28 : 0;
    const rowCount =
      this.buildOverlayLegendRows(renderState.overlayRenderables, valueIndex).length +
      this.buildCompareLegendRows(renderState.compareRenderables, valueIndex).length;
    if (rowCount === 0) {
      return summaryBottom;
    }

    const reservedBottom = summaryBottom + 6 + rowCount * 17;
    return Math.min(reservedBottom, Math.max(renderState.pricePane.height - 6, summaryBottom));
  }

  private canAdjustPaneScale(renderState: RenderState, paneId: ChartPaneId): boolean {
    if (paneId === 'price') {
      return true;
    }

    const paneEntry = renderState.indicatorPanes.find((entry) => entry.context.id === paneId);
    return Boolean(paneEntry && !paneEntry.context.collapsed && !paneEntry.pane.fixedRange);
  }

  private getPaneVisibleRange(renderState: RenderState, paneId: ChartPaneId): PaneScaleRange | null {
    const pane = this.findPaneContext(renderState, paneId);
    if (!pane) {
      return null;
    }

    return {
      min: pane.scaleY.min,
      max: pane.scaleY.max,
    };
  }

  private getPaneScaleAnchorRatio(localY: number, plotHeight: number, invertScale: boolean): number {
    const safeHeight = Math.max(plotHeight, 1);
    return invertScale ? localY / safeHeight : (safeHeight - localY) / safeHeight;
  }

  private buildAxisDraggedScaleRange(axisDragState: AxisDragState, currentClientY: number): PaneScaleRange | null {
    const deltaY = currentClientY - axisDragState.startClientY;
    const factor = Math.pow(1.01, deltaY);
    return this.scaleRangeAroundRatio(axisDragState.range, axisDragState.ratio, factor, axisDragState.logScale);
  }

  private scaleRangeAroundRatio(
    range: PaneScaleRange,
    ratio: number,
    factor: number,
    logScale: boolean,
  ): PaneScaleRange {
    const normalizedRatio = Math.min(Math.max(ratio, 0.02), 0.98);
    if (logScale && range.min > 0 && range.max > range.min) {
      const logMin = Math.log(range.min);
      const logMax = Math.log(range.max);
      const logRange = Math.max(logMax - logMin, 0.0001);
      const anchor = logMin + normalizedRatio * logRange;
      const nextLogRange = Math.max(logRange * factor, 0.0001);
      const nextLogMin = anchor - normalizedRatio * nextLogRange;
      const nextLogMax = nextLogMin + nextLogRange;
      return {
        min: Math.exp(nextLogMin),
        max: Math.exp(nextLogMax),
      };
    }

    const linearRange = Math.max(range.max - range.min, 0.0001);
    const anchor = range.min + normalizedRatio * linearRange;
    const nextLinearRange = Math.max(linearRange * factor, 0.0001);
    const nextMin = anchor - normalizedRatio * nextLinearRange;
    return {
      min: nextMin,
      max: nextMin + nextLinearRange,
    };
  }

  private resolvePaneFromY(panes: PaneContext[], y: number): PaneContext {
    for (const pane of panes) {
      const paneBottom = pane.top + pane.height;
      if (y >= pane.top && y < paneBottom) {
        return pane;
      }
    }

    return panes[panes.length - 1] ?? panes[0]!;
  }

  private findPaneContext(renderState: RenderState, paneId: ChartPaneId): PaneContext | null {
    return renderState.panes.find((pane) => pane.id === paneId) ?? null;
  }

  private getDrawingPaneId(drawing: ChartDrawing): ChartPaneId {
    if (drawing.kind === 'vline') {
      return 'price';
    }

    return drawing.paneId ?? 'price';
  }

  private shouldRenderDrawingInPane(drawing: ChartDrawing, paneId: ChartPaneId): boolean {
    return this.scannerLabelBoxes.get(drawing.id) !== null && drawing.kind !== 'vline' &&
      this.getDrawingPaneId(drawing) === paneId && isDrawingVisibleOnTimeframe(drawing, this.timeframe);
  }

  private drawWatermark(ctx: CanvasRenderingContext2D, chartWidth: number, plotHeight: number): void {
    ctx.save();
    ctx.fillStyle = this.visualSettings.watermarkColor;
    ctx.font = '700 42px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol, chartWidth / 2, plotHeight / 2);
    ctx.restore();
  }

  private createRenkoDrawingAnchor(index: number): RenkoDrawingAnchor | undefined {
    if (this.chartType !== 'renko' || !this.bars.length) {
      return undefined;
    }

    const clampedIndex = Math.max(0, Math.min(this.bars.length - 1, Math.round(index)));
    const bar = this.bars[clampedIndex];
    return {
      sourceTimestamp: bar.renkoSourceTimestamp ?? bar.timestamp,
      sourceDate: bar.date,
      brickOrdinal: bar.renkoBrickOrdinal ?? 1,
      open: bar.open,
      close: bar.close,
      direction: bar.renkoDirection,
      complete: bar.renkoComplete !== false,
    };
  }

  private resolveRenkoDrawingIndex(anchor: RenkoDrawingAnchor | undefined, fallbackIndex: number): number {
    if (this.chartType !== 'renko' || !anchor || !this.bars.length) {
      return fallbackIndex;
    }

    const exactIndex = this.bars.findIndex((bar) =>
      (bar.renkoSourceTimestamp ?? bar.timestamp) === anchor.sourceTimestamp &&
      (bar.renkoBrickOrdinal ?? 1) === anchor.brickOrdinal
    );
    if (exactIndex >= 0) {
      return exactIndex;
    }

    const sameBrickIndex = this.bars.findIndex((bar) =>
      (bar.renkoSourceTimestamp ?? bar.timestamp) === anchor.sourceTimestamp &&
      Math.abs(bar.open - anchor.open) < 0.0001 &&
      Math.abs(bar.close - anchor.close) < 0.0001 &&
      (!anchor.direction || bar.renkoDirection === anchor.direction)
    );
    if (sameBrickIndex >= 0) {
      return sameBrickIndex;
    }

    let nearestSameSource = -1;
    let nearestOrdinalDistance = Number.POSITIVE_INFINITY;
    this.bars.forEach((bar, index) => {
      if ((bar.renkoSourceTimestamp ?? bar.timestamp) !== anchor.sourceTimestamp) {
        return;
      }
      const distance = Math.abs((bar.renkoBrickOrdinal ?? 1) - anchor.brickOrdinal);
      if (distance < nearestOrdinalDistance) {
        nearestOrdinalDistance = distance;
        nearestSameSource = index;
      }
    });
    if (nearestSameSource >= 0) {
      return nearestSameSource;
    }

    let nearestDateIndex = -1;
    let nearestPriceDistance = Number.POSITIVE_INFINITY;
    this.bars.forEach((bar, index) => {
      if (bar.date !== anchor.sourceDate) {
        return;
      }
      const distance = Math.abs(bar.close - anchor.close);
      if (distance < nearestPriceDistance) {
        nearestPriceDistance = distance;
        nearestDateIndex = index;
      }
    });

    return nearestDateIndex >= 0
      ? nearestDateIndex
      : Math.max(0, Math.min(this.bars.length - 1, fallbackIndex));
  }

  private getDrawingAnchorTimestamp(index: number): number | undefined {
    if (!this.bars.length) {
      return undefined;
    }
    const clampedIndex = Math.max(0, Math.min(this.bars.length - 1, Math.round(index)));
    const timestamp = this.bars[clampedIndex]?.timestamp;
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  private withCurrentTimelineAnchors(drawing: ChartDrawing): ChartDrawing {
    if (isPointAnchoredDrawing(drawing)) {
      return {
        ...drawing,
        anchorTimestamp: this.getDrawingAnchorTimestamp(drawing.barIndex),
      };
    }

    if (isMultiAnchorDrawing(drawing)) {
      return {
        ...drawing,
        anchors: drawing.anchors.map((anchor) => ({
          ...anchor,
          timestamp: this.getDrawingAnchorTimestamp(anchor.barIndex),
        })),
      };
    }

    if (isAnchoredDrawing(drawing)) {
      return {
        ...drawing,
        startTimestamp: this.getDrawingAnchorTimestamp(drawing.startIndex),
        endTimestamp: this.getDrawingAnchorTimestamp(drawing.endIndex),
      };
    }

    return drawing;
  }

  private withCurrentRenkoAnchors(drawing: ChartDrawing): ChartDrawing {
    const timelineDrawing = this.withCurrentTimelineAnchors(drawing);
    if (this.chartType !== 'renko') {
      return timelineDrawing;
    }

    if (isPointAnchoredDrawing(timelineDrawing)) {
      return {
        ...timelineDrawing,
        renkoAnchor: this.createRenkoDrawingAnchor(timelineDrawing.barIndex),
      };
    }

    if (isMultiAnchorDrawing(timelineDrawing)) {
      return {
        ...timelineDrawing,
        anchors: timelineDrawing.anchors.map((anchor) => ({
          ...anchor,
          renkoAnchor: this.createRenkoDrawingAnchor(anchor.barIndex),
        })),
      };
    }

    if (isAnchoredDrawing(timelineDrawing)) {
      return {
        ...timelineDrawing,
        startRenkoAnchor: this.createRenkoDrawingAnchor(timelineDrawing.startIndex),
        endRenkoAnchor: this.createRenkoDrawingAnchor(timelineDrawing.endIndex),
      };
    }

    return timelineDrawing;
  }

  private withMissingRenkoAnchors(drawing: ChartDrawing): ChartDrawing {
    if (this.chartType !== 'renko') {
      return drawing;
    }

    if (isPointAnchoredDrawing(drawing) && !drawing.renkoAnchor) {
      return this.withCurrentRenkoAnchors(drawing);
    }

    if (isMultiAnchorDrawing(drawing) && drawing.anchors.some((anchor) => !anchor.renkoAnchor)) {
      return this.withCurrentRenkoAnchors(drawing);
    }

    if (isAnchoredDrawing(drawing) && (!drawing.startRenkoAnchor || !drawing.endRenkoAnchor)) {
      return this.withCurrentRenkoAnchors(drawing);
    }

    return drawing;
  }

  private resolveDrawingForCurrentChart(drawing: ChartDrawing): ChartDrawing {
    const resolved = this.resolveDrawingAnchorsForCurrentChart(drawing);
    const box = this.scannerLabelBoxes.get(drawing.id);
    return resolved.kind === 'text' && box ? { ...resolved, renderTextBox: box } : resolved;
  }

  private prepareScannerLabelBoxes(paneId: ChartPaneId, x: ScaleX, y: ScaleY, width: number, height: number): void {
    const drawings = this.drawings.filter((drawing) => this.shouldRenderDrawingInPane(drawing, paneId))
      .map((drawing) => this.resolveDrawingAnchorsForCurrentChart(drawing));
    for (const [id, box] of layoutScannerLabelBoxes(this.baseCtx, drawings, x, y, width, height)) {
      this.scannerLabelBoxes.set(id, box);
    }
  }

  private resolveDrawingAnchorsForCurrentChart(drawing: ChartDrawing): ChartDrawing {
    if (this.chartType !== 'renko') {
      return drawing;
    }

    if (isPointAnchoredDrawing(drawing)) {
      return {
        ...drawing,
        barIndex: this.resolveRenkoDrawingIndex(drawing.renkoAnchor, drawing.barIndex),
      };
    }

    if (isMultiAnchorDrawing(drawing)) {
      return {
        ...drawing,
        anchors: drawing.anchors.map((anchor) => ({
          ...anchor,
          barIndex: this.resolveRenkoDrawingIndex(anchor.renkoAnchor, anchor.barIndex),
        })),
      };
    }

    if (isAnchoredDrawing(drawing)) {
      return {
        ...drawing,
        startIndex: this.resolveRenkoDrawingIndex(drawing.startRenkoAnchor, drawing.startIndex),
        endIndex: this.resolveRenkoDrawingIndex(drawing.endRenkoAnchor, drawing.endIndex),
      };
    }

    return drawing;
  }

  private drawDrawingInPane(
    ctx: CanvasRenderingContext2D,
    drawing: ChartDrawing,
    pane: PaneContext,
    scaleX: ScaleX,
    layout: ChartLayout,
    selected = false,
  ): void {
    if (pane.collapsed) {
      return;
    }

    ctx.save();
    ctx.translate(0, pane.top);
    drawDrawing(ctx, this.resolveDrawingForCurrentChart(drawing), this.viewport, scaleX, pane.scaleY, layout.chartWidth, pane.height, selected, this.bars);
    ctx.restore();
  }

  private drawPriceOverlayLegend(
    ctx: CanvasRenderingContext2D,
    renderState: RenderState,
    valueIndex: number,
  ): void {
    const headerBottom = this.drawTradingViewPriceSummaryLine(ctx, valueIndex);
    if (valueIndex < 0) {
      return;
    }
    const rows = [
      ...this.buildOverlayLegendRows(renderState.overlayRenderables, valueIndex),
      ...this.buildCompareLegendRows(renderState.compareRenderables, valueIndex),
    ];
    if (!rows.length) {
      return;
    }
    ctx.save();
    ctx.translate(0, 0);
    const maxWidth = Math.max(renderState.layout.chartWidth - 24, 0);
    let cursorY = headerBottom + 6;
    rows.forEach((row) => {
      cursorY = drawLegendTokens(ctx, row, 12, cursorY, maxWidth) + 2;
    });
    ctx.restore();
  }

  private drawPriceSummaryLine(ctx: CanvasRenderingContext2D, valueIndex: number): number {
    const tokens = this.buildPriceSummaryTokens(valueIndex);
    if (!tokens.length) {
      return 10;
    }

    ctx.save();
    ctx.translate(0, 0);
    const bottom = drawLegendTokens(ctx, tokens, 12, 10, Math.max(ctx.canvas.clientWidth - this.axisWidth - 24, 0));
    ctx.restore();
    return bottom;
  }

  private buildPriceSummaryTokens(valueIndex: number): LegendToken[] {
    const [exchange, symbol] = this.symbol.includes(':')
      ? this.symbol.split(':', 2)
      : ['', this.symbol];
    const titleParts = [symbol, this.timeframe, exchange].filter(Boolean);
    const tokens: LegendToken[] = [];

    if (titleParts.length) {
      tokens.push({ text: titleParts.join(' · '), color: '#eef6ff', gapAfter: 14 });
    }

    if (valueIndex < 0 || valueIndex >= this.bars.length) {
      return tokens;
    }

    const bar = this.bars[valueIndex];
    const missingIndexReference = exchange === 'NSE_INDEX'
      && (bar.prevClose == null || !Number.isFinite(bar.prevClose) || bar.prevClose <= 0);
    const referenceClose = bar.prevClose ?? bar.open;
    const change = bar.close - referenceClose;
    const changePct = referenceClose !== 0 ? (change / referenceClose) * 100 : 0;
    const closeColor = missingIndexReference ? '#dce8f4' : change >= 0 ? this.theme.candleUp : this.theme.candleDown;

    tokens.push({ text: bar.date, color: '#dce8f4', gapAfter: 12 });
    tokens.push({ text: 'O', color: '#91a8bd', gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.open), color: '#dce8f4', gapAfter: 10 });
    tokens.push({ text: 'H', color: '#91a8bd', gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.high), color: '#78e7a0', gapAfter: 10 });
    tokens.push({ text: 'L', color: '#91a8bd', gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.low), color: '#ff9a9a', gapAfter: 10 });
    tokens.push({ text: 'C', color: '#91a8bd', gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.close), color: closeColor, gapAfter: 10 });
    tokens.push({
      text: missingIndexReference ? 'Change unavailable'
        : `${formatSignedValue(change, 2, 2)} (${formatSignedValue(changePct, 2, 2)}%)`,
      color: closeColor,
      gapAfter: 10,
    });

    return tokens;
  }

  private drawTradingViewPriceSummaryLine(ctx: CanvasRenderingContext2D, valueIndex: number): number {
    const summary = this.buildTradingViewPriceSummary(valueIndex);
    if (!summary.title && !summary.tokens.length) {
      return 10;
    }

    const left = 12;
    const top = 10;
    const maxWidth = Math.max(this.container.clientWidth - this.axisWidth - this.leftAxisWidth - 24, 0);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let cursorX = left;
    if (summary.title) {
      ctx.font = '700 14px "Segoe UI", sans-serif';
      ctx.fillStyle = this.getSummaryNeutralColor();
      ctx.fillText(summary.title, cursorX, top);
      cursorX += ctx.measureText(summary.title).width + 10;
    }

    let bottom = summary.title ? top + 18 : top;
    if (summary.tokens.length) {
      const remainingWidth = left + maxWidth - cursorX;
      if (summary.title && remainingWidth >= 260) {
        bottom = this.drawSummaryTokens(ctx, summary.tokens, cursorX, top + 1, remainingWidth);
      } else {
        bottom = this.drawSummaryTokens(ctx, summary.tokens, left, top + 20, maxWidth);
      }
    }

    ctx.restore();
    return Math.max(bottom, top + 18);
  }

  private buildTradingViewPriceSummary(valueIndex: number): {
    title: string;
    tokens: LegendToken[];
  } {
    const [exchange, symbol] = this.symbol.includes(':')
      ? this.symbol.split(':', 2)
      : ['', this.symbol];
    const title = [symbol, this.timeframe, exchange].filter(Boolean).join(' | ');
    const tokens: LegendToken[] = [];
    const neutralColor = this.getSummaryNeutralColor();

    if (valueIndex < 0 || valueIndex >= this.bars.length) {
      return {
        title,
        tokens,
      };
    }

    const bar = this.bars[valueIndex];
    const missingIndexReference = exchange === 'NSE_INDEX'
      && (bar.prevClose == null || !Number.isFinite(bar.prevClose) || bar.prevClose <= 0);
    const referenceClose = bar.prevClose ?? bar.open;
    const change = bar.close - referenceClose;
    const changePct = referenceClose !== 0 ? (change / referenceClose) * 100 : 0;
    const closeColor = missingIndexReference ? neutralColor : change >= 0 ? this.theme.candleUp : this.theme.candleDown;

    tokens.push({ text: bar.date, color: '#dce8f4', gapAfter: 12 });
    tokens.push({ text: 'O', color: neutralColor, gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.open), color: closeColor, gapAfter: 10 });
    tokens.push({ text: 'H', color: neutralColor, gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.high), color: closeColor, gapAfter: 10 });
    tokens.push({ text: 'L', color: neutralColor, gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.low), color: closeColor, gapAfter: 10 });
    tokens.push({ text: 'C', color: neutralColor, gapAfter: 4 });
    tokens.push({ text: formatPrice(bar.close), color: closeColor, gapAfter: 10 });
    tokens.push({
      text: missingIndexReference ? 'Change unavailable'
        : `${formatSignedValue(change, 2, 2)} (${formatSignedValue(changePct, 2, 2)}%)`,
      color: closeColor,
      gapAfter: 10,
    });

    return {
      title,
      tokens,
    };
  }

  private drawSummaryTokens(
    ctx: CanvasRenderingContext2D,
    tokens: LegendToken[],
    x: number,
    y: number,
    maxWidth: number,
  ): number {
    if (!tokens.length || maxWidth <= 0) {
      return y;
    }

    ctx.save();
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const rowHeight = 18;
    const wrapWidth = x + maxWidth;
    let cursorX = x;
    let cursorY = y;

    tokens.forEach((token) => {
      const textWidth = ctx.measureText(token.text).width;
      if (cursorX > x && cursorX + textWidth > wrapWidth) {
        cursorX = x;
        cursorY += rowHeight;
      }
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, cursorX, cursorY);
      cursorX += textWidth + (token.gapAfter ?? 10);
    });

    ctx.restore();
    return cursorY + rowHeight;
  }

  private getSummaryNeutralColor(): string {
    return resolveHighContrastText(this.theme.background);
  }

  private drawIndicatorPaneLegends(
    ctx: CanvasRenderingContext2D,
    renderState: RenderState,
    valueIndex: number,
  ): void {
    if (valueIndex < 0) {
      return;
    }

    renderState.indicatorPanes.forEach(({ pane, context }) => {
      if (context.collapsed) {
        return;
      }
      const tokens = this.buildPaneLegendTokens(pane, valueIndex);
      if (!tokens.length) {
        return;
      }

      ctx.save();
      ctx.translate(0, context.top);
      const legendX = 6 + measurePaneTitleWidth(ctx, pane.title, renderState.layout.chartWidth) + 14;
      drawLegendTokens(
        ctx,
        tokens,
        legendX,
        7,
        Math.max(renderState.layout.chartWidth - legendX - 10, 0),
      );
      ctx.restore();
    });
  }

  private buildOverlayLegendRows(
    overlays: RenderableOverlay[],
    valueIndex: number,
  ): LegendToken[][] {
    const rows: LegendToken[][] = [];
    overlays.forEach((overlay) => {
      const row: LegendToken[] = [{ text: overlay.title, color: '#91aac2', gapAfter: 8 }];
      overlay.lines.forEach((line) => {
        const value = line.values[valueIndex];
        if (typeof value !== 'number') {
          return;
        }
        if (line.label !== overlay.title) {
          row.push({ text: line.label, color: '#748da6', gapAfter: 4 });
        }
        row.push({ text: formatPrice(value), color: line.color, gapAfter: 10 });
      });
      if (overlay.points) {
        const pointValue = overlay.points.values[valueIndex];
        if (typeof pointValue === 'number') {
          row.push({ text: formatPrice(pointValue), color: overlay.points.color, gapAfter: 10 });
        }
      }
      if (row.length > 1) {
        rows.push(row);
      }
    });
    return rows;
  }

  private buildCompareLegendRows(
    compareRenderables: RenderableCompareOverlay[],
    valueIndex: number,
  ): LegendToken[][] {
    const rows: LegendToken[][] = [];
    compareRenderables.forEach((compare) => {
      const percentValue = compare.percentValues[valueIndex];
      if (typeof percentValue !== 'number' || !Number.isFinite(percentValue)) {
        return;
      }
      rows.push([
        { text: compare.title, color: compare.color, gapAfter: 6 },
        {
          text: `${formatSignedValue(percentValue, 2, 2)}%`,
          color: compare.color,
          gapAfter: 10,
        },
      ]);
    });
    return rows;
  }

  private buildPriceValueTags(renderState: RenderState): AxisValueTag[] {
    if (!this.bars.length) {
      return [];
    }

    const lastBarIndex = this.bars.length - 1;
    const compareTagIndex = Math.max(0, renderState.latestVisibleBarIndex);
    const lastBar = this.bars[lastBarIndex];
    const tags: AxisValueTag[] = [];
    const symbolName = this.getDisplaySymbolName();

    if (this.valueLabelSettings.showSymbolNameLabel || this.valueLabelSettings.showSymbolLastPrice) {
      const textParts: string[] = [];
      if (this.valueLabelSettings.showSymbolNameLabel && symbolName) {
        textParts.push(symbolName);
      }
      if (this.valueLabelSettings.showSymbolLastPrice) {
        textParts.push(formatPrice(lastBar.close, 2, 2));
      }
      tags.push({
        y: renderState.priceScaleY.toPixel(lastBar.close),
        text: textParts.join(' '),
        color: lastBar.close >= (lastBar.prevClose ?? lastBar.close) ? this.theme.candleUp : this.theme.candleDown,
        role: 'price',
      });
    }

    if (this.valueLabelSettings.showSymbolPreviousClose && typeof lastBar.prevClose === 'number' && Number.isFinite(lastBar.prevClose)) {
      tags.push({
        y: renderState.priceScaleY.toPixel(lastBar.prevClose),
        text: `PC ${formatPrice(lastBar.prevClose, 2, 2)}`,
        color: 'rgba(154, 176, 200, 0.92)',
        role: 'overlay',
      });
    }

    if (this.valueLabelSettings.showHighLowPriceLabels) {
      const highLow = this.getVisibleHighLow();
      if (highLow) {
        tags.push({
          y: renderState.priceScaleY.toPixel(highLow.high),
          text: `H ${formatPrice(highLow.high, 2, 2)}`,
          color: '#78e7a0',
          role: 'overlay',
        });
        tags.push({
          y: renderState.priceScaleY.toPixel(highLow.low),
          text: `L ${formatPrice(highLow.low, 2, 2)}`,
          color: '#ff9a9a',
          role: 'overlay',
        });
      }
    }

    if (this.valueLabelSettings.showOverlayIndicatorValues) {
      renderState.overlayRenderables.forEach((overlay) => {
        overlay.lines.forEach((line) => {
          const value = line.values[lastBarIndex];
          if (typeof value === 'number') {
            tags.push({
              y: renderState.priceScaleY.toPixel(value),
              text: this.formatIndicatorScaleLabel(line.label, value),
              color: line.color,
              role: 'overlay',
            });
          }
        });

        if (overlay.points) {
          const value = overlay.points.values[lastBarIndex];
          if (typeof value === 'number') {
            tags.push({
              y: renderState.priceScaleY.toPixel(value),
              text: this.formatIndicatorScaleLabel(overlay.title, value),
              color: overlay.points.color,
              role: 'overlay',
            });
          }
        }
      });
    }

    if (this.valueLabelSettings.showCompareValues) {
      renderState.compareRenderables.forEach((compare) => {
        const normalizedValue = compare.normalizedValues[compareTagIndex];
        const percentValue = compare.percentValues[compareTagIndex];
        if (
          typeof normalizedValue !== 'number' ||
          !Number.isFinite(normalizedValue) ||
          typeof percentValue !== 'number' ||
          !Number.isFinite(percentValue)
        ) {
          return;
        }

        tags.push({
          y: renderState.priceScaleY.toPixel(normalizedValue),
          text: `${compare.title} ${formatSignedValue(percentValue, 2, 2)}%`,
          color: compare.color,
          role: 'compare',
        });
      });
    }

    return tags;
  }

  private getDisplaySymbolName(): string {
    const [, symbol] = this.symbol.includes(':')
      ? this.symbol.split(':', 2)
      : ['', this.symbol];
    return symbol;
  }

  private getVisibleHighLow(): { high: number; low: number } | null {
    if (!this.bars.length) {
      return null;
    }
    const start = Math.max(0, Math.floor(this.viewport.startIndex));
    const end = Math.min(this.bars.length - 1, Math.ceil(this.viewport.endIndex));
    if (start > end) {
      return null;
    }

    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (let index = start; index <= end; index += 1) {
      const bar = this.bars[index];
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
    }

    if (!Number.isFinite(high) || !Number.isFinite(low)) {
      return null;
    }
    return { high, low };
  }

  private formatIndicatorScaleLabel(label: string, value: number): string {
    const formattedValue = formatPrice(value);
    if (!this.valueLabelSettings.showIndicatorNameLabels) {
      return formattedValue;
    }
    const compactLabel = label.trim();
    return compactLabel ? `${compactLabel} ${formattedValue}` : formattedValue;
  }

  private collectPricePaneLastValueSamples(renderState: RenderState): number[] {
    if (!this.bars.length) {
      return [];
    }

    const lastBarIndex = this.bars.length - 1;
    const samples: number[] = [this.bars[lastBarIndex].close];

    renderState.overlayRenderables.forEach((overlay) => {
      overlay.lines.forEach((line) => {
        const value = line.values[lastBarIndex];
        if (typeof value === 'number') {
          samples.push(value);
        }
      });

      if (overlay.points) {
        const value = overlay.points.values[lastBarIndex];
        if (typeof value === 'number') {
          samples.push(value);
        }
      }
    });

    renderState.compareRenderables.forEach((compare) => {
      const normalizedValue = compare.normalizedValues[renderState.latestVisibleBarIndex];
      if (typeof normalizedValue === 'number') {
        samples.push(normalizedValue);
      }
    });

    return samples;
  }

  private buildPaneLegendTokens(
    pane: RenderablePane,
    valueIndex: number,
  ): LegendToken[] {
    const tokens: LegendToken[] = [];
    const labelColor = resolveMutedChartText(this.theme.background);

    pane.lines.forEach((line) => {
      const value = line.values[valueIndex];
      if (typeof value !== 'number') {
        return;
      }
      tokens.push({ text: line.label, color: labelColor, gapAfter: 4 });
      tokens.push({ text: formatPrice(value), color: line.color, gapAfter: 10 });
    });

    if (pane.histogram) {
      const histogramValue = pane.histogram.values[valueIndex];
      if (typeof histogramValue === 'number') {
        const histColor =
          pane.histogram.colorValues?.[valueIndex] ??
          (histogramValue >= 0 ? pane.histogram.positiveColor : pane.histogram.negativeColor);
        tokens.push({ text: pane.histogram.label, color: labelColor, gapAfter: 4 });
        tokens.push({
          text: formatPrice(histogramValue),
          color: histColor,
          gapAfter: 10,
        });
      }
    }

    return tokens;
  }

  private buildIndicatorValueTags(
    pane: RenderablePane,
    context: PaneContext,
    valueIndex: number,
  ): AxisValueTag[] {
    if (valueIndex < 0) {
      return [];
    }

    const tags: AxisValueTag[] = [];
    pane.lines.forEach((line) => {
      const value = line.values[valueIndex];
      if (typeof value === 'number') {
        tags.push({
          y: context.scaleY.toPixel(value),
          text: this.formatIndicatorScaleLabel(line.label, value),
          color: line.color,
          role: 'indicator',
        });
      }
    });

    if (pane.histogram) {
      const value = pane.histogram.values[valueIndex];
      if (typeof value === 'number') {
        const histColor =
          pane.histogram.colorValues?.[valueIndex] ??
          (value >= 0 ? pane.histogram.positiveColor : pane.histogram.negativeColor);
        tags.push({
          y: context.scaleY.toPixel(value),
          text: this.formatIndicatorScaleLabel(pane.histogram.label, value),
          color: histColor,
          role: 'indicator',
        });
      }
    }

    return tags;
  }

  private measureDynamicAxisWidth(renderState: RenderState): number {
    const priceTicks = niceYTicks(
      renderState.priceScaleY.min,
      renderState.priceScaleY.max,
      renderState.layout.priceHeight,
    );
    const pricePrecision = Math.max(getPrecisionFromStep(priceTicks.step), 2);
    const labels: string[] = priceTicks.ticks.map((tick: number) => formatPrice(tick, pricePrecision, pricePrecision));

    if (hasPricePaneValueLabels(this.valueLabelSettings)) {
      labels.push(...this.buildPriceValueTags(renderState).map((tag) => tag.text));
    }

    renderState.indicatorPanes.forEach(({ pane, context }) => {
      labels.push(...niceYTicks(context.scaleY.min, context.scaleY.max, context.height).ticks.map((tick: number) => formatPrice(tick)));
      if (this.valueLabelSettings.showIndicatorPaneValues) {
        labels.push(...this.buildIndicatorValueTags(pane, context, renderState.latestVisibleBarIndex).map((tag) => tag.text));
      }
    });

    return measureAxisLabelWidth(this.baseCtx, labels, 58, 132);
  }

  private isDrawingToolAllowedInPane(tool: DrawingTool, paneId: ChartPaneId): boolean {
    if (paneId === 'price') {
      return true;
    }

    return (
      tool !== 'fib' &&
      tool !== 'fibExtension' &&
      tool !== 'fibFan' &&
      tool !== 'gann' &&
      tool !== 'regressionTrend' &&
      tool !== 'fibTimeZone' &&
      tool !== 'fibCircles' &&
      tool !== 'fibSpiral' &&
      tool !== 'fibArcs' &&
      tool !== 'gannBox' &&
      tool !== 'forecast' &&
      tool !== 'andrewsPitchfork' &&
      tool !== 'schiffPitchfork' &&
      tool !== 'modifiedSchiffPitchfork' &&
      tool !== 'insidePitchfork' &&
      tool !== 'trendFibExtension' &&
      tool !== 'fibChannel' &&
      tool !== 'fibTimeExtension' &&
      tool !== 'fibWedge' &&
      tool !== 'pitchfan' &&
      tool !== 'longPosition' &&
      tool !== 'shortPosition' &&
      tool !== 'projection'
    );
  }

  private hitTestDrawing(pointerState: PointerState): DrawingHitTarget | null {
    const tolerance = 8;
    for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.drawings[index];
      if (this.scannerLabelBoxes.get(drawing.id) === null) continue;
      if (!isDrawingVisibleOnTimeframe(drawing, this.timeframe)) {
        continue;
      }
      const drawingPaneId = this.getDrawingPaneId(drawing);
      if (pointerState.pane.collapsed && drawing.kind !== 'vline') {
        continue;
      }
      if (drawing.kind !== 'vline' && drawingPaneId !== pointerState.pane.id) {
        continue;
      }
      const renderDrawing = this.resolveDrawingForCurrentChart(drawing);

      if (drawing.kind === 'hline') {
        const y = pointerState.pane.scaleY.toPixel(drawing.price);
        if (Math.abs(pointerState.localY - y) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'vline') {
        const renderVline = renderDrawing.kind === 'vline' ? renderDrawing : drawing;
        const x = pointerState.scaleX.toPixel(renderVline.barIndex);
        if (Math.abs(pointerState.clampedX - x) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'horizontalRay' || drawing.kind === 'crossLine') {
        const renderPoint =
          renderDrawing.kind === 'horizontalRay' || renderDrawing.kind === 'crossLine'
            ? renderDrawing
            : drawing;
        const x = pointerState.scaleX.toPixel(renderPoint.barIndex);
        const y = pointerState.pane.scaleY.toPixel(renderPoint.price);
        if (distanceBetween(pointerState.clampedX, pointerState.localY, x, y) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        if (drawing.kind === 'horizontalRay') {
          if (
            isHorizontalRayHit(
              { x: pointerState.clampedX, y: pointerState.localY },
              { x, y },
              tolerance,
              'right',
            )
          ) {
            return { drawing, mode: 'move' };
          }
        } else if (
          Math.abs(pointerState.clampedX - x) <= tolerance ||
          Math.abs(pointerState.localY - y) <= tolerance
        ) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'arrowMarker' || drawing.kind === 'arrowUp' || drawing.kind === 'arrowDown') {
        const renderPoint =
          renderDrawing.kind === 'arrowMarker' || renderDrawing.kind === 'arrowUp' || renderDrawing.kind === 'arrowDown'
            ? renderDrawing
            : drawing;
        const x = pointerState.scaleX.toPixel(renderPoint.barIndex);
        const y = pointerState.pane.scaleY.toPixel(renderPoint.price);
        const size = Math.max(12, (drawing.lineWidth ?? 1.4) * 8);
        const direction = drawing.kind === 'arrowDown' ? 'down' : 'up';
        const tipY = direction === 'up' ? y - size : y + size;
        const baseY = y;
        const halfBase = size * 0.55;
        if (
          pointInTriangle(
            { x: pointerState.clampedX, y: pointerState.localY },
            { x, y: tipY },
            { x: x - halfBase, y: baseY },
            { x: x + halfBase, y: baseY },
          ) ||
          distanceBetween(pointerState.clampedX, pointerState.localY, x, y) <= tolerance
        ) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'text') {
        const renderText = renderDrawing.kind === 'text' ? renderDrawing : drawing;
        const box = getTextBoxBounds(renderText, pointerState.scaleX, pointerState.pane.scaleY);
        if (this.selectedDrawingId === drawing.id) {
          const resizeHandle = getTextResizeHandle(pointerState.clampedX, pointerState.localY, box, tolerance);
          if (resizeHandle) {
            return { drawing, mode: resizeHandle };
          }
        }
        const inside =
          pointerState.clampedX >= box.left - tolerance &&
          pointerState.clampedX <= box.left + box.width + tolerance &&
          pointerState.localY >= box.top - tolerance &&
          pointerState.localY <= box.top + box.height + tolerance;
        if (inside) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (isMultiAnchorDrawing(renderDrawing)) {
        const anchorPoints = renderDrawing.anchors.map((anchor) => ({
          x: pointerState.scaleX.toPixel(anchor.barIndex),
          y: pointerState.pane.scaleY.toPixel(anchor.price),
        }));
        const hitAnchorPoints = anchorPoints;
        for (let anchorOrdinal = 0; anchorOrdinal < hitAnchorPoints.length; anchorOrdinal += 1) {
          const anchorPoint = hitAnchorPoints[anchorOrdinal];
          if (distanceBetween(pointerState.clampedX, pointerState.localY, anchorPoint.x, anchorPoint.y) <= tolerance) {
            return { drawing, mode: 'anchor', anchorOrdinal };
          }
        }

        const pointer = { x: pointerState.clampedX, y: pointerState.localY };
        if (drawing.kind === 'flatChannel') {
          const segments = buildFlatChannelSegments(
            anchorPoints,
            pointerState.layout.chartWidth,
            drawing.extendLeft === true,
            drawing.extendRight === true,
          );
          if (segments && segments.some((segment) => distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          continue;
        }
        if (drawing.kind === 'disjointChannel') {
          const segments = buildDisjointChannelSegments(
            anchorPoints,
            pointerState.layout.chartWidth,
            drawing.extendLeft === true,
            drawing.extendRight === true,
          );
          if (segments && segments.some((segment) => distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          if (anchorPoints.length >= 4 && pointInDrawingPolygon(pointer, [anchorPoints[0], anchorPoints[1], anchorPoints[3], anchorPoints[2]])) {
            return { drawing, mode: 'move' };
          }
          continue;
        }
        if (drawing.kind === 'triangle') {
          if (pointInDrawingPolygon(pointer, anchorPoints.slice(0, 3))) {
            return { drawing, mode: 'move' };
          }
          const edges = [[0, 1], [1, 2], [2, 0]] as const;
          if (edges.some(([a, b]) => distanceToSegment(pointer.x, pointer.y, anchorPoints[a].x, anchorPoints[a].y, anchorPoints[b].x, anchorPoints[b].y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          continue;
        }
        if (drawing.kind === 'rotatedRect') {
          const corners = getRotatedRectangleCorners(anchorPoints);
          if (corners) {
            if (pointInDrawingPolygon(pointer, corners)) return { drawing, mode: 'move' };
            if (corners.some((corner, index) => {
              const next = corners[(index + 1) % corners.length];
              return distanceToSegment(pointer.x, pointer.y, corner.x, corner.y, next.x, next.y) <= tolerance;
            })) return { drawing, mode: 'move' };
          }
          continue;
        }
        if (drawing.kind === 'arc') {
          const arc = getArcParameters(anchorPoints);
          if (arc) {
            const dx = pointer.x - arc.center.x;
            const dy = pointer.y - arc.center.y;
            const distance = Math.hypot(dx, dy);
            if (Math.abs(distance - arc.radius) <= tolerance && isAngleOnArc(Math.atan2(dy, dx), arc.startAngle, arc.endAngle)) {
              return { drawing, mode: 'move' };
            }
          }
          continue;
        }
        if (drawing.kind === 'trendFibExtension') {
          const levels = resolveFibonacciLevels(drawing, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618]);
          const geometry = buildF1BTrendFibExtensionLevels(
            anchorPoints,
            renderDrawing.anchors.map((anchor) => anchor.price),
            pointerState.layout.chartWidth,
            levels,
            drawing.extendLeft === true,
            drawing.extendRight === true,
            resolveFibonacciOptions(drawing).reverse,
          );
          const onLevel = geometry.some((entry) => {
            const y = pointerState.pane.scaleY.toPixel(entry.price);
            return distanceToSegment(pointer.x, pointer.y, entry.segment.start.x, y, entry.segment.end.x, y) <= tolerance;
          });
          const onTrend = anchorPoints.slice(0, -1).some((point, index) => {
            const next = anchorPoints[index + 1];
            return distanceToSegment(pointer.x, pointer.y, point.x, point.y, next.x, next.y) <= tolerance;
          });
          if (onLevel || onTrend) return { drawing, mode: 'move' };
          continue;
        }
        if (drawing.kind === 'fibChannel') {
          const levels = resolveFibonacciLevels(drawing, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618]);
          const geometry = buildF1BFibChannelLevels(
            anchorPoints,
            pointerState.layout.chartWidth,
            levels,
            drawing.extendLeft === true,
            drawing.extendRight === true,
          );
          if (geometry.some(({ segment }) => distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          continue;
        }
        if (drawing.kind === 'fibTimeExtension') {
          const levels = resolveFibonacciLevels(drawing, [0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3]);
          const geometry = buildF1BTrendFibTimeLevels(anchorPoints, levels);
          const onLevel = geometry.some(({ x }) =>
            x >= -tolerance && x <= pointerState.layout.chartWidth + tolerance && Math.abs(pointer.x - x) <= tolerance
          );
          const onTrend = anchorPoints.slice(0, -1).some((point, index) => {
            const next = anchorPoints[index + 1];
            return distanceToSegment(pointer.x, pointer.y, point.x, point.y, next.x, next.y) <= tolerance;
          });
          if (onLevel || onTrend) return { drawing, mode: 'move' };
          continue;
        }
        if (drawing.kind === 'fibWedge') {
          const levels = resolveFibonacciLevels(drawing, FIB_WEDGE_DEFAULT_VALUES);
          const dataAnchors = drawing.anchors.map((anchor) => ({ x: anchor.barIndex, y: anchor.price }));
          const dataGeometry = buildF1CFibWedgeGeometry(dataAnchors, levels);
          const geometry = dataGeometry
            ? projectF1CFibWedgeGeometry(dataGeometry, (point) => ({
                x: pointerState.scaleX.toPixel(point.x),
                y: pointerState.pane.scaleY.toPixel(point.y),
              }))
            : null;
          if (geometry) {
            const onBoundary = [geometry.firstBoundary, geometry.secondBoundary].some((segment) =>
              distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance
            );
            const onArc = geometry.levels.some((entry) =>
              distanceToF1CFibWedgeLevel(pointer, entry) <= tolerance
            );
            if (onBoundary || onArc) return { drawing, mode: 'move' };
          }
          continue;
        }
        if (isD3BDrawingKind(drawing.kind)) {
          const segments = buildD3BHitSegments(
            drawing.kind,
            anchorPoints,
            pointerState.layout.chartWidth,
            pointerState.pane.plotHeight,
            drawing.extendLeft === true,
            drawing.extendRight === true,
          );
          if (segments.some((segment) => distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          continue;
        }
        if (isD3CDrawingKind(drawing.kind)) {
          const segments = buildD3CHitSegments(drawing.kind, anchorPoints);
          if (segments.some((segment) => distanceToSegment(pointer.x, pointer.y, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance)) {
            return { drawing, mode: 'move' };
          }
          if (drawing.kind === 'longPosition' || drawing.kind === 'shortPosition') {
            const geometry = buildPositionPixelGeometry(anchorPoints);
            if (geometry && pointInPositionGeometry(pointer, geometry)) {
              return { drawing, mode: 'move' };
            }
          }
          continue;
        }
        continue;
      }

      if (!isAnchoredDrawing(renderDrawing)) {
        continue;
      }
      const startX = pointerState.scaleX.toPixel(renderDrawing.startIndex);
      let startY = pointerState.pane.scaleY.toPixel(renderDrawing.startPrice);
      const endX = pointerState.scaleX.toPixel(renderDrawing.endIndex);
      let endY = pointerState.pane.scaleY.toPixel(renderDrawing.endPrice);
      if (drawing.kind === 'regressionTrend') {
        const regressionForAnchors = calculateRegressionChannel(this.bars, renderDrawing.startIndex, renderDrawing.endIndex, 2);
        if (regressionForAnchors) {
          startY = pointerState.pane.scaleY.toPixel(
            regressionForAnchors.intercept + regressionForAnchors.slopePerBar * renderDrawing.startIndex,
          );
          endY = pointerState.pane.scaleY.toPixel(
            regressionForAnchors.intercept + regressionForAnchors.slopePerBar * renderDrawing.endIndex,
          );
        }
      }
      if (drawing.kind === 'dateRange') {
        if (Math.abs(pointerState.clampedX - startX) <= tolerance) {
          return { drawing, mode: 'start' };
        }
        if (Math.abs(pointerState.clampedX - endX) <= tolerance) {
          return { drawing, mode: 'end' };
        }
      }
      if (distanceBetween(pointerState.clampedX, pointerState.localY, startX, startY) <= tolerance) {
        return { drawing, mode: 'start' };
      }
      if (distanceBetween(pointerState.clampedX, pointerState.localY, endX, endY) <= tolerance) {
        return { drawing, mode: 'end' };
      }

      if (drawing.kind === 'regressionTrend') {
        const regression = calculateRegressionChannel(this.bars, renderDrawing.startIndex, renderDrawing.endIndex, 2);
        if (regression) {
          const rx1 = pointerState.scaleX.toPixel(regression.startIndex);
          const rx2 = pointerState.scaleX.toPixel(regression.endIndex);
          const lines = [
            [regression.centerStart, regression.centerEnd],
            [regression.upperStart, regression.upperEnd],
            [regression.lowerStart, regression.lowerEnd],
          ] as const;
          if (
            lines.some(([price1, price2]) => {
              const segment = extendSegmentHorizontally(
                { x: rx1, y: pointerState.pane.scaleY.toPixel(price1) },
                { x: rx2, y: pointerState.pane.scaleY.toPixel(price2) },
                pointerState.layout.chartWidth,
                drawing.extendLeft === true,
                drawing.extendRight === true,
              );
              return distanceToSegment(
                pointerState.clampedX,
                pointerState.localY,
                segment.start.x,
                segment.start.y,
                segment.end.x,
                segment.end.y,
              ) <= tolerance;
            })
          ) {
            return { drawing, mode: 'move' };
          }
        }
        continue;
      }

      if (drawing.kind === 'fibTimeZone') {
        const levels = resolveFibonacciLevels(drawing, [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
        const matchedZone = buildF1BFibTimeZoneLevels(renderDrawing.startIndex, renderDrawing.endIndex, levels).some(({ index }) => {
          if (index < this.viewport.startIndex - 1 || index > this.viewport.endIndex + 1) return false;
          const x = pointerState.scaleX.toPixel(index);
          return Math.abs(pointerState.clampedX - x) <= tolerance;
        });
        const initialLineHit = distanceToSegment(
          pointerState.clampedX,
          pointerState.localY,
          startX,
          startY,
          endX,
          endY,
        ) <= tolerance;
        if (matchedZone || initialLineHit) return { drawing, mode: 'move' };
        continue;
      }

      if (drawing.kind === 'fibCircles') {
        const levels = resolveFibonacciLevels(drawing, FIB_CIRCLES_DEFAULT_VALUES);
        const geometry = buildF1CFibCirclesGeometry(
          { x: startX, y: startY },
          { x: endX, y: endY },
          levels,
        );
        if (geometry) {
          const trendHit = distanceToSegment(
            pointerState.clampedX,
            pointerState.localY,
            geometry.trend.start.x,
            geometry.trend.start.y,
            geometry.trend.end.x,
            geometry.trend.end.y,
          ) <= tolerance;
          const circleHit = geometry.levels.some((entry) =>
            distanceToEllipseBoundary(
              { x: pointerState.clampedX, y: pointerState.localY },
              entry.center,
              Math.max(entry.radiusX, 0.5),
              Math.max(entry.radiusY, 0.5),
            ) <= tolerance
          );
          if (trendHit || circleHit) return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'fibSpiral') {
        const settings = getNormalizedFibonacciSettings(drawing);
        const center = { x: renderDrawing.startIndex, y: renderDrawing.startPrice };
        const reference = { x: renderDrawing.endIndex, y: renderDrawing.endPrice };
        const basis = settings?.kind === 'fibSpiral' && settings.basisPerp
          ? settings.basisPerp
          : buildF1DFibSpiralPerpBasis(
              center,
              reference,
              (point) => ({ x: pointerState.scaleX.toPixel(point.x), y: pointerState.pane.scaleY.toPixel(point.y) }),
              (point) => ({ x: pointerState.scaleX.toIndex(point.x), y: pointerState.pane.scaleY.toPrice(point.y) }),
            );
        const dataGeometry = basis
          ? buildF1DFibSpiralGeometry(center, reference, basis, settings?.kind === 'fibSpiral' && settings.counterclockwise === true)
          : null;
        const geometry = dataGeometry
          ? projectF1DFibSpiralGeometry(dataGeometry, (point) => ({
              x: pointerState.scaleX.toPixel(point.x),
              y: pointerState.pane.scaleY.toPixel(point.y),
            }))
          : null;
        if (geometry && geometry.points.slice(1).some((point, index) => {
          const previous = geometry.points[index];
          return distanceToSegment(pointerState.clampedX, pointerState.localY, previous.x, previous.y, point.x, point.y) <= tolerance;
        })) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'fibArcs') {
        const settings = getNormalizedFibonacciSettings(drawing);
        const fullCircles = settings?.kind === 'fibArcs' && settings.fullCircles === true;
        const levels = resolveFibonacciLevels(drawing, FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES);
        const geometry = buildF1CFibArcsGeometry(
          { x: startX, y: startY },
          { x: endX, y: endY },
          levels,
          fullCircles,
        );
        if (geometry) {
          const trendHit = distanceToSegment(
            pointerState.clampedX,
            pointerState.localY,
            geometry.trend.start.x,
            geometry.trend.start.y,
            geometry.trend.end.x,
            geometry.trend.end.y,
          ) <= tolerance;
          const arcHit = geometry.levels.some((entry) => {
            const distance = Math.hypot(
              pointerState.clampedX - entry.center.x,
              pointerState.localY - entry.center.y,
            );
            return Math.abs(distance - entry.radius) <= tolerance && isPointInsideF1CFibArcSweep(
              { x: pointerState.clampedX, y: pointerState.localY },
              entry,
              tolerance,
            );
          });
          if (trendHit || arcHit) return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'circle') {
        const radius = Math.hypot(endX - startX, endY - startY);
        const distance = Math.hypot(pointerState.clampedX - startX, pointerState.localY - startY);
        if (distance <= radius + tolerance) return { drawing, mode: 'move' };
        continue;
      }

      if (drawing.kind === 'ellipse') {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radiusX = Math.max(Math.abs(endX - startX) / 2, 1);
        const radiusY = Math.max(Math.abs(endY - startY) / 2, 1);
        const dx = (pointerState.clampedX - centerX) / radiusX;
        const dy = (pointerState.localY - centerY) / radiusY;
        if (dx * dx + dy * dy <= 1.05 || distanceToEllipseBoundary(
          { x: pointerState.clampedX, y: pointerState.localY },
          { x: centerX, y: centerY },
          radiusX,
          radiusY,
        ) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'gannBox' || drawing.kind === 'forecast') {
        const left = Math.min(startX, endX);
        const right = Math.max(startX, endX);
        const top = Math.min(startY, endY);
        const bottom = Math.max(startY, endY);
        const inside =
          pointerState.clampedX >= left - tolerance &&
          pointerState.clampedX <= right + tolerance &&
          pointerState.localY >= top - tolerance &&
          pointerState.localY <= bottom + tolerance;
        if (inside) return { drawing, mode: 'move' };
        continue;
      }

      if (drawing.kind === 'extendedLine') {
        const segment = extendInfiniteLineToRect(
          { x: startX, y: startY },
          { x: endX, y: endY },
          pointerState.layout.chartWidth,
          pointerState.pane.plotHeight,
        );
        if (
          segment &&
          distanceToSegment(
            pointerState.clampedX,
            pointerState.localY,
            segment.start.x,
            segment.start.y,
            segment.end.x,
            segment.end.y,
          ) <= tolerance
        ) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'infoLine' || drawing.kind === 'trendAngle') {
        const segment = extendSegmentHorizontally(
          { x: startX, y: startY },
          { x: endX, y: endY },
          pointerState.layout.chartWidth,
          drawing.extendLeft === true,
          drawing.extendRight === true,
        );
        if (distanceToSegment(
          pointerState.clampedX,
          pointerState.localY,
          segment.start.x,
          segment.start.y,
          segment.end.x,
          segment.end.y,
        ) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'priceRange') {
        const top = Math.min(startY, endY);
        const bottom = Math.max(startY, endY);
        if (pointerState.localY >= top - tolerance && pointerState.localY <= bottom + tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'dateRange') {
        const left = Math.min(startX, endX);
        const right = Math.max(startX, endX);
        if (pointerState.clampedX >= left - tolerance && pointerState.clampedX <= right + tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'trendline') {
        const segment = extendSegmentHorizontally(
          { x: startX, y: startY },
          { x: endX, y: endY },
          pointerState.layout.chartWidth,
          drawing.extendLeft === true,
          drawing.extendRight === true,
        );
        if (distanceToSegment(
          pointerState.clampedX,
          pointerState.localY,
          segment.start.x,
          segment.start.y,
          segment.end.x,
          segment.end.y,
        ) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'arrow') {
        if (distanceToSegment(pointerState.clampedX, pointerState.localY, startX, startY, endX, endY) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'rect') {
        const left = Math.min(startX, endX);
        const right = Math.max(startX, endX);
        const top = Math.min(startY, endY);
        const bottom = Math.max(startY, endY);
        const onEdge =
          distanceToSegment(pointerState.clampedX, pointerState.localY, left, top, right, top) <= tolerance ||
          distanceToSegment(pointerState.clampedX, pointerState.localY, right, top, right, bottom) <= tolerance ||
          distanceToSegment(pointerState.clampedX, pointerState.localY, right, bottom, left, bottom) <= tolerance ||
          distanceToSegment(pointerState.clampedX, pointerState.localY, left, bottom, left, top) <= tolerance;
        const inside =
          pointerState.clampedX >= left &&
          pointerState.clampedX <= right &&
          pointerState.localY >= top &&
          pointerState.localY <= bottom;
        if (onEdge || inside) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'channel') {
        const offsetStartY = pointerState.pane.scaleY.toPixel(renderDrawing.startPrice + drawing.offset);
        const offsetEndY = pointerState.pane.scaleY.toPixel(renderDrawing.endPrice + drawing.offset);
        const base = extendSegmentHorizontally(
          { x: startX, y: startY },
          { x: endX, y: endY },
          pointerState.layout.chartWidth,
          drawing.extendLeft === true,
          drawing.extendRight === true,
        );
        const offset = extendSegmentHorizontally(
          { x: startX, y: offsetStartY },
          { x: endX, y: offsetEndY },
          pointerState.layout.chartWidth,
          drawing.extendLeft === true,
          drawing.extendRight === true,
        );
        const onLine =
          distanceToSegment(
            pointerState.clampedX,
            pointerState.localY,
            base.start.x,
            base.start.y,
            base.end.x,
            base.end.y,
          ) <= tolerance ||
          distanceToSegment(
            pointerState.clampedX,
            pointerState.localY,
            offset.start.x,
            offset.start.y,
            offset.end.x,
            offset.end.y,
          ) <= tolerance;
        const top = Math.min(base.start.y, base.end.y, offset.start.y, offset.end.y);
        const bottom = Math.max(base.start.y, base.end.y, offset.start.y, offset.end.y);
        const left = Math.min(base.start.x, base.end.x, offset.start.x, offset.end.x);
        const right = Math.max(base.start.x, base.end.x, offset.start.x, offset.end.x);
        const inside =
          pointerState.clampedX >= left &&
          pointerState.clampedX <= right &&
          pointerState.localY >= top &&
          pointerState.localY <= bottom;
        if (onLine || inside) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'ray') {
        const boundaryIndex = renderDrawing.endIndex >= renderDrawing.startIndex ? this.viewport.endIndex : this.viewport.startIndex;
        const boundaryX = pointerState.scaleX.toPixel(boundaryIndex);
        const projectedPrice =
          renderDrawing.startPrice +
          (boundaryIndex - renderDrawing.startIndex) *
            ((renderDrawing.endPrice - renderDrawing.startPrice) / normalizeIndexDelta(renderDrawing.endIndex - renderDrawing.startIndex));
        const boundaryY = pointerState.pane.scaleY.toPixel(projectedPrice);
        if (distanceToSegment(pointerState.clampedX, pointerState.localY, startX, startY, boundaryX, boundaryY) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'fib') {
        if (distanceToSegment(pointerState.clampedX, pointerState.localY, startX, startY, endX, endY) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        const levels = resolveFibonacciLevels(drawing, FIB_RETRACEMENT_LEVELS);
        const options = resolveFibonacciOptions(drawing);
        const geometry = buildF1BRetracementLevels(
          renderDrawing.startPrice,
          renderDrawing.endPrice,
          startX,
          endX,
          pointerState.layout.chartWidth,
          levels,
          drawing.extendLeft === true,
          getEffectiveDrawingExtendRight(drawing),
          options.reverse,
        );
        const matchedLevel = geometry.some((entry) => {
          if (pointerState.clampedX < entry.segment.start.x - tolerance || pointerState.clampedX > entry.segment.end.x + tolerance) {
            return false;
          }
          const levelY = pointerState.pane.scaleY.toPixel(entry.price);
          return Math.abs(pointerState.localY - levelY) <= tolerance;
        });
        if (matchedLevel) return { drawing, mode: 'move' };
        continue;
      }

      if (drawing.kind === 'fibExtension') {
        const priceDelta = renderDrawing.startPrice - renderDrawing.endPrice;
        if (distanceToSegment(pointerState.clampedX, pointerState.localY, startX, startY, endX, endY) <= tolerance) {
          return { drawing, mode: 'move' };
        }
        const boundaryX = pointerState.scaleX.toPixel(renderDrawing.endIndex >= renderDrawing.startIndex ? this.viewport.endIndex : this.viewport.startIndex);
        const baseLevelRange = { minX: Math.min(endX, boundaryX), maxX: Math.max(endX, boundaryX) };
        const levelRange = {
          minX: drawing.extendLeft === true ? 0 : baseLevelRange.minX,
          maxX: drawing.extendRight === true ? pointerState.layout.chartWidth : baseLevelRange.maxX,
        };
        if (pointerState.clampedX >= levelRange.minX - tolerance && pointerState.clampedX <= levelRange.maxX + tolerance) {
          const matchedLevel = FIB_EXTENSION_LEVELS.some((level) => {
            const levelY = pointerState.pane.scaleY.toPixel(renderDrawing.endPrice + priceDelta * level);
            return Math.abs(pointerState.localY - levelY) <= tolerance;
          });
          if (matchedLevel) return { drawing, mode: 'move' };
        }
        continue;
      }

      if (drawing.kind === 'fibFan') {
        const fanSettings = getNormalizedFibonacciSettings(drawing);
        const settings =
          fanSettings && fanSettings.kind === 'fibFan'
            ? fanSettings
            : (createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings);
        const geometry = buildF1EFibSpeedResistanceFanGeometry(
          renderDrawing.startIndex,
          renderDrawing.startPrice,
          renderDrawing.endIndex,
          renderDrawing.endPrice,
          settings,
          pointerState.scaleX,
          pointerState.pane.scaleY,
          pointerState.layout.chartWidth,
          pointerState.pane.plotHeight,
          this.viewport,
        );
        if (hitTestF1EFibSpeedResistanceFan({ x: pointerState.clampedX, y: pointerState.localY }, geometry, tolerance)) {
          return { drawing, mode: 'move' };
        }
        continue;
      }

      const boundaryIndex = renderDrawing.endIndex >= renderDrawing.startIndex ? this.viewport.endIndex : this.viewport.startIndex;
      const boundaryX = pointerState.scaleX.toPixel(boundaryIndex);
      const baseSlope = (renderDrawing.endPrice - renderDrawing.startPrice) / normalizeIndexDelta(renderDrawing.endIndex - renderDrawing.startIndex);
      const matchedFanLine = GANN_FAN_FACTORS.some((factor) => {
        const projectedPrice = renderDrawing.startPrice + (boundaryIndex - renderDrawing.startIndex) * baseSlope * factor;
        const projectedY = pointerState.pane.scaleY.toPixel(projectedPrice);
        return distanceToSegment(pointerState.clampedX, pointerState.localY, startX, startY, boundaryX, projectedY) <= tolerance;
      });
      if (matchedFanLine) {
        return { drawing, mode: 'move' };
      }
    }

    return null;
  }

  private buildUpdatedDrawingFromPointer(
    dragState: DrawingDragState,
    pointerState: PointerState,
  ): ChartDrawing | null {
    if (dragState.baseDrawing.kind !== 'vline' && this.getDrawingPaneId(dragState.baseDrawing) !== pointerState.pane.id) {
      return null;
    }

    const snappedPrice = this.snapValue(
      pointerState.barIndex,
      pointerState.price,
      this.getDrawingPaneId(dragState.baseDrawing),
      dragState.baseDrawing.kind,
    );
    if (dragState.baseDrawing.kind === 'hline') {
      return {
        ...dragState.baseDrawing,
        price: snappedPrice,
      };
    }

    if (dragState.baseDrawing.kind === 'vline') {
      return this.withCurrentRenkoAnchors({
        ...dragState.baseDrawing,
        barIndex: pointerState.barIndex,
      });
    }

    if (
      dragState.baseDrawing.kind === 'horizontalRay' ||
      dragState.baseDrawing.kind === 'crossLine' ||
      dragState.baseDrawing.kind === 'arrowMarker' ||
      dragState.baseDrawing.kind === 'arrowUp' ||
      dragState.baseDrawing.kind === 'arrowDown'
    ) {
      return this.withCurrentRenkoAnchors({
        ...dragState.baseDrawing,
        barIndex: pointerState.barIndex,
        price: snappedPrice,
      });
    }

    if (dragState.baseDrawing.kind === 'text') {
      if (isTextResizeHandle(dragState.mode)) {
        return this.withCurrentRenkoAnchors(this.resizeTextDrawing(dragState.baseDrawing, dragState.mode, pointerState));
      }
      return this.withCurrentRenkoAnchors({
        ...dragState.baseDrawing,
        barIndex: pointerState.barIndex,
        price: snappedPrice,
      });
    }

    if (isMultiAnchorDrawing(dragState.baseDrawing)) {
      if (dragState.mode === 'anchor' && typeof dragState.anchorOrdinal === 'number') {
        let anchors = dragState.baseDrawing.anchors.map((anchor, index) =>
          index === dragState.anchorOrdinal
            ? { ...anchor, barIndex: pointerState.barIndex, price: snappedPrice }
            : anchor,
        );
        if (dragState.baseDrawing.kind === 'longPosition' || dragState.baseDrawing.kind === 'shortPosition') {
          anchors = normalizePositionAnchors(dragState.baseDrawing.kind, anchors);
        }
        return this.withCurrentRenkoAnchors({ ...dragState.baseDrawing, anchors });
      }

      const deltaIndex = pointerState.barIndex - dragState.anchorIndex;
      const deltaPrice = snappedPrice - dragState.anchorPrice;
      const anchors = dragState.baseDrawing.anchors.map((anchor) => ({
        ...anchor,
        barIndex: Math.max(0, Math.min(this.bars.length - 1, anchor.barIndex + deltaIndex)),
        price: anchor.price + deltaPrice,
      }));
      return this.withCurrentRenkoAnchors({ ...dragState.baseDrawing, anchors });
    }

    if (dragState.baseDrawing.kind === 'fibSpiral' && (dragState.mode === 'start' || dragState.mode === 'end')) {
      const updated = {
        ...dragState.baseDrawing,
        ...(dragState.mode === 'start'
          ? { startIndex: pointerState.barIndex, startPrice: snappedPrice }
          : { endIndex: pointerState.barIndex, endPrice: snappedPrice }),
      } as Extract<ChartDrawing, { kind: 'fibSpiral' }>;
      return this.withCurrentRenkoAnchors(this.withFibSpiralBasis(updated, pointerState.scaleX, pointerState.pane.scaleY));
    }

    if (dragState.mode === 'start') {
      return this.withCurrentRenkoAnchors({
        ...dragState.baseDrawing,
        startIndex: pointerState.barIndex,
        startPrice: snappedPrice,
      });
    }

    if (dragState.mode === 'end') {
      return this.withCurrentRenkoAnchors({
        ...dragState.baseDrawing,
        endIndex: pointerState.barIndex,
        endPrice: snappedPrice,
      });
    }

    const deltaIndex = pointerState.barIndex - dragState.anchorIndex;
    const deltaPrice = snappedPrice - dragState.anchorPrice;
    return this.withCurrentRenkoAnchors({
      ...dragState.baseDrawing,
      startIndex: Math.max(0, Math.min(this.bars.length - 1, dragState.baseDrawing.startIndex + deltaIndex)),
      endIndex: Math.max(0, Math.min(this.bars.length - 1, dragState.baseDrawing.endIndex + deltaIndex)),
      startPrice: dragState.baseDrawing.startPrice + deltaPrice,
      endPrice: dragState.baseDrawing.endPrice + deltaPrice,
    });
  }

  private withFibSpiralBasis(
    drawing: Extract<ChartDrawing, { kind: 'fibSpiral' }>,
    scaleX: ScaleX,
    scaleY: ScaleY,
  ): Extract<ChartDrawing, { kind: 'fibSpiral' }> {
    const basis = buildF1DFibSpiralPerpBasis(
      { x: drawing.startIndex, y: drawing.startPrice },
      { x: drawing.endIndex, y: drawing.endPrice },
      (point) => ({ x: scaleX.toPixel(point.x), y: scaleY.toPixel(point.y) }),
      (point) => ({ x: scaleX.toIndex(point.x), y: scaleY.toPrice(point.y) }),
    );
    if (!basis) return drawing;
    const settings = getNormalizedFibonacciSettings(drawing);
    const fibonacci = settings?.kind === 'fibSpiral'
      ? { ...settings, basisPerp: basis }
      : { ...createDefaultFibonacciSettings('fibSpiral'), basisPerp: basis };
    return {
      ...drawing,
      toolSettings: { ...drawing.toolSettings, fibonacci },
    };
  }

  private resizeTextDrawing(
    drawing: Extract<ChartDrawing, { kind: 'text' }>,
    handle: TextResizeHandle,
    pointerState: PointerState,
  ): Extract<ChartDrawing, { kind: 'text' }> {
    const renderedDrawing = this.resolveDrawingForCurrentChart(drawing);
    const renderedText = renderedDrawing.kind === 'text' ? renderedDrawing : drawing;
    const box = getTextBoxBounds(renderedText, pointerState.scaleX, pointerState.pane.scaleY);
    const minimumWidth = 60;
    const minimumHeight = Math.max(20, Math.min(drawing.fontSize ?? 13, 28) + 8);
    let left = box.left;
    let right = box.left + box.width;
    let top = box.top;
    let bottom = box.top + box.height;

    if (handle.includes('w')) left = Math.min(pointerState.clampedX, right - minimumWidth);
    if (handle.includes('e')) right = Math.max(pointerState.clampedX, left + minimumWidth);
    if (handle.includes('n')) top = Math.min(pointerState.localY, bottom - minimumHeight);
    if (handle.includes('s')) bottom = Math.max(pointerState.localY, top + minimumHeight);

    return {
      ...drawing,
      barIndex: handle.includes('w') ? Math.max(0, Math.round(pointerState.scaleX.toIndex(left - 2))) : drawing.barIndex,
      price: handle.includes('s') ? pointerState.pane.scaleY.toPrice(bottom + 4) : drawing.price,
      width: Math.round(right - left),
      height: Math.round(bottom - top),
    };
  }

  private buildFibCircle45DegreeEndpoint(pointerState: PointerState): { index: number; price: number } | null {
    if (!this.pendingAnchorStart || this.pendingAnchorStart.paneId !== pointerState.pane.id) {
      return null;
    }

    const startX = pointerState.scaleX.toPixel(this.pendingAnchorStart.index);
    const startY = pointerState.pane.scaleY.toPixel(this.pendingAnchorStart.price);
    const snappedPixel = snapFibCirclePointTo45Degrees(
      { x: startX, y: startY },
      { x: pointerState.clampedX, y: pointerState.localY },
    );
    const index = normalizeAnchoredEndIndex(
      this.pendingAnchorStart.index,
      Math.round(pointerState.scaleX.toIndex(snappedPixel.x)),
      this.bars.length,
    );
    const resolvedX = pointerState.scaleX.toPixel(index);
    const yDirection = snappedPixel.y < startY ? -1 : 1;
    const resolvedY = startY + yDirection * Math.abs(resolvedX - startX);
    return {
      index,
      price: pointerState.pane.scaleY.toPrice(resolvedY),
    };
  }

  private buildDrawingFromPointer(offsetX: number, offsetY: number, shiftKey = false): ChartDrawing | null {
    const pointerState = this.getPointerState(offsetX, offsetY);
    if (!pointerState || pointerState.isInAxis || pointerState.pane.collapsed || !pointerState.isInPlot) {
      return null;
    }

    if (!this.isDrawingToolAllowedInPane(this.drawingTool, pointerState.pane.id)) {
      return null;
    }

    const snappedPrice = this.snapValue(
      pointerState.barIndex,
      pointerState.price,
      pointerState.pane.id,
      this.drawingTool,
    );

    if (this.drawingTool === 'hline') {
      return {
        id: crypto.randomUUID(),
        kind: 'hline',
        paneId: pointerState.pane.id,
        price: snappedPrice,
        color: DEFAULT_DRAWING_COLOR,
        lineWidth: 1.4,
        lineStyle: 'dashed',
        locked: false,
      };
    }

    if (this.drawingTool === 'vline') {
      return this.withCurrentRenkoAnchors({
        id: crypto.randomUUID(),
        kind: 'vline',
        barIndex: pointerState.barIndex,
        color: DEFAULT_DRAWING_COLOR,
        lineWidth: 1.4,
        lineStyle: 'dashed',
        locked: false,
      });
    }

    if (this.drawingTool === 'horizontalRay' || this.drawingTool === 'crossLine' || this.drawingTool === 'arrowMarker' || this.drawingTool === 'arrowUp' || this.drawingTool === 'arrowDown') {
      return this.withCurrentRenkoAnchors({
        id: crypto.randomUUID(),
        kind: this.drawingTool,
        paneId: pointerState.pane.id,
        barIndex: pointerState.barIndex,
        price: snappedPrice,
        color: DEFAULT_DRAWING_COLOR,
        lineWidth: 1.4,
        lineStyle: this.drawingTool === 'crossLine' ? 'dashed' : 'solid',
        locked: false,
      });
    }

    if (this.drawingTool === 'text') {
      return this.withCurrentRenkoAnchors(this.createTextDrawing(pointerState.barIndex, snappedPrice, pointerState.pane.id));
    }

    if (isMultiAnchorDrawingTool(this.drawingTool)) {
      const paneId = pointerState.pane.id;
      const nextAnchor: DrawingAnchor = { barIndex: pointerState.barIndex, price: snappedPrice };
      if (!this.pendingMultiAnchors) {
        this.pendingMultiAnchors = { paneId, anchors: [nextAnchor] };
        this.markDirty();
        return null;
      }
      if (this.pendingMultiAnchors.paneId !== paneId) {
        return null;
      }
      const anchors = [...this.pendingMultiAnchors.anchors, nextAnchor];
      const required = getRequiredMultiAnchorCount(this.drawingTool);
      if (anchors.length < required) {
        this.pendingMultiAnchors = { paneId, anchors };
        this.markDirty();
        return null;
      }
      const drawing = this.withCurrentRenkoAnchors(
        this.createMultiAnchorDrawing(this.drawingTool, anchors, paneId),
      );
      this.pendingMultiAnchors = null;
      this.markDirty();
      return drawing;
    }

    if (this.drawingTool === 'channel') {
      if (!this.pendingAnchorStart && !this.pendingChannelBase) {
        this.pendingAnchorStart = { paneId: pointerState.pane.id, index: pointerState.barIndex, price: snappedPrice };
        this.markDirty();
        return null;
      }

      if (this.pendingAnchorStart && !this.pendingChannelBase) {
        if (this.pendingAnchorStart.paneId !== pointerState.pane.id) {
          return null;
        }
        this.pendingChannelBase = {
          paneId: this.pendingAnchorStart.paneId,
          startIndex: this.pendingAnchorStart.index,
          startPrice: this.pendingAnchorStart.price,
          endIndex: normalizeAnchoredEndIndex(this.pendingAnchorStart.index, pointerState.barIndex, this.bars.length),
          endPrice: snappedPrice,
        };
        this.pendingAnchorStart = null;
        this.markDirty();
        return null;
      }

      if (this.pendingChannelBase) {
        const drawing = this.withCurrentRenkoAnchors(this.createChannelDrawing(
          this.pendingChannelBase.startIndex,
          this.pendingChannelBase.startPrice,
          this.pendingChannelBase.endIndex,
          this.pendingChannelBase.endPrice,
          this.computeChannelOffset(this.pendingChannelBase, pointerState.barIndex, snappedPrice),
          this.pendingChannelBase.paneId,
        ));
        this.pendingChannelBase = null;
        this.markDirty();
        return drawing;
      }
    }

    if (isTwoPointDrawingTool(this.drawingTool)) {
      if (!this.pendingAnchorStart) {
        this.pendingAnchorStart = { paneId: pointerState.pane.id, index: pointerState.barIndex, price: snappedPrice };
        this.markDirty();
        return null;
      }

      if (this.pendingAnchorStart.paneId !== pointerState.pane.id) {
        return null;
      }

      const fibCircleEnd =
        this.drawingTool === 'fibCircles' && shiftKey
          ? this.buildFibCircle45DegreeEndpoint(pointerState)
          : null;
      let drawing = this.withCurrentRenkoAnchors(this.createAnchoredDrawing(
        this.drawingTool as Extract<DrawingTool, 'trendline' | 'extendedLine' | 'infoLine' | 'trendAngle' | 'priceRange' | 'dateRange' | 'regressionTrend' | 'fibTimeZone' | 'fibCircles' | 'fibSpiral' | 'fibArcs' | 'gannBox' | 'circle' | 'ellipse' | 'forecast' | 'ray' | 'arrow' | 'rect' | 'fib' | 'fibExtension' | 'fibFan' | 'gann' | 'measure'>,
        this.pendingAnchorStart.index,
        this.pendingAnchorStart.price,
        fibCircleEnd?.index ?? pointerState.barIndex,
        fibCircleEnd?.price ?? snappedPrice,
        this.pendingAnchorStart.paneId,
      ));
      if (drawing.kind === 'fibSpiral') {
        drawing = this.withFibSpiralBasis(drawing, pointerState.scaleX, pointerState.pane.scaleY);
      }
      this.pendingAnchorStart = null;
      this.fibCircleShiftPreview = null;
      this.markDirty();
      return drawing;
    }

    return null;
  }

  private buildHorizontalLineFromCrosshair(): ChartDrawing | null {
    if (!this.crosshair.visible || !this.isDrawingToolAllowedInPane('hline', this.crosshair.paneId)) {
      return null;
    }

    return {
      id: 'preview-hline',
      kind: 'hline',
      paneId: this.crosshair.paneId,
      price: this.snapValue(this.crosshair.barIndex, this.crosshair.value, this.crosshair.paneId, 'hline'),
      color: DEFAULT_DRAWING_PREVIEW_COLOR,
      lineWidth: 1.4,
      lineStyle: 'dashed',
    };
  }

  private buildVerticalLineFromCrosshair(): ChartDrawing | null {
    if (!this.crosshair.visible) {
      return null;
    }

    return {
      id: 'preview-vline',
      kind: 'vline',
      barIndex: this.crosshair.barIndex,
      color: DEFAULT_DRAWING_PREVIEW_COLOR,
      lineWidth: 1.4,
      lineStyle: 'dashed',
    };
  }

  private buildPointDrawingFromCrosshair(tool: Extract<DrawingTool, 'horizontalRay' | 'crossLine' | 'arrowMarker' | 'arrowUp' | 'arrowDown'>): ChartDrawing | null {
    if (!this.crosshair.visible || !this.isDrawingToolAllowedInPane(tool, this.crosshair.paneId)) {
      return null;
    }

    return {
      id: `preview-${tool}`,
      kind: tool,
      paneId: this.crosshair.paneId,
      barIndex: this.crosshair.barIndex,
      price: this.snapValue(this.crosshair.barIndex, this.crosshair.value, this.crosshair.paneId, tool),
      color: DEFAULT_DRAWING_PREVIEW_COLOR,
      lineWidth: 1.4,
      lineStyle: tool === 'crossLine' ? 'dashed' : 'solid',
      locked: false,
    };
  }

  private buildAnchoredDrawingPreview(
    tool: Extract<DrawingTool, 'trendline' | 'extendedLine' | 'infoLine' | 'trendAngle' | 'priceRange' | 'dateRange' | 'regressionTrend' | 'fibTimeZone' | 'fibCircles' | 'fibSpiral' | 'fibArcs' | 'gannBox' | 'circle' | 'ellipse' | 'forecast' | 'ray' | 'arrow' | 'rect' | 'fib' | 'fibExtension' | 'fibFan' | 'gann' | 'measure'>,
  ): ChartDrawing | null {
    if (!this.pendingAnchorStart || !this.crosshair.visible || this.pendingAnchorStart.paneId !== this.crosshair.paneId) {
      return null;
    }

    const previewEnd = tool === 'fibCircles' ? this.fibCircleShiftPreview : null;
    const endIndex = previewEnd?.index ?? this.crosshair.barIndex;
    const endPrice = previewEnd?.price ?? this.snapValue(
      this.crosshair.barIndex,
      this.crosshair.value,
      this.pendingAnchorStart.paneId,
      tool,
    );

    return this.createAnchoredDrawing(
      tool,
      this.pendingAnchorStart.index,
      this.pendingAnchorStart.price,
      endIndex,
      endPrice,
      this.pendingAnchorStart.paneId,
      true,
    );
  }

  private buildMultiAnchorDrawingPreview(tool: MultiAnchorDrawingTool): ChartDrawing | null {
    if (!this.pendingMultiAnchors || !this.crosshair.visible || this.pendingMultiAnchors.paneId !== this.crosshair.paneId) {
      return null;
    }

    const paneId = this.pendingMultiAnchors.paneId;
    const liveAnchor: DrawingAnchor = {
      barIndex: this.crosshair.barIndex,
      price: this.snapValue(this.crosshair.barIndex, this.crosshair.value, paneId, tool),
    };
    const required = getRequiredMultiAnchorCount(tool);
    const anchors = [...this.pendingMultiAnchors.anchors, liveAnchor];
    while (anchors.length < required) {
      anchors.push({ ...liveAnchor });
    }
    return this.createMultiAnchorDrawing(tool, anchors.slice(0, required), paneId, true);
  }

  private createMultiAnchorDrawing(
    kind: MultiAnchorDrawingTool,
    anchors: readonly DrawingAnchor[],
    paneId: ChartPaneId,
    preview = false,
  ): ChartDrawing {
    const required = getRequiredMultiAnchorCount(kind);
    let normalized = anchors.slice(0, required).map((anchor) => ({
      ...anchor,
      barIndex: Math.max(0, Math.min(Math.max(this.bars.length - 1, 0), Math.round(anchor.barIndex))),
    }));
    if (kind === 'longPosition' || kind === 'shortPosition') {
      normalized = normalizePositionAnchors(kind, normalized);
    }
    if (normalized.length !== required) {
      throw new Error(`Drawing ${kind} requires ${required} anchors.`);
    }
    return {
      id: preview ? `preview-${kind}` : crypto.randomUUID(),
      kind,
      paneId,
      anchors: normalized,
      color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
      lineWidth: 1.4,
      lineStyle: 'solid',
      locked: false,
      extendLeft: false,
      extendRight:
        kind === 'andrewsPitchfork' ||
        kind === 'schiffPitchfork' ||
        kind === 'modifiedSchiffPitchfork' ||
        kind === 'insidePitchfork' ||
        kind === 'trendFibExtension' ||
        kind === 'pitchfan',
      ...(isFibonacciToolKind(kind) ? { toolSettings: { fibonacci: createDefaultFibonacciSettings(kind) } } : {}),
      showLabel: true,
    } as ChartDrawing;
  }

  private snapValue(
    barIndex: number,
    rawPrice: number,
    paneId: ChartPaneId = 'price',
    drawingKind?: DrawingTool | ChartDrawing['kind'],
  ): number {
    const bar = this.bars[Math.max(0, Math.min(this.bars.length - 1, barIndex))];
    return resolveMagnetPrice(this.magnetEnabled, drawingKind, paneId, bar, rawPrice);
  }

  private createAnchoredDrawing(
    kind: Extract<DrawingTool, 'trendline' | 'extendedLine' | 'infoLine' | 'trendAngle' | 'priceRange' | 'dateRange' | 'regressionTrend' | 'fibTimeZone' | 'fibCircles' | 'fibSpiral' | 'fibArcs' | 'gannBox' | 'circle' | 'ellipse' | 'forecast' | 'ray' | 'arrow' | 'rect' | 'fib' | 'fibExtension' | 'fibFan' | 'gann' | 'measure'>,
    startIndex: number,
    startPrice: number,
    endIndex: number,
    endPrice: number,
    paneId: ChartPaneId,
    preview = false,
  ): ChartDrawing {
    const normalizedEndIndex = normalizeAnchoredEndIndex(startIndex, endIndex, this.bars.length);
    const drawingId = preview ? `preview-${kind}` : crypto.randomUUID();

    if (kind === 'trendline') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.6,
        lineStyle: 'solid',
        locked: false,
      };
    }

    if (
      kind === 'extendedLine' ||
      kind === 'infoLine' ||
      kind === 'trendAngle' ||
      kind === 'priceRange' ||
      kind === 'dateRange' ||
      kind === 'regressionTrend' ||
      kind === 'fibTimeZone' ||
      kind === 'fibCircles' ||
      kind === 'fibSpiral' ||
      kind === 'fibArcs' ||
      kind === 'gannBox' ||
      kind === 'circle' ||
      kind === 'ellipse' ||
      kind === 'forecast'
    ) {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: kind === 'priceRange' || kind === 'dateRange' || kind === 'fibTimeZone' || kind === 'fibCircles' || kind === 'fibSpiral' || kind === 'fibArcs' ? 1.2 : 1.5,
        lineStyle: kind === 'dateRange' || kind === 'fibTimeZone' ? 'dashed' : 'solid',
        locked: false,
        ...(isFibonacciToolKind(kind) ? { toolSettings: { fibonacci: createDefaultFibonacciSettings(kind) } } : {}),
      };
    }

    if (kind === 'ray') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.6,
        lineStyle: 'solid',
        locked: false,
      };
    }

    if (kind === 'arrow') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.6,
        lineStyle: 'solid',
        locked: false,
      };
    }

    if (kind === 'rect') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.4,
        lineStyle: 'solid',
        locked: false,
      };
    }

    if (kind === 'fib') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.2,
        lineStyle: 'solid',
        locked: false,
        extendLeft: false,
        extendRight: true,
        toolSettings: { fibonacci: createDefaultFibonacciSettings(kind) },
      };
    }

    if (kind === 'fibExtension') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.2,
        lineStyle: 'solid',
        locked: false,
        toolSettings: { fibonacci: createDefaultFibonacciSettings(kind) },
      };
    }

    if (kind === 'fibFan') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
        lineWidth: 1.2,
        lineStyle: 'solid',
        locked: false,
        toolSettings: { fibonacci: createDefaultFibonacciSettings(kind) },
      };
    }

    if (kind === 'gann') {
      return {
        id: drawingId,
        kind,
        paneId,
        startIndex,
        startPrice,
        endIndex: normalizedEndIndex,
        endPrice,
        color: DEFAULT_DRAWING_COLOR,
        lineWidth: 1.4,
        lineStyle: 'solid',
        locked: false,
      };
    }

    return {
      id: drawingId,
      kind: 'measure',
      paneId,
      startIndex,
      startPrice,
      endIndex: normalizedEndIndex,
      endPrice,
      color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
      lineWidth: 1.2,
      lineStyle: 'dotted',
      locked: false,
    };
  }

  private createTextDrawing(barIndex: number, price: number, paneId: ChartPaneId, preview = false): ChartDrawing {
    return {
      id: preview ? 'preview-text' : crypto.randomUUID(),
      kind: 'text',
      paneId,
      barIndex,
      price,
      text: 'Text',
      fontSize: 13,
      width: 180,
      height: 32,
      fontFamily: 'sans',
      textAlign: 'left',
      color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
      locked: false,
    };
  }

  private createChannelDrawing(
    startIndex: number,
    startPrice: number,
    endIndex: number,
    endPrice: number,
    offset: number,
    paneId: ChartPaneId,
    preview = false,
  ): ChartDrawing {
    return {
      id: preview ? 'preview-channel' : crypto.randomUUID(),
      kind: 'channel',
      paneId,
      startIndex,
      startPrice,
      endIndex: normalizeAnchoredEndIndex(startIndex, endIndex, this.bars.length),
      endPrice,
      offset,
      color: preview ? DEFAULT_DRAWING_PREVIEW_COLOR : DEFAULT_DRAWING_COLOR,
      lineWidth: 1.4,
      lineStyle: 'solid',
      locked: false,
    };
  }

  private computeChannelOffset(
    base: { startIndex: number; startPrice: number; endIndex: number; endPrice: number },
    barIndex: number,
    price: number,
  ): number {
    const slope = (base.endPrice - base.startPrice) / normalizeIndexDelta(base.endIndex - base.startIndex);
    const basePriceAtBar = base.startPrice + (barIndex - base.startIndex) * slope;
    return price - basePriceAtBar;
  }

  private buildEventMarkers(scaleX: ScaleX, plotHeight: number) {
    const markerMap = new Map<number, ChartMarkerEvent[]>();
    this.chartEvents.forEach((event) => {
      const barIndex = this.findEventBarIndex(event.effectiveDate);
      if (barIndex < this.viewport.startIndex || barIndex > this.viewport.endIndex) {
        return;
      }
      const bucket = markerMap.get(barIndex) ?? [];
      bucket.push(event);
      markerMap.set(barIndex, bucket);
    });

    return [...markerMap.entries()].flatMap(([barIndex, events]) =>
      events.map((event, lane) => ({
        event,
        barIndex,
        x: scaleX.toPixel(barIndex),
        y: Math.max(6, plotHeight - 20 - lane * 18),
        lane,
      })),
    );
  }

  private findEventBarIndex(effectiveDate: string): number {
    if (!this.bars.length) {
      return -1;
    }

    const exactIndex = this.bars.findIndex((bar) => bar.date === effectiveDate);
    if (exactIndex >= 0) {
      return exactIndex;
    }

    const nextIndex = this.bars.findIndex((bar) => bar.date > effectiveDate);
    if (nextIndex >= 0) {
      return nextIndex;
    }

    return this.bars.length - 1;
  }

  private startKineticScroll() {
    let lastTime = performance.now();
    const friction = 0.92;
    
    const animate = (time: number) => {
      if (Math.abs(this.panVelocity) < 0.01) {
        this.kineticAnimationId = null;
        return;
      }
      
      const dt = time - lastTime;
      lastTime = time;
      
      const dx = this.panVelocity * dt;
      const layout = computeChartLayout(
        this.container.clientWidth,
        this.container.clientHeight,
        this.axisWidth,
        this.leftAxisWidth,
        this.xAxisHeight,
        this.volumePct,
        Object.keys(this.paneHeightOverrides),
        this.paneHeightOverrides,
        this.collapsedIndicatorPanes
      );
      const scaleX = buildScaleX(this.viewport, layout.chartWidth);
      
      this.viewport = panViewport(
        this.viewport,
        dx,
        scaleX,
        this.bars.length,
        this.futureMarginMode,
      );
      this.emit({ type: 'viewportChange', viewport: this.viewport });
      this.markDirty();
      
      this.panVelocity *= Math.pow(friction, dt / 16.666);
      this.kineticAnimationId = requestAnimationFrame(animate);
    };
    
    this.kineticAnimationId = requestAnimationFrame(animate);
  }
}

export function computeChartLayout(
  width: number,
  height: number,
  axisWidth: number,
  leftAxisWidth: number,
  xAxisHeight: number,
  volumePct: number,
  paneIds: string[],
  paneHeightOverrides: IndicatorPaneHeights = {},
  collapsedIndicatorPanes: CollapsedIndicatorPanes = {},
): ChartLayout {
  const chartWidth = Math.max(width - axisWidth - leftAxisWidth, 0);
  const contentHeight = Math.max(height - xAxisHeight, 0);
  const extraPaneCount = paneIds.length;
  const defaultPaneHeight =
    extraPaneCount > 0
      ? Math.max(MIN_INDICATOR_PANE_HEIGHT, Math.min(148, Math.floor(contentHeight / (extraPaneCount + 2.9))))
      : 0;
  const volumeHeight = volumePct > 0 ? Math.max(42, Math.min(64, Math.floor(contentHeight * volumePct))) : 0;
  const availablePaneArea = contentHeight;
  const desiredMinPriceHeight = Math.min(180, Math.max(72, Math.floor(availablePaneArea * 0.34)));
  const guaranteedPriceHeight = Math.max(availablePaneArea - extraPaneCount * MIN_INDICATOR_PANE_HEIGHT, 0);
  const minPriceHeight = extraPaneCount > 0 ? Math.min(desiredMinPriceHeight, guaranteedPriceHeight) : availablePaneArea;
  const maxPaneTotal = Math.max(availablePaneArea - minPriceHeight, 0);
  const desiredPaneHeights = paneIds.map((paneId) =>
    collapsedIndicatorPanes[paneId]
      ? COLLAPSED_INDICATOR_PANE_HEIGHT
      : Math.max(
          MIN_INDICATOR_PANE_HEIGHT,
          Math.min(MAX_INDICATOR_PANE_HEIGHT, Math.round(paneHeightOverrides[paneId] ?? defaultPaneHeight)),
        ),
  );
  const minPaneHeights = paneIds.map((paneId) =>
    collapsedIndicatorPanes[paneId] ? COLLAPSED_INDICATOR_PANE_HEIGHT : MIN_INDICATOR_PANE_HEIGHT,
  );
  const paneHeights = fitPaneHeights(
    desiredPaneHeights,
    minPaneHeights,
    maxPaneTotal,
  );
  const occupiedAuxHeight = paneHeights.reduce((sum, paneHeight) => sum + paneHeight, 0);
  const priceHeight = Math.max(contentHeight - occupiedAuxHeight, 0);
  const paneTops: number[] = [];
  let paneTop = priceHeight;
  paneHeights.forEach((nextPaneHeight) => {
    paneTops.push(paneTop);
    paneTop += nextPaneHeight;
  });
  const priceAxisGap = 0;

  return {
    axisWidth,
    leftAxisWidth,
    chartWidth,
    contentHeight,
    priceHeight,
    volumeHeight,
    paneHeight: paneHeights[0] ?? 0,
    paneHeights,
    paneTops,
    priceAxisGap,
  };
}

function fitPaneHeights(rawPaneHeights: number[], minPaneHeights: number[], maxPaneTotal: number): number[] {
  const nextPaneHeights = [...rawPaneHeights];
  let total = nextPaneHeights.reduce((sum, paneHeight) => sum + paneHeight, 0);
  if (total <= maxPaneTotal) {
    return nextPaneHeights;
  }

  while (total > maxPaneTotal) {
    let reducedThisPass = false;
    for (let index = nextPaneHeights.length - 1; index >= 0 && total > maxPaneTotal; index -= 1) {
      if (nextPaneHeights[index] > (minPaneHeights[index] ?? MIN_INDICATOR_PANE_HEIGHT)) {
        nextPaneHeights[index] -= 1;
        total -= 1;
        reducedThisPass = true;
      }
    }

    if (!reducedThisPass) {
      break;
    }
  }

  return nextPaneHeights;
}

function computePriceLegendTopPadding(plotHeight: number): number {
  const desiredClearance = Math.min(PRICE_LEGEND_IN_PLOT_CLEARANCE, Math.max(plotHeight * 0.16, 0));
  const bottomPad = 0.05;
  const topPad = (desiredClearance * (1 + bottomPad)) / Math.max(plotHeight - desiredClearance, 1);
  return Math.max(0.05, Math.min(0.18, topPad));
}

function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return distanceBetween(px, py, x1, y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return distanceBetween(px, py, closestX, closestY);
}

function isTwoPointDrawingTool(
  tool: DrawingTool,
): tool is Extract<DrawingTool, 'trendline' | 'extendedLine' | 'infoLine' | 'trendAngle' | 'priceRange' | 'dateRange' | 'regressionTrend' | 'fibTimeZone' | 'fibCircles' | 'fibSpiral' | 'fibArcs' | 'gannBox' | 'circle' | 'ellipse' | 'forecast' | 'ray' | 'arrow' | 'rect' | 'fib' | 'fibExtension' | 'fibFan' | 'gann' | 'measure'> {
  return (
    tool === 'trendline' ||
    tool === 'extendedLine' ||
    tool === 'infoLine' ||
    tool === 'trendAngle' ||
    tool === 'priceRange' ||
    tool === 'dateRange' ||
    tool === 'regressionTrend' ||
    tool === 'fibTimeZone' ||
    tool === 'fibCircles' ||
    tool === 'fibSpiral' ||
    tool === 'fibArcs' ||
    tool === 'gannBox' ||
    tool === 'circle' ||
    tool === 'ellipse' ||
    tool === 'forecast' ||
    tool === 'ray' ||
    tool === 'arrow' ||
    tool === 'rect' ||
    tool === 'fib' ||
    tool === 'fibExtension' ||
    tool === 'fibFan' ||
    tool === 'gann' ||
    tool === 'measure'
  );
}

function isChannelDrawingTool(tool: DrawingTool): tool is 'channel' {
  return tool === 'channel';
}

export function resolveMagnetPrice(
  magnetEnabled: boolean,
  drawingKind: DrawingTool | ChartDrawing['kind'] | undefined,
  paneId: ChartPaneId,
  bar: OHLCBar | undefined,
  rawPrice: number,
): number {
  if (!magnetEnabled || drawingKind === 'text' || paneId !== 'price' || !bar) {
    return rawPrice;
  }

  return Math.abs(bar.high - rawPrice) <= Math.abs(bar.low - rawPrice) ? bar.high : bar.low;
}

function resolvePointerCursor(tool: DrawingTool): string {
  if (tool === 'cursor') {
    return 'default';
  }
  if (tool === 'crosshair') {
    return 'crosshair';
  }
  return 'copy';
}

function getTextResizeHandle(x: number, y: number, box: import('./Renderer').TextBoxBounds, tolerance: number): TextResizeHandle | null {
  const handles: Array<[TextResizeHandle, number, number]> = [
    ['text-nw', box.left, box.top],
    ['text-n', box.left + box.width / 2, box.top],
    ['text-ne', box.left + box.width, box.top],
    ['text-e', box.left + box.width, box.top + box.height / 2],
    ['text-se', box.left + box.width, box.top + box.height],
    ['text-s', box.left + box.width / 2, box.top + box.height],
    ['text-sw', box.left, box.top + box.height],
    ['text-w', box.left, box.top + box.height / 2],
  ];
  return handles.find(([, handleX, handleY]) => distanceBetween(x, y, handleX, handleY) <= tolerance)?.[0] ?? null;
}

function isTextResizeHandle(mode: DrawingHitTarget['mode']): mode is TextResizeHandle {
  return mode.startsWith('text-');
}

function resolveDrawingHitCursor(mode: DrawingHitTarget['mode']): string {
  if (mode === 'text-n' || mode === 'text-s') return 'ns-resize';
  if (mode === 'text-e' || mode === 'text-w') return 'ew-resize';
  if (mode === 'text-nw' || mode === 'text-se') return 'nwse-resize';
  if (mode === 'text-ne' || mode === 'text-sw') return 'nesw-resize';
  return 'pointer';
}

export function resolveChartTheme(baseTheme: ChartTheme, settings: ChartVisualSettings): ChartTheme {
  return {
    ...baseTheme,
    // The legacy default is a chart-local fallback, not a deliberate override.
    // Let the application theme provide the canvas background until the user
    // selects a different color in Chart Settings.
    background:
      settings.backgroundColor === DEFAULT_CHART_VISUAL_SETTINGS.backgroundColor
        ? baseTheme.background
        : settings.backgroundColor,
    gridLine: settings.gridVisible
      ? (settings.gridColor === DEFAULT_CHART_VISUAL_SETTINGS.gridColor
          ? baseTheme.gridLine
          : settings.gridColor)
      : 'rgba(0, 0, 0, 0)',
    gridLineMajor: settings.gridVisible
      ? (settings.gridMajorColor === DEFAULT_CHART_VISUAL_SETTINGS.gridMajorColor
          ? baseTheme.gridLineMajor
          : settings.gridMajorColor)
      : 'rgba(0, 0, 0, 0)',
    sessionHighlight: settings.gridVisible ? baseTheme.sessionHighlight : undefined,
    crosshair:
      settings.crosshairColor === DEFAULT_CHART_VISUAL_SETTINGS.crosshairColor
        ? baseTheme.crosshair
        : settings.crosshairColor,
    renkoUp: settings.renkoUpColor,
    renkoDown: settings.renkoDownColor,
    renkoWickUp: settings.renkoWickUpColor,
    renkoWickDown: settings.renkoWickDownColor,
    renkoProjectionUp: settings.renkoProjectionUpColor,
    renkoProjectionDown: settings.renkoProjectionDownColor,
    renkoProjectionUpBorder: settings.renkoProjectionUpBorderColor,
    renkoProjectionDownBorder: settings.renkoProjectionDownBorderColor,
  };
}

function isPointAnchoredDrawing(
  drawing: ChartDrawing,
): drawing is Extract<ChartDrawing, { kind: 'vline' | 'text' | 'horizontalRay' | 'crossLine' | 'arrowMarker' | 'arrowUp' | 'arrowDown' }> {
  return (
    drawing.kind === 'vline' ||
    drawing.kind === 'text' ||
    drawing.kind === 'horizontalRay' ||
    drawing.kind === 'crossLine' ||
    drawing.kind === 'arrowMarker' ||
    drawing.kind === 'arrowUp' ||
    drawing.kind === 'arrowDown'
  );
}

function isMultiAnchorDrawing(
  drawing: ChartDrawing,
): drawing is Extract<ChartDrawing, { anchors: DrawingAnchor[] }> {
  return (
    drawing.kind === 'flatChannel' ||
    drawing.kind === 'disjointChannel' ||
    drawing.kind === 'triangle' ||
    drawing.kind === 'rotatedRect' ||
    drawing.kind === 'arc' ||
    drawing.kind === 'andrewsPitchfork' ||
    drawing.kind === 'schiffPitchfork' ||
    drawing.kind === 'modifiedSchiffPitchfork' ||
    drawing.kind === 'insidePitchfork' ||
    drawing.kind === 'trendFibExtension' ||
    drawing.kind === 'fibChannel' ||
    drawing.kind === 'fibTimeExtension' ||
    drawing.kind === 'fibWedge' ||
    drawing.kind === 'pitchfan' ||
    drawing.kind === 'longPosition' ||
    drawing.kind === 'shortPosition' ||
    drawing.kind === 'projection'
  );
}

function isAnchoredDrawing(drawing: ChartDrawing): drawing is Extract<ChartDrawing, { startIndex: number }> {
  return (
    drawing.kind === 'trendline' ||
    drawing.kind === 'extendedLine' ||
    drawing.kind === 'infoLine' ||
    drawing.kind === 'trendAngle' ||
    drawing.kind === 'priceRange' ||
    drawing.kind === 'dateRange' ||
    drawing.kind === 'regressionTrend' ||
    drawing.kind === 'fibTimeZone' ||
    drawing.kind === 'fibCircles' ||
    drawing.kind === 'fibSpiral' ||
    drawing.kind === 'fibArcs' ||
    drawing.kind === 'gannBox' ||
    drawing.kind === 'circle' ||
    drawing.kind === 'ellipse' ||
    drawing.kind === 'forecast' ||
    drawing.kind === 'ray' ||
    drawing.kind === 'arrow' ||
    drawing.kind === 'rect' ||
    drawing.kind === 'channel' ||
    drawing.kind === 'fib' ||
    drawing.kind === 'fibExtension' ||
    drawing.kind === 'fibFan' ||
    drawing.kind === 'gann' ||
    drawing.kind === 'measure'
  );
}

function normalizeIndexDelta(deltaIndex: number): number {
  return deltaIndex === 0 ? 1 : deltaIndex;
}

function normalizeAnchoredEndIndex(startIndex: number, endIndex: number, totalBars: number): number {
  if (startIndex !== endIndex) {
    return endIndex;
  }

  if (totalBars <= 1) {
    return endIndex + 1;
  }

  if (endIndex < totalBars - 1) {
    return endIndex + 1;
  }

  return Math.max(0, endIndex - 1);
}

function approximateTextWidth(text: string, fontSize: number): number {
  return Math.max(24, Math.round(text.length * fontSize * 0.58));
}

function mustGetContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire 2D canvas context.');
  }
  return context;
}


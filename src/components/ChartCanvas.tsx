import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { InstrumentKey, InstrumentSummary } from '@/platform';
import { getDesktopApi } from '@/platform';
import { ChartEngine, computeChartLayout, PRICE_AXIS_HEADER_HEIGHT, SHARED_AXIS_WIDTH } from '@/engine/ChartEngine';
import { countVisibleBars, getAllowedFutureBars } from '@/engine/ScaleManager';
import { createDrawingPresentationDraft, isAdvancedDrawingStyleKind } from '@/engine/DrawingStyleSchema';
import { normalizePositionAnchors } from '@/engine/DrawingD3CGeometry';
import { normalizeFibonacciDrawing, getNormalizedFibonacciSettings } from '@/engine/DrawingFibonacciMigration';
import {
  drawingSupportsExtension,
  drawingSupportsLabelPosition,
  drawingSupportsLabelVisibility,
  getDrawingLabelPosition,
  getEffectiveDrawingExtendRight,
} from '@/engine/DrawingCapabilities';
import { INDICATOR_CATALOG } from '@/indicators/catalog';
import { SignalSettingsDialog } from '@/components/SignalSettingsDialog';
import {
  DEFAULT_RENKO_SETTINGS,
  normalizeRenkoSettings,
} from '@/features/charts/chartTypeTransformService';
import type {
  ChartType,
  ChartCompareOverlay,
  ChartDrawing,
  ChartVisualSettings,
  ChartMarkerEvent,
  CollapsedIndicatorPanes,
  DrawingTool,
  IndicatorPaneHeights,
  OHLCBar,
  OverlayIndicator,
  PaneScaleOverrides,
  RenkoSettings,
  Viewport,
} from '@/engine/types';
import {
  DEFAULT_CHART_VISUAL_SETTINGS,
  normalizeChartVisualSettings,
} from '@/engine/types';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useUiStore, type ScannerChartOverlay } from '@/store/uiStore';
import { buildScannerPatternDrawingOverlay, clusterScannerPatternMapEntries, type ScannerPatternMapEntry } from '@/plugins/scanner/scannerPatternMap';
import { getLoadedScannerPriceBasis, resolveScannerOverlayPriceBasis, type ScannerChartContext } from '@/plugins/scanner/scannerChartPriceBasis';
import { getChartTheme } from '@/features/app/themeService';
import {
  readAppSettings,
  subscribeAppSettingsChanges,
  writeAppSettings,
  type AppSettings,
} from '@/features/app/appSettingsService';
import { buildDrawingAlertGeometryPatch, createDrawingAlertRule, createIndicatorAlertRule } from '@/features/alerts/eodAlerts';
import { getDefaultIndicatorAlertPresetForIndicator, getIndicatorAlertSourceUnsupportedReason } from '@/features/alerts/indicatorAlertContracts';
import { getCompactIndicatorDisplayLabel, type IndicatorCatalogId } from '@/indicators/catalog';
import {
  buildChartScreenshotFileName,
  copyCanvasPngToClipboard,
  downloadCanvasPng,
  pngBase64FromCanvas,
} from '@/features/charts/chartScreenshotService';
import { drawScreenshotPriceLegend } from '@/features/charts/chartScreenshotLegendRenderer';
import { DEFAULT_CHART_VALUE_LABEL_SETTINGS } from '@/engine/valueLabelSettings';
import { useChartDisplaySync } from '@/features/charts/useChartDisplaySync';
import { shouldHandleChartViewportShortcut } from '@/features/charts/chartKeyboardFocusService';
import { chartTimeframeForShortcut } from '@/features/charts/chartTimeframeShortcutService';
import { ChartContextMenu, type ChartContextMenuState } from './ChartContextMenu';
import { ChartSettingsDialog } from './ChartSettingsDialog';
import { ChartSettingsMenu, resolveChartSettingsMenuWidth } from './ChartSettingsMenu';
import { ChartDrawingContextMenu, type DrawingContextMenuState } from './ChartDrawingContextMenu';
import { ChartDrawingPropertiesDialog, type DrawingPropertiesState } from './ChartDrawingPropertiesDialog';
import { ChartPaneControlsOverlay } from './ChartPaneControlsOverlay';
import { buildChartPriceLegendSnapshot, ChartPriceLegendOverlay } from './ChartPriceLegendOverlay';
import { computeGannSetup, DEFAULT_GANN_OPTIONS } from '@/plugins/analysis/gannPriceTime/engine';
import { renderGannOverlay } from '@/plugins/analysis/gannPriceTime/canvasOverlay';
import { isPluginEnabled, pluginHost } from '@/plugins/registry';
import { GANN_PRICE_TIME_PLUGIN_ID } from '@/plugins/analysis/gannPriceTime/gannPlugin';

const DEFAULT_VOLUME_PCT = 0.14;
const CHART_CONTEXT_MENU_WIDTH = 190;
const CHART_CONTEXT_MENU_EXPANDED_HEIGHT = 360;

interface InlineTextEditorState {
  drawingId: string;
  text: string;
  isNew: boolean;
  x: number;
  y: number;
}

interface ChartCanvasProps {
  tabId?: string | null;
  instrument: InstrumentKey | null;
  instrumentMeta?: InstrumentSummary | null;
  bars: OHLCBar[];
  chartType: ChartType;
  renkoBrickSize?: number;
  renkoSettings?: RenkoSettings;
  visualSettings?: ChartVisualSettings;
  events: ChartMarkerEvent[];
  compareOverlays: ChartCompareOverlay[];
  overlays: OverlayIndicator[];
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  indicatorPaneHeight: number;
  indicatorPaneHeights: IndicatorPaneHeights;
  collapsedIndicatorPanes: CollapsedIndicatorPanes;
  paneScaleOverrides: PaneScaleOverrides;
  viewport: Viewport;
  scannerChartOverlay?: ScannerChartOverlay | null;
  loading: boolean;
  bottomBarStartContent?: ReactNode;
}

const ZOOM_BUTTON_STEP = 1.18;

export function ChartCanvas({
  tabId = null,
  instrument,
  instrumentMeta = null,
  bars,
  chartType,
  renkoBrickSize,
  renkoSettings: tabRenkoSettings,
  visualSettings: tabVisualSettings,
  events,
  compareOverlays,
  overlays,
  drawings,
  selectedDrawingId,
  indicatorPaneHeight,
  indicatorPaneHeights,
  collapsedIndicatorPanes,
  paneScaleOverrides,
  viewport,
  scannerChartOverlay: requestedScannerChartOverlay = null,
  loading,
  bottomBarStartContent,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const chartViewportRef = useRef<HTMLDivElement | null>(null);
  const nativeScrollbarRef = useRef<HTMLDivElement | null>(null);
  const syncingNativeScrollbarRef = useRef(false);
  const nativeScrollbarSyncTimerRef = useRef<number | null>(null);
  const latestViewportRef = useRef(viewport);
  const drawingAlertSyncTimerRef = useRef<number | null>(null);
  const promotedScannerOverlayIdRef = useRef<string | null>(null);
  const scannerPatternMapRef = useRef(useUiStore.getState().scannerPatternMap);
  const latestInstrumentRef = useRef<InstrumentKey | null>(instrument);
  const latestBarsRef = useRef<OHLCBar[]>(bars);
  const latestChartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const inlineTextInputRef = useRef<HTMLInputElement | null>(null);
  const inlineTextEditorCancelledRef = useRef(false);
  const handledScreenshotRequestRef = useRef(
    useUiStore.getState().chartScreenshotRequest?.requestCount ?? 0,
  );
  const latestHoverBarDateRef = useRef<string | null>(null);
  const [gannPluginEnabled, setGannPluginEnabled] = useState(false);
  const setHoverBar = useChartStore((state) => state.setHoverBar);
  const syncViewport = useChartStore((state) => state.syncViewport);
  const scrollToViewportStart = useChartStore((state) => state.scrollToViewportStart);
  const nudgeViewport = useChartStore((state) => state.nudgeViewport);
  const zoomViewportByFactor = useChartStore((state) => state.zoomViewportByFactor);
  const resetViewport = useChartStore((state) => state.resetViewport);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const addIndicator = useChartStore((state) => state.addIndicator);
  const addIndicatorCatalog = useChartStore((state) => state.addIndicatorCatalog);
  const activeDrawingTool = useUiStore((state) => state.activeDrawingTool);
  const magnetEnabled = useUiStore((state) => state.magnetEnabled);
  const currentTheme = useUiStore((state) => state.currentTheme);
  const customChartColors = useUiStore((state) => state.customChartColors);
  const chartScreenshotRequest = useUiStore((state) => state.chartScreenshotRequest);
  const setDrawingTool = useUiStore((state) => state.setDrawingTool);
  const selectDrawing = useChartStore((state) => state.selectDrawing);
  const drawingPropertiesDrawingId = useUiStore((state) => state.drawingPropertiesDrawingId);
  const openDrawingPropertiesRequest = useUiStore((state) => state.openDrawingProperties);
  const closeDrawingProperties = useUiStore((state) => state.closeDrawingProperties);
  const clearScannerChartOverlay = useUiStore((state) => state.clearScannerChartOverlay);
  const scannerPatternMap = useUiStore((state) => state.scannerPatternMap);
  const showScannerChartOverlay = useUiStore((state) => state.showScannerChartOverlay);
  const selectScannerPatternMapEntry = useUiStore((state) => state.selectScannerPatternMapEntry);
  const signalRules = useUiStore((state) => state.signalRules);
  const signalSettingsDialogOpen = useUiStore((state) => state.signalSettingsDialogOpen);
  const closeSignalSettingsDialog = useUiStore((state) => state.closeSignalSettingsDialog);
  const setSignalRules = useUiStore((state) => state.setSignalRules);
  const syncedCrosshairDate = useUiStore((state) => state.syncedCrosshairDate);
  const crosshairSyncEnabled = useUiStore((state) => state.crosshairSyncEnabled);
  const setSyncedCrosshairDate = useUiStore((state) => state.setSyncedCrosshairDate);
  const addDrawing = useChartStore((state) => state.addDrawing);
  const updateDrawing = useChartStore((state) => state.updateDrawing);
  const toggleDrawingLock = useChartStore((state) => state.toggleDrawingLock);
  const deleteSelectedDrawing = useChartStore((state) => state.deleteSelectedDrawing);
  const clearDrawings = useChartStore((state) => state.clearDrawings);
  const setIndicatorPaneHeight = useChartStore((state) => state.setIndicatorPaneHeight);
  const setIndicatorPaneCollapsed = useChartStore((state) => state.setIndicatorPaneCollapsed);
  const moveIndicatorPane = useChartStore((state) => state.moveIndicatorPane);
  const setPaneScaleOverride = useChartStore((state) => state.setPaneScaleOverride);
  const fitAllPanes = useChartStore((state) => state.fitAllPanes);
  const adjustedMode = useChartStore((state) => state.adjustedMode);
  const chartEventVisibility = useChartStore((state) => state.chartEventVisibility);
  const includeDividendAdjustments = useChartStore((state) => state.includeDividendAdjustments);
  const includeRightsAdjustments = useChartStore((state) => state.includeRightsAdjustments);
  const setIncludeDividendAdjustments = useChartStore((state) => state.setIncludeDividendAdjustments);
  const setIncludeRightsAdjustments = useChartStore((state) => state.setIncludeRightsAdjustments);
  const setAdjustedMode = useChartStore((state) => state.setAdjustedMode);
  const toggleChartEventVisibility = useChartStore((state) => state.toggleChartEventVisibility);
  const setLogScale = useChartStore((state) => state.setLogScale);
  const applyChartSettingsDialog = useChartStore((state) => state.applyChartSettingsDialog);
  const setChartVisualSettings = useChartStore((state) => state.setChartVisualSettings);
  const chartTab = useChartStore((state) => tabId
    ? state.chartTabs.find((tab) => tab.id === tabId)
    : getActiveChartTab(state.chartTabs, state.activeChartTabId));
  const showVolume = chartTab?.showVolume ?? true;
  const setShowVolume = useChartStore((state) => state.setShowVolume);
  const setInvertPriceScale = useChartStore((state) => state.setInvertPriceScale);
  const setShowValueLabels = useChartStore((state) => state.setShowValueLabels);
  const setValueLabelSettings = useChartStore((state) => state.setValueLabelSettings);
  const setShowLeftAxis = useChartStore((state) => state.setShowLeftAxis);
  const setFutureMarginMode = useChartStore((state) => state.setFutureMarginMode);
  const logScale = chartTab?.logScale ?? false;
  const invertPriceScale = chartTab?.invertPriceScale ?? false;
  const valueLabelSettings = chartTab?.valueLabelSettings ?? DEFAULT_CHART_VALUE_LABEL_SETTINGS;
  const showLeftAxis = chartTab?.showLeftAxis ?? false;
  const futureMarginMode = chartTab?.futureMarginMode ?? 'normal';
  const timeframe = chartTab?.timeframe ?? 'D';
  const setTimeframe = useChartStore((state) => state.setTimeframe);
  const updateIndicator = useChartStore((state) => state.updateIndicator);
  const removeIndicator = useChartStore((state) => state.removeIndicator);
  const navigateSymbol = useChartStore((state) => state.navigateSymbol);
  const addToast = useChartStore((state) => state.addToast);
  const [dropActive, setDropActive] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scrollbarViewportWidth, setScrollbarViewportWidth] = useState(0);
  const [axisWidth, setAxisWidth] = useState(SHARED_AXIS_WIDTH);
  const [drawingContextMenu, setDrawingContextMenu] = useState<DrawingContextMenuState | null>(null);
  const [chartContextMenu, setChartContextMenu] = useState<ChartContextMenuState | null>(null);
  const [drawingProperties, setDrawingProperties] = useState<DrawingPropertiesState | null>(null);
  const [inlineTextEditor, setInlineTextEditor] = useState<InlineTextEditorState | null>(null);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [volumeProfileEnabled, setVolumeProfileEnabled] = useState(false);
  const [chartSettingsDialogOpen, setChartSettingsDialogOpen] = useState(false);
  const [axisSettingsAnchorTop, setAxisSettingsAnchorTop] = useState(36);
  const [axisSettingsAnchorBottom, setAxisSettingsAnchorBottom] = useState<number | null>(null);
  const [axisSettingsAnchorOffset, setAxisSettingsAnchorOffset] = useState(8);
  const [settingsSide, setSettingsSide] = useState<'left' | 'right'>('right');
  const [axisSettingsDirection, setAxisSettingsDirection] = useState<'down' | 'up'>('down');
  const [resizeGhostY, setResizeGhostY] = useState<number | null>(null);
  const [legendBarIndex, setLegendBarIndex] = useState<number | null>(null);
  const [priceLegendExpanded, setPriceLegendExpanded] = useState(true);
  const selectedDrawing = useMemo(
    () => drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null,
    [drawings, selectedDrawingId],
  );
  const visibleEvents = useMemo(
    () => events.filter((event) => chartEventVisibility[event.type] !== false),
    [chartEventVisibility, events],
  );
  const drawingContextMenuLocked = useMemo(
    () => (drawingContextMenu ? (drawings.find((drawing) => drawing.id === drawingContextMenu.drawingId)?.locked ?? false) : false),
    [drawingContextMenu, drawings],
  );
  const drawingContextMenuCanCreateAlert = useMemo(() => {
    const drawing = drawingContextMenu
      ? drawings.find((candidate) => candidate.id === drawingContextMenu.drawingId)
      : null;
    return Boolean(instrument && drawing && isDrawingAlertSupported(drawing));
  }, [drawingContextMenu, drawings, instrument]);

  const visibleSpan = useMemo(
    () => Math.max(1, Math.round(viewport.endIndex - viewport.startIndex)),
    [viewport.endIndex, viewport.startIndex],
  );
  const allowedFutureBars = useMemo(
    () => getAllowedFutureBars(visibleSpan, futureMarginMode),
    [futureMarginMode, visibleSpan],
  );
  const futureMarginBars = Math.max(0, Math.ceil(viewport.endIndex - bars.length));
  const effectiveFutureBars = Math.max(futureMarginBars, allowedFutureBars);
  const maxScrollStart = Math.max(0, bars.length + effectiveFutureBars - visibleSpan);
  const scrollValue = Math.max(0, Math.min(maxScrollStart, Math.round(viewport.startIndex)));
  const priceAutoFit = !paneScaleOverrides.price;
  const allPanesAutoFit = Object.keys(paneScaleOverrides).length === 0;
  const renkoSettings = useMemo(
    () => normalizeRenkoSettings(tabRenkoSettings ?? DEFAULT_RENKO_SETTINGS, renkoBrickSize),
    [renkoBrickSize, tabRenkoSettings],
  );
  const visualSettings = useMemo(
    () => normalizeChartVisualSettings(tabVisualSettings ?? DEFAULT_CHART_VISUAL_SETTINGS),
    [tabVisualSettings],
  );
  const chartTheme = useMemo(
    () => getChartTheme(currentTheme, customChartColors ?? undefined),
    [currentTheme, customChartColors],
  );
  const paneIndicators = useMemo(
    () => overlays.filter((indicator) => indicator.placement === 'pane'),
    [overlays],
  );
  const scannerSourceTab = chartTab;
  const scannerDatabasePath = useChartStore((state) => state.snapshot?.activeDatabasePath ?? null);
  const scannerChartContext = useMemo<ScannerChartContext | null>(() => {
    const priceBasis = scannerSourceTab ? getLoadedScannerPriceBasis(scannerSourceTab) : null;
    return scannerSourceTab?.instrument && priceBasis
      ? { instrument: scannerSourceTab.instrument, bars: scannerSourceTab.rawBars, priceBasis, databasePath: scannerDatabasePath, timeframe:scannerSourceTab.timeframe }
      : null;
  }, [scannerSourceTab?.instrument, scannerSourceTab?.rawBars, scannerSourceTab?.timeframe, scannerSourceTab?.loadedAdjusted,
    scannerSourceTab?.loadedDividendAdjusted, scannerSourceTab?.loadedRightsAdjusted, scannerDatabasePath]);
  const scannerChartOverlay = useMemo(
    () => resolveScannerOverlayPriceBasis(requestedScannerChartOverlay, scannerChartContext),
    [requestedScannerChartOverlay, scannerChartContext],
  );
  const scannerOverlayDrawings = useMemo(
    () => (scannerChartOverlay?.editable ? [] : buildScannerOverlayDrawings(scannerChartOverlay, instrument, bars)),
    [scannerChartOverlay, instrument?.exchange, instrument?.symbol, bars],
  );
  const scannerPatternMapMarkerDrawings = useMemo(
    () => buildScannerPatternMapMarkerDrawings(scannerPatternMap?.entries ?? [], instrument, bars),
    [scannerPatternMap?.entries, instrument?.exchange, instrument?.symbol, bars],
  );
  const scannerPatternMapGeometryEntries = useMemo(() => {
    if (!scannerPatternMap?.showVisibleGeometry) return [];
    return scannerPatternMap.entries.flatMap((entry) => {
      const overlay = resolveScannerOverlayPriceBasis(buildScannerPatternDrawingOverlay(entry), scannerChartContext);
      return overlay ? [{ ...entry, geometry: overlay.geometry, levels: overlay.levels, score: overlay.score, direction: overlay.direction }] : [];
    });
  }, [scannerPatternMap?.entries, scannerPatternMap?.showVisibleGeometry, scannerChartContext]);
  const scannerPatternMapGeometryDrawings = useMemo(
    () =>
      scannerPatternMap?.showVisibleGeometry
        ? buildScannerPatternMapGeometryDrawings(scannerPatternMapGeometryEntries, instrument, bars, viewport)
        : [],
    [scannerPatternMapGeometryEntries, scannerPatternMap?.showVisibleGeometry, instrument?.exchange, instrument?.symbol, bars, viewport],
  );
  const renderDrawings = useMemo(
    () => [...drawings, ...scannerOverlayDrawings, ...scannerPatternMapGeometryDrawings, ...scannerPatternMapMarkerDrawings],
    [drawings, scannerOverlayDrawings, scannerPatternMapGeometryDrawings, scannerPatternMapMarkerDrawings],
  );
  const contextMenuDrawingItems = useMemo(
    () =>
      renderDrawings
        .map((drawing, index) => ({
          id: drawing.id,
          label: `${getDrawingLabel(drawing)} ${index + 1}${drawing.id === selectedDrawingId ? ' (selected)' : ''}`,
          selected: drawing.id === selectedDrawingId,
        }))
        .sort((a, b) => Number(b.selected) - Number(a.selected))
        .map(({ selected: _selected, ...item }) => item),
    [renderDrawings, selectedDrawingId],
  );
  const contextMenuIndicatorItems = useMemo(
    () =>
      overlays.map((indicator) => ({
        id: indicator.id,
        label: getCompactIndicatorDisplayLabel(indicator),
      })),
    [overlays],
  );
  const contextMenuIndicatorAlertItems = useMemo(
    () =>
      overlays
        .filter((indicator) => getDefaultIndicatorAlertPresetForIndicator(indicator))
        .map((indicator) => ({
          id: indicator.id,
          label: getCompactIndicatorDisplayLabel(indicator),
        })),
    [overlays],
  );
  const [paneSettingsIndicatorId, setPaneSettingsIndicatorId] = useState<string | null>(null);
  const paneSettingsIndicator = useMemo(
    () => (paneSettingsIndicatorId ? (overlays.find((o) => o.id === paneSettingsIndicatorId) ?? null) : null),
    [paneSettingsIndicatorId, overlays],
  );
  const scrollbarContentWidth = useMemo(() => {
    if (scrollbarViewportWidth <= 0) {
      return 0;
    }

    const pixelsPerBar = Math.max(8, Math.round(scrollbarViewportWidth / Math.max(visibleSpan, 1)));
    return Math.max(scrollbarViewportWidth + maxScrollStart * pixelsPerBar, scrollbarViewportWidth);
  }, [maxScrollStart, scrollbarViewportWidth, visibleSpan]);
  const layout = useMemo(
    () =>
      computeChartLayout(
        viewportSize.width,
        viewportSize.height,
        axisWidth,
        showLeftAxis ? SHARED_AXIS_WIDTH : 0,
        30,
        0,
        paneIndicators.map((indicator) => indicator.id),
        indicatorPaneHeights,
        collapsedIndicatorPanes,
      ),
    [axisWidth, showLeftAxis, collapsedIndicatorPanes, indicatorPaneHeights, paneIndicators, viewportSize.height, viewportSize.width],
  );
  const chartSettingsMenuMaxHeight = useMemo(() => {
    const safeViewportGap = 12;
    const minUsableHeight = 180;
    const availableHeight =
      axisSettingsDirection === 'up'
        ? viewportSize.height - (axisSettingsAnchorBottom ?? 0) - safeViewportGap
        : viewportSize.height - axisSettingsAnchorTop - safeViewportGap;

    return Math.max(minUsableHeight, Math.floor(availableHeight));
  }, [axisSettingsAnchorBottom, axisSettingsAnchorTop, axisSettingsDirection, viewportSize.height]);
  const chartSettingsMenuWidth = useMemo(
    () => resolveChartSettingsMenuWidth(layout.axisWidth, layout.chartWidth),
    [layout.axisWidth, layout.chartWidth],
  );
  const visibleStartBar = bars[Math.max(0, Math.floor(viewport.startIndex))] ?? null;
  const visibleBarCount = countVisibleBars(viewport, bars.length);
  const visibleEndBar = bars[Math.max(0, Math.min(bars.length - 1, Math.ceil(viewport.endIndex) - 1))] ?? null;
  const visibleDateRangeLabel =
    visibleBarCount > 0 && visibleStartBar && visibleEndBar
      ? `${formatVisibleDate(visibleStartBar.date)} -> ${formatVisibleDate(visibleEndBar.date)}`
      : 'No visible dates';
  const clearTransientDrawingUi = () => {
    selectDrawing(null);
    setChartContextMenu(null);
    setDrawingContextMenu(null);
    closeDrawingProperties();
  };

  useEffect(() => {
    scannerPatternMapRef.current = scannerPatternMap;
  }, [scannerPatternMap]);

  const runForChart = <T,>(action: () => T): T => {
    if (tabId && tabId !== activeChartTabId) {
      activateChartTab(tabId);
    }
    return action();
  };

  const deleteDrawingOrScannerOverlay = (drawingId: string | null) => {
    if (isScannerOverlayDrawingId(drawingId)) {
      clearScannerChartOverlay();
      clearTransientDrawingUi();
      return;
    }
    const drawing = drawings.find((item) => item.id === drawingId);
    if (!drawing || drawing.locked) {
      return;
    }
    void markDrawingAlertMissing(drawingId);
    deleteSelectedDrawing();
  };

  const buildDrawingAlertBars = () => {
    const activeInstrument = latestInstrumentRef.current;
    if (!activeInstrument) {
      return [];
    }
    return latestBarsRef.current.map((bar) => ({
      symbol: activeInstrument.symbol,
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }));
  };

  const scheduleDrawingAlertGeometrySync = (drawing: ChartDrawing) => {
    if (!latestInstrumentRef.current || !isDrawingAlertSupported(drawing)) {
      return;
    }
    if (drawingAlertSyncTimerRef.current !== null) {
      window.clearTimeout(drawingAlertSyncTimerRef.current);
    }
    drawingAlertSyncTimerRef.current = window.setTimeout(() => {
      drawingAlertSyncTimerRef.current = null;
      const geometryPatch = buildDrawingAlertGeometryPatch(drawing, buildDrawingAlertBars());
      if (!geometryPatch) {
        return;
      }
      void readAppSettings()
        .then((settings) => {
          let changed = false;
          const nextRules = settings.eodAlertRules.map((rule) => {
            if (rule.conditionType !== 'drawing' || rule.drawingId !== drawing.id) {
              return rule;
            }
            changed = true;
            return {
              ...rule,
              ...geometryPatch,
              updatedAt: new Date().toISOString(),
            };
          });
          if (!changed) {
            return null;
          }
          return writeAppSettings({ ...settings, eodAlertRules: nextRules });
        })
        .catch(() => {
          // Drawing edits should never interrupt chart interaction; failed sync is retried on the next edit.
        });
    }, 250);
  };

  const markDrawingAlertMissing = async (drawingId: string | null): Promise<boolean> => {
    const activeInstrument = latestInstrumentRef.current;
    if (!drawingId || !activeInstrument) {
      return false;
    }

    const settings = await readAppSettings();
    const now = new Date().toISOString();
    let changed = false;
    const nextRules = settings.eodAlertRules.map((rule) => {
      if (
        rule.conditionType !== 'drawing' ||
        rule.drawingId !== drawingId ||
        rule.exchange !== activeInstrument.exchange ||
        rule.symbol !== activeInstrument.symbol
      ) {
        return rule;
      }
      if (rule.drawingStatus === 'missing' && rule.enabled === false) {
        return rule;
      }
      changed = true;
      return {
        ...rule,
        enabled: false,
        drawingStatus: 'missing' as const,
        drawingMissingAt: now,
        updatedAt: now,
      };
    });

    if (!changed) {
      return false;
    }
    await writeAppSettings({ ...settings, eodAlertRules: nextRules });
    return true;
  };

  const createAlertForDrawing = async (drawingId: string) => {
    if (!instrument) {
      addToast('Load a chart symbol before creating a drawing alert.', 'error', 'Alerts');
      return;
    }
    const drawing = drawings.find((candidate) => candidate.id === drawingId);
    if (!drawing || !isDrawingAlertSupported(drawing)) {
      addToast('Drawing alerts are available for horizontal lines, trendlines, and rays.', 'error', 'Alerts');
      return;
    }

    const nextRule = createDrawingAlertRule(instrument, drawing, buildDrawingAlertBars());
    if (!nextRule) {
      addToast('Drawing alert could not be created for this drawing.', 'error', 'Alerts');
      return;
    }

    try {
      const settings = await readAppSettings();
      const existingRule = settings.eodAlertRules.find(
        (rule) =>
          rule.conditionType === 'drawing' &&
          rule.drawingId === drawing.id &&
          rule.exchange === instrument.exchange &&
          rule.symbol === instrument.symbol &&
          rule.drawingStatus !== 'missing',
      );
      if (existingRule) {
        addToast('Drawing alert already exists for this drawing.', 'error', 'Alerts');
        return;
      }
      await writeAppSettings({
        ...settings,
        eodAlertRules: [...settings.eodAlertRules, nextRule],
      });
      addToast('Drawing alert created.', 'success', 'Alerts');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to create drawing alert.', 'error', 'Alerts');
    }
  };

  const createAlertForIndicator = async (indicatorId: string) => {
    if (!instrument) {
      addToast('Load a chart symbol before creating an indicator alert.', 'error', 'Alerts');
      return;
    }
    const indicator = overlays.find((candidate) => candidate.id === indicatorId);
    if (!indicator) {
      addToast('Indicator was not found on this chart.', 'error', 'Alerts');
      return;
    }

    const unsupportedSource = getIndicatorAlertSourceUnsupportedReason(indicator);
    if (unsupportedSource) {
      addToast(unsupportedSource, 'error', 'Alerts');
      return;
    }

    const nextRule = createIndicatorAlertRule(instrument, indicator);
    if (!nextRule) {
      addToast('This indicator does not expose an alert preset yet.', 'error', 'Alerts');
      return;
    }

    try {
      const settings = await readAppSettings();
      const existingRule = settings.eodAlertRules.find(
        (rule) =>
          rule.conditionType === 'indicator' &&
          rule.exchange === instrument.exchange &&
          rule.symbol === instrument.symbol &&
          rule.indicatorLeft === nextRule.indicatorLeft &&
          (rule.indicatorRight ?? null) === (nextRule.indicatorRight ?? null) &&
          rule.indicatorOperator === nextRule.indicatorOperator &&
          (rule.indicatorValue ?? null) === (nextRule.indicatorValue ?? null),
      );
      if (existingRule) {
        addToast('Indicator alert already exists for this chart.', 'error', 'Alerts');
        return;
      }
      await writeAppSettings({
        ...settings,
        eodAlertRules: [...settings.eodAlertRules, nextRule],
      });
      addToast('Indicator alert created.', 'success', 'Alerts');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to create indicator alert.', 'error', 'Alerts');
    }
  };

  const captureChartScreenshotWithLegend = (engine: ChartEngine): HTMLCanvasElement => {
    const screenshot = engine.captureScreenshot();
    const cssWidth = containerRef.current?.clientWidth ?? screenshot.width;
    drawScreenshotPriceLegend(screenshot, {
      layout,
      cssWidth,
      snapshot: buildChartPriceLegendSnapshot({
        instrument,
        instrumentName: instrumentMeta?.name ?? null,
        timeframe,
        chartType,
        renkoSettings,
        bars,
        viewport,
        compareOverlays,
        overlays,
        hoverBarIndex: legendBarIndex,
      }),
      secondaryLegendExpanded: priceLegendExpanded,
    });
    return screenshot;
  };

  const saveChartScreenshot = async () => {
    const engine = engineRef.current;
    if (!engine) {
      addToast('The chart is not ready to capture yet.', 'warning', 'Screenshot');
      return;
    }

    const fileName = buildChartScreenshotFileName(instrument, timeframe);
    const screenshot = captureChartScreenshotWithLegend(engine);
    const api = getDesktopApi();
    if (!api) {
      downloadCanvasPng(screenshot, fileName);
      addToast('Chart screenshot download started.', 'success', 'Screenshot');
      return;
    }

    try {
      const result = await api.saveChartImage({
        title: 'Save Chart Screenshot',
        suggestedFileName: fileName,
        pngBase64: pngBase64FromCanvas(screenshot),
      });
      if (result.success && result.filePath) {
        addToast(`Chart screenshot saved to ${result.filePath}.`, 'success', 'Screenshot');
      } else {
        addToast('Chart screenshot save cancelled.', 'info', 'Screenshot');
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to save chart screenshot.', 'error', 'Screenshot');
    }
  };

  const copyChartScreenshot = async () => {
    const engine = engineRef.current;
    if (!engine) {
      addToast('The chart is not ready to capture yet.', 'warning', 'Screenshot');
      return;
    }

    try {
      await copyCanvasPngToClipboard(captureChartScreenshotWithLegend(engine));
      addToast('Chart screenshot copied to the clipboard.', 'success', 'Screenshot');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to copy chart screenshot.', 'error', 'Screenshot');
    }
  };

  const discardNewInlineTextDrawing = (drawingId: string) => {
    selectDrawing(drawingId);
    deleteSelectedDrawing();
  };

  const finishInlineTextEditor = (editor: InlineTextEditorState) => {
    const text = editor.text.trim();
    const drawing = drawings.find((candidate) => candidate.id === editor.drawingId);
    if (!drawing || drawing.kind !== 'text') {
      setInlineTextEditor(null);
      return;
    }

    if (!text) {
      if (editor.isNew) {
        discardNewInlineTextDrawing(editor.drawingId);
      }
      setInlineTextEditor(null);
      return;
    }

    updateDrawing({ ...drawing, text });
    selectDrawing(drawing.id);
    setInlineTextEditor(null);
  };

  const cancelInlineTextEditor = (editor: InlineTextEditorState) => {
    inlineTextEditorCancelledRef.current = true;
    if (editor.isNew) {
      discardNewInlineTextDrawing(editor.drawingId);
    }
    setInlineTextEditor(null);
  };

  useLayoutEffect(() => {
    if (!inlineTextEditor) {
      return;
    }

    inlineTextEditorCancelledRef.current = false;
    const input = inlineTextInputRef.current;
    input?.focus();
    if (!inlineTextEditor.isNew) {
      input?.select();
    }
  }, [inlineTextEditor]);

  useEffect(() => {
    if (
      !chartScreenshotRequest ||
      chartScreenshotRequest.requestCount === handledScreenshotRequestRef.current ||
      tabId !== activeChartTabId
    ) {
      return;
    }

    handledScreenshotRequestRef.current = chartScreenshotRequest.requestCount;
    if (chartScreenshotRequest.action === 'save') {
      void saveChartScreenshot();
      return;
    }
    void copyChartScreenshot();
  }, [activeChartTabId, chartScreenshotRequest, tabId]);

  latestViewportRef.current = viewport;
  latestInstrumentRef.current = instrument;
  latestBarsRef.current = bars;

  const togglePrimaryDrawingTool = (tool: Extract<DrawingTool, 'hline' | 'vline' | 'trendline'>) => {
    setDrawingTool(activeDrawingTool === tool ? 'cursor' : tool);
    clearTransientDrawingUi();
  };

  useEffect(() => {
    let active = true;
    let receivedSettingsChange = false;

    const applyGannPluginSetting = (settings: AppSettings) => {
      if (!active) {
        return;
      }
      setGannPluginEnabled(isPluginEnabled(GANN_PRICE_TIME_PLUGIN_ID, settings.pluginEnabled));
    };

    const unsubscribe = subscribeAppSettingsChanges((settings) => {
      receivedSettingsChange = true;
      applyGannPluginSetting(settings);
    });
    void readAppSettings()
      .then((settings) => {
        if (!receivedSettingsChange) applyGannPluginSetting(settings);
      })
      .catch(() => {
        if (active && !receivedSettingsChange) {
          setGannPluginEnabled(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const engine = new ChartEngine(containerRef.current, {
      volumePct: DEFAULT_VOLUME_PCT,
      timeframe,
      chartType,
      leftAxisWidth: showLeftAxis ? SHARED_AXIS_WIDTH : 0,
      theme: chartTheme,
      visualSettings,
    });
    engineRef.current = engine;
    engine.setCanvasPriceLegendEnabled(false);
    setAxisWidth(engine.getAxisWidth());
    const offEvents = engine.on((event) => {
      if (event.type === 'crosshairMove') {
        const nextLegendBarIndex =
          event.crosshair?.visible && typeof event.crosshair.barIndex === 'number' && event.crosshair.barIndex >= 0
            ? event.crosshair.barIndex
            : null;
        setLegendBarIndex((current) => (current === nextLegendBarIndex ? current : nextLegendBarIndex));
        const nextHoverBar = event.crosshair?.visible ? event.crosshair.bar ?? null : null;
        const nextDate = nextHoverBar?.date ?? null;
        if (latestHoverBarDateRef.current !== nextDate) {
          latestHoverBarDateRef.current = nextDate;
          setHoverBar(nextHoverBar, tabId ?? undefined);
          if (nextDate && useUiStore.getState().crosshairSyncEnabled && useUiStore.getState().syncedCrosshairDate !== nextDate) {
            setSyncedCrosshairDate(nextDate);
          }
        }
      }
      if (event.type === 'viewportChange' && event.viewport) {
        syncViewport(event.viewport, tabId ?? undefined);
      }
      if (event.type === 'axisWidthChange' && typeof event.axisWidth === 'number') {
        setAxisWidth(event.axisWidth);
      }
      if (event.type === 'drawingComplete' && event.drawing) {
        addDrawing(event.drawing, tabId ?? undefined);
        setDrawingTool('cursor');
        if (event.drawing.kind === 'text') {
          const pointer = latestChartPointerRef.current ?? { x: 12, y: 28 };
          selectDrawing(event.drawing.id, tabId ?? undefined);
          setInlineTextEditor({
            drawingId: event.drawing.id,
            text: '',
            isNew: true,
            x: pointer.x,
            y: pointer.y,
          });
        }
      }
      if (event.type === 'drawingUpdate' && event.drawing) {
        updateDrawing(event.drawing, tabId ?? undefined);
        scheduleDrawingAlertGeometrySync(event.drawing);
      }
      if (event.type === 'drawingSelect') {
        if (isScannerPatternMapMarkerDrawingId(event.drawingId)) {
          const map = scannerPatternMapRef.current;
          const cluster = map
            ? clusterScannerPatternMapEntries(map.entries).find((candidate) => candidate.id === event.drawingId)
            : null;
          const entry = cluster ? map?.entries.find((candidate) => candidate.id === cluster.representativeId) : null;
          if (entry) {
            selectScannerPatternMapEntry(entry.id);
            const entryBarIndex = findBarIndexOnOrAfter(latestBarsRef.current, entry.date);
            if (entryBarIndex >= 0) {
              const visibleSpan = Math.max(20, Math.round(latestViewportRef.current.endIndex - latestViewportRef.current.startIndex));
              scrollToViewportStart(Math.max(0, entryBarIndex - Math.floor(visibleSpan / 2)), tabId ?? undefined);
            }
            showScannerChartOverlay({
              id: `scanner-map-selection:${entry.id}:${Date.now()}`,
              instrument: entry.instrument,
              date: entry.date,
              scannerName: entry.scannerName,
              scannerId: entry.scannerId,
              contextBars: 260,
              direction: entry.direction,
              score: entry.score,
              levels: entry.levels,
              geometry: entry.geometry,
              editable: entry.editable,
            });
          }
          selectDrawing(null, tabId ?? undefined);
          return;
        }
        selectDrawing(event.drawingId ?? null, tabId ?? undefined);
      }
      if (event.type === 'paneScaleChange' && event.paneId) {
        setPaneScaleOverride(event.paneId, event.paneScaleRange ?? null, tabId ?? undefined);
      }
    });
    engine.mount();

    return () => {
      offEvents();
      engine.unmount();
      engineRef.current = null;
    };
  }, [addDrawing, scrollToViewportStart, selectDrawing, selectScannerPatternMapEntry, setDrawingTool, setHoverBar, setPaneScaleOverride, showScannerChartOverlay, syncViewport, tabId, updateDrawing]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSymbol(instrument);
    engine.loadBars(bars);
    engine.setViewport(latestViewportRef.current);
  }, [instrument, bars]);

  useEffect(() => {
    engineRef.current?.setDrawings(renderDrawings);
  }, [renderDrawings]);

  useEffect(() => {
    engineRef.current?.setOverlays(overlays);
  }, [overlays]);

  useEffect(() => {
    engineRef.current?.setEvents(visibleEvents);
  }, [visibleEvents]);

  useEffect(() => {
    engineRef.current?.setCompareOverlays(compareOverlays);
  }, [compareOverlays]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolumeProfileConfig({ enabled: volumeProfileEnabled, bucketCount: 24, alignment: 'right' });
    engine.setSignalRules(signalRules);
  }, [volumeProfileEnabled, signalRules]);

  // Gann Price-Time overlay — registered as a canvas callback on the engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !gannPluginEnabled || bars.length === 0) {
      engineRef.current?.setGannOverlayCallback(null);
      return;
    }

    const setup = computeGannSetup(bars);
    if (!setup) {
      engine.setGannOverlayCallback(null);
      return;
    }

    engine.setGannOverlayCallback((ctx, scaleX, priceScaleY, width, height) => {
      renderGannOverlay(
        ctx,
        setup,
        { timeToX: (i) => scaleX.toPixel(i), priceToY: (p) => priceScaleY.toPixel(p) },
        DEFAULT_GANN_OPTIONS,
        width,
        height,
      );
    });

    return () => {
      engineRef.current?.setGannOverlayCallback(null);
    };
  }, [bars, gannPluginEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || bars.length === 0) {
      engineRef.current?.unregisterPluginOverlay('__external_plugins__');
      return;
    }
    const syncOverlay = () => {
      const overlays = pluginHost.listChartOverlays().filter((o) => o.id !== 'gann-price-time-overlay');
      if (overlays.length === 0) {
        engine.unregisterPluginOverlay('__external_plugins__');
        return;
      }
      engine.registerPluginOverlay('__external_plugins__', (ctx, scaleX, priceScaleY, width, height) => {
        const mapper = { timeToX: (i: number) => scaleX.toPixel(i), priceToY: (p: number) => priceScaleY.toPixel(p) };
        for (const ov of overlays) {
          ctx.save();
          try {
            ov.render(ctx, bars, mapper, width, height);
          } finally {
            ctx.restore();
          }
        }
      });
    };
    syncOverlay();
    const unsub = pluginHost.subscribe(syncOverlay);
    return () => {
      unsub();
      engineRef.current?.unregisterPluginOverlay('__external_plugins__');
    };
  }, [bars]);

  useEffect(() => {
    if (!crosshairSyncEnabled || !syncedCrosshairDate || !bars.length || !engineRef.current) {
      return;
    }

    const matchedBarIndex = bars.findIndex((b) => b.date >= syncedCrosshairDate);
    if (matchedBarIndex >= 0) {
      engineRef.current.setSyncedCrosshairBarIndex(matchedBarIndex);
    }
  }, [crosshairSyncEnabled, syncedCrosshairDate, bars]);

  useEffect(() => {
    if (
      !scannerChartOverlay?.editable ||
      scannerChartOverlay.geometry?.family !== 'range' ||
      !instrument ||
      bars.length === 0 ||
      (tabId && tabId !== activeChartTabId) ||
      promotedScannerOverlayIdRef.current === scannerChartOverlay.id
    ) {
      return;
    }

    const editableDrawings = buildScannerOverlayDrawings(scannerChartOverlay, instrument, bars, { editable: true });
    if (!editableDrawings.length) {
      return;
    }

    promotedScannerOverlayIdRef.current = scannerChartOverlay.id;
    editableDrawings.forEach((drawing) => addDrawing(drawing));
    selectDrawing(editableDrawings.find((drawing) => drawing.kind === 'rect')?.id ?? editableDrawings[0].id);
    setDrawingTool('cursor');
    clearScannerChartOverlay();
    addToast(`${scannerChartOverlay.scannerName} added as editable drawings.`, 'success', 'Scanner');
  }, [
    activeChartTabId,
    addDrawing,
    addToast,
    bars,
    clearScannerChartOverlay,
    instrument,
    scannerChartOverlay,
    selectDrawing,
    setDrawingTool,
    tabId,
  ]);

  useEffect(() => {
    setLegendBarIndex(null);
  }, [instrument?.exchange, instrument?.symbol, bars]);

  useEffect(() => {
    engineRef.current?.setViewport(viewport);
  }, [viewport.startIndex, viewport.endIndex]);

  useEffect(() => {
    engineRef.current?.setDrawingTool(activeDrawingTool);
  }, [activeDrawingTool]);

  useEffect(() => {
    engineRef.current?.setSelectedDrawingId(selectedDrawingId);
  }, [selectedDrawingId]);

  useEffect(() => {
    engineRef.current?.setIndicatorPaneHeights(indicatorPaneHeights);
  }, [indicatorPaneHeights]);

  useEffect(() => {
    engineRef.current?.setCollapsedIndicatorPanes(collapsedIndicatorPanes);
  }, [collapsedIndicatorPanes]);

  useEffect(() => {
    engineRef.current?.setPaneScaleOverrides(paneScaleOverrides);
  }, [paneScaleOverrides]);

  useChartDisplaySync(engineRef.current, {
    theme: chartTheme,
    visualSettings,
    timeframe,
    chartType,
    showVolume,
    logScale,
    invertPriceScale,
    valueLabelSettings,
    showLeftAxis,
    futureMarginMode,
    magnetEnabled,
  });

  useEffect(() => {
    setChartSettingsOpen(false);
    setChartSettingsDialogOpen(false);
  }, [instrument?.exchange, instrument?.symbol]);

  useEffect(() => {
    if (!chartViewportRef.current) {
      return;
    }

    const updateSize = () => {
      const rect = chartViewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(chartViewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nativeScrollbarRef.current) {
      return;
    }

    const updateSize = () => {
      setScrollbarViewportWidth(nativeScrollbarRef.current?.clientWidth ?? 0);
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(nativeScrollbarRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = nativeScrollbarRef.current;
    if (!element || bars.length === 0) {
      syncingNativeScrollbarRef.current = false;
      if (nativeScrollbarSyncTimerRef.current !== null) {
        window.clearTimeout(nativeScrollbarSyncTimerRef.current);
        nativeScrollbarSyncTimerRef.current = null;
      }
      return;
    }

    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);
    const nextScrollLeft = maxScrollStart > 0 ? (scrollValue / maxScrollStart) * maxScrollLeft : 0;
    if (Math.abs(element.scrollLeft - nextScrollLeft) < 1) {
      syncingNativeScrollbarRef.current = false;
      if (nativeScrollbarSyncTimerRef.current !== null) {
        window.clearTimeout(nativeScrollbarSyncTimerRef.current);
        nativeScrollbarSyncTimerRef.current = null;
      }
      return;
    }

    if (nativeScrollbarSyncTimerRef.current !== null) {
      window.clearTimeout(nativeScrollbarSyncTimerRef.current);
      nativeScrollbarSyncTimerRef.current = null;
    }
    syncingNativeScrollbarRef.current = true;
    element.scrollLeft = nextScrollLeft;

    // Use a small timeout instead of requestAnimationFrame to ensure the guard
    // stays active long enough to swallow all browser-fired scroll events from layout shifts.
    nativeScrollbarSyncTimerRef.current = window.setTimeout(() => {
      syncingNativeScrollbarRef.current = false;
      nativeScrollbarSyncTimerRef.current = null;
    }, 60);
  }, [maxScrollStart, scrollValue, scrollbarContentWidth, bars.length]);

  useEffect(() => {
    return () => {
      if (nativeScrollbarSyncTimerRef.current !== null) {
        window.clearTimeout(nativeScrollbarSyncTimerRef.current);
        nativeScrollbarSyncTimerRef.current = null;
      }
      if (drawingAlertSyncTimerRef.current !== null) {
        window.clearTimeout(drawingAlertSyncTimerRef.current);
        drawingAlertSyncTimerRef.current = null;
      }
      syncingNativeScrollbarRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      drawingContextMenu &&
      !isScannerOverlayDrawingId(drawingContextMenu.drawingId) &&
      !drawings.some((drawing) => drawing.id === drawingContextMenu.drawingId)
    ) {
      setDrawingContextMenu(null);
    }
  }, [drawings, drawingContextMenu]);

  useEffect(() => {
    if (drawingContextMenu && selectedDrawingId !== drawingContextMenu.drawingId) {
      setDrawingContextMenu(null);
    }
  }, [drawingContextMenu, selectedDrawingId]);

  useEffect(() => {
    if (!drawingContextMenu) {
      return;
    }

    const handlePointerDown = () => setDrawingContextMenu(null);
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [drawingContextMenu]);

  useEffect(() => {
    if (!chartContextMenu) {
      return;
    }

    const handlePointerDown = () => setChartContextMenu(null);
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [chartContextMenu]);

  useEffect(() => {
    if (!drawingPropertiesDrawingId) {
      setDrawingProperties(null);
      return;
    }

    const drawing = drawings.find((item) => item.id === drawingPropertiesDrawingId);
    if (!drawing) {
      setDrawingProperties(null);
      closeDrawingProperties();
      return;
    }

    const normalizedDrawing = normalizeFibonacciDrawing(drawing);
    const normalizedPositionAnchors =
      normalizedDrawing.kind === 'longPosition' || normalizedDrawing.kind === 'shortPosition'
        ? normalizePositionAnchors(normalizedDrawing.kind, normalizedDrawing.anchors)
        : null;
    const normalizedFibonacciSettings = getNormalizedFibonacciSettings(normalizedDrawing);
    const fibArcSettings = normalizedFibonacciSettings?.kind === 'fibArcs' ? normalizedFibonacciSettings : null;
    const fibWedgeSettings = normalizedFibonacciSettings?.kind === 'fibWedge' ? normalizedFibonacciSettings : null;
    const fibSpiralSettings = normalizedFibonacciSettings?.kind === 'fibSpiral' ? normalizedFibonacciSettings : null;
    const fibFanSettings = normalizedFibonacciSettings?.kind === 'fibFan' ? normalizedFibonacciSettings : null;

    setDrawingProperties({
      drawingId: normalizedDrawing.id,
      color: normalizedDrawing.color,
      lineWidth: String(normalizedDrawing.lineWidth ?? 1.4),
      lineStyle: normalizedDrawing.lineStyle ?? (normalizedDrawing.kind === 'hline' || normalizedDrawing.kind === 'vline' ? 'dashed' : 'solid'),
      locked: Boolean(normalizedDrawing.locked),
      extendLeft: drawingSupportsExtension(normalizedDrawing.kind) ? Boolean(normalizedDrawing.extendLeft) : false,
      extendRight: drawingSupportsExtension(normalizedDrawing.kind) ? getEffectiveDrawingExtendRight(normalizedDrawing) : false,
      showLabel: drawingSupportsLabelVisibility(normalizedDrawing.kind) ? normalizedDrawing.showLabel !== false : false,
      labelPosition: drawingSupportsLabelPosition(normalizedDrawing.kind) ? getDrawingLabelPosition(normalizedDrawing) : 'left',
      price: 'price' in normalizedDrawing ? String(normalizedDrawing.price) : '',
      barIndex: 'barIndex' in normalizedDrawing ? String(normalizedDrawing.barIndex) : '',
      startIndex: 'startIndex' in normalizedDrawing ? String(normalizedDrawing.startIndex) : '',
      endIndex: 'endIndex' in normalizedDrawing ? String(normalizedDrawing.endIndex) : '',
      startPrice: 'startPrice' in normalizedDrawing ? String(normalizedDrawing.startPrice) : '',
      endPrice: 'endPrice' in normalizedDrawing ? String(normalizedDrawing.endPrice) : '',
      anchorCoordinates: 'anchors' in normalizedDrawing
        ? normalizedDrawing.anchors.map((anchor) => ({ barIndex: String(anchor.barIndex), price: String(anchor.price) }))
        : [],
      offset: 'offset' in normalizedDrawing ? String(normalizedDrawing.offset) : '',
      text: normalizedDrawing.kind === 'text' ? normalizedDrawing.text : '',
      fontSize: normalizedDrawing.kind === 'text' ? String(normalizedDrawing.fontSize ?? 13) : '13',
      fontFamily: normalizedDrawing.kind === 'text' ? normalizedDrawing.fontFamily ?? 'sans' : 'sans',
      bold: normalizedDrawing.kind === 'text' ? Boolean(normalizedDrawing.bold) : false,
      italic: normalizedDrawing.kind === 'text' ? Boolean(normalizedDrawing.italic) : false,
      textAlign: normalizedDrawing.kind === 'text' ? normalizedDrawing.textAlign ?? 'left' : 'left',
      boxWidth: normalizedDrawing.kind === 'text' ? String(normalizedDrawing.width ?? 180) : '180',
      boxHeight: normalizedDrawing.kind === 'text' ? String(normalizedDrawing.height ?? 32) : '32',
      presentation: isAdvancedDrawingStyleKind(normalizedDrawing.kind)
        ? createDrawingPresentationDraft(normalizedDrawing)
        : normalizedDrawing.presentation ?? {},
      visibility: normalizedDrawing.visibility ?? {},
      positionEntry: normalizedPositionAnchors ? String(normalizedPositionAnchors[0]?.price ?? '') : '',
      positionTarget: normalizedPositionAnchors ? String(normalizedPositionAnchors[1]?.price ?? '') : '',
      positionStop: normalizedPositionAnchors ? String(normalizedPositionAnchors[2]?.price ?? '') : '',
      fibArcFullCircles: fibArcSettings?.fullCircles === true,
      fibArcCoefficientFormat: fibArcSettings?.coefficientFormat === 'percent' ? 'percent' : 'coefficient',
      fibArcLabelSides: {
        left: fibArcSettings?.labelSides?.left === true,
        right: fibArcSettings?.labelSides?.right === true,
        top: fibArcSettings?.labelSides?.top !== false,
        bottom: fibArcSettings?.labelSides?.bottom === true,
      },
      fibWedgeCoefficientFormat: fibWedgeSettings?.coefficientFormat === 'percent' ? 'percent' : 'coefficient',
      fibSpiralCounterclockwise: fibSpiralSettings?.counterclockwise === true,
      fibFanCoefficientFormat: fibFanSettings?.coefficientFormat === 'percent' ? 'percent' : 'coefficient',
      fibFanReverse: fibFanSettings?.reverse === true,
      fibFanShowBackground: fibFanSettings?.showBackground !== false,
      fibFanShowGrid: fibFanSettings?.showGrid !== false,
      fibFanPriceLabelSides: {
        left: fibFanSettings?.priceLabelSides?.left !== false,
        right: fibFanSettings?.priceLabelSides?.right !== false,
      },
      fibFanTimeLabelSides: {
        top: fibFanSettings?.timeLabelSides?.top !== false,
        bottom: fibFanSettings?.timeLabelSides?.bottom !== false,
      },
    });
  }, [closeDrawingProperties, drawingPropertiesDrawingId, drawings]);

  const applyDrawingProperties = () => {
    if (!drawingProperties) {
      return;
    }

    const drawing = drawings.find((item) => item.id === drawingProperties.drawingId);
    if (!drawing) {
      closeDrawingProperties();
      return;
    }

    const normalizedDrawing = normalizeFibonacciDrawing(drawing);
    const nextLineWidth = Number(drawingProperties.lineWidth);
    if (!Number.isFinite(nextLineWidth) || nextLineWidth <= 0) {
      return;
    }

    const capabilityProperties = {
      ...(drawingSupportsExtension(drawing.kind)
        ? { extendLeft: drawingProperties.extendLeft, extendRight: drawingProperties.extendRight }
        : {}),
      ...(drawingSupportsLabelVisibility(drawing.kind)
        ? { showLabel: drawingProperties.showLabel }
        : {}),
      ...(drawingSupportsLabelPosition(drawing.kind)
        ? { labelPosition: drawingProperties.labelPosition }
        : {}),
    };
    const advancedStyleProperties = isAdvancedDrawingStyleKind(drawing.kind)
      ? { presentation: drawingProperties.presentation }
      : {};
    const normalizedFibonacciSettings = getNormalizedFibonacciSettings(normalizedDrawing);
    const nextToolSettings = normalizedFibonacciSettings?.kind === 'fibSpiral'
      ? {
          ...normalizedDrawing.toolSettings,
          fibonacci: {
            ...normalizedFibonacciSettings,
            counterclockwise: drawingProperties.fibSpiralCounterclockwise,
          },
        }
      : normalizedFibonacciSettings?.kind === 'fibArcs'
      ? {
          ...normalizedDrawing.toolSettings,
          fibonacci: {
            ...normalizedFibonacciSettings,
            fullCircles: drawingProperties.fibArcFullCircles,
            coefficientFormat: drawingProperties.fibArcCoefficientFormat,
            labelSides: { ...drawingProperties.fibArcLabelSides },
          },
        }
      : normalizedFibonacciSettings?.kind === 'fibWedge'
        ? {
            ...normalizedDrawing.toolSettings,
            fibonacci: {
              ...normalizedFibonacciSettings,
              coefficientFormat: drawingProperties.fibWedgeCoefficientFormat,
              levels: normalizedFibonacciSettings.levels.map((level) => ({
                ...level,
                enabled:
                  drawingProperties.presentation.lines?.[`level:${level.id}`]?.visible ??
                  drawingProperties.presentation.lines?.[`level:${level.value}`]?.visible ??
                  level.enabled,
              })),
            },
          }
        : normalizedFibonacciSettings?.kind === 'fibFan'
          ? {
              ...normalizedDrawing.toolSettings,
              fibonacci: {
                ...normalizedFibonacciSettings,
                coefficientFormat: drawingProperties.fibFanCoefficientFormat,
                reverse: drawingProperties.fibFanReverse,
                showBackground: drawingProperties.fibFanShowBackground,
                showGrid: drawingProperties.fibFanShowGrid,
                priceLabelSides: { ...drawingProperties.fibFanPriceLabelSides },
                timeLabelSides: { ...drawingProperties.fibFanTimeLabelSides },
                priceLevels: normalizedFibonacciSettings.priceLevels.map((level) => ({
                  ...level,
                  enabled:
                    drawingProperties.presentation.lines?.[`price:${level.id}`]?.visible ??
                    drawingProperties.presentation.lines?.[`price:${level.value}`]?.visible ??
                    level.enabled,
                })),
                timeLevels: normalizedFibonacciSettings.timeLevels.map((level) => ({
                  ...level,
                  enabled:
                    drawingProperties.presentation.lines?.[`time:${level.id}`]?.visible ??
                    drawingProperties.presentation.lines?.[`time:${level.value}`]?.visible ??
                    level.enabled,
                })),
              },
            }
          : normalizedDrawing.toolSettings;
    const sharedProperties = {
      color: drawingProperties.color,
      lineWidth: nextLineWidth,
      lineStyle: drawingProperties.lineStyle,
      locked: drawingProperties.locked,
      visibility: drawingProperties.visibility,
      toolSettings: nextToolSettings,
      ...capabilityProperties,
      ...advancedStyleProperties,
    };

    const clampBarIndex = (value: number): number =>
      Math.max(0, Math.min(Math.max(0, bars.length - 1), Math.round(value)));

    if (drawing.kind === 'hline') {
      const nextPrice = Number(drawingProperties.price);
      if (!Number.isFinite(nextPrice)) return;
      const updatedDrawing: ChartDrawing = { ...drawing, ...sharedProperties, price: nextPrice };
      updateDrawing(updatedDrawing);
      scheduleDrawingAlertGeometrySync(updatedDrawing);
    } else if (drawing.kind === 'vline') {
      const nextBarIndex = Number(drawingProperties.barIndex);
      if (!Number.isFinite(nextBarIndex)) return;
      const clampedBarIndex = clampBarIndex(nextBarIndex);
      updateDrawing({
        ...drawing,
        ...sharedProperties,
        barIndex: clampedBarIndex,
        anchorTimestamp: bars[clampedBarIndex]?.timestamp,
        renkoAnchor: undefined,
      });
    } else if (drawing.kind === 'longPosition' || drawing.kind === 'shortPosition') {
      const entry = Number(drawingProperties.positionEntry);
      const target = Number(drawingProperties.positionTarget);
      const stop = Number(drawingProperties.positionStop);
      if (
        !Number.isFinite(entry) ||
        !Number.isFinite(target) ||
        !Number.isFinite(stop) ||
        Math.abs(target - entry) < 1e-9 ||
        Math.abs(stop - entry) < 1e-9
      ) {
        return;
      }
      const nextAnchors = drawing.anchors.map((anchor) => ({ ...anchor }));
      if (nextAnchors.length < 3) return;
      nextAnchors[0] = { ...nextAnchors[0], price: entry };
      nextAnchors[1] = { ...nextAnchors[1], price: target };
      nextAnchors[2] = { ...nextAnchors[2], price: stop };
      const normalizedAnchors = normalizePositionAnchors(drawing.kind, nextAnchors).map((anchor) => ({
        ...anchor,
        timestamp: bars[clampBarIndex(anchor.barIndex)]?.timestamp,
        renkoAnchor: undefined,
      }));
      updateDrawing({
        ...drawing,
        ...sharedProperties,
        anchors: normalizedAnchors,
      });
    } else if (drawing.kind === 'text') {
      const nextBarIndex = Number(drawingProperties.barIndex);
      const nextPrice = Number(drawingProperties.price);
      const nextFontSize = Number(drawingProperties.fontSize);
      const nextWidth = Number(drawingProperties.boxWidth);
      const nextHeight = Number(drawingProperties.boxHeight);
      if (
        !Number.isFinite(nextBarIndex) ||
        !Number.isFinite(nextPrice) ||
        !Number.isFinite(nextFontSize) ||
        !Number.isFinite(nextWidth) ||
        !Number.isFinite(nextHeight) ||
        nextFontSize <= 0 ||
        nextWidth < 60 ||
        nextHeight < 20
      ) {
        return;
      }
      const clampedBarIndex = clampBarIndex(nextBarIndex);
      updateDrawing({
        ...drawing,
        ...sharedProperties,
        barIndex: clampedBarIndex,
        anchorTimestamp: bars[clampedBarIndex]?.timestamp,
        renkoAnchor: undefined,
        price: nextPrice,
        text: drawingProperties.text || 'Text',
        fontSize: nextFontSize,
        fontFamily: drawingProperties.fontFamily,
        bold: drawingProperties.bold,
        italic: drawingProperties.italic,
        textAlign: drawingProperties.textAlign,
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    } else if ('barIndex' in drawing && 'price' in drawing) {
      const nextBarIndex = Number(drawingProperties.barIndex);
      const nextPrice = Number(drawingProperties.price);
      if (!Number.isFinite(nextBarIndex) || !Number.isFinite(nextPrice)) return;
      const clampedBarIndex = clampBarIndex(nextBarIndex);
      updateDrawing({
        ...drawing,
        ...sharedProperties,
        barIndex: clampedBarIndex,
        anchorTimestamp: bars[clampedBarIndex]?.timestamp,
        renkoAnchor: undefined,
        price: nextPrice,
      });
    } else if ('anchors' in drawing) {
      if (drawingProperties.anchorCoordinates.length !== drawing.anchors.length) return;
      const nextAnchors = drawingProperties.anchorCoordinates.map((anchor) => ({
        barIndex: Number(anchor.barIndex),
        price: Number(anchor.price),
      }));
      if (nextAnchors.some((anchor) => !Number.isFinite(anchor.barIndex) || !Number.isFinite(anchor.price))) return;
      const anchors = nextAnchors.map((anchor, index) => {
        const barIndex = clampBarIndex(anchor.barIndex);
        return {
          ...drawing.anchors[index],
          barIndex,
          price: anchor.price,
          timestamp: bars[barIndex]?.timestamp,
          renkoAnchor: undefined,
        };
      });
      const updatedDrawing: ChartDrawing = {
        ...drawing,
        ...sharedProperties,
        anchors,
      };
      updateDrawing(updatedDrawing);
      scheduleDrawingAlertGeometrySync(updatedDrawing);
    } else if ('startIndex' in drawing) {
      const nextStartIndex = Number(drawingProperties.startIndex);
      const nextEndIndex = Number(drawingProperties.endIndex);
      const nextStartPrice = Number(drawingProperties.startPrice);
      const nextEndPrice = Number(drawingProperties.endPrice);
      if (
        !Number.isFinite(nextStartIndex) ||
        !Number.isFinite(nextEndIndex) ||
        !Number.isFinite(nextStartPrice) ||
        !Number.isFinite(nextEndPrice)
      ) {
        return;
      }
      const startIndex = clampBarIndex(nextStartIndex);
      const endIndex = clampBarIndex(nextEndIndex);
      const coordinateProperties = {
        startIndex,
        endIndex,
        startPrice: nextStartPrice,
        endPrice: nextEndPrice,
        startTimestamp: bars[startIndex]?.timestamp,
        endTimestamp: bars[endIndex]?.timestamp,
        startRenkoAnchor: undefined,
        endRenkoAnchor: undefined,
      };
      if (drawing.kind === 'channel') {
        const nextOffset = Number(drawingProperties.offset);
        if (!Number.isFinite(nextOffset)) return;
        updateDrawing({
          ...drawing,
          ...sharedProperties,
          ...coordinateProperties,
          offset: nextOffset,
        });
      } else {
        const updatedDrawing: ChartDrawing = {
          ...drawing,
          ...sharedProperties,
          ...coordinateProperties,
        };
        updateDrawing(updatedDrawing);
        scheduleDrawingAlertGeometrySync(updatedDrawing);
      }
    }

    closeDrawingProperties();
  };

  const toggleIndicatorVisibility = (indicatorId: string, visible: boolean) => {
    const indicator = overlays.find((o) => o.id === indicatorId);
    if (indicator) {
      updateIndicator({ ...indicator, visible });
    }
  };

  const startPaneSeparatorResize = (paneId: string, startHeight: number, startY: number) => {
    const rect = chartViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      setIndicatorPaneHeight(startHeight - delta, paneId, tabId ?? undefined);
      setResizeGhostY(moveEvent.clientY - rect.top);
    };
    const onUp = () => {
      setResizeGhostY(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    setResizeGhostY(startY - rect.top);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleChartKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((tabId !== null && tabId !== activeChartTabId) || !shouldHandleChartViewportShortcut(event)) {
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const requestedTimeframe = chartTimeframeForShortcut(event.key);
        if (requestedTimeframe) {
          event.preventDefault();
          setTimeframe(requestedTimeframe);
          return;
        }
        const lowerKey = event.key.toLowerCase();
        if (lowerKey === 'x') {
          event.preventDefault();
          setDrawingTool(activeDrawingTool === 'crosshair' ? 'cursor' : 'crosshair');
          clearTransientDrawingUi();
          return;
        }
        if (lowerKey === 'h') {
          event.preventDefault();
          togglePrimaryDrawingTool('hline');
          return;
        }
        if (lowerKey === 'v') {
          event.preventDefault();
          togglePrimaryDrawingTool('vline');
          return;
        }
        if (lowerKey === 'l') {
          event.preventDefault();
          togglePrimaryDrawingTool('trendline');
          return;
        }
        if (lowerKey === 'c') {
          event.preventDefault();
          setDrawingTool('cursor');
          clearTransientDrawingUi();
          return;
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigateSymbol('prev');
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigateSymbol('next');
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeViewport(-Math.max(1, Math.round(visibleSpan * 0.15)));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeViewport(Math.max(1, Math.round(visibleSpan * 0.15)));
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomViewportByFactor(ZOOM_BUTTON_STEP);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        zoomViewportByFactor(1 / ZOOM_BUTTON_STEP);
        return;
      }
      if (event.key === '0' || event.key === 'Home') {
        event.preventDefault();
        resetViewport();
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        scrollToViewportStart(maxScrollStart);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (event.shiftKey) {
          clearDrawings();
          if (scannerChartOverlay) {
            clearScannerChartOverlay();
            clearTransientDrawingUi();
          }
          return;
        }
        if (selectedDrawingId) {
          deleteDrawingOrScannerOverlay(selectedDrawingId);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawingTool('cursor');
        clearTransientDrawingUi();
        return;
      }
    },
    [
      tabId,
      activeChartTabId,
      setTimeframe,
      activeDrawingTool,
      setDrawingTool,
      clearTransientDrawingUi,
      togglePrimaryDrawingTool,
      navigateSymbol,
      nudgeViewport,
      visibleSpan,
      zoomViewportByFactor,
      resetViewport,
      scrollToViewportStart,
      maxScrollStart,
      clearDrawings,
      scannerChartOverlay,
      clearScannerChartOverlay,
      selectedDrawingId,
      deleteDrawingOrScannerOverlay,
    ],
  );

  return (
    <div style={chartWrapStyle}>
      <div
        ref={chartViewportRef}
        style={{
          ...chartViewportStyle,
          borderColor: dropActive ? 'var(--accent)' : 'var(--border)',
          boxShadow: dropActive ? 'inset 0 0 0 1px var(--accent)' : 'none',
        }}
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes('application/x-eod-indicator-preset') ||
            event.dataTransfer.types.includes('application/x-eod-indicator-kind')
          ) {
            event.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onContextMenu={(event) => {
          event.preventDefault();
          const rect = chartViewportRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }

          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          if (isWithinPriceScaleZone(localX, localY, rect.width, layout.priceHeight, layout.axisWidth, layout.leftAxisWidth)) {
            setDrawingContextMenu(null);
            const side = (layout.leftAxisWidth > 0 && localX <= layout.leftAxisWidth) ? 'left' : 'right';
            const offset = (side === 'left' ? layout.leftAxisWidth : layout.axisWidth) + 8;
            const availableDown = layout.priceHeight - localY;
            const availableUp = localY;
            const openUp = availableDown < 380 && availableUp > availableDown;

            if (openUp) {
              setAxisSettingsAnchorBottom(Math.max(PRICE_AXIS_HEADER_HEIGHT + 4, rect.height - localY));
              setAxisSettingsAnchorTop(0);
              setAxisSettingsDirection('up');
            } else {
              setAxisSettingsAnchorTop(clampAxisSettingsTop(localY, layout.priceHeight));
              setAxisSettingsAnchorBottom(null);
              setAxisSettingsDirection('down');
            }
            setAxisSettingsAnchorOffset(offset);
            setSettingsSide(side);
            setChartSettingsOpen(true);
            return;
          }

          const drawing = engineRef.current?.pickDrawingAt(localX, localY);
          if (!drawing) {
            setDrawingContextMenu(null);
            setChartSettingsOpen(false);
            runForChart(() => {
              setChartContextMenu({
                x: Math.min(localX, Math.max(rect.width - CHART_CONTEXT_MENU_WIDTH, 8)),
                y: Math.min(localY, Math.max(rect.height - CHART_CONTEXT_MENU_EXPANDED_HEIGHT, 8)),
              });
            });
            return;
          }

          setChartContextMenu(null);
          selectDrawing(drawing.id);
          setDrawingTool('cursor');
          setDrawingContextMenu({
            drawingId: drawing.id,
            x: Math.min(event.clientX - rect.left, Math.max(rect.width - 150, 8)),
            y: Math.min(event.clientY - rect.top, Math.max(rect.height - 122, 8)),
          });
        }}
        onMouseDownCapture={(event) => {
          if (isChartExternalOrDialogEvent(event.target, event.currentTarget)) {
            return;
          }
          if (tabId && tabId !== activeChartTabId) {
            activateChartTab(tabId);
          }
          chartViewportRef.current?.focus();
          const rect = chartViewportRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }
          latestChartPointerRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
        }}
        onPointerDownCapture={(event) => {
          if (isChartExternalOrDialogEvent(event.target, event.currentTarget)) {
            return;
          }
          chartViewportRef.current?.focus();
        }}
        onDoubleClick={(event) => {
          if (isChartExternalOrDialogEvent(event.target, event.currentTarget)) {
            return;
          }
          if (activeDrawingTool !== 'cursor') {
            return;
          }
          const rect = chartViewportRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const drawing = engineRef.current?.pickDrawingAt(x, y);
          if (!drawing || drawing.kind !== 'text') {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          selectDrawing(drawing.id);
          setInlineTextEditor({ drawingId: drawing.id, text: drawing.text, isNew: false, x, y });
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          const presetId = event.dataTransfer.getData('application/x-eod-indicator-preset') as IndicatorCatalogId;
          const kind = event.dataTransfer.getData('application/x-eod-indicator-kind') as OverlayIndicator['kind'];
          if (presetId) {
            addIndicatorCatalog(presetId);
            return;
          }
          if (
            kind === 'SMA' ||
            kind === 'EMA' ||
            kind === 'WMA' ||
            kind === 'WEMA' ||
            kind === 'BOLL' ||
            kind === 'PSAR' ||
            kind === 'RSI' ||
            kind === 'MACD' ||
            kind === 'STOCH' ||
            kind === 'ROC' ||
            kind === 'CCI' ||
            kind === 'WILLR' ||
            kind === 'ATR' ||
            kind === 'ADX' ||
            kind === 'MFI' ||
            kind === 'OBV'
          ) {
            addIndicator(kind);
          }
        }}
        tabIndex={0}
        onKeyDown={handleChartKeyDown}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--chart-bg)' }} />
        {inlineTextEditor ? (
          <input
            ref={inlineTextInputRef}
            type="text"
            value={inlineTextEditor.text}
            placeholder="Text"
            aria-label="Chart text"
            style={inlineTextEditorStyle(inlineTextEditor.x, inlineTextEditor.y, viewportSize.width, viewportSize.height)}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              setInlineTextEditor((editor) => (editor ? { ...editor, text: event.target.value } : editor))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                finishInlineTextEditor(inlineTextEditor);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelInlineTextEditor(inlineTextEditor);
              }
            }}
            onBlur={() => {
              if (inlineTextEditorCancelledRef.current) {
                inlineTextEditorCancelledRef.current = false;
                return;
              }
              finishInlineTextEditor(inlineTextEditor);
            }}
          />
        ) : null}
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--overlay-bg)',
              color: 'var(--text)',
              fontSize: 12,
            }}
          >
            Loading {instrument ? `${instrument.exchange}:${instrument.symbol}` : 'symbol'}...
          </div>
        ) : null}
        {dropActive ? (
          <div style={dropHintStyle}>
            Drop indicator here
          </div>
        ) : null}
        <ChartPriceLegendOverlay
          instrument={instrument}
          instrumentName={instrumentMeta?.name ?? null}
          timeframe={timeframe}
          chartType={chartType}
          renkoSettings={renkoSettings}
          bars={bars}
          viewport={viewport}
          compareOverlays={compareOverlays}
          overlays={overlays}
          paneScaleOverrides={paneScaleOverrides}
          layout={layout}
          hoverBarIndex={legendBarIndex}
          onSaveIndicator={updateIndicator}
          onRemoveIndicator={removeIndicator}
          onToggleIndicatorVisibility={toggleIndicatorVisibility}
          secondaryLegendExpanded={priceLegendExpanded}
          onSecondaryLegendExpandedChange={setPriceLegendExpanded}
        />
        <button
          type="button"
          style={axisScaleButtonStyle(
            chartSettingsOpen && settingsSide === 'right' && axisSettingsDirection === 'up',
            layout.axisWidth,
          )}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => {
            setDrawingContextMenu(null);
            setAxisSettingsAnchorTop(0);
            setAxisSettingsAnchorBottom(PRICE_AXIS_HEADER_HEIGHT + 4);
            setAxisSettingsAnchorOffset(layout.axisWidth + 8);
            setAxisSettingsDirection('up');
            setSettingsSide('right');
            setChartSettingsOpen((open) => !open);
          }}
          aria-label="Scale settings"
          title="Scale settings"
        >
          ⚙
        </button>
        {chartSettingsOpen ? (
          <div style={chartSettingsAnchorStyle(axisSettingsAnchorTop, settingsSide, axisSettingsAnchorOffset, axisSettingsAnchorBottom)}>
            <ChartSettingsMenu
              placement="axis"
              side={settingsSide}
              direction={axisSettingsDirection}
              maxHeight={chartSettingsMenuMaxHeight}
              width={chartSettingsMenuWidth}
              priceAutoFit={priceAutoFit}
              allPanesAutoFit={allPanesAutoFit}
              logScale={logScale}
              invertPriceScale={invertPriceScale}
              adjustedMode={adjustedMode}
              includeDividendAdjustments={includeDividendAdjustments}
              includeRightsAdjustments={includeRightsAdjustments}
              valueLabelSettings={valueLabelSettings}
              showLeftAxis={showLeftAxis}
              futureMarginMode={futureMarginMode}
              volumeProfileEnabled={volumeProfileEnabled}
              onSetVolumeProfileEnabled={(enabled) => setVolumeProfileEnabled(enabled)}
              onAutoFitPriceScale={() => runForChart(() => setPaneScaleOverride('price', null))}
              onFitAllPanes={() => runForChart(fitAllPanes)}
              onSetIncludeDividendAdjustments={(enabled) => runForChart(() => setIncludeDividendAdjustments(enabled))}
              onSetIncludeRightsAdjustments={(enabled) => runForChart(() => setIncludeRightsAdjustments(enabled))}
              onSetLogScale={(enabled) => runForChart(() => setLogScale(enabled))}
              onSetInvertPriceScale={(enabled) => runForChart(() => setInvertPriceScale(enabled))}
              onSetShowValueLabels={(show) => runForChart(() => setShowValueLabels(show))}
              onSetValueLabelSettings={(settings) => runForChart(() => setValueLabelSettings(settings))}
              onSetShowLeftAxis={(show) => runForChart(() => setShowLeftAxis(show))}
              onSetFutureMarginMode={(mode) => runForChart(() => setFutureMarginMode(mode))}
              onClose={() => setChartSettingsOpen(false)}
            />
          </div>
        ) : null}
        <ChartContextMenu
          menu={chartContextMenu}
          drawingItems={contextMenuDrawingItems}
          indicatorItems={contextMenuIndicatorItems}
          indicatorAlertItems={contextMenuIndicatorAlertItems}
          onResetView={() => runForChart(resetViewport)}
          onOpenSettings={() => runForChart(() => setChartSettingsDialogOpen(true))}
          onRemoveDrawing={(drawingId) =>
            runForChart(() => {
              selectDrawing(drawingId);
              deleteDrawingOrScannerOverlay(drawingId);
            })
          }
          onRemoveIndicator={(indicatorId) => runForChart(() => removeIndicator(indicatorId))}
          onCreateIndicatorAlert={(indicatorId) => void createAlertForIndicator(indicatorId)}
          onClose={() => setChartContextMenu(null)}
        />
        {chartSettingsDialogOpen ? (
          <ChartSettingsDialog
            chartType={chartType}
            renkoSettings={renkoSettings}
            visualSettings={visualSettings}
            showVolume={showVolume}
            priceAutoFit={priceAutoFit}
            allPanesAutoFit={allPanesAutoFit}
            adjustedMode={adjustedMode}
            includeDividendAdjustments={includeDividendAdjustments}
            includeRightsAdjustments={includeRightsAdjustments}
            logScale={logScale}
            invertPriceScale={invertPriceScale}
            valueLabelSettings={valueLabelSettings}
            showLeftAxis={showLeftAxis}
            futureMarginMode={futureMarginMode}
            chartEventVisibility={chartEventVisibility}
            instrument={instrument}
            onSave={(nextChartType, nextRenkoSettings) => {
              const error = runForChart(() => applyChartSettingsDialog(nextChartType, nextRenkoSettings));
              if (error) {
                return error;
              }
              setChartSettingsDialogOpen(false);
              return null;
            }}
            onSetShowVolume={(show) => runForChart(() => setShowVolume(show))}
            onAutoFitPriceScale={() => runForChart(() => setPaneScaleOverride('price', null))}
            onFitAllPanes={() => runForChart(fitAllPanes)}
            onSetAdjustedMode={(adjusted) => runForChart(() => setAdjustedMode(adjusted))}
            onSetIncludeDividendAdjustments={(enabled) => runForChart(() => setIncludeDividendAdjustments(enabled))}
            onSetIncludeRightsAdjustments={(enabled) => runForChart(() => setIncludeRightsAdjustments(enabled))}
            onSetLogScale={(enabled) => runForChart(() => setLogScale(enabled))}
            onSetInvertPriceScale={(enabled) => runForChart(() => setInvertPriceScale(enabled))}
            onSetShowValueLabels={(show) => runForChart(() => setShowValueLabels(show))}
            onSetValueLabelSettings={(settings) => runForChart(() => setValueLabelSettings(settings))}
            onSetShowLeftAxis={(show) => runForChart(() => setShowLeftAxis(show))}
            onSetFutureMarginMode={(mode) => runForChart(() => setFutureMarginMode(mode))}
            onSetChartVisualSettings={(settings) => runForChart(() => setChartVisualSettings(settings))}
            onToggleChartEventVisibility={(eventType) => runForChart(() => toggleChartEventVisibility(eventType))}
            onClose={() => setChartSettingsDialogOpen(false)}
          />
        ) : null}
        {signalSettingsDialogOpen ? (
          <SignalSettingsDialog
            rules={signalRules}
            allIndicators={overlays}
            onSaveRules={(rules) => setSignalRules(rules)}
            onClose={() => closeSignalSettingsDialog()}
          />
        ) : null}
        <ChartPaneControlsOverlay
          paneIndicators={paneIndicators}
          allIndicators={overlays}
          sourceBars={bars}
          layout={layout}
          indicatorPaneHeights={indicatorPaneHeights}
          indicatorPaneHeight={indicatorPaneHeight}
          collapsedIndicatorPanes={collapsedIndicatorPanes}
          paneScaleOverrides={paneScaleOverrides}
          paneSettingsIndicator={paneSettingsIndicator}
          onStartPaneResize={startPaneSeparatorResize}
          onResizePane={(paneId, height) => setIndicatorPaneHeight(height, paneId, tabId ?? undefined)}
          onTogglePaneCollapsed={setIndicatorPaneCollapsed}
          onResetPaneScale={(paneId) => setPaneScaleOverride(paneId, null)}
          onMovePane={moveIndicatorPane}
          onOpenPaneSettings={setPaneSettingsIndicatorId}
          onCreateAlert={(indicatorId) => void createAlertForIndicator(indicatorId)}
          onSaveIndicator={(updated) => {
            updateIndicator(updated);
            setPaneSettingsIndicatorId(null);
          }}
          onRemoveIndicator={(id) => {
            removeIndicator(id);
            setPaneSettingsIndicatorId(null);
          }}
          onToggleIndicatorVisibility={toggleIndicatorVisibility}
          onClosePaneSettings={() => setPaneSettingsIndicatorId(null)}
        />
        {resizeGhostY !== null ? (
          <div
            style={{
              position: 'absolute',
              top: resizeGhostY,
              left: layout.leftAxisWidth ?? 0,
              right: layout.axisWidth,
              height: 1,
              background: 'var(--accent)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        <ChartDrawingContextMenu
          drawingContextMenu={drawingContextMenu}
          locked={drawingContextMenuLocked}
          canCreateAlert={drawingContextMenuCanCreateAlert}
          onOpenProperties={(drawingId) => {
            if (!isScannerOverlayDrawingId(drawingId)) {
              openDrawingPropertiesRequest(drawingId);
            }
            setDrawingContextMenu(null);
          }}
          onCreateAlert={(drawingId) => {
            void createAlertForDrawing(drawingId);
            setDrawingContextMenu(null);
          }}
          onToggleLock={(drawingId) => {
            if (!isScannerOverlayDrawingId(drawingId)) {
              selectDrawing(drawingId);
              toggleDrawingLock(drawingId);
            }
            setDrawingContextMenu(null);
          }}
          onDelete={(drawingId) => {
            selectDrawing(drawingId);
            deleteDrawingOrScannerOverlay(drawingId);
            setDrawingContextMenu(null);
          }}
        />
        {drawingProperties ? (
          <ChartDrawingPropertiesDialog
            drawingProperties={drawingProperties}
            selectedDrawing={selectedDrawing}
            setDrawingProperties={setDrawingProperties}
            onClose={closeDrawingProperties}
            onDelete={(drawingId) => {
              const drawing = drawings.find((item) => item.id === drawingId);
              if (drawing?.locked) {
                return;
              }
              selectDrawing(drawingId);
              void markDrawingAlertMissing(drawingId);
              deleteSelectedDrawing();
              closeDrawingProperties();
            }}
            onSave={applyDrawingProperties}
            actionButtonStyle={chartControlButtonStyle}
          />
        ) : null}
      </div>

      <div style={scrollbarWrapStyle}>
        {bottomBarStartContent ? <div style={bottomBarStartStyle}>{bottomBarStartContent}</div> : null}
        <div style={scrollbarControlsStyle}>
          <button type="button" style={chartControlButtonStyle} onClick={() => resetViewport()} title="Reset zoom">
            0
          </button>
          <button
            type="button"
            style={chartControlButtonStyle}
            onClick={() => zoomViewportByFactor(1 / ZOOM_BUTTON_STEP)}
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            style={chartControlButtonStyle}
            onClick={() => zoomViewportByFactor(ZOOM_BUTTON_STEP)}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            style={chartControlButtonStyle}
            onClick={() => nudgeViewport(-Math.max(1, Math.round(visibleSpan * 0.2)))}
            title="Scroll left"
          >
            {'<'}
          </button>
          <div style={scrollbarViewportWrapStyle}>
            <div
              className="chart-native-scrollbar"
              ref={nativeScrollbarRef}
              style={nativeScrollbarStyle}
              tabIndex={0}
              aria-label="Horizontal chart scroll"
              onScroll={(event) => {
                if (syncingNativeScrollbarRef.current || loading) {
                  return;
                }

                const element = event.currentTarget;
                const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);
                if (maxScrollLeft <= 0) {
                  return;
                }

                const nextStart = Math.round((element.scrollLeft / maxScrollLeft) * maxScrollStart);
                scrollToViewportStart(nextStart);
              }}
              title="Horizontal chart scroll"
            >
              <div style={{ width: scrollbarContentWidth, height: 1 }} />
            </div>
          </div>
          <button
            type="button"
            style={chartControlButtonStyle}
            onClick={() => nudgeViewport(Math.max(1, Math.round(visibleSpan * 0.2)))}
            title="Scroll right"
          >
            {'>'}
          </button>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, minWidth: 60, textAlign: 'right' }}>
            {visibleBarCount} {visibleBarCount === 1 ? 'bar' : 'bars'}
          </span>
          <span style={visibleDateRangeStyle}>{visibleDateRangeLabel}</span>
        </div>
      </div>
    </div>
  );
}

function geometryToMultiAnchorDrawing(
  overlay: ScannerChartOverlay,
  bars: OHLCBar[],
  color: string,
  locked: boolean,
): ChartDrawing | null {
  const geometry = overlay.geometry;
  if (!geometry) return null;

  const anchorFromPoint = (p: { date: string; price: number; index?: number }): { barIndex: number; price: number } | null => {
    if (!p || !isFinitePrice(p.price)) return null;
    const idx = findScannerGeometryPointIndex(bars, p);
    return idx < 0 ? null : { barIndex: idx, price: p.price };
  };

  switch (geometry.family) {
    case 'head-and-shoulders':
    case 'complex-head-and-shoulders': {
      const lsMarker = geometry.pivotMarkers?.find((p) => p.label === 'LS');
      const headMarker = geometry.pivotMarkers?.find((p) => p.label === 'H' || p.label === 'Head');
      const rsMarker = geometry.pivotMarkers?.find((p) => p.label === 'RS');
      const n1Marker = geometry.pivotMarkers?.find((p) => p.label === 'N1');
      const n2Marker = geometry.pivotMarkers?.find((p) => p.label === 'N2');

      if (!lsMarker || !headMarker || !rsMarker) return null;

      const pLS = anchorFromPoint(lsMarker);
      const pHead = anchorFromPoint(headMarker);
      const pRS = anchorFromPoint(rsMarker);
      if (!pLS || !pHead || !pRS) return null;

      const pN1 = n1Marker ? anchorFromPoint(n1Marker) : null;
      const pN2 = n2Marker ? anchorFromPoint(n2Marker) : null;
      if (!pN1 || !pN2) return null;
      if (!(pLS.barIndex < pN1.barIndex && pN1.barIndex < pHead.barIndex &&
        pHead.barIndex < pN2.barIndex && pN2.barIndex < pRS.barIndex)) return null;

      const anchors: Array<{ barIndex: number; price: number }> = [pLS, pN1, pHead, pN2, pRS];
      if (geometry.targetProjection) {
        const lastIdx = pRS.barIndex;
        if (isFinitePrice(geometry.targetProjection.targetPrice)) {
          anchors.push({ barIndex: lastIdx + 5, price: geometry.targetProjection.targetPrice });
        }
        if (isFinitePrice(geometry.targetProjection.stopLossPrice)) {
          anchors.push({ barIndex: lastIdx + 5, price: geometry.targetProjection.stopLossPrice });
        }
      }

      return {
        id: `scanner-overlay:${overlay.id}:headAndShoulders`,
        kind: 'headAndShouldersPattern',
        anchors,
        color,
        lineWidth: 1.5,
        locked,
      };
    }

    case 'triangle':
    case 'wedge':
      // Independent boundaries need all four endpoints and their ray semantics.
      // The generic geometry path preserves these; a manual triangle cannot.
      return null;

    default:
      return null;
  }
}

function buildScannerOverlayDrawings(
  overlay: ScannerChartOverlay | null,
  instrument: InstrumentKey | null,
  bars: OHLCBar[],
  options: { editable?: boolean } = {},
): ChartDrawing[] {
  if (
    !overlay ||
    !instrument ||
    overlay.instrument.exchange !== instrument.exchange ||
    overlay.instrument.symbol !== instrument.symbol ||
    bars.length === 0
  ) {
    return [];
  }

  const barIndex = findBarIndexOnOrAfter(bars, overlay.date);
  if (barIndex < 0) {
    return [];
  }

  const bar = bars[barIndex];
  const editable = Boolean(options.editable);
  const color = editable ? '#3b82f6' : getScannerOverlayColor(overlay.direction);
  const locked = !editable;
  const drawingIdPrefix = editable ? `scanner-drawing:${overlay.id}` : `scanner-overlay:${overlay.id}`;
  const markerPrice = Math.max(bar.high, bar.close, bar.open);
  const scoreLabel = typeof overlay.score === 'number' ? ` ${overlay.score}` : '';
  const geometry = overlay.geometry;
  const hasDedicatedGeometryLabel = Boolean(geometry?.labels && geometry.labels.length > 0);
  const drawings: ChartDrawing[] = editable || hasDedicatedGeometryLabel
    ? []
    : [
        {
          id: `${drawingIdPrefix}:label`,
          kind: 'text',
          barIndex,
          price: markerPrice,
          text: `${overlay.scannerName}${scoreLabel}`,
          color,
          fontSize: 12,
          locked,
        },
      ];
  const multiDrawing = !editable ? geometryToMultiAnchorDrawing(overlay, bars, color, locked) : null;
  const hasGeometry = Boolean(
    multiDrawing ||
      (geometry?.trendLines && geometry.trendLines.length > 0) ||
      (geometry?.zones && geometry.zones.length > 0),
  );

  const hasConfirmationLine = Boolean(
    geometry?.trendLines?.some(
      (line) => line.role === 'resistance' || line.role === 'support' || line.role === 'neckline',
    ),
  );

  if (!editable && !multiDrawing && !hasConfirmationLine && Array.isArray(overlay.levels) && overlay.levels.length > 0) {
    const hasBreakoutLevel = overlay.levels.some((l) => l.label === 'Breakout' && isFinitePrice(l.value));
    if (hasBreakoutLevel) {
      drawings.push({
        id: `${drawingIdPrefix}:breakout-marker`,
        kind: overlay.direction === 'bearish' ? 'arrowDown' : 'arrowUp',
        barIndex,
        price: overlay.direction === 'bearish' ? bar.high : bar.low,
        color,
        locked,
      });
    }
  }

  if (!editable && !multiDrawing) {
    overlay.levels.forEach((level, index) => {
      if (!isFinitePrice(level.value)) {
        return;
      }
      if (hasGeometry && (hasConfirmationLine || level.label !== 'Breakout')) {
        return;
      }
      drawings.push({
        id: `${drawingIdPrefix}:level:${index}`,
        kind: 'ray',
        startIndex: Math.max(0, barIndex - (hasGeometry ? 3 : 15)),
        startPrice: level.value,
        endIndex: barIndex,
        endPrice: level.value,
        color,
        lineWidth: 1.2,
        lineStyle: 'dashed',
        locked,
      });
      drawings.push({
        id: `${drawingIdPrefix}:level-label:${index}`,
        kind: 'text',
        barIndex,
        price: level.value,
        text: `${level.label} ${level.value}`,
        color,
        fontSize: 11,
        locked,
      });
    });
  }

  geometry?.zones?.forEach((zone) => {
    if (!isFinitePrice(zone.low) || !isFinitePrice(zone.high)) {
      return;
    }
    const startIndex = findBarIndexOnOrAfter(bars, zone.startDate);
    const endIndex = findBarIndexOnOrAfter(bars, zone.endDate);
    if (startIndex < 0 || endIndex < 0) {
      return;
    }
    const low = Math.min(zone.low, zone.high);
    const high = Math.max(zone.low, zone.high);
    drawings.push({
      id: `${drawingIdPrefix}:zone:${zone.id}`,
      presentation: {
        fills: {
          body: {
            visible: true,
            color,
            opacity: typeof zone.fillOpacity === 'number'
              ? zone.fillOpacity
              : zone.role === 'base'
                ? 0.12
                : 0.1,
          },
        },
      },
      kind: 'rect',
      startIndex: Math.min(startIndex, endIndex),
      startPrice: high,
      endIndex: Math.max(startIndex, endIndex),
      endPrice: low,
      color,
      lineWidth: 1.1,
      lineStyle: 'dotted',
      locked,
    });
    if (!editable && zone.label) {
      drawings.push({
        id: `${drawingIdPrefix}:zone-label:${zone.id}`,
        kind: 'text',
        barIndex: Math.max(startIndex, endIndex),
        price: high,
        text: zone.label,
        color,
        fontSize: 11,
        locked,
      });
    }
  });

  if (multiDrawing) {
    drawings.push(multiDrawing);
  } else {
    geometry?.trendLines?.forEach((line) => {
      if (!isFinitePrice(line.start.price) || !isFinitePrice(line.end.price)) {
        return;
      }
      const startIndex = findScannerGeometryPointIndex(bars, line.start);
      const endIndex = findScannerGeometryPointIndex(bars, line.end);
      if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) {
        return;
      }
      drawings.push({
        id: `${drawingIdPrefix}:trend:${line.id}`,
        kind: line.extendRight ? 'ray' : 'trendline',
        startIndex,
        startPrice: line.start.price,
        endIndex,
        endPrice: line.end.price,
        color,
        lineWidth: 1.5,
        lineStyle: line.role === 'neckline' || line.role === 'midline' ? 'dashed' : 'solid',
        locked,
      });
      if (!editable && line.label) {
        drawings.push({
          id: `${drawingIdPrefix}:trend-label:${line.id}`,
          kind: 'text',
          barIndex: endIndex,
          price: line.end.price,
          text: line.label,
          color,
          fontSize: 11,
          locked,
        });
      }
    });

    if (!editable) {
      geometry?.pivotMarkers?.forEach((pivot) => {
        const breakoutPivotIndex = isFinitePrice(pivot.price) ? findScannerGeometryPointIndex(bars, pivot) : -1;
        if (breakoutPivotIndex >= 0 && pivot.role === 'breakout') {
          drawings.push({
            id: `${drawingIdPrefix}:pivot-marker:${pivot.id}`,
            kind: pivot.kind === 'low' || overlay.direction === 'bearish' ? 'arrowDown' : 'arrowUp',
            barIndex: breakoutPivotIndex,
            price: pivot.price,
            color,
            locked,
          });
        }
        if (!isFinitePrice(pivot.price)) {
          return;
        }
        const pivotIndex = findScannerGeometryPointIndex(bars, pivot);
        if (pivotIndex < 0) {
          return;
        }
        drawings.push({
          id: `${drawingIdPrefix}:pivot:${pivot.id}`,
          kind: 'text',
          barIndex: pivotIndex,
          price: pivot.price,
          text: pivot.label,
          color,
          fontSize: 11,
          locked,
        });
      });
    }
  }

  if (!editable) {
    geometry?.labels?.forEach((label) => {
      if (!isFinitePrice(label.point.price)) {
        return;
      }
      const labelIndex = findScannerGeometryPointIndex(bars, label.point);
      if (labelIndex < 0) {
        return;
      }
      drawings.push({
        id: `${drawingIdPrefix}:geometry-label:${label.id}`,
        kind: 'text',
        barIndex: labelIndex,
        price: label.point.price,
        text: label.text,
        color,
        fontSize: 12,
        locked,
      });
    });
  }

  if (!editable && geometry?.targetProjection) {
    const targetProj = geometry.targetProjection;
    if (isFinitePrice(targetProj.targetPrice)) {
      drawings.push({
        id: `${drawingIdPrefix}:target-price`,
        kind: 'ray',
        startIndex: barIndex,
        startPrice: targetProj.targetPrice,
        endIndex: Math.min(bars.length - 1, barIndex + 5),
        endPrice: targetProj.targetPrice,
        color: '#22c55e',
        lineWidth: 1.5,
        lineStyle: 'dashed',
        locked,
      });
      const gainText = typeof targetProj.potentialGainPct === 'number' && Number.isFinite(targetProj.potentialGainPct)
        ? ` (${targetProj.potentialGainPct > 0 ? '+' : ''}${targetProj.potentialGainPct.toFixed(1)}%)`
        : '';
      drawings.push({
        id: `${drawingIdPrefix}:target-price-label`,
        kind: 'text',
        barIndex,
        price: targetProj.targetPrice,
        text: `Target ${targetProj.targetPrice}${gainText}`,
        color: '#22c55e',
        fontSize: 11,
        locked,
      });
    }
    if (isFinitePrice(targetProj.stopLossPrice)) {
      drawings.push({
        id: `${drawingIdPrefix}:stop-price`,
        kind: 'ray',
        startIndex: barIndex,
        startPrice: targetProj.stopLossPrice,
        endIndex: Math.min(bars.length - 1, barIndex + 5),
        endPrice: targetProj.stopLossPrice,
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: 'dashed',
        locked,
      });
      drawings.push({
        id: `${drawingIdPrefix}:stop-price-label`,
        kind: 'text',
        barIndex,
        price: targetProj.stopLossPrice,
        text: `Stop Loss ${targetProj.stopLossPrice}`,
        color: '#ef4444',
        fontSize: 11,
        locked,
      });
    }
    if (
      targetProj.projectionLine &&
      isFinitePrice(targetProj.projectionLine.start.price) &&
      isFinitePrice(targetProj.projectionLine.end.price)
    ) {
      const startIndex = findScannerGeometryPointIndex(bars, targetProj.projectionLine.start);
      const endIndex = findScannerGeometryPointIndex(bars, targetProj.projectionLine.end);
      if (startIndex >= 0 && endIndex >= 0) {
        drawings.push({
          id: `${drawingIdPrefix}:projection-line`,
          kind: 'trendline',
          startIndex,
          startPrice: targetProj.projectionLine.start.price,
          endIndex,
          endPrice: targetProj.projectionLine.end.price,
          color: '#3b82f6',
          lineWidth: 1.5,
          lineStyle: 'dotted',
          locked,
        });
      }
    }
  }

  return drawings;
}

function isDrawingAlertSupported(drawing: ChartDrawing): boolean {
  return drawing.kind === 'hline' || drawing.kind === 'trendline' || drawing.kind === 'ray';
}

function findBarIndexOnOrAfter(bars: OHLCBar[], date: string): number {
  const exactIndex = bars.findIndex((bar) => bar.date === date);
  if (exactIndex >= 0) return exactIndex;
  const nextIndex = bars.findIndex((bar) => bar.date > date);
  if (nextIndex >= 0) return nextIndex;
  return bars.length - 1;
}

function findScannerGeometryPointIndex(
  bars: OHLCBar[],
  point: { date: string; index?: number },
): number {
  const exactIndex = bars.findIndex((bar) => bar.date === point.date);
  if (exactIndex >= 0) {
    return exactIndex;
  }
  return findBarIndexOnOrAfter(bars, point.date);
}

function buildScannerPatternMapMarkerDrawings(
  entries: ScannerPatternMapEntry[],
  instrument: InstrumentKey | null,
  bars: OHLCBar[],
): ChartDrawing[] {
  if (!instrument || bars.length === 0) return [];
  const visibleEntries = entries.filter(
    (entry) => entry.instrument.exchange === instrument.exchange && entry.instrument.symbol === instrument.symbol,
  );
  return clusterScannerPatternMapEntries(visibleEntries).flatMap((cluster) => {
    const barIndex = findBarIndexOnOrAfter(bars, cluster.date);
    if (barIndex < 0) return [];
    const representative = visibleEntries.find((entry) => entry.id === cluster.representativeId);
    const bar = bars[barIndex];
    if (!representative || !bar) return [];
    return [{
      id: cluster.id,
      kind: 'text' as const,
      barIndex,
      price: Math.max(bar.high, bar.close, bar.open),
      text: cluster.count > 1 ? `+${cluster.count}` : '◆',
      color: getScannerOverlayColor(representative.direction),
      fontSize: 12,
      locked: true,
    }];
  });
}

function buildScannerPatternMapGeometryDrawings(
  entries: ScannerPatternMapEntry[],
  instrument: InstrumentKey | null,
  bars: OHLCBar[],
  viewport: Viewport,
): ChartDrawing[] {
  if (!instrument || bars.length === 0) return [];
  const visibleStart = Math.max(0, Math.floor(viewport.startIndex));
  const visibleEnd = Math.min(bars.length - 1, Math.ceil(viewport.endIndex));
  return entries.flatMap((entry) => {
    if (entry.instrument.exchange !== instrument.exchange || entry.instrument.symbol !== instrument.symbol) return [];
    const entryIndex = findBarIndexOnOrAfter(bars, entry.date);
    if (entryIndex < visibleStart || entryIndex > visibleEnd) return [];
    return buildScannerOverlayDrawings(
      {
        id: `scanner-map-visible:${entry.id}`,
        instrument: entry.instrument,
        date: entry.date,
        scannerName: entry.scannerName,
        direction: entry.direction,
        score: entry.score,
        levels: entry.levels,
        geometry: entry.geometry,
        editable: false,
      },
      instrument,
      bars,
    );
  });
}

function isFinitePrice(value: number): boolean {
  return Number.isFinite(value);
}

function getScannerOverlayColor(direction: ScannerChartOverlay['direction']): string {
  if (direction === 'bearish') return '#ff5757';
  if (direction === 'neutral') return '#f0c34e';
  return '#20d18b';
}

export function isScannerOverlayDrawingId(drawingId: string | null | undefined): boolean {
  return Boolean(drawingId?.startsWith('scanner-overlay:') || drawingId?.startsWith('scanner-multi:'));
}

function isScannerPatternMapMarkerDrawingId(drawingId: string | null | undefined): boolean {
  return Boolean(drawingId?.startsWith('scanner-map-marker:'));
}

const chartWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  padding: '3px 3px 2px',
  gap: 3,
  background: 'var(--chart-wrap-bg)',
};

const chartViewportStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--chart-viewport-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--panel-radius)',
  boxShadow: 'var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.04)',
  outline: 'none',
};

const scrollbarWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 22,
  padding: '0 4px',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--panel-radius)',
};

const bottomBarStartStyle: React.CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  display: 'flex',
  alignItems: 'stretch',
};

const scrollbarControlsStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const scrollbarViewportWrapStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const nativeScrollbarStyle: React.CSSProperties = {
  width: '100%',
  height: 10,
  overflowX: 'auto',
  overflowY: 'hidden',
  background: 'transparent',
  outline: 'none',
};

const visibleDateRangeStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 9,
  fontWeight: 600,
  minWidth: 96,
  textAlign: 'right',
  letterSpacing: '0.02em',
};

const chartControlButtonStyle: React.CSSProperties = {
  height: 18,
  minWidth: 22,
  padding: '0 5px',
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 9,
  fontWeight: 600,
};

const dropHintStyle: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: 12,
  padding: '6px 10px',
  border: '1px solid var(--accent)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
};

const inlineTextEditorStyle = (
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): React.CSSProperties => ({
  position: 'absolute',
  left: Math.max(6, Math.min(x + 4, Math.max(6, viewportWidth - 190))),
  top: Math.max(6, Math.min(y - 28, Math.max(6, viewportHeight - 30))),
  zIndex: 20,
  width: 180,
  height: 24,
  padding: '2px 6px',
  border: '1px solid var(--accent)',
  borderRadius: 3,
  outline: 'none',
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: '"Segoe UI", sans-serif',
  boxShadow: 'var(--shadow-lg)',
});

const hoverReadoutCardStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 80,
  minWidth: 236,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--panel-radius)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  backdropFilter: 'blur(10px)',
  zIndex: 8,
};

const chartSettingsAnchorStyle = (
  top: number,
  side: 'left' | 'right' = 'right',
  offset = 8,
  bottom: number | null = null,
): React.CSSProperties => ({
  position: 'absolute',
  top: bottom === null ? top : 'auto',
  bottom: bottom ?? 'auto',
  right: side === 'right' ? offset : 'auto',
  left: side === 'left' ? offset : 'auto',
  zIndex: 12,
});

const axisScaleButtonStyle = (active: boolean, axisWidth: number): React.CSSProperties => ({
  position: 'absolute',
  right: 0,
  bottom: 0,
  zIndex: 12,
  width: axisWidth,
  height: PRICE_AXIS_HEADER_HEIGHT,
  padding: 0,
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 0,
  background: active ? 'var(--accent-soft)' : 'var(--bg3)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  textAlign: 'center',
  lineHeight: '20px',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 18px rgba(0, 0, 0, 0.18)',
});

function isWithinPriceScaleZone(
  localX: number,
  localY: number,
  width: number,
  priceHeight: number,
  axisWidth: number,
  leftAxisWidth = 0,
): boolean {
  if (localY < 0 || localY > priceHeight) {
    return false;
  }

  return localX >= width - axisWidth || (leftAxisWidth > 0 && localX <= leftAxisWidth);
}

function clampAxisSettingsTop(localY: number, priceHeight: number): number {
  const buttonHalfHeight = 11;
  const minTop = 10;
  const maxTop = Math.max(minTop, priceHeight - 32);
  return Math.max(minTop, Math.min(maxTop, localY - buttonHalfHeight));
}

function formatVisibleDate(rawDate: string): string {
  const date = parseISO(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return format(date, 'dd MMM yy');
}

function getDrawingToolLabel(tool: DrawingTool): string {
  switch (tool) {
    case 'cursor':
      return 'Cursor';
    case 'crosshair':
      return 'Crosshair';
    case 'hline':
      return 'Horizontal Line';
    case 'vline':
      return 'Vertical Line';
    case 'trendline':
      return 'Trend Line';
    case 'extendedLine':
      return 'Extended Line';
    case 'horizontalRay':
      return 'Horizontal Ray';
    case 'crossLine':
      return 'Cross Line';
    case 'infoLine':
      return 'Info Line';
    case 'trendAngle':
      return 'Trend Angle';
    case 'priceRange':
      return 'Price Range';
    case 'dateRange':
      return 'Date Range';
    case 'regressionTrend':
      return 'Regression Trend';
    case 'fibTimeZone':
      return 'Fib Time Zone';
    case 'fibCircles':
      return 'Fib Circles';
    case 'fibArcs':
      return 'Fib Speed Resistance Arcs';
    case 'gannBox':
      return 'Gann Box';
    case 'circle':
      return 'Circle';
    case 'ellipse':
      return 'Ellipse';
    case 'forecast':
      return 'Forecast';
    case 'arrowMarker':
      return 'Arrow Marker';
    case 'arrowUp':
      return 'Arrow Up';
    case 'arrowDown':
      return 'Arrow Down';
    case 'flatChannel':
      return 'Flat Top / Bottom';
    case 'disjointChannel':
      return 'Disjoint Channel';
    case 'triangle':
      return 'Triangle';
    case 'rotatedRect':
      return 'Rotated Rectangle';
    case 'arc':
      return 'Arc';
    case 'andrewsPitchfork':
      return "Andrews' Pitchfork";
    case 'schiffPitchfork':
      return 'Schiff Pitchfork';
    case 'modifiedSchiffPitchfork':
      return 'Modified Schiff Pitchfork';
    case 'insidePitchfork':
      return 'Inside Pitchfork';
    case 'trendFibExtension':
      return 'Trend-Based Fib Extension';
    case 'fibChannel':
      return 'Fibonacci Channel';
    case 'fibTimeExtension':
      return 'Trend-Based Fib Time';
    case 'fibWedge':
      return 'Fib Wedge';
    case 'pitchfan':
      return 'Pitchfan';
    case 'longPosition':
      return 'Long Position';
    case 'shortPosition':
      return 'Short Position';
    case 'projection':
      return 'Projection';
    case 'ray':
      return 'Ray';
    case 'arrow':
      return 'Arrow';
    case 'rect':
      return 'Rectangle';
    case 'text':
      return 'Text';
    case 'channel':
      return 'Parallel Channel';
    case 'fib':
      return 'Fib Retracement';
    case 'fibExtension':
      return 'Fib Projection (Legacy)';
    case 'fibFan':
      return 'Fib Fan';
    case 'gann':
      return 'Gann Fan';
    default:
      return 'Tool';
  }
}

function getDrawingLabel(drawing: ChartDrawing): string {
  return getDrawingToolLabel(drawing.kind);
}

function isChartExternalOrDialogEvent(
  eventTarget: EventTarget | null,
  viewportElement: HTMLDivElement,
): boolean {
  if (typeof Node === 'undefined' || !(eventTarget instanceof Node)) {
    return false;
  }
  if (!viewportElement.contains(eventTarget)) {
    return true;
  }
  const element =
    typeof Element !== 'undefined' && eventTarget instanceof Element
      ? eventTarget
      : eventTarget.parentElement;
  return Boolean(element?.closest('[role="dialog"]'));
}

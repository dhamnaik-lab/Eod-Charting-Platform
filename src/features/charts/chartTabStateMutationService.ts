import {
  createDefaultViewport,
  fitViewportToBarCount,
  remapViewportAcrossTimeframe,
} from '@/features/charts/chartDataUtils';
import {
  addPaneIndicator,
  ensureIndicatorPaneHeights,
  getPaneIndicatorIds,
  movePaneIndicator,
  normalizeIndicatorPaneHeight,
  pruneCollapsedIndicatorPanes,
  prunePaneScaleOverrides,
} from '@/features/charts/chartIndicatorPaneService';
import { normalizeFutureMarginMode } from '@/features/charts/chartSheetWorkspaceService';
import { applyCompareOverlaysTimeframe } from '@/features/charts/compareOverlayService';
import { remapDrawingsAcrossTimeframe } from '@/features/charts/drawingTimeframeAnchorService';
import { setScopedDrawings } from '@/features/charts/drawingScopeService';
import {
  buildChartDisplayBars,
  DEFAULT_RENKO_SETTINGS,
  normalizeRenkoBrickSize,
  normalizeRenkoSettings,
  RENKO_BRICK_LIMIT_MESSAGE,
} from '@/features/charts/chartTypeTransformService';
import { clampViewport, zoomViewport } from '@/engine/ScaleManager';
import {
  createIndicatorFromCatalogId,
  createIndicatorFromKind,
  type IndicatorCatalogId,
} from '@/indicators/catalog';
import {
  createCustomFormulaIndicator,
  type CustomFormulaIndicatorInput,
} from '@/modules/formulaEngine/customFormulaEngine';
import {
  hasAnyChartValueLabels,
  normalizeChartValueLabelSettings,
  setAllChartValueLabelVisibility,
} from '@/engine/valueLabelSettings';
import { normalizeChartVisualSettings } from '@/engine/types';
import type {
  ChartValueLabelSettings,
  ChartVisualSettings,
  ChartDrawing,
  ChartIndicator,
  ChartPaneId,
  IndicatorPaneHeights,
  OHLCBar,
  OverlayIndicator,
  PaneScaleOverrides,
  PaneScaleRange,
  RenkoSettings,
  Viewport,
} from '@/engine/types';
import type { ChartTabState } from '@/store/chartStoreTypes';

function withVisibleBarCount(tab: ChartTabState, viewport: Viewport): ChartTabState {
  return {
    ...tab,
    viewport,
    visibleBarCount: Math.max(0, Math.round(viewport.endIndex - viewport.startIndex)),
  };
}

function applyIndicatorState(
  tab: ChartTabState,
  indicators: OverlayIndicator[],
  paneScaleOverrides: PaneScaleOverrides = prunePaneScaleOverrides(
    indicators,
    tab.paneScaleOverrides,
  ),
): ChartTabState {
  return {
    ...tab,
    indicators,
    indicatorPaneHeights: ensureIndicatorPaneHeights(
      indicators,
      tab.indicatorPaneHeights,
      tab.indicatorPaneHeight,
    ),
    collapsedIndicatorPanes: pruneCollapsedIndicatorPanes(
      indicators,
      tab.collapsedIndicatorPanes,
    ),
    paneScaleOverrides,
  };
}

function isRenkoBrickLimitError(error: unknown): boolean {
  return error instanceof RangeError && error.message === RENKO_BRICK_LIMIT_MESSAGE;
}

export function applyTimeframeToTab(
  tab: ChartTabState,
  timeframe: ChartTabState['timeframe'],
): ChartTabState {
  const displayBars = buildChartDisplayBars(
    tab.rawBars,
    timeframe,
    tab.chartType,
    tab.renkoBrickSize,
    tab.renkoSettings,
  );
  const compareOverlays = applyCompareOverlaysTimeframe(
    tab.compareOverlays,
    timeframe,
    tab.chartType,
    tab.renkoBrickSize,
    tab.renkoSettings,
  );
  const viewport = createDefaultViewport(displayBars.length, tab.futureMarginMode);
  const drawings = remapDrawingsAcrossTimeframe(tab.drawings, tab.displayBars, displayBars);
  return {
    ...tab,
    timeframe,
    displayBars,
    compareOverlays,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    viewport,
    visibleBarCount: Math.max(0, Math.round(viewport.endIndex - viewport.startIndex)),
    hoverBar: null,
  };
}

export function setTabChartType(
  tab: ChartTabState,
  chartType: ChartTabState['chartType'],
  options: { fallbackToDefaultRenko?: boolean } = {},
): ChartTabState {
  let renkoBrickSize = tab.renkoBrickSize;
  let renkoSettings = tab.renkoSettings;
  let displayBars;
  let compareOverlays;

  try {
    displayBars = buildChartDisplayBars(
      tab.rawBars,
      tab.timeframe,
      chartType,
      renkoBrickSize,
      renkoSettings,
    );
    compareOverlays = applyCompareOverlaysTimeframe(
      tab.compareOverlays,
      tab.timeframe,
      chartType,
      renkoBrickSize,
      renkoSettings,
    );
  } catch (error) {
    if (
      chartType !== 'renko' ||
      tab.chartType === 'renko' ||
      !isRenkoBrickLimitError(error) ||
      options.fallbackToDefaultRenko === false
    ) {
      throw error;
    }

    renkoSettings = DEFAULT_RENKO_SETTINGS;
    renkoBrickSize = normalizeRenkoBrickSize(renkoSettings.boxSize);
    displayBars = buildChartDisplayBars(
      tab.rawBars,
      tab.timeframe,
      chartType,
      renkoBrickSize,
      renkoSettings,
    );
    compareOverlays = applyCompareOverlaysTimeframe(
      tab.compareOverlays,
      tab.timeframe,
      chartType,
      renkoBrickSize,
      renkoSettings,
    );
  }
  const viewport =
    chartType === 'renko' || tab.chartType === 'renko'
      ? remapViewportAcrossTimeframe(
          tab.viewport,
          tab.displayBars,
          displayBars,
          tab.futureMarginMode,
        )
      : clampViewport(
          tab.viewport,
          displayBars.length,
          5,
          tab.futureMarginMode,
        );

  return {
    ...tab,
    chartType,
    renkoBrickSize,
    renkoSettings,
    displayBars,
    compareOverlays,
    viewport,
    visibleBarCount: Math.max(0, Math.round(viewport.endIndex - viewport.startIndex)),
    hoverBar: null,
  };
}

export function setTabRenkoBrickSize(
  tab: ChartTabState,
  size: number,
): ChartTabState {
  const renkoBrickSize = normalizeRenkoBrickSize(size);
  return setTabRenkoSettings(tab, {
    boxSizeMode: 'traditional',
    boxSize: renkoBrickSize,
  });
}

export function setTabRenkoSettings(
  tab: ChartTabState,
  patch: Partial<RenkoSettings>,
): ChartTabState {
  const renkoSettings = normalizeRenkoSettings({
    ...tab.renkoSettings,
    ...patch,
  }, tab.renkoBrickSize);
  const renkoBrickSize = normalizeRenkoBrickSize(renkoSettings.boxSize);
  const displayBars = buildChartDisplayBars(
    tab.rawBars,
    tab.timeframe,
    tab.chartType,
    renkoBrickSize,
    renkoSettings,
  );
  const compareOverlays = applyCompareOverlaysTimeframe(
    tab.compareOverlays,
    tab.timeframe,
    tab.chartType,
    renkoBrickSize,
    renkoSettings,
  );
  const viewport = remapViewportAcrossTimeframe(
    tab.viewport,
    tab.displayBars,
    displayBars,
    tab.futureMarginMode,
  );

  return {
    ...tab,
    renkoBrickSize,
    renkoSettings,
    displayBars,
    compareOverlays,
    viewport,
    visibleBarCount: Math.max(0, Math.round(viewport.endIndex - viewport.startIndex)),
    hoverBar: null,
  };
}

export function setTabVisualSettings(
  tab: ChartTabState,
  settings: Partial<ChartVisualSettings>,
): ChartTabState {
  return {
    ...tab,
    visualSettings: normalizeChartVisualSettings({
      ...tab.visualSettings,
      ...settings,
    }),
  };
}

export function syncTabViewport(tab: ChartTabState, viewport: Viewport): ChartTabState {
  return withVisibleBarCount(tab, viewport);
}

export function scrollTabViewportToStart(
  tab: ChartTabState,
  startIndex: number,
): ChartTabState {
  const span = Math.max(tab.viewport.endIndex - tab.viewport.startIndex, 1);
  const nextViewport = clampViewport(
    {
      startIndex,
      endIndex: startIndex + span,
    },
    tab.displayBars.length,
    5,
    tab.futureMarginMode,
  );
  return withVisibleBarCount(tab, nextViewport);
}

export function nudgeTabViewport(
  tab: ChartTabState,
  deltaBars: number,
): ChartTabState {
  const span = Math.max(tab.viewport.endIndex - tab.viewport.startIndex, 1);
  const nextViewport = clampViewport(
    {
      startIndex: tab.viewport.startIndex + deltaBars,
      endIndex: tab.viewport.startIndex + deltaBars + span,
    },
    tab.displayBars.length,
    5,
    tab.futureMarginMode,
  );
  return withVisibleBarCount(tab, nextViewport);
}

export function zoomTabViewportByFactor(
  tab: ChartTabState,
  factor: number,
  pivotIndex?: number,
): ChartTabState {
  const maxPivotIndex = Math.max(tab.displayBars.length - 1, 0);
  const nextPivotIndex =
    typeof pivotIndex === 'number' && Number.isFinite(pivotIndex)
      ? Math.max(0, Math.min(pivotIndex, maxPivotIndex))
      : (tab.viewport.startIndex + tab.viewport.endIndex) / 2;
  const nextViewport = zoomViewport(
    tab.viewport,
    nextPivotIndex,
    factor,
    tab.displayBars.length,
    tab.futureMarginMode,
  );
  return withVisibleBarCount(tab, nextViewport);
}

export function resetTabViewport(tab: ChartTabState): ChartTabState {
  const nextViewport = createDefaultViewport(
    tab.displayBars.length,
    tab.futureMarginMode,
  );
  return withVisibleBarCount(tab, nextViewport);
}

export function setTabIndicatorPaneHeight(
  tab: ChartTabState,
  height: number,
  paneId?: string | null,
): ChartTabState {
  const nextHeight = normalizeIndicatorPaneHeight(height);
  if (paneId) {
    return {
      ...tab,
      indicatorPaneHeights: {
        ...ensureIndicatorPaneHeights(
          tab.indicators,
          tab.indicatorPaneHeights,
          tab.indicatorPaneHeight,
        ),
        [paneId]: nextHeight,
      },
    };
  }

  const nextIndicatorPaneHeights = Object.fromEntries(
    getPaneIndicatorIds(tab.indicators).map((id) => [id, nextHeight]),
  ) as IndicatorPaneHeights;
  return {
    ...tab,
    indicatorPaneHeight: nextHeight,
    indicatorPaneHeights: nextIndicatorPaneHeights,
  };
}

export function resetTabIndicatorPaneHeights(tab: ChartTabState): ChartTabState {
  return {
    ...tab,
    indicatorPaneHeights: Object.fromEntries(
      getPaneIndicatorIds(tab.indicators).map((id) => [id, tab.indicatorPaneHeight]),
    ) as IndicatorPaneHeights,
  };
}

export function setTabIndicatorPaneCollapsed(
  tab: ChartTabState,
  paneId: string,
  collapsed?: boolean,
): ChartTabState {
  const paneIds = getPaneIndicatorIds(tab.indicators);
  if (!paneIds.includes(paneId)) {
    return tab;
  }

  const nextCollapsedIndicatorPanes = {
    ...pruneCollapsedIndicatorPanes(tab.indicators, tab.collapsedIndicatorPanes),
  };
  const shouldCollapse = collapsed ?? !nextCollapsedIndicatorPanes[paneId];
  if (shouldCollapse) {
    nextCollapsedIndicatorPanes[paneId] = true;
  } else {
    delete nextCollapsedIndicatorPanes[paneId];
  }

  return {
    ...tab,
    collapsedIndicatorPanes: nextCollapsedIndicatorPanes,
  };
}

export function setTabPaneScaleOverride(
  tab: ChartTabState,
  paneId: ChartPaneId,
  range: PaneScaleRange | null,
): ChartTabState {
  const nextPaneScaleOverrides = {
    ...prunePaneScaleOverrides(tab.indicators, tab.paneScaleOverrides),
  };
  if (!range) {
    delete nextPaneScaleOverrides[paneId];
  } else {
    nextPaneScaleOverrides[paneId] = range;
  }
  return {
    ...tab,
    paneScaleOverrides: nextPaneScaleOverrides,
  };
}

export function fitAllTabPanes(tab: ChartTabState): ChartTabState {
  return {
    ...tab,
    paneScaleOverrides: {},
  };
}

export function setTabLogScale(
  tab: ChartTabState,
  enabled: boolean,
): ChartTabState {
  return {
    ...tab,
    logScale: enabled,
  };
}

export function setTabShowVolume(
  tab: ChartTabState,
  show: boolean,
): ChartTabState {
  return {
    ...tab,
    showVolume: show,
  };
}

export function setTabInvertPriceScale(
  tab: ChartTabState,
  enabled: boolean,
): ChartTabState {
  return {
    ...tab,
    invertPriceScale: enabled,
  };
}

export function setTabShowValueLabels(
  tab: ChartTabState,
  show: boolean,
): ChartTabState {
  return {
    ...tab,
    showValueLabels: show,
    valueLabelSettings: setAllChartValueLabelVisibility(show, tab.valueLabelSettings),
  };
}

export function setTabValueLabelSettings(
  tab: ChartTabState,
  settings: Partial<ChartValueLabelSettings>,
): ChartTabState {
  const valueLabelSettings = normalizeChartValueLabelSettings({
    ...tab.valueLabelSettings,
    ...settings,
  });

  return {
    ...tab,
    showValueLabels: hasAnyChartValueLabels(valueLabelSettings),
    valueLabelSettings,
  };
}

export function setTabShowLeftAxis(
  tab: ChartTabState,
  show: boolean,
): ChartTabState {
  return {
    ...tab,
    showLeftAxis: show,
  };
}

export function setTabFutureMarginMode(
  tab: ChartTabState,
  mode: ChartTabState['futureMarginMode'],
): ChartTabState {
  const nextMode = normalizeFutureMarginMode(mode);
  if (tab.futureMarginMode === nextMode) {
    return tab;
  }

  const nextViewport =
    tab.displayBars.length > 0
      ? clampViewport(tab.viewport, tab.displayBars.length, 5, nextMode)
      : tab.viewport;
  return {
    ...tab,
    futureMarginMode: nextMode,
    viewport: nextViewport,
    visibleBarCount: Math.max(0, Math.round(nextViewport.endIndex - nextViewport.startIndex)),
  };
}

export function setTabHoverBar(
  tab: ChartTabState,
  bar: OHLCBar | null,
): ChartTabState {
  if (tab.hoverBar === bar) {
    return tab;
  }
  if (tab.hoverBar && bar && tab.hoverBar.date === bar.date && tab.hoverBar.close === bar.close) {
    return tab;
  }
  return {
    ...tab,
    hoverBar: bar,
  };
}

export function setTabVisibleBarCount(
  tab: ChartTabState,
  count: number,
): ChartTabState {
  return {
    ...tab,
    visibleBarCount: Math.max(0, Math.round(count)),
  };
}

export function addTabIndicator(
  tab: ChartTabState,
  kind: ChartIndicator['kind'],
): ChartTabState {
  const nextIndicators = addPaneIndicator(
    tab.indicators,
    createIndicatorFromKind(kind),
  );
  return applyIndicatorState(tab, nextIndicators);
}

export function addTabIndicatorCatalog(
  tab: ChartTabState,
  catalogId: IndicatorCatalogId,
): ChartTabState {
  const nextIndicators = addPaneIndicator(
    tab.indicators,
    createIndicatorFromCatalogId(catalogId),
  );
  return applyIndicatorState(tab, nextIndicators);
}

export function addTabCustomFormulaIndicator(
  tab: ChartTabState,
  draft: CustomFormulaIndicatorInput,
): ChartTabState {
  const nextIndicators = addPaneIndicator(
    tab.indicators,
    createCustomFormulaIndicator(draft),
  );
  return applyIndicatorState(tab, nextIndicators);
}

export function updateTabIndicator(
  tab: ChartTabState,
  indicator: OverlayIndicator,
): ChartTabState {
  const nextIndicators = tab.indicators.map((item) =>
    item.id === indicator.id ? indicator : item,
  );
  return applyIndicatorState(tab, nextIndicators);
}

export function removeTabIndicator(
  tab: ChartTabState,
  indicatorId: string,
): ChartTabState {
  const nextIndicators = tab.indicators.filter(
    (indicator) => indicator.id !== indicatorId,
  );
  const nextPaneScaleOverrides = {
    ...prunePaneScaleOverrides(nextIndicators, tab.paneScaleOverrides),
  };
  delete nextPaneScaleOverrides[indicatorId];
  return applyIndicatorState(tab, nextIndicators, nextPaneScaleOverrides);
}

export function clearTabIndicators(tab: ChartTabState): ChartTabState {
  return {
    ...tab,
    indicators: [],
    indicatorPaneHeights: {},
    collapsedIndicatorPanes: {},
    paneScaleOverrides: tab.paneScaleOverrides.price
      ? ({ price: tab.paneScaleOverrides.price } as PaneScaleOverrides)
      : {},
  };
}

export function moveTabIndicatorPane(
  tab: ChartTabState,
  indicatorId: string,
  direction: 'up' | 'down',
): ChartTabState {
  const nextIndicators = movePaneIndicator(tab.indicators, indicatorId, direction);
  if (nextIndicators === tab.indicators) {
    return tab;
  }
  return applyIndicatorState(tab, nextIndicators);
}

export function selectTabDrawing(
  tab: ChartTabState,
  drawingId: string | null,
): ChartTabState {
  return {
    ...tab,
    selectedDrawingId: drawingId,
  };
}

export function addTabDrawing(
  tab: ChartTabState,
  drawing: ChartDrawing,
): ChartTabState {
  const drawings = [...tab.drawings, drawing];
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: drawing.id,
  };
}

export function updateTabDrawing(
  tab: ChartTabState,
  drawing: ChartDrawing,
): ChartTabState {
  const drawings = tab.drawings.map((item) => (item.id === drawing.id ? drawing : item));
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: drawing.id,
  };
}

export function toggleTabDrawingLock(
  tab: ChartTabState,
  drawingId?: string | null,
): ChartTabState {
  const targetId = drawingId ?? tab.selectedDrawingId;
  if (!targetId) {
    return tab;
  }

  const drawings = tab.drawings.map((drawing) =>
    drawing.id === targetId
      ? {
          ...drawing,
          locked: !drawing.locked,
        }
      : drawing,
  );
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: targetId,
  };
}

export function deleteSelectedTabDrawing(tab: ChartTabState): ChartTabState {
  if (!tab.selectedDrawingId) {
    return tab;
  }

  const selected = tab.drawings.find((drawing) => drawing.id === tab.selectedDrawingId);
  if (!selected || selected.locked) {
    return tab;
  }

  const drawings = tab.drawings.filter(
    (drawing) => drawing.id !== tab.selectedDrawingId,
  );
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: drawings[drawings.length - 1]?.id ?? null,
  };
}

export function clearTabDrawings(tab: ChartTabState): ChartTabState {
  const drawings = tab.drawings.filter((drawing) => drawing.locked);
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: drawings.some((drawing) => drawing.id === tab.selectedDrawingId)
      ? tab.selectedDrawingId
      : drawings[drawings.length - 1]?.id ?? null,
  };
}

export function removeLastTabDrawing(tab: ChartTabState): ChartTabState {
  let removableIndex = -1;
  for (let index = tab.drawings.length - 1; index >= 0; index -= 1) {
    if (!tab.drawings[index]?.locked) {
      removableIndex = index;
      break;
    }
  }
  if (removableIndex < 0) {
    return tab;
  }

  const drawings = tab.drawings.filter((_, index) => index !== removableIndex);
  return {
    ...tab,
    drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes, tab.instrument, drawings),
    selectedDrawingId: drawings[drawings.length - 1]?.id ?? null,
  };
}

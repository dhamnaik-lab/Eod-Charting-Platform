import { DEFAULT_INDICATOR_PANE_HEIGHT } from '@/features/charts/chartIndicatorPaneService';
import type { ChartTabState } from '@/store/chartStoreTypes';
import {
  DEFAULT_RENKO_BRICK_SIZE,
  DEFAULT_RENKO_SETTINGS,
} from '@/features/charts/chartTypeTransformService';
import { DEFAULT_CHART_VALUE_LABEL_SETTINGS } from '@/engine/valueLabelSettings';
import { DEFAULT_CHART_VISUAL_SETTINGS } from '@/engine/types';

export interface ChartWorkspaceState {
  chartTabs: ChartTabState[];
  activeChartTabId: string;
}

export function createBlankChartTab(index: number): ChartTabState {
  return {
    id: crypto.randomUUID(),
    title: `Chart ${index}`,
    instrument: null,
    instrumentMeta: null,
    requestedInstrument: null,
    rawBars: [],
    displayBars: [],
    events: [],
    compareOverlays: [],
    timeframe: 'D',
    chartType: 'candles',
    renkoBrickSize: DEFAULT_RENKO_BRICK_SIZE,
    renkoSettings: DEFAULT_RENKO_SETTINGS,
    visualSettings: DEFAULT_CHART_VISUAL_SETTINGS,
    viewport: { startIndex: 0, endIndex: 0 },
    hoverBar: null,
    visibleBarCount: 0,
    indicators: [],
    drawings: [],
    drawingScopes: {},
    selectedDrawingId: null,
    indicatorPaneHeight: DEFAULT_INDICATOR_PANE_HEIGHT,
    indicatorPaneHeights: {},
    collapsedIndicatorPanes: {},
    paneScaleOverrides: {},
    logScale: false,
    showVolume: true,
    invertPriceScale: false,
    showValueLabels: true,
    valueLabelSettings: DEFAULT_CHART_VALUE_LABEL_SETTINGS,
    showLeftAxis: false,
    futureMarginMode: 'normal',
    loadedAdjusted: null,
    loadedDividendAdjusted: null,
    loadedRightsAdjusted: null,
    sheets: [],
    activeSheetId: null,
    layoutMode: 'single',
  };
}

export function createChartWorkspace(): ChartWorkspaceState {
  const firstTab = createBlankChartTab(1);
  return {
    chartTabs: [firstTab],
    activeChartTabId: firstTab.id,
  };
}

export function createChartTabWorkspaceState(chartTabs: ChartTabState[]): ChartWorkspaceState {
  const nextTab = createBlankChartTab(chartTabs.length + 1);
  return {
    chartTabs: [...chartTabs, nextTab],
    activeChartTabId: nextTab.id,
  };
}

export function duplicateChartTabWorkspaceState(
  chartTabs: ChartTabState[],
  tabId: string,
): ChartWorkspaceState | null {
  const sourceIndex = chartTabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex < 0) {
    return null;
  }

  const sourceTab = chartTabs[sourceIndex];
  const duplicateTab: ChartTabState = {
    ...structuredClone(sourceTab),
    id: crypto.randomUUID(),
    title: sourceTab.title,
  };

  const nextTabs = [...chartTabs];
  nextTabs.splice(sourceIndex + 1, 0, duplicateTab);

  return {
    chartTabs: nextTabs,
    activeChartTabId: duplicateTab.id,
  };
}

export function buildActivateChartTabState(
  state: ChartWorkspaceState,
  tabId: string,
): Pick<ChartWorkspaceState, 'activeChartTabId'> | null {
  if (!state.chartTabs.some((tab) => tab.id === tabId)) {
    return null;
  }

  return { activeChartTabId: tabId };
}

export function buildCloseChartTabState(
  state: ChartWorkspaceState,
  tabId: string,
): ChartWorkspaceState {
  if (state.chartTabs.length === 1) {
    return createChartWorkspace();
  }

  const index = state.chartTabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return state;
  }

  const nextTabs = state.chartTabs.filter((tab) => tab.id !== tabId);
  const nextActiveTabId =
    state.activeChartTabId === tabId
      ? nextTabs[Math.max(index - 1, 0)]?.id ?? nextTabs[0].id
      : state.activeChartTabId;

  return {
    chartTabs: nextTabs,
    activeChartTabId: nextActiveTabId,
  };
}

export function shouldHydrateChartTab(
  tab: ChartTabState | null | undefined,
  adjustedMode: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
): boolean {
  if (!tab || !(tab.requestedInstrument ?? tab.instrument)) {
    return false;
  }

  return (
    tab.rawBars.length === 0 ||
    tab.loadedAdjusted !== adjustedMode ||
    (adjustedMode &&
      (
        tab.loadedDividendAdjusted !== includeDividendAdjustments ||
        tab.loadedRightsAdjusted !== includeRightsAdjustments
      )) ||
    tab.compareOverlays.some((overlay) => overlay.rawBars.length === 0)
  );
}

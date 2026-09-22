import { createDefaultViewport } from '@/features/charts/chartDataUtils';
import { createChartCompareOverlay } from '@/features/charts/compareOverlayService';
import { DEFAULT_INDICATOR_PANE_HEIGHT } from '@/features/charts/chartIndicatorPaneService';
import {
  DEFAULT_RENKO_BRICK_SIZE,
  DEFAULT_RENKO_SETTINGS,
  normalizeChartType,
  normalizeRenkoBrickSize,
  normalizeRenkoSettings,
} from '@/features/charts/chartTypeTransformService';
import { createBlankChartTab, createChartWorkspace, type ChartWorkspaceState } from '@/features/charts/chartTabWorkspaceService';
import {
  DEFAULT_CHART_VISUAL_SETTINGS,
  normalizeChartVisualSettings,
  type FutureMarginMode,
} from '@/engine/types';
import {
  buildWorkspaceFromPersisted,
  getPrimarySheetContent,
  serializeWorkspaceState,
  type PersistedChartContent,
  type PersistedChartWorkspace,
  type PersistedSheetWorkspace,
} from '@/features/workspace/workspacePersistence';
import type { ChartTabState, LayoutMode, Sheet } from '@/store/chartStoreTypes';
import {
  DEFAULT_CHART_VALUE_LABEL_SETTINGS,
  normalizeChartValueLabelSettings,
} from '@/engine/valueLabelSettings';
import { getScopedDrawings } from '@/features/charts/drawingScopeService';

export interface ChartTabStateFromPersistedOptions {
  id?: string;
  sheets?: Sheet[];
  activeSheetId?: string | null;
  layoutMode?: LayoutMode;
}

export interface LoadSheetStateResult extends ChartWorkspaceState {
  shouldHydrate: boolean;
}

function getLegacyRenkoBrickSizeForSettings(chartType: PersistedChartContent['chartType'], value: unknown): unknown {
  return normalizeChartType(chartType) === 'renko' ? value : undefined;
}

export function normalizeFutureMarginMode(mode: unknown): FutureMarginMode {
  return mode === 'tight' || mode === 'wide' ? mode : 'normal';
}

export function serializePersistedSheetWorkspace(tab: ChartTabState): PersistedSheetWorkspace {
  const serialized = serializeWorkspaceState({
    chartTabs: [tab],
    activeChartTabId: tab.id,
  });

  return {
    version: 1,
    activeChartTabId: tab.id,
    chartTabs: [serialized.chartTabs[0]],
    layoutMode: tab.layoutMode,
  };
}

export function createPlainCandleSheetContent(tab: ChartTabState): PersistedChartContent {
  return {
    id: tab.id,
    title: tab.title,
    instrument: tab.instrument,
    compareOverlays: [],
    timeframe: tab.timeframe,
    chartType: 'candles',
    renkoBrickSize: DEFAULT_RENKO_BRICK_SIZE,
    renkoSettings: DEFAULT_RENKO_SETTINGS,
    visualSettings: DEFAULT_CHART_VISUAL_SETTINGS,
    viewport: { ...tab.viewport },
    indicators: [],
    drawings: [],
    drawingScopes: {},
    indicatorPaneHeight: DEFAULT_INDICATOR_PANE_HEIGHT,
    indicatorPaneHeights: {},
    collapsedIndicatorPanes: {},
    paneScaleOverrides: {},
    logScale: false,
    showVolume: true,
    invertPriceScale: false,
    showValueLabels: true,
    valueLabelSettings: DEFAULT_CHART_VALUE_LABEL_SETTINGS,
    showLeftAxis: tab.showLeftAxis ?? false,
    futureMarginMode: tab.futureMarginMode,
  };
}

export function createPlainCandleSheetWorkspace(tab: ChartTabState): PersistedSheetWorkspace {
  const content = createPlainCandleSheetContent(tab);
  return {
    version: 1,
    activeChartTabId: content.id,
    chartTabs: [content],
    layoutMode: 'single',
  };
}

export function applyPlainCandleSheetToTab(tab: ChartTabState, sheet: Sheet): ChartTabState {
  return {
    ...tab,
    compareOverlays: [],
    chartType: 'candles',
    renkoBrickSize: DEFAULT_RENKO_BRICK_SIZE,
    renkoSettings: DEFAULT_RENKO_SETTINGS,
    visualSettings: DEFAULT_CHART_VISUAL_SETTINGS,
    hoverBar: null,
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
    sheets: [...tab.sheets, sheet],
    activeSheetId: sheet.id,
    layoutMode: 'single',
  };
}

export function createChartTabStateFromPersistedContent(
  persistedTab: PersistedChartContent,
  index: number,
  options?: ChartTabStateFromPersistedOptions,
): ChartTabState {
  const chartType = normalizeChartType(persistedTab.chartType);
  const legacyRenkoBrickSize = getLegacyRenkoBrickSizeForSettings(chartType, persistedTab.renkoBrickSize);

  return {
    ...createBlankChartTab(index + 1),
    id: options?.id ?? persistedTab.id,
    title: persistedTab.instrument
      ? `${persistedTab.instrument.exchange}:${persistedTab.instrument.symbol}`
      : persistedTab.title,
    instrument: persistedTab.instrument,
    requestedInstrument: persistedTab.instrument,
    compareOverlays: (persistedTab.compareOverlays ?? []).map((overlay) =>
      createChartCompareOverlay(
        overlay,
        persistedTab.timeframe,
        chartType,
        normalizeRenkoBrickSize(persistedTab.renkoBrickSize),
        normalizeRenkoSettings(persistedTab.renkoSettings, legacyRenkoBrickSize),
      ),
    ),
    timeframe: persistedTab.timeframe,
    chartType,
    renkoBrickSize: normalizeRenkoBrickSize(persistedTab.renkoBrickSize),
    renkoSettings: normalizeRenkoSettings(persistedTab.renkoSettings, legacyRenkoBrickSize),
    visualSettings: normalizeChartVisualSettings(persistedTab.visualSettings),
    viewport: persistedTab.viewport,
    visibleBarCount: Math.max(0, Math.round(persistedTab.viewport.endIndex - persistedTab.viewport.startIndex)),
    indicators: persistedTab.indicators,
    drawings: persistedTab.drawings,
    drawingScopes: persistedTab.drawingScopes ?? {},
    indicatorPaneHeight: persistedTab.indicatorPaneHeight,
    indicatorPaneHeights: persistedTab.indicatorPaneHeights ?? {},
    collapsedIndicatorPanes: persistedTab.collapsedIndicatorPanes ?? {},
    paneScaleOverrides: persistedTab.paneScaleOverrides ?? {},
    logScale: persistedTab.logScale ?? false,
    showVolume: persistedTab.showVolume !== false,
    invertPriceScale: persistedTab.invertPriceScale === true,
    showValueLabels: persistedTab.showValueLabels !== false,
    valueLabelSettings: normalizeChartValueLabelSettings(
      persistedTab.valueLabelSettings,
      persistedTab.showValueLabels !== false,
    ),
    showLeftAxis: persistedTab.showLeftAxis === true,
    futureMarginMode: normalizeFutureMarginMode(persistedTab.futureMarginMode),
    sheets: options?.sheets ?? [],
    activeSheetId: options?.activeSheetId ?? null,
    layoutMode: options?.layoutMode ?? 'single',
  };
}

export function restoreWorkspaceState(
  persisted: PersistedChartWorkspace | null,
): ChartWorkspaceState {
  return (
    buildWorkspaceFromPersisted<ChartTabState>(
      persisted,
      (persistedTab, index) =>
        createChartTabStateFromPersistedContent(persistedTab, index, {
          sheets: persistedTab.sheets,
          activeSheetId: persistedTab.activeSheetId,
          layoutMode: persistedTab.layoutMode,
        }),
    ) ?? createChartWorkspace()
  );
}

export function buildSaveCurrentAsSheetState(
  chartTabs: ChartTabState[],
  tabId: string,
  name: string,
): ChartWorkspaceState | null {
  const tabIndex = chartTabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) {
    return null;
  }

  const targetTab = chartTabs[tabIndex];
  // Commit the active sheet before creating/switching to a new sheet. Without this,
  // drawings and settings changed since the last sheet switch are lost from the old sheet.
  const committedSheets = targetTab.sheets.map((existingSheet) =>
    existingSheet.id === targetTab.activeSheetId
      ? { ...existingSheet, workspace: serializePersistedSheetWorkspace(targetTab) }
      : existingSheet,
  );
  const committedTab = { ...targetTab, sheets: committedSheets };
  const workspace = createPlainCandleSheetWorkspace(committedTab);
  const sheet: Sheet = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    workspace,
  };

  return {
    chartTabs: chartTabs.map((tab, index) =>
      index === tabIndex ? applyPlainCandleSheetToTab(committedTab, sheet) : tab,
    ),
    activeChartTabId: tabId,
  };
}

export function buildLoadSheetState(
  chartTabs: ChartTabState[],
  tabId: string,
  sheetId: string,
): LoadSheetStateResult | null {
  const tabIndex = chartTabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) {
    return null;
  }

  const targetTab = chartTabs[tabIndex];

  // COMMIT CURRENT STATE TO CURRENT ACTIVE SHEET BEFORE SWITCHING
  // This ensures indicators/drawings/layout changes are not lost when switching away.
  const updatedSheets = targetTab.sheets.map((s) => {
    if (s.id === targetTab.activeSheetId) {
      return {
        ...s,
        workspace: serializePersistedSheetWorkspace(targetTab),
      };
    }
    return s;
  });

  const sheet = updatedSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) {
    return null;
  }

  const primaryChart = getPrimarySheetContent(sheet.workspace);
  if (!primaryChart) {
    return null;
  }

  const nextTab = createChartTabStateFromPersistedContent(primaryChart, tabIndex, {
    id: targetTab.id,
    sheets: updatedSheets,
    activeSheetId: sheetId,
    layoutMode: sheet.workspace.layoutMode,
  });

  // Preserve the current tab's symbol identity. Sheets are layout/indicator contexts only.
  nextTab.title = targetTab.title;
  nextTab.instrument = targetTab.instrument;
  nextTab.requestedInstrument = targetTab.requestedInstrument;
  nextTab.instrumentMeta = targetTab.instrumentMeta;
  nextTab.loadedAdjusted = targetTab.loadedAdjusted;
  nextTab.loadedDividendAdjusted = targetTab.loadedDividendAdjusted;
  nextTab.loadedRightsAdjusted = targetTab.loadedRightsAdjusted;
  nextTab.drawings = getScopedDrawings(nextTab.drawingScopes, targetTab.instrument);
  nextTab.selectedDrawingId = null;

  // Always preserve current tab's data arrays from targetTab.
  // This prevents target sheet's old symbol data from appearing while we wait for rehydration.
  nextTab.rawBars = targetTab.rawBars;
  nextTab.displayBars = targetTab.displayBars;
  nextTab.events = targetTab.events;

  // Check if current data is compatible with target sheet's chart settings.
  const isDataCompatible =
    nextTab.timeframe === targetTab.timeframe &&
    nextTab.chartType === targetTab.chartType &&
    JSON.stringify(nextTab.renkoSettings) === JSON.stringify(targetTab.renkoSettings);

  const currentViewportSpan = Math.round(targetTab.viewport.endIndex - targetTab.viewport.startIndex);
  const hasMeaningfulCurrentViewport =
    Number.isFinite(targetTab.viewport.startIndex) &&
    Number.isFinite(targetTab.viewport.endIndex) &&
    currentViewportSpan > 0;

  if (hasMeaningfulCurrentViewport) {
    // Sheets are primarily used for switching indicator layouts and drawing contexts.
    // To provide a seamless AmiBroker-like experience, we preserve the current viewport,
    // visible bar count, and future margin mode across sheet switches so the user doesn't lose their place.
    nextTab.viewport = { ...targetTab.viewport };
    nextTab.visibleBarCount =
      targetTab.visibleBarCount > 0 ? targetTab.visibleBarCount : currentViewportSpan;
    nextTab.futureMarginMode = targetTab.futureMarginMode;
  }

  return {
    chartTabs: chartTabs.map((tab, index) => (index === tabIndex ? nextTab : tab)),
    activeChartTabId: tabId,
    shouldHydrate: !isDataCompatible && Boolean(nextTab.instrument),
  };
}

export function buildDeleteSheetState(
  chartTabs: ChartTabState[],
  tabId: string,
  sheetId: string,
): ChartWorkspaceState {
  return {
    chartTabs: chartTabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            sheets: tab.sheets.filter((sheet) => sheet.id !== sheetId),
            activeSheetId: tab.activeSheetId === sheetId ? null : tab.activeSheetId,
          }
        : tab,
    ),
    activeChartTabId: tabId,
  };
}

export function buildRenameSheetState(
  chartTabs: ChartTabState[],
  tabId: string,
  sheetId: string,
  newName: string,
): ChartWorkspaceState {
  return {
    chartTabs: chartTabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            sheets: tab.sheets.map((sheet) =>
              sheet.id === sheetId ? { ...sheet, name: newName } : sheet,
            ),
          }
        : tab,
    ),
    activeChartTabId: tabId,
  };
}

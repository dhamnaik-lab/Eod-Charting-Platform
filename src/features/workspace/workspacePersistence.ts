import type {
  ChartType,
  ChartVisualSettings,
  ChartValueLabelSettings,
  ChartDrawing,
  ChartDrawingScopes,
  CollapsedIndicatorPanes,
  FutureMarginMode,
  IndicatorPaneHeights,
  OverlayIndicator,
  PaneScaleOverrides,
  PersistedCompareOverlay,
  RenkoSettings,
  Viewport,
} from '@/engine/types';
import { normalizeFibonacciDrawing } from '@/engine/DrawingFibonacciMigration';
import {
  DEFAULT_CHART_VISUAL_SETTINGS,
  normalizeChartVisualSettings,
} from '@/engine/types';
import type { InstrumentKey, InstrumentSummary } from '@/platform';
import {
  DEFAULT_INDICATOR_PANE_HEIGHT,
  MAX_INDICATOR_PANE_HEIGHT,
  MIN_INDICATOR_PANE_HEIGHT,
} from '@/features/charts/chartIndicatorPaneService';
import {
  normalizeChartType,
  normalizeRenkoBrickSize,
  normalizeRenkoSettings,
} from '@/features/charts/chartTypeTransformService';
import { readWorkspaceLayoutSetting } from '@/features/workspace/workspaceService';
import { normalizeChartValueLabelSettings } from '@/engine/valueLabelSettings';
import { getDrawingScopeKey, setScopedDrawings } from '@/features/charts/drawingScopeService';

export type WorkspaceTimeframe = 'D' | 'W' | 'M' | 'Q' | 'Y';
export type WorkspaceLayoutMode = 'single' | 'tile' | 'tile-h' | 'tile-v' | 'tile-grid';

export interface PersistedChartContent {
  id: string;
  title: string;
  instrument: InstrumentKey | null;
  compareOverlays?: PersistedCompareOverlay[];
  timeframe: WorkspaceTimeframe;
  chartType?: ChartType;
  renkoBrickSize?: number;
  renkoSettings?: RenkoSettings;
  visualSettings?: Partial<ChartVisualSettings>;
  viewport: Viewport;
  indicators: OverlayIndicator[];
  drawings: ChartDrawing[];
  drawingScopes?: ChartDrawingScopes;
  indicatorPaneHeight: number;
  indicatorPaneHeights?: IndicatorPaneHeights;
  collapsedIndicatorPanes?: CollapsedIndicatorPanes;
  paneScaleOverrides?: PaneScaleOverrides;
  logScale?: boolean;
  showVolume?: boolean;
  invertPriceScale?: boolean;
  showValueLabels?: boolean;
  valueLabelSettings?: Partial<ChartValueLabelSettings>;
  showLeftAxis?: boolean;
  futureMarginMode?: FutureMarginMode;
}

export interface PersistedSheetWorkspace {
  version: 1;
  activeChartTabId: string;
  chartTabs: PersistedChartContent[];
  layoutMode: WorkspaceLayoutMode;
}

export interface PersistedSheet {
  id: string;
  name: string;
  createdAt: string;
  workspace: PersistedSheetWorkspace;
}

export interface PersistedChartTab extends PersistedChartContent {
  sheets: PersistedSheet[];
  activeSheetId: string | null;
  layoutMode: WorkspaceLayoutMode;
}

export interface PersistedChartWorkspace {
  version: 1;
  activeChartTabId: string;
  chartTabs: PersistedChartTab[];
}

export interface WorkspaceSheetLike {
  id: string;
  name: string;
  createdAt: string;
  workspace: PersistedSheetWorkspace;
}

export interface WorkspaceChartTabLike {
  id: string;
  title: string;
  instrument: InstrumentKey | null;
  compareOverlays?: PersistedCompareOverlay[];
  timeframe: WorkspaceTimeframe;
  chartType: ChartType;
  renkoBrickSize: number;
  renkoSettings: RenkoSettings;
  visualSettings: ChartVisualSettings;
  viewport: Viewport;
  indicators: OverlayIndicator[];
  drawings: ChartDrawing[];
  drawingScopes?: ChartDrawingScopes;
  indicatorPaneHeight: number;
  indicatorPaneHeights?: IndicatorPaneHeights;
  collapsedIndicatorPanes?: CollapsedIndicatorPanes;
  paneScaleOverrides?: PaneScaleOverrides;
  logScale?: boolean;
  showVolume?: boolean;
  invertPriceScale?: boolean;
  showValueLabels?: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis?: boolean;
  futureMarginMode?: FutureMarginMode;
  sheets: WorkspaceSheetLike[];
  activeSheetId: string | null;
  layoutMode: WorkspaceLayoutMode;
}

export interface WorkspaceStateLike {
  chartTabs: WorkspaceChartTabLike[];
  activeChartTabId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeTimeframe(value: unknown): WorkspaceTimeframe {
  return value === 'W' || value === 'M' || value === 'Q' || value === 'Y' ? value : 'D';
}

function normalizeLayoutMode(value: unknown): WorkspaceLayoutMode {
  return value === 'tile' || value === 'tile-h' || value === 'tile-v' || value === 'tile-grid'
    ? value
    : 'single';
}

function normalizeFutureMarginMode(value: unknown): FutureMarginMode {
  return value === 'tight' || value === 'wide' ? value : 'normal';
}

function getLegacyRenkoBrickSizeForSettings(chartType: ChartType, value: unknown): unknown {
  return chartType === 'renko' ? value : undefined;
}

function serializePersistedChartContent(
  tab: Pick<
    WorkspaceChartTabLike,
    | 'id'
    | 'title'
    | 'instrument'
    | 'compareOverlays'
    | 'timeframe'
    | 'chartType'
    | 'renkoBrickSize'
    | 'renkoSettings'
    | 'visualSettings'
    | 'viewport'
    | 'indicators'
    | 'drawings'
    | 'drawingScopes'
    | 'indicatorPaneHeight'
    | 'indicatorPaneHeights'
    | 'collapsedIndicatorPanes'
    | 'paneScaleOverrides'
    | 'logScale'
    | 'showVolume'
    | 'invertPriceScale'
    | 'showValueLabels'
    | 'valueLabelSettings'
    | 'showLeftAxis'
    | 'futureMarginMode'
  >,
): PersistedChartContent {
  return {
    id: tab.id,
    title: tab.title,
    instrument: tab.instrument,
    compareOverlays: (tab.compareOverlays ?? []).map((overlay) => ({
      id: overlay.id,
      instrument: overlay.instrument,
      instrumentMeta: overlay.instrumentMeta ?? null,
      color: overlay.color,
    })),
    timeframe: tab.timeframe,
    chartType: tab.chartType,
    renkoBrickSize: tab.renkoBrickSize,
    renkoSettings: tab.renkoSettings,
    visualSettings: tab.visualSettings,
    viewport: tab.viewport,
    indicators: tab.indicators,
    drawings: tab.drawings,
    drawingScopes: setScopedDrawings(tab.drawingScopes ?? {}, tab.instrument, tab.drawings),
    indicatorPaneHeight: tab.indicatorPaneHeight,
    indicatorPaneHeights: tab.indicatorPaneHeights ?? {},
    collapsedIndicatorPanes: tab.collapsedIndicatorPanes ?? {},
    paneScaleOverrides: tab.paneScaleOverrides ?? {},
    logScale: tab.logScale,
    showVolume: tab.showVolume,
    invertPriceScale: tab.invertPriceScale,
    showValueLabels: tab.showValueLabels,
    valueLabelSettings: tab.valueLabelSettings,
    showLeftAxis: tab.showLeftAxis,
    futureMarginMode: tab.futureMarginMode,
  };
}

function serializePersistedSheet(sheet: WorkspaceSheetLike): PersistedSheet {
  return {
    id: sheet.id,
    name: sheet.name,
    createdAt: sheet.createdAt,
    workspace: sheet.workspace,
  };
}

function serializePersistedChartTab(tab: WorkspaceChartTabLike): PersistedChartTab {
  const content = serializePersistedChartContent(tab);

  // Commit current tab state to the active sheet's workspace if it exists.
  // This ensures indicators/drawings/layout are persisted for the current sheet even if no switch occurred.
  const sheets = tab.sheets.map((sheet) => {
    if (sheet.id === tab.activeSheetId) {
      return {
        ...sheet,
        workspace: {
          version: 1 as const,
          activeChartTabId: tab.id,
          chartTabs: [content],
          layoutMode: tab.layoutMode,
        },
      };
    }
    return serializePersistedSheet(sheet);
  });

  return {
    ...content,
    sheets,
    activeSheetId: tab.activeSheetId,
    layoutMode: tab.layoutMode,
  };
}

export function serializeWorkspaceState(state: WorkspaceStateLike): PersistedChartWorkspace {
  const activeChartTabId = state.chartTabs.some((tab) => tab.id === state.activeChartTabId)
    ? state.activeChartTabId
    : state.chartTabs[0]?.id ?? crypto.randomUUID();

  return {
    version: 1,
    activeChartTabId,
    chartTabs: state.chartTabs.map(serializePersistedChartTab),
  };
}

export function stringifyWorkspaceState(state: WorkspaceStateLike): string {
  return JSON.stringify(serializeWorkspaceState(state));
}

function sanitizePersistedChartContent(value: unknown, index: number): PersistedChartContent | null {
  if (!isRecord(value)) {
    return null;
  }

  const instrumentValue = value.instrument;
  const instrument = sanitizeInstrumentKey(instrumentValue);

  const viewportValue = value.viewport;
  const viewport =
    isRecord(viewportValue) &&
    typeof viewportValue.startIndex === 'number' &&
    typeof viewportValue.endIndex === 'number'
      ? {
          startIndex: viewportValue.startIndex,
          endIndex: viewportValue.endIndex,
        }
      : { startIndex: 0, endIndex: 0 };

  const indicators = Array.isArray(value.indicators) ? (value.indicators as OverlayIndicator[]) : [];
  const compareOverlays = sanitizeCompareOverlays(value.compareOverlays);
  const indicatorPaneHeight =
    typeof value.indicatorPaneHeight === 'number'
      ? Math.max(MIN_INDICATOR_PANE_HEIGHT, Math.min(MAX_INDICATOR_PANE_HEIGHT, Math.round(value.indicatorPaneHeight)))
      : DEFAULT_INDICATOR_PANE_HEIGHT;
  const indicatorPaneHeights = sanitizeIndicatorPaneHeights(
    value.indicatorPaneHeights,
    indicators,
    indicatorPaneHeight,
  );
  const collapsedIndicatorPanes = sanitizeCollapsedIndicatorPanes(
    value.collapsedIndicatorPanes,
    indicators,
  );
  const paneScaleOverrides = sanitizePaneScaleOverrides(value.paneScaleOverrides, indicators);
  const drawings = Array.isArray(value.drawings)
    ? (value.drawings as ChartDrawing[]).map(normalizeFibonacciDrawing)
    : [];
  const drawingScopes: ChartDrawingScopes = {};
  if (isRecord(value.drawingScopes)) {
    Object.entries(value.drawingScopes).forEach(([key, scopedDrawings]) => {
      if (Array.isArray(scopedDrawings)) {
        drawingScopes[key] = (scopedDrawings as ChartDrawing[]).map(normalizeFibonacciDrawing);
      }
    });
  }
  const activeDrawingScopeKey = getDrawingScopeKey(instrument);
  if (activeDrawingScopeKey && drawingScopes[activeDrawingScopeKey] === undefined && drawings.length) {
    drawingScopes[activeDrawingScopeKey] = [...drawings];
  }

  const chartType = normalizeChartType(value.chartType);
  const legacyRenkoBrickSize = getLegacyRenkoBrickSizeForSettings(chartType, value.renkoBrickSize);

  return {
    id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
    title: typeof value.title === 'string' && value.title ? value.title : `Chart ${index}`,
    instrument,
    compareOverlays,
    timeframe: normalizeTimeframe(value.timeframe),
    chartType,
    renkoBrickSize: normalizeRenkoBrickSize(value.renkoBrickSize),
    renkoSettings: normalizeRenkoSettings(value.renkoSettings, legacyRenkoBrickSize),
    visualSettings: normalizeChartVisualSettings(value.visualSettings ?? DEFAULT_CHART_VISUAL_SETTINGS),
    viewport,
    indicators,
    drawings,
    drawingScopes,
    indicatorPaneHeight,
    indicatorPaneHeights,
    collapsedIndicatorPanes,
    paneScaleOverrides,
    logScale: value.logScale === true,
    showVolume: value.showVolume !== false,
    invertPriceScale: value.invertPriceScale === true,
    showValueLabels: value.showValueLabels !== false,
    valueLabelSettings: normalizeChartValueLabelSettings(value.valueLabelSettings, value.showValueLabels !== false),
    showLeftAxis: value.showLeftAxis === true,
    futureMarginMode: normalizeFutureMarginMode(value.futureMarginMode),
  };
}

function sanitizeInstrumentKey(value: unknown): InstrumentKey | null {
  if (!isRecord(value) || typeof value.symbol !== 'string' || typeof value.exchange !== 'string') {
    return null;
  }

  return {
    symbol: value.symbol,
    exchange: value.exchange,
  };
}

function sanitizeInstrumentSummary(value: unknown): InstrumentSummary | null {
  const instrument = sanitizeInstrumentKey(value);
  if (!instrument || !isRecord(value)) {
    return null;
  }

  return {
    ...instrument,
    name: typeof value.name === 'string' ? value.name : null,
    series: typeof value.series === 'string' ? value.series : null,
    isin: typeof value.isin === 'string' ? value.isin : null,
    resolvedFromAlias: value.resolvedFromAlias === true,
    matchedSymbol: typeof value.matchedSymbol === 'string' ? value.matchedSymbol : null,
    matchedName: typeof value.matchedName === 'string' ? value.matchedName : null,
  };
}

function sanitizeCompareOverlays(value: unknown): PersistedCompareOverlay[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((overlay) => {
    if (!isRecord(overlay) || typeof overlay.id !== 'string' || !overlay.id.trim()) {
      return [];
    }

    const instrument = sanitizeInstrumentKey(overlay.instrument);
    if (!instrument) {
      return [];
    }

    return [{
      id: overlay.id,
      instrument,
      instrumentMeta: sanitizeInstrumentSummary(overlay.instrumentMeta),
      color: typeof overlay.color === 'string' && overlay.color.trim() ? overlay.color : '#6a9bcc',
    }];
  });
}

function sanitizeIndicatorPaneHeights(
  value: unknown,
  indicators: OverlayIndicator[],
  fallbackHeight: number,
): IndicatorPaneHeights {
  const next: IndicatorPaneHeights = {};
  if (isRecord(value)) {
    Object.entries(value).forEach(([paneId, height]) => {
      if (typeof height === 'number' && Number.isFinite(height)) {
        next[paneId] = Math.max(
          MIN_INDICATOR_PANE_HEIGHT,
          Math.min(MAX_INDICATOR_PANE_HEIGHT, Math.round(height)),
        );
      }
    });
  }

  indicators.forEach((indicator) => {
    if (indicator.placement === 'pane' && !next[indicator.id]) {
      next[indicator.id] = fallbackHeight;
    }
  });

  return next;
}

function sanitizeCollapsedIndicatorPanes(
  value: unknown,
  indicators: OverlayIndicator[],
): CollapsedIndicatorPanes {
  const allowedPaneIds = new Set<string>(
    indicators.filter((indicator) => indicator.placement === 'pane').map((indicator) => indicator.id),
  );
  const next: CollapsedIndicatorPanes = {};
  if (!isRecord(value)) {
    return next;
  }

  Object.entries(value).forEach(([paneId, collapsed]) => {
    if (allowedPaneIds.has(paneId) && collapsed === true) {
      next[paneId] = true;
    }
  });

  return next;
}

function sanitizePaneScaleOverrides(
  value: unknown,
  indicators: OverlayIndicator[],
): PaneScaleOverrides {
  const allowedPaneIds = new Set<string>([
    'price',
    ...indicators.filter((indicator) => indicator.placement === 'pane').map((indicator) => indicator.id),
  ]);
  const next: PaneScaleOverrides = {};
  if (!isRecord(value)) {
    return next;
  }

  Object.entries(value).forEach(([paneId, range]) => {
    if (!allowedPaneIds.has(paneId) || !isRecord(range)) {
      return;
    }
    if (
      typeof range.min === 'number' &&
      typeof range.max === 'number' &&
      Number.isFinite(range.min) &&
      Number.isFinite(range.max) &&
      range.max > range.min
    ) {
      next[paneId] = {
        min: range.min,
        max: range.max,
      };
    }
  });

  return next;
}

function sanitizePersistedSheetWorkspace(value: unknown): PersistedSheetWorkspace | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.chartTabs)) {
    return null;
  }

  const chartTabs = value.chartTabs
    .map((tab, index) => sanitizePersistedChartContent(tab, index + 1))
    .filter((tab): tab is PersistedChartContent => Boolean(tab));

  if (!chartTabs.length) {
    return null;
  }

  const activeChartTabId =
    typeof value.activeChartTabId === 'string' &&
    chartTabs.some((tab) => tab.id === value.activeChartTabId)
      ? value.activeChartTabId
      : chartTabs[0].id;

  return {
    version: 1,
    activeChartTabId,
    chartTabs,
    layoutMode: normalizeLayoutMode(value.layoutMode),
  };
}

function sanitizePersistedSheet(value: unknown, index: number): PersistedSheet | null {
  if (!isRecord(value)) {
    return null;
  }

  const workspace = sanitizePersistedSheetWorkspace(value.workspace);
  if (!workspace) {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name : `${index}`,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    workspace,
  };
}

function sanitizePersistedChartTab(value: unknown, index: number): PersistedChartTab | null {
  const content = sanitizePersistedChartContent(value, index);
  if (!content || !isRecord(value)) {
    return null;
  }

  const sheets = Array.isArray(value.sheets)
    ? value.sheets
        .map((sheet, sheetIndex) => sanitizePersistedSheet(sheet, sheetIndex + 1))
        .filter((sheet): sheet is PersistedSheet => Boolean(sheet))
    : [];

  const activeSheetId =
    typeof value.activeSheetId === 'string' && sheets.some((sheet) => sheet.id === value.activeSheetId)
      ? value.activeSheetId
      : null;

  return {
    ...content,
    sheets,
    activeSheetId,
    layoutMode: normalizeLayoutMode(value.layoutMode),
  };
}

export function parsePersistedWorkspace(rawValue: string | null): PersistedChartWorkspace | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.chartTabs)) {
      return null;
    }

    const chartTabs = parsed.chartTabs
      .map((tab, index) => sanitizePersistedChartTab(tab, index + 1))
      .filter((tab): tab is PersistedChartTab => Boolean(tab));

    if (!chartTabs.length) {
      return null;
    }

    const activeChartTabId =
      typeof parsed.activeChartTabId === 'string' &&
      chartTabs.some((tab) => tab.id === parsed.activeChartTabId)
        ? parsed.activeChartTabId
        : chartTabs[0].id;

    return {
      version: 1,
      activeChartTabId,
      chartTabs,
    };
  } catch {
    return null;
  }
}

export async function readPersistedWorkspace(): Promise<PersistedChartWorkspace | null> {
  return parsePersistedWorkspace(await readWorkspaceLayoutSetting());
}

export function buildWorkspaceFromPersisted<T extends { id: string }>(
  persisted: PersistedChartWorkspace | null,
  buildChartTab: (persistedTab: PersistedChartTab, index: number) => T,
): { chartTabs: T[]; activeChartTabId: string } | null {
  if (!persisted) {
    return null;
  }

  const chartTabs = persisted.chartTabs.map((persistedTab, index) =>
    buildChartTab(persistedTab, index),
  );

  if (!chartTabs.length) {
    return null;
  }

  const activeChartTabId = chartTabs.some((tab) => tab.id === persisted.activeChartTabId)
    ? persisted.activeChartTabId
    : chartTabs[0].id;

  return {
    chartTabs,
    activeChartTabId,
  };
}

export function getPrimarySheetContent(workspace: PersistedSheetWorkspace): PersistedChartContent | null {
  return workspace.chartTabs.find((tab) => tab.id === workspace.activeChartTabId) ?? workspace.chartTabs[0] ?? null;
}

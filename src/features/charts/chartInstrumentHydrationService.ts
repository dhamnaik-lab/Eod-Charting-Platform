import {
  createDefaultViewport,
  isViewportMeaningful,
  toBar,
} from '@/features/charts/chartDataUtils';
import { buildChartDisplayBars } from '@/features/charts/chartTypeTransformService';
import { beginChartDataRead, chartReadKey, invalidateChartRequests } from '@/features/charts/chartLoadGuard';
import { ChartDataRequestSupersededError } from '@/platform/chartRequestErrors';
import {
  filterCompareOverlaysForBaseInstrument,
  hydrateCompareOverlays,
} from '@/features/charts/compareOverlayService';
import { clampViewport, getAllowedFutureBars } from '@/engine/ScaleManager';
import type {
  ChartCompareOverlay,
  ChartMarkerEvent,
  FutureMarginMode,
  Viewport,
} from '@/engine/types';
import type {
  DesktopApi,
  EodDataResult,
  InstrumentKey,
  InstrumentSummary,
} from '@/platform';
import type { ChartTabState } from '@/store/chartStoreTypes';
import {
  activateInstrumentDrawingScope,
  bindLoadedInstrumentDrawingScope,
} from '@/features/charts/drawingScopeService';

export interface HydratedChartTabPayload {
  result: EodDataResult;
  compareOverlays: ChartCompareOverlay[];
}

export interface InstrumentDataCache {
  read: (
    databasePath: string | null,
    instrument: InstrumentKey,
    adjusted: boolean,
    includeDividendAdjustments: boolean,
    includeRightsAdjustments: boolean,
    resolveIdentity?: boolean,
  ) => EodDataResult | null;
  write: (
    databasePath: string | null,
    requestedInstrument: InstrumentKey,
    result: EodDataResult,
    resolveIdentity?: boolean,
  ) => void;
  clear: () => void;
  getGeneration?: () => number;
}

interface LoadInstrumentResultInput {
  api: DesktopApi;
  databasePath: string | null;
  instrument: InstrumentKey;
  adjusted: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  instrumentDataCache: InstrumentDataCache;
  forceReload?: boolean;
  resolveIdentity?: boolean;
}

interface HydrateChartTabPayloadInput {
  api: DesktopApi;
  databasePath: string | null;
  tab: ChartTabState;
  targetInstrument: InstrumentKey;
  adjusted: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  instrumentDataCache: InstrumentDataCache;
  forceReload?: boolean;
}

function buildInstrumentDataCacheKey(
  databasePath: string,
  instrument: InstrumentKey,
  adjusted: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
  resolveIdentity = true,
): string {
  return chartReadKey(databasePath, instrument, adjusted, includeDividendAdjustments, includeRightsAdjustments, resolveIdentity);
}

export function createInstrumentDataCache(): InstrumentDataCache {
  const instrumentDataCache = new Map<string, EodDataResult>();
  let generation = 0;

  const cache: InstrumentDataCache = {
    read: (databasePath, instrument, adjusted, includeDividendAdjustments, includeRightsAdjustments, resolveIdentity) => {
      if (!databasePath) {
        return null;
      }

      return instrumentDataCache.get(
        buildInstrumentDataCacheKey(
          databasePath,
          instrument,
          adjusted,
          includeDividendAdjustments,
          includeRightsAdjustments,
          resolveIdentity,
        ),
      ) ?? null;
    },
    write: (databasePath, requestedInstrument, result, resolveIdentity) => {
      if (!databasePath) {
        return;
      }

      instrumentDataCache.set(
        buildInstrumentDataCacheKey(
          databasePath,
          requestedInstrument,
          result.adjusted,
          result.includeDividendAdjustments,
          result.includeRightsAdjustments,
          resolveIdentity,
        ),
        result,
      );

      if (result.instrument && resolveIdentity !== false) {
        // Cache by the resolved instrument as well so future loads hit even when the
        // requested symbol was an alias or otherwise canonicalized by the backend.
        instrumentDataCache.set(
          buildInstrumentDataCacheKey(
            databasePath,
            { symbol: result.instrument.symbol, exchange: result.instrument.exchange },
            result.adjusted,
            result.includeDividendAdjustments,
            result.includeRightsAdjustments,
            resolveIdentity,
          ),
          result,
        );
      }
    },
    clear: () => {
      generation += 1;
      invalidateChartRequests(cache);
      instrumentDataCache.clear();
    },
    getGeneration: () => generation,
  };
  return cache;
}

function normalizePersistedViewport(
  viewport: Viewport,
  totalBars: number,
  futureMarginMode: FutureMarginMode,
  previousTotalBars?: number,
): Viewport {
  if (totalBars <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  if (!isViewportMeaningful(viewport) || (viewport.startIndex === 0 && viewport.endIndex === 0)) {
    return createDefaultViewport(totalBars, futureMarginMode);
  }

  const span = Math.max(Math.round(viewport.endIndex - viewport.startIndex), 5);
  const futureBars = getAllowedFutureBars(span, futureMarginMode);

  if (typeof previousTotalBars === 'number' && previousTotalBars > 0) {
    const prevFutureBars = getAllowedFutureBars(span, futureMarginMode);
    const rightOffset = Math.max(0, (previousTotalBars + prevFutureBars) - viewport.endIndex);
    const endIndex = Math.max(span, (totalBars + futureBars) - rightOffset);
    return clampViewport(
      {
        startIndex: endIndex - span,
        endIndex,
      },
      totalBars,
      5,
      futureMarginMode,
    );
  }

  const endIndex = totalBars + futureBars;
  return clampViewport(
    {
      startIndex: Math.max(0, endIndex - span),
      endIndex,
    },
    totalBars,
    5,
    futureMarginMode,
  );
}

export function applyEodResultToTab(
  tab: ChartTabState,
  requestedInstrument: InstrumentKey,
  result: EodDataResult,
  preserveViewport: boolean,
  previousViewport?: Viewport,
): ChartTabState {
  const resolvedInstrument = result.instrument
    ? { symbol: result.instrument.symbol, exchange: result.instrument.exchange }
    : requestedInstrument;
  const rawBars = result.bars.map(toBar);
  const displayBars = buildChartDisplayBars(
    rawBars,
    tab.timeframe,
    tab.chartType,
    tab.renkoBrickSize,
    tab.renkoSettings,
  );
  const compareOverlays = filterCompareOverlaysForBaseInstrument(tab.compareOverlays, resolvedInstrument);

  const isDifferentInstrument =
    !tab.instrument ||
    tab.instrument.symbol !== resolvedInstrument.symbol ||
    tab.instrument.exchange !== resolvedInstrument.exchange;

  let paneScaleOverrides = tab.paneScaleOverrides;
  if (isDifferentInstrument && paneScaleOverrides?.price) {
    const { price: _discardPrice, ...indicatorPaneOverrides } = paneScaleOverrides;
    paneScaleOverrides = indicatorPaneOverrides;
  }

  const sourceViewport = previousViewport ?? tab.viewport;
  const viewport =
    preserveViewport && isViewportMeaningful(sourceViewport)
      ? normalizePersistedViewport(sourceViewport, displayBars.length, tab.futureMarginMode, tab.displayBars.length)
      : createDefaultViewport(displayBars.length, tab.futureMarginMode);
  const drawingScopeState = bindLoadedInstrumentDrawingScope(
    {
      instrument: tab.instrument,
      drawings: tab.drawings,
      drawingScopes: tab.drawingScopes,
      displayBars: tab.displayBars,
    },
    requestedInstrument,
    resolvedInstrument,
    displayBars,
  );

  return {
    ...tab,
    instrument: resolvedInstrument,
    instrumentMeta: result.instrument ?? tab.instrumentMeta,
    requestedInstrument,
    title: `${resolvedInstrument.exchange}:${resolvedInstrument.symbol}`,
    rawBars,
    displayBars,
    events: result.events.map(toChartEvent),
    compareOverlays,
    drawings: drawingScopeState.drawings,
    drawingScopes: drawingScopeState.drawingScopes,
    selectedDrawingId: null,
    paneScaleOverrides,
    viewport,
    visibleBarCount: Math.max(0, Math.round(viewport.endIndex - viewport.startIndex)),
    hoverBar: null,
    loadedAdjusted: result.adjusted,
    loadedDividendAdjusted: result.includeDividendAdjustments,
    loadedRightsAdjusted: result.includeRightsAdjustments,
  };
}

export function buildInstrumentLoadStartTab(
  tab: ChartTabState,
  instrument: InstrumentKey,
  meta?: InstrumentSummary | null,
): ChartTabState {
  const isSameInstrument =
    tab.instrument &&
    tab.instrument.symbol === instrument.symbol &&
    tab.instrument.exchange === instrument.exchange;
  const drawingScopeState = isSameInstrument
    ? { drawings: tab.drawings, drawingScopes: tab.drawingScopes }
    : activateInstrumentDrawingScope(
        {
          instrument: tab.instrument,
          drawings: tab.drawings,
          drawingScopes: tab.drawingScopes,
          displayBars: tab.displayBars,
        },
        instrument,
      );
  // A new instrument replaces tab.instrument before the asynchronous data result arrives.
  // Clear its old manually adjusted price range now; indicator-pane ranges remain intact.
  let paneScaleOverrides = tab.paneScaleOverrides;
  if (!isSameInstrument && paneScaleOverrides.price) {
    const { price: _oldInstrumentPriceRange, ...remainingOverrides } = paneScaleOverrides;
    paneScaleOverrides = remainingOverrides;
  }

  return {
    ...tab,
    instrument,
    requestedInstrument: instrument,
    paneScaleOverrides,
    instrumentMeta: meta ?? tab.instrumentMeta,
    title: `${instrument.exchange}:${instrument.symbol}`,
    drawings: drawingScopeState.drawings,
    drawingScopes: drawingScopeState.drawingScopes,
    selectedDrawingId: isSameInstrument ? tab.selectedDrawingId : null,
    rawBars: isSameInstrument ? tab.rawBars : [],
    displayBars: isSameInstrument ? tab.displayBars : [],
    events: isSameInstrument ? tab.events : [],
    viewport: isSameInstrument ? tab.viewport : { startIndex: 0, endIndex: 0 },
    visibleBarCount: isSameInstrument ? tab.visibleBarCount : 0,
    hoverBar: null,
    loadedAdjusted: isSameInstrument ? tab.loadedAdjusted : null,
    loadedDividendAdjusted: isSameInstrument ? tab.loadedDividendAdjusted : null,
    loadedRightsAdjusted: isSameInstrument ? tab.loadedRightsAdjusted : null,
  };
}

export function buildInstrumentLoadFailureTab(
  tab: ChartTabState,
  instrument: InstrumentKey,
  meta: InstrumentSummary | null | undefined,
  adjustedMode: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
): ChartTabState {
  const isSameInstrument =
    tab.instrument &&
    tab.instrument.symbol === instrument.symbol &&
    tab.instrument.exchange === instrument.exchange;

  return {
    ...tab,
    instrument,
    requestedInstrument: instrument,
    instrumentMeta: meta ?? tab.instrumentMeta,
    title: `${instrument.exchange}:${instrument.symbol}`,
    rawBars: isSameInstrument ? tab.rawBars : [],
    displayBars: isSameInstrument ? tab.displayBars : [],
    events: isSameInstrument ? tab.events : [],
    viewport: isSameInstrument ? tab.viewport : { startIndex: 0, endIndex: 0 },
    visibleBarCount: isSameInstrument ? tab.visibleBarCount : 0,
    hoverBar: null,
    loadedAdjusted: isSameInstrument ? tab.loadedAdjusted : null,
    loadedDividendAdjusted: isSameInstrument ? tab.loadedDividendAdjusted : null,
    loadedRightsAdjusted: isSameInstrument ? tab.loadedRightsAdjusted : null,
  };
}

export function buildHydrationFailureTab(
  tab: ChartTabState,
  targetInstrument: InstrumentKey,
  adjustedMode: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
): ChartTabState {
  const isSameInstrument =
    tab.instrument &&
    tab.instrument.symbol === targetInstrument.symbol &&
    tab.instrument.exchange === targetInstrument.exchange;

  return {
    ...tab,
    requestedInstrument: targetInstrument,
    rawBars: isSameInstrument ? tab.rawBars : [],
    displayBars: isSameInstrument ? tab.displayBars : [],
    events: isSameInstrument ? tab.events : [],
    viewport: isSameInstrument ? tab.viewport : { startIndex: 0, endIndex: 0 },
    visibleBarCount: isSameInstrument ? tab.visibleBarCount : 0,
    hoverBar: null,
    loadedAdjusted: isSameInstrument ? tab.loadedAdjusted : null,
    loadedDividendAdjusted: isSameInstrument ? tab.loadedDividendAdjusted : null,
    loadedRightsAdjusted: isSameInstrument ? tab.loadedRightsAdjusted : null,
  };
}

export async function loadInstrumentResult({
  api,
  databasePath,
  instrument,
  adjusted,
  includeDividendAdjustments,
  includeRightsAdjustments,
  instrumentDataCache,
  forceReload,
  resolveIdentity,
}: LoadInstrumentResultInput): Promise<EodDataResult> {
  const generation = instrumentDataCache.getGeneration?.();
  const read = beginChartDataRead(instrumentDataCache,
    chartReadKey(databasePath, instrument, adjusted, includeDividendAdjustments, includeRightsAdjustments, resolveIdentity), forceReload);
  if (!forceReload) {
    const cachedResult = instrumentDataCache.read(
      databasePath,
      instrument,
      adjusted,
      includeDividendAdjustments,
      includeRightsAdjustments,
      resolveIdentity,
    );
    if (cachedResult) {
      return cachedResult;
    }
  }

  const result = await api.getEodData({
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    adjusted,
    includeDividendAdjustments,
    includeRightsAdjustments,
    resolveIdentity,
    databasePath,
    forceReload,
  });
  if (!read.isCurrent() || generation !== instrumentDataCache.getGeneration?.()) {
    throw new ChartDataRequestSupersededError('Chart data request was invalidated before completion.');
  }
  instrumentDataCache.write(databasePath, instrument, result, resolveIdentity);
  return result;
}

export async function hydrateChartTabPayload({
  api,
  databasePath,
  tab,
  targetInstrument,
  adjusted,
  includeDividendAdjustments,
  includeRightsAdjustments,
  instrumentDataCache,
  forceReload,
}: HydrateChartTabPayloadInput): Promise<HydratedChartTabPayload> {
  const result = await loadInstrumentResult({
    api,
    databasePath,
    instrument: targetInstrument,
    adjusted,
    includeDividendAdjustments,
    includeRightsAdjustments,
    instrumentDataCache,
    forceReload,
  });
  const compareOverlays = tab.compareOverlays.length
      ? await hydrateCompareOverlays(
        tab.compareOverlays,
        tab.timeframe,
        tab.chartType,
        tab.renkoBrickSize,
        tab.renkoSettings,
        adjusted,
        includeDividendAdjustments,
        includeRightsAdjustments,
        {
          api,
          databasePath,
          readCachedInstrumentData: instrumentDataCache.read,
          writeCachedInstrumentData: instrumentDataCache.write,
          forceReload,
          cacheGeneration: instrumentDataCache.getGeneration,
          requestOwner: instrumentDataCache,
        },
      )
    : tab.compareOverlays;

  return { result, compareOverlays };
}

function toChartEvent(event: EodDataResult['events'][number]): ChartMarkerEvent {
  return {
    id: event.id,
    effectiveDate: event.effectiveDate,
    type: event.type,
    label: event.label,
    description: event.description,
  };
}

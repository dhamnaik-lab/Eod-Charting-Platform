import { toBar } from '@/features/charts/chartDataUtils';
import type { ChartCompareOverlay, ChartType, PersistedCompareOverlay, RenkoSettings } from '@/engine/types';
import type { EodDataResult, InstrumentKey } from '@/platform';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';
import { buildChartDisplayBars } from '@/features/charts/chartTypeTransformService';

export const MAX_COMPARE_OVERLAYS = 3;

const COMPARE_OVERLAY_COLORS = ['#6a9bcc', '#f6ad55', '#34d399', '#f472b6', '#facc15', '#c5663d'] as const;

export interface CompareOverlayDataContext {
  api: {
    getEodData(input: {
      symbol: string;
      exchange: string;
      adjusted?: boolean;
      includeDividendAdjustments?: boolean;
      includeRightsAdjustments?: boolean;
    }): Promise<EodDataResult>;
  } | null;
  databasePath: string | null;
  readCachedInstrumentData: (
    databasePath: string | null,
    instrument: InstrumentKey,
    adjusted: boolean,
    includeDividendAdjustments: boolean,
    includeRightsAdjustments: boolean,
  ) => EodDataResult | null;
  writeCachedInstrumentData: (
    databasePath: string | null,
    instrument: InstrumentKey,
    result: EodDataResult,
  ) => void;
}

export function isSameInstrumentKey(
  left: InstrumentKey | null | undefined,
  right: InstrumentKey | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.symbol === right.symbol && left.exchange === right.exchange;
}

export function filterCompareOverlaysForBaseInstrument(
  compareOverlays: ChartCompareOverlay[],
  baseInstrument: InstrumentKey | null,
): ChartCompareOverlay[] {
  if (!baseInstrument) {
    return compareOverlays;
  }

  return compareOverlays.filter((overlay) => !isSameInstrumentKey(overlay.instrument, baseInstrument));
}

export function pickCompareOverlayColor(
  compareOverlays: Array<Pick<PersistedCompareOverlay, 'color'>>,
): string {
  const usedColors = new Set(compareOverlays.map((overlay) => overlay.color.toLowerCase()));
  return (
    COMPARE_OVERLAY_COLORS.find((color) => !usedColors.has(color.toLowerCase())) ??
    COMPARE_OVERLAY_COLORS[compareOverlays.length % COMPARE_OVERLAY_COLORS.length]
  );
}

export function createChartCompareOverlay(
  overlay: PersistedCompareOverlay,
  _timeframe: WorkspaceTimeframe,
  _chartType: ChartType,
  _renkoBrickSize: number,
  _renkoSettings?: RenkoSettings,
): ChartCompareOverlay {
  return {
    ...overlay,
    rawBars: [],
    displayBars: [],
  };
}

export function applyCompareOverlayResult(
  overlay: ChartCompareOverlay,
  result: EodDataResult,
  timeframe: WorkspaceTimeframe,
  chartType: ChartType,
  renkoBrickSize: number,
  renkoSettings?: RenkoSettings,
): ChartCompareOverlay {
  const rawBars = result.bars.map(toBar);
  return {
    ...overlay,
    instrumentMeta: result.instrument ?? overlay.instrumentMeta ?? null,
    rawBars,
    displayBars: buildChartDisplayBars(rawBars, timeframe, chartType, renkoBrickSize, renkoSettings),
  };
}

export function applyCompareOverlaysTimeframe(
  compareOverlays: ChartCompareOverlay[],
  timeframe: WorkspaceTimeframe,
  chartType: ChartType,
  renkoBrickSize: number,
  renkoSettings?: RenkoSettings,
): ChartCompareOverlay[] {
  return compareOverlays.map((overlay) => ({
    ...overlay,
    displayBars: buildChartDisplayBars(
      overlay.rawBars,
      timeframe,
      chartType,
      renkoBrickSize,
      renkoSettings,
    ),
  }));
}

export async function loadCompareOverlayResult(
  overlay: Pick<ChartCompareOverlay, 'instrument'>,
  adjusted: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
  context: CompareOverlayDataContext,
): Promise<EodDataResult> {
  if (!context.api) {
    throw new Error('Desktop API unavailable.');
  }

  const cachedResult = context.readCachedInstrumentData(
    context.databasePath,
    overlay.instrument,
    adjusted,
    includeDividendAdjustments,
    includeRightsAdjustments,
  );
  if (cachedResult) {
    return cachedResult;
  }

  const result = await context.api.getEodData({
    symbol: overlay.instrument.symbol,
    exchange: overlay.instrument.exchange,
    adjusted,
    includeDividendAdjustments,
    includeRightsAdjustments,
  });
  context.writeCachedInstrumentData(context.databasePath, overlay.instrument, result);
  return result;
}

export async function hydrateCompareOverlays(
  compareOverlays: ChartCompareOverlay[],
  timeframe: WorkspaceTimeframe,
  chartType: ChartType,
  renkoBrickSize: number,
  renkoSettings: RenkoSettings | undefined,
  adjusted: boolean,
  includeDividendAdjustments: boolean,
  includeRightsAdjustments: boolean,
  context: CompareOverlayDataContext,
): Promise<ChartCompareOverlay[]> {
  return Promise.all(
    compareOverlays.map(async (overlay) => {
      try {
        const result = await loadCompareOverlayResult(
          overlay,
          adjusted,
          includeDividendAdjustments,
          includeRightsAdjustments,
          context,
        );
        return applyCompareOverlayResult(
          overlay,
          result,
          timeframe,
          chartType,
          renkoBrickSize,
          renkoSettings,
        );
      } catch {
        return {
          ...overlay,
          rawBars: [],
          displayBars: [],
        };
      }
    }),
  );
}

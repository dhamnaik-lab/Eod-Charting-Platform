import type { OHLCBar } from '@/engine/types';
import type { InstrumentKey } from '@/platform';
import type { ScannerChartOverlay } from '@/store/uiStore';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/features/chartPatterns';
import { buildScannerTimeframeBars } from './scannerChartTimeframe';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';

export interface ScannerChartPriceBasis {
  adjusted: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
}

export const RAW_SCANNER_PRICE_BASIS: ScannerChartPriceBasis = {
  adjusted: false, includeDividendAdjustments: false, includeRightsAdjustments: false,
};

export function sameScannerPriceBasis(a: ScannerChartPriceBasis, b: ScannerChartPriceBasis): boolean {
  return a.adjusted === b.adjusted && a.includeDividendAdjustments === b.includeDividendAdjustments &&
    a.includeRightsAdjustments === b.includeRightsAdjustments;
}

export function getLoadedScannerPriceBasis(tab: {
  loadedAdjusted: boolean | null;
  loadedDividendAdjusted: boolean | null;
  loadedRightsAdjusted: boolean | null;
}): ScannerChartPriceBasis | null {
  if (tab.loadedAdjusted === null || tab.loadedDividendAdjusted === null || tab.loadedRightsAdjusted === null) return null;
  return { adjusted: tab.loadedAdjusted, includeDividendAdjustments: tab.loadedDividendAdjusted, includeRightsAdjustments: tab.loadedRightsAdjusted };
}

export interface ScannerChartContext {
  instrument: InstrumentKey;
  bars: OHLCBar[];
  priceBasis: ScannerChartPriceBasis;
  databasePath: string | null;
  timeframe?: WorkspaceTimeframe;
}

// A scanner row/map is normally produced from raw daily data. Re-evaluate its
// original endpoint on the chart's daily series rather than scaling guessed prices.
export function resolveScannerOverlayPriceBasis(
  overlay: ScannerChartOverlay | null,
  context: ScannerChartContext | null,
): ScannerChartOverlay | null {
  if (!overlay || !context || overlay.instrument.exchange !== context.instrument.exchange ||
    overlay.instrument.symbol !== context.instrument.symbol) return null;
  if (overlay.databasePath !== undefined && overlay.databasePath !== context.databasePath) return null;
  if (overlay.timeframe && overlay.timeframe !== (context.timeframe ?? 'D')) return null;
  // Core scanner rows can be label-only; their marker uses the displayed candle,
  // so there are no stored price coordinates to translate or reject.
  if (!overlay.geometry && overlay.levels.length === 0) return overlay;
  const sameBasis = sameScannerPriceBasis(overlay.priceBasis ?? RAW_SCANNER_PRICE_BASIS, context.priceBasis);
  if (sameBasis && (!overlay.scannerId || overlay.sourceBars === context.bars)) return overlay;
  const definition = chartPatternScannerDefinitions.find(d => d.id === overlay.scannerId);
  if (!definition) return sameBasis ? overlay : null;
  const sourceBars = buildScannerTimeframeBars(context.instrument.symbol, context.bars, overlay.timeframe ?? 'D');
  const endIndex = sourceBars.findIndex(bar => bar.date === overlay.date);
  if (endIndex < 0) return null;
  const startIndex = overlay.contextBars ? Math.max(0, endIndex + 1 - overlay.contextBars) : 0;
  const bars = sourceBars.slice(startIndex, endIndex + 1);
  const result = runChartPatternScanner({ ...context.instrument, instrument: context.instrument, bars }, definition);
  if (!result?.matched || !result.chartPattern?.geometry) return null;
  const details = result.chartPattern;
  const geometry = result.chartPattern.geometry;
  const levels = [
    { label: 'Breakout', value: details.breakoutLevel }, { label: 'Support', value: details.supportLevel },
    { label: 'Resistance', value: details.resistanceLevel }, { label: 'Neckline', value: details.necklineLevel },
  ].filter((level): level is { label: string; value: number } => typeof level.value === 'number' && Number.isFinite(level.value));
  return { ...overlay, priceBasis: context.priceBasis, sourceBars: context.bars, databasePath: context.databasePath,
    direction: result.direction, score: result.score,
    geometry, levels, editable: geometry.family === 'range' };
}

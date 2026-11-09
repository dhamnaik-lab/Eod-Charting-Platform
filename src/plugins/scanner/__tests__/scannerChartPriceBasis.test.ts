import { describe, expect, it, vi } from 'vitest';
import { loadCompleteChartHistory, scannerHistoryMatchesChart } from '../chartPatternScanService';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '../chartPatternScanners';
import { getLoadedScannerPriceBasis, RAW_SCANNER_PRICE_BASIS, resolveScannerOverlayPriceBasis } from '../scannerChartPriceBasis';
import type { ScannerChartOverlay } from '@/store/uiStore';
import type { EodBar } from '../types';
import type { OHLCBar } from '@/engine/types';

const instrument = { exchange:'NSE', symbol:'ABC' };
const adjusted = { adjusted:true, includeDividendAdjustments:true, includeRightsAdjustments:true };
const prices = [
  [88,92,86,90],[90,96,88,94],[94,104,92,101],[101,110,99,106],
  [105,108,96,98],[98,103,92,95],[96,112,95,110],[110,124,108,120],
  [118,121,104,106],[106,111,94,96],[98,108,96,106],[106,112,102,108],
  [104,108,98,100],[100,104,96,98],[98,101,93,95],[94,98,89,91],
];
const bars: (EodBar & OHLCBar)[] = prices.map(([open,high,low,close], i) => ({ symbol:'ABC', date:`2028-06-${String(i+1).padStart(2,'0')}`,timestamp:Date.UTC(2028,5,i+1),open,high,low,close,volume:100000 }));
const definition = chartPatternScannerDefinitions.find(d => d.id === 'chart_head_shoulders')!;
const result = runChartPatternScanner({ ...instrument, instrument, bars }, definition)!;
const overlay: ScannerChartOverlay = { id:'basis', instrument, scannerId:definition.id, date:result.date,
  scannerName:result.scannerName, geometry:result.chartPattern!.geometry, levels:[], priceBasis:RAW_SCANNER_PRICE_BASIS, sourceBars:bars };

describe('scanner/chart price basis', () => {
  it('loads history with all active-chart basis flags and database cache context', async () => {
    const getEodData = vi.fn().mockResolvedValue({ ...adjusted, instrument:null, bars, events:[] });
    await loadCompleteChartHistory({ getEodData }, instrument, { ...adjusted, databasePath:'database-A' });
    expect(getEodData).toHaveBeenCalledWith({ ...instrument, ...adjusted, databasePath:'database-A' });
  });

  it('rejects a history response with a different price basis', async () => {
    const getEodData = vi.fn().mockResolvedValue({ ...RAW_SCANNER_PRICE_BASIS, instrument:null, bars, events:[] });
    await expect(loadCompleteChartHistory({ getEodData }, instrument, adjusted)).rejects.toThrow(/price basis/i);
  });

  it('uses loaded flags rather than assuming requested settings have finished loading', () => {
    expect(getLoadedScannerPriceBasis({ loadedAdjusted:false, loadedDividendAdjusted:false, loadedRightsAdjusted:false })).toEqual(RAW_SCANNER_PRICE_BASIS);
    expect(getLoadedScannerPriceBasis({ loadedAdjusted:null, loadedDividendAdjusted:false, loadedRightsAdjusted:false })).toBeNull();
  });

  it('recalculates raw row/map geometry on an adjusted chart at its original endpoint', () => {
    const adjustedBars = bars.map(bar => ({ ...bar, open:bar.open/2, high:bar.high/2, low:bar.low/2, close:bar.close/2 }));
    const resolved = resolveScannerOverlayPriceBasis(overlay, { instrument, bars:adjustedBars, priceBasis:adjusted, databasePath:'A' });
    expect(resolved?.geometry?.pivotMarkers?.map(p => p.price)).toEqual([55,46,62,47,56]);
    expect(resolved?.priceBasis).toEqual(adjusted);
    expect(overlay.geometry?.pivotMarkers?.map(p => p.price)).toEqual([110,92,124,94,112]);
  });

  it('does not fabricate a match when the new series no longer satisfies the detector', () => {
    const flat = bars.map(bar => ({ ...bar, open:100, high:101, low:99, close:100 }));
    expect(resolveScannerOverlayPriceBasis(overlay, { instrument, bars:flat, priceBasis:adjusted, databasePath:'A' })).toBeNull();
  });

  it('preserves same-basis overlays and rejects other databases, identities, and absent endpoints', () => {
    const context = { instrument, bars, priceBasis:RAW_SCANNER_PRICE_BASIS, databasePath:'A' };
    expect(resolveScannerOverlayPriceBasis(overlay, context)).toBe(overlay);
    expect(resolveScannerOverlayPriceBasis({ ...overlay, databasePath:'B' }, context)).toBeNull();
    expect(resolveScannerOverlayPriceBasis(overlay, { ...context, instrument:{ ...instrument, exchange:'BSE' } })).toBeNull();
    expect(resolveScannerOverlayPriceBasis({ ...overlay, date:'1900-01-01' }, { ...context, priceBasis:adjusted })).toBeNull();
  });

  it('checks history equality and revalidates corrected data even when the price mode is unchanged', () => {
    expect(scannerHistoryMatchesChart(bars, bars.map(bar => ({ ...bar })))).toBe(true);
    expect(scannerHistoryMatchesChart(bars, bars.slice(1))).toBe(false);
    const corrected = bars.map(bar => ({ ...bar, open:100, high:101, low:99, close:100 }));
    expect(scannerHistoryMatchesChart(bars, corrected)).toBe(false);
    expect(resolveScannerOverlayPriceBasis(overlay, { instrument, bars:corrected, priceBasis:RAW_SCANNER_PRICE_BASIS, databasePath:'A' })).toBeNull();
  });

  it('preserves core scanner label-only rows on adjusted charts', () => {
    const labelOnly = { ...overlay, scannerId:'core-scanner', geometry:undefined, levels:[] };
    expect(resolveScannerOverlayPriceBasis(labelOnly, { instrument, bars, priceBasis:adjusted, databasePath:'A' })).toBe(labelOnly);
  });

  it('requires a fresh toolbar scan when the chart timeframe changes', () => {
    expect(resolveScannerOverlayPriceBasis({ ...overlay, timeframe:'D' }, {
      instrument, bars, priceBasis:RAW_SCANNER_PRICE_BASIS, databasePath:'A', timeframe:'W',
    })).toBeNull();
  });
});

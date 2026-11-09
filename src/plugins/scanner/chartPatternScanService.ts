import type { DesktopApi, InstrumentKey } from '@/platform';
import { mapEodRowsToScannerBars, type EodBar } from '@/plugins/scanner/types';
import { sameScannerPriceBasis, type ScannerChartPriceBasis } from './scannerChartPriceBasis';
import type { OHLCBar } from '@/engine/types';

export function scannerHistoryMatchesChart(bars: EodBar[], chartBars: OHLCBar[]): boolean {
  return bars.length === chartBars.length && bars.every((bar, index) => {
    const chart = chartBars[index];
    return bar.date === chart.date && bar.open === chart.open && bar.high === chart.high &&
      bar.low === chart.low && bar.close === chart.close && bar.volume === chart.volume;
  });
}

export async function loadCompleteChartHistory(
  api: Pick<DesktopApi, 'getEodData'>,
  instrument: InstrumentKey,
  options?: ScannerChartPriceBasis & { databasePath?: string | null },
): Promise<EodBar[]> {
  const result = await api.getEodData({
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    ...options,
  });
  if (options && !sameScannerPriceBasis(result, options)) {
    throw new Error('Chart-pattern history returned a different price basis. Reload the chart and retry.');
  }
  const symbol = result.instrument?.symbol ?? result.requestedSymbol ?? instrument.symbol;
  return mapEodRowsToScannerBars(symbol, result.bars, null);
}

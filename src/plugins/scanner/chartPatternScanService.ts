import type { DesktopApi, InstrumentKey } from '@/platform';
import { mapEodRowsToScannerBars, type EodBar } from '@/plugins/scanner/types';

export async function loadCompleteChartHistory(
  api: Pick<DesktopApi, 'getEodData'>,
  instrument: InstrumentKey,
): Promise<EodBar[]> {
  const result = await api.getEodData({
    symbol: instrument.symbol,
    exchange: instrument.exchange,
  });
  const symbol = result.instrument?.symbol ?? result.requestedSymbol ?? instrument.symbol;
  return mapEodRowsToScannerBars(symbol, result.bars, null);
}

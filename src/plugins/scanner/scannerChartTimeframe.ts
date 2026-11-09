import type { OHLCBar } from '@/engine/types';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';
import { aggregateBars } from '@/features/charts/chartDataUtils';
import type { EodBar } from './types';

// Match the chart's calendar buckets, while keeping detectors on real OHLCV
// rather than transformed Heikin-Ashi or Renko display candles.
export function buildScannerTimeframeBars(symbol: string, bars: OHLCBar[], timeframe: WorkspaceTimeframe): EodBar[] {
  return aggregateBars(bars, timeframe).map(bar => ({
    symbol, date:bar.date, open:bar.open, high:bar.high, low:bar.low, close:bar.close, volume:bar.volume,
  }));
}

import type { EodRow, InstrumentKey } from '@/platform';
import type { EodAlertRule, EodAlertTrigger } from '@/features/alerts/eodAlerts';
import type { ChartPatternMetadata, ChartPatternResultDetails } from '@/plugins/scanner/chartPatternTypes';

export type ScannerDirection = 'bullish' | 'bearish' | 'neutral';
export type ScannerPriority = 1 | 2 | 3;
export type ScannerType = 'breakout' | 'breakdown' | 'pattern' | 'volatility' | 'gap';
export type ScannerDataRequirement = 'ohlcv';

export interface EodBar {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScannerContext {
  symbol: string;
  exchange: string;
  bars: EodBar[];
  instrument?: InstrumentKey | null;
}

export interface ScannerDefinition {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  priority: ScannerPriority;
  scannerType: ScannerType;
  description: string;
  logicText: string;
  requiredData: ScannerDataRequirement[];
  suggestedOutputColumns: string[];
  chartPattern?: ChartPatternMetadata;
  eodSafetyNotes?: string;
  limitations?: string;
  implementationStatus: 'ready_for_engine';
}

export interface ScannerResult {
  symbol: string;
  exchange: string;
  scannerId: string;
  scannerName: string;
  categoryId: string;
  categoryName: string;
  date: string;
  matched: boolean;
  direction?: ScannerDirection;
  score?: number;
  reasons?: string[];
  values?: Record<string, number | string | boolean | null>;
  chartPattern?: ChartPatternResultDetails;
  warnings?: string[];
  source?: string;
  history?: ScannerResultHistory;
  generatedAt: string;
}

export interface ScannerResultHistory {
  firstMatchedDate: string;
  lastMatchedDate: string;
  matchCount: number;
}

export type ScannerHandler = (
  context: ScannerContext,
  definition: ScannerDefinition,
) => ScannerResult | null;

export interface ScannerRunTarget extends InstrumentKey {
  name?: string | null;
}

export interface ScannerRunRequest {
  targets: ScannerRunTarget[];
  scannerIds: string[];
  lookbackBars: number | null;
  evaluateHistory?: boolean;
  executionMode?: 'responsive' | 'fast';
  toDate?: string | null;
  alertRules?: EodAlertRule[];
  signalRules?: import('@/engine/types').ChartSignalRule[];
  shouldCancel?: () => boolean;
  onProgress?: (progress: {
    completed: number;
    total: number;
    symbol: string;
    exchange: string;
    historyCompleted?: number;
    historyTotal?: number;
    resultCount?: number;
  }) => void;
  onResultChunk?: (results: ScannerResult[]) => void;
}

export interface ScannerRunOutput {
  results: ScannerResult[];
  alertTriggers: EodAlertTrigger[];
  errors: string[];
  scannedSymbols: number;
  cancelled: boolean;
}

export function mapEodRowsToScannerBars(
  symbol: string,
  rows: EodRow[],
  lookbackBars: number | null,
): EodBar[] {
  const orderedBars = rows
    .map((row) => ({
      symbol,
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return lookbackBars === null ? orderedBars : orderedBars.slice(-Math.max(2, lookbackBars));
}

import type { ChartEventMarker, InstrumentKey, SymbolExchangeFilter } from '@/platform';

export type MarketMoversTab = 'gainers' | 'losers' | 'volume';
export type MoverUniverseId = 'all-equity';

export type CorporateActionStatus =
  | 'none'
  | 'adjusted-event'
  | 'unadjusted-event'
  | 'unexplained-extreme-move';

export interface NormalizedMoverRecord {
  symbol: string;
  exchange: string;
  tradingDate: string;
  close: number;
  previousClose: number;
  absoluteChange: number;
  changePercent: number;
  volume: number;
  averageVolume20: number | null;
  volumeRatio20: number | null;
  corporateActionStatus: CorporateActionStatus;
  corporateActionEvents: ChartEventMarker[];
  corporateActionAdjusted: boolean;
  corporateActionWarning: string | null;
  instrument: InstrumentKey;
}

export interface MarketMoversSnapshot {
  asOfDate: string | null;
  latestDatabaseDate: string | null;
  commonDateSymbolCount: number;
  commonDateCoveragePercent: number;
  coverageWarning: string | null;
  incompleteUniverseWarning: string | null;
  databaseIdentity: string;
  databaseRevision: string;
  exchange: SymbolExchangeFilter;
  universeId: MoverUniverseId;
  generatedAt: string;
  gainers: NormalizedMoverRecord[];
  losers: NormalizedMoverRecord[];
  volumeSurge: NormalizedMoverRecord[];
  targetSymbolCount: number;
  fetchedSymbolCount: number;
  failedSymbolCount: number;
  insufficientHistoryCount: number;
  staleSymbolCount: number;
  filteredOutSymbolCount: number;
  qualifyingSymbolCount: number;
  excludedSymbolCount: number;
  exclusionReasonCounts: Record<string, number>;
  fetchFailureMessages: string[];
}

export interface MarketMoversFilterSettings {
  exchange: SymbolExchangeFilter;
  universeId: MoverUniverseId;
  resultCount: 5 | 10 | 20;
  minPrice: number;
  minVolume: number;
  excludeCorporateActionWarnings: boolean;
}

export type MarketMoversStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'stale' | 'error';

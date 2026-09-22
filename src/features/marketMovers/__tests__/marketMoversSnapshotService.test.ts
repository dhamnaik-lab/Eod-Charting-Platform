import { describe, expect, it } from 'vitest';
import type {
  ChartEventMarker,
  DailyMarketSnapshotResult,
  DailyMarketSnapshotSymbol,
  EodRow,
} from '@/platform';
import { buildMarketMoversSnapshot, selectCommonAsOfDate } from '../marketMoversSnapshotService';
import type { MarketMoversFilterSettings } from '../marketMoversTypes';

const SETTINGS: MarketMoversFilterSettings = {
  exchange: 'NSE',
  universeId: 'all-equity',
  resultCount: 10,
  minPrice: 10,
  minVolume: 100,
  excludeCorporateActionWarnings: false,
};

function rows(previousClose: number, close: number, date = '2026-08-03', volumes?: number[]): EodRow[] {
  const history = volumes?.map((volume, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    open: previousClose,
    high: previousClose,
    low: previousClose,
    close: previousClose,
    volume,
  })) ?? [];
  return [
    ...history,
    { date: '2026-08-02', open: previousClose, high: previousClose, low: previousClose, close: previousClose, volume: 1_000 },
    { date, open: close, high: close, low: close, close, volume: volumes ? 5_000 : 1_000 },
  ];
}

function symbol(
  symbolName: string,
  data: EodRow[],
  options?: {
    exchange?: string;
    adjusted?: boolean;
    includeRightsAdjustments?: boolean;
    includeDividendAdjustments?: boolean;
    events?: ChartEventMarker[];
  },
): DailyMarketSnapshotSymbol {
  return {
    instrument: { symbol: symbolName, exchange: options?.exchange ?? 'NSE' },
    bars: data,
    adjusted: options?.adjusted ?? true,
    includeRightsAdjustments: options?.includeRightsAdjustments ?? false,
    includeDividendAdjustments: options?.includeDividendAdjustments ?? false,
    events: options?.events ?? [],
  };
}

function batch(symbols: DailyMarketSnapshotSymbol[], failures = 0): DailyMarketSnapshotResult {
  return {
    requestId: 'test-request',
    databaseIdentity: 'test-db',
    databaseRevision: 'rev-1',
    latestDatabaseDate: '2026-08-03',
    targetSymbolCount: symbols.length + failures,
    fetchedSymbolCount: symbols.length,
    failedSymbolCount: failures,
    symbols,
    failures: Array.from({ length: failures }, (_, index) => ({
      symbol: `FAIL${index}`,
      exchange: 'NSE',
      error: 'read failed',
    })),
  };
}

describe('marketMoversSnapshotService', () => {
  it('selects the modal common date and uses latest date only as tie-breaker', () => {
    expect(
      selectCommonAsOfDate([
        { bars: [{ date: '2026-08-03' }] },
        { bars: [{ date: '2026-08-03' }] },
        { bars: [{ date: '2029-01-01' }] },
      ]),
    ).toBe('2026-08-03');
    expect(
      selectCommonAsOfDate([
        { bars: [{ date: '2026-08-02' }] },
        { bars: [{ date: '2026-08-03' }] },
      ]),
    ).toBe('2026-08-03');
  });

  it('excludes stale symbols and reports common-date coverage', async () => {
    const snapshot = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('CURRENT', rows(100, 105)),
        symbol('STALE', rows(100, 105, '2026-08-01')),
      ]),
      settings: SETTINGS,
    });
    expect(snapshot.asOfDate).toBe('2026-08-03');
    expect(snapshot.staleSymbolCount).toBe(1);
    expect(snapshot.qualifyingSymbolCount).toBe(1);
    expect(snapshot.commonDateCoveragePercent).toBe(50);
  });

  it('sorts gainers and losers deterministically across exchanges', async () => {
    const snapshot = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('AAA', rows(100, 110), { exchange: 'NSE' }),
        symbol('AAA', rows(100, 110), { exchange: 'BSE' }),
        symbol('GAIN', rows(100, 120)),
        symbol('LOSS5', rows(100, 95)),
        symbol('LOSS20', rows(100, 80)),
      ]),
      settings: { ...SETTINGS, exchange: 'all' },
    });
    expect(snapshot.gainers.map((record) => `${record.exchange}:${record.symbol}`)).toEqual([
      'NSE:GAIN',
      'BSE:AAA',
      'NSE:AAA',
    ]);
    expect(snapshot.losers.map((record) => record.symbol)).toEqual(['LOSS20', 'LOSS5']);
  });

  it('sorts volume surge by 20-session ratio', async () => {
    const prior20 = Array.from({ length: 20 }, () => 1_000);
    const snapshot = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('VOL_A', rows(100, 105, '2026-08-03', prior20)),
        symbol('VOL_B', [
          ...rows(100, 105, '2026-08-03', prior20).slice(0, -1),
          { date: '2026-08-03', open: 105, high: 105, low: 105, close: 105, volume: 8_000 },
        ]),
      ]),
      settings: SETTINGS,
    });
    expect(snapshot.volumeSurge.map((record) => record.symbol)).toEqual(['VOL_B', 'VOL_A']);
  });

  it('rejects zero previous close, non-finite values, negative volume and insufficient history', async () => {
    const snapshot = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('ZERO', rows(0, 10)),
        symbol('NAN', rows(100, Number.NaN)),
        symbol('NEG_VOLUME', [
          { date: '2026-08-02', open: 100, high: 100, low: 100, close: 100, volume: 1_000 },
          { date: '2026-08-03', open: 100, high: 100, low: 100, close: 101, volume: -1 },
        ]),
        symbol('SHORT', [{ date: '2026-08-03', open: 1, high: 1, low: 1, close: 1, volume: 1_000 }]),
      ]),
      settings: { ...SETTINGS, minPrice: 0, minVolume: 0 },
    });
    expect(snapshot.qualifyingSymbolCount).toBe(0);
    expect(snapshot.insufficientHistoryCount).toBe(1);
    expect(snapshot.exclusionReasonCounts.invalidMetrics).toBe(3);
  });

  it('classifies action types using their specific adjustment switches', async () => {
    const rightsEvent: ChartEventMarker = {
      id: 'R1',
      effectiveDate: '2026-08-03',
      type: 'RIGHTS',
      label: 'R',
      description: 'Rights',
    };
    const adjustedRights = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('RIGHTS_OK', rows(100, 90), {
          adjusted: true,
          includeRightsAdjustments: true,
          events: [rightsEvent],
        }),
      ]),
      settings: SETTINGS,
    });
    expect(adjustedRights.losers[0].corporateActionStatus).toBe('adjusted-event');

    const unadjustedRights = await buildMarketMoversSnapshot({
      batch: batch([
        symbol('RIGHTS_WARN', rows(100, 90), {
          adjusted: true,
          includeRightsAdjustments: false,
          events: [rightsEvent],
        }),
      ]),
      settings: SETTINGS,
    });
    expect(unadjustedRights.losers[0].corporateActionStatus).toBe('unadjusted-event');
    expect(unadjustedRights.losers[0].corporateActionWarning).toContain('RIGHTS');
  });

  it('flags unexplained extreme moves and can exclude warned records', async () => {
    const source = batch([symbol('EXTREME', rows(100, 160))]);
    const included = await buildMarketMoversSnapshot({ batch: source, settings: SETTINGS });
    expect(included.gainers[0].corporateActionStatus).toBe('unexplained-extreme-move');
    const excluded = await buildMarketMoversSnapshot({
      batch: source,
      settings: { ...SETTINGS, excludeCorporateActionWarnings: true },
    });
    expect(excluded.qualifyingSymbolCount).toBe(0);
    expect(excluded.exclusionReasonCounts.corporateActionWarning).toBe(1);
  });

  it('accounts for backend failures and preserves bounded failure details', async () => {
    const snapshot = await buildMarketMoversSnapshot({
      batch: batch([symbol('OK', rows(100, 101))], 2),
      settings: SETTINGS,
    });
    expect(snapshot.targetSymbolCount).toBe(3);
    expect(snapshot.fetchedSymbolCount).toBe(1);
    expect(snapshot.failedSymbolCount).toBe(2);
    expect(snapshot.fetchFailureMessages).toHaveLength(2);
  });

  it('marks a snapshot stale when the common date trails the backend market date', async () => {
    const source = batch([symbol('OLD', rows(100, 101, '2026-08-02'))]);
    source.latestDatabaseDate = '2026-08-03';
    const snapshot = await buildMarketMoversSnapshot({ batch: source, settings: SETTINGS });
    expect(snapshot.coverageWarning).toContain('trails database date');
  });
});

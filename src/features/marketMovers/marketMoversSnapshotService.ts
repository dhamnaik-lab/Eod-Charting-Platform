import type {
  ChartEventMarker,
  DailyMarketSnapshotResult,
  DailyMarketSnapshotSymbol,
} from '@/platform';
import { calculateDailyMarketMetrics } from '@/plugins/scanner/dailyMarketScanners';
import { mapEodRowsToScannerBars, type EodBar } from '@/plugins/scanner/types';
import type {
  CorporateActionStatus,
  MarketMoversFilterSettings,
  MarketMoversSnapshot,
  NormalizedMoverRecord,
} from './marketMoversTypes';

export interface BuildSnapshotOptions {
  batch: DailyMarketSnapshotResult;
  settings: MarketMoversFilterSettings;
  shouldCancel?: () => boolean;
}

export function selectCommonAsOfDate(
  symbolData: ReadonlyArray<{ bars: ReadonlyArray<{ date: string }> }>,
): string | null {
  const frequencies = new Map<string, number>();
  for (const item of symbolData) {
    const latestDate = item.bars[item.bars.length - 1]?.date;
    if (latestDate) frequencies.set(latestDate, (frequencies.get(latestDate) ?? 0) + 1);
  }
  return [...frequencies.entries()]
    .sort(([dateA, countA], [dateB, countB]) => countB - countA || dateB.localeCompare(dateA))[0]?.[0] ?? null;
}

function eventWasAdjusted(symbol: DailyMarketSnapshotSymbol, event: ChartEventMarker): boolean {
  if (!symbol.adjusted) return false;
  if (event.type === 'RIGHTS') return symbol.includeRightsAdjustments;
  if (event.type === 'DIVIDEND') return symbol.includeDividendAdjustments;
  return event.type === 'SPLIT' || event.type === 'BONUS' || event.type === 'DEMERGER';
}

function classifyCorporateAction(
  symbol: DailyMarketSnapshotSymbol,
  previousDate: string,
  latestDate: string,
  changePercent: number,
): {
  status: CorporateActionStatus;
  events: ChartEventMarker[];
  warning: string | null;
  adjusted: boolean;
} {
  const relevant = symbol.events.filter(
    (event) =>
      ['SPLIT', 'BONUS', 'DEMERGER', 'RIGHTS', 'DIVIDEND'].includes(event.type) &&
      event.effectiveDate > previousDate &&
      event.effectiveDate <= latestDate,
  );

  if (relevant.length > 0) {
    const unadjusted = relevant.filter((event) => !eventWasAdjusted(symbol, event));
    if (unadjusted.length > 0) {
      return {
        status: 'unadjusted-event',
        events: relevant,
        adjusted: false,
        warning: `Unadjusted corporate action: ${unadjusted.map((event) => event.type).join(', ')}.`,
      };
    }
    return { status: 'adjusted-event', events: relevant, warning: null, adjusted: true };
  }

  if (Math.abs(changePercent) >= 50) {
    return {
      status: 'unexplained-extreme-move',
      events: [],
      adjusted: symbol.adjusted,
      warning: `Extreme price move (${changePercent.toFixed(1)}%) with no registered corporate action event.`,
    };
  }

  return { status: 'none', events: [], warning: null, adjusted: symbol.adjusted };
}

export async function buildMarketMoversSnapshot(
  options: BuildSnapshotOptions,
): Promise<MarketMoversSnapshot> {
  const { batch, settings, shouldCancel } = options;
  const mapped = batch.symbols.map((symbol) => ({
    source: symbol,
    bars: mapEodRowsToScannerBars(symbol.instrument.symbol, symbol.bars, 30),
  }));

  const exclusionReasonCounts: Record<string, number> = {
    insufficientHistory: 0,
    staleDate: 0,
    minPrice: 0,
    minVolume: 0,
    invalidMetrics: 0,
    corporateActionWarning: 0,
  };

  const usable = mapped.filter((item) => {
    if (item.bars.length >= 2) return true;
    exclusionReasonCounts.insufficientHistory += 1;
    return false;
  });
  const insufficientHistoryCount = exclusionReasonCounts.insufficientHistory;
  const asOfDate = selectCommonAsOfDate(usable);
  const commonDateSymbolCount = asOfDate
    ? usable.filter((item) => item.bars[item.bars.length - 1]?.date === asOfDate).length
    : 0;
  const commonDateCoveragePercent =
    batch.fetchedSymbolCount > 0 ? (commonDateSymbolCount / batch.fetchedSymbolCount) * 100 : 0;

  const warnings: string[] = [];
  if (commonDateCoveragePercent < 60 && batch.fetchedSymbolCount > 0) {
    warnings.push(`Low common-date coverage (${commonDateCoveragePercent.toFixed(1)}%).`);
  }
  if (asOfDate && batch.latestDatabaseDate && asOfDate < batch.latestDatabaseDate) {
    warnings.push(`Common market date ${asOfDate} trails database date ${batch.latestDatabaseDate}.`);
  }

  const records: NormalizedMoverRecord[] = [];
  let staleSymbolCount = 0;
  let filteredOutSymbolCount = 0;

  for (let index = 0; index < usable.length; index += 1) {
    if (index % 128 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (shouldCancel?.()) throw new Error('Market movers snapshot calculation cancelled.');
    const item = usable[index];
    const latest = item.bars[item.bars.length - 1];
    const previous = item.bars[item.bars.length - 2];
    if (!asOfDate || latest.date !== asOfDate) {
      staleSymbolCount += 1;
      exclusionReasonCounts.staleDate += 1;
      continue;
    }

    const metrics = calculateDailyMarketMetrics(item.bars as EodBar[]);
    if (!metrics) {
      filteredOutSymbolCount += 1;
      exclusionReasonCounts.invalidMetrics += 1;
      continue;
    }
    if (metrics.today.close < settings.minPrice) {
      filteredOutSymbolCount += 1;
      exclusionReasonCounts.minPrice += 1;
      continue;
    }
    if (metrics.today.volume < settings.minVolume) {
      filteredOutSymbolCount += 1;
      exclusionReasonCounts.minVolume += 1;
      continue;
    }

    const corporateAction = classifyCorporateAction(
      item.source,
      previous.date,
      latest.date,
      metrics.changePercent,
    );
    if (settings.excludeCorporateActionWarnings && corporateAction.warning) {
      filteredOutSymbolCount += 1;
      exclusionReasonCounts.corporateActionWarning += 1;
      continue;
    }

    records.push({
      symbol: item.source.instrument.symbol,
      exchange: item.source.instrument.exchange,
      tradingDate: metrics.today.date,
      close: metrics.today.close,
      previousClose: metrics.yesterday.close,
      absoluteChange: metrics.absoluteChange,
      changePercent: metrics.changePercent,
      volume: metrics.today.volume,
      averageVolume20: metrics.averageVolume20,
      volumeRatio20: metrics.volumeRatio20,
      corporateActionStatus: corporateAction.status,
      corporateActionEvents: corporateAction.events,
      corporateActionAdjusted: corporateAction.adjusted,
      corporateActionWarning: corporateAction.warning,
      instrument: {
        symbol: item.source.instrument.symbol,
        exchange: item.source.instrument.exchange,
      },
    });
  }

  const stableIdentity = (a: NormalizedMoverRecord, b: NormalizedMoverRecord) =>
    a.exchange.localeCompare(b.exchange) || a.symbol.localeCompare(b.symbol);
  const gainers = records
    .filter((record) => record.changePercent > 0)
    .sort(
      (a, b) =>
        b.changePercent - a.changePercent ||
        b.absoluteChange - a.absoluteChange ||
        b.volume - a.volume ||
        stableIdentity(a, b),
    );
  const losers = records
    .filter((record) => record.changePercent < 0)
    .sort(
      (a, b) =>
        a.changePercent - b.changePercent ||
        Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange) ||
        b.volume - a.volume ||
        stableIdentity(a, b),
    );
  const volumeSurge = records
    .filter((record) => record.volumeRatio20 !== null && record.volumeRatio20 >= 1.5)
    .sort(
      (a, b) =>
        (b.volumeRatio20 ?? 0) - (a.volumeRatio20 ?? 0) ||
        b.volume - a.volume ||
        Math.abs(b.changePercent) - Math.abs(a.changePercent) ||
        stableIdentity(a, b),
    );

  const excludedSymbolCount = insufficientHistoryCount + staleSymbolCount + filteredOutSymbolCount;
  return {
    asOfDate,
    latestDatabaseDate: batch.latestDatabaseDate,
    commonDateSymbolCount,
    commonDateCoveragePercent,
    coverageWarning: warnings.length > 0 ? warnings.join(' ') : null,
    incompleteUniverseWarning:
      batch.targetSymbolCount >= 50_000
        ? 'Universe reached the backend safety limit and may be incomplete.'
        : null,
    databaseIdentity: batch.databaseIdentity,
    databaseRevision: batch.databaseRevision,
    exchange: settings.exchange,
    universeId: settings.universeId,
    generatedAt: new Date().toISOString(),
    gainers,
    losers,
    volumeSurge,
    targetSymbolCount: batch.targetSymbolCount,
    fetchedSymbolCount: batch.fetchedSymbolCount,
    failedSymbolCount: batch.failedSymbolCount,
    insufficientHistoryCount,
    staleSymbolCount,
    filteredOutSymbolCount,
    qualifyingSymbolCount: records.length,
    excludedSymbolCount,
    exclusionReasonCounts,
    fetchFailureMessages: batch.failures.slice(0, 20).map(
      (failure) => `${failure.exchange}:${failure.symbol}: ${failure.error}`,
    ),
  };
}

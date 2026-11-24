import type { OHLCBar } from '@/engine/types';
import { prepareScannerFormula } from '@/modules/formulaEngine/customFormulaEngine';
import type { InstrumentKey } from '@/platform';
import type { DesktopApi, EodDataResult } from '@/platform';
import {
  evaluateDrawingEodAlertRules,
  evaluateIndicatorEodAlertRules,
  evaluatePriceEodAlertRules,
  evaluateScannerMatchEodAlertRules,
} from '@/features/alerts/eodAlerts';
import {
  mapEodRowsToScannerBars,
  type ScannerContext,
  type ScannerDefinition,
  type ScannerResult,
  type ScannerRunOutput,
  type ScannerRunRequest,
} from '@/plugins/scanner/types';
import { chartPatternScannerDefinitions } from '@/features/chartPatterns';
import type { ChartPatternEvaluationOutput } from '@/features/chartPatterns/evaluation';
import { createChartPatternEvaluationExecutor } from '@/features/chartPatterns/workerClient';
import { coreOhlcvScannerDefinitions, runCoreScanner } from '@/plugins/scanner/coreOhlcvScanners';
import { dailyMarketScannerDefinitions, runDailyMarketScanner } from '@/plugins/scanner/dailyMarketScanners';
import { evaluateSignalScannerDefinitions } from '@/plugins/scanner/signalScanners';
import { pluginHost } from '@/plugins/hostRuntime';
import { DEFAULT_LOOKBACK_BARS, DEFAULT_MAX_SYMBOLS, MIN_LOOKBACK_BARS } from '@/plugins/scanner/scannerRunConfig';

export async function runCoreEodScannerBatch(
  api: Pick<DesktopApi, 'getEodData'>,
  request: ScannerRunRequest,
): Promise<ScannerRunOutput> {
  const scannerIds = new Set(request.scannerIds);
  const dailyMarketDefinitions = dailyMarketScannerDefinitions.filter((definition) => scannerIds.has(definition.id));
  const coreDefinitions = [
    ...dailyMarketDefinitions,
    ...coreOhlcvScannerDefinitions.filter((definition) => scannerIds.has(definition.id)),
  ];
  const chartPatternDefinitions = chartPatternScannerDefinitions.filter((definition) => scannerIds.has(definition.id));
  const alertRules = request.alertRules ?? [];
  const results: ScannerRunOutput['results'] = [];
  const currentEndpointResults: ScannerResult[] = [];
  const alertTriggers: ScannerRunOutput['alertTriggers'] = [];
  const errors: string[] = [];
  let scannedSymbols = 0;
  let cancelled = false;
  const chartPatternExecutor = chartPatternDefinitions.length > 0 ? createChartPatternEvaluationExecutor() : null;

  try {
    for (const target of request.targets) {
      if (request.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const resultStart = results.length;
      try {
        const data = await api.getEodData({
          symbol: target.symbol,
          exchange: target.exchange,
          to: request.toDate || undefined,
        });
        const bars = mapResultToContextBars(data, request.lookbackBars);
        if (bars.length < 2) {
          errors.push(`${target.exchange}:${target.symbol} has fewer than 2 completed bars.`);
          continue;
        }

        const context = {
          symbol: target.symbol,
          exchange: target.exchange,
          instrument: target,
          bars,
        };

        alertTriggers.push(...evaluatePriceEodAlertRules(alertRules, context));
        alertTriggers.push(...evaluateIndicatorEodAlertRules(alertRules, context));
        alertTriggers.push(...evaluateDrawingEodAlertRules(alertRules, context));

        const coreResults = evaluateCoreScannerDefinitions(context, coreDefinitions);
        results.push(...coreResults);
        currentEndpointResults.push(...coreResults);

        const signalResults = evaluateSignalScannerDefinitions(context, request.scannerIds, request.signalRules);
        results.push(...signalResults);
        currentEndpointResults.push(...signalResults);

        const dynamicScanners = pluginHost.listRegisteredScanners().filter((s) => scannerIds.has(s.id));
        for (const dynScanner of dynamicScanners) {
          try {
            const match = dynScanner.evaluate(bars, { symbol: target.symbol, exchange: target.exchange });
            if (match?.matched) {
              const dynResult: ScannerResult = {
                symbol: target.symbol,
                exchange: target.exchange,
                scannerId: dynScanner.id,
                scannerName: dynScanner.name,
                categoryId: 'external_plugins',
                categoryName: dynScanner.categoryName || 'External Plugins',
                date: bars[bars.length - 1]!.date,
                matched: true,
                direction: match.direction ?? 'neutral',
                score: match.score,
                reasons: match.reasons ?? [],
                values: match.values ?? {},
                generatedAt: new Date().toISOString(),
              };
              results.push(dynResult);
              currentEndpointResults.push(dynResult);
            }
          } catch {
            // Isolate external scanner errors
          }
        }

        if (chartPatternExecutor) {
          const cancellationMonitor = setInterval(() => {
            if (request.shouldCancel?.()) {
              chartPatternExecutor.cancel();
            }
          }, 50);
          let chartPatternOutput: ChartPatternEvaluationOutput;
          try {
            chartPatternOutput = await chartPatternExecutor.evaluate({
              target,
              bars,
              scannerIds: request.scannerIds,
              evaluateHistory: request.evaluateHistory === true,
              executionMode: request.executionMode ?? 'responsive',
              shouldCancel: request.shouldCancel,
              onProgress: ({ completed: historyCompleted, total: historyTotal, resultCount }) =>
                request.onProgress?.({
                  completed: scannedSymbols + 1,
                  total: request.targets.length,
                  symbol: target.symbol,
                  exchange: target.exchange,
                  historyCompleted,
                  historyTotal,
                  resultCount: results.length + resultCount,
                }),
            });
          } finally {
            clearInterval(cancellationMonitor);
          }
          currentEndpointResults.push(...chartPatternOutput.latestResults);
          results.push(...(request.evaluateHistory ? chartPatternOutput.historicalResults : chartPatternOutput.latestResults));
          if (chartPatternOutput.cancelled) {
            cancelled = true;
            break;
          }
        }
      } catch (error) {
        errors.push(`${target.exchange}:${target.symbol}: ${error instanceof Error ? error.message : 'Scan failed.'}`);
      } finally {
        const symbolResults = results.slice(resultStart);
        if (symbolResults.length > 0) {
          request.onResultChunk?.(symbolResults);
        }
        scannedSymbols += 1;
        request.onProgress?.({
          completed: scannedSymbols,
          total: request.targets.length,
          symbol: target.symbol,
          exchange: target.exchange,
          resultCount: results.length,
        });
        if (scannedSymbols % 8 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    }
  } finally {
    chartPatternExecutor?.dispose();
  }

  alertTriggers.push(...evaluateScannerMatchEodAlertRules(alertRules, currentEndpointResults));
  results.sort((first, second) => second.date.localeCompare(first.date) || first.scannerName.localeCompare(second.scannerName));

  return {
    results,
    alertTriggers,
    errors,
    scannedSymbols,
    cancelled,
  };
}

function evaluateCoreScannerDefinitions(
  context: ScannerContext,
  definitions: ScannerDefinition[],
): ScannerResult[] {
  return definitions.flatMap((definition) => {
    const result = runDailyMarketScanner(context, definition) ?? runCoreScanner(context, definition);
    return result?.matched ? [result] : [];
  });
}

function mapResultToContextBars(result: EodDataResult, lookbackBars: number | null) {
  const symbol = result.instrument?.symbol ?? result.requestedSymbol;
  return mapEodRowsToScannerBars(symbol, result.bars, lookbackBars);
}


export const CUSTOM_FORMULA_SCANNER_ID = 'custom_formula';
export const FORMULA_LOOKBACK_MAX = DEFAULT_LOOKBACK_BARS;
export const FORMULA_TARGET_LIMIT = DEFAULT_MAX_SYMBOLS;

export interface FormulaScannerRunRequest {
  formula: string;
  formulaName?: string;
  predicate: string;
  targets: InstrumentKey[];
  databasePath: string;
  toDate?: string;
  lookbackBars: number;
  shouldCancel?: () => boolean;
  onProgress?: ScannerRunRequest['onProgress'];
}

export interface FormulaScannerRunOutput {
  results: ScannerResult[];
  counts: { matched: number; false: number; unavailable: number; failed: number };
  cancelled: boolean;
  errors: string[];
}

export function formulaScannerMarketDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
}

export async function runCustomFormulaScannerBatch(
  api: Pick<DesktopApi, 'getEodData'>,
  request: FormulaScannerRunRequest,
): Promise<FormulaScannerRunOutput> {
  const program = prepareScannerFormula(request.formula);
  const predicate = program.predicates.find((name) => name.toLowerCase() === request.predicate.toLowerCase());
  if (!predicate) {
    throw new Error('Select a named bar-by-bar boolean assignment from the checked formula.');
  }
  if (!request.databasePath) {
    throw new Error('Open a database before running a formula scan.');
  }
  const { lookbackBars } = request;
  if (!Number.isInteger(lookbackBars) || lookbackBars < MIN_LOOKBACK_BARS || lookbackBars > FORMULA_LOOKBACK_MAX) {
    throw new Error(`Enter a lookback of ${MIN_LOOKBACK_BARS}–${FORMULA_LOOKBACK_MAX} bars.`);
  }
  const targets = [...new Map(request.targets.map((target) => [`${target.exchange}:${target.symbol}`, target])).values()];
  if (targets.length === 0 || targets.length > FORMULA_TARGET_LIMIT) {
    throw new Error(`Select 1–${FORMULA_TARGET_LIMIT} distinct symbols for the formula scan.`);
  }

  const now = new Date();
  const marketDate = formulaScannerMarketDate(now);
  const cutoff = request.toDate || marketDate;
  const parsedCutoff = new Date(cutoff + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !Number.isFinite(parsedCutoff.getTime()) ||
    parsedCutoff.toISOString().slice(0, 10) !== cutoff || cutoff > marketDate) {
    throw new Error('Choose a cutoff on or before the current market date.');
  }

  const output: FormulaScannerRunOutput = {
    results: [],
    counts: { matched: 0, false: 0, unavailable: 0, failed: 0 },
    cancelled: false,
    errors: [],
  };
  const formulaName = request.formulaName?.trim() || 'Custom Formula';
  const generatedAt = now.toISOString();

  for (const [index, target] of targets.entries()) {
    if (request.shouldCancel?.()) {
      output.cancelled = true;
      break;
    }
    try {
      const data = await api.getEodData({
        symbol: target.symbol,
        exchange: target.exchange,
        to: cutoff,
        adjusted: false,
        resolveIdentity: false,
        databasePath: request.databasePath,
      });
      if (request.shouldCancel?.()) {
        output.cancelled = true;
        break;
      }

      const bars = mapEodRowsToScannerBars(target.symbol, data.bars.filter(({ date }) => date <= cutoff), lookbackBars);
      const ohlcBars: OHLCBar[] = bars.map((bar) => ({
        ...bar,
        timestamp: new Date(bar.date).getTime(),
      }));
      const match = program.evaluateLatest(predicate, ohlcBars);
      if (match === true) {
        output.counts.matched += 1;
        output.results.push({
          symbol: target.symbol,
          exchange: target.exchange,
          scannerId: CUSTOM_FORMULA_SCANNER_ID,
          scannerName: formulaName,
          categoryId: CUSTOM_FORMULA_SCANNER_ID,
          categoryName: 'Custom Formula',
          matched: true,
          direction: 'neutral',
          date: ohlcBars[ohlcBars.length - 1].date,
          values: { predicate },
          generatedAt,
        });
      } else {
        output.counts[match === false ? 'false' : 'unavailable'] += 1;
      }
    } catch (err) {
      if (request.shouldCancel?.()) {
        output.cancelled = true;
        break;
      }
      output.counts.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      output.errors.push(`${target.exchange}:${target.symbol}: ${message}`);
    }
    request.onProgress?.({ ...target, completed: index + 1, total: targets.length, resultCount: output.results.length });
    if (index + 1 < targets.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return output;
}

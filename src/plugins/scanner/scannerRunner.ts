import type { OHLCBar } from '@/engine/types';
import { evaluateCustomFormulaDefinition } from '@/modules/formulaEngine/customFormulaEngine';
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


export async function runCustomFormulaScannerBatch(
  api: Pick<DesktopApi, 'getEodData'>,
  request: {
    formula: string;
    formulaName?: string;
    targets: InstrumentKey[];
    toDate?: string;
    lookbackBars?: number;
  }
): Promise<ScannerRunOutput> {
  const formulaName = request.formulaName || 'Custom Formula';
  const results: ScannerRunOutput['results'] = [];
  const errors: string[] = [];
  let scannedSymbols = 0;
  const now = new Date().toISOString();

  for (const target of request.targets) {
    try {
      const data = await api.getEodData({
        symbol: target.symbol,
        exchange: target.exchange,
        to: request.toDate || undefined,
      });
      scannedSymbols += 1;
      if (scannedSymbols % 8 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      const bars = mapResultToContextBars(data, request.lookbackBars ?? null);
      if (bars.length < 5) continue;

      const ohlcBars: OHLCBar[] = bars.map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        timestamp: new Date(bar.date).getTime(),
      }));

      const evaluation = evaluateCustomFormulaDefinition(request.formula, ohlcBars);
      if (evaluation.errors.length > 0) {
        errors.push(`${target.symbol}: ${evaluation.errors.join(', ')}`);
        continue;
      }

      const lastIndex = ohlcBars.length - 1;
      const latestBar = ohlcBars[lastIndex];
      const matchPlot = evaluation.plots.find((p) => p.values[lastIndex] !== null && p.values[lastIndex] !== 0);

      if (matchPlot) {
        results.push({
          symbol: target.symbol,
          exchange: target.exchange,
          scannerId: 'custom_formula',
          scannerName: formulaName,
          categoryId: 'custom_formula',
          categoryName: 'Custom Formula',
          matched: true,
          direction: 'bullish',
          date: latestBar.date,
          values: {
            plotValue: matchPlot.values[lastIndex] ?? 0,
            formula: request.formula,
          },
          generatedAt: now,
        });
      }
    } catch (err) {
      errors.push(`${target.symbol}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    results,
    scannedSymbols,
    cancelled: false,
    alertTriggers: [],
    errors,
  };
}

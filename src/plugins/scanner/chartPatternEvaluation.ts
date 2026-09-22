import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/plugins/scanner/chartPatternScanners';
import type {
  ScannerContext,
  ScannerDefinition,
  ScannerResult,
  ScannerRunTarget,
} from '@/plugins/scanner/types';

const MIN_HISTORICAL_ENDPOINT_BARS = 20;
const HISTORY_PROGRESS_INTERVAL = 25;

export type ScannerExecutionMode = 'responsive' | 'fast';

export interface ChartPatternEvaluationProgress {
  completed: number;
  total: number;
  resultCount: number;
}

export interface ChartPatternEvaluationInput {
  target: ScannerRunTarget;
  bars: ScannerContext['bars'];
  scannerIds: string[];
  evaluateHistory: boolean;
  executionMode: ScannerExecutionMode;
  shouldCancel?: () => boolean;
  onProgress?: (progress: ChartPatternEvaluationProgress) => void;
}

export interface ChartPatternEvaluationOutput {
  latestResults: ScannerResult[];
  historicalResults: ScannerResult[];
  cancelled: boolean;
}

export function getChartPatternDefinitions(scannerIds: string[]): ScannerDefinition[] {
  const selectedIds = new Set(scannerIds);
  return chartPatternScannerDefinitions.filter((definition) => selectedIds.has(definition.id));
}

export function evaluateChartPatternDefinitions(
  context: ScannerContext,
  definitions: ScannerDefinition[],
): ScannerResult[] {
  return definitions.flatMap((definition) => {
    const result = runChartPatternScanner(context, definition);
    return result?.matched ? [result] : [];
  });
}

export async function evaluateChartPatterns({
  target,
  bars,
  scannerIds,
  evaluateHistory,
  executionMode,
  shouldCancel,
  onProgress,
}: ChartPatternEvaluationInput): Promise<ChartPatternEvaluationOutput> {
  const definitions = getChartPatternDefinitions(scannerIds);
  const context: ScannerContext = {
    symbol: target.symbol,
    exchange: target.exchange,
    instrument: target,
    bars,
  };
  const latestResults = evaluateChartPatternDefinitions(context, definitions);

  if (!evaluateHistory || definitions.length === 0) {
    return { latestResults, historicalResults: [], cancelled: false };
  }

  const completedGroups: ScannerResult[] = [];
  const activeGroups = new Map<string, ScannerResult>();
  const historyTotal = Math.max(0, bars.length - MIN_HISTORICAL_ENDPOINT_BARS + 1);

  for (let endIndex = MIN_HISTORICAL_ENDPOINT_BARS; endIndex <= bars.length; endIndex += 1) {
    if (shouldCancel?.()) {
      completedGroups.push(...activeGroups.values());
      return { latestResults, historicalResults: completedGroups, cancelled: true };
    }

    const endpointContext: ScannerContext = {
      symbol: target.symbol,
      exchange: target.exchange,
      instrument: target,
      bars: bars.slice(0, endIndex),
    };
    const matches = evaluateChartPatternDefinitions(endpointContext, definitions);
    const activeKeys = new Set<string>();

    matches.forEach((match) => {
      const key = historicalMatchKey(match);
      activeKeys.add(key);
      const active = activeGroups.get(key);
      if (active?.history) {
        active.history.lastMatchedDate = match.date;
        active.history.matchCount += 1;
        return;
      }
      activeGroups.set(key, {
        ...match,
        history: {
          firstMatchedDate: match.date,
          lastMatchedDate: match.date,
          matchCount: 1,
        },
      });
    });

    activeGroups.forEach((group, key) => {
      if (!activeKeys.has(key)) {
        completedGroups.push(group);
        activeGroups.delete(key);
      }
    });

    const historyCompleted = endIndex - MIN_HISTORICAL_ENDPOINT_BARS + 1;
    if (historyCompleted % HISTORY_PROGRESS_INTERVAL === 0 || historyCompleted === historyTotal) {
      onProgress?.({
        completed: historyCompleted,
        total: historyTotal,
        resultCount: completedGroups.length + activeGroups.size,
      });
      if (executionMode === 'responsive') {
        await yieldToEventLoop();
      }
    }
  }

  completedGroups.push(...activeGroups.values());
  return { latestResults, historicalResults: completedGroups, cancelled: false };
}

function historicalMatchKey(result: ScannerResult): string {
  return `${result.scannerId}:${result.direction ?? ''}`;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

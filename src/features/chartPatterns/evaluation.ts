import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/features/chartPatterns';
import type {
  ScannerContext,
  ScannerDefinition,
  ScannerResult,
  ScannerRunTarget,
} from '@/features/scanner/types';

const MIN_HISTORICAL_ENDPOINT_BARS = 20;
const MAX_PATTERN_WINDOW_BARS = 260;
const HISTORY_PROGRESS_INTERVAL = 25;
export const TOOLBAR_CHART_PATTERN_MIN_BARS = 20;
export const TOOLBAR_CHART_PATTERN_CONTEXT_BARS = 220;
export const TOOLBAR_CHART_PATTERN_STORAGE_KEY = 'eod-chart.toolbar-chart-patterns.ids.v1';

export type ScannerExecutionMode = 'responsive' | 'fast';

export interface ToolbarChartPatternSelection {
  scannerIds: string[];
  minScore: number;
}

export interface ToolbarChartPatternEvaluationInput {
  target: ScannerRunTarget;
  bars: ScannerContext['bars'];
  scannerIds: string[];
  minScore: number;
  executionMode: ScannerExecutionMode;
  shouldCancel?: () => boolean;
}

export interface ToolbarChartPatternEvaluationOutput {
  results: ScannerResult[];
  cancelled: boolean;
}

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

    const windowStart = Math.max(0, endIndex - MAX_PATTERN_WINDOW_BARS);
    const endpointContext: ScannerContext = {
      symbol: target.symbol,
      exchange: target.exchange,
      instrument: target,
      bars: bars.slice(windowStart, endIndex),
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
    if (historyCompleted % 50 === 0 || historyCompleted === historyTotal) {
      onProgress?.({
        completed: historyCompleted,
        total: historyTotal,
        resultCount: completedGroups.length + activeGroups.size,
      });
      if (historyCompleted % 150 === 0 && executionMode === 'responsive') {
        await yieldToEventLoop();
      }
    }
  }

  completedGroups.push(...activeGroups.values());
  return { latestResults, historicalResults: completedGroups, cancelled: false };
}

export function resolveToolbarChartPatternSelection(
  storage: Pick<Storage, 'getItem'> | null =
    typeof window !== 'undefined' ? (window.localStorage ?? null) : null,
): ToolbarChartPatternSelection {
  let selectedIds: Set<string> | null = null;
  if (storage) {
    try {
      const raw = storage.getItem(TOOLBAR_CHART_PATTERN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          selectedIds = new Set(parsed.filter((id): id is string => typeof id === 'string'));
        }
      }
    } catch {
      // Ignore unavailable or malformed localStorage values and fall back to default macro patterns.
    }
  }
  const minScore = selectedIds ? 40 : 65;
  const scannerIds = chartPatternScannerDefinitions
    .filter((definition) => {
      if (selectedIds) return selectedIds.has(definition.id);
      const family = definition.chartPattern?.family;
      const isCandleMicro = definition.id.includes('mat_hold') || definition.id.includes('three_methods');
      return family !== 'gap' && definition.scannerType !== 'gap' && !isCandleMicro;
    })
    .map((definition) => definition.id);
  return { scannerIds, minScore };
}

export function clusterToolbarChartPatternResults(
  results: ScannerResult[],
  bars: ScannerContext['bars'],
): ScannerResult[] {
  if (results.length <= 1) return results;
  const barIndexByDate = new Map<string, number>();
  for (let index = 0; index < bars.length; index += 1) {
    const date = bars[index]!.date;
    if (!barIndexByDate.has(date)) {
      barIndexByDate.set(date, index);
    }
  }

  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  const clustered: ScannerResult[] = [];
  const clusteredBarIndices: number[] = [];

  for (const current of sorted) {
    const currentIdx = barIndexByDate.get(current.date) ?? -1;
    let existingIndex = -1;
    for (let index = 0; index < clustered.length; index += 1) {
      const candidate = clustered[index]!;
      if (
        candidate.scannerId !== current.scannerId &&
        candidate.chartPattern?.family !== current.chartPattern?.family
      ) {
        continue;
      }
      if (Math.abs(currentIdx - clusteredBarIndices[index]!) <= 12) {
        existingIndex = index;
        break;
      }
    }

    if (existingIndex >= 0) {
      if ((current.score ?? 0) > (clustered[existingIndex]!.score ?? 0)) {
        clustered[existingIndex] = current;
        clusteredBarIndices[existingIndex] = currentIdx;
      }
    } else {
      clustered.push(current);
      clusteredBarIndices.push(currentIdx);
    }
  }

  return clustered;
}

export async function evaluateToolbarChartPatterns({
  target,
  bars,
  scannerIds,
  minScore,
  executionMode,
  shouldCancel,
}: ToolbarChartPatternEvaluationInput): Promise<ToolbarChartPatternEvaluationOutput> {
  const definitions = getChartPatternDefinitions(scannerIds);
  if (shouldCancel?.()) {
    return { results: [], cancelled: true };
  }
  if (definitions.length === 0 || bars.length < TOOLBAR_CHART_PATTERN_MIN_BARS) {
    return { results: [], cancelled: false };
  }

  const results: ScannerResult[] = [];
  const seen = new Set<string>();

  for (let endIndex = TOOLBAR_CHART_PATTERN_MIN_BARS; endIndex <= bars.length; endIndex += 1) {
    if (shouldCancel?.()) {
      return { results: [], cancelled: true };
    }

    const windowStart = Math.max(0, endIndex - TOOLBAR_CHART_PATTERN_CONTEXT_BARS);
    const endpointContext: ScannerContext = {
      symbol: target.symbol,
      exchange: target.exchange,
      instrument: target,
      bars: bars.slice(windowStart, endIndex),
    };
    for (const definition of definitions) {
      const result = runChartPatternScanner(endpointContext, definition);
      if (!result?.matched || (result.score ?? 0) < minScore) {
        continue;
      }
      const key = `${result.scannerId}:${result.date}:${result.direction ?? ''}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push({
        ...result,
        history: {
          firstMatchedDate: result.chartPattern?.patternStartDate ?? result.date,
          lastMatchedDate: result.date,
          matchCount: 1,
        },
      });
    }

    if (executionMode === 'responsive') {
      const completed = endIndex - TOOLBAR_CHART_PATTERN_MIN_BARS + 1;
      if (completed % 50 === 0) {
        await yieldToEventLoop();
      }
    }
  }

  if (shouldCancel?.()) {
    return { results: [], cancelled: true };
  }

  return {
    results: clusterToolbarChartPatternResults(results, bars),
    cancelled: false,
  };
}

function historicalMatchKey(result: ScannerResult): string {
  return `${result.scannerId}:${result.direction ?? ''}`;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

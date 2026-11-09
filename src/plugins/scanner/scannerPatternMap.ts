import type { InstrumentKey } from '@/platform';
import type { ChartPatternFamily, ChartPatternGeometry } from '@/plugins/scanner/chartPatternTypes';
import type { ScannerDefinition, ScannerDirection, ScannerPriority, ScannerResult } from '@/plugins/scanner/types';

export type ScannerPatternMapStatus = 'confirmed' | 'developing';
export type ScannerPatternMapFamilyFilter = 'all' | ChartPatternFamily;
export type ScannerPatternMapDirectionFilter = 'all' | ScannerDirection;
export type ScannerPatternMapPriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type ScannerPatternMapStatusFilter = 'all' | ScannerPatternMapStatus;

export interface ScannerPatternMapFilters {
  family: ScannerPatternMapFamilyFilter;
  direction: ScannerPatternMapDirectionFilter;
  priority: ScannerPatternMapPriorityFilter;
  status: ScannerPatternMapStatusFilter;
}

export interface ScannerPatternMapEntry {
  id: string;
  resultKey: string;
  instrument: InstrumentKey;
  date: string;
  scannerName: string;
  scannerId?: string;
  direction?: ScannerDirection;
  score?: number;
  levels: Array<{ label: string; value: number }>;
  geometry?: ChartPatternGeometry;
  editable: boolean;
  family: ChartPatternFamily;
  priority: ScannerPriority;
  status: ScannerPatternMapStatus;
}

export interface ScannerPatternMapCluster {
  id: string;
  date: string;
  count: number;
  representativeId: string;
}

export const DEFAULT_SCANNER_PATTERN_MAP_FILTERS: ScannerPatternMapFilters = {
  family: 'all',
  direction: 'all',
  priority: 'all',
  status: 'all',
};

export function buildScannerPatternMapEntries(
  results: ScannerResult[],
  definitions: Map<string, ScannerDefinition>,
  filters: ScannerPatternMapFilters,
): ScannerPatternMapEntry[] {
  return results.flatMap((result) => {
    const pattern = result.chartPattern;
    if (!result.history || !pattern) return [];
    const priority = definitions.get(result.scannerId)?.priority ?? 3;
    const status: ScannerPatternMapStatus = 'confirmed';
    if (!matchesFilters({ family: pattern.family, direction: result.direction, priority, status }, filters)) return [];
    const resultKey = getScannerPatternMapResultKey(result);
    return [{
      id: `scanner-map:${resultKey}`,
      resultKey,
      instrument: { exchange: result.exchange, symbol: result.symbol },
      date: result.date,
      scannerName: result.scannerName,
      scannerId: result.scannerId,
      direction: result.direction,
      score: result.score,
      levels: getScannerPatternMapLevels(result),
      geometry: pattern.geometry,
      editable: pattern.geometry?.family === 'range',
      family: pattern.family,
      priority,
      status,
    }];
  });
}

export function clusterScannerPatternMapEntries(entries: ScannerPatternMapEntry[]): ScannerPatternMapCluster[] {
  const byDate = new Map<string, ScannerPatternMapEntry[]>();
  entries.forEach((entry) => {
    const cluster = byDate.get(entry.date) ?? [];
    cluster.push(entry);
    byDate.set(entry.date, cluster);
  });
  return [...byDate.entries()].map(([date, cluster]) => ({
    id: `scanner-map-marker:${cluster[0]?.instrument.exchange}:${cluster[0]?.instrument.symbol}:${date}`,
    date,
    count: cluster.length,
    representativeId: cluster[0]?.id ?? '',
  }));
}

export function getScannerPatternMapResultKey(result: ScannerResult): string {
  return [
    result.exchange,
    result.symbol,
    result.scannerId,
    result.history?.firstMatchedDate ?? result.date,
    result.chartPattern?.patternStartDate ?? '',
  ].join(':');
}

function matchesFilters(
  entry: Pick<ScannerPatternMapEntry, 'family' | 'direction' | 'priority' | 'status'>,
  filters: ScannerPatternMapFilters,
): boolean {
  if (filters.family !== 'all' && filters.family !== entry.family) return false;
  if (filters.direction !== 'all' && filters.direction !== entry.direction) return false;
  if (filters.priority !== 'all' && priorityFilterValue(entry.priority) !== filters.priority) return false;
  if (filters.status !== 'all' && filters.status !== entry.status) return false;
  return true;
}

function priorityFilterValue(priority: ScannerPriority): Exclude<ScannerPatternMapPriorityFilter, 'all'> {
  if (priority === 1) return 'high';
  if (priority === 2) return 'medium';
  return 'low';
}

function getScannerPatternMapLevels(result: ScannerResult): Array<{ label: string; value: number }> {
  const pattern = result.chartPattern;
  if (!pattern) return [];
  return [
    { label: 'Breakout', value: pattern.breakoutLevel },
    { label: 'Support', value: pattern.supportLevel },
    { label: 'Resistance', value: pattern.resistanceLevel },
    { label: 'Neckline', value: pattern.necklineLevel },
  ].filter((level): level is { label: string; value: number } =>
    typeof level.value === 'number' && Number.isFinite(level.value),
  );
}

import type { ScannerChartOverlay } from '@/store/uiStore';

export function buildScannerPatternDrawingOverlay(entry: ScannerPatternMapEntry): ScannerChartOverlay | null {
  const hasLevels = entry.levels.some((l) => typeof l.value === 'number' && Number.isFinite(l.value));
  const hasGeometry = entry.geometry !== undefined;
  if (!hasLevels && !hasGeometry) return null;

  return {
    id: `overlay:${entry.id}`,
    instrument: entry.instrument,
    date: entry.date,
    scannerName: entry.scannerName,
    scannerId: entry.scannerId,
    contextBars: 260,
    direction: entry.direction,
    score: entry.score,
    levels: entry.levels,
    geometry: entry.geometry,
    editable: entry.editable,
  };
}

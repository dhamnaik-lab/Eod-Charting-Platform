import { describe, expect, it } from 'vitest';
import {
  buildScannerPatternDrawingOverlay,
  buildScannerPatternMapEntries,
  clusterScannerPatternMapEntries,
  DEFAULT_SCANNER_PATTERN_MAP_FILTERS,
} from '@/plugins/scanner/scannerPatternMap';
import type { ScannerDefinition, ScannerResult } from '@/plugins/scanner/types';

const definitions = new Map<string, ScannerDefinition>([
  ['range', definition('range', 1)],
  ['reversal', definition('reversal', 3)],
]);

describe('scanner historical Pattern Map', () => {
  it('includes only grouped historical chart-pattern episodes', () => {
    const entries = buildScannerPatternMapEntries(
      [historicalResult('range', '2026-01-10'), latestOnlyResult()],
      definitions,
      DEFAULT_SCANNER_PATTERN_MAP_FILTERS,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: '2026-01-10',
      family: 'neutral-bilateral',
      priority: 1,
      status: 'confirmed',
      editable: true,
    });
  });

  it('applies family, direction, priority, and status filters without inventing developing candidates', () => {
    const results = [historicalResult('range', '2026-01-10'), historicalResult('reversal', '2026-01-11', 'bearish')];

    expect(
      buildScannerPatternMapEntries(results, definitions, {
        family: 'neutral-bilateral',
        direction: 'all',
        priority: 'high',
        status: 'confirmed',
      }),
    ).toHaveLength(1);
    expect(
      buildScannerPatternMapEntries(results, definitions, {
        family: 'all',
        direction: 'all',
        priority: 'all',
        status: 'developing',
      }),
    ).toHaveLength(0);
  });

  it('clusters same-date map entries while retaining a representative stored episode', () => {
    const entries = buildScannerPatternMapEntries(
      [historicalResult('range', '2026-01-10'), historicalResult('reversal', '2026-01-10', 'bearish')],
      definitions,
      DEFAULT_SCANNER_PATTERN_MAP_FILTERS,
    );
    const clusters = clusterScannerPatternMapEntries(entries);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ date: '2026-01-10', count: 2, representativeId: entries[0]?.id });
  });

  it('builds a full ScannerChartOverlay from a map entry carrying geometry and levels', () => {
    const entries = buildScannerPatternMapEntries(
      [historicalResult('range', '2026-01-10')],
      definitions,
      DEFAULT_SCANNER_PATTERN_MAP_FILTERS,
    );
    expect(entries).toHaveLength(1);
    const overlay = buildScannerPatternDrawingOverlay(entries[0]);
    expect(overlay).not.toBeNull();
    expect(overlay).toMatchObject({
      date: '2026-01-10',
      scannerName: 'range',
      geometry: { family: 'range' },
    });
  });
});

function definition(id: string, priority: 1 | 2 | 3): ScannerDefinition {
  return {
    id,
    name: id,
    categoryId: 'chart',
    categoryName: 'Chart Patterns',
    priority,
    scannerType: 'pattern',
    description: '',
    logicText: '',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: [],
    implementationStatus: 'ready_for_engine',
  };
}

function historicalResult(scannerId: string, date: string, direction: 'bullish' | 'bearish' | 'neutral' = 'neutral'): ScannerResult {
  const family = scannerId === 'range' ? 'neutral-bilateral' : 'reversal';
  return {
    symbol: 'NIFTY',
    exchange: 'NSE_INDEX',
    scannerId,
    scannerName: scannerId,
    categoryId: 'chart',
    categoryName: 'Chart Patterns',
    date,
    matched: true,
    direction,
    generatedAt: '2026-01-10T00:00:00.000Z',
    history: { firstMatchedDate: date, lastMatchedDate: date, matchCount: 1 },
    chartPattern: {
      family,
      confidence: 80,
      patternEndDate: date,
      supportLevel: 100,
      resistanceLevel: 110,
      geometry: family === 'neutral-bilateral'
        ? { family: 'range', zones: [{ id: 'range', startDate: date, endDate: date, low: 100, high: 110, role: 'pattern-span' }] }
        : { family: 'double-top-bottom' },
    },
  };
}

function latestOnlyResult(): ScannerResult {
  return {
    ...historicalResult('range', '2026-01-12'),
    history: undefined,
  };
}

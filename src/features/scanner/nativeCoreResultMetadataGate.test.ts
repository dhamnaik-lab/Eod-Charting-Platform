import { describe, expect, it } from 'vitest';
import { coreOhlcvScannerDefinitions, runCoreScanner } from '@/plugins/scanner/coreOhlcvScanners';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';
import type { NativeScanMatchV1 } from './nativeScanContract';
import { isNativeCoreResultId, nativeCoreResultMetadataIssue } from './nativeCoreResultMetadataGate';

const CORE_IDS = coreOhlcvScannerDefinitions.map((definition) => definition.id);

function completeBars(scannerId: string): EodBar[] {
  const bars: EodBar[] = Array.from({ length: 20 }, (_, index) => ({
    symbol: 'TEST',
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    open: 100,
    high: 110,
    low: 90,
    close: 100,
    volume: 1000,
  }));
  const today = bars[19]!;
  switch (scannerId) {
    case 'prev_day_high_break':
      Object.assign(today, { open: 108, high: 115, low: 105, close: 112 });
      break;
    case 'prev_day_low_break':
      Object.assign(today, { open: 92, high: 95, low: 85, close: 89 });
      break;
    case 'inside_bar':
      Object.assign(today, { open: 100, high: 109, low: 91, close: 100 });
      break;
    case 'outside_bar':
      Object.assign(today, { open: 100, high: 111, low: 89, close: 100 });
      break;
    case 'close_near_high':
      Object.assign(today, { open: 100, high: 110, low: 90, close: 109 });
      break;
    case 'close_near_low':
      Object.assign(today, { open: 100, high: 110, low: 90, close: 91 });
      break;
    case 'gap_up':
      Object.assign(today, { open: 115, high: 120, low: 111, close: 118 });
      break;
    case 'gap_down':
      Object.assign(today, { open: 85, high: 89, low: 80, close: 83 });
      break;
    case 'nr7':
      Object.assign(today, { open: 100, high: 105, low: 95, close: 100 });
      break;
    case 'wide_range_candle':
      Object.assign(today, { open: 100, high: 130, low: 70, close: 100 });
      break;
    default:
      throw new Error(`Unknown core scanner: ${scannerId}`);
  }
  return bars;
}

function acceptedNativeMetadata(result: ScannerResult): NativeScanMatchV1 {
  return {
    exchange: result.exchange,
    symbol: result.symbol,
    ruleId: result.scannerId,
    date: result.date,
    scannerName: result.scannerName,
    categoryId: result.categoryId,
    categoryName: result.categoryName,
    direction: result.direction,
    reasons: result.reasons,
    values: result.values,
    source: result.source,
  };
}

describe('native core result metadata fail-closed gate — candidate-only', () => {
  it('requires exactly the accepted TypeScript metadata across all ten core rules', () => {
    expect(CORE_IDS).toHaveLength(10);
    for (const definition of coreOhlcvScannerDefinitions) {
      const result = runCoreScanner(
        { symbol: 'TEST', exchange: 'NSE', bars: completeBars(definition.id) },
        definition,
      );
      expect(result, definition.id).not.toBeNull();
      const native = acceptedNativeMetadata(result!);
      expect(isNativeCoreResultId(definition.id)).toBe(true);
      expect(nativeCoreResultMetadataIssue(native), definition.id).toBeNull();
      expect(nativeCoreResultMetadataIssue({ ...native, direction: undefined }), definition.id)
        .toContain('direction');
      expect(nativeCoreResultMetadataIssue({ ...native, source: undefined }), definition.id)
        .toContain('source');
      expect(nativeCoreResultMetadataIssue({ ...native, scannerName: undefined }), definition.id)
        .toContain('scanner and category');
      expect(nativeCoreResultMetadataIssue({ ...native, reasons: [] }), definition.id)
        .toContain('reason');
      expect(nativeCoreResultMetadataIssue({ ...native, values: undefined }), definition.id)
        .toContain('columns');
      expect(nativeCoreResultMetadataIssue({ ...native, score: 80 }), definition.id)
        .toContain('score');
      expect(nativeCoreResultMetadataIssue({
        ...native,
        history: { firstMatchedDate: native.date, lastMatchedDate: native.date, matchCount: 1 },
      }), definition.id).toContain('historical-group');
      expect(nativeCoreResultMetadataIssue({
        ...native,
        values: { ...native.values, unexpected: 5 },
      }), definition.id).toContain('columns');
      const column = definition.suggestedOutputColumns[0]!;
      expect(nativeCoreResultMetadataIssue({
        ...native,
        values: { ...native.values, [column]: Number.NaN },
      }), definition.id).toContain('finite number');
    }
  });

  it('never applies core metadata assumptions to gap patterns or unknown scanner IDs', () => {
    const other: NativeScanMatchV1 = {
      exchange: 'NSE', symbol: 'TEST', ruleId: 'chart_breakaway_gap', date: '2026-01-20',
    };
    expect(isNativeCoreResultId(other.ruleId)).toBe(false);
    expect(nativeCoreResultMetadataIssue(other)).toBeNull();
    expect(nativeCoreResultMetadataIssue({ ...other, ruleId: 'plugin_external' })).toBeNull();
    expect(isNativeCoreResultId('__proto__')).toBe(false);
  });

  it('allows nullable accepted calculations but refuses non-numeric or infinite values', () => {
    const def = coreOhlcvScannerDefinitions.find((item) => item.id === 'inside_bar')!;
    const result = runCoreScanner(
      { symbol: 'TEST', exchange: 'NSE', bars: completeBars(def.id) }, def,
    )!;
    const match = acceptedNativeMetadata(result);
    expect(nativeCoreResultMetadataIssue({
      ...match, values: { ...match.values, range_ratio: null },
    })).toBeNull();
    expect(nativeCoreResultMetadataIssue({
      ...match, values: { ...match.values, range_ratio: Number.POSITIVE_INFINITY },
    })).toContain('finite number');
    expect(nativeCoreResultMetadataIssue({
      ...match, values: { ...match.values, range_ratio: 'not-a-number' },
    })).toContain('finite number');
  });
});
